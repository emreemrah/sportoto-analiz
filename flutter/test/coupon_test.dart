// KAYNAK: app/src/couponConfig.js + app/src/couponEval.js
//
// Bu testler projenin EN SERT kuralını koruyor:
//
//   "Her tercih, İLGİLİ MAÇ başlamadan önce kaydedilmiş hâliyle donar."
//   → GERİYE DÖNÜK BAŞARI ÜRETİLEMEZ.
//
// Kilit doğrulaması sessizce bozulursa kullanıcı başlamış maça işaret koyup
// karnesini şişirebilir ve bunu kimse fark etmez. Bu yüzden kilit mantığı
// ekranda değil, saf modülde ve testli duruyor.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/coupon/coupon_config.dart';
import 'package:masteranaliz/core/coupon/coupon_eval.dart';

void main() {
  group('kolon sayısı', () {
    test('tekli=1, çifte=2, üçlü=3 çarpımı', () {
      expect(
        columnCount([
          const CouponSelection(no: 1, selectedOutcomes: ['1']),
          const CouponSelection(no: 2, selectedOutcomes: ['1', 'X']),
          const CouponSelection(no: 3, selectedOutcomes: ['1', 'X', '2']),
        ]),
        6,
      );
    });

    test('boş seçim kolonu SIFIRLAMAZ (en az 1 sayılır)', () {
      expect(
        columnCount([
          const CouponSelection(no: 1, selectedOutcomes: []),
          const CouponSelection(no: 2, selectedOutcomes: ['1', 'X']),
        ]),
        2,
      );
    });
  });

  group('FİYAT UYDURULAMAZ', () {
    test('fiyat verisi yoksa maliyet null — sıfır ya da tahmin yazılmaz', () {
      expect(costOf(10, null), isNull);
      expect(costOf(10, {}), isNull);
      expect(costOf(10, {'unitPrice': 0}), isNull);
      expect(costOf(10, {'unitPrice': -5}), isNull);
    });

    test('geçerli fiyatla hesaplanır', () {
      expect(costOf(10, {'unitPrice': 2.5}), 25.0);
    });

    test('validPricing: kaynak VE tarih zorunlu', () {
      expect(validPricing({'unitPrice': 2.5}), isFalse);
      expect(
        validPricing({'unitPrice': 2.5, 'source': 'resmî liste'}),
        isFalse,
        reason: 'tarih yoksa bedel kullanılmaz',
      );
      expect(
        validPricing({
          'unitPrice': 2.5,
          'source': 'resmî liste',
          'updatedAt': '2026-08-01',
        }),
        isTrue,
      );
    });
  });

  group('MAÇ BAZLI KİLİT — geriye dönük başarı üretilemez', () {
    final macBasi = DateTime(2026, 8, 14, 21, 30);
    final kilit = macBasi.subtract(kLockBefore); // 21:25

    test('kilit anı maç başından 5 dk önce', () {
      final la = matchLockAt({'date': macBasi.toIso8601String()});
      expect(la, kilit);
    });

    test('kilitten önce açık, kilitten sonra kapalı', () {
      final m = {'date': macBasi.toIso8601String()};
      expect(
        isMatchLocked(m, now: kilit.subtract(const Duration(minutes: 1))),
        isFalse,
      );
      expect(isMatchLocked(m, now: kilit), isTrue);
      expect(isMatchLocked(m, now: macBasi), isTrue);
    });

    test('tarihi olmayan maç kilitli SAYILMAZ (uydurma kilit yok)', () {
      expect(matchLockAt({}), isNull);
      expect(isMatchLocked({}), isFalse);
    });

    test('KİLİTLİ maça YENİ seçim yapılamaz', () {
      final ihlal = lockViolations(
        selections: [
          const CouponSelection(no: 1, selectedOutcomes: ['1']),
        ],
        prevSelections: const [], // yeni kupon: önceki değer BOŞ
        lockMap: {1: kilit},
        now: macBasi,
      );
      expect(ihlal, [1], reason: 'başlamış maça işaret konamaz');
    });

    test('kilitli maçın seçimi DEĞİŞTİRİLEMEZ', () {
      final ihlal = lockViolations(
        selections: [
          const CouponSelection(no: 1, selectedOutcomes: ['1', 'X']),
        ],
        prevSelections: [
          const CouponSelection(no: 1, selectedOutcomes: ['1']),
        ],
        lockMap: {1: kilit},
        now: macBasi,
      );
      expect(ihlal, [1]);
    });

    test('kilitli maçın seçimi AYNI kalırsa ihlal yok', () {
      final ihlal = lockViolations(
        selections: [
          // sıra farklı yazılmış olsa bile normalleştirme aynı kabul eder
          const CouponSelection(no: 1, selectedOutcomes: ['X', '1']),
        ],
        prevSelections: [
          const CouponSelection(no: 1, selectedOutcomes: ['1', 'X']),
        ],
        lockMap: {1: kilit},
        now: macBasi,
      );
      expect(ihlal, isEmpty);
    });

    test('KİLİTLENMEMİŞ maça serbestçe seçim yapılır', () {
      final ihlal = lockViolations(
        selections: [
          const CouponSelection(no: 2, selectedOutcomes: ['2']),
        ],
        lockMap: {2: kilit},
        now: kilit.subtract(const Duration(minutes: 1)),
      );
      expect(ihlal, isEmpty);
    });
  });

  group('değerlendirme — yalnız RESMÎ sonuç', () {
    test('resmî sonuç yoksa hit null (⏳) — iska sayılmaz', () {
      final e = evalSelections([
        {
          'no': 1,
          'selectedOutcomes': ['1'],
        },
      ], {});
      expect(e.rows.first.hit, isNull);
      expect(e.pending, 1);
      expect(e.wrong, 0);
      expect(e.allResolved, isFalse);
    });

    test("resmî '0' sonucu 'X' olarak normalleşir", () {
      expect(normResult('0'), 'X');
      expect(normResult('1'), '1');
      expect(normResult('x'), 'X');
      expect(normResult('bozuk'), isNull, reason: 'tanınmayan → uydurma yok');
      expect(normResult(null), isNull);
    });

    test('çifte tercih tutarsa isabet sayılır', () {
      final e = evalSelections(
        [
          {
            'no': 1,
            'selectedOutcomes': ['1', 'X'],
          },
        ],
        {
          1: '0', // beraberlik
        },
      );
      expect(e.rows.first.hit, isTrue);
      expect(e.correct, 1);
    });

    test('12+ derece YALNIZ tüm sonuçlar gelince kesinleşir', () {
      List<Map> sec(int n) => [
        for (var i = 1; i <= n; i++)
          {
            'no': i,
            'selectedOutcomes': ['1'],
          },
      ];

      // 15 maçın 14'ü doğru ama 1'i henüz sonuçlanmadı → tier YOK.
      final eksik = evalSelections(sec(15), {
        for (var i = 1; i <= 14; i++) i: '1',
      });
      expect(eksik.correct, 14);
      expect(eksik.allResolved, isFalse);
      expect(eksik.tier, isNull, reason: 'eksik haftada derece ilan edilmez');

      final tam = evalSelections(sec(15), {
        for (var i = 1; i <= 15; i++) i: '1',
      });
      expect(tam.allResolved, isTrue);
      expect(tam.tier, 15);
    });

    test('12 altı isabette derece yok', () {
      final e = evalSelections(
        [
          for (var i = 1; i <= 15; i++)
            {
              'no': i,
              'selectedOutcomes': ['1'],
            },
        ],
        {for (var i = 1; i <= 15; i++) i: i <= 11 ? '1' : '2'},
      );
      expect(e.correct, 11);
      expect(e.allResolved, isTrue);
      expect(e.tier, isNull);
      expect(e.misses.length, 4);
    });
  });

  group('picksMapOf — Bülten "Sen" satırını besler', () {
    test("seçimler resmî sembole çevrilir (X → 0)", () {
      final coupon = {
        'finalVersionId': 'v1',
        'versions': [
          {
            'id': 'v1',
            'selections': [
              {
                'no': 1,
                'selectedOutcomes': ['1', 'X'],
              },
              {'no': 2, 'selectedOutcomes': <String>[]},
            ],
          },
        ],
      };
      expect(picksMapOf(coupon), {1: '10'});
    });

    test('kupon yoksa boş harita — uydurma seçim yok', () {
      expect(picksMapOf(null), isEmpty);
      expect(picksMapOf({'versions': []}), isEmpty);
    });
  });

  group('paylaşım metni', () {
    test('fiyat yoksa tutar satırı YAZILMAZ', () {
      final metin = buildShareText(
        coupon: {
          'finalVersionId': 'v1',
          'versions': [
            {
              'id': 'v1',
              'columnCount': 4,
              'selections': [
                {
                  'no': 1,
                  'selectedOutcomes': ['1', 'X'],
                },
              ],
            },
          ],
        },
        roundName: '1. Hafta',
      );
      expect(metin, contains('Kolon: 4'));
      expect(metin, isNot(contains('Tutar')));
      expect(metin, contains('Kesin sonuç veya kazanç vaadi değildir.'));
    });

    test('"oynadım" işaretliyse beyan olduğu AÇIKÇA yazılır', () {
      final metin = buildShareText(
        coupon: {
          'finalVersionId': 'v1',
          'playedMarkedAt': '2026-08-14T10:00:00Z',
          'versions': [
            {
              'id': 'v1',
              'columnCount': 1,
              'selections': [
                {
                  'no': 1,
                  'selectedOutcomes': ['1'],
                },
              ],
            },
          ],
        },
      );
      expect(metin, contains('kullanıcı beyanı'));
      // Kaynaktaki cümle tek satırdır; testte satır sonu beklemek yanlıştı.
      expect(metin, contains('bağımsız olarak doğrulanmamıştır'));
    });
  });
}
