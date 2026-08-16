// RESMÎ İKRAMİYE AÇIKLAMASI ALINTI OLARAK GÖSTERİLİR.
//
// DENETİMDE ÖLÇÜLDÜ (16 Ağustos 2026): 53. Haftanın ikramiye bölümünde
// "Açıklamalar" satırında **İDDAA.COM** yazıyordu (`t20_oklar.png`).
// Kaynak: `/api/history/1527` → `prize.description` — metin RESMÎ Spor Toto
// duyurusudur, uçtan birebir gelir; uygulama kendi cümlesini kurmaz.
//
// İki proje kuralı çatışıyordu: "arayüzde marka adı yok" (yasal/mağaza) ile
// "resmî sonucu olduğu gibi göster". Metinden kelime ayıklamak resmî bir
// açıklamayı DEĞİŞTİRMEK olurdu.
//
// KULLANICI KARARI: metne dokunma, ALINTI olduğunu görünür kıl.
//
// Bu testler iki şeyi birden korur: (a) metin AYNEN kalır — sansür/uydurma
// yok, (b) kaynak ve alıntı işareti ekranda DURUR — marka, uygulamanın
// tanıtımı gibi okunamaz.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/bulletin/prize_section.dart';

const _resmiMetin =
    '15 BİLEN İŞTİRAKÇİLERİMİZ 40 TL KUPON BEDELİ KARŞILIĞINDA SANAL '
    'BAYİMİZDEN VE 800 TL KUPON KARŞILIĞINDA İDDAA.COM ÜZERİNDEN İKRAMİYE '
    'KAZANMIŞLARDIR.';

Future<void> _kur(WidgetTester t, {String? aciklama}) async {
  t.view.physicalSize = const Size(1200, 2400);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);

  await t.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: PrizeSection(
            prize: {
              'tiers': [
                {'hit': 15, 'count': 2, 'prize': 24120111.57},
              ],
              'closeDate': '2026-08-08T16:55:00',
              'description': ?aciklama,
            },
            resolvedCount: 15,
            totalM: 15,
            fullyResolved: true,
          ),
        ),
      ),
    ),
  );
  await t.pump();
}

void main() {
  testWidgets('resmî metin AYNEN gösterilir — kelime ayıklanmaz', (t) async {
    await _kur(t, aciklama: _resmiMetin);

    // Tırnak içinde ama metnin kendisi bozulmamış olmalı.
    final bulunan = t
        .widgetList<Text>(find.byType(Text))
        .map((w) => w.data ?? '')
        .firstWhere((s) => s.contains('İKRAMİYE KAZANMIŞLARDIR'), orElse: () => '');
    expect(bulunan, isNotEmpty, reason: 'resmî açıklama hiç çizilmemiş');
    expect(
      bulunan.contains('İDDAA.COM'),
      isTrue,
      reason: 'resmî metinden kelime ayıklanmış — bu, resmî açıklamayı '
          'değiştirmek olur',
    );
  });

  testWidgets('KAYNAK ve alıntı işareti ekranda durur', (t) async {
    await _kur(t, aciklama: _resmiMetin);

    expect(
      find.text('Spor Toto resmî açıklaması'),
      findsOneWidget,
      reason: 'kaynak yazılmazsa marka uygulamanın cümlesi gibi okunur',
    );
    expect(
      find.text('Metin resmî kaynaktan olduğu gibi aktarılmıştır.'),
      findsOneWidget,
    );

    final alinti = t
        .widgetList<Text>(find.byType(Text))
        .map((w) => w.data ?? '')
        .firstWhere((s) => s.contains('İKRAMİYE KAZANMIŞLARDIR'), orElse: () => '');
    expect(alinti.startsWith('“'), isTrue, reason: 'alıntı işareti yok');
    expect(alinti.endsWith('”'), isTrue);
  });

  testWidgets('açıklama YOKSA blok hiç çizilmez — uydurma yok', (t) async {
    await _kur(t);
    expect(find.text('Spor Toto resmî açıklaması'), findsNothing);
  });

  testWidgets('açıklama BOŞ dizgeyse blok çizilmez', (t) async {
    await _kur(t, aciklama: '');
    expect(find.text('Spor Toto resmî açıklaması'), findsNothing);
  });
}
