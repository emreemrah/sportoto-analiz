// Profil: getir / güncelle (kullanıcı adı, hazır avatar, varsayılan) / resim yükle
import { Router } from 'express';
import { sbAdmin, getProfile } from '../supabase.js';
import { requireAuth } from '../mw.js';

const router = Router();

// Kendi profilim (+ sayaçlar)
router.get('/me', requireAuth, async (req, res) => {
  const profile = await getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profil bulunamadı.' });
  const [{ count: totalComments }, { data: likeRows }] = await Promise.all([
    sbAdmin.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id),
    sbAdmin.from('comments').select('id').eq('user_id', req.user.id),
  ]);
  let totalLikes = 0;
  if (likeRows?.length) {
    const { count } = await sbAdmin.from('comment_likes').select('comment_id', { count: 'exact', head: true })
      .in('comment_id', likeRows.map((r) => r.id));
    totalLikes = count || 0;
  }
  res.json({ ...profile, email: req.user.email, total_comments: totalComments || 0, total_likes_received: totalLikes });
});

// Profil güncelle: username / hazır avatar / varsayılan
router.patch('/me', requireAuth, async (req, res) => {
  const { username, avatarType, avatarKey } = req.body || {};
  const patch = {};
  if (username != null) {
    const u = String(username).trim();
    if (u.length < 3 || u.length > 24) return res.status(400).json({ error: 'Kullanıcı adı 3-24 karakter olmalı.' });
    const { data: ex } = await sbAdmin.from('profiles').select('id').eq('username', u).neq('id', req.user.id).maybeSingle();
    if (ex) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
    patch.username = u;
  }
  if (avatarType === 'preset' && avatarKey) { patch.avatar_type = 'preset'; patch.avatar_key = String(avatarKey); patch.avatar_url = null; }
  else if (avatarType === 'default') { patch.avatar_type = 'default'; patch.avatar_key = null; patch.avatar_url = null; }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
  const { error } = await sbAdmin.from('profiles').update(patch).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(await getProfile(req.user.id));
});

// Kendi resmini yükle: gövdede dataURL (web'de canvas ile 256px'e küçültülmüş)
router.post('/me/avatar', requireAuth, async (req, res) => {
  const { dataUrl } = req.body || {};
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Geçersiz resim (jpg/png/webp olmalı).' });
  const mime = m[1];
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) return res.status(413).json({ error: 'Resim 2 MB sınırını aşıyor.' });
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${req.user.id}/avatar_${Date.now()}.${ext}`;
  const { error: ue } = await sbAdmin.storage.from('avatars').upload(path, buf, { contentType: mime, upsert: true });
  if (ue) return res.status(500).json({ error: ue.message });
  const { data: pub } = sbAdmin.storage.from('avatars').getPublicUrl(path);
  const { error: pe } = await sbAdmin.from('profiles')
    .update({ avatar_type: 'uploaded', avatar_key: null, avatar_url: pub.publicUrl }).eq('id', req.user.id);
  if (pe) return res.status(500).json({ error: pe.message });
  res.json(await getProfile(req.user.id));
});

export default router;
