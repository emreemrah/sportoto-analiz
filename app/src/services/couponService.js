// app/src/services/couponService.js
// Kullanıcı kupon servis katmanı. Kural: kaydedilmiş kupon sessizce
// değiştirilmez — her kaydetme yeni bir versiyon oluşturur, eskisi saklı kalır.
// Bülten kilitlendikten sonra yeni versiyon kaydedilemez (var olan kupon geçerli kalır).

import { mockCoupons, MOCK_USER_ID } from '../data/mockCoupons';
import { mockBulletins } from '../data/mockBulletins';
import { mockAnalysisSnapshots } from '../data/mockAnalysisSnapshots';
import { COUPON_STATUS } from '../types/coupon';
import { BULLETIN_STATUS } from '../types/bulletin';

const clone = (x) => JSON.parse(JSON.stringify(x));
let store = mockCoupons.map(clone);
let bulletins = mockBulletins.map(clone);
let snapshots = mockAnalysisSnapshots.map(clone);

function bulletinOf(bulletinId) {
  return bulletins.find((b) => b.id === bulletinId) || null;
}
function snapshotOf(bulletinId) {
  return snapshots.find((s) => s.bulletinId === bulletinId) || null;
}

export async function getUserCoupons(userId = MOCK_USER_ID) {
  return store.filter((c) => c.userId === userId).map(clone);
}

// Bir bültendeki bir kullanıcının TÜM versiyonları (yeni → eski).
export async function getCouponHistory(bulletinId, userId = MOCK_USER_ID) {
  return store
    .filter((c) => c.bulletinId === bulletinId && c.userId === userId)
    .sort((a, b) => b.version - a.version)
    .map(clone);
}

export async function getCouponForBulletin(bulletinId, userId = MOCK_USER_ID) {
  const list = await getCouponHistory(bulletinId, userId);
  return list[0] || null;
}

// selections: [{ matchId, userPick }]
export async function saveCoupon(bulletinId, selections, userId = MOCK_USER_ID) {
  const bulletin = bulletinOf(bulletinId);
  if (!bulletin) throw new Error('Bülten bulunamadı.');
  if (bulletin.status === BULLETIN_STATUS.LOCKED || bulletin.status === BULLETIN_STATUS.COMPLETED) {
    throw new Error('Bu bülten kilitlendi, kupon artık kaydedilemez/düzenlenemez.');
  }
  if (bulletin.status === BULLETIN_STATUS.CANCELLED) {
    throw new Error('Bu hafta iptal edildi, kupon oluşturulamaz.');
  }
  const requiredIds = bulletin.matches.map((m) => m.id);
  const providedIds = selections.map((s) => s.matchId);
  const missing = requiredIds.filter((id) => !providedIds.includes(id));
  if (missing.length) {
    throw new Error(`Kuponu kaydetmeden önce ${missing.length} maç için seçim yapmalısın.`);
  }

  const snapshot = snapshotOf(bulletinId);
  const enriched = selections.map((s) => {
    const ma = snapshot?.matchesAnalysis.find((a) => a.matchId === s.matchId);
    const match = bulletin.matches.find((m) => m.id === s.matchId);
    const actualResult = match?.result1x2 || null;
    return {
      matchId: s.matchId,
      userPick: s.userPick,
      systemPickAtSaveTime: ma?.prediction ?? null,
      confidenceScoreAtSaveTime: ma?.confidenceScore ?? null,
      surpriseRiskAtSaveTime: ma?.surpriseRisk ?? null,
      actualResult,
      isCorrect: actualResult ? s.userPick === actualResult : null,
      followedSystemSuggestion: ma ? s.userPick === ma.prediction : false,
    };
  });

  const prevVersions = await getCouponHistory(bulletinId, userId);
  const nextVersion = prevVersions.length ? prevVersions[0].version + 1 : 1;
  const resolved = enriched.filter((s) => s.isCorrect !== null);
  const coupon = {
    id: `c-${bulletinId}-${userId}-v${nextVersion}`,
    bulletinId,
    userId,
    version: nextVersion,
    createdAt: new Date().toISOString(),
    status: COUPON_STATUS.SAVED,
    selections: enriched,
    linkedSnapshotId: snapshot?.id ?? null,
    checkedAt: null,
    resultSummary: resolved.length
      ? { correct: resolved.filter((s) => s.isCorrect).length, wrong: resolved.filter((s) => !s.isCorrect).length, total: enriched.length }
      : null,
  };
  store = [...store, coupon];
  return clone(coupon);
}

// Sonuçlarla karşılaştırıp güncel hale getirir. Bülten tam sonuçlanmamışsa bile
// güvenle çağrılabilir — sadece o ana kadar bilinen sonuçlar işlenir.
export async function checkCoupon(couponId) {
  const idx = store.findIndex((c) => c.id === couponId);
  if (idx === -1) throw new Error('Kupon bulunamadı.');
  const coupon = store[idx];
  const bulletin = bulletinOf(coupon.bulletinId);
  if (!bulletin) throw new Error('Kupona ait bülten bulunamadı.');

  const selections = coupon.selections.map((s) => {
    const match = bulletin.matches.find((m) => m.id === s.matchId);
    const actualResult = match?.result1x2 || null;
    return {
      ...s,
      actualResult,
      isCorrect: actualResult ? s.userPick === actualResult : null,
    };
  });
  const resolved = selections.filter((s) => s.isCorrect !== null);
  const allResolved = resolved.length === selections.length;
  const updated = {
    ...coupon,
    selections,
    status: allResolved ? COUPON_STATUS.CHECKED : coupon.status,
    checkedAt: allResolved ? new Date().toISOString() : coupon.checkedAt,
    resultSummary: resolved.length
      ? { correct: resolved.filter((s) => s.isCorrect).length, wrong: resolved.filter((s) => !s.isCorrect).length, total: selections.length }
      : null,
  };
  store[idx] = updated;
  return clone(updated);
}

export function isCouponEditable(bulletin) {
  return bulletin && bulletin.status !== BULLETIN_STATUS.LOCKED && bulletin.status !== BULLETIN_STATUS.COMPLETED && bulletin.status !== BULLETIN_STATUS.CANCELLED;
}
