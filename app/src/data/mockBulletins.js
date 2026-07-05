// app/src/data/mockBulletins.js
// Bülten Geçmişi altyapısı için mock veri. Gerçek backend'e bu alan için henüz
// bağlı değiliz (bkz. services/bulletinHistoryService.js) — sahte ama gerçekçi
// 15 maçlık kupon haftaları üretir: tamamlanmış, kilitli (kısmi sonuçlu),
// aktif (yayında, henüz başlamamış) ve iptal edilmiş örnekler.

import { BULLETIN_STATUS, MATCH_STATUS } from '../types/bulletin';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();
const iso = (offsetMs) => new Date(NOW + offsetMs).toISOString();

function buildMatch(bulletinId, orderNo, [home, away, league], offsetMs, status, ftScore, result1x2, htScore) {
  return {
    id: `${bulletinId}-m${orderNo}`,
    bulletinId,
    orderNo,
    code: `${bulletinId.toUpperCase()}-${String(orderNo).padStart(2, '0')}`,
    homeTeam: { name: home },
    awayTeam: { name: away },
    league,
    startTime: iso(offsetMs),
    status,
    halfTimeScore: htScore || null,
    fullTimeScore: ftScore || null,
    result1x2: result1x2 || null,
  };
}

function buildBulletin({ id, bulletinNo, dateOffsetMs, status, createdOffsetMs, firstMatchOffsetMs, lockedOffsetMs, completedOffsetMs, matches, preMatchSnapshotId }) {
  const finished = matches.filter((m) => m.status === MATCH_STATUS.FINISHED);
  const withResult = finished.filter((m) => m.result1x2);
  let resultSummary = null;
  return {
    id,
    bulletinNo,
    date: iso(dateOffsetMs),
    status,
    createdAt: iso(createdOffsetMs),
    firstMatchStartAt: firstMatchOffsetMs != null ? iso(firstMatchOffsetMs) : null,
    lockedAt: lockedOffsetMs != null ? iso(lockedOffsetMs) : null,
    completedAt: completedOffsetMs != null ? iso(completedOffsetMs) : null,
    matches,
    preMatchSnapshotId,
    resultSummary, // bulletinHistoryService.computeResultSummary() ile doldurulur
    _finishedCount: finished.length,
    _resultCount: withResult.length,
  };
}

/* ---------------------------------------------------------------- */
/* B27 — ACTIVE: henüz hiç maç başlamadı, analiz güncellenebilir     */
/* ---------------------------------------------------------------- */
const b27Fixtures = [
  ['Galatasaray', 'Fenerbahçe', 'Süper Lig'],
  ['Beşiktaş', 'Trabzonspor', 'Süper Lig'],
  ['Başakşehir', 'Sivasspor', 'Süper Lig'],
  ['Konyaspor', 'Alanyaspor', 'Süper Lig'],
  ['Antalyaspor', 'Kasımpaşa', 'Süper Lig'],
  ['Malmö FF', 'AIK', 'Allsvenskan'],
  ['Djurgården', 'Hammarby', 'Allsvenskan'],
  ['IFK Göteborg', 'Elfsborg', 'Allsvenskan'],
  ['Bodø/Glimt', 'Molde', 'Eliteserien'],
  ['Rosenborg', 'Viking', 'Eliteserien'],
  ['Arsenal', 'Chelsea', 'Premier Lig'],
  ['Liverpool', 'Tottenham', 'Premier Lig'],
  ['Real Madrid', 'Sevilla', 'La Liga'],
  ['Inter', 'Napoli', 'Serie A'],
  ['Bayern Münih', 'Leipzig', 'Bundesliga'],
];
const b27Matches = b27Fixtures.map((f, i) =>
  buildMatch('b27', i + 1, f, 3 * DAY + i * HOUR, MATCH_STATUS.NOT_STARTED)
);
const b27 = buildBulletin({
  id: 'b27',
  bulletinNo: '2026/27',
  dateOffsetMs: 3 * DAY,
  status: BULLETIN_STATUS.ACTIVE,
  createdOffsetMs: -1 * DAY,
  firstMatchOffsetMs: 3 * DAY,
  lockedOffsetMs: null,
  completedOffsetMs: null,
  matches: b27Matches,
  preMatchSnapshotId: 'snap-b27',
});

/* ---------------------------------------------------------------- */
/* B26 — LOCKED: ilk maç başladı, snapshot kilitli, sonuçlar kısmi   */
/* ---------------------------------------------------------------- */
const b26Def = [
  ['Fenerbahçe', 'Trabzonspor', 'Süper Lig', -14 * HOUR, MATCH_STATUS.FINISHED, { home: 2, away: 1 }, '1', { home: 1, away: 0 }],
  ['Galatasaray', 'Beşiktaş', 'Süper Lig', -13 * HOUR, MATCH_STATUS.FINISHED, { home: 1, away: 1 }, 'X', { home: 0, away: 1 }],
  ['Sivasspor', 'Konyaspor', 'Süper Lig', -13 * HOUR, MATCH_STATUS.FINISHED, { home: 0, away: 2 }, '2', { home: 0, away: 1 }],
  ['Alanyaspor', 'Antalyaspor', 'Süper Lig', -12 * HOUR, MATCH_STATUS.FINISHED, { home: 1, away: 0 }, '1', { home: 1, away: 0 }],
  ['Kasımpaşa', 'Başakşehir', 'Süper Lig', -12 * HOUR, MATCH_STATUS.FINISHED, { home: 2, away: 2 }, 'X', { home: 1, away: 1 }],
  ['AIK', 'Malmö FF', 'Allsvenskan', -11 * HOUR, MATCH_STATUS.FINISHED, { home: 0, away: 1 }, '2', { home: 0, away: 0 }],
  ['Hammarby', 'Djurgården', 'Allsvenskan', -11 * HOUR, MATCH_STATUS.FINISHED, { home: 3, away: 1 }, '1', { home: 1, away: 0 }],
  ['Elfsborg', 'IFK Göteborg', 'Allsvenskan', -10 * HOUR, MATCH_STATUS.FINISHED, { home: 1, away: 1 }, 'X', { home: 0, away: 0 }],
  ['Molde', 'Bodø/Glimt', 'Eliteserien', -10 * HOUR, MATCH_STATUS.FINISHED, { home: 0, away: 3 }, '2', { home: 0, away: 1 }],
  ['Viking', 'Rosenborg', 'Eliteserien', -9 * HOUR, MATCH_STATUS.FINISHED, { home: 2, away: 0 }, '1', { home: 1, away: 0 }],
  ['Chelsea', 'Arsenal', 'Premier Lig', -1 * HOUR, MATCH_STATUS.LIVE, null, null, { home: 0, away: 0 }],
  ['Tottenham', 'Liverpool', 'Premier Lig', -0.5 * HOUR, MATCH_STATUS.HALF_TIME, null, null, { home: 1, away: 0 }],
  ['Sevilla', 'Real Madrid', 'La Liga', 2 * HOUR, MATCH_STATUS.NOT_STARTED, null, null, null],
  ['Napoli', 'Inter', 'Serie A', 3 * HOUR, MATCH_STATUS.NOT_STARTED, null, null, null],
  ['Leipzig', 'Bayern Münih', 'Bundesliga', 4 * HOUR, MATCH_STATUS.NOT_STARTED, null, null, null],
];
const b26Matches = b26Def.map(([home, away, league, off, status, ft, res, ht], i) =>
  buildMatch('b26', i + 1, [home, away, league], off, status, ft, res, ht)
);
const b26 = buildBulletin({
  id: 'b26',
  bulletinNo: '2026/26',
  dateOffsetMs: -14 * HOUR,
  status: BULLETIN_STATUS.LOCKED,
  createdOffsetMs: -4 * DAY,
  firstMatchOffsetMs: -14 * HOUR,
  lockedOffsetMs: -14 * HOUR,
  completedOffsetMs: null,
  matches: b26Matches,
  preMatchSnapshotId: 'snap-b26',
});

/* ---------------------------------------------------------------- */
/* B24 — COMPLETED: tüm maçlar bitti, tüm sonuçlar belli             */
/* ---------------------------------------------------------------- */
const b24Def = [
  ['Trabzonspor', 'Galatasaray', 'Süper Lig', { home: 1, away: 2 }, '2'],
  ['Beşiktaş', 'Fenerbahçe', 'Süper Lig', { home: 2, away: 2 }, 'X'],
  ['Konyaspor', 'Sivasspor', 'Süper Lig', { home: 1, away: 0 }, '1'],
  ['Antalyaspor', 'Alanyaspor', 'Süper Lig', { home: 0, away: 0 }, 'X'],
  ['Başakşehir', 'Kasımpaşa', 'Süper Lig', { home: 3, away: 1 }, '1'],
  ['Malmö FF', 'Hammarby', 'Allsvenskan', { home: 2, away: 0 }, '1'],
  ['Djurgården', 'AIK', 'Allsvenskan', { home: 1, away: 1 }, 'X'],
  ['IFK Göteborg', 'Elfsborg', 'Allsvenskan', { home: 0, away: 1 }, '2'],
  ['Bodø/Glimt', 'Viking', 'Eliteserien', { home: 4, away: 0 }, '1'],
  ['Rosenborg', 'Molde', 'Eliteserien', { home: 1, away: 2 }, '2'],
  ['Arsenal', 'Liverpool', 'Premier Lig', { home: 1, away: 1 }, 'X'],
  ['Tottenham', 'Chelsea', 'Premier Lig', { home: 0, away: 2 }, '2'],
  ['Real Madrid', 'Napoli', 'La Liga', { home: 3, away: 0 }, '1'],
  ['Inter', 'Bayern Münih', 'Serie A', { home: 1, away: 1 }, 'X'],
  ['Sevilla', 'Leipzig', 'Bundesliga', { home: 2, away: 1 }, '1'],
];
const b24Matches = b24Def.map(([home, away, league, ft, res], i) =>
  buildMatch('b24', i + 1, [home, away, league], -16 * DAY + i * HOUR, MATCH_STATUS.FINISHED, ft, res, null)
);
const b24 = buildBulletin({
  id: 'b24',
  bulletinNo: '2026/24',
  dateOffsetMs: -16 * DAY,
  status: BULLETIN_STATUS.COMPLETED,
  createdOffsetMs: -19 * DAY,
  firstMatchOffsetMs: -16 * DAY,
  lockedOffsetMs: -16 * DAY,
  completedOffsetMs: -15.8 * DAY,
  matches: b24Matches,
  preMatchSnapshotId: 'snap-b24',
});

/* ---------------------------------------------------------------- */
/* B22 — COMPLETED (daha eski, başarılı hafta): dashboard için       */
/* ikinci referans noktası — ortalama/en iyi/en kötü anlamlı olsun.  */
/* ---------------------------------------------------------------- */
const b22Def = [
  ['Galatasaray', 'Konyaspor', 'Süper Lig', { home: 2, away: 0 }, '1'],
  ['Fenerbahçe', 'Sivasspor', 'Süper Lig', { home: 3, away: 1 }, '1'],
  ['Beşiktaş', 'Antalyaspor', 'Süper Lig', { home: 2, away: 1 }, '1'],
  ['Trabzonspor', 'Kasımpaşa', 'Süper Lig', { home: 1, away: 0 }, '1'],
  ['Başakşehir', 'Alanyaspor', 'Süper Lig', { home: 1, away: 1 }, 'X'],
  ['Malmö FF', 'Elfsborg', 'Allsvenskan', { home: 2, away: 1 }, '1'],
  ['AIK', 'Hammarby', 'Allsvenskan', { home: 2, away: 0 }, '1'],
  ['Djurgården', 'IFK Göteborg', 'Allsvenskan', { home: 1, away: 0 }, '1'],
  ['Bodø/Glimt', 'Rosenborg', 'Eliteserien', { home: 3, away: 1 }, '1'],
  ['Viking', 'Molde', 'Eliteserien', { home: 0, away: 2 }, '2'],
  ['Arsenal', 'Tottenham', 'Premier Lig', { home: 2, away: 0 }, '1'],
  ['Liverpool', 'Chelsea', 'Premier Lig', { home: 1, away: 1 }, 'X'],
  ['Real Madrid', 'Inter', 'La Liga', { home: 1, away: 2 }, '2'],
  ['Napoli', 'Sevilla', 'Serie A', { home: 2, away: 0 }, '1'],
  ['Bayern Münih', 'Leipzig', 'Bundesliga', { home: 3, away: 1 }, '1'],
];
const b22Matches = b22Def.map(([home, away, league, ft, res], i) =>
  buildMatch('b22', i + 1, [home, away, league], -30 * DAY + i * HOUR, MATCH_STATUS.FINISHED, ft, res, null)
);
const b22 = buildBulletin({
  id: 'b22',
  bulletinNo: '2026/22',
  dateOffsetMs: -30 * DAY,
  status: BULLETIN_STATUS.COMPLETED,
  createdOffsetMs: -33 * DAY,
  firstMatchOffsetMs: -30 * DAY,
  lockedOffsetMs: -30 * DAY,
  completedOffsetMs: -29.8 * DAY,
  matches: b22Matches,
  preMatchSnapshotId: 'snap-b22',
});

/* ---------------------------------------------------------------- */
/* B25 — CANCELLED: edge case — 15'ten az maç + tüm hafta iptal      */
/* ---------------------------------------------------------------- */
const b25Fixtures = [
  ['Sivasspor', 'Antalyaspor', 'Süper Lig'],
  ['Kasımpaşa', 'Konyaspor', 'Süper Lig'],
  ['Alanyaspor', 'Başakşehir', 'Süper Lig'],
  ['AIK', 'Djurgården', 'Allsvenskan'],
  ['Hammarby', 'Elfsborg', 'Allsvenskan'],
  ['Malmö FF', 'IFK Göteborg', 'Allsvenskan'],
  ['Molde', 'Viking', 'Eliteserien'],
  ['Rosenborg', 'Bodø/Glimt', 'Eliteserien'],
  ['Chelsea', 'Tottenham', 'Premier Lig'],
  ['Napoli', 'Sevilla', 'La Liga'],
];
const b25Matches = b25Fixtures.map((f, i) =>
  buildMatch('b25', i + 1, f, -9 * DAY + i * HOUR, MATCH_STATUS.CANCELLED)
);
const b25 = buildBulletin({
  id: 'b25',
  bulletinNo: '2026/25',
  dateOffsetMs: -9 * DAY,
  status: BULLETIN_STATUS.CANCELLED,
  createdOffsetMs: -10 * DAY,
  firstMatchOffsetMs: -9 * DAY,
  lockedOffsetMs: null,
  completedOffsetMs: null,
  matches: b25Matches,
  preMatchSnapshotId: null,
});

export const mockBulletins = [b27, b26, b25, b24, b22];

export function findMockBulletin(id) {
  return mockBulletins.find((b) => b.id === id) || null;
}
