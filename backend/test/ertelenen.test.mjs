// ERTELENEN MAÇ / NOTER BEKLEYEN — saf kural testleri
// ---------------------------------------------------------------------------
// KORUNAN SÖZLEŞME (kullanıcı tıkanması, 19 Ağustos 2026 — "her ertelenen
// maçta aynı senaryo"):
//  (a) Erteleme tespiti Flutter'daki tek tanımın eşidir: haftanın İLK maçından
//      7+ gün kopan tarih (bkz. flutter/lib/core/erteleme.dart).
//  (b) Haftanın NORMAL programı bitmeden hiçbir maç "noter bekliyor" sayılmaz
//      (aktif hafta ortasında yanlış alarm üretme).
//  (c) Ertelenen maç bekleme penceresini UZATAMAZ — yoksa hafta, ertelenen
//      maçın yeni tarihi geçene dek panelde hiç görünmezdi (asıl senaryo!).
//  (d) Resmî sonucu (noter kararı DAHİL) olan maç bekleyen listesine girmez.
//  (e) Hiçbir sonuç uydurulmaz: modül yalnız "sonuç yok" gerçeğini raporlar.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ERTELEME_ESIGI_GUN,
  ertelendiMi,
  noterBekleyenMaclar,
} from '../src/ertelenen.js';

const GUN = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-08-14T18:30:00Z').getTime(); // haftanın ilk maçı
const iso = (t) => new Date(t).toISOString();

// 1. Hafta gerçeğinin küçültülmüş kopyası: 14 normal maç 0–3 gün içinde,
// 15. maç (Celta Vigo – Osasuna) 13 gün sonraya alınmış.
const MACLAR = [
  { matchId: 'm1', orderNo: 1, homeName: 'Ev1', awayName: 'Dep1', kickoffAt: iso(T0) },
  { matchId: 'm2', orderNo: 2, homeName: 'Ev2', awayName: 'Dep2', kickoffAt: iso(T0 + 1 * GUN) },
  { matchId: 'm3', orderNo: 3, homeName: 'Ev3', awayName: 'Dep3', kickoffAt: iso(T0 + 3 * GUN) },
  { matchId: 'm15', orderNo: 15, homeName: 'Celta Vigo', awayName: 'Osasuna', kickoffAt: iso(T0 + 13 * GUN) },
];
const SONUC = (no) => ({ orderNo: no, officialResult: '1' });

test('(a) ertelendiMi: 13 gün kopma ertelenmiş, 0-3 gün normal, eşik 7 gün', () => {
  assert.equal(ERTELEME_ESIGI_GUN, 7, 'eşik Flutter ile AYNI olmalı (kErtelemeEsigiGun)');
  assert.equal(ertelendiMi(iso(T0 + 13 * GUN), iso(T0)), true);
  assert.equal(ertelendiMi(iso(T0 + 3 * GUN), iso(T0)), false);
  assert.equal(ertelendiMi(iso(T0 + 7 * GUN), iso(T0)), true, 'eşik dahildir (>=)');
  assert.equal(ertelendiMi(null, iso(T0)), false, 'tarih yoksa uydurma yok');
  assert.equal(ertelendiMi(iso(T0), null), false);
  assert.equal(ertelendiMi('bilinmiyor', iso(T0)), false);
});

test('(b) program bitmeden bekleyen ÜRETİLMEZ — aktif hafta yanlış alarm almaz', () => {
  // Son normal maç T0+3g; pay 24 saat → T0+4g'e kadar sessiz.
  const simdi = T0 + 3 * GUN + 12 * 60 * 60 * 1000;
  assert.deepEqual(noterBekleyenMaclar(MACLAR, [], simdi), []);
});

test('(c) ertelenen maç pencereyi uzatamaz: program bitince HEMEN listelenir', () => {
  // Ertelenen maçın yeni tarihi (T0+13g) DAHA GELMEDİ ama son normal maçtan
  // 24 saat geçti → 15. maç bekleyen iştir. (Asıl yaşanan senaryo buydu:
  // hafta günlerce "kesinleşmemiş" kalıyor, kimse hatırlamıyordu.)
  const simdi = T0 + 5 * GUN;
  const bekleyen = noterBekleyenMaclar(MACLAR, [SONUC(1), SONUC(2), SONUC(3)], simdi);
  assert.equal(bekleyen.length, 1);
  assert.deepEqual(bekleyen[0], {
    orderNo: 15,
    ev: 'Celta Vigo',
    dep: 'Osasuna',
    tarih: iso(T0 + 13 * GUN),
    ertelendi: true,
  });
});

test('(d) resmî sonucu (noter kararı dahil) olan maç bekleyen listesine girmez', () => {
  const simdi = T0 + 5 * GUN;
  const noterle = [...[1, 2, 3].map(SONUC), { orderNo: 15, officialResult: 'X', resultType: 'notary_decision' }];
  assert.deepEqual(noterBekleyenMaclar(MACLAR, noterle, simdi), []);
});

test('(e) ertelenmemiş ama sonucu yayımlanmamış maç da listelenir (ertelendi:false)', () => {
  // Sonucu hiç gelmeyen normal maç operatörün GÖRMESİ gereken bir iştir;
  // "ertelendi" damgası uydurulmaz — durum ayrı yazılır.
  const simdi = T0 + 5 * GUN;
  const bekleyen = noterBekleyenMaclar(MACLAR, [SONUC(1), SONUC(3)], simdi);
  assert.deepEqual(bekleyen.map((m) => [m.orderNo, m.ertelendi]), [[2, false], [15, true]]);
});

test('boş/bozuk girdi: boş liste döner, hata fırlatmaz', () => {
  assert.deepEqual(noterBekleyenMaclar([], [], T0), []);
  assert.deepEqual(noterBekleyenMaclar(null, null, T0), []);
  assert.deepEqual(
    noterBekleyenMaclar([{ orderNo: 1, kickoffAt: 'bozuk' }], [], T0),
    [],
    'tarihi parse edilemeyen hafta hakkında hüküm verilmez',
  );
});
