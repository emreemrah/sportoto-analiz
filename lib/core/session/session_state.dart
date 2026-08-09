// KAYNAK: app/src/session/tokenState.js — BİREBİR çeviri.
//
// OTURUM DURUMU (bellek içi) — SAF MODÜL, Flutter bağımlılığı YOKTUR.
// API istemcisi her istekte buradan okur; kalıcı depolama token_store.dart'tadır.
//
// GÜVENLİK: Şifre burada da, başka hiçbir yerde de TUTULMAZ. Yalnız kısa ömürlü
// erişim belirteci + rotasyonlu yenileme anahtarı + oturum kimliği tutulur.

class _SessionState {
  String? token; // erişim belirteci (kısa ömürlü JWT)
  String? refreshToken; // tek kullanımlık (rotasyonlu) yenileme anahtarı
  String? sessionId; // sunucudaki oturum kaydının kimliği
  bool cookieMode =
      false; // web üretimi: belirteçler HttpOnly çerezde, bellekte YOK
}

final _state = _SessionState();

String? getAccessToken() => _state.token;
String? getRefreshToken() => _state.refreshToken;
String? getSessionId() => _state.sessionId;
bool isCookieMode() => _state.cookieMode;

/// "Kullanıcı girişli mi?" sorusunun PLATFORMSUZ tek cevabı.
///
/// • Çerez modunda (web üretimi) belirteç bellekte TUTULMAZ — oturum kimliği
///   varlığı girişin kanıtıdır.
/// • Diğer platformlarda erişim belirtecinin varlığı esastır.
bool isAuthenticated() =>
    _state.cookieMode ? _state.sessionId != null : _state.token != null;

/// Kaynakta `undefined` geçilen alan DOKUNULMADAN bırakılır. Dart'ta `null`
/// hem "temizle" hem "dokunma" anlamına gelebileceği için ayrım sentinel ile
/// yapılır: alan hiç verilmezse değişmez, açıkça `null` verilirse silinir.
const Object _unset = Object();

void setSession({
  Object? token = _unset,
  Object? refreshToken = _unset,
  Object? sessionId = _unset,
  Object? cookieMode = _unset,
}) {
  if (!identical(token, _unset)) _state.token = token as String?;
  if (!identical(refreshToken, _unset)) {
    _state.refreshToken = refreshToken as String?;
  }
  if (!identical(sessionId, _unset)) _state.sessionId = sessionId as String?;
  if (!identical(cookieMode, _unset)) _state.cookieMode = cookieMode == true;
}

/// Kaynakta olduğu gibi `cookieMode` KORUNUR — o bir platform gerçeğidir,
/// oturuma ait değildir.
void clearSession() {
  _state.token = null;
  _state.refreshToken = null;
  _state.sessionId = null;
}

/// İstek başlıkları: Bearer (çerez modunda değilse) + oturum kimliği.
Map<String, String> authHeaders() {
  final h = <String, String>{};
  if (!_state.cookieMode && _state.token != null) {
    h['Authorization'] = 'Bearer ${_state.token}';
  }
  if (_state.sessionId != null) h['X-Session-Id'] = _state.sessionId!;
  return h;
}
