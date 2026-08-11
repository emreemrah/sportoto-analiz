// KAYNAK: app/test/biometric-lock.test.mjs — saf politika kısmının çevirisi.
//
// BİYOMETRİK KİLİT POLİTİKASI TESTLERİ — saf modül (cihaz API'si yok).

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/security/bio_lock_policy.dart';

void main() {
  test('biyometri: web ve donanımsız/kayıtsız cihazlarda SUNULMAZ', () {
    expect(
      canOfferBiometrics(platform: 'web', hasHardware: true, enrolled: true),
      isFalse,
    );
    expect(
      canOfferBiometrics(
        platform: 'android',
        hasHardware: false,
        enrolled: true,
      ),
      isFalse,
    );
    expect(
      canOfferBiometrics(
        platform: 'android',
        hasHardware: true,
        enrolled: false,
      ),
      isFalse,
    );
    expect(
      canOfferBiometrics(
        platform: 'android',
        hasHardware: true,
        enrolled: true,
      ),
      isTrue,
    );
    expect(
      canOfferBiometrics(platform: 'ios', hasHardware: true, enrolled: true),
      isTrue,
    );
  });

  // KAYNAKTAN BİLİNÇLİ SAPMA (2026-08-09, kullanıcının güvenlik kararı):
  // kaynak testi `supported=false → kilit yok` bekliyordu. O davranış,
  // kayıtlı biyometriyi silmenin korumayı SESSİZCE kapatması demekti. Yeni
  // sözleşme: karar yalnız `girişli + tercih açık` ikilisidir; cihaz durumu
  // parametre bile değildir. Bu, beklenti DÜŞÜRME değil YÜKSELTMEDİR —
  // eski spesifikasyonda kilitsiz kalan durum artık kilitlidir.
  test(
    'kilit: girişli + tercih açık İKİLİSİ yeter; cihaz durumu karara katılmaz',
    () {
      expect(shouldLockOnLaunch(loggedIn: true, enabled: true), isTrue);
      expect(
        shouldLockOnLaunch(loggedIn: false, enabled: true),
        isFalse,
        reason: 'girişsiz kullanıcıya kilit yok',
      );
      expect(
        shouldLockOnLaunch(loggedIn: true, enabled: false),
        isFalse,
        reason: 'kullanıcı açmadıysa kilit yok',
      );
    },
  );

  test(
    'kilit: başarısızlıkta deneme hakkı sürer, şifre alternatifi öne çıkar',
    () {
      expect(afterFailure(0), (
        allowRetry: true,
        emphasizePasswordFallback: false,
      ));
      final r = afterFailure(kFailureEmphasisThreshold);
      expect(
        r.allowRetry,
        isTrue,
        reason: 'deneme hakkı hiçbir zaman kapanmaz',
      );
      expect(
        r.emphasizePasswordFallback,
        isTrue,
        reason: 'eşikte şifre alternatifi vurgulanır',
      );
    },
  );

  test(
    'kilit: yalnız success=true açar; vazgeçme/eşleşmeme kilidi SÜRDÜRÜR',
    () {
      expect(outcomeFromResult(true), 'unlocked');
      // Kaynakta `{ success: false, error: 'user_cancel' }` idi; Flutter'ın
      // `local_auth` paketi düz `bool` döndürdüğü için imza sadeleşti.
      expect(outcomeFromResult(false), 'locked');
      expect(outcomeFromResult(null), 'locked');
    },
  );

  // Kaynak güvencesi: biyometrik VERİ hiçbir yerde saklanmaz/taşınmaz.
  test('kaynak: biyometrik modül veri kaydetmez, yalnız sonuç kullanır', () {
    final sarmalayici = File(
      'lib/core/security/biometric_lock.dart',
    ).readAsStringSync();

    // Sarmalayıcı yalnız tercih bayrağını ('1') yazar; başka yazma yok.
    final yazmalar = RegExp(r'\.write\s*\(').allMatches(sarmalayici).length;
    expect(
      yazmalar,
      lessThanOrEqualTo(1),
      reason: 'yalnız aç/kapat bayrağı yazılabilir',
    );
    expect(
      RegExp('dio|http|apiBase|api\\.').hasMatch(sarmalayici),
      isFalse,
      reason: 'biyometrik modül ağa hiçbir şey göndermez',
    );

    // Ekran gerçek konumunda TARANIR; `existsSync` koşulu yok — dosya
    // taşınırsa test sessizce boş geçmek yerine burada patlar.
    final metin = File(
      'lib/features/security/biometric_lock_screen.dart',
    ).readAsStringSync();
    expect(
      RegExp('SharedPreferences|FlutterSecureStorage|setPref').hasMatch(metin),
      isFalse,
      reason: 'kilit ekranı hiçbir şey depolamaz',
    );
  });
}
