// KAYNAK: app/test-ui/radar-ekrani.test.jsx — BİREBİR çeviri.
//
// RADAR MERKEZİ RENDER TESTLERİ.
//
// NEDEN VAR: RadarScreen kaynakta 1500 satır, 30+ durum ve kendini besleyen
// effect'ler taşıyordu — projedeki en kırılgan ekran. Bu testler ekranın
// ÇİZİLDİĞİNİ ve dürüstlük metinlerinin kullanıcıya ULAŞTIĞINI doğrular
// (kaynak taraması değil, gerçek render).
//
// Ağ, `api.tasiyici` dikişiyle sahte taşıyıcıya bağlanır: uca göre yanıt
// verilir, tanımlanmayan uçlar 404 döner — ekranın eksik veriye dayanıklı
// olduğu da böylece test edilir. Gerçek bekleme yoktur.
//
// KAYNAKTAN UYARLAMA NOTLARI (davranış değil, sınama tekniği farkları):
//  * RNTL, ⓘ panellerinin detay metnini kapalıyken de ağaçta bulabiliyordu;
//    Flutter InfoIpucu detayı ancak AÇILINCA kurar. Testler paneli gerçekten
//    AÇAR — kullanıcının yaptığı da budur.
//  * `stickyHeaderIndices` bir RN prop'uydu; Flutter'da karşılığı yapısaldır.
//    Testler prop yerine GERÇEK davranışı ölçer: listeyi kaydırınca Radar 5
//    filtre şeridi ekranda KALIR, Radar 4'ün uzun ⓘ paneli KAYAR.
//  * `toMatchSnapshot` yerine altın kopya listesi TESTİN İÇİNE gömülüdür;
//    kasıtlı bir metin değişikliğinde liste güncellenir ve nedeni commit
//    mesajına yazılır (kaynaktaki `jest -u` disipliniyle aynı).

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart' hide Notification;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/features/radar/radar_memory.dart';
import 'package:masteranaliz/features/radar/radar_screen.dart';

// ───────────────────────────── Sahte taşıyıcı ─────────────────────────────

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

  int sayi(String parca) => istekler.where((u) => u.contains(parca)).length;
}

final _tasiyici = _SahteTasiyici();

void _mockUclar(Map<String, Object?> harita) {
  _tasiyici.istekler.clear();
  _tasiyici.uclar = harita;
}

// ─────────────────────────────── Fikstürler ───────────────────────────────
// Fikstür, backend'in GERÇEK radar yükünden alındı (radarService.js satır 124
// ve masterRadar.js dönüşü): home/away DÜZ METİNDİR, sınıf anahtarı
// classification'dır. Uydurma bir şekil test yeşil olsa bile hiçbir şey
// kanıtlamaz — kaynakta ilk denemede tam olarak bu hataya düşüldü.

Map<String, dynamic> kMac(int no, [Map<String, dynamic> over = const {}]) => {
  'no': no,
  'matchId': 'm$no',
  'home': 'Ev Takımı',
  'away': 'Dep Takımı',
  'league': 'Test Ligi',
  'kickoffAt': '2026-08-02T17:00:00Z',
  'master': {
    'classification': 'strong_candidate',
    'classificationLabel': 'Güçlü Aday',
    'mainPrediction': '1',
    'favorite': {'symbol': '1', 'percent': 55},
    'favoriteFailureRisk': 28,
    'dataQuality': 78,
    'confidence': 72,
    'activeRadarCount': 4,
    'conflictScore': 20,
    'topReasons': [],
    'riskReasons': [],
    ...((over['master'] as Map?)?.cast<String, dynamic>() ?? const {}),
  },
  'radars': <String, dynamic>{},
};

final Map<String, dynamic> kGuncel = {
  'hasData': true,
  'current': true,
  'roundId': 1600,
  'round': '1. Hafta',
  'year': 2026,
  'sealed': false,
  'methodologyVersion': 'radar-1.0.0',
  'summary': {'avgDataQuality': 78},
  'matches': [kMac(1), kMac(2), kMac(3)],
};

final Map<String, dynamic> kHaftalar = {
  'weeks': [
    {
      'roundId': 1600,
      'round': '1. Hafta',
      'year': 2026,
      'current': true,
      'archived': false,
      'locked': false,
      'sealed': false,
    },
  ],
};

Map<String, Object?> kVarsayilan() => {
  '/api/radar/weeks': kHaftalar,
  '/api/radar/current': kGuncel,
};

const kGun = {
  'date': '2026-08-01',
  'weekday': 'Cuma',
  'label': 'Cuma 01.08',
  'isMatchDay': true,
  'withData': 1,
};
const kOncekiGun = {
  'date': '2026-07-31',
  'weekday': 'Perşembe',
  'label': 'Perşembe 31.07',
  'isMatchDay': false,
  'withData': 1,
};

// ─────────────────────────────── Yardımcılar ───────────────────────────────

Future<void> _tur(WidgetTester t, [int n = 25]) async {
  for (var i = 0; i < n; i++) {
    await t.pump(const Duration(milliseconds: 1));
  }
}

Future<void> ekraniAc(WidgetTester t) async {
  await t.pumpWidget(
    const ProviderScope(child: MaterialApp(home: RadarScreen())),
  );
  await _tur(t);
}

Future<void> sekme(WidgetTester t, String sub) async {
  await t.tap(find.text(sub).first, warnIfMissed: false);
  await _tur(t);
}

/// ⓘ panelini AÇAR (özetine dokunur) — detay metinleri ancak böyle kurulur.
Future<void> ipucuAc(WidgetTester t, String ozetParcasi) async {
  await t.tap(
    find.textContaining(ozetParcasi, findRichText: true).first,
    warnIfMissed: false,
  );
  await _tur(t, 5);
}

/// Render ağacındaki tüm metinleri SIRASIYLA toplar (altın kopya + marka
/// taramaları için). Her Text bir RichText üretir; saf RichText'ler de
/// böylece tek listede, ağaç sırasıyla toplanır.
List<String> ekranMetinleri(WidgetTester t) => t
    .widgetList<RichText>(find.byType(RichText))
    .map((w) => w.text.toPlainText())
    .toList();

Finder metin(String s) => find.text(s, findRichText: true);
Finder metinIceren(String s) => find.textContaining(s, findRichText: true);

int evTakimiSayisi(WidgetTester t) =>
    metinIceren('Ev Takımı').evaluate().length;

/// Radar 5 tablosundaki KAPSAM ⓘ'sini açar — dönem/başlangıç/eksik notları
/// (kaynaktaki gibi) dürüstlük gereği durur ama varsayılan kapalıdır; test,
/// kullanıcının yaptığı gibi açıp okur.
Future<void> kapsamAc(WidgetTester t) async {
  await t.tap(
    find
        .descendant(of: find.byType(SiraGecmisListesi), matching: metin('i'))
        .first,
    warnIfMissed: false,
  );
  await _tur(t, 5);
}

void main() {
  setUp(() {
    api.tasiyici = _tasiyici;
    _mockUclar(kVarsayilan());
  });

  group('Radar Merkezi ekranı', () {
    testWidgets('güncel hafta çiziliyor ve çökmüyor', (t) async {
      await ekraniAc(t);
      expect(metinIceren('Radar Merkezi'), findsWidgets);
      expect(evTakimiSayisi(t), 3);
    });

    // TEKNİK BAŞLIK BLOĞU KALDIRILDI (kullanıcı kararı 2026-08-01): veri
    // yeterliliği, radar karnesi, kriter karnesi, Sistem Karnesi ve Metodoloji
    // bağlantıları kullanıcı ekranından çıkarıldı.
    testWidgets('teknik başlık bloğu kullanıcı ekranında GÖSTERİLMEZ', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        // Karne verisi GELSE BİLE çizilmemeli (uç hâlâ ayakta).
        '/api/radar/scorecard': {
          'hasData': true,
          'master': {
            'allTime': {
              'mainAccuracy': {'rate': 48, 'total': 45},
            },
          },
        },
      });
      await ekraniAc(t);
      expect(evTakimiSayisi(t), 3);
      expect(metinIceren('Veri yeterliliği'), findsNothing);
      expect(metinIceren('Radar Karnesi'), findsNothing);
      expect(metinIceren('Kriter Karnesi'), findsNothing);
      expect(metinIceren('Sistem Karnesi'), findsNothing);
      expect(metinIceren('Metodoloji'), findsNothing);
    });

    testWidgets('kaldırılan bloklar için SUNUCUYA istek atılmaz (ölü çağrı '
        'yok)', (t) async {
      await ekraniAc(t);
      expect(evTakimiSayisi(t), 3);
      expect(_tasiyici.sayi('/api/radar/scorecard'), 0);
      expect(_tasiyici.sayi('/api/radar/methodology'), 0);
      // Olumlu karşılık: asıl veri yine çekiliyor.
      expect(_tasiyici.sayi('/api/radar/current'), greaterThan(0));
    });

    testWidgets('mühürlü haftada "değişmez" güvencesi kullanıcıya ULAŞIYOR', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'current': false,
          'sealed': true,
          'sealedAt': '2026-08-02T16:55:00Z',
          'verificationHash': 'abcdef0123456789',
        },
      });
      await ekraniAc(t);
      expect(metinIceren('Mühürlü analiz'), findsOneWidget);
      expect(
        metinIceren('sonuçlar gelse de bu görüntü değişmez'),
        findsOneWidget,
      );
      // Doğrulama karması KISALTILMIŞ gösterilir (10 hane).
      expect(metinIceren('Doğrulama #abcdef0123'), findsOneWidget);
      expect(metinIceren('abcdef0123456789'), findsNothing);
    });

    testWidgets('sunucu veri döndürmezken sahte radar ÜRETİLMEZ, iskelet '
        'ayakta kalır', (t) async {
      _mockUclar({
        '/api/radar/current': {
          'hasData': false,
          'pending': true,
          'round': '1. Hafta',
        },
      });
      await ekraniAc(t);
      // Boş ekran değil: başlık görünmeye devam eder.
      expect(metinIceren('Radar Merkezi'), findsWidgets);
      // Uydurma maç/yüzde yok.
      expect(metinIceren('Ev Takımı'), findsNothing);
    });

    testWidgets('API anahtarları kullanıcıya HAM gösterilmez, insan dili '
        'kullanılır', (t) async {
      await ekraniAc(t);
      expect(evTakimiSayisi(t), greaterThan(0));
      // 'strong_candidate' bir API sözleşmesi anahtarıdır; ekranda görünürse
      // kullanıcı ham veri okuyor demektir.
      expect(metinIceren('strong_candidate'), findsNothing);
      // "banko" kesinlik dili hiçbir yerde geçmez (yeni başlangıç kuralı).
      expect(
        ekranMetinleri(t).where((s) => s.toLowerCase().contains('banko')),
        isEmpty,
      );
    });

    testWidgets('veri yeterliliği ve güven AYRI gösterilir (tek rakama '
        'indirgenmez)', (t) async {
      await ekraniAc(t);
      // Kartta ikisi ayrı çip: "Veri %78" ve "Güven %72". Karıştırılırsa
      // kullanıcı eksik veriyi yüksek güven sanar.
      expect(metin('%78'), findsWidgets);
      expect(metin('%72'), findsWidgets);
    });

    // TAŞINAN PANELLER — radar_tab_headers.dart. Bu panellerin metinleri
    // ürünün dürüstlük sözleşmesidir: Radar 3 (oynanma YÜZDESİ) ile Radar 4
    // (gerçek ORAN) ayrımı ve "mühürlenir, değişmez" güvencesi.
    testWidgets('Radar 4 paneli: oran/yüzde ayrımı ve mühür güvencesi '
        'ekranda', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-odds': {
          'roundId': 1600,
          'days': [],
          'matches': [],
          'note': 'Bu hafta için oran kaydı yok.',
        },
      });
      await ekraniAc(t);
      expect(evTakimiSayisi(t), 3);
      await sekme(t, 'Oran Takibi');

      expect(metinIceren('Oran Takibi · Günlük 1/X/2 Oranları'), findsWidgets);
      await ipucuAc(t, 'Oran Takibi · Günlük');
      expect(metinIceren('burada yüzde değil, oran vardır'), findsOneWidget);
      expect(metinIceren('mühürlenir ve sonradan değişmez'), findsOneWidget);
      // Kayıt yokken uydurma oran değil, sunucunun dürüst notu gösterilir.
      expect(metin('Bu hafta için oran kaydı yok.'), findsOneWidget);
    });

    testWidgets('Radar 3 paneli: kaynak yokken UYDURMA YÜZDE gösterilmediği '
        'yazıyor', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [],
          'matches': [],
          'sources': [],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');

      expect(metinIceren('Oynanma DNA · Günlük 1/X/2 Yüzdeleri'), findsWidgets);
      await ipucuAc(t, 'Oynanma DNA · Günlük');
      expect(metinIceren('Bu bir ORAN değildir'), findsOneWidget);
      expect(
        metin('Kaynak yok — veri bekleniyor (uydurma yüzde gösterilmez).'),
        findsOneWidget,
      );
    });

    testWidgets('Radar 5 paneli: dönem çipleri ve veri yokken dürüst not', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/position-dna': {
          'hasData': false,
          'note':
              'Resmî geçmiş arşiv birikiyor — veri geldikçe sıra yüzdeleri '
              'görünür.',
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Bülten DNA');

      expect(metin('Tüm Haftalar'), findsOneWidget);
      expect(metin('Son 15 Hafta'), findsOneWidget);
      expect(metinIceren('Resmî geçmiş arşiv birikiyor'), findsOneWidget);
      // Çipe HİÇBİR koşulda yüzde yazılmaz: 3 Ağustos 2026'dan beri gösterge
      // tümüyle kaldırıldı ("dönem başarısı kafa karıştırıyor").
      expect(metinIceren('Tüm Haftalar · %'), findsNothing);
    });

    // DOLU VERİYLE SATIRLAR — satır çizicileri ancak veri varken çalışır.
    testWidgets('Radar 4 satırı: oran ve önceki güne göre kıyas çiziliyor', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-odds': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'counts': {'total': 3},
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-07-31': {
                  'odds': {'1': 1.70, 'X': 3.30, '2': 4.50},
                },
                '2026-08-01': {
                  'odds': {'1': 1.61, 'X': 3.20, '2': 4.25},
                },
              },
            },
            // 2 numarada kayıt YOK → sebep satırı.
            {
              'no': 2,
              'cells': <String, Object?>{},
              'notes': {
                '2026-08-01': {'text': 'Bu maç seçili liglerde değil'},
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oran Takibi');

      // Oran gösteriliyor ve önceki günle kıyaslandığı SÖYLENİYOR.
      expect(metin('Bir önceki güne göre değişim'), findsOneWidget);
      // Kayıt olmayan maçta oran UYDURULMUYOR, sebebi yazılıyor.
      expect(metin('Bu maç seçili liglerde değil.'), findsOneWidget);
      // Sayaç arka uçtaki gerçek sayıyı veriyor.
      expect(metinIceren("3 maçın 1'inde oran var"), findsOneWidget);
    });

    // ÇEKİM SAATİ SEÇİLİ GÜNE AİTTİR (kullanıcı düzeltmesi, 3 Ağustos 2026).
    testWidgets('Radar 3: SEÇİLİ GÜNÜN çekim saati yazar, gün değişince saat '
        'de değişir', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'sources': ['k1'],
          'matches': [],
          'days': [
            {...kOncekiGun, 'lastObservedLabel': '20:45'},
            {...kGun, 'lastObservedLabel': '22:35'},
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');

      // Varsayılan gün (Cuma 01.08) → kendi saati.
      expect(
        metinIceren('Cuma 01.08 · kaynaktan son çekim 22:35'),
        findsOneWidget,
      );
      // Başka güne geçilince O GÜNÜN saati gelir — haftanın en sonu değil.
      await t.tap(metinIceren('Perşembe').first, warnIfMissed: false);
      await _tur(t);
      expect(
        metinIceren('Perşembe 31.07 · kaynaktan son çekim 20:45'),
        findsOneWidget,
      );
      // Cuma'nın saati SATIRDAN düşer. (Çipinde durmaya devam eder — her çip
      // kendi gününün saatini taşır; kullanıcı hepsini bir bakışta görür.)
      expect(metinIceren('kaynaktan son çekim 22:35'), findsNothing);
    });

    testWidgets('Radar 3: o gün kayıt alınamadıysa UYDURMA saat yazılmaz', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'sources': [],
          'matches': [],
          'days': [
            {...kGun, 'lastObservedLabel': null},
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      expect(metinIceren('kayıt alınamadı'), findsOneWidget);
      expect(metinIceren('son çekim'), findsNothing);
    });

    testWidgets('Radar 3 satırı: yüzde kaynağıyla birlikte, kaynak yoksa '
        'uydurulmuyor', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['k1', 'k2'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-07-31': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 58, 'X': 24, '2': 18},
                    },
                  },
                },
                '2026-08-01': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 62, 'X': 21, '2': 17},
                    },
                    'k2': {
                      'percentages': {'1': 60, 'X': 22, '2': 18},
                    },
                  },
                },
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');

      // Kaynak yalnız RENKLİ NOKTA olarak görünür (kimlik/ad yok).
      expect(find.byKey(const Key('kaynak-nokta-k1')), findsWidgets);
      expect(find.byKey(const Key('kaynak-nokta-k2')), findsWidgets);
      // Kaynak ADI hiç yazılmaz.
      expect(
        ekranMetinleri(t).where(
          (s) => RegExp(r'kaynak$', caseSensitive: false).hasMatch(s.trim()),
        ),
        isEmpty,
      );
      // Nokta kaynağın RENK adını erişilebilirlik etiketi olarak taşır.
      final semantikTutamaci = t.ensureSemantics();
      expect(find.bySemanticsLabel(RegExp('Sarı kaynak')), findsWidgets);
      semantikTutamaci.dispose();
      // Yüzde GERÇEKTEN çiziliyor (yalnız kaynak işareti değil).
      expect(metinIceren('1 %62'), findsWidgets);
    });

    testWidgets('Oynanma DNA paneli: kaynak satırına dokununca açılıyor', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['k1'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-01': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 62, 'X': 21, '2': 17},
                    },
                  },
                },
              },
            },
          ],
        },
        '/api/radar/played-dna': {
          'hasData': true,
          'position': 1,
          'weekday': 5,
          'settledMatches': 240,
          'current': {'1': 62, 'X': 21, '2': 17},
          'distribution': {
            'hasData': true,
            'overall': {'text': '18 kayıtta 8 kez 1, 5 kez X, 5 kez 2'},
            'byDay': {
              'selected': {'text': '6 kayıtta 3 kez 1'},
              'others': {'text': '12 kayıtta 5 kez 1'},
            },
            'byPosition': {
              'own': {'text': '4 kayıtta 2 kez 1'},
              'rest': {'text': '14 kayıtta 6 kez 1'},
            },
            'samples': [],
          },
          'movement': {'words': 'ev sahibine kayış', 'hasData': false},
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      await t.tap(find.byKey(const Key('kaynak-nokta-k1')).first);
      await _tur(t);

      // Yakınlık seçimi KULLANICIYA aittir — otomatik genişleme yok.
      expect(metin('Birebir aynı'), findsOneWidget);
      expect(metin('Tüm Maçlar'), findsOneWidget);
      // Örneklem "kaç kayıtta" olarak şeffaf.
      expect(metin('18 kayıtta 8 kez 1, 5 kez X, 5 kez 2'), findsOneWidget);
      // Güven seviyesi/olasılık iddiası PANELDE yoktur.
      final panelMetinleri = t
          .widgetList<RichText>(
            find.descendant(
              of: find.byKey(const Key('oynanma-dna-1-k1')),
              matching: find.byType(RichText),
            ),
          )
          .map((w) => w.text.toPlainText());
      expect(
        panelMetinleri.where(
          (s) => RegExp(
            'güven|olasılık|ihtimal',
            caseSensitive: false,
          ).hasMatch(s),
        ),
        isEmpty,
      );
      // Kapsam en sonda ve soluk.
      expect(metinIceren('arşivde 240 sonuçlanmış maç'), findsOneWidget);
      // Hareket verisi yoksa uydurulmuyor.
      expect(metin('Bu harekete yakın geçmiş sonuç yok'), findsOneWidget);
    });

    testWidgets('Oynanma DNA paneli: birebir hareket eşleşmesi yoksa GEVŞEK '
        'kova gösterilir', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['k1'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-01': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 44, 'X': 30, '2': 26},
                    },
                  },
                },
              },
            },
          ],
        },
        // Backend'in GERÇEK yükü (playedDna.findMovementDna → fallback alanı).
        '/api/radar/played-dna': {
          'hasData': true,
          'position': 1,
          'weekday': 5,
          'settledMatches': 15,
          'current': {'1': 44, 'X': 30, '2': 26},
          'distribution': {'hasData': false},
          'movement': {
            'words': '1 düştü · X yükseldi · 2 yükseldi',
            'openText': '1 %61 · X %22 · 2 %17',
            'closeText': '1 %44 · X %30 · 2 %26',
            'hasData': false,
            'fallback': {
              'kind': 'moveBand',
              'level': 'gevşek eşleşme — yön kovası',
              'label': 'favorisi ≥8 puan düşen maçlar',
              'matched': 3,
              'overall': {
                'text':
                    '3 benzer kayıt — örneklem yetersiz, yüzde gösterilmez '
                    '(2 kez berabere bitti, 1 kez deplasman kazandı)',
              },
              'samples': [
                {
                  'text':
                      '51. Hafta · 4. sıra · Ilves – Lahti · 1 %58 · X %21 · '
                      '2 %21 → 1 %45 · X %28 · 2 %27 · → Berabere bitti',
                },
              ],
            },
          },
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      await t.tap(find.byKey(const Key('kaynak-nokta-k1')).first);
      await _tur(t);

      // Birebir eşleşme yok mesajı DURUR (kova onu taklit etmez)…
      expect(metin('Bu harekete yakın geçmiş sonuç yok'), findsOneWidget);
      // …ama gevşek kova, etiketi AÇIKÇA "gevşek" olarak gösterilir.
      expect(
        metinIceren('Gevşek eşleşme · favorisi ≥8 puan düşen maçlar'),
        findsOneWidget,
      );
      expect(metinIceren('2 kez berabere bitti'), findsOneWidget);
      // Kovadaki gerçek kayıtlar şeffaf.
      expect(metinIceren('Ilves – Lahti'), findsOneWidget);
    });

    // LEGACY GÖRÜNÜM — Radar Merkezi ÖNCESİ haftalar. Donmuş durumda.
    testWidgets('eski hafta: legacy sürpriz radarı çiziliyor, yeni sistem '
        'karışmıyor', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          'hasData': false,
          'legacyOnly': true,
          'roundId': 1400,
          'round': '40. Hafta',
          'year': 2026,
          'radar': [
            {
              'no': 1,
              'home': 'Eski Ev',
              'away': 'Eski Dep',
              'surpriseScore': 62,
              'label': 'SÜRPRİZE AÇIK',
              'labelColor': 'red',
              'favorite': {'symbol': '1', 'percent': 48},
              'estimated': true,
              'probabilities': {'1': 48, 'X': 28, '2': 24},
              'signals': {
                'position': {'home': 3, 'away': 11},
              },
              'factors': [
                {'label': 'Deplasman formda', 'points': 8},
              ],
              'comment': 'Ev sahibi favori ama fark az.',
            },
          ],
        },
      });
      await ekraniAc(t);
      expect(metinIceren('Eski Ev'), findsWidgets);
      expect(metinIceren('Eski Dep'), findsWidgets);
      expect(metinIceren('62'), findsWidgets);
      // Sıra bilgisi eski biçimde ("Sıra 3. – 11.").
      expect(metinIceren('Sıra 3. – 11.'), findsOneWidget);
      // Oran YOKSA favori yüzdesi "≈" ile işaretlenir — tahmini olduğu
      // gizlenmez.
      expect(metinIceren('Favori 1 · %48 ≈'), findsOneWidget);
      // Yeni sistemin sekmeleri eski haftada GÖRÜNMEZ (iki sistem karışmaz).
      expect(metin('Oynanma DNA'), findsNothing);
      expect(metin('Bülten DNA'), findsNothing);
    });

    // SONSUZ İSTEK DÖNGÜSÜ KORUMASI: sunucu farklı/eksik roundId dönse bile
    // ekran sunucuyu dövmez (Riverpod family: istek İSTENEN haftayla
    // anahtarlanır, sonuca bağımlılık yoktur).
    testWidgets('sunucu yanlış roundId dönse bile sekme sunucuyu dövmez', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        // Kritik nokta: istenen 1600, dönen 9999.
        '/api/radar/daily-odds': {'roundId': 9999, 'days': [], 'matches': []},
      });
      await ekraniAc(t);
      await sekme(t, 'Oran Takibi');
      await _tur(t, 40); // effect'lerin yerleşmesi için bolca tur

      expect(_tasiyici.sayi('/api/radar/daily-odds'), 1);
    });

    // KARIŞIK SİNYALDE TEK İŞARET ÖNERİLMEZ (kullanıcı kararı, 2026-08-10):
    // üç ihtimalli maçta "Ana: 1" basmak yanlış güven verir; motorun birleşik
    // puanının en yüksek iki işareti ÇİFT olarak önerilir. Geri test
    // (53. Hafta): tek işaret 4/12, çift ihtimal 9/12.
    testWidgets('Karışık Sinyal maçında Ana yerine ÇİFT İHTİMAL önerilir', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'matches': [
            kMac(1, {
              'master': {
                'classification': 'medium_risk',
                'classificationLabel': 'Karışık Sinyal',
                'scores': {'home': 45, 'draw': 20, 'away': 35},
              },
            }),
            kMac(2),
          ],
        },
      });
      await ekraniAc(t);
      // En yüksek iki puan (ev 45 + dep 35) → kupon dilinde '1-2'.
      expect(metin('Çift ihtimal: 1-2'), findsOneWidget);
      // Güçlü adayda tek işaret DURUR; karışık sinyalin 'Ana' rozeti yok —
      // ekranda tek 'Ana: 1' güçlü adayınki.
      expect(metin('Ana: 1'), findsOneWidget);
    });

    // Skor verisi olmayan karışık sinyalde çift UYDURULMAZ — eski görünüm.
    testWidgets('skorsuz Karışık Sinyalde çift uydurulmaz, Ana kalır', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'matches': [
            kMac(1, {
              'master': {
                'classification': 'medium_risk',
                'classificationLabel': 'Karışık Sinyal',
              },
            }),
          ],
        },
      });
      await ekraniAc(t);
      expect(metinIceren('Çift ihtimal'), findsNothing);
      expect(metin('Ana: 1'), findsOneWidget);
    });

    // VERİ YOKKEN FAVORİ BASILMAZ (kullanıcı bildirimi, 2026-08-10: "ligler
    // yeni başladı, neye göre favori?"): sezon başında tek puan kaynağı halkın
    // oynanma yüzdesi olabiliyor; onu "Favori" diye sunmak yanıltıcıdır.
    testWidgets('Analiz Hazır Değil (güncel) kartında tahmin ve favori '
        'BASILMAZ', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'matches': [
            kMac(1, {
              'master': {
                'classification': 'insufficient_data',
                'classificationLabel': 'Analiz Hazır Değil',
              },
            }),
          ],
        },
      });
      await ekraniAc(t);
      expect(metinIceren('Tahmin üretilmedi: veri yetersiz'), findsOneWidget);
      expect(metinIceren('Ana:'), findsNothing);
      expect(metinIceren('Favori'), findsNothing);
      // Olmayan tahminin GÜVENİ ve tek radarın UZLAŞMASI da basılmaz
      // (2026-08-10 Master gözden geçirmesi) — kMac fikstürü confidence 72
      // ve conflictScore 20 taşıdığı hâlde çipleri görünmemeli.
      expect(metinIceren('Güven'), findsNothing);
      expect(metinIceren('Uzlaşma'), findsNothing);
    });

    // SAYAÇ DÜRÜSTLÜĞÜ (2026-08-10 bulgusu): risk süzgeç çipleri eskiden
    // körlemesine TOPLAM maç sayısını gösteriyordu ("X Beraberlik Riski (15)"
    // — 15 maçın 15'i de riskli görünüyordu). Sayaç, çipin açtığı listeyle
    // aynı süzgeçten saymalı.
    testWidgets('risk süzgeç çipleri GERÇEK eşleşme sayısını gösterir', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'matches': [
            kMac(1, {
              'master': {
                'classification': 'medium_risk',
                'classificationLabel': 'Karışık Sinyal',
                'scores': {'home': 40, 'draw': 35, 'away': 25},
              },
            }),
            kMac(2),
          ],
        },
      });
      await ekraniAc(t);
      // 2 maçtan yalnız 1'i draw≥30 — çip (2) değil (1) yazmalı.
      expect(metin('X Beraberlik Riski (1)'), findsOneWidget);
      expect(metin('2 Dep. Sürprizi (0)'), findsOneWidget);
    });

    // Mühürlü/sonuçlu geçmişte tahmin GİZLENMEZ: o tahmin mühürlü kayıttır,
    // sonradan saklamak geçmişi değiştirmek olur; karne de onu sayıyor.
    testWidgets('sonuçlu geçmiş kartta Analiz Hazır Değil olsa da tahmin '
        'görünür kalır', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'matches': [
            {
              ...kMac(1, {
                'master': {
                  'classification': 'insufficient_data',
                  'classificationLabel': 'Analiz Hazır Değil',
                },
              }),
              'official': {
                'result': '2',
                'score': {'home': 0, 'away': 1},
              },
              'outcome': {'mainHit': false},
            },
          ],
        },
      });
      await ekraniAc(t);
      expect(metin('Ana: 1'), findsOneWidget);
      expect(metinIceren('Ana tahmin tutmadı'), findsOneWidget);
      expect(metinIceren('Tahmin üretilmedi'), findsNothing);
    });

    // ERTELENEN MAÇ GÖRÜNÜRLÜĞÜ (2026-08-10, 53. Hafta 14. maç olayı: Raków
    // maçı ertelendi, sonuç kaynaktan hiç gelmeyecekti ve kart SESSİZDİ —
    // kullanıcı "sonuçlar yansımamış" sandı).
    testWidgets('mühürlü haftada sonuçsuz maç "sonuç bekleniyor" der', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'sealed': true,
          'matches': [kMac(1)],
        },
      });
      await ekraniAc(t);
      expect(metinIceren('Sonuç bekleniyor'), findsOneWidget);
      expect(metinIceren('ertelenmiş olabilir'), findsOneWidget);
    });

    testWidgets('noter kararı skorsuz, atıflı ve tuttu-rozetisiz gösterilir', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'sealed': true,
          'matches': [
            {
              ...kMac(1),
              'official': {
                'result': '1',
                'score': null,
                'resultType': 'notary_decision',
              },
              'outcome': null,
            },
          ],
        },
      });
      await ekraniAc(t);
      expect(metinIceren('noter kararı: 1'), findsOneWidget);
      expect(metinIceren('radar karnesine sayılmaz'), findsOneWidget);
      // Maç oynanmadı: "tahmin tuttu/tutmadı" rozeti ve skorlu sonuç satırı yok.
      expect(metinIceren('Ana tahmin'), findsNothing);
      expect(metinIceren('Resmî sonuç'), findsNothing);
    });

    // ALTIN KOPYA — refactor emniyet ağı. Ekrandaki TÜM metinler SIRASIYLA
    // kilitlenir; sessizce kaybolan bir rozet ya da yer değiştiren bir satır
    // da yakalanır. Kasıtlı değişiklikte liste güncellenir, nedeni commit
    // mesajına yazılır.
    testWidgets('altın kopya: ekran metinleri', (t) async {
      await ekraniAc(t);
      expect(evTakimiSayisi(t), 3);
      expect(ekranMetinleri(t), kAltinKopya);
    });
  });

  // RADAR 5 SATIR AÇILIMI — karşılaşmaya dokununca o SIRANIN geçmiş maçları.
  group('Radar 5 satır açılımı (sıranın geçmiş maçları)', () {
    final dnaFikstur = {
      'hasData': true,
      'dna': {
        'positions': [
          for (var i = 1; i <= 3; i++)
            {
              'position': i,
              'windows': {
                'allTime': {
                  'sample': 30,
                  'pct': {'1': 54.5, 'X': 13.6, '2': 31.9},
                },
                'last5': {
                  'sample': 5,
                  'pct': {'1': 60, 'X': 20, '2': 20},
                },
              },
            },
        ],
      },
    };
    // Backend'in GERÇEK yükü (routes/radar.js → positionMatchList).
    final maclarFikstur = {
      'hasData': true,
      'position': 1,
      'count': 7,
      'matches': [
        {
          'roundId': '1526',
          'week': '52. Hafta',
          'home': 'Club Brugge',
          'away': 'Union SG',
          'score': '1-1',
          'result': 'X',
        },
        {
          'roundId': '1525',
          'week': '51. Hafta',
          'home': 'AGF Aarhus',
          'away': 'Brondby',
          'score': '1-1',
          'result': 'X',
        },
        {
          'roundId': '1524',
          'week': '50. Hafta',
          'home': 'AIK Stockholm',
          'away': 'Gais',
          'score': '2-0',
          'result': '1',
        },
        {
          'roundId': '1521',
          'week': '49. Hafta',
          'home': 'Mjallby',
          'away': 'AIK Stockholm',
          'score': '1-2',
          'result': '2',
        },
        {
          'roundId': '1520',
          'week': '48. Hafta',
          'home': 'Sirius',
          'away': 'Mjallby',
          'score': '4-4',
          'result': 'X',
        },
        {
          'roundId': '1519',
          'week': '47. Hafta',
          'home': 'Hammarby',
          'away': 'Degerfors',
          'score': '3-1',
          'result': '1',
        },
        {
          'roundId': '1518',
          'week': '46. Hafta',
          'home': 'Elfsborg',
          'away': 'Norrkoping',
          'score': '0-2',
          'result': '2',
        },
      ],
    };

    Future<void> radar5(
      WidgetTester t, [
      Map<String, Object?> uclar = const {},
    ]) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/position-dna': dnaFikstur,
        '/api/radar/position-matches': maclarFikstur,
        ...uclar,
      });
      await ekraniAc(t);
      expect(evTakimiSayisi(t), 3);
      await sekme(t, 'Bülten DNA');
      expect(metin('Tüm Haftalar'), findsOneWidget);
    }

    // BUGÜNÜN OYNANMA YÜZDESİ: maçın yanında "hangi gündeysek o günün"
    // yüzdeleri, GÜN ADIYLA birlikte.
    final gunlukOynanma = {
      'roundId': 1600,
      'sources': ['k1'],
      'days': [
        {
          'date': '2026-08-02',
          'weekday': 'Pazar',
          'label': 'Pazar 02.08',
          'future': false,
        },
        {
          'date': '2026-08-03',
          'weekday': 'Pazartesi',
          'label': 'Pazartesi 03.08',
          'future': false,
        },
        {
          'date': '2026-08-04',
          'weekday': 'Salı',
          'label': 'Salı 04.08',
          'future': true,
        },
      ],
      'matches': [
        {
          'no': 1,
          'cells': {
            '2026-08-02': {
              'bySource': {
                'k1': {
                  'percentages': {'1': 71, 'X': 17, '2': 12},
                },
              },
            },
            '2026-08-03': {
              'bySource': {
                'k1': {
                  'percentages': {'1': 72, 'X': 16, '2': 12},
                },
              },
            },
            // gelecek gün: BOŞ nesne (kaynak böyle gönderiyor)
            '2026-08-04': <String, Object?>{},
          },
        },
      ],
    };

    testWidgets('bugünün oynanma yüzdesi maçın YANINDA, gün adıyla yazar', (
      t,
    ) async {
      await radar5(t, {'/api/radar/daily-played': gunlukOynanma});
      // Gün adı KISALTILIR: satırda dar alan var. Pazartesi → "Pzt".
      expect(metin('Pzt'), findsWidgets);
      // Yüzdeler ayrı kutularda; harf (1/X/2) kutunun dışında.
      expect(metin('%72'), findsWidgets);
      expect(metin('%16'), findsWidgets);
      expect(metin('%12'), findsWidgets);
      // Kaynak yalnız renkli noktayla görünür; adı hiçbir yerde geçmez.
      expect(find.byKey(const Key('radar5-bugun-nokta-k1')), findsWidgets);
    });

    testWidgets('GELECEK günün boş hücresi "bugün" sanılmaz', (t) async {
      // Doğrulanmış hata: boş nesne "veri var" sayılıp gelecek gün
      // seçiliyordu. Salı'nın yüzdesi olmadığı için Pazartesi kalmalı.
      await radar5(t, {'/api/radar/daily-played': gunlukOynanma});
      expect(metin('Pzt'), findsWidgets);
      expect(metin('Sal'), findsNothing);
      expect(metin('%72'), findsWidgets);
    });

    testWidgets('Pazar ile Pazartesi KISALTMADA karışmaz', (t) async {
      // "Paz" ilk üç harf kesmesi ikisini de aynı gösterirdi; açık eşleme var.
      await radar5(t, {
        '/api/radar/daily-played': {
          ...gunlukOynanma,
          'days': [
            {
              'date': '2026-08-02',
              'weekday': 'Pazar',
              'label': 'Pazar 02.08',
              'future': false,
            },
          ],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-02': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 71, 'X': 17, '2': 12},
                    },
                  },
                },
              },
            },
          ],
        },
      });
      expect(metin('Paz'), findsWidgets);
      expect(metin('Pzt'), findsNothing);
    });

    testWidgets('günlük oynanma verisi YOKSA satır hiç çizilmez (uydurma '
        'yüzde yok)', (t) async {
      await radar5(t, {
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [],
          'matches': [],
          'sources': [],
        },
      });
      expect(find.byKey(const Key('radar5-bugun-nokta-k1')), findsNothing);
    });

    testWidgets('liste KAPALI başlar — maçlar kendiliğinden çizilmez', (
      t,
    ) async {
      await radar5(t);
      // Satırlar duruyor (olumlu karşılık)…
      expect(metinIceren('Geçmiş 1. sıra'), findsWidgets);
      // …ama geçmiş maçlar yok.
      expect(metinIceren('Club Brugge'), findsNothing);
      expect(metinIceren('52. Hafta'), findsNothing);
    });

    testWidgets('karşılaşmaya dokununca o sıranın maçları yeniden eskiye '
        'listelenir', (t) async {
      await radar5(t);
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      // DÜZEN: hafta maçın BAŞINDA, skor iki takımın ORTASINDA — karşılaşma
      // hücresi TEK zengin metindir; hafta o metnin İÇİNDE aranır.
      expect(metinIceren('Club Brugge 1-1 Union SG'), findsOneWidget);
      // Sıra yeniden eskiye: 52 → 51 → 50 …
      expect(metinIceren('52. Hafta'), findsOneWidget);
      expect(metinIceren('51. Hafta'), findsOneWidget);
      // Doğru uç, doğru sıra ile çağrıldı.
      expect(_tasiyici.sayi('position-matches?position=1'), greaterThan(0));
    });

    testWidgets('liste SEÇİLİ DÖNEMLE sınırlanır (Son 5 Hafta → 5 maç)', (
      t,
    ) async {
      await radar5(t);
      // Çip artık YALNIZ dönem adıdır.
      await t.tap(metin('Son 5 Hafta'), warnIfMissed: false);
      await _tur(t);
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      // İlk 5 maç görünür…
      expect(metinIceren('48. Hafta'), findsOneWidget);
      // …6. ve 7. görünmez: yüzde 5 haftadan hesaplandı, liste de 5 hafta.
      expect(metinIceren('47. Hafta'), findsNothing);
      expect(metinIceren('46. Hafta'), findsNothing);
      // Kapsam notu ⓘ arkasında durur — kullanıcı gibi açıp okunur.
      await kapsamAc(t);
      expect(metinIceren('Son 5 Hafta · 5 maç'), findsOneWidget);
    });

    testWidgets('tekrar dokununca kapanır', (t) async {
      await radar5(t);
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      expect(metinIceren('52. Hafta'), findsOneWidget);
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      expect(metinIceren('52. Hafta'), findsNothing);
    });

    testWidgets('sıra için geçmiş sonuç YOKSA uydurma satır çizilmez', (
      t,
    ) async {
      await radar5(t, {
        '/api/radar/position-matches': {
          'hasData': false,
          'position': 1,
          'count': 0,
          'matches': [],
        },
      });
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      expect(metinIceren('doğrulanmış geçmiş sonuç yok'), findsOneWidget);
    });

    // MAÇIN ALTINDA O HAFTANIN OYNANMA YÜZDESİ. Arşiv 51. haftada başladığı
    // için eski maçlarda veri YOKTUR ve o satırlarda hiçbir şey çizilmemeli.
    Map<String, Object?> oynanmali() => {
      ...maclarFikstur,
      'playedCount': 2,
      'matches': [
        for (final (i, m) in (maclarFikstur['matches'] as List).indexed)
          {
            ...(m as Map),
            'played': i == 0
                ? {
                    'gun': '2026-07-31',
                    'pct': {'1': 44, 'X': 30, '2': 26},
                    'favori': '1',
                    'favoriPct': 44,
                  }
                : i == 1
                ? {
                    'gun': '2026-07-24',
                    'pct': {'1': 51, 'X': 29, '2': 20},
                    'favori': '1',
                    'favoriPct': 51,
                  }
                : null,
          },
      ],
    };

    // TABLO DÜZENİ — KARŞILAŞMA | 1 · X · 2 (oynanma) | SONUÇ. Başlık BİR KEZ.
    testWidgets('oynanma yüzdeleri sütunlarda, sağında sonuç', (t) async {
      await radar5(t, {'/api/radar/position-matches': oynanmali()});
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      expect(metinIceren('Club Brugge 1-1 Union SG'), findsOneWidget);
      // Başlık satırı bir kez — her maçta tekrarlanmıyor.
      expect(metin('KARŞILAŞMA'), findsOneWidget);
      expect(metin('SON'), findsOneWidget);
      // 52. haftanın hücreleri…
      expect(metin('%44'), findsWidgets);
      expect(metin('%30'), findsWidgets);
      expect(metin('%26'), findsWidgets);
      // …51. haftanınkiler de.
      expect(metin('%29'), findsWidgets);
      expect(metinIceren('52. Hafta'), findsOneWidget);
    });

    testWidgets('veri OLMAYAN maçta %0 YAZILMAZ — hücreye tire konur', (
      t,
    ) async {
      await radar5(t, {'/api/radar/position-matches': oynanmali()});
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      expect(metinIceren('50. Hafta'), findsOneWidget);
      // 7 maçın 5'i kayıtsız → 5×3 = 15 tire. Sıfır UYDURULMADI.
      expect(
        ekranMetinleri(t).where((s) => RegExp(r'%0\b').hasMatch(s)),
        isEmpty,
      );
      expect(metin('–').evaluate().length, 15);
      // Eksiklik alt bilgide de sayıyla söylenir (kapsam ⓘ'si içinde).
      await kapsamAc(t);
      expect(metinIceren('5 maçta oynanma kaydı yok'), findsOneWidget);
    });

    testWidgets('hiç oynanma verisi yoksa tablo yine çizilir, hücreler tire', (
      t,
    ) async {
      await radar5(t, {
        '/api/radar/position-matches': {...maclarFikstur, 'playedCount': 0},
      });
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      expect(metinIceren('Club Brugge 1-1 Union SG'), findsOneWidget);
      expect(metin('–').evaluate().length, 21); // 7 maç × 3 sütun
    });

    // LİSTE KISALDI — 50. Hafta ve öncesi backend'de kesiliyor. Ekran,
    // listenin NEREDE başladığını ve yüzdenin ondan bağımsız hesaplandığını
    // söylemek ZORUNDA.
    testWidgets('kısalan listenin başlangıcı ve yüzdenin kapsamı yazılır', (
      t,
    ) async {
      await radar5(t, {
        '/api/radar/position-matches': {
          'hasData': true,
          'position': 1,
          'count': 2,
          'playedCount': 2,
          'matches': [
            {
              'roundId': '1526',
              'week': '52. Hafta',
              'home': 'Club Brugge',
              'away': 'Union SG',
              'score': '1-1',
              'result': 'X',
              'played': {
                'gun': '2026-07-31',
                'pct': {'1': 44, 'X': 30, '2': 26},
              },
            },
            {
              'roundId': '1525',
              'week': '51. Hafta',
              'home': 'AGF Aarhus',
              'away': 'Brondby',
              'score': '1-1',
              'result': 'X',
              'played': {
                'gun': '2026-07-24',
                'pct': {'1': 51, 'X': 29, '2': 20},
              },
            },
          ],
        },
      });
      await t.tap(metin('Ev Takımı – Dep Takımı').first, warnIfMissed: false);
      await _tur(t);
      expect(metinIceren('Club Brugge 1-1 Union SG'), findsOneWidget);
      // Kapsam notu ⓘ arkasında durur — açılır ve okunur.
      await kapsamAc(t);
      // Listenin en eskisi 51. Hafta → başlangıç olarak O yazılır.
      expect(metinIceren("liste 51. Hafta'ndan başlar"), findsOneWidget);
      expect(metinIceren('yüzde tüm haftalardan hesaplanır'), findsOneWidget);
      // Kesilen haftalar gerçekten yok.
      expect(metinIceren('50. Hafta'), findsNothing);
      expect(metinIceren('49. Hafta'), findsNothing);
    });
  });

  // FİLTRE ŞERİDİ YAPIŞIK — kaynakta stickyHeaderIndices prop'uydu; burada
  // gerçek davranış ölçülür.
  group('Radar 5 filtre şeridi yapışık kalır', () {
    testWidgets('Radar 5 açıkken liste kaysa da dönem çipleri EKRANDA kalır', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'matches': [for (var i = 1; i <= 15; i++) kMac(i)],
        },
        '/api/radar/position-dna': {
          'hasData': true,
          'dna': {
            'positions': [
              for (var i = 1; i <= 15; i++)
                {
                  'position': i,
                  'windows': {
                    'allTime': {
                      'sample': 30,
                      'pct': {'1': 50, 'X': 30, '2': 20},
                    },
                  },
                },
            ],
          },
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Bülten DNA');
      expect(metin('Tüm Haftalar'), findsOneWidget);

      // Listeyi sertçe kaydır — şerit yapışık olduğu için DÜŞMEZ.
      await t.fling(find.byType(ListView).last, const Offset(0, -600), 1200);
      await _tur(t, 10);
      expect(metin('Tüm Haftalar'), findsOneWidget);
    });

    testWidgets('Master sekmesinde dönem şeridi YOK (başlık zaten '
        'çizilmiyor)', (t) async {
      await ekraniAc(t);
      expect(evTakimiSayisi(t), 3);
      expect(metin('Tüm Haftalar'), findsNothing);
    });

    // Radar 4 başlığı UZUN bir bilgi panelidir — dondurulursa ekranın yarısını
    // kaplar. Yapışıklık yalnız Radar 5'e aittir.
    testWidgets('Radar 4 paneli yapışık DEĞİL — listeyle birlikte kayar', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'matches': [for (var i = 1; i <= 15; i++) kMac(i)],
        },
        '/api/radar/daily-odds': {
          'roundId': 1600,
          'days': [kGun],
          'matches': [
            for (var i = 1; i <= 15; i++)
              {'no': i, 'cells': <String, Object?>{}},
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oran Takibi');
      // Olumlu karşılık: Radar 4 paneli gerçekten çizildi…
      expect(metinIceren('Oran Takibi · Günlük'), findsWidgets);
      // …ama yapışık değil: liste kayınca panel ekrandan çıkar.
      await t.fling(find.byType(ListView).last, const Offset(0, -900), 1500);
      await _tur(t, 10);
      expect(metinIceren('Oran Takibi · Günlük'), findsNothing);
    });
  });

  // SADE BAŞLIK — yeşil saha paneli ve alt başlık kaldırıldı.
  testWidgets('başlıkta yalnız hangi haftaya bakıldığı yazar', (t) async {
    await ekraniAc(t);
    expect(metin('1. Hafta · Radar Merkezi'), findsOneWidget);
    // Alt başlık kaldırıldı.
    expect(metinIceren('açıklanabilir karar desteği'), findsNothing);
    expect(metinIceren('Sürpriz radarı arşivi'), findsNothing);
  });

  testWidgets('mühür güvencesi başlığın altında KALIYOR', (t) async {
    // Teknik bloklar kalktı ama bu bir teknik gösterge değil: geçmiş haftaya
    // bakan kullanıcıya "sonradan değişmez" sözü verilir.
    _mockUclar({
      ...kVarsayilan(),
      '/api/radar/current': {
        ...kGuncel,
        'current': false,
        'sealed': true,
        'sealedAt': '2026-08-02T16:55:00Z',
        'verificationHash': 'abcdef0123456789',
      },
    });
    await ekraniAc(t);
    expect(metinIceren('Mühürlü analiz'), findsOneWidget);
    expect(
      metinIceren('sonuçlar gelse de bu görüntü değişmez'),
      findsOneWidget,
    );
  });

  // SEZON GEÇİŞİ — 53. haftadan sonra yeni sezon 1. haftayla başlar.
  group('Sezon geçişi (yeni sezon 1. hafta)', () {
    testWidgets('SEZON seçici çıkar, hafta listesi seçili sezona göre '
        'süzülür', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'roundId': 1528,
          'round': '1. Hafta',
          'year': 2027,
        },
        '/api/radar/weeks': {
          'weeks': [
            {
              'roundId': 1528,
              'round': '1. Hafta',
              'year': 2027,
              'current': true,
              'archived': false,
              'locked': false,
              'sealed': false,
            },
            {
              'roundId': 1527,
              'round': '53. Hafta',
              'year': 2026,
              'current': false,
              'archived': true,
              'locked': true,
              'sealed': true,
            },
          ],
          'currentRoundId': 1528,
        },
      });
      await ekraniAc(t);
      // Bakılan hafta yeni sezonun 1. haftası → sezon ona uyar.
      expect(metin('2026/2027 Sezonu'), findsOneWidget);
      expect(metin('1. Hafta · Güncel'), findsOneWidget);
      // Hafta listesi KAPALI başlar; eski sezonun haftası görünmez.
      expect(metin('53. Hafta'), findsNothing);

      // Eski sezona geç: liste onun haftalarını gösterir, yenininki düşer.
      await t.tap(metin('2026/2027 Sezonu'), warnIfMissed: false);
      await _tur(t, 5);
      await t.tap(metin('2025/2026 Sezonu'), warnIfMissed: false);
      await _tur(t, 5);
      expect(metin('53. Hafta'), findsOneWidget);
      expect(metin('1. Hafta'), findsNothing);
    });
  });

  // HAFTA SEÇİCİ — resmî listedeki gezinti: [sezon ▼] [hafta ▼].
  group('Hafta seçici (sezon + hafta açılır listeleri)', () {
    final cokHafta = {
      'weeks': [
        {
          'roundId': 1527,
          'round': '53. Hafta',
          'year': 2026,
          'current': true,
          'archived': false,
          'locked': false,
          'sealed': false,
        },
        {
          'roundId': 1526,
          'round': '52. Hafta',
          'year': 2026,
          'current': false,
          'archived': true,
          'locked': true,
          'sealed': true,
        },
        {
          'roundId': 1525,
          'round': '51. Hafta',
          'year': 2026,
          'current': false,
          'archived': true,
          'locked': true,
          'sealed': true,
        },
        {
          'roundId': 1521,
          'round': '49. Hafta',
          'year': 2026,
          'current': false,
          'archived': true,
          'locked': true,
          'sealed': true,
        },
      ],
      'currentRoundId': 1527,
    };
    final guncel53 = {
      ...kGuncel,
      'roundId': 1527,
      'round': '53. Hafta',
      'year': 2026,
    };

    Future<void> kur(
      WidgetTester t, [
      Map<String, Object?> uclar = const {},
    ]) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': guncel53,
        '/api/radar/weeks': cokHafta,
        ...uclar,
      });
      await ekraniAc(t);
      expect(metin('53. Hafta · Güncel'), findsOneWidget);
    }

    String okMetni(WidgetTester t, String key) =>
        (t.widget<Text>(find.byKey(Key(key)))).data ?? '';

    testWidgets('haftalar çip olarak DİZİLMEZ; liste kapalı başlar', (t) async {
      await kur(t);
      // Sezon düğmesi, hafta düğmesi bakılan haftayı yazar.
      expect(metin('2025/2026 Sezonu'), findsOneWidget);
      // Öbür haftalar ekranda YOK.
      expect(metin('52. Hafta'), findsNothing);
      expect(metin('49. Hafta'), findsNothing);
    });

    testWidgets('hafta düğmesine basınca TÜM haftalar (güncel dahil) '
        'yeniden eskiye', (t) async {
      await kur(t);
      await t.tap(metin('53. Hafta · Güncel'), warnIfMissed: false);
      await _tur(t, 5);
      // Güncel hafta da listenin İÇİNDE — resmî listedeki gibi.
      expect(metin('53. Hafta'), findsOneWidget);
      expect(metin('52. Hafta'), findsOneWidget);
      expect(metin('49. Hafta'), findsOneWidget);
      expect(metin('🔏').evaluate().length, 3);
      expect(metin('Güncel'), findsOneWidget);
      expect(okMetni(t, 'hafta-ok'), '▲');
    });

    testWidgets('listeden hafta seçince o hafta yüklenir ve liste kapanır', (
      t,
    ) async {
      await kur(t, {
        '/api/radar/1526': {
          ...kGuncel,
          'roundId': 1526,
          'round': '52. Hafta',
          'current': false,
          'sealed': true,
          'sealedAt': '2026-07-28T17:00:00Z',
          'verificationHash': 'feedbeef01',
        },
      });
      await t.tap(metin('53. Hafta · Güncel'), warnIfMissed: false);
      await _tur(t, 5);
      await t.tap(metin('52. Hafta'), warnIfMissed: false);
      await _tur(t);
      expect(metinIceren('Mühürlü analiz'), findsOneWidget);
      expect(_tasiyici.sayi('/api/radar/1526'), greaterThan(0));
      // Liste kapandı; düğme artık seçili haftayı yazıyor ("· Güncel" düştü).
      expect(okMetni(t, 'hafta-ok'), '▼');
      expect(metin('49. Hafta'), findsNothing);
      expect(metin('53. Hafta · Güncel'), findsNothing);
    });

    testWidgets('TEK sezonda bile sezon AÇILIR görünür (dokunulabilir olduğu '
        'belli)', (t) async {
      await kur(t);
      // Önce düz yazıydı ve "açılır olduğu anlaşılmıyor" geri bildirimi geldi.
      expect(okMetni(t, 'sezon-ok'), '▼');
      expect(metin('2025/2026 Sezonu'), findsOneWidget);
      // Açılınca o tek sezon listelenir; ok yön değiştirir.
      await t.tap(metin('2025/2026 Sezonu'), warnIfMissed: false);
      await _tur(t, 5);
      expect(okMetni(t, 'sezon-ok'), '▲');
    });

    // LİSTE KENDİ DÜĞMESİNİN ALTINDA (kullanıcı bildirimi, 2026-08-10:
    // "geçmiş haftalar solda çıkıyor" — sezon değiştirince açılan hafta
    // listesi sol kenara, sezonun altına iniyordu).
    testWidgets('hafta listesi KENDİ düğmesinin altında açılır, solda değil', (
      t,
    ) async {
      await ekraniAc(t);
      await t.tap(find.byKey(const Key('hafta-ok')), warnIfMissed: false);
      await _tur(t);
      final dugmeX = t.getTopLeft(metin('1. Hafta · Güncel').first).dx;
      final ogeX = t.getTopLeft(metin('1. Hafta').first).dx;
      expect(
        (ogeX - dugmeX).abs(),
        lessThan(40),
        reason:
            'liste ögesi hafta düğmesiyle aynı hizada olmalı — '
            'sol kenara (sezonun altına) inmemeli',
      );
    });

    // DIŞARI TIKLAYINCA KAPANIR (2026-08-10 profesyonellik turu): açılır
    // liste yalnız düğmeyle değil, ekranın başka yerine dokununca da kapanır.
    testWidgets('açık hafta listesi dışarı dokununca kapanır', (t) async {
      await ekraniAc(t);
      await t.tap(find.byKey(const Key('hafta-ok')), warnIfMissed: false);
      await _tur(t);
      expect(metin('1. Hafta'), findsOneWidget, reason: 'liste açık');
      // Listenin DIŞINA (maç kartına) dokun.
      await t.tap(metinIceren('Ev Takımı').first, warnIfMissed: false);
      await _tur(t);
      expect(metin('1. Hafta'), findsNothing, reason: 'liste kapandı');
    });

    testWidgets('oklar CİHAZDA GÖRÜNEN karakterlerle çizilir (⌄/⌃ değil)', (
      t,
    ) async {
      // ⌄ (U+2304) ve ⌃ (U+2303) birçok yazı tipinde YOK — cihazda boş
      // çıkıyordu. Yalnız yaygın desteklenen üçgenler kabul edilir.
      await kur(t);
      for (final id in ['sezon-ok', 'hafta-ok']) {
        expect(['▼', '▲'], contains(okMetni(t, id)));
      }
    });
  });

  // SEKME KORUMASI — "Radar 3'e geldiğimde yenileyince Master'a geçiyor"
  // şikâyetinin regresyonu.
  group("Sekme koruması (yenilemede Master'a atmaz)", () {
    testWidgets('AYNI hafta yeniden yüklenince açık radar KORUNUR', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [],
          'matches': [],
          'sources': [],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      expect(metinIceren('Oynanma DNA · Günlük'), findsWidgets);

      // Yenilemeyi tetikle ve YANITIN GELMESİNİ BEKLE (kaynak test de
      // onRefresh'i doğrudan çağırıyordu — jest, RefreshControl prop'u).
      final onceki = _tasiyici.sayi('/api/radar/current');
      final yenileme = t
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      await _tur(t, 30); // sahte saat pompalanmadan await KİLİTLENİR
      await yenileme;
      expect(_tasiyici.sayi('/api/radar/current'), greaterThan(onceki));
      // Radar 3 paneli hâlâ ekranda — Master'a atmadı.
      expect(metinIceren('Oynanma DNA · Günlük'), findsWidgets);
    });

    testWidgets('HAFTA DEĞİŞİNCE de açık radar KORUNUR (53 → 52, Radar 5 '
        'açık kalır)', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {
          ...kGuncel,
          'roundId': 1600,
          'round': '53. Hafta',
        },
        '/api/radar/weeks': {
          'weeks': [
            {
              'roundId': 1600,
              'round': '53. Hafta',
              'year': 2026,
              'current': true,
            },
            {
              'roundId': 1599,
              'round': '52. Hafta',
              'year': 2026,
              'sealed': true,
              'locked': true,
            },
          ],
          'currentRoundId': 1600,
        },
        '/api/radar/1599': {
          ...kGuncel,
          'roundId': 1599,
          'round': '52. Hafta',
          'current': false,
        },
        '/api/radar/position-dna': {
          'hasData': true,
          'dna': {
            'positions': [
              {
                'position': 1,
                'windows': {
                  'allTime': {
                    'sample': 30,
                    'pct': {'1': 50, 'X': 30, '2': 20},
                  },
                },
              },
            ],
          },
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Bülten DNA');
      expect(metin('Tüm Haftalar'), findsOneWidget);

      // 53 → 52. haftaya geç.
      await t.tap(metin('53. Hafta · Güncel'), warnIfMissed: false);
      await _tur(t, 5);
      await t.tap(metin('52. Hafta'), warnIfMissed: false);
      await _tur(t);

      // Radar 5 AÇIK KALDI — Master listesine dönmedi.
      expect(metin('Tüm Haftalar'), findsOneWidget);
      expect(metin('52. Hafta'), findsOneWidget);
    });
  });

  // BAHİS SİTESİ ADI EKRANDA GEÇMEZ — asıl koruma (render seviyesinde).
  group('Bahis sitesi adı ekranda geçmez', () {
    final markalar = RegExp(
      'nesine|bilyoner|misli|oley|iddaa|i̇ddaa',
      caseSensitive: false,
    );

    testWidgets('Radar 3 ekranı gerçek kaynak verisiyle çizilirken marka adı '
        'GÖRÜNMEZ', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['k1', 'k2', 'k3'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-01': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 62, 'X': 21, '2': 17},
                    },
                    'k2': {
                      'percentages': {'1': 58, 'X': 24, '2': 18},
                    },
                    'k3': {
                      'percentages': {'1': 60, 'X': 22, '2': 18},
                    },
                  },
                },
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      expect(find.byKey(const Key('kaynak-nokta-k1')), findsWidgets);

      // Çizilen ağacın TÜM metinleri taranır — hiçbirinde marka adı olamaz.
      expect(ekranMetinleri(t).where(markalar.hasMatch), isEmpty);
      // Olumlu karşılık: üç kaynak da NOKTA olarak gerçekten çizilmiş.
      for (final k in ['k1', 'k2', 'k3']) {
        expect(find.byKey(Key('kaynak-nokta-$k')), findsWidgets);
      }
    });

    testWidgets('kaynak noktası erişilebilirlik etiketi de RENK adıdır '
        '(marka değil)', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['k1'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-01': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 62, 'X': 21, '2': 17},
                    },
                  },
                },
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      final semantikTutamaci = t.ensureSemantics();
      expect(find.bySemanticsLabel(RegExp('Sarı kaynak')), findsWidgets);
      expect(find.bySemanticsLabel(markalar), findsNothing);
      semantikTutamaci.dispose();
    });
  });

  // ESKİ SUNUCU KORUMASI — yayına alınmamış arka uç HAM KİMLİK gönderirse
  // bile ekranda marka adı ÇIKMAMALI. (Gerçek olay: "PROVIDER_NAMES[s] || s"
  // tanınmayan anahtarı olduğu gibi basmıştı.)
  group('Eski sunucu ham kimlik gönderse bile marka adı ekranda çıkmaz', () {
    final markalar = RegExp(
      'nesine|bilyoner|misli|oley|iddaa',
      caseSensitive: false,
    );

    testWidgets('HAM KİMLİKLİ yanıtta bile hiçbir metinde marka geçmez; '
        'renkler doğru çıkar', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        // Eski sunucu yanıtı: kod değil HAM KİMLİK.
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['nesine', 'misli'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-01': {
                  'bySource': {
                    'nesine': {
                      'percentages': {'1': 68, 'X': 12, '2': 20},
                    },
                    'misli': {
                      'percentages': {'1': 94, 'X': 1, '2': 5},
                    },
                  },
                },
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      expect(find.byKey(const Key('kaynak-nokta-k1')), findsWidgets);

      // Çizilen ağacın TÜM metinleri: marka adı OLAMAZ.
      expect(ekranMetinleri(t).where(markalar.hasMatch), isEmpty);
      // Ham kimlik de renk koduna çevrilir (gri "bilinmiyor"a düşmez).
      expect(find.byKey(const Key('kaynak-nokta-k2')), findsWidgets);
      // Nokta doğru rengi/etiketi alır: sarı kaynak k1'dir.
      final semantikTutamaci = t.ensureSemantics();
      expect(find.bySemanticsLabel(RegExp('Sarı kaynak')), findsWidgets);
      semantikTutamaci.dispose();
    });

    testWidgets('TAMAMEN BİLİNMEYEN kaynak anahtarı da ham basılmaz', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['gizli-site-x'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-01': {
                  'bySource': {
                    'gizli-site-x': {
                      'percentages': {'1': 50, 'X': 30, '2': 20},
                    },
                  },
                },
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      // Anahtarın kendisi ASLA ekrana yazılmaz; nötr noktaya düşer.
      expect(metinIceren('gizli-site-x'), findsNothing);
      expect(find.byKey(const Key('kaynak-nokta-k0')), findsWidgets);
    });
  });

  // KAYNAK HİÇ ADLANDIRILMAZ — ne marka ne renk adı. Yalnız renkli nokta.
  // Kullanıcı kararı: "sarı kaynak vs de yazma".
  group('Kaynak ekranda hiç adlandırılmaz (yalnız renk)', () {
    final adlar = RegExp(
      'nesine|bilyoner|misli|oley|iddaa|sarı kaynak|turuncu kaynak|'
      'yeşil kaynak|mor kaynak|mavi kaynak',
      caseSensitive: false,
    );

    testWidgets('üç kaynaklı gerçek veride hiçbir metin kaynağı '
        'ADLANDIRMAZ', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['k1', 'k2', 'k3'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-01': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 68, 'X': 12, '2': 20},
                    },
                    'k2': {
                      'percentages': {'1': 94, 'X': 1, '2': 5},
                    },
                    'k3': {
                      'percentages': {'1': 70, 'X': 15, '2': 15},
                    },
                  },
                },
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      expect(find.byKey(const Key('kaynak-nokta-k1')), findsWidgets);

      expect(ekranMetinleri(t).where(adlar.hasMatch), isEmpty);
      // Olumlu karşılık: üç kaynak da NOKTA olarak gerçekten çizilmiş.
      for (final k in ['k1', 'k2', 'k3']) {
        expect(find.byKey(Key('kaynak-nokta-$k')), findsWidgets);
      }
      // Yüzdeler yine görünür — veri gizlenmiyor, yalnız ad yok.
      expect(metinIceren('1 %68'), findsWidgets);
    });

    testWidgets('erişilebilirlik etiketi renk adını taşır (ekranda görünmez, '
        'okuyucu için)', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/daily-played': {
          'roundId': 1600,
          'days': [kOncekiGun, kGun],
          'sources': ['k1'],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-01': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 50, 'X': 30, '2': 20},
                    },
                  },
                },
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Oynanma DNA');
      // Etiket VAR (nokta ekran okuyucuda adsız kalmamalı)…
      final semantikTutamaci = t.ensureSemantics();
      expect(find.bySemanticsLabel(RegExp('Sarı kaynak')), findsWidgets);
      semantikTutamaci.dispose();
      // …ama GÖRÜNEN metinlerin arasında değil.
      expect(ekranMetinleri(t).where(adlar.hasMatch), isEmpty);
    });
  });

  // RADAR 5 YAKINLIK FİLTRESİ — spec: kaynak depo tasks/todo.md (2026-08-08).
  // KAYNAKTA (RN) HENÜZ YOK: bu testler çeviri değil, spec'ten yazıldı.
  // İki katman: üst = mod (Oynanma % / Oran), alt = yakınlık + MAÇ penceresi.
  group('Radar 5 yakınlık filtresi (oynanma + oran)', () {
    // Backend'in filtreli yanıt şekli (routes/radar.js filtre özeti):
    // 1. sıra normal, 2. sıranın GÜNCEL verisi yok (filtre uygulanamaz),
    // 3. sıra normal. Pencereler MAÇ birimindedir.
    final dnaFiltreli = {
      'hasData': true,
      'filtre': {
        'mod': 'oynanma',
        'tol': 5,
        'positions': {
          '1': {
            'guncel': {'1': 60, 'X': 25, '2': 15},
            'aday': 6,
            'verili': 5,
            'uyan': 4,
          },
          '2': {'guncel': null, 'aday': 6, 'verili': 0, 'uyan': 0},
          '3': {
            'guncel': {'1': 50, 'X': 30, '2': 20},
            'aday': 6,
            'verili': 5,
            'uyan': 3,
          },
        },
      },
      'dna': {
        'positions': [
          {
            'position': 1,
            'windows': {
              'last5': {
                'sample': 4,
                'pct': {'1': 50, 'X': 50, '2': 0},
              },
              'last10': {
                'sample': 4,
                'pct': {'1': 75, 'X': 25, '2': 0},
              },
              'allTime': {
                'sample': 6,
                'pct': {'1': 40, 'X': 60, '2': 0},
              },
            },
          },
          {'position': 2, 'windows': <String, Object?>{}},
          {
            'position': 3,
            'windows': {
              'last5': {
                'sample': 3,
                'pct': {'1': 100, 'X': 0, '2': 0},
              },
            },
          },
        ],
      },
    };
    final filtreliMaclar = {
      'hasData': true,
      'position': 1,
      'count': 6,
      'filtre': {'mod': 'oynanma', 'tol': 5, 'aday': 6, 'verili': 5, 'uyan': 4},
      'matches': [
        for (var i = 0; i < 6; i++)
          {
            'roundId': '${1526 - i}',
            'week': '${52 - i}. Hafta',
            'home': 'Ev$i',
            'away': 'Dep$i',
            'score': '1-0',
            'result': '1',
          },
      ],
    };

    Future<void> filtreliRadar5(WidgetTester t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/position-dna': dnaFiltreli,
        '/api/radar/position-matches': filtreliMaclar,
      });
      await ekraniAc(t);
      await sekme(t, 'Bülten DNA');
    }

    testWidgets('mod çipleri dönemlerin YANINDA; dokununca alt katman açılır '
        've istek varsayılan toleransla gider', (t) async {
      await filtreliRadar5(t);
      expect(metin('Oynanma Yüzdesi'), findsOneWidget);
      expect(metin('Oran'), findsOneWidget);
      // Filtre kapalıyken alt katman yok, istek filtresiz.
      expect(metin('Yakınlık:'), findsNothing);
      expect(_tasiyici.sayi('oynanmaTol'), 0);

      await t.tap(metin('Oynanma Yüzdesi'), warnIfMissed: false);
      await _tur(t);
      expect(metin('Yakınlık:'), findsOneWidget);
      expect(metin('Birebir'), findsOneWidget);
      for (final e in ['±3', '±5', '±10']) {
        expect(metin(e), findsOneWidget);
      }
      // ALT KATMAN BİRİMİ MAÇTIR — etiketler "maç" der, "hafta" değil.
      // 'Tümü' = süzgece uyan maçların tamamı (kullanıcı isteği, 2026-08-10).
      for (final e in ['Son 5 maç', 'Son 10 maç', 'Son 15 maç', 'Tümü']) {
        expect(metin(e), findsOneWidget);
      }
      // Mod seçilince süzgeç TEMİZ başlar: Birebir (tol=0) + Tümü.
      expect(_tasiyici.sayi('oynanmaTol=0'), greaterThan(0));
    });

    testWidgets('tolerans değişince YENİ istek atılır (bayat sonuç kalmaz)', (
      t,
    ) async {
      await filtreliRadar5(t);
      await t.tap(metin('Oynanma Yüzdesi'), warnIfMissed: false);
      await _tur(t);
      expect(_tasiyici.sayi('oynanmaTol=10'), 0);
      await t.tap(metin('±10'), warnIfMissed: false);
      await _tur(t);
      expect(_tasiyici.sayi('oynanmaTol=10'), greaterThan(0));

      // MODA YENİDEN GİRİNCE Birebir + Tümü'ye döner — ±10 sessizce taşınmaz
      // (kullanıcı kararı, 2026-08-10).
      final onceki = _tasiyici.sayi('oynanmaTol=0');
      await t.tap(metin('Oynanma Yüzdesi'), warnIfMissed: false);
      await _tur(t);
      expect(
        _tasiyici.sayi('oynanmaTol=0'),
        greaterThan(onceki),
        reason: 'moda yeniden girişte Birebir istenmeli',
      );
    });

    testWidgets(
      'Oran modu kendi adımlarıyla gelir; oranTol parametresi gider',
      (t) async {
        await filtreliRadar5(t);
        await t.tap(metin('Oran'), warnIfMissed: false);
        await _tur(t);
        // Oran adımları DAR ve birebir kabul eder (kullanıcı kararı
        // 2026-08-10: birebir / ±0.02 / ±0.03).
        for (final e in ['Birebir', '±0.02', '±0.03']) {
          expect(metin(e), findsOneWidget);
        }
        // Varsayılan Birebir: istek oranTol=0 ile gider, ondalıklı adım
        // istenmemiş olmalı ('oranTol=0.' hiçbir istekte geçmez).
        expect(_tasiyici.sayi('oranTol=0'), greaterThan(0));
        expect(_tasiyici.sayi('oranTol=0.'), 0);
        await t.tap(metin('±0.03'), warnIfMissed: false);
        await _tur(t);
        expect(_tasiyici.sayi('oranTol=0.03'), greaterThan(0));
      },
    );

    testWidgets('üstteki dağılım SEÇİLİ MAÇ PENCERESİNDEN okunur', (t) async {
      await filtreliRadar5(t);
      await t.tap(metin('Oynanma Yüzdesi'), warnIfMissed: false);
      await _tur(t);
      // Varsayılan pencere Tümü → allTime penceresi (%40).
      expect(metinIceren('%40'), findsWidgets);
      await t.tap(metin('Son 5 maç'), warnIfMissed: false);
      await _tur(t);
      // last5 penceresi (%50) — pencere değişimi dağılımı değiştirir.
      expect(metinIceren('%50'), findsWidgets);
      await t.tap(metin('Son 10 maç'), warnIfMissed: false);
      await _tur(t);
      // last10 penceresi (%75) — birim MAÇ: süzgece uyan son 10 maç.
      expect(metinIceren('%75'), findsWidgets);
    });

    testWidgets('dürüstlük satırı: verisi bilinen maç sayısı ve güncel verisi '
        'olmayan sıralar AÇIKÇA yazar', (t) async {
      await filtreliRadar5(t);
      await t.tap(metin('Oynanma Yüzdesi'), warnIfMissed: false);
      await _tur(t);
      expect(
        metinIceren('Oynanması bilinen geçmiş maç: 10/18 · süzgeci geçen: 7.'),
        findsOneWidget,
      );
      expect(metinIceren('1 sıranın güncel verisi yok'), findsOneWidget);
      // Güncel verisi olmayan 2. sıranın satırında sebep DOĞRU yazar:
      // "geçmiş sonuç yok" değil, "güncel veri yok".
      expect(
        metin('Bu maçın güncel oynanma verisi yok — filtre uygulanamadı.'),
        findsOneWidget,
      );
    });

    testWidgets('satır açılımının kapsam notu süzgeci ve filtreli kapanış '
        'cümlesini söyler', (t) async {
      await filtreliRadar5(t);
      await t.tap(metin('Oynanma Yüzdesi'), warnIfMissed: false);
      await _tur(t);
      await t.tap(metinIceren('Ev Takımı').first, warnIfMissed: false);
      await _tur(t);
      await kapsamAc(t);
      expect(metinIceren('Oynanma Birebir · Tümü'), findsWidgets);
      expect(
        metinIceren('yalnız süzgeci geçen maçlardan hesaplanır'),
        findsOneWidget,
      );
    });

    testWidgets('dönem çipine dönünce filtre kapanır', (t) async {
      await filtreliRadar5(t);
      await t.tap(metin('Oynanma Yüzdesi'), warnIfMissed: false);
      await _tur(t);
      expect(metin('Yakınlık:'), findsOneWidget);
      await t.tap(metin('Tüm Haftalar'), warnIfMissed: false);
      await _tur(t);
      expect(metin('Yakınlık:'), findsNothing);
      expect(metin('Son 5 maç'), findsNothing);
    });

    // HATA ile YOKLUK farklı şeylerdir. Yaşandı (2026-08-10): eski backend
    // yeni tolerans adımına 400 dönünce ekran "güncel verisi yok" İDDİA
    // ediyordu — oysa veri vardı, istek başarısızdı.
    testWidgets('süzgeç isteği başarısız olursa yokluk İDDİA EDİLMEZ', (
      t,
    ) async {
      _mockUclar({
        ...kVarsayilan(),
        // position-dna BİLEREK tanımsız → 404 → sağlayıcı hata durumuna düşer.
        '/api/radar/position-matches': filtreliMaclar,
      });
      await ekraniAc(t);
      await sekme(t, 'Bülten DNA');
      await t.tap(metin('Oynanma Yüzdesi'), warnIfMissed: false);
      await _tur(t);
      expect(metin('Süzgeç sonucu alınamadı — tekrar deneyin.'), findsWidgets);
      expect(metinIceren('verisi yok'), findsNothing);
    });

    // ORAN MODUNDA GÜNÜN ORANI (kullanıcı isteği, 2026-08-10): maçın yanındaki
    // şerit oynanma yüzdesi yerine Radar 4'ün günlük oranını gösterir.
    testWidgets('Oran modunda maçın yanında GÜNÜN ORANI görünür; oynanma '
        'şeridi basılmaz', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/position-dna': dnaFiltreli,
        '/api/radar/position-matches': filtreliMaclar,
        '/api/radar/daily-played': {
          'roundId': 1600,
          'sources': ['k1'],
          'days': [
            {'date': '2026-08-03', 'weekday': 'Pazartesi', 'future': false},
          ],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-03': {
                  'bySource': {
                    'k1': {
                      'percentages': {'1': 72, 'X': 16, '2': 12},
                    },
                  },
                },
              },
            },
          ],
        },
        '/api/radar/daily-odds': {
          'roundId': 1600,
          'days': [
            {'date': '2026-08-03', 'weekday': 'Pazartesi', 'future': false},
          ],
          'matches': [
            {
              'no': 1,
              'cells': {
                '2026-08-03': {
                  'odds': {'home': 1.85, 'draw': 3.4, 'away': 4.2},
                },
              },
            },
          ],
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Bülten DNA');
      // Filtre kapalıyken oynanma şeridi var; oran isteği hiç atılmadı.
      expect(metin('%72'), findsWidgets);
      expect(_tasiyici.sayi('daily-odds'), 0);

      await t.tap(metin('Oran'), warnIfMissed: false);
      await _tur(t);
      // Günün gerçek 1/X/2 oranı iki ondalıkla basılır…
      expect(metin('1.85'), findsWidgets);
      expect(metin('3.40'), findsWidgets);
      expect(metin('4.20'), findsWidgets);
      // …oynanma yüzdesi şeridi ise basılmaz: iki birim yan yana gösterilmez.
      expect(metin('%72'), findsNothing);
    });

    testWidgets('MÜHÜRLÜ haftada mod çipleri GÖSTERİLMEZ (filtre canlı hesap '
        'demektir)', (t) async {
      _mockUclar({
        ...kVarsayilan(),
        '/api/radar/current': {...kGuncel, 'sealed': true},
        '/api/radar/position-dna': {
          'hasData': true,
          'sealed': true,
          'dna': {'positions': <Object?>[]},
        },
      });
      await ekraniAc(t);
      await sekme(t, 'Bülten DNA');
      // Dönem çipleri (snapshot'lu mühürlü hafta) durur…
      expect(metin('Tüm Haftalar'), findsOneWidget);
      // …ama filtre modları YOK: mühürlü değer yeniden hesaplanmaz.
      expect(metin('Oynanma Yüzdesi'), findsNothing);
      expect(metin('Oran'), findsNothing);
    });
  });
}

// ─────────────────────────────── Altın kopya ───────────────────────────────
// İlk koşuda gerçek çıktıdan alındı; kasıtlı bir metin değişikliğinde
// güncellenir ve nedeni commit mesajına yazılır.
const List<String> kAltinKopya = <String>[
  '1. Hafta · Radar Merkezi',
  '2025/2026 Sezonu',
  '▼',
  '1. Hafta · Güncel',
  '▼',
  'Master',
  'Birleşik',
  'Radar 1',
  'Rakip Gücü',
  'Radar 2',
  'xG',
  'Radar 3',
  'Oynanma DNA',
  'Radar 4',
  'Oran Takibi',
  'Radar 5',
  'Bülten DNA',
  'Tümü',
  '🟢 Güçlü Aday (3)',
  '🟡 Karışık Sinyal (0)',
  '🔴 Sürpriz Sinyali (0)',
  '⚪ Analiz Hazır Değil (0)',
  // (0)'lar GERÇEK sayıdır: altın fikstürde draw≥30 ya da dep-sürprizi koşulu
  // sağlayan maç yok. Eski sayaç bu çiplere körlemesine toplam maç sayısını
  // (3) yazıyordu — 2026-08-10 Master gözden geçirmesinde düzeltildi.
  'X Beraberlik Riski (0)',
  '2 Dep. Sürprizi (0)',
  'Sıralama',
  'Bülten sırası',
  'Riske göre',
  '1',
  'Ev Takımı – Dep Takımı',
  '02.08 20:00 · Test Ligi',
  '28',
  '🟢 Güçlü Aday',
  'Ana: 1',
  'Favori 1 · %55',
  'Veri',
  '%78',
  'Güven',
  '%72',
  'Radar',
  '4/5',
  'Uzlaşma',
  '%80',
  '2',
  'Ev Takımı – Dep Takımı',
  '02.08 20:00 · Test Ligi',
  '28',
  '🟢 Güçlü Aday',
  'Ana: 1',
  'Favori 1 · %55',
  'Veri',
  '%78',
  'Güven',
  '%72',
  'Radar',
  '4/5',
  'Uzlaşma',
  '%80',
  '3',
  'Ev Takımı – Dep Takımı',
  '02.08 20:00 · Test Ligi',
  '28',
  '🟢 Güçlü Aday',
  'Ana: 1',
  'Favori 1 · %55',
  'Veri',
  '%78',
  'Güven',
  '%72',
  'Radar',
  '4/5',
  'Uzlaşma',
  '%80',
];
