// KAYNAK KARŞILIĞI: app/test/eas-build-config.test.mjs
//
// YAYIN YAPILANDIRMASI BEKÇİSİ — Flutter sürümü.
//
// Kaynak testi Expo'nun `eas.json` + `app.json` dosyalarını denetliyordu.
// Flutter'da aynı bilgiler farklı yerlerde durur (AndroidManifest.xml,
// build.gradle.kts, Info.plist, pubspec.yaml). Denetlenen KURALLAR aynıdır:
// paket kimliği, sürüm, izinler, yön kilidi, ikonlar ve "yayın anahtarı
// olmadan mağaza paketi üretilmesin" uyarısı.
//
// NEDEN GEREKLİ: bu dosyaların hiçbiri Dart derleyicisinden geçmez. Biri
// yanlışlıkla silinse ya da bozulsa `flutter analyze` sessiz kalır; hata
// ancak mağaza reddinde ya da kullanıcı telefonunda görünür.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String _oku(String yol) => File(yol).readAsStringSync();

void main() {
  group('Android', () {
    late String manifest;
    late String gradle;

    setUpAll(() {
      manifest = _oku('android/app/src/main/AndroidManifest.xml');
      gradle = _oku('android/app/build.gradle.kts');
    });

    test('paket kimliği kaynaktaki ile aynı', () {
      // KAYNAK: app.json → android.package
      expect(gradle, contains('applicationId = "com.emrahanlar.masteranaliz"'));
      expect(gradle, contains('namespace = "com.emrahanlar.masteranaliz"'));
    });

    test('uygulama adı kaynaktaki ile aynı', () {
      // KAYNAK: app.json → expo.name
      expect(manifest, contains('android:label="Sportoto Master Analiz"'));
    });

    test('izin listesi TAM: bildirim (runtime) + internet (normal)', () {
      // KAYNAK: app.json → android.permissions.
      // INTERNET 20 Ağustos 2026'da eklendi (5437c57): yayın paketinde
      // YOKTU ve telefonda "veriler gelmiyor" yaşandı (debug manifest'inde
      // olduğundan emülatörde görünmedi). Kullanıcıdan İSTENEN (runtime)
      // tek izin hâlâ bildirimdir — INTERNET normal izindir, kurulumda
      // kendiliğinden verilir, kullanıcıya sorulmaz.
      // Ayrıntılı bekçi: manifest_izin_test.dart.
      final istenen = RegExp(
        r'<uses-permission android:name="([^"]+)"\s*/>',
      ).allMatches(manifest).map((m) => m.group(1)).toList();
      expect(istenen, [
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.INTERNET',
      ]);
    });

    test('mahremiyet izinleri birleştirmede SÖKÜLÜR', () {
      // KAYNAK: app.json → android.blockedPermissions.
      // Bir bağımlılık bunları kendi manifestine eklerse mağaza sayfasında
      // uygulamanın istemediği izinler görünür.
      for (final izin in [
        'RECORD_AUDIO',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'READ_CONTACTS',
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
      ]) {
        expect(
          manifest,
          contains('android.permission.$izin" tools:node="remove"'),
          reason: '$izin sökülmüyor',
        );
      }
    });

    test('TAM ALARM izni İSTENMEZ', () {
      // Bildirimler `inexactAllowWhileIdle` ile kurulur; izin istemek,
      // vermeyen kullanıcıda HİÇ hatırlatma kurulamamasına yol açardı.
      for (final izin in ['SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM']) {
        expect(
          manifest,
          contains('android.permission.$izin" tools:node="remove"'),
        );
      }
    });

    test('ekran DİKEY kilitli', () {
      // KAYNAK: app.json → "orientation": "portrait"
      expect(manifest, contains('android:screenOrientation="portrait"'));
    });

    test(
      'uyarlanabilir ikon (adaptive icon) kurulu ve tek renkli sürümü var',
      () {
        final xml = _oku(
          'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
        );
        expect(xml, contains('ic_launcher_background'));
        expect(xml, contains('ic_launcher_foreground'));
        // Android 13+ tema ikonu — kaynakta `adaptiveIcon.monochromeImage`.
        expect(xml, contains('ic_launcher_monochrome'));
        for (final d in ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
          expect(
            File(
              'android/app/src/main/res/drawable-$d/ic_launcher_foreground.png',
            ).existsSync(),
            isTrue,
            reason: '$d ikonu eksik',
          );
        }
      },
    );

    test('bildirim ikonu AYRI ve tek renkli', () {
      // Android bildirim ikonunu siluete çevirir; renkli launcher ikonu
      // kullanılırsa beyaz bir kare görünür.
      for (final d in ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
        expect(
          File(
            'android/app/src/main/res/drawable-$d/ic_notification.png',
          ).existsSync(),
          isTrue,
          reason: '$d bildirim ikonu eksik',
        );
      }
      final push = _oku('lib/core/services/push_service.dart');
      expect(
        push,
        contains("AndroidInitializationSettings('ic_notification')"),
      );
      expect(
        push.contains('@mipmap/ic_launcher'),
        isFalse,
        reason: 'bildirimde renkli launcher ikonu kullanılamaz',
      );
    });

    test('açılış ekranı marka rengi + marka görseli', () {
      // KAYNAK: app.json → primaryColor / assets/splash-icon.png
      final renkler = _oku('android/app/src/main/res/values/colors.xml');
      expect(renkler, contains('#0B1B3A'));
      for (final yol in [
        'android/app/src/main/res/drawable/launch_background.xml',
        'android/app/src/main/res/drawable-v21/launch_background.xml',
      ]) {
        final l = _oku(yol);
        expect(l, contains('@color/brand_primary'));
        expect(l, contains('@drawable/splash_icon'));
      }
      expect(
        File(
          'android/app/src/main/res/drawable-xxhdpi/splash_icon.png',
        ).existsSync(),
        isTrue,
      );
    });

    test('yayın imzası dosyadan okunur; yoksa UYARI basar', () {
      // Anahtar deposu depoda DURMAZ (parola içerir). Yoksa debug anahtarına
      // düşülür ama sessizce değil — uyarı basılır.
      expect(gradle, contains('key.properties'));
      expect(gradle, contains('signingConfigs'));
      expect(gradle, contains('logger.warn'));
    });

    test('anahtar deposu ve parolalar sürüm kontrolüne GİRMEZ', () {
      // KORUNAN KURAL: imza anahtarı ve parolası ASLA depoya girmez.
      //
      // ESKİ HÂLİ dosyanın diskte VAR OLMAMASINI şart koşuyordu. Bu, kuralı
      // korumuyordu (gitignore zaten koruyor) ama imzalı yayın derlemesini
      // İMKÂNSIZ kılıyordu: `flutter build apk --release` anahtarı bu
      // dosyadan okur, yoksa sessizce hata ayıklama anahtarına düşer.
      // Proje 22 Ağustos 2026'da ilk gerçek yayın anahtarını üretti ve test
      // o an kırıldı — kırılan kural değil, kuralın yanlış ölçüsüydü.
      //
      // YENİ ÖLÇÜ: dosya varsa git tarafından YOKSAYILIYOR olmalı. Bu hem
      // anahtarı olan geliştiricide hem temiz kopyada doğru sonuç verir.
      final ignore = _oku('.gitignore');
      expect(ignore, contains('android/key.properties'));
      expect(ignore, contains('*.jks'));

      const gizliler = ['android/key.properties', 'android/masteranaliz.jks'];
      for (final yol in gizliler) {
        if (!File(yol).existsSync()) continue;
        final r = Process.runSync('git', ['check-ignore', '-q', yol]);
        expect(
          r.exitCode,
          0,
          reason: '$yol diskte var ama gitignore kapsamında DEĞİL — '
              'imza anahtarı/parolası depoya sızabilir',
        );
      }
    });
  });

  group('iOS', () {
    late String plist;

    setUpAll(() {
      plist = _oku('ios/Runner/Info.plist');
    });

    test('paket kimliği ve görünen ad kaynaktaki ile aynı', () {
      // KAYNAK: app.json → ios.bundleIdentifier / expo.name
      final pbx = _oku('ios/Runner.xcodeproj/project.pbxproj');
      expect(
        pbx,
        contains('PRODUCT_BUNDLE_IDENTIFIER = com.emrahanlar.masteranaliz;'),
      );
      expect(plist, contains('<string>Sportoto Master Analiz</string>'));
    });

    test('Face ID açıklaması kaynaktaki metinle BİREBİR aynı', () {
      // KAYNAK: app.json → ios.infoPlist.NSFaceIDUsageDescription.
      // Apple bu metni istemeyen uygulamayı REDDEDER; metin ayrıca kullanıcıya
      // yüz verisinin cihazdan çıkmadığını söyler.
      expect(plist, contains('<key>NSFaceIDUsageDescription</key>'));
      expect(
        plist,
        contains(
          'Uygulama kilidini açmak için Face ID kullanılır. Yüz verisi '
          'cihazdan asla çıkmaz ve uygulama tarafından kaydedilmez.',
        ),
      );
    });

    test('ekran DİKEY kilitli (iPad dahil)', () {
      expect(plist.contains('UIInterfaceOrientationLandscapeLeft'), isFalse);
      expect(plist.contains('UIInterfaceOrientationLandscapeRight'), isFalse);
      expect(plist, contains('UIInterfaceOrientationPortrait'));
    });

    test('açık tema zorlanır (koyu kipte palet ters dönmesin)', () {
      // KAYNAK: app.json → "userInterfaceStyle": "light"
      expect(plist, contains('<key>UIUserInterfaceStyle</key>'));
      expect(plist, contains('<string>Light</string>'));
    });

    test('ön plandaki bildirim için delege atanır', () {
      // iOS, delege atanmazsa uygulama açıkken düşen bildirimi HİÇ göstermez.
      final app = _oku('ios/Runner/AppDelegate.swift');
      expect(app, contains('UNUserNotificationCenter.current().delegate'));
    });

    test('uygulama ikonu üretilmiş', () {
      final dir = Directory('ios/Runner/Assets.xcassets/AppIcon.appiconset');
      final png = dir.listSync().where((e) => e.path.endsWith('.png')).length;
      expect(png, greaterThanOrEqualTo(15), reason: 'iOS ikon kümesi eksik');
    });
  });

  group('Web', () {
    test('manifest kaynaktaki web bloğuyla aynı', () {
      // KAYNAK: app.json → web.{name, shortName, lang, themeColor,
      // backgroundColor}
      final m = _oku('web/manifest.json');
      expect(m, contains('"name": "Sportoto Master Analiz"'));
      expect(m, contains('"short_name": "Master Analiz"'));
      expect(m, contains('"lang": "tr"'));
      expect(m, contains('"theme_color": "#0B1B3A"'));
      expect(m, contains('"background_color": "#0B1B3A"'));
    });

    test('sayfa dili ve başlığı doğru', () {
      final i = _oku('web/index.html');
      expect(i, contains('<html lang="tr">'));
      expect(i, contains('<title>Sportoto Master Analiz</title>'));
    });
  });

  group('Karartma (--obfuscate) uyumu', () {
    // Yayın paketleri `--obfuscate` ile derlenir: tip, işlev ve alan adları
    // anlamsız kısa adlara çevrilir. Bu kalıplar çalışma zamanında ADA bakar
    // ve karartılmış pakette SESSİZCE yanlış değer üretir — derleme başarılı
    // olur, hata ancak kullanıcı telefonunda görünür.
    test('tip/enum adına bakan kalıplar kullanılmıyor', () {
      final suclular = <String>[];
      for (final f in Directory('lib').listSync(recursive: true)) {
        if (f is! File || !f.path.endsWith('.dart')) continue;
        final satirlar = f
            .readAsStringSync()
            .split('\n')
            // Yorumda geçebilir (kuralın gerekçesi yazılabilmeli).
            .where((l) => !RegExp(r'^\s*//').hasMatch(l))
            .toList();
        for (var i = 0; i < satirlar.length; i++) {
          final l = satirlar[i];
          if (RegExp(r'runtimeType|\.values\.byName\(').hasMatch(l) ||
              // `defaultTargetPlatform.name` gibi ENUM üstünde `.name`.
              // Map anahtarı olan `['name']` ve alan adı `name:` hariç.
              RegExp(r'\bdefaultTargetPlatform\.name\b').hasMatch(l)) {
            suclular.add('${f.path}:${i + 1} → ${l.trim()}');
          }
        }
      }
      expect(
        suclular,
        isEmpty,
        reason:
            'Karartılmış yayın paketinde bu kalıplar yanlış değer üretir.\n'
            '${suclular.join('\n')}',
      );
    });

    test('platform adı kaynaktaki SABİT değerleri döndürür', () {
      // KAYNAK: `Platform.OS` → 'android' | 'ios' | 'web'.
      final kod = _oku('lib/core/session/token_store.dart');
      for (final beklenen in ["'android'", "'ios'", "'web'"]) {
        expect(
          kod,
          contains(beklenen),
          reason: 'platform adı sabiti eksik: $beklenen',
        );
      }
    });

    test('sembol saklama kuralı yazılı ve semboller depoya girmiyor', () {
      // Sembol dosyası kaybolursa o sürümün çökme raporu KALICI olarak
      // okunamaz hâle gelir; geriye dönük üretilemez.
      expect(File('yayin-sembolleri/BENIOKU.md').existsSync(), isTrue);
      expect(_oku('.gitignore'), contains('yayin-sembolleri/**/*.symbols'));
    });
  });

  group('Sürüm', () {
    test('pubspec sürümü geçerli ve port tabanından İLERİ', () {
      // ESKİ HÂLİ sürümü `1.0.0+1`e SABİTLİYORDU — Expo kaynağındaki
      // (app.json) değere birebir eşitlik. Port sırasında doğruydu: iki
      // uygulamanın aynı sürümü göstermesi isteniyordu.
      //
      // 22 Ağustos 2026'da uygulama kendi güncellemelerini dağıtmaya
      // başladı ve sabit anlamını yitirdi: Android, güncellemenin
      // kurulabilmesi için versionCode'un ARTMASINI şart koşar. Sabit
      // kalsaydı hiçbir güncelleme telefona kurulamazdı.
      //
      // KORUNAN KURAL: biçim geçerli olmalı ve port tabanına (build 1)
      // geri DÜŞMEMELİ — yanlışlıkla geri alınırsa burada yakalanır.
      // Regex yerine düz ayrıştırma: kaçış karakteri yok, okunur ve
      // hata mesajları hangi parçanın bozuk olduğunu tek tek söyler.
      final satirlar = File('pubspec.yaml').readAsLinesSync();
      final satir = satirlar.firstWhere(
        (l) => l.startsWith('version:'),
        orElse: () => '',
      );
      expect(satir, isNotEmpty, reason: 'pubspec.yaml içinde version: satırı yok');

      final deger = satir.substring('version:'.length).trim();
      final parca = deger.split('+');
      expect(parca.length, 2, reason: 'sürüm biçimi X.Y.Z+N olmalı: $deger');

      final surum = parca[0].split('.');
      expect(surum.length, 3, reason: 'sürüm adı X.Y.Z olmalı: $deger');
      for (final s in surum) {
        expect(int.tryParse(s), isNotNull, reason: 'sürüm parçası sayı değil: $deger');
      }

      final build = int.tryParse(parca[1]);
      expect(build, isNotNull, reason: 'versionCode sayı değil: $deger');
      expect(
        build!,
        greaterThanOrEqualTo(2),
        reason: 'versionCode port tabanına (1) geri düşmüş — '
            'güncelleme telefona kurulamaz',
      );
    });
  });
}
