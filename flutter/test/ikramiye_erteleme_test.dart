// İKRAMİYE BÖLÜMÜ — ERTELENEN MAÇ AÇIKLAMASI (19 Ağustos 2026).
//
// Kullanıcı tıkanması: "tüm sonuçlar açıklanmasına rağmen 1. hafta hâlâ
// kesinleşmemiş" — ikramiye bölümü yalnız "tüm sonuçlar tamamlanınca
// görünecek" diyordu, NEDEN tamamlanmadığını söylemiyordu. Bekleyen maç
// ertelenmişse bölüm artık sebebi yazar; erteleme yoksa eski metin AYNEN
// kalır (yanlış alarm üretilmez).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/bulletin/prize_section.dart';

Widget _sar(Widget w) => MaterialApp(
  home: Scaffold(body: SingleChildScrollView(child: w)),
);

void main() {
  devirTestleri();
  testWidgets('bekleyen maç ertelenmişse SEBEP yazılır', (t) async {
    await t.pumpWidget(
      _sar(
        const PrizeSection(
          prize: null,
          resolvedCount: 14,
          totalM: 15,
          fullyResolved: false,
          ertelenenNolar: [15],
        ),
      ),
    );
    expect(find.textContaining('14/15'), findsOneWidget);
    expect(find.textContaining('15. maç ertelendi'), findsOneWidget);
    expect(
      find.textContaining('noter kararı girilince kesinleşecek'),
      findsOneWidget,
    );
  });

  testWidgets('erteleme yoksa açıklama EKLENMEZ — eski metin aynen', (t) async {
    await t.pumpWidget(
      _sar(
        const PrizeSection(
          prize: null,
          resolvedCount: 3,
          totalM: 15,
          fullyResolved: false,
        ),
      ),
    );
    expect(find.textContaining('3/15'), findsOneWidget);
    expect(find.textContaining('ertelendi'), findsNothing);
    expect(find.textContaining('noter'), findsNothing);
  });

  testWidgets('birden fazla erteleme sayıyla anlatılır', (t) async {
    await t.pumpWidget(
      _sar(
        const PrizeSection(
          prize: null,
          resolvedCount: 13,
          totalM: 15,
          fullyResolved: false,
          ertelenenNolar: [3, 15],
        ),
      ),
    );
    expect(find.textContaining('2 maç ertelendi'), findsOneWidget);
  });
}

// DEVİR SATIRI RESMÎ YAZIMLA (19 Ağustos 2026, kullanıcı bulgusu):
// sportoto.gov.tr "OLMADIĞINDAN 30.149.380,57 ₺ ÖNÜMÜZDEKİ HAFTAYA DEVRETTİ."
// yazarken bizde yalnız "0 ADET · Devretti" vardı — devreden tutar eldeyken
// gösterilmiyordu. Ekran resmî tabloyla birebir aynı bilgiyi taşımalı.
void devirTestleri() {
  testWidgets('devreden tutar resmî yazımla gösterilir', (t) async {
    await t.pumpWidget(
      _sar(
        const PrizeSection(
          prize: {
            'tiers': [
              {'hit': 15, 'count': 0, 'prize': 30149380.57},
              {'hit': 14, 'count': 8, 'prize': 2153527.18},
            ],
          },
          resolvedCount: 15,
          totalM: 15,
          fullyResolved: true,
        ),
      ),
    );
    expect(find.textContaining('OLMADIĞINDAN'), findsOneWidget);
    expect(
      find.textContaining('30.149.380,57 ₺ önümüzdeki haftaya devretti'),
      findsOneWidget,
    );
    expect(find.text('0 ADET'), findsNothing);
    // Normal kademe eski yazımında.
    expect(find.text('8 ADET'), findsOneWidget);
    expect(find.text('2.153.527,18 ₺'), findsOneWidget);
  });

  testWidgets('devir tutarı YOKSA kısa yazım kalır — tutar uydurulmaz', (
    t,
  ) async {
    await t.pumpWidget(
      _sar(
        const PrizeSection(
          prize: {
            'tiers': [
              {'hit': 15, 'count': 0, 'prize': null},
            ],
          },
          resolvedCount: 15,
          totalM: 15,
          fullyResolved: true,
        ),
      ),
    );
    expect(find.text('Devretti'), findsOneWidget);
    expect(find.textContaining('önümüzdeki haftaya'), findsNothing);
  });
}
