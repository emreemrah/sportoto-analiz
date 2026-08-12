// KUPONA ANKET SONUCUNDAN AKTARIM + GENİŞLİK (kullanıcı isteği, 2026-08-11).
//
// Kullanıcının tarifi: "kuponlarım kısmına anket sonuçlarına göre de oynansın;
// sistem ve anket sonuçları için tekli ve geniş seçenekleri olsun. Tekli demek
// her maç için tek seçim; genişte hem çifte hem de kapalı yani 3 yönde
// seçilebilsin."
//
// NE SABİTLENİYOR:
//  1. Genişlik: tekli 1, çifte 2, kapalı 3 işaret.
//  2. Anket seçimi O MAÇIN GERÇEK OYLARINDAN gelir; en çok oy alan öndedir.
//  3. Oy verilmemiş maça öneri YOK — olmayan topluluk tercihi uydurulmaz.
//  4. KİMLİK: oylar `sportotoMatchId` ile tutulur; bülten sırası (`no`) ile
//     aranırsa hiçbir maç eşleşmez ve bu SESSİZ bir hata olurdu.
//  5. Genişlik veri uydurmaz: kaydı olmayan maç hiçbir modda dolmaz.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/coupon/smart.dart';

/// Bülten maçı: `no` bülten sırası, `sportotoMatchId` oyların anahtarı.
Map<String, dynamic> _m(int no, String kimlik, {String? sys, Map? probs}) => {
  'no': no,
  'sportotoMatchId': kimlik,
  if (sys != null) 'prediction': {'symbol': sys},
  'probabilities': ?probs,
};

/// `/ms-summary` çıktısının işlenmiş hâli: kimlik → sayımlar.
const Map<String, Map<String, int>> _oylar = {
  // 1 açık ara önde
  'uuid-a': {'total': 100, 'home': 70, 'draw': 20, 'away': 10},
  // 2 önde, X ikinci
  'uuid-b': {'total': 50, 'home': 5, 'draw': 15, 'away': 30},
  // hiç oy yok
  'uuid-c': {'total': 0, 'home': 0, 'draw': 0, 'away': 0},
};

void main() {
  group('Anket aktarımı — genişlik', () {
    final maclar = [_m(1, 'uuid-a'), _m(2, 'uuid-b'), _m(3, 'uuid-c')];

    test('tekli: her maça en çok oy alan TEK işaret', () {
      final p = proposalFrom(
        maclar,
        'anket',
        genislik: AktarimGenisligi.tekli,
        anketDagilimi: _oylar,
      );
      expect(p[1], ['1'], reason: 'home 70 oyla önde');
      expect(p[2], ['2'], reason: 'away 30 oyla önde');
    });

    test('çifte: en çok oy alan İKİ işaret, 1-X-2 sırasında', () {
      final p = proposalFrom(
        maclar,
        'anket',
        genislik: AktarimGenisligi.cifte,
        anketDagilimi: _oylar,
      );
      expect(p[1], ['1', 'X'], reason: '70 ve 20');
      expect(p[2], ['X', '2'], reason: '30 ve 15 — çıktı sırası hep 1/X/2');
    });

    test('kapalı: üç yön birden', () {
      final p = proposalFrom(
        maclar,
        'anket',
        genislik: AktarimGenisligi.kapali,
        anketDagilimi: _oylar,
      );
      expect(p[1], ['1', 'X', '2']);
      expect(p[2], ['1', 'X', '2']);
    });

    test('oy verilmemiş maça HİÇBİR modda öneri yok', () {
      for (final g in AktarimGenisligi.values) {
        final p = proposalFrom(
          maclar,
          'anket',
          genislik: g,
          anketDagilimi: _oylar,
        );
        expect(p[3], isNull, reason: '$g: oy yokken öneri uydurulmaz');
      }
    });

    test('dağılım hiç gelmediyse aktarım boştur', () {
      final p = proposalFrom(maclar, 'anket', anketDagilimi: null);
      expect(p, isEmpty);
    });

    test('eşit oyda sıra 1 → X → 2', () {
      final p = proposalFrom(
        [_m(9, 'uuid-esit')],
        'anket',
        genislik: AktarimGenisligi.tekli,
        anketDagilimi: const {
          'uuid-esit': {'total': 30, 'home': 10, 'draw': 10, 'away': 10},
        },
      );
      expect(p[9], ['1']);
    });
  });

  group('Anket aktarımı — kimlik', () {
    test('oylar sportotoMatchId ile eşleşir, bülten sırasıyla DEĞİL', () {
      // Dağılım anahtarı bülten sırası olsaydı ('1'), eşleşme olmamalı.
      final siraylaAnahtarli = proposalFrom(
        [_m(1, 'uuid-a')],
        'anket',
        anketDagilimi: const {
          '1': {'total': 100, 'home': 70, 'draw': 20, 'away': 10},
        },
      );
      expect(
        siraylaAnahtarli,
        isEmpty,
        reason: 'yanlış anahtarla eşleşme olmamalı — sessiz dolum yapılmaz',
      );

      final dogru = proposalFrom(
        [_m(1, 'uuid-a')],
        'anket',
        anketDagilimi: _oylar,
      );
      expect(dogru[1], ['1']);
    });

    test('sportotoMatchId yoksa bülten sırasına düşülür', () {
      final p = proposalFrom(
        [
          {'no': 7},
        ],
        'anket',
        anketDagilimi: const {
          '7': {'total': 4, 'home': 1, 'draw': 3, 'away': 0},
        },
      );
      expect(p[7], ['X']);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // OTOMATİK GENİŞLİK (kullanıcı isteği, 2026-08-11)
  //
  // "Favori açık araysa favori tek, favoriye yakınsa çift, 3'ü de birbirine
  // yakınsa kapalı." Eşikler: açık ara ≥ 15 puan, üçü yakın < 10 puan.
  // ══════════════════════════════════════════════════════════════════════════
  group('Otomatik genişlik kararı', () {
    test('favori açık ara öndeyse TEK', () {
      expect(otomatikGenislik([55, 30, 15]), AktarimGenisligi.tekli);
      expect(otomatikGenislik([45, 30, 25]), AktarimGenisligi.tekli);
    });

    test('ikinci yakın ama üçüncü geridiyse ÇİFT', () {
      // fark 5 (<15) → tek değil; favori-üçüncü 22 (≥10) → kapalı da değil.
      expect(otomatikGenislik([40, 35, 18]), AktarimGenisligi.cifte);
    });

    test('üçü de birbirine yakınsa KAPALI', () {
      expect(otomatikGenislik([36, 33, 31]), AktarimGenisligi.kapali);
      expect(otomatikGenislik([34, 33, 33]), AktarimGenisligi.kapali);
    });

    test('eşik sınırları: 15 tam farkta TEK, 14.9 farkta değil', () {
      expect(otomatikGenislik([45, 30, 25]), AktarimGenisligi.tekli);
      expect(otomatikGenislik([44.9, 30, 25.1]), isNot(AktarimGenisligi.tekli));
    });

    test('üç değer yoksa karar verilmez — tekliye düşer', () {
      expect(otomatikGenislik([60, 40]), AktarimGenisligi.tekli);
      expect(otomatikGenislik(const []), AktarimGenisligi.tekli);
    });
  });

  group('Otomatik genişlik — aktarımda', () {
    test('sistem: her maç KENDİ dağılımına göre genişler', () {
      final p = proposalFrom([
        // açık ara → tek
        _m(1, 'uuid-1', sys: '1', probs: {'1': 55, 'X': 30, '2': 15}),
        // ikinci yakın → çift
        _m(2, 'uuid-2', sys: '1', probs: {'1': 40, 'X': 35, '2': 18}),
        // üçü yakın → kapalı
        _m(3, 'uuid-3', sys: '1', probs: {'1': 36, 'X': 33, '2': 31}),
      ], 'system');

      expect(p[1], ['1'], reason: 'açık ara');
      expect(p[2], ['1', 'X'], reason: 'ikinci yakın');
      expect(p[3], ['1', 'X', '2'], reason: 'üçü de yakın');
    });

    test('anket: karar OY YÜZDESİNDEN verilir', () {
      final p = proposalFrom(
        [_m(1, 'a'), _m(2, 'b'), _m(3, 'c')],
        'anket',
        anketDagilimi: const {
          // %70/%20/%10 → açık ara → tek
          'a': {'total': 100, 'home': 70, 'draw': 20, 'away': 10},
          // %40/%35/%25 → fark 5, favori-üçüncü 15 → çift
          'b': {'total': 100, 'home': 40, 'draw': 35, 'away': 25},
          // %35/%33/%32 → üçü yakın → kapalı
          'c': {'total': 100, 'home': 35, 'draw': 33, 'away': 32},
        },
      );

      expect(p[1], ['1']);
      expect(p[2], ['1', 'X']);
      expect(p[3], ['1', 'X', '2']);
    });

    test('az oyda da yüzdeye göre karar verilir (sayıya değil)', () {
      // 2 oy: %50/%50/%0 → fark 0 → tek değil; favori-üçüncü 50 → kapalı değil.
      final p = proposalFrom(
        [_m(1, 'a')],
        'anket',
        anketDagilimi: const {
          'a': {'total': 2, 'home': 1, 'draw': 1, 'away': 0},
        },
      );
      expect(p[1], ['1', 'X']);
    });

    test('olasılığı olmayan maçta otomatik TEKLİYE düşer', () {
      final p = proposalFrom([_m(4, 'uuid-4', sys: '10')], 'system');
      expect(p[4], ['1'], reason: 'dağılım yoksa genişletme uydurulmaz');
    });

    // ──────────────────────────────────────────────────────────────────────
    // GERÇEK BÜLTEN ŞEKLİ — olasılık `analysis.probabilities` altındadır.
    //
    // Yaşandı (2026-08-11): `signalsOf` yalnız kökteki `probabilities`
    // alanını okuyordu; canlı bülten maçlarında o alan YOK. Otomatik genişlik
    // her maçta sessizce tekliye düşüyordu ve testler bunu göremiyordu, çünkü
    // test verisi olasılığı kökte veriyordu. Bu test canlı şekli kullanır.
    // ──────────────────────────────────────────────────────────────────────
    test('olasılık analysis altındayken de otomatik çalışır', () {
      final p = proposalFrom([
        {
          'no': 1,
          'sportotoMatchId': 'uuid-1',
          'prediction': {'symbol': '10'},
          'analysis': {
            'probabilities': {'1': 78, 'X': 14, '2': 8},
          },
        },
        {
          'no': 2,
          'sportotoMatchId': 'uuid-2',
          'prediction': {'symbol': '1'},
          'analysis': {
            'probabilities': {'1': 36, 'X': 33, '2': 31},
          },
        },
      ], 'system');

      expect(p[1], ['1'], reason: 'fark 64 puan — açık ara, tekli');
      expect(p[2], ['1', 'X', '2'], reason: 'üçü yakın — kapalı');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TOPLULUK KUPONU — kullanıcının tarifi birebir (2026-08-11)
  //
  // "Tekli Kupon'da her maç için en yüksek oy alan tek sonuç eklensin. Geniş
  // Kupon'da oranlar değerlendirilerek; biri açık ara öndeyse tekli, iki sonuç
  // yakınsa çifte, üçü de yakınsa 1-X-2 kapalı eklensin."
  // ══════════════════════════════════════════════════════════════════════════
  group('Topluluk Kuponu senaryosu', () {
    /// Üç farklı dağılım: açık ara · iki yakın · üçü yakın.
    final bulten = [_m(1, 'a'), _m(2, 'b'), _m(3, 'c')];
    const oylar = {
      'a': {'total': 100, 'home': 70, 'draw': 20, 'away': 10},
      'b': {'total': 100, 'home': 40, 'draw': 35, 'away': 25},
      'c': {'total': 100, 'home': 35, 'draw': 33, 'away': 32},
    };

    test('Tekli Kupon: her maça EN YÜKSEK oyu alan tek sonuç', () {
      final p = proposalFrom(
        bulten,
        'anket',
        genislik: AktarimGenisligi.tekli,
        anketDagilimi: oylar,
      );
      expect(p[1], ['1']);
      expect(p[2], ['1']);
      expect(p[3], ['1']);
      for (final s in p.values) {
        expect(s, hasLength(1), reason: 'tekli kuponda her maç tek işaret');
      }
    });

    test('Geniş Kupon: açık ara tek, iki yakın çifte, üçü yakın kapalı', () {
      final p = proposalFrom(
        bulten,
        'anket',
        genislik: AktarimGenisligi.otomatik,
        anketDagilimi: oylar,
      );
      expect(p[1], ['1'], reason: '%70 açık ara');
      expect(p[2], ['1', 'X'], reason: '%40-%35 yakın');
      expect(p[3], ['1', 'X', '2'], reason: '%35-%33-%32 üçü de yakın');
    });

    test('analiz sinyali olmayan maç bile oyla dolar', () {
      // Maçta ne sistem tahmini ne olasılık var; yalnız topluluk oyu var.
      final p = proposalFrom(
        [
          {'no': 5, 'sportotoMatchId': 'z'},
        ],
        'anket',
        anketDagilimi: const {
          'z': {'total': 8, 'home': 1, 'draw': 6, 'away': 1},
        },
      );
      expect(p[5], ['X'], reason: 'topluluk kuponu analize bakmaz');
    });
  });

  group('Sistem aktarımı — genişlik', () {
    final maclar = [
      _m(1, 'uuid-a', sys: '1', probs: {'1': 55, 'X': 30, '2': 15}),
    ];

    test('tekli tek, çifte iki, kapalı üç işaret verir', () {
      expect(proposalFrom(maclar, 'system')[1], ['1']);
      expect(
        proposalFrom(maclar, 'system', genislik: AktarimGenisligi.cifte)[1],
        ['1', 'X'],
        reason: 'ikinci işaret olasılığa göre eklenir',
      );
      expect(
        proposalFrom(maclar, 'system', genislik: AktarimGenisligi.kapali)[1],
        ['1', 'X', '2'],
      );
    });

    test('olasılık yoksa tekli, sembolün ilk işaretini alır', () {
      final p = proposalFrom([_m(2, 'uuid-b', sys: '02')], 'system');
      expect(p[2], ['X'], reason: "'0' = X ve sembolde önce yazılı");
    });
  });
}
