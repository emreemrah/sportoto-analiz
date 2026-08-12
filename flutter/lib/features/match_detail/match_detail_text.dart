// KAYNAK: app/src/screens/MatchDetailScreen.js — metin/analiz yardımcıları.
//
// Ekrandan AYRILDILAR: hepsi saf işlevdir ve testten çağrılabilir. Buradaki
// cümleler DOĞRUDAN kullanıcıya görünen dildir; projenin "iddialı dil yok"
// kuralı bu dosyada yaşıyor — hiçbiri "kesin/garanti/kazandırır" demez.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';

/// analiz metni: teknik terimleri anlaşılır Türkçeye çevir
final List<(RegExp, String)> _termMap = [
  (RegExp(r'beklenen gol \(xg\)', caseSensitive: false), 'gol beklentisi'),
  (RegExp(r'\bH2H\b', caseSensitive: false), 'karşılıklı maç geçmişi'),
  (RegExp(r'\bxG\b', caseSensitive: false), 'gol beklentisi'),
  (RegExp(r'\bedge\b', caseSensitive: false), 'avantaj'),
  (RegExp(r'model confidence', caseSensitive: false), 'model güveni'),
  (RegExp(r'raw probability', caseSensitive: false), 'kazanma ihtimali'),
];

String humanize(Object? t) {
  var str = '${t ?? ''}';
  for (final (re, rep) in _termMap) {
    str = str.replaceAll(re, rep);
  }
  return str;
}

/// Türkçe baş harf büyütme. Dart'ın toUpperCase()'i 'i' → 'I' yapar; kaynak
/// `toLocaleUpperCase('tr')` kullanıyordu, karşılığı elle kurulur.
String capTr(String x) {
  if (x.isEmpty) return x;
  final ilk = x[0];
  final buyuk = ilk == 'i' ? 'İ' : (ilk == 'ı' ? 'I' : ilk.toUpperCase());
  return '$buyuk${x.substring(1)}';
}

/// Tahmin gerekçesini madde madde "Güçlü Sinyaller" listesine çevirir.
List<String> buildSinyaller(Map? m) {
  final reason = (m?['prediction'] as Map?)?['reason'];
  return '${reason ?? ''}'
      .split(RegExp(r'[;·]'))
      .map((x) => x.trim())
      .where(
        (x) =>
            x.isNotEmpty &&
            !RegExp(r'^oran yok', caseSensitive: false).hasMatch(x),
      )
      .map((x) => capTr(humanize(x)))
      .toList();
}

/// Kupon yorumu — tahmin etiketiyle tutarlı, çelişkisiz cümle.
String buildKuponYorumu(Map? p) {
  if (p == null || p['symbol'] == '-') return '';
  final mean = '${p['meaning'] ?? ''}';
  final label = p['label'];
  if (label == 'BANKO') {
    return '$mean seçeneği güçlü şekilde öne çıkıyor. Yine de geçmiş '
        'karşılaşmalardaki denge göz önünde bulundurularak kontrollü '
        'değerlendirilmeli.';
  }
  if (label == 'NET' || label == 'TEMKİNLİ') {
    return '$mean seçeneği öne çıkıyor; risk dengesi makul görünüyor.';
  }
  return 'Tek bir sonuç net değil; "$mean" tercihiyle riski dağıtmak daha '
      'mantıklı.';
}

/// Risk notu — sürpriz puanından okunabilir seviye.
String buildRiskNotu(num? score) {
  if (score == null) return '';
  if (score < 25) return 'Risk seviyesi düşük — dengeli ve güçlü bir görünüm.';
  if (score <= 45) {
    return 'Risk seviyesi orta — sonuç tartışmaya açık, kontrollü ilerleyin.';
  }
  return 'Risk seviyesi yüksek — sürprize oldukça açık bir maç.';
}

typedef RiskSeviye = ({String word, Color color});

/// Sürpriz puanı → risk seviyesi (yazı + renk).
RiskSeviye? riskOf(num? score) {
  if (score == null) return null;
  if (score <= 25) return (word: 'Düşük risk', color: AppColors.green);
  if (score <= 50) return (word: 'Orta risk', color: AppColors.yellow);
  if (score <= 75) return (word: 'Yüksek risk', color: AppColors.orange);
  return (word: 'Çok yüksek risk', color: AppColors.red);
}

const Map<String, String> kLabelExplain = {
  'BANKO': 'Tahmin güçlü, risk düşük; güvenli görünen bir maç.',
  'DİKKAT':
      'Tahmin öne çıksa da bazı veriler risk oluşturuyor; kupon '
      'yaparken kontrollü değerlendirilmelidir.',
  'SÜRPRİZE AÇIK':
      'Beklenmeyen sonuç ihtimali yüksek; sürprize oldukça açık '
      'bir maç.',
};

const String kSurpriseExplain =
    "Sürpriz Puanı, maçta beklenmeyen sonuç çıkma ihtimalini gösterir. 0'a "
    "yakın değer düşük sürpriz riski, 100'e yakın değer yüksek sürpriz riski "
    "anlamına gelir.";

typedef PredMeta = ({String guven, String risk, Color color});

/// Kupon tipine göre güven/risk seviyesi ve vurgu rengi (görsel sunum).
/// GETTER, `final` DEĞİL: takım teması `AppColors`ı çalışma zamanında değiştirir
/// (`primary`/`gray` yapısaldır); `final` harita donardı.
Map<String, PredMeta> get kPredMeta => {
  'BANKO': (guven: 'Yüksek', risk: 'Kontrollü', color: AppColors.green),
  'NET': (guven: 'Yüksek', risk: 'Düşük', color: AppColors.primary),
  'TEMKİNLİ': (guven: 'Orta', risk: 'Orta', color: AppColors.yellow),
  'ÇİFTE': (guven: 'Orta', risk: 'Orta', color: AppColors.yellow),
  'AÇIK': (guven: 'Düşük', risk: 'Yüksek', color: AppColors.red),
};

PredMeta get kPredMetaBos => (guven: '—', risk: '—', color: AppColors.gray);

const Map<String, String> kSymWho = {
  '1': 'Ev sahibi',
  '0': 'Beraberlik',
  '2': 'Deplasman',
  '10': 'Ev / Beraberlik',
  '02': 'Beraberlik / Dep.',
  '12': 'Ev / Deplasman',
  '102': 'Üç ihtimal',
};

String buildPickDesc(Map? p) {
  if (p == null || p['symbol'] == '-') return '';
  final label = p['label'];
  if (label == 'BANKO') {
    return 'Mevcut tablo bu seçeneği güçlü gösteriyor. Risk tamamen sıfır '
        'değildir; kontrollü değerlendirilmelidir.';
  }
  if (label == 'NET' || label == 'TEMKİNLİ') {
    return 'Göstergeler bu yönü destekliyor; risk dengesi makul görünüyor.';
  }
  return 'Sonuç net değil; bu seçenek riski daha dengeli dağıtıyor.';
}

/// Son 5 form puanı (0-5): G=1, B=0.5, M=0 → ortalama × 5
double? formRating(List? form) {
  if (form == null || form.isEmpty) return null;
  final pts = form.fold<double>(
    0,
    (acc, r) => acc + (r == 'G' ? 1 : (r == 'B' ? 0.5 : 0)),
  );
  return ((pts / form.length) * 5 * 10).round() / 10;
}

// --- biçimleyiciler (kaynaktaki `ord`, `wdl`, `gd`, `rec`) ---
String? ord(Object? p) => p == null ? null : '$p.';

String? wdl(Map? s) => s == null
    ? null
    : '${s['played']} · ${s['wins']}G ${s['draws']}B ${s['losses']}M';

String? gd(Map? s) {
  if (s == null) return null;
  final diff = s['goalDiff'];
  final isaret = (diff is num && diff >= 0) ? '+' : '';
  return '${s['goalsFor']}-${s['goalsAgainst']} ($isaret$diff)';
}

String? rec(Map? r) =>
    r == null ? null : '${r['wins']}G ${r['draws']}B ${r['losses']}M';
