// KUPON SENKRONU OTURUM YARIŞI — `syncFromServer` uzun ağ işi.
//
// NEYİ KİLİTLİYOR: `syncFromServer()` açılışta `couponSahipKancasi` ile arka
// planda başlar ve üç ekrandan daha çağrılır. `api.getCoupons()` ağda
// beklerken kullanıcı çıkıp BAŞKASI girebilir. Korunmasaydı A'nın geç gelen
// cevabı:
//   • `_mergeById(_cache, ...)` ile A'nın kuponlarını B'nin deposuna karıştırır,
//   • bunu B'nin cihazına yazar,
//   • `_pushNow()` ile A'nın kuponlarını B'NİN HESABINA yüklerdi
//     (başlıklar artık B'nin belirtecini taşıdığı için sunucu kabul ederdi).
// Deponun kendi başlık notundaki "önceki kullanıcının kuponu yeni hesaba
// karışmaz" sözü tam burada delinirdi.
//
// Testler ağa çıkmaz: `api` genel nesnesinin Dio'su enjekte edilemediği için
// HTTP, dio'nun taşıyıcı arayüzü üzerinden `HttpOverrides`siz biçimde
// `couponStoreYukle` + sahte SharedPreferences ile birlikte sınanır.

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/auth.dart';
import 'package:masteranaliz/core/coupon/coupon_store.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/core/session/session_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

ResponseBody _jsonHam(int kod, String govde) => ResponseBody.fromString(
  govde,
  kod,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

Map<String, dynamic> _kupon(String id, String sahip) => {
  'id': id,
  'schema': 2,
  'roundId': 'h1',
  'sahip': sahip,
  'updatedAt': '2026-08-09T10:00:00.000',
};

void _depoyuKur({String? token, String? refresh}) {
  final m = <String, String>{};
  if (token != null) m['sportoto.token'] = token;
  if (refresh != null) m['sportoto.refresh'] = refresh;
  FlutterSecureStorage.setMockInitialValues(m);
}

Future<void> _tur([int n = 12]) async {
  for (var i = 0; i < n; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _SahteTasiyici tasiyici;
  late List<Future<ResponseBody> Function(RequestOptions)> plan;

  /// `api` genel nesnesinin Dio'suna doğrudan erişilemediği için, kupon
  /// katmanının gerçekten kullandığı `api` üzerinden giden istekleri
  /// taşıyıcıyı değiştirerek yakalıyoruz.
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    plan = [];
    tasiyici = _SahteTasiyici((i) {
      if (plan.isEmpty) return Future.value(_jsonHam(500, '{}'));
      return plan.removeAt(0)(i);
    });
    api.tasiyici = tasiyici;

    couponSahipKancasi = null;
    couponIzolasyonKancasi = null;
    bildirimIptalKancasi = null;
    _depoyuKur();
    await handleSessionRevoked();
    await couponStoreYukle();
    await yereliTemizle();
  });

  tearDown(() {
    couponSahipKancasi = null;
    couponIzolasyonKancasi = null;
    bildirimIptalKancasi = null;
  });

  test('A\'nın geç gelen kupon cevabı B\'nin deposuna KARIŞMAZ', () async {
    // A girişli; senkron başlar ve ağda asılı kalır.
    _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
    await initAuthYerel();
    await sahibiAyarla('A-kimlik');

    final kapi = Completer<void>();
    plan.add((i) async {
      await kapi.future;
      return _jsonHam(
        200,
        jsonEncode({
          'coupons': [_kupon('a1', 'A'), _kupon('a2', 'A')],
        }),
      );
    });

    final senkron = syncFromServer();
    await _tur();

    // A çıkar, B girer.
    await logout();
    _depoyuKur(token: 'B-erisim', refresh: 'B-yenileme');
    await initAuthYerel();
    await sahibiAyarla('B-kimlik');

    final istekSayisiOnce = tasiyici.istekler.length;

    // A'nın cevabı ŞİMDİ geliyor.
    kapi.complete();
    final sonuc = await senkron;
    await _tur();

    // ÖNCE veri bütünlüğü: asıl zarar burada görünür.
    expect(
      getWeekCoupons('h1'),
      isEmpty,
      reason: 'A\'nın kuponları B\'nin deposunda GÖRÜNEMEZ',
    );
    expect(
      tasiyici.istekler.length,
      istekSayisiOnce,
      reason: 'A\'nın kuponları B\'nin hesabına YÜKLENEMEZ (putCoupons yok)',
    );
    expect(sonuc, isFalse, reason: 'eski senkron başarı bildiremez');
  });

  test('aynı oturumda senkron NORMAL çalışır', () async {
    _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
    await initAuthYerel();
    await sahibiAyarla('A-kimlik');

    plan.add(
      (i) async => _jsonHam(
        200,
        jsonEncode({
          'coupons': [_kupon('a1', 'A')],
        }),
      ),
    );

    expect(await syncFromServer(), isTrue);
    expect(getWeekCoupons('h1').map((c) => c['id']), [
      'a1',
    ], reason: 'koruma FAZLA korumamalı');
  });

  test('oturum yokken senkron hiç başlamaz', () async {
    expect(await syncFromServer(), isFalse);
    expect(tasiyici.istekler, isEmpty);
  });

  // ── DİSK YAZIMI SIRASINDA OTURUM DEĞİŞİMİ ─────────────────────────────
  //
  // `deleteCoupon('olmayan')` bilerek kullanılıyor: kupon bulunmasa da
  // `_persist(push: true)` çalışır — kupon kurulum kurallarına girmeden
  // yazma+yükleme yolunu tetiklemenin en küçük yolu. Oturum değişimi,
  // `_persist` ilk `await`inde (disk yazımı) askıdayken SENKRON yapılır
  // (`clearSession` nesli anında artırır; `setSession` B'nin belirtecini
  // kurar). Bunlar `logout`/`initAuthYerel`in içeride kullandığı üretim
  // ilkelleridir — zamanlama yarışı olmadan aynı durum geçişini kurarlar.

  Iterable<RequestOptions> putlar() =>
      tasiyici.istekler.where((i) => i.method == 'PUT');

  test(
    'A\'nın disk yazımı sürerken B girerse eski işlem PUSH YAPMAZ',
    () async {
      _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
      await initAuthYerel();
      await sahibiAyarla('A-kimlik');

      // A'nın yazma işlemi başlar; ilk await'te (disk) askıda kalır.
      final eskiIslem = deleteCoupon('olmayan-kupon');

      // B, tam bu askı sırasında girer.
      clearSession(); // kimlik değişti — nesil artar
      setSession(token: 'B-erisim', refreshToken: 'B-yenileme');

      await eskiIslem;
      await _tur();

      expect(
        putlar(),
        isEmpty,
        reason:
            'eski işlem B\'nin hesabına yükleme BAŞLATAMAZ — B\'nin '
            'sunucudaki kuponları eski niyetle (boş listeyle) ezilirdi',
      );
    },
  );

  test('A\'nın disk yazımı sürerken ÇIKIŞ olursa push yapılmaz', () async {
    _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
    await initAuthYerel();
    await sahibiAyarla('A-kimlik');

    final eskiIslem = deleteCoupon('olmayan-kupon');
    clearSession(); // çıkışın çekirdeği: oturum düştü, nesil arttı

    await eskiIslem;
    await _tur();

    expect(
      putlar(),
      isEmpty,
      reason: 'çıkmış oturum adına sunucuya kupon yazılamaz',
    );
  });

  test('AYNI oturumda disk yazımı biterse push NORMAL çalışır', () async {
    _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
    await initAuthYerel();
    await sahibiAyarla('A-kimlik');

    plan.add((i) async => _jsonHam(200, '{"ok":true}')); // putCoupons cevabı

    await deleteCoupon('olmayan-kupon');
    await _tur();

    expect(putlar().length, 1, reason: 'koruma FAZLA korumamalı');
  });

  test('TOKEN ROTASYONU aynı kullanıcının push\'unu iptal ETMEZ', () async {
    _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
    await initAuthYerel();
    await sahibiAyarla('A-kimlik');

    plan.add((i) async => _jsonHam(200, '{"ok":true}'));

    final islem = deleteCoupon('olmayan-kupon');
    // Sessiz yenilemenin yaptığı şey: belirteç değişir, KİMLİK değişmez
    // (nesil artmaz).
    setSession(token: 'A-erisim-2', refreshToken: 'A-yenileme-2');

    await islem;
    await _tur();

    expect(
      putlar().length,
      1,
      reason: 'rotasyon kimlik değişimi sayılsaydı meşru yükleme kaybolurdu',
    );
  });

  test('syncFromServer KUYRUK yüklemesi: senkron sürerken B girerse '
      'B\'ye hiçbir yazma olmaz', () async {
    // 1) A, sunucudan a1 kuponunu alır (yerel dolu).
    _depoyuKur(token: 'A-erisim', refresh: 'A-yenileme');
    await initAuthYerel();
    await sahibiAyarla('A-kimlik');
    plan.add(
      (i) async => _jsonHam(
        200,
        jsonEncode({
          'coupons': [_kupon('a1', 'A')],
        }),
      ),
    );
    expect(await syncFromServer(), isTrue);
    expect(getWeekCoupons('h1').length, 1);

    // 2) İkinci senkron: sunucu BOŞ dönecek → yerel (a1) ≠ sunucu ([]) →
    //    kuyruk yüklemesi koşulu oluşur. Cevap kapıda bekletilir.
    final kapi = Completer<void>();
    plan.add((i) async {
      await kapi.future;
      return _jsonHam(200, '{"coupons":[]}');
    });
    final eskiSenkron = syncFromServer();
    await _tur();

    // 3) A çıkar, B girer (tam üretim akışıyla).
    await logout();
    _depoyuKur(token: 'B-erisim', refresh: 'B-yenileme');
    await initAuthYerel();
    await sahibiAyarla('B-kimlik');
    final putOnce = putlar().length;

    // 4) A'nın cevabı şimdi gelir.
    kapi.complete();
    expect(await eskiSenkron, isFalse);
    await _tur();

    expect(putlar().length, putOnce, reason: 'B adına PUT gönderilemez');
    expect(
      getWeekCoupons('h1'),
      isEmpty,
      reason: 'A\'nın kuponu B\'nin deposuna sızamaz',
    );
  });
}
