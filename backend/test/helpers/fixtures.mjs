// TEST FIKSTÜRLERİ — refresh.js'in cache'e yazdığı bülten yapısının sahtesi.
// Gerçekçi ama açıkça test verisi; ağ yok, rastgelelik yok (deterministik).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileArchiveStore } from '../../src/archive/fileStore.js';

export function tmpStore() {
  return new FileArchiveStore(mkdtempSync(join(tmpdir(), 'sportoto-arsiv-')));
}

// Europe/Istanbul (+03:00) saatiyle ilk maç 20:00 → freezeAt 19:55 (UTC 16:55).
export const FIRST_KICKOFF_TRT = '2026-07-25T20:00:00+03:00';
export const FREEZE_AT_UTC = '2026-07-25T16:55:00.000Z';

const TEAMS = [
  ['Galatasaray', 'Fenerbahçe'], ['Beşiktaş', 'Trabzonspor'], ['Başakşehir', 'Sivasspor'],
  ['Konyaspor', 'Alanyaspor'], ['Antalyaspor', 'Kasımpaşa'], ['Malmö FF', 'AIK'],
  ['Djurgården', 'Hammarby'], ['IFK Göteborg', 'Elfsborg'], ['Bodø/Glimt', 'Molde'],
  ['Rosenborg', 'Viking'], ['Arsenal', 'Chelsea'], ['Liverpool', 'Tottenham'],
  ['Real Madrid', 'Sevilla'], ['Inter', 'Napoli'], ['Bayern Münih', 'Leipzig'],
];

function statsFor(i) {
  // Kriter değerlendiricinin okuduğu asgari gerçekçi yapı.
  return {
    home: {
      logo: '', standing: {
        teamId: 100 + i, position: 2, points: 40, wins: 12, draws: 4, losses: 4,
        goalsFor: 30, goalsAgainst: 15, goalDiff: 15, ppg: 2.0,
        home: { wins: 8, draws: 1, losses: 1, goalsFor: 18, goalsAgainst: 6 },
        away: { wins: 4, draws: 3, losses: 3, goalsFor: 12, goalsAgainst: 9 },
      },
      last5: ['G', 'G', 'B', 'G', 'M'],
      season: { xgFor: 1.8, xgAgainst: 1.0, goalsPerGame: 1.9, concededPerGame: 0.9, bttsPct: 50, cleanSheetPct: 40, failedToScorePct: 10 },
    },
    away: {
      logo: '', standing: {
        teamId: 200 + i, position: 9, points: 25, wins: 7, draws: 4, losses: 9,
        goalsFor: 20, goalsAgainst: 25, goalDiff: -5, ppg: 1.25,
        home: { wins: 5, draws: 2, losses: 3, goalsFor: 12, goalsAgainst: 9 },
        away: { wins: 2, draws: 2, losses: 6, goalsFor: 8, goalsAgainst: 16 },
      },
      last5: ['M', 'B', 'M', 'G', 'M'],
      season: { xgFor: 1.1, xgAgainst: 1.6, goalsPerGame: 1.0, concededPerGame: 1.7, bttsPct: 45, cleanSheetPct: 20, failedToScorePct: 30 },
    },
  };
}

// options.noDataAt: bu sıradaki maçta analiz/stats/oran YOK (veri eksikliği testi)
export function makeBulletinData({
  roundId = 4200, round = '49. Hafta', year = '2026/2027',
  firstKickoff = FIRST_KICKOFF_TRT, noDataAt = 7, predictions = null,
} = {}) {
  const firstMs = new Date(firstKickoff).getTime();
  const matches = TEAMS.map(([home, away], idx) => {
    const no = idx + 1;
    const noData = no === noDataAt;
    const date = new Date(firstMs + idx * 60 * 60 * 1000).toISOString();
    const symbol = predictions ? predictions[idx] : (no % 5 === 0 ? '10' : no % 3 === 0 ? '2' : '1');
    return {
      no,
      sportotoMatchId: 91000 + no,
      date,
      league: 'Test Ligi',
      home: { name: home, shortName: home.slice(0, 3).toUpperCase(), mediumName: home, externalTeamId: 5000 + no },
      away: { name: away, shortName: away.slice(0, 3).toUpperCase(), mediumName: away, externalTeamId: 6000 + no },
      status: 'upcoming',
      score: null,
      result: null,
      started: false,
      live: false,
      analysis: noData
        ? { hasOdds: false, estimated: false, probabilities: null, surpriseScore: null, label: 'VERİ YOK', labelColor: 'gray', favorite: null, comment: 'Bu maç için yeterli veri yok (oran da, form da yok).', factors: [] }
        : {
          hasOdds: true, estimated: false,
          probabilities: { '1': 52, X: 26, '2': 22 },
          surpriseScore: no === 1 ? 22 : 48,
          label: no === 1 ? 'BANKO' : (no === 2 ? 'SÜRPRİZE AÇIK' : 'DİKKAT'),
          labelColor: 'green',
          favorite: { symbol: '1', percent: 52 },
          comment: 'Test analizi.',
          factors: [{ label: 'İç saha formu güçlü', points: 6 }],
        },
      stats: noData ? null : statsFor(no),
      prediction: noData
        ? { symbol: '-', meaning: 'Veri yok', label: 'VERİ YOK', estimated: false, reason: 'Yeterli veri yok' }
        : { symbol, meaning: 'test', label: 'NET', estimated: false, reason: 'test gerekçe' },
      preOdds: noData ? null : { home: 1.85, draw: 3.4, away: 4.1 },
      footyMatchId: noData ? null : 700000 + no,
      footySwapped: false,
      footySeasonId: noData ? null : 14972,
      footyGameWeek: 10,
      coverage: noData ? { ok: false, reason: 'Bu lig şu an analiz kapsamı dışında' } : { ok: true, reason: null },
      tags: null,
      info: { leagueWeek: 10 },
    };
  });

  return {
    updatedAt: new Date(firstMs - 6 * 3600 * 1000).toISOString(),
    usingExampleKey: false,
    verification: { confirmed: true, status: 'confirmed', signature: `sig-${roundId}`, checks: {} },
    year, round, roundId,
    closeDate: new Date(firstMs - 5 * 60 * 1000).toISOString(),
    analysisLockedAt: null,
    matchCount: matches.length,
    matchedCount: matches.filter((m) => m.coverage.ok).length,
    upcomingCount: matches.length,
    noUpcoming: false,
    coverage: { total: matches.length, matched: matches.filter((m) => m.coverage.ok).length, uncoveredCount: 1, uncovered: [] },
    matches,
    radar: matches.filter((m) => m.analysis.surpriseScore != null).map((m) => ({
      no: m.no, home: m.home.mediumName, away: m.away.mediumName,
      surpriseScore: m.analysis.surpriseScore, label: m.analysis.label, labelColor: m.analysis.labelColor,
      estimated: false, prediction: m.prediction.symbol, predictionLabel: m.prediction.label,
      predictionReason: m.prediction.reason, favorite: m.analysis.favorite,
      probabilities: m.analysis.probabilities, comment: m.analysis.comment, factors: m.analysis.factors, signals: null,
    })),
    radarFrozenAt: null,
    difficulty: { level: 'Orta', score: 44, denk: 3, drawRisk: 4, surpriseOpen: 2, noData: 1, text: 'test' },
  };
}

// Resmî sonuç listesi (sources/sportoto.js getBulletinByRoundId biçimi).
// results: no → '1'|'X'|'2' (verilmeyenler sonuçsuz kalır)
export function makeOfficialMatches(data, results) {
  return data.matches.map((m) => {
    const r = results[m.no];
    if (!r) return { no: m.no, sportotoMatchId: m.sportotoMatchId, result: null, score: null };
    const score = r === '1' ? { home: 2, away: 0 } : r === 'X' ? { home: 1, away: 1 } : { home: 0, away: 1 };
    return { no: m.no, sportotoMatchId: m.sportotoMatchId, result: r, score };
  });
}

export const deep = (x) => JSON.parse(JSON.stringify(x));
