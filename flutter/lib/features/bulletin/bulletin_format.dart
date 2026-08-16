// KAYNAK: app/src/screens/BulletinScreen.js — dosya başındaki saf yardımcılar.
//
// Ekrandan AYRILDILAR: hepsi saf işlevdir, Flutter'a bağlı değildir ve testten
// doğrudan çağrılabilir. Kaynakta ekranın içinde duruyorlardı çünkü JS'te
// modül bölmenin maliyeti yoktu; burada ayırmak davranışı değiştirmez, yalnız
// test edilebilir kılar.

import '../../core/utils.dart';

/// Resmi sonuç 1/X/2 (sadece resmi skordan). false → henüz yok.
///
/// KAYNAKTAN BİLİNÇLİ SAPMA (2026-08-10): ertelenen maçın NOTER KARARI da
/// resmî sonuçtur ama SKORU YOKTUR (maç oynanmadı; skor uydurulmaz). RN
/// kaynağı bu durumu tanımıyordu ve 53. Hafta 14. maç sonsuza dek "Resmi
/// sonuç bekliyor" görünüyordu. viaNotary işaretli satır skorsuz da
/// çözülmüş sayılır; ekran skoru değil "Noter" rozetini basar.
bool officialResolved(Map? m) =>
    m != null &&
    m['result'] != null &&
    (m['score'] != null || m['viaNotary'] == true);

/// Geçmiş maç durumu: resmi sonuç / geçici skor / bekliyor.
String histCategory(Map? m) => officialResolved(m)
    ? 'official'
    : (m != null && m['provisional'] != null ? 'provisional' : 'waiting');

/// Geçmiş maçın CANLI-uyumlu durumu (Bülten ile aynı filtreler için).
String pastStatus(Map? m, {DateTime? now}) {
  if (officialResolved(m)) return 'finished';
  final prov = m?['provisional'] as Map?;
  if (prov != null && prov['live'] == true) return 'live';
  if (prov != null && prov['finished'] == true) return 'finished';
  final date = m?['date'] as String?;
  if (date != null) {
    final t = DateTime.tryParse(date)?.toLocal();
    if (t != null && !t.isAfter(now ?? DateTime.now())) return 'awaiting';
  }
  return 'notStarted';
}

/// Anlık 1/X/2 (resmi varsa resmi, yoksa geçici skordan).
String? pastResult(Map? m) {
  if (officialResolved(m)) return m!['result'] as String?;
  final prov = m?['provisional'] as Map?;
  if (prov != null) {
    final s = prov['score'] as Map?;
    final h = s?['home'];
    final a = s?['away'];
    if (h is num && a is num) return h > a ? '1' : (h < a ? '2' : 'X');
  }
  return null;
}

/// Türkçe binlik ayracı: 30578 → "30.578"
///
/// Kaynak `String(s).replace(/\B(?=(\d{3})+(?!\d))/g, '.')` kullanıyordu.
/// Dart'ta sıfır genişlikli genel değiştirme güvenilmez olduğu için aynı çıktı
/// elle üretilir; sonuç birebir aynıdır (negatif değerde de: -1234 → -1.234).
///
/// AD DEĞİŞTİ: kaynakta `group` idi. Dart'ta üst düzey `group` adı test
/// çatısının `group()` işleviyle çakışıyor ve testler DERLENMİYOR. İşlevin
/// kendisi birebir aynı; yalnız adı çarpışmayacak hale getirildi.
String binlikGrupla(String s) {
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0 && _rakam(s[i]) && _rakam(s[i - 1])) {
      buf.write('.');
    }
    buf.write(s[i]);
  }
  return buf.toString();
}

bool _rakam(String c) => c.codeUnitAt(0) >= 48 && c.codeUnitAt(0) <= 57;

/// 30578.23 → "₺30.578,23"
String fmtTL(num? n) {
  if (n == null) return '–';
  final parts = n.toStringAsFixed(2).split('.');
  return '₺${binlikGrupla(parts[0])},${parts[1]}';
}

/// RESMÎ yazım: tutar SONDA ₺ ile — "4.035.942,42 ₺".
/// (Uygulamanın ₺30.578,23 biçimi diğer görünümlerde korunur.)
String fmtTLResmi(num? n) {
  if (n == null) return '–';
  final parts = n.toStringAsFixed(2).split('.');
  return '${binlikGrupla(parts[0])},${parts[1]} ₺';
}

/// 412124 → "412.124"
String fmtCount(num? n) => n == null ? '–' : binlikGrupla(n.toString());

/// "2026" → "2025/2026 Sezonu" (resmî listedeki yazım).
String sezonAdi(Object? y) {
  final n = y is num ? y.toInt() : int.tryParse('$y');
  return n == null ? '${y ?? ''}' : '${n - 1}/$n Sezonu';
}

const List<String> _aylarTr = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/// Kaynaktaki `GUNLER_TR`, JS `getDay()` sırasıyla (0 = Pazar).
const List<String> _gunlerTr = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];

/// "24 Temmuz Cuma 2026 19:55" — resmî listedeki kapanış biçimi.
///
/// BOŞ DEĞER TUZAĞI: kaynakta `new Date(null)` 1970 döndürdüğü için önce
/// boşluk eleniyordu. Dart'ta `DateTime.tryParse` zaten null döner ama kural
/// aynen korundu — girdi boşsa null döner, tarih uydurulmaz.
String? kapanisResmi(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return null;
  String iki(int n) => n.toString().padLeft(2, '0');
  // Dart weekday: 1=Pazartesi … 7=Pazar → JS getDay: 0=Pazar … 6=Cumartesi
  final gun = _gunlerTr[d.weekday % 7];
  return '${iki(d.day)} ${_aylarTr[d.month - 1]} $gun '
      '${d.year} ${iki(d.hour)}:${iki(d.minute)}';
}

/// ERTELENMİŞ MAÇ TESPİTİ — ÇIKARIMDIR, resmî bir alan DEĞİLDİR.
///
/// KULLANICI KARARI (16 Ağustos 2026): 1. Haftanın 15. maçı (Celta Vigo –
/// Osasuna) ertelendi ve noter karar verecek. Kart yalnız "Başlamadı" diyordu;
/// kullanıcı ertelemenin görünmesini istedi.
///
/// NEDEN ÇIKARIM: resmî Spor Toto ucu bu maçı hâlâ `status: "upcoming"` olarak
/// veriyor — "ertelendi" diye bir alan YOK. Erteleme yalnız TARİHİN bültenin
/// geri kalanından kopmasıyla belli oluyor. Bu yüzden etiket, resmî veriyi
/// aktarmaz; ölçülen bir aykırılığı bildirir ve yanında YENİ TARİH de yazar
/// (kanıt ekranda kalır).
///
/// EŞİK ÖLÇÜMLE SEÇİLDİ (1. Hafta, gerçek veri): normal maçlar ilk maçtan
/// 0,0–3,0 gün sonra; ertelenen maç 13,0 gün sonra. 7 gün ikisinin ortasında
/// güvenle durur — Spor Toto haftası birkaç güne yayılır, 7 günü aşan bir
/// sapma normal takvimle açıklanamaz.
const int kErtelemeEsigiGun = 7;

/// [mac], aynı bültendeki diğer maçlardan belirgin biçimde sonraya alınmış mı?
///
/// Karşılaştırma bültenin İLK maçına göredir; böylece birden fazla maç
/// ertelenirse hepsi yakalanır (birbirlerine göre bakılsaydı ikisi de
/// "normal" görünürdü).
bool ertelendiMi(Map? mac, List? tumMaclar) {
  final t = macAni(mac?['date']);
  if (t == null) return false;
  DateTime? ilk;
  for (final m in (tumMaclar ?? const []).cast<Map>()) {
    final d = macAni(m['date']);
    if (d == null) continue;
    if (ilk == null || d.isBefore(ilk)) ilk = d;
  }
  if (ilk == null) return false;
  return t.difference(ilk).inDays >= kErtelemeEsigiGun;
}
