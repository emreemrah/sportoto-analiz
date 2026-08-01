// BÜLTEN ARŞİVİ API'Sİ
// Kalıcı arşiv uçları: liste, detay, mühürlü snapshot, resmî sonuçlar,
// değerlendirme, audit, gözlemler, sıra istatistikleri ve (korumalı) internal
// freeze. Mobil uygulama YALNIZ bu backend'e bağlanır; Supabase anahtarları
// asla dışarı çıkmaz.
import { Router } from 'express';
import { getArchiveStore, getArchiveDriverName } from '../archive/store.js';
import { getArchiveStatus, freezeBulletinFromData, computeFreezeAt } from '../archive/snapshotService.js';
import { getPositionStats } from '../archive/resultsService.js';
import { ImmutableError, ValidationError, NotFoundError, AlreadyExistsError } from '../archive/errors.js';
import { load } from '../cache.js';

const router = Router();

function httpError(res, e) {
  if (e instanceof NotFoundError) return res.status(404).json({ error: e.message });
  if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
  if (e instanceof ImmutableError) return res.status(409).json({ error: e.message, immutable: true });
  if (e instanceof AlreadyExistsError) return res.status(409).json({ error: e.message });
  console.warn('[arsiv-api] hata:', e.message);
  return res.status(500).json({ error: 'Arşiv isteği işlenemedi.' });
}

async function bulletinSummary(store, b) {
  const [snap, results, evaluation, matches] = await Promise.all([
    store.getSnapshot(b.id),
    store.listOfficialResults(b.id).catch(() => []),
    store.getEvaluation(b.id).catch(() => null),
    store.getMatches(b.id).catch(() => []),
  ]);
  const totalMatches = matches.length || snap?.payload?.matches?.length || null;
  const dataGaps = snap?.payload?.matches
    ? snap.payload.matches.filter((m) => !m.dataQuality?.matched).map((m) => ({ no: m.no, reason: m.dataQuality?.reason || 'Veri eşleşmedi' }))
    : [];
  return {
    id: b.id,
    roundId: b.roundId,
    season: b.season,
    week: b.week,
    status: b.status,
    firstMatchStartAt: b.firstMatchStartAt,
    freezeAt: b.freezeAt,
    lockedAt: snap?.lockedAt ?? b.lockedAt ?? null,
    completedAt: b.completedAt ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    immutable: !!snap,
    snapshot: snap
      ? { exists: true, id: snap.id, lockedAt: snap.lockedAt, late: !!snap.late, schemaVersion: snap.schemaVersion, verificationHash: snap.payloadHash, shortHash: snap.payloadHash?.slice(0, 10) ?? null }
      : { exists: false },
    totalMatches,
    resolvedCount: results.length,
    resultSummary: evaluation?.summary
      ? { correct: evaluation.summary.correct, predicted: evaluation.summary.predicted, totalMatches: evaluation.summary.totalMatches, accuracy: evaluation.summary.accuracy, banko: evaluation.summary.banko, surprise: evaluation.summary.surprise }
      : null,
    dataGaps: dataGaps.length ? dataGaps : null,
  };
}

// ---- LİSTE ---------------------------------------------------------------
router.get('/bulletins', async (req, res) => {
  try {
    const store = getArchiveStore();
    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const bulletins = (await store.listBulletins())
      .sort((a, b) => (b.roundId || 0) - (a.roundId || 0))
      .slice(0, limit);
    const items = [];
    for (const b of bulletins) items.push(await bulletinSummary(store, b));
    res.json({ generatedAt: new Date().toISOString(), driver: getArchiveDriverName(), count: items.length, bulletins: items });
  } catch (e) { httpError(res, e); }
});

// ---- SIRA İSTATİSTİKLERİ (bülten hafızası altyapısı) ---------------------
// NOT: '/bulletins/:id'den ÖNCE tanımlı kalmalı (yol çakışması yok ama net olsun).
router.get('/archive/position-stats', async (req, res) => {
  try {
    const { position, fromRound, toRound, season } = req.query;
    const stats = await getPositionStats({
      position: position ?? null, fromRound: fromRound ?? null, toRound: toRound ?? null, season: season ?? null,
    });
    res.json(stats);
  } catch (e) { httpError(res, e); }
});

// ---- DETAY ---------------------------------------------------------------
router.get('/bulletins/:id', async (req, res) => {
  try {
    const store = getArchiveStore();
    const b = await store.getBulletin(req.params.id);
    if (!b) return res.status(404).json({ error: 'Bülten arşivde yok.' });
    const summary = await bulletinSummary(store, b);
    const [matches, results] = await Promise.all([
      store.getMatches(b.id),
      store.listOfficialResults(b.id).catch(() => []),
    ]);
    const resByMatch = new Map(results.map((r) => [String(r.matchId), r]));
    res.json({
      ...summary,
      matches: matches.map((m) => {
        const r = resByMatch.get(String(m.matchId));
        return {
          matchId: m.matchId,
          orderNo: m.orderNo,
          homeName: m.homeName,
          awayName: m.awayName,
          league: m.league,
          kickoffAt: m.kickoffAt,
          externalIds: m.externalIds || null,
          official: r ? {
            result: r.officialResult,                  // yalnız 90 dk 1/X/2
            fullTimeScore: r.fullTimeScore,
            confirmedAt: r.confirmedAt,
            sourceUpdatedAt: r.sourceUpdatedAt,
            correctionVersion: r.correctionVersion,
            source: r.resultSource,
          } : null,
        };
      }),
    });
  } catch (e) { httpError(res, e); }
});

// ---- MÜHÜRLÜ SNAPSHOT ----------------------------------------------------
router.get('/bulletins/:id/snapshot', async (req, res) => {
  try {
    const store = getArchiveStore();
    const snap = await store.getSnapshot(req.params.id);
    if (!snap) {
      const b = await store.getBulletin(req.params.id);
      return res.status(404).json({
        error: b ? 'Bu bülten henüz kilitlenmedi — snapshot ilk maçtan 5 dk önce oluşur.' : 'Bülten arşivde yok.',
        freezeAt: b?.freezeAt ?? null,
        status: b?.status ?? null,
      });
    }
    res.json({
      id: snap.id,
      bulletinId: snap.bulletinId,
      schemaVersion: snap.schemaVersion,
      engineVersion: snap.engineVersion,
      sourceVersions: snap.sourceVersions,
      createdAt: snap.createdAt,
      lockedAt: snap.lockedAt,
      dataObservedAt: snap.dataObservedAt,
      late: !!snap.late,
      immutable: snap.immutable !== false,
      verificationHash: snap.payloadHash,
      hashAlgo: snap.hashAlgo,
      payload: snap.payload,
    });
  } catch (e) { httpError(res, e); }
});

// ---- RESMÎ SONUÇLAR ------------------------------------------------------
router.get('/bulletins/:id/results', async (req, res) => {
  try {
    const store = getArchiveStore();
    const b = await store.getBulletin(req.params.id);
    if (!b) return res.status(404).json({ error: 'Bülten arşivde yok.' });
    const results = await store.listOfficialResults(b.id);
    res.json({
      bulletinId: b.id,
      status: b.status,
      resolvedCount: results.length,
      results: results.sort((a, c) => (a.orderNo || 0) - (c.orderNo || 0)),
      note: 'Yalnız resmî 90 dakika sonuçları (1/X/2 + tam maç skoru). İlk yarı skoru bu sistemde kullanılmaz.',
    });
  } catch (e) { httpError(res, e); }
});

// ---- DEĞERLENDİRME -------------------------------------------------------
router.get('/bulletins/:id/evaluation', async (req, res) => {
  try {
    const store = getArchiveStore();
    const b = await store.getBulletin(req.params.id);
    if (!b) return res.status(404).json({ error: 'Bülten arşivde yok.' });
    const ev = await store.getEvaluation(b.id);
    if (!ev) {
      return res.status(404).json({
        error: b.status === 'completed'
          ? 'Değerlendirme kaydı bulunamadı.'
          : 'Bülten henüz tamamlanmadı — değerlendirme 15/15 resmî sonuç gelince oluşur.',
        status: b.status,
      });
    }
    res.json(ev);
  } catch (e) { httpError(res, e); }
});

// ---- AUDIT ---------------------------------------------------------------
router.get('/bulletins/:id/audit', async (req, res) => {
  try {
    const store = getArchiveStore();
    const b = await store.getBulletin(req.params.id);
    if (!b) return res.status(404).json({ error: 'Bülten arşivde yok.' });
    const audit = await store.listAudit(b.id);
    res.json({ bulletinId: b.id, count: audit.length, audit });
  } catch (e) { httpError(res, e); }
});

// ---- GÖZLEM ZAMAN SERİSİ -------------------------------------------------
router.get('/bulletins/:id/observations', async (req, res) => {
  try {
    const store = getArchiveStore();
    const b = await store.getBulletin(req.params.id);
    if (!b) return res.status(404).json({ error: 'Bülten arşivde yok.' });
    const rows = await store.listObservations(b.id, req.query.matchId ?? null);
    res.json({ bulletinId: b.id, count: rows.length, observations: rows });
  } catch (e) { httpError(res, e); }
});

// ---- INTERNAL: ELLE FREEZE (korumalı) ------------------------------------
// Normal kullanıcıya kapalı: INTERNAL_API_KEY tanımlıysa 'x-internal-key'
// başlığı eşleşmeli; tanımlı DEĞİLSE yalnız loopback (geliştirme) kabul edilir.
function internalOnly(req, res, next) {
  const configured = process.env.INTERNAL_API_KEY || '';
  const given = req.get('x-internal-key') || '';
  if (configured) {
    if (given === configured) return next();
    return res.status(403).json({ error: 'Bu uç servis anahtarı gerektirir.' });
  }
  const ip = req.ip || req.connection?.remoteAddress || '';
  if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return next();
  return res.status(403).json({ error: 'INTERNAL_API_KEY tanımlı değil — bu uç yalnız sunucunun kendisinden çağrılabilir.' });
}

router.post('/internal/bulletins/:id/freeze', internalOnly, async (req, res) => {
  try {
    const data = load('bulletin')?.data;
    if (!data || data.pending || String(data.roundId) !== String(req.params.id)) {
      return res.status(409).json({ error: 'Bu bülten güncel bülten cache’inde değil — freeze yalnız güncel bülten için tetiklenebilir.' });
    }
    const force = req.query.force === '1' || req.body?.force === true;
    const result = await freezeBulletinFromData(data, { trigger: 'api:internal', force });
    if (!result.frozen && result.reason === 'not_due') {
      return res.status(409).json({
        error: 'Kilit zamanı henüz gelmedi (ilk maç − 5 dk). Erken mühür için force=1 kullan.',
        freezeAt: result.freezeAt ?? computeFreezeAt(data.matches),
      });
    }
    res.json({
      ok: true,
      frozen: !!result.frozen,
      alreadyFrozen: !!result.alreadyFrozen,
      bulletinId: result.bulletinId,
      verificationHash: result.snapshot?.payloadHash ?? null,
      lockedAt: result.snapshot?.lockedAt ?? null,
    });
  } catch (e) { httpError(res, e); }
});

export default router;
