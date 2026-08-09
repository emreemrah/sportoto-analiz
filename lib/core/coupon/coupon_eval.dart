// KAYNAK: app/src/couponEval.js — BİREBİR çeviri.
//
// KUPON DEĞERLENDİRME — tek doğruluk kaynağı.
//
// KURAL (kesin): Kupon, kilit anındaki FINAL versiyonun seçimleriyle
// değerlendirilir (depo kilitten sonra yeni versiyona izin vermez). Sonradan
// değişen analiz/tahmin değerlendirmeyi ETKİLEMEZ.
//
// Yalnız RESMİ 90 dakika sonucu (1/X/2) esas alınır; sonuç yoksa ⏳ beklenir,
// uydurma değerlendirme yapılmaz.
//
// NOT: Bu modül BİLEREK bağımsızdır (kupon deposunu/API'yi içe aktarmaz) —
// testte ve her ortamda saf çalışır. `finalVersionOf` mantığı depodaki
// karşılığıyla birebir aynıdır (değişirse ikisi birlikte güncellenir).

import '../brand.dart';

/// Kilit anındaki FINAL versiyon (depo paritesi).
Map? finalVersionOf(Map? coupon) {
  final versions = coupon?['versions'];
  if (versions is! List || versions.isEmpty) return null;
  for (final v in versions.cast<Map>()) {
    if (v['id'] == coupon!['finalVersionId']) return v;
  }
  return versions.last as Map;
}

/// couponConfig.toOfficial paritesi.
String _toOfficialSym(String o) => o == 'X' ? '0' : o;

/// Resmi sonucu normalize et: '0' → 'X'; tanınmayan değer → null (uydurma yok).
String? normResult(Object? r) {
  if (r == null) return null;
  final s = '$r'.toUpperCase();
  if (s == '0') return 'X';
  return (s == '1' || s == 'X' || s == '2') ? s : null;
}

class EvalRow {
  const EvalRow({
    required this.no,
    required this.outcomes,
    required this.actual,
    required this.hit,
  });

  final Object? no;
  final List<String> outcomes;
  final String? actual;

  /// null = resmî sonuç henüz yok (⏳). Uydurma değerlendirme yapılmaz.
  final bool? hit;
}

class EvalResult {
  const EvalResult({
    required this.rows,
    required this.total,
    required this.resolved,
    required this.correct,
    required this.wrong,
    required this.pending,
    required this.allResolved,
    required this.tier,
    required this.misses,
    this.versionNo,
    this.columnCount,
  });

  final List<EvalRow> rows;
  final int total;
  final int resolved;
  final int correct;
  final int wrong;
  final int pending;
  final bool allResolved;

  /// 15/14/13/12 bilgisi: YALNIZ tüm resmi sonuçlar gelince kesinleşir.
  final int? tier;

  /// "Nereden yattım?"
  final List<EvalRow> misses;

  final Object? versionNo;
  final Object? columnCount;
}

/// [resultMap] `{ maçNo: resmî sonuç }`. Seçim satırlarını puanlar.
EvalResult evalSelections(List? selections, Map? resultMap) {
  String? getR(Object? no) => normResult(resultMap?[no]);

  final rows = (selections ?? const []).cast<Map>().map((sc) {
    final actual = getR(sc['no']);
    final outcomes = ((sc['selectedOutcomes'] as List?) ?? const [])
        .cast<String>();
    return EvalRow(
      no: sc['no'],
      outcomes: outcomes,
      actual: actual,
      hit: actual == null ? null : outcomes.contains(actual),
    );
  }).toList();

  final total = rows.length;
  final resolved = rows.where((r) => r.hit != null).length;
  final correct = rows.where((r) => r.hit == true).length;
  final wrong = rows.where((r) => r.hit == false).length;
  final allResolved = total > 0 && resolved == total;

  return EvalResult(
    rows: rows,
    total: total,
    resolved: resolved,
    correct: correct,
    wrong: wrong,
    pending: total - resolved,
    allResolved: allResolved,
    tier: (allResolved && correct >= 12) ? correct : null,
    misses: rows.where((r) => r.hit == false).toList(),
  );
}

/// Kuponu (FINAL versiyonuyla) değerlendir. Versiyon yoksa null.
EvalResult? evalCoupon(Map? coupon, Map? resultMap) {
  final v = finalVersionOf(coupon);
  if (v == null) return null;
  final e = evalSelections(v['selections'] as List?, resultMap);
  return EvalResult(
    rows: e.rows,
    total: e.total,
    resolved: e.resolved,
    correct: e.correct,
    wrong: e.wrong,
    pending: e.pending,
    allResolved: e.allResolved,
    tier: e.tier,
    misses: e.misses,
    versionNo: v['versionNo'],
    columnCount: v['columnCount'],
  );
}

/// Kuponun seçimlerini `{maçNo: resmi sembol}` haritasına çevirir
/// (ör. ['1','X'] → '10'). Canlı Bülten "Sen" satırını besler.
/// Kupon yoksa boş harita.
Map<Object, String> picksMapOf(Map? coupon) {
  final v = coupon != null ? finalVersionOf(coupon) : null;
  if (v == null) return const {};
  final out = <Object, String>{};
  for (final sc in ((v['selections'] as List?) ?? const []).cast<Map>()) {
    final outcomes = ((sc['selectedOutcomes'] as List?) ?? const [])
        .cast<String>();
    if (outcomes.isNotEmpty && sc['no'] != null) {
      out[sc['no'] as Object] = outcomes.map(_toOfficialSym).join();
    }
  }
  return out;
}

/// Paylaşım metni (metin paylaşımı / kopyalama yedeği).
///
/// HASSAS VERİ YOK: yalnız sezon/hafta + seçimler + kolon (+GERÇEK fiyat
/// verisiyle hesaplanmış tutar istenirse) + dürüstlük notu.
/// Fiyat UYDURULMAZ: cost null ise yazılmaz.
String buildShareText({
  required Map? coupon,
  String? roundName,
  String? season,
  Map<Object, ({String home, String away})>? teamsByNo,
  Object? cost,
}) {
  final v = finalVersionOf(coupon);
  if (v == null) return '';

  final lines = ((v['selections'] as List?) ?? const []).cast<Map>().map((sc) {
    final t = teamsByNo?[sc['no']];
    final name = t != null ? '${t.home} - ${t.away}' : 'Maç ${sc['no']}';
    final secim = ((sc['selectedOutcomes'] as List?) ?? const []).join('-');
    return '${sc['no']}. $name → $secim';
  }).toList();

  final head =
      '⚽ $kAppNameUpper'
      '${season != null && season.isNotEmpty ? ' · $season' : ''}'
      '${roundName != null && roundName.isNotEmpty ? ' · $roundName' : ''}';
  final costLine =
      'Kolon: ${v['columnCount']}'
      '${cost != null ? ' · Tutar: $cost TL' : ''}';
  final played = coupon?['playedMarkedAt'] != null
      ? '\nTahmin kilitlendi — kullanıcı beyanı, bağımsız olarak '
            'doğrulanmamıştır.'
      : '';

  return '$head\n\n${lines.join('\n')}\n\n$costLine$played\n'
      '$kNoGuaranteeNotice';
}
