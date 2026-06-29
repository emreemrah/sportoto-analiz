// KUPON TAHMİN MOTORU
// Kullanıcının kupon kurallarını koda döker: her maça 1/0/2/10/02/12/102 üretir.
// Girdi: surprise.js çıktısı (ihtimaller, sürpriz, unsurlar) + enrich.js istatistikleri
//        (puan durumu, iç/dış saha formu, H2H, gol beklentisi).
// Favoriyi kör yazmaz: saha formu, H2H, beraberlik riski ve sürprizi birlikte tartar.

// Bir iç/dış saha kaydından puan ortalaması (form göstergesi)
const ppgOf = (r) => (r ? (r.wins * 3 + r.draws) / Math.max(1, r.wins + r.draws + r.losses) : null);

const SYMBOL_TR = {
  '1': 'Ev sahibi kazanır',
  '0': 'Beraberlik',
  '2': 'Deplasman kazanır',
  '10': 'Ev sahibi kaybetmez',
  '02': 'Deplasman kaybetmez',
  '12': 'Beraberlik beklenmez',
  '102': 'Üç ihtimal de açık',
  '-': 'Veri yok',
};

export function predict(m) {
  const a = m.analysis || {};
  const s = m.stats || {};
  if (!a.probabilities) {
    return { symbol: '-', meaning: SYMBOL_TR['-'], label: 'VERİ YOK', estimated: false, reason: 'Yeterli veri yok' };
  }

  let sc1 = a.probabilities['1'];
  let sc0 = a.probabilities['X'];
  let sc2 = a.probabilities['2'];
  const reasons = [];
  const bump = (cond, side, pts, txt) => {
    if (!cond) return;
    if (side === 1) sc1 += pts; else if (side === 0) sc0 += pts; else sc2 += pts;
    if (txt) reasons.push(txt);
  };

  // 1) İç / dış saha formu (kural 2)
  const homePpg = ppgOf(s.home?.standing?.home);
  const awayPpg = ppgOf(s.away?.standing?.away);
  bump(homePpg != null && homePpg >= 2.0, 1, 8, 'ev sahibi iç sahada çok güçlü');
  bump(homePpg != null && homePpg <= 0.9, 1, -8, 'ev sahibi iç sahada zayıf');
  bump(awayPpg != null && awayPpg >= 1.8, 2, 8, 'deplasman dış sahada güçlü');
  bump(awayPpg != null && awayPpg <= 0.8, 2, -8, 'deplasman dış sahada zayıf');

  // 2) Karşılıklı geçmiş — H2H (kural 6)
  const h = s.h2h;
  if (h && h.played >= 5) {
    const dom = (h.homeWins - h.awayWins) / h.played;
    bump(dom >= 0.22, 1, 6, 'H2H ev sahibi lehine');
    bump(dom <= -0.22, 2, 6, 'H2H deplasman lehine');
    bump(h.draws / h.played >= 0.30, 0, 6, 'H2H beraberlik eğilimli');
  }

  // 3) Beraberlik riski (kural 7)
  bump(s.potentials && s.potentials.over25 <= 35, 0, 6, 'az gollü beklenti');
  const hr = s.home?.standing?.home;
  bump(hr && hr.draws >= 4 && hr.draws >= hr.wins + hr.losses, 0, 6, 'ev sahibi sürekli berabere');

  // 4) Sürpriz unsurları (kural 8) — surprise.js'in faktörleri
  const fav = a.favorite?.symbol; // '1' | 'X' | '2'
  const favSide = fav === '1' ? 1 : fav === '2' ? 2 : 0;
  const oppSide = favSide === 1 ? 2 : favSide === 2 ? 1 : 0;
  const has = (t) => (a.factors || []).some((f) => f.label.includes(t));
  bump(has('Favori son dönemde formsuz') && favSide !== 0, favSide, -6, 'favori formsuz');
  bump(has('Rakip son dönemde daha formda') && oppSide !== 0, oppSide, 6, 'rakip daha formda');
  bump(has('xG') && favSide !== 0, favSide, -4, 'xG favoriyi öne çıkarmıyor');
  bump(has('Beraberlik ihtimali yüksek'), 0, 6, 'beraberlik ihtimali yüksek');
  bump(has('İç/dış saha formu çok yakın') || has('İhtimaller çok yakın'), 0, 3, 'güçler çok yakın');

  // --- Karar (kurallar 9-11: banko / çifte / üçlü) ---
  const arr = [{ k: '1', v: sc1 }, { k: '0', v: sc0 }, { k: '2', v: sc2 }].sort((x, y) => y.v - x.v);
  const top = arr[0], mid = arr[1], low = arr[2];
  const lead = top.v - mid.v;       // birinci ile ikinci arası fark
  const spread = top.v - low.v;     // birinci ile sonuncu arası fark
  const surprise = a.surpriseScore ?? 50;

  const doubleOf = (x, y) => {
    const set = new Set([x, y]);
    if (set.has('1') && set.has('0')) return '10';
    if (set.has('0') && set.has('2')) return '02';
    return '12';
  };

  let symbol, label;
  if (spread <= 10) {
    symbol = '102'; label = 'AÇIK';                 // üç ihtimal de yakın → karışık
    reasons.unshift('üç ihtimal de yakın');
  } else if (lead >= 12) {
    symbol = top.k;
    label = lead >= 30 && surprise < 35 ? 'BANKO' : 'NET';
  } else if (lead >= 6) {
    symbol = top.k; label = 'TEMKİNLİ';             // hafif yönelim ama tek
  } else {
    symbol = doubleOf(top.k, mid.k); label = 'ÇİFTE'; // ilk iki ihtimal yakın
  }

  if (a.estimated) reasons.push('oran yok, tahmini');

  return {
    symbol,
    meaning: SYMBOL_TR[symbol] || '',
    label,
    estimated: !!a.estimated,
    reason: reasons.slice(0, 3).join('; ') || 'oranlara göre',
  };
}
