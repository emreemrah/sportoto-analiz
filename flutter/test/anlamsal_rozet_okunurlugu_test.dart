// ANLAMSAL ROZETLERİN YAZISI HER TEMADA OKUNMALI.
//
// Rozetlerin yazısı/kenarlığı anlamsal rengin KENDİSİYDİ
// (`Text(color: AppColors.success)` + `color: AppColors.successSoft`) ve o
// renk `const`. Takım temasında zemin `_anlamsalYuzey` ile yeniden
// hesaplandığı için okunuyordu; VARSAYILAN açık/koyu modda o koruma yoktu.
//
// ÖLÇÜLDÜ (16 Ağustos 2026, açık/koyu mod):
//   success #16A34A / successSoft #E8F7EE = 2.98   → AA (4.5) ALTI
//   warning · danger · info aynı sınıfta.
//
// ÇÖZÜM: `AppColors.on*Soft` — `kimlikTonu` ile hue VE doygunluk korunarak
// ton okunana dek itilir. Yeşil yeşil, kırmızı kırmızı kalır; yalnız okunur.
// Tek hesap yeri `AppColors.anlamsalYazilariTazele()`; iki tema yolu da onu
// çağırır.
//
// Bu test hem düzeltmeyi hem de KİMLİĞİN KORUNDUĞUNU sabitler ve yeni bir
// tema eklendiğinde aynı soruyu sorar.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_gorunumu.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

/// (yumuşak yüzey, üstündeki yazı, ham anlamsal renk)
List<(String, Color, Color, Color)> _ciftler() => [
  ('success', AppColors.successSoft, AppColors.onSuccessSoft, AppColors.success),
  ('warning', AppColors.warningSoft, AppColors.onWarningSoft, AppColors.warning),
  ('danger', AppColors.dangerSoft, AppColors.onDangerSoft, AppColors.danger),
  ('info', AppColors.infoSoft, AppColors.onInfoSoft, AppColors.info),
];

const _takimlar = ['Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor'];

void main() {
  group('Anlamsal rozet yazısı', () {
    test('KUSUR KAYDI: ham anlamsal renk varsayılan modlarda AA tutmuyordu', () {
      gorunumuUygula(Brightness.light);
      // En az bir çift eşiğin altındaydı — düzeltmenin gerekçesi budur.
      final altta = _ciftler()
          .where((c) => kontrastOrani(c.$4, c.$2) < 4.5)
          .map((c) => c.$1)
          .toList();
      expect(altta, isNotEmpty, reason: 'ölçülen kusur kayboldu mu?');
    });

    for (final mod in [Brightness.light, Brightness.dark]) {
      test('görünüm=${mod.name}: dört rozet yazısı da AA tutar', () {
        gorunumuUygula(mod);
        for (final (ad, zemin, yazi, _) in _ciftler()) {
          expect(
            kontrastOrani(yazi, zemin),
            greaterThanOrEqualTo(4.5),
            reason: '$ad rozeti ${mod.name} görünümünde okunmuyor',
          );
        }
      });
    }

    for (final takim in _takimlar) {
      test('takım=$takim: dört rozet yazısı da AA tutar', () {
        final p = takimPaletiBul(takim);
        if (p == null) return;
        takimGorunumunuUygula(p);
        for (final (ad, zemin, yazi, _) in _ciftler()) {
          expect(
            kontrastOrani(yazi, zemin),
            greaterThanOrEqualTo(4.5),
            reason: '$ad rozeti $takim temasında okunmuyor',
          );
        }
      });
    }

    test('KİMLİK KORUNUR — rozet takım rengine kaymaz', () {
      // "Resmî yeşil", "hata kırmızısı" anlamı takımdan bağımsız sürmeli;
      // aksi hâlde Galatasaray'da "resmî" kırmızıya dönüp "canlı" ile
      // çakışırdı.
      for (final takim in _takimlar) {
        final p = takimPaletiBul(takim);
        if (p == null) continue;
        takimGorunumunuUygula(p);
        for (final (ad, _, yazi, ham) in _ciftler()) {
          final fark =
              (HSLColor.fromColor(yazi).hue - HSLColor.fromColor(ham).hue).abs();
          expect(
            fark,
            lessThan(1.0),
            reason: '$takim temasında $ad rozeti kendi renk ailesinden çıkmış',
          );
        }
      }
    });
  });
}
