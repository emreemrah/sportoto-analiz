// AKILLI KUPON + ANALİZDEN AKTARIM — saf modül (RN/api importu yok; testli).
// DÜRÜSTLÜK KURALLARI (kesin):
// • Veri yoksa uydurulmaz: sinyali olmayan maç "veri yetersiz" işaretlenir ve
//   boş bırakılır — rastgele/uydurma seçim üretilmez.
// • Kapsama puanı KESİN KAZANMA İHTİMALİ DEĞİLDİR — her yerde bu notla sunulur.
// • Aktarım kullanıcı seçimini ASLA sessizce değiştirmez: önce fark listesi
//   (diffSelections) gösterilir, karar kullanıcınındır.
// • Kolon sınırı 2500 (resmi kural) hiçbir durumda aşılmaz.
import { COUPON_MAX_COLUMNS } from '../couponConfig';

export const expandSymbol = (sym) =>
  (sym && sym !== '-' ? String(sym).split('').map((c) => (c === '0' ? 'X' : c)).filter((c) => ['1', 'X', '2'].includes(c)) : []);

// Maçtan MEVCUT sinyalleri topla — olmayan alan null kalır, uydurulmaz.
export function signalsOf(m) {
  const probs = m?.probabilities && ['1', 'X', '2'].every((k) => Number.isFinite(Number(m.probabilities[k])))
    ? { 1: Number(m.probabilities['1']), X: Number(m.probabilities['X']), 2: Number(m.probabilities['2']) }
    : null;
  const sysSym = m?.prediction?.symbol && m.prediction.symbol !== '-' ? m.prediction.symbol : null;
  const master = m?.radarCenter?.master || null;
  const radarSym = master?.favorite?.symbol || null;
  const surprise = Number.isFinite(Number(m?.analysis?.surpriseScore)) ? Number(m.analysis.surpriseScore) : null;
  const dataQuality = Number.isFinite(Number(master?.dataQuality)) ? Number(master.dataQuality) : null;
  return { probs, sysSym, radarSym, surprise, dataQuality };
}

// İhtimalleri büyükten küçüğe sırala → [['1',45],['X',30],['2',25]]
function rankedProbs(probs) {
  return Object.entries(probs).sort((a, b) => b[1] - a[1]);
}

// Belirsizlik (0-1) + insanca gerekçeler. Yalnız MEVCUT sinyaller katılır.
export function uncertaintyOf(sig) {
  const parts = []; const reasons = [];
  if (sig.probs) {
    const r = rankedProbs(sig.probs);
    const gap = (r[0][1] - r[1][1]) / 100;                 // favori ile ikinci arasındaki fark
    const u = Math.max(0, Math.min(1, 1 - gap * 2));       // fark küçükse belirsiz
    parts.push({ w: 3, v: u });
    if (gap <= 0.10) reasons.push('ihtimaller birbirine çok yakın');
    else if (gap >= 0.25) reasons.push('güçlü bir aday var');
  }
  if (sig.surprise != null) {
    parts.push({ w: 2, v: Math.max(0, Math.min(1, sig.surprise / 100)) });
    if (sig.surprise >= 65) reasons.push('sürpriz riski yüksek');
  }
  const sysFirst = expandSymbol(sig.sysSym)[0] || null;
  if (sysFirst && sig.radarSym) {
    const disagree = sysFirst !== sig.radarSym;
    parts.push({ w: 2, v: disagree ? 1 : 0 });
    if (disagree) reasons.push('Master Analiz ile Radar farklı yönde');
    else reasons.push('Master Analiz ile Radar aynı yönde');
  }
  if (sig.dataQuality != null) {
    const v = Math.max(0, Math.min(1, 1 - sig.dataQuality / 100));
    parts.push({ w: 1, v });
    if (sig.dataQuality < 50) reasons.push('veri yeterliliği düşük');
  }
  if (!parts.length) return { u: null, reasons: ['bu maç için sinyal verisi yok'] };
  const u = parts.reduce((t, p) => t + p.w * p.v, 0) / parts.reduce((t, p) => t + p.w, 0);
  return { u, reasons };
}

// Maçın taban (tekli) tercihi + kaynağı. Veri yoksa null (uydurulmaz).
export function baseOutcomeOf(sig) {
  if (sig.probs) return { outcome: rankedProbs(sig.probs)[0][0], source: 'ihtimaller' };
  if (sig.radarSym) return { outcome: sig.radarSym, source: 'Radar favorisi' };
  const sys = expandSymbol(sig.sysSym);
  if (sys.length) return { outcome: sys[0], source: 'Sistem tahmini' };
  return null;
}
// Bir sonraki en olası işaret (genişletme adayı).
function nextOutcomeOf(sig, chosen) {
  if (sig.probs) {
    for (const [o] of rankedProbs(sig.probs)) if (!chosen.includes(o)) return o;
  }
  const sys = expandSymbol(sig.sysSym);
  for (const o of sys) if (!chosen.includes(o)) return o;
  if (sig.radarSym && !chosen.includes(sig.radarSym)) return sig.radarSym;
  return ['1', 'X', '2'].find((o) => !chosen.includes(o)) || null;
}

// AKILLI KUPON: bütçe (kolon cinsinden) + hedef (12-15) → seçim + açıklamalar.
// Mantık: tüm maçlar tabanla tekli başlar; en belirsiz maçlar, bütçe ve 2500
// sınırı içinde kalarak çifte/üçlüye genişletilir. Hedef düştükçe (12'ye doğru)
// genişletme iştahı azalır (daha çok yanlışa tahammül var → daha ucuz kupon).
export function buildSmartCoupon({ matches, budgetColumns, target }) {
  const maxCols = Math.max(1, Math.min(COUPON_MAX_COLUMNS, Math.floor(budgetColumns || COUPON_MAX_COLUMNS)));
  const tgt = [12, 13, 14, 15].includes(target) ? target : 13;
  // Hedefe göre genişletme eşiği: 15 → her belirsizlik değerli; 12 → yalnız çok belirsizler.
  const threshold = { 15: 0.15, 14: 0.30, 13: 0.45, 12: 0.60 }[tgt];

  const rows = (matches || []).map((m) => {
    const sig = signalsOf(m);
    const unc = uncertaintyOf(sig);
    const base = baseOutcomeOf(sig);
    return { no: m.no, sig, u: unc.u, reasons: unc.reasons, base };
  });
  const insufficient = rows.filter((r) => !r.base).map((r) => r.no);
  const usable = rows.filter((r) => r.base);

  const picks = new Map(usable.map((r) => [r.no, [r.base.outcome]]));
  const colsOf = () => [...picks.values()].reduce((n, o) => n * o.length, 1);

  // Açgözlü genişletme: en belirsiz + eşiği aşan maçtan başla.
  const queue = usable.filter((r) => r.u != null && r.u >= threshold).sort((a, b) => b.u - a.u);
  let guard = 0;
  while (guard++ < 60) {
    let applied = false;
    for (const r of queue) {
      const cur = picks.get(r.no);
      if (cur.length >= 3) continue;
      // Üçlüye yalnız ÇOK belirsiz maçta çık (u ≥ 0.75) — savurganlık değil sinyal.
      if (cur.length === 2 && r.u < 0.75) continue;
      const nxt = nextOutcomeOf(r.sig, cur);
      if (!nxt) continue;
      const factor = (cur.length + 1) / cur.length;
      if (colsOf() * factor > maxCols) continue;
      picks.set(r.no, [...cur, nxt]);
      applied = true;
      break; // her turda tek genişletme → en değerliye öncelik korunur
    }
    if (!applied) break;
  }

  const ORDER = ['1', 'X', '2'];
  const selections = usable.map((r) => ({
    no: r.no,
    selectedOutcomes: ORDER.filter((o) => picks.get(r.no).includes(o)),
  }));

  // Sade açıklamalar — teknik formül yok, insanca gerekçe var.
  const explanations = usable.map((r) => {
    const n = picks.get(r.no).length;
    const level = n === 1 ? 'tekli' : n === 2 ? 'çifte' : 'üçlü';
    const why = r.reasons.slice(0, 2).join(' · ') || 'sinyaller tek yönde';
    const head = n === 1
      ? (r.u != null && r.u >= threshold ? 'tekli kaldı (bütçe/sınır önceliği başka maçlardaydı)' : 'tekli bırakıldı')
      : `${level} yapıldı`;
    return { no: r.no, level, text: `${head} — ${why} (kaynak: ${r.base.source})` };
  });

  // Kapsama puanı: seçilen işaretlerin ihtimal kütlesi ortalaması (yalnız
  // ihtimal verisi olan maçlarda). KESİN KAZANMA İHTİMALİ DEĞİLDİR.
  const covered = usable.filter((r) => r.sig.probs);
  const coverageScore = covered.length
    ? Math.round(covered.reduce((t, r) => t + picks.get(r.no).reduce((s, o) => s + r.sig.probs[o], 0), 0) / covered.length)
    : null;

  return {
    selections,
    columns: colsOf(),
    target: tgt,
    explanations,
    coverageScore,
    coverageNote: 'Kapsama puanı seçimlerin sinyal ihtimallerini ne kadar örttüğünü gösterir — kesin kazanma ihtimali DEĞİLDİR.',
    insufficient, // veri yetersiz maçlar — boş bırakıldı, kullanıcı elle seçer
  };
}

// AKTARIM FARKI — mevcut seçim ASLA sessizce ezilmez; fark listesi kullanıcıya
// gösterilir, onaylarsa uygulanır.
export function diffSelections(currentMap, proposedMap) {
  const nos = new Set([...Object.keys(currentMap || {}), ...Object.keys(proposedMap || {})].map(Number));
  const changes = [];
  for (const no of [...nos].sort((a, b) => a - b)) {
    const from = (currentMap?.[no] || []).join('-');
    const to = (proposedMap?.[no] || []).join('-');
    if (from === to) continue;
    changes.push({
      no,
      from: from || '(boş)',
      to: to || '(boş)',
      kind: !from ? 'fill' : 'change', // fill: boş dolduruldu · change: mevcut değişecek
    });
  }
  return changes;
}

// Aktarım önerisi: Sistem tahmini veya Radar (favori + yakın ikinciyle çifte).
export function proposalFrom(matches, source /* 'system' | 'radar' */) {
  const out = {};
  for (const m of matches || []) {
    const sig = signalsOf(m);
    if (source === 'system') {
      const o = expandSymbol(sig.sysSym);
      if (o.length) out[m.no] = o;
    } else if (source === 'radar') {
      if (!sig.radarSym) continue;
      const arr = [sig.radarSym];
      // Alternatif: ihtimal verisi varsa ve ikinci işaret favoriye ≤10 puan yakınsa çifte öner.
      if (sig.probs) {
        const r = rankedProbs(sig.probs);
        const second = r.find(([o]) => o !== sig.radarSym);
        if (second && sig.probs[sig.radarSym] != null && second[1] >= sig.probs[sig.radarSym] - 10 && second[1] >= 25) arr.push(second[0]);
      }
      out[m.no] = ['1', 'X', '2'].filter((o) => arr.includes(o));
    }
  }
  return out;
}
