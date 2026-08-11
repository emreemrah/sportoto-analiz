// KAYNAK: app/src/coupon/smart.js — BİREBİR çeviri.
//
// AKILLI KUPON + ANALİZDEN AKTARIM — saf modül (çizim/api importu yok; testli).
//
// DÜRÜSTLÜK KURALLARI (kesin):
// • Veri yoksa uydurulmaz: sinyali olmayan maç "veri yetersiz" işaretlenir ve
//   boş bırakılır — rastgele/uydurma seçim üretilmez.
// • Kapsama puanı KESİN KAZANMA İHTİMALİ DEĞİLDİR — her yerde bu notla sunulur.
// • Aktarım kullanıcı seçimini ASLA sessizce değiştirmez: önce fark listesi
//   (diffSelections) gösterilir, karar kullanıcınındır.
// • Kolon sınırı 2500 (resmi kural) hiçbir durumda aşılmaz.

import 'dart:math' as math;

import 'coupon_config.dart';

const List<String> _kOrder = ['1', 'X', '2'];

/// Kupon sembolünü (1/0/2/10/02/12/102) olası sonuç listesine açar.
/// 0 = X (beraberlik). '-' veya boş → boş liste.
List<String> expandSymbol(Object? sym) {
  if (sym == null) return const [];
  final s = '$sym';
  if (s.isEmpty || s == '-') return const [];
  return [
    for (final c in s.split(''))
      if (_kOrder.contains(c == '0' ? 'X' : c)) (c == '0' ? 'X' : c),
  ];
}

double? _sonlu(Object? v) {
  if (v is num) return v.isFinite ? v.toDouble() : null;
  final n = double.tryParse('$v');
  return (n != null && n.isFinite) ? n : null;
}

typedef Signals = ({
  Map<String, double>? probs,
  String? sysSym,
  String? radarSym,
  double? surprise,
  double? dataQuality,
});

/// Maçtan MEVCUT sinyalleri topla — olmayan alan null kalır, uydurulmaz.
Signals signalsOf(Map? m) {
  final p = m?['probabilities'] as Map?;
  final probs = (p != null && _kOrder.every((k) => _sonlu(p[k]) != null))
      ? {for (final k in _kOrder) k: _sonlu(p[k])!}
      : null;

  final pred = m?['prediction'] as Map?;
  final sysSym = (pred?['symbol'] != null && pred!['symbol'] != '-')
      ? '${pred['symbol']}'
      : null;

  final master = (m?['radarCenter'] as Map?)?['master'] as Map?;
  final radarSym = (master?['favorite'] as Map?)?['symbol'] as String?;

  final surprise = _sonlu((m?['analysis'] as Map?)?['surpriseScore']);
  final dataQuality = _sonlu(master?['dataQuality']);

  return (
    probs: probs,
    sysSym: sysSym,
    radarSym: radarSym,
    surprise: surprise,
    dataQuality: dataQuality,
  );
}

/// İhtimalleri büyükten küçüğe sırala → [('1',45),('X',30),('2',25)]
List<(String, double)> _rankedProbs(Map<String, double> probs) {
  // JS `Object.entries` ekleme sırasını korur; `signalsOf` her zaman 1/X/2
  // sırasıyla kurar, bu yüzden eşit değerlerde sıra 1 → X → 2 olur.
  final e = [for (final k in _kOrder) (k, probs[k]!)];
  // JS `sort` kararlıdır; eşitlikte ilk gelen önde kalsın diye indeksle.
  final indeksli = [for (var i = 0; i < e.length; i++) (i: i, v: e[i])]
    ..sort((a, b) {
      final c = b.v.$2.compareTo(a.v.$2);
      return c != 0 ? c : a.i.compareTo(b.i);
    });
  return [for (final x in indeksli) x.v];
}

typedef Uncertainty = ({double? u, List<String> reasons});

/// Belirsizlik (0-1) + insanca gerekçeler. Yalnız MEVCUT sinyaller katılır.
Uncertainty uncertaintyOf(Signals sig) {
  final parts = <({double w, double v})>[];
  final reasons = <String>[];

  if (sig.probs != null) {
    final r = _rankedProbs(sig.probs!);
    // favori ile ikinci arasındaki fark
    final gap = (r[0].$2 - r[1].$2) / 100;
    // fark küçükse belirsiz
    final u = math.max(0.0, math.min(1.0, 1 - gap * 2));
    parts.add((w: 3, v: u));
    if (gap <= 0.10) {
      reasons.add('ihtimaller birbirine çok yakın');
    } else if (gap >= 0.25) {
      reasons.add('güçlü bir aday var');
    }
  }

  if (sig.surprise != null) {
    parts.add((w: 2, v: math.max(0.0, math.min(1.0, sig.surprise! / 100))));
    if (sig.surprise! >= 65) reasons.add('sürpriz riski yüksek');
  }

  final sys = expandSymbol(sig.sysSym);
  final sysFirst = sys.isNotEmpty ? sys.first : null;
  if (sysFirst != null && sig.radarSym != null) {
    final disagree = sysFirst != sig.radarSym;
    parts.add((w: 2, v: disagree ? 1 : 0));
    reasons.add(
      disagree
          ? 'Master Analiz ile Radar farklı yönde'
          : 'Master Analiz ile Radar aynı yönde',
    );
  }

  if (sig.dataQuality != null) {
    final v = math.max(0.0, math.min(1.0, 1 - sig.dataQuality! / 100));
    parts.add((w: 1, v: v));
    if (sig.dataQuality! < 50) reasons.add('veri yeterliliği düşük');
  }

  if (parts.isEmpty) {
    return (u: null, reasons: ['bu maç için sinyal verisi yok']);
  }
  final u =
      parts.fold<double>(0, (t, p) => t + p.w * p.v) /
      parts.fold<double>(0, (t, p) => t + p.w);
  return (u: u, reasons: reasons);
}

typedef BaseOutcome = ({String outcome, String source});

/// Maçın taban (tekli) tercihi + kaynağı. Veri yoksa null (uydurulmaz).
BaseOutcome? baseOutcomeOf(Signals sig) {
  if (sig.probs != null) {
    return (outcome: _rankedProbs(sig.probs!).first.$1, source: 'ihtimaller');
  }
  if (sig.radarSym != null) {
    return (outcome: sig.radarSym!, source: 'Radar favorisi');
  }
  final sys = expandSymbol(sig.sysSym);
  if (sys.isNotEmpty) return (outcome: sys.first, source: 'Sistem tahmini');
  return null;
}

/// Bir sonraki en olası işaret (genişletme adayı).
String? _nextOutcomeOf(Signals sig, List<String> chosen) {
  if (sig.probs != null) {
    for (final (o, _) in _rankedProbs(sig.probs!)) {
      if (!chosen.contains(o)) return o;
    }
  }
  for (final o in expandSymbol(sig.sysSym)) {
    if (!chosen.contains(o)) return o;
  }
  if (sig.radarSym != null && !chosen.contains(sig.radarSym)) {
    return sig.radarSym;
  }
  for (final o in _kOrder) {
    if (!chosen.contains(o)) return o;
  }
  return null;
}

typedef SmartSelection = ({Object? no, List<String> selectedOutcomes});
typedef SmartExplanation = ({Object? no, String level, String text});

typedef SmartCoupon = ({
  List<SmartSelection> selections,
  int columns,
  int target,
  List<SmartExplanation> explanations,
  int? coverageScore,
  String coverageNote,
  List<Object?> insufficient,
});

/// AKILLI KUPON: bütçe (kolon cinsinden) + hedef (12-15) → seçim + açıklamalar.
///
/// Mantık: tüm maçlar tabanla tekli başlar; en belirsiz maçlar, bütçe ve 2500
/// sınırı içinde kalarak çifte/üçlüye genişletilir. Hedef düştükçe (12'ye
/// doğru) genişletme iştahı azalır (daha çok yanlışa tahammül var → daha ucuz
/// kupon).
SmartCoupon buildSmartCoupon({
  required List? matches,
  Object? budgetColumns,
  Object? target,
}) {
  final butce = _sonlu(budgetColumns) ?? kCouponMaxColumns.toDouble();
  final maxCols = math.max(
    1,
    math.min(kCouponMaxColumns, butce.floor()),
  );
  final t = target is num ? target.toInt() : int.tryParse('$target');
  final tgt = const [12, 13, 14, 15].contains(t) ? t! : 13;
  // Hedefe göre genişletme eşiği: 15 → her belirsizlik değerli;
  // 12 → yalnız çok belirsizler.
  final threshold = const {15: 0.15, 14: 0.30, 13: 0.45, 12: 0.60}[tgt]!;

  final rows = [
    for (final m in (matches ?? const []).cast<Map>())
      () {
        final sig = signalsOf(m);
        final unc = uncertaintyOf(sig);
        return (
          no: m['no'],
          sig: sig,
          u: unc.u,
          reasons: unc.reasons,
          base: baseOutcomeOf(sig),
        );
      }(),
  ];
  final insufficient = [
    for (final r in rows)
      if (r.base == null) r.no,
  ];
  final usable = [
    for (final r in rows)
      if (r.base != null) r,
  ];

  final picks = <Object?, List<String>>{
    for (final r in usable) r.no: [r.base!.outcome],
  };
  int colsOf() => picks.values.fold<int>(1, (n, o) => n * o.length);

  // Açgözlü genişletme: en belirsiz + eşiği aşan maçtan başla.
  final queue = [
    for (final r in usable)
      if (r.u != null && r.u! >= threshold) r,
  ]..sort((a, b) => b.u!.compareTo(a.u!));

  var guard = 0;
  while (guard++ < 60) {
    var applied = false;
    for (final r in queue) {
      final cur = picks[r.no]!;
      if (cur.length >= 3) continue;
      // Üçlüye yalnız ÇOK belirsiz maçta çık (u ≥ 0.75) — savurganlık değil
      // sinyal.
      if (cur.length == 2 && r.u! < 0.75) continue;
      final nxt = _nextOutcomeOf(r.sig, cur);
      if (nxt == null) continue;
      final factor = (cur.length + 1) / cur.length;
      if (colsOf() * factor > maxCols) continue;
      picks[r.no] = [...cur, nxt];
      applied = true;
      break; // her turda tek genişletme → en değerliye öncelik korunur
    }
    if (!applied) break;
  }

  final selections = [
    for (final r in usable)
      (
        no: r.no,
        selectedOutcomes: [
          for (final o in _kOrder)
            if (picks[r.no]!.contains(o)) o,
        ],
      ),
  ];

  // Sade açıklamalar — teknik formül yok, insanca gerekçe var.
  final explanations = [
    for (final r in usable)
      () {
        final n = picks[r.no]!.length;
        final level = n == 1
            ? 'tekli'
            : n == 2
            ? 'çifte'
            : 'üçlü';
        final why = r.reasons.take(2).join(' · ');
        final head = n == 1
            ? (r.u != null && r.u! >= threshold
                  ? 'tekli kaldı (bütçe/sınır önceliği başka maçlardaydı)'
                  : 'tekli bırakıldı')
            : '$level yapıldı';
        return (
          no: r.no,
          level: level,
          text:
              '$head — ${why.isEmpty ? 'sinyaller tek yönde' : why} '
              '(kaynak: ${r.base!.source})',
        );
      }(),
  ];

  // Kapsama puanı: seçilen işaretlerin ihtimal kütlesi ortalaması (yalnız
  // ihtimal verisi olan maçlarda). KESİN KAZANMA İHTİMALİ DEĞİLDİR.
  final covered = [
    for (final r in usable)
      if (r.sig.probs != null) r,
  ];
  final coverageScore = covered.isEmpty
      ? null
      : (covered.fold<double>(
              0,
              (t, r) =>
                  t +
                  picks[r.no]!.fold<double>(
                    0,
                    (s, o) => s + r.sig.probs![o]!,
                  ),
            ) /
            covered.length)
            .round();

  return (
    selections: selections,
    columns: colsOf(),
    target: tgt,
    explanations: explanations,
    coverageScore: coverageScore,
    coverageNote:
        'Kapsama puanı seçimlerin sinyal ihtimallerini ne kadar örttüğünü '
        'gösterir — kesin kazanma ihtimali DEĞİLDİR.',
    // veri yetersiz maçlar — boş bırakıldı, kullanıcı elle seçer
    insufficient: insufficient,
  );
}

typedef SelectionDiff = ({int no, String from, String to, String kind});

/// AKTARIM FARKI — mevcut seçim ASLA sessizce ezilmez; fark listesi
/// kullanıcıya gösterilir, onaylarsa uygulanır.
List<SelectionDiff> diffSelections(Map? currentMap, Map? proposedMap) {
  final nos = <int>{
    for (final k in (currentMap ?? const {}).keys) ?int.tryParse('$k'),
    for (final k in (proposedMap ?? const {}).keys) ?int.tryParse('$k'),
  }.toList()..sort();

  final changes = <SelectionDiff>[];
  for (final no in nos) {
    final from = _birlestir(currentMap, no);
    final to = _birlestir(proposedMap, no);
    if (from == to) continue;
    changes.add((
      no: no,
      from: from.isEmpty ? '(boş)' : from,
      to: to.isEmpty ? '(boş)' : to,
      // fill: boş dolduruldu · change: mevcut değişecek
      kind: from.isEmpty ? 'fill' : 'change',
    ));
  }
  return changes;
}

/// JS'te anahtar dizgeye çevrilir (`obj[no]`), Dart'ta hem sayı hem dizge
/// anahtar gelebilir — ikisi de aranır.
String _birlestir(Map? map, int no) {
  final v = map?[no] ?? map?['$no'];
  return (v is List) ? v.join('-') : '';
}

/// Aktarım önerisi: Sistem tahmini veya Radar (favori + yakın ikinciyle çifte).
Map<Object?, List<String>> proposalFrom(List? matches, String source) {
  final out = <Object?, List<String>>{};
  for (final m in (matches ?? const []).cast<Map>()) {
    final sig = signalsOf(m);
    if (source == 'system') {
      final o = expandSymbol(sig.sysSym);
      if (o.isNotEmpty) out[m['no']] = o;
    } else if (source == 'radar') {
      if (sig.radarSym == null) continue;
      final arr = <String>[sig.radarSym!];
      // Alternatif: ihtimal verisi varsa ve ikinci işaret favoriye ≤10 puan
      // yakınsa çifte öner.
      if (sig.probs != null) {
        final r = _rankedProbs(sig.probs!);
        final ikinci = r.where((x) => x.$1 != sig.radarSym).firstOrNull;
        final fav = sig.probs![sig.radarSym!];
        if (ikinci != null &&
            fav != null &&
            ikinci.$2 >= fav - 10 &&
            ikinci.$2 >= 25) {
          arr.add(ikinci.$1);
        }
      }
      out[m['no']] = [
        for (final o in _kOrder)
          if (arr.contains(o)) o,
      ];
    }
  }
  return out;
}
