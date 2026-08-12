// GÖRÜNÜM MODU — AÇIK / KOYU / SİSTEM (kullanıcı isteği, 2026-08-12)
//
// Bu dosya iki şeyi bekçiler:
//  1) Tercih çözümlemesi ve kalıcılığı — varsayılan SİSTEM, tanınmayan değer
//     sessizce varsayılana düşer (uydurma yok).
//  2) HER İKİ paletin kontrast sağlığı. Değerler elle yazıldığı için tek
//     güvence budur; "olur herhâlde" denmez, ölçülür.

import 'dart:io';

import 'package:flutter/material.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:masteranaliz/core/prefs.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/profile/gorunum_secim_screen.dart';

/// Yazı ↔ zemin çiftleri: yazı DÜŞTÜĞÜ her zeminde okunmalı.
List<({String ad, Color yazi, Color zemin})> _ciftler() => [
  (ad: 'text/surface', yazi: AppColors.text, zemin: AppColors.surface),
  (ad: 'text/background', yazi: AppColors.text, zemin: AppColors.background),
  (ad: 'text/surfaceSoft', yazi: AppColors.text, zemin: AppColors.surfaceSoft),
  (ad: 'textSoft/surface', yazi: AppColors.textSoft, zemin: AppColors.surface),
  (
    ad: 'textSoft/background',
    yazi: AppColors.textSoft,
    zemin: AppColors.background,
  ),
  // primary ve accent KART İÇİNDE YAZI olarak da kullanılıyor.
  (ad: 'primary/surface', yazi: AppColors.primary, zemin: AppColors.surface),
  (ad: 'accent/surface', yazi: AppColors.accent, zemin: AppColors.surface),
  // …ve ZEMİN olarak: üstlerindeki yazı okunmalı.
  (
    ad: 'onPrimary/primary',
    yazi: AppColors.onPrimary,
    zemin: AppColors.primary,
  ),
  (
    ad: 'onPrimarySoft/primary',
    yazi: AppColors.onPrimarySoft,
    zemin: AppColors.primary,
  ),
  (ad: 'onAccent/accent', yazi: AppColors.onAccent, zemin: AppColors.accent),
  // Vurgulu panel (hero).
  (ad: 'onHero/heroZemin', yazi: AppColors.onHero, zemin: AppColors.heroZemin),
  (
    ad: 'onHeroSoft/heroZemin',
    yazi: AppColors.onHeroSoft,
    zemin: AppColors.heroZemin,
  ),
  // Koyu panel (Haftalık Özet, bildirimler, yan menü).
  (ad: 'onDark/darkCard', yazi: AppColors.onDark, zemin: AppColors.darkCard),
  (
    ad: 'onDarkSoft/darkCard',
    yazi: AppColors.onDarkSoft,
    zemin: AppColors.darkCard,
  ),
  (
    ad: 'onDark/darkCardSoft',
    yazi: AppColors.onDark,
    zemin: AppColors.darkCardSoft,
  ),
];

void main() {
  // `setPref` diske de yazar; testte eklenti yoksa yazma
  // `MissingPluginException` ile TEST BİTTİKTEN SONRA patlıyor ve suçu
  // rastgele bir teste yıkıyordu (ölçüldü). Paketin kendi bellek taklidi
  // bağlanır — davranış aynı, disk yok.
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() => SharedPreferences.setMockInitialValues({}));

  setUp(() => gorunumuUygula(Brightness.light));
  tearDown(() => gorunumuUygula(Brightness.light));

  group('Tercih çözümlemesi', () {
    test('varsayılan SİSTEM', () {
      expect(GorunumModu.cozumle(null), GorunumModu.sistem);
    });

    test('tanınmayan değer sessizce sisteme düşer — uydurma yok', () {
      expect(GorunumModu.cozumle('mor'), GorunumModu.sistem);
      expect(GorunumModu.cozumle(''), GorunumModu.sistem);
      expect(GorunumModu.cozumle(42), GorunumModu.sistem);
    });

    test('acik / koyu çözümlenir', () {
      expect(GorunumModu.cozumle('acik'), GorunumModu.acik);
      expect(GorunumModu.cozumle('koyu'), GorunumModu.koyu);
    });

    test('anahtar ENUM ADINDAN bağımsız (karartma uyumu)', () {
      // Diskteki değer sabit metindir; enum adı değişse bile eski kayıt okunur.
      expect(GorunumModu.sistem.anahtar, 'sistem');
      expect(GorunumModu.acik.anahtar, 'acik');
      expect(GorunumModu.koyu.anahtar, 'koyu');
      for (final m in GorunumModu.values) {
        expect(GorunumModu.cozumle(m.anahtar), m);
      }
    });

    test('prefs varsayılanı sistemdir', () {
      expect(getPref('gorunumModu'), 'sistem');
      expect(gorunumModu(), GorunumModu.sistem);
    });
  });

  group('Etkin parlaklık', () {
    test('sistem seçiliyken CİHAZI izler', () {
      expect(
        etkinParlaklik(Brightness.dark, GorunumModu.sistem),
        Brightness.dark,
      );
      expect(
        etkinParlaklik(Brightness.light, GorunumModu.sistem),
        Brightness.light,
      );
    });

    test('açık/koyu seçiliyken cihaz ayarı YOK SAYILIR', () {
      expect(
        etkinParlaklik(Brightness.dark, GorunumModu.acik),
        Brightness.light,
      );
      expect(
        etkinParlaklik(Brightness.light, GorunumModu.koyu),
        Brightness.dark,
      );
    });
  });

  group('Palet uygulanır', () {
    test('koyu görünümde zemin KOYU, açıkta AÇIK', () {
      gorunumuUygula(Brightness.dark);
      expect(gorecelParlaklik(AppColors.background), lessThan(0.05));
      expect(gorecelParlaklik(AppColors.text), greaterThan(0.5));

      gorunumuUygula(Brightness.light);
      expect(gorecelParlaklik(AppColors.background), greaterThan(0.5));
      expect(gorecelParlaklik(AppColors.text), lessThan(0.05));
    });

    test('eski takma adlar da çevrilir (bg / card / cardAlt / textMuted)', () {
      gorunumuUygula(Brightness.dark);
      expect(AppColors.bg, AppColors.background);
      expect(AppColors.card, AppColors.surface);
      expect(AppColors.textMuted, AppColors.muted);
      expect(AppColors.gray, AppColors.muted);
      expect(AppColors.cardAlt, KoyuRenkler.cardAlt);
      expect(AppColors.track, KoyuRenkler.track);
    });

    test('idempotent — iki kez uygulamak sonucu değiştirmez', () {
      gorunumuUygula(Brightness.dark);
      final ilk = [AppColors.background, AppColors.text, AppColors.primary];
      gorunumuUygula(Brightness.dark);
      expect([AppColors.background, AppColors.text, AppColors.primary], ilk);
    });

    test('açığa dönüş MARKA değerlerini birebir geri verir', () {
      gorunumuUygula(Brightness.dark);
      gorunumuUygula(Brightness.light);
      expect(AppColors.background, VarsayilanRenkler.background);
      expect(AppColors.surface, VarsayilanRenkler.surface);
      expect(AppColors.primary, VarsayilanRenkler.primary);
      expect(AppColors.accent, VarsayilanRenkler.accent);
      expect(AppColors.text, VarsayilanRenkler.text);
      expect(AppColors.border, VarsayilanRenkler.border);
    });
  });

  group('Kontrast — her iki görünümde AA', () {
    for (final (ad, parlaklik) in [
      ('AÇIK', Brightness.light),
      ('KOYU', Brightness.dark),
    ]) {
      test('$ad görünümde yazı düştüğü her zeminde AA eşiğini geçer', () {
        gorunumuUygula(parlaklik);
        final dusenler = <String>[];
        for (final c in _ciftler()) {
          final o = kontrastOrani(c.yazi, c.zemin);
          if (o < kAaEsigi) {
            dusenler.add('${c.ad} = ${o.toStringAsFixed(2)}');
          }
        }
        expect(
          dusenler,
          isEmpty,
          reason: '$ad görünüm: ${dusenler.join(' · ')}',
        );
      });

      test('$ad görünümde kart zeminden AYIRT EDİLİR', () {
        gorunumuUygula(parlaklik);
        expect(
          kontrastOrani(AppColors.surface, AppColors.background),
          greaterThan(1.05),
          reason: 'kart ile zemin ayrışmıyor',
        );
        // Koyu panel de zeminden ayrışmalı (Haftalık Özet tek panelden ibaret).
        expect(
          kontrastOrani(AppColors.darkCard, AppColors.background),
          greaterThan(1.05),
          reason: 'koyu panel zeminle aynı',
        );
      });
    }
  });

  group('Tercih ekranı', () {
    tearDown(() => gorunumModuAyarla(GorunumModu.sistem));

    testWidgets('üç seçenek de görünür ve varsayılan SİSTEM işaretli', (
      t,
    ) async {
      await t.pumpWidget(const MaterialApp(home: GorunumSecimScreen()));
      for (final m in GorunumModu.values) {
        expect(
          find.text(m.etiket),
          findsOneWidget,
          reason: '${m.etiket} seçeneği yok',
        );
      }
      expect(gorunumModu(), GorunumModu.sistem);
    });

    testWidgets('seçim tercihe YAZILIR ve köke duyurulur', (t) async {
      await t.pumpWidget(const MaterialApp(home: GorunumSecimScreen()));

      GorunumModu? duyulan;
      void dinle() => duyulan = gorunumNotifier.value;
      gorunumNotifier.addListener(dinle);
      addTearDown(() => gorunumNotifier.removeListener(dinle));

      await t.tap(find.byKey(const Key('gorunum-koyu')));
      await t.pump();

      expect(gorunumModu(), GorunumModu.koyu, reason: 'tercihe yazılmadı');
      expect(getPref('gorunumModu'), 'koyu');
      expect(duyulan, GorunumModu.koyu, reason: 'kök haberdar edilmedi');
    });

    testWidgets('aynı seçeneğe tekrar dokunmak boş yere yazmaz', (t) async {
      await t.pumpWidget(const MaterialApp(home: GorunumSecimScreen()));
      var sayac = 0;
      void dinle() => sayac++;
      gorunumNotifier.addListener(dinle);
      addTearDown(() => gorunumNotifier.removeListener(dinle));

      await t.tap(find.byKey(const Key('gorunum-sistem')));
      await t.pump();
      expect(sayac, 0);
    });
  });

  group('Geçici tema araçları', () {
    // Kullanıcı kararı (2026-08-12): bu iki araç PROJEDE KALSIN ama normal
    // süite GİRMESİN. `flutter test` yalnız `_test.dart` ile biten dosyaları
    // çalıştırdığı için ayrım ada bağlı — yorumla değil testle bekçilenir,
    // yoksa ileride biri yeniden adlandırınca sessizce süite girerler.
    test('araçlar duruyor ve adları süite girmelerini engelliyor', () {
      for (final ad in ['tema_vitrini_uret.dart', 'tema_degerleri_yaz.dart']) {
        expect(
          File('test/$ad').existsSync(),
          isTrue,
          reason: '$ad silinmiş — kullanıcı kalmasını istedi',
        );
        expect(
          ad.endsWith('_test.dart'),
          isFalse,
          reason: '$ad artık süite giriyor',
        );
      }
    });
  });

  group('Anlamsal renkler görünümden BAĞIMSIZ', () {
    test('başarı / uyarı / hata / bilgi / canlı iki görünümde de AYNI', () {
      gorunumuUygula(Brightness.light);
      final acik = [
        AppColors.success,
        AppColors.warning,
        AppColors.danger,
        AppColors.info,
        AppColors.live,
        AppColors.onLive,
      ];
      gorunumuUygula(Brightness.dark);
      expect([
        AppColors.success,
        AppColors.warning,
        AppColors.danger,
        AppColors.info,
        AppColors.live,
        AppColors.onLive,
      ], acik);
    });

    test('canlı KIRMIZI kalır — koyu görünümde de', () {
      gorunumuUygula(Brightness.dark);
      expect(AppColors.live, const Color(0xFFE21B2D));
    });
  });
}
