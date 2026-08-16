// SAYI ÇEVİRİMİ TEK KURALLA YAPILIR.
//
// KAPSAMLI KOD DENETİMİNDE BULUNDU (16 Ağustos 2026): aynı işi yapan `_sayi`
// yardımcısı ÜÇ dosyada ayrı tanımlıydı ve İKİSİ FARKLI davranıyordu:
//
//   moderation_view.dart          "12" → 12   (parse eder)
//   archive_mappers.dart          "12" → 0    (parse ETMEZ)
//   bulletin_history_service.dart "12" → 0    (parse ETMEZ)
//
// Kullanıldıkları yerler zararsız değildi:
//   * archive_mappers: `systemWrong = _sayi(predicted) - _sayi(correct)`
//     → metin gelseydi 0-0 = 0, yani EKRANDA YANLIŞ SAYI, uyarı yok.
//   * bulletin_history_service: haftaları `roundId`'ye göre sıralıyor
//     → metin gelseydi hepsi 0 olur, sıralama sessizce bozulurdu.
//
// ÖLÇÜM (üretim, 16 Ağu): bu alanlar bugün SAYI geliyor — yani aktif bir
// yanlış değer YOKTU. Ama aynı yanıtta `id` METİN olarak geliyor
// (`"id":"1529"` / `"roundId":1529`), yani uç tip karıştırıyor. Sessiz sıfır
// üretebilecek bir ayrışmayı açık bırakmanın gereği yok.
//
// Tek tanım hepsinin ÜST KÜMESİ: sayı aynen, sayısal metin parse edilir,
// tanınmayan değer 0 olur.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/utils.dart';

void main() {
  group('sayiya', () {
    test('sayı aynen geçer', () {
      expect(sayiya(12), 12);
      expect(sayiya(0), 0);
      expect(sayiya(-3), -3);
      expect(sayiya(12.7), 12, reason: 'ondalık kırpılır');
    });

    test('SAYISAL METİN parse edilir (eski ayrışmanın düzeltildiği yer)', () {
      expect(sayiya('12'), 12);
      expect(sayiya('0'), 0);
      expect(sayiya('-3'), -3);
    });

    test('tanınmayan değer 0 olur — çökme yok', () {
      expect(sayiya(null), 0);
      expect(sayiya('abc'), 0);
      expect(sayiya(''), 0);
      expect(sayiya({}), 0);
      expect(sayiya([]), 0);
    });
  });

  group('sayiyaNullable', () {
    test('"0" ile "bilinmiyor" AYRIMI korunur', () {
      expect(sayiyaNullable(0), 0);
      expect(sayiyaNullable('0'), 0);
      expect(
        sayiyaNullable(null),
        isNull,
        reason: 'veri yokken 0 UYDURULMAMALI',
      );
      expect(sayiyaNullable('abc'), isNull);
    });
  });

  test('ikinci bir sayı yardımcısı tanımlı DEĞİL', () {
    // Ayrışma buradan başlamıştı: aynı ad, farklı davranış.
    var tanim = 0;
    for (final f in Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))) {
      final src = f.readAsStringSync();
      tanim += RegExp(r'int _?sayi(ya)?\(Object\? ').allMatches(src).length;
    }
    expect(tanim, 1, reason: 'sayı çevirimi yine birden fazla yerde tanımlı');
  });
}
