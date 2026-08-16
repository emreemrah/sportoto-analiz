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

/// JSON'dan gelen sayıyı TEK KURALLA tam sayıya çevirir.
///
/// KAPSAMLI KOD DENETİMİNDE BULUNDU (16 Ağustos 2026): aynı işi yapan
/// `_sayi` yardımcısı ÜÇ dosyada ayrı ayrı tanımlıydı ve ikisi FARKLI
/// davranıyordu:
///
///   moderation_view.dart      → metni parse eder  ("12" → 12)
///   archive_mappers.dart      → metinde 0 döner   ("12" → 0)
///   bulletin_history_service  → metinde 0 döner   ("12" → 0)
///
/// Riskli olan, hatanın SESSİZ olması: `systemWrong` sayısı 0 çıkardı ya da
/// hafta sıralaması bozulurdu; ne uyarı ne çökme olurdu. Ölçüm bugünkü API'nin
/// bu alanları SAYI gönderdiğini gösterdi (yani aktif bir yanlış değer yoktu),
/// ama AYNI yanıtta `id` metin olarak geliyor — uç tip karıştırıyor. Sessiz
/// sıfır üretebilecek bir ayrışmayı açık bırakmanın gereği yok.
///
/// Bu tanım hepsinin üst kümesidir: sayı aynen, sayısal metin PARSE edilir,
/// tanınmayan değer 0 olur (uydurma yok — çağıran "veri yok" diyebilsin diye
/// [sayiyaNullable] da vardır).
int sayiya(Object? v) =>
    v is num ? v.toInt() : (int.tryParse('$v') ?? 0);

/// [sayiya] gibi ama çözülemeyen değer için `null` döner — "0" ile "bilinmiyor"
/// ayrımının korunması gereken yerlerde kullanılır.
int? sayiyaNullable(Object? v) =>
    v is num ? v.toInt() : int.tryParse('$v');

/// BÜLTEN MAÇ SAATİNİ GERÇEK ANA ÇEVİRİR — TEK TANIM.
///
/// SORUN (16 Ağustos 2026, kullanıcı bildirdi): "Yaklaşan Maçlar"da BAŞLAMIŞ
/// maçlar görünüyordu.
///
/// Resmî bülten maç saatini saat dilimi EKSİZ verir (`"2026-08-16T19:00:00"`)
/// ve bu bir TÜRKİYE DUVAR SAATİDİR. `DateTime.parse` böyle bir metni CİHAZIN
/// yerel saatinde yorumlar; cihaz TSİ değilse karşılaştırma ofset kadar kayar.
///
/// ÖLÇÜLDÜ (emülatör GMT): gerçek saat 20:35 TSİ iken 19:00'da başlamış maç,
/// cihaz saatine göre "1,5 saat sonra" görünüyordu — yani başlamış maç
/// "yaklaşan" sayılıyordu. Bu, aynı gün backend'de düzeltilen saat dilimi
/// hatasının İSTEMCİ İKİZİDİR.
///
/// KARŞILAŞTIRMA bu fonksiyonla yapılır (gerçek an); GÖSTERİM duvar saatinde
/// kalır — kullanıcı resmî bültendeki saati görür, Türkiye saatini.
///
/// Türkiye 2016'dan beri kalıcı UTC+3'tür (yaz saati yok), sabit ofset kesin.
DateTime? macAni(Object? iso) {
  if (iso is! String || iso.trim().isEmpty) return null;
  final s = iso.trim();
  // Saat dilimi eki VARSA olduğu gibi; YOKSA Türkiye duvar saati kabul edilir.
  final ekli = RegExp(r'(?:Z|[+-]\d{2}:?\d{2})$', caseSensitive: false);
  return DateTime.tryParse(ekli.hasMatch(s) ? s : '$s+03:00');
}

/// Maçın başlama anı GELDİ mi? (gerçek ana göre, cihaz saat diliminden bağımsız)
bool macBasladi(Object? iso, {DateTime? simdi}) {
  final t = macAni(iso);
  if (t == null) return false;
  return !t.isAfter(simdi ?? DateTime.now());
}

/// Gerçek anı TÜRKİYE duvar saatine çevirir — GÖSTERİM içindir.
///
/// SORUN (16 Ağustos 2026 denetimi): aynı maç iki ekranda İKİ FARKLI saat
/// gösteriyordu. Bülten `date` alanını olduğu gibi basıyor (Türkiye duvar
/// saati, hep 21:30); Radar ise `kickoffAt`'i (gerçek an) CİHAZ saatine
/// çeviriyordu — GMT emülatörde 18:30 çıkıyordu. Ölçüldü:
///   bülten 21:30 · radar 18:30 · aynı maç, aynı an.
///
/// Türkiye'deki telefonda ikisi de 21:30 olduğu için fark görünmüyordu; yine
/// de uygulama tek maça iki saat yazamaz. Resmî bülten saati TÜRKİYE saatidir;
/// uygulama her ekranda onu gösterir.
///
/// Dönen değerin ALANLARI (`hour`, `minute`, `day`, `month`) okunduğunda
/// Türkiye saatini verir; karşılaştırma için değil, yazdırmak içindir
/// (karşılaştırma [macAni] ile yapılır).
DateTime? trAlanlari(Object? iso) =>
    macAni(iso)?.toUtc().add(const Duration(hours: 3));
