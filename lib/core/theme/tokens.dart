// KAYNAK: app/src/theme.js — BİREBİR çeviri.
//
// Değer eklenmedi, çıkarılmadı, yuvarlanmadı. Kaynaktaki "geriye dönük
// uyumluluk" takma adları da AYNEN korundu: 159 kaynak dosyanın bir kısmı
// eski adları (bg, card, textMuted, gold, ...), bir kısmı yeni adları
// (background, surface, muted, warning, ...) kullanıyor. Birini atmak,
// çevirinin ortasında sessiz renk kayması demek olurdu.
//
// RN → Flutter tek gerçek fark: gölge. React Native'de shadowOpacity ayrı bir
// alandır; Flutter'da renge gömülüdür. Opaklık ARGB alfasına çevrildi
// (0.08 × 255 ≈ 0x14, 0.05 × 255 ≈ 0x0D).

import 'package:flutter/material.dart';

// ═══════════ TAKIM TEMASI: YAPISAL RENKLER ARTIK DEĞİŞKEN ════════════════
// (kullanıcı isteği, 2026-08-11 → bütüncül tema)
//
// Önce yalnız birkaç yüzey temaya bağlanmıştı; kullanıcı haklı olarak "eski
// lacivert/kırmızı/beyaz/gri birçok yerde kalıyor" dedi. Sebebi ölçüldü:
// `AppColors` 1834 yerde DOĞRUDAN kullanılıyor ve `Theme.of(context)` hiç
// kullanılmıyor — yani ekranlar temayı hiç sormuyor.
//
// ÇÖZÜM: yapısal renkler `const` olmaktan çıkıp DEĞİŞKEN oldu. Tema
// değiştiğinde [temayiUygula] bu alanları yeniden yazar ve ağaç yeniden
// çizilince 1834 kullanımın HEPSİ yeni rengi okur — tek tek dosya
// değiştirmeye gerek kalmaz.
//
// BEDELİ AÇIK: `const` bağlamda kullanılan 756 nokta artık `const` olamıyor
// (ölçüldü). O widget'lar her çizimde yeniden kurulur. Bütüncül tema bunu
// gerektiriyordu; başka yolu yok çünkü Flutter'da derleme zamanı bir sabit
// çalışma zamanında değişemez.
//
// ANLAMSAL RENKLER `const` KALDI: success / warning / danger / info ve
// green / yellow / red / orange / gold / field. Bunlar takım temasından
// ETKİLENMEZ — kırmızı "hata", yeşil "galibiyet" anlamını korur.

/// `theme.js` → `colors`
abstract final class AppColors {
  static Color background = Color(0xFFF3F5F9);
  static Color surface = Color(0xFFFFFFFF);
  static Color surfaceSoft = Color(0xFFF8FAFC);

  static Color primary = Color(0xFF0B1B3A);
  static Color primaryDark = Color(0xFF071329);
  static Color primarySoft = Color(0xFFE8EEF8);

  static Color accent = Color(0xFFE21B2D);
  static Color accentSoft = Color(0xFFFFE8EB);

  // ÜSTÜNDEKİ YAZI (kullanıcı isteği: "kontrast her ekranda korunacak").
  //
  // Varsayılan markada `primary` lacivert, `accent` kırmızıdır ve ikisinin de
  // üstüne BEYAZ yazılır — o yüzden başlangıç değeri beyazdır ve bugünkü
  // görünüm birebir korunur. Takım temasında bu iki alan zemin renginden
  // HESAPLANIR: sarı bir buton üstünde beyaz yazı okunmaz, siyah yazılır.
  //
  // Ölçüm (150 takım): `primary` zemininde beyaz yazı 110 takımda, `accent`
  // zemininde 97 takımda AA eşiğinin altında kalıyordu.
  static Color onPrimary = Color(0xFFFFFFFF);
  static Color onAccent = Color(0xFFFFFFFF);

  static const success = Color(0xFF16A34A);
  static const successSoft = Color(0xFFE8F7EE);

  static const warning = Color(0xFFF59E0B);
  static const warningSoft = Color(0xFFFFF4DD);

  static const danger = Color(0xFFDC2626);
  static const dangerSoft = Color(0xFFFEE2E2);

  static const info = Color(0xFF2563EB);
  static const infoSoft = Color(0xFFEAF1FF);

  static Color text = Color(0xFF101828);
  static Color textSoft = Color(0xFF475467);
  static Color muted = Color(0xFF98A2B3);
  static Color border = Color(0xFFE4E7EC);

  static Color darkCard = Color(0xFF111C34);
  static Color darkCardSoft = Color(0xFF18243F);
  static const white = Color(0xFFFFFFFF);
  static const black = Color(0xFF000000);

  // --- Geriye dönük uyumluluk (eski token adları → yeni palet) ---
  static Color bg = Color(0xFFF3F5F9);
  static Color bgAlt = Color(0xFFF8FAFC);
  static Color card = Color(0xFFFFFFFF);
  static Color cardAlt = Color(0xFFE8EEF8);
  static Color textMuted = Color(0xFF98A2B3);
  static const field = Color(0xFF16A34A);
  static const gold = Color(0xFFF59E0B);
  static const green = Color(0xFF16A34A);
  static const yellow = Color(0xFFF59E0B);
  static const red = Color(0xFFDC2626);
  static Color gray = Color(0xFF98A2B3);
  static const orange = Color(0xFFF59E0B);
  static Color track = Color(0xFFE8EEF8);
}

/// VARSAYILAN (marka) yapısal renkler — takım seçilmediğinde bunlara dönülür.
/// `AppColors` değişken alanlarının başlangıç değerleriyle birebir aynıdır.
abstract final class VarsayilanRenkler {
  static const background = Color(0xFFF3F5F9);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceSoft = Color(0xFFF8FAFC);
  static const primary = Color(0xFF0B1B3A);
  static const primaryDark = Color(0xFF071329);
  static const primarySoft = Color(0xFFE8EEF8);
  static const accent = Color(0xFFE21B2D);
  static const accentSoft = Color(0xFFFFE8EB);
  static const onPrimary = Color(0xFFFFFFFF);
  static const onAccent = Color(0xFFFFFFFF);
  static const text = Color(0xFF101828);
  static const textSoft = Color(0xFF475467);
  static const muted = Color(0xFF98A2B3);
  static const border = Color(0xFFE4E7EC);
  static const darkCard = Color(0xFF111C34);
  static const darkCardSoft = Color(0xFF18243F);
  static const cardAlt = Color(0xFFE8EEF8);
  static const track = Color(0xFFE8EEF8);
}

/// `theme.js` → `labelColors`
///
/// ANLAMSAL — takım temasından etkilenmez, bu yüzden hepsi `const` ve
/// `AppColors`ın değişken alanlarına BAĞLI DEĞİL.
abstract final class LabelColors {
  static const green = AppColors.success;
  static const yellow = AppColors.warning;
  static const red = AppColors.danger;
  static const gray = Color(0xFF98A2B3);
}

/// `theme.js` → `spacing`
abstract final class Spacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
}

/// `theme.js` → `radius`
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 22;
  static const double pill = 999;

  static const smR = BorderRadius.all(Radius.circular(sm));
  static const mdR = BorderRadius.all(Radius.circular(md));
  static const lgR = BorderRadius.all(Radius.circular(lg));
  static const xlR = BorderRadius.all(Radius.circular(xl));
  static const pillR = BorderRadius.all(Radius.circular(pill));
}

/// `theme.js` → `font` (boyutlar + ağırlıklar)
abstract final class AppFont {
  static const double xs = 11;
  static const double sm = 12;
  static const double md = 14;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 26;

  static const regular = FontWeight.w400;
  static const medium = FontWeight.w500;
  static const semibold = FontWeight.w600;
  static const bold = FontWeight.w700;
  static const heavy = FontWeight.w800;

  /// RN'de `fontWeight: '900'` doğrudan yazılan yerler var (marka, skor,
  /// rozet metinleri). Kaynakta token değil ham değer olduğu için burada da
  /// ayrı duruyor — token listesine uydurma bir isim eklenmedi.
  static const black = FontWeight.w900;
}

/// `theme.js` → `shadow` / `shadows`
abstract final class AppShadow {
  /// RN: shadowColor #101828, offset (0,8), opacity .08, radius 18, elevation 4
  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x14101828), offset: Offset(0, 8), blurRadius: 18),
  ];

  /// RN: shadowColor #101828, offset (0,4), opacity .05, radius 10, elevation 2
  static const List<BoxShadow> soft = [
    BoxShadow(color: Color(0x0D101828), offset: Offset(0, 4), blurRadius: 10),
  ];
}
