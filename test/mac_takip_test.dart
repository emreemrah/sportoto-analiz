// BÜLTEN GÜN ŞERİDİ + MAÇ TAKİBİ VE BİLDİRİMLERİ (kullanıcı isteği, 2026-08-11)
//
// NE SABİTLENİYOR:
//  1. Günler bültenin GERÇEK maç tarihlerinden türetilir; sabit tarih yazılmaz
//     ve maçı olmayan gün çizilmez.
//  2. Tarihi olmayan maç gün üretmez (uydurma gün yok).
//  3. Bir güne dokununca liste YALNIZ o günün maçlarını gösterir.
//  4. MAÇ BAZINDA YALITIM — kullanıcının asıl isteği: "Galatasaray–Çorum
//     maçını takip ediyorsa yalnızca bu maç için seçtiği bildirimleri alsın;
//     diğer maçların ayarları bundan etkilenmesin."
//  5. Takip kapalıyken o maçın açık bildirimi YOKTUR.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/bulten_gunleri.dart';
import 'package:masteranaliz/core/mac_takip.dart';
import 'package:masteranaliz/core/prefs.dart';
import 'package:masteranaliz/features/bulletin/bulten_tarih_seridi.dart';
import 'package:masteranaliz/features/bulletin/mac_takip_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Sabit an: testler saate bağımlı olmamalı.
final _an = DateTime(2026, 8, 11, 12);

Map<String, dynamic> _mac(int no, String? tarih, {String? kimlik}) => {
  'no': no,
  'sportotoMatchId': ?kimlik,
  'date': tarih,
  'home': {'name': 'Ev $no'},
  'away': {'name': 'Dep $no'},
};

/// 11 Ağustos'ta 2, 12 Ağustos'ta 1 maç; biri tarihsiz.
final _maclar = [
  _mac(1, '2026-08-11T16:00:00', kimlik: 'uuid-1'),
  _mac(2, '2026-08-11T19:00:00', kimlik: 'uuid-2'),
  _mac(3, '2026-08-12T18:30:00', kimlik: 'uuid-3'),
  _mac(4, null, kimlik: 'uuid-4'),
];

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    // Testler arası sızıntı olmasın.
    setPref('takipEdilenMaclar', <String>[]);
    setPref('macBildirimTercihleri', <String, Object?>{});
  });

  group('Gün şeridi — gerçek bülten tarihlerinden', () {
    test('yalnız maç olan günler, tarih sırasıyla', () {
      final g = bultenGunleri(_maclar, simdi: _an);
      expect(g.map((x) => x.tarih).toList(), ['2026-08-11', '2026-08-12']);
      expect(g[0].macSayisi, 2);
      expect(g[1].macSayisi, 1);
    });

    test('tarihi olmayan maç gün ÜRETMEZ ve hiçbir güne sayılmaz', () {
      final g = bultenGunleri(_maclar, simdi: _an);
      expect(
        g.fold<int>(0, (a, x) => a + x.macSayisi),
        3,
        reason: '4 maçın biri tarihsiz — sayıma girmez',
      );
    });

    test('bugün "Bugün" yazar, diğerleri kısa gün adı', () {
      final g = bultenGunleri(_maclar, simdi: _an);
      expect(g[0].gunAdi, 'Bugün');
      expect(g[0].kisaTarih, '11.08');
      // 12 Ağustos 2026 = Çarşamba
      expect(g[1].gunAdi, 'Çar');
      expect(g[1].kisaTarih, '12.08');
    });

    test('hiç maç yoksa şerit boş', () {
      expect(bultenGunleri(const [], simdi: _an), isEmpty);
      expect(bultenGunleri(null, simdi: _an), isEmpty);
    });
  });

  group('Gün filtresi', () {
    test('seçili günün maçları gelir', () {
      final l = filtreleGune(_maclar, '2026-08-11');
      expect(l.map((m) => (m as Map)['no']).toList(), [1, 2]);
    });

    test('süzgeç kapalıyken (null) bültenin TAMAMI gelir', () {
      expect(filtreleGune(_maclar, null).length, 4);
    });

    test('tarihsiz maç hiçbir günde görünmez', () {
      for (final t in const ['2026-08-11', '2026-08-12']) {
        expect(
          filtreleGune(_maclar, t).map((m) => (m as Map)['no']),
          isNot(contains(4)),
        );
      }
    });

    test('varsayılan seçim: bugün maç varsa bugün', () {
      final g = bultenGunleri(_maclar, simdi: _an);
      expect(varsayilanGunSecimi(g, simdi: _an), '2026-08-11');
    });
  });

  group('Maç takibi — maç bazında', () {
    test('yıldız açılır ve kapanır', () {
      expect(macTakipte('uuid-1'), isFalse);
      macTakipAyarla('uuid-1', true);
      expect(macTakipte('uuid-1'), isTrue);
      macTakipAyarla('uuid-1', false);
      expect(macTakipte('uuid-1'), isFalse);
    });

    test('takip edilmeyen maçın açık bildirimi YOKTUR', () {
      expect(macBildirimTercihleri('uuid-1'), isEmpty);
    });

    test('takibe alınca tüm türler açık başlar', () {
      macTakipAyarla('uuid-1', true);
      expect(
        macBildirimTercihleri('uuid-1').length,
        kMacBildirimTurleri.length,
      );
    });

    // ────────────────────────────────────────────────────────────────────
    // ASIL İSTEK: bir maçın ayarı diğerini ETKİLEMEZ.
    // ────────────────────────────────────────────────────────────────────
    test('bir maçta kapatılan tür, öteki maçta açık kalır', () {
      macTakipAyarla('uuid-1', true);
      macTakipAyarla('uuid-2', true);

      // İKİ MAÇIN DA KENDİ KAYDI OLMALI. İlk kurguda yalnız uuid-1'e yazılıyor,
      // uuid-2 kayıtsız kalıp varsayılana düşüyordu; o hâlde "ayarlar birbirine
      // sızıyor mu" sorusu hiç ölçülmüyordu (bozma denemesinde yakalandı).
      macBildirimAyarla('uuid-2', 'kadro', false);
      macBildirimAyarla('uuid-1', 'gol', false);
      macBildirimAyarla('uuid-1', 'penalti', false);

      expect(macBildirimTercihleri('uuid-1'), isNot(contains('gol')));
      expect(macBildirimTercihleri('uuid-1'), isNot(contains('penalti')));
      expect(
        macBildirimTercihleri('uuid-1'),
        contains('kadro'),
        reason: 'öteki maçın kapattığı tür buraya sızmamalı',
      );

      expect(
        macBildirimTercihleri('uuid-2'),
        contains('gol'),
        reason: 'öteki maçın ayarı değişmemeli',
      );
      expect(macBildirimTercihleri('uuid-2'), contains('penalti'));
      expect(
        macBildirimTercihleri('uuid-2'),
        isNot(contains('kadro')),
        reason: 'kendi kapattığı tür kapalı kalmalı',
      );
    });

    test('bir maçın takibini kapatmak ötekini etkilemez', () {
      macTakipAyarla('uuid-1', true);
      macTakipAyarla('uuid-2', true);
      macTakipAyarla('uuid-1', false);

      expect(macTakipte('uuid-1'), isFalse);
      expect(macTakipte('uuid-2'), isTrue);
      expect(macBildirimTercihleri('uuid-2'), isNotEmpty);
    });

    test('takip kapatılıp yeniden açılınca ESKİ seçim geri gelir', () {
      macTakipAyarla('uuid-1', true);
      macBildirimAyarla('uuid-1', 'gol', false);
      macTakipAyarla('uuid-1', false);
      macTakipAyarla('uuid-1', true);

      expect(
        macBildirimTercihleri('uuid-1'),
        isNot(contains('gol')),
        reason: 'tercih takip kapanınca silinmez',
      );
    });

    test('tanınmayan tür yok sayılır (bozuk/eski kayıt)', () {
      macTakipAyarla('uuid-1', true);
      setPref('macBildirimTercihleri', {
        'uuid-1': ['gol', 'uydurma-tur'],
      });
      expect(macBildirimTercihleri('uuid-1'), {'gol'});
    });

    test('kimlik: sportotoMatchId varsa o kullanılır', () {
      expect(macKimligi(_maclar[0]), 'uuid-1');
      expect(macKimligi({'no': 9}), '9', reason: 'kimlik yoksa sıraya düşer');
    });
  });

  group('Kart simgeleri', () {
    Future<void> ac(WidgetTester t, Map m) async {
      // Bildirim ekranı tembel bir listedir; varsayılan 800x600'de alt
      // satırlar HİÇ kurulmaz ve `find` onları göremez.
      t.view.physicalSize = const Size(1000, 2000);
      t.view.devicePixelRatio = 1.0;
      addTearDown(() {
        t.view.resetPhysicalSize();
        t.view.resetDevicePixelRatio();
      });
      await t.pumpWidget(
        MaterialApp(
          home: Scaffold(body: MacTakipSimgeleri(match: m)),
        ),
      );
      await t.pump();
    }

    testWidgets('yıldız ve çark çizilir', (t) async {
      await ac(t, _maclar[0]);
      expect(find.byKey(const Key('mac-takip-yildiz-uuid-1')), findsOne);
      expect(find.byKey(const Key('mac-bildirim-carki-uuid-1')), findsOne);
    });

    testWidgets('yıldıza dokunmak YALNIZ o maçı takibe alır', (t) async {
      await ac(t, _maclar[0]);
      await t.tap(find.byKey(const Key('mac-takip-yildiz-uuid-1')));
      await t.pump();

      expect(macTakipte('uuid-1'), isTrue);
      expect(macTakipte('uuid-2'), isFalse);
    });

    testWidgets('çark o maçın bildirim ekranını açar', (t) async {
      await ac(t, _maclar[0]);
      await t.tap(find.byKey(const Key('mac-bildirim-carki-uuid-1')));
      await t.pumpAndSettle();

      expect(find.text('Maç Bildirim Ayarları'), findsOne);
      expect(find.text('Ev 1 – Dep 1'), findsOne, reason: 'açılan maç yazılı');
      // Her tür ayrı satır.
      for (final tur in kMacBildirimTurleri) {
        expect(find.byKey(Key('mac-bildirim-tur-${tur.anahtar}')), findsOne);
      }
    });

    testWidgets('takip kapalıyken tür seçilemez', (t) async {
      await ac(t, _maclar[0]);
      await t.tap(find.byKey(const Key('mac-bildirim-carki-uuid-1')));
      await t.pumpAndSettle();

      await t.tap(find.byKey(const Key('mac-bildirim-tur-gol')));
      await t.pump();
      expect(
        macBildirimTercihleri('uuid-1'),
        isEmpty,
        reason: 'takip açılmadan tercih yazılmaz',
      );
    });
  });

  group('Tarih şeridi çizimi', () {
    testWidgets('her maç günü için çip var, seçili gün belli', (t) async {
      final gunler = bultenGunleri(_maclar, simdi: _an);
      String? secili = '2026-08-11';

      await t.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BultenTarihSeridi(
              gunler: gunler,
              secili: secili,
              onSec: (g) => secili = g,
            ),
          ),
        ),
      );

      expect(find.byKey(const Key('bulten-gun-2026-08-11')), findsOne);
      expect(find.byKey(const Key('bulten-gun-2026-08-12')), findsOne);
      expect(find.byKey(const Key('bulten-gun-tumu')), findsOne);
      expect(find.text('Bugün'), findsOne);

      await t.tap(find.byKey(const Key('bulten-gun-2026-08-12')));
      expect(secili, '2026-08-12');
    });

    testWidgets('tek gün varsa şerit hiç çizilmez', (t) async {
      final gunler = bultenGunleri([
        _mac(1, '2026-08-11T16:00:00'),
      ], simdi: _an);
      await t.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BultenTarihSeridi(
              gunler: gunler,
              secili: null,
              onSec: (_) {},
            ),
          ),
        ),
      );
      expect(find.byKey(const Key('bulten-gun-tumu')), findsNothing);
    });
  });
}
