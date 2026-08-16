// ANA SAYFA — 16 AĞUSTOS 2026'DA DÜZELTİLEN KUSURLARIN NÖBETÇİSİ.
//
// O gün dört kusur elle bulundu, elle düzeltildi ve HİÇBİRİ teste bağlanmadı.
// Testsiz düzeltme bir sonraki dokunuşta sessizce geri gelir; bu dosya tam
// olarak bunu engellemek için var. Her test bir KULLANICI ŞİKÂYETİNİN
// karşılığıdır ve şikâyet cümlesi testin adında durur.
//
// Ağ, `api.tasiyici` dikişiyle sahte taşıyıcıya bağlanır (radar_ekrani_test
// ile aynı teknik). Yükleme yarışını ölçebilmek için taşıyıcı, istenen ucu
// TESTİN AÇACAĞI ana kadar bekletebilir — "bülten hâlâ yolda" durumu ancak
// böyle gerçekçi kurulur.

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/features/home/home_screen.dart';

// ───────────────────────────── Sahte taşıyıcı ─────────────────────────────

class _SahteTasiyici implements HttpClientAdapter {
  Map<String, Object?> uclar = const {};

  /// Bu parçayı içeren uç, [ac] çağrılana kadar YANIT VERMEZ.
  String? bekletilen;
  final _kapi = Completer<void>();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final u = options.uri.toString();
    if (bekletilen != null && u.contains(bekletilen!)) await _kapi.future;
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

  void ac() {
    if (!_kapi.isCompleted) _kapi.complete();
  }

  @override
  void close({bool force = false}) {}
}

late _SahteTasiyici _tasiyici;

// ─────────────────────────────── Fikstürler ───────────────────────────────
// Şekil backend'in gerçek `/api/bulletin` yükünden alındı: takımlar NESNE
// (name + logo), analiz `analysis` altında, ihtimaller `probabilities`.

Map<String, dynamic> _takim(String ad, String armaUlkesi) => {
  'name': ad,
  'mediumName': ad,
  'logo': 'https://cdn.footystats.org/img/teams/$armaUlkesi-${ad.toLowerCase()}.png',
};

Map<String, dynamic> _mac(
  int no, {
  required String tarih,
  Map<String, dynamic>? analiz,
  String lig = 'Turkey Süper Lig',
  String ulkeOnEki = 'turkey',
}) => {
  'no': no,
  'date': tarih,
  'league': lig,
  'status': 'upcoming',
  'home': _takim('Ev$no', ulkeOnEki),
  'away': _takim('Dep$no', ulkeOnEki),
  'analysis': ?analiz,
};

/// GÜNCEL hafta: biri ihtimalli, biri ihtimalsiz iki maç — "veri olan kart
/// uzuyor, olmayan kısa kalıyor" kusurunun tam kurulumu.
Map<String, dynamic> _bulten() => {
  'round': '2. Hafta',
  'roundId': 1529,
  'updatedAt': '2026-08-16T05:00:00Z',
  // Backend bu alanı üretmeye DEVAM EDİYOR; ekranın onu göstermediği
  // doğrulanacak (yanıltıcı olduğu için kaldırıldı).
  'difficulty': {'level': 'Kolay', 'score': 12},
  'matches': [
    _mac(
      1,
      tarih: '2026-08-21T18:30:00Z',
      analiz: {
        'surpriseScore': 20,
        'probabilities': {'1': 40, 'X': 30, '2': 30},
        'comment': 'Tartışmalı.',
      },
    ),
    _mac(2, tarih: '2026-08-22T16:00:00Z', analiz: {'surpriseScore': 10}),
  ],
};

Map<String, Object?> _uclar() => {
  '/api/bulletin': _bulten(),
  '/api/rounds': {
    'currentRoundId': 1529,
    'rounds': [
      {'id': 1528, 'name': '1. Hafta'},
      {'id': 1529, 'name': '2. Hafta'},
    ],
  },
  '/api/history/1528': {
    'matches': [
      _mac(9, tarih: '2026-08-17T16:00:00Z', lig: 'Spain La Liga', ulkeOnEki: 'spain'),
    ],
  },
};

Future<void> _tur(WidgetTester t, [int kez = 6]) async {
  for (var i = 0; i < kez; i++) {
    await t.pump(const Duration(milliseconds: 60));
  }
}

Future<void> _ekraniAc(WidgetTester t) async {
  t.view.physicalSize = const Size(900, 2200);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.reset);
  await t.pumpWidget(
    const ProviderScope(child: MaterialApp(home: HomeScreen())),
  );
  await _tur(t);
}

Finder _metinIceren(String s) => find.textContaining(s, findRichText: true);

void main() {
  setUp(() {
    _tasiyici = _SahteTasiyici()..uclar = _uclar();
    api.tasiyici = _tasiyici;
  });

  group('Ana sayfa — bildirilen kusurların nöbetçisi', () {
    testWidgets(
      '"önce geçen haftanın verisi geldi": bülten yerleşmeden Yaklaşan Maçlar ÇİZİLMEZ',
      (t) async {
        // Bülten (≈1 MB) yolda; önceki hafta isteği (küçük) çoktan döndü.
        _tasiyici.bekletilen = '/api/bulletin';
        await _ekraniAc(t);

        expect(
          _metinIceren('Yaklaşan Maçlar'),
          findsNothing,
          reason:
              'Bülten gelmeden şerit çizilirse liste bir süre YALNIZ geçen '
              'haftaya kalır ve ana sayfa geçen haftayı açmış gibi görünür.',
        );

        await t.runAsync(() async {
          _tasiyici.ac();
          await Future<void>.delayed(const Duration(milliseconds: 20));
        });
        await _tur(t, 12);

        expect(_metinIceren('Yaklaşan Maçlar'), findsOneWidget);
      },
    );

    testWidgets(
      '"kart kendini büyütmüş": iki analiz kartının düğmeleri AYNI hizada',
      (t) async {
        await _ekraniAc(t);

        final dugmeler = find.text('Analiz Detayı ›');
        expect(dugmeler, findsNWidgets(2));

        final y1 = t.getTopLeft(dugmeler.at(0)).dy;
        final y2 = t.getTopLeft(dugmeler.at(1)).dy;
        expect(
          (y1 - y2).abs(),
          lessThan(0.5),
          reason:
              'Kartlar eşit yükseklikte değilse düğmeler basamak yapar; '
              'veri olan/olmayan kart farkı ekrana yansımamalı.',
        );
      },
    );

    testWidgets(
      'ihtimal verisi yoksa SAHTE kutu değil, aynı yükseklikte dürüst satır',
      (t) async {
        await _ekraniAc(t);
        expect(_metinIceren('verisi yok'), findsOneWidget);
        // Uydurma yüzde kesinlikle yok.
        expect(_metinIceren('%–'), findsNothing);
      },
    );

    testWidgets(
      '"2. hafta maçlarında yazmıyor": hafta rozeti HER kartta',
      (t) async {
        await _ekraniAc(t);

        // Şeritte iki hafta birden var; ikisi de kendi adını taşımalı.
        expect(
          _metinIceren('2. Hafta'),
          findsWidgets,
          reason: 'Güncel hafta kartı rozetsiz kalırsa hangi bültene ait '
              'olduğu ancak diğer kartlarla karşılaştırılarak anlaşılır.',
        );
        expect(_metinIceren('1. Hafta'), findsWidgets);
      },
    );

    testWidgets('"kolay/zor yanıltıcı": hero ZORLUK etiketi göstermez', (
      t,
    ) async {
      await _ekraniAc(t);
      // Fikstür `difficulty: Kolay` gönderiyor; ekran onu ÇİZMEMELİ.
      expect(_metinIceren('Zorluk'), findsNothing);
      expect(find.text('Kolay'), findsNothing);
    });

    testWidgets('lig adı ülke vermese de kart bayraksız kalmaz', (t) async {
      // "Final" lig adından ülke çıkmaz; iki arma da almanca ön ekli.
      _tasiyici.uclar = {
        ..._uclar(),
        '/api/bulletin': {
          ..._bulten(),
          'matches': [
            _mac(
              1,
              tarih: '2026-08-21T18:30:00Z',
              lig: 'Final',
              ulkeOnEki: 'germany',
              analiz: {'surpriseScore': 10},
            ),
          ],
        },
      };
      await _ekraniAc(t);
      expect(
        _metinIceren('ALMANYA'),
        findsWidgets,
        reason: 'Ülke lig adından çıkmıyorsa kulüp armasındaki ülke ön '
            'ekinden türetilir (bkz. macUlkesiEn).',
      );
    });
  });
}
