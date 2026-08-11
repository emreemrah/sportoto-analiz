// ANA SAYFA · "Öne Çıkan Analizler" KARTI — 1/X/2 İHTİMAL KUTULARI.
//
// NEDEN AYRI TEST: bu alan kullanıcıdan İKİ KEZ geri bildirim aldı.
//  1) 2026-08-06: "MS1 %40 seçilmiş gibi duruyor" → dolgulu kutu kaldırıldı.
//  2) 2026-08-11: ok işareti (▲), MAVİ ÇERÇEVE ve altındaki "en yüksek
//     ihtimal — seçim değil" açıklaması da kaldırıldı; üçü birlikte hâlâ
//     "seçim yapılmış" izlenimi veriyordu.
// Vurgu artık YALNIZ biraz daha koyu NÖTR arka plan + kalın yazı. Bu test o
// sözleşmeyi sabitler; sessizce geri gelirse burada düşer.
//
// Ekran Riverpod `bulletinProvider`'ı okur → test onu doğrudan ezer.
// `api.rounds()` gibi yan çağrılar sahte taşıyıcıyla 404 döner (ekran bunu
// zaten sessizce karşılıyor).

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/features/bulletin/bulletin_providers.dart';
import 'package:masteranaliz/features/home/home_screen.dart';

class _SahteTasiyici implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    '{"error":"yok"}',
    404,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

/// Favori '1' (%38) — üç yüzde de birbirinden FARKLI seçildi ki hangi
/// kutunun vurgulandığı metinden ayırt edilebilsin.
final Map<String, dynamic> kBulten = {
  'round': {'id': 1601, 'name': '1. Hafta', 'year': '2026/2027'},
  'matches': [
    {
      'no': 1,
      'date': '2026-08-15T16:00:00Z',
      'league': 'Turkey Süper Lig',
      'home': {'name': 'Konyaspor'},
      'away': {'name': 'Çaykur Rizespor'},
      'analysis': {
        'surpriseScore': 50,
        'favorite': {'symbol': '1'},
        'probabilities': {'1': 38, 'X': 32, '2': 30},
        'comment': 'Sürprize açık maç.',
      },
    },
  ],
};

Future<void> _tur(WidgetTester t, [int n = 25]) async {
  for (var i = 0; i < n; i++) {
    await t.pump(const Duration(milliseconds: 1));
  }
}

Future<void> _ekraniAc(WidgetTester t) async {
  // Ana Sayfa TEMBEL bir kaydırma listesidir; varsayılan 800x600 görünümde
  // "Öne Çıkan Analizler" bölümü hiç kurulmaz. Görünüm yükseltilir ki kart
  // gerçekten çizilsin (genişlik 400'ün üstünde → GENİŞ sürüm ölçüleri).
  t.view.physicalSize = const Size(1200, 4000);
  t.view.devicePixelRatio = 1.0;
  addTearDown(() {
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });
  api.tasiyici = _SahteTasiyici();
  await t.pumpWidget(
    ProviderScope(
      overrides: [bulletinProvider.overrideWith((ref) async => kBulten)],
      child: const MaterialApp(home: HomeScreen()),
    ),
  );
  await _tur(t);
}

/// Yüzde metnini saran ihtimal kutusu (dekorasyonlu en yakın Container).
Container _kutu(WidgetTester t, String yuzde) => t.widgetList<Container>(
  find.ancestor(of: find.text(yuzde), matching: find.byType(Container)),
).firstWhere((c) => c.decoration is BoxDecoration);

void main() {
  testWidgets('ok işareti ve "seçim değil" açıklaması EKRANDA YOK', (t) async {
    await _ekraniAc(t);

    expect(find.text('%38'), findsWidgets); // kart çizildi
    expect(find.textContaining('▲'), findsNothing);
    expect(find.textContaining('seçim değil'), findsNothing);
    // Kutu başlığı yalnız sembol: '1 ▲' değil.
    expect(find.text('1'), findsWidgets);
    expect(find.textContaining('1 ▲'), findsNothing);
  });

  testWidgets('favori kutusunda ÇERÇEVE yok, arka plan MAVİ değil', (t) async {
    await _ekraniAc(t);

    final fav = _kutu(t, '%38').decoration! as BoxDecoration;
    expect(fav.border, isNull, reason: 'çerçeve seçim izlenimi veriyordu');
    expect(
      fav.color,
      AppColors.border,
      reason: 'vurgu nötr ve biraz daha koyu arka planla yapılır',
    );
    expect(
      fav.color,
      isNot(AppColors.primarySoft),
      reason: 'mavi ton kullanılmaz',
    );

    final digeri = _kutu(t, '%32').decoration! as BoxDecoration;
    expect(digeri.color, AppColors.bgAlt);
    expect(digeri.border, isNull);
  });

  testWidgets('en yüksek yüzde KALIN, diğerleri normal kalınlıkta', (t) async {
    await _ekraniAc(t);

    expect(t.widget<Text>(find.text('%38')).style?.fontWeight, AppFont.black);
    expect(t.widget<Text>(find.text('%32')).style?.fontWeight, AppFont.bold);
    expect(t.widget<Text>(find.text('%30')).style?.fontWeight, AppFont.bold);
  });

  testWidgets('üç kutu EŞİT genişlikte', (t) async {
    await _ekraniAc(t);

    final g1 = t.getSize(find.byWidget(_kutu(t, '%38'))).width;
    final gx = t.getSize(find.byWidget(_kutu(t, '%32'))).width;
    final g2 = t.getSize(find.byWidget(_kutu(t, '%30'))).width;
    expect(g1, gx);
    expect(gx, g2);
  });

  testWidgets('ok kalktı ama ANLAM erişilebilirlikte duruyor', (t) async {
    final handle = t.ensureSemantics();
    await _ekraniAc(t);

    expect(
      find.bySemanticsLabel(RegExp('en yüksek ihtimal')),
      findsOneWidget,
    );
    handle.dispose();
  });
}
