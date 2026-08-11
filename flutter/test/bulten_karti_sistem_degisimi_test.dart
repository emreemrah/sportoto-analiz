// HAFTALIK BÜLTEN · MAÇ KARTI — SİSTEM TAHMİNİ DEĞİŞİMİ.
//
// Sözleşme (2026-08-11 kullanıcı isteği):
//  * Kullanıcı sistem seçimini kuponuna ALDIYSA (aktarım damgası) ve sistem
//    o günden beri tahminini değiştirdiyse alt satır:
//        Sen 1-X            Sistem 1-X → 1-2
//    eski SOLUK gri, ok TURUNCU, yeni KOYU ve kalın.
//  * Ayrı "Değişti" etiketi ve kart içinde uzun açıklama YOK.
//  * Değişmemiş maçta yalnız güncel değer yazar.
//  * Kum saati (⏳) işaretleri kaldırıldı.
//  * Satıra dokununca ayrıntı ALTTAN AÇILAN pencerede gösterilir.
//  * Eski/yeni değerler damga + karar izinden gelir; sabit yazılmaz.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/bulletin/live_match_card.dart';

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

/// Güncel sistem tahmini '12' (1-2) olan, başlamamış maç.
Map<String, dynamic> _mac() => {
  'no': 15,
  'date': '2026-08-15T16:00:00Z',
  'league': 'Poland Ekstraklasa',
  'home': {'name': 'Jagiellonia'},
  'away': {'name': 'Widzew'},
  'status': 'notStarted',
  'prediction': {
    'symbol': '12',
    'label': 'ÇİFTE',
    'reason': 'favori %40 — tek seçim eşiğinin altında',
  },
};

/// Kupona 5 Ağustos'ta '10' (1-X) aktarılmış.
Map<String, dynamic> _damga() => {
  'secim': '10',
  'zaman': '2026-08-05T20:53:23.620Z',
  'kaynak': 'system',
  'analizZamani': '2026-08-05T16:19:22.774Z',
};

// SIRA ÖNEMLİ: sahte taşıyıcı İLK eşleşen anahtarı kullanır ve
// '/api/bulletins/1528' dizgesi gözlem URL'sinin de içindedir. Özel uç
// (observations) ÖNCE yazılır, yoksa gözlem isteğine bülten kaydı döner.
final Map<String, Object?> kUclar = {
  '/api/bulletins/1528/observations': {
    'observations': [
      {
        'observedAt': '2026-08-05T16:19:22.774+00:00',
        'odds': {'home': 2.33, 'draw': 3.15, 'away': 3.06},
        'statsSummary': {
          'prediction': '10',
          'probabilities': {'1': 40, 'X': 30, '2': 30},
        },
      },
      {
        'observedAt': '2026-08-07T05:21:20.482+00:00',
        'odds': {'home': 2.12, 'draw': 3.08, 'away': 2.62},
        'statsSummary': {
          'prediction': '12',
          'probabilities': {'1': 40, 'X': 28, '2': 32},
        },
      },
    ],
  },
  // orderNo → matchId eşlemesi (aktif haftada mühür yok).
  '/api/bulletins/1528': {
    'matches': [
      {'orderNo': 15, 'matchId': 'mac-15'},
    ],
  },
};

Future<void> _tur(WidgetTester t, [int n = 25]) async {
  for (var i = 0; i < n; i++) {
    await t.pump(const Duration(milliseconds: 1));
  }
}

Future<void> _karti(
  WidgetTester t, {
  Map<String, dynamic>? aktarim,
  String? userPick,
}) async {
  _tasiyici.uclar = kUclar;
  api.tasiyici = _tasiyici;
  t.view.physicalSize = const Size(1200, 2400);
  t.view.devicePixelRatio = 1.0;
  addTearDown(() {
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });
  await t.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: LiveMatchCard(
          match: _mac(),
          userPick: userPick,
          aktarim: aktarim,
          roundId: 1528,
          anim: 'off',
        ),
      ),
    ),
  );
  await _tur(t);
}

Finder _metin(String s) => find.text(s, findRichText: true);
Finder _metinIceren(String s) => find.textContaining(s, findRichText: true);

/// RichText içindeki bir parçanın stilini bulur.
TextStyle? _parcaStili(WidgetTester t, String parca) {
  TextStyle? bulunan;
  for (final w in t.widgetList<RichText>(find.byType(RichText))) {
    (w.text as TextSpan).visitChildren((span) {
      if (span is TextSpan && span.text == parca) {
        bulunan = span.style;
        return false;
      }
      return true;
    });
    if (bulunan != null) break;
  }
  return bulunan;
}

void main() {
  testWidgets('damga YOKSA yalnız güncel değer yazar; ok çizilmez', (t) async {
    await _karti(t, userPick: '10');

    expect(_metinIceren('Sistem 1-2'), findsOneWidget);
    expect(_metinIceren('→'), findsNothing);
  });

  testWidgets('damga farklıysa "eski → yeni" düzeni ve renkleri', (t) async {
    await _karti(t, userPick: '10', aktarim: _damga());

    // Sen satırı ve sistem satırı yan yana; istenen düzen birebir.
    expect(_metinIceren('Sen 1-X'), findsOneWidget);
    expect(_metinIceren('Sistem 1-X → 1-2'), findsOneWidget);

    // Eski SOLUK, ok TURUNCU, yeni KOYU + kalın.
    expect(_parcaStili(t, ' → ')?.color, AppColors.warning);
    expect(_parcaStili(t, '1-2')?.color, AppColors.text);
    expect(_parcaStili(t, '1-2')?.fontWeight, AppFont.black);

    // Ayrı etiket ve kart içi uzun açıklama YOK.
    expect(_metinIceren('Değişti'), findsNothing);
    expect(_metinIceren('olasılık'), findsNothing);
  });

  testWidgets('kum saati işareti kartta YOK', (t) async {
    await _karti(t, userPick: '10', aktarim: _damga());
    expect(_metinIceren('⏳'), findsNothing);
  });

  testWidgets('satıra dokununca ALTTAN pencere açılır ve kaydı gösterir', (
    t,
  ) async {
    await _karti(t, userPick: '10', aktarim: _damga());

    await t.tap(_metinIceren('Sistem 1-X → 1-2'));
    await _tur(t, 60);

    expect(_metin('Sistem tahmini 1-X → 1-2'), findsOneWidget);
    expect(_metinIceren('Kupona aldığın: 1-X · 5 Ağu'), findsOneWidget);
    // Karar izinden OKUNAN gerçek değişim.
    expect(_metinIceren('1-X → 1-2 · 7 Ağu'), findsOneWidget);
    expect(
      _metinIceren('olasılık 1/X/2: %40/%30/%30 → %40/%28/%32'),
      findsOneWidget,
    );
    expect(
      _metinIceren('oran ev/ber/dep: 2.33/3.15/3.06 → 2.12/3.08/2.62'),
      findsOneWidget,
    );
    // Tutulmayan veri açıkça söylenir.
    expect(
      _metinIceren('Kriter bazlı öncesi/sonrası kayıtta tutulmuyor'),
      findsOneWidget,
    );
  });

  testWidgets('gözlem kaydı yoksa pencere sebep UYDURMAZ', (t) async {
    _tasiyici.uclar = {'/api/bulletins/1528': kUclar['/api/bulletins/1528']};
    api.tasiyici = _tasiyici;
    t.view.physicalSize = const Size(1200, 2400);
    t.view.devicePixelRatio = 1.0;
    addTearDown(() {
      t.view.resetPhysicalSize();
      t.view.resetDevicePixelRatio();
    });
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LiveMatchCard(
            match: _mac(),
            userPick: '10',
            aktarim: _damga(),
            roundId: 1528,
            anim: 'off',
          ),
        ),
      ),
    );
    await _tur(t);

    await t.tap(_metinIceren('Sistem 1-X → 1-2'));
    await _tur(t, 60);

    expect(
      _metin('Değişiklik nedeni geçmiş kayıtlardan doğrulanamadı.'),
      findsOneWidget,
    );
  });
}
