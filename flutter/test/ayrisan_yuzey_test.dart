// ROZET YÜZEYİ KARTTAN AYRIŞMALI.
//
// Ham `*Soft` değerleri her temada kartın üstünde seçilmiyordu; ölçülen iki
// gerçek durum (16 Ağustos 2026):
//   • koyu görünüm — primarySoft #1C2740 / kart #1B2029 = 1.11
//   • açık görünüm — warningSoft #FFF4DD / kart #FFFFFF = 1.08
// İkisi de "göz ancak seçer" sınırının (1.25) altında. Bu testler düzeltmenin
// hem çalıştığını hem de GEREKSİZ YERE renk bozmadığını sabitler.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';

void main() {
  const koyuKart = Color(0xFF1B2029); // KoyuRenkler.surface
  const koyuTemaYuzeyi = Color(0xFF1C2740); // KoyuRenkler.primarySoft
  const acikKart = Color(0xFFFFFFFF); // VarsayilanRenkler.surface
  const krem = Color(0xFFFFF4DD); // warningSoft

  test('koyu görünümde tema yüzeyi karta gömülmez', () {
    expect(kontrastOrani(koyuTemaYuzeyi, koyuKart), lessThan(1.25));
    final duzeltilmis = ayrisanYuzey(koyuTemaYuzeyi, koyuKart);
    expect(kontrastOrani(duzeltilmis, koyuKart), greaterThanOrEqualTo(1.4));
  });

  test('açık görünümde krem rozet beyaz kartta kaybolmaz', () {
    expect(kontrastOrani(krem, acikKart), lessThan(1.25));
    final duzeltilmis = ayrisanYuzey(krem, acikKart);
    expect(kontrastOrani(duzeltilmis, acikKart), greaterThanOrEqualTo(1.4));
  });

  test('zaten ayrışan renk DEĞİŞTİRİLMEZ', () {
    // Krem, koyu kartın üstünde zaten fazlasıyla ayrışır.
    expect(ayrisanYuzey(krem, koyuKart), krem);
  });

  test('hue korunur — rozetin anlamı kaymaz', () {
    final duzeltilmis = ayrisanYuzey(krem, acikKart);
    final once = HSLColor.fromColor(krem).hue;
    final sonra = HSLColor.fromColor(duzeltilmis).hue;
    expect((sonra - once).abs(), lessThan(1.0));
  });

  test('düzeltilmiş yüzeyde yazı hâlâ okunur', () {
    for (final (istenen, kart) in [
      (koyuTemaYuzeyi, koyuKart),
      (krem, acikKart),
    ]) {
      final zemin = ayrisanYuzey(istenen, kart);
      expect(kontrastOrani(okunurMetin(zemin), zemin), greaterThanOrEqualTo(4.5));
    }
  });
}
