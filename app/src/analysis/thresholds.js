// KUPON KARAR EŞİKLERİ — TEK DOĞRULUK KAYNAĞI (T14).
//
// NEDEN: Aynı sayılar iki motorda ayrı ayrı yazılıydı (decisionEngine.js ve
// analysis/engine.js). Biri değiştirilip diğeri unutulursa iki ekran aynı maç
// için farklı karar verir ve bu SESSİZ bir hatadır — kimse fark etmez.
// Artık ikisi de buradan okur; eşik değişirse tek yerde değişir.
//
// DEĞER DEĞİŞTİRİLMEDİ: buradaki sayılar refactor öncesi davranışın birebir
// aynısıdır (app/test/esik-birligi.test.mjs altın değerlerle kanıtlıyor).
//
// NOT: Bu eşikler "olasılık" değil, KRİTER PAYI / ihtimal yüzdesi üzerinde
// çalışır. Yorumu: "bu seçenek kupondan silinemeyecek kadar canlı mı?"

/** X (beraberlik) bu payın üstündeyse geniş kupondan SİLİNMEZ. */
export const X_KEEP_PCT = 20;

/** 2 (deplasman) bu payın üstündeyse geniş kupondan SİLİNMEZ. */
export const AWAY_KEEP_PCT = 30;

/** 1 (ev sahibi) bu payın üstündeyse geniş kupondan SİLİNMEZ (kriter motoru). */
export const HOME_KEEP_PCT = 30;

/** 1 ile 2 arasındaki fark bu değerin ALTINDAysa güçler yakın → tek oynanmaz. */
export const CLOSE_GAP_PCT = 15;

/** Favori payı bu değerin ALTINDAysa "güçlü aday" değerlendirmesi yapılmaz. */
export const FAVORITE_MIN_PCT = 50;

/**
 * Etiket ağırlığı hesabında kullanılan taban/ölçek sayıları.
 * (Formüller motorlarda kalır; yalnız sabitler burada toplanır.)
 */
export const TAG_BASE = 45;          // "silinmez" ailesinden etiketlerin tabanı
export const TAG_BASE_STRONG = 55;   // "tek oynanmaz" gibi daha ağır etiketler
export const AWAY_TAG_PIVOT = 28;    // 2 etiketlerinde ağırlık pivotu
