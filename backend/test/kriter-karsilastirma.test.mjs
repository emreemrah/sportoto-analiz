// ---------------------------------------------------------------------------
// KRİTER KARŞILAŞTIRMA — saf modül testleri (2026-08-07)
// ---------------------------------------------------------------------------
// Kullanıcının anlattığı ihtiyaç: "Claude kod yazmada iyi, ChatGPT dikte ve
// resimde. Derdimiz maç değil, kriterin kendisi." Yani her İŞ için hangi
// kriterin iyi olduğu.
//
// Bu testlerin asıl işi, sıralamanın KÜÇÜK ÖRNEKLEMLE KANDIRILMAMASI ve
// yetersiz veriyle "uzman" ilan edilmemesidir. Bir kriteri yanlışlıkla uzman
// ilan etmek, hiç sıralama yapmamaktan daha zararlıdır.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  kriterKarsilastirma, altSinir, ISLER, UZMANLIK_MIN_MAC,
} from '../src/analysis/kriterKarsilastirma.js';

const AGIR = { home: 1.30, draw: 5.0, away: 9.0 };   // ağır favori (1)
const ACIK = { home: 3.10, draw: 3.40, away: 2.95 }; // açık/zor (favori 2)

const mac = (o) => ({ no: 1, roundId: 1500, sonuc: '1', sinyal: '1', oran: null, oynanma: null, ...o });

/** n maç üret: k tanesi doğru. */
function seri(n, k, ortak) {
  return Array.from({ length: n }, (_, i) => mac({ ...ortak, sonuc: i < k ? ortak.sinyal : (ortak.sinyal === '1' ? '2' : '1') }));
}

test('altSinir: küçük örneklemi cezalandırır — %100 her zaman kazanmaz', () => {
  const kucuk = altSinir(3, 3);      // 3 maçta 3
  const buyuk = altSinir(14, 20);    // 20 maçta 14
  assert.ok(kucuk < buyuk, `3/3 (%100) sıralamada 14/20'nin ÜSTÜNE çıkmamalı (${kucuk} < ${buyuk})`);
  assert.equal(altSinir(0, 0), -1, 'ölçüm yoksa sıralamaya girmez');
});

test('iş listesi maç tipi, kalabalık, yön, uyum ve sırayı kapsar', () => {
  const gruplar = new Set(ISLER.map((x) => x.grup));
  for (const g of ['Maç tipi', 'Kalabalık profili', 'Söylenen yön', 'Kalabalıkla ilişki', 'Bülten sırası']) {
    assert.ok(gruplar.has(g), `${g} işleri eksik`);
  }
});

// ——— ASIL SORU: hangi iş için hangi kriter ———
test('her iş için ayrı lider çıkar — biri favoride, diğeri açık maçta usta', () => {
  const byKey = new Map([
    // A: ağır favoride çok iyi (10/12), açık maçta kötü (2/10)
    ['a', [...seri(12, 10, { sinyal: '1', oran: AGIR }), ...seri(10, 2, { sinyal: '1', oran: ACIK })]],
    // B: ağır favoride kötü (4/12), açık maçta iyi (8/10)
    ['b', [...seri(12, 4, { sinyal: '1', oran: AGIR }), ...seri(10, 8, { sinyal: '1', oran: ACIK })]],
  ]);
  const adlar = new Map([['a', 'Kriter A'], ['b', 'Kriter B']]);
  const r = kriterKarsilastirma(byKey, adlar);

  const agir = r.isler.find((x) => x.ad === 'macTipi:agirFavori');
  const acik = r.isler.find((x) => x.ad === 'macTipi:acik');
  assert.equal(agir.siralama[0].key, 'a', 'ağır favoride A önde olmalı');
  assert.equal(acik.siralama[0].key, 'b', 'açık maçta B önde olmalı');

  // Genel ortalama ikisini de gizler: iki kriter de 22 maçta 12 doğru.
  const genelA = r.kriterler.find((x) => x.key === 'a');
  const genelB = r.kriterler.find((x) => x.key === 'b');
  assert.equal(genelA.oran, genelB.oran, 'genel ortalamalar aynı — fark yalnız işlerde görünür');
});

test('kriter özeti uzmanlık ve zayıf alanı işaretler', () => {
  const byKey = new Map([
    ['a', [...seri(12, 11, { sinyal: '1', oran: AGIR }), ...seri(12, 3, { sinyal: '1', oran: ACIK })]],
  ]);
  const r = kriterKarsilastirma(new Map(byKey), new Map([['a', 'Kriter A']]));
  const k = r.kriterler.find((x) => x.key === 'a');
  assert.ok(k.uzmanlik, 'uzmanlık bulunmalıydı');
  assert.equal(k.uzmanlik.is, 'macTipi:agirFavori');
  assert.ok(k.zayif);
  assert.ok(k.uzmanlik.guven > k.zayif.guven);
});

// EN ÖNEMLİ KORUMA: yetersiz veriyle "uzman" ilan edilmez.
test('eşiğin altında UZMAN İLAN EDİLMEZ (null döner, uydurulmaz)', () => {
  const byKey = new Map([['a', seri(3, 3, { sinyal: '1', oran: AGIR })]]);
  const r = kriterKarsilastirma(byKey, new Map());
  const k = r.kriterler.find((x) => x.key === 'a');
  assert.equal(k.mac, 3);
  assert.equal(k.oran, 100);
  assert.equal(k.uzmanlik, null, `${UZMANLIK_MIN_MAC} maçın altında uzmanlık ilan edilemez`);
  // Ama satır listeden ATILMAZ — bilgi saklamak da yanıltmaktır.
  const agir = r.isler.find((x) => x.ad === 'macTipi:agirFavori');
  assert.equal(agir.siralama.length, 1);
  assert.equal(agir.siralama[0].azOrneklem, true);
  assert.equal(agir.siralama[0].yeterli, false);
});

test('işe hiç girmemiş kriter o sıralamada YOK (sıfır olarak sayılmaz)', () => {
  const byKey = new Map([
    ['a', seri(6, 4, { sinyal: '1', oran: AGIR })],
    ['b', seri(6, 4, { sinyal: '1', oran: ACIK })],
  ]);
  const r = kriterKarsilastirma(byKey, new Map());
  const agir = r.isler.find((x) => x.ad === 'macTipi:agirFavori');
  assert.deepEqual(agir.siralama.map((x) => x.key), ['a']);
});

test('oran/oynanma verisi olmayan maç hiçbir bant işine girmez', () => {
  const byKey = new Map([['a', seri(6, 5, { sinyal: '1' })]]);   // oran ve oynanma yok
  const r = kriterKarsilastirma(byKey, new Map());
  for (const is of r.isler) {
    if (is.grup === 'Maç tipi' || is.grup === 'Kalabalık profili' || is.grup === 'Kalabalıkla ilişki') {
      assert.equal(is.siralama.length, 0, `${is.ad}: verisiz maç işe sokulmuş`);
    }
  }
  // Yön ve sıra işleri veri gerektirmez; oralarda görünmeli.
  assert.equal(r.isler.find((x) => x.ad === 'yon:1').siralama.length, 1);
});

test('az veride uyarı "KANIT DEĞİL" der ve uzmanlık eşiğini söyler', () => {
  const r = kriterKarsilastirma(new Map([['a', seri(6, 4, { sinyal: '1' })]]), new Map());
  assert.match(r.uyari, /KANIT DEĞİL/);
  assert.match(r.uyari, new RegExp(String(UZMANLIK_MIN_MAC)));
  const bos = kriterKarsilastirma(new Map(), new Map());
  assert.match(bos.uyari, /karşılaştırılamaz/);
});
