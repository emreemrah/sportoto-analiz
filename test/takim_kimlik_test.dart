// TAKIM RENGİ ARTIK YAPISAL DEĞİL — KİMLİK RENGİDİR
// (kullanıcı isteği, 2026-08-12)
//
// Bu dosya `tema_uygula_test.dart`'ın YERİNİ ALIR. Eski dosya "yapısal
// renkler paletle değişir" diye bekliyordu; kullanıcı bu yaklaşımı
// kaldırdı. Yeni sözleşme TERSİ: favori takım seçilse bile uygulamanın
// zemini, metni, kartı ve navigasyonu DEĞİŞMEZ — onları yalnız görünüm
// tercihi (açık/koyu/sistem) belirler.
//
// Eski dosyadan TAŞINAN kapsam (silinmedi, uyarlandı):
//  • 148 takımın kendi paletindeki kontrast taraması — palet hâlâ kimlik
//    yüzeylerinde kullanılıyor, okunur olmak zorunda.
//  • Anlamsal renklerin bağımsızlığı.
//  • "Türetilmiş renk haritaları donmaz" testleri — artık tema değişimi
//    takımla değil GÖRÜNÜMLE tetikleniyor.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/match_detail/istatistik_gorsel.dart';
import 'package:masteranaliz/features/match_detail/match_detail_text.dart';
import 'package:masteranaliz/features/radar/radar_center_cards.dart';
import 'package:masteranaliz/widgets/app_ui.dart';

/// Dortmund'un KATALOGDAKİ tam adı (kısmi eşleşme iki kulübü karıştırabilir).
const _kDortmund = 'BVB 09 Borussia Dortmund';

TakimPaleti _palet(String ad) {
  final p = takimPaletiBul(ad);
  expect(p, isNotNull, reason: '$ad katalogda bulunmalı');
  return p!;
}

/// Yapısal alanların o anki değerleri — takım değişiminden ETKİLENMEMELİ.
List<Color> _yapisal() => [
  AppColors.background,
  AppColors.surface,
  AppColors.surfaceSoft,
  AppColors.primary,
  AppColors.primaryDark,
  AppColors.primarySoft,
  AppColors.accent,
  AppColors.accentSoft,
  AppColors.onPrimary,
  AppColors.onAccent,
  AppColors.text,
  AppColors.textSoft,
  AppColors.muted,
  AppColors.border,
  AppColors.darkCard,
  AppColors.darkCardSoft,
  AppColors.onDark,
  AppColors.onDarkSoft,
  AppColors.bg,
  AppColors.card,
  AppColors.cardAlt,
  AppColors.track,
];

void main() {
  // GLOBAL DURUM: `gorunumuUygula` statik alanlara yazar. Her testin temiz
  // başlaması ve dosyanın diğerlerini KİRLETMEMESİ şart.
  setUp(() => gorunumuUygula(Brightness.light));
  tearDown(() => gorunumuUygula(Brightness.light));

  group('Takım YAPISAL renkleri değiştirmez', () {
    test('palet çözmek AppColors\'a hiç dokunmaz', () {
      final once = _yapisal();
      // Dört farklı karakterde takım: açık, koyu, kırmızı, siyah-beyaz.
      for (final ad in [_kDortmund, 'Fenerbahçe', 'Galatasaray', 'Beşiktaş']) {
        _palet(ad);
      }
      expect(_yapisal(), once);
    });

    test('yapısal renkleri belirleyen tek şey GÖRÜNÜMDÜR', () {
      gorunumuUygula(Brightness.light);
      final acik = _yapisal();
      gorunumuUygula(Brightness.dark);
      expect(_yapisal(), isNot(acik));
      gorunumuUygula(Brightness.light);
      expect(_yapisal(), acik);
    });
  });

  group('148 takım — kimlik paleti okunur', () {
    // Palet kimlik yüzeylerinde (profil, arma zemini, takım rozeti)
    // kullanılıyor; kendi içinde okunur olmak zorunda.
    test('paletin kendi metni kendi yüzeyinde AA eşiğini geçer', () {
      final dusenler = <String>[];
      for (final p in tumTakimPaletleri()) {
        final o = kontrastOrani(p.yuzeyUstuMetin, p.yuzey);
        if (o < kAaEsigi) {
          dusenler.add('${p.takim} = ${o.toStringAsFixed(2)}');
        }
      }
      expect(dusenler, isEmpty, reason: dusenler.join(' · '));
    });

    test('buton yazısı vurgunun üstünde AA eşiğini geçer', () {
      final dusenler = <String>[];
      for (final p in tumTakimPaletleri()) {
        final o = kontrastOrani(p.vurguUstuMetin, p.vurgu);
        if (o < kAaEsigi) {
          dusenler.add('${p.takim} = ${o.toStringAsFixed(2)}');
        }
      }
      expect(dusenler, isEmpty, reason: dusenler.join(' · '));
    });

    // NOT: "iki takım rengi dengeli kullanılsın" isteği BURADA ölçülmez.
    // `vurgu` ile `secili` zaten bilerek birbirine yakın iki tondur (aynı
    // ikincil renkten türer); onların farkına bakmak yanlış şeyi ölçerdi.
    // Asıl kural — kutunun zemini sarıysa yazı kırmızı — kimlik yüzeylerinin
    // kendi testinde bekçilenir.
  });

  group('Renk kaynağı denetlenebilir', () {
    test('doğrulanmış sayılan her takım tabloda GERÇEKTEN var', () {
      for (final ad in kResmiKaynakliTakimlar) {
        expect(
          kTakimRenkleri.containsKey(ad),
          isTrue,
          reason: '$ad doğrulanmış işaretli ama tabloda yok',
        );
      }
    });

    test('doğrulanan her takımın değeri kaynaktakiyle aynı', () {
      // Değer kazara değişirse kaynak yorumu YALAN olur; test bunu yakalar.
      const beklenen = <String, TakimRenkCifti>{
        'Galatasaray': (0xFFFDB912, 0xFFA90432),
        'Trabzonspor': (0xFF902F2F, 0xFF4FBFF0),
        'Fenerbahçe': (0xFF00417F, 0xFFFFED00),
        'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
        '1. FC Union Berlin': (0xFFEB1923, 0xFFFFFFFF),
        'US Sassuolo Calcio': (0xFF00A752, 0xFF000000),
        'Rasen Ballsport Leipzig': (0xFFFFFFFF, 0xFFDD013F),
        'TSG 1899 Hoffenheim': (0xFF1961B5, 0xFFFFFFFF),
        'SC Paderborn 07': (0xFF005CA8, 0xFF000000),
        'SV 07 Elversberg': (0xFF000000, 0xFFFFFFFF),
        'FC Lorient': (0xFFF58113, 0xFF000000),
        'Stade Brestois 29': (0xFFED1C24, 0xFFFFFFFF),
        'FC Groningen': (0xFF008E5A, 0xFFFFFFFF),
      };
      beklenen.forEach((ad, cift) {
        expect(kTakimRenkleri[ad], cift, reason: '$ad kaynaktan sapmış');
      });
      // Küme ile beklenen liste AYNI olmalı: biri büyürken diğeri unutulmasın.
      expect(beklenen.keys.toSet(), kResmiKaynakliTakimlar);
    });
  });

  group('Karşılıklı renk — kimlik yüzeyleri', () {
    test('148 takımda her iki yönde de büyük-metin eşiği (3:1) sağlanır', () {
      final dusenler = <String>[];
      for (final p in tumTakimPaletleri()) {
        for (final anaZemin in [true, false]) {
          final c = kimlikCifti(p, anaZemin: anaZemin);
          final o = kontrastOrani(c.yazi, c.zemin);
          if (o < kAaBuyukEsigi) {
            dusenler.add(
              '${p.takim}(anaZemin=$anaZemin)=${o.toStringAsFixed(2)}',
            );
          }
        }
      }
      expect(dusenler, isEmpty, reason: dusenler.join(' · '));
    });

    test('Galatasaray: sarı zeminde KIRMIZI, kırmızı zeminde SARI', () {
      final p = _palet('Galatasaray');
      // ana = kırmızı, ikincil = sarı.
      final kirmiziZemin = kimlikCifti(p, anaZemin: true);
      final sariZemin = kimlikCifti(p, anaZemin: false);
      expect(kirmiziZemin.zemin, p.ana);
      expect(kirmiziZemin.yazi, p.ikincil, reason: 'kırmızı zeminde sarı yazı');
      expect(sariZemin.zemin, p.ikincil);
      expect(sariZemin.yazi, p.ana, reason: 'sarı zeminde kırmızı yazı');
    });

    test('Beşiktaş: siyah-beyaz karşılıklılığı korunur', () {
      final p = _palet('Beşiktaş');
      expect(kimlikCifti(p, anaZemin: true).yazi, p.ikincil);
      expect(kimlikCifti(p, anaZemin: false).yazi, p.ana);
    });

    test('kontrast yetmezse OKUNURLUK kazanır, ters renk değil', () {
      // İki rengi birbirine yakın bir takım: yazı karşı renge DEĞİL, zeminin
      // okunur metnine düşmeli.
      final zayif = tumTakimPaletleri().where(
        (p) => kontrastOrani(p.ana, p.ikincil) < kAaBuyukEsigi,
      );
      expect(zayif, isNotEmpty, reason: 'örnek bulunamadı — test anlamsız');
      for (final p in zayif) {
        final c = kimlikCifti(p);
        expect(c.yazi, isNot(p.ikincil), reason: '${p.takim} okunmaz çift');
        expect(c.yazi, okunurMetin(p.ana));
      }
    });
  });

  group('Anlamsal renkler her koşulda sabit', () {
    test('takım kırmızı bile olsa hata/başarı/uyarı/canlı değişmez', () {
      final once = [
        AppColors.success,
        AppColors.warning,
        AppColors.danger,
        AppColors.info,
        AppColors.live,
      ];
      for (final ad in ['Galatasaray', 'Beşiktaş', _kDortmund]) {
        _palet(ad);
      }
      gorunumuUygula(Brightness.dark);
      expect([
        AppColors.success,
        AppColors.warning,
        AppColors.danger,
        AppColors.info,
        AppColors.live,
      ], once);
    });
  });

  group('Türetilmiş renkler donmaz (görünümle değişir)', () {
    test('istatistik çubuklarının ev/deplasman renkleri görünümü izler', () {
      // ÖNCE açık görünümde OKUNUR — `final` olsaydı değer tam burada donardı.
      final evAcik = kEvRengi;
      final depAcik = kDepRengi;

      gorunumuUygula(Brightness.dark);

      expect(kEvRengi, isNot(evAcik));
      expect(kDepRengi, isNot(depAcik));
      expect(kEvRengi, AppColors.accent);
      expect(kDepRengi, AppColors.primary);
    });

    test('tahmin etiketi renkleri görünümü izler', () {
      final netAcik = kPredMeta['NET']!.color;
      final bosAcik = kPredMetaBos.color;

      gorunumuUygula(Brightness.dark);

      expect(kPredMeta['NET']!.color, isNot(netAcik));
      expect(kPredMetaBos.color, isNot(bosAcik));
      // BANKO yeşildir — anlamsal, değişmemeli.
      expect(kPredMeta['BANKO']!.color, AppColors.green);
    });

    test('radar sınıf kartlarının nötr tonu görünümü izler', () {
      final yetersizAcik = kClassMeta['insufficient_data']!.soft;

      gorunumuUygula(Brightness.dark);

      expect(kClassMeta['insufficient_data']!.soft, isNot(yetersizAcik));
      // Güçlü aday YEŞİL kalır — anlamsal.
      expect(kClassMeta['strong_candidate']!.color, AppColors.success);
    });

    testWidgets('Pill rozeti görünüm değişince YENİ rengi okur', (t) async {
      Color zemin() {
        final k = t.widget<Container>(
          find.descendant(
            of: find.byType(Pill),
            matching: find.byType(Container),
          ),
        );
        return (k.decoration! as BoxDecoration).color!;
      }

      await t.pumpWidget(
        MaterialApp(
          home: Scaffold(body: Pill(label: 'NET')),
        ),
      );
      final acik = zemin();

      gorunumuUygula(Brightness.dark);
      // Widget'ı YENİDEN kurar: `final` harita olsaydı yeniden kurulan
      // widget bile eski rengi okurdu.
      await t.pumpWidget(const SizedBox.shrink());
      await t.pumpWidget(
        MaterialApp(
          home: Scaffold(body: Pill(label: 'NET')),
        ),
      );

      expect(zemin(), isNot(acik));
      expect(zemin(), AppColors.primarySoft);
    });
  });
}
