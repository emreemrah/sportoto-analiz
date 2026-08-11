// KAYNAK: app/src/brand.js — BİREBİR çeviri.
//
// MARKA — TEK DOĞRULUK KAYNAĞI.
// Uygulamanın kullanıcıya görünen adı burada tanımlanır; hiçbir ekranda elle
// marka metni yazılmaz, hepsi buradan okunur. Ad değişirse tek dosya değişir.
//
// KURAL: Bu uygulama BAĞIMSIZDIR. Hiçbir kurum, bahis operatörü, oyun
// düzenleyicisi veya veri sağlayıcısı tarafından hazırlanmamış, desteklenmemiş,
// yetkilendirilmemiş veya onaylanmamıştır. Resmî kurum logoları, amblemleri ve
// başka uygulamaların simgeleri KULLANILMAZ.

const String kAppName = 'Sportoto Master Analiz';
const String kAppNameUpper = 'SPORTOTO MASTER ANALİZ';

// Marka adının satır kırımlı / vurgulu gösterimi (splash, Ana Sayfa başlığı).
// ELLE YAZILMAZ: doğrudan kAppName'den türetilir. Böylece parçalı gösterim ile
// tam ad birbirinden ayrı düşemez; ad değişirse iki satır da değişir.
// Değişmez kural: kBrandLine1 + ' ' + kBrandLine2 == kAppName
final List<String> _brandParts = kAppName.split(' ');
final String kBrandLine1 = _brandParts.first;
final String kBrandLine2 = _brandParts.skip(1).join(' ');

/// Marka metnini ekranda parçalı yazan bileşenler için tek doğrulama noktası.
String brandLinesJoin() => '$kBrandLine1 $kBrandLine2';

/// Kısa tanım — mağaza metni ve uygulama içi "hakkında" ile birebir aynı olmalı.
const String kAppTagline =
    '15 maçlık haftalık bültenler için bağımsız analiz ve tahmin destek uygulaması.';

/// Telif satırı — biçim ve yıl SABİT.
const String kCopyright = '© 2026 Sportoto Master Analiz';

/// Bağımsızlık bildirimi — kullanıcıya görünen her yasal/paylaşım yüzeyinde geçer.
const String kIndependenceNotice =
    'Bu uygulama bağımsızdır; hiçbir kurum, operatör veya veri sağlayıcı '
    'tarafından hazırlanmamış, desteklenmemiş veya onaylanmamıştır.';

/// Analiz dürüstlüğü bildirimi — paylaşılan her görselde ve sonuç ekranında geçer.
const String kNoGuaranteeNotice = 'Kesin sonuç veya kazanç vaadi değildir.';

// DESTEK HATTI UYGULAMA İÇİNDEN KALDIRILDI (kullanıcı kararı, 2 Ağustos 2026).
// Sabit KORUNUYOR ama boş: geriye dönük içe aktarmalar kırılmasın ve geri
// getirilmek istendiğinde tek satır yetsin diye. Alt satır bu değer boşken
// numarayı da "Destek:" ibaresini de HİÇ yazmaz.
const String kSupportHelpline = '';

/// BİRLEŞİK YASAL ALT SATIR — 18+ ibaresi taşıyan her ekran/paylaşım yüzeyi bu
/// SABİTİ kullanır; elle "18+ · ..." yazılmaz. Tek kaynak: metin değişirse tek
/// satır değişir, 7 kopya birbirinden ayrı düşmez.
final String kLegalFooter = [
  '18+',
  kNoGuaranteeNotice,
  if (kSupportHelpline.isNotEmpty) 'Destek: $kSupportHelpline',
].join(' · ');

/// Resmî sonuç bildirimi.
const String kOfficialResultNotice =
    'Yalnız resmî 90 dakika sonucu kesindir; canlı ve geçici veriler kesin '
    'sayılmaz.';

/// Uygulama sürümü — pubspec.yaml içindeki "version" ile AYNI kalmalıdır.
const String kAppVersion = '1.0.0';

// YASAL SAYFA YOLLARI — sunucu bunları statik HTML olarak servis eder
// (backend/legal/). Google Play, gizlilik politikasının ve hesap silme
// sayfasının uygulama KURULMADAN da açılabilmesini şart koşar.
const String kPrivacyPath = '/gizlilik';
const String kDeleteAccountPath = '/hesap-silme';

/// TOPLULUK KURALLARI — kullanıcı içeriği (yorumlar) barındıran uygulamalarda
/// Google Play, kuralların yazılı ve herkese açık olmasını ister. Yol,
/// backend/src/server.js içindeki rotayla BİREBİR aynı olmak zorundadır.
const String kCommunityRulesPath = '/topluluk-kurallari';

/// SORUMLU OYUN — "kazanç garantisi değildir" beyanını taşıyan yasal sayfa.
/// Yol, backend/src/server.js içindeki rotayla BİREBİR aynı olmak zorundadır.
const String kResponsibleGamingPath = '/sorumlu-oyun';

class LegalUrls {
  const LegalUrls({
    required this.privacy,
    required this.deleteAccount,
    required this.rules,
    required this.responsibleGaming,
  });

  final String privacy;
  final String deleteAccount;
  final String rules;
  final String responsibleGaming;
}

/// Saf yardımcı: verilen sunucu adresinden yasal sayfa bağlantılarını üretir.
/// Adres boşsa (web'de aynı origin) göreli yol döner; bu da doğru çalışır.
LegalUrls legalUrls([String apiBase = '']) {
  final base = apiBase.replaceAll(RegExp(r'\/+$'), '');
  return LegalUrls(
    privacy: '$base$kPrivacyPath',
    deleteAccount: '$base$kDeleteAccountPath',
    rules: '$base$kCommunityRulesPath',
    responsibleGaming: '$base$kResponsibleGamingPath',
  );
}
