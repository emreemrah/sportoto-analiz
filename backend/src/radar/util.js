// RADAR ORTAK YARDIMCILARI — saf, test edilebilir fonksiyonlar.

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round1 = (v) => Math.round(v * 10) / 10;

// G/B/M dizisi → 0..1 kalite (G=1, B=0.5, M=0)
export function formQuality(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const pts = arr.reduce((s, r) => s + (r === 'G' ? 1 : r === 'B' ? 0.5 : 0), 0);
  return pts / arr.length;
}

// İç/dış saha kaydı → maç başı puan
export function venuePpg(rec) {
  if (!rec) return null;
  const p = (rec.wins || 0) + (rec.draws || 0) + (rec.losses || 0);
  if (!p) return null;
  return ((rec.wins || 0) * 3 + (rec.draws || 0)) / p;
}

export function venueWinRate(rec) {
  if (!rec) return null;
  const p = (rec.wins || 0) + (rec.draws || 0) + (rec.losses || 0);
  return p ? (rec.wins || 0) / p : null;
}

export const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9çğıöşü]/g, '');

// Logo URL'sinden takım kimliği ("…/finland-kuopion-palloseura.png" → slug).
// Kaynak her iki tarafta da aynı CDN'i kullandığı için dilden bağımsız KESİN eşleşmedir.
const logoSlug = (u) => {
  const m = String(u || '').match(/\/([a-z0-9-]+)\.(png|jpg|jpeg|svg|webp)(\?|$)/i);
  return m ? m[1].toLowerCase() : null;
};

// Lig tablosundan takım → sıra (rakip gücü ayarı için). Eşleşme sırası:
// 1) LOGO KİMLİĞİ (kesin — "TPS" ↔ "Turun Palloseura" gibi ad farkları sorun olmaz)
// 2) birebir ad  3) içerme (tek ve belirsizliksiz adaysa; ≥4 harf — "FF Jaro"↔"Jaro").
// Belirsiz içerme (birden çok aday) REDDEDİLİR — yanlış takıma bağlamaktansa null.
export function positionByName(leagueTable, name, logo = null) {
  const overall = leagueTable?.overall;
  if (!Array.isArray(overall) || !overall.length) return null;
  // ppg (puan/maç): seviye sınıflaması PUAN/MAÇ farkına dayanır (kullanıcı
  // kararı) — 3 maçtan az oynayan takım için ppg uydurulmaz (null).
  const out = (row) => {
    if (!row) return null;
    const pts = Number(row.points), pl = Number(row.played);
    const ppg = Number.isFinite(pts) && Number.isFinite(pl) && pl >= 3
      ? Math.round((pts / pl) * 100) / 100 : null;
    return { position: row.position, teamCount: overall.length, ppg, played: Number.isFinite(pl) ? pl : null };
  };
  const slug = logoSlug(logo);
  if (slug) {
    const row = overall.find((r) => logoSlug(r.logo) === slug);
    if (row) return out(row);
  }
  if (!name) return null;
  const key = normName(name);
  const exact = overall.find((r) => normName(r.name) === key);
  if (exact) return out(exact);
  if (key.length >= 4) {
    const partial = overall.filter((r) => {
      const k = normName(r.name);
      return k.length >= 4 && (k.includes(key) || key.includes(k));
    });
    if (partial.length === 1) return out(partial[0]);
  }
  return null;
}

// Skorlardan favori: en yüksek taraf + yüzde. scores null ise null.
export function favoriteOfScores(scores) {
  if (!scores) return null;
  const entries = [
    { symbol: '1', pct: scores.home },
    { symbol: 'X', pct: scores.draw },
    { symbol: '2', pct: scores.away },
  ].sort((a, b) => b.pct - a.pct);
  return { symbol: entries[0].symbol, percent: entries[0].pct, second: entries[1].symbol, secondPercent: entries[1].pct, gap: entries[0].pct - entries[1].pct };
}

// Oranlardan overround temizlenmiş olasılıklar (%). Eksik oran → null.
export function impliedFromOdds(odds) {
  const h = num(odds?.home), d = num(odds?.draw), a = num(odds?.away);
  if (!h || !d || !a || h <= 1 || d <= 1 || a <= 1) return null;
  const ih = 1 / h, id = 1 / d, ia = 1 / a;
  const sum = ih + id + ia; // 1 + overround
  return {
    home: round1((ih / sum) * 100),
    draw: round1((id / sum) * 100),
    away: round1((ia / sum) * 100),
    overroundPct: round1((sum - 1) * 100),
  };
}

// STANDART RADAR ÇIKTISI — beş radar da aynı tipi üretir (testler doğrular).
export function radarOutput({
  id, name, version, hasData, status = 'ok', dataQuality = 0,
  scores = null, favoriteFailureRisk = null, direction = null, surpriseDirection = null,
  activeSignals = [], missingSignals = [], positives = [], negatives = [],
  families = null, sources = [], details = null, note = null,
}) {
  return {
    id, name, version,
    hasData: !!hasData,
    status,                                  // 'ok' | 'no_source' | 'insufficient'
    dataQuality: clamp(Math.round(dataQuality), 0, 100),
    homeScore: scores ? scores.home : null,
    drawScore: scores ? scores.draw : null,
    awayScore: scores ? scores.away : null,
    favoriteFailureRisk: favoriteFailureRisk == null ? null : clamp(Math.round(favoriteFailureRisk), 0, 100),
    direction,                               // radarın işaret ettiği yön ('1'|'X'|'2') veya null
    surpriseDirection,                       // favori kazanamazsa ağırlıklı yön
    activeSignals,
    missingSignals,
    positives,
    negatives,
    families,
    sources,
    details,
    note,
    methodologyVersion: version,
  };
}

// Ev/deplasman/beraberlik skorlarından yön + favori kazanamama riskinin
// yönsel dağılımı (X mi karşı galibiyet mi).
export function directionOf(scores, favoriteSymbol) {
  if (!scores) return { direction: null, surpriseDirection: null };
  const fav = favoriteSymbol || favoriteOfScores(scores)?.symbol || null;
  const direction = favoriteOfScores(scores)?.symbol ?? null;
  let surpriseDirection = null;
  if (fav === '1') surpriseDirection = scores.draw >= scores.away ? 'X' : '2';
  else if (fav === '2') surpriseDirection = scores.draw >= scores.home ? 'X' : '1';
  else if (fav === 'X') surpriseDirection = scores.home >= scores.away ? '1' : '2';
  return { direction, surpriseDirection };
}
