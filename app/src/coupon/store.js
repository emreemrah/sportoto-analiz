// KUPON MERKEZİ DEPOSU (v2) — sıfırdan kurulan kupon sisteminin tek deposu.
// • Web: localStorage · Telefon: AsyncStorage → uygulama kapanıp açılınca kupon
//   geri yüklenir. Girişli kullanıcıda mevcut hesap altyapısı (/api/coupons,
//   Supabase hesabına bağlı, sahibine özel) üzerinden kalıcıdır.
// • ESKİ kupon kayıtları (v1 anahtarı / schema'sız sunucu kayıtları) bu depoya
//   ASLA karışmaz — yeni başarı sistemi yalnız schema:2 kuponları görür.
//   Sunucudaki eski kayıtlar silinmez, dokunulmadan geri yazılır.
// • Kayıt hatasında kupon YERELDE güvende kalır; durum getSyncState ile
//   görünür, retrySync ile elle tekrar denenir.
// • KİLİT MAÇ BAZINDADIR: her maç kendi başlangıcından 5 dk önce kilitlenir.
//   Kilitlenen maçın seçimi bir daha DEĞİŞEMEZ (lockMap doğrulaması) — yani
//   her tercih, ilgili maç başlamadan önce kaydedilmiş hâliyle donar ve
//   değerlendirme yalnız o hâliyle yapılır (couponEval). Başlamamış maçlara
//   hafta boyunca kupon kurulabilir; geriye dönük başarı ÜRETİLEMEZ.
import { columnCount, MAX_COUPONS_PER_WEEK, isLockedNow, lockViolations } from '../couponConfig';
import { api } from '../api';
import { isAuthenticated } from '../session/tokenState';

const KEY = 'sportoto.couponCenter.v1';   // YENİ anahtar — eski 'sportoto.coupons.v1' okunmaz
const DKEY = 'sportoto.couponCenterDraft.v1';
const SCHEMA = 2;

let cache = null;
let dcache = null;
let serverLegacy = [];  // sunucudaki v1 kayıtlar — dokunulmaz, geri yazılır, GÖSTERİLMEZ

const HAS_LS = typeof localStorage !== 'undefined';
let AS = null;
if (!HAS_LS) { try { AS = require('@react-native-async-storage/async-storage').default; } catch { AS = null; } }

const subs = new Set();
export function subscribeCoupons(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { subs.forEach((f) => { try { f(); } catch {} }); }

// Giriş durumu tokenState'ten okunur (platformsuz tek doğruluk kaynağı).
// ESKİ HÂL localStorage'a bakıyordu: mobilde localStorage yok, üretim web'inde
// belirteç HttpOnly çerezde — ikisinde de her zaman false dönüyor ve kupon
// senkronu HİÇ çalışmıyordu.
function hasToken() {
  try { return isAuthenticated(); } catch { return false; }
}

function readAll() {
  if (cache) return cache;
  try {
    const raw = HAS_LS ? localStorage.getItem(KEY) : null;
    cache = raw ? JSON.parse(raw) : [];
  } catch { cache = []; }
  return cache;
}

function mergeById(a, b) {
  const map = new Map();
  for (const c of [...(a || []), ...(b || [])]) {
    if (!c || c.id == null) continue;
    const prev = map.get(c.id);
    if (!prev || String(c.updatedAt || '') >= String(prev.updatedAt || '')) map.set(c.id, c);
  }
  return [...map.values()];
}

// Native açılışta diskten geri yükle — id bazında birleşir, veri kaybolmaz.
if (AS) {
  AS.getItem(KEY).then((raw) => {
    if (!raw) return;
    try { cache = mergeById(readAll(), JSON.parse(raw)); emit(); } catch {}
  }).catch(() => {});
  AS.getItem(DKEY).then((raw) => {
    if (!raw) return;
    try { if (!dcache || !dcache.roundId) dcache = JSON.parse(raw); } catch {}
  }).catch(() => {});
}

// ——— SENKRON: hata → kupon yerelde durur + Tekrar Dene ———
const syncState = { pending: false, error: null, lastOkAt: null };
export function getSyncState() { return { ...syncState, loggedIn: hasToken() }; }

function pushNow() {
  if (!hasToken()) return Promise.resolve({ ok: false, reason: 'no-auth' });
  // Eski (v1) sunucu kayıtları korunarak geri yazılır — yeni sisteme karışmaz.
  return api.putCoupons([...serverLegacy, ...readAll()])
    .then(() => { syncState.pending = false; syncState.error = null; syncState.lastOkAt = new Date().toISOString(); emit(); return { ok: true }; })
    .catch((e) => { syncState.pending = true; syncState.error = e?.message || 'Sunucuya kaydedilemedi.'; emit(); return { ok: false, reason: 'error' }; });
}
export function retrySync() { return pushNow(); }

let pushTimer = null;
function schedulePush() {
  if (!hasToken()) return;
  syncState.pending = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; pushNow(); }, 500);
}

function persist(list, { push = true } = {}) {
  cache = list;
  try { if (HAS_LS) localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  if (AS) { try { AS.setItem(KEY, JSON.stringify(list)).catch(() => {}); } catch {} }
  if (push) schedulePush();
  emit();
}

export async function syncFromServer() {
  if (!hasToken()) return { synced: false };
  try {
    const resp = await api.getCoupons();
    const server = Array.isArray(resp?.coupons) ? resp.coupons : [];
    serverLegacy = server.filter((c) => c?.schema !== SCHEMA);       // v1 → ayrı, karışmaz
    const serverV2 = server.filter((c) => c?.schema === SCHEMA);
    const merged = mergeById(readAll(), serverV2);
    persist(merged, { push: false });
    const changed = JSON.stringify(merged) !== JSON.stringify(serverV2);
    if (changed) pushNow();
    return { synced: true, count: merged.length };
  } catch { return { synced: false }; }
}

const uid = () => `k_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ——— OKUMA ———
export function getWeekCoupons(roundId) {
  return readAll().filter((c) => c.roundId === roundId).sort((a, b) => a.couponNo - b.couponNo);
}
export function getCoupon(id) { return readAll().find((c) => c.id === id) || null; }
export function getRankedCoupon(roundId) { return getWeekCoupons(roundId).find((c) => c.isRankedCoupon) || null; }
export function finalVersion(coupon) {
  if (!coupon?.versions?.length) return null;
  return coupon.versions.find((v) => v.id === coupon.finalVersionId) || coupon.versions[coupon.versions.length - 1];
}

// ——— YAZMA ———
export function buildVersion(selections, extra = {}) {
  return {
    id: uid(),
    versionNo: extra.versionNo || 1,
    createdAt: new Date().toISOString(),
    selections,
    columnCount: columnCount(selections),
    // Maliyet SAKLANMAZ — gösterim anında GERÇEK fiyat verisiyle hesaplanır
    // (couponConfig.costOf). Fiyat uydurulamaz kuralının depoya yansıması.
  };
}

// Yeni kupon. Haftanın ilk kuponu otomatik DERECELİ.
// meta.lockMap verilirse kilit MAÇ BAZINDA doğrulanır: başlamış maça seçim
// YAPILAMAZ (geriye dönük başarı üretilemez — kesin kural). lockMap yoksa
// eski davranış (bülten kilidi) korunur.
export function createCoupon(meta, versionData, name) {
  if (meta.lockMap) {
    const bad = lockViolations({ selections: versionData.selections, prevSelections: [], lockMap: meta.lockMap });
    if (bad.length) return { error: 'locked-match', matches: bad };
  } else if (isLockedNow(meta.lockedAt)) return { error: 'locked' };
  const list = readAll();
  const week = list.filter((c) => c.roundId === meta.roundId);
  if (week.length >= MAX_COUPONS_PER_WEEK) return { error: 'max' };
  const couponNo = (week.reduce((m, c) => Math.max(m, c.couponNo), 0) || 0) + 1;
  const version = buildVersion(versionData.selections, { versionNo: 1 });
  const now = new Date().toISOString();
  const coupon = {
    schema: SCHEMA,
    id: uid(),
    name: (name || '').trim() || `Kupon ${couponNo}`,
    season: meta.season, weekNumber: meta.weekNumber, roundId: meta.roundId,
    couponNo,
    isRankedCoupon: week.length === 0,
    status: 'saved',
    createdAt: now, updatedAt: now,
    lockedAt: meta.lockedAt ?? null,
    playedMarkedAt: null,
    finalVersionId: version.id,
    versions: [version],
  };
  persist([...list, coupon]);
  return { coupon };
}

// Düzenleme → YENİ versiyon (izlenebilirlik; eskiler silinmez).
// opts.lockMap verilirse maç bazlı doğrulama: kilitli maçın seçimi önceki
// final versiyondaki değerinden FARKLI OLAMAZ. lockMap yoksa eski davranış.
export function addVersion(couponId, versionData, opts = {}) {
  const list = readAll();
  const c = list.find((x) => x.id === couponId);
  if (!c) return { error: 'notfound' };
  if (opts.lockMap) {
    const prev = finalVersion(c)?.selections || [];
    const bad = lockViolations({ selections: versionData.selections, prevSelections: prev, lockMap: opts.lockMap });
    if (bad.length) return { error: 'locked-match', matches: bad };
  } else if (isLockedNow(c.lockedAt)) return { error: 'locked' };
  const version = buildVersion(versionData.selections, { versionNo: c.versions.length + 1 });
  c.versions.push(version);
  c.finalVersionId = version.id;
  c.updatedAt = new Date().toISOString();
  persist(list);
  return { coupon: c, version };
}

export function renameCoupon(couponId, name) {
  const list = readAll();
  const c = list.find((x) => x.id === couponId);
  if (!c) return { error: 'notfound' };
  c.name = (name || '').trim() || c.name;
  c.updatedAt = new Date().toISOString();
  persist(list);
  return { coupon: c };
}

// Kuponu KOPYALA → aynı haftada yeni bağımsız kupon.
// opts.lockMap verilirse: kopya YENİ bir kupondur, bu yüzden başlamış
// maçların seçimleri kopyada BOŞALTILIR (kopyaya geriye dönük isabet
// taşınamaz) ve boşaltılan maç numaraları döndürülür. lockMap yoksa eski
// davranış (kilitli haftada kopya yok) korunur.
export function copyCoupon(couponId, opts = {}) {
  const src = getCoupon(couponId);
  if (!src) return { error: 'notfound' };
  if (!opts.lockMap && isLockedNow(src.lockedAt)) return { error: 'locked' };
  const v = finalVersion(src);
  if (!v) return { error: 'empty' };
  let selections = JSON.parse(JSON.stringify(v.selections));
  const stripped = [];
  if (opts.lockMap) {
    const now = Date.now();
    selections = selections.map((sc) => {
      const la = opts.lockMap[sc.no];
      if (la != null && now >= la && (sc.selectedOutcomes || []).length) {
        stripped.push(sc.no);
        return { ...sc, selectedOutcomes: [] };
      }
      return sc;
    });
  }
  const r = createCoupon(
    { season: src.season, weekNumber: src.weekNumber, roundId: src.roundId, lockedAt: src.lockedAt, lockMap: opts.lockMap },
    { selections },
    `${src.name} (kopya)`
  );
  if (r.error) return r;
  return { ...r, strippedNos: stripped };
}

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
  persist(readAll().filter((c) => c.id !== id));
}

// "Oynadım" BEYANI — operatör entegrasyonu YOK; her yerde "kullanıcı beyanı
// (operatör doğrulaması yok)" etiketiyle gösterilir, asla doğrulanmış gibi değil.
export function markPlayed(couponId, on) {
  const list = readAll();
  const c = list.find((x) => x.id === couponId);
  if (!c) return { error: 'notfound' };
  c.playedMarkedAt = on ? new Date().toISOString() : null;
  c.updatedAt = new Date().toISOString();
  persist(list);
  return { coupon: c };
}

// ——— PAYLAŞILAN TASLAK — maç detayı "KUPONA İŞLE" / Radar / editör ortak. ———
function readDraft() {
  if (dcache) return dcache;
  try { const raw = HAS_LS ? localStorage.getItem(DKEY) : null; dcache = raw ? JSON.parse(raw) : { roundId: null, picks: {} }; }
  catch { dcache = { roundId: null, picks: {} }; }
  return dcache;
}
function writeDraft(d) {
  dcache = d;
  try { if (HAS_LS) localStorage.setItem(DKEY, JSON.stringify(d)); } catch {}
  if (AS) { try { AS.setItem(DKEY, JSON.stringify(d)).catch(() => {}); } catch {} }
}
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
