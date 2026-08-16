// KAYNAK: app/src/radarScreenData.js — BİREBİR çeviri.
//
// RADAR EKRANI VERİ TÜRETME — saf yardımcılar (Flutter'sız test edilebilir).
//
// NEDEN AYRI DOSYA: RadarScreen 1500 satırdı ve bu hesaplar çizim gövdesinin
// içine gömülüydü — yani filtre/sıralama/sayaç mantığı yalnız ekranı çizerek
// test edilebiliyordu. Buradaki işlevler widget bilmez, doğrudan sınanır.

import '../../core/utils.dart';

class DnaPeriod {
  const DnaPeriod(this.k, this.label);
  final String k;
  final String label;
}

const List<DnaPeriod> kDnaPeriods = [
  DnaPeriod('allTime', 'Tüm Haftalar'),
  DnaPeriod('last5', 'Son 5 Hafta'),
  DnaPeriod('last10', 'Son 10 Hafta'),
  DnaPeriod('last15', 'Son 15 Hafta'),
];

/// Dönem → satır açılımında gösterilecek maç sayısı. `allTime` için sınır
/// YOKTUR (null → tüm liste). Liste dönemle sınırlanmazsa "Son 5 Hafta"
/// seçiliyken 51 maç görünür ve ekrandaki yüzdeyle uyuşmaz — kullanıcı sayıyı
/// doğrulayamaz.
const Map<String, int> kDonemMacSayisi = {
  'last5': 5,
  'last10': 10,
  'last15': 15,
};

final Map<String, String> kDnaPeriodLabels = {
  for (final p in kDnaPeriods) p.k: p.label,
};

// ── RADAR 5 YAKINLIK FİLTRESİ (backend spec, 2026-08-08) ────────────────────
// KAYNAKTA (RN) HENÜZ YOK: bu filtre kaynak deponun tasks/todo.md spec'inden
// uygulanır; RN ekranı henüz uygulamadı. Spec'in İKİ KATMANI:
//   üst katman = mod (dönem çiplerinin yanına Oynanma % · Oran eklenir),
//   alt katman = MAÇ penceresi (Son 5/10/15 maç — birim HAFTA DEĞİL, maçtır).
// Ek olarak yakınlık adımı kullanıcı seçimidir (Radar 3 dili, otomatik
// genişleme yok): oynanma birebir/±3/±5/±10, oran ±0.10/±0.25/±0.50.

const List<DnaPeriod> kDnaFiltreModlari = [
  // Etiket "Oynanma Yüzdesi" (kullanıcı kararı, 2026-08-10) — "%" kısaltması
  // yeterince açık bulunmadı; "Oran" olduğu gibi kaldı.
  DnaPeriod('oynanma', 'Oynanma Yüzdesi'),
  DnaPeriod('oran', 'Oran'),
];

/// Alt katman pencereleri — anahtarlar backend `windows` alanıyla aynı;
/// etiketler MAÇ der, hafta değil (spec'in "BİRİM FARKI" uyarısı).
/// SIRA dönem çipleriyle aynı dildedir: önce Tümü, sonra Son 5/10/15
/// (kullanıcı kararı, 2026-08-10 — "Tümü, Son 5, Son 10 gibi sırası olsun").
/// 'Tümü' kDonemMacSayisi'nde anahtarsız → satır açılımında liste kesilmez.
const List<DnaPeriod> kDnaMacPencereleri = [
  DnaPeriod('allTime', 'Tümü'),
  DnaPeriod('last5', 'Son 5 maç'),
  DnaPeriod('last10', 'Son 10 maç'),
  DnaPeriod('last15', 'Son 15 maç'),
];

final Map<String, String> kDnaMacPencereLabels = {
  for (final p in kDnaMacPencereleri) p.k: p.label,
};

const List<num> kOynanmaTolAdimlari = [0, 3, 5, 10];
// Oran adımları DAR: birebir / ±0.02 / ±0.03 (kullanıcı kararı, 2026-08-10 —
// önceki ±0.10/±0.25/±0.50 "aynı maçı" aramak için fazla genişti).
const List<num> kOranTolAdimlari = [0, 0.02, 0.03];

/// Tolerans çip etiketi: 0 her iki modda da "Birebir"dir; oran adımları iki
/// ondalıkla, oynanma adımları tam sayıyla yazılır.
String tolEtiketi(String mod, num tol) {
  if (tol == 0) return 'Birebir';
  if (mod == 'oynanma') return '±${tol.toInt()}';
  return '±${tol.toStringAsFixed(2)}';
}

/// 2026 → "2025/2026 Sezonu"; "2025/2026" → "2025/2026 Sezonu"; boşsa ''.
String sezonAdiUzun(Object? y) {
  final s = '${y ?? ''}'.trim();
  if (s.isEmpty) return '';
  if (s.contains('/')) return '$s Sezonu';
  final n = num.tryParse(s);
  return n != null ? '${n - 1}/$n Sezonu' : s;
}

class HaftaOgesi {
  const HaftaOgesi({
    required this.roundId,
    required this.ad,
    required this.kilitli,
    required this.guncel,
    this.yil,
  });

  final int roundId;
  final String ad;
  final bool kilitli;
  final bool guncel;
  final Object? yil;
}

class SezonOgesi {
  const SezonOgesi(this.y, this.ad);
  final String y;
  final String ad;
}

class HaftaSeciciVerisi {
  const HaftaSeciciVerisi({
    required this.sezonlar,
    required this.seciliSezon,
    required this.sezonAdi,
    required this.liste,
    required this.haftaAdi,
    required this.haftaGuncelMi,
  });

  /// 1 taneyse düz yazı gösterilir.
  final List<SezonOgesi> sezonlar;
  final String? seciliSezon;
  final String sezonAdi;

  /// Hafta açılır listesinin içeriği.
  final List<HaftaOgesi> liste;

  /// Düğmede yazan hafta.
  final String? haftaAdi;
  final bool haftaGuncelMi;
}

/// HAFTA SEÇİCİ VERİSİ — resmî Spor Toto listesindeki gezinti:
///   `[2025/2026 Sezonu ▼]  [53. Hafta ▼]`
///
/// NEDEN: hafta çipleri yan yana diziliyordu. Yeni sezon 1. haftayla başlayınca
/// hem numara küçülüyor hem de haftalar birikiyor (sezonda 52) — şerit okunmaz
/// hâle geliyor.
///
/// Hafta listesi seçili sezonun BÜTÜN haftalarını içerir, GÜNCEL hafta da dahil
/// ve en üstte (resmî listede de öyle). Sıralama yeniden eskiye: 53, 52, 51…
HaftaSeciciVerisi haftaSeciciVerisi(
  List? weeks, {
  Object? curId,
  Object? selectedId,
  Object? navSezon,
}) {
  bool guncelMi(Map w) {
    if (w['current'] == true) return true;
    final rid = w['roundId'];
    if (rid == null || curId == null) return false;
    return num.tryParse('$rid') == num.tryParse('$curId');
  }

  final hepsi =
      (weeks ?? const [])
          .cast<Map>()
          .where((w) => w['roundId'] != null)
          .map(
            (w) => HaftaOgesi(
              roundId: int.parse('${w['roundId']}'),
              ad: '${w['round'] ?? '#${w['roundId']}'}',
              kilitli: w['locked'] == true || w['sealed'] == true,
              guncel: guncelMi(w),
              yil: w['year'],
            ),
          )
          .toList()
        ..sort((a, b) => b.roundId.compareTo(a.roundId));

  final yillar = <String>{
    for (final w in hepsi)
      if (w.yil != null) '${w.yil}',
  }.toList()..sort((a, b) => b.compareTo(a));
  final sezonlar = yillar.map((y) => SezonOgesi(y, sezonAdiUzun(y))).toList();

  // Bakılan hafta: seçili → yoksa güncel → yoksa en yeni.
  HaftaOgesi? bakilan;
  if (selectedId != null) {
    final hedef = num.tryParse('$selectedId');
    for (final w in hepsi) {
      if (w.roundId == hedef) {
        bakilan = w;
        break;
      }
    }
  }
  bakilan ??= hepsi.where((w) => w.guncel).firstOrNull ?? hepsi.firstOrNull;

  // Seçili sezon: kullanıcının seçimi → bakılan haftanın sezonu → en yeni.
  final navStr = navSezon != null ? '$navSezon' : null;
  final seciliSezon = (navStr != null && sezonlar.any((s) => s.y == navStr))
      ? navStr
      : (bakilan?.yil != null ? '${bakilan!.yil}' : (sezonlar.firstOrNull?.y));

  // Sezon süzgeci yalnız BİRDEN ÇOK sezon varken; tek sezonda süzülmez ki yılı
  // bilinmeyen hafta listeden düşmesin.
  final liste = (sezonlar.length > 1 && seciliSezon != null)
      ? hepsi.where((w) => '${w.yil}' == seciliSezon).toList()
      : hepsi;

  return HaftaSeciciVerisi(
    sezonlar: sezonlar,
    seciliSezon: seciliSezon,
    sezonAdi: sezonAdiUzun(seciliSezon),
    liste: liste,
    haftaAdi: bakilan?.ad,
    haftaGuncelMi: bakilan?.guncel ?? false,
  );
}

class MasterFilter {
  const MasterFilter(this.k, this.label);
  final String k;
  final String label;
}

/// Etiketlerde RENKLİ NOKTA EMOJİSİ YOK (kullanıcı isteği, 2026-08-12):
/// 🟢/🟡/🔴/⚪ emojisinin rengi emoji fontundan geliyordu ve rozetlerdeki
/// anlamsal tonla tutmuyordu. Nokta artık ekranda vektör olarak çizilir
/// (bkz. radar_screen.dart → `_filtreNoktasi`). Bu dosya WIDGET BİLMEZ, o
/// yüzden renk burada DEĞİL orada durur.
const List<MasterFilter> kMasterFilters = [
  MasterFilter('all', 'Tümü'),
  MasterFilter('strong', 'Güçlü Aday'),
  MasterFilter('medium', 'Karışık Sinyal'),
  MasterFilter('surprise', 'Sürpriz Sinyali'),
  MasterFilter('insufficient', 'Analiz Hazır Değil'),
  MasterFilter('drawRisk', 'X Beraberlik Riski'),
  MasterFilter('awaySurprise', '2 Dep. Sürprizi'),
];

/// KARIŞIK SİNYAL maçında önerilen ÇİFT ihtimal (kullanıcı kararı,
/// 2026-08-10): üç ihtimalli maçta tek işaret basmak yanlış güven verir;
/// motorun birleşik puanının (master.scores) en yüksek İKİ işareti kupon
/// dilindeki 1-X-2 sırasıyla önerilir ('1-X', '1-2', 'X-2').
/// Skorlar eksikse null — çift UYDURULMAZ, kart eski görünümünde kalır.
/// Geri test (53. Hafta, mühürlü kayıtlar): tek işaret 4/12 tutmuştu,
/// çift ihtimal 9/12 tutardı.
String? ciftIhtimal(Map? master) {
  final s = master?['scores'];
  if (s is! Map) return null;
  num? d(Object? v) => v is num ? v : num.tryParse('$v');
  final puan = {'1': d(s['home']), 'X': d(s['draw']), '2': d(s['away'])};
  if (puan.values.any((v) => v == null)) return null;
  const sira = ['1', 'X', '2'];
  // Eşitlikte işaret sırası kazanır — seçim deterministik kalmalı.
  final secim = [...sira]
    ..sort((a, b) {
      final f = puan[b]!.compareTo(puan[a]!);
      return f != 0 ? f : sira.indexOf(a).compareTo(sira.indexOf(b));
    });
  final cift = secim.take(2).toList()
    ..sort((a, b) => sira.indexOf(a).compareTo(sira.indexOf(b)));
  return cift.join('-');
}

/// Yüzdeleri sade TAM SAYIya yuvarla ve toplamı 100'e sabitle (en büyük kalan
/// yöntemi) — "1 %44 · X %37 · 2 %19" gibi temiz görünüm. Toplamı 100 tutmak
/// ŞART: 99 ya da 101 gören kullanıcı sayıya güvenmez.
Map<String, int>? roundPct100(Map? pct) {
  if (pct == null) return null;
  double d(Object? v) => v is num ? v.toDouble() : (double.tryParse('$v') ?? 0);
  final raw = {'1': d(pct['1']), 'X': d(pct['X']), '2': d(pct['2'])};
  final floors = {
    '1': raw['1']!.floor(),
    'X': raw['X']!.floor(),
    '2': raw['2']!.floor(),
  };
  var rem = 100 - (floors['1']! + floors['X']! + floors['2']!);
  final order = ['1', 'X', '2']
    ..sort((a, b) => (raw[b]! - floors[b]!).compareTo(raw[a]! - floors[a]!));
  for (var i = 0; i < order.length && rem > 0; i++) {
    floors[order[i]] = floors[order[i]]! + 1;
    rem -= 1;
  }
  return floors;
}

String ord(Object? n) => n != null ? '$n.' : '—';

String? wdl(Map? v) => v == null
    ? null
    : '${v['wins'] ?? 0}G ${v['draws'] ?? 0}B ${v['losses'] ?? 0}M';

/// DİKKAT — null/'' burada AYRI ele alınır. `Number(null) === 0` olduğu için
/// eski hâli eksik veriyi "0" diye yazıyordu: backend xG/gol alanlarını
/// BİLEREK null döndürürken ekran "xG 0 – 1.4" gösteriyor, yani BİLİNMEYEN
/// değeri SIFIR gibi sunuyordu. Bilinmeyen sayı YAZILMAZ.
String? num1(Object? v) {
  if (v == null || v == '') return null;
  final n = v is num ? v : num.tryParse('$v');
  if (n == null || !n.isFinite) return null;
  return n == n.roundToDouble() ? '${n.toInt()}' : n.toStringAsFixed(1);
}

String fmtClock(Object? iso) {
  // TÜRKİYE saati (bkz. utils.trAlanlari).
  final d = trAlanlari(iso);
  if (d == null) return '';
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(d.hour)}:${p(d.minute)}';
}

/// Radar 5 yüzdeleri BİR ONDALIK basamakla gösterilir. Tam sayıya yuvarlamak
/// yeni bir sonucun getirdiği değişimi gizleyebiliyordu (%19.4 → %19.7 ikisi de
/// 19 görünüyordu).
Map<String, String>? birOndalik(Map? p) {
  if (p == null) return null;
  String f(Object? v) {
    final n = v is num ? v : num.tryParse('$v');
    return (n ?? 0).toStringAsFixed(1);
  }

  return {'1': f(p['1']), 'X': f(p['X']), '2': f(p['2'])};
}

typedef ClassCounts = ({
  int strong,
  int medium,
  int surprise,
  int insufficient,
});

/// Sınıf sayaçları — filtre çiplerindeki (3) rakamları.
ClassCounts classCountsOf(List? matches) {
  var strong = 0, medium = 0, surprise = 0, insufficient = 0;
  for (final raw in matches ?? const []) {
    final k = ((raw as Map)['master'] as Map?)?['classification'];
    if (k == 'strong_candidate') {
      strong++;
    } else if (k == 'surprise_candidate') {
      surprise++;
    } else if (k == 'insufficient_data') {
      insufficient++;
    } else {
      medium++;
    }
  }
  return (
    strong: strong,
    medium: medium,
    surprise: surprise,
    insufficient: insufficient,
  );
}

/// Master listesi filtresi. Bilinmeyen filtre TÜMÜ demektir (liste boşalmaz).
List<Map> filterMaster(List? matches, String? filter) {
  num say(Object? v) => v is num ? v : (num.tryParse('$v') ?? 0);
  return (matches ?? const []).cast<Map>().where((mm) {
    final master = mm['master'] as Map?;
    final c = master?['classification'];
    switch (filter) {
      case 'strong':
        return c == 'strong_candidate';
      case 'medium':
        return c == 'medium_risk';
      case 'surprise':
        return c == 'surprise_candidate';
      case 'insufficient':
        return c == 'insufficient_data';
      case 'drawRisk':
        return say((master?['scores'] as Map?)?['draw']) >= 30;
      case 'awaySurprise':
        return (master?['favorite'] as Map?)?['symbol'] == '1' &&
            say(master?['favoriteFailureRisk']) >= 55 &&
            master?['exactDirection'] == '2';
      default:
        return true;
    }
  }).toList();
}

/// Sıralama. VARSAYILAN Spor Toto sırasıdır (no 1→15) — kullanıcı bülteni o
/// sırayla görür, listeyi riske göre karıştırmak kupon doldurmayı zorlaştırır.
/// 'risk' modunda riski OLMAYAN maç -1 sayılır ve sona düşer; eşitlikte yine no
/// sırası (kararlı sıralama).
List<Map> sortMaster(List? matches, String? sortMode) {
  num no(Map m) => m['no'] is num ? m['no'] as num : 0;
  num risk(Map m) {
    final v = (m['master'] as Map?)?['favoriteFailureRisk'];
    return v is num ? v : -1;
  }

  final liste = (matches ?? const []).cast<Map>().toList();
  liste.sort((a, b) {
    if (sortMode == 'order') return no(a).compareTo(no(b));
    final c = risk(b).compareTo(risk(a));
    return c != 0 ? c : no(a).compareTo(no(b));
  });
  return liste;
}

/// Mühürlenmeye kalan dakika. Yalnız GÜNCEL ve henüz mühürlenmemiş haftada
/// anlamlıdır; geçmiş bir zaman için null döner (negatif dakika gösterilmez).
int? freezeMinutes(Map? meta, DateTime now) {
  if (meta == null ||
      meta['current'] != true ||
      meta['sealed'] == true ||
      meta['frozenAt'] != null ||
      meta['freezeAt'] == null) {
    return null;
  }
  final t = DateTime.tryParse('${meta['freezeAt']}')?.toLocal();
  if (t == null) return null;
  final ms = t.difference(now).inMilliseconds;
  return ms > 0 ? (ms / 60000).ceil() : null;
}

typedef LegacyCounts = ({int red, int yellow, int green});

/// Legacy (eski sürpriz radarı) sayaç + filtre.
LegacyCounts legacyCountsOf(List? radar) {
  var red = 0, yellow = 0, green = 0;
  for (final raw in radar ?? const []) {
    switch ((raw as Map)['labelColor']) {
      case 'red':
        red++;
      case 'yellow':
        yellow++;
      case 'green':
        green++;
    }
  }
  return (red: red, yellow: yellow, green: green);
}

List<Map> legacyFiltered(List? radar, String? legacyFilter) {
  final liste = (radar ?? const []).cast<Map>();
  if (legacyFilter == null || legacyFilter.isEmpty) return liste.toList();
  return liste.where((r) => r['labelColor'] == legacyFilter).toList();
}

// DÖNEM BAŞARISI / EĞİLİM HESAPLARI KALDIRILDI (kullanıcı kararı, 3 Ağustos
// 2026: "kafa karıştırıyor"). Kaynaktaki üç işlev yalnız o göstergeyi
// besliyordu ve gösterge kalkınca ölü koda dönüp silindi. Dönem çipleri
// FİLTRE olarak duruyor (kDnaPeriods).
