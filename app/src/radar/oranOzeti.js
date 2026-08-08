// RADAR 5 — "ORAN" MODUNUN SAĞ TARAF ÖZETİ (saf modül, RN'siz).
//
// NE YAPAR: Radar 4'ün günlük mühürlü oran yanıtından (/api/radar/daily-odds)
// SON DOLU GÜNÜ seçer ve o günün 1/X/2 ORANLARINI maç no'suna göre verir.
// Radar 5 satırının sağında, "Oynanma %" modundaki yüzdenin YERİNE bu üçlü yazar.
//
// NEDEN AYRI DOSYA: RadarScreen çizim yapar; gün seçimi ve geçerlilik kuralı
// burada durur ve doğrudan sınanır (app/test/oran-ozeti.test.mjs). Ekranın
// içine gömülü bir seçim ancak ekran çizilerek denetlenebilirdi.
// Kardeş modül: oynanmaSuzgeci.js (aynı satırın "Oynanma %" tarafı).
//
// İKİ BİRİM KARIŞTIRILMAZ (bkz. components/RadarDayRows.js):
//   * ORAN   = gerçek 1/X/2 katsayısı (1.61 · 3.20 · 4.25)  ← bu dosya
//   * OYNANMA = kullanıcıların oynama yüzdesi (%62 · %21 · %17)
//
// DÜRÜSTLÜK: eksik oran UYDURULMAZ, sıfıra çevrilmez, önceki günden taşınmaz.
// Üçlünün biri bile okunamıyorsa o maç için "oran kaydı yok" denir — yarım bir
// üçlüyü tam gibi göstermek, ekranda düzgün duran ama yanlış bir sayı üretir.
import { hucreDolu } from '../radarGun';
import { sayi } from './oynanmaSuzgeci';

// Ekrandaki harf → yanıttaki alan adı. Sıra SABİT: 1 · X · 2.
export const ORAN_ALANLARI = [['1', 'home'], ['X', 'draw'], ['2', 'away']];

// En düşük geçerli oran. Arka uçtaki kuralla AYNI sayı
// (backend/src/radar/dailyOdds.js → validOdds: home/draw/away > 1). İki yerde
// iki farklı eşik olsaydı arka ucun elediği bir değer ekranda "oran" diye
// görünürdü. 1.00 ve altı oran yoktur; 0 ise çoğu zaman "veri yok"un sayıya
// çevrilmiş hâlidir (Number(null) === 0 — tasks/lessons.md §12).
export const EN_DUSUK_ORAN = 1;

/**
 * Bir hücrenin oranı → {home, draw, away}. Üçü DE geçerliyse döner, değilse null.
 * null/''/boolean elenmesi `sayi()` ile yapılır (paylaşılan tek kural).
 */
export function oranUclusu(odds) {
  if (!odds || typeof odds !== 'object') return null;
  const out = {};
  for (const [, alan] of ORAN_ALANLARI) {
    const n = sayi(odds[alan]);
    if (n === null || n <= EN_DUSUK_ORAN) return null;   // biri eksikse ÜÇÜ de yok
    out[alan] = n;
  }
  return out;
}

/**
 * Ekranda yazılacak gün: GERÇEK oranı olan en son geçmiş/bugün günü.
 *
 * NEDEN `varsayilanGun` (radarGun.js) DOĞRUDAN KULLANILMIYOR: o seçici Radar 3/4
 * gün sekmesi içindir ve veri bulamazsa yine de bir güne düşer (son geçmiş gün,
 * hepsi ileri tarihliyse ilk gün). Orada doğrudur — kullanıcı gün seçer ve o
 * günün boş olduğunu satırda okur. Burada gün bir SAYININ ETİKETİDİR: oranı
 * olmayan bir günün adını yazmak, olmayan bir kaydı varmış gibi çerçeveler.
 * Gelecek gün de hiçbir koşulda seçilmez — henüz oluşmamış oran yoktur.
 */
export function oranGunu(dailyOdds) {
  const gunler = Array.isArray(dailyOdds?.days) ? dailyOdds.days : [];
  const maclar = Array.isArray(dailyOdds?.matches) ? dailyOdds.matches : [];
  const gecmisVeBugun = gunler.filter((g) => g && !g.future);
  for (let i = gecmisVeBugun.length - 1; i >= 0; i -= 1) {
    const t = gecmisVeBugun[i].date;
    const dolu = maclar.some((m) => {
      const hucre = m?.cells?.[t];
      return hucreDolu(hucre) && !!oranUclusu(hucre.odds);
    });
    if (dolu) return t;
  }
  return null;
}

/**
 * SAĞ TARAF ÖZETİNİN TAMAMI — ekranın tek çağırdığı fonksiyon.
 *
 * @param {object} dailyOdds  /api/radar/daily-odds yanıtı (null olabilir)
 * @returns {{tarih, weekday, oranlar: Map<no, {home,draw,away}>,
 *            sebepler: Map<no, string|null>, sebep: string|null}}
 *   sebep: 'yukleniyor' | 'gunYok' | 'kayitYok' — gün SEÇİLEMEDİĞİNDE nedeni.
 *   sebepler: gün seçildi ama O MAÇIN oranı yoksa arka ucun kendi notu (varsa).
 */
export function sonGunOranOzeti(dailyOdds) {
  const bos = { tarih: null, weekday: null, oranlar: new Map(), sebepler: new Map() };
  // Yanıt hiç gelmediyse "kayıt yok" DENMEZ: eksikliği yanlış yere (veriye)
  // yıkardı — henüz sorulmamış olabilir (tasks/lessons.md §13).
  if (!dailyOdds) return { ...bos, sebep: 'yukleniyor' };
  if (!Array.isArray(dailyOdds.days) || !dailyOdds.days.length) return { ...bos, sebep: 'gunYok' };

  const tarih = oranGunu(dailyOdds);
  if (!tarih) return { ...bos, sebep: 'kayitYok' };

  const gun = dailyOdds.days.find((g) => g?.date === tarih) || null;
  const oranlar = new Map();
  const sebepler = new Map();
  for (const m of dailyOdds.matches || []) {
    if (m?.no == null) continue;
    const u = oranUclusu(m?.cells?.[tarih]?.odds);
    if (u) oranlar.set(m.no, u);
    // Sebep arka uçta üretilir (notes); burada ÜRETİLMEZ, yalnız taşınır.
    else sebepler.set(m.no, m?.notes?.[tarih]?.text || null);
  }
  return { tarih, weekday: gun?.weekday || null, oranlar, sebepler, sebep: null };
}

/** Ekranda gösterilecek biçim: 1.61 (iki basamak). Değer yoksa çağrılmaz. */
export const oranYaz = (v) => Number(v).toFixed(2);
