// KAYNAK: app/src/radarScreenLogic.js + app/src/radarGun.js — BİREBİR çeviri.
//
// RADAR EKRANI DURUM MAKİNESİ — saf yardımcılar (Flutter'sız test edilebilir).
// Ekranın 5 durumu:
//   loading         → yükleniyor (iskelet + spinner)
//   error           → API hatası ("Radar verisi alınamadı" + Tekrar Dene)
//   currentPending  → GÜNCEL hafta, bülten/radar henüz yok (dürüst bekleme —
//                     ASLA "arşiv yok" değil)
//   data            → veri var (kısmi bile olsa maç kartları gösterilir)
//   pastUnarchived  → GERÇEKTEN arşivlenmemiş GEÇMİŞ hafta
//
// KURAL: Güncel hafta backend'in `current: true` alanıyla tanınır — roundId
// sıralamasıyla "en büyük id günceldir" varsayımı YAPILMAZ.

enum RadarEkranDurumu { loading, error, currentPending, data, pastUnarchived }

/// `Number(null) === 0` tuzağı — id 0 sanılmasın diye null/'' ayrı elenir.
num? _num(Object? v) {
  if (v == null || v == '') return null;
  final n = v is num ? v : num.tryParse('$v');
  return (n != null && n.isFinite) ? n : null;
}

class NormalizedWeeks {
  const NormalizedWeeks({this.currentRoundId, required this.weeks});
  final num? currentRoundId;
  final List<Map<String, dynamic>> weeks;
}

/// `/api/radar/weeks` yanıtını normalize eder: roundId sayıya çevrilir; eski
/// backend yanıtlarında (`current` alanı yoksa) `currentRoundId`
/// karşılaştırmasıyla geriye uyumlu doldurulur.
NormalizedWeeks normalizeWeeks(Map? wk) {
  final currentRoundId = _num(wk?['currentRoundId']);
  final weeks = <Map<String, dynamic>>[];

  for (final raw in (wk?['weeks'] as List?) ?? const []) {
    final w = raw as Map;
    final rid = _num(w['roundId']);
    if (rid == null) continue;

    final currentAlani = w['current'];
    final current =
        currentAlani == true ||
        (currentAlani == null &&
            currentRoundId != null &&
            rid == currentRoundId);

    final sealed = w['sealed'] == true;
    final archivedAlani = w['archived'];

    weeks.add({
      ...Map<String, dynamic>.from(w),
      'roundId': rid,
      'current': current,
      'locked': w['locked'] == true || sealed,
      'archived':
          archivedAlani == true ||
          (archivedAlani == null && !current && sealed),
    });
  }

  return NormalizedWeeks(currentRoundId: currentRoundId, weeks: weeks);
}

/// Güncel hafta id'si: hafta listesindeki `current` işareti > `currentRoundId`
/// > `/current` yanıtındaki roundId.
num? resolveCurrentId(Map? d, Map? wk) {
  for (final raw in (wk?['weeks'] as List?) ?? const []) {
    if ((raw as Map)['current'] == true) {
      final rid = _num(raw['roundId']);
      if (rid != null) return rid;
    }
  }
  final fromWk = _num(wk?['currentRoundId']);
  if (fromWk != null) return fromWk;
  if (d?['current'] == false) return null;
  return _num(d?['roundId']);
}

bool isCurrentWeek(Map? w, Object? curId) {
  if (w?['current'] == true) return true;
  final rid = _num(w?['roundId']);
  final cur = _num(curId);
  return rid != null && cur != null && rid == cur;
}

/// Backend'in "arşiv yok / kayıt yok" metni mi? (Güncel haftada bu metin
/// KULLANICIYA ASLA gösterilmez — `currentPending` durumuna çevrilir.)
bool isMissingArchiveError(Object? message) {
  final m = '${message ?? ''}'.toLowerCase();
  return m.contains('arşivi yok') ||
      m.contains('arşiv yok') ||
      m.contains('kaydı yok') ||
      m.contains('kayıt yok');
}

/// Ekran durumu türetimi.
RadarEkranDurumu deriveScreenState({
  required bool loading,
  Object? error,
  Map? view,
  List? legacyRadar,
  Map? meta,
}) {
  if (loading) return RadarEkranDurumu.loading;

  if (error != null) {
    // Güncel haftada "arşiv yok" hatası bir VERİ hatası değil, yanlış
    // sınıflandırmadır → dürüst bekleme durumu gösterilir.
    if (meta?['current'] != false && isMissingArchiveError(error)) {
      return RadarEkranDurumu.currentPending;
    }
    if (meta?['current'] == false && isMissingArchiveError(error)) {
      return RadarEkranDurumu.pastUnarchived;
    }
    return RadarEkranDurumu.error;
  }

  final matches = view?['matches'];
  if (view?['hasData'] == true && matches is List && matches.isNotEmpty) {
    return RadarEkranDurumu.data;
  }
  if (legacyRadar != null && legacyRadar.isNotEmpty) {
    return RadarEkranDurumu.data;
  }
  if (meta?['current'] == false) return RadarEkranDurumu.pastUnarchived;
  return RadarEkranDurumu.currentPending;
}

/// Duruma göre kullanıcı metni (uydurma yok, iddialı dil yok).
String? screenStateMessage(
  RadarEkranDurumu state,
  Map? meta,
) => switch (state) {
  RadarEkranDurumu.error => 'Radar verisi alınamadı.',
  RadarEkranDurumu.currentPending =>
    '${meta?['note'] ?? 'Güncel resmî bülten bekleniyor — radar, bülten açıklanınca hesaplanır.'}',
  RadarEkranDurumu.pastUnarchived =>
    'Bu hafta arşivlenmemiş — mühürlü radar kaydı bulunmuyor.',
  _ => null,
};

// ═══════════════════════════════════════════════════════════════════════════
// RADAR GÜN SEÇİMİ (kaynak: radarGun.js)
//
// GERÇEK HATA (2 Ağustos 2026, pazar): Radar 3 CUMA gününde takılı kalıyordu.
// İki kusur üst üste bindi:
//
//   1. Gelecek günler aday olmaktan ELENMİYORDU. Bülten 2-7 Ağustos arasını
//      kapsıyor; 3-7 Ağustos'un hepsi "gelecek". Seçici "veri olan SON gün"
//      dediği için 7 Ağustos Cuma'yı seçiyordu.
//   2. "Veri var mı" kontrolü hücrenin DOĞRULUĞUNA bakıyordu. Gelecek günlerin
//      hücresi BOŞ NESNE (`{}`) geliyor ve boş nesne JavaScript'te doğrudur —
//      dolayısıyla veri sayılıyordu.
//
// İkisi ayrı ayrı zararsız görünür, birlikte ekranı yanlış güne kilitler ve
// HİÇBİR HATA VERMEZ. Kullanıcı bugünün verisini göremez.
//
// KURAL: varsayılan gün, GERÇEK VERİSİ OLAN en son geçmiş/bugün günüdür.
// Gelecek gün asla varsayılan olmaz — henüz oynanmamış bir günün oynanma
// yüzdesi yoktur.
// ═══════════════════════════════════════════════════════════════════════════

/// Hücrede gerçekten veri var mı? BOŞ NESNE VERİ DEĞİLDİR.
bool hucreDolu(Object? hucre) {
  if (hucre is! Map) return false;
  return hucre.isNotEmpty;
}

/// Ekranda açılacak varsayılan günü seçer.
///
/// [days] `[{ date, future }]`
/// [matches] `[{ cells: { [date]: hücre } }]`
/// [hucreSec] maç + tarih → hücre (radarlar farklı yerde tutar)
String? varsayilanGun(
  List? days,
  List? matches, [
  Object? Function(Map m, String tarih)? hucreSec,
]) {
  final sec = hucreSec ?? ((m, t) => (m['cells'] as Map?)?[t]);
  final liste = (days ?? const []).cast<Map>();
  if (liste.isEmpty) return null;

  final gecmisVeBugun = liste.where((g) => g['future'] != true).toList();

  // Bültenin tamamı ileri tarihliyse (yeni açılmış hafta) EN YAKIN günü göster.
  // Son günü göstermek, kullanıcıyı bir hafta sonrasına atardı.
  if (gecmisVeBugun.isEmpty) return liste.first['date'] as String?;

  final verili = gecmisVeBugun.where((g) {
    final tarih = '${g['date']}';
    return (matches ?? const []).cast<Map>().any(
      (m) => hucreDolu(sec(m, tarih)),
    );
  }).toList();

  // Hiçbirinde veri yoksa yine de en son geçmiş/bugün gününde kal — gelecek
  // güne kaçmak yanlış bilgi izlenimi verir.
  final secilen = verili.isNotEmpty ? verili.last : gecmisVeBugun.last;
  return secilen['date'] as String?;
}
