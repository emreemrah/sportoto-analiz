// TAKIM TEMASI (kullanıcı isteği, 2026-08-11)
//
// NE SABİTLENİYOR:
//  1. Palet çözümleme: katalog adıyla ve Türkçe küçük harf normalizasyonuyla.
//  2. EŞLEŞME YOKSA VARSAYILAN: bilinmeyen/boş takımda palet null döner ve
//     uygulama bugünkü temasını korur — renk uydurulmaz.
//  3. ERİŞİLEBİLİRLİK: 150 takımın HEPSİNDE metin kontrastı WCAG AA (4.5:1)
//     eşiğini geçer. Bu tarama tek tek göz kontrolünün yerine geçer.
//  4. Kart zeminden AYIRT EDİLİR (aksi hâlde arayüz düz bir renk lekesi olur).
//  5. ANLAMSAL RENKLER DEĞİŞMEZ: hata/başarı/uyarı renkleri takım temasından
//     etkilenmez. Kırmızı takımda kırmızı "mağlubiyet" anlamını korur.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/auth.dart' as auth;
import 'package:masteranaliz/core/theme/app_theme.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/takim_temasi.dart';
import 'package:masteranaliz/core/theme/tokens.dart';

void main() {
  group('Palet çözümleme', () {
    test('katalog adıyla bulunur', () {
      final p = takimPaletiBul('Galatasaray');
      expect(p, isNotNull);
      expect(p!.takim, 'Galatasaray');
      // SIRA SARI-KIRMIZI (2026-08-12): iki renkli temada birinci değer
      // ZEMİN rolündedir ve kullanıcı Galatasaray icin "ana arka plan sarı"
      // dedi. İki hex de doğrulanmış hâliyle duruyor, rolleri değişti.
      expect(p.ana, const Color(0xFFFDB912));
      expect(p.ikincil, const Color(0xFFA90432));
    });

    test('Türkçe küçük harf normalizasyonu — büyük/küçük fark etmez', () {
      for (final ad in const [
        'GALATASARAY',
        'galatasaray',
        'GaLaTaSaRaY',
        '  Galatasaray  ',
      ]) {
        expect(takimPaletiBul(ad)?.takim, 'Galatasaray', reason: ad);
      }
      // Türkçe 'İ' tuzağı: 'İstanbul Başakşehir FK'
      expect(
        takimPaletiBul('istanbul başakşehir fk')?.takim,
        'İstanbul Başakşehir FK',
      );
    });

    test('bilinmeyen/boş takımda VARSAYILAN (null) — renk uydurulmaz', () {
      expect(takimPaletiBul('Olmayan Takım FC'), isNull);
      expect(takimPaletiBul(''), isNull);
      expect(takimPaletiBul(null), isNull);
      expect(takimPaletiBul('   '), isNull);
    });

    test('tabloda 150 takım var (8 ligin tamamı)', () {
      expect(kTakimRenkleri.length, 150);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ERİŞİLEBİLİRLİK TARAMASI — 150 takımın HEPSİ
  // ══════════════════════════════════════════════════════════════════════════
  group('Kontrast — 150 takım', () {
    final paletler = tumTakimPaletleri();

    test('zemin üzerindeki metin AA eşiğini geçer', () {
      final dusuk = <String>[];
      for (final p in paletler) {
        final k = kontrastOrani(p.zemin, p.zeminUstuMetin);
        if (k < kAaEsigi) {
          dusuk.add('${p.takim}: ${k.toStringAsFixed(2)}');
        }
      }
      expect(
        dusuk,
        isEmpty,
        reason: 'zeminde okunmayan metin:\n${dusuk.join('\n')}',
      );
    });

    test('kart üzerindeki metin AA eşiğini geçer', () {
      final dusuk = <String>[];
      for (final p in paletler) {
        final k = kontrastOrani(p.yuzey, p.yuzeyUstuMetin);
        if (k < kAaEsigi) {
          dusuk.add('${p.takim}: ${k.toStringAsFixed(2)}');
        }
      }
      expect(
        dusuk,
        isEmpty,
        reason: 'kartta okunmayan metin:\n${dusuk.join('\n')}',
      );
    });

    test('buton yazısı AA eşiğini geçer', () {
      final dusuk = <String>[];
      for (final p in paletler) {
        final k = kontrastOrani(p.vurgu, p.vurguUstuMetin);
        if (k < kAaEsigi) {
          dusuk.add('${p.takim}: ${k.toStringAsFixed(2)}');
        }
      }
      expect(
        dusuk,
        isEmpty,
        reason: 'butonda okunmayan yazı:\n${dusuk.join('\n')}',
      );
    });

    test('KUTULARIN SINIRI BELİRGİN — kart, ara yüzey, kenarlık', () {
      // Kullanıcı isteği (2026-08-12 gece): "Kartlar, kutular, butonlar ve
      // seçim alanları ana arka plandan net biçimde ayrışsın. Her kutuda
      // görünür bir kenarlık, gölge veya yeterli ton farkı olsun."
      //
      // ÖLÇÜLEN HATA: ara yüzey (çip/şerit zemini) 150 takımın 149'unda
      // KARTIN AYNISIYDI (kontrast 1.00) ve kenarlık 130 takımda zeminde
      // görünmüyordu (1.00). Eşikler: iki büyük yüzey arası 1.25 — altında göz
      // sınırı seçemiyor; kenarlık bir ARAYÜZ BİLEŞENİ olduğu için kartta
      // WCAG 3.0, zeminde kart/zemin tabanı kadar.
      final dusenler = <String>[];
      for (final p in paletler) {
        void kontrol(String ad, double deger, double esik) {
          if (deger < esik) {
            dusenler.add('${p.takim} $ad=${deger.toStringAsFixed(2)}');
          }
        }

        kontrol('kart/zemin', kontrastOrani(p.yuzey, p.zemin), 1.25);
        kontrol('ara/kart', kontrastOrani(p.yuzeySoft, p.yuzey), 1.25);
        kontrol('ara/zemin', kontrastOrani(p.yuzeySoft, p.zemin), 1.25);
        kontrol('kenarlik/kart', kontrastOrani(p.kenarlik, p.yuzey), 3.0);
        kontrol('kenarlik/zemin', kontrastOrani(p.kenarlik, p.zemin), 1.55);
      }
      expect(dusenler, isEmpty, reason: dusenler.take(12).join(' · '));
    });

    test('KART YAZISI İKİ YÜZEYDE BİRDEN okunur', () {
      // Aynı yazı hem kartın hem kart içindeki ara yüzeyin üstüne düşüyor.
      // Yalnız birine göre hesaplanınca ötekinde 3.99'a kadar iniyordu; ara
      // yüzey ile metin artık BİRLİKTE çözülüyor (bkz. _araYuzeyVeMetin).
      final dusenler = <String>[];
      for (final p in paletler) {
        for (final (ad, yuzey) in [('kart', p.yuzey), ('ara', p.yuzeySoft)]) {
          final o = kontrastOrani(p.metin, yuzey);
          if (o < kAaEsigi) {
            dusenler.add('${p.takim} metin/$ad=${o.toStringAsFixed(2)}');
          }
        }
      }
      expect(dusenler, isEmpty, reason: dusenler.take(12).join(' · '));
    });

    test('vurgu ve seçili KENDİ yüzeylerinde AYIRT EDİLİR', () {
      // TERS KONTRAST (2026-08-12): `vurgu` KART üstünde duran buton/rozet,
      // `secili` ZEMİN üstünde duran etkin sekmedir. Her biri yalnız kendi
      // yüzeyinde ölçülür — vurguyu zeminde ölçmek artık yanlış bir beklenti
      // olurdu: zemin ana renktir, vurgu da ana rengin tonudur, ikisi
      // tanım gereği birbirine yakın.
      final ayrisamayan = <String>[];
      for (final p in paletler) {
        final kart = kontrastOrani(p.yuzey, p.vurgu);
        if (kart < kAaBuyukEsigi) {
          ayrisamayan.add('${p.takim} vurgu/kart: ${kart.toStringAsFixed(2)}');
        }
        final zem = kontrastOrani(p.zemin, p.secili);
        if (zem < kAaBuyukEsigi) {
          ayrisamayan.add('${p.takim} secili/zemin: ${zem.toStringAsFixed(2)}');
        }
      }
      expect(
        ayrisamayan,
        isEmpty,
        reason:
            'vurgu/seçili kendi yüzeyinde kayboluyor:\n'
            '${ayrisamayan.join('\n')}',
      );
    });
  });

  group('Uç örnekler — beklenen metin rengi', () {
    test('Dortmund sarısında SİYAH metin', () {
      // Zemin yazısı artık İKİNCİ RENGİN tonudur (ters kontrast kuralı).
      // Dortmund (sarı, siyah) olduğu için sonuç siyahtır — eskiden projenin
      // kendi koyu mürekkebi (#101828) hesaplanıyordu. Kontrol edilen şey
      // aynı: sarı zeminde yazı KOYU olmalı, beyaz değil.
      final p = takimPaletiBul('BVB 09 Borussia Dortmund')!;
      expect(gorecelParlaklik(p.zeminUstuMetin), lessThan(0.1));
      expect(kontrastOrani(p.zemin, p.zeminUstuMetin), greaterThan(10));
    });

    test('Beşiktaş siyahında BEYAZ metin', () {
      // (siyah, beyaz) → zemin siyah, zemin yazısı ikinci renk: beyaz.
      final p = takimPaletiBul('Beşiktaş')!;
      expect(p.zeminUstuMetin, const Color(0xFFFFFFFF));
      expect(p.yuzey, const Color(0xFFFFFFFF), reason: 'kart ikinci renk');
      expect(gorecelParlaklik(p.metin), lessThan(0.05), reason: 'kart yazısı');
    });

    test('beyaz ağırlıklı takımda kimlik ikincil renkten gelir', () {
      // Real Madrid beyaz: zemin beyaza yakın kalır ama vurgu altın olmalı,
      // yoksa tema varsayılandan ayırt edilemez.
      final p = takimPaletiBul('Real Madrid CF')!;
      expect(
        kontrastOrani(p.yuzey, p.vurgu),
        greaterThan(kAaBuyukEsigi),
        reason: 'beyaz takımda vurgu kartta görünmeli',
      );
    });
  });
  // ══════════════════════════════════════════════════════════════════════════
  // ANLAMSAL RENKLER — ne takım ne görünüm bunlara DOKUNABİLİR
  // ══════════════════════════════════════════════════════════════════════════
  group('Anlamsal renkler korunur', () {
    test('hata rengi her iki görünümde de AYNI', () {
      gorunumuUygula(Brightness.light);
      final acik = AppTheme.gecerli(Brightness.light).colorScheme.error;
      gorunumuUygula(Brightness.dark);
      final koyu = AppTheme.gecerli(Brightness.dark).colorScheme.error;
      expect(koyu, acik);
      gorunumuUygula(Brightness.light);
    });

    test('AppColors anlamsal sabitleri hâlâ sabit', () {
      expect(AppColors.success, const Color(0xFF16A34A));
      expect(AppColors.danger, const Color(0xFFDC2626));
      expect(AppColors.warning, const Color(0xFFF59E0B));
      expect(AppColors.info, const Color(0xFF2563EB));
      expect(AppColors.live, const Color(0xFFE21B2D));
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // YENİ SÖZLEŞME (kullanıcı isteği, 2026-08-12): favori takım YAPISAL
  // renklere karışmaz. Burada eskiden "takım değişince zemin ve yüzey yeni
  // palete geçer" testleri vardı; kural tersine döndüğü için beklenti de
  // tersine çevrildi — kapsam düşürülmedi.
  // ══════════════════════════════════════════════════════════════════════════
  group('Takım yapısal temayı DEĞİŞTİRMEZ', () {
    tearDown(() {
      auth.authState.value = const auth.AuthState();
      gorunumuUygula(Brightness.light);
    });

    testWidgets('favori takım değişince zemin ve yüzey AYNI kalır', (t) async {
      gorunumuUygula(Brightness.light);
      final zeminOnce = AppColors.background;
      final yuzeyOnce = AppColors.surface;

      auth.authState.value = const auth.AuthState(
        user: {'favorite_team': 'Fenerbahçe'},
      );
      await t.pump();

      expect(AppColors.background, zeminOnce);
      expect(AppColors.surface, yuzeyOnce);
    });

    testWidgets('takım paleti ağaca ULAŞIR — kimlik alanları için', (t) async {
      TakimPaleti? gorulen;
      await t.pumpWidget(
        TakimTemasi(
          palet: takimPaletiBul('Galatasaray'),
          child: Builder(
            builder: (c) {
              gorulen = c.takimPaleti;
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      expect(gorulen, isNotNull);
      expect(gorulen!.takim, 'Galatasaray');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ThemeData artık GÖRÜNÜMDEN gelir
  // ══════════════════════════════════════════════════════════════════════════
  group('ThemeData görünümü izler', () {
    tearDown(() => gorunumuUygula(Brightness.light));

    test('koyu görünümde zemin ve üst çubuk KOYU', () {
      gorunumuUygula(Brightness.light);
      final a = AppTheme.gecerli(Brightness.light);
      gorunumuUygula(Brightness.dark);
      final k = AppTheme.gecerli(Brightness.dark);

      expect(k.scaffoldBackgroundColor, isNot(a.scaffoldBackgroundColor));
      expect(
        gorecelParlaklik(k.scaffoldBackgroundColor),
        lessThan(gorecelParlaklik(a.scaffoldBackgroundColor)),
      );
      expect(k.appBarTheme.backgroundColor, AppColors.card);
      expect(k.dividerColor, AppColors.border);
    });
  });
}
