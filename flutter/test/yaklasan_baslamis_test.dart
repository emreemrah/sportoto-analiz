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
}
