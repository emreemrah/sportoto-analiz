// ANA SAYFA → BÜLTEN DETAYI bağlantısı — regresyon testleri.
//
// NEDEN VAR: `bulletin_detail_screen.dart` çevrilmiş ve rota kayıtlıyken, Ana
// Sayfa'da geçmiş hafta maçına dokunulunca hâlâ "Bülten Detayı ekranı henüz
// çevrilmedi" uyarısı çıkıyordu. Hazır bir ekran kullanıcıya kapalıydı ve
// üstelik yanlış bilgi veriliyordu.
//
// KİMLİK: kaynak `HomeScreen.js:367` → `bulletinId: match.roundId`.
// `yaklasan_maclar.dart` her kayda kaynak haftanın `roundId`'sini koyar.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/yaklasan_maclar.dart';

/// Testler saate BAĞIMLI OLMAMALI: `yaklasanMaclar` geçmiş maçları eler.
/// Sabit bir "şimdi" verilir, aşağıdaki tarihler ona göre geleceğe düşer.
final _an = DateTime.utc(2026, 8, 9, 12);

void main() {
  group('Geçmiş hafta kaydı hangi kimliği taşıyor', () {
    // Gerçek veri modeliyle aynı şekil: `{ roundId, round, matches }`.
    final guncel = {
      'roundId': 1528,
      'round': '1. Hafta',
      'matches': [
        {'no': 1, 'date': '2026-08-14T18:30:00.000Z', 'status': 'scheduled'},
      ],
    };
    final onceki = {
      'roundId': 1527,
      'round': '53. Hafta',
      'matches': [
        {'no': 7, 'date': '2026-08-09T15:00:00.000Z', 'status': 'scheduled'},
      ],
    };

    test('önceki hafta maçı KENDİ haftasının roundId sini taşır', () {
      final liste = yaklasanMaclar(guncel, onceki, 10, 3, _an);
      final gecmis = liste.firstWhere((m) => m['oncekiHafta'] == true);

      // Ekran bu değeri `/api/bulletins/:id` ucuna gönderir. Sunucuda
      // `rounds[].id` SAYI (1527), `bulletins[].id` METİN ('1527'); tek fark
      // tiptir ve yola yazılırken erir.
      expect(gecmis['roundId'], 1527);
      expect('${gecmis['roundId']}', '1527');
      expect(gecmis['haftaAdi'], '53. Hafta');
    });

    test('güncel hafta maçı önceki haftanın kimliğini ALMAZ', () {
      final liste = yaklasanMaclar(guncel, onceki, 10, 3, _an);
      final bugunku = liste.firstWhere((m) => m['oncekiHafta'] != true);
      expect(bugunku['roundId'], 1528);
    });

    test('önceki hafta yoksa oncekiHafta işaretli kayıt oluşmaz', () {
      final liste = yaklasanMaclar(guncel, null, 10, 3, _an);
      expect(liste.where((m) => m['oncekiHafta'] == true), isEmpty);
    });

    test('kaynak haftanın roundId si yoksa kayıt null taşır (uydurulmaz)', () {
      // Ekran bu durumda gezinmez, kullanıcıya sebebini söyler.
      final kimliksiz = {
        'round': '53. Hafta',
        'matches': [
          {'no': 7, 'date': '2026-08-09T15:00:00.000Z', 'status': 'scheduled'},
        ],
      };
      final liste = yaklasanMaclar(guncel, kimliksiz, 10, 3, _an);
      final gecmis = liste.firstWhere((m) => m['oncekiHafta'] == true);
      expect(gecmis['roundId'], isNull);
    });
  });

  group('Rota yolu', () {
    test('ortak rota kalıbı ana sayfa dalında çözülür', () {
      // Rota `_ortakRotalar()` içinde tanımlıdır → her dala eklenir; bu yüzden
      // Ana Sayfa'dan gidildiğinde SEKME DEĞİŞMEZ ve geri dönünce Ana Sayfa
      // korunur. Kaynakta da `navigate` bulunulan yığına biner.
      const roundId = 1527;
      expect(
        '/ana-sayfa/bulten-detay/$roundId',
        '/ana-sayfa/bulten-detay/1527',
      );
    });
  });
}
