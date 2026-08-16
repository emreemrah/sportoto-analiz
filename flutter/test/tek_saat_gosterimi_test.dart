// UYGULAMA TEK MAÇA TEK SAAT YAZAR.
//
// DENETİMDE ÖLÇÜLDÜ (16 Ağustos 2026): aynı maç iki ekranda İKİ FARKLI saat
// gösteriyordu.
//   bülten (date, Türkiye duvar saati)      → 21:30
//   radar  (kickoffAt, gerçek an → cihaz)   → 18:30  (GMT emülatörde)
//
// İkisi de kendi mantığında doğruydu; ama uygulama tek maça iki saat yazamaz.
// Türkiye'deki telefonda fark GÖRÜNMÜYORDU (ikisi de 21:30) — bu yüzden uzun
// süre fark edilmedi.
//
// Kural: resmî bülten saati TÜRKİYE saatidir, uygulama her ekranda onu gösterir.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/utils.dart';

void main() {
  test('duvar saati ve gerçek an AYNI saati gösterir', () {
    // Aynı maç, iki farklı gösterim: bülten duvar saati, radar UTC damgalı.
    final bulten = trAlanlari('2026-08-21T21:30:00');
    final radar = trAlanlari('2026-08-21T18:30:00.000Z');

    expect(bulten!.hour, 21);
    expect(bulten.minute, 30);
    expect(
      radar!.hour,
      bulten.hour,
      reason: 'radar ile bülten farklı saat yazıyor — tek maça iki saat olamaz',
    );
    expect(radar.minute, bulten.minute);
    expect(radar.day, bulten.day);
  });

  test('gün sınırında da doğru — 00:30 TSİ ertesi gündür', () {
    // 21:30 UTC = 00:30 TSİ (ertesi gün).
    final d = trAlanlari('2026-08-21T21:30:00.000Z');
    expect(d!.hour, 0);
    expect(d.minute, 30);
    expect(d.day, 22, reason: 'gün de Türkiye gününe göre olmalı');
  });

  test('cihaz saat diliminden BAĞIMSIZ', () {
    // Değer UTC tabanlı üretilir; makinenin yerel ofseti sonuca karışmaz.
    final d = trAlanlari('2026-08-21T18:30:00.000Z')!;
    expect(d.isUtc, isTrue, reason: 'yerel saate kayarsa cihaza bağımlı olur');
  });

  test('çözülemeyen değer null — uydurma saat yok', () {
    expect(trAlanlari(null), isNull);
    expect(trAlanlari(''), isNull);
    expect(trAlanlari('bilinmiyor'), isNull);
  });

  test('radar biçimlendiricileri TEK tanımı kullanır', () {
    for (final yol in const [
      'lib/features/radar/radar_center_cards.dart',
      'lib/features/radar/radar_screen_data.dart',
    ]) {
      final src = File(yol).readAsStringSync();
      expect(
        src.contains('trAlanlari('),
        isTrue,
        reason: '$yol saati cihaz saatine göre yazıyor',
      );
      expect(
        RegExp(r"DateTime\.tryParse\(iso\)\?\.toLocal\(\)").hasMatch(src),
        isFalse,
        reason: '$yol hâlâ cihaz-yerel çeviri yapıyor',
      );
    }
  });
}
