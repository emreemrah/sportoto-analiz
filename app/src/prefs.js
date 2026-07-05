// Kullanıcı GÖRÜNÜM/KULLANIM tercihleri (veri doğruluğu / resmi kaynak DEĞİL —
// onlar asla kullanıcıya bırakılmaz). Web'de localStorage'da kalıcı; native'de
// oturum-içi bellek. Sahte veri / resmi olmayan bülten seçeneği burada YOKTUR.
const KEY = 'sportoto.prefs';

const defaults = {
  liveStatView: 'table',   // 'table' | 'graph'
  liveSort: 'bulletin',    // 'bulletin' | 'liveTop' | 'doneBottom'
  rememberFilter: true,    // filtre seçimini hatırla
  liveLastFilter: 'all',   // 'all' | 'live' | 'risk' | 'coupon' | 'done'
  liveAnim: 'important',   // 'on' | 'off' | 'important'
  prizeView: 'table',      // ikramiye görünümü: 'list' | 'table' | 'card'
  histResultMode: 'simple',// geçmiş sonuç görünümü: 'simple' | 'detailed' | 'technical'
  histSort: 'bulletin',    // geçmiş sıralama: 'bulletin' | 'resolvedTop' | 'waitingBottom'
  sysDashView: 'simple',   // sistem karnesi görünümü: 'simple' | 'detailed' | 'technical'
  sysDashRange: 'all',     // sistem karnesi aralık: 'all' | 'last5' | 'last10'
  userDashView: 'simple',  // kullanıcı paneli görünümü: 'simple' | 'detailed' | 'technical'
  couponPlace: 'both',     // kolon/tutar yeri: 'top' | 'bottom' | 'both'
  couponPreview: true,     // kayıt öncesi önizleme
  couponSysMode: 'single', // sistem uygula: 'single' (tekli) | 'wide' (geniş)
  couponBudget: null,      // kullanıcı bütçe limiti (TL) — null = yok
};

let cache = null;
function readAll() {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    cache = { ...defaults, ...(raw ? JSON.parse(raw) : {}) };
  } catch { cache = { ...defaults }; }
  return cache;
}

export function getPref(k) { return readAll()[k]; }
export function getPrefs() { return { ...readAll() }; }
export function setPref(k, v) {
  cache = { ...readAll(), [k]: v };
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
}
