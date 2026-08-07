// ---------------------------------------------------------------------------
// ADAY MÜHÜR — haftanın kaybolmasına karşı ön-taahhüt (2026-08-08)
// ---------------------------------------------------------------------------
// Kullanıcı: "1 hafta eksik olursa proje komple çöp olur; kayıp kesinlikle
// olmamalı." Mühür ilk maçtan 5 dk önce atılıyor; o dakikada sunucu kapalıysa
// hafta sonsuza dek kayboluyordu (51. hafta böyle gitti).
//
// BU TESTLERİN ASIL İŞİ, kurtarmanın ÇALIŞTIĞINI göstermek DEĞİL; kurtarmanın
// GEÇMİŞİ YAZMADIĞINI kanıtlamaktır. Maç başladıktan sonra yakalanmış bir aday
// terfi ederse karne yalan söyler — bu, hiç kurtarmamaktan kötüdür.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adayYazilmali, terfiKarari, ADAY_PENCERE_MS, ADAY_ARALIK_MS,
} from '../src/archive/adayMuhur.js';

const ILK_MAC = Date.parse('2026-08-08T17:00:00+03:00');
const saatOnce = (n) => ILK_MAC - n * 3600e3;
const dkOnce = (n) => ILK_MAC - n * 60e3;

// ——— YAZMA KARARI ———
test('aday: pencere dışında (8 saatten uzak) yazılmaz', () => {
  assert.equal(adayYazilmali({ ilkMacMs: ILK_MAC, now: saatOnce(9), mevcut: null, roundId: 1527 }), false);
});

test('aday: pencere içinde ve kayıt yoksa yazılır', () => {
  assert.equal(adayYazilmali({ ilkMacMs: ILK_MAC, now: saatOnce(6), mevcut: null, roundId: 1527 }), true);
});

test('aday: 10 dakika dolmadan yeniden yazılmaz (disk boşa yorulmaz)', () => {
  const now = saatOnce(6);
  const mevcut = { roundId: '1527', capturedAtMs: now - (ADAY_ARALIK_MS - 1000) };
  assert.equal(adayYazilmali({ ilkMacMs: ILK_MAC, now, mevcut, roundId: 1527 }), false);
});

test('aday: 10 dakika dolunca tazelenir', () => {
  const now = saatOnce(6);
  const mevcut = { roundId: '1527', capturedAtMs: now - ADAY_ARALIK_MS };
  assert.equal(adayYazilmali({ ilkMacMs: ILK_MAC, now, mevcut, roundId: 1527 }), true);
});

test('aday: başka haftanın adayı varsa hemen üzerine yazılır', () => {
  const now = saatOnce(2);
  const mevcut = { roundId: '1526', capturedAtMs: now - 1000 };
  assert.equal(adayYazilmali({ ilkMacMs: ILK_MAC, now, mevcut, roundId: 1527 }), true);
});

// EN ÖNEMLİ YAZMA KURALI: maç başladıktan sonra aday YAKALANMAZ.
test('aday: ilk maç başladıysa artık yazılmaz', () => {
  assert.equal(adayYazilmali({ ilkMacMs: ILK_MAC, now: ILK_MAC, mevcut: null, roundId: 1527 }), false);
  assert.equal(adayYazilmali({ ilkMacMs: ILK_MAC, now: ILK_MAC + 60e3, mevcut: null, roundId: 1527 }), false);
});

// ——— TERFİ KARARI ———
test('terfi: maç öncesi yakalanmış aday terfi eder, kilit anı YAKALAMA ANIDIR', () => {
  const aday = { roundId: '1527', capturedAtMs: dkOnce(30) };
  const k = terfiKarari({ aday, roundId: 1527, ilkMacMs: ILK_MAC, muhurVar: false });
  assert.equal(k.terfi, true);
  assert.equal(k.lockedAtMs, dkOnce(30), 'kilit anı, terfi anı değil YAKALAMA anı olmalı');
});

// EN KRİTİK TEST: geçmiş yazılamaz.
test('terfi: maç BAŞLADIKTAN sonra yakalanmış aday ASLA terfi etmez', () => {
  const aday = { roundId: '1527', capturedAtMs: ILK_MAC + 1 };
  const k = terfiKarari({ aday, roundId: 1527, ilkMacMs: ILK_MAC, muhurVar: false });
  assert.equal(k.terfi, false);
  assert.equal(k.sebep, 'mac_sonrasi_yakalanmis');
});

test('terfi: mühür zaten varsa terfi edilmez', () => {
  const aday = { roundId: '1527', capturedAtMs: dkOnce(30) };
  assert.equal(terfiKarari({ aday, roundId: 1527, ilkMacMs: ILK_MAC, muhurVar: true }).terfi, false);
});

test('terfi: başka haftanın adayı bu haftaya yazılmaz', () => {
  const aday = { roundId: '1526', capturedAtMs: dkOnce(30) };
  const k = terfiKarari({ aday, roundId: 1527, ilkMacMs: ILK_MAC, muhurVar: false });
  assert.equal(k.terfi, false);
  assert.equal(k.sebep, 'baska_hafta');
});

test('terfi: aday yoksa ya da zamanı bozuksa sessiz kalınmaz, sebep döner', () => {
  assert.equal(terfiKarari({ aday: null, roundId: 1527, ilkMacMs: ILK_MAC, muhurVar: false }).sebep, 'aday_yok');
  const bozuk = { roundId: '1527', capturedAtMs: null };
  assert.equal(terfiKarari({ aday: bozuk, roundId: 1527, ilkMacMs: ILK_MAC, muhurVar: false }).sebep, 'zaman_yok');
});

test('pencere 8 saat — bir öğleden sonra açık kalan makine haftayı kurtarır', () => {
  assert.equal(ADAY_PENCERE_MS, 8 * 60 * 60 * 1000);
});

// SINIR: tam ilk maç anında atılan mühür GEÇ DEĞİLDİR.
// (snapshotService'teki kural: `late = now > ilkMac`, `>=` değil.)
test('sınır: kilit anı tam ilk maç anıysa geç sayılmaz', () => {
  const ilkMac = ILK_MAC;
  const gec = (now) => now > ilkMac;          // snapshotService ile aynı ifade
  assert.equal(gec(ilkMac), false, 'tam maç anı geç DEĞİL');
  assert.equal(gec(ilkMac + 1), true, 'maç başladıktan 1 ms sonrası geç');
  assert.equal(gec(ilkMac - 1), false);
});
