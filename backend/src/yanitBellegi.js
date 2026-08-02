// YANIT BELLEĞİ — aynı veriyi her istekte yeniden hazırlamayı önler.
// ---------------------------------------------------------------------------
// ÖLÇÜM (2 Ağustos 2026, /api/bulletin, 615 KB):
//   JSON.parse 1,15 ms + JSON.stringify 1,40 ms + gzip 1,71 ms ≈ 4,3 ms
// Bu iş HER İSTEKTE tekrarlanıyordu. Tek çekirdekte teorik tavan ~230 istek/sn,
// ölçülen ~94. İstemci bülten ekranı açıkken 15 SANİYEDE BİR yokluyor; yani
// 1.500 eşzamanlı kullanıcı = 100 istek/sn → sunucu doyuyor.
//
// ÇÖZÜM: hazırlanmış yanıt kısa süre bellekte tutulur. Veri değişmediyse
// hiçbir iş yapılmaz.
//
// NEDEN KISA TTL (saniyeler) ve "sonsuza kadar dosya damgasıyla" DEĞİL:
// Yanıt yalnız bülten dosyasından gelmiyor — arşiv/mühür durumu ve kupon
// fiyatı da içinde ve bunlar dosyadan bağımsız değişebiliyor. Damgaya
// güvenmek, mühür anı geldiğinde eski yanıtı SONSUZA KADAR servis etme riski
// taşırdı. Birkaç saniyelik bayatlık kabul edilebilir; sessizce donmuş veri
// değil.

/**
 * TTL'li tek değerli bellek.
 * @param {number} ttlMs  bayatlık üst sınırı
 * @param {() => number}  saat  test için sabitlenebilir
 */
export function yanitBellegi(ttlMs = 5000, saat = Date.now) {
  let deger = null;
  let zaman = 0;
  let anahtar = null;

  return {
    /**
     * Bellekteki değeri döner; yoksa/bayatsa `uret` çağrılır.
     * `anahtarYeni` verilirse ve değiştiyse bellek DERHAL geçersizdir
     * (ör. dosya damgası) — TTL'in dolmasını beklemez.
     */
    al(uret, anahtarYeni = null) {
      const taze = deger !== null
        && (saat() - zaman) < ttlMs
        && (anahtarYeni === null || anahtarYeni === anahtar);
      if (taze) return deger;
      deger = uret();
      zaman = saat();
      anahtar = anahtarYeni;
      return deger;
    },
    /** Elle geçersiz kıl (veri yazan akışlar için). */
    temizle() { deger = null; zaman = 0; anahtar = null; },
    /** Teşhis: bellekte bir şey var mı. */
    doluMu() { return deger !== null; },
  };
}
