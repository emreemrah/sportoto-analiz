// BÖLÜM BAŞLIĞI SAYAÇLA ÇELİŞMEZ.
//
// GERÇEKTE YAŞANDI (16 Ağustos 2026, emülatörde ölçüldü — `t9_c_ana.png`):
// hero kartındaki sayaç **"Öne Çıkan 0"** yazarken hemen altındaki bölüm
// **"Öne Çıkan Analizler"** başlığıyla iki kart gösteriyordu. Aynı ekranda
// sayaç **"Sürpriz Adayı 0"** iken şerit **"Sürpriz İhtimali Yüksek"**
// diyordu.
//
// Sebep: sayaçlar eşiğe bakıyordu (`_oneCikanEsik` 45, `_surprizEsik` 65),
// bölümler ise eşiğe BAKMADAN en yüksek 2-3 maçı basıyordu. Kartların kendi
// etiketi ("DENGELİ") dürüsttü; yalan söyleyen BAŞLIKTI.
//
// Bu testler ekranı gerçekten çizip başlıkla sayacın birlikte hareket ettiğini
// doğrular.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masteranaliz/features/bulletin/bulletin_providers.dart';
import 'package:masteranaliz/features/home/home_screen.dart';

/// Verilen sürpriz puanlarıyla bir bülten üretir. `null` = analiz YOK.
Map<String, dynamic> _bulten(List<double?> puanlar) => {
  'roundId': 'r2',
  'round': '2. Hafta',
  'matches': [
    for (var i = 0; i < puanlar.length; i++)
      {
        'no': i + 1,
        'date': '2026-08-21T21:30:00',
        'league': 'Süper Lig',
        'status': 'notstarted',
        'home': {'name': 'Ev $i'},
        'away': {'name': 'Dep $i'},
        if (puanlar[i] != null)
          'analysis': {'surpriseScore': puanlar[i]},
      },
  ],
};

Future<void> _ekraniKur(WidgetTester t, Map<String, dynamic> data) async {
  // Ana sayfa uzun bir `ListView`; sürpriz şeridi varsayılan 800×600 test
  // yüzeyinin ALTINDA kalıyor ve tembel liste onu hiç kurmuyordu. Yüzey
  // sayfanın tamamını alacak kadar büyütülür.
  t.view.physicalSize = const Size(1200, 4000);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);

  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/bulten', builder: (_, _) => const SizedBox()),
      GoRoute(path: '/radar', builder: (_, _) => const SizedBox()),
    ],
  );
  await t.pumpWidget(
    ProviderScope(
      overrides: [bulletinProvider.overrideWith((ref) async => data)],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await t.pump(); // sağlayıcı çözülsün
  await t.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('eşiği geçen YOKKEN başlık "öne çıkan" DEMEZ', (t) async {
    // Hepsi eşiğin (45) altında → sayaç 0 gösterir.
    await _ekraniKur(t, _bulten([30, 25, 10]));

    expect(find.text('Öne Çıkan Analizler'), findsNothing,
        reason: 'sayaç 0 iken başlık hâlâ "öne çıkan" diyor');
    expect(find.text('Analiz Edilen Maçlar'), findsOneWidget);
  });

  testWidgets('eşiği geçen VARKEN başlık "Öne Çıkan Analizler" olur', (t) async {
    await _ekraniKur(t, _bulten([70, 25, 10]));
    expect(find.text('Öne Çıkan Analizler'), findsOneWidget);
    expect(find.text('Analiz Edilen Maçlar'), findsNothing);
  });

  testWidgets('hiç analiz yokken başlık "Bültenden Maçlar" olur', (t) async {
    await _ekraniKur(t, _bulten([null, null, null]));
    expect(find.text('Bültenden Maçlar'), findsOneWidget);
    expect(find.text('Öne Çıkan Analizler'), findsNothing);
    expect(find.text('Analiz Edilen Maçlar'), findsNothing);
  });

  testWidgets('sürpriz eşiği (65) geçilmeden "Sürpriz İhtimali Yüksek" DENMEZ',
      (t) async {
    // 50 → öne çıkan eşiğini (45) geçer ama sürpriz eşiğini (65) geçmez.
    await _ekraniKur(t, _bulten([50, 20, 10]));
    expect(find.text('Sürpriz İhtimali Yüksek'), findsNothing,
        reason: 'sürpriz sayacı 0 iken şerit "ihtimali yüksek" diyor');
    expect(find.text('Sürpriz Puanına Göre Sıralı'), findsOneWidget);
  });

  testWidgets('sürpriz eşiği geçilince şerit "Sürpriz İhtimali Yüksek" olur',
      (t) async {
    await _ekraniKur(t, _bulten([80, 20, 10]));
    expect(find.text('Sürpriz İhtimali Yüksek'), findsOneWidget);
  });

  testWidgets('hiç analiz yokken sürpriz şeridi MAÇ DİZMEZ, bekleme yazar',
      (t) async {
    await _ekraniKur(t, _bulten([null, null, null]));
    expect(find.text('Sürpriz analizi için veri bekleniyor.'), findsOneWidget,
        reason: 'analiz yokken maçlar sürpriz sıralaması gibi gösteriliyor');
  });
}
