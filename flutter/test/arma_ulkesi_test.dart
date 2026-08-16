// ARMA ADRESİNDEN ÜLKE — yedek ülke kaynağının kuralları.
//
// Resmî bülten bazı maçlarda lig adını genel bir metinle yazar ("Final",
// "2026/2027 Sezonu") ve o metinden ülke çıkmaz. Kulüp armasının adresi
// sağlayıcının kendi düzeninde ülke ön eki taşır; bu testler o yedek yolun
// nerede çalıştığını ve NEREDE SUSTUĞUNU sabitler.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/ulke_seridi.dart';

void main() {
  group('armaUlkesiEn', () {
    test('ülke ön ekini okur', () {
      expect(
        armaUlkesiEn(
          'https://cdn.footystats.org/img/teams/france-olympique-de-marseille.png',
        ),
        'France',
      );
      expect(
        armaUlkesiEn(
          'https://cdn.footystats.org/img/teams/germany-fc-bayern-munchen.png',
        ),
        'Germany',
      );
      expect(
        armaUlkesiEn('https://cdn.footystats.org/img/teams/turkey-galatasaray.png'),
        'Turkey',
      );
    });

    test('iki kelimelik ülke kısa olanın gölgesinde kalmaz', () {
      expect(
        armaUlkesiEn('https://x/teams/czech-republic-ac-sparta-praha.png'),
        'Czech Republic',
      );
    });

    test('sorgu dizesi ve büyük harf sorun çıkarmaz', () {
      expect(armaUlkesiEn('https://x/teams/Spain-Real-Betis.png?v=2'), 'Spain');
    });

    test('ülke ön eki yoksa null — uydurma yok', () {
      expect(armaUlkesiEn('https://x/teams/some-club.png'), isNull);
      expect(armaUlkesiEn(''), isNull);
      expect(armaUlkesiEn(null), isNull);
    });
  });

  group('macArmaUlkesiEn', () {
    const fr = 'https://x/teams/france-olympique-de-marseille.png';
    const fr2 = 'https://x/teams/france-rc-strasbourg-alsace.png';
    const de = 'https://x/teams/germany-fc-bayern-munchen.png';

    test('iki arma aynı ülkeyse o ülke', () {
      expect(macArmaUlkesiEn(fr, fr2), 'France');
    });

    test('bir taraf armasızsa diğerinden okunur', () {
      expect(macArmaUlkesiEn('', fr2), 'France');
      expect(macArmaUlkesiEn(fr, null), 'France');
    });

    test('iki kulüp FARKLI ülkedeyse ülke BELİRSİZDİR — bayrak basılmaz', () {
      // Yanlış bayrak, bayraksızlıktan kötüdür: uluslararası karşılaşmada
      // taraflardan birini seçmek turnuvayı o ülkeye maletmek olurdu.
      expect(macArmaUlkesiEn(fr, de), isNull);
    });

    test('hiçbir armada ülke yoksa null', () {
      expect(macArmaUlkesiEn('https://x/teams/a.png', ''), isNull);
    });
  });

  group('macUlkesiEn — maç kaydından', () {
    test('takım nesnelerindeki armadan okur', () {
      expect(
        macUlkesiEn({
          'home': {'logo': 'https://x/teams/italy-torino-fc.png'},
          'away': {'logo': 'https://x/teams/italy-ac-milan.png'},
        }),
        'Italy',
      );
    });

    test('fikstür armaları (stats) önceliklidir', () {
      expect(
        macUlkesiEn({
          'stats': {
            'home': {'logo': 'https://x/teams/spain-villarreal-cf.png'},
            'away': {'logo': 'https://x/teams/spain-real-betis.png'},
          },
          'home': {'logo': ''},
          'away': {'logo': ''},
        }),
        'Spain',
      );
    });

    test('arma yoksa null', () {
      expect(macUlkesiEn({'home': {}, 'away': {}}), isNull);
      expect(macUlkesiEn(null), isNull);
    });
  });

  group('ulkeListesi — lig adı ülke vermezse armadan tamamlanır', () {
    test('"Final" maçı ülkesiz çip bırakmaz', () {
      final liste = ulkeListesi([
        {
          'league': 'Final',
          'home': {'logo': 'https://x/teams/germany-bvb-09-borussia-dortmund.png'},
          'away': {'logo': 'https://x/teams/germany-fc-bayern-munchen.png'},
        },
      ]);
      expect(liste.length, 1);
      expect(liste.first.name, 'Almanya');
      expect(liste.first.code, isNotEmpty);
    });

    test('lig adı ülkeyi zaten veriyorsa armaya bakılmaz', () {
      final liste = ulkeListesi([
        {
          'league': 'Turkey Süper Lig',
          'home': {'logo': 'https://x/teams/germany-fc-bayern-munchen.png'},
          'away': {'logo': 'https://x/teams/germany-fc-bayern-munchen.png'},
        },
      ]);
      expect(liste.single.name, 'Türkiye');
    });

    test('iki kulüp farklı ülkedeyse ülke uydurulmaz', () {
      final liste = ulkeListesi([
        {
          'league': 'Final',
          'home': {'logo': 'https://x/teams/france-olympique-de-marseille.png'},
          'away': {'logo': 'https://x/teams/germany-fc-bayern-munchen.png'},
        },
      ]);
      expect(liste.single.name, 'Final'); // lig adı aynen, bayrak yok
      expect(liste.single.code, isEmpty);
    });
  });
}
