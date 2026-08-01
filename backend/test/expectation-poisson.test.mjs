// RADAR 2 v2 (POISSON xG MODELİ) TESTLERİ
// Çapa veriler GERÇEK bültenden (1525 / 51. Hafta): Sirius–Göteborg ve
// Ilves–Lahti — eski kodun 0/25/75 ve 0/76/24 ürettiği kanıtlanmış vakalar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeExpectationRadar, poissonScores } from '../src/radar/expectationRadar.js';

// Gerçek veri: Sirius (ev, 13 maçta 11G 2B 0M — namağlup lider) vs Göteborg.
const SIRIUS_GOTEBORG = {
  no: 7,
  analysis: { favorite: { symbol: '1' } },
  stats: {
    home: {
      standing: { played: 13, wins: 11, draws: 2, losses: 0, ppg: 2.6923 },
      season: {
        xgFor: 1.71, xgAgainst: 1.46, xgForHome: 1.84, xgForAway: 1.6,
        xgAgainstHome: 1.48, xgAgainstAway: 1.45,
        goalsPerGame: 2.77, concededPerGame: 1.23, recentPpg: 0, avg: { shots: 15.31 },
      },
    },
    away: {
      standing: { played: 13, wins: 3, draws: 4, losses: 6, ppg: 1.0 },
      season: {
        xgFor: 1.74, xgAgainst: 1.55, xgForHome: 1.89, xgForAway: 1.61,
        xgAgainstHome: 1.28, xgAgainstAway: 1.77,
        goalsPerGame: 1.23, concededPerGame: 2.23, recentPpg: 0, avg: { shots: 16.69 },
      },
    },
  },
};

// Gerçek veri: Ilves–Lahti (dengeli maç; eski kod 1'e %0 vermişti).
const ILVES_LAHTI = {
  no: 4,
  analysis: { favorite: { symbol: '1' } },
  stats: {
    home: {
      standing: { played: 16, wins: 5, draws: 4, losses: 7, ppg: 1.1875 },
      season: {
        xgFor: 1.44, xgAgainst: 1.63, xgForHome: 1.29, xgForAway: 1.55,
        xgAgainstHome: 1.42, xgAgainstAway: 1.8,
        goalsPerGame: 1.75, concededPerGame: 1.88, recentPpg: 0, avg: { shots: 11.75 },
      },
    },
    away: {
      standing: { played: 16, wins: 6, draws: 4, losses: 6, ppg: 1.375 },
      season: {
        xgFor: 1.43, xgAgainst: 1.21, xgForHome: 1.47, xgForAway: 1.38,
        xgAgainstHome: 1.06, xgAgainstAway: 1.41,
        goalsPerGame: 1.25, concededPerGame: 0.94, recentPpg: 0, avg: { shots: 12.5 },
      },
    },
  },
};

const deep = (o) => JSON.parse(JSON.stringify(o));

test('poissonScores: toplam TAM 100 ve gerçekçi λ aralığında hiçbir taraf 0 değil', () => {
  for (const lh of [0.6, 0.9, 1.4, 1.8, 2.2, 2.6]) {
    for (const la of [0.6, 0.9, 1.4, 1.8, 2.2, 2.6]) {
      const s = poissonScores(lh, la);
      assert.equal(s.home + s.draw + s.away, 100, `toplam 100 olmalı (λ ${lh}/${la})`);
      assert.ok(s.home > 0 && s.draw > 0 && s.away > 0, `taraflar 0 olamaz (λ ${lh}/${la}): ${JSON.stringify(s)}`);
    }
  }
});

test('poissonScores: eşit λ → ev ile deplasman dengede, X doğal bantta (%18-35)', () => {
  const s = poissonScores(1.4, 1.4);
  assert.ok(Math.abs(s.home - s.away) <= 1, `denk λ'da fark ≤1: ${JSON.stringify(s)}`);
  assert.ok(s.draw >= 18 && s.draw <= 35, `X doğal bantta: ${s.draw}`);
});

test('poissonScores: bariz üstün ev (2.4 vs 0.8) → ev >%55 ama karşı taraf yine >0', () => {
  const s = poissonScores(2.4, 0.8);
  assert.ok(s.home > 55, `ev baskın olmalı: ${s.home}`);
  assert.ok(s.away > 0, 'zayıf taraf bile 0 gösterilmez');
});

test('REGRESYON (Sirius–Göteborg): namağlup lider ASLA %0 olamaz; model evi önde gösterir', () => {
  const r = computeExpectationRadar(deep(SIRIUS_GOTEBORG), {});
  assert.equal(r.hasData, true);
  assert.equal(r.homeScore + r.drawScore + r.awayScore, 100);
  assert.ok(r.homeScore >= 35, `eski kod 0 veriyordu; model gerçekçi olmalı: ${r.homeScore}`);
  assert.ok(r.homeScore > r.awayScore, 'saha-ayarlı xG üstünlüğü evde');
  assert.ok(r.drawScore >= 15 && r.drawScore <= 35, `X doğal bantta: ${r.drawScore}`);
  // Sürdürülebilirlik uyarısı KAYBOLMAZ: 2.77 gol vs 1.71 xG → regresyon notu.
  assert.ok(r.negatives.some((t) => t.includes('regresyon')), 'aşırı skor üretimi uyarısı kalmalı');
  assert.ok(r.favoriteFailureRisk >= 40, `overperformans favori riskini yükseltir: ${r.favoriteFailureRisk}`);
});

test('REGRESYON (Ilves–Lahti): dengeli maçta uç dağılım yok (eski kod 0/76/24 veriyordu)', () => {
  const r = computeExpectationRadar(deep(ILVES_LAHTI), {});
  assert.equal(r.hasData, true);
  for (const v of [r.homeScore, r.drawScore, r.awayScore]) {
    assert.ok(v >= 15 && v <= 50, `dengeli maçta tüm taraflar 15-50 bandında olmalı: ${JSON.stringify([r.homeScore, r.drawScore, r.awayScore])}`);
  }
  // Market favorisi (1) xG tarafında desteklenmiyor → sahte favori işareti kalır.
  assert.equal(r.details.fakeFavorite, true);
  assert.ok(r.negatives.some((t) => t.includes('desteklemiyor')));
});

test('recentPpg=0 JUNK verisi trend sinyali ÜRETMEZ ve eksik-veri olarak raporlanır', () => {
  const r = computeExpectationRadar(deep(SIRIUS_GOTEBORG), {});
  assert.ok(!r.activeSignals.some((s) => s.key === 'homeRecentDrop'),
    'hayalet "son dönem düşüşü" sinyali üretilmemeli (kaynak 0 döndürüyor)');
  assert.ok(r.missingSignals.some((s) => s.key === 'recentTrend'), 'eksik veri dürüstçe raporlanmalı');
});

test('GERÇEK recentPpg değeri trend sinyalini üretmeye devam eder (koruma aşırıya kaçmaz)', () => {
  const m = deep(SIRIUS_GOTEBORG);
  m.stats.home.season.recentPpg = 0.8;              // gerçek düşüş: 0.8 < 2.69 − 0.5
  const r = computeExpectationRadar(m, {});
  assert.ok(r.activeSignals.some((s) => s.key === 'homeRecentDrop'), 'gerçek veriyle sinyal çalışmalı');
  assert.ok(!r.missingSignals.some((s) => s.key === 'recentTrend'));
});

test('yeni sezon junk\'ı (0 maç + 0.00 xG) → radar devre dışı, veri kalitesi yüksek GÖSTERİLMEZ', () => {
  const m = {
    no: 3,
    stats: {
      home: { standing: { played: 0, wins: 0, draws: 0, losses: 0, ppg: 0 }, season: { xgFor: 0, xgAgainst: 0, goalsPerGame: 0, concededPerGame: 0, recentPpg: 0, avg: { shots: 0 } } },
      away: { standing: { played: 0, wins: 0, draws: 0, losses: 0, ppg: 0 }, season: { xgFor: 0, xgAgainst: 0, goalsPerGame: 0, concededPerGame: 0, recentPpg: 0, avg: { shots: 0 } } },
    },
  };
  const r = computeExpectationRadar(m, {});
  assert.equal(r.hasData, false);
  assert.equal(r.dataQuality, 0, `sıfır-veri %90 kalite gösteriyordu; artık 0: ${r.dataQuality}`);
  assert.ok(r.missingSignals.some((s) => s.key === 'xg'));
});

test('xG hiç yoksa (null) eski dürüst davranış korunur: hasData=false', () => {
  const r = computeExpectationRadar({ no: 1, stats: { home: { season: {} }, away: { season: {} } } }, {});
  assert.equal(r.hasData, false);
  assert.equal(r.status, 'insufficient');
});

test('favori riski taban = 100 − favorinin model olasılığı (X ayrıca eklenmez, çifte sayım yok)', () => {
  // Ilves: marketFav=1; attDiff ≤ 0 → bump 12; hOver 0.31 < 0.35 → ikinci bump yok.
  const r = computeExpectationRadar(deep(ILVES_LAHTI), {});
  const expected = Math.max(0, Math.min(100, Math.round((100 - r.homeScore) * 0.8 + 12)));
  assert.equal(r.favoriteFailureRisk, expected);
});

test('λ değerleri şeffafça raporlanır (details.xgModel) — metodoloji izlenebilir', () => {
  const r = computeExpectationRadar(deep(SIRIUS_GOTEBORG), {});
  assert.equal(r.details.xgModel.method, 'independent-poisson-0-10');
  // λ_ev = (1.84 + 1.77)/2 = 1.805 ≈ 1.81 · λ_dep = (1.61 + 1.48)/2 = 1.545 ≈ 1.55
  assert.ok(Math.abs(r.details.xgModel.lambdaHome - 1.81) <= 0.01);
  assert.ok(Math.abs(r.details.xgModel.lambdaAway - 1.55) <= 0.01);
});

test('trend, ölü kaynak alanı yerine GERÇEK son-5 form dizisinden türetilir; "Eksik" uyarısı kalkar', () => {
  const m = deep(SIRIUS_GOTEBORG);                    // recentPpg=0 (junk) her iki tarafta
  m.stats.home.last5 = ['M', 'B', 'M', 'B', 'M'];    // (1+1)/5 = 0.4 vs sezon 2.69 → düşüş (dep lehine)
  m.stats.away.last5 = ['G', 'B', 'G', 'G', 'G'];    // 2.6 vs sezon 1.0 → yükseliş (dep lehine)
  const r = computeExpectationRadar(m, {});
  assert.ok(!r.missingSignals.some((s) => s.key === 'recentTrend'), 'gerçek form verisi varken uyarı kalmamalı');
  const drop = r.activeSignals.find((s) => s.key === 'homeRecentDrop');
  const rise = r.activeSignals.find((s) => s.key === 'awayRecentRise');
  assert.ok(drop && rise, 'iki gerçek trend sinyali de üretilmeli');
  assert.equal(drop.source, 'Son 5 maç sonucu (form)', 'kaynak şeffaf: türetildiği yer yazılır');
  assert.ok(drop.note.includes('0.4') && drop.note.includes('2.7'), `değerler notta: ${drop.note}`);
});

test('simetri: deplasman form düşüşü EV lehine sinyal üretir (eski kodda bu yön hiç yoktu)', () => {
  const m = deep(SIRIUS_GOTEBORG);
  m.stats.home.last5 = ['G', 'G', 'G', 'B'];         // 2.5 vs 2.69 → nötr (sinyal yok)
  m.stats.away.last5 = ['M', 'M', 'M', 'M', 'B'];    // 0.2 vs 1.0 → düşüş → side home
  const r = computeExpectationRadar(m, {});
  const d = r.activeSignals.find((s) => s.key === 'awayRecentDrop');
  assert.ok(d, 'deplasman düşüş sinyali üretilmeli');
  assert.equal(d.side, 'home');
  assert.ok(!r.activeSignals.some((s) => s.key === 'homeRecentDrop' || s.key === 'homeRecentRise'));
});

test('kısa form dizisi (<4 maç) trend ÜRETMEZ — 1-2 maçlık gürültü trend sayılmaz', () => {
  const m = deep(SIRIUS_GOTEBORG);
  m.stats.home.last5 = ['G', 'G'];
  m.stats.away.last5 = ['M'];
  const r = computeExpectationRadar(m, {});
  assert.ok(!r.activeSignals.some((s) => s.family === 'form'), 'kısa diziden trend çıkmamalı');
  assert.ok(r.missingSignals.some((s) => s.key === 'recentTrend'), 'dürüst eksik raporu kalmalı');
});

test('trend sinyalleri FORM ailesinde: xG kanıtlarını aile içi azaltmayla ezmez', () => {
  const m = deep(SIRIUS_GOTEBORG);
  m.stats.home.season.recentPpg = 0.8;              // homeRecentDrop tetiklenir
  const r = computeExpectationRadar(m, {});
  const trend = r.activeSignals.find((s) => s.key === 'homeRecentDrop');
  assert.equal(trend.family, 'form');
  assert.ok(r.families.form, 'form ailesi ayrı raporlanmalı');
});
