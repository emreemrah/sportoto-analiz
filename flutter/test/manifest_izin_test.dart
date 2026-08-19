// YAYIN PAKETİ İNTERNET İZNİ BEKÇİSİ (2026-08-19, telefonda canlı yakalandı).
//
// Uygulama bülteni backend'den çeker; INTERNET izni olmadan YAYIN paketi
// hiçbir ağ isteği atamaz ve ekran "veriler gelmiyor" hâlinde kalır. Debug'da
// görünmez çünkü izni debug manifest'i ekler (hot reload için) — hata ancak
// gerçek telefona release APK kurulunca ortaya çıktı ve aapt ile ölçüldü:
// pakette POST_NOTIFICATIONS vardı, INTERNET YOKTU.
//
// Bu test ana manifest'i okur: izin bir gün "izin listesi sadeleştirmesi"
// sırasında silinirse (blockedPermissions bloğuna benzediği için gerçekçi
// bir risk) burada kırmızı yanar — telefonda değil.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('release manifest INTERNET iznini taşır', () {
    final m = File(
      'android/app/src/main/AndroidManifest.xml',
    ).readAsStringSync();
    expect(
      m.contains(
        '<uses-permission android:name="android.permission.INTERNET"/>',
      ),
      isTrue,
      reason: 'INTERNET izni yok — yayın paketi sunucuya HİÇ ulaşamaz',
    );
    expect(
      RegExp(
        r'android\.permission\.INTERNET"\s+tools:node="remove"',
      ).hasMatch(m),
      isFalse,
      reason: 'INTERNET izni engellenenler listesine girmiş — paket ağsız kalır',
    );
  });
}
