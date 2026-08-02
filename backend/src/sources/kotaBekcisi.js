// KOTA BEKÇİSİ — FootyStats saatlik istek bütçesini korur.
// ---------------------------------------------------------------------------
// GERÇEK OLAY (2 Ağustos 2026): kota tükendi, TÜM sezonlar HTTP 429 aldı ve
// bülten 14/15 → 0/15'e düştü. O sefer sebebi geliştirme sırasında arka
// arkaya çalıştırılan yenilemelerdi. Ama YAYINDA da aynı sonuca varan bir yol
// var ve kullanıcı sayısından bağımsız:
//
//   /api/history/:roundId, başlamış-sonuçsuz maçların skorunu FootyStats'tan
//   tazeliyor. Kısıt HAFTA BAŞINA 60 saniye — GLOBAL DEĞİL. Bir haftada en
//   çok 15 maç = 15 istek/dk = 900 istek/saat. Maç akşamı 3 farklı hafta
//   görüntülenirse 2.700 istek/saat eder ve 1.800'lük kota AŞILIR.
//   Kotayı 10 kullanıcı da 10.000 kullanıcı da aynı şekilde doldurur;
//   tehlike kullanıcı sayısında değil, TAVANIN OLMAMASINDA.
//
// KURAL: kota azaldığında İSTEĞE BAĞLI çağrılar reddedilir, ZORUNLU olanlar
// (zamanlanmış yenileme — bültenin varlık sebebi) korunur. Yani canlı skor
// tazelemesi durur, bülten ayakta kalır. Tersi olsaydı sistem, süs niteliğinde
// bir güncelleme için asıl veriyi kaybederdi.
//
// SAYAÇ TAHMİN DEĞİL: kalan hak, API'nin kendi yanıtındaki `request_remaining`
// alanından okunur. Kendi saydığımız sayı, başka bir süreç de aynı anahtarı
// kullanıyorsa yanılırdı.

// Zorunlu iş için ayrılan pay. Bir tam yenileme ~130 istek; iki yenilemelik
// pay bırakmak, kota dolmadan önce en az bir kez daha bülten çekebilmeyi
// garanti eder.
export const REZERV = 300;

let kalan = null;        // API'nin bildirdiği son değer
let limit = null;
let sonGuncelleme = 0;

/** API yanıtındaki metadata'dan kota bilgisini işler. */
export function kotayiIsle(json) {
  const m = json?.metadata;
  if (!m) return;
  const r = Number(m.request_remaining);
  const l = Number(m.request_limit);
  if (Number.isFinite(r)) { kalan = r; sonGuncelleme = Date.now(); }
  if (Number.isFinite(l)) limit = l;
}

/** Teşhis/izleme için anlık durum. */
export function kotaDurumu() {
  return { kalan, limit, sonGuncelleme: sonGuncelleme || null };
}

/**
 * İsteğe bağlı bir çağrı şu an yapılabilir mi?
 * Kota bilgisi HENÜZ YOKSA izin verilir — bilinmezlik yüzünden özelliği
 * kapatmak, olmayan bir sorun için gerçek bir işlevi kaybetmek olurdu.
 * İlk yanıtla birlikte gerçek sayı öğrenilir.
 */
export function istegeBagliYapilabilir() {
  return kalan === null || kalan > REZERV;
}

/** Testler için sıfırlama. */
export function sifirla() { kalan = null; limit = null; sonGuncelleme = 0; }
