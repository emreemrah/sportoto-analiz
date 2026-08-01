// KALİBRASYON EKRANI MANTIĞI — saf yardımcılar (RN'siz test edilebilir).
//
// SUNUM KURALLARI (araştırma R4'ten, ihlal edilirse ekran yanıltıcı olur):
//  1. ANA RAKAM skill score'dur, "kaç tuttu" DEĞİL. Aksi hâlde kullanıcı
//     0.646 → 0.630 gibi gerçek bir iyileşmeyi hiç göremez.
//  2. Her yüzdenin yanında n bulunur; yüzde tek başına asla gösterilmez.
//  3. Güven aralığı söylenen değeri kapsıyorsa "sapma" DENMEZ —
//     "ayırt edilemiyor" denir.
//  4. Negatif beceri gizlenmez: "piyasadan daha kötü" yazılır.
//  5. Beklenti ayarı zorunlu: mükemmel bir piyasa bile rastgele tahmine göre
//     ancak ~%12 iyileşir. "Ayırt edilemiyor" beklenen ve dürüst sonuçtur.
//  6. Model olasılığı oranlardan türüyorsa (bu üründe çoğu maçta öyle),
//     piyasaya karşı beceri TANIM GEREĞİ sıfırdır ve bu açıkça söylenir.

export const CALIBRATION_EMPTY_TITLE = 'Kalibrasyon için henüz yeterli sonuç yok.';
export const CALIBRATION_EMPTY_MESSAGE =
  'Bu ölçüm, mühürlü tahminler resmî sonuçlarla eşleştikçe otomatik oluşur. '
  + 'Geçmişe dönük hesap yapılmaz.';

export const EXPECTATION_NOTE =
  'Bu işte kazanılabilecek pay çok küçüktür: mükemmel bir piyasa bile rastgele '
  + 'tahmine göre yalnız ~%12 iyileşir. "Piyasadan ayırt edilemiyor" sonucu '
  + 'beklenen ve dürüst sonuçtur.';

/** Rapor gösterilebilir mi? (default-deny: alan yoksa GÖSTERME) */
export function hasCalibrationData(rep) {
  return !!(rep && rep.hasData === true && rep.model && rep.model.n > 0);
}

/** Skill score → kullanıcı cümlesi. Yüzde puanı olarak, yönüyle birlikte. */
export function skillText(skill) {
  if (skill == null || !Number.isFinite(skill)) return null;
  const puan = Math.round(skill * 1000) / 10;   // 0.012 → 1.2
  if (Math.abs(puan) < 0.5) {
    return { puan, yon: 'esit', metin: 'Piyasadan ayırt edilemiyor', tone: 'neutral' };
  }
  if (puan > 0) return { puan, yon: 'iyi', metin: `Piyasadan %${puan} daha iyi`, tone: 'success' };
  return { puan, yon: 'kotu', metin: `Piyasadan %${Math.abs(puan)} daha kötü`, tone: 'danger' };
}

/**
 * ANA BAŞLIK — ekranın en üstünde duracak tek cümle.
 * Sıralama bilinçli: önce beceri, sonra örneklem. İsabet oranı BAŞLIKTA YOK.
 */
export function calibrationHeadline(rep) {
  if (!hasCalibrationData(rep)) return null;
  const vsMarket = skillText(rep.skill?.vsMarket?.logLoss);
  const vsBaseline = skillText(rep.skill?.vsBaseline?.logLoss);
  return {
    n: rep.model.n,
    weeks: rep.roundsCounted ?? 0,
    vsMarket,
    vsBaseline,
    // Piyasa referansı yoksa (hiç oran yoksa) dürüstçe söyle.
    marketMissing: !rep.market,
  };
}

/**
 * "Model = piyasa" uyarısı. Bu üründe olasılık çoğu maçta doğrudan oranlardan
 * türüyor; o maçlarda piyasayı yenmek TANIM GEREĞİ imkânsız. Gizlenirse
 * kullanıcı "neden hep sıfır?" diye düşünür ve yanlış sonuç çıkarır.
 */
export function marketDerivedNotice(rep) {
  const pay = rep?.marketDerived?.share;
  if (pay == null || pay <= 0) return null;
  const tam = pay >= 99.5;
  return {
    share: pay,
    title: tam ? 'Olasılıkların tamamı orandan türüyor' : `Olasılıkların %${pay}'i orandan türüyor`,
    body: 'Oranı olan maçlarda gösterdiğimiz olasılık, oranların marjdan '
      + 'arındırılmış hâlidir. Bu maçlarda "piyasayı yenmek" tanım gereği '
      + 'mümkün değildir; beceri sıfıra yakın çıkar ve bu bir başarısızlık '
      + 'değildir. Bağımsız ölçüm yalnız oranı bulunamayan maçlarda yapılır.',
  };
}

/**
 * GERÇEK SINAV: oranı bulunamayan maçlar. Piyasadan türemediği için modelin
 * kendi katkısı yalnız burada ölçülebilir. Örneklem küçükse söylenir; küçük n
 * ile "iyiyiz/kötüyüz" denmez.
 */
export function independentTestText(rep) {
  const e = rep?.estimatedOnly;
  if (!e || !e.n) return null;
  const guvenli = e.n >= 30;
  return {
    n: e.n,
    logLoss: e.logLoss,
    brier: e.brier,
    reliable: guvenli,
    title: 'Bağımsız sınav — oranı olmayan maçlar',
    body: guvenli
      ? `Bu ${e.n} maçta olasılık piyasadan türemedi; modelin kendi katkısı `
        + `yalnız burada görünür (log-loss ${e.logLoss}, rastgele ${rep.uniform?.logLoss ?? '—'}).`
      : `Yalnız ${e.n} maç var — bu sayıda hiçbir yön (iyi ya da kötü) `
        + 'güvenilir değildir. Sayı büyüdükçe anlamlı olacak.',
  };
}

/** Skor tablosu satırları — model / piyasa / taban yan yana. */
export function scoreRows(rep) {
  if (!hasCalibrationData(rep)) return [];
  const satir = (ad, s, not = null) => (s ? {
    ad, n: s.n, logLoss: s.logLoss, brier: s.brier, rps: s.rps, not,
  } : null);
  return [
    satir('Model', rep.model),
    satir('Piyasa (oran)', rep.market, rep.market ? null : 'oran yok'),
    satir('Lig taban oranı', rep.baseline),
    satir('Rastgele (1/3)', {
      n: rep.model.n, logLoss: rep.uniform?.logLoss, brier: rep.uniform?.brier, rps: rep.uniform?.rps,
    }, 'referans'),
  ].filter(Boolean);
}

/**
 * Kalibrasyon eğrisi satırları. Kural 3: aralık söylenen değeri kapsıyorsa
 * "sapma" denmez. Her satırda n zorunlu.
 */
export function curveRows(rep) {
  const c = rep?.curve;
  if (!c || c.insufficient || !c.bins?.length) return [];
  return c.bins.map((b) => ({
    ...b,
    // Kullanıcı cümlesi — FiveThirtyEight kalıbı: "%60 dediğimiz X maçın %61'i oldu"
    metin: `%${b.saidPct} dediğimiz ${b.n} durumun %${b.actualPct}'i gerçekleşti`,
    durum: b.distinguishable ? 'sapma' : 'ayirt-edilemiyor',
    durumMetni: b.distinguishable
      ? 'Söylenen değerden ayrışıyor'
      : 'Söylenen değerden ayırt edilemiyor',
  }));
}

/** Eğri çizilemiyorsa kullanıcıya söylenecek dürüst cümle. */
export function curveUnavailableText(rep) {
  const c = rep?.curve;
  if (!c || (!c.insufficient && c.bins?.length)) return null;
  return c.note || 'Kalibrasyon eğrisi için yeterli gözlem yok.';
}
