// KAYNAK: app/test/radar-odds-reason.test.mjs — çeviri + widget doğrulaması.
//
// RADAR 4 — EKSİK ORANIN SEBEBİ.
//
// Korunan davranış: oranı olmayan satır TEK jenerik cümle yazmaz, arka uçtan
// gelen KENDİ sebebini yazar. Sebep arka uçta üretilir — ekran sebep
// UYDURMAZ, oran da üretmez.
//
// Kaynak test yalnız METİN TARAMASIYDI ve kendi başlığında bile "kırılgan"
// diye uyarıyordu. Burada iki katman var:
//   * Kaynak taraması (yapısal kurallar: "sebep ekranda üretilmez" gibi
//     render ile ölçülemeyenler) — kaynaktaki KAYNAKLAR düzeni korunur:
//     blok başka dosyaya taşınırsa YALNIZ aşağıdaki harita güncellenir.
//   * Widget testleri (render ile ölçülebilenler: sayaç metni, boş satırın
//     sebep yazması, oran uydurmaması) — kaynakta bunlar test-ui'daydı;
//     Flutter'da doğrudan burada sınanır.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/radar/radar_day_rows.dart';
import 'package:masteranaliz/features/radar/radar_tab_headers.dart';

// Hangi blok hangi dosyada — taşıma olursa YALNIZ burası değişir.
final Map<String, String> kaynaklar = {
  'satirlar': _kodu(
    File('lib/features/radar/radar_day_rows.dart').readAsStringSync(),
  ),
  'basliklar': _kodu(
    File('lib/features/radar/radar_tab_headers.dart').readAsStringSync(),
  ),
};

String _kodu(String s) => s
    .replaceAll(RegExp(r'/\*[\s\S]*?\*/'), '')
    .replaceAll(RegExp(r'^\s*//.*$', multiLine: true), '');

/// Bir bloğun kaynağını SINIRLARIYLA al. Sabit uzunlukta dilim almak komşu
/// bloğa taşar ve testi yanlış yerden geçirir/düşürür.
String blokAl(String kaynak, String bas, String son) {
  final i = kaynak.indexOf(bas);
  expect(i, greaterThan(0), reason: '$bas bulunamadı');
  final j = kaynak.indexOf(son, i);
  expect(j, greaterThan(i), reason: '$son bulunamadı (blok sınırı)');
  return kaynak.substring(i, j);
}

String marketRow() =>
    blokAl(kaynaklar['satirlar']!, 'class MarketRow', 'class PublicRow');
String oddsCounter() =>
    blokAl(kaynaklar['basliklar']!, 'class OddsCounter', 'Widget _not');

Widget _sar(Widget w) => MaterialApp(
  home: Scaffold(body: SingleChildScrollView(child: w)),
);

void main() {
  group('kaynak taraması (render ile ölçülemeyen yapısal kurallar)', () {
    test('satır, arka uçtan gelen KENDİ sebebini yazar (notes → why)', () {
      final blok = marketRow();
      expect(
        blok,
        contains('notes[day]'),
        reason: 'sebep haritası satıra bağlanmamış',
      );
      expect(
        blok,
        contains("why?['text']"),
        reason: 'satır kendi sebebini yazmıyor',
      );
    });

    test('sebep arka uç yanıtından OKUNUR — ekranda üretilmez', () {
      final blok = marketRow();
      // notes doğrudan /daily-odds yanıtındaki maç kaydından gelmeli.
      expect(
        blok,
        contains("'notes'] as Map?) ?? const {}"),
        reason: 'notes doğrudan yanıttan okunmalı',
      );
      // Yerel sebep üretimi yasak: satırda sebep metni ÜRETEN bir dal olmamalı.
      expect(
        RegExp(
          'kapsam dışı|yayınlanmadı|mühür alınamadı',
          caseSensitive: false,
        ).hasMatch(blok),
        isFalse,
        reason: 'sebep metni ekranda üretiliyor — arka uçtan gelmeli',
      );
    });

    test(
      'REGRESYON: tek jenerik cümle TEK yol olamaz — yalnız yedek kalır',
      () {
        final blok = marketRow();
        const jenerik = 'Bu gün için oran kaydı yok';
        expect(
          blok,
          contains(jenerik),
          reason: 'eski sürüm arka uç için yedek cümle korunmalı',
        );
        final i = blok.indexOf(jenerik);
        final oncesi = blok.substring(i > 200 ? i - 200 : 0, i);
        expect(
          oncesi,
          contains("why?['text'] != null"),
          reason:
              'jenerik cümle ancak sebep YOKKEN yazılmalı (koşulsuz yazılırsa '
              'regresyon)',
        );
      },
    );

    test(
      'sayaç arka uçtaki gerçek sayıyı gösterir (withData / counts.total)',
      () {
        final blok = oddsCounter();
        expect(
          blok,
          contains("'total'"),
          reason: 'toplam maç sayısı arka uçtan okunmalı',
        );
        expect(
          blok,
          contains('withData'),
          reason: 'günlük dolu maç sayısı arka uçtan okunmalı',
        );
        expect(
          blok,
          contains('oran var'),
          reason: "sayaç metni (\"… maçın …'inde oran var\") yok",
        );
      },
    );

    test('sayaç Radar 4 başlığında çizilir, Radar 3 başlığında ÇİZİLMEZ', () {
      // Sınırlar KOD içindeki ⓘ özet dizgeleri: yorum temizleyicisinden
      // etkilenmezler ve iki dalı kesin ayırırlar.
      final b = kaynaklar['basliklar']!;
      final radar4 = blokAl(b, "'💹 Oran Takibi", "'📊 Oynanma DNA");
      expect(
        radar4,
        contains('OddsCounter('),
        reason: 'sayaç başlığa eklenmemiş',
      );
      final radar3 = blokAl(b, "'📊 Oynanma DNA", 'class RadarSekmePaneli');
      expect(
        radar3.contains('OddsCounter('),
        isFalse,
        reason: 'oran sayacı OYNANMA sekmesine sızmış — birimler karışır',
      );
    });

    test('sebep metinlerinde MARKA ADI yok (arayüz kuralı)', () {
      final blok = marketRow() + oddsCounter();
      expect(
        RegExp(
          'footystats|bilyoner|nesine|misli',
          caseSensitive: false,
        ).hasMatch(blok),
        isFalse,
        reason: 'Radar 4 satır/sayaç metninde marka adı var',
      );
    });
  });

  group('widget doğrulaması (render ile ölçülebilenler)', () {
    final gunler = [
      {'date': '2026-08-02', 'label': 'Pazar 02.08', 'weekday': 'Pazar'},
    ];

    testWidgets('sayaç: arka uç sayılarıyla "15 maçın 5\'inde oran var"', (
      t,
    ) async {
      await t.pumpWidget(
        _sar(
          OddsCounter(
            data: {
              'days': [
                {...gunler.first, 'withData': 5},
              ],
              'counts': {'total': 15},
              'matches': const [],
            },
            day: '2026-08-02',
          ),
        ),
      );
      expect(find.textContaining("15 maçın 5'inde oran var"), findsOneWidget);
      expect(
        find.textContaining('10 maçta yok (sebebi satırında yazıyor)'),
        findsOneWidget,
      );
    });

    testWidgets('sayaç: withData yoksa hücrelerden sayar, uydurmaz', (t) async {
      await t.pumpWidget(
        _sar(
          OddsCounter(
            data: {
              'days': gunler,
              'matches': [
                {
                  'no': 1,
                  'cells': {'2026-08-02': <String, Object?>{}},
                },
                {
                  'no': 2,
                  'cells': {'2026-08-02': <String, Object?>{}},
                },
                {'no': 3, 'cells': <String, Object?>{}},
              ],
            },
            day: '2026-08-02',
          ),
        ),
      );
      expect(find.textContaining("3 maçın 2'inde oran var"), findsOneWidget);
    });

    testWidgets('sayaç: maç yoksa hiç çizilmez (0/0 uydurulmaz)', (t) async {
      await t.pumpWidget(
        _sar(
          OddsCounter(
            data: {'days': gunler, 'matches': const []},
            day: '2026-08-02',
          ),
        ),
      );
      expect(find.textContaining('oran var'), findsNothing);
    });

    testWidgets('oranı olmayan satır: arka ucun SEBEBİNİ yazar, oran çizmez', (
      t,
    ) async {
      await t.pumpWidget(
        _sar(
          MarketRow(
            item: const {'no': 7, 'home': 'Ev', 'away': 'Konuk'},
            data: {
              'days': gunler,
              'matches': [
                {
                  'no': 7,
                  'cells': <String, Object?>{},
                  'notes': {
                    '2026-08-02': {
                      'text': 'Kaynak bu maçı listelemedi',
                      'detail': 'Maç kaynak bülteninde yok',
                    },
                  },
                },
              ],
            },
            day: '2026-08-02',
          ),
        ),
      );
      expect(
        find.textContaining('Kaynak bu maçı listelemedi'),
        findsOneWidget,
        reason: 'satır KENDİ sebebini yazmalı',
      );
      expect(find.textContaining('Maç kaynak bülteninde yok'), findsOneWidget);
      expect(
        find.byType(OddsTriple),
        findsNothing,
        reason: 'oranı olmayan satırda oran bileşeni çizilemez — uydurma riski',
      );
      expect(
        find.textContaining('Bu gün için oran kaydı yok'),
        findsNothing,
        reason: 'sebep varken jenerik cümleye düşülmez',
      );
    });

    testWidgets('sebep de yoksa (eski backend) jenerik yedek cümle yazar', (
      t,
    ) async {
      await t.pumpWidget(
        _sar(
          MarketRow(
            item: const {'no': 7, 'home': 'Ev', 'away': 'Konuk'},
            data: {
              'days': gunler,
              'matches': [
                {'no': 7, 'cells': <String, Object?>{}},
              ],
            },
            day: '2026-08-02',
          ),
        ),
      );
      expect(find.textContaining('Bu gün için oran kaydı yok'), findsOneWidget);
      expect(find.byType(OddsTriple), findsNothing);
    });
  });
}
