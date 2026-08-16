// KAYNAK: app/src/liveLogic.js — BİREBİR çeviri.
//
// Canlı Bülten paylaşılan mantık: durum türetme, tahmin isabeti (anlık/final),
// risk hesabı. HİÇBİR uydurma veri üretmez — yalnız backend'den gelen gerçek
// skor/durum/tahmin alanlarını yorumlar.
//
// Saf modül: Flutter'a bağlı değil, testten doğrudan çağrılır.

import 'utils.dart';

/// Maçın görüntü durumu.
enum MacDurum {
  live,
  finished,
  awaiting,
  suspended,
  postponed,
  cancelled,
  notStarted,
}

/// Kupon sembolünü (1/0/2/10/02/12/102) olası sonuç kümesine açar.
/// 0 = X (beraberlik).
List<String> expandPick(String? sym) {
  if (sym == null || sym.isEmpty || sym == '-') return const [];
  return sym
      .split('')
      .map((c) => c == '0' ? 'X' : c)
      .where((c) => c == '1' || c == 'X' || c == '2')
      .toList();
}

/// Skordan anlık 1/X/2 sonucu.
String? resultFromScore(Map? score) {
  if (score == null) return null;
  final home = score['home'];
  final away = score['away'];
  if (home == null || away == null) return null;
  if (home is! num || away is! num) return null;
  if (home > away) return '1';
  if (home < away) return '2';
  return 'X';
}

/// Tahmin bu sonucu tutuyor mu? true=isabet, false=iska, null=tahmin/sonuç yok.
bool? pickHits(String? sym, String? actual) {
  final set = expandPick(sym);
  if (set.isEmpty || actual == null || actual.isEmpty) return null;
  return set.contains(actual);
}

const _postponed = {'PST'};
const _cancelled = {'CANC', 'ABD', 'AWD', 'WO'};
const _suspended = {'SUSP', 'INT'};

/// Maçın görüntü durumunu türet. Öncelik: resmi durum kodu > final > canlı >
/// başladı-sonuç-yok > başlamadı.
MacDurum deriveStatus(Map m, {DateTime? now}) {
  final ls = (m['liveStatus'] as String?) ?? '';
  if (_postponed.contains(ls)) return MacDurum.postponed; // Ertelendi
  if (_cancelled.contains(ls)) return MacDurum.cancelled; // İptal
  if (_suspended.contains(ls)) return MacDurum.suspended; // Maç durdu

  final simdi = now ?? DateTime.now();
  final tarih = m['date'] as String?;
  final started =
      m['started'] == true ||
      // Bülten saati TÜRKİYE duvar saatidir; cihaz saat diliminden BAĞIMSIZ
      // karşılaştırma için tek tanım (bkz. utils.macAni). Eski hâl cihaz TSİ
      // değilse ofset kadar kayıyor ve maçı yanlış sınıflandırıyordu.
      (tarih != null && (macAni(tarih)?.isAfter(simdi) == false));

  if (m['finalized'] == true || m['status'] == 'finished') {
    return MacDurum.finished; // MS
  }
  if (m['live'] == true) return MacDurum.live; // CANLI
  if (started) return MacDurum.awaiting; // Sonuç bekleniyor
  return MacDurum.notStarted; // Başlamadı
}

/// İşaret: ✅ / ❌ / ⏳ / (yok)
enum Isaret { correct, wrong, pending, none }

const Map<Isaret, String> kIsaretMetni = {
  Isaret.correct: '✅',
  Isaret.wrong: '❌',
  Isaret.pending: '⏳',
  Isaret.none: '',
};

class PickDurumu {
  const PickDurumu({this.sym, required this.mark, this.finalMi = false});
  final String? sym;
  final Isaret mark;
  final bool finalMi;
}

class MatchPicks {
  const MatchPicks({
    required this.status,
    required this.actual,
    required this.system,
    required this.user,
    required this.scored,
    required this.isFinal,
  });

  final MacDurum status;
  final String? actual;
  final PickDurumu system;
  final PickDurumu user;
  final bool scored;
  final bool isFinal;
}

/// Bir maç için Sen/Sistem tahmin durumları.
MatchPicks matchPicks(Map m, [String? userPick]) {
  final st = deriveStatus(m);
  final prediction = m['prediction'];
  final rawSym = prediction is Map ? prediction['symbol'] as String? : null;
  final systemSym = (rawSym != null && rawSym != '-') ? rawSym : null;
  final actual = resultFromScore(m['score'] as Map?);

  // ✅/❌ yalnız canlı (geçici) veya final (kesin) durumda; ertelenen/iptal/
  // durdu/başlamadı/awaiting → ⏳ (kesin değil).
  final scored = st == MacDurum.live || st == MacDurum.finished;
  final isFinal = st == MacDurum.finished;

  PickDurumu evalPick(String? sym) {
    if (sym == null) return const PickDurumu(mark: Isaret.none);
    if (!scored) return PickDurumu(sym: sym, mark: Isaret.pending); // ⏳
    final hit = pickHits(sym, actual);
    return PickDurumu(
      sym: sym,
      mark: hit == true ? Isaret.correct : Isaret.wrong, // ✅/❌
      finalMi: isFinal,
    );
  }

  return MatchPicks(
    status: st,
    actual: actual,
    system: evalPick(systemSym),
    user: evalPick(userPick),
    scored: scored,
    isFinal: isFinal,
  );
}

class SummaryCounts {
  const SummaryCounts({
    required this.live,
    required this.notStarted,
    required this.awaiting,
    required this.finished,
    required this.couponRisk,
    required this.systemRisk,
  });

  final int live;
  final int notStarted;
  final int awaiting;
  final int finished;
  final int couponRisk;
  final int systemRisk;
}

/// Üst özet sayıları.
SummaryCounts summaryCounts(
  List matches, [
  Map<Object, String> userPicks = const {},
]) {
  var live = 0, notStarted = 0, awaiting = 0, finished = 0;
  var couponRisk = 0, systemRisk = 0;

  for (final raw in matches) {
    final m = raw as Map;
    final st = deriveStatus(m);
    if (st == MacDurum.live) {
      live++;
    } else if (st == MacDurum.notStarted) {
      notStarted++;
    } else if (st == MacDurum.awaiting) {
      awaiting++; // başladı, resmi sonuç bekleniyor
    } else if (st == MacDurum.finished) {
      finished++;
    }

    // Risk = CANLI maçta tahmin şu an İSKA (geçici).
    if (st == MacDurum.live) {
      final actual = resultFromScore(m['score'] as Map?);
      final prediction = m['prediction'];
      final rawSym = prediction is Map ? prediction['symbol'] as String? : null;
      final sysSym = (rawSym != null && rawSym != '-') ? rawSym : null;
      if (pickHits(sysSym, actual) == false) systemRisk++;
      final up = userPicks[m['no']];
      if (up != null && pickHits(up, actual) == false) couponRisk++;
    }
  }

  return SummaryCounts(
    live: live,
    notStarted: notStarted,
    awaiting: awaiting,
    finished: finished,
    couponRisk: couponRisk,
    systemRisk: systemRisk,
  );
}
