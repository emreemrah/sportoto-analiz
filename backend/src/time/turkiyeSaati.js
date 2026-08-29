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

// ————————————————————————————————————————————————————————————————————————
// GÜN ANAHTARI — TEK TANIM (16 Ağustos 2026 kod denetimi).
//
// Bu iki yardımcı `radar/dailyOdds.js` ve `radar/playedDnaArchive.js` içinde
// AYRI AYRI tanımlıydı. Yazımları farklıydı (biri `istanbulParts`, diğeri
// doğrudan UTC getter'ları), anlamları AYNIYDI: 20.000 örnekle, iki yılı aşan
// aralıkta taranıp SIFIR fark ölçüldü. Yani aktif bir hata yoktu.
//
// Yine de birleştirildi: ikisi de MÜHÜRLEME gün anahtarı üretiyor (Radar 3
// oynanma DNA'sı ve Radar 4 oran takibi). Biri değişirse iki radar gözlemleri
// farklı günlere yazar ve mühürler sessizce ayrışır — kıyas bozulur, kimse
// hata görmez. Eşdeğerliği kanıt değil, YAPI garanti etmeli.
//
// (Bu dosyanın ilk sürümünde "gün anahtarını burada yeniden tanımlamadım"
// notu vardı; o sırada `dailyOdds`'un kendi kopyası olduğu görülmemişti.)

/// UTC ms → Türkiye gün anahtarı (`YYYY-MM-DD`).
export function dayKeyOf(ms) {
  const d = new Date(ms + TR_OFFSET_MS);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/// Türkiye gün anahtarı + saat/dakika → UTC ms.
export function istanbulTimeToUtcMs(dayKey, hour, minute) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  return Date.UTC(y, m - 1, d, hour, minute, 0) - TR_OFFSET_MS;
}

// MAÇ SAATİ GİRİLMİŞ Mİ? Spor Toto yeni haftayı bazen saat girmeden yayınlar:
// tarih doğru, saat "00:00:00" yer tutucu (4. Hafta, 29 Ağu 2026 — 9 Süper Lig
// maçı TFF saatleri açıklamadan bültene girdi). Bu "gece yarısı" gerçek bir
// başlama anı gibi işlenirse maç o gün 00:00'da "başladı" sayılır, kilit ve
// dondurma bir gün erkene kayar, kart 00:00 basar. Kural: saat bileşeni tam
// 00:00:00 ise saat BİLİNMİYOR sayılır; gerçek bir gece yarısı maçı (nadir)
// eşleşen kaynak fikstürüyle refresh'te geri açılır (bkz. refresh.js).
export function saatBilinir(deger) {
  if (deger == null || deger === '') return false;
  if (typeof deger !== 'string') return macAniMs(deger) != null;
  const s = deger.trim();
  if (SADECE_TARIH.test(s)) return false;
  return !/T00:00(:00(\.0+)?)?$/.test(s);
}

// BAŞLAMA ANI (ms): resmî saat girildiyse o; girilmediyse eşleşen kaynak
// fikstüründen türetilen TAHMİNÎ an (`kickoffEstimate`); o da yoksa null.
// Tek fonksiyon: başladı / canlı penceresi / kilit / dondurma / gözlem
// pencereleri aynı anı okur; biri resmî, diğeri tahminî saate bakamaz.
export function baslamaAniMs(m) {
  if (!m) return null;
  if (m.kickoffTimeKnown !== false) return macAniMs(m.date ?? m.kickoffAt);
  return macAniMs(m.kickoffEstimate);
}

// Kaynak fikstürünün anı (UTC unix sn) → Türkiye duvar saati, bülten
// biçiminde ('YYYY-MM-DDTHH:mm:ss', dilim eki yok). Kaynağın KENDİ yer
// tutucusu (tam 00:00 UTC — F.Bahçe–Beşiktaş 29 Ağu 2026'da böyleydi) tahmin
// SAYILMAZ: saat bilinmiyor kalır, uydurma saat basılmaz.
export function tahminiBaslama(dateUnix) {
  if (!Number.isFinite(dateUnix) || dateUnix <= 0) return null;
  if (dateUnix % 86400 === 0) return null;
  const s = new Date(dateUnix * 1000).toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' });
  return s.replace(' ', 'T');
}
