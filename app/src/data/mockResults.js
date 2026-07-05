// app/src/data/mockResults.js
// Sonuç verisi için tek doğruluk kaynağı mockBulletins'teki Match kayıtlarıdır
// (skor + resmi 1/X/2). Bu dosya sadece o veriye kolay/izole erişim sağlayan
// ince bir sorgu katmanıdır — veriyi tekrar etmez.

import { mockBulletins, findMockBulletin } from './mockBulletins';
import { MATCH_STATUS } from '../types/bulletin';

// Bir bültenin sonuçlanmış (skor girilmiş) maçlarını döner.
export function getResolvedMatches(bulletinId) {
  const bulletin = findMockBulletin(bulletinId);
  if (!bulletin) return [];
  return bulletin.matches.filter((m) => m.status === MATCH_STATUS.FINISHED && !!m.result1x2);
}

// Tek bir maçın sonucunu döner (yoksa null alanlarla).
export function getMatchResult(bulletinId, matchId) {
  const bulletin = findMockBulletin(bulletinId);
  const match = bulletin?.matches.find((m) => m.id === matchId);
  if (!match) return null;
  return {
    matchId,
    status: match.status,
    halfTimeScore: match.halfTimeScore,
    fullTimeScore: match.fullTimeScore,
    result1x2: match.result1x2,
  };
}

// Bültenin tamamı sonuçlandı mı (tüm maçlar finished + result1x2 dolu)?
export function isBulletinFullyResolved(bulletinId) {
  const bulletin = findMockBulletin(bulletinId);
  if (!bulletin || !bulletin.matches.length) return false;
  return bulletin.matches.every((m) => m.status === MATCH_STATUS.FINISHED && !!m.result1x2);
}

export function getAllBulletinResults() {
  return mockBulletins.map((b) => ({
    bulletinId: b.id,
    resolvedCount: getResolvedMatches(b.id).length,
    totalCount: b.matches.length,
    fullyResolved: isBulletinFullyResolved(b.id),
  }));
}
