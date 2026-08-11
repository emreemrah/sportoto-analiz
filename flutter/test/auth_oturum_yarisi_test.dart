// OTURUM YARIŞI — arka planda süren `initAuthUzak` ile kimlik değişimi.
//
// NEYİ KİLİTLİYOR: `main.dart` uzak doğrulamayı `unawaited(initAuthUzak())`
// ile başlatır; cevap döndüğünde kullanıcı çoktan ÇIKMIŞ ya da BAŞKA bir
// hesapla GİRMİŞ olabilir. Koruma olmadan eski isteğin sonucu yeni oturuma
// uygulanırdı:
//   • eski 401 → yeni kullanıcının oturumu + diskteki kaydı silinir;
//   • eski başarı → yeni kullanıcının profili eskisininkiyle değişir ve
//     `couponSahipKancasi` yanlış kimlikle çağrılıp yerel kuponları sildirir.
//
// Testler AĞA ÇIKMAZ: uzak çağrı `profilGetir` ile kontrollü `Completer`'a,
// güvenli depo paketin kendi `setMockInitialValues` belleğine bağlanır.
// `sportoto.session` bilerek BOŞ bırakılır — o zaman `logout()` sunucu
// çıkışını atlar (`getSessionId() == null`) ve akış tümüyle yerelde kalır.

import 'dart:async';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/auth.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/core/session/session_state.dart';
import 'package:masteranaliz/core/session/token_store.dart';

/// Güvenli depoyu tohumlar ve İÇERİĞİ İZLENEBİLİR haritayı döndürür
/// (paket haritayı kopyalamaz; yazma/silme buraya yansır).
Map<String, String> _depoyuKur({String? token, String? refresh}) {
  final m = <String, String>{};
  if (token != null) m['sportoto.token'] = token;
  if (refresh != null) m['sportoto.refresh'] = refresh;
  FlutterSecureStorage.setMockInitialValues(m);
  return m;
}

String _govde(String kaynak, String imza) {
  final bas = kaynak.indexOf(imza);
  if (bas < 0) fail('imza bulunamadı: $imza');
  final son = kaynak.indexOf('\n}', bas);
  if (son < 0) fail('gövde sonu bulunamadı: $imza');
  return kaynak.substring(bas, son);
}

void main() {
  setUp(() async {
    couponSahipKancasi = null;
    couponIzolasyonKancasi = null;
    bildirimIptalKancasi = null;
    _depoyuKur();
    await handleSessionRevoked(); // authState + session_state sıfırlanır
  });

  tearDown(() {
    couponSahipKancasi = null;
    couponIzolasyonKancasi = null;
    bildirimIptalKancasi = null;
  });

  group('Eski isteğin sonucu yeni oturuma UYGULANMAZ', () {
    test('SENARYO A: A\'nın geç 401\'i B\'nin oturumunu düşürmez', () async {
      // A'nın yerel oturumu yüklenir.
      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();
      expect(getToken(), 'A-erisim');

      // A için uzak doğrulama başlar ve ASILI kalır.
      final gecCevap = Completer<dynamic>();
      final uzakIs = initAuthUzak(profilGetir: () => gecCevap.future);
      await Future<void>.delayed(Duration.zero);

      // A çıkar.
      await logout();
      expect(getToken(), isNull);

      // B girer. (`login()` ağ ister; B'nin girişinin BIRAKTIĞI durum aynı
      // üretim işleviyle kurulur — kimlik değişimi noktası ikisinde de
      // `oturumNesliniArtir()`dır; imza taraması aşağıda o eşitliği bekçiler.)
      final bDepo = _depoyuKur(token: 'B-erisim', refresh: 'B-yenileme');
      await initAuthYerel();
      expect(getToken(), 'B-erisim');

      // A'ya ait eski istek ŞİMDİ 401 döner.
      gecCevap.completeError(const ApiException('yetkisiz', status: 401));
      await uzakIs;

      expect(
        getToken(),
        'B-erisim',
        reason: 'eski 401 YENİ kullanıcıyı oturumdan atamaz',
      );
      expect(
        getAccessToken(),
        'B-erisim',
        reason: 'istek katmanının belirteci de korunmalı',
      );
      expect(
        bDepo['sportoto.token'],
        'B-erisim',
        reason: 'kalıcı kayıt silinmemeli (clearPersisted çalışmamalı)',
      );
      expect(bDepo['sportoto.refresh'], 'B-yenileme');
    });

    test(
      'SENARYO B: A\'nın geç BAŞARISI B\'nin profilini/kuponunu bozmaz',
      () async {
        final sahipCagrilari = <Object?>[];
        couponSahipKancasi = (id) async => sahipCagrilari.add(id);

        _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
        await initAuthYerel();

        final gecCevap = Completer<dynamic>();
        final uzakIs = initAuthUzak(profilGetir: () => gecCevap.future);
        await Future<void>.delayed(Duration.zero);

        await logout();
        _depoyuKur(token: 'B-erisim', refresh: 'B-yenileme');
        await initAuthYerel();

        // A'nın profili şimdi geliyor.
        gecCevap.complete({'id': 'A-kimlik', 'username': 'a-kullanici'});
        await uzakIs;

        expect(
          authState.value.user,
          isNull,
          reason: 'B, A\'nın profiliyle gösterilemez',
        );
        expect(
          sahipCagrilari,
          isEmpty,
          reason:
              'kupon sahibi A yazılsaydı B\'nin YEREL kuponları silinirdi '
              '(coupon_store.sahibiAyarla: sahip farklıysa yereli temizler)',
        );
        expect(getToken(), 'B-erisim');
      },
    );

    test('çıkıştan sonra gelen geç BAŞARI oturumu geri DİRİLTMEZ', () async {
      final sahipCagrilari = <Object?>[];
      couponSahipKancasi = (id) async => sahipCagrilari.add(id);

      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      final gecCevap = Completer<dynamic>();
      final uzakIs = initAuthUzak(profilGetir: () => gecCevap.future);
      await Future<void>.delayed(Duration.zero);

      await logout();
      gecCevap.complete({'id': 'A-kimlik'});
      await uzakIs;

      expect(getToken(), isNull, reason: 'çıkmış kullanıcı geri girmiş olamaz');
      expect(authState.value.user, isNull);
      expect(sahipCagrilari, isEmpty);
    });
  });

  group('Koruma FAZLA da korumamalı', () {
    test('oturum aynıysa cevap NORMAL uygulanır', () async {
      final sahipCagrilari = <Object?>[];
      couponSahipKancasi = (id) async => sahipCagrilari.add(id);

      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      await initAuthUzak(
        profilGetir: () async => {'id': 'A-kimlik', 'username': 'a-kullanici'},
      );

      expect(authState.value.user?['username'], 'a-kullanici');
      expect(sahipCagrilari, ['A-kimlik']);
    });

    test('SESSİZ BELİRTEÇ YENİLEME cevabı attırmaz', () async {
      // Bu, "neden belirteç karşılaştırması değil, nesil sayacı" kararının
      // sınavı: istek sürerken api_client 401 alıp sessizce yenileyebilir
      // (refresh_client → setSession + persistSession). Belirteç eşitliği
      // arasaydık GEÇERLİ cevap atılırdı.
      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      final cevap = Completer<dynamic>();
      final uzakIs = initAuthUzak(profilGetir: () => cevap.future);
      await Future<void>.delayed(Duration.zero);

      setSession(token: 'A-erisim-2', refreshToken: 'A-yenileme-2');
      await persistSession(token: 'A-erisim-2', refreshToken: 'A-yenileme-2');

      cevap.complete({'id': 'A-kimlik', 'username': 'a-kullanici'});
      await uzakIs;

      expect(
        authState.value.user?['username'],
        'a-kullanici',
        reason: 'belirteç rotasyonu KİMLİK değişimi değildir',
      );
    });

    test('aynı oturumda gelen gerçek 401 oturumu KAPATIR', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      await initAuthUzak(
        profilGetir: () async =>
            throw const ApiException('yetkisiz', status: 401),
      );

      expect(getToken(), isNull, reason: 'kesin ret oturumu düşürür');
      expect(depo, isEmpty, reason: 'kalıcı kayıt da silinmeli');
    });

    test('geçici hata (5xx) oturuma DOKUNMAZ', () async {
      final depo = _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      await initAuthUzak(
        profilGetir: () async =>
            throw const ApiException('sunucu hatası', status: 503),
      );

      expect(getToken(), 'A-erisim');
      expect(depo['sportoto.token'], 'A-erisim');
    });
  });

  group('`kOturumIsareti` — ne olduğu ve NEREYE GİTMEDİĞİ', () {
    test(
      'belirteç yokken oturum izi girişli sayılır, ama AĞA GİTMEZ',
      () async {
        // Diskte erişim belirteci yok, yenileme anahtarı var (süresi dolmuş
        // erişim belirtecinin normal hâli).
        _depoyuKur(refresh: 'A-yenileme');
        await initAuthYerel();

        expect(getToken(), kOturumIsareti, reason: 'arayüz "girişli" görmeli');
        expect(authState.value.girisli, isTrue);
        expect(
          getAccessToken(),
          isNull,
          reason: 'istek katmanına SAHTE belirteç yazılmamalı',
        );
        expect(
          authHeaders(),
          isEmpty,
          reason: 'işaret Authorization başlığına DÖNÜŞEMEZ',
        );
      },
    );

    test(
      'çıkış işareti null\'a çeker (sabit işaret kimlik taşıyamaz)',
      () async {
        _depoyuKur(refresh: 'A-yenileme');
        await initAuthYerel();
        expect(getToken(), kOturumIsareti);

        await logout();

        // Kritik değişmez: işaret SABİT olduğu için iki farklı kullanıcı aynı
        // değeri taşıyabilir. Aradan null geçtiği sürece, belirteci "değişti mi"
        // anahtarı olarak kullanan ekranlar (profile_screen `_sonYetkiTokeni`)
        // yeni kullanıcıda mutlaka yeniden sorar.
        expect(getToken(), isNull);
      },
    );
  });

  group('Oturum nesli sözleşmesi (davranış)', () {
    test('kimlik değiştiren yollar nesli ARTIRIR', () async {
      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');

      final n0 = oturumNesli;
      await initAuthYerel();
      expect(
        oturumNesli,
        greaterThan(n0),
        reason: 'yerel oturum kurulumu kimlik değişimidir',
      );

      final n1 = oturumNesli;
      await logout();
      expect(oturumNesli, greaterThan(n1), reason: 'çıkış');

      _depoyuKur(token: 'B-erisim', refresh: 'B-yenileme');
      await initAuthYerel();
      final n2 = oturumNesli;
      await handleSessionRevoked();
      expect(oturumNesli, greaterThan(n2), reason: 'uzaktan iptal');
    });

    test('BELİRTEÇ ROTASYONU nesli artırmaz', () async {
      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();

      final n = oturumNesli;
      // refresh_client'ın başarı dalının yaptığı şey: yalnız belirteçleri
      // tazeler. Kimlik AYNI kullanıcıdır.
      setSession(token: 'A-erisim-2', refreshToken: 'A-yenileme-2');

      expect(
        oturumNesli,
        n,
        reason:
            'rotasyon "oturum değişti" sayılsaydı meşru yenilemeden '
            'sonraki geçerli cevaplar atılırdı',
      );
    });

    test('oturum izi yoksa nesil boşuna artmaz', () async {
      _depoyuKur(); // diskte hiçbir şey yok
      final n = oturumNesli;
      await initAuthYerel();
      expect(oturumNesli, n);
    });
  });

  group('Kaynak-tarama bekçileri', () {
    final authKaynak = File('lib/core/auth.dart').readAsStringSync();

    test('initAuthUzak durumu değiştiren HER daldan önce nesli denetler', () {
      final g = _govde(authKaynak, 'Future<void> initAuthUzak');
      expect(
        RegExp(r'benimNesil != oturumNesli').allMatches(g).length,
        greaterThanOrEqualTo(2),
        reason: 'hem başarı hem hata dalı korunmalı',
      );
      final basari = g.indexOf('_set(user:');
      final denetim = g.indexOf('benimNesil != oturumNesli');
      expect(
        denetim,
        lessThan(basari),
        reason: 'denetim mutasyondan ÖNCE gelmeli',
      );
    });

    test('_adoptSession (giriş/kayıt) nesli artırır', () {
      // Kimlik değiştiren yolların üçü aşağıda DAVRANIŞLA sınanıyor; bu tek
      // yol ağsız çalıştırılamıyor (yalnız `login`/`register` üzerinden
      // erişilebilir), o yüzden burada imza taranıyor.
      expect(
        _govde(
          authKaynak,
          'Future<void> _adoptSession',
        ).contains('oturumNesliniArtir()'),
        isTrue,
        reason:
            'giriş kimliği değiştiriyor ama nesli artırmıyor — arka plandaki '
            'eski istekler bu değişimi GÖREMEZ',
      );
    });

    test('istek başlıkları arayüz belirtecinden KURULMAZ', () {
      final ss = File('lib/core/session/session_state.dart').readAsStringSync();
      expect(
        ss.contains("import '../auth.dart'"),
        isFalse,
        reason: 'oturum durumu katmanı auth.dart\'ı hiç görmemeli',
      );
      expect(
        _govde(
          ss,
          'Map<String, String> authHeaders',
        ).contains(r'Bearer ${_state.token}'),
        isTrue,
        reason: 'Bearer değeri yalnız gerçek belirteçten gelmeli',
      );
    });

    test('üretimde uzak çağrı her zaman api.me', () {
      final g = _govde(authKaynak, 'Future<void> initAuthUzak');
      expect(g.contains('(profilGetir ?? api.me)()'), isTrue);
    });
  });
}
