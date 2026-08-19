// ERTELENMİŞ MAÇ ETİKETİ — ÇIKARIM, AMA ÖLÇÜLMÜŞ ÇIKARIM.
//
// KULLANICI BİLDİRDİ (16 Ağustos 2026): 1. Haftanın 15. maçı (Celta Vigo –
// Osasuna) ertelendi, noter karar verecek. Kart yalnız "Başlamadı" diyordu.
//
// NEDEN ÇIKARIM: resmî Spor Toto ucu bu maçı hâlâ `status: "upcoming"` veriyor
// — "ertelendi" diye bir alan YOK. Erteleme yalnız tarihin bültenin geri
// kalanından kopmasıyla belli oluyor.
//
// EŞİK GERÇEK VERİYLE KALİBRE EDİLDİ (1. Hafta, `/api/history/1528`):
//   normal maçlar ilk maçtan 0,0 · 0,9 · 1,0 · 1,8 · 1,9 · 2,0 · 3,0 gün sonra
//   ertelenen maç          13,0 gün sonra
// 7 gün ikisinin ortasında güvenle durur.
//
// Bu testler iki yönü birden tutar: gerçek erteleme YAKALANMALI, normal hafta
// YANLIŞ ETİKETLENMEMELİ. İkincisi daha önemli — yanlış "Ertelendi" etiketi,
// olmayan bir bilgiyi iddia etmek olur.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/bulletin/history_match_card.dart';
import 'package:masteranaliz/features/bulletin/bulletin_format.dart';

Map<String, dynamic> _m(int no, String tarih) => {'no': no, 'date': tarih};

/// 1. Haftanın GERÇEK tarihleri (üretimden alındı).
final _gercekHafta = <Map<String, dynamic>>[
  _m(1, '2026-08-14T21:30:00'),
  _m(2, '2026-08-15T19:00:00'),
  _m(3, '2026-08-15T19:00:00'),
  _m(4, '2026-08-15T21:30:00'),
  _m(5, '2026-08-15T21:30:00'),
  _m(6, '2026-08-16T19:00:00'),
  _m(7, '2026-08-16T21:30:00'),
  _m(8, '2026-08-16T21:30:00'),
  _m(9, '2026-08-17T21:30:00'),
  _m(10, '2026-08-16T16:00:00'),
  _m(11, '2026-08-16T21:45:00'),
  _m(12, '2026-08-15T21:30:00'),
  _m(13, '2026-08-16T17:00:00'),
  _m(14, '2026-08-16T19:00:00'),
  _m(15, '2026-08-27T21:30:00'), // ERTELENEN
];

void main() {
  kartTestleri();
  test('gerçek ertelenen maç (15) yakalanır', () {
    expect(ertelendiMi(_gercekHafta[14], _gercekHafta), isTrue);
  });

  test('aynı haftanın DİĞER 14 maçı ertelenmiş SAYILMAZ', () {
    for (var i = 0; i < 14; i++) {
      expect(
        ertelendiMi(_gercekHafta[i], _gercekHafta),
        isFalse,
        reason: '${_gercekHafta[i]['no']}. maç yanlışlıkla "Ertelendi" '
            'etiketlendi — olmayan bilgi iddia edilmiş olur',
      );
    }
  });

  test('BİRDEN FAZLA erteleme de yakalanır (ilk maça göre bakılır)', () {
    // Birbirlerine göre bakılsaydı ikisi de "normal" görünürdü.
    final hafta = [
      _m(1, '2026-08-14T21:30:00'),
      _m(2, '2026-08-15T19:00:00'),
      _m(14, '2026-08-27T21:30:00'),
      _m(15, '2026-08-27T21:30:00'),
    ];
    expect(ertelendiMi(hafta[2], hafta), isTrue);
    expect(ertelendiMi(hafta[3], hafta), isTrue);
    expect(ertelendiMi(hafta[0], hafta), isFalse);
  });

  test('eşik sınırı: 6 gün ertelenmiş SAYILMAZ, 7 gün SAYILIR', () {
    final hafta = [
      _m(1, '2026-08-14T20:00:00'),
      _m(2, '2026-08-20T20:00:00'), // 6 gün
      _m(3, '2026-08-21T20:00:00'), // 7 gün
    ];
    expect(ertelendiMi(hafta[1], hafta), isFalse);
    expect(ertelendiMi(hafta[2], hafta), isTrue);
    expect(kErtelemeEsigiGun, 7);
  });

  test('tarihsiz / bozuk veri ertelenmiş SAYILMAZ — uydurma yok', () {
    expect(ertelendiMi({'no': 1}, _gercekHafta), isFalse);
    expect(ertelendiMi({'no': 1, 'date': 'bilinmiyor'}, _gercekHafta), isFalse);
    expect(ertelendiMi(_gercekHafta[14], null), isFalse);
    expect(ertelendiMi(_gercekHafta[14], const []), isFalse);
    expect(ertelendiMi(null, _gercekHafta), isFalse);
  });

  test('saat dilimi bağımsız — duvar saati Türkiye kabul edilir', () {
    // 14 Ağu 21:30 TSİ ile 27 Ağu 21:30 TSİ arası tam 13 gün.
    expect(ertelendiMi(_gercekHafta[14], _gercekHafta), isTrue);
  });

  // HAFTA DURUMU SEBEBİ SÖYLER (19 Ağustos 2026 — kullanıcı tıkanması:
  // "hafta neden hâlâ kesinleşmedi" sorusu ekranda cevapsızdı). Bülten alt
  // başlığı ile Haftalık Başarı durum satırı bu iki yardımcıdan beslenir.
  group('bekleyenErtelenenNolar + ertelemeDurumEki', () {
    bool cozuldu(Map? m) =>
        m?['result'] != null &&
        (m?['score'] != null || m?['viaNotary'] == true);

    test('sonuçsuz + ertelenmiş maç bekleten sebep olarak listelenir', () {
      final hafta = [
        for (final m in _gercekHafta)
          if (m['no'] == 15)
            m // 15. maç sonuçsuz — bekleten sebep
          else
            {
              ...m,
              'result': '1',
              'score': {'home': 1, 'away': 0},
            },
      ];
      expect(bekleyenErtelenenNolar(hafta, cozuldu), [15]);
      expect(
        ertelemeDurumEki([15]),
        ' · 15. maç ertelendi — noter kararı bekleniyor',
      );
    });

    test('noter kararı girilmiş maç bir daha "bekliyor" görünmez', () {
      final hafta = [
        for (final m in _gercekHafta)
          if (m['no'] == 15)
            {...m, 'result': 'X', 'viaNotary': true} // skor YOK, karar VAR
          else
            {
              ...m,
              'result': '1',
              'score': {'home': 1, 'away': 0},
            },
      ];
      expect(bekleyenErtelenenNolar(hafta, cozuldu), isEmpty);
      expect(ertelemeDurumEki(const []), '');
    });

    test('ertelenmemiş sonuçsuz maç bu listeye GİRMEZ (etiket uydurulmaz)', () {
      // 3. maç sonuçsuz ama tarihi normal — "ertelendi" damgası vurulmaz;
      // hafta durumu ondan bahsetmez (yalnız n/15 sayısı düşük kalır).
      final hafta = [
        for (final m in _gercekHafta)
          if (m['no'] == 3 || m['no'] == 15)
            m
          else
            {
              ...m,
              'result': '1',
              'score': {'home': 1, 'away': 0},
            },
      ];
      expect(bekleyenErtelenenNolar(hafta, cozuldu), [15]);
    });

    test('birden fazla erteleme sayıyla anlatılır', () {
      expect(
        ertelemeDurumEki([3, 15]),
        ' · 2 maç ertelendi — noter kararı bekleniyor',
      );
    });
  });
}

// ——— KART GERÇEKTEN "Ertelendi" YAZIYOR MU ———
//
// Ekran görüntüsü yerine kartı doğrudan çizip okuyoruz: deterministik ve
// gezinme kazalarına bağımlı değil.
//
// KART TARİHLERİ GÖRELİDİR — SABİT TARİH TESTİ ÇÜRÜTÜR. Yukarıdaki
// `ertelendiMi` testleri saf mantıktır ve sabit tarihle doğrudur; ama kart
// etiketi ŞU ANA göre hesaplanır (`deriveStatus` → `macAni(tarih)` şimdiyle
// karşılaştırılır). 17 Ağustos 2026'da "Başlamadı" testi tam bu yüzden
// kırıldı: fikstür `2026-08-16T21:45:00` yazılıydı, o saat geçince maç
// başlamış sayıldı ve kart "Sonuç bekleniyor" dedi. Ürün doğru davrandı,
// çürüyen fikstürdü.

/// Türkiye duvar saatiyle N gün sonrası (`macAni` bunu TSİ kabul eder).
String _ileriDuvarSaati(int gun, [int saat = 21, int dakika = 30]) {
  final n = DateTime.now().add(Duration(days: gun));
  final d = DateTime(n.year, n.month, n.day, saat, dakika);
  return d.toIso8601String().split('.').first;
}

void kartTestleri() {
  testWidgets('ertelenen maç kartı "Ertelendi" yazar', (t) async {
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HistoryMatchCard(
            item: {
              'no': 15,
              'date': _ileriDuvarSaati(10),
              'home': {'name': 'Celta Vigo'},
              'away': {'name': 'Osasuna'},
              'league': 'Spain La Liga',
            },
            ertelendi: true,
          ),
        ),
      ),
    );
    await t.pump();

    expect(find.text('Ertelendi'), findsOneWidget);
    expect(find.text('Başlamadı'), findsNothing);
  });

  testWidgets('normal başlamamış maç "Başlamadı" yazar', (t) async {
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HistoryMatchCard(
            item: {
              'no': 11,
              'date': _ileriDuvarSaati(2, 21, 45),
              'home': {'name': 'Lens'},
              'away': {'name': 'Paris St Germain'},
              'league': 'France Ligue 1',
            },
          ),
        ),
      ),
    );
    await t.pump();

    expect(find.text('Başlamadı'), findsOneWidget);
    expect(
      find.text('Ertelendi'),
      findsNothing,
      reason: 'normal maça "Ertelendi" yazmak, olmayan bilgi iddia etmektir',
    );
  });
}
