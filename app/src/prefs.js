// Kullanıcı GÖRÜNÜM/KULLANIM tercihleri (veri doğruluğu / resmi kaynak DEĞİL —
// onlar asla kullanıcıya bırakılmaz). Sahte veri / resmi olmayan bülten
// seçeneği burada YOKTUR.
//
// KALICILIK: Web'de localStorage · Telefonda AsyncStorage · ikisi de yoksa
// (test ortamı) yalnız bellek.
//
// ÖNCEKİ HÂL EKSİKTİ: yalnız `localStorage` kullanılıyordu. React Native'de
// localStorage YOKTUR, dolayısıyla telefonda her tercih uygulama kapanınca
// kayboluyor, kullanıcı görünümü her açılışta yeniden ayarlıyordu. Dosyanın
// eski başlığı bunu "native'de oturum-içi bellek" diye yazıyordu — ama bu bir
// tasarım tercihi değil, eksiklikti: aynı projede `broadcastStudioStore.js` ve
// `coupon/store.js` AsyncStorage'a yazıyor. Aynı kalıp buraya da uygulandı.
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

const HAS_LS = typeof localStorage !== 'undefined';
let AS = null;
if (!HAS_LS) { try { AS = require('@react-native-async-storage/async-storage').default; } catch { AS = null; } }

let cache = null;
function readAll() {
  if (cache) return cache;
  try {
    const raw = HAS_LS ? localStorage.getItem(KEY) : null;
    cache = { ...defaults, ...(raw ? JSON.parse(raw) : {}) };
  } catch { cache = { ...defaults }; }
  return cache;
}

const dinleyiciler = new Set();
/** Tercih değişince haber ver (native'de disk geç gelir; ekran tazelensin). */
export function subscribePrefs(fn) { dinleyiciler.add(fn); return () => dinleyiciler.delete(fn); }
const duyur = () => { dinleyiciler.forEach((f) => { try { f(); } catch {} }); };

// NATIVE AÇILIŞ GERİ YÜKLEMESİ.
// AsyncStorage eşzamansızdır: ilk okuma varsayılanları döner, disk sonra gelir.
// Kullanıcının o arada yaptığı değişiklik KAYBOLMAMALI, bu yüzden diskten gelen
// değerler ALTA serilir (mevcut cache üstte kalır) — geç gelen disk, taze
// seçimi ezmez.
let diskYuklendi = !AS;
if (AS) {
  AS.getItem(KEY).then((raw) => {
    diskYuklendi = true;
    if (!raw) return;
    try {
      cache = { ...defaults, ...JSON.parse(raw), ...(cache || {}) };
      duyur();
    } catch { /* bozuk kayıt: varsayılanlarla devam */ }
  }).catch(() => { diskYuklendi = true; });
}

/** Tercihler diskten yüklendi mi? (ekran isterse bekleyebilir) */
export function prefsHazir() { return diskYuklendi; }

export function getPref(k) { return readAll()[k]; }
export function getPrefs() { return { ...readAll() }; }
export function setPref(k, v) {
  cache = { ...readAll(), [k]: v };
  const s = JSON.stringify(cache);
  try { if (HAS_LS) localStorage.setItem(KEY, s); } catch {}
  // Telefonda kalıcılık. Yazma eşzamansızdır ve hatası akışı BOZMAZ —
  // bir tercihin kaydedilememesi, ekranın çökmesinden iyidir.
  if (AS) { try { AS.setItem(KEY, s).catch(() => {}); } catch {} }
  duyur();
}
