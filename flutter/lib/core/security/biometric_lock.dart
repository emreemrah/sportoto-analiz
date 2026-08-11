// KAYNAK: app/src/security/biometricLock.js — çeviri.
//
// BİYOMETRİK KİLİT — cihaz sarmalayıcısı (local_auth).
// Saf karar mantığı bio_lock_policy.dart'tadır; burada yalnız cihaz erişimi var.
//
//   • Doğrulamayı cihazın güvenli sistemi (Keystore/Secure Enclave) yapar;
//     uygulamaya biyometrik VERİ değil, yalnız SONUÇ döner.
//   • Tercih anahtarı: 'sportoto.bioLock' — mobilde güvenli depoda tutulur.
//   • Web'de özellik tümüyle kapalıdır (canOfferBiometrics=false).

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

import 'bio_lock_policy.dart';

const String _keyBioLock = 'sportoto.bioLock'; // AD DEĞİŞMEZ

bool get _isWeb => kIsWeb;

const FlutterSecureStorage _safe = FlutterSecureStorage();
final LocalAuthentication _localAuth = LocalAuthentication();

/// Kaynaktaki `Platform.OS` karşılığı — politika saf modülüne verilir.
String get _platform => _isWeb
    ? 'web'
    : switch (defaultTargetPlatform) {
        TargetPlatform.android => 'android',
        TargetPlatform.iOS => 'ios',
        _ => 'other',
      };

// ---------------------------------------------------------------------------
// Tercih (kullanıcı kilidi açtı mı?)
// ---------------------------------------------------------------------------
Future<bool> isBioLockEnabled() async {
  if (_isWeb) return false;
  try {
    return (await _safe.read(key: _keyBioLock)) == '1';
  } catch (_) {
    return false;
  }
}

Future<void> setBioLockEnabled(bool on) async {
  if (_isWeb) return;
  try {
    if (on) {
      await _safe.write(key: _keyBioLock, value: '1');
    } else {
      await _safe.delete(key: _keyBioLock);
    }
  } catch (_) {
    // tercih yazılamazsa kilit kapalı kalır
    // (güvenli varsayılan: erişim kaybettirmez)
  }
}

// ---------------------------------------------------------------------------
// Cihaz yeteneği
// ---------------------------------------------------------------------------
Future<bool> biometricsSupported() async {
  if (_isWeb) return false;
  try {
    // Kaynakta hasHardwareAsync() + isEnrolledAsync(). local_auth'ta
    // karşılıkları: isDeviceSupported() (donanım/OS desteği) ve
    // getAvailableBiometrics().isNotEmpty (kayıtlı biyometri).
    final hasHardware = await _localAuth.isDeviceSupported();
    final enrolled = (await _localAuth.getAvailableBiometrics()).isNotEmpty;
    return canOfferBiometrics(
      platform: _platform,
      hasHardware: hasHardware,
      enrolled: enrolled,
    );
  } catch (_) {
    return false;
  }
}

/// Açılışta kilit gerekli mi? (girişli + tercih açık — cihaz desteğine
/// BAKILMAZ; gerekçe bio_lock_policy.dart'taki güvenlik kararında.)
///
/// Web istisnadır: biyometri orada hiç sunulmaz ve mobilden kalan bir ayar
/// web açılışını kilitleyemez (platform politikası). `biometricsSupported()`
/// bu karara ÇAĞRILMAZ — çağıran eklenirse koruma yine sessizce delinir;
/// bunu bir kaynak-tarama testi bekliyor (biyometrik_kilit_test.dart).
Future<bool> needsLockOnLaunch(bool loggedIn) async {
  if (_isWeb || !loggedIn) return false;
  final enabled = await isBioLockEnabled();
  return shouldLockOnLaunch(loggedIn: loggedIn, enabled: enabled);
}

/// Cihazın biyometrik doğrulamasını başlatır.
///
/// Dönüş: `'unlocked'` | `'locked'` | `'locked:<kod>'`. Kod, local_auth'un
/// `LocalAuthExceptionCode.name` değeridir (örn. `locked:temporaryLockout`);
/// kilit ekranı bundan kullanıcıya anlaşılır bir açıklama üretir. Enum'a yeni
/// değer eklenmesi kırıcı sayılmadığı için bilinmeyen kod düz `'locked'`a
/// düşer (paketin kendi uyarısı: "clients should always include a default").
///
/// `biometricOnly: false` — kaynaktaki `disableDeviceFallback: false` ile
/// aynı: cihaz ekran kilidi (PIN/desen) güvenli alternatif olarak kalır;
/// kayıtlı biyometri silinmiş olsa bile doğrulama bu yoldan çalışır.
///
/// ZAMAN AŞIMI BİLEREK YOK (60 sn'lik sınır 2026-08-09'da kaldırıldı):
///   • `persistAcrossBackgrounding: true` doğrulamanın arka plana atılıp
///     öne dönüşte OTOMATİK yeniden denenmesi demektir (local_auth 3.0.2,
///     `authenticate` belgesi) — meşru bir doğrulama dakikalarca sürebilir;
///     uygulama katmanındaki bir sayaç bu akışı yarıda keserdi.
///   • Platformun KENDİ zaman aşımı zaten var: cihaz sınırına takılan istem
///     `LocalAuthExceptionCode.timeout` ile döner ve aşağıdaki catch'e düşer.
///   • `.timeout()` işletim sisteminin istemini KAPATAMAZ; bizim taraf pes
///     ederken ekranda istem açık kalır ve geç sonuç çöpe giderdi — görünür
///     bir tutarsızlık. Takılı istemde kullanıcının hapsolmaması ekran
///     katmanında çözülür: "Şifreyle giriş" düğmesi doğrulama sürerken de
///     açıktır (biometric_lock_screen.dart).
Future<String> authenticate() async {
  try {
    // local_auth 3.x'te seçenekler doğrudan adlandırılmış parametre;
    // `AuthenticationOptions` sarmalayıcısı 2.x kalıntısıdır ve dışa
    // aktarılmaz.
    final ok = await _localAuth.authenticate(
      localizedReason: 'Uygulama kilidini aç',
      biometricOnly: false,
      persistAcrossBackgrounding: true,
    );
    return outcomeFromResult(ok);
  } on LocalAuthException catch (e) {
    // Hata kilidi AÇMAZ (güvenli taraf); kod, ekran metni için taşınır.
    return 'locked:${e.code.name}';
  } catch (_) {
    return 'locked';
  }
}

/// Süren doğrulamayı EN İYİ ÇABA ile durdurur.
///
/// local_auth 3.0.2 `stopAuthentication` belgesi: "may not be supported by
/// all platforms" ve hata/desteksizlikte false döner — bu yüzden sonuç
/// beklenmez, hata yutulur. Kilit ekranı bunu yalnız kullanıcı "Şifreyle
/// giriş"e geçerken çağırır ki Android'de açık kalan istem kapansın; kilidin
/// güvenliği buna DAYANMAZ (geç sonuçlar deneme-nesli koruması ve `mounted`
/// denetimiyle zaten yok sayılır).
Future<void> dogrulamayiDurdur() async {
  try {
    await _localAuth.stopAuthentication();
  } catch (_) {
    // desteklenmeyen platform / süren doğrulama yok — önemsiz
  }
}
