// MÜHÜRLÜ ANALİZ ŞERİDİ HER TEMADA OKUNUR.
//
// KAPSAMLI KOD DENETİMİNDE BULUNDU (16 Ağustos 2026): tema katmanı dışındaki
// sabit renkler tarandı; `snapshot_seal_banner.dart` şeridin yazısını ve
// çerçevesini HAM `AppColors.success` ile çiziyordu.
//
// ÖLÇÜM (şeridin kendi yüzeyine karşı, WCAG AA metin eşiği 4.5):
//   Galatasaray  ham 2.44   Fenerbahçe  ham 2.57
//   Trabzonspor  ham 1.56   Beşiktaş    ham 3.08
// Trabzonspor'da 1.56 — pratikte okunmuyordu.
//
// `anlamsalTon` hue'yu KORUYARAK tonu okunana dek iter (4.52–4.79): yeşil
// yine yeşildir, yalnız görünür olur. Bu, aynı gün kapatılan BULGU 3/7
// ailesinin gözden kaçmış üyesiydi.
//
// ŞERİT NEDEN ÖNEMLİ: "Mühürlü Analiz" yazısı, tahminlerin kilitlendiğini ve
// sonradan değiştirilemeyeceğini söyler — karnelerin geriye dönük
// oynanamamasının kullanıcıya verilen güvencesidir. Okunmayan bir güvence
// güvence değildir.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/takim_gorunumu.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

const _temalar = <String, (int, int)>{
  'Galatasaray': (0xFFFDB912, 0xFFA90432),
  'Fenerbahçe': (0xFF00417F, 0xFFFFED00),
  'Trabzonspor': (0xFF902F2F, 0xFF4FBFF0),
  'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
  'Le Mans FC': (0xFFFFD100, 0xFFE2001A),
};

/// Şeridin gerçek yüzeyi: kartın üstüne %8 yeşil.
Color _yuzey() => Color.alphaBlend(
  const Color(0xFF22C55E).withValues(alpha: 0.08),
  AppColors.card,
);

void main() {
  for (final t in _temalar.entries) {
    test('${t.key}: mühür yazısı AA tutuyor', () {
      takimGorunumunuUygula(
        paletUret(
          takim: t.key,
          ana: Color(t.value.$1),
          ikincil: Color(t.value.$2),
        ),
      );
      final yuzey = _yuzey();
      final ton = AppColors.anlamsalTon(AppColors.success, yuzey);

      expect(
        kontrastOrani(ton, yuzey),
        greaterThanOrEqualTo(4.5),
        reason: '${t.key}: mühür yazısı okunmuyor — "değiştirilemez" güvencesi '
            'görünmüyorsa güvence değildir',
      );
    });
  }

  test('kaynakta ham success KULLANILMIYOR', () {
    final src = File(
      'lib/widgets/snapshot_seal_banner.dart',
    ).readAsStringSync();
    final i = src.indexOf('🔏 Mühürlü Analiz');
    expect(i, greaterThan(-1), reason: 'mühür şeridi bulunamadı');
    final govde = src.substring(i - 1600, i + 400);
    expect(
      RegExp(r'color:\s*AppColors\.success\b').hasMatch(govde),
      isFalse,
      reason: 'şerit yine ham success kullanıyor — takım temasında okunmaz',
    );
    expect(govde.contains('muhurTonu'), isTrue);
  });
}
