// SAĞLAYICI TEMPOSU — her kaynağa KENDİ deneme sıklığı.
// ---------------------------------------------------------------------------
// NEDEN GEREKLİ: gözlem döngüsü 15 dakikada bir çalışıyor ve TÜM sağlayıcıları
// aynı tempoda deniyor. Bir kaynak bu tempoyu kaldıramıyorsa, denemelerin
// kendisi engeli sürekli tazeliyor ve kaynak hiç açılmıyor.
//
// ÖLÇÜM (2 Ağustos 2026, yeşil kaynak):
//   • temiz başlangıçta İLK istek → HTTP 200, gerçek veri geldi
//   • aynı dakikada 10 istek     → 10/10 HTTP 400
//   • 1, 2 ve 3 dakika bekleme    → hâlâ 400
// Yani kaynak erişilebilir ama çok düşük tempoda. Arşiv de bunu doğruluyor:
// 28-30 Temmuz arasında 45 gözlem (kabaca saatte bir başarı).
//
// KURAL: bir sağlayıcı için bekleme süresi dolmadıysa O TURDA HİÇ DENENMEZ.
// Bu, kaynağa saygılı davranmanın da doğru yolu: hız sınırı gördüğünde daha
// çok istemek değil, daha az istemek.
//
// BAŞARISIZLIKTA GERİ ÇEKİLME: üst üste hata alındıkça bekleme uzar (en çok
// 6 saat). Kaynak kalıcı kapandıysa sistem onu dakika başı dövmeye devam
// etmez; açılırsa da makul sürede geri döner.

/** Sağlayıcı başına asgari deneme aralığı (ms). Yazılmayan kaynak: her tur. */
export const TEMPO = {
  bilyoner: 60 * 60e3,        // saatte bir — ölçülen tolerans bu
};

export const GERI_CEKILME_CARPANI = 2;
export const EN_UZUN_BEKLEME_MS = 6 * 3600e3;

/**
 * Denenebilir mi?
 * @param {string} id        sağlayıcı kimliği
 * @param {object} durum     { [id]: { sonDeneme, ardisikHata } }
 * @param {number} simdi
 */
export function denenebilir(id, durum, simdi = Date.now()) {
  const temel = TEMPO[id];
  if (!temel) return true;                        // temposu yazılmamış kaynak: her tur
  const d = durum?.[id];
  if (!d?.sonDeneme) return true;                 // hiç denenmemiş
  // GERİ ÇEKİLME İKİNCİ HATADAN SONRA BAŞLAR.
  // İlk sürümde üs doğrudan hata sayısıydı: TEK bir başarısızlık beklemeyi
  // 1 saatten 2 saate çıkarıyordu. Hız sınırına takılan bir kaynak için bu
  // yanlış — geçici bir engel yüzünden yarım gün sessiz kalınıyordu. İlk
  // tekrar normal tempoda yapılır; ısrarlı hata varsa süre uzar.
  const hata = Math.max(0, Number(d.ardisikHata) || 0);
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
 * (bilyoner'in 22 Temmuz kaydı tam olarak böyle oluşmuştu).
 * Temposu olmayan kaynak zaten hiç bekletilmiyor; kaydına da gerek yok.
 */
export function durumuGuncelle(id, durum, basarili, simdi = Date.now()) {
  if (!TEMPO[id]) return durum || {};
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
