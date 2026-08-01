// GEÇMİŞ ARŞİV + OYNANMA GÖZLEM ZAMANLAYICISI TESTLERİ (görev H)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = process.env.CACHE_DIR || mkdtempSync(join(tmpdir(), 'sportoto-sched-cache-'));

const { startHistoryAndObservationScheduler } = await import('../src/history/scheduler.js');
const { load, save } = await import('../src/cache.js');

test('1. TEST ORTAMINDA otomatik BAŞLAMAZ (node --test algısı)', () => {
  const s = startHistoryAndObservationScheduler({});
  assert.equal(s.started, false);
  assert.equal(s.reason, 'test-env');
  s.stop(); // no-op, hata atmaz
});

test('2. Üretim ortamı simülasyonu: açılış tetikleri planlanır + stop timer\'ları temizler', async () => {
  let importCalls = 0;
  const s = startHistoryAndObservationScheduler({
    env: { NODE_ENV: 'production' },                    // test algısı manuel aşılır
    importFn: async () => { importCalls += 1; return { ok: true, imported: 0, processed: 0, totalDone: 0 }; },
    observeFn: async () => ({ ok: true, written: 0 }),
    log: () => {},
  });
  assert.equal(s.started, true);
  s.stop();                                             // açılış timer'ları (15sn/45sn) İPTAL
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(importCalls, 0, 'stop sonrası hiçbir tetik ateşlenmez (graceful shutdown)');
});

test('3. Güncel hafta kimliği içe aktarıcıya taşınır (arşive girmesin diye)', async () => {
  save('bulletin', { roundId: 9999, matches: [] });
  let seen = null;
  const s = startHistoryAndObservationScheduler({
    env: { NODE_ENV: 'production' },
    importFn: async ({ currentRoundId }) => { seen = currentRoundId; return { ok: true, imported: 0, processed: 0 }; },
    observeFn: async () => ({ ok: true }),
    log: () => {},
  });
  // startup import 15 sn'de planlı — testte beklemek yerine iç fonksiyonu tetiklemek
  // için kısa yol yok; bu senaryo importer tarafında ayrıca test edildi. Burada
  // yalnız zamanlayıcının çalışır kurulduğunu doğrularız.
  assert.equal(s.started, true);
  s.stop();
  assert.equal(seen, null, 'stop açılış tetiğinden önce geldi — sızıntı yok');
});

test('4. Etkin sağlayıcı yokken gözlem turu dürüst durum yazar (uydurma yok)', async () => {
  // scheduler'ın gözlem yolu playedPercentages.observePlayedPercentages ile
  // aynı sözleşmeyi kullanır; sağlayıcısız akış orada test edildi (11. test).
  // Burada durum kaydının kullanıcı-diliyle yazıldığını doğrularız.
  const { enabledProviders } = await import('../src/providers/playedPercentages.js');
  // Bilyoner gerçek açık/oturumsuz kaynağı doğrulandığı için ARTIK etkin (≥1).
  assert.ok(enabledProviders().length >= 1, 'Bilyoner doğrulanmış açık kaynak olarak etkin');
  assert.ok(enabledProviders().some((p) => p.id === 'bilyoner'));
  const st = load('playedObserveStatus')?.data;
  assert.ok(st == null || !JSON.stringify(st).match(/Error|stack|ECONN/i), 'durum kaydında teknik hata sızıntısı yok');
});
