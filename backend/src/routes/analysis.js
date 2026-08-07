// MASTER ANALİZ API'Sİ — /api/analysis/*
// Katalog + karne + profiller + hesap + kullanıcı analizi + backtest.
// Girişli kullanıcı: profiller/analizler hesaba bağlanır (requireAuth).
// Girişsiz kullanım: hesap uçları 401 döner; uygulama yerel profille çalışmaya
// devam eder (calculate uçları profili istek gövdesinde kabul eder).
import { Router } from 'express';
import { load } from '../cache.js';
import { requireAuth } from '../mw.js';
import { getArchiveStore } from '../archive/store.js';
import { computeFreezeAt } from '../archive/snapshotService.js';
import { ImmutableError, NotFoundError, ValidationError } from '../archive/errors.js';
import { CATALOG, CATALOG_MAP, CATALOG_VERSION, ANALYSIS_CATEGORIES } from '../analysis/criterionCatalog.js';
import {
  buildCriterionScorecard, calculateWithProfile, buildOfficialProfile, runBacktest,
} from '../analysis/analysisService.js';
import { kriterKirilimi } from '../analysis/kriterKirilim.js';
import { kriterKarsilastirma } from '../analysis/kriterKarsilastirma.js';
import { sinyalKayitlariniTopla, tumKriterKayitlari } from '../analysis/sinyalToplama.js';
import {
  getAnalysisStore, newProfile, updateProfileVersion, duplicateProfile,
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
// GET /api/analysis/kriter-karsilastirma — "hangi iş için hangi kriter"
// ---------------------------------------------------------------------------
// KULLANICININ TARİFİ: "Claude kod yazmada iyi, ChatGPT dikte ve resimde.
// Derdimiz maç değil, KRİTERİN KENDİSİ." Yani her iş (ağır favori, denk maç,
// X demek, kalabalığa ters düşmek, bülten sırası...) için kriterler sıralanır.
//
// Kırılım ucu "tek kriter, tüm işler" gösterir; bu uç tabloyu TERS ÇEVİRİR:
// "tek iş, tüm kriterler".
//
// PERFORMANS: 40 kriter için arşivi 40 kez taramak yerine `tumKriterKayitlari`
// ile TEK geçiş yapılır. Sonuç 10 dakika bellekte tutulur.
const KARSILASTIRMA_TTL = 10 * 60 * 1000;
const karsilastirmaBellek = { veri: null, zaman: 0, anahtar: null };

router.get('/kriter-karsilastirma', async (req, res) => {
  try {
    const kesif = String(req.query.kesif || '') === '1';
    const zorla = String(req.query.zorla || '') === '1';
    const anahtar = kesif ? 'kesif' : 'resmi';
    if (!zorla && karsilastirmaBellek.veri && karsilastirmaBellek.anahtar === anahtar
      && Date.now() - karsilastirmaBellek.zaman < KARSILASTIRMA_TTL) {
      return res.json({ ...karsilastirmaBellek.veri, bellekten: true });
    }

    const { byKey, kapsam } = await tumKriterKayitlari({ kesif });
    const adlar = new Map(CATALOG.map((c) => [c.key, c.label]));
    // BİLGİ kriterleri ölçülmez: yön söylemezler, doğruluk atfedilemez.
    // Ayrım katalogdaki `outputDirection` alanındadır (informational).
    for (const c of CATALOG) if (c.outputDirection === 'informational') byKey.delete(c.key);

    const cikti = {
      olusturuldu: new Date().toISOString(),
      kesif,
      kapsam,
      ...kriterKarsilastirma(byKey, adlar),
    };
    karsilastirmaBellek.veri = cikti;
    karsilastirmaBellek.zaman = Date.now();
    karsilastirmaBellek.anahtar = anahtar;
    res.json(cikti);
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
router.get('/profiles', requireAuth, async (req, res) => {
  try { res.json({ profiles: await getAnalysisStore().listProfiles(req.user.id) }); } catch (e) { fail(res, e); }
});

router.post('/profiles', requireAuth, async (req, res) => {
  try {
    const store = getAnalysisStore();
    const profiles = await store.listProfiles(req.user.id);
    const p = newProfile({
      name: req.body?.name, criteria: req.body?.criteria || {},
      mode: req.body?.mode === 'smart' ? 'smart' : 'manual',
      globalFilters: req.body?.globalFilters || null,
      isDefault: !!req.body?.isDefault || profiles.length === 0,
    });
    if (p.isDefault) profiles.forEach((x) => { x.isDefault = false; });
    profiles.push(p);
    await store.saveProfiles(req.user.id, profiles);
    res.status(201).json(p);
  } catch (e) { fail(res, e); }
});

router.get('/profiles/:id', requireAuth, async (req, res) => {
  try {
    const p = await getAnalysisStore().getProfile(req.user.id, req.params.id);
    if (!p) return res.status(404).json({ error: 'Profil bulunamadı.' });
    res.json(p);
  } catch (e) { fail(res, e); }
});

// GÜNCELLEME = YENİ SÜRÜM (eski sürüm korunur; mühürlü analizler eski sürümde kalır).
router.put('/profiles/:id', requireAuth, async (req, res) => {
  try {
    const store = getAnalysisStore();
    const profiles = await store.listProfiles(req.user.id);
    const idx = profiles.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Profil bulunamadı.' });
    profiles[idx] = updateProfileVersion(profiles[idx], {
      name: req.body?.name, criteria: req.body?.criteria,
      mode: req.body?.mode, globalFilters: req.body?.globalFilters,
    });
    await store.saveProfiles(req.user.id, profiles);
    res.json(profiles[idx]);
  } catch (e) { fail(res, e); }
});

router.post('/profiles/:id/duplicate', requireAuth, async (req, res) => {
  try {
    const store = getAnalysisStore();
    const profiles = await store.listProfiles(req.user.id);
    const src = profiles.find((x) => x.id === req.params.id);
    if (!src) return res.status(404).json({ error: 'Profil bulunamadı.' });
    const copy = duplicateProfile(src, req.body?.name);
    profiles.push(copy);
    await store.saveProfiles(req.user.id, profiles);
    res.status(201).json(copy);
  } catch (e) { fail(res, e); }
});

router.delete('/profiles/:id', requireAuth, async (req, res) => {
  try {
    const store = getAnalysisStore();
    const profiles = await store.listProfiles(req.user.id);
    const idx = profiles.findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Profil bulunamadı.' });
    profiles.splice(idx, 1);
    await store.saveProfiles(req.user.id, profiles);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post('/profiles/:id/set-default', requireAuth, async (req, res) => {
  try {
    const store = getAnalysisStore();
    const profiles = await store.listProfiles(req.user.id);
    const target = profiles.find((x) => x.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'Profil bulunamadı.' });
    profiles.forEach((x) => { x.isDefault = x.id === target.id; });
    await store.saveProfiles(req.user.id, profiles);
    res.json(target);
  } catch (e) { fail(res, e); }
});

/* ─────────── HESAPLAMA ─────────── */
// Profil istek gövdesinde gelir (girişsiz yerel kullanım) veya profileId ile
// hesaptan okunur. Profil sürümü yanıtın parçasıdır.
async function resolveProfile(req) {
  if (req.body?.profileId && req.user) {
    const p = await getAnalysisStore().getProfile(req.user.id, req.body.profileId);
    if (!p) throw new NotFoundError('Profil bulunamadı.');
    return { id: p.id, name: p.name, version: p.currentVersion, mode: p.mode, globalFilters: p.globalFilters, criteria: p.criteria };
  }
  if (req.body?.profile) {
    const p = req.body.profile;
    return { id: p.id || 'local', name: p.name || 'Yerel Profil', version: p.version ?? p.currentVersion ?? 1, mode: p.mode === 'smart' ? 'smart' : 'manual', globalFilters: p.globalFilters || null, criteria: p.criteria || {} };
  }
  return buildOfficialProfile();
}

async function sealedOrLive(bulletinId, store) {
  const cur = load('bulletin')?.data;
  const snap = await store.getSnapshot(String(bulletinId)).catch(() => null);
  if (snap?.payload?.matches?.some((m) => m.analysisCenter)) return { sealedSnapshot: snap, bulletinData: null };
  if (cur && String(cur.roundId) === String(bulletinId)) return { sealedSnapshot: null, bulletinData: cur };
  return null;
}

router.post('/bulletins/:bulletinId/calculate', async (req, res) => {
  try {
    const store = getArchiveStore();
    const src = await sealedOrLive(req.params.bulletinId, store);
    if (!src) return res.status(404).json({ error: 'Bu bülten için analiz verisi yok (arşivde mühürlü kayıt veya güncel bülten bulunamadı).' });
    const profile = await resolveProfile(req);
    res.json(await calculateWithProfile({ ...src, profile, store }));
  } catch (e) { fail(res, e); }
});

router.post('/matches/:matchId/calculate', async (req, res) => {
  try {
    const store = getArchiveStore();
    const cur = load('bulletin')?.data;
    if (!cur || cur.pending) return res.status(503).json({ error: 'Güncel bülten hazır değil.' });
    const profile = await resolveProfile(req);
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
router.post('/bulletins/:bulletinId/save-user-analysis', requireAuth, async (req, res) => {
  try {
    const store = getArchiveStore();
    const bulletinId = String(req.params.bulletinId);
    const cur = load('bulletin')?.data;
    if (!cur || String(cur.roundId) !== bulletinId) {
      return res.status(409).json({ error: 'Kullanıcı analizi yalnız güncel bülten için kaydedilebilir.' });
    }
    const freezeAt = computeFreezeAt(cur.matches);
    if (freezeAt && Date.now() >= new Date(freezeAt).getTime()) {
      return res.status(409).json({ error: 'Bülten kilitlendi — analiz artık kaydedilemez/değiştirilemez.', freezeAt });
    }
    const snap = await store.getSnapshot(bulletinId).catch(() => null);
    if (snap) return res.status(409).json({ error: 'Bülten mühürlendi — analiz artık kaydedilemez.', immutable: true });

    const profile = await resolveProfile(req);
    const calc = await calculateWithProfile({ bulletinData: cur, profile, store });
    const entry = {
      bulletinId, userId: req.user.id,
      profileId: profile.id, profileVersion: profile.version, mode: profile.mode,
      savedAt: new Date().toISOString(),
      locked: false, lockedAt: null,
      picks: Object.fromEntries(calc.matches.map((m) => [m.no, m.master.mainPrediction ?? null])),
      matches: calc.matches.map((m) => ({ no: m.no, matchId: m.matchId, master: m.master })),
      methodologyVersion: ANALYSIS_METHODOLOGY_VERSION,
    };
    await getAnalysisStore().saveUserAnalysis(entry);
    res.status(201).json({ ok: true, savedAt: entry.savedAt, freezeAt, note: 'Analiz kaydedildi; ilk maçtan 5 dk önce otomatik kilitlenecek.' });
  } catch (e) { fail(res, e); }
});

router.get('/bulletins/:bulletinId/user', requireAuth, async (req, res) => {
  try {
    const list = await getAnalysisStore().listUserAnalyses(String(req.params.bulletinId), req.user.id);
    if (!list.length) return res.status(404).json({ error: 'Bu bülten için kayıtlı analizin yok.' });
    res.json(list[0]);
  } catch (e) { fail(res, e); }
});

router.get('/bulletins/:bulletinId/matches/:matchId', async (req, res) => {
  try {
    const store = getArchiveStore();
    const src = await sealedOrLive(req.params.bulletinId, store);
    if (!src) return res.status(404).json({ error: 'Analiz verisi yok.' });
    const profile = await resolveProfile(req);
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
