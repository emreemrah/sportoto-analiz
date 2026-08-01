// MAĞAZA METİNLERİ DENETİMİ — yayın metinleri de kod kadar sıkı denetlenir.
//
// NEDEN: Mağaza açıklaması uygulamanın en çok okunan yüzeyidir. Buradaki bir
// "kesin kazandırır" cümlesi hem Google Play politikasını hem 7258 sayılı
// Kanun'un tanıtım hükümlerini riske atar. Testler bunu otomatik yakalar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const yayinDir = join(here, '..', '..', 'yayin');
const oku = (ad) => readFileSync(join(yayinDir, ad), 'utf8');

const MAGAZA = '02-MAGAZA-METINLERI.md';
const DOSYALAR = [
  '01-DATA-SAFETY.md',
  MAGAZA,
  '03-ICERIK-DERECELENDIRME.md',
  '04-RISK-RAPORU.md',
  '05-YAYIN-KONTROL-LISTESI.md',
];

// Yasak kalıbın hemen çevresinde olumsuzlama varsa (ör. "garanti etmez",
// "banko demez") bu bir ihlal değil, tam tersine doğru kullanımdır.
const OLUMSUZ = /(etmez|demez|değildir|değil|yok(tur)?|kullanılmaz|yazılmaz|edilmez|vermez|göstermez|yasak|hariç|yerine|olmadan|kaldır)/i;

function ihlaller(metin, kalip) {
  const bulunan = [];
  const re = new RegExp(kalip.source, 'gi');
  let m;
  while ((m = re.exec(metin)) !== null) {
    const pencere = metin.slice(Math.max(0, m.index - 90), m.index + m[0].length + 90);
    if (!OLUMSUZ.test(pencere)) bulunan.push(pencere.replace(/\s+/g, ' ').trim());
  }
  return bulunan;
}

// MAĞAZAYA GİDEN GERÇEK METİN yalnızca ``` blokları içindedir. Dosyanın geri
// kalanı kurallar ve açıklamadır; orada "garanti kullanılmaz" gibi cümlelerin
// bulunması DOĞRUdur. Bu yüzden dil denetimi sadece bloklara uygulanır.
function bloklar(metin) {
  const cikan = [];
  const re = /```\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(metin)) !== null) cikan.push(m[1].trim());
  return cikan;
}

function blok(metin, bolumNo) {
  const re = new RegExp(`## ${bolumNo}\\.[\\s\\S]*?\`\`\`\\n([\\s\\S]*?)\`\`\``);
  return metin.match(re)?.[1]?.trim() || '';
}

const YAYINLANAN = () => bloklar(oku(MAGAZA)).join('\n\n');

test('mağaza metinlerinde iddialı / kazanç vaadi dili yoktur', () => {
  const metin = YAYINLANAN();
  for (const kalip of [
    /kesin(likle)?\s+kazan/i,
    /garanti/i,
    /\bbanko\b/i,
    /yanılmaz/i,
    /net favori/i,
    /kaçmaz/i,
    /kazandırır/i,
    /mutlaka tutar/i,
  ]) {
    const bulunan = ihlaller(metin, kalip);
    assert.deepEqual(bulunan, [], `iddialı dil bulundu (${kalip}): ${bulunan[0] || ''}`);
  }
});

test('mağaza metinlerinde operatör yönlendirmesi veya ödeme çağrısı yoktur', () => {
  const metin = YAYINLANAN();
  for (const kalip of [
    /bahis oyna/i,
    /kupon oyna/i,
    /iddaa oyna/i,
    /üye ol/i,
    /para yatır/i,
    /para çek/i,
    /bonus/i,
    /hemen oyna/i,
  ]) {
    const bulunan = ihlaller(metin, kalip);
    assert.deepEqual(bulunan, [], `operatör/ödeme yönlendirmesi bulundu (${kalip}): ${bulunan[0] || ''}`);
  }
});

test('yayın dosyalarında eski marka adı kalmamıştır', () => {
  // Mağazaya giden metinlerde kesinlikle olmamalı.
  const yayinlanan = YAYINLANAN();
  assert.ok(!/Spor Toto Analiz/i.test(yayinlanan), 'mağaza metninde eski marka adı kalmış');
  assert.ok(!/Spor Toto Master/i.test(yayinlanan), 'mağaza metninde ayrık yazım kalmış');

  // Diğer yayın dosyalarında da kalmamalı (mağaza dosyası hariç: orada eski
  // adlar YASAKLI KALIP olarak listelenir, bu doğru bir kullanımdır).
  for (const ad of DOSYALAR.filter((a) => a !== MAGAZA)) {
    const metin = oku(ad);
    assert.ok(!/Spor Toto Analiz/i.test(metin), `${ad}: eski marka adı kalmış`);
    assert.ok(!/Spor Toto Master/i.test(metin), `${ad}: ayrık yazım kalmış`);
  }
});

test('mağaza metinleri karakter sınırlarını aşmaz', () => {
  const metin = oku(MAGAZA);

  const baslik = blok(metin, 1);
  const kisa = blok(metin, 2);
  const uzun = blok(metin, 3);
  const yenilik = blok(metin, 4);

  assert.ok(baslik && kisa && uzun && yenilik, 'metin blokları okunamadı');

  // Google Play sınırları — Unicode kod noktası sayılır (Türkçe harfler için önemli).
  assert.ok([...baslik].length <= 30, `başlık ${[...baslik].length} karakter (sınır 30)`);
  assert.ok([...kisa].length <= 80, `kısa açıklama ${[...kisa].length} karakter (sınır 80)`);
  assert.ok([...uzun].length <= 4000, `uzun açıklama ${[...uzun].length} karakter (sınır 4000)`);
  assert.ok([...yenilik].length <= 500, `yenilikler ${[...yenilik].length} karakter (sınır 500)`);

  assert.equal(baslik, 'Sportoto Master Analiz', 'mağaza başlığı marka adıyla birebir aynı değil');
});

test('uzun açıklamada bağımsızlık, telif ve vaat-yok bildirimleri geçer', () => {
  const uzun = blok(oku(MAGAZA), 3);
  assert.ok(/bağımsızdır/.test(uzun), 'bağımsızlık bildirimi yok');
  assert.ok(/hazırlanmamış, desteklenmemiş veya onaylanmamıştır/.test(uzun), 'kurum ilişkisi reddi yok');
  assert.ok(/Kesin sonuç veya kazanç vaadi değildir/.test(uzun), 'vaat-yok bildirimi yok');
  assert.ok(uzun.includes('© 2026 Sportoto Master Analiz'), 'telif satırı yok veya birebir değil');
  assert.ok(/18 yaş/.test(uzun), '18 yaş uyarısı yok');
});

test('mağaza kısa açıklaması uygulama içi tanımla aynı anlamı taşır', () => {
  const kisa = blok(oku(MAGAZA), 2);
  // brand.js içindeki APP_TAGLINE ile aynı çekirdek ifadeler bulunmalı.
  for (const parca of ['15 maçlık', 'haftalık bültenler', 'bağımsız analiz', 'tahmin']) {
    assert.ok(kisa.includes(parca), `kısa açıklamada eksik: ${parca}`);
  }
});

test('risk raporu bilinen boşlukları gizlemez', () => {
  const rapor = oku('04-RISK-RAPORU.md');
  // Dürüstlük güvencesi: bu maddeler rapordan sessizce çıkarılamaz.
  assert.ok(/TÜRKPATENT/.test(rapor), 'marka tescili boşluğu raporda yok');
  assert.ok(/DOĞRULANAMADI/.test(rapor), 'doğrulanamayan bilgi açıkça işaretlenmemiş');
  assert.ok(/YÜKSEK/.test(rapor), 'yüksek riskler seviyelendirilmemiş');
  assert.ok(/imzalama anahtarı/i.test(rapor), 'kullanıcıdan alınacaklar listesi eksik');
  assert.ok(/Play Console/.test(rapor), 'Play Console erişimi engeli yazılmamış');
});

test('Data Safety anahtarı reklam/analitik/izleme yokluğunu beyan eder', () => {
  const ds = oku('01-DATA-SAFETY.md');
  assert.ok(/Reklam kimliği|reklam kimliği/.test(ds), 'reklam kimliği satırı yok');
  assert.ok(/Crashlytics/.test(ds), 'çökme günlüğü beyanı yok');
  assert.ok(/Gerçek silme|gerçek silme/.test(ds), 'silmenin gerçek olduğu beyanı yok');
});
