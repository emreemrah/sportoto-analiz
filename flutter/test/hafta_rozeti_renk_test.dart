// HAFTA ROZETİ RENKLERİ (kullanıcı kararı, 16 Ağustos 2026).
//
// İstek: "2. hafta rengi 1. haftada olması lazım, 2. hafta rengi de koyu mavi
// yani uygulamanın ana rengi olsun".
//
// Yani:
//   GEÇEN hafta  → önceden GÜNCEL haftada olan vurgu (accent) dolgusu
//   GÜNCEL hafta → uygulamanın ANA rengi: marka koyu mavisi (#0B1B3A)
//
// Marka mavisi sabit bir KİMLİKTİR, ama körü körüne basılamaz: takım temasında
// kart da koyu olabilir (ör. Galatasaray bordosu, Beşiktaş siyahı) ve rozet
// kartın içinde erir. `ayrisanYuzey` hue'yu KORUYARAK yalnız karttan ayrışacak
// kadar ton iter — mavi yine mavi, ama rozet hep görünür.
//
// Bu, bugün ALTI kez yaşanan "yüzey zeminden/karttan ayrışmıyor" hatasına
// düşmemek için bilinçli: sabit renk istemek, görünmez rozet istemek değildir.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/takim_gorunumu.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/home/home_screen.dart';

const _temalar = <String, (int, int)>{
  'Galatasaray': (0xFFFDB912, 0xFFA90432),
  'Fenerbahçe': (0xFF00417F, 0xFFFFED00),
  'Trabzonspor': (0xFF902F2F, 0xFF4FBFF0),
  'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
};

void main() {
  test('marka mavisi uygulamanın ana rengidir', () {
    expect(kMarkaMavisi, const Color(0xFF0B1B3A));
  });

  for (final t in _temalar.entries) {
    group(t.key, () {
      setUp(() {
        takimGorunumunuUygula(
          paletUret(
            takim: t.key,
            ana: Color(t.value.$1),
            ikincil: Color(t.value.$2),
          ),
        );
      });

      test('GÜNCEL hafta rozeti mavi KİMLİĞİNİ korur', () {
        final yuzey = ayrisanYuzey(kMarkaMavisi, AppColors.card);
        final h = HSLColor.fromColor(yuzey).hue;
        final markaH = HSLColor.fromColor(kMarkaMavisi).hue;
        expect(
          (h - markaH).abs(),
          lessThan(12),
          reason: '${t.key}: ton itilirken mavi kimliği kaybolmuş '
              '(hue $markaH → $h)',
        );
      });

      test('GÜNCEL hafta rozeti KARTTAN ayrışır (kaybolmaz)', () {
        final yuzey = ayrisanYuzey(kMarkaMavisi, AppColors.card);
        expect(
          kontrastOrani(yuzey, AppColors.card),
          greaterThanOrEqualTo(1.4),
          reason: '${t.key}: mavi rozet kartın içinde eriyor',
        );
      });

      test('rozet yazısı KENDİ yüzeyinden türetilir ve okunur', () {
        final yuzey = ayrisanYuzey(kMarkaMavisi, AppColors.card);
        expect(
          kontrastOrani(okunurMetin(yuzey), yuzey),
          greaterThanOrEqualTo(4.5),
          reason: '${t.key}: rozet yazısı okunmuyor',
        );
      });

      test('GEÇEN hafta rozeti vurgu (accent) dolgusunu alır', () {
        // Yer değiştirme: accent artık GEÇEN haftada.
        expect(
          kontrastOrani(AppColors.onAccent, AppColors.accent),
          greaterThanOrEqualTo(4.5),
          reason: '${t.key}: geçen hafta rozetinin yazısı okunmuyor',
        );
        expect(
          AppColors.accent,
          isNot(equals(kMarkaMavisi)),
          reason: '${t.key}: iki hafta rozeti aynı renge düştü, ayırt edilemez',
        );
      });
    });
  }
}
