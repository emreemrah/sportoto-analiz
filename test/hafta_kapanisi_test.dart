// HAFTA KAPANIŞI EKRANI RENDER TESTLERİ.
//
// Ekranın saf mantığı week_test.dart'ta ölçülür; burada EKRANIN sözleşmesi
// sabitlenir:
//   * Rota METİN kimlikle gelir ('1600'); hafta başlığı ve KUPON yine bulunur
//     (2026-08-11 emülatör bulgusu: Haftalık Başarı'dan gelince ekran "—"
//     başlık ve "kupon yok" gösteriyordu — kupon deposu ile hafta gezme katı
//     `==` karşılaştırdığı için '1600' != 1600).
//   * SİSTEM sütunu KARNEDEN okunur (tekli ana tahmin) — satırlardaki çoklu
//     kupon önerisiyle karışmaz (tek ölçü kararı, 2026-08-11).
//   * Kupon yoksa kullanıcı karnesi UYDURULMAZ; sistemin ıskası yine anlatılır.
//
// Ağ, diğer ekran testlerindeki `api.tasiyici` dikişiyle sahtelenir; tanımsız
// uçlar 404 döner (kupon sunucu eşitlemesi sessizce geçer — gerçek davranış).

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/coupon/coupon_store.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/features/week/week_recap_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _SahteTasiyici implements HttpClientAdapter {
  Map<String, Object?> uclar = const {};

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final u = options.uri.toString();
    final eslesen = uclar.keys.where(u.contains).firstOrNull;
    if (eslesen == null) {
      return ResponseBody.fromString(
        '{"error":"yok"}',
        404,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }
    return ResponseBody.fromString(
      jsonEncode(uclar[eslesen]),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

final _tasiyici = _SahteTasiyici();

// ─────────────────────────────── Fikstürler ───────────────────────────────

Map<String, dynamic> _mac(
  int no,
  String home,
  String away, {
  String? result,
  Map<String, Object?>? score,
  String? sys,
}) => {
  'no': no,
  'home': {'name': home},
  'away': {'name': away},
  'result': ?result,
  'score': ?score,
  if (sys != null) 'prediction': {'symbol': sys},
};

final Map<String, Object?> kUclar = {
  '/api/rounds': {
    'currentRoundId': 1601,
    'rounds': [
      {'id': 1600, 'name': '53. Hafta', 'year': 2026},
      {'id': 1601, 'name': '1. Hafta', 'year': 2027},
    ],
  },
  // DİKKAT: buradaki `sys` değerleri BİLEREK YANLIŞ/GÜNCEL analizdir.
  // /api/history'nin `prediction` alanı sunucu cache'inden gelir ve canlı
  // analize düşebilir; ekran onu OKUMAMALI. Doğrusu mühürdedir (aşağıda).
  '/api/history/1600': {
    'matches': [
      _mac(
        1,
        'Randers',
        'Lyngby',
        result: '1',
        score: {'home': 2, 'away': 0},
        sys: '2', // güncel analiz: YANLIŞ — mühür '1' diyor
      ),
      _mac(
        2,
        'Oulu',
        'Helsinki',
        result: '2',
        score: {'home': 0, 'away': 1},
        sys: '2', // güncel analiz: sistem KAZANMIŞ gibi — mühür '1' diyor
      ),
      // Resmî sonuç VAR; mühürde de tahmin YOK → satır nötr kalır.
      _mac(
        3,
        'Arsenal',
        'Dortmund',
        result: '2',
        score: {'home': 2, 'away': 3},
        sys: '2',
      ),
    ],
  },
  // MÜHÜR — sistem seçiminin TEK kaynağı. 1 ve 2 için kayıt var, 3 için YOK.
  '/api/bulletins/1600/snapshot': {
    'id': 'snap-1600',
    'lockedAt': '2026-08-08T13:55:05.857Z',
    'late': false,
    'immutable': true,
    'verificationHash': '92ce471a288cdca177122865707f4386',
    'payload': {
      'matches': [
        {
          'no': 1,
          'systemPrediction': {'symbol': '1', 'display': '1'},
        },
        {
          'no': 2,
          'systemPrediction': {'symbol': '1', 'display': '1'},
        },
        {
          'no': 3,
          'systemPrediction': {'symbol': '-', 'display': '-'},
        },
      ],
    },
  },
  // Karne: SİSTEM sütununun TEK kaynağı. Satırlardaki 2/2 kupon isabetiyle
  // BİLEREK farklı sayı verir — ekran hangisini bastığı görünsün diye.
  '/api/system-scorecard': {
    'hasData': true,
    'weeks': [
      {
        'roundId': 1600,
        'round': '53. Hafta',
        'accuracy': 36,
        'status': 'partial',
        'correct': 5,
        'evaluated': 14,
        'missing': 1,
      },
    ],
  },
};

/// Kupon deposunda 1600. hafta için SAYI kimlikli dereceli kupon.
Map<String, Object?> _kuponKaydi() => {
  'schema': 2,
  'id': 'k1',
  'name': 'Kupon 1',
  'roundId': 1600, // SAYI — rotadan gelen '1600' METNİYLE eşleşmeli
  'couponNo': 1,
  'isRankedCoupon': true,
  'status': 'saved',
  'finalVersionId': 'v1',
  'versions': [
    {
      'id': 'v1',
      'versionNo': 1,
      'selections': [
        {'no': 1, 'selectedOutcomes': ['1']}, // doğru
        {'no': 2, 'selectedOutcomes': ['2']}, // doğru (sistem ıskaladı)
      ],
    },
  ],
};

Future<void> _tur(WidgetTester t, [int n = 25]) async {
  for (var i = 0; i < n; i++) {
    await t.pump(const Duration(milliseconds: 1));
  }
}

/// DİKİŞ TUZAĞI: `couponStoreYukle()` depoda kayıt YOKSA bellekteki listeyi
/// temizlemez (üretimde açılışta bir kez çağrıldığı için sorun değil; testte
/// önceki testin kuponu sızar). Kuponsuz senaryoda `yereliTemizle()` şart.
Future<void> _ekraniAc(
  WidgetTester t, {
  required Object? roundId,
  bool kuponVar = true,
  Map<String, Object?>? uclar,
}) async {
  SharedPreferences.setMockInitialValues({
    if (kuponVar) 'sportoto.couponCenter.v1': jsonEncode([_kuponKaydi()]),
  });
  await couponStoreYukle();
  if (!kuponVar) await yereliTemizle();
  _tasiyici.uclar = uclar ?? kUclar;
  api.tasiyici = _tasiyici;
  await t.pumpWidget(MaterialApp(home: WeekRecapScreen(roundId: roundId)));
  await _tur(t);
}

Finder _metin(String s) => find.text(s, findRichText: true);
Finder _metinIceren(String s) => find.textContaining(s, findRichText: true);

void main() {
  tearDown(() async {
    SharedPreferences.setMockInitialValues({});
    await couponStoreYukle();
  });

  group('Rota METİN kimlikle gelince', () {
    testWidgets('hafta başlığı ve sezon doğru yazılır ("—" kalmaz', (t) async {
      await _ekraniAc(t, roundId: '1600');

      expect(_metin('53. Hafta'), findsOneWidget);
      expect(_metin('2026 Sezonu'), findsOneWidget);
      expect(_metin('—'), findsNothing);
    });

    testWidgets('kupon BULUNUR — "kupon yok" yazmaz', (t) async {
      await _ekraniAc(t, roundId: '1600');

      expect(_metin('SEN · Kupon'), findsOneWidget);
      expect(_metin('2/2'), findsOneWidget); // iki seçim de tuttu
      expect(_metin('kupon yok'), findsNothing);
    });

    testWidgets('SAYI kimlikle açılışla aynı sonucu verir', (t) async {
      await _ekraniAc(t, roundId: 1600);

      expect(_metin('53. Hafta'), findsOneWidget);
      expect(_metin('2/2'), findsOneWidget);
    });
  });

  group('SİSTEM sütunu', () {
    testWidgets('KARNEDEN okunur; satırlardaki kupon isabeti değil', (t) async {
      await _ekraniAc(t, roundId: '1600');

      expect(_metin('SİSTEM · Ana tahmin'), findsOneWidget);
      expect(_metin('5/14'), findsOneWidget); // karne
      expect(_metin('%36 isabet'), findsOneWidget);
      // Kupon isabeti (2/2) SİSTEM sütununa yazılmaz: '2/2' yalnız SEN'de.
      expect(_metin('2/2'), findsOneWidget);
    });

    testWidgets('"önde" rozeti YOK — iki sütun aynı şeyi ölçmüyor', (t) async {
      // Kupon %100, karne %36: eski hâl kullanıcıyı "önde" ilan ediyordu.
      // Çoklu seçimli kupon ile tekli ana tahmin kıyaslanamaz; kıyas yalnız
      // adil karşılaştırma (h2h) kartında yapılır.
      await _ekraniAc(t, roundId: '1600');

      expect(_metin('▲ önde'), findsNothing);
    });

    testWidgets('karnede hafta yoksa sayı UYDURULMAZ', (t) async {
      await _ekraniAc(
        t,
        roundId: '1600',
        kuponVar: false,
        uclar: {
          ...kUclar,
          '/api/system-scorecard': {'hasData': true, 'weeks': <Object>[]},
        },
      );

      expect(_metin('karne kaydı yok'), findsOneWidget);
      expect(_metinIceren('% isabet'), findsNothing);
    });
  });

  testWidgets('kupon yoksa sistemin ıskası yine anlatılır', (t) async {
    await _ekraniAc(t, roundId: '1600', kuponVar: false);

    expect(_metin('kupon yok'), findsOneWidget);
    expect(_metin('Haftanın Anları'), findsOneWidget);
    expect(_metin('Sistem kuponu ıskaladı'), findsOneWidget);
  });

  // ————————————————————————————————————————————————————————————————
  // MÜHÜRLÜ SİSTEM — geçmişin sonradan değişmemesi (2026-08-11 kullanıcı
  // bulgusu: kupona alınan sistem seçimi 1-X'ti, ekranda 1-2 görünüyordu).
  // ————————————————————————————————————————————————————————————————
  group('Sistem seçimi', () {
    testWidgets('MÜHÜRDEN okunur; history\'deki güncel tahmin YOK SAYILIR', (
      t,
    ) async {
      await _ekraniAc(t, roundId: '1600', kuponVar: false);

      // Mühür 1. maç için '1' diyor, history '2'. Ekranda mühür kazanır.
      expect(_metinIceren('Sistem kuponu 1'), findsWidgets);
      // Güncel analizin '2'si hiçbir satırda sistem seçimi olarak çıkmaz:
      // 2. maçta history '2' (doğru) derken mühür '1' (yanlış) diyor →
      // sistem ISKALADI görünmeli, "bildi" değil.
      expect(_metin('Sistem kuponu bildi, sen bilemedin'), findsNothing);
      expect(_metin('Sistem kuponu ıskaladı'), findsOneWidget);
    });

    testWidgets('mühürde tahmin YOKSA maç sistem başarısına KATILMAZ', (
      t,
    ) async {
      await _ekraniAc(t, roundId: '1600', kuponVar: false);

      // 3. maçın mührü '-' → değerlendirilmez, uyarı görünür.
      expect(_metin('Sistem tahmin kaydı doğrulanamadı'), findsOneWidget);
      expect(_metinIceren('sistem başarısına KATILMADI'), findsOneWidget);
      expect(_metinIceren('No 3'), findsOneWidget);
    });

    testWidgets('MÜHÜR HİÇ YOKSA sistem hiçbir maçta iddia edilmez', (t) async {
      final uclarsiz = Map<String, Object?>.from(kUclar)
        ..remove('/api/bulletins/1600/snapshot');
      await _ekraniAc(t, roundId: '1600', kuponVar: false, uclar: uclarsiz);

      expect(_metin('Sistem tahmin kaydı doğrulanamadı'), findsOneWidget);
      expect(
        _metinIceren('arşivde kilitli sistem kaydı bulunamadı'),
        findsOneWidget,
      );
      // Sistem kazanmış gösterilmez.
      expect(_metin('Sistem kuponu bildi, sen bilemedin'), findsNothing);
      expect(_metinIceren('Sistem kuponu '), findsNothing);
    });

    testWidgets('GEÇ alınmış mühür kanıt sayılmaz', (t) async {
      final gec = Map<String, Object?>.from(kUclar);
      gec['/api/bulletins/1600/snapshot'] = {
        ...(kUclar['/api/bulletins/1600/snapshot']! as Map),
        'late': true, // ilk maç başladıktan SONRA mühürlenmiş
      };
      await _ekraniAc(t, roundId: '1600', kuponVar: false, uclar: gec);

      expect(_metin('Sistem tahmin kaydı doğrulanamadı'), findsOneWidget);
      expect(_metinIceren('ilk maç başladıktan SONRA'), findsOneWidget);
      expect(_metin('Sistem kuponu bildi, sen bilemedin'), findsNothing);
    });
  });
}
