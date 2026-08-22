// ANALİZ/TAHMİN YOKSA SEBEBİ EKRANDA YAZAR.
//
// KULLANICI BİLDİRİMİ (22 Ağustos 2026): "bültendeki bazı maçların sistem
// tahminleri yok, bunlar daha önce vardı".
//
// Arkasındaki gerçek: backend, başlamış ama mühürlü analizi olmayan maça
// bilerek tahmin ÜRETMEZ (geriye dönük tahmin yasağı) ve sebebini
// `analysisAbsence.text` alanında YAZAR. Ama Flutter tarafı bu alanı hiç
// okumuyordu: kartta yalnız "Sistem —" kalıyor, kullanıcı da bunu haklı
// olarak "tahmin kayboldu / uygulama bozuk" diye okuyordu.
//
// Projenin kuralı açık: veri yoksa sebebini yaz. Bu testler o sözleşmeyi
// bağlar — sebep gelirse EKRANDA görünür, gelmezse ortalık kirletilmez.
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/features/bulletin/live_match_card.dart';

class _SahteTasiyici implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    jsonEncode({'observations': []}),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

const kSebep =
    'Maç başladıktan sonra tahmin üretilmez — bu maçın mühürlü analizi yok.';

/// Oynanmış maç: skoru var, analizi/tahmini YOK, sebebi yazılı.
/// (Üretimdeki #1 Erzurumspor FK – Galatasaray kaydının aynısı.)
Map<String, dynamic> _sebepliMac() => {
  'no': 1,
  'date': '2026-08-21T21:30:00',
  'league': 'Turkey Süper Lig',
  'home': {'mediumName': 'Erzurumspor FK'},
  'away': {'mediumName': 'Galatasaray'},
  'status': 'finished',
  'started': true,
  'score': {'home': 0, 'away': 4},
  'analysis': null,
  'prediction': null,
  'analysisAbsence': {'code': 'started_without_snapshot', 'text': kSebep},
};

/// Normal maç: tahmini var, sebep alanı yok.
Map<String, dynamic> _normalMac() => {
  'no': 2,
  'date': '2026-08-23T16:00:00',
  'league': 'Turkey Süper Lig',
  'home': {'mediumName': 'Ç.Rizespor'},
  'away': {'mediumName': 'Samsunspor'},
  'status': 'notStarted',
  'started': false,
  'prediction': {'symbol': '10', 'label': 'ÇİFTE', 'reason': 'favori %41'},
};

Future<void> _karti(WidgetTester t, Map<String, dynamic> mac) async {
  api.tasiyici = _SahteTasiyici();
  t.view.physicalSize = const Size(1200, 2400);
  t.view.devicePixelRatio = 1.0;
  addTearDown(() {
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });
  await t.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: LiveMatchCard(match: mac, roundId: 1529, anim: 'off'),
      ),
    ),
  );
  for (var i = 0; i < 25; i++) {
    await t.pump(const Duration(milliseconds: 1));
  }
}

void main() {
  testWidgets('tahmin yoksa SEBEBİ kartta yazar', (t) async {
    await _karti(t, _sebepliMac());
    expect(
      find.textContaining(kSebep, findRichText: true),
      findsOneWidget,
      reason: 'sebep ekranda yok — kullanıcı boş "Sistem —" görüyor',
    );
  });

  testWidgets('sebep bilgi olarak sunulur, arıza gibi değil', (t) async {
    await _karti(t, _sebepliMac());
    // ⓘ bilgi işareti; kapsam uyarısının ⚠ işareti DEĞİL. Maç başladıktan
    // sonra tahmin üretilmemesi bir arıza değil, kuralın kendisidir.
    expect(find.textContaining('ⓘ', findRichText: true), findsOneWidget);
    expect(find.textContaining('⚠', findRichText: true), findsNothing);
  });

  testWidgets('maç kartta kalır — skor görünmeye devam eder', (t) async {
    await _karti(t, _sebepliMac());
    // Boşluğu yazmak, maçı gizlemek değildir.
    expect(find.textContaining('Erzurumspor FK', findRichText: true),
        findsWidgets);
    expect(find.textContaining('Galatasaray', findRichText: true), findsWidgets);
  });

  testWidgets('sebep yoksa kart kirletilmez (nota yer verilmez)', (t) async {
    await _karti(t, _normalMac());
    expect(find.textContaining('ⓘ', findRichText: true), findsNothing);
    expect(find.textContaining(kSebep, findRichText: true), findsNothing);
  });
}
