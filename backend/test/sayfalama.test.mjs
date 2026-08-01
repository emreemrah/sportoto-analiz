// SUPABASE SAYFALAMA TESTLERİ.
//
// NEDEN VAR: PostgREST bir istekte en çok 1000 satır döndürür ve sınıra
// çarptığında HATA VERMEZ. Gerçek olay: Radar 5 sıra yüzdeleri 2250 satırlık
// arşivin ilk 1000'inden hesaplanıyordu; ekranda "2025/2026 · 44 hafta"
// yazıyordu, oysa o sezonda 52 hafta oynanmıştı. Sessiz olduğu için hiçbir
// test, hiçbir log bunu yakalamamıştı — bu dosya o boşluğu kapatır.
import test from 'node:test';
import assert from 'node:assert/strict';

const { tumSatirlar, SAYFA_BOYU } = await import('../src/db/sayfala.js');

// PostgREST'i taklit eden sahte sorgu: .range(bas, son) verilen aralığı döner,
// ama en çok SINIR satır — gerçek db-max-rows davranışı.
function sahteSorgu(toplam, { sinir = SAYFA_BOYU, kayit = [] } = {}) {
  const tumu = Array.from({ length: toplam }, (_, i) => ({ id: i }));
  return () => ({
    range(bas, son) {
      kayit.push([bas, son]);
      const istenen = son - bas + 1;
      const dilim = tumu.slice(bas, bas + Math.min(istenen, sinir));
      return Promise.resolve({ data: dilim, error: null });
    },
  });
}

test('1000 satırdan fazlası TAM okunur (sessiz kırpma yok)', async () => {
  const satirlar = await tumSatirlar(sahteSorgu(2250));
  assert.equal(satirlar.length, 2250, 'arşivin tamamı gelmeli');
  // Sıra korunur: sayfalar birleştirilirken karışmamalı.
  assert.equal(satirlar[0].id, 0);
  assert.equal(satirlar[2249].id, 2249);
  // Aynı satır iki kez gelmemeli.
  assert.equal(new Set(satirlar.map((r) => r.id)).size, 2250);
});

test('tam sayfa sınırında (tam 2000 satır) fazladan tur atılır, veri kaybolmaz', async () => {
  // 2000 satır iki tam sayfadır; "kısa sayfa" hiç gelmez. Döngü burada
  // durursa sorun yok, ama durmadan önce üçüncü bir istek atmalı — yoksa
  // 2001. satır varsa kaybedilir.
  const kayit = [];
  const satirlar = await tumSatirlar(sahteSorgu(2000, { kayit }));
  assert.equal(satirlar.length, 2000);
  assert.equal(kayit.length, 3, 'son boş sayfa da istenmeli');
});

test('tek sayfalık veride tek istek yapılır', async () => {
  const kayit = [];
  const satirlar = await tumSatirlar(sahteSorgu(150, { kayit }));
  assert.equal(satirlar.length, 150);
  assert.equal(kayit.length, 1, 'gereksiz ikinci istek atılmamalı');
});

test('boş tabloda boş dizi döner, patlamaz', async () => {
  assert.deepEqual(await tumSatirlar(sahteSorgu(0)), []);
});

test('hata YUTULMAZ — eksik veri sessizce "hepsi" sayılamaz', async () => {
  const patlayan = () => ({ range: async () => ({ data: null, error: { message: 'bağlantı koptu' } }) });
  await assert.rejects(() => tumSatirlar(patlayan), /bağlantı koptu/);
});

test('güvenlik sınırı: sonsuz döngüye girilmez', async () => {
  // Hiç kısalmayan sayfa döndüren bozuk bir uç: döngü durmalı ve
  // SESSİZCE devam etmek yerine HATA vermeli.
  const bitmeyen = () => ({
    range: async (bas, son) => ({
      data: Array.from({ length: son - bas + 1 }, (_, i) => ({ id: bas + i })), error: null,
    }),
  });
  await assert.rejects(() => tumSatirlar(bitmeyen, { enCok: 5000 }), /güvenlik sınırı/);
});

test('her sayfa için YENİ sorgu kurulur (kurucular tek kullanımlıktır)', async () => {
  // Supabase sorgu kurucuları yeniden kullanılamaz; aynı nesne ikinci kez
  // .range() ile çağrılırsa üretimde hata verir. Yardımcı her turda
  // fabrikayı yeniden çağırmalı.
  let kurulan = 0;
  const tumu = Array.from({ length: 1500 }, (_, i) => ({ id: i }));
  const fabrika = () => {
    kurulan += 1;
    return { range: async (bas, son) => ({ data: tumu.slice(bas, son + 1), error: null }) };
  };
  await tumSatirlar(fabrika);
  assert.equal(kurulan, 2, 'iki sayfa → iki ayrı sorgu kurucusu');
});
