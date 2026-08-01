// TELEFON / KİLİT EKRANI BİLDİRİMİ — CİHAZ SARMALAYICISI (expo-notifications).
//
// Karar mantığı burada DEĞİL:
//   • "bu ortamda bildirim kurulabilir mi?"  → `src/pushEnv.js`     (saf)
//   • "hangi bildirim, ne zaman, ne yazacak?" → `src/pushPlanner.js` (saf)
//   • "izin/plan/cihaz durumu nasıl uzlaşır?" → `src/pushSync.js`    (saf)
// Bu dosya yalnız CİHAZLA konuşur: modülü yükler, izin ister, kanalı kurar,
// zamanlar, iptal eder. (Aynı ayrım: security/biometricLock.js ↔ bioLockPolicy.js.)
//
// KAPSAM — DÜRÜST SINIR:
//   • Kurulan bildirimler YEREL'dir: telefon kendi saatiyle çalar, sunucu ve
//     internet gerekmez.
//   • SUNUCUDAN GÖNDERİLEN (uzak/push, FCM) bildirim BU DOSYADA YOKTUR.
//   • Bu yüzden yalnız ÖNCEDEN bilinen bir olay hatırlatılır: kullanıcının kendi
//     kuponundaki maçın başlama saati. Başlama saati yoksa bildirim UYDURULMAZ.
//
// ────────────────────────────────────────────────────────────────────────────
// MODÜL YÜKLEME — GERÇEK ANDROID CİHAZDA ÇIKAN HATANIN KAYNAĞI BURASIYDI
//
// Eski kod şunu yapıyordu:
//     try { Notifications = require('expo-notifications'); } catch { Notifications = null; }
//     export function isDesteklenir() { return !isWeb && !!Notifications; }
// ve ekran `!destek` durumunu "tarayıcı" sanıp "Tarayıcıda telefon bildirimi
// kurulamaz." yazıyordu.
//
// Oysa `expo-notifications` paketinin giriş dosyası (build/index.js) YEREL
// bildirimle ilgisi olmayan UZAK-PUSH alt modüllerini de modül gövdesinde
// yüklüyor (PushTokenManager → 'ExpoPushTokenManager', TopicSubscriptionModule →
// 'ExpoTopicSubscriptionModule', ServerRegistrationModule →
// 'NotificationsServerRegistrationModule'). Bunlar `requireNativeModule(...)`
// çağırır ve yerli modül kayıtlı değilse HATA FIRLATIR. Expo Go, SDK 53'ten beri
// Android'de uzak push modüllerini içermiyor (yerel bildirimler ise çalışıyor).
// Sonuç: gerçek telefonda import patlıyor, hata sessizce yutuluyor ve cihaz
// "web" gibi görünüyordu.
//
// ÇÖZÜM — iki aşamalı yükleme:
//   1) Önce paketin tamamı denenir (geliştirme derlemesi / mağaza sürümü burada
//      başarılı olur ve tüm API elde edilir).
//   2) Patlarsa YALNIZ yerel bildirim alt modülleri tek tek yüklenir. Bunların
//      hiçbiri uzak-push yerli modülü istemez. Böylece Expo Go'da da hatırlatma
//      kurulabilir.
// Her iki durumda da gerçek hata metni saklanır ve ekranda gösterilebilir;
// sessizce "tarayıcı" denmez.
//
// NOT: `require` yolları SABİT metindir — Metro dinamik yol çözemez, bu yüzden
// her yol tek tek yazılmıştır. `test/push-env.test.mjs` bu yolların pakette
// gerçekten var olduğunu doğrular; paket bir gün yeniden düzenlenirse test
// sessizce değil, GÜRÜLTÜYLE kırılır.

import { Platform, Linking } from 'react-native';
import { VARSAYILAN_ONCE_DK } from '../pushPlanner';
import { ortamiSinifla, ortamAciklamasi, ortamOzeti, DURUM } from '../pushEnv';
import {
  durumOku, macSenkron, ayariDegistir, testKur, testMacKur, macIptal, hepsiniIptal,
  izinAl, ayikla, VARSAYILAN_TERCIH, TEST_ONCE_SN,
} from '../pushSync';
import { gelistirmeKipi, TEST_MAC_ONCE_SN } from '../pushDevTest';

// YENİ anahtar — mevcut hiçbir anahtarın adı değiştirilmedi.
// İçinde kişisel veri YOK: yalnız aç/kapa tercihi ve kaç dakika önce.
export const PUSH_KEY = 'sportoto.push.v1';

// Kanal kimliği Android'de kalıcıdır; adı değiştirilirse kullanıcının ses/
// titreşim tercihi sıfırlanır — bu yüzden sabit.
export const KANAL_ID = 'mac-hatirlatma';

export { DURUM, TEST_ONCE_SN, gelistirmeKipi, TEST_MAC_ONCE_SN };

const isWeb = Platform.OS === 'web';
const HAS_LS = typeof localStorage !== 'undefined';

function hataMetni(e) {
  if (!e) return '';
  return String(e?.message != null ? e.message : e).trim();
}

// ---------------------------------------------------------------------------
// 1. aşama: paketin tamamı
// ---------------------------------------------------------------------------
const notlar = [];
let modul = null;
let kaynak = '';

if (!isWeb) {
  try {
    const tam = require('expo-notifications');
    if (tam && typeof tam.scheduleNotificationAsync === 'function') {
      modul = tam;
      kaynak = 'paket';
    } else {
      notlar.push('expo-notifications yüklendi ancak zamanlama işlevi bulunamadı');
    }
  } catch (e) {
    notlar.push(`expo-notifications: ${hataMetni(e)}`);
  }
}

// ---------------------------------------------------------------------------
// 2. aşama: yalnız YEREL bildirim alt modülleri (uzak-push modülü istemezler)
// ---------------------------------------------------------------------------
function parcaliYukle() {
  const al = (etiket, fn) => {
    try { return fn(); } catch (e) { notlar.push(`${etiket}: ${hataMetni(e)}`); return null; }
  };

  const izinler = al('NotificationPermissions', () => require('expo-notifications/build/NotificationPermissions'));
  const zamanlayici = al('scheduleNotificationAsync', () => require('expo-notifications/build/scheduleNotificationAsync'));
  const iptalci = al('cancelScheduledNotificationAsync', () => require('expo-notifications/build/cancelScheduledNotificationAsync'));
  const listeci = al('getAllScheduledNotificationsAsync', () => require('expo-notifications/build/getAllScheduledNotificationsAsync'));
  const kanalci = al('setNotificationChannelAsync', () => require('expo-notifications/build/setNotificationChannelAsync'));
  const isleyici = al('NotificationsHandler', () => require('expo-notifications/build/NotificationsHandler'));
  const yayinci = al('NotificationsEmitter', () => require('expo-notifications/build/NotificationsEmitter'));
  const tipler = al('Notifications.types', () => require('expo-notifications/build/Notifications.types'));
  const kanalTipleri = al('NotificationChannelManager.types', () => require('expo-notifications/build/NotificationChannelManager.types'));

  // Hiçbiri gelmediyse "yamalı modül" üretmenin anlamı yok.
  if (!izinler && !zamanlayici && !iptalci && !listeci) return null;

  return {
    getPermissionsAsync: izinler?.getPermissionsAsync,
    requestPermissionsAsync: izinler?.requestPermissionsAsync,
    scheduleNotificationAsync: zamanlayici?.scheduleNotificationAsync,
    cancelScheduledNotificationAsync: iptalci?.cancelScheduledNotificationAsync,
    getAllScheduledNotificationsAsync: listeci?.getAllScheduledNotificationsAsync,
    setNotificationChannelAsync: kanalci?.setNotificationChannelAsync,
    setNotificationHandler: isleyici?.setNotificationHandler,
    addNotificationResponseReceivedListener: yayinci?.addNotificationResponseReceivedListener,
    // Uygulama TAMAMEN KAPALIYKEN dokunulan bildirim, JS dinleyicisi var olmadan
    // önce yerli katmanda yakalanır; o dokunma yalnız buradan okunabilir.
    getLastNotificationResponse: yayinci?.getLastNotificationResponse,
    clearLastNotificationResponse: yayinci?.clearLastNotificationResponse,
    clearLastNotificationResponseAsync: yayinci?.clearLastNotificationResponseAsync,
    SchedulableTriggerInputTypes: tipler?.SchedulableTriggerInputTypes,
    AndroidImportance: kanalTipleri?.AndroidImportance,
    AndroidNotificationVisibility: kanalTipleri?.AndroidNotificationVisibility,
  };
}

if (!isWeb && !modul) {
  const p = parcaliYukle();
  if (p) { modul = p; kaynak = 'parcali'; }
}

// ---------------------------------------------------------------------------
// Ortam sınıflandırması — karar YALNIZ gerçek platform + gerçek API durumuna
// dayanır. Expo Go / appOwnership / geliştirme modu / config plugin GİRDİ DEĞİL.
// ---------------------------------------------------------------------------
const ORTAM = ortamiSinifla({
  platformOS: Platform.OS,
  modul,
  yuklemeHatasi: notlar.join(' | '),
  kaynak,
});

const N = modul;

/** Ortamın ayrıştırılmış hâli (ekran ve testler bunu okur). */
export function bildirimOrtami() { return { ...ORTAM }; }

/** Kullanıcıya gösterilecek dürüst açıklama (destek varsa boş döner). */
export function ortamMesaji() { return ortamAciklamasi(ORTAM); }

/** Kısa teknik tanı satırı — kişisel veri içermez. */
export function ortamTanisi() { return ortamOzeti(ORTAM); }

/** Bu cihazda telefon bildirimi kurulabilir mi? */
export function isDesteklenir() { return ORTAM.destek; }

// ---------------------------------------------------------------------------
// Tercih deposu (kullanıcı bildirimi açtı mı?)
// ---------------------------------------------------------------------------
let AS = null;
if (!HAS_LS) {
  try { AS = require('@react-native-async-storage/async-storage').default; } catch { AS = null; }
}

const VARSAYILAN = { ...VARSAYILAN_TERCIH, onceDk: VARSAYILAN_ONCE_DK };
let cache = null;

function parse(raw) {
  try {
    const o = raw ? JSON.parse(raw) : null;
    if (!o || typeof o !== 'object') return { ...VARSAYILAN };
    return {
      enabled: o.enabled === true,
      onceDk: Number.isFinite(Number(o.onceDk)) ? Number(o.onceDk) : VARSAYILAN.onceDk,
    };
  } catch { return { ...VARSAYILAN }; }
}

export async function getPushPrefs() {
  if (cache) return { ...cache };
  try {
    const raw = HAS_LS ? localStorage.getItem(PUSH_KEY) : (AS ? await AS.getItem(PUSH_KEY) : null);
    cache = parse(raw);
  } catch { cache = { ...VARSAYILAN }; }
  return { ...cache };
}

async function writePrefs(next) {
  cache = { ...VARSAYILAN, ...next };
  const raw = JSON.stringify(cache);
  try {
    if (HAS_LS) localStorage.setItem(PUSH_KEY, raw);
    else if (AS) await AS.setItem(PUSH_KEY, raw);
  } catch { /* depo yazamazsa tercih oturum içinde kalır */ }
  return { ...cache };
}

const store = { oku: getPushPrefs, yaz: writePrefs };

// ---------------------------------------------------------------------------
// Yerli katman (pushSync'in beklediği arayüz) — SADECE cihaz çağrıları
// ---------------------------------------------------------------------------
let kanalKuruldu = false;

const nat = {
  destek: ORTAM.destek,
  durum: ORTAM.durum,
  platform: ORTAM.platform,
  teknik: ORTAM.teknik,
  uyari: ORTAM.uyari,
  kaynak: ORTAM.kaynak,

  izinOku: () => N.getPermissionsAsync(),
  izinIste: () => N.requestPermissionsAsync(),

  async kanalHazirla() {
    if (Platform.OS !== 'android' || kanalKuruldu) return;
    if (typeof N?.setNotificationChannelAsync !== 'function') return;
    await N.setNotificationChannelAsync(KANAL_ID, {
      name: 'Maç hatırlatmaları',
      description: 'Kuponundaki maç başlamadan önce hatırlatma.',
      importance: N.AndroidImportance?.DEFAULT ?? 3,
      vibrationPattern: [0, 200],
      lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
      sound: 'default',
    });
    kanalKuruldu = true;
  },

  async zamanla(p) {
    await N.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.title,
        body: p.body,
        data: { ...p.data, fireAt: p.fireAt },
        sound: 'default',
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes?.DATE ?? 'date',
        date: new Date(p.fireAt),
        channelId: KANAL_ID,
      },
    });
  },

  iptal: (id) => N.cancelScheduledNotificationAsync(id),
  kurulular: () => N.getAllScheduledNotificationsAsync(),
};

const ctx = { nat, store };

// ---------------------------------------------------------------------------
// Dışa açık API
// ---------------------------------------------------------------------------

/**
 * @param {{ask?: boolean}} [o] ask=true ise kullanıcıya SİSTEM izni sorulur.
 * @returns {Promise<'granted'|'denied'|'blocked'|'unsupported'|'hata'>}
 */
export function izinDurumu({ ask = false } = {}) {
  return izinAl(nat, { sor: ask });
}

let hazirlandi = false;

/**
 * Bildirim davranışını ve Android kanalını hazırlar.
 * İZİN İSTEMEZ — izin yalnız kullanıcı ayardan açtığında sorulur.
 */
export async function initPush() {
  if (!ORTAM.destek || hazirlandi) return;
  hazirlandi = true;
  try {
    if (typeof N?.setNotificationHandler === 'function') {
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,   // rozet sayısı sunucudan doğrulanmıyor → kullanılmaz
        }),
      });
    }
  } catch { /* eski sürüm davranışı: varsayılan işleyici kalır */ }
  try { await nat.kanalHazirla(); } catch { /* sistem varsayılan kanalı kullanılır */ }
}

/** Ekranın ihtiyaç duyduğu tam durum (hiçbiri varsayılmaz, cihazdan okunur). */
export function pushDurumu() { return durumOku(ctx); }

/**
 * Planı cihazla eşitler ve sonucu CİHAZDAN GERİ OKUYARAK doğrular.
 * Kapalıysa / izin yoksa hiçbir şey kurulmaz ve bu dürüstçe raporlanır.
 */
export function syncMatchReminders({ now = Date.now(), bulletin = null, coupons = [] } = {}) {
  return macSenkron(ctx, { now, bulletin, coupons });
}

/** Yalnız bizim maç hatırlatmalarımızı siler. */
export function cancelAllMatchReminders() { return macIptal(nat); }

/** Bizim kurduğumuz her şey: maç hatırlatmaları + test kaydı (çıkış/hesap silme). */
export function cancelAllOurNotifications() { return hepsiniIptal(nat); }

/**
 * Ayardan aç/kapat. Açarken izin sorulur; izin verilmezse tercih AÇILMAZ
 * (aksi hâlde "açık" görünüp hiç bildirim gelmezdi — yanıltıcı olurdu).
 */
export function setPushEnabled(on, { now = Date.now(), bulletin = null, coupons = [] } = {}) {
  return ayariDegistir(ctx, { ac: !!on, now, bulletin, coupons });
}

/**
 * "Test Bildirimi Gönder" — aynı gerçek kanal, aynı gerçek zamanlama yolu,
 * bir dakika sonrası. İçinde tahmin, seçim, skor, puan, e-posta ya da kullanıcı
 * bilgisi YOKTUR. Amaç: telefon ayarlarının hatırlatmalara izin verdiğini
 * kullanıcının kendi gözüyle doğrulaması.
 */
export function testBildirimiGonder({ now = Date.now() } = {}) {
  return testKur(ctx, { now });
}

/**
 * "Maç hatırlatmasını test et" — YALNIZ GELİŞTİRME KİPİNDE kullanılır.
 *
 * Güncel bültendeki gerçek ve başlamamış bir maç için üretimdeki
 * `match-starting` bildiriminin aynısını 1 dakika sonrasına kurar; böylece
 * bildirime dokununca doğru maç detayının açıldığı 60 dakika beklemeden gerçek
 * cihazda görülebilir. Üretimdeki 60 dakikalık düzene ve kurulu hatırlatmalara
 * DOKUNMAZ. Uygun maç yoksa maç uydurulmaz, neden dürüstçe döner.
 *
 * Bülteni çağıran taraf verir (servis katmanı veri çekmez); kupon verisi bu
 * yolda hiç okunmaz.
 */
export function macTestiGonder({ now = Date.now(), bulletin = null } = {}) {
  return testMacKur(ctx, { now, bulletin });
}

/** İzin kapalıyken kullanıcıyı telefon ayarlarına götürür. */
export async function ayarlariAc() {
  try {
    if (typeof Linking?.openSettings === 'function') { await Linking.openSettings(); return true; }
  } catch { /* açılamazsa ekranda yönerge kalır */ }
  return false;
}

/** Kullanıcı bildirime dokununca ilgili ekrana gitmek için (App.js bağlar). */
export function addResponseListener(fn) {
  if (!ORTAM.destek || typeof N?.addNotificationResponseReceivedListener !== 'function') return () => {};
  try {
    const sub = N.addNotificationResponseReceivedListener((res) => {
      try { fn(res?.notification?.request?.content?.data || null); } catch { /* yut */ }
    });
    return () => { try { sub.remove(); } catch {} };
  } catch { return () => {}; }
}

/**
 * UYGULAMA KAPALIYKEN dokunulan bildirimin verisi.
 *
 * Neden gerekli: uygulama tamamen kapalıyken bildirime dokunulduğunda işletim
 * sistemi uygulamayı bildirimle birlikte başlatır; dokunma olayı JS tarafı daha
 * yüklenmeden yerli katmanda yakalanır ve `addResponseListener` HİÇ çalışmaz.
 * O dokunmayı yalnız bu okuma kurtarır.
 *
 * @returns {object|null} bildirimin `content.data` alanı ya da null
 */
export function sonYanitVerisi() {
  if (!ORTAM.destek) return null;
  try {
    if (typeof N?.getLastNotificationResponse !== 'function') return null;
    const res = N.getLastNotificationResponse();
    return res?.notification?.request?.content?.data || null;
  } catch { return null; }   // yerli yöntem yoksa UnavailabilityError fırlatır
}

/**
 * Okunan açılış yanıtını temizler.
 * Temizlenmezse AYNI dokunma sonraki her açılışta yeniden gezinme yaptırır;
 * kullanıcı uygulamayı normal açtığında bile eski maça atılırdı.
 */
export function sonYanitiTemizle() {
  if (!ORTAM.destek) return;
  try {
    if (typeof N?.clearLastNotificationResponse === 'function') { N.clearLastNotificationResponse(); return; }
    if (typeof N?.clearLastNotificationResponseAsync === 'function') {
      Promise.resolve(N.clearLastNotificationResponseAsync()).catch(() => {});
    }
  } catch { /* temizlenemezse gezinme yine tek sefer uygulanır (App.js koruması) */ }
}

/** Test/tanı: cihazda kurulu maç hatırlatmaları (kişisel veri içermez). */
export async function kuruluHatirlatmalar() {
  if (!ORTAM.destek) return [];
  try { return ayikla(await nat.kurulular()); } catch { return []; }
}
