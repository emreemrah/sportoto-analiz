// ÜYELİK: kayıt / e-posta doğrulama / giriş / oturum yenileme / çıkış /
//         cihazlar / şifre-e-posta değiştirme / güvenlik olayları / HESAP SİLME
//
// GÜVENLİK MODELİ (özet — ayrıntı: yayin/07-HESAP-SISTEMI-RAPORU.md)
//   • Şifre özetleri Supabase Auth'ta (bcrypt, kullanıcı başına salt). Bu koda,
//     veritabanımıza, loglara veya cihaza DÜZ METİN ŞİFRE ASLA yazılmaz.
//   • Erişim belirteci kısa ömürlüdür; yenileme anahtarı TEK KULLANIMLIK döner
//     (rotasyon). Yenileme, sunucudaki oturum kaydı iptal edilmemişse çalışır.
//   • Hassas işlemler (şifre/e-posta değiştirme, hesap silme) MEVCUT ŞİFRE ile
//     yeniden doğrulama ister.
//   • Tüm girişler oran sınırlamalıdır; güvenlik olayları security_logs'a yazılır.
//   • Kullanıcı kimliği ASLA istemcinin beyanından alınmaz; her istekte JWT
//     Supabase'e doğrulatılır (mw.js).
import { Router } from 'express';
import { sbAdmin, sbAuth, supabaseEnabled, getProfile } from '../supabase.js';
import { requireAuth } from '../mw.js';
import { deleteUserAccount, makeCouponPurger } from '../accountDeletion.js';
import { deleteCoupons } from '../couponStore.js';
import { makeRateLimiter, rateLimitMiddleware } from '../security/rateLimit.js';
import { logSecurityEvent, maskEmail } from '../security/securityLog.js';
import {
  createSession, verifySession, revokeSession, revokeAllSessions, listSessions,
} from '../security/sessionService.js';
import { parseCookies } from '../mw.js';

const router = Router();
const guard = (req, res, next) => (supabaseEnabled ? next() : res.status(503).json({ error: 'Üyelik sistemi yapılandırılmamış.' }));

// ---------------------------------------------------------------------------
// ORAN SINIRLAMA — kaba kuvvete karşı; başarılı işlemde sayaç temizlenir.
// ---------------------------------------------------------------------------
const loginLimiter = makeRateLimiter({ windowMs: 15 * 60 * 1000, limit: 10, blockMs: 15 * 60 * 1000 });
const registerLimiter = makeRateLimiter({ windowMs: 60 * 60 * 1000, limit: 5, blockMs: 30 * 60 * 1000 });
const forgotLimiter = makeRateLimiter({ windowMs: 60 * 60 * 1000, limit: 5, blockMs: 30 * 60 * 1000 });
const refreshLimiter = makeRateLimiter({ windowMs: 15 * 60 * 1000, limit: 60, blockMs: 5 * 60 * 1000 });
const sensitiveLimiter = makeRateLimiter({ windowMs: 15 * 60 * 1000, limit: 5, blockMs: 15 * 60 * 1000 });

const rl = (limiter) => rateLimitMiddleware(limiter);

// ---------------------------------------------------------------------------
// ÇEREZ YARDIMCILARI (web üretimi: HttpOnly + Secure + SameSite)
// Web istemcisi cookieMode:true gönderirse belirteçler HttpOnly çerezlerde
// taşınır — JavaScript okuyamaz (XSS'e karşı). CSRF'e karşı: durum değiştiren
// isteklerde X-Session-Id başlığı ZORUNLUDUR (çift-anahtar yöntemi; mw.js).
// ---------------------------------------------------------------------------
const AT_COOKIE = 'sportoto_at';
const RT_COOKIE = 'sportoto_rt';
function cookieFlags(req) {
  // Üretimde (HTTPS) Secure zorunlu; geliştirmede http://localhost için esnek.
  const secure = process.env.NODE_ENV === 'production' || req.secure;
  return `HttpOnly; SameSite=Lax; Path=/api${secure ? '; Secure' : ''}`;
}
function setAuthCookies(req, res, { token, refreshToken }) {
  const flags = cookieFlags(req);
  res.append('Set-Cookie', `${AT_COOKIE}=${encodeURIComponent(token)}; Max-Age=3600; ${flags}`);
  res.append('Set-Cookie', `${RT_COOKIE}=${encodeURIComponent(refreshToken)}; Max-Age=${60 * 60 * 24 * 60}; ${flags}`);
}
function clearAuthCookies(req, res) {
  const flags = cookieFlags(req);
  res.append('Set-Cookie', `${AT_COOKIE}=; Max-Age=0; ${flags}`);
  res.append('Set-Cookie', `${RT_COOKIE}=; Max-Age=0; ${flags}`);
}

// Giriş/kayıt yanıtını tek biçimde kurar: oturum satırı + (istenirse) çerezler.
async function issueSession(req, res, { session, user }) {
  const { deviceId, deviceName, platform, cookieMode } = req.body || {};
  const sessionId = await createSession(sbAdmin, {
    userId: user.id,
    clientDeviceId: deviceId,
    deviceName,
    platform,
    req,
  });
  const payload = {
    token: session.access_token,
    refreshToken: session.refresh_token || null,
    sessionId,
    user: await getProfile(user.id),
    emailVerified: !!user.email_confirmed_at,
  };
  if (cookieMode) {
    setAuthCookies(req, res, { token: session.access_token, refreshToken: session.refresh_token || '' });
    // Çerez modunda belirteçler gövdede TEKRARLANMAZ (XSS yüzeyini küçültür).
    payload.token = null;
    payload.refreshToken = null;
    payload.cookieMode = true;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// KAYIT — e-posta doğrulama Supabase panelinde "Confirm email" AÇIKSA gerçek
// doğrulama e-postası gönderilir ve doğrulanana dek giriş yapılamaz.
// ---------------------------------------------------------------------------
router.post('/register', guard, rl(registerLimiter), async (req, res) => {
  const { email, password, username } = req.body || {};
  const uname = String(username || '').trim();
  if (!email || !password || !uname) return res.status(400).json({ error: 'E-posta, kullanıcı adı ve şifre gerekli.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı.' });
  if (uname.length < 3 || uname.length > 24) return res.status(400).json({ error: 'Kullanıcı adı 3-24 karakter olmalı.' });

  const { data: taken } = await sbAdmin.from('profiles').select('id').eq('username', uname).maybeSingle();
  if (taken) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });

  // signUp: "Confirm email" AÇIKSA doğrulama e-postası gönderir ve session=null
  // döner; KAPALIYSA doğrudan oturum verir. İki durum da desteklenir.
  const { data, error } = await sbAuth.auth.signUp({ email, password });
  if (error) {
    const msg = /already|exist|registered/i.test(error.message) ? 'Bu e-posta zaten kayıtlı.' : error.message;
    return res.status(400).json({ error: msg });
  }
  // Supabase, kayıtlı e-postada hata yerine identities boş bir kullanıcı döner
  // (hesap-tarama koruması). Kullanıcıya dürüst ve net mesaj verilir.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı. Giriş yapmayı veya şifre sıfırlamayı dene.' });
  }
  const userId = data.user.id;

  const { error: pe } = await sbAdmin.from('profiles').insert({ id: userId, username: uname });
  if (pe) {
    await sbAdmin.auth.admin.deleteUser(userId).catch(() => {});
    return res.status(409).json({ error: 'Bu kullanıcı adı alınmış.' });
  }

  logSecurityEvent(sbAdmin, { userId, event: 'register', req, meta: { email_masked: maskEmail(email) } });

  if (!data.session) {
    // Doğrulama e-postası gönderildi; doğrulanana kadar oturum YOK.
    return res.status(201).json({
      needsVerification: true,
      message: 'Hesabın oluşturuldu. E-postana gelen doğrulama bağlantısına tıkladıktan sonra giriş yapabilirsin.',
    });
  }
  // Doğrulama kapalıysa (panel ayarı) eski davranış: doğrudan giriş.
  res.status(201).json(await issueSession(req, res, { session: data.session, user: data.user }));
});

// Doğrulama e-postasını yeniden gönder (bilgi sızdırmayan tek tip yanıt).
router.post('/resend-verification', guard, rl(forgotLimiter), async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'E-posta gerekli.' });
  await sbAuth.auth.resend({ type: 'signup', email: String(email) }).catch(() => {});
  res.json({ ok: true, message: 'Eğer bu e-posta doğrulama bekliyorsa, yeni bağlantı gönderildi.' });
});

// ---------------------------------------------------------------------------
// GİRİŞ
// ---------------------------------------------------------------------------
router.post('/login', guard, rl(loginLimiter), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  const { data, error } = await sbAuth.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    if (/not confirmed/i.test(error?.message || '')) {
      logSecurityEvent(sbAdmin, { event: 'login_unverified', req, meta: { email_masked: maskEmail(email) } });
      return res.status(403).json({
        needsVerification: true,
        error: 'E-postan henüz doğrulanmadı. Gelen kutunu kontrol et; istersen doğrulama bağlantısını yeniden gönderebilirsin.',
      });
    }
    logSecurityEvent(sbAdmin, { event: 'login_failed', req, meta: { email_masked: maskEmail(email) } });
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }
  req.rateLimiter?.clear?.(req.rateLimitKey); // doğru şifre → ceza sayacı sıfır
  const out = await issueSession(req, res, { session: data.session, user: data.user });
  logSecurityEvent(sbAdmin, {
    userId: data.user.id, event: 'login_success', req,
    meta: { sessionId: out.sessionId, platform: req.body?.platform, deviceName: req.body?.deviceName },
  });
  res.json(out);
});

// ---------------------------------------------------------------------------
// OTURUM YENİLEME — süreli + rotasyonlu + iptal kontrollü.
// Yenileme anahtarı TEK KULLANIMLIKTIR; her yenilemede yenisi verilir.
// Oturum uzaktan kapatıldıysa yenileme REDDEDİLİR.
// ---------------------------------------------------------------------------
router.post('/refresh', guard, rl(refreshLimiter), async (req, res) => {
  const cookies = parseCookies(req);
  const refreshToken = req.body?.refreshToken || cookies[RT_COOKIE];
  const sessionId = req.body?.sessionId || req.headers['x-session-id'] || null;
  if (!refreshToken) return res.status(400).json({ error: 'Yenileme anahtarı gerekli.' });

  const { data, error } = await sbAuth.auth.refreshSession({ refresh_token: String(refreshToken) });
  if (error || !data?.session) {
    return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen yeniden giriş yap.' });
  }

  // Oturum kaydı iptal edilmişse yenileme geçersizdir (uzaktan kapatma kesindir).
  if (sessionId) {
    const v = await verifySession(sbAdmin, { userId: data.user.id, sessionId });
    if (!v.ok) {
      logSecurityEvent(sbAdmin, { userId: data.user.id, event: 'refresh_denied', req, meta: { sessionId, reason: v.reason } });
      return res.status(401).json({ error: 'Bu oturum kapatılmış. Lütfen yeniden giriş yap.' });
    }
  }

  const cookieMode = !!(req.body?.cookieMode || cookies[RT_COOKIE]);
  const payload = {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token || null,
    sessionId: sessionId || null,
  };
  if (cookieMode) {
    setAuthCookies(req, res, { token: data.session.access_token, refreshToken: data.session.refresh_token || '' });
    payload.token = null;
    payload.refreshToken = null;
    payload.cookieMode = true;
  }
  res.json(payload);
});

// ---------------------------------------------------------------------------
// ÇIKIŞ — sunucudaki oturum kaydı iptal edilir; çerezler temizlenir.
// ---------------------------------------------------------------------------
router.post('/logout', guard, requireAuth, async (req, res) => {
  const sessionId = req.sessionId || null;
  if (sessionId) await revokeSession(sbAdmin, { userId: req.user.id, sessionId, reason: 'logout' });
  clearAuthCookies(req, res);
  logSecurityEvent(sbAdmin, { userId: req.user.id, event: 'logout', req, meta: { sessionId } });
  res.json({ ok: true });
});

// Diğer TÜM cihazlardaki oturumları kapat (bu cihaz açık kalır).
router.post('/logout-all', guard, requireAuth, rl(sensitiveLimiter), async (req, res) => {
  const n = await revokeAllSessions(sbAdmin, {
    userId: req.user.id, exceptSessionId: req.sessionId || null, reason: 'remote',
  });
  logSecurityEvent(sbAdmin, { userId: req.user.id, event: 'logout_all', req, meta: { count: n } });
  res.json({ ok: true, closed: n });
});

// ---------------------------------------------------------------------------
// BAĞLI CİHAZLAR / OTURUMLAR
// ---------------------------------------------------------------------------
router.get('/sessions', guard, requireAuth, async (req, res) => {
  const out = await listSessions(sbAdmin, { userId: req.user.id, currentSessionId: req.sessionId || null });
  res.json({
    ...out,
    note: out.degraded
      ? 'Cihaz listesi için veritabanı migration 006 gerekli. Uygulanana kadar bu liste boş görünür.'
      : undefined,
  });
});

// Belirli bir cihazın oturumunu UZAKTAN kapat (yalnız kendi oturumların).
router.delete('/sessions/:id', guard, requireAuth, async (req, res) => {
  const ok = await revokeSession(sbAdmin, {
    userId: req.user.id, sessionId: String(req.params.id || ''), reason: 'remote',
  });
  if (!ok) return res.status(404).json({ error: 'Oturum bulunamadı ya da zaten kapatılmış.' });
  logSecurityEvent(sbAdmin, { userId: req.user.id, event: 'session_revoked', req, meta: { sessionId: req.params.id } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// HASSAS İŞLEMLER — mevcut şifreyle YENİDEN doğrulama zorunlu.
// ---------------------------------------------------------------------------
async function reauth(req, res) {
  const password = req.body?.currentPassword;
  if (!password) {
    res.status(400).json({ error: 'Bu işlem için mevcut şifreni girmen gerekiyor.' });
    return false;
  }
  const { error } = await sbAuth.auth.signInWithPassword({ email: req.user.email, password });
  if (error) {
    logSecurityEvent(sbAdmin, { userId: req.user.id, event: 'reauth_failed', req });
    res.status(401).json({ error: 'Mevcut şifre hatalı.' });
    return false;
  }
  return true;
}

// Şifre değiştir: mevcut şifre doğrulanır → şifre güncellenir → DİĞER oturumlar kapatılır.
router.post('/change-password', guard, requireAuth, rl(sensitiveLimiter), async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı.' });
  }
  if (!(await reauth(req, res))) return;
  const { error } = await sbAdmin.auth.admin.updateUserById(req.user.id, { password: String(newPassword) });
  if (error) return res.status(500).json({ error: 'Şifre güncellenemedi: ' + error.message });
  const closed = await revokeAllSessions(sbAdmin, {
    userId: req.user.id, exceptSessionId: req.sessionId || null, reason: 'password_change',
  });
  logSecurityEvent(sbAdmin, { userId: req.user.id, event: 'password_changed', req, meta: { count: closed } });
  res.json({ ok: true, closedOtherSessions: closed, message: 'Şifren değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.' });
});

// E-posta değiştir: mevcut şifre doğrulanır → doğrulama e-postası yeni adrese gider.
router.post('/change-email', guard, requireAuth, rl(sensitiveLimiter), async (req, res) => {
  const { newEmail } = req.body || {};
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(newEmail))) {
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.' });
  }
  if (!(await reauth(req, res))) return;
  // Kullanıcı adına (kendi belirteciyle) istenir ki Supabase DOĞRULAMA e-postası
  // göndersin; admin ile doğrudan değiştirmek doğrulamayı atlardı.
  const { createClient } = await import('@supabase/supabase-js');
  const asUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${req.token}` } },
  });
  const { error } = await asUser.auth.updateUser({ email: String(newEmail) });
  if (error) return res.status(400).json({ error: 'E-posta değiştirilemedi: ' + error.message });
  logSecurityEvent(sbAdmin, { userId: req.user.id, event: 'email_change_requested', req, meta: { email_masked: maskEmail(newEmail) } });
  res.json({ ok: true, message: 'Doğrulama bağlantısı gönderildi. Yeni adresini doğrulayınca değişiklik tamamlanır.' });
});

// Kullanıcının kendi güvenlik olayları (şeffaflık: son girişler, değişiklikler).
router.get('/security-events', guard, requireAuth, async (req, res) => {
  try {
    const { data, error } = await sbAdmin
      .from('security_logs')
      .select('event,ip,created_at,meta')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    res.json({ events: data || [] });
  } catch {
    res.json({ events: [], note: 'Güvenlik kaydı için migration 006 gerekli.' });
  }
});

// Şifremi unuttum → Supabase e-posta gönderir (bilgi sızdırmayan tek tip yanıt).
router.post('/forgot-password', guard, rl(forgotLimiter), async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'E-posta gerekli.' });
  await sbAuth.auth.resetPasswordForEmail(email).catch(() => {});
  res.json({ ok: true, message: 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.' });
});

// ————————————————————————————————————————————————————————————————
// HESAP SİLME (Google Play "Kullanıcı Verileri" politikası zorunluluğu)
//
// İKİ YOL vardır ve İKİSİ DE GERÇEK silme yapar:
//   1) DELETE /api/auth/me           → uygulama içinden (giriş + MEVCUT ŞİFRE)
//   2) POST   /api/auth/delete-account → uygulamayı KURMADAN, web sayfasından
//
// Silme kalıcıdır, geri alınamaz; pasife alma DEĞİLDİR. Ayrıntı ve tablo
// listesi: src/accountDeletion.js
// ————————————————————————————————————————————————————————————————

export const DELETE_CONFIRM_PHRASE = 'HESABIMI SIL';

// Onay metnini karşılaştırırken büyük/küçük harf ve Türkçe "İ/I" farkı sorun
// çıkarmasın diye sadeleştirilir.
function normalizeConfirm(v) {
  return String(v || '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const purgeCoupons = makeCouponPurger(deleteCoupons);

// Silme sonucunu kullanıcıya anlaşılır biçimde döndürür. Kısmi başarısızlıkta
// "silindi" DENMEZ; hangi adımın tamamlanamadığı dürüstçe bildirilir.
function respondWithResult(res, result) {
  if (result.ok) {
    return res.json({
      ok: true,
      message: 'Hesabın ve sana ait tüm veriler kalıcı olarak silindi.',
      steps: result.steps,
    });
  }
  return res.status(500).json({
    ok: false,
    error:
      'Silme tamamlanamadı; bu yüzden hesabın SİLİNMEDİ ve verilerin yarım bırakılmadı. ' +
      'Lütfen tekrar dene. Sorun sürerse destek ile iletişime geç.',
    failed: result.failed,
    steps: result.steps,
  });
}

// 1) Uygulama içinden silme — giriş yapmış kullanıcı, MEVCUT ŞİFRESİYLE yeniden
//    doğrulanarak kendi hesabını siler (geri alınamaz).
router.delete('/me', guard, requireAuth, rl(sensitiveLimiter), async (req, res) => {
  if (normalizeConfirm(req.body?.confirm) !== normalizeConfirm(DELETE_CONFIRM_PHRASE)) {
    return res.status(400).json({
      error: `Onay gerekli. Silmek için onay alanına "${DELETE_CONFIRM_PHRASE}" yaz.`,
    });
  }
  if (!(await reauth(req, res))) return;
  logSecurityEvent(sbAdmin, { userId: req.user.id, event: 'account_delete_started', req });
  const result = await deleteUserAccount({ sbAdmin, userId: req.user.id, purgeCoupons });
  clearAuthCookies(req, res);
  return respondWithResult(res, result);
});

// 2) Uygulamayı kurmadan silme — e-posta + şifre ile kimlik doğrulanır.
//    Google Play, uygulamayı indirmeden erişilebilen bir silme yolu ister.
router.post('/delete-account', guard, rl(sensitiveLimiter), async (req, res) => {
  const { email, password, confirm } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  if (normalizeConfirm(confirm) !== normalizeConfirm(DELETE_CONFIRM_PHRASE)) {
    return res.status(400).json({
      error: `Onay gerekli. Silmek için onay alanına "${DELETE_CONFIRM_PHRASE}" yaz.`,
    });
  }

  const { data, error } = await sbAuth.auth.signInWithPassword({ email, password });
  if (error || !data?.user?.id) return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });

  logSecurityEvent(sbAdmin, { userId: data.user.id, event: 'account_delete_started', req, meta: { route: 'web' } });
  const result = await deleteUserAccount({ sbAdmin, userId: data.user.id, purgeCoupons });
  return respondWithResult(res, result);
});

export default router;
