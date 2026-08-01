// CORS POLİTİKASI — "herkese açık" değil, listeli.
//
// Eski hâl `app.use(cors())` idi: her origin'e izin. Üretim web derlemesi
// backend ile AYNI origin'den sunulduğu için CORS'a zaten ihtiyaç duymaz;
// açık bırakmak yalnız üçüncü taraf sitelerin API'yi tarayıcı üzerinden
// tüketmesine yarar. Yeni kural:
//   • Origin başlığı OLMAYAN istekler (mobil uygulama, curl, same-origin
//     navigasyon) serbesttir — CORS tarayıcı mekanizmasıdır.
//   • ALLOWED_ORIGINS (virgülle ayrık, .env) listedekiler serbest.
//   • Geliştirmede (NODE_ENV !== 'production') localhost/LAN origin'leri
//     serbest — Expo dev web :8081'den API :4000'e erişebilsin.
//   • Kalan her origin: CORS başlığı YAZILMAZ → tarayıcı cevabı engeller.
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function buildCorsOptions({
  allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  production = process.env.NODE_ENV === 'production',
} = {}) {
  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true);                    // Origin'siz istek: serbest
      const temiz = String(origin).replace(/\/+$/, '');
      if (allowedOrigins.includes(temiz)) return cb(null, true);
      if (!production && DEV_ORIGIN.test(temiz)) return cb(null, true);
      return cb(null, false);                                // başlık yazılmaz → tarayıcı engeller
    },
  };
}
