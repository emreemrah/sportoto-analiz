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
