// RESMÎ LİSTE GÖRÜNÜMÜ — saf biçimlendirme (RN'siz test edilebilir).
//
// Amaç: haftanın bültenini RESMÎ SİTEDEKİ düzenle göstermek —
// Sıra · Maç · Maç Günü · Maç Saati · Skor · Sonuç, altında da
// 15/14/13/12 Bilen, Kapanış ve Açıklamalar.
//
// KURALLAR:
//  * Sayı UYDURULMAZ. Skor/sonuç/ikramiye gelmemişse resmî sitedeki gibi
//    "----" yazılır; sıfır yazmak "hiç kimse bilemedi" diye okunur, oysa
//    doğru ifade "henüz açıklanmadı"dır.
//  * Beraberlik resmî yazımda "0"dır (X değil) — bu ekran resmî düzeni
//    taklit ettiği için resmî yazımı kullanır.
//  * Tarih/saat cihazın yerel saatine göre DEĞİL, bültendeki zamana göre
//    yazılır; kullanıcı maç saatini resmî listeyle aynı görmeli.
// Uzantı AÇIK yazılıyor: node:test (npm test) uzantısız çözemiyor, Metro ve
// Jest ise açık uzantıyı zaten kabul ediyor. Beraberliğin "0" yazımı tek
// kaynaktan gelsin diye kopyalamak yerine içe aktarılıyor.
import { toOfficial } from './couponConfig.js';

export const BOS = '----';

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const iki = (n) => String(n).padStart(2, '0');

// ⚠ BOŞ DEĞER TUZAĞI — bu projede üçüncü kez çıktı, o yüzden tek yerde:
//   new Date(null)  → 01.01.1970 (GEÇERLİ bir tarih!)
//   Number(null)    → 0          (GEÇERLİ bir sayı!)
// Yani "veri yok" durumu, kontrol edilmezse ekrana 1970 ya da 0 diye düşer —
// tam da bu ürünün yasakladığı şey: bilinmeyeni bir değer gibi göstermek.
// Bu yüzden Date/Number'a girmeden ÖNCE boşluk elenir.
const bosMu = (v) => v == null || v === '' || (typeof v === 'string' && !v.trim());

/** Boş olmayan girdiden geçerli Date; aksi hâlde null. */
function tarihOf(v) {
  if (bosMu(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "09.08.2026-Pazar" — resmî listedeki biçim. */
export function macGunu(iso) {
  const d = tarihOf(iso);
  if (!d) return BOS;
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}-${GUNLER[d.getDay()]}`;
}

/** "17:00" */
export function macSaati(iso) {
  const d = tarihOf(iso);
  if (!d) return BOS;
  return `${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

/** "2-1" · sonuç yoksa "–" (resmî listede tire). */
export function skorMetni(m) {
  const s = m?.score;
  if (!s || s.home == null || s.away == null) return '–';
  return `${s.home}-${s.away}`;
}

/** "1" | "0" | "2" · sonuç yoksa "–". Beraberlik RESMÎ yazımda 0'dır. */
export function sonucMetni(m) {
  return m?.result ? toOfficial(m.result) : '–';
}

/** "08 Ağustos Cumartesi 2026 14:55" — resmî listedeki kapanış biçimi. */
export function kapanisMetni(iso) {
  const d = tarihOf(iso);
  if (!d) return BOS;
  return `${iki(d.getDate())} ${AYLAR[d.getMonth()]} ${GUNLER[d.getDay()]} ${d.getFullYear()} `
    + `${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

/** Para biçimi: 1234567.5 → "1.234.567,50 TL" */
export function tlMetni(v) {
  if (bosMu(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const [tam, kurus] = n.toFixed(2).split('.');
  return `${tam.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${kurus} TL`;
}

/**
 * "15 Bilen … 12 Bilen" satırları.
 *
 * Kazanan sayısı ve kişi başı ikramiye AYRI bilgilerdir; ikisi de varsa
 * birlikte yazılır ("3 kişi · 1.234,50 TL"). Yalnız biri varsa yalnız o
 * yazılır — eksik olanı 0 ile doldurmak yanlış olurdu.
 *
 * Hiç veri yoksa resmî sitedeki gibi "----".
 */
export function kademeSatirlari(prize) {
  const tiers = prize?.tiers || [];
  return [15, 14, 13, 12].map((hit) => {
    const row = tiers.find((t) => Number(t.hit) === hit);
    const adet = Number(row?.count);
    const tutar = tlMetni(row?.prize);
    const parcalar = [];
    if (Number.isFinite(adet) && adet >= 0) parcalar.push(`${adet} kişi`);
    if (tutar) parcalar.push(tutar);
    return {
      etiket: `${hit} Bilen`,
      deger: parcalar.length ? parcalar.join(' · ') : BOS,
      // Kazanan YOKSA (0 kişi) bu bir bilgidir, boşluk değil — devreden var demektir.
      bos: parcalar.length === 0,
    };
  });
}

/** Alt bilgi satırları: Kapanış ve Açıklamalar. */
export function altSatirlar(prize, closeDate) {
  return [
    { etiket: 'Kapanış', deger: kapanisMetni(prize?.closeDate || closeDate) },
    { etiket: 'Açıklamalar', deger: prize?.description || BOS },
  ];
}

/**
 * Hafta seçici için sezon ve hafta listeleri.
 * `/api/rounds` yanıtı: { currentRoundId, rounds: [{id,name,year,closeDate}] }
 * En yeni hafta ÜSTTE olur — kullanıcı önce güncel haftayı arar.
 */
export function haftaSecenekleri(rounds, sezon = null) {
  const hepsi = rounds?.rounds || [];
  const sezonlar = [...new Set(hepsi.map((r) => r.year).filter((y) => y != null))]
    .sort((a, b) => b - a);
  const secili = sezon ?? sezonlar[0] ?? null;
  const haftalar = hepsi
    .filter((r) => secili == null || r.year === secili)
    .slice()
    .sort((a, b) => Number(b.id) - Number(a.id));
  return { sezonlar, seciliSezon: secili, haftalar };
}

/** "2025/2026 Sezonu" — resmî sitedeki yazım (yıl aralığı). */
export function sezonMetni(year) {
  if (bosMu(year)) return BOS;
  const y = Number(year);
  if (!Number.isFinite(y)) return BOS;
  return `${y - 1}/${y} Sezonu`;
}
