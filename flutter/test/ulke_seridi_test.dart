// KAYNAK: app/test/ulke-seridi.test.mjs — BİREBİR çeviri.
//
// Ülke şeridi mantığı — saf modül testleri. Asıl koruduğu kural:
// TANINMAYAN LİG ADI İÇİN ÜLKE UYDURULMAZ.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/ulke_seridi.dart';

void main() {
  test('lig adından ülke çıkarılır ve Türkçeleşir', () {
    final dk = ulkeAyikla('Denmark Superliga')!;
    expect(dk.name, 'Danimarka');
    expect(dk.en, 'Denmark');

    final se = ulkeAyikla('Sweden Allsvenskan')!;
    expect(se.name, 'İsveç');
    expect(se.en, 'Sweden');

    final pl = ulkeAyikla('Poland Ekstraklasa')!;
    expect(pl.name, 'Polonya');
    expect(pl.en, 'Poland');
  });

  test('iki kelimelik ülke adı tanınır', () {
    expect(ulkeAyikla('Czech Republic Fortuna Liga')!.name, 'Çekya');
  });

  test('Kulüp Maçları etiketi "Kulüp" olur, ülke uydurulmaz', () {
    final u = ulkeAyikla(kKulupEtiketi)!;
    expect(u.name, 'Kulüp');
    expect(u.en, isNull);
  });

  test('tanınmayan lig adı AYNEN kalır (çeviri uydurulmaz)', () {
    final u = ulkeAyikla('Mars Premier League')!;
    expect(u.name, 'Mars Premier League');
    expect(u.en, isNull);
  });

  test('boş/eksik lig → null', () {
    expect(ulkeAyikla(''), isNull);
    expect(ulkeAyikla(null), isNull);
  });

  test('gerçek geçmiş uç verisi ülke içermez → ülke uydurulmaz', () {
    // /api/history/:roundId gerçekten "2026/2027 Sezonu" gibi lig adı
    // döndürüyor (9 Ağustos 2026'da doğrulandı). Ülke çıkarılamaz; ad aynen
    // kalmalı ve çağıran `gizleTanimsiz` ile satırı hiç çizmemeli.
    final u = ulkeAyikla('2026/2027 Sezonu')!;
    expect(u.name, '2026/2027 Sezonu');
    expect(u.en, isNull);
  });

  test('ulkeListesi: tekil, ilk görülme sırası, bayrak kodu, maç sayısı', () {
    final matches = [
      {'league': 'Denmark Superliga'},
      {'league': 'Denmark Superliga'},
      {'league': kKulupEtiketi},
      {'league': 'Finland Veikkausliiga'},
      {'league': 'Sweden Allsvenskan'},
      {'league': 'Norway Eliteserien'},
      {'league': 'Poland Ekstraklasa'},
      {'league': null},
    ];
    final u = ulkeListesi(matches);

    expect(u.map((x) => x.name).toList(), [
      'Danimarka',
      'Kulüp',
      'Finlandiya',
      'İsveç',
      'Norveç',
      'Polonya',
    ]);
    expect(u[0].code, 'dk');
    expect(u[1].code, ''); // Kulüp: bayrak yok → nötr simge
    expect(u[3].code, 'se');
    // Maç sayıları: null lig sayılmaz, aynı ülkenin maçları toplanır.
    expect(u.map((x) => x.count).toList(), [2, 1, 1, 1, 1, 1]);
  });
}
