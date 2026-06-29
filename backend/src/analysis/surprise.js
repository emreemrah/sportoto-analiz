// SÜRPRİZ ANALİZ MOTORU
// İhtimaller iki yoldan gelir:
//   1) ORAN VARSA  → oranlardan kesin ihtimal (marj temizlenir)
//   2) ORAN YOKSA  → ev/deplasman form (PPG) + xG'den TAHMİNİ ihtimal
// Sonra taban sürpriz + unsur puanlarıyla etiket üretilir.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SYMBOL = { home: '1', draw: 'X', away: '2' };

// --- 1) Oranlardan ihtimal (marjsız) ---
function oddsToProbs(odds) {
  const { home, draw, away } = odds || {};
  if (!home || !draw || !away) return null;
  const inv = { home: 1 / home, draw: 1 / draw, away: 1 / away };
  const sum = inv.home + inv.draw + inv.away;
  return { home: inv.home / sum, draw: inv.draw / sum, away: inv.away / sum };
}

// --- 2) Form (ev/deplasman PPG) + xG'den TAHMİNİ ihtimal ---
function formToProbs(prePpg, preXg) {
  const hp = Number(prePpg?.home) || 0;
  const ap = Number(prePpg?.away) || 0;
  const hx = Number(preXg?.home) || 0;
  const ax = Number(preXg?.away) || 0;
  if (!hp && !ap && !hx && !ax) return null; // hiç veri yok

  const HOME_ADV = 0.35; // ev sahibi avantajı
  // güç = form (PPG) ile xG'nin harmanı
  let h = Math.max(0.15, hp * 0.6 + hx * 0.9) + HOME_ADV;
  let a = Math.max(0.15, ap * 0.6 + ax * 0.9);

  const diff = Math.abs(h - a);
  // güçler yakınsa beraberlik ihtimali artar
  const pDraw = clamp(0.30 - diff * 0.10, 0.14, 0.34);
  const rem = 1 - pDraw;
  return {
    home: (rem * h) / (h + a),
    draw: pDraw,
    away: (rem * a) / (h + a),
  };
}

export function analyzeMatch(input) {
  let probs = oddsToProbs(input.odds);
  let estimated = false;

  // Oran yoksa form + xG'den tahmin et
  if (!probs) {
    probs = formToProbs(input.prePpg, input.preXg);
    estimated = true;
  }

  if (!probs) {
    return {
      hasOdds: false, estimated: false, probabilities: null, surpriseScore: null,
      label: 'VERİ YOK', labelColor: 'gray', favorite: null,
      comment: 'Bu maç için yeterli veri yok (oran da, form da yok).', factors: [],
    };
  }

  const entries = [
    { key: 'home', p: probs.home },
    { key: 'draw', p: probs.draw },
    { key: 'away', p: probs.away },
  ].sort((a, b) => b.p - a.p);

  const fav = entries[0];
  const second = entries[1];
  const gap = fav.p - second.p;

  // Taban: favori ne kadar zayıf öndeyse o kadar yüksek (0-60 bandı)
  let score = (1 - fav.p) * 60;
  const factors = [];
  const addFactor = (active, label, points) => {
    if (active) { score += points; factors.push({ label, points }); }
  };

  const favIsHome = fav.key === 'home';
  const favPpg = favIsHome ? input.prePpg?.home : input.prePpg?.away;
  const oppPpg = favIsHome ? input.prePpg?.away : input.prePpg?.home;
  const favXg = favIsHome ? input.preXg?.home : input.preXg?.away;
  const oppXg = favIsHome ? input.preXg?.away : input.preXg?.home;

  // 4) Favori formda değil / 6) Rakip daha formda
  if (favPpg != null && oppPpg != null && (favPpg || oppPpg)) {
    addFactor(oppPpg > favPpg + 0.3, 'Rakip son dönemde daha formda', 12);
    addFactor(favPpg < 1.2 && favPpg > 0, 'Favori son dönemde formsuz', 8);
    // 7) İç/dış saha gücü çok yakın → çekişmeli
    addFactor(Math.abs(favPpg - oppPpg) <= 0.25, 'İç/dış saha formu çok yakın', 8);
  }

  // 8) xG favoriyi öne çıkarmıyor (şanslı favori / çekişme)
  if (favXg != null && oppXg != null && (favXg || oppXg)) {
    addFactor(oppXg >= favXg, 'Beklenen gol (xG) favoriyi öne çıkarmıyor', 10);
  }

  // Çekişme + beraberlik + açık favori yok
  addFactor(gap < 0.15, 'İhtimaller çok yakın (çekişmeli)', 10);
  addFactor(probs.draw > 0.3 && fav.key !== 'draw', 'Beraberlik ihtimali yüksek', 8);
  addFactor(fav.p < 0.45, 'Net bir favori yok', 8);

  score = Math.round(clamp(score, 0, 100));

  let label, labelColor;
  if (score < 25) { label = 'BANKO'; labelColor = 'green'; }
  else if (score <= 45) { label = 'DİKKAT'; labelColor = 'yellow'; }
  else { label = 'SÜRPRİZE AÇIK'; labelColor = 'red'; }

  const favSymbol = SYMBOL[fav.key];
  const favPct = Math.round(fav.p * 100);
  const tag = estimated ? ' (≈ tahmini, oran yok)' : '';

  let comment;
  if (label === 'BANKO') {
    comment = `Favori "${favSymbol}" %${favPct} ile açık ara önde. Güçlü banko adayı.${tag}`;
  } else if (label === 'DİKKAT') {
    comment = `Favori "${favSymbol}" (%${favPct}) önde ama tartışmalı.` +
      (factors.length ? ` Dikkat: ${factors.map((f) => f.label.toLowerCase()).join(', ')}.` : '') + tag;
  } else {
    comment = `Sürprize açık maç. Favori "${favSymbol}" sadece %${favPct} ve ` +
      `${factors.map((f) => f.label.toLowerCase()).join(', ')}. Çift düşünülebilir.${tag}`;
  }

  return {
    hasOdds: !estimated,
    estimated,
    probabilities: {
      '1': Math.round(probs.home * 100),
      'X': Math.round(probs.draw * 100),
      '2': Math.round(probs.away * 100),
    },
    surpriseScore: score,
    label,
    labelColor,
    favorite: { symbol: favSymbol, percent: favPct },
    comment,
    factors,
  };
}
