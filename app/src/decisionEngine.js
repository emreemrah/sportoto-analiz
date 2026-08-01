// KARAR MOTORU (B + C + D hibrit)
// B: gelişmiş istatistik · C: taktik eşleşme · D: profesyonel kupon kararı.
// TAHMİN DEĞİL, KUPON KARAR DESTEĞİ üretir. Kesin/garanti dil ASLA kullanmaz.
// Veri yoksa uydurmaz → "Bilinmiyor" der ve riski artırır. Yalnız client'ta
// zaten gelen m.analysis / m.stats / m.prediction verisinden türetir.

import { X_KEEP_PCT, AWAY_KEEP_PCT, CLOSE_GAP_PCT, FAVORITE_MIN_PCT, TAG_BASE, TAG_BASE_STRONG, AWAY_TAG_PIVOT } from './analysis/thresholds';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const numOr = (v, d = null) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);

// Son 5 form → 0-1 kalite (G=1, B=0.5, M=0)
function formQuality(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const pts = arr.reduce((s, r) => s + (r === 'G' ? 1 : r === 'B' ? 0.5 : 0), 0);
  return pts / arr.length;
}

// ——— ANA FONKSİYON ———
export function buildDecision(m) {
  const a = m?.analysis || {};
  const st = m?.stats || {};
  const prob = a.probabilities || null;
  const p1 = numOr(prob?.['1'], null);
  const pX = numOr(prob?.['X'], null);
  const p2 = numOr(prob?.['2'], null);
  const hasProb = p1 != null && pX != null && p2 != null;
  const surprise = numOr(a.surpriseScore, null);
  const hasOdds = !!a.hasOdds;
  const covered = m?.coverage ? m.coverage.ok !== false : hasProb;

  // Analiz verisi yoksa → tümü Bilinmiyor, yüksek risk, güçlü aday yok.
  if (!hasProb || !covered) {
    return emptyDecision(m);
  }

  const favSym = p1 >= p2 ? '1' : '2';           // favori ev/deplasman (X favori sayılmaz)
  const favPct = Math.max(p1, p2);
  const undSym = favSym === '1' ? '2' : '1';
  const undPct = Math.min(p1, p2);
  const gap12 = Math.abs(p1 - p2);
  const mainTrend = [['1', p1], ['X', pX], ['2', p2]].sort((x, y) => y[1] - x[1])[0][0];

  // H2H yönü
  const h2h = st.h2h || null;
  const h2hPlayed = numOr(h2h?.played, 0);
  const h2hHome = numOr(h2h?.homeWins, 0);
  const h2hAway = numOr(h2h?.awayWins, 0);
  const h2hDraw = numOr(h2h?.draws, 0);
  const h2hAwayFav = h2hPlayed >= 4 && h2hAway > h2hHome + 1;
  const h2hHomeFav = h2hPlayed >= 4 && h2hHome > h2hAway + 1;
  const h2hDrawish = h2hPlayed >= 5 && h2hDraw / h2hPlayed >= 0.3;

  // Form (venue) kalitesi
  const homeForm = formQuality(st.home?.last5venue || st.home?.last5);
  const awayForm = formQuality(st.away?.last5venue || st.away?.last5);

  // Taktik terslik yaklaşık: deplasman hücumu (xGFor) ev savunmasından (xGAgainst) net üstünse
  const hS = st.home?.season || {};
  const aS = st.away?.season || {};
  const awayAttack = numOr(aS.xgFor, null);
  const homeDefense = numOr(hS.xgAgainst, null);
  const tacticalMismatch = awayAttack != null && homeDefense != null && awayAttack >= homeDefense + 0.25 && p2 >= 28;

  // ——— VERİ GÜVENLİĞİ ———
  // Eksik/cezalı, rotasyon, hava HER ZAMAN bilinmiyor → asla "Yüksek" olamaz.
  let dataScore = 0;
  if (hasOdds) dataScore += 2;            // gerçek oran güçlü sinyal
  if (h2hPlayed >= 4) dataScore += 1;
  if (hS.xgFor != null && aS.xgFor != null) dataScore += 1;
  if (homeForm != null && awayForm != null) dataScore += 1;
  const dataConfidence = dataScore >= 3 ? 'Orta' : 'Düşük'; // "Yüksek" verilmez (kritik veri bilinmiyor)

  // ——— ETİKETLER ———
  const tags = [];
  const addTag = (name, weight, reason, couponEffect) => { if (weight >= 40) tags.push({ name, weight: clamp(Math.round(weight), 0, 100), reason, couponEffect }); };

  if (favSym === '1' && (h2hAwayFav || p2 >= AWAY_KEEP_PCT || (awayForm != null && homeForm != null && awayForm > homeForm + 0.2))) {
    let w = 45 + (p2 - 25) + (h2hAwayFav ? 15 : 0) + (awayForm > (homeForm ?? 0) ? 10 : 0);
    addTag('Favori Tuzağı', w, `Ev sahibi favori görünse de ${h2hAwayFav ? 'geçmiş eşleşme deplasman lehine' : 'deplasmanın son form ve gücü'} bu maçı bozabilir.`, 'Tek 1 önerilmez; dar kupon 1-2, geniş kupon 1-X-2.');
  }
  if (pX >= X_KEEP_PCT) addTag('Beraberlik Riski', TAG_BASE + (pX - X_KEEP_PCT) * 2.2, `X ihtimali %${pX} — güç dengesi ve tempo beraberliği canlı tutuyor.`, 'X geniş kupondan silinmemeli.');
  if (p2 >= AWAY_KEEP_PCT || (favSym === '1' && h2hAwayFav)) addTag('Deplasman Sürprizi', TAG_BASE + (p2 - AWAY_TAG_PIVOT) + (h2hAwayFav ? 12 : 0), `Deplasman %${p2}${h2hAwayFav ? ' + geçmiş eşleşme üstünlüğü' : ''} — gerçek risk.`, 'Favori tuzağı varsa 2 dikkate alınmalı.');
  if (tacticalMismatch) addTag('Taktik Terslik', 55 + (awayAttack - homeDefense) * 20, 'Deplasmanın gol beklentisi (xG) ev savunmasına ters geliyor.', 'Deplasman sonucu silinmemeli.');
  if (gap12 < CLOSE_GAP_PCT) addTag('Tek Oynanmaz', TAG_BASE_STRONG + (CLOSE_GAP_PCT - gap12) * 2, `1 ve 2 farkı sadece %${gap12} — güçler yakın.`, 'Tek yerine dar (1-2) veya kapalı oyna.');
  if (Math.max(p1, pX, p2) - Math.min(p1, pX, p2) <= 14) addTag('Kapama Adayı', 60, 'Üç ihtimal de birbirine çok yakın.', '15 hedefinde 1-X-2 kapalı düşünülmeli.');
  if (surprise != null && surprise >= 50) addTag('Sürpriz Değeri', 45 + (surprise - 50), `Sürpriz puanı ${surprise}/100.`, 'Güçlü aday önerilmez; kolon yakma riski var.');
  if (favPct < FAVORITE_MIN_PCT) addTag('Güçlü Aday Freni', 60 + (FAVORITE_MIN_PCT - favPct), `Favori oranı %${favPct} — %50 altında.`, 'Bu maç güçlü aday sayılmaz.');
  if (pX >= X_KEEP_PCT) addTag('X Silinmez', TAG_BASE + (pX - X_KEEP_PCT) * 2, `X %${pX} — tamamen silinemez.`, 'Geniş kuponda X kalmalı.');
  if (p2 >= AWAY_KEEP_PCT || h2hAwayFav) addTag('2 Silinmez', TAG_BASE + (p2 - AWAY_TAG_PIVOT), 'Deplasman ciddi sürpriz adayı.', 'Geniş kuponda 2 kalmalı.');
  tags.sort((x, y) => y.weight - x.weight);

  const tagWeight = tags.reduce((s, t) => s + t.weight, 0);

  // ——— RİSK SEVİYESİ ———
  let riskScore = 0;
  if (surprise != null) riskScore += surprise * 0.35;
  if (favPct < FAVORITE_MIN_PCT) riskScore += (FAVORITE_MIN_PCT - favPct) * 1.4;
  if (pX >= X_KEEP_PCT) riskScore += (pX - 18) * 1.2;
  if (p2 >= AWAY_KEEP_PCT) riskScore += (p2 - AWAY_TAG_PIVOT) * 0.9;
  if (gap12 < CLOSE_GAP_PCT) riskScore += (CLOSE_GAP_PCT - gap12) * 1.6;
  if (favPct < FAVORITE_MIN_PCT && gap12 < CLOSE_GAP_PCT) riskScore += 12;          // favori yok + güçler yakın = bileşik risk
  if (dataConfidence === 'Düşük') riskScore += 16; else riskScore += 6; // kritik veri hep eksik
  if (tacticalMismatch) riskScore += 10;
  riskScore = clamp(Math.round(riskScore), 0, 100);
  const riskLevel = riskScore >= 78 ? 'Çok Yüksek' : riskScore >= 56 ? 'Yüksek' : riskScore >= 32 ? 'Orta' : 'Düşük';

  // ——— GÜÇLÜ ADAY FRENİ ———
  // Kural: favori<50 → Hayır · sürpriz>50 → Hayır · |1-2|<15 → Hayır ·
  // veri düşük → Hayır · X>=20 veya H2H aleyhte → en fazla Şartlı ·
  // eksik/cezalı HER ZAMAN bilinmiyor → asla "Evet" değil, en fazla "Şartlı".
  const bankoReasons = [];
  let bankoStatus = 'Şartlı';
  if (favPct < FAVORITE_MIN_PCT) { bankoStatus = 'Hayır'; bankoReasons.push(`Favori oranı %${favPct} (%${FAVORITE_MIN_PCT} altında).`); }
  if (surprise != null && surprise > 50) { bankoStatus = 'Hayır'; bankoReasons.push(`Sürpriz puanı ${surprise} (>50).`); }
  if (gap12 < CLOSE_GAP_PCT) { bankoStatus = 'Hayır'; bankoReasons.push(`1 ve 2 farkı %${gap12} (çok yakın).`); }
  if (dataConfidence === 'Düşük') { bankoStatus = 'Hayır'; bankoReasons.push('Veri güvenliği düşük.'); }
  if (bankoStatus !== 'Hayır') {
    if (pX >= X_KEEP_PCT) bankoReasons.push(`Beraberlik ihtimali %${pX} — tamamen silinemez.`);
    if (h2hAwayFav && favSym === '1') bankoReasons.push('Geçmiş eşleşme deplasman lehine.');
    bankoReasons.push('Eksik/cezalı bilgisi bilinmiyor → en fazla "Şartlı".');
    bankoStatus = 'Şartlı';
  }

  // ——— SONUÇ SİLME ———
  const outs = [{ s: '1', p: p1 }, { s: 'X', p: pX }, { s: '2', p: p2 }];
  const alive = outs.filter((o) => o.p >= 8).map((o) => o.s);
  const safeCoupon = alive.length ? ['1', 'X', '2'].filter((s) => alive.includes(s)) : ['1', 'X', '2'];
  // Geniş kuponda kalması gerekenler (silinmez): ana eğilim + canlı X + sürpriz 2.
  const mustKeep = new Set([mainTrend]);
  if (pX >= X_KEEP_PCT) mustKeep.add('X');
  if (p2 >= AWAY_KEEP_PCT || h2hAwayFav) mustKeep.add('2');
  if (favPct >= FAVORITE_MIN_PCT) mustKeep.add(favSym);
  // DAR (bütçe) kupon: en düşük ihtimalliyi düşürür — ama canlı X / sürpriz 2 ise
  // riskini AÇIKÇA "Yüksek" işaretler (geniş kupondan silinmez, sadece bütçede).
  const lowest = [...outs].sort((x, y) => x.p - y.p)[0];
  let firstRemovable = null;
  let removalRisk = 'Yüksek';
  let narrowCoupon = [...safeCoupon];
  if (safeCoupon.length >= 3) {
    firstRemovable = lowest.s;
    narrowCoupon = safeCoupon.filter((s) => s !== firstRemovable);
    if ((firstRemovable === 'X' && pX >= X_KEEP_PCT) || (firstRemovable === '2' && (p2 >= AWAY_KEEP_PCT || h2hAwayFav))) removalRisk = 'Yüksek';
    else if (lowest.p >= 22) removalRisk = 'Orta';
    else removalRisk = 'Düşük';
  }

  // ——— HEDEF STRATEJİSİ ———
  const keepXsafe = pX >= X_KEEP_PCT || (surprise != null && surprise >= 50);
  const targetStrategy = {
    target12: narrowCoupon,                                        // minimum koruma
    target13_14: keepXsafe ? safeCoupon : narrowCoupon,            // X canlıysa koru
    target15: safeCoupon,                                          // kapama
  };

  // ——— 1-X-2 SONUÇ YORUMU ———
  const resultAnalysis = {
    home: {
      label: '1', percent: p1,
      whyCanHappen: `Ev sahibi iç saha avantajı${homeForm != null && homeForm >= 0.6 ? ' ve iyi formu' : ''} ile öne çıkabilir (iç saha ${st.home?.standing?.home ? `${st.home.standing.home.wins}G-${st.home.standing.home.draws}B-${st.home.standing.home.losses}M` : 'kaydı'}).`,
      whyMayFail: favSym === '1' && favPct < FAVORITE_MIN_PCT ? `Favori oranı %${p1} — güçlü aday sayılmaz.` : (h2hAwayFav ? 'Geçmiş eşleşme deplasman lehine.' : `Güç farkı net değil (${p1}% ).`),
      couponEffect: mainTrend === '1' ? 'Ana eğilim — silinmemeli.' : (mustKeep.has('1') ? 'Silinmemeli.' : 'Budgede silinebilir.'),
    },
    draw: {
      label: 'X', percent: pX,
      whyCanHappen: `Güçler yakınsa (${gap12}% fark), tempo düşükse veya iki takım kontrollü oynuyorsa beraberlik canlı${h2hDrawish ? '; geçmiş eşleşmeler beraberlik eğilimli' : ''}.`,
      whyMayFail: pX < 20 ? `X ihtimali %${pX} — düşük.` : 'İki takım da kazanmak için oynarsa X zayıflar.',
      couponEffect: pX >= X_KEEP_PCT ? 'X % üzerinde — geniş kupondan silinmemeli.' : 'Dar bütçede ilk silinebilir aday olabilir.',
    },
    away: {
      label: '2', percent: p2,
      whyCanHappen: `Deplasmanın${aS.xgFor != null ? ` gol beklentisi (xG ${aS.xgFor})` : ' geçiş oyunu'}${h2hAwayFav ? ', geçmiş eşleşme üstünlüğü' : ''}${tacticalMismatch ? ', rakibe ters gelen yapısı' : ''} 2 ihtimalini gerçek risk yapıyor.`,
      whyMayFail: p2 < 25 ? `Deplasman oranı %${p2} — görece düşük.` : 'Ev sahibi iç sahada baskı kurarsa 2 zorlaşır.',
      couponEffect: mustKeep.has('2') ? 'Favori tuzağı olabilir — silinmemeli.' : 'Budgede değerlendirilebilir.',
    },
  };

  // ——— GÜÇLÜ ADAY KONTROL LİSTESİ ———
  const chk = (label, ok, note) => ({ label, ok, note }); // ok: true/false/null(bilinmiyor)
  const bankoChecklist = [
    chk('Favori oranı güçlü mü?', favPct >= 55, `%${favPct}`),
    chk('İkinci ihtimal yeterince uzak mı?', gap12 >= 15, `Fark %${gap12}`),
    chk('Form üstünlüğü net mi?', homeForm != null && awayForm != null ? Math.abs(homeForm - awayForm) >= 0.25 : null, homeForm != null && awayForm != null ? '' : 'Form verisi kısıtlı'),
    chk('İç saha / deplasman avantajı net mi?', favPct >= 55 && gap12 >= 15, ''),
    chk('Kadro kalitesi favori lehine mi?', st.home?.standing && st.away?.standing ? (favSym === '1' ? st.home.standing.position < st.away.standing.position : st.away.standing.position < st.home.standing.position) : null, 'Sıralamaya göre yaklaşık'),
    chk('Eksik/cezalı riski düşük mü?', null, 'Bilinmiyor'),
    chk('Rakip ters oyun riski var mı? (yoksa ✓)', !tacticalMismatch, tacticalMismatch ? 'Taktik terslik var' : ''),
    chk('Beraberlik riski düşük mü?', pX < 20, `X %${pX}`),
    chk('Deplasman sürprizi düşük mü?', p2 < 30 && !h2hAwayFav, `2 %${p2}`),
    chk('Motivasyon favori lehine mi?', null, 'Bilinmiyor'),
    chk('Veri güvenliği yeterli mi?', dataConfidence !== 'Düşük', dataConfidence),
  ];

  // ——— TAKTİK EŞLEŞME ———
  const na = 'Bilinmiyor';
  const tactical = {
    homeProfile: hS.avg?.possession != null ? `Topla oynama ~%${Math.round(hS.avg.possession)}, maç başı ${hS.avg.shots ?? na} şut` : na,
    awayProfile: aS.avg?.possession != null ? `Topla oynama ~%${Math.round(aS.avg.possession)}, maç başı ${aS.avg.shots ?? na} şut` : na,
    homeStrength: hS.goalsPerGame != null ? `Hücum: maç başı ${hS.goalsPerGame} gol (xG ${hS.xgFor ?? na})` : na,
    homeWeak: hS.concededPerGame != null ? `Savunma: maç başı ${hS.concededPerGame} gol yiyor (xGA ${hS.xgAgainst ?? na})` : na,
    awayStrength: aS.goalsPerGame != null ? `Hücum: maç başı ${aS.goalsPerGame} gol (xG ${aS.xgFor ?? na})` : na,
    awayWeak: aS.concededPerGame != null ? `Savunma: maç başı ${aS.concededPerGame} gol yiyor (xGA ${aS.xgAgainst ?? na})` : na,
    midfield: (hS.avg?.possession != null && aS.avg?.possession != null) ? `${hS.avg.possession >= aS.avg.possession ? 'Ev sahibi' : 'Deplasman'} topa daha çok sahip` : na,
    wing: na, setPiece: na,
    transition: tacticalMismatch ? 'Deplasmanın geçiş oyunu ev savunmasına ters gelebilir' : na,
    mismatch: tacticalMismatch ? 'Deplasman yapısı ev sahibine ters' : (h2hAwayFav ? 'Geçmiş eşleşme deplasman lehine' : 'Belirgin taktik terslik tespit edilmedi'),
    verdict: tacticalMismatch ? 'Taktik olarak deplasman lehine risk var; 2 silinmemeli.' : (favSym === '1' && favPct >= 55 ? 'Taktik veriler ev sahibi lehine ama net üstünlük yok.' : 'Taktik denge net değil; kapalı oynamak güvenli.'),
  };

  // ——— GELİŞMİŞ İSTATİSTİK ———
  const advStats = {
    homeForm5: st.home?.last5venue?.join('') || st.home?.last5?.join('') || na,
    awayForm5: st.away?.last5venue?.join('') || st.away?.last5?.join('') || na,
    homeHome: st.home?.standing?.home ? `${st.home.standing.home.wins}G ${st.home.standing.home.draws}B ${st.home.standing.home.losses}M` : na,
    awayAway: st.away?.standing?.away ? `${st.away.standing.away.wins}G ${st.away.standing.away.draws}B ${st.away.standing.away.losses}M` : na,
    homeGoals: hS.goalsPerGame != null ? `${hS.goalsPerGame} attı / ${hS.concededPerGame} yedi (maç başı)` : na,
    awayGoals: aS.goalsPerGame != null ? `${aS.goalsPerGame} attı / ${aS.concededPerGame} yedi (maç başı)` : na,
    bttsOver: hS.bttsPct != null ? `Ev KG %${hS.bttsPct} · Üst2.5 %${hS.over25Pct}` : na,
    drawTend: h2hPlayed ? `H2H ${h2hPlayed} maç: ${h2hHome}-${h2hDraw}-${h2hAway} (E-B-D)` : na,
    xg: hS.xgFor != null ? `Ev xG ${hS.xgFor} / xGA ${hS.xgAgainst} · Dep xG ${aS.xgFor} / xGA ${aS.xgAgainst}` : na,
    strength: st.home?.standing && st.away?.standing ? `Sıra: ev ${st.home.standing.position}. · dep ${st.away.standing.position}.` : na,
  };

  // ——— BİLİNMEYENLER ———
  const unknownData = [
    'Eksik/cezalı bilgisi: Bilinmiyor',
    'Rotasyon bilgisi: Bilinmiyor',
    'Hava/zemin bilgisi: Bilinmiyor',
  ];
  if (!hasOdds) unknownData.push('Oran yok → analiz tahmini (≈)');
  if (h2hPlayed === 0) unknownData.push('Geçmiş eşleşme (H2H): Bilinmiyor');
  if (hS.xgFor == null || aS.xgFor == null) unknownData.push('xG / sezon istatistiği: kısıtlı');

  // ——— ÇELİŞKİ KONTROLÜ (kaynak veride) ———
  const contradictionWarnings = [];
  const predMeaning = (m?.prediction?.meaning || '').toLowerCase();
  if (pX >= X_KEEP_PCT && /beklenmez|silin/.test(predMeaning)) contradictionWarnings.push(`Kaynak tahmin "beraberlik beklenmez" diyor ama X %${pX} (≥). Karar motoru X'i canlı sayar.`);
  // Aranan kökler (net favori/banko/kesin) yalnız GELEN metinde ARANIR; uyarı
  // cümlesinde tekrar edilmez — iddialı dil olumsuzlama olarak bile yazılmaz.
  if (favPct < FAVORITE_MIN_PCT && /net favori|banko|kesin/.test(predMeaning)) contradictionWarnings.push(`Kaynak tahmin tek bir tarafı öne çıkarıyor ama favori %${favPct} (<50). Güçlü aday verilmez.`);
  if (gap12 < CLOSE_GAP_PCT && /tek/.test(predMeaning)) contradictionWarnings.push(`1-2 farkı %${gap12} (<15) — tek önerilmez.`);

  // ——— KISA RİSK YORUMU (önce risk → kanıt → karar) ———
  const shortComment = buildShortComment({ mainTrend, favSym, favPct, pX, p2, gap12, h2hAwayFav, tacticalMismatch, narrowCoupon, safeCoupon, bankoStatus, riskLevel });

  return {
    ok: true,
    mainTrend, favorite: { symbol: favSym, percent: favPct },
    probabilities: { '1': p1, X: pX, '2': p2 },
    narrowCoupon, safeCoupon, mustKeep: [...mustKeep],
    firstRemovable, removalRisk,
    bankoStatus, bankoReasons,
    riskLevel, riskScore, dataConfidence,
    targetStrategy, tags, resultAnalysis, bankoChecklist,
    tactical, advStats, unknownData, contradictionWarnings, shortComment,
  };
}

// Veri yoksa: dürüst boş karar (uydurma yok)
function emptyDecision(m) {
  return {
    ok: false,
    mainTrend: null, favorite: null, probabilities: null,
    narrowCoupon: ['1', 'X', '2'], safeCoupon: ['1', 'X', '2'], mustKeep: ['1', 'X', '2'],
    firstRemovable: null, removalRisk: 'Yüksek',
    bankoStatus: 'Hayır', bankoReasons: ['Bu maç için analiz verisi yok.'],
    riskLevel: 'Çok Yüksek', riskScore: 100, dataConfidence: 'Düşük',
    targetStrategy: { target12: ['1', 'X', '2'], target13_14: ['1', 'X', '2'], target15: ['1', 'X', '2'] },
    tags: [{ name: 'Veri Yetersiz', weight: 100, reason: 'Bu maç için istatistik/olasılık verisi gelmedi.', couponEffect: 'Kör karar verilmez; kapalı oynanmalı veya kupona alınmamalı.' }],
    resultAnalysis: null, bankoChecklist: [],
    tactical: null, advStats: null,
    unknownData: ['Bu maç için analiz verisi mevcut değil (kapsam dışı).'],
    contradictionWarnings: [],
    shortComment: 'Bu maç için yeterli veri yok. Kesin bir yön verilemez; kör karar önerilmez. Geniş kupon 1-X-2, güçlü aday önerilmez.',
  };
}

function joinCoupon(arr) { return (arr || []).join('-'); }

function buildShortComment({ mainTrend, favSym, favPct, pX, p2, gap12, h2hAwayFav, tacticalMismatch, narrowCoupon, safeCoupon, bankoStatus, riskLevel }) {
  const parts = [];
  // 1) önce risk
  if (favPct < FAVORITE_MIN_PCT || gap12 < CLOSE_GAP_PCT) parts.push(`Bu maç tek ${favSym} için güvenli değil.`);
  else parts.push(`Bu maç ${favSym} yönünde eğilimli ama garanti değil.`);
  // 2) kanıt
  const ev = [];
  ev.push(`Favori "${favSym}" %${favPct}${favPct < FAVORITE_MIN_PCT ? ' (belirgin üstünlük yok)' : ''}.`);
  if (h2hAwayFav) ev.push('Geçmiş eşleşme deplasman lehine.');
  if (tacticalMismatch) ev.push('Deplasmanın geçiş oyunu ev savunmasına ters gelebilir.');
  if (p2 >= AWAY_KEEP_PCT) ev.push(`Deplasman %${p2} ile 2 ihtimalini canlı tutuyor.`);
  if (pX >= X_KEEP_PCT) ev.push(`X %${pX} — düşük görünse de güç dengesi nedeniyle tamamen silinmemeli.`);
  parts.push(ev.join(' '));
  // 3) karar
  parts.push(`Dar kupon: ${joinCoupon(narrowCoupon)} · Geniş kupon: ${joinCoupon(safeCoupon)} · Güçlü aday: ${bankoStatus} · Risk: ${riskLevel}.`);
  return parts.join(' ');
}

export { joinCoupon };
