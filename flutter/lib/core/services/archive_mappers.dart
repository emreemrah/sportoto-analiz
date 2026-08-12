// KAYNAK: app/src/services/archiveMappers.js — BİREBİR çeviri.
//
// SAF dönüştürücüler: backend arşiv API yanıtları → ekranların kullandığı
// Bulletin / AnalysisSnapshot biçimleri.
// KURALLAR:
//  * halfTimeScore YENİ MOTORDA KULLANILMAZ: geriye uyumluluk için alan hep
//    null yazılır; API'den gelse bile OKUNMAZ.
//  * Veri yoksa null/"Bu veri bulunamadı" — sahte değer üretilmez.
//  * Geçmiş bülten SNAPSHOT verisinden gösterilir; güncel takım verisiyle
//    yeniden hesap YAPILMAZ (bu dosyada hiçbir analiz hesabı yoktur).

const Set<String> _valid = {'1', 'X', '2'};

/// '1X' / '12' / '1X2' gösterimini tek tek sembollere açar (başarı kıyası için).
List<String> expandDisplayPick(Object? display) {
  if (display == null) return const [];
  final out = <String>[];
  for (final ch in '$display'.split('')) {
    if (_valid.contains(ch)) out.add(ch);
  }
  return out;
}

/// Gösterim çoklu tercihse (ör. '1X'), resmî sonuç bunlardan biriyse TUTAR.
/// Veri eksikse null döner — "tutmadı" DEMEZ.
bool? displayPickHits(Object? display, Object? officialResult) {
  final set = expandDisplayPick(display);
  if (set.isEmpty || officialResult == null) return null;
  return set.contains('$officialResult');
}

String? _formLine(Object? arr) {
  if (arr is List && arr.isNotEmpty) return arr.join(' ');
  return null;
}

/// Payload'daki GERÇEK takım verisinden kısa, dürüst özet metni. Veri yoksa null.
String? buildStatsSummary(Map? m) {
  final parts = <String>[];
  final td = m?['teamData'];
  final h = td is Map ? td['home'] : null;
  final a = td is Map ? td['away'] : null;

  final hLast5 = h is Map ? h['last5'] : null;
  final aLast5 = a is Map ? a['last5'] : null;
  if (hLast5 is List && hLast5.isNotEmpty) {
    parts.add('Ev son 5: ${_formLine(hLast5)}');
  }
  if (aLast5 is List && aLast5.isNotEmpty) {
    parts.add('Dep son 5: ${_formLine(aLast5)}');
  }

  final hPos = (h is Map && h['standing'] is Map)
      ? (h['standing'] as Map)['position']
      : null;
  final aPos = (a is Map && a['standing'] is Map)
      ? (a['standing'] as Map)['position']
      : null;
  if (hPos != null && aPos != null) {
    parts.add('Sıra: $hPos. vs $aPos.');
  }

  final market = m?['market'];
  if (market is Map && market['probabilities'] is Map) {
    final p = market['probabilities'] as Map;
    final tahmini = market['probabilitiesEstimated'] == true
        ? ' (tahminî)'
        : '';
    parts.add('İhtimal 1/X/2: %${p['1']}/%${p['X']}/%${p['2']}$tahmini');
  }

  return parts.isNotEmpty ? parts.join(' · ') : null;
}

/// Bülten listesi öğesi → Bulletin (liste kartı için).
Map<String, dynamic> mapBulletinSummary(Map apiB) {
  final total = apiB['totalMatches'];
  final rs = apiB['resultSummary'];
  final snapshot = apiB['snapshot'];

  final numara = [
    apiB['season'],
    apiB['week'],
  ].where((x) => x != null && '$x'.isNotEmpty).join(' · ');

  final int adet = total is num ? total.toInt() : 0;

  return {
    'id': '${apiB['id']}',
    'bulletinNo': numara.isNotEmpty ? numara : '#${apiB['roundId']}',
    'roundId': apiB['roundId'],
    'date': apiB['firstMatchStartAt'] ?? apiB['createdAt'],
    // draft/active/locked/completed/cancelled (aynı sözlük)
    'status': apiB['status'],
    'createdAt': apiB['createdAt'],
    'firstMatchStartAt': apiB['firstMatchStartAt'],
    'freezeAt': apiB['freezeAt'],
    'lockedAt': apiB['lockedAt'],
    'completedAt': apiB['completedAt'],
    // Liste görünümü maç satırı çizmez; kart yalnız adet kullanır.
    'matches': List.generate(
      adet,
      (i) => {'id': '${apiB['id']}-m${i + 1}', 'orderNo': i + 1},
    ),
    'preMatchSnapshotId': (snapshot is Map && snapshot['exists'] == true)
        ? (snapshot['id'] ?? 'snap-${apiB['id']}')
        : null,
    'immutable': apiB['immutable'] == true,
    'verificationHash': snapshot is Map ? snapshot['verificationHash'] : null,
    'shortHash': snapshot is Map ? snapshot['shortHash'] : null,
    'dataGaps': apiB['dataGaps'],
    'resultSummary': rs is Map
        ? {
            'systemCorrect': rs['correct'] ?? 0,
            'systemWrong': _sayi(rs['predicted']) - _sayi(rs['correct']),
            'systemAccuracy': rs['accuracy'] ?? 0,
            'resolvedCount': rs['predicted'] ?? 0,
            'totalCount': rs['totalMatches'] ?? total ?? 0,
          }
        : null,
    '_finishedCount': apiB['resolvedCount'] ?? 0,
    '_source': 'api',
  };
}

int _sayi(Object? v) => v is num ? v.toInt() : 0;

/// Bülten detayı → Bulletin (maç satırlarıyla).
Map<String, dynamic> mapBulletinDetail(Map apiB) {
  final base = mapBulletinSummary(apiB);
  final matches = <Map<String, dynamic>>[];
  for (final raw in (apiB['matches'] as List?) ?? const []) {
    final m = raw as Map;
    final official = m['official'];
    matches.add({
      'id': '${m['matchId']}',
      'bulletinId': base['id'],
      'orderNo': m['orderNo'],
      'code': '${base['id']}-${'${m['orderNo']}'.padLeft(2, '0')}',
      'homeTeam': {'name': m['homeName'] ?? ''},
      'awayTeam': {'name': m['awayName'] ?? ''},
      'league': m['league'] ?? '',
      'startTime': m['kickoffAt'],
      'status': official != null ? 'finished' : 'not_started',
      // yeni motor okumaz/yazmaz (geriye uyumlu alan)
      'halfTimeScore': null,
      // yalnız resmî 90 dk skoru
      'fullTimeScore': official is Map ? official['fullTimeScore'] : null,
      // yalnız resmî 1/X/2
      'result1x2': official is Map ? official['result'] : null,
      'resultSource': official is Map ? official['source'] : null,
      'resultConfirmedAt': official is Map ? official['confirmedAt'] : null,
      'correctionVersion': official is Map
          ? official['correctionVersion']
          : null,
    });
  }
  return {
    ...base,
    'matches': matches,
    '_finishedCount': matches.where((m) => m['result1x2'] != null).length,
  };
}

/// Snapshot + (varsa) sonuç/değerlendirme → AnalysisSnapshot.
///
/// resultsByMatchId: { matchId: { officialResult, fullTimeScore } }
/// evalByMatchId:    { matchId: { correct, officialResult, fullTimeScore } }
Map<String, dynamic>? mapSnapshot(
  Map? apiSnap, {
  Map<String, dynamic> resultsByMatchId = const {},
  Map<String, dynamic> evalByMatchId = const {},
}) {
  final payload = apiSnap?['payload'];
  if (payload is! Map) return null;

  final matchesAnalysis = <Map<String, dynamic>>[];
  for (final raw in (payload['matches'] as List?) ?? const []) {
    final m = raw as Map;
    final key = '${m['matchId']}';
    final ev = evalByMatchId[key];
    final res = ev ?? resultsByMatchId[key];
    final sp = m['systemPrediction'];
    final display = sp is Map ? sp['display'] : null;
    final actual = res is Map ? res['officialResult'] : null;
    // Değerlendirme uçtan geldiyse SUNUCUNUN kararı esastır; yoksa yerel
    // karşılaştırma yapılır. İkisi de yoksa null (— "yanlış" DEMEZ).
    // NOT: bu KUPON KAPSAMASI ölçüsüdür (çoklu display); kullanıcıya
    // gösterilen başarı yüzdesi bundan üretilmez (tek ölçü kuralı, aşağıda).
    final systemCorrect = ev is Map
        ? ev['correct']
        : displayPickHits(display, actual);

    // TEK ÖLÇÜ (2026-08-11, kullanıcı kararı): ekranlardaki sistem başarısı
    // TEKLİ mühürlü ana tahmindir — backend karnesiyle (scorecardService)
    // AYNI kural: yalnız 1/X/2 ana tahmin × resmî sonuç. Ana tahmin mühürde
    // yoksa maç değerlendirmeye girmez (null — "yanlış" DEMEZ).
    final ac = m['analysisCenter'];
    final oma = ac is Map ? ac['officialMasterAnalysis'] : null;
    final mainRaw = (oma is Map && oma['ok'] != false)
        ? oma['mainPrediction']
        : null;
    final anaTahmin = (mainRaw == '1' || mainRaw == 'X' || mainRaw == '2')
        ? '$mainRaw'
        : null;
    final anaTahminCorrect = (anaTahmin != null && actual != null)
        ? anaTahmin == '$actual'
        : null;

    final confidence = m['confidence'];
    final radar = m['radar'];

    matchesAnalysis.add({
      'matchId': key,
      'orderNo': m['no'],
      // '1' | 'X' | '2' | '1X' | 'X2' | '12' | '1X2' | null (KUPON önerisi)
      'prediction': display,
      // TEKLİ mühürlü ana tahmin — görünen başarı yüzdesinin tek kaynağı.
      'anaTahmin': anaTahmin,
      'predictionLabel': sp is Map ? sp['label'] : null,
      'predictionReason': sp is Map ? sp['reason'] : null,
      // gerçek veriden (favori ihtimali); yoksa null
      'confidenceScore': confidence is Map
          ? confidence['favoritePercent']
          : null,
      'surpriseRisk':
          (confidence is Map ? confidence['surpriseScore'] : null) ??
          (radar is Map ? radar['surpriseScore'] : null),
      // 'Düşük' | 'Orta' (asla 'Yüksek' — veri eksikliği kuralı)
      'dataConfidence': confidence is Map ? confidence['dataConfidence'] : null,
      'analysisComment': m['aiComment'] ?? m['analysisComment'],
      'statsSummary': buildStatsSummary(m),
      'lineupComment': m['missingPlayersNote'] ?? 'Bu veri bulunamadı.',
      // kaynak yok — boş (uydurma isim YOK)
      'missingPlayers': const [],
      'radarLabel': radar is Map ? radar['label'] : null,
      'favorite': radar is Map ? radar['favorite'] : null,
      'dataQuality': m['dataQuality'],
      'dataTimestamp':
          (payload['lock'] is Map
              ? (payload['lock'] as Map)['dataObservedAt']
              : null) ??
          apiSnap?['lockedAt'],
      'createdAt': apiSnap?['createdAt'],
      'version': 1,
      'isLocked': true,
      'resultInfo': res is Map
          ? {
              // ilk yarı bu sistemde kullanılmaz
              'halfTimeScore': null,
              'fullTimeScore': res['fullTimeScore'],
              'actualResult': actual,
              'systemCorrect': systemCorrect,
              'anaTahminCorrect': anaTahminCorrect,
              'userCorrect': null,
              // hata etiketi verisi yok — uydurulmaz
              'errorTag': null,
              'errorNote': (systemCorrect == false && display != null)
                  ? 'Sistem $display bekliyordu, resmî sonuç $actual geldi.'
                  : null,
            }
          : null,
    });
  }

  final hash = apiSnap?['verificationHash'];
  return {
    'id': apiSnap?['id'] ?? 'snap-${apiSnap?['bulletinId']}',
    'bulletinId': '${apiSnap?['bulletinId']}',
    'version': 1,
    'schemaVersion': apiSnap?['schemaVersion'],
    'engineVersion': apiSnap?['engineVersion'],
    'createdAt': apiSnap?['createdAt'],
    'lockedAt': apiSnap?['lockedAt'],
    'dataObservedAt': apiSnap?['dataObservedAt'],
    'late': apiSnap?['late'] == true,
    'isLocked': true,
    'immutable': apiSnap?['immutable'] != false,
    'verificationHash': hash,
    'shortHash': (hash is String && hash.isNotEmpty)
        ? hash.substring(0, hash.length < 10 ? hash.length : 10)
        : null,
    'matchesAnalysis': matchesAnalysis,
    '_source': 'api',
  };
}

/// results API yanıtı → { matchId: {...} } indeksi
Map<String, dynamic> indexResults(Object? apiResults) {
  final map = <String, dynamic>{};
  final list = apiResults is Map ? apiResults['results'] : null;
  for (final raw in (list as List?) ?? const []) {
    final r = raw as Map;
    map['${r['matchId']}'] = {
      'officialResult': r['officialResult'],
      'fullTimeScore': r['fullTimeScore'],
    };
  }
  return map;
}

/// evaluation API yanıtı → { matchId: {...} } indeksi
Map<String, dynamic> indexEvaluation(Object? apiEval) {
  final map = <String, dynamic>{};
  final list = apiEval is Map ? apiEval['matches'] : null;
  for (final raw in (list as List?) ?? const []) {
    final m = raw as Map;
    map['${m['matchId']}'] = {
      'correct': m['correct'],
      'officialResult': m['officialResult'],
      'fullTimeScore': m['fullTimeScore'],
    };
  }
  return map;
}
