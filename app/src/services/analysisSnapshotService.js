// app/src/services/analysisSnapshotService.js
// Maç-öncesi analiz "snapshot" servis katmanı — GERÇEK backend arşivine bağlı.
// Kritik kural artık SUNUCUDA uygulanır: bültenin ilk maçından 5 dk önce
// snapshot kilitlenir ve bir daha DEĞİŞMEZ (DB trigger + servis + API).
// Bu katman kilitli snapshot'ı YALNIZ OKUR; geçmiş bülten açıldığında güncel
// takım verisiyle yeniden hesap YAPMAZ — mühürlü payload ne diyorsa onu döner.
// Mock yalnız demo id'leri ('b27' gibi) için fallback'tir.

import { mockAnalysisSnapshots } from '../data/mockAnalysisSnapshots';
import { mockBulletins } from '../data/mockBulletins';
import { isBulletinLockable } from '../types/bulletin';
import { archiveGet } from './archiveClient';
import { mapSnapshot, indexResults, indexEvaluation } from './archiveMappers';
import { demoDataAllowed } from '../demoGate';

const clone = (x) => JSON.parse(JSON.stringify(x));
let store = mockAnalysisSnapshots.map(clone);
let bulletins = mockBulletins.map(clone);

const isArchiveId = (id) => /^\d+$/.test(String(id));

/* ------------------------------------------------------------------ */
/* GERÇEK VERİ YOLU — mühürlü snapshot + (ayrı tablodaki) resmî sonuç  */
/* ------------------------------------------------------------------ */

async function getSnapshotFromApi(bulletinId) {
  let apiSnap;
  try {
    apiSnap = await archiveGet(`/api/bulletins/${bulletinId}/snapshot`);
  } catch (e) {
    // 404 = henüz kilitlenmedi (aktif bülten) → snapshot yok; bu bir hata değil.
    return null;
  }
  // Sonuçlar/değerlendirme AYRI kayıtlardır; snapshot payload'ına yazılmaz,
  // yalnız görünümde yan yana getirilir. Alınamazsa snapshot sonuçsuz gösterilir.
  let resultsByMatchId = {};
  let evalByMatchId = {};
  try { resultsByMatchId = indexResults(await archiveGet(`/api/bulletins/${bulletinId}/results`)); } catch { resultsByMatchId = {}; }
  try { evalByMatchId = indexEvaluation(await archiveGet(`/api/bulletins/${bulletinId}/evaluation`)); } catch { evalByMatchId = {}; }
  return mapSnapshot(apiSnap, { resultsByMatchId, evalByMatchId });
}

/* ------------------------------------------------------------------ */
/* DEMO / MOCK YOLU (yalnız 'b27' gibi demo id'leri)                   */
/* ------------------------------------------------------------------ */

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

async function getSnapshotMock(bulletinId) {
  // Üretimde ÖRNEK analiz metni ekrana düşmez: uydurma yorum/başarı bilgisi
  // üretmek yerine "snapshot yok" denir (null zaten desteklenen durumdur —
  // aktif bültende de snapshot henüz kilitlenmemiş olabilir).
  if (!demoDataAllowed()) return null;
  const idx = store.findIndex((s) => s.bulletinId === bulletinId);
  if (idx === -1) return null;
  const locked = lockIfDue(store[idx]);
  store[idx] = locked;
  return { ...clone(locked), _demo: true, _source: 'mock' };
}

/* ------------------------------------------------------------------ */
/* DIŞA AÇIK API                                                       */
/* ------------------------------------------------------------------ */

export async function getSnapshot(bulletinId) {
  if (isArchiveId(bulletinId)) return getSnapshotFromApi(bulletinId);
  return getSnapshotMock(bulletinId);
}

export async function getMatchAnalysis(bulletinId, matchId) {
  const snap = await getSnapshot(bulletinId);
  return snap?.matchesAnalysis.find((m) => String(m.matchId) === String(matchId)) || null;
}

// DEĞİŞMEZLİK: gerçek arşivde kilitli snapshot İSTEMCİDEN DE, SUNUCUDAN DA
// düzenlenemez. Bu fonksiyon yalnız demo (mock) id'lerinde ve yalnız kilit
// öncesinde çalışır; arşiv id'si için her koşulda reddedilir.
export async function updateMatchAnalysis(bulletinId, matchId, patch) {
  if (isArchiveId(bulletinId)) {
    throw new Error('Mühürlü Analiz: bu bültenin snapshot’ı sunucuda kilitlidir ve hiçbir şekilde değiştirilemez.');
  }
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
