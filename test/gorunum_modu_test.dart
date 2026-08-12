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
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/takim_temasi.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/profile/gorunum_secim_screen.dart';

/// Yazı ↔ zemin çiftleri: yazı DÜŞTÜĞÜ her zeminde okunmalı.
/// Ölçülecek yazı/zemin çiftleri ve HER BİRİNİN eşiği.
///
/// Eşik çiftin ROLÜNDEN gelir, taramadan değil: gövde metni WCAG AA 4.5,
/// rozet/buton/sekme gibi KALIN-BÜYÜK yüzeyler 3.0. İki tarama (marka
/// görünümleri ve takım teması) aynı kuralı kullanır ki biri diğerinden
/// gevşek kalmasın.
List<({String ad, Color yazi, Color zemin, double esik})> _ciftler() => [
  // TERS KONTRAST (2026-08-12): `text` ailesi KARTIN metnidir, zeminin
  // değil. Zemine doğrudan yazılan başlıklar `onBackground` ailesini
  // kullanır. Her yazı YALNIZ kendi yüzeyinde ölçülür — `text`i zeminde
  // ölçmek artık yanlış bir beklenti olurdu (Galatasaray'da kart yazısı
  // sarı, zemin de sarı).
  (
    ad: 'text/surface',
    yazi: AppColors.text,
    zemin: AppColors.surface,
    esik: kAaEsigi,
  ),
  (
    ad: 'text/surfaceSoft',
    yazi: AppColors.text,
    zemin: AppColors.surfaceSoft,
    esik: kAaEsigi,
  ),
  (
    ad: 'textSoft/surface',
    yazi: AppColors.textSoft,
    zemin: AppColors.surface,
    esik: kAaEsigi,
  ),
  (
    ad: 'onBackground/background',
    yazi: AppColors.onBackground,
    zemin: AppColors.background,
    esik: kAaEsigi,
  ),
  (
    ad: 'onBackgroundSoft/background',
    yazi: AppColors.onBackgroundSoft,
    zemin: AppColors.background,
    esik: kAaEsigi,
  ),
  // primary KART İÇİNDE, accent ZEMİN üstünde yazı/rozet olarak durur.
  (
    ad: 'primary/surface',
    yazi: AppColors.primary,
    zemin: AppColors.surface,
    esik: kAaBuyukEsigi,
  ),
  (
    ad: 'accent/background',
    yazi: AppColors.accent,
    zemin: AppColors.background,
    esik: kAaBuyukEsigi,
  ),
  // …ve ZEMİN olarak: üstlerindeki yazı okunmalı.
  (
    ad: 'onPrimary/primary',
    yazi: AppColors.onPrimary,
    zemin: AppColors.primary,
    esik: kAaEsigi,
  ),
  (
    ad: 'onPrimarySoft/primary',
    yazi: AppColors.onPrimarySoft,
    zemin: AppColors.primary,
    esik: kAaEsigi,
  ),
  (
    ad: 'onAccent/accent',
    yazi: AppColors.onAccent,
    zemin: AppColors.accent,
    esik: kAaEsigi,
  ),
  // Vurgulu panel (hero).
  (
    ad: 'onHero/heroZemin',
    yazi: AppColors.onHero,
    zemin: AppColors.heroZemin,
    esik: kAaEsigi,
  ),
  (
    ad: 'onHeroSoft/heroZemin',
    yazi: AppColors.onHeroSoft,
    zemin: AppColors.heroZemin,
    esik: kAaEsigi,
  ),
  // Koyu panel (Haftalık Özet, bildirimler, yan menü).
  (
    ad: 'onDark/darkCard',
    yazi: AppColors.onDark,
    zemin: AppColors.darkCard,
    esik: kAaEsigi,
  ),
  (
    ad: 'onDarkSoft/darkCard',
    yazi: AppColors.onDarkSoft,
    zemin: AppColors.darkCard,
    esik: kAaEsigi,
  ),
  (
    ad: 'onDark/darkCardSoft',
    yazi: AppColors.onDark,
    zemin: AppColors.darkCardSoft,
    esik: kAaEsigi,
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
          if (o < c.esik) {
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

    testWidgets('DÖRT seçenek de görünür ve varsayılan SİSTEM işaretli', (
      t,
    ) async {
      await t.pumpWidget(const MaterialApp(home: GorunumSecimScreen()));
      expect(GorunumModu.values.length, 4);
      for (final m in GorunumModu.values) {
        expect(
          find.text(m.etiket),
          findsOneWidget,
          reason: '${m.etiket} seçeneği yok',
        );
      }
      expect(gorunumModu(), GorunumModu.sistem);
    });

    testWidgets('takım YOKSA "Takım teması" seçilemez ve NEDENİ yazar', (
      t,
    ) async {
      // TakimTemasi sarmalayıcısı yok → favori takım yok.
      await t.pumpWidget(const MaterialApp(home: GorunumSecimScreen()));
      expect(
        find.textContaining('önce profilinden favori'),
        findsOneWidget,
        reason: 'kapalı olma nedeni yazılmamış',
      );

      await t.tap(find.byKey(const Key('gorunum-takim')));
      await t.pump();
      expect(
        gorunumModu(),
        GorunumModu.sistem,
        reason: 'takım yokken seçilebilmiş',
      );
    });

    testWidgets('takım VARSA "Takım teması" seçilebilir', (t) async {
      await t.pumpWidget(
        MaterialApp(
          home: TakimTemasi(
            palet: takimPaletiBul('Galatasaray'),
            child: const GorunumSecimScreen(),
          ),
        ),
      );
      expect(find.textContaining('önce profilinden favori'), findsNothing);

      await t.tap(find.byKey(const Key('gorunum-takim')));
      await t.pump();
      expect(gorunumModu(), GorunumModu.takim);
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

  group('Takım teması modu', () {
    TakimPaleti gs() => takimPaletiBul('Galatasaray')!;

    List<Color> yapisal() => [
      AppColors.background,
      AppColors.surface,
      AppColors.primary,
      AppColors.accent,
      AppColors.text,
      AppColors.border,
      AppColors.heroZemin,
    ];

    test('takim anahtarı gidip geliyor', () {
      expect(GorunumModu.cozumle('takim'), GorunumModu.takim);
      expect(GorunumModu.takim.anahtar, 'takim');
      expect(GorunumModu.takim.etiket, 'Takım teması');
    });

    test('TAKIM modunda yapısal renkler takımın paletine döner', () {
      gorunumuKur(GorunumModu.acik, Brightness.light, gs());
      final markaAcik = yapisal();

      final p = gs();
      gorunumuKur(GorunumModu.takim, Brightness.light, p);

      expect(yapisal(), isNot(markaAcik), reason: 'tema değişmedi');
      expect(AppColors.background, p.zemin);
      expect(AppColors.surface, p.yuzey);
      // TERS KONTRAST: primary KART üstündeki aksiyon (ana tonu), accent
      // ZEMİN üstündeki vurgu (ikincil tonu).
      expect(AppColors.primary, p.vurgu);
      expect(AppColors.accent, p.secili);
      expect(AppColors.text, p.metin, reason: 'kart yazısı');
      expect(AppColors.onBackground, p.zeminMetni, reason: 'zemin yazısı');
    });

    test('DİĞER üç modda takım rengi yapısala SIZMAZ', () {
      final p = gs();
      for (final (modu, cihaz) in [
        (GorunumModu.acik, Brightness.light),
        (GorunumModu.koyu, Brightness.light),
        (GorunumModu.sistem, Brightness.dark),
      ]) {
        // Palet VERİLİYOR ama mod takım değil: yapısal renk paletten
        // etkilenmemeli.
        gorunumuKur(modu, cihaz, p);
        expect(
          AppColors.background,
          isNot(p.zemin),
          reason: '${modu.anahtar} modunda takım zemini sızdı',
        );
        expect(
          AppColors.accent,
          isNot(p.secili),
          reason: '${modu.anahtar} modunda takım vurgusu sızdı',
        );
      }
    });

    test('TAKIM SEÇİLMEMİŞSE varsayılan AÇIĞA düşer', () {
      final donen = gorunumuKur(GorunumModu.takim, Brightness.dark, null);
      expect(donen, Brightness.light, reason: 'cihaz koyu olsa bile açık');
      expect(AppColors.background, VarsayilanRenkler.background);
      expect(AppColors.primary, VarsayilanRenkler.primary);
    });

    test('kullanılabilirlik favori takıma bağlı', () {
      expect(takimTemasiKullanilabilir(null), isFalse);
      expect(takimTemasiKullanilabilir(gs()), isTrue);
    });

    test('takım değişince tema YENİ takıma geçer', () {
      final g = takimPaletiBul('Galatasaray')!;
      gorunumuKur(GorunumModu.takim, Brightness.light, g);
      final gsZemin = AppColors.background;

      final f = takimPaletiBul('Fenerbahçe')!;
      gorunumuKur(GorunumModu.takim, Brightness.light, f);

      expect(AppColors.background, isNot(gsZemin));
      expect(AppColors.background, f.zemin);
    });

    test('dört örnek takımda yazı düştüğü her zeminde AA geçer', () {
      final dusenler = <String>[];
      for (final ad in [
        'BVB 09 Borussia Dortmund',
        'Fenerbahçe',
        'Galatasaray',
        'Beşiktaş',
      ]) {
        gorunumuKur(GorunumModu.takim, Brightness.light, takimPaletiBul(ad));
        for (final c in _ciftler()) {
          final o = kontrastOrani(c.yazi, c.zemin);
          if (o < c.esik) {
            dusenler.add('$ad ${c.ad}=${o.toStringAsFixed(2)}');
          }
        }
        // Koyu panel zeminden ayrışmalı.
        if (kontrastOrani(AppColors.darkCard, AppColors.background) <= 1.05) {
          dusenler.add('$ad koyu panel zeminle aynı');
        }
      }
      expect(dusenler, isEmpty, reason: dusenler.join(' · '));
    });

    test('anlamsal renkler takım modunda da sabit', () {
      gorunumuKur(GorunumModu.takim, Brightness.light, gs());
      expect(AppColors.danger, const Color(0xFFDC2626));
      expect(AppColors.success, const Color(0xFF16A34A));
      expect(AppColors.live, const Color(0xFFE21B2D));
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
