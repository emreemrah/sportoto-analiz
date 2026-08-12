// KAYNAK: app/src/liveEvents.js — BİREBİR çeviri.
//
// CANLI OLAY ŞERİDİ + BASKI GÖSTERGESİ — saf mantık (çizim bağımlılığı YOK).
//
// DÜRÜSTLÜK KURALLARI
//   • Buradaki her sayı, backend'den gelen GERÇEK API-Football olay/istatistik
//     verisinden türetilir. Veri yoksa null döner — uydurma dakika, uydurma
//     baskı yüzdesi ASLA üretilmez.
//   • Baskı göstergesi bir TAHMİN DEĞİLDİR; yalnız o an mevcut istatistiklerin
//     (şut, korner, topla oynama...) ikili payıdır. Sonuç iddiası içermez.
//   • Zaman çizelgesi yalnız GÖRSELDİR; resmi sonuç yalnız Spor Toto'dan gelir.

import 'dart:math' as math;

const int kRegMinutes = 90; // normal süre
const int kHalfMinutes = 45; // devre arası çizgisi

const Map<String, String> _kindByType = {
  'goal': 'goal',
  'card': 'card',
  'subst': 'sub',
  'var': 'var',
};

typedef LiveEvent = ({
  int minute,
  int extra,
  String kind,
  String detail,
  String? side,
  bool penalty,
  bool ownGoal,
  Object? player,
  Object? assist,
  int at,
});

double? _sayi(Object? v) {
  if (v is num) return v.isFinite ? v.toDouble() : null;
  final n = double.tryParse('$v');
  return (n != null && n.isFinite) ? n : null;
}

/// Tek olayı normalize et. Tanınmayan/dakikasız olay ATILIR (uydurma yok).
LiveEvent? normalizeEvent(Object? e) {
  if (e is! Map) return null;
  final m = _sayi(e['minute']);
  if (m == null) return null;
  final minute = m.toInt();
  final extra = (_sayi(e['extra']) ?? 0).toInt();
  final type = '${e['type'] ?? ''}'.toLowerCase();
  final detail = '${e['detail'] ?? ''}';
  final dl = detail.toLowerCase();
  var kind = _kindByType[type];
  if (kind == null) return null;
  if (kind == 'card') kind = dl.contains('red') ? 'red' : 'yellow';
  // İptal edilen gol (VAR) gol sayılmaz — resmi skorla çelişmemeli.
  if (kind == 'goal' &&
      (dl.contains('cancelled') || dl.contains('disallowed'))) {
    return null;
  }
  final side = (e['side'] == 'home' || e['side'] == 'away')
      ? e['side'] as String
      : null;
  return (
    minute: minute,
    extra: extra,
    kind: kind,
    detail: detail,
    side: side,
    penalty: kind == 'goal' && dl.contains('penalty'),
    ownGoal: kind == 'goal' && dl.contains('own'),
    player: e['player'],
    assist: e['assist'],
    at: minute + extra, // sıralama anahtarı
  );
}

/// Olay listesini normalize + dakikaya göre sırala.
List<LiveEvent> normalizeEvents(List? events) {
  final out = <LiveEvent>[];
  for (final e in events ?? const []) {
    final n = normalizeEvent(e);
    if (n != null) out.add(n);
  }
  out.sort((a, b) => a.at.compareTo(b.at));
  return out;
}

/// Şeritte GÖSTERİLECEK olaylar: gol + kırmızı kart (şeridi kalabalıklaştıran
/// sarı kart/değişiklik listede kalır, şeritte gösterilmez).
const Set<String> _stripKinds = {'goal', 'red'};

/// Dakikayı 0..1 aralığına oturt. Uzatma dakikaları (90+) sona sıkıştırılır.
double positionOf(
  Object? minute, [
  int extra = 0,
  int maxMinute = kRegMinutes,
]) {
  final m = math.max(0.0, _sayi(minute) ?? 0);
  final cap = math.max(kRegMinutes, maxMinute).toDouble();
  final raw = extra > 0 ? math.min(m + extra, cap) : math.min(m, cap);
  return math.max(0.0, math.min(1.0, raw / cap));
}

typedef TimelineMarker = ({LiveEvent e, double pos, int slot});

/// Şerit için işaretçiler. Aynı dakikadaki iki olay üst üste binmesin diye
/// hafif kaydırma bilgisi (slot) verilir.
List<TimelineMarker> timelineMarkers(
  List? events, {
  int maxMinute = kRegMinutes,
}) {
  final evs = normalizeEvents(
    events,
  ).where((e) => _stripKinds.contains(e.kind)).toList();
  if (evs.isEmpty) return const [];
  var cap = math.max(kRegMinutes, maxMinute);
  for (final e in evs) {
    cap = math.max(cap, e.at);
  }
  final seen = <String, int>{};
  return [
    for (final e in evs)
      () {
        // ~3 dk'lık kova
        final key = '${e.side ?? '?'}:${(e.at / 3).round()}';
        final slot = seen[key] ?? 0;
        seen[key] = slot + 1;
        return (e: e, pos: positionOf(e.minute, e.extra, cap), slot: slot);
      }(),
  ];
}

typedef GoalStep = ({
  int minute,
  int extra,
  String side,
  int home,
  int away,
  Object? player,
  bool penalty,
  bool ownGoal,
});

/// Gol zaman çizelgesi: her golden sonraki KOŞAN SKOR. Kendi kalesine goller
/// karşı takıma yazılır (API 'Own Goal' detayını verdiğinde).
List<GoalStep> goalProgression(List? events) {
  final out = <GoalStep>[];
  var h = 0, a = 0;
  for (final e in normalizeEvents(events)) {
    if (e.kind != 'goal' || e.side == null) continue;
    final scoring = e.ownGoal ? (e.side == 'home' ? 'away' : 'home') : e.side!;
    if (scoring == 'home') {
      h += 1;
    } else {
      a += 1;
    }
    out.add((
      minute: e.minute,
      extra: e.extra,
      side: scoring,
      home: h,
      away: a,
      player: e.player,
      penalty: e.penalty,
      ownGoal: e.ownGoal,
    ));
  }
  return out;
}

// —————————————————————————————————————————————————————————————
// BASKI GÖSTERGESİ
// Yalnız aşağıdaki gerçek istatistikler kullanılır. En az 2 tanesi yoksa
// gösterge HİÇ üretilmez (null) — yarım veriyle "baskı" iddia edilmez.

const List<({String type, String label, double weight})> kPressureStats = [
  (type: 'Total Shots', label: 'Şut', weight: 1),
  (type: 'Shots on Goal', label: 'İsabetli şut', weight: 1.5),
  (type: 'Corner Kicks', label: 'Korner', weight: 0.75),
  (type: 'Ball Possession', label: 'Topla oynama', weight: 0.75),
  (type: 'Dangerous Attacks', label: 'Tehlikeli atak', weight: 1.25),
];

/// `parseFloat(String(v).replace('%','').trim())` karşılığı — yüzde işareti
/// atılır, sayıya çevrilemeyen değer null döner (sıfır sayılmaz).
double? sayiVeyaNull(Object? v) {
  if (v == null) return null;
  final s = '$v'.replaceAll('%', '').trim();
  if (s.isEmpty) return null;
  // JS parseFloat baştaki sayıyı okur ("12 (3)" → 12); Dart'ta karşılığı
  // baştaki sayısal önekin ayrıştırılmasıdır.
  final m = RegExp(r'^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?').firstMatch(s);
  if (m == null) return null;
  final n = double.tryParse(m.group(0)!);
  return (n != null && n.isFinite) ? n : null;
}

typedef PressureRow = ({
  String label,
  double weight,
  double home,
  double away,
  double share,
});

typedef Pressure = ({
  int home,
  int away,
  List<String> basis,
  List<PressureRow> rows,
});

Pressure? pressureIndex(List? stats) {
  final rows = <PressureRow>[];
  for (final def in kPressureStats) {
    final row = (stats ?? const []).cast<Map?>().firstWhere(
      (s) => s != null && s['type'] == def.type,
      orElse: () => null,
    );
    if (row == null) continue;
    final h = sayiVeyaNull(row['home']);
    final a = sayiVeyaNull(row['away']);
    if (h == null || a == null) continue;
    if (h + a <= 0) continue; // 0-0 veri taşımaz
    rows.add((
      label: def.label,
      weight: def.weight,
      home: h,
      away: a,
      share: h / (h + a),
    ));
  }
  if (rows.length < 2) return null; // yetersiz veri → gösterge yok
  final wsum = rows.fold<double>(0, (t, r) => t + r.weight);
  final homeShare =
      rows.fold<double>(0, (t, r) => t + r.share * r.weight) / wsum;
  final home = (homeShare * 100).round();
  return (
    home: home,
    away: 100 - home,
    basis: [for (final r in rows) r.label],
    rows: rows,
  );
}

/// İSTATİSTİK ÖNCELİĞİ — yayında ilk bakışta görülmesi gerekenler üstte.
const List<String> _statOrder = [
  'Ball Possession',
  'Total Shots',
  'Shots on Goal',
  'expected_goals',
  'Corner Kicks',
  'Dangerous Attacks',
  'Fouls',
  'Yellow Cards',
  'Red Cards',
  'Goalkeeper Saves',
  'Offsides',
  'Passes %',
];

List<Map> sortStats(List? stats) {
  int idx(Object? t) {
    final i = _statOrder.indexOf('$t');
    return i == -1 ? _statOrder.length : i;
  }

  final out = (stats ?? const []).cast<Map>().toList();
  // JS `Array.prototype.sort` kararlıdır; Dart'ın `sort`u değil — listede
  // öncelik dışı istatistiklerin geliş sırası korunsun diye kararlı sıralama.
  final indeksli = [for (var i = 0; i < out.length; i++) (i: i, m: out[i])]
    ..sort((a, b) {
      final c = idx(a.m['type']).compareTo(idx(b.m['type']));
      return c != 0 ? c : a.i.compareTo(b.i);
    });
  return [for (final x in indeksli) x.m];
}
