// HAFTALIK BAŞARI EKRANINDA YAZI BULUNDUĞU YÜZEYE GÖRE TÜRETİLİR.
//
// EMÜLATÖRDE ÖLÇÜLDÜ (16 Ağustos 2026, `t13_haftalik_basari.png`):
//   * "🏁 Bu Haftanın Kapanışı · Sen vs Sistem" şeridi KOYU zeminde KOYU
//     yazıyla çıkıyor ve okunmuyordu. Sebep: yüzey `darkCard`, yazı ise
//     `onPrimary` — yani BAŞKA bir yüzey için türetilmiş renk.
//   * Sayfa başlığı ("Haftalık Başarı") SAYFA ZEMİNİNDE duruyor ama `text`
//     (KART yazısı) kullanıyordu.
//
// Bu, bugün kapatılan BULGU 3/7 ile aynı sınıf: bir yüzey için türetilen renk
// başka bir yüzeyde kullanılıyor. Kural: zeminde `onBackground*`, kart üstünde
// `text`, koyu kartta o yüzeyden türetilmiş renk.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';

/// Takım temaları — gerçek kulüp renkleriyle en zorlu durumlar.
const _temalar = <String, (int, int)>{
  'Galatasaray': (0xFFFDB912, 0xFFA90432),
  'Fenerbahçe': (0xFF00417F, 0xFFFFED00),
  'Trabzonspor': (0xFF902F2F, 0xFF4FBFF0),
  'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
};

void main() {
  yuzeyTestleri();
  group('kapanış şeridi', () {
    test('yazı, ŞERİDİN KENDİ yüzeyinden türetilir (WCAG 4.5:1)', () {
      for (final t in _temalar.entries) {
        final zemin = Color(t.value.$1);
        final kart = Color(t.value.$2);
        // Şerit yüzeyi koyu kart ailesinden; yazı ondan türetilmeli.
        for (final yuzey in [zemin, kart]) {
          final yazi = okunurMetin(yuzey);
          expect(
            kontrastOrani(yazi, yuzey),
            greaterThanOrEqualTo(4.5),
            reason: '${t.key}: türetilen yazı yüzeyde okunmuyor',
          );
        }
      }
    });
  });

  group('kaynak taraması', () {
    final src = File(
      'lib/features/dashboard/user_dashboard_screen.dart',
    ).readAsStringSync();

    test('kapanış şeridi onPrimary KULLANMAZ (yüzeyi darkCard)', () {
      // Şerit gövdesini al: darkCard yüzeyinden sonraki metin stili.
      final i = src.indexOf('Widget _kapanisBaglantisi()');
      expect(i, greaterThan(-1), reason: 'kapanış şeridi bulunamadı');
      final govde = src.substring(i, i + 1400);
      expect(
        govde.contains('AppColors.onPrimary'),
        isFalse,
        reason: 'şerit yine başka yüzeyin yazı rengini kullanıyor',
      );
      expect(
        govde.contains('okunurMetin('),
        isTrue,
        reason: 'yazı, şeridin kendi yüzeyinden türetilmeli',
      );
    });

    test('sayfa başlığı ZEMİN yazı rengini kullanır', () {
      final i = src.indexOf("'Haftalık Başarı',");
      expect(i, greaterThan(-1));
      final govde = src.substring(i, i + 500);
      expect(
        RegExp(r'color:\s*AppColors\.text\b').hasMatch(govde),
        isFalse,
        reason: 'sayfa başlığı zeminde KART yazı rengini kullanıyor',
      );
      expect(govde.contains('onBackground'), isTrue);
    });
  });
}

// ——— YÜZEY GÖRÜNÜRLÜĞÜ (kullanıcı bulgusu, 16 Ağustos 2026) ———
//
// "1. Hafta" seçicisinin ve SEÇİLİ sekmenin ("Özet") arka plan kartı takım
// temasında görünmüyordu. Sebep: ikisi de düz `AppColors.primary` ile
// boyanıyor, ama "birinci renk" modunda SAYFA ZEMİNİ de primary — aynı renge
// düşünce yüzey kayboluyor.

void yuzeyTestleri() {
  group('hafta seçici / seçili sekme yüzeyi', () {
    test('yüzey sayfa zemininden AYRIŞIR (her takım temasında)', () {
      for (final t in _temalar.entries) {
        final zemin = Color(t.value.$1);
        // Takım temasında primary = zemin; ayrışan yüzey üretilmeli.
        final yuzey = ayrisanYuzey(zemin, zemin);
        expect(
          kontrastOrani(yuzey, zemin),
          greaterThanOrEqualTo(1.4),
          reason: '${t.key}: yüzey zeminle aynı kaldı, kart görünmez',
        );
        // Yüzeyin üstündeki yazı da okunmalı.
        expect(
          kontrastOrani(okunurMetin(yuzey), yuzey),
          greaterThanOrEqualTo(4.5),
          reason: '${t.key}: yüzey yazısı okunmuyor',
        );
      }
    });

    test('hafta karti ve secili sekme KART yuzeyinde, gorunur', () {
      // KULLANICI KARARI (16 Agustos 2026): "kart kirmizi olacak, yazi sari".
      // Onceki iki deneme reddedildi: (a) zeminden ayrisan amber dolgu,
      // (b) zemin dolgusu + kirmizi yazi. Yasak olan tek sey, ZEMINDE duran
      // yuzeyin duz `primary` olmasi — o zaman kart tamamen gorunmez olur.
      final src = File(
        'lib/features/dashboard/user_dashboard_screen.dart',
      ).readAsStringSync();

      final i = src.indexOf('padding: const EdgeInsets.all(Spacing.sm)');
      expect(i, greaterThan(-1), reason: 'hafta secici bulunamadi');
      final govde = src.substring(i, i + 1400);
      expect(govde.contains('color: AppColors.card'), isTrue,
          reason: 'hafta karti kart yuzeyinde olmali');
      expect(RegExp(r'color: AppColors.primary,').hasMatch(govde), isFalse,
          reason: 'zeminde duz primary yuzey kart gorunmez yapar');

      final c = src.indexOf('Widget _cip(');
      final cip = src.substring(c, c + 800);
      expect(cip.contains('secili ? AppColors.primary : AppColors.border'), isTrue,
          reason: 'secili sekme sari cerceveyle ayrilmali');
      expect(cip.contains('secili ? AppColors.primary : AppColors.textSoft'), isTrue,
          reason: 'secili sekme yazisi sari olmali');

      expect(src.contains('_haftaYuzeyi'), isFalse,
          reason: 'begenilmeyen ayrisan-ton cozumu hala duruyor');
    });
  });
}
