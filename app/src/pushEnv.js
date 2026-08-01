// TELEFON BİLDİRİMİ — ORTAM VE YETENEK SINIFLANDIRMASI (SAF MODÜL)
//
// React Native bağımlılığı YOKTUR (pushPlanner.js ile aynı gerekçe): node
// testlerinde doğrudan çalıştırılabilsin diye. Burada `Platform` import
// EDİLMEZ; platform adı dışarıdan verilir.
//
// NEDEN AYRI BİR DOSYA — GERÇEK HATA BURADAN ÇIKTI:
//   Eski kod "destekleniyor mu?" sorusunu tek satırda yanıtlıyordu:
//       return !isWeb && !!Notifications;
//   ve `require('expo-notifications')` hatası sessizce yutuluyordu. Gerçek
//   Android telefonda paket kurulu olmasına rağmen bu import PATLAYABİLİYOR
//   (expo-notifications'ın barrel dosyası, YEREL bildirimle ilgisi olmayan
//   uzak-push modüllerini de modül gövdesinde yüklüyor; Expo Go içinde bu
//   yerli modüller kayıtlı değil ve `requireNativeModule` hata fırlatıyor).
//   Sonuç: gerçek telefon "web" gibi görünüyor ve ekranda "Tarayıcıda telefon
//   bildirimi kurulamaz." yazıyordu. YANLIŞ TEŞHİS.
//
// KESİN KURALLAR:
//  1) Karar YALNIZ iki gerçeğe dayanır: (a) gerçek platform, (b) yerel bildirim
//     API'sinin elde olup olmadığı. Expo Go, `appOwnership`, geliştirme modu ya
//     da config plugin durumu TEK BAŞINA "desteklenmiyor" gerekçesi DEĞİLDİR ve
//     bu dosyaya girdi olarak bile alınmaz.
//  2) Modül yükleme hatası sessizce "tarayıcı" mesajına dönüşmez; gerçek
//     teknik durum ayrıştırılır ve hata metni saklanır.
//  3) Çalışan bir modül, önceki bir yükleme hatasını geçersiz kılar: barrel
//     patlayıp parçalı yükleme başardıysa durum HAZIR'dır (hata yalnız uyarı
//     olarak taşınır) — çünkü kullanıcı için önemli olan bildirimin kurulması.
//  4) Uydurma yok: "hazır" demek için gereken işlevlerin gerçekten fonksiyon
//     olduğu tek tek doğrulanır.

/** Ortamın ayrıştırılmış hâlleri. */
export const DURUM = {
  WEB: 'web',                 // gerçekten tarayıcı → yerel bildirim yok
  HAZIR: 'hazir',             // yerel bildirim API'si elde, kurulabilir
  MODUL_YOK: 'modul-yok',     // paket bulunamadı (kurulu değil)
  MODUL_HATA: 'modul-hata',   // paket var ama yüklenirken hata verdi
  API_EKSIK: 'api-eksik',     // modül yüklendi ama gereken işlevler yok
};

/** Yerel bildirim için ZORUNLU işlevler — biri yoksa "hazır" denemez. */
export const GEREKLI_API = [
  'getPermissionsAsync',
  'requestPermissionsAsync',
  'scheduleNotificationAsync',
  'cancelScheduledNotificationAsync',
  'getAllScheduledNotificationsAsync',
];

/**
 * Olsa iyi olur ama olmadan da bildirim kurulabilir:
 *  - setNotificationChannelAsync : yalnız Android kanalı (yoksa sistem
 *    varsayılan kanalı kullanılır)
 *  - setNotificationHandler      : uygulama açıkken banner davranışı
 *  - addNotificationResponseReceivedListener : bildirime dokununca yönlendirme
 */
export const SECMELI_API = [
  'setNotificationChannelAsync',
  'setNotificationHandler',
  'addNotificationResponseReceivedListener',
];

function hataMetni(e) {
  if (!e) return '';
  if (typeof e === 'string') return e.trim();
  const m = e?.message != null ? String(e.message) : String(e);
  return m.trim();
}

function eksikOlanlar(modul, liste) {
  const eksik = [];
  for (const ad of liste) {
    if (typeof modul?.[ad] !== 'function') eksik.push(ad);
  }
  return eksik;
}

/**
 * Ortamı sınıflandırır.
 *
 * @param {object} g
 * @param {string} [g.platformOS]     'web' | 'android' | 'ios' | ...
 * @param {object} [g.modul]          yüklenebilmiş bildirim API'si (ya da null)
 * @param {Error|string} [g.yuklemeHatasi] modül yüklenemediyse GERÇEK hata
 * @param {string} [g.kaynak]         'paket' (tek parça) | 'parcali' (yedek yol)
 * @returns {{durum:string, destek:boolean, platform:string, eksik:string[],
 *           eksikSecmeli:string[], teknik:string, uyari:string, kaynak:string}}
 */
export function ortamiSinifla({
  platformOS = '',
  modul = null,
  yuklemeHatasi = null,
  kaynak = '',
} = {}) {
  const platform = String(platformOS || '').toLowerCase();
  const teknikHata = hataMetni(yuklemeHatasi);

  const temel = {
    durum: DURUM.MODUL_YOK,
    destek: false,
    platform,
    eksik: [],
    eksikSecmeli: [],
    teknik: '',
    uyari: '',
    kaynak: kaynak || '',
  };

  // 1) Tarayıcı GERÇEKTEN tarayıcıdır — burada yerel bildirim yoktur.
  //    Bu dalın tek koşulu platformun web olması; modül durumu ölçülmez.
  if (platform === 'web') {
    return { ...temel, durum: DURUM.WEB, destek: false, kaynak: '' };
  }

  // 2) Elde ÇALIŞAN bir modül varsa, önceki yükleme hatası artık ölümcül
  //    değildir (ör. barrel patladı, parçalı yükleme başardı).
  if (modul) {
    const eksik = eksikOlanlar(modul, GEREKLI_API);
    const eksikSecmeli = eksikOlanlar(modul, SECMELI_API);
    if (eksik.length) {
      return {
        ...temel,
        durum: DURUM.API_EKSIK,
        destek: false,
        eksik,
        eksikSecmeli,
        teknik: `Eksik işlev: ${eksik.join(', ')}`,
      };
    }
    return {
      ...temel,
      durum: DURUM.HAZIR,
      destek: true,
      eksikSecmeli,
      // Hata metni kaybolmaz: tanı için taşınır ama kullanıcıyı engellemez.
      uyari: teknikHata,
    };
  }

  // 3) Modül yok ama GERÇEK bir hata var → sessizce "tarayıcı" deme.
  if (teknikHata) {
    return { ...temel, durum: DURUM.MODUL_HATA, destek: false, teknik: teknikHata, kaynak: '' };
  }

  // 4) Ne modül ne hata → paket hiç kurulmamış.
  return { ...temel, durum: DURUM.MODUL_YOK, destek: false, kaynak: '' };
}

/** Ekranda gösterilecek DÜRÜST açıklama — durum ne ise o yazılır. */
export function ortamAciklamasi({ durum = '', platform = '', teknik = '' } = {}) {
  switch (durum) {
    case DURUM.WEB:
      return 'Tarayıcıda telefon bildirimi kurulamaz. Bu özellik yalnız Android/iOS '
        + 'uygulamasında çalışır; buradaki bildirim listesi çalışmaya devam eder.';
    case DURUM.HAZIR:
      return '';
    case DURUM.MODUL_YOK:
      return 'Bildirim modülü bu derlemede bulunamadı, bu yüzden telefon hatırlatması '
        + 'kurulamıyor. Uygulamanın güncel sürümünü açtığında bu bölüm kendiliğinden '
        + 'çalışır hâle gelir.';
    case DURUM.MODUL_HATA:
      return 'Bildirim modülü bu cihazda yüklenemedi, bu yüzden telefon hatırlatması '
        + `kurulamıyor (platform: ${platform || 'bilinmiyor'}). Bu bir tarayıcı sınırı değil; `
        + `cihazdaki teknik durum: ${teknik || 'ayrıntı alınamadı'}`;
    case DURUM.API_EKSIK:
      return 'Bildirim modülü yüklendi ancak yerel bildirim işlevleri eksik olduğu için '
        + `hatırlatma kurulamıyor. Teknik durum: ${teknik || 'ayrıntı alınamadı'}`;
    default:
      return 'Bildirim ortamı okunamadı; hatırlatma kurulup kurulamayacağı doğrulanamıyor.';
  }
}

/** Kısa tanı satırı (tanı amaçlı; kişisel veri içermez). */
export function ortamOzeti(o = {}) {
  const p = o.platform || 'bilinmiyor';
  const k = o.kaynak ? ` · kaynak: ${o.kaynak}` : '';
  const t = o.teknik ? ` · ${o.teknik}` : '';
  const u = !o.teknik && o.uyari ? ` · uyarı: ${o.uyari}` : '';
  return `durum: ${o.durum || 'bilinmiyor'} · platform: ${p}${k}${t}${u}`;
}
