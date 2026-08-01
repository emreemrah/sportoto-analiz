// OTOMATİK YENİLEME SERVİSİ TESTLERİ — gerçek otomasyon davranışları.
// (node --test altında gerçek scheduler otomatik BAŞLAMAZ; testler env
//  enjeksiyonuyla kontrollü başlatır ve küçük zamanlarla doğrular.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-auto-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-auto-arsiv-'));

const { save, load } = await import('../src/cache.js');
const {
  refreshCurrentBulletin, startAutoRefreshScheduler, isTestEnv, currentBackoffMs, _setRefreshRunnerForTests,
} = await import('../src/autoRefresh.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NO_TEST_ENV = {};                       // scheduler'ı testte bilinçli başlatmak için
const quiet = () => {};

test('test ortamında scheduler OTOMATİK BAŞLAMAZ (node --test algısı)', () => {
  assert.equal(isTestEnv(process.env), true, 'node --test altında test ortamı algılanır');
  const s = startAutoRefreshScheduler();      // gerçek env → başlamamalı
  assert.equal(s.started, false);
  assert.equal(s.reason, 'test-env');
  s.stop();                                   // no-op, hata vermez
});

test('açılışta cache YOKKEN otomatik refresh tetiklenir + durum kaydı yazılır', async () => {
  assert.equal(load('bulletin'), null, 'başlangıçta cache boş');
  const calls = [];
  _setRefreshRunnerForTests(async () => { calls.push(1); return { roundId: 1525, matchedCount: 15, matchCount: 15 }; });
  const s = startAutoRefreshScheduler({ env: NO_TEST_ENV, intervalMs: 3600e3, log: quiet });
  await sleep(50);
  assert.equal(calls.length, 1, 'açılışta BİR kez kontrollü refresh');
  const st = load('autoRefreshStatus')?.data;
  assert.equal(st.lastTrigger, 'startup', 'tetikleyici kanıtı kaydedilir');
  assert.equal(st.ok, true);
  assert.equal(st.roundId, 1525);
  s.stop();
  _setRefreshRunnerForTests(null);
});

test('eski round cache’i varken açılış yenilemesi yeni round’u alır (motor üzerinden)', async () => {
  save('bulletin', { roundId: 1000, round: 'Eski Hafta', matches: [] });   // bayat cache
  _setRefreshRunnerForTests(async () => {
    save('bulletin', { roundId: 1525, round: '51. Hafta', matches: [] }); // motor güncel resmî bülteni yazar
    return { roundId: 1525, matchedCount: 15, matchCount: 15 };
  });
  const s = startAutoRefreshScheduler({ env: NO_TEST_ENV, intervalMs: 3600e3, log: quiet });
  await sleep(50);
  assert.equal(load('bulletin')?.data?.roundId, 1525, 'bayat round otomatik güncellendi');
  s.stop();
  _setRefreshRunnerForTests(null);
});

test('güncel cache varken ARALIK tetiği gereksiz tekrar çağrı yapmaz (minGap)', async () => {
  let calls = 0;
  _setRefreshRunnerForTests(async () => { calls += 1; return { roundId: 1525 }; });
  const s = startAutoRefreshScheduler({ env: NO_TEST_ENV, intervalMs: 40, minGapMs: 10_000, log: quiet });
  await sleep(200);                            // açılış 1 + ~4 interval tiki
  assert.equal(calls, 1, 'interval tikleri minGap içinde ATLANDI — provider’a gereksiz istek yok');
  s.stop();
  _setRefreshRunnerForTests(null);
});

test('SINGLE-FLIGHT: aynı anda iki refresh çalışamaz; ikinci çağrı süren işi bekler', async () => {
  let running = 0, maxRunning = 0, calls = 0;
  _setRefreshRunnerForTests(async () => {
    calls += 1; running += 1; maxRunning = Math.max(maxRunning, running);
    await sleep(80);
    running -= 1;
    return { roundId: 1525 };
  });
  const [a, b] = await Promise.all([
    refreshCurrentBulletin({ trigger: 't1' }),
    refreshCurrentBulletin({ trigger: 't2' }),
  ]);
  assert.equal(calls, 1, 'motor yalnız BİR kez çalıştı');
  assert.equal(maxRunning, 1, 'eşzamanlılık yok');
  assert.equal(a.ok, true);
  assert.deepEqual(a, b, 'iki çağrı aynı çalışmanın sonucunu aldı');
  _setRefreshRunnerForTests(null);
});

test('provider hatasında üstel BACKOFF ile kontrollü tekrar; başarıda sıfırlanır', async () => {
  assert.equal(currentBackoffMs({ base: 100, max: 1000, streak: 1 }), 100);
  assert.equal(currentBackoffMs({ base: 100, max: 1000, streak: 3 }), 400);
  assert.equal(currentBackoffMs({ base: 100, max: 1000, streak: 8 }), 1000, 'üst sınır aşılmaz');

  const stamps = [];
  let fails = 2;
  _setRefreshRunnerForTests(async () => {
    stamps.push(Date.now());
    if (fails-- > 0) throw new Error('provider 500');
    return { roundId: 1525 };
  });
  const s = startAutoRefreshScheduler({ env: NO_TEST_ENV, intervalMs: 3600e3, baseBackoffMs: 60, maxBackoffMs: 500, log: quiet });
  await sleep(400);                            // açılış(hata) → +60ms retry(hata) → +120ms retry(ok)
  assert.equal(stamps.length, 3, 'iki hatadan sonra üçüncü deneme başarılı');
  const gap1 = stamps[1] - stamps[0], gap2 = stamps[2] - stamps[1];
  assert.ok(gap1 >= 55, `ilk retry ≥ base (${gap1}ms)`);
  assert.ok(gap2 >= gap1, `ikinci retry daha geç (üstel: ${gap1}→${gap2}ms)`);
  const st = load('autoRefreshStatus')?.data;
  assert.equal(st.ok, true, 'son durum başarı');
  s.stop();
  _setRefreshRunnerForTests(null);
});

test('stop(): kapanışta timer’lar temizlenir — bekleyen retry/interval ATEŞLENMEZ', async () => {
  let calls = 0;
  _setRefreshRunnerForTests(async () => { calls += 1; throw new Error('hata'); });
  const s = startAutoRefreshScheduler({ env: NO_TEST_ENV, intervalMs: 50, baseBackoffMs: 40, log: quiet });
  await sleep(20);                             // açılış çağrısı yapıldı (hata → retry planlandı)
  const before = calls;
  s.stop();
  await sleep(200);
  assert.equal(calls, before, 'stop sonrası hiçbir timer ateşlenmedi');
  _setRefreshRunnerForTests(null);
});

test('FREEZE-farkındalı: donmadan önce SON güvenli yenileme otomatik planlanır', async () => {
  // İlk maç: şimdi + 5dk + 1sn → freezeAt ≈ şimdi + 1sn; lead 700ms → ~300ms sonra tetik.
  const kick = new Date(Date.now() + 5 * 60_000 + 1000).toISOString();
  save('bulletin', { roundId: 1525, matches: [{ no: 1, date: kick }] });
  const triggers = [];
  _setRefreshRunnerForTests(async () => { triggers.push('call'); return { roundId: 1525 }; });
  const s = startAutoRefreshScheduler({ env: NO_TEST_ENV, intervalMs: 3600e3, preFreezeLeadMs: 700, log: quiet });
  await sleep(600);
  assert.equal(triggers.length, 2, 'açılış + donma-öncesi son yenileme');
  s.stop();
  _setRefreshRunnerForTests(null);
});
