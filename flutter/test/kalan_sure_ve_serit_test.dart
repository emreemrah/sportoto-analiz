// KALAN SÜRE TEK BİÇİMDE YAZILIR + YATAY ŞERİTLER KENARA YAPIŞMAZ.
//
// İkisi de 16 Ağustos 2026 denetiminde emülatörde ölçüldü:
//
//  1. Radar "Mühürlenmeye 7538 dk kaldı." yazıyordu; AYNI an bültende
//     "kalan 5 gün 8 sa" görünüyordu. Ham dakika insan ölçeği değildir ve iki
//     ekran aynı süreyi iki farklı ölçekte gösteriyordu.
//
//  2. Ana sayfadaki lig şeridinin yatay boşluğu yoktu: ilk çip ekranın sol
//     kenarına yapışıyor, bayrağı kırpılmış görünüyordu. Hemen altındaki
//     "Yaklaşan Maçlar" şeridi ise `Spacing.md` kullanıyordu.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/widgets/snapshot_seal_banner.dart';

void main() {
  group('kalanSureMetni', () {
    test('günlük süre gün + saat yazar (ham dakika DEĞİL)', () {
      // Ölçülen gerçek değer: 7538 dk = 5 gün 5 saat.
      expect(kalanSureMetni(7538 * 60000), '5 gün 5 sa');
      expect(kalanSureMetni(Duration(days: 5, hours: 8).inMilliseconds),
          '5 gün 8 sa');
    });

    test('gün altı saat + dakika, saat altı dakika + saniye', () {
      expect(kalanSureMetni(Duration(hours: 3, minutes: 12).inMilliseconds),
          '3 sa 12 dk');
      expect(kalanSureMetni(Duration(minutes: 45, seconds: 9).inMilliseconds),
          '45 dk 09 sn');
      expect(kalanSureMetni(Duration(seconds: 7).inMilliseconds), '7 sn');
    });

    test('süre bittiyse metin ÜRETİLMEZ (null) — sıfır uydurulmaz', () {
      expect(kalanSureMetni(0), isNull);
      expect(kalanSureMetni(-1), isNull);
    });
  });

  group('kaynak taraması', () {
    test('radar geri sayımı ham "dk" basmaz, ortak biçimlendiriciyi kullanır',
        () {
      final src = File('lib/features/radar/radar_screen.dart').readAsStringSync();
      expect(
        src.contains(r"'🔒 Mühürlenmeye $dk dk kaldı.'"),
        isFalse,
        reason: 'radar yine ham dakika basıyor',
      );
      expect(src.contains('kalanSureMetni('), isTrue);
    });

    test('kalan süre biçimi TEK yerde tanımlı', () {
      var tanim = 0;
      for (final f in Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.dart'))) {
        if (RegExp(r'String\?? +kalanSureMetni\(').hasMatch(f.readAsStringSync())) {
          tanim++;
        }
      }
      expect(tanim, 1, reason: 'ikinci bir kalan-süre tanımı eklenmiş');
    });

    test('hiçbir KayanSerit YATAY boşluk almaz — dikişsiz döngü bozulmasın', () {
      // `KayanSerit` içeriğin İKİ kopyasını yan yana koyar ve bir kopya
      // genişliği kadar kayınca başa döner (`kayan_serit.dart`:
      // `if (_offset >= _kopyaGenislik) _offset -= _kopyaGenislik`).
      // `_kopyaGenislik` YALNIZ kopyayı ölçer; şeridin `padding`'i ölçünün
      // DIŞINDADIR. Yatay boşluk verilirse başa dönüşte solda boşluk kadar
      // sıçrama görünür.
      //
      // Not: bu kural, "ilk çip kenara yapışık görünüyor" gözleminin bir kusur
      // OLMADIĞINI da kayda geçirir — şerit sürekli hareket hâlindedir.
      final hatali = <String>[];
      var bakilanCagri = 0;
      for (final f in Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.dart'))) {
        final src = f.readAsStringSync();
        for (final m in RegExp(r'KayanSerit\(').allMatches(src)) {
          // Çağrının gövdesi: `children:` argümanına kadar (yorumlar uzun
          // olabildiği için sabit pencere KULLANILMAZ — hatayı kaçırırdı).
          final kalan = src.substring(m.end);
          final son = kalan.indexOf('children:');
          final govde = son == -1 ? kalan : kalan.substring(0, son);
          bakilanCagri++;
          final p = govde.indexOf('padding:');
          if (p == -1) continue;
          final ifade = govde.substring(
            p,
            (p + 200).clamp(0, govde.length),
          );
          if (ifade.contains('horizontal:')) hatali.add(f.path);
        }
      }
      expect(bakilanCagri, greaterThan(0), reason: 'hiç KayanSerit bulunamadı');
      expect(hatali, isEmpty, reason: 'yatay boşluklu KayanSerit: $hatali');
    });
  });
}
