// KAYNAK: app/src/liveLogic.js davranışı.
//
// Bu testler projenin DÜRÜSTLÜK kurallarını koruyor:
//   • ✅/❌ yalnız canlı veya final durumda konur; başlamamış/ertelenmiş/
//     sonuç bekleyen maçta ⏳ kalır. Kesin olmayan bir şeye "tuttu/tutmadı"
//     demek, kullanıcının doğrulayamayacağı bir iddiadır.
//   • Tahmin yoksa iz bırakılmaz (Isaret.none) — boş tahmin "iska" sayılmaz.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/live_logic.dart';

void main() {
  group('expandPick', () {
    test('0 → X çevrilir, geçersiz karakter atılır', () {
      expect(expandPick('1'), ['1']);
      expect(expandPick('10'), ['1', 'X']);
      expect(expandPick('102'), ['1', 'X', '2']);
      expect(expandPick('02'), ['X', '2']);
    });

    test('boş / "-" → boş küme', () {
      expect(expandPick(null), isEmpty);
      expect(expandPick(''), isEmpty);
      expect(expandPick('-'), isEmpty);
    });
  });

  group('resultFromScore', () {
    test('skordan 1/X/2', () {
      expect(resultFromScore({'home': 2, 'away': 1}), '1');
      expect(resultFromScore({'home': 0, 'away': 3}), '2');
      expect(resultFromScore({'home': 1, 'away': 1}), 'X');
    });

    test('eksik skor → null (uydurulmaz)', () {
      expect(resultFromScore(null), isNull);
      expect(resultFromScore({'home': 1}), isNull);
      expect(resultFromScore({'home': null, 'away': null}), isNull);
    });
  });

  group('pickHits', () {
    test('isabet / iska', () {
      expect(pickHits('10', 'X'), isTrue);
      expect(pickHits('10', '2'), isFalse);
      expect(pickHits('1', '1'), isTrue);
    });

    test('tahmin ya da sonuç yoksa null — "iska" DEĞİL', () {
      expect(pickHits(null, '1'), isNull);
      expect(pickHits('-', '1'), isNull);
      expect(pickHits('1', null), isNull);
    });
  });

  group('deriveStatus', () {
    test('resmi durum kodu her şeyin önünde gelir', () {
      expect(
        deriveStatus({'liveStatus': 'PST', 'live': true}),
        MacDurum.postponed,
      );
      expect(
        deriveStatus({'liveStatus': 'CANC', 'finalized': true}),
        MacDurum.cancelled,
      );
      expect(deriveStatus({'liveStatus': 'SUSP'}), MacDurum.suspended);
    });

    test('final > canlı > başladı-sonuç-yok > başlamadı', () {
      expect(
        deriveStatus({'finalized': true, 'live': true}),
        MacDurum.finished,
      );
      expect(deriveStatus({'status': 'finished'}), MacDurum.finished);
      expect(deriveStatus({'live': true}), MacDurum.live);
      expect(deriveStatus({'started': true}), MacDurum.awaiting);
      expect(deriveStatus({}), MacDurum.notStarted);
    });

    test('maç saati geçmişse başlamış sayılır', () {
      final now = DateTime(2026, 8, 14, 22, 0);
      expect(
        deriveStatus({'date': '2026-08-14T21:30:00'}, now: now),
        MacDurum.awaiting,
      );
      expect(
        deriveStatus({'date': '2026-08-15T21:30:00'}, now: now),
        MacDurum.notStarted,
      );
    });
  });

  group('matchPicks — işaret kuralı', () {
    Map mac({
      String? sym,
      Map? score,
      bool live = false,
      bool finalized = false,
      String? liveStatus,
    }) => {
      if (sym != null) 'prediction': {'symbol': sym},
      // `?deger` = değer null ise girdi HİÇ eklenmez (null-aware element).
      'score': ?score,
      'live': live,
      'finalized': finalized,
      'liveStatus': ?liveStatus,
    };

    test('başlamamış maçta ⏳ — asla ✅/❌', () {
      final p = matchPicks(mac(sym: '1'));
      expect(p.system.mark, Isaret.pending);
      expect(p.scored, isFalse);
    });

    test('final maçta ✅ / ❌', () {
      final dogru = matchPicks(
        mac(sym: '1', score: {'home': 2, 'away': 0}, finalized: true),
      );
      expect(dogru.system.mark, Isaret.correct);
      expect(dogru.isFinal, isTrue);

      final yanlis = matchPicks(
        mac(sym: '1', score: {'home': 0, 'away': 2}, finalized: true),
      );
      expect(yanlis.system.mark, Isaret.wrong);
    });

    test('ertelenen maçta işaret konmaz (kesin değil)', () {
      final p = matchPicks(mac(sym: '1', liveStatus: 'PST'));
      expect(p.status, MacDurum.postponed);
      expect(p.system.mark, Isaret.pending);
    });

    test('tahmin "-" ise sembol yok, işaret yok', () {
      final p = matchPicks(
        mac(sym: '-', score: {'home': 1, 'away': 0}, finalized: true),
      );
      expect(p.system.sym, isNull);
      expect(p.system.mark, Isaret.none);
    });

    test('kullanıcı kuponu yoksa "iska" sayılmaz', () {
      final p = matchPicks(
        mac(sym: '1', score: {'home': 1, 'away': 0}, finalized: true),
      );
      expect(p.user.sym, isNull);
      expect(p.user.mark, Isaret.none);
    });
  });

  group('summaryCounts', () {
    test('risk yalnız CANLI maçta ve yalnız İSKA durumunda sayılır', () {
      final matches = [
        // canlı + sistem iska → systemRisk
        {
          'no': 1,
          'live': true,
          'score': {'home': 0, 'away': 2},
          'prediction': {'symbol': '1'},
        },
        // canlı + sistem isabet → risk yok
        {
          'no': 2,
          'live': true,
          'score': {'home': 2, 'away': 0},
          'prediction': {'symbol': '1'},
        },
        // bitmiş → risk sayılmaz
        {
          'no': 3,
          'finalized': true,
          'score': {'home': 0, 'away': 1},
          'prediction': {'symbol': '1'},
        },
        {'no': 4},
      ];

      final s = summaryCounts(matches, {1: '1', 2: '1'});
      expect(s.live, 2);
      expect(s.finished, 1);
      expect(s.notStarted, 1);
      expect(s.systemRisk, 1);
      expect(s.couponRisk, 1);
    });
  });
}
