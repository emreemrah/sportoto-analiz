// SAĞLAYICI TEMPOSU — her kaynağa KENDİ deneme sıklığı.
// ---------------------------------------------------------------------------
// NEDEN GEREKLİ: gözlem döngüsü 15 dakikada bir çalışıyor ve TÜM sağlayıcıları
// aynı tempoda deniyor. Bir kaynak bu tempoyu kaldıramıyorsa, denemelerin
// kendisi engeli sürekli tazeliyor ve kaynak hiç açılmıyor.
//
// ÖLÇÜMLE ÖĞRENİLDİ (2 Ağustos 2026, o gün kaldırılan üçüncü kaynak üzerinde):
//   • temiz başlangıçta İLK istek → HTTP 200, gerçek veri geldi
//   • aynı dakikada 10 istek     → 10/10 HTTP 400
//   • dakikalarca bekleme         → bazen açılıyor, bazen değil
// Yani denemenin KENDİSİ engeli tazeleyebiliyor. O kaynak projeden çıkarıldı
// ama mekanizma duruyor: ileride hız sınırlı bir kaynak eklenirse TEMPO'ya bir
// satır yazmak yeter, akış değişmez.
//
// KURAL: bir sağlayıcı için bekleme süresi dolmadıysa O TURDA HİÇ DENENMEZ.
// Bu, kaynağa saygılı davranmanın da doğru yolu: hız sınırı gördüğünde daha
// çok istemek değil, daha az istemek.
//
// BAŞARISIZLIKTA GERİ ÇEKİLME: üst üste hata alındıkça bekleme uzar (en çok
// 6 saat). Kaynak kalıcı kapandıysa sistem onu dakika başı dövmeye devam
// etmez; açılırsa da makul sürede geri döner.

/** Sağlayıcı başına asgari deneme aralığı (ms). Yazılmayan kaynak: her tur.
 *  Şu an hız sınırı olan kaynak YOK — hepsi normal tempoda çalışıyor. */
export const TEMPO = {};

/** Hata sonrası KISA aralık istisnası (ms). Kararsız (dalgalı) kaynaklar için:
 *  hata üstel geri çekilme yerine sabit kısa aralıkla tekrar denenir. Şu an
 *  kullanan kaynak yok; mekanizma ve testi duruyor. */
export const HATA_SONRASI_TEMPO = {};

export const GERI_CEKILME_CARPANI = 2;
export const EN_UZUN_BEKLEME_MS = 6 * 3600e3;

/**
 * Denenebilir mi?
 * @param {string} id        sağlayıcı kimliği
 * @param {object} durum     { [id]: { sonDeneme, ardisikHata } }
 * @param {number} simdi
 */
export function denenebilir(id, durum, simdi = Date.now(), tablolar = {}) {
  // TABLOLAR DIŞARIDAN VERİLEBİLİR (yalnız test için). Üretimde şu an hız
  // sınırlı kaynak yok, yani TEMPO boş; kuralı sınamak için sahte bir kaynak
  // gerekiyor. Gerçek tabloya test verisi yazmaktansa parametre geçmek daha
  // temiz — üretim davranışı hiç değişmiyor.
  const { tempo = TEMPO, hataTempo = HATA_SONRASI_TEMPO } = tablolar;
  const temel = tempo[id];
  if (!temel) return true;                        // temposu yazılmamış kaynak: her tur
  const d = durum?.[id];
  if (!d?.sonDeneme) return true;                 // hiç denenmemiş
  // GERİ ÇEKİLME İKİNCİ HATADAN SONRA BAŞLAR.
  // İlk sürümde üs doğrudan hata sayısıydı: TEK bir başarısızlık beklemeyi
  // 1 saatten 2 saate çıkarıyordu. Hız sınırına takılan bir kaynak için bu
  // yanlış — geçici bir engel yüzünden yarım gün sessiz kalınıyordu. İlk
  // tekrar normal tempoda yapılır; ısrarlı hata varsa süre uzar.
  const hata = Math.max(0, Number(d.ardisikHata) || 0);
  // KARARSIZ KAYNAK İSTİSNASI: son deneme başarısızsa ve bu kaynak için kısa
  // bir hata aralığı tanımlıysa, üstel geri çekilme YERİNE o aralık kullanılır
  // (gerekçe: HATA_SONRASI_TEMPO başlığı). Üst sınır yine geçerli.
  const kisa = hata > 0 ? hataTempo[id] : null;
  if (kisa) return simdi - d.sonDeneme >= Math.min(kisa, EN_UZUN_BEKLEME_MS);
  const us = Math.max(0, hata - 1);
  const bekleme = Math.min(temel * (GERI_CEKILME_CARPANI ** us), EN_UZUN_BEKLEME_MS);
  return simdi - d.sonDeneme >= bekleme;
}

/**
 * Deneme sonrası durumu günceller (saf: yeni nesne döner).
 *
 * YALNIZ TEMPOSU TANIMLI kaynaklar kaydedilir. Gerekçe: durum kalıcı bir cache
 * dosyasında tutuluyor ve testlerin uydurma sağlayıcıları (testprov, bozuk,
 * saglam…) oraya sızıyordu. Üretim durumunu test verisiyle kirletmek iki
 * yönden zararlı: dosya anlamsız satırlarla şişiyor ve bir testin sabit
 * tarihi gerçek bir kaynağın "son başarı" değeri gibi görünüyordu
 * (gerçek bir kaynağın "son başarı" değeri bir kez böyle bozulmuştu).
 * Temposu olmayan kaynak zaten hiç bekletilmiyor; kaydına da gerek yok.
 */
export function durumuGuncelle(id, durum, basarili, simdi = Date.now(), tablolar = {}) {
  const { tempo = TEMPO } = tablolar;
  if (!tempo[id]) return durum || {};
  const onceki = durum?.[id] || {};
  return {
    ...(durum || {}),
    [id]: {
      sonDeneme: simdi,
      ardisikHata: basarili ? 0 : (Number(onceki.ardisikHata) || 0) + 1,
      sonBasari: basarili ? simdi : (onceki.sonBasari ?? null),
    },
  };
}
