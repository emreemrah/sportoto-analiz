// Maç yorumları (tweet mantığı): liste / yaz / düzenle / sil / beğen / cevap / görüntülenme
import { Router } from 'express';
import { sbAdmin, getProfiles } from '../supabase.js';
import { requireAuth, optionalAuth } from '../mw.js';

const router = Router();

// Liste — herkes görebilir (giriş varsa likedByMe + mine işaretlenir)
router.get('/', optionalAuth, async (req, res) => {
  const matchId = String(req.query.matchId || '');
  if (!matchId) return res.status(400).json({ error: 'matchId gerekli.' });

  const { data: rows, error } = await sbAdmin.from('comments')
    .select('*').eq('match_id', matchId).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const ids = rows.map((r) => r.id);
  const likeCount = {};
  const likedByMe = new Set();
  if (ids.length) {
    const { data: likes } = await sbAdmin.from('comment_likes').select('comment_id,user_id').in('comment_id', ids);
    (likes || []).forEach((l) => {
      likeCount[l.comment_id] = (likeCount[l.comment_id] || 0) + 1;
      if (req.user && l.user_id === req.user.id) likedByMe.add(l.comment_id);
    });
  }
  const profiles = await getProfiles(rows.map((r) => r.user_id));

  const comments = rows.map((r) => {
    const p = profiles[r.user_id];
    return {
      id: r.id, matchId: r.match_id, parentId: r.parent_id, text: r.text,
      createdAt: r.created_at, editedAt: r.edited_at, viewCount: r.view_count || 0,
      likeCount: likeCount[r.id] || 0, likedByMe: likedByMe.has(r.id),
      mine: req.user ? r.user_id === req.user.id : false,
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
  await sbAdmin.from('comments').delete().eq('id', id);
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

// Görüntülenme (herkes) — basit artış
router.post('/:id/view', async (req, res) => {
  const id = Number(req.params.id);
  const { data } = await sbAdmin.from('comments').select('view_count').eq('id', id).maybeSingle();
  if (data) await sbAdmin.from('comments').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);
  res.json({ ok: true });
});

export default router;
