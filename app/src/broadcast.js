// YAYIN MODU — SLAYT ÜRETİMİ (saf modül, React Native bağımlılığı YOK).
//
// AMAÇ: Yayıncının canlı yayında ekrana aldığı, OBS kadrajında uzaktan okunan
// koyu ve büyük puntolu slaytları GERÇEK bülten verisinden üretmek. Yayıncı
// segmenti ("bu hafta 3 güçlü aday var") tek ekranda, kaydırmadan anlatılabilsin.
//
// KESİN KURALLAR (bu dosyanın var oluş şartı):
//  1) Her slayt gerçek analiz verisinden doğar. Aday UYDURULMAZ; analizli maç
//     yoksa hiç slayt üretilmez (boş dizi dürüst sonuçtur).
//  2) Başlamış maç aday gösterilmez — kural weekSummary.js ile AYNI kaynaktan
//     gelir, burada ikinci kez yazılmaz (yinelenen istatistik yasağı).
//  3) İddialı dil yok: "kesin/garanti/banko/yanılmaz/net favori" geçmez.
//     Etiketler labels.js sözlüğünden geçirilir.
//  4) Sayılar tek kaynaktan (buildWeekSummary) okunur; slaytta yeniden sayılmaz.
//  5) KİŞİSEL VERİ YOK. Bu ekran canlı yayında on binlerce kişiye GÖRÜNÜR.
//     Fonksiyon yalnız bülteni alır; kullanıcı adı, e-posta, belirteç, kupon
//     veya puan bilgisi slayta hiçbir yoldan giremez.

import { buildWeekSummary, matchLine, topProbability } from './weekSummary';
import { displayLabel } from './labels';
import { NO_GUARANTEE_NOTICE, OFFICIAL_RESULT_NOTICE } from './brand';

/** Veri anahtarındaki "0" beraberlik demektir; ekranda X yazılır. */
const sym = (s) => String(s ?? '').replace('0', 'X');

/** Hafta başlığı: gerçek alanlardan; hiçbiri yoksa null (uydurulmaz). */
function haftaBasligi(bulletin) {
  if (bulletin?.weekNumber != null) return `${bulletin.weekNumber}. Hafta`;
  if (typeof bulletin?.round === 'string' && bulletin.round.trim()) return bulletin.round.trim();
  if (bulletin?.round && typeof bulletin.round === 'object' && bulletin.round.name) return bulletin.round.name;
  return null;
}

function strongRow(m) {
  const fav = m.analysis.favorite;
  return {
    no: m.no,
    teams: matchLine(m),
    pick: sym(fav.symbol),
    percent: fav.percent,
    sub: `${displayLabel(m.analysis.label)} · Sürpriz puanı ${m.analysis.surpriseScore ?? '—'}`,
    tone: 'good',
  };
}

function surpriseRow(m) {
  const fav = m.analysis.favorite;
  return {
    no: m.no,
    teams: matchLine(m),
    pick: fav ? sym(fav.symbol) : null,
    percent: fav ? fav.percent : null,
    // Sürpriz slaytında yüzde "favori" diye değil, ZAYIFLIK kanıtı olarak okunur.
    sub: fav
      ? `${displayLabel(m.analysis.label)} · en yüksek ihtimal yalnız %${fav.percent}`
      : displayLabel(m.analysis.label),
    badge: `Sürpriz ${m.analysis.surpriseScore}`,
    tone: 'bad',
  };
}

function balancedRow(m) {
  const t = topProbability(m);
  return {
    no: m.no,
    teams: matchLine(m),
    pick: null,
    percent: null,
    sub: t != null ? `En yüksek ihtimal yalnız %${Math.round(t)}` : 'Taraflar denk görünüyor',
    badge: 'Denk',
    tone: 'warn',
  };
}

/**
 * Bültenden yayın slaytları üretir.
 *
 * @param {object} bulletin  /api/bulletin cevabı: { matches, weekNumber, season, difficulty }
 * @param {object} [opts]
 * @param {number} [opts.now] şu an (ms) — dışarıdan verilir ki test edilebilsin
 * @returns {Array} slayt dizisi; analizli maç yoksa BOŞ dizi
 */
export function buildBroadcastSlides(bulletin, { now = Date.now() } = {}) {
  const matches = Array.isArray(bulletin?.matches) ? bulletin.matches : [];
  const sum = buildWeekSummary(matches, { now });

  // Analizli maç yoksa yayın slaytı da yoktur. Boş slayt gösterilmez.
  if (!sum.total) return [];

  const baslik = haftaBasligi(bulletin);
  const altBaslik = [bulletin?.season ? `${bulletin.season} Sezonu` : null, `${sum.total} maç`]
    .filter(Boolean).join(' · ');

  const slides = [];

  // 1 — AÇILIŞ: hafta, zorluk ve sayı şeridi.
  slides.push({
    key: 'intro',
    kind: 'intro',
    kicker: 'HAFTAYA BAKIŞ',
    title: baslik || 'Güncel Bülten',
    subtitle: altBaslik,
    difficulty: bulletin?.difficulty || null,
    stats: [
      { n: sum.total, label: 'Maç', tone: 'neutral' },
      { n: sum.strong.length, label: 'Güçlü Aday', tone: 'good' },
      { n: sum.surprises.length, label: 'Sürpriz Adayı', tone: 'bad' },
      { n: sum.balanced, label: 'Denk Güç', tone: 'warn' },
    ],
    rows: [],
  });

  // 2 — GÜÇLÜ ADAYLAR. Aday yoksa slayt yine durur: "aday yok" da gerçek bir
  //     haberdir ve yayıncının anlatacağı bilgidir; ama liste uydurulmaz.
  slides.push({
    key: 'strong',
    kind: 'list',
    kicker: 'GÜÇLÜ ADAYLAR',
    title: sum.strong.length
      ? `${sum.strong.length} maç güçlü aday olarak işaretlendi`
      : 'Bu hafta güçlü aday çıkmadı',
    rows: sum.strong.map(strongRow),
    // "Temkinli bir hafta." CÜMLESİ KALDIRILDI (yayıncı isteği: "sistem
    // güvenli riskli vs yazmasın"). Aday çıkmadığını söylemek GERÇEK; haftaya
    // temkinli demek ise bir HÜKÜMDÜR ve onu yayıncı verir.
    emptyText: 'Analiz hiçbir maçta yeterince güçlü koşul görmedi — zorla aday üretilmez.',
    note: sum.startedCount > 0
      ? `${sum.startedCount} maç başladığı için aday listelerinde gösterilmiyor.`
      : null,
  });

  // 3 — SÜRPRİZ ADAYLARI.
  slides.push({
    key: 'surprise',
    kind: 'list',
    kicker: 'SÜRPRİZE AÇIK MAÇLAR',
    title: sum.surprises.length
      ? `${sum.surprises.length} maçta sürpriz ihtimali öne çıkıyor`
      : 'Sürprize açık maç işareti yok',
    rows: sum.surprises.map(surpriseRow),
    emptyText: 'Bu hafta sürpriz puanı öne çıkan maç bulunmadı.',
    note: null,
  });

  // 4 — DENK GÜÇ: yalnız gerçekten varsa. Sıfır maçlık slayt yayında ölü zamandır.
  if (sum.balancedMatches.length) {
    slides.push({
      key: 'balanced',
      kind: 'list',
      kicker: 'DENK GÜÇ',
      title: `${sum.balancedMatches.length} maçta taraflar denk görünüyor`,
      rows: sum.balancedMatches.map(balancedRow),
      emptyText: null,
      note: 'Denk güç, analiz hiçbir tarafa belirgin üstünlük vermediğinde işaretlenir.',
    });
  }

  // 5 — KAPANIŞ: yasal ve dürüstlük notları. Metinler marka dosyasındaki
  //     tek kaynaktan gelir; burada elle yazılmaz.
  slides.push({
    key: 'outro',
    kind: 'outro',
    kicker: 'KAPANIŞ',
    title: 'Bu uygulama analiz ve karar desteği sunar',
    lines: [
      OFFICIAL_RESULT_NOTICE,
      NO_GUARANTEE_NOTICE,
      '18 yaş altı kullanamaz.',
    ],
    rows: [],
  });

  return slides;
}

/** Slayt gezinmesi: sınırların dışına taşmaz (yayında kaza ile boş ekran olmasın). */
export function clampIndex(i, len) {
  if (!Number.isFinite(i) || !len) return 0;
  return Math.max(0, Math.min(len - 1, Math.trunc(i)));
}

// Yayın modu punto ölçekleri. Yayın varsayılanı 1 DEĞİLDİR: bu ekran zaten
// uzaktan okunmak için vardır, en küçük kademe bile normal ekrandan büyüktür.
export const SCALES = [1, 1.25, 1.55];
export const DEFAULT_SCALE_INDEX = 1;
