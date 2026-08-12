// KAYNAK: app/src/calibrationLogic.js — BİREBİR çeviri.
//
// KALİBRASYON EKRANI MANTIĞI — saf yardımcılar (cihazsız test edilebilir).
//
// SUNUM KURALLARI (araştırma R4'ten, ihlal edilirse ekran yanıltıcı olur):
//  1. ANA RAKAM skill score'dur, "kaç tuttu" DEĞİL. Aksi hâlde kullanıcı
//     0.646 → 0.630 gibi gerçek bir iyileşmeyi hiç göremez.
//  2. Her yüzdenin yanında n bulunur; yüzde tek başına asla gösterilmez.
//  3. Güven aralığı söylenen değeri kapsıyorsa "sapma" DENMEZ —
//     "ayırt edilemiyor" denir.
//  4. Negatif beceri gizlenmez: "piyasadan daha kötü" yazılır.
//  5. Beklenti ayarı zorunlu: mükemmel bir piyasa bile rastgele tahmine göre
//     ancak ~%12 iyileşir. "Ayırt edilemiyor" beklenen ve dürüst sonuçtur.
//  6. Model olasılığı oranlardan türüyorsa (bu üründe çoğu maçta öyle),
//     piyasaya karşı beceri TANIM GEREĞİ sıfırdır ve bu açıkça söylenir.

const String kCalibrationEmptyTitle =
    'Kalibrasyon için henüz yeterli sonuç yok.';
const String kCalibrationEmptyMessage =
    'Bu ölçüm, mühürlü tahminler resmî sonuçlarla eşleştikçe otomatik oluşur. '
    'Geçmişe dönük hesap yapılmaz.';

const String kExpectationNote =
    'Bu işte kazanılabilecek pay çok küçüktür: mükemmel bir piyasa bile rastgele '
    'tahmine göre yalnız ~%12 iyileşir. "Piyasadan ayırt edilemiyor" sonucu '
    'beklenen ve dürüst sonuçtur.';

/// Rapor gösterilebilir mi? (default-deny: alan yoksa GÖSTERME)
bool hasCalibrationData(Map? rep) {
  if (rep == null || rep['hasData'] != true) return false;
  final m = rep['model'];
  if (m is! Map) return false;
  final n = m['n'];
  return n is num && n > 0;
}

typedef SkillText = ({double puan, String yon, String metin, String tone});

/// Skill score → kullanıcı cümlesi. Yüzde puanı olarak, yönüyle birlikte.
SkillText? skillText(Object? skill) {
  if (skill is! num || !skill.isFinite) return null;
  // 0.012 → 1.2
  final puan = (skill * 1000).round() / 10;
  if (puan.abs() < 0.5) {
    return (
      puan: puan,
      yon: 'esit',
      metin: 'Piyasadan ayırt edilemiyor',
      tone: 'neutral',
    );
  }
  if (puan > 0) {
    return (
      puan: puan,
      yon: 'iyi',
      metin: 'Piyasadan %$puan daha iyi',
      tone: 'success',
    );
  }
  return (
    puan: puan,
    yon: 'kotu',
    metin: 'Piyasadan %${puan.abs()} daha kötü',
    tone: 'danger',
  );
}

typedef CalibrationHeadline = ({
  Object n,
  Object weeks,
  SkillText? vsMarket,
  SkillText? vsBaseline,
  bool marketMissing,
});

/// ANA BAŞLIK — ekranın en üstünde duracak tek cümle.
/// Sıralama bilinçli: önce beceri, sonra örneklem. İsabet oranı BAŞLIKTA YOK.
CalibrationHeadline? calibrationHeadline(Map? rep) {
  if (!hasCalibrationData(rep)) return null;
  final skill = rep!['skill'];
  final vsMarketRaw = skill is Map ? skill['vsMarket'] : null;
  final vsBaselineRaw = skill is Map ? skill['vsBaseline'] : null;
  return (
    n: (rep['model'] as Map)['n'],
    weeks: rep['roundsCounted'] ?? 0,
    vsMarket: skillText(vsMarketRaw is Map ? vsMarketRaw['logLoss'] : null),
    vsBaseline: skillText(
      vsBaselineRaw is Map ? vsBaselineRaw['logLoss'] : null,
    ),
    // Piyasa referansı yoksa (hiç oran yoksa) dürüstçe söyle.
    marketMissing: rep['market'] == null,
  );
}

/// "Model = piyasa" uyarısı. Bu üründe olasılık çoğu maçta doğrudan oranlardan
/// türüyor; o maçlarda piyasayı yenmek TANIM GEREĞİ imkânsız. Gizlenirse
/// kullanıcı "neden hep sıfır?" diye düşünür ve yanlış sonuç çıkarır.
({Object share, String title, String body})? marketDerivedNotice(Map? rep) {
  final md = rep?['marketDerived'];
  final pay = md is Map ? md['share'] : null;
  if (pay is! num || pay <= 0) return null;
  final tam = pay >= 99.5;
  return (
    share: pay,
    title: tam
        ? 'Olasılıkların tamamı orandan türüyor'
        : "Olasılıkların %$pay'i orandan türüyor",
    body:
        'Oranı olan maçlarda gösterdiğimiz olasılık, oranların marjdan '
        'arındırılmış hâlidir. Bu maçlarda "piyasayı yenmek" tanım gereği '
        'mümkün değildir; beceri sıfıra yakın çıkar ve bu bir başarısızlık '
        'değildir. Bağımsız ölçüm yalnız oranı bulunamayan maçlarda yapılır.',
  );
}

/// GERÇEK SINAV: oranı bulunamayan maçlar. Piyasadan türemediği için modelin
/// kendi katkısı yalnız burada ölçülebilir. Örneklem küçükse söylenir; küçük n
/// ile "iyiyiz/kötüyüz" denmez.
({
  Object n,
  Object? logLoss,
  Object? brier,
  bool reliable,
  String title,
  String body,
})?
independentTestText(Map? rep) {
  final e = rep?['estimatedOnly'];
  if (e is! Map) return null;
  final n = e['n'];
  if (n == null || n == 0) return null;
  final guvenli = n is num && n >= 30;
  final uniform = rep?['uniform'];
  final rastgele = uniform is Map ? (uniform['logLoss'] ?? '—') : '—';
  return (
    n: n,
    logLoss: e['logLoss'],
    brier: e['brier'],
    reliable: guvenli,
    title: 'Bağımsız sınav — oranı olmayan maçlar',
    body: guvenli
        ? 'Bu $n maçta olasılık piyasadan türemedi; modelin kendi katkısı '
              'yalnız burada görünür (log-loss ${e['logLoss']}, rastgele $rastgele).'
        : 'Yalnız $n maç var — bu sayıda hiçbir yön (iyi ya da kötü) '
              'güvenilir değildir. Sayı büyüdükçe anlamlı olacak.',
  );
}

typedef ScoreRow = ({
  String ad,
  Object? n,
  Object? logLoss,
  Object? brier,
  Object? rps,
  String? not,
});

/// Skor tablosu satırları — model / piyasa / taban yan yana.
List<ScoreRow> scoreRows(Map? rep) {
  if (!hasCalibrationData(rep)) return const [];
  ScoreRow? satir(String ad, Object? s, [String? not]) {
    if (s is! Map) return null;
    return (
      ad: ad,
      n: s['n'],
      logLoss: s['logLoss'],
      brier: s['brier'],
      rps: s['rps'],
      not: not,
    );
  }

  final uniform = rep!['uniform'];
  return [
    ?satir('Model', rep['model']),
    ?satir(
      'Piyasa (oran)',
      rep['market'],
      rep['market'] != null ? null : 'oran yok',
    ),
    ?satir('Lig taban oranı', rep['baseline']),
    ?satir('Rastgele (1/3)', {
      'n': (rep['model'] as Map)['n'],
      'logLoss': uniform is Map ? uniform['logLoss'] : null,
      'brier': uniform is Map ? uniform['brier'] : null,
      'rps': uniform is Map ? uniform['rps'] : null,
    }, 'referans'),
  ];
}

/// Kalibrasyon eğrisi satırları. Kural 3: aralık söylenen değeri kapsıyorsa
/// "sapma" denmez. Her satırda n zorunlu.
List<Map<String, dynamic>> curveRows(Map? rep) {
  final c = rep?['curve'];
  if (c is! Map || c['insufficient'] == true) return const [];
  final bins = c['bins'];
  if (bins is! List || bins.isEmpty) return const [];
  return [
    for (final raw in bins)
      if (raw is Map)
        {
          ...raw.cast<String, dynamic>(),
          // Kullanıcı cümlesi: "%60 dediğimiz X maçın %61'i oldu"
          'metin':
              "%${raw['saidPct']} dediğimiz ${raw['n']} durumun %${raw['actualPct']}'i gerçekleşti",
          'durum': raw['distinguishable'] == true
              ? 'sapma'
              : 'ayirt-edilemiyor',
          'durumMetni': raw['distinguishable'] == true
              ? 'Söylenen değerden ayrışıyor'
              : 'Söylenen değerden ayırt edilemiyor',
        },
  ];
}

/// Eğri çizilemiyorsa kullanıcıya söylenecek dürüst cümle.
String? curveUnavailableText(Map? rep) {
  final c = rep?['curve'];
  if (c is Map && c['insufficient'] != true) {
    final bins = c['bins'];
    if (bins is List && bins.isNotEmpty) return null;
  }
  if (c is Map && c['note'] != null) return '${c['note']}';
  return 'Kalibrasyon eğrisi için yeterli gözlem yok.';
}
