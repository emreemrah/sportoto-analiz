// KAYNAK: app/src/components/TakimFiksturModal.js — saf kısımlar.
//
// TAKIM FİKSTÜRÜ — oynadığı ve oynayacağı maçların listesi. Ekran çizimi
// features/match_detail/takim_fikstur_modal.dart içinde; buradaki işlevler
// ekransız sınanabilsin diye ayrıldı.
//
// KORUNAN KURALLAR
//   • Tarih yoksa uydurma tarih basılmaz, "—" yazılır.
//   • Sonuç harfi (G/B/M) yalnız BİTMİŞ maçta olur; sunucu da aynı kuralı
//     uygular (backend/src/takimFikstur.js).
//   • Turnuva adı satırlara YALNIZ birden fazla turnuva varsa yazılır.

/// Kaynaktaki `AY` dizisi — kısa Türkçe ay adları.
const List<String> kAylarKisa = [
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

/// Unix saniyesini "27 Tem" biçimine çevirir. Yoksa/geçersizse "—".
///
/// Kaynakta `new Date(dateUnix * 1000)` yerel saat diliminde okunuyordu;
/// burada da yerel saat kullanılır (`isUtc: false`) — aksi hâlde gece yarısına
/// yakın maçlar bir gün kayardı.
String tarihEtiketi(Object? dateUnix) {
  // JS'te `!dateUnix` — 0 da yok sayılır (1970 başı gerçek bir maç tarihi
  // değil, veri yokluğunun kodlanmış hâlidir).
  final n = dateUnix is num
      ? dateUnix.toDouble()
      : double.tryParse('$dateUnix') ?? 0;
  if (n == 0 || n.isNaN || n.isInfinite) return '—';
  final ms = n * 1000;
  // JS `Number.isNaN(d.getTime())` karşılığı: taşan değerde DateTime kurulamaz.
  if (ms.abs() > 8640000000000000) return '—';
  final d = DateTime.fromMillisecondsSinceEpoch(ms.round());
  return '${d.day} ${kAylarKisa[d.month - 1]}';
}

/// "SIRADAKİ" ayracının konumu: ilk oynanmamış maçın sırası.
/// Hiç yoksa (sezon bitti) -1 döner ve ayraç çizilmez.
int ilkGelecekIndex(List fikstur) =>
    fikstur.indexWhere((f) => (f as Map)['oynandi'] != true);

/// Listede geçen turnuva adları — sırası korunur, yinelenen atılır.
List<String> fiksturLigleri(List fikstur) {
  final gorulen = <String>{};
  final out = <String>[];
  for (final f in fikstur) {
    final l = (f as Map)['lig'];
    // JS `.filter(Boolean)` — boş dizge de elenir.
    if (l == null || '$l'.isEmpty) continue;
    if (gorulen.add('$l')) out.add('$l');
  }
  return out;
}

/// Bir fikstür satırının skor metni. Oynanmamış maçta null — çağıran nötr
/// ayracı ("v") basar. UYDURMA SKOR YOK.
String? fiksturSkoru(Map f) {
  if (f['oynandi'] != true) return null;
  final s = f['score'] as Map?;
  if (s == null) return null;
  return '${s['home']} - ${s['away']}';
}
