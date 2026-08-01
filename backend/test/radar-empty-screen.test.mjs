// RADAR EKRANI BOŞ KALMA HATASI — REGRESYON TESTLERİ (19 test).
// Kök neden zinciri: cache (backend/cache) uçucu, arşiv kalıcı. Cache silinince
// /api/radar/weeks güncel haftayı işaretleyemiyor, /api/radar/:roundId güncel
// haftayı legacy 404'e ("Bu hafta için radar arşivi yok.") düşürüyordu ve ekran
// bu hatayı boş ekranda gösteriyordu. Bu dosya o zincirin HER halkasını kilitler.
// Kurulum server.js ile AYNI sırada: önce router, sonra legacy /:roundId işleyicisi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

const CACHE = mkdtempSync(join(tmpdir(), 'sportoto-radar-cache-'));
process.env.CACHE_DIR = CACHE;
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-radar-arsiv-'));
// Sürücü sabitlenir: .env'de Supabase varsa depo gerçek arşive kayar (bkz. api.test.mjs).
process.env.ARCHIVE_DRIVER = 'file';
// GEÇMİŞ DEPOSU DA SABİT: .env'de Supabase varsa getHistoryStore() CANLI
// veritabanına düşer ve test geliştirme makinesindeki gerçek veriyi okur
// (legacy-isolation'da tam olarak bu olmuştu). Testler ağa çıkmaz.
process.env.HISTORY_DRIVER = 'file';
process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-gecmis-'));

const { save } = await import('../src/cache.js');
const { _resetArchiveStoreForTests, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { default: radarRoutes, makeLegacyRadarHandler } = await import('../src/routes/radar.js');
const { registerBulletinFromData, freezeBulletinFromData } = await import('../src/archive/snapshotService.js');
const { computeRadarCenterForData } = await import('../src/radar/radarService.js');
const { makeBulletinData, FREEZE_AT_UTC } = await import('./helpers/fixtures.mjs');

const FREEZE_MS = new Date(FREEZE_AT_UTC).getTime();
const R_CUR = 4300;      // güncel hafta (canlı bülten)
const R_SEALED = 4290;   // mühürlü geçmiş hafta (snapshot + radarCenter)
const R_LEGACY = 4280;   // Radar Merkezi öncesi eski arşiv (radar-4280 cache)
const R_MISSING = 999999; // hiç kaydı olmayan geçmiş hafta

// server.js'teki gibi: sonuç servisi enjekte edilir (testte gerçek ağ YOK).
const stubFetchBulletin = async () => ({ matches: [{ no: 1, result: '1', score: { home: 2, away: 0 } }] });

let server, base, store;
const get = async (p) => {
  const r = await fetch(base + p);
  return { status: r.status, body: await r.json() };
};
const wipeCache = () => {
  rmSync(join(CACHE, 'bulletin.json'), { force: true });
  rmSync(join(CACHE, `radarCenter-${R_CUR}.json`), { force: true });
};

test.before(async () => {
  store = getArchiveStore();

  // 1) MÜHÜRLÜ GEÇMİŞ HAFTA: radarCenter hesapla → arşive kaydet → dondur.
  const sealedData = makeBulletinData({ roundId: R_SEALED, round: '48. Hafta' });
  sealedData.radarCenter = await computeRadarCenterForData(sealedData, { store, now: FREEZE_MS - 3600e3 });
  await registerBulletinFromData(sealedData, { store, now: FREEZE_MS - 3600e3 });
  const fr = await freezeBulletinFromData(sealedData, { store, now: FREEZE_MS + 60e3 });
  assert.equal(fr.frozen, true, 'fikstür: mühürleme başarılı olmalı');

  // 2) ESKİ SİSTEM HAFTASI: yalnız legacy radar-#### cache kaydı.
  save(`radar-${R_LEGACY}`, {
    roundId: R_LEGACY, round: '47. Hafta', year: '2026/2027',
    radarFrozenAt: new Date(FREEZE_MS - 7 * 24 * 3600e3).toISOString(),
    radar: [{ no: 1, home: 'Eski Ev', away: 'Eski Dep', surpriseScore: 55, label: 'Dikkat', labelColor: 'yellow', favorite: { symbol: '1', percent: 60 } }],
  });

  // 3) GÜNCEL HAFTA: canlı bülten cache'te + arşivde 'active' kayıt (worker davranışı).
  const curData = makeBulletinData({ roundId: R_CUR, round: '49. Hafta' });
  save('bulletin', curData);
  await registerBulletinFromData(curData, { store, now: FREEZE_MS - 3600e3 });

  const app = express();
  app.use(express.json());
  app.use('/api/radar', radarRoutes);                                     // server.js sırası
  app.get('/api/radar/:roundId', makeLegacyRadarHandler({ fetchBulletin: stubFetchBulletin }));
  await new Promise((res) => { server = app.listen(0, '127.0.0.1', res); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => { server?.close(); });

// ---------------------------------------------------------------------------
// A) CANLI GÜNCEL HAFTA (bülten cache'te)
// ---------------------------------------------------------------------------
test('1. /api/radar/current: güncel hafta 200 + hasData + current:true + 15 maç', async () => {
  const { status, body } = await get('/api/radar/current');
  assert.equal(status, 200);
  assert.equal(body.hasData, true);
  assert.equal(body.current, true);
  assert.equal(body.roundId, R_CUR);
  assert.equal(body.matches.length, 15, 'bültendeki 15 maçın TAMAMI listelenir');
});

test('2. verisi eksik maç (7. maç) düşürülmez: insufficient_data kartı olarak kalır', async () => {
  const { body } = await get('/api/radar/current');
  const m7 = body.matches.find((m) => m.no === 7);
  assert.ok(m7, 'veri eksik maç listeden atılmaz');
  assert.equal(m7.master.classification, 'insufficient_data');
  assert.ok(body.matches.every((m) => m.master?.classification), 'her kartta sınıflandırma var');
});

test('3. /api/radar/weeks: güncel hafta AÇIK current:true + archived:false + kimlik alanları', async () => {
  const { status, body } = await get('/api/radar/weeks');
  assert.equal(status, 200);
  assert.equal(body.currentRoundId, R_CUR);
  const cur = body.weeks.find((w) => w.roundId === R_CUR);
  assert.ok(cur, 'güncel hafta listede olmalı');
  assert.equal(cur.current, true);
  assert.equal(cur.archived, false, 'GÜNCEL hafta ASLA arşivlenmiş işaretlenmez');
  assert.equal(cur.locked, false);
  assert.equal(cur.round, '49. Hafta');
  assert.ok(cur.year, 'year alanı dolu');
  assert.ok(cur.freezeAt, 'freezeAt (donma anı) verilir');
});

test('4. weeks: mühürlü geçmiş hafta archived:true + locked:true + lockedAt dolu', async () => {
  const { body } = await get('/api/radar/weeks');
  const w = body.weeks.find((x) => x.roundId === R_SEALED);
  assert.ok(w);
  assert.equal(w.current, false);
  assert.equal(w.archived, true);
  assert.equal(w.locked, true);
  assert.ok(w.lockedAt, 'kilit zamanı verilir');
  assert.equal(w.hasRadarCenter, true);
});

test('5. weeks: eski sistem (legacy) haftası archived:true, current:false', async () => {
  const { body } = await get('/api/radar/weeks');
  const w = body.weeks.find((x) => x.roundId === R_LEGACY);
  assert.ok(w);
  assert.equal(w.status, 'legacy');
  assert.equal(w.archived, true);
  assert.equal(w.current, false);
});

test('6. weeks: yeniden→eskiye sıralı ve güncel hafta TEK kayıt (arşiv kopyası çiftlenmez)', async () => {
  const { body } = await get('/api/radar/weeks');
  const ids = body.weeks.map((w) => w.roundId);
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a), 'yeniden eskiye sıralı');
  assert.equal(ids.filter((id) => id === R_CUR).length, 1, 'güncel hafta çiftlenmez');
});

test('7. /api/radar/:roundId güncel hafta id\'siyle → arşiv DEĞİL canlı güncel görünüm', async () => {
  const { status, body } = await get(`/api/radar/${R_CUR}`);
  assert.equal(status, 200);
  assert.equal(body.current, true, 'güncel hafta geçmiş arşiv gibi GÖSTERİLMEZ');
  assert.equal(body.hasData, true);
  assert.equal(body.matches.length, 15);
});

test('8. mühürlü geçmiş hafta: snapshot\'tan okunur (sealed + doğrulama hash\'i)', async () => {
  const { status, body } = await get(`/api/radar/${R_SEALED}`);
  assert.equal(status, 200);
  assert.equal(body.current, false);
  assert.equal(body.sealed, true);
  assert.equal(body.hasData, true);
  assert.ok(body.verificationHash, 'mühür doğrulama hash\'i sunulur');
  assert.equal(body.matches.length, 15);
});

test('9. DONMA DEĞİŞMEZLİĞİ: cache değişse de mühürlü hafta yanıtı aynı kalır', async () => {
  const first = (await get(`/api/radar/${R_SEALED}`)).body;
  // Cache'i boz: güncel bülteni değiştir (mühürlü haftayı ETKİLEMEMELİ).
  save('bulletin', makeBulletinData({ roundId: R_CUR, round: '49. Hafta', noDataAt: 3 }));
  const second = (await get(`/api/radar/${R_SEALED}`)).body;
  assert.equal(second.verificationHash, first.verificationHash);
  assert.deepEqual(second.matches.map((m) => m.master.classification), first.matches.map((m) => m.master.classification));
  // Eski hale getir.
  save('bulletin', makeBulletinData({ roundId: R_CUR, round: '49. Hafta' }));
});

test('10. legacy hafta: eski arşiv + resmî sonuç işleme davranışı AYNEN korunur', async () => {
  const { status, body } = await get(`/api/radar/${R_LEGACY}`);
  assert.equal(status, 200);
  assert.equal(body.current, false);
  assert.ok(Array.isArray(body.radar) && body.radar.length === 1);
  assert.equal(body.radar[0].result, '1', 'stub sonuç servisi arşive işlendi');
  assert.equal(body.radar[0].favHit, true, 'favori tuttu bilgisi hesaplandı');
});

test('11. sayısal olmayan roundId ("abc") → 400 Geçersiz hafta', async () => {
  const { status, body } = await get('/api/radar/abc');
  assert.equal(status, 400);
  assert.equal(body.error, 'Geçersiz hafta.');
});

test('12. tam sayı olmayan roundId ("12.5") → 400 (statik yollarla çakışmaz)', async () => {
  const { status } = await get('/api/radar/12.5');
  assert.equal(status, 400);
});

test('13. GERÇEKTEN kaydı olmayan GEÇMİŞ hafta → dürüst 404 "arşivi yok"', async () => {
  const { status, body } = await get(`/api/radar/${R_MISSING}`);
  assert.equal(status, 404);
  assert.equal(body.error, 'Bu hafta için radar arşivi yok.');
});

test('14. /api/radar/:roundId/match/:matchId alt yolu çalışır (rota sırası bozulmadı)', async () => {
  const { status, body } = await get(`/api/radar/${R_CUR}/match/7`);
  assert.equal(status, 200);
  assert.equal(body.match.no, 7);
});

test('15. /current asla geçmiş haftaya kaymaz: roundId = cache\'teki güncel hafta', async () => {
  const { body } = await get('/api/radar/current');
  assert.equal(body.roundId, R_CUR, '/current yanıtı KESİNLİKLE güncel haftanın kimliğini taşır');
  assert.equal(body.current, true);
});

// ---------------------------------------------------------------------------
// B) CACHE SİLİNMİŞ SUNUCU (deploy/yeniden başlatma penceresi) — BİLDİRİLEN HATA
// ---------------------------------------------------------------------------
test('16. cache boşken /current: dürüst bekleme (200) + kimlik arşivden; "arşiv yok" YOK', async () => {
  wipeCache();
  const { status, body } = await get('/api/radar/current');
  assert.equal(status, 200);
  assert.equal(body.hasData, false);
  assert.equal(body.current, true);
  assert.equal(body.pending, true);
  assert.equal(body.roundId, R_CUR, 'güncel hafta kimliği kalıcı arşivden türetilir');
  assert.ok(body.note?.includes('bekleniyor'), 'dürüst bekleme notu');
  assert.ok(!JSON.stringify(body).includes('arşivi yok'), 'güncel haftada "arşiv yok" metni ASLA yer almaz');
});

test('17. cache boşken /weeks: güncel hafta yine current:true, archived:false', async () => {
  const { body } = await get('/api/radar/weeks');
  assert.equal(body.currentRoundId, R_CUR);
  const cur = body.weeks.find((w) => w.roundId === R_CUR);
  assert.equal(cur.current, true, 'cache silinse de güncel hafta işareti kaybolmaz');
  assert.equal(cur.archived, false);
});

test('18. BİLDİRİLEN HATA: cache boşken /api/radar/<güncel-id> 404 "arşivi yok" DÖNMEZ', async () => {
  const { status, body } = await get(`/api/radar/${R_CUR}`);
  assert.equal(status, 200, 'eski davranış 404 idi — güncel hafta legacy 404\'e düşürülmez');
  assert.equal(body.current, true);
  assert.equal(body.hasData, false);
  assert.ok(!JSON.stringify(body).includes('arşivi yok'));
});

test('19. cache boşken mühürlü geçmiş hafta yine okunur (arşiv cache\'e bağımlı değil)', async () => {
  const { status, body } = await get(`/api/radar/${R_SEALED}`);
  assert.equal(status, 200);
  assert.equal(body.sealed, true);
  assert.equal(body.hasData, true);
  assert.equal(body.matches.length, 15);
  // Grup A durumunu geri kur (dosya sonu — diğer test dosyaları etkilenmez).
  save('bulletin', makeBulletinData({ roundId: R_CUR, round: '49. Hafta' }));
});
