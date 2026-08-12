// GELİŞTİRMEYE ÖZEL OTOMATİK GİRİŞ — GÜVENLİK KAPISI (2026-08-11)
//
// Bu özellik yalnız emülatörde tekrar tekrar giriş yapmamak için var. Tek
// tehlikesi, yayın derlemesine sızmasıdır: uygulama kendi başına bir hesaba
// giriyor olurdu. Bu dosya o kapıyı sabitler.
//
// NE SABİTLENİYOR:
//  1. Kimlik verilmemiş derlemede özellik KAPALI (bu testler öyle çalışır).
//  2. Kapalıyken giriş DENENMEZ — ağa hiç çıkılmaz.
//  3. Zaten oturum varsa üzerine giriş yapılmaz.
//  4. Kaynak bekçisi: yayın kapısı (`dart.vm.product`) ve "kimlik koda
//     yazılmaz" kuralı yerinde durur.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/dev_oturum.dart';

void main() {
  group('Kapı', () {
    test('kimlik verilmemiş derlemede KAPALI', () {
      // Testler --dart-define olmadan koşar; özellik kapalı olmalı.
      expect(devOtomatikGirisAcik, isFalse);
    });

    test('kapalıyken giriş DENENMEZ', () async {
      var denendi = false;
      await devOtomatikGiris(
        girisYap: (e, s) async => denendi = true,
        girisliMi: () => false,
      );
      expect(denendi, isFalse, reason: 'kapalı özellik ağa çıkmamalı');
    });

    test('oturum zaten varsa giriş denenmez', () async {
      var denendi = false;
      await devOtomatikGiris(
        girisYap: (e, s) async => denendi = true,
        girisliMi: () => true,
      );
      expect(denendi, isFalse);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // KAYNAK BEKÇİSİ — kapı sessizce kaldırılamasın.
  // ══════════════════════════════════════════════════════════════════════════
  group('Kaynak bekçisi', () {
    final kaynak = File('lib/core/dev_oturum.dart').readAsStringSync();

    test('yayın derlemesi kapısı yerinde', () {
      expect(
        kaynak.contains("bool.fromEnvironment('dart.vm.product')"),
        isTrue,
        reason: 'yayın kapısı kaldırılmış — otomatik giriş yayına sızabilir',
      );
      expect(
        kaynak.contains('!_kYayin &&'),
        isTrue,
        reason: 'açık olma koşulu yayın bayrağını kontrol etmeli',
      );
    });

    test('kimlik bilgisi koda YAZILMAMIŞ', () {
      // Değerler yalnız --dart-define ile gelir; varsayılanları boş olmalı.
      expect(
        RegExp(r"String\.fromEnvironment\('DEV_EMAIL'\)\s*;").hasMatch(kaynak),
        isTrue,
        reason: 'DEV_EMAIL için varsayılan değer tanımlanmamalı',
      );
      expect(
        RegExp(r"String\.fromEnvironment\('DEV_SIFRE'\)\s*;").hasMatch(kaynak),
        isTrue,
        reason: 'DEV_SIFRE için varsayılan değer tanımlanmamalı',
      );
      // '@' içeren bir dizge = gömülü e-posta şüphesi.
      expect(
        RegExp(
          "'[^']*@[^']*'",
        ).hasMatch(kaynak.replaceAll(RegExp(r'//.*'), '')),
        isFalse,
        reason: 'kodda e-posta benzeri sabit dizge olmamalı',
      );
    });

    test('main.dart otomatik girişi açılışı BEKLETMEDEN çağırır', () {
      final main = File('lib/main.dart').readAsStringSync();
      expect(
        main.contains('unawaited(devOtomatikGiris())'),
        isTrue,
        reason:
            'await ile çağrılırsa ağ yavaşken açılış bekler — dev kolaylığı '
            'uygulamanın açılışını geciktirmemeli',
      );
    });
  });
}
