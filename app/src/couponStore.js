// GERÇEK kupon deposu — kullanıcının kendi kuponları (mock DEĞİL). Web'de
// localStorage'da kalıcı; native'de oturum-içi. Her kupon resmi bülten haftasına
// (season/weekNumber/bulletinId/roundId) bağlı. Kilit sonrası düzenleme yok.
import { columnCount, couponAmount, MAX_COUPONS_PER_WEEK, isLockedNow } from './couponConfig';
import { api } from './api';

const KEY = 'sportoto.coupons.v1';
const TOKEN_KEY = 'sportoto.token';
let cache = null;

function readAll() {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    cache = raw ? JSON.parse(raw) : [];
  } catch { cache = []; }
  return cache;
}

// ——— Sunucu senkronu: kuponlar hesaba bağlı KALICI; tünel/domain/cihaz değişse
// de kaybolmaz. Yerel (localStorage) hızlı çalışma kopyası; sunucu kalıcı depo. ———
function hasToken() {
  try { return typeof localStorage !== 'undefined' && !!localStorage.getItem(TOKEN_KEY); } catch { return false; }
}

// Değişiklikleri dinleyenler (ekranlar sunucudan gelince yeniden okur).
const subs = new Set();
export function subscribeCoupons(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { subs.forEach((f) => { try { f(); } catch {} }); }

let pushTimer = null;
function schedulePush() {
  if (!hasToken()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; api.putCoupons(readAll()).catch(() => {}); }, 500);
}

function persist(list, { push = true } = {}) {
  cache = list;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  if (push) schedulePush();
  emit();
}

// id bazında birleştir; çakışmada updatedAt yeni olan kazanır (veri kaybı olmaz).
function mergeById(a, b) {
  const map = new Map();
  for (const c of [...(a || []), ...(b || [])]) {
    if (!c || c.id == null) continue;
    const prev = map.get(c.id);
    if (!prev || String(c.updatedAt || '') >= String(prev.updatedAt || '')) map.set(c.id, c);
  }
  return [...map.values()];
}

// Sunucudan çek + yerelle birleştir. Yeni domain/cihazda yerel boşsa sunucudan
// dolar; yerelde fazladan varsa sunucuya yollar. Giriş yoksa hiçbir şey yapmaz.
export async function syncFromServer() {
  if (!hasToken()) return { synced: false };
  try {
    const resp = await api.getCoupons();
    const server = Array.isArray(resp?.coupons) ? resp.coupons : [];
    const local = readAll();
    const merged = mergeById(local, server);
    persist(merged, { push: false });                 // yereli güncelle, tekrar push etme
    const changed = JSON.stringify(merged) !== JSON.stringify(server);
    if (changed) api.putCoupons(merged).catch(() => {}); // sunucuda eksik varsa tamamla
    return { synced: true, count: merged.length };
  } catch { return { synced: false }; }
}

const uid = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function getWeekCoupons(roundId) {
  return readAll().filter((c) => c.roundId === roundId).sort((a, b) => a.couponNo - b.couponNo);
}
export function getCoupon(id) { return readAll().find((c) => c.id === id) || null; }
export function getAllCoupons() { return [...readAll()]; }
export function getRankedCoupon(roundId) { return getWeekCoupons(roundId).find((c) => c.isRankedCoupon) || null; }

// Yeni versiyon nesnesi kur (kolon/tutar dahil).
export function buildVersion(selections, extra = {}) {
  const cols = columnCount(selections);
  return {
    id: uid(),
    versionNo: extra.versionNo || 1,
    createdAt: new Date().toISOString(),
    selections,
    columnCount: cols,
    totalAmount: couponAmount(cols),
    userBudgetLimit: extra.userBudgetLimit ?? null,
    isBudgetExceeded: extra.isBudgetExceeded ?? false,
    isOfficialLimitExceeded: extra.isOfficialLimitExceeded ?? false,
    appliedSystemMode: extra.appliedSystemMode ?? null,
  };
}

// Yeni kupon kaydet. Haftanın ilk kuponu otomatik DERECELİ olur. Max 10.
// meta: { season, weekNumber, bulletinId, roundId, lockedAt }
export function createCoupon(meta, versionData) {
  const list = readAll();
  const week = list.filter((c) => c.roundId === meta.roundId);
  if (week.length >= MAX_COUPONS_PER_WEEK) return { error: 'max' };
  const couponNo = (week.reduce((m, c) => Math.max(m, c.couponNo), 0) || 0) + 1;
  const version = buildVersion(versionData.selections, { ...versionData, versionNo: 1 });
  const coupon = {
    id: uid(),
    season: meta.season, weekNumber: meta.weekNumber, bulletinId: meta.roundId, roundId: meta.roundId,
    couponNo,
    isRankedCoupon: week.length === 0,   // ilk kupon → dereceli
    status: 'saved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lockedAt: meta.lockedAt ?? null,
    finalVersionId: version.id,
    versions: [version],
  };
  persist([...list, coupon]);
  return { coupon };
}

// Kilit öncesi düzenleme → YENİ versiyon (eskiler silinmez).
export function addVersion(couponId, versionData) {
  const list = readAll();
  const c = list.find((x) => x.id === couponId);
  if (!c) return { error: 'notfound' };
  if (isLockedNow(c.lockedAt)) return { error: 'locked' };
  const version = buildVersion(versionData.selections, { ...versionData, versionNo: c.versions.length + 1 });
  c.versions.push(version);
  c.finalVersionId = version.id;
  c.updatedAt = new Date().toISOString();
  persist(list);
  return { coupon: c, version };
}

// Dereceli kuponu değiştir (kilit öncesi). Haftada tek dereceli kalır.
export function setRanked(roundId, couponId) {
  const list = readAll();
  const week = list.filter((c) => c.roundId === roundId);
  const target = week.find((c) => c.id === couponId);
  if (!target) return { error: 'notfound' };
  if (isLockedNow(target.lockedAt)) return { error: 'locked' };
  for (const c of week) c.isRankedCoupon = c.id === couponId;
  persist(list);
  return { ok: true };
}

export function deleteCoupon(id) {
  const list = readAll().filter((c) => c.id !== id);
  persist(list);
}

// ——— PAYLAŞILAN TASLAK (draft) — bülten/maç-detayı/builder arasında ortak
// çalışma seçimi. Kaydedilene kadar geçici; kaydedince temizlenir. ———
const DKEY = 'sportoto.couponDraft.v1';
let dcache = null;
function readDraft() {
  if (dcache) return dcache;
  try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DKEY) : null; dcache = raw ? JSON.parse(raw) : { roundId: null, picks: {} }; }
  catch { dcache = { roundId: null, picks: {} }; }
  return dcache;
}
function writeDraft(d) { dcache = d; try { if (typeof localStorage !== 'undefined') localStorage.setItem(DKEY, JSON.stringify(d)); } catch {} }

// roundId için taslak (farklı haftaysa boş döner).
export function getDraft(roundId) {
  const d = readDraft();
  return (d.roundId === roundId) ? d : { roundId, picks: {} };
}
export function setDraftPick(roundId, no, outcomes) {
  const d = readDraft();
  const base = d.roundId === roundId ? d : { roundId, picks: {} };
  const picks = { ...base.picks };
  if (!outcomes || outcomes.length === 0) delete picks[no]; else picks[no] = outcomes;
  writeDraft({ roundId, picks });
  return picks;
}
export function setDraftAll(roundId, picks) { writeDraft({ roundId, picks: { ...picks } }); }
export function clearDraft(roundId) { const d = readDraft(); if (d.roundId === roundId || roundId == null) writeDraft({ roundId: null, picks: {} }); }

// Final (kilit öncesi son) versiyon.
export function finalVersion(coupon) {
  if (!coupon?.versions?.length) return null;
  return coupon.versions.find((v) => v.id === coupon.finalVersionId) || coupon.versions[coupon.versions.length - 1];
}
