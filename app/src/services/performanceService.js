// app/src/services/performanceService.js
// Kullanıcı başarı dashboard'u + sistem analiz başarı dashboard'u hesaplamaları.
// Statik sayı tutmak yerine her çağrıda mock veriden canlı hesaplanır — böylece
// coupon/analysis mock'ları değişse bile dashboard hep tutarlı kalır.

import { mockBulletins } from '../data/mockBulletins';
import { mockAnalysisSnapshots } from '../data/mockAnalysisSnapshots';
import { mockCoupons, MOCK_USER_ID } from '../data/mockCoupons';
import { COUPON_STATUS } from '../types/coupon';
import { CONFIDENCE_HIGH_THRESHOLD, SURPRISE_HIGH_THRESHOLD } from '../types/dashboard';

function acc(correct, total) {
  return { total, correct, rate: total ? Math.round((correct / total) * 100) : 0 };
}
function accOfList(list) {
  return acc(list.filter((x) => x.isCorrect).length, list.length);
}

function leagueOfMatch(matchId) {
  for (const b of mockBulletins) {
    const m = b.matches.find((x) => x.id === matchId);
    if (m) return m.league;
  }
  return 'Bilinmiyor';
}

function latestPerBulletin(coupons) {
  const byBulletin = new Map();
  coupons.forEach((c) => {
    const cur = byBulletin.get(c.bulletinId);
    if (!cur || c.version > cur.version) byBulletin.set(c.bulletinId, c);
  });
  return Array.from(byBulletin.values());
}

function isFullyChecked(coupon) {
  return (
    coupon.status === COUPON_STATUS.CHECKED &&
    coupon.selections.length > 0 &&
    coupon.selections.every((s) => s.isCorrect !== null)
  );
}

function leagueBreakdown(resolvedSelections) {
  const byLeague = new Map();
  resolvedSelections.forEach((s) => {
    const league = leagueOfMatch(s.matchId);
    if (!byLeague.has(league)) byLeague.set(league, { total: 0, correct: 0 });
    const row = byLeague.get(league);
    row.total += 1;
    if (s.isCorrect) row.correct += 1;
  });
  return Array.from(byLeague.entries())
    .map(([league, { total, correct }]) => ({ league, total, correct, rate: Math.round((correct / total) * 100) }))
    .filter((r) => r.total >= 1);
}

// ------------------------------------------------------------------
// KULLANICI BAŞARI DASHBOARD
// ------------------------------------------------------------------
export async function getUserDashboard(userId = MOCK_USER_ID) {
  const userCoupons = mockCoupons.filter((c) => c.userId === userId);
  const latest = latestPerBulletin(userCoupons);
  const fullyChecked = latest.filter(isFullyChecked);

  const allResolvedSelections = latest.flatMap((c) => c.selections.filter((s) => s.isCorrect !== null));

  const correctCounts = fullyChecked.map((c) => c.resultSummary.correct);
  const averageCorrect = correctCounts.length
    ? Math.round((correctCounts.reduce((a, b) => a + b, 0) / correctCounts.length) * 10) / 10
    : 0;
  const bestCorrect = correctCounts.length ? Math.max(...correctCounts) : 0;
  const worstCorrect = correctCounts.length ? Math.min(...correctCounts) : 0;

  const correctCountBuckets = {};
  fullyChecked.forEach((c) => {
    const key = String(c.resultSummary.correct);
    correctCountBuckets[key] = (correctCountBuckets[key] || 0) + 1;
  });

  const by = (pick) => accOfList(allResolvedSelections.filter((s) => s.userPick === pick));

  const leagues = leagueBreakdown(allResolvedSelections);
  const sortedLeagues = [...leagues].sort((a, b) => b.rate - a.rate);

  const highConf = allResolvedSelections.filter((s) => (s.confidenceScoreAtSaveTime ?? 0) >= CONFIDENCE_HIGH_THRESHOLD);
  const lowConf = allResolvedSelections.filter((s) => (s.confidenceScoreAtSaveTime ?? 0) < CONFIDENCE_HIGH_THRESHOLD);
  const highSurprise = allResolvedSelections.filter((s) => (s.surpriseRiskAtSaveTime ?? 0) >= SURPRISE_HIGH_THRESHOLD);
  const followed = allResolvedSelections.filter((s) => s.followedSystemSuggestion);
  const differed = allResolvedSelections.filter((s) => !s.followedSystemSuggestion);

  const recentForm = [...latest]
    .filter((c) => c.resultSummary)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c) => {
      const bulletin = mockBulletins.find((b) => b.id === c.bulletinId);
      return {
        couponId: c.id,
        bulletinNo: bulletin?.bulletinNo || c.bulletinId,
        date: bulletin?.date || c.createdAt,
        correct: c.resultSummary.correct,
        wrong: c.resultSummary.wrong,
        total: c.resultSummary.total,
        fullyChecked: isFullyChecked(c),
      };
    });

  return {
    totalCoupons: latest.length,
    checkedCoupons: fullyChecked.length,
    averageCorrect,
    bestCorrect,
    worstCorrect,
    correctCountBuckets,
    pick1: by('1'),
    pickX: by('X'),
    pick2: by('2'),
    recentForm5: recentForm.slice(0, 5),
    recentForm10: recentForm.slice(0, 10),
    bestLeagues: sortedLeagues.slice(0, 3),
    worstLeagues: [...sortedLeagues].reverse().slice(0, 3),
    confidenceSplit: { high: accOfList(highConf), low: accOfList(lowConf) },
    surpriseRiskSuccess: accOfList(highSurprise),
    followedSystemSuccess: accOfList(followed),
    differedFromSystemSuccess: accOfList(differed),
  };
}

// ------------------------------------------------------------------
// SİSTEM ANALİZ BAŞARI DASHBOARD
// ------------------------------------------------------------------
export async function getSystemDashboard() {
  const allAnalysis = mockAnalysisSnapshots.flatMap((s) => s.matchesAnalysis);
  const resolved = allAnalysis.filter((m) => m.resultInfo && m.resultInfo.systemCorrect !== null);

  const correct = resolved.filter((m) => m.resultInfo.systemCorrect).length;
  const wrong = resolved.length - correct;

  const byPick = (pick) => {
    const list = resolved.filter((m) => m.prediction === pick);
    return acc(list.filter((m) => m.resultInfo.systemCorrect).length, list.length);
  };

  const high = resolved.filter((m) => m.confidenceScore >= CONFIDENCE_HIGH_THRESHOLD);
  const low = resolved.filter((m) => m.confidenceScore < CONFIDENCE_HIGH_THRESHOLD);
  const highS = resolved.filter((m) => m.surpriseRisk >= SURPRISE_HIGH_THRESHOLD);
  const lowS = resolved.filter((m) => m.surpriseRisk < SURPRISE_HIGH_THRESHOLD);

  const accCorrect = (list) => acc(list.filter((m) => m.resultInfo.systemCorrect).length, list.length);

  const leagueRows = resolved.map((m) => ({ matchId: m.matchId, isCorrect: m.resultInfo.systemCorrect }));
  const leagues = leagueBreakdown(leagueRows);
  const sortedLeagues = [...leagues].sort((a, b) => b.rate - a.rate);

  const errorTagCounts = {};
  resolved.forEach((m) => {
    if (!m.resultInfo.systemCorrect && m.resultInfo.errorTag) {
      errorTagCounts[m.resultInfo.errorTag] = (errorTagCounts[m.resultInfo.errorTag] || 0) + 1;
    }
  });

  const lineupFlagged = resolved.filter((m) => m.missingPlayers && m.missingPlayers.length > 0);
  const lineupRiskHitRate = lineupFlagged.length
    ? Math.round((lineupFlagged.filter((m) => !m.resultInfo.systemCorrect).length / lineupFlagged.length) * 100)
    : 0;
  const surpriseFlagged = resolved.filter((m) => m.surpriseRisk >= SURPRISE_HIGH_THRESHOLD);
  const surpriseRiskHitRate = surpriseFlagged.length
    ? Math.round((surpriseFlagged.filter((m) => !m.resultInfo.systemCorrect).length / surpriseFlagged.length) * 100)
    : 0;

  return {
    totalAnalyzed: resolved.length,
    correct,
    wrong,
    accuracy: resolved.length ? Math.round((correct / resolved.length) * 100) : 0,
    pick1: byPick('1'),
    pickX: byPick('X'),
    pick2: byPick('2'),
    confidenceSplit: { high: accCorrect(high), low: accCorrect(low) },
    surpriseRiskSplit: { high: accCorrect(highS), low: accCorrect(lowS) },
    bestLeagues: sortedLeagues.slice(0, 3),
    worstLeagues: [...sortedLeagues].reverse().slice(0, 3),
    errorTagCounts,
    lineupRiskHitRate,
    surpriseRiskHitRate,
  };
}
