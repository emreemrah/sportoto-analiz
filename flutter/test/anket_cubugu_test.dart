// ANKET ÇUBUĞU SAYIYI YALANLAMAZ.
//
// DENETİMDE ÖLÇÜLDÜ (16 Ağustos 2026, `m1_detay.png`): maç detayındaki
// "Maç Sonucu Anketi" bölümünde **"X Berabere biter · 0 oy · %0"** satırının
// çubuğu TAM DOLU görünüyordu.
//
// Sebep: çubuğun boş kısmı düz `AppColors.border` ile boyanıyordu; takım
// temasında `border` beyaza yakındır ve koyu kart üstünde parlak beyaz bir
// şerit "dolu" gibi okunur. Yani ekranda yazan sayı (%0) ile çubuğun görüntüsü
// birbirini yalanlıyordu.
//
// Kural: doluluk vurgusu YALNIZ dolu kısımda olur; boş kısım oluk gibi geri
// çekilir. Bu, "sayıyı uydurma" kuralının görsel karşılığıdır — çubuk da bir
// veri gösterimidir.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/takim_gorunumu.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

const _temalar = <String, (int, int)>{
  'Galatasaray': (0xFFFDB912, 0xFFA90432),
  'Fenerbahçe': (0xFF00417F, 0xFFFFED00),
  'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
};

/// Kaynaktaki boş-kısım rengi (bkz. `mac_sonuc_anketi.dart`).
Color _bosKisim() => AppColors.border.withValues(alpha: 0.30);

/// Rengin kart üstünde ne kadar "göze çarptığı".
double _belirginlik(Color c, Color kart) {
  // Alfa'yı kart üstüne düşür — ekranda görünen efektif renk budur.
  final e = Color.alphaBlend(c, kart);
  return kontrastOrani(e, kart);
}

void main() {
  for (final t in _temalar.entries) {
    test('${t.key}: BOŞ kısım DOLU kısımdan daha az göze çarpar', () {
      takimGorunumunuUygula(
        paletUret(
          takim: t.key,
          ana: Color(t.value.$1),
          ikincil: Color(t.value.$2),
        ),
      );

      final kart = AppColors.card;
      final bos = _belirginlik(_bosKisim(), kart);

      // Ankette dolu kısım seçeneğin rengiyle çizilir; en zayıf ihtimalle
      // uygulamanın vurgu rengi kullanılır.
      final dolu = _belirginlik(AppColors.primary, kart);

      expect(
        bos,
        lessThan(dolu),
        reason:
            '${t.key}: boş kısım (${bos.toStringAsFixed(2)}) dolu kısımdan '
            '(${dolu.toStringAsFixed(2)}) daha çok göze çarpıyor — %0 satırı '
            'DOLU gibi okunur ve çubuk, yanındaki sayıyı yalanlar',
      );
    });

    test('${t.key}: boş kısım yine de GÖRÜNÜR (oluk kaybolmaz)', () {
      takimGorunumunuUygula(
        paletUret(
          takim: t.key,
          ana: Color(t.value.$1),
          ikincil: Color(t.value.$2),
        ),
      );
      expect(
        _belirginlik(_bosKisim(), AppColors.card),
        greaterThan(1.02),
        reason: '${t.key}: boş kısım tamamen kayboldu, çubuğun boyu okunmuyor',
      );
    });
  }

  test('kaynakta boş kısım düz `border` ile boyanmaz', () {
    final src = File(
      'lib/features/match_detail/mac_sonuc_anketi.dart',
    ).readAsStringSync();
    expect(
      src.contains('ColoredBox(color: AppColors.border)'),
      isFalse,
      reason: 'boş kısım yine düz border — %0 satırı dolu gibi görünür',
    );
  });
}
