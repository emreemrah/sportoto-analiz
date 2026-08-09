// KAYNAK: app/test/radar-screen-logic.test.mjs — BİREBİR çeviri.
//
// RADAR EKRANI DURUM MAKİNESİ TESTLERİ — boş ekran hatası regresyonu.
// Kural: güncellik backend'in current:true alanından okunur; roundId
// sıralamasından TAHMİN EDİLMEZ. Güncel haftada "arşiv yok" ASLA gösterilmez.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/radar/radar_screen_logic.dart';

void main() {
  test(
    'normalizeWeeks: current alanı esas alınır; string roundId sayıya çevrilir',
    () {
      final wk = normalizeWeeks({
        'currentRoundId': '4300',
        'weeks': [
          {
            'roundId': '4300',
            'current': true,
            'archived': false,
            'sealed': false,
          },
          {'roundId': 4290, 'current': false, 'archived': true, 'sealed': true},
        ],
      });
      expect(wk.currentRoundId, 4300);
      expect(wk.weeks[0]['roundId'], 4300);
      expect(wk.weeks[0]['current'], isTrue);
      expect(wk.weeks[1]['archived'], isTrue);
      expect(
        wk.weeks[1]['locked'],
        isTrue,
        reason: 'sealed → locked türetilir',
      );
    },
  );

  test(
    'normalizeWeeks: ESKİ backend yanıtı (current alanı yok) currentRoundId ile doldurulur',
    () {
      final wk = normalizeWeeks({
        'currentRoundId': 4300,
        'weeks': [
          {'roundId': 4300},
          {'roundId': 4290, 'sealed': true},
        ],
      });
      Map hafta(num rid) => wk.weeks.firstWhere((w) => w['roundId'] == rid);
      expect(hafta(4300)['current'], isTrue);
      expect(hafta(4290)['current'], isFalse);
      expect(hafta(4290)['archived'], isTrue);
    },
  );

  test(
    'resolveCurrentId: weeks içindeki current işareti > currentRoundId > /current roundId',
    () {
      NormalizedWeeks n(Map wk) => normalizeWeeks(wk);
      Map m(NormalizedWeeks x) => {
        'weeks': x.weeks,
        'currentRoundId': x.currentRoundId,
      };
      expect(
        resolveCurrentId(
          null,
          m(
            n({
              'currentRoundId': 4300,
              'weeks': [
                {'roundId': 4300, 'current': true},
              ],
            }),
          ),
        ),
        4300,
      );
      expect(
        resolveCurrentId({
          'roundId': 4250,
          'current': true,
        }, m(n({'currentRoundId': null, 'weeks': []}))),
        4250,
      );
      // Geçmiş hafta yanıtındaki roundId "güncel" sanılmaz:
      expect(
        resolveCurrentId(
          {'roundId': 4290, 'current': false},
          {'currentRoundId': null, 'weeks': []},
        ),
        isNull,
      );
    },
  );

  test(
    'isCurrentWeek: tip farkı (string/number) güncellik tespitini bozmaz',
    () {
      expect(isCurrentWeek({'roundId': '4300'}, 4300), isTrue);
      expect(isCurrentWeek({'roundId': 4290}, 4300), isFalse);
      expect(
        isCurrentWeek({'roundId': 4290, 'current': true}, null),
        isTrue,
        reason: 'backend işareti yeterli',
      );
    },
  );

  test('durum makinesi: 5 durum doğru türetilir', () {
    expect(deriveScreenState(loading: true), RadarEkranDurumu.loading);
    expect(
      deriveScreenState(
        loading: false,
        error: 'Sunucu hatası (500)',
        meta: {'current': true},
      ),
      RadarEkranDurumu.error,
    );
    expect(
      deriveScreenState(
        loading: false,
        view: {
          'hasData': true,
          'matches': [
            {'no': 1},
          ],
        },
        meta: {'current': true},
      ),
      RadarEkranDurumu.data,
    );
    expect(
      deriveScreenState(
        loading: false,
        legacyRadar: [
          {'no': 1},
        ],
        meta: {'current': false},
      ),
      RadarEkranDurumu.data,
    );
    expect(
      deriveScreenState(
        loading: false,
        view: null,
        legacyRadar: [],
        meta: {'current': true, 'pending': true},
      ),
      RadarEkranDurumu.currentPending,
    );
    expect(
      deriveScreenState(
        loading: false,
        view: null,
        legacyRadar: [],
        meta: {'current': false},
      ),
      RadarEkranDurumu.pastUnarchived,
    );
  });

  test(
    'REGRESYON: güncel haftada "arşiv yok" hatası boş ekran DEĞİL dürüst bekleme olur',
    () {
      expect(isMissingArchiveError('Bu hafta için radar arşivi yok.'), isTrue);
      final state = deriveScreenState(
        loading: false,
        error: 'Bu hafta için radar arşivi yok.',
        meta: {'current': true},
      );
      expect(
        state,
        RadarEkranDurumu.currentPending,
        reason: 'güncel hafta arşiv hatasına düşürülmez',
      );
      final msg = screenStateMessage(state, {'current': true})!;
      expect(msg, contains('bekleniyor'));
      expect(
        msg.contains('arşiv'),
        isFalse,
        reason: 'kullanıcıya güncel haftada arşiv metni gösterilmez',
      );
    },
  );

  test(
    'geçmiş haftada gerçek "arşiv yok" → pastUnarchived + dürüst metin (retry hatası değil)',
    () {
      final state = deriveScreenState(
        loading: false,
        error: 'Bu hafta için radar arşivi yok.',
        meta: {'current': false},
      );
      expect(state, RadarEkranDurumu.pastUnarchived);
      expect(screenStateMessage(state, null), contains('arşivlenmemiş'));
    },
  );

  test('API hatasında mesaj + tekrar dene metni üretimi', () {
    expect(
      screenStateMessage(RadarEkranDurumu.error, null),
      'Radar verisi alınamadı.',
    );
    expect(screenStateMessage(RadarEkranDurumu.data, null), isNull);
  });
}
