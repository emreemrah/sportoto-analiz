// DNA DÜRÜSTLÜK TESTLERİ (T5) — sıra/oynanma örüntülerinin karara sızmaması.
// Dayanak: kupon sırasının maç sonucuyla nedensel bağı yoktur (bağımsız
// çoklu-model araştırması, Ağustos 2026). Radar 5 yalnız bilgi panelidir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, MIN_SAMPLE_FOR_PCT } from '../src/radar/playedDna.js';
import { combineMaster } from '../src/radar/masterRadar.js';
import { computeSurpriseDna } from '../src/radar/surpriseDna.js';
import { RADAR_IDS, CLASSIFICATIONS } from '../src/radar/config.js';

const kayit = (result) => ({ result });
const coreRadar = (over = {}) => ({
  hasData: true, dataQuality: 80, name: 'Radar Test',
  homeScore: 60, drawScore: 25, awayScore: 15,
  favoriteFailureRisk: 30, direction: '1',
  positives: ['çekirdek gerekçe'], negatives: [], missingSignals: [],
  ...over,
});
const memoryRadar = (over = {}) => ({
  hasData: true, dataQuality: 90, name: 'Radar 5 · Bülten DNA',
  homeScore: null, drawScore: null, awayScore: null,
  favoriteFailureRisk: 90, direction: null,
  positives: ['Geçmişte 14. sırada favori zorlanmış'], negatives: [], missingSignals: [],
  ...over,
});

// ——— summarize: küçük örneklemde yüzde YOK ———
test(`summarize: n < ${MIN_SAMPLE_FOR_PCT} iken yüzde üretilmez — "1 kayıt → %100" yanılsaması bitti`, () => {
  const s = summarize([kayit('2')]);
  assert.equal(s.insufficient, true);
  assert.equal(s.pct, null, 'toplu yüzde üretilmemeli');
  assert.ok(s.text.includes('yetersiz'), 'metin örneklem yetersizliğini söylemeli');
  assert.ok(!s.text.includes('%'), `metinde yüzde işareti olmamalı: "${s.text}"`);
  assert.equal(s.total, 1, 'adet yine de şeffaf');
});

test('summarize: karışık küçük örneklem adet bazlı yazılır, sayımlar korunur', () => {
  const s = summarize([kayit('1'), kayit('1'), kayit('X')]);
  assert.equal(s.insufficient, true);
  assert.deepEqual(s.counts, { '1': 2, X: 1, '2': 0 });
  assert.ok(s.text.includes('2 kez') && s.text.includes('1 kez'), s.text);
});

test(`summarize: n ≥ ${MIN_SAMPLE_FOR_PCT} iken yüzde + n birlikte gösterilir`, () => {
  const s = summarize(Array.from({ length: 12 }, (_, i) => kayit(i < 8 ? '1' : 'X')));
  assert.equal(s.insufficient, false);
  assert.ok(s.pct && typeof s.pct['1'] === 'number');
  assert.ok(s.text.includes('n=12'), `örneklem her zaman görünür: "${s.text}"`);
});

test('summarize: boş liste "Geçmiş sonuç yok" der, insufficient bayrağı kalkmaz', () => {
  const s = summarize([]);
  assert.equal(s.total, 0);
  assert.equal(s.insufficient, false);
});

// ——— combineMaster: Radar 5 karara katılamaz ———
test('MASTER: yalnız Radar 5 aktifken karar tabanı BOŞTUR (sınıf üretilmez, risk yok)', () => {
  const m = combineMaster({ [RADAR_IDS.MEMORY]: memoryRadar() });
  assert.equal(m.activeRadarCount, 0, 'Radar 5 aktif sayılmaz');
  assert.equal(m.classification, CLASSIFICATIONS.INSUFFICIENT);
  assert.equal(m.favoriteFailureRisk, null, 'sıra bazlı risk ortalamaya giremez');
  assert.equal(m.weights[RADAR_IDS.MEMORY], 0, 'ağırlık sözleşmesi: alan var, katkı 0');
});

test('MASTER: Radar 5 riski (90) çekirdek radar riskini (30) DEĞİŞTİRMEZ', () => {
  const m = combineMaster({
    [RADAR_IDS.PERFORMANCE]: coreRadar(),
    [RADAR_IDS.MEMORY]: memoryRadar(),
  });
  assert.equal(m.favoriteFailureRisk, 30, 'eski davranış 90 ile harmanlıyordu — artık yalnız çekirdek');
  assert.equal(m.activeRadarCount, 1, 'aktif sayaç yalnız çekirdek radarları sayar');
});

test('MASTER: Radar 5 gerekçeleri karar gerekçelerine sızmaz', () => {
  const m = combineMaster({
    [RADAR_IDS.PERFORMANCE]: coreRadar(),
    [RADAR_IDS.MEMORY]: memoryRadar(),
  });
  const tumu = [...m.topReasons, ...m.riskReasons].map((r) => r.text).join(' | ');
  assert.ok(!tumu.includes('14. sırada'), `sıra gerekçesi karar gerekçesi olamaz: ${tumu}`);
  assert.ok(tumu.includes('çekirdek gerekçe'), 'çekirdek radar gerekçeleri korunur');
});

// ——— surpriseDna: sıra sinyali puana ve uzlaşmaya giremez ———
test('DNA: memoryAssist, yüksek riskli hafızada bile daima unavailable (payda dışı)', () => {
  const dna = computeSurpriseDna({
    [RADAR_IDS.PERFORMANCE]: coreRadar(),
    [RADAR_IDS.MEMORY]: memoryRadar({ favoriteFailureRisk: 95 }),
  });
  const f = dna.features.find((x) => x.key === 'memoryAssist');
  assert.equal(f.state, 'unavailable');
  assert.equal(f.points, 0);
});

test('DNA: radar uzlaşması Radar 5 oyunu saymaz (1 çekirdek + hafıza → kıyas yapılamaz)', () => {
  const dna = computeSurpriseDna({
    [RADAR_IDS.PERFORMANCE]: coreRadar({ favoriteFailureRisk: 70 }),
    [RADAR_IDS.MEMORY]: memoryRadar({ favoriteFailureRisk: 95 }),
  });
  const f = dna.features.find((x) => x.key === 'radarConsensus');
  assert.equal(f.state, 'unavailable', 'hafıza oy sayılsaydı 2 radar görünür ve uzlaşma üretilirdi');
});
