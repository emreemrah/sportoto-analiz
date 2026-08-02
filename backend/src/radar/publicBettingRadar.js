// RADAR 3 — HALK OYNANMA YÜZDELERİ RADARI
// Kaynak: publicBettingProviders kayıtları + arşivdeki playedPct gözlemleri.
// GERÇEK KAYNAK YOKSA: hasData=false, status='no_source', skora katkı SIFIR;
// uydurma yüzde/geçmiş başarı ASLA gösterilmez (master kalan radarları
// yeniden normalize eder). Kaynak bağlandığında tüm analiz otomatik çalışır.
import { RADAR_IDS, RADAR_META, PUBLIC_BANDS, PUBLIC_MOVE_RULES, SIGNAL_FAMILIES as F, sampleConfidence } from './config.js';
import { aggregateSignals, sidesToScores } from './signalFamilies.js';
import { qualityFromParts } from './dataQuality.js';
import { num, clamp, round1, radarOutput, favoriteOfScores, directionOf } from './util.js';
import { publicSourceStatus } from './publicBettingProviders.js';
import { findSimilarDna } from '../providers/percentageDna.js';

// Bir yüzdenin düştüğü bant (config sürümlü).
export function bandOf(pct) {
  const p = num(pct);
  if (p == null) return null;
  return PUBLIC_BANDS.bands.find((b) => p >= b.min && p <= b.max) || null;
}

// GEÇMİŞ BANT BAŞARISI: arşivlenmiş playedPct gözlemleri + resmî sonuçlardan
// "%70-79 favori oynanma aralığı geçmişte kaç kez 1/X/2 bitti" istatistiği.
// rows: [{ favoritePct, favoriteSymbol, officialResult }] (yalnız gerçek arşiv verisi)
export function computeBandHistory(rows) {
  const bands = PUBLIC_BANDS.bands.map((b) => ({
    ...b, sample: 0, favoriteWon: 0, results: { '1': 0, X: 0, '2': 0 },
  }));
  for (const r of rows || []) {
    const band = bands.find((b) => r.favoritePct >= b.min && r.favoritePct <= b.max);
    if (!band || !r.officialResult) continue;
    band.sample += 1;
    band.results[r.officialResult] = (band.results[r.officialResult] || 0) + 1;
    if (r.favoriteSymbol && r.favoriteSymbol === r.officialResult) band.favoriteWon += 1;
  }
  return {
    version: PUBLIC_BANDS.version,
    hasData: bands.some((b) => b.sample > 0),
    bands: bands.map((b) => ({
      label: b.label, min: b.min, max: b.max, sample: b.sample,
      favoriteWinRate: b.sample ? Math.round((b.favoriteWon / b.sample) * 100) : null,
      results: b.results,
      confidence: sampleConfidence(b.sample),
    })),
  };
}

// matchPublicData: [{ providerId, providerName, percentages: {1,X,2}, observedAt }]
// serisi (zaman içinde birden çok gözlem olabilir; kaynak başına gruplanır).
export function computePublicBettingRadar(m, {
  matchPublicData = null, bandHistory = null, observedAt,
  pctDnaRecords = null, similarQuery = true,   // benzer DNA için doğrulanmış geçmiş kayıtlar
} = {}) {
  const meta = RADAR_META[RADAR_IDS.PUBLIC];
  const src = publicSourceStatus();
  const series = (matchPublicData || []).filter((o) => o?.percentages);

  if (!series.length) {
    // Kaynak durumu dürüstçe ayrılır: sağlayıcı hiç bağlı değil → 'accumulating'
    // (yapısal destek VAR, veri birikmedi); sağlayıcı var ama bu maçta gözlem
    // yok → 'match_missing'. Uydurma "nötr %50" ASLA üretilmez.
    return radarOutput({
      id: RADAR_IDS.PUBLIC, name: meta.name, version: meta.version,
      hasData: false, status: 'no_source', dataQuality: 0,
      missingSignals: [{
        key: 'publicPct', label: '1/X/2 oynanma yüzdeleri',
        reason: src.note || 'Bu maç için oynanma yüzdesi gözlemi yok.',
        availability: src.hasSource ? 'match_missing' : 'accumulating',
      }],
      note: src.hasSource ? 'Bu maç için oynanma yüzdesi gözlemi yok.' : 'Veri kaynağı bekleniyor',
      details: { providers: src.providers, bandsVersion: PUBLIC_BANDS.version },
    });
  }

  // Kaynak bazında ilk/son gözlem + değişim.
  const byProvider = new Map();
  for (const o of series) {
    const k = o.providerId || o.providerName || 'kaynak';
    if (!byProvider.has(k)) byProvider.set(k, []);
    byProvider.get(k).push(o);
  }
  const providerViews = [...byProvider.entries()].map(([k, list]) => {
    const sorted = list.slice().sort((x, y) => new Date(x.observedAt) - new Date(y.observedAt));
    const first = sorted[0], last = sorted[sorted.length - 1];
    // AÇILIŞ DÜRÜSTLÜĞÜ: yalnız kind==='opening' olan ilk gözlem gerçek açılıştır.
    // Sistem geç başladıysa (first_observed_late) açılış YOK sayılır — sahte
    // açılış üretilmez; kullanıcıya "ilk gözlem" olarak dürüstçe sunulur.
    const openingObs = sorted.find((o) => o.kind === 'opening') || null;
    const opening = openingObs ? { ...openingObs.percentages, observedAt: openingObs.observedAt } : null;
    const openingBasis = opening || { ...first.percentages, observedAt: first.observedAt };
    return {
      provider: last.providerName || k,
      first: { ...first.percentages, observedAt: first.observedAt },
      opening,                                   // gerçek açılış (yoksa null)
      openingMissingReason: opening ? null : (first.firstObservedLate ? 'first_observed_late' : 'no_opening_observation'),
      last: { ...last.percentages, observedAt: last.observedAt },   // güncel/mühür değeri
      change: {                                  // açılış (yoksa ilk gözlem) → güncel
        '1': round1((num(last.percentages['1']) ?? 0) - (num(openingBasis['1']) ?? 0)),
        X: round1((num(last.percentages.X) ?? 0) - (num(openingBasis.X) ?? 0)),
        '2': round1((num(last.percentages['2']) ?? 0) - (num(openingBasis['2']) ?? 0)),
      },
      observations: sorted.length,
    };
  });

  // Kaynaklar arası son değerlerin ortalama/medyanı + dağılım farkı.
  const lastVals = providerViews.map((p) => p.last);
  const avgOf = (key) => round1(lastVals.reduce((s, v) => s + (num(v[key]) ?? 0), 0) / lastVals.length);
  const medOf = (key) => {
    const arr = lastVals.map((v) => num(v[key]) ?? 0).sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return round1(arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2);
  };
  const consensus = { '1': avgOf('1'), X: avgOf('X'), '2': avgOf('2') };
  const median = { '1': medOf('1'), X: medOf('X'), '2': medOf('2') };
  const spread = Math.max(
    ...['1', 'X', '2'].map((k) => Math.max(...lastVals.map((v) => num(v[k]) ?? 0)) - Math.min(...lastVals.map((v) => num(v[k]) ?? 0))),
  );

  const top = ['1', 'X', '2'].map((k) => ({ k, v: consensus[k] })).sort((a, b) => b.v - a.v)[0];
  const overloaded = top.v >= PUBLIC_BANDS.overloadThreshold;
  const band = bandOf(top.v);
  const bandRow = bandHistory?.bands?.find((b) => b.label === band?.label) || null;

  const signals = [];
  const positives = [];
  const negatives = [];
  const sideOfSym = { '1': 'home', X: 'draw', '2': 'away' };

  // Halk eğilimi (bilgi değeri sınırlı — kontraryan sinyal ancak bant geçmişiyle):
  signals.push({
    key: 'publicLean', family: F.PUBLIC, label: `Halkın tercihi ${top.k} (%${top.v})`,
    side: sideOfSym[top.k], weight: 4, note: `Kaynak sayısı ${providerViews.length}`,
    source: providerViews.map((p) => p.provider).join(', '), observedAt: observedAt || null,
  });

  let failureBump = 0;
  if (overloaded) {
    negatives.push(`Halkın %${top.v}'i ${top.k === '1' ? 'ev sahibine' : top.k === '2' ? 'deplasmana' : 'beraberliğe'} yüklenmiş — aşırı yığılma sinyali.`);
    failureBump += 10;
    if (bandRow && bandRow.confidence.usable) {
      const line = `Geçmiş arşivde ${bandRow.label} aralığında ${bandRow.sample} maç var; favori kazanma oranı %${bandRow.favoriteWinRate}. ${bandRow.confidence.label} örneklem — diğer radarlarla birlikte değerlendirilmelidir.`;
      if (bandRow.favoriteWinRate != null && bandRow.favoriteWinRate < 60) {
        negatives.push(line);
        failureBump += Math.round((60 - bandRow.favoriteWinRate) / 3);
      } else {
        positives.push(line);
      }
    } else if (bandRow) {
      negatives.push(`Bu yığılma bandı için geçmiş örneklem ${bandRow.sample} maç (${bandRow.confidence.label}) — bant istatistiği karara katılmadı.`);
    }
  }
  if (spread >= 8) negatives.push(`Kaynaklar arasında %${round1(spread)} puana varan yüzde farkı var — oynanma verisi tutarsız (sağlayıcı çelişkisi).`);

  // AÇILIŞ → KAPANIŞ HAREKETİ (Oynanma DNA): seri yalnız donma öncesi geçerli
  // gözlemleri içerir (mühür filtresi radarService'te). Tek gözlemli seride
  // hareket ÜRETİLMEZ.
  //
  // İKİ AYRI OKUMA yapılır (radar-center-1.3.0):
  //  • YÜKSELİŞ: en çok yükselen taraf ≥ movePts ise o tarafa sinyal. Eski hâl
  //    yalnız EN BÜYÜK MUTLAK hareketi alıyordu; büyük bir düşüş (ör. 1 −17)
  //    beraberindeki yükselişleri (X +8, 2 +9) maskeliyor ve sinyal side:null
  //    olarak ATILIYORDU — kalabalık hareketinin skora etkisi sıfırdı.
  //  • DÜŞÜŞ: halkın FAVORİSİNDEKİ ≥ dropPts düşüş failureRisk'e katkı yapar
  //    ("para favoriden kaçıyor"). Sadece metin değil, ölçülebilir risk.
  //    Gerçek vaka: 52. Hafta Brugge–St.Gilloise, 1 %61→%44 — maç 1-1 bitti,
  //    favori yattı; eski sistemde bu hareketin sayısal etkisi yoktu.
  const movers = providerViews.filter((p) => p.observations >= 2);
  if (movers.length) {
    const avgMove = (k) => round1(movers.reduce((s, p) => s + (num(p.change[k]) ?? 0), 0) / movers.length);
    const moves = { '1': avgMove('1'), X: avgMove('X'), '2': avgMove('2') };
    const sirali = ['1', 'X', '2'].map((k) => ({ k, v: moves[k] }));
    const topRise = sirali.filter((m) => m.v > 0).sort((a, b) => b.v - a.v)[0] || null;
    const topDrop = sirali.filter((m) => m.v < 0).sort((a, b) => a.v - b.v)[0] || null;

    if (topRise && topRise.v >= PUBLIC_MOVE_RULES.movePts) {
      signals.push({
        key: 'publicMove', family: F.PUBLIC, label: `Oynanma hareketi: ${topRise.k} %${Math.abs(topRise.v)} yükseldi`,
        side: sideOfSym[topRise.k], weight: 3,
        note: 'Açılıştan kapanışa yüzde kayması', source: movers.map((p) => p.provider).join(', '),
        observedAt: observedAt || null,
      });
      (topRise.k === top.k ? positives : negatives).push(
        `Açılıştan bu yana ${topRise.k} oynanması %${Math.abs(topRise.v)} puan yükseldi — geç eğilim bu yönü destekliyor.`,
      );
    }
    // Favori-düşüş riski: düşen taraf halkın HÂLÂ favorisi olmalı (top.k) —
    // düşüş sonrası liderliği kaybettiyse zaten publicLean başka tarafı işaret
    // ediyor, aynı bilgiyi iki kez saymayız.
    if (topDrop && -topDrop.v >= PUBLIC_MOVE_RULES.dropPts && topDrop.k === top.k) {
      failureBump += PUBLIC_MOVE_RULES.dropFailureBump;
      negatives.push(
        `Açılıştan bu yana ${topDrop.k} oynanması %${Math.abs(topDrop.v)} puan düştü — para halkın favorisinden kaçıyor (risk katkısı +${PUBLIC_MOVE_RULES.dropFailureBump}).`,
      );
    } else if (topDrop && -topDrop.v >= PUBLIC_MOVE_RULES.movePts) {
      // Riske sayılmayan düşüş de dürüstçe yazılır (eski davranış korunur).
      negatives.push(
        `Açılıştan bu yana ${topDrop.k} oynanması %${Math.abs(topDrop.v)} puan düştü — geç eğilim bu yönden uzaklaşıyor.`,
      );
    }
  }

  const { sides, applied, families } = aggregateSignals(signals);
  const scores = sidesToScores(sides, { drawFloor: 12 });
  const fav = favoriteOfScores(scores);
  const failureRisk = scores ? clamp(Math.round((100 - (fav?.percent ?? 50)) * 0.5 + failureBump + 25), 0, 100) : null;

  const dq = qualityFromParts([
    { ok: true, weight: 40 },                                  // en az bir kaynak var
    { ok: providerViews.length >= 2, weight: 20 },             // çapraz kaynak
    { ok: providerViews.some((p) => p.observations >= 2), weight: 25 }, // zaman serisi
    { ok: !!bandHistory?.hasData, weight: 15 },                // geçmiş bant arşivi
  ]);

  const dir = directionOf(scores, fav?.symbol);

  // KULLANICI CÜMLESİ (Oynanma DNA): "Bilyoner'de ev sahibi tercihi şu anda %72.
  // Açılışa göre +9 puan yükseldi." — gerçek açılış varsa hareket eklenir.
  const primary = providerViews[0];
  const favSym = top.k;
  const sideWord = favSym === '1' ? 'ev sahibi' : favSym === '2' ? 'deplasman' : 'beraberlik';
  let userSentence = `${primary.provider}'de ${sideWord} tercihi şu anda %${num(primary.last[favSym]) ?? 0}.`;
  if (primary.opening) {
    const mv = round1((num(primary.last[favSym]) ?? 0) - (num(primary.opening[favSym]) ?? 0));
    if (Math.abs(mv) >= 1) userSentence += ` Açılışa göre ${mv > 0 ? '+' : ''}${mv} puan ${mv > 0 ? 'yükseldi' : 'düştü'}.`;
    else userSentence += ' Açılıştan bu yana belirgin değişim yok.';
  } else if (primary.openingMissingReason === 'first_observed_late') {
    userSentence += ' (Açılış anı kaçırıldığından açılış→kapanış değişimi hesaplanmadı.)';
  }

  // BENZER GEÇMİŞ DNA — sağlayıcı+sıra+bant+hareket geri çekilmesi. Yeterli
  // doğrulanmış geçmiş biriktiğinde "benzer N maçta 1/X/2" verir; yoksa dürüst
  // "sistem öğreniyor" (SAHTE başarı yüzdesi ASLA gösterilmez).
  let similarDna = { hasData: false, note: 'Oynanma verileri kaydediliyor · benzer sonuç analizi için sistem öğreniyor.' };
  if (similarQuery && pctDnaRecords?.length) {
    try {
      const q = {
        provider: primary.provider?.toLowerCase?.() || 'bilyoner',
        position: m.no, favoriteSymbol: favSym,
        closeValue: num(primary.last[favSym]) ?? 0,
        moveValue: primary.opening ? round1((num(primary.last[favSym]) ?? 0) - (num(primary.opening[favSym]) ?? 0)) : null,
      };
      similarDna = findSimilarDna(pctDnaRecords, q);
      if (similarDna.hasData) {
        similarDna.sentence = `Benzer ${similarDna.sample} doğrulanmış maçta sonuçlar: 1 %${similarDna.pct['1']} · X %${similarDna.pct.X} · 2 %${similarDna.pct['2']}`;
      }
    } catch { /* benzer DNA hesaplanamazsa dürüst öğreniyor mesajı kalır */ }
  }

  return radarOutput({
    id: RADAR_IDS.PUBLIC, name: meta.name, version: meta.version,
    hasData: true, status: 'ok', dataQuality: dq,
    scores, favoriteFailureRisk: failureRisk,
    direction: dir.direction, surpriseDirection: dir.surpriseDirection,
    activeSignals: applied, missingSignals: [],
    positives, negatives, families,
    sources: providerViews.map((p) => ({ name: p.provider, observedAt: p.last.observedAt })),
    details: {
      consensus, median, spread: round1(spread),
      overloaded, overloadThreshold: PUBLIC_BANDS.overloadThreshold,
      band: band?.label || null, bandStats: bandRow, bandsVersion: PUBLIC_BANDS.version,
      providers: providerViews,
      // Oynanma DNA özeti (kullanıcıya): ilk/açılış/güncel/mühür + değişim + kaynak.
      playedDna: {
        provider: primary.provider,
        firstObservation: primary.first,
        opening: primary.opening,
        openingMissingReason: primary.openingMissingReason,
        current: primary.last,
        change: primary.change,
        lastObservedAt: primary.last.observedAt,
        providerCount: providerViews.length,
        sampleCount: providerViews.reduce((s, p) => s + p.observations, 0),
        userSentence,
        similarDna,
        note: 'Oynanma yüzdesi kullanıcı tercihidir; oran DEĞİLDİR.',
      },
    },
  });
}
