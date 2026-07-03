// API-Football (api-sports.io) — GERÇEK canlı skor + dakika.
// Anahtar SADECE burada, .env'den okunan config üzerinden kullanılır.
import { config } from '../config.js';

const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);

// Canlı (in-play) durum kısaltmaları
const LIVE_CODES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const DONE_CODES = new Set(['FT', 'AET', 'PEN']);

// Şu an oynanan TÜM maçları döndürür (tek istek). Canlı maç yoksa boş dizi.
export async function fetchLiveFixtures() {
  const key = config.apiFootballKey;
  if (!key) return [];
  const res = await fetch(`${config.apiFootballApi}/fixtures?live=all`, {
    headers: { 'x-apisports-key': key },
  });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`API-Football: ${JSON.stringify(json.errors)}`);
  }
  return (json.response || []).map((f) => {
    const short = f.fixture?.status?.short || '';
    return {
      homeName: f.teams?.home?.name || '',
      awayName: f.teams?.away?.name || '',
      homeGoals: num(f.goals?.home),
      awayGoals: num(f.goals?.away),
      minute: f.fixture?.status?.elapsed ?? null,
      statusShort: short,
      live: LIVE_CODES.has(short),
      finished: DONE_CODES.has(short),
    };
  });
}

// Takım adını eşleştirme için sadeleştirir (diakritik, sık ekler, noktalama).
export function normTeam(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diakritikleri sil (ö→o, ş→s, ı→i)
    .replace(/\b(fk|sk|fc|if|aif|bk|ff|sc|cf|ac|if|idrottsforening|kulubu|kulubu|spor|kulup)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// İki takım adı aynı kulübü mü gösteriyor? (ilk anlamlı kelime + içerme)
export function sameTeam(a, b) {
  const na = normTeam(a);
  const nb = normTeam(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const fa = na.split(' ')[0];
  const fb = nb.split(' ')[0];
  if (fa && fa === fb) return true;
  return na.includes(nb) || nb.includes(na);
}

// Bülten maçını (home/away adları) canlı fikstür listesinde bulur.
// Döner: { fixture, swapped } | null
export function findLiveFixture(bm, fixtures) {
  const home = bm.home?.name || bm.home?.mediumName || '';
  const away = bm.away?.name || bm.away?.mediumName || '';
  for (const f of fixtures) {
    if (sameTeam(home, f.homeName) && sameTeam(away, f.awayName)) return { fixture: f, swapped: false };
    if (sameTeam(home, f.awayName) && sameTeam(away, f.homeName)) return { fixture: f, swapped: true };
  }
  return null;
}
