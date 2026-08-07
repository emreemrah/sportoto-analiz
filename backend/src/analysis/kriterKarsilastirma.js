// ---------------------------------------------------------------------------
// KRİTER KARŞILAŞTIRMA — "hangi iş için hangi kriter" (saf modül, 2026-08-07)
// ---------------------------------------------------------------------------
// KULLANICININ ANLATTIĞI ŞEY (birebir): "Claude kod yazmada başarılı, ChatGPT
// dikte ve resim üretmede. Bizim derdimiz maç değil, KRİTERİN KENDİSİ."
//
// Yani soru "bu maç ne oldu" değil; soru şu: 40 kriterin her biri HANGİ İŞTE
// iyi? Biri ağır favorili maçlarda güvenilir olabilir ama denk maçta çöker.
// Biri yalnız "2" derken iyidir. Biri kalabalığa ters düştüğünde haklı çıkar.
// Tek bir "%58 başarı" sayısı bu uzmanlıkların hepsini aynı torbaya atar.
//
// BU DOSYA TABLOYU TERS ÇEVİRİR:
//   • Kriter kırılımı  → "TEK kriter, tüm işler"   (kriterKirilim.js)
//   • Bu dosya         → "TEK iş, tüm kriterler"   (sıralama / lider tablosu)
//
// İŞ (job) = kriterin sınandığı durum: maç tipi, kalabalık profili, söylenen
// yön, kalabalıkla uyum, bülten sırası. Her iş için kriterler sıralanır.
//
// ═══════════════════ SIRALAMA NEDEN HAM YÜZDE DEĞİL ═══════════════════════
// 3 maçta 3 doğru (%100) ile 20 maçta 14 doğru (%70) yan yana konunca ham
// yüzde birinciyi üste çıkarır. Oysa 3 maçlık %100 bir uzmanlık değil, bir
// tesadüftür. Sıralama bu yüzden WILSON ALT SINIRI ile yapılır: "bu oran en
// kötü ihtimalle ne olabilir" sorusunun cevabı. Örneklem küçüldükçe ceza
// büyür. Ekranda gösterilen sayı yine HAM yüzdedir — yalnız sıra düzeltilir.
//
// DÜRÜSTLÜK: örneklemi eşiğin altında kalan kriter listeden ATILMAZ (bilgi
// saklamak da yanıltmaktır) ama `azOrneklem` ile işaretlenir ve uzmanlık
// ilanına aday olamaz.

import { AZ_ORNEKLEM, oran } from './sinyalKirilim.js';
import {
  MAC_TIPLERI, KALABALIK_PROFILLERI, macTipi, kalabalikProfili,
  kalabaliginFavorisi, piyasaninFavorisi,
} from './kriterKirilim.js';

export { AZ_ORNEKLEM };

/** Bir kriterin "uzman" ilan edilebilmesi için gereken en az maç. */
export const UZMANLIK_MIN_MAC = 8;

/**
 * WILSON ALT SINIRI (%95) — sıralama ölçüsü.
 * Ham oranın küçük örneklemde şişmesini cezalandırır. Yalnız SIRALAMA için;
 * kullanıcıya gösterilen yüzde değiştirilmez.
 */
export function altSinir(dogru, toplam) {
  const n = Number(toplam) || 0;
  if (!n) return -1;
  const z = 1.96;
  const p = (Number(dogru) || 0) / n;
  const payda = 1 + (z * z) / n;
  const merkez = p + (z * z) / (2 * n);
  const sapma = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return Math.round(((merkez - sapma) / payda) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// İŞ TANIMLARI — kriterin sınandığı durumlar.
// ---------------------------------------------------------------------------
// Her iş, bir maçın o işe girip girmediğini söyleyen bir `uyar` fonksiyonudur.
// Uymayan maç o işin sıralamasına GİRMEZ (sıfır olarak da sayılmaz).
export const ISLER = Object.freeze([
  ...MAC_TIPLERI.map((t) => ({
    ad: `macTipi:${t.ad}`,
    grup: 'Maç tipi',
    baslik: t.baslik,
    aciklama: t.aciklama,
    uyar: (m) => macTipi(m.oran) === t.ad,
  })),
  ...KALABALIK_PROFILLERI.map((p) => ({
    ad: `kalabalik:${p.ad}`,
    grup: 'Kalabalık profili',
    baslik: p.baslik,
    aciklama: p.aciklama,
    uyar: (m) => kalabalikProfili(m.oynanma) === p.ad,
  })),
  {
    ad: 'yon:1', grup: 'Söylenen yön', baslik: 'Ev sahibi (1) demek',
    aciklama: 'Kriterin 1 dediği maçlar.', uyar: (m) => m.sinyal === '1',
  },
  {
    ad: 'yon:X', grup: 'Söylenen yön', baslik: 'Beraberlik (X) demek',
    aciklama: 'En zor iş: beraberlik en az kestirilebilen sonuçtur.',
    uyar: (m) => m.sinyal === 'X',
  },
  {
    ad: 'yon:2', grup: 'Söylenen yön', baslik: 'Deplasman (2) demek',
    aciklama: 'Kriterin 2 dediği maçlar.', uyar: (m) => m.sinyal === '2',
  },
  {
    ad: 'uyum:ters', grup: 'Kalabalıkla ilişki', baslik: 'Kalabalığa TERS düşmek',
    aciklama: 'En değerli iş: çoğunluktan ayrılıp haklı çıkabilmek.',
    uyar: (m) => {
      const f = kalabaliginFavorisi(m.oynanma);
      return !!f && m.sinyal !== f;
    },
  },
  {
    ad: 'uyum:ayni', grup: 'Kalabalıkla ilişki', baslik: 'Kalabalıkla AYNI demek',
    aciklama: 'Çoğunluğun favorisini tekrar etmek — buradaki başarı az şey öğretir.',
    uyar: (m) => {
      const f = kalabaliginFavorisi(m.oynanma);
      return !!f && m.sinyal === f;
    },
  },
  {
    ad: 'piyasa:ters', grup: 'Kalabalıkla ilişki', baslik: 'Piyasa favorisine TERS',
    aciklama: 'Düşük oranlıya karşı çıkmak.',
    uyar: (m) => {
      const f = piyasaninFavorisi(m.oran);
      return !!f && m.sinyal !== f;
    },
  },
  {
    ad: 'sira:ilk5', grup: 'Bülten sırası', baslik: '1-5. sıra',
    uyar: (m) => Number(m.no) >= 1 && Number(m.no) <= 5,
  },
  {
    ad: 'sira:orta5', grup: 'Bülten sırası', baslik: '6-10. sıra',
    uyar: (m) => Number(m.no) >= 6 && Number(m.no) <= 10,
  },
  {
    ad: 'sira:son5', grup: 'Bülten sırası', baslik: '11-15. sıra',
    uyar: (m) => Number(m.no) >= 11 && Number(m.no) <= 15,
  },
]);

// ---------------------------------------------------------------------------
// ANA FONKSİYON
// ---------------------------------------------------------------------------
/**
 * @param {Map<string, Array>} byKey  kriter anahtarı → maç satırları
 * @param {Map<string, string>} adlar kriter anahtarı → görünen ad
 * @returns {{isler, kriterler, uyari, toplamMac}}
 */
export function kriterKarsilastirma(byKey, adlar = new Map(), opt = {}) {
  const uzmanlikMin = opt.uzmanlikMinMac ?? UZMANLIK_MIN_MAC;

  // Kritere göre ölçülebilir satırlar (yön söylemiş + resmî sonucu var).
  const olculebilir = new Map();
  for (const [key, satirlar] of byKey || new Map()) {
    olculebilir.set(key, (satirlar || []).filter((m) => m && m.sinyal && m.sonuc));
  }

  const isler = [];
  // kriter → o kriterin işlerdeki performansı (uzmanlık çıkarımı için)
  const kriterIsleri = new Map();

  for (const is of ISLER) {
    const siralama = [];
    for (const [key, satirlar] of olculebilir) {
      const kesit = satirlar.filter((m) => {
        try { return is.uyar(m); } catch { return false; }
      });
      if (!kesit.length) continue;                    // bu işe hiç girmemiş
      const dogru = kesit.filter((m) => m.sinyal === m.sonuc).length;
      const satir = {
        key,
        ad: adlar.get(key) || key,
        mac: kesit.length,
        dogru,
        oran: oran(dogru, kesit.length),
        guven: altSinir(dogru, kesit.length),
        azOrneklem: kesit.length < AZ_ORNEKLEM,
        // Uzmanlık ilanına aday mı — eşiğin altında "uzman" denmez.
        yeterli: kesit.length >= uzmanlikMin,
      };
      siralama.push(satir);

      if (!kriterIsleri.has(key)) kriterIsleri.set(key, []);
      kriterIsleri.get(key).push({ is: is.ad, baslik: is.baslik, grup: is.grup, ...satir });
    }

    // SIRALAMA: güvenilirlik (alt sınır) → sonra maç sayısı.
    siralama.sort((a, b) => (b.guven - a.guven) || (b.mac - a.mac));

    isler.push({
      ad: is.ad,
      grup: is.grup,
      baslik: is.baslik,
      aciklama: is.aciklama || null,
      toplamKriter: siralama.length,
      // Bu işte hiç ölçüm yoksa liste boş kalır ve ekran "veri yok" yazar.
      siralama,
    });
  }

  // KRİTER ÖZETİ: her kriterin en iyi ve en kötü işi.
  const kriterler = [];
  for (const [key, satirlar] of olculebilir) {
    const dogru = satirlar.filter((m) => m.sinyal === m.sonuc).length;
    const liste = (kriterIsleri.get(key) || []).filter((x) => x.yeterli);
    const sirali = liste.slice().sort((a, b) => b.guven - a.guven);
    kriterler.push({
      key,
      ad: adlar.get(key) || key,
      mac: satirlar.length,
      dogru,
      oran: oran(dogru, satirlar.length),
      // UZMANLIK yalnız yeterli örneklemli işlerden seçilir. Aday yoksa null
      // döner ve ekran "henüz uzmanlık ilan edilemez" yazar — uydurulmaz.
      uzmanlik: sirali[0] || null,
      zayif: sirali.length > 1 ? sirali[sirali.length - 1] : null,
      olculenIs: liste.length,
    });
  }
  kriterler.sort((a, b) => (b.oran ?? -1) - (a.oran ?? -1) || b.mac - a.mac);

  const toplamMac = [...olculebilir.values()].reduce((s, x) => Math.max(s, x.length), 0);

  return {
    isler,
    kriterler,
    toplamMac,
    uzmanlikMinMac: uzmanlikMin,
    uyari: uyariMetni(toplamMac, uzmanlikMin),
  };
}

/** Örneklem büyüklüğüne göre dürüst uyarı. */
export function uyariMetni(macSayisi, uzmanlikMin = UZMANLIK_MIN_MAC) {
  if (!macSayisi) {
    return 'Ölçülebilir maç yok — kriterler karşılaştırılamaz.';
  }
  if (macSayisi < 30) {
    return `Kriter başına en fazla ${macSayisi} maç var. Bu sayı işlere bölününce `
      + `her işe 2-4 maç düşer; sıralamalar KANIT DEĞİL, yalnız ilk izlenimdir. `
      + `Bir kriter ancak bir işte ${uzmanlikMin}+ maç görürse "uzman" sayılabilir; `
      + 'bugün büyük ihtimalle hiçbiri o eşiği geçmiyor.';
  }
  if (macSayisi < 100) {
    return `Kriter başına ${macSayisi} maça kadar veri var. Ana işlerde eğilim `
      + `okunabilir; ${AZ_ORNEKLEM} maçın altındaki satırlar işaretlidir.`;
  }
  return `Kriter başına ${macSayisi} maça kadar veri var. Sıralama güvenilirlik `
    + 'alt sınırına göredir; gösterilen yüzde ham yüzdedir.';
}
