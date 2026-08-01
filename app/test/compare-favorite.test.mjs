// GÜÇ KARŞILAŞTIRMASI + FAVORİ TAKIM TESTLERİ (saf modüller).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompareAxes, polygonPoints, COMPARE_AXES } from '../src/compareRadar.js';
import { isFavoriteTeam, favoriteSide } from '../src/favoriteTeam.js';

const FULL = {
  standing: { ppg: 2.0 },
  season: { goalsPerGame: 1.8, concededPerGame: 0.9, xgFor: 1.6, cleanSheetPct: 40 },
  last5: ['G', 'G', 'B', 'G', 'M'],
};
const WEAK = {
  standing: { ppg: 1.0 },
  season: { goalsPerGame: 0.9, concededPerGame: 1.8, xgFor: 0.8, cleanSheetPct: 20 },
  last5: ['M', 'B', 'M', 'G', 'M'],
};

test('karşılaştırma: tam veride 6 eksen üretilir ve büyük olan 100 alır', () => {
  const axes = buildCompareAxes(FULL, WEAK);
  assert.equal(axes.length, COMPARE_AXES.length);
  const ppg = axes.find((a) => a.key === 'ppg');
  assert.equal(ppg.home, 100, 'yüksek PPG 100 almalı');
  assert.equal(ppg.away, 50, '1.0/2.0 → 50');
  const def = axes.find((a) => a.key === 'defense');
  assert.ok(def.home > def.away, 'az gol yiyen savunmada ÜSTÜN görünmeli (ters eksen)');
  assert.equal(def.home, 100);
});

test('karşılaştırma: eksik eksen UYDURULMAZ, atlanır; 3 eksenden azsa hiç çizilmez', () => {
  const partial = { standing: { ppg: 1.5 }, season: { goalsPerGame: 1.2 } }; // 2 ortak eksen
  const axes = buildCompareAxes(partial, { standing: { ppg: 1.1 }, season: { goalsPerGame: 1.0 } });
  assert.deepEqual(axes, [], 'yetersiz ortak veri → grafik yok');

  const four = {
    standing: { ppg: 1.5 },
    season: { goalsPerGame: 1.2, concededPerGame: 1.0, xgFor: 1.1 },
  };
  const axes4 = buildCompareAxes(four, { ...four });
  assert.equal(axes4.length, 4, 'yalnız iki tarafta da olan eksenler');
  assert.ok(axes4.every((a) => a.home === 100 && a.away === 100), 'eşit veride ikisi de 100');
});

test('karşılaştırma: sıfır değerler çökmez (savunmada 0 yenen gol)', () => {
  const clean = { standing: { ppg: 2 }, season: { goalsPerGame: 1, concededPerGame: 0, xgFor: 1 } };
  const leaky = { standing: { ppg: 1 }, season: { goalsPerGame: 1, concededPerGame: 2, xgFor: 1 } };
  const axes = buildCompareAxes(clean, leaky);
  const def = axes.find((a) => a.key === 'defense');
  assert.equal(def.home, 100, 'hiç gol yemeyen savunmada 100');
  assert.ok(def.away < 10, 'çok gol yiyen çok düşük');
});

test('polygonPoints: eksen sayısı kadar nokta, ilk nokta üstte', () => {
  const pts = polygonPoints([100, 100, 100, 100], 100, 100, 50).split(' ');
  assert.equal(pts.length, 4);
  const [x0, y0] = pts[0].split(',').map(Number);
  assert.equal(Math.round(x0), 100);
  assert.equal(Math.round(y0), 50, 'ilk eksen -90° (üst)');
});

test('favori takım: esnek ama temkinli eşleşme', () => {
  assert.equal(isFavoriteTeam('Galatasaray', 'galatasaray'), true);
  assert.equal(isFavoriteTeam('Galatasaray A.Ş.', 'Galatasaray'), true);
  assert.equal(isFavoriteTeam('Sirius', 'sirius'), true);
  assert.equal(isFavoriteTeam('Göteborg', 'goteborg'), false, 'farklı yazım eşleşmez (uydurma eşleşme yok)');
  assert.equal(isFavoriteTeam('Ilves', 'Il'), false, '3 karakterden kısa favori eşleşmez');
  assert.equal(isFavoriteTeam('', 'Fenerbahçe'), false);
});

test('favori takım: maçta taraf bulma', () => {
  const m = { home: { name: 'KFUM Oslo' }, away: { name: 'Molde FK', mediumName: 'Molde' } };
  assert.equal(favoriteSide(m, 'Molde'), 'away');
  assert.equal(favoriteSide(m, 'KFUM'), 'home');
  assert.equal(favoriteSide(m, 'Beşiktaş'), null);
  assert.equal(favoriteSide(m, ''), null);
});
