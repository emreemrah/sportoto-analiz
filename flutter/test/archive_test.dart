// KAYNAK: app/src/services/archiveMappers.js + archiveClient.js + types/bulletin.js
//
// Bu testler arşiv katmanının İKİ DÜRÜSTLÜK KURALINI koruyor:
//
//   1. Veri yoksa null döner — sahte yüzde/sonuç ÜRETİLMEZ.
//   2. Sonuç gelmemiş maç "yanlış" sayılmaz (systemCorrect = null).
//
// İkincisi sessizce bozulursa sistem başarısı YAPAY olarak düşer ve kullanıcı
// olmayan bir başarısızlığı görür.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/services/archive_client.dart';
import 'package:masteranaliz/core/services/archive_mappers.dart';
import 'package:masteranaliz/core/types/bulletin.dart';

void main() {
  group('Çoklu tercih açma', () {
    test('1X2 gösterimi tek tek sembollere açılır', () {
      expect(expandDisplayPick('1X2'), ['1', 'X', '2']);
      expect(expandDisplayPick('1X'), ['1', 'X']);
      expect(expandDisplayPick('2'), ['2']);
    });

    test('geçersiz karakterler atılır, boş girdi boş liste', () {
      expect(expandDisplayPick('1a2'), ['1', '2']);
      expect(expandDisplayPick(''), isEmpty);
      expect(expandDisplayPick(null), isEmpty);
    });

    test('çoklu tercih, resmî sonuç içindeyse TUTAR', () {
      expect(displayPickHits('1X', '1'), isTrue);
      expect(displayPickHits('1X', 'X'), isTrue);
      expect(displayPickHits('1X', '2'), isFalse);
    });

    test('veri eksikse null — "tutmadı" DEMEZ', () {
      expect(displayPickHits('1X', null), isNull);
      expect(displayPickHits(null, '1'), isNull);
      expect(displayPickHits('', '1'), isNull);
    });
  });

  group('İstatistik özeti', () {
    test('veri yoksa null — uydurma cümle kurulmaz', () {
      expect(buildStatsSummary(null), isNull);
      expect(buildStatsSummary({}), isNull);
      expect(buildStatsSummary({'teamData': {}}), isNull);
      // Boş form dizisi de "veri yok" sayılır.
      expect(
        buildStatsSummary({
          'teamData': {
            'home': {'last5': []},
            'away': {'last5': []},
          },
        }),
        isNull,
      );
    });

    test('var olan parçalar birleştirilir', () {
      final s = buildStatsSummary({
        'teamData': {
          'home': {
            'last5': ['G', 'B', 'G'],
            'standing': {'position': 3},
          },
          'away': {
            'last5': ['M', 'M'],
            'standing': {'position': 11},
          },
        },
        'market': {
          'probabilities': {'1': 55, 'X': 25, '2': 20},
        },
      });
      expect(s, contains('Ev son 5: G B G'));
      expect(s, contains('Dep son 5: M M'));
      expect(s, contains('Sıra: 3. vs 11.'));
      expect(s, contains('İhtimal 1/X/2: %55/%25/%20'));
    });

    test('tahminî ihtimal AÇIKÇA işaretlenir', () {
      final s = buildStatsSummary({
        'market': {
          'probabilities': {'1': 40, 'X': 30, '2': 30},
          'probabilitiesEstimated': true,
        },
      });
      expect(s, contains('(tahminî)'));
    });

    test('yalnız bir takımın sırası varsa sıra satırı YAZILMAZ', () {
      final s = buildStatsSummary({
        'teamData': {
          'home': {
            'standing': {'position': 3},
          },
          'away': {'standing': {}},
        },
      });
      expect(s, isNull);
    });
  });

  group('Bülten özeti eşlemesi', () {
    test('sezon+hafta yoksa roundId numarası kullanılır', () {
      final b = mapBulletinSummary({'id': 5, 'roundId': 1528});
      expect(b['bulletinNo'], '#1528');
      final b2 = mapBulletinSummary({
        'id': 5,
        'roundId': 1528,
        'season': '2026/27',
        'week': '27. Hafta',
      });
      expect(b2['bulletinNo'], '2026/27 · 27. Hafta');
    });

    test('sonuç özeti yoksa null — %0 UYDURULMAZ', () {
      final b = mapBulletinSummary({'id': 5, 'roundId': 1528});
      expect(b['resultSummary'], isNull);
    });

    test('yanlış sayısı tahmin edilen − doğru', () {
      final b = mapBulletinSummary({
        'id': 5,
        'roundId': 1528,
        'totalMatches': 15,
        'resultSummary': {
          'correct': 9,
          'predicted': 13,
          'accuracy': 69,
          'totalMatches': 15,
        },
      });
      final rs = b['resultSummary'] as Map;
      expect(rs['systemCorrect'], 9);
      expect(rs['systemWrong'], 4);
      expect(rs['resolvedCount'], 13);
      expect(rs['totalCount'], 15);
    });

    test('maç adedi kadar yer tutucu satır üretilir', () {
      final b = mapBulletinSummary({
        'id': 5,
        'roundId': 1528,
        'totalMatches': 15,
      });
      expect((b['matches'] as List).length, 15);
      expect((b['matches'] as List).first, {'id': '5-m1', 'orderNo': 1});
    });
  });

  group('Bülten detayı eşlemesi', () {
    test('resmî sonucu olmayan maç "not_started" ve sonuç alanları null', () {
      final d = mapBulletinDetail({
        'id': 1528,
        'roundId': 1528,
        'matches': [
          {
            'matchId': 77,
            'orderNo': 3,
            'homeName': 'A',
            'awayName': 'B',
            'league': 'Süper Lig',
            'kickoffAt': '2026-08-15T19:00:00',
          },
        ],
      });
      final m = (d['matches'] as List).first as Map;
      expect(m['status'], 'not_started');
      expect(m['result1x2'], isNull);
      expect(m['fullTimeScore'], isNull);
      expect(m['code'], '1528-03');
      expect(d['_finishedCount'], 0);
    });

    test('ilk yarı skoru HER ZAMAN null (yeni motor okumaz)', () {
      final d = mapBulletinDetail({
        'id': 1528,
        'roundId': 1528,
        'matches': [
          {
            'matchId': 77,
            'orderNo': 1,
            'halfTimeScore': '1-0', // API gönderse bile OKUNMAZ
            'official': {'result': '1', 'fullTimeScore': '2-0'},
          },
        ],
      });
      final m = (d['matches'] as List).first as Map;
      expect(m['halfTimeScore'], isNull);
      expect(m['fullTimeScore'], '2-0');
      expect(m['status'], 'finished');
      expect(d['_finishedCount'], 1);
    });
  });

  group('Mühürlü analiz eşlemesi', () {
    Map ornekSnap({Object? display = '1', Map? official}) => {
      'id': 'snap-1528',
      'bulletinId': 1528,
      'verificationHash': 'abcdef0123456789',
      'payload': {
        'matches': [
          {
            'matchId': 77,
            'no': 1,
            'systemPrediction': {'display': display, 'label': 'GÜÇLÜ ADAY'},
            'confidence': {'favoritePercent': 61, 'dataConfidence': 'Orta'},
          },
        ],
        'lock': ?official,
      },
    };

    test('payload yoksa null döner', () {
      expect(mapSnapshot(null), isNull);
      expect(mapSnapshot({'id': 'x'}), isNull);
    });

    test('sonuç yoksa resultInfo null — maç "yanlış" SAYILMAZ', () {
      final s = mapSnapshot(ornekSnap())!;
      final m = (s['matchesAnalysis'] as List).first as Map;
      expect(m['resultInfo'], isNull);
    });

    test('sunucu değerlendirmesi varsa ONUN kararı esastır', () {
      final s = mapSnapshot(
        ornekSnap(),
        evalByMatchId: {
          '77': {'correct': true, 'officialResult': '2', 'fullTimeScore': '0-1'},
        },
      )!;
      final ri = ((s['matchesAnalysis'] as List).first as Map)['resultInfo']
          as Map;
      // Yerel karşılaştırma '1' vs '2' → yanlış derdi; sunucu "doğru" dedi.
      expect(ri['systemCorrect'], isTrue);
    });

    test('değerlendirme yoksa yerel karşılaştırma yapılır', () {
      final s = mapSnapshot(
        ornekSnap(display: '1X'),
        resultsByMatchId: {
          '77': {'officialResult': 'X', 'fullTimeScore': '1-1'},
        },
      )!;
      final ri = ((s['matchesAnalysis'] as List).first as Map)['resultInfo']
          as Map;
      expect(ri['systemCorrect'], isTrue);
      expect(ri['errorNote'], isNull);
    });

    test('yanlış tahminde açıklama METNİ üretilir, etiket UYDURULMAZ', () {
      final s = mapSnapshot(
        ornekSnap(),
        resultsByMatchId: {
          '77': {'officialResult': '2', 'fullTimeScore': '0-2'},
        },
      )!;
      final ri = ((s['matchesAnalysis'] as List).first as Map)['resultInfo']
          as Map;
      expect(ri['systemCorrect'], isFalse);
      expect(ri['errorNote'], 'Sistem 1 bekliyordu, resmî sonuç 2 geldi.');
      expect(ri['errorTag'], isNull);
    });

    test('doğrulama özeti 10 haneye kısaltılır', () {
      final s = mapSnapshot(ornekSnap())!;
      expect(s['shortHash'], 'abcdef0123');
    });

    test('eksik oyuncu listesi HER ZAMAN boş (uydurma isim yok)', () {
      final s = mapSnapshot(ornekSnap())!;
      final m = (s['matchesAnalysis'] as List).first as Map;
      expect(m['missingPlayers'], isEmpty);
      expect(m['lineupComment'], 'Bu veri bulunamadı.');
    });
  });

  group('Sonuç/değerlendirme indeksleri', () {
    test('boş yanıt boş indeks verir', () {
      expect(indexResults(null), isEmpty);
      expect(indexEvaluation({'matches': []}), isEmpty);
    });

    test('matchId metne çevrilerek anahtarlanır', () {
      final r = indexResults({
        'results': [
          {'matchId': 77, 'officialResult': '1', 'fullTimeScore': '2-0'},
        ],
      });
      expect(r['77'], isNotNull);
      expect((r['77'] as Map)['officialResult'], '1');
    });
  });

  group('Arşiv hata metni', () {
    test('ağ hatası insan diline çevrilir', () {
      expect(
        humanArchiveError(Exception('Network request failed')),
        contains('İnternet bağlantını'),
      );
      expect(
        humanArchiveError('ECONNREFUSED 10.0.2.2:4000'),
        contains('İnternet bağlantını'),
      );
    });

    test('sunucu hataları ayrı metin alır', () {
      expect(
        humanArchiveError('Sunucu hatası (503)'),
        contains('yanıt vermiyor'),
      );
    });

    test('sunucunun anlamlı mesajı OLDUĞU GİBİ kalır', () {
      expect(
        humanArchiveError('Bu bülten arşivde bulunamadı.'),
        'Bu bülten arşivde bulunamadı.',
      );
    });

    test('404 eksik uç olarak tanınır', () {
      expect(isMissingEndpoint('Sunucu hatası (404)'), isTrue);
      expect(isMissingEndpoint('Sunucu hatası (500)'), isFalse);
    });
  });

  group('Bülten kilit kuralları', () {
    final gecmis = DateTime(2026, 8, 1).toIso8601String();
    final gelecek = DateTime(2030, 8, 1).toIso8601String();

    test('ilk maç başlamadıysa kilitlenmez', () {
      expect(
        isPastFirstMatch({'firstMatchStartAt': gelecek}, DateTime(2026, 8, 9)),
        isFalse,
      );
    });

    test('ilk maç başladıysa aktif/taslak bülten kilitlenebilir', () {
      expect(
        isBulletinLockable({
          'status': BulletinStatus.active,
          'firstMatchStartAt': gecmis,
        }, DateTime(2026, 8, 9)),
        isTrue,
      );
      expect(
        isBulletinLockable({
          'status': BulletinStatus.completed,
          'firstMatchStartAt': gecmis,
        }, DateTime(2026, 8, 9)),
        isFalse,
      );
    });

    test('tarih yoksa kilitlenmez (tahmin edilmez)', () {
      expect(isPastFirstMatch({}), isFalse);
      expect(isPastFirstMatch({'firstMatchStartAt': 'bozuk'}), isFalse);
    });
  });
}
