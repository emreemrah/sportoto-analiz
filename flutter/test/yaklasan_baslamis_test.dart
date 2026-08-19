// "YAKLAŞAN MAÇLAR"A BAŞLAMIŞ MAÇ GİRMEZ.
//
// KULLANICI KARARI (16 Ağustos 2026): "yaklaşan karşılaşmalarda başlayan
// maçlar olmasın".
//
// Eskiden 150 dakikalık bir pay vardı: başlama saati geçmiş ama bitmemiş maç
// "oynuyor olabilir" gerekçesiyle 2,5 saat daha listede kalıyordu. Şeridin adı
// "Yaklaşan Maçlar" ve başlamış bir maç yaklaşan değildir; başlamış maçın yeri
// canlı/bülten akışıdır.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/utils.dart';
import 'package:masteranaliz/core/yaklasan_maclar.dart';

final _an = DateTime.parse('2026-08-21T20:00:00');

Map<String, dynamic> _mac(int no, String tarih, {String? durum}) => {
  'no': no,
  'date': tarih,
  'home': {'name': 'Ev $no'},
  'away': {'name': 'Dep $no'},
  'status': ?durum,
};

Map<String, dynamic> _hafta(List<Map<String, dynamic>> maclar) => {
  'roundId': 1529,
  'round': '2. Hafta',
  'matches': maclar,
};

void main() {
  saatDilimiTestleri();
  test('başlama saati GEÇMİŞ maç listeye girmez', () {
    final liste = yaklasanMaclar(
      _hafta([
        _mac(1, '2026-08-21T19:00:00'), // 1 saat önce başladı
        _mac(2, '2026-08-21T21:30:00'), // ileride
      ]),
      null,
      10,
      3,
      _an,
    );

    expect(liste.map((m) => m['no']), [2], reason: 'başlamış maç listede kaldı');
  });

  test('TAM ŞU AN başlayan maç da girmez', () {
    final liste = yaklasanMaclar(
      _hafta([_mac(1, '2026-08-21T20:00:00')]),
      null,
      10,
      3,
      _an,
    );
    expect(liste, isEmpty, reason: 'başlama anı gelmiş maç "yaklaşan" değildir');
  });

  test('bir dakika sonrası GİRER — sınır doğru yerde', () {
    final liste = yaklasanMaclar(
      _hafta([_mac(1, '2026-08-21T20:01:00')]),
      null,
      10,
      3,
      _an,
    );
    expect(liste.length, 1);
  });

  test('bitmiş maç zaten girmez (eski kural korundu)', () {
    final liste = yaklasanMaclar(
      _hafta([
        _mac(1, '2026-08-21T21:30:00', durum: 'finished'),
        _mac(2, '2026-08-21T22:00:00'),
      ]),
      null,
      10,
      3,
      _an,
    );
    expect(liste.map((m) => m['no']), [2]);
  });

  test('ÖNCEKİ haftanın başlamış maçları da girmez', () {
    final liste = yaklasanMaclar(
      _hafta([_mac(9, '2026-08-22T19:00:00')]),
      {
        'roundId': 1528,
        'round': '1. Hafta',
        'matches': [
          _mac(1, '2026-08-21T18:00:00'), // başlamış
          _mac(2, '2026-08-21T23:00:00'), // ileride
        ],
      },
      10,
      3,
      _an,
    );

    expect(
      liste.map((m) => m['no']).toList()..sort(),
      [2, 9],
      reason: 'önceki haftanın başlamış maçı da elenmeli',
    );
  });

  // NOTER KARARIYLA KAPANAN MAÇ (kullanıcı bulgusu, 19 Ağustos 2026):
  // 1. Hafta 15. maç kura '1' ile kesinleşti ama resmî uçta durumu 'upcoming',
  // tarihi ileride kaldı — ana sayfada "yaklaşan" diye durmaya devam etti.
  // Resmî sonucu olan maç (skor VEYA viaNotary) yaklaşan DEĞİLDİR.
  test('noter kararıyla kesinleşen ertelenmiş maç listeye GİRMEZ', () {
    final liste = yaklasanMaclar(
      _hafta([_mac(9, '2026-08-22T19:00:00')]),
      {
        'roundId': 1528,
        'round': '1. Hafta',
        'matches': [
          {
            ..._mac(15, '2026-08-27T21:30:00'), // ileride ama karar KESİN
            'result': '1',
            'viaNotary': true,
          },
        ],
      },
      10,
      3,
      _an,
    );

    expect(
      liste.map((m) => m['no']),
      [9],
      reason: 'sonucu noterle kesinleşmiş maç "yaklaşan" sayıldı',
    );
  });

  test('kararı HENÜZ verilmemiş ertelenen maç listede KALIR (davranış korunur)', () {
    final liste = yaklasanMaclar(
      _hafta([_mac(9, '2026-08-22T19:00:00')]),
      {
        'roundId': 1528,
        'round': '1. Hafta',
        'matches': [
          _mac(15, '2026-08-27T21:30:00'), // sonuç yok — gerçekten yaklaşan
        ],
      },
      10,
      3,
      _an,
    );

    expect(liste.map((m) => m['no']).toList()..sort(), [9, 15]);
  });
}

// ——— SAAT DİLİMİ BAĞIMSIZLIĞI (kullanıcı bildirdi, 16 Ağustos 2026) ———
//
// Kullanıcı "başlamış maçlar var" dedi. Ölçüm: emülatör GMT'de, gerçek saat
// 20:35 TSİ iken 19:00'da BAŞLAMIŞ maç listede duruyordu.
//
// Sebep: bülten saati saat dilimi EKSİZ Türkiye duvar saatidir
// ("2026-08-16T19:00:00"); `DateTime.parse` bunu CİHAZIN yerel saatinde
// yorumluyordu. Cihaz TSİ değilse karşılaştırma ofset kadar kayıyor ve
// başlamış maç "yaklaşan" sayılıyordu. Bu, aynı gün backend'de düzeltilen
// saat dilimi hatasının İSTEMCİ İKİZİYDİ.

void saatDilimiTestleri() {
  group('saat dilimi', () {
    test('duvar saati TÜRKİYE kabul edilir (cihaz saatine göre değil)', () {
      // 19:00 TSİ = 16:00 UTC.
      expect(macAni('2026-08-16T19:00:00')!.toUtc(),
          DateTime.parse('2026-08-16T16:00:00Z'));
    });

    test('saat dilimi EKLİ değere dokunulmaz', () {
      expect(macAni('2026-08-16T16:00:00Z')!.toUtc(),
          DateTime.parse('2026-08-16T16:00:00Z'));
    });

    test('GMT cihazda da başlamış maç "yaklaşan" SAYILMAZ', () {
      // Gerçek an: 20:35 TSİ = 17:35 UTC (emülatörde ölçülen durum).
      final simdi = DateTime.parse('2026-08-16T17:35:00Z');
      expect(macBasladi('2026-08-16T19:00:00', simdi: simdi), isTrue,
          reason: '19:00 TSİ maçı 20:35 TSİ itibarıyla BAŞLAMIŞTIR');
      expect(macBasladi('2026-08-16T21:30:00', simdi: simdi), isFalse,
          reason: '21:30 TSİ maçı henüz başlamamıştır');
    });

    test('çözülemeyen değer başlamış SAYILMAZ', () {
      expect(macAni(null), isNull);
      expect(macAni(''), isNull);
      expect(macBasladi('bilinmiyor'), isFalse);
    });
  });
}
