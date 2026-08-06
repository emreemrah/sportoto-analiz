// ---------------------------------------------------------------------------
// ENGEL VE PREMIUM — saf iş mantığı (HTTP yok, Supabase istemcisi dışarıdan)
// ---------------------------------------------------------------------------
// Neden ayrı dosya: rotalar HTTP kabuğudur; karar mantığı burada durur ve
// veritabanı olmadan test edilebilir. Aynı ayrım moderationOps.js'te de var.
//
// KURALLAR (ve sebepleri)
//
// 1. ENGEL SATIRI SİLİNMEZ. Kaldırma `lifted_at` ile işaretlenir. "Neden
//    engellenmiştim" sorusuna cevap verebilmek için geçmiş korunur.
//
// 2. KOD BÜYÜK HARFE NORMALİZE EDİLİR ve boşluk/tire atılır. Kullanıcı kodu
//    elle yazar; "abc-123" ile "ABC123" aynı kod sayılmazsa destek yükü
//    doğar. Normalizasyon TEK yerde yapılır ki üretim ve doğrulama ayrışmasın.
//
// 3. KOD ÜRETİMİNDE KARIŞAN HARFLER YOK. 0/O, 1/I/L gibi çiftler alfabede
//    bulunmaz: kod telefonda okunup elle yazılacak.
//
// 4. PREMIUM DURUMU HESAPLANIR, SAKLANMAZ. "Şu an premium mu" sorusu, etkin
//    (iptal edilmemiş, süresi geçmemiş) hak satırlarından türetilir. İkinci
//    bir "premium: true" alanı tutulsaydı, süresi dolduğunda güncellenmesi
//    unutulur ve iki kaynak çelişirdi.
import { randomInt } from 'node:crypto';

/** Karışması kolay harf/rakam YOK: 0 O 1 I L çıkarıldı. */
const ALFABE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Kullanıcının yazdığı kodu kanonik biçime çevirir. Saf. */
export function kodNormalize(ham) {
  return String(ham || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Rastgele kod üretir (varsayılan 10 karakter, 4'erli görsel gruplama YOK —
 * saklanan biçim düz metindir; ekranda gruplamak arayüzün işi).
 * Kripto-güvenli kaynak kullanılır: tahmin edilebilir kod, ücretsiz premium demektir.
 */
export function kodUret(uzunluk = 10) {
  let out = '';
  for (let i = 0; i < uzunluk; i += 1) out += ALFABE[randomInt(ALFABE.length)];
  return out;
}

/**
 * Bir kodun ŞU AN kullanılabilir olup olmadığını söyler. Saf.
 * @param {object} kod   premium_codes satırı
 * @param {number} kullanim  bu koda ait kullanım sayısı
 * @param {Date} simdi
 * @returns {{ok: boolean, sebep?: string}}
 */
export function kodGecerliMi(kod, kullanim, simdi = new Date()) {
  if (!kod) return { ok: false, sebep: 'bulunamadi' };
  if (kod.revoked_at) return { ok: false, sebep: 'iptal' };
  if (kod.expires_at && new Date(kod.expires_at).getTime() < simdi.getTime()) {
    return { ok: false, sebep: 'suresi-gecmis' };
  }
  const sinir = Number(kod.max_uses);
  if (Number.isFinite(sinir) && sinir > 0 && Number(kullanim) >= sinir) {
    return { ok: false, sebep: 'kullanim-doldu' };
  }
  return { ok: true };
}

/**
 * Hak satırlarından ŞU ANKİ premium durumunu türetir. Saf.
 * En GEÇ biten hak kazanır; süresiz hak (expires_at null) her zaman kazanır.
 */
export function premiumDurumu(haklar, simdi = new Date()) {
  const t = simdi.getTime();
  let premium = false;
  let bitis = null;      // null + premium=true → süresiz
  let suresiz = false;
  for (const h of haklar || []) {
    if (h.revoked_at) continue;
    if (!h.expires_at) { premium = true; suresiz = true; continue; }
    const son = new Date(h.expires_at).getTime();
    if (Number.isNaN(son) || son <= t) continue;
    premium = true;
    if (bitis == null || son > bitis) bitis = son;
  }
  return {
    premium,
    suresiz: premium && suresiz,
    bitis: premium && !suresiz && bitis != null ? new Date(bitis).toISOString() : null,
  };
}

/** Etkin engeli döndürür (yoksa null). Saf. */
export function etkinEngel(engeller, simdi = new Date()) {
  const t = simdi.getTime();
  for (const e of engeller || []) {
    if (e.lifted_at) continue;
    if (e.until && new Date(e.until).getTime() <= t) continue; // süresi dolmuş
    return e;
  }
  return null;
}

/** Koda göre verilecek bitiş tarihi. grants_days ≤ 0 → süresiz. Saf. */
export function bitisHesapla(grantsDays, simdi = new Date()) {
  const gun = Number(grantsDays);
  if (!Number.isFinite(gun) || gun <= 0) return null;
  return new Date(simdi.getTime() + gun * 24 * 60 * 60 * 1000).toISOString();
}
