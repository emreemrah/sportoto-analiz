// RADAR 5 — BÜLTEN HAFIZASI RADARI (yardımcı sinyal)
// Kaynak: değişmez arşiv (tamamlanmış bültenlerin resmî sonuçları + mühürlü
// değerlendirmeler) ve /api/archive/position-stats altyapısı.
// ÇOK ÖNEMLİ: Bülten sırası SPORTİF NEDEN DEĞİLDİR. Bu radar hiçbir zaman tek
// başına güçlü tahmin/sürpriz üretmez; en düşük ağırlıklı yardımcı sinyaldir ve
// ekranda "Tarihsel yardımcı sinyal; tek başına tahmin gerekçesi değildir"
// açıklamasıyla gösterilir. Arşiv boş/az ise dürüstçe bildirilir.
import { RADAR_IDS, RADAR_META, SIGNAL_FAMILIES as F, sampleConfidence } from './config.js';
import { qualityFromParts } from './dataQuality.js';
import { clamp, radarOutput } from './util.js';

export const MEMORY_DISCLAIMER = 'Tarihsel yardımcı sinyal; tek başına tahmin gerekçesi değildir.';

// BÜLTEN GENELİ hafıza bağlamı: evaluations (mühürlü değerlendirmeler) +
// positionStats (resmî sonuç dağılımı) → sıra bazlı istatistikler.
// Saf fonksiyon: dışarıdan veri alır, ağ/DB bilmez.
export function buildMemoryContext({ positionStats = null, evaluations = [] } = {}) {
  const perPosition = new Map();
  for (const p of positionStats?.positions || []) {
    perPosition.set(p.position, {
      position: p.position, sample: p.sample, counts: p.counts, pct: p.pct,
      confidence: sampleConfidence(p.sample),
      favorite: { sample: 0, won: 0 },
      bankoBreaks: 0, bankoTotal: 0,
    });
  }

  let surpriseTotal = 0, bulletinCount = 0;
  const segments = {
    first5: { label: 'İlk 5 (1-5)', favSample: 0, favWon: 0 },
    mid5: { label: 'Orta 5 (6-10)', favSample: 0, favWon: 0 },
    last5: { label: 'Son 5 (11-15)', favSample: 0, favWon: 0 },
  };
  const segOf = (no) => (no <= 5 ? 'first5' : no <= 10 ? 'mid5' : 'last5');

  for (const ev of evaluations || []) {
    let surprises = 0, counted = false;
    for (const em of ev.matches || []) {
      if (em.no == null) continue;
      if (!perPosition.has(em.no)) {
        perPosition.set(em.no, {
          position: em.no, sample: 0, counts: { '1': 0, X: 0, '2': 0 }, pct: null,
          confidence: sampleConfidence(0), favorite: { sample: 0, won: 0 }, bankoBreaks: 0, bankoTotal: 0,
        });
      }
      const rec = perPosition.get(em.no);
      if (em.favoriteHit != null) {
        rec.favorite.sample += 1;
        if (em.favoriteHit) rec.favorite.won += 1;
        const seg = segments[segOf(em.no)];
        seg.favSample += 1;
        if (em.favoriteHit) seg.favWon += 1;
        if (!em.favoriteHit) surprises += 1;
        counted = true;
      }
      if (em.radarLabel === 'BANKO' && em.favoriteHit != null) {
        rec.bankoTotal += 1;
        if (!em.favoriteHit) rec.bankoBreaks += 1;
      }
    }
    if (counted) { surpriseTotal += surprises; bulletinCount += 1; }
  }

  const positions = [...perPosition.values()].sort((a, b) => a.position - b.position).map((r) => ({
    ...r,
    favoriteWinRate: r.favorite.sample ? Math.round((r.favorite.won / r.favorite.sample) * 100) : null,
    favoriteConfidence: sampleConfidence(r.favorite.sample),
  }));

  const bankoBreakPositions = positions
    .filter((p) => p.bankoTotal >= 3 && p.bankoBreaks > 0)
    .sort((a, b) => (b.bankoBreaks / b.bankoTotal) - (a.bankoBreaks / a.bankoTotal))
    .slice(0, 3)
    .map((p) => ({ position: p.position, breaks: p.bankoBreaks, total: p.bankoTotal }));

  return {
    hasData: positions.some((p) => p.sample > 0 || p.favorite.sample > 0),
    sampleBulletins: positionStats?.sampleBulletins ?? bulletinCount,
    evaluatedBulletins: bulletinCount,
    positions,
    segments: Object.fromEntries(Object.entries(segments).map(([k, s]) => [k, {
      label: s.label, sample: s.favSample,
      favoriteWinRate: s.favSample ? Math.round((s.favWon / s.favSample) * 100) : null,
      confidence: sampleConfidence(s.favSample),
    }])),
    avgSurprisesPerBulletin: bulletinCount ? Math.round((surpriseTotal / bulletinCount) * 10) / 10 : null,
    bankoBreakPositions,
    roundRange: positionStats?.roundRange || null,
  };
}

// TEK MAÇ için hafıza sinyali. memoryContext: buildMemoryContext çıktısı.
export function computeBulletinMemoryRadar(m, { memoryContext = null, observedAt } = {}) {
  const meta = RADAR_META[RADAR_IDS.MEMORY];

  if (!memoryContext?.hasData) {
    return radarOutput({
      id: RADAR_IDS.MEMORY, name: meta.name, version: meta.version,
      hasData: false, status: 'insufficient', dataQuality: 0,
      missingSignals: [{ key: 'archive', label: 'Geçmiş bülten arşivi', reason: 'Henüz yeterli geçmiş bülten yok — arşiv doldukça bu radar devreye girer.' }],
      note: `Henüz yeterli geçmiş bülten yok. ${MEMORY_DISCLAIMER}`,
    });
  }

  const pos = memoryContext.positions.find((p) => p.position === m.no) || null;
  // Sıra DNA'sı (geçmiş 1/X/2 dağılımı) YETERLİ ÖRNEKLEMLE kullanılabilir. Favori
  // kazanma oranı (mühürlü ileri-test karnesi) BONUS bağlamdır — zorunlu değil;
  // ilk mühürlü haftalar sonuçlandıkça eklenir. Eskiden usable tümüyle favoriye
  // bağlıydı, bu yüzden 143 örneklemlik sıra DNA'sı olsa bile "yetersiz" görünüyordu.
  const posUsable = !!(pos && (pos.sample || 0) >= 10 && pos.pct);
  const favUsable = !!(pos && pos.favoriteConfidence?.usable && pos.favoriteWinRate != null);
  // İKİ kaynaktan HERHANGİ biri yeterliyse radar kullanılabilir: sıra DNA'sı
  // (143 haftalık resmî sonuç dağılımı) VEYA mühürlü favori karnesi. Yalnız
  // posUsable'a bağlamak, DNA'sız ama karneli dönemde radarı yanlışça kapatır.
  const usable = posUsable || favUsable;

  // Bu radar YÖN skoru üretmez (home/draw/away null): bülten sırası sportif
  // neden olmadığı için taraf puanına çevrilmez. Yalnız favori kazanamama
  // riskine KÜÇÜK bir bağlam katkısı verir + bilgi üretir.
  let failureRisk = null;
  const positives = [];
  const negatives = [];
  if (favUsable) {
    // Tarihsel favori kazanma oranı → hafif risk bağlamı (50 = nötr çevresi).
    failureRisk = clamp(Math.round(100 - pos.favoriteWinRate), 0, 100);
    const conf = pos.favoriteConfidence.label;
    const line = `Geçmişte ${pos.position}. sıradaki maçlarda favori %${pos.favoriteWinRate} kazandı (n=${pos.favorite.sample}, ${conf}).`;
    if (pos.favoriteWinRate < 50) negatives.push(line); else positives.push(line);
  } else if (posUsable) {
    // Favori karnesi henüz yok ama sıra DNA'sı var → 1/X/2 dağılımını bilgi olarak sun.
    positives.push(`Geçmişte ${pos.position}. sırada sonuç dağılımı: 1 %${pos.pct['1']} · X %${pos.pct.X} · 2 %${pos.pct['2']} (n=${pos.sample}). Favori kazanma karnesi, mühürlü haftalar sonuçlandıkça eklenecek.`);
  }
  const bankoBreak = memoryContext.bankoBreakPositions.find((b) => b.position === m.no);
  if (bankoBreak) {
    negatives.push(`Bu sıra geçmişte "güçlü adayı bozan" sıralardan: ${bankoBreak.breaks}/${bankoBreak.total} güçlü aday tutmadı.`);
  }

  const dq = qualityFromParts([
    { ok: usable, weight: 50 },
    { ok: (pos?.sample || 0) >= 10, weight: 25 },
    { ok: memoryContext.evaluatedBulletins >= 5, weight: 25 },
  ]);

  return radarOutput({
    id: RADAR_IDS.MEMORY, name: meta.name, version: meta.version,
    hasData: !!usable, status: usable ? 'ok' : 'insufficient',
    dataQuality: dq,
    scores: null,                                 // yön puanı ÜRETMEZ (tasarım gereği)
    favoriteFailureRisk: failureRisk,
    direction: null, surpriseDirection: null,
    activeSignals: usable ? [{
      key: 'positionHistory', family: F.MEMORY, label: `${m.no}. sıra tarihsel dağılımı`, side: null,
      weight: 2, note: pos?.pct ? `1 %${pos.pct['1']} · X %${pos.pct.X} · 2 %${pos.pct['2']} (n=${pos.sample})` : null,
      source: 'Değişmez bülten arşivi (resmî sonuçlar)', observedAt: observedAt || null,
    }] : [],
    missingSignals: usable ? [] : [{ key: 'positionSample', label: `${m.no}. sıra örneklemi`, reason: `Sıra örneklemi ${pos?.sample ?? 0} maç — ${sampleConfidence(pos?.sample ?? 0).label}.` }],
    positives, negatives,
    sources: [{ name: 'Değişmez bülten arşivi', observedAt: observedAt || null }],
    details: {
      disclaimer: MEMORY_DISCLAIMER,
      position: pos ? {
        position: pos.position, sample: pos.sample, counts: pos.counts, pct: pos.pct,
        favoriteWinRate: pos.favoriteWinRate, favoriteSample: pos.favorite.sample,
        confidence: pos.favoriteConfidence,
      } : null,
      segment: memoryContext.segments[m.no <= 5 ? 'first5' : m.no <= 10 ? 'mid5' : 'last5'] || null,
      avgSurprisesPerBulletin: memoryContext.avgSurprisesPerBulletin,
      sampleBulletins: memoryContext.sampleBulletins,
    },
    note: MEMORY_DISCLAIMER,
  });
}
