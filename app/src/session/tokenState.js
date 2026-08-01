// OTURUM DURUMU (bellek içi) — SAF MODÜL, React Native bağımlılığı YOKTUR.
// api.js her istekte buradan okur; kalıcı depolama tokenStore.js'tedir.
//
// GÜVENLİK: Şifre burada da, başka hiçbir yerde de TUTULMAZ. Yalnız kısa ömürlü
// erişim belirteci + rotasyonlu yenileme anahtarı + oturum kimliği tutulur.

let state = {
  token: null,        // erişim belirteci (kısa ömürlü JWT)
  refreshToken: null, // tek kullanımlık (rotasyonlu) yenileme anahtarı
  sessionId: null,    // sunucudaki oturum kaydının kimliği
  cookieMode: false,  // web üretimi: belirteçler HttpOnly çerezde, bellekte YOK
};

export function getAccessToken() { return state.token; }
export function getRefreshToken() { return state.refreshToken; }
export function getSessionId() { return state.sessionId; }
export function isCookieMode() { return state.cookieMode; }

export function setSession({ token, refreshToken, sessionId, cookieMode } = {}) {
  if (token !== undefined) state.token = token;
  if (refreshToken !== undefined) state.refreshToken = refreshToken;
  if (sessionId !== undefined) state.sessionId = sessionId;
  if (cookieMode !== undefined) state.cookieMode = !!cookieMode;
}

export function clearSession() {
  state = { token: null, refreshToken: null, sessionId: null, cookieMode: state.cookieMode };
}

/** İstek başlıkları: Bearer (çerez modunda değilse) + oturum kimliği. */
export function authHeaders() {
  const h = {};
  if (!state.cookieMode && state.token) h.Authorization = `Bearer ${state.token}`;
  if (state.sessionId) h['X-Session-Id'] = state.sessionId;
  return h;
}
