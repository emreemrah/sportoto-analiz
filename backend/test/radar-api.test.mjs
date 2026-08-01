// RADAR API TESTLERİ — veri yokken dürüst yanıtlar, metodoloji, karne.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-radar-api-'));
// Sürücü sabitlenir: .env'de Supabase varsa depo gerçek arşive kayar (bkz. api.test.mjs).
process.env.ARCHIVE_DRIVER = 'file';

const { _resetArchiveStoreForTests } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const router = (await import('../src/routes/radar.js')).default;

let server, base;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/radar', router);
  // Legacy fallback davranışını temsil eden eski uç (server.js'tekiyle aynı rol):
  app.get('/api/radar/:roundId', (req, res) => res.status(404).json({ error: 'Bu hafta için radar arşivi yok.', legacyHandler: true }));
  await new Promise((res) => { server = app.listen(0, '127.0.0.1', res); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => { server?.close(); });

const get = async (p) => {
  const r = await fetch(base + p);
  return { status: r.status, body: await r.json() };
};

test('GET /api/radar/methodology: sürümlü ağırlıklar + kapılar + dürüstlük notları', async () => {
  const { status, body } = await get('/api/radar/methodology');
  assert.equal(status, 200);
  assert.equal(body.weights.base.performance, 30);
  assert.equal(body.weights.base.bulletinMemory, 10);
  assert.ok(body.methodologyVersion.startsWith('radar-center'));
  assert.ok(body.notes.some((n) => n.includes('90 dakika')));
  assert.ok(body.notes.some((n) => n.includes('garanti')));
});

test('GET /api/radar/public-percentage-history: kaynak yokken hasData:false, sahte veri YOK', async () => {
  const { status, body } = await get('/api/radar/public-percentage-history?roundId=123');
  assert.equal(status, 200);
  assert.equal(body.hasData, false);
  assert.deepEqual(body.observations, []);
  assert.ok(body.providerNote?.includes('bekleniyor') || body.note?.includes('bekleniyor'));
});

test('GET /api/radar/market-history: gözlem yokken hasData:false', async () => {
  const { status, body } = await get('/api/radar/market-history?roundId=123');
  assert.equal(status, 200);
  assert.equal(body.hasData, false);
  assert.deepEqual(body.series, []);
});

test('GET /api/radar/scorecard: arşiv boşken hasData:false + geçmişe dönük başarı ÜRETİLMEZ', async () => {
  const { status, body } = await get('/api/radar/scorecard');
  assert.equal(status, 200);
  assert.equal(body.hasData, false);
  assert.ok(body.note.includes('geçmişe dönük tahmin üretilmez'));
});

test('GET /api/radar/weeks: boş arşivde de geçerli yapı döner', async () => {
  const { status, body } = await get('/api/radar/weeks');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.weeks));
});

test('GET /api/radar/:roundId: Radar Merkezi kaydı yoksa ESKİ işleyiciye düşer (geriye uyumluluk)', async () => {
  const { status, body } = await get('/api/radar/424242');
  assert.equal(status, 404);
  assert.equal(body.legacyHandler, true, 'legacy fallback çalışmalı');
});

test('GET /api/radar/:roundId/match/:matchId: kayıt yoksa 404 + açıklama', async () => {
  const { status, body } = await get('/api/radar/424242/match/1');
  assert.equal(status, 404);
  assert.ok(body.error);
});
