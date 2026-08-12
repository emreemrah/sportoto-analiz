// GEÇİCİ ÖLÇÜM ARACI — İKİ RENKLİ TEMA (kullanıcı isteği, 2026-08-12).
//
// NE ÖLÇER: her takımın iki RESMÎ rengi doğrudan birbirinin üstünde okunuyor
// mu? Yeni tema kuralı "zemin = ana, kart = ikincil, kart yazısı = ana"
// dediği için bu oran tasarımın taşıyıcı bilinmeyeni: düşükse ton ayarı
// (kimlikTonu) kaç takımda devreye girecek onu söyler.
//
// SÜİTE GİRMEZ: dosya adı `_test.dart` ile bitmiyor. Elle çalıştır:
//   flutter test test/iki_renk_olcum.dart

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';

void main() {
  test('iki resmî rengin birbirine karşı kontrastı', () {
    final satirlar = <({String ad, double oran, double duzeltilmis})>[];

    for (final giris in kTakimRenkleri.entries) {
      final ana = Color(giris.value.$1);
      final ikincil = Color(giris.value.$2);
      final oran = kontrastOrani(ana, ikincil);
      // Ton ayarından SONRA ne oluyor? İkincil zemin kabul edilip ana renk
      // yazı olarak itiliyor.
      final duzeltilmis = kontrastOrani(kimlikTonu(ana, ikincil), ikincil);
      satirlar.add((ad: giris.key, oran: oran, duzeltilmis: duzeltilmis));
    }

    satirlar.sort((a, b) => a.oran.compareTo(b.oran));

    final toplam = satirlar.length;
    final gecen = satirlar.where((s) => s.oran >= kAaEsigi).length;
    final buyukGecen = satirlar.where((s) => s.oran >= kAaBuyukEsigi).length;
    final tonSonrasi = satirlar.where((s) => s.duzeltilmis >= kAaEsigi).length;

    debugPrint('TAKIM SAYISI                : $toplam');
    debugPrint('ham iki renk AA (4.5) geçen : $gecen');
    debugPrint('ham iki renk 3.0 geçen      : $buyukGecen');
    debugPrint('kimlikTonu SONRASI AA geçen : $tonSonrasi');
    debugPrint('');
    debugPrint('--- EN DÜŞÜK 25 (ham oran) ---');
    for (final s in satirlar.take(25)) {
      debugPrint(
        '${s.oran.toStringAsFixed(2).padLeft(5)}  →  '
        '${s.duzeltilmis.toStringAsFixed(2).padLeft(5)}   ${s.ad}',
      );
    }
    debugPrint('');
    debugPrint('--- ÖRNEK TAKIMLAR ---');
    for (final ad in [
      'Galatasaray',
      'Fenerbahçe',
      'Beşiktaş',
      'Trabzonspor',
      'Borussia Dortmund',
    ]) {
      final s = satirlar.where((e) => e.ad == ad).firstOrNull;
      if (s == null) {
        debugPrint('$ad — KATALOGDA YOK');
        continue;
      }
      final ana = Color(kTakimRenkleri[ad]!.$1);
      final ikincil = Color(kTakimRenkleri[ad]!.$2);
      final ayarli = kimlikTonu(ana, ikincil);
      String hx(Color c) =>
          '#${((c.r * 255).round() << 16 | (c.g * 255).round() << 8 | (c.b * 255).round()).toRadixString(16).padLeft(6, '0').toUpperCase()}';
      debugPrint(
        '$ad: ana ${hx(ana)} / ikincil ${hx(ikincil)} — '
        'ham ${s.oran.toStringAsFixed(2)}, '
        'ton ayarlı ana ${hx(ayarli)} → ${s.duzeltilmis.toStringAsFixed(2)}',
      );
    }
  });
}
