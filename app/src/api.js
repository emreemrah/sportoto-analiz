import { API_BASE } from './config';

const TOKEN_KEY = 'sportoto.token';
function authHeaders() {
  const h = { 'ngrok-skip-browser-warning': 'true' };
  try {
    const t = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (t) h.Authorization = `Bearer ${t}`;
  } catch {}
  return h;
}

async function req(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: { ...authHeaders() } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    let msg = `Sunucu hatası (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // bülten / analiz
  bulletin: () => req('/api/bulletin'),
  radar: () => req('/api/surprise-radar'),
  match: (no) => req(`/api/match/${no}`),
  health: () => req('/api/health'),
  rounds: () => req('/api/rounds'),
  history: (roundId) => req(`/api/history/${roundId}`),

  // üyelik
  register: (b) => req('/api/auth/register', { method: 'POST', body: b }),
  login: (b) => req('/api/auth/login', { method: 'POST', body: b }),
  forgotPassword: (b) => req('/api/auth/forgot-password', { method: 'POST', body: b }),

  // profil
  me: () => req('/api/users/me'),
  updateProfile: (b) => req('/api/users/me', { method: 'PATCH', body: b }),
  uploadAvatar: (dataUrl) => req('/api/users/me/avatar', { method: 'POST', body: { dataUrl } }),

  // yorumlar
  comments: (matchId) => req(`/api/comments?matchId=${encodeURIComponent(matchId)}`),
  addComment: (b) => req('/api/comments', { method: 'POST', body: b }),
  editComment: (id, text) => req(`/api/comments/${id}`, { method: 'PATCH', body: { text } }),
  deleteComment: (id) => req(`/api/comments/${id}`, { method: 'DELETE' }),
  likeComment: (id) => req(`/api/comments/${id}/like`, { method: 'POST' }),
  unlikeComment: (id) => req(`/api/comments/${id}/like`, { method: 'DELETE' }),
  viewComment: (id) => req(`/api/comments/${id}/view`, { method: 'POST' }),

  // anketler / topluluk tahminleri
  getScore: (matchId) => req(`/api/predictions/score?matchId=${encodeURIComponent(matchId)}`),
  saveScore: (b) => req('/api/predictions/score', { method: 'POST', body: b }),
  getPlayerVote: (matchId) => req(`/api/predictions/player?matchId=${encodeURIComponent(matchId)}`),
  savePlayerVote: (b) => req('/api/predictions/player', { method: 'POST', body: b }),
  getLineup: (matchId) => req(`/api/predictions/lineup?matchId=${encodeURIComponent(matchId)}`),
  saveLineup: (b) => req('/api/predictions/lineup', { method: 'POST', body: b }),
  getPoll: (matchId) => req(`/api/predictions/poll?matchId=${encodeURIComponent(matchId)}`),
  savePoll: (b) => req('/api/predictions/poll', { method: 'POST', body: b }),
  community: (matchId) => req(`/api/predictions/community?matchId=${encodeURIComponent(matchId)}`),
  leaderboard: (roundId) => req(`/api/predictions/leaderboard${roundId ? `?roundId=${roundId}` : ''}`),
};
