// SİNYAL KIRILIMI — saf modül testleri.
// Veritabanı yok: kurallar burada, sonuçları burada doğrulanır.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AZ_ORNEKLEM, oran, ortalamaAralik, hucre, sonHaftalar,
  siraBazliBasari, siraSonucDagilimi, sonucaGoreOynanma, benzerVakalar, tamKirilim,
} from '../src/analysis/sinyalKirilim.js';

// Kullanıcının yakaladığı gerçek örüntü, veri olarak:
// 1. sırada iki hafta üst üste ~%44/%30/%26 oynanma → ikisi de X.
const K = (roundId, no, sonuc, oynanma, ek = {}) => ({
  roundId, hafta: `${roundId - 1474}. Hafta`, no, sonuc, oynanma, ...ek,
});

const ORNEK = [
  K(1526, 1, 'X', { 1: 44, X: 30, 2: 26 }, { sinyal: 'X', home: 'Club Brugge', away: 'Union' }),
  K(1525, 1, 'X', { 1: 44, X: 29, 2: 27 }, { sinyal: 'X', home: 'AGF Aarhus', away: 'Brondby' }),
  K(1524, 1, '1', { 1: 58, X: 24, 2: 18 }, { sinyal: '1', home: 'A', away: 'B' }),
  K(1523, 1, '2', { 1: 30, X: 26, 2: 44 }, { sinyal: '1', home: 'C', away: 'D' }),
  K(1526, 2, '1', { 1: 51, X: 26, 2: 23 }, { sinyal: '2', home: 'E', away: 'F' }),
  K(1525, 2, '1', { 1: 49, X: 27, 2: 24 }, { sinyal: '1', home: 'G', away: 'H' }),
  // Sinyal üretmemiş maç — toplama GİRMEMELİ
  K(1524, 2, '2', { 1: 40, X: 30, 2: 30 }, { sinyal: null, home: 'I', away: 'J' }),
];

// ═══════════════ YARDIMCILAR ═══════════════

test('oran: payda 0 ise null — "%0" yazmak yalan olurdu', () => {
  assert.equal(oran(0, 0), null);
  assert.equal(oran(3, 4), 75);
  assert.equal(oran(1, 3), 33.3);
});

test('ortalamaAralik: ortalama TEK BAŞINA yeterli değil, aralık da döner', () => {
  const r = ortalamaAralik([44, 30]);
  assert.equal(r.ortalama, 37);
  assert.equal(r.enAz, 30);
  assert.equal(r.enCok, 44);
  assert.equal(r.adet, 2);
  // 37 hiçbir maçta görülmemiş bir değer — aralık bu yüzden şart.
  assert.equal(ortalamaAralik([]), null);
  assert.equal(ortalamaAralik([null, undefined, 'x']), null);
});

test('hucre: veri yoksa veriYok işaretlenir, oran null kalır', () => {
  const bos = hucre(0, 0);
  assert.equal(bos.veriYok, true);
  assert.equal(bos.oran, null);
  assert.equal(bos.azOrneklem, true);
  const dolu = hucre(7, 12);
  assert.equal(dolu.veriYok, false);
  assert.equal(dolu.oran, 58.3);
  assert.equal(dolu.azOrneklem, false, '12 maç az örneklem sayılmamalı');
  assert.equal(hucre(1, 1).azOrneklem, true, 'tek maç az örneklem olmalı');
});

test('sonHaftalar: MAÇ değil HAFTA sayar', () => {
  // 1526 ve 1525 = 2 hafta; içindeki maç sayısı önemli değil.
  const iki = sonHaftalar(ORNEK, 2);
  assert.deepEqual([...new Set(iki.map((k) => k.roundId))].sort(), [1525, 1526]);
  assert.equal(sonHaftalar(ORNEK, null).length, ORNEK.length, 'sınırsızda hepsi dönmeli');
  assert.equal(sonHaftalar(ORNEK, 0).length, ORNEK.length);
});

// ═══════════════ SIRA BAZLI BAŞARI ═══════════════

test('sıra bazlı: 15 satır döner, sinyalsiz maç TOPLAMA GİRMEZ', () => {
  const s = siraBazliBasari(ORNEK);
  assert.equal(s.length, 15);
  const sira2 = s.find((x) => x.no === 2);
  // 2. sırada 3 maç var ama biri sinyalsiz → toplam 2 olmalı.
  assert.equal(sira2.donem.tum.mac, 2, 'sinyalsiz maç toplama girmiş');
  assert.equal(sira2.donem.tum.dogru, 1, 'yalnız 1525 tutmuş olmalı');
});

test('sıra bazlı: 1. sırada 4 maçın 3ü tutmuş', () => {
  const s = siraBazliBasari(ORNEK);
  const sira1 = s.find((x) => x.no === 1);
  assert.equal(sira1.donem.tum.mac, 4);
  assert.equal(sira1.donem.tum.dogru, 3);
  assert.equal(sira1.donem.tum.oran, 75);
  assert.equal(sira1.donem.tum.azOrneklem, true, '4 maç az örneklem olmalı');
});

test('sıra bazlı: dönem penceresi gerçekten daraltıyor', () => {
  const s = siraBazliBasari(ORNEK, { donemler: { tum: null, son2: 2 } });
  const sira1 = s.find((x) => x.no === 1);
  assert.equal(sira1.donem.tum.mac, 4);
  assert.equal(sira1.donem.son2.mac, 2, 'son 2 hafta 2 maç olmalı');
  assert.equal(sira1.donem.son2.dogru, 2);
});

test('sıra bazlı: hiç maçı olmayan sıra veriYok döner, 0 başarı DEĞİL', () => {
  const s = siraBazliBasari(ORNEK);
  const sira9 = s.find((x) => x.no === 9);
  assert.equal(sira9.donem.tum.veriYok, true);
  assert.equal(sira9.donem.tum.oran, null, 'ölçüm yokken %0 yazılmış');
});

// ═══════════════ SIRA SONUÇ DAĞILIMI ═══════════════

test('sıra dağılımı: sinyalden BAĞIMSIZ, sonuçları sayar', () => {
  const d = siraSonucDagilimi(ORNEK);
  const sira1 = d.find((x) => x.no === 1);
  assert.equal(sira1.mac, 4);
  assert.equal(sira1.dagilim.X.adet, 2);
  assert.equal(sira1.dagilim['1'].adet, 1);
  assert.equal(sira1.dagilim['2'].adet, 1);
  assert.equal(sira1.dagilim.X.oran, 50);
  // 2. sırada sinyalsiz maç da SAYILIR (bu kırılım sinyale bakmaz)
  const sira2 = d.find((x) => x.no === 2);
  assert.equal(sira2.mac, 3);
});

// ═══════════════ SONUCA GÖRE OYNANMA ═══════════════

test('oynanma profili: 1. sırada X ile bitenlerin profili yakalanıyor', () => {
  const p = sonucaGoreOynanma(ORNEK, { no: 1 });
  const x = p.find((r) => r.sonuc === 'X');
  assert.equal(x.mac, 2);
  assert.equal(x.profil['1'].ortalama, 44, 'iki maçta da %44 ev oynanmış');
  assert.equal(x.profil.X.enAz, 29);
  assert.equal(x.profil.X.enCok, 30);
  assert.equal(x.azOrneklem, true, '2 maç az örneklem olmalı');
  assert.equal(x.maclar.length, 2, 'arkasındaki maçlar listelenmeli');
});

test('oynanma profili: veri olmayan hücre veriYok, profil null', () => {
  const p = sonucaGoreOynanma(ORNEK, { no: 2 });
  const iki = p.find((r) => r.sonuc === '2');
  // 2. sırada sonucu 2 olan tek maç var (sinyalsiz olan) → oynanması var
  assert.equal(iki.mac, 1);
  const x = p.find((r) => r.sonuc === 'X');
  assert.equal(x.mac, 0);
  assert.equal(x.veriYok, true);
  assert.equal(x.profil, null);
});

// ═══════════════ BENZERLİK ═══════════════

test('benzerlik: kullanıcının yakaladığı örüntüyü bulur', () => {
  // Bu haftanın 1. sırası %44/%30/%26 ise, geçmişte benzer iki maç var.
  const b = benzerVakalar(ORNEK, { 1: 44, X: 30, 2: 26 }, { no: 1, tolerans: 2 });
  assert.equal(b.mac, 2);
  assert.equal(b.dagilim.X.adet, 2, 'ikisi de X bitmiş olmalı');
  assert.equal(b.dagilim.X.oran, 100);
  assert.equal(b.azOrneklem, true, '2 maçtan %100 çıkarımı işaretlenmeli');
});

test('benzerlik: ÜÇ yüzde birden tutmalı — tek yüzde yeterli değil', () => {
  // %44 ev aynı ama X/2 dağılımı çok farklı bir maç eşleşmemeli.
  const kayitlar = [
    K(1520, 1, '1', { 1: 44, X: 10, 2: 46 }, { sinyal: '1' }),
    ...ORNEK,
  ];
  const b = benzerVakalar(kayitlar, { 1: 44, X: 30, 2: 26 }, { no: 1, tolerans: 2 });
  assert.equal(b.mac, 2, 'yalnız ev yüzdesi tutan maç yanlışlıkla eşleşti');
});

test('benzerlik: hedef yoksa veya eşleşme yoksa uydurma yapmaz', () => {
  assert.equal(benzerVakalar(ORNEK, null).veriYok, true);
  const b = benzerVakalar(ORNEK, { 1: 5, X: 5, 2: 90 }, { no: 1 });
  assert.equal(b.mac, 0);
  assert.equal(b.dagilim, null, 'eşleşme yokken dağılım uydurulmuş');
});

test('benzerlik: eksik oynanma verisi eşleşmeye SAYILMAZ', () => {
  const kayitlar = [...ORNEK, K(1519, 1, 'X', { 1: 44, X: null, 2: 26 }, { sinyal: 'X' })];
  const b = benzerVakalar(kayitlar, { 1: 44, X: 30, 2: 26 }, { no: 1, tolerans: 2 });
  assert.equal(b.mac, 2, 'eksik veriyle eşleşme yapılmış');
});

// ═══════════════ TAM KIRILIM ═══════════════

test('tamKirilim: genel özet sinyalsiz maçı ayrı sayar', () => {
  const t = tamKirilim(ORNEK);
  assert.equal(t.genel.toplamMac, 7);
  assert.equal(t.genel.sinyalsizMac, 1);
  assert.equal(t.genel.mac, 6, 'sinyalli maç sayısı');
  assert.equal(t.genel.dogru, 4);
  assert.equal(t.genel.hafta, 4);
  assert.equal(t.esik.azOrneklem, AZ_ORNEKLEM);
});

test('tamKirilim: boş girdide çökmez, her şey veriYok', () => {
  const t = tamKirilim([]);
  assert.equal(t.genel.veriYok, true);
  assert.equal(t.sira.length, 15);
  assert.equal(t.sira[0].donem.tum.veriYok, true);
});
