// KAYNAK: app/src/studioShare.js — çeviri (paylaşımın SAF kısmı).
//
// Dosya adı, başlık, açıklama ve sonuç metinleri. Cihazla konuşan taraf
// ekranın kendisidir (RepaintBoundary + share_plus).
//
// ────────────────────────────────────────────────────────────────────────────
// ÇEVRİLMEYEN PARÇALAR — VE NEDENLERİ
//
//  • `tabularOff()` / `inlineImagesForCapture()` / `capturePngDataUri()`:
//    üçü de yalnız WEB'de, `html2canvas`ın eksiklerini kapatmak için vardı
//    (kitaplık eşit-genişlik rakamı yok sayıyor, uzak görselleri kareye
//    almıyordu). Flutter'da kare `RepaintBoundary.toImage()` ile GERÇEK
//    çizim katmanından alınır: yazı tipi ayarları ve yüklenmiş armalar
//    zaten kareye girer. Karşılığı olmadığı için taşınmadı.
//  • `dataUriToBlob` / `base64OfCapture`: web indirme yolu; Flutter'da kare
//    doğrudan bayt olarak paylaşılır.
//
// KORUNAN: kullanıcıya görünen HER metin ve dosya adı kuralı birebir aynı.

import '../brand.dart';

const String kShareMime = 'image/png';

// Yalnız dosya adında kullanılabilecek işaretler. Hafta numarası sunucudan
// geldiği için burada temizlenir (yol ayracı içeren bir değer dosya adını
// bozar). Boşsa ek yazılmaz — uydurma numara üretilmez.
String _slug(Object? v) =>
    '${v ?? ''}'.replaceAll(RegExp(r'[^0-9A-Za-z]+'), '');

/// sportoto-kupon-hafta-1526.png — hafta bilinmiyorsa yalnız sportoto-kupon.png
String couponShareFileNameOf({Object? roundId, Object? weekNumber}) {
  final hafta = _slug(weekNumber ?? roundId);
  return 'sportoto-kupon${hafta.isNotEmpty ? '-hafta-$hafta' : ''}.png';
}

// HAFTA METNİ — kullanıcıya "Hafta 1527" (iç kayıt numarası) GÖSTERİLMEZ
// (hata bildirimi, 2026-08-06). Öncelik: resmî hafta adı ("53. Hafta") →
// hafta numarası → nötr metin. roundId yalnız son çare olarak, "Hafta" ön eki
// OLMADAN kullanılmaz — yanıltıcı olurdu.
String? _haftaMetniOf({String? roundName, Object? weekNumber}) {
  if (roundName != null && roundName.isNotEmpty) return roundName;
  if (weekNumber != null) return '$weekNumber. Hafta';
  return null;
}

String couponShareTitleOf({String? roundName, Object? weekNumber}) {
  final hafta = _haftaMetniOf(roundName: roundName, weekNumber: weekNumber);
  return hafta != null ? '$hafta kuponu' : 'Kupon';
}

/// Kolon sayısı kuponun ölçüsüdür, kişisel veri değildir; bilinmiyorsa
/// yazılmaz. Marka adı ve dürüstlük bildirimi brand.dart'tan gelir, elle
/// yazılmaz.
String couponShareCaptionOf({
  String? roundName,
  Object? weekNumber,
  Object? columnCount,
}) {
  final hafta =
      _haftaMetniOf(roundName: roundName, weekNumber: weekNumber) ??
      'Haftalık kupon';
  final n = columnCount is num ? columnCount : null;
  final kolon = (n != null && n > 0) ? ' · $n kolon' : '';
  return '$hafta$kolon — $kAppName. $kNoGuaranteeNotice';
}

/// Kullanıcı paylaşım menüsünü kapattı mı? Bazı platformlar bunu HATA olarak
/// fırlatıyor; ekrana hata basmak yanlış olur.
bool isAbortError(Object? e) {
  final s = '${e ?? ''}';
  return RegExp(r'AbortError|iptal|cancel', caseSensitive: false).hasMatch(s);
}

/// Sonuç metinleri — ne olduğunu ekranda YAZILI söyleriz, sessiz kalmayız.
String shareDoneTextOf(String tur) => switch (tur) {
  'shared' => 'Paylaşım menüsü açıldı.',
  'downloaded' => 'Görsel indirildi — indirilenler klasöründe.',
  'unavailable' =>
    'Bu cihazda paylaşım menüsü açılamadı; görsel oluşturuldu ama paylaşılamadı.',
  _ => '',
};

String shareErrorTextOf(Object? e) {
  final m = '${e ?? ''}'.trim();
  return 'Görsel paylaşılamadı${m.isNotEmpty ? ': $m' : ''} — tekrar deneyebilirsin.';
}
