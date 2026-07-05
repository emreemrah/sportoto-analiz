// app/src/types/bulletin.js
// Proje JavaScript olduğu için gerçek tip yerine JSDoc + sade durum sabitleri kullanılır.
// Bu dosya sadece Bülten Geçmişi altyapısına dair model tanımlarını içerir.

export const BULLETIN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  LOCKED: 'locked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const BULLETIN_STATUS_LABEL = {
  [BULLETIN_STATUS.DRAFT]: 'Taslak',
  [BULLETIN_STATUS.ACTIVE]: 'Aktif',
  [BULLETIN_STATUS.LOCKED]: 'Kilitli',
  [BULLETIN_STATUS.COMPLETED]: 'Tamamlandı',
  [BULLETIN_STATUS.CANCELLED]: 'İptal',
};

export const MATCH_STATUS = {
  NOT_STARTED: 'not_started',
  LIVE: 'live',
  HALF_TIME: 'half_time',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
};

/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} bulletinId
 * @property {number} orderNo            - Kupondaki sırası (1..15)
 * @property {string} code               - Resmi maç kodu
 * @property {{name: string}} homeTeam
 * @property {{name: string}} awayTeam
 * @property {string} league
 * @property {string} startTime          - ISO tarih
 * @property {string} status             - bkz. MATCH_STATUS
 * @property {{home:number, away:number}|null} halfTimeScore
 * @property {{home:number, away:number}|null} fullTimeScore
 * @property {('1'|'X'|'2')|null} result1x2
 */

/**
 * @typedef {Object} Bulletin
 * @property {string} id
 * @property {string} bulletinNo             - Örn. "2026/27"
 * @property {string} date                   - Bülten haftası tarihi (ISO)
 * @property {string} status                 - bkz. BULLETIN_STATUS
 * @property {string} createdAt              - ISO
 * @property {string|null} firstMatchStartAt - ISO — ilk maçın başlama zamanı
 * @property {string|null} lockedAt          - ISO — analiz kilitlendiği an
 * @property {string|null} completedAt       - ISO — tüm sonuçlar açıklandığında
 * @property {Match[]} matches
 * @property {string|null} preMatchSnapshotId
 * @property {{ systemCorrect:number, systemWrong:number, systemAccuracy:number }|null} resultSummary
 * @property {CorrectionLogEntry[]} [correctionLog] - Kilitlendikten sonra reddedilen
 *   dış-kaynak güncelleme denemeleri (bkz. bulletinHistoryService.applyIncomingMatchUpdate).
 */

/**
 * @typedef {Object} CorrectionLogEntry
 * @property {string} at        - ISO zaman damgası
 * @property {string} reason    - Neden reddedildi (insan-okunur)
 * @property {Object} attempted - Dış kaynaktan gelen, uygulanmayan ham veri
 */

// Bülten, ilk maçın başlama saatine göre "kilitlenmesi gerekiyor mu" sorusu.
// Servis katmanında kullanılır — burada sadece saf/paylaşılan kural.
export function isPastFirstMatch(bulletin, now = Date.now()) {
  if (!bulletin?.firstMatchStartAt) return false;
  return new Date(bulletin.firstMatchStartAt).getTime() <= now;
}

export function isBulletinLockable(bulletin, now = Date.now()) {
  return (
    (bulletin.status === BULLETIN_STATUS.ACTIVE || bulletin.status === BULLETIN_STATUS.DRAFT) &&
    isPastFirstMatch(bulletin, now)
  );
}

// --- dosya sonu güvenlik dolgusu (sandbox yazma/senkron katmanındaki olası
// kesilme/artık bayt sorunlarını zararsız hale getirmek için bilinçli olarak
// eklendi; çalışma zamanında hiçbir etkisi yoktur) ---
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
