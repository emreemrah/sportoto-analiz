// KAYNAK: app/src/analysis/criteria.js — `logRowsApp`, `logAggApp`,
// `statsFromLog`, `derivedStats`. BİREBİR çeviri.
//
// İSTATİSTİK sekmesinin FİLTRELİ KARNE görünümü: takımın maç logundan seçilen
// kesite (dönem/saha) göre GERÇEK istatistikler. Log yoksa null döner ve ekran
// resmî sezon karnesine dürüstçe geri düşer — uydurma hesap YAPILMAZ.
//
// Saf modül: Flutter'a bağlı değil, testten doğrudan çağrılır.

/// İstatistik sekmesi filtresi. Kaynakta `{ period, venueScope }`.
class StatFiltre {
  const StatFiltre({
    this.period = 'season',
    this.venueScope = 'overall',
    this.opponentStrength,
  });

  /// 'season' | 'last5' | 'last10' | 'last15'
  final String period;

  /// 'overall' | 'home' | 'away' | 'split'
  final String venueScope;

  /// Rakip gücü filtresi panelden kaldırıldı (kullanıcı kararı); alan
  /// korunuyor çünkü aynı saf mantık analiz/radar tarafında da kullanılıyor.
  final String? opponentStrength;

  StatFiltre copyWith({String? period, String? venueScope}) => StatFiltre(
    period: period ?? this.period,
    venueScope: venueScope ?? this.venueScope,
    opponentStrength: opponentStrength,
  );
}

const Map<String, int> _periodSlice = {'last5': 5, 'last10': 10, 'last15': 15};

List<Map>? _logRowsApp(Map? team, StatFiltre f, String? venue) {
  final ham = team?['matchLog'];
  if (ham is! List) return null;
  var rows = ham.cast<Map>().toList();

  final cut = _periodSlice[f.period];
  // Son 5/10/15 maçın İÇİNDEN filtrelenir.
  if (cut != null && rows.length > cut) rows = rows.sublist(0, cut);

  if (venue == 'home') {
    rows = rows.where((x) => x['isHome'] == true).toList();
  } else if (venue == 'away') {
    rows = rows.where((x) => x['isHome'] != true).toList();
  }

  final tier = f.opponentStrength;
  if (tier != null && tier != 'all') {
    rows = rows.where((x) => x['oppTier'] == tier).toList();
  }
  return rows;
}

typedef _Agg = ({
  int n,
  int w,
  int d,
  int l,
  int gf,
  int ga,
  int pts,
  int over,
  int btts,
  int cs,
  int fts,
});

_Agg _logAggApp(List<Map> rows) {
  var w = 0, d = 0, l = 0, gf = 0, ga = 0, pts = 0;
  var over = 0, btts = 0, cs = 0, fts = 0;

  int say(Object? v) => v is num ? v.toInt() : 0;

  for (final x in rows) {
    if (x['result'] == 'G') {
      w++;
      pts += 3;
    } else if (x['result'] == 'B') {
      d++;
      pts += 1;
    } else {
      l++;
    }
    final xgf = say(x['gf']);
    final xga = say(x['ga']);
    gf += xgf;
    ga += xga;
    if (xgf + xga >= 3) over++;
    if (xgf > 0 && xga > 0) btts++;
    if (xga == 0) cs++;
    if (xgf == 0) fts++;
  }

  return (
    n: rows.length,
    w: w,
    d: d,
    l: l,
    gf: gf,
    ga: ga,
    pts: pts,
    over: over,
    btts: btts,
    cs: cs,
    fts: fts,
  );
}

/// `statsFromLog` sonucu. `n == 0` ise yalnız sayı doludur (kaynakta da öyle).
class LogStats {
  const LogStats({
    required this.n,
    this.w = 0,
    this.d = 0,
    this.l = 0,
    this.gfPg,
    this.gaPg,
    this.ppg,
    this.csPct,
    this.bttsPct,
    this.overPct,
    this.ftsPct,
  });

  final int n;
  final int w;
  final int d;
  final int l;
  final double? gfPg;
  final double? gaPg;
  final double? ppg;
  final int? csPct;
  final int? bttsPct;
  final int? overPct;
  final int? ftsPct;
}

/// [side] 'home' | 'away'
///
/// Saha: 'split' → ev takımı içeride / deplasman dışarıda; 'home'/'away' → iki
/// takım için de aynı saha kesiti; 'overall' → tümü.
LogStats? statsFromLog(Map? team, StatFiltre f, String side) {
  final venue = f.venueScope == 'split'
      ? side
      : (f.venueScope == 'home' || f.venueScope == 'away')
      ? f.venueScope
      : null;

  final rows = _logRowsApp(team, f, venue);
  if (rows == null) return null;

  final v = _logAggApp(rows);
  if (v.n == 0) return const LogStats(n: 0);

  double r1x(double x) => (x * 100).round() / 100;
  int pc(int x) => ((x / v.n) * 100).round();

  return LogStats(
    n: v.n,
    w: v.w,
    d: v.d,
    l: v.l,
    gfPg: r1x(v.gf / v.n),
    gaPg: r1x(v.ga / v.n),
    ppg: r1x(v.pts / v.n),
    csPct: pc(v.cs),
    bttsPct: pc(v.btts),
    overPct: pc(v.over),
    ftsPct: pc(v.fts),
  );
}

/// ÜRETİLMİŞ GÖSTERGELER — ham kaynak istatistiklerinden ŞEFFAF formüllerle
/// türetilir; hiçbiri ham verinin kopyası değildir. Veri yoksa ilgili alan
/// null döner — uydurma hesap yapılmaz:
///   finishing     = Gol ÷ xG              (1 üstü: beklenenden verimli hücum)
///   defEff        = Yediği ÷ xG Karşı     (1 altı: beklenenden sağlam savunma)
///   shotAcc       = İsabetli ÷ Toplam şut (%)
///   goalsPerShot  = Gol ÷ Toplam şut
///   momentum      = son 5 ppg − sezon(log) ppg   (log ≥ 6 maç ister)
///   venueGap      = içerideki ppg − dışarıdaki ppg (her sahada ≥ 3 maç ister)
///   weightedLast5 = son 5 puanı × rakip katsayısı (güçlü 1.5 · denk 1 ·
///                   zayıf 0.5; sınıfı bilinen ≥ 3 maç ister)
///   *Run seriler  = maç anına kadar kesintisiz sayım
class DerivedStats {
  const DerivedStats({
    this.finishing,
    this.defEff,
    this.shotAcc,
    this.goalsPerShot,
    this.momentum,
    this.venueGap,
    this.weightedLast5,
    this.unbeatenRun,
    this.winRun,
    this.scoringRun,
    this.csRun,
    this.bttsRun,
  });

  final double? finishing;
  final double? defEff;
  final int? shotAcc;
  final double? goalsPerShot;
  final double? momentum;
  final double? venueGap;
  final double? weightedLast5;
  final int? unbeatenRun;
  final int? winRun;
  final int? scoringRun;
  final int? csRun;
  final int? bttsRun;
}

DerivedStats derivedStats(Map? team) {
  final se = team?['season'] as Map?;
  double r2(double x) => (x * 100).round() / 100;
  double? pozitif(Object? v) => (v is num && v > 0) ? v.toDouble() : null;

  final gf = pozitif(se?['goalsPerGame']);
  final xg = pozitif(se?['xgFor']);
  final ga = pozitif(se?['concededPerGame']);
  final xga = pozitif(se?['xgAgainst']);
  final avg = se?['avg'] as Map?;
  final sh = pozitif(avg?['shots']);
  final sot = pozitif(avg?['shotsOnTarget']);

  // xG/şut tabanlı (kaynak sezon ort.; 0/boş = veri yok → null, sıfır
  // uydurulmaz)
  final finishing = (gf != null && xg != null) ? r2(gf / xg) : null;
  final defEff = (ga != null && xga != null) ? r2(ga / xga) : null;
  final shotAcc = (sh != null && sot != null)
      ? ((sot / sh) * 100).round()
      : null;
  final goalsPerShot = (sh != null && gf != null) ? r2(gf / sh) : null;

  // Maç logu tabanlı (gerçek maç kesiti; log yoksa null kalır)
  final ham = team?['matchLog'];
  if (ham is! List || ham.isEmpty) {
    return DerivedStats(
      finishing: finishing,
      defEff: defEff,
      shotAcc: shotAcc,
      goalsPerShot: goalsPerShot,
    );
  }
  final log = ham.cast<Map>();

  int pts(Map x) => x['result'] == 'G' ? 3 : (x['result'] == 'B' ? 1 : 0);
  double ppgOf(List<Map> rows) =>
      rows.fold<int>(0, (a, x) => a + pts(x)) / rows.length;

  final momentum = log.length >= 6
      ? r2(ppgOf(log.take(5).toList()) - ppgOf(log))
      : null;

  final home = log.where((x) => x['isHome'] == true).toList();
  final away = log.where((x) => x['isHome'] != true).toList();
  final venueGap = (home.length >= 3 && away.length >= 3)
      ? r2(ppgOf(home) - ppgOf(away))
      : null;

  const w = {'strong': 1.5, 'mid': 1.0, 'weak': 0.5};
  final l5 = log.take(5).where((x) => w[x['oppTier']] != null).toList();
  final weightedLast5 = l5.length >= 3
      ? r2(l5.fold<double>(0, (a, x) => a + pts(x) * w[x['oppTier']]!))
      : null;

  int run(bool Function(Map) ok) {
    var n = 0;
    for (final x in log) {
      if (ok(x)) {
        n++;
      } else {
        break;
      }
    }
    return n;
  }

  int say(Object? v) => v is num ? v.toInt() : 0;

  return DerivedStats(
    finishing: finishing,
    defEff: defEff,
    shotAcc: shotAcc,
    goalsPerShot: goalsPerShot,
    momentum: momentum,
    venueGap: venueGap,
    weightedLast5: weightedLast5,
    unbeatenRun: run((x) => x['result'] != 'M'),
    winRun: run((x) => x['result'] == 'G'),
    scoringRun: run((x) => say(x['gf']) > 0),
    csRun: run((x) => say(x['ga']) == 0),
    bttsRun: run((x) => say(x['gf']) > 0 && say(x['ga']) > 0),
  );
}
