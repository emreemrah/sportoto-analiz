// ---------------------------------------------------------------------------
// PREMIUM SINIRLARI — TEK KAYNAK (saf modül, HTTP/veritabanı yok)
// ---------------------------------------------------------------------------
// NEDEN TEK DOSYA: sınır hem sunucuda zorlanacak hem uygulamada gösterilecek.
// İki yerde ayrı yazılsaydı biri değişip diğeri kalırdı ve ekran "8 kritere
// kadar" derken sunucu 10'a izin verirdi. Sınır burada tanımlanır; sunucu
// buradan zorlar, uygulama buradan (uç üzerinden) okuyup gösterir.
//
// TASARIM İLKESİ — ÜCRETSİZ SÜRÜM SAKAT DEĞİL, DAR OLMALI
// Ücretsiz kullanıcı ürünün ana işini (güncel bülteni analizle görmek) TAM
// yapabilir. Premium, DERİNLİK satar: daha çok radar, daha çok geçmiş, daha
// çok kriter, daha çok kupon. "Bugünkü maçları göremezsin" gibi bir sınır
// yoktur — o, ürünü kullanılamaz yapar ve mağaza değerlendirmesini düşürür.
//
// DÜRÜSTLÜK: sınır aşıldığında veri UYDURULMAZ ve sessizce kırpılmaz;
// çağıran taraf "premium gerekiyor" bilgisini açıkça alır.

/** Kilitli özelliklerin anahtarları — arayüz ve sunucu aynı adı kullanır. */
export const OZELLIKLER = Object.freeze({
  RADAR_ILERI: 'radar-ileri',       // Radar 2/3/4/5
  GECMIS_DERIN: 'gecmis-derin',     // 4 haftadan eski bültenler
  KRITER_TAM: 'kriter-tam',         // 8'den fazla kriter açma
  KUPON_COK: 'kupon-cok',           // 3'ten fazla kayıtlı kupon
  KARNE_TAM: 'karne-tam',           // Sistem Karnesi tam kırılım
});

export const SINIRLAR = Object.freeze({
  ucretsiz: Object.freeze({
    gecmisHafta: 4,      // kaç hafta geriye bakılabilir
    kriter: 8,           // aynı anda açık kriter sayısı
    kupon: 3,            // kayıtlı kupon sayısı
    radar: 1,            // Radar 1'e kadar
  }),
  premium: Object.freeze({
    gecmisHafta: Infinity,
    kriter: Infinity,
    kupon: Infinity,
    radar: 5,
  }),
});

/** Kullanıcının sınır kümesi. Saf. */
export function sinirlar(premium) {
  return premium ? SINIRLAR.premium : SINIRLAR.ucretsiz;
}

/**
 * Bir özelliğe erişim var mı? Saf.
 * @param {string} ozellik  OZELLIKLER değerlerinden biri
 * @param {boolean} premium
 * @param {object} [baglam] { radarNo, haftaGeriSayi, kriterSayisi, kuponSayisi }
 * @returns {{izin: boolean, sinir?: number, sebep?: string}}
 */
export function erisim(ozellik, premium, baglam = {}) {
  const s = sinirlar(premium);
  if (premium) return { izin: true };

  switch (ozellik) {
    case OZELLIKLER.RADAR_ILERI: {
      const no = Number(baglam.radarNo);
      // Radar numarası bilinmiyorsa KISITLAMA UYGULANMAZ: bilinmeyen bir şeyi
      // kilitlemek, yeni eklenen bir ekranı sessizce kapatmak olurdu.
      if (!Number.isFinite(no)) return { izin: true };
      return no <= s.radar ? { izin: true } : { izin: false, sinir: s.radar, sebep: 'radar' };
    }
    case OZELLIKLER.GECMIS_DERIN: {
      const geri = Number(baglam.haftaGeriSayi);
      if (!Number.isFinite(geri)) return { izin: true };
      return geri < s.gecmisHafta
        ? { izin: true } : { izin: false, sinir: s.gecmisHafta, sebep: 'gecmis' };
    }
    case OZELLIKLER.KRITER_TAM: {
      const adet = Number(baglam.kriterSayisi);
      if (!Number.isFinite(adet)) return { izin: true };
      return adet <= s.kriter ? { izin: true } : { izin: false, sinir: s.kriter, sebep: 'kriter' };
    }
    case OZELLIKLER.KUPON_COK: {
      const adet = Number(baglam.kuponSayisi);
      if (!Number.isFinite(adet)) return { izin: true };
      return adet < s.kupon ? { izin: true } : { izin: false, sinir: s.kupon, sebep: 'kupon' };
    }
    case OZELLIKLER.KARNE_TAM:
      return { izin: false, sebep: 'karne' };
    default:
      // TANIMSIZ ÖZELLİK SERBEST. Ters tasarım (bilinmeyeni kilitle) yeni bir
      // ekran eklendiğinde onu kimseye göstermezdi.
      return { izin: true };
  }
}

/** Arayüzde gösterilecek kısa açıklama. Saf — metin tek yerden gelir. */
export function kilitMetni(sebep) {
  switch (sebep) {
    case 'radar': return 'Bu radar premium erişimle açılır.';
    case 'gecmis': return 'Son 4 haftadan eski bültenler premium erişimle açılır.';
    case 'kriter': return 'Ücretsiz sürümde aynı anda en fazla 8 kriter açılabilir.';
    case 'kupon': return 'Ücretsiz sürümde en fazla 3 kupon saklanır.';
    case 'karne': return 'Karnenin tam kırılımı premium erişimle açılır.';
    default: return 'Bu bölüm premium erişimle açılır.';
  }
}
