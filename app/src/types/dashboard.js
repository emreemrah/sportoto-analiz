// app/src/types/dashboard.js
// Kullanıcı başarı dashboard'u ve sistem analiz başarı dashboard'u için
// paylaşılan model tanımları. Sadece JSDoc — çalışma zamanında kullanılmaz.

/**
 * @typedef {Object} PickAccuracy
 * @property {number} total
 * @property {number} correct
 * @property {number} rate     - 0-100
 */

/**
 * @typedef {Object} LeagueBreakdown
 * @property {string} league
 * @property {number} total
 * @property {number} correct
 * @property {number} rate
 */

/**
 * @typedef {Object} UserDashboardMetrics
 * @property {number} totalCoupons
 * @property {number} checkedCoupons
 * @property {number} averageCorrect
 * @property {number} bestCorrect
 * @property {number} worstCorrect
 * @property {Record<string, number>} correctCountBuckets   - {15:1, 14:2, 13:0, 12:1}
 * @property {PickAccuracy} pick1
 * @property {PickAccuracy} pickX
 * @property {PickAccuracy} pick2
 * @property {Array<{couponId:string, date:string, correct:number, total:number}>} recentForm
 * @property {LeagueBreakdown[]} bestLeagues
 * @property {LeagueBreakdown[]} worstLeagues
 * @property {{ high: PickAccuracy, low: PickAccuracy }} confidenceSplit
 * @property {PickAccuracy} surpriseRiskSuccess
 * @property {PickAccuracy} followedSystemSuccess
 * @property {PickAccuracy} differedFromSystemSuccess
 */

/**
 * @typedef {Object} SystemDashboardMetrics
 * @property {number} totalAnalyzed
 * @property {number} correct
 * @property {number} wrong
 * @property {number} accuracy
 * @property {PickAccuracy} pick1
 * @property {PickAccuracy} pickX
 * @property {PickAccuracy} pick2
 * @property {{ high: PickAccuracy, low: PickAccuracy }} confidenceSplit
 * @property {{ high: PickAccuracy, low: PickAccuracy }} surpriseRiskSplit
 * @property {LeagueBreakdown[]} bestLeagues
 * @property {LeagueBreakdown[]} worstLeagues
 * @property {Record<string, number>} errorTagCounts
 * @property {number} lineupRiskHitRate      - Kadro riski uyarısı doğru çıktı mı? (0-100)
 * @property {number} surpriseRiskHitRate    - Sürpriz riski uyarısı doğru çıktı mı? (0-100)
 */

export const CONFIDENCE_HIGH_THRESHOLD = 65; // >= bu değer "yüksek güven"
export const SURPRISE_HIGH_THRESHOLD = 55;   // >= bu değer "yüksek sürpriz riski"
