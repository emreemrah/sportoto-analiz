// RADAR EKRANI VERİ TÜRETME TESTLERİ.
//
// Bu mantık RadarScreen'in render gövdesine gömülüydü: filtre, sıralama,
// sayaç ve eğilim hesabı ancak ekranı çizerek sınanabiliyordu. Ayrıldı, artık
// doğrudan sınanıyor. Testlerin çoğu SINIR durumlarını kovalıyor — asıl
// hatalar orada: boş liste, eksik alan, eşitlik, sıfıra bölme.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundPct100, ord, wdl, num1, birOndalik,
  classCountsOf, filterMaster, sortMaster, freezeMinutes,
  legacyCountsOf, legacyFiltered, radar5PeriodSuccess, radar5PeriodTrend, rowTrend,
} from '../src/radarScreenData.js';

const mac = (no, master) => ({ no, master });

test('yüzde yuvarlaması toplamı HER ZAMAN 100 tutar', () => {
  // 99 ya da 101 gören kullanıcı sayıya güvenmez.
  for (const p of [
    { '1': 44.4, X: 36.8, '2': 18.8 },
    { '1': 33.3, X: 33.3, '2': 33.4 },
    { '1': 0.4, X: 0.3, '2': 99.3 },
    { '1': 50, X: 25, '2': 25 },
  ]) {
    const r = roundPct100(p);
    assert.equal(r['1'] + r.X + r['2'], 100, `toplam 100 değil: ${JSON.stringify(r)}`);
  }
  assert.equal(roundPct100(null), null);
});

test('yüzde yokken sıfır UYDURULMAZ', () => {
  assert.equal(roundPct100(undefined), null);
  assert.equal(birOndalik(null), null);
  assert.equal(num1('abc'), null);
  assert.equal(num1(null), null);
  assert.equal(wdl(null), null);
  assert.equal(ord(null), '—');
});

test('bir ondalık gösterim küçük değişimi gizlemez', () => {
  // Tam sayıya yuvarlansaydı ikisi de "19" görünürdü.
  assert.equal(birOndalik({ '1': 19.4, X: 40, '2': 40.6 })['1'], '19.4');
  assert.equal(birOndalik({ '1': 19.7, X: 40, '2': 40.3 })['1'], '19.7');
});

test('sınıf sayaçları: bilinmeyen sınıf "karışık" sayılır (maç kaybolmaz)', () => {
  const c = classCountsOf([
    mac(1, { classification: 'strong_candidate' }),
    mac(2, { classification: 'surprise_candidate' }),
    mac(3, { classification: 'insufficient_data' }),
    mac(4, { classification: 'medium_risk' }),
    mac(5, { classification: 'bilinmeyen_yeni_sinif' }),
    mac(6, null),                                   // master hiç yok
  ]);
  assert.deepEqual(c, { strong: 1, medium: 3, surprise: 1, insufficient: 1 });
  // Toplam daima maç sayısına eşit — hiçbir maç sayımdan düşmez.
  assert.equal(c.strong + c.medium + c.surprise + c.insufficient, 6);
  assert.deepEqual(classCountsOf([]), { strong: 0, medium: 0, surprise: 0, insufficient: 0 });
  assert.deepEqual(classCountsOf(null), { strong: 0, medium: 0, surprise: 0, insufficient: 0 });
});

test('bilinmeyen filtre listeyi BOŞALTMAZ', () => {
  const l = [mac(1, { classification: 'strong_candidate' }), mac(2, { classification: 'medium_risk' })];
  assert.equal(filterMaster(l, 'all').length, 2);
  assert.equal(filterMaster(l, 'boyle-bir-filtre-yok').length, 2);
  assert.equal(filterMaster(l, 'strong').length, 1);
});

test('beraberlik riski filtresi eşiği 30 DAHİLDİR', () => {
  const l = [
    mac(1, { scores: { draw: 29.9 } }),
    mac(2, { scores: { draw: 30 } }),
    mac(3, { scores: {} }),          // alan yok → 0 sayılır, girmez
  ];
  assert.deepEqual(filterMaster(l, 'drawRisk').map((m) => m.no), [2]);
});

test('deplasman sürprizi filtresi ÜÇ şartı birlikte arar', () => {
  const tam = { favorite: { symbol: '1' }, favoriteFailureRisk: 60, exactDirection: '2' };
  const l = [
    mac(1, tam),
    mac(2, { ...tam, favorite: { symbol: '2' } }),      // favori ev değil
    mac(3, { ...tam, favoriteFailureRisk: 54 }),        // risk eşiğin altında
    mac(4, { ...tam, exactDirection: 'X' }),            // yön deplasman değil
  ];
  assert.deepEqual(filterMaster(l, 'awaySurprise').map((m) => m.no), [1]);
});

test('varsayılan sıralama Spor Toto sırasıdır (kupon doldurma sırası)', () => {
  const l = [mac(3, {}), mac(1, {}), mac(2, {})];
  assert.deepEqual(sortMaster(l, 'order').map((m) => m.no), [1, 2, 3]);
});

test('risk sıralamasında risksiz maç sona düşer, eşitlikte no sırası korunur', () => {
  const l = [
    mac(1, { favoriteFailureRisk: 40 }),
    mac(2, {}),                                   // risk YOK
    mac(3, { favoriteFailureRisk: 70 }),
    mac(4, { favoriteFailureRisk: 40 }),
  ];
  assert.deepEqual(sortMaster(l, 'risk').map((m) => m.no), [3, 1, 4, 2]);
});

test('sıralama girdi dizisini DEĞİŞTİRMEZ', () => {
  const l = [mac(3, {}), mac(1, {})];
  sortMaster(l, 'order');
  assert.deepEqual(l.map((m) => m.no), [3, 1], 'kaynak dizi bozulmamalı');
});

test('mühürlenme geri sayımı: geçmiş zaman için NEGATİF dakika yazılmaz', () => {
  const T = Date.parse('2026-08-02T17:00:00Z');
  const meta = { current: true, freezeAt: '2026-08-02T17:00:00Z' };
  assert.equal(freezeMinutes(meta, T - 90e3), 2);           // 1,5 dk → yukarı yuvarlanır
  assert.equal(freezeMinutes(meta, T), null);               // tam an → sayaç yok
  assert.equal(freezeMinutes(meta, T + 60e3), null);        // geçmiş → null
  // Mühürlenmiş ya da güncel olmayan haftada geri sayım YOKTUR.
  assert.equal(freezeMinutes({ ...meta, sealed: true }, T - 90e3), null);
  assert.equal(freezeMinutes({ ...meta, frozenAt: 'x' }, T - 90e3), null);
  assert.equal(freezeMinutes({ ...meta, current: false }, T - 90e3), null);
  assert.equal(freezeMinutes(null, T), null);
});

test('legacy sayaç ve filtre', () => {
  const r = [{ labelColor: 'red' }, { labelColor: 'green' }, { labelColor: 'red' }, { labelColor: 'mor' }];
  assert.deepEqual(legacyCountsOf(r), { red: 2, yellow: 0, green: 1 });
  assert.equal(legacyFiltered(r, 'red').length, 2);
  assert.equal(legacyFiltered(r, null).length, 4, 'filtre yoksa tümü');
  assert.equal(legacyFiltered(null, 'red').length, 0);
});

test('dönem gücü: örneklem yoksa SIFIR değil null döner', () => {
  // Sıfır "hiç olmadı" demektir; burada kastedilen "bilmiyoruz".
  const bos = radar5PeriodSuccess({ dna: { positions: [] } });
  assert.equal(bos.allTime, null);
  assert.equal(radar5PeriodSuccess(null).last5, null);
});

test('dönem gücü: sıraların en yüksek yüzdesinin ortalaması', () => {
  const s = radar5PeriodSuccess({
    dna: {
      positions: [
        { windows: { allTime: { pct: { '1': 50, X: 30, '2': 20 } } } },   // en yüksek 50
        { windows: { allTime: { pct: { '1': 20, X: 60, '2': 20 } } } },   // en yüksek 60
        { windows: { last5: { pct: { '1': 90, X: 5, '2': 5 } } } },       // allTime penceresi yok
      ],
    },
  });
  assert.equal(s.allTime, '55.0');       // (50+60)/2
  assert.equal(s.last5, '90.0');
});

test('eğilim eşiği 0,5 puan — altındaki fark OK GÖSTERMEZ', () => {
  const t = radar5PeriodTrend({ allTime: '50.0', last5: '50.4', last10: '50.6', last15: '49.0' });
  assert.equal(t.allTime.symbol, '—', 'referansın kendisi düz');
  assert.equal(t.last5.key, 'flat', '0,4 puan gürültüdür');
  assert.equal(t.last10.key, 'up');
  assert.equal(t.last15.key, 'down');
  // Veri yoksa ok da yok (uydurma eğilim gösterilmez).
  assert.equal(radar5PeriodTrend({ allTime: null, last5: '50.0' }).last5, null);
});

test('satır eğilimi dönem seçimine göre davranır', () => {
  assert.equal(rowTrend({ highest: 60, allTimeHighest: 50, dnaPeriod: 'allTime' }).key, 'flat',
    'tüm zamanlar seçiliyken kendisiyle kıyaslanmaz');
  assert.equal(rowTrend({ highest: 60, allTimeHighest: 50, dnaPeriod: 'last5' }).key, 'up');
  assert.equal(rowTrend({ highest: 50.3, allTimeHighest: 50, dnaPeriod: 'last5' }).key, 'flat');
  assert.equal(rowTrend({ highest: null, allTimeHighest: 50, dnaPeriod: 'last5' }), null);
});

// ---------------------------------------------------------------------------
// SEZON GEÇİŞİ HAZIRLIĞI — 53. haftadan sonra yeni sezon 1. haftayla başlar.
// Ölçülen gerçek: sabit pencereler aktif sezona bağlı olduğu için örneklem
// 51 haftadan 1'e düşüyor ve bir sıra "1 %100.0" gösteriyor.
// ---------------------------------------------------------------------------
test('örneklem uyarısı: az veride yüzdenin neye dayandığı yazılır', async () => {
  const { orneklemUyarisi, YON_SINYALI_ESIGI } = await import('../src/radarScreenData.js');
  // Eşik arka uçtaki directional kuralıyla AYNI olmalı (positionDna.js: n>=10).
  assert.equal(YON_SINYALI_ESIGI, 10);
  assert.equal(orneklemUyarisi(1), 'Yalnız 1 hafta — yön sinyali üretilmez');
  assert.equal(orneklemUyarisi(3), 'Yalnız 3 hafta — yön sinyali üretilmez');
  assert.equal(orneklemUyarisi(9), 'Yalnız 9 hafta — yön sinyali üretilmez');
  // Eşikte ve üstünde uyarı YOK.
  assert.equal(orneklemUyarisi(10), null);
  assert.equal(orneklemUyarisi(51), null);
  // Veri yoksa uyarı da yok (satır zaten "geçmiş sonuç yok" der).
  assert.equal(orneklemUyarisi(0), null);
  assert.equal(orneklemUyarisi(null), null);
  assert.equal(orneklemUyarisi(undefined), null);
});

// ---------------------------------------------------------------------------
// HAFTA SEÇİCİ — resmî listedeki gezinti verisi.
// ---------------------------------------------------------------------------
test('hafta seçici: TÜM haftalar güncel dahil, yeniden eskiye', async () => {
  const { haftaSeciciVerisi } = await import('../src/radarScreenData.js');
  const v = haftaSeciciVerisi([
    { roundId: 1521, round: '49. Hafta', year: 2026, sealed: true },
    { roundId: 1527, round: '53. Hafta', year: 2026, current: true },
    { roundId: 1525, round: '51. Hafta', year: 2026, locked: true },
  ], { curId: 1527, selectedId: 1527 });
  assert.deepEqual(v.liste.map((w) => w.ad), ['53. Hafta', '51. Hafta', '49. Hafta']);
  assert.equal(v.liste[0].guncel, true);
  assert.equal(v.haftaAdi, '53. Hafta');
  assert.equal(v.haftaGuncelMi, true);
  // Tek sezon → düz yazı; sezon adı yine üretilir.
  assert.equal(v.sezonlar.length, 1);
  assert.equal(v.sezonAdi, '2025/2026 Sezonu');
});

test('hafta seçici: SEZON GEÇİŞİNDE liste seçili sezona göre süzülür', async () => {
  const { haftaSeciciVerisi } = await import('../src/radarScreenData.js');
  const haftalar = [
    { roundId: 1528, round: '1. Hafta', year: 2027, current: true },
    { roundId: 1527, round: '53. Hafta', year: 2026, sealed: true },
    { roundId: 1526, round: '52. Hafta', year: 2026, sealed: true },
  ];
  // Güncele bakılıyor → sezon onun sezonu, liste yalnız o sezon.
  const a = haftaSeciciVerisi(haftalar, { curId: 1528, selectedId: 1528 });
  assert.deepEqual(a.sezonlar.map((s) => s.ad), ['2026/2027 Sezonu', '2025/2026 Sezonu']);
  assert.equal(a.seciliSezon, '2027');
  assert.deepEqual(a.liste.map((w) => w.ad), ['1. Hafta']);
  // Eski sezon seçilince liste ona döner.
  const b = haftaSeciciVerisi(haftalar, { curId: 1528, selectedId: 1528, navSezon: '2026' });
  assert.deepEqual(b.liste.map((w) => w.ad), ['53. Hafta', '52. Hafta']);
  // Geçmiş haftaya bakılıyorsa sezon elle seçilmeden ona uyar.
  const c = haftaSeciciVerisi(haftalar, { curId: 1528, selectedId: 1526 });
  assert.equal(c.seciliSezon, '2026');
  assert.equal(c.haftaAdi, '52. Hafta');
  assert.equal(c.haftaGuncelMi, false);
});

test('hafta seçici: hafta yoksa liste boş (ekran çizmez)', async () => {
  const { haftaSeciciVerisi } = await import('../src/radarScreenData.js');
  assert.deepEqual(haftaSeciciVerisi([], {}).liste, []);
  assert.deepEqual(haftaSeciciVerisi(null, {}).liste, []);
  assert.equal(haftaSeciciVerisi(null, {}).haftaAdi, null);
});

test('sezonAdiUzun: iki biçim de desteklenir, boş değer uydurmaz', async () => {
  const { sezonAdiUzun } = await import('../src/radarScreenData.js');
  assert.equal(sezonAdiUzun(2026), '2025/2026 Sezonu');
  assert.equal(sezonAdiUzun('2025/2026'), '2025/2026 Sezonu');
  assert.equal(sezonAdiUzun(null), '');
  assert.equal(sezonAdiUzun(''), '');
});
