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
//     yapılır; diğer istekler onu bekler. Paylaşım YALNIZ AYNI OTURUM içinde
//     olur (aşağıdaki nesil notu).
//
// ESKİ OTURUM KORUMASI (2026-08-09) — `oturumNesli`:
// Yenileme ağda beklerken kullanıcı çıkabilir ya da BAŞKA bir hesapla
// girebilir. Korunmasaydı eski isteğin tetiklediği yenileme yeni kullanıcıya
// zarar verirdi:
//   • kesin ret (400/401) YENİ kullanıcının oturumunu ve diskteki kaydını
//     silerdi;
//   • başarı, yeni kullanıcının belirteçlerini ESKİ oturumdan gelen değerlerle
//     değiştirirdi;
//   • tek uçuş paylaşımı yüzünden B'nin yenilemesi A'nın sonucunu alırdı.
// Bu yüzden nesil hem uçuş anahtarına girer hem de ağ beklemesinden SONRA
// yeniden denetlenir. Nesil kimlik değişiminde artar, belirteç rotasyonunda
// ARTMAZ — aynı oturumun meşru yenilemesi normal işler.

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;

import '../network/api_config.dart';
import 'session_state.dart';
import 'token_store.dart';

/// Yenilemenin SONUCU.
///
/// Eskiden düz `bool` dönüyordu ve `false` ÜÇ ayrı durumu birbirine
/// karıştırıyordu: "sunucu oturumu reddetti", "ağ/sunucu sorunu çıktı",
/// "araya başka bir oturum girdi". Çağıran (api_client → initAuthUzak) hepsini
/// KESİN RET sayıp kullanıcıyı kalıcı olarak çıkışa düşürüyordu: geçerli bir
/// yenileme anahtarı dururken tek bir kopuk bağlantı hesabı düşürmeye yetiyordu
/// (2026-08-09'da kapatıldı).
enum YenilemeSonucu {
  /// Yeni belirteç alındı, belleğe ve diske yazıldı.
  yenilendi,

  /// Sunucu KESİN reddetti (400/401) ya da yenilenecek anahtar hiç yok.
  ///
  /// Temizlik sözleşmesi: yerel oturumu YALNIZ bu dosyadaki kesin-ret cevap
  /// dalı (400/401) temizler. "Anahtar hiç yok" dalı temizlik YAPMAZ — yalnız
  /// sonucu bildirir; oturumu düşürmek çağıran katmanın kararıdır
  /// (`initAuthUzak`, 401 + `!gecici` koşuluyla düşürür).
  ///
  /// 403 BİLEREK LİSTEDE YOK (2026-08-09, kaynak refreshClient.js'ten sapma):
  /// bu backend'in `/api/auth/refresh` ucu hiçbir dalda 403 üretmiyor
  /// (backend/src/routes/auth.js:185-218 — 400 anahtar eksik, 401 Supabase
  /// reddi/iptal edilmiş oturum; hepsi bu). Backend'in başka yerlerindeki
  /// 403'ler "hesap askıda / moderasyon yetkisi yok / yönetim anahtarı
  /// yanlış" demek — hepsinde yenileme anahtarı HÂLÂ GEÇERLİ. Araya giren
  /// bir proxy/WAF 403'ü de oturum silmeyi haklı çıkarmaz. Bu yüzden 403,
  /// oturuma dokunmayan `gecici` sınıfındadır.
  kesinRet,

  /// Ağ hatası, 5xx/429 gibi geçici sunucu hatası ya da araya giren oturum
  /// değişimi. OTURUMUN GEÇERLİLİĞİ HAKKINDA HİÇBİR ŞEY BİLİNMİYOR — bu sonuç
  /// kullanıcıyı çıkışa düşürmek için KULLANILAMAZ.
  gecici,
}

Future<YenilemeSonucu>? _inflight;

/// Süren yenilemenin ait olduğu oturum nesli. Tek uçuş paylaşımı buna bakar.
int? _inflightNesil;

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

/// Yenileme istemcisinin taşıyıcısı — testler `httpClientAdapter`ı buradan
/// değiştirip GERÇEK yenileme kodunu ağa çıkmadan çalıştırır. Üretimde
/// dokunulmaz.
@visibleForTesting
Dio get yenilemeIstemcisi => _bareDio;

Future<YenilemeSonucu> tryRefresh() {
  final nesil = oturumNesli;

  // TEK UÇUŞ, ama YALNIZ AYNI OTURUM İÇİNDE: A'nın süren yenilemesi B'ye
  // devredilemez, yoksa B, A'nın sonucunu (ve reddini) miras alırdı.
  final existing = _inflight;
  if (existing != null && _inflightNesil == nesil) return existing;

  final future = _refresh(nesil);
  _inflight = future;
  _inflightNesil = nesil;
  return future.whenComplete(() {
    // Yalnız KENDİ kaydını temizler: geç biten eski uçuş, yerine geçmiş yeni
    // uçuşun kaydını silmemeli.
    if (identical(_inflight, future)) {
      _inflight = null;
      _inflightNesil = null;
    }
  });
}

Future<YenilemeSonucu> _refresh(int nesil) async {
  final refreshToken = getRefreshToken();
  final cookieMode = isCookieMode();
  // Yenilenecek anahtar yok → yapılabilecek bir şey de yok; 401 kesindir.
  if (refreshToken == null && !cookieMode) return YenilemeSonucu.kesinRet;

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

    // ─── OTURUM HÂLÂ AYNI MI? ──────────────────────────────────────────────
    // Ağ beklerken çıkış/yeni giriş olduysa bu cevap ESKİ oturuma aittir:
    // ne silme, ne yazma, ne başarı bildirimi. Sessizce başarısız sayılır ki
    // çağıran (api_client) isteği yeni kullanıcı adına TEKRARLAMASIN.
    // Kimlik bilgisi (belirteç/çerez/kullanıcı) HİÇBİR YERE yazılmaz.
    if (nesil != oturumNesli) return YenilemeSonucu.gecici;

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
      //
      // 403 kesin ret DEĞİL (kaynak 400/401/403 sayıyordu; sapma gerekçesi
      // ve kanıt: YenilemeSonucu.kesinRet belgesi).
      if (status == 400 || status == 401) {
        clearSession();
        await clearPersisted();
        return YenilemeSonucu.kesinRet;
      }
      return YenilemeSonucu.gecici;
    }

    final data = res.data;
    // 2xx geldi ama gövde beklenen biçimde değil: sunucu tarafında bir
    // tuhaflık var, oturum reddedilmiş DEĞİL.
    if (data is! Map) return YenilemeSonucu.gecici;

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
    return YenilemeSonucu.yenilendi;
  } catch (_) {
    // AĞ HATASI — bağlantı yok, zaman aşımı, DNS. Oturum hakkında hiçbir şey
    // öğrenilmedi; anahtar büyük olasılıkla hâlâ geçerli. Bu yüzden `kesinRet`
    // DEĞİL: kullanıcı kopuk bir bağlantı yüzünden hesabından atılamaz.
    return YenilemeSonucu.gecici;
  }
}
