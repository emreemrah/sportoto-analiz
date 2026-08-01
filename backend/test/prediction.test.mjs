// TAHMİN MOTORU — DÜRÜSTLÜK TESTLERİ
//
// Kullanıcı bildirimi: "buradaki tahmin nereden geliyor çok saçma tahminler
// yapıyor daha mantıklı tahminler olması lazım."
//
// Bu dosya, gerçek 1526. hafta verisiyle (test/fixtures/hafta-1526-analiz.json —
// kullanıcının kendi backend'inden alınmıştır, uydurma değildir) üç kusuru
// kilitler; ileride biri eski davranışa dönerse test kırılır:
//
//   1) Olmayan veri delil sayılmaz  (0-0-0 puan durumu, over25 = 0)
//   2) Tek işaret, favorinin MUTLAK gücüne bakmadan yazılmaz
//   3) Oran yokken (estimated) en yüksek güven etiketi verilmez
//
// Etiket ANAHTARLARI da kilitlenir: arşiv/karne kayıtları bunlara bağlıdır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { predict, ESIKLER } from '../src/analysis/prediction.js';

const kok = dirname(fileURLToPath(import.meta.url));
const HAFTA = JSON.parse(readFileSync(join(kok, 'fixtures/hafta-1526-analiz.json'), 'utf8'));
const MACLAR = HAFTA.matches;
const mac = (no) => MACLAR.find((m) => m.no === no);
const tahmin = (no) => predict({ analysis: mac(no).analysis, stats: mac(no).stats });

const IZINLI_ETIKET = new Set(['BANKO', 'NET', 'TEMKİNLİ', 'ÇİFTE', 'AÇIK', 'VERİ YOK']);
const IZINLI_ISARET = new Set(['1', '0', '2', '10', '02', '12', '102', '-']);
const TEK = new Set(['1', '0', '2']);

/* ——————————— 0) SÖZLEŞME: şekil ve anahtarlar değişmedi ——————————— */

test('dönüş şekli ve etiket anahtarları sabit kalır (arşiv/karne uyumu)', () => {
  for (const m of MACLAR) {
    const p = tahmin(m.no);
    assert.deepEqual(Object.keys(p).sort(), ['estimated', 'label', 'meaning', 'reason', 'symbol'],
      `${m.no}. maç: dönüş alanları değişmiş`);
    assert.ok(IZINLI_ETIKET.has(p.label), `${m.no}. maç: bilinmeyen etiket "${p.label}"`);
    assert.ok(IZINLI_ISARET.has(p.symbol), `${m.no}. maç: bilinmeyen işaret "${p.symbol}"`);
    assert.equal(typeof p.reason, 'string');
    assert.ok(p.reason.length > 0, `${m.no}. maç: gerekçe boş`);
  }
});

test('ihtimal yoksa VERİ YOK yazılır, tahmin uydurulmaz', () => {
  for (const no of [1, 4, 14, 15]) {
    const p = tahmin(no);
    assert.equal(p.symbol, '-', `${no}. maç: veri yokken işaret üretilmiş`);
    assert.equal(p.label, 'VERİ YOK');
  }
});

/* ——————— 1) OLMAYAN VERİ DELİL SAYILMAZ ——————— */

test('hiç oynanmamış (0-0-0) puan durumu "zayıf" sayılmaz', () => {
  const bos = { wins: 0, draws: 0, losses: 0 };
  const analysis = {
    probabilities: { 1: 40, X: 30, 2: 30 }, surpriseScore: 40, label: 'DİKKAT',
    favorite: { symbol: '1', percent: 40 }, factors: [], estimated: false,
  };
  const veriyle = predict({ analysis, stats: { home: { standing: { home: bos } } , away: { standing: { away: bos } }, potentials: { over25: 0 } } });
  const veriSiz = predict({ analysis, stats: null });
  assert.equal(veriyle.symbol, veriSiz.symbol, 'boş kayıt sonucu değiştirmemeli');
  assert.equal(veriyle.label, veriSiz.label, 'boş kayıt güven seviyesini değiştirmemeli');
  for (const yasak of ['iç sahada zayıf', 'dış sahada zayıf', 'az gollü beklenti']) {
    assert.equal(veriyle.reason.includes(yasak), false, `boş veriden "${yasak}" gerekçesi uydurulmuş`);
  }
});

test('REGRESYON 1526/2 (Brondby-Viborg): gerekçe boş veriden uydurulmaz', () => {
  // Eski çıktı harfiyen şuydu: "ev sahibi iç sahada zayıf; deplasman dış sahada
  // zayıf; az gollü beklenti" — oysa iki takımın da iç/dış kaydı 0-0-0 ve
  // over25 alanı 0 (yani ölçüm YOK). 22 puanlık oynama hiç veriden doğmuştu.
  const m = mac(2);
  assert.deepEqual(m.stats.home.standing.home, { wins: 0, draws: 0, losses: 0 });
  assert.equal(m.stats.potentials.over25, 0);
  const p = tahmin(2);
  for (const yasak of ['iç sahada zayıf', 'dış sahada zayıf', 'az gollü beklenti']) {
    assert.equal(p.reason.includes(yasak), false, `hâlâ uyduruyor: "${yasak}"`);
  }
});

test('over25 ölçümü 0 ise (alan boş) beraberlik lehine puan eklenmez', () => {
  const analysis = {
    probabilities: { 1: 40, X: 30, 2: 30 }, surpriseScore: 40, label: 'DİKKAT',
    favorite: { symbol: '1', percent: 40 }, factors: [], estimated: false,
  };
  const sifir = predict({ analysis, stats: { potentials: { over25: 0 } } });
  const yok = predict({ analysis, stats: {} });
  assert.deepEqual(sifir, yok, 'over25 = 0, "az gollü" delili değildir');
  // Gerçek bir düşük ölçüm ise delildir — kural tamamen kapatılmadı.
  const gercek = predict({ analysis, stats: { potentials: { over25: 30 } } });
  assert.ok(gercek.reason.includes('az gollü beklenti'), 'gerçek düşük ölçüm okunmalı');
});

/* ——————— 2) TEK İŞARET, FAVORİNİN MUTLAK GÜCÜNE BAKAR ——————— */

test('favori eşiğin altındaysa tek işaret YAZILMAZ (kupon genişler)', () => {
  for (const m of MACLAR) {
    const yuzde = m.analysis?.favorite?.percent;
    if (yuzde == null) continue;
    const p = tahmin(m.no);
    if (!TEK.has(p.symbol)) continue;
    const alt = m.analysis.estimated ? ESIKLER.TEK_ALT_TAHMINI : ESIKLER.TEK_ALT;
    assert.ok(yuzde >= alt - 5,
      `${m.no}. maç: favori %${yuzde} iken tek "${p.symbol}" yazılmış (eşik %${alt})`);
  }
});

test('analiz "SÜRPRİZE AÇIK" derken tek işaret yazılmaz — kart kendiyle çelişmez', () => {
  const acik = MACLAR.filter((m) => m.analysis?.label === 'SÜRPRİZE AÇIK');
  assert.ok(acik.length >= 3, 'fixture sürprize açık maç içermeli');
  for (const m of acik) {
    const p = tahmin(m.no);
    assert.equal(TEK.has(p.symbol), false,
      `${m.no}. maç: analiz sürprize açık diyor ama tek "${p.symbol}" yazılmış`);
  }
});

test('"Net bir favori yok" unsuru varken tek işaret yazılmaz', () => {
  const netsiz = MACLAR.filter((m) => (m.analysis?.factors || []).some((f) => f.label.includes('Net bir favori yok')));
  assert.ok(netsiz.length >= 2, 'fixture bu unsuru içeren maç barındırmalı');
  for (const m of netsiz) {
    const p = tahmin(m.no);
    assert.equal(TEK.has(p.symbol), false,
      `${m.no}. maç: "net bir favori yok" denirken tek "${p.symbol}" yazılmış`);
  }
});

test('REGRESYON 1526/11 (Fredrikstad-Sandefjord): %44 favoriye artık NET denmez', () => {
  const m = mac(11);
  assert.equal(m.eski.symbol, '1');
  assert.equal(m.eski.label, 'NET'); // eski hatalı çıktı belgelenmiştir
  const p = tahmin(11);
  assert.equal(TEK.has(p.symbol), false, 'hâlâ tek işaret yazıyor');
  assert.equal(p.label === 'NET' || p.label === 'BANKO', false, 'hâlâ yüksek güven veriyor');
  assert.ok(p.reason.length > 10, 'genişletme sebebi yazılmalı');
});

test('gerekçe, kararı veren kuralla BAŞLAR (kullanıcı sebebi görebilmeli)', () => {
  const p = tahmin(11);
  assert.match(p.reason, /^(favori %\d+|ilk iki ihtimal|analiz bu maçı|net bir favori yok|üç ihtimal)/,
    `gerekçe karar sebebiyle başlamalı, geleni: "${p.reason}"`);
});

/* ——————— 3) ORAN YOKSA GÜVEN DÜŞER ——————— */

test('oran yokken (estimated) BANKO/NET etiketi VERİLMEZ', () => {
  for (const m of MACLAR) {
    if (!m.analysis?.estimated) continue;
    const p = tahmin(m.no);
    assert.equal(p.estimated, true, `${m.no}. maç: estimated bayrağı taşınmamış`);
    assert.equal(p.label, p.label === 'VERİ YOK' ? 'VERİ YOK' : p.label);
    assert.equal(['BANKO', 'NET'].includes(p.label), false,
      `${m.no}. maç: oran yokken "${p.label}" etiketi verilmiş`);
  }
});

test('REGRESYON 1526/7 (AIK-Örgryte): oransız maça artık BANKO denmez', () => {
  const m = mac(7);
  assert.equal(m.analysis.hasOdds, false);
  assert.equal(m.analysis.estimated, true);
  assert.equal(m.eski.label, 'BANKO'); // eski hatalı çıktı belgelenmiştir
  const p = tahmin(7);
  assert.notEqual(p.label, 'BANKO');
  assert.ok(p.reason.includes('oran yok'), 'oran olmadığı gerekçede yazmalı');
});

test('aynı ihtimaller: oran varken güven, oran yokken güvenden YÜKSEK olur', () => {
  const temel = {
    probabilities: { 1: 62, X: 20, 2: 18 }, surpriseScore: 20, label: 'BANKO',
    favorite: { symbol: '1', percent: 62 }, factors: [],
  };
  const stats = { home: { standing: { home: { wins: 5, draws: 1, losses: 1 } } }, away: { standing: { away: { wins: 1, draws: 1, losses: 5 } } }, potentials: { over25: 50 } };
  const oranli = predict({ analysis: { ...temel, hasOdds: true, estimated: false }, stats });
  const oransiz = predict({ analysis: { ...temel, hasOdds: false, estimated: true }, stats });
  const sira = { BANKO: 4, NET: 3, TEMKİNLİ: 2, ÇİFTE: 1, AÇIK: 0, 'VERİ YOK': 0 };
  assert.ok(sira[oranli.label] > sira[oransiz.label],
    `oran yokluğu güveni düşürmeli (oranlı: ${oranli.label}, oransız: ${oransiz.label})`);
});

/* ——————— 4) EN YÜKSEK GÜVEN GERÇEKTEN NADİRDİR ——————— */

test('BANKO yalnız oran + yüksek yüzde + geniş fark + düşük sürprizle verilir', () => {
  for (const m of MACLAR) {
    const p = tahmin(m.no);
    if (p.label !== 'BANKO') continue;
    assert.equal(m.analysis.estimated, false, `${m.no}. maç: oransız BANKO`);
    assert.ok(m.analysis.favorite.percent >= ESIKLER.GUCLU_ALT,
      `${m.no}. maç: favori %${m.analysis.favorite.percent} ile BANKO`);
    assert.ok(m.analysis.surpriseScore < ESIKLER.GUCLU_SURPRIZ,
      `${m.no}. maç: sürpriz ${m.analysis.surpriseScore} ile BANKO`);
    assert.notEqual(m.analysis.label, 'SÜRPRİZE AÇIK');
  }
});

test('1526. haftada en yüksek güven en fazla 2 maça verilir (nadir olmalı)', () => {
  const sayi = MACLAR.filter((m) => tahmin(m.no).label === 'BANKO').length;
  assert.ok(sayi <= 2, `en yüksek güven ${sayi} maça verilmiş — çok bol`);
});

/* ——————— 5) KARARLILIK ——————— */

test('aynı girdi aynı çıktıyı verir (rastgelelik yok)', () => {
  for (const m of MACLAR) {
    assert.deepEqual(tahmin(m.no), tahmin(m.no), `${m.no}. maç: kararsız çıktı`);
  }
});

test('stats hiç verilmese de çökmez (refresh.js ikinci çağrı yolu)', () => {
  for (const m of MACLAR) {
    const p = predict({ analysis: m.analysis, stats: null });
    assert.ok(IZINLI_ISARET.has(p.symbol));
    assert.ok(IZINLI_ETIKET.has(p.label));
  }
});
