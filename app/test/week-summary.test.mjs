// HAFTANIN ÖZETİ TESTLERİ — saf seçim mantığı (weekSummary.js).
// Dürüstlük: aday uydurulmaz, başlamış maç aday gösterilmez, sıralama gerçek
// verilere göre yapılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekSummary, matchLine } from '../src/weekSummary.js';

const NOW = 1_800_000_000_000;
const future = new Date(NOW + 3600_000).toISOString();
const past = new Date(NOW - 3600_000).toISOString();

const m = (no, { label, pct, sur, date = future, probs = null, started = false } = {}) => ({
  no, date, started,
  home: { name: `Ev${no}` }, away: { name: `Dep${no}` },
  analysis: {
    label: label || 'DİKKAT',
    favorite: pct != null ? { symbol: '1', percent: pct } : null,
    surpriseScore: sur ?? null,
    probabilities: probs,
  },
});

test('özet: güçlü adaylar favori yüzdesine göre sıralanır ve en çok 3 taneyle sınırlıdır', () => {
  const s = buildWeekSummary([
    m(1, { label: 'BANKO', pct: 61 }),
    m(2, { label: 'BANKO', pct: 74 }),
    m(3, { label: 'BANKO', pct: 68 }),
    m(4, { label: 'BANKO', pct: 80 }),
    m(5, { label: 'DİKKAT', pct: 55 }),
  ], { now: NOW });
  assert.deepEqual(s.strong.map((x) => x.no), [4, 2, 3], 'yüzde sırası + üst sınır 3');
});

test('özet: sürpriz adayları sürpriz puanına göre sıralanır', () => {
  const s = buildWeekSummary([
    m(1, { label: 'SÜRPRİZE AÇIK', sur: 55 }),
    m(2, { label: 'SÜRPRİZE AÇIK', sur: 80 }),
    m(3, { label: 'DİKKAT', sur: 70 }),
  ], { now: NOW });
  assert.deepEqual(s.surprises.map((x) => x.no), [2, 1], 'yalnız SÜRPRİZE AÇIK etiketi + puan sırası');
});

test('özet: BAŞLAMIŞ maç aday listelerine GİREMEZ (sonuç oluşmaya başlamıştır)', () => {
  const s = buildWeekSummary([
    m(1, { label: 'BANKO', pct: 90, date: past }),           // başladı → dışarıda
    m(2, { label: 'BANKO', pct: 60 }),
    m(3, { label: 'SÜRPRİZE AÇIK', sur: 77, started: true }), // started bayrağı → dışarıda
  ], { now: NOW });
  assert.deepEqual(s.strong.map((x) => x.no), [2]);
  assert.deepEqual(s.surprises, []);
  assert.equal(s.startedCount, 2);
});

test('özet: aday yoksa liste BOŞ döner — zorla doldurulmaz', () => {
  const s = buildWeekSummary([m(1, { label: 'DİKKAT' }), m(2, { label: 'VERİ YOK' })], { now: NOW });
  assert.deepEqual(s.strong, []);
  assert.deepEqual(s.surprises, []);
});

test('özet: denk güç sayımı — en yüksek ihtimal %45 altındaysa denk sayılır', () => {
  const s = buildWeekSummary([
    m(1, { probs: { 1: 40, 0: 30, 2: 30 } }),   // max 40 < 45 → denk
    m(2, { probs: { 1: 60, 0: 22, 2: 18 } }),   // max 60 → değil
    m(3, {}),                                    // ihtimal yok → sayılmaz (uydurulmaz)
  ], { now: NOW });
  assert.equal(s.balanced, 1);
});

test('matchLine: kısa ad önceliği ve güvenli geri düşüş', () => {
  assert.equal(matchLine({ home: { mediumName: 'GS' }, away: { name: 'Fenerbahçe' } }), 'GS - Fenerbahçe');
  assert.equal(matchLine({}), '? - ?');
});
