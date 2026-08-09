// KAYNAK: app/src/scorecardLogic.js — BİREBİR çeviri.
//
// SİSTEM KARNESİ EKRAN MANTIĞI — saf yardımcılar (cihazsız test edilebilir).
// KURALLAR:
// * Ana başlık YALNIZ resmî ileri-test tekli ana tahmin (1/X/2) başarısıdır.
// * Kapsama başarısı AYRI bölümdür; ana başarıyla TOPLANMAZ.
// * Resmî veri yoksa dürüst boş durum gösterilir — eski %69 tarzı demo/backfill
//   değerleri ASLA resmî başarı olarak görünmez.
// * Demo veri yalnız açık demo modunda ve kalıcı DEMO etiketiyle gösterilebilir.

const String kCoverageNote =
    'Kapsama başarısı, sistemin tekli ana tahmin doğruluğu değildir. Birden '
    'fazla sonuç seçeneği içerdiği için başarı oranı doğal olarak daha yüksektir.';

const String kOfficialEmptyTitle = 'Henüz resmî ileri-test verisi yok.';
const String kOfficialEmptyMessage =
    'Sistem Karnesi, gerçek Spor Toto bültenlerinde ilk maçtan 5 dakika önce '
    'mühürlenen tahminler sonuçlandıkça otomatik oluşacaktır. Demo ve geçmişe '
    'dönük testler bu başarıya dahil edilmez.';

const String kRetroLabel = 'RESMÎ BAŞARIYA DAHİL DEĞİLDİR';
const String kDemoLabel = 'DEMO VERİ — GERÇEK BAŞARI DEĞİLDİR';
const String kLegacySeparationNote =
    'Eski geliştirme kayıtları resmî başarıdan ayrılmıştır ve bu karneye dahil '
    'edilmez.';
const String kRadarScorecardEmptyText =
    'Radar Karnesi ilk resmî mühürlü hafta sonuçlandığında oluşacaktır. Geçmişe '
    'dönük başarı üretilmez.';

/// NORMAL KULLANICININ GÖRDÜĞÜ SEKMELER — Retrospektif sekmesi YOKTUR.
/// Eski/backfill/retrospektif başarılar hiçbir kullanıcı ekranında gösterilmez.
const List<({String key, String label})> kUserSections = [
  // "Özet" en önde ve VARSAYILAN (kullanıcı isteği, 2026-08-06): ekran teknik
  // dille açılıyordu, sıradan kullanıcı hiçbir şey anlamıyordu.
  (key: 'ozet', label: 'Özet'),
  (key: 'official', label: 'Resmî Karne'),
  (key: 'weeks', label: 'Hafta Hafta'),
  (key: 'byResult', label: '1/X/2'),
  (key: 'coverage', label: 'Kapsama'),
  (key: 'radar', label: 'Radar'),
  // 'Kriter' sekmesi KALDIRILDI (kullanıcı kararı, 2026-08-07): kriter
  // başarıları artık maç detayı → Analiz sekmesinde.
  // Kalibrasyon: "kaç tuttu" değil, SÖYLEDİĞİMİZ OLASILIK ne kadar doğruydu.
  (key: 'calibration', label: 'Kalibrasyon'),
  // 'tech' (Kaynak Şeffaflığı) sekmesi KULLANICIDAN KALDIRILDI (2026-08-06).
];

/// Resmî ana kart gösterilebilir mi? (default-deny: alan yoksa GÖSTERME)
bool hasOfficialData(Map? sc) =>
    sc != null &&
    sc['hasData'] == true &&
    sc['isDemo'] != true &&
    sc['hasOfficialForwardData'] == true;

typedef OfficialHeadline = ({
  String title,
  Object weeks,
  Object total,
  Object correct,
  Object wrong,
  Object accuracy,
  Object accuracy1,
  Map? last5,
  Map? bestWeek,
  List methodologyVersions,
});

/// Ana kart değerleri — yalnız tekli ana tahmin ölçümünden. Kapsama alanları
/// bilerek OKUNMAZ (yanlışlıkla karışmasın).
OfficialHeadline? officialHeadline(Map? sc) {
  if (!hasOfficialData(sc)) return null;
  return (
    title: 'Sistem Master Analizi — Tekli Ana Tahmin İsabeti',
    weeks: sc!['weeksCounted'] ?? 0,
    total: sc['total'] ?? 0,
    correct: sc['correct'] ?? 0,
    wrong: sc['wrong'] ?? 0,
    accuracy: sc['accuracy'] ?? 0,
    accuracy1: sc['accuracy1'] ?? sc['accuracy'] ?? 0,
    last5: sc['last5'] as Map?,
    bestWeek: sc['bestWeek'] as Map?,
    methodologyVersions: (sc['methodologyVersions'] as List?) ?? const [],
  );
}

/// Hafta satırı etiketi: kısmi hafta "13/15" TAM hafta gibi sunulmaz.
String? weekRecordLabel(Map? week) {
  if (week == null) return null;
  if (week['status'] == 'pending') return 'Sonuç bekleniyor';
  final base = '${week['correct']}/${week['evaluated']}';
  return week['status'] == 'partial' ? '$base · kısmi' : base;
}

/// Demo dashboard gösterilebilir mi? Yalnız açık demo modunda (varsayılan: hayır).
bool demoAllowed({bool demoMode = false, bool dev = false}) =>
    demoMode || dev;

/// Eski uç yanıtı resmî gibi mi görünüyor? (kriter karnesi geri düşüş koruması)
/// Yeni alanlar yoksa (çok eski backend) default-deny: resmî sayma.
bool criteriaBadgeUsable(Map? cs) {
  if (cs == null || cs['hasData'] != true) return false;
  if (cs['isDemo'] == true) return false;
  final pt = cs['provenanceType'];
  if (pt != null && pt != 'official_forward') return false;
  if (cs.containsKey('hasOfficialForwardData') &&
      cs['hasOfficialForwardData'] != true) {
    return false;
  }
  // kanıt alanı yok → gösterme
  if (!cs.containsKey('hasOfficialForwardData') &&
      !cs.containsKey('provenanceType')) {
    return false;
  }
  return true;
}

/// Eski radar karnesi (legacy Banko/Sürpriz yüzdeleri) — YENİ BAŞLANGIÇ KARARI:
/// hiçbir kullanıcı ekranında, hiçbir amaçla GÖSTERİLMEZ. Bu işlev bilinçli
/// olarak her durumda null döner (eski çağıran kod kalırsa bile rozet
/// üretilemez).
Object? legacyRadarBadge() => null;
