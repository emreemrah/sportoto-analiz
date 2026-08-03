// SIRA GEÇMİŞİNDE OYNANMA YÜZDESİ — Radar 5 listesinin altına düşen değer.
//
// KURAL: her (tur, sıra) için o haftanın SON kayıtlı gününün yüzdesi alınır
// (pencerenin Cuma'sı). Kullanıcı isteği buydu ve maçlara en yakın, oturmuş
// değer odur.
//
// EN ÖNEMLİ TEST BURADA: veri YOKSA satır BOŞ döner. Oynanma arşivi 51. haftada
// başladığı için geçmiş satırların çoğunda yüzde YOKTUR; sessizce 0 ya da
// "ortalama" basmak, kullanıcıya olmayan bir bilgiyi gerçek gibi gösterir.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sonGunOynanmaIndeksi, oynanmaEkle, eskiHaftalariAt, LISTE_BASLANGIC_ROUND_ID,
} from '../src/radar/siraOynanma.js';
import { DNA_START_ROUND_ID } from '../src/radar/playedDnaArchive.js';

const kayit = (o) => ({ source: 'nesine', roundId: 1526, position: 1, dayKey: '2026-07-31', pct: { '1': 50, X: 30, '2': 20 }, ...o });

test('haftanın SON günü seçilir (pazar değil, cuma)', () => {
  const ix = sonGunOynanmaIndeksi([
    kayit({ dayKey: '2026-07-26', pct: { '1': 40, X: 35, '2': 25 } }),
    kayit({ dayKey: '2026-07-31', pct: { '1': 64, X: 22, '2': 14 } }),
    kayit({ dayKey: '2026-07-28', pct: { '1': 55, X: 30, '2': 15 } }),
  ]);
  const s = ix.get('1526|1');
  assert.equal(s.gun, '2026-07-31');
  assert.deepEqual(s.pct, { '1': 64, X: 22, '2': 14 });
  assert.equal(s.favori, '1');
  assert.equal(s.favoriPct, 64);
});

test('gün anahtarı METİN olarak kıyaslanır ama tarih sırası bozulmaz (ay atlaması)', () => {
  // '2026-08-01' > '2026-07-31' metin olarak da doğru. Kural bunu bağlar.
  const ix = sonGunOynanmaIndeksi([
    kayit({ dayKey: '2026-08-01', pct: { '1': 70, X: 20, '2': 10 } }),
    kayit({ dayKey: '2026-07-31', pct: { '1': 30, X: 40, '2': 30 } }),
  ]);
  assert.equal(ix.get('1526|1').gun, '2026-08-01');
});

test('her sıra ve her tur AYRI tutulur (karışmaz)', () => {
  const ix = sonGunOynanmaIndeksi([
    kayit({ roundId: 1526, position: 1, pct: { '1': 60, X: 25, '2': 15 } }),
    kayit({ roundId: 1526, position: 2, pct: { '1': 20, X: 30, '2': 50 } }),
    kayit({ roundId: 1525, position: 1, dayKey: '2026-07-24', pct: { '1': 45, X: 30, '2': 25 } }),
  ]);
  assert.equal(ix.get('1526|1').favoriPct, 60);
  assert.equal(ix.get('1526|2').favori, '2');
  assert.equal(ix.get('1525|1').gun, '2026-07-24');
});

test('yalnız istenen kaynak sayılır', () => {
  const ix = sonGunOynanmaIndeksi([
    kayit({ source: 'baska', pct: { '1': 99, X: 1, '2': 0 } }),
    kayit({ pct: { '1': 50, X: 30, '2': 20 } }),
  ]);
  assert.equal(ix.size, 1);
  assert.equal(ix.get('1526|1').favoriPct, 50);
});

test('0-1 ölçeği yüzdeye çevrilir', () => {
  const ix = sonGunOynanmaIndeksi([kayit({ pct: { '1': 0.64, X: 0.22, '2': 0.14 } })]);
  assert.deepEqual(ix.get('1526|1').pct, { '1': 64, X: 22, '2': 14 });
});

test('EKSİK seçenek satırı düşürür — Number(null)=0 tuzağı', () => {
  // null geçerse toplam 50+30=80 çıkar, üst sınıra yakın olduğu için "geçerli"
  // sayılıp X=%0 diye gösterilirdi. Olmayan veri gerçek gibi görünemez.
  const ix = sonGunOynanmaIndeksi([kayit({ pct: { '1': 50, X: null, '2': 30 } })]);
  assert.equal(ix.size, 0);
  assert.equal(sonGunOynanmaIndeksi([kayit({ pct: { '1': 50, X: '', '2': 30 } })]).size, 0);
  assert.equal(sonGunOynanmaIndeksi([kayit({ pct: { '1': 50, X: -5, '2': 55 } })]).size, 0);
  assert.equal(sonGunOynanmaIndeksi([kayit({ pct: { '1': 10, X: 10, '2': 10 } })]).size, 0, 'toplam 30 — bozuk kayıt kabul edildi');
});

test('sırası bilinmeyen kayıt atılır', () => {
  assert.equal(sonGunOynanmaIndeksi([kayit({ position: null })]).size, 0);
  assert.equal(sonGunOynanmaIndeksi([kayit({ dayKey: null })]).size, 0);
});

test('VERİ YOKSA satır boş döner — uydurulmaz', () => {
  const ix = sonGunOynanmaIndeksi([kayit({ roundId: 1526 })]);
  const { matches, yuzdeliSayi } = oynanmaEkle([
    { roundId: 1526, home: 'A', away: 'B', result: '1' },
    { roundId: 1400, home: 'C', away: 'D', result: 'X' },   // arşiv öncesi
  ], ix, 1);
  assert.equal(yuzdeliSayi, 1);
  assert.deepEqual(matches[0].played.pct, { '1': 50, X: 30, '2': 20 });
  assert.equal(matches[1].played, null, 'arşivde olmayan maça yüzde uydurulmuş');
});

test('mevcut maç alanları KORUNUR', () => {
  const { matches } = oynanmaEkle([{ roundId: 1526, home: 'A', away: 'B', result: '1', score: '2-0' }], sonGunOynanmaIndeksi([kayit()]), 1);
  assert.equal(matches[0].home, 'A');
  assert.equal(matches[0].score, '2-0');
  assert.equal(matches[0].result, '1');
});

// ESKİ HAFTALARIN KESİLMESİ — kullanıcı kararı: "49. haftadan geriye doğru
// silelim elimizde veri yok" + "50 de dahil olsun veri yok".
//   52. Hafta = 1526 (veri var) · 51. Hafta = 1525 (veri var)
//   50. Hafta = 1522 (veri yok) · 49. Hafta = 1521 (veri yok)
test('sınır, oynanma kaydının başladığı turdur', () => {
  assert.equal(LISTE_BASLANGIC_ROUND_ID, 1525);
  // İki sabitin AYNI olması tesadüf değil; ayrışırlarsa liste ya veri olmayan
  // hafta gösterir ya da veri olan haftayı gizler.
  assert.equal(LISTE_BASLANGIC_ROUND_ID, DNA_START_ROUND_ID);
});

test('50 ve 49 DÂHİL daha eski haftalar listeden çıkar', () => {
  const liste = [
    { roundId: 1526, week: '52. Hafta' },
    { roundId: 1525, week: '51. Hafta' },
    { roundId: 1522, week: '50. Hafta' },
    { roundId: 1521, week: '49. Hafta' },
    { roundId: 473, week: '1. Hafta' },
  ];
  assert.deepEqual(eskiHaftalariAt(liste).map((m) => m.week), ['52. Hafta', '51. Hafta']);
});

test('sınırın KENDİSİ kalır (51. Hafta silinmez)', () => {
  assert.equal(eskiHaftalariAt([{ roundId: 1525 }]).length, 1);
  assert.equal(eskiHaftalariAt([{ roundId: 1524 }]).length, 0);
});

test('roundId okunamayan satır atılır', () => {
  // Sırası bilinmeyen kayıt listenin neresine düşeceği belli olmadığı için
  // sessizce en eskiye karışırdı.
  assert.equal(eskiHaftalariAt([{ roundId: null }, { roundId: 'abc' }, {}]).length, 0);
  // Metin roundId sayıya çevrilebiliyorsa geçerlidir (arşiv metin tutabiliyor).
  assert.equal(eskiHaftalariAt([{ roundId: '1526' }]).length, 1);
});

test('boş girdiler çökmez', () => {
  assert.deepEqual(eskiHaftalariAt(null), []);
  assert.equal(sonGunOynanmaIndeksi(null).size, 0);
  assert.equal(sonGunOynanmaIndeksi([null, undefined, {}]).size, 0);
  assert.deepEqual(oynanmaEkle(null, new Map(), 1), { matches: [], yuzdeliSayi: 0 });
});
