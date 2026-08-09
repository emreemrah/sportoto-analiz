// KAYNAK: app/src/studioTheme.js — BİREBİR çeviri.
//
// YAYIN STÜDYOSU — görsel dil (saf sabitler).
//
// NEDEN AYRI DOSYA: Stüdyonun ekranları (kupon sonucu, kupon paylaşımı) aynı
// görünümü kullanır. Renk/ölçü her ekranda ayrı yazılırsa yayında biri
// diğerinden farklı görünür. Tek kaynak burasıdır.
//
// GÖRÜNÜM KARARI (kullanıcı seçimi): "resmî bülten tablosu".
// Açık zemin, ince gri çizgi, sıkışık satır, koyu başlık şeridi, turuncu vurgu.
// Yuvarlak köşe ve gölge neredeyse yok; büyük başlık yok; tek ekranda 15 satır.
//
// KURALLAR:
//  • Uygulamanın genel teması DEĞİŞMEZ. Burası ayrı bir yüzeydir; genel tema
//    dosyasına (tokens.dart) dokunulmaz.
//  • Renkler yalnız görseldir; hiçbir renk "kesin/garanti" anlamı taşımaz.
//    Yeşil "kazanır" demek değildir — yalnız DÜŞÜK risk seviyesidir.
//  • Hiçbir kurumun amblemi, logosu veya kurumsal rengi taklit edilmez;
//    turuncu vurgu genel bir vurgu rengidir, bir kuruma ait değildir.

import 'package:flutter/widgets.dart';

/* ————————————————— PALET ————————————————— */
abstract final class S {
  /// sayfa zemini — tablo bunun üstünde "kağıt" gibi durur
  static const bg = Color(0xFFEEF0F3);

  /// tablo / panel yüzeyi
  static const panel = Color(0xFFFFFFFF);

  /// zebra satır, ikincil yüzey
  static const panel2 = Color(0xFFF7F8FA);

  /// sütun başlığı şeridi, pasif alan
  static const panel3 = Color(0xFFEDEFF3);

  /// koyu başlık şeridi (resmî tablodaki gibi)
  static const head = Color(0xFF3E5064);
  static const headInk = Color(0xFFFFFFFF);

  /// ince gri çizgi — tablonun iskeleti
  static const line = Color(0xFFD8DDE3);
  static const lineSoft = Color(0xFFE7EAEE);
  static const lineStrong = Color(0xFFB9C2CC);

  /// ana yazı
  static const ink = Color(0xFF14202B);
  static const inkSoft = Color(0xFF4E5D6B);
  static const inkDim = Color(0xFF8593A0);

  /// vurgu (turuncu)
  static const accent = Color(0xFFD2551F);
  static const accentSoft = Color(0xFFFBEDE6);

  /// turuncu zemin üzerine yazı
  static const accentInk = Color(0xFFFFFFFF);

  static const good = Color(0xFF1B7A4C);
  static const goodSoft = Color(0xFFE4F2EA);
  static const warn = Color(0xFF96650A);
  static const warnSoft = Color(0xFFFAF0DC);
  static const bad = Color(0xFFAF2620);
  static const badSoft = Color(0xFFFAE8E6);
  static const info = Color(0xFF1D5C9E);
  static const infoSoft = Color(0xFFE7EFF8);
}

/* SEVİYE→RENK EŞLEMESİ (toneOfLevel / toneSoftOfLevel) SİLİNDİ — yayıncı
   isteği. Bir maçı/kuponu yeşil-sarı-kırmızı diye boyamak, yazıyla
   "güvenli/riskli" demenin sessiz hâliydi. Renk sözlüğü (good/warn/bad)
   duruyor; sınır aşımı gibi NESNEL uyarılarda kullanılır. */

/// Seçim genişliğinin rengi (tek/çift/kapalı).
Color toneOfKind(String? kind) => switch (kind) {
      'tek' => S.good,
      'cift' => S.info,
      'kapali' => S.accent,
      _ => S.inkDim,
    };

/* ————————————————— ÖLÇÜ ————————————————— */
// Yuvarlaklık bilerek çok küçük: resmî tablo görünümü köşeli çizgilerden doğar.
abstract final class R {
  static const double sm = 2;
  static const double md = 3;
  static const double lg = 4;
  static const double xl = 6;
  static const double pill = 999;
}

// Dolgu bilerek dar: aynı ekrana 15 satır sığmalı.
abstract final class SP {
  static const double xs = 3;
  static const double sm = 6;
  static const double md = 9;
  static const double lg = 13;
  static const double xl = 18;
}

/// Tablo ölçüleri — satır yüksekliği ve çizgi kalınlığı tek yerden.
abstract final class TABLE {
  /// sıkışık satır
  static const double rowH = 34;
  static const double headH = 30;

  /// ince ayırıcı
  static const double hair = 1;
  static const double cellPadX = 8;
}

/// Punto ölçeği. Geniş ekranda bile 1.0'ı geçmez; okunabilirlik alt sınırı
/// 0.86'dır.
double scaleFor(double? width) {
  if (width == null || !width.isFinite) return 1;
  if (width >= 1280) return 1;
  if (width >= 900) return 0.97;
  if (width >= 620) return 0.94;
  if (width >= 420) return 0.9;
  return 0.86;
}

typedef StudioPunto = ({
  double mikro,
  double kucuk,
  double metin,
  double orta,
  double buyuk,
  double baslik,
  double sayi,
});

/// Tipografi ölçeği — punto adları tek yerde. Ekranlarda "18 * k" gibi çıplak
/// sayı yazmak yerine T(k).baslik kullanılır; böylece yoğunluk tek dosyadan
/// ayarlanır ve bir ekran diğerinden büyük kalmaz.
StudioPunto T([double k = 1]) {
  double p(double n) => (n * k).roundToDouble();
  return (
    // sütun başlığı, büyük-harf etiket
    mikro: p(9.5),
    // yardımcı satır, açıklama
    kucuk: p(11),
    // gövde
    metin: p(12.5),
    // takım adı, tablo hücresi
    orta: p(13.5),
    // panel başlığı
    buyuk: p(15),
    // ekran başlığı
    baslik: p(17),
    // öne çıkan sayı (karne skoru)
    sayi: p(19),
  );
}

/// Büyük-harf etiket stili — başlık yerine kullanılır, yer kaplamaz.
const double kEtiketLetterSpacing = 0.7;

/// Dar yerleşim eşiği — satırın alt sıraya kırılacağı genişlik.
const double kNarrowMax = 560;

/// Sağdaki özet paneli bu genişlikten sonra yan yana durur.
const double kSidebarMin = 900;
