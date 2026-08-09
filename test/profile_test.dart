// Profil alt ekranlarının SAF işlevleri.
//
// Bu testlerin hepsi kaynaktaki JS davranışını doğrular; beklentiler
// tahminle değil, kaynak dosyadaki kurallarla yazıldı.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/local_data.dart';
import 'package:masteranaliz/core/security/bio_lock_policy.dart';
import 'package:masteranaliz/core/utils.dart';
import 'package:masteranaliz/features/profile/delete_account_screen.dart';
import 'package:masteranaliz/features/profile/devices_screen.dart';
import 'package:masteranaliz/features/profile/premium_code_screen.dart';

void main() {
  group('Türkçe harf dönüşümü', () {
    test('küçük harf: I → ı, İ → i', () {
      expect(kucukTr('IŞIKLAR'), 'ışıklar');
      expect(kucukTr('İSTANBUL'), 'istanbul');
      // Dart'ın yerleşik hâli YANLIŞ olurdu — farkı burada sabitliyoruz.
      expect('IŞIKLAR'.toLowerCase(), isNot('ışıklar'));
    });

    test('büyük harf: i → İ, ı → I', () {
      expect(buyukTr('istanbul'), 'İSTANBUL');
      expect(buyukTr('ışıklar'), 'IŞIKLAR');
    });
  });

  group('Hesap silme onay ifadesi', () {
    test('tam eşleşme kabul edilir', () {
      expect(isConfirmed('HESABIMI SIL'), isTrue);
    });

    test('küçük harf ve Türkçe İ/I farkı engellemez', () {
      expect(isConfirmed('hesabımı sil'), isTrue);
      expect(isConfirmed('HESABIMI SİL'), isTrue);
      expect(isConfirmed('Hesabımı Sil'), isTrue);
    });

    test('fazla boşluk ve baş/son boşluk temizlenir', () {
      expect(isConfirmed('  HESABIMI   SIL  '), isTrue);
    });

    test('yanlış metin ve boş değer reddedilir', () {
      expect(isConfirmed('HESABIMI'), isFalse);
      expect(isConfirmed('SIL HESABIMI'), isFalse);
      expect(isConfirmed(''), isFalse);
      expect(isConfirmed(null), isFalse);
    });
  });

  group('Premium kod temizleme', () {
    test('tire ve küçük harf kanonik biçime döner', () {
      expect(kodTemizle('a7k2-m9p4'), 'A7K2M9P4');
      expect(kodTemizle('A7K2M9P4'), 'A7K2M9P4');
    });

    test('boşluk ve noktalama atılır', () {
      expect(kodTemizle('a7 k2.m9_p4'), 'A7K2M9P4');
    });

    test('Türkçe harflerde JS ile AYNI davranış', () {
      // 'ışık' → toUpperCase() → 'IŞIK'; süzgeç yalnız 'Ş'yi atar, geriye
      // 'IIK' kalır. Hem JS'te hem Dart'ta böyledir ('ı' ve 'i' ikisi de
      // ASCII 'I'ya çıkar) — davranış birebir aynı olduğu için kaynaktaki
      // hâli KORUNDU, "düzeltilmedi".
      expect(kodTemizle('ışık'), 'IIK');
      expect(kodTemizle('ŞŞŞ'), '');
    });

    test('boş/null → boş', () {
      expect(kodTemizle(null), '');
      expect(kodTemizle(''), '');
    });
  });

  group('Cihaz listesi zaman biçimleri', () {
    test('timeAgo: dakika/saat/gün eşikleri', () {
      final now = DateTime.now();
      expect(timeAgo(now.toIso8601String()), 'şimdi');
      expect(
        timeAgo(now.subtract(const Duration(minutes: 5)).toIso8601String()),
        '5 dk önce',
      );
      expect(
        timeAgo(now.subtract(const Duration(hours: 3)).toIso8601String()),
        '3 saat önce',
      );
      expect(
        timeAgo(now.subtract(const Duration(days: 2)).toIso8601String()),
        '2 gün önce',
      );
    });

    test('timeAgo: eksik/bozuk değer → em-dash', () {
      expect(timeAgo(null), '—');
      expect(timeAgo(''), '—');
      expect(timeAgo('bu bir tarih değil'), '—');
    });

    test('trTarih: gün.ay.yıl (ay iki hane)', () {
      expect(trTarih('2026-08-09T10:34:00'), '9.08.2026');
      expect(trTarih('2026-12-31T23:59:00'), '31.12.2026');
      expect(trTarih(null), '—');
    });
  });

  group('Biyometrik kilit politikası', () {
    test('web\'de seçenek HİÇ sunulmaz', () {
      expect(
        canOfferBiometrics(platform: 'web', hasHardware: true, enrolled: true),
        isFalse,
      );
    });

    test('donanım + kayıtlı biyometri ikisi birden şart', () {
      expect(
        canOfferBiometrics(
          platform: 'android',
          hasHardware: true,
          enrolled: true,
        ),
        isTrue,
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
          platform: 'ios',
          hasHardware: false,
          enrolled: true,
        ),
        isFalse,
      );
    });

    test('açılış kilidi: üç koşul birden', () {
      expect(
        shouldLockOnLaunch(loggedIn: true, enabled: true, supported: true),
        isTrue,
      );
      expect(
        shouldLockOnLaunch(loggedIn: false, enabled: true, supported: true),
        isFalse,
      );
      expect(
        shouldLockOnLaunch(loggedIn: true, enabled: false, supported: true),
        isFalse,
      );
      expect(
        shouldLockOnLaunch(loggedIn: true, enabled: true, supported: false),
        isFalse,
      );
    });

    test('başarısızlık sonrası deneme hakkı ASLA kısıtlanmaz', () {
      for (final n in [0, 1, 2, 9]) {
        expect(afterFailure(n).allowRetry, isTrue);
      }
      expect(afterFailure(1).emphasizePasswordFallback, isFalse);
      expect(afterFailure(2).emphasizePasswordFallback, isTrue);
    });

    test('başarısız/iptal sonucu kilidi AÇMAZ', () {
      expect(outcomeFromResult(true), 'unlocked');
      expect(outcomeFromResult(false), 'locked');
      expect(outcomeFromResult(null), 'locked');
    });
  });

  group('Yerel veri anahtarları', () {
    test('anahtar adları kaynaktakiyle birebir aynı', () {
      // Ad değişirse kullanıcının mevcut verisi ERİŞİLEMEZ hâle gelir;
      // bu test o kaymayı yakalar.
      expect(kLocalKeys, contains('sportoto.token'));
      expect(kLocalKeys, contains('sportoto.refresh'));
      expect(kLocalKeys, contains('sportoto.couponCenter.v1'));
      expect(kLocalKeys, contains('sportoto.push.v1'));
      expect(kLocalKeys.length, 11);
    });

    test('cihaz kimliği listede DEĞİL', () {
      // Rastgele, kişisel veri içermez; güvenli depo temizliğiyle silinir.
      expect(kLocalKeys, isNot(contains('sportoto.device')));
    });
  });
}
