// KAYNAK: app/src/weekSummary.js — BİREBİR çeviri.
//
// HAFTANIN ÖZETİ — yayın açılış kartının SEÇİM MANTIĞI (saf modül).
//
// DÜRÜSTLÜK KURALLARI
//   • Yalnız bültendeki GERÇEK analiz verisi kullanılır; aday uydurulmaz.
//   • Başlamış maç "aday" olarak gösterilmez (sonucu belli olmaya başlamıştır).
//   • Güçlü aday yoksa liste BOŞ döner — zorla doldurulmaz; ekran bunu dürüstçe
//     söyler. Etiket dili displayLabel sözlüğünden geçer (asla "banko" yazılmaz).

// Veri anahtarı 'BANKO' → kullanıcıya GÜÇLÜ ADAY olarak gösterilir (labels).
const String _strongKey = 'BANKO';
const String _surpriseKey = 'SÜRPRİZE AÇIK';

bool _startedNow(Map? m, int now) {
  if (m?['started'] == true) return true;
  final iso = m?['date'];
  if (iso == null) return false;
  final t = DateTime.tryParse('$iso');
  if (t == null) return false;
  return t.millisecondsSinceEpoch <= now;
}

/// Bir maçın EN YÜKSEK ihtimali (0-100) — yoksa null.
///
/// Neden ayrı bir dışa aktarım: "denk güç" eşiği (%45) bu dosyada TEK yerde
/// durmalı. Yayın modu gibi başka ekranlar aynı hesabı kendi içinde tekrar
/// yazarsa iki farklı sayı doğar; yinelenen istatistik yasağı bunu yasaklar.
num? topProbability(Map? m) {
  final p = (m?['analysis'] as Map?)?['probabilities'];
  if (p is! Map) return null;
  final vals = <num>[
    for (final v in p.values)
      if (v is num && v.isFinite)
        v
      else if (v != null && num.tryParse('$v') != null)
        num.parse('$v'),
  ];
  // tek değerle "denk mi" denemez
  if (vals.length < 2) return null;
  return vals.reduce((a, b) => a > b ? a : b);
}

/// Denk güç eşiği: en yüksek ihtimal bunun altındaysa net bir taraf yoktur.
const num kBalancedMaxPercent = 45;

typedef WeekSummary = ({
  List<Map> strong,
  List<Map> surprises,
  int balanced,
  List<Map> balancedMatches,
  int startedCount,
  int total,
});

/// Bülten maçlarından açılış kartı verisi üretir.
WeekSummary buildWeekSummary(
  List? matches, {
  int strongMax = 3,
  int surpriseMax = 3,
  int? now,
}) {
  final simdi = now ?? DateTime.now().millisecondsSinceEpoch;

  final ms = <Map>[
    for (final m in matches ?? const [])
      if (m is Map && m['analysis'] != null) m,
  ];
  final open = ms.where((m) => !_startedNow(m, simdi)).toList();

  final strong = open.where((m) {
    final a = m['analysis'] as Map;
    final fav = a['favorite'];
    return a['label'] == _strongKey && fav is Map && fav['percent'] != null;
  }).toList()
    ..sort((a, b) => _yuzde(b).compareTo(_yuzde(a)));

  final surprises = open.where((m) {
    final a = m['analysis'] as Map;
    return a['label'] == _surpriseKey && a['surpriseScore'] != null;
  }).toList()
    ..sort((a, b) => _surpriz(b).compareTo(_surpriz(a)));

  // Denk güç: ihtimallerin en yükseği eşiğin altındaysa net bir taraf yok
  // demektir. Sayı ve listenin AYNI süzgeçten doğması şart; ikisi ayrılırsa
  // ekranda "3 denk maç" yazıp 2 satır göstermek gibi tutarsızlık çıkar.
  final balancedMatches = open.where((m) {
    final t = topProbability(m);
    return t != null && t < kBalancedMaxPercent;
  }).toList();

  return (
    strong: strong.take(strongMax).toList(),
    surprises: surprises.take(surpriseMax).toList(),
    balanced: balancedMatches.length,
    balancedMatches: balancedMatches,
    startedCount: ms.length - open.length,
    total: ms.length,
  );
}

num _yuzde(Map m) {
  final v = ((m['analysis'] as Map)['favorite'] as Map)['percent'];
  return v is num ? v : 0;
}

num _surpriz(Map m) {
  final v = (m['analysis'] as Map)['surpriseScore'];
  return v is num ? v : 0;
}

/// Tek takımın görünecek adı. Uzundan kısaya düşer; hiçbiri yoksa '?' —
/// boş bırakmak yerine eksikliği GÖSTERİR.
String takimAdi(Object? t) {
  if (t is! Map) return '?';
  for (final k in ['mediumName', 'shortName', 'name']) {
    final v = t[k];
    if (v != null && '$v'.isNotEmpty) return '$v';
  }
  return '?';
}

/// Görselde kullanılacak kısa takım metni: "Ev - Deplasman".
String matchLine(Map? m) => '${takimAdi(m?['home'])} - ${takimAdi(m?['away'])}';
