// VERİNİN YAŞI — "bu sayılar en son ne zaman çekildi".
//
// KULLANICI İSTEĞİ (3 Ağustos 2026): Radar 3/4 panellerinde yalnız "23:55'te
// mühürlenir" yazıyordu. O cümle GELECEKTEKİ bir sözdür; geçmişteki çekimi
// anlatmaz. Kaynak susarsa ekrandaki sayılar sessizce eskir ve kullanıcı bunu
// hiçbir yerden göremezdi.
//
// SÖZLEŞME:
//   * `lastObservedAt`   — en son GEÇERLİ gözlemin ISO zamanı (makine için)
//   * `lastObservedLabel`— İstanbul saatiyle hazır metin (ekran için)
// Saat çevirimi SUNUCUDA yapılır: cihazın saat dilimi yanlışsa kullanıcı
// yanlış saat görürdü ve bu sayı verinin güvenilirliğini anlatıyor.
// Gözlem yoksa İKİSİ DE null — "bilinmiyor" yazmak da uydurmaktır.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDailyPlayed, buildDailyOdds } from '../src/radar/dailyOdds.js';

const TR = 3 * 3600e3;
const ist = (gun, saat) => new Date(Date.parse(`${gun}T${saat}Z`) - TR).toISOString();

const MAC = { matchId: 'm1', no: 1, date: '2026-08-07T17:00:00Z', home: { name: 'A' }, away: { name: 'B' } };
const gozlem = (gun, saat, p = { '1': 50, X: 30, '2': 20 }) => ({
  matchId: 'm1', source: 'nesine', observedAt: ist(gun, saat), playedPct: p,
});

// "Şu an" 3 Ağustos 22:14 (İstanbul) — kullanıcının sorduğu andır.
const SIMDI = Date.parse(ist('2026-08-03', '22:14:00'));

const kur = (observations, ek = {}) => buildDailyPlayed({
  roundId: 1, round: 'test', matches: [MAC], observations,
  firstKickoffMs: Date.parse('2026-08-07T17:00:00Z'),
  now: SIMDI,
  ...ek,
});

const gunuBul = (v, gun) => v.days.find((d) => d.date === gun);

test('HAFTALIK tek "son çekim" alanı YOKTUR — saat gün bazındadır', () => {
  // Bir dönem vardı ve ekranda "Son güncelleme: 22:39" diye gösteriliyordu:
  // kullanıcı Pazar sekmesindeyken Pazartesi'nin saatini görüyordu. Ekranda
  // TEK GÜN görünür, dolayısıyla saat de o güne ait olmalı. Alan geri gelirse
  // aynı karışıklık da geri gelir — bu test onu engeller.
  const v = kur([gozlem('2026-08-03', '21:29:20')]);
  assert.equal(v.lastObservedAt, undefined);
  assert.equal(v.lastObservedLabel, undefined);
});

test('en son gözlemin zamanı döner (aradaki eskiler değil)', () => {
  const v = kur([
    gozlem('2026-08-03', '19:05:00'),
    gozlem('2026-08-03', '21:29:20'),   // EN YENİ
    gozlem('2026-08-03', '20:14:00'),   // sırasız gelse de sonuç değişmez
  ]);
  assert.equal(gunuBul(v, '2026-08-03').lastObservedAt, ist('2026-08-03', '21:29:20'));
});

test('etiket İstanbul saatiyle yazılır', () => {
  const v = kur([gozlem('2026-08-03', '21:29:20')]);
  assert.equal(gunuBul(v, '2026-08-03').lastObservedLabel, '21:29');
});

test('gözlem YOKSA uydurma saat yazılmaz (ikisi de null)', () => {
  const v = kur([]);
  assert.equal(gunuBul(v, '2026-08-03').lastObservedAt, null);
  assert.equal(gunuBul(v, '2026-08-03').lastObservedLabel, null);
});

test('GEÇERSİZ yüzde zamanı belirlemez — sayılmayan gözlem "son çekim" olamaz', () => {
  // Ekrana girmeyen bir gözlem, verinin yaşını da tazeleyemez; aksi hâlde
  // "21:29'da çekildi" yazarken hücreler 19:05'in değerini gösterirdi.
  const v = kur([
    gozlem('2026-08-03', '19:05:00'),
    gozlem('2026-08-03', '21:29:20', null),          // yüzde yok
    gozlem('2026-08-03', '21:40:00', { '1': null, X: null, '2': null }),
  ]);
  assert.equal(gunuBul(v, '2026-08-03').lastObservedAt, ist('2026-08-03', '19:05:00'));
  assert.equal(gunuBul(v, '2026-08-03').lastObservedLabel, '19:05');
});

// ---------------------------------------------------------------------------
// GÜN BAZINDA SAAT (kullanıcı isteği: "pazar sekmesindeki oranlar kaçta
// çekilmiş, pazartesi sekmesindekiler kaçta"). Her gün AYRI mühürlenir, yani
// her günün kendi tazeliği vardır: biri 23:52'de kapanmış, öteki öğleden sonra
// susmuş olabilir.
// ---------------------------------------------------------------------------

// Gün penceresi maç haftasıdır: Pazar 02.08 → Cuma 07.08 (ilk maç 07.08).
// Testler pencere İÇİNDEKİ günleri kullanır; dışarıdaki tarih hiç dönmez.
const PAZAR = '2026-08-02';
const PAZARTESI = '2026-08-03';

test('her gün KENDİ son gözlem saatini taşır', () => {
  const v = kur([
    gozlem(PAZAR, '14:03:00'),
    gozlem(PAZAR, '23:52:10'),        // Pazar'ın sonu
    gozlem(PAZARTESI, '21:29:20'),    // Pazartesi ayrı
  ]);
  assert.equal(gunuBul(v, PAZAR)?.lastObservedLabel, '23:52');
  assert.equal(gunuBul(v, PAZARTESI)?.lastObservedLabel, '21:29');
});

test('gözlem alınmamış GÜN null kalır — komşu günün saati taşınmaz', () => {
  // Taşıma, o gün veri varmış gibi gösterirdi. Radar 3/4'ün temel kuralı:
  // veri yoksa sebep yazılır, değer (ve saat) uydurulmaz.
  const v = kur([gozlem(PAZAR, '23:52:10')]);
  assert.equal(gunuBul(v, PAZAR)?.lastObservedLabel, '23:52');
  assert.equal(gunuBul(v, PAZARTESI)?.lastObservedLabel, null);
  assert.equal(gunuBul(v, PAZARTESI)?.lastObservedAt, null);
});

test('gün saatinde TARİH yazmaz — çipte ve satırda tarih zaten var', () => {
  const v = kur([gozlem(PAZAR, '23:52:10')]);
  assert.equal(gunuBul(v, PAZAR).lastObservedLabel, '23:52');
  assert.doesNotMatch(gunuBul(v, PAZAR).lastObservedLabel, /\./);
});

test('MÜHÜR sonrası gözlem o güne yazılmaz — gün penceresi bağlayıcı', () => {
  // 23:55 + pay sınırının ötesindeki gözlem o günün saati olamaz; hücreye de
  // girmiyor. Saat ile hücre AYNI pencereden gelmeli, yoksa "23:59'da
  // güncellendi" yazarken hücre 20:00'ın değerini gösterirdi.
  const v = kur([
    gozlem(PAZAR, '20:00:00'),
    gozlem(PAZAR, '23:59:30'),   // mühür + payın DIŞINDA
  ]);
  assert.equal(gunuBul(v, PAZAR).lastObservedLabel, '20:00');
});

test('Radar 4 (oran) da aynı bilgiyi verir — iki panel aynı sözleşmede', () => {
  const v = buildDailyOdds({
    roundId: 1, round: 'test', matches: [MAC],
    observations: [{
      matchId: 'm1', source: 'nesine', observedAt: ist('2026-08-03', '20:00:00'),
      odds: { home: 1.61, draw: 3.2, away: 4.25 },
    }],
    firstKickoffMs: Date.parse('2026-08-07T17:00:00Z'),
    now: SIMDI,
  });
  assert.equal(v.days.find((d) => d.date === '2026-08-03')?.lastObservedLabel, '20:00');
});
