// ZEMİNDE `primary` YÜZEY KULLANILAMAZ — ÖLÇÜLMÜŞ KURAL.
//
// 16 Ağustos 2026 denetiminde AYNI kusurdan ALTI tane bulundu:
//   1. Haftalık Başarı — hafta seçici kartı görünmüyordu
//   2. Haftalık Başarı — seçili sekme ("Özet") çipsiz kalıyordu
//   3. Bülten geçmiş hafta — "Güncel Bültene Dön" düğmesi TAMAMEN görünmezdi
//   4. Bülten geçmiş hafta — "Bülten Geçmişi · Kilitli Analiz" bağlantısı
//   5. Sistem Karnesi — seçili sekme ("Özet") çipsiz
//   6. Radar — seçili filtre ("Tümü") ve sıralama ("Bülten sırası") çipsiz
//
// Hepsinin kökü tek: `AppColors.primary` SAYFA ZEMİNİNDE yüzey/çerçeve/yazı
// olarak kullanılıyordu. Paletin kendi kuralı bunu zaten söylüyor
// (`takim_paleti.dart`): *"VURGU: kart ÜSTÜNDE duran buton/rozet zemini"* —
// yani `primary` KART için türetilir, eşiği kart yüzeyine göre tutturulur.
// Zemin karşılığı AYRI bir tokendır: `onBackgroundAccent`.
//
// Bu dosya kuralı ÖLÇÜYLE sabitler: takım temasında `primary` ile `background`
// arasında görsel ayrım YOKTUR, `onBackgroundAccent` ile VARDIR. Böylece
// "zeminde primary kullanma" kuralı bir görüş değil, sayı olur.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/takim_gorunumu.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

/// Gerçek kulüp renkleri — en zorlu durumlar.
const _temalar = <String, (int, int)>{
  'Galatasaray': (0xFFFDB912, 0xFFA90432),
  'Fenerbahçe': (0xFF00417F, 0xFFFFED00),
  'Trabzonspor': (0xFF902F2F, 0xFF4FBFF0),
  'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
  'Le Mans FC': (0xFFFFD100, 0xFFE2001A),
};

/// Grafik nesne (yüzey/çerçeve) için gözle seçilebilirlik alt sınırı.
const _ayrimEsigi = 1.25;

void main() {
  for (final t in _temalar.entries) {
    group(t.key, () {
      setUp(() {
        takimGorunumunuUygula(
          paletUret(
            takim: t.key,
            ana: Color(t.value.$1),
            ikincil: Color(t.value.$2),
          ),
        );
      });

      test('primary ZEMİNDE yüzey olarak KULLANILAMAZ (ayrım yok)', () {
        final oran = kontrastOrani(AppColors.primary, AppColors.background);
        expect(
          oran,
          lessThan(_ayrimEsigi),
          reason:
              '${t.key}: primary/zemin ayrımı $oran — bu tema için kural '
              'gevşemiş olabilir; gevşediyse yukarıdaki altı bulgunun '
              'gerekçesi de değişir, kural gözden geçirilmeli',
        );
      });

      test('primary KART üstünde yüzey olarak GEÇERLİ (ayrım var)', () {
        expect(
          kontrastOrani(AppColors.primary, AppColors.card),
          greaterThanOrEqualTo(3.0),
          reason: '${t.key}: primary kartta da görünmüyor — palet bozulmuş',
        );
      });

      test('ZEMİN karşılığı onBackgroundAccent GÖRÜNÜR', () {
        expect(
          kontrastOrani(AppColors.onBackgroundAccent, AppColors.background),
          greaterThanOrEqualTo(3.0),
          reason: '${t.key}: zemin vurgusu görünmüyor — doğru token da bozuk',
        );
      });

      test('kart yüzeyi zeminden ayrışır (kart hep görünür)', () {
        expect(
          kontrastOrani(AppColors.card, AppColors.background),
          greaterThanOrEqualTo(_ayrimEsigi),
          reason: '${t.key}: kart zeminde kayboluyor',
        );
      });
    });
  }
}
