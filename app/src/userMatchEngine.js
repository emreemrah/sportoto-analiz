// SPOR TOTO KULLANICI ANALİZ MOTORU (v1) — userBasedMatchAnalysisEngine
// Kullanıcının kendi maç okuma mantığı. YALNIZ 6 kriter çalışır (başka yok):
//   1) Puan durumu  2) Ev formu  3) Deplasman formu  4) Eksik oyuncu
//   5) Teknik direktör değişimi  6) Ortak rakip kıyası
// Veri yoksa UYDURMAZ → "Bu veri bulunamadı" + güven düşer. xG/oran/AI/hakem/
// hava YOK. Çıktı: 1 / X / 2 / 1X / X2 / 12 + risk + sade gerekçe.
// Modüler: her kriter ayrı fonksiyon; sonradan yeni madde eklenebilir.

const NA = 'Bu veri bulunamadı';

function formQuality(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr.reduce((s, r) => s + (r === 'G' ? 1 : r === 'B' ? 0.5 : 0), 0) / arr.length;
}
const recWinRate = (rec) => {
  if (!rec) return null;
  const p = (rec.wins || 0) + (rec.draws || 0) + (rec.losses || 0);
  return p ? (rec.wins || 0) / p : null;
};

// 1) PUAN DURUMU — ciddi fark (~5+ puan) varsa önde olan "1-0 önde başlar".
function checkPoints(hs, as, homeName, awayName) {
  if (!hs || !as || hs.points == null || as.points == null) return { available: false, note: NA, signal: 0 };
  const gap = hs.points - as.points;
  const abs = Math.abs(gap);
  const advSide = gap > 0 ? 'home' : gap < 0 ? 'away' : null;
  const advTeam = advSide === 'home' ? homeName : advSide === 'away' ? awayName : null;
  // Güç/güven veren avantaj ≈ 5 maçlık fark = 5 × 3 = 15 puan. Altı zayıf/yok.
  let signal = 0; // + home lehine
  if (abs >= 15) signal = gap > 0 ? 2 : -2;
  else if (abs >= 9) signal = gap > 0 ? 1 : -1;
  const strong = abs >= 15;               // gerçek güç avantajı
  const mild = abs >= 9 && abs < 15;       // hafif üstünlük
  const note = advTeam
    ? (strong
        ? `${advTeam} ${abs} puan önde (≈5 maçlık fark) — güç ve güven veren avantaj, analize 1-0 önde başlıyor.`
        : mild
          ? `${advTeam} ${abs} puan önde — hafif üstünlük, ama güçlü avantaj (~15 puan) seviyesinde değil.`
          : `Puanlar yakın (${abs} fark) — güven verecek puan avantajı yok (güç için ~15 puan gerekir).`)
    : 'Puanlar eşit — avantaj yok.';
  return { available: true, homePts: hs.points, awayPts: as.points, homePos: hs.position, awayPos: as.position, gap, abs, advSide, advTeam, strong, mild, note, signal };
}

// 2) EV SAHİBİ FORM — son form + iç saha güveni.
function checkHomeForm(h, homeName) {
  const form5 = h?.last5venue || h?.last5 || null;
  const fq = formQuality(form5);
  const hr = recWinRate(h?.standing?.home);
  if (fq == null && hr == null) return { available: false, note: NA, signal: 0 };
  const homeSplit = h?.standing?.home;
  const good = (fq != null && fq >= 0.6) || (hr != null && hr >= 0.5);
  const strong = (fq != null && fq >= 0.75) && (hr == null || hr >= 0.5);
  const weak = (fq != null && fq < 0.35) || (hr != null && hr < 0.3);
  let signal = strong ? 2 : good ? 1 : weak ? -1 : 0;
  const rec = homeSplit ? `${homeSplit.wins}G-${homeSplit.draws}B-${homeSplit.losses}M (iç saha)` : NA;
  const note = weak
    ? `${homeName} iç sahada güven vermiyor (${rec}) — puan avantajı olsa bile tek 1 riskli.`
    : strong ? `${homeName} formda ve iç sahada güçlü (${rec}) — 1 ihtimali güçleniyor.`
    : good ? `${homeName} iç sahada fena değil (${rec}) — 1 ihtimali destekleniyor.`
    : `${homeName} iç sahada ortalama (${rec}).`;
  return { available: true, form5: Array.isArray(form5) ? form5.join('') : NA, venueRecord: rec, record: homeSplit ? { w: homeSplit.wins || 0, d: homeSplit.draws || 0, l: homeSplit.losses || 0 } : null, good, strong, weak, note, signal };
}

// 3) DEPLASMAN FORM — dış sahada güç + beraberlik/2 doğuşu.
function checkAwayForm(a, awayName) {
  const form5 = a?.last5venue || a?.last5 || null;
  const fq = formQuality(form5);
  const ar = recWinRate(a?.standing?.away);
  if (fq == null && ar == null) return { available: false, note: NA, signal: 0, level: NA, drawRisk: false };
  const awaySplit = a?.standing?.away;
  const strong = (fq != null && fq >= 0.6) || (ar != null && ar >= 0.45);
  const mid = !strong && ((fq != null && fq >= 0.4) || (awaySplit && awaySplit.draws >= 2));
  // Deplasmanda ÇOK zayıf: 4+ mağlubiyet ve en fazla 1 galibiyet → ev ciddi lehine.
  const veryWeak = !strong && !mid && awaySplit && (awaySplit.losses || 0) >= 4 && (awaySplit.wins || 0) <= 1;
  const level = strong ? 'güçlü' : mid ? 'orta' : veryWeak ? 'çok zayıf' : 'zayıf';
  const rec = awaySplit ? `${awaySplit.wins}G-${awaySplit.draws}B-${awaySplit.losses}M (deplasman)` : NA;
  // deplasman güçlü → home sinyali düşer, X doğar; çok zayıf → ev ciddi artar
  let signal = strong ? -2 : mid ? -1 : veryWeak ? 2 : 1;
  const drawRisk = strong || mid; // dirençli deplasman → X canlı
  const note = strong
    ? `${awayName} deplasmanda güçlü (${rec}) — 2 tamamen silinmez, X doğuyor.`
    : mid ? `${awayName} deplasmanda orta seviye (${rec}) — 2 kolay verilmez, en fazla X değerlendirilir.`
    : veryWeak ? `${awayName} deplasmanda çok zayıf (${rec}) — 2 ciddi zayıf, 1 belirgin güçleniyor.`
    : `${awayName} deplasmanda zayıf (${rec}) — 2 ihtimali zayıf.`;
  return { available: true, form5: Array.isArray(form5) ? form5.join('') : NA, awayRecord: rec, record: awaySplit ? { w: awaySplit.wins || 0, d: awaySplit.draws || 0, l: awaySplit.losses || 0 } : null, level, strong, mid, veryWeak, drawRisk, note, signal };
}

// 4) EKSİK OYUNCU — VERİ YOK (golcü/asistçi sakatlık bilgisi gelmiyor).
function checkMissing() {
  return { available: false, note: `${NA} (golcü/asistçi eksik bilgisi). Eksik veri nedeniyle güven düşürüldü.`, signal: 0, confidencePenalty: 1 };
}

// 5) TEKNİK DİREKTÖR DEĞİŞİMİ — VERİ YOK.
function checkCoach() {
  return { available: false, note: `${NA} (teknik direktör değişimi). Bu kriter analiz dışı bırakıldı.`, signal: 0, confidencePenalty: 1 };
}

// 6) ORTAK RAKİP KIYASI — son maçlardan (last5detail) ortak rakiplere karşı
// sonuçların kıyası. G=3 B=1 M=0 puan; üstün olan taraf "1-0 önde başlar".
function checkCommon(h, a, homeName, awayName) {
  const hd = h?.last5detail || [], ad = a?.last5detail || [];
  if (!hd.length || !ad.length) return { available: false, note: NA, signal: 0, opponents: [] };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hMap = new Map(hd.map((x) => [norm(x.oppName), x]));
  const aMap = new Map(ad.map((x) => [norm(x.oppName), x]));
  const pts = (r) => (r === 'G' ? 3 : r === 'B' ? 1 : 0);
  // Skoru sonuca göre çöz (ev/dep yönünden bağımsız): G→çok atan, M→az atan, B→eşit.
  const goalsOf = (x) => {
    const mm = String(x.score || '').match(/(\d+)\D+(\d+)/);
    if (!mm) return null;
    const p = Number(mm[1]), q = Number(mm[2]);
    if (x.result === 'G') return { gf: Math.max(p, q), ga: Math.min(p, q) };
    if (x.result === 'M') return { gf: Math.min(p, q), ga: Math.max(p, q) };
    return { gf: p, ga: q };
  };
  const opponents = [];
  let hPts = 0, aPts = 0, hGD = 0, aGD = 0, hGF = 0, aGF = 0;
  for (const [k, hx] of hMap) {
    const ax = aMap.get(k);
    if (!ax) continue;
    hPts += pts(hx.result); aPts += pts(ax.result);
    const hg = goalsOf(hx), ag = goalsOf(ax);
    if (hg) { hGD += hg.gf - hg.ga; hGF += hg.gf; }
    if (ag) { aGD += ag.gf - ag.ga; aGF += ag.gf; }
    opponents.push({ name: hx.oppName, homeRes: hx.result, homeScore: hx.score, awayRes: ax.result, awayScore: ax.score });
  }
  if (!opponents.length) return { available: false, note: 'Ortak rakip bulunamadı (son maçlarda).', signal: 0, opponents: [] };
  // Üstünlük: önce SONUÇ, eşitse AVERAJ (az yiyen iyi), eşitse ATILAN GOL.
  let diff = 0, basis = '';
  if (hPts !== aPts) { diff = hPts - aPts; basis = 'sonuç'; }
  else if (hGD !== aGD) { diff = hGD - aGD; basis = 'averaj'; }
  else if (hGF !== aGF) { diff = hGF - aGF; basis = 'attığı gol'; }
  const advSide = diff > 0 ? 'home' : diff < 0 ? 'away' : null;
  const advTeam = advSide === 'home' ? homeName : advSide === 'away' ? awayName : null;
  const mag = Math.abs(diff);
  let signal = 0;
  if (basis === 'sonuç') {
    // Net sonuç farkı belirleyici
    signal = mag >= 2 ? (diff > 0 ? 2 : -2) : (diff > 0 ? 1 : -1);
  } else if (basis) {
    // Averaj/gol farkı yalnız TIE-BREAK — zayıf sinyal. Tek ortak rakip ise
    // (özellikle ikisi de yenilmişse) belirleyici SAYILMAZ.
    signal = opponents.length >= 2 ? (diff > 0 ? 1 : -1) : 0;
  }
  const decisive = signal !== 0;
  const why = basis === 'averaj' ? 'aynı sonuç ama daha az gol yemiş' : basis === 'attığı gol' ? 'aynı sonuç ama daha çok gol atmış' : 'daha iyi sonuç almış';
  const note = !advTeam
    ? `Ortak rakiplere karşı iki takım tam eşit (${opponents.length} rakip) — avantaj yok.`
    : decisive
      ? `Ortak rakip kıyasına göre ${advTeam} ${why} (${opponents.length} ortak rakip) — bu takım analize önde başlıyor.`
      : `Ortak rakipte ${advTeam} biraz daha iyi (${why}) ama tek örnek olduğu için belirleyici değil.`;
  return { available: true, opponents, hPts, aPts, hGD, aGD, hGF, aGF, basis, decisive, advSide, advTeam, note, signal };
}

// EK: LİDER (GÜÇLÜ) TAKIMLARA KARŞI SONUÇLAR — takımın son maçlarından, ligin
// ilk N'sindeki takımlara karşı aldığı sonuçlar (güçlülere karşı ne yapmış).
function checkVsTop(teamStats, leagueTable, topN = 5) {
  const detail = teamStats?.last5detail || [];
  const table = leagueTable?.overall || [];
  if (!detail.length || !table.length) return { available: false, note: NA, matches: [] };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const top = table.filter((r) => r.position && r.position <= topN).map((r) => ({ n: norm(r.name), pos: r.position }));
  const matches = [];
  let w = 0, dr = 0, l = 0;
  for (const d of detail) {
    const on = norm(d.oppName);
    if (!on || on.length < 3) continue;
    const hit = top.find((t) => t.n && t.n.length >= 3 && (on.includes(t.n) || t.n.includes(on)));
    if (hit) {
      matches.push({ opp: d.oppName, pos: hit.pos, result: d.result, score: d.score });
      if (d.result === 'G') w++; else if (d.result === 'B') dr++; else l++;
    }
  }
  const note = matches.length
    ? `Son maçlarda ligin ilk ${topN}'ine karşı ${matches.length} maç oynamış: ${w}G-${dr}B-${l}M.`
    : `Son 5 maçta ligin ilk ${topN}'indeki takımlara karşı maç bulunamadı.`;
  return { available: matches.length > 0, count: matches.length, matches, record: { w, d: dr, l }, note };
}

// EK: KARŞILIKLI MAÇLAR (H2H) — iki takımın birbirleriyle geçmişi. Elimizde
// ÖZET var (oynanan/ev galibiyeti/beraberlik/dep galibiyeti); tek tek skor yok.
function checkH2H(m, homeName, awayName) {
  const h = m?.stats?.h2h;
  if (!h || !h.played) return { available: false, note: NA };
  const homeWins = h.homeWins || 0, awayWins = h.awayWins || 0, draws = h.draws || 0, played = h.played;
  const advSide = homeWins > awayWins + 1 ? 'home' : awayWins > homeWins + 1 ? 'away' : null;
  const advTeam = advSide === 'home' ? homeName : advSide === 'away' ? awayName : null;
  const note = advTeam
    ? `Son ${played} karşılaşmada ${advTeam} üstün: ${homeName} ${homeWins} galibiyet · ${draws} beraberlik · ${awayName} ${awayWins} galibiyet.`
    : `Son ${played} karşılaşma dengeli: ${homeName} ${homeWins} · ${draws} beraberlik · ${awayName} ${awayWins}.`;
  return { available: true, played, homeWins, awayWins, draws, advSide, advTeam, note };
}

// ——— NİHAİ KARAR ———
function decide({ points, homeForm, awayForm, missing, coach, common, homeName, awayName }) {
  // net > 0 → ev lehine
  let net = 0;
  if (points.available) net += points.signal;
  if (homeForm.available) net += homeForm.signal;
  if (awayForm.available) net += awayForm.signal;    // deplasman güçlüyse negatif
  if (common.available) net += common.signal;

  const drawRisk = (awayForm.available && awayForm.drawRisk) || Math.abs(net) <= 1;
  // Güven: kaç kriter verili? (6'dan). Eksik/hoca hep yok → v1'de max 4/6.
  const availCount = [points, homeForm, awayForm, common].filter((c) => c.available).length;
  const confidencePenalty = (missing.confidencePenalty || 0) + (coach.confidencePenalty || 0);
  const dataConfidence = availCount >= 4 ? 'Orta' : availCount >= 2 ? 'Düşük' : 'Çok Düşük';

  // Banko şartları (v1 çok temkinli): eksik veri doğrulanamadığı için TEK "banko"
  // dili KULLANILMAZ — güçlü tarafta bile alternatif çifte verilir.
  let main, alt;
  if (net >= 3) { main = '1'; alt = '1X'; }          // ev belirgin → tek 1
  else if (net >= 1) { main = '1X'; alt = '1'; }      // ev hafif → çifte 1X
  else if (net <= -3) { main = '2'; alt = 'X2'; }     // deplasman belirgin → tek 2
  else if (net <= -1) { main = 'X2'; alt = '2'; }     // deplasman hafif → çifte X2
  else { // net 0 — güçler denk
    if (drawRisk) { main = '1X2'; alt = 'X'; }         // belirsiz → 3 ihtimalli (kapalı)
    else { main = '12'; alt = '1X2'; }
  }
  // RİSK = önerilen ana seçimin GENİŞLİĞİ: tek seçim → Düşük, çifte → Orta,
  // üçlü (1X2 = kapalı) → Yüksek. (Kullanıcı mantığı: risk yüksekse 3 ihtimalli.)
  const breadth = main.replace(/[^12X]/g, '').length;
  const risk = breadth >= 3 ? 'Yüksek' : breadth === 2 ? 'Orta' : 'Düşük';

  // Gerekçe (önce ev, sonra deplasman/X, sonra eksik/güven)
  const parts = [];
  if (points.available && (points.strong || points.mild)) parts.push(points.note);
  if (homeForm.available) parts.push(homeForm.note);
  if (awayForm.available && (awayForm.strong || awayForm.mid)) parts.push(awayForm.note);
  if (common.available && common.advTeam) parts.push(common.note);
  parts.push('Eksik oyuncu ve teknik direktör verisi bulunamadığı için güven seviyesi düşürüldü ve tek banko yerine daha güvenli seçim tercih edildi.');
  const reason = parts.join(' ');

  return { main, alt, risk, net, dataConfidence, reason };
}

export function analyzeUserMatch(m) {
  const h = m?.stats?.home || {}, a = m?.stats?.away || {};
  const hs = h.standing, as = a.standing;
  const homeName = m?.home?.mediumName || m?.home?.name || 'Ev sahibi';
  const awayName = m?.away?.mediumName || m?.away?.name || 'Deplasman';

  const points = checkPoints(hs, as, homeName, awayName);
  const homeForm = checkHomeForm(h, homeName);
  const awayForm = checkAwayForm(a, awayName);
  const missing = checkMissing();
  const coach = checkCoach();
  const common = checkCommon(h, a, homeName, awayName);
  const h2h = checkH2H(m, homeName, awayName);
  const lt = m?.stats?.leagueTable;
  const vsTop = { home: checkVsTop(h, lt, 5), away: checkVsTop(a, lt, 5) };

  // Hiç temel veri yoksa dürüst boş sonuç
  if (!points.available && !homeForm.available && !awayForm.available && !common.available) {
    return {
      ok: false,
      matchInfo: { home: homeName, away: awayName, league: m?.league || NA, date: m?.date || null },
      points, homeForm, awayForm, missing, coach, common, h2h, vsTop,
      verdict: { main: '1X2', alt: 'X', risk: 'Yüksek', dataConfidence: 'Çok Düşük', reason: 'Bu maç için puan/form/ortak rakip verisi bulunamadı. Kör karar verilmez; 3 ihtimalli (kapalı) değerlendirilmeli.' },
    };
  }

  const verdict = decide({ points, homeForm, awayForm, missing, coach, common, homeName, awayName });
  return {
    ok: true,
    matchInfo: { home: homeName, away: awayName, league: m?.league || NA, date: m?.date || null },
    points, homeForm, awayForm, missing, coach, common, h2h, vsTop, verdict,
  };
}
