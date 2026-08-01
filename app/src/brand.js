// MARKA — TEK DOĞRULUK KAYNAĞI.
// Uygulamanın kullanıcıya görünen adı burada tanımlanır; hiçbir ekranda
// elle marka metni yazılmaz, hepsi buradan okunur. Ad değişirse tek dosya değişir.
//
// KURAL: Bu uygulama BAĞIMSIZDIR. Hiçbir kurum, bahis operatörü, oyun
// düzenleyicisi veya veri sağlayıcısı tarafından hazırlanmamış, desteklenmemiş,
// yetkilendirilmemiş veya onaylanmamıştır. Resmî kurum logoları, amblemleri ve
// başka uygulamaların simgeleri KULLANILMAZ.

export const APP_NAME = 'Sportoto Master Analiz';
export const APP_NAME_UPPER = 'SPORTOTO MASTER ANALİZ';

// Marka adının satır kırımlı / vurgulu gösterimi (splash, Ana Sayfa başlığı).
// ELLE YAZILMAZ: doğrudan APP_NAME'den türetilir. Böylece parçalı gösterim
// ile tam ad birbirinden ayrı düşemez; ad değişirse iki satır da değişir.
// Değişmez kural: BRAND_LINE_1 + ' ' + BRAND_LINE_2 === APP_NAME
const _BRAND_PARTS = APP_NAME.split(' ');
export const BRAND_LINE_1 = _BRAND_PARTS[0];
export const BRAND_LINE_2 = _BRAND_PARTS.slice(1).join(' ');

// Marka metnini ekranda parçalı yazan bileşenler için tek doğrulama noktası.
export function brandLinesJoin() {
  return `${BRAND_LINE_1} ${BRAND_LINE_2}`;
}

// Kısa tanım — mağaza metni ve uygulama içi "hakkında" ile birebir aynı olmalı.
export const APP_TAGLINE = '15 maçlık haftalık bültenler için bağımsız analiz ve tahmin destek uygulaması.';

// Telif satırı — biçim ve yıl SABİT.
export const COPYRIGHT = '© 2026 Sportoto Master Analiz';

// Bağımsızlık bildirimi — kullanıcıya görünen her yasal/paylaşım yüzeyinde geçer.
export const INDEPENDENCE_NOTICE =
  'Bu uygulama bağımsızdır; hiçbir kurum, operatör veya veri sağlayıcı tarafından hazırlanmamış, desteklenmemiş veya onaylanmamıştır.';

// Analiz dürüstlüğü bildirimi — paylaşılan her görselde ve sonuç ekranında geçer.
export const NO_GUARANTEE_NOTICE = 'Kesin sonuç veya kazanç vaadi değildir.';

// Resmî sonuç bildirimi.
export const OFFICIAL_RESULT_NOTICE =
  'Yalnız resmî 90 dakika sonucu kesindir; canlı ve geçici veriler kesin sayılmaz.';

// Uygulama sürümü — app.json içindeki "version" ile AYNI kalmalıdır.
export const APP_VERSION = '1.0.0';

// YASAL SAYFA YOLLARI — sunucu bunları statik HTML olarak servis eder
// (backend/legal/). Google Play, gizlilik politikasının ve hesap silme
// sayfasının uygulama KURULMADAN da açılabilmesini şart koşar.
export const PRIVACY_PATH = '/gizlilik';
export const DELETE_ACCOUNT_PATH = '/hesap-silme';

// TOPLULUK KURALLARI — kullanıcı içeriği (yorumlar) barındıran uygulamalarda
// Google Play, kuralların yazılı ve herkese açık olmasını ister. Yol,
// backend/src/server.js içindeki rotayla BİREBİR aynı olmak zorundadır;
// eşleşmeyi app/test/account-privacy.test.mjs ölçer.
export const COMMUNITY_RULES_PATH = '/topluluk-kurallari';

// Saf yardımcı: verilen sunucu adresinden yasal sayfa bağlantılarını üretir.
// Adres boşsa (web'de aynı origin) göreli yol döner; bu da doğru çalışır.
export function legalUrls(apiBase = '') {
  const base = String(apiBase || '').replace(/\/+$/, '');
  return {
    privacy: `${base}${PRIVACY_PATH}`,
    deleteAccount: `${base}${DELETE_ACCOUNT_PATH}`,
    rules: `${base}${COMMUNITY_RULES_PATH}`,
  };
}
