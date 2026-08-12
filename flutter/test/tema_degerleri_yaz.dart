// GEÇİCİ ÖLÇÜM ARACI (2026-08-12) — hesaplanan token değerlerini ve kontrast
// oranlarını basar. Görünen bir şeyi tahmin etmek yerine ölçmek için.
//
// `_test.dart` ile BİTMEZ: normal süite girmez, elle çalıştırılır.
//
// ÇALIŞTIRMA: flutter test test/tema_degerleri_yaz.dart --reporter expanded

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

String _h(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}';

void _yaz(String s) => debugPrint(s);

void main() {
  test('görünüm token değerleri', () {
    for (final (ad, p) in [
      ('AÇIK', Brightness.light),
      ('KOYU', Brightness.dark),
    ]) {
      gorunumuUygula(p);
      _yaz('\n═══ $ad GÖRÜNÜM');
      final k = <String, Color>{
        'background': AppColors.background,
        'surface': AppColors.surface,
        'surfaceSoft': AppColors.surfaceSoft,
        'primary': AppColors.primary,
        'onPrimary': AppColors.onPrimary,
        'onPrimarySoft': AppColors.onPrimarySoft,
        'accent': AppColors.accent,
        'onAccent': AppColors.onAccent,
        'text': AppColors.text,
        'textSoft': AppColors.textSoft,
        'muted': AppColors.muted,
        'border': AppColors.border,
        'darkCard': AppColors.darkCard,
        'onDark': AppColors.onDark,
        'onDarkSoft': AppColors.onDarkSoft,
      };
      k.forEach((n, c) {
        _yaz(
          '  ${n.padRight(14)} ${_h(c)}  L=${gorecelParlaklik(c).toStringAsFixed(3)}',
        );
      });
      _yaz(
        '  KONTRAST  text/surface=${kontrastOrani(AppColors.text, AppColors.surface).toStringAsFixed(2)}'
        '  onPrimary/primary=${kontrastOrani(AppColors.onPrimary, AppColors.primary).toStringAsFixed(2)}'
        '  onAccent/accent=${kontrastOrani(AppColors.onAccent, AppColors.accent).toStringAsFixed(2)}'
        '  onDarkSoft/darkCard=${kontrastOrani(AppColors.onDarkSoft, AppColors.darkCard).toStringAsFixed(2)}',
      );
    }
    gorunumuUygula(Brightness.light);
  });

  test('takım kimlik paletleri', () {
    for (final ad in [
      'Galatasaray',
      'Trabzonspor',
      'Fenerbahçe',
      'Beşiktaş',
      'BVB 09 Borussia Dortmund',
    ]) {
      final p = takimPaletiBul(ad);
      if (p == null) {
        _yaz('\n═══ $ad — KATALOGDA YOK');
        continue;
      }
      _yaz(
        '\n═══ $ad  ana=${_h(p.ana)} ikincil=${_h(p.ikincil)}'
        '  vurgu=${_h(p.vurgu)} secili=${_h(p.secili)}'
        '  anaÜstüMetin=${_h(okunurMetin(p.ana))}'
        '  ikincilÜstüMetin=${_h(okunurMetin(p.ikincil))}'
        '  ana↔ikincil=${kontrastOrani(p.ana, p.ikincil).toStringAsFixed(2)}',
      );
    }
  });
}
