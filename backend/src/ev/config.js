// HAVUZ EV MOTORU — SABİTLER VE BİLİNMEYENLER (T10).
//
// Bu dosyanın en önemli işi, BİLDİKLERİMİZİ bilmediklerimizden ayırmaktır.
// Bilinmeyen bir sabiti "makul bir değerle" doldurmak, tüm TL ölçeğini sessizce
// yanlış yapar — bu yüzden bilinmeyenler `null` bırakılır ve motor onlarsız
// yalnız ÖLÇEKSİZ (olasılık/oran) çıktı üretir.

/** Kademe havuz payları — iddaa Spor Toto oyun kuralları ile doğrulandı. */
export const TIER_SHARES = Object.freeze({ 15: 0.35, 14: 0.20, 13: 0.20, 12: 0.25 });
export const TIERS = Object.freeze([15, 14, 13, 12]);
export const MATCH_COUNT = 15;

/**
 * KRİTİK KURAL: Bir kolon yalnızca bildiği EN ÜST dereceden ödeme alır.
 * Kademeler AYRIK olaylardır ("tam olarak k doğru", "en az k" DEĞİL).
 * Bunu kaçırmak beklenen dönüşü yaklaşık %25 şişirir.
 */
export const TIERS_ARE_DISJOINT = true;

/**
 * ρ — hasılatın ikramiyeye giden oranı. **BULUNAMADI (araştırma R1).**
 * 5602 sayılı Kanun'da "%83" bir ÜST SINIR olarak geçiyor; resmî Müşterek Oyun
 * Planı PDF'i makine ile okunamadı. ρ bilinmeden TL ölçeği hesaplanamaz —
 * uydurulmaz. Elle teyit edilince buraya yazılır ve `payoutRatioVerified`
 * true olur; o zamana kadar motor ölçeksiz çalışır.
 */
export const PAYOUT_RATIO = null;
export const PAYOUT_RATIO_SOURCE = 'BULUNAMADI — sportoto.gov.tr Müşterek Oyun Planı PDF elle okunmalı';

/** Kolon bedeli (TL). Düşük güven: haber kaynaklı, resmî tarifeden teyit edilmeli. */
export const COLUMN_PRICE_TL = 10;
export const COLUMN_PRICE_VERIFIED = false;

/** Veraset ve İntikal Vergisi: istisnayı aşan kısma %20 (01.01.2026 istisnası). */
export const TAX_RATE = 0.20;
export const TAX_EXEMPTION_TL = 66935;

/**
 * GÖLGE MOD EŞİKLERİ (R1 §2.4):
 *   • λ (kalabalık yoğunlaşması) haftada yalnız 4 sayıdan öğrenilir → yavaş.
 *   • 30 haftanın altında λ güvenilir DEĞİLDİR.
 *   • 15 haftanın altında hiçbir sayı kullanıcıya gösterilmez.
 */
export const MIN_WEEKS_FOR_LAMBDA = 30;
export const MIN_WEEKS_FOR_DISPLAY = 15;

/** Monte Carlo çekiliş sayısı (gölge kayıt için yeterli, deterministik tohumlu). */
export const DEFAULT_DRAWS = 20000;

/** Motorun bugünkü durumu — gölge kayıtlarına ve ileride ekrana yazılır. */
export function engineReadiness(weeksCalibrated) {
  const w = Number(weeksCalibrated) || 0;
  return {
    weeksCalibrated: w,
    lambdaReliable: w >= MIN_WEEKS_FOR_LAMBDA,
    displayAllowed: false, // T10: motor GÖLGE modda; ekran bağlantısı YOK
    note: w >= MIN_WEEKS_FOR_LAMBDA
      ? `λ ${w} haftalık veriyle kalibre edildi.`
      : `λ güvenilir değil (${w}/${MIN_WEEKS_FOR_LAMBDA} hafta). Motor gölge modda; sayı gösterilmez.`,
  };
}
