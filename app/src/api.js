import { API_BASE } from './config';

async function get(path) {
  // ngrok ücretsiz tünelinin tarayıcı uyarı sayfasını atla (yoksa JSON yerine HTML döner).
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
  if (!res.ok) {
    let msg = `Sunucu hatası (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  bulletin: () => get('/api/bulletin'),
  radar: () => get('/api/surprise-radar'),
  match: (no) => get(`/api/match/${no}`),
  health: () => get('/api/health'),
  rounds: () => get('/api/rounds'),
  history: (roundId) => get(`/api/history/${roundId}`),
};
