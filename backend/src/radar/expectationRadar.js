// RADAR 2 — xG VE BEKLENTİ–GERÇEKLİK RADARI (v2 — Poisson modeli)
// ---------------------------------------------------------------------------
// SKORLAR (1/X/2) artık sinyal ağırlığı bölüştürmesi DEĞİL; saha-ayarlı GERÇEK
// xG verilerinden çift bağımsız Poisson modeliyle türetilen olasılıklardır:
//   λ_ev  = (evin İÇ SAHA hücum xG'si  + deplasmanın DIŞ SAHADA yediği xGA) / 2
//   λ_dep = (deplasmanın DIŞ SAHA hücum xG'si + evin İÇ SAHADA yediği xGA) / 2
//   P(1)/P(X)/P(2) → 0–10 gol ızgarası; toplam TAM 100 (en büyük kalan yöntemi).
// İç saha avantajı YAPAY katsayı ile değil, iç/dış ayrımlı xG verisinin
// içinden gelir. Bu uydurma değildir: mevcut gerçek verinin standart
// olasılık modeliyle işlenmesidir; hiçbir taraf yapısal olarak 0'a düşmez,
// beraberlik doğal bandında kalır, eşik uçurumu (0.25) oluşmaz.
//
// SİNYALLER skor üretmez: "neden" açıklamaları (aktif sinyal listesi,
// olumlu/olumsuz cümleler) ve favori-kazanamama riskine katkı üretir.
//
// DÜRÜSTLÜK KURALLARI:
// * xG yoksa YA DA yeni sezon junk'ı ise (0 maç + 0.00 xG) radar devre dışı —
//   rastgele/sıfırdan xG üretilmez, veri yeterliliği de yüksek GÖSTERİLMEZ.
// * Kaynak "son dönem puan/maç" alanını boş (0) döndürüyorsa bu değer GERÇEK
//   sayılmaz; trend sinyali üretilmez ve eksik-veri listesine yazılır.
//   (Aksi hâlde her maçta hayalet bir ev-aleyhtarı sinyal doğuyordu.)
import { RADAR_IDS, RADAR_META, SIGNAL_FAMILIES as F } from './config.js';
import { aggregateSignals } from './signalFamilies.js';
import { qualityFromParts } from './dataQuality.js';
import { num, clamp, round1, radarOutput, favoriteOfScores, directionOf } from './util.js';

const SRC = 'FootyStats sezon xG verileri';

// Sayısal güvenlik sınırı (veri hatasına karşı): gerçek futbol xG'leri bu
// bandın içindedir; bandın dışı model patlatmasın diye kırpılır.
const LAMBDA_MIN = 0.15;
const LAMBDA_MAX = 4.5;
const POISSON_MAX_GOALS = 10;

// Pozitif xG: 0 veya negatif = "kaynakta veri yok" (sezon başı junk'ı dahil).
// Gerçek bir takımın sezon xG'si tam 0.00 olamaz; 0'ı veri saymak, yeni
// sezonda sıfırlardan uydurma skor üretilmesine yol açıyordu.
const posXg = (v) => {
  const n = num(v);
  return n != null && n > 0 ? n : null;
};

// Bağımsız çift Poisson'dan 1/X/2 yüzdeleri. Toplam TAM 100 (en büyük kalan).
// Saf ve test edilebilir — dışarıdan λ alır, veri bilmez.
export function poissonScores(lambdaHome, lambdaAway, { maxGoals = POISSON_MAX_GOALS } = {}) {
  const lh = clamp(num(lambdaHome) ?? 0, LAMBDA_MIN, LAMBDA_MAX);
  const la = clamp(num(lambdaAway) ?? 0, LAMBDA_MIN, LAMBDA_MAX);
  const pmf = (l) => {
    const out = [];
    let p = Math.exp(-l);
    for (let k = 0; k <= maxGoals; k += 1) { out.push(p); p = (p * l) / (k + 1); }
    return out;
  };
  const ph = pmf(lh), pa = pmf(la);
  let H = 0, D = 0, A = 0;
  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      const p = ph[i] * pa[j];
      if (i > j) H += p; else if (i === j) D += p; else A += p;
    }
  }
  const tot = H + D + A;                        // ızgara kesmesi normalize edilir
  const raw = { home: (H / tot) * 100, draw: (D / tot) * 100, away: (A / tot) * 100 };
  const floors = { home: Math.floor(raw.home), draw: Math.floor(raw.draw), away: Math.floor(raw.away) };
  let rem = 100 - (floors.home + floors.draw + floors.away);
  const order = ['home', 'draw', 'away'].sort((x, y) => (raw[y] - floors[y]) - (raw[x] - floors[x]));
  for (let i = 0; i < order.length && rem > 0; i += 1) { floors[order[i]] += 1; rem -= 1; }
  return floors;
}

export function computeExpectationRadar(m, { observedAt } = {}) {
  const meta = RADAR_META[RADAR_IDS.EXPECTATION];
  const h = m?.stats?.home?.season || null;
  const a = m?.stats?.away?.season || null;

  const hXg = posXg(h?.xgFor), aXg = posXg(a?.xgFor);
  const hXga = posXg(h?.xgAgainst), aXga = posXg(a?.xgAgainst);

  if (hXg == null || aXg == null) {
    return radarOutput({
      id: RADAR_IDS.EXPECTATION, name: meta.name, version: meta.version,
      hasData: false, status: 'insufficient', dataQuality: 0,
      missingSignals: [{ key: 'xg', label: 'xG / xGA verisi', reason: 'Bu maç için kullanılabilir xG verisi yok (sezon başında kaynak 0 döndürür) — radar devre dışı; rastgele xG üretilmez.' }],
      note: 'xG verisi olmadan beklenti-gerçeklik analizi yapılmaz.',
    });
  }

  const signals = [];
  const positives = [];
  const negatives = [];
  const missing = [];
  const add = (key, label, side, weight, note, family = F.GOALS_XG) =>
    signals.push({ key, family, label, side, weight, note: note || null, source: SRC, observedAt: observedAt || null });

  // İç/dış saha ayrımlı xG tercih edilir; yoksa genel değere düşülür.
  const hAtt = posXg(h?.xgForHome) ?? hXg;          // evin iç saha hücum xG'si
  const aAtt = posXg(a?.xgForAway) ?? aXg;          // deplasmanın dış saha hücum xG'si
  const hDef = posXg(h?.xgAgainstHome) ?? hXga;     // evin iç sahada yediği xGA (null olabilir)
  const aDef = posXg(a?.xgAgainstAway) ?? aXga;     // deplasmanın dış sahada yediği xGA (null olabilir)

  // Yeni lig koruması için GÜNCEL sezon oynanan maç (standing'den).
  const playedOf = (s) => (s ? (num(s.played) ?? ((s.wins || 0) + (s.draws || 0) + (s.losses || 0))) : 0);
  const hPlayed = playedOf(m?.stats?.home?.standing), aPlayed = playedOf(m?.stats?.away?.standing);
  const MIN_PLAYED = 4;

  // ---- SKORLAR: POISSON xG MODELİ -----------------------------------------
  // Rakip savunma verisi varsa hücum ile ortalanır; yoksa hücum xG'si tek
  // başına kullanılır (o da maç başı gerçek beklentidir — uydurma değildir).
  const lambdaHome = aDef != null ? (hAtt + aDef) / 2 : hAtt;
  const lambdaAway = hDef != null ? (aAtt + hDef) / 2 : aAtt;
  const scores = poissonScores(lambdaHome, lambdaAway);
  const fav = favoriteOfScores(scores);

  // ---- SİNYALLER (yalnız AÇIKLAMA + risk katkısı; skor üretmezler) --------
  // 1) xG üstünlüğü (hücum beklentisi, saha ayarlı)
  const attDiff = hAtt - aAtt;
  if (Math.abs(attDiff) >= 0.25) {
    add('xgAttack', 'xG hücum üstünlüğü (saha ayarlı)', attDiff > 0 ? 'home' : 'away', Math.min(9, Math.abs(attDiff) * 8),
      `xG ${round1(hAtt)} vs ${round1(aAtt)}`);
  } else if (hPlayed >= MIN_PLAYED && aPlayed >= MIN_PLAYED) {
    // Bilgilendirme: xG'ler yakın (skorlara etkisi Poisson'dan doğal gelir).
    add('xgClose', 'xG beklentileri çok yakın', 'draw', 4, `xG ${round1(hAtt)} vs ${round1(aAtt)}`);
  }

  // 2) xGA savunma beklentisi
  if (hDef != null && aDef != null) {
    const defDiff = aDef - hDef;                       // + → ev savunması daha iyi
    if (Math.abs(defDiff) >= 0.3) {
      add('xgaDefense', 'xGA savunma üstünlüğü', defDiff > 0 ? 'home' : 'away', Math.min(6, Math.abs(defDiff) * 5),
        `xGA ${round1(hDef)} vs ${round1(aDef)}`);
    }
  }

  // 3) Gol – xG sapması: SÜRDÜRÜLEBİLİRLİK. Aşırı pozitif sapma = hak etmeden
  //    skor üretme eğilimi (sahte parlaklık) → regresyon riski.
  const overperf = (t, xg) => {
    const gpg = num(t?.goalsPerGame);
    return gpg != null && xg != null ? gpg - xg : null;
  };
  const hOver = overperf(h, hXg), aOver = overperf(a, aXg);
  if (hOver != null && hOver >= 0.35) {
    add('homeOverperfAttack', 'Ev sahibi golde xG üstü (sürdürülemez olabilir)', 'away', Math.min(6, hOver * 6),
      `Gol/maç ${round1(num(h.goalsPerGame))} · xG ${round1(hXg)}`);
    negatives.push(`Ev sahibi xG'sinin ${round1(hOver)} gol üzerinde skor üretiyor — regresyon riski.`);
  }
  if (aOver != null && aOver >= 0.35) {
    add('awayOverperfAttack', 'Deplasman golde xG üstü (sürdürülemez olabilir)', 'home', Math.min(6, aOver * 6), null);
  }
  if (hOver != null && hOver <= -0.3) {
    add('homeUnderperf', 'Ev sahibi hak ettiği golü bulamıyor (pozitif regresyon)', 'home', Math.min(5, -hOver * 5),
      `xG ${round1(hXg)} · gol/maç ${round1(num(h.goalsPerGame))}`);
    positives.push('Ev sahibi ürettiği pozisyona göre az gol atmış — toparlanma beklenebilir.');
  }
  if (aOver != null && aOver <= -0.3) {
    add('awayUnderperf', 'Deplasman hak ettiği golü bulamıyor (pozitif regresyon)', 'away', Math.min(5, -aOver * 5), null);
  }

  // 4) Yenilen gol – xGA sapması (kaleci/şans etkisi VEKİL göstergesi).
  const defGap = (t, xga) => {
    const cpg = num(t?.concededPerGame);
    return cpg != null && xga != null ? cpg - xga : null;
  };
  const hDefGap = defGap(h, hXga), aDefGap = defGap(a, aXga);
  if (hDefGap != null && hDefGap <= -0.3) {
    add('homeDefOverperf', 'Ev sahibi beklenenden az gol yiyor (sürdürülemez olabilir)', 'away', 3,
      `Yediği ${round1(num(h.concededPerGame))} · xGA ${round1(hXga)}`);
  }
  if (aDefGap != null && aDefGap <= -0.3) {
    add('awayDefOverperf', 'Deplasman beklenenden az gol yiyor (sürdürülemez olabilir)', 'home', 3, null);
  }

  // 5) Şut kalitesi: xG / şut (varsa)
  const hShots = num(h?.avg?.shots), aShots = num(a?.avg?.shots);
  if (hShots && aShots && hShots > 0 && aShots > 0) {
    const hQ = hXg / hShots, aQ = aXg / aShots;
    const d = hQ - aQ;
    if (Math.abs(d) >= 0.02) {
      add('shotQuality', 'Şut başına xG (pozisyon kalitesi)', d > 0 ? 'home' : 'away', 3,
        `${round1(hQ * 100) / 100} vs ${round1(aQ * 100) / 100} xG/şut`);
    }
  } else {
    missing.push({ key: 'shotQuality', label: 'Şut kalitesi', reason: 'Şut sayısı verisi yok.' });
  }

  // 6) Son dönem ↔ sezon geneli.
  //    * Kaynağın recentPpg alanı JUNK (herkese 0 döndürüyor) → gerçek sayılmaz.
  //    * GERÇEK kaynak: son 5 maç SONUCU (G/B/M form dizisi — uygulamada form
  //      rozetleri olarak gösterilen aynı veri). Puan/maç = (3×G + 1×B) / n.
  //      Bu türetmedir, uydurma değildir: gerçek sonuçların standart puanlaması.
  //    * İkisi de yoksa trend üretilmez ve dürüstçe "eksik" raporlanır.
  const recentFromLast5 = (side) => {
    const arr = m?.stats?.[side]?.last5;
    if (!Array.isArray(arr) || arr.length < 4) return null;   // 1-2 maçlık "trend" gürültüdür
    const pts = arr.reduce((s, r) => s + (r === 'G' ? 3 : r === 'B' ? 1 : 0), 0);
    return pts / arr.length;
  };
  const trend = (t, side) => {
    const rec = num(t?.recentPpg);
    if (rec != null && rec > 0) return { val: rec, src: SRC };
    const derived = recentFromLast5(side);
    return derived != null ? { val: derived, src: 'Son 5 maç sonucu (form)' } : null;
  };
  const hT = trend(h, 'home'), aT = trend(a, 'away');
  const hRec = hT?.val ?? null, aRec = aT?.val ?? null;
  const hSeasonPpg = m?.stats?.home?.standing ? num(m.stats.home.standing.ppg) : null;
  const aSeasonPpg = m?.stats?.away?.standing ? num(m.stats.away.standing.ppg) : null;
  const addTrend = (key, label, side, val, seasonPpg, src) => {
    signals.push({ key, family: F.FORM, label, side, weight: 3,
      note: `Son dönem ${round1(val)} · sezon ${round1(seasonPpg)} puan/maç`,
      source: src, observedAt: observedAt || null });
  };
  if (hRec != null && hSeasonPpg != null) {
    if (hRec - hSeasonPpg <= -0.5) addTrend('homeRecentDrop', 'Ev sahibinin son dönemi sezonun altında', 'away', hRec, hSeasonPpg, hT.src);
    else if (hRec - hSeasonPpg >= 0.5) addTrend('homeRecentRise', 'Ev sahibinin son dönemi sezonun üstünde', 'home', hRec, hSeasonPpg, hT.src);
  }
  if (aRec != null && aSeasonPpg != null) {
    if (aRec - aSeasonPpg >= 0.5) addTrend('awayRecentRise', 'Deplasmanın son dönemi sezonun üstünde', 'away', aRec, aSeasonPpg, aT.src);
    else if (aRec - aSeasonPpg <= -0.5) addTrend('awayRecentDrop', 'Deplasmanın son dönemi sezonun altında', 'home', aRec, aSeasonPpg, aT.src);
  }
  if (hRec == null && aRec == null) {
    missing.push({ key: 'recentTrend', label: 'Son dönem form trendi', reason: 'Kaynak son dönem alanını boş döndürüyor ve son maç sonuçları (form) verisi de yok — trend üretilmez (uydurma trend yok).' });
  }

  // Kaynakta YAPISAL OLARAK olmayan (kalıcı) alanlar.
  missing.push({ key: 'bigChances', label: 'Büyük pozisyon verisi', availability: 'unsupported', reason: 'Kaynakta büyük pozisyon kırılımı yok.' });
  missing.push({ key: 'goalkeeper', label: 'Kaleci kurtarış performansı', availability: 'unsupported', reason: 'Gerçek kaleci metriği kaynağı yok; yalnız xGA sapması vekil olarak kullanıldı.' });

  const { applied, families } = aggregateSignals(signals);

  // SAHTE FAVORİ analizi: bültendeki mevcut favorinin (analysis.favorite)
  // model tarafında karşılığı zayıfsa favori kazanamama riski yükselir.
  // Taban = 100 − favorinin MODEL olasılığı (X ve karşı taraf zaten içinde;
  // beraberlik ayrıca eklenmez — çifte sayım olmaz).
  const marketFav = m?.analysis?.favorite?.symbol || null;
  let failureRisk = null;
  let fakeFavorite = false;
  if (scores) {
    const favSideScore = marketFav === '1' ? scores.home
      : marketFav === '2' ? scores.away
        : marketFav === 'X' ? scores.draw
          : (fav ? fav.percent : null);
    const base = favSideScore != null ? 100 - favSideScore : 50;
    let bump = 0;
    if (marketFav === '1') {
      if (attDiff <= 0) { bump += 12; fakeFavorite = true; negatives.push('Favori ev sahibinin xG üstünlüğü yok — beklenti sonucu desteklemiyor.'); }
      if (hOver != null && hOver >= 0.35) { bump += 10; fakeFavorite = true; }
    } else if (marketFav === '2') {
      if (attDiff >= 0) { bump += 12; fakeFavorite = true; negatives.push('Favori deplasmanın xG üstünlüğü yok — beklenti sonucu desteklemiyor.'); }
      if (aOver != null && aOver >= 0.35) { bump += 10; fakeFavorite = true; }
    }
    failureRisk = clamp(Math.round(base * 0.8 + bump), 0, 100);
  }

  const dq = qualityFromParts([
    { ok: true, weight: 35 },                                    // xG mevcut (buraya gelindiyse)
    { ok: hXga != null && aXga != null, weight: 20 },
    { ok: posXg(h?.xgForHome) != null && posXg(a?.xgForAway) != null, weight: 15 },
    { ok: num(h?.goalsPerGame) != null && num(a?.goalsPerGame) != null, weight: 15 },
    { ok: !!(hShots && aShots), weight: 10 },
    { ok: hRec != null || aRec != null, weight: 5 },
  ]);

  const dir = directionOf(scores, fav?.symbol);
  return radarOutput({
    id: RADAR_IDS.EXPECTATION, name: meta.name, version: meta.version,
    hasData: !!scores, status: scores ? 'ok' : 'insufficient', dataQuality: dq,
    scores, favoriteFailureRisk: failureRisk,
    direction: dir.direction, surpriseDirection: dir.surpriseDirection,
    activeSignals: applied, missingSignals: missing,
    positives, negatives, families,
    sources: [{ name: SRC, observedAt: observedAt || null }],
    details: {
      fakeFavorite,
      xg: { home: round1(hAtt), away: round1(aAtt) },
      goalMinusXg: { home: hOver != null ? round1(hOver) : null, away: aOver != null ? round1(aOver) : null },
      xgModel: {
        method: 'independent-poisson-0-10',
        lambdaHome: Math.round(lambdaHome * 100) / 100,
        lambdaAway: Math.round(lambdaAway * 100) / 100,
        note: 'Skorlar saha-ayarlı gerçek xG değerlerinden Poisson modeliyle türetilir; iç saha avantajı verinin içinden gelir.',
      },
    },
  });
}
