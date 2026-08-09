// KAYNAK: app/src/utils.js — BİREBİR çeviri.
//
// Ülke adından bayrak emojisi (veri sağlayıcının nationality alanı → emoji).
// Eşleşmezse boş döner (bayrak gösterilmez).

const Map<String, String> _iso = {
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Finland': 'FI',
  'Iceland': 'IS',
  'England': 'GB',
  'Scotland': 'GB',
  'Wales': 'GB',
  'Northern Ireland': 'GB',
  'Ireland': 'IE',
  'Spain': 'ES',
  'France': 'FR',
  'Germany': 'DE',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Portugal': 'PT',
  'Italy': 'IT',
  'Switzerland': 'CH',
  'Austria': 'AT',
  'Greece': 'GR',
  'Croatia': 'HR',
  'Serbia': 'RS',
  'Bosnia and Herzegovina': 'BA',
  'Bosnia': 'BA',
  'Slovenia': 'SI',
  'Slovakia': 'SK',
  'Czech Republic': 'CZ',
  'Czechia': 'CZ',
  'Poland': 'PL',
  'Hungary': 'HU',
  'Romania': 'RO',
  'Bulgaria': 'BG',
  'Ukraine': 'UA',
  'Russia': 'RU',
  'Turkey': 'TR',
  'Albania': 'AL',
  'Kosovo': 'XK',
  'North Macedonia': 'MK',
  'Montenegro': 'ME',
  'Brazil': 'BR',
  'Argentina': 'AR',
  'Uruguay': 'UY',
  'Chile': 'CL',
  'Colombia': 'CO',
  'Peru': 'PE',
  'Ecuador': 'EC',
  'Paraguay': 'PY',
  'Venezuela': 'VE',
  'Mexico': 'MX',
  'United States': 'US',
  'USA': 'US',
  'Canada': 'CA',
  'Japan': 'JP',
  'South Korea': 'KR',
  'Korea Republic': 'KR',
  'Korea': 'KR',
  'China': 'CN',
  'China PR': 'CN',
  'Australia': 'AU',
  'New Zealand': 'NZ',
  'Iran': 'IR',
  'Iraq': 'IQ',
  'Saudi Arabia': 'SA',
  'Qatar': 'QA',
  'United Arab Emirates': 'AE',
  'Uzbekistan': 'UZ',
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Indonesia': 'ID',
  'Mali': 'ML',
  'Senegal': 'SN',
  'Nigeria': 'NG',
  'Ghana': 'GH',
  'Gambia': 'GM',
  'Ivory Coast': 'CI',
  "Cote d'Ivoire": 'CI',
  'Cameroon': 'CM',
  'Morocco': 'MA',
  'Algeria': 'DZ',
  'Tunisia': 'TN',
  'Egypt': 'EG',
  'South Africa': 'ZA',
  'Kenya': 'KE',
  'Zambia': 'ZM',
  'Zimbabwe': 'ZW',
  'Angola': 'AO',
  'Guinea': 'GN',
  'Burkina Faso': 'BF',
  'DR Congo': 'CD',
  'Congo DR': 'CD',
  'Congo': 'CG',
  'Togo': 'TG',
  'Benin': 'BJ',
  'Sierra Leone': 'SL',
  'Liberia': 'LR',
  'Gabon': 'GA',
  'Israel': 'IL',
};

/// Ülke adından bayrak emojisi. Eşleşmezse ''.
String countryFlag(String? name) {
  final code = _iso[name];
  if (code == null) return '';
  // ISO2 harfleri bölgesel gösterge sembollerine kaydırılır (A → 🇦).
  return code.runes.map((r) => String.fromCharCode(127397 + r)).join();
}

/// Ülke adından küçük harfli ISO2 kodu (bayrak görseli için). Eşleşmezse ''.
String countryCode(String? name) => _iso[name]?.toLowerCase() ?? '';

/// TÜRKÇE KÜÇÜK HARF — Dart'ın `toLowerCase()`'i Türkçede YANLIŞTIR.
///
/// Dart 'I' → 'i' yapar; Türkçede 'ı' olmalıdır ('İ' → 'i'). Kaynak her yerde
/// `toLocaleLowerCase('tr-TR')` kullanıyordu, Dart'ta yerleşik karşılığı yok.
/// Fark arama süzmesinde görünür: "Işıklar" yazan kullanıcı, doğru dönüşüm
/// olmadan "ışıklar" kaydını BULAMAZ.
String kucukTr(String s) =>
    s.replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();

/// TÜRKÇE BÜYÜK HARF — aynı sebeple: 'i' → 'İ', 'ı' → 'I'.
String buyukTr(String s) =>
    s.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();

const List<String> _aylar = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

class MatchDateParts {
  const MatchDateParts(this.day, this.time);
  final String day;
  final String time;
}

/// "2026-07-03T20:00:00" → { day: "3 Tem", time: "20:00" }
///
/// Kaynakta `new Date(iso)` + `d.getDate()` / `d.getHours()` kullanılıyor;
/// ikisi de YEREL saat dilimine göre çalışır. `DateTime.parse` ise sonda 'Z'
/// ya da ofset yoksa değeri yerel kabul eder, varsa UTC işaretler — bu yüzden
/// `.toLocal()` ile kaynağın davranışı birebir korunur.
MatchDateParts matchDate(String? iso) {
  if (iso == null || iso.isEmpty) return const MatchDateParts('', '');
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return const MatchDateParts('', '');
  String p(int n) => n.toString().padLeft(2, '0');
  return MatchDateParts(
    '${d.day} ${_aylar[d.month - 1]}',
    '${p(d.hour)}:${p(d.minute)}',
  );
}

/// KULÜP ARMASI — bir maçın verilen tarafı için arma adresi.
///
/// İki kaynak vardır ve sıralaması önemlidir:
///   1) match.stats[side].logo — maç kaynak fikstürüyle eşleştiğinde gelir
///      (en kesin).
///   2) match[side].logo       — arma kayıt defterinden gelir; maç eşleşmese
///      bile kulübün arması biliniyorsa dolu olur.
///
/// İkisi de yoksa null döner ve çağıran nötr ⚽ çizer. Başka kulübün arması
/// veya "benzeri" bir görsel ASLA konmaz — bu karar backend'de verilir,
/// burada sadece okunur.
String? crestOf(Map<String, dynamic>? match, String side) {
  final stats = match?['stats'];
  if (stats is Map) {
    final s = stats[side];
    if (s is Map) {
      final logo = s['logo'];
      if (logo is String && logo.isNotEmpty) return logo;
    }
  }
  final direct = match?[side];
  if (direct is Map) {
    final logo = direct['logo'];
    if (logo is String && logo.isNotEmpty) return logo;
  }
  return null;
}
