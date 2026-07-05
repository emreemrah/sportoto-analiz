// app/src/data/mockCoupons.js
// Kullanıcının kaydettiği kuponlar (mock tek kullanıcı: 'u1'). Kayıt anındaki
// sistem önerisi/güven/sürpriz değerleri dondurulur (CouponSelection...AtSaveTime) —
// snapshot sonradan değişse bile bu kupon o anki hali gösterir.

import { findMockBulletin } from './mockBulletins';
import { findMockSnapshot } from './mockAnalysisSnapshots';
import { COUPON_STATUS } from '../types/coupon';

export const MOCK_USER_ID = 'u1';

function buildCoupon({ id, bulletinId, userId, version, createdAt, status, picks }) {
  const bulletin = findMockBulletin(bulletinId);
  const snapshot = findMockSnapshot(bulletinId);
  const selections = picks.map(([orderNo, userPick]) => {
    const match = bulletin.matches.find((m) => m.orderNo === orderNo);
    const ma = snapshot?.matchesAnalysis.find((a) => a.matchId === match.id);
    const actualResult = match.result1x2 || null;
    const isCorrect = actualResult ? userPick === actualResult : null;
    return {
      matchId: match.id,
      userPick,
      systemPickAtSaveTime: ma?.prediction ?? null,
      confidenceScoreAtSaveTime: ma?.confidenceScore ?? null,
      surpriseRiskAtSaveTime: ma?.surpriseRisk ?? null,
      actualResult,
      isCorrect,
      followedSystemSuggestion: ma ? userPick === ma.prediction : false,
    };
  });
  const resolved = selections.filter((s) => s.isCorrect !== null);
  const resultSummary = resolved.length
    ? { correct: resolved.filter((s) => s.isCorrect).length, wrong: resolved.filter((s) => !s.isCorrect).length, total: selections.length }
    : null;
  return {
    id,
    bulletinId,
    userId,
    version,
    createdAt,
    status,
    selections,
    linkedSnapshotId: snapshot?.id ?? null,
    checkedAt: status === COUPON_STATUS.CHECKED ? createdAt : null,
    resultSummary,
  };
}

// b24 — tamamlanmış hafta, kupon kontrol edildi (8/15 — sistemle aynı oranda ama farklı maçlarda tuttu/yattı)
const couponB24 = buildCoupon({
  id: 'c-b24-u1-v1',
  bulletinId: 'b24',
  userId: MOCK_USER_ID,
  version: 1,
  createdAt: findMockBulletin('b24').createdAt,
  status: COUPON_STATUS.CHECKED,
  picks: [
    [1, '2'], [2, 'X'], [3, '1'], [4, '1'], [5, '1'],
    [6, '2'], [7, '1'], [8, '1'], [9, '1'], [10, '2'],
    [11, '1'], [12, 'X'], [13, '1'], [14, '2'], [15, '1'],
  ],
});

// b22 — daha eski, çok başarılı hafta (14/15)
const couponB22 = buildCoupon({
  id: 'c-b22-u1-v1',
  bulletinId: 'b22',
  userId: MOCK_USER_ID,
  version: 1,
  createdAt: findMockBulletin('b22').createdAt,
  status: COUPON_STATUS.CHECKED,
  picks: [
    [1, '1'], [2, '1'], [3, '1'], [4, '1'], [5, 'X'],
    [6, '1'], [7, '1'], [8, '1'], [9, '1'], [10, '2'],
    [11, '1'], [12, '1'], [13, '2'], [14, '1'], [15, '1'],
  ],
});

// b26 — devam eden (kilitli) hafta: 15 maça da tahmin girildi ama sadece
// ilk 10'un sonucu belli. status 'locked' — henüz tam 'checked' değil.
const couponB26 = buildCoupon({
  id: 'c-b26-u1-v2',
  bulletinId: 'b26',
  userId: MOCK_USER_ID,
  version: 2,
  createdAt: new Date(new Date(findMockBulletin('b26').firstMatchStartAt).getTime() - 5 * 60 * 60 * 1000).toISOString(),
  status: COUPON_STATUS.LOCKED,
  picks: [
    [1, '1'], [2, '1'], [3, 'X'], [4, '1'], [5, '2'],
    [6, '1'], [7, '1'], [8, '1'], [9, '2'], [10, '2'],
    [11, '2'], [12, '2'], [13, '1'], [14, 'X'], [15, '2'],
  ],
});
// v2'den önce kaydedilmiş, artık geçmişte saklı duran ilk versiyon (versiyonlama örneği)
const couponB26v1 = buildCoupon({
  id: 'c-b26-u1-v1',
  bulletinId: 'b26',
  userId: MOCK_USER_ID,
  version: 1,
  createdAt: new Date(new Date(findMockBulletin('b26').firstMatchStartAt).getTime() - 30 * 60 * 60 * 1000).toISOString(),
  status: COUPON_STATUS.SAVED,
  picks: [
    [1, '1'], [2, 'X'], [3, 'X'], [4, '1'], [5, '2'],
    [6, '2'], [7, '1'], [8, 'X'], [9, '2'], [10, '1'],
    [11, '2'], [12, '2'], [13, '1'], [14, 'X'], [15, '2'],
  ],
});

// b27 (aktif) için kullanıcı henüz kupon oluşturmadı — bilinçli olarak boş
// bırakıldı ("Kullanıcı hiç kupon oluşturmamış" boş durumunu göstermek için).

export const mockCoupons = [couponB24, couponB22, couponB26, couponB26v1];

export function findCouponsByBulletin(bulletinId) {
  return mockCoupons
    .filter((c) => c.bulletinId === bulletinId)
    .sort((a, b) => b.version - a.version);
}

export function findLatestCoupon(bulletinId, userId = MOCK_USER_ID) {
  const list = mockCoupons.filter((c) => c.bulletinId === bulletinId && c.userId === userId);
  if (!list.length) return null;
  return list.reduce((latest, c) => (c.version > latest.version ? c : latest), list[0]);
}

export function findUserCoupons(userId = MOCK_USER_ID) {
  return mockCoupons.filter((c) => c.userId === userId);
}
