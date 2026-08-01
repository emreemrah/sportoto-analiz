// ---------------------------------------------------------------------------
// BİLDİRİM SEBEPLERİ — ARAYÜZ ETİKETLERİ (E9)
// ---------------------------------------------------------------------------
// Buradaki ANAHTARLAR sunucunun kabul ettiği sebeplerdir; sunucu tarafı
// `backend/src/moderation.js` → BILDIRIM_SEBEPLERI, veritabanı tarafı
// `backend/migrations/007_moderation_report_block.sql` → reason CHECK kısıtı.
//
// ÜÇ LİSTE DE AYNI OLMAK ZORUNDA. Anahtarlardan biri burada yanlış yazılırsa
// kullanıcı sebebi seçer, "Gönder"e basar ve sunucudan "Geçerli bir sebep
// seçilmeli." yanıtını alır — hatayı yapan biziz ama suçlanan kullanıcı olur.
// Bu yüzden eşleşme ELLE değil, testle korunur:
//   app/test/moderation-reasons.test.mjs   (arayüz ↔ sunucu)
//   backend/test/moderation.test.mjs       (sunucu ↔ veritabanı)
//
// SIRA da anlamlıdır: en sık kullanılan sebepler üstte, "Diğer" en sonda.
// "Diğer" seçilince açıklama alanı daha görünür bir hâl alır, çünkü tek başına
// hiçbir şey anlatmaz.

/** Bildirim notunun üst sınırı (sunucudaki NOT_SINIRI ile aynı olmalı). */
export const NOT_SINIRI = 300;

/**
 * Sebepler — ekranda gösterilecek sırayla.
 *   key   → sunucuya gönderilen değer (ASLA çevrilmez, ASLA değiştirilmez)
 *   label → düğme üzerindeki kısa metin
 *   hint  → seçildiğinde altta beliren açıklama; kullanıcı doğru sebebi
 *           seçebilsin diye. Sebepler birbirine karışırsa moderasyon verisi
 *           işe yaramaz hâle gelir.
 */
export const BILDIRIM_SEBEPLERI = Object.freeze([
  { key: 'spam', label: 'Spam / reklam', hint: 'Tekrar eden, alakasız veya reklam amaçlı ileti.' },
  { key: 'hakaret', label: 'Hakaret', hint: 'Kişiyi hedef alan aşağılayıcı veya küfürlü söz.' },
  { key: 'nefret', label: 'Nefret söylemi', hint: 'Bir gruba yönelik ayrımcı, düşmanca ifade.' },
  { key: 'cinsel', label: 'Cinsel içerik', hint: 'Müstehcen veya cinsel içerikli paylaşım.' },
  { key: 'siddet', label: 'Şiddet / tehdit', hint: 'Tehdit içeren ya da şiddeti öven ifade.' },
  { key: 'yaniltici', label: 'Yanıltıcı bilgi', hint: 'Kasıtlı yanlış bilgi veya sahte iddia.' },
  { key: 'diger', label: 'Diğer', hint: 'Yukarıdakilere uymuyorsa kısaca açıklaman gerekir.' },
]);

/** Yalnız anahtarlar — sunucuya giden değerlerin listesi. */
export const SEBEP_ANAHTARLARI = Object.freeze(BILDIRIM_SEBEPLERI.map((s) => s.key));

/**
 * Anahtardan etiket. Bilinmeyen anahtar için anahtarın kendisi döner —
 * boş metin göstermek, kullanıcının ne bildirdiğini görememesi demekti.
 */
export function sebepEtiketi(key) {
  const s = BILDIRIM_SEBEPLERI.find((x) => x.key === key);
  return s ? s.label : String(key || '');
}

/** "Diğer" seçiliyken açıklama zorunludur: tek başına hiçbir bilgi taşımaz. */
export function aciklamaZorunluMu(key) {
  return key === 'diger';
}
