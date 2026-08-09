// KAYNAK: app/test/live-events.test.mjs — BİREBİR çeviri.
//
// CANLI OLAY ŞERİDİ + BASKI GÖSTERGESİ TESTLERİ (saf modül).
// Kural: uydurma dakika/uydurma baskı yok; veri yetersizse null/boş döner.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/live_events.dart';

const List<Map<String, Object?>> _events = [
  {
    'minute': 23,
    'type': 'Goal',
    'detail': 'Normal Goal',
    'side': 'home',
    'player': 'A',
  },
  {
    'minute': 41,
    'type': 'Card',
    'detail': 'Yellow Card',
    'side': 'away',
    'player': 'B',
  },
  {
    'minute': 12,
    'type': 'subst',
    'detail': 'Substitution 1',
    'side': 'home',
    'player': 'C',
  },
  {
    'minute': 67,
    'type': 'Card',
    'detail': 'Red Card',
    'side': 'away',
    'player': 'D',
  },
  {
    'minute': 90,
    'extra': 3,
    'type': 'Goal',
    'detail': 'Penalty',
    'side': 'away',
    'player': 'E',
  },
];

const List<Map<String, Object?>> _stats = [
  {'type': 'Ball Possession', 'home': '58%', 'away': '42%'},
  {'type': 'Total Shots', 'home': 12, 'away': 6},
  {'type': 'Shots on Goal', 'home': 5, 'away': 1},
  {'type': 'Fouls', 'home': 8, 'away': 11},
];

void main() {
  test('olaylar: normalize + dakikaya göre sıralanır', () {
    final evs = normalizeEvents(_events);
    expect([for (final e in evs) e.at], [12, 23, 41, 67, 93]);
    expect(evs[1].kind, 'goal');
    expect(evs[2].kind, 'yellow');
    expect(evs[3].kind, 'red');
    expect(evs[4].penalty, isTrue);
  });

  test('olaylar: dakikasız / tanınmayan olay ATILIR (uydurma dakika yok)', () {
    expect(
      normalizeEvent({'type': 'Goal', 'side': 'home'}),
      isNull,
      reason: 'dakika yoksa olay yok',
    );
    expect(
      normalizeEvent({'minute': 10, 'type': 'Whatever'}),
      isNull,
      reason: 'bilinmeyen tür atılır',
    );
    expect(normalizeEvent(null), isNull);
    expect(normalizeEvents(null), isEmpty);
  });

  test('olaylar: VAR ile iptal edilen gol GOL SAYILMAZ', () {
    expect(
      normalizeEvents([
        {
          'minute': 30,
          'type': 'Goal',
          'detail': 'Goal cancelled',
          'side': 'home',
        },
      ]),
      isEmpty,
    );
    expect(
      goalProgression([
        {
          'minute': 30,
          'type': 'Goal',
          'detail': 'Goal Disallowed',
          'side': 'home',
        },
      ]),
      isEmpty,
    );
  });

  test('şerit: yalnız gol ve kırmızı kart gösterilir', () {
    final marks = timelineMarkers(_events);
    expect([for (final m in marks) m.e.kind], ['goal', 'red', 'goal']);
    expect(
      marks.every((m) => m.pos >= 0 && m.pos <= 1),
      isTrue,
      reason: 'konum 0..1 arasında',
    );
    expect(timelineMarkers([]), isEmpty, reason: 'olay yoksa şerit yok');
  });

  test('şerit: uzatma dakikası taşmaz, 90+ sona oturur', () {
    expect(positionOf(45, 0), 0.5);
    expect(positionOf(0, 0), 0);
    expect(positionOf(120, 0), 1, reason: 'kap dışına taşmaz');
    final last = timelineMarkers(_events).last;
    expect(last.pos > 0.9 && last.pos <= 1, isTrue, reason: "90+3' sona yakın");
  });

  test('gol akışı: koşan skor doğru, kendi kalesine karşı takıma yazılır', () {
    final prog = goalProgression([
      {'minute': 10, 'type': 'Goal', 'detail': 'Normal Goal', 'side': 'home'},
      {'minute': 20, 'type': 'Goal', 'detail': 'Own Goal', 'side': 'home'},
      {'minute': 30, 'type': 'Goal', 'detail': 'Penalty', 'side': 'away'},
    ]);
    expect([for (final g in prog) '${g.home}-${g.away}'], [
      '1-0',
      '1-1',
      '1-2',
    ]);
    expect(prog[1].ownGoal, isTrue);
    expect(prog[1].side, 'away', reason: 'kendi kalesine gol rakibe yazılır');
    expect(prog[2].penalty, isTrue);
  });

  test('gol akışı: takımı belirsiz gol skora yazılmaz', () {
    expect(
      goalProgression([
        {'minute': 5, 'type': 'Goal', 'detail': 'Normal Goal'},
      ]),
      isEmpty,
    );
  });

  test('baskı: gerçek istatistiklerden pay hesaplanır, toplam 100', () {
    final pr = pressureIndex(_stats);
    expect(pr, isNotNull, reason: 'yeterli veri var');
    expect(pr!.home + pr.away, 100);
    expect(
      pr.home > 60,
      isTrue,
      reason: 'her ölçüde üstün takım baskıda görünür',
    );
    expect(pr.basis, contains('Şut'));
    expect(pr.basis, contains('Topla oynama'));
    expect(pr.basis, isNot(contains('Faul')), reason: 'faul baskı ölçüsü değil');
  });

  test('baskı: yetersiz veride GÖSTERGE ÜRETİLMEZ (uydurma yok)', () {
    expect(pressureIndex([]), isNull);
    expect(pressureIndex(null), isNull);
    expect(
      pressureIndex([
        {'type': 'Total Shots', 'home': 4, 'away': 2},
      ]),
      isNull,
      reason: 'tek ölçü yetmez',
    );
    expect(
      pressureIndex([
        {'type': 'Total Shots', 'home': null, 'away': 2},
        {'type': 'Corner Kicks', 'home': 3, 'away': null},
      ]),
      isNull,
      reason: 'eksik taraf sayılmaz',
    );
    expect(
      pressureIndex([
        {'type': 'Total Shots', 'home': 0, 'away': 0},
        {'type': 'Corner Kicks', 'home': 0, 'away': 0},
      ]),
      isNull,
      reason: '0-0 veri taşımaz',
    );
  });

  test('baskı: tek eksik ölçü diğerlerini bozmaz', () {
    final pr = pressureIndex([
      {'type': 'Total Shots', 'home': 10, 'away': 10},
      {'type': 'Corner Kicks', 'home': 5, 'away': 5},
      {'type': 'Shots on Goal', 'home': null, 'away': 3},
    ]);
    expect(pr!.home, 50);
    expect(pr.basis.length, 2);
  });

  test('istatistik sıralama: önemli satırlar üstte, bilinmeyen sona', () {
    final sorted = sortStats([
      {'type': 'Offsides'},
      {'type': 'Total Shots'},
      {'type': 'Bilinmeyen'},
      {'type': 'Ball Possession'},
    ]);
    expect([for (final s in sorted) s['type']], [
      'Ball Possession',
      'Total Shots',
      'Offsides',
      'Bilinmeyen',
    ]);
    expect(kRegMinutes, 90);
  });
}
