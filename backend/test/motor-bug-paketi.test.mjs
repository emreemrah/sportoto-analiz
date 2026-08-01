// MOTOR BUG PAKETİ TESTLERİ (T4) — 8 doğrulanmış düzeltmenin kanıtları.
// Her test önce ESKİ hatayı tarif eder, sonra düzeltilmiş davranışı doğrular.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOG_KEYS, CATALOG_MAP } from '../src/analysis/criterionCatalog.js';
import { computeMasterAnalysis } from '../src/analysis/masterEngine.js';
import { buildCriterionScorecard } from '../src/analysis/analysisService.js';
import { normalizeWeights } from '../src/radar/masterRadar.js';
import { RADAR_IDS, MEMORY_WEIGHT_CAP } from '../src/radar/config.js';
import { numN } from '../src/sources/footystats.js';
import { tmpStore } from './helpers/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const profOf = (keys, impact = 'mid') => ({
  id: 'p1', name: 'Test', version: 1, mode: 'manual',
  criteria: Object.fromEntries(CATALOG_KEYS.map((k) => [k, { on: keys.includes(k), impact }])),
});

// Sentetik kriter değerlendirmesi (masterEngine'in okuduğu asgari sözleşme).
const ev = (key, signal, strength, family) => ({
  key, available: true, side: signal === '1' ? 'home' : signal === '2' ? 'away' : 'draw',
  signal, normalizedStrength: strength, signalFamily: family, note: '',
});

// ——— #1: contextual filtresi gerçek kriteri (commonOpponents) yemesin ———
test('BUG 1: yalnız homeAdvantage+commonOpponents sinyalinde motor "veri yetersiz"e DÜŞMEZ', () => {
  const evals = [
    ev('homeAdvantage', '1', 0.25, 'contextual'),
    ev('commonOpponents', '1', 0.5, 'contextual'), // GERÇEK takım-verisi kriteri, aynı ailede
  ];
  const r = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['homeAdvantage', 'commonOpponents']) });
  // ESKİ HATA: family !== 'contextual' filtresi ikisini de eleyip
  // normalized'ı sıfırlıyor ve "veri yetersiz, kapalı (1X2)" diyordu.
  assert.equal(r.mainPrediction, '1', 'commonOpponents gerçek sinyaldir — yön kararı verilmeli');
  assert.ok(r.normalizedSupport1 > 0, 'destek yüzdesi sıfırlanmamalı');
  assert.ok(!(r.decisionNote || '').includes('yalnız yapısal'), 'sahte "veri yetersiz" notu üretilmemeli');
});

test('BUG 1 (bekçi korunur): YALNIZ homeAdvantage varsa hâlâ "veri yetersiz" (sahte kesinlik yok)', () => {
  const evals = [ev('homeAdvantage', '1', 0.25, 'contextual')];
  const r = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['homeAdvantage']) });
  assert.equal(r.closedPrediction, '1X2', 'tek başına sabit ev avantajı yön kararı veremez');
  assert.equal(r.normalizedSupport1, 0, 'sahte %100 gösterilmez');
});

// ——— #2: eksik kaynak verisi 0 değil null ———
test('BUG 2: numN eksik değeri null korur (0 uydurmaz), geçerli sayıyı çevirir', () => {
  assert.equal(numN(null), null);
  assert.equal(numN(undefined), null);
  assert.equal(numN(''), null);
  assert.equal(numN('abc'), null);
  assert.equal(numN('5'), 5);
  assert.equal(numN(0), 0, 'GERÇEK 0 korunur — 0 ile eksik artık ayırt edilir');
});

test('BUG 2 (uçtan uca): bir tarafın puanı eksikse kriter "0 puanlı takım" uydurmaz, analiz dışı kalır', () => {
  const names = { home: 'Ev', away: 'Dep' };
  const r = CATALOG_MAP.points.evaluate({ standing: { points: 25 } }, { standing: { points: null } }, {}, names);
  // ESKİ HATA: kaynak num() eksik alanı 0 yapınca 25-0 kıyası "ev güçlü sinyal" üretiyordu.
  assert.equal(r.available, false, 'tek taraflı veri kıyas DEĞİLDİR — kriter analiz dışı kalmalı');
});

// ——— #3: sabit homeAdvantage karnede ölçülmez ———
test('BUG 3: homeAdvantage karneden hariç (excludeFromScorecard) — sabit sinyal "kriter başarısı" sayılmaz', () => {
  assert.equal(CATALOG_MAP.homeAdvantage.excludeFromScorecard, true);
  const src = readFileSync(join(here, '..', 'src', 'analysis', 'analysisService.js'), 'utf8');
  assert.match(src, /excludeFromScorecard/, 'karne kurulumunda işaret dikkate alınmalı');
});

// ——— #4 + #5: yüzdeler en büyük kalanla 100'e tamamlanır; sıfır destek %0 kalır ———
test('BUG 4: desteği 0 olan seçeneğe yuvarlama payı YAZILMAZ; toplam daima 100', () => {
  const evals = [
    ev('points', '1', 1, 'famA'),
    ev('xgFor', '1', 1, 'famB'),
    ev('formGeneral', 'X', 1, 'famC'),
  ];
  const r = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['points', 'xgFor', 'formGeneral']) });
  assert.equal(r.normalizedSupport2, 0, "desteği 0 olan '2' ekranda %1-2 gibi görünemez");
  assert.equal(r.normalizedSupport1 + r.normalizedSupportX + r.normalizedSupport2, 100, 'yüzde toplamı 100');
});

test('BUG 4/5: yuvarlanmış yüzde ham paydan en fazla 1 puan sapar; sıralama ham destekle tutarlı', () => {
  const evals = [
    ev('points', '1', 0.9, 'famA'),
    ev('xgFor', 'X', 0.85, 'famB'),
    ev('goalDiff', '2', 0.1, 'famC'),
  ];
  const r = computeMasterAnalysis({ catalogEvaluations: evals, profile: profOf(['points', 'xgFor', 'goalDiff']) });
  const total = r.support1 + r.supportX + r.support2;
  for (const [normKey, rawVal] of [['normalizedSupport1', r.support1], ['normalizedSupportX', r.supportX], ['normalizedSupport2', r.support2]]) {
    const raw = (rawVal * 100) / total;
    assert.ok(Math.abs(r[normKey] - raw) <= 1, `${normKey} ham paydan 1 puandan fazla sapmamalı (${r[normKey]} vs ${raw.toFixed(2)})`);
  }
  assert.equal(r.mainPrediction, '1', 'ana tercih ham desteğin en büyüğü olmalı');
  assert.equal(r.normalizedSupport1 + r.normalizedSupportX + r.normalizedSupport2, 100);
});

// ——— #6: tek radar aktifken ağırlık toplamı 100 kalır ———
test('BUG 6: yalnız Radar 5 (hafıza) aktifken ağırlık toplamı ~15 değil 100', () => {
  const only = normalizeWeights({ [RADAR_IDS.MEMORY]: { hasData: true } });
  const sum = Object.values(only).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 0.3, `tek aktif radar: toplam 100 olmalı (${sum})`);
});

test('BUG 6 (tavan korunur): hafıza + başka radar aktifken hafıza tavanı aşamaz, toplam 100', () => {
  const w = normalizeWeights({
    [RADAR_IDS.MEMORY]: { hasData: true },
    [Object.values(RADAR_IDS).find((id) => id !== RADAR_IDS.MEMORY)]: { hasData: true },
  });
  assert.ok(w[RADAR_IDS.MEMORY] <= MEMORY_WEIGHT_CAP + 0.11, 'hafıza tavanı korunmalı');
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 0.3, `toplam 100 olmalı (${sum})`);
});

// ——— #7: matchesCounted gerçek sayım ———
test('BUG 7: karne matchesCounted alanı gerçek sayımdır (boş arşivde 0, alan mevcut)', async () => {
  const s = await buildCriterionScorecard({ store: tmpStore() });
  assert.equal(typeof s.matchesCounted, 'number', 'alan analysisService tarafından üretilmeli');
  assert.equal(s.matchesCounted, 0, 'boş arşivde 0 maç sayılır');
});

// ——— #8: bellek önbelleği sınırlı ———
test('BUG 8: server.js bellek önbellekleri sınırlı (LRU tavanı + capMap uygulanmış)', () => {
  const src = readFileSync(join(here, '..', 'src', 'server.js'), 'utf8');
  assert.match(src, /MEM_CACHE_MAX/, 'memCache tavanı tanımlı olmalı');
  assert.match(src, /function capMap/, 'yardımcı Map sınırı tanımlı olmalı');
  const uses = (src.match(/capMap\(/g) || []).length;
  assert.ok(uses >= 4, `capMap tanım + en az 3 kullanım olmalı (bulunan: ${uses})`);
});
