// RADAR 4 EKRANI — EKSİK ORANIN SEBEBİ (kaynak metni testleri).
// node --test JSX'i import edemez; ekran kaynağı METİN olarak okunup denetlenir.
//
// Korunan davranış: oranı olmayan satır artık TEK jenerik cümle yazmıyor,
// arka uçtan gelen KENDİ sebebini yazıyor. Sebep arka uçta üretilir — ekran
// sebep UYDURMAZ, oran da üretmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (...p) => readFileSync(join(kok, ...p), 'utf8');
const kodu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const RADAR = kodu(oku('src', 'screens', 'RadarScreen.js'));

// Bir bileşen/blokun kaynağını SINIRLARIYLA al. Sabit uzunlukta dilim almak
// komşu bloğa taşar ve testi yanlış yerden geçirir/düşürür.
const blokAl = (bas, son) => {
  const i = RADAR.indexOf(bas);
  assert.ok(i > 0, `${bas} bulunamadı`);
  const j = RADAR.indexOf(son, i);
  assert.ok(j > i, `${son} bulunamadı (blok sınırı)`);
  return RADAR.slice(i, j);
};

// Radar 4 satır çizicisi — sebep burada yazılır.
const marketRow = () => blokAl('const renderMarketRow', 'const DayChipsRow');
const oddsCounter = () => blokAl('const OddsCounter', 'const playedDays');

test('satır, arka uçtan gelen KENDİ sebebini yazar (notes → why.text)', () => {
  const blok = marketRow();
  assert.match(blok, /oddsNotesByNo/, 'sebep haritası satıra bağlanmamış');
  assert.match(blok, /why\?\.text/, 'satır kendi sebebini yazmıyor');
});

test('sebep haritası arka uç yanıtından kurulur — ekranda ÜRETİLMEZ', () => {
  assert.match(RADAR, /oddsNotesByNo\s*=\s*new Map\(\(dailyOdds\?\.matches \|\| \[\]\)\.map\(\(m\) => \[m\.no, m\.notes \|\| \{\}\]\)\)/,
    'notes doğrudan /daily-odds yanıtından okunmalı (yerel sebep üretimi yasak)');
});

test('REGRESYON: tek jenerik cümle TEK yol olamaz — yalnız yedek olarak kalır', () => {
  const blok = marketRow();
  const jenerik = /Bu gün için oran kaydı yok/;
  assert.match(blok, jenerik, 'eski sürüm arka uç için yedek cümle korunmalı');
  const i = blok.search(jenerik);
  const oncesi = blok.slice(Math.max(0, i - 200), i);
  assert.match(oncesi, /why\?\.text\s*\?/,
    'jenerik cümle ancak sebep YOKKEN yazılmalı (koşulsuz yazılırsa regresyon)');
});

test('ekran ORAN UYDURMAZ: eksik satırda sayı basılmaz, sebep basılır', () => {
  const blok = marketRow();
  const bosDal = blok.slice(blok.indexOf(') : ('));
  assert.ok(!/fmtOdd|oddsArrow|prevOddsCell/.test(bosDal),
    'oranı olmayan satırda oran biçimlendirme/kıyas çağrısı var — uydurma riski');
});

test('sayaç arka uçtaki gerçek sayıyı gösterir (withData / counts.total)', () => {
  const blok = oddsCounter();
  assert.match(blok, /counts\?\.total/, 'toplam maç sayısı arka uçtan okunmalı');
  assert.match(blok, /withData/, 'günlük dolu maç sayısı arka uçtan okunmalı');
  assert.match(blok, /oran var/, 'sayaç metni ("… maçın …\'inde oran var") yok');
});

test('sayaç Radar 4 başlığında gerçekten çiziliyor', () => {
  const i = RADAR.indexOf("if (tab === 'market')");
  assert.ok(i > 0, 'Radar 4 başlık dalı bulunamadı');
  const blok = RADAR.slice(i, RADAR.indexOf("if (tab === 'publicBetting')", i));
  assert.match(blok, /<OddsCounter/, 'sayaç başlığa eklenmemiş');
});

test('sebep metinlerinde MARKA ADI yok (arayüz kuralı)', () => {
  const blok = marketRow() + oddsCounter();
  assert.ok(!/footystats|bilyoner|nesine|misli/i.test(blok), 'Radar 4 satır/sayaç metninde marka adı var');
});
