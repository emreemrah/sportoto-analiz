// OTOMATİK KİLİTLEME WORKER'I
// Güvenilir + idempotent: her tick'te (varsayılan 30 sn) güncel bültenin
// freezeAt'i (ilk maç − 5 dk) geldi mi bakar; geldiyse TRANSACTION-güvenli
// freeze çağırır (ikinci snapshot imkânsız — store unique kuralı). Sunucu
// freeze anında KAPALIYSA: açılışta ilk tick eksik snapshot'ı hemen alır ve
// snapshot "late" işaretlenir (veri o anki haliyle; geriye dönük uydurma yok).
// Sonuç geçişi: 5 dakikada bir kilitli bültenlerin resmî sonuçları çekilir,
// ayrı tabloya yazılır, 15/15 olunca bülten tamamlanır + değerlendirilir.
import { load } from '../cache.js';
import { getArchiveStore } from './store.js';
import {
  registerBulletinFromData, recordObservationsFromData, freezeBulletinFromData, computeFreezeAt,
} from './snapshotService.js';
import { ingestOfficialResults, maybeCompleteAndEvaluate } from './resultsService.js';

const DEFAULT_TICK_MS = 30 * 1000;
const RESULTS_EVERY_TICKS = 10;            // 30sn × 10 = 5 dk'da bir sonuç kontrolü
const MAX_RESULT_ROUNDS_PER_PASS = 4;      // resmî API'yi yormamak için

let _timer = null;
let _running = false;
let _tickCount = 0;
let _lastFreezeError = null;

async function freezePass({ store, now, log }) {
  const data = load('bulletin')?.data;
  if (!data || data.pending || data.roundId == null) return;

  const freezeAt = computeFreezeAt(data.matches);
  if (!freezeAt) return;

  const snap = await store.getSnapshot(String(data.roundId));
  if (snap) return;                                    // zaten kilitli — hiçbir şey yapılmaz

  if (now >= new Date(freezeAt).getTime()) {
    try {
      const r = await freezeBulletinFromData(data, { store, now, trigger: 'worker' });
      if (r.frozen) _lastFreezeError = null;
    } catch (e) {
      // Hata → logla, audit'e yaz, SONRAKİ TICK'TE YENİDEN DENE (idempotent).
      if (_lastFreezeError !== e.message) {
        _lastFreezeError = e.message;
        log(`[arsiv] freeze hatası (tekrar denenecek): ${e.message}`);
        try {
          await store.appendAudit({
            bulletinId: String(data.roundId), action: 'freeze_error', actor: 'worker',
            rejected: false, reason: e.message,
          });
        } catch { /* audit hatası akışı durdurmasın */ }
      }
    }
  }
}

async function resultsPass({ store, fetchRoundResults, log }) {
  let bulletins;
  try {
    bulletins = await store.listBulletins();
  } catch (e) {
    log(`[arsiv] bülten listesi okunamadı: ${e.message}`);
    return;
  }
  const targets = bulletins
    .filter((b) => b.status === 'locked')
    .sort((a, b) => b.roundId - a.roundId)
    .slice(0, MAX_RESULT_ROUNDS_PER_PASS);
  for (const b of targets) {
    try {
      const official = await fetchRoundResults(b.roundId);
      if (official?.matches?.length) {
        await ingestOfficialResults(b.id, official.matches, { store, actor: 'worker' });
        await maybeCompleteAndEvaluate(b.id, { store });
      }
    } catch (e) {
      log(`[arsiv] sonuç geçişi hatası (bülten ${b.id}): ${e.message}`);
    }
  }
}

// Tek tick — testlerden ve açılış telafisinden de çağrılabilir.
export async function runArchiveTick({
  store = getArchiveStore(),
  now = Date.now(),
  fetchRoundResults = null,
  withResults = false,
  log = (m) => console.warn(m),
} = {}) {
  if (_running) return;                                 // üst üste binme koruması
  _running = true;
  try {
    await freezePass({ store, now, log });
    if (withResults && fetchRoundResults) {
      await resultsPass({ store, fetchRoundResults, log });
    }
  } finally {
    _running = false;
  }
}

export function startArchiveWorker({ intervalMs = DEFAULT_TICK_MS } = {}) {
  if (_timer) return _timer;
  // Resmî sonuç kaynağı lazy import edilir (test ortamında ağ bağımlılığı olmasın).
  let fetchRoundResults = null;
  const ensureFetcher = async () => {
    if (!fetchRoundResults) {
      const mod = await import('../sources/sportoto.js');
      fetchRoundResults = (roundId) => mod.getBulletinByRoundId(roundId);
    }
    return fetchRoundResults;
  };

  const tick = async () => {
    _tickCount += 1;
    const withResults = _tickCount === 1 || _tickCount % RESULTS_EVERY_TICKS === 0;
    try {
      await runArchiveTick({
        now: Date.now(),
        withResults,
        fetchRoundResults: withResults ? await ensureFetcher() : null,
      });
    } catch (e) {
      console.warn('[arsiv] worker tick hatası:', e.message);
    }
  };

  // AÇILIŞ TELAFİSİ: sunucu kapalıyken kaçan freeze/sonuç hemen ilk tick'te işlenir.
  tick();
  _timer = setInterval(tick, intervalMs);
  if (_timer.unref) _timer.unref();
  console.log(`[arsiv] worker başladı (tick ${Math.round(intervalMs / 1000)} sn · sonuç kontrolü ~${Math.round((intervalMs * RESULTS_EVERY_TICKS) / 60000)} dk).`);
  return _timer;
}

export function stopArchiveWorker() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  _tickCount = 0;
}

// REFRESH ENTEGRASYONU (KAYIT AŞAMASI) — refreshAll, cache'e YAZMADAN ÖNCE
// çağırır: bülten + maç kimlikleri + gözlem zaman serisi arşive işlenir ve
// RADAR MERKEZİ merkezî olarak BİR KEZ hesaplanır (kilitliyse önceki sonuç
// AYNEN korunur — yeniden hesap yok). Hata olursa refresh akışı BOZULMAZ.
export async function archivePreSave(data, {
  previous = null, isLocked = false, store = getArchiveStore(), now = Date.now(),
} = {}) {
  if (!data || data.pending || data.roundId == null) return { radarCenter: null };
  let radarCenter = null;
  let analysisCenter = null;
  try {
    await registerBulletinFromData(data, { store, now });
    await recordObservationsFromData(data, { store, now });
  } catch (e) {
    console.warn('[arsiv] kayıt/gözlem hatası (akış bozulmadı):', e.message);
  }
  try {
    const { prepareRadarCenter } = await import('../radar/radarService.js');
    radarCenter = await prepareRadarCenter(data, { previous, isLocked, store, now });
  } catch (e) {
    console.warn('[radar] merkezi hesap hatası (akış bozulmadı):', e.message);
  }
  try {
    // MASTER ANALİZ: 40 kriterin gölge değerlendirmesi + resmî Master Analiz.
    // Kilitliyse önceki merkezî sonuç AYNEN korunur (yeniden hesap yok).
    const { prepareAnalysisCenter } = await import('../analysis/analysisService.js');
    analysisCenter = await prepareAnalysisCenter(data, { previous, isLocked, store, now });
  } catch (e) {
    console.warn('[analiz] merkezi hesap hatası (akış bozulmadı):', e.message);
  }
  return { radarCenter, analysisCenter };
}

// REFRESH ENTEGRASYONU (KİLİT/SONUÇ AŞAMASI) — cache yazıldıktan SONRA çağrılır.
// Kilit ÖNCESİ: freezeAt geldiyse mühürler. Kilit SONRASI: yalnız resmî sonuç
// alanları akar (kimlik/gözlem/radar yazımı yok).
export async function archiveOnRefresh(data, { store = getArchiveStore(), now = Date.now() } = {}) {
  if (!data || data.pending || data.roundId == null) return;
  try {
    // freezeAt kaçtıysa refresh de telafi edebilir (worker'ı beklemeden).
    const freezeAt = computeFreezeAt(data.matches);
    if (freezeAt && now >= new Date(freezeAt).getTime()) {
      const snap = await store.getSnapshot(String(data.roundId));
      if (!snap) await freezeBulletinFromData(data, { store, now, trigger: 'refresh' });
    }

    // Güncel bültende RESMÎ sonuç alanları geldiyse ayrı sonuç tablosuna işle
    // — snapshot'a dokunulmaz.
    //
    // YALNIZ `resmiSkor` OKUNUR, `score` DEĞİL. `score` bir EKRAN alanıdır ve
    // maç başlayınca harici sağlayıcının canlı/bitmiş skoruyla eziliyor;
    // buradan okunduğunda harici bir skor `resultSource: 'Spor Toto resmi API'`
    // etiketiyle arşivleniyordu — yanlış sonucun "kesin" görünmesi demek.
    // Arşiv, resmî kaynağın kendi verisinden başkasını kabul etmez.
    // (Gerekçenin tamamı: refresh.js, resmiSkor tanımının üstü.)
    const withOfficial = (data.matches || [])
      .filter((m) => m.result && m.resmiSkor)
      .map((m) => ({ ...m, score: m.resmiSkor }));
    if (withOfficial.length) {
      await ingestOfficialResults(String(data.roundId), withOfficial, { store, actor: 'refresh' });
      await maybeCompleteAndEvaluate(String(data.roundId), { store, now });
    }
  } catch (e) {
    console.warn('[arsiv] refresh entegrasyonu hatası (akış bozulmadı):', e.message);
  }
}
