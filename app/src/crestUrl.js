// KULÜP ARMASI ADRESİ — dış adresi kendi sunucumuzun üstünden geçirir.
// (Saf modül: React yok, react-native yok → testten doğrudan import edilir.)
//
// NEDEN VAR: Arma adresleri dış bir kaynağa işaret ediyor. Tarayıcı o görseli
// EKRANDA sorunsuz çiziyor; ama "📸 Ekran görselini paylaş" karesine KOYAMIYOR.
// Sebebi: kareyi çıkaran kitaplık tuvale ancak "bu görseli okuyabilirsin" izni
// (CORS) veren bir kaynağı çizebiliyor. Dış kaynak bu izni vermeyince görseli
// HATA VERMEDEN düşürüyor. Paylaşılan bültende armaların boş çıkmasının sebebi
// buydu: nötr ⚽ bir YAZI karakteri olduğu için kareye giriyordu, gerçek
// armalar ise sessizce kayboluyordu.
//
// ÇÖZÜM: adres kendi sunucumuza çevrilir (/api/crest?u=…). Sunucu ile uygulama
// arasında bu izin zaten var, arma kareye giriyor.
//
// BU DOSYADA SAĞLAYICI ADI GEÇMEZ. Hangi dış konağın geçerli olduğuna sunucu
// karar verir (backend/src/crestProxy.js, varsayılan-ret). Uygulama tarafı
// yalnız "kendi sunucum değilse vekilden geçir" der; böylece marka adı
// istemci koduna sızmaz ve izinli konak listesi tek yerde durur.
//
// BOZMAMA KURALI: taban adres bilinmiyorsa ya da adres zaten yerel/gömülü ise
// adrese DOKUNULMAZ — bugün çalışan bir görsel bu dosya yüzünden kaybolmaz.

/** Sondaki eğik çizgileri atar: 'http://a:4000/' → 'http://a:4000' */
function tabanla(v) {
  return String(v == null ? '' : v).trim().replace(/\/+$/, '');
}

/**
 * Arma adresini paylaşılabilir (vekilden geçen) hâline çevirir.
 *
 * @param {string} uri      Backend'den gelen arma adresi (boş olabilir).
 * @param {string} apiBase  Kendi sunucumuzun kök adresi (config.API_BASE).
 * @returns {string} Kullanılacak adres; girdi boşsa ''.
 */
export function crestUrlOf(uri, apiBase) {
  const adres = String(uri == null ? '' : uri).trim();
  if (!adres) return '';
  // Zaten gömülü görsel (data:/blob:) — vekile gerek yok, tuvale de girer.
  if (/^(data:|blob:)/i.test(adres)) return adres;
  // Göreli adres zaten kendi kaynağımızdadır.
  if (!/^https?:\/\//i.test(adres)) return adres;

  const taban = tabanla(apiBase);
  if (!taban) return adres; // taban bilinmiyor — çalışan adresi bozma
  // Kendi sunucumuzsa olduğu gibi kalır (vekilin vekili olmaz).
  const kucuk = adres.toLowerCase();
  const tabanKucuk = taban.toLowerCase();
  if (kucuk === tabanKucuk || kucuk.startsWith(`${tabanKucuk}/`)) return adres;

  return `${taban}/api/crest?u=${encodeURIComponent(adres)}`;
}
