// CLAUDE MAÇ YORUMU
// Eşleşen her maçın tüm istatistiklerini (oran, form, puan durumu, oyuncular,
// H2H, potansiyel) Claude'a verip akıcı, Türkçe bir sürpriz yorumu ürettirir.
// Anthropic anahtarı yoksa devre dışı kalır; refresh kural-tabanlı yoruma düşer.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export const aiEnabled = !!config.anthropicKey;

const client = aiEnabled ? new Anthropic({ apiKey: config.anthropicKey }) : null;

const SYSTEM = `Sen bir Türk futbol analistisin. Sana bir Spor Toto maçının istatistikleri veriliyor.
Görevin: maçın SÜRPRİZE ne kadar açık olduğunu değerlendiren, akıcı ve net bir TÜRKÇE yorum yazmak.
Kurallar:
- 2-3 cümle, en fazla ~60 kelime. Markdown veya başlık kullanma, düz metin yaz.
- Verilere dayan: oranlar/ihtimaller, form (PPG), puan durumu, önemli oyuncular, karşılıklı geçmiş (H2H), xG.
- En belirleyici 1-2 unsuru vurgula; genel geçer laf etme.
- Kupon/bahis tavsiyesi VERME; sadece analiz yap (güçlü aday mı, sürprize açık mı).
- Oran yoksa "tahmini" olduğunu ima et.`;

// Maç verisini Claude'un okuyacağı kompakt bir metne çevirir.
function buildFacts(m) {
  const a = m.analysis || {};
  const s = m.stats || {};
  const L = [];
  L.push(`Maç: ${m.home.mediumName} (ev) - ${m.away.mediumName} (deplasman)`);
  if (m.league) L.push(`Lig: ${m.league}`);
  if (a.probabilities) {
    L.push(`İhtimaller: 1=%${a.probabilities['1']}  X=%${a.probabilities['X']}  2=%${a.probabilities['2']}${a.estimated ? ' (oran yok, form+xG tahmini)' : ''}`);
  }
  if (a.surpriseScore != null) L.push(`Sistem sürpriz puanı: ${a.surpriseScore}/100 (${a.label})`);
  if (a.factors?.length) L.push(`Sürpriz unsurları: ${a.factors.map((f) => f.label).join('; ')}`);

  // Eksik alan artık null gelebilir (footystats.numN) — satır ancak çekirdek
  // alanlar doluysa kurulur; yarım veriyle "null puan" gibi metin üretilmez.
  const standLine = (label, st) => (st && st.position != null && st.points != null)
    ? `${label} puan durumu: ${st.position}. sıra, ${st.points} puan, ${st.wins ?? '?'}G ${st.draws ?? '?'}B ${st.losses ?? '?'}M${st.goalDiff != null ? `, av ${st.goalDiff >= 0 ? '+' : ''}${st.goalDiff}` : ''}`
    : null;
  const hp = standLine('Ev', s.home?.standing);
  const ap = standLine('Deplasman', s.away?.standing);
  if (hp) L.push(hp);
  if (ap) L.push(ap);

  const players = (label, arr) => arr?.length
    ? `${label} öne çıkanlar: ${arr.map((p) => `${p.role} ${p.name} (${p.line})`).join(', ')}`
    : null;
  const hpl = players('Ev', s.home?.players);
  const apl = players('Deplasman', s.away?.players);
  if (hpl) L.push(hpl);
  if (apl) L.push(apl);

  if (s.h2h?.played) L.push(`H2H (${s.h2h.played} maç): ev ${s.h2h.homeWins} galibiyet, ${s.h2h.draws} beraberlik, deplasman ${s.h2h.awayWins} galibiyet`);
  if (s.potentials) L.push(`Beklentiler: 2.5 üst %${s.potentials.over25}, KG var %${s.potentials.btts}`);
  return L.join('\n');
}

async function commentForMatch(m) {
  const facts = buildFacts(m);
  const res = await client.messages.create({
    model: config.aiModel,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: 'user', content: facts }],
  });
  const text = res.content.find((b) => b.type === 'text')?.text?.trim();
  return text || null;
}

// Verilen maçların aiComment alanını doldurur (eş zamanlılık sınırlı).
// Sadece analizi olan (oranlı ya da tahmini) maçlar için üretir.
export async function attachAiComments(matches) {
  if (!aiEnabled) return;
  const targets = matches.filter((m) => m.stats || m.analysis?.surpriseScore != null);
  const POOL = 4;
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const m = targets[i++];
      try {
        m.aiComment = await commentForMatch(m);
      } catch (e) {
        console.warn(`[ai] yorum üretilemedi (#${m.no}): ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(POOL, targets.length) }, worker));
}
