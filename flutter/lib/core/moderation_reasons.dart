// KAYNAK: app/src/moderationReasons.js — BİREBİR çeviri.
//
// BİLDİRİM SEBEPLERİ — ARAYÜZ ETİKETLERİ (E9)
//
// Buradaki ANAHTARLAR sunucunun kabul ettiği sebeplerdir; sunucu tarafı
// `backend/src/moderation.js` → BILDIRIM_SEBEPLERI, veritabanı tarafı
// `backend/migrations/007_moderation_report_block.sql` → reason CHECK kısıtı.
//
// ÜÇ LİSTE DE AYNI OLMAK ZORUNDA. Anahtarlardan biri burada yanlış yazılırsa
// kullanıcı sebebi seçer, "Gönder"e basar ve sunucudan "Geçerli bir sebep
// seçilmeli." yanıtını alır — hatayı yapan biziz ama suçlanan kullanıcı olur.
// Bu yüzden eşleşme ELLE değil, TESTLE korunur (test/moderation_reasons_test).
//
// SIRA da anlamlıdır: en sık kullanılan sebepler üstte, "Diğer" en sonda.
// "Diğer" seçilince açıklama alanı zorunlu olur, çünkü tek başına hiçbir şey
// anlatmaz.

/// Bildirim notunun üst sınırı (sunucudaki NOT_SINIRI ile aynı olmalı).
const int kNotSiniri = 300;

class BildirimSebebi {
  const BildirimSebebi({
    required this.key,
    required this.label,
    required this.hint,
  });

  /// Sunucuya gönderilen değer — ASLA çevrilmez, ASLA değiştirilmez.
  final String key;

  /// Düğme üzerindeki kısa metin.
  final String label;

  /// Seçildiğinde altta beliren açıklama; kullanıcı doğru sebebi seçebilsin
  /// diye. Sebepler birbirine karışırsa moderasyon verisi işe yaramaz olur.
  final String hint;
}

/// Sebepler — ekranda gösterilecek sırayla.
const List<BildirimSebebi> kBildirimSebepleri = [
  BildirimSebebi(
    key: 'spam',
    label: 'Spam / reklam',
    hint: 'Tekrar eden, alakasız veya reklam amaçlı ileti.',
  ),
  BildirimSebebi(
    key: 'hakaret',
    label: 'Hakaret',
    hint: 'Kişiyi hedef alan aşağılayıcı veya küfürlü söz.',
  ),
  BildirimSebebi(
    key: 'nefret',
    label: 'Nefret söylemi',
    hint: 'Bir gruba yönelik ayrımcı, düşmanca ifade.',
  ),
  BildirimSebebi(
    key: 'cinsel',
    label: 'Cinsel içerik',
    hint: 'Müstehcen veya cinsel içerikli paylaşım.',
  ),
  BildirimSebebi(
    key: 'siddet',
    label: 'Şiddet / tehdit',
    hint: 'Tehdit içeren ya da şiddeti öven ifade.',
  ),
  BildirimSebebi(
    key: 'yaniltici',
    label: 'Yanıltıcı bilgi',
    hint: 'Kasıtlı yanlış bilgi veya sahte iddia.',
  ),
  BildirimSebebi(
    key: 'diger',
    label: 'Diğer',
    hint: 'Yukarıdakilere uymuyorsa kısaca açıklaman gerekir.',
  ),
];

/// Yalnız anahtarlar — sunucuya giden değerlerin listesi.
final List<String> kSebepAnahtarlari = kBildirimSebepleri
    .map((s) => s.key)
    .toList(growable: false);

/// Anahtardan etiket. Bilinmeyen anahtar için anahtarın kendisi döner — boş
/// metin göstermek, kullanıcının ne bildirdiğini görememesi demekti.
String sebepEtiketi(Object? key) {
  for (final s in kBildirimSebepleri) {
    if (s.key == key) return s.label;
  }
  return '${key ?? ''}';
}

/// "Diğer" seçiliyken açıklama zorunludur: tek başına hiçbir bilgi taşımaz.
bool aciklamaZorunluMu(Object? key) => key == 'diger';
