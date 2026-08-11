// MÜHÜRLÜ SİSTEM SEÇİMİ — geçmiş ekranların TEK sistem kaynağı.
//
// SORUN (2026-08-11, kullanıcı bulgusu): Hafta Kapanışı ve Başarı Paneli,
// sistem seçimini `/api/history/:roundId` yanıtındaki `prediction` alanından
// okuyordu. O alan sunucuda ŞÖYLE üretiliyor (backend/src/server.js):
//
//     const snap = load(`snapshot-${roundId}`)?.data;      // CACHE dosyası
//     if (p.symbol) merged.prediction = { symbol: p.symbol, label: p.label };
//
// Yani kaynak, arşivdeki DEĞİŞTİRİLEMEZ mühür değil, sunucunun cache
// klasöründeki bir dosyadır. O dosya silinir/eskirse ya da o maç için pick
// taşımıyorsa, `prediction` GÜNCEL bültenin canlı analizinden gelir. Sonuç:
// geçmiş bir hafta, bugünkü analizle anlatılır ve sistem sonradan kazanmış
// gibi görünebilir. Kupon düellosunda bu, kullanıcıya haksızlıktır.
//
// ÇÖZÜM: geçmiş ekranlar yalnız arşiv mührünü okur —
// `/api/bulletins/:id/snapshot` → `payload.matches[].systemPrediction`.
// Bu kayıt haftanın kilit anında (ilk maçtan 5 dk önce) alınır, sunucuda
// DB trigger + servis + API katmanlarıyla değiştirilemez (immutable) ve
// doğrulama karması (verificationHash) taşır.
//
// MÜHÜR YOKSA UYDURULMAZ: o maç sistem başarısına girmez, ekranda
// "Sistem tahmin kaydı doğrulanamadı" yazar ve sistem KAZANMIŞ gösterilmez.

import 'archive_client.dart';

/// Bir haftanın mühürlü sistem seçimleri.
class MuhurluSistem {
  const MuhurluSistem({
    this.secimler = const {},
    this.macKimlikleri = const {},
    this.muhurVar = false,
    this.kilitZamani,
    this.dogrulamaKodu,
    this.gecKilit = false,
    this.snapshotId,
    this.yontemSurumu,
  });

  /// Mühür hiç okunamadı (aktif hafta, eski sunucu, ağ hatası).
  static const yok = MuhurluSistem();

  /// maç no → mühürlü sistem seçimi ('1' | 'X' | '2' | '10' | '12' | '02' …).
  /// Mühürde tahmin taşımayan maç bu haritada HİÇ bulunmaz.
  final Map<int, String> secimler;

  /// maç no → arşiv maç kimliği (karar izi sorgusu bunu ister).
  final Map<int, String> macKimlikleri;

  /// Mühür kimliği ve analiz sürümü — karar izinde kaynak gösterilir.
  final String? snapshotId;
  final String? yontemSurumu;

  /// Arşivde kilitli snapshot bulundu mu? false ise hiçbir maç için sistem
  /// seçimi İDDİA EDİLMEZ.
  final bool muhurVar;

  final String? kilitZamani;
  final String? dogrulamaKodu;

  /// Mühür ilk maç başladıktan SONRA alınmışsa sunucu `late` işaretler.
  /// Böyle bir kayıt "kilit öncesi biliyordu" kanıtı sayılmaz.
  final bool gecKilit;

  /// Kilit ÖNCESİ mühürlenmiş, güvenilir kayıt mı?
  bool get guvenilir => muhurVar && !gecKilit;

  /// Maçın mühürlü sistem seçimi; yoksa null (— "tahmin yok" demektir,
  /// "yanlış" değil).
  String? secim(Object? no) {
    if (!guvenilir) return null;
    final n = int.tryParse('$no');
    return n == null ? null : secimler[n];
  }
}

/// SİSTEM KARAR İZİ — bir maçta sistem tahmininin DEĞİŞTİĞİ anlar.
///
/// Kaynak: `/api/bulletins/:id/observations?matchId=…`. Sunucu her yenilemede
/// o maç için tahmini, 1/X/2 olasılıklarını ve oranları zaman damgasıyla
/// yazar (53. Hafta 15. maçta 293 gözlem). Bu kayıt geçmişe dönük
/// değiştirilmez, dolayısıyla "sistem ne zaman ne dedi" KANITLANABİLİR.
///
/// UYDURMA YOK: kriter bazlı öncesi/sonrası bu seride TUTULMUYOR — yalnız
/// tahmin, olasılık, oran ve xG özeti var. Ekran da yalnız bunları gösterir.
class KararDegisimi {
  const KararDegisimi({
    required this.zaman,
    required this.eski,
    required this.yeni,
    this.eskiOlasilik,
    this.yeniOlasilik,
    this.eskiOran,
    this.yeniOran,
  });

  final String zaman;
  final String eski;
  final String yeni;

  /// {'1': 40, 'X': 30, '2': 30} — kayıtta yoksa null.
  final Map<String, num>? eskiOlasilik;
  final Map<String, num>? yeniOlasilik;

  /// {'home': 2.33, 'draw': 3.15, 'away': 3.06}
  final Map<String, num>? eskiOran;
  final Map<String, num>? yeniOran;
}

/// Bir maçın karar izi.
class KararIzi {
  const KararIzi({
    this.degisimler = const [],
    this.gozlemSayisi = 0,
    this.ilkKayit,
    this.sonKayit,
    this.ilkTahmin,
    this.kayitVar = false,
  });

  static const yok = KararIzi();

  final List<KararDegisimi> degisimler;
  final int gozlemSayisi;
  final String? ilkKayit;
  final String? sonKayit;

  /// Seride görülen İLK tahmin — zaman sorgusunun başlangıç değeri.
  final String? ilkTahmin;

  /// Sunucuda gözlem serisi bulundu mu? false ise "kayıt yok" denir,
  /// değişiklik olmadığı İDDİA EDİLMEZ.
  final bool kayitVar;

  /// VERİLEN ANDA sistem ne diyordu? Kullanıcının kuponu açtığı saatte
  /// sistemin ne önerdiğini KANITLA söylemek için (2026-08-11 kullanıcı
  /// isteği). Kayıt yoksa ya da o an serinin başlangıcından önceyse null —
  /// tahmin yürütülmez.
  String? zamandakiTahmin(DateTime? an) {
    if (!kayitVar || an == null) return null;
    final ilk = DateTime.tryParse(ilkKayit ?? '');
    if (ilk == null || an.isBefore(ilk)) return null;
    var gecerli = ilkTahmin;
    for (final d in degisimler) {
      final t = DateTime.tryParse(d.zaman);
      if (t == null || t.isAfter(an)) break;
      gecerli = d.yeni;
    }
    return gecerli;
  }
}

/// Tahmin dizgesini karşılaştırılabilir hâle getirir: '10' ile '01' aynıdır,
/// '0' beraberlik demektir → 'X'.
String? normalTahmin(Object? v) {
  final s = '${v ?? ''}'.toUpperCase().trim();
  if (s.isEmpty || s == '-' || s == '—') return null;
  final harfler = s
      .split('')
      .map((c) => c == '0' ? 'X' : c)
      .where('1X2'.contains)
      .toSet();
  if (harfler.isEmpty) return null;
  // Sabit sıra: 1 → X → 2 (ekranda da bu sırayla okunur).
  return ['1', 'X', '2'].where(harfler.contains).join();
}

/// Ekranda okunan biçim: '1X' → '1-X'.
String tahminYazisi(String? t) => t == null ? '—' : t.split('').join('-');

Map<String, num>? _olasilik(Object? v) {
  if (v is! Map) return null;
  final out = <String, num>{};
  for (final k in const ['1', 'X', '2']) {
    final ham = v[k] ?? (k == 'X' ? v['0'] : null);
    if (ham is num) out[k] = ham;
  }
  return out.length == 3 ? out : null;
}

Map<String, num>? _oran(Object? v) {
  if (v is! Map) return null;
  final out = <String, num>{};
  for (final k in const ['home', 'draw', 'away']) {
    if (v[k] is num) out[k] = v[k] as num;
  }
  return out.length == 3 ? out : null;
}

/// AKTİF (kilitlenmemiş) hafta için maç no → arşiv maç kimliği.
///
/// Mühür yalnız kilitten sonra oluşur; kilit öncesi karar izini sorgulamak
/// için kimlik `/api/bulletins/:id` kaydından okunur (orderNo + matchId).
/// Canlı bülten yanıtı bu kimliği TAŞIMAZ — bu yüzden ayrı çağrı gerekir.
Future<Map<int, String>> arsivMacKimlikleri(Object? roundId) async {
  if (roundId == null) return const {};
  Map? d;
  try {
    d = await archiveGet('/api/bulletins/$roundId') as Map?;
  } catch (_) {
    return const {};
  }
  final maclar = d?['matches'];
  if (maclar is! List) return const {};
  return {
    for (final m in maclar.whereType<Map>())
      if (int.tryParse('${m['orderNo']}') case final no?)
        if (m['matchId'] != null) no: '${m['matchId']}',
  };
}

/// Maçın karar izini çıkarır. Gözlem serisi yoksa `KararIzi.yok` döner.
Future<KararIzi> sistemKararIzi(Object? roundId, Object? matchId) async {
  if (roundId == null || matchId == null) return KararIzi.yok;
  Map? yanit;
  try {
    yanit =
        await archiveGet(
              '/api/bulletins/$roundId/observations?matchId=$matchId',
            )
            as Map?;
  } catch (_) {
    return KararIzi.yok;
  }
  final ham = yanit?['observations'];
  if (ham is! List || ham.isEmpty) return KararIzi.yok;

  // Zaman sırası garanti değil — kendimiz sıralarız.
  final kayitlar = ham.whereType<Map>().toList()
    ..sort((a, b) => '${a['observedAt']}'.compareTo('${b['observedAt']}'));

  final degisimler = <KararDegisimi>[];
  String? ilkTahmin;
  String? oncekiTahmin;
  Map<String, num>? oncekiOlasilik;
  Map<String, num>? oncekiOran;
  String? ilk;
  String? son;

  for (final k in kayitlar) {
    final ozet = k['statsSummary'];
    final tahmin = normalTahmin(ozet is Map ? ozet['prediction'] : null);
    // Tahminsiz gözlem (veri gelmemiş an) DEĞİŞİKLİK SAYILMAZ — yoksa her
    // yenileme arası "değişti" gibi görünür.
    if (tahmin == null) continue;
    final zaman = '${k['observedAt']}';
    ilk ??= zaman;
    ilkTahmin ??= tahmin;
    son = zaman;
    final olasilik = _olasilik(ozet is Map ? ozet['probabilities'] : null);
    final oran = _oran(k['odds']);
    if (oncekiTahmin != null && tahmin != oncekiTahmin) {
      degisimler.add(
        KararDegisimi(
          zaman: zaman,
          eski: oncekiTahmin,
          yeni: tahmin,
          eskiOlasilik: oncekiOlasilik,
          yeniOlasilik: olasilik,
          eskiOran: oncekiOran,
          yeniOran: oran,
        ),
      );
    }
    oncekiTahmin = tahmin;
    oncekiOlasilik = olasilik;
    oncekiOran = oran;
  }

  return KararIzi(
    degisimler: degisimler,
    gozlemSayisi: kayitlar.length,
    ilkKayit: ilk,
    sonKayit: son,
    ilkTahmin: ilkTahmin,
    kayitVar: true,
  );
}

/// Geçersiz/boş tahmin işaretleri — mühürde "veri yok" böyle görünür.
bool _bosTahmin(Object? v) {
  final s = '${v ?? ''}'.trim();
  return s.isEmpty || s == '-' || s == '—';
}

/// Haftanın mühürlü sistem seçimlerini arşivden okur.
///
/// 404 (henüz kilitlenmemiş aktif hafta) ve ağ hatası AYNI şekilde ele alınır:
/// `MuhurluSistem.yok` döner. Çağıran taraf bunu "mühür yok" olarak gösterir,
/// canlı analize DÜŞMEZ.
Future<MuhurluSistem> muhurluSistemSecimleri(Object? roundId) async {
  if (roundId == null) return MuhurluSistem.yok;
  Map? snap;
  try {
    snap = await archiveGet('/api/bulletins/$roundId/snapshot') as Map?;
  } catch (_) {
    return MuhurluSistem.yok;
  }
  if (snap == null) return MuhurluSistem.yok;

  final payload = snap['payload'];
  final maclar = payload is Map ? payload['matches'] : null;
  if (maclar is! List) return MuhurluSistem.yok;

  final secimler = <int, String>{};
  final kimlikler = <int, String>{};
  for (final m in maclar) {
    if (m is! Map) continue;
    final no = int.tryParse('${m['no']}');
    if (no == null) continue;
    final mid = m['matchId'];
    if (mid != null && '$mid'.isNotEmpty) kimlikler[no] = '$mid';
    final sp = m['systemPrediction'];
    if (sp is! Map) continue;
    // mapSnapshot ile aynı öncelik: display → symbol.
    final ham = !_bosTahmin(sp['display'])
        ? sp['display']
        : (!_bosTahmin(sp['symbol']) ? sp['symbol'] : null);
    if (ham == null) continue;
    secimler[no] = '$ham';
  }

  final engine = payload is Map ? payload['engine'] : null;
  return MuhurluSistem(
    secimler: secimler,
    macKimlikleri: kimlikler,
    muhurVar: true,
    kilitZamani: snap['lockedAt'] as String?,
    dogrulamaKodu: snap['verificationHash'] as String?,
    gecKilit: snap['late'] == true,
    snapshotId: snap['id'] as String?,
    yontemSurumu: engine is Map ? '${engine['version'] ?? ''}' : null,
  );
}
