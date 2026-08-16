// KAYNAK: app/src/notifications.js — BİREBİR çeviri.
//
// BİLDİRİM MERKEZİ — SAF MODÜL (cihaz bağımlılığı YOK, test edilebilir).
//
// AMAÇ: Kullanıcının kaçırdığı GERÇEK olayları tek yerde toplamak:
//   • yeni bülten yayınlandı
//   • takip ettiği maç birazdan başlıyor
//   • resmî sonuçlar açıklandı / hafta kapandı
//
// KESİN KURALLAR (bu dosyanın var oluş şartı):
//  1) Hiçbir bildirim UYDURULMAZ. Her satırın arkasında gerçek bir veri olmalı;
//     veri yoksa satır hiç üretilmez (boş liste dürüst sonuçtur).
//  2) Yalnız RESMÎ sonuç "sonuçlandı" sayılır (hem `result` hem `score`).
//     Canlı/geçici skor bildirime "sonuç açıklandı" diye yazılmaz.
//  3) İddialı dil yok: "kesin/garanti/banko/yanılmaz" geçmez. Bildirimler
//     kupon oynamaya teşvik etmez; yalnız olup biteni haber verir.
//  4) Puan/başarı YALNIZ sunucudan gelen `progress` ile karşılaştırılır.
//     (Oyunlaştırma 2026-08-06'da söküldü; parametre geriye uyum için durur.)
//  5) Kimliği belirleyen alan yok — bildirim metninde e-posta, telefon,
//     belirteç veya başka kullanıcının verisi bulunmaz.

import 'utils.dart';

/// Resmî sonuç kuralı: hem 1/X/2 hem skor gelmiş olmalı.
///
/// JS'te `!!(m.result && m.score)` — boş dizge de FALSY sayılır.
bool isOfficial(Map? m) {
  if (m == null) return false;
  final r = m['result'];
  final s = m['score'];
  final rDolu = r != null && r != false && '$r'.isNotEmpty && r != 0;
  final sDolu = s != null && s != false;
  return rDolu && sDolu;
}

/// Maç saatini GERÇEK ana çevirir.
///
/// Bülten saati saat dilimi EKSİZ Türkiye duvar saatidir. Ham `DateTime.parse`
/// bunu CİHAZIN saatinde yorumlar; cihaz TSİ değilse bildirim YANLIŞ ANDA
/// çalardı (ofset kadar erken/geç). Tek tanım: utils.macAni.
int? _toTime(Object? v) => macAni(v)?.millisecondsSinceEpoch;

String _saatMetni(int ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms).toLocal();
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(d.hour)}:${p(d.minute)}';
}

/// Kupon deposundaki son sürümün seçimleri (yoksa boş dizi).
List _couponSelections(Map? coupon) {
  final versions = coupon?['versions'];
  if (versions is! List || versions.isEmpty) return const [];
  Map? son;
  for (final v in versions) {
    if ((v as Map)['id'] == coupon!['finalVersionId']) {
      son = v;
      break;
    }
  }
  son ??= versions.last as Map;
  final sec = son['selections'];
  return sec is List ? sec : const [];
}

/// Kullanıcının o haftaki tüm kuponlarında işaretlediği maç numaraları.
/// `push_planner.dart` de aynı kuralı kullanır (kupon çözümlemesi tek yerde
/// kalsın diye kopyalanmadı, dışa açıldı).
Set<int> seciliMacNolari(List? coupons) {
  final set = <int>{};
  for (final c in coupons ?? const []) {
    for (final s in _couponSelections(c as Map?)) {
      if (s is! Map) continue;
      final no = s['no'];
      final sec = s['selectedOutcomes'];
      if (no != null && sec is List && sec.isNotEmpty) {
        final n = int.tryParse('$no');
        if (n != null) set.add(n);
      }
    }
  }
  return set;
}

/// 1 saat içinde başlayacaklar
const int _basliyorPencereMs = 60 * 60 * 1000;

// Bülten `round` alanı GERÇEK API'de METİNDİR (hafta adı). Bazı çağrı yerleri
// nesne verebildiği için iki biçim de güvenle okunur.
Object? _haftaKimlik(Map? bulletin) {
  if (bulletin?['roundId'] != null) return bulletin!['roundId'];
  final r = bulletin?['round'];
  if (r is Map && r['id'] != null) return r['id'];
  return null;
}

String? _haftaAdi(Map? bulletin) {
  final r = bulletin?['round'];
  if (r is String && r.trim().isNotEmpty) return r.trim();
  if (r is Map && r['name'] != null) return '${r['name']}';
  return null;
}

typedef NotifTarget = ({
  String tab,
  String? screen,
  Map<String, dynamic>? params,
});
typedef NotifItem = ({
  String id,
  String kind,
  String icon,
  String title,
  String body,
  int at,
  NotifTarget target,
});

/// Gerçek verilerden bildirim listesi üretir.
({List<NotifItem> items, int unread}) buildNotifications({
  int now = 0,
  Map? bulletin,
  Map? history,
  List? coupons,
  Map? progress,
  Map? state,
}) {
  final items = <NotifItem>[];
  final gorulen = <String>{
    for (final d in (state?['dismissed'] as List?) ?? const []) '$d',
  };
  final bilinenHaftalar = <String>{
    for (final r in (state?['knownRoundIds'] as List?) ?? const []) '$r',
  };

  void ekle(NotifItem o) {
    if (o.id.isEmpty || gorulen.contains(o.id)) return;
    items.add(o);
  }

  // 1) YENİ BÜLTEN — daha önce görülmemiş bir hafta kimliği geldiyse.
  //    `bilinenHaftalar` BOŞSA hiç bildirim üretilmez: ilk açılışta geçmişe
  //    dönük bildirim yağmuru olmasın diye.
  final gRound = _haftaKimlik(bulletin);
  final gAd = _haftaAdi(bulletin);
  if (gRound != null &&
      bilinenHaftalar.isNotEmpty &&
      !bilinenHaftalar.contains('$gRound')) {
    final maclar = bulletin?['matches'];
    final sayi = maclar is List ? maclar.length : 0;
    ekle((
      id: 'round:$gRound',
      kind: 'new-round',
      icon: '🗓️',
      title: 'Yeni bülten yayında',
      body: sayi > 0
          ? '${gAd ?? 'Bu hafta'} · $sayi maç listelendi.'
          : '${gAd ?? 'Yeni hafta'} açıldı.',
      at: now,
      target: (tab: 'BulletinTab', screen: 'Bulletin', params: null),
    ));
  }

  // 2) BAŞLIYOR — YALNIZ kullanıcının kuponunda işaretlediği maçlar için ve
  //    yalnız gerçek başlama saati varsa. Saat yoksa bildirim üretilmez.
  final kuponMaclari = seciliMacNolari(coupons);
  final maclar = bulletin?['matches'];
  if (kuponMaclari.isNotEmpty && maclar is List) {
    for (final raw in maclar) {
      final m = raw as Map?;
      final no = int.tryParse('${m?['no']}');
      if (no == null || !kuponMaclari.contains(no)) continue;
      final t = _toTime(m?['date']);
      if (t == null) continue; // saat yoksa uydurma
      if (m?['status'] == 'finished' || isOfficial(m)) continue;
      final fark = t - now;
      if (fark <= 0 || fark > _basliyorPencereMs) continue;
      final ev = _ad(m?['home']);
      final dep = _ad(m?['away']);
      if (ev.isEmpty || dep.isEmpty) continue;
      ekle((
        id: 'start:$gRound:$no',
        kind: 'match-starting',
        icon: '⏰',
        title: 'Kuponundaki maç başlıyor',
        body: '$no. $ev – $dep · ${_saatMetni(t)}',
        at: t,
        target: (
          tab: 'BulletinTab',
          screen: 'LiveMatchDetail',
          params: {'no': no},
        ),
      ));
    }
  }

  // 3) RESMÎ SONUÇ — kapanan haftada kaç maç resmîleşti. Kısmî de olsa haber
  //    verilir ama sayı GERÇEKTİR; "hepsi bitti" denmez.
  final hMaclar = history?['matches'];
  if (hMaclar is List && hMaclar.isNotEmpty) {
    final toplam = hMaclar.length;
    final resmi = hMaclar.where((m) => isOfficial(m as Map?)).length;
    if (resmi > 0) {
      final tamam = resmi == toplam;
      ekle((
        id: 'official:${history!['roundId']}:$resmi',
        kind: 'result-official',
        icon: tamam ? '🏁' : '📣',
        title: tamam ? 'Hafta kapandı' : 'Resmî sonuçlar açıklanıyor',
        body:
            '${history['roundName'] ?? 'Geçen hafta'} · $resmi/$toplam maçın resmî sonucu geldi.',
        at: now,
        target: (
          tab: 'HomeTab',
          screen: 'WeekRecap',
          params: {'roundId': history['roundId']},
        ),
      ));
    }
  }

  // 4-5) PUAN ve BAŞARI bildirimleri KALDIRILDI (oyunlaştırma söküldü,
  //      kullanıcı kararı 2026-08-06). `progress` geriye uyum için kabul
  //      edilir ama artık hiçbir bildirim üretmez.

  // En yeni üstte; eşitlikte kararlı sıra (tür önceliği).
  const oncelik = {'match-starting': 0, 'result-official': 1, 'new-round': 2};
  items.sort((a, b) {
    final z = b.at.compareTo(a.at);
    if (z != 0) return z;
    return (oncelik[a.kind] ?? 9).compareTo(oncelik[b.kind] ?? 9);
  });

  final seenAtRaw = state?['seenAt'];
  final seenAt = seenAtRaw is num ? seenAtRaw.toInt() : 0;
  final unread = items.where((i) => i.at > seenAt).length;
  return (items: items, unread: unread);
}

String _ad(Object? t) {
  if (t is String) return t;
  if (t is Map) return '${t['name'] ?? ''}';
  return '';
}

/// Bildirimler okunduktan sonra saklanacak yeni durum.
/// Not: `dismissed` sınırsız büyümesin diye son 200 kimlikle sınırlanır.
Map<String, dynamic> nextState({
  int now = 0,
  Map? state,
  List<NotifItem> items = const [],
  Map? bulletin,
  Map? progress,
}) {
  final gRound = _haftaKimlik(bulletin);
  final haftalar = <String>{
    for (final r in (state?['knownRoundIds'] as List?) ?? const []) '$r',
  };
  if (gRound != null) haftalar.add('$gRound');

  final eski = (state?['dismissed'] as List?) ?? const [];
  final benzersiz = <String>{
    for (final e in eski) '$e',
    for (final i in items) i.id,
  }.toList();
  final son200 = benzersiz.length > 200
      ? benzersiz.sublist(benzersiz.length - 200)
      : benzersiz;

  final haftaListe = haftalar.toList();
  final son24 = haftaListe.length > 24
      ? haftaListe.sublist(haftaListe.length - 24)
      : haftaListe;

  final puan = progress?['points'];
  return {
    'seenAt': now,
    'lastPoints': puan is num ? puan : state?['lastPoints'],
    'lastAchievements': [
      for (final a in (progress?['achievements'] as List?) ?? const [])
        if ((a as Map)['earned'] == true && a['key'] != null) a['key'],
    ],
    'knownRoundIds': son24,
    'dismissed': son200,
  };
}

/// İlk açılışta geçmişe dönük bildirim yağmuru olmasın diye başlangıç durumu.
Map<String, dynamic> seedState({int now = 0, Map? bulletin, Map? progress}) =>
    nextState(
      now: now,
      state: const {},
      bulletin: bulletin,
      progress: progress,
    );
