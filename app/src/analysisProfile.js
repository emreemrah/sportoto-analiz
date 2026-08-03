// KULLANICI ANALİZ PROFİLLERİ (v2) — ÇOKLU PROFİL + SÜRÜMLEME + MOD + FİLTRE.
// * Eski v1 kaydı otomatik taşınır; ESKİ API (getActiveProfile, getDraftProfile,
//   saveProfile, countOn, subscribeProfile) AYNEN korunur — mevcut ekranlar bozulmaz.
// * Her kayıt YENİ SÜRÜM oluşturur; eski sürüm ezilmez (mühürlü analizler
//   kullandıkları profileVersion ile değişmeden kalır).
// * Girişli kullanıcı için sunucu senkron altyapısı: exportForAccount() /
//   importFromAccount() — bu görevde otomatik taşıma YAPILMAZ, güvenli zemin hazırdır.
// Kalıcılık: web'de localStorage; native'de oturum-içi bellek (prefs.js deseni).
import { CRITERIA, CRITERIA_MAP } from './analysis/criteria';

const KEY_V1 = 'sportoto.analysisProfile.v1';
const KEY_V2 = 'sportoto.analysisProfiles.v2';
const DEFAULT_NAME = 'Kullanıcı Seçimli Analiz';

export const DEFAULT_GLOBAL_FILTERS = { period: 'season', venueScope: 'overall', opponentStrength: 'all' };

let cache; // undefined = okunmadı
const subs = new Set();

const nowIso = () => new Date().toISOString();
const rid = () => `prof-${Math.random().toString(36).slice(2, 10)}`;

// KALICILIK: web'de localStorage · telefonda AsyncStorage · ikisi de yoksa bellek.
//
// Önceki hâl yalnız localStorage kullanıyordu. React Native'de localStorage
// YOKTUR, dolayısıyla kullanıcının analiz profilleri (seçtiği kriterler,
// ağırlıklar, filtreler) telefonda uygulama kapanınca kayboluyor; kullanıcı
// kendi kurduğu profili her açılışta yeniden kuruyordu.
const HAS_LS = typeof localStorage !== 'undefined';
let AS = null;
if (!HAS_LS) { try { AS = require('@react-native-async-storage/async-storage').default; } catch { AS = null; } }

// Native'de son yazılan değer bellekte de tutulur: AsyncStorage eşzamansızdır,
// okuma anında henüz dönmemiş olabilir.
const bellek = new Map();

function readStorage(key) {
  try {
    if (HAS_LS) return localStorage.getItem(key);
  } catch { /* kota/gizli mod: belleğe düş */ }
  return bellek.has(key) ? bellek.get(key) : null;
}
function writeStorage(key, val) {
  bellek.set(key, val);
  try { if (HAS_LS) localStorage.setItem(key, val); } catch {}
  // Yazma hatası akışı BOZMAZ: bir profilin kaydedilememesi, ekranın
  // çökmesinden iyidir.
  if (AS) { try { AS.setItem(key, val).catch(() => {}); } catch {} }
}

function emptyState() {
  return { activeProfileId: null, profiles: [] };
}

// v1 → v2 taşıma: tek profil, sürüm 1 olarak korunur.
function migrateV1(raw) {
  try {
    const old = JSON.parse(raw);
    if (!old?.criteria) return emptyState();
    const p = {
      id: rid(), name: old.name || DEFAULT_NAME, isDefault: true,
      mode: 'manual', globalFilters: { ...DEFAULT_GLOBAL_FILTERS },
      criteria: old.criteria, currentVersion: 1,
      versions: [{ version: 1, name: old.name || DEFAULT_NAME, mode: 'manual', globalFilters: { ...DEFAULT_GLOBAL_FILTERS }, criteria: old.criteria, createdAt: old.createdAt || nowIso() }],
      createdAt: old.createdAt || nowIso(), updatedAt: old.updatedAt || nowIso(),
    };
    return { activeProfileId: p.id, profiles: [p] };
  } catch { return emptyState(); }
}

function read() {
  if (cache !== undefined) return cache;
  const v2 = readStorage(KEY_V2);
  if (v2) { try { cache = JSON.parse(v2); } catch { cache = emptyState(); } return cache; }
  const v1 = readStorage(KEY_V1);
  cache = v1 ? migrateV1(v1) : emptyState();
  if (v1) persist();
  return cache;
}

function persist() {
  writeStorage(KEY_V2, JSON.stringify(cache));
  subs.forEach((fn) => { try { fn(getActiveProfile()); } catch {} });
}

// AÇILIŞTA DİSKTEN GERİ YÜKLEME (yalnız native).
// AsyncStorage eşzamansız olduğu için ilk okumada bellek boştur. Diskten gelen
// değer belleğe YALNIZ orada bir şey yoksa yazılır: kullanıcı bu arada profil
// oluşturduysa geç gelen disk onun seçimini EZMEZ. Yükleme sonrası cache
// sıfırlanır ki bir sonraki okuma diski görsün, aboneler de haberdar olsun.
if (AS) {
  for (const anahtar of [KEY_V1, KEY_V2]) {
    AS.getItem(anahtar).then((raw) => {
      if (raw == null || bellek.has(anahtar)) return;
      bellek.set(anahtar, raw);
      cache = undefined;
      subs.forEach((fn) => { try { fn(getActiveProfile()); } catch {} });
    }).catch(() => { /* disk okunamadı: varsayılanlarla devam */ });
  }
}

/* ——— ÖNERİLEN VARSAYILAN PROFİL ———
   Kurulum gerektirmeden analiz ÇALIŞSIN diye: hiç profil yoksa, katalogdaki
   YÜKSEK etkili kriterlerle "Önerilen Kriter Seti" oluşturulur. Bu bir
   başlangıç noktasıdır — kullanıcı Analiz Kriterlerim'den her şeyi değiştirir.
   Kullanıcı bilerek TÜM kriterleri kapattıysa (profil var, hepsi kapalı)
   dokunulmaz; o tercih saygıyla korunur. */
export const RECOMMENDED_PROFILE_NAME = 'Önerilen Kriter Seti';

export function ensureDefaultProfile() {
  const s = read();
  if (s.profiles.length) return getActiveProfile();
  const criteria = {};
  let onCount = 0;
  for (const c of CRITERIA) {
    const on = c.defaultImpact === 'high';
    if (on) onCount += 1;
    criteria[c.key] = { on, impact: c.defaultImpact };
  }
  if (onCount === 0) {
    for (const c of CRITERIA.slice(0, 8)) { criteria[c.key] = { ...criteria[c.key], on: true }; }
  }
  const t = nowIso();
  const p = {
    id: rid(), name: RECOMMENDED_PROFILE_NAME, isDefault: true,
    mode: 'manual', globalFilters: { ...DEFAULT_GLOBAL_FILTERS },
    criteria, currentVersion: 1,
    versions: [{ version: 1, name: RECOMMENDED_PROFILE_NAME, mode: 'manual', globalFilters: { ...DEFAULT_GLOBAL_FILTERS }, criteria, createdAt: t }],
    createdAt: t, updatedAt: t,
  };
  s.profiles.push(p);
  s.activeProfileId = p.id;
  persist();
  return getActiveProfile();
}

/* ——— ESKİ API (geriye uyumlu) ——— */

// Boş şablon: tüm kriterler KAPALI, önerilen etki seviyesiyle.
export function getProfileTemplate() {
  const criteria = {};
  for (const c of CRITERIA) criteria[c.key] = { on: false, impact: c.defaultImpact };
  return {
    name: DEFAULT_NAME, active: true, criteria,
    mode: 'manual', globalFilters: { ...DEFAULT_GLOBAL_FILTERS },
    createdAt: null, updatedAt: null, version: 1,
  };
}

// Aktif profil (yoksa null) — katalogla birleşik (yeni kriterler kapalı görünür).
export function getActiveProfile() {
  const s = read();
  const p = s.profiles.find((x) => x.id === s.activeProfileId) || s.profiles[0] || null;
  if (!p) return null;
  const tpl = getProfileTemplate();
  const criteria = { ...tpl.criteria };
  for (const k of Object.keys(p.criteria || {})) {
    if (CRITERIA_MAP[k]) criteria[k] = { on: !!p.criteria[k].on, impact: p.criteria[k].impact || CRITERIA_MAP[k].defaultImpact, ...(p.criteria[k].filters ? { filters: p.criteria[k].filters } : {}) };
  }
  return {
    ...tpl, id: p.id, name: p.name, criteria,
    mode: p.mode || 'manual', globalFilters: p.globalFilters || { ...DEFAULT_GLOBAL_FILTERS },
    version: p.currentVersion, createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

export function getDraftProfile() {
  return getActiveProfile() || getProfileTemplate();
}

export function countOn(profile) {
  if (!profile?.criteria) return 0;
  return Object.values(profile.criteria).filter((c) => c && c.on).length;
}

// "Analiz Profilini Kaydet" — aktif profile YENİ SÜRÜM ekler (yoksa oluşturur).
export function saveProfile(criteria, name, extras = {}) {
  const s = read();
  let p = s.profiles.find((x) => x.id === s.activeProfileId) || s.profiles[0] || null;
  const t = nowIso();
  if (!p) {
    p = {
      id: rid(), name: name || DEFAULT_NAME, isDefault: true,
      mode: extras.mode || 'manual', globalFilters: extras.globalFilters || { ...DEFAULT_GLOBAL_FILTERS },
      criteria, currentVersion: 1,
      versions: [{ version: 1, name: name || DEFAULT_NAME, mode: extras.mode || 'manual', globalFilters: extras.globalFilters || { ...DEFAULT_GLOBAL_FILTERS }, criteria, createdAt: t }],
      createdAt: t, updatedAt: t,
    };
    s.profiles.push(p);
    s.activeProfileId = p.id;
  } else {
    const next = {
      version: p.currentVersion + 1,
      name: name || p.name,
      mode: extras.mode || p.mode || 'manual',
      globalFilters: extras.globalFilters !== undefined ? extras.globalFilters : (p.globalFilters || { ...DEFAULT_GLOBAL_FILTERS }),
      criteria, createdAt: t,
    };
    p.versions = [...(p.versions || []), next];      // append-only: eski sürümler DURUR
    p.currentVersion = next.version;
    p.name = next.name; p.mode = next.mode; p.globalFilters = next.globalFilters; p.criteria = criteria;
    p.updatedAt = t;
  }
  persist();
  return getActiveProfile();
}

export function subscribeProfile(fn) { subs.add(fn); return () => subs.delete(fn); }

/* ——— YENİ API (çoklu profil / mod / filtre) ——— */

export function listProfiles() {
  const s = read();
  return s.profiles.map((p) => ({ id: p.id, name: p.name, isDefault: !!p.isDefault, currentVersion: p.currentVersion, mode: p.mode || 'manual', onCount: Object.values(p.criteria || {}).filter((c) => c?.on).length, active: p.id === s.activeProfileId }));
}

export function setActiveProfile(id) {
  const s = read();
  if (s.profiles.some((p) => p.id === id)) { s.activeProfileId = id; persist(); }
  return getActiveProfile();
}

export function createProfileLocal(name, base = null) {
  const s = read();
  const t = nowIso();
  const criteria = base?.criteria ? JSON.parse(JSON.stringify(base.criteria)) : getProfileTemplate().criteria;
  const p = {
    id: rid(), name: name || `Profil ${s.profiles.length + 1}`, isDefault: s.profiles.length === 0,
    mode: base?.mode || 'manual', globalFilters: base?.globalFilters ? { ...base.globalFilters } : { ...DEFAULT_GLOBAL_FILTERS },
    criteria, currentVersion: 1,
    versions: [{ version: 1, name: name || '', mode: base?.mode || 'manual', globalFilters: base?.globalFilters || { ...DEFAULT_GLOBAL_FILTERS }, criteria, createdAt: t }],
    createdAt: t, updatedAt: t,
  };
  s.profiles.push(p);
  s.activeProfileId = p.id;
  persist();
  return getActiveProfile();
}

export function duplicateActiveProfile(newName) {
  const cur = getActiveProfile();
  if (!cur) return null;
  return createProfileLocal(newName || `${cur.name} (kopya)`, cur);
}

export function renameActiveProfile(newName) {
  const s = read();
  const p = s.profiles.find((x) => x.id === s.activeProfileId);
  if (!p || !newName) return getActiveProfile();
  p.name = String(newName).trim();
  p.updatedAt = nowIso();
  persist();
  return getActiveProfile();
}

export function deleteProfileLocal(id) {
  const s = read();
  const idx = s.profiles.findIndex((x) => x.id === id);
  if (idx === -1) return listProfiles();
  s.profiles.splice(idx, 1);
  if (s.activeProfileId === id) s.activeProfileId = s.profiles[0]?.id || null;
  persist();
  return listProfiles();
}

export function setActiveMode(mode) {
  const s = read();
  const p = s.profiles.find((x) => x.id === s.activeProfileId);
  if (p) { p.mode = mode === 'smart' ? 'smart' : 'manual'; p.updatedAt = nowIso(); persist(); }
  return getActiveProfile();
}

export function setGlobalFilters(filters) {
  const s = read();
  const p = s.profiles.find((x) => x.id === s.activeProfileId);
  if (p) { p.globalFilters = { ...DEFAULT_GLOBAL_FILTERS, ...(filters || {}) }; p.updatedAt = nowIso(); persist(); }
  return getActiveProfile();
}

export function getProfileVersions() {
  const s = read();
  const p = s.profiles.find((x) => x.id === s.activeProfileId);
  return p?.versions || [];
}

/* ——— HESABA TAŞIMA ALTYAPISI (güvenli zemin; otomatik taşıma yapılmaz) ——— */
// Girişten sonra kullanıcı isterse yerel profil sunucuya taşınabilir:
//   api.analysisProfileCreate(exportForAccount())
export function exportForAccount() {
  const p = getActiveProfile();
  if (!p) return null;
  return { name: p.name, criteria: p.criteria, mode: p.mode, globalFilters: p.globalFilters };
}

// Sunucudan gelen profili yerel listeye ekler (üzerine yazmaz).
export function importFromAccount(serverProfile) {
  if (!serverProfile?.criteria) return null;
  return createProfileLocal(serverProfile.name || 'Hesap Profili', {
    criteria: serverProfile.criteria, mode: serverProfile.mode, globalFilters: serverProfile.globalFilters,
  });
}
