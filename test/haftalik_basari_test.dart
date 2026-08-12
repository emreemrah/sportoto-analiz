// HAFTALIK BAŞARI EKRANI RENDER TESTLERİ.
//
// Ekran 2026-08-10'da kaynaktan bilinçli sapmayla "Haftalık Başarı" düzenine
// geçti (bkz. user_dashboard_screen.dart başlık notu); RN'de birebir karşılığı
// yok, testler bu yüzden çeviri değil YENİ ekranın sözleşmesini sabitler:
//  * Üstte hafta/sezon + tamamlanma durumu; Sen/Sistem yan yana ve sayılar
//    YALNIZ resmî sonuçlardan.
//  * Özet / Maçlar / Geçmiş sekmeleri; Maçlar'da Tümü/Doğru/Yanlış/Bekleyen
//    filtreleri GERÇEK sayılarla.
//  * Teknik bilgiler varsayılan KAPALI; dokununca açılır.
//
// Ağ, radar testlerindeki `api.tasiyici` dikişiyle sahtelenir; tanımsız uçlar
// 404 döner (kupon sunucu eşitlemesi sessizce geçer — gerçek davranış).

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/features/dashboard/user_dashboard_screen.dart';

class _SahteTasiyici implements HttpClientAdapter {
  final List<String> istekler = [];
  Map<String, Object?> uclar = const {};

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final u = options.uri.toString();
    istekler.add(u);
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
// Backend'in gerçek yanıt şekilleri: rounds/history bülten uçlarından,
// system-scorecard karne ucundan alındı. home/away birer NESNEDİR (name'li).

Map<String, dynamic> _mac(
  int no,
  String home,
  String away, {
  String? result,
  Map<String, Object?>? score,
  String? sys,
  bool viaNotary = false,
}) => {
  'no': no,
  'home': {'name': home},
  'away': {'name': away},
  'date': '2026-08-0${no}T17:00:00Z',
  'result': ?result,
  'score': ?score,
  if (viaNotary) 'viaNotary': true,
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
  // Varsayılan seçim: güncelden bir önceki hafta → 1600.
  '/api/history/1600': {
    'matches': [
      // Sistem KUPON önerisi ÇOKLU ('10' = 1 veya X) ve sonucu KAPSIYOR —
      // kupon başarısına doğru yazılır (tekli ana tahmin hesabı DEĞİL).
      _mac(
        1,
        'Ayvalıkgücü Belediyespor',
        'Galatasaray',
        result: '1',
        score: {'home': 2, 'away': 0},
        sys: '10',
      ),
      // Sistem YANLIŞ (resmî X, tahmin 2)
      _mac(
        2,
        'Kasımpaşa',
        'Trabzonspor',
        result: 'X',
        score: {'home': 1, 'away': 1},
        sys: '2',
      ),
      // Resmî sonuç YOK → bekleyen
      _mac(3, 'Konyaspor', 'Rizespor', sys: '1'),
      // NOTER KARARI: resmî sonuç VAR ama skor YOK — çözülmüş sayılır,
      // "bekliyor" yazılmaz (2026-08-10 canlı bulgusu).
      _mac(4, 'Rakow', 'Zaglebie', result: 'X', sys: 'X', viaNotary: true),
    ],
  },
  // MÜHÜR — maç kartlarındaki sistem seçiminin TEK kaynağı (2026-08-11).
  // history'deki `prediction` alanı artık okunmuyor; buradaki değerler onunla
  // AYNI tutuldu ki bu testin ölçtüğü davranış (filtre/işaret) değişmesin.
  '/api/bulletins/1600/snapshot': {
    'id': 'snap-1600',
    'lockedAt': '2026-08-08T13:55:05.857Z',
    'late': false,
    'immutable': true,
    'verificationHash': 'test-hash',
    'payload': {
      'matches': [
        {
          'no': 1,
          'systemPrediction': {'symbol': '10', 'display': '10'},
        },
        {
          'no': 2,
          'systemPrediction': {'symbol': '2', 'display': '2'},
        },
        {
          'no': 3,
          'systemPrediction': {'symbol': '1', 'display': '1'},
        },
        {
          'no': 4,
          'systemPrediction': {'symbol': 'X', 'display': 'X'},
        },
      ],
    },
  },
  '/api/system-scorecard': {
    'hasData': true,
    'accuracy': 55,
    'total': 30,
    'correct': 16,
    'wrong': 14,
    // Hafta kayıtları backend karne şekliyle (scorecardService.js):
    // correct/evaluated/missing/accuracy — üst Sistem kartı BU kayıttan okur.
    'weeks': [
      {
        'roundId': 1599,
        'round': '52. Hafta',
        'accuracy': 60,
        'status': 'complete',
        'correct': 6,
        'evaluated': 10,
        'missing': 0,
      },
      {
        'roundId': 1600,
        'round': '53. Hafta',
        'accuracy': 50,
        'status': 'partial',
        'correct': 7,
        'evaluated': 14,
        'missing': 1,
      },
    ],
  },
};

Future<void> _tur(WidgetTester t, [int n = 25]) async {
  for (var i = 0; i < n; i++) {
    await t.pump(const Duration(milliseconds: 1));
  }
}

Future<void> _ekraniAc(WidgetTester t, {Map<String, Object?>? uclar}) async {
  _tasiyici.istekler.clear();
  _tasiyici.uclar = uclar ?? kUclar;
  api.tasiyici = _tasiyici;
  await t.pumpWidget(const MaterialApp(home: UserDashboardScreen()));
  await _tur(t);
}

Finder _metin(String s) => find.text(s, findRichText: true);
Finder _metinIceren(String s) => find.textContaining(s, findRichText: true);

/// Liste tembel kurulur: ekran dışındaki bölüm bulunmadan/dokunulmadan önce
/// AŞAĞI KAYDIRILIR — kullanıcının yaptığı da budur.
Future<void> _asagiKaydir(WidgetTester t, [double miktar = 700]) async {
  await t.drag(find.byType(ListView), Offset(0, -miktar));
  await _tur(t, 5);
}

void main() {
  testWidgets('üst blok: hafta/sezon, tamamlanma durumu, Sen/Sistem kartları', (
    t,
  ) async {
    await _ekraniAc(t);
    // Varsayılan hafta: en son sonuçlanmış (güncelden önceki) — 53. Hafta.
    expect(_metin('53. Hafta'), findsOneWidget);
    expect(_metin('2026 Sezonu'), findsOneWidget);
    // Tamamlanma durumu: 3/4 resmî sonuç geldi (noter maçı ÇÖZÜLMÜŞ sayılır).
    expect(_metin('Resmi sonuçlar bekleniyor · 3/4 geldi'), findsOneWidget);
    // ROL AYRIMI (2026-08-10, kullanıcı kararı): SİSTEM kartı YOK — sistem
    // başarısının tek adresi Sistem Karnesi. Burada yalnız tek satırlık
    // karne özeti + bağlantı durur; sayı karneden AYNEN okunur.
    expect(_metinIceren('Sistem ana tahmin: 7/14 · %50'), findsOneWidget);
    expect(_metin('Sistem Karnesi ›'), findsOneWidget);
    expect(_metin('Kupon başarısı'), findsNothing);
    expect(_metin('SİSTEM'), findsNothing);
    // Kupon yokken "Sen" tarafı sayı UYDURMAZ.
    expect(_metinIceren('Bu hafta kupon yok'), findsOneWidget);
    // Sekmeler: Özet + Maçlar; 'Geçmiş' KALDIRILDI (karne özetiydi).
    for (final s in ['Özet', 'Maçlar']) {
      expect(_metin(s), findsOneWidget);
    }
    expect(_metin('Geçmiş'), findsNothing);
    expect(_metin('Genel Özet'), findsNothing);
  });

  testWidgets('Maçlar sekmesi: gerçek sayılı filtreler, tam takım adı, '
      'tik/çarpı/bekliyor işaretleri', (t) async {
    await _ekraniAc(t);
    await t.tap(_metin('Maçlar'), warnIfMissed: false);
    await _tur(t);

    // Filtre sayıları GERÇEK: 4 maç, 2 doğru (noter dahil), 1 yanlış,
    // 1 bekleyen — noter maçı Bekleyen'e GİRMEZ.
    for (final f in ['Tümü (4)', 'Doğru (2)', 'Yanlış (1)', 'Bekleyen (1)']) {
      expect(_metin(f), findsOneWidget);
    }
    // Kupon yok → filtrenin neye baktığı AÇIKÇA yazar.
    expect(_metinIceren('sistem tahminine göredir'), findsOneWidget);
    // Takım adları TAM (kesilmez) ve tarih satırı var.
    expect(
      _metinIceren('Ayvalıkgücü Belediyespor - Galatasaray'),
      findsOneWidget,
    );
    // Resmî skor + sonuç ve işaretler: ✅ doğru, ❌ yanlış, ⏳/bekliyor.
    expect(_metinIceren('2-0'), findsOneWidget);
    expect(_metinIceren('✅'), findsOneWidget);
    expect(_metinIceren('❌'), findsOneWidget);

    // Alt kartlar ekran dışında — kaydırıp bakılır: 3. maç 'bekliyor';
    // noter maçında skor yok ama 'bekliyor' YAZMAZ, NOTER rozeti basılır.
    await _asagiKaydir(t, 500);
    expect(_metin('bekliyor'), findsOneWidget);
    expect(_metin('NOTER · X'), findsOneWidget);
    // Filtre çipleri için başa dön (liste tembel — çipler yeniden kurulur).
    await t.drag(find.byType(ListView), const Offset(0, 700));
    await _tur(t, 5);

    // Doğru filtresi: 1. maç ve noter maçı kalır.
    await t.tap(_metin('Doğru (2)'), warnIfMissed: false);
    await _tur(t);
    expect(_metinIceren('Ayvalıkgücü Belediyespor'), findsOneWidget);
    expect(_metinIceren('Rakow'), findsOneWidget);
    expect(_metinIceren('Kasımpaşa'), findsNothing);
    expect(_metinIceren('Konyaspor'), findsNothing);

    // Bekleyen filtresi: yalnız sonuçsuz maç kalır.
    await t.tap(_metin('Bekleyen (1)'), warnIfMissed: false);
    await _tur(t);
    expect(_metinIceren('Konyaspor'), findsOneWidget);
    expect(_metinIceren('Ayvalıkgücü Belediyespor'), findsNothing);
  });

  // 'Geçmiş sekmesi' testi KALDIRILDI (2026-08-10 rol ayrımı): sekme artık
  // yok — karne özeti yalnız Sistem Karnesi ekranında yaşar.

  testWidgets('karnede OLMAYAN hafta için sistem sayısı uydurulmaz', (t) async {
    _tasiyici.istekler.clear();
    _tasiyici.uclar = {
      ...kUclar,
      '/api/system-scorecard': {
        'hasData': true,
        'accuracy': 60,
        'total': 10,
        'correct': 6,
        'wrong': 4,
        'weeks': [
          {
            'roundId': 1599,
            'round': '52. Hafta',
            'accuracy': 60,
            'status': 'complete',
            'correct': 6,
            'evaluated': 10,
            'missing': 0,
          },
        ],
      },
    };
    api.tasiyici = _tasiyici;
    await t.pumpWidget(const MaterialApp(home: UserDashboardScreen()));
    await _tur(t);
    // Seçili hafta (1600) karnede yok → sistem satırı sayı UYDURMAZ.
    expect(
      _metinIceren('Sistem ana tahmin: resmî karne kaydı yok'),
      findsOneWidget,
    );
    expect(_metin('Sistem Karnesi ›'), findsOneWidget);
  });

  testWidgets('MÜHÜR YOKSA maç kartı "Sistem tahmin kaydı doğrulanamadı" der', (
    t,
  ) async {
    // 2026-08-11 kullanıcı bulgusu: geçmiş ekran, mühür yerine güncel analizi
    // okuyunca sistem sonradan kazanmış görünüyordu. Mühür yoksa sistem
    // seçimi İDDİA EDİLMEZ ve maç ✅/❌ almaz.
    final muhursuz = Map<String, Object?>.from(kUclar)
      ..remove('/api/bulletins/1600/snapshot');
    await _ekraniAc(t, uclar: muhursuz);
    await t.tap(_metin('Maçlar'), warnIfMissed: false);
    await _tur(t);

    expect(_metin('Sistem tahmin kaydı doğrulanamadı'), findsWidgets);
    // Sistem hiçbir maçta doğru/yanlış işareti almaz.
    expect(_metinIceren('Sistem: '), findsNothing);
    expect(_metinIceren('✅'), findsNothing);
    expect(_metinIceren('❌'), findsNothing);
  });

  testWidgets('Teknik bilgiler KAPALI başlar; dokununca açılır ve gerçek '
      'kimlikleri gösterir', (t) async {
    await _ekraniAc(t);
    expect(_metin('roundId / bulletinId'), findsNothing);
    // Bölüm EN ALTTA — önce oraya kaydırılır.
    await _asagiKaydir(t);
    await t.tap(_metinIceren('Teknik bilgiler'), warnIfMissed: false);
    await _tur(t);
    expect(_metin('roundId / bulletinId'), findsOneWidget);
    expect(_metin('1600'), findsOneWidget);
    expect(_metin('3/4 geldi'), findsOneWidget);
    // Tekrar dokununca kapanır.
    await t.tap(_metinIceren('Teknik bilgiler'), warnIfMissed: false);
    await _tur(t);
    expect(_metin('roundId / bulletinId'), findsNothing);
  });
}
