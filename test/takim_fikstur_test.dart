// KAYNAK: app/test-ui/takim-fikstur.test.jsx — saf kısımların karşılığı.
//
// NEDEN VAR: takım kartı eskiden sezon istatistiği açıyordu, kullanıcı
// kararıyla fikstüre çevrildi. Buradaki riskler sessiz: oynanmamış maça skor
// basmak, tek turnuvada her satıra aynı adı basmak, ve tarih yokken uydurma
// tarih göstermek.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/takim_fikstur.dart';

/// Kaynak testteki `YANIT.fikstur` — hiçbir değeri değiştirilmedi.
const List<Map<String, Object?>> _fikstur = [
  {
    'footyMatchId': 1,
    'dateUnix': 1785171600,
    'home': 'Randers',
    'away': 'Silkeborg',
    'evde': true,
    'rakip': 'Silkeborg',
    'oynandi': true,
    'score': {'home': 1, 'away': 1},
    'sonuc': 'B',
  },
  {
    'footyMatchId': 2,
    'dateUnix': 1785690000,
    'home': 'Nordsjælland',
    'away': 'Randers',
    'evde': false,
    'rakip': 'Nordsjælland',
    'oynandi': false,
    'score': null,
    'sonuc': null,
  },
  {
    'footyMatchId': 3,
    'dateUnix': 1786294800,
    'home': 'Randers',
    'away': 'Lyngby',
    'evde': true,
    'rakip': 'Lyngby',
    'oynandi': false,
    'score': null,
    'sonuc': null,
  },
];

void main() {
  group('tarihEtiketi', () {
    test('tarihi kısa Türkçe biçime çeviriyor', () {
      // 1785171600 = 27 Temmuz 2026 (yerel saat — kaynakla aynı okuma).
      expect(tarihEtiketi(1785171600), '27 Tem');
    });

    test('tarih yoksa uydurma tarih basmıyor', () {
      expect(tarihEtiketi(null), '—');
      expect(tarihEtiketi(0), '—');
    });

    test('12 ayın kısaltması da kaynaktakiyle aynı', () {
      // Ocak → Aralık, her ayın 15'i (yerel saat 12:00, kaymayı engeller).
      for (var ay = 1; ay <= 12; ay++) {
        final d = DateTime(2026, ay, 15, 12);
        final sn = d.millisecondsSinceEpoch ~/ 1000;
        expect(tarihEtiketi(sn), '15 ${kAylarKisa[ay - 1]}');
      }
    });
  });

  group('fiksturSkoru', () {
    test('oynanmış maçta skor var', () {
      expect(fiksturSkoru(_fikstur[0]), '1 - 1');
    });

    test('oynanmamış maçta skor YOK — uydurulmuyor', () {
      expect(fiksturSkoru(_fikstur[1]), isNull);
      expect(fiksturSkoru(_fikstur[2]), isNull);
    });

    test('oynandı ama skor gelmemişse yine de yazılmıyor', () {
      // Sunucu skoru eksik gönderirse "0 - 0" uydurmak, olmayan bir sonucu
      // gerçekmiş gibi göstermek olurdu.
      expect(fiksturSkoru({'oynandi': true, 'score': null}), isNull);
    });
  });

  group('ilkGelecekIndex — "SIRADAKİ" ayracı', () {
    test('ilk oynanmamış maçın sırasını veriyor', () {
      expect(ilkGelecekIndex(_fikstur), 1);
    });

    test('hepsi oynanmışsa ayraç çizilmiyor', () {
      final hepsiBitti = [
        for (final f in _fikstur) {...f, 'oynandi': true},
      ];
      expect(ilkGelecekIndex(hepsiBitti), -1);
    });

    test('hiçbiri oynanmamışsa ayraç en başta', () {
      final hicbiri = [
        for (final f in _fikstur) {...f, 'oynandi': false},
      ];
      expect(ilkGelecekIndex(hicbiri), 0);
    });
  });

  group('fiksturLigleri — kapsam notu', () {
    test('tek turnuvada tek ad döner (satırlara BASILMAZ)', () {
      final tek = [
        for (final f in _fikstur) {...f, 'lig': 'Denmark Superliga'},
      ];
      final l = fiksturLigleri(tek);
      expect(l, ['Denmark Superliga']);
      // Satır etiketinin koşulu `ligler.length > 1` — tek turnuvada kapalı.
      expect(l.length > 1, isFalse);
    });

    test('birden fazla turnuva varsa hepsi sırayla döner', () {
      final karisik = [
        {..._fikstur[0], 'lig': 'Denmark Superliga'},
        {..._fikstur[1], 'lig': 'UEFA Sampiyonlar Ligi'},
        {..._fikstur[2], 'lig': 'Denmark Superliga'},
      ];
      expect(fiksturLigleri(karisik), [
        'Denmark Superliga',
        'UEFA Sampiyonlar Ligi',
      ]);
    });

    test('lig bilgisi olmayan satırlar kapsam notunu kirletmiyor', () {
      expect(fiksturLigleri(_fikstur), isEmpty);
      expect(
        fiksturLigleri([
          {'lig': null},
          {'lig': ''},
          {'lig': 'Süper Lig'},
        ]),
        ['Süper Lig'],
      );
    });
  });
}
