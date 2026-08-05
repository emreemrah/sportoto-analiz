// MASTER ANALİZ SERVİSİ — merkezî gölge değerlendirme, resmî Master Analiz,
// kriter karnesi (yalnız mühürlü + resmî sonuç), Zaman Makinesi (backtest).
import { randomUUID } from 'node:crypto';
import { getArchiveStore } from '../archive/store.js';
import { recordFromArchive, classifyRecord } from '../scorecards/provenance.js';
import { CATALOG, CATALOG_MAP, CATALOG_VERSION, evaluateFullCatalog, evaluateCriterion, opponentTierOf } from './criterionCatalog.js';
import { computeMasterAnalysis, buildMasterSummary } from './masterEngine.js';
import { OPP_THRESHOLDS } from './opponentStrength.js';   // ALTIN KURAL eşiği (tek kaynak: ≥10 puan)
import {
  ANALYSIS_METHODOLOGY_VERSION, OFFICIAL_PROFILE, DEFAULT_FILTERS,
  sampleClass, shrunkRate, RELIABILITY, OPPONENT_TIERS,
} from './analysisConfig.js';

const iso = (v) => (v == null ? null : new Date(v).toISOString());

// RESMÎ SİSTEM PROFİLİ — sürümlü; tüm katalog varsayılan etkilerle açık.
export function buildOfficialProfile() {
  const criteria = {};
  for (const c of CATALOG) criteria[c.key] = { on: true, impact: c.defaultImpact };
  return {
    id: OFFICIAL_PROFILE.id, name: OFFICIAL_PROFILE.name, version: OFFICIAL_PROFILE.version,
    mode: OFFICIAL_PROFILE.mode, globalFilters: { ...OFFICIAL_PROFILE.globalFilters }, criteria,
  };
}

// ---------------------------------------------------------------------------
// MERKEZÎ HESAP — bültenin 15 maçı için:
//  A) catalogEvaluations: 40 kriterin GÖLGE değerlendirmesi (veri yok dahil)
//  B) officialMasterAnalysis: resmî profil ile Master Analiz
// Kullanıcı analizine sızmaz; kullanıcı hesabı YALNIZ açık kriterlerini kullanır.
// ---------------------------------------------------------------------------
export function computeAnalysisCenterForData(data, { now = Date.now() } = {}) {
  if (!data || data.pending || data.roundId == null) return null;
  const observedAt = new Date(now).toISOString();
  const official = buildOfficialProfile();

  const matches = (data.matches || [])
    .slice()
    .sort((x, y) => (x.no || 0) - (y.no || 0))
    .map((m) => {
      const catalogEvaluations = evaluateFullCatalog(m, { observedAt });
      const names = { home: m.home?.mediumName || m.home?.name || 'Ev sahibi', away: m.away?.mediumName || m.away?.name || 'Deplasman' };
      const officialMasterAnalysis = computeMasterAnalysis({
        matchInfo: { no: m.no, ...names },
        catalogEvaluations,
        profile: official,
        freezeStatus: 'live',
        calculatedAt: observedAt,
      });
      officialMasterAnalysis.summary = buildMasterSummary(officialMasterAnalysis, { names });
      // Karne bağlamı (rakip gücü kırılımı için) — kilit anındaki sıralar +
      // ALTIN KURAL girdileri: puan/maç ve oynanan maç (sınıf = gerçek puan
      // farkı ≥ 10; sıra üçte-birleri artık kullanılmıyor).
      const teamCount = m.stats?.leagueTable?.overall?.length ?? null;
      const ppgOf = (st) => {
        const played = Number(st?.played);
        const ppg = Number(st?.ppg);
        return Number.isFinite(ppg) && Number.isFinite(played) && played >= 3 ? { ppg, played } : null;
      };
      const homeStr = ppgOf(m.stats?.home?.standing), awayStr = ppgOf(m.stats?.away?.standing);
      return {
        no: m.no,
        matchId: String(m.sportotoMatchId ?? m.no),
        names,
        league: m.league || null,
        context: {
          homePosition: m.stats?.home?.standing?.position ?? null,
          awayPosition: m.stats?.away?.standing?.position ?? null,
          teamCount,
          homePpg: homeStr?.ppg ?? null, homePlayed: homeStr?.played ?? null,
          awayPpg: awayStr?.ppg ?? null, awayPlayed: awayStr?.played ?? null,
        },
        catalogEvaluations,
        officialMasterAnalysis,
      };
    });

  return {
    methodologyVersion: ANALYSIS_METHODOLOGY_VERSION,
    catalogVersion: CATALOG_VERSION,
    officialProfile: { id: official.id, name: official.name, version: official.version, mode: official.mode },
    generatedAt: observedAt,
    roundId: data.roundId,
    matches,
  };
}

// Kilitliyse önceki merkezî sonucu AYNEN koru (yeniden hesap yok).
export async function prepareAnalysisCenter(data, { previous = null, isLocked = false, store = getArchiveStore(), now = Date.now() } = {}) {
  if (!data || data.pending || data.roundId == null) return null;
  if (isLocked && previous?.analysisCenter && previous.roundId === data.roundId) return previous.analysisCenter;
  try {
    const snap = await store.getSnapshot(String(data.roundId));
    if (snap?.payload?.analysisCenter?.matches?.length) {
      return { ...snap.payload.analysisCenter, matches: snap.payload.matches.map((pm) => pm.analysisCenter ? { no: pm.no, matchId: pm.matchId, ...pm.analysisCenter } : null).filter(Boolean), sealed: true };
    }
  } catch { /* canlı hesap */ }
  return computeAnalysisCenterForData(data, { now });
}

// ---------------------------------------------------------------------------
// KRİTER KARNESİ — YALNIZ mühürlü catalogEvaluations × resmî 90 dk 1/X/2.
// Maç bittikten sonra kriter YENİDEN çalıştırılmaz (geçmişe sinyal üretilmez).
// upToRoundId verilirse yalnız o round'dan ÖNCEKİ haftalar sayılır (öğrenme sınırı).
// ---------------------------------------------------------------------------
function newCritRow(key) {
  const c = CATALOG_MAP[key];
  return {
    key, label: c?.label || key, version: c?.version || null,
    signalFamily: c?.signalFamily || null,
    // 'informational' çıktılı kriterler + karneden açıkça hariç tutulanlar
    // (ör. sabit homeAdvantage) doğruluk ölçümüne GİRMEZ.
    informational: c?.outputDirection === 'informational' || c?.excludeFromScorecard === true,
    evaluated: 0, signals: 0, noData: 0, hits: 0, misses: 0,
    byDirection: { '1': { total: 0, hits: 0 }, X: { total: 0, hits: 0 }, '2': { total: 0, hits: 0 } },
    byOpponentTier: { strong: { total: 0, hits: 0 }, mid: { total: 0, hits: 0 }, weak: { total: 0, hits: 0 } },
    byLeague: {},
    recent: [],        // [{roundId, hits, total}] — pencereler + trend için
  };
}

// Uygunluk kapısı: scorecards/provenance.js (Sistem/Radar/Kriter aynı kuralı kullanır).
export async function buildCriterionScorecard({ store = getArchiveStore(), upToRoundId = null } = {}) {
  const bulletins = (await store.listBulletins())
    .filter((b) => upToRoundId == null || Number(b.roundId) < Number(upToRoundId))
    .sort((x, y) => y.roundId - x.roundId);

  const rows = new Map();
  let roundsCounted = 0;
  let matchesCounted = 0; // resmî sonucu olan, karneye gerçekten giren maç sayısı
  const excludedByType = {};                                   // provenance şeffaflığı
  let excludedCount = 0;

  for (const b of bulletins) {
    const snap = await store.getSnapshot(b.id).catch(() => null);
    if (!snap?.payload?.matches?.some((m) => m.analysisCenter?.catalogEvaluations?.length)) continue;
    // RESMÎ İLERİ-TEST KAPISI (default-deny): backfilled/demo/retrospektif/geç
    // kilitli veya kanıtı eksik snapshot KRİTER karnesine GİRMEZ.
    const provCls = classifyRecord(recordFromArchive(b, snap), { requireOfficialProfile: false });
    if (!provCls.isOfficialForward) {
      excludedCount += 1;
      excludedByType[provCls.provenanceType] = (excludedByType[provCls.provenanceType] || 0) + 1;
      continue;
    }
    const results = await store.listOfficialResults(b.id).catch(() => []);
    if (!results.length) continue;
    const resBy = new Map(results.map((r) => [String(r.matchId), r.officialResult]));

    const perRound = new Map(); // key → {hits,total}
    let used = false;
    for (const pm of snap.payload.matches) {
      const ac = pm.analysisCenter;
      if (!ac?.catalogEvaluations) continue;
      const official = resBy.get(String(pm.matchId));
      if (!official) continue;                                   // resmî sonuç yoksa sayılmaz
      used = true;
      matchesCounted += 1;
      const ctx = ac.context || {};
      for (const ev of ac.catalogEvaluations) {
        if (!rows.has(ev.key)) rows.set(ev.key, newCritRow(ev.key));
        const row = rows.get(ev.key);
        row.evaluated += 1;
        if (!ev.available) { row.noData += 1; continue; }
        if (row.informational || !ev.signal) continue;           // bilgi kriteri: doğruluk ölçülmez
        row.signals += 1;
        // ADALET: '1' sinyali yalnız sonuç 1 ise doğru; X yalnız X; 2 yalnız 2.
        const hit = ev.signal === official;
        if (hit) row.hits += 1; else row.misses += 1;
        const d = row.byDirection[ev.signal];
        if (d) { d.total += 1; if (hit) d.hits += 1; }
        // Rakip gücü kırılımı — ALTIN KURAL (tek tanım): sınıf, GERÇEK PUAN
        // FARKIYLA belirlenir (fark ≥ 10 puan → güçlü/zayıf, altı denk; puan
        // farkı = ppg farkı × ortalama oynanan maç). ppg bağlamı olmayan ESKİ
        // mühürlü haftalarda sıra-üçte-birleri yedeği kullanılır (mühürlü veri
        // yeniden yazılMAZ; yedek dürüst bir yaklaşımdır).
        const tc = ctx.teamCount;
        const sideIsHome = ev.signal === '1';
        const oppPpg = sideIsHome ? ctx.awayPpg : ev.signal === '2' ? ctx.homePpg : null;
        const ownPpg = sideIsHome ? ctx.homePpg : ev.signal === '2' ? ctx.awayPpg : null;
        const oppPlayed = sideIsHome ? ctx.awayPlayed : ctx.homePlayed;
        const ownPlayed = sideIsHome ? ctx.homePlayed : ctx.awayPlayed;
        let tier = null;
        if (oppPpg != null && ownPpg != null) {
          const gap = (oppPpg - ownPpg) * (((ownPlayed || 0) + (oppPlayed || 0)) / 2);
          tier = gap >= OPP_THRESHOLDS.classPointsGap ? 'strong'
            : gap <= -OPP_THRESHOLDS.classPointsGap ? 'weak' : 'mid';
        } else {
          const oppPos = ev.signal === '1' ? ctx.awayPosition : ev.signal === '2' ? ctx.homePosition : null;
          if (tc && oppPos) {
            const rel = oppPos / tc;
            tier = rel <= OPPONENT_TIERS.strongMaxPct ? 'strong' : rel <= OPPONENT_TIERS.midMaxPct ? 'mid' : 'weak';
          }
        }
        if (tier) {
          row.byOpponentTier[tier].total += 1;
          if (hit) row.byOpponentTier[tier].hits += 1;
        }
        const lg = pm.league || 'Diğer';
        if (!row.byLeague[lg]) row.byLeague[lg] = { total: 0, hits: 0 };
        row.byLeague[lg].total += 1;
        if (hit) row.byLeague[lg].hits += 1;
        if (!perRound.has(ev.key)) perRound.set(ev.key, { hits: 0, total: 0 });
        const pr = perRound.get(ev.key);
        pr.total += 1; if (hit) pr.hits += 1;
      }
    }
    if (used) {
      roundsCounted += 1;
      for (const [key, pr] of perRound.entries()) rows.get(key).recent.push({ roundId: b.roundId, ...pr });
    }
  }

  const rate = (h, t) => (t ? Math.round((h / t) * 100) : null);
  const windowOf = (recent, n) => {
    const w = recent.slice(0, n).reduce((s, r) => ({ hits: s.hits + r.hits, total: s.total + r.total }), { hits: 0, total: 0 });
    return { ...w, rate: rate(w.hits, w.total) };
  };

  const criteria = [...rows.values()].map((row) => {
    const last1 = windowOf(row.recent, 1);   // son hafta (kullanıcı isteği, 2026-08-06)
    const last5 = windowOf(row.recent, 5);
    const last10 = windowOf(row.recent, 10);
    const last15 = windowOf(row.recent, 15); // son 15 hafta (kullanıcı isteği)
    const last25 = windowOf(row.recent, 25);
    const accuracy = rate(row.hits, row.signals);
    const shrunk = row.signals ? shrunkRate(row.hits, row.signals) : null;
    let trend = 'flat';
    if (last10.total >= 8 && accuracy != null && last10.rate != null) {
      if (last10.rate - accuracy >= 7) trend = 'rising';
      else if (accuracy - last10.rate >= 7) trend = 'falling';
    }
    const dir = (k) => {
      const d = row.byDirection[k];
      return { total: d.total, hits: d.hits, rate: rate(d.hits, d.total), shrunkRate: d.total ? shrunkRate(d.hits, d.total, RELIABILITY.baselineByDirection[k]) : null };
    };
    return {
      key: row.key, label: row.label, version: row.version, signalFamily: row.signalFamily,
      informational: row.informational,
      evaluated: row.evaluated, signals: row.signals, noData: row.noData,
      coverage: row.evaluated ? Math.round((row.signals / row.evaluated) * 100) : null,
      hits: row.hits, misses: row.misses,
      accuracy, shrunkAccuracy: shrunk,
      sample: sampleClass(row.signals),
      byDirection: { '1': dir('1'), X: dir('X'), '2': dir('2') },
      byOpponentTier: Object.fromEntries(Object.entries(row.byOpponentTier).map(([k, v]) => [k, { ...v, rate: rate(v.hits, v.total) }])),
      byLeague: Object.entries(row.byLeague).map(([league, v]) => ({ league, ...v, rate: rate(v.hits, v.total) })).sort((x, y) => y.total - x.total).slice(0, 8),
      windows: { last1, last5, last10, last15, last25, allTime: { hits: row.hits, total: row.signals, rate: accuracy } },
      trend,
      methodologyVersion: ANALYSIS_METHODOLOGY_VERSION,
    };
  }).sort((x, y) => (y.signals - x.signals));

  return {
    generatedAt: new Date().toISOString(),
    source: 'Mühürlü official_forward kriter değerlendirmeleri × resmî Spor Toto 90 dk sonuçları',
    hasData: criteria.some((c) => c.signals > 0),
    hasOfficialForwardData: roundsCounted > 0,
    isDemo: false,
    isOfficialForward: true,
    provenanceType: 'official_forward',
    includedCount: roundsCounted,
    excludedCount,
    exclusionBreakdown: excludedByType,
    roundsCounted,
    matchesCounted,
    upToRoundId: upToRoundId ?? null,
    catalogVersion: CATALOG_VERSION,
    note: roundsCounted === 0
      ? 'Henüz resmî kriter ileri-test verisi yok — rozetler gerçek bültenler mühürlenip sonuçlandıkça dolacaktır. Backfill/demo/retrospektif kayıtlar rozetlere girmez.'
      : (criteria.every((c) => c.signals < 30) ? 'Örneklemler küçük — oranlar n değeriyle birlikte okunmalıdır.' : null),
    criteria,
  };
}

// Akıllı mod için karne indeksi (öğrenme sınırı: upToRoundId zorunlu mantık).
export async function scorecardIndexBefore(roundId, { store = getArchiveStore() } = {}) {
  const sc = await buildCriterionScorecard({ store, upToRoundId: roundId });
  return Object.fromEntries(sc.criteria.map((c) => [c.key, c]));
}

// ---------------------------------------------------------------------------
// PROFİLLE ANALİZ — canlı bülten VEYA mühürlü snapshot verisi üzerinde.
// Geçmiş (mühürlü) haftada kriterler güncel veriyle YENİDEN HESAPLANMAZ;
// mühürlü catalogEvaluations kullanılır.
// ---------------------------------------------------------------------------
export async function calculateWithProfile({
  bulletinData = null, sealedSnapshot = null, matchNo = null, profile, store = getArchiveStore(), now = Date.now(),
}) {
  const observedAt = new Date(now).toISOString();
  let matchesSrc = [];
  let freezeStatus = 'live';
  let roundId = null;

  if (sealedSnapshot?.payload?.matches?.length) {
    freezeStatus = 'sealed';
    roundId = Number(sealedSnapshot.bulletinId);
    matchesSrc = sealedSnapshot.payload.matches
      .filter((pm) => pm.analysisCenter?.catalogEvaluations)
      .map((pm) => ({
        no: pm.no, matchId: pm.matchId,
        names: pm.analysisCenter.names || { home: pm.home?.mediumName || pm.home?.name, away: pm.away?.mediumName || pm.away?.name },
        catalogEvaluations: pm.analysisCenter.catalogEvaluations,
        radarMaster: pm.radarCenter?.master || null,
      }));
  } else if (bulletinData) {
    roundId = bulletinData.roundId;
    const center = bulletinData.analysisCenter || computeAnalysisCenterForData(bulletinData, { now });
    matchesSrc = (center?.matches || []).map((cm) => ({
      no: cm.no, matchId: cm.matchId, names: cm.names,
      catalogEvaluations: cm.catalogEvaluations,
      radarMaster: bulletinData.radarCenter?.matches?.find((r) => r.no === cm.no)?.master || null,
    }));
  }
  if (matchNo != null) matchesSrc = matchesSrc.filter((mm) => String(mm.no) === String(matchNo) || String(mm.matchId) === String(matchNo));

  // Akıllı mod: kriter karnesi YALNIZ önceki haftalardan (data leakage engeli).
  let scorecardByKey = null;
  if (profile?.mode === 'smart' && roundId != null) {
    try { scorecardByKey = await scorecardIndexBefore(roundId, { store }); } catch { scorecardByKey = null; }
  }

  const out = matchesSrc.map((mm) => {
    const master = computeMasterAnalysis({
      matchInfo: { no: mm.no, ...mm.names },
      catalogEvaluations: mm.catalogEvaluations,
      profile, scorecardByKey, freezeStatus, calculatedAt: observedAt,
    });
    master.summary = buildMasterSummary(master, { radarMaster: mm.radarMaster, names: mm.names });
    return { no: mm.no, matchId: mm.matchId, names: mm.names, master, radarMaster: mm.radarMaster ? { classification: mm.radarMaster.classification, mainPrediction: mm.radarMaster.mainPrediction, favoriteFailureRisk: mm.radarMaster.favoriteFailureRisk } : null };
  });

  return { roundId, freezeStatus, profile: { id: profile?.id ?? null, name: profile?.name ?? null, version: profile?.version ?? null, mode: profile?.mode || 'manual' }, calculatedAt: observedAt, matches: out };
}

// ---------------------------------------------------------------------------
// ZAMAN MAKİNESİ / BACKTEST — RETROSPEKTİF; resmî başarıya ASLA eklenmez.
// Mühürlü ham catalogEvaluations üzerinde bugünkü profil/kriter denenir.
// ---------------------------------------------------------------------------
export async function runBacktest({ criteriaKeys = null, profile = null, fromRound = null, toRound = null, store = getArchiveStore() } = {}) {
  const runId = `bt-${randomUUID().slice(0, 10)}`;
  const requestedAt = new Date().toISOString();
  const useProfile = profile || (() => {
    const p = buildOfficialProfile();
    if (criteriaKeys?.length) {
      for (const k of Object.keys(p.criteria)) p.criteria[k].on = criteriaKeys.includes(k);
      p.name = `Backtest (${criteriaKeys.length} kriter)`;
    }
    return p;
  })();

  const bulletins = (await store.listBulletins())
    .filter((b) => (fromRound == null || b.roundId >= Number(fromRound)) && (toRound == null || b.roundId <= Number(toRound)))
    .sort((x, y) => x.roundId - y.roundId);

  let eligibleMatches = 0, noDataMatches = 0;
  const acc = { '1': { total: 0, hits: 0 }, X: { total: 0, hits: 0 }, '2': { total: 0, hits: 0 } };
  let mainTotal = 0, mainHits = 0;
  const byLeague = new Map();
  const perCriterion = new Map();
  const roundsUsed = [];

  for (const b of bulletins) {
    const snap = await store.getSnapshot(b.id).catch(() => null);
    if (!snap?.payload?.matches?.some((m) => m.analysisCenter)) continue;
    const results = await store.listOfficialResults(b.id).catch(() => []);
    if (!results.length) continue;
    const resBy = new Map(results.map((r) => [String(r.matchId), r.officialResult]));
    let used = false;

    for (const pm of snap.payload.matches) {
      const ac = pm.analysisCenter;
      const official = resBy.get(String(pm.matchId));
      if (!ac?.catalogEvaluations || !official) continue;
      used = true;
      const master = computeMasterAnalysis({ catalogEvaluations: ac.catalogEvaluations, profile: useProfile, freezeStatus: 'sealed' });
      if (!master.ok || !master.mainPrediction) { noDataMatches += 1; continue; }
      eligibleMatches += 1;
      mainTotal += 1;
      const hit = master.mainPrediction === official;
      if (hit) mainHits += 1;
      acc[master.mainPrediction].total += 1;
      if (hit) acc[master.mainPrediction].hits += 1;
      const lg = pm.league || 'Diğer';
      if (!byLeague.has(lg)) byLeague.set(lg, { total: 0, hits: 0 });
      const l = byLeague.get(lg); l.total += 1; if (hit) l.hits += 1;
      for (const ev of ac.catalogEvaluations) {
        if (!useProfile.criteria[ev.key]?.on || !ev.signal || CATALOG_MAP[ev.key]?.outputDirection === 'informational') continue;
        if (!perCriterion.has(ev.key)) perCriterion.set(ev.key, { total: 0, hits: 0 });
        const pc = perCriterion.get(ev.key); pc.total += 1; if (ev.signal === official) pc.hits += 1;
      }
    }
    if (used) roundsUsed.push(b.roundId);
  }

  const rate = (h, t) => (t ? Math.round((h / t) * 100) : null);
  const run = {
    runId, requestedAt, status: 'completed',
    retrospective: true,
    label: 'RESMÎ OLMAYAN RETROSPEKTİF TEST — sonradan denenen yöntem, geçmiş kilitli ham veri üzerinde çalıştırıldı; resmî başarıya EKLENMEZ.',
    params: {
      criteriaKeys: criteriaKeys || null,
      profile: { name: useProfile.name, version: useProfile.version ?? null, mode: useProfile.mode },
      fromRound: fromRound != null ? Number(fromRound) : null,
      toRound: toRound != null ? Number(toRound) : null,
      catalogVersion: CATALOG_VERSION,
    },
    roundRange: roundsUsed.length ? { from: Math.min(...roundsUsed), to: Math.max(...roundsUsed), rounds: roundsUsed.length } : null,
    eligibleMatches, noDataMatches,
    mainAccuracy: { total: mainTotal, hits: mainHits, rate: rate(mainHits, mainTotal) },
    byDirection: Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, { ...v, rate: rate(v.hits, v.total) }])),
    coverage: eligibleMatches + noDataMatches ? Math.round((eligibleMatches / (eligibleMatches + noDataMatches)) * 100) : null,
    byLeague: [...byLeague.entries()].map(([league, v]) => ({ league, ...v, rate: rate(v.hits, v.total) })),
    perCriterion: [...perCriterion.entries()].map(([key, v]) => ({ key, label: CATALOG_MAP[key]?.label || key, ...v, rate: rate(v.hits, v.total), sample: sampleClass(v.total) })),
    sampleWarning: mainTotal < 30 ? `Örneklem küçük (n=${mainTotal}) — sonuçlar istatistiksel olarak oturmadı.` : null,
  };
  return run;
}
