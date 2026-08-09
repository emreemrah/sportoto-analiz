// KAYNAK: app/test/radar-veri-turetme.test.mjs — BİREBİR çeviri.
//
// RADAR EKRANI VERİ TÜRETME TESTLERİ.
//
// Bu mantık RadarScreen'in render gövdesine gömülüydü: filtre, sıralama,
// sayaç ve eğilim hesabı ancak ekranı çizerek sınanabiliyordu. Ayrıldı, artık
// doğrudan sınanıyor. Testlerin çoğu SINIR durumlarını kovalıyor — asıl
// hatalar orada: boş liste, eksik alan, eşitlik, sıfıra bölme.

import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/features/radar/radar_screen_data.dart';

Map<String, dynamic> mac(int no, Map? master) => {'no': no, 'master': master};

void main() {
  test('yüzde yuvarlaması toplamı HER ZAMAN 100 tutar', () {
    // 99 ya da 101 gören kullanıcı sayıya güvenmez.
    for (final p in [
      {'1': 44.4, 'X': 36.8, '2': 18.8},
      {'1': 33.3, 'X': 33.3, '2': 33.4},
      {'1': 0.4, 'X': 0.3, '2': 99.3},
      {'1': 50, 'X': 25, '2': 25},
    ]) {
      final r = roundPct100(p)!;
      expect(r['1']! + r['X']! + r['2']!, 100, reason: 'toplam 100 değil: $r');
    }
    expect(roundPct100(null), isNull);
  });

  test('yüzde yokken sıfır UYDURULMAZ', () {
    expect(roundPct100(null), isNull);
    expect(birOndalik(null), isNull);
    expect(num1('abc'), isNull);
    expect(num1(null), isNull);
    expect(wdl(null), isNull);
    expect(ord(null), '—');
  });

  test('bir ondalık gösterim küçük değişimi gizlemez', () {
    // Tam sayıya yuvarlansaydı ikisi de "19" görünürdü.
    expect(birOndalik({'1': 19.4, 'X': 40, '2': 40.6})!['1'], '19.4');
    expect(birOndalik({'1': 19.7, 'X': 40, '2': 40.3})!['1'], '19.7');
  });

  test(
    'sınıf sayaçları: bilinmeyen sınıf "karışık" sayılır (maç kaybolmaz)',
    () {
      final c = classCountsOf([
        mac(1, {'classification': 'strong_candidate'}),
        mac(2, {'classification': 'surprise_candidate'}),
        mac(3, {'classification': 'insufficient_data'}),
        mac(4, {'classification': 'medium_risk'}),
        mac(5, {'classification': 'bilinmeyen_yeni_sinif'}),
        mac(6, null), // master hiç yok
      ]);
      expect(c, (strong: 1, medium: 3, surprise: 1, insufficient: 1));
      // Toplam daima maç sayısına eşit — hiçbir maç sayımdan düşmez.
      expect(c.strong + c.medium + c.surprise + c.insufficient, 6);
      expect(classCountsOf([]), (
        strong: 0,
        medium: 0,
        surprise: 0,
        insufficient: 0,
      ));
      expect(classCountsOf(null), (
        strong: 0,
        medium: 0,
        surprise: 0,
        insufficient: 0,
      ));
    },
  );

  test('bilinmeyen filtre listeyi BOŞALTMAZ', () {
    final l = [
      mac(1, {'classification': 'strong_candidate'}),
      mac(2, {'classification': 'medium_risk'}),
    ];
    expect(filterMaster(l, 'all').length, 2);
    expect(filterMaster(l, 'boyle-bir-filtre-yok').length, 2);
    expect(filterMaster(l, 'strong').length, 1);
  });

  test('beraberlik riski filtresi eşiği 30 DAHİLDİR', () {
    final l = [
      mac(1, {
        'scores': {'draw': 29.9},
      }),
      mac(2, {
        'scores': {'draw': 30},
      }),
      mac(3, {'scores': <String, Object?>{}}), // alan yok → 0 sayılır, girmez
    ];
    expect(filterMaster(l, 'drawRisk').map((m) => m['no']), [2]);
  });

  test('deplasman sürprizi filtresi ÜÇ şartı birlikte arar', () {
    final tam = {
      'favorite': {'symbol': '1'},
      'favoriteFailureRisk': 60,
      'exactDirection': '2',
    };
    final l = [
      mac(1, tam),
      mac(2, {
        ...tam,
        'favorite': {'symbol': '2'},
      }), // favori ev değil
      mac(3, {...tam, 'favoriteFailureRisk': 54}), // risk eşiğin altında
      mac(4, {...tam, 'exactDirection': 'X'}), // yön deplasman değil
    ];
    expect(filterMaster(l, 'awaySurprise').map((m) => m['no']), [1]);
  });

  test('varsayılan sıralama Spor Toto sırasıdır (kupon doldurma sırası)', () {
    final l = [mac(3, {}), mac(1, {}), mac(2, {})];
    expect(sortMaster(l, 'order').map((m) => m['no']), [1, 2, 3]);
  });

  test(
    'risk sıralamasında risksiz maç sona düşer, eşitlikte no sırası korunur',
    () {
      final l = [
        mac(1, {'favoriteFailureRisk': 40}),
        mac(2, {}), // risk YOK
        mac(3, {'favoriteFailureRisk': 70}),
        mac(4, {'favoriteFailureRisk': 40}),
      ];
      expect(sortMaster(l, 'risk').map((m) => m['no']), [3, 1, 4, 2]);
    },
  );

  test('sıralama girdi dizisini DEĞİŞTİRMEZ', () {
    final l = [mac(3, {}), mac(1, {})];
    sortMaster(l, 'order');
    expect(l.map((m) => m['no']), [3, 1], reason: 'kaynak dizi bozulmamalı');
  });

  test('mühürlenme geri sayımı: geçmiş zaman için NEGATİF dakika yazılmaz', () {
    final t = DateTime.parse('2026-08-02T17:00:00Z');
    final meta = {'current': true, 'freezeAt': '2026-08-02T17:00:00Z'};
    expect(
      freezeMinutes(meta, t.subtract(const Duration(seconds: 90))),
      2, // 1,5 dk → yukarı yuvarlanır
    );
    expect(freezeMinutes(meta, t), isNull); // tam an → sayaç yok
    expect(
      freezeMinutes(meta, t.add(const Duration(seconds: 60))),
      isNull, // geçmiş → null
    );
    // Mühürlenmiş ya da güncel olmayan haftada geri sayım YOKTUR.
    final oncesi = t.subtract(const Duration(seconds: 90));
    expect(freezeMinutes({...meta, 'sealed': true}, oncesi), isNull);
    expect(freezeMinutes({...meta, 'frozenAt': 'x'}, oncesi), isNull);
    expect(freezeMinutes({...meta, 'current': false}, oncesi), isNull);
    expect(freezeMinutes(null, t), isNull);
  });

  test('legacy sayaç ve filtre', () {
    final r = [
      {'labelColor': 'red'},
      {'labelColor': 'green'},
      {'labelColor': 'red'},
      {'labelColor': 'mor'},
    ];
    expect(legacyCountsOf(r), (red: 2, yellow: 0, green: 1));
    expect(legacyFiltered(r, 'red').length, 2);
    expect(legacyFiltered(r, null).length, 4, reason: 'filtre yoksa tümü');
    expect(legacyFiltered(null, 'red').length, 0);
  });

  // DÖNEM GÜCÜ / EĞİLİM TESTLERİ KALDIRILDI (3 Ağustos 2026). Sınadıkları üç
  // fonksiyon (`radar5PeriodSuccess`, `radar5PeriodTrend`, `rowTrend`)
  // ekrandan "dönem başarısı" göstergesiyle birlikte silindi; bkz.
  // radar_screen_data.dart. Gösterge geri gelirse testleri de geri gelmeli —
  // bu satır o yüzden duruyor.

  // ───────────────────────────────────────────────────────────────────────
  // SEZON GEÇİŞİ HAZIRLIĞI — 53. haftadan sonra yeni sezon 1. haftayla
  // başlar. Ölçülen gerçek: sabit pencereler aktif sezona bağlı olduğu için
  // örneklem 51 haftadan 1'e düşüyor ve bir sıra "1 %100.0" gösteriyor.
  // ───────────────────────────────────────────────────────────────────────
  test('hafta seçici: TÜM haftalar güncel dahil, yeniden eskiye', () {
    final v = haftaSeciciVerisi(
      [
        {'roundId': 1521, 'round': '49. Hafta', 'year': 2026, 'sealed': true},
        {'roundId': 1527, 'round': '53. Hafta', 'year': 2026, 'current': true},
        {'roundId': 1525, 'round': '51. Hafta', 'year': 2026, 'locked': true},
      ],
      curId: 1527,
      selectedId: 1527,
    );
    expect(v.liste.map((w) => w.ad), ['53. Hafta', '51. Hafta', '49. Hafta']);
    expect(v.liste[0].guncel, isTrue);
    expect(v.haftaAdi, '53. Hafta');
    expect(v.haftaGuncelMi, isTrue);
    // Tek sezon → düz yazı; sezon adı yine üretilir.
    expect(v.sezonlar.length, 1);
    expect(v.sezonAdi, '2025/2026 Sezonu');
  });

  test('hafta seçici: SEZON GEÇİŞİNDE liste seçili sezona göre süzülür', () {
    final haftalar = [
      {'roundId': 1528, 'round': '1. Hafta', 'year': 2027, 'current': true},
      {'roundId': 1527, 'round': '53. Hafta', 'year': 2026, 'sealed': true},
      {'roundId': 1526, 'round': '52. Hafta', 'year': 2026, 'sealed': true},
    ];
    // Güncele bakılıyor → sezon onun sezonu, liste yalnız o sezon.
    final a = haftaSeciciVerisi(haftalar, curId: 1528, selectedId: 1528);
    expect(a.sezonlar.map((s) => s.ad), [
      '2026/2027 Sezonu',
      '2025/2026 Sezonu',
    ]);
    expect(a.seciliSezon, '2027');
    expect(a.liste.map((w) => w.ad), ['1. Hafta']);
    // Eski sezon seçilince liste ona döner.
    final b = haftaSeciciVerisi(
      haftalar,
      curId: 1528,
      selectedId: 1528,
      navSezon: '2026',
    );
    expect(b.liste.map((w) => w.ad), ['53. Hafta', '52. Hafta']);
    // Geçmiş haftaya bakılıyorsa sezon elle seçilmeden ona uyar.
    final c = haftaSeciciVerisi(haftalar, curId: 1528, selectedId: 1526);
    expect(c.seciliSezon, '2026');
    expect(c.haftaAdi, '52. Hafta');
    expect(c.haftaGuncelMi, isFalse);
  });

  test('hafta seçici: hafta yoksa liste boş (ekran çizmez)', () {
    expect(haftaSeciciVerisi([]).liste, isEmpty);
    expect(haftaSeciciVerisi(null).liste, isEmpty);
    expect(haftaSeciciVerisi(null).haftaAdi, isNull);
  });

  test('sezonAdiUzun: iki biçim de desteklenir, boş değer uydurmaz', () {
    expect(sezonAdiUzun(2026), '2025/2026 Sezonu');
    expect(sezonAdiUzun('2025/2026'), '2025/2026 Sezonu');
    expect(sezonAdiUzun(null), '');
    expect(sezonAdiUzun(''), '');
  });
}
