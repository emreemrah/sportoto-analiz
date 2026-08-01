// BÜLTEN SIRA DNA'SI — 1–15 sıra hafızası (yalnız DOĞRULANMIŞ resmî sonuçlar).
// ---------------------------------------------------------------------------
// Girdi: official_result_history maçları (resultValid=true) + isteğe bağlı
// official_forward değerlendirmeleri. ÖĞRENME SINIRI çağırana aittir:
// bir haftanın sonucu en erken SONRAKİ bültenden itibaren kullanılabilir
// (upToRoundCloseAt / excludeRoundId filtreleri).
// * Küçük örneklem: n<10 yalnız bilgi (yön sinyali YOK); shrinkage uygulanır.
// * "Tarihsel yardımcı sinyal; tek başına tahmin gerekçesi değildir."
export const DNA_METHODOLOGY_VERSION = 'position-dna-1.0.0';

export const SAMPLE_TIERS = [
  { min: 100, key: 'strong', label: 'Güçlü örneklem' },
  { min: 30, key: 'mid', label: 'Orta örneklem' },
  { min: 10, key: 'low', label: 'Düşük örneklem' },
  { min: 0, key: 'info', label: 'Yalnız bilgi — yön sinyali üretilmez' },
];
export const sampleTier = (n) => SAMPLE_TIERS.find((t) => n >= t.min);

const pct = (c, t) => (t ? Math.round((c / t) * 1000) / 10 : null);

// Bayesian shrinkage: küçük örneklem, GLOBAL dağılıma doğru çekilir (3/3 →
// "%100 güçlü eğilim" olarak sunulamaz). priorWeight ~ 20 sanal maç.
export function shrunkPct(counts, total, prior, priorWeight = 20) {
  if (!total) return null;
  const out = {};
  for (const k of ['1', 'X', '2']) {
    const p = prior?.[k] != null ? prior[k] / 100 : 1 / 3;
    out[k] = Math.round(((counts[k] + p * priorWeight) / (total + priorWeight)) * 1000) / 10;
  }
  return out;
}

function countWindow(list) {
  const counts = { '1': 0, X: 0, '2': 0 };
  for (const m of list) if (counts[m.result] != null) counts[m.result] += 1;
  const n = list.length;
  return {
    sample: n,
    counts,
    pct: n ? { '1': pct(counts['1'], n), X: pct(counts.X, n), '2': pct(counts['2'], n) } : null,
  };
}

// ---------------------------------------------------------------------------
// ANA HESAP — matches: [{position, result('1'|'X'|'2'), roundId, roundCloseAt,
// seasonYear}] (yalnız resultValid satırlar verilmeli).
// ---------------------------------------------------------------------------
export function computePositionDna(matches, {
  upToRoundCloseAt = null,      // öğrenme sınırı: bu tarihten (dahil değil) sonrası HARİÇ
  excludeRoundId = null,        // güncel haftanın kendisi asla dahil edilmez
  seasonYear = null,
} = {}) {
  const usable = (matches || []).filter((m) =>
    m?.result && ['1', 'X', '2'].includes(m.result) && m.position >= 1 && m.position <= 15
    && (excludeRoundId == null || String(m.roundId) !== String(excludeRoundId))
    && (seasonYear == null || String(m.seasonYear) === String(seasonYear))
    && (upToRoundCloseAt == null || (m.roundCloseAt && m.roundCloseAt < upToRoundCloseAt)));

  // Global dağılım (shrinkage prior'u + bülten başına ortalama).
  const globalW = countWindow(usable);
  const roundIds = [...new Set(usable.map((m) => String(m.roundId)))];
  const perBulletin = roundIds.length ? {
    '1': Math.round((globalW.counts['1'] / roundIds.length) * 10) / 10,
    X: Math.round((globalW.counts.X / roundIds.length) * 10) / 10,
    '2': Math.round((globalW.counts['2'] / roundIds.length) * 10) / 10,
  } : null;

  const positions = [];
  for (let pos = 1; pos <= 15; pos++) {
    // Yeniden → eskiye sıralı (pencereler son N BÜLTEN anlamına gelir).
    // roundCloseAt yoksa roundId sayısal sırası güvenilir yedek çapadır.
    const rows = usable.filter((m) => m.position === pos)
      .sort((a, b) => String(b.roundCloseAt || '').localeCompare(String(a.roundCloseAt || ''))
        || (Number(b.roundId) || 0) - (Number(a.roundId) || 0));

    // Pencereler EN SON tamamlanmış bültenden GERİYE doğru (rows yeniden→eskiye
    // sıralı). Güncel/sonuçlanmamış hafta çağıran tarafından zaten hariç.
    const windows = {
      last5: countWindow(rows.slice(0, 5)),
      last10: countWindow(rows.slice(0, 10)),
      last15: countWindow(rows.slice(0, 15)),
      last25: countWindow(rows.slice(0, 25)),
      last50: countWindow(rows.slice(0, 50)),
      allTime: countWindow(rows),
    };
    const tier = sampleTier(windows.allTime.sample);

    // Sezon kırılımı
    const bySeason = {};
    for (const m of rows) {
      const s = m.seasonYear || 'bilinmiyor';
      if (!bySeason[s]) bySeason[s] = { '1': 0, X: 0, '2': 0, n: 0 };
      bySeason[s][m.result] += 1; bySeason[s].n += 1;
    }

    // Eğilim: son 25 ile tüm zamanlar farkı (yeterli örneklemde).
    let trend = { key: 'flat', label: 'Yatay' };
    const rec = windows.last25, all = windows.allTime;
    if (rec.sample >= 10 && all.sample >= 30 && rec.pct && all.pct) {
      const deltas = { '1': rec.pct['1'] - all.pct['1'], X: rec.pct.X - all.pct.X, '2': rec.pct['2'] - all.pct['2'] };
      const top = Object.entries(deltas).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
      if (Math.abs(top[1]) >= 7) {
        trend = { key: top[1] > 0 ? 'rising' : 'falling', label: `${top[0]} ${top[1] > 0 ? 'yükseliyor' : 'düşüyor'}`, outcome: top[0], delta: Math.round(top[1] * 10) / 10 };
      }
    }

    positions.push({
      position: pos,
      segment: pos <= 5 ? 'first5' : pos <= 10 ? 'mid5' : 'last5',
      windows,
      shrunk: shrunkPct(windows.allTime.counts, windows.allTime.sample, globalW.pct),
      sample: windows.allTime.sample,
      sampleTier: tier.key,
      sampleLabel: tier.label,
      // n<10 → yön sinyali YOK (yalnız bilgi).
      directional: windows.allTime.sample >= 10,
      trend,
      bySeason,
    });
  }

  // Segment özetleri (İlk 5 / Orta 5 / Son 5)
  const segments = {};
  for (const seg of ['first5', 'mid5', 'last5']) {
    const rows = usable.filter((m) => (m.position <= 5 ? 'first5' : m.position <= 10 ? 'mid5' : 'last5') === seg);
    segments[seg] = countWindow(rows);
  }

  return {
    methodologyVersion: DNA_METHODOLOGY_VERSION,
    generatedAt: new Date().toISOString(),
    totalMatches: usable.length,
    totalBulletins: roundIds.length,
    global: globalW,
    perBulletinAvg: perBulletin,
    segments,
    positions,
    disclaimer: 'Tarihsel yardımcı sinyal; tek başına tahmin gerekçesi değildir.',
  };
}

// ---------------------------------------------------------------------------
// RADAR 5 KÖPRÜSÜ — resultsService.getPositionStats ile AYNI şekil:
// { positions: [{ position, sample, counts, pct }] }. Böylece Bülten DNA
// radarı formülü değişmeden yalnız KAYNAĞI güçlenir (official_result_history
// + gelecekte birikecek official_forward; legacy/backfill ASLA girmez).
// ---------------------------------------------------------------------------
export function positionStatsFromHistory(matches) {
  const per = new Map();
  for (const m of matches || []) {
    if (!m?.result || !['1', 'X', '2'].includes(m.result)) continue;
    if (!(m.position >= 1 && m.position <= 15)) continue;
    if (!per.has(m.position)) per.set(m.position, { position: m.position, sample: 0, counts: { '1': 0, X: 0, '2': 0 } });
    const r = per.get(m.position);
    r.sample += 1; r.counts[m.result] += 1;
  }
  const positions = [...per.values()].map((r) => ({
    ...r,
    pct: { '1': pct(r.counts['1'], r.sample), X: pct(r.counts.X, r.sample), '2': pct(r.counts['2'], r.sample) },
  })).sort((a, b) => a.position - b.position);
  return { positions };
}

export function mergePositionStats(a, b) {
  if (!a?.positions?.length) return b || a;
  if (!b?.positions?.length) return a;
  const per = new Map();
  for (const src of [a, b]) {
    for (const p of src.positions) {
      if (!per.has(p.position)) per.set(p.position, { position: p.position, sample: 0, counts: { '1': 0, X: 0, '2': 0 } });
      const r = per.get(p.position);
      r.sample += p.sample;
      for (const k of ['1', 'X', '2']) r.counts[k] += p.counts?.[k] || 0;
    }
  }
  const positions = [...per.values()].map((r) => ({
    ...r,
    pct: { '1': pct(r.counts['1'], r.sample), X: pct(r.counts.X, r.sample), '2': pct(r.counts['2'], r.sample) },
  })).sort((x, y) => x.position - y.position);
  return { positions };
}

// ---------------------------------------------------------------------------
// ÖĞRENME SINIRI FİLTRESİ (tek doğruluk kaynağı) — resmî roundId'ler zaman
// sırasıyla garanti monoton OLMADIĞINDAN önce kapanış tarihi karşılaştırılır;
// tarih yoksa roundId sayısal karşılaştırması güvenli yedektir. Güncel hafta
// HER DURUMDA dışarıda kalır (aynı haftanın sonucu aynı haftaya sızamaz).
// ---------------------------------------------------------------------------
export function historyLearningFilter({ currentRoundId = null, currentFreezeAt = null } = {}) {
  return (m) => {
    if (!m?.resultValid) return false;
    if (currentRoundId != null && String(m.roundId) === String(currentRoundId)) return false;
    if (m.roundCloseAt && currentFreezeAt) return String(m.roundCloseAt) <= String(currentFreezeAt);
    if (currentRoundId != null) return Number(m.roundId) < Number(currentRoundId);
    return true;
  };
}

// Kullanıcı cümlesi: "14. sıradaki maçlar son 50 bültende: 1 %38 · X %34 · 2 %28 · n=50"
export function positionSummaryText(dna, position, windowKey = 'last50') {
  const p = dna?.positions?.find((x) => x.position === position);
  const w = p?.windows?.[windowKey];
  if (!w || !w.sample) return `${position}. sıra için yeterli doğrulanmış geçmiş sonuç yok.`;
  const wl = { last5: 'son 5', last10: 'son 10', last25: 'son 25', last50: 'son 50', allTime: 'tüm' }[windowKey] || windowKey;
  return `${position}. sıradaki maçlar ${wl} bültende: 1 %${w.pct['1']} · X %${w.pct.X} · 2 %${w.pct['2']} · n=${w.sample}`;
}
