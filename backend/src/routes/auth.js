// Üyelik: kayıt / giriş / şifremi unuttum
import { Router } from 'express';
import { sbAdmin, sbAuth, supabaseEnabled, getProfile } from '../supabase.js';

const router = Router();
const guard = (req, res, next) => (supabaseEnabled ? next() : res.status(503).json({ error: 'Üyelik sistemi yapılandırılmamış.' }));

// Kayıt: auth kullanıcısı (onaylı) + profil + otomatik giriş
router.post('/register', guard, async (req, res) => {
  const { email, password, username } = req.body || {};
  const uname = String(username || '').trim();
  if (!email || !password || !uname) return res.status(400).json({ error: 'E-posta, kullanıcı adı ve şifre gerekli.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  if (uname.length < 3 || uname.length > 24) return res.status(400).json({ error: 'Kullanıcı adı 3-24 karakter olmalı.' });

  const { data: taken } = await sbAdmin.from('profiles').select('id').eq('username', uname).maybeSingle();
  if (taken) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });

  const { data: created, error: ce } = await sbAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (ce) return res.status(400).json({ error: /already|exist|registered/i.test(ce.message) ? 'Bu e-posta zaten kayıtlı.' : ce.message });
  const userId = created.user.id;

  const { error: pe } = await sbAdmin.from('profiles').insert({ id: userId, username: uname });
  if (pe) {
    await sbAdmin.auth.admin.deleteUser(userId).catch(() => {});
    return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
  }

  const { data: session, error: se } = await sbAuth.auth.signInWithPassword({ email, password });
  if (se || !session?.session) return res.status(500).json({ error: 'Kayıt tamam ama giriş yapılamadı, tekrar giriş dene.' });
  res.json({ token: session.session.access_token, user: await getProfile(userId) });
});

// Giriş
router.post('/login', guard, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  const { data, error } = await sbAuth.auth.signInWithPassword({ email, password });
  if (error || !data?.session) return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  res.json({ token: data.session.access_token, user: await getProfile(data.user.id) });
});

// Şifremi unuttum → Supabase e-posta gönderir
router.post('/forgot-password', guard, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'E-posta gerekli.' });
  await sbAuth.auth.resetPasswordForEmail(email).catch(() => {});
  // Bilgi sızdırmamak için her durumda aynı yanıt
  res.json({ ok: true, message: 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.' });
});

export default router;
