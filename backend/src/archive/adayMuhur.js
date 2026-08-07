// ---------------------------------------------------------------------------
// ADAY MÜHÜR — haftanın kaybolmasına karşı ön-taahhüt (2026-08-08)
// ---------------------------------------------------------------------------
// SORUN (kullanıcı: "1 hafta eksik olursa proje komple çöp olur"):
// Mühür, ilk maçtan 5 dakika önce atılıyor. O dakikada backend çalışmıyorsa
// hafta başarı karnesine ASLA giremez ve geri dönüşü yoktur. 51. hafta tam
// olarak böyle kaybedildi. Yani bütün arşivin ayakta kalması, tek bir makinenin
// TEK BİR DAKİKADA açık olmasına bağlıydı. Bu kırılgan bir tasarımdır.
//
// ÇÖZÜM: maç saatinden saatler önce, düzenli aralıklarla bültenin o anki hâli
// diske "aday mühür" olarak yazılır. Gerçek mühür anında sunucu ayaktaysa
// normal akış çalışır ve aday çöpe gider. Sunucu o an kapalıysa ve maçlar
// başladıysa, SON aday mühür resmî mühre terfi ettirilir.
//
// ═══════════════ BU NEDEN DÜRÜSTLÜĞÜ BOZMAZ ═══════════════════════════════
// Terfi ettirilen kayıt UYDURULMAZ. Aday mühür:
//   • maç BAŞLAMADAN önce oluşturulmuştur (capturedAt < ilk maç),
//   • o andaki gerçek bülten verisini taşır,
//   • terfide `now = capturedAt` verilir → snapshot'ın `lockedAt`'i o an olur.
// Yani "maç öncesi tahmin" iddiası gerçektir; yalnız diske yazıldığı an ile
// veritabanına işlendiği an farklıdır. Bu fark kayıtta AÇIKÇA durur
// (`trigger: 'aday-muhur'`), gizlenmez.
//
// ASLA YAPILMAYAN: ilk maç başladıktan SONRA yakalanmış bir aday terfi
// ETTİRİLMEZ. O kayıt geçmişi bilerek yazılmış olurdu ve karneyi yalan yapardı.

import { load, save } from '../cache.js';

/** Aday mühür, ilk maça bu süreden az kaldığında toplanmaya başlar. */
export const ADAY_PENCERE_MS = 8 * 60 * 60 * 1000;      // 8 saat

/** İki aday yazımı arasındaki en az süre (disk ve CPU boşa yorulmasın). */
export const ADAY_ARALIK_MS = 10 * 60 * 1000;           // 10 dakika

const ANAHTAR = 'adayMuhur';

/** Kayıtlı adayı okur; yoksa null. */
export function adayOku() {
  const k = load(ANAHTAR);
  return k?.data || null;
}

/** Adayı siler (mühür atıldıktan sonra tutmanın anlamı yok). */
export function adaySil() {
  save(ANAHTAR, null);
}

/**
 * Aday mühür yazılmalı mı? Saf karar — yan etkisi yok.
 *
 * @param {object} p
 *   ilkMacMs  ilk maç başlangıcı (ms)
 *   now       şimdi (ms)
 *   mevcut    kayıtlı aday (varsa)
 *   roundId   güncel bülten turu
 */
export function adayYazilmali({ ilkMacMs, now, mevcut, roundId }) {
  if (!Number.isFinite(ilkMacMs) || roundId == null) return false;
  if (now >= ilkMacMs) return false;                    // maç başladı — artık yazılmaz
  if (ilkMacMs - now > ADAY_PENCERE_MS) return false;   // daha çok var
  if (!mevcut || String(mevcut.roundId) !== String(roundId)) return true;
  return now - (mevcut.capturedAtMs ?? 0) >= ADAY_ARALIK_MS;
}

/**
 * Adayı diske yazar. `data` o anki bülten verisidir.
 * Not: veri büyüktür; bu yüzden `adayYazilmali` ile seyrek çağrılır.
 */
export function adayYaz({ data, now, roundId }) {
  save(ANAHTAR, {
    roundId: String(roundId),
    capturedAtMs: now,
    capturedAt: new Date(now).toISOString(),
    data,
  });
}

/**
 * Aday terfi ettirilebilir mi? Saf karar.
 *
 * KURALLAR (hepsi zorunlu):
 *  • aday var ve güncel turla aynı,
 *  • yakalandığı an İLK MAÇTAN ÖNCE,
 *  • henüz mühür yok.
 * Aksi hâlde `null` döner ve sebebi yazılır — sessiz geçilmez.
 */
export function terfiKarari({ aday, roundId, ilkMacMs, muhurVar }) {
  if (muhurVar) return { terfi: false, sebep: 'zaten_muhurlu' };
  if (!aday) return { terfi: false, sebep: 'aday_yok' };
  if (String(aday.roundId) !== String(roundId)) return { terfi: false, sebep: 'baska_hafta' };
  if (!Number.isFinite(ilkMacMs)) return { terfi: false, sebep: 'ilk_mac_bilinmiyor' };
  if (!Number.isFinite(aday.capturedAtMs)) return { terfi: false, sebep: 'zaman_yok' };
  if (aday.capturedAtMs >= ilkMacMs) return { terfi: false, sebep: 'mac_sonrasi_yakalanmis' };
  return { terfi: true, sebep: null, lockedAtMs: aday.capturedAtMs };
}
