// BİLDİRİME DOKUNUNCA NEREYE GİDİLİR — YÖNLENDİRME ÇÖZÜCÜ (SAF MODÜL)
//
// React Native / React Navigation / expo-notifications burada İMPORT EDİLMEZ.
// Gezinme nesnesi (`nav`) dışarıdan verilir; böylece "uygulama kapalıyken
// dokunuldu", "gezinme henüz hazır değildi", "maç bültende yok" gibi durumlar
// node testlerinde CİHAZSIZ doğrulanabilir.
//
// Bölüşüm:
//   pushPlanner.js → hangi bildirim, ne zaman, hangi metinle
//   pushSync.js    → izin/plan/cihaz durumu nasıl uzlaştırılır
//   pushRoute.js   → dokunulunca hangi ekran açılır (bu dosya)
//   services/pushService.js → gerçek expo-notifications çağrıları
//
// KESİN KURALLAR
//  1) Rota bildirimin `kind` alanından TÜRETİLİR. Bildirimin içindeki serbest
//     `tab`/`screen` metni gezinmeyi SÜRÜKLEYEMEZ — bize ait olmayan bir
//     bildirim uygulamayı istediği ekrana götüremesin diye.
//  2) Maç kaydı bültende OLMADIĞI BİLİNİYORSA maç detayına gidilmez; yanlış maç
//     ya da ana sayfa yerine güvenli biçimde Bildirimler ekranı açılır.
//  3) Maç numarası geçersizse (yok / sayı değil / ≤ 0) maç detayına gidilmez —
//     detay ekranı `route.params.no` olmadan çalışamaz.
//  4) Bülten henüz yüklenmediyse (bilinmiyor) maç detayına gidilir; o ekran
//     kaydı bulamazsa kendi dürüst hatasını gösterir. "Bilmiyoruz"u "yok"
//     saymak, var olan maçı açmamak demek olurdu.
//  5) Burada kişisel veri yoktur: yalnız maç NUMARASI taşınır. Tahmin, kupon
//     seçimi, e-posta, kullanıcı ya da oturum bilgisi geçmez.

import { MAC_KIND, TEST_KIND } from './pushSync';

/** Test bildirimi ve güvenli düşüş hedefi: uygulama içi Bildirimler ekranı. */
export const BILDIRIM_ROTASI = { tab: 'HomeTab', screen: 'Notifications' };
/** Gerçek maç hatırlatması: doğrudan o maçın canlı detayı. */
export const MAC_ROTASI = { tab: 'BulletinTab', screen: 'LiveMatchDetail' };

/**
 * Bildirim verisindeki maç numarası.
 * @returns {number|null} geçerli (tam sayı, > 0) numara ya da null
 */
export function macNo(data) {
  const ham = data?.params?.no;
  if (ham === null || ham === undefined || ham === '') return null;
  const n = Number(ham);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Dokunulan bildirim için hedef rota.
 *
 * @param {object|null} data      bildirimin `content.data` alanı
 * @param {object} [g]
 * @param {boolean|null} [g.macVar]  maç bültende var mı? true / false / null(bilinmiyor)
 * @returns {{tab:string, screen:string, params?:object}|null}
 *          null → bu bildirim bize ait değil, gezinme YAPILMAZ
 */
export function rotaCoz(data, { macVar = null } = {}) {
  const kind = data && typeof data === 'object' ? data.kind : null;

  if (kind === TEST_KIND) return { ...BILDIRIM_ROTASI };
  if (kind !== MAC_KIND) return null;           // yabancı/eski bildirim → dokunma

  const no = macNo(data);
  // Numara yoksa ya da maçın bültende OLMADIĞI biliniyorsa güvenli düşüş.
  if (no == null || macVar === false) return { ...BILDIRIM_ROTASI };
  return { ...MAC_ROTASI, params: { no } };
}

// ---------------------------------------------------------------------------
// Bekleyen rota kuyruğu — tek yuvalı
// ---------------------------------------------------------------------------
// Uygulama kapalıyken bildirime dokunulduğunda dokunma, NavigationContainer
// bağlanmadan çok önce ulaşır (açılış animasyonu + oturum yükleme + biyometrik
// kilit boyunca gezinme YOKTUR). Rota o âna kadar burada bekler; gezinme hazır
// olur olmaz uygulanır. Eski davranışta bu dokunma sessizce düşüyor ve kullanıcı
// ana sayfada kalıyordu.

/** Bu bildirim bizim mi? (Yabancı bildirim kuyruğa bile alınmaz.) */
export function bizeAit(data) {
  const kind = data && typeof data === 'object' ? data.kind : null;
  return kind === TEST_KIND || kind === MAC_KIND;
}

/**
 * Kuyrukta ROTA değil, bildirimin VERİSİ bekler. Hedef mümkün olan en geç anda
 * çözülür: bekleme sırasında bülten yüklenmiş olabilir ve "maç hâlâ var mı"
 * sorusuna o zaman gerçek yanıt verilebilir.
 * @returns {{koy:Function, bekleyen:Function, temizle:Function}}
 */
export function rotaKuyrugu() {
  let veri = null;
  return {
    koy(data) { if (!bizeAit(data)) return false; veri = data; return true; },
    bekleyen() { return veri; },
    temizle() { veri = null; },
  };
}

/** Gezinme gerçekten hazır mı (ekranlar bağlandı mı)? */
export function gezinmeHazir(nav) {
  if (!nav) return false;
  if (typeof nav.isReady === 'function') {
    try { return nav.isReady() === true; } catch { return false; }
  }
  return typeof nav.navigate === 'function';
}

/**
 * Bekleyen rotayı uygular. Gezinme hazır değilse rota BEKLEMEYE DEVAM EDER
 * (silinmez) — hazır olunca tekrar çağrılır.
 * @returns {boolean} gezinme yapıldıysa true
 */
export function rotayiUygula(kuyruk, nav) {
  const veri = kuyruk?.bekleyen?.();
  if (!veri) return false;
  if (!gezinmeHazir(nav)) return false;

  const no = macNo(veri);
  const rota = rotaCoz(veri, { macVar: no == null ? null : macBilinen(no) });
  // Başarısız olsa da kuyruk temizlenir: aynı hatayı sonsuz tekrarlamak
  // kullanıcıyı bir yere götürmez, yalnız her açılışta yeniden denenirdi.
  kuyruk.temizle();
  if (!rota) return false;
  try {
    if (rota.screen) nav.navigate(rota.tab, { screen: rota.screen, params: rota.params });
    else nav.navigate(rota.tab);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Bültendeki maç numaraları — yalnız yönlendirme doğrulaması içindir
// ---------------------------------------------------------------------------
// Burada tutulan tek şey maç NUMARALARIDIR (bültende zaten herkese açık).
// Takım, saat, tahmin, kupon ya da kullanıcı bilgisi TUTULMAZ.

let bilinenMaclar = null;   // null = bülten henüz yüklenmedi (BİLİNMİYOR)

/** Bülten yüklendiğinde çağrılır. Geçersiz/boş bülten "bilinmiyor" bırakır. */
export function maclariBildir(bulletin) {
  const maclar = Array.isArray(bulletin?.matches) ? bulletin.matches : null;
  if (!maclar || !maclar.length) return;      // bilgi yoksa var olanı SİLMEYİZ
  const kume = new Set();
  for (const m of maclar) {
    const n = Number(m?.no);
    if (Number.isInteger(n) && n > 0) kume.add(n);
  }
  if (kume.size) bilinenMaclar = kume;
}

/** @returns {boolean|null} true=var · false=yok · null=bilinmiyor */
export function macBilinen(no) {
  if (!bilinenMaclar) return null;
  const n = Number(no);
  if (!Number.isInteger(n) || n <= 0) return null;
  return bilinenMaclar.has(n);
}

/** Testler ve çıkış sonrası temizlik için. */
export function maclariUnut() { bilinenMaclar = null; }
