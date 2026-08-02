// RADAR GÜN SEÇİMİ — hangi günün ekranda açılacağı.
// ---------------------------------------------------------------------------
// GERÇEK HATA (2 Ağustos 2026, pazar): Radar 3 CUMA gününde takılı kalıyordu.
// İki kusur üst üste bindi:
//
//   1. Gelecek günler aday olmaktan ELENMİYORDU. Bülten 2-7 Ağustos arasını
//      kapsıyor; 3-7 Ağustos'un hepsi "gelecek". Seçici "veri olan SON gün"
//      dediği için 7 Ağustos Cuma'yı seçiyordu.
//   2. "Veri var mı" kontrolü hücrenin DOĞRULUĞUNA bakıyordu:
//      `m.cells?.[tarih]`. Gelecek günlerin hücresi BOŞ NESNE (`{}`) geliyor
//      ve boş nesne JavaScript'te doğrudur — dolayısıyla veri sayılıyordu.
//
// İkisi ayrı ayrı zararsız görünür, birlikte ekranı yanlış güne kilitler ve
// hiçbir hata vermez. Kullanıcı bugünün verisini göremez.
//
// KURAL: varsayılan gün, GERÇEK VERİSİ OLAN en son geçmiş/bugün günüdür.
// Gelecek gün asla varsayılan olmaz — henüz oynanmamış bir günün oynanma
// yüzdesi yoktur.

/**
 * Hücrede gerçekten veri var mı? Boş nesne veri DEĞİLDİR.
 * (Kaynak, gelecek günler için `{}` gönderiyor.)
 */
export function hucreDolu(hucre) {
  if (!hucre || typeof hucre !== 'object') return false;
  return Object.keys(hucre).length > 0;
}

/**
 * Ekranda açılacak varsayılan günü seçer.
 *
 * @param {Array}    days      [{ date, future }]
 * @param {Array}    matches   [{ cells: { [date]: hücre } }]
 * @param {Function} hucreSec  maç + tarih → hücre (radarlar farklı yerde tutar)
 * @returns {string|null} tarih
 */
export function varsayilanGun(days, matches, hucreSec = (m, t) => m?.cells?.[t]) {
  const liste = Array.isArray(days) ? days : [];
  if (!liste.length) return null;

  const gecmisVeBugun = liste.filter((g) => !g?.future);

  // Bültenin tamamı ileri tarihliyse (yeni açılmış hafta) EN YAKIN günü göster.
  // Son günü göstermek, kullanıcıyı bir hafta sonrasına atardı.
  if (!gecmisVeBugun.length) return liste[0]?.date ?? null;

  const veriliGunler = gecmisVeBugun.filter(
    (g) => (matches || []).some((m) => hucreDolu(hucreSec(m, g.date))),
  );

  // Hiçbirinde veri yoksa yine de en son geçmiş/bugün gününde kal —
  // gelecek güne kaçmak yanlış bilgi izlenimi verir.
  const sec = veriliGunler.length
    ? veriliGunler[veriliGunler.length - 1]
    : gecmisVeBugun[gecmisVeBugun.length - 1];
  return sec?.date ?? null;
}
