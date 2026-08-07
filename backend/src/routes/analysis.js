// MASTER ANALİZ API'Sİ — /api/analysis/*
// Katalog + karne + profiller + hesap + kullanıcı analizi + backtest.
// Tüm uçlar salt okurdur; kullanıcıya bağlı profil/analiz kaydı YOKTUR
// (kriter seçme sistemi 2026-08-07'de kaldırıldı).
// Girişsiz kullanım: hesap uçları 401 döner; uygulama yerel profille çalışmaya
// devam eder (calculate uçları profili istek gövdesinde kabul eder).
import { Router } from 'express';
import { load } from '../cache.js';
import { getArchiveStore } from '../archive/store.js';
import { ImmutableError, NotFoundError, ValidationError } from '../archive/errors.js';
import { CATALOG, CATALOG_MAP, CATALOG_VERSION, ANALYSIS_CATEGORIES } from '../analysis/criterionCatalog.js';
import {
  buildCriterionScorecard, calculateWithProfile, buildOfficialProfile, runBacktest,
} from '../analysis/analysisService.js';
import { kriterKirilimi } from '../analysis/kriterKirilim.js';
import { sinyalKayitlariniTopla } from '../analysis/sinyalToplama.js';
import {
  getAnalysisStore,
} from '../analysis/analysisStore.js';
import {
  ANALYSIS_METHODOLOGY_VERSION, IMPACT_LABELS, IMPACT_ORDER, ANALYSIS_FAMILIES,
  ANALYSIS_FAMILY_DECAY, DECISION_RULES, RELIABILITY, FILTER_OPTIONS, OPPONENT_TIERS, SAMPLE_CLASSES,
} from '../analysis/analysisConfig.js';

const router = Router();
const fail = (res, e) => {
  if (e instanceof NotFoundError) return res.status(404).json({ error: e.message });
  if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
  if (e instanceof ImmutableError) return res.status(409).json({ error: e.message, immutable: true });
  console.warn('[analysis-api] hata:', e.message);
  return res.status(500).json({ error: 'Analiz isteği işlenemedi.' });
};

// Katalog meta (evaluate fonksiyonları dışarı verilmez) + güncel veri durumu.
function catalogView() {
  const cur = load('bulletin')?.data;
  const availability = {};
  const center = cur?.analysisCenter;
  if (center?.matches?.length) {
    for (const c of CATALOG) availability[c.key] = { available: 0, total: 0 };
    for (const cm of center.matches) {
      for (const ev of cm.catalogEvaluations || []) {
        if (!availability[ev.key]) continue;
        availability[ev.key].total += 1;
        if (ev.available) availability[ev.key].available += 1;
      }
    }
  }
  return CATALOG.map((c) => ({
    key: c.key, version: c.version, label: c.label,
    shortDescription: c.shortDescription, detailedExplanation: c.detailedExplanation,
    whenMisleading: c.whenMisleading,
    category: c.category, signalFamily: c.signalFamily, familyLabel: ANALYSIS_FAMILIES[c.signalFamily] || c.signalFamily,
    defaultImpact: c.defaultImpact, supportedModes: c.supportedModes,
    requiredFields: c.requiredFields, dataSources: c.dataSources,
    minimumSample: c.minimumSample, outputDirection: c.outputDirection,
    filterCapable: c.filterCapable,
    currentAvailability: availability[c.key] || null,
    methodologyVersion: c.version,
  }));
}

/* ─────────── KATALOG ─────────── */
router.get('/criteria', (req, res) => {
  try {
    res.json({ catalogVersion: CATALOG_VERSION, methodologyVersion: ANALYSIS_METHODOLOGY_VERSION, count: CATALOG.length, categories: ANALYSIS_CATEGORIES, criteria: catalogView() });
  } catch (e) { fail(res, e); }
});

router.get('/criteria-scorecard', async (req, res) => {
  try { res.json(await buildCriterionScorecard({ upToRoundId: req.query.upToRound ?? null })); } catch (e) { fail(res, e); }
});

router.get('/criteria/:key/scorecard', async (req, res) => {
  try {
    if (!CATALOG_MAP[req.params.key]) return res.status(404).json({ error: 'Kriter bulunamadı.' });
    const sc = await buildCriterionScorecard({});
    const row = sc.criteria.find((c) => c.key === req.params.key) || null;
    res.json({ generatedAt: sc.generatedAt, hasData: !!row?.signals, note: sc.note, criterion: row });
  } catch (e) { fail(res, e); }
});

// ---------------------------------------------------------------------------
// GET /api/analysis/criteria/:key/kirilim — "bu kriter NEREDE başarılı"
// ---------------------------------------------------------------------------
// NEDEN VAR: karnedeki tek yüzde yanıltıcı. Bir kriter ağır favorili maçlarda
// %80, açık maçlarda %35 tutuyor olabilir; ortalaması ikisini de gizler.
// Bu uç aynı geçmişi beş eksende keser (sıra, maç tipi, kalabalık profili,
// söylenen yön, kalabalık/piyasa favorisiyle uyum).
//
// KAYNAK: mühürlü arşiv (sinyalKayitlariniTopla). Karne kapısı AYNEN geçerli —
// varsayılan yalnız resmî ileri-test haftaları. ?kesif=1 ile mührü geç atılmış
// haftalar da katılır ve yanıtta ayrıca sayılır; karıştırılmaz.
router.get('/criteria/:key/kirilim', async (req, res) => {
  try {
    const key = req.params.key;
    if (!CATALOG_MAP[key]) return res.status(404).json({ error: 'Kriter bulunamadı.' });
    const kesif = String(req.query.kesif || '') === '1';
    const { kayitlar, kapsam } = await sinyalKayitlariniTopla({ tur: 'kriter', key, kesif });
    res.json({
      key,
      ad: CATALOG_MAP[key].label,
      olusturuldu: new Date().toISOString(),
      kesif,
      kapsam,
      ...kriterKirilimi(kayitlar),
    });
  } catch (e) { fail(res, e); }
});

router.get('/criteria/:key', (req, res) => {
  try {
    const c = catalogView().find((x) => x.key === req.params.key);
    if (!c) return res.status(404).json({ error: 'Kriter bulunamadı.' });
    res.json(c);
  } catch (e) { fail(res, e); }
});

router.get('/methodology', (req, res) => {
  res.json({
    methodologyVersion: ANALYSIS_METHODOLOGY_VERSION,
    catalogVersion: CATALOG_VERSION,
    impacts: { order: IMPACT_ORDER, labels: IMPACT_LABELS },
    signalFamilies: ANALYSIS_FAMILIES,
    familyDecay: ANALYSIS_FAMILY_DECAY,
    decisionRules: DECISION_RULES,
    reliability: RELIABILITY,
    filters: FILTER_OPTIONS,
    opponentTiers: OPPONENT_TIERS,
    sampleClasses: SAMPLE_CLASSES,
    notes: [
      'Destek yüzdeleri seçili kriterlerin dağılımıdır; kazanma olasılığı veya garanti değildir.',
      'Kapalı kriter sonuca, güvene ve açıklamaya hiçbir şekilde etki etmez.',
      'Aynı sinyal ailesindeki kriterlere azalan katkı uygulanır (çifte sayım engeli).',
      'Kriter başarısı yalnız mühürlü değerlendirme + resmî 90 dk 1/X/2 sonucundan ölçülür; ilk yarı kullanılmaz.',
      'Retrospektif backtest resmî başarıya eklenmez.',
    ],
  });
});

/* ─────────── PROFİLLER (hesaba bağlı) ─────────── */
router.post('/bulletins/:bulletinId/calculate', async (req, res) => {
  try {
    const store = getArchiveStore();
    const src = await sealedOrLive(req.params.bulletinId, store);
    if (!src) return res.status(404).json({ error: 'Bu bülten için analiz verisi yok (arşivde mühürlü kayıt veya güncel bülten bulunamadı).' });
    const profile = resolveProfile();
    res.json(await calculateWithProfile({ ...src, profile, store }));
  } catch (e) { fail(res, e); }
});

router.post('/matches/:matchId/calculate', async (req, res) => {
  try {
    const store = getArchiveStore();
    const cur = load('bulletin')?.data;
    if (!cur || cur.pending) return res.status(503).json({ error: 'Güncel bülten hazır değil.' });
    const profile = resolveProfile();
    const out = await calculateWithProfile({ bulletinData: cur, matchNo: req.params.matchId, profile, store });
    if (!out.matches.length) return res.status(404).json({ error: 'Maç bulunamadı.' });
    res.json({ ...out, match: out.matches[0] });
  } catch (e) { fail(res, e); }
});

/* ─────────── RESMÎ / KULLANICI ANALİZİ ─────────── */
router.get('/bulletins/:bulletinId/official', async (req, res) => {
  try {
    const store = getArchiveStore();
    const snap = await store.getSnapshot(String(req.params.bulletinId)).catch(() => null);
    if (snap?.payload?.matches?.some((m) => m.analysisCenter?.officialMasterAnalysis)) {
      return res.json({
        bulletinId: snap.bulletinId, sealed: true, sealedAt: snap.lockedAt,
        verificationHash: snap.payloadHash,
        officialProfile: snap.payload.analysisCenter?.officialProfile || null,
        methodologyVersion: snap.payload.analysisCenter?.methodologyVersion || null,
        matches: snap.payload.matches.filter((m) => m.analysisCenter).map((m) => ({ no: m.no, matchId: m.matchId, official: m.analysisCenter.officialMasterAnalysis })),
      });
    }
    const cur = load('bulletin')?.data;
    if (cur && String(cur.roundId) === String(req.params.bulletinId) && cur.analysisCenter) {
      return res.json({
        bulletinId: String(cur.roundId), sealed: false,
        officialProfile: cur.analysisCenter.officialProfile,
        methodologyVersion: cur.analysisCenter.methodologyVersion,
        matches: cur.analysisCenter.matches.map((m) => ({ no: m.no, matchId: m.matchId, official: m.officialMasterAnalysis })),
      });
    }
    res.status(404).json({ error: 'Bu bülten için resmî Master Analiz kaydı yok.' });
  } catch (e) { fail(res, e); }
});

// Kullanıcı analizi kaydet — YALNIZ kilitten önce; freeze anında donar.
router.get('/bulletins/:bulletinId/matches/:matchId', async (req, res) => {
  try {
    const store = getArchiveStore();
    const src = await sealedOrLive(req.params.bulletinId, store);
    if (!src) return res.status(404).json({ error: 'Analiz verisi yok.' });
    const profile = resolveProfile();
    const out = await calculateWithProfile({ ...src, matchNo: req.params.matchId, profile, store });
    if (!out.matches.length) return res.status(404).json({ error: 'Maç bulunamadı.' });
    res.json({ ...out, match: out.matches[0] });
  } catch (e) { fail(res, e); }
});

/* ─────────── BACKTEST (retrospektif — resmî değil) ─────────── */
router.post('/backtest', async (req, res) => {
  try {
    const run = await runBacktest({
      criteriaKeys: Array.isArray(req.body?.criteriaKeys) ? req.body.criteriaKeys : null,
      profile: req.body?.profile || null,
      fromRound: req.body?.fromRound ?? null,
      toRound: req.body?.toRound ?? null,
    });
    await getAnalysisStore().saveBacktest(run);
    res.status(201).json(run);
  } catch (e) { fail(res, e); }
});

router.get('/backtest/:runId', async (req, res) => {
  try {
    const run = await getAnalysisStore().getBacktest(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Backtest koşusu bulunamadı.' });
    res.json(run);
  } catch (e) { fail(res, e); }
});

export default router;
