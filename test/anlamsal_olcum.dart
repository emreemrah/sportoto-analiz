// ÖLÇÜM ARACI — süite dahil DEĞİL (dosya adı `_test.dart` ile bitmiyor).
// Anlamsal rozetlerin (başarı/uyarı/hata/bilgi) kendi yumuşak zeminleri
// üzerindeki okunabilirliğini iki takım yönünde birden tarar.
//
// Çalıştırma:  flutter test test/anlamsal_olcum.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

void main() {
  test('anlamsal rozet okunabilirliği', () {
    final ciftler = <String, (Color, Color) Function()>{
      'success': () => (AppColors.success, AppColors.successSoft),
      'warning': () => (AppColors.warning, AppColors.warningSoft),
      'danger': () => (AppColors.danger, AppColors.dangerSoft),
      'info': () => (AppColors.info, AppColors.infoSoft),
    };

    for (final p in [Brightness.light, Brightness.dark]) {
      gorunumuUygula(p);
      final satir = <String>[];
      for (final e in ciftler.entries) {
        final (yazi, zemin) = e.value();
        satir.add('${e.key}=${kontrastOrani(yazi, zemin).toStringAsFixed(2)}');
      }
      debugPrint('── TEMEL ${p.name}: ${satir.join('  ')}');
    }

    for (final modu in [GorunumModu.takim, GorunumModu.takimTers]) {
      final dusen = <String, int>{};
      var enKotu = 99.0;
      var enKotuAd = '';
      var enAzAyrim = 99.0;
      var enAzAyrimAd = '';
      for (final ad in kTakimRenkleri.keys) {
        final p = takimPaletiBul(ad)!;
        gorunumuKur(modu, Brightness.light, p);
        for (final e in ciftler.entries) {
          final (yazi, zemin) = e.value();
          final o = kontrastOrani(yazi, zemin);
          if (o < 4.5) {
            dusen[e.key] = (dusen[e.key] ?? 0) + 1;
          }
          if (o < enKotu) {
            enKotu = o;
            enKotuAd = '$ad ${e.key}';
          }
        }
        // Rozet zemini KARTTAN da ayrışmalı.
        for (final e in ciftler.entries) {
          final (_, zemin) = e.value();
          final ayrim = kontrastOrani(zemin, AppColors.surface);
          if (ayrim < enAzAyrim) {
            enAzAyrim = ayrim;
            enAzAyrimAd = '$ad ${e.key}';
          }
        }
      }
      debugPrint('── ${modu.anahtar} · ${kTakimRenkleri.length} takım');
      debugPrint('   düşen: $dusen');
      debugPrint('   en kötü yazı: $enKotuAd = ${enKotu.toStringAsFixed(2)}');
      debugPrint(
        '   en az ayrım: $enAzAyrimAd = ${enAzAyrim.toStringAsFixed(3)}',
      );

      // ANLAMSAL RENK DOĞRUDAN KART/ZEMİN ÜSTÜNDE (yumuşak zemin olmadan):
      // ör. profil kartındaki yeşil "✓ doğrulandı".
      final duz = <String, int>{};
      var duzEnKotu = 99.0;
      var duzEnKotuAd = '';
      for (final ad in kTakimRenkleri.keys) {
        gorunumuKur(modu, Brightness.light, takimPaletiBul(ad)!);
        for (final e in ciftler.entries) {
          final (renk, _) = e.value();
          final yuzeyler = {
            'kart': AppColors.surface,
            'zemin': AppColors.background,
          };
          for (final y in yuzeyler.entries) {
            final o = kontrastOrani(renk, y.value);
            if (o < 4.5) {
              duz['${e.key}/${y.key}'] = (duz['${e.key}/${y.key}'] ?? 0) + 1;
            }
            if (o < duzEnKotu) {
              duzEnKotu = o;
              duzEnKotuAd = '$ad ${e.key}/${y.key}';
            }
          }
        }
      }
      debugPrint('   DÜZ düşen: $duz');
      debugPrint(
        '   DÜZ en kötü: $duzEnKotuAd = ${duzEnKotu.toStringAsFixed(2)}',
      );
    }
  });
}
