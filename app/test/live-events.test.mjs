// CANLI OLAY ŞERİDİ + BASKI GÖSTERGESİ TESTLERİ (saf modül).
// Kural: uydurma dakika/uydurma baskı yok; veri yetersizse null/boş döner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEvent, normalizeEvents, timelineMarkers, positionOf,
  goalProgression, pressureIndex, sortStats, REG_MINUTES,
} from '../src/liveEvents.js';

const EVENTS = [
  { minute: 23, type: 'Goal', detail: 'Normal Goal', side: 'home', player: 'A' },
  { minute: 41, type: 'Card', detail: 'Yellow Card', side: 'away', player: 'B' },
  { minute: 12, type: 'subst', detail: 'Substitution 1', side: 'home', player: 'C' },
  { minute: 67, type: 'Card', detail: 'Red Card', side: 'away', player: 'D' },
  { minute: 90, extra: 3, type: 'Goal', detail: 'Penalty', side: 'away', player: 'E' },
];

test('olaylar: normalize + dakikaya göre sıralanır', () => {
  const evs = normalizeEvents(EVENTS);
  assert.deepEqual(evs.map((e) => e.at), [12, 23, 41, 67, 93]);
  assert.equal(evs[1].kind, 'goal');
  assert.equal(evs[2].kind, 'yellow');
  assert.equal(evs[3].kind, 'red');
  assert.equal(evs[4].penalty, true);
});

test('olaylar: dakikasız / tanınmayan olay ATILIR (uydurma dakika yok)', () => {
  assert.equal(normalizeEvent({ type: 'Goal', side: 'home' }), null, 'dakika yoksa olay yok');
  assert.equal(normalizeEvent({ minute: 10, type: 'Whatever' }), null, 'bilinmeyen tür atılır');
  assert.equal(normalizeEvent(null), null);
  assert.deepEqual(normalizeEvents(null), []);
});

test('olaylar: VAR ile iptal edilen gol GOL SAYILMAZ (resmî skorla çelişmez)', () => {
  const evs = normalizeEvents([{ minute: 30, type: 'Goal', detail: 'Goal cancelled', side: 'home' }]);
  assert.deepEqual(evs, []);
  assert.deepEqual(goalProgression([{ minute: 30, type: 'Goal', detail: 'Goal Disallowed', side: 'home' }]), []);
});

test('şerit: yalnız gol ve kırmızı kart gösterilir', () => {
  const marks = timelineMarkers(EVENTS);
  assert.deepEqual(marks.map((m) => m.kind), ['goal', 'red', 'goal']);
  assert.ok(marks.every((m) => m.pos >= 0 && m.pos <= 1), 'konum 0..1 arasında');
  assert.deepEqual(timelineMarkers([]), [], 'olay yoksa şerit yok');
});

test('şerit: uzatma dakikası taşmaz, 90+ sona oturur', () => {
  assert.equal(positionOf(45, 0), 0.5);
  assert.equal(positionOf(0, 0), 0);
  assert.equal(positionOf(120, 0), 1, 'kap dışına taşmaz');
  const last = timelineMarkers(EVENTS).at(-1);
  assert.ok(last.pos > 0.9 && last.pos <= 1, "90+3' sona yakın");
});

test('gol akışı: koşan skor doğru, kendi kalesine karşı takıma yazılır', () => {
  const prog = goalProgression([
    { minute: 10, type: 'Goal', detail: 'Normal Goal', side: 'home' },
    { minute: 20, type: 'Goal', detail: 'Own Goal', side: 'home' },
    { minute: 30, type: 'Goal', detail: 'Penalty', side: 'away' },
  ]);
  assert.deepEqual(prog.map((g) => `${g.home}-${g.away}`), ['1-0', '1-1', '1-2']);
  assert.equal(prog[1].ownGoal, true);
  assert.equal(prog[1].side, 'away', 'kendi kalesine gol rakibe yazılır');
  assert.equal(prog[2].penalty, true);
});

test('gol akışı: takımı belirsiz gol skora yazılmaz', () => {
  assert.deepEqual(goalProgression([{ minute: 5, type: 'Goal', detail: 'Normal Goal' }]), []);
});

const STATS = [
  { type: 'Ball Possession', home: '58%', away: '42%' },
  { type: 'Total Shots', home: 12, away: 6 },
  { type: 'Shots on Goal', home: 5, away: 1 },
  { type: 'Fouls', home: 8, away: 11 },
];

test('baskı: gerçek istatistiklerden pay hesaplanır, toplam 100', () => {
  const pr = pressureIndex(STATS);
  assert.ok(pr, 'yeterli veri var');
  assert.equal(pr.home + pr.away, 100);
  assert.ok(pr.home > 60, 'her ölçüde üstün takım baskıda görünür');
  assert.ok(pr.basis.includes('Şut') && pr.basis.includes('Topla oynama'));
  assert.ok(!pr.basis.includes('Faul'), 'faul baskı ölçüsü değil');
});

test('baskı: yetersiz veride GÖSTERGE ÜRETİLMEZ (uydurma yok)', () => {
  assert.equal(pressureIndex([]), null);
  assert.equal(pressureIndex(null), null);
  assert.equal(pressureIndex([{ type: 'Total Shots', home: 4, away: 2 }]), null, 'tek ölçü yetmez');
  assert.equal(pressureIndex([{ type: 'Total Shots', home: null, away: 2 }, { type: 'Corner Kicks', home: 3, away: null }]), null, 'eksik taraf sayılmaz');
  assert.equal(pressureIndex([{ type: 'Total Shots', home: 0, away: 0 }, { type: 'Corner Kicks', home: 0, away: 0 }]), null, '0-0 veri taşımaz');
});

test('baskı: tek eksik ölçü diğerlerini bozmaz', () => {
  const pr = pressureIndex([
    { type: 'Total Shots', home: 10, away: 10 },
    { type: 'Corner Kicks', home: 5, away: 5 },
    { type: 'Shots on Goal', home: null, away: 3 },
  ]);
  assert.equal(pr.home, 50);
  assert.equal(pr.basis.length, 2);
});

test('istatistik sıralama: önemli satırlar üstte, bilinmeyen sona', () => {
  const sorted = sortStats([
    { type: 'Offsides' }, { type: 'Total Shots' }, { type: 'Bilinmeyen' }, { type: 'Ball Possession' },
  ]);
  assert.deepEqual(sorted.map((s) => s.type), ['Ball Possession', 'Total Shots', 'Offsides', 'Bilinmeyen']);
  assert.equal(REG_MINUTES, 90);
});
