// YAYIN STÜDYOSU — görsel dil (saf sabitler, JSX YOK).
//
// NEDEN AYRI DOSYA: Stüdyonun ekranları (bülten tablosu, maç detayı, geçmiş
// hafta karnesi) aynı görünümü kullanır. Renk/ölçü her ekranda
// ayrı yazılırsa yayında biri diğerinden farklı görünür. Tek kaynak burasıdır.
//
// GÖRÜNÜM KARARI (kullanıcı seçimi): "resmî bülten tablosu".
// Açık zemin, ince gri çizgi, sıkışık satır, koyu başlık şeridi, turuncu vurgu.
// Yuvarlak köşe ve gölge neredeyse yok; büyük başlık yok; tek ekranda 15 satır.
// Önceki koyu "yayın paneli" görünümü bilerek terk edildi: her yerde aynı olan
// koyu-kart-yuvarlak-gölge kalıbı hem tanıdık hem de seyrek yazıyordu.
//
// KURALLAR:
//  • Uygulamanın genel teması DEĞİŞMEZ. Burası ayrı bir yüzeydir; global
//    tema dosyasına (theme.js) dokunulmaz.
//  • Renkler yalnız görseldir; hiçbir renk "kesin/garanti" anlamı taşımaz.
//    Yeşil "kazanır" demek değildir — yalnız DÜŞÜK risk seviyesidir.
//  • Hiçbir kurumun amblemi, logosu veya kurumsal rengi taklit edilmez;
//    turuncu vurgu genel bir vurgu rengidir, bir kuruma ait değildir.

/* ————————————————— PALET ————————————————— */
export const S = {
  bg: '#EEF0F3',         // sayfa zemini — tablo bunun üstünde "kağıt" gibi durur
  panel: '#FFFFFF',      // tablo / panel yüzeyi
  panel2: '#F7F8FA',     // zebra satır, ikincil yüzey
  panel3: '#EDEFF3',     // sütun başlığı şeridi, pasif alan
  head: '#3E5064',       // koyu başlık şeridi (resmî tablodaki gibi)
  headInk: '#FFFFFF',
  line: '#D8DDE3',       // ince gri çizgi — tablonun iskeleti
  lineSoft: '#E7EAEE',
  lineStrong: '#B9C2CC',
  ink: '#14202B',        // ana yazı
  inkSoft: '#4E5D6B',
  inkDim: '#8593A0',
  accent: '#D2551F',     // vurgu (turuncu)
  accentSoft: '#FBEDE6',
  accentInk: '#FFFFFF',  // turuncu zemin üzerine yazı
  good: '#1B7A4C',
  goodSoft: '#E4F2EA',
  warn: '#96650A',
  warnSoft: '#FAF0DC',
  bad: '#AF2620',
  badSoft: '#FAE8E6',
  info: '#1D5C9E',
  infoSoft: '#E7EFF8',
};

/* SEVİYE→RENK EŞLEMESİ (toneOfLevel / toneSoftOfLevel) SİLİNDİ — yayıncı
   isteği. Bir maçı/kuponu yeşil-sarı-kırmızı diye boyamak, yazıyla
   "güvenli/riskli" demenin sessiz hâliydi. Renk sözlüğü (good/warn/bad)
   duruyor; sınır aşımı gibi NESNEL uyarılarda kullanılır. */

/** Seçim genişliğinin rengi (tek/çift/kapalı). */
export function toneOfKind(kind) {
  if (kind === 'tek') return S.good;
  if (kind === 'cift') return S.info;
  if (kind === 'kapali') return S.accent;
  return S.inkDim;
}

/** Şeffaf zemin üretimi — '#RRGGBB' + alfa (RN her yerde 8 haneli hex destekler). */
export const alpha = (hex, aa) => `${hex}${aa}`;

/* ————————————————— ÖLÇÜ ————————————————— */
// Yuvarlaklık bilerek çok küçük: resmî tablo görünümü köşeli çizgilerden doğar.
export const R = { sm: 2, md: 3, lg: 4, xl: 6, pill: 999 };
// Dolgu bilerek dar: aynı ekrana 15 satır sığmalı.
export const SP = { xs: 3, sm: 6, md: 9, lg: 13, xl: 18 };

/** Tablo ölçüleri — satır yüksekliği ve çizgi kalınlığı tek yerden. */
export const TABLE = {
  rowH: 34,          // sıkışık satır
  headH: 30,
  hair: 1,           // ince ayırıcı
  cellPadX: 8,
};

/**
 * Punto ölçeği. ÖNCEKİNDEN BELİRGİN KÜÇÜK: eski ölçek geniş ekranda 1.16'ya
 * kadar çıkıyordu ve stüdyo "büyük yazılar sıralayan" bir ekrana dönüşüyordu.
 * Artık geniş ekranda bile 1.0'ı geçmez; okunabilirlik alt sınırı 0.86'dır.
 */
export function scaleFor(width) {
  if (!Number.isFinite(width)) return 1;
  if (width >= 1280) return 1;
  if (width >= 900) return 0.97;
  if (width >= 620) return 0.94;
  if (width >= 420) return 0.9;
  return 0.86;
}

/**
 * Tipografi ölçeği — punto adları tek yerde. Ekranlarda "18 * k" gibi çıplak
 * sayı yazmak yerine T(k).baslik kullanılır; böylece yoğunluk tek dosyadan
 * ayarlanır ve bir ekran diğerinden büyük kalmaz.
 */
export function T(k = 1) {
  const p = (n) => Math.round(n * k);
  return {
    mikro: p(9.5),    // sütun başlığı, büyük-harf etiket
    kucuk: p(11),     // yardımcı satır, açıklama
    metin: p(12.5),   // gövde
    orta: p(13.5),    // takım adı, tablo hücresi
    buyuk: p(15),     // panel başlığı
    baslik: p(17),    // ekran başlığı
    sayi: p(19),      // öne çıkan sayı (karne skoru)
  };
}

/** Büyük-harf etiket stili — başlık yerine kullanılır, yer kaplamaz. */
export const ETIKET = { letterSpacing: 0.7, textTransform: 'uppercase' };

/** Dar yerleşim eşiği — satırın alt sıraya kırılacağı genişlik. */
export const NARROW_MAX = 560;

/** Sağdaki özet paneli bu genişlikten sonra yan yana durur; altında alta iner. */
export const SIDEBAR_MIN = 900;

/**
 * Stüdyo ekranları uçtan uca olmalıdır. Yığın ekranlarının web'de ortalanmış
 * 1140px gövdesi vardır; bu, yayın kadrajında iki yanda şerit bırakır.
 * Bu yüzden stüdyo rotalarında gövde stili ezilir.
 */
export const STUDIO_CONTENT_STYLE = {
  width: '100%',
  maxWidth: undefined,
  alignSelf: 'stretch',
  backgroundColor: S.bg,
};

/**
 * Tam ekran (alt sekme çubuğu gizlenen) rotalar. App.js bu listeyi okur;
 * rota adı iki yerde ayrı ayrı yazılmasın diye tek kaynak burada.
 */
export const FULLSCREEN_ROUTES = ['Broadcast', 'StudioBulletin', 'StudioMatch', 'StudioKarne'];
