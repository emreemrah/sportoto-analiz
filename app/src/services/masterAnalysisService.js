// app/src/services/masterAnalysisService.js
// MASTER ANALİZ istemcisi — kriter hesabının TEK DOĞRULUK KAYNAĞI backend'dir.
// Bu servis profili gönderir, hesaplanmış sonucu getirir ve kısa süre önbelleğe
// alır (aynı maç + aynı profil sürümü için tekrar hesap istenmez).
// Sunucuya ulaşılamazsa null döner; ekran "çevrimdışı — yerel hızlı görünüm"
// notuyla mevcut yerel motoru gösterir (aynı mantığın parite-testli kopyası).
import { archivePost, archiveGet } from './archiveClient';

const cache = new Map(); // key → { at, val }
const TTL_MS = 60 * 1000;

const profileKey = (p) => `${p?.id || 'none'}@v${p?.version || 0}:${p?.mode || 'manual'}:${JSON.stringify(p?.globalFilters || {})}`;

function payloadOf(profile) {
  return {
    profile: profile ? {
      id: profile.id || 'local',
      name: profile.name,
      version: profile.version,
      mode: profile.mode || 'manual',
      globalFilters: profile.globalFilters || null,
      criteria: profile.criteria || {},
    } : null,
  };
}

// Tek maç Master Analizi (güncel bülten). Dönen: { match: { master, ... } } | null.
export async function calculateMatchMaster(no, profile) {
  const key = `m:${no}:${profileKey(profile)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.val;
  try {
    const res = await archivePost(`/api/analysis/matches/${no}/calculate`, payloadOf(profile));
    cache.set(key, { at: Date.now(), val: res });
    return res;
  } catch (e) {
    return null; // çevrimdışı/eski sunucu — çağıran yerel görünüme düşer
  }
}

// Bülten geneli (15 maç) Master Analizi — güncel veya MÜHÜRLÜ hafta.
export async function calculateBulletinMaster(bulletinId, profile) {
  const key = `b:${bulletinId}:${profileKey(profile)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.val;
  try {
    const res = await archivePost(`/api/analysis/bulletins/${bulletinId}/calculate`, payloadOf(profile));
    cache.set(key, { at: Date.now(), val: res });
    return res;
  } catch { return null; }
}

// Resmî Sistem Master Analizi (mühürlü haftada snapshot'tan).
export async function getOfficialAnalysis(bulletinId) {
  try { return await archiveGet(`/api/analysis/bulletins/${bulletinId}/official`); } catch { return null; }
}

// Kriter karnesi (yeni motor) — ekran rozetleri için { key: satır } indeksi.
export async function getCriteriaScorecardIndex() {
  try {
    const d = await archiveGet('/api/analysis/criteria-scorecard');
    if (!d?.criteria) return { note: d?.note || null, byKey: null };
    return { note: d.note || null, byKey: Object.fromEntries(d.criteria.map((c) => [c.key, c])) };
  } catch { return { note: null, byKey: null }; }
}

// Backend katalog metası (veri var/yok + açıklamalar + aileler).
export async function getCriteriaCatalog() {
  try { return await archiveGet('/api/analysis/criteria'); } catch { return null; }
}

export function _clearMasterAnalysisCacheForTests() { cache.clear(); }
