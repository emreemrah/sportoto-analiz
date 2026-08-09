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
// KUPON İZOLASYONU ve BİLDİRİM İPTALİ kancalarla çözülür
// (`couponIzolasyonKancasi`, `bildirimIptalKancasi`): kaynakta bu iş
// coupon/store.js ve pushService'e doğrudan bağlıydı; burada bu katman
// onlara bağımlı olmasın diye kanca kullanılır. ÜÇÜ DE `main.dart` içinde
// bağlanır — bağlanmazsa `?.call()` sessizce atlanır ve "çıkış yapan
// kullanıcının kuponu/bildirimi cihazda kalır" hatası geri döner. Kaynakta
// bu bir kez yaşanmış ve yorumda not düşülmüş.

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

/// "OTURUM VAR ama arayüz katmanında taşınacak bir belirteç YOK" işareti.
///
/// `authState.token` iki soruyu birden cevaplar: (a) kullanıcı girişli mi,
/// (b) elimizde gövdede taşınabilecek bir erişim belirteci var mı. (b) hayır
/// olduğu hâlde (a) EVET olabilir:
///   • çerez modunda (web üretimi) belirteç HttpOnly çerezdedir, JS/Dart
///     tarafı onu hiç görmez;
///   • mobilde erişim belirtecinin süresi dolup diskte yalnız yenileme
///     anahtarı kalmış olabilir — ilk istekte sessizce yenilenir.
/// Bu iki durumda `token` alanına bu SABİT yazılır ve `girisli` doğru olur.
///
/// DEĞERİ HİÇBİR YERE GÖNDERİLMEZ — kanıt: istek başlıkları
/// `session_state.authHeaders()` içinde `_state.token`dan kurulur (bu alandan
/// DEĞİL), kupon katmanı `isAuthenticated()` kullanır, JWT çözümlemesi
/// yapılmaz. Yani bu bir "girişli" bayrağıdır, belirteç değildir; bir
/// kaynak-tarama testi (auth_oturum_yarisi_test.dart) bunu bekçiler.
///
/// Değer kaynaktan (`auth.js`) geldiği gibi bırakıldı; yalnız ADI verildi ki
/// çerez modu dışında da kullanıldığı görülünce "burada çerez mi var?" diye
/// yanlış okunmasın.
const String kOturumIsareti = 'cookie';

// OTURUM NESLİ — kimlik her DEĞİŞTİĞİNDE artar (yerel oturum kuruldu, giriş,
// çıkış, uzaktan iptal, kesin ret). Arka planda süren işler başlarken bunu
// kaydeder; sonuç geldiğinde nesil değişmişse sonuç ESKİ oturuma aittir ve
// UYGULANMAZ.
//
// SAYAÇ BURADA TUTULMAZ: tek kaynak `session/session_state.dart` içindedir
// (`oturumNesli` / `oturumNesliniArtir`). `api_client` ve `refresh_client` de
// aynı sayacı okur; sayaç bu dosyada kalsaydı onlar buraya bağımlı olur ve
// auth → api_client → refresh_client → auth DÖNGÜSÜ doğardı.
//
// `clearSession()` nesli KENDİ artırır (temizlik her zaman kimlik
// değişimidir); bu yüzden bu dosyada yalnız oturum KURAN iki yol
// (`initAuthYerel`, `_adoptSession`) açıkça artırır.

/// Çıkışta çağrılır: cihazda kalan YEREL kuponları siler.
/// Adım 3'te coupon/store bağlanacak.
Future<void> Function()? couponIzolasyonKancasi;

/// Çıkışta çağrılır: kullanıcının kuponuna kurulmuş telefon hatırlatmalarını
/// iptal eder. Adım 4'te pushService bağlanacak.
Future<void> Function()? bildirimIptalKancasi;

/// Girişte çağrılır: kupon sahibini ayarlar + sunucudan senkronlar.
Future<void> Function(Object? userId)? couponSahipKancasi;

/// AÇILIŞ, İKİ AŞAMA (kaynaktaki tek `initAuth`ın bölünmüş hâli — 2026-08-09)
///
/// Kaynak `auth.js` tek işlevde önce diski okuyor, sonra `api.me()` ile ağı
/// bekliyordu; splash o beklemeyi gizliyordu. Flutter'da ilk kare bu ağ
/// isteğine bağlanınca iki gerçek hata doğdu:
///   • ağ yavaşken açılış kilitleniyor ya da (zaman aşımıyla kesilirse)
///     kullanıcı OTURUMSUZ görünümle karşılanıyordu — `authState.token`
///     yalnız `me()` başarısında doluyordu;
///   • zaman aşımı alttaki Future'ı İPTAL ETMEZ: geç gelen `catch` bloğu
///     `clearPersisted()` ile oturumu uygulama açıkken KALICI silebiliyordu.
///
/// Bu yüzden: [initAuthYerel] yalnız disk okur ve İLK KAREDEN doğru oturum
/// durumunu kurar (açılış bunu zaman aşımı OLMADAN bekler; token_store her
/// okuma hatasını null'a çevirir, asılacak ağ çağrısı yoktur). [initAuthUzak]
/// profil tazeleme ve sessiz yenilemeyi arka planda yapar; açılışı bekletmez.

/// 1) YEREL: kalıcı oturumu diskten belleğe ve `authState`e yükler. AĞ YOK.
Future<void> initAuthYerel() async {
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

  // Diskte oturum izi VAR → son bilinen durum "girişli"dir; ilk kare böyle
  // kurulur (giriş ekranı parlamaz, biyometrik kilit kararı doğru verilir).
  // Kullanıcı profili uzaktan gelene dek boş kalabilir; ekranlar `authState`i
  // dinlediği için profil gelince kendiliğinden tazelenirler.
  //
  // Belirteç diskte yoksa (çerez modu ya da süresi dolmuş erişim belirteci)
  // arayüz katmanına [kOturumIsareti] yazılır — ağa giden değer bu DEĞİL,
  // yukarıdaki `setSession(token: persisted.token)` ile kurulan gerçek
  // (gerekirse null) belirteçtir.
  oturumNesliniArtir(); // kimlik kuruldu: bundan öncesine ait geç sonuçlar eskidi
  _set(token: persisted.token ?? kOturumIsareti, ready: true);
}

/// 2) UZAK: profili tazeler; belirteç süresi dolmuşsa SESSİZCE yenilenir —
/// kullanıcıdan tekrar giriş İSTENMEZ. Açılışı BEKLETMEZ.
///
/// ESKİ OTURUM KORUMASI (2026-08-09): bu iş `unawaited` çalıştığı için cevabı
/// döndüğünde kullanıcı çoktan çıkmış ya da BAŞKA bir hesapla girmiş olabilir.
/// O yüzden başlarken [oturumNesli] kaydedilir ve durumu değiştiren HER adımın
/// önünde yeniden bakılır. Korunmasaydı üç somut zarar mümkündü:
///   • eski istekten dönen 401, YENİ kullanıcının oturumunu ve diskteki
///     kaydını silerdi (kullanıcı bir anda giriş ekranına düşerdi);
///   • eski başarılı cevap, yeni kullanıcının profilini eskisininkiyle
///     değiştirirdi;
///   • `couponSahipKancasi` eski kullanıcının kimliğiyle çağrılır, kupon
///     deposu sahibi yanlış yazılır ve yeni kullanıcının YEREL kuponları
///     silinirdi (coupon_store.sahibiAyarla: sahip farklıysa yereli temizler).
///
/// [profilGetir] yalnız TESTLER içindir (kontrollü `Completer`); üretimde her
/// zaman `api.me` kullanılır.
Future<void> initAuthUzak({Future<dynamic> Function()? profilGetir}) async {
  // Yerel aşama oturum izi bulamadıysa uzakta yapılacak bir şey yok.
  if (getToken() == null) return;

  // Bu isteğin AİT OLDUĞU oturum.
  final benimNesil = oturumNesli;

  try {
    // 401 olursa api_client sessizce yenileyip isteği BİR KEZ tekrarlar.
    final me = await (profilGetir ?? api.me)();
    if (benimNesil != oturumNesli) return; // cevap eski oturuma ait
    _set(user: me is Map ? Map<String, dynamic>.from(me) : null);
    await couponSahipKancasi?.call(_userId(me));
  } on ApiException catch (e) {
    // KESİN RET ile GEÇİCİ HATA AYRILIR — bu ayrım, işlem arka plana
    // taşınırken ZORUNLU hale geldi: eskiden bu catch splash arkasında
    // çalışıyordu; artık kullanıcı uygulamanın İÇİNDEYKEN çalışıyor.
    //
    //   • 401: sessiz yenileme de reddedildi → oturum sunucuda gerçekten
    //     geçersiz. Eski davranış korunur: yerel oturum temizlenir.
    //   • Diğer her şey (5xx, zaman aşımı, bağlantı yok): oturuma
    //     DOKUNULMAZ. Geçici bir ağ sorunu yüzünden `clearPersisted()`
    //     çalıştırmak, kullanıcıyı kalıcı olarak oturumdan atmak olurdu;
    //     sonraki istek kendi hatasını zaten gösterir.
    //
    // Ret yalnız BU isteğin oturumunu bağlar: araya giren çıkış/yeni giriş
    // varsa 401 artık başkasının kararıdır ve yeni oturuma uygulanamaz.
    if (benimNesil != oturumNesli) return;
    // `gecici` 401 = "soruyu soramadık" (yenileme ağ/sunucu hatasına takıldı).
    // Sunucu oturumu reddetmiş DEĞİL; yenileme anahtarı büyük olasılıkla hâlâ
    // geçerli. Kopuk bağlantı yüzünden hesabı düşürmek, kullanıcının bir daha
    // şifresiz giremeyeceği anlamına gelirdi (api_client.ApiException.gecici).
    if (e.status == 401 && !e.gecici) {
      clearSession(); // nesli kendi artırır
      await clearPersisted();
      _set(token: null, user: null);
    }
  } catch (_) {
    // Beklenmedik yerel hata (ayrıştırma vb.) — bilinen oturum durumu
    // DEĞİŞTİRİLMEZ.
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
  // Kimlik BU ANDA değişti (istek katmanı artık yeni kullanıcıyı taşıyor).
  // Nesil, aşağıdaki `await`ten ÖNCE artar ki arka planda bekleyen eski bir
  // cevap dönerse aradaki farkı hemen görsün.
  oturumNesliniArtir();
  await persistSession(
    token: token,
    refreshToken: refreshToken,
    sessionId: sessionId,
    cookieMode: cookieMode,
  );

  final user = resp['user'];
  _set(
    token: token ?? (cookieMode ? kOturumIsareti : null),
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
  // `clearSession()` oturum neslini artırır: arka planda süren eski istekler
  // (ve süren bir yenileme) bu andan sonra hiçbir şeyi değiştiremez.
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
  // `clearSession()` oturum neslini artırır: arka planda süren eski istekler
  // (ve süren bir yenileme) bu andan sonra hiçbir şeyi değiştiremez.
  clearSession();
  await clearPersisted();
  try {
    await couponIzolasyonKancasi?.call();
  } catch (_) {}
  _set(token: null, user: null);
}
