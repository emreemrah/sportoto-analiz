// KAPSAM GERİLEME KORUMASI — iyi veriyi bozuk veriyle ezme.
// ---------------------------------------------------------------------------
// GERÇEK OLAY (2 Ağustos 2026): FootyStats HTTP 429 (hız sınırı) döndü, 57
// sezonun HEPSİ düştü ve bülten eşleşmesi 14/15 → 0/15 oldu. Sezon hataları
// yalnız console.warn'a yazıldığı için akış devam etti; DOLU bülten TAMAMEN
// BOŞ bültenle ezildi ve durum `ok: true` olarak kaydedildi. Kullanıcı verisiz
// bir ekranla kaldı, sistem ise kendini başarılı sanıyordu.
//
// KURAL: aynı hafta için elde ÇALIŞAN bir bülten varken, kapsamı çökmüş bir
// sonuç YAZILMAZ. Eski veri korunur ve durum HATA olarak bildirilir.
//
// NEDEN "0'a düşerse" ve neden "yarıya düşerse" DEĞİL:
// Kapsam meşru sebeplerle de düşebilir — yeni sezon başında bazı ligler henüz
// yayımlanmamış olabilir, bülten kapsam dışı lig içerebilir. Eşiği yükseltmek,
// gerçek ve doğru bir düşüşü "hata" sayıp güncellemeyi kalıcı olarak bloke
// etme riski taşır. TAM çöküş (hiçbir maç eşleşmedi) ise meşru bir durum
// değildir: 15 maçın hiçbirinin bulunamaması yalnız kaynak erişilemezken olur.

/** Bir bültende kaç maçın kaynakla eşleştiği. */
export function eslesenSayisi(bulten) {
  const maclar = bulten?.matches;
  if (!Array.isArray(maclar)) return 0;
  return maclar.filter((m) => {
    // `coverage.ok` asıl göstergedir. Eski kayıtlarda coverage olmayabilir;
    // o zaman kaynak sezon kimliğinin varlığı eşleşmenin kanıtıdır.
    if (m?.coverage && typeof m.coverage.ok === 'boolean') return m.coverage.ok;
    return m?.footySeasonId != null;
  }).length;
}

/**
 * Yeni sonuç yazılmalı mı? true → YAZMA, eski veriyi koru.
 * Elde çalışan veri yoksa (ilk kurulum) koruma devreye GİRMEZ; yoksa sistem
 * hiçbir zaman ilk bültenini yazamazdı.
 */
export function kapsamGerilemesi(oncekiEslesen, yeniEslesen) {
  return oncekiEslesen > 0 && yeniEslesen === 0;
}
