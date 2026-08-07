// ---------------------------------------------------------------------------
// KRİTER KIRILIMI — "bu kriter NEREDE başarılı" (saf modül, 2026-08-07)
// ---------------------------------------------------------------------------
// NEDEN VAR: karne "xG Karşı %58" diyor. Bu sayı tek başına YANILTICIDIR ve
// kullanıcı bunu doğru teşhis etti: bir kriter ağır favorili maçlarda %80,
// denk maçlarda %35 tutuyor olabilir. Ortalaması %58 çıkar ve iki gerçeği de
// gizler. Karar verirken lazım olan ortalama değil, ÖNÜNDEKİ MAÇA BENZEYEN
// maçlardaki davranıştır.
//
// BU DOSYA, tek bir kriterin geçmişini beş eksende keser:
//   1. Bülten sırası          (1-5 / 6-10 / 11-15 ve tek tek 1..15)
//   2. Maç tipi               — oranlara göre: ağır favori → denk → belirsiz
//   3. Kalabalık profili      — oynanma yüzdesine göre: emin → dağınık
//   4. Kriterin söylediği yön (1 / X / 2)
//   5. KALABALIKLA UYUM       — kriter, çoğunluğun favorisiyle aynı şeyi mi
//                               söylüyor, yoksa ters mi düşüyor?
//
// 5. EKSEN NEDEN EN ÖNEMLİSİ: kalabalıkla hep aynı şeyi söyleyen bir kriterin
// yüksek başarısı bir şey ÖĞRETMEZ — favori zaten çoğu zaman kazanır. Değerli
// olan, ters düştüğünde de haklı çıkabilen kriterdir. Ortalama başarı bu iki
// durumu tek sayıya ezer; burada ayrılır.
//
// ═══════════════════════ DÜRÜSTLÜK KURALLARI ═══════════════════════════════
//  • Her hücre `hucre()` ile üretilir: veri yoksa oran `null`, 0 DEĞİL.
//  • AZ_ORNEKLEM altındaki hücre `azOrneklem: true` taşır. Gizlenmez ama
//    işaretlenir — bugünkü arşivde hemen her hücre bu durumda olacaktır ve
//    ekranın bunu söylemesi gerekir.
//  • Veri (oran / oynanma) olmayan maç bir banda ZORLA sokulmaz; `bilinmiyor`
//    grubunda sayılır. `Number(null) === 0` tuzağına düşmemek için her sayısal
//    okuma açıkça denetlenir.
//  • Hiçbir yerde gelecek cümlesi kurulmaz; bunlar geçmiş gözlemleridir.

import { AZ_ORNEKLEM, hucre, oran } from './sinyalKirilim.js';

export { AZ_ORNEKLEM };

/** Sayıyı güvenle okur. null/''/boolean → null (0 sayılmaz). */
function sayi(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// MAÇ TİPİ — maç öncesi mühürlenmiş orana göre.
// ---------------------------------------------------------------------------
// Eşikler oranın kendi anlamından gelir: 1.50 altı ~%67+ zımni olasılık
// (piyasa çok emin), 2.20 altı belirgin favori, 2.80 altı denk, üstü ise
// üç sonucun da ciddi ihtimalle mümkün olduğu açık maç.
export const MAC_TIPLERI = Object.freeze([
  { ad: 'agirFavori', baslik: 'Ağır favori', alt: 0, ust: 1.50, aciklama: 'En düşük oran 1.50 altı — piyasa çok emin.' },
  { ad: 'favori', baslik: 'Favori var', alt: 1.50, ust: 2.20, aciklama: 'Belirgin bir favori var ama kesin değil.' },
  { ad: 'denk', baslik: 'Denk', alt: 2.20, ust: 2.80, aciklama: 'Taraflar yakın; favori zayıf.' },
  { ad: 'acik', baslik: 'Açık / zor', alt: 2.80, ust: Infinity, aciklama: 'En düşük oran bile yüksek — üç sonuç da mümkün.' },
]);

/** Bir maçın tipini oranlarından belirler. Oran yoksa null (uydurulmaz). */
export function macTipi(oranlar) {
  if (!oranlar) return null;
  const d = [oranlar.home, oranlar.draw, oranlar.away].map(sayi).filter((x) => x != null && x > 1);
  if (d.length !== 3) return null;
  const enDusuk = Math.min(...d);
  const t = MAC_TIPLERI.find((x) => enDusuk >= x.alt && enDusuk < x.ust);
  return t ? t.ad : null;
}

// ---------------------------------------------------------------------------
// KALABALIK PROFİLİ — oynanma yüzdelerine göre.
// ---------------------------------------------------------------------------
export const KALABALIK_PROFILLERI = Object.freeze([
  { ad: 'cokEmin', baslik: 'Kalabalık çok emin', alt: 70, ust: Infinity, aciklama: 'Bir sonuca %70+ oynanmış.' },
  { ad: 'kararli', baslik: 'Kalabalık kararlı', alt: 55, ust: 70, aciklama: 'Belirgin ama ezici olmayan tercih.' },
  { ad: 'bolunmus', baslik: 'Kalabalık bölünmüş', alt: 40, ust: 55, aciklama: 'Tercih zayıf.' },
  { ad: 'dagimik', baslik: 'Kalabalık dağınık', alt: 0, ust: 40, aciklama: 'Hiçbir sonuç öne çıkmamış.' },
]);

/** En çok oynanan sonucun payına göre profil. Veri yoksa null. */
export function kalabalikProfili(oynanma) {
  if (!oynanma) return null;
  const d = ['1', 'X', '2'].map((k) => sayi(oynanma[k])).filter((x) => x != null);
  if (d.length !== 3) return null;
  const enYuksek = Math.max(...d);
  const p = KALABALIK_PROFILLERI.find((x) => enYuksek >= x.alt && enYuksek < x.ust);
  return p ? p.ad : null;
}

/** Kalabalığın favorisi (en çok oynanan sonuç). Veri yoksa null. */
export function kalabaliginFavorisi(oynanma) {
  if (!oynanma) return null;
  let en = null;
  for (const k of ['1', 'X', '2']) {
    const v = sayi(oynanma[k]);
    if (v == null) return null;                 // eksik veri → tahmin yürütülmez
    if (en === null || v > sayi(oynanma[en])) en = k;
  }
  return en;
}

/** Piyasanın favorisi (en düşük oran). Veri yoksa null. */
export function piyasaninFavorisi(oranlar) {
  if (!oranlar) return null;
  const esle = { home: '1', draw: 'X', away: '2' };
  let en = null; let enDeger = null;
  for (const [alan, sembol] of Object.entries(esle)) {
    const v = sayi(oranlar[alan]);
    if (v == null || v <= 1) return null;
    if (enDeger === null || v < enDeger) { enDeger = v; en = sembol; }
  }
  return en;
}

// ---------------------------------------------------------------------------
// GRUPLAMA YARDIMCISI — kayıtları bir etiketleyiciye göre böler ve
// her grubun hücresini üretir. Etiketi null olan kayıt "bilinmiyor"a düşer.
// ---------------------------------------------------------------------------
function grupla(kayitlar, etiketle, tanimlar) {
  const kova = new Map();
  let bilinmiyor = { mac: 0, dogru: 0 };

  for (const k of kayitlar) {
    const et = etiketle(k);
    if (et == null) {
      bilinmiyor.mac += 1;
      if (k.sinyal === k.sonuc) bilinmiyor.dogru += 1;
      continue;
    }
    if (!kova.has(et)) kova.set(et, { mac: 0, dogru: 0 });
    const g = kova.get(et);
    g.mac += 1;
    if (k.sinyal === k.sonuc) g.dogru += 1;
  }

  const satirlar = tanimlar.map((t) => {
    const g = kova.get(t.ad) || { mac: 0, dogru: 0 };
    return { ad: t.ad, baslik: t.baslik, aciklama: t.aciklama || null, ...hucre(g.dogru, g.mac) };
  });

  return {
    satirlar,
    bilinmiyor: { ...hucre(bilinmiyor.dogru, bilinmiyor.mac), baslik: 'Veri yok' },
  };
}

// ---------------------------------------------------------------------------
// ANA FONKSİYON
// ---------------------------------------------------------------------------
/**
 * Tek kriterin geçmişini beş eksende keser.
 *
 * @param {Array} kayitlar  sinyalToplama çıktısı: {no, sonuc, sinyal, oynanma, oran, ...}
 * @returns {object} kırılım
 */
export function kriterKirilimi(kayitlar) {
  // YALNIZ kriterin YÖN SÖYLEDİĞİ ve resmî sonucu olan maçlar ölçülebilir.
  // Yön söylemediği maç "başarısız" değildir; ölçüm dışıdır.
  const olculebilir = (kayitlar || []).filter((k) => k && k.sinyal && k.sonuc);
  const toplamDogru = olculebilir.filter((k) => k.sinyal === k.sonuc).length;

  const genel = hucre(toplamDogru, olculebilir.length);

  // 1) SIRA — hem üçlü grup hem tek tek. 15 hücreye 12 maç bölmek anlamsız
  //    olduğu için grup görünümü öne konur; tekil liste yine de verilir.
  const siraGruplari = grupla(olculebilir, (k) => {
    const no = sayi(k.no);
    if (no == null || no < 1 || no > 15) return null;
    if (no <= 5) return 'ilk5';
    if (no <= 10) return 'orta5';
    return 'son5';
  }, [
    { ad: 'ilk5', baslik: '1-5. sıra' },
    { ad: 'orta5', baslik: '6-10. sıra' },
    { ad: 'son5', baslik: '11-15. sıra' },
  ]);

  const siraTekil = [];
  for (let no = 1; no <= 15; no += 1) {
    const kesit = olculebilir.filter((k) => sayi(k.no) === no);
    siraTekil.push({
      no,
      ...hucre(kesit.filter((k) => k.sinyal === k.sonuc).length, kesit.length),
    });
  }

  // 2) MAÇ TİPİ (oran)
  const macTipleri = grupla(olculebilir, (k) => macTipi(k.oran), MAC_TIPLERI);

  // 3) KALABALIK PROFİLİ (oynanma)
  const kalabalik = grupla(olculebilir, (k) => kalabalikProfili(k.oynanma), KALABALIK_PROFILLERI);

  // 4) KRİTERİN SÖYLEDİĞİ YÖN
  const yonler = grupla(olculebilir, (k) => (['1', 'X', '2'].includes(k.sinyal) ? k.sinyal : null), [
    { ad: '1', baslik: 'Ev sahibi (1) dediğinde' },
    { ad: 'X', baslik: 'Beraberlik (X) dediğinde' },
    { ad: '2', baslik: 'Deplasman (2) dediğinde' },
  ]);

  // 5) KALABALIKLA UYUM — bu ekranın asıl cevabı.
  const uyum = grupla(olculebilir, (k) => {
    const fav = kalabaliginFavorisi(k.oynanma);
    if (!fav) return null;
    return k.sinyal === fav ? 'ayni' : 'ters';
  }, [
    { ad: 'ayni', baslik: 'Kalabalıkla AYNI yönü söylediğinde', aciklama: 'Çoğunluğun favorisini tekrar ediyor.' },
    { ad: 'ters', baslik: 'Kalabalığa TERS düştüğünde', aciklama: 'Çoğunluktan ayrılıyor — asıl katkı burada ölçülür.' },
  ]);

  // 5b) PİYASAYLA UYUM — aynı mantık, oran tarafı.
  const piyasaUyum = grupla(olculebilir, (k) => {
    const fav = piyasaninFavorisi(k.oran);
    if (!fav) return null;
    return k.sinyal === fav ? 'ayni' : 'ters';
  }, [
    { ad: 'ayni', baslik: 'Piyasa favorisiyle AYNI', aciklama: 'En düşük oranı işaret ediyor.' },
    { ad: 'ters', baslik: 'Piyasa favorisine TERS', aciklama: 'Düşük oranlıya karşı çıkıyor.' },
  ]);

  return {
    genel,
    olculebilirMac: olculebilir.length,
    azOrneklemEsigi: AZ_ORNEKLEM,
    siraGruplari,
    siraTekil,
    macTipleri,
    kalabalik,
    yonler,
    kalabalikUyumu: uyum,
    piyasaUyumu: piyasaUyum,
    // HER SAYININ ARKASINDAKİ MAÇLAR. Ekran bunu bantlara göre süzer;
    // böylece "9 maçta 6" satırına basınca o 9 maç görünür.
    ...macListesi(olculebilir),
    // Ekranın en üstünde duracak dürüstlük cümlesi: hücrelerin çoğu az
    // örneklemliyse bu tablodan sonuç çıkarılamaz ve bu SÖYLENİR.
    uyari: uyariMetni(olculebilir.length),
  };
}

/** Örneklem büyüklüğüne göre dürüst uyarı metni. */
export function uyariMetni(macSayisi) {
  if (!macSayisi) {
    return 'Bu kriterin yön söylediği, resmî sonucu gelmiş hiç maç yok — kırılım hesaplanamaz.';
  }
  if (macSayisi < 30) {
    return `Bu kriter toplam ${macSayisi} maçta yön söyledi. Bu sayı beş ayrı eksene `
      + 'bölündüğünde her hücreye 2-3 maç düşer; hücrelerdeki yüzdeler henüz '
      + 'KANIT DEĞİLDİR, yalnız gözlemdir. Karar dayanağı olarak kullanma. '
      + 'Hafta sayısı arttıkça bu tablo anlam kazanır.';
  }
  if (macSayisi < 100) {
    return `Toplam ${macSayisi} maç. Ana eksenlerde eğilim okunabilir ama `
      + `${AZ_ORNEKLEM} maçın altındaki hücreler işaretlidir ve tesadüfe açıktır.`;
  }
  return `Toplam ${macSayisi} maç. ${AZ_ORNEKLEM} maçın altındaki hücreler işaretlidir.`;
}

// ---------------------------------------------------------------------------
// MAÇ LİSTESİ — her sayının arkasındaki maçlar (2026-08-07)
// ---------------------------------------------------------------------------
// NEDEN VAR: "9 maçta 6 doğru" bir sonuç değil, bir SORU'dur. Kullanıcı haklı
// olarak "o 9 maç hangileriydi, favori miydi sürpriz miydi, oranı neydi, kaç
// oynanmıştı, kaçıncı sıradaydı?" diye sordu. Bu bilgi olmadan yüzde havada
// kalır ve kimse kriteri gerçekten tanıyamaz.
//
// Her satır KENDİ ETİKETLERİNİ taşır; ekran istediği eksene göre süzer.
// Aynı listeyi her bant için tekrar göndermek yerine tek liste + etiket
// gönderilir (yanıt küçük kalır, sayılar tek kaynaktan gelir).

/** Sonuç, favoriden farklıysa sürpriz. Favori bilinmiyorsa null (uydurulmaz). */
export function surprizMi(sonuc, favori) {
  if (!sonuc || !favori) return null;
  return sonuc !== favori;
}

/** Bir maçın en düşük oranı (favori oranı). Yoksa null. */
export function favoriOrani(oranlar) {
  if (!oranlar) return null;
  const d = [oranlar.home, oranlar.draw, oranlar.away].map(sayi).filter((x) => x != null && x > 1);
  return d.length === 3 ? Math.min(...d) : null;
}

/**
 * Ölçülebilir maçları, ekranın süzebileceği etiketlerle döndürür.
 * @param {Array} kayitlar sinyalToplama çıktısı
 * @param {number} [limit] yanıtın şişmemesi için üst sınır
 */
export function macListesi(kayitlar, limit = 300) {
  const olculebilir = (kayitlar || []).filter((k) => k && k.sinyal && k.sonuc);
  // En yeni hafta önce; kesilmesi gerekirse ESKİ maçlar kesilir.
  const sirali = olculebilir.slice().sort((a, b) => (
    (sayi(b.roundId) ?? 0) - (sayi(a.roundId) ?? 0) || (sayi(a.no) ?? 0) - (sayi(b.no) ?? 0)
  ));
  const kesildi = Math.max(0, sirali.length - limit);

  const maclar = sirali.slice(0, limit).map((k) => {
    const kalFav = kalabaliginFavorisi(k.oynanma);
    const piyFav = piyasaninFavorisi(k.oran);
    return {
      roundId: k.roundId ?? null,
      hafta: k.hafta ?? null,
      no: sayi(k.no),
      ev: k.home ?? null,
      deplasman: k.away ?? null,
      lig: k.lig ?? null,
      tarih: k.tarih ?? null,
      skor: k.skor ?? null,
      sonuc: k.sonuc,
      sinyal: k.sinyal,
      dogru: k.sinyal === k.sonuc,
      // Oranlar: ham üçlü + favori oranı (ekran ikisini de gösterebilsin).
      oran: k.oran ?? null,
      favoriOrani: favoriOrani(k.oran),
      piyasaFavorisi: piyFav,
      // Oynanma: ham üçlü + kalabalığın favorisi ve payı.
      oynanma: k.oynanma ?? null,
      kalabalikFavorisi: kalFav,
      kalabalikPayi: kalFav ? sayi(k.oynanma?.[kalFav]) : null,
      // Bantlar — kırılım tablolarıyla BİREBİR aynı fonksiyonlardan gelir,
      // böylece liste ile özet asla çelişmez.
      macTipi: macTipi(k.oran),
      kalabalikProfili: kalabalikProfili(k.oynanma),
      // SÜRPRİZ: resmî sonuç favoriden farklı mı. İki tanım ayrı verilir,
      // çünkü kalabalık ile piyasa aynı şeyi söylemeyebilir.
      surprizPiyasa: surprizMi(k.sonuc, piyFav),
      surprizKalabalik: surprizMi(k.sonuc, kalFav),
      kriterKalabalikla: kalFav ? (k.sinyal === kalFav ? 'ayni' : 'ters') : null,
      kriterPiyasayla: piyFav ? (k.sinyal === piyFav ? 'ayni' : 'ters') : null,
      kesif: k.kesif === true,
    };
  });

  return { maclar, kesildi, toplam: olculebilir.length };
}
