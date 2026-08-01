// KALİBRASYON EKRAN MANTIĞI TESTLERİ (T9 — arayüz yarısı).
//
// NEDEN VAR: Bu ekranın tek işi DÜRÜSTLÜK. Yanlış sunulursa, kullanıcıya
// "sistem piyasadan iyi" izlenimi veren bir ekran çıkar — oysa olasılıkların
// çoğu zaten piyasadan türüyor. Bu testler R4 sunum kurallarının koda
// gömüldüğünü kanıtlar; metinlerin güzelliğini değil, YANILTMAMASINI ölçer.
//
// Test verisi backend'in GERÇEK çıktı şeklinden alınmıştır
// (backend/src/scorecards/calibration.js → buildCalibrationReport dönüşü),
// tahminle değil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  hasCalibrationData, skillText, calibrationHeadline, marketDerivedNotice,
  independentTestText, scoreRows, curveRows, curveUnavailableText,
  EXPECTATION_NOTE, CALIBRATION_EMPTY_MESSAGE,
} from '../src/calibrationLogic.js';
import { USER_SECTIONS } from '../src/scorecardLogic.js';

const here = dirname(fileURLToPath(import.meta.url));
const oku = (p) => readFileSync(join(here, '..', p), 'utf8');

// Backend şekliyle birebir uyumlu örnek rapor.
const rapor = (over = {}) => ({
  version: 1,
  hasData: true,
  insufficientNote: null,
  roundsCounted: 4,
  matchesCounted: 60,
  conventions: { brier: 'Toplam biçim, aralık [0, 2] — uniform 0.667' },
  uniform: { brier: 0.667, logLoss: 1.099, rps: 0.222 },
  model: { n: 60, brier: 0.62, logLoss: 1.02, rps: 0.21 },
  market: { n: 55, brier: 0.62, logLoss: 1.02, rps: 0.21 },
  baseline: { n: 60, brier: 0.65, logLoss: 1.07, rps: 0.22 },
  skill: {
    vsMarket: { logLoss: 0, brier: 0 },
    vsBaseline: { logLoss: 0.047, brier: 0.046 },
  },
  marketDerived: { count: 55, share: 91.7, note: '…' },
  estimatedOnly: { n: 5, brier: 0.7, logLoss: 1.11, rps: 0.23 },
  curve: { bins: [], points: 180, insufficient: true, note: 'en az 200 gözlem gerekir (şu an 180).' },
  ...over,
});

test('veri yoksa ekran çizilmez (default-deny)', () => {
  assert.equal(hasCalibrationData(null), false);
  assert.equal(hasCalibrationData({}), false);
  assert.equal(hasCalibrationData({ hasData: true }), false);            // model yok
  assert.equal(hasCalibrationData({ hasData: true, model: { n: 0 } }), false);
  assert.equal(hasCalibrationData(rapor()), true);
});

test('KURAL 3: fark ölçüm gürültüsü kadarsa "sapma" DENMEZ', () => {
  assert.equal(skillText(0).metin, 'Piyasadan ayırt edilemiyor');
  assert.equal(skillText(0.004).metin, 'Piyasadan ayırt edilemiyor');   // %0,4 → yuvarlanır
  assert.equal(skillText(0.004).tone, 'neutral');
});

test('KURAL 4: negatif beceri GİZLENMEZ, "daha kötü" yazılır', () => {
  const k = skillText(-0.031);
  assert.equal(k.yon, 'kotu');
  assert.match(k.metin, /daha kötü/);
  assert.equal(k.tone, 'danger');
  // Mutlak değer kullanılıyor → "-%-3.1" gibi çift eksi çıkmamalı.
  assert.ok(!k.metin.includes('--'));
  assert.ok(!k.metin.includes('%-'));
});

test('pozitif beceri doğru yönde ve doğru büyüklükte sunulur', () => {
  const k = skillText(0.047);
  assert.equal(k.yon, 'iyi');
  assert.equal(k.puan, 4.7);           // oran → yüzde puanı
  assert.equal(k.tone, 'success');
});

test('KURAL 1: başlık skill score üzerine kurulu, isabet oranı BAŞLIKTA YOK', () => {
  const h = calibrationHeadline(rapor());
  assert.equal(h.n, 60);
  assert.equal(h.weeks, 4);
  assert.equal(h.vsMarket.metin, 'Piyasadan ayırt edilemiyor');
  assert.equal(h.vsBaseline.puan, 4.7);
  assert.equal(h.marketMissing, false);
  // Başlık nesnesinde isabet/doğru/yanlış alanı bilerek yoktur.
  for (const yasak of ['accuracy', 'correct', 'hitRate', 'isabet']) {
    assert.ok(!(yasak in h), `başlıkta ${yasak} olmamalı`);
  }
});

test('piyasa referansı yoksa dürüstçe bildirilir (uydurulmaz)', () => {
  const h = calibrationHeadline(rapor({ market: null, skill: { vsMarket: null, vsBaseline: null } }));
  assert.equal(h.marketMissing, true);
  assert.equal(h.vsMarket, null);
});

test('KURAL 6: model=piyasa payı açıkça söylenir', () => {
  const n = marketDerivedNotice(rapor());
  assert.equal(n.share, 91.7);
  assert.match(n.title, /%91\.7/);
  assert.match(n.body, /tanım gereği/i);
  assert.match(n.body, /başarısızlık değildir/i);
  // Pay yoksa uyarı da yok.
  assert.equal(marketDerivedNotice(rapor({ marketDerived: { share: 0 } })), null);
  assert.equal(marketDerivedNotice(rapor({ marketDerived: null })), null);
});

test('tamamı orandan türüyorsa başlık "tamamı" der', () => {
  const n = marketDerivedNotice(rapor({ marketDerived: { share: 100 } }));
  assert.match(n.title, /tamamı/);
});

test('küçük örneklemli bağımsız sınavda YÖN İDDİA EDİLMEZ', () => {
  const t = independentTestText(rapor());       // n=5
  assert.equal(t.reliable, false);
  assert.match(t.body, /güvenilir değildir/);
  assert.ok(!/daha iyi|daha kötü/.test(t.body), 'küçük n ile yön iddia edilmemeli');

  const buyuk = independentTestText(rapor({ estimatedOnly: { n: 40, brier: 0.7, logLoss: 1.11 } }));
  assert.equal(buyuk.reliable, true);
  assert.match(buyuk.body, /1\.11/);            // sayı n ile birlikte verilir

  assert.equal(independentTestText(rapor({ estimatedOnly: null })), null);
});

test('KURAL 2: her skor satırı n taşır; olmayan referans satır üretmez', () => {
  const s = scoreRows(rapor());
  const adlar = s.map((r) => r.ad);
  assert.deepEqual(adlar, ['Model', 'Piyasa (oran)', 'Lig taban oranı', 'Rastgele (1/3)']);
  for (const r of s) assert.ok(r.n > 0, `${r.ad} satırında n yok`);
  assert.equal(s.find((r) => r.ad === 'Piyasa (oran)').n, 55);

  const oransiz = scoreRows(rapor({ market: null }));
  assert.ok(!oransiz.some((r) => r.ad === 'Piyasa (oran)'));
  assert.equal(scoreRows(null).length, 0);
});

test('küçük örneklemde eğri ÇİZİLMEZ, yerine dürüst cümle gelir', () => {
  assert.equal(curveRows(rapor()).length, 0);
  assert.match(curveUnavailableText(rapor()), /en az 200 gözlem/);
});

test('yeterli veride eğri satırları n ile ve ayırt-edilebilirlik damgasıyla gelir', () => {
  const r = rapor({
    curve: {
      points: 700,
      bins: [
        { n: 233, hits: 142, saidPct: 60, actualPct: 61, ciLowPct: 54.6, ciHighPct: 67, distinguishable: false },
        { n: 234, hits: 60, saidPct: 32.5, actualPct: 25.6, ciLowPct: 20.4, ciHighPct: 31.7, distinguishable: true },
      ],
    },
  });
  const satir = curveRows(r);
  assert.equal(satir.length, 2);
  assert.equal(satir[0].metin, '%60 dediğimiz 233 durumun %61\'i gerçekleşti');
  assert.equal(satir[0].durum, 'ayirt-edilemiyor');
  assert.match(satir[0].durumMetni, /ayırt edilemiyor/);
  assert.equal(satir[1].durum, 'sapma');
  // n her satırda korunur (yüzde tek başına gösterilemesin).
  for (const b of satir) assert.ok(b.n > 0);
  assert.equal(curveUnavailableText(r), null);
});

test('KURAL 5: beklenti cümlesi ~%12 üst sınırını ve "ayırt edilemiyor"u içerir', () => {
  assert.match(EXPECTATION_NOTE, /%12/);
  assert.match(EXPECTATION_NOTE, /ayırt edilemiyor/);
  assert.match(CALIBRATION_EMPTY_MESSAGE, /Geçmişe dönük hesap yapılmaz/);
});

// ——— Bağlantı testleri: mantık yazılıp ekrana bağlanmazsa hiçbir işe yaramaz.
test('kalibrasyon sekmesi kullanıcı sekmeleri arasında', () => {
  const s = USER_SECTIONS.find((x) => x.key === 'calibration');
  assert.ok(s, 'USER_SECTIONS içinde calibration yok');
  assert.equal(s.label, 'Kalibrasyon');
});

test('API ucu tanımlı ve ekran gerçekten çağırıyor', () => {
  assert.match(oku('src/api.js'), /scorecardsCalibration:\s*\(\)\s*=>\s*req\('\/api\/scorecards\/calibration'\)/);
  const ekran = oku('src/screens/SystemScorecardScreen.js');
  assert.match(ekran, /api\.scorecardsCalibration\(\)/);
  assert.match(ekran, /section === 'calibration'/);
  // Beklenti cümlesi ekranda GERÇEKTEN basılıyor mu?
  assert.match(ekran, /EXPECTATION_NOTE/);
  assert.match(ekran, /marketDerivedNotice/);
});
