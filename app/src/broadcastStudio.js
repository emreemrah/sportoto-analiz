// YAYIN STÜDYOSU — saf mantık (React Native bağımlılığı YOK, testli).
//
// NEDEN VAR: Yayıncı canlı yayında 15 maçlık bülteni maç maç anlatır; her maçta
// radarları ve istatistikleri gösterir, 1-0-2 seçimini yapar ve sonunda kuponu
// kaydeder. Ekranların hepsi bu dosyadaki SAYILARI okur; hiçbir ekran kendi
// başına risk/dağılım hesabı yapmaz (yinelenen istatistik yasağı).
//
// KESİN KURALLAR (bu dosyanın var oluş şartı):
//  1) UYDURMA YOK. Bir bileşen için veri yoksa hesaba KATILMAZ ve "eksik"
//     listesine yazılır. Hiçbir sayı, olmayan veriden türetilmez.
//  2) Hiçbir çıktı "kesin/garanti/banko/yanılmaz/net favori" demez. Risk bir
//     OLASILIK YORUMU değil, seçimin genişliği ile maçın belirsizliğinin
//     ölçülebilir birleşimidir ve nasıl hesaplandığı ekranda yazılır.
//  3) KİŞİSEL VERİ YOK. Bu ekran canlı yayında on binlerce kişiye görünür;
//     fonksiyonlar yalnız bülten + yayıncının kendi seçimlerini alır.
//     Kullanıcı adı, e-posta, belirteç, puan veya başka kupon buraya giremez.
//  4) Yalnız resmî 90 dakika sonucu kesindir — bu dosya sonuç ÜRETMEZ.
//  5) Maç bazlı kilit tek kaynaktan (couponConfig) gelir, burada yeniden
//     yazılmaz.

import { OUTCOMES, isMatchLocked, columnCount, toOfficial } from './couponConfig';
import { analyzeUserMatch } from './userMatchEngine';
import { displayLabel } from './labels';

/* ————————————————————————————————————————————————————————————
   YATAY BÖLÜM ŞERİDİ — maç detayında sola kaydırılan sekmeler.
   SIRA KURALI: radarlar detaylı istatistikten ÖNCE gelir.
   Başlıklar radar kimlikleriyle eşleşir (backend/src/radar/config.js).
   ———————————————————————————————————————————————————————————— */
export const STUDIO_SECTIONS = [
  { key: 'liste', short: 'Sportoto Liste', title: 'Spor Toto Bülten Sırası', radarId: null },
  { key: 'performance', short: 'Rakip Gücü', title: 'Radar 1 · Rakip Gücü', radarId: 'performance' },
  { key: 'expectation', short: 'xG', title: 'Radar 2 · xG / Beklenti', radarId: 'expectation' },
  { key: 'publicBetting', short: 'Oynanma Oranı', title: 'Radar 3 · Oynanma DNA', radarId: 'publicBetting' },
  { key: 'market', short: 'Oran', title: 'Radar 4 · Oran Takibi', radarId: 'market' },
  { key: 'bulletinMemory', short: 'Bülten Sırası DNA', title: 'Radar 5 · Bülten DNA', radarId: 'bulletinMemory' },
  { key: 'istatistik', short: 'İstatistik', title: 'Detaylı İstatistik', radarId: null },
];

/** Radar kimliğinden bölüm anahtarı (ekranlar sabit dizmesin diye). */
export const sectionByKey = (key) => STUDIO_SECTIONS.find((s) => s.key === key) || null;

/* ————————————————————————————————————————————————————————————
   SEÇİM YARDIMCILARI
   ———————————————————————————————————————————————————————————— */

/** Seçimi kanonik sıraya sokar: her zaman 1 → X → 2. */
export function normalizeOutcomes(list) {
  return OUTCOMES.filter((o) => (list || []).includes(o));
}

/** Kutuya dokunma: varsa çıkarır, yoksa ekler. Sıra korunur. */
export function toggleOutcome(list, outcome) {
  const cur = normalizeOutcomes(list);
  return cur.includes(outcome)
    ? cur.filter((o) => o !== outcome)
    : normalizeOutcomes([...cur, outcome]);
}

/** Seçim genişliği: 0 (boş), 1 (tek), 2 (çift), 3 (kapalı). */
export const breadthOf = (list) => normalizeOutcomes(list).length;

/** Genişlik türü — final kupon ekranındaki tek-çift-kapalı dağılımının kaynağı. */
export function kindOf(list) {
  const n = breadthOf(list);
  return n === 1 ? 'tek' : n === 2 ? 'cift' : n === 3 ? 'kapali' : null;
}

export const KIND_LABEL = { tek: 'Tek', cift: 'Çift', kapali: 'Kapalı' };

/** Ekranda görünen işaret: veri anahtarındaki "0" beraberliktir → X yazılır. */
export const symbolText = (o) => String(o ?? '').replace('0', 'X');

/**
 * RESMÎ KOLON YAZIMI — Spor Toto kolonunda beraberlik "0" basılır ve yayıncı
 * ekranda "1-0-2" diye okur. Stüdyonun seçim kutuları bu yazımı gösterir;
 * uygulamanın diğer ekranları X yazmayı sürdürür.
 * DİKKAT: Depoda ve kuponda tutulan değer HER İKİ durumda da 'X'tir —
 * değişen yalnız ekranda görünen harftir.
 * Eşleme couponConfig'te ZATEN tanımlı; burada ikinci kez yazılmaz, dışa verilir.
 */
export const officialSymbol = toOfficial;

/**
 * Ham veriden gelen işareti STÜDYO YAZIMINA çevirir: önce kanonik hâle getirir
 * ('0' → 'X'), sonra resmî kolon yazımına ('X' → '0'). İki adım tek işlevde
 * durur; yoksa ekranın bir köşesinde "X", üç santim yanında "0" görünür.
 */
export const officialText = (o) => toOfficial(symbolText(o));

/* ————————————————————————————————————————————————————————————
   MAÇ BAŞLIĞI VE ZAMANI — hiçbiri uydurulmaz; yoksa null döner.
   ———————————————————————————————————————————————————————————— */

export function matchTitle(m) {
  const h = m?.home?.mediumName || m?.home?.name || null;
  const a = m?.away?.mediumName || m?.away?.name || null;
  if (!h && !a) return 'Maç adı bulunamadı';
  return `${h || '—'} - ${a || '—'}`;
}

const two = (n) => String(n).padStart(2, '0');
const GUNLER = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

/**
 * Satırdaki tarih ve saat. Veri yoksa alanlar null olur ve ekran
 * "tarih bulunamadı" yazar — sahte tarih üretilmez.
 */
export function dateParts(m) {
  const t = m?.date ? new Date(m.date).getTime() : NaN;
  if (Number.isNaN(t)) return { dateText: null, timeText: null, dayText: null, ms: null };
  const d = new Date(t);
  return {
    dateText: `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`,
    timeText: `${two(d.getHours())}:${two(d.getMinutes())}`,
    dayText: GUNLER[d.getDay()],
    ms: t,
  };
}

/* ————————————————————————————————————————————————————————————
   BELİRSİZLİK — maçın KENDİ özelliği (yayıncının seçiminden bağımsız).
   Yalnız GERÇEKTEN VAR OLAN bileşenlerin ortalamasıdır. Bileşen yoksa
   hesaba girmez ve "eksik" listesine yazılır; hiçbiri yoksa hasData=false.
   ———————————————————————————————————————————————————————————— */

const clamp100 = (n) => Math.max(0, Math.min(100, n));
const numOr = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Motorun okumasının NETLİĞİ maçın ne kadar okunabilir olduğunu söyler:
// motor tek tarafa yaklaşıyorsa okunabilir; üç sonuca da açıksa taraf seçemedi.
// Bu sayı yalnız risk hesabına girer — yayıncıya 1-0-2 olarak GÖSTERİLMEZ.
const ONERI_BELIRSIZLIK = { 1: 10, 2: 45, 3: 80 };

export function uncertaintyOf(m, radarMatch, userAnalysis) {
  const used = [];
  const missing = [];

  // 1) Motor okumasının netliği (app analiz motoru).
  const ua = userAnalysis || null;
  const main = ua?.verdict?.main || null;
  if (ua?.ok && main) {
    const w = main.replace(/[^12X]/g, '').length;
    if (ONERI_BELIRSIZLIK[w] != null) used.push({ key: 'oneri', label: 'Motor okumasının netliği', value: ONERI_BELIRSIZLIK[w] });
  } else {
    missing.push({ key: 'oneri', label: 'Motor okuması', reason: 'Puan/form/ortak rakip verisi bulunamadı' });
  }

  // 2) Sürpriz puanı (0-100) — bültendeki analizden.
  const sp = numOr(m?.analysis?.surpriseScore);
  if (sp != null) used.push({ key: 'surpriz', label: 'Sürpriz puanı', value: clamp100(sp) });
  else missing.push({ key: 'surpriz', label: 'Sürpriz puanı', reason: 'Bu veri bulunamadı' });

  // 3) Favori yüzdesi — favori ne kadar zayıfsa belirsizlik o kadar yüksektir.
  const fp = numOr(m?.analysis?.favorite?.percent);
  if (fp != null) used.push({ key: 'favori', label: 'En yüksek ihtimalin düşüklüğü', value: clamp100(100 - fp) });
  else missing.push({ key: 'favori', label: 'İhtimal dağılımı', reason: 'Bu veri bulunamadı' });

  // 4) Radar: favorinin yanılma riski (0-100).
  const ffr = numOr(radarMatch?.master?.favoriteFailureRisk);
  if (ffr != null) used.push({ key: 'radarRisk', label: 'Radar · favorinin yanılma riski', value: clamp100(ffr) });
  else missing.push({ key: 'radarRisk', label: 'Radar · favorinin yanılma riski', reason: 'Radar kaydı yok' });

  // 5) Radar: sürpriz DNA puanı (0-100).
  const dna = numOr(radarMatch?.master?.surpriseDnaScore);
  if (dna != null) used.push({ key: 'dna', label: 'Radar · sürpriz DNA', value: clamp100(dna) });
  else missing.push({ key: 'dna', label: 'Radar · sürpriz DNA', reason: 'Radar kaydı yok' });

  if (!used.length) {
    return { hasData: false, score: null, level: null, used, missing };
  }
  const score = Math.round(used.reduce((s, u) => s + u.value, 0) / used.length);
  return { hasData: true, score, level: levelOf(score), used, missing };
}

/** Ortak eşik sözlüğü — üç ayrı ekranda üç farklı eşik olmasın diye tek yerde. */
export const LEVEL_LOW_MAX = 30;
export const LEVEL_MID_MAX = 60;
export function levelOf(score) {
  if (score == null) return null;
  return score < LEVEL_LOW_MAX ? 'Düşük' : score < LEVEL_MID_MAX ? 'Orta' : 'Yüksek';
}

/* ————————————————————————————————————————————————————————————
   SATIR RİSKİ — belirsizliğin, yapılan seçimle KAPANMAYAN kısmı.
   Kapalı (1X2) seçim üç ihtimali de içerdiği için yön riski kalmaz;
   geriye yalnız kolon maliyeti kalır. Katsayılar ekranda açıkça yazılır.
   ———————————————————————————————————————————————————————————— */
export const COVERAGE_FACTOR = { tek: 1, cift: 0.55, kapali: 0.2 };
export const COVERAGE_TEXT = {
  tek: 'Tek işaret — belirsizliğin tamamı açıkta.',
  cift: 'Çift işaret — belirsizliğin yaklaşık yarısı kapanır.',
  kapali: 'Kapalı (1-X-2) — yön riski kalmaz, kolon sayısı artar.',
};

export function rowRisk(uncertainty, outcomes) {
  const kind = kindOf(outcomes);
  if (!kind) return { hasData: false, score: null, level: null, kind: null, note: 'Seçim yapılmadı.' };
  if (!uncertainty?.hasData) {
    return {
      hasData: false, score: null, level: null, kind,
      note: 'Bu maç için analiz verisi bulunamadı — risk hesaplanmadı.',
    };
  }
  const f = COVERAGE_FACTOR[kind];
  const score = Math.round(uncertainty.score * f);
  return { hasData: true, score, level: levelOf(score), kind, factor: f, note: COVERAGE_TEXT[kind] };
}

/* ————————————————————————————————————————————————————————————
   MOTOR OKUMASI — yayıncı modunun TAHMİNSİZ özeti.

   Motor burada 1-0-2 söylemez; yalnız ölçtüğü gözlemleri sıralar (puan farkı,
   iç/dış saha formu, ortak rakip kıyası, karşılıklı maçlar). Cümleler motorun
   kendi "fact" alanlarından olduğu gibi alınır — bu dosyada yeniden yorum
   yapılmaz, sayı hesaplanmaz. Kriterin "lean" (1-0-2'ye etkisi) alanı bilerek
   dışarıda bırakılır: yayıncının kararını yönlendirmemek için.
   ———————————————————————————————————————————————————————————— */

export function engineReadingOf(userAnalysis) {
  const ua = userAnalysis || null;
  const lines = [];
  const ekle = (c) => { if (c?.available && c.fact) lines.push(c.fact); };
  ekle(ua?.points);
  ekle(ua?.homeForm);
  ekle(ua?.awayForm);
  ekle(ua?.common);
  ekle(ua?.h2h);
  return {
    hasData: lines.length > 0,
    lines,
    // Veri yoksa boş kutu değil, GEREKÇE çizilir.
    reason: lines.length ? null : 'Puan durumu, form, ortak rakip ve karşılıklı maç verilerinin hiçbiri bu maç için bulunamadı.',
  };
}

/* ————————————————————————————————————————————————————————————
   SATIRLAR — ana bülten ekranının ve final kupon ekranının tek kaynağı.
   ———————————————————————————————————————————————————————————— */

/**
 * @param {object} p
 * @param {Array}  p.matches     bülten maçları (/api/bulletin → matches)
 * @param {object} [p.picks]     { maçNo: ['1','X'] } — yayıncının seçimleri
 * @param {object} [p.radarByNo] { maçNo: radarMatch } — /api/radar/:roundId matches
 * @param {object} [p.notes]     { maçNo: 'yayıncı notu' }
 * @param {number} [p.now]       şimdi (ms) — testten verilebilsin diye
 */
export function buildStudioRows({ matches, picks = {}, radarByNo = {}, notes = {}, now = Date.now() } = {}) {
  const list = Array.isArray(matches) ? matches : [];
  return list.map((m, i) => {
    const outcomes = normalizeOutcomes(picks?.[m?.no]);
    const ua = analyzeUserMatch(m);
    const radarMatch = radarByNo?.[m?.no] || null;
    const uncertainty = uncertaintyOf(m, radarMatch, ua);
    const risk = rowRisk(uncertainty, outcomes);
    const dp = dateParts(m);
    const locked = isMatchLocked(m, now);
    const note = typeof notes?.[m?.no] === 'string' ? notes[m.no] : '';
    return {
      // — kimlik ve satır bilgisi —
      no: m?.no ?? i + 1,
      order: i + 1,
      matchId: m?.sportotoMatchId ?? m?.footyMatchId ?? null,
      title: matchTitle(m),
      home: m?.home?.mediumName || m?.home?.name || null,
      away: m?.away?.mediumName || m?.away?.name || null,
      // Kulüp armaları — tabloda takım adının yanında çizilir. Yoksa null kalır
      // ve ekran nötr bir top simgesi koyar; sahte/yerine-geçen arma üretilmez.
      homeLogo: m?.home?.logo || null,
      awayLogo: m?.away?.logo || null,
      league: m?.league || null,
      ...dp,
      // — durum —
      locked,
      started: m?.started === true,
      // — seçim —
      outcomes,
      kind: kindOf(outcomes),
      hasPick: outcomes.length > 0,
      // — analiz (TAHMİNSİZ) —
      // Yayıncı modunda motor 1-0-2 ÖNERMEZ. Öneri/alternatif alanları satırda
      // bilerek YOKTUR: ekranda gösterilmesin diye gizlemek yetmez, veri hiç
      // taşınmazsa yanlışlıkla da çizilemez. Kararı yayıncı verir.
      reading: engineReadingOf(ua),
      dataConfidence: ua?.verdict?.dataConfidence || null,
      label: m?.analysis?.label ? displayLabel(m.analysis.label) : null,
      favorite: m?.analysis?.favorite || null,
      probabilities: m?.analysis?.probabilities || null,
      classification: radarMatch?.master?.classificationLabel || null,
      uncertainty,
      risk,
      note,
      hasRadar: !!radarMatch,
    };
  });
}

/* ————————————————————————————————————————————————————————————
   FİNAL KUPON EKRANI HESAPLARI
   ———————————————————————————————————————————————————————————— */

/** Tek-Çift-Kapalı dağılımı + boş satır sayısı. */
export function distributionOf(rows) {
  const d = { tek: 0, cift: 0, kapali: 0, bos: 0, total: (rows || []).length };
  for (const r of rows || []) {
    if (r.kind) d[r.kind] += 1; else d.bos += 1;
  }
  return d;
}

/** Kolon sayısı — kupon deposundaki kuralla AYNI fonksiyondan (couponConfig). */
export function columnsOf(rows) {
  return columnCount((rows || []).map((r) => ({ no: r.no, selectedOutcomes: r.outcomes })));
}

/**
 * TOPLAM RİSK — yalnız riski HESAPLANABİLEN satırların ortalaması.
 * Hesaplanamayan satırlar sayıyı bozmaz; kaç tanesinin dışarıda kaldığı
 * açıkça döner ve ekranda yazılır.
 */
export function totalRiskOf(rows) {
  const scored = (rows || []).filter((r) => r.risk?.hasData && r.risk.score != null);
  const noPick = (rows || []).filter((r) => !r.hasPick).length;
  const noData = (rows || []).filter((r) => r.hasPick && !r.risk?.hasData).length;
  if (!scored.length) {
    return {
      hasData: false, score: null, level: null,
      scoredCount: 0, noPick, noData,
      note: 'Risk hesaplanabilecek maç yok — seçim veya analiz verisi eksik.',
    };
  }
  const score = Math.round(scored.reduce((s, r) => s + r.risk.score, 0) / scored.length);
  const parcalar = [];
  if (noPick) parcalar.push(`${noPick} maçta seçim yok`);
  if (noData) parcalar.push(`${noData} maçta analiz verisi yok`);
  return {
    hasData: true,
    score,
    level: levelOf(score),
    scoredCount: scored.length,
    noPick,
    noData,
    note: parcalar.length
      ? `${scored.length} maç üzerinden hesaplandı — ${parcalar.join(', ')}; bu maçlar ortalamaya girmedi.`
      : `${scored.length} maç üzerinden hesaplandı.`,
  };
}

/** En riskli maçlar — gerçekten riskli olanlar; yoksa boş dizi (zorlanmaz). */
export function riskiestOf(rows, limit = 5) {
  return (rows || [])
    .filter((r) => r.risk?.hasData && r.risk.level !== 'Düşük')
    .sort((a, b) => (b.risk.score - a.risk.score) || (a.no - b.no))
    .slice(0, Math.max(0, limit));
}

/** Kaç maç seçildi, kupon tamam mı, kilitli mi. */
export function readinessOf(rows) {
  const total = (rows || []).length;
  const picked = (rows || []).filter((r) => r.hasPick).length;
  const lockedNos = (rows || []).filter((r) => r.locked).map((r) => r.no);
  const missingNos = (rows || []).filter((r) => !r.hasPick).map((r) => r.no);
  return {
    total,
    picked,
    missing: total - picked,
    missingNos,
    complete: total > 0 && picked === total,
    lockedNos,
    allLocked: total > 0 && lockedNos.length === total,
    anyLocked: lockedNos.length > 0,
  };
}

/** Sıradaki seçilmemiş maç — yayıncı "sıradaki maç" düğmesiyle ilerlesin. */
export function nextUnpicked(rows, fromNo = null) {
  const list = rows || [];
  const start = fromNo == null ? 0 : Math.max(0, list.findIndex((r) => r.no === fromNo) + 1);
  return list.slice(start).find((r) => !r.hasPick) || list.find((r) => !r.hasPick) || null;
}

/**
 * Kupon deposunun beklediği seçim biçimi — CouponEditorScreen ile BİREBİR aynı
 * ({ no, selectedOutcomes }). Biçim burada ikinci kez tanımlanmaz, kopyalanır.
 */
export function toSelections(rows) {
  return (rows || []).map((r) => ({ no: r.no, selectedOutcomes: r.outcomes }));
}

/* ————————————————————————————————————————————————————————————
   RİSK YORUMU — maç detayındaki cümle. Yalnız hesaplanan sayıları
   açıklar; tahmin veya vaat cümlesi kurmaz.
   ———————————————————————————————————————————————————————————— */
export function riskCommentary(row) {
  if (!row) return '';
  const u = row.uncertainty;
  if (!u?.hasData) {
    return 'Bu maç için belirsizlik ölçülemedi: motor okuması, sürpriz puanı, ihtimal dağılımı ve radar kayıtlarının hiçbiri bulunamadı. Sayı uydurulmaz — bu satır risk ortalamasına katılmaz.';
  }
  const kaynak = `${u.used.length} veri kaynağının ortalaması (${u.used.map((x) => x.label.toLowerCase()).join(', ')})`;
  const eksik = u.missing.length ? ` Hesaba girmeyen ${u.missing.length} kaynak var: ${u.missing.map((x) => x.label.toLowerCase()).join(', ')}.` : '';
  if (!row.hasPick) {
    return `Maçın belirsizliği ${u.score}/100 (${u.level}) — ${kaynak}.${eksik} Seçim yapılmadığı için satır riski henüz hesaplanmadı.`;
  }
  const k = row.risk;
  return `Maçın belirsizliği ${u.score}/100 (${u.level}) — ${kaynak}.${eksik} ` +
    `${COVERAGE_TEXT[k.kind]} Bu seçimle satır riski ${k.score}/100 (${k.level}).`;
}

/* ————————————————————————————————————————————————————————————
   YATAY ŞERİDİN İÇERİĞİ — her bölümün verisi BURADA hazırlanır.
   Ekran yalnız çizer; hiçbir sayıyı kendisi hesaplamaz. Veri yoksa
   bölüm "hasData:false" ve bir GEREKÇE ile döner — boş kutu çizilmez.
   ———————————————————————————————————————————————————————————— */

/** Radar nesnesini ekranın anlayacağı sabit şekle çevirir (radar içine ekran girmez). */
export function radarViewOf(radarMatch, radarId) {
  const r = radarMatch?.radars?.[radarId] || null;
  if (!r) {
    return {
      hasData: false, name: null, status: 'no_record',
      reason: 'Bu maç için bu radarın kaydı yok.',
      scores: null, direction: null, dataQuality: null, failureRisk: null,
      lines: [], missing: [], note: null, publicDna: null,
    };
  }
  // Radar 1 her maç için aynı çekirdek satırları üretir; diğerlerinde
  // olumlu/olumsuz sinyallerin ilk üçü yeter (yayında ekran taşmasın).
  const lines = radarId === 'performance'
    ? (r.details?.coreLines?.length
      ? r.details.coreLines
      : [...(r.positives || []).slice(0, 2), ...(r.negatives || []).slice(0, 2)])
    : [...(r.positives || []), ...(r.negatives || [])].slice(0, 3);
  // 'unsupported' eksikler tekrar tekrar yazılmaz — yapısal olarak sağlanmıyor.
  const missing = (r.missingSignals || [])
    .filter((s) => s?.availability !== 'unsupported')
    .map((s) => s?.label)
    .filter(Boolean);
  const has = r.hasData === true;
  return {
    hasData: has,
    name: r.name || null,
    status: r.status || null,
    reason: has
      ? null
      : (r.status === 'no_source' ? 'Veri kaynağı bekleniyor.' : 'Bu maçta veri yetersiz.'),
    scores: (has && numOr(r.homeScore) != null)
      ? { '1': r.homeScore, X: r.drawScore, '2': r.awayScore }
      : null,
    direction: r.direction || null,
    dataQuality: numOr(r.dataQuality),
    failureRisk: numOr(r.favoriteFailureRisk),
    lines: lines.filter(Boolean),
    missing,
    note: r.note || null,
    publicDna: radarId === 'publicBetting' ? (r.details?.playedDna || null) : null,
  };
}

/**
 * "Spor Toto Bülten Sırası" bölümü — maçın bültendeki YERİ ve resmî kimliği.
 * Sıra numarası uydurulmaz; bültenden gelir.
 */
export function listViewOf(row, radarMatch) {
  const memory = radarMatch?.radars?.bulletinMemory || null;
  return {
    no: row?.no ?? null,
    order: row?.order ?? null,
    title: row?.title || null,
    league: row?.league || null,
    dateText: row?.dateText || null,
    timeText: row?.timeText || null,
    dayText: row?.dayText || null,
    locked: !!row?.locked,
    label: row?.label || null,
    classification: row?.classification || null,
    // Bültendeki sıranın geçmişi Radar 5'in konusu; burada yalnız var/yok denir.
    positionNote: memory?.hasData
      ? (memory.positives?.[0] || memory.negatives?.[0] || null)
      : null,
    positionReason: memory?.hasData ? null : 'Bülten sırası geçmişi bu maç için hesaplanmadı.',
  };
}

const oran1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

/** Bir takımın puan durumu satırı — eksik alan uydurulmaz, null kalır. */
function standingView(t) {
  const s = t?.standing || null;
  if (!s) return null;
  return {
    position: numOr(s.position), played: numOr(s.played),
    wins: numOr(s.wins), draws: numOr(s.draws), losses: numOr(s.losses),
    goalsFor: numOr(s.goalsFor), goalsAgainst: numOr(s.goalsAgainst),
    goalDiff: numOr(s.goalDiff), points: numOr(s.points),
  };
}

/**
 * "Detaylı İstatistik" bölümü. Karşılaştırma satırları backend'in HAZIR
 * `stats.compare` dizisinden gelir — aynı sayı ikinci kez hesaplanmaz.
 */
export function statsViewOf(m) {
  const s = m?.stats || null;
  const home = standingView(s?.home);
  const away = standingView(s?.away);
  const compare = Array.isArray(s?.compare)
    ? s.compare.filter((r) => r && (numOr(r.home) != null || numOr(r.away) != null))
    : [];
  const h2h = s?.h2h && numOr(s.h2h.played) ? s.h2h : null;
  const xg = {
    homeFor: oran1(s?.home?.season?.xgFor), homeAgainst: oran1(s?.home?.season?.xgAgainst),
    awayFor: oran1(s?.away?.season?.xgFor), awayAgainst: oran1(s?.away?.season?.xgAgainst),
  };
  const hasXg = Object.values(xg).some((v) => v != null);
  const form = {
    home: Array.isArray(s?.home?.last5) ? s.home.last5 : [],
    homeVenue: Array.isArray(s?.home?.last5venue) ? s.home.last5venue : [],
    away: Array.isArray(s?.away?.last5) ? s.away.last5 : [],
    awayVenue: Array.isArray(s?.away?.last5venue) ? s.away.last5venue : [],
  };
  const hasForm = Object.values(form).some((v) => v.length > 0);
  const hasData = !!(home || away || compare.length || h2h || hasXg || hasForm);
  return {
    hasData,
    reason: hasData ? null : 'Bu maç için istatistik verisi bulunamadı.',
    standing: home || away ? { home, away } : null,
    compare,
    h2h,
    xg: hasXg ? xg : null,
    form: hasForm ? form : null,
  };
}

/**
 * Şeritteki bölümlerin DURUMU — hangi sekmede veri var, hangisinde yok.
 * Yayıncı sekmeye dokunmadan önce boş olduğunu görür; yayında boşluk olmaz.
 */
export function sectionStates(row, m, radarMatch) {
  return STUDIO_SECTIONS.map((s) => {
    if (s.key === 'liste') return { ...s, hasData: true };
    if (s.key === 'istatistik') return { ...s, hasData: statsViewOf(m).hasData };
    return { ...s, hasData: radarViewOf(radarMatch, s.radarId).hasData };
  });
}

// NOT: Eskiden burada agreementOf() vardı — yayıncının seçimini motorun
// önerisiyle karşılaştırıp "aynı / daha dar / ayrılıyor" derdi. Motor artık
// yayıncı modunda 1-0-2 önermediği için karşılaştıracak bir öneri yok; üstelik
// "seçimin öneriyle aynı" cümlesi öneriyi dolaylı olarak ele veriyordu.
// Kaldırıldı; yerine bir şey konmadı — karar yayıncınındır.
