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
      'engine': {'version': 'master-analysis-1.0.0'},
      'matches': [
        {
          'no': 1,
          'matchId': 'mac-1',
          'systemPrediction': {'symbol': '1', 'display': '1'},
        },
        {
          'no': 2,
          'matchId': 'mac-2',
          'systemPrediction': {'symbol': '1', 'display': '1'},
        },
        {
          'no': 3,
          'matchId': 'mac-3',
          'systemPrediction': {'symbol': '-', 'display': '-'},
        },
      ],
    },
  },
  // Karne: SİSTEM sütununun TEK kaynağı. Satırlardaki 2/2 kupon isabetiyle
  // BİLEREK farklı sayı verir — ekran hangisini bastığı görünsün diye.
  // GÖZLEM SERİSİ — sunucunun zaman damgalı kaydı. 2. maçta sistem tahmini
  // ÖNCE '2' iken SONRA '1' olmuş; kullanıcı '2'yi kuponuna almış.
  '/api/bulletins/1600/observations': {
    'bulletinId': '1600',
    'count': 3,
    'observations': [
      {
        'observedAt': '2026-08-05T16:19:22.774+00:00',
        'odds': {'home': 2.33, 'draw': 3.15, 'away': 3.06},
        'statsSummary': {
          'prediction': '2',
          'probabilities': {'1': 30, 'X': 30, '2': 40},
        },
      },
      // Tahminsiz gözlem (veri gelmemiş an) DEĞİŞİKLİK SAYILMAMALI.
      {'observedAt': '2026-08-06T10:00:00.000+00:00', 'statsSummary': {}},
      {
        'observedAt': '2026-08-07T05:21:20.482+00:00',
        'odds': {'home': 2.12, 'draw': 3.08, 'away': 2.62},
        'statsSummary': {
          'prediction': '1',
          'probabilities': {'1': 45, 'X': 28, '2': 27},
        },
      },
    ],
  },
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
  'createdAt': '2026-08-05T20:53:23.620Z',
  'finalVersionId': 'v1',
  'versions': [
    {
      'id': 'v1',
      'versionNo': 1,
      'createdAt': '2026-08-05T20:53:23.620Z',
      'selections': [
        {
          'no': 1,
          'selectedOutcomes': ['1'],
        }, // doğru
        {
          'no': 2,
          'selectedOutcomes': ['2'],
        }, // doğru (sistem ıskaladı)
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
  Map<String, Object?>? kupon,
}) async {
  // Ekran tembel listedir; VS + karne satırı + uyarı kartı eklendikten sonra
  // karar izi kartları 800x600 görünümün ALTINDA kalıyor ve dokunulamıyor.
  t.view.physicalSize = const Size(1200, 3000);
  t.view.devicePixelRatio = 1.0;
  addTearDown(() {
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });
  SharedPreferences.setMockInitialValues({
    if (kuponVar)
      'sportoto.couponCenter.v1': jsonEncode([kupon ?? _kuponKaydi()]),
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
      // NOT: ekranın tamamında '—' aramak artık YANLIŞ ölçüm — mühürsüz maç
      // tabloda meşru olarak '—' basar (No 3). Başlığın çözüldüğü, yukarıdaki
      // iki satırla zaten kanıtlanıyor; boş sezon ' Sezonu' diye görünürdü.
      expect(_metin(' Sezonu'), findsNothing);
    });

    testWidgets('kupon BULUNUR — "kupon yok" yazmaz', (t) async {
      await _ekraniAc(t, roundId: '1600');

      expect(_metin('KUPON 1'), findsOneWidget); // "Sen" değil, kuponun ADI
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

      // VS alanı AYNI ÖLÇÜ: iki taraf da ORTAK maçlar üzerinden (2026-08-11).
      expect(_metin('KUPON 1'), findsOneWidget);
      expect(_metin('SİSTEM · MÜHÜRLÜ SEÇİM'), findsOneWidget);
      expect(_metin('2/2'), findsOneWidget); // sen: 2 ortak maçta 2 isabet
      expect(_metin('1/2'), findsOneWidget); // sistem mühürlü kupon: 1
      // Tekli ana tahmin VS'ten ÇIKTI, kendi satırında duruyor.
      expect(_metin('Sistem ana tahmini · eşleşen maç'), findsOneWidget);
      expect(_metin('5/14 · %36'), findsOneWidget);
      expect(_metinIceren('ortak maç'), findsWidgets);
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

    // Kupon yoksa ortak maç da yoktur; VS alanı bunu açıkça yazar.
    expect(_metin('ortak maç yok'), findsWidgets);
    expect(_metin('Öne Çıkan Sonuçlar'), findsOneWidget);
    expect(_metin('Sistem seçimi resmî sonuçla eşleşmedi'), findsOneWidget);
    // SUÇLAYICI DİL YOK (2026-08-11 dil standardı).
    for (final yasak in [
      'bilemedin',
      'bildin',
      'İkiniz',
      'ıskaladı',
      'yaktın',
      '💥',
      '🔥',
      '🤖',
    ]) {
      expect(_metinIceren(yasak), findsNothing, reason: yasak);
    }
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
      expect(_metinIceren('Sistem seçimi: 1'), findsWidgets);
      // Güncel analizin '2'si hiçbir satırda sistem seçimi olarak çıkmaz:
      // 2. maçta history '2' (doğru) derken mühür '1' (yanlış) diyor →
      // sistem ISKALADI görünmeli, "bildi" değil.
      expect(_metinIceren('bilemedin'), findsNothing);
      expect(_metin('Sistem seçimi resmî sonuçla eşleşmedi'), findsOneWidget);
    });

    testWidgets('mühürde tahmin YOKSA maç sistem başarısına KATILMAZ', (
      t,
    ) async {
      await _ekraniAc(t, roundId: '1600', kuponVar: false);

      // 3. maçın mührü '-' → değerlendirilmez, uyarı görünür.
      expect(_metin('Sistem tahmin kaydı doğrulanamadı'), findsOneWidget);
      expect(_metinIceren('karşılaştırmaya katılmadı'), findsOneWidget);
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
      expect(_metinIceren('bilemedin'), findsNothing);
      expect(_metinIceren('Sistem seçimi'), findsNothing);
    });

    testWidgets('kupon mühürden farklıysa KARAR İZİ alanı açılır', (t) async {
      await _ekraniAc(t, roundId: '1600');

      // 2. maç: kuponda '2', mühürde '1' → aday. Karar izi değişimi
      // DOĞRULADIĞI için başlık kesin konuşur (2026-08-11 kullanıcı isteği).
      expect(_metin('Sistem Tahmini Değişiklikleri'), findsOneWidget);
      expect(_metin('Sistem Tahmini Değişmiş Olabilir'), findsNothing);
      expect(_metin('#2 · Sistem tahmini neden değişti?'), findsOneWidget);

      await t.tap(_metin('#2 · Sistem tahmini neden değişti?'));
      await _tur(t, 40);

      // Gözlem serisinden OKUNAN gerçek değişim.
      expect(_metinIceren('2 → 1'), findsOneWidget);
      expect(
        _metinIceren('olasılık 1/X/2: %30/%30/%40 → %45/%28/%27'),
        findsOneWidget,
      );
      expect(
        _metinIceren('oran ev/ber/dep: 2.33/3.15/3.06 → 2.12/3.08/2.62'),
        findsOneWidget,
      );
      // Kaynak kimliği: hangi mühür, hangi analiz sürümü + gözlem penceresi.
      expect(
        _metinIceren('snap-1600 · master-analysis-1.0.0 · #92ce471a28'),
        findsOneWidget,
      );
      expect(_metinIceren('Gözlem penceresi'), findsOneWidget);
      // Tutulmayan veri açıkça söylenir.
      expect(
        _metinIceren('Kriter bazlı öncesi/sonrası kayıtta tutulmuyor'),
        findsOneWidget,
      );
    });

    testWidgets('gözlem kaydı YOKSA sebep UYDURULMAZ', (t) async {
      final kayitsiz = Map<String, Object?>.from(kUclar)
        ..remove('/api/bulletins/1600/observations');
      await _ekraniAc(t, roundId: '1600', uclar: kayitsiz);

      // Kanıt yoksa başlık KESİN konuşmaz.
      expect(_metin('Sistem Tahmini Değişmiş Olabilir'), findsOneWidget);
      await t.tap(_metin('#2 · Sistem tahmini neden değişti?'));
      await _tur(t, 40);

      expect(
        _metin('Değişiklik nedeni geçmiş kayıtlardan doğrulanamadı.'),
        findsOneWidget,
      );
    });

    testWidgets('kayıt VAR ama değişim yoksa "değişmemiş" der', (t) async {
      final sabit = Map<String, Object?>.from(kUclar);
      sabit['/api/bulletins/1600/observations'] = {
        'observations': [
          {
            'observedAt': '2026-08-05T16:19:22.774+00:00',
            'statsSummary': {'prediction': '1'},
          },
          {
            'observedAt': '2026-08-07T05:21:20.482+00:00',
            'statsSummary': {'prediction': '1'},
          },
        ],
      };
      await _ekraniAc(t, roundId: '1600', uclar: sabit);

      await t.tap(_metin('#2 · Sistem tahmini neden değişti?'));
      await _tur(t, 40);

      expect(_metinIceren('sistem tahmini değişmemiş'), findsOneWidget);
      expect(_metinIceren('fark kupon seçiminden geliyor'), findsOneWidget);
    });

    // 53. HAFTA 15. MAÇ SENARYOSU (gerçek olayın birebir kurgusu):
    // kullanıcı kuponunu açtığında sistem de 1-X diyordu; sistem kilide dek
    // 1-2'ye döndü, sonuç 2 geldi. "Sistem kuponu bildi, sen bilemedin"
    // demek bu durumda yanıltıcıdır.
    testWidgets('kupondan SONRA değişen sistem tahmini "Öne Çıkan Sonuçlar" '
        'bölümünde sistem başarısı olarak GÖSTERİLMEZ', (t) async {
      final uclar = <String, Object?>{
        ...kUclar,
        '/api/history/1600': {
          'matches': [
            _mac(
              4,
              'Jagiellonia',
              'Widzew',
              result: '2',
              score: {'home': 0, 'away': 2},
              sys: '12',
            ),
          ],
        },
        '/api/bulletins/1600/snapshot': {
          'id': 'snap-1600',
          'lockedAt': '2026-08-08T13:55:05.857Z',
          'late': false,
          'payload': {
            'matches': [
              {
                'no': 4,
                'matchId': 'mac-4',
                'systemPrediction': {'symbol': '12', 'display': '12'},
              },
            ],
          },
        },
      };
      // SIRA: özel uç önce (genel anahtar bu URL'nin de içinde geçiyor).
      final sirali = <String, Object?>{
        '/api/bulletins/1600/observations?matchId=mac-4': {
          'observations': [
            {
              'observedAt': '2026-08-03T17:15:12.156+00:00',
              'statsSummary': {
                'prediction': '10',
                'probabilities': {'1': 40, 'X': 30, '2': 30},
              },
            },
            {
              'observedAt': '2026-08-07T05:21:20.482+00:00',
              'statsSummary': {
                'prediction': '12',
                'probabilities': {'1': 40, 'X': 28, '2': 32},
              },
            },
          ],
        },
        ...uclar,
      };
      final kupon = <String, Object?>{
        ..._kuponKaydi(),
        'versions': [
          {
            'id': 'v1',
            'versionNo': 1,
            'createdAt': '2026-08-05T20:53:23.620Z',
            'selections': [
              {
                'no': 4,
                'selectedOutcomes': ['1', 'X'],
              },
            ],
          },
        ],
      };

      await _ekraniAc(t, roundId: '1600', uclar: sirali, kupon: kupon);

      // Kupon 5 Ağu'da açıldığında sistem de 1-X diyordu; mühür 1-2.
      // Bu maç ÖNE ÇIKAN SONUÇLAR'da hiç görünmez (yanıltıcı kıyas olurdu).
      expect(_metin('Öne Çıkan Sonuçlar'), findsNothing);
      expect(_metinIceren('eşleşmedi'), findsNothing);
      expect(_metinIceren('bilemedin'), findsNothing);
      // Yalnız değişiklik bölümünde, tarafsız biçimde yer alır.
      expect(_metin('Sistem Tahmini Değişiklikleri'), findsOneWidget);
      expect(_metin('#4 · Sistem tahmini neden değişti?'), findsOneWidget);
    });

    testWidgets('sonuç hiçbir seçimde yoksa kart bunu DOĞRUDAN söyler', (
      t,
    ) async {
      // Korona–Legia örneği: resmî sonuç X, kupon 1-2, sistem 1-2.
      final uclar = <String, Object?>{
        ...kUclar,
        '/api/history/1600': {
          'matches': [
            _mac(
              7,
              'Korona',
              'Legia',
              result: 'X',
              score: {'home': 1, 'away': 1},
              sys: '1',
            ),
          ],
        },
        '/api/bulletins/1600/snapshot': {
          'id': 'snap-1600',
          'lockedAt': '2026-08-08T13:55:05.857Z',
          'late': false,
          'payload': {
            'matches': [
              {
                'no': 7,
                'matchId': 'mac-7',
                'systemPrediction': {'symbol': '12', 'display': '12'},
              },
            ],
          },
        },
      };
      final kupon = <String, Object?>{
        ..._kuponKaydi(),
        'versions': [
          {
            'id': 'v1',
            'versionNo': 1,
            'createdAt': '2026-08-05T20:53:23.620Z',
            'selections': [
              {
                'no': 7,
                'selectedOutcomes': ['1', '2'],
              },
            ],
          },
        ],
      };

      await _ekraniAc(t, roundId: '1600', uclar: uclar, kupon: kupon);

      expect(_metin('Kuponlarda X seçeneği bulunmuyordu'), findsOneWidget);
      expect(_metinIceren('Resmî sonuç: X'), findsOneWidget);
      expect(_metinIceren('Kupon seçimi: 1-2'), findsOneWidget);
      expect(_metinIceren('Sistem seçimi: 1-2'), findsOneWidget);
      // Suçlayıcı dil ve emoji YOK.
      for (final yasak in ['bilemedin', 'İkiniz', '💥', '🔥', '🤖']) {
        expect(_metinIceren(yasak), findsNothing, reason: yasak);
      }
    });

    testWidgets('seçim sistemden AKTARILDIYSA başlık bunu söyler; damga '
        'yoksa varsayılmaz', (t) async {
      final uclar = <String, Object?>{
        ...kUclar,
        '/api/history/1600': {
          'matches': [
            _mac(
              8,
              'Ham Kam',
              'Aalesunds',
              result: '2',
              score: {'home': 0, 'away': 1},
              sys: '1',
            ),
          ],
        },
        '/api/bulletins/1600/snapshot': {
          'id': 'snap-1600',
          'lockedAt': '2026-08-08T13:55:05.857Z',
          'late': false,
          'payload': {
            'matches': [
              {
                'no': 8,
                'matchId': 'mac-8',
                'systemPrediction': {'symbol': '1', 'display': '1'},
              },
            ],
          },
        },
      };
      Map<String, Object?> kuponYap({required bool damga}) => {
        ..._kuponKaydi(),
        'versions': [
          {
            'id': 'v1',
            'versionNo': 1,
            'createdAt': '2026-08-05T20:53:23.620Z',
            'selections': [
              {
                'no': 8,
                'selectedOutcomes': ['1'],
              },
            ],
            if (damga)
              'aktarimlar': {
                '8': {
                  'secim': '1',
                  'zaman': '2026-08-05T20:53:23.620Z',
                  'kaynak': 'system',
                },
              },
          },
        ],
      };

      await _ekraniAc(
        t,
        roundId: '1600',
        uclar: uclar,
        kupon: kuponYap(damga: true),
      );
      expect(
        _metin('Sistemden aktarılan seçim resmî sonuçla eşleşmedi'),
        findsOneWidget,
      );

      // Damga YOKSA aktarım VARSAYILMAZ.
      await _ekraniAc(
        t,
        roundId: '1600',
        uclar: uclar,
        kupon: kuponYap(damga: false),
      );
      // Damga yoksa: sonuç hiçbir seçimde olmadığı için o olgu yazılır;
      // "sistemden aktarıldı" bilgisi UYDURULMAZ.
      expect(_metin('Kuponlarda 2 seçeneği bulunmuyordu'), findsOneWidget);
      expect(_metinIceren('Sistemden aktarılan'), findsNothing);
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
      expect(_metinIceren('bilemedin'), findsNothing);
    });
  });
}
