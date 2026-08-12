// MAÇ SONUCU ANKETİ (kullanıcı isteği, 2026-08-11).
//
// NE SABİTLENİYOR:
//  1. OY VERMEDEN HİÇBİR SAYI GÖRÜNMEZ — sunucu dağılımı göndermiş olsa bile
//     ekranda toplam katılım, oy sayısı ve yüzde ÇİZİLMEZ. Kullanıcının en
//     net kuralı buydu ("kesinlikle görünmesin").
//  2. Oydan sonra toplam + her seçeneğin oy sayısı + yüzdesi görünür.
//  3. Seçenekler açılan maçtan üretilir (takım adlarıyla).
//  4. Bir kez oy: oy verilmiş kullanıcıya seçenek düğmesi hiç çizilmez.
//  5. BACKEND SÖZLEŞMESİ: telde `pollKey: 'ms'` ve `home/draw/away` gider.
//     '1'/'X'/'2' gönderilse oy kaydolur ama `/ms-summary` özeti onları
//     sessizce sayamazdı — bu yüzden icerik birebir doğrulanır.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/auth.dart' as auth;
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/features/match_detail/mac_sonuc_anketi.dart';

/// Anket ucunu taklit eder; POST gelince sunucu gibi oyu kaydeder.
class _AnketSunucusu implements HttpClientAdapter {
  _AnketSunucusu({this.toplam = 0, Map<String, int>? sayilar, this.benim})
    : sayilar = sayilar ?? <String, int>{};

  int toplam;
  Map<String, int> sayilar;
  String? benim;

  final List<Map<String, dynamic>> gonderilenler = [];

  ResponseBody _json(Object icerik, [int kod = 200]) => ResponseBody.fromString(
    jsonEncode(icerik),
    kod,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (!options.uri.path.contains('/api/predictions/poll')) {
      return _json({'error': 'yok'}, 404);
    }
    if (options.method == 'POST') {
      final govde = Map<String, dynamic>.from(options.data as Map);
      gonderilenler.add(govde);
      // Sunucu davranışı: kullanıcı başına tek kayıt.
      final secim = '${govde['selectedOption']}';
      if (benim == null) toplam += 1;
      benim = secim;
      sayilar[secim] = (sayilar[secim] ?? 0) + 1;
      return _json({'ok': true});
    }
    return _json({
      'results': {
        'ms': {'total': toplam, 'options': sayilar},
      },
      'mine': benim == null ? {} : {'ms': benim},
    });
  }

  @override
  void close({bool force = false}) {}
}

Future<void> _ac(
  WidgetTester t, {
  required _AnketSunucusu sunucu,
  bool girisli = true,
  bool macBasladi = false,
}) async {
  api.tasiyici = sunucu;
  auth.authState.value = girisli
      ? const auth.AuthState(
          token: 'test',
          ready: true,
          user: {'username': 'emrah41'},
        )
      : const auth.AuthState(ready: true);

  t.view.physicalSize = const Size(1000, 1800);
  t.view.devicePixelRatio = 1.0;
  addTearDown(() {
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });

  await t.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: MacSonucAnketi(
              matchId: 4242,
              homeName: 'Galatasaray',
              awayName: 'Çorum FK',
              macBasladi: macBasladi,
            ),
          ),
        ),
      ),
    ),
  );
  for (var i = 0; i < 25; i++) {
    await t.pump(const Duration(milliseconds: 16));
  }
}

/// Ekrandaki TÜM yazıları tek dizeye toplar — "hiçbir sayı görünmesin"
/// iddiası tek tek metin aramakla değil, ekranın tamamına bakarak ölçülür.
String _ekranMetni(WidgetTester t) =>
    t.widgetList<Text>(find.byType(Text)).map((w) => w.data ?? '').join(' | ');

void main() {
  tearDown(() => auth.authState.value = const auth.AuthState());

  group('Oy vermeden sonuç GÖRÜNMEZ', () {
    testWidgets('sunucu dağılımı göndermiş olsa bile hiçbir sayı çizilmez', (
      t,
    ) async {
      // Sunucuda 367 oy var ve istemciye geliyor; ekran bunu GÖSTERMEMELİ.
      final sunucu = _AnketSunucusu(
        toplam: 367,
        sayilar: {'home': 200, 'draw': 100, 'away': 67},
      );
      await _ac(t, sunucu: sunucu);

      final metin = _ekranMetni(t);
      expect(metin, isNot(contains('367')));
      expect(metin, isNot(contains('200')));
      expect(metin, isNot(contains('100')));
      expect(metin, isNot(contains('67')));
      expect(metin, isNot(contains('%')));
      expect(metin, isNot(contains(' oy')));
      // Seçenekler ise duruyor.
      expect(find.byKey(const Key('anket-secenek-home')), findsOne);
      expect(find.byKey(const Key('anket-secenek-draw')), findsOne);
      expect(find.byKey(const Key('anket-secenek-away')), findsOne);
    });

    testWidgets('seçenekler açılan maçın takımlarından üretilir', (t) async {
      await _ac(t, sunucu: _AnketSunucusu());

      expect(find.text('Galatasaray kazanır'), findsOne);
      expect(find.text('Berabere biter'), findsOne);
      expect(find.text('Çorum FK kazanır'), findsOne);
    });
  });

  group('Oydan sonra sonuçlar', () {
    testWidgets('toplam, oy sayısı ve yüzde görünür', (t) async {
      // Zaten 3 oy var; bu kullanıcı 4.'yü verecek.
      final sunucu = _AnketSunucusu(toplam: 3, sayilar: {'home': 2, 'draw': 1});
      await _ac(t, sunucu: sunucu);

      await t.tap(find.byKey(const Key('anket-secenek-away')));
      for (var i = 0; i < 25; i++) {
        await t.pump(const Duration(milliseconds: 16));
      }

      final metin = _ekranMetni(t);
      // 4 oy: home 2 (%50), draw 1 (%25), away 1 (%25)
      expect(metin, contains('Toplam 4 oy'));
      expect(find.textContaining('2 oy · %50'), findsOne);
      expect(find.textContaining('1 oy · %25'), findsNWidgets(2));
    });

    testWidgets('oy verildikten sonra seçenek düğmesi KALMAZ (tek oy)', (
      t,
    ) async {
      final sunucu = _AnketSunucusu();
      await _ac(t, sunucu: sunucu);

      await t.tap(find.byKey(const Key('anket-secenek-home')));
      for (var i = 0; i < 25; i++) {
        await t.pump(const Duration(milliseconds: 16));
      }

      expect(find.byKey(const Key('anket-secenek-home')), findsNothing);
      expect(find.byKey(const Key('anket-secenek-draw')), findsNothing);
      expect(find.byKey(const Key('anket-secenek-away')), findsNothing);
    });

    testWidgets('daha önce oy vermiş kullanıcıya sonuçlar açık gelir', (
      t,
    ) async {
      await _ac(
        t,
        sunucu: _AnketSunucusu(
          toplam: 10,
          sayilar: {'home': 5, 'draw': 3, 'away': 2},
          benim: 'draw',
        ),
      );

      expect(_ekranMetni(t), contains('Toplam 10 oy'));
      expect(find.textContaining('5 oy · %50'), findsOne);
      expect(find.byKey(const Key('anket-secenek-home')), findsNothing);
    });
  });

  group('Backend sözleşmesi', () {
    testWidgets('telde pollKey "ms" ve home/draw/away gider', (t) async {
      final sunucu = _AnketSunucusu();
      await _ac(t, sunucu: sunucu);

      await t.tap(find.byKey(const Key('anket-secenek-draw')));
      for (var i = 0; i < 25; i++) {
        await t.pump(const Duration(milliseconds: 16));
      }

      expect(sunucu.gonderilenler, hasLength(1));
      final govde = sunucu.gonderilenler.single;
      expect(govde['matchId'], 4242);
      expect(govde['pollKey'], 'ms');
      // '1'/'X'/'2' GÖNDERİLMEZ — /ms-summary bu üç değeri sayar.
      expect(govde['selectedOption'], 'draw');
    });
  });

  group('Oy verilemeyen durumlar', () {
    testWidgets('girişsiz kullanıcı oy veremez ve sonuç görmez', (t) async {
      final sunucu = _AnketSunucusu(toplam: 99, sayilar: {'home': 99});
      await _ac(t, sunucu: sunucu, girisli: false);

      await t.tap(find.byKey(const Key('anket-secenek-home')));
      for (var i = 0; i < 25; i++) {
        await t.pump(const Duration(milliseconds: 16));
      }

      expect(sunucu.gonderilenler, isEmpty);
      expect(_ekranMetni(t), isNot(contains('99')));
      expect(_ekranMetni(t), contains('giriş'));
    });

    testWidgets('maç başladıysa oy alınmaz ve sebebi yazılır', (t) async {
      final sunucu = _AnketSunucusu();
      await _ac(t, sunucu: sunucu, macBasladi: true);

      await t.tap(find.byKey(const Key('anket-secenek-home')));
      for (var i = 0; i < 25; i++) {
        await t.pump(const Duration(milliseconds: 16));
      }

      expect(sunucu.gonderilenler, isEmpty);
      expect(_ekranMetni(t), contains('anket kapandı'));
    });
  });
}
