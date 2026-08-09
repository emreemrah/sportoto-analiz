// KAYNAK: app/src/session/refreshClient.js — BİREBİR çeviri.
//
// OTURUM YENİLEME İSTEMCİSİ — erişim belirteci süresi dolunca kullanıcıdan
// tekrar giriş İSTENMEZ; yenileme anahtarıyla sessizce yeni belirteç alınır.
//
//   • Yenileme anahtarı TEK KULLANIMLIKTIR (rotasyon): her yenilemede yenisi
//     gelir ve kalıcı depoya yazılır.
//   • Sunucu oturumu uzaktan kapatılmışsa yenileme REDDEDİLİR → oturum burada
//     da temizlenir ve kullanıcı giriş ekranına düşer (güvenli davranış).
//   • Tek uçuş (single-flight): aynı anda birden çok 401 gelirse tek yenileme
//     yapılır; diğer istekler onu bekler.

import 'package:dio/dio.dart';

import '../network/api_config.dart';
import 'session_state.dart';
import 'token_store.dart';

Future<bool>? _inflight;

/// Yenileme isteği KENDİ Dio'sunu kullanır: ana istemcinin araya giren
/// 401 yakalayıcısına takılıp sonsuz döngü kurmasın diye.
final Dio _bareDio = Dio(
  BaseOptions(
    headers: const {'ngrok-skip-browser-warning': 'true'},
    // Durum kodunu kendimiz değerlendiririz; dio istisna atmasın.
    validateStatus: (_) => true,
    responseType: ResponseType.json,
  ),
);

Future<bool> tryRefresh() {
  final existing = _inflight;
  if (existing != null) return existing; // tek uçuş

  final future = _refresh();
  _inflight = future;
  return future.whenComplete(() => _inflight = null);
}

Future<bool> _refresh() async {
  final refreshToken = getRefreshToken();
  final cookieMode = isCookieMode();
  if (refreshToken == null && !cookieMode) return false;

  try {
    final body = <String, dynamic>{};
    // Kaynakta `undefined` olan alanlar JSON'a HİÇ yazılmaz; Dart'ta karşılığı
    // anahtarı eklememektir (null yazmak sunucuya farklı bir şey söylerdi).
    if (!cookieMode && refreshToken != null) {
      body['refreshToken'] = refreshToken;
    }
    final sid = getSessionId();
    if (sid != null) body['sessionId'] = sid;
    if (cookieMode) body['cookieMode'] = true;

    final res = await _bareDio.post<dynamic>(
      '$apiBase/api/auth/refresh',
      data: body,
      options: Options(contentType: Headers.jsonContentType),
    );

    final status = res.statusCode ?? 0;
    if (status < 200 || status >= 300) {
      // OTURUM YALNIZ KİMLİK REDDEDİLDİĞİNDE SİLİNİR.
      //
      // Sunucudan gelen GEÇİCİ bir hata — 500/502/503/504 (dağıtım, yeniden
      // başlatma) ya da 429 (hız sınırı) — kullanıcıyı oturumdan ATMAZ; oysa
      // belirteç hâlâ geçerlidir ve birkaç saniye sonra çalışacaktır.
      //
      // Sunucu, oturum gerçekten geçersizse 401 döner (süresi doldu ya da
      // kapatılmış); 400 de kalıcıdır (anahtar hiç gönderilmemiş). Diğer her
      // durum GEÇİCİ sayılır → yerel oturum KORUNUR.
      if (status == 400 || status == 401 || status == 403) {
        clearSession();
        await clearPersisted();
      }
      return false;
    }

    final data = res.data;
    if (data is! Map) return false;

    final token = data['token'] as String?;
    final newRefresh = data['refreshToken'] as String?;
    final newCookieMode = data['cookieMode'] == true;

    setSession(
      token: token,
      refreshToken: newRefresh,
      cookieMode: newCookieMode,
    );
    await persistSession(
      token: token,
      refreshToken: newRefresh,
      sessionId: getSessionId(),
      cookieMode: newCookieMode,
    );
    return true;
  } catch (_) {
    return false; // ağ hatası: mevcut belirteçle devam denenebilir
  }
}
