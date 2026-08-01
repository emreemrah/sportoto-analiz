// DAR KAPSAMLI SEZON KEŞFİ — kullanıcı .env düzenlemeden lig kapsamı otomatik.
// ---------------------------------------------------------------------------
// KAYNAK KATALOĞU (league-list) yalnız METADATA olarak kullanılır — 1734
// kayıtlık tam kataloğun fixtures/matches verisi ASLA çekilmez. Maç verisi
// yalnız SEÇİLEN az sayıda sezon için istenir (refresh'teki fetchSeason).
// Seçim kuralları:
//  * Kullanıcının kaynak panelinde SEÇTİĞİ liglerle sınırlı (chosen_leagues_only)
//    — bülten sağlayıcı kapsamı zaten bu panelden yönetilir.
//  * Her lig için o tarihteki GÜNCEL sezon (en yüksek yıl kodu).
//  * Kadın / genç (U16–U23) / rezerv / B takımı ligleri VARSAYILAN DIŞI
//    (bülten senior erkek ligleri oynatır).
//  * Aynı seasonId bir kez (env listesiyle birleşimde de tekilleştirilir).
//  * ÜST SINIRLAR: dinamik sezon ve ülke başına aday sınırı — aşılırsa
//    FAIL-CLOSED: yüzlerce sezon çekmek yerine keşif iptal, doğrulanmış .env
//    listesi + son geçerli cache ile devam edilir (kullanıcıya soru sorulmaz,
//    bir sonraki otomatik döngüde yeniden denenir).
//  * Katalog TTL cache'lidir; her maç/refresh için yeniden İSTENMEZ.
//  * Keşif hiçbir zaman kilitli snapshot içeriğini geriye dönük değiştirmez
//    (yalnız hangi sezonların çekileceğini belirler).
import { load, save } from './cache.js';
import { fetchLeagueCatalog } from './sources/footystats.js';

export const DISCOVERY_LIMITS = {
  maxDynamicSeasons: 40,     // bülten başına dinamik sezon üst sınırı
  maxPerCountry: 6,          // ülke başına aday sezon sınırı
  catalogTtlMs: 6 * 3600e3,  // katalog metadata cache süresi
};

// Senior erkek ligi varsayılanı: kadın/genç/rezerv/B takımı desenleri dışlanır.
// (Alt ligler — ör. Poland 1. Liga — kullanıcı panelinde seçiliyse GEÇERLİDİR;
//  bülten alt lig maçı oynatabilir, bu yüzden lig kademesi filtrelenmez.)
const EXCLUDE_RE = /\b(women|woman|female|frauen|kvinner|damer|u-?1[0-9]|u-?2[0-3]|youth|junior|reserves?|b team|ii\s*team)\b/i;

export function isExcludedLeagueName(name) {
  return EXCLUDE_RE.test(String(name || ''));
}

// Saf seçim çekirdeği (test edilebilir): katalog → dar dinamik sezon listesi.
export function selectSeasonsFromCatalog(catalog, {
  envIds = [], limits = DISCOVERY_LIMITS,
} = {}) {
  const envSet = new Set(envIds.map(Number));
  const perCountry = new Map();
  const selected = [];
  const skipped = [];

  for (const lg of catalog || []) {
    const name = lg.name || '';
    const country = lg.country || name.split(' ')[0] || 'bilinmiyor';
    if (isExcludedLeagueName(name)) { skipped.push({ league: name, reason: 'excluded_category' }); continue; }

    // Güncel sezon: en yüksek yıl kodlu, id'li kayıt (uydurma id YOK).
    let best = null;
    for (const s of lg.season || []) {
      if (s?.id == null) continue;
      if (!best || Number(s.year || 0) > Number(best.year || 0)) best = s;
    }
    if (!best) { skipped.push({ league: name, reason: 'no_season_id' }); continue; }

    const id = Number(best.id);
    if (envSet.has(id) || selected.some((x) => x.id === id)) { skipped.push({ league: name, reason: 'already_covered', id }); continue; }

    const cCount = perCountry.get(country) || 0;
    if (cCount >= limits.maxPerCountry) { skipped.push({ league: name, reason: 'country_cap', country }); continue; }

    selected.push({ id, league: name, country, year: best.year ?? null });
    perCountry.set(country, cCount + 1);
  }

  // FAIL-CLOSED: sınır aşımında dinamik keşif tamamen iptal — yüzlerce sezon
  // fixtures çağrısı riskine girilmez; env + cache ile devam edilir.
  if (selected.length > limits.maxDynamicSeasons) {
    return { ids: [], selected: [], skipped, failClosed: true, reason: `dynamic_season_cap(${selected.length}>${limits.maxDynamicSeasons})` };
  }
  return { ids: selected.map((s) => s.id), selected, skipped, failClosed: false };
}

// TTL'li katalog okuma — aynı katalog her maç için yeniden istenmez.
async function getCatalogCached({ ttlMs = DISCOVERY_LIMITS.catalogTtlMs, fetcher = fetchLeagueCatalog } = {}) {
  const cached = load('seasonCatalog');
  const fresh = cached?.data && cached.savedAt && (Date.now() - new Date(cached.savedAt).getTime() < ttlMs);
  if (fresh) return { catalog: cached.data.leagues, fromCache: true, fetchedAt: cached.savedAt };
  const leagues = await fetcher();
  try { save('seasonCatalog', { leagues }); } catch { /* cache yazılamazsa canlı liste kullanılır */ }
  return { catalog: leagues, fromCache: false, fetchedAt: new Date().toISOString() };
}

// ANA GİRİŞ — refresh her bülten için bunu çağırır.
// Dönen ids = env ∪ dinamik (tekil). Katalog erişilemezse: son geçerli keşif
// cache'i, o da yoksa yalnız env listesi (fail-closed, kullanıcı müdahalesiz).
export async function discoverSeasonIds({
  envIds = [], roundId = null, limits = DISCOVERY_LIMITS, fetcher = fetchLeagueCatalog, log = console.log,
} = {}) {
  const envList = [...new Set(envIds.map(Number))];
  try {
    const { catalog, fromCache } = await getCatalogCached({ ttlMs: limits.catalogTtlMs, fetcher });
    const sel = selectSeasonsFromCatalog(catalog, { envIds: envList, limits });
    const meta = {
      catalogCount: (catalog || []).length, catalogFromCache: fromCache,
      dynamicCount: sel.ids.length, failClosed: sel.failClosed, reason: sel.reason ?? null,
      selected: sel.selected, roundId,
    };
    try { save('seasonDiscovery', { roundId, ids: sel.ids, meta }); } catch { /* no-op */ }
    if (sel.failClosed) {
      log(`[sezon-keşfi] FAIL-CLOSED (${sel.reason}) — yalnız doğrulanmış .env listesiyle devam.`);
      return { ids: envList, meta };
    }
    return { ids: [...new Set([...envList, ...sel.ids])], meta };
  } catch (e) {
    // Katalog başarısız → son geçerli keşif cache'i, yoksa env (dürüst fallback).
    const prev = load('seasonDiscovery')?.data;
    const prevIds = Array.isArray(prev?.ids) ? prev.ids.map(Number) : [];
    log(`[sezon-keşfi] katalog alınamadı (${e.message}) — ${prevIds.length ? 'son geçerli keşif' : 'yalnız .env listesi'} kullanılıyor.`);
    return {
      ids: [...new Set([...envList, ...prevIds])],
      meta: { catalogCount: null, dynamicCount: prevIds.length, failClosed: false, fallback: prevIds.length ? 'last-discovery-cache' : 'env-only', error: e.message },
    };
  }
}
