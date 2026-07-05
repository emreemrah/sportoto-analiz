// app/src/services/bulletinHistoryService.js
// Bülten geçmişi servis katmanı. Şimdilik mock data üzerinde çalışır; backend'e
// /api/bulletin-history gibi bir uç eklendiğinde bu dosyanın SADECE içi
// değişir — çağıran hook/ekranlar (Promise<Bulletin[]> / Promise<Bulletin>)
// aynı kalır.
//
// Kural: bülten ilk maçı başlayana kadar 'active', başladığı an 'locked' olur;
// tüm maçları sonuçlanınca 'completed' olur. Bu geçiş burada "lazy" olarak,
// her okumada zaman damgasına bakılarak uygulanır (gerçek backend'de bu muhtemelen
// bir cron/worker olurdu).

import { mockBulletins } from '../data/mockBulletins';
import { mockAnalysisSnapshots } from '../data/mockAnalysisSnapshots';
import { isBulletinFullyResolved } from '../data/mockResults';
import { BULLETIN_STATUS, MATCH_STATUS, isPastFirstMatch } from '../types/bulletin';

// Basit derin kopya (mock store'u dışarıya referansla sızdırmamak için).
const clone = (x) => JSON.parse(JSON.stringify(x));

let store = mockBulletins.map(clone);

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

// Tüm geçmiş: en güncel tarih en üstte.
export async function listBulletins() {
  store = store.map(deriveStatus);
  return store
    .map(attachResultSummary)
    .map((b) => ({ ...b, _finishedCount: finishedCount(b) }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getBulletinById(id) {
  store = store.map(deriveStatus);
  const found = store.find((b) => b.id === id);
  if (!found) return null;
  return { ...attachResultSummary(found), _finishedCount: finishedCount(found) };
}

// Bir maçın (tek) canlı/güncel durumunu bültenden bağımsız sorgulamak için.
export async function getMatchById(bulletinId, matchId) {
  const bulletin = await getBulletinById(bulletinId);
  return bulletin?.matches.find((m) => m.id === matchId) || null;
}

// ----------------------------------------------------------------------
// KİLİTLİ BÜLTEN KORUMASI
//
// Bir bültenin ilk maçı başladığı andan itibaren (status: locked/completed/
// cancelled) o bültenin maç listesi TARİHSEL bir kayıttır: kimlik alanları
// (orderNo, code, homeTeam, awayTeam, league, startTime) bir daha değişmez,
// maç eklenmez/çıkarılmaz. Sadece maçın SONUÇ alanları (status,
// halfTimeScore, fullTimeScore, result1x2) güncellenebilir — örn. canlı bir
// maçın skoru ilerledikçe veya maç bitip resmi sonuç geldiğinde.
//
// Bugün için canlı bir dış kaynak/API entegrasyonu YOK (mock veri statik).
// Ama ileride bülteni gerçek veriyle senkronize edecek her kodun, bu
// fonksiyon DIŞINDA asla `bulletin.matches = ...` şeklinde doğrudan atama
// yapmaması gerekir — aksi halde kilitli bir haftanın maç listesi sessizce
// ezilebilir. Bu yüzden bu tek giriş noktası, henüz hiçbir çağıranı olmasa
// bile, kuralı kod seviyesinde zorunlu kılmak için burada.
// ------------------------------------------------------------------------

const RESULT_ONLY_FIELDS = ['status', 'halfTimeScore', 'fullTimeScore', 'result1x2'];
const IDENTITY_FIELDS = ['orderNo', 'code', 'league', 'startTime'];

// bulletinId -> CorrectionLogEntry[] — kilitlendikten sonra reddedilen her
// dış-kaynak güncelleme denemesi burada saklanır (sessizce yok sayılmaz).
let correctionLogs = {};

// Bir bülten SADECE status alanına göre değil, ilk maçın gerçek zamanına göre
// de kilitli sayılmalı: status henüz 'active'/'draft' olsa bile
// firstMatchStartAt geçmişteyse maç listesi yine donmuş kabul edilir. Bu
// kontrol, applyIncomingMatchUpdate içindeki `store.map(deriveStatus)`
// ön-adımının çağrılmış olmasına bağımlı DEĞİLDİR — çağrı sırası değişse,
// unutulsa veya bu fonksiyon başka bir yerden bağımsız çağrılsa bile aynı
// doğru sonucu verir (savunmacı/kendi kendine yeten kontrol).
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

// Dış kaynaktan (gelecekteki gerçek API) gelen maç verisini bültene UYGULAMANIN
// TEK güvenli yolu. incomingMatches: Match[] (mevcut Match şekliyle aynı).
// Döner: { applied: string[] matchId, ignored: string[] insan-okunur sebep }
export async function applyIncomingMatchUpdate(bulletinId, incomingMatches) {
  store = store.map(deriveStatus);
  const idx = store.findIndex((b) => b.id === bulletinId);
  if (idx === -1) {
    return { applied: [], ignored: [`Bülten bulunamadı: ${bulletinId}`] };
  }
  const current = store[idx];

  if (!isLockedForMatches(current)) {
    // İlk maç henüz başlamadı (draft/active): tam güncelleme serbest.
    store[idx] = { ...current, matches: clone(incomingMatches) };
    return { applied: incomingMatches.map((m) => m.id), ignored: [] };
  }

  // Kilitli / tamamlanmış / iptal: maç listesi donmuş. Sadece eşleşen
  // maçların sonuç alanları güncellenir; kimlik değişikliği veya yeni maç
  // eklenmesi reddedilip correctionLog'a yazılır. Liste uzunluğu, sırası ve
  // hiçbir maçın kimliği asla değişmez.
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

  // current.matches referansı hiç değişmedi (eklenmedi/çıkarılmadı/yer
  // değiştirmedi) — sadece eşleşen öğeler yerinde güncellendi.
  store[idx] = { ...current };
  return { applied, ignored };
}

export async function getCorrectionLog(bulletinId) {
  return clone(correctionLogs[bulletinId] || []);
}
