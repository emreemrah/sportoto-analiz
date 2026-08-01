// KALİBRASYON TESTLERİ (T9) — metrikler EL HESABIYLA doğrulanır.
// Bir skor fonksiyonu sessizce yanlış olursa karne yanlış rakam gösterir;
// bu yüzden her metrik bilinen değerlerle karşılaştırılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  devigMultiplicative, percentagesToProbs, brierOf, logLossOf, rpsOf,
  skillScore, climatologyOf, wilsonInterval, quantileBins, binCountFor,
  buildCalibrationReport, UNIFORM, MIN_POINTS_FOR_CURVE, MIN_MATCHES_FOR_REPORT,
} from '../src/scorecards/calibration.js';

const here = dirname(fileURLToPath(import.meta.url));
const yakin = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b} olmalı`);

// ——— Marj temizleme ———
test('devig: simetrik oranlarda eşit olasılık; toplam daima 1', () => {
  const p = devigMultiplicative({ home: 3, draw: 3, away: 3 });
  yakin(p['1'], 1 / 3); yakin(p.X, 1 / 3); yakin(p['2'], 1 / 3);
  yakin(p['1'] + p.X + p['2'], 1);
});

test('devig: marj temizlenir — 1/o toplamı 1.05 iken çıktı 1.00', () => {
  // 1/2.10 + 1/3.50 + 1/4.20 ≈ 0.4762+0.2857+0.2381 = 1.0000 (marj ~0)
  const p = devigMultiplicative({ home: 1.9, draw: 3.5, away: 4.2 });
  yakin(p['1'] + p.X + p['2'], 1);
  assert.ok(p['1'] > p.X && p.X > p['2'], 'düşük oran = yüksek olasılık');
});

test('devig: eksik/geçersiz oranda null (uydurma yok)', () => {
  assert.equal(devigMultiplicative(null), null);
  assert.equal(devigMultiplicative({ home: 2, draw: 3 }), null);
  assert.equal(devigMultiplicative({ home: 1, draw: 3, away: 4 }), null, 'oran 1 olamaz');
  assert.equal(devigMultiplicative({ home: 0, draw: 0, away: 0 }), null);
});

test('percentagesToProbs: yuvarlanmış yüzdeler normalize edilir', () => {
  const p = percentagesToProbs({ '1': 45, X: 27, '2': 28 });
  yakin(p['1'] + p.X + p['2'], 1);
  yakin(p['1'], 0.45);
  // Toplamı 100 olmayan girdide de normalize eder (yuvarlama artığı):
  const q = percentagesToProbs({ '1': 50, X: 25, '2': 24 });
  yakin(q['1'] + q.X + q['2'], 1);
  assert.equal(percentagesToProbs(null), null);
});

// ——— Metrikler: EL HESABI ———
test('Brier (toplam biçim): uniform tahmin sabit 0.667 verir', () => {
  const u = { '1': 1 / 3, X: 1 / 3, '2': 1 / 3 };
  // (1/3−1)² + (1/3)² + (1/3)² = 4/9 + 1/9 + 1/9 = 6/9 = 0.6667
  yakin(brierOf(u, '1'), 2 / 3, 1e-12);
  yakin(brierOf(u, 'X'), 2 / 3, 1e-12);
  yakin(UNIFORM.brier, 2 / 3);
});

test('Brier: kusursuz tahmin 0, tam ters tahmin 2 (aralık [0,2])', () => {
  yakin(brierOf({ '1': 1, X: 0, '2': 0 }, '1'), 0);
  yakin(brierOf({ '1': 1, X: 0, '2': 0 }, '2'), 2, 1e-12);
});

test('Brier: bilinen bir vektörde el hesabı', () => {
  // p=(0.5,0.3,0.2), sonuç '1' → (0.5−1)²+(0.3)²+(0.2)² = 0.25+0.09+0.04 = 0.38
  yakin(brierOf({ '1': 0.5, X: 0.3, '2': 0.2 }, '1'), 0.38, 1e-12);
});

test('log-loss: uniform = ln3; kusursuz = 0; kırpma sonsuzu engeller', () => {
  yakin(logLossOf({ '1': 1 / 3, X: 1 / 3, '2': 1 / 3 }, 'X'), Math.log(3), 1e-12);
  yakin(logLossOf({ '1': 1, X: 0, '2': 0 }, '1'), 0);
  const kirpilmis = logLossOf({ '1': 1, X: 0, '2': 0 }, '2');
  assert.ok(Number.isFinite(kirpilmis), 'p=0 sonsuz ceza vermemeli (kırpma)');
  yakin(kirpilmis, -Math.log(0.001), 1e-12);
});

test('RPS: kusursuz = 0; el hesabı; uniform ORTALAMASI 0.2222 (tek maçta değişir)', () => {
  yakin(rpsOf({ '1': 1, X: 0, '2': 0 }, '1'), 0);
  // p=(0.5,0.3,0.2), sonuç 'X': F=(0.5,0.8), O=(0,1) → (0.5)²+(0.2)² = 0.29 → /2 = 0.145
  yakin(rpsOf({ '1': 0.5, X: 0.3, '2': 0.2 }, 'X'), 0.145, 1e-12);

  // ÖNEMLİ İNCELİK: RPS kümülatif olduğu için uniform tahminin skoru SONUCA
  // GÖRE DEĞİŞİR: '1' ve '2' için 5/18, 'X' için 1/9. Literatürdeki "uniform =
  // 0.2222" değeri bunların ORTALAMASIDIR — tek maç değeri değil.
  const u = { '1': 1 / 3, X: 1 / 3, '2': 1 / 3 };
  yakin(rpsOf(u, '1'), 5 / 18, 1e-12);
  yakin(rpsOf(u, 'X'), 1 / 9, 1e-12);
  yakin(rpsOf(u, '2'), 5 / 18, 1e-12);
  const ortalama = (rpsOf(u, '1') + rpsOf(u, 'X') + rpsOf(u, '2')) / 3;
  yakin(ortalama, 2 / 9, 1e-12);
  yakin(UNIFORM.rps, 2 / 9);
});

test('skill score: eşitlik 0, yarı hata +0.5, iki katı hata −1', () => {
  yakin(skillScore(0.5, 0.5), 0);
  yakin(skillScore(0.25, 0.5), 0.5);
  yakin(skillScore(1.0, 0.5), -1);
  assert.equal(skillScore(0.5, 0), null, 'referans 0 ise skill tanımsız');
});

test('climatology: sonuç dağılımından taban oran', () => {
  const c = climatologyOf(['1', '1', 'X', '2']);
  yakin(c['1'], 0.5); yakin(c.X, 0.25); yakin(c['2'], 0.25);
  assert.equal(climatologyOf([]), null);
});

// ——— Belirsizlik ve binleme ———
test('Wilson aralığı: uçlarda bile [0,1] içinde ve makul genişlikte', () => {
  const { low, high } = wilsonInterval(0, 10);
  assert.ok(low >= 0 && high <= 1);
  assert.ok(high > 0, '0/10 için üst sınır 0 olamaz (Wald burada çöker)');
  const orta = wilsonInterval(50, 100);
  assert.ok(orta.low < 0.5 && orta.high > 0.5, 'aralık merkezi kapsamalı');
  const genis = wilsonInterval(5, 10), dar = wilsonInterval(500, 1000);
  assert.ok((genis.high - genis.low) > (dar.high - dar.low), 'küçük n daha geniş aralık');
});

test('quantileBins: eşit sayılı bölme; n ve güven aralığı her binde var', () => {
  const noktalar = Array.from({ length: 90 }, (_, i) => ({ p: i / 90, hit: i % 2 === 0 }));
  const bins = quantileBins(noktalar, 3);
  assert.equal(bins.length, 3);
  assert.equal(bins.reduce((s, b) => s + b.n, 0), 90, 'hiçbir gözlem kaybolmaz');
  for (const b of bins) {
    assert.ok(b.n === 30, 'kuantil binleme eşit sayıda gözlem koyar');
    assert.ok(b.ciLowPct != null && b.ciHighPct != null, 'her bin güven aralığı taşımalı');
    assert.ok(typeof b.distinguishable === 'boolean');
  }
});

test('binCountFor: <200 eğri yok, 200-600 → 3 bin, >600 → 5 bin', () => {
  assert.equal(binCountFor(199), 0);
  assert.equal(binCountFor(MIN_POINTS_FOR_CURVE), 3);
  assert.equal(binCountFor(600), 3);
  assert.equal(binCountFor(601), 5);
});

// ——— Uçtan uca rapor (sahte arşiv) ———
// GERÇEK provenance şemasına uyan sahte arşiv. Alanların yerleri önemlidir:
// methodologyVersion payload.engine altından, lockedAt snapshot kökünden okunur
// (bkz. scorecards/provenance.js recordFromArchive). Yanlış yere konursa kayıt
// "official_forward" sayılmaz ve testler YANLIŞ SEBEPLE geçer.
function sahteStore({ probs, odds, results, estimated = false, adet = 30 }) {
  const matches = Array.from({ length: adet }, (_, i) => ({
    matchId: `m${i}`,
    market: { probabilities: probs, odds, probabilitiesEstimated: estimated },
  }));
  const gozlem = '2026-07-25T10:00:00Z';   // tahmin anı (kilitten ÖNCE)
  const kilit = '2026-07-25T16:55:00Z';    // freeze = ilk maçtan 5 dk önce
  const ilkMac = '2026-07-25T17:00:00Z';
  return {
    listBulletins: async () => [{
      id: 'b1', roundId: 1500, week: '30. Hafta', status: 'completed',
      freezeAt: kilit, firstMatchStartAt: ilkMac,
    }],
    getSnapshot: async () => ({
      id: 'snap-b1',
      payloadHash: 'hash-abc',
      immutable: true,
      createdAt: gozlem,
      dataObservedAt: gozlem,
      lockedAt: kilit,
      payload: {
        bulletin: { roundId: 1500, freezeAt: kilit, firstMatchStartAt: ilkMac },
        engine: { analysisEngineVersion: 'test-engine-1.0.0' },
        matches,
      },
    }),
    listOfficialResults: async () => matches.map((m, i) => ({
      matchId: m.matchId, officialResult: results[i % results.length],
    })),
  };
}

// Sahte arşivin GERÇEKTEN uygunluk kapısını geçtiğini kanıtlar; aksi halde
// aşağıdaki testler "veri yok" diye geçer ve hiçbir şey ölçülmemiş olur.
test('sahte arşiv provenance kapısını geçiyor (testler yanlış sebeple geçmesin)', async () => {
  const store = sahteStore({
    probs: { '1': 45, X: 27, '2': 28 }, odds: { home: 2.2, draw: 3.4, away: 3.6 },
    results: ['1', 'X', '2'], adet: 30,
  });
  const r = await buildCalibrationReport({ store });
  assert.equal(r.excludedCount, 0, `kayıt dışlandı: ${JSON.stringify(r.excludedByType)}`);
  assert.equal(r.roundsCounted, 1);
  assert.equal(r.matchesCounted, 30);
});

test('rapor: az örneklemde skor YAYIMLANMAZ (dürüst "yetersiz" cevabı)', async () => {
  const store = sahteStore({
    probs: { '1': 50, X: 30, '2': 20 }, odds: { home: 2, draw: 3.4, away: 4 },
    results: ['1'], adet: 5,
  });
  const r = await buildCalibrationReport({ store });
  assert.equal(r.hasData, false);
  assert.match(r.insufficientNote, new RegExp(String(MIN_MATCHES_FOR_REPORT)));
});

test('rapor: oran varken model=piyasa payı AÇIKÇA bildirilir (skill ~0 tanım gereği)', async () => {
  // Oranlardan türeyen olasılık: devig(2.0, 3.4, 4.0) ≈ 0.474/0.279/0.237
  const store = sahteStore({
    probs: { '1': 47, X: 28, '2': 24 }, odds: { home: 2, draw: 3.4, away: 4 },
    results: ['1', 'X', '2'], adet: 30, estimated: false,
  });
  const r = await buildCalibrationReport({ store });
  assert.equal(r.hasData, true);
  assert.equal(r.matchesCounted, 30);
  assert.equal(r.marketDerived.count, 30);
  assert.equal(r.marketDerived.share, 100);
  assert.match(r.marketDerived.note, /TANIM GEREĞİ/);
  assert.ok(Math.abs(r.skill.vsMarket.logLoss) < 0.02,
    'model piyasadan türediği için beceri sıfıra yakın olmalı');
});

test('rapor: oransız (tahmini) maçlar ayrı ölçülür — gerçek sınav orası', async () => {
  const store = sahteStore({
    probs: { '1': 60, X: 25, '2': 15 }, odds: null,
    results: ['1', '1', 'X'], adet: 30, estimated: true,
  });
  const r = await buildCalibrationReport({ store });
  assert.equal(r.market, null, 'oran yoksa piyasa referansı üretilmez');
  assert.equal(r.marketDerived.count, 0);
  assert.ok(r.estimatedOnly?.n === 30, 'tahmini maçlar ayrı havuzda ölçülür');
  assert.ok(r.skill.vsBaseline?.logLoss != null, 'taban referansı yine de hesaplanır');
});

test('rapor: metrikler uniform referansıyla tutarlı (uniform tahmin ≈ uniform skor)', async () => {
  const store = sahteStore({
    probs: { '1': 33, X: 33, '2': 33 }, odds: null,
    results: ['1', 'X', '2'], adet: 30, estimated: true,
  });
  const r = await buildCalibrationReport({ store });
  yakin(r.model.brier, 0.667, 0.01);
  yakin(r.model.logLoss, 1.099, 0.01);
  yakin(r.model.rps, 0.222, 0.01);
});

test('rapor: konvansiyonlar ve beklenti uyarısı çıktıda YAZILI (ekranda gösterilecek)', async () => {
  const store = sahteStore({
    probs: { '1': 45, X: 27, '2': 28 }, odds: { home: 2.2, draw: 3.4, away: 3.6 },
    results: ['1', 'X', '2'], adet: 30,
  });
  const r = await buildCalibrationReport({ store });
  assert.match(r.conventions.brier, /\[0, 2\]/);
  assert.match(r.conventions.logLoss, /kırpma/);
  assert.match(r.conventions.devig, /Multiplicative/i);
  assert.match(r.expectationNote, /%12/, 'beklenti ayarı mesajı zorunlu');
  assert.ok(r.curve.insufficient, '90 nokta < 200 → eğri çizilmemeli');
});

test('rapor: uygunluk kapısı ortak — geçmişe uydurulmuş kayıt ölçüme GİRMEZ', async () => {
  const store = sahteStore({
    probs: { '1': 45, X: 27, '2': 28 }, odds: { home: 2.2, draw: 3.4, away: 3.6 },
    results: ['1'], adet: 30,
  });
  const eskiSnap = store.getSnapshot;
  store.getSnapshot = async () => {
    const s = await eskiSnap();
    return { ...s, backfilled: true };   // geçmişe dönük üretim işareti
  };
  const r = await buildCalibrationReport({ store });
  assert.equal(r.hasData, false, 'backfilled kayıt kalibrasyona giremez');
  assert.ok(r.excludedCount >= 1, 'dışlama şeffaf sayılmalı');
});

test('uç kaydı: /calibration mevcut karne uçlarını bozmadan eklendi', () => {
  const kaynak = readFileSync(join(here, '..', 'src', 'routes', 'scorecards.js'), 'utf8');
  assert.match(kaynak, /router\.get\('\/calibration'/, 'kalibrasyon ucu kayıtlı değil');
  for (const eski of ['/system', '/radar', '/criteria', '/coverage']) {
    assert.ok(kaynak.includes(`router.get('${eski}'`), `${eski} ucu kaybolmuş`);
  }
});
