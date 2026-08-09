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

/// Açılışta kilit gerekli mi? (girişli + tercih açık + cihaz destekli)
Future<bool> needsLockOnLaunch(bool loggedIn) async {
  if (_isWeb || !loggedIn) return false;
  final enabled = await isBioLockEnabled();
  final supported = await biometricsSupported();
  return shouldLockOnLaunch(
    loggedIn: loggedIn,
    enabled: enabled,
    supported: supported,
  );
}

/// Cihazın biyometrik doğrulamasını başlatır → 'unlocked' | 'locked'.
///
/// `biometricOnly: false` — kaynaktaki `disableDeviceFallback: false` ile
/// aynı: cihaz PIN'i de güvenli alternatif olarak kalır.
Future<String> authenticate() async {
  try {
    // local_auth 3.x'te seçenekler doğrudan adlandırılmış parametre;
    // `AuthenticationOptions` sarmalayıcısı 2.x kalıntısıdır ve dışa
    // aktarılmaz.
    final ok = await _localAuth.authenticate(
      localizedReason: 'Uygulama kilidini aç',
      biometricOnly: false,
      // Kaynaktaki davranış: uygulama arka plana atılıp geri gelirse
      // doğrulama YENİDEN denenir, hata verip kilitli kalmaz.
      persistAcrossBackgrounding: true,
    );
    return outcomeFromResult(ok);
  } catch (_) {
    return 'locked'; // cihaz hatasında kilit AÇILMAZ (güvenli taraf)
  }
}
