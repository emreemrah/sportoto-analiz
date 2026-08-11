// KAYNAK: app/src/couponConfig.js — BİREBİR çeviri.
//
// KUPON MERKEZİ sabitleri — tek yerden yönetilir.
// NOT: Bu bir bahis/ödeme sistemi DEĞİLDİR — kupon hazırlama/takip/başarı ölçme.
//
// FİYAT KURALI (kesin): Birim kolon bedeli KODA YAZILMAZ ve UYDURULMAZ.
// Bedel yalnız backend'in verdiği couponPricing {unitPrice, source, updatedAt}
// kaydından gelir (backend/data/coupon-pricing.json — kaynak+tarih zorunlu).
// Veri yoksa maliyet GÖSTERİLMEZ; "birim bedel verisi yok" denir.

/// Resmi oyun kuralı: kolon üst sınırı.
const int kCouponMaxColumns = 2500;

/// Haftalık kupon hakkı (uygulama kuralı).
const int kMaxCouponsPerWeek = 10;

/// İlk maçtan 5 dk önce kilit.
const Duration kLockBefore = Duration(minutes: 5);

/// Ekranda görünen işaretler.
const List<String> kOutcomes = ['1', 'X', '2'];

/// Resmi eşleme: X → 0
String toOfficial(String o) => o == 'X' ? '0' : o;

/// Bir maçın kupon seçimi.
class CouponSelection {
  const CouponSelection({required this.no, this.selectedOutcomes = const []});

  final Object no;
  final List<String> selectedOutcomes;
}

/// Kolon = seçilen işaret sayılarının çarpımı (tekli=1, çifte=2, üçlü=3).
int columnCount(List<CouponSelection>? selections) {
  var n = 1;
  for (final s in selections ?? const <CouponSelection>[]) {
    final k = s.selectedOutcomes.length;
    n *= k < 1 ? 1 : k;
  }
  return n;
}

/// Maliyet: yalnız GERÇEK fiyat verisiyle hesaplanır; yoksa null
/// (gösterilmez — uydurma bedel yazılmaz).
double? costOf(int? columns, Map? pricing) {
  final u = pricing?['unitPrice'];
  final unit = u is num ? u.toDouble() : double.tryParse('$u');
  if (unit == null || !unit.isFinite || unit <= 0) return null;
  if (columns == null) return null;
  return columns * unit;
}

/// Fiyat kaydı geçerli mi? (kaynak + tarih zorunlu — kaynağı belirsiz bedel
/// kullanılmaz)
bool validPricing(Map? p) {
  if (p == null) return false;
  final u = p['unitPrice'];
  final unit = u is num ? u.toDouble() : double.tryParse('$u');
  return unit != null &&
      unit > 0 &&
      p['source'] != null &&
      '${p['source']}'.isNotEmpty &&
      p['updatedAt'] != null;
}

DateTime? _tarih(Object? iso) =>
    iso is String ? DateTime.tryParse(iso)?.toLocal() : null;

/// Bültenin kilit anı = ilk maçın başlangıcından 5 dk önce.
///
/// NOT: Bu "bülten kilidi" artık yalnız DERECELİ kupon seçimi ve geçmiş hafta
/// koruması için kullanılır. KULLANICI SEÇİMLERİ maç bazında kilitlenir
/// (aşağıdaki matchLockAt/lockViolations) — kural: tercih, İLGİLİ MAÇ
/// başlamadan önce kaydedilmiş olmalıdır. Böylece hafta ortasında bile
/// başlamamış maçlara kupon kurulabilir; başlamış maça dokunulamaz.
DateTime? lockAtOf(List? matches) {
  DateTime? enErken;
  for (final raw in matches ?? const []) {
    final t = _tarih((raw as Map)['date']);
    if (t == null) continue;
    if (enErken == null || t.isBefore(enErken)) enErken = t;
  }
  return enErken?.subtract(kLockBefore);
}

bool isLockedNow(DateTime? lockAt, {DateTime? now}) =>
    lockAt != null && !(now ?? DateTime.now()).isBefore(lockAt);

// ——— MAÇ BAZLI KİLİT ———
// Her maç KENDİ başlangıcından 5 dk önce kilitlenir.

DateTime? matchLockAt(Map? m) {
  final t = _tarih(m?['date']);
  return t?.subtract(kLockBefore);
}

bool isMatchLocked(Map? m, {DateTime? now}) {
  final la = matchLockAt(m);
  return la != null && !(now ?? DateTime.now()).isBefore(la);
}

/// `{ maçNo: kilitZamanı }` — depo doğrulamasına verilir.
Map<Object, DateTime> lockMapOf(List? matches) {
  final map = <Object, DateTime>{};
  for (final raw in matches ?? const []) {
    final m = raw as Map;
    final la = matchLockAt(m);
    if (la != null && m['no'] != null) map[m['no'] as Object] = la;
  }
  return map;
}

String _norm(List<String>? arr) =>
    kOutcomes.where((o) => (arr ?? const []).contains(o)).join();

/// DÜRÜSTLÜK DOĞRULAMASI: kilitlenmiş bir maçın seçimi, kilitten önceki
/// değerinden FARKLI OLAMAZ (yeni kuponda "önceki değer" boştur — yani
/// başlamış maça yeni seçim yapılamaz).
///
/// Dönen: ihlal edilen maç no listesi.
List<Object> lockViolations({
  required List<CouponSelection> selections,
  List<CouponSelection> prevSelections = const [],
  Map<Object, DateTime> lockMap = const {},
  DateTime? now,
}) {
  final simdi = now ?? DateTime.now();
  final prev = {
    for (final s in prevSelections) s.no: _norm(s.selectedOutcomes),
  };

  final out = <Object>[];
  for (final s in selections) {
    final la = lockMap[s.no];
    if (la == null || simdi.isBefore(la)) continue;
    if (_norm(s.selectedOutcomes) != (prev[s.no] ?? '')) out.add(s.no);
  }
  return out;
}
