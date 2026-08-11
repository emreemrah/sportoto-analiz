// KAYNAK: app/test/radar-gun.test.mjs — BİREBİR çeviri.
//
// RADAR GÜN SEÇİMİ TESTLERİ.
//
// GERÇEK HATA (2 Ağustos 2026, pazar): Radar 3 CUMA gününde takılı kaldı.
// Kullanıcı bugünün oynanma yüzdelerini göremedi. Hiçbir hata mesajı yoktu —
// ekran dolu görünüyordu, sadece yanlış güne kilitlenmişti.
//
// İki kusur üst üste bindi ve testler ikisini de ayrı ayrı kilitler:
//   1. gelecek günler aday olmaktan elenmiyordu,
//   2. "veri var mı" kontrolü BOŞ NESNEYİ veri sayıyordu (`{}` doğrudur).

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/radar/radar_screen_logic.dart';

/// Gerçek olayın verisi: bugün pazar (2 Ağu), sonraki beş gün gelecek.
const List<Map<String, Object?>> _gunler = [
  {'date': '2026-08-02', 'future': false},
  {'date': '2026-08-03', 'future': true},
  {'date': '2026-08-04', 'future': true},
  {'date': '2026-08-05', 'future': true},
  {'date': '2026-08-06', 'future': true},
  {'date': '2026-08-07', 'future': true}, // CUMA — hatalı seçilen gün
];

/// Kaynak, gelecek günler için BOŞ NESNE gönderiyor.
const List<Map<String, Object?>> _maclar = [
  {
    'cells': {
      '2026-08-02': {
        'bySource': {
          'k1': {
            'percentages': {'1': 70, 'X': 14, '2': 16},
          },
        },
      },
      '2026-08-03': <String, Object?>{},
      '2026-08-04': <String, Object?>{},
      '2026-08-05': <String, Object?>{},
      '2026-08-06': <String, Object?>{},
      '2026-08-07': <String, Object?>{},
    },
  },
];

void main() {
  group('hucreDolu', () {
    test('BOŞ NESNE veri sayılmıyor — hatanın ikinci yarısı', () {
      // `{}` JavaScript'te doğrudur; eski kontrol bu yüzden gelecek günleri
      // "veri var" sayıyordu.
      expect(hucreDolu(<String, Object?>{}), isFalse);
    });

    test('içi dolu hücre veri sayılıyor', () {
      expect(
        hucreDolu({
          'bySource': {'k1': <String, Object?>{}},
        }),
        isTrue,
      );
    });

    test('yok/boş değerler veri değil', () {
      expect(hucreDolu(null), isFalse);
      expect(hucreDolu('veri'), isFalse);
    });
  });

  group('varsayilanGun', () {
    test('GERÇEK OLAY: cuma değil, bugün seçiliyor', () {
      expect(varsayilanGun(_gunler, _maclar), '2026-08-02');
    });

    test('gelecek gün ASLA varsayılan olmuyor', () {
      // Gelecek günlerin hücresi DOLU olsa bile seçilmemeli: oynanmamış bir
      // günün oynanma yüzdesi mantıken yoktur.
      final doluGelecek = [
        {
          'cells': {
            '2026-08-02': {
              'bySource': {'k1': <String, Object?>{}},
            },
            '2026-08-07': {
              'bySource': {'k1': <String, Object?>{}},
            },
          },
        },
      ];
      expect(varsayilanGun(_gunler, doluGelecek), '2026-08-02');
    });

    test('geçmişte veri olan EN SON gün seçiliyor', () {
      final gunler = [
        {'date': '2026-07-31', 'future': false},
        {'date': '2026-08-01', 'future': false},
        {'date': '2026-08-02', 'future': false},
      ];
      final maclar = [
        {
          'cells': {
            '2026-07-31': {'a': 1},
            '2026-08-01': {'a': 1},
            '2026-08-02': <String, Object?>{},
          },
        },
      ];
      // 2 Ağustos boş → 1 Ağustos seçilmeli (en son VERİLİ gün).
      expect(varsayilanGun(gunler, maclar), '2026-08-01');
    });

    test('hiç veri yoksa yine de geçmiş/bugün gününde kalınıyor', () {
      // Gelecek güne kaçmak, kullanıcıya "veri var" izlenimi verirdi.
      expect(
        varsayilanGun(_gunler, [
          {'cells': <String, Object?>{}},
        ]),
        '2026-08-02',
      );
    });

    test('bültenin TAMAMI ileri tarihliyse EN YAKIN gün seçiliyor', () {
      // Yeni açılmış hafta: son günü göstermek kullanıcıyı bir hafta
      // sonrasına atardı.
      final hepsiGelecek = [
        for (final g in _gunler) {...g, 'future': true},
      ];
      expect(varsayilanGun(hepsiGelecek, _maclar), '2026-08-02');
    });

    test('gün listesi yoksa patlamıyor', () {
      expect(varsayilanGun(null, null), isNull);
      expect(varsayilanGun(const [], _maclar), isNull);
    });

    test('hücre okuyucu özelleştirilebiliyor (Radar 4 farklı yerde tutabilir)', () {
      final maclar = [
        {
          'ozel': {
            '2026-08-02': {'a': 1},
          },
        },
      ];
      expect(
        varsayilanGun(_gunler, maclar, (m, t) => (m['ozel'] as Map?)?[t]),
        '2026-08-02',
      );
    });
  });
}
