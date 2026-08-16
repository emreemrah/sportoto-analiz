// ORAN SAĞLAYICI ÇERÇEVESİ — Radar 4 için 1/X/2 oran gözlemi.
// ---------------------------------------------------------------------------
// DURUM (27 Temmuz 2026): KAYITLI SAĞLAYICI YOKTUR. Denenen ikinci kaynak
// kullanıcı kararıyla kaldırıldı; Radar 4 yalnız BİRİNCİL kaynaktan beslenir.
// Aşağıdaki çerçeve, birincil kaynağı koruyan kilitleri taşıdığı için durur.
//
// EN ÖNEMLİ KURAL — ESKİ KAYNAK AYNEN KALIR:
//   Mevcut (birincil) oran yolu `archive/snapshotService.js →
//   recordObservationsFromData()` içindedir ve `source: 'refresh'` ile yazar.
//   BU DOSYA ORAYA DOKUNMAZ. Buradaki sağlayıcılar gözlemi kendi `source`
//   kimliğiyle YANINA ekler. Bir kaynak susarsa diğeri etkilenmez.
//
// * Kaynaklar ham veride KARIŞMAZ: her satır hangi kaynaktan geldiğini taşır;
//   ortalama/harman alınmaz. (Radar 3'teki sağlayıcı kuralının aynısı.)
// * MÜHÜR SEMANTİĞİ ESKİYLE BİREBİR: freeze (ilk maç −5 dk) sonrası ve
//   kilitli/tamamlanmış bültende gözlem YAZILMAZ. Böylece iki kaynağın günlük
//   mühürleri aynı zaman kuralına tabidir, karşılaştırma dürüst olur.
// * Değer değişmediyse yeni satır yazılmaz (zaman serisi gereksiz şişmez).
// * GERİYE DÖNÜK ORAN YOK: kaynak o gün vermediyse satır yoktur; Radar 4 hücreyi
//   boş bırakır ve sebebini yazar (bkz. radar/dailyOdds.js).
// * Arayüzde marka adı gösterilmez → ORAN_KAYNAK_ADI nötr etiket üretir.
import { createHash } from 'node:crypto';
import { LEGACY_ODDS_SOURCE, oddsSourceLabel } from './oddsSources.js';
import { macAniMs } from '../time/turkiyeSaati.js';

export const ODDS_METHODOLOGY_VERSION = 'market-odds-1.0.0';

// Eski/birincil kaynak kimliği (oddsSources.js'te tanımlı) — snapshotService'in
// yazdığı değer. DEĞİŞTİRİLMEZ: arşivdeki geçmiş oran gözlemleri bu kimlikte.
export { LEGACY_ODDS_SOURCE, oddsSourceLabel };

// Kabul sınırları: 1.01 altı oran gerçekçi değil; 1000 üstü bozuk veridir.
export const MIN_ODD = 1.01;
export const MAX_ODD = 1000;
// Toplam ihtimal (overround) makul aralığı: %100–%160. Altı imkânsız (arbitraj),
// üstü bozuk/ölçeksiz veri demektir → REDDEDİLİR, düzeltilmez.
export const MIN_OVERROUND = 99;
export const MAX_OVERROUND = 160;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ---------------------------------------------------------------------------
// ADAPTÖR KAYIT SİSTEMİ
// Sözleşme: { id, name, enabled, available() → {ok,reason},
//   fetchOdds(bulletinData, { now, knownFixtureIds })
//     → [{ matchKey, matchNo, odds:{home,draw,away}, ... }] (+ _unmatched, _calls) }
// ---------------------------------------------------------------------------
const registry = new Map();

export function registerOddsProvider(adapter) {
  if (!adapter?.id) throw new Error('Oran sağlayıcı id zorunlu.');
  if (adapter.id === LEGACY_ODDS_SOURCE) {
    // Eski kaynağın kimliği kaydedilemez: aynı kimlikle iki yazıcı olursa
    // hangi satırın nereden geldiği kaybolur (kaynak karışması).
    throw new Error(`'${LEGACY_ODDS_SOURCE}' birincil kaynağın kimliğidir; sağlayıcı olarak kaydedilemez.`);
  }
  registry.set(adapter.id, adapter);
}
export function listOddsProviders() { return [...registry.values()]; }
export function enabledOddsProviders() { return listOddsProviders().filter((p) => p.enabled === true); }
export function _clearOddsProvidersForTests() { registry.clear(); }

// 27 Temmuz 2026 — KAYITLI SAĞLAYICI YOK (kullanıcı kararı).
// İkinci oran kaynağı (API-Football) aboneliği iptal edildiği için projeden
// çıkarıldı. Çerçeve KASITLI olarak duruyor: `'refresh'` kimliğini koruyan
// yapısal kilit (registerOddsProvider) ve mühür/kilit semantiği burada.
// Sağlayıcısız hâl zararsızdır — observeMarketOdds `no-provider` ile durur,
// oran UYDURULMAZ. Radar 4 tamamen BİRİNCİL kaynaktan beslenir.

// ---------------------------------------------------------------------------
// DOĞRULAMA (saf)
// ---------------------------------------------------------------------------
export function validateOdds(odds) {
  if (!odds) return { valid: false, reason: 'missing' };
  const h = num(odds.home), d = num(odds.draw), a = num(odds.away);
  if (h == null || d == null || a == null) return { valid: false, reason: 'missing_leg' };
  if ([h, d, a].some((v) => v < MIN_ODD || v > MAX_ODD)) return { valid: false, reason: 'out_of_range' };
  const overround = (1 / h + 1 / d + 1 / a) * 100;
  if (overround < MIN_OVERROUND || overround > MAX_OVERROUND) {
    return { valid: false, reason: `bad_overround(${Math.round(overround)})` };
  }
  return {
    valid: true,
    odds: { home: Math.round(h * 100) / 100, draw: Math.round(d * 100) / 100, away: Math.round(a * 100) / 100 },
    overround: Math.round(overround * 10) / 10,
  };
}

export const oddsHash = (providerId, matchKey, odds) =>
  createHash('sha256').update(`${providerId}|${matchKey}|${odds.home}|${odds.draw}|${odds.away}`).digest('hex');

// Son gözlemle birebir aynı mı? (oran kımıldamadıysa yeni satır yazılmaz)
export function isDuplicateOfLastOdds(lastObs, odds) {
  const lo = lastObs?.odds;
  return !!lo && num(lo.home) === odds.home && num(lo.draw) === odds.draw && num(lo.away) === odds.away;
}

// ---------------------------------------------------------------------------
// ÇAĞRI BÜTÇESİ — daha önce çözülmüş kaynak-maç kimlikleri gözlemlerden geri
// okunur; her turda fikstür listesi yeniden taranmaz. (Kimlik yalnız ARŞİVDEN
// gelir; tahmin edilmez.)
// ---------------------------------------------------------------------------
export function collectKnownFixtureIds(observations, providerId) {
  const map = new Map();
  for (const o of (observations || [])) {
    if (o.source !== providerId) continue;
    const r = o.raw || {};
    if (!r.sourceMatchId) continue;
    map.set(String(o.matchId), {
      fixtureId: String(r.sourceMatchId),
      swapped: !!r.swapped,
      providerHome: r.providerHome ?? null,
      providerAway: r.providerAway ?? null,
      bulletinHome: r.bulletinHome ?? null,
      bulletinAway: r.bulletinAway ?? null,
      matchedBy: r.matchedBy ?? null,
      matchConfidence: r.matchConfidence ?? null,
      bulletinPosition: r.bulletinPosition ?? null,
    });
  }
  return map;
}

// Bülten verisinden freeze anı — snapshotService ile AYNI kural (ilk maç −5 dk).
export function freezeMsOf(bulletinData) {
  const ks = (bulletinData?.matches || [])
    .map((m) => macAniMs(m.date)).filter(Number.isFinite);
  return ks.length ? Math.min(...ks) - 5 * 60e3 : null;
}

// ---------------------------------------------------------------------------
// GÖZLEM TURU — etkin oran sağlayıcılarından tek geçiş.
// Sağlayıcı izolasyonu: biri çökerse diğerleri ve BİRİNCİL kaynak etkilenmez.
// ---------------------------------------------------------------------------
let observeInFlight = false;

export async function observeMarketOdds({
  bulletinData, store, now = Date.now(),
  providers = enabledOddsProviders(), log = console.log,
} = {}) {
  if (observeInFlight) return { skipped: true, reason: 'in-flight' };
  if (!bulletinData || bulletinData.pending || !bulletinData.matches?.length) {
    return { skipped: true, reason: 'no-bulletin' };
  }
  if (!providers.length) return { skipped: true, reason: 'no-provider' };

  const bulletinId = String(bulletinData.roundId);

  // KİLİT/MÜHÜR: eski kaynakla birebir aynı durma noktası.
  const b = await store.getBulletin?.(bulletinId).catch(() => null);
  if (b && ['locked', 'completed', 'cancelled'].includes(b.status)) {
    return { skipped: true, reason: 'locked' };
  }
  const freezeMs = b?.freezeAt ? new Date(b.freezeAt).getTime() : freezeMsOf(bulletinData);
  if (freezeMs != null && now >= freezeMs) return { skipped: true, reason: 'after-freeze' };

  observeInFlight = true;
  try {
    const existing = await store.listObservations(bulletinId).catch(() => []);
    const summary = { bulletinId, providers: {}, written: 0, duplicates: 0, invalid: 0, unmatched: 0, calls: 0 };

    for (const p of providers) {
      const s = { fetched: 0, written: 0, duplicates: 0, invalid: 0, calls: 0, errors: null };
      summary.providers[p.id] = s;
      try {
        const av = p.available ? p.available({ now }) : { ok: true };
        if (!av.ok) {                                     // sessiz boşluk değil: sebep taşınır
          s.errors = av.reason;
          if (av.blocked) { s.blocked = av.reason; s.blockedUntil = av.until ?? null; }
          continue;                                       // engelliyken TEK çağrı bile yapılmaz
        }

        const known = collectKnownFixtureIds(existing, p.id);
        const rows = await p.fetchOdds(bulletinData, { now, knownFixtureIds: known });

        // Eşleşmeyen/oranı olmayan maçlar teknik trace olarak durur; oran
        // UYDURULMAZ, başka maçtan taşınmaz.
        if (Array.isArray(rows) && rows._unmatched?.length) {
          s.unmatched = rows._unmatched;
          summary.unmatched += rows._unmatched.length;
        }
        if (Array.isArray(rows) && Number.isFinite(rows._calls)) {
          s.calls = rows._calls; summary.calls += rows._calls;
        }
        // ERİŞİM ENGELİ ≠ VERİ YOK. Kaynak konuşmuyorsa durum kaydında ayrı
        // alanda görünür; "bu hafta oran gelmedi" diye geçiştirilmez.
        if (Array.isArray(rows) && rows._blocked) {
          s.blocked = rows._blocked; s.blockedUntil = rows._blockedUntil ?? null;
          summary.blocked = summary.blocked || rows._blocked;
        }

        for (const row of rows || []) {
          const v = validateOdds(row.odds);
          if (!v.valid) { s.invalid += 1; summary.invalid += 1; continue; }   // bozuk veri REDDEDİLİR
          s.fetched += 1;
          const matchKey = String(row.matchKey ?? row.matchNo);
          const prior = existing.filter((o) => o.source === p.id && String(o.matchId) === matchKey && o.odds);
          const last = prior.sort((a, c) => String(c.observedAt).localeCompare(String(a.observedAt)))[0];
          if (isDuplicateOfLastOdds(last, v.odds)) {
            s.duplicates += 1; summary.duplicates += 1; continue;             // oran değişmedi
          }
          await store.addObservations(bulletinId, [{
            matchId: matchKey,
            source: p.id,                       // 'refresh' DEĞİL → eski kayıtlar korunur
            observedAt: new Date(now).toISOString(),
            playedPct: null,                    // bu kaynak yüzde vermez ("veri yok")
            odds: v.odds,
            // Sürücü bağımsız taşınabilirlik + eşleştirme kanıtı raw'da.
            raw: {
              methodologyVersion: ODDS_METHODOLOGY_VERSION,
              overround: v.overround,
              sourceMatchId: row.sourceMatchId ?? null,
              providerHome: row.providerHome ?? null, providerAway: row.providerAway ?? null,
              bulletinHome: row.bulletinHome ?? null, bulletinAway: row.bulletinAway ?? null,
              swapped: !!row.swapped,
              bulletinPosition: row.matchNo ?? null,
              matchedBy: row.matchedBy ?? null, matchConfidence: row.matchConfidence ?? null,
              bookmakerCount: row.bookmakerCount ?? null,
              sourceType: row.sourceType ?? null, parserVersion: row.parserVersion ?? null,
              rawHash: row.rawHash ?? oddsHash(p.id, matchKey, v.odds),
            },
          }]);
          s.written += 1; summary.written += 1;
        }
      } catch (e) {
        s.errors = e.message;                    // izolasyon: diğer kaynaklar devam eder
        log(`[oran] sağlayıcı ${p.id} hatası (izole): ${e.message}`);
      }
    }
    return { ok: true, ...summary };
  } finally {
    observeInFlight = false;
  }
}
