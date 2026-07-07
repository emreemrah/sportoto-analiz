// SPOR TOTO — KULLANICI SEÇİMLİ ANALİZ MOTORU (userSelectedAnalysisEngine)
// Sabit/hazır analiz YOK. Motor BOŞ başlar: aktif profildeki AÇIK kriterleri okur
// ve SADECE onları çalıştırır. Kapalı/seçilmemiş kriter sonuca, güvene, riske,
// yoruma HİÇ etki etmez. Veri yoksa uydurmaz; kriteri "analiz dışı" bırakır.
//
// Girdi:  m (maç + m.stats), profile (aktif analiz profili)
// Çıktı:  { ok, empty?, message?, matchInfo, usedCriteria[], results[],
//           verdict:{ main, alt, confidence, risk, reason, favor } }
import { CRITERIA_MAP, IMPACT } from './criteria';

const wOf = (impKey) => (IMPACT[impKey] || IMPACT.mid).w;

// side + strength → o kritere düşen yönlü katkı (0.5 taban + 0.5 güç).
const contrib = (weight, strength) => weight * (0.5 + 0.5 * (strength || 0));

export function userSelectedAnalysisEngine(m, profile) {
  const home = m?.stats?.home || null;
  const away = m?.stats?.away || null;
  const names = {
    home: m?.home?.mediumName || m?.home?.name || 'Ev sahibi',
    away: m?.away?.mediumName || m?.away?.name || 'Deplasman',
  };
  const matchInfo = { home: names.home, away: names.away, league: m?.league || null, date: m?.date || null };

  // Aktif profildeki AÇIK kriterler (sıralı, katalog sırasına göre değil profil sırasına göre değil — katalog sırası okunur)
  const selected = [];
  const cr = profile?.criteria || {};
  for (const key of Object.keys(cr)) {
    const conf = cr[key];
    if (conf && conf.on && CRITERIA_MAP[key]) selected.push({ key, impact: conf.impact || CRITERIA_MAP[key].defaultImpact });
  }

  // Hiç kriter seçilmemiş → analiz YAPILMAZ.
  if (!selected.length) {
    return { ok: false, empty: true, matchInfo, usedCriteria: [], results: [],
      message: 'Analiz yapılabilmesi için önce analiz kriterlerinizi seçmelisiniz.' };
  }

  // İstatistik verisi hiç yoksa dürüstçe belirt.
  if (!home && !away) {
    return { ok: false, empty: false, noStats: true, matchInfo, usedCriteria: selected.map((s) => CRITERIA_MAP[s.key].label), results: [],
      message: 'Bu maç için istatistik verisi bulunamadı. Seçili kriterler çalıştırılamadı.' };
  }

  // Seçili kriterleri çalıştır.
  const results = [];
  let homeScore = 0, awayScore = 0, drawScore = 0;
  let homeW = 0, awayW = 0, availDirW = 0; // yönlü (home/away) ağırlık toplamları
  for (const sel of selected) {
    const def = CRITERIA_MAP[sel.key];
    const weight = wOf(sel.impact);
    let r;
    try { r = def.evaluate(home, away, m, names); } catch { r = { available: false, note: `${def.label}: değerlendirilemedi — analiz dışı.` }; }
    const row = { key: sel.key, label: def.label, cat: def.cat, impact: sel.impact, impactLabel: (IMPACT[sel.impact] || IMPACT.mid).label, weight, points: 0, ...r };
    results.push(row);
    if (!r.available) { row.points = 0; continue; }
    const c = contrib(weight, r.strength);
    if (r.side === 'home') { row.points = c; homeScore += c; homeW += weight; availDirW += weight; }
    else if (r.side === 'away') { row.points = c; awayScore += c; awayW += weight; availDirW += weight; }
    else if (r.side === 'draw') { row.points = c; drawScore += c; }
    else { row.points = 0; } // side null (bilgi) → sonuca etki etmez
  }
  // Görünüm sıralaması: maça etkisi en yüksek olan en üstte.
  // Önce veri bulunanlar, sonra etki ağırlığı (Kritik→Düşük), eşitse kazanılan puan.
  // Not: puan toplamları yukarıda hesaplandı — bu sıralama sonucu DEĞİŞTİRMEZ, sadece görünümü düzenler.
  results.sort((a, b) => ((b.available ? 1 : 0) - (a.available ? 1 : 0)) || (b.weight - a.weight) || (b.points - a.points));

  const r1 = (x) => Math.round(x * 10) / 10;

  const net = homeScore - awayScore;            // + ev lehine
  const scores = { '1': homeScore, 'X': drawScore, '2': awayScore };
  const homeCount = results.filter((x) => x.available && x.side === 'home').length;
  const awayCount = results.filter((x) => x.available && x.side === 'away').length;
  const drawCount = results.filter((x) => x.available && x.side === 'draw').length;
  const counts = { '1': homeCount, 'X': drawCount, '2': awayCount };
  const decisiveCount = homeCount + awayCount + drawCount;

  // ——— KARAR: sonuçları PUANA göre sırala ———
  // Ana Seçim = en yüksek puanlı TEK sonuç. Alternatif = en yüksek İKİ sonucun
  // birleşimi (çift): 1+2 → "12", 1+X → "1X", X+2 → "X2".
  const prio = { '1': 0, 'X': 1, '2': 2 };
  const order = ['1', 'X', '2'].sort((a, b) => (scores[b] - scores[a]) || (counts[b] - counts[a]) || (prio[a] - prio[b]));
  const topOut = order[0];      // en yüksek puanlı sonuç
  const secondOut = order[1];   // ikinci sıradaki sonuç
  const totalScore = homeScore + drawScore + awayScore;
  const lead = totalScore > 0 ? (scores[topOut] - scores[secondOut]) / totalScore : 0;
  const ratio = (homeScore + awayScore) > 0 ? net / (homeScore + awayScore) : 0;

  // ——— KARAR: NET FAVORİ VAR MI? ———
  // Lider AÇIKSA (lead ≥ 0.35): Ana Seçim = TEK sonuç; Alternatif = tek + hedge çifti.
  //   Hedge normalde BERABERLİK (1X/X2); beraberlik zayıf & karşı taraf 2×X'ten
  //   güçlüyse iki-takım çifti (12). Ana seçim X ise X + daha güçlü takım.
  // Lider YOKSA (açık maç): Ana Seçim = en güçlü İKİ sonucun çifti; Alternatif = 1X2.
  const clear = decisiveCount > 0 && lead >= 0.35;
  let main, alt, favor;
  if (clear) {
    main = topOut;
    favor = topOut === '1' ? 'home' : topOut === '2' ? 'away' : 'draw';
    let hedge;
    if (main === 'X') hedge = homeScore >= awayScore ? '1' : '2';
    else { const opp = main === '1' ? '2' : '1'; hedge = (scores[opp] > drawScore * 2) ? opp : 'X'; }
    alt = ['1', 'X', '2'].filter((o) => o === main || o === hedge).join('');
  } else {
    main = ['1', 'X', '2'].filter((o) => o === topOut || o === secondOut).join(''); // en güçlü iki → çift
    alt = '1X2';
    favor = 'none';
  }

  // ——— GÜVEN ———
  let confidence;
  if (decisiveCount === 0) confidence = 'Düşük';
  else if (!clear) confidence = 'Düşük';                       // açık maç → net değil
  else if (lead >= 0.55 && decisiveCount >= 2) confidence = 'Yüksek';
  else confidence = 'Orta';

  // ——— RİSK + GEREKÇE (yalnız seçili kriterlerden) ———
  const sideOf = (o) => (o === '1' ? 'home' : o === '2' ? 'away' : 'draw');
  const outName = (o) => (o === '1' ? names.home : o === '2' ? names.away : 'Beraberlik');
  const rowsFor = (o) => results.filter((x) => x.available && x.side === sideOf(o)).map((x) => x.label);
  const topSup = rowsFor(topOut);
  const secondSup = rowsFor(secondOut);
  const naRows = results.filter((x) => !x.available).map((x) => x.label);

  let risk;
  if (decisiveCount === 0) {
    risk = 'Seçili kriterler net bir taraf göstermedi — veri yetersiz; çift/üçlü ihtimal daha güvenli.';
  } else if (!clear) {
    risk = `Bu maçta net favori yok — puanlar birbirine yakın (1: ${r1(homeScore)} · X: ${r1(drawScore)} · 2: ${r1(awayScore)}), maç her sonuca açık. Ana seçim geniş tutuldu (${main}), alternatif üç ihtimal (${alt}).`;
  } else if (lead >= 0.55) {
    risk = `${outName(topOut)} açık ara önde (${r1(scores[topOut])} — ${r1(scores[secondOut])}). Ana seçim ${main} göreceli güvenli; daha geniş oynamak istersen alternatif ${alt}.`;
  } else {
    risk = `${outName(topOut)} önde ama ${outName(secondOut)} tamamen silinmez (${r1(scores[topOut])} — ${r1(scores[secondOut])}). Güvenli oynamak için alternatif ${alt} tercih edilebilir.`;
  }

  const parts = [];
  if (topSup.length) parts.push(`En güçlü taraf ${topOut} (${outName(topOut)}): ${topSup.slice(0, 3).join(', ')}.`);
  if (secondSup.length) parts.push(`İkinci sırada ${secondOut} (${outName(secondOut)}): ${secondSup.slice(0, 2).join(', ')}.`);
  if (naRows.length) parts.push(`${naRows.slice(0, 3).join(', ')} için veri bulunamadığından bu kriterler sonuca katılmadı.`);
  parts.push(`Taraf puanları — 1: ${r1(homeScore)} · X: ${r1(drawScore)} · 2: ${r1(awayScore)}. Ana seçim ${main}, alternatif ${alt}.`);
  const reason = parts.join(' ');

  return {
    ok: true,
    matchInfo,
    profileName: profile?.name || 'Kullanıcı Seçimli Analiz',
    usedCriteria: results.map((r) => r.label),
    usedCount: results.length,
    results,
    tally: {
      home: r1(homeScore), away: r1(awayScore), draw: r1(drawScore),
      net: r1(net), diff: r1(Math.abs(net)),
      homeCount: results.filter((x) => x.available && x.side === 'home').length,
      awayCount: results.filter((x) => x.available && x.side === 'away').length,
      drawCount: results.filter((x) => x.available && x.side === 'draw').length,
      leader: net > 0.05 ? 'home' : net < -0.05 ? 'away' : 'draw',
    },
    verdict: { main, alt, confidence, risk, reason, favor, ratio: Math.round(ratio * 100) / 100 },
  };
}
