// GÜNLÜK MÜHÜR PAYI — 23:55 turunun KENDİ gözlemi güne girmeli.
//
// DOĞRULANMIŞ HATA: bir günün hücresi "23:55'e kadarki son gözlem" kuralıyla
// seçiliyordu ve sınır KATIYDI (23:55:00.000). Ama günlük mühür turu tam
// 23:55'te koşar; kaynağı çekip arşive yazması saniyeler sürer, yani turun
// KENDİ gözlemi 23:55:00'dan SONRA damgalanır. Sonuç: tam da o günün mührü
// olması gereken gözlem atılıyor, hücreye daha eski bir değer giriyordu.
//
// ARŞİVDEN ÖLÇÜM (1526. bülten, nesine, günün son gözlemi — İstanbul):
//   26.07 → 23:40:52   (içeride)
//   27.07 → 23:52:13   (içeride)
//   29.07 → 23:55:51   ← DIŞARIDA kalıyordu
//   30.07 → 23:56:02   ← DIŞARIDA kalıyordu
//
// Aynı pay DNA arşivinde (playedDnaArchive.SEAL_GRACE_MS) zaten vardı; bu yol
// almamıştı ve iki kod yolu birbiriyle ÇELİŞİYORDU. Artık ikisi de aynı kural.
//
// DONMA sınırına pay YOKTUR ve bu test onu da bağlar: maç başladıktan sonraki
// veri tahmine giremez, 23:55 payı o sınırı gevşetmemelidir.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDailyPlayed } from '../src/radar/dailyOdds.js';

const TR = 3 * 3600e3;
// 'YYYY-MM-DD' + 'HH:MM:SS' (İstanbul) → UTC ISO
const ist = (gun, saat) => new Date(Date.parse(`${gun}T${saat}Z`) - TR).toISOString();

const GUN = '2026-07-26';                       // maç günü DEĞİL → mühür 23:55
const MAC = { matchId: 'm1', no: 1, date: '2026-07-31T17:00:00Z', home: { name: 'A' }, away: { name: 'B' } };
const gozlem = (saat, p) => ({ matchId: 'm1', source: 'nesine', observedAt: ist(GUN, saat), playedPct: p });

const kur = (observations, ek = {}) => buildDailyPlayed({
  roundId: 1, round: 'test', matches: [MAC], observations,
  firstKickoffMs: Date.parse('2026-07-31T17:00:00Z'),
  now: Date.parse('2026-08-02T12:00:00Z'),
  ...ek,
});
const hucre = (v, gun = GUN) => v.matches[0].cells[gun]?.bySource?.nesine;

test('gün hücresi, mühürden HEMEN ÖNCEKİ son değeri alır', () => {
  const v = kur([
    gozlem('10:00:00', { '1': 50, X: 30, '2': 20 }),
    gozlem('15:00:00', { '1': 60, X: 25, '2': 15 }),
    gozlem('23:50:00', { '1': 70, X: 20, '2': 10 }),
  ]);
  assert.deepEqual(hucre(v).percentages, { '1': 70, X: 20, '2': 10 });
});

test('23:55 turunun KENDİ gözlemi (23:55:51) güne DAHİL', () => {
  // Gerçekte kaybedilen durum buydu.
  const v = kur([
    gozlem('23:45:00', { '1': 60, X: 25, '2': 15 }),
    gozlem('23:55:51', { '1': 72, X: 18, '2': 10 }),
  ]);
  assert.deepEqual(hucre(v).percentages, { '1': 72, X: 18, '2': 10 },
    '23:55 mühür turunun gözlemi hâlâ atılıyor');
});

test('paydan SONRAKİ gözlem (23:56:30) güne GİRMEZ', () => {
  // Pay, sınırı süresiz gevşetmez; ertesi güne ait sayılacak bir değer
  // o günün mührü gibi gösterilemez.
  const v = kur([
    gozlem('23:45:00', { '1': 60, X: 25, '2': 15 }),
    gozlem('23:56:30', { '1': 99, X: 1, '2': 0 }),
  ]);
  assert.deepEqual(hucre(v).percentages, { '1': 60, X: 25, '2': 15 },
    'pay çok geniş — mühür sonrası değer güne girdi');
});

test('MAÇ GÜNÜ mühür = ilk maç −5 dk ve buna PAY YOK', () => {
  // İlk maç 20:00 (İstanbul) → kilit 19:55. 23:55 payı bu sınırı gevşetmemeli;
  // maç başladıktan sonraki oynanma verisi tahmine giremez.
  const MACGUNU = '2026-07-31';
  const kickoff = Date.parse(ist(MACGUNU, '20:00:00'));
  const g = (saat, p) => ({ matchId: 'm1', source: 'nesine', observedAt: ist(MACGUNU, saat), playedPct: p });
  const v = buildDailyPlayed({
    roundId: 1, round: 'test',
    matches: [{ ...MAC, date: new Date(kickoff).toISOString() }],
    observations: [
      g('19:54:00', { '1': 64, X: 22, '2': 14 }),
      g('19:55:40', { '1': 90, X: 5, '2': 5 }),      // kilitten sonra — girmemeli
    ],
    firstKickoffMs: kickoff,
    now: Date.parse('2026-08-02T12:00:00Z'),
  });
  assert.deepEqual(hucre(v, MACGUNU).percentages, { '1': 64, X: 22, '2': 14 },
    'donma sınırı gevşemiş — maç başladıktan sonraki değer alınmış');
});

test('gözlem hiç yoksa hücre BOŞ kalır (dünden taşınmaz)', () => {
  const v = kur([gozlem('12:00:00', { '1': 50, X: 30, '2': 20 })]);
  // Ertesi gün için kayıt yok → o günün hücresi null olmalı.
  const ertesi = '2026-07-27';
  assert.equal(v.matches[0].cells[ertesi], null, 'önceki günün değeri taşınmış');
});
