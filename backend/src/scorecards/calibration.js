// KALİBRASYON ÖLÇÜMÜ — "kaç tuttu" değil, olasılık kalitesi (T9).
//
// NEDEN: İsabet sayısı bir olasılık tahmininin iyiliğini ölçmez. "%60 dedik"
// diyorsak, o dediklerimizin yaklaşık %60'ı gerçekleşmelidir. Bu modül mühürlü
// snapshot'lardaki olasılıkları resmî sonuçlarla karşılaştırıp üç skor ve bir
// kalibrasyon eğrisi üretir.
//
// KONVANSİYONLAR (ekranda da yazılır — literatür kıyası ancak böyle anlamlı):
//   • Brier: TOPLAM biçim, aralık [0, 2]. Uniform (1/3) → 0.667.
//   • Log-loss: doğal logaritma (ln). Uniform → ln 3 ≈ 1.0986. p için kırpma
//     ZORUNLU (p→0 sonsuz ceza verir): p = max(p, 0.001).
//   • RPS: K=3, 1→X→2 sırası. Uniform → 0.2222. İkincil raporlanır; birincil
//     DEĞİLDİR (Wheatcroft 2019: ignorance/log-loss ayırt etmede daha iyi ve
//     RPS 1↔X↔2 sıralamasını anlamlı varsayar — kupon mantığında değildir).
//   • Marj temizleme: multiplicative (p_i = (1/o_i)/Σ(1/o_j)).
//
// DÜRÜSTLÜK UYARISI (bu ürüne özgü, kritik):
// Snapshot'taki `market.probabilities`, ORAN VARSA doğrudan oranların marjdan
// arındırılmış hâlidir (analysis/surprise.js: oddsToProbs). Yani o maçlarda
// "model" ile "piyasa" aynı sayıdır — piyasaya karşı beceri (skill) tanım
// gereği ~0 çıkar, bu bir başarısızlık değil, kurgunun sonucudur. Rapor bu payı
// `marketDerivedShare` olarak AÇIKÇA bildirir; gizlemek yanıltıcı olurdu.
// Gerçek sınav yalnız `probabilitiesEstimated === true` olan (oran bulunamayan,
// form+xG'den türetilen) maçlardır; onlar ayrıca `estimatedOnly` altında ölçülür.
import { getArchiveStore } from '../archive/store.js';
import { classifyRecord, recordFromArchive } from './provenance.js';

export const CALIBRATION_VERSION = 'calibration-1.0.0';

export const KEYS = ['1', 'X', '2'];
const CLIP = 0.001;                 // log-loss için alt kırpma
export const MIN_POINTS_FOR_CURVE = 200;   // altında eğri ÇİZİLMEZ
export const MIN_MATCHES_FOR_REPORT = 20;  // altında skor yayımlanmaz

// Referans sabitleri (aritmetik — kaynak değil, tanımdan türer).
export const UNIFORM = { brier: 2 / 3, logLoss: Math.log(3), rps: 2 / 9 };

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Ondalık oranları marjdan arındırıp olasılığa çevirir (multiplicative). */
export function devigMultiplicative(odds) {
  const h = Number(odds?.home), d = Number(odds?.draw), a = Number(odds?.away);
  if (!(h > 1) || !(d > 1) || !(a > 1)) return null;
  const inv = [1 / h, 1 / d, 1 / a];
  const sum = inv[0] + inv[1] + inv[2];
  if (!(sum > 0)) return null;
  return { '1': inv[0] / sum, X: inv[1] / sum, '2': inv[2] / sum };
}

/** {'1':45,'X':27,'2':28} (yüzde) → {'1':0.45,...} (olasılık, normalize). */
export function percentagesToProbs(p) {
  if (!p) return null;
  const v = KEYS.map((k) => Number(p[k]));
  if (v.some((x) => !Number.isFinite(x) || x < 0)) return null;
  const sum = v[0] + v[1] + v[2];
  if (!(sum > 0)) return null;
  return { '1': v[0] / sum, X: v[1] / sum, '2': v[2] / sum };
}

/** Çok sınıflı Brier — TOPLAM biçim, [0,2]. */
export function brierOf(probs, outcome) {
  return KEYS.reduce((s, k) => {
    const y = k === outcome ? 1 : 0;
    const d = clamp01(probs[k]) - y;
    return s + d * d;
  }, 0);
}

/** Log-loss (ln), kırpmalı. */
export function logLossOf(probs, outcome) {
  return -Math.log(Math.max(CLIP, clamp01(probs[outcome])));
}

/** RPS (K=3, 1→X→2 sırası). */
export function rpsOf(probs, outcome) {
  let cumP = 0, cumO = 0, s = 0;
  for (let i = 0; i < KEYS.length - 1; i += 1) {
    cumP += clamp01(probs[KEYS[i]]);
    cumO += KEYS[i] === outcome ? 1 : 0;
    s += (cumP - cumO) ** 2;
  }
  return s / (KEYS.length - 1);
}

/** Skill score: 1 − skor/referans. 0 = referansla aynı, negatif = daha kötü. */
export function skillScore(score, reference) {
  if (!(reference > 0) || !Number.isFinite(score)) return null;
  return 1 - score / reference;
}

/** Sonuç dağılımından taban oran (climatology) üretir. */
export function climatologyOf(outcomes) {
  const n = outcomes.length;
  if (!n) return null;
  const c = { '1': 0, X: 0, '2': 0 };
  for (const o of outcomes) if (c[o] != null) c[o] += 1;
  return { '1': c['1'] / n, X: c.X / n, '2': c['2'] / n };
}

/** Wilson skor aralığı — küçük n ve uçlarda Wald'dan çok daha iyi kapsama. */
export function wilsonInterval(k, n, z = 1.96) {
  if (!n) return { low: null, high: null };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

/** Kuantil (eşit sayılı) binleme — küçük veride eşit genişlikten kararlıdır. */
export function quantileBins(points, binCount) {
  if (!points.length || binCount < 1) return [];
  const sorted = [...points].sort((a, b) => a.p - b.p);
  const bins = [];
  const size = sorted.length / binCount;
  for (let i = 0; i < binCount; i += 1) {
    const from = Math.round(i * size);
    const to = Math.round((i + 1) * size);
    const dilim = sorted.slice(from, to);
    if (!dilim.length) continue;
    const n = dilim.length;
    const k = dilim.filter((x) => x.hit).length;
    const meanP = dilim.reduce((s, x) => s + x.p, 0) / n;
    const ci = wilsonInterval(k, n);
    // "Sapma" ancak güven aralığı söylenen değeri KAPSAMIYORSA iddia edilir;
    // aksi halde dürüst ifade "ayırt edilemiyor"dur (R4 sunum kuralı 6).
    const ayirtEdilebilir = meanP < ci.low || meanP > ci.high;
    bins.push({
      n,
      hits: k,
      saidPct: Math.round(meanP * 1000) / 10,
      actualPct: Math.round((k / n) * 1000) / 10,
      ciLowPct: ci.low == null ? null : Math.round(ci.low * 1000) / 10,
      ciHighPct: ci.high == null ? null : Math.round(ci.high * 1000) / 10,
      distinguishable: ayirtEdilebilir,
    });
  }
  return bins;
}

/** Örneklem büyüklüğüne göre bin sayısı (R4: <200 eğri yok, 200-600 → 3, >600 → 5). */
export function binCountFor(n) {
  if (n < MIN_POINTS_FOR_CURVE) return 0;
  return n > 600 ? 5 : 3;
}

/** Bir skor kümesi biriktirici. */
function makeAccumulator() {
  return { n: 0, brier: 0, logLoss: 0, rps: 0 };
}
function accumulate(acc, probs, outcome) {
  acc.n += 1;
  acc.brier += brierOf(probs, outcome);
  acc.logLoss += logLossOf(probs, outcome);
  acc.rps += rpsOf(probs, outcome);
}
function finalize(acc) {
  if (!acc.n) return null;
  const r3 = (x) => Math.round((x / acc.n) * 1000) / 1000;
  return { n: acc.n, brier: r3(acc.brier), logLoss: r3(acc.logLoss), rps: r3(acc.rps) };
}

/**
 * Mühürlü snapshot'lar + resmî sonuçlardan kalibrasyon raporu üretir.
 * Kriter karnesiyle AYNI uygunluk kapısını kullanır (provenance default-deny):
 * geçmişe uydurulmuş / demo / geç kilitli kayıtlar ölçüme GİRMEZ.
 */
export async function buildCalibrationReport({ store = getArchiveStore(), upToRoundId = null } = {}) {
  const bulletins = (await store.listBulletins())
    .filter((b) => upToRoundId == null || Number(b.roundId) < Number(upToRoundId))
    .sort((x, y) => y.roundId - x.roundId);

  const model = makeAccumulator();
  const market = makeAccumulator();      // yalnız oranı OLAN maçlar
  const estimatedOnly = makeAccumulator(); // yalnız oranı OLMAYAN maçlar (gerçek sınav)
  const curvePoints = [];                // one-vs-rest havuzu
  const outcomes = [];
  let roundsCounted = 0;
  let marketDerived = 0;                 // model = piyasa olan maç sayısı
  let excludedCount = 0;
  const excludedByType = {};
  let noProbability = 0;

  for (const b of bulletins) {
    const snap = await store.getSnapshot(b.id).catch(() => null);
    if (!snap?.payload?.matches?.length) continue;
    const provCls = classifyRecord(recordFromArchive(b, snap), { requireOfficialProfile: false });
    if (!provCls.isOfficialForward) {
      excludedCount += 1;
      excludedByType[provCls.provenanceType] = (excludedByType[provCls.provenanceType] || 0) + 1;
      continue;
    }
    const results = await store.listOfficialResults(b.id).catch(() => []);
    if (!results.length) continue;
    const resBy = new Map(results.map((r) => [String(r.matchId), r.officialResult]));

    let used = false;
    for (const pm of snap.payload.matches) {
      const outcome = resBy.get(String(pm.matchId));
      if (!outcome || !KEYS.includes(outcome)) continue;
      const probs = percentagesToProbs(pm.market?.probabilities);
      if (!probs) { noProbability += 1; continue; }
      used = true;
      outcomes.push(outcome);
      accumulate(model, probs, outcome);

      // Kalibrasyon eğrisi: 1/X/2 tek one-vs-rest havuzunda birleşir.
      for (const k of KEYS) curvePoints.push({ p: probs[k], hit: k === outcome });

      const devigged = devigMultiplicative(pm.market?.odds);
      if (devigged) {
        accumulate(market, devigged, outcome);
        // Oran varsa model olasılığı zaten oranlardan türer → aynı sayı.
        if (pm.market?.probabilitiesEstimated !== true) marketDerived += 1;
      } else {
        accumulate(estimatedOnly, probs, outcome);
      }
    }
    if (used) roundsCounted += 1;
  }

  const modelScores = finalize(model);
  const marketScores = finalize(market);
  const estimatedScores = finalize(estimatedOnly);
  const clim = climatologyOf(outcomes);
  let baselineScores = null;
  if (clim && outcomes.length) {
    const base = makeAccumulator();
    for (const o of outcomes) accumulate(base, clim, o);
    baselineScores = finalize(base);
  }

  const hasData = !!modelScores && modelScores.n >= MIN_MATCHES_FOR_REPORT;
  const binCount = binCountFor(curvePoints.length);

  return {
    version: CALIBRATION_VERSION,
    generatedAt: new Date().toISOString(),
    hasData,
    insufficientNote: hasData ? null
      : `Kalibrasyon için en az ${MIN_MATCHES_FOR_REPORT} resmî sonuçlu maç gerekir (şu an ${modelScores?.n ?? 0}).`,
    roundsCounted,
    matchesCounted: modelScores?.n ?? 0,
    excludedCount,
    excludedByType,
    noProbabilityCount: noProbability,

    conventions: {
      brier: 'Toplam biçim, aralık [0, 2] — uniform 0.667',
      logLoss: 'Doğal logaritma (ln), p alt kırpma 0.001 — uniform 1.099',
      rps: 'K=3, 1→X→2 sırası — uniform 0.222 (ikincil metrik)',
      devig: 'Multiplicative (1/oran normalize)',
    },
    uniform: {
      brier: Math.round(UNIFORM.brier * 1000) / 1000,
      logLoss: Math.round(UNIFORM.logLoss * 1000) / 1000,
      rps: Math.round(UNIFORM.rps * 1000) / 1000,
    },

    model: modelScores,
    market: marketScores,
    baseline: baselineScores,
    climatology: clim ? { '1': Math.round(clim['1'] * 1000) / 10, X: Math.round(clim.X * 1000) / 10, '2': Math.round(clim['2'] * 1000) / 10 } : null,

    // ASIL RAKAM: piyasaya ve tabana karşı beceri.
    skill: {
      vsMarket: modelScores && marketScores ? {
        logLoss: skillScore(modelScores.logLoss, marketScores.logLoss),
        brier: skillScore(modelScores.brier, marketScores.brier),
      } : null,
      vsBaseline: modelScores && baselineScores ? {
        logLoss: skillScore(modelScores.logLoss, baselineScores.logLoss),
        brier: skillScore(modelScores.brier, baselineScores.brier),
      } : null,
    },

    // DÜRÜSTLÜK: model olasılığı kaç maçta doğrudan piyasadan türedi?
    marketDerived: {
      count: marketDerived,
      share: modelScores?.n ? Math.round((marketDerived / modelScores.n) * 1000) / 10 : null,
      note: 'Oranı olan maçlarda olasılık doğrudan oranların marjdan arındırılmış hâlidir; '
        + 'bu maçlarda piyasaya karşı beceri TANIM GEREĞİ sıfıra yakındır. '
        + 'Bağımsız sınav yalnız oranı bulunamayan maçlardır (aşağıda).',
    },
    estimatedOnly: estimatedScores,

    curve: binCount ? {
      bins: quantileBins(curvePoints, binCount),
      points: curvePoints.length,
      note: 'Her bin: söylenen ortalama % vs gerçekleşen %; aralık Wilson skor aralığıdır. '
        + 'Aralık söylenen değeri kapsıyorsa "sapma" denmez — ayırt edilemiyor demektir.',
    } : {
      bins: [],
      points: curvePoints.length,
      insufficient: true,
      note: `Kalibrasyon eğrisi için en az ${MIN_POINTS_FOR_CURVE} gözlem gerekir (şu an ${curvePoints.length}).`,
    },

    expectationNote: 'Bu işte kazanılabilecek pay çok küçüktür: mükemmel bir piyasa bile '
      + 'rastgele tahmine göre yalnız ~%12 iyileşir. "Piyasadan ayırt edilemiyor" sonucu '
      + 'beklenen ve dürüst sonuçtur.',
  };
}
