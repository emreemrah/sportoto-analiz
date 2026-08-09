// KAYNAK: app/src/apiBase.js — BİREBİR çeviri.
//
// Kaynaktaki gibi SAF mantıktır: Flutter'a hiç bağımlı değildir, bu yüzden
// düz Dart testinden doğrudan çağrılabilir (kaynakta da aynı gerekçeyle
// React Native'den ayrılmıştı).
//
// YAYIN GÜVENLİĞİ (KESİN KURAL — kaynaktan aynen taşındı)
// Yayın derlemesinde localhost / LAN IP / şifresiz http adresi KULLANILMAZ.
// Kişisel veri yalnız HTTPS üzerinden taşınır. Yanlış yapılandırma sessizce
// yerel adrese düşmez; açık hata verir.
//
// ────────────────────────────────────────────────────────────────────────────
// TEK BİLİNÇLİ SAPMA — GELİŞTİRME ADRESİ
//
// Kaynakta geliştirme adresi iki daldı: web → `localhost`, telefon →
// `DEV_LAN_IP`. Sebebi Expo Go'nun GERÇEK telefonda çalışmasıydı; telefon
// bilgisayarın LAN adresini görür.
//
// Flutter'da geliştirmenin varsayılan hedefi ANDROID EMÜLATÖRÜDÜR ve emülatör
// `localhost`'u KENDİSİ sanar — bilgisayara `10.0.2.2` ile ulaşır. Kaynağın
// LAN IP'sini buraya olduğu gibi taşımak, emülatörde her isteğin sessizce
// zaman aşımına düşmesi demekti.
//
// Bu yüzden geliştirme dalı üçe ayrıldı ve LAN IP KALDIRILMADI: gerçek
// telefonda test için `--dart-define=API_BASE=http://192.168.1.100:4000`
// yeterlidir. Yayın davranışı ZERRE değişmedi.

/// Telefon testinde bilgisayarın LAN adresi (kaynaktaki `DEV_LAN_IP`).
const String kDevLanIp = '192.168.1.100';

/// Kaynaktaki `DEV_PORT`.
const int kDevPort = 4000;

/// Android emülatörünün "bilgisayarın kendisi" adresi.
const String kAndroidEmulatorHost = '10.0.2.2';

/// Adres çözümlemesinde kullanılan hedef ortam.
enum ApiPlatform { web, android, ios, other }

/// Yayında yasak adres kalıpları: localhost, loopback ve özel ağ blokları.
/// Kaynaktaki `FORBIDDEN_IN_RELEASE` ile birebir aynı desen.
final RegExp _forbiddenInRelease = RegExp(
  r'^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)',
  caseSensitive: false,
);

final RegExp _https = RegExp(r'^https:\/\/', caseSensitive: false);
final RegExp _trailingSlashes = RegExp(r'\/+$');

/// Yapılandırma hatası — kaynakta `throw new Error(...)` ile aynı yerlerde
/// atılır ve aynı metni taşır.
class ApiBaseConfigError implements Exception {
  const ApiBaseConfigError(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Kaynaktaki `resolveApiBase({ envBase, isDev, platform })`.
String resolveApiBase({
  String envBase = '',
  bool isDev = false,
  ApiPlatform platform = ApiPlatform.web,
}) {
  final env = envBase.trim();

  // 1) Geliştirme: eski davranış korunur (yerel / emülatör / LAN / tünel).
  if (isDev) {
    if (env.isNotEmpty) return env;
    return 'http://${_devHostFor(platform)}:$kDevPort';
  }

  // 2) Yayın + adres verilmemiş.
  if (env.isEmpty) {
    // Web'de aynı origin geçerlidir: sayfa HTTPS ise istekler de HTTPS olur.
    if (platform == ApiPlatform.web) return '';
    throw const ApiBaseConfigError(
      'YAPILANDIRMA HATASI: Yayın derlemesi için API_BASE tanımlanmalıdır '
      '(https:// ile başlayan gerçek sunucu adresi). Yerel adrese düşülmez.',
    );
  }

  // 3) Yayın + adres verilmiş: yerel/şifresiz adreslere izin verilmez.
  if (_forbiddenInRelease.hasMatch(env)) {
    throw ApiBaseConfigError(
      'YAPILANDIRMA HATASI: Yayın derlemesinde yerel adres kullanılamaz ($env). '
      'https:// ile başlayan gerçek sunucu adresi gereklidir.',
    );
  }
  if (!_https.hasMatch(env)) {
    throw ApiBaseConfigError(
      'YAPILANDIRMA HATASI: Yayın derlemesinde API adresi HTTPS olmalıdır ($env). '
      'Kişisel veri şifresiz bağlantı üzerinden taşınmaz.',
    );
  }
  return env.replaceAll(_trailingSlashes, '');
}

/// Geliştirmede hangi konağın "bu bilgisayar" anlamına geldiği.
String _devHostFor(ApiPlatform platform) => switch (platform) {
  // Emülatör kendi içinde localhost'tur; bilgisayara 10.0.2.2 ile ulaşır.
  ApiPlatform.android => kAndroidEmulatorHost,
  // Tarayıcı ve iOS benzeticisi bilgisayarla aynı ağ yığınındadır.
  ApiPlatform.web || ApiPlatform.ios || ApiPlatform.other => 'localhost',
};
