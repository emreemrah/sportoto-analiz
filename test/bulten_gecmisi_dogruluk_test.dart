// BÜLTEN GEÇMİŞİ — SİSTEM BAŞARISI DÜRÜSTLÜK TESTLERİ.
//
// TEK ÖLÇÜ KARARI (2026-08-11, kullanıcı): kullanıcıya görünen sistem
// başarısı HER YERDE tekli mühürlü ana tahmindir (backend karnesiyle aynı
// kural: mainPrediction × resmî 1/X/2). Çoklu kupon önerisinin kapsaması
// AYRI bir ölçüdür ve başarı yüzdesi olarak sunulmaz.
//
// Bu dosya iki şeyi sabitler:
//  1. mapSnapshot, tekli ana tahmini ve onun doğruluğunu AYRI alanlarda
//     üretir; kupon kapsaması (systemCorrect) ile karışmaz.
//  2. ResultComparisonCard üç durumu ayırır: bekliyor (⏳) · değerlendirilmedi
//     (–) · doğru (✓) / yanlış (✗). "Ana tahmin yok" ASLA ✗ basmaz —
//     emülatörde 53. Hafta 3. maçta (Arsenal–Dortmund) yakalanan gerçek
//     kusurun gerilemesini engeller.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/services/archive_mappers.dart';
import 'package:masteranaliz/features/bulletin_history/history_widgets.dart';

/// Mühürlü snapshot yükünün gerçek şekli (backend /api/bulletins/:id/snapshot):
/// analysisCenter.officialMasterAnalysis.mainPrediction TEKLİ tahmindir,
/// systemPrediction.display ise ÇOKLU olabilen kupon önerisidir.
Map<String, Object?> _snapMac(
  int no, {
  String? anaTahmin,
  String? kuponOnerisi,
}) => {
  'matchId': 'm$no',
  'no': no,
  'systemPrediction': {'display': kuponOnerisi},
  'analysisCenter': {
    'officialMasterAnalysis': {'ok': true, 'mainPrediction': anaTahmin},
  },
};

void main() {
  group('mapSnapshot — tekli ana tahmin ile kupon kapsaması AYRI', () {
    test(
      'ana tahmin tutarsa anaTahminCorrect true; kupon önerisi karışmaz',
      () {
        final snap = mapSnapshot(
          {
            'id': 's1',
            'bulletinId': 1,
            'payload': {
              'matches': [
                // Kupon önerisi '10' sonucu kapsar (kapsama DOĞRU) ama tekli
                // ana tahmin '2' TUTMAZ — iki ölçü burada AYRIŞIR.
                _snapMac(1, anaTahmin: '2', kuponOnerisi: '10'),
              ],
            },
          },
          resultsByMatchId: {
            'm1': {'officialResult': '1'},
          },
        );
        final m = (snap!['matchesAnalysis'] as List).first as Map;
        expect(m['anaTahmin'], '2');
        expect((m['resultInfo'] as Map)['anaTahminCorrect'], isFalse);
        // Kupon kapsaması ayrı alanda ve DOĞRU — silinmedi, karıştırılmadı.
        expect((m['resultInfo'] as Map)['systemCorrect'], isTrue);
      },
    );

    test('mühürde tekli ana tahmin YOKSA maç değerlendirilmez (null)', () {
      final snap = mapSnapshot(
        {
          'id': 's1',
          'bulletinId': 1,
          'payload': {
            'matches': [_snapMac(3, anaTahmin: null, kuponOnerisi: '102')],
          },
        },
        resultsByMatchId: {
          'm3': {'officialResult': '2'},
        },
      );
      final m = (snap!['matchesAnalysis'] as List).first as Map;
      expect(m['anaTahmin'], isNull);
      // "yanlış" DEĞİL — değerlendirilmemiş.
      expect((m['resultInfo'] as Map)['anaTahminCorrect'], isNull);
    });

    test('resmî sonuç gelmediyse ana tahmin doğruluğu üretilmez', () {
      final snap = mapSnapshot({
        'id': 's1',
        'bulletinId': 1,
        'payload': {
          'matches': [_snapMac(1, anaTahmin: '1', kuponOnerisi: '1')],
        },
      });
      final m = (snap!['matchesAnalysis'] as List).first as Map;
      expect(m['resultInfo'], isNull);
    });
  });

  group('ResultComparisonCard — üç durum ayrı', () {
    Future<void> kartiCiz(WidgetTester t, {bool? isCorrect, String? sonuc}) =>
        t.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: ResultComparisonCard(
                orderNo: 3,
                homeTeam: 'Arsenal',
                awayTeam: 'Borussia Dortmund',
                systemPick: null,
                actualResult: sonuc,
                isCorrect: isCorrect,
              ),
            ),
          ),
        );

    testWidgets('sonuç YOK → bekliyor işareti', (t) async {
      await kartiCiz(t, isCorrect: null, sonuc: null);
      expect(find.text('⏳'), findsOneWidget);
    });

    testWidgets('sonuç VAR ama değerlendirilmedi → tire, ÇARPI DEĞİL', (
      t,
    ) async {
      await kartiCiz(t, isCorrect: null, sonuc: '2');
      // Tahmin sütunu da boşken tire basar; asıl sözleşme ÇARPI OLMAMASI ve
      // işaret hücresinde tire bulunması.
      expect(find.text('–'), findsWidgets);
      expect(find.text('✗'), findsNothing);
      expect(find.text('✓'), findsNothing);
    });

    testWidgets('doğru → tik · yanlış → çarpı', (t) async {
      await kartiCiz(t, isCorrect: true, sonuc: '2');
      expect(find.text('✓'), findsOneWidget);
      await kartiCiz(t, isCorrect: false, sonuc: '2');
      expect(find.text('✗'), findsOneWidget);
    });
  });
}
