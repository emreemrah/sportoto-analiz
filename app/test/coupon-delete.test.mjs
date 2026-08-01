// KUPON SİLME + SESSİZ UYARI TESTLERİ.
//
// HATA (kullanıcı bildirimi: "kuponlardaki kuponları silemiyorum"):
// react-native-web, React Native'in Alert'ini BOŞ GÖVDELİ bir taslak olarak
// yayınlar (`class Alert { static alert() {} }`). "Sil" düğmesi onayı
// Alert.alert ile soruyordu; web'de pencere hiç açılmadığı için onay
// düğmesinin onPress'i çağrılmıyor, deleteCoupon HİÇ çalışmıyordu. Düğme
// basılıyor, hiçbir şey olmuyor, sebep de görünmüyordu.
//
// Bu dosya üç şeyi kilitler:
//  1) uyariKuyruk: onay isteği host'a ULAŞIR; onPress ancak düğmeye basılınca
//     çalışır; host yoksa tarayıcı penceresine düşülür — sessiz kalınmaz.
//  2) deleteCoupon gerçekten siler (yerel depo davranışı).
//  3) Ekran kaynağı: hiçbir ekran react-native'den Alert import ETMEZ,
//     App.js host'u çizer, silinemeyen kupon için SEBEP yazılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  dugmeleriDuzelt, aboneOl, hostVarMi, kuyrukAl, kapat, webUyari, yedekYol, _sifirlaTestIcin,
} from '../src/components/uyariKuyruk.js';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (p) => readFileSync(join(kok, p), 'utf8');
// Yorum satırları sınanmaz — yorumda geçen "Alert" kelimesi hata sayılmasın.
const kodu = (p) => oku(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ————————————————— 1) KUYRUK DAVRANIŞI ————————————————— */

test('düğme listesi boşsa tek "Tamam" düğmesi üretilir', () => {
  assert.deepEqual(dugmeleriDuzelt(), [{ text: 'Tamam', style: 'default' }]);
  assert.deepEqual(dugmeleriDuzelt([]), [{ text: 'Tamam', style: 'default' }]);
  const d = dugmeleriDuzelt([{ text: 'Vazgeç' }, { text: 'Sil', style: 'destructive' }]);
  assert.equal(d.length, 2);
  assert.equal(d[0].style, 'default');
  assert.equal(d[1].style, 'destructive');
});

test('host bağlıyken istek kuyruğa girer ve onPress KENDİLİĞİNDEN çalışmaz', () => {
  _sifirlaTestIcin();
  let cizilen = [];
  const birak = aboneOl((l) => { cizilen = l; });
  let silindi = 0;

  const sonuc = webUyari('Kupon sil', '"Kupon 1" silinsin mi?', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: () => { silindi++; } },
  ]);

  assert.equal(sonuc, 'kuyruk');
  assert.equal(hostVarMi(), true);
  assert.equal(cizilen.length, 1, 'host isteği görmeli');
  assert.equal(cizilen[0].baslik, 'Kupon sil');
  assert.equal(silindi, 0, 'onay alınmadan silme çalışmamalı');

  // Kullanıcı "Sil"e basıyor → host önce kapatır, sonra işlevi çağırır.
  const aktif = kuyrukAl()[0];
  kapat(aktif.id);
  aktif.dugmeler[1].onPress();
  assert.equal(silindi, 1, 'onaydan sonra silme ÇALIŞMALI');
  assert.equal(kuyrukAl().length, 0, 'pencere kapanmalı');
  birak();
});

test('REGRESYON: host yokken istek yutulmaz — tarayıcı penceresine düşülür', () => {
  _sifirlaTestIcin();
  let silindi = 0;
  let sorulan = null;
  const pencere = { confirm: (s) => { sorulan = s; return true; }, alert: () => {} };

  const sonuc = webUyari('Kupon sil', '"Kupon 1" silinsin mi?', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: () => { silindi++; } },
  ], undefined, pencere);

  assert.equal(sonuc, 'onay');
  assert.equal(silindi, 1, 'onay verilmişse silme çalışmalı');
  assert.match(sorulan, /Kupon sil/);
  assert.match(sorulan, /silinsin mi/);
});

test('yedek yolda "Vazgeç" seçilirse silme ÇALIŞMAZ', () => {
  _sifirlaTestIcin();
  let silindi = 0; let vazgecildi = 0;
  const pencere = { confirm: () => false, alert: () => {} };
  const sonuc = yedekYol('Kupon sil', 'silinsin mi?', [
    { text: 'Vazgeç', style: 'cancel', onPress: () => { vazgecildi++; } },
    { text: 'Sil', style: 'destructive', onPress: () => { silindi++; } },
  ], pencere);
  assert.equal(sonuc, 'iptal');
  assert.equal(silindi, 0);
  assert.equal(vazgecildi, 1);
});

test('tek düğmeli bilgi mesajı confirm SORMAZ, alert ile gösterilir', () => {
  _sifirlaTestIcin();
  let gosterilen = null; let confirmCagrildi = 0;
  const pencere = { alert: (m) => { gosterilen = m; }, confirm: () => { confirmCagrildi++; return true; } };
  const sonuc = yedekYol('Sınır', 'Haftalık kupon hakkı doldu.', [], pencere);
  assert.equal(sonuc, 'alert');
  assert.equal(confirmCagrildi, 0);
  assert.match(gosterilen, /Haftalık kupon hakkı doldu/);
});

test('pencere hiç yoksa onay İSTEYEN istek kendiliğinden ÇALIŞMAZ', () => {
  _sifirlaTestIcin();
  let silindi = 0;
  const sonuc = yedekYol('Kupon sil', 'silinsin mi?', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: () => { silindi++; } },
  ], null);
  assert.equal(sonuc, 'yazildi');
  assert.equal(silindi, 0, 'onay alınamadıysa yıkıcı işlem YAPILMAZ');
});

/* ————————————————— 2) DEPO: SİLME GERÇEKTEN SİLİYOR MU ————————————————— */

// DÜRÜSTLÜK NOTU: store.js zinciri react-native ve expo-modules-core'a bağlıdır;
// bu paketlerin kaynağı Node'un doğrudan yükleyemediği sözdizimi içerir. Bu
// yüzden deleteCoupon'ın GERÇEK çalışması burada değil, gerçek tarayıcıda
// koşan scripts/verify-coupon-delete.mjs ile kanıtlanır (kupon oluştur → sil →
// localStorage küçüldü mü). Burada yalnız depo sözleşmesi kilitlenir.
test('deleteCoupon depodan siler ve kalıcı yazar (depo sözleşmesi)', () => {
  const kod = kodu('src/coupon/store.js');
  const i = kod.indexOf('export function deleteCoupon');
  assert.ok(i > 0, 'deleteCoupon bulunamadı');
  const blok = kod.slice(i, i + 220);
  assert.match(blok, /filter\(\s*\(?c\)?\s*=>\s*c\.id\s*!==\s*id\s*\)/, 'yalnız verilen kimlik silinmeli');
  assert.match(blok, /persist\(/, 'silme kalıcı yazılmalı (ekran yenilenince geri gelmesin)');
});

/* ————————————————— 3) EKRAN KAYNAĞI ————————————————— */

const EKRANLAR = [
  'src/screens/AboutScreen.js',
  'src/screens/CouponCenterScreen.js',
  'src/screens/CouponEditorScreen.js',
  'src/screens/DeleteAccountScreen.js',
  'src/screens/ProfileScreen.js',
  'src/screens/StudioBulletinScreen.js',
];

test('REGRESYON: hiçbir ekran react-native Alert\'ini kullanmaz (web\'de boş taslak)', () => {
  for (const p of EKRANLAR) {
    const kod = kodu(p);
    assert.equal(/\bAlert\s*\.\s*alert\s*\(/.test(kod), false, `${p}: Alert.alert kalmış`);
    const rnImport = kod.match(/import\s*\{([^}]*)\}\s*from\s*'react-native'/s);
    if (rnImport) {
      assert.equal(/\bAlert\b/.test(rnImport[1]), false, `${p}: react-native'den Alert import ediliyor`);
    }
    assert.match(kod, /from '\.\.\/components\/Uyari'/, `${p}: ortak uyarı modülü import edilmeli`);
  }
});

test('App.js uyarı host\'unu uygulama kökünde çizer', () => {
  const kod = kodu('App.js');
  assert.match(kod, /import \{ UyariHost \} from '\.\/src\/components\/Uyari'/);
  assert.match(kod, /<UyariHost \/>/, 'host JSX ağacına bağlanmalı');
});

test('Kupon Merkezi: silme onayı ortak pencereden geçer', () => {
  const kod = kodu('src/screens/CouponCenterScreen.js');
  const i = kod.indexOf('const doDelete');
  assert.ok(i > 0, 'doDelete bulunamadı');
  const blok = kod.slice(i, i + 400);
  assert.match(blok, /uyari\.alert\(/, 'onay ortak pencereyle sorulmalı');
  assert.match(blok, /deleteCoupon\(/, 'onay verilince silme çağrılmalı');
});

test('Sil düğmesi çizilmiyorsa SEBEBİ ekranda yazar (sessiz kaybolmaz)', () => {
  const kod = kodu('src/screens/CouponCenterScreen.js');
  assert.match(kod, /const silmeSebebi = canEdit/, 'sebep hesabı olmalı');
  assert.match(kod, /Geçmiş haftanın kuponu silinemez/, 'geçmiş hafta sebebi yazılmalı');
  assert.match(kod, /hafta kilitlendi/, 'kilit sebebi yazılmalı');
  assert.match(kod, /testID=\{`kupon-sil-sebep-\$\{c\.id\}`\}/, 'sebep satırı çizilmeli');
  // Sebep, düğmenin çizilmediği durumda görünür: koşul canEdit'in tersi olmalı.
  assert.match(kod, /\{silmeSebebi \? \(/, 'sebep yalnız silinemezken çizilmeli');
});

test('uyarı modülü web\'de gerçek pencere çizer, telefonda işletim sistemine bırakır', () => {
  const kod = kodu('src/components/Uyari.js');
  assert.match(kod, /Platform\.OS === 'web'/);
  assert.match(kod, /RNAlert\.alert\(/, 'telefonda işletim sisteminin penceresi kullanılmalı');
  assert.match(kod, /<Modal/, "web'de gerçek bir pencere çizilmeli");
});
