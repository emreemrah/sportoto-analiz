// SUNUCU UYANIRKEN HATA DEĞİL, BEKLEME GÖSTERİLİR.
//
// ÖLÇÜLEN DURUM (16 Ağustos 2026, iki ayrı gözlem): barındırma planı servisi
// boşta uyutuyor; uyanan servis bülteni hazırlayana dek `/api/bulletin`
// **503** + gövdesinde "Veri henüz hazır değil…" dönüyor. Toparlanma 61 sn ve
// ~90 sn ölçüldü.
//
// İKİNCİ EVRE ÖLÇÜMÜ (21 Ağustos 2026, telefondan bildirildi): soğuk açılışın
// İLK evresinde vekil isteği tutar, örnek ayağa kalkana dek HTTP yanıtı HİÇ
// gelmez → istek zaman aşımıyla ölür (503 daha sonra başlar). O pencerede ham
// DioException metni basılıyordu ve ana sayfada otomatik yenileme olmadığı
// için kullanıcı "sunucuya bir daha bağlanmadı" sanıp çıkıyordu.
//
// KURAL: yalnız 503 ve taşıma katmanı ZAMAN AŞIMI bekleme sayılır. Gerçek
// arızalar (500, 502, ağ yok/bağlantı kurulamadı) HÂLÂ hata olarak gösterilir
// — sorun gizlenmez.

import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masteranaliz/core/network/api_client.dart';
import 'package:masteranaliz/widgets/states.dart';

/// Taşıma katmanında verilen türde DioException fırlatan taşıyıcı — soğuk
/// açılışın "yanıt hiç gelmedi" evresinin ve bağlantısız telefonun taklidi.
class _PatlayanTasiyici implements HttpClientAdapter {
  _PatlayanTasiyici(this.tur);
  final DioExceptionType tur;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => throw DioException(requestOptions: options, type: tur);

  @override
  void close({bool force = false}) {}
}

ApiClient _patlayanIstemci(DioExceptionType tur) {
  final dio = Dio(BaseOptions(validateStatus: (_) => true));
  dio.httpClientAdapter = _PatlayanTasiyici(tur);
  return ApiClient(dio: dio);
}

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

    test('taşıma katmanı zaman aşımı → bekleme durumu (soğuk açılış 1. evre)', () {
      expect(
        sunucuHazirlaniyor(
          const ApiException('yanıt yok', gecici: true, zamanAsimi: true),
        ),
        isTrue,
      );
    });

    test('bağlantı kurulamadı → bekleme DEĞİL (telefonda internet olmayabilir)', () {
      expect(
        sunucuHazirlaniyor(const ApiException('bağlantı yok', gecici: true)),
        isFalse,
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

  group('api_client taşıma hatası sarmalama', () {
    // Ham DioException ekrana SIZMAZ: ekranlar ApiException bekler; ham metin
    // kullanıcıya arıza gibi görünüyordu (21 Ağustos bildirimi).
    test('zaman aşımı → ApiException(zamanAsimi, gecici)', () async {
      for (final tur in [
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
      ]) {
        try {
          await _patlayanIstemci(tur).bulletin();
          fail('$tur fırlatmalıydı');
        } on ApiException catch (e) {
          expect(e.zamanAsimi, isTrue, reason: '$tur zaman aşımı sayılmalı');
          expect(e.gecici, isTrue, reason: '$tur oturum kararı veremez');
          expect(e.status, isNull);
        }
      }
    });

    test('bağlantı hatası → ApiException(gecici) ama zamanAsimi DEĞİL', () async {
      for (final tur in [
        DioExceptionType.connectionError,
        DioExceptionType.unknown,
      ]) {
        try {
          await _patlayanIstemci(tur).bulletin();
          fail('$tur fırlatmalıydı');
        } on ApiException catch (e) {
          expect(e.zamanAsimi, isFalse, reason: '$tur uyanma sayılmamalı');
          expect(e.gecici, isTrue);
        }
      }
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

  testWidgets('SÖZÜNÜ KENDİSİ TUTAR: 15 sn\'de bir onRetry çağrılır', (t) async {
    // Eskiden söz ekrana bırakılıyordu; ana sayfada zamanlayıcı olmadığından
    // soğuk açılışta kullanıcı elle basmazsa uygulama bu ekranda KALIYORDU.
    var sayac = 0;
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(body: HazirlaniyorState(onRetry: () => sayac++)),
      ),
    );
    await t.pump(const Duration(seconds: 15));
    expect(sayac, 1, reason: '15. saniyede kendiliğinden denemeli');
    await t.pump(const Duration(seconds: 15));
    expect(sayac, 2, reason: 'sunucu uyanana dek denemeye devam etmeli');

    // Kapalıyken zamanlayıcı KURULMAZ (bülten ekranının kendi zamanlayıcısı
    // olsaydı ve kapatmak isteseydi çifte yoklama olurdu).
    var kapaliSayac = 0;
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HazirlaniyorState(
            otomatikYenileme: false,
            onRetry: () => kapaliSayac++,
          ),
        ),
      ),
    );
    await t.pump(const Duration(seconds: 31));
    expect(kapaliSayac, 0, reason: 'bayrak kapalıyken kendiliğinden denemez');
  });
}
