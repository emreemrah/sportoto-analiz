// TAKIM FİKSTÜRÜ TESTLERİ.
//
// NEDEN VAR: bu ekran kullanıcıya bir takımın oynadığı ve oynayacağı maçları
// gösterir. Buradaki hatalar SESSİZDİR — yanlış takımın fikstürü, oynanmamış
// maça uydurma sonuç harfi, ya da ev/deplasman ters okunduğu için tersine
// dönmüş G/M. Hiçbiri hata vermez, sadece yanlış görünür.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  takimFiksturu, sonucHarfi, kaynakTakimKimlikleri, fiksturIndeksi,
} from '../src/takimFikstur.js';

const mac = (o) => ({
  footyMatchId: o.id, homeId: o.h, awayId: o.a,
  homeName: o.hn || `T${o.h}`, awayName: o.an || `T${o.a}`,
  dateUnix: o.t, status: o.s || 'upcoming',
  score: o.sk || null, gameWeek: o.w ?? null,
});

describe('kaynakTakimKimlikleri', () => {
  const FM = { homeId: 100, awayId: 200 };

  test('normal eşleşmede kimlikler olduğu gibi', () => {
    assert.deepEqual(kaynakTakimKimlikleri(FM, false), { home: 100, away: 200 });
  });

  test('TERS eşleşmede kimlikler de çevriliyor', () => {
    // Çevrilmezse takım kartı RAKİBİN fikstürünü açar: kullanıcı Randers'a
    // basar, Lyngby'nin maçlarını görür. Hata vermez, sadece yanlıştır.
    assert.deepEqual(kaynakTakimKimlikleri(FM, true), { home: 200, away: 100 });
  });

  test('eşleşme yoksa kimlik UYDURULMUYOR', () => {
    assert.deepEqual(kaynakTakimKimlikleri(null, false), { home: null, away: null });
    assert.deepEqual(kaynakTakimKimlikleri({}, false), { home: null, away: null });
  });
});

describe('sonucHarfi', () => {
  test('ev sahibi kazanınca G, deplasman için M', () => {
    const m = mac({ id: 1, h: 10, a: 20, s: 'finished', sk: { home: 2, away: 1 } });
    assert.equal(sonucHarfi(m, 10), 'G');
    assert.equal(sonucHarfi(m, 20), 'M');
  });

  test('deplasman kazanınca harfler TERS — taraf karıştırılmıyor', () => {
    // En kolay yapılan hata: skoru hep ev sahibi gözüyle okumak. O zaman
    // deplasmanda kazanan takım ekranda "M" görünürdü.
    const m = mac({ id: 2, h: 10, a: 20, s: 'finished', sk: { home: 0, away: 3 } });
    assert.equal(sonucHarfi(m, 20), 'G');
    assert.equal(sonucHarfi(m, 10), 'M');
  });

  test('beraberlikte iki taraf da B', () => {
    const m = mac({ id: 3, h: 10, a: 20, s: 'finished', sk: { home: 1, away: 1 } });
    assert.equal(sonucHarfi(m, 10), 'B');
    assert.equal(sonucHarfi(m, 20), 'B');
  });

  test('OYNANMAMIŞ maça harf UYDURULMUYOR', () => {
    assert.equal(sonucHarfi(mac({ id: 4, h: 10, a: 20, s: 'upcoming' }), 10), null);
  });

  test('bitmiş ama SKORU YOK — harf yazılmıyor', () => {
    // Durum ile skor birbirini tutmuyorsa susmak, uydurmaktan iyidir.
    assert.equal(sonucHarfi(mac({ id: 5, h: 10, a: 20, s: 'finished', sk: null }), 10), null);
    assert.equal(sonucHarfi(mac({ id: 6, h: 10, a: 20, s: 'finished', sk: { home: null, away: 2 } }), 10), null);
  });
});

describe('takimFiksturu', () => {
  const SEZON = [
    mac({ id: 1, h: 10, a: 20, t: 300, s: 'finished', sk: { home: 2, away: 0 } }),
    mac({ id: 2, h: 30, a: 10, t: 100, s: 'finished', sk: { home: 1, away: 1 } }),
    mac({ id: 3, h: 40, a: 50, t: 200 }),                       // BAŞKA takımlar
    mac({ id: 4, h: 10, a: 40, t: 400 }),
  ];

  test('yalnız o takımın maçları — başka maç sızmıyor', () => {
    const r = takimFiksturu(SEZON, 10);
    assert.deepEqual(r.map((f) => f.footyMatchId), [2, 1, 4]);
  });

  test('tarihe göre ESKİDEN YENİYE sıralanıyor', () => {
    assert.deepEqual(takimFiksturu(SEZON, 10).map((f) => f.dateUnix), [100, 300, 400]);
  });

  test('ev/deplasman doğru işaretleniyor ve rakip doğru seçiliyor', () => {
    const r = takimFiksturu(SEZON, 10);
    const depMac = r.find((f) => f.footyMatchId === 2);   // 30 evinde, 10 deplasmanda
    assert.equal(depMac.evde, false);
    assert.equal(depMac.rakip, 'T30');
    const evMac = r.find((f) => f.footyMatchId === 1);
    assert.equal(evMac.evde, true);
    assert.equal(evMac.rakip, 'T20');
  });

  test('oynanmamış maçta skor NULL — boş nesne bile üretilmiyor', () => {
    const gelecek = takimFiksturu(SEZON, 10).find((f) => f.footyMatchId === 4);
    assert.equal(gelecek.oynandi, false);
    assert.equal(gelecek.score, null);
    assert.equal(gelecek.sonuc, null);
  });

  test('sonuç harfi takımın KENDİ açısından hesaplanıyor', () => {
    // 1 numaralı maç: 10 evinde 2-0 kazandı → 10 için G, 20 için M.
    assert.equal(takimFiksturu(SEZON, 10).find((f) => f.footyMatchId === 1).sonuc, 'G');
    assert.equal(takimFiksturu(SEZON, 20).find((f) => f.footyMatchId === 1).sonuc, 'M');
  });

  test('kimlik metin gelse de eşleşiyor (istemci sorgu parametresi)', () => {
    assert.equal(takimFiksturu(SEZON, '10').length, 3);
  });

  test('veri yoksa patlamıyor', () => {
    assert.deepEqual(takimFiksturu(null, 10), []);
    assert.deepEqual(takimFiksturu([], 10), []);
  });
});

describe('fiksturIndeksi (tüm turnuvalar)', () => {
  // Bir takım yalnız liginde oynamaz: kupa, Avrupa ve hazırlık maçları BAŞKA
  // sezon kimlikleri altındadır. Yalnız lig sezonunda arayan bir fikstür bu
  // maçları sessizce yutar — liste dolu görünür, ama eksiktir.
  const LIGLER = new Map([
    ['900', { name: 'Denmark Superliga' }],
    ['901', { name: 'UEFA Sampiyonlar Ligi' }],
    ['902', { name: 'Danimarka Kupasi' }],
  ]);
  const m = (id, sid, h, a, t, s = 'upcoming', sk = null) => ({
    footyMatchId: id, seasonId: sid, homeId: h, awayId: a,
    homeName: `T${h}`, awayName: `T${a}`, dateUnix: t, status: s, score: sk,
  });

  const MACLAR = [
    m(1, 900, 10, 20, 100, 'finished', { home: 2, away: 0 }),   // lig
    m(2, 901, 30, 10, 200),                                     // Avrupa
    m(3, 902, 10, 40, 300),                                     // kupa
    m(4, 900, 50, 60, 400),                                     // başka takımlar
  ];

  test('takımın FARKLI turnuvalardaki maçları tek listede toplanıyor', () => {
    const i = fiksturIndeksi([10], MACLAR, LIGLER);
    assert.deepEqual(i[10].map((f) => f.footyMatchId), [1, 2, 3]);
    assert.deepEqual(i[10].map((f) => f.lig),
      ['Denmark Superliga', 'UEFA Sampiyonlar Ligi', 'Danimarka Kupasi']);
  });

  test('turnuva adı bilinmiyorsa UYDURULMUYOR', () => {
    const i = fiksturIndeksi([10], MACLAR, new Map());
    assert.ok(i[10].every((f) => f.lig === null));
  });

  test('istenmeyen takımın maçı indekse girmiyor', () => {
    const i = fiksturIndeksi([10], MACLAR, LIGLER);
    assert.ok(!i[50] && !i[60]);
  });

  test('iki takım da bültendeyse ortak maç İKİSİNDE de var, ama tekrarsız', () => {
    const i = fiksturIndeksi([10, 20], MACLAR, LIGLER);
    assert.equal(i[10].filter((f) => f.footyMatchId === 1).length, 1);
    assert.equal(i[20].filter((f) => f.footyMatchId === 1).length, 1);
  });

  test('sonuç harfi her takımın KENDİ açısından', () => {
    const i = fiksturIndeksi([10, 20], MACLAR, LIGLER);
    assert.equal(i[10].find((f) => f.footyMatchId === 1).sonuc, 'G');
    assert.equal(i[20].find((f) => f.footyMatchId === 1).sonuc, 'M');
  });

  test('tarihe göre sıralı — turnuvalar karışsa da kronoloji bozulmuyor', () => {
    assert.deepEqual(fiksturIndeksi([10], MACLAR, LIGLER)[10].map((f) => f.dateUnix), [100, 200, 300]);
  });

  test('veri yoksa patlamıyor', () => {
    assert.deepEqual(fiksturIndeksi(null, null, null), {});
    assert.deepEqual(fiksturIndeksi([10], [], LIGLER), {});
  });
});
