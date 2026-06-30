// Auth middleware — Authorization: Bearer <access_token>
import { getUserFromToken } from './supabase.js';

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// Giriş zorunlu
export async function requireAuth(req, res, next) {
  const user = await getUserFromToken(bearer(req));
  if (!user) return res.status(401).json({ error: 'Bu işlem için giriş yapmalısın.' });
  req.user = user;
  next();
}

// Giriş varsa kullanıcıyı ekler, yoksa devam (yorumları herkes görebilir)
export async function optionalAuth(req, res, next) {
  req.user = await getUserFromToken(bearer(req));
  next();
}
