// Spor Toto resmi API'sinden haftalık bülteni çeker.
// Test edilmiş açık uçlar (anahtar gerekmez):
//   api/GameRound/GetGameRoundYears
//   api/GameRound/GetGameRoundNamesByYear?year=YYYY/YYYY
//   api/GameMatch/GetGameMatches/?gameRoundId=<id>
import { config } from '../config.js';

const BASE = config.sportotoApi;

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`sportoto ${path}: HTTP ${res.status}`);
  const json = await res.json();
  if (json && json.isSucceed === false) throw new Error(`sportoto ${path}: ${json.message}`);
  return json.object;
}

// Mevcut sezonları döndürür (en yenisi başta)
export async function getYears() {
  const years = await get('api/GameRound/GetGameRoundYears');
  return years.map((y) => y.year);
}

// Bir sezonun haftalarını döndürür: [{ name, id, isPublished }]
export async function getRounds(year) {
  const enc = encodeURIComponent(year);
  return get(`api/GameRound/GetGameRoundNamesByYear?year=${enc}`);
}

// Bir haftanın 15 maçını ham olarak çeker
async function getRoundMatches(roundId) {
  return get(`api/GameMatch/GetGameMatches/?gameRoundId=${roundId}`);
}

// Ham maçı uygulamanın kullandığı temiz yapıya çevirir
function normalizeMatch(row, index) {
  const m = row.match || {};
  const home = m.homeTeam || {};
  const away = m.awayTeam || {};
  const score = m.score || {};
  const finished = score.homeRegular != null && score.awayRegular != null
    && m.fullTimeWin != null;

  return {
    no: index + 1,
    sportotoMatchId: m.id || row.id,
    date: m.date || row.date,
    league: (m.stage && m.stage.name) || '',
    home: {
      name: home.name || '',
      shortName: home.shortName || '',
      mediumName: home.mediumName || home.name || '',
      externalTeamId: home.externalTeamId ?? null,
    },
    away: {
      name: away.name || '',
      shortName: away.shortName || '',
      mediumName: away.mediumName || away.name || '',
      externalTeamId: away.externalTeamId ?? null,
    },
    status: finished ? 'finished' : 'upcoming',
    score: finished
      ? { home: score.homeRegular, away: score.awayRegular }
      : null,
    // 1 / X / 2 sonucu (bilen için): fullTimeWin 1=ev, 0=beraberlik, 2=deplasman
    result: finished ? winToSymbol(m.fullTimeWin) : null,
  };
}

function winToSymbol(fullTimeWin) {
  if (fullTimeWin === 1) return '1';
  if (fullTimeWin === 2) return '2';
  if (fullTimeWin === 0) return 'X';
  return null;
}

// Şu an oynanmakta olan / oynanacak (güncel) haftayı bulur.
// api/GameRound tüm haftaları kapanış tarihiyle verir; kapanışı şu andan
// sonraki en yakın hafta = bu haftanın bülteni.
export async function getCurrentRound() {
  const all = await get('api/GameRound');
  const now = Date.now();
  const withClose = all
    .map((r) => ({ ...r, close: new Date(r.roundCloseDate).getTime() }))
    .filter((r) => !Number.isNaN(r.close))
    .sort((a, b) => a.close - b.close);

  // Kapanışı henüz gelmemiş ilk hafta (bu hafta)
  const future = withClose.filter((r) => r.close >= now);
  return future[0] || withClose[withClose.length - 1];
}

// Navigasyon için haftalar: tüm haftalar (kapanış tarihine göre, eski→yeni) + güncel hafta id'si.
export async function getRoundsForNav() {
  const all = await get('api/GameRound');
  const now = Date.now();
  const rounds = all
    .map((r) => ({ id: r.id, name: r.name, year: r.year, closeDate: r.roundCloseDate, isPublished: r.isPublished, close: new Date(r.roundCloseDate).getTime() }))
    .filter((r) => r.id != null && !Number.isNaN(r.close))
    .sort((a, b) => a.close - b.close);
  const future = rounds.filter((r) => r.close >= now);
  const current = future[0] || rounds[rounds.length - 1];
  return {
    currentRoundId: current ? current.id : null,
    rounds: rounds.map(({ close, ...r }) => r),
  };
}

// Belirli bir haftanın (geçmiş/herhangi) maç listesini skor + resmi 1/X/2 ile getirir.
export async function getBulletinByRoundId(roundId) {
  const rawMatches = await getRoundMatches(roundId);
  const matches = rawMatches.map(normalizeMatch);
  return { roundId, matchCount: matches.length, matches };
}

// Bir haftanın resmi sonuç + ikramiye dağılımını getirir. Açıklanmamışsa null.
export async function getRoundResult(roundId) {
  try {
    const o = await get(`api/GameResult/GetGameResultByGameRoundId?Id=${roundId}`);
    if (!o) return null;
    const tiers = [
      { hit: 15, count: o.fifteenWinCount, prize: o.fifteenWinPrize },
      { hit: 14, count: o.fourteenWinCount, prize: o.fourteenWinPrize },
      { hit: 13, count: o.thirteenWinCount, prize: o.thirteenWinPrize },
      { hit: 12, count: o.twelveWinCount, prize: o.twelveWinPrize },
    ];
    const any = tiers.some((t) => t.count != null || t.prize != null);
    if (!any) return null;
    return { tiers, description: o.resultDescription || null, closeDate: o.gameRoundCloseDate || null };
  } catch {
    return null;
  }
}

// Güncel haftanın bültenini getirir
export async function getLatestBulletin() {
  const round = await getCurrentRound();
  const rawMatches = await getRoundMatches(round.id);
  const matches = rawMatches.map(normalizeMatch);

  return {
    year: round.year,
    round: round.name,
    roundId: round.id,
    closeDate: round.roundCloseDate,
    matchCount: matches.length,
    matches,
  };
}
