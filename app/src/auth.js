// Oturum deposu: token + kullanıcı profili (sunucudan). Token web'de localStorage'da kalıcı.
import { useEffect, useState } from 'react';
import { api } from './api';

const TOKEN_KEY = 'sportoto.token';

function readToken() {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null; } catch { return null; }
}
function writeToken(t) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

let state = { token: readToken(), user: null, ready: false };
const listeners = new Set();
function set(patch) { state = { ...state, ...patch }; listeners.forEach((l) => l(state)); }

export function getToken() { return state.token; }

// Uygulama açılışında: token varsa profili tazele
export async function initAuth() {
  if (!state.token) { set({ ready: true }); return; }
  try { const me = await api.me(); set({ user: me, ready: true }); }
  catch { writeToken(null); set({ token: null, user: null, ready: true }); }
}

export async function register(email, username, password) {
  const { token, user } = await api.register({ email, username, password });
  writeToken(token); set({ token, user });
  return user;
}
export async function login(email, password) {
  const { token, user } = await api.login({ email, password });
  writeToken(token); set({ token, user });
  return user;
}
export function logout() { writeToken(null); set({ token: null, user: null }); }
export function forgotPassword(email) { return api.forgotPassword({ email }); }

// Profil güncellemelerinden sonra kullanıcıyı tazele
export function setUser(user) { set({ user }); }
export async function refreshUser() {
  try { const me = await api.me(); set({ user: me }); return me; } catch { return null; }
}

export function useAuth() {
  const [s, setS] = useState(state);
  useEffect(() => {
    const l = (x) => setS(x);
    listeners.add(l);
    setS(state);
    return () => listeners.delete(l);
  }, []);
  return s; // { token, user, ready }
}
