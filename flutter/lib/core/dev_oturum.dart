// GELİŞTİRME KOLAYLIĞI — EMÜLATÖRDE OTOMATİK GİRİŞ (2026-08-11)
//
// SORUN: emülatörde her yeni derlemede tekrar tekrar giriş yapmak gerekiyor.
// Kod tarafında bir hata yok — giriş `persistSession` ile diske yazılıyor ve
// açılışta `initAuthYerel` okuyor. Kaybın sebebi ortam: oturum belirteçleri
// `flutter_secure_storage` ile Android Keystore'da tutuluyor ve uygulama
// emülatöre yeniden kurulduğunda o anahtarlar kaybolabiliyor; okuma null döner
// ve uygulama dürüstçe "oturum yok" der.
//
// ÇÖZÜM: yalnız GELİŞTİRME derlemesinde, açılışta bir kez otomatik giriş.
//
// ═════════════════════ GÜVENLİK — ÜÇ SIKI KURAL ═══════════════════════════
//  1. YAYIN DERLEMESİNDE TAMAMEN KAPALI. Kapı `dart.vm.product` iledir; bu
//     bayrak `flutter build --release` ile derlendiğinde true olur ve aşağıdaki
//     kod hiçbir koşulda çalışmaz.
//  2. KİMLİK BİLGİSİ KODA YAZILMAZ. E-posta ve parola `--dart-define` ile
//     dışarıdan verilir; ikisi de boşsa özellik yoktur. Depoda hiçbir hesap
//     bilgisi durmaz.
//  3. SESSİZ BAŞARISIZLIK YOK ama AÇILIŞ DA BOZULMAZ: giriş denemesi
//     başarısız olursa uygulama olağan giriş ekranıyla açılır.
//
// KULLANIM:
//   flutter run -d emulator-5554 ^
//     --dart-define=DEV_EMAIL=ornek@example.com ^
//     --dart-define=DEV_SIFRE=parola
//
// Parametreler verilmezse davranış bugünküyle birebir aynıdır.

import 'dart:async';

import 'auth.dart' as auth;

/// Yayın derlemesi mi? (`flutter build --release` → true)
const bool _kYayin = bool.fromEnvironment('dart.vm.product');

const String _kDevEposta = String.fromEnvironment('DEV_EMAIL');
const String _kDevSifre = String.fromEnvironment('DEV_SIFRE');

/// Otomatik giriş bu derlemede kullanılabilir mi?
///
/// Yayın derlemesinde HER ZAMAN false — kimlik bilgisi verilmiş olsa bile.
bool get devOtomatikGirisAcik =>
    !_kYayin && _kDevEposta.isNotEmpty && _kDevSifre.isNotEmpty;

/// Açılışta bir kez çağrılır. Zaten oturum varsa hiçbir şey yapmaz.
///
/// [girisYap] yalnız TESTLER içindir; üretimde gerçek `auth.login` kullanılır.
Future<void> devOtomatikGiris({
  Future<void> Function(String eposta, String sifre)? girisYap,
  bool Function()? girisliMi,
  Duration zamanAsimi = const Duration(seconds: 15),
}) async {
  if (!devOtomatikGirisAcik) return;

  final girisli = girisliMi ?? () => auth.getToken() != null;
  if (girisli()) return; // kalıcı oturum yaşıyor — dokunma

  try {
    final f = girisYap ?? (e, s) => auth.login(e, s);
    await f(_kDevEposta, _kDevSifre).timeout(zamanAsimi);
  } catch (_) {
    // Ağ yok, parola değişmiş, sunucu kapalı… Hepsi olağan: uygulama giriş
    // ekranıyla açılır. Geliştirme kolaylığının başarısızlığı açılışı
    // engellemez.
  }
}
