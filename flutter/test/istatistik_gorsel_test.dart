// İSTATİSTİK — GÖRSEL ÖZET (kullanıcı isteği, 2026-08-11).
//
// NE SABİTLENİYOR:
//  1. Kartlar AÇILAN MAÇIN İKİ TAKIMINA ait GERÇEK veriyi gösterir; sayılar
//     karne bölümüyle aynı fonksiyondan (`statsFromLog`) gelir.
//  2. Ev sahibi ile deplasman AYRIŞIR — iki kart aynı sayıları göstermez.
//  3. VERİSİ OLMAYAN ÇİZİLMEZ: maç logu boşsa kart yok; bir ölçümde iki
//     tarafın da değeri yoksa satır yok; hiç ölçüm yoksa bölüm yok.
//     (Bu, yeni sezonun ilk haftalarının gerçek durumudur — 2026-08-11'de
//     ölçüldü: 1. hafta maçlarında `matchLog` boş geliyor.)
//  4. Bilinmeyen yüzde "0" değil "—" yazılır.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/match_detail/istatistik_gorsel.dart';
import 'package:masteranaliz/features/match_detail/istatistik_tab.dart';

/// Ev sahibinin son 5 maçı: 3G 1B 1M · 2 maç 2.5 üst · 3 maç KG · 1 maç gol
/// yemedi. İçeride oynadığı 3 maç: 2G 1B 0M.
const List<Map<String, Object>> kEvLog = [
  {'result': 'G', 'gf': 2, 'ga': 0, 'isHome': true},
  {'result': 'G', 'gf': 3, 'ga': 1, 'isHome': false},
  {'result': 'B', 'gf': 1, 'ga': 1, 'isHome': true},
  {'result': 'M', 'gf': 0, 'ga': 2, 'isHome': false},
  {'result': 'G', 'gf': 2, 'ga': 2, 'isHome': true},
];

/// Deplasmanın son 5 maçı: 1G 1B 3M · 1 maç 2.5 üst (%20) · 1 maç KG (%20) ·
/// 2 maç gol yemedi (%40).
///
/// SAYILAR BİLEREK EV SAHİBİNDEN FARKLI: ilk kurguda iki takımın yüzdeleri
/// tesadüfen aynı çıkıyordu ve "ayrışıyor" testi, kart yanlış takımın
/// verisiyle beslenirken bile geçiyordu (bozma denemesinde yakalandı).
const List<Map<String, Object>> kDepLog = [
  {'result': 'M', 'gf': 0, 'ga': 1, 'isHome': true},
  {'result': 'M', 'gf': 0, 'ga': 2, 'isHome': false},
  {'result': 'M', 'gf': 1, 'ga': 2, 'isHome': true},
  {'result': 'B', 'gf': 0, 'ga': 0, 'isHome': false},
  {'result': 'G', 'gf': 1, 'ga': 0, 'isHome': false},
];

Map<String, dynamic> kMac({
  List? evLog,
  List? depLog,
  Map<String, Object>? evAvg,
  Map<String, Object>? depAvg,
}) => {
  'no': 7,
  'stats': {
    'home': {
      'matchLog': evLog ?? const [],
      'season': {'avg': evAvg ?? const <String, Object>{}},
    },
    'away': {
      'matchLog': depLog ?? const [],
      'season': {'avg': depAvg ?? const <String, Object>{}},
    },
  },
};

Future<void> _ac(WidgetTester t, Map<String, dynamic> m) async {
  t.view.physicalSize = const Size(1200, 3000);
  t.view.devicePixelRatio = 1.0;
  addTearDown(() {
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });

  await t.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: IstatistikTab(
            m: m,
            homeName: 'Galatasaray',
            awayName: 'Çorum FK',
          ),
        ),
      ),
    ),
  );
  await t.pump();
}

/// Yalnız form kartlarının içinde ara — aynı sayı karne tablosunda da geçiyor.
Finder _kartta(String metin) =>
    find.descendant(of: find.byType(FormKartlari), matching: find.text(metin));

void main() {
  group('Form kartları — açılan maçın gerçek verisi', () {
    testWidgets('ilk kart ev sahibinin son 5 maçını gösterir', (t) async {
      await _ac(t, kMac(evLog: kEvLog, depLog: kDepLog));

      expect(_kartta('Galatasaray · Son 5 Maç'), findsOne);
      expect(_kartta('5 maç'), findsOne);
      // 3G 1B 1M
      expect(_kartta('3'), findsOne);
      expect(_kartta('1'), findsNWidgets(2));
      // 2/5 = %40 · 3/5 = %60 · 1/5 = %20
      expect(_kartta('%40'), findsOne);
      expect(_kartta('%60'), findsOne);
      expect(_kartta('%20'), findsOne);
    });

    testWidgets('kaydırınca deplasmanın KENDİ verisi gelir (ayrışıyor)', (
      t,
    ) async {
      await _ac(t, kMac(evLog: kEvLog, depLog: kDepLog));

      // TUZAK: `drag` sayfa genişliğinin yarısını aşmazsa PageView geri döner
      // (test görünümü 1200 px geniş). Hızlı bir `fling` sayfayı gerçekten
      // çevirir.
      await t.fling(find.byType(PageView), const Offset(-600, 0), 1200);
      await t.pumpAndSettle();

      expect(_kartta('Çorum FK · Son 5 Maç'), findsOne);
      // 1G 1B 3M
      expect(_kartta('3'), findsOne);
      expect(_kartta('1'), findsNWidgets(2));
      // Deplasmanın KENDİ yüzdeleri: %20 üst · %20 KG · %40 gol yemedi.
      expect(_kartta('%20'), findsNWidgets(2));
      expect(_kartta('%40'), findsOne);
      // Ev sahibinin yüzdesi (%60 KG) bu kartta OLMAMALI — kart yanlış takımın
      // verisiyle beslenirse burada düşer.
      expect(_kartta('%60'), findsNothing);
      expect(_kartta('Galatasaray · Son 5 Maç'), findsNothing);
    });

    testWidgets('iç saha kesiti ayrı kart olarak var', (t) async {
      await _ac(t, kMac(evLog: kEvLog, depLog: kDepLog));
      // Dört kesit: ev son5, dep son5, ev iç saha, dep deplasman.
      expect(find.byType(PageView), findsOne);
      final pv = t.widget<PageView>(find.byType(PageView));
      expect(pv.childrenDelegate.estimatedChildCount, 4);
    });

    // ──────────────────────────────────────────────────────────────────────
    // ÇİZİM BEKÇİSİ: oranlı çubuk GERÇEKTEN çizilmeli.
    //
    // Yaşandı (2026-08-11): `Row` dikeyde varsayılan olarak merkezler ve
    // çocuksuz `ColoredBox`'a gevşek yükseklik verir; çubuklar SIFIR yükseklik
    // alıp hiç görünmedi. Metin arayan testler bunu göremez — sayılar
    // yerindeydi, yalnız çubuklar yoktu. Bu yüzden burada BOYUT ölçülür.
    // ──────────────────────────────────────────────────────────────────────
    testWidgets('G/B/M çubuğunun gerçek yüksekliği var', (t) async {
      await _ac(t, kMac(evLog: kEvLog, depLog: kDepLog));

      final cubuklar = find.descendant(
        of: find.byType(FormKartlari),
        matching: find.byType(ColoredBox),
      );
      expect(cubuklar, findsWidgets, reason: 'çubuk hiç çizilmemiş');

      final boyut = t.getSize(cubuklar.first);
      expect(boyut.height, greaterThan(0), reason: 'çubuk sıfır yükseklikte');
      expect(boyut.width, greaterThan(0));
    });

    testWidgets('maç logu boşsa kart HİÇ çizilmez', (t) async {
      await _ac(t, kMac());
      expect(find.byType(PageView), findsNothing);
    });

    testWidgets('yalnız bir takımın logu varsa yalnız onun kartı çizilir', (
      t,
    ) async {
      await _ac(t, kMac(evLog: kEvLog));
      final pv = t.widget<PageView>(find.byType(PageView));
      // Ev son5 + ev iç saha = 2 kart; deplasmanın hiç maçı yok.
      expect(pv.childrenDelegate.estimatedChildCount, 2);
      expect(_kartta('Çorum FK · Son 5 Maç'), findsNothing);
    });
  });

  group('Karşılaştırma çubukları — maç başına ortalamalar', () {
    testWidgets('iki takımın değerleri yan yana yazılır', (t) async {
      await _ac(
        t,
        kMac(
          evAvg: {'possession': 58, 'shots': 14.2, 'shotsOnTarget': 5},
          depAvg: {'possession': 42, 'shots': 9, 'shotsOnTarget': 3},
        ),
      );

      final bolum = find.byType(KarsilastirmaCubuklari);
      expect(bolum, findsOne);
      expect(
        find.descendant(of: bolum, matching: find.text('Topla Oynama')),
        findsOne,
      );
      expect(find.descendant(of: bolum, matching: find.text('%58')), findsOne);
      expect(find.descendant(of: bolum, matching: find.text('%42')), findsOne);
      expect(find.descendant(of: bolum, matching: find.text('14.2')), findsOne);
      expect(find.descendant(of: bolum, matching: find.text('9')), findsOne);
    });

    testWidgets('karşılaştırma çubuğunun gerçek yüksekliği var', (t) async {
      await _ac(t, kMac(evAvg: {'possession': 58}, depAvg: {'possession': 42}));

      final cubuklar = find.descendant(
        of: find.byType(KarsilastirmaCubuklari),
        matching: find.byType(ColoredBox),
      );
      expect(cubuklar, findsWidgets, reason: 'çubuk hiç çizilmemiş');
      expect(t.getSize(cubuklar.first).height, greaterThan(0));
    });

    testWidgets('değeri olmayan ölçümün satırı YOK', (t) async {
      await _ac(
        t,
        kMac(
          evAvg: {'possession': 58, 'fouls': 0},
          depAvg: {'possession': 42, 'fouls': 0},
        ),
      );

      final bolum = find.byType(KarsilastirmaCubuklari);
      expect(
        find.descendant(of: bolum, matching: find.text('Topla Oynama')),
        findsOne,
      );
      // Sıfır "veri yok" demektir; hiçbir takım maç başına 0 faul yapmaz.
      expect(
        find.descendant(of: bolum, matching: find.text('Faul')),
        findsNothing,
      );
    });

    testWidgets('tek taraflı veri "—" ile dürüstçe yazılır', (t) async {
      await _ac(t, kMac(evAvg: {'corners': 6.1}));

      final bolum = find.byType(KarsilastirmaCubuklari);
      expect(
        find.descendant(of: bolum, matching: find.text('Köşe Vuruşu')),
        findsOne,
      );
      expect(find.descendant(of: bolum, matching: find.text('6.1')), findsOne);
      expect(find.descendant(of: bolum, matching: find.text('—')), findsOne);
    });

    testWidgets('hiç ölçüm yoksa BÖLÜM çizilmez', (t) async {
      await _ac(t, kMac());
      expect(
        find.descendant(
          of: find.byType(KarsilastirmaCubuklari),
          matching: find.text('Topla Oynama'),
        ),
        findsNothing,
      );
    });
  });
}
