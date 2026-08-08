// RADAR 5 — "ORAN" MODUNUN SAĞ TARAF ÖZETİ TESTLERİ.
//
// Bu modül, satırın sağında hangi GÜNÜN oranının yazılacağını ve bir oranın
// yazılmaya değer olup olmadığını belirliyor. Yanlış seçim SESSİZDİR: ekranda
// yine iki basamaklı düzgün bir sayı görünür, ama başka bir günün ya da yarım
// bir kaydın sayısıdır. Testler o yüzden sınırları kovalıyor: eksik üçlü,
// gelecek gün, boş hücre, hiç yanıt gelmemesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sonGunOranOzeti, oranGunu, oranUclusu, oranYaz, EN_DUSUK_ORAN,
} from '../src/radar/oranOzeti.js';

/** /api/radar/daily-odds yanıtının ekranda kullanılan alanları. */
const gun = (date, weekday, future = false) => ({ date, weekday, future });
const hucre = (home, draw, away) => ({ odds: { home, draw, away } });

const YANIT = {
  roundId: 1600,
  days: [
    gun('2026-08-02', 'Pazar'),
    gun('2026-08-03', 'Pazartesi'),
    gun('2026-08-04', 'Salı'),
  ],
  matches: [
    {
      no: 1,
      cells: {
        '2026-08-02': hucre(2.10, 3.30, 3.40),
        '2026-08-03': hucre(1.61, 3.20, 4.25),
      },
    },
    { no: 2, cells: { '2026-08-02': hucre(1.90, 3.40, 3.90) }, notes: {} },
  ],
};

test('(a) SON DOLU gün seçilir — daha eski dolu gün değil', () => {
  const r = sonGunOranOzeti(YANIT);
  assert.equal(r.tarih, '2026-08-03');
  assert.equal(r.weekday, 'Pazartesi');
  // 1. maçın o günkü oranı yazılır (bir önceki günün 2.10'u DEĞİL).
  assert.deepEqual(r.oranlar.get(1), { home: 1.61, draw: 3.20, away: 4.25 });
  // 2. maçın o gün kaydı yok: ÖNCEKİ GÜNDEN TAŞINMAZ — sayı üretilmez.
  assert.equal(r.oranlar.get(2), undefined);
  assert.equal(r.oranlar.has(2), false);
  assert.equal(r.sebep, null);
});

test('(b) oran yoksa NULL döner — "0" değil (Number(null) === 0 tuzağı)', () => {
  assert.equal(oranUclusu(null), null);
  assert.equal(oranUclusu({}), null);
  assert.equal(oranUclusu({ home: null, draw: null, away: null }), null);
  assert.equal(oranUclusu({ home: '', draw: '', away: '' }), null);
  assert.equal(oranUclusu({ home: false, draw: false, away: false }), null);
  // 0 ve 1.00 gerçek oran DEĞİLDİR (arka uçtaki validOdds ile aynı eşik).
  assert.equal(EN_DUSUK_ORAN, 1);
  assert.equal(oranUclusu({ home: 0, draw: 0, away: 0 }), null);
  assert.equal(oranUclusu({ home: 1, draw: 3.2, away: 4.25 }), null);
  // Hiç yanıt gelmediyse "kayıt yok" DENMEZ — sebep ayrışır.
  assert.equal(sonGunOranOzeti(null).sebep, 'yukleniyor');
  assert.equal(sonGunOranOzeti({ days: [], matches: [] }).sebep, 'gunYok');
  // Günler var ama hiçbirinde geçerli oran yok → "kayitYok", tarih null.
  const bos = sonGunOranOzeti({ days: [gun('2026-08-02', 'Pazar')], matches: [{ no: 1, cells: { '2026-08-02': null } }] });
  assert.equal(bos.sebep, 'kayitYok');
  assert.equal(bos.tarih, null);
  assert.equal(bos.oranlar.size, 0);
});

test('(c) EKSİK üçlü tam oran sayılmaz — yarım kayıt tam gibi gösterilmez', () => {
  assert.equal(oranUclusu({ home: 1.61, draw: 3.20 }), null);            // away yok
  assert.equal(oranUclusu({ home: 1.61, draw: null, away: 4.25 }), null); // draw boş
  assert.equal(oranUclusu({ home: 'abc', draw: 3.2, away: 4.25 }), null); // okunamaz
  // Ekran katmanına da yansır: eksik üçlülü gün DOLU sayılmaz, bir önceki
  // tam kayıtlı güne düşülür.
  const r = sonGunOranOzeti({
    days: [gun('2026-08-02', 'Pazar'), gun('2026-08-03', 'Pazartesi')],
    matches: [{
      no: 1,
      cells: {
        '2026-08-02': hucre(2.10, 3.30, 3.40),
        '2026-08-03': { odds: { home: 1.61, draw: null, away: 4.25 } },
      },
      notes: { '2026-08-03': { text: 'Bu gün mühür alınamadı' } },
    }],
  });
  assert.equal(r.tarih, '2026-08-02');
  assert.deepEqual(r.oranlar.get(1), { home: 2.10, draw: 3.30, away: 3.40 });
});

test('(d) GELECEK gün seçilemez — henüz oluşmamış oran yoktur', () => {
  const ileri = {
    days: [gun('2026-08-02', 'Pazar'), gun('2026-08-05', 'Çarşamba', true)],
    matches: [{
      no: 1,
      cells: {
        '2026-08-02': hucre(2.10, 3.30, 3.40),
        // Gelecek günde kayıt OLSA BİLE (hatalı mühür/erken yazım) seçilmez.
        '2026-08-05': hucre(1.55, 3.60, 5.00),
      },
    }],
  };
  assert.equal(oranGunu(ileri), '2026-08-02');
  assert.equal(sonGunOranOzeti(ileri).weekday, 'Pazar');

  // Haftanın TAMAMI ileri tarihliyse hiçbir gün seçilmez: gün adı bir sayının
  // etiketidir, olmayan kaydın gününü yazmak "kayıt var" izlenimi verirdi.
  const hepsiIleri = {
    days: [gun('2026-08-09', 'Pazar', true)],
    matches: [{ no: 1, cells: { '2026-08-09': hucre(1.55, 3.60, 5.00) } }],
  };
  assert.equal(oranGunu(hepsiIleri), null);
  assert.equal(sonGunOranOzeti(hepsiIleri).sebep, 'kayitYok');
});

test('maçın kendi sebebi arka uçtan TAŞINIR, burada üretilmez', () => {
  const r = sonGunOranOzeti({
    days: [gun('2026-08-03', 'Pazartesi')],
    matches: [
      { no: 1, cells: { '2026-08-03': hucre(1.61, 3.20, 4.25) } },
      { no: 2, cells: { '2026-08-03': null }, notes: { '2026-08-03': { text: 'Bu gün mühür alınamadı' } } },
      { no: 3, cells: {} },
    ],
  });
  assert.equal(r.sebepler.get(2), 'Bu gün mühür alınamadı');
  assert.equal(r.sebepler.get(3), null);   // sebep yoksa uydurulmaz
  assert.equal(r.oranlar.size, 1);
});

test('bozuk/eksik yanıt çökertmez ve sayı üretmez', () => {
  for (const v of [undefined, {}, { days: null }, { days: [gun('2026-08-03', 'Pazartesi')] }]) {
    const r = sonGunOranOzeti(v);
    assert.equal(r.tarih, null);
    assert.equal(r.oranlar.size, 0);
    assert.ok(r.sebep, 'sebep her zaman yazılır');
  }
  assert.equal(oranGunu(null), null);
});

test('biçim iki basamaklıdır (1.6 → "1.60") — ekranda oran gibi okunur', () => {
  assert.equal(oranYaz(1.6), '1.60');
  assert.equal(oranYaz(3.2), '3.20');
  assert.equal(oranYaz('4.25'), '4.25');
});
