// MAÇ SAATİ TEK TANIMDAN ÇÖZÜLÜR — SAAT DİLİMİ TARAMASI.
//
// Bugün AYNI kökten BEŞ yer bulundu: bülten maç saati saat dilimi EKSİZ
// Türkiye duvar saatidir, ama kod onu CİHAZIN yerel saatinde yorumluyordu.
//
//   1. yaklasan_maclar     → başlamış maç "yaklaşan" görünüyordu (kullanıcı bildirdi)
//   2. bulletin_screen     → `_isStarted` yanlış karar veriyordu
//   3. live_logic          → canlı/başlamadı sınıflandırması kayıyordu
//   4. notifications       → bildirim YANLIŞ ANDA çalardı
//   5. push_planner        → planlanan bildirim yanlış ana kurulurdu
//
// Türkiye'deki cihazda hepsi doğru çalışıyordu; cihaz TSİ değilse ofset kadar
// kayıyordu. Bu tarama, altıncısının eklenmesini engeller.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/utils.dart';

void main() {
  test('maç saati çözümü TEK yerde tanımlı', () {
    var tanim = 0;
    for (final f in Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))) {
      tanim += RegExp(r'DateTime\? macAni\(').allMatches(f.readAsStringSync()).length;
    }
    expect(tanim, 1, reason: 'ikinci bir maç-saati çözümü eklenmiş');
  });

  test('maç saatini KARŞILAŞTIRAN dosyalar tek tanımı kullanır', () {
    // İmza: dosya `m['date']` ile zaman kıyaslıyorsa `macAni`/`macBasladi`
    // kullanmalı; ham `DateTime.parse(...).toLocal()` cihaz saatine bağlanır.
    final suclu = <String>[];
    for (final yol in const [
      'lib/core/yaklasan_maclar.dart',
      'lib/core/live_logic.dart',
      'lib/core/notifications.dart',
      'lib/core/push_planner.dart',
      'lib/features/bulletin/bulletin_screen.dart',
    ]) {
      final src = File(yol).readAsStringSync();
      if (!RegExp(r'macAni\(|macBasladi\(').hasMatch(src)) suclu.add(yol);
    }
    expect(suclu, isEmpty, reason: 'tek tanımı kullanmayan dosya: $suclu');
  });

  test('duvar saati TÜRKİYE kabul edilir — cihazdan bağımsız', () {
    // 19:00 TSİ = 16:00 UTC, cihaz hangi dilimde olursa olsun.
    expect(macAni('2026-08-16T19:00:00')!.toUtc(),
        DateTime.parse('2026-08-16T16:00:00Z'));
  });

  test('saat dilimi EKLİ değer olduğu gibi kalır', () {
    expect(macAni('2026-08-16T16:00:00Z')!.toUtc(),
        DateTime.parse('2026-08-16T16:00:00Z'));
    expect(macAni('2026-08-16T19:00:00+03:00')!.toUtc(),
        DateTime.parse('2026-08-16T16:00:00Z'));
  });
}
