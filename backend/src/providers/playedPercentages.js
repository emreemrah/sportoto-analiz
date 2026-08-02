// OYNANMA YÜZDESİ SAĞLAYICI ÇERÇEVESİ — adaptörler + doğrulama + gözlem semantiği.
// ---------------------------------------------------------------------------
// * Her sağlayıcı AYRI tutulur (Bilyoner ile Misli ham veride karışmaz).
// * Yüzde toplamı doğrulanır (yuvarlama toleransı ±2, bozuk veri REDDEDİLİR).
// * OYNANMA YÜZDESİ ≠ BAHİS ORANI — oran asla yüzde olarak sunulmaz.
// * Açılış dürüstlüğü: sistem haftaya geç başladıysa ilk gözlem 'opening'
//   SAYILMAZ → first_observed_late işaretlenir.
// * KAPANIŞ/MÜHÜR: ilk maçın başlamasından 5 dk öncesi son geçerli veridir;
//   sonrası yalnız 'post_lock_research' olarak saklanabilir — tahmine,
//   snapshot'a, karneye ve DNA 'kapanış' alanına GİREMEZ.
// * Değer değişmediyse tekrar satır üretilmez (gereksiz zaman serisi şişmez).
import { createHash } from 'node:crypto';
import { bilyonerAdapter } from './bilyoner.js';
import { nesineAdapter } from './nesine.js';
import { misliAdapter } from './misli.js';
// Gün anahtarı (Europe/Istanbul) tek yerden gelir — iki ayrı tanım zamanla
// birbirinden ayrışıp gün sınırlarını bozmasın.
import { dayKeyOf } from '../radar/playedDnaArchive.js';
import { load, save } from '../cache.js';
import { denenebilir, durumuGuncelle } from './saglayiciTempo.js';

export const PCT_METHODOLOGY_VERSION = 'played-pct-1.0.0';
export const OPENING_WINDOW_MS = 12 * 3600e3;   // yayından ≤12 sa içindeki ilk gözlem 'opening'
export const SUM_TOLERANCE = 2;                  // %98–102 kabul

// ---------------------------------------------------------------------------
// ADAPTÖR KAYIT SİSTEMİ
// Adaptör sözleşmesi: { id, name, enabled, note, fetchPercentages(bulletinData)
//   → [{ matchNo, pct: {'1':n, X:n, '2':n}, sourceMatchId?, raw? }] }
// ---------------------------------------------------------------------------
const registry = new Map();

export function registerProvider(adapter) {
  if (!adapter?.id) throw new Error('Sağlayıcı id zorunlu.');
  registry.set(adapter.id, adapter);
}
export function listProviders() { return [...registry.values()]; }
export function enabledProviders() { return listProviders().filter((p) => p.enabled === true); }
export function _clearProvidersForTests() { registry.clear(); }

// BİLYONER — GERÇEK açık/oturumsuz kaynak DOĞRULANDI (22 Tem 2026):
//   /api/sto/programs/active + /api/sto/playratio?gcNo=<gcNo> (credentials:'omit'
//   ile HTTP 200; çerez/oturum gerekmez). Adaptör gerçek parser + bülten
//   eşleştirme + doğrulama ile bilyoner.js'te; burada yalnız KAYIT edilir.
registerProvider(bilyonerAdapter);

// NESİNE — GERÇEK açık/anonim kaynak DOĞRULANDI (22 Tem 2026):
//   GET https://st.nesine.com/v2/Program (kimlik/oturum/çerez YOK, HTTP 200).
//   d.matches[].percentage1/0/2 → 1/X/2. Adaptör + bülten eşleştirme nesine.js'te.
registerProvider(nesineAdapter);

// MİSLİ — GERÇEK açık/anonim kaynak DOĞRULANDI (23 Tem 2026):
//   GET https://apivx.misli.com/api/web/v1/sportoto/active (UA zorunlu, auth YOK).
//   Tek çağrıda program + playRatio (selection name 0=X/1=1/2=2). Adaptör misli.js.
registerProvider(misliAdapter);

// ---------------------------------------------------------------------------
// DOĞRULAMA + SEMANTİK (saf, test edilebilir)
// ---------------------------------------------------------------------------
export function validatePercentages(pct) {
  if (!pct) return { valid: false, reason: 'missing' };
  const v1 = Number(pct['1']), vx = Number(pct.X), v2 = Number(pct['2']);
  if (![v1, vx, v2].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) {
    return { valid: false, reason: 'out_of_range' };
  }
  const sum = v1 + vx + v2;
  if (Math.abs(sum - 100) > SUM_TOLERANCE) return { valid: false, reason: `bad_sum(${Math.round(sum)})` };
  return { valid: true, pct: { '1': v1, X: vx, '2': v2 } };
}

// Gözlem türü: opening / regular / pre_freeze / post_lock_research (+ geç ilk gözlem).
export function classifyObservationKind({ observedAtMs, publishedAtMs, freezeAtMs, isFirstForProviderMatch }) {
  if (freezeAtMs != null && observedAtMs > freezeAtMs) {
    return { kind: 'post_lock_research', usableForPrediction: false, firstObservedLate: false };
  }
  if (isFirstForProviderMatch) {
    const late = publishedAtMs != null && observedAtMs - publishedAtMs > OPENING_WINDOW_MS;
    return {
      kind: late ? 'regular' : 'opening',
      usableForPrediction: true,
      firstObservedLate: late,                     // geç başlangıç → sahte 'opening' YOK
    };
  }
  if (freezeAtMs != null && freezeAtMs - observedAtMs <= 10 * 60e3) {
    return { kind: 'pre_freeze', usableForPrediction: true, firstObservedLate: false };
  }
  return { kind: 'regular', usableForPrediction: true, firstObservedLate: false };
}

export const pctHash = (providerId, matchKey, pct) =>
  createHash('sha256').update(`${providerId}|${matchKey}|${pct['1']}|${pct.X}|${pct['2']}`).digest('hex');

// Aynı değer tekrarı mı? (son gözlemle birebir aynı yüzdeler → yazma)
export function isDuplicateOfLast(lastObs, pct) {
  const lp = lastObs?.playedPct;
  return !!lp && Number(lp['1']) === pct['1'] && Number(lp.X) === pct.X && Number(lp['2']) === pct['2'];
}

// GÜN BAŞINA EN AZ BİR KAYIT.
// Tekrar filtresi yalnız AYNI GÜN İÇİNDE uygulanır. Yüzde günlerce değişmese
// bile her günün İLK gözlemi yazılır; aksi hâlde "değişmedi" diye o güne hiç
// satır düşmez ve Oynanma DNA'sı o günü "kayıt yok" sayar — oysa değerin sabit
// kalması da gerçek bir bilgidir. Gün içindeki tekrarlar yine yazılmaz.
export function shouldSkipAsDuplicate(lastObs, pct, nowMs, dayKeyOf) {
  if (!isDuplicateOfLast(lastObs, pct)) return false;
  const lastMs = lastObs?.observedAt ? new Date(lastObs.observedAt).getTime() : NaN;
  if (!Number.isFinite(lastMs)) return false;
  return dayKeyOf(lastMs) === dayKeyOf(nowMs);        // yalnız aynı günse atla
}

// ---------------------------------------------------------------------------
// GÖZLEM TURU — aktif bülten için tüm ETKİN sağlayıcılardan tek geçiş.
// Sağlayıcı izolasyonu: biri çökerse diğerleri çalışır. store: arşiv deposu
// (bulletin_data_observations). Dönen özet operasyonel log içindir.
// ---------------------------------------------------------------------------
let observeInFlight = false;

export async function observePlayedPercentages({
  bulletinData, store, now = Date.now(),
  providers = enabledProviders(), log = console.log,
  // TEMPO DURUMU — varsayılan: kalıcı cache (üretim davranışı).
  // Bir nesne verilirse BELLEKTE kullanılır ve diske YAZILMAZ. Testler bunu
  // kullanır: tempo durumu paylaşılan bir dosyada tutulduğu için, bir testin
  // yazdığı bekleme süresi başka bir testi sessizce atlatabiliyordu.
  tempoDurumu: tempoDisaridan = null,
} = {}) {
  if (observeInFlight) return { skipped: true, reason: 'in-flight' };
  if (!bulletinData || bulletinData.pending || !bulletinData.matches?.length) {
    return { skipped: true, reason: 'no-bulletin' };
  }
  observeInFlight = true;
  try {
    const bulletinId = String(bulletinData.roundId);
    const kickoffs = bulletinData.matches.map((m) => new Date(m.date).getTime()).filter(Number.isFinite);
    const freezeAtMs = kickoffs.length ? Math.min(...kickoffs) - 5 * 60e3 : null;
    const publishedAtMs = bulletinData.publishedAt ? new Date(bulletinData.publishedAt).getTime()
      : bulletinData.updatedAt ? new Date(bulletinData.updatedAt).getTime() : null;

    const summary = { providers: {}, written: 0, duplicates: 0, invalid: 0, postLock: 0 };
    // SAĞLAYICI TEMPOSU — bkz. saglayiciTempo.js. Hız sınırı olan kaynak
    // 15 dakikalık tempoyla denendiğinde engel sürekli tazeleniyor ve kaynak
    // HİÇ açılmıyor. Beklemesi dolmayan kaynak bu turda atlanır.
    const tempoKalici = tempoDisaridan == null;
    let tempoDurumu = tempoKalici ? (load('saglayiciTempo')?.data || {}) : { ...tempoDisaridan };
    for (const p of providers) {
      const s = { fetched: 0, written: 0, errors: null };
      summary.providers[p.id] = s;
      if (!denenebilir(p.id, tempoDurumu, now)) {
        s.atlandi = 'tempo';                       // hata DEĞİL: bilinçli bekleme
        continue;
      }
      try {
        const rows = await p.fetchPercentages(bulletinData);
        tempoDurumu = durumuGuncelle(p.id, tempoDurumu, true, now);
        // EŞLEŞMEYEN/BELİRSİZ eventler: teknik trace (kullanıcıya gösterilmez).
        // Yüzdeleri hiçbir maça bağlanmaz — "başka maçın yüzdesini verme" kuralı.
        if (Array.isArray(rows) && rows._unmatched?.length) {
          s.unmatched = rows._unmatched;
          summary.unmatched = (summary.unmatched || 0) + rows._unmatched.length;
        }
        const existing = await store.listObservations(bulletinId).catch(() => []);
        for (const row of rows || []) {
          const v = validatePercentages(row.pct);
          if (!v.valid) { summary.invalid += 1; continue; }        // bozuk veri REDDEDİLİR
          s.fetched += 1;
          const matchKey = String(row.matchKey ?? row.matchNo);
          const prior = existing.filter((o) => o.source === p.id && String(o.matchId) === matchKey && o.playedPct);
          const last = prior.sort((a, b) => String(b.observedAt).localeCompare(String(a.observedAt)))[0];
          const cls = classifyObservationKind({
            observedAtMs: now, publishedAtMs, freezeAtMs, isFirstForProviderMatch: prior.length === 0,
          });
          if (cls.kind === 'post_lock_research') summary.postLock += 1;
          if (cls.kind !== 'post_lock_research' && shouldSkipAsDuplicate(last, v.pct, now, dayKeyOf)) {
            summary.duplicates += 1; continue;         // aynı gün içinde değişmedi → satır üretme
          }
          await store.addObservations(bulletinId, [{
            matchId: matchKey,
            source: p.id,
            observedAt: new Date(now).toISOString(),
            playedPct: v.pct,
            kind: cls.kind,
            usableForPrediction: cls.usableForPrediction,
            firstObservedLate: cls.firstObservedLate,
            // Sürücü bağımsız taşınabilirlik: semantik + eşleştirme kanıtı raw'da.
            raw: {
              kind: cls.kind, usableForPrediction: cls.usableForPrediction,
              firstObservedLate: cls.firstObservedLate,
              sourceMatchId: row.sourceMatchId ?? null,
              providerHome: row.providerHome ?? null, providerAway: row.providerAway ?? null,
              position: row.position ?? null,
              matchedBy: row.matchedBy ?? null, matchConfidence: row.matchConfidence ?? null,
              sourceType: row.sourceType ?? null, parserVersion: row.parserVersion ?? null,
              rawHash: row.rawHash ?? pctHash(p.id, matchKey, v.pct),
              methodologyVersion: PCT_METHODOLOGY_VERSION,
            },
          }]);
          s.written += 1; summary.written += 1;
        }
      } catch (e) {
        s.errors = e.message;                                       // izolasyon: diğerleri devam
        // Başarısızlık temposu uzatır (geri çekilme): kaynak kapalıysa
        // dakika başı dövülmez, açılırsa makul sürede geri dönülür.
        tempoDurumu = durumuGuncelle(p.id, tempoDurumu, false, now);
        log(`[oynanma] sağlayıcı ${p.id} hatası (izole): ${e.message}`);
      }
    }
    if (tempoKalici) { try { save('saglayiciTempo', tempoDurumu); } catch { /* kayıt olmasa da akış sürsün */ } }
    return { ok: true, ...summary };
  } finally {
    observeInFlight = false;
  }
}

// ---------------------------------------------------------------------------
// AÇILIŞ + MÜHÜR ÖZETİ — bir maç+sağlayıcı zaman serisinden dürüst özet.
// ---------------------------------------------------------------------------
export function summarizeSeries(observations, { freezeAtMs = null } = {}) {
  const usable = (observations || [])
    .filter((o) => o.playedPct && o.kind !== 'post_lock_research'
      && (freezeAtMs == null || new Date(o.observedAt).getTime() <= freezeAtMs))
    .sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)));
  if (!usable.length) return null;
  const first = usable[0], lastObs = usable[usable.length - 1];
  const opening = first.kind === 'opening' ? first : null;         // geç ilk gözlem opening SAYILMAZ
  const delta = opening ? {
    '1': Math.round((lastObs.playedPct['1'] - opening.playedPct['1']) * 10) / 10,
    X: Math.round((lastObs.playedPct.X - opening.playedPct.X) * 10) / 10,
    '2': Math.round((lastObs.playedPct['2'] - opening.playedPct['2']) * 10) / 10,
  } : null;
  return {
    opening: opening ? { pct: opening.playedPct, at: opening.observedAt } : null,
    openingMissingReason: opening ? null : (first.firstObservedLate ? 'first_observed_late' : 'no_opening_observation'),
    freeze: { pct: lastObs.playedPct, at: lastObs.observedAt, kind: lastObs.kind },
    delta,
    observationCount: usable.length,
  };
}
