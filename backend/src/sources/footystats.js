// FootyStats API'sinden lig maçlarını (oran, xG, form) ve takım istatistiklerini çeker.
// API anahtarı SADECE burada, .env'den okunan config üzerinden kullanılır.
import { config } from '../config.js';
import { kotayiIsle, kotaDurumu, istegeBagliYapilabilir } from './kotaBekcisi.js';

const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);
// EKSİK VERİYİ KORUYAN sürüm: kaynakta olmayan alan 0 DEĞİL null olur.
// num() eksik alanı 0'a çevirdiğinde, kriter katmanındaki "iki taraf da 0"
// koruması atlatılıyordu: ev sahibinin 25 puanı varken deplasman verisi eksikse
// motor "0 puanlı takım" görüp YANLIŞ tarafa güçlü sinyal üretiyordu
// (prediction.js'in belgelediği "uydurulmuş gerekçe" hatasının kök nedeni).
// Takım istatistikleri ve puan tablosu alanları bu yüzden numN ile eşlenir;
// kriter katmanı null'u zaten "veri yok → analiz dışı" olarak ele alıyor.
export const numN = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? null : n;
};

// Ham JSON'u (data + pager) döndürür — sayfalama için pager lazım.
//
// `istegeBagli: true` → kota azaldığında bu çağrı YAPILMAZ. Kullanıcı
// isteğiyle tetiklenen, olmasa da sistemin ayakta kaldığı çağrılar için
// (canlı skor tazeleme, takım fikstürü yedeği). Zamanlanmış yenileme
// ZORUNLUDUR ve bu bayrağı kullanmaz. Gerekçe: kotaBekcisi.js
async function apiGetRaw(path, params, { istegeBagli = false } = {}) {
  if (istegeBagli && !istegeBagliYapilabilir()) {
    const { kalan } = kotaDurumu();
    throw new Error(`FootyStats ${path}: kota korumasi (kalan ${kalan}) — isteğe bağlı çağrı atlandı`);
  }
  const qs = new URLSearchParams({ key: config.footyStatsKey, ...params }).toString();
  const res = await fetch(`${config.footyStatsApi}/${path}?${qs}`);
  if (!res.ok) throw new Error(`FootyStats ${path}: HTTP ${res.status}`);
  const json = await res.json();
  // Kalan hakkı API'nin kendi bildirdiği değerden öğren (tahmin değil).
  kotayiIsle(json);
  if (!json.success) throw new Error(`FootyStats ${path}: ${json.message || 'başarısız'}`);
  return json;
}

async function apiGet(path, params, secenek) {
  return (await apiGetRaw(path, params, secenek)).data;
}

// seasonId → { name, image } — gerçek lig adı ve lig logosu.
// name : "Sweden Allsvenskan", "China Chinese Super League"… Bülten maçının
//        jenerik resmi etiketini ("2026 Sezonu") gerçek lig adıyla değiştirir.
// image: ligin kaynaktaki logo URL'si (ana sayfadaki kayan lig şeridi için).
//        Kaynak logo vermiyorsa null — UYDURMA URL kurulmaz; istemci nötr
//        simge çizer. Elde olmayan bir görseli varmış gibi göstermek, kırık
//        resim kutusu olarak kullanıcıya döner.
export async function fetchLeagueInfo() {
  const data = await apiGet('league-list', { chosen_leagues_only: 'true' });
  const map = new Map();
  for (const lg of data || []) {
    const bilgi = { name: lg.name, image: lg.image || null };
    for (const s of lg.season || []) {
      if (s?.id != null) map.set(String(s.id), bilgi);
    }
  }
  return map;
}

// SEÇİLİ liglerin GÜNCEL sezon id'leri (saf yardımcı — test edilebilir).
// Her lig için en büyük 'year' değerli sezon seçilir (kaynak, güncel sezonu
// en yüksek yıl koduyla listeler). Id'si olmayan kayıtlar atlanır; uydurma yok.
export function pickCurrentSeasonIds(leagues) {
  const ids = new Set();
  for (const lg of leagues || []) {
    let best = null;
    for (const s of lg.season || []) {
      if (s?.id == null) continue;
      if (!best || Number(s.year || 0) > Number(best.year || 0)) best = s;
    }
    if (best) ids.add(Number(best.id));
  }
  return [...ids];
}

// SEZON KEŞFİ: kullanıcının kaynak panelinde SEÇTİĞİ liglerin güncel sezon
// id'lerini döndürür. Böylece panelde eklenen yeni lig (ör. Polonya), .env'e
// elle id yazılmadan bir sonraki refresh'te otomatik kapsanır.
export async function fetchChosenSeasonIds() {
  const data = await apiGet('league-list', { chosen_leagues_only: 'true' });
  return pickCurrentSeasonIds(data);
}

// LİG KATALOĞU (yalnız METADATA) — sezon keşfi bu listeden seçim yapar.
// chosenOnly=true: kullanıcının panelde seçtiği ligler (varsayılan; dar kapsam).
// Katalogdaki sezonların maç verisi BURADAN ÇEKİLMEZ; onu yalnız refresh,
// seçilmiş az sayıda sezon için fetchSeason ile ister.
export async function fetchLeagueCatalog(chosenOnly = true) {
  return apiGet('league-list', chosenOnly ? { chosen_leagues_only: 'true' } : {});
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
  const LIVE_WINDOW_MS = 3.5 * 3600 * 1000; // maç ~3.5 saat canlı sayılır
  return raw.map((m) => {
    const complete = m.status === 'complete';
    const dateUnix = num(m.date_unix);
    const started = dateUnix > 0 && dateUnix * 1000 <= Date.now();
    // FootyStats 'incomplete'/'suspended' + saati geçmiş + pencere içinde = CANLI
    const live = !complete
      && started
      && (m.status === 'incomplete' || m.status === 'suspended')
      && (Date.now() - dateUnix * 1000 <= LIVE_WINDOW_MS);
    return {
      seasonId,
      footyMatchId: m.id,
      homeId: m.homeID,
      awayId: m.awayID,
      homeName: m.home_name || '',
      awayName: m.away_name || '',
      // Takım logoları (varsa) — eşleştirici v3 logo-kimliği katmanı için.
      // Kaynak bu alanı vermezse null kalır; eşleşme ada düşer (zararsız).
      homeImage: m.home_image || null,
      awayImage: m.away_image || null,
      status: complete ? 'finished' : (live ? 'live' : 'upcoming'),
      live,
      dateUnix,
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
      // Canlı veya bitmiş maçta anlık/final skor
      score: (complete || live)
        ? { home: num(m.homeGoalCount), away: num(m.awayGoalCount) }
        : null,
    };
  });
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
      position: numN(t.table_position),
      played: numN(s.seasonMatchesPlayed_overall),
      wins: numN(s.seasonWinsNum_overall),
      draws: numN(s.seasonDrawsNum_overall),
      losses: numN(s.seasonLossesNum_overall),
      ppgHome: numN(s.seasonPPG_home),
      ppgAway: numN(s.seasonPPG_away),
      recentPpg: numN(s.seasonRecentPPG),
      winsHome: numN(s.seasonWinsNum_home),
      winsAway: numN(s.seasonWinsNum_away),
      goalsPerGame: numN(s.seasonScoredAVG_overall),
      concededPerGame: numN(s.seasonConcededAVG_overall),
      cleanSheets: numN(s.seasonCSTotal_overall),
      // yüzde eğilimler + beklenen gol (xG) — takım istatistik penceresi için
      over25Pct: numN(s.seasonOver25Percentage_overall),
      bttsPct: numN(s.seasonBTTSPercentage_overall),
      cleanSheetPct: numN(s.seasonCSPercentage_overall),
      failedToScorePct: numN(s.seasonFTSPercentage_overall),
      xgFor: numN(s.xg_for_avg_overall),
      xgAgainst: numN(s.xg_against_avg_overall),
      // xG ev/deplasman ayrımı (maç başı ortalama) — venue kriterleri için
      xgForHome: numN(s.xg_for_avg_home),
      xgForAway: numN(s.xg_for_avg_away),
      xgAgainstHome: numN(s.xg_against_avg_home),
      xgAgainstAway: numN(s.xg_against_avg_away),
      // maç başı sezon ortalamaları (kıyas çubukları için)
      avg: {
        possession: numN(s.possessionAVG_overall),
        scored: numN(s.seasonScoredAVG_overall),
        shots: numN(s.shotsAVG_overall),
        shotsOnTarget: numN(s.shotsOnTargetAVG_overall),
        corners: numN(s.cornersTotalAVG_overall),
        fouls: numN(s.foulsAVG_overall),
        offsides: numN(s.offsidesAVG_overall),
        cards: numN(s.cardsAVG_overall),
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
    position: numN(r.position),
    played: numN(r.matchesPlayed),
    wins: numN(r.seasonWins_overall),
    draws: numN(r.seasonDraws_overall),
    losses: numN(r.seasonLosses_overall),
    points: numN(r.points),
    goalsFor: numN(r.seasonGoals),
    goalsAgainst: numN(r.seasonConceded),
    goalDiff: numN(r.seasonGoalDifference),
    ppg: numN(r.ppg_overall),
    home: { wins: numN(r.seasonWins_home), draws: numN(r.seasonDraws_home), losses: numN(r.seasonLosses_home), goalsFor: numN(r.seasonGoals_home), goalsAgainst: numN(r.seasonConceded_home) },
    away: { wins: numN(r.seasonWins_away), draws: numN(r.seasonDraws_away), losses: numN(r.seasonLosses_away), goalsFor: numN(r.seasonGoals_away), goalsAgainst: numN(r.seasonConceded_away) },
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

// Tek maçın ANLIK skoru + durumu (canlı/bitmiş) — geçmiş bültendeki başlamış
// maçların geçici skorunu hedefli tazelemek için (tüm sezonu çekmeden).
export async function fetchMatchScore(matchId) {
  // KULLANICI TETİKLİ: /api/history isteğiyle çağrılır. Kota azalınca atlanır —
  // canlı skor tazelemesi durur ama bülten ayakta kalır (kotaBekcisi.js).
  const m = await apiGet('match', { match_id: matchId }, { istegeBagli: true });
  const complete = m?.status === 'complete';
  const dateUnix = num(m?.date_unix);
  const started = dateUnix > 0 && dateUnix * 1000 <= Date.now();
  const LIVE_WINDOW_MS = 3.5 * 3600 * 1000;
  const live = !complete && started && (m?.status === 'incomplete' || m?.status === 'suspended') && (Date.now() - dateUnix * 1000 <= LIVE_WINDOW_MS);
  const status = complete ? 'finished' : (live ? 'live' : 'upcoming');
  const score = (complete || live) ? { home: num(m?.homeGoalCount), away: num(m?.awayGoalCount) } : null;
  return { footyMatchId: matchId, status, score };
}

// --- TEK MAÇ DETAYI (h2h + potansiyeller) ---
// Takımın stadyumu + adresi (şehir) — ev sahibi maç bilgisi kartı + hava için.
export async function fetchTeamVenue(teamId) {
  if (teamId == null) return null;
  try {
    const t0 = await apiGet('team', { team_id: teamId });
    const t = Array.isArray(t0) ? t0[0] : t0;
    if (!t) return null;
    const address = t.stadium_address || '';
    // Adresin son parçası genelde şehir ("Rowsley Street, Manchester" → "Manchester")
    const city = address.includes(',') ? address.split(',').pop().trim() : address.trim();
    return { stadium: t.stadium_name || '', address, city: city || '', country: t.country || '' };
  } catch { return null; }
}

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
