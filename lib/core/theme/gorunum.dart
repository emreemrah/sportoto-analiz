// GÖRÜNÜM MODU — AÇIK / KOYU / SİSTEM (kullanıcı isteği, 2026-08-12)
//
// ═══════════ NEDEN BU DOSYA VAR ═══════════════════════════════════════════
// Önce uygulamanın yapısal renkleri FAVORİ TAKIMDAN geliyordu: takım seçince
// zemin, kart, sekme, navigasyon — hepsi o takımın paletine dönüyordu.
// Kullanıcı bunu kaldırmak istedi (2026-08-12): "kullanıcı tema için takım
// seçmek zorunda kalmasın".
//
// Yeni kural TEK CÜMLE: uygulamanın genel zemini, metni, kartı ve
// navigasyonu YALNIZ bu dosyadaki görünüm tercihiyle belirlenir. Favori takım
// yapısal renklere HİÇ karışmaz; o, profil bilgisi / arma / filigran ve küçük
// kimlik vurgularında yaşar (bkz. takim_paleti.dart).
//
// ═══════════ İKİ PALET, TEK ROL SÖZLÜĞÜ ═══════════════════════════════════
// `VarsayilanRenkler` (açık) ve `KoyuRenkler` (koyu) aynı alan adlarını
// taşır; bu dosya yalnız hangisinin `AppColors`a yazılacağına karar verir.
// Ekranlar değişmez — hepsi zaten `AppColors.x` okuyor.

import 'package:flutter/foundation.dart';

import '../prefs.dart';
import 'tokens.dart';

/// Kullanıcının görünüm tercihi. Kalıcıdır (`prefs` → `gorunumModu`).
enum GorunumModu {
  /// Cihazın kendi açık/koyu ayarını izler. VARSAYILAN.
  sistem,
  acik,
  koyu;

  /// Tercih ekranında görünen ad.
  String get etiket => switch (this) {
    GorunumModu.sistem => 'Sistem ayarını kullan',
    GorunumModu.acik => 'Açık mod',
    GorunumModu.koyu => 'Koyu mod',
  };

  /// `prefs`e yazılan değer. Enum adının kendisi KULLANILMAZ: karartma
  /// (`--obfuscate`) enum adlarını değiştirebilir ve diskteki eski kayıt
  /// okunamaz hâle gelirdi (bkz. yayin_yapilandirmasi_test — "tip/enum adına
  /// bakan kalıplar kullanılmıyor").
  String get anahtar => switch (this) {
    GorunumModu.sistem => 'sistem',
    GorunumModu.acik => 'acik',
    GorunumModu.koyu => 'koyu',
  };

  static GorunumModu cozumle(Object? v) => switch ('$v') {
    'acik' => GorunumModu.acik,
    'koyu' => GorunumModu.koyu,
    // Tanınmayan/eski değer sessizce varsayılana düşer — uydurma yok.
    _ => GorunumModu.sistem,
  };
}

/// Diskteki tercih. Disk henüz yüklenmediyse varsayılan döner.
GorunumModu gorunumModu() => GorunumModu.cozumle(getPref('gorunumModu'));

/// Tercih değişimini ağacın KÖKÜNE duyurur.
///
/// Tercih ekranı ağacın derinindedir; kök (`MasterAnalizApp`) onu doğrudan
/// göremez. Aynı desen oturum için de kullanılıyor (`auth.authState`), yeni
/// bir mekanizma uydurulmadı.
final ValueNotifier<GorunumModu> gorunumNotifier = ValueNotifier(gorunumModu());

/// Tercihi yazar (kalıcı) ve ağacı haberdar eder.
void gorunumModuAyarla(GorunumModu m) {
  setPref('gorunumModu', m.anahtar);
  gorunumNotifier.value = m;
}

/// Disk açılışta geç yüklendiği için bildiriciyi diskteki değerle eşitler.
/// `prefsYukle` bittikten sonra çağrılır; değer aynıysa dinleyici tetiklenmez.
void gorunumBildiriciyiEsitle() => gorunumNotifier.value = gorunumModu();

/// Tercih + cihaz parlaklığından ETKİN parlaklığı bulur.
///
/// [cihaz] `MediaQuery.platformBrightnessOf(context)` ile gelir; 'sistem'
/// dışındaki tercihlerde hiç okunmaz.
Brightness etkinParlaklik(Brightness cihaz, [GorunumModu? modu]) =>
    switch (modu ?? gorunumModu()) {
      GorunumModu.acik => Brightness.light,
      GorunumModu.koyu => Brightness.dark,
      GorunumModu.sistem => cihaz,
    };

/// Yapısal `AppColors` alanlarını [p] parlaklığına göre yazar.
///
/// İdempotenttir: aynı parlaklıkla iki kez çağrılması sonucu değiştirmez.
/// `build` içinden çağrılabilir — `setState` tetiklemez.
///
/// ANLAMSAL RENKLERE DOKUNULMAZ: success / warning / danger / info / live ve
/// green / yellow / red / gold / field `const`tur ve burada hiç geçmez.
/// "Hata kırmızısı" koyu görünümde de kırmızıdır.
void gorunumuUygula(Brightness p) {
  if (p == Brightness.dark) {
    AppColors.background = KoyuRenkler.background;
    AppColors.surface = KoyuRenkler.surface;
    AppColors.surfaceSoft = KoyuRenkler.surfaceSoft;
    AppColors.primary = KoyuRenkler.primary;
    AppColors.primaryDark = KoyuRenkler.primaryDark;
    AppColors.primarySoft = KoyuRenkler.primarySoft;
    AppColors.accent = KoyuRenkler.accent;
    AppColors.accentSoft = KoyuRenkler.accentSoft;
    AppColors.onPrimary = KoyuRenkler.onPrimary;
    AppColors.onPrimarySoft = KoyuRenkler.onPrimarySoft;
    AppColors.onAccent = KoyuRenkler.onAccent;
    AppColors.text = KoyuRenkler.text;
    AppColors.textSoft = KoyuRenkler.textSoft;
    AppColors.muted = KoyuRenkler.muted;
    AppColors.border = KoyuRenkler.border;
    AppColors.darkCard = KoyuRenkler.darkCard;
    AppColors.darkCardSoft = KoyuRenkler.darkCardSoft;
    AppColors.onDark = KoyuRenkler.onDark;
    AppColors.onDarkSoft = KoyuRenkler.onDarkSoft;
    AppColors.darkBorder = KoyuRenkler.darkBorder;
    AppColors.heroZemin = KoyuRenkler.heroZemin;
    AppColors.onHero = KoyuRenkler.onHero;
    AppColors.onHeroSoft = KoyuRenkler.onHeroSoft;
    // Eski takma adlar — kaynaktan gelen isimler, aynı yüzeylere bağlanır.
    AppColors.bg = KoyuRenkler.background;
    AppColors.bgAlt = KoyuRenkler.surfaceSoft;
    AppColors.card = KoyuRenkler.surface;
    AppColors.cardAlt = KoyuRenkler.cardAlt;
    AppColors.textMuted = KoyuRenkler.muted;
    AppColors.gray = KoyuRenkler.muted;
    AppColors.track = KoyuRenkler.track;
    return;
  }

  AppColors.background = VarsayilanRenkler.background;
  AppColors.surface = VarsayilanRenkler.surface;
  AppColors.surfaceSoft = VarsayilanRenkler.surfaceSoft;
  AppColors.primary = VarsayilanRenkler.primary;
  AppColors.primaryDark = VarsayilanRenkler.primaryDark;
  AppColors.primarySoft = VarsayilanRenkler.primarySoft;
  AppColors.accent = VarsayilanRenkler.accent;
  AppColors.accentSoft = VarsayilanRenkler.accentSoft;
  AppColors.onPrimary = VarsayilanRenkler.onPrimary;
  AppColors.onPrimarySoft = VarsayilanRenkler.onPrimarySoft;
  AppColors.onAccent = VarsayilanRenkler.onAccent;
  AppColors.text = VarsayilanRenkler.text;
  AppColors.textSoft = VarsayilanRenkler.textSoft;
  AppColors.muted = VarsayilanRenkler.muted;
  AppColors.border = VarsayilanRenkler.border;
  AppColors.darkCard = VarsayilanRenkler.darkCard;
  AppColors.darkCardSoft = VarsayilanRenkler.darkCardSoft;
  AppColors.onDark = VarsayilanRenkler.onDark;
  AppColors.onDarkSoft = VarsayilanRenkler.onDarkSoft;
  AppColors.darkBorder = VarsayilanRenkler.darkBorder;
  AppColors.heroZemin = VarsayilanRenkler.heroZemin;
  AppColors.onHero = VarsayilanRenkler.onHero;
  AppColors.onHeroSoft = VarsayilanRenkler.onHeroSoft;
  AppColors.bg = VarsayilanRenkler.background;
  AppColors.bgAlt = VarsayilanRenkler.surfaceSoft;
  AppColors.card = VarsayilanRenkler.surface;
  AppColors.cardAlt = VarsayilanRenkler.cardAlt;
  AppColors.textMuted = VarsayilanRenkler.muted;
  AppColors.gray = VarsayilanRenkler.muted;
  AppColors.track = VarsayilanRenkler.track;
}
