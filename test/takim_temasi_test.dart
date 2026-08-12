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
      expect(p.ana, const Color(0xFFA90432));
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

    test('kart zeminden AYIRT EDİLİR', () {
      final ayrisamayan = <String>[];
      for (final p in paletler) {
        final k = kontrastOrani(p.zemin, p.yuzey);
        if (k < 1.12) ayrisamayan.add('${p.takim}: ${k.toStringAsFixed(3)}');
      }
      expect(
        ayrisamayan,
        isEmpty,
        reason: 'kart zeminden ayrılmıyor:\n${ayrisamayan.join('\n')}',
      );
    });

    test('vurgu zeminden AYIRT EDİLİR (buton kaybolmaz)', () {
      final ayrisamayan = <String>[];
      for (final p in paletler) {
        final k = kontrastOrani(p.zemin, p.vurgu);
        if (k < 1.5) ayrisamayan.add('${p.takim}: ${k.toStringAsFixed(2)}');
      }
      expect(
        ayrisamayan,
        isEmpty,
        reason: 'vurgu zeminde kayboluyor:\n${ayrisamayan.join('\n')}',
      );
    });
  });

  group('Uç örnekler — beklenen metin rengi', () {
    test('Dortmund sarısında SİYAH metin', () {
      final p = takimPaletiBul('BVB 09 Borussia Dortmund')!;
      expect(p.zeminUstuMetin, const Color(0xFF101828));
      expect(kontrastOrani(p.zemin, p.zeminUstuMetin), greaterThan(10));
    });

    test('Beşiktaş siyahında BEYAZ metin', () {
      final p = takimPaletiBul('Beşiktaş')!;
      expect(p.zeminUstuMetin, const Color(0xFFFFFFFF));
    });

    test('beyaz ağırlıklı takımda kimlik ikincil renkten gelir', () {
      // Real Madrid beyaz: zemin beyaza yakın kalır ama vurgu altın olmalı,
      // yoksa tema varsayılandan ayırt edilemez.
      final p = takimPaletiBul('Real Madrid CF')!;
      expect(
        kontrastOrani(p.zemin, p.vurgu),
        greaterThan(1.5),
        reason: 'beyaz takımda vurgu görünmeli',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ANLAMSAL RENKLER — takım teması bunlara DOKUNAMAZ
  // ══════════════════════════════════════════════════════════════════════════
  group('Anlamsal renkler korunur', () {
    test('hata rengi takım temasında da AYNI', () {
      final varsayilan = AppTheme.light.colorScheme.error;
      for (final ad in const [
        'Galatasaray', // kırmızı ağırlıklı
        'BVB 09 Borussia Dortmund', // sarı ağırlıklı
        'Beşiktaş', // siyah-beyaz
        'Liverpool FC', // kırmızı
      ]) {
        final t = AppTheme.takimli(takimPaletiBul(ad));
        expect(
          t.colorScheme.error,
          varsayilan,
          reason: '$ad temasında hata rengi değişmiş',
        );
      }
    });

    test('AppColors anlamsal sabitleri hâlâ sabit', () {
      // Tema katmanı bu değerleri değiştiremez; sabit olarak duruyorlar.
      expect(AppColors.success, const Color(0xFF16A34A));
      expect(AppColors.danger, const Color(0xFFDC2626));
      expect(AppColors.warning, const Color(0xFFF59E0B));
      expect(AppColors.info, const Color(0xFF2563EB));
    });

    test('palet null iken tema BİREBİR varsayılan', () {
      final t = AppTheme.takimli(null);
      expect(t.scaffoldBackgroundColor, AppTheme.light.scaffoldBackgroundColor);
      expect(t.colorScheme.primary, AppTheme.light.colorScheme.primary);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ÇALIŞMA ZAMANI: favori takım değişince tema YENİDEN BAŞLATMADAN döner.
  // ══════════════════════════════════════════════════════════════════════════
  group('Takım değişince tema güncellenir', () {
    tearDown(() => auth.authState.value = const auth.AuthState());

    testWidgets('favori takım değişince zemin ve yüzey yeni palete geçer', (
      t,
    ) async {
      auth.authState.value = const auth.AuthState(
        token: 't',
        ready: true,
        user: {'favorite_team': 'BVB 09 Borussia Dortmund'},
      );

      late BuildContext yakalanan;
      await t.pumpWidget(
        ValueListenableBuilder<auth.AuthState>(
          valueListenable: auth.authState,
          builder: (_, s, _) {
            final palet = favoriTakimPaleti(s);
            return MaterialApp(
              theme: AppTheme.takimli(palet),
              home: TakimTemasi(
                palet: palet,
                child: Builder(
                  builder: (c) {
                    yakalanan = c;
                    return const Scaffold(body: SizedBox());
                  },
                ),
              ),
            );
          },
        ),
      );
      await t.pump();

      final dortmund = takimPaletiBul('BVB 09 Borussia Dortmund')!;
      expect(yakalanan.temaZemin, dortmund.zemin);
      expect(yakalanan.temaYuzey, dortmund.yuzey);

      // TAKIM DEĞİŞTİ — uygulama yeniden başlatılmadan.
      auth.authState.value = const auth.AuthState(
        token: 't',
        ready: true,
        user: {'favorite_team': 'Fenerbahçe'},
      );
      await t.pump();

      final fener = takimPaletiBul('Fenerbahçe')!;
      expect(yakalanan.temaZemin, fener.zemin);
      expect(
        yakalanan.temaZemin,
        isNot(dortmund.zemin),
        reason: 'tema eski takımda kalmış',
      );
    });

    testWidgets('takım kaldırılınca VARSAYILAN temaya döner', (t) async {
      auth.authState.value = const auth.AuthState(
        token: 't',
        ready: true,
        user: {'favorite_team': 'Galatasaray'},
      );

      late BuildContext yakalanan;
      await t.pumpWidget(
        ValueListenableBuilder<auth.AuthState>(
          valueListenable: auth.authState,
          builder: (_, s, _) => TakimTemasi(
            palet: favoriTakimPaleti(s),
            child: MaterialApp(
              home: Builder(
                builder: (c) {
                  yakalanan = c;
                  return const Scaffold(body: SizedBox());
                },
              ),
            ),
          ),
        ),
      );
      await t.pump();
      expect(yakalanan.temaZemin, isNot(AppColors.bg));

      auth.authState.value = const auth.AuthState(
        token: 't',
        ready: true,
        user: {'favorite_team': ''},
      );
      await t.pump();

      expect(
        yakalanan.temaZemin,
        AppColors.bg,
        reason: 'takım yokken varsayılan tema korunmalı',
      );
      expect(yakalanan.temaYuzey, AppColors.card);
      expect(yakalanan.temaKenarlik, AppColors.border);
    });
  });

  group('ThemeData takım paletini kullanır', () {
    test('zemin, üst çubuk ve ayırıcı palete döner', () {
      final p = takimPaletiBul('BVB 09 Borussia Dortmund')!;
      final t = AppTheme.takimli(p);
      expect(t.scaffoldBackgroundColor, p.zemin);
      expect(t.appBarTheme.backgroundColor, p.yuzey);
      expect(t.dividerColor, p.kenarlik);
      expect(t.colorScheme.surface, p.yuzey);
    });
  });
}
