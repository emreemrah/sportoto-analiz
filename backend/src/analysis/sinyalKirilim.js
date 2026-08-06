// ---------------------------------------------------------------------------
// SİNYAL KIRILIMI — "bu sinyal NEREDE işe yarıyor?" (saf modül, testli)
// ---------------------------------------------------------------------------
// NEDEN VAR: kriter karnesi bugün tek bir sayı veriyor ("xG Karşı: 12 maçta 7
// başarı, %58"). Bu sayı, sinyalin HANGİ DURUMDA işe yaradığını söylemiyor.
// Kullanıcının fark ettiği örüntü şuydu: aynı bülten sırasında, benzer
// oynanma yüzdeleriyle, aynı sonuç çıkıyor (52. ve 51. hafta 1. sıra:
// %44/%30/%26 ve %44/%29/%27 → ikisi de X).
//
// Bu modül bir sinyali (kriter YA DA radar — ikisi de aynı biçime çevrilir)
// üç açıdan keser:
//   1. BÜLTEN SIRASI (1-15): sinyal 3. sırada mı iyi, 11. sırada mı?
//   2. GERÇEKLEŞEN SONUÇ (1/X/2): "1 dedi ve 1 geldi" ile "1 dedi X geldi"
//      ayrımı. Mevcut karne yalnız sinyalin YÖNÜNE bakıyordu, sonuca değil.
//   3. OYNANMA PROFİLİ: o sırada, o sonuçla biten maçlarda kalabalık ne
//      oynamıştı? Ortalama VE aralık — ortalama tek başına yanıltır.
//
// DÜRÜSTLÜK KURALLARI (kod seviyesinde uygulanır, yorum değil)
//  • Yüzde, HAM SAYIYLA birlikte döner. Çağıran taraf "%100" yazacaksa yanında
//    "1 maçta 1" da yazabilsin.
//  • AZ_ORNEKLEM altındaki her hücre `azOrneklem: true` ile işaretlenir.
//    Gizlenmez — gizlemek de bilgi saklamaktır — ama işaretlenir.
//  • Veri yoksa 0 değil `null` döner. "%0 başarı" ile "ölçüm yok" aynı şey
//    değildir ve 0 yazmak sinyali haksız yere kötü gösterir.
//  • Benzerlik araması TAHMİN DEĞİL GÖZLEMDİR: "geçmişte benzer profilde şu
//    maçlar vardı, sonuçları şunlardı" der. Gelecek cümlesi kurmaz.

/** Bir hücrenin "yorumlanabilir" sayılması için gereken en az maç sayısı. */
export const AZ_ORNEKLEM = 5;

/** Bülten sırası aralığı — Spor Toto bülteni 15 maçtır. */
export const SIRA_MIN = 1;
export const SIRA_MAX = 15;

/** Oynanma profili "benzer" sayılması için izin verilen yüzde sapması. */
export const BENZERLIK_TOLERANS = 5;

const SONUCLAR = ['1', 'X', '2'];

/**
 * Sayı mı? null/undefined/''/boolean AÇIKÇA elenir.
 *
 * DİKKAT — bu satır bir hata düzeltmesidir: `Number(null)` JavaScript'te 0'dır.
 * Yalnız `Number.isFinite(Number(v))` denseydi, oynanma verisi OLMAYAN bir maç
 * "%0 oynanmış" sayılır ve ortalamayı aşağı çekerdi. "Veri yok" ile "sıfır"
 * aynı şey değildir; bu ayrım bu projenin temel kuralı.
 * (Testle yakalandı: sinyal-kirilim.test.mjs → ortalamaAralik null girdisi.)
 */
const sayi = (v) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Yüzde: pay/payda. Payda 0 ise null (0 yazmak yalan olurdu). */
export function oran(dogru, toplam) {
  if (!Number.isFinite(toplam) || toplam <= 0) return null;
  return Math.round((dogru / toplam) * 1000) / 10;
}

/** Ortalama ve aralık. Boş dizide null döner. Saf. */
export function ortalamaAralik(degerler) {
  const temiz = (degerler || []).map(sayi).filter((v) => v !== null);
  if (!temiz.length) return null;
  const toplam = temiz.reduce((a, b) => a + b, 0);
  return {
    ortalama: Math.round((toplam / temiz.length) * 10) / 10,
    enAz: Math.min(...temiz),
    enCok: Math.max(...temiz),
    adet: temiz.length,
  };
}

/**
 * Tek bir hücrenin özeti: kaç maç, kaçı doğru, yüzde, az örneklem mi.
 * @param {number} dogru
 * @param {number} toplam
 */
export function hucre(dogru, toplam) {
  if (!Number.isFinite(toplam) || toplam <= 0) {
    return { mac: 0, dogru: 0, oran: null, azOrneklem: true, veriYok: true };
  }
  return {
    mac: toplam,
    dogru,
    oran: oran(dogru, toplam),
    azOrneklem: toplam < AZ_ORNEKLEM,
    veriYok: false,
  };
}

/**
 * Kayıtları en yeni haftadan geriye doğru N HAFTA ile sınırlar.
 * Hafta sayısı maç sayısı DEĞİLDİR: "son 5 hafta" 5 maç değil, 5 bültendir.
 * @param {Array} kayitlar  [{roundId, ...}]
 * @param {number|null} haftaSayisi  null → sınır yok
 */
export function sonHaftalar(kayitlar, haftaSayisi) {
  if (!Number.isFinite(haftaSayisi) || haftaSayisi <= 0) return kayitlar || [];
  const haftalar = [...new Set((kayitlar || []).map((k) => Number(k.roundId)))]
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .slice(0, haftaSayisi);
  const kume = new Set(haftalar);
  return (kayitlar || []).filter((k) => kume.has(Number(k.roundId)));
}

/**
 * 1. KIRILIM — BÜLTEN SIRASINA GÖRE BAŞARI
 *
 * Her sıra (1-15) için: sinyalin kaç maçta yön gösterdiği, kaçının tuttuğu.
 * Sinyal üretmeyen maç TOPLAMA GİRMEZ — "yön göstermedi" ile "yanlış dedi"
 * aynı şey değildir; ikisini karıştırmak sinyali haksız yere kötü gösterir.
 *
 * @param {Array} kayitlar [{no, sinyal, sonuc, roundId}]
 * @param {object} [opt] { donemler: {etiket: haftaSayisi|null} }
 */
export function siraBazliBasari(kayitlar, opt = {}) {
  const donemler = opt.donemler || { tum: null, son5: 5, son10: 10, son15: 15 };
  const cikti = [];
  for (let no = SIRA_MIN; no <= SIRA_MAX; no += 1) {
    const satir = { no, donem: {} };
    for (const [etiket, haftaSayisi] of Object.entries(donemler)) {
      const kesit = sonHaftalar(kayitlar, haftaSayisi).filter((k) => Number(k.no) === no);
      const sinyalli = kesit.filter((k) => k.sinyal && k.sonuc);
      const dogru = sinyalli.filter((k) => k.sinyal === k.sonuc).length;
      satir.donem[etiket] = hucre(dogru, sinyalli.length);
    }
    cikti.push(satir);
  }
  return cikti;
}

/**
 * 2. KIRILIM — SIRADA HANGİ SONUÇ ÇIKIYOR (sinyalden bağımsız)
 *
 * Radar 5'in gösterdiği dağılımın aynısı; sinyalin başarısı bunun YANINDA
 * okunmalı. Bir sinyal "3. sırada %70 başarılı" görünüyor ama o sıra zaten
 * %70 ev sahibi kazanıyorsa, sinyal bir şey eklemiyor demektir.
 */
export function siraSonucDagilimi(kayitlar, opt = {}) {
  const haftaSayisi = opt.haftaSayisi ?? null;
  const kesit = sonHaftalar(kayitlar, haftaSayisi);
  const cikti = [];
  for (let no = SIRA_MIN; no <= SIRA_MAX; no += 1) {
    const satir = kesit.filter((k) => Number(k.no) === no && k.sonuc);
    const sayac = { 1: 0, X: 0, 2: 0 };
    for (const k of satir) if (sayac[k.sonuc] !== undefined) sayac[k.sonuc] += 1;
    const toplam = satir.length;
    cikti.push({
      no,
      mac: toplam,
      azOrneklem: toplam < AZ_ORNEKLEM,
      dagilim: SONUCLAR.reduce((acc, s) => {
        acc[s] = { adet: sayac[s], oran: oran(sayac[s], toplam) };
        return acc;
      }, {}),
    });
  }
  return cikti;
}

/**
 * 3. KIRILIM — SONUCA GÖRE OYNANMA PROFİLİ
 *
 * Kullanıcının yakaladığı örüntü burada ölçülür: "1. sırada X ile biten
 * maçlarda kalabalık ne oynamıştı?" Ortalama TEK BAŞINA yeterli değil —
 * aralık da döner, çünkü 44 ve 30'un ortalaması 37'dir ve 37 hiçbir maçta
 * görülmemiş olabilir.
 *
 * @param {Array} kayitlar [{no, sonuc, oynanma:{1,X,2}}]
 * @param {object} [opt] { no: sadece bu sıra, haftaSayisi }
 */
export function sonucaGoreOynanma(kayitlar, opt = {}) {
  const kesit = sonHaftalar(kayitlar, opt.haftaSayisi ?? null)
    .filter((k) => k.sonuc && k.oynanma)
    .filter((k) => (opt.no ? Number(k.no) === Number(opt.no) : true));

  const cikti = [];
  const siralar = opt.no ? [Number(opt.no)] : Array.from(
    { length: SIRA_MAX - SIRA_MIN + 1 }, (_, i) => SIRA_MIN + i,
  );
  for (const no of siralar) {
    const siraKayit = kesit.filter((k) => Number(k.no) === no);
    for (const sonuc of SONUCLAR) {
      const grup = siraKayit.filter((k) => k.sonuc === sonuc);
      if (!grup.length) {
        cikti.push({ no, sonuc, mac: 0, veriYok: true, azOrneklem: true, profil: null });
        continue;
      }
      cikti.push({
        no,
        sonuc,
        mac: grup.length,
        azOrneklem: grup.length < AZ_ORNEKLEM,
        veriYok: false,
        profil: SONUCLAR.reduce((acc, s) => {
          acc[s] = ortalamaAralik(grup.map((k) => k.oynanma?.[s]));
          return acc;
        }, {}),
        maclar: grup.map((k) => ({
          roundId: k.roundId, hafta: k.hafta, home: k.home, away: k.away,
          skor: k.skor || null, oynanma: k.oynanma,
        })),
      });
    }
  }
  return cikti;
}

/**
 * 4. BENZERLİK — "bu profile benzeyen geçmiş maçlar ne oldu?"
 *
 * GÖZLEM ARACIDIR, TAHMİN DEĞİL. Geçmişte benzer oynanma profiline sahip
 * AYNI SIRADAKİ maçları bulur ve sonuçlarını sayar. Çıktıda hiçbir yerde
 * "olacak/kesin/banko" yoktur; yalnız "şu kadar maçtan şu kadarı" vardır.
 *
 * BENZERLİK ÖLÇÜSÜ: üç yüzdenin de tolerans içinde olması. Tek yüzdeye
 * bakmak yanıltır — %44 ev iki farklı dağılımda çok farklı anlam taşır.
 *
 * @param {Array} kayitlar
 * @param {object} hedef {1,X,2} — karşılaştırılacak oynanma profili
 * @param {object} [opt] { no, tolerans, haftaSayisi }
 */
export function benzerVakalar(kayitlar, hedef, opt = {}) {
  const tol = Number.isFinite(opt.tolerans) ? opt.tolerans : BENZERLIK_TOLERANS;
  if (!hedef) return { tolerans: tol, mac: 0, vakalar: [], dagilim: null, veriYok: true };

  const kesit = sonHaftalar(kayitlar, opt.haftaSayisi ?? null)
    .filter((k) => k.oynanma && k.sonuc)
    .filter((k) => (opt.no ? Number(k.no) === Number(opt.no) : true))
    .filter((k) => SONUCLAR.every((s) => {
      const a = sayi(k.oynanma[s]); const b = sayi(hedef[s]);
      if (a === null || b === null) return false;
      return Math.abs(a - b) <= tol;
    }));

  const sayac = { 1: 0, X: 0, 2: 0 };
  for (const k of kesit) if (sayac[k.sonuc] !== undefined) sayac[k.sonuc] += 1;

  return {
    tolerans: tol,
    mac: kesit.length,
    azOrneklem: kesit.length < AZ_ORNEKLEM,
    veriYok: kesit.length === 0,
    dagilim: kesit.length ? SONUCLAR.reduce((acc, s) => {
      acc[s] = { adet: sayac[s], oran: oran(sayac[s], kesit.length) };
      return acc;
    }, {}) : null,
    vakalar: kesit.map((k) => ({
      roundId: k.roundId, hafta: k.hafta, no: k.no,
      home: k.home, away: k.away, skor: k.skor || null,
      oynanma: k.oynanma, sonuc: k.sonuc,
    })),
  };
}

/**
 * TEK ÇAĞRI — bir sinyalin tam kırılımı.
 * Panel bunu çağırır; parçalar ayrı ayrı da test edilebilir.
 */
export function tamKirilim(kayitlar, opt = {}) {
  const liste = kayitlar || [];
  const sinyalli = liste.filter((k) => k.sinyal && k.sonuc);
  const dogru = sinyalli.filter((k) => k.sinyal === k.sonuc).length;

  return {
    genel: {
      ...hucre(dogru, sinyalli.length),
      toplamMac: liste.length,
      sinyalsizMac: liste.length - sinyalli.length,
      hafta: [...new Set(liste.map((k) => k.roundId))].length,
      oynanmaliMac: liste.filter((k) => k.oynanma).length,
    },
    sira: siraBazliBasari(liste, opt),
    dagilim: siraSonucDagilimi(liste, opt),
    oynanmaProfili: sonucaGoreOynanma(liste, opt),
    esik: { azOrneklem: AZ_ORNEKLEM, benzerlikTolerans: BENZERLIK_TOLERANS },
    not: 'Sinyal üretmeyen maç toplama girmez; "yön göstermedi" ile "yanlış dedi" ayrı şeylerdir.',
  };
}
