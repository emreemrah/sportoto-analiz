// app/src/services/analysisSnapshotService.js
// Maç-öncesi analiz "snapshot" servis katmanı. Kritik kural burada uygulanır:
// bültenin ilk maçı başladığı an snapshot kilitlenir ve bir daha değişmez.
// Kilitliyken updateMatchAnalysis çağrısı hata fırlatır.

import { mockAnalysisSnapshots } from '../data/mockAnalysisSnapshots';
import { mockBulletins } from '../data/mockBulletins';
import { isBulletinLockable } from '../types/bulletin';

const clone = (x) => JSON.parse(JSON.stringify(x));
let store = mockAnalysisSnapshots.map(clone);
let bulletins = mockBulletins.map(clone);

function lockIfDue(snapshot) {
  if (!snapshot || snapshot.isLocked) return snapshot;
  const bulletin = bulletins.find((b) => b.id === snapshot.bulletinId);
  if (bulletin && isBulletinLockable(bulletin)) {
    return {
      ...snapshot,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      matchesAnalysis: snapshot.matchesAnalysis.map((m) => ({ ...m, isLocked: true })),
    };
  }
  return snapshot;
}

export async function getSnapshot(bulletinId) {
  const idx = store.findIndex((s) => s.bulletinId === bulletinId);
  if (idx === -1) return null;
  const locked = lockIfDue(store[idx]);
  store[idx] = locked;
  return clone(locked);
}

export async function getMatchAnalysis(bulletinId, matchId) {
  const snap = await getSnapshot(bulletinId);
  return snap?.matchesAnalysis.find((m) => m.matchId === matchId) || null;
}

// Sadece kilit öncesi (editable) çağrılabilir. patch: MatchAnalysis alanlarından
// bir alt küme (ör. { analysisComment, confidenceScore }).
export async function updateMatchAnalysis(bulletinId, matchId, patch) {
  const idx = store.findIndex((s) => s.bulletinId === bulletinId);
  if (idx === -1) throw new Error('Bu bültene ait analiz snapshot bulunamadı.');
  const current = lockIfDue(store[idx]);
  if (current.isLocked) {
    throw new Error('Bültenin ilk maçı başladığı için analiz kilitlendi. Artık düzenlenemez.');
  }
  const nextMatches = current.matchesAnalysis.map((m) =>
    m.matchId === matchId ? { ...m, ...patch } : m
  );
  const updated = { ...current, matchesAnalysis: nextMatches };
  store[idx] = updated;
  return clone(updated);
}

export async function isSnapshotLocked(bulletinId) {
  const snap = await getSnapshot(bulletinId);
  return snap ? snap.isLocked : false;
}
