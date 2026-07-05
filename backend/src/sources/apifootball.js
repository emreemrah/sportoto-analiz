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
      fixtureId: f.fixture?.id ?? null,
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

// Belirli bir GÜNÜN tüm fikstürlerini getirir (canlı + bitmiş). Resmi Spor Toto
// sonucu gelmeden önce GEÇİCİ (resmi değil) skor göstermek için — asla kesin sayılmaz.
export async function fetchFixturesByDate(date) {
  const key = config.apiFootballKey;
  if (!key || !date) return [];
  const res = await fetch(`${config.apiFootballApi}/fixtures?date=${date}`, {
    headers: { 'x-apisports-key': key },
  });
  if (!res.ok) throw new Error(`API-Football date HTTP ${res.status}`);
  const json = await res.json();
  return (json.response || []).map((f) => {
    const short = f.fixture?.status?.short || '';
    return {
      fixtureId: f.fixture?.id ?? null,
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

// Bir fikstürün GERÇEK canlı istatistiklerini getirir (şut, korner, topla oynama…).
// API ne veriyorsa o döner; veri yoksa boş dizi (uydurma YOK). swapped=true ise
// ev/deplasman yer değiştirir (bülten maçıyla hizalamak için).
export async function fetchFixtureStatistics(fixtureId, swapped = false) {
  const key = config.apiFootballKey;
  if (!key || !fixtureId) return [];
  const res = await fetch(`${config.apiFootballApi}/fixtures/statistics?fixture=${fixtureId}`, {
    headers: { 'x-apisports-key': key },
  });
  if (!res.ok) throw new Error(`API-Football stats HTTP ${res.status}`);
  const json = await res.json();
  const teams = json.response || [];
  if (teams.length < 2) return [];
  let [tA, tB] = teams;                       // API sırası: ev, deplasman
  if (swapped) [tA, tB] = [tB, tA];
  const mapOf = (t) => new Map((t.statistics || []).map((s) => [s.type, s.value]));
  const mA = mapOf(tA), mB = mapOf(tB);
  const types = [...new Set([...mA.keys(), ...mB.keys()])];
  return types.map((type) => ({ type, home: mA.get(type) ?? null, away: mB.get(type) ?? null }));
}

// Bir fikstürün GERÇEK canlı olaylarını getirir (gol, kart, VAR, değişiklik…).
// Oyuncu adı yoksa null döner (sahte ad üretilmez). swapped ev/deplasman'ı hizalar.
export async function fetchFixtureEvents(fixtureId, homeName, awayName) {
  const key = config.apiFootballKey;
  if (!key || !fixtureId) return [];
  const res = await fetch(`${config.apiFootballApi}/fixtures/events?fixture=${fixtureId}`, {
    headers: { 'x-apisports-key': key },
  });
  if (!res.ok) throw new Error(`API-Football events HTTP ${res.status}`);
  const json = await res.json();
  return (json.response || []).map((e) => {
    const teamName = e.team?.name || '';
    // Bülten adına göre ev/deplasman tarafını belirle (bulunamazsa ham ad).
    const side = sameTeam(teamName, homeName) ? 'home' : (sameTeam(teamName, awayName) ? 'away' : null);
    return {
      minute: e.time?.elapsed ?? null,
      extra: e.time?.extra ?? null,
      type: e.type || '',          // Goal, Card, subst, Var
      detail: e.detail || '',      // Yellow Card, Red Card, Normal Goal, Penalty…
      side,
      team: teamName,
      player: e.player?.name || null,
      assist: e.assist?.name || null,
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
