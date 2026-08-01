// MAÇ ZENGİNLEŞTİRME
// Eşleşen her maça puan durumu, önemli oyuncular, H2H ve potansiyel ekler.
// FootyStats çağrılarını sezon bazında önbelleğe alır (aynı sezon tekrar çekilmez).
import { fetchLeagueTable, fetchLeaguePlayers, fetchMatchDetails } from './sources/footystats.js';

// Bir takımın öne çıkan oyuncularını seçer: golcü, asistçi, defans, kaleci.
function pickKeyPlayers(players) {
  if (!players || !players.length) return [];
  const byPos = (pos) => players.filter((p) => p.position === pos);
  const top = (arr, key) => arr.slice().sort((a, b) => b[key] - a[key])[0];

  const fwd = top(byPos('Forward'), 'goals') || top(players, 'goals');
  const ast = top(players, 'assists');
  const def = top(byPos('Defender'), 'apps');
  const gk = top(byPos('Goalkeeper'), 'cleanSheets') || top(byPos('Goalkeeper'), 'apps');

  const out = [];
  if (fwd && fwd.goals > 0) {
    out.push({ role: 'Golcü', icon: '⚡', name: fwd.name, line: `${fwd.goals} gol · ${fwd.assists} asist · ${fwd.apps} maç` });
  }
  if (ast && ast.assists > 0 && (!fwd || ast.name !== fwd.name)) {
    out.push({ role: 'Asist', icon: '🅰️', name: ast.name, line: `${ast.assists} asist · ${ast.goals} gol` });
  }
  if (def && def.apps > 0) {
    out.push({ role: 'Defans', icon: '🛡️', name: def.name, line: `${def.apps} maç${def.cleanSheets ? ` · ${def.cleanSheets} clean sheet` : ''}` });
  }
  if (gk) {
    out.push({ role: 'Kaleci', icon: '🧤', name: gk.name, line: `${gk.cleanSheets} clean sheet · ${gk.apps} maç` });
  }
  return out;
}

// Bir takımın son 5 maçının sonuçlarını (G/B/M) döndürür — eskiden yeniye (soldan sağa).
// venue: 'all' | 'home' (içerde) | 'away' (dışarıda)
const resultLetter = (gf, ga) => (gf > ga ? 'G' : gf < ga ? 'M' : 'B');
function teamLast5(matches, teamId, venue) {
  const rel = matches
    .filter((m) => m.status === 'finished' && m.score &&
      (venue === 'home' ? m.homeId === teamId
        : venue === 'away' ? m.awayId === teamId
          : (m.homeId === teamId || m.awayId === teamId)))
    .sort((a, b) => b.dateUnix - a.dateUnix)
    .slice(0, 5)
    .reverse();
  return rel.map((m) => {
    const home = m.homeId === teamId;
    return resultLetter(home ? m.score.home : m.score.away, home ? m.score.away : m.score.home);
  });
}

// Son 5 maçın detayı (yeniden eskiye): rakip adı + skor + logo + sonuç (G/B/M)
function teamLast5Detail(matches, teamId, teamStats) {
  return matches
    .filter((m) => m.status === 'finished' && m.score && (m.homeId === teamId || m.awayId === teamId))
    .sort((a, b) => b.dateUnix - a.dateUnix)
    .slice(0, 5)
    .map((m) => {
      const home = m.homeId === teamId;
      const gf = home ? m.score.home : m.score.away;
      const ga = home ? m.score.away : m.score.home;
      const oppId = home ? m.awayId : m.homeId;
      const opp = teamStats.get(oppId);
      return { result: resultLetter(gf, ga), score: `${gf}-${ga}`, oppName: opp?.name || '', oppLogo: opp?.image || '', isHome: home };
    });
}

// Bir takımın tam kadrosunu pozisyona göre (Kaleci→Defans→Orta→Forvet) sıralar.
const POS_ORDER = { Goalkeeper: 0, Defender: 1, Midfielder: 2, Forward: 3 };
const POS_SHORT = { Goalkeeper: 'K', Defender: 'D', Midfielder: 'O', Forward: 'F' };
function buildSquad(players) {
  if (!players || !players.length) return [];
  return players
    .slice()
    .sort((a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) || b.minutes - a.minutes)
    .map((p, i) => ({
      name: p.name,
      nat: p.nationality,
      pos: POS_SHORT[p.position] || '?',
      no: i + 1,            // sıralı forma numarası (kaynak gerçek numara vermiyor)
      age: p.age,
      apps: p.apps,
      goals: p.goals,
      assists: p.assists,
      yellow: p.yellow,
      red: p.red,
      minutes: p.minutes,
    }));
}

// İki takımı karşılıklı kıyas satırlarına çevirir:
// önce sezon G/B/M, sonra maç başı ortalamalar (topla oynama, şut, korner...).
function buildCompare(hStand, aStand, h, a) {
  const rows = [];
  if (hStand && aStand) {
    rows.push({ label: 'Galibiyet', home: hStand.wins, away: aStand.wins, suffix: '' });
    rows.push({ label: 'Beraberlik', home: hStand.draws, away: aStand.draws, suffix: '' });
    rows.push({ label: 'Mağlubiyet', home: hStand.losses, away: aStand.losses, suffix: '' });
  }
  if (h?.avg && a?.avg) {
    // Maça etki gücüne göre sıralı: en belirleyici en üstte.
    const avgRows = [
      ['Maç Başı Gol', h.avg.scored, a.avg.scored, ''],
      ['Yediği Gol', h.concededPerGame, a.concededPerGame, ''],
      ['İsabetli Şut', h.avg.shotsOnTarget, a.avg.shotsOnTarget, ''],
      ['Toplam Şut', h.avg.shots, a.avg.shots, ''],
      ['Korner', h.avg.corners, a.avg.corners, ''],
      ['Ofsayt', h.avg.offsides, a.avg.offsides, ''],
      ['Topla Oynama', h.avg.possession, a.avg.possession, '%'],
      ['Faul', h.avg.fouls, a.avg.fouls, ''],
      ['Kart', h.avg.cards, a.avg.cards, ''],
    ];
    for (const [label, home, away, suffix] of avgRows) {
      if (home > 0 || away > 0) rows.push({ label, home, away, suffix });
    }
  }
  return rows;
}

// Sezon bazlı puan durumu + oyuncu + form + takım istatistiği havuzunu hazırlar.
// matchesBySeason / teamsBySeason: refresh'ten gelen Map'ler.
export function createExtrasCache(matchesBySeason, teamsBySeason) {
  const cache = new Map();
  return async function getExtras(seasonId) {
    if (cache.has(seasonId)) return cache.get(seasonId);
    const [table, players] = await Promise.all([
      fetchLeagueTable(seasonId).catch(() => []),
      fetchLeaguePlayers(seasonId).catch(() => []),
    ]);
    const matches = matchesBySeason?.get(seasonId) || [];
    const tableMap = new Map(table.map((r) => [r.teamId, r]));
    const playersMap = new Map();
    for (const p of players) {
      if (!playersMap.has(p.teamId)) playersMap.set(p.teamId, []);
      playersMap.get(p.teamId).push(p);
    }

    // Takım istatistiği + kulüp arması havuzu
    const teams = teamsBySeason?.get(seasonId) || [];
    const teamStats = new Map(teams.map((t) => [t.id, t]));
    const logoOf = (id) => teamStats.get(id)?.image || '';

    // Her takım için son 5 (genel / içerde / dışarıda / detaylı: rakip+skor+logo)
    const formByTeam = new Map();
    for (const r of table) {
      formByTeam.set(r.teamId, {
        all: teamLast5(matches, r.teamId, 'all'),
        home: teamLast5(matches, r.teamId, 'home'),
        away: teamLast5(matches, r.teamId, 'away'),
        detail: teamLast5Detail(matches, r.teamId, teamStats),
      });
    }

    // Tam lig tablosu — üç varyant: genel / iç saha / dış saha (her satırda kulüp arması)
    const overall = table.slice()
      // Kaynakta eksik alan artık 0 değil null gelir (footystats.numN) — null'lu
      // satır sıralamayı NaN ile bozmasın diye sona itilir.
      .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || (b.points ?? -1) - (a.points ?? -1))
      .map((r) => ({
        teamId: r.teamId, name: r.name, position: r.position, played: r.played,
        wins: r.wins, draws: r.draws, losses: r.losses,
        goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, goalDiff: r.goalDiff, points: r.points,
        last5: formByTeam.get(r.teamId)?.all || [], logo: logoOf(r.teamId),
      }));

    // İç/dış saha tablosu: o saha kayıtlarından puan/averaj hesaplanıp yeniden sıralanır
    const venueTable = (venue) => table
      .map((r) => {
        const v = r[venue] || {};
        const wins = v.wins || 0, draws = v.draws || 0, losses = v.losses || 0;
        const gf = v.goalsFor || 0, ga = v.goalsAgainst || 0;
        return {
          teamId: r.teamId, name: r.name, played: wins + draws + losses,
          wins, draws, losses, goalsFor: gf, goalsAgainst: ga, goalDiff: gf - ga,
          points: wins * 3 + draws, last5: formByTeam.get(r.teamId)?.[venue] || [], logo: logoOf(r.teamId),
        };
      })
      .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
      .map((r, i) => ({ ...r, position: i + 1 }));

    const fullTable = { overall, home: venueTable('home'), away: venueTable('away') };

    // matches: "son maçlar"ı maç-öncesi tarihe göre süzebilmek için ham liste.
    const extras = { table: tableMap, players: playersMap, formByTeam, fullTable, teamStats, matches };
    cache.set(seasonId, extras);
    return extras;
  };
}

// Eşleşen bir maç için tüm zengin istatistikleri toplar.
// found = { match, swapped } (matcher.js çıktısı), getExtras = createExtrasCache() sonucu.
export async function buildMatchStats(found, getExtras) {
  const fm = found.match;
  const swapped = found.swapped;

  // Bülten ev/deplasmanına karşılık gelen FootyStats takım id'leri
  const homeTeamId = swapped ? fm.awayId : fm.homeId;
  const awayTeamId = swapped ? fm.homeId : fm.awayId;

  const extras = await getExtras(fm.seasonId);
  const homeStanding = extras.table.get(homeTeamId) || null;
  const awayStanding = extras.table.get(awayTeamId) || null;
  const homePlayers = pickKeyPlayers(extras.players.get(homeTeamId));
  const awayPlayers = pickKeyPlayers(extras.players.get(awayTeamId));
  // "Son maçlar" / form, BU MAÇTAN ÖNCEKİ maçlara göre hesaplanır (bu maç ve
  // sonrası hariç) → maç-öncesi (pre-match). Başlamış maçta bile bu maç dahil edilmez.
  const preMatches = (extras.matches || []).filter((m) => m.dateUnix < fm.dateUnix);
  const homeForm = {
    all: teamLast5(preMatches, homeTeamId, 'all'),
    home: teamLast5(preMatches, homeTeamId, 'home'),
    detail: teamLast5Detail(preMatches, homeTeamId, extras.teamStats),
  };
  const awayForm = {
    all: teamLast5(preMatches, awayTeamId, 'all'),
    away: teamLast5(preMatches, awayTeamId, 'away'),
    detail: teamLast5Detail(preMatches, awayTeamId, extras.teamStats),
  };
  const compare = buildCompare(homeStanding, awayStanding, extras.teamStats.get(homeTeamId), extras.teamStats.get(awayTeamId));

  const det = await fetchMatchDetails(fm.footyMatchId).catch(() => ({ potentials: null, h2h: null }));

  // H2H'yi bülten ev/deplasman yönüne çevir
  let h2h = null;
  if (det.h2h) {
    h2h = swapped
      ? { played: det.h2h.played, homeWins: det.h2h.teamBWins, awayWins: det.h2h.teamAWins, draws: det.h2h.draws }
      : { played: det.h2h.played, homeWins: det.h2h.teamAWins, awayWins: det.h2h.teamBWins, draws: det.h2h.draws };
  }

  // Gerçek kulüp armaları (FootyStats CDN); ters eşleşmede yönü düzelt.
  const CDN = 'https://cdn.footystats.org/img/';
  const homeImg = swapped ? det.awayImage : det.homeImage;
  const awayImg = swapped ? det.homeImage : det.awayImage;
  const homeLogo = homeImg ? CDN + homeImg : '';
  const awayLogo = awayImg ? CDN + awayImg : '';

  // Tek takım istatistik penceresi için sezon özeti (zaten çekilen teamStats'tan).
  const seasonStats = (id) => {
    const t = extras.teamStats.get(id);
    if (!t) return null;
    return {
      goalsPerGame: t.goalsPerGame, concededPerGame: t.concededPerGame,
      cleanSheets: t.cleanSheets, cleanSheetPct: t.cleanSheetPct, failedToScorePct: t.failedToScorePct,
      over25Pct: t.over25Pct, bttsPct: t.bttsPct, xgFor: t.xgFor, xgAgainst: t.xgAgainst,
      // xG ev/deplasman ayrımı (İç/Dış xG kriterleri için)
      xgForHome: t.xgForHome, xgForAway: t.xgForAway,
      xgAgainstHome: t.xgAgainstHome, xgAgainstAway: t.xgAgainstAway,
      recentPpg: t.recentPpg, avg: t.avg || null,
    };
  };

  return {
    potentials: det.potentials,
    h2h,
    home: { standing: homeStanding, season: seasonStats(homeTeamId), players: homePlayers, squad: buildSquad(extras.players.get(homeTeamId)), last5: homeForm.all || [], last5venue: homeForm.home || [], last5detail: homeForm.detail || [], logo: homeLogo },
    away: { standing: awayStanding, season: seasonStats(awayTeamId), players: awayPlayers, squad: buildSquad(extras.players.get(awayTeamId)), last5: awayForm.all || [], last5venue: awayForm.away || [], last5detail: awayForm.detail || [], logo: awayLogo },
    compare,
    leagueTable: extras.fullTable,
  };
}
