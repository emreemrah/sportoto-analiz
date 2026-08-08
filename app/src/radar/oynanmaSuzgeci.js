// RADAR 5 — OYNANMA YÜZDESİNE GÖRE GEÇMİŞ MAÇ SÜZGECİ (saf modül, RN'siz).
//
// NE YAPAR: bir sıranın GÜNCEL haftadaki maçının oynanma yüzdesini alır, o
// sıranın geçmiş maçları arasından yüzdesi BUNA YAKIN olanları seçer ve
// 1/X/2 yüzdesini YALNIZ o süzülmüş listeden hesaplar.
//
// NEDEN AYRI DOSYA: RadarScreen çizim yapar; hesap burada durur ve doğrudan
// sınanır (app/test/oynanma-suzgeci.test.mjs). Ekranın içine gömülü bir hesap
// ancak ekran çizilerek denetlenebilirdi.
//
// SÖZLEŞME — BAŞLIK İLE LİSTE ASLA ÇELİŞMEZ: üstteki yüzde de, açılan tablodaki
// maçlar da AYNI diziden (`maclar`) gelir. Radar 5'in geçmişteki en can yakıcı
// hatası buydu: liste 2 maç gösterirken yüzde 768 maçtan geliyordu
// (tasks/lessons.md §8). Tek dizi kuralı o hatayı yapısal olarak imkânsız kılar.
//
// GÖZLEMDİR, TAHMİN DEĞİL: "geçmişte benzer oynanma profilinde şu maçlar vardı,
// şöyle bitmiş" der. Gelecek cümlesi kurmaz. Aynı yaklaşım arka uçta da var:
// backend/src/analysis/sinyalKirilim.js → benzerVakalar().

export const SECENEKLER = ['1', 'X', '2'];

// BENZERLİK TOLERANSI — üç yüzdenin de bu kadar puan içinde olması gerekir.
// Sabittir; kullanıcıya tolerans seçtirilmez (sadelik kararı, 2026-08-08).
// Tek yüzdeye bakmak yanıltır: "%44 ev" iki farklı dağılımda çok farklı anlam
// taşır — bu yüzden 1, X ve 2'nin ÜÇÜ birden sınanır.
export const TOLERANS = 3;

// Yorumlanabilir sayılmak için gereken en az maç. Arka uçtaki AZ_ORNEKLEM ile
// aynı sayı (backend/src/analysis/sinyalKirilim.js) — iki yerde iki farklı
// eşik olursa aynı veri iki ekranda farklı güvenle sunulur.
export const AZ_ORNEKLEM = 5;

// ÜST SATIRDAKİ YENİ MODLAR. Birim farkı kritiktir: bu iki mod seçilince alt
// satırdaki çipler HAFTA değil MAÇ sayar.
export const DNA_SUZGEC_MODLARI = [
  { k: 'oynanmaYuzdesi', label: 'Oynanma %' },
  { k: 'oran', label: 'Oran' },
];

const SUZGEC_ANAHTARLARI = new Set(DNA_SUZGEC_MODLARI.map((m) => m.k));
/** Seçili dönem anahtarı yeni süzgeç modlarından biri mi? */
export const suzgecModuMu = (k) => SUZGEC_ANAHTARLARI.has(k);
export const SUZGEC_ETIKET = Object.fromEntries(DNA_SUZGEC_MODLARI.map((m) => [m.k, m.label]));

// ALT SATIR — kaç geçmiş MAÇ alınacağı. 'tum' sınırsızdır (null).
export const MAC_LIMITLERI = [
  { k: 'son5', label: 'Son 5 maç', limit: 5 },
  { k: 'son10', label: 'Son 10 maç', limit: 10 },
  { k: 'son15', label: 'Son 15 maç', limit: 15 },
  { k: 'tum', label: 'Tüm maçlar', limit: null },
];
export const MAC_LIMIT_DEGERI = Object.fromEntries(MAC_LIMITLERI.map((m) => [m.k, m.limit]));
export const MAC_LIMIT_ETIKET = Object.fromEntries(MAC_LIMITLERI.map((m) => [m.k, m.label]));

/**
 * Sayı mı? null/undefined/''/boolean AÇIKÇA elenir.
 *
 * DİKKAT — `Number(null) === 0`. Yalnız `Number.isFinite(Number(v))` denseydi
 * oynanma verisi OLMAYAN geçmiş maç "%0 oynanmış" sayılır ve süzgece girerdi;
 * yani olmayan veriden benzerlik üretirdik. (tasks/lessons.md §12)
 */
export function sayi(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Üç seçeneğin DE geçerli sayısı varsa {1,X,2} döner; biri bile eksikse null.
 * Eksik seçeneği 0 sayıp devam etmek, kısmi kaydı tam kayıt gibi gösterirdi.
 */
export function yuzdeUclusu(pct) {
  if (!pct || typeof pct !== 'object') return null;
  const out = {};
  for (const k of SECENEKLER) {
    const n = sayi(pct[k]);
    if (n === null || n < 0) return null;
    out[k] = n;
  }
  return out;
}

/** Üç yüzdenin de |fark| ≤ tolerans olması. Eksik veri "yakın" sayılmaz. */
export function yakinMi(a, b, tolerans = TOLERANS) {
  const x = yuzdeUclusu(a);
  const y = yuzdeUclusu(b);
  if (!x || !y) return false;
  return SECENEKLER.every((k) => Math.abs(x[k] - y[k]) <= tolerans);
}

/**
 * Hedefe yakın geçmiş maçlar. Giriş listesi YENİDEN ESKİYE sıralıdır
 * (backend/src/history/positionDna.js → positionMatchList), bu yüzden
 * baştan kesmek "en yeni N maç" demektir.
 */
export function benzerMaclar(liste, hedefPct, { tolerans = TOLERANS, limit = null } = {}) {
  const hedef = yuzdeUclusu(hedefPct);
  if (!hedef) return [];
  const eslesen = (liste || []).filter((m) => yakinMi(m?.played?.pct, hedef, tolerans));
  return (limit != null && limit > 0) ? eslesen.slice(0, limit) : eslesen;
}

/**
 * Maç listesinin gerçekleşen 1/X/2 dağılımı. Sonucu okunamayan satır sayılmaz;
 * hiç geçerli sonuç yoksa null döner (0 yazmak yalan olurdu).
 */
export function sonucDagilimi(maclar) {
  const sayac = { '1': 0, X: 0, '2': 0 };
  let ornek = 0;
  for (const m of maclar || []) {
    const r = m?.result;
    if (!SECENEKLER.includes(r)) continue;
    sayac[r] += 1;
    ornek += 1;
  }
  if (!ornek) return null;
  return {
    ornek,
    sayac,
    pct: {
      '1': (sayac['1'] * 100) / ornek,
      X: (sayac.X * 100) / ornek,
      '2': (sayac['2'] * 100) / ornek,
    },
  };
}

/**
 * SÜZGECİN TAMAMI — ekranın tek çağırdığı fonksiyon.
 *
 * @param {object[]} liste     sıranın geçmiş maçları (yeniden eskiye)
 * @param {object} hedefPct    güncel haftanın oynanma yüzdesi {1,X,2}
 * @param {number} tolerans    yakınlık payı (varsayılan ±3 puan)
 * @param {number|null} limit  kaç maç alınacak (null = sınırsız)
 * @returns {{maclar, pct, ornek, az, sebep}}
 *   sebep: 'hedefYok' | 'eslesmeYok' | null — yüzde YAZILMADIĞINDA nedeni.
 */
export function oynanmaSuzgeci({
  liste, hedefPct, tolerans = TOLERANS, limit = null, azSinir = AZ_ORNEKLEM,
} = {}) {
  const hedef = yuzdeUclusu(hedefPct);
  // Güncel maçın yüzdesi yoksa KIYAS KURULAMAZ. Boş listeyle devam edip
  // "eşleşen maç yok" demek, sebebi yanlış yere (geçmişe) yıkardı.
  if (!hedef) return { hedef: null, maclar: [], pct: null, ornek: 0, az: false, sebep: 'hedefYok' };

  const maclar = benzerMaclar(liste, hedef, { tolerans, limit });
  const dagilim = sonucDagilimi(maclar);
  if (!dagilim) return { hedef, maclar, pct: null, ornek: 0, az: false, sebep: 'eslesmeYok' };

  return {
    hedef,
    maclar,
    pct: dagilim.pct,
    ornek: dagilim.ornek,
    az: dagilim.ornek < azSinir,
    sebep: null,
  };
}
