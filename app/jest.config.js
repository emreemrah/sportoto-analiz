// ARAYÜZ (RENDER) TESTLERİ İÇİN JEST YAPILANDIRMASI — T15.
//
// NEDEN AYRI: Projenin asıl test düzeni düz `node --test` (mantık/servis
// katmanı, 600+ test) ve BOZULMAZ. Ama React Native bileşenleri düz Node'da
// render edilemez (JSX dönüşümü, platform çözümlemesi ve RN yerel modül
// taklitleri gerekir). Bu yüzden yalnız EKRAN testleri jest-expo ile çalışır.
//
//   npm test        → node:test  (mantık katmanı, hızlı)
//   npm run test:ui → jest       (ekran/render katmanı)
//
// Dosya adı sözleşmesi: test-ui/*.test.jsx  (node:test bunları görmez, çünkü
// o yalnız test/ klasöründeki *.test.mjs dosyalarını çalıştırır.)
//
// NOT: transformIgnorePatterns BİLEREK ezilmiyor — jest-expo preset'i SDK'ya
// uygun listeyi kendi getiriyor; elle yazılan liste eksik kalıp modüllerin
// dönüştürülmemesine yol açıyordu.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/test-ui/**/*.test.jsx'],
  setupFilesAfterEnv: ['<rootDir>/test-ui/setup.js'],
};
