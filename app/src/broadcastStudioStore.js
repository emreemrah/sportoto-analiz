// YAYIN STÜDYOSU DEPOSU — yayıncının 1-0-2 seçimleri ve maç notları.
//
// NEDEN AYRI BİR ANAHTAR: Yayıncı canlı yayında dener, siler, yeniden seçer.
// Bu deneme kullanıcının KENDİ kupon taslağını (sportoto.couponCenterDraft.v1)
// ASLA ezmemelidir. Bu yüzden burada YENİ bir anahtar kullanılır; mevcut
// anahtarların hiçbiri yeniden adlandırılmaz, hiçbirine yazılmaz.
//
// KESİN KURALLAR:
//  1) Bu depoya YALNIZ hafta kimliği, maç numarası, seçilen işaretler ve
//     yayıncının kendi yazdığı not girer. Ad, e-posta, belirteç, telefon,
//     puan, başka kullanıcının kuponu GİREMEZ (yayın ekranı herkese açıktır).
//  2) Sunucuya gönderilmez — yayın seçimleri cihazda kalır. Kaydedilen kupon
//     yalnız mevcut kupon deposu (coupon/store) üzerinden kalıcı olur.
//  3) Kilit KURALI burada tanımlanmaz — tek kaynak couponConfig'tir. Ama kural
//     burada UYGULANIR: ekran unutsa bile kilitli maçın seçimi/notu değişmez.
//     Yayında ekranı kapatmak yeterli değildir; veri de korunmalıdır.
//
// Web: localStorage · Telefon: AsyncStorage · İkisi de yoksa (test) bellek.
import { normalizeOutcomes, toggleOutcome } from './broadcastStudio';
import { lockMapOf } from './couponConfig';

const KEY = 'sportoto.broadcastStudio.v1';   // YENİ anahtar (hiçbir eski anahtar değişmedi)
const SCHEMA = 1;
const MAX_ROUNDS = 8;        // en son 8 hafta cihazda kalır; eskisi budanır
export const NOTE_MAX = 400; // yayıncı notu üst sınırı (ekranda da yazılır)

const HAS_LS = typeof localStorage !== 'undefined';
let AS = null;
if (!HAS_LS) { try { AS = require('@react-native-async-storage/async-storage').default; } catch { AS = null; } }

let cache = null;
// Budama SIRASI için sayaç. `updatedAt` aynı milisaniyeye düşebildiği için
// (art arda yazma) yalnız zamana bakmak en YENİ haftayı budayabilirdi.
let seqNo = 0;

const subs = new Set();
export function subscribeStudio(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { subs.forEach((f) => { try { f(); } catch {} }); }

const bosKok = () => ({ schema: SCHEMA, rounds: {} });
const bosHafta = (roundId) => ({ roundId: roundId ?? null, picks: {}, notes: {}, couponIds: [], updatedAt: null, seq: 0 });

/** Diskten okunan veriyi güvenli hâle getirir: tanınmayan alan İÇERİ ALINMAZ. */
function sanitize(raw) {
  const out = bosKok();
  const rounds = raw && typeof raw === 'object' ? raw.rounds : null;
  if (!rounds || typeof rounds !== 'object') return out;
  for (const [rid, w] of Object.entries(rounds)) {
    if (!w || typeof w !== 'object') continue;
    const picks = {};
    for (const [no, list] of Object.entries(w.picks || {})) {
      const sec = normalizeOutcomes(list);
      if (sec.length) picks[no] = sec;
    }
    const notes = {};
    for (const [no, txt] of Object.entries(w.notes || {})) {
      if (typeof txt === 'string' && txt.trim()) notes[no] = txt.slice(0, NOTE_MAX);
    }
    const couponIds = Array.isArray(w.couponIds) ? w.couponIds.filter((x) => typeof x === 'string').slice(0, 50) : [];
    const seq = Number.isFinite(w.seq) ? w.seq : 0;
    seqNo = Math.max(seqNo, seq);   // yeni yazmalar diskten geleni HER ZAMAN geçer
    out.rounds[rid] = {
      roundId: w.roundId ?? rid,
      picks,
      notes,
      couponIds,
      updatedAt: typeof w.updatedAt === 'string' ? w.updatedAt : null,
      seq,
    };
  }
  return prune(out);
}

/** En son yazılan MAX_ROUNDS hafta tutulur (cihazda sınırsız birikmesin). */
function prune(root) {
  const keys = Object.keys(root.rounds);
  if (keys.length <= MAX_ROUNDS) return root;
  const sirali = keys.sort((a, b) => (root.rounds[b].seq || 0) - (root.rounds[a].seq || 0));
  const kalan = {};
  for (const k of sirali.slice(0, MAX_ROUNDS)) kalan[k] = root.rounds[k];
  return { ...root, rounds: kalan };
}

function readRoot() {
  if (cache) return cache;
  let raw = null;
  try { raw = HAS_LS ? localStorage.getItem(KEY) : null; } catch { raw = null; }
  try { cache = raw ? sanitize(JSON.parse(raw)) : bosKok(); } catch { cache = bosKok(); }
  return cache;
}

function writeRoot(root) {
  cache = prune(root);
  const s = JSON.stringify(cache);
  try { if (HAS_LS) localStorage.setItem(KEY, s); } catch {}
  if (AS) { try { AS.setItem(KEY, s).catch(() => {}); } catch {} }
  emit();
  return cache;
}

// Telefonda açılışta diskten geri yükle (yayına kaldığı yerden devam).
if (AS) {
  AS.getItem(KEY).then((raw) => {
    if (!raw) return;
    try {
      const diskten = sanitize(JSON.parse(raw));
      const simdiki = readRoot();
      // Bellekte bu oturumda yazılmış hafta varsa o KORUNUR; diğerleri eklenir.
      const rounds = { ...diskten.rounds, ...simdiki.rounds };
      cache = prune({ schema: SCHEMA, rounds });
      emit();
    } catch {}
  }).catch(() => {});
}

/* ————————————————————————— KİLİT ————————————————————————— */
//
// NEDEN DEPODA: "Hafta kilitlendikten sonra düzenleme kapanır, yalnız
// görüntüleme kalır." Bunu tek başına ekranın kapatması YETMEZ — iki ekranın
// ikisi de kutuyu pasifleştirmeyi hatırlamak zorunda kalır ve biri unutursa
// başlamış maçın kaydı sessizce değişir. O yüzden son söz depodadır.
//
// KURAL BURADA YAZILMAZ: hangi maçın ne zaman kilitlendiğini couponConfig
// hesaplar (lockMapOf → maç başlangıcından 5 dk önce). Depo yalnız "bildirilen
// an geçti mi" diye bakar. Harita bildirilmemişse kilit UYGULANMAZ; bu yüzden
// bülteni yükleyen her ekran publishLocks() çağırır (testle güvenceye alındı).
const lockAtByRound = new Map();   // roundId → { maçNo: kilitZamanıMs }

/**
 * Haftanın kilit anlarını bildirir. Maç listesi ekrandan gelir, kilit anı
 * couponConfig'ten hesaplanır — ekran zaman aritmetiği yapmaz.
 */
export function publishLocks(roundId, matches) {
  if (roundId == null) return {};
  const map = lockMapOf(matches);
  lockAtByRound.set(String(roundId), map);
  return map;
}

/** Bu maçın seçimi/notu artık değiştirilemez mi? */
export function isStudioLocked(roundId, no, now = Date.now()) {
  if (roundId == null || no == null) return false;
  const la = lockAtByRound.get(String(roundId))?.[String(no)];
  return la != null && now >= la;
}

/* ————————————————————————— OKUMA ————————————————————————— */

/**
 * Bir haftanın yayın oturumu. Kayıt yoksa BOŞ döner — uydurma seçim yok.
 * Dönen nesne SABİT beş alandan oluşur; iç alanlar (seq) dışarı sızmaz.
 */
const disaVer = (w, roundId) => ({
  roundId: w?.roundId ?? roundId ?? null,
  picks: { ...(w?.picks || {}) },
  notes: { ...(w?.notes || {}) },
  couponIds: [...(w?.couponIds || [])],
  updatedAt: w?.updatedAt ?? null,
});
export function getStudio(roundId) {
  if (roundId == null) return disaVer(null, null);
  return disaVer(readRoot().rounds[String(roundId)], roundId);
}

/** Yalnız seçimler (buildStudioRows'un picks parametresi). */
export const getPicks = (roundId) => getStudio(roundId).picks;
/** Yalnız notlar (buildStudioRows'un notes parametresi). */
export const getNotes = (roundId) => getStudio(roundId).notes;

/**
 * Cihazda YAYIN SEÇİMİ bulunan haftalar — en YENİ hafta başta.
 * Karne ekranı "hangi haftalara bakabilirim" sorusunu buradan yanıtlar; hafta
 * listesi UYDURULMAZ, yalnız gerçekten seçim yapılmış haftalar döner. Seçimi
 * olmayan hafta (yalnız not veya yalnız kupon kimliği) karneye girmez: karne
 * "seçimin sonuca göre ne yaptı" der, seçim yoksa söyleyecek bir şey yoktur.
 * Sıralama: roundId sayısal olarak azalan — büyük hafta numarası daha yenidir.
 */
export function getStudioRounds() {
  const rounds = readRoot().rounds || {};
  return Object.values(rounds)
    .filter((w) => w && w.roundId != null && Object.keys(w.picks || {}).length > 0)
    .map((w) => ({
      roundId: w.roundId,
      pickCount: Object.keys(w.picks || {}).length,
      updatedAt: w.updatedAt ?? null,
    }))
    .sort((a, b) => Number(b.roundId) - Number(a.roundId));
}

/* ————————————————————————— YAZMA ————————————————————————— */

function updateWeek(roundId, fn) {
  if (roundId == null) return bosHafta(null);
  const rid = String(roundId);
  const root = readRoot();
  const onceki = root.rounds[rid] || bosHafta(roundId);
  const yeni = { ...fn({ ...onceki, picks: { ...onceki.picks }, notes: { ...onceki.notes }, couponIds: [...onceki.couponIds] }) };
  yeni.roundId = roundId;
  yeni.updatedAt = new Date().toISOString();
  yeni.seq = ++seqNo;
  writeRoot({ ...root, rounds: { ...root.rounds, [rid]: yeni } });
  return yeni;
}

/**
 * Kilitli maça yazma girişimi: kayıt DEĞİŞMEZ, ama aboneler uyarılır.
 * Uyarı önemlidir — maç yayının ortasında kilitlenmiş olabilir; ekran yeniden
 * çizilince kutu kilitli görünür ve yayıncı neden dokunamadığını anlar.
 */
function reddet() { emit(); }

/** Bir maçın seçimini doğrudan ayarlar. Boş dizi → kayıt silinir. */
export function setPick(roundId, no, outcomes) {
  if (isStudioLocked(roundId, no)) { reddet(); return getStudio(roundId).picks; }
  return updateWeek(roundId, (w) => {
    const sec = normalizeOutcomes(outcomes);
    if (sec.length) w.picks[no] = sec; else delete w.picks[no];
    return w;
  }).picks;
}

/** Kutuya dokunma — ana listede ve maç detayında AYNI davranış. */
export function togglePick(roundId, no, outcome) {
  // Kilit denetimi setPick'te; iki yerde ayrı kural olmaz.
  const mevcut = getStudio(roundId).picks[no] || [];
  return setPick(roundId, no, toggleOutcome(mevcut, outcome));
}

/**
 * Yayıncı notu. Boş metin → not silinir; üst sınır NOTE_MAX.
 * Maç kilitlendikten sonra not da DEĞİŞMEZ: yayında söylenmiş cümle sonradan
 * düzeltilirse geriye dönük yazılmış bir yorum olur.
 */
export function setNote(roundId, no, text) {
  if (isStudioLocked(roundId, no)) { reddet(); return getStudio(roundId).notes; }
  return updateWeek(roundId, (w) => {
    const t = typeof text === 'string' ? text.slice(0, NOTE_MAX) : '';
    if (t.trim()) w.notes[no] = t; else delete w.notes[no];
    return w;
  }).notes;
}

/** Kaydedilen kuponun kimliği — arşivden geri açmak için. Kupon verisi burada TUTULMAZ. */
export function rememberCoupon(roundId, couponId) {
  if (typeof couponId !== 'string' || !couponId) return getStudio(roundId).couponIds;
  return updateWeek(roundId, (w) => {
    if (!w.couponIds.includes(couponId)) w.couponIds = [...w.couponIds, couponId];
    return w;
  }).couponIds;
}

/**
 * Haftanın yayın oturumunu sıfırlar (kaydedilmiş kuponlara DOKUNMAZ).
 * KİLİTLİ MAÇ KORUNUR: başlamış maçın seçimi ve notu "temizle" ile geriye
 * dönük yok edilemez — yalnız hâlâ açık olan maçlar temizlenir. Geriye kilitli
 * kayıt kalmıyorsa haftanın tamamı (kupon kimlikleri dâhil) silinir.
 */
export function clearStudio(roundId) {
  if (roundId == null) return;
  const rid = String(roundId);
  const root = readRoot();
  const w = root.rounds[rid];
  if (!w) return;

  const picks = {};
  for (const [no, list] of Object.entries(w.picks)) if (isStudioLocked(roundId, no)) picks[no] = list;
  const notes = {};
  for (const [no, txt] of Object.entries(w.notes)) if (isStudioLocked(roundId, no)) notes[no] = txt;

  const rounds = { ...root.rounds };
  if (Object.keys(picks).length || Object.keys(notes).length) {
    rounds[rid] = { ...w, picks, notes, updatedAt: new Date().toISOString(), seq: ++seqNo };
  } else {
    delete rounds[rid];
  }
  writeRoot({ ...root, rounds });
}

/** Yalnız test/bakım için: bellek önbelleğini boşaltır (diske dokunmaz). */
export function _resetStudioCache() { cache = null; seqNo = 0; lockAtByRound.clear(); }
