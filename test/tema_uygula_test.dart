// TAKIM TEMASININ GERÇEKTEN UYGULANDIĞINI DOĞRULAR (kullanıcı isteği,
// 2026-08-12).
//
// Kullanıcının şikâyeti şuydu: "sadece bazı arka planlar değişiyor, eski
// lacivert, kırmızı, beyaz ve gri renkler birçok yerde kalıyor". Sebep
// ölçüldü: ekranlar rengi `Theme.of(context)`ten değil doğrudan
// `AppColors`tan okuyor. Çözüm yapısal renkleri değişkene çevirmek oldu.
//
// BU DOSYA O ÇÖZÜMÜN İKİ AYAĞINI KORUR:
//
//  1. Yapısal renkler paletle DEĞİŞİR, anlamsal renkler DEĞİŞMEZ.
//  2. `AppColors`tan TÜRETİLMİŞ modül/sınıf düzeyi değerler DONMAZ.
//
// (2) uydurma bir korku değil: geçiş sırasında bu değerler `final` yazıldığı
// için gerçekten dondular. Dart'ta modül düzeyi `final` BİR KEZ hesaplanır;
// panel, istatistik çubukları ve rozetler ilk okundukları tonda kalıyordu —
// yani tam kullanıcının şikâyet ettiği hata, bu sefer sessiz biçimde geri
// gelmişti. Hepsi getter'a çevrildi. Aşağıdaki testler `final`e dönülürse
// KIRMIZI olur.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:masteranaliz/core/theme/takim_paleti.dart';
import 'package:masteranaliz/core/theme/takim_renkleri.dart';
import 'package:masteranaliz/core/theme/tema_uygula.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/match_detail/istatistik_gorsel.dart';
import 'package:masteranaliz/features/match_detail/match_detail_text.dart';
import 'package:masteranaliz/features/radar/radar_center_cards.dart';
import 'package:masteranaliz/widgets/app_ui.dart';

/// Dortmund'un KATALOGDAKİ tam adı. Eşleşme bilerek TAM ADLA yapılır: kısmi
/// eşleşme "Manchester" gibi bir parçayı iki ayrı kulübe bağlayabilirdi.
/// Kullanıcı verisi (`favorite_team`) de aynı katalogdan geldiği için
/// uygulamada bu ad birebir gelir.
const _kDortmund = 'BVB 09 Borussia Dortmund';

TakimPaleti _palet(String ad) {
  final p = takimPaletiBul(ad);
  expect(p, isNotNull, reason: '$ad katalogda bulunmalı');
  return p!;
}

void main() {
  // GLOBAL DURUM: `temayiUygula` statik alanlara yazar. Her testin temiz
  // başlaması ve dosyanın diğer test dosyalarını KİRLETMEMESİ şart.
  setUp(() => temayiUygula(null));
  tearDown(() => temayiUygula(null));

  group('Yapısal renkler paletle değişir', () {
    test('zemin, yüzey, birincil, vurgu, kenarlık ve metin hepsi değişir', () {
      final varsayilan = (
        zemin: AppColors.background,
        yuzey: AppColors.surface,
        birincil: AppColors.primary,
        vurgu: AppColors.accent,
        kenarlik: AppColors.border,
        metin: AppColors.text,
        kart: AppColors.card,
        gri: AppColors.gray,
      );

      temayiUygula(_palet('Fenerbahçe'));

      expect(AppColors.background, isNot(varsayilan.zemin));
      expect(AppColors.surface, isNot(varsayilan.yuzey));
      expect(AppColors.primary, isNot(varsayilan.birincil));
      expect(AppColors.accent, isNot(varsayilan.vurgu));
      expect(AppColors.border, isNot(varsayilan.kenarlik));
      expect(AppColors.card, isNot(varsayilan.kart));
      expect(AppColors.gray, isNot(varsayilan.gri));
      // Metin ZORUNLU değil (koyu zeminde de koyu metin çıkabilir) — ama
      // yüzeyle arasındaki kontrast korunmalı; onu aşağıdaki test ölçer.
      expect(AppColors.text, isNotNull);
      expect(varsayilan.metin, isNotNull);
    });

    test('eski takma adlar da (bg / cardAlt / textMuted / track) çevrilir', () {
      temayiUygula(_palet('Galatasaray'));

      // Bu adlar 159 kaynak dosyanın bir kısmında hâlâ kullanılıyor; biri
      // atlanırsa o ekranlar marka renginde kalır — kullanıcının şikâyeti
      // tam olarak buydu.
      expect(AppColors.bg, AppColors.background);
      expect(AppColors.card, AppColors.surface);
      expect(AppColors.textMuted, AppColors.muted);
      expect(AppColors.gray, AppColors.muted);
      expect(AppColors.cardAlt, isNot(VarsayilanRenkler.cardAlt));
      expect(AppColors.track, isNot(VarsayilanRenkler.track));
    });

    test('ikinci renk küçük bir detay değil: birincil ve vurgu AYRI', () {
      // Kullanıcı isteği: "seçili alanlar, birincil aksiyonlar ve vurgular
      // ikinci rengi görünür biçimde kullansın".
      for (final ad in ['Fenerbahçe', 'Galatasaray', 'Beşiktaş', _kDortmund]) {
        final p = _palet(ad);
        temayiUygula(p);
        expect(
          AppColors.primary,
          p.secili,
          reason: '$ad: birincil = seçili durum rengi',
        );
        expect(AppColors.accent, p.vurgu, reason: '$ad: vurgu = vurgu rengi');
      }
    });

    test('yüzey ile metin arasında AA kontrastı korunur', () {
      for (final ad in ['Fenerbahçe', 'Galatasaray', 'Beşiktaş', _kDortmund]) {
        temayiUygula(_palet(ad));
        expect(
          kontrastOrani(AppColors.text, AppColors.surface),
          greaterThanOrEqualTo(kAaEsigi),
          reason: '$ad: kart metni okunmalı',
        );
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // KONTRAST TARAMASI — kullanıcı isteği: "her ekranda kontrast korunacak".
  //
  // Bu tarama tek tek yazılmış beklentilerden daha güçlü çünkü 150 takımın
  // HEPSİNİ ve yazının düşebileceği HER zemini birlikte deniyor. Geliştirme
  // sırasında bu tablo 2700 kontrolde 700'den fazla sapma gösterdi; palet
  // türetmesi o ölçümlere bakılarak yeniden yazıldı.
  //
  // Yeni bir renk alanı eklendiğinde buraya da bir satır eklenmeli: burada
  // ölçülmeyen bir eşleşme, sahada okunmayan bir yazı demektir.
  // ══════════════════════════════════════════════════════════════════════
  group('150 takım kontrast taraması', () {
    test('yazı düştüğü HER zeminde AA eşiğini geçer', () {
      final sapma = <String>[];

      for (final p in tumTakimPaletleri()) {
        temayiUygula(p);

        void bak(String ad, Color on, Color zemin) {
          final o = kontrastOrani(on, zemin);
          if (o < kAaEsigi) {
            sapma.add('${p.takim} → $ad = ${o.toStringAsFixed(2)}');
          }
        }

        // Zemin rolündeki takım renklerinin ÜSTÜNDEKİ yazı.
        bak('onPrimary@primary', AppColors.onPrimary, AppColors.primary);
        bak('onAccent@accent', AppColors.onAccent, AppColors.accent);
        bak('beyaz@darkCard', AppColors.white, AppColors.darkCard);
        bak('beyaz@darkCardSoft', AppColors.white, AppColors.darkCardSoft);

        // Takım renkleri YAZI rolünde — kartta, zeminde, rozet zemininde.
        bak('primary@surface', AppColors.primary, AppColors.surface);
        bak('accent@surface', AppColors.accent, AppColors.surface);
        bak('primary@background', AppColors.primary, AppColors.background);
        bak('accent@background', AppColors.accent, AppColors.background);
        bak('primary@primarySoft', AppColors.primary, AppColors.primarySoft);
        bak('accent@accentSoft', AppColors.accent, AppColors.accentSoft);
        bak('primary@cardAlt', AppColors.primary, AppColors.cardAlt);

        // Ana ve ikincil yazı, düştüğü bütün yüzeylerde.
        bak('text@surface', AppColors.text, AppColors.surface);
        bak('text@background', AppColors.text, AppColors.background);
        bak('text@surfaceSoft', AppColors.text, AppColors.surfaceSoft);
        bak('text@cardAlt', AppColors.text, AppColors.cardAlt);
        bak('text@bgAlt', AppColors.text, AppColors.bgAlt);
        bak('muted@surface', AppColors.muted, AppColors.surface);
        bak('muted@background', AppColors.muted, AppColors.background);
        bak('muted@surfaceSoft', AppColors.muted, AppColors.surfaceSoft);
        bak('textSoft@surface', AppColors.textSoft, AppColors.surface);
        bak('textSoft@background', AppColors.textSoft, AppColors.background);
      }

      expect(
        sapma,
        isEmpty,
        reason:
            'AA eşiğini geçemeyen ${sapma.length} eşleşme:\n'
            '${sapma.take(20).join('\n')}',
      );
    });

    test('koyu tema koyu, açık tema açık kalır — arada takım YOK', () {
      // Palet iki eksene oturur; ara bölgede hiçbir renk AA'ya ulaşamıyor
      // (ölçüldü). Bu test o ayrımın korunduğunu doğrular.
      for (final p in tumTakimPaletleri()) {
        final zeminL = gorecelParlaklik(p.zemin);
        expect(
          zeminL <= 0.16 || zeminL >= 0.5,
          isTrue,
          reason: '${p.takim}: zemin ara bölgede (L=$zeminL)',
        );
        // Kart zeminle AYNI uçta durur.
        final kartL = gorecelParlaklik(p.yuzey);
        expect(
          zeminL <= 0.16 ? kartL <= 0.16 : kartL >= 0.5,
          isTrue,
          reason:
              '${p.takim}: kart zeminin ters ucunda (zemin=$zeminL '
              'kart=$kartL)',
        );
      }
    });
  });

  group('Anlamsal renkler bağımsız kalır', () {
    test('takım kırmızı bile olsa hata/başarı/uyarı renkleri sabit', () {
      const basari = AppColors.success;
      const hata = AppColors.danger;
      const uyari = AppColors.warning;
      const bilgi = AppColors.info;
      const yesil = AppColors.green;
      const sari = AppColors.yellow;
      const kirmizi = AppColors.red;

      // Galatasaray (sarı-kırmızı) ve Fenerbahçe (lacivert-sarı): ikisi de
      // anlamsal renklerle çakışan tonlar taşır.
      for (final ad in ['Galatasaray', 'Fenerbahçe']) {
        temayiUygula(_palet(ad));
        expect(AppColors.success, basari);
        expect(AppColors.danger, hata);
        expect(AppColors.warning, uyari);
        expect(AppColors.info, bilgi);
        expect(AppColors.green, yesil);
        expect(AppColors.yellow, sari);
        expect(AppColors.red, kirmizi);
        expect(LabelColors.green, AppColors.success);
        expect(LabelColors.red, AppColors.danger);
        expect(LabelColors.gray, const Color(0xFF98A2B3));
      }
    });
  });

  group('Varsayılana dönüş', () {
    test('takım seçilmeyince HER yapısal alan marka rengine döner', () {
      temayiUygula(_palet('Beşiktaş'));
      temayiUygula(null);

      expect(AppColors.background, VarsayilanRenkler.background);
      expect(AppColors.surface, VarsayilanRenkler.surface);
      expect(AppColors.surfaceSoft, VarsayilanRenkler.surfaceSoft);
      expect(AppColors.primary, VarsayilanRenkler.primary);
      expect(AppColors.primaryDark, VarsayilanRenkler.primaryDark);
      expect(AppColors.primarySoft, VarsayilanRenkler.primarySoft);
      expect(AppColors.accent, VarsayilanRenkler.accent);
      expect(AppColors.accentSoft, VarsayilanRenkler.accentSoft);
      expect(AppColors.text, VarsayilanRenkler.text);
      expect(AppColors.textSoft, VarsayilanRenkler.textSoft);
      expect(AppColors.muted, VarsayilanRenkler.muted);
      expect(AppColors.border, VarsayilanRenkler.border);
      expect(AppColors.darkCard, VarsayilanRenkler.darkCard);
      expect(AppColors.darkCardSoft, VarsayilanRenkler.darkCardSoft);
      expect(AppColors.bg, VarsayilanRenkler.background);
      expect(AppColors.bgAlt, VarsayilanRenkler.surfaceSoft);
      expect(AppColors.card, VarsayilanRenkler.surface);
      expect(AppColors.cardAlt, VarsayilanRenkler.cardAlt);
      expect(AppColors.textMuted, VarsayilanRenkler.muted);
      expect(AppColors.gray, VarsayilanRenkler.muted);
      expect(AppColors.track, VarsayilanRenkler.track);
    });

    test('aynı paletin iki kez uygulanması sonucu değiştirmez', () {
      final p = _palet(_kDortmund);
      temayiUygula(p);
      final ilk = (AppColors.background, AppColors.surface, AppColors.accent);
      temayiUygula(p);
      expect((AppColors.background, AppColors.surface, AppColors.accent), ilk);
    });

    test('katalogda olmayan takım varsayılanı bozmaz', () {
      expect(takimPaletiBul('Olmayan Kulüp SK'), isNull);
      temayiUygula(takimPaletiBul('Olmayan Kulüp SK'));
      expect(AppColors.background, VarsayilanRenkler.background);
      expect(AppColors.accent, VarsayilanRenkler.accent);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // DONMA TESTLERİ — bu grubun her testi, ilgili değer `final`e çevrilirse
  // kırmızıya döner. Geçiş sırasında hepsi gerçekten `final` yazılmış ve
  // gerçekten donmuştu.
  // ══════════════════════════════════════════════════════════════════════
  group('Türetilmiş renkler donmaz', () {
    test('istatistik çubuklarının ev/deplasman renkleri temayı izler', () {
      // ÖNCE varsayılanda OKUNUR — `final` olsaydı değer tam burada donardı.
      final evVarsayilan = kEvRengi;
      final depVarsayilan = kDepRengi;

      temayiUygula(_palet('Fenerbahçe'));

      expect(kEvRengi, isNot(evVarsayilan));
      expect(kDepRengi, isNot(depVarsayilan));
      expect(kEvRengi, AppColors.accent);
      expect(kDepRengi, AppColors.primary);
    });

    test('tahmin etiketi renkleri temayı izler', () {
      final netVarsayilan = kPredMeta['NET']!.color;
      final bosVarsayilan = kPredMetaBos.color;

      temayiUygula(_palet('Galatasaray'));

      expect(kPredMeta['NET']!.color, isNot(netVarsayilan));
      expect(kPredMetaBos.color, isNot(bosVarsayilan));
      // BANKO yeşildir — anlamsal, değişmemeli.
      expect(kPredMeta['BANKO']!.color, AppColors.green);
    });

    test('radar sınıf kartlarının nötr tonu temayı izler', () {
      final yetersizVarsayilan = kClassMeta['insufficient_data']!.soft;

      temayiUygula(_palet('Beşiktaş'));

      expect(kClassMeta['insufficient_data']!.soft, isNot(yetersizVarsayilan));
      // Güçlü aday YEŞİL kalır — anlamsal.
      expect(kClassMeta['strong_candidate']!.color, AppColors.success);
    });

    testWidgets('Pill rozeti takım rengiyle çizilir', (t) async {
      Color zemin() {
        final k = t.widget<Container>(
          find.descendant(
            of: find.byType(Pill),
            matching: find.byType(Container),
          ),
        );
        return (k.decoration! as BoxDecoration).color!;
      }

      await t.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: Pill(label: 'NET')),
        ),
      );
      final varsayilan = zemin();

      temayiUygula(_palet(_kDortmund));
      // Widget'ı YENİDEN kurar: `final` harita olsaydı yeniden kurulan
      // widget bile eski rengi okurdu.
      await t.pumpWidget(const SizedBox.shrink());
      await t.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: Pill(label: 'NET')),
        ),
      );

      expect(zemin(), isNot(varsayilan));
      expect(zemin(), AppColors.primarySoft);
    });
  });
}
