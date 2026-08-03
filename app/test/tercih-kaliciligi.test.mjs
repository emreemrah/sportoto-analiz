// TERCİH KALICILIĞI — telefonda ayarlar uygulama kapanınca kaybolmasın.
//
// DOĞRULANMIŞ EKSİK: `prefs.js` ve `analysisProfile.js` yalnız `localStorage`
// kullanıyordu. React Native'de localStorage YOKTUR; dolayısıyla telefonda
//   * görünüm tercihleri (tablo/grafik, sıralama, filtre hatırlama…) ve
//   * kullanıcının kendi kurduğu analiz profilleri (kriterler, ağırlıklar)
// her açılışta sıfırlanıyordu. Kullanıcı aynı ayarı defalarca yapıyordu.
//
// Aynı projede `broadcastStudioStore.js` ve `coupon/store.js` AsyncStorage'a
// yazıyor; eksik olan tek şey aynı kalıbın bu iki dosyada uygulanmasıydı.
//
// Kaynak taraması: bu modüller import anında AsyncStorage'ı `require` ediyor,
// düz Node'da o paket yok. Kalıbın YERİNDE olduğunu bağlıyoruz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (p) => readFileSync(join(KOK, 'src', p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const DOSYALAR = ['prefs.js', 'analysisProfile.js'];

test('iki depo da AsyncStorage yedeğine sahip', () => {
  for (const d of DOSYALAR) {
    const kod = oku(d);
    assert.match(kod, /@react-native-async-storage\/async-storage/, `${d}: AsyncStorage yok`);
    assert.match(kod, /AS\.setItem\(/, `${d}: telefona yazmıyor`);
    assert.match(kod, /AS\.getItem\(/, `${d}: telefondan okumuyor`);
  }
});

test('AsyncStorage YOKSA (web/test) akış bozulmuyor', () => {
  // `require` bir try/catch içinde olmalı; paket yoksa modül import edilemezdi.
  for (const d of DOSYALAR) {
    const kod = oku(d);
    assert.match(
      kod,
      /try \{ AS = require\('@react-native-async-storage\/async-storage'\)\.default; \} catch \{ AS = null; \}/,
      `${d}: eksik paket akışı kırıyor`,
    );
  }
});

test('yazma hatası akışı KIRMIYOR', () => {
  // Tercih kaydedilememesi, ekranın çökmesinden iyidir.
  for (const d of DOSYALAR) {
    const kod = oku(d);
    assert.match(kod, /AS\.setItem\([^)]*\)\.catch\(\(\) => \{\}\)/, `${d}: yazma hatası yutulmuyor`);
  }
});

test('geç gelen DİSK, kullanıcının taze seçimini EZMİYOR', () => {
  // AsyncStorage eşzamansızdır: kullanıcı açılışta hemen bir ayar değiştirirse
  // saniyeler sonra gelen disk verisi onu geri almamalı.
  const prefs = oku('prefs.js');
  assert.match(prefs, /\{ \.\.\.defaults, \.\.\.JSON\.parse\(raw\), \.\.\.\(cache \|\| \{\}\) \}/,
    'prefs.js: disk, mevcut seçimin ÜSTÜNE yazıyor');

  const profil = oku('analysisProfile.js');
  assert.match(profil, /if \(raw == null \|\| bellek\.has\(anahtar\)\) return;/,
    'analysisProfile.js: disk, mevcut kaydı eziyor');
});

test('web davranışı DEĞİŞMEDİ (localStorage hâlâ birincil)', () => {
  // Düzeltme telefonu kurtarırken webi bozmamalı.
  for (const d of DOSYALAR) {
    const kod = oku(d);
    assert.match(kod, /HAS_LS/, `${d}: localStorage yolu kaldırılmış`);
    assert.match(kod, /localStorage\.setItem\(/, `${d}: web'e yazmıyor`);
  }
});
