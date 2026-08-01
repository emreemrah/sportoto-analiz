// ---------------------------------------------------------------------------
// MODERASYON İŞLEMLERİ — operatörün yaptığı üç şey
// ---------------------------------------------------------------------------
// Bu dosya, bildirimleri inceleyen kişinin verdiği kararları veritabanına
// yazar: yorumu GİZLE, gizlemeyi GERİ AL, bildirimi YOK SAY.
//
// ═══ NEDEN AYRI BİR DOSYA ═══
// Rota dosyaları (routes/*.js) modül yüklenirken `sbAdmin` tekilini içeri alır;
// bu yüzden bağlantısız ortamda HTTP seviyesinde test edilemezler. Buradaki
// işlevler istemciyi DIŞARIDAN alır (`sb`), böylece hem sahte istemciyle hem de
// gerçek PostgreSQL ile aynı kod ölçülebilir.
//
// ═══ EN ÖNEMLİ KISIM: SIRA ═══
// 007'deki trigger, `comment_reports` üzerindeki HER ekleme/güncelleme/silme
// sonrası şunu yapar:
//
//     gecerli := count(distinct reporter_id) where comment_id = hedef
//                                             and status <> 'ret'
//     gecerli >= 3  →  hidden_at = coalesce(hidden_at, now()),
//                      hidden_reason = coalesce(hidden_reason, 'otomatik: bildirim esigi')
//                      (yalnız hidden_at IS NULL olan satıra)
//     aksi hâlde    →  hidden_at = null, hidden_reason = null
//                      (yalnız hidden_reason = 'otomatik: bildirim esigi' olan satıra)
//
// Trigger `comments` güncellemelerinde ÇALIŞMAZ; yalnız bildirim satırları
// değişince çalışır. Bu iki gerçek, aşağıdaki sırayı zorunlu kılar:
//
//   GİZLE     → önce yorumu gizle (sebep ELLE), sonra bildirimleri 'kabul' yap.
//               Sebep 'otomatik: bildirim esigi' DEĞİL diye, trigger'ın geri
//               alma dalı bu gizlemeyi asla temizleyemez. (Testle ölçülür.)
//
//   GERİ AL   → ÖNCE bildirimleri 'ret' yap (sayım 3'ün altına düşsün), SONRA
//               hidden_at'i temizle. Ters sırada yapılırsa geride 3 geçerli
//               bildirim kalır; o yoruma yapılacak herhangi bir bildirim
//               hareketi yorumu SESSİZCE yeniden gizlerdi.
//
//   YOK SAY   → tek bildirimi 'ret' yap. Sayım 3'ün altına düşerse OTOMATİK
//               gizlenmiş yorum kendiliğinden görünür olur; ELLE gizlenmiş
//               yoruma dokunulmaz (sebep farklı). Bu, kasıtlı davranıştır.
//
// ═══ GİZLİLİK ═══
// Bu uçların hiçbiri BİLDİREN kişinin kimliğini döndürmez — operatöre de.
// Bildiren kimliğinin hiçbir uçtan dönmemesi projenin baştan beri koyduğu
// kural; incelemeyi yapmak için gerekli olan şey bildirenin kim olduğu değil,
// yorumun kendisi ve bildirim sebepleridir.

import { OTOMATIK_GIZLEME_SEBEBI } from './moderation.js';

/**
 * Elle gizlemenin sebebi. OTOMATIK_GIZLEME_SEBEBI'nden FARKLI olması bir
 * tesadüf değil, tasarımın temeli: trigger yalnız kendi yazdığı sebebi geri
 * alır. Bu iki metin bir gün eşitlenirse operatörün kararı, sonradan gelen
 * bildirim hareketleriyle sessizce silinir.
 */
export const ELLE_GIZLEME_SEBEBI = 'moderasyon: kural ihlali';

/** Bildirim durumları (007'deki CHECK ile aynı). */
export const BILDIRIM_DURUMLARI = Object.freeze(['beklemede', 'kabul', 'ret']);

/** Bir inceleme listesinde en çok kaç yorum döner. */
export const LISTE_SINIRI = 100;

// İki sebep metni ASLA aynı olmamalı; aynı olurlarsa yukarıdaki tüm mantık
// çöker. Modül yüklenirken patlaması, üretimde sessizce yanlış davranmasından
// iyidir.
if (ELLE_GIZLEME_SEBEBI === OTOMATIK_GIZLEME_SEBEBI) {
  throw new Error('Elle ve otomatik gizleme sebepleri AYNI olamaz (trigger kararı ezer).');
}

/**
 * Bir yorum/bildirim numarasını okur; geçerli değilse null döner.
 *
 * `comments.id` ve `comment_reports.id` ikisi de `bigint ... identity`, yani
 * her zaman 1'den büyük bir tam sayıdır. Bu yüzden 0, negatif, ondalıklı ve
 * sayı olmayan girdiler VERİTABANINA HİÇ GİTMEDEN reddedilir:
 *
 *   • `Number(null)` ve `Number('')` 0'dır. Sade bir `Number.isFinite`
 *     kontrolü bunları geçirir ve "0 numaralı yorum" aranır — istek aslında
 *     bozukken kullanıcıya "yorum bulunamadı" (404) denirdi. Doğrusu 400.
 *   • Sayı olmayan bir metin gerçek PostgreSQL'de tür hatası verir; bu, 500
 *     olarak görünür ve bozuk isteği sunucu hatası gibi gösterirdi.
 *
 * @returns {number|null}
 */
function kimlikOku(deger) {
  const n = Number(deger);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Bildirim satırlarını yoruma göre gruplar. SAF işlev — veritabanı yok.
 *
 * Çıktıda `reporter_id` YOKTUR; yerine yalnız KAÇ FARKLI kişinin bildirdiği
 * (`reporterCount`) döner. Sayının kendisi operatöre gerekli: 3'e ulaşan yorum
 * zaten otomatik gizlenmiştir, 1 bildirimli yorum ise insan kararı bekliyordur.
 *
 * @param {Array<object>} satirlar comment_reports satırları
 * @returns {Array<object>} yorum başına özet, en çok bildirilen önce
 */
export function bildirimleriGrupla(satirlar) {
  const kova = new Map();
  for (const r of satirlar || []) {
    const cid = r?.comment_id;
    if (cid == null) continue;
    const anahtar = String(cid);
    if (!kova.has(anahtar)) {
      kova.set(anahtar, {
        commentId: cid,
        reporters: new Set(),
        reasons: {},
        reports: [],
        firstAt: null,
        lastAt: null,
      });
    }
    const g = kova.get(anahtar);
    if (r.reporter_id) g.reporters.add(String(r.reporter_id));
    const sebep = String(r.reason || 'diger');
    g.reasons[sebep] = (g.reasons[sebep] || 0) + 1;
    g.reports.push({
      id: r.id,
      reason: sebep,
      note: String(r.note || ''),
      status: r.status || 'beklemede',
      createdAt: r.created_at || null,
    });
    const t = r.created_at || null;
    if (t) {
      if (!g.firstAt || t < g.firstAt) g.firstAt = t;
      if (!g.lastAt || t > g.lastAt) g.lastAt = t;
    }
  }

  return [...kova.values()]
    .map((g) => ({
      commentId: g.commentId,
      reporterCount: g.reporters.size,
      reportCount: g.reports.length,
      reasons: g.reasons,
      reports: g.reports,
      firstAt: g.firstAt,
      lastAt: g.lastAt,
    }))
    // Çok bildirilen ve eskiyen önce: sıra, "hangisine önce bakmalıyım"
    // sorusunun cevabıdır.
    .sort((a, b) => b.reporterCount - a.reporterCount || String(a.firstAt).localeCompare(String(b.firstAt)));
}

/**
 * İncelenmeyi bekleyen bildirimleri, ait oldukları yorumla birlikte getirir.
 *
 * @param {object} sb        Supabase (admin) istemcisi
 * @param {object} secenek
 * @param {number} [secenek.limit]
 * @param {(ids: string[]) => Promise<object>} [secenek.profilOku]
 *        Kullanıcı adlarını çözen işlev. Dışarıdan verilir ki bu modül
 *        `supabase.js`'i içeri almak zorunda kalmasın (test edilebilirlik).
 * @returns {Promise<{items: Array<object>, total: number, orphanCount: number}>}
 */
export async function bekleyenBildirimler(sb, { limit = LISTE_SINIRI, profilOku = null } = {}) {
  const { data: bildirimler, error } = await sb
    .from('comment_reports')
    .select('id,comment_id,reason,note,status,created_at,reporter_id')
    .eq('status', 'beklemede')
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const gruplar = bildirimleriGrupla(bildirimler || []);
  const kesit = gruplar.slice(0, limit);
  if (!kesit.length) return { items: [], total: 0, orphanCount: 0 };

  const ids = kesit.map((g) => g.commentId);
  const { data: yorumlar, error: yHata } = await sb
    .from('comments')
    .select('id,match_id,user_id,text,created_at,hidden_at,hidden_reason')
    .in('id', ids);
  if (yHata) throw new Error(yHata.message);

  const yorumHarita = new Map((yorumlar || []).map((c) => [String(c.id), c]));

  // Silinmiş yoruma ait bildirimler SESSİZCE ATILMAZ, sayılır: 007'deki yabancı
  // anahtar korumalı eklendiği için gerçekten öksüz satır kalabilir ve operatör
  // "listede 5 yazıyordu, 4 gördüm" durumuna düşmemeli.
  const oksuz = kesit.filter((g) => !yorumHarita.has(String(g.commentId)));
  const eslesen = kesit.filter((g) => yorumHarita.has(String(g.commentId)));

  let profiller = {};
  if (profilOku) {
    const kullanicilar = [...new Set(eslesen.map((g) => yorumHarita.get(String(g.commentId)).user_id).filter(Boolean))];
    if (kullanicilar.length) profiller = (await profilOku(kullanicilar)) || {};
  }

  const items = eslesen.map((g) => {
    const c = yorumHarita.get(String(g.commentId));
    const p = profiller[c.user_id];
    return {
      commentId: c.id,
      matchId: c.match_id,
      text: c.text,
      createdAt: c.created_at,
      hidden: !!c.hidden_at,
      hiddenAt: c.hidden_at || null,
      // Gizlemenin ELLE mi OTOMATİK mi olduğu operatöre gerekir: otomatik
      // gizlenmiş yorumu "geri al" ile açabilir, elle gizlediğini zaten bilir.
      hiddenBy: c.hidden_at ? (c.hidden_reason === ELLE_GIZLEME_SEBEBI ? 'elle' : 'otomatik') : null,
      reporterCount: g.reporterCount,
      reportCount: g.reportCount,
      reasons: g.reasons,
      reports: g.reports,
      firstAt: g.firstAt,
      lastAt: g.lastAt,
      // Yorum sahibinin YALNIZ kullanıcı adı döner; e-posta ve kimlik dönmez.
      author: { username: p?.username || 'Silinmiş kullanıcı' },
    };
  });

  return {
    items,
    total: gruplar.length,
    orphanCount: oksuz.reduce((t, g) => t + g.reportCount, 0),
  };
}

/**
 * Yorumu ELLE gizler ve bekleyen bildirimlerini 'kabul' olarak kapatır.
 *
 * SIRA: önce yorum, sonra bildirimler. Sebep ELLE_GIZLEME_SEBEBI yazılır;
 * trigger'ın geri alma dalı yalnız otomatik sebebi temizlediği için bu karar
 * sonradan gelen bildirim hareketleriyle bozulamaz.
 *
 * `hidden_at` zaten doluysa KORUNUR: yorum otomatik gizlenmişse gizlenme anı
 * ileri kaymamalı, yoksa "ne zamandır gizli" bilgisi yanlış olur.
 */
export async function yorumuGizle(sb, { commentId, operatorId, now = new Date().toISOString() } = {}) {
  const id = kimlikOku(commentId);
  if (id === null) return { ok: false, sebep: 'gecersiz-yorum' };

  const { data: row, error } = await sb
    .from('comments').select('id,hidden_at,hidden_reason').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { ok: false, sebep: 'yorum-yok' };

  const gizlenmeAni = row.hidden_at || now;
  const { error: gHata } = await sb.from('comments')
    .update({ hidden_at: gizlenmeAni, hidden_reason: ELLE_GIZLEME_SEBEBI })
    .eq('id', id);
  if (gHata) throw new Error(gHata.message);

  const { error: bHata } = await sb.from('comment_reports')
    .update({ status: 'kabul', reviewed_at: now, reviewed_by: operatorId || null })
    .eq('comment_id', id)
    .eq('status', 'beklemede');
  if (bHata) throw new Error(bHata.message);

  return { ok: true, hidden: true, hiddenAt: gizlenmeAni, hiddenBy: 'elle' };
}

/**
 * Gizlemeyi geri alır: yorum yeniden görünür olur.
 *
 * SIRA: ÖNCE bildirimler 'ret' yapılır. Bu, trigger'ı çalıştırır ve geçerli
 * bildirim sayısı 0'a düşer; otomatik gizlenmiş bir yorumu trigger zaten o anda
 * açar. SONRA hidden_at temizlenir — bu, elle gizlenmiş yorumlar için gerekli
 * olan adımdır (trigger onlara dokunmaz).
 *
 * SONUÇ (bilinmesi gereken): 007'deki `unique (comment_id, reporter_id)`
 * yüzünden aynı kişiler yeniden bildiremez. Geri alınan bir yorum ancak ÜÇ
 * BAŞKA kişi bildirirse tekrar otomatik gizlenir. Bu, haksız bildirim
 * dalgalarına karşı kasıtlı bir korumadır.
 */
export async function yorumuGeriAl(sb, { commentId, operatorId, now = new Date().toISOString() } = {}) {
  const id = kimlikOku(commentId);
  if (id === null) return { ok: false, sebep: 'gecersiz-yorum' };

  const { data: row, error } = await sb
    .from('comments').select('id,hidden_at').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { ok: false, sebep: 'yorum-yok' };

  // 1) Bildirimleri kapat — trigger'ın sayımı burada düşer.
  const { error: bHata } = await sb.from('comment_reports')
    .update({ status: 'ret', reviewed_at: now, reviewed_by: operatorId || null })
    .eq('comment_id', id)
    .neq('status', 'ret');
  if (bHata) throw new Error(bHata.message);

  // 2) Elle gizlemeyi de temizle (trigger buna dokunmaz).
  const { error: gHata } = await sb.from('comments')
    .update({ hidden_at: null, hidden_reason: null })
    .eq('id', id);
  if (gHata) throw new Error(gHata.message);

  return { ok: true, hidden: false };
}

/**
 * Tek bir bildirimi yerinde bulmaz ('ret').
 *
 * Yan etki KASITLIDIR: geçerli bildirim sayısı 3'ün altına düşerse, OTOMATİK
 * gizlenmiş yorum trigger tarafından kendiliğinden geri açılır. Elle gizlenmiş
 * yorum ise gizli kalır — operatörün kararı bir bildirimin reddiyle silinmez.
 */
export async function bildirimiYokSay(sb, { reportId, operatorId, now = new Date().toISOString() } = {}) {
  const id = kimlikOku(reportId);
  if (id === null) return { ok: false, sebep: 'gecersiz-bildirim' };

  const { data: row, error } = await sb
    .from('comment_reports').select('id,comment_id,status').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { ok: false, sebep: 'bildirim-yok' };
  if (row.status === 'ret') return { ok: true, already: true, commentId: row.comment_id };

  const { error: uHata } = await sb.from('comment_reports')
    .update({ status: 'ret', reviewed_at: now, reviewed_by: operatorId || null })
    .eq('id', id);
  if (uHata) throw new Error(uHata.message);

  return { ok: true, commentId: row.comment_id };
}
