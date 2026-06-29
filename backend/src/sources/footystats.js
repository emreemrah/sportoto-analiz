// FootyStats API'sinden lig maçlarını (oran, xG, form) ve takım istatistiklerini çeker.
// API anahtarı SADECE burada, .env'den okunan config üzerinden kullanılır.
import { config } from '../config.js';

const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);

// Ham JSON'u (data + pager) döndürür — sayfalama için pager lazım.
async function apiGetRaw(path, params) {
  const qs = new URLSearchParams({ key: config.footyStatsKey, ...params }).toString();
  const res = await fetch(`${config.footyStatsApi}/${path}?${qs}`);
  if (!res.ok) throw new Error(`FootyStats ${path}: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`FootyStats ${path}: ${json.message || 'başarısız'}`);
  return json;
}

async function apiGet(path, params) {
  return (await apiGetRaw(path, params)).data;
}

// Bir sezonun maçlarını çeker (oran + xG + ppg dahil), temiz yapıya çevirir.
// "example" anahtarı league_id ile, gerçek anahtarlar season_id ile çalışır.
export async function fetchMatches(seasonId) {
  let raw;
  try {
    raw = await apiGet('league-matches', { season_id: seasonId });
  } catch {
    raw = await apiGet('league-matches', { league_id: seasonId });
  }
  return raw.map((m) => ({
    seasonId,
    footyMatchId: m.id,
    homeId: m.homeID,
    awayId: m.awayID,
    homeName: m.home_name || '',
    awayName: m.away_name || '',
    status: m.status === 'complete' ? 'finished' : 'upcoming',
    dateUnix: num(m.date_unix),
    gameWeek: num(m.game_week),
    // 1 / X / 2 bahis oranları (0 ise oran henüz yok)
    odds: {
      home: num(m.odds_ft_1),
      draw: num(m.odds_ft_x),
      away: num(m.odds_ft_2),
    },
    // Maç öncesi beklenen gol (xG) ve puan ortalaması (form)
    preXg: { home: num(m.team_a_xg_prematch), away: num(m.team_b_xg_prematch) },
    prePpg: { home: num(m.pre_match_home_ppg), away: num(m.pre_match_away_ppg) },
    score: m.status === 'complete'
      ? { home: num(m.homeGoalCount), away: num(m.awayGoalCount) }
      : null,
  }));
}

// Bir sezonun takımlarını istatistikleriyle çeker (form, iç/dış saha, gol vb.)
export async function fetchTeams(seasonId) {
  const raw = await apiGet('league-teams', { season_id: seasonId, include: 'stats' });
  return raw.map((t) => {
    const s = t.stats || {};
    return {
      seasonId,
      id: t.id,
      name: t.name,
      cleanName: t.cleanName || t.name,
      shortHand: t.shortHand || '',
      image: t.image || '', // kulüp arması (mutlak URL)
      position: num(t.table_position),
      played: num(s.seasonMatchesPlayed_overall),
      ppgHome: num(s.seasonPPG_home),
      ppgAway: num(s.seasonPPG_away),
      recentPpg: num(s.seasonRecentPPG),
      winsHome: num(s.seasonWinsNum_home),
      winsAway: num(s.seasonWinsNum_away),
      goalsPerGame: num(s.seasonScoredAVG_overall),
      concededPerGame: num(s.seasonConcededAVG_overall),
      cleanSheets: num(s.seasonCSTotal_overall),
      // maç başı sezon ortalamaları (kıyas çubukları için)
      avg: {
        possession: num(s.possessionAVG_overall),
        scored: num(s.seasonScoredAVG_overall),
        shots: num(s.shotsAVG_overall),
        shotsOnTarget: num(s.shotsOnTargetAVG_overall),
        corners: num(s.cornersTotalAVG_overall),
        fouls: num(s.foulsAVG_overall),
        offsides: num(s.offsidesAVG_overall),
        cards: num(s.cardsAVG_overall),
      },
    };
  });
}

// Bir sezonun tüm verisini (maçlar + takımlar) tek seferde getirir
export async function fetchSeason(seasonId) {
  const [matches, teams] = await Promise.all([
    fetchMatches(seasonId),
    fetchTeams(seasonId).catch(() => []), // takım stats başarısız olsa da maçlar yeter
  ]);
  return { seasonId, matches, teams };
}

// --- PUAN DURUMU (iç/dış ayrı) ---
// Bir sezonun lig tablosunu çeker; her takım için sıralama + form satırı.
export async function fetchLeagueTable(seasonId) {
  const d = await apiGet('league-tables', { season_id: seasonId });
  const rows = d?.league_table || (Array.isArray(d) ? d : []);
  return rows.map((r) => ({
    teamId: r.id,
    name: r.cleanName || r.name,
    position: num(r.position),
    played: num(r.matchesPlayed),
    wins: num(r.seasonWins_overall),
    draws: num(r.seasonDraws_overall),
    losses: num(r.seasonLosses_overall),
    points: num(r.points),
    goalsFor: num(r.seasonGoals),
    goalsAgainst: num(r.seasonConceded),
    goalDiff: num(r.seasonGoalDifference),
    ppg: num(r.ppg_overall),
    home: { wins: num(r.seasonWins_home), draws: num(r.seasonDraws_home), losses: num(r.seasonLosses_home), goalsFor: num(r.seasonGoals_home), goalsAgainst: num(r.seasonConceded_home) },
    away: { wins: num(r.seasonWins_away), draws: num(r.seasonDraws_away), losses: num(r.seasonLosses_away), goalsFor: num(r.seasonGoals_away), goalsAgainst: num(r.seasonConceded_away) },
  }));
}

// --- OYUNCULAR ---
// Bir sezonun TÜM oyuncularını çeker (sayfalı). İstatistikleriyle döner.
export async function fetchLeaguePlayers(seasonId) {
  const out = [];
  let page = 1, maxPage = 1;
  do {
    const json = await apiGetRaw('league-players', { season_id: seasonId, include: 'stats', page: String(page) });
    out.push(...(json.data || []));
    maxPage = json.pager?.max_page || 1;
    page++;
  } while (page <= maxPage && page <= 6); // güvenlik tavanı
  return out.map((p) => ({
    teamId: p.club_team_id,
    name: p.known_as || p.full_name,
    position: p.position, // Forward / Midfielder / Defender / Goalkeeper
    age: num(p.age),
    nationality: p.nationality || '',
    goals: num(p.goals_overall),
    assists: num(p.assists_overall),
    apps: num(p.appearances_overall),
    minutes: num(p.minutes_played_overall),
    yellow: num(p.yellow_cards_overall),
    red: num(p.red_cards_overall),
    cleanSheets: num(p.clean_sheets_overall),
    conceded: num(p.conceded_overall),
  }));
}

// --- TEK MAÇ DETAYI (h2h + potansiyeller) ---
export async function fetchMatchDetails(matchId) {
  const m = await apiGet('match', { match_id: matchId });
  const h = m?.h2h?.previous_matches_results;
  return {
    // Gerçek kulüp armaları (göreli yol; CDN tabanı enrich'te eklenir)
    homeImage: m?.home_image || '',
    awayImage: m?.away_image || '',
    potentials: {
      over25: num(m?.o25_potential),
      btts: num(m?.btts_potential),
      corners: num(m?.corners_potential),
    },
    // h2h: team_a = FootyStats ev sahibi, team_b = deplasman
    h2h: h ? {
      played: num(h.totalMatches),
      teamAWins: num(h.team_a_wins),
      teamBWins: num(h.team_b_wins),
      draws: num(h.draw),
    } : null,
  };
}
