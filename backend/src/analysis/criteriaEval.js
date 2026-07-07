// KRİTER SİNYAL DEĞERLENDİRİCİ (backend portu)
// app/src/analysis/criteria.js'teki evaluate mantığının SAF hali: UI metni yok,
// sadece kriter → sinyal ('1' | 'X' | '2' | null). Kriter karnesi (hangi kriter
// daha çok tutuyor) bu sinyallerin resmi sonuçla kıyasından hesaplanır.
//
// ⚠ app/src/analysis/criteria.js ile SENKRON tutulmalı: orada kriter mantığı
// değişirse burada da aynı değişiklik yapılmalı (key'ler birebir aynı).
//
// Girdi: stats = m.stats (enrich.js çıktısı; { home, away })
// Çıktı: { position: '1', formGeneral: '2', ... } — sinyal üretemeyen kriter
//        (veri yok / bilgi amaçlı) HİÇ yazılmaz (uydurma yok).

const num = (v) => (v == null || v === '' ? null : (typeof v === 'number' ? v : Number(v)));
const okNum = (v) => v != null && !Number.isNaN(v);

const playedOf = (st) => (st ? ((num(st.played) ?? ((st.wins || 0) + (st.draws || 0) + (st.losses || 0))) || null) : null);
const vPlayed = (sp) => (sp ? ((sp.wins || 0) + (sp.draws || 0) + (sp.losses || 0)) || null : null);
const vWinRate = (sp) => { const p = vPlayed(sp); return p ? (sp.wins || 0) / p : null; };
const vPpg = (sp) => { const p = vPlayed(sp); return p ? ((sp.wins || 0) * 3 + (sp.draws || 0)) / p : null; };
const vGF = (sp) => { const p = vPlayed(sp); return p ? (sp.goalsFor || 0) / p : null; };
const vGA = (sp) => { const p = vPlayed(sp); return p ? (sp.goalsAgainst || 0) / p : null; };
const formQ = (arr) => (Array.isArray(arr) && arr.length ? arr.reduce((s, r) => s + (r === 'G' ? 1 : r === 'B' ? 0.5 : 0), 0) / arr.length : null);

// Sayısal kıyas → taraf. dir: 'higher' büyük avantajlı, 'lower' küçük avantajlı.
function cmpSide(hv, av, dir) {
  hv = num(hv); av = num(av);
  if (!okNum(hv) || !okNum(av)) return null;          // veri yok → sinyal yok
  if (Math.abs(hv - av) < 1e-9) return 'draw';
  const homeBetter = dir === 'lower' ? hv < av : hv > av;
  return homeBetter ? 'home' : 'away';
}

const st = (t) => t?.standing || null;
const sn = (t) => t?.season || null;
const avg = (t) => t?.season?.avg || null;

// Ortak rakip kıyası (criteria.js commonOpponents portu — sadece taraf)
function commonOpponentsSide(home, away) {
  const hd = home?.last5detail || [], ad = away?.last5detail || [];
  if (!hd.length || !ad.length) return null;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aMap = new Map(ad.map((x) => [norm(x.oppName), x]));
  const pts = (r) => (r === 'G' ? 3 : r === 'B' ? 1 : 0);
  const goalsOf = (x) => {
    const mm = String(x.score || '').match(/(\d+)\D+(\d+)/); if (!mm) return null;
    const p = Number(mm[1]), q = Number(mm[2]);
    if (x.result === 'G') return { gf: Math.max(p, q), ga: Math.min(p, q) };
    if (x.result === 'M') return { gf: Math.min(p, q), ga: Math.max(p, q) };
    return { gf: p, ga: q };
  };
  let n = 0, hPts = 0, aPts = 0, hGD = 0, aGD = 0, hGF = 0, aGF = 0;
  for (const hx of hd) {
    const ax = aMap.get(norm(hx.oppName)); if (!ax) continue;
    n++; hPts += pts(hx.result); aPts += pts(ax.result);
    const hg = goalsOf(hx), ag = goalsOf(ax);
    if (hg) { hGD += hg.gf - hg.ga; hGF += hg.gf; }
    if (ag) { aGD += ag.gf - ag.ga; aGF += ag.gf; }
  }
  if (!n) return null;
  let diff = 0;
  if (hPts !== aPts) diff = hPts - aPts;
  else if (hGD !== aGD) diff = hGD - aGD;
  else if (hGF !== aGF) diff = hGF - aGF;
  if (!diff) return 'draw';
  return diff > 0 ? 'home' : 'away';
}

// Kriter → taraf üreticileri (criteria.js ile aynı key'ler ve aynı mantık).
const EVALS = {
  position: (h, a) => cmpSide(st(h)?.position, st(a)?.position, 'lower'),
  formGeneral: (h, a) => cmpSide(formQ(h?.last5), formQ(a?.last5), 'higher'),
  powerCompare: (h, a) => {
    const hp = num(st(h)?.points), ap = num(st(a)?.points);
    if (!okNum(hp) || !okNum(ap)) return null;
    const hg = num(st(h)?.goalDiff) || 0, ag = num(st(a)?.goalDiff) || 0;
    return cmpSide(hp + hg * 0.3, ap + ag * 0.3, 'higher');
  },
  points: (h, a) => cmpSide(st(h)?.points, st(a)?.points, 'higher'),
  ppg: (h, a) => cmpSide(st(h)?.ppg ?? sn(h)?.recentPpg, st(a)?.ppg ?? sn(a)?.recentPpg, 'higher'),
  wins: (h, a) => cmpSide(st(h)?.wins, st(a)?.wins, 'higher'),
  losses: (h, a) => cmpSide(st(h)?.losses, st(a)?.losses, 'lower'),
  draws: (h, a) => {
    const hp = playedOf(st(h)), ap = playedOf(st(a));
    if (!hp || !ap) return null;
    const comb = (((st(h).draws || 0) / hp) + ((st(a).draws || 0) / ap)) / 2;
    return comb >= 0.28 ? 'draw' : null;               // düşükse sinyal yok (bilgi)
  },
  goalsFor: (h, a) => cmpSide(st(h)?.goalsFor, st(a)?.goalsFor, 'higher'),
  goalsAgainst: (h, a) => cmpSide(st(h)?.goalsAgainst, st(a)?.goalsAgainst, 'lower'),
  goalDiff: (h, a) => cmpSide(st(h)?.goalDiff, st(a)?.goalDiff, 'higher'),
  goalsPerGame: (h, a) => cmpSide(sn(h)?.goalsPerGame, sn(a)?.goalsPerGame, 'higher'),
  concededPerGame: (h, a) => cmpSide(sn(h)?.concededPerGame, sn(a)?.concededPerGame, 'lower'),
  xgFor: (h, a) => cmpSide(sn(h)?.xgFor, sn(a)?.xgFor, 'higher'),
  xgAgainst: (h, a) => cmpSide(sn(h)?.xgAgainst, sn(a)?.xgAgainst, 'lower'),
  btts: (h, a) => {
    const hv = num(sn(h)?.bttsPct), av = num(sn(a)?.bttsPct);
    if (!okNum(hv) || !okNum(av)) return null;
    return (hv + av) / 200 >= 0.55 ? 'draw' : null;    // yüksek KG Var → X riski sinyali
  },
  cleanSheet: (h, a) => cmpSide(sn(h)?.cleanSheetPct, sn(a)?.cleanSheetPct, 'higher'),
  failedToScore: (h, a) => cmpSide(sn(h)?.failedToScorePct, sn(a)?.failedToScorePct, 'lower'),
  possession: (h, a) => cmpSide(avg(h)?.possession, avg(a)?.possession, 'higher'),
  shots: (h, a) => cmpSide(avg(h)?.shots, avg(a)?.shots, 'higher'),
  shotsOnTarget: (h, a) => cmpSide(avg(h)?.shotsOnTarget, avg(a)?.shotsOnTarget, 'higher'),
  corners: (h, a) => cmpSide(avg(h)?.corners, avg(a)?.corners, 'higher'),
  fouls: (h, a) => cmpSide(avg(h)?.fouls, avg(a)?.fouls, 'lower'),
  cards: (h, a) => cmpSide(avg(h)?.cards, avg(a)?.cards, 'lower'),
  venuePerformance: (h, a) => cmpSide(vWinRate(st(h)?.home), vWinRate(st(a)?.away), 'higher'),
  venuePpg: (h, a) => cmpSide(vPpg(st(h)?.home), vPpg(st(a)?.away), 'higher'),
  venueGoalsFor: (h, a) => cmpSide(vGF(st(h)?.home), vGF(st(a)?.away), 'higher'),
  venueGoalsAgainst: (h, a) => cmpSide(vGA(st(h)?.home), vGA(st(a)?.away), 'lower'),
  homeAdvantage: () => 'home',                          // sabit ev avantajı sinyali
  awayResilience: (h, a) => {
    const wr = vWinRate(st(a)?.away);
    if (wr == null) return null;
    if (wr >= 0.45) return 'away';
    const dr = st(a)?.away ? (st(a).away.draws || 0) / (vPlayed(st(a).away) || 1) : null;
    if (dr != null && dr >= 0.35) return 'draw';
    return 'home';
  },
  commonOpponents: (h, a) => commonOpponentsSide(h, a),
  formDrop: (h, a) => {
    const lossRate = (arr) => (Array.isArray(arr) && arr.length ? arr.filter((r) => r === 'M').length / arr.length : null);
    return cmpSide(lossRate(h?.last5), lossRate(a?.last5), 'lower');
  },
};

const SYMBOL = { home: '1', draw: 'X', away: '2' };

// Bir maçın tüm kriter sinyalleri: { key: '1'|'X'|'2' } — sinyal yoksa key yazılmaz.
export function evaluateCriteriaSignals(stats) {
  if (!stats?.home || !stats?.away) return null;
  const out = {};
  for (const [key, fn] of Object.entries(EVALS)) {
    let side = null;
    try { side = fn(stats.home, stats.away); } catch { side = null; }
    if (side && SYMBOL[side]) out[key] = SYMBOL[side];
  }
  return Object.keys(out).length ? out : null;
}

// Karne ekranı için kriter adları (app ile aynı etiketler).
export const CRITERIA_LABELS = {
  position: 'Lig Sırası', formGeneral: 'Son Maç Formu', powerCompare: 'Takım Güç Kıyaslaması',
  points: 'Puan / Puan Farkı', ppg: 'PPG (Maç Başı Puan)', wins: 'Galibiyet Sayısı',
  losses: 'Mağlubiyet Sayısı', draws: 'Beraberlik Eğilimi',
  goalsFor: 'Attığı Gol (Toplam)', goalsAgainst: 'Yediği Gol (Toplam)', goalDiff: 'Averaj',
  goalsPerGame: 'Gol / Maç', concededPerGame: 'Yediği Gol / Maç',
  xgFor: 'xG (Hücum Beklentisi)', xgAgainst: 'xG Karşı (Savunma Beklentisi)',
  btts: 'KG Var Yüzdesi', cleanSheet: 'Temiz Kale Yüzdesi', failedToScore: 'Gol Atamadı Yüzdesi',
  possession: 'Topla Oynama', shots: 'Şut', shotsOnTarget: 'İsabetli Şut',
  corners: 'Korner', fouls: 'Faul', cards: 'Kart',
  venuePerformance: 'İç Saha / Deplasman Performansı', venuePpg: 'İç / Dış Puan Ortalaması',
  venueGoalsFor: 'İç / Dış Gol Ortalaması', venueGoalsAgainst: 'İç / Dış Yediği Gol Ortalaması',
  homeAdvantage: 'Ev Sahibi Avantajı', awayResilience: 'Deplasmanda Direnç',
  commonOpponents: 'Ortak Rakip Kıyaslaması', formDrop: 'Form Düşüşü',
};
