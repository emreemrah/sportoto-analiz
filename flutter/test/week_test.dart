// KAYNAK: app/src/weekSummary.js + app/src/weekRecap.js
//
// İKİ EKRANIN DÜRÜSTLÜK OMURGASI:
//
//   • Haftanın Özeti: aday UYDURULMAZ. Güçlü aday yoksa liste boş kalır;
//     başlamış maç aday olarak gösterilmez.
//   • Hafta Kapanışı: yalnız RESMÎ sonuç sayılır (result + score birlikte).
//     Karşılaştırma yalnız ikisinin de tahmin yaptığı maçlarda yapılır.
//
// İkincisi sessizce bozulursa canlı skor karneye sızar ve kullanıcı
// "resmî" sanır.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/week_recap.dart';
import 'package:masteranaliz/core/week_summary.dart';

Map _mac({
  required int no,
  String? label,
  num? favPercent,
  String favSymbol = '1',
  num? surprise,
  Map? probabilities,
  bool started = false,
  String? date,
}) => {
  'no': no,
  'started': started,
  'date': ?date,
  'home': {'name': 'Ev $no'},
  'away': {'name': 'Dep $no'},
  'analysis': {
    'label': ?label,
    'surpriseScore': ?surprise,
    'probabilities': ?probabilities,
    'favorite': favPercent == null
        ? null
        : {'symbol': favSymbol, 'percent': favPercent},
  },
};

void main() {
  group('Haftanın Özeti — aday seçimi', () {
    test('analizi olmayan maç HİÇ sayılmaz', () {
      final s = buildWeekSummary([
        {'no': 1},
        _mac(no: 2, label: 'BANKO', favPercent: 70),
      ]);
      expect(s.total, 1);
    });

    test('güçlü aday yoksa liste BOŞ — zorla doldurulmaz', () {
      final s = buildWeekSummary([_mac(no: 1, label: 'DENK', favPercent: 40)]);
      expect(s.strong, isEmpty);
      expect(s.surprises, isEmpty);
    });

    test('güçlü adaylar yüzdeye göre azalan sıralanır ve 3 ile sınırlıdır', () {
      final s = buildWeekSummary([
        _mac(no: 1, label: 'BANKO', favPercent: 62),
        _mac(no: 2, label: 'BANKO', favPercent: 81),
        _mac(no: 3, label: 'BANKO', favPercent: 74),
        _mac(no: 4, label: 'BANKO', favPercent: 55),
      ]);
      expect(s.strong.map((m) => m['no']).toList(), [2, 3, 1]);
    });

    test('sürpriz adayları skora göre azalan sıralanır', () {
      final s = buildWeekSummary([
        _mac(no: 1, label: 'SÜRPRİZE AÇIK', surprise: 40),
        _mac(no: 2, label: 'SÜRPRİZE AÇIK', surprise: 75),
      ]);
      expect(s.surprises.map((m) => m['no']).toList(), [2, 1]);
    });

    test('BAŞLAMIŞ maç aday listesine GİRMEZ ama sayılır', () {
      final s = buildWeekSummary([
        _mac(no: 1, label: 'BANKO', favPercent: 90, started: true),
        _mac(no: 2, label: 'BANKO', favPercent: 60),
      ]);
      expect(s.strong.map((m) => m['no']).toList(), [2]);
      expect(s.startedCount, 1);
      expect(s.total, 2);
    });

    test('geçmiş tarihli maç started bayrağı olmasa da başlamış sayılır', () {
      final s = buildWeekSummary([
        _mac(
          no: 1,
          label: 'BANKO',
          favPercent: 90,
          date: '2020-01-01T12:00:00',
        ),
      ], now: DateTime(2026, 8, 9).millisecondsSinceEpoch);
      expect(s.strong, isEmpty);
      expect(s.startedCount, 1);
    });

    test('favori yüzdesi yoksa güçlü aday sayılmaz', () {
      final s = buildWeekSummary([_mac(no: 1, label: 'BANKO')]);
      expect(s.strong, isEmpty);
    });
  });

  group('Haftanın Özeti — denk güç', () {
    test('tek ihtimal değeriyle "denk mi" DENMEZ', () {
      expect(
        topProbability({
          'analysis': {
            'probabilities': {'1': 60},
          },
        }),
        isNull,
      );
    });

    test('en yüksek ihtimal eşiğin altındaysa denk sayılır', () {
      final s = buildWeekSummary([
        _mac(no: 1, probabilities: {'1': 38, 'X': 33, '2': 29}),
        _mac(no: 2, probabilities: {'1': 62, 'X': 20, '2': 18}),
      ]);
      expect(s.balanced, 1);
      expect(s.balancedMatches.first['no'], 1);
    });

    test('sayı ile liste AYNI süzgeçten gelir', () {
      final s = buildWeekSummary([
        _mac(no: 1, probabilities: {'1': 30, 'X': 35, '2': 35}),
        _mac(no: 2, probabilities: {'1': 40, 'X': 30, '2': 30}),
      ]);
      expect(s.balanced, s.balancedMatches.length);
    });
  });

  group('Takım adı', () {
    test('uzundan kısaya düşer', () {
      expect(
        takimAdi({'mediumName': 'Galatasaray', 'name': 'GS'}),
        'Galatasaray',
      );
      expect(takimAdi({'shortName': 'GS', 'name': 'Galatasaray SK'}), 'GS');
      expect(takimAdi({'name': 'Galatasaray SK'}), 'Galatasaray SK');
    });

    test('hiçbiri yoksa eksiklik GÖSTERİLİR (boş bırakılmaz)', () {
      expect(takimAdi(null), '?');
      expect(takimAdi({}), '?');
      expect(matchLine(null), '? - ?');
    });
  });

  group('Hafta Kapanışı — resmî sonuç şartı', () {
    test('yalnız result VARSA yetmez, score da şart', () {
      expect(isOfficiallyResolved({'result': '1'}), isFalse);
      expect(
        isOfficiallyResolved({
          'score': {'home': 1, 'away': 0},
        }),
        isFalse,
      );
      expect(
        isOfficiallyResolved({
          'result': '1',
          'score': {'home': 1, 'away': 0},
        }),
        isTrue,
      );
    });

    test('tanınmayan sonuç değeri reddedilir', () {
      expect(
        isOfficiallyResolved({
          'result': 'ERTELENDİ',
          'score': {'home': 0, 'away': 0},
        }),
        isFalse,
      );
    });

    test("'0' resmî sonucu X'e çevrilir", () {
      expect(normResult('0'), 'X');
      expect(normResult('x'), 'X');
      expect(normResult('3'), isNull);
      expect(normResult(null), isNull);
    });

    test("sembol açma: '102' → 1/X/2, '-' → boş", () {
      expect(expandSymbol('102'), ['1', 'X', '2']);
      expect(expandSymbol('10'), ['1', 'X']);
      expect(expandSymbol('-'), isEmpty);
      expect(expandSymbol(null), isEmpty);
    });
  });

  group('Hafta Kapanışı — karne', () {
    List<Map> mac(List<({int no, String result, String sys})> l) => [
      for (final m in l)
        {
          'no': m.no,
          'home': 'Ev ${m.no}',
          'away': 'Dep ${m.no}',
          'result': m.result,
          'score': {'home': 1, 'away': 0},
          'prediction': {'symbol': m.sys},
        },
    ];

    test('sonuç yoksa karne ÜRETİLMEZ', () {
      final r = buildWeekRecap(
        matches: [
          {
            'no': 1,
            'prediction': {'symbol': '1'},
          },
        ],
      );
      expect(r.hasData, isFalse);
      expect(r.system, isNull);
      expect(r.user, isNull);
      expect(recapHeadline(r), contains('açıklandıkça'));
    });

    test('kupon yoksa kullanıcı karnesi UYDURULMAZ, sistem yine ölçülür', () {
      final r = buildWeekRecap(
        matches: mac([
          (no: 1, result: '1', sys: '1'),
          (no: 2, result: '2', sys: '1'),
        ]),
      );
      expect(r.user, isNull);
      expect(r.system!.made, 2);
      expect(r.system!.correct, 1);
      expect(r.system!.accuracy, 50);
      expect(r.head2head, isNull);
      // Kullanıcı yoksa sistemin ıskaları dürüstçe listelenir.
      expect(r.highlights.single.kind, 'system-missed');
    });

    test('adil karşılaştırma yalnız ORTAK maçlarda yapılır', () {
      final r = buildWeekRecap(
        matches: mac([
          (no: 1, result: '1', sys: '1'),
          (no: 2, result: '2', sys: '1'),
          (no: 3, result: 'X', sys: '-'), // sistem tahmini YOK
        ]),
        selections: [
          {
            'no': 1,
            'selectedOutcomes': ['1'],
          },
          {
            'no': 3,
            'selectedOutcomes': ['X'],
          },
        ],
      );
      // Kullanıcı 2 maçta tahmin yaptı ama ortak olan yalnız 1 numara.
      expect(r.user!.made, 2);
      expect(r.head2head!.matches, 1);
      expect(r.head2head!.user, 1);
      expect(r.head2head!.system, 1);
      expect(r.head2head!.winner, 'tie');
    });

    test('çoklu seçim tutarsa isabet sayılır', () {
      final r = buildWeekRecap(
        matches: mac([(no: 1, result: 'X', sys: '2')]),
        selections: [
          {
            'no': 1,
            'selectedOutcomes': ['1', '0'],
          }, // '0' → 'X'
        ],
      );
      expect(r.user!.correct, 1);
      expect(r.rows.single.user!.pick, '1-X');
      expect(r.system!.correct, 0);
      expect(r.highlights.single.kind, 'user-win');
    });

    test('öne çıkanlar sabit sırada gelir', () {
      final r = buildWeekRecap(
        matches: mac([
          (no: 1, result: '1', sys: '2'), // kullanıcı bilir → user-win
          (no: 2, result: '1', sys: '1'), // ikisi de bilir → listede YOK
          (no: 3, result: '1', sys: '2'), // ikisi de bilemez → both-missed
          (no: 4, result: '1', sys: '1'), // sistem bilir → system-win
        ]),
        selections: [
          {
            'no': 1,
            'selectedOutcomes': ['1'],
          },
          {
            'no': 2,
            'selectedOutcomes': ['1'],
          },
          {
            'no': 3,
            'selectedOutcomes': ['X'],
          },
          {
            'no': 4,
            'selectedOutcomes': ['2'],
          },
        ],
      );
      expect(r.highlights.map((h) => h.kind).toList(), [
        'user-win',
        'both-missed',
        'system-win',
      ]);
    });

    test('başlık: tamamlanmamış haftada kaç sonuç geldiği yazılır', () {
      final r = buildWeekRecap(
        matches: [
          ...mac([(no: 1, result: '1', sys: '1')]),
          {
            'no': 2,
            'prediction': {'symbol': '1'},
          },
        ],
        selections: [
          {
            'no': 1,
            'selectedOutcomes': ['1'],
          },
        ],
      );
      expect(r.official.complete, isFalse);
      expect(r.official.pending, 1);
      expect(recapHeadline(r), startsWith('1/2 resmî sonuç geldi'));
    });

    test('başlık: hafta kapandığında "Hafta kapandı" der', () {
      final r = buildWeekRecap(
        matches: mac([(no: 1, result: '1', sys: '1')]),
        selections: [
          {
            'no': 1,
            'selectedOutcomes': ['2'],
          },
        ],
      );
      expect(r.official.complete, isTrue);
      expect(recapHeadline(r), startsWith('Hafta kapandı — sistem önde'));
    });

    test('boş seçim listesi kullanıcı tahmini SAYILMAZ', () {
      final r = buildWeekRecap(
        matches: mac([(no: 1, result: '1', sys: '1')]),
        selections: [
          {'no': 1, 'selectedOutcomes': []},
        ],
      );
      expect(r.user, isNull);
    });
  });
}
