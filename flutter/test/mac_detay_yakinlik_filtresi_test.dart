// MAÇ DETAYINDA DA YAKINLIK FİLTRESİ VAR.
//
// KULLANICI İSTEĞİ (16 Ağustos 2026): "2. hafta maçının içine girdim, bülten
// sırasına geldim, oynanma yüzdesi ve oran yok."
//
// ÖLÇÜM önce şunu ayırdı: veri VARDI (oynanma yüzdesi 15/15 maçta, günlük
// hücrelerde gerçek değerlerle). Eksik olan SÜZGEÇTİ — panel
// `radarPositionDna`'yı toleranssız çağırıyordu, yani Radar ekranındaki
// "Oynanma ±5 / Oran ±0.25" katmanı maç detayında hiç yoktu.
//
// Bu, 11 Ağustos'ta bilinçli alınmış bir kararın TERSİNE dönmesidir; dosya
// başlığındaki not da güncellendi.
//
// KOPYA YOK: süzgeç Radar ekranının kendi bileşeniyle (`DnaDonemFiltresi`) ve
// aynı istek biçimiyle bağlandı. İki ekran aynı süzgeci farklı uygularsa
// hangisinin doğru olduğu bilinemez.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final src = File(
    'lib/features/match_detail/mac_bulten_sirasi_paneli.dart',
  ).readAsStringSync();

  test('panel isteği YAKINLIK toleransını gönderir', () {
    expect(
      RegExp(r'oynanmaTol:.*mod').hasMatch(src),
      isTrue,
      reason: 'oynanma toleransı isteğe konmuyor — süzgeç çalışmaz',
    );
    expect(RegExp(r'oranTol:.*mod').hasMatch(src), isTrue);
  });

  test('sağlayıcı ANAHTARI süzgeci içerir (bayat sonuç kalmasın)', () {
    // Yalnız roundId anahtar olsaydı süzgeç değişince istek yeniden atılmaz,
    // eski sonucun ekranda kalırdı.
    // Düz metin arama: tip içindeki > karakterleri yüzünden regex kırılgandı
    // (ilk sürüm bu yüzden yanlış alarm verdi).
    expect(
      src.contains('({Object rid, String? mod, num? tol})'),
      isTrue,
      reason: 'sağlayıcı anahtarı mod/tol taşımıyor',
    );
  });

  test('Radar ekranının KENDİ bileşeni kullanılır — kopya arayüz yok', () {
    expect(src.contains('DnaDonemFiltresi('), isTrue);
    // Panel kendi çip listesini yeniden yazmamalı.
    expect(
      src.contains('for (final p in kDnaPeriods)'),
      isFalse,
      reason: 'panel kendi dönem çiplerini çiziyor — ikinci arayüz',
    );
  });

  test('mühürlü haftada YALNIZ karşılığı olan adımlar çip olur', () {
    // Mühürde ya da türevde karşılığı olmayan bir adım sunulursa, basınca
    // hiçbir şey değişmez ve kullanıcı yanılır.
    expect(src.contains('muhurluFiltreler'), isTrue);
    expect(src.contains('turevFiltreler'), isTrue);
    expect(src.contains("positionDna?['turev']"), isTrue);
  });

  test('mod değişince süzgeç Birebir + Tümü\'ye döner', () {
    // Önceki seçimden kalan dar/geniş değer sessizce taşınmamalı.
    final i = src.indexOf('onFiltreModSec:');
    expect(i, greaterThan(-1));
    final govde = src.substring(i, i + 500);
    expect(govde.contains('_oynanmaTol = 0'), isTrue);
    expect(govde.contains('_oranTol = 0'), isTrue);
    expect(govde.contains("_macPenceresi = 'allTime'"), isTrue);
  });
}
