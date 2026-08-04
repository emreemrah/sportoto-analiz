// ÜLKE ŞERİDİ MANTIĞI — saf modül (RN bağımlılığı YOK, ayrıca test edilir).
// ---------------------------------------------------------------------------
// Ana sayfadaki şerit lig adı yerine ÜLKE gösterir (kullanıcı isteği,
// 2026-08-04): "Danimarka · Kulüp · Finlandiya · İsveç · Norveç · Polonya".
// Kaynaktaki lig adları İngilizce ülkeyle başlar ("Denmark Superliga");
// buradan ülke çıkarılır ve Türkçe adı yazılır. Tanınmayan lig adı OLDUĞU
// GİBİ gösterilir — ülke uydurulmaz. "Kulüp Maçları" bizim kendi etiketimiz,
// ülkesi yoktur, "Kulüp" olarak nötr simgeyle görünür.
import { countryCode } from './utils';

export const KULUP_ETIKETI = 'Kulüp Maçları';

// İngilizce ülke adı → Türkçe görünen ad. Yalnız gerçekten karşılaşılabilecek
// adlar; eşleşmeyen lig adı aynen kalır (dürüstlük: çeviri uydurulmaz).
export const EN_TR = {
  Denmark: 'Danimarka', Finland: 'Finlandiya', Sweden: 'İsveç', Norway: 'Norveç',
  Poland: 'Polonya', England: 'İngiltere', Scotland: 'İskoçya', Germany: 'Almanya',
  Spain: 'İspanya', Italy: 'İtalya', France: 'Fransa', Netherlands: 'Hollanda',
  Portugal: 'Portekiz', Belgium: 'Belçika', Turkey: 'Türkiye', Austria: 'Avusturya',
  Switzerland: 'İsviçre', Iceland: 'İzlanda', Ireland: 'İrlanda',
  'Czech Republic': 'Çekya', Czechia: 'Çekya', Croatia: 'Hırvatistan',
  Greece: 'Yunanistan', Hungary: 'Macaristan', Romania: 'Romanya',
  Bulgaria: 'Bulgaristan', Serbia: 'Sırbistan', Slovakia: 'Slovakya',
  Slovenia: 'Slovenya', Ukraine: 'Ukrayna', Russia: 'Rusya',
  Brazil: 'Brezilya', Argentina: 'Arjantin', 'United States': 'ABD', USA: 'ABD',
  Japan: 'Japonya', 'South Korea': 'Güney Kore',
};

/**
 * Lig adından ülke bilgisi çıkarır.
 * @returns { name: görünen ad, en: İngilizce ülke adı | null }
 */
export function ulkeAyikla(league) {
  const ad = String(league || '').trim();
  if (!ad) return null;
  if (ad === KULUP_ETIKETI) return { name: 'Kulüp', en: null };
  const kelimeler = ad.split(/\s+/);
  // Önce iki kelimelik ülke adları ("Czech Republic Fortuna Liga"), sonra tek.
  for (const n of [2, 1]) {
    const aday = kelimeler.slice(0, n).join(' ');
    if (EN_TR[aday]) return { name: EN_TR[aday], en: aday };
  }
  return { name: ad, en: null }; // tanınmadı → lig adı aynen (uydurma yok)
}

/**
 * Bültenden TEKİL ülke listesi (bültendeki ilk görülme sırasıyla).
 * @returns [{ name, code, count }] — code: flagcdn için ISO2 ('' = bayrak yok
 * → ⚽), count: o ülkenin bültendeki maç sayısı (kullanıcı isteği, 2026-08-04).
 */
export function ulkeListesi(matches) {
  const gorulen = new Map();
  for (const m of matches || []) {
    const u = ulkeAyikla(m?.league);
    if (!u) continue;
    const mevcut = gorulen.get(u.name);
    if (mevcut) mevcut.count += 1;
    else gorulen.set(u.name, { name: u.name, code: u.en ? countryCode(u.en) : '', count: 1 });
  }
  return [...gorulen.values()];
}
