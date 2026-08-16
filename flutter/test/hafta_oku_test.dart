// HAFTA OKU HER YERDE AYNI (kullanıcı kararı, 16 Ağustos 2026).
//
// Uygulamada ÜÇ ayrı hafta gezinme oku vardı ve üçü de ayrı yazılmıştı:
//   bülten başlığı        40 px · cardAlt      · text
//   Haftalık Başarı       40 px · darkCardSoft · onDark
//   Kupon Merkezi         36 px · cardAlt      · text
// Aynı işi yapan düğmeler farklı boyut ve farklı renk tokenleriyle
// çiziliyordu; üçü de ÇERÇEVESİZDİ ve kartlar kırmızıya alınınca yuvarlağın
// tonu kartın kırmızısına yaklaşıp düğmeler kartın içinde kayboldu.
//
// Artık tek bileşen (`HaftaOku`). Bu testler "her yerde aynı" kuralını
// YAPISAL tutar: ikinci bir ok tanımı eklenirse test düşer.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/widgets/hafta_oku.dart';

void main() {
  test('hafta gezinme oku TEK yerde — ekranlar kendi okunu yazmaz', () {
    // İMZA: "Önceki hafta" / "Sonraki hafta" etiketli gezinme düğmesi.
    // Yalnız "dosyada yuvarlak + ok karakteri var mı" diye bakmak YANLIŞ
    // sonuç veriyordu: satır sonu şevronu (`›`) ve aç/kapa işareti (`▾`/`›`)
    // da eşleşiyordu. İlk sürüm bu yüzden üç masum dosyayı işaretledi.
    final tanimlar = <String>[];
    for (final f in Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))) {
      if (f.path.endsWith('hafta_oku.dart')) continue;
      final src = f.readAsStringSync();
      if (!RegExp(r"'(Önceki|Sonraki) hafta'").hasMatch(src)) continue;
      // Etiketi kullanan dosya, oku KENDİ çizmemeli.
      if (src.contains('shape: BoxShape.circle')) tanimlar.add(f.path);
    }
    expect(
      tanimlar,
      isEmpty,
      reason: 'ekran kendi hafta okunu çiziyor: $tanimlar',
    );
  });

  test('hafta oklarını kullanan ekranlar ORTAK bileşeni çağırır', () {
    var kullanan = 0;
    for (final f in Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))) {
      if (f.path.endsWith('hafta_oku.dart')) continue;
      final src = f.readAsStringSync();
      if (!RegExp(r"'(Önceki|Sonraki) hafta'").hasMatch(src)) continue;
      kullanan++;
      expect(
        src.contains('HaftaOku('),
        isTrue,
        reason: '${f.path} hafta oku etiketini kullanıyor ama ortak bileşeni çağırmıyor',
      );
    }
    // Ölçülen: bülten · Haftalık Başarı · Kupon Merkezi · Hafta Kapanışı
    expect(kullanan, greaterThanOrEqualTo(4), reason: 'ekranlar kaybolmuş');
  });

  testWidgets('ok, kartından SARI çerçeveyle ayrılır', (t) async {
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HaftaOku(
            ileri: false,
            acik: true,
            etiket: 'Önceki hafta',
            onTap: () {},
          ),
        ),
      ),
    );

    final kutu = t.widget<Container>(
      find.descendant(
        of: find.byType(HaftaOku),
        matching: find.byType(Container),
      ),
    );
    final d = kutu.decoration! as BoxDecoration;
    expect(d.shape, BoxShape.circle);
    expect(d.border, isNotNull, reason: 'çerçeve yok — kartın içinde erir');
    expect(find.text('‹'), findsOneWidget);
  });

  testWidgets('ileri/geri işareti doğru', (t) async {
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HaftaOku(
            ileri: true,
            acik: true,
            etiket: 'Sonraki hafta',
            onTap: () {},
          ),
        ),
      ),
    );
    expect(find.text('›'), findsOneWidget);
  });

  testWidgets('KAPALI ok dokunmayı yutmaz ve soluklaşır', (t) async {
    var basildi = false;
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HaftaOku(
            ileri: true,
            acik: false,
            etiket: 'Sonraki hafta',
            onTap: () => basildi = true,
          ),
        ),
      ),
    );
    await t.tap(find.byType(HaftaOku));
    await t.pump();
    expect(basildi, isFalse, reason: 'kapalı okta dokunma çalışmamalı');

    final o = t.widget<Opacity>(find.byType(Opacity).first);
    expect(o.opacity, lessThan(1.0));
  });
}
