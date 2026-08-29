// SNAPSHOT MOTORU — çekirdek servis
// KURAL: Her bülten, İLK maçın resmî başlama saatinden 5 DAKİKA önce (freezeAt)
// snapshot alınarak kilitlenir. Snapshot alındıktan sonra o bültenin maç-öncesi
// arşivi HİÇBİR ŞEKİLDE değiştirilemez. Sonuçlar ayrı tabloya yazılır ve
// snapshot'a geri sızamaz (payload'da sonuç alanı YOKTUR; halfTimeScore YOKTUR).
//
// Bu modül saf veri nesneleriyle çalışır (refresh.js'in cache'e yazdığı bülten
// yapısı) — ağ çağrısı yapmaz; bu sayede testlenebilir ve deterministiktir.
import {
  SCHEMA_VERSION, ANALYSIS_ENGINE_VERSION, CRITERIA_CATALOG_VERSION,
  RADAR_ID, RADAR_VERSION, FREEZE_BEFORE_MS, LATE_THRESHOLD_MS,
} from './constants.js';
import { hashPayload, HASH_ALGO } from './hash.js';
import { macAniMs, macAniIso } from '../time/turkiyeSaati.js';
import { getArchiveStore } from './store.js';
import { AlreadyExistsError, ValidationError } from './errors.js';
import { evaluateCriteriaSignals, CRITERIA_LABELS } from '../analysis/criteriaEval.js';
import { getCriteriaPerformanceBefore } from './resultsService.js';
import { getHistoryStore } from '../history/historyStore.js';
import { computePositionDna, historyLearningFilter } from '../history/positionDna.js';
import { sealDailyPct } from '../radar/playedDnaArchive.js';
import { movementOf } from '../radar/playedDna.js';
import { PUBLIC_MOVE_RULES } from '../radar/config.js';
import { OYNANMA_TOLERANSLARI, ORAN_TOLERANSLARI } from '../radar/siraFiltre.js';

// Maç/bülten saatleri TEK yerden çözülür (`macAniIso`): saat dilimi eki olan
// değerler olduğu gibi, EKSİZ olanlar Türkiye duvar saati kabul edilir. Ham
// `new Date(...)` sunucunun saat dilimine göre farklı an üretiyordu — üretim
// (UTC) ile geliştirme (TSİ) arasında 3 saatlik sapma ölçüldü.
const iso = (v) => macAniIso(v);

// Backend sembolleri → kullanıcıya dönük gösterim ('0' = X).
export function displaySymbol(sym) {
  const map = { '1': '1', '0': 'X', X: 'X', '2': '2', '10': '1X', '02': 'X2', '12': '12', '102': '1X2' };
  return map[String(sym ?? '')] || null;
}

// Bültendeki İLK maçın resmî başlama zamanı (UTC ms). Maç saati yoksa null.
export function firstKickoffMs(matches) {
  const times = (matches || [])
    .filter((m) => m?.kickoffTimeKnown !== false) // saati girilmemiş maç sayılmaz
    .map((m) => macAniMs(m.date ?? m.kickoffAt) ?? 0)
    .filter((t) => Number.isFinite(t) && t > 0);
  return times.length ? Math.min(...times) : null;
}

// freezeAt = ilk maç - 5 dk (UTC ISO). Europe/Istanbul dönüşümü çağırana ait
// DEĞİLDİR: resmî maç saatleri zaten zone bilgisiyle parse edilir, UTC saklanır.
export function computeFreezeAt(matches) {
  const first = firstKickoffMs(matches);
  return first == null ? null : new Date(first - FREEZE_BEFORE_MS).toISOString();
}

export function bulletinIdOf(roundId) {
  return String(roundId);
}

// --------------------------------------------------------------------------
// KAYIT: refresh her çalıştığında bülten + maç kimlikleri arşive işlenir.
// Kilitliyse kimlik yazımı YAPILMAZ (store zaten reddeder) — yalnız durum okunur.
// --------------------------------------------------------------------------
export async function registerBulletinFromData(data, { store = getArchiveStore(), now = Date.now() } = {}) {
  if (!data || data.pending || data.roundId == null) return null;
  const id = bulletinIdOf(data.roundId);
  const existing = await store.getBulletin(id);
  const firstMs = firstKickoffMs(data.matches);
  const freezeAt = computeFreezeAt(data.matches);
  const locked = existing && ['locked', 'completed', 'cancelled'].includes(existing.status);

  if (!locked) {
    const status = existing?.status === 'cancelled' ? 'cancelled'
      : (freezeAt && now >= new Date(freezeAt).getTime() ? (existing?.status === 'locked' ? 'locked' : existing?.status || 'active') : 'active');
    await store.upsertBulletin({
      id, roundId: data.roundId, season: data.year ?? null, week: data.round ?? null,
      status: status === 'locked' ? 'active' : status, // kilidi YALNIZ freeze akışı koyar
      firstMatchStartAt: firstMs != null ? new Date(firstMs).toISOString() : null,
      freezeAt, closeDate: data.closeDate ?? null,
      officialSignature: data.verification?.signature ?? null,
    });
    await store.replaceMatches(id, (data.matches || []).map((m) => ({
      matchId: String(m.sportotoMatchId ?? m.no), orderNo: m.no,
      homeName: m.home?.name || '', awayName: m.away?.name || '', league: m.league || null,
      kickoffAt: iso(m.date),
      externalIds: {
        footyMatchId: m.footyMatchId ?? null, footySeasonId: m.footySeasonId ?? null,
        footySwapped: m.footySwapped ?? null,
        homeExternalTeamId: m.home?.externalTeamId ?? null, awayExternalTeamId: m.away?.externalTeamId ?? null,
      },
      preMatchIdentity: {
        homeMediumName: m.home?.mediumName || null, awayMediumName: m.away?.mediumName || null,
        homeShortName: m.home?.shortName || null, awayShortName: m.away?.shortName || null,
      },
    })));
    if (!existing) {
      await store.appendAudit({ bulletinId: id, action: 'register', actor: 'refresh', newValue: { roundId: data.roundId, week: data.round, freezeAt } });
    }
  } else {
    // Kilit sonrası resmî kaynakta kimlik farkı görülürse SESSİZCE uygulanmaz;
    // audit'e "reddedilen değişiklik" olarak yazılır (orijinal arşiv korunur).
    const stored = await store.getMatches(id);
    const byId = new Map(stored.map((m) => [String(m.matchId), m]));
    const diffs = [];
    for (const m of data.matches || []) {
      const prev = byId.get(String(m.sportotoMatchId ?? m.no));
      if (!prev) { diffs.push({ type: 'newMatch', no: m.no, home: m.home?.name, away: m.away?.name }); continue; }
      if (prev.orderNo !== m.no) diffs.push({ type: 'order', matchId: prev.matchId, from: prev.orderNo, to: m.no });
      if ((prev.homeName || '') !== (m.home?.name || '')) diffs.push({ type: 'home', matchId: prev.matchId, from: prev.homeName, to: m.home?.name });
      if ((prev.awayName || '') !== (m.away?.name || '')) diffs.push({ type: 'away', matchId: prev.matchId, from: prev.awayName, to: m.away?.name });
      const prevT = prev.kickoffAt ? new Date(prev.kickoffAt).getTime() : null;
      const curT = macAniMs(m.date);
      if (prevT !== curT) diffs.push({ type: 'kickoff', matchId: prev.matchId, from: prev.kickoffAt, to: iso(m.date) });
    }
    if (diffs.length) {
      await store.appendAudit({
        bulletinId: id, action: 'rejected_identity_change', actor: 'refresh', rejected: true,
        reason: 'Bülten kilitli — resmî kaynaktaki kimlik farkı arşive uygulanmadı, yalnız loglandı.',
        newValue: { diffs },
      });
    }
  }
  return store.getBulletin(id);
}

// --------------------------------------------------------------------------
// GÖZLEM: kilide KADAR zaman serisi toplanır (oran/ihtimal/veri kalitesi).
// Resmî kaynak oynanma yüzdesi SUNMUYOR → playedPct null yazılır (uydurma yok).
// Kilitten sonra gözlem kaydı yapılmaz.
// --------------------------------------------------------------------------
export async function recordObservationsFromData(data, { store = getArchiveStore(), now = Date.now(), source = 'refresh' } = {}) {
  if (!data || data.pending || data.roundId == null) return 0;
  const id = bulletinIdOf(data.roundId);
  const b = await store.getBulletin(id);
  if (b && ['locked', 'completed', 'cancelled'].includes(b.status)) return 0; // kilit sonrası gözlem yok
  const freezeAt = b?.freezeAt || computeFreezeAt(data.matches);
  if (freezeAt && now >= new Date(freezeAt).getTime()) return 0;

  const rows = (data.matches || []).map((m) => ({
    matchId: String(m.sportotoMatchId ?? m.no),
    source,
    observedAt: new Date(now).toISOString(),
    playedPct: null, // resmî oynanma yüzdesi kaynağı yok — null ("veri yok")
    odds: m.preOdds ?? null,
    statsSummary: {
      probabilities: m.analysis?.probabilities ?? null,
      estimated: m.analysis?.estimated ?? null,
      surpriseScore: m.analysis?.surpriseScore ?? null,
      label: m.analysis?.label ?? null,
      prediction: m.prediction?.symbol ?? null,
      xg: m.stats?.home?.season?.xgFor != null || m.stats?.away?.season?.xgFor != null
        ? {
          home: { for: m.stats?.home?.season?.xgFor ?? null, against: m.stats?.home?.season?.xgAgainst ?? null },
          away: { for: m.stats?.away?.season?.xgFor ?? null, against: m.stats?.away?.season?.xgAgainst ?? null },
        }
        : null,
    },
    dataQuality: {
      matched: m.coverage ? !!m.coverage.ok : m.footyMatchId != null,
      reason: m.coverage?.reason ?? null,
      hasOdds: m.preOdds != null,
      hasStats: !!m.stats,
      hasProbabilities: !!m.analysis?.probabilities,
    },
  }));
  await store.addObservations(id, rows);
  return rows.length;
}

// --------------------------------------------------------------------------
// SNAPSHOT PAYLOAD — kilit anında GERÇEKTEN bilinenler. Veri yoksa null +
// "veri yok" notu; sahte değer üretilmez. Sonuç/ilk yarı alanı YOKTUR.
// --------------------------------------------------------------------------
function trimStats(stats) {
  if (!stats) return null;
  const trimTeam = (t) => {
    if (!t) return null;
    const { squad, ...rest } = t;
    return rest;
  };
  const { leagueTable, ...rest } = stats;
  return { ...rest, home: trimTeam(rest.home), away: trimTeam(rest.away) };
}

function dataConfidenceOf(m) {
  // Dürüstlük kuralı: eksik oyuncu + teknik direktör verisi HİÇ yok → asla "Yüksek".
  if (!m.stats || !m.analysis?.probabilities) return 'Düşük';
  return 'Orta';
}

// Radar 5 de bültenle birlikte mühürlenir. Böylece geçmiş haftada ekrandaki
// "Tüm / 5 / 10 / 15" dağılımları sonradan değişen arşivle yeniden hesaplanmaz.
// Öğrenme sınırı: bu bültenin kendisi ve kapanışından sonraki hiçbir sonuç girmez.
// RADAR 5 — YAKINLIK SÜZGECİ KIRILIMLARI DA MÜHÜRLENİR (16 Ağustos 2026).
//
// NEDEN: mühür eskiden SÜZGEÇSİZ tek değer taşıyordu. Bu yüzden geçmiş haftada
// "Birebir / ±3 / ±5 / ±10" ve maç penceresi seçimleri gösterilemiyordu —
// mühürde karşılıkları yoktu ve canlı hesaplamak mühürlü değeri yeniden
// üretmek olurdu. Kullanıcı geçmiş haftada bu seçimleri istedi; doğru çözüm
// süzgeci canlıya açmak değil, MÜHRE YAZMAKTIR: değer donduğu anda hesaplanır,
// sonradan asla değişmez.
//
// TEK TANIM: hesap uçtaki `hesaplaSiraDnasi` ile AYNI fonksiyondur. Dinamik
// import, statik döngüyü kırmak içindir (routes/radar.js bu modülden
// computeFreezeAt alıyor); iki modül de yüklendikten sonra çalışır.
//
// GEÇMİŞE DÖNÜK ÇALIŞMAZ: zaten mühürlenmiş haftaların kaydı değişmez, bu
// yüzden alan yalnız BUNDAN SONRA mühürlenen haftalarda dolar. İstemci alanın
// yokluğunu eski davranışla karşılar (süzgeç satırları çizilmez).
//
// BOYUT: 7 kombinasyon (oynanma 4 + oran 3) × ~11 KB ≈ 76 KB. Maç penceresi
// AYRI kombinasyon DEĞİLDİR: pencereler (allTime/last5/last10/last15) tek
// yanıtın `dna.positions[].windows` alanında birlikte gelir.
async function buildRadar5FiltreleriSnapshot(data, { store, roundId, freezeAt, hesapla } = {}) {
  const filtreler = {};
  if (!hesapla) return null;   // uç yüklenemedi → snapshot süzgeçsiz kalır
  const kombinasyonlar = [
    ...OYNANMA_TOLERANSLARI.map((tol) => ({ mod: 'oynanma', tol })),
    ...ORAN_TOLERANSLARI.map((tol) => ({ mod: 'oran', tol })),
  ];
  for (const filtre of kombinasyonlar) {
    try {
      const y = await hesapla({
        store, cur: data, cutRoundId: roundId, cutFreezeAt: freezeAt,
        guncelMi: true, filtre,
      });
      // Yalnız süzgece BAĞLI parçalar mühürlenir; combined/examples süzgeçten
      // bağımsızdır ve filtresiz kayıtta zaten var (mühür gereksiz şişmesin).
      filtreler[`${filtre.mod}:${filtre.tol}`] = { dna: y.dna, filtre: y.filtre };
    } catch {
      // Tek kombinasyon hesaplanamazsa diğerleri yazılır; eksik anahtar
      // istemcide "bu seçim mühürlü değil" demektir, uydurma değer üretilmez.
    }
  }
  return Object.keys(filtreler).length ? filtreler : null;
}

// MÜHÜR VE CANLI UÇ AYNI KAYNAK KÜMESİNİ KULLANIR (16 Ağustos 2026 düzeltmesi).
//
// BULUNAN HATA: burası Radar 5 DNA'sını YALNIZ statik geçmiş dosyasından
// (`getHistoryStore().listAllMatches()`) hesaplıyordu. Canlı uç ise buna
// ARŞİVDEKİ TAMAMLANMIŞ HAFTALARI da ekliyor (`archivePositionMatches`) ve
// `eskiHaftalariAt` kesimini uyguluyor. Yani aynı şeyin iki tanımı vardı.
//
// SONUCU ÖLÇÜLDÜ: 1528'in (1. Hafta) mühründeki `radar5.dna.totalMatches` 0
// çıktı; aynı kesimle canlı hesap 45 maç veriyor. Mühür, geçmiş arşiv içeri
// alınmadan önce atıldığı için Radar 5 kaydı boş mühürlendi ve o hafta için
// süzgeç kırılımı üretmek de anlamsız hâle geldi.
//
// Artık ikisi de `hesaplaSiraDnasi` kullanır. Filtresiz çağrı aynı zamanda
// süzgeçten bağımsız tabanı ısıtır; ardından gelen 7 kombinasyon ucuzdur.
async function buildRadar5Snapshot(data, { store } = {}) {
  const roundId = data.roundId;
  const freezeAt = computeFreezeAt(data.matches);
  const season = data.year ?? null;
  const bos = {
    methodologyVersion: null,
    season,
    cut: { roundId, freezeAt, historyMatches: 0 },
    periods: ['allTime', 'last5', 'last10', 'last15'],
    dna: null,
  };
  let hesapla;
  try {
    ({ hesaplaSiraDnasi: hesapla } = await import('../routes/radar.js'));
  } catch {
    return bos;   // uç yüklenemedi → snapshot yine oluşur, Radar 5 boş kalır
  }
  try {
    const filtresiz = await hesapla({
      store, cur: data, cutRoundId: roundId, cutFreezeAt: freezeAt,
      guncelMi: true, filtre: null,
    });
    return {
      methodologyVersion: filtresiz.dna?.methodologyVersion ?? null,
      season,
      // Kesim bilgisi de uçtan gelir: kaç statik geçmiş + kaç arşiv maçı
      // kullanıldığı mühürde görünür (sonradan doğrulanabilsin diye).
      cut: filtresiz.cut ?? { roundId, freezeAt, historyMatches: 0 },
      periods: ['allTime', 'last5', 'last10', 'last15'],
      dna: filtresiz.dna ?? null,
      filtreler: await buildRadar5FiltreleriSnapshot(data, {
        store, roundId, freezeAt, hesapla,
      }),
    };
  } catch {
    // Snapshot yine oluşur; Radar 5 verisi yoksa bunu dürüstçe belirtir.
    return bos;
  }
}

// ---------------------------------------------------------------------------
// OYNANMA HAREKETİ MÜHRÜ (played-movement-1.0.0)
// "Para favoriden kaçtı mı?" sinyalinin kalıcı, mühürlü kaydı. Gün-mühürleme
// kuralı DNA arşiviyle birebir aynıdır (sealDailyPct — iki ayrı tanım olamaz).
//
// SİNYAL TANIMI: kaynak-ortalaması AÇILIŞ dağılımının favorisi, kapanışa dek
// >= PUBLIC_MOVE_RULES.dropPts puan kaybettiyse signal.active=true. Favori
// AÇILIŞTAKİ favoridir — "para kimden kaçtı" sorusunun öznesi odur; kapanışta
// liderliği kaybetmiş olsa da ölçülen olgu değişmez. (Radar 3'ün canlı risk
// katkısı ise KAPANIŞ favorisine bakar; iki tanım bilinçli olarak farklıdır ve
// ikisi de kendi yerinde belgelidir.)
//
// DÜRÜSTLÜK: <2 gerçek mühürlü gün → hareket ÜRETİLMEZ (null + neden). Karne
// (scorecard) yalnız signal.active mühürlü maçları sayar; eski snapshot'larda
// bu alan yoktur ve n=0'dan başlar — geçmişe dönük sinyal üretilmez.
// ---------------------------------------------------------------------------
export const PLAYED_MOVEMENT_VERSION = 'played-movement-1.0.0';

export function buildPlayedMovement(observations, { freezeMs = null } = {}) {
  const yuvarla = (v) => Math.round(v * 10) / 10;
  const favoriOf = (p) => ['1', 'X', '2'].reduce((a, b) => (p[b] > p[a] ? b : a), '1');

  const gunluk = sealDailyPct({ observations: observations || [], freezeMs });
  const bySource = new Map();
  for (const g of gunluk) {
    if (!bySource.has(g.source)) bySource.set(g.source, []);
    bySource.get(g.source).push({ dayKey: g.dayKey, pct: g.pct });
  }

  const perSource = {};
  const hareketliler = [];
  for (const [source, days] of bySource) {
    const mv = movementOf(days);
    if (!mv) continue;                            // <2 gerçek gün → uydurma yok
    const fav = favoriOf(mv.openPct);
    const kayit = {
      openPct: mv.openPct, closePct: mv.closePct, delta: mv.delta,
      dayCount: mv.dayCount, fromDayKey: mv.fromDayKey, toDayKey: mv.toDayKey,
      favoriteSymbol: fav,
      favoriteDropPts: yuvarla(mv.openPct[fav] - mv.closePct[fav]),
    };
    perSource[source] = kayit;
    hareketliler.push(kayit);
  }

  if (!hareketliler.length) {
    return {
      version: PLAYED_MOVEMENT_VERSION,
      rules: { ...PUBLIC_MOVE_RULES },
      perSource: null, consensus: null, signal: null,
      note: 'Hareket için en az iki günlük mühürlü oynanma gözlemi gerekir — bu maçta yok.',
    };
  }

  // Kaynak ortalaması — Radar 3'ün publicMove hesabıyla aynı yöntem.
  const ort = (al) => yuvarla(hareketliler.reduce((s, h) => s + al(h), 0) / hareketliler.length);
  const openPct = { '1': ort((h) => h.openPct['1']), X: ort((h) => h.openPct.X), '2': ort((h) => h.openPct['2']) };
  const closePct = { '1': ort((h) => h.closePct['1']), X: ort((h) => h.closePct.X), '2': ort((h) => h.closePct['2']) };
  const favoriteSymbol = favoriOf(openPct);
  const dropPts = yuvarla(openPct[favoriteSymbol] - closePct[favoriteSymbol]);

  return {
    version: PLAYED_MOVEMENT_VERSION,
    rules: { ...PUBLIC_MOVE_RULES },
    perSource,
    consensus: { openPct, closePct, favoriteSymbol, favoriteDropPts: dropPts, sources: hareketliler.length },
    signal: {
      active: dropPts >= PUBLIC_MOVE_RULES.dropPts,
      favoriteSymbol,
      dropPts,
      definition: `Açılış favorisinin oynanması kapanışa dek ≥${PUBLIC_MOVE_RULES.dropPts} puan düştü`,
    },
  };
}

export async function buildSnapshotPayload(data, {
  store = getArchiveStore(), now = Date.now(), frozenAt, late = false,
} = {}) {
  if (!data || data.pending || data.roundId == null) {
    throw new ValidationError('Snapshot için teyitli bülten verisi gerekli.');
  }
  const id = bulletinIdOf(data.roundId);
  const freezeAt = computeFreezeAt(data.matches);
  const firstMs = firstKickoffMs(data.matches);

  // Kriterlerin kilit anında BİLİNEN geçmiş başarıları — yalnız DAHA ÖNCEKİ
  // bültenlerin değerlendirmelerinden (öğrenme sınırı / data leakage engeli).
  let criteriaPast = null;
  let radarPast = null;
  try {
    const perf = await getCriteriaPerformanceBefore(data.roundId, { store });
    criteriaPast = perf?.criteria && Object.keys(perf.criteria).length ? perf.criteria : null;
    radarPast = perf?.radarLabels && Object.keys(perf.radarLabels).length ? perf.radarLabels : null;
  } catch { criteriaPast = null; radarPast = null; }

  const radarByNo = new Map((data.radar || []).map((r) => [r.no, r]));
  // RADAR MERKEZİ (Radar 1-5 + Master + Sürpriz DNA) — refresh'te merkezî olarak
  // hesaplanan sonuç maç bazında MÜHÜRLENİR. Yoksa null (sahte üretim yok).
  const radarCenterByNo = new Map((data.radarCenter?.matches || []).map((r) => [r.no, r]));
  // MASTER ANALİZ MERKEZİ: 40 kriterin gölge değerlendirmesi (catalogEvaluations)
  // + resmî Master Analiz (officialMasterAnalysis) maç bazında MÜHÜRLENİR.
  const analysisCenterByNo = new Map((data.analysisCenter?.matches || []).map((r) => [r.no, r]));
  const obsCounts = new Map();
  // Oynanma hareketi mührü için maç başına TAM gözlem listesi de tutulur
  // (yalnız sayaç yetmez — açılış→kapanış hareketi gözlem serisinden hesaplanır).
  const obsListByMatch = new Map();
  try {
    const allObs = await store.listObservations(id);
    for (const o of allObs) {
      const k = String(o.matchId);
      const cur = obsCounts.get(k) || { count: 0, lastObservedAt: null };
      cur.count += 1;
      if (!cur.lastObservedAt || o.observedAt > cur.lastObservedAt) cur.lastObservedAt = o.observedAt;
      obsCounts.set(k, cur);
      if (!obsListByMatch.has(k)) obsListByMatch.set(k, []);
      obsListByMatch.get(k).push(o);
    }
  } catch { /* gözlem yoksa sayaçlar boş kalır */ }
  const freezeMsForSeal = freezeAt ? new Date(freezeAt).getTime() : null;

  const matches = (data.matches || [])
    .slice()
    .sort((a, b) => (a.no || 0) - (b.no || 0))
    .map((m) => {
      const analysis = m.analysis || null;
      const radar = radarByNo.get(m.no) || null;
      const criteriaSignals = evaluateCriteriaSignals(m.stats) || null;
      const matchKey = String(m.sportotoMatchId ?? m.no);
      const obs = obsCounts.get(matchKey) || { count: 0, lastObservedAt: null };
      return {
        no: m.no,
        matchId: matchKey,
        sportotoMatchId: m.sportotoMatchId ?? null,
        kickoffAt: iso(m.date),
        league: m.league || null,
        // Arma: önce maçın kendi kaynak eşleşmesi, yoksa arma kayıt defteri
        // (m.home.logo). Maç eşleşmese de kulüp arması biliniyorsa mühürlenir.
        home: { name: m.home?.name || '', mediumName: m.home?.mediumName || null, externalTeamId: m.home?.externalTeamId ?? null, logo: m.stats?.home?.logo || m.home?.logo || null },
        away: { name: m.away?.name || '', mediumName: m.away?.mediumName || null, externalTeamId: m.away?.externalTeamId ?? null, logo: m.stats?.away?.logo || m.away?.logo || null },
        externalIds: { footyMatchId: m.footyMatchId ?? null, footySeasonId: m.footySeasonId ?? null, footySwapped: m.footySwapped ?? null },
        market: {
          odds: m.preOdds ?? null,
          oddsSource: m.preOdds ? 'FootyStats (maç-öncesi)' : null,
          playedPercentages: null,                       // resmî kaynak sunmuyor
          playedPercentagesSource: null,
          playedPercentagesNote: 'Bu veri bulunamadı (resmî oynanma yüzdesi kaynağı yok).',
          probabilities: analysis?.probabilities ?? null,
          probabilitiesEstimated: analysis?.estimated ?? null,
        },
        observationSeries: {
          count: obs.count,
          lastObservedAt: obs.lastObservedAt,
          ref: `/api/bulletins/${id}/observations?matchId=${matchKey}`,
        },
        // OYNANMA HAREKETİ MÜHRÜ — kilit anındaki açılış→kapanış yüzde kayması.
        // Eskiden hareket yalnız istek anında hesaplanıyordu; mühürlenmediği
        // için "para favoriden kaçtı" sinyalinin karnesi HİÇ birikemiyordu.
        playedMovement: buildPlayedMovement(obsListByMatch.get(matchKey) || [], { freezeMs: freezeMsForSeal }),
        teamData: trimStats(m.stats),                    // form, puan durumu, iç/dış saha, xG, H2H (kilit anındaki hali)
        missingPlayers: null,                            // kaynak yok
        missingPlayersNote: 'Bu veri bulunamadı (eksik/cezalı oyuncu kaynağı yok).',
        managerChange: null,                             // kaynak yok
        managerChangeNote: 'Bu veri bulunamadı (teknik direktör değişikliği kaynağı yok).',
        dataQuality: {
          matched: m.coverage ? !!m.coverage.ok : m.footyMatchId != null,
          reason: m.coverage?.reason ?? null,
          hasOdds: m.preOdds != null,
          hasStats: !!m.stats,
          hasProbabilities: !!analysis?.probabilities,
          hasXg: m.stats?.home?.season?.xgFor != null && m.stats?.away?.season?.xgFor != null,
          score: [m.preOdds != null, !!m.stats, !!analysis?.probabilities].filter(Boolean).length,
        },
        criteria: {
          catalogVersion: CRITERIA_CATALOG_VERSION,
          signals: criteriaSignals,                      // { key: '1'|'X'|'2' } | null
          pastPerformance: criteriaPast,                 // kilit anında bilinen geçmiş başarı (önceki bültenlerden) | null
        },
        radarCenter: radarCenterByNo.has(m.no) ? {
          master: radarCenterByNo.get(m.no).master,
          radars: radarCenterByNo.get(m.no).radars,
        } : null,
        analysisCenter: analysisCenterByNo.has(m.no) ? {
          names: analysisCenterByNo.get(m.no).names ?? null,
          context: analysisCenterByNo.get(m.no).context ?? null,
          catalogEvaluations: analysisCenterByNo.get(m.no).catalogEvaluations ?? null,
          officialMasterAnalysis: analysisCenterByNo.get(m.no).officialMasterAnalysis ?? null,
        } : null,
        radar: radar ? {
          id: RADAR_ID, version: RADAR_VERSION,
          surpriseScore: radar.surpriseScore ?? null,
          label: radar.label ?? null,
          favorite: radar.favorite ?? null,
          probabilities: radar.probabilities ?? null,
          factors: radar.factors ?? null,
          predictionLabel: radar.predictionLabel ?? null,
          pastPerformance: radarPast,
        } : null,
        systemPrediction: m.prediction ? {
          symbol: m.prediction.symbol ?? null,
          display: displaySymbol(m.prediction.symbol),
          label: m.prediction.label ?? null,
          meaning: m.prediction.meaning ?? null,
          reason: m.prediction.reason ?? null,
          estimated: m.prediction.estimated ?? null,
        } : null,
        confidence: {
          favoritePercent: analysis?.favorite?.percent ?? null,
          surpriseScore: analysis?.surpriseScore ?? null,
          dataConfidence: dataConfidenceOf(m),           // eksik oyuncu/hoca verisi yok → en fazla "Orta"
        },
        analysisComment: analysis?.comment ?? null,
        aiComment: m.aiComment ?? null,
        tags: m.tags ?? null,
        info: m.info ?? null,                            // stadyum/şehir/hava (kilit anındaki)
      };
    });

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    engine: {
      name: 'sportoto-analiz',
      analysisEngineVersion: ANALYSIS_ENGINE_VERSION,
      criteriaCatalogVersion: CRITERIA_CATALOG_VERSION,
      radar: { id: RADAR_ID, version: RADAR_VERSION },
    },
    criteriaCatalog: Object.entries(CRITERIA_LABELS).map(([key, label]) => ({
      key, label, version: CRITERIA_CATALOG_VERSION, enabled: true,
      weight: null, weightNote: 'Backend kriter motoru ağırlıksızdır (eşit sinyal); ağırlık verisi yok.',
    })),
    bulletin: {
      id, roundId: data.roundId, season: data.year ?? null, week: data.round ?? null,
      closeDate: iso(data.closeDate), firstMatchStartAt: firstMs != null ? new Date(firstMs).toISOString() : null,
      freezeAt, officialSignature: data.verification?.signature ?? null,
      matchCount: (data.matches || []).length,
      coverage: data.coverage ?? null,
      difficulty: data.difficulty ?? null,
    },
    lock: {
      frozenAt: iso(frozenAt) || new Date(now).toISOString(),
      dataObservedAt: new Date(now).toISOString(),      // verinin GERÇEKTEN elde edildiği an
      late: !!late,                                     // freeze anı kaçırıldıysa açıkça işaretlenir
      note: late ? 'Sunucu freeze anında kapalıydı; snapshot yeniden açılışta, o anki en güncel maç-öncesi veriyle alındı (geriye dönük veri uydurulmadı).' : null,
    },
    // MASTER ANALİZ ÜST BİLGİSİ — katalog/metodoloji sürümü + resmî profil.
    // Metodoloji sonradan değişse bile bu bülten BU sürümlerle mühürlü kalır.
    analysisCenter: data.analysisCenter ? {
      methodologyVersion: data.analysisCenter.methodologyVersion ?? null,
      catalogVersion: data.analysisCenter.catalogVersion ?? null,
      officialProfile: data.analysisCenter.officialProfile ?? null,
      generatedAt: data.analysisCenter.generatedAt ?? null,
    } : null,
    // RADAR MERKEZİ ÜST BİLGİSİ — ağırlıklar, metodoloji sürümü, bülten özeti.
    // Kilit sonrası metodoloji değişse bile bu bülten BU sürümle mühürlü kalır.
    radarCenter: data.radarCenter ? {
      methodologyVersion: data.radarCenter.methodologyVersion ?? null,
      baseWeights: data.radarCenter.baseWeights ?? null,
      generatedAt: data.radarCenter.generatedAt ?? null,
      summary: data.radarCenter.summary ?? null,
      memory: data.radarCenter.memory ?? null,
    } : null,
    // Radar 5 sıra hafızası: kilit anında yalnız önceki tamamlanmış haftalardan
    // üretilen dört görünümün değişmez kaydı.
    radar5: await buildRadar5Snapshot(data, { store }),
    matches,
    generatedAt: new Date(now).toISOString(),
  };
  return payload;
}

// --------------------------------------------------------------------------
// FREEZE — idempotent + eşzamanlılık güvenli resmî kilitleme.
// Aynı bülten için ikinci çağrı yeni snapshot ÜRETMEZ (AlreadyExists → mevcut döner).
// --------------------------------------------------------------------------
export async function freezeBulletinFromData(data, {
  store = getArchiveStore(), now = Date.now(), trigger = 'worker', force = false,
} = {}) {
  if (!data || data.pending || data.roundId == null) {
    throw new ValidationError('Kilitlenecek teyitli bülten verisi yok.');
  }
  const id = bulletinIdOf(data.roundId);
  const freezeAt = computeFreezeAt(data.matches);
  if (!freezeAt) throw new ValidationError(`freezeAt hesaplanamadı (maç saati yok) — bülten ${id}.`);
  const freezeMs = new Date(freezeAt).getTime();
  if (!force && now < freezeMs) {
    return { frozen: false, reason: 'not_due', freezeAt, bulletinId: id };
  }

  return store.withLock(id, async () => {
    const existing = await store.getSnapshot(id);
    if (existing) {
      return { frozen: false, alreadyFrozen: true, bulletinId: id, snapshot: existing };
    }

    // Bülten kaydı güncel olsun (henüz kilitli değilken kimlikler yazılır).
    await registerBulletinFromData(data, { store, now });

    // GEÇ MÜHÜR TANIMI DEĞİŞTİ (2026-08-08).
    //
    // ESKİ: planlanan mühür anından 2 dakika sonrası "geç" sayılıyordu. Bu
    // suni bir uçurumdu: mühür 16:55 yerine 16:58'de atılsa bile maç 17:00'da
    // başlıyorsa tahmin HÂLÂ maç öncesidir ve ileri-testtir. 2 dakikalık
    // gecikme yüzünden bütün haftayı çöpe atmak, ölçümü korumuyor; sadece
    // veriyi yok ediyordu.
    //
    // YENİ: geç = İLK MAÇ BAŞLADIKTAN SONRA mühürlendi. Dürüstlüğü sağlayan
    // gerçek sınır budur — maç başladıktan sonra üretilen kayıt ileri-test
    // sayılamaz. Maç öncesinde atılan her mühür geçerlidir.
    //
    // Not: provenance kapısı zaten `locked_after_first_match` ve
    // `prediction_after_first_match` denetimlerini ayrıca yapar; bu bayrak
    // onlarla çelişmez, aynı çizgiyi kullanır.
    const ilkMac = firstKickoffMs(data.matches);
    const late = Number.isFinite(ilkMac)
      ? now > ilkMac
      : now - freezeMs > LATE_THRESHOLD_MS;   // maç saati bilinmiyorsa eski kural
    const payload = await buildSnapshotPayload(data, { store, now, frozenAt: new Date(now).toISOString(), late });
    const payloadHash = hashPayload(payload);
    const lockedAtIso = new Date(now).toISOString();

    let snapshot;
    try {
      snapshot = await store.createSnapshot({
        id: `snap-${id}`, bulletinId: id,
        schemaVersion: SCHEMA_VERSION, engineVersion: ANALYSIS_ENGINE_VERSION,
        sourceVersions: {
          sportotoSignature: data.verification?.signature ?? null,
          footyStatsSeasonIds: payload.matches.some((m) => m.externalIds.footySeasonId != null)
            ? [...new Set(payload.matches.map((m) => m.externalIds.footySeasonId).filter((x) => x != null))] : null,
          radar: `${RADAR_ID}@${RADAR_VERSION}`,
          criteria: CRITERIA_CATALOG_VERSION,
        },
        createdAt: lockedAtIso, lockedAt: lockedAtIso, dataObservedAt: lockedAtIso,
        late, immutable: true, payload, payloadHash, hashAlgo: HASH_ALGO,
      });
    } catch (e) {
      if (e instanceof AlreadyExistsError) {
        // Yarış: başka bir işlem az önce kilitledi → mevcut resmî snapshot esas.
        const snap = await store.getSnapshot(id);
        return { frozen: false, alreadyFrozen: true, bulletinId: id, snapshot: snap };
      }
      throw e;
    }

    await store.upsertBulletin({ id, roundId: data.roundId, status: 'locked', lockedAt: lockedAtIso });
    // Kullanıcıların kayıtlı analizleri de bu anda DONAR (değiştirilemez).
    try {
      const { getAnalysisStore } = await import('../analysis/analysisStore.js');
      const lockedCount = await getAnalysisStore().lockUserAnalyses(id, lockedAtIso);
      if (lockedCount) console.log(`[arsiv] 🔒 ${lockedCount} kullanıcı analizi kilitlendi (bülten ${id}).`);
    } catch (e) { console.warn('[arsiv] kullanıcı analizleri kilitlenemedi:', e.message); }
    await store.appendAudit({
      bulletinId: id, action: 'freeze', actor: trigger,
      newValue: { snapshotId: snapshot.id, payloadHash, freezeAt, lockedAt: lockedAtIso, late },
      reason: late ? 'Geç kilit: sunucu freeze anında çalışmıyordu.' : null,
    });
    console.log(`[arsiv] 🔒 bülten ${id} kilitlendi (hash ${payloadHash.slice(0, 10)}…${late ? ' · geç' : ''})`);

    // EV GÖLGE KAYDI (T10) — kilit anı bir daha gelmez. Kalabalığın kapanış
    // dağılımı ŞİMDİ kaydedilmezse sonsuza kadar kaybolur (sağlayıcılar geçmişe
    // dönük yüzde vermez). Kullanıcıya HİÇBİR ŞEY gösterilmez.
    // Hata kilidi ASLA bozmaz: mühür işlemi kritik, gölge kayıt değil.
    try {
      const { runWeeklyShadow } = await import('../ev/weekly.js');
      const r = await runWeeklyShadow({ bulletinId: id, store, now });
      console.log(r.ran
        ? `[ev-golge] ${id} kaydedildi (birim: ${r.unit}, λ=${r.lambda})`
        : `[ev-golge] ${id} kayıt yok: ${r.reason}${r.note ? ` — ${r.note}` : ''}`);
    } catch (e) { console.warn('[ev-golge] kayıt başarısız:', e.message); }

    return { frozen: true, bulletinId: id, snapshot };
  });
}

// --------------------------------------------------------------------------
// DURUM — /api/bulletin yanıtına eklenen kompakt arşiv durumu.
// --------------------------------------------------------------------------
export async function getArchiveStatus(roundId, { store = getArchiveStore() } = {}) {
  if (roundId == null) return null;
  const id = bulletinIdOf(roundId);
  const [b, snap] = await Promise.all([store.getBulletin(id), store.getSnapshot(id)]);
  if (!b && !snap) return null;
  const dataGaps = [];
  if (snap?.payload?.matches) {
    for (const m of snap.payload.matches) {
      if (!m.dataQuality?.matched) dataGaps.push({ no: m.no, reason: m.dataQuality?.reason || 'Veri eşleşmedi' });
    }
  }
  return {
    bulletinId: id,
    status: b?.status ?? (snap ? 'locked' : null),
    freezeAt: b?.freezeAt ?? null,
    lockedAt: snap?.lockedAt ?? b?.lockedAt ?? null,
    completedAt: b?.completedAt ?? null,
    immutable: !!snap,
    snapshot: snap ? {
      exists: true, id: snap.id, lockedAt: snap.lockedAt, late: !!snap.late,
      schemaVersion: snap.schemaVersion, verificationHash: snap.payloadHash,
      shortHash: snap.payloadHash ? snap.payloadHash.slice(0, 10) : null,
    } : { exists: false },
    dataGaps: dataGaps.length ? dataGaps : null,
  };
}
