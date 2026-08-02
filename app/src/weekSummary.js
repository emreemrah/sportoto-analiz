// HAFTANIN ÖZETİ — yayın açılış kartının SEÇİM MANTIĞI (saf modül, RN yok).
//
// DÜRÜSTLÜK KURALLARI
//   • Yalnız bültendeki GERÇEK analiz verisi kullanılır; aday uydurulmaz.
//   • Başlamış maç "aday" olarak gösterilmez (sonucu belli olmaya başlamıştır).
//   • Güçlü aday yoksa liste BOŞ döner — zorla doldurulmaz; ekran bunu dürüstçe
//     söyler. Etiket dili displayLabel sözlüğünden geçer (asla "banko" yazılmaz).

// Veri anahtarı 'BANKO' → kullanıcıya GÜÇLÜ ADAY olarak gösterilir (labels.js).
const STRONG_KEY = 'BANKO';
const SURPRISE_KEY = 'SÜRPRİZE AÇIK';

const startedNow = (m, now) => {
  if (m?.started) return true;
  const t = m?.date ? new Date(m.date).getTime() : NaN;
  return !Number.isNaN(t) && t <= now;
};

/**
 * Bir maçın EN YÜKSEK ihtimali (0-100) — yoksa null.
 *
 * Neden ayrı bir dışa aktarım: "denk güç" eşiği (%45) bu dosyada TEK yerde
 * durmalı. Yayın modu gibi başka ekranlar aynı hesabı kendi içinde tekrar
 * yazarsa iki farklı sayı doğar; yinelenen istatistik yasağı bunu yasaklar.
 */
export function topProbability(m) {
  const p = m?.analysis?.probabilities;
  if (!p) return null;
  const vals = Object.values(p).map(Number).filter(Number.isFinite);
  if (vals.length < 2) return null;          // tek değerle "denk mi" denemez
  return Math.max(...vals);
}

/** Denk güç eşiği: en yüksek ihtimal bunun altındaysa net bir taraf yoktur. */
export const BALANCED_MAX_PERCENT = 45;

/**
 * Bülten maçlarından açılış kartı verisi üretir.
 * @returns {{
 *  strong: array, surprises: array, balanced: number, balancedMatches: array,
 *  startedCount: number, total: number
 * }}
 */
export function buildWeekSummary(matches, { strongMax = 3, surpriseMax = 3, now = Date.now() } = {}) {
  const ms = (matches || []).filter((m) => m && m.analysis);
  const open = ms.filter((m) => !startedNow(m, now));

  const strong = open
    .filter((m) => m.analysis.label === STRONG_KEY && m.analysis.favorite && m.analysis.favorite.percent != null)
    .sort((a, b) => (b.analysis.favorite.percent || 0) - (a.analysis.favorite.percent || 0))
    .slice(0, strongMax);

  const surprises = open
    .filter((m) => m.analysis.label === SURPRISE_KEY && m.analysis.surpriseScore != null)
    .sort((a, b) => b.analysis.surpriseScore - a.analysis.surpriseScore)
    .slice(0, surpriseMax);

  // Denk güç: ihtimallerin en yükseği eşiğin altındaysa net bir taraf yok demektir.
  // Sayı ve listenin AYNI süzgeçten doğması şart; ikisi ayrılırsa ekranda
  // "3 denk maç" yazıp 2 satır göstermek gibi bir tutarsızlık çıkar.
  const balancedMatches = open.filter((m) => {
    const t = topProbability(m);
    return t != null && t < BALANCED_MAX_PERCENT;
  });

  return {
    strong,
    surprises,
    balanced: balancedMatches.length,
    balancedMatches,
    startedCount: ms.length - open.length,
    total: ms.length,
  };
}

/**
 * Tek takımın görünecek adı. Uzundan kısaya düşer; hiçbiri yoksa '?' —
 * boş bırakmak yerine eksikliği GÖSTERİR.
 * Ayrı dışa açıldı: ekranlar armayı takımın KENDİ adının yanına koyuyor,
 * birleşik metin bunu imkânsız kılıyordu.
 */
export const takimAdi = (t) => t?.mediumName || t?.shortName || t?.name || '?';

/** Görselde kullanılacak kısa takım metni: "Ev - Deplasman". */
export function matchLine(m) {
  return `${takimAdi(m?.home)} - ${takimAdi(m?.away)}`;
}
