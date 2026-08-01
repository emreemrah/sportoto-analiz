// HAVUZ EV MOTORU — SAF MATEMATİK (T10).
// Bağımlılığı yoktur; tamamı test edilebilir saf fonksiyonlardır.
import { MATCH_COUNT } from './config.js';

export const KEYS = ['1', 'X', '2'];

/**
 * POISSON-BİNOM PMF — her denemenin farklı başarı olasılığı olduğu durumda
 * "tam olarak k başarı" dağılımı. Dinamik programlama, O(n²).
 * probs: [p1..pn] → dönüş: [P(0), P(1), ..., P(n)]
 *
 * Neden gerekli: 15 maçın her birinde doğru bilme olasılığı farklıdır;
 * binom dağılımı (tek p) burada YANLIŞ olur.
 */
export function poissonBinomialPmf(probs) {
  let pmf = [1];
  for (const pRaw of probs) {
    const p = Math.max(0, Math.min(1, Number(pRaw) || 0));
    const next = new Array(pmf.length + 1).fill(0);
    for (let k = 0; k < pmf.length; k += 1) {
      next[k] += pmf[k] * (1 - p);      // bu maç yanlış
      next[k + 1] += pmf[k] * p;        // bu maç doğru
    }
    pmf = next;
  }
  return pmf;
}

/**
 * ÜSTEL KESKİNLEŞTİRME (exponential tilting) — kalabalık modeli.
 * π̃(s) ∝ π(s)^(1+λ), maç içinde normalize edilir.
 *   λ = 0 → bağımsızlık varsayımı (gözlenen yüzdeler aynen)
 *   λ > 0 → kalabalık favoriye daha çok yığılır ("chalk" etkisi)
 * Tek parametre olması bilinçli: haftada yalnız 4 sayı (kademe kazananları)
 * gözlemlendiği için daha fazla parametre kimliklenemez (R1 §6.3).
 */
export function tiltMarginal(marginal, lambda = 0) {
  const v = KEYS.map((k) => Math.max(0, Number(marginal?.[k]) || 0));
  const sum = v.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  const norm = v.map((x) => x / sum);
  const tilted = norm.map((x) => x ** (1 + lambda));
  const tSum = tilted.reduce((a, b) => a + b, 0);
  if (!(tSum > 0)) return null;
  return { '1': tilted[0] / tSum, X: tilted[1] / tSum, '2': tilted[2] / tSum };
}

/**
 * E[1/(1+W)] — W ~ Poisson(μ). Havuz paylaşımının beklenen payı.
 * Kapalı form: (1 − e^(−μ)) / μ.  μ → 0 limitinde 1 (kimse yoksa havuzun tamamı).
 */
export function expectedInverseWinners(mu) {
  const m = Number(mu);
  if (!Number.isFinite(m) || m <= 0) return 1;
  if (m < 1e-9) return 1;
  return (1 - Math.exp(-m)) / m;
}

/** Veraset ve İntikal Vergisi: istisnayı aşan kısma oran uygulanır. */
export function afterTax(amountTl, { rate, exemption }) {
  const a = Number(amountTl) || 0;
  if (a <= exemption) return a;
  return exemption + (a - exemption) * (1 - rate);
}

/**
 * Tohumlanabilir rastgele sayı üreteci (mulberry32).
 * Gölge kayıtlarının YENİDEN ÜRETİLEBİLİR olması için Math.random kullanılmaz:
 * aynı tohum + aynı girdi = aynı kayıt (denetlenebilirlik).
 */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bir olasılık vektöründen sonuç çeker ('1' | 'X' | '2'). */
export function sampleOutcome(probs, rng) {
  const u = rng();
  let acc = 0;
  for (const k of KEYS) {
    acc += Math.max(0, Number(probs?.[k]) || 0);
    if (u < acc) return k;
  }
  return KEYS[KEYS.length - 1];
}

/** Sıralı dizide yüzdelik (quantile) — enterpolasyonsuz, dürüst ve basit. */
export function quantile(sortedAsc, q) {
  if (!sortedAsc.length) return null;
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.round(q * (sortedAsc.length - 1))));
  return sortedAsc[i];
}

/** 15 maçlık kolon/bülten doğrulaması — sessiz yanlış hesabı engeller. */
export function assertMatchCount(arr, ad) {
  if (!Array.isArray(arr) || arr.length !== MATCH_COUNT) {
    throw new Error(`${ad}: ${MATCH_COUNT} maç bekleniyor, ${Array.isArray(arr) ? arr.length : 'dizi değil'} geldi.`);
  }
}
