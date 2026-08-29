// RADAR MERKEZİ SERVİSİ — merkezi hesap + cache + mühürlü okuma.
// * Ağır analiz KULLANICI BAŞINA hesaplanmaz: refresh sırasında BİR KEZ
//   hesaplanır, cache'e yazılır; tüm kullanıcılar aynı merkezi sonucu okur.
// * Kilitli (snapshot'lı) haftalar ASLA yeniden hesaplanmaz — yalnız snapshot
//   payload'ındaki mühürlü radarCenter gösterilir. Metodoloji sonradan değişse
//   de eski bülten eski methodologyVersion ile kalır.
import { load, save, listRadarRounds } from '../cache.js';
import { macAniIso } from '../time/turkiyeSaati.js';
import { getArchiveStore } from '../archive/store.js';
import { computeFreezeAt, bulletinIdOf } from '../archive/snapshotService.js';
import { getPositionStats } from '../archive/resultsService.js';
import { computePerformanceRadar } from './performanceRadar.js';
import { computeExpectationRadar } from './expectationRadar.js';
import { computePublicBettingRadar, computeBandHistory } from './publicBettingRadar.js';
import { collectPlayedDnaRecords, buildBandHistoryRows } from './playedDnaArchive.js';
import { toPctDnaRecords } from '../providers/percentageDna.js';
import { computeMarketRadar } from './marketRadar.js';
import { computeBulletinMemoryRadar, buildMemoryContext, MEMORY_DISCLAIMER } from './bulletinMemoryRadar.js';
import { combineMaster } from './masterRadar.js';
import { computeSurpriseDna } from './surpriseDna.js';
import { getHistoryStore } from '../history/historyStore.js';
import { positionStatsFromHistory, mergePositionStats, historyLearningFilter } from '../history/positionDna.js';

import {
  METHODOLOGY_VERSION, BASE_WEIGHTS, RADAR_IDS, RADAR_META, GATES, CLASS_BANDS,
  PUBLIC_BANDS, SAMPLE_LADDER, CLASSIFICATION_LABELS, METHODOLOGY_NOTES, MEMORY_WEIGHT_CAP, MARKET_RULES,
} from './config.js';
import { masterDataQuality } from './dataQuality.js';

// Sağlayıcı id → KULLANICIYA GÖRÜNEN AD.
//
// BAHİS SİTESİ ADI KULLANILMAZ. Uygulama bahis sitesi tanıtımı yapamaz
// (yasal/mağaza kısıtı); bu yüzden kaynaklar RENK ADIYLA anılır ve ekranda
// renkli noktayla gösterilir. Site kimliği (id) yalnız İÇERİDE, kaynakları
// birbirine karıştırmamak için kullanılır — asla yanıta yazılmaz.
// Eşleme SABİTTİR: aynı kaynak her hafta aynı renk, yoksa kullanıcı haftalar
// arasında kıyas yapamaz.
const PROVIDER_DISPLAY = {
  nesine: 'Sarı kaynak',
  misli: 'Turuncu kaynak',
  oley: 'Mor kaynak',
  iddaa: 'Mavi kaynak',
};
const providerDisplay = (id) => PROVIDER_DISPLAY[id] || 'Kaynak';

// ---------------------------------------------------------------------------
// MERKEZİ HESAP — bir bültenin 15 maçı için Radar 1-5 + Master + DNA.
// Saf-ımsı: veri nesnesi + store alır; sonuç deterministiktir (now sabitlenir).
// ---------------------------------------------------------------------------
export async function computeRadarCenterForData(data, { store = getArchiveStore(), now = Date.now() } = {}) {
  if (!data || data.pending || data.roundId == null) return null;
  const bulletinId = bulletinIdOf(data.roundId);
  const observedAt = new Date(now).toISOString();
  const freezeAt = computeFreezeAt(data.matches);

  // --- ÖĞRENME SINIRI: yalnız BU HAFTADAN ÖNCE tamamlanmış arşiv kullanılır.
  // Radar 5 (Bülten DNA) kaynakları: (a) doğrulanmış official_result_history
  // geçmiş arşivi, (b) birikecek official_forward değerlendirmeleri. Bir
  // haftanın sonucu EN ERKEN sonraki bültenden itibaren kullanılabilir
  // (roundId < data.roundId). Legacy/backfill ASLA girmez.
  let memoryContext = null;
  try {
    const [posStats, evals] = await Promise.all([
      getPositionStats({ toRound: data.roundId - 1 }, { store }),
      store.listEvaluations(),
    ]);
    const pastEvals = (evals || []).filter((e) => Number(e.roundId) < Number(data.roundId));
    let mergedPos = posStats;
    try {
      const histAll = await getHistoryStore().listAllMatches();
      const histUsable = histAll.filter(historyLearningFilter({
        currentRoundId: data.roundId, currentFreezeAt: freezeAt,
      }));
      if (histUsable.length) mergedPos = mergePositionStats(posStats, positionStatsFromHistory(histUsable));
    } catch { /* geçmiş arşiv yoksa yalnız ileri-test verisi kullanılır */ }
    memoryContext = buildMemoryContext({ positionStats: mergedPos, evaluations: pastEvals });
  } catch {
    memoryContext = null;
  }

  // --- Gözlem serileri (oran zaman çizelgesi + varsa halk yüzdeleri).
  let obsByMatch = new Map();
  try {
    const allObs = await store.listObservations(bulletinId);
    for (const o of allObs) {
      const k = String(o.matchId);
      if (!obsByMatch.has(k)) obsByMatch.set(k, []);
      obsByMatch.get(k).push(o);
    }
  } catch { obsByMatch = new Map(); }

  // Halk yüzdesi BANT GEÇMİŞİ — gerçek arşivden beslenir.
  // ÖĞRENME SINIRI: yalnız BU HAFTADAN ÖNCEKİ turlar (roundId < bu hafta) ve
  // yalnız ARŞİV TABANINDAN (51. hafta / roundId 1525) İTİBAREN. 52. hafta için
  // arşiv 51'dir; 53. hafta için 51+52 olur. Öncesinde günlük oynanma gözlemi
  // toplanmadı, o turlar hiç okunmaz; geçmişe dönük yüzde ÜRETİLMEZ.
  // Arşiv boşsa hasData:false kalır (uydurma yok).
  let bandHistory;
  // BENZER-DNA KAYITLARI: computePublicBettingRadar'ın findSimilarDna kancası
  // bu parametreyi baştan beri kabul ediyordu ama hiç BAĞLANMAMIŞTI — benzer
  // sonuç analizi her maçta "sistem öğreniyor" kalıyordu. Aynı arşiv verisi
  // (öğrenme sınırı: yalnız bu haftadan ÖNCEKİ turlar) pct-DNA biçimine
  // çevrilip radara verilir; n<10'da yine yön sinyali üretilmez.
  let pctDnaRecords = [];
  try {
    const dnaRecords = await collectPlayedDnaRecords(store, { beforeRoundId: data.roundId, now });
    bandHistory = computeBandHistory(buildBandHistoryRows(dnaRecords));
    pctDnaRecords = toPctDnaRecords(dnaRecords);
  } catch {
    bandHistory = computeBandHistory([]);
  }

  const matches = (data.matches || [])
    .slice()
    .sort((a, b) => (a.no || 0) - (b.no || 0))
    .map((m) => {
      const matchKey = String(m.sportotoMatchId ?? m.no);
      const obs = obsByMatch.get(matchKey) || [];
      // MÜHÜR SINIRI: ilk maçtan 5 dk sonrası gözlemler (post_lock_research)
      // tahmine SIZAMAZ — yalnız freeze öncesi, tahmine uygun gözlemler girer.
      const publicSeries = obs
        .filter((o) => o.playedPct && (o.playedPct['1'] != null || o.playedPct.X != null))
        .filter((o) => o.kind !== 'post_lock_research' && o.usableForPrediction !== false)
        .filter((o) => !freezeAt || String(o.observedAt) <= String(freezeAt))
        .map((o) => ({
          providerId: o.source, providerName: providerDisplay(o.source),
          percentages: o.playedPct, observedAt: o.observedAt,
          kind: o.kind ?? null, firstObservedLate: o.firstObservedLate ?? null,
        }));

      const r1 = computePerformanceRadar(m, { observedAt });
      const r2 = computeExpectationRadar(m, { observedAt });
      const r3 = computePublicBettingRadar(m, { matchPublicData: publicSeries, bandHistory, observedAt, pctDnaRecords });
      const r4 = computeMarketRadar(m, { observations: obs, publicRadar: r3, lockAt: freezeAt, observedAt });
      const r5 = computeBulletinMemoryRadar(m, { memoryContext, observedAt });

      const radars = {
        [RADAR_IDS.PERFORMANCE]: r1,
        [RADAR_IDS.EXPECTATION]: r2,
        [RADAR_IDS.PUBLIC]: r3,
        [RADAR_IDS.MARKET]: r4,
        [RADAR_IDS.MEMORY]: r5,
      };
      const dna = computeSurpriseDna(radars);
      const master = combineMaster(radars, { surpriseDna: dna });

      return {
        no: m.no,
        matchId: matchKey,
        home: m.home?.mediumName || m.home?.name || '',
        away: m.away?.mediumName || m.away?.name || '',
        league: m.league || null,
        kickoffAt: macAniIso(m.date),
        kickoffTimeKnown: m.kickoffTimeKnown !== false,
        master,
        radars,
      };
    });

  // Bülten özeti
  const byClass = {};
  for (const mm of matches) byClass[mm.master.classification] = (byClass[mm.master.classification] || 0) + 1;
  const summary = {
    counts: byClass,
    drawRiskMatches: matches.filter((mm) => (mm.master.scores?.draw ?? 0) >= 30).map((mm) => mm.no),
    awaySurpriseMatches: matches
      .filter((mm) => mm.master.favorite?.symbol === '1' && (mm.master.favoriteFailureRisk ?? 0) >= 55 && mm.master.exactDirection === '2')
      .map((mm) => mm.no),
    avgDataQuality: matches.length
      ? Math.round(matches.reduce((s, mm) => s + (mm.master.dataQuality || 0), 0) / matches.length)
      : 0,
    memoryDisclaimer: MEMORY_DISCLAIMER,
  };

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    baseWeights: BASE_WEIGHTS,
    generatedAt: observedAt,
    roundId: data.roundId,
    round: data.round ?? null,
    year: data.year ?? null,
    freezeAt,
    matches,
    summary,
    memory: memoryContext ? {
      hasData: memoryContext.hasData,
      sampleBulletins: memoryContext.sampleBulletins,
      segments: memoryContext.segments,
      bankoBreakPositions: memoryContext.bankoBreakPositions,
      avgSurprisesPerBulletin: memoryContext.avgSurprisesPerBulletin,
      disclaimer: MEMORY_DISCLAIMER,
    } : { hasData: false, disclaimer: MEMORY_DISCLAIMER },
  };
}

// ---------------------------------------------------------------------------
// REFRESH ENTEGRASYONU: kilit ÖNCESİ her refresh'te yeniden hesaplanır;
// kilitliyse ÖNCEKİ sonuç AYNEN korunur (yeniden hesap YASAK).
// ---------------------------------------------------------------------------
export async function prepareRadarCenter(data, { previous = null, isLocked = false, store = getArchiveStore(), now = Date.now() } = {}) {
  if (!data || data.pending || data.roundId == null) return null;
  if (isLocked && previous?.radarCenter && previous.roundId === data.roundId) {
    return previous.radarCenter;                        // 🔒 kilit sonrası yeniden hesap yok
  }
  // Snapshot varsa da mühürlü halini esas al (sunucu yeniden başlasa bile).
  try {
    const snap = await store.getSnapshot(bulletinIdOf(data.roundId));
    if (snapshotHasRadarCenter(snap)) {
      return sealedRadarCenterFromSnapshot(snap);
    }
  } catch { /* arşiv okunamadıysa canlı hesap */ }
  const rc = await computeRadarCenterForData(data, { store, now });
  if (rc) {
    try { save(`radarCenter-${data.roundId}`, rc); } catch { /* cache yazılamazsa canlı sonuç yine döner */ }
  }
  return rc;
}

// Snapshot'ta mühürlü Radar Merkezi var mı? Maç bazlı radarCenter kayıtları
// payload.matches[].radarCenter altındadır (payload.radarCenter yalnız ÜST
// BİLGİDİR: ağırlık/sürüm/özet — matches alanı YOKTUR). Yanlış yol kontrolü
// mühürlü haftaları "kayıt yok" sanıp legacy 404'e düşürüyordu (kök nedenin
// ikinci halkası) — tek doğru kontrol burasıdır.
export function snapshotHasRadarCenter(snap) {
  return !!(snap?.payload?.matches?.some?.((m) => m?.radarCenter));
}

// Snapshot payload'ından mühürlü radarCenter görünümü (yeniden hesap YOK).
export function sealedRadarCenterFromSnapshot(snap) {
  const rcMeta = snap.payload?.radarCenter || {};
  const matches = (snap.payload?.matches || [])
    .filter((m) => m.radarCenter)
    .map((m) => ({
      no: m.no,
      matchId: m.matchId,
      home: m.home?.mediumName || m.home?.name || '',
      away: m.away?.mediumName || m.away?.name || '',
      league: m.league || null,
      kickoffAt: m.kickoffAt || null,
      master: m.radarCenter.master,
      radars: m.radarCenter.radars,
    }));
  return {
    methodologyVersion: rcMeta.methodologyVersion || snap.payload?.engine?.analysisEngineVersion || null,
    baseWeights: rcMeta.baseWeights || null,
    generatedAt: rcMeta.generatedAt || snap.lockedAt,
    roundId: Number(snap.bulletinId),
    round: snap.payload?.bulletin?.week ?? null,
    year: snap.payload?.bulletin?.season ?? null,
    freezeAt: snap.payload?.bulletin?.freezeAt ?? null,
    matches,
    summary: rcMeta.summary || null,
    memory: rcMeta.memory || null,
    sealed: true,
    sealedAt: snap.lockedAt,
    verificationHash: snap.payloadHash,
  };
}

// ---------------------------------------------------------------------------
// GÖRÜNÜMLER (API katmanı bunları döner)
// ---------------------------------------------------------------------------

// Resmî sonuçları mühürlü radar görünümüne YAN BİLGİ olarak iliştirir
// (mühürlü kayda yazılmaz; yalnız yanıt içinde birleştirilir).
async function attachOfficialResults(view, { store }) {
  try {
    const results = await store.listOfficialResults(String(view.roundId));
    if (!results.length) return view;
    const byId = new Map(results.map((r) => [String(r.matchId), r]));
    return {
      ...view,
      matches: view.matches.map((m) => {
        const r = byId.get(String(m.matchId));
        if (!r) return m;
        // NOTER KARARI (ertelenen maç): işaret kullanıcıya AÇIKÇA gösterilir
        // ama motor isabeti HESAPLANMAZ — maç oynanmadı, "tahmin tuttu"
        // rozeti yanlış ölçüm olurdu (2026-08-10).
        const viaNotary = r.resultType === 'notary_decision';
        return {
          ...m,
          official: {
            result: r.officialResult,
            score: r.fullTimeScore,
            resultType: r.resultType ?? null,
          },
          outcome: (!viaNotary && m.master?.mainPrediction) ? {
            mainHit: m.master.mainPrediction === r.officialResult,
            favoriteFailed: m.master.favorite?.symbol ? m.master.favorite.symbol !== r.officialResult : null,
            exactDirectionHit: m.master.exactDirection ? m.master.exactDirection === r.officialResult : null,
          } : null,
        };
      }),
    };
  } catch { return view; }
}

// GÜNCEL HAFTA KİMLİĞİ — tek doğruluk kaynağı.
// 1) bulletin cache (pending olsa bile roundId taşıyorsa) esastır;
// 2) cache boşsa (deploy/yeniden başlatma penceresi) KALICI ARŞİVDEN türetilir:
//    tamamlanmamış (active/locked) en yeni bülten güncel haftadır.
// Böylece cache silinse de güncel hafta ASLA "geçmiş arşiv" muamelesi görmez.
export async function resolveCurrentRound({ store = getArchiveStore() } = {}) {
  const data = load('bulletin')?.data;
  if (data?.roundId != null) {
    return {
      roundId: Number(data.roundId), round: data.round ?? null, year: data.year ?? null,
      pending: !!data.pending, source: 'cache',
      freezeAt: data.pending ? null : computeFreezeAt(data.matches || []),
    };
  }
  try {
    const open = (await store.listBulletins())
      .filter((b) => b.roundId != null && b.status !== 'completed')
      .sort((a, b) => Number(b.roundId) - Number(a.roundId));
    if (open.length) {
      const b = open[0];
      return {
        roundId: Number(b.roundId), round: b.week ?? null, year: b.season ?? null,
        pending: true, source: 'archive', freezeAt: b.freezeAt ?? null, lockedAt: b.lockedAt ?? null,
      };
    }
  } catch { /* arşiv okunamıyorsa güncel hafta bilinmiyor demektir */ }
  return null;
}

export async function getCurrentRadarCenter({ store = getArchiveStore(), now = Date.now() } = {}) {
  const cached = load('bulletin');
  const data = cached?.data;
  if (!data || data.pending) {
    // DÜRÜST bekleme yanıtı: içerik YOK ama kimlik (hangi hafta?) biliniyorsa
    // verilir — güncel hafta asla arşive düşmez, asla "arşiv yok" olmaz.
    const cur = await resolveCurrentRound({ store });
    // Cache silinmiş ama güncel hafta MÜHÜRLÜ ise: mühürlü radar aynen sunulur
    // (veri varken "bekleniyor" denmez; yeniden hesap da YAPILMAZ).
    if (cur?.roundId != null) {
      try {
        const snap = await store.getSnapshot(bulletinIdOf(cur.roundId));
        if (snapshotHasRadarCenter(snap)) {
          const sealedView = {
            hasData: true, current: true,
            ...sealedRadarCenterFromSnapshot(snap),
            sealed: true, sealedAt: snap.lockedAt, verificationHash: snap.payloadHash,
            radarFreezeAt: snap.payload?.bulletin?.freezeAt ?? null,
            legacy: { radar: [], radarFrozenAt: snap.lockedAt },
          };
          return attachOfficialResults(sealedView, { store });
        }
      } catch { /* snapshot okunamadıysa dürüst bekleme yanıtına düş */ }
    }
    return {
      hasData: false, current: true, pending: true,
      roundId: cur?.roundId ?? null, round: cur?.round ?? null, year: cur?.year ?? null,
      freezeAt: cur?.freezeAt ?? null,
      note: 'Güncel resmî bülten bekleniyor — radar, bülten açıklanınca hesaplanır.',
    };
  }
  let rc = data.radarCenter || load(`radarCenter-${data.roundId}`)?.data || null;
  const bulletinId = bulletinIdOf(data.roundId);
  let sealedInfo = null;
  try {
    const snap = await store.getSnapshot(bulletinId);
    if (snapshotHasRadarCenter(snap)) {
      rc = sealedRadarCenterFromSnapshot(snap);         // mühürlü hali esastır
      sealedInfo = { sealed: true, sealedAt: snap.lockedAt, verificationHash: snap.payloadHash, shortHash: snap.payloadHash?.slice(0, 10) };
    }
  } catch { /* arşiv yoksa canlı görünüm */ }
  if (!rc) {
    try {
      rc = await computeRadarCenterForData(data, { store, now });
    } catch (e) {
      // Sessiz yutma YOK: kök neden loglanır, kullanıcıya dürüst durum döner.
      console.warn(`[radar] güncel hafta (${data.roundId}) radar hesabı BAŞARISIZ:`, e.message);
      rc = null;
    }
    if (rc) { try { save(`radarCenter-${data.roundId}`, rc); } catch { /* no-op */ } }
  }
  if (!rc) {
    console.warn(`[radar] güncel hafta (${data.roundId}) için radar üretilemedi — bülten verisi eksik olabilir.`);
    return {
      hasData: false, current: true,
      roundId: data.roundId ?? null, round: data.round ?? null, year: data.year ?? null,
      note: 'Radar hesaplanamadı — veri eksik olabilir. Sonraki yenilemede tekrar denenecek.',
    };
  }

  const view = {
    hasData: true,
    current: true,
    ...rc,
    sealed: !!sealedInfo?.sealed || !!rc.sealed,
    sealedAt: sealedInfo?.sealedAt || rc.sealedAt || null,
    verificationHash: sealedInfo?.verificationHash || rc.verificationHash || null,
    radarFreezeAt: rc.freezeAt || null,                 // geri sayım için
    // Geriye uyumluluk: eski istemciler için legacy alanlar.
    legacy: { radar: data.radar || [], radarFrozenAt: data.radarFrozenAt || null },
  };
  return attachOfficialResults(view, { store });
}

export async function getRadarCenterForRound(roundId, { store = getArchiveStore(), now = Date.now() } = {}) {
  // GÜNCEL HAFTA KONTROLÜ: yalnız cache değil, arşivden türetilen güncel hafta
  // da sayılır — cache silinmiş olsa bile güncel hafta ASLA arşiv yoluna girmez.
  const cur = await resolveCurrentRound({ store });
  if (cur != null && String(cur.roundId) === String(roundId)) {
    return getCurrentRadarCenter({ store, now });
  }
  // Mühürlü arşiv (tek doğru kaynak — güncel motorla YENİDEN HESAP YAPILMAZ).
  const snap = await store.getSnapshot(String(roundId)).catch(() => null);
  if (snapshotHasRadarCenter(snap)) {
    const view = { hasData: true, current: false, ...sealedRadarCenterFromSnapshot(snap) };
    return attachOfficialResults(view, { store });
  }
  // Radar Merkezi öncesi haftalar: eski mühürlü "sürpriz radarı" arşivi (legacy).
  const legacyArch = load(`radar-${roundId}`)?.data;
  if (legacyArch) {
    return {
      hasData: false,
      current: false,
      legacyOnly: true,
      roundId: Number(roundId),
      round: legacyArch.round ?? null,
      year: legacyArch.year ?? null,
      sealed: true,
      sealedAt: legacyArch.radarFrozenAt ?? null,
      note: 'Bu hafta Radar Merkezi kurulmadan önce mühürlendi — yalnız eski sürpriz radarı arşivi mevcut.',
      legacy: { radar: legacyArch.radar || [], radarFrozenAt: legacyArch.radarFrozenAt || null },
    };
  }
  return { hasData: false, current: false, note: 'Bu hafta için radar kaydı yok.' };
}

export async function listRadarWeeks({ store = getArchiveStore() } = {}) {
  const weeks = new Map();
  try {
    for (const b of await store.listBulletins()) {
      const snap = await store.getSnapshot(b.id).catch(() => null);
      weeks.set(Number(b.roundId), {
        roundId: Number(b.roundId), round: b.week ?? null, year: b.season ?? null, status: b.status,
        sealed: !!snap, sealedAt: snap?.lockedAt || null,
        freezeAt: b.freezeAt ?? null, lockedAt: snap?.lockedAt ?? b.lockedAt ?? null,
        hasRadarCenter: snapshotHasRadarCenter(snap),
      });
    }
  } catch { /* arşiv yoksa cache'ten devam */ }
  for (const rid of listRadarRounds()) {
    if (!weeks.has(Number(rid))) {
      const arch = load(`radar-${rid}`)?.data;
      weeks.set(Number(rid), {
        roundId: Number(rid), round: arch?.round ?? null, year: arch?.year ?? null,
        status: 'legacy', sealed: !!arch?.radarFrozenAt, sealedAt: arch?.radarFrozenAt ?? null,
        freezeAt: null, lockedAt: arch?.radarFrozenAt ?? null, hasRadarCenter: false,
      });
    }
  }
  // Güncel hafta: cache VEYA (cache boşsa) arşivden türetilir — listede MUTLAKA yer alır.
  const cur = await resolveCurrentRound({ store });
  const curNum = cur?.roundId != null ? Number(cur.roundId) : null;
  if (curNum != null && !weeks.has(curNum)) {
    const cachedData = load('bulletin')?.data;
    weeks.set(curNum, {
      roundId: curNum, round: cur.round ?? null, year: cur.year ?? null,
      status: 'current', sealed: false, sealedAt: null,
      freezeAt: cur.freezeAt ?? null, lockedAt: null,
      hasRadarCenter: !!(cachedData?.radarCenter || load(`radarCenter-${curNum}`)),
    });
  }
  // AÇIK işaretler: current / archived / locked — istemci roundId sıralamasına
  // değil bu alanlara bakar. Güncel hafta ASLA archived işaretlenmez.
  const list = [...weeks.values()]
    .map((w) => {
      const current = curNum != null && Number(w.roundId) === curNum;
      return {
        ...w,
        current,
        locked: !!w.sealed || w.status === 'locked',
        archived: !current && (!!w.sealed || w.status === 'completed' || w.status === 'legacy'),
      };
    })
    .sort((a, b) => b.roundId - a.roundId);
  return { currentRoundId: curNum, weeks: list };
}

// Metodoloji dökümü (API /api/radar/methodology)
export function getMethodology() {
  return {
    methodologyVersion: METHODOLOGY_VERSION,
    radars: Object.values(RADAR_IDS).map((id) => ({ id, ...RADAR_META[id], baseWeight: BASE_WEIGHTS[id] })),
    weights: { base: BASE_WEIGHTS, memoryCap: MEMORY_WEIGHT_CAP, note: 'Verisi olmayan radarın ağırlığı sıfırlanır; kalan aktif radarlar 100\'e normalize edilir.' },
    classification: { bands: CLASS_BANDS, labels: CLASSIFICATION_LABELS, gates: GATES },
    publicBands: PUBLIC_BANDS,
    sampleLadder: SAMPLE_LADDER,
    marketRules: MARKET_RULES,
    notes: METHODOLOGY_NOTES,
  };
}

// Güncel bültenin veri yeterliliği özeti (API /api/radar/data-quality)
export async function getRadarDataQuality({ store = getArchiveStore() } = {}) {
  const view = await getCurrentRadarCenter({ store });
  if (!view?.hasData) return { hasData: false, note: view?.note || 'Veri yok.' };
  const perRadar = Object.values(RADAR_IDS).map((id) => {
    const items = view.matches.map((m) => m.radars?.[id]).filter(Boolean);
    const active = items.filter((r) => r.hasData);
    return {
      id,
      name: RADAR_META[id].name,
      activeMatches: active.length,
      totalMatches: items.length,
      avgDataQuality: active.length ? Math.round(active.reduce((s, r) => s + r.dataQuality, 0) / active.length) : 0,
      status: active.length ? 'ok' : (items[0]?.status || 'insufficient'),
      note: active.length ? null : (items[0]?.note || null),
    };
  });
  const masterAvg = masterDataQuality(perRadar.map((r) => ({ weight: r.activeMatches ? BASE_WEIGHTS[r.id] : 0, dataQuality: r.avgDataQuality })));
  return {
    hasData: true,
    roundId: view.roundId,
    sealed: !!view.sealed,
    generatedAt: view.generatedAt,
    masterAvgDataQuality: view.summary?.avgDataQuality ?? masterAvg,
    perRadar,
  };
}
