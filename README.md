# masteranaliz

Sportoto Master Analiz

React Native/Expo uygulamasının (`sportoto-analiz-karar-motoru-test/app`)
Flutter çevirisi.

## Kalıcı kapsam kararları

Bu bölüm, parite (birebirlik) denetimlerinde **eksik özellik sayılmayacak**
kararları tutar. Kaynak projede bulunup burada bilerek yer almayan şeyler
buraya yazılır ki her denetimde yeniden "eksik" olarak raporlanmasın.

- **Yayın Stüdyosu ve `studioParts` tablo görünümü kullanıcı kararıyla kapsam
  dışıdır. Parite denetimlerinde eksik özellik sayılmayacak ve yeniden
  eklenmeyecektir.**
  (Arma + 1-0-2 kutulu resmî bülten tablosu. Kupon Merkezi sade kupon kartını
  çizer; ekranda bununla ilgili bir uyarı ya da giriş noktası bulunmaz.
  `studio_fonts.dart` / `studio_theme.dart` gibi ORTAK yardımcılar bu karardan
  etkilenmez — Kupon Sonuç ve Paylaş ekranları onları kullanmaya devam eder.)

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
