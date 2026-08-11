// UYGULAMA TEMASI
//
// Kaynak uygulama React Native'dir ve Material tasarım dilini KULLANMAZ:
// her yüzey elle biçimlendirilmiştir. Bu yüzden buradaki tek iş, Flutter'ın
// Material varsayılanlarının (mor vurgu, M3 tonal yüzey renklendirmesi,
// otomatik yükseklik gölgesi, ripple tonu) kaynağın paletini EZMESİNİ
// engellemektir. Yeni bir tasarım kararı verilmez.
//
// Yazı tipi: kaynak RN uygulaması Android'de sistem yazı tipini (Roboto)
// kullanır; Flutter'ın varsayılanı da Roboto'dur. Bu yüzden fontFamily
// BİLEREK boş bırakıldı — elle bir aile yazmak, iki platformda kaynaktan
// SAPMA üretirdi.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'tokens.dart';

abstract final class AppTheme {
  /// Açık tema. Kaynakta `userInterfaceStyle: "light"` (app.json) sabittir;
  /// koyu tema yoktur, bu yüzden burada da tanımlanmaz.
  static ThemeData get light {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.light,
        ).copyWith(
          surface: AppColors.surface,
          primary: AppColors.primary,
          secondary: AppColors.accent,
          error: AppColors.danger,
          onSurface: AppColors.text,
          onPrimary: AppColors.white,
          onSecondary: AppColors.white,
          outline: AppColors.border,
        );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
      dividerColor: AppColors.border,

      // M3'ün yüzeye yükseklikle renk katmasını kapatır: kaynakta kart rengi
      // her zaman düz #FFFFFF'tir, gölgeyle değişmez.
      applyElevationOverlayColor: false,

      splashFactory: InkRipple.splashFactory,

      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.text,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: AppColors.text,
          fontSize: 17,
          fontWeight: AppFont.heavy,
        ),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
        ),
      ),

      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),

      // Kaynakta gölge ve kenarlık kartın kendi stilindedir; Card teması
      // araya kendi yüzeyini/gölgesini koymasın diye nötrlenir.
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
      ),

      textSelectionTheme: const TextSelectionThemeData(
        cursorColor: AppColors.accent,
        selectionHandleColor: AppColors.accent,
      ),

      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.accent,
        linearTrackColor: AppColors.track,
      ),

      // Aşağı çekip yenileme göstergesi: kaynakta RefreshControl vurgu
      // rengiyle çizilir.
      textTheme: Typography.blackMountainView.apply(
        bodyColor: AppColors.text,
        displayColor: AppColors.text,
      ),
    );
  }

  /// Açık zeminli ekranlar (uygulamanın tamamı) — koyu durum çubuğu simgeleri.
  static const SystemUiOverlayStyle lightScreenOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
  );

  /// Koyu zeminli ekranlar (açılış / biyometrik kilit) — beyaz simgeler.
  /// Kaynakta bu ekranlarda `<StatusBar style="light" />` vardır.
  static const SystemUiOverlayStyle darkScreenOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
  );
}
