// SEZON MAÇ LOGU FİLTRE MOTORU — 15 kriterin "Güçlüye karşı / Ev içi / Son 5"
// kırılımı GERÇEK maç satırlarından hesaplanır; log yoksa eski yola düşülür.
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamMatchLog } from '../src/analysis/opponentStrength.js';
import { CATALOG_MAP, evaluateCriterion } from '../src/analysis/criterionCatalog.js';

const DAY = 86400; const T0 = 1700000000;
const g = (homeId, awayId, sh, sa, day) => ({
  homeId, awayId, homeName: `T${homeId}`, awayName: `T${awayId}`,
  score: { home: sh, away: sa }, status: 'finished', dateUnix: T0 + day * DAY,
});

test('teamMatchLog: sonuç+skor+saha+MAÇ ANINDAKİ rakip sınıfı (gerçek puan farkı ≥10 kuralı)', () => {
  // T1 hep kazanır (3.0 ppg), T6 hep kaybeder (0.0 ppg).
  const base = [];
  for (let w = 0; w < 6; w++) { base.push(g(1, 6, 3, 0, w * 7)); base.push(g(2, 5, 2, 1, w * 7)); base.push(g(3, 4, 1, 1, w * 7)); }
  // T50: 6 beraberlik (1.0 ppg) sonra 40. gün LİDERE deplasmanda kaybetti →
  // o an fark (3.0−1.0)×6 = 12 puan ≥ 10 → rakip GÜÇLÜ sınıfında.
  const fills = [0, 1, 2, 3, 4, 5].map((i) => g(50, 31 + i, 1, 1, 5 + i * 3));
  const ms = [...base, ...fills, g(1, 50, 3, 1, 40)];
  const log = teamMatchLog(50, ms, { beforeUnix: T0 + 60 * DAY });
  assert.equal(log.length, 7);
  assert.equal(log[0].oppName, 'T1'); assert.equal(log[0].isHome, false); assert.equal(log[0].result, 'M');
  assert.equal(log[0].oppTier, 'strong', 'lidere karşı → güçlü (fark 12 ≥ 10)');
  // LİDERİN logu: kendinden çok altta kalan rakipler → zayıf (T50: fark −12, T6: −15).
  const log1 = teamMatchLog(1, ms, { beforeUnix: T0 + 60 * DAY });
  assert.equal(log1[0].oppName, 'T50'); assert.equal(log1[0].result, 'G'); assert.equal(log1[0].isHome, true);
  assert.equal(log1[0].oppTier, 'weak', 'lider için 12 puan altındaki rakip → zayıf');
  assert.equal(log1[1].oppName, 'T6'); assert.equal(log1[1].oppTier, 'weak', 'sonuncuya karşı → zayıf');
  // Az maçlı dolgu rakipleri sınıflandırılmaz — uydurma yok:
  assert.ok(log.some((r) => r.oppTier === 'unknown'), 'yetersiz maçlı rakip "unknown" kalır');
  assert.ok(log.every((r) => ['strong', 'mid', 'weak', 'unknown'].includes(r.oppTier)));
});

// Sentetik matchLog ile kriter değerlendirme (log satırları doğrudan verilir).
const row = (result, gf, ga, isHome, oppTier) => ({ result, gf, ga, isHome, oppName: 'X', oppTier });
function matchWith(hLog, aLog) {
  return {
    no: 1, home: { name: 'Ev' }, away: { name: 'Dep' },
    stats: {
      home: { standing: { played: 12, ppg: 1.5, wins: 6, draws: 0, losses: 6, points: 18, position: 5 }, season: {}, matchLog: hLog },
      away: { standing: { played: 12, ppg: 1.2, wins: 4, draws: 2, losses: 6, points: 14, position: 8 }, season: {}, matchLog: aLog },
    },
  };
}

test('MERKEZÎ FİLTRE: "Güçlüye karşı" galibiyet oranı yalnız güçlü-rakip satırlarından; [Filtre] notu + n', () => {
  const hLog = [row('G', 2, 1, true, 'strong'), row('M', 0, 1, false, 'strong'), row('G', 3, 0, true, 'weak'), row('G', 1, 0, false, 'mid')];
  const aLog = [row('M', 0, 2, false, 'strong'), row('M', 1, 3, true, 'strong'), row('G', 2, 0, false, 'weak')];
  const r = evaluateCriterion(CATALOG_MAP.wins, matchWith(hLog, aLog), { filters: { period: 'season', venueScope: 'overall', opponentStrength: 'strong' } });
  assert.equal(r.available, true);
  assert.equal(r.filterApplied, true, 'filtre gerçekten uygulanmalı');
  assert.equal(r.side, 'home', 'ev güçlüye karşı 1/2, dep 0/2 → ev önde');
  assert.ok(/\[Filtre: Güçlü rakipler — n=2\/2\]/.test(r.note), r.note);
});

test('MERKEZÎ FİLTRE: "Ev içi/Dep dışı" + temiz kale — saha kırılımı satırlardan', () => {
  const hLog = [row('G', 2, 0, true, 'mid'), row('G', 1, 0, true, 'weak'), row('M', 0, 2, false, 'strong')];
  const aLog = [row('B', 1, 1, false, 'mid'), row('M', 0, 1, false, 'mid'), row('G', 2, 0, true, 'weak')];
  const r = evaluateCriterion(CATALOG_MAP.cleanSheet, matchWith(hLog, aLog), { filters: { period: 'season', venueScope: 'split', opponentStrength: 'all' } });
  assert.equal(r.filterApplied, true);
  assert.equal(r.side, 'home', 'ev İÇERİDE 2/2 temiz kale; dep DIŞARIDA 0/2');
  assert.ok(/Ev içi\/Dep dışı/.test(r.note), r.note);
});

test('DÜRÜSTLÜK: filtre örneklemi yetersizse uydurulmaz ("yeterli maç yok"); log yoksa eski yola düşer', () => {
  const az = [row('G', 1, 0, true, 'strong')];
  const r1 = evaluateCriterion(CATALOG_MAP.wins, matchWith(az, az), { filters: { period: 'season', venueScope: 'overall', opponentStrength: 'strong' } });
  assert.equal(r1.available, false);
  assert.ok(/yeterli maç yok/.test(r1.note), r1.note);
  // matchLog YOK → merkezî motor devreye girmez, eski (sezon toplamı) yol çalışır:
  const m2 = matchWith(null, null);
  delete m2.stats.home.matchLog; delete m2.stats.away.matchLog;
  const r2 = evaluateCriterion(CATALOG_MAP.wins, m2, { filters: { period: 'season', venueScope: 'overall', opponentStrength: 'strong' } });
  assert.ok(!r2.filterApplied, 'log yokken filtre uygulanmış GİBİ görünmez');
  assert.equal(r2.available, true, 'sezon toplamı yoluna düşer (6 vs 4 galibiyet)');
});

test('KG Var / Beraberlik eğilimi filtreli satırlardan; X kuralları aynen korunur', () => {
  const hLog = [row('B', 1, 1, true, 'mid'), row('B', 2, 2, false, 'mid'), row('G', 2, 1, true, 'mid'), row('B', 0, 0, false, 'mid')];
  const aLog = [row('B', 1, 1, false, 'mid'), row('M', 1, 2, true, 'mid'), row('B', 2, 2, false, 'mid'), row('B', 1, 1, true, 'mid')];
  const r = evaluateCriterion(CATALOG_MAP.draws, matchWith(hLog, aLog), { filters: { period: 'season', venueScope: 'overall', opponentStrength: 'mid' } });
  assert.equal(r.filterApplied, true);
  assert.equal(r.side, 'draw', 'yüksek beraberlik oranı → X sinyali (meşru yol)');
});
