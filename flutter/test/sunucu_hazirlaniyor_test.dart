// SUNUCU UYANIRKEN HATA DEĞİL, BEKLEME GÖSTERİLİR.
//
// ÖLÇÜLEN DURUM (16 Ağustos 2026, iki ayrı gözlem): barındırma planı servisi
// boşta uyutuyor; uyanan servis bülteni hazırlayana dek `/api/bulletin`
// **503** + gövdesinde "Veri henüz hazır değil…" dönüyor. Toparlanma 61 sn ve
// ~90 sn ölçüldü.
//
// O pencerede ekran "Bir şeyler ters gitti" + ham DioException metni
// basıyordu; kullanıcı bunu arıza sanıyordu. Oysa ters giden bir şey yok.
//
// KURAL: yalnız 503 bu şekilde yorumlanır. Gerçek arızalar (500, 502, ağ
// hatası) HÂLÂ hata olarak gösterilir — sorun gizlenmez.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/widgets/states.dart';

void main() {
  group('sunucuHazirlaniyor', () {
    test('503 → bekleme durumu', () {
      expect(
        sunucuHazirlaniyor(
          const ApiException('Veri henüz hazır değil', status: 503),
        ),
        isTrue,
      );
    });

    test('GERÇEK ARIZALAR GİZLENMEZ', () {
      for (final s in [500, 502, 504, 400, 401, 404]) {
        expect(
          sunucuHazirlaniyor(ApiException('hata', status: s)),
          isFalse,
          reason: '$s bekleme sayılmamalı — gerçek arıza gizlenir',
        );
      }
      expect(sunucuHazirlaniyor(Exception('ağ yok')), isFalse);
      expect(sunucuHazirlaniyor(null), isFalse);
    });
  });

  testWidgets('bekleme ekranı SÖZ VERMEZ, ne olduğunu söyler', (t) async {
    await t.pumpWidget(
      MaterialApp(home: Scaffold(body: HazirlaniyorState(onRetry: () {}))),
    );
    await t.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('Sunucu uyanıyor'), findsOneWidget);
    expect(find.textContaining('genelde bir dakika'), findsOneWidget);
    // Otomatik yenileme VARSA söylenir — kullanıcı boşuna beklemesin.
    expect(find.textContaining('kendiliğinden yenilenecek'), findsOneWidget);
    expect(find.text('Şimdi dene'), findsOneWidget);
    // Hata dili KULLANILMAZ: bu bir arıza değil.
    expect(find.textContaining('ters gitti'), findsNothing);
    expect(find.textContaining('Hata'), findsNothing);
  });

  testWidgets('otomatik yenileme yoksa SÖZ VERİLMEZ', (t) async {
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(body: HazirlaniyorState(otomatikYenileme: false)),
      ),
    );
    await t.pump(const Duration(milliseconds: 100));
    expect(find.textContaining('kendiliğinden yenilenecek'), findsNothing);
    expect(find.textContaining('genelde bir dakika'), findsOneWidget);
  });
}
