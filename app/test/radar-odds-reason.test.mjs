// RADAR 4 — EKSİK ORANIN SEBEBİ (kaynak metni testleri).
//
// Korunan davranış: oranı olmayan satır TEK jenerik cümle yazmaz, arka uçtan
// gelen KENDİ sebebini yazar. Sebep arka uçta üretilir — ekran sebep
// UYDURMAZ, oran da üretmez.
//
// ⚠ BU DOSYA KAYNAK METNİ TARAR ve tam bu yüzden KIRILGANDIR: kod başka bir
// dosyaya taşındığında davranış bozulmadığı hâlde "blok bulunamadı" diye
// kırılır (Radar bölme çalışmasında iki kez oldu). Bu yüzden:
//   * Aranan bloklar tek bir yerde (KAYNAKLAR) tanımlıdır; taşıma olduğunda
//     yalnız burası güncellenir.
//   * Aynı davranışın GERÇEK render testi test-ui/radar-ekrani.test.jsx
//     içindedir ("Radar 4 satırı: oran ve önceki güne göre kıyas çiziliyor").
//     Yeni denetimler oraya yazılmalı; buraya yalnız render ile ölçülemeyen
//     yapısal kurallar (ör. "sebep ekranda üretilmez") eklenmeli.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (...p) => readFileSync(join(kok, ...p), 'utf8');
const kodu = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Hangi blok hangi dosyada — taşıma olursa YALNIZ burası değişir.
const KAYNAKLAR = {
  satirlar: kodu(oku('src', 'components', 'RadarDayRows.js')),
  basliklar: kodu(oku('src', 'components', 'RadarTabHeaders.js')),
};

// Bir bloğun kaynağını SINIRLARIYLA al. Sabit uzunlukta dilim almak komşu
// bloğa taşar ve testi yanlış yerden geçirir/düşürür.
const blokAl = (kaynak, bas, son) => {
  const i = kaynak.indexOf(bas);
  assert.ok(i > 0, `${bas} bulunamadı`);
  const j = kaynak.indexOf(son, i);
  assert.ok(j > i, `${son} bulunamadı (blok sınırı)`);
  return kaynak.slice(i, j);
};

const marketRow = () => blokAl(KAYNAKLAR.satirlar, 'export function MarketRow', 'const PROVIDER_ORDER');
const oddsCounter = () => blokAl(KAYNAKLAR.basliklar, 'export function OddsCounter', 'export default function');

test('satır, arka uçtan gelen KENDİ sebebini yazar (notes → why.text)', () => {
  const blok = marketRow();
  assert.match(blok, /notes\[day\]/, 'sebep haritası satıra bağlanmamış');
  assert.match(blok, /why\?\.text/, 'satır kendi sebebini yazmıyor');
});

test('sebep arka uç yanıtından OKUNUR — ekranda üretilmez', () => {
  const blok = marketRow();
  // notes doğrudan /daily-odds yanıtındaki maç kaydından gelmeli.
  assert.match(blok, /\.notes \|\| \{\}/, 'notes doğrudan yanıttan okunmalı');
  // Yerel sebep üretimi yasak: satırda sebep metni ÜRETEN bir dal olmamalı.
  assert.ok(!/kapsam dışı|yayınlanmadı|mühür alınamadı/i.test(blok),
    'sebep metni ekranda üretiliyor — arka uçtan gelmeli');
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
  assert.ok(!/fmtOdd|yonOku|OddsTriple/.test(bosDal),
    'oranı olmayan satırda oran biçimlendirme/kıyas çağrısı var — uydurma riski');
});

test('sayaç arka uçtaki gerçek sayıyı gösterir (withData / counts.total)', () => {
  const blok = oddsCounter();
  assert.match(blok, /counts\?\.total/, 'toplam maç sayısı arka uçtan okunmalı');
  assert.match(blok, /withData/, 'günlük dolu maç sayısı arka uçtan okunmalı');
  assert.match(blok, /oran var/, 'sayaç metni ("… maçın …\'inde oran var") yok');
});

test('sayaç Radar 4 başlığında gerçekten çiziliyor', () => {
  const i = KAYNAKLAR.basliklar.indexOf("if (tab === 'market')");
  assert.ok(i > 0, 'Radar 4 başlık dalı bulunamadı');
  const blok = KAYNAKLAR.basliklar.slice(i, KAYNAKLAR.basliklar.indexOf("if (tab === 'publicBetting')", i));
  assert.match(blok, /<OddsCounter/, 'sayaç başlığa eklenmemiş');
});

test('sebep metinlerinde MARKA ADI yok (arayüz kuralı)', () => {
  const blok = marketRow() + oddsCounter();
  assert.ok(!/footystats|bilyoner|nesine|misli/i.test(blok), 'Radar 4 satır/sayaç metninde marka adı var');
});
