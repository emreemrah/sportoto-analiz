// CİHAZDAKİ YEREL VERİ — anahtar listesi ve temizleme (saf modül, RN bağımlılığı YOK).
//
// Bu anahtarlar cihazda tutulan oturum, tercih ve kupon taslaklarıdır; sunucuya
// gönderilmezler. Hesap SİLİNDİKTEN SONRA cihazda iz kalmaması için temizlenir.
//
// KESİN KURAL: Anahtar adları DEĞİŞTİRİLEMEZ. Adı değişen bir anahtar,
// kullanıcının mevcut verisini erişilemez hâle getirir (yetim veri).

export const LOCAL_KEYS = [
  'sportoto.token',                  // oturum belirteci
  'sportoto.refresh',                // oturum yenileme anahtarı
  'sportoto.session',                // sunucu oturum kimliği
  'sportoto.prefs',                  // ekran tercihleri
  'sportoto.coupons.v1',             // eski kupon deposu
  'sportoto.couponCenter.v1',        // kupon merkezi
  'sportoto.couponCenterDraft.v1',   // kupon taslağı
  // Kriter seçme sistemi 2026-08-07'de kaldırıldı. Anahtarlar listede KALIYOR:
  // eski sürümden kalan veriyi hesap silme / çıkış akışında temizlemek gerekir.
  'sportoto.analysisProfiles.v2',    // (kaldırıldı) analiz profilleri
  'sportoto.analysisProfile.v1',     // (kaldırıldı) eski tekil analiz profili
  'sportoto.notifications.v1',       // bildirim merkezi durumu (okunmuşlar)
  'sportoto.push.v1',                // telefon bildirimi tercihi (aç/kapa + kaç dk önce)
];
// Not: 'sportoto.device' bilerek listede DEĞİL — rastgele, kişisel veri
// içermeyen cihaz kimliğidir; mobilde SecureStore temizliği auth.logout()
// içindeki clearPersisted() ile yapılır (SecureStore bu modülden erişilemez).

/**
 * Yerel verileri temizler. Depolar dışarıdan verilir (test edilebilirlik için).
 * Bir deponun hata vermesi diğerini engellemez; hangi anahtarların silindiği
 * dürüstçe döndürülür.
 *
 * @param {object} deps
 * @param {{removeItem:Function}} [deps.localStore]  senkron depo (localStorage)
 * @param {{multiRemove?:Function, removeItem?:Function}} [deps.asyncStore]  AsyncStorage
 * @returns {Promise<{cleared:string[], failed:string[]}>}
 */
export async function wipeLocalData({ localStore, asyncStore } = {}) {
  const cleared = [];
  const failed = [];

  for (const key of LOCAL_KEYS) {
    let ok = false;
    if (localStore && typeof localStore.removeItem === 'function') {
      try { localStore.removeItem(key); ok = true; } catch { /* diğer depoya devam */ }
    }
    if (asyncStore && typeof asyncStore.removeItem === 'function') {
      try { await asyncStore.removeItem(key); ok = true; } catch { /* aşağıda raporlanır */ }
    }
    (ok ? cleared : failed).push(key);
  }

  return { cleared, failed };
}
