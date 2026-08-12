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

import 'takim_paleti.dart';
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
      textTheme: Typography.blackMountainView.apply(
        bodyColor: AppColors.text,
        displayColor: AppColors.text,
      ),
    );
  }

  /// TAKIM TEMASI (kullanıcı isteği, 2026-08-11) — palet verildiğinde
  /// Material seviyesindeki yapısal renkler o palete döner; palet null ise
  /// [light] aynen döner ve uygulama bugünkü görünümünü korur.
  ///
  /// ANLAMSAL RENKLER DEĞİŞMEZ: `error` burada BİLEREK ezilmiyor. Kırmızı
  /// takım seçildiğinde hata rengi de takım rengi olsaydı "bir şey ters gitti"
  /// mesajı görsel olarak kaybolurdu.
  ///
  /// Durum çubuğu simgeleri üst çubuğun parlaklığından seçilir: koyu bir takım
  /// yüzeyinde siyah simgeler okunmaz.
  static ThemeData takimli(TakimPaleti? p) {
    if (p == null) return light;
    final t = light;
    final yuzeyAcik = gorecelParlaklik(p.yuzey) > 0.4;

    return t.copyWith(
      scaffoldBackgroundColor: p.zemin,
      canvasColor: p.zemin,
      dividerColor: p.kenarlik,
      colorScheme: t.colorScheme.copyWith(
        surface: p.yuzey,
        primary: p.secili,
        secondary: p.vurgu,
        onSurface: p.yuzeyUstuMetin,
        onPrimary: okunurMetin(p.secili),
        onSecondary: p.vurguUstuMetin,
        outline: p.kenarlik,
        // error / onError DOKUNULMADI — anlamsal.
      ),
      appBarTheme: t.appBarTheme.copyWith(
        backgroundColor: p.yuzey,
        foregroundColor: p.yuzeyUstuMetin,
        titleTextStyle: t.appBarTheme.titleTextStyle?.copyWith(
          color: p.yuzeyUstuMetin,
        ),
        systemOverlayStyle: yuzeyAcik ? lightScreenOverlay : darkScreenOverlay,
      ),
      cardTheme: t.cardTheme.copyWith(color: p.yuzey),
      dividerTheme: t.dividerTheme.copyWith(color: p.kenarlik),
      progressIndicatorTheme: t.progressIndicatorTheme.copyWith(
        color: p.vurgu,
        linearTrackColor: p.kenarlik,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: p.vurgu,
        selectionHandleColor: p.vurgu,
      ),
      textTheme: t.textTheme.apply(
        bodyColor: p.yuzeyUstuMetin,
        displayColor: p.yuzeyUstuMetin,
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
