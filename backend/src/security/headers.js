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
//
// 'wasm-unsafe-eval' (2026-08-11, Flutter web): Flutter'ın çizim motoru
// (CanvasKit/skwasm) WebAssembly derler; katı `script-src 'self'` bunu
// engelliyordu ve sayfa BEYAZ açılıyordu (tarayıcı konsolu: "Compiling or
// instantiating WebAssembly module violates ... 'unsafe-eval'"). Bu anahtar
// SADECE wasm derlemesine izin verir; JavaScript `eval()`/inline script hâlâ
// YASAK — yani 'unsafe-eval' değil, onun dar kapsamlı hâli.
//
// canvaskit KENDİ SUNUCUMUZDAN verilir (backend/public/canvaskit) — Google
// CDN'ine istek GİTMEZ. Tek dış kaynak yazı tipidir:
//
// fonts.gstatic.com (2026-08-11): Flutter'ın çizim motoru varsayılan yazı tipi
// Roboto'yu çalışma anında indirir. Engellenince sayfa açılıyor ama HİÇBİR
// YAZI çizilmiyordu (headless ekran görüntüsüyle doğrulandı: kartlar ve
// ikonlar var, metin yok). İzin `connect-src`'a da gerekli, çünkü motor fontu
// CSS ile değil fetch ile alır. Alternatif, Roboto'yu uygulamaya gömmektir;
// o zaman bu satırlar geri daraltılabilir.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",   // kulüp armaları/bayraklar https kaynaklı olabilir
  "connect-src 'self' https://fonts.gstatic.com",
  "font-src 'self' data: https://fonts.gstatic.com",
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
