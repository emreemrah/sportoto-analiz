// KAYNAK: app/src/compareRadar.js — BİREBİR çeviri.
//
// TAKIM GÜÇ KARŞILAŞTIRMASI — radar grafiği EKSEN MANTIĞI (saf modül).
//
// DÜRÜSTLÜK KURALLARI
//   • Yalnız iki takımın da GERÇEK verisi olan eksenler çizilir; eksik eksen
//     uydurulmaz, atlanır. 3'ten az eksen kalırsa grafik HİÇ çizilmez.
//   • Normalizasyon iki takımın KENDİ aralığında yapılır (büyük olan 100 alır);
//     mutlak bir "güç puanı" iddiası yoktur — görsel kıyas aracıdır.

import 'dart:math' as math;

double? _last5Points(Object? form) {
  if (form is! List || form.isEmpty) return null;
  const p = {'G': 3, 'B': 1, 'M': 0};
  // Tanınmayan harf ATLANIR (kaynakta `.filter(x => x != null)`).
  final vals = <int>[for (final r in form) ?p['$r']];
  if (vals.isEmpty) return null;
  return vals.reduce((a, b) => a + b) / vals.length;
}

double? _num(Object? x) {
  if (x is num) return x.isFinite ? x.toDouble() : null;
  final n = double.tryParse('$x');
  return (n != null && n.isFinite) ? n : null;
}

typedef CompareAxisDef = ({
  String key,
  String label,
  bool higherBetter,
  double? Function(Map? s) value,
});

/// Eksen tanımları: [value] gerçek değeri döndürür; [higherBetter] false ise
/// düşük değer iyidir (ör. yenilen gol) ve normalizasyonda ters çevrilir.
final List<CompareAxisDef> kCompareAxes = [
  (
    key: 'ppg',
    label: 'Puan/Maç',
    higherBetter: true,
    value: (s) => _num((s?['standing'] as Map?)?['ppg']),
  ),
  (
    key: 'attack',
    label: 'Gol/Maç',
    higherBetter: true,
    value: (s) => _num((s?['season'] as Map?)?['goalsPerGame']),
  ),
  (
    key: 'defense',
    label: 'Savunma',
    higherBetter: false,
    value: (s) => _num((s?['season'] as Map?)?['concededPerGame']),
  ),
  (
    key: 'xg',
    label: 'xG',
    higherBetter: true,
    value: (s) => _num((s?['season'] as Map?)?['xgFor']),
  ),
  (
    key: 'clean',
    label: 'Temiz Kale',
    higherBetter: true,
    value: (s) => _num((s?['season'] as Map?)?['cleanSheetPct']),
  ),
  (
    key: 'form',
    label: 'Form',
    higherBetter: true,
    value: (s) => _last5Points(s?['last5']),
  ),
];

/// 0-100 kıyas değeri: büyük olan 100 alır; düşük-iyi eksende önce tersine
/// çevrilir.
(int, int) _pairScore(double a, double b, bool higherBetter) {
  var va = a, vb = b;
  if (!higherBetter) {
    // Düşük değer iyi: tersine çevir (0'a bölme koruması ile).
    const eps = 0.05;
    va = 1 / math.max(a, eps);
    vb = 1 / math.max(b, eps);
  }
  final mx = math.max(va, vb);
  // ikisi de sıfır → eşit
  if (mx <= 0) return (50, 50);
  return ((va / mx * 100).round(), (vb / mx * 100).round());
}

typedef CompareAxis = ({
  String key,
  String label,
  int home,
  int away,
  double rawHome,
  double rawAway,
});

/// İki takımın istatistiklerinden çizilebilir eksen listesi üretir.
/// 3'ten azsa boş liste döner (çizilmez).
List<CompareAxis> buildCompareAxes(Map? homeStats, Map? awayStats) {
  final axes = <CompareAxis>[];
  for (final ax in kCompareAxes) {
    final h = ax.value(homeStats);
    final a = ax.value(awayStats);
    // eksik veri → eksen atlanır
    if (h == null || a == null) continue;
    final (hs, as_) = _pairScore(h, a, ax.higherBetter);
    axes.add((
      key: ax.key,
      label: ax.label,
      home: hs,
      away: as_,
      rawHome: h,
      rawAway: a,
    ));
  }
  return axes.length >= 3 ? axes : const [];
}

/// Çokgen noktaları: merkez (cx,cy), yarıçap r, değerler 0-100.
///
/// Kaynakta SVG `points` dizgesi üretiliyordu; Flutter'da tuvale çizileceği
/// için nokta listesi döner. Açı ve yarıçap hesabı BİREBİR aynı.
List<({double x, double y})> polygonPoints(
  List<num> values,
  double cx,
  double cy,
  double r,
) {
  final n = values.length;
  return [
    for (var i = 0; i < n; i++)
      () {
        final ang = (-90 + (i * 360) / n) * (math.pi / 180);
        final rr = (values[i].clamp(0, 100) / 100) * r;
        return (x: cx + rr * math.cos(ang), y: cy + rr * math.sin(ang));
      }(),
  ];
}
