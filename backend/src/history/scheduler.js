// GEÇMİŞ ARŞİV + OYNANMA YÜZDESİ ZAMANLAYICISI — kullanıcı komutu OLMADAN çalışır.
// ---------------------------------------------------------------------------
// İki bağımsız döngüyü yönetir (autoRefresh scheduler'ına DOKUNMAZ):
//  1) GEÇMİŞ İÇE AKTARIM: açılışta bir tur + periyodik devam. Checkpoint'ten
//     kaldığı yerden sürer (sayfalı: her turda en çok maxRoundsPerRun hafta;
//     kaynağa aşırı yük binmez). Güncel hafta ASLA arşive alınmaz.
//  2) OYNANMA GÖZLEMİ: aktif bülten için etkin sağlayıcılardan periyodik
//     gözlem + donmadan hemen önce SON gözlem. Etkin sağlayıcı yoksa tur
//     sessizce boş döner (uydurma yüzde üretilmez).
// * Hata → üstel backoff (1→2→4… dk, üst sınır 30 dk); başarıda sıfırlanır.
// * Single-flight koruması motorların kendisinde (importInFlight/observeInFlight).
// * Test ortamında (node --test / NODE_ENV=test) OTOMATİK BAŞLAMAZ.
// * stop() tüm timer'ları temizler (graceful shutdown).
import { load, save } from '../cache.js';
import { computeFreezeAt } from '../archive/snapshotService.js';
import { getArchiveStore } from '../archive/store.js';
import { isTestEnv, refreshCurrentBulletin } from '../autoRefresh.js';
import { importOfficialHistoryTick } from './importer.js';
import { observePlayedPercentages, enabledProviders } from '../providers/playedPercentages.js';
import { observeMarketOdds, enabledOddsProviders } from '../providers/marketOdds.js';

const HISTORY_INTERVAL_MS = 6 * 3600e3;      // geçmiş taraması: 6 saatte bir devam turu
const OBSERVE_INTERVAL_MS = 15 * 60e3;       // oynanma gözlemi: 15 dk'da bir
const PRE_FREEZE_LEAD_MS = 6 * 60e3;         // donmadan ~6 dk önce son gözlem (mühür: −5 dk)
// İKİNCİ ORAN KAYNAĞI: 15 dk'lık yüzde temposuyla ÇALIŞMAZ. Her tur maç başına
// bir istek demek; kaynağın günlük kotası boşuna tüketilirse asıl gereken anda
// (günlük mühür / donma öncesi) veri GELMEZ. Bu yüzden günde ~3 kez:
// açılış + 23:55 günlük mühür + donma öncesi son tur.
const BASE_BACKOFF_MS = 60e3;
const MAX_BACKOFF_MS = 30 * 60e3;

// RADAR 4 (Oran Takibi) GÜNLÜK MÜHÜR: her gün 23:55 Europe/Istanbul'da güncel
// bülten bir kez tazelenir → o anki GERÇEK oran gözlemi arşive yazılır ve o
// günün mührü olur (kilit/freeze sonrası kayıt zaten engelli — sahte oran yok).
import { TR_OFFSET_MS } from '../time/turkiyeSaati.js';   // Türkiye kalıcı UTC+3 (tek tanım)
const DAILY_SEAL_HOUR = 23;
const DAILY_SEAL_MIN = 55;

// Bir sonraki 23:55 Europe/Istanbul anını (UTC ms) döndürür.
export function nextDailySealMs(fromMs = Date.now()) {
  const ist = new Date(fromMs + TR_OFFSET_MS);
  ist.setUTCHours(DAILY_SEAL_HOUR, DAILY_SEAL_MIN, 0, 0);
  let t = ist.getTime() - TR_OFFSET_MS;
  if (t <= fromMs) t += 24 * 3600e3;
  return t;
}

function recordStatus(key, patch) {
  const prev = load(key)?.data || {};
  try { save(key, { ...prev, ...patch }); } catch { /* durum yazılamazsa akış bozulmaz */ }
}

export function startHistoryAndObservationScheduler({
  importFn = importOfficialHistoryTick,
  observeFn = observePlayedPercentages,
  oddsObserveFn = observeMarketOdds,           // ek oran sağlayıcıları (birincil AYNEN kalır)
  archiveStore = null,
  historyIntervalMs = HISTORY_INTERVAL_MS,
  observeIntervalMs = OBSERVE_INTERVAL_MS,
  preFreezeLeadMs = PRE_FREEZE_LEAD_MS,
  dailySealFn = refreshCurrentBulletin,        // 23:55 günlük oran mührü (tazele)
  env = process.env,
  log = console.log,
} = {}) {
  if (isTestEnv(env)) return { started: false, reason: 'test-env', stop() {} };

  const timers = new Set();
  let stopped = false;
  let histFails = 0, obsFails = 0;
  let preFreezeKey = null;
  let oddsPreFreezeKey = null;

  const setT = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    if (typeof t.unref === 'function') t.unref();
    timers.add(t);
    return t;
  };
  const backoff = (streak) => Math.min(BASE_BACKOFF_MS * 2 ** (Math.max(1, streak) - 1), MAX_BACKOFF_MS);

  // --- 1) GEÇMİŞ İÇE AKTARIM DÖNGÜSÜ -------------------------------------
  const runHistory = async (trigger) => {
    if (stopped) return;
    try {
      const currentRoundId = load('bulletin')?.data?.roundId ?? null; // güncel hafta arşive girmez
      const res = await importFn({ currentRoundId, log });
      if (res?.ok === false) throw new Error(res.error || 'bilinmeyen hata');
      histFails = 0;
      recordStatus('historyImportStatus', {
        lastTrigger: trigger, lastRunAt: new Date().toISOString(), ok: true,
        imported: res?.imported ?? 0, totalDone: res?.totalDone ?? null,
        conflicts: res?.conflicts ?? 0, corrections: res?.correctionsFound ?? 0, error: null,
        // Defter–veri mutabakatı: kaç "alındı" kaydı gerçekte eksikti.
        reconciledPhantoms: res?.reconciledPhantoms ?? 0, reconciled: res?.reconciled ?? false,
      });
      // Devam gerekiyorsa (tam kota işlendi = arşivde daha hafta olabilir) kısa
      // aralıkla sürdür; bitti sayılırsa normal periyoda dön.
      // Mutabakatta hayalet kayıt düştüyse eksikler yeniden alınacak demektir →
      // kullanıcıdan komut beklemeden kısa aralıkla devam edilir.
      if (!stopped && (((res?.processed ?? 0) > 0 && res?.imported > 0) || (res?.reconciledPhantoms ?? 0) > 0)) {
        setT(() => runHistory('continue'), 5 * 60e3);
      }
    } catch (e) {
      histFails += 1;
      const wait = backoff(histFails);
      recordStatus('historyImportStatus', { lastTrigger: trigger, ok: false, error: e.message, failStreak: histFails });
      log(`[history] tur hatası (${trigger}) — ${Math.round(wait / 1000)} sn sonra tekrar (backoff).`);
      if (!stopped) setT(() => runHistory('retry'), wait);
    }
  };

  // --- 2) OYNANMA GÖZLEM DÖNGÜSÜ ------------------------------------------
  const runObserve = async (trigger) => {
    if (stopped) return;
    try {
      const data = load('bulletin')?.data;
      const providers = enabledProviders();
      if (!providers.length) {
        // Etkin sağlayıcı yok → dürüst boş durum; uydurma gözlem üretilmez.
        recordStatus('playedObserveStatus', {
          lastTrigger: trigger, lastRunAt: new Date().toISOString(),
          ok: true, providers: 0, note: 'Etkin oynanma yüzdesi sağlayıcısı yok.',
        });
        return;
      }
      const store = archiveStore || getArchiveStore();
      const res = await observeFn({ bulletinData: data, store, log });
      obsFails = 0;
      // DÜRÜST SAYAÇLAR: yazılan/değişmeyen/geçersiz + sağlayıcı bazında
      // fetched/written/hata/eşleşmeyen. Sağlayıcı hatası izole yutulmaz —
      // teşhis için durum kaydına da yazılır (gizli veri içermez).
      const providerDetail = Object.fromEntries(
        Object.entries(res?.providers || {}).map(([id, s]) => [id, {
          fetched: s.fetched ?? 0, written: s.written ?? 0,
          error: s.errors ?? null,
          unmatched: Array.isArray(s.unmatched) ? s.unmatched.length : 0,
        }]),
      );
      recordStatus('playedObserveStatus', {
        lastTrigger: trigger, lastRunAt: new Date().toISOString(), ok: true,
        written: res?.written ?? 0,
        unchanged: res?.duplicates ?? 0,          // değişmeyen gözlemlerin dürüst ayrımı
        duplicates: res?.duplicates ?? 0,
        invalid: res?.invalid ?? 0,
        unmatched: res?.unmatched ?? 0,
        postLock: res?.postLock ?? 0,
        providers: providers.length,
        providerDetail,
        note: null,                               // eski "sağlayıcı yok" notu temizlenir
        error: null,
      });
      schedulePreFreezeObservation(data);
    } catch (e) {
      obsFails += 1;
      const wait = backoff(obsFails);
      recordStatus('playedObserveStatus', { lastTrigger: trigger, ok: false, error: e.message, failStreak: obsFails });
      if (!stopped) setT(() => runObserve('retry'), wait);
    }
  };

  // --- 2b) EK ORAN SAĞLAYICI GÖZLEM DÖNGÜSÜ --------------------------------
  // 27 Temmuz 2026: KAYITLI SAĞLAYICI YOK → bu döngü her turda "sağlayıcı yok"
  // yazıp çıkar, tek ağ isteği yapmaz. Çerçeve kasıtlı duruyor.
  // BİRİNCİL KAYNAK BU DÖNGÜDE DEĞİLDİR: o, refresh akışında (snapshotService)
  // eskisi gibi yazılmaya devam eder. Burada hata olsa bile birincil etkilenmez.
  // Retry YOK: sebep durum kaydına yazılır, sıradaki planlı tur dener.
  const runOddsObserve = async (trigger) => {
    if (stopped) return;
    try {
      const data = load('bulletin')?.data;
      const providers = enabledOddsProviders();
      if (!providers.length) {
        recordStatus('marketOddsObserveStatus', {
          lastTrigger: trigger, lastRunAt: new Date().toISOString(),
          ok: true, providers: 0, note: 'Kayıtlı ek oran sağlayıcısı yok (Radar 4 birincil kaynaktan beslenir).',
        });
        return;
      }
      const store = archiveStore || getArchiveStore();
      const res = await oddsObserveFn({ bulletinData: data, store, log });
      const providerDetail = Object.fromEntries(
        Object.entries(res?.providers || {}).map(([id, s]) => [id, {
          fetched: s.fetched ?? 0, written: s.written ?? 0,
          unchanged: s.duplicates ?? 0, invalid: s.invalid ?? 0,
          calls: s.calls ?? 0,
          error: s.errors ?? null,
          unmatched: Array.isArray(s.unmatched) ? s.unmatched.length : 0,
          // EKSİĞİN SEBEBİ saklanır (uydurma oran yerine dürüst gerekçe).
          unmatchedReasons: Array.isArray(s.unmatched)
            ? [...new Set(s.unmatched.map((u) => u.reason))] : [],
        }]),
      );
      recordStatus('marketOddsObserveStatus', {
        lastTrigger: trigger, lastRunAt: new Date().toISOString(), ok: true,
        skipped: res?.skipped ?? false, skipReason: res?.reason ?? null,
        written: res?.written ?? 0, unchanged: res?.duplicates ?? 0,
        invalid: res?.invalid ?? 0, unmatched: res?.unmatched ?? 0,
        calls: res?.calls ?? 0,
        providers: providers.length, providerDetail, note: null, error: null,
      });
      scheduleOddsPreFreeze(data);   // her turda donma öncesi son tur planı tazelenir
    } catch (e) {
      recordStatus('marketOddsObserveStatus', {
        lastTrigger: trigger, lastRunAt: new Date().toISOString(), ok: false, error: e.message,
      });
      log(`[oran] ek sağlayıcı turu hatası (${trigger}): ${e.message}`);
    }
  };

  // Donmadan ~6 dk önce SON güvenli gözlem (mühür −5 dk'dan önce biter).
  const schedulePreFreezeObservation = (data) => {
    if (!data || data.pending) return;
    const freezeAt = computeFreezeAt(data.matches || []);
    if (!freezeAt) return;
    const key = `${data.roundId}@${freezeAt}`;
    if (preFreezeKey === key) return;
    const at = new Date(freezeAt).getTime() - preFreezeLeadMs;
    const delay = at - Date.now();
    if (delay <= 0) return;
    preFreezeKey = key;
    log(`[oynanma] donma öncesi SON gözlem planlandı: ${new Date(at).toISOString()} (freeze=${freezeAt})`);
    setT(() => runObserve('pre-freeze'), delay);
  };

  // İkinci oran kaynağı için de donma öncesi SON tur (ayrı anahtar: yüzde turu
  // planlanmasa bile oran turu planlanabilsin).
  const scheduleOddsPreFreeze = (data) => {
    if (!data || data.pending) return;
    const freezeAt = computeFreezeAt(data.matches || []);
    if (!freezeAt) return;
    const key = `${data.roundId}@${freezeAt}`;
    if (oddsPreFreezeKey === key) return;
    const delay = new Date(freezeAt).getTime() - preFreezeLeadMs - Date.now();
    if (delay <= 0) return;
    oddsPreFreezeKey = key;
    setT(() => runOddsObserve('pre-freeze'), delay);
  };

  // --- 3) GÜNLÜK MÜHÜR (Radar 4 oran + Radar 3 yüzde) — her gün 23:55 İstanbul -
  // (a) Güncel bülteni tazeler → o anki GERÇEK oran gözlemi arşive yazılır
  //     (recordObservationsFromData; freeze/kilit sonrası zaten kayıt yok).
  // (b) Oynanma yüzdesi gözlemini (runObserve) bir kez çalıştırır → o günün
  //     yüzde mührü de 23:55'e yakın olur (sağlayıcı yoksa sessizce boş döner).
  // Kendini yeniden planlar; hata olursa akış bozulmaz (ertesi gün tekrar dener).
  const runDailySeal = async () => {
    if (stopped) return;
    try {
      try { await dailySealFn({ trigger: 'daily-odds-seal' }); }             // (a) ORAN
      catch (e) { log(`[mühür] günlük oran mührü hatası: ${e.message}`); }
      try { await runObserve('daily-seal'); }                                // (b) YÜZDE
      catch (e) { log(`[mühür] günlük yüzde mührü hatası: ${e.message}`); }
      // (c) İKİNCİ ORAN KAYNAĞI — birincil (a) ile AYNI güne, ayrı satır olarak.
      // Biri hata verirse diğeri yine de mühürlenir (kaynak izolasyonu).
      try { await runOddsObserve('daily-seal'); }
      catch (e) { log(`[mühür] ikinci oran kaynağı mühür hatası: ${e.message}`); }
      recordStatus('dailyOddsSealStatus', {
        lastRunAt: new Date().toISOString(), ok: true, error: null,
        nextAt: new Date(nextDailySealMs()).toISOString(),
      });
    } finally {
      if (!stopped) setT(runDailySeal, Math.max(1000, nextDailySealMs() - Date.now()));
    }
  };

  // AÇILIŞ: geçmiş taraması hemen (kaldığı yerden), gözlem kısa gecikmeyle
  // (bülten cache'inin açılış refresh'iyle dolmasına fırsat tanır).
  log('[history] geçmiş arşiv + oynanma gözlem zamanlayıcısı başladı.');
  setT(() => runHistory('startup'), 15e3);
  setT(() => runObserve('startup'), 45e3);
  setT(runDailySeal, Math.max(1000, nextDailySealMs() - Date.now())); // 23:55 günlük oran mührü
  // İkinci oran kaynağı: açılışta BİR tur + donma öncesi son tur planı.
  // (Periyodik yüzde döngüsüne BİLEREK bağlanmaz — kota koruması.)
  setT(() => runOddsObserve('startup'), 75e3);

  const hTimer = setInterval(() => runHistory('interval'), historyIntervalMs);
  const oTimer = setInterval(() => runObserve('interval'), observeIntervalMs);
  if (hTimer.unref) hTimer.unref();
  if (oTimer.unref) oTimer.unref();

  return {
    started: true,
    stop() {
      stopped = true;
      clearInterval(hTimer);
      clearInterval(oTimer);
      for (const t of timers) clearTimeout(t);
      timers.clear();
    },
  };
}
