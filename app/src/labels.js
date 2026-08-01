// KULLANICIYA GÖRÜNEN ETİKET SÖZLÜĞÜ — tek doğruluk kaynağı.
//
// KURAL (kesin): Analiz katmanları ve backend, veri anahtarı olarak eski
// teknik etiketleri (ör. 'BANKO') üretmeye devam eder; bu anahtarlar arşiv,
// karne ve geçmiş kayıtlarla uyumluluk için DEĞİŞTİRİLMEZ. Ancak kullanıcıya
// ASLA "Banko" yazısı gösterilmez — kesinlik/garanti iması taşır.
// Her ekran etiketi buradan geçirir: displayLabel(key).
//
// "Güçlü Aday" = koşullar güçlü görünüyor demektir; KAZANÇ GARANTİSİ DEĞİLDİR.

const DISPLAY = {
  BANKO: 'GÜÇLÜ ADAY',
  'GÜÇLÜ ADAY': 'GÜÇLÜ ADAY',
  DİKKAT: 'DİKKAT',
  'SÜRPRİZE AÇIK': 'SÜRPRİZE AÇIK',
  'VERİ YOK': 'VERİ YOK',
  NET: 'NET',
  TEMKİNLİ: 'TEMKİNLİ',
  ÇİFTE: 'ÇİFTE',
  AÇIK: 'AÇIK',
};

// Veri anahtarını kullanıcıya gösterilecek metne çevirir.
// Bilinmeyen anahtar olduğu gibi döner (uydurma etiket üretilmez).
export function displayLabel(key) {
  if (key == null) return key;
  const k = String(key);
  return DISPLAY[k] || k;
}

// Serbest metinde kalmış "banko" kökünü kullanıcı diline çevirir.
// (Analiz cümleleri kod içinde üretildiği için tek tek düzeltilir; bu yardımcı
// yalnız backend'den gelen hazır cümleler için son güvenlik ağıdır.)
export function humanizeVerdictText(text) {
  if (!text) return text;
  return String(text)
    .replace(/Güçlü banko adayı/g, 'Güçlü aday')
    .replace(/banko adayı/gi, 'güçlü aday')
    .replace(/\bBanko\b/g, 'Güçlü Aday')
    .replace(/\bbanko\b/g, 'güçlü aday')
    .replace(/\bbankoyu\b/g, 'güçlü aday değerlendirmesini')
    .replace(/\bbankonun\b/g, 'güçlü adayın');
}
