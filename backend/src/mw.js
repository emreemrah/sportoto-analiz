// KİMLİK DOĞRULAMA ARA KATMANI
//
// Kimlik üç kaynaktan GELEBİLİR ama tek yerden DOĞRULANIR:
//   1. Authorization: Bearer <access_token>   (mobil + geliştirme)
//   2. sportoto_at çerezi (HttpOnly)          (web üretimi — cookieMode)
// Belirteç her istekte Supabase'e DOĞRULATILIR — kullanıcı kimliği asla
// istemcinin beyanından alınmaz.
//
// OTURUM KONTROLÜ: istemci X-Session-Id gönderirse oturum satırı denetlenir;
// oturum uzaktan kapatıldıysa istek 401 ile REDDEDİLİR (belirteç süresi dolmasa
// bile). Çerezle (cookieMode) gelen ve durum değiştiren isteklerde X-Session-Id
// ZORUNLUDUR — bu, çift-anahtar (double-submit) CSRF korumasıdır: başka site
// çerezi otomatik gönderebilir ama bu başlığı OKUYAMAZ ve YAZAMAZ.
import { getUserFromToken, sbAdmin } from './supabase.js';
import { verifySession } from './security/sessionService.js';

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Çerez başlığını ayrıştırır (yeni paket kurmadan; cookie-parser eşdeğeri). */
export function parseCookies(req) {
  const out = {};
  const raw = req.headers?.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function resolveUser(req) {
  // 1) Bearer başlığı (mobil/geliştirme)
  let token = bearer(req);
  let viaCookie = false;
  // 2) HttpOnly çerez (web üretimi)
  if (!token) {
    const c = parseCookies(req);
    if (c.sportoto_at) { token = c.sportoto_at; viaCookie = true; }
  }
  if (!token) return { user: null };
  const user = await getUserFromToken(token);
  return { user, token, viaCookie };
}

async function checkSession(req, res, { user, viaCookie }) {
  const sessionId = String(req.headers['x-session-id'] || '') || null;
  // ÇEREZ modunda durum değiştiren istekte başlık ZORUNLU (CSRF koruması).
  if (viaCookie && !SAFE_METHODS.has(req.method) && !sessionId) {
    res.status(401).json({ error: 'Oturum doğrulanamadı. Lütfen yeniden giriş yap.' });
    return false;
  }
  if (sessionId) {
    const v = await verifySession(sbAdmin, { userId: user.id, sessionId });
    if (!v.ok) {
      res.status(401).json({ error: 'Bu oturum kapatılmış. Lütfen yeniden giriş yap.' });
      return false;
    }
    req.sessionId = sessionId;
  }
  return true;
}

// Giriş zorunlu
export async function requireAuth(req, res, next) {
  const r = await resolveUser(req);
  if (!r.user) return res.status(401).json({ error: 'Bu işlem için giriş yapmalısın.' });
  if (!(await checkSession(req, res, r))) return;
  req.user = r.user;
  req.token = r.token;
  next();
}

// Giriş varsa kullanıcıyı ekler, yoksa devam (yorumları herkes görebilir)
export async function optionalAuth(req, res, next) {
  const r = await resolveUser(req);
  if (r.user) {
    req.user = r.user;
    req.token = r.token;
    const sessionId = String(req.headers['x-session-id'] || '') || null;
    if (sessionId) {
      const v = await verifySession(sbAdmin, { userId: r.user.id, sessionId });
      if (!v.ok) { req.user = null; req.token = null; }
      else req.sessionId = sessionId;
    }
  }
  next();
}
