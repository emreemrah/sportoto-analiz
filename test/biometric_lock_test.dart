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
      canOfferBiometrics(platform: 'android', hasHardware: true, enrolled: true),
      isTrue,
    );
    expect(
      canOfferBiometrics(platform: 'ios', hasHardware: true, enrolled: true),
      isTrue,
    );
  });

  test('kilit: yalnız girişli + tercih açık + destekli üçlüsünde devreye girer', () {
    expect(
      shouldLockOnLaunch(loggedIn: true, enabled: true, supported: true),
      isTrue,
    );
    expect(
      shouldLockOnLaunch(loggedIn: false, enabled: true, supported: true),
      isFalse,
      reason: 'girişsiz kullanıcıya kilit yok',
    );
    expect(
      shouldLockOnLaunch(loggedIn: true, enabled: false, supported: true),
      isFalse,
      reason: 'kullanıcı açmadıysa kilit yok',
    );
    expect(
      shouldLockOnLaunch(loggedIn: true, enabled: true, supported: false),
      isFalse,
      reason: 'desteksiz cihazda kilit yok',
    );
  });

  test('kilit: başarısızlıkta deneme hakkı sürer, şifre alternatifi öne çıkar', () {
    expect(afterFailure(0), (allowRetry: true, emphasizePasswordFallback: false));
    final r = afterFailure(kFailureEmphasisThreshold);
    expect(r.allowRetry, isTrue, reason: 'deneme hakkı hiçbir zaman kapanmaz');
    expect(
      r.emphasizePasswordFallback,
      isTrue,
      reason: 'eşikte şifre alternatifi vurgulanır',
    );
  });

  test('kilit: yalnız success=true açar; vazgeçme/eşleşmeme kilidi SÜRDÜRÜR', () {
    expect(outcomeFromResult(true), 'unlocked');
    // Kaynakta `{ success: false, error: 'user_cancel' }` idi; Flutter'ın
    // `local_auth` paketi düz `bool` döndürdüğü için imza sadeleşti.
    expect(outcomeFromResult(false), 'locked');
    expect(outcomeFromResult(null), 'locked');
  });

  // Kaynak güvencesi: biyometrik VERİ hiçbir yerde saklanmaz/taşınmaz.
  test('kaynak: biyometrik modül veri kaydetmez, yalnız sonuç kullanır', () {
    final sarmalayici = File(
      'lib/core/security/biometric_lock.dart',
    ).readAsStringSync();

    // Sarmalayıcı yalnız tercih bayrağını ('1') yazar; başka yazma yok.
    final yazmalar = RegExp(r'\.write\s*\(')
        .allMatches(sarmalayici)
        .length;
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

    final ekran = File(
      'lib/features/profile/biometric_lock_screen.dart',
    );
    if (ekran.existsSync()) {
      final metin = ekran.readAsStringSync();
      expect(
        RegExp('SharedPreferences|\\.write\\(|setPref').hasMatch(metin),
        isFalse,
        reason: 'kilit ekranı hiçbir şey depolamaz',
      );
    }
  });
}
