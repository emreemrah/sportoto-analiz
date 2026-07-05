// Canlı Bülten paylaşılan mantık: durum türetme, tahmin isabeti (anlık/final),
// risk hesabı. HİÇBİR uydurma veri üretmez — yalnız backend'den gelen gerçek
// skor/durum/tahmin alanlarını yorumlar.

// Kupon sembolünü (1/0/2/10/02/12/102) olası sonuç kümesine açar. 0 = X (beraberlik).
export function expandPick(sym) {
  if (!sym || sym === '-') return [];
  return String(sym).split('').map((c) => (c === '0' ? 'X' : c)).filter((c) => ['1', 'X', '2'].includes(c));
}

// Skordan anlık 1/X/2 sonucu.
export function resultFromScore(score) {
  if (!score || score.home == null || score.away == null) return null;
  if (score.home > score.away) return '1';
  if (score.home < score.away) return '2';
  return 'X';
}

// Tahmin bu sonucu tutuyor mu? true=isabet, false=iska, null=tahmin/sonuç yok.
export function pickHits(sym, actual) {
  const set = expandPick(sym);
  if (!set.length || !actual) return null;
  return set.includes(actual);
}

const POSTPONED = new Set(['PST']);
const CANCELLED = new Set(['CANC', 'ABD', 'AWD', 'WO']);
const SUSPENDED = new Set(['SUSP', 'INT']);

// Maçın görüntü durumunu türet. Öncelik: resmi durum kodu > final > canlı >
// başladı-sonuç-yok > başlamadı.
export function deriveStatus(m, now = Date.now()) {
  const ls = m.liveStatus || '';
  if (POSTPONED.has(ls)) return 'postponed';   // Ertelendi
  if (CANCELLED.has(ls)) return 'cancelled';   // İptal
  if (SUSPENDED.has(ls)) return 'suspended';   // Maç durdu
  const started = m.started || (m.date ? new Date(m.date).getTime() <= now : false);
  if (m.finalized || m.status === 'finished') return 'finished';   // MS
  if (m.live) return 'live';                                        // CANLI
  if (started) return 'awaiting';                                   // Sonuç bekleniyor
  return 'notStarted';                                             // Başlamadı
}

// Bir maç için Sen/Sistem tahmin durumları. userPick şimdilik gerçek kuponla
// beslenmediği için null (Kupon yok) — mock kupon GERÇEK gibi gösterilmez.
export function matchPicks(m, userPick = null) {
  const st = deriveStatus(m);
  const systemSym = m.prediction && m.prediction.symbol !== '-' ? m.prediction.symbol : null;
  const actual = resultFromScore(m.score);
  // ✅/❌ yalnız canlı (geçici) veya final (kesin) durumda; ertelenen/iptal/durdu/
  // başlamadı/awaiting → ⏳ (kesin değil).
  const scored = st === 'live' || st === 'finished';
  const final = st === 'finished';
  const evalPick = (sym) => {
    if (!sym) return { sym: null, mark: 'none' };
    if (!scored) return { sym, mark: 'pending' };            // ⏳
    const hit = pickHits(sym, actual);
    return { sym, mark: hit ? 'correct' : 'wrong', final }; // ✅/❌
  };
  return { status: st, actual, system: evalPick(systemSym), user: evalPick(userPick), scored, final };
}

// Üst özet sayıları.
export function summaryCounts(matches, userPicks = {}) {
  let live = 0, notStarted = 0, finished = 0, couponRisk = 0, systemRisk = 0;
  for (const m of matches) {
    const st = deriveStatus(m);
    if (st === 'live') live++;
    else if (st === 'notStarted') notStarted++;
    else if (st === 'finished') finished++;
    // Risk = CANLI maçta tahmin şu an İSKA (geçici).
    if (st === 'live') {
      const actual = resultFromScore(m.score);
      const sysSym = m.prediction && m.prediction.symbol !== '-' ? m.prediction.symbol : null;
      if (pickHits(sysSym, actual) === false) systemRisk++;
      const up = userPicks[m.no];
      if (up && pickHits(up, actual) === false) couponRisk++;
    }
  }
  return { live, notStarted, finished, couponRisk, systemRisk };
}
