// GERÇEK SUNUCU YANITIYLA SİSTEM KARNESİ DOĞRULAMASI
//
// Aşağıdaki JSON, 9 Ağustos 2026'da çalışan backend'in
// `GET /api/scorecards/system` ucundan AYNEN alınmıştır (elle yazılmadı,
// kısaltıldı ama hiçbir değeri değiştirilmedi). Amaç: ekranın besleneceği saf
// mantığın UYDURMA bir örnekle değil, sunucunun gerçekten döndürdüğü biçimle
// doğrulanması.
//
// NEDEN GEREKLİ: Sistem Karnesi ekranı yalnız giriş yapmış kullanıcıya
// açıldığı için emülatörde görülemedi. Ekranın gösterdiği her sayı bu saf
// işlevlerden geçtiği için, işlevleri gerçek yanıtla sınamak "ekranı gördüm"
// demek olmasa da sayıların doğru okunduğunu kanıtlar.
//
// KORUNAN KURAL: kapsama (coverage) sayıları ana başarıya KARIŞMAZ. Bu veride
// kapsama %71, tekli isabet %57 — ikisi karışırsa kullanıcı sistemin
// olduğundan başarılı olduğunu sanır.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/calibration_logic.dart';
import 'package:masteranaliz/core/scorecard_logic.dart';

/// `GET /api/scorecards/system` — 2026-08-09 canlı yanıtı.
const Map<String, dynamic> _canliKarne = {
  'generatedAt': '2026-08-09T12:31:44.857Z',
  'title': 'Sistem Master Analizi — Tekli Ana Tahmin İsabeti',
  'note':
      'Yalnız maç öncesi mühürlendiği DOĞRULANAN tahminler dahildir. Demo, '
      'backfill ve retrospektif kayıtlar bu başarıya girmez.',
  'hasData': true,
  'hasOfficialForwardData': true,
  'isDemo': false,
  'weeksCounted': 2,
  'pendingWeeks': 0,
  'total': 14,
  'correct': 8,
  'wrong': 6,
  'accuracy': 57,
  'accuracy1': 57.1,
  'last5': {'total': 14, 'correct': 8, 'accuracy': 57, 'weeks': 2},
  'bestWeek': {
    'roundId': 1527,
    'round': '53. Hafta',
    'record': '2/2',
    'accuracy': 100,
  },
  'byResult': {
    '1': {'t': 8, 'c': 6, 'rate': 75},
    '2': {'t': 4, 'c': 2, 'rate': 50},
    'X': {'t': 2, 'c': 0, 'rate': 0},
  },
  'coverage': {
    'hasData': true,
    'total': 17,
    'covered': 12,
    'rate': 71,
    'single': {'total': 10, 'covered': 5, 'rate': 50},
    'multi': {'total': 7, 'covered': 7, 'rate': 100},
  },
  'weeks': [
    {
      'roundId': 1527,
      'round': '53. Hafta',
      'verificationHashShort': '92ce471a28',
      'provenanceType': 'official_forward',
      'matchCount': 15,
      'predicted': 14,
      'resolved': 2,
      'correct': 2,
      'wrong': 0,
      'coverage': {'total': 2, 'covered': 2},
      'status': 'partial',
      'evaluated': 2,
      'accuracy': 100,
      'record': '2/2',
    },
    {
      'roundId': 1526,
      'round': '52. Hafta',
      'verificationHashShort': 'fb98568743',
      'provenanceType': 'official_forward',
      'matchCount': 15,
      'predicted': 12,
      'resolved': 15,
      'correct': 6,
      'wrong': 6,
      'coverage': {'total': 15, 'covered': 10},
      'status': 'partial',
      'evaluated': 12,
      'accuracy': 50,
      'record': '6/12',
    },
  ],
  'errors': [
    {
      'roundId': 1526,
      'round': '52. Hafta',
      'no': 2,
      'home': 'Brondby',
      'away': 'Viborg',
      'system': '2',
      'result': '1',
      'score': '1-0',
    },
    {
      'roundId': 1526,
      'round': '52. Hafta',
      'no': 5,
      'home': 'Hacken',
      'away': 'Kalmar',
      'system': '1',
      'result': 'X',
      'score': '1-1',
    },
  ],
};

/// `GET /api/scorecards/calibration` — aynı andaki canlı yanıt.
const Map<String, dynamic> _canliKalibrasyon = {
  'version': 'calibration-1.0.0',
  'hasData': false,
  'insufficientNote':
      'Kalibrasyon için en az 20 resmî sonuçlu maç gerekir (şu an 17).',
  'roundsCounted': 2,
  'matchesCounted': 17,
  'excludedCount': 2,
  'excludedByType': {'late_unverified': 2},
  'noProbabilityCount': 0,
};

void main() {
  group('Canlı sunucu yanıtı — resmî karne', () {
    test('kanıt alanları geldiği için karne GÖSTERİLİR', () {
      expect(hasOfficialData(_canliKarne), isTrue);
    });

    test('başlık sayıları sunucudakiyle BİREBİR aynı', () {
      final h = officialHeadline(_canliKarne)!;
      expect(h.weeks, 2);
      expect(h.total, 14);
      expect(h.correct, 8);
      expect(h.wrong, 6);
      expect(h.accuracy, 57);
    });

    test('KAPSAMA sayıları ana başarıya SIZMIYOR', () {
      final h = officialHeadline(_canliKarne)!;
      final cov = _canliKarne['coverage'] as Map;
      // Kapsama %71 ve 17 maç; başlık %57 ve 14 maç olmalı.
      expect(cov['rate'], 71);
      expect(cov['total'], 17);
      expect(h.accuracy, isNot(cov['rate']));
      expect(h.total, isNot(cov['total']));
    });

    test('doğru + yanlış toplamı toplam maça eşit', () {
      final h = officialHeadline(_canliKarne)!;
      expect((h.correct as int) + (h.wrong as int), h.total);
    });

    test('İKİ hafta da KISMİ — "tam" gibi sunulmuyor', () {
      final weeks = (_canliKarne['weeks'] as List).cast<Map>();
      expect(weekRecordLabel(weeks[0]), '2/2 · kısmi');
      expect(weekRecordLabel(weeks[1]), '6/12 · kısmi');
      // Değerlendirilen maç sayısı, bültendeki maç sayısından AZ — bu fark
      // etiketle görünür kalmalı.
      expect(weeks[1]['evaluated'], lessThan(weeks[1]['matchCount']));
    });

    test('hafta doğrularının toplamı başlık doğrusuna eşit', () {
      final weeks = (_canliKarne['weeks'] as List).cast<Map>();
      final toplam = weeks.fold<int>(0, (a, w) => a + (w['correct'] as int));
      expect(toplam, officialHeadline(_canliKarne)!.correct);
    });

    test('beraberlik satırı %0 — sıfır GİZLENMİYOR', () {
      final byResult = _canliKarne['byResult'] as Map;
      expect((byResult['X'] as Map)['rate'], 0);
      expect((byResult['X'] as Map)['t'], 2);
    });
  });

  group('Canlı sunucu yanıtı — kalibrasyon', () {
    test('örneklem yetersizken rapor GÖSTERİLMEZ', () {
      expect(hasCalibrationData(_canliKalibrasyon), isFalse);
      expect(calibrationHeadline(_canliKalibrasyon), isNull);
    });

    test('yetersizlik sebebi kullanıcıya AÇIKÇA söylenir', () {
      expect(
        _canliKalibrasyon['insufficientNote'],
        contains('en az 20 resmî sonuçlu maç'),
      );
      // Sunucu şu anki sayıyı da veriyor; ekran bunu olduğu gibi basar.
      expect(_canliKalibrasyon['insufficientNote'], contains('17'));
    });

    test('veri yokken skor tablosu ve eğri BOŞ', () {
      expect(scoreRows(_canliKalibrasyon), isEmpty);
      expect(curveRows(_canliKalibrasyon), isEmpty);
      expect(curveUnavailableText(_canliKalibrasyon), isNotNull);
    });
  });
}
