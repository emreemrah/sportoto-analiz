// Profil: getir / güncelle (kullanıcı adı, hazır avatar, varsayılan) / resim yükle
// + İLERLEME: puan, seviye, rozetler, başarılar, görevler (TÜMÜ sunucu doğrulamalı)
// + ENGELLEME: engellenen kullanıcı listesi / engelle / engeli kaldır (E9).
//   Bildirme ucu routes/comments.js'tedir (yoruma bağlı); engel KİŞİYE bağlı
//   olduğu için burada durur.
import { Router } from 'express';
import { safeError } from '../security/safeError.js';
import { sbAdmin, supabaseEnabled, getProfile, getProfiles } from '../supabase.js';
import { uyelikKapisi } from '../security/supabaseGuard.js';
import { requireAuth } from '../mw.js';
import { zatenVarMi, gecersizHedefMi } from '../moderation.js';
// OYUNLAŞTIRMA TAMAMEN KALDIRILDI (kullanıcı kararı, 2026-08-06): puan,
// seviye, rozet ve /me/progress ucu söküldü. Profil yalnız gerçek sayaçları
// (yorum/beğeni/tahmin) döndürür.
import { countCoupons } from '../couponStore.js';
import { getRoundsForNav, getBulletinByRoundId } from '../sources/sportoto.js';

const router = Router();
router.use(uyelikKapisi(supabaseEnabled));

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
  const uid = req.user.id;
  const [c1, c2, c3, c4] = await Promise.all([
    sbAdmin.from('score_predictions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    sbAdmin.from('player_votes').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    sbAdmin.from('lineup_predictions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    sbAdmin.from('community_poll_votes').select('id', { count: 'exact', head: true }).eq('user_id', uid),
  ]);
  const totalPredictions = (c1.count || 0) + (c2.count || 0) + (c3.count || 0) + (c4.count || 0);
  res.json({
    ...profile,
    email: req.user.email,
    email_verified: !!req.user.email_confirmed_at,
    total_comments: totalComments || 0,
    total_likes_received: totalLikes,
    total_predictions: totalPredictions,
  });
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
  if (req.body.favoriteTeam !== undefined) patch.favorite_team = req.body.favoriteTeam ? String(req.body.favoriteTeam).slice(0, 60) : null;
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });
  const { error } = await sbAdmin.from('profiles').update(patch).eq('id', req.user.id);
  if (error) return safeError(res, error, 'Profil işlemi şu an tamamlanamadı.');
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

// ---------------------------------------------------------------------------
// ENGELLENEN KULLANICILAR
// ---------------------------------------------------------------------------
// Kullanıcı YALNIZ kendi engel listesini görür ve yönetir (req.user.id — istek
// gövdesindeki beyandan değil). "Beni kim engelledi" diye bir uç YOKTUR: engel
// karşı tarafa ilan edilmez.

// Engellediklerim
router.get('/me/blocks', requireAuth, async (req, res) => {
  const { data, error } = await sbAdmin.from('user_blocks')
    .select('blocked_id,created_at').eq('blocker_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return safeError(res, error, 'Profil işlemi şu an tamamlanamadı.');

  const rows = data || [];
  const profiles = await getProfiles(rows.map((r) => r.blocked_id));
  res.json({
    blocks: rows.map((r) => {
      const p = profiles[r.blocked_id];
      return {
        userId: r.blocked_id,
        createdAt: r.created_at,
        // Hesabı silinmiş kişi listede KALIR ve dürüstçe etiketlenir; satırı
        // gizlemek, kullanıcıya "engelim kayboldu" izlenimi verirdi.
        username: p ? p.username : 'Silinmiş kullanıcı',
        avatarType: p ? p.avatar_type : 'default',
        avatarKey: p ? p.avatar_key : null,
        avatarUrl: p ? p.avatar_url : null,
      };
    }),
  });
});

// Engelle (idempotent)
router.post('/me/blocks', requireAuth, async (req, res) => {
  const hedef = String(req.body?.userId || '').trim();
  if (!hedef) return res.status(400).json({ error: 'userId gerekli.' });
  if (hedef === req.user.id) return res.status(400).json({ error: 'Kendini engelleyemezsin.' });

  const { error } = await sbAdmin.from('user_blocks')
    .insert({ blocker_id: req.user.id, blocked_id: hedef });
  if (error) {
    // Zaten engelliyse hata değildir: arayüzde iki kez dokunmak kırmızı bir
    // uyarıyla karşılaşmamalı.
    if (zatenVarMi(error.message)) return res.json({ ok: true, already: true });
    if (gecersizHedefMi(error.message)) return res.status(400).json({ error: 'Kullanıcı bulunamadı.' });
    return safeError(res, error, 'Profil işlemi şu an tamamlanamadı.');
  }
  res.json({ ok: true });
});

// Engeli kaldır (idempotent — kayıt yoksa da başarı döner)
router.delete('/me/blocks/:userId', requireAuth, async (req, res) => {
  const hedef = String(req.params.userId || '').trim();
  if (!hedef) return res.status(400).json({ error: 'userId gerekli.' });
  const { error } = await sbAdmin.from('user_blocks').delete()
    .eq('blocker_id', req.user.id).eq('blocked_id', hedef);
  if (error) {
    // Bozuk uuid silme sorgusunu düşürebilir; kullanıcıya 500 yerine anlaşılır
    // bir yanıt dönmeli.
    if (gecersizHedefMi(error.message)) return res.status(400).json({ error: 'Kullanıcı bulunamadı.' });
    return safeError(res, error, 'Profil işlemi şu an tamamlanamadı.');
  }
  res.json({ ok: true });
});

export default router;
