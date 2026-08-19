// ERTELENEN MAÇ TESPİTİ + NOTER KARARI BEKLEYENLER — SAF MODÜL
//
// NEDEN VAR (kullanıcı tıkanması, 19 Ağustos 2026): her ertelenen maçta aynı
// senaryo yaşanıyordu — hafta "kesinleşmemiş" kalıyor, noter kararını girecek
// operatöre HİÇBİR ŞEY hatırlatmıyordu (uç vardı ama panelde ne arayüzü ne de
// bekleyen iş listesi vardı; curl gerekiyordu). Bu modül arşivdeki kilitli
// haftalardan "resmî sonucu gelmeyen + programı bitmiş" maçları çıkarır;
// /api/admin/ozet bunları "noter kararı bekleyen" olarak panele taşır.
//
// TESPİT ÇIKARIMDIR, resmî bir alan DEĞİLDİR: resmî Spor Toto ucu ertelenen
// maçı hâlâ "upcoming" verir; erteleme yalnız TARİHİN haftanın kalanından
// kopmasıyla belli olur. Eşik ve kural Flutter'daki tek tanımın eşidir
// (flutter/lib/core/erteleme.dart) — eşik değişirse İKİSİ BİRDEN değişmeli.
//
// DÜRÜSTLÜK: burada hiçbir sonuç üretilmez/uydurulmaz; yalnız "şu maçın resmî
// sonucu yok ve haftanın programı bitti" gerçeği raporlanır. Karar girişi
// ayrı, operatörlü ve audit'li uçtan yapılır (recordNotaryResult).

/// Flutter eşi: kErtelemeEsigiGun (lib/core/erteleme.dart). Ölçümle seçildi:
/// normal maçlar ilk maçtan 0,0–3,0 gün sonra; ertelenen 13,0 gün sonra.
export const ERTELEME_ESIGI_GUN = 7;

/// Haftanın "programı bitti" payı: normal takvimin son maçından bu kadar
/// saat geçtiyse artık gelecek resmî sonuç, gecikmiş yayın değil eksik
/// sonuçtur. 24 saat: resmî sonuçlar maç gecesi/ertesi sabah yayımlanır.
export const PROGRAM_BITTI_PAYI_SAAT = 24;

const GUN_MS = 24 * 60 * 60 * 1000;

function anMs(v) {
  if (v == null) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/// [kickoffAt], haftanın ilk maçından ERTELEME_ESIGI_GUN gün ve daha fazla
/// sonraya mı kalmış? (Karşılaştırma İLK maça göredir; birden fazla maç
/// ertelenirse hepsi yakalanır.)
export function ertelendiMi(kickoffAt, ilkKickoffAt) {
  const t = anMs(kickoffAt);
  const ilk = anMs(ilkKickoffAt);
  if (t == null || ilk == null) return false;
  return Math.floor((t - ilk) / GUN_MS) >= ERTELEME_ESIGI_GUN;
}

/**
 * Kilitli bir haftanın NOTER KARARI BEKLEYEN maçları.
 *
 * matches: arşiv biçimi [{ orderNo, homeName, awayName, kickoffAt, matchId }]
 * results: listOfficialResults çıktısı (resmî sonucu OLAN satırlar — noter
 *          kararı dahil; karar girilmiş maç artık BEKLEMEZ).
 *
 * Kural: haftanın NORMAL programı (ertelenmemiş maçların sonuncusu +
 * PROGRAM_BITTI_PAYI_SAAT) geçmeden hiçbir şey "bekliyor" sayılmaz — aktif
 * hafta ortasında yanlış alarm üretilmez. Program bittiyse resmî sonucu
 * olmayan HER maç listelenir; ertelenenler `ertelendi: true` ile işaretlenir
 * (sonucu hiç yayımlanmayan maç da operatörün görmesi gereken bir iştir).
 */
export function noterBekleyenMaclar(matches, results, now = Date.now()) {
  const ms = Array.isArray(matches) ? matches : [];
  if (!ms.length) return [];

  let ilk = null;
  for (const m of ms) {
    const t = anMs(m?.kickoffAt);
    if (t != null && (ilk == null || t < ilk)) ilk = t;
  }
  if (ilk == null) return [];

  // Normal programın son maçı — ertelenenler pencereyi UZATAMAZ, yoksa
  // ertelenen maçın yeni tarihi geçene dek hafta "bekliyor" görünmezdi.
  let sonNormal = null;
  for (const m of ms) {
    const t = anMs(m?.kickoffAt);
    if (t == null || ertelendiMi(t, ilk)) continue;
    if (sonNormal == null || t > sonNormal) sonNormal = t;
  }
  if (sonNormal == null) return [];
  if (now <= sonNormal + PROGRAM_BITTI_PAYI_SAAT * 60 * 60 * 1000) return [];

  const sonuclu = new Set();
  for (const r of Array.isArray(results) ? results : []) {
    if (r?.orderNo != null) sonuclu.add(Number(r.orderNo));
  }

  return ms
    .filter((m) => m?.orderNo != null && !sonuclu.has(Number(m.orderNo)))
    .map((m) => ({
      orderNo: Number(m.orderNo),
      ev: m.homeName || null,
      dep: m.awayName || null,
      tarih: m.kickoffAt || null,
      ertelendi: ertelendiMi(m.kickoffAt, ilk),
    }))
    .sort((a, b) => a.orderNo - b.orderNo);
}
