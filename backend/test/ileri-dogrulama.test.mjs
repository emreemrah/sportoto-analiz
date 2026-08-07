// ---------------------------------------------------------------------------
// İLERİ-DOĞRULAMA — saf modül testleri (2026-08-07)
// ---------------------------------------------------------------------------
// Bu testlerin asıl işi, aracın KENDİNİ DOĞRULAMASINI engellemektir:
// örüntü yalnız eski haftalarda aranmalı, sınav haftası taramaya sızmamalıdır.
// Sızarsa her örüntü "tuttu" görünür ve sayı yalan olur.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ileriDogrula, MIN_HAFTA } from '../src/analysis/oruntuTarayici.js';

/** roundId'si verilen haftada, `no` sırasında, `sonuc` ile biten maçlar. */
function mac(roundId, no, sonuc, n = 1) {
  return Array.from({ length: n }, () => ({ roundId, no, sonuc, oynanma: null, sinyal: null }));
}

test('veri yetmiyorsa sonuç UYDURULMAZ, eksik olduğu söylenir', () => {
  const r = ileriDogrula([...mac(1, 3, '1', 10), ...mac(2, 3, '1', 10)]);
  assert.equal(r.yeterli, false);
  assert.equal(r.hafta, 2);
  assert.equal(r.gerekenHafta, MIN_HAFTA);
  assert.equal(r.bulgular.length, 0);
  assert.match(r.sebep, /kendini doğrulayan/);
});

test('örüntü YALNIZ eğitim haftalarında aranır — sınav haftası taramaya girmez', () => {
  // 1. ve 2. hafta: 3. sırada hep "1". 3. hafta (sınav): 3. sırada hep "2".
  // Sınav verisi taramaya sızsaydı grup karışır ve örüntü hiç bulunamazdı.
  const kayitlar = [
    ...mac(1, 3, '1', 5), ...mac(2, 3, '1', 5), ...mac(3, 3, '2', 5),
    ...mac(1, 8, '2', 5), ...mac(2, 8, '2', 5), ...mac(3, 8, '2', 5),
  ];
  const r = ileriDogrula(kayitlar, { testHafta: 1, minOrneklem: 6, minSapma: 5 });
  assert.equal(r.yeterli, true);
  assert.equal(r.egitimHafta, 2);
  assert.equal(r.sinavHafta, 1);
  assert.deepEqual(r.sinavHaftaListesi, [3]);

  const b = r.bulgular.find((x) => x.kural === '3. sıra');
  assert.ok(b, 'eğitimde 3. sıra örüntüsü bulunmalıydı');
  assert.equal(b.sonuc, '1', 'eğitimde baskın sonuç 1 olmalı');
});

// EN ÖNEMLİ TEST: geçmişte mükemmel, gelecekte çöken örüntü İFŞA EDİLMELİ.
test('eğitimde %100 olan örüntü sınavda çökerse "tutmadı" yazar', () => {
  const kayitlar = [
    ...mac(1, 3, '1', 5), ...mac(2, 3, '1', 5), ...mac(3, 3, '2', 5),
    ...mac(1, 8, '2', 5), ...mac(2, 8, '2', 5), ...mac(3, 8, '2', 5),
  ];
  const r = ileriDogrula(kayitlar, { testHafta: 1, minOrneklem: 6, minSapma: 5 });
  const b = r.bulgular.find((x) => x.kural === '3. sıra');
  assert.equal(b.pay, 100, 'eğitimde %100 görünmeli');
  assert.equal(b.sinav.mac, 5);
  assert.equal(b.sinav.isabet, 0, 'sınavda hiç tutmamalı');
  assert.equal(b.sinav.oran, 0);
  assert.equal(b.sinav.sonuc, 'tutmadı');
});

test('gerçekten süren örüntü sınavda "tuttu" yazar', () => {
  const kayitlar = [
    ...mac(1, 3, '1', 5), ...mac(2, 3, '1', 5), ...mac(3, 3, '1', 5),
    ...mac(1, 8, '2', 5), ...mac(2, 8, '2', 5), ...mac(3, 8, '2', 5),
  ];
  const r = ileriDogrula(kayitlar, { testHafta: 1, minOrneklem: 6, minSapma: 5 });
  const b = r.bulgular.find((x) => x.kural === '3. sıra');
  assert.equal(b.sinav.isabet, 5);
  assert.equal(b.sinav.sonuc, 'tuttu');
});

test('sınavda o kurala hiç maç düşmediyse "tuttu/tutmadı" DENMEZ', () => {
  const kayitlar = [
    ...mac(1, 3, '1', 5), ...mac(2, 3, '1', 5),
    ...mac(1, 8, '2', 5), ...mac(2, 8, '2', 5),
    ...mac(3, 11, 'X', 5),   // sınav haftasında 3. ve 8. sıra maçı yok
  ];
  const r = ileriDogrula(kayitlar, { testHafta: 1, minOrneklem: 6, minSapma: 5 });
  const b = r.bulgular.find((x) => x.kural === '3. sıra');
  assert.equal(b.sinav.mac, 0);
  assert.equal(b.sinav.oran, null);
  assert.equal(b.sinav.sonuc, 'veri yok');
});
