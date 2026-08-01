// GÜVENLİK BAŞLIKLARI — paket KURULMADAN (helmet'in bu projede karşılığı).
//
// Neden paket değil: projede oran sınırlama da bilinçli olarak paketsiz
// yazıldı (rateLimit.js); kullanılmayan/dolaylı bağımlılık = gereksiz saldırı
// yüzeyi (güvenlik denetimi notu). Buradaki başlıklar helmet'in aynı işi
// yapan çekirdek kümesidir.
//
// CSP notu (Expo web uyumu): style-src 'unsafe-inline' ŞARTTIR — React Native
// Web stilleri <style> enjeksiyonuyla verir; yasal sayfalar da gömülü <style>
// kullanır. script-src 'self' bırakıldı: expo export çıktısı harici bundle
// dosyalarına bağlanır. Web derlemesi ileride satır-içi script'e ihtiyaç
// duyarsa bu satır gevşetilmeli ve gerekçesi buraya yazılmalıdır.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",   // kulüp armaları/bayraklar https kaynaklı olabilir
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-ancestors 'none'",        // clickjacking: sayfa iframe'e alınamaz
  "base-uri 'self'",
].join('; ');

export function securityHeaders({ production = process.env.NODE_ENV === 'production' } = {}) {
  return (req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.set('Content-Security-Policy', CSP);
    // HSTS yalnız üretimde: geliştirmede http://localhost'u bozar.
    if (production) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  };
}
