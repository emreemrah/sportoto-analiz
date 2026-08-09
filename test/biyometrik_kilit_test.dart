// BİYOMETRİK KİLİT — açılış kapısı ve ekran davranışı testleri.
//
// İKİ DALGA DÜZELTMENİN BEKÇİSİ:
//   1. `needsLockOnLaunch()` hiç çağrılmıyordu ve kilit ekranı yoktu —
//      kullanıcı kilidi açıyor, "korunuyorum" sanıyor, açılışta hiç kilit
//      sorulmuyordu.
//   2. (2026-08-09 güvenlik kararı) Karar cihaz desteğine BAĞLIYKEN kayıtlı
//      biyometriyi silmek/sensörün kilitlenmesi korumayı SESSİZCE
//      kapatıyordu. Artık `girişli + tercih açık` yeter; cihaz durumu yalnız
//      kilit ekranının ne ANLATACAĞINI belirler.
//
// Cihaz biyometrisine ve platform kanalına DOKUNULMAZ: karar mantığı saf
// modülde (bio_lock_policy.dart), ekran davranışı enjekte edilen sonuçlarla
// sınanır. Gerçek parmak izi/yüz doğrulaması burada SINANAMAZ — fiziksel
// cihaz doğrulaması yayın öncesi ayrı bir adımdır.

import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/app.dart';
import 'package:masteranaliz/core/security/bio_lock_policy.dart';
import 'package:masteranaliz/features/security/biometric_lock_screen.dart';

/// Bir Dart kaynak dosyasından, [imza] ile başlayan işlevin gövdesini kaba
/// ama dürüst biçimde keser (imzadan sonraki ilk satır-başı `}` işaretine
/// kadar). Kaynak-tarama bekçileri bunu kullanır.
String _govde(String kaynak, String imza) {
  final bas = kaynak.indexOf(imza);
  if (bas < 0) fail('imza bulunamadı: $imza');
  final son = kaynak.indexOf('\n}', bas);
  if (son < 0) fail('gövde sonu bulunamadı: $imza');
  return kaynak.substring(bas, son);
}

void main() {
  group('Açılış kapısı kararı (saf mantık)', () {
    test('oturum yoksa biyometri İSTENMEZ', () {
      expect(shouldLockOnLaunch(loggedIn: false, enabled: true), isFalse);
    });

    test('biyometri kapalıysa uygulama doğrudan açılır', () {
      expect(shouldLockOnLaunch(loggedIn: true, enabled: false), isFalse);
    });

    test('oturum + tercih açık İKİLİSİ kilit için yeterlidir', () {
      expect(shouldLockOnLaunch(loggedIn: true, enabled: true), isTrue);
    });

    test(
      'GÜVENLİK: cihaz desteği KARARA KATILMAZ — kaybolsa da kilit sürer',
      () {
        // Eski sözleşmede `supported: false` kilidi atlatıyordu; parametre
        // artık YOK. Kayıtlı biyometrisi silinen cihazda karar değişmez;
        // kullanıcı kilit ekranında cihaz PIN'i ya da şifreyle giriş görür.
        expect(shouldLockOnLaunch(loggedIn: true, enabled: true), isTrue);
      },
    );

    test('doğrulama iptal/başarısızsa kilit SÜRER', () {
      expect(outcomeFromResult(false), 'locked');
      expect(outcomeFromResult(null), 'locked');
      expect(outcomeFromResult(true), 'unlocked');
    });

    test('başarısızlıkta deneme hakkı kapanmaz, şifre yolu öne çıkar', () {
      expect(afterFailure(0).allowRetry, isTrue);
      expect(afterFailure(0).emphasizePasswordFallback, isFalse);
      final r = afterFailure(kFailureEmphasisThreshold);
      expect(r.allowRetry, isTrue, reason: 'kullanıcı kilitli bırakılmaz');
      expect(r.emphasizePasswordFallback, isTrue);
    });

    test('web ayarlarda biyometri SUNMAZ (canOfferBiometrics)', () {
      expect(
        canOfferBiometrics(platform: 'web', hasHardware: true, enrolled: true),
        isFalse,
      );
    });
  });

  group('Kaynak-tarama bekçileri (sessiz gerileme kilitleri)', () {
    final cihazKati = File(
      'lib/core/security/biometric_lock.dart',
    ).readAsStringSync();

    test('needsLockOnLaunch KARARI cihaz desteğine bakmaz', () {
      // Birisi `biometricsSupported()` çağrısını karara geri eklerse koruma
      // yine sessizce delinir — tam bu satır onu yakalar.
      final g = _govde(cihazKati, 'Future<bool> needsLockOnLaunch');
      expect(
        g.contains('biometricsSupported'),
        isFalse,
        reason: 'destek sorgusu kilit KARARINA geri sızdırılmış',
      );
      expect(
        g.contains('shouldLockOnLaunch'),
        isTrue,
        reason: 'karar saf politikadan geçmeli',
      );
    });

    test('WEB: eski bir mobil ayar web açılışını kilitleyemez', () {
      final g = _govde(cihazKati, 'Future<bool> needsLockOnLaunch');
      expect(
        g.contains('_isWeb || !loggedIn'),
        isTrue,
        reason: 'web ve girişsiz erken dönüşü korunmalı',
      );
    });

    test('authenticate İÇİNDE uygulama-katmanı zaman aşımı YOK', () {
      // 60 sn'lik `.timeout` 2026-08-09'da bilerek kaldırıldı:
      // `persistAcrossBackgrounding: true` doğrulamayı arka plan dönüşünde
      // otomatik yeniden dener (meşru uzun sürebilir) ve platformun kendi
      // zaman aşımı `LocalAuthExceptionCode.timeout` olarak zaten gelir.
      final g = _govde(cihazKati, 'Future<String> authenticate');
      expect(
        g.contains('.timeout('),
        isFalse,
        reason: 'zaman aşımı geri eklenirse gerekçesiyle tartışılmalı',
      );
      expect(g.contains('persistAcrossBackgrounding: true'), isTrue);
    });

    test('hata kodları ekrana taşınıyor (locked:<kod>)', () {
      final g = _govde(cihazKati, 'Future<String> authenticate');
      expect(g.contains('on LocalAuthException'), isTrue);
      expect(g.contains(r"'locked:${e.code.name}'"), isTrue);
    });
  });

  group('Uygulama kökü — korunan içerik sızmıyor mu', () {
    testWidgets('kilitliyken korunan ekranlar HİÇ çizilmez', (t) async {
      await t.pumpWidget(const MasterAnalizApp(baslangictaKilitli: true));
      await t.pump();
      await t.pump(const Duration(milliseconds: 50));

      // Kilit ekranının kendi ögeleri görünür…
      expect(find.byKey(const Key('bio-kilidi-ac')), findsOneWidget);
      expect(find.byKey(const Key('bio-sifreyle-giris')), findsOneWidget);

      // …ama alt sekme çubuğu (korunan kabuk) HİÇ oluşmamalı.
      expect(find.text('Ana Sayfa'), findsNothing);
      expect(find.text('Bülten'), findsNothing);
      expect(find.text('Kuponlarım'), findsNothing);
      expect(find.text('Profil'), findsNothing);
    });

    // NOT: "kilit kapalıyken uygulama normal açılır" burada WIDGET testiyle
    // sınanmıyor — router kurulunca Bülten ekranı gerçek API isteğine çıkar;
    // test ağa bağımlı ve kırılgan olurdu. Kapının KARARI saf testlerle,
    // ekranın DAVRANIŞI aşağıdaki enjeksiyonlu testlerle kapsanıyor.
  });

  group('Kilit ekranı davranışı (enjekte edilen servisle)', () {
    testWidgets('başarılı doğrulamada uygulama açılır', (t) async {
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () async => 'unlocked',
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump();
      await t.pump();

      expect(acildi, isTrue);
    });

    testWidgets('İPTAL/başarısızlıkta korunan içerik açılmaz, uyarı çıkar', (
      t,
    ) async {
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () async => 'locked',
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump();
      await t.pump();

      expect(acildi, isFalse, reason: 'doğrulanmadan kilit AÇILMAMALI');
      expect(find.textContaining('Doğrulama başarısız'), findsOneWidget);
      expect(
        find.byKey(const Key('bio-kilidi-ac')),
        findsOneWidget,
        reason: 'yeniden deneme hakkı asla kapanmaz',
      );
      expect(
        find.byKey(const Key('bio-sifreyle-giris')),
        findsOneWidget,
        reason: 'güvenli alternatif her zaman durur',
      );
    });

    testWidgets('doğrulama HATA FIRLATSA bile ekran donmaz', (t) async {
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () async => throw StateError('biyometri servisi çöktü'),
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump();
      await t.pump();

      expect(acildi, isFalse);
      expect(find.textContaining('kimliğini doğrula'), findsOneWidget);
      expect(find.byKey(const Key('bio-sifreyle-giris')), findsOneWidget);
    });

    testWidgets('KURTARMA: cihazda kullanılabilir biyometri yoksa durum '
        'AÇIKLANIR, kilit atlanmaz', (t) async {
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () async => 'locked:noBiometricsEnrolled',
            destekSorgula: () async => false, // kayıtlı biyometri silinmiş
          ),
        ),
      );
      await t.pump();
      await t.pump();

      expect(acildi, isFalse, reason: 'destek kaybı kilidi AÇAMAZ');
      expect(find.byKey(const Key('bio-durum-metni')), findsOneWidget);
      expect(
        find.textContaining('kullanılabilir biyometrik doğrulama yok'),
        findsOneWidget,
      );
      // İki çıkış yolu da sunuluyor.
      expect(find.byKey(const Key('bio-kilidi-ac')), findsOneWidget);
      expect(find.byKey(const Key('bio-sifreyle-giris')), findsOneWidget);
    });

    testWidgets('GEÇİCİ KİLİT: temporaryLockout anlaşılır anlatılır', (
      t,
    ) async {
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () {},
            dogrula: () async => 'locked:temporaryLockout',
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump();
      await t.pump();

      expect(find.textContaining('geçici olarak kilitlendi'), findsOneWidget);
    });

    testWidgets('EKRAN KİLİDİ YOK: noCredentialsSet şifreye yönlendirir', (
      t,
    ) async {
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () {},
            dogrula: () async => 'locked:noCredentialsSet',
            destekSorgula: () async => false,
          ),
        ),
      );
      await t.pump();
      await t.pump();

      expect(find.textContaining('ekran kilidi kurulu değil'), findsOneWidget);
    });

    testWidgets('şifreyle giriş: oturum kapatılır ve kilit kalkar', (t) async {
      var cikisSayisi = 0;
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () async => 'locked',
            cikisYap: () async => cikisSayisi += 1,
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump();
      await t.pump();

      await t.tap(find.byKey(const Key('bio-sifreyle-giris')));
      await t.pump();
      await t.pump();

      expect(cikisSayisi, 1, reason: 'oturum sunucuda da kapatılmalı');
      expect(acildi, isTrue, reason: 'kilit kalkar → Giriş ekranı');
    });

    testWidgets('çıkış hata verse bile kullanıcı kilitli kalmaz', (t) async {
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () async => 'locked',
            cikisYap: () async => throw StateError('sunucuya ulaşılamadı'),
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump();
      await t.pump();

      await t.tap(find.byKey(const Key('bio-sifreyle-giris')));
      await t.pump();
      await t.pump();

      expect(acildi, isTrue, reason: 'ağ hatası kullanıcıyı hapsetmemeli');
    });

    testWidgets('HAPSOLMA YOK: doğrulama hiç dönmese de şifreyle giriş '
        'ÇALIŞIR', (t) async {
      // Platform kanalı yanıt vermeyen doğrulamanın modeli: hiç tamamlanmayan
      // Future. Zaman aşımı YOK; kaçış yolu ekranda her an açık.
      final asili = Completer<String>();
      var cikis = 0;
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () => asili.future,
            cikisYap: () async => cikis += 1,
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump(); // otomatik deneme başladı, asılı
      await t.pump(const Duration(seconds: 5)); // beklemek değiştirmez

      expect(acildi, isFalse);
      await t.tap(find.byKey(const Key('bio-sifreyle-giris')));
      await t.pump();
      await t.pump();

      expect(cikis, 1, reason: 'asılı doğrulama kaçışı ENGELLEYEMEZ');
      expect(acildi, isTrue);

      // Temizlik + bir sonraki test için sahne: asılı sonuç şimdi gelsin.
      asili.complete('unlocked');
      await t.pump();
    });

    testWidgets('GEÇ SONUÇ: şifreyle girişten SONRA gelen "unlocked" yok '
        'sayılır (deneme nesli)', (t) async {
      final gec = Completer<String>();
      var unlockSayisi = 0;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => unlockSayisi += 1,
            dogrula: () => gec.future,
            cikisYap: () async {},
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump(); // deneme 1 asılı

      await t.tap(find.byKey(const Key('bio-sifreyle-giris')));
      await t.pump();
      await t.pump();
      expect(unlockSayisi, 1, reason: 'şifre yolu kilidi kaldırdı');

      // Eski denemenin geç BAŞARISI şimdi geliyor — ekran hâlâ mounted
      // (onUnlock testte yalnız sayaç). Nesil koruması uygulanmasını önler.
      gec.complete('unlocked');
      await t.pump();
      await t.pump();

      expect(
        unlockSayisi,
        1,
        reason: 'geç sonuç ikinci bir kilit açma ÜRETEMEZ',
      );
    });

    testWidgets('EKRAN KAPANDIKTAN sonra gelen geç sonuç durum/navigasyon '
        'değiştirmez, çökme yaratmaz', (t) async {
      final gec = Completer<String>();
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () => gec.future,
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump(); // deneme asılı

      // Ekran tamamen sökülür (ör. kök widget kilidi başka yoldan kaldırdı).
      await t.pumpWidget(const MaterialApp(home: SizedBox()));
      await t.pump();

      gec.complete('unlocked'); // geç başarı, sahipsiz
      await t.pump();
      await t.pump();

      expect(acildi, isFalse, reason: 'sökülmüş ekran kilit açamaz');
      expect(t.takeException(), isNull, reason: 'setState-after-dispose yok');
    });

    testWidgets('aynı doğrulama istemi üst üste açılmaz', (t) async {
      var cagri = 0;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () {},
            dogrula: () async {
              cagri += 1;
              await Future<void>.delayed(const Duration(milliseconds: 50));
              return 'locked';
            },
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump(); // otomatik deneme başladı, hâlâ sürüyor
      await t.tap(find.byKey(const Key('bio-kilidi-ac')), warnIfMissed: false);
      await t.pump();

      expect(cagri, 1, reason: 'sürerken ikinci istem açılmamalı');
      await t.pump(const Duration(milliseconds: 100));
    });

    testWidgets('yeniden deneme, eski denemenin sonucundan etkilenmez', (
      t,
    ) async {
      // Deneme 1 'locked' ile biter; deneme 2 (retry) kendi sonucunu alır.
      final sonuclar = <String>['locked', 'unlocked'];
      var acildi = false;
      await t.pumpWidget(
        MaterialApp(
          home: BiometricLockScreen(
            onUnlock: () => acildi = true,
            dogrula: () async => sonuclar.removeAt(0),
            destekSorgula: () async => true,
          ),
        ),
      );
      await t.pump();
      await t.pump(); // deneme 1: locked
      expect(acildi, isFalse);

      await t.tap(find.byKey(const Key('bio-kilidi-ac')));
      await t.pump();
      await t.pump(); // deneme 2: unlocked

      expect(acildi, isTrue, reason: 'yeni deneme kendi sonucuyla açar');
    });
  });
}
