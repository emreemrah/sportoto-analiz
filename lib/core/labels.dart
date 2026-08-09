// KAYNAK: app/src/labels.js — BİREBİR çeviri.
//
// Veri anahtarları (BANKO, DİKKAT …) karne ve geçmiş kayıtlarla uyumluluk için
// DEĞİŞTİRİLMEZ. Ancak kullanıcıya ASLA "Banko" yazısı gösterilmez — kesinlik
// / garanti iması taşır. Her ekran etiketi buradan geçirir: displayLabel(key).
//
// "Güçlü Aday" = koşullar güçlü görünüyor demektir; KAZANÇ GARANTİSİ DEĞİLDİR.

const Map<String, String> _display = {
  'BANKO': 'GÜÇLÜ ADAY',
  'GÜÇLÜ ADAY': 'GÜÇLÜ ADAY',
  'DİKKAT': 'DİKKAT',
  'SÜRPRİZE AÇIK': 'SÜRPRİZE AÇIK',
  'VERİ YOK': 'VERİ YOK',
  'NET': 'NET',
  'TEMKİNLİ': 'TEMKİNLİ',
  'ÇİFTE': 'ÇİFTE',
};

/// Veri anahtarını kullanıcıya gösterilecek metne çevirir.
/// Bilinmeyen anahtar olduğu gibi döner (uydurma etiket üretilmez).
String? displayLabel(Object? key) {
  if (key == null) return null;
  final k = '$key';
  return _display[k] ?? k;
}

/// Serbest metinde kalmış "banko" kökünü kullanıcı diline çevirir.
///
/// Analiz cümleleri kod içinde üretildiği için tek tek düzeltilir; bu yardımcı
/// yalnız backend'den gelen HAZIR cümleler için son güvenlik ağıdır. Sıralama
/// önemlidir: en uzun kalıp önce eşleşmeli, yoksa "Güçlü banko adayı" önce
/// "banko adayı" kuralına takılıp "Güçlü güçlü aday" olurdu.
String? humanizeVerdictText(String? text) {
  if (text == null || text.isEmpty) return text;
  return text
      .replaceAll('Güçlü banko adayı', 'Güçlü aday')
      .replaceAll(RegExp('banko adayı', caseSensitive: false), 'güçlü aday')
      .replaceAll(RegExp(r'\bBanko\b'), 'Güçlü Aday')
      .replaceAll(RegExp(r'\bbanko\b'), 'güçlü aday')
      .replaceAll(RegExp(r'\bbankoyu\b'), 'güçlü aday değerlendirmesini')
      .replaceAll(RegExp(r'\bbankonun\b'), 'güçlü adayın');
}
