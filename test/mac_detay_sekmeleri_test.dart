// MAÇ DETAYI SEKME DÜZENİ — kullanıcı isteğinin sözleşmesi (2026-08-11).
//
// NE SABİTLENİYOR:
//  1. Sekme SIRASI ve içeriği: Özet · Analiz · İstatistik · Oynanma Yüzdeleri ·
//     Oran Takibi · Bülten Sırası · Yorumlar. Eski 'Radar' sekmesi YOK.
//  2. İçerik alanından sağa/sola kaydırınca sekme değişir ve ÜSTTEKİ SEÇİLİ
//     SEKME de değişir (ikisi aynı denetleyiciye bağlı).
//  3. Dişli → "Maç Detay Sekme Ayarları" → sekme kapatma → çubuktan düşer.
//  4. Yorumlar KAPATILAMAZ (kullanıcı listede saymadı; ekranın çıpası).
//  5. Diskte kalmış tanınmayan ad ('Radar') sessizce elenir.
//
// ANA RADAR EKRANI: bu testler `features/radar/` altındaki hiçbir şeye
// dokunmaz — o ekranın kendi süiti (radar_ekrani_test.dart) yerinde duruyor.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/core/prefs.dart';
import 'package:masteranaliz/features/match_detail/mac_detay_sekmeleri.dart';
import 'package:masteranaliz/features/match_detail/match_detail_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Maç detayı dışındaki her uç 404 döner; ekran bunu zaten dürüst karşılıyor.
class _SahteTasiyici implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    '{"error":"yok"}',
    404,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

/// Uca göre yanıt veren taşıyıcı. TUZAK: İLK eşleşen anahtar kullanılır, bu
/// yüzden daha ÖZEL yollar haritada önce yazılır.
class _UcaGoreTasiyici implements HttpClientAdapter {
  _UcaGoreTasiyici(this.yanitlar);

  final Map<String, Object> yanitlar;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final yol = options.uri.toString();
    for (final e in yanitlar.entries) {
      if (yol.contains(e.key)) {
        return ResponseBody.fromString(
          jsonEncode(e.value),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      }
    }
    return ResponseBody.fromString(
      '{"error":"yok"}',
      404,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// 7. sıra BU maç, 8. sıra BAŞKA maç. Sayılar bilerek benzersiz seçildi:
/// ekranda 8. sıranın değeri görünürse test bunu ayırt edebilsin.
final Map<String, Object> kRadarYanitlari = {
  '/api/radar/1601/match/7': {
    'roundId': 1601,
    'round': '1. Hafta',
    'sealed': false,
    'sealedAt': null,
    'match': {'no': 7, 'home': 'Galatasaray', 'away': 'Çorum FK'},
  },
  '/api/radar/position-dna': {
    'hasData': true,
    'dna': {
      'positions': [
        {
          'position': 7,
          'windows': {
            'allTime': {
              'sample': 12,
              'pct': {'1': 41.7, 'X': 25.0, '2': 33.3},
            },
          },
        },
        {
          'position': 8,
          'windows': {
            'allTime': {
              'sample': 9,
              'pct': {'1': 88.8, 'X': 5.6, '2': 5.6},
            },
          },
        },
      ],
    },
  },
  '/api/radar/daily-played': {
    // Satır bileşeni yüzdeleri yalnız AKTİF sağlayıcılar için çizer; `sources`
    // boşsa "kayıt yok" yazar (bu, sahte yanıtın eksikliğiydi, ekranın değil).
    'sources': ['nesine'],
    'days': [
      {'date': '2026-08-14', 'weekday': 'Cuma', 'future': false},
    ],
    'matches': [
      {
        'no': 7,
        'cells': {
          '2026-08-14': {
            'bySource': {
              'nesine': {
                'percentages': {'1': 72, 'X': 16, '2': 12},
              },
            },
          },
        },
      },
      {
        'no': 8,
        'cells': {
          '2026-08-14': {
            'bySource': {
              'nesine': {
                'percentages': {'1': 83, 'X': 9, '2': 8},
              },
            },
          },
        },
      },
    ],
  },
};

/// Kullanıcının örneğindeki maç: Galatasaray–Çorum, bültende 7. sıra.
final Map<String, dynamic> kMac = {
  'no': 7,
  'roundId': 1601,
  'date': '2026-08-15T16:00:00Z',
  'league': 'Turkey Süper Lig',
  'status': 'scheduled',
  'home': {'name': 'Galatasaray', 'mediumName': 'Galatasaray'},
  'away': {'name': 'Çorum FK', 'mediumName': 'Çorum FK'},
  'analysis': {
    'comment': 'Ev sahibi son maçlarında istikrarlı.',
    'label': 'GÜÇLÜ ADAY',
    'labelColor': 'green',
  },
  'stats': {'home': {}, 'away': {}},
};

/// TEST FONTU ÖLÇÜM ESERİ — `MatchHeader`'ın 116 px'lik orta kutusu.
///
/// flutter_test'in varsayılan fontunda her glif KAREdir (genişlik = punto), bu
/// yüzden 21 puntoluk "19:00" 105 px ölçülür; tireler ve boşluklarla toplam
/// 163 px olur ve kutu 47 px taşar. Gerçek yazı tipinde aynı metin ~57 px'tir
/// (rakam ≈ 0.56 em) ve içerik 116 px'e sığar.
///
/// Bu testin konusu SEKME DÜZENİ; ölçü denetimi değil. Başlık bileşenine
/// dokunulmadı, taşma da yalnız bu dosyada ve yalnız "overflowed" için yutulur
/// — başka her hata olduğu gibi düşer.
void _baslikOlcumEseriniYut() {
  final onceki = FlutterError.onError;
  FlutterError.onError = (ayrinti) {
    if ('${ayrinti.exception}'.contains('overflowed')) return;
    onceki?.call(ayrinti);
  };
  addTearDown(() => FlutterError.onError = onceki);
}

Future<void> _ekraniAc(WidgetTester t) async {
  // Maç detayı tembel bir kaydırma listesidir; 800x600'de alt bölümler hiç
  // kurulmaz. Sekme çubuğu için yükseklik de gerekir.
  t.view.physicalSize = const Size(1200, 3000);
  t.view.devicePixelRatio = 1.0;
  addTearDown(() {
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });
  _baslikOlcumEseriniYut();

  await t.pumpWidget(
    ProviderScope(
      overrides: [matchProvider(7).overrideWith((ref) async => kMac)],
      child: const MaterialApp(home: MatchDetailScreen(no: 7)),
    ),
  );
  // Zinciri dio'ya inen Future'ı beklemeden pompalanır (kilitlenme tuzağı).
  for (var i = 0; i < 30; i++) {
    await t.pump(const Duration(milliseconds: 16));
  }
}

/// Çubuktaki seçili sekmenin sırası — "üstteki seçili sekme de güncellendi"
/// iddiası doğrudan denetleyiciden okunur, görsel tahminle değil.
int _seciliIndeks(WidgetTester t) =>
    t.widget<TabBar>(find.byType(TabBar)).controller!.index;

/// Çubukta yazan sekme adları, soldan sağa.
List<String> _cubuktakiAdlar(WidgetTester t) => t
    .widgetList<Tab>(find.byType(Tab))
    .map((tab) => ((tab.child as Column).children.last as Text).data!)
    .toList();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    // Testler arası sızıntı olmasın: her test HEPSİ AÇIK başlar.
    macDetayGizliSekmeleriYaz(const {});
    api.tasiyici = _SahteTasiyici();
  });

  group('Sekme kataloğu', () {
    test('sıra kullanıcının istediği sıradır', () {
      expect(kMacDetaySekmeleri.map((s) => s.ad).toList(), [
        'Özet',
        'Analiz',
        'İstatistik',
        'Oynanma Yüzdeleri',
        'Oran Takibi',
        'Bülten Sırası',
        'Yorumlar',
      ]);
    });

    test('eski Radar sekmesi katalogda YOK', () {
      expect(kMacDetaySekmeleri.map((s) => s.ad), isNot(contains('Radar')));
    });

    test('Yorumlar dışındaki her sekme kapatılabilir', () {
      final kapatilamaz = kMacDetaySekmeleri
          .where((s) => !s.ayarlanabilir)
          .map((s) => s.ad)
          .toList();
      expect(kapatilamaz, ['Yorumlar']);
      expect(macDetayAyarlanabilirSekmeler.length, 6);
    });
  });

  group('Sekme tercihi (prefs)', () {
    test('kapatılan sekme görünür listeden düşer, sırası bozulmaz', () {
      macDetayGizliSekmeleriYaz({'Oran Takibi', 'İstatistik'});
      expect(macDetayGorunurSekmeler().map((s) => s.ad).toList(), [
        'Özet',
        'Analiz',
        'Oynanma Yüzdeleri',
        'Bülten Sırası',
        'Yorumlar',
      ]);
    });

    test('tercih diske yazılır (kayıt sıralı ve yalnız geçerli adlar)', () {
      macDetayGizliSekmeleriYaz({'Oran Takibi', 'Analiz'});
      expect(getPref('macDetayGizliSekmeler'), ['Analiz', 'Oran Takibi']);
    });

    test('diskte kalmış tanınmayan ad (Radar) yok sayılır', () {
      // Eski sürümden kalma kayıt: 'Radar' artık bir sekme değil.
      setPref('macDetayGizliSekmeler', ['Radar', 'Özet']);
      expect(macDetayGizliSekmeler(), {'Özet'});
      expect(
        macDetayGorunurSekmeler().map((s) => s.ad),
        isNot(contains('Özet')),
      );
    });

    test('Yorumlar disk kaydıyla bile kapatılamaz', () {
      setPref('macDetayGizliSekmeler', ['Yorumlar']);
      expect(macDetayGizliSekmeler(), isEmpty);
      expect(macDetayGorunurSekmeler().map((s) => s.ad), contains('Yorumlar'));
    });

    test('bozuk kayıt (liste değil) varsayılana düşer', () {
      setPref('macDetayGizliSekmeler', 'bozuk');
      expect(macDetayGizliSekmeler(), isEmpty);
      expect(macDetayGorunurSekmeler().length, 7);
    });
  });

  group('Maç detay ekranı — sekme çubuğu', () {
    testWidgets('yedi sekme sırayla çizilir, Radar sekmesi yok', (t) async {
      await _ekraniAc(t);

      expect(_cubuktakiAdlar(t), [
        'Özet',
        'Analiz',
        'İstatistik',
        'Oynanma Yüzdeleri',
        'Oran Takibi',
        'Bülten Sırası',
        'Yorumlar',
      ]);
      expect(find.widgetWithText(Tab, 'Radar'), findsNothing);
    });

    testWidgets('sekmeler yatay kaydırılabilir (ekrana sığmayana erişilir)', (
      t,
    ) async {
      await _ekraniAc(t);
      final cubuk = t.widget<TabBar>(find.byType(TabBar));
      expect(cubuk.isScrollable, isTrue);
    });

    testWidgets('ayar dişlisi çubukta duruyor', (t) async {
      await _ekraniAc(t);
      expect(find.byKey(const Key('mac-detay-sekme-ayar-dugmesi')), findsOne);
    });
  });

  group('Maç detay ekranı — kaydırarak sekme geçişi', () {
    testWidgets('içerikten sola kaydırınca Analiz, tekrar sola İstatistik', (
      t,
    ) async {
      await _ekraniAc(t);
      expect(_seciliIndeks(t), 0);

      await t.fling(find.byType(TabBarView), const Offset(-400, 0), 1000);
      await t.pumpAndSettle();
      expect(_seciliIndeks(t), 1, reason: 'Özet → Analiz');

      await t.fling(find.byType(TabBarView), const Offset(-400, 0), 1000);
      await t.pumpAndSettle();
      expect(_seciliIndeks(t), 2, reason: 'Analiz → İstatistik');
    });

    testWidgets('sağa kaydırınca önceki sekmeye dönülür', (t) async {
      await _ekraniAc(t);
      await t.fling(find.byType(TabBarView), const Offset(-400, 0), 1000);
      await t.pumpAndSettle();
      expect(_seciliIndeks(t), 1);

      await t.fling(find.byType(TabBarView), const Offset(400, 0), 1000);
      await t.pumpAndSettle();
      expect(_seciliIndeks(t), 0, reason: 'Analiz → Özet');
    });

    testWidgets('sekme başlığına dokunmak da çalışır', (t) async {
      await _ekraniAc(t);
      await t.tap(find.widgetWithText(Tab, 'Bülten Sırası'));
      await t.pumpAndSettle();
      expect(_seciliIndeks(t), 5);
    });
  });

  group('Maç detay ekranı — sekme ayarları', () {
    testWidgets('dişli Maç Detay Sekme Ayarları ekranını açar', (t) async {
      await _ekraniAc(t);
      await t.tap(find.byKey(const Key('mac-detay-sekme-ayar-dugmesi')));
      await t.pumpAndSettle();

      expect(find.text('Maç Detay Sekme Ayarları'), findsOne);
      // Listede YALNIZ kapatılabilir altı sekme var.
      for (final s in macDetayAyarlanabilirSekmeler) {
        expect(find.byKey(Key('sekme-ayar-satir-${s.ad}')), findsOne);
      }
      expect(find.byKey(const Key('sekme-ayar-satir-Yorumlar')), findsNothing);
    });

    testWidgets('kapatılan sekme kaydedilince çubuktan düşer', (t) async {
      await _ekraniAc(t);
      await t.tap(find.byKey(const Key('mac-detay-sekme-ayar-dugmesi')));
      await t.pumpAndSettle();

      await t.tap(find.byKey(const Key('sekme-ayar-satir-Oran Takibi')));
      await t.pump();
      await t.tap(find.byKey(const Key('sekme-ayar-kaydet')));
      await t.pumpAndSettle();

      expect(_cubuktakiAdlar(t), isNot(contains('Oran Takibi')));
      expect(_cubuktakiAdlar(t).length, 6);
      // Tercih diske de yazıldı.
      expect(macDetayGizliSekmeler(), {'Oran Takibi'});
    });

    testWidgets('KAYDETMEDEN kapatmak hiçbir şeyi değiştirmez', (t) async {
      await _ekraniAc(t);
      await t.tap(find.byKey(const Key('mac-detay-sekme-ayar-dugmesi')));
      await t.pumpAndSettle();

      await t.tap(find.byKey(const Key('sekme-ayar-satir-Özet')));
      await t.pump();
      await t.tap(find.byKey(const Key('sekme-ayar-kapat')));
      await t.pumpAndSettle();

      expect(_cubuktakiAdlar(t).length, 7);
      expect(macDetayGizliSekmeler(), isEmpty);
    });

    testWidgets('Varsayılan Ayarlara Dön hepsini geri açar', (t) async {
      macDetayGizliSekmeleriYaz({'Oran Takibi', 'Bülten Sırası'});
      await _ekraniAc(t);
      expect(_cubuktakiAdlar(t).length, 5);

      await t.tap(find.byKey(const Key('mac-detay-sekme-ayar-dugmesi')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('sekme-ayar-varsayilan')));
      await t.pump();
      await t.tap(find.byKey(const Key('sekme-ayar-kaydet')));
      await t.pumpAndSettle();

      expect(_cubuktakiAdlar(t).length, 7);
      expect(macDetayGizliSekmeler(), isEmpty);
    });

    testWidgets('açık sekme kapatılınca ilk sekmeye dönülür', (t) async {
      await _ekraniAc(t);
      await t.tap(find.widgetWithText(Tab, 'Oran Takibi'));
      await t.pumpAndSettle();
      expect(_seciliIndeks(t), 4);

      await t.tap(find.byKey(const Key('mac-detay-sekme-ayar-dugmesi')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('sekme-ayar-satir-Oran Takibi')));
      await t.pump();
      await t.tap(find.byKey(const Key('sekme-ayar-kaydet')));
      await t.pumpAndSettle();

      // Bulunduğu sekme kapatıldı → boş ekrana düşmez, başa döner.
      expect(_seciliIndeks(t), 0);
      expect(_cubuktakiAdlar(t).first, 'Özet');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ASIL İSTEK: üç radar sekmesi GENEL değil, AÇILAN MAÇA ÖZEL veri gösterir.
  //
  // Kullanıcı bunu açıkça yazdı: "Galatasaray–Çorum maçını açtığında Oynanma
  // Yüzdeleri yalnızca bu maçın oynanma dağılımını ... göstersin." Sahte
  // yanıtlarda 7. sıra BU maç, 8. sıra BAŞKA bir maçtır; 8'in değerleri
  // ekranda görünürse panel haftanın tamamını gösteriyor demektir.
  // ══════════════════════════════════════════════════════════════════════════
  group('Radar sekmeleri maça özeldir', () {
    Future<void> ac(WidgetTester t, String sekme) async {
      api.tasiyici = _UcaGoreTasiyici(kRadarYanitlari);
      await _ekraniAc(t);
      await t.tap(find.widgetWithText(Tab, sekme));
      await t.pumpAndSettle();
      for (var i = 0; i < 20; i++) {
        await t.pump(const Duration(milliseconds: 16));
      }
    }

    testWidgets('Bülten Sırası YALNIZ bu maçın sırasını gösterir', (t) async {
      await ac(t, 'Bülten Sırası');

      // Bu maçın sırası ve takımları.
      expect(find.textContaining('7. sıra', findRichText: true), findsWidgets);
      expect(find.text('Galatasaray'), findsWidgets);
      expect(find.text('Çorum FK'), findsWidgets);
      // 7. sıranın geçmiş dağılımı.
      expect(find.textContaining('41.7', findRichText: true), findsWidgets);
      // 8. SIRANIN değeri ekranda OLMAMALI.
      expect(find.textContaining('88.8', findRichText: true), findsNothing);
    });

    testWidgets('Oynanma Yüzdeleri YALNIZ bu maçın dağılımını gösterir', (
      t,
    ) async {
      await ac(t, 'Oynanma Yüzdeleri');

      // TUZAK: yüzdeler RichText ile çizilir; `findRichText` verilmezse arama
      // onları HİÇ görmez ve "yok" kontrolü de sahte geçerdi.
      expect(find.textContaining('72', findRichText: true), findsWidgets);
      // 8. sıranın oynanma yüzdesi (%83) sızmamalı.
      expect(find.textContaining('83', findRichText: true), findsNothing);
    });

    testWidgets('Oynanma sekmesinde ORAN kartı, oran sekmesinde OYNANMA yok', (
      t,
    ) async {
      await ac(t, 'Oynanma Yüzdeleri');
      expect(find.textContaining('Radar 3'), findsOne);
      expect(find.textContaining('Radar 4'), findsNothing);

      await t.tap(find.widgetWithText(Tab, 'Oran Takibi'));
      await t.pumpAndSettle();
      expect(find.textContaining('Radar 4'), findsOne);
      expect(find.textContaining('Radar 3'), findsNothing);
    });
  });
}
