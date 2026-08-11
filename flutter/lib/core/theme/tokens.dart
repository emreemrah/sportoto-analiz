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

/// `theme.js` → `colors`
abstract final class AppColors {
  static const background = Color(0xFFF3F5F9);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceSoft = Color(0xFFF8FAFC);

  static const primary = Color(0xFF0B1B3A);
  static const primaryDark = Color(0xFF071329);
  static const primarySoft = Color(0xFFE8EEF8);

  static const accent = Color(0xFFE21B2D);
  static const accentSoft = Color(0xFFFFE8EB);

  static const success = Color(0xFF16A34A);
  static const successSoft = Color(0xFFE8F7EE);

  static const warning = Color(0xFFF59E0B);
  static const warningSoft = Color(0xFFFFF4DD);

  static const danger = Color(0xFFDC2626);
  static const dangerSoft = Color(0xFFFEE2E2);

  static const info = Color(0xFF2563EB);
  static const infoSoft = Color(0xFFEAF1FF);

  static const text = Color(0xFF101828);
  static const textSoft = Color(0xFF475467);
  static const muted = Color(0xFF98A2B3);
  static const border = Color(0xFFE4E7EC);

  static const darkCard = Color(0xFF111C34);
  static const darkCardSoft = Color(0xFF18243F);
  static const white = Color(0xFFFFFFFF);
  static const black = Color(0xFF000000);

  // --- Geriye dönük uyumluluk (eski token adları → yeni palet) ---
  static const bg = Color(0xFFF3F5F9);
  static const bgAlt = Color(0xFFF8FAFC);
  static const card = Color(0xFFFFFFFF);
  static const cardAlt = Color(0xFFE8EEF8);
  static const textMuted = Color(0xFF98A2B3);
  static const field = Color(0xFF16A34A);
  static const gold = Color(0xFFF59E0B);
  static const green = Color(0xFF16A34A);
  static const yellow = Color(0xFFF59E0B);
  static const red = Color(0xFFDC2626);
  static const gray = Color(0xFF98A2B3);
  static const orange = Color(0xFFF59E0B);
  static const track = Color(0xFFE8EEF8);
}

/// `theme.js` → `labelColors`
abstract final class LabelColors {
  static const green = AppColors.success;
  static const yellow = AppColors.warning;
  static const red = AppColors.danger;
  static const gray = AppColors.muted;
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
