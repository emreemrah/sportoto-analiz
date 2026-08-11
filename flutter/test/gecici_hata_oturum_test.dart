// GEÇİCİ HATA ≠ KESİN RET — yenileme sonuçlandırılamayınca oturum düşmemeli.
//
// NEYİ KİLİTLİYOR: `tryRefresh()` eskiden düz `bool` dönüyordu ve `false` üç
// ayrı şeyi birden anlatıyordu: "sunucu reddetti", "ağ koptu", "araya başka
// oturum girdi". `api_client` üçünde de ham 401'i fırlatıyor, `initAuthUzak`
// bunu KESİN RET sayıp `clearSession()` + `clearPersisted()` çalıştırıyordu.
// Sonuç: erişim belirtecinin süresi dolduğu anda tek bir kopuk bağlantı,
// GEÇERLİ yenileme anahtarı dururken kullanıcıyı kalıcı olarak hesabından
// atıyordu — bir daha ancak şifreyle girebiliyordu.
//
// Testler ağa çıkmaz: HTTP için dio'nun iki üyeli `HttpClientAdapter`
// arayüzünün sahtesi, depo için paketin `setMockInitialValues` belleği.

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/auth.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/core/session/refresh_client.dart';
import 'package:masteranaliz/core/session/session_state.dart';

class _SahteTasiyici implements HttpClientAdapter {
  _SahteTasiyici(this.cevapla);

  final Future<ResponseBody> Function(RequestOptions istek) cevapla;
  final List<RequestOptions> istekler = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    istekler.add(options);
    return cevapla(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int kod, [Map<String, dynamic> govde = const {}]) =>
    ResponseBody.fromString(
      '{${govde.entries.map((e) => '"${e.key}":"${e.value}"').join(',')}}',
      kod,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

Map<String, String> _depoyuKur({String? token, String? refresh}) {
  final m = <String, String>{};
  if (token != null) m['sportoto.token'] = token;
  if (refresh != null) m['sportoto.refresh'] = refresh;
  FlutterSecureStorage.setMockInitialValues(m);
  return m;
}

void main() {
  late _SahteTasiyici anaTasiyici;
  late _SahteTasiyici yenilemeTasiyici;
  late List<Future<ResponseBody> Function(RequestOptions)> anaPlan;
  late List<Future<ResponseBody> Function(RequestOptions)> yenilemePlan;

  ApiClient istemciKur() {
    anaTasiyici = _SahteTasiyici((i) {
      if (anaPlan.isEmpty) return Future.value(_json(500));
      return anaPlan.removeAt(0)(i);
    });
    final dio = Dio(
      BaseOptions(validateStatus: (_) => true, responseType: ResponseType.json),
    )..httpClientAdapter = anaTasiyici;
    return ApiClient(dio: dio);
  }

  setUp(() async {
    couponSahipKancasi = null;
    couponIzolasyonKancasi = null;
    bildirimIptalKancasi = null;
    anaPlan = [];
    yenilemePlan = [];
    yenilemeTasiyici = _SahteTasiyici((i) {
      if (yenilemePlan.isEmpty) return Future.value(_json(500));
      return yenilemePlan.removeAt(0)(i);
    });
    yenilemeIstemcisi.httpClientAdapter = yenilemeTasiyici;
    _depoyuKur();
    await handleSessionRevoked();
  });

  tearDown(() {
    couponSahipKancasi = null;
    couponIzolasyonKancasi = null;
    bildirimIptalKancasi = null;
  });

  group('tryRefresh üç sonucu AYIRIR', () {
    test('ağ hatası → gecici (oturum silinmez)', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      yenilemePlan.add(
        (i) async => throw DioException.connectionError(
          requestOptions: i,
          reason: 'bağlantı yok',
        ),
      );

      expect(await tryRefresh(), YenilemeSonucu.gecici);
      expect(getAccessToken(), 'A-erisim', reason: 'oturum bellekte durmalı');
      expect(depo['sportoto.refresh'], 'A-yenileme', reason: 'diskte de');
    });

    test('5xx → gecici (sunucu dağıtımı kullanıcıyı atmaz)', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      yenilemePlan.add((i) async => _json(503, {'error': 'bakımda'}));

      expect(await tryRefresh(), YenilemeSonucu.gecici);
      expect(getAccessToken(), 'A-erisim');
      expect(depo['sportoto.refresh'], 'A-yenileme');
    });

    test('403 → gecici: oturum ve kalıcı anahtar SİLİNMEZ', () async {
      // Kanıtlı karar (2026-08-09): bu backend'in /api/auth/refresh ucu 403
      // ÜRETMİYOR; backend'deki 403'ler "askıya alma / yetki" demek ve
      // hepsinde yenileme anahtarı hâlâ geçerli. 403'ü kesin ret saymak,
      // araya giren bir proxy/WAF cevabıyla geçerli oturumu silmek olurdu.
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      yenilemePlan.add((i) async => _json(403, {'error': 'yasak'}));

      expect(await tryRefresh(), YenilemeSonucu.gecici);
      expect(getAccessToken(), 'A-erisim', reason: 'bellek korunmalı');
      expect(getRefreshToken(), 'A-yenileme');
      expect(depo['sportoto.token'], 'A-erisim', reason: 'disk korunmalı');
      expect(depo['sportoto.refresh'], 'A-yenileme');
    });

    test('400 → kesinRet (anahtar eksik = kalıcı durum)', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      yenilemePlan.add(
        (i) async => _json(400, {'error': 'Yenileme anahtarı gerekli.'}),
      );

      expect(await tryRefresh(), YenilemeSonucu.kesinRet);
      expect(getAccessToken(), isNull);
      expect(depo, isEmpty);
    });

    test('401 → kesinRet (oturum burada temizlenir)', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      yenilemePlan.add((i) async => _json(401, {'error': 'geçersiz'}));

      expect(await tryRefresh(), YenilemeSonucu.kesinRet);
      expect(getAccessToken(), isNull);
      expect(depo, isEmpty);
    });

    test('2xx → yenilendi', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      yenilemePlan.add(
        (i) async =>
            _json(200, {'token': 'A-erisim-2', 'refreshToken': 'A-yen-2'}),
      );

      expect(await tryRefresh(), YenilemeSonucu.yenilendi);
      expect(getAccessToken(), 'A-erisim-2');
      expect(depo['sportoto.token'], 'A-erisim-2');
    });
  });

  group('api_client 401\'i doğru etiketler', () {
    test('yenileme ağ hatasına takıldı → ApiException.gecici = true', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();
      final istemci = istemciKur();

      anaPlan.add((i) async => _json(401, {'error': 'süresi doldu'}));
      yenilemePlan.add(
        (i) async => throw DioException.connectionError(
          requestOptions: i,
          reason: 'bağlantı yok',
        ),
      );

      final hata = await istemci
          .me()
          .then<Object?>((_) => null)
          .catchError((Object e) => e);

      expect(hata, isA<ApiException>());
      expect((hata! as ApiException).status, 401);
      expect(
        (hata as ApiException).gecici,
        isTrue,
        reason: 'yenileme sonuçlanamadı; 401 kesin sayılamaz',
      );
      expect(depo['sportoto.refresh'], 'A-yenileme', reason: 'oturum durur');
    });

    test('yenileme KESİN reddedildi → gecici = false', () async {
      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();
      final istemci = istemciKur();

      anaPlan.add((i) async => _json(401));
      yenilemePlan.add((i) async => _json(401, {'error': 'geçersiz'}));

      final hata = await istemci
          .me()
          .then<Object?>((_) => null)
          .catchError((Object e) => e);

      expect((hata! as ApiException).gecici, isFalse);
    });

    test('401 dışı hatalar etiketlenmez', () async {
      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();
      final istemci = istemciKur();

      anaPlan.add((i) async => _json(500, {'error': 'patladı'}));

      final hata = await istemci
          .me()
          .then<Object?>((_) => null)
          .catchError((Object e) => e);

      expect((hata! as ApiException).status, 500);
      expect((hata as ApiException).gecici, isFalse);
      expect(yenilemeTasiyici.istekler, isEmpty);
    });
  });

  group('initAuthUzak: GEÇİCİ 401 oturumu DÜŞÜRMEZ', () {
    test('geçici 401 → oturum ve disk korunur', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      await initAuthUzak(
        profilGetir: () async =>
            throw const ApiException('yetkisiz', status: 401, gecici: true),
      );

      expect(getToken(), 'A-erisim', reason: 'kopuk bağlantı hesabı düşüremez');
      expect(getAccessToken(), 'A-erisim');
      expect(depo['sportoto.token'], 'A-erisim');
      expect(depo['sportoto.refresh'], 'A-yenileme');
    });

    test('KESİN 401 hâlâ oturumu düşürür', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      await initAuthUzak(
        profilGetir: () async =>
            throw const ApiException('yetkisiz', status: 401),
      );

      expect(getToken(), isNull, reason: 'kesin ret davranışı korunmalı');
      expect(depo, isEmpty);
    });

    test(
      'uçtan uca: 401 + yenileme ağ hatası → kullanıcı GİRİŞLİ kalır',
      () async {
        // Gerçek zincir: initAuthUzak → api_client → refresh_client → geri.
        final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
        await initAuthYerel();
        final istemci = istemciKur();

        anaPlan.add((i) async => _json(401, {'error': 'süresi doldu'}));
        yenilemePlan.add(
          (i) async => throw DioException.connectionError(
            requestOptions: i,
            reason: 'bağlantı yok',
          ),
        );

        await initAuthUzak(profilGetir: istemci.me);

        expect(getToken(), 'A-erisim', reason: 'oturum ayakta');
        expect(
          depo['sportoto.refresh'],
          'A-yenileme',
          reason: 'anahtar duruyor',
        );
      },
    );

    test('uçtan uca: 401 + yenileme 403 → kullanıcı ÇIKIŞA DÜŞMEZ', () async {
      // Gerçek zincir: initAuthUzak → api_client → refresh_client → geri.
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();
      final istemci = istemciKur();

      anaPlan.add((i) async => _json(401, {'error': 'süresi doldu'}));
      yenilemePlan.add((i) async => _json(403, {'error': 'yasak'}));

      await initAuthUzak(profilGetir: istemci.me);

      expect(getToken(), 'A-erisim', reason: '403 kesin ret sayılamaz');
      expect(getAccessToken(), 'A-erisim');
      expect(depo['sportoto.refresh'], 'A-yenileme', reason: 'anahtar durur');
    });

    test('geçici hatadan SONRA yenileme yine denenebilir', () async {
      // Tek uçuş kaydı temizlenmeli; yoksa ilk geçici hata kalıcı olurdu.
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      yenilemePlan.add(
        (i) async => throw DioException.connectionError(
          requestOptions: i,
          reason: 'bağlantı yok',
        ),
      );
      expect(await tryRefresh(), YenilemeSonucu.gecici);

      yenilemePlan.add(
        (i) async =>
            _json(200, {'token': 'A-erisim-2', 'refreshToken': 'A-yen-2'}),
      );
      expect(await tryRefresh(), YenilemeSonucu.yenilendi);

      expect(getAccessToken(), 'A-erisim-2');
      expect(depo['sportoto.token'], 'A-erisim-2');
      expect(yenilemeTasiyici.istekler.length, 2);
    });
  });
}
