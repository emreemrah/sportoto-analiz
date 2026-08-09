// KAYNAK: app/src/services/masterAnalysisService.js — BİREBİR çeviri.
//
// MASTER ANALİZ istemcisi — kriter hesabının TEK DOĞRULUK KAYNAĞI backend'dir.
// Bu servis isteği yapar, hesaplanmış sonucu getirir ve kısa süre önbelleğe
// alır (aynı maç için tekrar hesap istenmez).
//
// SUNUCUYA ULAŞILAMAZSA null DÖNER. Kaynağın notu şunu diyordu: "ekran
// çevrimdışı — yerel hızlı görünüm notuyla mevcut yerel motoru gösterir".
// O YEREL MOTOR 7 Ağustos 2026'da KALDIRILDI (bkz. proje CLAUDE.md: "TEK MOTOR
// VAR"). Bugün null dönmesi "analiz gösterme" demektir — cihazda kriter hesabı
// YAPILMAZ. İki motor iki farklı cevap verir ve bu sessiz bir hatadır.

import '../network/api_client.dart';

const Duration _ttl = Duration(minutes: 1);

final Map<String, ({DateTime at, dynamic val})> _cache = {};

/// Kaynaktaki `profileKey`.
///
/// KULLANICI PROFİLİ KALDIRILDI (2026-08-07, kullanıcı kararı): analiz artık
/// HER ZAMAN resmî profille hesaplanır. Profil her zaman null gönderilir →
/// backend `buildOfficialProfile()` kullanır. İmza korundu ki ileride bir
/// profil gerekirse anahtar üretimi hazır olsun.
String _profileKey(Map? p) {
  final id = p?['id'] ?? 'none';
  final version = p?['version'] ?? 0;
  final mode = p?['mode'] ?? 'manual';
  final filters = p?['globalFilters'];
  return '$id@v$version:$mode:${filters ?? '{}'}';
}

Map<String, dynamic> _payloadOf(Map? profile) => {
  'profile': profile == null
      ? null
      : {
          'id': profile['id'] ?? 'local',
          'name': profile['name'],
          'version': profile['version'],
          'mode': profile['mode'] ?? 'manual',
          'globalFilters': profile['globalFilters'],
          'criteria': profile['criteria'] ?? {},
        },
};

/// Tek maç Master Analizi (güncel bülten).
/// Dönen: `{ match: { master, ... } }` ya da çevrimdışıysa null.
Future<Map<String, dynamic>?> calculateMatchMaster(
  Object no, [
  Map? profile,
]) async {
  final key = 'm:$no:${_profileKey(profile)}';
  final hit = _cache[key];
  if (hit != null && DateTime.now().difference(hit.at) < _ttl) {
    return hit.val as Map<String, dynamic>?;
  }
  try {
    final res = await api.archivePost(
      '/api/analysis/matches/$no/calculate',
      _payloadOf(profile),
    );
    final val = res is Map ? Map<String, dynamic>.from(res) : null;
    _cache[key] = (at: DateTime.now(), val: val);
    return val;
  } catch (_) {
    return null; // çevrimdışı/eski sunucu — çağıran analizi HİÇ göstermez
  }
}

/// Bülten geneli (15 maç) Master Analizi — güncel veya MÜHÜRLÜ hafta.
Future<Map<String, dynamic>?> calculateBulletinMaster(
  Object bulletinId, [
  Map? profile,
]) async {
  final key = 'b:$bulletinId:${_profileKey(profile)}';
  final hit = _cache[key];
  if (hit != null && DateTime.now().difference(hit.at) < _ttl) {
    return hit.val as Map<String, dynamic>?;
  }
  try {
    final res = await api.archivePost(
      '/api/analysis/bulletins/$bulletinId/calculate',
      _payloadOf(profile),
    );
    final val = res is Map ? Map<String, dynamic>.from(res) : null;
    _cache[key] = (at: DateTime.now(), val: val);
    return val;
  } catch (_) {
    return null;
  }
}

/// Resmî Sistem Master Analizi (mühürlü haftada snapshot'tan).
Future<Map<String, dynamic>?> getOfficialAnalysis(Object bulletinId) async {
  try {
    final d = await api.analysisOfficial(bulletinId);
    return d is Map ? Map<String, dynamic>.from(d) : null;
  } catch (_) {
    return null;
  }
}

typedef CriteriaScorecardIndex = ({String? note, Map<String, dynamic>? byKey});

/// Kriter karnesi (yeni motor) — ekran rozetleri için `{ key: satır }` indeksi.
Future<CriteriaScorecardIndex> getCriteriaScorecardIndex() async {
  try {
    final d = await api.analysisCriteriaScorecard();
    if (d is! Map || d['criteria'] is! List) {
      return (note: d is Map ? d['note'] as String? : null, byKey: null);
    }
    final list = (d['criteria'] as List).cast<Map>();
    return (
      note: d['note'] as String?,
      byKey: {for (final c in list) '${c['key']}': c},
    );
  } catch (_) {
    return (note: null, byKey: null);
  }
}

/// Backend katalog metası (veri var/yok + açıklamalar + aileler).
Future<Map<String, dynamic>?> getCriteriaCatalog() async {
  try {
    final d = await api.analysisCriteria();
    return d is Map ? Map<String, dynamic>.from(d) : null;
  } catch (_) {
    return null;
  }
}

/// Testler için önbellek temizleme (kaynaktaki
/// `_clearMasterAnalysisCacheForTests`).
void clearMasterAnalysisCacheForTests() => _cache.clear();
