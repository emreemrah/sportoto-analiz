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
// DÖNEM SEÇENEKLERİ — sabit pencereler + VERİDEKİ sezonlar.
// Sezonlar elle yazılmaz; arka uçtan gelen "season:YYYY" pencerelerinden
// türer. Arşivde olmayan bir sezonu seçenek olarak göstermek, olmayan veriyi
// varmış gibi sunmak olurdu.
// ---------------------------------------------------------------------------
const dnaIle = (windows) => ({ dna: { positions: [{ windows }] } });

// GERÇEK BİÇİM "2025/2026"dır — arşivdeki seasonYear alanı böyle yazılır
// (backend/src/history/historyStore.js). Sayı değildir: Number("2025/2026")
// NaN verir. Bu testler o biçimi kilitler; bir zamanlar sayısal varsayan bir
// eleme yüzünden BÜTÜN sezonlar düşmüş ve filtre boş görünmüştü.
const DORT_SEZON = {
  allTime: { sample: 150, pct: { '1': 50, X: 30, '2': 20 } },
  'season:2023/2024': { sample: 43, pct: { '1': 40, X: 30, '2': 30 } },
  'season:2025/2026': { sample: 51, pct: { '1': 55, X: 25, '2': 20 } },
  'season:2024/2025': { sample: 50, pct: { '1': 45, X: 35, '2': 20 } },
  'season:2022/2023': { sample: 6, pct: { '1': 33, X: 33, '2': 34 } },
};

test('sezonlar VERİDEN türüyor, eskiden yeniye sıralı', async () => {
  const { sezonSecenekleri } = await import('../src/radarScreenData.js');
  const s = sezonSecenekleri(dnaIle(DORT_SEZON));
  // Bülten ekranındaki sezon listesiyle AYNI düzen: eskiden yeniye.
  assert.deepEqual(s.map((x) => x.sezon), ['2022/2023', '2023/2024', '2024/2025', '2025/2026']);
  // Sabit pencereler bu listeye KARIŞMAZ (onlar ayrı çipler).
  assert.ok(!s.some((x) => x.k === 'allTime'));
  assert.equal(s.find((x) => x.sezon === '2025/2026').k, 'season:2025/2026');
  assert.equal(s.find((x) => x.sezon === '2025/2026').label, '2025/2026 Sezonu');
  // HAFTA SAYISI taşınır: 6 haftalık sezon 51 haftalıkla eşit görünmemeli.
  assert.equal(s.find((x) => x.sezon === '2022/2023').hafta, 6);
  assert.equal(s.find((x) => x.sezon === '2025/2026').hafta, 51);
});

test('donemSecenekleri sabit pencereleri ve sezonları birlikte verir', async () => {
  const { donemSecenekleri } = await import('../src/radarScreenData.js');
  const anahtarlar = donemSecenekleri(dnaIle(DORT_SEZON)).map((x) => x.k);
  assert.deepEqual(anahtarlar.slice(0, 4), ['allTime', 'last5', 'last10', 'last15']);
  assert.equal(anahtarlar.length, 8, 'dört sabit pencere + dört sezon');
});

test('sezon etiketi BOŞ değerde uydurma sezon yazmaz', async () => {
  const { sezonEtiketi } = await import('../src/radarScreenData.js');
  // Number(null) === 0 tuzağı: eski hâli null için "-1/0 Sezonu" üretiyordu.
  assert.equal(sezonEtiketi(null), '');
  assert.equal(sezonEtiketi(''), '');
  assert.equal(sezonEtiketi('2025/2026'), '2025/2026 Sezonu');
  assert.equal(sezonEtiketi('2026'), '2025/2026 Sezonu');   // tek yıl da desteklenir
});

test('ÖRNEKLEMİ OLMAYAN sezon seçenek olarak GÖSTERİLMEZ', async () => {
  const { donemSecenekleri } = await import('../src/radarScreenData.js');
  const s = donemSecenekleri(dnaIle({
    allTime: { sample: 5, pct: { '1': 50, X: 30, '2': 20 } },
    'season:2026': { sample: 0, pct: null },     // veri yok
  }));
  assert.ok(!s.some((x) => x.k === 'season:2026'),
    'boş sezon seçenek olmamalı — dokunulduğunda boş çıkar');
});

test('sezonu BİLİNMEYEN ("bilinmiyor") seçenek olarak gösterilmez', async () => {
  const { donemSecenekleri } = await import('../src/radarScreenData.js');
  const s = donemSecenekleri(dnaIle({
    allTime: { sample: 9, pct: { '1': 50, X: 30, '2': 20 } },
    'season:bilinmiyor': { sample: 4, pct: { '1': 50, X: 25, '2': 25 } },
  }));
  assert.ok(!s.some((x) => String(x.k).includes('bilinmiyor')),
    '"bilinmiyor sezonu" diye bir seçenek kullanıcıya gösterilemez');
});

test('dönem gücü ve eğilimi SEZONLARI da kapsıyor', async () => {
  const { radar5PeriodSuccess, radar5PeriodTrend } = await import('../src/radarScreenData.js');
  const dna = dnaIle({
    allTime: { sample: 20, pct: { '1': 50, X: 30, '2': 20 } },
    'season:2025/2026': { sample: 12, pct: { '1': 55, X: 25, '2': 20 } },
    'season:2024/2025': { sample: 8, pct: { '1': 45, X: 35, '2': 20 } },
  });
  const g = radar5PeriodSuccess(dna);
  assert.equal(g['season:2025/2026'], '55.0');
  assert.equal(g['season:2024/2025'], '45.0');
  const t = radar5PeriodTrend(g);
  assert.equal(t['season:2025/2026'].key, 'up');    // 55 > 50
  assert.equal(t['season:2024/2025'].key, 'down');  // 45 < 50
});

test('sezon yoksa liste eskisi gibi 4 sabit dönem', async () => {
  const { donemSecenekleri, DNA_PERIODS } = await import('../src/radarScreenData.js');
  assert.deepEqual(donemSecenekleri(null).map((x) => x.k), DNA_PERIODS.map((x) => x.k));
  assert.deepEqual(donemSecenekleri({ dna: { positions: [] } }).length, 4);
});

// ---------------------------------------------------------------------------
// HAFTA ŞERİDİ — resmî listedeki gezinti kalıbı (sezon seç → hafta seç).
// ---------------------------------------------------------------------------
const HAFTA = (roundId, round, year, ekstra = {}) => ({ roundId, round, year, ...ekstra });

test('hafta listesi TÜM haftaları taşır (güncel dahil), yeniden eskiye', async () => {
  const { haftaSeridiVerisi } = await import('../src/radarScreenData.js');
  const v = haftaSeridiVerisi([
    HAFTA(1521, '49. Hafta', 2026, { sealed: true }),
    HAFTA(1527, '53. Hafta', 2026, { current: true }),
    HAFTA(1525, '51. Hafta', 2026, { locked: true }),
    HAFTA(1526, '52. Hafta', 2026, { sealed: true }),
  ], { curId: 1527, selectedId: 1527 });
  // Resmî listedeki sıra: 53, 52, 51, 49 — güncel EN ÜSTTE, listenin içinde.
  assert.deepEqual(v.liste.map((w) => w.ad), ['53. Hafta', '52. Hafta', '51. Hafta', '49. Hafta']);
  assert.equal(v.liste[0].guncel, true);
  assert.ok(v.liste.slice(1).every((w) => w.kilitli), 'mühür/kilit işareti taşınmalı');
  // Tek sezon → SEZON düğmesi çizilmez, liste süzülmez.
  assert.equal(v.sezonlar.length, 1);
  // Düğme bakılan haftayı yazar; güncele bakılıyorsa "· Güncel" eki de.
  assert.equal(v.haftaDeger, '53. Hafta');
  assert.equal(v.haftaGuncelMi, true);
});

test('hafta şeridi: geçmiş haftaya bakılırken düğme onu yazar, "Güncel" eki düşer', async () => {
  const { haftaSeridiVerisi } = await import('../src/radarScreenData.js');
  const v = haftaSeridiVerisi([
    HAFTA(1527, '53. Hafta', 2026, { current: true }),
    HAFTA(1526, '52. Hafta', 2026, { sealed: true }),
  ], { curId: 1527, selectedId: 1526 });
  assert.equal(v.haftaDeger, '52. Hafta');
  assert.equal(v.haftaGuncelMi, false);
});

test('hafta şeridi: iki sezon varsa SEZON süzer, seçili sezon bakılan haftadan gelir', async () => {
  const { haftaSeridiVerisi } = await import('../src/radarScreenData.js');
  const haftalar = [
    HAFTA(1527, '53. Hafta', 2026, { current: true }),
    HAFTA(1526, '52. Hafta', 2026, { sealed: true }),
    HAFTA(1470, '50. Hafta', 2025, { sealed: true }),
    HAFTA(1469, '49. Hafta', 2025, { sealed: true }),
  ];
  // Güncele bakarken sezon onun sezonudur; liste o sezonun TÜM haftaları.
  const a = haftaSeridiVerisi(haftalar, { curId: 1527, selectedId: 1527 });
  assert.equal(a.sezonlar.length, 2);
  assert.equal(a.seciliSezon, 2026);
  assert.deepEqual(a.liste.map((w) => w.ad), ['53. Hafta', '52. Hafta']);
  // Eski sezona geçince liste o sezonun haftalarını gösterir.
  const b = haftaSeridiVerisi(haftalar, { curId: 1527, selectedId: 1527, navSezon: 2025 });
  assert.deepEqual(b.liste.map((w) => w.ad), ['50. Hafta', '49. Hafta']);
  // Geçmiş bir haftaya bakılıyorsa sezon ona uyar (elle seçim gerekmez).
  const c = haftaSeridiVerisi(haftalar, { curId: 1527, selectedId: 1470 });
  assert.equal(c.haftaDeger, '50. Hafta');
  assert.equal(c.seciliSezon, 2025);
});

test('hafta şeridi: hafta yoksa liste boş (ekran çizmez)', async () => {
  const { haftaSeridiVerisi } = await import('../src/radarScreenData.js');
  assert.deepEqual(haftaSeridiVerisi([], {}).liste, []);
  assert.deepEqual(haftaSeridiVerisi(null, {}).liste, []);
  assert.equal(haftaSeridiVerisi(null, {}).haftaDeger, null);
});

test('sezonKisa: 2026 → "2025/2026"; boş değer uydurmaz', async () => {
  const { sezonKisa } = await import('../src/radarScreenData.js');
  assert.equal(sezonKisa(2026), '2025/2026');
  assert.equal(sezonKisa('2025/2026'), '2025/2026');
  assert.equal(sezonKisa(null), '');
  assert.equal(sezonKisa(''), '');
});
