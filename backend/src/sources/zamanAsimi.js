// DIŞ SERVİS ÇAĞRILARI İÇİN ZAMAN AŞIMI.
//
// NEDEN VAR: veri kaynaklarının (footystats, sportoto, apifootball) hiçbirinde
// zaman aşımı yoktu — düz `await fetch(url)`. Karşı taraf yanıt vermeyi
// keserse (bağlantı açık kalır ama veri gelmez) istek SÜRESİZ bekler:
//
//   * yenileme turu hiç bitmez, bir sonraki tur da başlayamaz,
//   * kullanıcı ekranı "yükleniyor"da asılı kalır,
//   * sorun loglarda hata olarak da görünmez — yalnız sessizlik vardır.
//
// Sağlayıcı adaptörlerinde (nesine/misli) bu koruma zaten vardı; kaynak
// dosyalarında yoktu. Aynı kural her yerde geçerli olmalı.
//
// TASARIM: `fetch` ile aynı imza, tek fark zaman aşımı. Böylece çağrı yerleri
// değişmiyor, yalnız `fetch` → `zamanAsimliFetch` oluyor.

/** Varsayılan üst süre. Ağır uçlar (sezon maçları) için bilinçli olarak geniş. */
export const VARSAYILAN_SURE_MS = 20_000;

/**
 * Zaman aşımlı fetch. Süre dolarsa istek iptal edilir ve ANLAŞILIR bir hata
 * fırlatılır — sessizce takılmaktansa dürüst hata yeğdir.
 *
 * @param {string} url
 * @param {object} [init]                fetch seçenekleri
 * @param {number} [init.sureMs]         üst süre (varsayılan 20 sn)
 */
export async function zamanAsimliFetch(url, init = {}) {
  const { sureMs = VARSAYILAN_SURE_MS, signal: disSignal, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), sureMs);
  // Çağıran kendi iptal sinyalini verdiyse ona da bağlanılır (ikisinden biri
  // tetiklenince istek düşer).
  const disIptal = () => ctrl.abort();
  if (disSignal) {
    if (disSignal.aborted) ctrl.abort();
    else disSignal.addEventListener('abort', disIptal, { once: true });
  }
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } catch (e) {
    // AbortError'ı ne olduğu belli bir mesaja çeviriyoruz: "aborted" tek başına
    // logda hiçbir şey anlatmıyor.
    if (e?.name === 'AbortError') {
      throw new Error(`Kaynak ${Math.round(sureMs / 1000)} sn içinde yanıt vermedi — istek iptal edildi.`);
    }
    throw e;
  } finally {
    clearTimeout(t);
    if (disSignal) disSignal.removeEventListener?.('abort', disIptal);
  }
}
