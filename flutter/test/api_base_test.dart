// KAYNAK: app/test/release-config.test.mjs — BİREBİR çeviri.
//
// Bu test YAYIN GÜVENLİĞİNİ korur: yayın derlemesinin sessizce localhost'a,
// LAN IP'ye ya da şifresiz http'ye düşmesini engeller. Kaynak projede bu
// kural yazılıydı ve testle bağlanmıştı; çeviride testi bırakmak, kuralı
// bırakmak olurdu.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_base.dart';

void main() {
  test('yayın: yerel ve şifresiz adresler reddedilir', () {
    const bad = [
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      'http://192.168.1.100:4000',
      'https://192.168.1.100',
      'http://10.0.0.5:4000',
      'http://172.16.0.9:4000',
      'http://api.ornek.com', // https değil
    ];
    for (final b in bad) {
      expect(
        () => resolveApiBase(
          envBase: b,
          isDev: false,
          platform: ApiPlatform.android,
        ),
        throwsA(
          isA<ApiBaseConfigError>().having(
            (e) => e.message,
            'mesaj',
            contains('YAPILANDIRMA HATASI'),
          ),
        ),
        reason: 'yayında reddedilmeli: $b',
      );
    }
  });

  test('yayın: adres verilmeyen mobil derleme sessizce yerele düşmez', () {
    expect(
      () => resolveApiBase(
        envBase: '',
        isDev: false,
        platform: ApiPlatform.android,
      ),
      // Kaynakta aranan dize `EXPO_PUBLIC_API_BASE` idi; Flutter'da aynı rolü
      // `--dart-define=API_BASE` üstlendiği için mesaj o ada göre değişti.
      // Kuralın kendisi ve testin amacı AYNI.
      throwsA(
        isA<ApiBaseConfigError>()
            .having((e) => e.message, 'mesaj', contains('API_BASE')),
      ),
    );

    // Web'de aynı origin geçerlidir (sayfa HTTPS ise istek de HTTPS'tir).
    expect(
      resolveApiBase(envBase: '', isDev: false, platform: ApiPlatform.web),
      '',
    );
  });

  test('yayın: geçerli HTTPS adresi kabul edilir, sondaki eğik çizgi temizlenir',
      () {
    expect(
      resolveApiBase(
        envBase: 'https://api.ornek.com/',
        isDev: false,
        platform: ApiPlatform.android,
      ),
      'https://api.ornek.com',
    );
  });

  test('geliştirme: yerel davranış korunur', () {
    expect(
      resolveApiBase(envBase: '', isDev: true, platform: ApiPlatform.web),
      'http://localhost:4000',
    );

    // ─────────────────────────────────────────────────────────────────────
    // BİLİNÇLİ SAPMA — kaynakta bu satır 'http://192.168.1.100:4000' idi.
    //
    // Kaynağın geliştirme hedefi Expo Go ile GERÇEK telefondu; telefon
    // bilgisayarı LAN adresinden görür. Flutter'ın geliştirme hedefi Android
    // EMÜLATÖRÜDÜR ve emülatör bilgisayara 10.0.2.2 ile ulaşır — LAN IP'yi
    // burada bırakmak, emülatörde her isteğin zaman aşımına düşmesi demekti.
    //
    // LAN IP KALDIRILMADI: gerçek telefonda test için
    // `--dart-define=API_BASE=http://192.168.1.100:4000` yeterlidir ve
    // aşağıdaki üçüncü beklenti bunu doğrular. Yayın davranışı DEĞİŞMEDİ.
    // ─────────────────────────────────────────────────────────────────────
    expect(
      resolveApiBase(envBase: '', isDev: true, platform: ApiPlatform.android),
      'http://$kAndroidEmulatorHost:4000',
    );

    // Elle verilen adres her zaman kazanır (gerçek telefon senaryosu).
    expect(
      resolveApiBase(
        envBase: 'http://$kDevLanIp:4000',
        isDev: true,
        platform: ApiPlatform.android,
      ),
      'http://$kDevLanIp:4000',
    );
  });
}
