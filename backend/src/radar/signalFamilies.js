// SİNYAL AİLESİ MOTORU — çatışma/tekrar-sayma koruması.
// Aynı bilgiyi ölçen sinyaller (ör. son 5 formu, son 6 formu, galibiyet serisi)
// bağımsız oylar gibi TEKRAR TEKRAR sayılmaz: aile içinde azalan katkı uygulanır
// (en güçlü tam, ikinci %50, üçüncü %25, sonrası %10 — bkz. config.FAMILY_DECAY).
//
// Sinyal biçimi:
//   { key, family, label, side: 'home'|'draw'|'away', weight: >0, note?, source?, observedAt? }
import { FAMILY_DECAY, FAMILY_LABELS } from './config.js';

// Sinyalleri aile-kısıtlı taraf puanlarına indirger.
// Dönen: { home, draw, away, applied: [sinyal + appliedWeight], families: {family: {used, capped}} }
export function aggregateSignals(signals) {
  const byFamily = new Map();
  for (const s of signals || []) {
    if (!s || !s.side || !(s.weight > 0)) continue;
    if (!byFamily.has(s.family)) byFamily.set(s.family, []);
    byFamily.get(s.family).push(s);
  }

  const sides = { home: 0, draw: 0, away: 0 };
  const applied = [];
  const families = {};

  for (const [family, list] of byFamily.entries()) {
    // Aile içinde ağırlığa göre sırala; azalan katkı uygula.
    const sorted = list.slice().sort((a, b) => b.weight - a.weight);
    let raw = 0, used = 0;
    sorted.forEach((s, i) => {
      const decay = FAMILY_DECAY[Math.min(i, FAMILY_DECAY.length - 1)];
      const w = s.weight * decay;
      raw += s.weight;
      used += w;
      sides[s.side] += w;
      applied.push({ ...s, appliedWeight: Math.round(w * 100) / 100, decay });
    });
    families[family] = {
      label: FAMILY_LABELS[family] || family,
      signalCount: sorted.length,
      rawWeight: Math.round(raw * 100) / 100,
      usedWeight: Math.round(used * 100) / 100,
      capped: sorted.length > 1,
    };
  }

  return { sides, applied, families };
}

// Taraf puanlarını 0-100 aralığına (toplam 100) normalize eder.
// Hiç sinyal yoksa null döner (nötr 50 üretilmez — dürüstlük kuralı).
// sideFloor: AŞIRILIK YUMUŞATMA — sinyal dengesi bir OLASILIK değildir; tek
// tarafa sinyal yığıldı diye "1 %100 · X %0 · 2 %0" göstermek kesinlik iddiasıdır
// (proje kuralı: iddialı dil yok). Her tarafa küçük yapısal taban eklenir →
// hiçbir taraf %0'a düşmez, hiçbiri %100 olmaz; sıralama/yön değişmez.
export function sidesToScores(sides, { drawFloor = 18, sideFloor = 8 } = {}) {
  const h = Math.max(0, sides.home), d = Math.max(0, sides.draw), a = Math.max(0, sides.away);
  const sum = h + d + a;
  if (!(sum > 0)) return null;
  // Beraberlik sinyali nadiren doğrudan üretildiği için yapısal taban eklenir:
  // ev-deplasman farkı küçüldükçe X payı büyür (futbolun doğal beraberlik oranı).
  const diffRatio = Math.abs(h - a) / sum;                 // 0 (denk) → 1 (tek taraflı)
  const structuralDraw = drawFloor * (1 - diffRatio);      // denk maçta tam taban
  const prior = (sideFloor / 100) * sum;                   // her tarafın yapısal tabanı
  const H = h + prior, A = a + prior, D = d + (structuralDraw / 100) * sum + prior;
  const tot = H + D + A;
  const pct = (x) => Math.round((x / tot) * 100);
  const home = pct(H), draw = pct(D);
  return { home, draw, away: Math.max(0, 100 - home - draw) };
}
