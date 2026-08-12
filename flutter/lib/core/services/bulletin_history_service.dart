// KAYNAK: app/src/services/bulletinHistoryService.js +
//         app/src/services/analysisSnapshotService.js + app/src/demoGate.js
//
// Bülten geçmişi ve mühürlü analiz servis katmanı — GERÇEK backend arşivine
// bağlıdır. Veri kaynağı: /api/bulletins (kalıcı arşiv + değişmez snapshot
// motoru).
//
// ÜRETİMDE MOCK'A DÜŞME YASAĞI (dürüstlük kuralı):
// Arşive ulaşılamamak NORMAL bir üretim olayıdır (backend yeniden başlar,
// kullanıcı çevrimdışıdır). Eskiden bu durumda örnek bültenler dönüyordu ve
// bunların resultSummary'si UYDURMA bir systemAccuracy (% başarı oranı)
// taşıyordu. "Demo, rastgele veya uydurma kupon, maliyet, başarı oranı ve
// sonuç üretilmemeli" kuralı bunu yasaklar; DEMO bandı basmak da yetmez,
// çünkü kural sayıyı ETİKETLEMEYİ değil ÜRETMEYİ yasaklıyor. Doğru davranış
// projenin kendi ilkesidir: "Veri yoksa 'Bu veri bulunamadı' yaz."
//
// ────────────────────────────────────────────────────────────────────────────
// ÇEVİRİDE BİLİNÇLİ TEK FARK — DEMO KAPISI DAİMA KAPALI
//
// Kaynakta `demoDataAllowed()` geliştirme derlemesinde AÇIKTIR ve arşive
// ulaşılamayınca 826 satırlık örnek bülten/snapshot yığınından liste üretir.
// Burada kapı SABİT KAPALIDIR:
//
//   • Yayın derlemesinde davranış ZATEN BİREBİR AYNI (kaynakta da kapalı).
//   • Geliştirme derlemesinde fark şu: örnek bülten yerine dürüst hata +
//     "Tekrar dene" görünür. Yani sapma yalnız daha DÜRÜST yöne.
//   • Örnek veri yığını çevrilseydi, uygulama paketine hiçbir yayın
//     derlemesinde okunmayacak uydurma başarı oranları girecekti.
//
// Kapı geri açılmak istenirse tek yer burasıdır (`_demoDataAllowed`).

import 'package:flutter/foundation.dart';

import '../types/bulletin.dart';
import 'archive_client.dart';
import 'archive_mappers.dart';

/// DEMO/ÖRNEK VERİ KAPISI — tek kaynak. Yukarıdaki nota bak: daima kapalı.
bool _demoDataAllowed() => false;

/// Gerçek arşiv id'leri sayısaldır (roundId); mock id'ler 'b27' gibidir.
bool _isArchiveId(Object? id) => RegExp(r'^\d+$').hasMatch('$id');

/* ------------------------------------------------------------------ */
/* GERÇEK VERİ YOLU (backend arşivi)                                   */
/* ------------------------------------------------------------------ */

Future<List<Map<String, dynamic>>> _listBulletinsFromApi() async {
  final res = await archiveGet('/api/bulletins');
  final list = (res is Map ? res['bulletins'] as List? : null) ?? const [];
  final items = [for (final b in list) mapBulletinSummary(b as Map)];
  // En güncel en üstte.
  items.sort((a, b) => _sayi(b['roundId']).compareTo(_sayi(a['roundId'])));
  return items;
}

int _sayi(Object? v) => v is num ? v.toInt() : 0;

Future<Map<String, dynamic>> _getBulletinFromApi(Object id) async {
  final res = await archiveGet('/api/bulletins/$id');
  return mapBulletinDetail(res as Map);
}

/* ------------------------------------------------------------------ */
/* DIŞA AÇIK API                                                       */
/* ------------------------------------------------------------------ */

/// Tüm geçmiş: en güncel en üstte. Backend arşivi esastır; arşiv BOŞSA boş
/// liste döner. Arşive ULAŞILAMAZSA hata dürüstçe yukarı verilir — ekran
/// "Tekrar dene" gösterir, uydurma bülten/başarı oranı ÜRETİLMEZ.
Future<List<Map<String, dynamic>>> listBulletins() async {
  try {
    return await _listBulletinsFromApi();
  } catch (e) {
    if (!_demoDataAllowed()) rethrow;
    // Kapı kapalı olduğu için buraya ASLA gelinmez; kaynaktaki dalın yeri
    // korunuyor ki kapı açıldığında ne yapılacağı belli olsun.
    debugPrint('[bulletinHistory] arşiv API alınamadı: $e');
    rethrow;
  }
}

Future<Map<String, dynamic>?> getBulletinById(Object id) async {
  if (!_isArchiveId(id)) {
    // 'b27' gibi id'ler YALNIZ demo veridir. Üretimde böyle bir id'ye
    // (eski kısayol, derin bağlantı, kalıntı durum) hiç ulaşılmamalı;
    // ulaşılırsa örnek bülten uydurmak yerine dürüstçe "bulunamadı" denir.
    throw Exception('Bu bülten arşivde bulunamadı.');
  }
  return _getBulletinFromApi(id);
}

/// Bir maçın (tek) durumunu bültenden bağımsız sorgulamak için.
Future<Map<String, dynamic>?> getMatchById(
  Object bulletinId,
  Object matchId,
) async {
  final bulletin = await getBulletinById(bulletinId);
  for (final m in (bulletin?['matches'] as List?) ?? const []) {
    if ((m as Map)['id'] == matchId) return m.cast<String, dynamic>();
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* MÜHÜRLÜ ANALİZ (snapshot)                                           */
/*                                                                     */
/* Kritik kural SUNUCUDA uygulanır: bültenin ilk maçından 5 dk önce    */
/* snapshot kilitlenir ve bir daha DEĞİŞMEZ (DB trigger + servis +     */
/* API). Bu katman kilitli snapshot'ı YALNIZ OKUR; geçmiş bülten       */
/* açıldığında güncel takım verisiyle yeniden hesap YAPMAZ.            */
/* ------------------------------------------------------------------ */

Future<Map<String, dynamic>?> getSnapshot(Object bulletinId) async {
  if (!_isArchiveId(bulletinId)) return null;

  Map? apiSnap;
  try {
    apiSnap = await archiveGet('/api/bulletins/$bulletinId/snapshot') as Map?;
  } catch (_) {
    // 404 = henüz kilitlenmedi (aktif bülten) → snapshot yok; bu bir HATA
    // değildir, bu yüzden yukarı taşınmaz.
    return null;
  }

  // Sonuçlar/değerlendirme AYRI kayıtlardır; snapshot payload'ına yazılmaz,
  // yalnız görünümde yan yana getirilir. Alınamazsa snapshot sonuçsuz
  // gösterilir — "sonuç yok" demek, yanlış sonuç göstermekten iyidir.
  var resultsByMatchId = <String, dynamic>{};
  var evalByMatchId = <String, dynamic>{};
  try {
    resultsByMatchId = indexResults(
      await archiveGet('/api/bulletins/$bulletinId/results'),
    );
  } catch (_) {
    resultsByMatchId = {};
  }
  try {
    evalByMatchId = indexEvaluation(
      await archiveGet('/api/bulletins/$bulletinId/evaluation'),
    );
  } catch (_) {
    evalByMatchId = {};
  }

  return mapSnapshot(
    apiSnap,
    resultsByMatchId: resultsByMatchId,
    evalByMatchId: evalByMatchId,
  );
}

Future<Map<String, dynamic>?> getMatchAnalysis(
  Object bulletinId,
  Object matchId,
) async {
  final snap = await getSnapshot(bulletinId);
  for (final m in (snap?['matchesAnalysis'] as List?) ?? const []) {
    if ('${(m as Map)['matchId']}' == '$matchId') {
      return m.cast<String, dynamic>();
    }
  }
  return null;
}

/// DEĞİŞMEZLİK: gerçek arşivde kilitli snapshot İSTEMCİDEN DE, SUNUCUDAN DA
/// düzenlenemez.
Future<Never> updateMatchAnalysis(
  Object bulletinId,
  Object matchId,
  Map patch,
) async {
  throw Exception(
    'Mühürlü Analiz: bu bültenin snapshot’ı sunucuda kilitlidir ve hiçbir '
    'şekilde değiştirilemez.',
  );
}

Future<bool> isSnapshotLocked(Object bulletinId) async {
  final snap = await getSnapshot(bulletinId);
  return snap != null && snap['isLocked'] == true;
}

/* ------------------------------------------------------------------ */
/* KİLİTLİ BÜLTEN KORUMASI                                             */
/*                                                                     */
/* GERÇEK sistemde bu koruma BACKEND'dedir: kilitli snapshot            */
/* update/delete edilemez (DB trigger + servis katmanı), maç kimlikleri */
/* değişemez, reddedilen denemeler snapshot_audit_log'a yazılır.        */
/* Aşağıdaki saf kural istemcide de aynı kararı verebilmek için durur.  */
/* ------------------------------------------------------------------ */

bool isLockedForMatches(Map bulletin, [DateTime? now]) {
  final s = bulletin['status'];
  if (s == BulletinStatus.locked ||
      s == BulletinStatus.completed ||
      s == BulletinStatus.cancelled) {
    return true;
  }
  return isPastFirstMatch(bulletin, now);
}
