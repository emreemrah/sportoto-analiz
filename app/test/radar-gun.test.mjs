// RADAR GÜN SEÇİMİ TESTLERİ.
//
// GERÇEK HATA (2 Ağustos 2026, pazar): Radar 3 CUMA gününde takılı kaldı.
// Kullanıcı bugünün oynanma yüzdelerini göremedi. Hiçbir hata mesajı yoktu —
// ekran dolu görünüyordu, sadece yanlış güne kilitlenmişti.
//
// İki kusur üst üste bindi ve testler ikisini de ayrı ayrı kilitler:
//   1. gelecek günler aday olmaktan elenmiyordu,
//   2. "veri var mı" kontrolü BOŞ NESNEYİ veri sayıyordu (`{}` doğrudur).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { varsayilanGun, hucreDolu } from '../src/radarGun.js';

// Gerçek olayın verisi: bugün pazar (2 Ağu), sonraki beş gün gelecek.
const GUNLER = [
  { date: '2026-08-02', future: false },
  { date: '2026-08-03', future: true },
  { date: '2026-08-04', future: true },
  { date: '2026-08-05', future: true },
  { date: '2026-08-06', future: true },
  { date: '2026-08-07', future: true },   // CUMA — hatalı seçilen gün
];

// Kaynak, gelecek günler için BOŞ NESNE gönderiyor.
const MACLAR = [{
  cells: {
    '2026-08-02': { bySource: { k1: { percentages: { 1: 70, X: 14, 2: 16 } } } },
    '2026-08-03': {}, '2026-08-04': {}, '2026-08-05': {},
    '2026-08-06': {}, '2026-08-07': {},
  },
}];

describe('hucreDolu', () => {
  test('BOŞ NESNE veri sayılmıyor — hatanın ikinci yarısı', () => {
    // `{}` JavaScript'te doğrudur; eski kontrol bu yüzden gelecek günleri
    // "veri var" sayıyordu.
    assert.equal(hucreDolu({}), false);
  });

  test('içi dolu hücre veri sayılıyor', () => {
    assert.equal(hucreDolu({ bySource: { k1: {} } }), true);
  });

  test('yok/boş değerler veri değil', () => {
    assert.equal(hucreDolu(null), false);
    assert.equal(hucreDolu(undefined), false);
    assert.equal(hucreDolu('veri'), false);
  });
});

describe('varsayilanGun', () => {
  test('GERÇEK OLAY: cuma değil, bugün seçiliyor', () => {
    assert.equal(varsayilanGun(GUNLER, MACLAR), '2026-08-02');
  });

  test('gelecek gün ASLA varsayılan olmuyor', () => {
    // Gelecek günlerin hücresi DOLU olsa bile seçilmemeli: oynanmamış bir
    // günün oynanma yüzdesi mantıken yoktur.
    const doluGelecek = [{
      cells: {
        '2026-08-02': { bySource: { k1: {} } },
        '2026-08-07': { bySource: { k1: {} } },
      },
    }];
    assert.equal(varsayilanGun(GUNLER, doluGelecek), '2026-08-02');
  });

  test('geçmişte veri olan EN SON gün seçiliyor', () => {
    const gunler = [
      { date: '2026-07-31', future: false },
      { date: '2026-08-01', future: false },
      { date: '2026-08-02', future: false },
    ];
    const maclar = [{ cells: { '2026-07-31': { a: 1 }, '2026-08-01': { a: 1 }, '2026-08-02': {} } }];
    // 2 Ağustos boş → 1 Ağustos seçilmeli (en son VERİLİ gün).
    assert.equal(varsayilanGun(gunler, maclar), '2026-08-01');
  });

  test('hiç veri yoksa yine de geçmiş/bugün gününde kalınıyor', () => {
    // Gelecek güne kaçmak, kullanıcıya "veri var" izlenimi verirdi.
    assert.equal(varsayilanGun(GUNLER, [{ cells: {} }]), '2026-08-02');
  });

  test('bültenin TAMAMI ileri tarihliyse EN YAKIN gün seçiliyor', () => {
    // Yeni açılmış hafta: son günü göstermek kullanıcıyı bir hafta sonrasına
    // atardı.
    const hepsiGelecek = GUNLER.map((g) => ({ ...g, future: true }));
    assert.equal(varsayilanGun(hepsiGelecek, MACLAR), '2026-08-02');
  });

  test('gün listesi yoksa patlamıyor', () => {
    assert.equal(varsayilanGun(null, null), null);
    assert.equal(varsayilanGun([], MACLAR), null);
  });

  test('hücre okuyucu özelleştirilebiliyor (Radar 4 farklı yerde tutabilir)', () => {
    const maclar = [{ ozel: { '2026-08-02': { a: 1 } } }];
    assert.equal(
      varsayilanGun(GUNLER, maclar, (m, t) => m?.ozel?.[t]),
      '2026-08-02',
    );
  });
});
