// YAYIN STÜDYOSU KAPALI — özellik anahtarı testleri.
//
// Karar: emrah stüdyoyu şu an kullanmıyor (01.08.2026). Kod SİLİNMEDİ,
// kapatıldı — "şimdilik" kalıcı bir karar değildir ve silmek geri dönüşü
// pahalı yapar.
//
// Bu testler iki şeyi birlikte güvenceye alır:
//  1. KAPALI gerçekten kapalı: düğme çizilmiyor VE rota kayıtlı değil.
//     Yalnız düğmeyi gizlemek yetmez — kayıtlı bir rota derin bağlantıyla
//     veya unutulmuş bir navigate çağrısıyla yine açılabilir.
//  2. GERİ AÇILABİLİR: dosyalar, testler ve bağımlılıklar yerinde duruyor.
//     Bir gün `true` yapıldığında eksik parça çıkmamalı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { YAYIN_STUDYOSU_ACIK } from '../src/features.js';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (...p) => readFileSync(join(kok, ...p), 'utf8');

const APP = oku('App.js');
const HOME = oku('src', 'screens', 'HomeScreen.js');

test('anahtar KAPALI (mevcut karar)', () => {
  assert.equal(YAYIN_STUDYOSU_ACIK, false,
    'stüdyo açıldıysa bu test güncellenmeli — açmak bilinçli bir karar olmalı');
});

test('rota kaydı anahtara BAĞLI — gizlemek değil, kaydetmemek', () => {
  // Dört stüdyo ekranının Stack.Screen kaydı koşullu blokta olmalı.
  const i = APP.indexOf('{YAYIN_STUDYOSU_ACIK ? (');
  assert.ok(i > 0, 'App.js\'te koşullu stüdyo bloğu yok');
  const blok = APP.slice(i, APP.indexOf('{detailScreen}', i));
  for (const rota of ['Broadcast', 'StudioBulletin', 'StudioMatch', 'StudioKarne']) {
    assert.match(blok, new RegExp(`name="${rota}"`), `${rota} koşullu blokta değil`);
  }
  // Ve koşulun DIŞINDA ikinci bir kayıt kalmamalı.
  const disarisi = APP.slice(0, i) + APP.slice(APP.indexOf('{detailScreen}', i));
  for (const rota of ['StudioBulletin', 'StudioMatch', 'StudioKarne']) {
    assert.ok(!new RegExp(`name="${rota}"`).test(disarisi),
      `${rota} koşul dışında da kayıtlı — kapatma delinmiş`);
  }
});

test('ana sayfadaki giriş düğmesi anahtara BAĞLI', () => {
  assert.match(HOME, /YAYIN_STUDYOSU_ACIK \? \(/, 'düğme koşulsuz çiziliyor');
  const i = HOME.indexOf('YAYIN_STUDYOSU_ACIK ? (');
  const blok = HOME.slice(i, i + 500);
  assert.match(blok, /navigate\('StudioBulletin'\)/, 'düğme koşullu blokta değil');
});

test('kapalıyken stüdyo YAZI TİPLERİ yüklenmiyor', () => {
  // Kullanılmayacak varlık için açılışta iş yapılmamalı.
  assert.match(APP, /useStudioFontLoader\(YAYIN_STUDYOSU_ACIK\)/,
    'font yükleyici anahtara bağlanmamış');
});

test('GERİ AÇILABİLİR: dosyalar ve testler yerinde duruyor', () => {
  // Kapatmak silmek değildir. Bir gün açıldığında eksik parça çıkmamalı.
  const dosyalar = [
    ['src', 'screens', 'StudioBulletinScreen.js'],
    ['src', 'screens', 'StudioMatchScreen.js'],
    ['src', 'screens', 'StudioKarneScreen.js'],
    ['src', 'screens', 'BroadcastScreen.js'],
    ['src', 'screens', 'studioParts.js'],
    ['src', 'studioTheme.js'],
    ['src', 'studioFonts.js'],
    ['src', 'broadcastStudio.js'],
  ];
  for (const d of dosyalar) {
    assert.ok(existsSync(join(kok, ...d)), `${d.join('/')} silinmiş — geri açmak zorlaşır`);
  }
  // İçe aktarmalar da duruyor: silinirse açmak için elle geri konması gerekir.
  for (const ad of ['StudioBulletinScreen', 'StudioMatchScreen', 'StudioKarneScreen', 'BroadcastScreen']) {
    // Not: BroadcastScreen varsayılan dışa aktarımın yanında adlandırılmış da
    // getiriyor (`import X, { Y }`), o yüzden ad sonrası virgül de kabul edilir.
    assert.match(APP, new RegExp(`import ${ad}[ ,]`), `${ad} içe aktarımı kaldırılmış`);
  }
});

test('stüdyonun KENDİ testleri hâlâ çalışıyor (kapalı ≠ bakımsız)', () => {
  // Kapalıyken bozulan bir ekran, geri açıldığı gün fark edilir — en kötü
  // zamanda. Bu yüzden stüdyo testleri silinmez.
  for (const t of ['broadcast.test.mjs', 'broadcast-studio.test.mjs', 'studio-karne.test.mjs']) {
    assert.ok(existsSync(join(kok, 'test', t)), `${t} silinmiş — kapalı özellik bakımsız kalır`);
  }
});
