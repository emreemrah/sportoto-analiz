// OTOMATİK BÜLTEN YENİLEME SERVİSİ — kullanıcı komutu OLMADAN çalışır.
// ---------------------------------------------------------------------------
// TEK DOĞRULUK KAYNAĞI: refreshCurrentBulletin(). Hem zamanlayıcı, hem
// /api/refresh ucu, hem CLI (scripts/run-refresh.js) bunu çağırır.
// * SINGLE-FLIGHT: aynı anda iki refresh ÇALIŞAMAZ — ikinci çağrı süren işin
//   sonucunu bekler (provider'a çifte istek gitmez).
// * BACKOFF: hata olursa üstel geri çekilme ile kontrollü tekrar (1→2→4… dk,
//   üst sınır 30 dk); başarıda sıfırlanır.
// * FREEZE-FARKINDALI: her başarılı yenilemeden sonra, ilk maçtan 5 dk önceki
//   donma anından ~10 dk önce SON GÜVENLİ yenileme planlanır. Donma SONRASI
//   yenilemeler mühürlü snapshot'ı DEĞİŞTİREMEZ (refresh içindeki kilit +
//   arşiv idempotency zaten korur; buradan ayrıca zorlanmaz).
// * ÇOKLU INSTANCE: kalıcı arşiv upsert'leri ve freeze kilidi idempotent —
//   iki instance aynı bülten için çifte kayıt üretmez.
// * TEST ORTAMI: node --test / NODE_ENV=test altında scheduler OTOMATİK BAŞLAMAZ.
// * Durum kaydı cache'e yazılır (autoRefreshStatus) — hangi tetikleyicinin
//   (startup/interval/pre-freeze/retry/manual) çalıştığı kanıtlanabilir.
import { load, save } from './cache.js';
import { refreshAll } from './refresh.js';
import { computeFreezeAt } from './archive/snapshotService.js';
import { config } from './config.js';

let inFlight = null;                 // süren refresh promise'i (single-flight)
let failStreak = 0;                  // ardışık hata sayısı (durum kaydı için)
let refreshRunner = refreshAll;      // testlerde enjekte edilebilir motor

export function _setRefreshRunnerForTests(fn) { refreshRunner = fn ?? refreshAll; }

const BASE_BACKOFF_MS = 60 * 1000;           // 1 dk
const MAX_BACKOFF_MS = 30 * 60 * 1000;       // 30 dk
const MIN_GAP_MS = 15 * 60 * 1000;           // aralıklı tetikte gereksiz tekrar koruması
const PRE_FREEZE_LEAD_MS = 10 * 60 * 1000;   // donmadan ~10 dk önce son güvenli yenileme

function recordStatus(patch) {
  const prev = load('autoRefreshStatus')?.data || {};
  const next = { ...prev, ...patch };
  try { save('autoRefreshStatus', next); } catch { /* durum yazılamazsa akış bozulmaz */ }
  return next;
}

// ---------------------------------------------------------------------------
// TEK DOĞRULUK KAYNAĞI — kontrollü, kilitli, kayıtlı yenileme.
// ---------------------------------------------------------------------------
export async function refreshCurrentBulletin({ trigger = 'manual' } = {}) {
  if (inFlight) {
    recordStatus({ lastCoalescedTrigger: trigger, lastCoalescedAt: new Date().toISOString() });
    return inFlight;                                   // süren işi bekle (çifte istek yok)
  }
  const startedAt = new Date().toISOString();
  recordStatus({ lastTrigger: trigger, startedAt, state: 'running' });
  inFlight = (async () => {
    try {
      const data = await refreshRunner();
      failStreak = 0;
      recordStatus({
        state: 'idle', ok: true, finishedAt: new Date().toISOString(),
        roundId: data?.roundId ?? null, matchedCount: data?.matchedCount ?? null,
        matchCount: data?.matchCount ?? null, error: null, failStreak: 0,
      });
      return { ok: true, data, trigger };
    } catch (e) {
      failStreak += 1;
      recordStatus({ state: 'idle', ok: false, finishedAt: new Date().toISOString(), error: e.message, failStreak });
      return { ok: false, error: e.message, trigger };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function currentBackoffMs({ base = BASE_BACKOFF_MS, max = MAX_BACKOFF_MS, streak = failStreak } = {}) {
  if (streak <= 0) return 0;
  return Math.min(base * 2 ** (streak - 1), max);
}

// Test ortamı algısı: node --test (NODE_TEST_CONTEXT) veya NODE_ENV=test.
export function isTestEnv(env = process.env) {
  return env.NODE_ENV === 'test' || env.NODE_TEST_CONTEXT != null;
}

// ---------------------------------------------------------------------------
// ZAMANLAYICI — açılışta bir kez, sonra kontrollü aralıklarla; hata → backoff;
// freeze'den önce son güvenli yenileme. stop() bütün timer'ları temizler.
// (Testlerde refreshFn/intervalMs/minGapMs enjekte edilebilir.)
// ---------------------------------------------------------------------------
export function startAutoRefreshScheduler({
  refreshFn = refreshCurrentBulletin,
  intervalMs = Math.max(1, config.refreshHours) * 3600 * 1000,
  minGapMs = MIN_GAP_MS,
  preFreezeLeadMs = PRE_FREEZE_LEAD_MS,
  baseBackoffMs = BASE_BACKOFF_MS,
  maxBackoffMs = MAX_BACKOFF_MS,
  env = process.env,
  log = console.log,
} = {}) {
  if (isTestEnv(env)) {
    return { started: false, reason: 'test-env', stop() {} };
  }

  const timers = new Set();
  let lastSuccessAt = 0;
  let stopped = false;
  let schedFails = 0;                                   // scheduler'ın kendi backoff sayacı
  let preFreezeKey = null;                              // aynı freeze için tek plan

  const setT = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    if (typeof t.unref === 'function') t.unref();       // süreç kapanışını bloklamaz
    timers.add(t);
    return t;
  };

  const schedulePreFreeze = () => {
    const data = load('bulletin')?.data;
    if (!data || data.pending) return;
    const freezeAt = computeFreezeAt(data.matches || []);
    if (!freezeAt) return;
    const key = `${data.roundId}@${freezeAt}`;
    if (preFreezeKey === key) return;                    // zaten planlı
    const at = new Date(freezeAt).getTime() - preFreezeLeadMs;
    const delay = at - Date.now();
    if (delay <= 0) return;                              // donmaya çok az kaldı/geçti → aralıklı akış yeter
    preFreezeKey = key;
    log(`[auto-refresh] donma öncesi SON güvenli yenileme planlandı: ${new Date(at).toISOString()} (freeze=${freezeAt})`);
    setT(() => run('pre-freeze', { force: true }), delay);
  };

  const run = async (trigger, { force = false } = {}) => {
    if (stopped) return;
    if (!force && Date.now() - lastSuccessAt < minGapMs) {
      log(`[auto-refresh] atlandı (${trigger}): son başarılı yenileme çok yeni.`);
      return;
    }
    const res = await refreshFn({ trigger });
    if (stopped) return;
    if (res?.ok) {
      schedFails = 0;
      lastSuccessAt = Date.now();
      schedulePreFreeze();
    } else {
      schedFails += 1;
      const wait = currentBackoffMs({ base: baseBackoffMs, max: maxBackoffMs, streak: schedFails });
      log(`[auto-refresh] hata (${trigger}) — ${Math.round(wait / 1000)}sn sonra tekrar denenecek (üstel backoff).`);
      setT(() => run('retry', { force: true }), wait);
    }
  };

  // Açılışta BİR KEZ kontrollü yenileme (cache boşsa da, eski round'sa da,
  // günceldeyse de: en taze resmî durumla hizalanır; provider limiti tek çağrı).
  log('[auto-refresh] scheduler başladı — açılış yenilemesi tetikleniyor.');
  run('startup', { force: true });

  // Normal dönem: kontrollü aralıkla tekrar kontrol.
  const intervalTimer = setInterval(() => run('interval'), intervalMs);
  if (typeof intervalTimer.unref === 'function') intervalTimer.unref();

  return {
    started: true,
    stop() {
      stopped = true;
      clearInterval(intervalTimer);
      for (const t of timers) clearTimeout(t);
      timers.clear();
    },
  };
}
