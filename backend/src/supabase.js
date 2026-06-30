// Supabase istemcileri (üyelik + profil + yorum sistemi).
// İki istemci: sbAdmin (secret key, RLS atlar, admin auth + DB) ve sbAuth (publishable, giriş/şifre).
import { createClient } from '@supabase/supabase-js';
import './config.js'; // dotenv yüklenir

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;

export const supabaseEnabled = !!(url && secret && publishable);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const sbAdmin = supabaseEnabled ? createClient(url, secret, opts) : null;
export const sbAuth = supabaseEnabled ? createClient(url, publishable, opts) : null;

// Bearer access_token'dan kullanıcıyı doğrula (Supabase'e sorar)
export async function getUserFromToken(token) {
  if (!token || !sbAdmin) return null;
  const { data, error } = await sbAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Tek profil
export async function getProfile(id) {
  const { data } = await sbAdmin.from('profiles').select('*').eq('id', id).maybeSingle();
  return data;
}

// Birden çok profil → { id: profil }
export async function getProfiles(ids) {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return {};
  const { data } = await sbAdmin.from('profiles')
    .select('id,username,avatar_type,avatar_key,avatar_url').in('id', uniq);
  const map = {};
  (data || []).forEach((p) => { map[p.id] = p; });
  return map;
}
