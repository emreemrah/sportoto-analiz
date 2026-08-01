// MERKEZÎ KRİTER KATALOĞU — TEK DOĞRULUK KAYNAĞI (backend).
// app/src/analysis/criteria.js'teki MEVCUT 40 kriterin anahtarları ve mantığı
// AYNEN korunarak standart sözleşmeye taşındı (parite testi bunu kanıtlar).
// Frontend artık kataloğu ve sonuçları buradan gösterir; ayrı hesap tutmaz.
//
// Standart değerlendirme çıktısı (her kriter için):
//   { available, side:'home'|'away'|'draw'|null, strength:0..1, note,
//     homeRawValue, awayRawValue, filterApplied, filterNote?, sampleNote? }
import {
  ANALYSIS_FAMILIES, CRITERIA_CATALOG_VERSION, OPPONENT_TIERS, DEFAULT_FILTERS,
} from './analysisConfig.js';
import { positionByName } from '../radar/util.js';        // logo/içerme dayanıklı takım eşleşmesi + ppg
import { OPP_THRESHOLDS } from './opponentStrength.js';   // ALTIN KURAL eşiği (gerçek puan farkı ≥ 10)

const NA = 'veri bulunamadı';
const num = (v) => (v == null || v === '' ? null : (typeof v === 'number' ? v : Number(v)));
const okNum = (v) => v != null && !Number.isNaN(v);
function fmt(v, u) { if (!okNum(v)) return '—'; const r = Math.round(v * 100) / 100; return `${r}${u || ''}`; }
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const playedOf = (st_) => (st_ ? ((num(st_.played) ?? ((st_.wins || 0) + (st_.draws || 0) + (st_.losses || 0))) || null) : null);
const vPlayed = (sp) => (sp ? ((sp.wins || 0) + (sp.draws || 0) + (sp.losses || 0)) || null : null);
const vWinRate = (sp) => { const p = vPlayed(sp); return p ? (sp.wins || 0) / p : null; };
const vPpg = (sp) => { const p = vPlayed(sp); return p ? ((sp.wins || 0) * 3 + (sp.draws || 0)) / p : null; };
const vGF = (sp) => { const p = vPlayed(sp); return p ? (sp.goalsFor || 0) / p : null; };
const vGA = (sp) => { const p = vPlayed(sp); return p ? (sp.goalsAgainst || 0) / p : null; };
const formQ = (arr) => (Array.isArray(arr) && arr.length ? arr.reduce((s, r) => s + (r === 'G' ? 1 : r === 'B' ? 0.5 : 0), 0) / arr.length : null);

const st = (t) => t?.standing || null;
const sn = (t) => t?.season || null;
const avg = (t) => t?.season?.avg || null;

// ——— app/src/analysis/criteria.js ile BİREBİR aynı kıyas yardımcıları ———
function cmp(hv, av, dir, label, unit, names, extra) {
  hv = num(hv); av = num(av);
  if (!okNum(hv) || !okNum(av)) return { available: false, note: `${label}: ${NA} — bu kriter analiz dışı bırakıldı.`, homeRawValue: hv, awayRawValue: av };
  // 0—0 KIYAS VERİ DEĞİLDİR (sezon başı junk'ı): analiz dışı — uygulama motoruyla parite.
  if (Math.abs(hv) < 1e-9 && Math.abs(av) < 1e-9) return { available: false, note: `${label}: iki değer de 0 — veri henüz oluşmamış (sezon başı olabilir); bu kriter analiz dışı bırakıldı.`, homeRawValue: hv, awayRawValue: av };
  // EŞİTLİK ≠ BERABERLİK: iki değer eşitse YÖN YOKTUR (yeni ligde herkes 0'da
  // eşit görünür — bunu X'e çevirmek yanlış). side:null → katkı vermez.
  if (Math.abs(hv - av) < 1e-9) return { available: true, side: null, strength: 0, note: `${label}: iki takım eşit (${fmt(hv, unit)} — ${fmt(av, unit)}) — yön sinyali yok.`, homeRawValue: hv, awayRawValue: av };
  const homeBetter = dir === 'lower' ? hv < av : hv > av;
  const side = homeBetter ? 'home' : 'away';
  const team = homeBetter ? names.home : names.away;
  const denom = Math.max(Math.abs(hv), Math.abs(av), 1e-6);
  const strength = clamp01(Math.abs(hv - av) / denom);
  const opt = side === 'home' ? '1' : '2';
  return { available: true, side, strength, note: `${label}: ${team} önde (${fmt(hv, unit)} — ${fmt(av, unit)}) → ${opt} ihtimalini destekliyor.${extra ? ' ' + extra : ''}`, homeRawValue: hv, awayRawValue: av };
}

function venueCmp(hv, av, dir, label, unit, names) {
  hv = num(hv); av = num(av);
  if (!okNum(hv) || !okNum(av)) return { available: false, note: `${label}: ${NA} — bu kriter analiz dışı bırakıldı.`, homeRawValue: hv, awayRawValue: av };
  if (Math.abs(hv) < 1e-9 && Math.abs(av) < 1e-9) return { available: false, note: `${label}: iki değer de 0 — veri henüz oluşmamış (sezon başı olabilir); bu kriter analiz dışı bırakıldı.`, homeRawValue: hv, awayRawValue: av };
  if (Math.abs(hv - av) < 1e-9) return { available: true, side: null, strength: 0, note: `${label}: ev sahibi (iç saha) ile deplasman (dış saha) eşit (${fmt(hv, unit)} — ${fmt(av, unit)}) — yön sinyali yok.`, homeRawValue: hv, awayRawValue: av };
  const homeBetter = dir === 'lower' ? hv < av : hv > av;
  const side = homeBetter ? 'home' : 'away';
  const denom = Math.max(Math.abs(hv), Math.abs(av), 1e-6);
  const strength = clamp01(Math.abs(hv - av) / denom);
  const who = homeBetter ? `${names.home} iç sahada` : `${names.away} dış sahada`;
  const opt = side === 'home' ? '1' : '2';
  return { available: true, side, strength, note: `${label}: ${who} daha iyi (ev ${fmt(hv, unit)} — dep ${fmt(av, unit)}) → ${opt} ihtimalini destekliyor.`, homeRawValue: hv, awayRawValue: av };
}

function commonOpponentsEval(home, away, names, detailH, detailA) {
  const hd = detailH || home?.last5detail || [], ad = detailA || away?.last5detail || [];
  if (!hd.length || !ad.length) return { available: false, note: `Ortak rakip: ${NA} — bu kriter analiz dışı bırakıldı.` };
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
  if (!n) return { available: false, note: 'Ortak rakip bulunamadı (son maçlarda) — bu kriter analiz dışı bırakıldı.' };
  let diff = 0, basis = '';
  if (hPts !== aPts) { diff = hPts - aPts; basis = 'sonuç'; }
  else if (hGD !== aGD) { diff = hGD - aGD; basis = 'averaj'; }
  else if (hGF !== aGF) { diff = hGF - aGF; basis = 'attığı gol'; }
  if (!diff) return { available: true, side: null, strength: 0, note: `Ortak rakip: ${n} ortak rakibe karşı iki takım eşit — avantaj yok (yön sinyali yok).` };
  const side = diff > 0 ? 'home' : 'away';
  const team = side === 'home' ? names.home : names.away;
  const strength = basis === 'sonuç' ? clamp01(Math.abs(diff) / 4) : (n >= 2 ? 0.25 : 0);
  const why = basis === 'sonuç' ? 'daha iyi sonuç almış' : basis === 'averaj' ? 'aynı sonuç ama daha az gol yemiş' : 'aynı sonuç ama daha çok gol atmış';
  const opt = side === 'home' ? '1' : '2';
  return { available: true, side, strength, note: `Ortak rakip: ${team} ${why} (${n} ortak rakip) → ${opt} ihtimalini destekliyor.${strength === 0 ? ' Tek örnek olduğu için belirleyici sayılmadı.' : ''}` };
}

const noData = (label, extra) => () => ({ available: false, note: `${label}: ${NA}${extra ? ' (' + extra + ')' : ''} — bu kriter analiz dışı bırakıldı.` });

// ——— FİLTRE ALTYAPISI ———
// Rakip gücü dilimi: lig tablosu SIRA YÜZDELİĞİ ile (küçük ligde yanıltmaz).
// Rakip sınıfı — ALTIN KURAL (tek tanım): kendi puan/maç'ı verilirse sınıf
// GERÇEK PUAN FARKIYLA belirlenir (fark ≥ 10 → güçlü/zayıf, altı orta/denk);
// ppg bağlamı yoksa (eski veri) sıra dilimi YEDEĞİ kullanılır. Eşleşme, logo
// kimliği + içerme destekli dayanıklı eşleştiriciyle yapılır ("TPS" ↔
// "Turun Palloseura" gibi ad farkları filtreyi sessizce boşa düşürmez).
export function opponentTierOf(oppName, leagueTable, { oppLogo = null, ownPpg = null, ownPlayed = null } = {}) {
  const row = positionByName(leagueTable, oppName, oppLogo);
  if (!row) return null;
  if (row.ppg != null && ownPpg != null) {
    const avgPlayed = (((ownPlayed || row.played || 0) + (row.played || ownPlayed || 0)) / 2);
    const gap = (row.ppg - ownPpg) * avgPlayed;
    if (gap >= OPP_THRESHOLDS.classPointsGap) return 'strong';
    if (gap <= -OPP_THRESHOLDS.classPointsGap) return 'weak';
    return 'mid';
  }
  const rel = row.position / row.teamCount;
  if (rel <= OPPONENT_TIERS.strongMaxPct) return 'strong';
  if (rel <= OPPONENT_TIERS.midMaxPct) return 'mid';
  return 'weak';
}

// Filtre sınıflaması için takımın KENDİ gücü (≥3 maç şartı — uydurma yok).
function ownStrengthCtx(team) {
  const pl = num(team?.standing?.played);
  const pp = num(team?.standing?.ppg);
  return {
    ownPpg: okNum(pp) && okNum(pl) && pl >= 3 ? pp : null,
    ownPlayed: okNum(pl) ? pl : null,
  };
}

// last5detail → filtreli görünüm + toplulaştırma (form/gol/puan türetimi).
function detailView(detail, { tier = 'all', leagueTable = null, ownPpg = null, ownPlayed = null } = {}) {
  const rows = (detail || []).filter((x) => x && x.result);
  const filtered = tier === 'all' ? rows
    : rows.filter((x) => opponentTierOf(x.oppName, leagueTable, { oppLogo: x.oppLogo, ownPpg, ownPlayed }) === tier);
  const agg = { n: filtered.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
  for (const x of filtered) {
    agg.form.push(x.result);
    if (x.result === 'G') { agg.w += 1; agg.pts += 3; } else if (x.result === 'B') { agg.d += 1; agg.pts += 1; } else agg.l += 1;
    const mm = String(x.score || '').match(/(\d+)\D+(\d+)/);
    if (mm) {
      const p = Number(mm[1]), q = Number(mm[2]);
      const gf = x.result === 'G' ? Math.max(p, q) : x.result === 'M' ? Math.min(p, q) : p;
      const ga = x.result === 'G' ? Math.min(p, q) : x.result === 'M' ? Math.max(p, q) : q;
      agg.gf += gf; agg.ga += ga;
    }
  }
  return agg;
}

// Bir kriter için etkin filtreyi çöz: kriter override > global > varsayılan.
export function resolveFilters(globalFilters, override) {
  return { ...DEFAULT_FILTERS, ...(globalFilters || {}), ...(override || {}) };
}

// ——— SEZON MAÇ LOGU FİLTRE MOTORU (merkezî — 15 kriter) ———
// enrich her takıma matchLog iliştirir: [{result,gf,ga,isHome,oppName,oppTier,dateUnix}]
// (oppTier = MAÇ ANINDAKİ altın kural sınıfı; ID bazlı, ad eşleşmesi yok).
// Filtre açıkken aşağıdaki kriterler kendi gövdelerine dokunulmadan BURADAN,
// gerçek maç satırlarından hesaplanır. Log yoksa (eski cache) eski yola düşülür.
export const LOG_FILTERABLE_KEYS = [
  'wins', 'losses', 'draws', 'goalsFor', 'goalsAgainst', 'goalDiff',
  'over25', 'btts', 'cleanSheet', 'failedToScore',
  'venuePerformance', 'venuePpg', 'venueGoalsFor', 'venueGoalsAgainst', 'awayResilience',
];
const VENUE_FIXED = { venuePerformance: 1, venuePpg: 1, venueGoalsFor: 1, venueGoalsAgainst: 1 };

function logAgg(rows) {
  const v = { n: rows.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, over: 0, btts: 0, cs: 0, fts: 0 };
  for (const x of rows) {
    if (x.result === 'G') { v.w += 1; v.pts += 3; } else if (x.result === 'B') { v.d += 1; v.pts += 1; } else v.l += 1;
    v.gf += x.gf || 0; v.ga += x.ga || 0;
    if ((x.gf || 0) + (x.ga || 0) >= 3) v.over += 1;
    if ((x.gf || 0) > 0 && (x.ga || 0) > 0) v.btts += 1;
    if ((x.ga || 0) === 0) v.cs += 1;
    if ((x.gf || 0) === 0) v.fts += 1;
  }
  return v;
}
const PERIOD_SLICE = { last5: 5, last10: 10, last15: 15 };
function logRows(team, f, venue /* null | 'home' | 'away' */) {
  let rows = Array.isArray(team?.matchLog) ? team.matchLog : null;
  if (!rows) return null;
  const cut = PERIOD_SLICE[f.period];
  if (cut) rows = rows.slice(0, cut);                          // son 5/10/15 maçın İÇİNDEN filtrelenir
  if (venue === 'home') rows = rows.filter((x) => x.isHome);
  else if (venue === 'away') rows = rows.filter((x) => !x.isHome);
  if (f.opponentStrength && f.opponentStrength !== 'all') rows = rows.filter((x) => x.oppTier === f.opponentStrength);
  return rows;
}
function logFNote(f, nh, na) {
  const seg = [];
  if (f.opponentStrength && f.opponentStrength !== 'all') seg.push(`${OPPONENT_TIERS.labels[f.opponentStrength] || f.opponentStrength} rakipler`);
  if (f.venueScope === 'split') seg.push('Ev içi/Dep dışı');
  if (f.period === 'last5') seg.push('Son 5');
  return ` [Filtre: ${seg.join(' · ') || 'maç logu'} — n=${nh}${na != null ? `/${na}` : ''}]`;
}
// Filtreli değerlerde 0—0 GERÇEK veridir (n maç oynandı) → "veri yok" DENMEZ;
// eşitlik yine yön üretmez. cmp'nin sezon-başı sıfır koruması burada devre dışı.
function cmpF(hv, av, dir, label, unit, names) {
  if (Math.abs(hv) < 1e-9 && Math.abs(av) < 1e-9) {
    return { available: true, side: null, strength: 0, homeRawValue: hv, awayRawValue: av, note: `${label}: filtrelenen maçlarda iki takım eşit (0 — 0) — yön sinyali yok.` };
  }
  return cmp(hv, av, dir, label, unit, names);
}
// Merkezî filtreli değerlendirme. null → bu kriter/veri için uygulanamaz (eski yola düş).
function logFilteredEval(key, h, a, names, f) {
  if (!LOG_FILTERABLE_KEYS.includes(key)) return null;
  const gv = (f.venueScope === 'home' || f.venueScope === 'away') ? f.venueScope : null;
  const venueH = VENUE_FIXED[key] ? 'home' : key === 'awayResilience' ? null : (f.venueScope === 'split' ? 'home' : gv);
  const venueA = VENUE_FIXED[key] ? 'away' : key === 'awayResilience' ? 'away' : (f.venueScope === 'split' ? 'away' : gv);
  const rowsH = key === 'awayResilience' ? [] : logRows(h, f, venueH);
  const rowsA = logRows(a, f, venueA);
  if ((key !== 'awayResilience' && rowsH == null) || rowsA == null) return null;   // log yok → eski yol
  const vh = logAgg(rowsH || []), va = logAgg(rowsA);
  const MINN = key === 'draws' ? 4 : key === 'awayResilience' ? 3 : 2;
  const nOk = key === 'awayResilience' ? va.n >= MINN : (vh.n >= MINN && va.n >= MINN);
  if (!nOk) {
    return { available: false, filterApplied: true, note: `${key === 'awayResilience' ? 'Deplasmanda direnç' : 'Bu kriter'}: seçili filtre için yeterli maç yok (n=${key === 'awayResilience' ? va.n : Math.min(vh.n, va.n)} < ${MINN}) — analiz dışı bırakıldı (uydurma hesap yapılmaz).` };
  }
  const done = (out, nh = vh.n, na = va.n) => {
    if (out && out.note != null) { out.note += logFNote(f, nh, na); out.filterApplied = true; }
    return out;
  };
  const pct100 = (x, n2) => Math.round((x / n2) * 100);
  switch (key) {
    case 'wins': return done(cmpF(vh.w / vh.n, va.w / va.n, 'higher', 'Galibiyet oranı', '', names));
    case 'losses': return done(cmpF(vh.l / vh.n, va.l / va.n, 'lower', 'Mağlubiyet oranı', '', names));
    case 'goalsFor': return done(cmpF(vh.gf / vh.n, va.gf / va.n, 'higher', 'Gol ort.', '', names));
    case 'goalsAgainst': return done(cmpF(vh.ga / vh.n, va.ga / va.n, 'lower', 'Yediği gol ort.', '', names));
    case 'goalDiff': return done(cmpF((vh.gf - vh.ga) / vh.n, (va.gf - va.ga) / va.n, 'higher', 'Averaj/maç', '', names));
    case 'cleanSheet': return done(cmpF(pct100(vh.cs, vh.n), pct100(va.cs, va.n), 'higher', 'Temiz kale %', '%', names));
    case 'failedToScore': return done(cmpF(pct100(vh.fts, vh.n), pct100(va.fts, va.n), 'lower', 'Gol atamadı %', '%', names));
    case 'venuePerformance': return done(cmpF(vh.w / vh.n, va.w / va.n, 'higher', 'İç/dış galibiyet oranı', '', names));
    case 'venuePpg': return done(cmpF(vh.pts / vh.n, va.pts / va.n, 'higher', 'İç/dış PPG', '', names));
    case 'venueGoalsFor': return done(cmpF(vh.gf / vh.n, va.gf / va.n, 'higher', 'İç/dış gol ort.', '', names));
    case 'venueGoalsAgainst': return done(cmpF(vh.ga / vh.n, va.ga / va.n, 'lower', 'İç/dış yediği gol ort.', '', names));
    case 'over25': {
      const hv = pct100(vh.over, vh.n), av2 = pct100(va.over, va.n);
      return done({ available: true, side: null, strength: 0, homeRawValue: hv, awayRawValue: av2, note: `2.5 Üst: ${names.home} %${hv} · ${names.away} %${av2}. Gol beklentisi göstergesi (skor yönünü tek başına belirlemez).` });
    }
    case 'draws': {
      const hr = vh.d / vh.n, ar = va.d / va.n, comb = (hr + ar) / 2;
      return done({ available: true, side: comb >= 0.28 ? 'draw' : null, strength: clamp01(comb), note: `Beraberlik eğilimi: ${names.home} %${Math.round(hr * 100)} · ${names.away} %${Math.round(ar * 100)} berabere.${comb >= 0.28 ? ' Yüksek → X / çift ihtimal riski artıyor.' : ' Düşük → beraberlik baskısı zayıf.'}` });
    }
    case 'btts': {
      const hv = vh.btts / vh.n, av2 = va.btts / va.n, comb = (hv + av2) / 2;
      return done({ available: true, side: comb >= 0.55 ? 'draw' : null, strength: clamp01(comb), note: `KG Var: ${names.home} %${Math.round(hv * 100)} · ${names.away} %${Math.round(av2 * 100)}.${comb >= 0.55 ? ' Yüksek → iki takım da gol buluyor, çift ihtimal / X riski artıyor.' : ' Orta-düşük seviye.'}` });
    }
    case 'awayResilience': {
      const wr = va.w / va.n, dr = va.d / va.n;
      if (wr >= 0.45) return done({ available: true, side: 'away', strength: clamp01(wr), note: `Deplasmanda direnç: ${names.away} dış sahada güçlü (galibiyet %${Math.round(wr * 100)}) → 2 ihtimali güçleniyor.` }, va.n, null);
      if (dr >= 0.35) return done({ available: true, side: 'draw', strength: clamp01(dr), note: `Deplasmanda direnç: ${names.away} dışarıda çok berabere kalıyor (%${Math.round(dr * 100)}) → X / çift ihtimal riski.` }, va.n, null);
      return done({ available: true, side: 'home', strength: clamp01(0.5 - wr), note: `Deplasmanda direnç: ${names.away} dış sahada zayıf (galibiyet %${Math.round(wr * 100)}) → 1 ihtimali lehine.` }, va.n, null);
    }
    default: return null;
  }
}

// Filtreli form kalitesi: period + venueScope + opponentStrength.
// Desteklenemeyen kombinasyon → { unsupported:true } (dürüst not); az örnek →
// { insufficient:true, n } ("Bu filtre için yeterli geçmiş maç yok").
function filteredFormQ(team, role /* 'home'|'away' */, f, m) {
  const tier = f.opponentStrength || 'all';
  if (tier !== 'all') {
    const view = detailView(team?.last5detail, { tier, leagueTable: m?.stats?.leagueTable, ...ownStrengthCtx(team) });
    if (view.n < OPPONENT_TIERS.minSampleForFilter) return { insufficient: true, n: view.n };
    return { value: formQ(view.form), n: view.n, label: `${OPPONENT_TIERS.labels[tier]} rakiplere karşı son maçlar` };
  }
  if (f.venueScope === 'split' || f.venueScope === 'weighted') {
    const arr = team?.last5venue;
    if (Array.isArray(arr) && arr.length) {
      if (f.venueScope === 'weighted') {
        const gen = formQ(team?.last5), ven = formQ(arr);
        if (gen == null && ven == null) return { value: null };
        return { value: ven != null && gen != null ? ven * 0.6 + gen * 0.4 : (ven ?? gen), n: arr.length, label: 'iç/dış ağırlıklı son maçlar' };
      }
      return { value: formQ(arr), n: arr.length, label: role === 'home' ? 'iç saha son maçları' : 'dış saha son maçları' };
    }
    return { insufficient: true, n: 0 };
  }
  if (f.period === 'season') {
    const s = st(team);
    const p = playedOf(s);
    if (!p) return { value: null };
    return { value: ((s.wins || 0) + 0.5 * (s.draws || 0)) / p, n: p, label: 'sezon geneli' };
  }
  if (f.period === 'blend') {
    const s = st(team); const p = playedOf(s);
    const seasonQ = p ? ((s.wins || 0) + 0.5 * (s.draws || 0)) / p : null;
    const last5Q = formQ(team?.last5);
    if (seasonQ == null && last5Q == null) return { value: null };
    return { value: last5Q != null && seasonQ != null ? last5Q * 0.6 + seasonQ * 0.4 : (last5Q ?? seasonQ), label: 'sezon + son 5 ağırlıklı' };
  }
  return { value: formQ(team?.last5), label: 'son 5 maç' };
}

// Filtreli gol ortalaması (for/against): period last5 → last5detail'den; tier → filtreli.
function filteredGoalsPerGame(team, kind /* 'for'|'against' */, f, m) {
  const tier = f.opponentStrength || 'all';
  if (tier !== 'all' || f.period === 'last5') {
    const view = detailView(team?.last5detail, { tier, leagueTable: m?.stats?.leagueTable, ...ownStrengthCtx(team) });
    if (view.n < OPPONENT_TIERS.minSampleForFilter) return { insufficient: true, n: view.n };
    return { value: (kind === 'for' ? view.gf : view.ga) / view.n, n: view.n, label: tier !== 'all' ? `${OPPONENT_TIERS.labels[tier]} rakiplere karşı` : 'son maçlar' };
  }
  return { value: kind === 'for' ? num(sn(team)?.goalsPerGame) : num(sn(team)?.concededPerGame) };
}

// Filtre notu üretici — sonuç satırına eklenir.
const fNote = (r) => (r?.label ? ` [Filtre: ${r.label}${r.n ? `, n=${r.n}` : ''}]` : '');
const insufficientOut = (label, n) => ({
  available: false, insufficientSample: true,
  note: `${label}: Bu filtre için yeterli geçmiş maç yok (n=${n}) — kriter analiz dışı bırakıldı.`,
  sampleNote: `n=${n}`,
});

/* ═══════════════ KATALOG — 40 MEVCUT KRİTER (key'ler DEĞİŞMEDİ) ═══════════════ */
// def alanları: key, version, label, shortDescription, detailedExplanation,
// whenMisleading, category, signalFamily, defaultImpact, supportedModes,
// requiredFields, dataSources, minimumSample, outputDirection, filterCapable, evaluate.
const SRC_FOOTY = 'FootyStats (maç-öncesi istatistik)';
const V = 'crit-1.0.0';

const F = ANALYSIS_FAMILIES;
const both = 'both';

function def(entry) {
  return {
    version: V,
    supportedModes: ['manual', 'smart'],
    dataSources: [SRC_FOOTY],
    minimumSample: 1,
    filterCapable: { period: false, venueScope: false, opponentStrength: false },
    ...entry,
  };
}

export const CATALOG = [
  // ——— 1) Takım Özet ———
  def({
    key: 'position', label: 'Lig Sırası', category: 'ozet', signalFamily: 'league_strength', defaultImpact: 'high', outputDirection: both,
    shortDescription: 'Takımların ligdeki güncel sıralaması dikkate alınır (üst sıra avantaj).',
    detailedExplanation: 'Takımın ligdeki güncel sırasıdır. Üst sıra genelde daha güçlü/istikrarlı takımı gösterir; sistem iki takımın sırasını kıyaslar ve üstte olanı destekler.',
    whenMisleading: 'Sezon başında (az maçta) sıra yanıltıcıdır; kupa/fikstür yoğunluğu ve son form sırada görünmez.',
    requiredFields: ['stats.home.standing.position', 'stats.away.standing.position'],
    evaluate: (h, a, m, n) => {
      // Yeni lig koruması: az maçta sıra (alfabetik/geçen sezon) yanıltıcıdır.
      const hp = playedOf(st(h)), ap = playedOf(st(a));
      if (!hp || !ap || hp < 4 || ap < 4) return { available: false, note: 'Lig sırası: lig yeni başladı / yeterli maç yok — sıra yanıltıcı, analiz dışı.' };
      return cmp(st(h)?.position, st(a)?.position, 'lower', 'Lig sırası', '.', n);
    },
  }),
  def({
    key: 'formGeneral', label: 'Son Maç Formu', category: 'ozet', signalFamily: 'form', defaultImpact: 'high', outputDirection: both,
    shortDescription: 'Son maçlardaki genel form (G/B/M) kıyaslanır.',
    detailedExplanation: 'Son maçlardaki gidişat: galibiyet 1, beraberlik 0.5, mağlubiyet 0 sayılıp ortalaması alınır; daha formda taraf desteklenir.',
    whenMisleading: 'Kolay fikstüre karşı alınan form şişebilir; rakip gücü filtresiyle birlikte okunmalıdır.',
    requiredFields: ['stats.home.last5', 'stats.away.last5'],
    filterCapable: { period: true, venueScope: true, opponentStrength: true },
    evaluate: (h, a, m, n, ctx) => {
      // Varsayılan davranış = kriterin DOĞAL tanımı (son 5 form) — mevcut
      // motorla birebir parite. Filtre yalnız AÇIKÇA istenirse uygulanır.
      if (!ctx?.filtersExplicit) return cmp(formQ(h?.last5), formQ(a?.last5), 'higher', 'Son form', '', n);
      const f = ctx?.filters || DEFAULT_FILTERS;
      const rh = filteredFormQ(h, 'home', f, m), ra = filteredFormQ(a, 'away', f, m);
      if (rh.insufficient || ra.insufficient) return insufficientOut('Son form', Math.min(rh.n ?? 0, ra.n ?? 0));
      const out = cmp(rh.value, ra.value, 'higher', 'Son form', '', n);
      if (out.available && (rh.label || ra.label)) { out.note += fNote(rh); out.filterApplied = true; }
      return out;
    },
  }),
  def({
    key: 'powerCompare', label: 'Takım Güç Kıyaslaması', category: 'ozet', signalFamily: 'league_strength', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Puan ve averajın birleşimiyle genel güç kıyaslanır.',
    detailedExplanation: 'Puan ile averajın birleşiminden çıkan genel güç göstergesi; sadece puana değil gol farkına da bakar.',
    whenMisleading: 'Farklı sayıda maç oynanmışsa toplam puan yanıltabilir (PPG ile birlikte okuyun).',
    requiredFields: ['stats.home.standing.points', 'stats.away.standing.points'],
    evaluate: (h, a, m, n) => {
      const hp = st(h)?.points, ap = st(a)?.points, hg = st(h)?.goalDiff, ag = st(a)?.goalDiff;
      if (!okNum(num(hp)) || !okNum(num(ap))) return { available: false, note: `Güç kıyaslaması: ${NA} — analiz dışı.` };
      return cmp(num(hp) + (num(hg) || 0) * 0.3, num(ap) + (num(ag) || 0) * 0.3, 'higher', 'Güç göstergesi', '', n);
    },
  }),

  // ——— 2) Genel Sezon ———
  def({
    key: 'points', label: 'Puan / Puan Farkı', category: 'sezon', signalFamily: 'points_results', defaultImpact: 'high', outputDirection: both,
    shortDescription: 'Ligdeki toplam puan ve iki takım arası puan farkı.',
    detailedExplanation: 'Toplam puan ve aradaki fark; fark ne kadar açıksa üstün taraf o kadar önde başlar.',
    whenMisleading: 'Eksik maçı olan takımın puanı düşük görünür; PPG ile kıyaslayın.',
    requiredFields: ['stats.home.standing.points', 'stats.away.standing.points'],
    evaluate: (h, a, m, n) => cmp(st(h)?.points, st(a)?.points, 'higher', 'Puan', '', n),
  }),
  def({
    key: 'ppg', label: 'PPG (Maç Başı Puan)', category: 'sezon', signalFamily: 'points_results', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Maç başına düşen ortalama puan.',
    detailedExplanation: 'Points Per Game — toplam puan ÷ oynanan maç; farklı sayıda maç oynamış takımları adil kıyaslar.',
    whenMisleading: 'Küçük örneklemde (sezon başı) dalgalıdır.',
    requiredFields: ['stats.home.standing.ppg|stats.home.season.recentPpg'],
    filterCapable: { period: true, venueScope: false, opponentStrength: true },
    evaluate: (h, a, m, n, ctx) => {
      const f = ctx?.filters || DEFAULT_FILTERS;
      if ((f.opponentStrength && f.opponentStrength !== 'all') || f.period === 'last5') {
        const vh = detailView(h?.last5detail, { tier: f.opponentStrength || 'all', leagueTable: m?.stats?.leagueTable, ...ownStrengthCtx(h) });
        const va = detailView(a?.last5detail, { tier: f.opponentStrength || 'all', leagueTable: m?.stats?.leagueTable, ...ownStrengthCtx(a) });
        if (vh.n < OPPONENT_TIERS.minSampleForFilter || va.n < OPPONENT_TIERS.minSampleForFilter) return insufficientOut('PPG', Math.min(vh.n, va.n));
        const out = cmp(vh.pts / vh.n, va.pts / va.n, 'higher', 'PPG', '', n);
        if (out.available) { out.note += ` [Filtre: ${f.opponentStrength !== 'all' ? OPPONENT_TIERS.labels[f.opponentStrength] + ' rakipler' : 'son maçlar'}, n=${vh.n}/${va.n}]`; out.filterApplied = true; }
        return out;
      }
      return cmp(st(h)?.ppg ?? sn(h)?.recentPpg, st(a)?.ppg ?? sn(a)?.recentPpg, 'higher', 'PPG', '', n);
    },
  }),
  def({
    key: 'wins', label: 'Galibiyet Sayısı', category: 'sezon', signalFamily: 'points_results', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Sezon boyunca alınan galibiyet sayısı.',
    detailedExplanation: 'Çok galibiyet = kazanma alışkanlığı; daha çok galibiyeti olan taraf desteklenir.',
    whenMisleading: 'Beraberliği bol takımlarda tek başına eksik okunur.',
    requiredFields: ['stats.home.standing.wins', 'stats.away.standing.wins'],
    evaluate: (h, a, m, n) => cmp(st(h)?.wins, st(a)?.wins, 'higher', 'Galibiyet', '', n),
  }),
  def({
    key: 'losses', label: 'Mağlubiyet Sayısı', category: 'sezon', signalFamily: 'points_results', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Az mağlubiyet alan takım daha istikrarlı kabul edilir.',
    detailedExplanation: 'Az mağlubiyet = zor yenilen, istikrarlı takım; daha az kaybeden taraf desteklenir.',
    whenMisleading: 'Çok berabere kalan takım az kaybeder ama az da kazanır.',
    requiredFields: ['stats.home.standing.losses', 'stats.away.standing.losses'],
    evaluate: (h, a, m, n) => cmp(st(h)?.losses, st(a)?.losses, 'lower', 'Mağlubiyet', '', n),
  }),
  def({
    key: 'draws', label: 'Beraberlik Eğilimi', category: 'sezon', signalFamily: 'draw_tendency', defaultImpact: 'mid', outputDirection: 'X',
    shortDescription: 'İki takımın da beraberlik oranı yüksekse X / çift ihtimal değerlendirilir.',
    detailedExplanation: 'İki takımın beraberlik oranı; ikisi de sık berabere kalıyorsa X/çift ihtimal riski artar. Tek tarafı değil X ihtimalini besler.',
    whenMisleading: 'Yüksek tempolu liglerde beraberlik oranı yapısal olarak düşüktür.',
    requiredFields: ['stats.home.standing.draws', 'stats.away.standing.draws'],
    evaluate: (h, a, m, n) => {
      const hp = playedOf(st(h)), ap = playedOf(st(a));
      // Yeni lig koruması: yeterli maç yoksa beraberlik oranı anlamlı değil.
      if (!hp || !ap || hp < 4 || ap < 4) return { available: false, note: `Beraberlik eğilimi: ${NA} — lig yeni başladı / yeterli maç yok, analiz dışı.` };
      const hr = (st(h).draws || 0) / hp, ar = (st(a).draws || 0) / ap, comb = (hr + ar) / 2;
      return { available: true, side: comb >= 0.28 ? 'draw' : null, strength: clamp01(comb), homeRawValue: hr, awayRawValue: ar, note: `Beraberlik eğilimi: ${n.home} %${Math.round(hr * 100)} · ${n.away} %${Math.round(ar * 100)} berabere kalıyor.${comb >= 0.28 ? ' Yüksek → X / çift ihtimal riski artıyor.' : ' Düşük → beraberlik baskısı zayıf.'}` };
    },
  }),

  // ——— 3) Gol ———
  def({
    key: 'goalsFor', label: 'Attığı Gol (Toplam)', category: 'gol', signalFamily: 'goals', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Sezon boyunca atılan toplam gol.',
    detailedExplanation: 'Hücum gücünün en basit göstergesi; daha çok gol atan taraf desteklenir.',
    whenMisleading: 'Birkaç farklı galibiyet toplamı şişirebilir; gol/maç ile birlikte okuyun.',
    requiredFields: ['stats.home.standing.goalsFor', 'stats.away.standing.goalsFor'],
    evaluate: (h, a, m, n) => cmp(st(h)?.goalsFor, st(a)?.goalsFor, 'higher', 'Attığı gol', '', n),
  }),
  def({
    key: 'goalsAgainst', label: 'Yediği Gol (Toplam)', category: 'gol', signalFamily: 'goals', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Sezon boyunca yenen toplam gol (az iyi).',
    detailedExplanation: 'Az gol yemek = sağlam savunma; daha az yiyen taraf desteklenir.',
    whenMisleading: 'Tek ağır mağlubiyet toplamı bozabilir.',
    requiredFields: ['stats.home.standing.goalsAgainst', 'stats.away.standing.goalsAgainst'],
    evaluate: (h, a, m, n) => cmp(st(h)?.goalsAgainst, st(a)?.goalsAgainst, 'lower', 'Yediği gol', '', n),
  }),
  def({
    key: 'goalDiff', label: 'Averaj', category: 'gol', signalFamily: 'goals', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Attığı ve yediği gol farkı.',
    detailedExplanation: 'Averaj hem hücumu hem savunmayı tek sayıda özetler; yüksek averajlı taraf desteklenir.',
    whenMisleading: 'Zayıflara karşı farklı skorlar averajı şişirebilir.',
    requiredFields: ['stats.home.standing.goalDiff', 'stats.away.standing.goalDiff'],
    evaluate: (h, a, m, n) => cmp(st(h)?.goalDiff, st(a)?.goalDiff, 'higher', 'Averaj', '', n),
  }),
  def({
    key: 'goalsPerGame', label: 'Gol / Maç', category: 'gol', signalFamily: 'goals', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Maç başına atılan ortalama gol (gol atma alışkanlığı).',
    detailedExplanation: 'Toplam gol yerine maç başına bakar; yüksek olan taraf desteklenir.',
    whenMisleading: 'Rakip kalitesine göre değişir; rakip gücü filtresiyle bakılabilir.',
    requiredFields: ['stats.home.season.goalsPerGame', 'stats.away.season.goalsPerGame'],
    filterCapable: { period: true, venueScope: false, opponentStrength: true },
    evaluate: (h, a, m, n, ctx) => {
      const f = ctx?.filters || DEFAULT_FILTERS;
      const rh = filteredGoalsPerGame(h, 'for', f, m), ra = filteredGoalsPerGame(a, 'for', f, m);
      if (rh.insufficient || ra.insufficient) return insufficientOut('Gol/maç', Math.min(rh.n ?? 0, ra.n ?? 0));
      const out = cmp(rh.value, ra.value, 'higher', 'Gol/maç', '', n);
      if (out.available && rh.label) { out.note += fNote(rh); out.filterApplied = true; }
      return out;
    },
  }),
  def({
    key: 'concededPerGame', label: 'Yediği Gol / Maç', category: 'gol', signalFamily: 'goals', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Maç başına yenen ortalama gol (gol yeme alışkanlığı).',
    detailedExplanation: 'Düşükse savunma güçlü; daha az yiyen taraf desteklenir.',
    whenMisleading: 'Savunmacı ama üretken olmayan takımlarda tek başına yanıltır.',
    requiredFields: ['stats.home.season.concededPerGame', 'stats.away.season.concededPerGame'],
    filterCapable: { period: true, venueScope: false, opponentStrength: true },
    evaluate: (h, a, m, n, ctx) => {
      const f = ctx?.filters || DEFAULT_FILTERS;
      const rh = filteredGoalsPerGame(h, 'against', f, m), ra = filteredGoalsPerGame(a, 'against', f, m);
      if (rh.insufficient || ra.insufficient) return insufficientOut('Yediği/maç', Math.min(rh.n ?? 0, ra.n ?? 0));
      const out = cmp(rh.value, ra.value, 'lower', 'Yediği/maç', '', n);
      if (out.available && rh.label) { out.note += fNote(rh); out.filterApplied = true; }
      return out;
    },
  }),

  // ——— 4) Beklenti ve Eğilim ———
  def({
    key: 'xgFor', label: 'xG (Hücum Beklentisi)', category: 'beklenti', signalFamily: 'xg', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Ürettiği pozisyon kalitesi — beklenen gol (hücum).',
    detailedExplanation: 'xG şansa değil gerçek pozisyon üretimine bakar; hücum beklentisi yüksek taraf desteklenir.',
    whenMisleading: 'Tek maçlık uç değerler sezon ortalamasını oynatabilir.',
    requiredFields: ['stats.home.season.xgFor', 'stats.away.season.xgFor'],
    evaluate: (h, a, m, n) => cmp(sn(h)?.xgFor, sn(a)?.xgFor, 'higher', 'xG (hücum)', '', n),
  }),
  def({
    key: 'xgAgainst', label: 'xG Karşı (Savunma Beklentisi)', category: 'beklenti', signalFamily: 'xg', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Rakibe verdiği pozisyon kalitesi — beklenen gol (savunma, az iyi).',
    detailedExplanation: 'Düşükse savunma pozisyon vermiyor demektir; az pozisyon veren taraf desteklenir.',
    whenMisleading: 'Düşük tempolu liglerde herkes düşük görünebilir.',
    requiredFields: ['stats.home.season.xgAgainst', 'stats.away.season.xgAgainst'],
    evaluate: (h, a, m, n) => cmp(sn(h)?.xgAgainst, sn(a)?.xgAgainst, 'lower', 'xG (savunma)', '', n),
  }),
  def({
    key: 'over25', label: '2.5 Üst Yüzdesi', category: 'beklenti', signalFamily: 'contextual', defaultImpact: 'low', outputDirection: 'informational',
    shortDescription: 'Maçlarında 2.5 üstü gol olma eğilimi (bilgi amaçlı — tek tarafı desteklemez).',
    detailedExplanation: 'Maçlarının yüzde kaçında 3+ gol olduğu; çok gollü geçme fikri verir ama 1/X/2 yönünü tek başına belirlemez.',
    whenMisleading: 'Yön kriteri değildir; tahmin doğruluğu ölçülmez (bilgi kriteri).',
    requiredFields: ['stats.home.season.over25Pct', 'stats.away.season.over25Pct'],
    evaluate: (h, a, m, n) => {
      const hv = num(sn(h)?.over25Pct), av = num(sn(a)?.over25Pct);
      if (!okNum(hv) || !okNum(av)) return { available: false, note: `2.5 Üst: ${NA} — analiz dışı.` };
      return { available: true, side: null, strength: 0, homeRawValue: hv, awayRawValue: av, note: `2.5 Üst: ${n.home} %${Math.round(hv)} · ${n.away} %${Math.round(av)}. Gol beklentisi göstergesi (skor yönünü tek başına belirlemez).` };
    },
  }),
  def({
    key: 'btts', label: 'KG Var Yüzdesi', category: 'beklenti', signalFamily: 'draw_tendency', defaultImpact: 'mid', outputDirection: 'X',
    shortDescription: 'İki takımın da gol bulma eğilimi — yüksekse X / çift ihtimal riski değerlendirilir.',
    detailedExplanation: 'KG Var oranı yüksekse iki taraf da gol buluyor demektir; çift ihtimal/X riski artar.',
    whenMisleading: 'KG Var yüksekken maç yine tek tarafa dönebilir; yön kriteri değildir.',
    requiredFields: ['stats.home.season.bttsPct', 'stats.away.season.bttsPct'],
    evaluate: (h, a, m, n) => {
      const hv = num(sn(h)?.bttsPct), av = num(sn(a)?.bttsPct);
      if (!okNum(hv) || !okNum(av)) return { available: false, note: `KG Var: ${NA} — analiz dışı.` };
      const comb = (hv + av) / 200;
      return { available: true, side: comb >= 0.55 ? 'draw' : null, strength: clamp01(comb), homeRawValue: hv, awayRawValue: av, note: `KG Var: ${n.home} %${Math.round(hv)} · ${n.away} %${Math.round(av)}.${comb >= 0.55 ? ' Yüksek → iki takım da gol buluyor, çift ihtimal / X riski artıyor.' : ' Orta-düşük seviye.'}` };
    },
  }),
  def({
    key: 'cleanSheet', label: 'Temiz Kale Yüzdesi', category: 'beklenti', signalFamily: 'goals', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Gol yemeden bitirme oranı (savunma istikrarı).',
    detailedExplanation: 'Gol yemeden bitirilen maç oranı savunma istikrarını gösterir; yüksek taraf desteklenir.',
    whenMisleading: 'Savunmacı oyunla şişebilir; hücum verileriyle birlikte okuyun.',
    requiredFields: ['stats.home.season.cleanSheetPct', 'stats.away.season.cleanSheetPct'],
    evaluate: (h, a, m, n) => cmp(sn(h)?.cleanSheetPct, sn(a)?.cleanSheetPct, 'higher', 'Temiz kale %', '%', n),
  }),
  def({
    key: 'failedToScore', label: 'Gol Atamadı Yüzdesi', category: 'beklenti', signalFamily: 'goals', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Gol atamadan biten maç oranı (az iyi).',
    detailedExplanation: 'Düşükse takım hemen her maç gol buluyor demektir; düşük olan taraf desteklenir.',
    whenMisleading: 'Tek golcüye bağımlı takımlarda hızla bozulabilir.',
    requiredFields: ['stats.home.season.failedToScorePct', 'stats.away.season.failedToScorePct'],
    evaluate: (h, a, m, n) => cmp(sn(h)?.failedToScorePct, sn(a)?.failedToScorePct, 'lower', 'Gol atamadı %', '%', n),
  }),

  // ——— 5) Maç Başı Ortalama ———
  def({
    key: 'possession', label: 'Topla Oynama', category: 'ortalama', signalFamily: 'attacking_activity', defaultImpact: 'low', outputDirection: both,
    shortDescription: 'Maç başı ortalama topa sahip olma yüzdesi.',
    detailedExplanation: 'Oyun kurma eğilimini gösterir; topa daha çok sahip olan taraf hafifçe desteklenir.',
    whenMisleading: 'Topa sahip olmak gol garantisi değildir; kontra takımlarına karşı yanıltır.',
    requiredFields: ['stats.home.season.avg.possession', 'stats.away.season.avg.possession'],
    evaluate: (h, a, m, n) => cmp(avg(h)?.possession, avg(a)?.possession, 'higher', 'Topla oynama', '%', n),
  }),
  def({
    key: 'shots', label: 'Şut', category: 'ortalama', signalFamily: 'attacking_activity', defaultImpact: 'low', outputDirection: both,
    shortDescription: 'Maç başı ortalama toplam şut.',
    detailedExplanation: 'Baskı ve hücum hacmini gösterir; daha çok şut çeken taraf desteklenir.',
    whenMisleading: 'Uzaktan isabetsiz şutlar hacmi şişirebilir; isabetli şutla birlikte okuyun.',
    requiredFields: ['stats.home.season.avg.shots', 'stats.away.season.avg.shots'],
    evaluate: (h, a, m, n) => cmp(avg(h)?.shots, avg(a)?.shots, 'higher', 'Şut', '', n),
  }),
  def({
    key: 'shotsOnTarget', label: 'İsabetli Şut', category: 'ortalama', signalFamily: 'attacking_activity', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Maç başı ortalama isabetli şut.',
    detailedExplanation: 'Kaleyi bulan şutları sayar; toplam şuttan daha anlamlıdır.',
    whenMisleading: 'Kalitesiz isabetler (uzak/açısız) değeri şişirebilir.',
    requiredFields: ['stats.home.season.avg.shotsOnTarget', 'stats.away.season.avg.shotsOnTarget'],
    evaluate: (h, a, m, n) => cmp(avg(h)?.shotsOnTarget, avg(a)?.shotsOnTarget, 'higher', 'İsabetli şut', '', n),
  }),
  def({
    key: 'corners', label: 'Korner', category: 'ortalama', signalFamily: 'attacking_activity', defaultImpact: 'low', outputDirection: both,
    shortDescription: 'Maç başı ortalama korner (baskı göstergesi).',
    detailedExplanation: 'Rakip yarı sahada kurulan baskının göstergesi; hafif destek verir.',
    whenMisleading: 'Korner çokluğu gol üretimine her zaman dönüşmez.',
    requiredFields: ['stats.home.season.avg.corners', 'stats.away.season.avg.corners'],
    evaluate: (h, a, m, n) => cmp(avg(h)?.corners, avg(a)?.corners, 'higher', 'Korner', '', n),
  }),
  def({
    key: 'fouls', label: 'Faul', category: 'ortalama', signalFamily: 'discipline', defaultImpact: 'low', outputDirection: both,
    shortDescription: 'Maç başı ortalama faul (az genelde daha kontrollü).',
    detailedExplanation: 'Az faul genelde daha kontrollü oyun demektir; az faul yapan taraf hafifçe desteklenir.',
    whenMisleading: 'Agresif pres de faul üretir; oyun tarzına bağlıdır.',
    requiredFields: ['stats.home.season.avg.fouls', 'stats.away.season.avg.fouls'],
    evaluate: (h, a, m, n) => cmp(avg(h)?.fouls, avg(a)?.fouls, 'lower', 'Faul', '', n),
  }),
  def({
    key: 'cards', label: 'Kart', category: 'ortalama', signalFamily: 'discipline', defaultImpact: 'low', outputDirection: both,
    shortDescription: 'Maç başı ortalama kart (az genelde daha disiplinli).',
    detailedExplanation: 'Az kart daha disiplinli takımı gösterir; çok kart eksik oyuncu riskini artırır.',
    whenMisleading: 'Hakem profiline göre değişkendir.',
    requiredFields: ['stats.home.season.avg.cards', 'stats.away.season.avg.cards'],
    evaluate: (h, a, m, n) => cmp(avg(h)?.cards, avg(a)?.cards, 'lower', 'Kart', '', n),
  }),

  // ——— 6) İç Saha / Deplasman ———
  def({
    key: 'venuePerformance', label: 'İç Saha / Deplasman Performansı', category: 'venue', signalFamily: 'venue', defaultImpact: 'high', outputDirection: both,
    shortDescription: 'Ev sahibinin iç saha galibiyet oranı ile deplasmanın dış saha galibiyet oranı.',
    detailedExplanation: 'En adil saha kıyası: ev evinde, deplasman dışarıda ne yapıyor? Ev evinde güçlü, deplasman dışarıda zayıfsa 1 belirgin güçlenir.',
    whenMisleading: 'Az iç/dış maç oynanmışsa oranlar oynaktır.',
    requiredFields: ['stats.home.standing.home', 'stats.away.standing.away'],
    minimumSample: 3,
    evaluate: (h, a, m, n) => venueCmp(vWinRate(st(h)?.home), vWinRate(st(a)?.away), 'higher', 'İç/dış galibiyet oranı', '', n),
  }),
  def({
    key: 'venuePpg', label: 'İç / Dış Puan Ortalaması', category: 'venue', signalFamily: 'venue', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Ev sahibinin iç sahada, deplasmanın dış sahada maç başı puanı.',
    detailedExplanation: 'Saha faktörünü puana yansıtır; kendi sahasında daha verimli taraf desteklenir.',
    whenMisleading: 'Az örneklemde tek maç ortalamayı savurur.',
    requiredFields: ['stats.home.standing.home', 'stats.away.standing.away'],
    minimumSample: 3,
    evaluate: (h, a, m, n) => venueCmp(vPpg(st(h)?.home), vPpg(st(a)?.away), 'higher', 'İç/dış PPG', '', n),
  }),
  def({
    key: 'venueGoalsFor', label: 'İç / Dış Gol Ortalaması', category: 'venue', signalFamily: 'venue', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Ev sahibinin iç sahada, deplasmanın dış sahada attığı ortalama gol.',
    detailedExplanation: 'Saha bazında hücum gücünü kıyaslar; yüksek taraf desteklenir.',
    whenMisleading: 'Zayıf rakiplere karşı iç saha golleri şişebilir.',
    requiredFields: ['stats.home.standing.home.goalsFor', 'stats.away.standing.away.goalsFor'],
    minimumSample: 3,
    evaluate: (h, a, m, n) => venueCmp(vGF(st(h)?.home), vGF(st(a)?.away), 'higher', 'İç/dış gol ort.', '', n),
  }),
  def({
    key: 'venueGoalsAgainst', label: 'İç / Dış Yediği Gol Ortalaması', category: 'venue', signalFamily: 'venue', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Ev sahibinin iç sahada, deplasmanın dış sahada yediği ortalama gol (az iyi).',
    detailedExplanation: 'Saha bazında savunmayı kıyaslar; az yiyen taraf desteklenir.',
    whenMisleading: 'Tek farklı mağlubiyet ortalamayı bozar.',
    requiredFields: ['stats.home.standing.home.goalsAgainst', 'stats.away.standing.away.goalsAgainst'],
    minimumSample: 3,
    evaluate: (h, a, m, n) => venueCmp(vGA(st(h)?.home), vGA(st(a)?.away), 'lower', 'İç/dış yediği gol ort.', '', n),
  }),
  def({
    key: 'xgForVenue', label: 'İç / Dış xG (Hücum)', category: 'venue', signalFamily: 'xg', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Ev sahibinin iç sahada, deplasmanın dış sahada ürettiği beklenen gol (xG).',
    detailedExplanation: 'Saha bazında hücum kalitesini kıyaslar; gol sayısından daha stabil bir güç göstergesidir.',
    whenMisleading: 'Kaynağın saha-ayrımlı xG verisi yoksa kullanılamaz.',
    requiredFields: ['stats.home.season.xgForHome', 'stats.away.season.xgForAway'],
    evaluate: (h, a, m, n) => venueCmp(sn(h)?.xgForHome, sn(a)?.xgForAway, 'higher', 'İç/dış xG (hücum)', '', n),
  }),
  def({
    key: 'xgAgainstVenue', label: 'İç / Dış xGA (Savunma)', category: 'venue', signalFamily: 'xg', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Ev sahibinin iç sahada, deplasmanın dış sahada rakibe verdiği beklenen gol (xGA, az iyi).',
    detailedExplanation: 'Saha bazında savunma kalitesini kıyaslar; az xGA veren taraf desteklenir.',
    whenMisleading: 'Kaynağın saha-ayrımlı xGA verisi yoksa kullanılamaz.',
    requiredFields: ['stats.home.season.xgAgainstHome', 'stats.away.season.xgAgainstAway'],
    evaluate: (h, a, m, n) => venueCmp(sn(h)?.xgAgainstHome, sn(a)?.xgAgainstAway, 'lower', 'İç/dış xGA (savunma)', '', n),
  }),

  // ——— 7) Maç Yorumu ———
  def({
    key: 'homeAdvantage', label: 'Ev Sahibi Avantajı', category: 'yorum', signalFamily: 'contextual', defaultImpact: 'low', outputDirection: '1',
    shortDescription: 'Sahasında oynayan takım lehine hafif katkı.',
    detailedExplanation: 'Kendi seyircisi önünde oynamanın bilinen avantajı; ev sahibi lehine sabit hafif katkı ekler.',
    whenMisleading: 'Seyircisiz/tarafsız sahada anlamsızlaşır; tek başına belirleyici değildir.',
    requiredFields: [],
    evaluate: (h, a, m, n) => ({ available: true, side: 'home', strength: 0.25, note: `Ev sahibi avantajı: sahasında oynayan ${n.home} lehine hafif katkı → 1 ihtimaline az destek.` }),
  }),
  def({
    key: 'awayResilience', label: 'Deplasmanda Direnç', category: 'yorum', signalFamily: 'venue', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Deplasman takımı dış sahada dirençliyse 2 / X güçlenir.',
    detailedExplanation: 'Deplasmanın dış saha karakteri: çok kazanıyorsa 2, çok berabere kalıyorsa X, zayıfsa 1 lehine döner.',
    whenMisleading: 'Az dış saha maçı oynanmışsa oranlar oynaktır.',
    requiredFields: ['stats.away.standing.away'],
    minimumSample: 3,
    evaluate: (h, a, m, n) => {
      const awayGames = vPlayed(st(a)?.away) || 0;
      const wr = vWinRate(st(a)?.away);
      // Yeterli dış saha maçı (≥3) yoksa direnç/beraberlik ÇIKARILMAZ (yeni lig koruması).
      const dr = awayGames >= 3 ? (st(a).away.draws || 0) / awayGames : null;
      if (wr == null || awayGames < 3) return { available: false, note: `Deplasmanda direnç: ${NA} — yeterli dış saha maçı yok, analiz dışı.` };
      if (wr >= 0.45) return { available: true, side: 'away', strength: clamp01(wr), note: `Deplasmanda direnç: ${n.away} dış sahada güçlü (galibiyet oranı %${Math.round(wr * 100)}) → 2 ihtimali güçleniyor.` };
      if (dr != null && dr >= 0.35) return { available: true, side: 'draw', strength: clamp01(dr), note: `Deplasmanda direnç: ${n.away} dışarıda çok berabere kalıyor (%${Math.round(dr * 100)}) → X / çift ihtimal riski.` };
      return { available: true, side: 'home', strength: clamp01(0.5 - wr), note: `Deplasmanda direnç: ${n.away} dış sahada zayıf (galibiyet oranı %${Math.round(wr * 100)}) → 1 ihtimali lehine.` };
    },
  }),
  def({
    key: 'commonOpponents', label: 'Ortak Rakip Kıyaslaması', category: 'yorum', signalFamily: 'contextual', defaultImpact: 'high', outputDirection: both,
    shortDescription: 'Son maçlarda ortak rakiplere karşı alınan sonuçlar kıyaslanır.',
    detailedExplanation: '"Aynı rakibe karşı kim ne yaptı" mantığı: önce sonuç, eşitse averaj, sonra atılan gol.',
    whenMisleading: 'Tek ortak rakip belirleyici değildir; farklı sahalarda oynanmış olabilir.',
    requiredFields: ['stats.home.last5detail', 'stats.away.last5detail'],
    minimumSample: 1,
    filterCapable: { period: false, venueScope: false, opponentStrength: true },
    evaluate: (h, a, m, n, ctx) => {
      const f = ctx?.filters || DEFAULT_FILTERS;
      if (f.opponentStrength && f.opponentStrength !== 'all') {
        const lt = m?.stats?.leagueTable;
        const filt = (d) => (d || []).filter((x) => opponentTierOf(x.oppName, lt) === f.opponentStrength);
        const hd = filt(h?.last5detail), ad = filt(a?.last5detail);
        if (hd.length < 1 || ad.length < 1) return insufficientOut('Ortak rakip (filtreli)', Math.min(hd.length, ad.length));
        const out = commonOpponentsEval(h, a, n, hd, ad);
        if (out.available) { out.note += ` [Filtre: ${OPPONENT_TIERS.labels[f.opponentStrength]} rakipler]`; out.filterApplied = true; }
        return out;
      }
      return commonOpponentsEval(h, a, n);
    },
  }),
  def({
    key: 'missingPlayers', label: 'Eksik Oyuncu', category: 'yorum', signalFamily: 'squad', defaultImpact: 'high', outputDirection: both,
    shortDescription: 'Kadro eksikleri güven seviyesini etkiler (veri gelirse).',
    detailedExplanation: 'Kadro eksikleri güveni etkiler. ŞU AN kaynak sakatlık/ceza verisi vermediği için "veri bulunamadı" olarak işaretlenir ve sonuca katılmaz — sistem asla uydurmaz.',
    whenMisleading: 'Veri kaynağı gelene kadar hep analiz dışıdır.',
    requiredFields: ['(kaynak yok)'], dataSources: ['Kaynak bağlı değil'],
    evaluate: noData('Eksik oyuncu', 'kadro/sakatlık verisi gelmiyor'),
  }),
  def({
    key: 'topScorerMissing', label: 'Golcü Oyuncu Eksikliği', category: 'yorum', signalFamily: 'squad', defaultImpact: 'critical', outputDirection: both,
    shortDescription: 'Gol yükünü taşıyan oyuncu eksikse güven düşürülür (veri gelirse).',
    detailedExplanation: 'Gol yükünü taşıyan yıldızın eksikliği güveni ciddi düşürür. ŞU AN oyuncu eksik verisi gelmediği için analiz dışıdır (uydurulmaz).',
    whenMisleading: 'Veri kaynağı gelene kadar hep analiz dışıdır.',
    requiredFields: ['(kaynak yok)'], dataSources: ['Kaynak bağlı değil'],
    evaluate: noData('Golcü eksikliği', 'oyuncu sakatlık verisi gelmiyor'),
  }),
  def({
    key: 'assistMissing', label: 'Asist Yapan Oyuncu Eksikliği', category: 'yorum', signalFamily: 'squad', defaultImpact: 'high', outputDirection: both,
    shortDescription: 'Asist üreten oyuncu eksikse hücum gücü düşer (veri gelirse).',
    detailedExplanation: 'Asist üreten kilit oyuncunun eksikliği hücum üretimini düşürür. ŞU AN veri gelmediği için analiz dışıdır (uydurulmaz).',
    whenMisleading: 'Veri kaynağı gelene kadar hep analiz dışıdır.',
    requiredFields: ['(kaynak yok)'], dataSources: ['Kaynak bağlı değil'],
    evaluate: noData('Asistçi eksikliği', 'oyuncu sakatlık verisi gelmiyor'),
  }),
  def({
    key: 'coachChange', label: 'Teknik Direktör Değişimi', category: 'yorum', signalFamily: 'coach', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Hoca değişimi takımı etkileyebilir (veri gelirse).',
    detailedExplanation: 'Teknik direktör değişimi oyunu ve motivasyonu değiştirebilir. ŞU AN kaynak bu bilgiyi vermediği için analiz dışıdır (uydurulmaz).',
    whenMisleading: 'Veri kaynağı gelene kadar hep analiz dışıdır.',
    requiredFields: ['(kaynak yok)'], dataSources: ['Kaynak bağlı değil'],
    evaluate: noData('Teknik direktör değişimi', 'kaynak sağlamıyor'),
  }),
  def({
    key: 'newCoachEffect', label: 'Yeni Hoca Etkisi', category: 'yorum', signalFamily: 'coach', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Yeni hocayla gelen çıkış/düşüş (veri gelirse).',
    detailedExplanation: 'Yeni hocayla gelen kısa vadeli çıkış/düşüş etkisi. ŞU AN kaynak bu bilgiyi vermediği için analiz dışıdır (uydurulmaz).',
    whenMisleading: 'Veri kaynağı gelene kadar hep analiz dışıdır.',
    requiredFields: ['(kaynak yok)'], dataSources: ['Kaynak bağlı değil'],
    evaluate: noData('Yeni hoca etkisi', 'kaynak sağlamıyor'),
  }),
  def({
    key: 'formDrop', label: 'Form Düşüşü', category: 'yorum', signalFamily: 'form', defaultImpact: 'mid', outputDirection: both,
    shortDescription: 'Son maçlarda mağlubiyet oranı artan takım daha riskli kabul edilir.',
    detailedExplanation: 'Yakın dönemde çok kaybeden takım düşüşte kabul edilir; son maçlarda daha az kaybeden taraf desteklenir.',
    whenMisleading: 'Zorlu fikstüre denk gelen kayıplar kaliteyi yansıtmayabilir.',
    requiredFields: ['stats.home.last5', 'stats.away.last5'],
    filterCapable: { period: false, venueScope: false, opponentStrength: true },
    evaluate: (h, a, m, n, ctx) => {
      const f = ctx?.filters || DEFAULT_FILTERS;
      const lossRate = (arr) => (Array.isArray(arr) && arr.length ? arr.filter((r) => r === 'M').length / arr.length : null);
      if (f.opponentStrength && f.opponentStrength !== 'all') {
        const lt = m?.stats?.leagueTable;
        const vh = detailView(h?.last5detail, { tier: f.opponentStrength, leagueTable: lt, ...ownStrengthCtx(h) });
        const va = detailView(a?.last5detail, { tier: f.opponentStrength, leagueTable: lt, ...ownStrengthCtx(a) });
        if (vh.n < OPPONENT_TIERS.minSampleForFilter || va.n < OPPONENT_TIERS.minSampleForFilter) return insufficientOut('Form düşüşü (filtreli)', Math.min(vh.n, va.n));
        const out = cmp(vh.l / vh.n, va.l / va.n, 'lower', 'Form düşüşü (son maç mağlubiyet oranı)', '', n);
        if (out.available) { out.note += ` [Filtre: ${OPPONENT_TIERS.labels[f.opponentStrength]} rakipler, n=${vh.n}/${va.n}]`; out.filterApplied = true; }
        return out;
      }
      const hl = lossRate(h?.last5), al = lossRate(a?.last5);
      if (hl == null || al == null) return { available: false, note: `Form düşüşü: ${NA} — analiz dışı.` };
      return cmp(hl, al, 'lower', 'Form düşüşü (son maç mağlubiyet oranı)', '', n);
    },
  }),
];

export const CATALOG_MAP = Object.fromEntries(CATALOG.map((c) => [c.key, c]));
export const CATALOG_KEYS = CATALOG.map((c) => c.key);
export const CATALOG_VERSION = CRITERIA_CATALOG_VERSION;

export const ANALYSIS_CATEGORIES = [
  { id: 'ozet', title: 'Takım Özet Bilgileri', icon: '🏷️' },
  { id: 'sezon', title: 'Genel Sezon Verileri', icon: '📅' },
  { id: 'gol', title: 'Gol Verileri', icon: '⚽' },
  { id: 'beklenti', title: 'Beklenti ve Eğilim', icon: '📈' },
  { id: 'ortalama', title: 'Maç Başı Ortalama', icon: '📊' },
  { id: 'venue', title: 'İç Saha / Deplasman', icon: '🏟️' },
  { id: 'yorum', title: 'Maç Yorumu Kriterleri', icon: '🧩' },
];

// TEK KRİTERİ standart sözleşmeyle değerlendir (gölge değerlendirme birimi).
export function evaluateCriterion(criterionDef, m, { filters = null, observedAt = null } = {}) {
  const h = m?.stats?.home || null;
  const a = m?.stats?.away || null;
  const names = {
    home: m?.home?.mediumName || m?.home?.name || 'Ev sahibi',
    away: m?.away?.mediumName || m?.away?.name || 'Deplasman',
  };
  let r;
  // MERKEZÎ LOG FİLTRESİ: filtre açıkça istenmiş ve bu kriter maç-logu ile
  // hesaplanabiliyorsa, kriterin kendi gövdesine girmeden buradan hesaplanır.
  const f = filters || DEFAULT_FILTERS;
  const wantsLog = !!filters && (
    (f.opponentStrength && f.opponentStrength !== 'all') || f.venueScope === 'split' || f.period === 'last5'
  );
  if (wantsLog) {
    try { r = logFilteredEval(criterionDef.key, h, a, names, f) || undefined; } catch { r = undefined; }
  }
  if (!r) {
    try {
      r = criterionDef.evaluate(h, a, m, names, { filters: f, filtersExplicit: !!filters });
    } catch (e) {
      r = { available: false, note: `${criterionDef.label}: değerlendirilemedi (${e.message}) — analiz dışı.` };
    }
  }
  return {
    key: criterionDef.key,
    version: criterionDef.version,
    signalFamily: criterionDef.signalFamily,
    outputDirection: criterionDef.outputDirection,
    available: !!r.available,
    unavailableReason: r.available ? null : (r.note || 'Veri yok'),
    side: r.available ? (r.side ?? null) : null,          // 'home'|'away'|'draw'|null(bilgi)
    signal: r.available && r.side ? (r.side === 'home' ? '1' : r.side === 'away' ? '2' : 'X') : null,
    normalizedStrength: r.available ? Math.max(0, Math.min(1, r.strength || 0)) : null,
    note: r.note || null,
    homeRawValue: r.homeRawValue ?? null,
    awayRawValue: r.awayRawValue ?? null,
    filterApplied: !!r.filterApplied,
    insufficientSample: !!r.insufficientSample,
    source: criterionDef.dataSources?.[0] || SRC_FOOTY,
    observedAt: observedAt || null,
    methodologyVersion: criterionDef.version,
  };
}

// 40 kriterin tamamının GÖLGE DEĞERLENDİRMESİ — kullanıcı seçiminden bağımsız,
// merkezî ve mühürlenebilir ham çıktı. Kullanıcının tahminine etki ETMEZ.
export function evaluateFullCatalog(m, { observedAt = null } = {}) {
  return CATALOG.map((c) => evaluateCriterion(c, m, { observedAt }));
}
