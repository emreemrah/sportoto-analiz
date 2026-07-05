// app/src/types/coupon.js
// Kullanıcının kendi 15 maçlık kupon kayıtları. Kaydedilen kupon sessizce
// değiştirilmez — düzenleme yeni versiyon oluşturur, eski versiyon saklı kalır.

export const COUPON_STATUS = {
  DRAFT: 'draft',
  SAVED: 'saved',
  LOCKED: 'locked',
  CHECKED: 'checked',
};

export const COUPON_STATUS_LABEL = {
  [COUPON_STATUS.DRAFT]: 'Taslak',
  [COUPON_STATUS.SAVED]: 'Kaydedildi',
  [COUPON_STATUS.LOCKED]: 'Kilitlendi',
  [COUPON_STATUS.CHECKED]: 'Kontrol Edildi',
};

/**
 * @typedef {Object} CouponSelection
 * @property {string} matchId
 * @property {('1'|'X'|'2')} userPick
 * @property {('1'|'X'|'2')} systemPickAtSaveTime
 * @property {number} confidenceScoreAtSaveTime
 * @property {number} surpriseRiskAtSaveTime
 * @property {('1'|'X'|'2')|null} actualResult
 * @property {boolean|null} isCorrect
 * @property {boolean} followedSystemSuggestion
 */

/**
 * @typedef {Object} Coupon
 * @property {string} id
 * @property {string} bulletinId
 * @property {string} userId
 * @property {number} version
 * @property {string} createdAt
 * @property {string} status                  - bkz. COUPON_STATUS
 * @property {CouponSelection[]} selections
 * @property {string} linkedSnapshotId
 * @property {string|null} checkedAt
 * @property {{ correct:number, wrong:number, total:number }|null} resultSummary
 */
