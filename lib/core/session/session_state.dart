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

// ---------------------------------------------------------------------------
// OTURUM NESLİ — "bu istek hangi oturuma ait?" sorusunun TEK cevabı
// ---------------------------------------------------------------------------
//
// NEDEN BURADA: `auth.dart`, `api_client.dart` ve `refresh_client.dart`'ın
// ÜÇÜ DE bu dosyayı zaten içe aktarıyor; sayaç üst katmanda kalsaydı alt
// katmanlar ona ancak `auth.dart`ı içe aktararak ulaşabilirdi ve
// auth → api_client → refresh_client → auth DÖNGÜSÜ oluşurdu. Burası, döngü
// kurmadan üçünün de görebildiği tek nokta. Sayaç TEKTİR: ikinci bir nesil
// sayacı açılmamalı, üst katman da kendi kopyasını tutmamalı.
//
// NEDEN BELİRTEÇ KARŞILAŞTIRMASI DEĞİL: erişim belirteci istek sürerken
// MEŞRU biçimde yenilenebiliyor (401 → tryRefresh → rotasyon). Belirteç
// eşitliği arasaydık her meşru rotasyon "oturum değişti" sanılır, geçerli
// cevaplar atılırdı. Nesil YALNIZ KİMLİK değiştiğinde artar.
int _nesil = 0;

/// Şu anki oturumun sürüm numarası. Uzun süren bir iş başlarken kaydedilir;
/// sonuç geldiğinde değer değişmişse sonuç ESKİ oturuma aittir.
int get oturumNesli => _nesil;

/// Kimlik DEĞİŞTİ (yerel oturum kuruldu, giriş yapıldı). Belirteç rotasyonu
/// için ÇAĞRILMAZ — `clearSession()` bunu kendisi yapar.
void oturumNesliniArtir() => _nesil++;

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
///
/// NESLİ ARTIRIR: oturumu temizlemek her zaman bir KİMLİK değişimidir (asla
/// rotasyon değildir). Artış burada olduğu için `refresh_client`in kesin ret
/// dalı da `auth.dart`ı hiç görmeden doğru nesli üretir.
void clearSession() {
  _state.token = null;
  _state.refreshToken = null;
  _state.sessionId = null;
  _nesil++;
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
