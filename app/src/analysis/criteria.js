// SEÇİLEBİLİR ANALİZ KRİTERLERİ KATALOĞU
// Sabit/hazır analiz YOK. İstatistik ekranındaki her veri burada seçilebilir
// bir kriter olarak tanımlıdır. Kullanıcı hangisini "Açık" yaparsa analiz motoru
// SADECE onları çalıştırır. Veri yoksa UYDURMAZ → "veri bulunamadı" + analiz dışı.
//
// Her kriter modülerdir: { key, label, desc, cat, defaultImpact, evaluate }
//   evaluate(home, away, m, names) → sonuç:
//     { available:true,  side:'home'|'away'|'draw'|null, strength:0..1, note }
//     { available:false, note }   // veri yok — analize etki etmez
//   side='home' → 1 ihtimalini destekler · 'away' → 2 · 'draw' → X/çifte riski
//   side=null   → bilgi amaçlı (yorumda görünür, sonucu/güveni etkilemez)
//   home/away = m.stats.home / m.stats.away  (İstatistik ekranıyla AYNI kaynak)

// ——— Etki (ağırlık) seviyeleri ———
export const IMPACT = {
  low:      { key: 'low',      label: 'Düşük',  w: 1 },
  mid:      { key: 'mid',      label: 'Orta',   w: 2 },
  high:     { key: 'high',     label: 'Yüksek', w: 3 },
  critical: { key: 'critical', label: 'Kritik', w: 4 },
};
export const IMPACT_ORDER = ['low', 'mid', 'high', 'critical'];

// ——— Kategoriler ———
export const CATEGORIES = [
  { id: 'ozet',     title: 'Takım Özet Bilgileri', icon: '🏷️' },
  { id: 'sezon',    title: 'Genel Sezon Verileri', icon: '📅' },
  { id: 'gol',      title: 'Gol Verileri',          icon: '⚽' },
  { id: 'beklenti', title: 'Beklenti ve Eğilim',    icon: '📈' },
  { id: 'ortalama', title: 'Maç Başı Ortalama',     icon: '📊' },
  { id: 'venue',    title: 'İç Saha / Deplasman',   icon: '🏟️' },
  { id: 'yorum',    title: 'Maç Yorumu Kriterleri', icon: '🧩' },
];

const NA = 'veri bulunamadı';

// ——— küçük yardımcılar ———
const num = (v) => (v == null || v === '' ? null : (typeof v === 'number' ? v : Number(v)));
const okNum = (v) => v != null && !Number.isNaN(v);
function fmt(v, u) { if (!okNum(v)) return '—'; const r = Math.round(v * 100) / 100; return `${r}${u || ''}`; }
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const playedOf = (st) => (st ? ((num(st.played) ?? ((st.wins || 0) + (st.draws || 0) + (st.losses || 0))) || null) : null);
const vPlayed = (sp) => (sp ? ((sp.wins || 0) + (sp.draws || 0) + (sp.losses || 0)) || null : null);
const vWinRate = (sp) => { const p = vPlayed(sp); return p ? (sp.wins || 0) / p : null; };
const vPpg = (sp) => { const p = vPlayed(sp); return p ? ((sp.wins || 0) * 3 + (sp.draws || 0)) / p : null; };
const vGF = (sp) => { const p = vPlayed(sp); return p ? (sp.goalsFor || 0) / p : null; };
const vGA = (sp) => { const p = vPlayed(sp); return p ? (sp.goalsAgainst || 0) / p : null; };
const formQ = (arr) => (Array.isArray(arr) && arr.length ? arr.reduce((s, r) => s + (r === 'G' ? 1 : r === 'B' ? 0.5 : 0), 0) / arr.length : null);

// ——— GENEL FİLTRELER (rakip gücü) — backend kataloğuyla parite ———
// Rakip sınıfı ALTIN KURAL ile: GERÇEK puan farkı (ppg farkı × ort. oynanan)
// ≥ 10 → güçlü/zayıf, altı orta; ppg verisi yoksa sıra dilimi YEDEĞİ.
// Takım eşleşmesi logo kimliği + tekil içerme ile ("TPS" ↔ "Turun Palloseura").
const CLASS_POINTS_GAP = 10;
const MIN_FILTER_SAMPLE = 2;
const TIER_LABELS = { strong: 'Güçlü', mid: 'Orta', weak: 'Zayıf' };
const logoSlugOf = (u) => { const mm = String(u || '').match(/\/([a-z0-9-]+)\.(png|jpg|jpeg|svg|webp)(\?|$)/i); return mm ? mm[1].toLowerCase() : null; };
const normTeam = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9çğıöşü]/g, '');
function tableRowOf(leagueTable, name, logo) {
  const overall = leagueTable?.overall;
  if (!Array.isArray(overall) || !overall.length) return null;
  const out = (row) => {
    if (!row) return null;
    const pts = num(row.points), pl = num(row.played);
    const ppg = okNum(pts) && okNum(pl) && pl >= 3 ? pts / pl : null;
    return { position: row.position, teamCount: overall.length, ppg, played: okNum(pl) ? pl : null };
  };
  const slug = logoSlugOf(logo);
  if (slug) { const r = overall.find((x) => logoSlugOf(x.logo) === slug); if (r) return out(r); }
  const key = normTeam(name);
  if (!key) return null;
  const exact = overall.find((x) => normTeam(x.name) === key);
  if (exact) return out(exact);
  if (key.length >= 4) {
    const part = overall.filter((x) => { const k = normTeam(x.name); return k.length >= 4 && (k.includes(key) || key.includes(k)); });
    if (part.length === 1) return out(part[0]);      // belirsiz içerme reddedilir
  }
  return null;
}
function oppTierOfApp(oppName, oppLogo, leagueTable, ownPpg, ownPlayed) {
  const row = tableRowOf(leagueTable, oppName, oppLogo);
  if (!row) return null;
  if (row.ppg != null && ownPpg != null) {
    const gap = (row.ppg - ownPpg) * (((ownPlayed || row.played || 0) + (row.played || ownPlayed || 0)) / 2);
    return gap >= CLASS_POINTS_GAP ? 'strong' : gap <= -CLASS_POINTS_GAP ? 'weak' : 'mid';
  }
  const rel = row.position / row.teamCount;            // ppg yoksa dürüst yedek
  return rel <= 0.33 ? 'strong' : rel <= 0.67 ? 'mid' : 'weak';
}
function filteredDetail(team, tier, leagueTable) {
  const pl = num(team?.standing?.played);
  const ownPpg = okNum(num(team?.standing?.ppg)) && okNum(pl) && pl >= 3 ? num(team.standing.ppg) : null;
  const rows = (team?.last5detail || []).filter((x) => x && x.result);
  const kept = tier === 'all' ? rows
    : rows.filter((x) => oppTierOfApp(x.oppName, x.oppLogo, leagueTable, ownPpg, okNum(pl) ? pl : null) === tier);
  const agg = { n: kept.length, pts: 0, form: [] };
  for (const x of kept) { agg.form.push(x.result); agg.pts += x.result === 'G' ? 3 : x.result === 'B' ? 1 : 0; }
  return agg;
}
const fltNote = (tier, nh, na) => ` [Filtre: ${TIER_LABELS[tier] || tier} rakipler — n=${nh}/${na}]`;
const fltInsufficient = (label, n) => ({ available: false, note: `${label}: seçili filtre için yeterli geçmiş maç yok (n=${n} < ${MIN_FILTER_SAMPLE}) — analiz dışı bırakıldı (uydurma hesap yapılmaz).` });

// ——— SEZON MAÇ LOGU FİLTRE MOTORU (merkezî — backend paritesi) ———
// enrich her takıma matchLog iliştirir: [{result,gf,ga,isHome,oppName,oppTier}]
// (oppTier = maç anındaki altın kural sınıfı). Filtre açıkken aşağıdaki 15
// kriter bu logdan hesaplanır; log yoksa (eski cache) motor eski yola düşer ve
// satır dürüstçe "genel değer kullanıldı" diye işaretlenir.
export const LOG_FILTERABLE_KEYS = [
  'wins', 'losses', 'draws', 'goalsFor', 'goalsAgainst', 'goalDiff',
  'over25', 'btts', 'cleanSheet', 'failedToScore',
  'venuePerformance', 'venuePpg', 'venueGoalsFor', 'venueGoalsAgainst', 'awayResilience',
];
const VENUE_FIXED_KEYS = { venuePerformance: 1, venuePpg: 1, venueGoalsFor: 1, venueGoalsAgainst: 1 };
function logAggApp(rows) {
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
function logRowsApp(team, f, venue) {
  let rows = Array.isArray(team?.matchLog) ? team.matchLog : null;
  if (!rows) return null;
  const cut = PERIOD_SLICE[f.period];
  if (cut) rows = rows.slice(0, cut);                 // Son 5/10/15 maçın İÇİNDEN filtrelenir
  if (venue === 'home') rows = rows.filter((x) => x.isHome);
  else if (venue === 'away') rows = rows.filter((x) => !x.isHome);
  if (f.opponentStrength && f.opponentStrength !== 'all') rows = rows.filter((x) => x.oppTier === f.opponentStrength);
  return rows;
}
function logFNoteApp(f, nh, na) {
  const seg = [];
  if (f.opponentStrength && f.opponentStrength !== 'all') seg.push(`${TIER_LABELS[f.opponentStrength] || f.opponentStrength} rakipler`);
  if (f.venueScope === 'split') seg.push('Ev içi/Dep dışı');
  if (f.period === 'last5') seg.push('Son 5');
  return ` [Filtre: ${seg.join(' · ') || 'maç logu'} — n=${nh}${na != null ? `/${na}` : ''}]`;
}
// Filtreli 0—0 GERÇEK veridir (n maç oynandı) → "veri yok" denmez; eşitlik yön üretmez.
function cmpFlt(hv, av, dir, label, unit, names) {
  if (Math.abs(hv) < 1e-9 && Math.abs(av) < 1e-9) {
    return { available: true, side: null, strength: 0, note: `${label}: filtrelenen maçlarda iki takım eşit (0 — 0) — yön sinyali yok.` };
  }
  return cmp(hv, av, dir, label, unit, names);
}
// İSTATİSTİK sekmesi FİLTRELİ KARNE görünümü: takımın maç logundan seçilen
// kesite (dönem/saha/rakip gücü) göre gerçek istatistikler. Log yoksa null.
export function statsFromLog(team, f, side /* 'home' | 'away' */) {
  // Saha: 'split' → ev takımı içeride / dep dışarıda; 'home'/'away' → iki takım
  // için de aynı saha kesiti; 'overall' → tümü.
  const venue = f.venueScope === 'split' ? side
    : (f.venueScope === 'home' || f.venueScope === 'away') ? f.venueScope : null;
  const rows = logRowsApp(team, f, venue);
  if (rows == null) return null;
  const v = logAggApp(rows);
  const r1x = (x) => Math.round(x * 100) / 100;
  const pc = (x) => Math.round((x / v.n) * 100);
  return v.n === 0 ? { n: 0 } : {
    n: v.n, w: v.w, d: v.d, l: v.l,
    gfPg: r1x(v.gf / v.n), gaPg: r1x(v.ga / v.n), ppg: r1x(v.pts / v.n),
    csPct: pc(v.cs), bttsPct: pc(v.btts), overPct: pc(v.over), ftsPct: pc(v.fts),
  };
}

// ÜRETİLMİŞ GÖSTERGELER — ham kaynak istatistiklerinden ŞEFFAF formüllerle
// türetilir; hiçbiri ham verinin kopyası değildir (mükerrer sıfır kuralı).
// Veri yoksa ilgili alan null döner — uydurma hesap yapılmaz:
//   finishing   = Gol ÷ xG            (1 üstü: beklenenden verimli hücum)
//   defEff      = Yediği ÷ xG Karşı   (1 altı: beklenenden sağlam savunma)
//   shotAcc     = İsabetli ÷ Toplam şut (%)
//   goalsPerShot= Gol ÷ Toplam şut
//   momentum    = son 5 ppg − sezon(log) ppg (log ≥ 6 maç ister)
//   venueGap    = içerideki ppg − dışarıdaki ppg (her sahada ≥ 3 maç ister)
//   weightedLast5 = son 5 puanı × rakip katsayısı (altın kural: güçlü 1.5 ·
//                   denk 1 · zayıf 0.5; sınıfı bilinen ≥ 3 maç ister)
//   *Run seriler = maç anına kadar kesintisiz sayım (yenilmezlik/galibiyet/
//                  gol atma/temiz kale/KG)
export function derivedStats(team) {
  const se = team?.season || null;
  const r2 = (x) => Math.round(x * 100) / 100;
  const out = {
    finishing: null, defEff: null, shotAcc: null, goalsPerShot: null,
    momentum: null, venueGap: null, weightedLast5: null,
    unbeatenRun: null, winRun: null, scoringRun: null, csRun: null, bttsRun: null,
  };
  // xG/şut tabanlı (kaynak sezon ort.; 0/boş = veri yok → null, sıfır uydurulmaz)
  const gf = se?.goalsPerGame, xg = se?.xgFor, ga = se?.concededPerGame, xga = se?.xgAgainst;
  if (gf > 0 && xg > 0) out.finishing = r2(gf / xg);
  if (ga > 0 && xga > 0) out.defEff = r2(ga / xga);
  const sh = se?.avg?.shots, sot = se?.avg?.shotsOnTarget;
  if (sh > 0 && sot > 0) out.shotAcc = Math.round((sot / sh) * 100);
  if (sh > 0 && gf > 0) out.goalsPerShot = r2(gf / sh);
  // Maç logu tabanlı (gerçek maç kesiti; log yoksa null kalır)
  const log = Array.isArray(team?.matchLog) ? team.matchLog : null;
  if (log && log.length > 0) {
    const pts = (x) => (x.result === 'G' ? 3 : x.result === 'B' ? 1 : 0);
    const ppgOf = (rows) => rows.reduce((a, x) => a + pts(x), 0) / rows.length;
    if (log.length >= 6) out.momentum = r2(ppgOf(log.slice(0, 5)) - ppgOf(log));
    const home = log.filter((x) => x.isHome), away = log.filter((x) => !x.isHome);
    if (home.length >= 3 && away.length >= 3) out.venueGap = r2(ppgOf(home) - ppgOf(away));
    const W = { strong: 1.5, mid: 1, weak: 0.5 };
    const l5 = log.slice(0, 5).filter((x) => W[x.oppTier] != null);
    if (l5.length >= 3) out.weightedLast5 = r2(l5.reduce((a, x) => a + pts(x) * W[x.oppTier], 0));
    const run = (ok) => { let n = 0; for (const x of log) { if (ok(x)) n += 1; else break; } return n; };
    out.unbeatenRun = run((x) => x.result !== 'M');
    out.winRun = run((x) => x.result === 'G');
    out.scoringRun = run((x) => (x.gf || 0) > 0);
    out.csRun = run((x) => (x.ga || 0) === 0);
    out.bttsRun = run((x) => (x.gf || 0) > 0 && (x.ga || 0) > 0);
  }
  return out;
}

export function logFilteredEvalApp(key, h, a, names, f) {
  if (!LOG_FILTERABLE_KEYS.includes(key)) return null;
  const gv = (f.venueScope === 'home' || f.venueScope === 'away') ? f.venueScope : null;
  const venueH = VENUE_FIXED_KEYS[key] ? 'home' : key === 'awayResilience' ? null : (f.venueScope === 'split' ? 'home' : gv);
  const venueA = VENUE_FIXED_KEYS[key] ? 'away' : key === 'awayResilience' ? 'away' : (f.venueScope === 'split' ? 'away' : gv);
  const rowsH = key === 'awayResilience' ? [] : logRowsApp(h, f, venueH);
  const rowsA = logRowsApp(a, f, venueA);
  if ((key !== 'awayResilience' && rowsH == null) || rowsA == null) return null;
  const vh = logAggApp(rowsH || []), va = logAggApp(rowsA);
  const MINN = key === 'draws' ? 4 : key === 'awayResilience' ? 3 : 2;
  const nOk = key === 'awayResilience' ? va.n >= MINN : (vh.n >= MINN && va.n >= MINN);
  if (!nOk) {
    return { available: false, filterApplied: true, note: `${key === 'awayResilience' ? 'Deplasmanda direnç' : 'Bu kriter'}: seçili filtre için yeterli maç yok (n=${key === 'awayResilience' ? va.n : Math.min(vh.n, va.n)} < ${MINN}) — analiz dışı bırakıldı (uydurma hesap yapılmaz).` };
  }
  const done = (out, nh = vh.n, na = va.n) => {
    if (out && out.note != null) { out.note += logFNoteApp(f, nh, na); out.filterApplied = true; }
    return out;
  };
  const pct100 = (x, n2) => Math.round((x / n2) * 100);
  switch (key) {
    case 'wins': return done(cmpFlt(vh.w / vh.n, va.w / va.n, 'higher', 'Galibiyet oranı', '', names));
    case 'losses': return done(cmpFlt(vh.l / vh.n, va.l / va.n, 'lower', 'Mağlubiyet oranı', '', names));
    case 'goalsFor': return done(cmpFlt(vh.gf / vh.n, va.gf / va.n, 'higher', 'Gol ort.', '', names));
    case 'goalsAgainst': return done(cmpFlt(vh.ga / vh.n, va.ga / va.n, 'lower', 'Yediği gol ort.', '', names));
    case 'goalDiff': return done(cmpFlt((vh.gf - vh.ga) / vh.n, (va.gf - va.ga) / va.n, 'higher', 'Averaj/maç', '', names));
    case 'cleanSheet': return done(cmpFlt(pct100(vh.cs, vh.n), pct100(va.cs, va.n), 'higher', 'Temiz kale %', '%', names));
    case 'failedToScore': return done(cmpFlt(pct100(vh.fts, vh.n), pct100(va.fts, va.n), 'lower', 'Gol atamadı %', '%', names));
    case 'venuePerformance': return done(cmpFlt(vh.w / vh.n, va.w / va.n, 'higher', 'İç/dış galibiyet oranı', '', names));
    case 'venuePpg': return done(cmpFlt(vh.pts / vh.n, va.pts / va.n, 'higher', 'İç/dış PPG', '', names));
    case 'venueGoalsFor': return done(cmpFlt(vh.gf / vh.n, va.gf / va.n, 'higher', 'İç/dış gol ort.', '', names));
    case 'venueGoalsAgainst': return done(cmpFlt(vh.ga / vh.n, va.ga / va.n, 'lower', 'İç/dış yediği gol ort.', '', names));
    case 'over25': {
      const hv = pct100(vh.over, vh.n), av2 = pct100(va.over, va.n);
      return done({ available: true, side: null, strength: 0, note: `2.5 Üst: ${names.home} %${hv} · ${names.away} %${av2}. Gol beklentisi göstergesi (skor yönünü tek başına belirlemez).` });
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

// Genel sayısal kıyas. dir: 'higher' → büyük olan avantajlı; 'lower' → küçük.
// EŞİTLİK ≠ BERABERLİK: iki değerin eşit olması X kanıtı DEĞİLDİR — yön yoktur
// (side:null → hiçbir tarafa puan akmaz). Sezon başında herkes 0'da "eşit"
// göründüğü için eski hali 9 kriteri birden X'e sayıyor ve sahte "X açık ara
// önde · Güven Yüksek" üretiyordu. Ayrıca 0—0 kıyas VERİ DEĞİLDİR → analiz dışı.
function cmp(hv, av, dir, label, unit, names, extra) {
  hv = num(hv); av = num(av);
  if (!okNum(hv) || !okNum(av)) return { available: false, note: `${label}: ${NA} — bu kriter analiz dışı bırakıldı.` };
  if (Math.abs(hv) < 1e-9 && Math.abs(av) < 1e-9) {
    return { available: false, note: `${label}: iki değer de 0 — veri henüz oluşmamış (sezon başı olabilir); bu kriter analiz dışı bırakıldı.` };
  }
  if (Math.abs(hv - av) < 1e-9) return { available: true, side: null, strength: 0, note: `${label}: iki takım eşit (${fmt(hv, unit)} — ${fmt(av, unit)}) — yön sinyali yok (eşitlik beraberlik kanıtı değildir).` };
  const homeBetter = dir === 'lower' ? hv < av : hv > av;
  const side = homeBetter ? 'home' : 'away';
  const team = homeBetter ? names.home : names.away;
  const denom = Math.max(Math.abs(hv), Math.abs(av), 1e-6);
  const strength = clamp01(Math.abs(hv - av) / denom);
  const opt = side === 'home' ? '1' : '2';
  return { available: true, side, strength, note: `${label}: ${team} önde (${fmt(hv, unit)} — ${fmt(av, unit)}) → ${opt} ihtimalini destekliyor.${extra ? ' ' + extra : ''}` };
}

// İç saha (ev) vs dış saha (deplasman) kıyası — adil karşılaştırma.
function venueCmp(hv, av, dir, label, unit, names) {
  hv = num(hv); av = num(av);
  if (!okNum(hv) || !okNum(av)) return { available: false, note: `${label}: ${NA} — bu kriter analiz dışı bırakıldı.` };
  if (Math.abs(hv) < 1e-9 && Math.abs(av) < 1e-9) {
    return { available: false, note: `${label}: iki değer de 0 — veri henüz oluşmamış (sezon başı olabilir); bu kriter analiz dışı bırakıldı.` };
  }
  if (Math.abs(hv - av) < 1e-9) return { available: true, side: null, strength: 0, note: `${label}: ev sahibi (iç saha) ile deplasman (dış saha) eşit (${fmt(hv, unit)} — ${fmt(av, unit)}) — yön sinyali yok.` };
  const homeBetter = dir === 'lower' ? hv < av : hv > av;
  const side = homeBetter ? 'home' : 'away';
  const denom = Math.max(Math.abs(hv), Math.abs(av), 1e-6);
  const strength = clamp01(Math.abs(hv - av) / denom);
  const who = homeBetter ? `${names.home} iç sahada` : `${names.away} dış sahada`;
  const opt = side === 'home' ? '1' : '2';
  return { available: true, side, strength, note: `${label}: ${who} daha iyi (ev ${fmt(hv, unit)} — dep ${fmt(av, unit)}) → ${opt} ihtimalini destekliyor.` };
}

const st = (t) => t?.standing || null;
const sn = (t) => t?.season || null;
const avg = (t) => t?.season?.avg || null;

// ——— ORTAK RAKİP KIYASI (özel) ———
function commonOpponents(home, away, names) {
  const hd = home?.last5detail || [], ad = away?.last5detail || [];
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
  // Averaj/gol yalnız tie-break → tek örnekte belirleyici değil.
  const strength = basis === 'sonuç' ? clamp01(Math.abs(diff) / 4) : (n >= 2 ? 0.25 : 0);
  const why = basis === 'sonuç' ? 'daha iyi sonuç almış' : basis === 'averaj' ? 'aynı sonuç ama daha az gol yemiş' : 'aynı sonuç ama daha çok gol atmış';
  const opt = side === 'home' ? '1' : '2';
  return { available: true, side, strength, note: `Ortak rakip: ${team} ${why} (${n} ortak rakip) → ${opt} ihtimalini destekliyor.${strength === 0 ? ' Tek örnek olduğu için belirleyici sayılmadı.' : ''}` };
}

// veri yok kriterleri (uydurma yasak) — seçilse de analize etki etmez.
const noData = (label, extra) => () => ({ available: false, note: `${label}: ${NA}${extra ? ' (' + extra + ')' : ''} — bu kriter analiz dışı bırakıldı.` });

// ——— KATALOG ———
export const CRITERIA = [
  // 1) Takım Özet
  { key: 'position', label: 'Lig Sırası', desc: 'Takımların ligdeki güncel sıralaması dikkate alınır (üst sıra avantaj).', cat: 'ozet', defaultImpact: 'high',
    evaluate: (h, a, m, n) => cmp(st(h)?.position, st(a)?.position, 'lower', 'Lig sırası', '.', n) },
  { key: 'formGeneral', label: 'Son Maç Formu', desc: 'Son maçlardaki genel form (G/B/M) kıyaslanır.', cat: 'ozet', defaultImpact: 'high',
    evaluate: (h, a, m, n, ctx) => {
      // GENEL FİLTRE (rakip gücü): açıkça seçildiyse form yalnız o sınıftaki
      // rakiplere karşı maçlardan hesaplanır; yeterli maç yoksa dürüst "analiz dışı".
      const tier = ctx?.filtersExplicit ? (ctx.filters?.opponentStrength || 'all') : 'all';
      if (tier !== 'all') {
        const lt = m?.stats?.leagueTable;
        const vh = filteredDetail(h, tier, lt), va = filteredDetail(a, tier, lt);
        if (vh.n < MIN_FILTER_SAMPLE || va.n < MIN_FILTER_SAMPLE) return fltInsufficient('Son form', Math.min(vh.n, va.n));
        const out = cmp(formQ(vh.form), formQ(va.form), 'higher', 'Son form', '', n);
        if (out.available) { out.note += fltNote(tier, vh.n, va.n); out.filterApplied = true; }
        return out;
      }
      return cmp(formQ(h?.last5), formQ(a?.last5), 'higher', 'Son form', '', n);
    } },
  { key: 'powerCompare', label: 'Takım Güç Kıyaslaması', desc: 'Puan ve averajın birleşimiyle genel güç kıyaslanır.', cat: 'ozet', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => {
      const hp = st(h)?.points, ap = st(a)?.points, hg = st(h)?.goalDiff, ag = st(a)?.goalDiff;
      if (!okNum(num(hp)) || !okNum(num(ap))) return { available: false, note: `Güç kıyaslaması: ${NA} — analiz dışı.` };
      const hv = num(hp) + (num(hg) || 0) * 0.3, av = num(ap) + (num(ag) || 0) * 0.3;
      return cmp(hv, av, 'higher', 'Güç göstergesi', '', n);
    } },

  // 2) Genel Sezon
  { key: 'points', label: 'Puan / Puan Farkı', desc: 'Ligdeki toplam puan ve iki takım arası puan farkı.', cat: 'sezon', defaultImpact: 'high',
    evaluate: (h, a, m, n) => cmp(st(h)?.points, st(a)?.points, 'higher', 'Puan', '', n) },
  { key: 'ppg', label: 'PPG (Maç Başı Puan)', desc: 'Maç başına düşen ortalama puan.', cat: 'sezon', defaultImpact: 'mid',
    evaluate: (h, a, m, n, ctx) => {
      const tier = ctx?.filtersExplicit ? (ctx.filters?.opponentStrength || 'all') : 'all';
      if (tier !== 'all') {
        const lt = m?.stats?.leagueTable;
        const vh = filteredDetail(h, tier, lt), va = filteredDetail(a, tier, lt);
        if (vh.n < MIN_FILTER_SAMPLE || va.n < MIN_FILTER_SAMPLE) return fltInsufficient('PPG', Math.min(vh.n, va.n));
        const out = cmp(vh.pts / vh.n, va.pts / va.n, 'higher', 'PPG', '', n);
        if (out.available) { out.note += fltNote(tier, vh.n, va.n); out.filterApplied = true; }
        return out;
      }
      return cmp(st(h)?.ppg ?? sn(h)?.recentPpg, st(a)?.ppg ?? sn(a)?.recentPpg, 'higher', 'PPG', '', n);
    } },
  { key: 'wins', label: 'Galibiyet Sayısı', desc: 'Sezon boyunca alınan galibiyet sayısı.', cat: 'sezon', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(st(h)?.wins, st(a)?.wins, 'higher', 'Galibiyet', '', n) },
  { key: 'losses', label: 'Mağlubiyet Sayısı', desc: 'Az mağlubiyet alan takım daha istikrarlı kabul edilir.', cat: 'sezon', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(st(h)?.losses, st(a)?.losses, 'lower', 'Mağlubiyet', '', n) },
  { key: 'draws', label: 'Beraberlik Eğilimi', desc: 'İki takımın da beraberlik oranı yüksekse X / çift ihtimal değerlendirilir.', cat: 'sezon', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => {
      const hp = playedOf(st(h)), ap = playedOf(st(a));
      if (!hp || !ap) return { available: false, note: `Beraberlik eğilimi: ${NA} — analiz dışı.` };
      const hr = (st(h).draws || 0) / hp, ar = (st(a).draws || 0) / ap, comb = (hr + ar) / 2;
      return { available: true, side: comb >= 0.28 ? 'draw' : null, strength: clamp01(comb), note: `Beraberlik eğilimi: ${n.home} %${Math.round(hr * 100)} · ${n.away} %${Math.round(ar * 100)} berabere kalıyor.${comb >= 0.28 ? ' Yüksek → X / çift ihtimal riski artıyor.' : ' Düşük → beraberlik baskısı zayıf.'}` };
    } },

  // 3) Gol
  { key: 'goalsFor', label: 'Attığı Gol (Toplam)', desc: 'Sezon boyunca atılan toplam gol.', cat: 'gol', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(st(h)?.goalsFor, st(a)?.goalsFor, 'higher', 'Attığı gol', '', n) },
  { key: 'goalsAgainst', label: 'Yediği Gol (Toplam)', desc: 'Sezon boyunca yenen toplam gol (az iyi).', cat: 'gol', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(st(h)?.goalsAgainst, st(a)?.goalsAgainst, 'lower', 'Yediği gol', '', n) },
  { key: 'goalDiff', label: 'Averaj', desc: 'Attığı ve yediği gol farkı.', cat: 'gol', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(st(h)?.goalDiff, st(a)?.goalDiff, 'higher', 'Averaj', '', n) },
  { key: 'goalsPerGame', label: 'Gol / Maç', desc: 'Maç başına atılan ortalama gol (gol atma alışkanlığı).', cat: 'gol', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(sn(h)?.goalsPerGame, sn(a)?.goalsPerGame, 'higher', 'Gol/maç', '', n) },
  { key: 'concededPerGame', label: 'Yediği Gol / Maç', desc: 'Maç başına yenen ortalama gol (gol yeme alışkanlığı).', cat: 'gol', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(sn(h)?.concededPerGame, sn(a)?.concededPerGame, 'lower', 'Yediği/maç', '', n) },

  // 4) Beklenti ve Eğilim
  { key: 'xgFor', label: 'xG (Hücum Beklentisi)', desc: 'Ürettiği pozisyon kalitesi — beklenen gol (hücum).', cat: 'beklenti', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(sn(h)?.xgFor, sn(a)?.xgFor, 'higher', 'xG (hücum)', '', n) },
  { key: 'xgAgainst', label: 'xG Karşı (Savunma Beklentisi)', desc: 'Rakibe verdiği pozisyon kalitesi — beklenen gol (savunma, az iyi).', cat: 'beklenti', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(sn(h)?.xgAgainst, sn(a)?.xgAgainst, 'lower', 'xG (savunma)', '', n) },
  { key: 'over25', label: '2.5 Üst Yüzdesi', desc: 'Maçlarında 2.5 üstü gol olma eğilimi (bilgi amaçlı — tek tarafı desteklemez).', cat: 'beklenti', defaultImpact: 'low',
    evaluate: (h, a, m, n) => {
      const hv = num(sn(h)?.over25Pct), av = num(sn(a)?.over25Pct);
      if (!okNum(hv) || !okNum(av)) return { available: false, note: `2.5 Üst: ${NA} — analiz dışı.` };
      return { available: true, side: null, strength: 0, note: `2.5 Üst: ${n.home} %${Math.round(hv)} · ${n.away} %${Math.round(av)}. Gol beklentisi göstergesi (skor yönünü tek başına belirlemez).` };
    } },
  { key: 'btts', label: 'KG Var Yüzdesi', desc: 'İki takımın da gol bulma eğilimi — yüksekse X / çift ihtimal riski değerlendirilir.', cat: 'beklenti', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => {
      const hv = num(sn(h)?.bttsPct), av = num(sn(a)?.bttsPct);
      if (!okNum(hv) || !okNum(av)) return { available: false, note: `KG Var: ${NA} — analiz dışı.` };
      const comb = (hv + av) / 200;
      return { available: true, side: comb >= 0.55 ? 'draw' : null, strength: clamp01(comb), note: `KG Var: ${n.home} %${Math.round(hv)} · ${n.away} %${Math.round(av)}.${comb >= 0.55 ? ' Yüksek → iki takım da gol buluyor, çift ihtimal / X riski artıyor.' : ' Orta-düşük seviye.'}` };
    } },
  { key: 'cleanSheet', label: 'Temiz Kale Yüzdesi', desc: 'Gol yemeden bitirme oranı (savunma istikrarı).', cat: 'beklenti', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(sn(h)?.cleanSheetPct, sn(a)?.cleanSheetPct, 'higher', 'Temiz kale %', '%', n) },
  { key: 'failedToScore', label: 'Gol Atamadı Yüzdesi', desc: 'Gol atamadan biten maç oranı (az iyi).', cat: 'beklenti', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(sn(h)?.failedToScorePct, sn(a)?.failedToScorePct, 'lower', 'Gol atamadı %', '%', n) },

  // 5) Maç Başı Ortalama
  { key: 'possession', label: 'Topla Oynama', desc: 'Maç başı ortalama topa sahip olma yüzdesi.', cat: 'ortalama', defaultImpact: 'low',
    evaluate: (h, a, m, n) => cmp(avg(h)?.possession, avg(a)?.possession, 'higher', 'Topla oynama', '%', n) },
  { key: 'shots', label: 'Şut', desc: 'Maç başı ortalama toplam şut.', cat: 'ortalama', defaultImpact: 'low',
    evaluate: (h, a, m, n) => cmp(avg(h)?.shots, avg(a)?.shots, 'higher', 'Şut', '', n) },
  { key: 'shotsOnTarget', label: 'İsabetli Şut', desc: 'Maç başı ortalama isabetli şut.', cat: 'ortalama', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => cmp(avg(h)?.shotsOnTarget, avg(a)?.shotsOnTarget, 'higher', 'İsabetli şut', '', n) },
  { key: 'corners', label: 'Korner', desc: 'Maç başı ortalama korner (baskı göstergesi).', cat: 'ortalama', defaultImpact: 'low',
    evaluate: (h, a, m, n) => cmp(avg(h)?.corners, avg(a)?.corners, 'higher', 'Korner', '', n) },
  { key: 'fouls', label: 'Faul', desc: 'Maç başı ortalama faul (az genelde daha kontrollü).', cat: 'ortalama', defaultImpact: 'low',
    evaluate: (h, a, m, n) => cmp(avg(h)?.fouls, avg(a)?.fouls, 'lower', 'Faul', '', n) },
  { key: 'cards', label: 'Kart', desc: 'Maç başı ortalama kart (az genelde daha disiplinli).', cat: 'ortalama', defaultImpact: 'low',
    evaluate: (h, a, m, n) => cmp(avg(h)?.cards, avg(a)?.cards, 'lower', 'Kart', '', n) },

  // 6) İç Saha / Deplasman
  { key: 'venuePerformance', label: 'İç Saha / Deplasman Performansı', desc: 'Ev sahibinin iç saha galibiyet oranı ile deplasmanın dış saha galibiyet oranı.', cat: 'venue', defaultImpact: 'high',
    evaluate: (h, a, m, n) => venueCmp(vWinRate(st(h)?.home), vWinRate(st(a)?.away), 'higher', 'İç/dış galibiyet oranı', '', n) },
  { key: 'venuePpg', label: 'İç / Dış Puan Ortalaması', desc: 'Ev sahibinin iç sahada, deplasmanın dış sahada maç başı puanı.', cat: 'venue', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => venueCmp(vPpg(st(h)?.home), vPpg(st(a)?.away), 'higher', 'İç/dış PPG', '', n) },
  { key: 'venueGoalsFor', label: 'İç / Dış Gol Ortalaması', desc: 'Ev sahibinin iç sahada, deplasmanın dış sahada attığı ortalama gol.', cat: 'venue', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => venueCmp(vGF(st(h)?.home), vGF(st(a)?.away), 'higher', 'İç/dış gol ort.', '', n) },
  { key: 'venueGoalsAgainst', label: 'İç / Dış Yediği Gol Ortalaması', desc: 'Ev sahibinin iç sahada, deplasmanın dış sahada yediği ortalama gol (az iyi).', cat: 'venue', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => venueCmp(vGA(st(h)?.home), vGA(st(a)?.away), 'lower', 'İç/dış yediği gol ort.', '', n) },
  { key: 'xgForVenue', label: 'İç / Dış xG (Hücum)', desc: 'Ev sahibinin iç sahada, deplasmanın dış sahada ürettiği beklenen gol (xG).', cat: 'venue', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => venueCmp(sn(h)?.xgForHome, sn(a)?.xgForAway, 'higher', 'İç/dış xG (hücum)', '', n) },
  { key: 'xgAgainstVenue', label: 'İç / Dış xGA (Savunma)', desc: 'Ev sahibinin iç sahada, deplasmanın dış sahada rakibe verdiği beklenen gol (xGA, az iyi).', cat: 'venue', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => venueCmp(sn(h)?.xgAgainstHome, sn(a)?.xgAgainstAway, 'lower', 'İç/dış xGA (savunma)', '', n) },

  // 7) Maç Yorumu
  { key: 'homeAdvantage', label: 'Ev Sahibi Avantajı', desc: 'Sahasında oynayan takım lehine hafif katkı.', cat: 'yorum', defaultImpact: 'low',
    evaluate: (h, a, m, n) => ({ available: true, side: 'home', strength: 0.25, note: `Ev sahibi avantajı: sahasında oynayan ${n.home} lehine hafif katkı → 1 ihtimaline az destek.` }) },
  { key: 'awayResilience', label: 'Deplasmanda Direnç', desc: 'Deplasman takımı dış sahada dirençliyse 2 / X güçlenir.', cat: 'yorum', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => {
      const wr = vWinRate(st(a)?.away), dr = st(a)?.away ? (st(a).away.draws || 0) / (vPlayed(st(a).away) || 1) : null;
      if (wr == null) return { available: false, note: `Deplasmanda direnç: ${NA} — analiz dışı.` };
      if (wr >= 0.45) return { available: true, side: 'away', strength: clamp01(wr), note: `Deplasmanda direnç: ${n.away} dış sahada güçlü (galibiyet oranı %${Math.round(wr * 100)}) → 2 ihtimali güçleniyor.` };
      if (dr != null && dr >= 0.35) return { available: true, side: 'draw', strength: clamp01(dr), note: `Deplasmanda direnç: ${n.away} dışarıda çok berabere kalıyor (%${Math.round(dr * 100)}) → X / çift ihtimal riski.` };
      return { available: true, side: 'home', strength: clamp01(0.5 - wr), note: `Deplasmanda direnç: ${n.away} dış sahada zayıf (galibiyet oranı %${Math.round(wr * 100)}) → 1 ihtimali lehine.` };
    } },
  { key: 'commonOpponents', label: 'Ortak Rakip Kıyaslaması', desc: 'Son maçlarda ortak rakiplere karşı alınan sonuçlar kıyaslanır.', cat: 'yorum', defaultImpact: 'high',
    evaluate: (h, a, m, n) => commonOpponents(h, a, n) },
  { key: 'missingPlayers', label: 'Eksik Oyuncu', desc: 'Kadro eksikleri güven seviyesini etkiler (veri gelirse).', cat: 'yorum', defaultImpact: 'high', evaluate: noData('Eksik oyuncu', 'kadro/sakatlık verisi gelmiyor') },
  { key: 'topScorerMissing', label: 'Golcü Oyuncu Eksikliği', desc: 'Gol yükünü taşıyan oyuncu eksikse güven düşürülür (veri gelirse).', cat: 'yorum', defaultImpact: 'critical', evaluate: noData('Golcü eksikliği', 'oyuncu sakatlık verisi gelmiyor') },
  { key: 'assistMissing', label: 'Asist Yapan Oyuncu Eksikliği', desc: 'Asist üreten oyuncu eksikse hücum gücü düşer (veri gelirse).', cat: 'yorum', defaultImpact: 'high', evaluate: noData('Asistçi eksikliği', 'oyuncu sakatlık verisi gelmiyor') },
  { key: 'coachChange', label: 'Teknik Direktör Değişimi', desc: 'Hoca değişimi takımı etkileyebilir (veri gelirse).', cat: 'yorum', defaultImpact: 'mid', evaluate: noData('Teknik direktör değişimi', 'kaynak sağlamıyor') },
  { key: 'newCoachEffect', label: 'Yeni Hoca Etkisi', desc: 'Yeni hocayla gelen çıkış/düşüş (veri gelirse).', cat: 'yorum', defaultImpact: 'mid', evaluate: noData('Yeni hoca etkisi', 'kaynak sağlamıyor') },
  { key: 'formDrop', label: 'Form Düşüşü', desc: 'Son maçlarda mağlubiyet oranı artan takım daha riskli kabul edilir.', cat: 'yorum', defaultImpact: 'mid',
    evaluate: (h, a, m, n) => {
      const lossRate = (arr) => (Array.isArray(arr) && arr.length ? arr.filter((r) => r === 'M').length / arr.length : null);
      const hl = lossRate(h?.last5), al = lossRate(a?.last5);
      if (hl == null || al == null) return { available: false, note: `Form düşüşü: ${NA} — analiz dışı.` };
      return cmp(hl, al, 'lower', 'Form düşüşü (son maç mağlubiyet oranı)', '', n);
    } },
];

export const CRITERIA_MAP = Object.fromEntries(CRITERIA.map((c) => [c.key, c]));
export const criteriaByCategory = (catId) => CRITERIA.filter((c) => c.cat === catId);

// Kriter bilgi kutusu — kullanıcı karta dokununca "bu ne işe yarar" açıklaması.
// Ne olduğu + yüksek/düşük ne anlama gelir + motorun nasıl kullandığı.
export const CRITERIA_INFO = {
  position: 'Takımın ligdeki güncel sırasıdır. Üst sıra genelde daha güçlü/istikrarlı takımı gösterir. Açtığında sistem iki takımın sırasını kıyaslar; üst sıradaki takımı (ev ise 1, deplasman ise 2) destekler.',
  formGeneral: 'Son maçlardaki genel gidişat (G/B/M). Galibiyet 1, beraberlik 0.5, mağlubiyet 0 sayılıp ortalaması alınır. Yüksek olan takım "formda" kabul edilir. Sistem daha formda olan tarafı destekler.',
  powerCompare: 'Puan ile averajın birleşiminden çıkan genel güç göstergesi. Sadece puana değil, gol farkına da bakarak takımın gerçek gücünü kıyaslar. Güçlü olan tarafı destekler.',
  points: 'Takımın ligde topladığı toplam puan ve iki takım arasındaki puan farkı. Fark ne kadar açıksa üstün olan takım o kadar önde başlar. Sistem puanı yüksek olan tarafı destekler.',
  ppg: 'Points Per Game — maç başına düşen ortalama puan (toplam puan ÷ oynanan maç). Farklı sayıda maç oynamış takımları adil kıyaslar. Yüksek olan tarafı destekler.',
  wins: 'Sezon boyunca alınan galibiyet sayısı. Çok galibiyet = kazanma alışkanlığı. Sistem daha çok galibiyeti olan tarafı destekler.',
  losses: 'Sezon boyunca alınan mağlubiyet sayısı. Az mağlubiyet = daha istikrarlı, zor yenilen takım. Sistem daha az mağlubiyeti olan tarafı destekler.',
  draws: 'İki takımın beraberlik oranı. İkisi de sık berabere kalıyorsa maçın X (beraberlik) veya çift ihtimalle bitme riski artar. Bu kriter tek tarafı değil, X ihtimalini besler.',
  goalsFor: 'Sezon boyunca atılan toplam gol. Hücum gücünün en basit göstergesi. Sistem daha çok gol atan tarafı destekler.',
  goalsAgainst: 'Sezon boyunca yenen toplam gol. Az gol yemek = sağlam savunma. Sistem daha az gol yiyen tarafı destekler.',
  goalDiff: 'Averaj = atılan gol − yenen gol. Hem hücumu hem savunmayı tek sayıda özetler. Yüksek averajlı tarafı destekler.',
  goalsPerGame: 'Maç başına atılan ortalama gol (gol atma alışkanlığı). Toplam gol yerine maç başına bakar. Yüksek olan tarafı destekler.',
  concededPerGame: 'Maç başına yenen ortalama gol (gol yeme alışkanlığı). Düşükse savunma güçlü. Sistem daha az gol yiyen tarafı destekler.',
  xgFor: 'xG (beklenen gol) — takımın ürettiği pozisyonların kalitesi. Şansa değil, gerçek pozisyon üretimine bakar. Hücum beklentisi yüksek olan tarafı destekler.',
  xgAgainst: 'Rakiplere verdiği pozisyonların kalitesi (savunma beklentisi). Düşükse savunma pozisyon vermiyor demektir. Sistem daha az pozisyon veren tarafı destekler.',
  over25: 'Maçlarının yüzde kaçında 2.5 üstü (3+) gol olduğu. Gol beklentisi göstergesidir; maçın çok gollü geçip geçmeyeceğine dair fikir verir ama tek başına 1/2 yönünü belirlemez, bilgi amaçlıdır.',
  btts: 'KG Var — iki takımın da gol attığı maç oranı. İkisi de yüksekse maçta iki tarafın da gol bulma ihtimali yüksek; bu da çift ihtimal / beraberlik riskini artırır.',
  cleanSheet: 'Temiz kale — gol yemeden bitirilen maç oranı. Savunma istikrarını gösterir. Sistem temiz kale oranı yüksek olan tarafı destekler.',
  failedToScore: 'Gol atamadı — hiç gol atamadan biten maç oranı. Düşükse takım hemen her maç gol buluyor demektir. Sistem bu oranı düşük olan tarafı destekler.',
  possession: 'Maç başına ortalama topa sahip olma yüzdesi. Oyun kurma eğilimini gösterir. Sistem topa daha çok sahip olan tarafı hafifçe destekler (düşük etkili).',
  shots: 'Maç başına ortalama toplam şut. Baskı ve hücum hacmini gösterir. Sistem daha çok şut çeken tarafı destekler.',
  shotsOnTarget: 'Maç başına ortalama isabetli şut. Toplam şuttan daha anlamlıdır çünkü kaleyi bulan şutları sayar. Sistem isabetli şutu yüksek olan tarafı destekler.',
  corners: 'Maç başına ortalama korner. Rakip yarı sahada kurulan baskının göstergesidir. Sistem daha çok korner kullanan tarafı hafifçe destekler.',
  fouls: 'Maç başına ortalama faul. Az faul genelde daha kontrollü/oturmuş oyun demektir. Sistem daha az faul yapan tarafı hafifçe destekler.',
  cards: 'Maç başına ortalama kart. Az kart daha disiplinli takımı gösterir; çok kart eksik oyuncu riskini artırır. Sistem daha az kart gören tarafı hafifçe destekler.',
  venuePerformance: 'Ev sahibinin İÇ SAHADA, deplasmanın DIŞ SAHADA galibiyet oranı — en adil saha kıyası. Ev sahibi evinde güçlü, deplasman dışarıda zayıfsa 1 ihtimali belirgin güçlenir.',
  venuePpg: 'Ev sahibinin iç sahada, deplasmanın dış sahada maç başı puanı. Saha faktörünü puana yansıtır. Kendi sahasında daha verimli olan tarafı destekler.',
  venueGoalsFor: 'Ev sahibinin iç sahada, deplasmanın dış sahada attığı ortalama gol. Saha bazında hücum gücünü kıyaslar. Yüksek olan tarafı destekler.',
  venueGoalsAgainst: 'Ev sahibinin iç sahada, deplasmanın dış sahada yediği ortalama gol. Saha bazında savunmayı kıyaslar. Daha az gol yiyen tarafı destekler.',
  xgForVenue: 'Ev sahibinin İÇ SAHADA, deplasmanın DIŞ SAHADA maç başına ürettiği beklenen gol (xG). Saha bazında hücum kalitesini kıyaslar — kendi sahasında daha çok/kaliteli pozisyon üreten tarafı destekler. Gol sayısından daha stabil bir güç göstergesidir.',
  xgAgainstVenue: 'Ev sahibinin iç sahada, deplasmanın dış sahada rakibe verdiği beklenen gol (xGA). Saha bazında savunma kalitesini kıyaslar — daha az xGA veren (rakibe pozisyon vermeyen) tarafı destekler.',
  homeAdvantage: 'Sahasında, kendi seyircisi önünde oynamanın getirdiği bilinen avantaj. Ev sahibi lehine sabit, hafif bir katkı ekler. Tek başına belirleyici değildir, diğer kriterlerle birleşir.',
  awayResilience: 'Deplasman takımının dış sahadaki direnci. Dışarıda çok kazanıyorsa 2 güçlenir; çok berabere kalıyorsa X riski doğar; zayıfsa 1 lehine döner. Deplasmanın karakterini okur.',
  commonOpponents: 'İki takımın son maçlarda ortak oynadığı rakiplere karşı aldığı sonuçların kıyası. "Aynı rakibe karşı kim ne yaptı" mantığı. Önce sonuç, eşitse averaj, sonra atılan gol bakılır; üstün olan taraf desteklenir.',
  missingPlayers: 'Kadro eksikleri güveni etkiler. ŞU AN kaynak sakatlık/ceza verisi vermediği için bu kriter "veri bulunamadı" olarak işaretlenir ve sonuca katılmaz — sistem asla uydurmaz. Veri gelirse otomatik devreye girer.',
  topScorerMissing: 'Takımın gol yükünü taşıyan yıldız oyuncusunun eksikliği. Böyle bir eksik güveni ciddi düşürür. ŞU AN oyuncu eksik verisi gelmediği için analiz dışı bırakılır (uydurulmaz).',
  assistMissing: 'Asist üreten kilit oyuncunun eksikliği hücum üretimini düşürür. ŞU AN oyuncu eksik verisi gelmediği için analiz dışı bırakılır (uydurulmaz).',
  coachChange: 'Teknik direktör değişimi takımın oyununu ve motivasyonunu değiştirebilir. ŞU AN kaynak bu bilgiyi vermediği için analiz dışı bırakılır (uydurulmaz).',
  newCoachEffect: 'Yeni hocayla gelen çıkış ya da düşüş etkisi. ŞU AN kaynak bu bilgiyi vermediği için analiz dışı bırakılır (uydurulmaz).',
  formDrop: 'Son maçlardaki mağlubiyet eğilimi. Yakın dönemde çok kaybeden takım daha riskli/düşüşte kabul edilir. Sistem son maçlarda daha az kaybeden tarafı destekler.',
};
