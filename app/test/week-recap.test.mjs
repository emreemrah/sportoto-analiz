// HAFTA KAPANIŞI TESTLERİ (saf modül).
// Kural: yalnız resmî sonuç sayılır, karşılaştırma yalnız ortak maçlarda,
// veri yoksa sayı üretilmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeekRecap, recapHeadline, isOfficiallyResolved, expandSymbol, normResult } from '../src/weekRecap.js';

const M = (no, home, away, result, score, sym) => ({
  no, home: { name: home }, away: { mediumName: away },
  result, score, prediction: sym ? { symbol: sym } : null,
});

// 4 resmî sonuçlanmış + 1 bekleyen
const WEEK = [
  M(1, 'A', 'B', '1', { home: 2, away: 0 }, '1'),      // sistem ✔
  M(2, 'C', 'D', '2', { home: 0, away: 1 }, '1'),      // sistem ✘
  M(3, 'E', 'F', 'X', { home: 1, away: 1 }, '10'),     // sistem ✔ (çifte)
  M(4, 'G', 'H', '2', { home: 0, away: 3 }, '1'),      // sistem ✘
  M(5, 'I', 'J', null, null, '1'),                      // resmî sonuç YOK
];
const SEL = [
  { no: 1, selectedOutcomes: ['1'] },        // ✔ (sistem de ✔)
  { no: 2, selectedOutcomes: ['2'] },        // ✔ (sistem ✘) → user-win
  { no: 3, selectedOutcomes: ['1'] },        // ✘ (sistem ✔) → system-win
  { no: 4, selectedOutcomes: ['1', 'X'] },   // ✘ (sistem ✘) → both-missed
  { no: 5, selectedOutcomes: ['1'] },        // sonuç yok → sayılmaz
];

test('kapanış: yalnız RESMÎ sonuçlanan maçlar sayılır', () => {
  const r = buildWeekRecap({ matches: WEEK, selections: SEL });
  assert.equal(r.official.total, 5);
  assert.equal(r.official.resolved, 4, 'skoru/sonucu olmayan maç sayılmaz');
  assert.equal(r.official.pending, 1);
  assert.equal(r.official.complete, false);
  assert.equal(r.rows.length, 4);
});

test('kapanış: sistem ve kullanıcı isabetleri ayrı ayrı doğru', () => {
  const r = buildWeekRecap({ matches: WEEK, selections: SEL });
  assert.deepEqual(r.system, { made: 4, correct: 2, accuracy: 50 });
  assert.deepEqual(r.user, { made: 4, correct: 2, accuracy: 50 });
});

test('kapanış: karşılaştırma yalnız ORTAK maçlarda ve berabere doğru okunur', () => {
  const r = buildWeekRecap({ matches: WEEK, selections: SEL });
  assert.deepEqual(r.head2head, { matches: 4, user: 2, system: 2, winner: 'tie' });
  assert.match(recapHeadline(r), /berabere/);
});

test('kapanış: öne çıkanlar doğru sınıflanır ve sıralanır', () => {
  const r = buildWeekRecap({ matches: WEEK, selections: SEL });
  assert.deepEqual(r.highlights.map((h) => h.kind), ['user-win', 'both-missed', 'system-win']);
  const win = r.highlights[0];
  assert.equal(win.no, 2);
  assert.equal(win.user.pick, '2');
  assert.equal(win.system.pick, '1');
  assert.equal(win.score, '0-1');
  assert.equal(win.away, 'D', 'mediumName kullanılır');
});

test('kapanış: kupon yoksa kullanıcı karnesi ÜRETİLMEZ, sistem ıskaları listelenir', () => {
  const r = buildWeekRecap({ matches: WEEK, selections: [] });
  assert.equal(r.user, null, 'uydurma kullanıcı karnesi yok');
  assert.equal(r.head2head, null, 'karşılaştırılacak ortak maç yok');
  assert.deepEqual(r.highlights.map((h) => h.kind), ['system-missed', 'system-missed']);
  assert.match(recapHeadline(r), /kayıtlı kuponun yok/);
});

test('kapanış: hiç resmî sonuç yoksa sayı üretilmez', () => {
  const r = buildWeekRecap({ matches: [M(1, 'A', 'B', null, null, '1')], selections: SEL });
  assert.equal(r.hasData, false);
  assert.equal(r.system, null);
  assert.equal(r.user, null);
  assert.equal(r.head2head, null);
  assert.match(recapHeadline(r), /açıklandıkça/);
  const empty = buildWeekRecap({});
  assert.equal(empty.hasData, false);
  assert.equal(empty.official.total, 0);
});

test('kapanış: kullanıcı önde olduğunda başlık bunu söyler', () => {
  const sel = [{ no: 2, selectedOutcomes: ['2'] }, { no: 4, selectedOutcomes: ['2'] }];
  const r = buildWeekRecap({ matches: WEEK, selections: sel });
  assert.deepEqual(r.head2head, { matches: 2, user: 2, system: 0, winner: 'user' });
  assert.match(recapHeadline(r), /sen öndesin/);
});

test('kapanış: tüm sonuçlar gelince "Hafta kapandı" denir', () => {
  const done = WEEK.slice(0, 4);
  const r = buildWeekRecap({ matches: done, selections: SEL });
  assert.equal(r.official.complete, true);
  assert.match(recapHeadline(r), /^Hafta kapandı/);
});

test('yardımcılar: sembol açma ve sonuç normalize', () => {
  assert.deepEqual(expandSymbol('102'), ['1', 'X', '2']);
  assert.deepEqual(expandSymbol('-'), []);
  assert.deepEqual(expandSymbol(null), []);
  assert.equal(normResult('0'), 'X');
  assert.equal(normResult('x'), 'X');
  assert.equal(normResult('5'), null, 'tanınmayan sonuç uydurulmaz');
  assert.equal(isOfficiallyResolved({ result: '1' }), false, 'skor yoksa resmî sayılmaz');
  assert.equal(isOfficiallyResolved({ score: { home: 1, away: 0 } }), false, 'sonuç yoksa resmî sayılmaz');
});
