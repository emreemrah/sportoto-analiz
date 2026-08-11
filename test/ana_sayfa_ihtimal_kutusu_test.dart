// ANA SAYFA · "Öne Çıkan Analizler" KARTI — 1/X/2 İHTİMAL KUTULARI.
//
// NEDEN AYRI TEST: bu alan kullanıcıdan ÜÇ KEZ geri bildirim aldı.
//  1) 2026-08-06: "MS1 %40 seçilmiş gibi duruyor" → dolgulu kutu kaldırıldı.
//  2) 2026-08-11: ok işareti (▲), mavi çerçeve ve "en yüksek ihtimal — seçim
//     değil" açıklaması kaldırıldı; vurgu koyu zemin + kalın yazıya indi.
//  3) 2026-08-11: KALAN VURGU DA KALDIRILDI — üç kutu birebir tek tip.
//     Gerekçe: en yükseği vurgulamak seçim yönlendirmesidir.
//
// SÖZLEŞME: 1/X/2 kutularının arka planı, çerçevesi, yazı rengi, yazı
// kalınlığı ve ölçüsü BİREBİR AYNIdır; tek fark DEĞERdir. Bu test onu
// sabitler — vurgu sessizce geri gelirse burada düşer.
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
Container _kutu(WidgetTester t, String yuzde) => t
    .widgetList<Container>(
      find.ancestor(of: find.text(yuzde), matching: find.byType(Container)),
    )
    .firstWhere((c) => c.decoration is BoxDecoration);

/// Kutunun İÇİNDEKİ iki yazı: [0] sembol (1/X/2), [1] yüzde.
/// Sembolü ekran genelinde aramak yanlış olur — '1' başka yerlerde de geçer.
List<Text> _kutuYazilari(WidgetTester t, String yuzde) => t
    .widgetList<Text>(
      find.descendant(
        of: find.byWidget(_kutu(t, yuzde)),
        matching: find.byType(Text),
      ),
    )
    .toList();

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

  testWidgets('üç kutunun ZEMİNİ ve ÇERÇEVESİ birebir aynı', (t) async {
    await _ekraniAc(t);

    final k = [
      for (final y in ['%38', '%32', '%30'])
        _kutu(t, y).decoration! as BoxDecoration,
    ];
    // En yüksek olan '%38' hiçbir şekilde ayrışmaz.
    expect(k[0].color, k[1].color);
    expect(k[1].color, k[2].color);
    expect(k[0].color, AppColors.bgAlt, reason: 'koyu vurgu zemini yok');
    for (final d in k) {
      expect(d.border, isNull, reason: 'hiçbir kutuda çerçeve yok');
    }
    // Vurgu için daha önce denenen iki ton da kullanılmıyor.
    expect(k[0].color, isNot(AppColors.border));
    expect(k[0].color, isNot(AppColors.primarySoft));
  });

  testWidgets('üç yüzdenin YAZI STİLİ birebir aynı', (t) async {
    await _ekraniAc(t);

    final s = [
      for (final y in ['%38', '%32', '%30'])
        t.widget<Text>(find.text(y)).style!,
    ];
    for (final x in s) {
      expect(x.fontWeight, AppFont.bold, reason: 'kalın vurgu yok');
      expect(x.color, s[0].color);
      expect(x.fontSize, s[0].fontSize);
    }
    // Ölçü küçültüldü (önce 10.5'ti) — büyümeye geri dönerse burada düşer.
    expect(s[0].fontSize! < 9, isTrue);

    // Sembol satırı da (1 / X / 2) tek tip.
    final semboller = [
      for (final y in ['%38', '%32', '%30']) _kutuYazilari(t, y)[0].style!,
    ];
    for (final x in semboller) {
      expect(x.fontWeight, AppFont.bold);
      expect(x.color, semboller[0].color);
      expect(x.fontSize, semboller[0].fontSize);
    }
  });

  testWidgets('üç kutu EŞİT genişlik ve EŞİT yükseklikte', (t) async {
    await _ekraniAc(t);

    final o = [
      for (final y in ['%38', '%32', '%30'])
        t.getSize(find.byWidget(_kutu(t, y))),
    ];
    expect(o[0].width, o[1].width);
    expect(o[1].width, o[2].width);
    expect(o[0].height, o[1].height);
    expect(o[1].height, o[2].height);
  });

  testWidgets('erişilebilirlik etiketi de NÖTR — yönlendirme yok', (t) async {
    final handle = t.ensureSemantics();
    await _ekraniAc(t);

    // Ekran okuyucu kullanan biri de "en yüksek" diye yönlendirilmez;
    // yüzdeler okunur, karşılaştırmayı kullanıcı yapar.
    expect(find.bySemanticsLabel(RegExp('en yüksek ihtimal')), findsNothing);
    // Düğüm etiketi birleşik olabildiği için desenle aranır (bkz. proje
    // test dikişleri notu: bySemanticsLabel tam eşleşme tutmaz).
    expect(find.bySemanticsLabel(RegExp(r'1: yüzde 38')), findsOneWidget);
    handle.dispose();
  });
}
