// ORAN SINIRLAMA (rate limiting) — yeni paket KURULMADAN, bellek içi.
//
// Amaç: kaba kuvvet (brute force) girişimlerini yavaşlatmak.
//   • Pencere içinde `limit` denemeden fazlası → geçici engel (`blockMs`).
//   • Anahtar: istek IP'si (+ uç adı). E-posta/şifre ASLA anahtar yapılmaz ve
//     ASLA saklanmaz.
//   • Başarılı işlemde sayaç sıfırlanabilir (ör. doğru şifreyle giriş).
//
// SINIR (dürüst not): bellek içi olduğu için tek süreçte geçerlidir; birden çok
// sunucu kopyası çalıştırılırsa paylaşımlı bir depo gerekir. Bu, yayın kontrol
// listesinde açık madde olarak durur.

export function makeRateLimiter({ windowMs = 15 * 60 * 1000, limit = 10, blockMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const hits = new Map(); // key -> { first, count, blockedUntil }

  function sweep(t) {
    // Bellek büyümesin: süresi geçmiş kayıtları ayıkla (her çağrıda ucuz kontrol).
    if (hits.size < 5000) return;
    for (const [k, r] of hits) {
      if ((r.blockedUntil || 0) < t && t - r.first > windowMs) hits.delete(k);
    }
  }

  return {
    /** Deneme kaydeder. Engelliyse { blocked:true, retryAfterSec } döner. */
    hit(key) {
      const t = now();
      sweep(t);
      const r = hits.get(key);
      if (r?.blockedUntil && r.blockedUntil > t) {
        return { blocked: true, retryAfterSec: Math.ceil((r.blockedUntil - t) / 1000) };
      }
      if (!r || t - r.first > windowMs) {
        hits.set(key, { first: t, count: 1, blockedUntil: 0 });
        return { blocked: false };
      }
      r.count += 1;
      if (r.count > limit) {
        r.blockedUntil = t + blockMs;
        return { blocked: true, retryAfterSec: Math.ceil(blockMs / 1000) };
      }
      return { blocked: false };
    },
    /** Başarılı işlemde sayacı temizler (doğru şifre girildiyse ceza kalmaz). */
    clear(key) { hits.delete(key); },
    /** Test için: kayıt sayısı. */
    size() { return hits.size; },
  };
}

/** Express ara katmanı üretir. 429 + Türkçe mesaj + Retry-After başlığı döner. */
export function rateLimitMiddleware(limiter, keyFn) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : `${req.ip || req.socket?.remoteAddress || 'ip?'}:${req.path}`;
    const r = limiter.hit(key);
    if (r.blocked) {
      res.set('Retry-After', String(r.retryAfterSec));
      return res.status(429).json({
        error: `Çok fazla deneme yapıldı. Lütfen ${Math.ceil(r.retryAfterSec / 60)} dakika sonra tekrar dene.`,
      });
    }
    // Başarılı girişte sayacı temizleyebilmek için anahtarı isteğe iliştir.
    req.rateLimitKey = key;
    req.rateLimiter = limiter;
    next();
  };
}
