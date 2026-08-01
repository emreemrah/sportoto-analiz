// SEZON KEŞFİ TESTLERİ — dar kapsam, sınırlar, fail-closed, cache.
// 17091/17288/17112/17301 değerleri YALNIZ test fixture/beklenen doğrulama
// sonucudur (kullanıcının katalog kontrolünde doğrulanmış gerçek id'ler) —
// production kodunda bu id'lere hiçbir bağımlılık yoktur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-disc-cache-'));

const { load } = await import('../src/cache.js');
const {
  selectSeasonsFromCatalog, discoverSeasonIds, isExcludedLeagueName, DISCOVERY_LIMITS,
} = await import('../src/seasonDiscovery.js');

const lg = (name, country, seasons) => ({ name, country, season: seasons });
const quiet = () => {};

// Kullanıcının paneline benzer dar "seçili ligler" kataloğu (gerçek id'ler fixture olarak):
const CHOSEN_CATALOG = [
  lg('Denmark Superliga', 'Denmark', [{ id: 14972, year: 20242025 }, { id: 17091, year: 20252026 }]),
  lg('Denmark 1st Division', 'Denmark', [{ id: 17288, year: 20252026 }]),
  lg('Poland Ekstraklasa', 'Poland', [{ id: 9101, year: 20242025 }, { id: 17112, year: 20252026 }]),
  lg('Poland 1. Liga', 'Poland', [{ id: 17301, year: 20252026 }]),
  lg('Sweden Allsvenskan', 'Sweden', [{ id: 15068, year: 2025 }]),
  lg('Norway Eliteserien', 'Norway', [{ id: 15115, year: 2025 }]),
];

test('17288, 17112 ve 17301 katalogdan DİNAMİK çözülür (elle .env düzenleme yok)', () => {
  const envIds = [17091, 15068, 15115];                 // Polonya/Danimarka-1 env'de YOK
  const sel = selectSeasonsFromCatalog(CHOSEN_CATALOG, { envIds });
  assert.deepEqual(sel.ids.sort((a, b) => a - b), [17112, 17288, 17301], 'gerekli sezonlar otomatik bulunur');
  assert.equal(sel.failClosed, false);
});

test('17091 TEKRAR eklenmez (env + katalog birleşiminde tekil)', async () => {
  const r = await discoverSeasonIds({ envIds: [17091], fetcher: async () => CHOSEN_CATALOG, log: quiet });
  const count17091 = r.ids.filter((id) => id === 17091).length;
  assert.equal(count17091, 1, 'aynı seasonId yalnız bir kez');
  assert.ok(r.ids.includes(17112) && r.ids.includes(17288) && r.ids.includes(17301));
});

test('her ligden yalnız GÜNCEL sezon (eski yıl kodları atlanır)', () => {
  const sel = selectSeasonsFromCatalog(CHOSEN_CATALOG, { envIds: [] });
  assert.ok(sel.ids.includes(17091) && !sel.ids.includes(14972), 'Superliga: 20252026 seçildi, 20242025 değil');
  assert.ok(sel.ids.includes(17112) && !sel.ids.includes(9101), 'Ekstraklasa: güncel sezon');
});

test('kadın / genç / rezerv / B takımı ligleri VARSAYILAN dışı', () => {
  assert.equal(isExcludedLeagueName('Denmark Superliga Women'), true);
  assert.equal(isExcludedLeagueName('Poland Central Youth League U19'), true);
  assert.equal(isExcludedLeagueName('Norway Reserves League'), true);
  assert.equal(isExcludedLeagueName('Spain Segunda B Team Cup'), true);
  assert.equal(isExcludedLeagueName('Poland 1. Liga'), false, 'senior alt lig GEÇERLİ (panel seçimi)');
  assert.equal(isExcludedLeagueName('Denmark Superliga'), false);
  const sel = selectSeasonsFromCatalog([
    ...CHOSEN_CATALOG,
    lg('Denmark Superliga Women', 'Denmark', [{ id: 99001, year: 20252026 }]),
    lg('Poland U19 Liga', 'Poland', [{ id: 99002, year: 20252026 }]),
  ], { envIds: [] });
  assert.ok(!sel.ids.includes(99001) && !sel.ids.includes(99002), 'dışlanan kategoriler seçilmez');
  assert.ok(sel.skipped.some((s) => s.reason === 'excluded_category'));
});

test('1734 kayıtlı TAM katalog verilirse FAIL-CLOSED: yüzlerce sezon ÇEKİLMEZ', () => {
  const big = Array.from({ length: 1734 }, (_, i) => lg(`League ${i}`, `Country${i % 90}`, [{ id: 50000 + i, year: 20252026 }]));
  const sel = selectSeasonsFromCatalog(big, { envIds: [] });
  assert.equal(sel.failClosed, true, 'sınır aşımı → keşif iptal');
  assert.deepEqual(sel.ids, [], 'TEK BİR dinamik sezon bile seçilmez (maç endpoint çağrısı imkânsız)');
  assert.ok(sel.reason.startsWith('dynamic_season_cap'));
});

test('ülke başına aday sezon sınırı uygulanır', () => {
  const many = Array.from({ length: 9 }, (_, i) => lg(`Poland Liga ${i}`, 'Poland', [{ id: 60000 + i, year: 20252026 }]));
  const sel = selectSeasonsFromCatalog(many, { envIds: [], limits: { ...DISCOVERY_LIMITS, maxPerCountry: 6 } });
  assert.equal(sel.ids.length, 6, 'ülke sınırı: 6');
  assert.equal(sel.skipped.filter((s) => s.reason === 'country_cap').length, 3);
});

test('katalog TTL cache: aynı katalog her çağrıda yeniden İSTENMEZ', async () => {
  const { rmSync } = await import('node:fs');
  rmSync(join(process.env.CACHE_DIR, 'seasonCatalog.json'), { force: true }); // izolasyon
  let fetches = 0;
  const fetcher = async () => { fetches += 1; return CHOSEN_CATALOG; };
  await discoverSeasonIds({ envIds: [], fetcher, log: quiet });
  await discoverSeasonIds({ envIds: [], fetcher, log: quiet });
  assert.equal(fetches, 1, 'ikinci keşif cache’ten okudu');
  assert.ok(load('seasonCatalog')?.data?.leagues?.length >= 6);
});

test('katalog başarısızsa: son geçerli keşif + env ile devam (kullanıcıya soru YOK)', async () => {
  const bad = async () => { throw new Error('kaynak kapalı'); };
  // Önceki testte discovery cache oluştu → fallback onu kullanır.
  // Ama TTL cache'i taze olduğu için önce cache yolu çalışır; TTL'i sıfır yapıp zorlarız:
  const r = await discoverSeasonIds({ envIds: [15068], fetcher: bad, limits: { ...DISCOVERY_LIMITS, catalogTtlMs: 0 }, log: quiet });
  assert.ok(r.ids.includes(15068), 'env korunur');
  assert.ok(r.ids.includes(17112), 'son geçerli keşif cache’inden gelir');
  assert.equal(r.meta.fallback, 'last-discovery-cache');
});
