// KAYNAK: app/src/screens/BulletinScreen.js içindeki saf biçimlendiriciler.
//
// Bunlar para ve resmî tarih yazıyor: yanlış biçim, kullanıcının resmî listeyle
// karşılaştırırken "uygulama başka söylüyor" demesine yol açar. Bu yüzden
// çevirinin en sessiz kırılabilecek yerlerinden biri ve testi burada.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/bulletin/bulletin_format.dart';

void main() {
  group('binlik ayracı', () {
    test('gruplama', () {
      expect(binlikGrupla('30578'), '30.578');
      expect(binlikGrupla('412124'), '412.124');
      expect(binlikGrupla('4035942'), '4.035.942');
      expect(binlikGrupla('999'), '999');
      expect(binlikGrupla('1000'), '1.000');
      expect(binlikGrupla('0'), '0');
    });
  });

  group('para biçimi', () {
    test('uygulama biçimi: başta ₺', () {
      expect(fmtTL(30578.23), '₺30.578,23');
      expect(fmtTL(0), '₺0,00');
    });

    test('resmî biçim: sonda ₺', () {
      expect(fmtTLResmi(4035942.42), '4.035.942,42 ₺');
    });

    test('veri yoksa tire — sıfır YAZILMAZ', () {
      expect(fmtTL(null), '–');
      expect(fmtTLResmi(null), '–');
      expect(fmtCount(null), '–');
    });

    test('kişi sayısı', () {
      expect(fmtCount(412124), '412.124');
      expect(fmtCount(0), '0');
    });
  });

  group('sezon adı', () {
    test('sayıysa "2025/2026 Sezonu" üretir', () {
      expect(sezonAdi(2026), '2025/2026 Sezonu');
    });

    test('zaten "2025/2026" biçimindeyse AYNEN kalır', () {
      // /api/rounds gerçekte bu biçimi döndürüyor (9 Ağustos 2026'da
      // doğrulandı). Kaynak `Number.isFinite` ile aynı ayrımı yapıyordu:
      // sayıya çevrilemiyorsa metin aynen yazılır, uydurulmaz.
      expect(sezonAdi('2025/2026'), '2025/2026');
      expect(sezonAdi('2026/2027'), '2026/2027');
    });
  });

  group('resmî kapanış tarihi', () {
    test('"08 Ağustos Cumartesi 2026 16:55" biçimi', () {
      // 2026-08-08 bir Cumartesi.
      expect(
        kapanisResmi('2026-08-08T16:55:00'),
        '08 Ağustos Cumartesi 2026 16:55',
      );
    });

    test('boş değer 1970 döndürmez — null döner', () {
      expect(kapanisResmi(null), isNull);
      expect(kapanisResmi(''), isNull);
      expect(kapanisResmi('bozuk'), isNull);
    });
  });

  group('resmî sonuç ayrımı', () {
    test('officialResolved: hem result hem score gerekir', () {
      expect(
        officialResolved({
          'result': '1',
          'score': {'home': 1, 'away': 0},
        }),
        isTrue,
      );
      expect(officialResolved({'result': '1'}), isFalse);
      expect(
        officialResolved({
          'score': {'home': 1, 'away': 0},
        }),
        isFalse,
      );
      expect(officialResolved(null), isFalse);
    });

    test('histCategory: resmî / geçici / bekliyor', () {
      expect(
        histCategory({
          'result': 'X',
          'score': {'home': 1, 'away': 1},
        }),
        'official',
      );
      expect(
        histCategory({
          'provisional': {
            'score': {'home': 1, 'away': 1},
          },
        }),
        'provisional',
      );
      expect(histCategory({}), 'waiting');
    });

    test('pastResult: resmî varsa resmî, yoksa geçiciden türetilir', () {
      expect(
        pastResult({
          'result': '2',
          'score': {'home': 0, 'away': 1},
        }),
        '2',
      );
      expect(
        pastResult({
          'provisional': {
            'score': {'home': 1, 'away': 1},
          },
        }),
        'X',
      );
      // Hiçbiri yoksa UYDURULMAZ.
      expect(pastResult({}), isNull);
    });
  });
}
