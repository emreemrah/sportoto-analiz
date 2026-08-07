// ---------------------------------------------------------------------------
// KRİTER KIRILIMI — saf modül testleri (2026-08-07)
// ---------------------------------------------------------------------------
// Kullanıcının teşhisi: "bu kriter %58 diyor ama favori maçlarda mı, zor
// maçlarda mı belli değil — yanıltıcı oluyor." Bu testler, kırılımın o
// yanıltmayı GERÇEKTEN açtığını ve açarken yeni bir yalan üretmediğini ölçer.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  kriterKirilimi, macTipi, kalabalikProfili, kalabaliginFavorisi, piyasaninFavorisi,
  AZ_ORNEKLEM,
} from '../src/analysis/kriterKirilim.js';

const mac = (o) => ({
  no: 1, sonuc: '1', sinyal: '1', oynanma: null, oran: null, roundId: 1500, ...o,
});

// ——— BANTLAR ———
test('macTipi: en düşük orana göre sınıflar; oran yoksa null (uydurmaz)', () => {
  assert.equal(macTipi({ home: 1.25, draw: 5.5, away: 9.0 }), 'agirFavori');
  assert.equal(macTipi({ home: 1.85, draw: 3.6, away: 4.2 }), 'favori');
  assert.equal(macTipi({ home: 2.40, draw: 3.2, away: 2.9 }), 'denk');
  assert.equal(macTipi({ home: 3.10, draw: 3.4, away: 2.95 }), 'acik');
  assert.equal(macTipi(null), null);
  assert.equal(macTipi({ home: 1.5 }), null, 'eksik oran seti banda sokulmamalı');
});

// EN KRİTİK TUZAK: Number(null) === 0. Oran/oynanma yoksa "0" sanılıp
// en düşük banda düşerse tüm tablo bozulur ve kimse fark etmez.
test('eksik veri sıfır sayılmaz: null oran/oynanma banda sokulmaz', () => {
  assert.equal(macTipi({ home: null, draw: null, away: null }), null);
  assert.equal(kalabalikProfili({ 1: null, X: null, 2: null }), null);
  assert.equal(kalabaliginFavorisi({ 1: 50, X: null, 2: 20 }), null);
  assert.equal(piyasaninFavorisi({ home: 1.5, draw: null, away: 4 }), null);
});

test('kalabalikProfili: en yüksek oynanma payına göre sınıflar', () => {
  assert.equal(kalabalikProfili({ 1: 78, X: 14, 2: 8 }), 'cokEmin');
  assert.equal(kalabalikProfili({ 1: 60, X: 25, 2: 15 }), 'kararli');
  assert.equal(kalabalikProfili({ 1: 45, X: 30, 2: 25 }), 'bolunmus');
  assert.equal(kalabalikProfili({ 1: 38, X: 33, 2: 29 }), 'dagimik');
});

// ——— ASIL SORU: ortalama neyi gizliyor ———
test('ortalamanın gizlediğini açar: ağır favoride iyi, açık maçta kötü', () => {
  const kayitlar = [
    // Ağır favorili 6 maç: 5 doğru
    ...Array.from({ length: 5 }, () => mac({ oran: { home: 1.30, draw: 5, away: 8 }, sonuc: '1', sinyal: '1' })),
    mac({ oran: { home: 1.30, draw: 5, away: 8 }, sonuc: 'X', sinyal: '1' }),
    // Açık 6 maç: 1 doğru
    mac({ oran: { home: 3.0, draw: 3.3, away: 2.9 }, sonuc: '1', sinyal: '1' }),
    ...Array.from({ length: 5 }, () => mac({ oran: { home: 3.0, draw: 3.3, away: 2.9 }, sonuc: '2', sinyal: '1' })),
  ];
  const r = kriterKirilimi(kayitlar);
  assert.equal(r.genel.mac, 12);
  assert.equal(r.genel.oran, 50, 'ortalama %50 — iki gerçeği de gizliyor');

  const agir = r.macTipleri.satirlar.find((x) => x.ad === 'agirFavori');
  const acik = r.macTipleri.satirlar.find((x) => x.ad === 'acik');
  assert.equal(agir.mac, 6);
  assert.equal(agir.oran, 83.3);
  assert.equal(acik.mac, 6);
  assert.equal(acik.oran, 16.7);
});

// ——— EN DEĞERLİ EKSEN: kalabalığa ters düştüğünde ne oluyor ———
test('kalabalıkla uyum ayrı ölçülür: favoriyi tekrar etmek ile ters düşmek karışmaz', () => {
  const kayitlar = [
    // Kalabalıkla AYNI (fav '1', sinyal '1') — 4 maç, 3 doğru
    ...Array.from({ length: 3 }, () => mac({ oynanma: { 1: 70, X: 20, 2: 10 }, sinyal: '1', sonuc: '1' })),
    mac({ oynanma: { 1: 70, X: 20, 2: 10 }, sinyal: '1', sonuc: '2' }),
    // Kalabalığa TERS (fav '1', sinyal '2') — 4 maç, 3 doğru
    ...Array.from({ length: 3 }, () => mac({ oynanma: { 1: 68, X: 20, 2: 12 }, sinyal: '2', sonuc: '2' })),
    mac({ oynanma: { 1: 68, X: 20, 2: 12 }, sinyal: '2', sonuc: '1' }),
  ];
  const r = kriterKirilimi(kayitlar);
  const ayni = r.kalabalikUyumu.satirlar.find((x) => x.ad === 'ayni');
  const ters = r.kalabalikUyumu.satirlar.find((x) => x.ad === 'ters');
  assert.equal(ayni.mac, 4);
  assert.equal(ters.mac, 4);
  assert.equal(ters.oran, 75, 'ters düştüğünde de %75 — asıl katkı bu');
});

test('veri olmayan maçlar "bilinmiyor"a düşer, banda ZORLANMAZ', () => {
  const kayitlar = [
    mac({ oran: { home: 1.3, draw: 5, away: 8 } }),
    mac({ oran: null }),
    mac({ oran: null }),
  ];
  const r = kriterKirilimi(kayitlar);
  assert.equal(r.macTipleri.bilinmiyor.mac, 2);
  const toplam = r.macTipleri.satirlar.reduce((s, x) => s + x.mac, 0) + r.macTipleri.bilinmiyor.mac;
  assert.equal(toplam, 3, 'hiçbir maç kaybolmamalı ya da iki kez sayılmamalı');
});

test('boş hücre %0 DEĞİL null döner ve az örneklem işaretlenir', () => {
  const r = kriterKirilimi([mac({ oran: { home: 1.3, draw: 5, away: 8 } })]);
  const denk = r.macTipleri.satirlar.find((x) => x.ad === 'denk');
  assert.equal(denk.mac, 0);
  assert.equal(denk.oran, null, 'ölçüm yok ile %0 aynı şey değildir');
  assert.equal(denk.veriYok, true);
  const agir = r.macTipleri.satirlar.find((x) => x.ad === 'agirFavori');
  assert.equal(agir.azOrneklem, true, `${AZ_ORNEKLEM} altı işaretlenmeli`);
});

test('yön söylemeyen maç ölçüme girmez (başarısız sayılmaz)', () => {
  const r = kriterKirilimi([mac({ sinyal: null }), mac({ sinyal: '1', sonuc: '1' })]);
  assert.equal(r.olculebilirMac, 1);
  assert.equal(r.genel.mac, 1);
});

test('az veriyle uyarı açıkça "kanıt değildir" der', () => {
  const r = kriterKirilimi([mac(), mac()]);
  assert.match(r.uyari, /KANIT DEĞİLDİR/);
  const bos = kriterKirilimi([]);
  assert.match(bos.uyari, /hesaplanamaz/);
});

// ---------------------------------------------------------------------------
// MAÇ LİSTESİ — "9 maçta 6 doğru" satırının arkasındaki maçlar
// ---------------------------------------------------------------------------
// Kullanıcı bildirimi (7 Ağustos): "kriterin başarılı/başarısız olduğu maçları
// görüyorum ama bu maçlar favori miydi sürpriz miydi, oynanma yüzdesi, oranı,
// bülten sırası neydi — bunları da görmem lazım."
//
// Bu testlerin işi, listenin ÖZETLE ÇELİŞMEMESİ. Liste ile bant sayıları
// ayrışırsa hangisinin doğru olduğu bilinemez ve ikisi de güvenilmez olur.
test('maç listesi: her satır sıra, oran, oynanma, favori/sürpriz etiketi taşır', () => {
  const r = kriterKirilimi([
    mac({
      no: 7, home: 'A', away: 'B', sinyal: '1', sonuc: '2', skor: '0-2',
      oran: { home: 1.35, draw: 4.8, away: 8.0 },
      oynanma: { 1: 74, X: 16, 2: 10 },
    }),
  ]);
  const m = r.maclar[0];
  assert.equal(m.no, 7);
  assert.equal(m.ev, 'A');
  assert.equal(m.deplasman, 'B');
  assert.equal(m.favoriOrani, 1.35);
  assert.equal(m.piyasaFavorisi, '1');
  assert.equal(m.kalabalikFavorisi, '1');
  assert.equal(m.kalabalikPayi, 74);
  assert.equal(m.macTipi, 'agirFavori');
  assert.equal(m.kalabalikProfili, 'cokEmin');
  assert.equal(m.dogru, false);
  // Favori 1'di, sonuç 2 → SÜRPRİZ.
  assert.equal(m.surprizPiyasa, true);
  assert.equal(m.surprizKalabalik, true);
  assert.equal(m.kriterKalabalikla, 'ayni');
});

test('sürpriz etiketi favori bilinmiyorsa UYDURULMAZ (null)', () => {
  const r = kriterKirilimi([mac({ oran: null, oynanma: null })]);
  assert.equal(r.maclar[0].surprizPiyasa, null);
  assert.equal(r.maclar[0].surprizKalabalik, null);
  assert.equal(r.maclar[0].macTipi, null);
});

// EN ÖNEMLİ: liste ile bant sayıları AYNI kaynaktan gelmeli.
test('liste ile bant sayıları çelişmez', () => {
  const kayitlar = [
    ...Array.from({ length: 4 }, (_, i) => mac({
      no: i + 1, oran: { home: 1.30, draw: 5, away: 9 }, sinyal: '1', sonuc: '1',
    })),
    ...Array.from({ length: 3 }, (_, i) => mac({
      no: i + 6, oran: { home: 3.1, draw: 3.3, away: 2.9 }, sinyal: '1', sonuc: '2',
    })),
  ];
  const r = kriterKirilimi(kayitlar);
  for (const bant of r.macTipleri.satirlar) {
    const listeden = r.maclar.filter((m) => m.macTipi === bant.ad);
    assert.equal(listeden.length, bant.mac, `${bant.ad}: liste ${listeden.length} ≠ özet ${bant.mac}`);
    assert.equal(listeden.filter((m) => m.dogru).length, bant.dogru, `${bant.ad}: doğru sayısı çelişiyor`);
  }
});

test('liste en yeni haftadan başlar ve yön söylemeyen maç listeye girmez', () => {
  const r = kriterKirilimi([
    mac({ roundId: 1500, no: 3 }),
    mac({ roundId: 1526, no: 9 }),
    mac({ roundId: 1526, no: 2, sinyal: null }),
  ]);
  assert.equal(r.maclar.length, 2);
  assert.equal(r.maclar[0].roundId, 1526);
  assert.equal(r.toplam, 2);
});
