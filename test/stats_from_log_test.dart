// KAYNAK: app/src/analysis/criteria.js → statsFromLog / derivedStats
//
// Korudukları kural: MAÇ LOGU YOKSA null DÖNER. Ekran bu null'ı görüp resmî
// sezon karnesine geri düşer ve filtreleri gizler. Buraya 0 döndürmek,
// "0 maç oynandı" gibi UYDURMA bir bilgi üretirdi.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/analysis/stats_from_log.dart';

Map _mac({
  required String result,
  required int gf,
  required int ga,
  required bool isHome,
  String? oppTier,
}) =>
    {
      'result': result,
      'gf': gf,
      'ga': ga,
      'isHome': isHome,
      'oppTier': ?oppTier,
    };

void main() {
  group('statsFromLog', () {
    test('maç logu yoksa null — sıfır UYDURULMAZ', () {
      expect(statsFromLog(null, const StatFiltre(), 'home'), isNull);
      expect(statsFromLog({}, const StatFiltre(), 'home'), isNull);
      expect(
        statsFromLog({'matchLog': 'bozuk'}, const StatFiltre(), 'home'),
        isNull,
      );
    });

    test('boş log → n:0 (log VAR ama kesitte maç yok)', () {
      final s = statsFromLog({'matchLog': []}, const StatFiltre(), 'home');
      expect(s, isNotNull);
      expect(s!.n, 0);
      // Oran alanları hesaplanmaz — bölme sıfıra yapılmaz.
      expect(s.ppg, isNull);
    });

    test('temel toplama: G/B/M, puan, gol, yüzdeler', () {
      final team = {
        'matchLog': [
          _mac(result: 'G', gf: 2, ga: 0, isHome: true), // cs
          _mac(result: 'B', gf: 1, ga: 1, isHome: false), // btts
          _mac(result: 'M', gf: 0, ga: 3, isHome: true), // fts + over
          _mac(result: 'G', gf: 3, ga: 1, isHome: false), // btts + over
        ],
      };
      final s = statsFromLog(team, const StatFiltre(), 'home')!;

      expect(s.n, 4);
      expect(s.w, 2);
      expect(s.d, 1);
      expect(s.l, 1);
      expect(s.ppg, 1.75); // (3+1+0+3)/4
      expect(s.gfPg, 1.5); // 6/4
      expect(s.gaPg, 1.25); // 5/4
      expect(s.csPct, 25); // 1/4
      expect(s.ftsPct, 25); // 1/4
      expect(s.bttsPct, 50); // 2/4 → 2. ve 4. maç
      // 2.5 üst = toplam gol ≥ 3. Maçlar: 2-0(2), 1-1(2), 0-3(3✓), 3-1(4✓)
      // → 2/4. (İlk yazımda 75 yazmıştım; sayım hatasıydı, testi düzelttim.)
      expect(s.overPct, 50);
    });

    test('dönem kesiti: son N maç LOGUN BAŞINDAN alınır', () {
      final team = {
        'matchLog': [
          _mac(result: 'G', gf: 1, ga: 0, isHome: true),
          _mac(result: 'G', gf: 1, ga: 0, isHome: true),
          _mac(result: 'M', gf: 0, ga: 1, isHome: true),
          _mac(result: 'M', gf: 0, ga: 1, isHome: true),
          _mac(result: 'M', gf: 0, ga: 1, isHome: true),
          _mac(result: 'M', gf: 0, ga: 1, isHome: true),
        ],
      };
      final tumu = statsFromLog(team, const StatFiltre(), 'home')!;
      expect(tumu.n, 6);
      expect(tumu.w, 2);

      final son5 =
          statsFromLog(team, const StatFiltre(period: 'last5'), 'home')!;
      expect(son5.n, 5);
      expect(son5.w, 2); // ilk iki galibiyet kesitin içinde
    });

    test('saha süzgeci: split → ev takımı içeride, deplasman dışarıda', () {
      final team = {
        'matchLog': [
          _mac(result: 'G', gf: 2, ga: 0, isHome: true),
          _mac(result: 'M', gf: 0, ga: 2, isHome: false),
        ],
      };

      final evTarafi =
          statsFromLog(team, const StatFiltre(venueScope: 'split'), 'home')!;
      expect(evTarafi.n, 1);
      expect(evTarafi.w, 1);

      final depTarafi =
          statsFromLog(team, const StatFiltre(venueScope: 'split'), 'away')!;
      expect(depTarafi.n, 1);
      expect(depTarafi.l, 1);

      // 'home' seçilirse İKİ takım için de iç saha kesiti kullanılır.
      final ikisiDeIcerde =
          statsFromLog(team, const StatFiltre(venueScope: 'home'), 'away')!;
      expect(ikisiDeIcerde.n, 1);
      expect(ikisiDeIcerde.w, 1);
    });
  });

  group('derivedStats — veri yoksa null, sıfır uydurulmaz', () {
    test('xG/şut yoksa ilgili alanlar null', () {
      final d = derivedStats({'season': {}});
      expect(d.finishing, isNull);
      expect(d.defEff, isNull);
      expect(d.shotAcc, isNull);
      expect(d.goalsPerShot, isNull);
    });

    test('sıfır değer "veri yok" sayılır (0/0 hesaplanmaz)', () {
      final d = derivedStats({
        'season': {'goalsPerGame': 0, 'xgFor': 0},
      });
      expect(d.finishing, isNull);
    });

    test('gerçek değerlerle formüller', () {
      final d = derivedStats({
        'season': {
          'goalsPerGame': 1.5,
          'xgFor': 1.2,
          'concededPerGame': 1.0,
          'xgAgainst': 1.25,
          'avg': {'shots': 10.0, 'shotsOnTarget': 4.0},
        },
      });
      expect(d.finishing, 1.25); // 1.5 / 1.2
      expect(d.defEff, 0.8); // 1.0 / 1.25
      expect(d.shotAcc, 40); // 4/10
      expect(d.goalsPerShot, 0.15); // 1.5/10
    });

    test('momentum en az 6 maç ister; seriler baştan sayılır', () {
      final log = [
        _mac(result: 'G', gf: 2, ga: 0, isHome: true),
        _mac(result: 'G', gf: 1, ga: 0, isHome: false),
        _mac(result: 'B', gf: 1, ga: 1, isHome: true),
        _mac(result: 'M', gf: 0, ga: 1, isHome: false),
        _mac(result: 'M', gf: 0, ga: 2, isHome: true),
      ];
      final az = derivedStats({'matchLog': log});
      expect(az.momentum, isNull, reason: '5 maç < 6 → hesaplanmaz');
      expect(az.winRun, 2); // baştan iki galibiyet
      expect(az.unbeatenRun, 3); // G, G, B
      expect(az.csRun, 2); // ilk iki maç gol yemedi
      expect(az.bttsRun, 0); // ilk maç KG yok

      final cok = derivedStats({
        'matchLog': [...log, _mac(result: 'G', gf: 3, ga: 1, isHome: true)],
      });
      expect(cok.momentum, isNotNull, reason: '6 maç → hesaplanır');
    });

    test('venueGap her sahada en az 3 maç ister', () {
      final az = derivedStats({
        'matchLog': [
          _mac(result: 'G', gf: 1, ga: 0, isHome: true),
          _mac(result: 'G', gf: 1, ga: 0, isHome: true),
          _mac(result: 'M', gf: 0, ga: 1, isHome: false),
        ],
      });
      expect(az.venueGap, isNull);
    });

    test('weightedLast5 sınıfı bilinen en az 3 maç ister', () {
      final az = derivedStats({
        'matchLog': [
          _mac(result: 'G', gf: 1, ga: 0, isHome: true, oppTier: 'strong'),
          _mac(result: 'G', gf: 1, ga: 0, isHome: true, oppTier: 'mid'),
          _mac(result: 'G', gf: 1, ga: 0, isHome: true), // sınıfsız
        ],
      });
      expect(az.weightedLast5, isNull);

      final yeter = derivedStats({
        'matchLog': [
          _mac(result: 'G', gf: 1, ga: 0, isHome: true, oppTier: 'strong'),
          _mac(result: 'G', gf: 1, ga: 0, isHome: true, oppTier: 'mid'),
          _mac(result: 'B', gf: 1, ga: 1, isHome: true, oppTier: 'weak'),
        ],
      });
      // 3×1.5 + 3×1 + 1×0.5 = 8
      expect(yeter.weightedLast5, 8);
    });
  });
}
