// HAVUZ EV MOTORU — SABİTLER VE BİLİNMEYENLER (T10).
//
// Bu dosyanın en önemli işi, BİLDİKLERİMİZİ bilmediklerimizden ayırmaktır.
// Bilinmeyen bir sabiti "makul bir değerle" doldurmak, tüm TL ölçeğini sessizce
// yanlış yapar — bu yüzden bilinmeyenler `null` bırakılır ve motor onlarsız
// yalnız ÖLÇEKSİZ (olasılık/oran) çıktı üretir.

/** Kademe havuz payları — iddaa Spor Toto oyun kuralları ile doğrulandı. */
export const TIER_SHARES = Object.freeze({ 15: 0.35, 14: 0.20, 13: 0.20, 12: 0.25 });
export const TIERS = Object.freeze([15, 14, 13, 12]);
export const MATCH_COUNT = 15;

/**
 * KRİTİK KURAL: Bir kolon yalnızca bildiği EN ÜST dereceden ödeme alır.
 * Kademeler AYRIK olaylardır ("tam olarak k doğru", "en az k" DEĞİL).
 * Bunu kaçırmak beklenen dönüşü yaklaşık %25 şişirir.
 */
export const TIERS_ARE_DISJOINT = true;

/**
 * ρ_net — İKRAMİYEYE GİDEN ORAN, **KDV DÜŞÜLMÜŞ** hasılat üzerinden. BULUNDU.
 *
 * 5602 sayılı Kanun md. 4/2: bir takvim yılında ödenen ikramiye toplamı,
 * hasılatın %40'ından az %93'ünden fazla olamaz. Yani kanun bir ARALIK verir.
 * Spor Toto Oyun Planı md. 10/1 ise bu aralığın ÜST SINIRININ dağıtıldığını
 * söyler — "üst sınıra tekabül eden bedel … iştirakçilere dağıtılır".
 *
 * Bu mekanizma AMPİRİK OLARAK DOĞRULANDI: Sayıştay'ın 2023 denetim raporundaki
 * gerçekleşme rakamları (ikramiye 232.628.493.455,54 TL ÷ net hasılat
 * 280.275.293.319,86 TL) = **%83,000** — o yılın yasal üst sınırıyla üç ondalık
 * basamağa kadar birebir. Yani "üst sınır = fiilen dağıtılan oran" kuralı
 * sayılarla kanıtlıdır.
 *
 * Üst sınır 27.12.2023 tarihli 7491 sayılı Kanun md. 64 ile %83'ten %93'e
 * çıkarıldı (yürürlük 28.12.2023).
 *
 * ⚠ 2024-2026 için gerçekleşme rakamıyla ayrıca teyit YOK (o yılların Sayıştay
 * raporu yayımlanmamış) — mekanizma teyitli, o yılların uygulaması değil.
 */
export const PAYOUT_RATIO_NET = 0.93;
export const PAYOUT_RATIO_NET_SINCE = '2023-12-28';
export const PAYOUT_RATIO_NET_SOURCE =
  '5602 s.K. md.4/2 (7491 s.K. md.64 ile %93) + Spor Toto Oyun Planı md.10/1 '
  + '(üst sınır dağıtılır) + Sayıştay 2023 raporu gerçekleşmesi (%83,000 = o yılın sınırı)';

/**
 * KDV ORANI — %20, kupon bedeline **DAHİL** (iç yüzde).
 *
 * NEDEN ÖNEMLİ: Kanunun %93'ü KDV DÜŞÜLMÜŞ hasılat üzerinden; oyuncunun
 * ödediği kolon bedeli ise BRÜT. Karıştırılırsa havuz ~%19 şişer.
 *
 * KAYNAK ZİNCİRİ:
 *  1. Şans oyunları KDV'nin indirimli oran listelerinde (I/II sayılı) YER
 *     ALMAZ → genel orana tabidir. Genel oran 10.07.2023'ten beri %20
 *     (7346 sayılı Cumhurbaşkanı Kararı; öncesi %18).
 *  2. KDV Kanunu md. 23 — şans oyunlarında ÖZEL MATRAH: matrah bizzat
 *     katılma bedelidir, yani KDV bedelin İÇİNDEDİR (üzerine eklenmez).
 *  3. Spor Toto'yu ADIYLA anan bir tebliğ/özelge BULUNAMADI — 1. madde bir
 *     çıkarımdır. Ama sayılar bu çıkarımı bağımsız olarak doğruluyor (⇩).
 *
 * SAYISAL DOĞRULAMA (bu, "düşük güven"i belirgin biçimde yükseltir):
 * Sayıştay 2023 gerçekleşmesinde KDV / brüt hasılat = %16,010.
 *   • KDV dahil %18 ⇒ 0,18/1,18 = %15,254
 *   • KDV dahil %20 ⇒ 0,20/1,20 = %16,667
 * Gerçekleşen tam bu ikisinin ARASINDA ve hasılatın %53,5'inin 10 Temmuz
 * SONRASINDA olmasını gerektiriyor. Takvim olarak yılın %47,7'si o tarihten
 * sonra; futbol sezonu yaz arası verdiği için ikinci yarının daha yoğun
 * olması BEKLENİR. Yani hem oran hem "dahil" varsayımı rakamlarla tutuyor.
 *
 * Güven: ORTA-YÜKSEK. Spor Toto'ya özgü açık metin yok; çıkarım + sayısal
 * doğrulama var. Yanlış çıkarsa geçmiş gölge kayıtlar ham girdilerden
 * yeniden ölçeklenebilir (ev/weekly.js → rescaleWithPayoutRatio) — yani bu
 * hata GERİ ALINABİLİR, oynanma yüzdesi kaybı gibi kalıcı değil.
 */
export const VAT_RATE = 0.20;
export const VAT_INCLUDED_IN_PRICE = true;
export const VAT_RATE_SINCE = '2023-07-10';
export const VAT_RATE_CONFIDENCE = 'orta-yüksek';
export const VAT_RATE_SOURCE =
  'Genel KDV oranı %20 (7346 s. CK, 10.07.2023) + KDVK md.23 özel matrah (dahil) '
  + '+ Sayıştay 2023 gerçekleşmesi (%16,010) ile sayısal uyum. '
  + 'Spor Toto\'yu adıyla anan tebliğ/özelge BULUNAMADI.';

/**
 * ρ — motorun KULLANDIĞI oran: brüt kolon bedelinin ikramiyeye giden kısmı.
 * ρ = ρ_net × (net / brüt) = ρ_net / (1 + KDV)
 * KDV bilinmiyorsa null — motor ölçeksiz (havuz payı) çalışmaya devam eder.
 */
export const PAYOUT_RATIO = VAT_RATE == null ? null : PAYOUT_RATIO_NET / (1 + VAT_RATE);
export const PAYOUT_RATIO_SOURCE = VAT_RATE == null
  ? `ρ_net=${PAYOUT_RATIO_NET} bulundu ama KDV oranı bilinmiyor — brüt bedele çevrilemiyor.`
  : `${PAYOUT_RATIO_NET_SOURCE} · KDV: ${VAT_RATE_SOURCE}`;

/**
 * Kolon bedeli (TL). Araştırma bu değeri DOĞRULAMADI, yalnız TEYİT ETTİ:
 * 18.03.2025'ten beri 10 TL (öncesi 6.08.2023-17.03.2025 arası 2 TL, ondan
 * önce 0,50 TL) — ama yalnız haber kaynaklarından. Resmî Oyun Planı PDF'i
 * okundu ve fiyat tarifesini İÇERMİYOR; tarife ayrı bir karar/duyuruyla
 * belirleniyor ve o belgeye ulaşılamadı. Bu yüzden VERIFIED hâlâ false.
 */
export const COLUMN_PRICE_TL = 10;
export const COLUMN_PRICE_VERIFIED = false;
export const COLUMN_PRICE_SOURCE =
  'İkincil (haber) kaynaklar: 18.03.2025 itibarıyla 10 TL. Resmî tarife belgesi bulunamadı.';

/** Veraset ve İntikal Vergisi: istisnayı aşan kısma %20 (01.01.2026 istisnası). */
export const TAX_RATE = 0.20;
export const TAX_EXEMPTION_TL = 66935;

/**
 * GÖLGE MOD EŞİKLERİ (R1 §2.4):
 *   • λ (kalabalık yoğunlaşması) haftada yalnız 4 sayıdan öğrenilir → yavaş.
 *   • 30 haftanın altında λ güvenilir DEĞİLDİR.
 *   • 15 haftanın altında hiçbir sayı kullanıcıya gösterilmez.
 */
export const MIN_WEEKS_FOR_LAMBDA = 30;
export const MIN_WEEKS_FOR_DISPLAY = 15;

/** Monte Carlo çekiliş sayısı (gölge kayıt için yeterli, deterministik tohumlu). */
export const DEFAULT_DRAWS = 20000;

/** Motorun bugünkü durumu — gölge kayıtlarına ve ileride ekrana yazılır. */
export function engineReadiness(weeksCalibrated) {
  const w = Number(weeksCalibrated) || 0;
  return {
    weeksCalibrated: w,
    lambdaReliable: w >= MIN_WEEKS_FOR_LAMBDA,
    displayAllowed: false, // T10: motor GÖLGE modda; ekran bağlantısı YOK
    note: w >= MIN_WEEKS_FOR_LAMBDA
      ? `λ ${w} haftalık veriyle kalibre edildi.`
      : `λ güvenilir değil (${w}/${MIN_WEEKS_FOR_LAMBDA} hafta). Motor gölge modda; sayı gösterilmez.`,
  };
}
