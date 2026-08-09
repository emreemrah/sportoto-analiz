// KAYNAK: app/src/weekRecap.js — BİREBİR çeviri.
//
// HAFTA KAPANIŞI — sistem karnesi ile kullanıcı karnesinin yan yana özeti.
// Saf modül (arayüz bağımlılığı YOK, testli).
//
// DÜRÜSTLÜK KURALLARI (kesin)
//   • Yalnız RESMÎ Spor Toto sonucu sayılır: bir maçın hem `result` hem `score`
//     alanı varsa değerlendirilir. Canlı/geçici skor ASLA karneye yazılmaz.
//   • Karşılaştırma yalnız İKİSİNİN DE tahmin yaptığı maçlarda yapılır —
//     tahmin yapılmayan maç kimsenin aleyhine/lehine sayılmaz.
//   • Sonuç gelmemişse sayı üretilmez (null) — tahmini/örnek karne yoktur.
//   • Bu bir başarı vaadi değildir; geçmiş hafta ölçümüdür.

const Set<String> _outcomes = {'1', 'X', '2'};

/// Resmî sonucu normalize et: '0' → 'X'. Tanınmayan değer → null.
String? normResult(Object? r) {
  if (r == null) return null;
  final s = '$r'.toUpperCase();
  if (s == '0') return 'X';
  return _outcomes.contains(s) ? s : null;
}

/// RESMÎ ÇÖZÜLMÜŞ maç: hem resmî sonuç hem skor gelmiş olmalı.
bool isOfficiallyResolved(Map? m) {
  if (m == null) return false;
  // JS'te `!!(m.result && m.score && ...)` — boş dizge/0 da FALSY sayılır.
  final r = m['result'];
  final s = m['score'];
  final rDolu = r != null && r != false && '$r'.isNotEmpty && r != 0;
  final sDolu = s != null && s != false;
  return rDolu && sDolu && normResult(r) != null;
}

/// Sistem sembolünü ('1', '10', '102'...) sonuç kümesine aç. '0' = X.
List<String> expandSymbol(Object? sym) {
  if (sym == null || '$sym'.isEmpty || sym == '-') return const [];
  return [
    for (final c in '$sym'.split(''))
      if (_outcomes.contains(c == '0' ? 'X' : c)) (c == '0' ? 'X' : c),
  ];
}

int? _rate(int c, int t) => t > 0 ? (c / t * 100).round() : null;

String _teamName(Object? t) {
  if (t is String) return t;
  if (t is Map) return '${t['mediumName'] ?? t['name'] ?? ''}';
  return '';
}

typedef RecapCell = ({String pick, bool hit});
typedef RecapRow = ({
  Object? no,
  String home,
  String away,
  String? score,
  String? actual,
  RecapCell? system,
  RecapCell? user,
});
typedef RecapScore = ({int made, int correct, int? accuracy});
typedef Head2Head = ({int matches, int user, int system, String winner});
typedef RecapHighlight = ({String kind, RecapRow row});
typedef WeekRecap = ({
  ({int total, int resolved, bool complete, int pending}) official,
  RecapScore? system,
  RecapScore? user,
  Head2Head? head2head,
  List<RecapRow> rows,
  List<RecapHighlight> highlights,
  bool hasData,
});

/// [matches]    geçmiş hafta maçları (result + score + prediction alanlı)
/// [selections] kullanıcının FINAL kupon seçimleri [{no, selectedOutcomes}]
WeekRecap buildWeekRecap({List? matches, List? selections}) {
  final all = matches ?? const [];
  final resolved = [
    for (final m in all)
      if (m is Map && isOfficiallyResolved(m)) m,
  ];

  final userMap = <int, List<String>>{};
  for (final s in selections ?? const []) {
    if (s is! Map) continue;
    final sec = s['selectedOutcomes'];
    if (sec is! List || sec.isEmpty) continue;
    final no = int.tryParse('${s['no']}');
    if (no == null) continue;
    userMap[no] = [for (final o in sec) o == '0' ? 'X' : '$o'];
  }

  final rows = <RecapRow>[];
  for (final m in resolved) {
    final actual = normResult(m['result']);
    final pred = m['prediction'];
    final sysSet = expandSymbol(pred is Map ? pred['symbol'] : null);
    final userSet = userMap[int.tryParse('${m['no']}') ?? -1];
    final score = m['score'];
    rows.add((
      no: m['no'],
      home: _teamName(m['home']),
      away: _teamName(m['away']),
      score: score is Map ? '${score['home']}-${score['away']}' : null,
      actual: actual,
      system: sysSet.isNotEmpty
          ? (pick: sysSet.join('-'), hit: sysSet.contains(actual))
          : null,
      user: userSet != null
          ? (pick: userSet.join('-'), hit: userSet.contains(actual))
          : null,
    ));
  }

  final sysRows = rows.where((r) => r.system != null).toList();
  final userRows = rows.where((r) => r.user != null).toList();

  final sysHit = sysRows.where((r) => r.system!.hit).length;
  final userHit = userRows.where((r) => r.user!.hit).length;

  final system = sysRows.isNotEmpty
      ? (
          made: sysRows.length,
          correct: sysHit,
          accuracy: _rate(sysHit, sysRows.length),
        )
      : null;
  final user = userRows.isNotEmpty
      ? (
          made: userRows.length,
          correct: userHit,
          accuracy: _rate(userHit, userRows.length),
        )
      : null;

  // ADİL KARŞILAŞTIRMA — yalnız ikisinin de tahmin yaptığı maçlar.
  final common =
      rows.where((r) => r.system != null && r.user != null).toList();
  Head2Head? head2head;
  if (common.isNotEmpty) {
    final u = common.where((r) => r.user!.hit).length;
    final s = common.where((r) => r.system!.hit).length;
    head2head = (
      matches: common.length,
      user: u,
      system: s,
      winner: u > s ? 'user' : (s > u ? 'system' : 'tie'),
    );
  }

  // ÖNE ÇIKANLAR — yayında anlatılacak anlar.
  final highlights = <RecapHighlight>[];
  for (final r in common) {
    if (r.user!.hit && !r.system!.hit) {
      highlights.add((kind: 'user-win', row: r));
    } else if (!r.user!.hit && r.system!.hit) {
      highlights.add((kind: 'system-win', row: r));
    } else if (!r.user!.hit && !r.system!.hit) {
      highlights.add((kind: 'both-missed', row: r));
    }
  }
  // Kullanıcı yoksa sistemin ıskaları yine gösterilir (dürüst özeleştiri).
  if (common.isEmpty) {
    for (final r in sysRows) {
      if (!r.system!.hit) highlights.add((kind: 'system-missed', row: r));
    }
  }
  const order = {
    'user-win': 0,
    'both-missed': 1,
    'system-win': 2,
    'system-missed': 3,
  };
  highlights.sort((a, b) {
    final k = (order[a.kind] ?? 9).compareTo(order[b.kind] ?? 9);
    if (k != 0) return k;
    return (int.tryParse('${a.row.no}') ?? 0)
        .compareTo(int.tryParse('${b.row.no}') ?? 0);
  });

  final total = all.length;
  final complete = total > 0 && resolved.length == total;
  return (
    official: (
      total: total,
      resolved: resolved.length,
      complete: complete,
      pending: total - resolved.length,
    ),
    system: system,
    user: user,
    head2head: head2head,
    rows: rows,
    highlights: highlights,
    hasData: resolved.isNotEmpty,
  );
}

/// Yayın için tek cümlelik dürüst başlık. Veri yoksa iddia üretilmez.
String recapHeadline(WeekRecap? recap) {
  if (recap == null || !recap.hasData) {
    return 'Resmî sonuçlar açıklandıkça hafta kapanışı burada oluşur.';
  }
  final o = recap.official;
  final scope = o.complete
      ? 'Hafta kapandı'
      : '${o.resolved}/${o.total} resmî sonuç geldi';
  final h = recap.head2head;
  if (h != null) {
    if (h.winner == 'user') {
      return '$scope — bu hafta sen öndesin: ${h.user}/${h.matches} · sistem ${h.system}/${h.matches}.';
    }
    if (h.winner == 'system') {
      return '$scope — sistem önde: ${h.system}/${h.matches} · sen ${h.user}/${h.matches}.';
    }
    return '$scope — berabere: ikiniz de ${h.user}/${h.matches}.';
  }
  final u = recap.user;
  if (u != null) return '$scope — kuponunda ${u.correct}/${u.made} isabet.';
  final s = recap.system;
  if (s != null) {
    return '$scope — sistem ${s.correct}/${s.made} tutturdu; bu hafta kayıtlı kuponun yok.';
  }
  return '$scope — değerlendirilecek tahmin yok.';
}
