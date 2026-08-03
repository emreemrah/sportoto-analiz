// KAYNAK KODU — bahis sitesi kimliği API sınırında nötrlenir.
//
// Kullanıcıya görünen metinlerde marka adı zaten yoktu; bu testler ANAHTAR
// düzeyini korur: HTTP yanıtlarında 'nesine'/'misli' gibi kimlikler de
// geçmemeli (ağ trafiğine bakan biri markayı görebiliyordu).
//
// İç kimlik DEĞİŞMEZ: veritabanı, arşiv ve DNA eşleştirmesi ham kimlikle
// çalışır — veri göçü yok, geçmiş mühürler bozulmaz.
import test from 'node:test';
import assert from 'node:assert/strict';

const { kaynakKodu, kaynakId, anahtarlariKodla, KAYNAK_KODLARI } = await import('../src/providers/kaynakKodu.js');

test('kimlik → kod eşlemesi SABİT (renklerle hizalı: k1 sarı, k2 turuncu)', () => {
  assert.equal(kaynakKodu('nesine'), 'k1');
  assert.equal(kaynakKodu('misli'), 'k2');
  // Sabitlik şart: kod değişirse kullanıcının haftalar arası kıyası kayar.
  // k3 kaldırıldı: o sağlayıcı projeden tümüyle çıkarıldı (kullanıcı kararı).
  // Kalan kodlar KAYDIRILMADI — eski haftaların renkleri bozulmasın diye.
  assert.deepEqual(Object.keys(KAYNAK_KODLARI).sort(), ['iddaa', 'misli', 'nesine', 'oley']);
});

test('kaldırılan sağlayıcının ARŞİVDEKİ kayıtları ham adla sızmıyor', () => {
  // Geçmiş haftaların gözlemlerinde o kimlik hâlâ duruyor. Eşleme silindiği
  // için artık bilinmeyen sayılır ve tek kovaya (k0) düşer — ekranda adsız,
  // nötr bir kaynak olarak görünür. Ham marka adı yanıta ASLA çıkmaz.
  assert.equal(kaynakKodu('bilyoner'), 'k0');
});

test('bilinmeyen kimlik kod UYDURMAZ (tek kovaya düşer)', () => {
  // Yeni bir sağlayıcı eklenirse otomatik kod üretmek onu sessizce mevcut bir
  // kaynakla karıştırma riski taşırdı.
  assert.equal(kaynakKodu('yeni-site'), 'k0');
  assert.equal(kaynakKodu(null), 'k0');
});

test('kod → kimlik geri çevirir; eski istemcinin HAM kimliği de kabul edilir', () => {
  assert.equal(kaynakId('k1'), 'nesine');
  // Geriye uyumluluk: yeni sürüm yayılana dek eski istemci ham kimlik yollar.
  assert.equal(kaynakId('nesine'), 'nesine');
  // Tanınmayan kod kimlik UYDURMAZ.
  assert.equal(kaynakId('k9'), null);
  assert.equal(kaynakId(''), null);
  assert.equal(kaynakId(null), null);
});

test('anahtarlariKodla: nesne anahtarlarını koda çevirir, değerlere dokunmaz', () => {
  const girdi = { nesine: { pct: 62 }, misli: { pct: 58 } };
  assert.deepEqual(anahtarlariKodla(girdi), { k1: { pct: 62 }, k2: { pct: 58 } });
  assert.equal(anahtarlariKodla(null), null);
});

test('gidiş-dönüş kayıpsız: kimlik → kod → kimlik', () => {
  for (const id of Object.keys(KAYNAK_KODLARI)) {
    assert.equal(kaynakId(kaynakKodu(id)), id, `${id} gidiş-dönüşte kaymamalı`);
  }
});

// --- UÇ TARAMASI: yanıtlarda marka adı GEÇMEZ ------------------------------
test('radar uçlarının yanıtlarında bahis sitesi adı/kimliği GEÇMEZ', async () => {
  const express = (await import('express')).default;
  const router = (await import('../src/routes/radar.js')).default;
  const app = express();
  app.use('/api/radar', router);
  const srv = app.listen(0);
  const p = srv.address().port;
  const MARKA = /nesine|bilyoner|misli|oley|iddaa/i;
  const yollar = [
    '/api/radar/current',
    '/api/radar/daily-played',
    '/api/radar/daily-odds',
    '/api/radar/played-dna?no=1&source=k1&day=2026-08-02',
    '/api/radar/weeks',
  ];
  try {
    for (const yol of yollar) {
      const metin = await (await fetch(`http://127.0.0.1:${p}${yol}`)).text();
      assert.doesNotMatch(metin, MARKA, `${yol} yanıtında marka geçemez`);
    }
  } finally {
    srv.close();
  }
});
