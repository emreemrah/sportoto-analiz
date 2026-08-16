// DURUM GÖSTERGESİ HER TEMADA GÖRÜNMELİ.
//
// 🟢 resmî · 🟡 henüz resmî değil · 🔴 canlı — bu üçlü, projenin
// "yalnız resmî sonuç kesindir" kuralının GÖRSEL anahtarıdır
// (score_legend.dart başlığı: "kaldırılmaz"). Görünmemesi kozmetik değil,
// DÜRÜSTLÜK ihlalidir: kullanıcı resmî ile canlıyı ayırt edemez.
//
// ÖLÇÜLEN KUSUR (16 Ağustos 2026) — ham anlamsal renk, bulunduğu yüzeye göre
// tonlanmıyordu:
//   Galatasaray zemin #FDB912 · warning 1.24 · success 1.90 · canlı 2.74
//   Trabzonspor kart  #4FBFF0 · warning 1.03 · success 1.58 · canlı 2.27
//   Açık mod   kart  #FFFFFF · warning 2.15
// Grafik nesneler için WCAG eşiği 3:1; metin için 4.5.
//
// ÇÖZÜM: `AppColors.anlamsalTon(renk, yüzey)` — hue ve doygunluk KORUNARAK
// ton okunana dek itilir. Yüzeyi çağıran taraf bildirir (SurpriseBadge'in
// `zeminde` parametresi), çünkü aynı rozet hem zeminde hem kartta çiziliyor.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_gorunumu.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

const _takimlar = ['Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor'];

/// Göstergedeki üç durum rengi (score_legend.dart ile aynı sıra).
List<(String, Color)> _durumlar() => [
  ('resmî', AppColors.success),
  ('henüz resmî değil', AppColors.warning),
  ('canlı', AppColors.live),
];

void _temalar(void Function(String) f) {
  gorunumuUygula(Brightness.light);
  f('açık');
  gorunumuUygula(Brightness.dark);
  f('koyu');
  for (final t in _takimlar) {
    final p = takimPaletiBul(t);
    if (p == null) continue;
    takimGorunumunuUygula(p);
    f(t);
  }
}

void main() {
  _haftaRozetiTestleri();
  group('Durum göstergesi', () {
    test('KUSUR KAYDI: ham renk bazı temalarda eşiğin ALTINDAYDI', () {
      final altta = <String>[];
      _temalar((tema) {
        for (final (ad, c) in _durumlar()) {
          if (kontrastOrani(c, AppColors.background) < 3.0) {
            altta.add('$tema/$ad/zemin');
          }
          if (kontrastOrani(c, AppColors.card) < 3.0) {
            altta.add('$tema/$ad/kart');
          }
        }
      });
      expect(altta, isNotEmpty, reason: 'ölçülen kusur kayboldu mu?');
    });

    test('ZEMİNDE: üç durum da her temada okunur', () {
      _temalar((tema) {
        for (final (ad, c) in _durumlar()) {
          final ton = AppColors.anlamsalTon(c, AppColors.background);
          expect(
            kontrastOrani(ton, AppColors.background),
            greaterThanOrEqualTo(3.0),
            reason: '$tema temasında "$ad" noktası zeminde görünmüyor',
          );
        }
      });
    });

    test('KARTTA: üç durum da her temada okunur', () {
      _temalar((tema) {
        for (final (ad, c) in _durumlar()) {
          final ton = AppColors.anlamsalTon(c, AppColors.card);
          expect(
            kontrastOrani(ton, AppColors.card),
            greaterThanOrEqualTo(3.0),
            reason: '$tema temasında "$ad" rozeti kartta görünmüyor',
          );
        }
      });
    });

    test('KİMLİK KORUNUR — yeşil yeşil, sarı sarı kalır', () {
      _temalar((tema) {
        for (final (ad, c) in _durumlar()) {
          for (final yuzey in [AppColors.background, AppColors.card]) {
            final fark = (HSLColor.fromColor(AppColors.anlamsalTon(c, yuzey)).hue -
                    HSLColor.fromColor(c).hue)
                .abs();
            expect(
              fark,
              lessThan(1.0),
              reason: '$tema temasında "$ad" kendi renk ailesinden çıkmış',
            );
          }
        }
      });
    });

    test('SurpriseBadge yüzeyi çağırandan alır (zeminde/kartta ayrı ton)', () {
      final p = takimPaletiBul('Galatasaray');
      if (p == null) return;
      takimGorunumunuUygula(p);
      // Zemin sarı, kart bordo → aynı ham renk iki farklı ton üretmeli.
      final zeminTon = AppColors.anlamsalTon(LabelColors.yellow, AppColors.background);
      final kartTon = AppColors.anlamsalTon(LabelColors.yellow, AppColors.card);
      expect(zeminTon, isNot(equals(kartTon)));
      expect(kontrastOrani(zeminTon, AppColors.background), greaterThanOrEqualTo(3.0));
      expect(kontrastOrani(kartTon, AppColors.card), greaterThanOrEqualTo(3.0));
    });
  });
}

// ── HAFTA ROZETİ: İKİ HAFTA HER TEMADA AYIRT EDİLMELİ ────────────────────────
//
// Ölçülen kusur (16 Ağustos 2026, Galatasaray teması):
//   warningSoft #56411C (hue 38) · primarySoft #573E01 (hue 43)
// İki hafta rozeti neredeyse AYNI renkti; ayrım renge dayandığı için takım
// paleti iki tonu birbirine yaklaştırınca bilgi kayboluyordu. Ayrıca
// `_anlamsalYuzey` doygunluğu düşürüp parlaklığı karta çektiği için amber
// kahverengiye düşüyordu ("çamurlu" görünüm).
//
// Yeni kural: ayrım BİÇİMDE — güncel hafta dolgulu, geçen hafta çerçeveli.
// Renk yine bilgi taşır ama TEK taşıyıcı değildir.
void _haftaRozetiTestleri() {
  group('Hafta rozeti', () {
    test('geçen hafta çerçevesi kartta okunur (her tema)', () {
      _temalar((tema) {
        final ton = AppColors.anlamsalTon(AppColors.warning, AppColors.card);
        expect(
          kontrastOrani(ton, AppColors.card),
          greaterThanOrEqualTo(3.0),
          reason: '$tema temasında geçen hafta rozeti kartta görünmüyor',
        );
      });
    });

    test('güncel hafta dolgusunun yazısı okunur (her tema)', () {
      _temalar((tema) {
        expect(
          kontrastOrani(AppColors.onAccent, AppColors.accent),
          greaterThanOrEqualTo(4.5),
          reason: '$tema temasında güncel hafta rozeti yazısı okunmuyor',
        );
      });
    });

    test('AYRIM RENGE BAĞLI DEĞİL: biçim farkı her palette durur', () {
      // Renkler çakışsa bile (dolgulu ↔ çerçeveli) ayrım sürer. Bu testin
      // koruduğu şey: ayrımın TEK taşıyıcısı renk olmamalı.
      _temalar((tema) {
        final gecen = AppColors.anlamsalTon(AppColors.warning, AppColors.card);
        final guncel = AppColors.accent;
        // İkisi aynı renge düşse bile kabul: biçim ayırıyor. Test yalnız
        // ikisinin de KENDİ zemininde okunur olduğunu şart koşar.
        expect(kontrastOrani(gecen, AppColors.card), greaterThanOrEqualTo(3.0),
            reason: '$tema: çerçeve okunmuyor');
        expect(kontrastOrani(AppColors.onAccent, guncel),
            greaterThanOrEqualTo(4.5),
            reason: '$tema: dolgu yazısı okunmuyor');
      });
    });
  });
}
