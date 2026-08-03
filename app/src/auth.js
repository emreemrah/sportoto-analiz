// OTURUM YÖNETİMİ — kullanıcı bir kez giriş yapar, uygulama her açılışta
// oturumu SESSİZCE geri yükler ("beni hatırla" güvenli biçimde).
//
//   • Belirteçler mobilde Keychain/Keystore'da (tokenStore), webde üretimde
//     HttpOnly çerezde, geliştirmede localStorage'da tutulur.
//   • ŞİFRE CİHAZDA ASLA SAKLANMAZ.
//   • Belirteç süresi dolarsa refreshClient sessizce yeniler; oturum sunucudan
//     kapatıldıysa yenileme reddedilir ve kullanıcı güvenle çıkışa düşer.
import { useEffect, useState } from 'react';
import { api } from './api';
import { syncFromServer, yereliTemizle, sahibiAyarla } from './coupon/store';
import { setSession, clearSession, getSessionId } from './session/tokenState';
import {
  loadPersisted, persistSession, clearPersisted,
  getOrCreateDeviceId, deviceLabel, platformName, cookieModeAvailable,
} from './session/tokenStore';
import { tryRefresh } from './session/refreshClient';
import { cancelAllOurNotifications } from './services/pushService';

let state = { token: null, user: null, ready: false };
const listeners = new Set();
function set(patch) { state = { ...state, ...patch }; listeners.forEach((l) => l(state)); }

export function getToken() { return state.token; }

// Uygulama açılışında: kalıcı oturum yüklenir, profil tazelenir; belirteç
// süresi dolmuşsa SESSİZCE yenilenir — kullanıcıdan tekrar giriş İSTENMEZ.
export async function initAuth() {
  const persisted = await loadPersisted();
  const cookieMode = cookieModeAvailable() && !persisted.token && !!persisted.sessionId;
  setSession({
    token: persisted.token || null,
    refreshToken: persisted.refreshToken || null,
    sessionId: persisted.sessionId || null,
    cookieMode,
  });
  if (!persisted.token && !persisted.refreshToken && !cookieMode) { set({ ready: true }); return; }
  try {
    const me = await api.me(); // 401 olursa api.js sessizce yenileyip tekrar dener
    set({ token: persisted.token || 'cookie', user: me, ready: true });
    syncFromServer();
  } catch {
    clearSession();
    await clearPersisted();
    set({ token: null, user: null, ready: true });
  }
}

// Giriş/kayıt gövdesine cihaz bilgisi ekler (bağlı cihazlar listesi için).
async function deviceInfo() {
  return {
    deviceId: await getOrCreateDeviceId(),
    deviceName: deviceLabel(),
    platform: platformName(),
    cookieMode: cookieModeAvailable() || undefined,
  };
}

async function adoptSession(resp) {
  setSession({
    token: resp.token || null,
    refreshToken: resp.refreshToken || null,
    sessionId: resp.sessionId || null,
    cookieMode: !!resp.cookieMode,
  });
  await persistSession({
    token: resp.token,
    refreshToken: resp.refreshToken,
    sessionId: resp.sessionId,
    cookieMode: !!resp.cookieMode,
  });
  set({ token: resp.token || (resp.cookieMode ? 'cookie' : null), user: resp.user });
  // KULLANICI İZOLASYONU — senkrondan ÖNCE. Cihazda başka bir kullanıcının
  // yerel kuponu kaldıysa (çıkış çalışmamış, uygulama öldürülmüş, eski sürüm)
  // burada silinir. SIRA KRİTİK: syncFromServer yereli sunucuya yazıyor;
  // önce temizlemezsek başkasının kuponu bu hesaba geçerdi.
  try { sahibiAyarla(resp.user?.id ?? resp.user?.userId ?? null); } catch {}
  syncFromServer(); // hesaba bağlı kuponları çek/birleştir
}

/**
 * Kayıt. E-posta doğrulaması AÇIKSA oturum dönmez;
 * { needsVerification:true, message } döner ve ekran bilgi gösterir.
 */
export async function register(email, username, password) {
  const resp = await api.register({ email, username, password, ...(await deviceInfo()) });
  if (resp?.needsVerification) return resp;
  await adoptSession(resp);
  return resp.user;
}

export async function login(email, password) {
  const resp = await api.login({ email, password, ...(await deviceInfo()) });
  await adoptSession(resp);
  return resp.user;
}

export async function logout() {
  // Önce SUNUCUDAKİ oturum kaydı kapatılır (uzaktan geçerliliği biter);
  // sunucuya ulaşılamasa bile yerel oturum mutlaka temizlenir.
  try { if (getSessionId()) await api.serverLogout(); } catch { /* yerel temizlik yeterli */ }
  // Çıkış yapan kullanıcının kuponuna kurulmuş telefon hatırlatmaları kalmamalı;
  // aksi hâlde cihazı devralan kişiye onun maçları hatırlatılırdı.
  try { await cancelAllOurNotifications(); } catch { /* çıkışı engellemesin */ }
  clearSession();
  await clearPersisted();
  // Yerel kuponlar CİHAZDA kalıyordu; sonraki kullanıcı onları görüyordu.
  try { yereliTemizle(); } catch {}
  set({ token: null, user: null });
}

export function forgotPassword(email) { return api.forgotPassword({ email }); }
export function resendVerification(email) { return api.resendVerification({ email }); }

// Profil güncellemelerinden sonra kullanıcıyı tazele
export function setUser(user) { set({ user }); }
export async function refreshUser() {
  try { const me = await api.me(); set({ user: me }); return me; } catch { return null; }
}

// Sunucu "bu oturum kapatılmış" derse (uzaktan çıkış) yereli de temizle.
export async function handleSessionRevoked() {
  try { await cancelAllOurNotifications(); } catch { /* temizliği engellemesin */ }
  clearSession();
  await clearPersisted();
  // Yerel kuponlar CİHAZDA kalıyordu; sonraki kullanıcı onları görüyordu.
  try { yereliTemizle(); } catch {}
  set({ token: null, user: null });
}

export { tryRefresh };

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
