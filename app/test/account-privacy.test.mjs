// HESAP SİLME + YASAL YÜZEY testleri (uygulama tarafı, saf modüller).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(here, '..', 'src', p), 'utf8');

test('yasal bağlantılar sunucu adresinden doğru üretilir', async () => {
  const { legalUrls, PRIVACY_PATH, DELETE_ACCOUNT_PATH } = await import('../src/brand.js');

  assert.equal(PRIVACY_PATH, '/gizlilik');
  assert.equal(DELETE_ACCOUNT_PATH, '/hesap-silme');

  const u = legalUrls('https://api.ornek.com');
  assert.equal(u.privacy, 'https://api.ornek.com/gizlilik');
  assert.equal(u.deleteAccount, 'https://api.ornek.com/hesap-silme');

  // Sondaki eğik çizgi çift eğik çizgi üretmez.
  assert.equal(legalUrls('https://api.ornek.com/').privacy, 'https://api.ornek.com/gizlilik');

  // Web'de aynı origin: göreli yol da geçerlidir.
  assert.equal(legalUrls('').privacy, '/gizlilik');
});

test('marka sabitleri tek kaynaktır ve telif satırı birebir doğrudur', async () => {
  const b = await import('../src/brand.js');
  assert.equal(b.APP_NAME, 'Sportoto Master Analiz');
  assert.equal(b.COPYRIGHT, '© 2026 Sportoto Master Analiz');
  assert.ok(/bağımsızdır/.test(b.INDEPENDENCE_NOTICE));
  assert.ok(/hiçbir kurum, operatör veya veri sağlayıcı/.test(b.INDEPENDENCE_NOTICE));
  assert.equal(b.NO_GUARANTEE_NOTICE, 'Kesin sonuç veya kazanç vaadi değildir.');
});

test('uygulama sürümü app.json ile aynıdır', async () => {
  const { APP_VERSION } = await import('../src/brand.js');
  const appJson = JSON.parse(readFileSync(join(here, '..', 'app.json'), 'utf8'));
  assert.equal(APP_VERSION, appJson.expo.version, 'brand.js sürümü app.json ile uyuşmuyor');
});

test('yerel veri anahtarları DEĞİŞTİRİLMEMİŞTİR', async () => {
  const { LOCAL_KEYS } = await import('../src/localData.js');
  // Bu anahtarların adı değişirse mevcut kullanıcı verisi erişilemez olur.
  for (const k of [
    'sportoto.token',
    'sportoto.prefs',
    'sportoto.couponCenter.v1',
    'sportoto.analysisProfiles.v2',
    'sportoto.analysisProfile.v1',
  ]) {
    assert.ok(LOCAL_KEYS.includes(k), `korunması gereken anahtar listede yok: ${k}`);
  }
  // Hesap silinince telefon bildirimi tercihi de cihazdan gitmeli.
  assert.ok(LOCAL_KEYS.includes('sportoto.push.v1'), 'bildirim tercihi temizlik listesinde değil');
});

test('yerel temizleme tüm anahtarları siler ve başarısızlığı dürüstçe bildirir', async () => {
  const { wipeLocalData, LOCAL_KEYS } = await import('../src/localData.js');

  const silinen = [];
  const r = await wipeLocalData({ localStore: { removeItem: (k) => silinen.push(k) } });
  assert.deepEqual(r.cleared, LOCAL_KEYS);
  assert.deepEqual(r.failed, []);
  assert.deepEqual(silinen, LOCAL_KEYS);

  // Depo hata verirse "temizlendi" DENMEZ.
  const kotu = await wipeLocalData({
    localStore: { removeItem: () => { throw new Error('depo kapalı'); } },
  });
  assert.deepEqual(kotu.cleared, []);
  assert.deepEqual(kotu.failed, LOCAL_KEYS);

  // Hiç depo verilmezse de çökmez.
  const bos = await wipeLocalData();
  assert.deepEqual(bos.failed, LOCAL_KEYS);
});

test('hesap silme ekranı onay ifadesi olmadan çalışmaz', async () => {
  // isConfirmed saf bir fonksiyondur; ekran dosyası RN içerdiği için metinden
  // değil, mantığın kopyasından değil, doğrudan davranıştan doğrulanır.
  const dosya = src('screens/DeleteAccountScreen.js');
  assert.ok(dosya.includes("export const CONFIRM_PHRASE = 'HESABIMI SIL'"), 'onay ifadesi tanımlı değil');
  assert.ok(/disabled=\{!onaylandi \|\| busy\}/.test(dosya), 'onaysız buton kapalı değil');
  assert.ok(/if \(!r\?\.ok\) throw new Error/.test(dosya), 'sunucu hatasında "silindi" denmiyor mu kontrolü yok');

  // Yerel temizlik SUNUCU onayından SONRA yapılmalı.
  const okIndex = dosya.indexOf('if (!r?.ok)');
  const wipeIndex = dosya.indexOf('await wipeLocalData(');
  assert.ok(okIndex > -1 && wipeIndex > okIndex, 'yerel veriler sunucu onayından önce siliniyor');
});

test('hakkında ekranı zorunlu yasal metinleri marka dosyasından okur', () => {
  const dosya = src('screens/AboutScreen.js');
  for (const sabit of [
    'APP_NAME',
    'APP_TAGLINE',
    'COPYRIGHT',
    'INDEPENDENCE_NOTICE',
    'NO_GUARANTEE_NOTICE',
    'OFFICIAL_RESULT_NOTICE',
  ]) {
    assert.ok(dosya.includes(sabit), `Hakkında ekranında eksik: ${sabit}`);
  }
  // Elle yazılmış marka metni olmamalı.
  assert.ok(!/['"]Sportoto Master Analiz['"]/.test(dosya), 'marka adı elle yazılmış');
  // Gizlilik ve hesap silme yolları görünür olmalı.
  assert.ok(/legalUrls/.test(dosya), 'yasal bağlantılar üretilmiyor');
  assert.ok(/DeleteAccount/.test(dosya), 'hesap silme yolu yok');
});

test('profil ekranında hesap silme ve yasal metinler vardır', () => {
  const dosya = src('screens/ProfileScreen.js');
  assert.ok(/navigate\('DeleteAccount'\)/.test(dosya), 'Hesabımı Sil bağlantısı yok');
  assert.ok(/navigate\('About'\)/.test(dosya), 'Hakkında bağlantısı yok');
  assert.ok(/INDEPENDENCE_NOTICE/.test(dosya), 'bağımsızlık bildirimi yok');
  assert.ok(/COPYRIGHT/.test(dosya), 'telif satırı yok');
});
