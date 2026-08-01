// Maç yorumları (tweet mantığı): liste / yaz / düzenle / sil / beğen / cevap / görüntülenme
// + MODERASYON: bildirme (E9). Engelleme uçları users.js'tedir (profile bağlı).
import { Router } from 'express';
import { sbAdmin, supabaseEnabled, getProfiles } from '../supabase.js';
import { uyelikKapisi } from '../security/supabaseGuard.js';
import { requireAuth, optionalAuth } from '../mw.js';
import {
  BILDIRIM_SEBEPLERI, GIZLI_YORUM_NOTU, NOT_SINIRI,
  engelSeti, gorunurYorumlar, zatenVarMi,
} from '../moderation.js';

const router = Router();

// Supabase kapalıyken sbAdmin null olur; kapı olmadan bu rotalar süreci
// çökertiyordu (ölçüldü). Artık açık bir 503 döner.
router.use(uyelikKapisi(supabaseEnabled));

// Liste — herkes görebilir (giriş varsa likedByMe + mine işaretlenir)
router.get('/', optionalAuth, async (req, res) => {
  const matchId = String(req.query.matchId || '');
  if (!matchId) return res.status(400).json({ error: 'matchId gerekli.' });

  const { data: rows, error } = await sbAdmin.from('comments')
    .select('*').eq('match_id', matchId).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  // Engel listesi okunamazsa liste GÖSTERİLMEZ. Sessizce boş küme kullanmak,
  // engellenen kişinin yorumlarını engelleyene göstermek demekti; özelliğin
  // sessizce çalışmaması, çalışmadığını söylemesinden daha kötüdür.
  let engelli;
  try {
    engelli = await engelSeti(sbAdmin, req.user?.id || null);
  } catch {
    return res.status(503).json({ error: 'Engel listesi okunamadığı için yorumlar gösterilemedi.' });
  }

  const gorunur = gorunurYorumlar(rows, { userId: req.user?.id || null, engelli });

  const ids = gorunur.map((r) => r.id);
  const likeCount = {};
  const likedByMe = new Set();
  if (ids.length) {
    const { data: likes } = await sbAdmin.from('comment_likes').select('comment_id,user_id').in('comment_id', ids);
    (likes || []).forEach((l) => {
      likeCount[l.comment_id] = (likeCount[l.comment_id] || 0) + 1;
      if (req.user && l.user_id === req.user.id) likedByMe.add(l.comment_id);
    });
  }
  const profiles = await getProfiles(gorunur.map((r) => r.user_id));

  const comments = gorunur.map((r) => {
    const p = profiles[r.user_id];
    const benim = req.user ? r.user_id === req.user.id : false;
    return {
      id: r.id, matchId: r.match_id, parentId: r.parent_id, text: r.text,
      createdAt: r.created_at, editedAt: r.edited_at, viewCount: r.view_count || 0,
      likeCount: likeCount[r.id] || 0, likedByMe: likedByMe.has(r.id),
      mine: benim,
      // Gizli yorum yalnız YAZARINA döner (süzgeç bunu garanti eder). Kaç kişinin
      // bildirdiği AÇIKLANMAZ — bildiren kişiyi tahmin ettirmemek için.
      hidden: !!r.hidden_at,
      hiddenNote: r.hidden_at ? GIZLI_YORUM_NOTU : undefined,
      author: p
        ? { id: r.user_id, username: p.username, avatarType: p.avatar_type, avatarKey: p.avatar_key, avatarUrl: p.avatar_url }
        : { id: r.user_id, username: 'Silinmiş kullanıcı', avatarType: 'default' },
    };
  });
  res.json({ matchId, count: comments.length, comments });
});

// Yaz (giriş gerekli). parentId verilirse cevap.
router.post('/', requireAuth, async (req, res) => {
  const { matchId, text, parentId } = req.body || {};
  const t = String(text || '').trim();
  if (!matchId || !t) return res.status(400).json({ error: 'matchId ve metin gerekli.' });
  if (t.length > 500) return res.status(400).json({ error: 'Yorum en fazla 500 karakter olabilir.' });

  // CEVAP KAPISI — engellenen/gizlenen yorumun altına cevap yazılamaz.
  // Süzgeç (gorunurYorumlar) zaten ebeveyni düşen cevabı listede göstermez;
  // yani bu kapı olmasaydı kullanıcı cevabını yazar, "gönderildi" görür ama
  // cevabı hiçbir yerde görünmezdi. Sessizce kaybolan bir yazı, açıkça
  // reddedilen bir yazıdan kötüdür.
  if (parentId) {
    const { data: ust, error: ustHata } = await sbAdmin.from('comments')
      .select('user_id,hidden_at').eq('id', Number(parentId)).maybeSingle();
    if (ustHata) return res.status(500).json({ error: ustHata.message });
    if (!ust) return res.status(404).json({ error: 'Cevaplanan yorum bulunamadı.' });
    if (ust.hidden_at && ust.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bu yoruma şu an cevap yazılamıyor.' });
    }
    let engelli;
    try {
      engelli = await engelSeti(sbAdmin, req.user.id);
    } catch {
      return res.status(503).json({ error: 'Engel listesi okunamadığı için cevap yazılamadı.' });
    }
    // Engel iki yönlüdür ve hangi yönde olduğu SÖYLENMEZ: "seni engelledi"
    // demek, engelin karşı tarafa ilan edilmesi olurdu.
    if (engelli.has(ust.user_id)) {
      return res.status(403).json({ error: 'Bu yoruma şu an cevap yazılamıyor.' });
    }
  }

  const { data, error } = await sbAdmin.from('comments')
    .insert({ match_id: String(matchId), user_id: req.user.id, text: t, parent_id: parentId || null })
    .select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id, ok: true });
});

// Düzenle (sadece sahibi)
router.patch('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const t = String(req.body?.text || '').trim();
  if (!t) return res.status(400).json({ error: 'Metin gerekli.' });
  if (t.length > 500) return res.status(400).json({ error: 'En fazla 500 karakter.' });
  const { data: row } = await sbAdmin.from('comments').select('user_id').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Yorum bulunamadı.' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Sadece kendi yorumunu düzenleyebilirsin.' });
  const { error } = await sbAdmin.from('comments').update({ text: t, edited_at: new Date().toISOString() }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Sil (sadece sahibi)
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { data: row } = await sbAdmin.from('comments').select('user_id').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Yorum bulunamadı.' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Sadece kendi yorumunu silebilirsin.' });
  // Bildirimler ÖNCE silinir. Normalde bunu yabancı anahtar (on delete cascade)
  // yapar; ama 007'de o kısıt KORUMALI ekleniyor (canlı sütun türü ölçülmediği
  // için kurulamama ihtimali var). Kısıt kurulmuşsa bu satır zararsızdır
  // (silinecek bir şey kalmaz); kurulamamışsa bütünlüğü tek koruyan budur.
  await sbAdmin.from('comment_reports').delete().eq('comment_id', id);
  await sbAdmin.from('comments').delete().eq('id', id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// BİLDİR (giriş gerekli)
// ---------------------------------------------------------------------------
// Yanıt, bildirimin SONUCUNU açıklamaz: kaç kişinin bildirdiği, yorumun gizlenip
// gizlenmediği DÖNMEZ. Aksi hâlde bildiren kişi eşiğe ne kadar kaldığını
// görebilir, gizlenme anından bildiren kişi tahmin edilebilirdi.
//
// İDEMPOTENT: aynı yorumu ikinci kez bildirmek hata değildir; `already: true`
// döner. Kullanıcı arayüzünde iki kez dokunmak bir hatayla karşılaşmamalıdır.
router.post('/:id/report', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz yorum.' });

  const reason = String(req.body?.reason || '').trim();
  if (!BILDIRIM_SEBEPLERI.includes(reason)) {
    // Kabul edilen liste yanıtta VERİLİR: arayüz sebep listesini kendi
    // kopyasından değil, sunucudan doğrulayabilsin diye.
    return res.status(400).json({ error: 'Geçerli bir sebep seçilmeli.', reasons: BILDIRIM_SEBEPLERI });
  }
  const note = String(req.body?.note || '').trim();
  if (note.length > NOT_SINIRI) {
    return res.status(400).json({ error: `Açıklama en fazla ${NOT_SINIRI} karakter olabilir.` });
  }

  const { data: row } = await sbAdmin.from('comments').select('user_id').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Yorum bulunamadı.' });
  if (row.user_id === req.user.id) {
    return res.status(400).json({ error: 'Kendi yorumunu bildiremezsin.' });
  }

  const { error } = await sbAdmin.from('comment_reports')
    .insert({ comment_id: id, reporter_id: req.user.id, reason, note });
  if (error) {
    if (zatenVarMi(error.message)) return res.json({ ok: true, already: true });
    return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
});

// Beğen (aynı kullanıcı aynı yorumu bir kez — UNIQUE engeller)
router.post('/:id/like', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { error } = await sbAdmin.from('comment_likes').insert({ comment_id: id, user_id: req.user.id });
  if (error && !/duplicate|unique|conflict/i.test(error.message)) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Beğeniyi geri al
router.delete('/:id/like', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await sbAdmin.from('comment_likes').delete().eq('comment_id', id).eq('user_id', req.user.id);
  res.json({ ok: true });
});

// Görüntülenme (herkes) — basit artış.
// Gizlenmiş yorumun sayacı ARTMAZ: yorum kimseye görünmüyorken sayacın artması,
// yazarına "hâlâ okunuyor" diye yanlış bir bilgi verirdi.
router.post('/:id/view', async (req, res) => {
  const id = Number(req.params.id);
  const { data } = await sbAdmin.from('comments').select('view_count,hidden_at').eq('id', id).maybeSingle();
  if (data && !data.hidden_at) {
    await sbAdmin.from('comments').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);
  }
  res.json({ ok: true });
});

export default router;
