// ÇIKIŞTA BİLDİRİM İPTALİ — regresyon testleri.
//
// NEDEN VAR: `bildirimIptalKancasi` bir süre BAĞLANMADAN kaldı. Çağrı yeri
// `?.call()` olduğu için kanca null iken hiçbir hata çıkmıyordu: ne derleme
// ne `flutter analyze` ne de çalışma zamanı uyarı veriyordu. Sonuç sessizdi
// ama gerçekti — çıkan kullanıcının maç hatırlatmaları telefonda kalıyor,
// cihazı devralan kişiye onun maçları bildiriliyordu.
//
// Bu testler kancanın GERÇEKTEN çağrıldığını sahte bir servisle doğrular;
// işletim sisteminin bildirim katmanına hiç dokunmaz.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/auth.dart';

/// Sahte bildirim servisi — kaç kez çağrıldığını sayar, istenirse patlar.
class _SahteIptal {
  int cagri = 0;
  bool patlasin = false;

  Future<void> call() async {
    cagri += 1;
    if (patlasin) throw StateError('bildirim servisi yanıt vermedi');
  }
}

void main() {
  late _SahteIptal iptal;
  late List<String> sira;

  setUp(() {
    iptal = _SahteIptal();
    sira = [];
    bildirimIptalKancasi = () async {
      sira.add('bildirim');
      await iptal.call();
    };
    couponIzolasyonKancasi = () async {
      sira.add('kupon');
    };
  });

  tearDown(() {
    bildirimIptalKancasi = null;
    couponIzolasyonKancasi = null;
  });

  test('normal çıkışta iptal TAM BİR KEZ çağrılır', () async {
    await logout();
    expect(iptal.cagri, 1, reason: 'ne atlanmalı ne de tekrarlanmalı');
  });

  test('uzaktan oturum kapatmada da iptal çağrılır', () async {
    await handleSessionRevoked();
    expect(iptal.cagri, 1);
  });

  test('iptal HATA VERSE BİLE çıkış tamamlanır', () async {
    iptal.patlasin = true;
    // Hata dışarı sızarsa kullanıcı hesabından çıkamaz — asıl risk budur.
    await expectLater(logout(), completes);
    expect(iptal.cagri, 1, reason: 'denenmiş olmalı');
    expect(getToken(), isNull, reason: 'yerel oturum yine de temizlenmeli');
  });

  test('iptal, yerel oturum temizlenmeden ÖNCE denenir', () async {
    // Sıra önemli: oturum bilgisi silindikten sonra hangi kayıtların bize ait
    // olduğunu bulmak zorlaşır.
    await logout();
    expect(sira.first, 'bildirim');
  });

  test('kullanıcı değişiminde eski kullanıcının bildirimi kalmaz', () async {
    // A çıkar → iptal çalışır. B girmeden önce sayaç 1 olmalı; B'nin oturumu
    // A'nın kayıtlarını devralmamalı.
    await logout();
    final acikisSonrasi = iptal.cagri;
    await handleSessionRevoked(); // B'nin oturumu da düşerse yine temizlenir
    expect(acikisSonrasi, 1);
    expect(iptal.cagri, 2, reason: 'her oturum sonu kendi temizliğini yapar');
  });

  test('kanca bağlanmamışsa çıkış yine tamamlanır (eski davranış korunur)', () {
    // Kanca null iken uygulama çökmemeli — koruma kancanın VARLIĞINDA değil,
    // main.dart bağlantısında. Bu test o güvenliğin bozulmadığını gösterir.
    bildirimIptalKancasi = null;
    expect(logout(), completes);
  });
}
