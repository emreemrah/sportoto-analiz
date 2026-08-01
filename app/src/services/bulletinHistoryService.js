// app/src/services/bulletinHistoryService.js
// Bülten geçmişi servis katmanı — GERÇEK backend arşivine bağlıdır.
// Veri kaynağı: /api/bulletins (kalıcı arşiv + değişmez snapshot motoru).
// Mock veriler YALNIZ demo/geliştirme içindir. Production veri kaynağı ASLA
// mock değildir ve ÜRETİMDE mock'a DÜŞÜLMEZ (aşağıdaki nota bak).
//
// Sözleşme korunmuştur: listBulletins(): Promise<Bulletin[]>,
// getBulletinById(id): Promise<Bulletin> — çağıran hook/ekranlar değişmez.
//
// ÜRETİMDE MOCK'A DÜŞME YASAĞI (dürüstlük kuralı):
// Arşive ulaşılamamak NORMAL bir üretim olayıdır (backend yeniden başlar,
// kullanıcı çevrimdışıdır). Eskiden bu durumda örnek bültenler dönüyordu ve
// bunların resultSummary'si UYDURMA bir systemAccuracy (% başarı oranı)
// taşıyordu. "Demo, rastgele veya uydurma kupon, maliyet, başarı oranı ve
// sonuç üretilmemeli" kuralı bunu yasaklar; DEMO bandı basmak da yetmez,
// çünkü kural sayıyı ETİKETLEMEYİ değil ÜRETMEYİ yasaklıyor. Doğru davranış
// projenin kendi ilkesidir: "Veri yoksa 'Bu veri bulunamadı' yaz." Ekranda
// zaten dürüst hata + "Tekrar dene" durumu var; artık o görünür.
// Kapının tek kaynağı src/demoGate.js'tir; burada yeniden tanımlanmadı.

import { mockBulletins } from '../data/mockBulletins';
import { mockAnalysisSnapshots } from '../data/mockAnalysisSnapshots';
import { isBulletinFullyResolved } from '../data/mockResults';
import { BULLETIN_STATUS, MATCH_STATUS, isPastFirstMatch } from '../types/bulletin';
import { archiveGet } from './archiveClient';
import { mapBulletinSummary, mapBulletinDetail } from './archiveMappers';
import { demoDataAllowed } from '../demoGate';

// Basit derin kopya (mock store'u dışarıya referansla sızdırmamak için).
const clone = (x) => JSON.parse(JSON.stringify(x));

let store = mockBulletins.map(clone);

// Gerçek arşiv id'leri sayısaldır (roundId); mock id'ler 'b27' gibidir.
const isArchiveId = (id) => /^\d+$/.test(String(id));

/* ------------------------------------------------------------------ */
/* GERÇEK VERİ YOLU (backend arşivi)                                   */
/* ------------------------------------------------------------------ */

async function listBulletinsFromApi() {
  const res = await archiveGet('/api/bulletins');
  const items = (res?.bulletins || []).map(mapBulletinSummary);
  return items.sort((a, b) => (b.roundId || 0) - (a.roundId || 0));
}

async function getBulletinFromApi(id) {
  const res = await archiveGet(`/api/bulletins/${id}`);
  return mapBulletinDetail(res);
}

/* ------------------------------------------------------------------ */
/* DEMO / FALLBACK YOLU (mock — yalnız backend'e ulaşılamadığında)     */
/* ------------------------------------------------------------------ */

function deriveStatus(bulletin) {
  const b = { ...bulletin };
  if (b.status === BULLETIN_STATUS.CANCELLED || b.status === BULLETIN_STATUS.COMPLETED) {
    return b;
  }
  if ((b.status === BULLETIN_STATUS.DRAFT || b.status === BULLETIN_STATUS.ACTIVE) && isPastFirstMatch(b)) {
    b.status = BULLETIN_STATUS.LOCKED;
    b.lockedAt = b.lockedAt || new Date().toISOString();
  }
  if (b.status === BULLETIN_STATUS.LOCKED && isBulletinFullyResolved(b.id)) {
    b.status = BULLETIN_STATUS.COMPLETED;
    b.completedAt = b.completedAt || new Date().toISOString();
  }
  return b;
}

function attachResultSummary(bulletin) {
  const snap = mockAnalysisSnapshots.find((s) => s.bulletinId === bulletin.id);
  if (!snap) return { ...bulletin, resultSummary: null };
  const resolved = snap.matchesAnalysis.filter((m) => m.resultInfo && m.resultInfo.systemCorrect !== null);
  if (!resolved.length) return { ...bulletin, resultSummary: null };
  const systemCorrect = resolved.filter((m) => m.resultInfo.systemCorrect).length;
  const systemWrong = resolved.length - systemCorrect;
  return {
    ...bulletin,
    resultSummary: {
      systemCorrect,
      systemWrong,
      systemAccuracy: Math.round((systemCorrect / resolved.length) * 100),
      resolvedCount: resolved.length,
      totalCount: bulletin.matches.length,
    },
  };
}

function finishedCount(bulletin) {
  return bulletin.matches.filter((m) => m.status === MATCH_STATUS.FINISHED).length;
}

function listBulletinsMock() {
  store = store.map(deriveStatus);
  return store
    .map(attachResultSummary)
    .map((b) => ({ ...b, _finishedCount: finishedCount(b), _demo: true, _source: 'mock' }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getBulletinMock(id) {
  store = store.map(deriveStatus);
  const found = store.find((b) => b.id === id);
  if (!found) return null;
  return { ...attachResultSummary(found), _finishedCount: finishedCount(found), _demo: true, _source: 'mock' };
}

/* ------------------------------------------------------------------ */
/* DIŞA AÇIK API — önce gerçek arşiv, ulaşılamazsa açıkça DEMO         */
/* ------------------------------------------------------------------ */

// Tüm geçmiş: en güncel en üstte. Backend arşivi esastır; arşiv BOŞSA boş
// liste döner (mock ile doldurulmaz). Arşive ULAŞILAMAZSA: üretimde hata
// yukarı verilir (ekran "Tekrar dene" gösterir), yalnız demo/geliştirmede
// örnek liste döner — her öğe _demo=true taşır ve ekran DEMO bandı basar.
export async function listBulletins() {
  try {
    return await listBulletinsFromApi();
  } catch (e) {
    if (!demoDataAllowed()) {
      // Üretim: uydurma bülten/başarı oranı ÜRETİLMEZ, hata dürüstçe taşınır.
      throw e;
    }
    console.warn('[bulletinHistory] arşiv API alınamadı, DEMO veriye düşüldü:', e?.message);
    return listBulletinsMock();
  }
}

export async function getBulletinById(id) {
  if (!isArchiveId(id)) {
    // 'b27' gibi id'ler YALNIZ demo veridir. Üretimde böyle bir id'ye
    // (eski kısayol, derin bağlantı, kalıntı durum) hiç ulaşılmamalı; ulaşılırsa
    // örnek bülten uydurmak yerine dürüstçe "bulunamadı" denir.
    if (!demoDataAllowed()) {
      throw new Error('Bu bülten arşivde bulunamadı.');
    }
    return getBulletinMock(id);
  }
  return getBulletinFromApi(id);                       // gerçek arşiv — hata dürüstçe ekrana taşınır
}

// Bir maçın (tek) durumunu bültenden bağımsız sorgulamak için.
export async function getMatchById(bulletinId, matchId) {
  const bulletin = await getBulletinById(bulletinId);
  return bulletin?.matches.find((m) => m.id === matchId) || null;
}

/* ------------------------------------------------------------------ */
/* KİLİTLİ BÜLTEN KORUMASI (mock/demo yolu için korunan eski davranış) */
/*                                                                     */
/* GERÇEK sistemde bu koruma artık BACKEND'dedir: kilitli snapshot     */
/* update/delete edilemez (DB trigger + servis katmanı), maç kimlikleri */
/* değişemez, reddedilen denemeler snapshot_audit_log'a yazılır.        */
/* Aşağıdaki fonksiyonlar demo verisi ve eski çağıranlar için durur.    */
/* ------------------------------------------------------------------ */

const RESULT_ONLY_FIELDS = ['status', 'halfTimeScore', 'fullTimeScore', 'result1x2'];
const IDENTITY_FIELDS = ['orderNo', 'code', 'league', 'startTime'];

// bulletinId -> CorrectionLogEntry[] — kilitlendikten sonra reddedilen her
// dış-kaynak güncelleme denemesi burada saklanır (sessizce yok sayılmaz).
let correctionLogs = {};

export function isLockedForMatches(bulletin, now = Date.now()) {
  if (
    bulletin.status === BULLETIN_STATUS.LOCKED ||
    bulletin.status === BULLETIN_STATUS.COMPLETED ||
    bulletin.status === BULLETIN_STATUS.CANCELLED
  ) {
    return true;
  }
  return isPastFirstMatch(bulletin, now);
}

function logCorrection(bulletinId, reason, attempted) {
  if (!correctionLogs[bulletinId]) correctionLogs[bulletinId] = [];
  correctionLogs[bulletinId].push({ at: new Date().toISOString(), reason, attempted: clone(attempted) });
}

function teamNameChanged(incoming, existing, key) {
  return incoming[key] && existing[key] && incoming[key].name !== existing[key].name;
}

// (Demo/mock deposu için) dış kaynak güncellemesini güvenle uygulayan tek yol.
export async function applyIncomingMatchUpdate(bulletinId, incomingMatches) {
  store = store.map(deriveStatus);
  const idx = store.findIndex((b) => b.id === bulletinId);
  if (idx === -1) {
    return { applied: [], ignored: [`Bülten bulunamadı: ${bulletinId}`] };
  }
  const current = store[idx];

  if (!isLockedForMatches(current)) {
    store[idx] = { ...current, matches: clone(incomingMatches) };
    return { applied: incomingMatches.map((m) => m.id), ignored: [] };
  }

  const applied = [];
  const ignored = [];
  const existingById = new Map(current.matches.map((m) => [m.id, m]));

  incomingMatches.forEach((incoming) => {
    const existing = existingById.get(incoming.id);
    if (!existing) {
      logCorrection(bulletinId, 'Kilitli bültene yeni maç eklenmeye çalışıldı, reddedildi.', incoming);
      ignored.push(`Yeni maç reddedildi (mevcut id ile eşleşmiyor): ${incoming.id || incoming.code || '?'}`);
      return;
    }
    const identityChanged =
      IDENTITY_FIELDS.some((f) => incoming[f] !== undefined && incoming[f] !== existing[f]) ||
      teamNameChanged(incoming, existing, 'homeTeam') ||
      teamNameChanged(incoming, existing, 'awayTeam');
    if (identityChanged) {
      logCorrection(bulletinId, 'Kilitli maçın kimlik alanı (sıra/kod/takım/lig/saat) değiştirilmeye çalışıldı, reddedildi.', incoming);
      ignored.push(`Kimlik değişikliği reddedildi: ${existing.id}`);
      return;
    }
    const patch = {};
    RESULT_ONLY_FIELDS.forEach((f) => {
      if (incoming[f] !== undefined) patch[f] = incoming[f];
    });
    if (Object.keys(patch).length) {
      Object.assign(existing, patch);
      applied.push(existing.id);
    }
  });

  store[idx] = { ...current };
  return { applied, ignored };
}

export async function getCorrectionLog(bulletinId) {
  return clone(correctionLogs[bulletinId] || []);
}
