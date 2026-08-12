// GEÇİCİ ÖLÇÜM ARACI — KUTU AYRIMI VE KÜÇÜK METİN KONTRASTI
// (kullanıcı isteği, 2026-08-12 gece)
//
// NE ÖLÇER: takım temasında bir kutunun (kart, çip, buton) zemininden gerçekten
// ayrılıp ayrılmadığını ve küçük yazıların düştükleri HER yüzeyde okunup
// okunmadığını. Kullanıcı "bazı temalarda kutu olduğu anlaşılmıyor, küçük
// açıklama yazıları okunmuyor" dedi; bu araç hangi takımlarda, hangi çiftte ve
// ne kadar düştüğünü sayıyla verir.
//
// SÜİTE GİRMEZ: dosya adı `_test.dart` ile bitmiyor. Elle çalıştır:
//   flutter test test/tema_ayrim_olcum.dart

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

/// Yüzey ayrımı için makul alt sınır. WCAG'ın "arayüz bileşeni" eşiği 3.0
/// KENARLIK için geçerlidir; iki büyük yüzey arasındaki ton farkı bundan
/// düşük olabilir ama 1.25'in altında göz sınırı seçemiyor.
const double kAyrimEsigi = 1.25;

void main() {
  test('kutu ayrımı ve küçük metin kontrastı — 150 takım', () {
    final olcumler = <String, List<double>>{};
    final dusukler = <String, List<String>>{};

    void olc(String ad, String cift, double deger, double esik) {
      (olcumler[cift] ??= []).add(deger);
      if (deger < esik) {
        (dusukler[cift] ??= []).add('$ad=${deger.toStringAsFixed(2)}');
      }
    }

    for (final ad in kTakimRenkleri.keys) {
      gorunumuKur(GorunumModu.takim, Brightness.light, takimPaletiBul(ad));

      final zemin = AppColors.background;
      final kart = AppColors.surface;
      final ara = AppColors.surfaceSoft;

      // ── KUTU AYRIMI ────────────────────────────────────────────────────
      olc(ad, 'kart/zemin', kontrastOrani(kart, zemin), kAyrimEsigi);
      olc(ad, 'ara/kart', kontrastOrani(ara, kart), kAyrimEsigi);
      olc(ad, 'ara/zemin', kontrastOrani(ara, zemin), kAyrimEsigi);
      // Kenarlık bir ARAYÜZ BİLEŞENİDİR → WCAG 3.0.
      olc(ad, 'kenarlik/kart', kontrastOrani(AppColors.border, kart), 3.0);
      olc(ad, 'kenarlik/zemin', kontrastOrani(AppColors.border, zemin), 3.0);
      // Buton zeminleri
      olc(ad, 'primary/kart', kontrastOrani(AppColors.primary, kart), 3.0);
      olc(
        ad,
        'primarySoft/kart',
        kontrastOrani(AppColors.primarySoft, kart),
        kAyrimEsigi,
      );

      // ── KÜÇÜK METİN — DÜŞTÜĞÜ HER YÜZEYDE ──────────────────────────────
      for (final (yad, yuzey) in [('kart', kart), ('ara', ara)]) {
        olc(ad, 'textSoft/$yad', kontrastOrani(AppColors.textSoft, yuzey), 4.5);
        olc(ad, 'muted/$yad', kontrastOrani(AppColors.muted, yuzey), 4.5);
      }
      olc(
        ad,
        'onBgSoft/zemin',
        kontrastOrani(AppColors.onBackgroundSoft, zemin),
        4.5,
      );
      olc(
        ad,
        'onBgMuted/zemin',
        kontrastOrani(AppColors.onBackgroundMuted, zemin),
        4.5,
      );
      // Buton yazıları
      olc(
        ad,
        'onPrimary/primary',
        kontrastOrani(AppColors.onPrimary, AppColors.primary),
        4.5,
      );
    }

    final adlar = olcumler.keys.toList()..sort();
    debugPrint('ÇİFT                 en düşük   ortanca   DÜŞEN');
    for (final c in adlar) {
      final v = [...olcumler[c]!]..sort();
      final dusen = dusukler[c]?.length ?? 0;
      debugPrint(
        '${c.padRight(20)} ${v.first.toStringAsFixed(2).padLeft(7)}  '
        '${v[v.length ~/ 2].toStringAsFixed(2).padLeft(7)}  '
        '${dusen.toString().padLeft(4)}',
      );
    }
    debugPrint('');
    for (final c in adlar) {
      final d = dusukler[c];
      if (d == null || d.isEmpty) continue;
      debugPrint('--- $c (${d.length}) ---');
      debugPrint(d.take(10).join(' · '));
    }
  });
}
