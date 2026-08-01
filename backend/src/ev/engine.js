// HAVUZ EV MOTORU — beklenen dönüş hesabı (T10, GÖLGE MOD).
//
// SORU DEĞİŞİYOR: "hangi maç ne biter" değil, **"hangi sonuç kalabalığın
// tahmin ettiğinden daha olası"**. Spor Toto müşterek (parimütüel) bir oyun
// olduğu için kazanç, aynı kolonu kaç kişinin oynadığına bağlıdır.
//
// ⚠ BU MOTOR KULLANICIYA HİÇBİR SAYI GÖSTERMEZ. Çıktısı yalnız gölge kayda
// yazılır (data/ev-shadow/). Sebep: λ (kalabalık yoğunlaşması) haftada yalnız
// 4 sayıdan öğrenilir; ≥30 hafta öncesi güvenilir değildir (R1 §2.4).
import {
  TIER_SHARES, TIERS, MATCH_COUNT, PAYOUT_RATIO, COLUMN_PRICE_TL, COLUMN_PRICE_VERIFIED,
  TAX_RATE, TAX_EXEMPTION_TL, DEFAULT_DRAWS,
} from './config.js';
import {
  poissonBinomialPmf, tiltMarginal, expectedInverseWinners, afterTax,
  makeRng, sampleOutcome, quantile, assertMatchCount, KEYS,
} from './math.js';

/**
 * TOPLAM KOLON SAYISINI (N) GERİ ÇIKAR.
 * Havuz_k = ρ · fiyat · N · pay_k  ve  Havuz_k = kişiBaşıİkramiye_k · kazanan_k
 * ⇒ N = (kişiBaşıİkramiye · kazanan) / (fiyat · ρ · pay_k)
 *
 * ρ bilinmiyorsa N hesaplanamaz — uydurulmaz, null döner. Birden fazla kademe
 * verilirse çapraz doğrulama yapılır: sonuçlar birbirinden uzaksa ρ yanlıştır.
 */
export function estimateColumnsFromWinners(tiers, { payoutRatio = PAYOUT_RATIO, columnPrice = COLUMN_PRICE_TL } = {}) {
  if (!(payoutRatio > 0)) {
    return {
      columns: null,
      reason: 'payout_ratio_unknown',
      note: 'ρ (ikramiyeye giden hasılat oranı) bilinmiyor — toplam kolon sayısı hesaplanamaz. '
        + 'Resmî Müşterek Oyun Planı\'ndan elle okunmalı (config.js: PAYOUT_RATIO).',
    };
  }
  const tahminler = [];
  for (const t of TIERS) {
    const row = tiers?.[t];
    const prize = Number(row?.perPersonPrize);
    const winners = Number(row?.winners);
    if (!(prize > 0) || !(winners > 0)) continue;
    const pay = TIER_SHARES[t];
    tahminler.push({ tier: t, columns: (prize * winners) / (columnPrice * payoutRatio * pay) });
  }
  if (!tahminler.length) return { columns: null, reason: 'no_tier_data', note: 'Kademe kazanan/ikramiye verisi yok.' };

  const degerler = tahminler.map((x) => x.columns);
  const ortalama = degerler.reduce((a, b) => a + b, 0) / degerler.length;
  const enBuyuk = Math.max(...degerler), enKucuk = Math.min(...degerler);
  // Çapraz doğrulama: kademeler arası oran 1.25'i aşarsa ρ şüphelidir.
  const tutarli = enKucuk > 0 ? enBuyuk / enKucuk <= 1.25 : false;

  // ⚠ ÇAPRAZ DOĞRULAMANIN KÖR NOKTASI — bilerek yazılıyor:
  // Yanlış bir KOLON BEDELİ tüm kademeleri AYNI oranda ölçekler; kademeler
  // arası oran değişmez, dolayısıyla yukarıdaki kontrol "tutarlı" der.
  // Ölçüldü: 10/2/50 TL fiyatlarının üçünde de consistent=true, N ise 5 kat
  // farklı. Yani bu kontrol ρ hatasını yakalar, FİYAT hatasını YAKALAMAZ.
  // Fiyat doğrulanana kadar N (ve ondan türeyen λ) bu belirsizliği taşır —
  // çağıran taraf bunu görebilsin diye açıkça bildiriliyor.
  return {
    columns: Math.round(ortalama),
    perTier: tahminler,
    consistent: tutarli,
    priceAssumed: columnPrice,
    priceVerified: COLUMN_PRICE_VERIFIED,
    priceCaveat: COLUMN_PRICE_VERIFIED ? null
      : `N, doğrulanmamış ${columnPrice} TL kolon bedeline dayanıyor. Bedel yanlışsa `
        + 'N ve λ aynı oranda kayar; kademeler arası çapraz doğrulama bunu YAKALAYAMAZ.',
    note: tutarli ? null
      : 'Kademeler arası N tahminleri tutarsız — ρ değeri büyük olasılıkla yanlış.',
  };
}

/** Havuz tutarları: taban (satıştan) + devreden. ρ yoksa null. */
export function poolsOf({ columns, payoutRatio = PAYOUT_RATIO, columnPrice = COLUMN_PRICE_TL, rollover = {} }) {
  const out = {};
  const hasScale = payoutRatio > 0 && columns > 0;
  for (const t of TIERS) {
    const taban = hasScale ? payoutRatio * columnPrice * columns * TIER_SHARES[t] : 0;
    const devir = Number(rollover?.[t]) || 0;
    out[t] = hasScale || devir ? taban + devir : null;
  }
  return { pools: out, scaled: hasScale };
}

/**
 * BİR KOLONUN BEKLENEN DÖNÜŞÜ — Monte Carlo.
 *
 * Her turda:
 *   1) Gerçek sonuç R çekilir (sonuç olasılıklarından q_i).
 *   2) Kolonumuzun kaç maçı tuttuğu (m) sayılır. m<12 → ödeme yok.
 *   3) Kalabalığın o R'ye karşı "tam olarak k doğru" dağılımı Poisson-binom ile
 *      hesaplanır; beklenen DİĞER kazanan sayısı μ_k = N · P(k).
 *   4) Ödeme = Havuz_k · E[1/(1+W⁻)], W⁻ ~ Poisson(μ_k).
 *   5) Vergi uygulanır.
 *
 * KRİTİK: kademeler AYRIKTIR — kolon yalnız tam olarak tuttuğu k'dan ödeme alır
 * ("en az k" sayılırsa beklenen dönüş ~%25 şişer).
 */
export function evaluateColumn({
  column,                 // ['1','X','2',...] 15 uzunluk
  outcomeProbs,           // [{'1':..,'X':..,'2':..}] 15 uzunluk — gerçek sonuç olasılıkları
  crowdMarginals,         // [{'1':..,'X':..,'2':..}] 15 uzunluk — oynanma yüzdeleri (0-1)
  lambda = 0,
  columns: N = null,      // toplam kolon sayısı (bilinmiyorsa null)
  pools = null,           // { 15: TL, 14: TL, ... } veya null
  draws = DEFAULT_DRAWS,
  seed = 12345,
  columnPrice = COLUMN_PRICE_TL,
} = {}) {
  assertMatchCount(column, 'kolon');
  assertMatchCount(outcomeProbs, 'sonuç olasılıkları');
  assertMatchCount(crowdMarginals, 'oynanma yüzdeleri');

  const tilted = crowdMarginals.map((m) => tiltMarginal(m, lambda));
  if (tilted.some((t) => !t)) {
    return { ok: false, reason: 'crowd_marginals_invalid', note: 'Oynanma yüzdeleri eksik/geçersiz — EV hesaplanmaz.' };
  }

  const rng = makeRng(seed);
  const odemeler = [];              // TL (ölçek varsa), yoksa havuz PAYI (0-1)
  const tierHits = { 15: 0, 14: 0, 13: 0, 12: 0 };
  let anyPrize = 0;
  const scaled = !!pools && TIERS.every((t) => pools[t] != null);

  for (let d = 0; d < draws; d += 1) {
    // 1) Gerçek sonuç
    const R = outcomeProbs.map((q) => sampleOutcome(q, rng));
    // 2) Kolonumuzun tutturduğu sayı
    let m = 0;
    for (let i = 0; i < MATCH_COUNT; i += 1) if (column[i] === R[i]) m += 1;
    if (!TIERS.includes(m)) { odemeler.push(0); continue; }
    tierHits[m] += 1;
    anyPrize += 1;

    // 3) Kalabalığın bu R'ye karşı doğru bilme olasılıkları
    const crowdCorrect = tilted.map((t, i) => t[R[i]]);
    const pmf = poissonBinomialPmf(crowdCorrect);
    const pTam = pmf[m] ?? 0;                       // TAM OLARAK m doğru
    const mu = N != null ? Math.max(0, N * pTam) : null;

    // 4) Paylaşım
    const pay = mu != null ? expectedInverseWinners(mu) : 1;
    if (scaled) {
      const brut = pools[m] * pay;
      odemeler.push(afterTax(brut, { rate: TAX_RATE, exemption: TAX_EXEMPTION_TL }));
    } else {
      // Ölçek yoksa (ρ bilinmiyor): havuzun PAYI olarak raporla.
      odemeler.push(TIER_SHARES[m] * pay);
    }
  }

  odemeler.sort((a, b) => a - b);
  const ortalama = odemeler.reduce((a, b) => a + b, 0) / odemeler.length;

  return {
    ok: true,
    draws,
    scaled,
    unit: scaled ? 'TL' : 'havuz_payi',
    expected: ortalama,
    median: quantile(odemeler, 0.5),
    p10: quantile(odemeler, 0.10),
    p90: quantile(odemeler, 0.90),
    pAnyPrize: anyPrize / draws,
    pTier: Object.fromEntries(TIERS.map((t) => [t, tierHits[t] / draws])),
    // Dürüstlük: ölçek varsa 10 TL'ye karşılık dönüş; medyan sonuç sıfırdır.
    perColumnCost: scaled ? columnPrice : null,
    honestNote: 'Tek bir haftada en olası sonuç kuponun tamamını kaybetmektir. '
      + 'Bu bir kazanç garantisi değildir.',
  };
}

/**
 * λ KALİBRASYONU — tarihsel haftalardan kalabalık yoğunlaşmasını öğrenir.
 * Ölçüt: gerçekleşen kazanan sayıları ile modelin beklediği sayıların
 * log-uzayındaki karesel farkı (basit kayıp; olabilirlik yerine sağlam ve
 * anlaşılır). Küçük ızgara taraması — haftada 4 gözlem varken daha karmaşık
 * bir optimizasyon kimliklenemez (R1 §6.3).
 */
export function calibrateLambda(weeks, { grid = null, columnsByWeek = null } = {}) {
  const denenecek = grid || Array.from({ length: 41 }, (_, i) => i * 0.05); // 0.00 → 2.00
  const kullanilabilir = (weeks || []).filter((w) =>
    Array.isArray(w?.result) && w.result.length === MATCH_COUNT
    && Array.isArray(w?.crowdMarginals) && w.crowdMarginals.length === MATCH_COUNT
    && w.tiers && TIERS.some((t) => Number(w.tiers[t]?.winners) > 0));

  if (!kullanilabilir.length) {
    return { lambda: 0, weeksUsed: 0, reason: 'no_calibration_data', reliable: false };
  }

  let enIyi = { lambda: 0, loss: Infinity };
  for (const lam of denenecek) {
    let loss = 0, n = 0;
    for (const w of kullanilabilir) {
      const N = columnsByWeek?.[w.roundId] ?? w.columns;
      if (!(N > 0)) continue;
      const tilted = w.crowdMarginals.map((m) => tiltMarginal(m, lam));
      if (tilted.some((t) => !t)) continue;
      const correct = tilted.map((t, i) => t[w.result[i]]);
      const pmf = poissonBinomialPmf(correct);
      for (const t of TIERS) {
        const gercek = Number(w.tiers?.[t]?.winners);
        if (!(gercek > 0)) continue;
        const beklenen = Math.max(1e-9, N * (pmf[t] ?? 0));
        const d = Math.log(gercek) - Math.log(beklenen);
        loss += d * d; n += 1;
      }
    }
    if (n && loss / n < enIyi.loss) enIyi = { lambda: lam, loss: loss / n };
  }

  return {
    lambda: enIyi.lambda,
    loss: Number.isFinite(enIyi.loss) ? Math.round(enIyi.loss * 1000) / 1000 : null,
    weeksUsed: kullanilabilir.length,
    reliable: kullanilabilir.length >= 30,
    note: kullanilabilir.length >= 30 ? null
      : `λ ${kullanilabilir.length} haftadan tahmin edildi; güvenilir sayılması için ≥30 hafta gerekir.`,
  };
}
