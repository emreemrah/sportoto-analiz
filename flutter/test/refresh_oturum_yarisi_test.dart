// YENİLEME (refresh) OTURUM YARIŞI — `api_client` + `refresh_client`.
//
// NEYİ KİLİTLİYOR: 401 sonrası başlıklar O ANKİ oturumdan yeniden kurulur.
// Araya çıkış/yeni giriş girerse, ESKİ bir isteğin 401'i YENİ kullanıcının
// tek kullanımlık yenileme anahtarını harcayabilir; yenileme reddedilirse
// yeni oturum silinir, başarılı olursa yeni kullanıcının belirteçleri eski
// isteğin sonucuyla değişir. `auth.dart`taki nesil denetimi bu katmanı
// kapsamıyordu — koruma artık `session_state.oturumNesli` üzerinden
// api_client ve refresh_client'ta da var.
//
// TESTLER AĞA ÇIKMAZ ve GERÇEK KİMLİK BİLGİSİ KULLANMAZ:
//   • HTTP: sahte `HttpClientAdapter` (dio'nun iki üyeli arayüzü). Ana
//     istemci için `ApiClient(dio: ...)`, yenileme için `yenilemeIstemcisi`.
//   • Güvenli depo: paketin kendi `setMockInitialValues` belleği.
//   • Zamanlama: her cevap bir `Completer` ile açılır — "istek uçarken
//     kullanıcı değişti" durumu böyle kurulur, gerçek bekleme yoktur.

import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/auth.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/core/session/refresh_client.dart';
import 'package:masteranaliz/core/session/session_state.dart';

/// Programlanabilir sahte taşıyıcı: her isteği kaydeder, cevabı testin
/// verdiği işlevden alır.
class _SahteTasiyici implements HttpClientAdapter {
  _SahteTasiyici(this.cevapla);

  /// (yol, başlıklar, kaçıncı istek) → cevap
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

  Iterable<RequestOptions> yol(String parca) =>
      istekler.where((i) => i.path.contains(parca));
}

ResponseBody _json(int kod, [Map<String, dynamic> govde = const {}]) =>
    ResponseBody.fromString(
      // Basit ve bağımlılıksız: gövdeler küçük ve sabit.
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

/// A oturumunu üretim yoluyla kurar (disk → bellek → authState).
Future<Map<String, String>> _oturumKur(String ad) async {
  final depo = _depoyuKur(token: '$ad-erisim', refresh: '$ad-yenileme');
  await initAuthYerel();
  return depo;
}

String? _yetki(RequestOptions i) => i.headers['Authorization'] as String?;

/// Olay döngüsünü birkaç tur çevirir: dio'nun kendi ardışık `await`leri
/// (araya giren dönüştürücüler) tek turda bitmez. GERÇEK bekleme yoktur —
/// hepsi `Duration.zero`.
Future<void> _tur([int n = 12]) async {
  for (var i = 0; i < n; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  late _SahteTasiyici anaTasiyici;
  late _SahteTasiyici yenilemeTasiyici;

  /// Ana istemcinin cevap planı: yol parçasına göre sıradaki cevabı verir.
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
    await handleSessionRevoked(); // temiz başlangıç
  });

  tearDown(() {
    couponSahipKancasi = null;
    couponIzolasyonKancasi = null;
    bildirimIptalKancasi = null;
  });

  group('Eski istek YENİ oturuma dokunamaz', () {
    test(
      '1) A isteği 401 dönerken B girmişse B\'nin anahtarı KULLANILMAZ',
      () async {
        await _oturumKur('A');
        final istemci = istemciKur();

        // A'nın isteği uçarken kapıyı tutuyoruz.
        final kapi = Completer<void>();
        anaPlan.add((i) async {
          await kapi.future;
          return _json(401, {'error': 'süresi doldu'});
        });

        final istek = istemci.me();
        await _tur();

        // B girer (çıkış + yeni yerel oturum: kimlik değişimi noktası aynı).
        await logout();
        final bDepo = await _oturumKur('B');

        kapi.complete(); // A'nın 401'i ŞİMDİ geliyor
        await expectLater(istek, throwsA(isA<ApiException>()));

        expect(
          yenilemeTasiyici.istekler,
          isEmpty,
          reason:
              'yenileme HİÇ başlatılmamalı — B\'nin tek kullanımlık '
              'anahtarı eski istek için harcanamaz',
        );
        expect(
          getRefreshToken(),
          'B-yenileme',
          reason: 'B\'nin anahtarı durur',
        );
        expect(getAccessToken(), 'B-erisim', reason: 'B\'nin oturumu korunur');
        expect(bDepo['sportoto.token'], 'B-erisim');
        expect(bDepo['sportoto.refresh'], 'B-yenileme');
        expect(getToken(), 'B-erisim', reason: 'authState de bozulmamalı');
        expect(
          anaTasiyici.yol('/api/users/me').length,
          1,
          reason: 'istek B adına tekrarlanmamalı',
        );
      },
    );

    test('2) A YENİLEMESİ sürerken B girer, yenileme REDDEDİLİR → '
        'B\'nin oturumu silinmez', () async {
      await _oturumKur('A');

      final kapi = Completer<void>();
      yenilemePlan.add((i) async {
        await kapi.future;
        return _json(401, {'error': 'oturum kapatılmış'});
      });

      final yenileme = tryRefresh(); // A oturumunda başlıyor
      await _tur();

      await logout();
      final bDepo = await _oturumKur('B');

      kapi.complete();
      expect(
        await yenileme,
        YenilemeSonucu.gecici,
        reason:
            'eski yenileme ne başarı ne KESİN RET bildirebilir — '
            'kesinRet dönseydi çağıran yeni oturumu düşürürdü',
      );

      expect(getAccessToken(), 'B-erisim');
      expect(getRefreshToken(), 'B-yenileme');
      expect(
        bDepo['sportoto.token'],
        'B-erisim',
        reason: 'kalıcı kayıt silinmemeli (clearPersisted çalışmamalı)',
      );
      expect(bDepo['sportoto.refresh'], 'B-yenileme');
      expect(getToken(), 'B-erisim');
    });

    test('3) A YENİLEMESİ sürerken B girer, yenileme BAŞARILI → '
        'B\'nin belirteçleri değişmez, istek B adına gönderilmez', () async {
      await _oturumKur('A');
      final istemci = istemciKur();

      // A'nın isteği hemen 401 alır → yenileme başlar ve kapıda bekler.
      anaPlan.add((i) async => _json(401, {'error': 'süresi doldu'}));
      final kapi = Completer<void>();
      yenilemePlan.add((i) async {
        await kapi.future;
        return _json(200, {
          'token': 'A-erisim-YENI',
          'refreshToken': 'A-yenileme-YENI',
        });
      });

      final istek = istemci.me();
      await _tur();
      expect(yenilemeTasiyici.istekler.length, 1, reason: 'yenileme başladı');

      // Yenileme uçarken B girer.
      await logout();
      final bDepo = await _oturumKur('B');

      kapi.complete(); // A'nın yenilemesi BAŞARIYLA dönüyor
      await expectLater(istek, throwsA(isA<ApiException>()));

      expect(
        getAccessToken(),
        'B-erisim',
        reason: 'eski yenilemenin belirteci B\'nin üzerine YAZILAMAZ',
      );
      expect(getRefreshToken(), 'B-yenileme');
      expect(bDepo['sportoto.token'], 'B-erisim');
      expect(bDepo['sportoto.refresh'], 'B-yenileme');
      expect(
        anaTasiyici.yol('/api/users/me').length,
        1,
        reason: 'eski istek B adına YENİDEN gönderilmemeli',
      );
    });

    test(
      '7) farklı nesillerin yenilemeleri aynı Future\'ı PAYLAŞMAZ',
      () async {
        await _oturumKur('A');

        final aKapi = Completer<void>();
        yenilemePlan.add((i) async {
          await aKapi.future;
          return _json(401);
        });
        final aYenileme = tryRefresh();
        await _tur();

        await logout();
        await _oturumKur('B');

        final bKapi = Completer<void>();
        yenilemePlan.add((i) async {
          await bKapi.future;
          return _json(200, {
            'token': 'B-erisim-2',
            'refreshToken': 'B-yenileme-2',
          });
        });
        final bYenileme = tryRefresh();

        expect(
          identical(aYenileme, bYenileme),
          isFalse,
          reason: 'B, A\'nın uçuşunu (ve reddini) miras alamaz',
        );

        aKapi.complete();
        bKapi.complete();
        expect(
          await aYenileme,
          YenilemeSonucu.gecici,
          reason:
              'A\'nınki eskidi (401 gördü ama kesinRet DEĞİL: karar '
              'artık B\'nin oturumunu bağlamaz)',
        );
        expect(
          await bYenileme,
          YenilemeSonucu.yenilendi,
          reason: 'B\'ninki kendi sonucunu alır',
        );
        expect(yenilemeTasiyici.istekler.length, 2, reason: 'iki ayrı istek');
        expect(getAccessToken(), 'B-erisim-2');
      },
    );

    test('8) oturum değiştikten sonra gelen geç sonuç authState\'i '
        'DEĞİŞTİRMEZ', () async {
      await _oturumKur('A');

      final kapi = Completer<void>();
      yenilemePlan.add((i) async {
        await kapi.future;
        return _json(200, {'token': 'A-erisim-2', 'refreshToken': 'A-yen-2'});
      });
      final yenileme = tryRefresh();
      await _tur();

      await logout();
      final oncekiDurum = authState.value;

      kapi.complete();
      await yenileme;

      expect(getToken(), isNull);
      expect(authState.value.user, isNull);
      expect(
        identical(authState.value, oncekiDurum),
        isTrue,
        reason: 'geç sonuç authState\'e hiç dokunmamalı',
      );
      expect(getAccessToken(), isNull, reason: 'oturum kapalı kalmalı');
    });
  });

  group('Aynı oturumun MEŞRU yenilemesi bozulmadı', () {
    test(
      '4) süresi dolan belirteç yenilenir, istek BİR KEZ tekrarlanır',
      () async {
        final depo = await _oturumKur('A');
        final istemci = istemciKur();

        anaPlan.add((i) async => _json(401, {'error': 'süresi doldu'}));
        yenilemePlan.add(
          (i) async => _json(200, {
            'token': 'A-erisim-2',
            'refreshToken': 'A-yenileme-2',
          }),
        );
        anaPlan.add((i) async => _json(200, {'username': 'a-kullanici'}));

        final sonuc = await istemci.me();

        expect(
          (sonuc as Map)['username'],
          'a-kullanici',
          reason: 'geçerli cevap normal uygulanmalı',
        );
        expect(
          getAccessToken(),
          'A-erisim-2',
          reason: 'yeni belirteç bellekte',
        );
        expect(
          depo['sportoto.token'],
          'A-erisim-2',
          reason: 'diske de yazıldı',
        );
        expect(depo['sportoto.refresh'], 'A-yenileme-2');

        final meIstekleri = anaTasiyici.yol('/api/users/me').toList();
        expect(meIstekleri.length, 2, reason: 'YALNIZ bir kez tekrarlanır');
        expect(_yetki(meIstekleri[0]), 'Bearer A-erisim');
        expect(
          _yetki(meIstekleri[1]),
          'Bearer A-erisim-2',
          reason: 'tekrar yeni belirteçle gider',
        );
        expect(yenilemeTasiyici.istekler.length, 1);
      },
    );

    test('5) aynı oturumun anahtarı KESİN reddedilirse yalnız o oturum '
        'temizlenir', () async {
      final depo = await _oturumKur('A');
      final istemci = istemciKur();

      anaPlan.add((i) async => _json(401));
      yenilemePlan.add((i) async => _json(401, {'error': 'geçersiz'}));

      await expectLater(istemci.me(), throwsA(isA<ApiException>()));

      expect(getAccessToken(), isNull, reason: 'A oturumu kapanmalı');
      expect(getRefreshToken(), isNull);
      expect(depo, isEmpty, reason: 'A\'nın kalıcı kaydı da silinmeli');
      expect(
        anaTasiyici.yol('/api/users/me').length,
        1,
        reason: 'yenileme başarısızsa tekrar YOK',
      );
    });

    test('6) aynı oturumda eşzamanlı iki 401 → TEK yenileme, iki istek de '
        'güvenli sonuçlanır', () async {
      await _oturumKur('A');
      final istemci = istemciKur();

      // İki istek de 401 alır; ikisi de yenilemeyi tetiklemek ister.
      anaPlan.add((i) async => _json(401));
      anaPlan.add((i) async => _json(401));
      final kapi = Completer<void>();
      yenilemePlan.add((i) async {
        await kapi.future;
        return _json(200, {
          'token': 'A-erisim-2',
          'refreshToken': 'A-yenileme-2',
        });
      });
      anaPlan.add((i) async => _json(200, {'username': 'a-kullanici'}));
      anaPlan.add((i) async => _json(200, {'ok': 'evet'}));

      final ilk = istemci.me();
      final ikinci = istemci.favoriteTeams();
      await _tur();

      kapi.complete();
      final sonuclar = await Future.wait([ilk, ikinci]);

      expect(
        yenilemeTasiyici.istekler.length,
        1,
        reason: 'tek uçuş korunmalı — iki yenileme = anahtar rotasyonu bozulur',
      );
      expect((sonuclar[0] as Map)['username'], 'a-kullanici');
      expect((sonuclar[1] as Map)['ok'], 'evet');
      expect(getAccessToken(), 'A-erisim-2');
    });
  });
}
