// KAYNAK: app/src/auth.js — BİREBİR çeviri.
//
// OTURUM YÖNETİMİ — kullanıcı bir kez giriş yapar, uygulama her açılışta
// oturumu SESSİZCE geri yükler ("beni hatırla" güvenli biçimde).
//
//   • Belirteçler mobilde Keychain/Keystore'da (token_store), webde üretimde
//     HttpOnly çerezde tutulur.
//   • ŞİFRE CİHAZDA ASLA SAKLANMAZ.
//   • Belirteç süresi dolarsa refresh_client sessizce yeniler; oturum sunucudan
//     kapatıldıysa yenileme reddedilir ve kullanıcı güvenle çıkışa düşer.
//
// KUPON İZOLASYONU ve BİLDİRİM İPTALİ kancaları bilerek AÇIK bırakıldı
// (`couponIzolasyonKancasi`, `bildirimIptalKancasi`): kaynakta bu iş
// coupon/store.js ve pushService'e bağlıydı; o modüller Adım 3/4'te gelecek.
// Kanca olmadan çağrı yeri unutulur ve "çıkış yapan kullanıcının kuponu
// cihazda kalır" hatası SESSİZCE geri gelirdi — kaynakta bu bir kez yaşanmış
// ve yorumda not düşülmüş.

import 'package:flutter/foundation.dart';

import 'network/api_client.dart';
import 'session/session_state.dart';
import 'session/token_store.dart';

// Kaynakta `export { tryRefresh }` vardı (auth.js). Dart'ta yeniden dışa
// aktarma dosyanın BAŞINDA olmak zorunda; ayrıca gereksiz — çağıranlar
// doğrudan `core/session/refresh_client.dart` içe aktarabilir. Tek erişim
// noktası korunsun istenirse buraya `export` satırı eklenebilir.

class AuthState {
  const AuthState({this.token, this.user, this.ready = false});

  final String? token;
  final Map<String, dynamic>? user;
  final bool ready;

  bool get girisli => token != null;
}

/// Kaynakta modül düzeyinde `state` + `listeners` vardı; Flutter karşılığı
/// dinlenebilir tek bir değer.
final ValueNotifier<AuthState> authState = ValueNotifier<AuthState>(
  const AuthState(),
);

void _set({Object? token = _unset, Object? user = _unset, bool? ready}) {
  final s = authState.value;
  authState.value = AuthState(
    token: identical(token, _unset) ? s.token : token as String?,
    user: identical(user, _unset) ? s.user : user as Map<String, dynamic>?,
    ready: ready ?? s.ready,
  );
}

const Object _unset = Object();

String? getToken() => authState.value.token;

/// Çıkışta çağrılır: cihazda kalan YEREL kuponları siler.
/// Adım 3'te coupon/store bağlanacak.
Future<void> Function()? couponIzolasyonKancasi;

/// Çıkışta çağrılır: kullanıcının kuponuna kurulmuş telefon hatırlatmalarını
/// iptal eder. Adım 4'te pushService bağlanacak.
Future<void> Function()? bildirimIptalKancasi;

/// Girişte çağrılır: kupon sahibini ayarlar + sunucudan senkronlar.
Future<void> Function(Object? userId)? couponSahipKancasi;

/// Uygulama açılışında: kalıcı oturum yüklenir, profil tazelenir; belirteç
/// süresi dolmuşsa SESSİZCE yenilenir — kullanıcıdan tekrar giriş İSTENMEZ.
Future<void> initAuth() async {
  final persisted = await loadPersisted();
  final cookieMode =
      cookieModeAvailable() &&
      persisted.token == null &&
      persisted.sessionId != null;

  setSession(
    token: persisted.token,
    refreshToken: persisted.refreshToken,
    sessionId: persisted.sessionId,
    cookieMode: cookieMode,
  );

  if (persisted.token == null &&
      persisted.refreshToken == null &&
      !cookieMode) {
    _set(ready: true);
    return;
  }

  try {
    // 401 olursa api_client sessizce yenileyip tekrar dener.
    final me = await api.me();
    _set(
      token: persisted.token ?? 'cookie',
      user: me is Map ? Map<String, dynamic>.from(me) : null,
      ready: true,
    );
    await couponSahipKancasi?.call(_userId(me));
  } catch (_) {
    clearSession();
    await clearPersisted();
    _set(token: null, user: null, ready: true);
  }
}

/// Giriş/kayıt gövdesine cihaz bilgisi ekler (bağlı cihazlar listesi için).
Future<Map<String, dynamic>> _deviceInfo() async => {
  'deviceId': await getOrCreateDeviceId(),
  'deviceName': deviceLabel(),
  'platform': platformName(),
  if (cookieModeAvailable()) 'cookieMode': true,
};

Future<void> _adoptSession(Map resp) async {
  final token = resp['token'] as String?;
  final refreshToken = resp['refreshToken'] as String?;
  final sessionId = resp['sessionId'] as String?;
  final cookieMode = resp['cookieMode'] == true;

  setSession(
    token: token,
    refreshToken: refreshToken,
    sessionId: sessionId,
    cookieMode: cookieMode,
  );
  await persistSession(
    token: token,
    refreshToken: refreshToken,
    sessionId: sessionId,
    cookieMode: cookieMode,
  );

  final user = resp['user'];
  _set(
    token: token ?? (cookieMode ? 'cookie' : null),
    user: user is Map ? Map<String, dynamic>.from(user) : null,
  );

  // KULLANICI İZOLASYONU — senkrondan ÖNCE. Cihazda başka bir kullanıcının
  // yerel kuponu kaldıysa (çıkış çalışmamış, uygulama öldürülmüş, eski sürüm)
  // burada silinir. SIRA KRİTİK: sunucu senkronu yereli sunucuya yazıyor;
  // önce temizlemezsek başkasının kuponu bu hesaba geçerdi.
  await couponSahipKancasi?.call(_userId(user));
}

Object? _userId(Object? user) {
  if (user is! Map) return null;
  return user['id'] ?? user['userId'];
}

/// Kayıt. E-posta doğrulaması AÇIKSA oturum dönmez;
/// `{ needsVerification: true, message }` döner ve ekran bilgi gösterir.
Future<Map<String, dynamic>> register(
  String email,
  String username,
  String password,
) async {
  final resp = await api.register({
    'email': email,
    'username': username,
    'password': password,
    ...await _deviceInfo(),
  });
  final map = Map<String, dynamic>.from(resp as Map);
  if (map['needsVerification'] == true) return map;
  await _adoptSession(map);
  return Map<String, dynamic>.from(map['user'] as Map? ?? const {});
}

Future<Map<String, dynamic>> login(String email, String password) async {
  final resp = await api.login({
    'email': email,
    'password': password,
    ...await _deviceInfo(),
  });
  final map = Map<String, dynamic>.from(resp as Map);
  await _adoptSession(map);
  return Map<String, dynamic>.from(map['user'] as Map? ?? const {});
}

Future<void> logout() async {
  // Önce SUNUCUDAKİ oturum kaydı kapatılır (uzaktan geçerliliği biter);
  // sunucuya ulaşılamasa bile yerel oturum mutlaka temizlenir.
  try {
    if (getSessionId() != null) await api.serverLogout();
  } catch (_) {
    /* yerel temizlik yeterli */
  }
  // Çıkış yapan kullanıcının kuponuna kurulmuş telefon hatırlatmaları
  // kalmamalı; aksi hâlde cihazı devralan kişiye onun maçları hatırlatılırdı.
  try {
    await bildirimIptalKancasi?.call();
  } catch (_) {
    /* çıkışı engellemesin */
  }
  clearSession();
  await clearPersisted();
  // Yerel kuponlar CİHAZDA kalıyordu; sonraki kullanıcı onları görüyordu.
  try {
    await couponIzolasyonKancasi?.call();
  } catch (_) {}
  _set(token: null, user: null);
}

Future<dynamic> forgotPassword(String email) =>
    api.forgotPassword({'email': email});

Future<dynamic> resendVerification(String email) =>
    api.resendVerification({'email': email});

/// Profil güncellemelerinden sonra kullanıcıyı tazele.
void setUser(Map<String, dynamic>? user) => _set(user: user);

Future<Map<String, dynamic>?> refreshUser() async {
  try {
    final me = await api.me();
    final map = me is Map ? Map<String, dynamic>.from(me) : null;
    _set(user: map);
    return map;
  } catch (_) {
    return null;
  }
}

/// Sunucu "bu oturum kapatılmış" derse (uzaktan çıkış) yereli de temizle.
Future<void> handleSessionRevoked() async {
  try {
    await bildirimIptalKancasi?.call();
  } catch (_) {
    /* temizliği engellemesin */
  }
  clearSession();
  await clearPersisted();
  try {
    await couponIzolasyonKancasi?.call();
  } catch (_) {}
  _set(token: null, user: null);
}
