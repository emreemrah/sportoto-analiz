// TAKIM GÜÇ KARŞILAŞTIRMASI — radar grafiği EKSEN MANTIĞI (saf modül, RN yok).
//
// DÜRÜSTLÜK KURALLARI
//   • Yalnız iki takımın da GERÇEK verisi olan eksenler çizilir; eksik eksen
//     uydurulmaz, atlanır. 3'ten az eksen kalırsa grafik HİÇ çizilmez.
//   • Normalizasyon iki takımın KENDİ aralığında yapılır (büyük olan 100 alır);
//     mutlak bir "güç puanı" iddiası yoktur — görsel kıyas aracıdır.

const last5Points = (form) => {
  if (!Array.isArray(form) || !form.length) return null;
  const p = { G: 3, B: 1, M: 0 };
  const vals = form.map((r) => p[r]).filter((x) => x != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};

// Eksen tanımları: value(stats) gerçek değeri döndürür; higherBetter=false ise
// düşük değer iyidir (ör. yenilen gol) ve normalizasyonda ters çevrilir.
export const COMPARE_AXES = [
  { key: 'ppg',     label: 'Puan/Maç',    higherBetter: true,  value: (s) => num(s?.standing?.ppg) },
  { key: 'attack',  label: 'Gol/Maç',     higherBetter: true,  value: (s) => num(s?.season?.goalsPerGame) },
  { key: 'defense', label: 'Savunma',     higherBetter: false, value: (s) => num(s?.season?.concededPerGame) },
  { key: 'xg',      label: 'xG',          higherBetter: true,  value: (s) => num(s?.season?.xgFor) },
  { key: 'clean',   label: 'Temiz Kale',  higherBetter: true,  value: (s) => num(s?.season?.cleanSheetPct) },
  { key: 'form',    label: 'Form',        higherBetter: true,  value: (s) => last5Points(s?.last5) },
];

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// 0-100 kıyas değeri: büyük olan 100 alır; düşük-iyi eksende önce tersine çevrilir.
function pairScore(a, b, higherBetter) {
  let va = a, vb = b;
  if (!higherBetter) {
    // Düşük değer iyi: tersine çevir (0'a bölme koruması ile).
    const EPS = 0.05;
    va = 1 / Math.max(a, EPS);
    vb = 1 / Math.max(b, EPS);
  }
  const mx = Math.max(va, vb);
  if (mx <= 0) return [50, 50]; // ikisi de sıfır → eşit
  return [Math.round((va / mx) * 100), Math.round((vb / mx) * 100)];
}

/**
 * İki takımın istatistiklerinden çizilebilir eksen listesi üretir.
 * @returns [{key,label,home,away,rawHome,rawAway}] — 3'ten azsa [] (çizilmez).
 */
export function buildCompareAxes(homeStats, awayStats) {
  const axes = [];
  for (const ax of COMPARE_AXES) {
    const h = ax.value(homeStats);
    const a = ax.value(awayStats);
    if (h == null || a == null) continue;   // eksik veri → eksen atlanır
    const [hs, as] = pairScore(h, a, ax.higherBetter);
    axes.push({ key: ax.key, label: ax.label, home: hs, away: as, rawHome: h, rawAway: a });
  }
  return axes.length >= 3 ? axes : [];
}

/** SVG çokgen noktaları: merkez (cx,cy), yarıçap r, değerler 0-100. */
export function polygonPoints(values, cx, cy, r) {
  const n = values.length;
  return values.map((v, i) => {
    const ang = (-90 + (i * 360) / n) * (Math.PI / 180);
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
    return `${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`;
  }).join(' ');
}
