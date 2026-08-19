// ERTELENMİŞ MAÇ TESPİTİ — ÇIKARIMDIR, resmî bir alan DEĞİLDİR.
//
// TAŞINMA (2026-08-19): bu tanım `features/bulletin/bulletin_format.dart`
// içindeydi. Ertelenen maç bildirimi (`core/notifications.dart`) de aynı
// kurala muhtaç olunca core'a alındı — core, features'a bakamaz. TEK TANIM
// KURALI KORUNUR: bulletin_format bu dosyayı yeniden dışa aktarır; ikinci
// bir kopya YOKTUR. Backend'in yönetim paneli tarafındaki eşi
// `backend/src/ertelenen.js` — eşik değişirse İKİSİ BİRDEN değişmeli.
//
// KULLANICI KARARI (16 Ağustos 2026): 1. Haftanın 15. maçı (Celta Vigo –
// Osasuna) ertelendi ve noter karar verecek. Kart yalnız "Başlamadı" diyordu;
// kullanıcı ertelemenin görünmesini istedi.
//
// NEDEN ÇIKARIM: resmî Spor Toto ucu bu maçı hâlâ `status: "upcoming"` olarak
// veriyor — "ertelendi" diye bir alan YOK. Erteleme yalnız TARİHİN bültenin
// geri kalanından kopmasıyla belli oluyor. Bu yüzden etiket, resmî veriyi
// aktarmaz; ölçülen bir aykırılığı bildirir ve yanında YENİ TARİH de yazar
// (kanıt ekranda kalır).

import 'utils.dart';

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

/// Resmî sonucu OLMAYAN ve ertelenmiş görünen maçların sıra numaraları —
/// haftanın kesinleşmesini bekleten NEDEN. [cozulduMu] ekranın resmî-sonuç
/// kuralıdır (officialResolved eşdeğeri; noter kararı çözülmüş sayılır, o
/// yüzden karar girilmiş maç burada bir daha "bekliyor" görünmez).
List<int> bekleyenErtelenenNolar(List? maclar, bool Function(Map?) cozulduMu) {
  final ms = (maclar ?? const []).cast<Map?>();
  return [
    for (final m in ms)
      if (m != null && !cozulduMu(m) && ertelendiMi(m, maclar))
        ?int.tryParse('${m['no']}'),
  ];
}

/// Hafta durum satırına eklenecek SEBEP eki (boş liste → boş dizge).
///
/// TEK TANIM: Bülten ekranı alt başlığı ile Haftalık Başarı durum satırı bu
/// metni buradan alır — iki ekran aynı durumu farklı anlatamaz (19 Ağustos
/// 2026 kullanıcı tıkanması: "hafta neden hâlâ kesinleşmedi" sorusu ekranda
/// cevapsızdı).
String ertelemeDurumEki(List<int> nolar) {
  if (nolar.isEmpty) return '';
  final kim = nolar.length == 1 ? '${nolar.first}. maç' : '${nolar.length} maç';
  return ' · $kim ertelendi — noter kararı bekleniyor';
}
