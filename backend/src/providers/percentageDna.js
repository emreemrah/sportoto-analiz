// OYNANMA YÜZDESİ DNA'SI — bantlı benzerlik + geri çekilme hiyerarşisi.
// ---------------------------------------------------------------------------
// "1 tercihi %70–74 kapanan ve açılıştan ≥+8 yükselen benzer maçlarda sonuç
//  dağılımı" tipi sorgular. Birebir yüzde aramak örneklemi öldürür → sürümlü
// BANTLAR kullanılır. Karışım kuralı: ham başarı SAĞLAYICI BAZINDA ölçülür;
// sağlayıcılar arası yalnız medyan/uzlaşma analizi yapılır.
// Geri çekilme: 1) sağlayıcı+sıra+bant+hareket → 2) sağlayıcı+segment+bant →
// 3) sağlayıcı+bant → 4) n<10 ise YÖN SİNYALİ YOK.
export const PCT_DNA_VERSION = 'played-pct-dna-1.0.0';

export const PCT_BANDS = {
  version: PCT_DNA_VERSION,
  // Kapanış yüzdesi bantları (favori tercih payı)
  closeBands: [[0, 39], [40, 49], [50, 59], [60, 69], [70, 74], [75, 84], [85, 100]],
  // Açılış→mühür hareket bantları (puan)
  moveBands: [[-100, -8], [-7.9, -3], [-2.9, 2.9], [3, 7.9], [8, 100]],
  minDirectionalSample: 10,
};

export const bandOfClose = (v) => PCT_BANDS.closeBands.find(([a, b]) => v >= a && v <= b) || null;
export const bandOfMove = (v) => PCT_BANDS.moveBands.find(([a, b]) => v >= a && v <= b) || null;
const segOf = (no) => (no <= 5 ? 'first5' : no <= 10 ? 'mid5' : 'last5');

// records: doğrulanmış geçmiş kayıtlar
// [{ provider, position, outcome('1'|'X'|'2'), closePct: {'1',X,'2'},
//    openPct?: {...}, favoriteSymbol, result }]
// query: { provider, position, favoriteSymbol, closeValue, moveValue }
export function findSimilarDna(records, query, bands = PCT_BANDS) {
  const cb = bandOfClose(query.closeValue);
  const mb = query.moveValue != null ? bandOfMove(query.moveValue) : null;
  if (!cb) return { hasData: false, reason: 'no_band' };

  const base = (records || []).filter((r) =>
    r.provider === query.provider &&                       // sağlayıcılar karışmaz
    r.result && r.favoriteSymbol === query.favoriteSymbol &&
    r.closePct?.[query.favoriteSymbol] != null &&
    r.closePct[query.favoriteSymbol] >= cb[0] && r.closePct[query.favoriteSymbol] <= cb[1]);

  const withMove = (list) => (mb == null ? list : list.filter((r) => {
    if (r.openPct?.[query.favoriteSymbol] == null) return false;
    const mv = r.closePct[query.favoriteSymbol] - r.openPct[query.favoriteSymbol];
    return mv >= mb[0] && mv <= mb[1];
  }));

  const levels = [
    { key: 'provider+position+band+move', list: withMove(base.filter((r) => r.position === query.position)) },
    { key: 'provider+segment+band', list: base.filter((r) => segOf(r.position) === segOf(query.position)) },
    { key: 'provider+band', list: base },
  ];
  for (const lvl of levels) {
    if (lvl.list.length >= bands.minDirectionalSample) {
      const counts = { '1': 0, X: 0, '2': 0 };
      for (const r of lvl.list) counts[r.result] += 1;
      const n = lvl.list.length;
      const pct = { '1': Math.round((counts['1'] / n) * 100), X: Math.round((counts.X / n) * 100), '2': Math.round((counts['2'] / n) * 100) };
      return {
        hasData: true, level: lvl.key, sample: n, counts, pct,
        favoriteWinRate: pct[query.favoriteSymbol],
        note: `Benzer ${n} doğrulanmış maç (${lvl.key}).`,
        version: bands.version,
      };
    }
  }
  // n<10: yön sinyali ÜRETİLMEZ — yalnız dürüst bilgi.
  const best = levels[0].list.length || levels[1].list.length || levels[2].list.length;
  return { hasData: false, reason: 'insufficient_sample', sample: best, note: 'Benzer doğrulanmış örnek henüz yetersiz (n<10) — sistem öğreniyor.' };
}

// Sağlayıcılar arası uzlaşma/çatışma (yalnız ortak analiz — ham veri ayrı kalır).
export function providerConsensus(perProviderClose) {
  const entries = Object.entries(perProviderClose || {}).filter(([, p]) => p);
  if (entries.length < 2) return { hasData: false, reason: 'single_provider' };
  const per = entries.map(([id, p]) => ({ id, top: ['1', 'X', '2'].sort((a, b) => p[b] - p[a])[0], pct: p }));
  const tops = new Set(per.map((x) => x.top));
  const median = {};
  for (const k of ['1', 'X', '2']) {
    const vals = per.map((x) => x.pct[k]).sort((a, b) => a - b);
    median[k] = vals[Math.floor(vals.length / 2)];
  }
  const spread = Math.max(...per.map((x) => x.pct[per[0].top])) - Math.min(...per.map((x) => x.pct[per[0].top]));
  return {
    hasData: true, providers: per, median, spread,
    consensus: tops.size === 1, conflict: tops.size > 1,
  };
}
