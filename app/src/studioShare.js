// YAYIN STÜDYOSU — EKRAN GÖRSELİ PAYLAŞIMI (saf yardımcılar, JSX yok).
//
// NEDEN AYRI DOSYA: Paylaşım akışının karar veren kısmı (dosya adı, altyazı,
// veri-URI → ikili dönüşümü, iptal ayıklama, hata metni) ekrandan bağımsızdır
// ve testten doğrudan import edilebilir. Ekran dosyaları JSX içerdiği için
// test koşucusuna girmiyor; kural burada durursa sınanabiliyor.
//
// KESİN KURALLAR:
//  • GÖRSELDE KİŞİSEL VERİ YOK. Paylaşılan kare yalnız hafta numarası, maç
//    tablosu ve yayıncının kendi 1-0-2 seçimlerini taşır. Kullanıcı adı,
//    e-posta, belirteç, kupon kimliği veya başka kullanıcının seçimi girmez.
//  • HER PAYLAŞIMDA DÜRÜSTLÜK BİLDİRİMİ. Altyazı brand.js'ten okunur;
//    "kesin sonuç/kazanç vaadi değildir" cümlesi elle yazılmaz, silinemez.
//  • İPTAL HATA DEĞİLDİR. Kullanıcı paylaşım menüsünü kapatınca ekrana
//    kırmızı hata basılmaz; sessizce geri dönülür.
//  • UYDURMA YOK: hafta bilinmiyorsa dosya adına sahte numara yazılmaz.
import { APP_NAME, NO_GUARANTEE_NOTICE } from './brand';

export const SHARE_MIME = 'image/png';

// Yalnız dosya adında kullanılabilecek işaretler. Hafta numarası sunucudan
// geldiği için burada temizlenir (yol ayracı içeren bir değer dosya adını
// bozar). Boşsa ek yazılmaz — uydurma numara üretilmez.
function slug(v) {
  return String(v == null ? '' : v).replace(/[^0-9A-Za-z]+/g, '');
}

// sportoto-bulten-hafta-1526.png — hafta bilinmiyorsa yalnız sportoto-bulten.png
export function shareFileNameOf({ roundId, weekNumber } = {}) {
  const hafta = slug(weekNumber != null ? weekNumber : roundId);
  return `sportoto-bulten${hafta ? `-hafta-${hafta}` : ''}.png`;
}

// Paylaşım penceresinin başlığı (telefon).
export function shareTitleOf({ roundId } = {}) {
  return roundId != null ? `Hafta ${roundId} bülteni` : 'Haftalık bülten';
}

// Görselin yanında giden yazı. Marka adı ve dürüstlük bildirimi TEK KAYNAKTAN
// (brand.js) gelir; burada elle yazılmaz.
export function shareCaptionOf({ roundId, picked, total } = {}) {
  const hafta = roundId != null ? `Hafta ${roundId}` : 'Haftalık bülten';
  const sayim = total ? ` · ${picked || 0}/${total} maç işaretlendi` : '';
  return `${hafta}${sayim} — ${APP_NAME}. ${NO_GUARANTEE_NOTICE}`;
}

/* ————————————————— KUPON KARESİ: AYNI YOL, BAŞKA AD —————————————————
   Kupon ekranı da bu dosyadaki kare/gömme/iptal yolunu kullanır — bültenle
   tek fark dosya adı ve altyazıdır. Ayrı bir paylaşım yolu yazılmaz; kural
   (kişisel veri yok, bildirim silinemez) tek yerde kalsın diye.

   KUPON KİMLİĞİ YAZILMAZ: dosya adı da paylaşılan bir izdir. Kupon numarası
   kullanıcıya ait bir sayaçtır; hafta numarası yeter. */

export function couponShareFileNameOf({ roundId, weekNumber } = {}) {
  const hafta = slug(weekNumber != null ? weekNumber : roundId);
  return `sportoto-kupon${hafta ? `-hafta-${hafta}` : ''}.png`;
}

// HAFTA METNİ — kullanıcıya "Hafta 1527" (iç kayıt numarası) GÖSTERİLMEZ
// (hata bildirimi, 2026-08-06). Öncelik: resmî hafta adı ("53. Hafta") →
// hafta numarası → nötr metin. roundId yalnız son çare olarak, "Hafta" ön eki
// OLMADAN kullanılmaz — yanıltıcı olurdu.
function haftaMetniOf({ roundName, weekNumber } = {}) {
  if (roundName) return String(roundName);
  if (weekNumber != null) return `${weekNumber}. Hafta`;
  return null;
}

export function couponShareTitleOf(p = {}) {
  const hafta = haftaMetniOf(p);
  return hafta ? `${hafta} kuponu` : 'Kupon';
}

// Kolon sayısı kuponun ölçüsüdür, kişisel veri değildir; bilinmiyorsa yazılmaz.
// Marka adı ve dürüstlük bildirimi yine brand.js'ten gelir, elle yazılmaz.
export function couponShareCaptionOf(p = {}) {
  const hafta = haftaMetniOf(p) || 'Haftalık kupon';
  const kolon = p.columnCount > 0 ? ` · ${p.columnCount} kolon` : '';
  return `${hafta}${kolon} — ${APP_NAME}. ${NO_GUARANTEE_NOTICE}`;
}

// Web'de captureRef iki biçim döndürebiliyor: tam veri-URI ya da çıplak base64.
// İkisini de kabul edip base64 gövdesini veririz.
export function base64OfCapture(deger) {
  const s = String(deger == null ? '' : deger);
  const bas = /^data:image\/[\w+.-]+;base64,/.exec(s);
  return bas ? s.slice(bas[0].length) : s;
}

// base64 → Blob. Web'de paylaşım/indirme için ikili gövde gerekir; veri-URI'yi
// doğrudan <a download> ile vermek büyük görsellerde tarayıcıyı zorluyor.
export function dataUriToBlob(deger, mime = SHARE_MIME) {
  const b64 = base64OfCapture(deger).trim();
  if (!b64) throw new Error('Görsel üretilemedi.');
  const ham = atob(b64);
  const bayt = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i += 1) bayt[i] = ham.charCodeAt(i);
  return new Blob([bayt], { type: mime });
}

// Kullanıcı paylaşım menüsünü kapattı mı? Tarayıcı ve iOS bunu HATA olarak
// fırlatıyor; ekrana hata basmak yanlış olur.
export function isAbortError(e) {
  const ad = String((e && e.name) || '');
  const mesaj = String((e && e.message) || '');
  return ad === 'AbortError' || /AbortError|iptal|cancel/i.test(mesaj);
}

// Sonuç metinleri — ne olduğunu ekranda YAZILI söyleriz, sessiz kalmayız.
export function shareDoneTextOf(tur) {
  if (tur === 'shared') return 'Paylaşım menüsü açıldı.';
  if (tur === 'downloaded') return 'Görsel indirildi — indirilenler klasöründe.';
  if (tur === 'unavailable') return 'Bu cihazda paylaşım menüsü açılamadı; görsel oluşturuldu ama paylaşılamadı.';
  return '';
}

export function shareErrorTextOf(e) {
  const m = String((e && e.message) || '').trim();
  return `Görsel paylaşılamadı${m ? `: ${m}` : ''} — tekrar deneyebilirsin.`;
}

// KARE ALIRKEN EŞİT-GENİŞLİK RAKAMI GEÇİCİ KAPANIR (yalnız web).
//
// NEDEN: Tabloda rakamlar eşit genişlikte yazılıyor (font-variant: tabular-nums)
// — sütunlar kaymasın diye. Web'de kareyi alan kitaplık (html2canvas) metni
// EKRANDAKİ eşit-genişlik ölçüsüyle ölçüyor ama tuvale ORANTILI genişlikle
// çiziyor. İkisi tutmayınca paylaşılan görselde "19:00" → "19 :00" gibi
// kaymalar oluşuyordu (tarayıcıda ölçüldü: 32px ölçü / 28px çizim).
//
// ÇÖZÜM: kare alınırken ayar kısa süreliğine kapatılır, ölçü ile çizim aynı
// olur, hemen sonra geri konur. Ekrandaki tabloya kalıcı etkisi YOKTUR.
// Geri alma işini çağıran YAPMAK ZORUNDA: dönen işlev finally'de çağrılır.
export function tabularOff() {
  if (typeof document === 'undefined' || !document.head || !document.createElement) {
    return () => {};
  }
  const stil = document.createElement('style');
  stil.setAttribute('data-sportoto', 'capture-tabular-off');
  stil.textContent = '*{font-variant-numeric:normal !important;font-variant:normal !important;}';
  document.head.appendChild(stil);
  return () => { try { stil.remove(); } catch { /* zaten kaldırılmış */ } };
}

/* ——————————————————— KARE ÇÖZÜNÜRLÜĞÜ ——————————————————— */

// NEDEN BURADA BİR ÖLÇEK HESABI VAR: kare alan kitaplık, ölçek verilmezse
// karesini EKRAN YOĞUNLUĞU kadar (çoğu bilgisayarda 1×) çiziyor. Sonuç,
// paylaşıldığında büyütülünce dağılan yumuşak bir görsel oluyordu. Ölçek
// büyütülünce yazı ve armalar keskin çıkıyor.
//
// AMA SINIRSIZ BÜYÜTÜLEMEZ: tarayıcıların tuvalinde kenar ve toplam piksel
// sınırı var; aşılırsa tuval SESSİZCE boş döner — yani "kaliteli olsun" derken
// hiç görsel çıkmayabilir. Bu yüzden ölçek, karenin gerçek ölçüsüne göre
// kırpılır. 1'in altına asla inilmez: ekrandakinden kötü bir kare üretmeyiz.
// KALİTE YÜKSELTMESİ (kullanıcı isteği, 2026-08-04): taban 2→3, tavan 3→4.
// Normal masaüstünde (dpr 1) paylaşılan görsel artık 3x çekilir — yazılar ve
// armalar mesaj uygulamalarında sıkıştırılınca bile net kalır. MAX_KENAR ve
// MAX_PIKSEL bellek korumaları aynen geçerli; büyük kartlarda ölçek kendini kısar.
export const CAPTURE_MIN_SCALE = 3;
export const CAPTURE_MAX_SCALE = 4;
const MAX_KENAR = 8192;      // tarayıcı tuvalinin dayandığı en büyük kenar (px)
const MAX_PIKSEL = 24e6;     // ~24 MP — bellek üst sınırı

export function captureScaleOf({ dpr = 1, width = 0, height = 0 } = {}) {
  const g = Number(width) > 0 ? Number(width) : 0;
  const y = Number(height) > 0 ? Number(height) : 0;
  const yogunluk = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  let k = Math.min(Math.max(CAPTURE_MIN_SCALE, yogunluk), CAPTURE_MAX_SCALE);
  if (g > 0) k = Math.min(k, MAX_KENAR / g);
  if (y > 0) k = Math.min(k, MAX_KENAR / y);
  if (g > 0 && y > 0) k = Math.min(k, Math.sqrt(MAX_PIKSEL / (g * y)));
  // AŞAĞI yuvarlanır: yukarı yuvarlamak yukarıdaki sınırları tekrar aştırırdı
  // (ör. 6000 px genişlikte 1.365 → 1.37 → 8220 px > 8192).
  return Math.max(1, Math.floor(k * 100) / 100);
}

/* ——————————————————— ARMALARIN KAREYE GİRMESİ ——————————————————— */

// 1×1 saydam PNG — hiçbir şey çizilemediğinde kullanılır. BOŞ bırakmak,
// başka kulübün armasını koymaktan iyidir (proje kuralı).
const BOS_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * NÖTR ARMA — kulüp arması çizilemediğinde kareye konan top simgesi.
 * Ekrandaki bileşen (TeamCrest) aynı durumda ⚽ yazısı çiziyor; kare tarafında
 * yazı yerine görsel gerektiği için aynı simge tuvale çizilip gömülür.
 * BAŞKA KULÜBÜN ARMASI VEYA "BENZERİ" BİR GÖRSEL ASLA KONMAZ.
 */
export function neutralCrestDataUri(boy = 40) {
  if (typeof document === 'undefined' || !document.createElement) return BOS_PNG;
  try {
    const t = document.createElement('canvas');
    t.width = boy;
    t.height = boy;
    const c = t.getContext && t.getContext('2d');
    if (!c) return BOS_PNG;
    c.font = `${Math.round(boy * 0.72)}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('⚽', boy / 2, Math.round(boy * 0.54));
    return t.toDataURL(SHARE_MIME);
  } catch {
    return BOS_PNG;
  }
}

// Adresi indirip veri-URI'ye çevirir. Başarısızlıkta FIRLATMAZ, '' döner —
// tek bir arma inmediği için paylaşımın tamamı çökmemeli.
async function dataUriOfImage(adres) {
  if (typeof fetch !== 'function' || typeof FileReader === 'undefined') return '';
  try {
    const yanit = await fetch(adres, { mode: 'cors', credentials: 'omit' });
    if (!yanit || !yanit.ok) return '';
    const blob = await yanit.blob();
    if (!blob || !String(blob.type || '').toLowerCase().startsWith('image/')) return '';
    return await new Promise((coz) => {
      const okuyucu = new FileReader();
      okuyucu.onload = () => coz(String(okuyucu.result || ''));
      okuyucu.onerror = () => coz('');
      okuyucu.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// KARE ALIRKEN ARMALAR GÖMÜLÜ HÂLE GETİRİLİR (yalnız web).
//
// NEDEN: Kare alan kitaplık her görseli YENİDEN indirir ve tuvale ancak
// okuma izni (CORS) olan bir görseli çizebilir. İzin yoksa görseli HATA
// VERMEDEN düşürür — paylaşılan bültende armaların boş çıkmasının sebebi
// buydu. Adresler artık kendi sunucumuzdan geçtiği için (crestUrl.js) izin
// var; ama görselleri kare öncesinde bir kez gömmek iki şeyi daha çözer:
//   • kare anında ağ beklenmez (yavaş bağlantıda zaman aşımına düşmez),
//   • inmeyen arma yerine NÖTR ⚽ konur; kutu boş kalmaz, yanlış arma konmaz.
//
// Geri alma işini çağıran YAPMAK ZORUNDA: dönen işlev finally'de çağrılır.
export async function inlineImagesForCapture(kok) {
  if (!kok || typeof kok.querySelectorAll !== 'function') return () => {};
  let imgler;
  try {
    imgler = Array.prototype.slice.call(kok.querySelectorAll('img'));
  } catch {
    return () => {};
  }
  const geri = [];
  await Promise.all(imgler.map(async (img) => {
    let eski = '';
    try {
      eski = img.getAttribute('src') || '';
    } catch {
      return;
    }
    if (!eski || /^data:/i.test(eski)) return; // zaten gömülü
    const yeni = (await dataUriOfImage(eski)) || neutralCrestDataUri();
    try {
      geri.push([img, eski]);
      img.setAttribute('src', yeni);
    } catch { /* eleman kaldırılmış — kare yine alınır */ }
  }));
  return () => {
    for (const [img, eski] of geri) {
      try { img.setAttribute('src', eski); } catch { /* eleman gitmiş */ }
    }
  };
}

/* ——————————————————— KARENİN KENDİSİ ——————————————————— */

// Kitaplığı yalnız TARAYICIDA ve yalnız ÇAĞRILDIĞINDA ister; böylece bu dosya
// test koşucusunda (tarayıcı yokken) ve telefonda sorunsuz içe aktarılır.
function html2canvasOf() {
  if (typeof document === 'undefined') return null;
  if (typeof require !== 'function') return null;
  try {
    const m = require('html2canvas');
    const f = (m && m.default) || m;
    return typeof f === 'function' ? f : null;
  } catch {
    return null;
  }
}

/**
 * WEB KARESİ — yüksek çözünürlüklü PNG (veri-URI).
 *
 * NEDEN DOĞRUDAN ÇAĞRILIYOR: kare kitaplığının web sarmalayıcısı çağıranın
 * seçeneklerinin HİÇBİRİNİ iletmiyor (ölçek dâhil), kendi sabit ayarıyla
 * çiziyor. Bu yüzden ölçek oradan verilemiyordu; kare hep 1× çıkıyordu.
 *
 * Kitaplık bir sebeple yoksa null döner — çağıran eski yola düşer, paylaşım
 * özelliği kaybolmaz.
 */
export async function capturePngDataUri(dugum, secenek = {}) {
  const h2c = html2canvasOf();
  if (!h2c || !dugum) return null;
  const g = dugum.offsetWidth || dugum.clientWidth || 0;
  const y = dugum.offsetHeight || dugum.clientHeight || 0;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const olcek = secenek.scale || captureScaleOf({ dpr, width: g, height: y });
  const belge = typeof document !== 'undefined' ? document.documentElement : null;
  // PATLARSA PAYLAŞIM ÖLMEZ: buradan null dönerse çağıran eski kare yoluna
  // düşer. Bu yüzden hata fırlatmayız — yükseltme, çalışan özelliği bozamaz.
  let tuval = null;
  try {
    tuval = await h2c(dugum, {
      scale: olcek,
      useCORS: true,
      backgroundColor: secenek.backgroundColor || '#FFFFFF',
      logging: false,
      imageTimeout: 20000,
      scrollX: 0,
      scrollY: 0,
      windowWidth: belge ? belge.clientWidth : undefined,
      windowHeight: belge ? belge.clientHeight : undefined,
    });
  } catch {
    return null;
  }
  if (!tuval || typeof tuval.toDataURL !== 'function') return null;
  let veri = '';
  try {
    veri = tuval.toDataURL(SHARE_MIME);
  } catch {
    return null; // kirlenmiş tuval (izinsiz görsel) — eski yol denenir
  }
  // Tuval sınırı aşılırsa tarayıcı boş bir veri-URI döndürebiliyor; bunu
  // paylaşmaktansa eski yola düşmek doğrudur.
  return veri && veri.length > 128 ? veri : null;
}

// WEB PAYLAŞIMI — önce yerleşik paylaşım menüsü, olmazsa indirme.
// Tarayıcı nesnelerine yalnız ÇAĞRILDIĞINDA dokunur; bu yüzden dosya test
// koşucusunda (tarayıcı yokken) sorunsuz içe aktarılabiliyor.
export async function sharePngOnWeb(deger, dosyaAdi, yazi) {
  const blob = dataUriToBlob(deger);
  const gezgin = typeof navigator !== 'undefined' ? navigator : null;
  if (gezgin && gezgin.share && gezgin.canShare && typeof File !== 'undefined') {
    const dosya = new File([blob], dosyaAdi, { type: SHARE_MIME });
    if (gezgin.canShare({ files: [dosya] })) {
      await gezgin.share({ files: [dosya], text: yazi });
      return 'shared';
    }
  }
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return 'unavailable';
  }
  const adres = URL.createObjectURL(blob);
  const bag = document.createElement('a');
  bag.href = adres;
  bag.download = dosyaAdi;
  document.body.appendChild(bag);
  bag.click();
  document.body.removeChild(bag);
  setTimeout(() => URL.revokeObjectURL(adres), 4000);
  return 'downloaded';
}
