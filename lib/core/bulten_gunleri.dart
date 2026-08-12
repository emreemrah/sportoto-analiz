// BÜLTEN GÜN ŞERİDİ — SAF MODÜL (kullanıcı isteği, 2026-08-11)
//
// "Tarihler sabit olarak yazılmasın; güncel bültendeki 15 maçın gerçek tarih
// ve saatlerinden otomatik oluşturulsun. Yalnızca maç bulunan günler
// gösterilsin."
//
// Bu dosya çizim yapmaz, yalnız bülten kayıtlarından gün listesini türetir —
// böylece düz Dart testinde saatten bağımsız doğrulanabilir ("şimdi" dışarıdan
// verilir).
//
// KURALLAR:
//  • Tarihi olmayan maç gün üretmez ve hiçbir güne sayılmaz — uydurma gün yok.
//  • Yalnız gerçekten maç olan günler döner; boş gün çizilmez.
//  • Günler tarihe göre artan sırada.
//  • Gün anahtarı YEREL tarihtir: maç saati UTC gelse de kullanıcı kendi
//    gününde görür (23:00 TSİ maçı "ertesi gün" görünmemeli).

/// Türkçe kısa gün adları; `DateTime.weekday` 1 (Pazartesi) … 7 (Pazar).
const List<String> kKisaGunAdlari = [
  'Pzt',
  'Sal',
  'Çar',
  'Per',
  'Cum',
  'Cmt',
  'Paz',
];

/// Şeritteki bir gün.
class BultenGunu {
  const BultenGunu({
    required this.tarih,
    required this.gunAdi,
    required this.kisaTarih,
    required this.macSayisi,
    required this.bugun,
  });

  /// Filtre anahtarı: yerel takvim günü, 'yyyy-aa-gg'.
  final String tarih;

  /// 'Bugün' ya da kısa gün adı ('Cmt').
  final String gunAdi;

  /// '09.08'
  final String kisaTarih;

  final int macSayisi;
  final bool bugun;
}

String _iki(int n) => n.toString().padLeft(2, '0');

/// Yerel takvim gününün anahtarı.
String gunAnahtari(DateTime d) {
  final y = d.toLocal();
  return '${y.year}-${_iki(y.month)}-${_iki(y.day)}';
}

/// Maçın gün anahtarı; tarihi yoksa null (uydurulmaz).
String? macGunu(Map? m) {
  final ham = m?['date'];
  if (ham == null) return null;
  final d = DateTime.tryParse('$ham');
  return d == null ? null : gunAnahtari(d);
}

/// Bültendeki maçlardan gün şeridini üretir.
///
/// [simdi] verilmezse gerçek saat kullanılır; testler sabit bir an geçer.
List<BultenGunu> bultenGunleri(List? matches, {DateTime? simdi}) {
  final an = (simdi ?? DateTime.now()).toLocal();
  final bugunAnahtar = gunAnahtari(an);

  final sayac = <String, int>{};
  final ornek = <String, DateTime>{};
  for (final m in (matches ?? const []).cast<Map>()) {
    final d = DateTime.tryParse('${m['date']}')?.toLocal();
    if (d == null) continue; // tarihi olmayan maç güne sayılmaz
    final k = gunAnahtari(d);
    sayac[k] = (sayac[k] ?? 0) + 1;
    ornek.putIfAbsent(k, () => d);
  }

  final anahtarlar = sayac.keys.toList()..sort();
  return [
    for (final k in anahtarlar)
      BultenGunu(
        tarih: k,
        gunAdi: k == bugunAnahtar
            ? 'Bugün'
            : kKisaGunAdlari[ornek[k]!.weekday - 1],
        kisaTarih: '${_iki(ornek[k]!.day)}.${_iki(ornek[k]!.month)}',
        macSayisi: sayac[k]!,
        bugun: k == bugunAnahtar,
      ),
  ];
}

/// Seçili güne göre süzer. [tarih] null ise liste OLDUĞU GİBİ döner
/// (süzgeç kapalı = bütün bülten).
List filtreleGune(List? matches, String? tarih) {
  final hepsi = (matches ?? const []).toList();
  if (tarih == null || tarih.isEmpty) return hepsi;
  return [
    for (final m in hepsi.cast<Map>())
      if (macGunu(m) == tarih) m,
  ];
}

/// Şeridin açılışta seçeceği gün: bugün maç varsa bugün, yoksa BUGÜNDEN
/// SONRAKİ ilk maç günü, o da yoksa son gün.
///
/// Gerekçe: kullanıcı bülteni açtığında en yakın oynanacak günü görmek ister;
/// hafta bittiyse en son oynanan gün gösterilir (boş liste değil).
String? varsayilanGunSecimi(List<BultenGunu> gunler, {DateTime? simdi}) {
  if (gunler.isEmpty) return null;
  for (final g in gunler) {
    if (g.bugun) return g.tarih;
  }
  final bugunAnahtar = gunAnahtari(simdi ?? DateTime.now());
  for (final g in gunler) {
    if (g.tarih.compareTo(bugunAnahtar) > 0) return g.tarih;
  }
  return gunler.last.tarih;
}
