// KAYNAK TARAMASI — projenin KESİN kurallarının bekçisi.
//
// NEDEN KAYNAK TARAMASI: aşağıdaki kurallar tek bir ekranın değil, TÜM
// arayüzün kuralı. Ekran ekran widget testi yazmak hem eksik kalır hem de
// yeni eklenen ekranı hiç kapsamaz. Tarama, kuralı ihlal eden satırı NEREDE
// olursa olsun bulur — 16 Ağustos 2026'da tam olarak bu gerekti: "Zorluk"
// etiketi ana sayfadan kaldırıldı, ama AYNI etiket Hafta Özeti ekranında
// duruyordu ve kimse fark etmemişti.
//
// YÖNTEM: yorum satırları AYIKLANIR, kalan koda bakılır. Bir kuralı yorumda
// ANLATMAK serbesttir (bu dosyanın kendisi de öyle yapıyor); yasak olan onu
// KODA yazmaktır.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

/// `lib/` altındaki tüm Dart dosyaları.
List<File> _kaynaklar() => Directory('lib')
    .listSync(recursive: true)
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart'))
    .toList();

/// Yorum satırlarını atar — kural yorumda ANLATILABİLİR, kodda yazılamaz.
String _yorumsuz(String icerik) => icerik
    .split('\n')
    .where((s) => !s.trimLeft().startsWith('//'))
    .join('\n');

/// Dosya yolunu okunur hâle getirir (hata mesajı için).
String _yol(File f) => f.path.replaceAll('\\', '/');

void main() {
  group('Kaynak kuralları — tüm arayüz', () {
    test('genel yeşil (AppColors.field) hiçbir ekranda kullanılmaz', () {
      // 0xFF16A34A: takım temasının da açık/koyu görünümün de dışında kalan,
      // her arayüzde görülen genel yeşil. Kullanıcı kararı (16 Ağustos 2026):
      // sınıflandırma rozetleri temanın yumuşak yüzeylerinden beslenir.
      final suclu = <String>[];
      for (final f in _kaynaklar()) {
        if (_yorumsuz(f.readAsStringSync()).contains('AppColors.field')) {
          suclu.add(_yol(f));
        }
      }
      expect(
        suclu,
        isEmpty,
        reason:
            'AppColors.field yerine temanın yumuşak yüzeyleri kullanılmalı '
            '(warningSoft / primarySoft / bgAlt + ayrisanYuzey).',
      );
    });

    test('"zorluk" (kolay/orta/zor hafta) kullanıcıya GÖSTERİLMEZ', () {
      // Yanıltıcı: haftanın "kolay" olması diye bir şey yok; etiket tutturma
      // kolaylığı vaat ediyordu. Backend'in `difficulty` alanı DURUYOR —
      // yasak olan onu ekrana yazmak.
      final desen = RegExp(r'''Zorluk|ZORLUĞU|zorlukBandi|zorlukRengi''');
      final suclu = <String>[];
      for (final f in _kaynaklar()) {
        if (desen.hasMatch(_yorumsuz(f.readAsStringSync()))) {
          suclu.add(_yol(f));
        }
      }
      expect(
        suclu,
        isEmpty,
        reason: 'Bülten zorluğu hiçbir ekranda gösterilmez (yanıltıcı).',
      );
    });

    test('iddialı dil kullanıcı CÜMLELERİNE sızmaz', () {
      // CLAUDE.md kuralı: "garanti/banko/yanılmaz" gibi iddialı dil yok.
      //
      // KURAL DAR TUTULDU — BİLEREK. İlk sürüm ham kelime taraması yapıyordu
      // ve üç tür YANLIŞ ALARM üretti (16 Ağustos 2026'da ölçüldü):
      //   1) VERİ ANAHTARLARI — 'BANKO', 'bankoEligible': backend'in alan
      //      adları, ekrana yazılmaz, labels.dart çevirir. Boşluksuz tek
      //      belirteçler bu yüzden muaf.
      //   2) YASAL UYARI — "kesin sonuç veya kazanç vaadi DEĞİLDİR": kuralın
      //      ihlali değil, ta kendisi. Olumsuzlama içeren cümleler muaf.
      //   3) "kesin" KÖKÜ — "kesin sonuç yalnız resmî Spor Toto sonucudur"
      //      projenin KENDİ kuralı. Bu kök listeden tümden çıkarıldı.
      // Gürültülü bekçi kapatılır; kapatılan bekçi hiç yoktur.
      //
      // MUAF DOSYA: core/labels.dart — işi o kelimeleri yakalayıp kullanıcı
      // diline çevirmek, dolayısıyla onları içermek ZORUNDA.
      final yasak = RegExp(r'(banko|garanti|yanılmaz)', caseSensitive: false);
      final olumsuzlama = RegExp(
        r'(değildir|değil|vaadi|vaat)',
        caseSensitive: false,
      );
      final suclu = <String>[];
      for (final f in _kaynaklar()) {
        final yol = _yol(f);
        if (yol.endsWith('lib/core/labels.dart')) continue;
        final kod = _yorumsuz(f.readAsStringSync());
        for (final m in RegExp("'[^'\\n]*'").allMatches(kod)) {
          final s = m.group(0)!;
          if (!yasak.hasMatch(s)) continue;
          if (!s.contains(' ')) continue; // veri anahtarı, cümle değil
          if (olumsuzlama.hasMatch(s)) continue; // "garanti değil" → kuralın kendisi
          suclu.add('$yol → $s');
        }
      }
      expect(suclu, isEmpty, reason: 'İddialı dil yasak (CLAUDE.md).');
    });
  });

  group('Rozet yüzeyleri her görünümde karttan ayrışır', () {
    // 16 Ağustos 2026: rozetler ham `*Soft` değerlerini kullanıyordu ve koyu
    // görünümde "2. Hafta" rozeti kartın içinde kayboluyordu (kontrast 1.11).
    // Bu test her görünüm modunda ÖLÇER — yeni bir tema eklendiğinde de
    // aynı soruyu sorar.
    for (final mod in [Brightness.light, Brightness.dark]) {
      test('görünüm=${mod.name}: rozet zeminleri seçilebilir + yazı okunur', () {
        gorunumuUygula(mod);
        final yuzeyler = {
          'warningSoft': AppColors.warningSoft,
          'primarySoft': AppColors.primarySoft,
          'accentSoft': AppColors.accentSoft,
          'bgAlt': AppColors.bgAlt,
        };
        for (final e in yuzeyler.entries) {
          final zemin = ayrisanYuzey(e.value, AppColors.card);
          expect(
            kontrastOrani(zemin, AppColors.card),
            greaterThanOrEqualTo(1.4),
            reason: '${e.key} rozeti ${mod.name} görünümünde karta gömülüyor.',
          );
          expect(
            kontrastOrani(okunurMetin(zemin), zemin),
            greaterThanOrEqualTo(4.5),
            reason: '${e.key} rozetinin yazısı ${mod.name} görünümünde okunmuyor.',
          );
        }
      });
    }
  });
}
