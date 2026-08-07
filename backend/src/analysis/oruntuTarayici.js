// ---------------------------------------------------------------------------
// ÖRÜNTÜ TARAYICI — sistem kendi bulur (saf modül, testli)
// ---------------------------------------------------------------------------
// NEDEN VAR: ilk sürümde kullanıcıya "sıra ve oynanma yüzdelerini yaz, ara"
// diyen bir kutu koymuştuk. Bu, keşif işini kullanıcıya yıkmaktı: 15 sıra ×
// onlarca oynanma bandı × 46 sinyal elle taranamaz. Kullanıcı haklı olarak
// "bunu ben değil sistem bulacak" dedi. Bu dosya o işi yapar.
//
// NE YAPAR: geçmiş maçları farklı KURAL ŞEKİLLERİNE göre gruplar, her grubun
// sonuç dağılımını çıkarır ve "beklenenden belirgin biçimde sapan" grupları
// örüntü olarak bildirir.
//
// ═══════════════ İSTATİSTİKSEL DÜRÜSTLÜK — BU DOSYANIN OMURGASI ═══════════
//
// Örüntü aramak tehlikelidir: yeterince çok kombinasyon denenirse, tamamen
// rastgele veride bile "çarpıcı" örüntüler bulunur. Bu dosya bu tuzağa karşı
// dört savunma kurar ve HİÇBİRİ isteğe bağlı değildir:
//
//  1. EN AZ ÖRNEKLEM. `minOrneklem` altındaki grup hiç değerlendirilmez.
//     2 maçlık "%100" bir örüntü değil, bir tesadüftür.
//
//  2. TABAN ORANLA KARŞILAŞTIRMA (lift). Bir grupta %60 ev sahibi çıkması,
//     genelde de %60 ev sahibi çıkıyorsa BİLGİ DEĞİLDİR. Örüntü, taban
//     orandan sapma kadar vardır.
//
//  3. DENENEN KOMBİNASYON SAYISI RAPORLANIR. Kaç kural denendiği çıktıda
//     yazar; kullanıcı "500 kural denenmiş, 3 tanesi çarpıcı çıkmış" ile
//     "5 kural denenmiş, 3'ü çarpıcı" arasındaki farkı görebilsin.
//
//  4. GÜVEN DERECESİ DÜŞÜK BAŞLAR. Örneklem küçükken hiçbir örüntü "güçlü"
//     etiketi almaz. Etiketler: zayıf / orta / güçlü — ve "güçlü" için hem
//     yüksek sapma hem yeterli örneklem şarttır.
//
// Çıktıda "olacak", "kesin", "banko" gibi bir sözcük YOKTUR. Bulunan şey
// GEÇMİŞTEKİ bir eğilimdir; gelecek vaadi değildir.

import { AZ_ORNEKLEM, oran } from './sinyalKirilim.js';

/** Bir kuralın örüntü sayılması için en az kaç maç gerekir. */
export const MIN_ORNEKLEM = 6;

/** Baskın sonucun payı bu oranın altındaysa örüntü sayılmaz (%). */
export const MIN_BASKINLIK = 55;

/** Taban orandan en az bu kadar puan sapmalı (yüzde puanı). */
export const MIN_SAPMA = 12;

/** Oynanma yüzdesi bantları — 5'lik dilimler okunabilir ve kararlıdır. */
export const BANT_GENISLIK = 5;

const SONUCLAR = ['1', 'X', '2'];

/**
 * Bir yüzdeyi banda çevirir: 44 → "40-45". Saf.
 *
 * null/undefined AÇIKÇA elenir. `Number(null)` JavaScript'te 0'dır; yalnız
 * `Number.isFinite` denseydi, oynanma verisi OLMAYAN maç "%0-5 bandı" diye
 * gerçek bir gruba girer ve örüntü taraması uydurma bir dilim üretirdi.
 * (Aynı tuzak sinyalKirilim.js'te de vardı; ikisi de testle yakalandı.)
 */
export function bant(deger, genislik = BANT_GENISLIK) {
  if (deger === null || deger === undefined || deger === '' || typeof deger === 'boolean') return null;
  const n = Number(deger);
  if (!Number.isFinite(n)) return null;
  const alt = Math.floor(n / genislik) * genislik;
  return `${alt}-${alt + genislik}`;
}

/** Sonuç dağılımı + baskın sonuç. Saf. */
export function dagilimHesapla(kayitlar) {
  const sayac = { 1: 0, X: 0, 2: 0 };
  let toplam = 0;
  for (const k of kayitlar || []) {
    if (sayac[k.sonuc] === undefined) continue;
    sayac[k.sonuc] += 1;
    toplam += 1;
  }
  if (!toplam) return null;
  let baskin = null;
  for (const s of SONUCLAR) if (!baskin || sayac[s] > sayac[baskin]) baskin = s;
  return {
    toplam,
    sayac,
    baskin,
    baskinPay: oran(sayac[baskin], toplam),
    dagilim: SONUCLAR.reduce((a, s) => { a[s] = oran(sayac[s], toplam); return a; }, {}),
  };
}

/**
 * Güven derecesi — hem SAPMA hem ÖRNEKLEM gerektirir.
 * Küçük örneklemde büyük sapma "güçlü" sayılmaz; tesadüf olma ihtimali yüksektir.
 */
export function guvenDerecesi(orneklem, sapma) {
  if (orneklem >= 20 && sapma >= 25) return 'güçlü';
  if (orneklem >= 12 && sapma >= 18) return 'orta';
  return 'zayıf';
}

/**
 * Kural üreticileri. Her biri bir maçtan "bu maç hangi gruba girer" etiketi
 * üretir; null dönerse maç o kurala girmez (eksik veri sessizce 0 sayılmaz).
 *
 * NEDEN BU DÖRT ŞEKİL: kullanıcının gözlemi "aynı sıra + benzer oynanma →
 * aynı sonuç" idi. Şekiller o gözlemin genellemesidir; ayrıca sinyalin kendi
 * katkısını ölçmek için sinyal+sıra birleşimi de taranır.
 */
export const KURAL_SEKILLERI = Object.freeze([
  {
    ad: 'sira',
    baslik: 'Bülten sırası',
    etiket: (m) => (Number.isFinite(Number(m.no)) ? `${m.no}. sıra` : null),
  },
  {
    ad: 'sira-ev-bandi',
    baslik: 'Sıra + ev oynanma bandı',
    etiket: (m) => {
      const b = m.oynanma ? bant(m.oynanma['1']) : null;
      if (!b || !Number.isFinite(Number(m.no))) return null;
      return `${m.no}. sıra · ev oynanma %${b}`;
    },
  },
  {
    ad: 'sira-x-bandi',
    baslik: 'Sıra + beraberlik oynanma bandı',
    etiket: (m) => {
      const b = m.oynanma ? bant(m.oynanma.X) : null;
      if (!b || !Number.isFinite(Number(m.no))) return null;
      return `${m.no}. sıra · X oynanma %${b}`;
    },
  },
  {
    ad: 'ev-bandi',
    baslik: 'Ev oynanma bandı (sıradan bağımsız)',
    etiket: (m) => {
      const b = m.oynanma ? bant(m.oynanma['1']) : null;
      return b ? `ev oynanma %${b}` : null;
    },
  },
  {
    ad: 'sinyal-sira',
    baslik: 'Sinyal yönü + sıra',
    etiket: (m) => {
      if (!m.sinyal || !Number.isFinite(Number(m.no))) return null;
      return `sinyal ${m.sinyal} · ${m.no}. sıra`;
    },
  },
  {
    ad: 'favori-baskinligi',
    baslik: 'Kalabalığın favorisi ne kadar baskın',
    etiket: (m) => {
      if (!m.oynanma) return null;
      const d = SONUCLAR.map((s) => Number(m.oynanma[s])).filter(Number.isFinite);
      if (d.length !== 3) return null;
      const enYuksek = Math.max(...d);
      const b = bant(enYuksek, 10);
      return b ? `favori oynanma %${b}` : null;
    },
  },
]);

/**
 * ÖRÜNTÜ TARAMASI — sistem kendi bulur.
 *
 * @param {Array} kayitlar  sinyalToplama çıktısı
 * @param {object} [opt]
 * @returns {{oruntuler, taban, taranan, elenen, esikler, uyari}}
 */
export function oruntuTara(kayitlar, opt = {}) {
  const minOrneklem = opt.minOrneklem ?? MIN_ORNEKLEM;
  const minBaskinlik = opt.minBaskinlik ?? MIN_BASKINLIK;
  const minSapma = opt.minSapma ?? MIN_SAPMA;
  const liste = (kayitlar || []).filter((k) => k.sonuc);

  // TABAN ORAN: karşılaştırma noktası. Bu olmadan "%60 ev" bilgi sanılır.
  const taban = dagilimHesapla(liste);
  if (!taban) {
    return {
      oruntuler: [], taban: null, taranan: 0, elenen: 0,
      esikler: { minOrneklem, minBaskinlik, minSapma },
      uyari: 'Sonuçlanmış maç yok — örüntü aranamaz.',
    };
  }

  const oruntuler = [];
  let taranan = 0;
  let elenen = 0;

  for (const sekil of KURAL_SEKILLERI) {
    const gruplar = new Map();
    for (const m of liste) {
      const et = sekil.etiket(m);
      if (!et) continue;                       // eksik veri → gruba girmez
      if (!gruplar.has(et)) gruplar.set(et, []);
      gruplar.get(et).push(m);
    }

    for (const [etiket, grup] of gruplar) {
      taranan += 1;
      if (grup.length < minOrneklem) { elenen += 1; continue; }
      const d = dagilimHesapla(grup);
      if (!d || d.baskinPay == null) { elenen += 1; continue; }
      if (d.baskinPay < minBaskinlik) { elenen += 1; continue; }

      // SAPMA: grubun baskın sonucu, GENEL oranına göre ne kadar öne çıkmış?
      const tabanPay = taban.dagilim[d.baskin] ?? 0;
      const sapma = Math.round((d.baskinPay - tabanPay) * 10) / 10;
      if (sapma < minSapma) { elenen += 1; continue; }

      oruntuler.push({
        sekil: sekil.ad,
        sekilBaslik: sekil.baslik,
        kural: etiket,
        mac: grup.length,
        // KEŞİF PAYI: grubun kaç maçı başarı karnesine girmeyen (mühürü zayıf)
        // haftalardan geliyor. Tamamı keşiften geliyorsa bulgu daha temkinli
        // okunmalı — bu yüzden gizlenmez, sayılır ve ekrana yazılır.
        kesifMac: grup.filter((m) => m.kesif).length,
        sonuc: d.baskin,
        pay: d.baskinPay,
        tabanPay,
        sapma,
        dagilim: d.dagilim,
        guven: guvenDerecesi(grup.length, sapma),
        // Örüntünün ARKASINDAKİ maçlar: sayı doğrulanabilir olmalı.
        maclar: grup.map((m) => ({
          roundId: m.roundId, hafta: m.hafta, no: m.no,
          home: m.home, away: m.away, skor: m.skor,
          oynanma: m.oynanma, sonuc: m.sonuc,
        })),
      });
    }
  }

  // Sıralama: önce sapma, eşitse örneklem. "Çarpıcı ama tek maçlık" üste çıkmasın.
  oruntuler.sort((a, b) => (b.sapma - a.sapma) || (b.mac - a.mac));

  // ÇOKLU KARŞILAŞTIRMA UYARISI — gizlenmemesi gereken gerçek.
  let uyari = null;
  if (taban.toplam < 60) {
    uyari = `Arşivde yalnız ${taban.toplam} sonuçlanmış maç var. Bu boyutta bulunan `
      + 'örüntüler büyük olasılıkla tesadüftür; liste bilgi amaçlıdır.';
  } else if (oruntuler.length && taranan > 50) {
    uyari = `${taranan} kural denendi. Çok sayıda kural denendiğinde rastgele veride `
      + 'bile çarpıcı görünen gruplar çıkar; örüntüleri örneklem sayısıyla birlikte oku.';
  }

  return {
    oruntuler,
    taban: { toplam: taban.toplam, dagilim: taban.dagilim },
    taranan,
    elenen,
    esikler: { minOrneklem, minBaskinlik, minSapma },
    uyari,
    not: 'Bulunan şey GEÇMİŞTEKİ eğilimdir; gelecek maç için vaat değildir.',
  };
}

/**
 * SİNYAL BAŞARISI TARAMASI — "bu sinyal HANGİ DİLİMDE daha iyi tutuyor?"
 * ---------------------------------------------------------------------------
 * `oruntuTara` bir grupta HANGİ SONUCUN baskın olduğunu arar. Bu fonksiyon
 * farklı bir soruyu sorar ve kullanıcının istediği cümleyi üretir:
 *
 *   "xG Karşı · 3. sıra · ev oynanma %40-45 → 18 maçta 15 doğru (%83),
 *    kendi ortalaması %58, +25 puan"
 *
 * KARŞILAŞTIRMA NOKTASI SİNYALİN KENDİSİDİR, taban sonuç dağılımı değil.
 * Çünkü soru "bu dilimde ne çıkıyor" değil, "bu sinyal bu dilimde kendi
 * ortalamasından iyi mi" sorusudur.
 *
 * DÜŞÜK PERFORMANS DA BİLDİRİLİR (`yon: 'zayif'`). "Bu kriter 7. sırada
 * çalışmıyor" bilgisi, iyi çalıştığı yer kadar değerlidir — ve yalnız iyi
 * haberleri göstermek, aracın kendisini yanlı hâle getirir.
 *
 * @param {Array} kayitlar [{no, sinyal, sonuc, oynanma, ...}]
 */
export function sinyalBasariTara(kayitlar, opt = {}) {
  const minOrneklem = opt.minOrneklem ?? MIN_ORNEKLEM;
  const minSapma = opt.minSapma ?? MIN_SAPMA;
  // Yalnız sinyal ÜRETEN maçlar: "yön göstermedi" başarısızlık değildir.
  const liste = (kayitlar || []).filter((k) => k.sinyal && k.sonuc);

  if (liste.length < minOrneklem) {
    return {
      bulgular: [], taban: null, taranan: 0,
      esikler: { minOrneklem, minSapma },
      uyari: `Bu sinyal yalnız ${liste.length} maçta yön göstermiş — dilim analizi için yetersiz.`,
    };
  }

  const tabanDogru = liste.filter((k) => k.sinyal === k.sonuc).length;
  const tabanOran = oran(tabanDogru, liste.length);

  const bulgular = [];
  let taranan = 0;

  for (const sekil of KURAL_SEKILLERI) {
    // 'sinyal-sira' burada anlamsız: sinyalin kendi yönüne göre gruplamak,
    // başarı ölçümünü döngüsel hâle getirir.
    if (sekil.ad === 'sinyal-sira') continue;
    const gruplar = new Map();
    for (const m of liste) {
      const et = sekil.etiket(m);
      if (!et) continue;
      if (!gruplar.has(et)) gruplar.set(et, []);
      gruplar.get(et).push(m);
    }
    for (const [etiket, grup] of gruplar) {
      taranan += 1;
      if (grup.length < minOrneklem) continue;
      const dogru = grup.filter((k) => k.sinyal === k.sonuc).length;
      const grupOran = oran(dogru, grup.length);
      if (grupOran == null || tabanOran == null) continue;
      const sapma = Math.round((grupOran - tabanOran) * 10) / 10;
      if (Math.abs(sapma) < minSapma) continue;

      bulgular.push({
        sekil: sekil.ad,
        sekilBaslik: sekil.baslik,
        kural: etiket,
        mac: grup.length,
        kesifMac: grup.filter((m) => m.kesif).length,
        dogru,
        oran: grupOran,
        tabanOran,
        sapma,
        yon: sapma > 0 ? 'guclu' : 'zayif',
        guven: guvenDerecesi(grup.length, Math.abs(sapma)),
        maclar: grup.map((m) => ({
          roundId: m.roundId, hafta: m.hafta, no: m.no,
          home: m.home, away: m.away, skor: m.skor,
          oynanma: m.oynanma, sinyal: m.sinyal, sonuc: m.sonuc,
          tutmus: m.sinyal === m.sonuc,
        })),
      });
    }
  }

  bulgular.sort((a, b) => (Math.abs(b.sapma) - Math.abs(a.sapma)) || (b.mac - a.mac));

  return {
    bulgular,
    taban: {
      mac: liste.length,
      dogru: tabanDogru,
      oran: tabanOran,
      kesifMac: liste.filter((k) => k.kesif).length,
    },
    taranan,
    esikler: { minOrneklem, minSapma },
    uyari: liste.length < 60
      ? `Bu sinyal ${liste.length} maçta ölçülmüş. Bu boyutta dilim farkları büyük ölçüde tesadüf olabilir.`
      : (taranan > 50
        ? `${taranan} dilim denendi; çok dilim denendiğinde rastgele veride bile fark görünür.`
        : null),
    not: 'Karşılaştırma noktası sinyalin KENDİ ortalamasıdır. Zayıf dilimler de bildirilir.',
  };
}

/**
 * BU HAFTAYA UYAN ÖRÜNTÜLER — taranan örüntülerden, güncel bültendeki
 * maçlara denk gelenleri seçer. "Bu hafta hangi maçta geçmiş bir eğilim var?"
 *
 * @param {Array} oruntuler  oruntuTara çıktısındaki liste
 * @param {Array} buHafta    [{no, oynanma, sinyal, home, away}]
 */
export function buHaftayaUyanlar(oruntuler, buHafta) {
  const sonuc = [];
  for (const m of buHafta || []) {
    const uyan = (oruntuler || []).filter((o) => {
      const sekil = KURAL_SEKILLERI.find((s) => s.ad === o.sekil);
      if (!sekil) return false;
      return sekil.etiket(m) === o.kural;
    });
    if (!uyan.length) continue;
    sonuc.push({
      no: m.no, home: m.home, away: m.away, oynanma: m.oynanma || null,
      oruntuler: uyan.sort((a, b) => b.sapma - a.sapma),
    });
  }
  return sonuc.sort((a, b) => a.no - b.no);
}

// ---------------------------------------------------------------------------
// İLERİ-DOĞRULAMA (out-of-sample) — 2026-08-07
// ---------------------------------------------------------------------------
// BU BÖLÜM, YUKARIDAKİ TARAMANIN EN ZAYIF NOKTASINI KAPATIR.
//
// `oruntuTara` bir örüntüyü, o örüntüyü BULDUĞU verinin üzerinde ölçer. Bu
// kaçınılmaz olarak iyimserdir: yeterince çok kural denenirse rastgele veride
// bile çarpıcı gruplar çıkar ve aynı veride ölçülünce hepsi "başarılı" görünür.
// Eşikler bunu azaltır, YOK ETMEZ.
//
// Tek gerçek sınav şudur: örüntüyü ESKİ haftalarda bul, HİÇ GÖRMEDİĞİ yeni
// haftalarda dene. Tutarsa bir şey öğrenmişizdir; tutmazsa geçmişe uydurulmuş
// bir şekildir. Bu ayrım, "sistem çalışıyor mu" sorusunun tek dürüst cevabıdır.
//
// YETERSİZ VERİDE NE OLUR: uydurma sonuç ÜRETİLMEZ. `yeterli:false` döner ve
// kaç hafta gerektiği yazılır. Bugün elde 1-2 hafta var; bu fonksiyonun ilk
// işi, o gerçeği ekrana söylemektir.

/** İleri-doğrulama için gereken EN AZ hafta sayısı (eğitim + sınav). */
export const MIN_HAFTA = 3;

/** Bir kuralın sınav kümesindeki karşılığını ölçer. Saf. */
function kuralOlc(sekilAd, etiket, liste) {
  const sekil = KURAL_SEKILLERI.find((k) => k.ad === sekilAd);
  if (!sekil) return null;
  return liste.filter((m) => sekil.etiket(m) === etiket);
}

/**
 * SONUÇ ÖRÜNTÜLERİ için ileri-doğrulama.
 * Eski haftalarda bulunan örüntü, son `testHafta` haftada da tuttu mu?
 *
 * @param {Array} kayitlar   sinyalToplama çıktısı (roundId taşımalı)
 * @param {object} [opt]     testHafta + oruntuTara eşikleri
 */
export function ileriDogrula(kayitlar, opt = {}) {
  const testHafta = opt.testHafta ?? 1;
  const liste = (kayitlar || []).filter((k) => k.sonuc && Number.isFinite(Number(k.roundId)));
  const haftalar = [...new Set(liste.map((k) => Number(k.roundId)))].sort((a, b) => a - b);

  // DÜRÜSTLÜK KAPISI: veri yetmiyorsa sonuç uydurulmaz.
  if (haftalar.length < MIN_HAFTA) {
    return {
      yeterli: false,
      hafta: haftalar.length,
      gerekenHafta: MIN_HAFTA,
      bulgular: [],
      sebep: `İleri-doğrulama için en az ${MIN_HAFTA} sonuçlanmış hafta gerekir; `
        + `şu an ${haftalar.length} hafta var. Bu sayı altında "örüntü tuttu" demek, `
        + 'örüntüyü bulduğu verinin üzerinde ölçmek olur — kendini doğrulayan bir ölçüdür.',
    };
  }

  const sinavHaftalari = new Set(haftalar.slice(-testHafta));
  const egitim = liste.filter((k) => !sinavHaftalari.has(Number(k.roundId)));
  const sinav = liste.filter((k) => sinavHaftalari.has(Number(k.roundId)));

  // Örüntüler YALNIZ eğitim verisinde aranır. Sınav verisi burada görülmez.
  const tarama = oruntuTara(egitim, opt);

  const bulgular = [];
  for (const o of tarama.oruntuler) {
    const sinavGrup = kuralOlc(o.sekil, o.kural, sinav) || [];
    const d = dagilimHesapla(sinavGrup);
    // Sınavda o kurala hiç maç düşmediyse "tuttu" da "tutmadı" da denmez.
    const tuttu = d ? (d.dagilim[o.sonuc] ?? 0) : null;
    bulgular.push({
      ...o,
      sinav: {
        mac: sinavGrup.length,
        // Eğitimde baskın çıkan sonuç, sınavda kaç maçta gerçekleşti.
        isabet: sinavGrup.filter((m) => m.sonuc === o.sonuc).length,
        oran: tuttu,
        sonuc: tuttu == null ? 'veri yok' : (tuttu >= o.pay ? 'tuttu' : (tuttu >= 50 ? 'kısmen' : 'tutmadı')),
      },
    });
  }

  return {
    yeterli: true,
    hafta: haftalar.length,
    egitimHafta: haftalar.length - sinavHaftalari.size,
    sinavHafta: sinavHaftalari.size,
    sinavHaftaListesi: [...sinavHaftalari],
    egitimMac: egitim.length,
    sinavMac: sinav.length,
    taranan: tarama.taranan,
    bulgular,
    uyari: bulgular.length
      ? 'Sınav sütunu, örüntünün HİÇ GÖRMEDİĞİ haftalardaki karşılığıdır. '
        + 'Yalnız bu sütun gerçek kanıttır; soldaki oranlar örüntünün kendi verisidir.'
      : 'Eğitim verisinde eşikleri geçen örüntü çıkmadı.',
  };
}
