// YAYIN STÜDYOSU · KARNE MANTIĞI — geçmiş haftanın "ne oldu, kaç tuttu" hesabı.
//
// NE İŞE YARAR: Yayıncı bir sonraki hafta yayın yaparken geçmiş haftaya bakar:
// hangi maçta ne işaretledim, resmî sonuç ne çıktı, 15'te kaç tuttum, o hafta
// resmî ikramiye ne oldu, haftalar toplamında durum ne. Bu dosya o soruların
// SAF hesabıdır: JSX yok, ağ çağrısı yok, depo çağrısı yok. Veri dışarıdan
// verilir, sonuç geri döner — bu yüzden birim testle ölçülebilir.
//
// KESİN KURALLAR (proje sözleşmesi):
//  • YALNIZ RESMÎ SPOR TOTO SONUCU KESİNDİR. Canlı/geçici (provisional) skor
//    başarıya YAZILMAZ; "tuttu" sayısına girmez, yalnız "bekliyor" sayılır.
//  • UYDURMA YOK: seçim yoksa "seçim yok" denir, yanlış sayılmaz. Sonuç yoksa
//    "resmî sonuç bekleniyor" denir, tutmadı sayılmaz. Oran/yüzde uydurulmaz.
//  • Başarı yüzdesi YALNIZ hem seçimi hem resmî sonucu olan maçlar üzerinden
//    hesaplanır ve kaç maç üzerinden hesaplandığı her zaman birlikte döner.
//  • İkramiye tutarları resmî veriden gelir; burada tutar hesaplanmaz, yalnız
//    biçimlendirilir. Kolon bedeli/maliyet bu dosyada YOKTUR (uydurulamaz).
//  • Kişisel veri girmez: yalnız hafta kimliği, maç numarası, işaret ve sonuç.

import { normalizeOutcomes, kindOf, KIND_LABEL, officialText, matchTitle, dateParts } from './broadcastStudio';

/* ————————————————————————— BİÇİM ————————————————————————— */

const group = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Türkçe para biçimi (Intl'siz) — 14679456.58 → "₺14.679.456,58". Yoksa "–". */
export function fmtTL(n) {
  if (n == null || !Number.isFinite(Number(n))) return '–';
  const [int, dec] = Number(n).toFixed(2).split('.');
  return `₺${group(int)},${dec}`;
}

/** Kişi sayısı — 2563 → "2.563". Yoksa "–". */
export function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '–';
  return group(Math.round(Number(n)));
}

/* ————————————————————— RESMÎ SONUÇ ————————————————————— */

/**
 * Maçın RESMÎ sonucu var mı? Spor Toto sonucu ancak hem 1/X/2 hem skor
 * geldiğinde kesindir. Tek başına skor (canlı yansıma) YETMEZ.
 */
export const isOfficial = (m) => !!(m && m.result && m.score
  && m.score.home != null && m.score.away != null);

/** Resmî 1/X/2 — resmî değilse null. Geçici skordan sonuç TÜRETİLMEZ. */
export const officialResultOf = (m) => (isOfficial(m) ? String(m.result) : null);

/** "2 - 1" — resmî değilse null. */
export const officialScoreOf = (m) => (isOfficial(m) ? `${m.score.home} - ${m.score.away}` : null);

/**
 * Maç oynanmış ama resmî sonuç gelmemiş olabilir. O durumda ekranda
 * "resmî sonuç bekleniyor" yazılır; geçici skor KESİN sayılmaz.
 * Geçici skor yalnız BİLGİ olarak döner ve karneye asla girmez.
 */
export function provisionalOf(m) {
  const p = m?.provisional;
  if (!p || !p.score || p.score.home == null || p.score.away == null) return null;
  return { text: `${p.score.home} - ${p.score.away}`, live: !!p.live, finished: !!p.finished };
}

/**
 * Seçim resmî sonucu tuttu mu?
 * true = tuttu, false = tutmadı, null = seçim veya resmî sonuç yok (sayılmaz).
 */
export function pickHitsOfficial(outcomes, official) {
  const sec = normalizeOutcomes(outcomes);
  if (!sec.length || !official) return null;
  return sec.includes(String(official));
}

/* ————————————————————— MAÇ MAÇ KARNE ————————————————————— */

/** Satır durumu — ekranın renk/simge seçtiği tek alan. */
export const KARNE_DURUM = {
  tuttu: 'tuttu',
  tutmadi: 'tutmadi',
  bekliyor: 'bekliyor',     // resmî sonuç yok
  secimYok: 'secimYok',     // yayıncı işaret koymamış
};

export const KARNE_DURUM_TEXT = {
  tuttu: 'Tuttu',
  tutmadi: 'Tutmadı',
  bekliyor: 'Resmî sonuç bekleniyor',
  secimYok: 'Seçim yapılmadı',
};

/**
 * Dar tablo hücresine SIĞAN kısa etiket. Uzun metin hücrede "Resmî sonuç
 * beklen…" diye kırpılıyordu; kırpılmış bir durum etiketi yanlış okunabilir.
 * Kısası hücrede yazılır, TAM metin ekran okuyucuya ve özet paneline gider —
 * yani kısaltma bilgi saklamaz, yalnız yeri daraltır.
 */
export const KARNE_DURUM_KISA = {
  tuttu: 'Tuttu',
  tutmadi: 'Tutmadı',
  bekliyor: 'Bekleniyor',
  secimYok: 'Seçim yok',
};

/**
 * Geçmiş haftanın maç maç karnesi.
 * @param {object[]} matches  /api/history/:roundId maç listesi (resmî veri)
 * @param {object}   picks    o haftanın yayın seçimleri { maçNo: ['1','X'] }
 * @returns {object[]} satırlar — ekran bunları olduğu gibi çizer, hesap yapmaz.
 */
export function buildKarneRows({ matches, picks = {} } = {}) {
  const list = Array.isArray(matches) ? matches : [];
  return list.map((m, i) => {
    const no = m?.no ?? i + 1;
    const outcomes = normalizeOutcomes(picks?.[no]);
    const official = officialResultOf(m);
    const hit = pickHitsOfficial(outcomes, official);
    const dp = dateParts(m);

    let durum;
    if (!outcomes.length) durum = KARNE_DURUM.secimYok;
    else if (!official) durum = KARNE_DURUM.bekliyor;
    else durum = hit ? KARNE_DURUM.tuttu : KARNE_DURUM.tutmadi;

    return {
      no,
      order: i + 1,
      title: matchTitle(m),
      home: m?.home?.mediumName || m?.home?.name || null,
      away: m?.away?.mediumName || m?.away?.name || null,
      homeLogo: m?.home?.logo || null,
      awayLogo: m?.away?.logo || null,
      league: m?.league || null,
      dateText: dp.dateText,
      timeText: dp.timeText,
      dayText: dp.dayText,
      // — yayıncının o hafta ne dediği —
      outcomes,
      kind: kindOf(outcomes),
      kindText: kindOf(outcomes) ? KIND_LABEL[kindOf(outcomes)] : null,
      pickText: outcomes.length ? outcomes.map((o) => officialText(o)).join(' · ') : null,
      // — resmen ne olduğu —
      official,                                   // '1' | 'X' | '2' | null
      officialText: official ? officialText(official) : null,
      scoreText: officialScoreOf(m),
      provisional: provisionalOf(m),              // yalnız bilgi; karneye girmez
      // — karşılaştırma —
      hit,                                        // true | false | null
      durum,
      durumText: KARNE_DURUM_TEXT[durum],
      durumKisa: KARNE_DURUM_KISA[durum],
    };
  });
}

/**
 * Haftanın özeti: "15'te kaç tuttu".
 * Yüzde YALNIZ hem seçimi hem resmî sonucu olan maçlar üzerinden hesaplanır;
 * kaç maç üzerinden hesaplandığı `sayilan` alanında birlikte döner ki ekran
 * "9/15" ile "9/11" arasındaki farkı gizleyemesin.
 */
export function karneSummaryOf(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const tuttu = list.filter((r) => r.durum === KARNE_DURUM.tuttu).length;
  const tutmadi = list.filter((r) => r.durum === KARNE_DURUM.tutmadi).length;
  const bekliyor = list.filter((r) => r.durum === KARNE_DURUM.bekliyor).length;
  const secimYok = list.filter((r) => r.durum === KARNE_DURUM.secimYok).length;
  const sayilan = tuttu + tutmadi;
  const resmiGelen = list.filter((r) => r.official != null).length;

  // GENİŞLİK KIRILIMI — sayının neyi ölçtüğünü saklamamak için.
  // 1-0-2'nin üçü de işaretliyse (kapalı) maç sonuç ne olursa olsun "tuttu"
  // sayılır. Bu bilgi gizlenirse karne olduğundan iyi görünür.
  const sayilanlar = list.filter((r) => r.durum === KARNE_DURUM.tuttu || r.durum === KARNE_DURUM.tutmadi);
  const kirilimi = (kind) => {
    const alt = sayilanlar.filter((r) => r.kind === kind);
    return { sayilan: alt.length, tuttu: alt.filter((r) => r.durum === KARNE_DURUM.tuttu).length };
  };
  const kindKirilim = { tek: kirilimi('tek'), cift: kirilimi('cift'), kapali: kirilimi('kapali') };

  return {
    total,
    tuttu,
    tutmadi,
    bekliyor,
    secimYok,
    sayilan,                                   // yüzdenin paydası
    resmiGelen,                                // resmî sonucu gelen maç sayısı
    tamamlandi: total > 0 && resmiGelen === total,
    kindKirilim,
    // Ekranın aynen yazacağı uyarı — kapalı maç varsa sayı bunu içerir.
    kapaliNot: kindKirilim.kapali.sayilan
      ? `${kindKirilim.kapali.sayilan} maçta 1-0-2'nin üçü de işaretliydi; bu maçlar sonuç ne olursa olsun tutmuş sayılır.`
      : null,
    // "15'te 9" — payda HER ZAMAN bültendeki maç sayısıdır; eksik olanlar
    // ayrıca yazılır, böylece sayı olduğundan iyi görünmez.
    skorText: total ? `${total}'te ${tuttu}` : '—',
    yuzde: sayilan ? Math.round((tuttu / sayilan) * 100) : null,
    // Ekranın altına aynen yazılacak dürüstlük satırı.
    not: sayilan
      ? `${sayilan} maç üzerinden${bekliyor ? ` · ${bekliyor} maçın resmî sonucu bekleniyor` : ''}${secimYok ? ` · ${secimYok} maçta seçim yok` : ''}`
      : 'Karne hesaplanamadı — bu haftada hem seçimi hem resmî sonucu olan maç yok.',
  };
}

/* ————————————————————— İKRAMİYE TABLOSU ————————————————————— */

/**
 * Resmî ikramiye tablosu satırları (15/14/13/12 bilen).
 * Tutar UYDURULMAZ: yalnız gelen sayı biçimlendirilir. Kişi sayısı 0 ise
 * resmî tabloda olduğu gibi "DEVRETTİ" yazılır.
 */
export function prizeRowsOf(prize) {
  const tiers = Array.isArray(prize?.tiers) ? prize.tiers : [];
  if (!tiers.length) return [];
  return tiers.map((t) => {
    const devretti = t?.count === 0;
    return {
      hit: t?.hit ?? null,
      hitText: t?.hit != null ? `${t.hit} Bilen` : '—',
      count: t?.count ?? null,
      countText: devretti ? 'Çıkmadı' : fmtCount(t?.count),
      prize: t?.prize ?? null,
      prizeText: devretti ? 'DEVRETTİ' : fmtTL(t?.prize),
      devretti,
    };
  });
}

/** İkramiye verisi geldi mi? Gelmemişse ekran "bekleniyor" der, sıfır yazmaz. */
export const hasPrize = (prize) => prizeRowsOf(prize).length > 0;

/* ————————————————— HAFTALAR ARASI BİRİKİMLİ KARNE ————————————————— */

/**
 * Birden çok haftanın özetini toplar.
 * @param {object[]} weeks [{ roundId, summary }] — summary = karneSummaryOf çıktısı
 *
 * Ortalama, hafta ortalamalarının ortalaması DEĞİL, toplam tuttu / toplam
 * sayılan maçtır: az maçı sayılan bir hafta ortalamayı orantısız çekmesin.
 */
export function cumulativeOf(weeks) {
  const list = (Array.isArray(weeks) ? weeks : []).filter((w) => w?.summary);
  const hafta = list.length;
  const tuttu = list.reduce((s, w) => s + (w.summary.tuttu || 0), 0);
  const sayilan = list.reduce((s, w) => s + (w.summary.sayilan || 0), 0);
  const bekliyor = list.reduce((s, w) => s + (w.summary.bekliyor || 0), 0);
  const secimYok = list.reduce((s, w) => s + (w.summary.secimYok || 0), 0);
  const tamHafta = list.filter((w) => w.summary.tamamlandi).length;
  // Kapalı (1X2) maçlar toplamda da ayrıca yazılır — haftalık karnede söylenen
  // uyarı birikimli karnede kaybolmasın.
  const kapaliSayilan = list.reduce((s, w) => s + (w.summary.kindKirilim?.kapali?.sayilan || 0), 0);

  // En iyi hafta — yalnız SAYILAN maçı olan haftalar arasından; boş hafta
  // "en iyi" olamaz. Eşitlikte daha çok maçı sayılan hafta öne geçer.
  const puanli = list.filter((w) => w.summary.sayilan > 0);
  let enIyi = null;
  for (const w of puanli) {
    if (!enIyi
      || w.summary.tuttu > enIyi.summary.tuttu
      || (w.summary.tuttu === enIyi.summary.tuttu && w.summary.sayilan > enIyi.summary.sayilan)) {
      enIyi = w;
    }
  }

  return {
    hafta,
    tamHafta,
    tuttu,
    sayilan,
    bekliyor,
    secimYok,
    kapaliSayilan,
    kapaliNot: kapaliSayilan
      ? `${kapaliSayilan} maçta 1-0-2'nin üçü de işaretliydi; bu maçlar sonuç ne olursa olsun tutmuş sayılır.`
      : null,
    yuzde: sayilan ? Math.round((tuttu / sayilan) * 100) : null,
    ortalama: puanli.length ? Math.round((tuttu / puanli.length) * 10) / 10 : null,
    enIyi: enIyi ? { roundId: enIyi.roundId, skorText: enIyi.summary.skorText } : null,
    not: sayilan
      ? `${hafta} hafta · ${sayilan} maç üzerinden${bekliyor ? ` · ${bekliyor} maç resmî sonuç bekliyor` : ''}`
      : 'Henüz karne oluşacak veri yok — seçim yapılmış ve resmî sonucu gelmiş maç bulunmuyor.',
  };
}
