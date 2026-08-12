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
import 'package:flutter/painting.dart';

import '../prefs.dart';
import 'takim_gorunumu.dart';
import 'takim_paleti.dart';
import 'tokens.dart';

/// Kullanıcının görünüm tercihi. Kalıcıdır (`prefs` → `gorunumModu`).
enum GorunumModu {
  /// Cihazın kendi açık/koyu ayarını izler. VARSAYILAN.
  sistem,
  acik,
  koyu,

  /// FAVORİ TAKIMIN renkleri uygulamanın genel temasına uygulanır
  /// (kullanıcı isteği, 2026-08-12 ikinci tur). Yalnız BU modda takım rengi
  /// yapısal yüzeylere çıkar; diğer üçünde takım yalnız arma, filigran ve
  /// küçük profil ayrıntılarında kalır.
  ///
  /// Takım seçilmemişse bu mod VARSAYILAN AÇIĞA düşer (bkz. [gorunumuKur]).
  takim;

  /// Tercih ekranında görünen ad.
  String get etiket => switch (this) {
    GorunumModu.sistem => 'Sistem ayarını kullan',
    GorunumModu.acik => 'Açık mod',
    GorunumModu.koyu => 'Koyu mod',
    GorunumModu.takim => 'Takım teması',
  };

  /// `prefs`e yazılan değer. Enum adının kendisi KULLANILMAZ: karartma
  /// (`--obfuscate`) enum adlarını değiştirebilir ve diskteki eski kayıt
  /// okunamaz hâle gelirdi (bkz. yayin_yapilandirmasi_test — "tip/enum adına
  /// bakan kalıplar kullanılmıyor").
  String get anahtar => switch (this) {
    GorunumModu.sistem => 'sistem',
    GorunumModu.acik => 'acik',
    GorunumModu.koyu => 'koyu',
    GorunumModu.takim => 'takim',
  };

  static GorunumModu cozumle(Object? v) => switch ('$v') {
    'acik' => GorunumModu.acik,
    'koyu' => GorunumModu.koyu,
    'takim' => GorunumModu.takim,
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
      // Takım modunun parlaklığı PALETTEN gelir; palet burada yok, o yüzden
      // takım seçilmemiş hâlin karşılığı olan VARSAYILAN AÇIK döner.
      // Paletli doğru yol [gorunumuKur].
      GorunumModu.takim => Brightness.light,
    };

/// Takım teması SEÇİLEBİLİR mi? Favori takım yoksa/katalogda eşleşmiyorsa
/// hayır — tercih ekranı seçeneği bu yüzden kapatır.
bool takimTemasiKullanilabilir(TakimPaleti? palet) => palet != null;

/// SEÇİLEN MOD + CİHAZ + FAVORİ TAKIM → görünümü kurar, `ThemeData` için
/// kullanılacak parlaklığı döndürür. Uygulamanın TEK giriş noktası budur.
///
/// TAKIM SEÇİLMEMİŞSE 'takim' modu VARSAYILAN AÇIĞA düşer (kullanıcı
/// isteği: "kullanıcı takım seçmemişse … varsayılan açık temaya dönsün").
/// Tercih diskte 'takim' kalır: kullanıcı sonradan takım seçtiğinde ayarı
/// yeniden yapmak zorunda kalmasın.
Brightness gorunumuKur(GorunumModu modu, Brightness cihaz, TakimPaleti? palet) {
  if (modu == GorunumModu.takim && palet != null) {
    takimGorunumunuUygula(palet);
    return takimParlakligi(palet);
  }
  final p = etkinParlaklik(cihaz, modu);
  gorunumuUygula(p);
  return p;
}

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
    // AÇIK/KOYU'DA ZEMİN İLE KART AYNI METNİ PAYLAŞIR: ters kontrast yalnız
    // takım temasına aittir, bu iki modda hiçbir şey değişmemeli.
    AppColors.onBackground = KoyuRenkler.text;
    AppColors.onBackgroundAccent = KoyuRenkler.accent;
    // ANLAMSAL YUMUŞAK YÜZEYLER — marka değerleri, birebir.
    AppColors.successSoft = const Color(0xFFE8F7EE);
    AppColors.warningSoft = const Color(0xFFFFF4DD);
    AppColors.dangerSoft = const Color(0xFFFEE2E2);
    AppColors.infoSoft = const Color(0xFFEAF1FF);
    AppColors.onBackgroundSoft = KoyuRenkler.textSoft;
    AppColors.onBackgroundMuted = KoyuRenkler.muted;
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
  // AÇIK/KOYU'DA ZEMİN İLE KART AYNI METNİ PAYLAŞIR: ters kontrast yalnız
  // takım temasına aittir, bu iki modda hiçbir şey değişmemeli.
  AppColors.onBackground = VarsayilanRenkler.text;
  AppColors.onBackgroundAccent = VarsayilanRenkler.accent;
  AppColors.successSoft = const Color(0xFFE8F7EE);
  AppColors.warningSoft = const Color(0xFFFFF4DD);
  AppColors.dangerSoft = const Color(0xFFFEE2E2);
  AppColors.infoSoft = const Color(0xFFEAF1FF);
  AppColors.onBackgroundSoft = VarsayilanRenkler.textSoft;
  AppColors.onBackgroundMuted = VarsayilanRenkler.muted;
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
