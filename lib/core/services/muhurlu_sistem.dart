// MÜHÜRLÜ SİSTEM SEÇİMİ — geçmiş ekranların TEK sistem kaynağı.
//
// SORUN (2026-08-11, kullanıcı bulgusu): Hafta Kapanışı ve Başarı Paneli,
// sistem seçimini `/api/history/:roundId` yanıtındaki `prediction` alanından
// okuyordu. O alan sunucuda ŞÖYLE üretiliyor (backend/src/server.js):
//
//     const snap = load(`snapshot-${roundId}`)?.data;      // CACHE dosyası
//     if (p.symbol) merged.prediction = { symbol: p.symbol, label: p.label };
//
// Yani kaynak, arşivdeki DEĞİŞTİRİLEMEZ mühür değil, sunucunun cache
// klasöründeki bir dosyadır. O dosya silinir/eskirse ya da o maç için pick
// taşımıyorsa, `prediction` GÜNCEL bültenin canlı analizinden gelir. Sonuç:
// geçmiş bir hafta, bugünkü analizle anlatılır ve sistem sonradan kazanmış
// gibi görünebilir. Kupon düellosunda bu, kullanıcıya haksızlıktır.
//
// ÇÖZÜM: geçmiş ekranlar yalnız arşiv mührünü okur —
// `/api/bulletins/:id/snapshot` → `payload.matches[].systemPrediction`.
// Bu kayıt haftanın kilit anında (ilk maçtan 5 dk önce) alınır, sunucuda
// DB trigger + servis + API katmanlarıyla değiştirilemez (immutable) ve
// doğrulama karması (verificationHash) taşır.
//
// MÜHÜR YOKSA UYDURULMAZ: o maç sistem başarısına girmez, ekranda
// "Sistem tahmin kaydı doğrulanamadı" yazar ve sistem KAZANMIŞ gösterilmez.

import 'archive_client.dart';

/// Bir haftanın mühürlü sistem seçimleri.
class MuhurluSistem {
  const MuhurluSistem({
    this.secimler = const {},
    this.muhurVar = false,
    this.kilitZamani,
    this.dogrulamaKodu,
    this.gecKilit = false,
  });

  /// Mühür hiç okunamadı (aktif hafta, eski sunucu, ağ hatası).
  static const yok = MuhurluSistem();

  /// maç no → mühürlü sistem seçimi ('1' | 'X' | '2' | '10' | '12' | '02' …).
  /// Mühürde tahmin taşımayan maç bu haritada HİÇ bulunmaz.
  final Map<int, String> secimler;

  /// Arşivde kilitli snapshot bulundu mu? false ise hiçbir maç için sistem
  /// seçimi İDDİA EDİLMEZ.
  final bool muhurVar;

  final String? kilitZamani;
  final String? dogrulamaKodu;

  /// Mühür ilk maç başladıktan SONRA alınmışsa sunucu `late` işaretler.
  /// Böyle bir kayıt "kilit öncesi biliyordu" kanıtı sayılmaz.
  final bool gecKilit;

  /// Kilit ÖNCESİ mühürlenmiş, güvenilir kayıt mı?
  bool get guvenilir => muhurVar && !gecKilit;

  /// Maçın mühürlü sistem seçimi; yoksa null (— "tahmin yok" demektir,
  /// "yanlış" değil).
  String? secim(Object? no) {
    if (!guvenilir) return null;
    final n = int.tryParse('$no');
    return n == null ? null : secimler[n];
  }
}

/// Geçersiz/boş tahmin işaretleri — mühürde "veri yok" böyle görünür.
bool _bosTahmin(Object? v) {
  final s = '${v ?? ''}'.trim();
  return s.isEmpty || s == '-' || s == '—';
}

/// Haftanın mühürlü sistem seçimlerini arşivden okur.
///
/// 404 (henüz kilitlenmemiş aktif hafta) ve ağ hatası AYNI şekilde ele alınır:
/// `MuhurluSistem.yok` döner. Çağıran taraf bunu "mühür yok" olarak gösterir,
/// canlı analize DÜŞMEZ.
Future<MuhurluSistem> muhurluSistemSecimleri(Object? roundId) async {
  if (roundId == null) return MuhurluSistem.yok;
  Map? snap;
  try {
    snap = await archiveGet('/api/bulletins/$roundId/snapshot') as Map?;
  } catch (_) {
    return MuhurluSistem.yok;
  }
  if (snap == null) return MuhurluSistem.yok;

  final payload = snap['payload'];
  final maclar = payload is Map ? payload['matches'] : null;
  if (maclar is! List) return MuhurluSistem.yok;

  final secimler = <int, String>{};
  for (final m in maclar) {
    if (m is! Map) continue;
    final no = int.tryParse('${m['no']}');
    if (no == null) continue;
    final sp = m['systemPrediction'];
    if (sp is! Map) continue;
    // mapSnapshot ile aynı öncelik: display → symbol.
    final ham = !_bosTahmin(sp['display'])
        ? sp['display']
        : (!_bosTahmin(sp['symbol']) ? sp['symbol'] : null);
    if (ham == null) continue;
    secimler[no] = '$ham';
  }

  return MuhurluSistem(
    secimler: secimler,
    muhurVar: true,
    kilitZamani: snap['lockedAt'] as String?,
    dogrulamaKodu: snap['verificationHash'] as String?,
    gecKilit: snap['late'] == true,
  );
}
