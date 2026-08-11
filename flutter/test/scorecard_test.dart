// KAYNAK: app/src/scorecardLogic.js + app/src/calibrationLogic.js
//
// BU TESTLER UYGULAMANIN EN SERT İKİ İDDİA KURALINI KORUYOR:
//
//   1. VARSAYILAN REDDET — resmî ileri-test kanıtı YOKSA hiçbir başarı
//      gösterilmez. Eski/demo/backfill kayıtlar "sistem başarısı" diye
//      görünemez.
//   2. BECERİ DÜRÜSTLÜĞÜ — negatif beceri gizlenmez, güven aralığı söylenen
//      değeri kapsıyorsa "sapma" DENMEZ ("ayırt edilemiyor" denir).
//
// Birincisi sessizce bozulursa uygulama kanıtsız bir başarı oranı yayınlar.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/calibration_logic.dart';
import 'package:masteranaliz/core/scorecard_logic.dart';

void main() {
  group('Resmî karne kapısı — VARSAYILAN REDDET', () {
    test('alan yoksa GÖSTERME', () {
      expect(hasOfficialData(null), isFalse);
      expect(hasOfficialData({}), isFalse);
      expect(hasOfficialData({'hasData': true}), isFalse);
    });

    test('demo veri resmî sayılmaz', () {
      expect(
        hasOfficialData({
          'hasData': true,
          'hasOfficialForwardData': true,
          'isDemo': true,
        }),
        isFalse,
      );
    });

    test('üç koşul birden sağlanınca gösterilir', () {
      expect(
        hasOfficialData({
          'hasData': true,
          'hasOfficialForwardData': true,
        }),
        isTrue,
      );
    });

    test('kanıt yoksa başlık ÜRETİLMEZ', () {
      expect(officialHeadline({'hasData': true}), isNull);
    });

    test('başlık yalnız tekli ana tahmin alanlarını okur', () {
      final h = officialHeadline({
        'hasData': true,
        'hasOfficialForwardData': true,
        'weeksCounted': 4,
        'total': 60,
        'correct': 33,
        'wrong': 27,
        'accuracy': 55,
        // KAPSAMA alanları — başlıkta GÖRÜNMEMELİ.
        'coverageAccuracy': 88,
        'coverageCorrect': 53,
      })!;
      expect(h.total, 60);
      expect(h.correct, 33);
      expect(h.accuracy, 55);
      // Kapsama sayısı hiçbir alana sızmadı.
      expect(h.correct, isNot(53));
      expect(h.accuracy, isNot(88));
    });
  });

  group('Hafta etiketi', () {
    test('kısmi hafta TAM hafta gibi sunulmaz', () {
      expect(
        weekRecordLabel({'status': 'partial', 'correct': 9, 'evaluated': 13}),
        '9/13 · kısmi',
      );
      expect(
        weekRecordLabel({'status': 'complete', 'correct': 9, 'evaluated': 15}),
        '9/15',
      );
    });

    test('sonuçlanmamış hafta sayı GÖSTERMEZ', () {
      expect(
        weekRecordLabel({'status': 'pending', 'correct': 0, 'evaluated': 0}),
        'Sonuç bekleniyor',
      );
    });
  });

  group('Eski kayıt koruması', () {
    test('legacy radar rozeti HER DURUMDA null', () {
      expect(legacyRadarBadge(), isNull);
    });

    test('kanıt alanı olmayan kriter karnesi kullanılmaz', () {
      expect(criteriaBadgeUsable({'hasData': true}), isFalse);
      expect(
        criteriaBadgeUsable({
          'hasData': true,
          'provenanceType': 'backfill',
        }),
        isFalse,
      );
      expect(
        criteriaBadgeUsable({
          'hasData': true,
          'provenanceType': 'official_forward',
        }),
        isTrue,
      );
    });

    test('demo modu varsayılan olarak KAPALI', () {
      expect(demoAllowed(), isFalse);
      expect(demoAllowed(demoMode: true), isTrue);
    });
  });

  group('Beceri metni — negatif sonuç GİZLENMEZ', () {
    test('sıfıra yakın beceri "ayırt edilemiyor" der', () {
      final s = skillText(0.002)!;
      expect(s.yon, 'esit');
      expect(s.metin, 'Piyasadan ayırt edilemiyor');
      expect(s.tone, 'neutral');
    });

    test('pozitif beceri yüzde puanıyla yazılır', () {
      final s = skillText(0.012)!;
      expect(s.puan, 1.2);
      expect(s.metin, 'Piyasadan %1.2 daha iyi');
    });

    test('NEGATİF beceri açıkça "daha kötü" yazılır', () {
      final s = skillText(-0.023)!;
      expect(s.yon, 'kotu');
      expect(s.metin, contains('daha kötü'));
      expect(s.tone, 'danger');
    });

    test('veri yoksa cümle üretilmez', () {
      expect(skillText(null), isNull);
      expect(skillText(double.nan), isNull);
      expect(skillText('x'), isNull);
    });
  });

  group('Kalibrasyon kapısı', () {
    test('örneklem yoksa rapor GÖSTERİLMEZ', () {
      expect(hasCalibrationData(null), isFalse);
      expect(hasCalibrationData({'hasData': true}), isFalse);
      expect(
        hasCalibrationData({
          'hasData': true,
          'model': {'n': 0},
        }),
        isFalse,
      );
      expect(
        hasCalibrationData({
          'hasData': true,
          'model': {'n': 12},
        }),
        isTrue,
      );
    });

    test('piyasa referansı yoksa DÜRÜSTÇE işaretlenir', () {
      final h = calibrationHeadline({
        'hasData': true,
        'model': {'n': 40},
      })!;
      expect(h.marketMissing, isTrue);
      expect(h.vsMarket, isNull);
    });
  });

  group('Model=piyasa uyarısı', () {
    test('pay yoksa uyarı çıkmaz', () {
      expect(marketDerivedNotice(null), isNull);
      expect(marketDerivedNotice({'marketDerived': {'share': 0}}), isNull);
    });

    test('tam pay "tamamı" der, kısmi pay yüzdeyi yazar', () {
      expect(
        marketDerivedNotice({'marketDerived': {'share': 100}})!.title,
        'Olasılıkların tamamı orandan türüyor',
      );
      expect(
        marketDerivedNotice({'marketDerived': {'share': 62}})!.title,
        contains('%62'),
      );
    });

    test('uyarı metni "başarısızlık değildir" der', () {
      final n = marketDerivedNotice({'marketDerived': {'share': 80}})!;
      expect(n.body, contains('başarısızlık'));
      expect(n.body, contains('tanım gereği'));
    });
  });

  group('Bağımsız sınav — küçük örneklemde iddia YOK', () {
    test('30 altında "güvenilir değildir" denir', () {
      final t = independentTestText({
        'estimatedOnly': {'n': 12, 'logLoss': 1.02},
      })!;
      expect(t.reliable, isFalse);
      expect(t.body, contains('güvenilir değildir'));
    });

    test('30 ve üstünde ölçüm sunulur', () {
      final t = independentTestText({
        'estimatedOnly': {'n': 45, 'logLoss': 0.98},
        'uniform': {'logLoss': 1.0986},
      })!;
      expect(t.reliable, isTrue);
      expect(t.body, contains('log-loss 0.98'));
      expect(t.body, contains('1.0986'));
    });

    test('veri yoksa bölüm hiç çizilmez', () {
      expect(independentTestText(null), isNull);
      expect(independentTestText({'estimatedOnly': {'n': 0}}), isNull);
    });
  });

  group('Skor tablosu', () {
    test('veri gelmeyen referans satırı UYDURULMAZ, atlanır', () {
      final rows = scoreRows({
        'hasData': true,
        'model': {'n': 40, 'logLoss': 1.01},
        'uniform': {'logLoss': 1.0986},
      });
      // Piyasa ve lig tabanı gelmedi → satırları hiç çizilmez. Boş bir satır
      // ya da "0" göstermek, ölçülmemiş bir referansı ölçülmüş gibi sunardı.
      expect(rows.map((r) => r.ad), ['Model', 'Rastgele (1/3)']);
    });

    test('piyasa verisi geldiğinde satır görünür', () {
      final rows = scoreRows({
        'hasData': true,
        'model': {'n': 40, 'logLoss': 1.01},
        'market': {'n': 40, 'logLoss': 0.99},
        'baseline': {'n': 40, 'logLoss': 1.05},
        'uniform': {'logLoss': 1.0986},
      });
      expect(rows.map((r) => r.ad), [
        'Model',
        'Piyasa (oran)',
        'Lig taban oranı',
        'Rastgele (1/3)',
      ]);
    });

    test('rastgele referans satırı model örneklemini kullanır', () {
      final rows = scoreRows({
        'hasData': true,
        'model': {'n': 40, 'logLoss': 1.01},
        'uniform': {'logLoss': 1.0986},
      });
      final rastgele = rows.last;
      expect(rastgele.n, 40);
      expect(rastgele.not, 'referans');
    });
  });

  group('Kalibrasyon eğrisi — KURAL 3', () {
    test('aralık söylenen değeri kapsıyorsa "sapma" DENMEZ', () {
      final rows = curveRows({
        'curve': {
          'bins': [
            {
              'saidPct': 60,
              'actualPct': 61,
              'n': 25,
              'distinguishable': false,
            },
          ],
        },
      });
      expect(rows.single['durum'], 'ayirt-edilemiyor');
      expect(rows.single['durumMetni'], 'Söylenen değerden ayırt edilemiyor');
    });

    test('ayrışan kutu "sapma" olarak işaretlenir', () {
      final rows = curveRows({
        'curve': {
          'bins': [
            {'saidPct': 70, 'actualPct': 48, 'n': 60, 'distinguishable': true},
          ],
        },
      });
      expect(rows.single['durum'], 'sapma');
    });

    test('her satırda n bulunur (KURAL 2)', () {
      final rows = curveRows({
        'curve': {
          'bins': [
            {'saidPct': 60, 'actualPct': 61, 'n': 25},
          ],
        },
      });
      expect(rows.single['n'], 25);
      expect(rows.single['metin'], contains('25 durumun'));
    });

    test('yetersiz gözlemde eğri çizilmez, sebep yazılır', () {
      expect(curveRows({'curve': {'insufficient': true}}), isEmpty);
      expect(
        curveUnavailableText({
          'curve': {'insufficient': true, 'note': 'En az 100 gözlem gerekir.'},
        }),
        'En az 100 gözlem gerekir.',
      );
      expect(curveUnavailableText(null), isNotNull);
    });
  });
}
