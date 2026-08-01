// SUPABASE SAYFALAMA — sessiz veri kaybına karşı tek nokta.
//
// SORUN: PostgREST bir istekte en çok db-max-rows satır döndürür (Supabase
// varsayılanı 1000). Sınıra çarpınca HATA VERMEZ; yalnız eksik veri döner.
// Çağıran taraf 1000 satırın "hepsi" olduğunu sanır. Bu proje sayı uydurmama
// sözü veriyor; sessizce kırpılmış bir kümeden hesaplanan yüzde de uydurma
// sayıdır. Gerçek olay: Radar 5 sıra yüzdeleri 2250 satırlık arşivin ilk
// 1000'inden hesaplanıyordu ve "2025/2026 · 44 hafta" yazıyordu — o sezonda
// 52 hafta oynanmıştı.
//
// SIRALAMA ŞART: .order() olmadan satır sırası garanti değildir; sayfalama
// aynı satırı iki kez getirebilir ya da atlayabilir. Çağıran KARARLI bir
// sıralama vermelidir (gerekirse benzersiz bir sütunla bitirerek).

export const SAYFA_BOYU = 1000;

/**
 * Bir Supabase sorgusunun TÜM satırlarını sayfa sayfa okur.
 *
 * @param {() => object} sorguYap  Her sayfada YENİDEN çağrılır ve taze bir
 *   sorgu kurucu döndürmelidir. Supabase kurucuları tek kullanımlıktır;
 *   aynı nesneyi tekrar kullanmak ikinci sayfada hata verir.
 * @param {{ sayfa?: number, enCok?: number }} [secenek]
 *   enCok: güvenlik sınırı — beklenmedik bir döngüde sonsuza gitmemek için.
 */
export async function tumSatirlar(sorguYap, { sayfa = SAYFA_BOYU, enCok = 200000 } = {}) {
  const hepsi = [];
  for (let bas = 0; bas < enCok; bas += sayfa) {
    const { data, error } = await sorguYap().range(bas, bas + sayfa - 1);
    if (error) throw new Error(error.message);
    const dilim = data || [];
    hepsi.push(...dilim);
    // Tam sayfa dolmadıysa son sayfadayız. Eşitse bir tur daha denenir;
    // fazladan bir boş istek, eksik veriden iyidir.
    if (dilim.length < sayfa) return hepsi;
  }
  throw new Error(`sayfalama güvenlik sınırını aştı (${enCok} satır) — sorguyu daraltın`);
}
