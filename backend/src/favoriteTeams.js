// FAVORİ TAKIM KATALOĞU — profildeki "Takımım" seçimi için lig → takım listesi.
// (Kullanıcı isteği, 2026-08-04: serbest yazı yerine seçim ekranı.)
// ---------------------------------------------------------------------------
// Kaynak: sezon kataloğu (seasonCatalog cache) + league-teams. Yalnız aşağıda
// SEÇİLİ ligler sunulur; katalogda olmayan lig LİSTEYE GİRMEZ (uydurma yok).
// Takım adları kaynaktaki gibi aynen kullanılır. Sonuç 7 gün cache'lenir —
// takım listeleri sezon içinde değişmez, gereksiz API çağrısı yapılmaz.
import { load, save } from './cache.js';
import { fetchTeams } from './sources/footystats.js';

// Katalogdaki İngilizce lig adı → ekranda görünen Türkçe ad.
// Sıra ekrandaki sırayı belirler (Türkiye üstte — kullanıcı kitlesi Türk).
export const SECILI_LIGLER = [
  { key: 'Turkey Süper Lig', label: 'Türkiye · Süper Lig' },
  { key: 'Turkey 1. Lig', label: 'Türkiye · 1. Lig' },
  { key: 'England Premier League', label: 'İngiltere · Premier League' },
  { key: 'Spain La Liga', label: 'İspanya · La Liga' },
  { key: 'Italy Serie A', label: 'İtalya · Serie A' },
  { key: 'Germany Bundesliga', label: 'Almanya · Bundesliga' },
  { key: 'Portugal Liga NOS', label: 'Portekiz · Liga Portugal' },
  { key: 'Netherlands Eredivisie', label: 'Hollanda · Eredivisie' },
  { key: 'France Ligue 1', label: 'Fransa · Ligue 1' },
];

const CACHE_KEY = 'favoriteTeams';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

/** Katalog kaydından en güncel sezon id'sini seçer (en büyük year). Saf. */
export function enGuncelSezon(ligKaydi) {
  const sezonlar = Array.isArray(ligKaydi?.season) ? ligKaydi.season : [];
  let en = null;
  for (const s of sezonlar) {
    if (s?.id == null) continue;
    if (!en || Number(s.year || 0) > Number(en.year || 0)) en = s;
  }
  return en ? en.id : null;
}

/** Katalogdan seçili liglerin {key, label, seasonId, image} listesi. Saf. */
export function ligListesiHazirla(katalogLigleri) {
  const adaGore = new Map((katalogLigleri || []).map((l) => [l.name, l]));
  const out = [];
  for (const sl of SECILI_LIGLER) {
    const kayit = adaGore.get(sl.key);
    if (!kayit) continue; // katalogda yoksa listeye girmez — uydurma yok
    const seasonId = enGuncelSezon(kayit);
    if (seasonId == null) continue;
    out.push({ key: sl.key, label: sl.label, seasonId, image: kayit.image || null });
  }
  return out;
}

/**
 * Lig → takım listesi (cache'li). Bir ligin takımları çekilemezse o lig
 * `error:true` ile işaretlenir, listeden düşmez — ekran "yüklenemedi" der.
 */
export async function favoriTakimKatalogu() {
  const cached = load(CACHE_KEY);
  const taze = cached?.data && cached.savedAt
    && (Date.now() - new Date(cached.savedAt).getTime() < CACHE_TTL_MS);
  if (taze) return cached.data;

  const katalog = load('seasonCatalog')?.data?.leagues || [];
  const ligler = ligListesiHazirla(katalog);

  const sonuc = [];
  for (const lig of ligler) {
    try {
      const takimlar = await fetchTeams(lig.seasonId);
      sonuc.push({
        key: lig.key,
        label: lig.label,
        image: lig.image,
        teams: takimlar
          .map((t) => ({ name: t.name, cleanName: t.cleanName || t.name, image: t.image || null }))
          .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
      });
    } catch (e) {
      sonuc.push({ key: lig.key, label: lig.label, image: lig.image, teams: [], error: true });
    }
  }

  const data = { generatedAt: new Date().toISOString(), leagues: sonuc };
  try { save(CACHE_KEY, data); } catch { /* cache yazılamazsa canlı sonuç döner */ }
  return data;
}
