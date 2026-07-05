// app/src/types/analysis.js
// Maç başlamadan önceki analiz "snapshot" modeli. Kilitlendikten sonra bu kayıt
// bir daha değiştirilmez — geçmiş bültende her zaman bu hal gösterilir.

export const SNAPSHOT_STATUS = {
  EDITABLE: 'editable',
  LOCKED: 'locked',
};

export const ERROR_TAGS = {
  FAVORITE_FAILED: 'favorite_failed',
  DRAW_MISSED: 'draw_missed',
  AWAY_WIN_MISSED: 'away_win_missed',
  LINEUP_RISK: 'lineup_risk',
  RED_CARD_EFFECT: 'red_card_effect',
  LATE_GOAL: 'late_goal',
  LOW_CONFIDENCE: 'low_confidence',
  SURPRISE_MATCH: 'surprise_match',
  UNKNOWN: 'unknown',
};

export const ERROR_TAG_LABEL = {
  [ERROR_TAGS.FAVORITE_FAILED]: 'Favori kaybetti',
  [ERROR_TAGS.DRAW_MISSED]: 'Kaçırılan beraberlik',
  [ERROR_TAGS.AWAY_WIN_MISSED]: 'Kaçırılan deplasman galibiyeti',
  [ERROR_TAGS.LINEUP_RISK]: 'Kadro riski',
  [ERROR_TAGS.RED_CARD_EFFECT]: 'Kırmızı kart etkisi',
  [ERROR_TAGS.LATE_GOAL]: 'Geç gol',
  [ERROR_TAGS.LOW_CONFIDENCE]: 'Düşük güven skoru',
  [ERROR_TAGS.SURPRISE_MATCH]: 'Sürpriz maç',
  [ERROR_TAGS.UNKNOWN]: 'Belirsiz',
};

/**
 * @typedef {Object} MissingPlayer
 * @property {string} name
 * @property {'injury'|'suspension'|'doubtful'} reason
 */

/**
 * @typedef {Object} MatchAnalysis
 * @property {string} matchId
 * @property {('1'|'X'|'2')} prediction          - Sistem önerisi
 * @property {number} confidenceScore            - 0-100
 * @property {number} surpriseRisk                - 0-100 (yüksek = sürprize açık)
 * @property {string} analysisComment
 * @property {string} statsSummary
 * @property {string} lineupComment
 * @property {MissingPlayer[]} missingPlayers
 * @property {string} dataTimestamp               - Analizde kullanılan verinin zamanı
 * @property {string} createdAt
 * @property {number} version
 * @property {boolean} isLocked
 * @property {MatchResultInfo|null} resultInfo    - Sonradan eklenir, ayrı alan
 */

/**
 * @typedef {Object} MatchResultInfo
 * @property {{home:number, away:number}|null} halfTimeScore
 * @property {{home:number, away:number}|null} fullTimeScore
 * @property {('1'|'X'|'2')|null} actualResult
 * @property {boolean|null} systemCorrect
 * @property {boolean|null} userCorrect
 * @property {string|null} errorTag               - bkz. ERROR_TAGS
 * @property {string|null} errorNote
 */

/**
 * @typedef {Object} AnalysisSnapshot
 * @property {string} id
 * @property {string} bulletinId
 * @property {number} version
 * @property {string} createdAt
 * @property {string|null} lockedAt
 * @property {boolean} isLocked
 * @property {MatchAnalysis[]} matchesAnalysis
 */
