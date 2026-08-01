// KUPON MERKEZİ sabitleri — tek yerden yönetilir.
// NOT: Bu bir bahis/ödeme sistemi DEĞİLDİR — kupon hazırlama/takip/başarı ölçme.
//
// FİYAT KURALI (kesin): Birim kolon bedeli KODA YAZILMAZ ve UYDURULMAZ.
// Bedel yalnız backend'in verdiği couponPricing {unitPrice, source, updatedAt}
// kaydından gelir (backend/data/coupon-pricing.json — kaynak+tarih zorunlu).
// Veri yoksa maliyet GÖSTERİLMEZ; "birim bedel verisi yok" denir.
export const COUPON_MAX_COLUMNS = 2500;      // resmi oyun kuralı: kolon üst sınırı
export const MAX_COUPONS_PER_WEEK = 10;      // haftalık kupon hakkı (uygulama kuralı)
export const LOCK_BEFORE_MS = 5 * 60 * 1000; // ilk maçtan 5 dk önce kilit

export const OUTCOMES = ['1', 'X', '2'];        // ekranda görünen
export const toOfficial = (o) => (o === 'X' ? '0' : o); // resmi eşleme: X → 0

// Kolon = seçilen işaret sayılarının çarpımı (tekli=1, çifte=2, üçlü=3).
export function columnCount(selections) {
  return (selections || []).reduce((n, s) => n * Math.max(1, (s.selectedOutcomes || []).length), 1);
}

// Maliyet: yalnız GERÇEK fiyat verisiyle hesaplanır; yoksa null (gösterilmez).
export function costOf(columns, pricing) {
  const u = Number(pricing?.unitPrice);
  return Number.isFinite(u) && u > 0 && Number.isFinite(columns) ? columns * u : null;
}

// Fiyat kaydı geçerli mi? (kaynak + tarih zorunlu — kaynağı belirsiz bedel kullanılmaz)
export function validPricing(p) {
  return !!(p && Number(p.unitPrice) > 0 && p.source && p.updatedAt);
}

// Bültenin kilit anı = ilk maçın başlangıcından 5 dk önce.
// NOT: Bu "bülten kilidi" artık yalnız DERECELİ kupon seçimi ve geçmiş hafta
// koruması için kullanılır. KULLANICI SEÇİMLERİ maç bazında kilitlenir
// (aşağıdaki matchLockAt/lockViolations) — kural: tercih, İLGİLİ MAÇ
// başlamadan önce kaydedilmiş olmalıdır. Böylece hafta ortasında bile
// başlamamış maçlara kupon kurulabilir; başlamış maça dokunulamaz.
export function lockAtOf(matches) {
  const times = (matches || []).map((m) => (m.date ? new Date(m.date).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  return times.length ? Math.min(...times) - LOCK_BEFORE_MS : null;
}
export const isLockedNow = (lockAt) => (lockAt != null && Date.now() >= lockAt);

// ——— MAÇ BAZLI KİLİT ———
// Her maç KENDİ başlangıcından 5 dk önce kilitlenir.
export function matchLockAt(m) {
  const t = m?.date ? new Date(m.date).getTime() : NaN;
  return Number.isNaN(t) ? null : t - LOCK_BEFORE_MS;
}
export const isMatchLocked = (m, now = Date.now()) => {
  const la = matchLockAt(m);
  return la != null && now >= la;
};
/** { maçNo: kilitZamanıMs } — depo doğrulamasına verilir. */
export function lockMapOf(matches) {
  const map = {};
  for (const m of matches || []) {
    const la = matchLockAt(m);
    if (la != null && m.no != null) map[m.no] = la;
  }
  return map;
}
const _norm = (arr) => OUTCOMES.filter((o) => (arr || []).includes(o)).join('');
/**
 * DÜRÜSTLÜK DOĞRULAMASI: kilitlenmiş bir maçın seçimi, kilitten önceki
 * değerinden FARKLI OLAMAZ (yeni kuponda "önceki değer" boştur — yani
 * başlamış maça yeni seçim yapılamaz). Dönen: ihlal edilen maç no listesi.
 */
export function lockViolations({ selections, prevSelections = [], lockMap = {}, now = Date.now() }) {
  const prev = new Map((prevSelections || []).map((s) => [s.no, _norm(s.selectedOutcomes)]));
  const out = [];
  for (const s of selections || []) {
    const la = lockMap[s.no];
    if (la == null || now < la) continue;
    if (_norm(s.selectedOutcomes) !== (prev.get(s.no) || '')) out.push(s.no);
  }
  return out;
}
