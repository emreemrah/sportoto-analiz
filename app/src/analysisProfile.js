// KULLANICI ANALİZ PROFİLİ — hangi kriterlerin analizde kullanılacağı + etki seviyeleri.
// Kalıcı: web'de localStorage; native'de oturum-içi bellek (prefs.js ile aynı desen).
// Kaydedilen profil sonraki bültenlerde otomatik aktif kabul edilir. Kullanıcı
// "Analiz Profilini Kaydet" demeden hiçbir seçim geçerli olmaz (motor boş başlar).
import { CRITERIA, CRITERIA_MAP } from './analysis/criteria';

const KEY = 'sportoto.analysisProfile.v1';
const DEFAULT_NAME = 'Kullanıcı Seçimli Analiz';

let cache; // undefined = okunmadı, null = kayıt yok
const subs = new Set();

function read() {
  if (cache !== undefined) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    cache = raw ? JSON.parse(raw) : null;
  } catch { cache = null; }
  return cache;
}

// Boş şablon: tüm kriterler KAPALI, önerilen etki seviyesiyle.
export function getProfileTemplate() {
  const criteria = {};
  for (const c of CRITERIA) criteria[c.key] = { on: false, impact: c.defaultImpact };
  return { name: DEFAULT_NAME, active: true, criteria, createdAt: null, updatedAt: null };
}

// Kayıtlı profil (yoksa null). Katalogla birleştirir: yeni eklenen kriterler
// kapalı olarak görünür (sonradan genişletilebilir yapı).
export function getActiveProfile() {
  const saved = read();
  if (!saved) return null;
  const tpl = getProfileTemplate();
  const criteria = { ...tpl.criteria };
  for (const k of Object.keys(saved.criteria || {})) {
    if (CRITERIA_MAP[k]) criteria[k] = { on: !!saved.criteria[k].on, impact: saved.criteria[k].impact || CRITERIA_MAP[k].defaultImpact };
  }
  return { ...tpl, ...saved, criteria };
}

// Düzenleme başlangıcı: kayıtlı profil ya da boş şablon.
export function getDraftProfile() {
  return getActiveProfile() || getProfileTemplate();
}

export function countOn(profile) {
  if (!profile?.criteria) return 0;
  return Object.values(profile.criteria).filter((c) => c && c.on).length;
}

// "Analiz Profilini Kaydet" — seçimleri kalıcı yazar, aboneleri uyarır.
export function saveProfile(criteria, name) {
  const prev = read();
  const now = new Date().toISOString();
  const profile = {
    name: name || prev?.name || DEFAULT_NAME,
    active: true,
    criteria,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
  cache = profile;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(profile)); } catch {}
  subs.forEach((fn) => { try { fn(profile); } catch {} });
  return profile;
}

export function subscribeProfile(fn) { subs.add(fn); return () => subs.delete(fn); }
