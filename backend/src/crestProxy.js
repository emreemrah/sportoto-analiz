// KULÜP ARMASI VEKİLİ — adres doğrulaması + getirme (tek dosyada, ağ kısmı ayrık).
// ---------------------------------------------------------------------------
// NEDEN VAR: Armalar dış bir görsel dağıtım ağından geliyor. Tarayıcı o adresi
// EKRANDA sorunsuz çiziyor ama PAYLAŞILAN EKRAN GÖRSELİNE koyamıyor. Sebebi:
// kare alan kitaplık tuvale ancak "bu görseli okuyabilirsin" izni (CORS) veren
// bir kaynağı çizebilir; izin yoksa görseli sessizce DÜŞÜRÜR — hata da vermez.
// Yayıncının paylaştığı bültende armaların boş çıkmasının sebebi tam olarak
// buydu (nötr ⚽ bir YAZI karakteri olduğu için o kaldı, gerçek armalar gitti).
//
// ÇÖZÜM: Arma kendi sunucumuzdan geçirilir. Sunucu ile uygulama arasında bu
// izin zaten var (server.js → app.use(cors())), böylece kare alınırken arma
// tuvale çizilebiliyor. Yan fayda: aynı arma bir kez indirilip diske yazılır,
// her yayında dış ağa tekrar gidilmez.
//
// GÜVENLİK — VARSAYILAN RET: Burası "istediğin adresi getir" kapısı DEĞİLDİR.
// Öyle olsaydı bu uç, sunucunun iç ağını taramak için kullanılabilirdi (SSRF).
// Yalnız BİLİNEN arma konağının, /img/ altındaki, görsel uzantılı yolları
// kabul edilir. Başka konak, http, kapı numarası, kullanıcı adı/parola,
// sorgu/çapa, `..`, yüzde kodlaması, uzantısız yol → RET.
// SVG bilerek DIŞARIDA: kendi alan adımızdan servis edilen bir SVG tarayıcıda
// betik çalıştırabilir. Armaların hepsi zaten .png.
//
// UYDURMA YOK: getirme başarısızsa buradan boş döner, çağıran 404 yazar ve
// uygulamadaki arma bileşeni nötr ⚽ çizer. Başka kulübün arması veya
// "benzeri" bir görsel ASLA konmaz.
import { createHash } from 'node:crypto';

// Konak adı YALNIZ burada geçer; istemciye hiçbir zaman gönderilmez.
const IZINLI_KONAK = 'cdn.footystats.org';
const IZINLI_KOK = '/img/';
// Yalnız bu uzantılar. Sıra önemli değil; eşleşen ilk uzantı içerik türünü verir.
const TURLER = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const GUVENLI_YOL = /^\/img\/[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$/;

/** Adresin uzantısı (küçük harf, noktalı) — yoksa ''. */
function uzantiOf(yol) {
  const n = String(yol || '').lastIndexOf('.');
  return n < 0 ? '' : String(yol).slice(n).toLowerCase();
}

/**
 * Gelen adres güvenli bir arma adresi mi? Öyleyse NORMALLEŞTİRİLMİŞ mutlak
 * adresi, değilse '' döndürür. Ağa çıkmaz, dosya açmaz — saf karardır.
 */
export function crestTargetOf(deger) {
  const ham = String(deger == null ? '' : deger).trim();
  // Uzun adres = ya saldırı ya hata; ikisinde de reddetmek doğru.
  if (!ham || ham.length > 400) return '';
  let u;
  try {
    u = new URL(ham);
  } catch {
    return '';
  }
  if (u.protocol !== 'https:') return '';
  if (u.hostname.toLowerCase() !== IZINLI_KONAK) return '';
  if (u.port) return '';
  if (u.username || u.password) return '';
  // Sorgu ve çapa arma adresinde işe yaramaz; varsa niyet başkadır.
  if (u.search || u.hash) return '';
  const yol = u.pathname;
  if (!yol.startsWith(IZINLI_KOK)) return '';
  // `//` ve `..` URL ayrıştırıcısı tarafından çözülür; yine de açıkça reddedilir.
  if (yol.includes('//') || yol.includes('..')) return '';
  // `%2e` gibi kodlamalar bu kalıba takılır (`%` izinli karakter değil).
  if (!GUVENLI_YOL.test(yol)) return '';
  if (!TURLER[uzantiOf(yol)]) return '';
  return `https://${IZINLI_KONAK}${yol}`;
}

/** Doğrulanmış adresin içerik türü. Doğrulanmamış adres için ''. */
export function crestContentTypeOf(hedef) {
  return TURLER[uzantiOf(hedef)] || '';
}

/**
 * Diskte tutulacak dosya adı. Yol adından türetmek çakışma riski taşır
 * (farklı klasör, aynı dosya adı), bu yüzden adresin özetinden üretilir.
 */
export function crestFileNameOf(hedef) {
  const s = String(hedef || '');
  if (!s) return '';
  const uz = uzantiOf(s);
  if (!TURLER[uz]) return '';
  return `${createHash('sha1').update(s).digest('hex')}${uz}`;
}

// Getirme sınırları — dış ağ yavaşlarsa yayın beklemesin, dev dosya inmesin.
export const CREST_TIMEOUT_MS = 8000;
export const CREST_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Armayı kaynaktan indirir. Doğrulama ÇAĞIRANIN işidir: buraya yalnız
 * crestTargetOf'tan geçmiş bir adres verilir. Başarısızlıkta fırlatmaz,
 * null döner — arma indirilememesi sunucu hatası değildir.
 *
 * fetchImpl/timeoutMs testten verilebilsin diye parametre; üretimde global fetch.
 */
export async function fetchCrest(hedef, secenek = {}) {
  const {
    fetchImpl = typeof fetch === 'function' ? fetch : null,
    timeoutMs = CREST_TIMEOUT_MS,
    maxBytes = CREST_MAX_BYTES,
  } = secenek;
  if (!hedef || !fetchImpl) return null;
  const tur = crestContentTypeOf(hedef);
  if (!tur) return null;

  const durdurucu = typeof AbortController === 'function' ? new AbortController() : null;
  const sayac = durdurucu ? setTimeout(() => durdurucu.abort(), timeoutMs) : null;
  try {
    const yanit = await fetchImpl(hedef, {
      redirect: 'error', // yönlendirme = adres artık doğruladığımız adres değil
      signal: durdurucu ? durdurucu.signal : undefined,
    });
    if (!yanit || !yanit.ok) return null;
    const gelenTur = String(yanit.headers?.get?.('content-type') || '').toLowerCase();
    // Kaynak görsel yerine HTML hata sayfası döndürdüyse onu diske yazmayız.
    if (gelenTur && !gelenTur.startsWith('image/')) return null;
    const uzunluk = Number(yanit.headers?.get?.('content-length') || 0);
    if (uzunluk && uzunluk > maxBytes) return null;
    const govde = Buffer.from(await yanit.arrayBuffer());
    if (!govde.length || govde.length > maxBytes) return null;
    return { body: govde, contentType: tur };
  } catch {
    return null; // ağ hatası / zaman aşımı — çağıran 404 yazar, ekranda ⚽ kalır
  } finally {
    if (sayac) clearTimeout(sayac);
  }
}
