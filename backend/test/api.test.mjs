// ARŞİV API TESTLERİ — gerçek Express router, geçici dosya deposu, ağ yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

// Depo, router import edilmeden ÖNCE geçici klasöre yönlendirilir.
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-arsiv-api-'));
// SÜRÜCÜ SABİTLENİR — ARCHIVE_DIR tek başına YETMEZ. getArchiveStore(), Supabase
// yapılandırılmışsa dosya deposunu değil Supabase'i seçer; geliştirici makinesinde
// backend/.env içinde anahtarlar OLDUĞU için bu testler orada hem kırmızı yanıyordu
// hem de 8001/8002 numaralı sahte mühürlü bülteni GERÇEK arşive yazmayı deniyordu.
// Arşiv verisi değiştirilemez olduğundan bu asla denenmemeli. (radar-dna-boundary
// testindeki HISTORY_DRIVER='file' ile aynı gerekçe.)
process.env.ARCHIVE_DRIVER = 'file';
delete process.env.INTERNAL_API_KEY;

const { _resetArchiveStoreForTests, getArchiveDriverName, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const store = getArchiveStore();

// Yukarıdaki sabitleme kazara kaldırılırsa testler sessizce gerçek arşive gitmesin.
test('arşiv testleri yalnız dosya deposunda çalışır (gerçek arşive dokunulmaz)', () => {
  assert.equal(getArchiveDriverName(), 'file');
});

const { freezeBulletinFromData } = await import('../src/archive/snapshotService.js');
const { ingestOfficialResults, maybeCompleteAndEvaluate } = await import('../src/archive/resultsService.js');
const { makeBulletinData, makeOfficialMatches, FREEZE_AT_UTC } = await import('./helpers/fixtures.mjs');
const router = (await import('../src/routes/bulletins.js')).default;

const FREEZE_MS = new Date(FREEZE_AT_UTC).getTime();
const RESULTS = { 1: '1', 2: '2', 3: '2', 4: '1', 5: 'X', 6: '2', 7: 'X', 8: '1', 9: '2', 10: '1', 11: '1', 12: '2', 13: '1', 14: 'X', 15: '1' };

let server, base;

test.before(async () => {
  // Test verisi: kilitli + tamamlanmış bir bülten (8001) ve kilitli bir bülten (8002).
  const d1 = makeBulletinData({ roundId: 8001 });
  await freezeBulletinFromData(d1, { store, now: FREEZE_MS });
  await ingestOfficialResults('8001', makeOfficialMatches(d1, RESULTS), { store });
  await maybeCompleteAndEvaluate('8001', { store });

  const d2 = makeBulletinData({ roundId: 8002, firstKickoff: '2026-08-01T20:00:00+03:00' });
  await freezeBulletinFromData(d2, { store, now: new Date('2026-08-01T16:55:00Z').getTime() });

  const app = express();
  app.use(express.json());
  app.use('/api', router);
  await new Promise((res) => { server = app.listen(0, '127.0.0.1', res); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => { server?.close(); });

const get = async (p) => {
  const r = await fetch(base + p);
  return { status: r.status, body: await r.json() };
};

test('GET /api/bulletins: liste durum/freezeAt/lockedAt/immutable/hash alanlarını döner', async () => {
  const { status, body } = await get('/api/bulletins');
  assert.equal(status, 200);
  assert.ok(body.bulletins.length >= 2);
  const b1 = body.bulletins.find((b) => b.id === '8001');
  assert.equal(b1.status, 'completed');
  assert.equal(b1.immutable, true);
  assert.ok(b1.freezeAt && b1.lockedAt && b1.completedAt);
  assert.match(b1.snapshot.verificationHash, /^[0-9a-f]{64}$/);
  assert.equal(b1.resultSummary.totalMatches, 15);
  assert.ok(b1.dataGaps && b1.dataGaps.some((g) => g.no === 7), 'veri eksikliği açık gösterilmeli');
  const b2 = body.bulletins.find((b) => b.id === '8002');
  assert.equal(b2.status, 'locked');
  assert.equal(b2.completedAt, null);
});

test('GET /api/bulletins/:id: maç kimlikleri + yalnız resmî sonuç alanları', async () => {
  const { status, body } = await get('/api/bulletins/8001');
  assert.equal(status, 200);
  assert.equal(body.matches.length, 15);
  const m1 = body.matches.find((m) => m.orderNo === 1);
  assert.equal(m1.homeName, 'Galatasaray');
  assert.equal(m1.official.result, '1');
  assert.ok(!('halfTimeScore' in (m1.official || {})), 'ilk yarı alanı dönmemeli');
});

test('GET /api/bulletins/:id/snapshot: mühürlü payload + doğrulama hash’i', async () => {
  const { status, body } = await get('/api/bulletins/8001/snapshot');
  assert.equal(status, 200);
  assert.equal(body.immutable, true);
  assert.match(body.verificationHash, /^[0-9a-f]{64}$/);
  assert.equal(body.payload.matches.length, 15);
  assert.ok(!JSON.stringify(body.payload).includes('officialResult'), 'snapshot sonuç içermez');
});

test('GET snapshot (kilitlenmemiş bülten): 404 + freezeAt bilgisi', async () => {
  const { status, body } = await get('/api/bulletins/999999/snapshot');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /api/bulletins/:id/results ve /evaluation: sonuçlar ayrı, değerlendirme dürüst', async () => {
  const r1 = await get('/api/bulletins/8001/results');
  assert.equal(r1.status, 200);
  assert.equal(r1.body.resolvedCount, 15);
  assert.ok(r1.body.note.includes('90 dakika'));

  const r2 = await get('/api/bulletins/8001/evaluation');
  assert.equal(r2.status, 200);
  assert.equal(r2.body.effectiveFromRoundId, 8002);
  assert.ok(r2.body.summary.correct >= 0 && r2.body.summary.predicted === 14);

  // Kilitli ama tamamlanmamış bültende değerlendirme yok → 404 + açıklama.
  const r3 = await get('/api/bulletins/8002/evaluation');
  assert.equal(r3.status, 404);
  assert.ok(r3.body.error.includes('tamamlanmadı'));
});

test('GET /api/bulletins/:id/audit: kilit ve sonuç olayları kayıtlı', async () => {
  const { status, body } = await get('/api/bulletins/8001/audit');
  assert.equal(status, 200);
  const actions = body.audit.map((a) => a.action);
  assert.ok(actions.includes('freeze'));
  assert.ok(actions.includes('evaluate'));
});

test('GET /api/archive/position-stats: örneklem + yüzdeler + az örnek uyarısı', async () => {
  const { status, body } = await get('/api/archive/position-stats');
  assert.equal(status, 200);
  assert.equal(body.sampleBulletins, 1); // yalnız tamamlanmış 8001
  const p2 = body.positions.find((p) => p.position === 2);
  assert.deepEqual(p2.counts, { '1': 0, X: 0, '2': 1 });
  assert.equal(p2.lowSample, true);

  const bad = await get('/api/archive/position-stats?position=42');
  assert.equal(bad.status, 400);
});

test('POST /api/internal/.../freeze: servis anahtarı koruması çalışır', async () => {
  // 1) Anahtar tanımlıyken başlıksız istek → 403.
  process.env.INTERNAL_API_KEY = 'test-gizli-anahtar';
  let r = await fetch(`${base}/api/internal/bulletins/999999/freeze`, { method: 'POST' });
  assert.equal(r.status, 403);

  // 2) Doğru anahtar → guard geçer; güncel bülten cache'te olmadığı için 409.
  r = await fetch(`${base}/api/internal/bulletins/999999/freeze`, {
    method: 'POST', headers: { 'x-internal-key': 'test-gizli-anahtar' },
  });
  assert.equal(r.status, 409);

  // 3) Anahtar tanımsız + loopback → guard geçer (geliştirme kolaylığı) → yine 409.
  delete process.env.INTERNAL_API_KEY;
  r = await fetch(`${base}/api/internal/bulletins/999999/freeze`, { method: 'POST' });
  assert.equal(r.status, 409);
});
