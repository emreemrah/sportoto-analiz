// KAYNAK: app/src/session/tokenStore.js — çeviri.
//
// KALICI OTURUM DEPOSU — platforma göre EN GÜVENLİ yer seçilir:
//
//   • Android / iOS : flutter_secure_storage → Android Keystore (EncryptedShared
//                     Preferences) / iOS Keychain. Kaynakta expo-secure-store
//                     aynı iki mekanizmayı kullanıyordu.
//   • Web           : üretimde HttpOnly çerez (sunucu yönetir; JS okuyamaz),
//                     geliştirmede tarayıcı deposu (yalnız kendi makinen).
//
// ŞİFRE HİÇBİR ZAMAN CİHAZDA SAKLANMAZ — yalnız belirteçler saklanır.
//
// ANAHTAR ADLARI KAYNAKTAN AYNEN KORUNDU ('sportoto.token' vb.).
//
// ────────────────────────────────────────────────────────────────────────────
// BİLEREK ÇEVRİLMEYEN TEK PARÇA: `migrateLegacyToken()`
//
// Kaynakta AsyncStorage'daki eski düz-metin belirteci SecureStore'a taşıyan bir
// tek-seferlik göç vardı. Buraya taşınmadı, çünkü taşınması İMKÂNSIZ: Expo'nun
// SecureStore'u ile flutter_secure_storage aynı anahtar takma adlarını ve aynı
// depoyu kullanmaz. Flutter derlemesi cihaza kurulduğunda RN sürümünün
// belirtecini OKUYAMAZ.
//
// KULLANICIYA GÖRÜNEN SONUÇ: mevcut kullanıcılar Flutter sürümüne geçtiğinde
// BİR KEZ yeniden giriş yapar. Sessizce olmaması için burada yazılıdır.

import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../network/api_config.dart';

const String _keyToken = 'sportoto.token'; // AD DEĞİŞMEZ
const String _keyRefresh = 'sportoto.refresh';
const String _keySession = 'sportoto.session';
const String _keyDevice = 'sportoto.device';

// Varsayılan AndroidOptions BİLEREK kullanılıyor: flutter_secure_storage 11'de
// varsayılan zaten donanım destekli Keystore'dur (AES/GCM veri + RSA-OAEP
// anahtar sarma, API 23+). Eski sürümlerdeki `encryptedSharedPreferences: true`
// bayrağı kaldırıldı çünkü artık ondan daha güçlüsü varsayılan.
// Biyometri ZORUNLU KILINMADI: kaynakta belirteç okumak biyometri istemez;
// biyometrik kilit ayrı ve kullanıcı isteğine bağlı bir katmandır
// (app/src/security/biometricLock.js → Adım 4).
const _storage = FlutterSecureStorage();

Future<String?> _get(String k) async {
  try {
    return await _storage.read(key: k);
  } catch (_) {
    return null;
  }
}

Future<void> _set(String k, String? v) async {
  try {
    if (v != null && v.isNotEmpty) {
      await _storage.write(key: k, value: v);
    } else {
      await _storage.delete(key: k);
    }
  } catch (_) {
    /* okuma tarafı null görür */
  }
}

/// Web'de ÇEREZ MODU: sayfa ile API aynı origin'deyse (üretimde backend web
/// derlemesini kendisi sunar) belirteçler HttpOnly çerezle taşınır — tarayıcı
/// deposuna hiç yazılmaz. Geliştirmede (farklı port) Bearer kullanılır.
bool cookieModeAvailable() {
  if (!kIsWeb) return false;
  // boş taban = aynı origin (yayın web derlemesi)
  if (apiBase.isEmpty) return true;
  try {
    final api = Uri.parse(apiBase);
    final here = Uri.base;
    return api.scheme == here.scheme &&
        api.host == here.host &&
        api.port == here.port;
  } catch (_) {
    return false;
  }
}

class PersistedSession {
  const PersistedSession({this.token, this.refreshToken, this.sessionId});
  final String? token;
  final String? refreshToken;
  final String? sessionId;
}

/// Uygulama açılışında kalıcı oturumu yükler.
Future<PersistedSession> loadPersisted() async {
  final values = await Future.wait([
    _get(_keyToken),
    _get(_keyRefresh),
    _get(_keySession),
  ]);
  return PersistedSession(
    token: values[0],
    refreshToken: values[1],
    sessionId: values[2],
  );
}

/// Oturumu kalıcılaştırır. Çerez modunda belirteçler DEPOLANMAZ (çerezdedir).
Future<void> persistSession({
  String? token,
  String? refreshToken,
  String? sessionId,
  bool cookieMode = false,
}) async {
  if (cookieMode) {
    await Future.wait([
      _set(_keyToken, null),
      _set(_keyRefresh, null),
      _set(_keySession, sessionId),
    ]);
    return;
  }
  await Future.wait([
    _set(_keyToken, token),
    _set(_keyRefresh, refreshToken),
    _set(_keySession, sessionId),
  ]);
}

Future<void> clearPersisted() async {
  await Future.wait([
    _set(_keyToken, null),
    _set(_keyRefresh, null),
    _set(_keySession, null),
  ]);
}

/// Kalıcı, rastgele cihaz kimliği (kişisel veri DEĞİLDİR; cihaz listesi için).
Future<String> getOrCreateDeviceId() async {
  var id = await _get(_keyDevice);
  if (id == null || id.isEmpty) {
    id = _randomUuidV4();
    await _set(_keyDevice, id);
  }
  return id;
}

/// Kaynakta `crypto.randomUUID()` kullanılıyordu. Dart'ta karşılığı yok;
/// kriptografik rastgelelikten RFC 4122 v4 üretilir (zaman damgasına dayanan
/// zayıf yedek KULLANILMAZ — cihaz kimliği tahmin edilebilir olmamalı).
String _randomUuidV4() {
  final rnd = Random.secure();
  final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // sürüm 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // varyant 10x
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Cihaz listesinde görünecek ad — kişisel veri içermez.
String deviceLabel() {
  if (kIsWeb) {
    // Kaynakta userAgent'tan tarayıcı adı çıkarılıyordu. Dart'ta userAgent'a
    // ancak dart:html ile ulaşılır ve o mobil derlemeyi kırar; bu yüzden web
    // tarafı Adım 5'te (web derleme kontrolü) koşullu içe aktarma ile
    // tamamlanacak. Şimdilik ad kaynaktaki genel karşılığa düşer.
    return 'Web · Tarayıcı';
  }
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => 'Android',
    TargetPlatform.iOS => 'iPhone/iPad',
    TargetPlatform.macOS => 'macOS',
    TargetPlatform.windows => 'Windows',
    TargetPlatform.linux => 'Linux',
    TargetPlatform.fuchsia => 'Fuchsia',
  };
}

/// KAYNAK: `Platform.OS` — 'android' | 'ios' | 'web' gibi SABİT değerler.
///
/// Burada enum'un `.name` getter'ı KULLANILMAZ. Yayın derlemesi `--obfuscate`
/// ile karartıldığında tip/alan adlarına dayanan her şey güvenilmez olur;
/// sunucuya giden cihaz adı da öyle. Açık eşleme hem karartmadan etkilenmez
/// hem kaynaktaki değerlerle birebir aynıdır.
String platformName() {
  if (kIsWeb) return 'web';
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => 'android',
    TargetPlatform.iOS => 'ios',
    TargetPlatform.macOS => 'macos',
    TargetPlatform.windows => 'windows',
    TargetPlatform.linux => 'linux',
    TargetPlatform.fuchsia => 'fuchsia',
  };
}

/// Base64 yardımcıları — JWT çözümlemesi gereken yerlerde (oturum süresi
/// göstergesi) kullanılır. Doğrulama YAPMAZ: imza denetimi sunucudadır.
Map<String, dynamic>? decodeJwtPayload(String? jwt) {
  if (jwt == null) return null;
  final parts = jwt.split('.');
  if (parts.length != 3) return null;
  try {
    final normalized = base64Url.normalize(parts[1]);
    return jsonDecode(utf8.decode(base64Url.decode(normalized)))
        as Map<String, dynamic>;
  } catch (_) {
    return null;
  }
}
