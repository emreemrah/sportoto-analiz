// HAFTALIK GÖLGE AKIŞI (T10'un kalan yarısı) — motoru gerçek haftaya bağlar.
//
// NEDEN ŞİMDİ, ρ BEKLENMEDEN:
// ρ (ikramiyeye giden hasılat oranı) sonradan bulunabilir ve tüm geçmiş yeniden
// hesaplanabilir. **Oynanma yüzdeleri bulunamaz.** Kalabalığın kilit anındaki
// dağılımı o an kaydedilmezse sonsuza kadar kaybolur — Bilyoner/Nesine/Misli
// geçmişe dönük kapanış yüzdesi vermez. Bu yüzden gölge kayıt, ρ'suz da olsa
// BUGÜN başlamalıdır; birim TL değil "havuz payı" olur, o kadar.
//
// KAYIT KULLANICIYA GÖSTERİLMEZ. Amaç ileriye dönük gölge test verisi biriktirmek.
import { evaluateColumn, calibrateLambda, estimateColumnsFromWinners, poolsOf } from './engine.js';
import { writeShadowRecord, readShadowRecord, appendShadowSettlement } from './shadowStore.js';
import { PAYOUT_RATIO, MATCH_COUNT, TIERS } from './config.js';
import { KEYS } from './math.js';
import { percentagesToProbs } from '../scorecards/calibration.js';

export const WEEKLY_SHADOW_VERSION = 'ev-weekly-1.0.0';

const medyan = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * KALABALIK DAĞILIMI — sağlayıcı gözlemlerinden kilit anı uzlaşması.
 *
 * Kurallar (providers/playedPercentages.js semantiğiyle aynı):
 *  * Yalnız kilit ANINDAN ÖNCEKİ, tahmine uygun gözlemler sayılır;
 *    'post_lock_research' satırları KESİNLİKLE girmez.
 *  * Her sağlayıcının KENDİ son gözlemi alınır (sağlayıcılar ham veride
 *    karışmaz), sağlayıcılar arası yalnız MEDYAN alınır.
 *  * Tek maçta bile veri yoksa uydurulmaz — eksik olarak bildirilir.
 */
export function crowdConsensus(observations, { matchIds, freezeAtMs = null } = {}) {
  const sonGozlem = new Map();          // `${matchId}|${source}` → satır
  for (const o of observations || []) {
    if (!o?.playedPct) continue;
    if (o.kind === 'post_lock_research') continue;
    if (o.usableForPrediction === false) continue;
    const t = new Date(o.observedAt).getTime();
    if (!Number.isFinite(t)) continue;
    if (freezeAtMs != null && t > freezeAtMs) continue;
    const key = `${String(o.matchId)}|${o.source}`;
    const onceki = sonGozlem.get(key);
    if (!onceki || t > onceki._ms) sonGozlem.set(key, { ...o, _ms: t });
  }

  const marginals = new Map();
  const perMatch = new Map();
  for (const id of matchIds) {
    const satirlar = [...sonGozlem.values()].filter((o) => String(o.matchId) === String(id));
    if (!satirlar.length) { perMatch.set(String(id), { providers: 0 }); continue; }
    // Sağlayıcı bazında olasılığa çevir, sonra medyan al.
    const olasiliklar = satirlar.map((o) => percentagesToProbs(o.playedPct)).filter(Boolean);
    if (!olasiliklar.length) { perMatch.set(String(id), { providers: 0 }); continue; }
    const ham = Object.fromEntries(KEYS.map((k) => [k, medyan(olasiliklar.map((p) => p[k]))]));
    const toplam = KEYS.reduce((s, k) => s + ham[k], 0);
    if (!(toplam > 0)) { perMatch.set(String(id), { providers: 0 }); continue; }
    marginals.set(String(id), Object.fromEntries(KEYS.map((k) => [k, ham[k] / toplam])));
    perMatch.set(String(id), {
      providers: olasiliklar.length,
      sources: satirlar.map((o) => o.source).sort(),
      lastObservedAt: satirlar.map((o) => o.observedAt).sort().at(-1),
    });
  }
  return { marginals, perMatch, matchesWithData: marginals.size };
}

/**
 * MOTOR GİRDİLERİ — mühürlü snapshot + gözlemlerden.
 * Eksik varsa ok:false ve NEDENİ döner; hiçbir alan tahminle doldurulmaz.
 */
export function buildShadowInputs({ snapshot, observations = [], freezeAtMs = null } = {}) {
  const matches = snapshot?.payload?.matches;
  if (!Array.isArray(matches) || matches.length !== MATCH_COUNT) {
    return { ok: false, reason: 'snapshot_match_count', note: `Mühürlü snapshot'ta ${MATCH_COUNT} maç yok (${matches?.length ?? 0}).` };
  }
  const sirali = [...matches].sort((a, b) => (a.no || 0) - (b.no || 0));
  const matchIds = sirali.map((m) => String(m.matchId));

  // 1) KOLONUMUZ — karnenin ölçtüğü tekli ana tahminin AYNISI.
  const column = sirali.map((m) => {
    const master = m.analysisCenter?.officialMasterAnalysis;
    const main = master && master.ok !== false ? master.mainPrediction : null;
    return KEYS.includes(main) ? main : null;
  });
  const kolonEksik = column.filter((x) => x == null).length;

  // 2) SONUÇ OLASILIKLARI — mühürlü olasılıklar (yoksa oran türevi YOK, uydurma yok).
  const outcomeProbs = sirali.map((m) => percentagesToProbs(m.market?.probabilities));
  const olasilikEksik = outcomeProbs.filter((x) => !x).length;

  // 3) KALABALIK — gerçek gözlem akışından.
  const crowd = crowdConsensus(observations, { matchIds, freezeAtMs });
  const crowdMarginals = matchIds.map((id) => crowd.marginals.get(id) || null);
  const kalabalikEksik = crowdMarginals.filter((x) => !x).length;

  const eksik = { column: kolonEksik, probabilities: olasilikEksik, crowd: kalabalikEksik };
  if (kolonEksik || olasilikEksik || kalabalikEksik) {
    // En belirleyici eksiği başa yaz: kalabalık verisi geri getirilemez.
    const neden = kalabalikEksik ? 'crowd_missing' : olasilikEksik ? 'probabilities_missing' : 'column_missing';
    return {
      ok: false, reason: neden, missing: eksik, crowdDetail: [...crowd.perMatch.entries()],
      note: kalabalikEksik
        ? `${kalabalikEksik} maçta kilit öncesi oynanma yüzdesi yok — bu veri sonradan elde EDİLEMEZ.`
        : `${olasilikEksik || kolonEksik} maçta mühürlü tahmin/olasılık eksik.`,
    };
  }
  return {
    ok: true, column, outcomeProbs, crowdMarginals,
    matchIds, crowdDetail: [...crowd.perMatch.entries()],
  };
}

/**
 * λ TAHMİNİ — geçmiş haftaların gerçekleşen kazanan sayılarından.
 * N (toplam kolon) ρ olmadan bilinemediği için ρ yoksa λ=0 kalır ve bu AÇIKÇA
 * bildirilir; 0 "öğrenildi" diye sunulmaz.
 */
export function lambdaFromHistory(pastWeeks, { payoutRatio = PAYOUT_RATIO } = {}) {
  if (!(payoutRatio > 0)) {
    return {
      lambda: 0, weeksUsed: 0, reliable: false, reason: 'payout_ratio_unknown',
      note: 'ρ bilinmediği için haftalık toplam kolon sayısı (N) hesaplanamıyor; '
        + 'λ öğrenilemez ve 0 (yoğunlaşma yok) varsayılır. Bu bir ölçüm DEĞİLDİR.',
    };
  }
  const columnsByWeek = {};
  for (const w of pastWeeks || []) {
    const est = estimateColumnsFromWinners(w.tiers, { payoutRatio });
    if (est.columns > 0) columnsByWeek[w.roundId] = est.columns;
  }
  return calibrateLambda(pastWeeks, { columnsByWeek });
}

/**
 * HAFTALIK GÖLGE KOŞUSU — kilit anında bir kez çalışır.
 * Başarısız olsa bile kayıt yazılır: kilit anı tekrar gelmez, hangi kaynağın
 * eksik olduğu bilgisi de veridir.
 */
export async function runWeeklyShadow({
  bulletinId, store, now = Date.now(), pastWeeks = [], payoutRatio = PAYOUT_RATIO,
} = {}) {
  const snapshot = await store.getSnapshot(String(bulletinId)).catch(() => null);
  if (!snapshot) return { ran: false, reason: 'snapshot_yok' };
  if (readShadowRecord(bulletinId)) return { ran: false, reason: 'already_exists' };

  const observations = await store.listObservations(String(bulletinId)).catch(() => []);
  const freezeAtMs = snapshot.lockedAt ? new Date(snapshot.lockedAt).getTime() : now;
  const girdi = buildShadowInputs({ snapshot, observations, freezeAtMs });

  const ortak = {
    version: WEEKLY_SHADOW_VERSION,
    bulletinId: String(bulletinId),
    snapshotId: snapshot.id ?? null,
    snapshotHash: snapshot.payloadHash ?? null,     // hangi mühürlü halin kullanıldığının kanıtı
    lockedAt: snapshot.lockedAt ?? null,
  };

  if (!girdi.ok) {
    writeShadowRecord(bulletinId, { ...ortak, ok: false, reason: girdi.reason, missing: girdi.missing, note: girdi.note, crowdDetail: girdi.crowdDetail });
    return { ran: false, reason: girdi.reason, note: girdi.note };
  }

  const lam = lambdaFromHistory(pastWeeks, { payoutRatio });
  const ev = evaluateColumn({
    column: girdi.column,
    outcomeProbs: girdi.outcomeProbs,
    crowdMarginals: girdi.crowdMarginals,
    lambda: lam.lambda,
    columns: null,          // ρ yok → N yok → paylaşım oranı 1 kabul edilir
    pools: null,
    seed: Number(bulletinId) || 12345,   // hafta bazında yeniden üretilebilir
  });

  writeShadowRecord(bulletinId, {
    ...ortak,
    ok: true,
    // HAM GİRDİLER SAKLANIR: ρ bulunduğunda tüm geçmiş yeniden hesaplanabilsin.
    // Kalabalık dağılımı geri getirilemez olduğu için burada tutulması ŞART.
    inputs: {
      column: girdi.column,
      outcomeProbs: girdi.outcomeProbs,
      crowdMarginals: girdi.crowdMarginals,
      matchIds: girdi.matchIds,
      crowdDetail: girdi.crowdDetail,
    },
    lambda: lam,
    ev,
    unitNote: ev.scaled ? null
      : 'ρ bilinmediği için sonuç TL değil HAVUZ PAYI birimindedir; TL ölçeği ρ '
        + 'bulununca ham girdilerden yeniden hesaplanabilir.',
  });
  return { ran: true, unit: ev.unit, expected: ev.expected, lambda: lam.lambda };
}

/**
 * SONUÇ AÇIKLANINCA — gerçekleşenle kıyaslama, kayda BİR KEZ eklenir.
 * Resmî kademe verisi (kazanan sayıları + kişi başı ikramiye) burada saklanır:
 * ρ bulunduğu gün λ kalibrasyonu bu satırlardan yapılabilecek.
 */
export async function settleWeeklyShadow({
  bulletinId, store, roundResult = null, now = Date.now(),
} = {}) {
  const rec = readShadowRecord(bulletinId);
  if (!rec) return { settled: false, reason: 'kayit_yok' };
  if (rec.settlement) return { settled: false, reason: 'already_settled' };
  if (!rec.ok) return { settled: false, reason: 'kayit_gecersiz' };

  const results = await store.listOfficialResults(String(bulletinId)).catch(() => []);
  if (!results.length) return { settled: false, reason: 'sonuc_yok' };
  const resBy = new Map(results.map((r) => [String(r.matchId), r.officialResult]));

  const gercek = rec.inputs.matchIds.map((id) => resBy.get(String(id)) || null);
  if (gercek.some((x) => !KEYS.includes(x))) {
    return { settled: false, reason: 'sonuclar_eksik' };
  }

  let hits = 0;
  for (let i = 0; i < MATCH_COUNT; i += 1) if (rec.inputs.column[i] === gercek[i]) hits += 1;

  // Resmî kademe verisi (varsa) — λ kalibrasyonunun geleceği bu satırlarda.
  const tiers = {};
  for (const t of TIERS) {
    const row = (roundResult?.tiers || []).find((x) => Number(x.hit) === t);
    tiers[t] = row ? { winners: Number(row.count) || 0, perPersonPrize: Number(row.prize) || 0 } : null;
  }
  const kademeVar = TIERS.some((t) => tiers[t]);

  const settlement = {
    settledAt: new Date(now).toISOString(),
    result: gercek,
    hits,
    tier: TIERS.includes(hits) ? hits : null,
    // ρ yoksa N hesaplanamaz — null döner, uydurulmaz.
    estimatedColumns: kademeVar ? estimateColumnsFromWinners(tiers) : null,
    officialTiers: kademeVar ? tiers : null,
    officialTiersNote: kademeVar ? null : 'Resmî kademe (kazanan/ikramiye) verisi alınamadı.',
    // Tahmin ile gerçekleşenin karşılaştırması: model bu tutturmayı ne kadar
    // bekliyordu? (Kalibrasyonun EV tarafındaki karşılığı.)
    expectedTierProb: rec.ev?.pTier?.[hits] ?? null,
    expectedAnyPrizeProb: rec.ev?.pAnyPrize ?? null,
  };
  appendShadowSettlement(bulletinId, settlement);
  return { settled: true, hits, tier: settlement.tier };
}

/** ρ bulunduğunda geçmiş gölge kayıtları TL'ye çevirmek için hazır yardımcı. */
export function rescaleWithPayoutRatio(record, { payoutRatio, columns }) {
  if (!record?.ok || !record.inputs) return null;
  if (!(payoutRatio > 0) || !(columns > 0)) return null;
  const { pools } = poolsOf({ columns, payoutRatio });
  return evaluateColumn({
    column: record.inputs.column,
    outcomeProbs: record.inputs.outcomeProbs,
    crowdMarginals: record.inputs.crowdMarginals,
    lambda: record.lambda?.lambda ?? 0,
    columns, pools,
    seed: Number(record.bulletinId) || 12345,
  });
}
