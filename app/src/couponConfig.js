// Kupon sabitleri — tek yerden yönetilir (ileride değişirse burası güncellenir).
// NOT: Bu bir bahis/ödeme sistemi DEĞİLDİR — kupon hazırlama/takip/başarı ölçme.
export const COUPON_COLUMN_PRICE = 10;      // TL / kolon
export const COUPON_MAX_COLUMNS = 2500;     // resmi üst limit (kolon)
export const COUPON_MAX_AMOUNT = 25000;     // resmi üst limit (TL)
export const MAX_COUPONS_PER_WEEK = 10;     // haftalık kupon hakkı
export const LOCK_BEFORE_MS = 5 * 60 * 1000; // ilk maçtan 5 dk önce kilit
export const BUDGET_PRESETS = [100, 250, 500, 1000, 2500, 5000, 25000];

export const OUTCOMES = ['1', 'X', '2'];        // ekranda görünen
export const toOfficial = (o) => (o === 'X' ? '0' : o); // resmi eşleme: X → 0

// Kolon = seçilen işaret sayılarının çarpımı (tekli=1, çifte=2, üçlü=3).
export function columnCount(selections) {
  return (selections || []).reduce((n, s) => n * Math.max(1, (s.selectedOutcomes || []).length), 1);
}
export function couponAmount(columns) { return columns * COUPON_COLUMN_PRICE; }

// Bültenin kilit anı = ilk maçın başlangıcından 5 dk önce.
export function lockAtOf(matches) {
  const times = (matches || []).map((m) => (m.date ? new Date(m.date).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  return times.length ? Math.min(...times) - LOCK_BEFORE_MS : null;
}
export const isLockedNow = (lockAt) => (lockAt != null && Date.now() >= lockAt);
