// EAS DERLEME YAPILANDIRMASI TESTLERİ (T11).
//
// Bu testler mağaza derlemesinin sessizce bozulmasını engeller: profillerin
// varlığı, üretimde AAB üretimi, sürüm otomasyonu ve app.json'da KURULU
// OLMAYAN eklenti bulunmaması (kurulu olmayan plugin = derleme kırılır).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const oku = (ad) => JSON.parse(readFileSync(join(appDir, ad), 'utf8'));

const eas = oku('eas.json');
const app = oku('app.json').expo;
const pkg = oku('package.json');

test('eas.json üç profili de tanımlar', () => {
  for (const profil of ['development', 'preview', 'production']) {
    assert.ok(eas.build?.[profil], `${profil} profili yok`);
  }
});

test('üretim profili Play için AAB üretir ve sürümü otomatik artırır', () => {
  const p = eas.build.production;
  assert.equal(p.android?.buildType, 'app-bundle', 'Play yeni uygulamalarda AAB ister');
  assert.equal(p.autoIncrement, true, 'versionCode elle takip edilmemeli');
  assert.equal(eas.cli?.appVersionSource, 'remote', 'autoIncrement için remote sürüm kaynağı şart');
});

test('test profilleri cihaza kurulabilir APK üretir (mağaza dışı dağıtım)', () => {
  assert.equal(eas.build.preview.android?.buildType, 'apk');
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.development.distribution, 'internal');
});

test('API adresi ortam değişkeninden gelir; eas.json içine GÖMÜLMEZ', () => {
  const ham = readFileSync(join(appDir, 'eas.json'), 'utf8');
  assert.ok(!/EXPO_PUBLIC_API_BASE/.test(ham),
    'adres eas.json içine yazılmamalı — eas env:set ile tanımlanır (OTA güncellemede de geçerli olsun)');
  for (const profil of ['preview', 'production']) {
    assert.ok(eas.build[profil].environment, `${profil}: EAS ortamı referansı yok`);
  }
});

test('app.json içinde KURULU OLMAYAN eklenti yoktur (derleme kırılmasın)', () => {
  const kurulu = new Set(Object.keys(pkg.dependencies || {}));
  const eklentiAdi = (p) => (Array.isArray(p) ? p[0] : p);
  for (const p of app.plugins || []) {
    const ad = eklentiAdi(p);
    if (typeof ad !== 'string' || !ad.startsWith('expo-')) continue;
    assert.ok(kurulu.has(ad), `${ad} app.json'da eklenti olarak yazılı ama package.json'da YOK — derleme kırılır`);
  }
});

test('README-BUILD.md kurulum gerektiren adımları uyarısıyla birlikte anlatır', () => {
  const yol = join(appDir, 'README-BUILD.md');
  assert.ok(existsSync(yol), 'derleme rehberi yok');
  const m = readFileSync(yol, 'utf8');
  assert.match(m, /eas env:set/, 'ortam değişkeni adımı yok');
  assert.match(m, /expo-build-properties/, 'API 36 yedek planı yok');
  assert.match(m, /Paket kurulmadan bu satırı eklemeyin/, 'kurulmamış eklenti uyarısı yok');
  assert.match(m, /12 test kullanıcısı/, 'Play kapalı test şartı yazılmamış');
  assert.match(m, /Play App Signing/, 'imzalama yolu anlatılmamış');
});

test('sürüm alanları tutarlı: app.json ↔ brand.js', () => {
  const brand = readFileSync(join(appDir, 'src', 'brand.js'), 'utf8');
  const m = brand.match(/APP_VERSION = '([^']+)'/);
  assert.ok(m, 'brand.js içinde APP_VERSION yok');
  assert.equal(app.version, m[1], 'app.json sürümü ile brand.js sürümü ayrışmış');
});
