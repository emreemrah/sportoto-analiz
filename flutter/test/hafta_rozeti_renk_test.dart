// HAFTA ROZETİ RENKLERİ.
//
// ── 16 Ağustos 2026 (kullanıcı kararı) ─────────────────────────────────────
// "2. hafta rengi 1. haftada olması lazım, 2. hafta rengi de koyu mavi yani
// uygulamanın ana rengi olsun":
//   GEÇEN hafta  → vurgu (accent) dolgusu
//   GÜNCEL hafta → marka koyu mavisi (#0B1B3A)
//
// ── 17 Ağustos 2026 (kullanıcı kararı — ÖNCEKİ KARARIN BİR YARISI DÖNDÜ) ───
// "açık koyu modda güzel yaptık ama takım teması modunda takım temasına uyum
// sağlaması lazım."
//
// Yani marka mavisi AÇIK/KOYU görünümde kalır (o iki mod onaylandı), ama TAKIM
// TEMASINDA rozet takımın vurgu ailesine geçer. Gerekçe: o modda zemin, kart,
// metin, buton — hepsi takımın iki renginden türüyor; ortada duran tek lacivert
// blok temanın dışına düşüyordu.
//
// İKİ HAFTAYI AYIRAN ŞEY DE DEĞİŞTİ. Takım temasında `accent` ile `primary`
// AYNI değere (`p.vurgu`) yazılıyor; iki dolgu renkle ayrılamıyor. Üçüncü yüzey
// olarak önce `primarySoft` denendi ve ölçüm iyiydi (ayrım 2.59, yazı 150/150
// AA) ama Galatasaray'da koyu hardal (#4D3701) veriyordu — kullanıcının daha
// önce reddettiği "çamurlu ton" ailesi. Kullanıcı çerçeveli istedi:
//   güncel hafta → DOLGULU vurgu,  geçen hafta → ÇERÇEVELİ.
// Ayrım artık BİÇİMDEN geliyor ve paletten bağımsız. Çerçeveli rozetin yazısı
// `primary` DEĞİL kartın kendi metni: `primary`yi yazı yapmak 150 takımın
// 63'ünde AA altında kalıyordu (en kötü Alanyaspor 3.00).
//
// Bu dosyanın önceki sürümü tam tersini sabitliyordu ("GÜNCEL hafta rozeti mavi
// KİMLİĞİNİ korur", hue kayması < 12). O test yanlış değildi — o günün kararını
// koruyordu; karar değişince test de değişir ve NEDENİ burada yazılır.
//
// ── DEĞİŞMEYEN KISITLAR (hangi karar olursa olsun) ────────────────────────
//   1. Rozet KARTTAN ayrışır — sabit renk istemek, görünmez rozet istemek
//      değildir (bugün altı kez yaşanan "yüzey ayrışmıyor" hatası).
//   2. Yazı BASILAN yüzeyden türetilir ve AA okunur.
//   3. İKİ HAFTA birbirinden ayırt edilir — yoksa rozet bilgi taşımaz.
// Üçü de 150 takım paletinin TAMAMINDA ölçülür; tek takımla "oldu" demek bu
// dosyanın geçmişinde iki kez yanlış çıktı.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/takim_gorunumu.dart';
import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/home/home_screen.dart';

const _temalar = <String, (int, int)>{
  'Galatasaray': (0xFFFDB912, 0xFFA90432),
  'Fenerbahçe': (0xFF00417F, 0xFFFFED00),
  'Trabzonspor': (0xFF902F2F, 0xFF4FBFF0),
  'Beşiktaş': (0xFF000000, 0xFFFFFFFF),
};

/// Ekrandaki hesabın AYNISI (`_KickoffCard._haftaRozeti`). Burada yeniden
/// yazılıyor çünkü rozet özel bir widget değil; kopya kaymasın diye ekranla
/// aynı tokenlar ve aynı sıra kullanılır. Kopyanın gerçekten ekranla aynı
/// kaldığını `ana_sayfa_kurallari_test` çizilen widget'tan okuyarak doğrular.
typedef Rozet = ({Color? dolgu, Color yazi, bool cerceveli, Color? cerceve});

Rozet _rozet({required bool oncekiHafta}) {
  final cerceveli = AppColors.takimTemasiEtkin && oncekiHafta;
  if (cerceveli) {
    return (
      dolgu: null,
      yazi: AppColors.text,
      cerceveli: true,
      cerceve: AppColors.primary,
    );
  }
  final Color dolgu;
  if (AppColors.takimTemasiEtkin) {
    dolgu = okunurAyrisanYuzey(AppColors.primary, AppColors.card);
  } else if (oncekiHafta) {
    dolgu = AppColors.accent;
  } else {
    dolgu = ayrisanYuzey(kMarkaMavisi, AppColors.card);
  }
  return (
    dolgu: dolgu,
    yazi: (!AppColors.takimTemasiEtkin && oncekiHafta)
        ? AppColors.onAccent
        : okunurMetin(dolgu),
    cerceveli: false,
    cerceve: null,
  );
}

/// Rozetin yazısı hangi yüzeyin üstünde duruyor? Dolgusuz rozette KART.
Color _yaziZemini(Rozet r) => r.dolgu ?? AppColors.card;

void main() {
  test('marka mavisi uygulamanın ana rengidir', () {
    expect(kMarkaMavisi, const Color(0xFF0B1B3A));
  });

  // ── AÇIK / KOYU: MARKA MAVİSİ KALIR ──────────────────────────────────────
  group('açık/koyu görünüm (marka kimliği)', () {
    tearDown(() => gorunumuUygula(Brightness.light));

    for (final mod in [Brightness.light, Brightness.dark]) {
      final ad = mod == Brightness.light ? 'açık' : 'koyu';

      test('$ad: güncel hafta rozeti MAVİ kimliğini korur', () {
        gorunumuUygula(mod);
        final dolgu = _rozet(oncekiHafta: false).dolgu!;
        final h = HSLColor.fromColor(dolgu).hue;
        final markaH = HSLColor.fromColor(kMarkaMavisi).hue;
        expect(
          (h - markaH).abs(),
          lessThan(12),
          reason: '$ad görünümde mavi kimliği kaybolmuş (hue $markaH → $h)',
        );
      });

      test('$ad: İKİSİ DE DOLGULU — çerçeve yalnız takım temasına ait', () {
        gorunumuUygula(mod);
        for (final onceki in [false, true]) {
          final r = _rozet(oncekiHafta: onceki);
          expect(
            r.cerceveli,
            isFalse,
            reason: '$ad · onceki=$onceki: onaylanmış görünüm değişmiş',
          );
          expect(r.dolgu, isNotNull);
        }
      });

      test('$ad: iki rozet de karttan ayrışır ve yazıları okunur', () {
        gorunumuUygula(mod);
        for (final onceki in [false, true]) {
          final r = _rozet(oncekiHafta: onceki);
          expect(
            kontrastOrani(r.dolgu!, AppColors.card),
            greaterThanOrEqualTo(1.4),
            reason: '$ad · onceki=$onceki: rozet kartın içinde eriyor',
          );
          expect(
            kontrastOrani(r.yazi, _yaziZemini(r)),
            greaterThanOrEqualTo(4.5),
            reason: '$ad · onceki=$onceki: rozet yazısı okunmuyor',
          );
        }
      });

      test('$ad: iki hafta RENKLE ayırt edilir', () {
        gorunumuUygula(mod);
        expect(
          kontrastOrani(
            _rozet(oncekiHafta: false).dolgu!,
            _rozet(oncekiHafta: true).dolgu!,
          ),
          greaterThanOrEqualTo(1.6),
          reason: '$ad görünümde iki hafta rozeti ayırt edilemiyor',
        );
      });
    }
  });

  // ── TAKIM TEMASI: RENK TAKIMDAN GELİR ────────────────────────────────────
  group('takım teması', () {
    tearDown(() => gorunumuUygula(Brightness.light));

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

        test('güncel hafta TAKIMIN vurgusuyla dolar — lacivert basılmaz', () {
          final guncel = _rozet(oncekiHafta: false).dolgu!;
          expect(
            guncel,
            equals(okunurAyrisanYuzey(AppColors.primary, AppColors.card)),
            reason: '${t.key}: güncel hafta rozeti takım vurgusundan gelmiyor',
          );
          // ASIL BİLDİRİLEN KUSUR: tema dışı lacivert blok. Marka mavisi
          // takımın kendi rengi OLABİLİR (ör. lacivert bir takım) — o yüzden
          // yasak "mavi olmak" değil, "takımdan BAĞIMSIZ olmak"tır.
          if (kontrastOrani(AppColors.primary, kMarkaMavisi) > 1.2) {
            expect(
              kontrastOrani(guncel, kMarkaMavisi),
              greaterThan(1.2),
              reason: '${t.key}: rozet hâlâ marka lacivertine oturuyor',
            );
          }
        });

        test('geçen hafta ÇERÇEVELİ — dolgu yok, çerçeve takım vurgusu', () {
          final gecen = _rozet(oncekiHafta: true);
          expect(gecen.cerceveli, isTrue);
          expect(
            gecen.dolgu,
            isNull,
            reason: '${t.key}: geçen hafta rozeti hâlâ dolgulu — kullanıcı '
                'çerçeveli istedi (çamurlu yumuşak ton yerine)',
          );
          expect(gecen.cerceve, equals(AppColors.primary));
        });
      });
    }

    // TEK TAKIMLA "OLDU" DEMEK BU DOSYADA İKİ KEZ YANLIŞ ÇIKTI — kısıtlar
    // katalogdaki 150 paletin TAMAMINDA taranır.
    //
    // ÇERÇEVELİ ROZETTE KISITLAR DEĞİŞİR, AZALMAZ:
    //   • dolgulu rozet (güncel) → karttan ayrışsın + yazısı dolgu üstünde AA,
    //   • çerçeveli rozet (geçen) → yazısı KART üstünde AA + çerçevesi görünsün,
    //   • iki hafta ayrımı → artık BİÇİMDEN gelir (biri dolgulu, öteki değil),
    //     bu yüzden renk kontrastı ARANMAZ; ayrımın paletten bağımsız olması
    //     çerçeveyi seçmenin sebebiydi.
    test('150 takım paletinin TAMAMINDA kısıtlar tutar', () {
      final paletler = tumTakimPaletleri();
      expect(paletler.length, greaterThan(100));

      for (final p in paletler) {
        takimGorunumunuUygula(p);
        final guncel = _rozet(oncekiHafta: false);
        final gecen = _rozet(oncekiHafta: true);

        // Ayrım biçimden: tam olarak biri dolgulu olmalı.
        expect(guncel.dolgu, isNotNull, reason: '${p.takim}: güncel dolgusuz');
        expect(gecen.dolgu, isNull, reason: '${p.takim}: geçen dolgulu');

        expect(
          kontrastOrani(guncel.dolgu!, AppColors.card),
          greaterThanOrEqualTo(1.4),
          reason: '${p.takim}: dolgulu rozet kartın içinde eriyor',
        );
        expect(
          kontrastOrani(gecen.cerceve!, AppColors.card),
          greaterThanOrEqualTo(1.4),
          reason: '${p.takim}: çerçeve kartın içinde kayboluyor — rozetin '
              'sınırı yalnız oradan geliyor',
        );
        for (final (ad, r) in [('guncel', guncel), ('gecen', gecen)]) {
          expect(
            kontrastOrani(r.yazi, _yaziZemini(r)),
            greaterThanOrEqualTo(4.5),
            reason: '${p.takim} · $ad: rozet yazısı okunmuyor',
          );
        }
      }
    });
  });

  // ── BAYRAK GERÇEĞİ SÖYLER ────────────────────────────────────────────────
  // Rozetin doğru rengi seçmesi tamamen bu bayrağa bağlı; yanlış kalırsa hata
  // sessizdir (renk yanlış ama uygulama çalışır).
  group('AppColors.takimTemasiEtkin', () {
    tearDown(() => gorunumuUygula(Brightness.light));

    test('takım paleti uygulanınca true, açık/koyu uygulanınca false', () {
      gorunumuUygula(Brightness.light);
      expect(AppColors.takimTemasiEtkin, isFalse);

      takimGorunumunuUygula(
        paletUret(
          takim: 'Galatasaray',
          ana: const Color(0xFFFDB912),
          ikincil: const Color(0xFFA90432),
        ),
      );
      expect(AppColors.takimTemasiEtkin, isTrue);

      // Takım temasından çıkış: bayrak GERİ dönmeli, yoksa açık modda rozet
      // takım rengiyle kalır.
      gorunumuUygula(Brightness.dark);
      expect(AppColors.takimTemasiEtkin, isFalse);
    });
  });
}
