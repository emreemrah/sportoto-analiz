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
  /// GEÇERLİ görünümün teması (kullanıcı isteği, 2026-08-12).
  ///
  /// Değerleri `AppColors`tan ÇALIŞMA ZAMANINDA okur; hangi paletin yazılı
  /// olduğuna `gorunumuUygula` karar verir. Bu yüzden ayrı bir `darkTheme`
  /// YOKTUR ve `themeMode` kullanılmaz: iki ThemeData'yı aynı anda kurmak,
  /// tek bir küresel `AppColors` varken ikisinden birinin yanlış paletle
  /// dolması demekti. Tek tema, doğru palet.
  ///
  /// [p] yalnız Material'in kendi varsayılanlarını (ripple tonu, seed
  /// üretimi, durum çubuğu simgeleri) doğru uca çekmek için gerekir.
  static ThemeData gecerli(Brightness p) {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: p,
        ).copyWith(
          surface: AppColors.surface,
          primary: AppColors.primary,
          secondary: AppColors.accent,
          error: AppColors.danger,
          onSurface: AppColors.text,
          onPrimary: AppColors.onPrimary,
          onSecondary: AppColors.onAccent,
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

      appBarTheme: AppBarTheme(
        // ÜST ÇUBUĞUN ALT KÖŞELERİ OVAL (kullanıcı isteği, 2026-08-12):
        // "keskin dikdörtgen bir blok gibi görünmesin". Tema düzeyinde
        // verildiği için Kupon Hazırla, Güvenlik Ayarları, Görünüm, Bağlı
        // Cihazlar gibi `AppBar` kullanan BÜTÜN ekranlar aynı yarıçapı alır —
        // ekran ekran elle yazılsaydı biri unutulurdu.
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.ustPanelR),
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
        // Simgeler ÜST ÇUBUĞUN parlaklığından seçilir: koyu görünümde siyah
        // simge okunmaz.
        systemOverlayStyle: p == Brightness.dark
            ? darkScreenOverlay
            : lightScreenOverlay,
      ),

      dividerTheme: DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),

      // Kaynakta gölge ve kenarlık kartın kendi stilindedir; Card teması
      // araya kendi yüzeyini/gölgesini koymasın diye nötrlenir.
      cardTheme: CardThemeData(
        color: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
      ),

      textSelectionTheme: TextSelectionThemeData(
        cursorColor: AppColors.accent,
        selectionHandleColor: AppColors.accent,
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: AppColors.accent,
        linearTrackColor: AppColors.track,
      ),

      // Aşağı çekip yenileme göstergesi: kaynakta RefreshControl vurgu
      // rengiyle çizilir.
      // Taban tipografi uca göre seçilir; renkler zaten aşağıda eziliyor ama
      // `blackMountainView` koyu görünümde ikon/imleç gibi türev renkleri de
      // koyu üretiyordu.
      textTheme:
          (p == Brightness.dark
                  ? Typography.whiteMountainView
                  : Typography.blackMountainView)
              .apply(bodyColor: AppColors.text, displayColor: AppColors.text),
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
