// KUPON DEPOSU — hesaba bağlı kalıcı saklama (sürücülü, T12).
//
// SÖZLEŞME (değişmedi): kullanıcı başına TAM kupon listesi; kaynak app'tir,
// PUT tüm listeyi değiştirir. Kupon MANTIĞI app tarafındadır; burası depodur.
//
// SÜRÜCÜLER (archive/store.js ile aynı felsefe):
//   • Supabase (üretim): public.user_coupons — kullanıcı başına TEK satır,
//     kalıcı. Migration 008 açılışta otomatik uygulanır.
//   • Dosya (geliştirme/yedek): backend/data/coupons.json — Render free'de
//     KALICI DEĞİLDİR; Supabase yapılandırılmamışsa eski davranış sürer.
//   • COUPON_DRIVER=file|supabase ile elle seçilebilir (varsayılan: otomatik).
//
// TEK SEFERLİK GÖÇ: Supabase modunda, dosyada verisi olup tabloda satırı
// olmayan kullanıcılar içe aktarılır; dosya coupons.json.migrated olarak
// yeniden adlandırılır (çift kaynak kalmaz, veri kaybolmaz).
//
// Bu dosya ayrı bir modüldür çünkü hesap silme akışının da (routes/auth.js)
// aynı depoya erişmesi gerekir; rota dosyasından içeri aktarmak döngüsel
// bağımlılık yaratırdı.
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sbAdmin, supabaseEnabled } from './supabase.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data'); // backend/data
mkdirSync(dataDir, { recursive: true });
// COUPONS_FILE env ile değiştirilebilir (testler gerçek veriye dokunmasın).
export const COUPONS_FILE = process.env.COUPONS_FILE || join(dataDir, 'coupons.json');

// Test kancası: Supabase istemcisi enjekte edilebilir (gerçek ağa çıkılmaz).
let sb = sbAdmin;
export function _setSupabaseClientForTests(client) { sb = client || sbAdmin; }

// ——— DOSYA KATMANI (eski API — dosya modunda ve göçte kullanılır) ———
export function readMap() {
  if (!existsSync(COUPONS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(COUPONS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function writeMap(m) {
  try {
    writeFileSync(COUPONS_FILE, JSON.stringify(m));
  } catch (e) {
    console.warn('[coupons] yazılamadı:', e.message);
  }
}

// ——— SÜRÜCÜ SEÇİMİ ———
export function couponDriverName() {
  const pref = (process.env.COUPON_DRIVER || '').toLowerCase();
  if (pref === 'file') return 'file';
  if (pref === 'supabase') return 'supabase';
  return supabaseEnabled ? 'supabase' : 'file';
}

// ——— TEK SEFERLİK GÖÇ (yalnız Supabase modunda, süreç başına bir kez) ———
let goc = null; // Promise — eşzamanlı ilk isteklerde tek kez çalışır
async function dosyadanGocEt() {
  if (!existsSync(COUPONS_FILE)) return { imported: 0 };
  const map = readMap();
  const girisler = Object.entries(map).filter(([, v]) => Array.isArray(v) && v.length);
  let imported = 0;
  for (const [userId, list] of girisler) {
    try {
      // Tabloda satırı OLAN kullanıcıya dosyadan yazılmaz (DB daha yenidir).
      const { data: mevcut, error: se } = await sb
        .from('user_coupons').select('user_id').eq('user_id', userId).maybeSingle();
      if (se) throw new Error(se.message);
      if (mevcut) continue;
      const { error } = await sb.from('user_coupons')
        .insert({ user_id: userId, coupons: list });
      if (error) throw new Error(error.message);
      imported += 1;
    } catch (e) {
      // Göç fırsatçıdır: tek kullanıcı hatası (ör. auth kaydı silinmiş eski id)
      // diğerlerini durdurmaz; dosya yeniden adlandırılır ki döngü kurulmasın —
      // içe aktarılamayanlar .migrated dosyasında incelenebilir hâlde kalır.
      console.warn('[coupons] göç atlandı:', userId, '→', e.message);
    }
  }
  try {
    renameSync(COUPONS_FILE, `${COUPONS_FILE}.migrated`);
    console.log(`[coupons] dosya deposu içe aktarıldı (${imported} kullanıcı) → coupons.json.migrated`);
  } catch { /* yeniden adlandırılamazsa bir sonraki açılışta tekrar denenir */ }
  return { imported };
}
function gocuGarantiEt() {
  if (!goc) goc = dosyadanGocEt().catch((e) => { console.warn('[coupons] göç hatası:', e.message); goc = null; });
  return goc;
}

// ——— ASIL API (rotalar ve hesap silme bunları kullanır) ———
export async function getCoupons(userId) {
  if (couponDriverName() === 'file') {
    const map = readMap();
    return Array.isArray(map[userId]) ? map[userId] : [];
  }
  await gocuGarantiEt();
  const { data, error } = await sb
    .from('user_coupons').select('coupons').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return Array.isArray(data?.coupons) ? data.coupons : [];
}

export async function setCoupons(userId, list) {
  if (couponDriverName() === 'file') {
    const map = readMap();
    map[userId] = list;
    writeMap(map);
    return { ok: true };
  }
  await gocuGarantiEt();
  const { error } = await sb.from('user_coupons')
    .upsert({ user_id: userId, coupons: list, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function countCoupons(userId) {
  return (await getCoupons(userId)).length;
}

/** Hesap silme: kullanıcının kupon kaydını kaldırır (Supabase'te cascade de
 *  vardır; açık silme, dosya moduyla davranış paritesi için yapılır). */
export async function deleteCoupons(userId) {
  if (couponDriverName() === 'file') {
    const map = readMap();
    if (!Object.prototype.hasOwnProperty.call(map, userId)) return { removed: 0 };
    const removed = Array.isArray(map[userId]) ? map[userId].length : 0;
    delete map[userId];
    writeMap(map);
    return { removed };
  }
  await gocuGarantiEt();
  const onceki = await getCoupons(userId).catch(() => []);
  const { error } = await sb.from('user_coupons').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
  return { removed: onceki.length };
}

// Testler için: göç durumunu sıfırla.
export function _resetCouponMigrationForTests() { goc = null; }
