// TÜRKİYE SAATİ — TEK TANIM.
//
// SORUN (16 Ağustos 2026'da ÖLÇÜLDÜ): resmî bülten maç saatini saat dilimi
// EKSİZ verir — `"2026-08-21T21:30:00"`. Bu bir DUVAR SAATİDİR (Türkiye).
// `new Date(...)` böyle bir metni SUNUCUNUN yerel saat diliminde yorumlar:
//
//   TZ=Europe/Istanbul → 2026-08-21T18:30:00.000Z   (doğru an)
//   TZ=UTC             → 2026-08-21T21:30:00.000Z   (3 saat İLERİ — yanlış)
//
// Geliştirme makinesi TSİ olduğu için hata görünmüyordu; üretim (Render) UTC
// çalışıyor ve oradaki BÜTÜN maç anları 3 saat ileri kaymıştı. Sonuçları:
//   * `/api/radar/current` → kickoffAt üç saat ileri (ölçüldü).
//   * Başlamış maç tespiti (`server.js`, `tahminKapisi.js`) maç başladıktan
//     sonra 3 saat daha "başlamadı" diyordu — yani OYNANAN maça analiz/tahmin
//     üretilebiliyordu. Bu, projenin temel kuralının ihlalidir.
//
// ÇÖZÜM: maç anı TEK yerden çözülür. Saat dilimi eki VARSA olduğu gibi
// kullanılır; YOKSA Türkiye duvar saati kabul edilip +03:00 uygulanır. Böylece
// sonuç sunucunun saat diliminden BAĞIMSIZDIR.
//
// Türkiye 2016'dan beri KALICI UTC+3'tür (yaz saati uygulaması yok), bu yüzden
// sabit ofset kesindir ve saat dilimi kitaplığı gerekmez.

/** Türkiye kalıcı UTC+3 (yaz saati yok). */
export const TR_OFFSET_MS = 3 * 3600e3;

/** Metnin sonunda saat dilimi eki var mı? (`Z`, `+03:00`, `-0500`) */
const SAAT_DILIMI_EKI = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Yalnız tarih (`2026-08-21`) — saat yok. */
const SADECE_TARIH = /^\d{4}-\d{2}-\d{2}$/;

/// Bülten maç saatini UTC ms'ye çevirir. Çözülemezse `null`.
///
/// Uydurma yapmaz: değer yoksa ya da tanınmıyorsa `null` döner — çağıran
/// "bilinmiyor" diye davranır, tahmini bir ana YUVARLAMAZ.
export function macAniMs(deger) {
  if (deger == null || deger === '') return null;
  if (typeof deger === 'number') return Number.isFinite(deger) ? deger : null;
  if (deger instanceof Date) {
    const t = deger.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof deger !== 'string') return null;

  const s = deger.trim();
  if (!s) return null;

  // Saat dilimi ekli (ya da yalnız tarih — ES'e göre zaten UTC): olduğu gibi.
  if (SAAT_DILIMI_EKI.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }

  // Yalnız tarih: Türkiye gün başlangıcı sayılır (UTC gün başı DEĞİL).
  if (SADECE_TARIH.test(s)) {
    const t = Date.parse(`${s}T00:00:00+03:00`);
    return Number.isFinite(t) ? t : null;
  }

  // Duvar saati: Türkiye kabul edilir.
  const t = Date.parse(`${s}+03:00`);
  return Number.isFinite(t) ? t : null;
}

/// Bülten maç saatini UTC ISO metnine çevirir. Çözülemezse `null`.
export function macAniIso(deger) {
  const ms = macAniMs(deger);
  return ms == null ? null : new Date(ms).toISOString();
}

// NOT: gün anahtarı (`dayKeyOf`) ve gün-saati çevirimi burada YENİDEN
// TANIMLANMADI — `radar/playedDnaArchive.js` içindeki çalışan tanımlar
// kullanılır. Aynı işin iki tanımı sessiz sapma üretir.
