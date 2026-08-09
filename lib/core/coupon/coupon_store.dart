// KAYNAK: app/src/coupon/store.js — BİREBİR çeviri.
//
// KUPON MERKEZİ DEPOSU (v2) — kupon sisteminin tek deposu.
// • Cihazda shared_preferences; girişli kullanıcıda /api/coupons üzerinden
//   hesaba bağlı kalıcıdır.
// • ESKİ kupon kayıtları (schema'sız sunucu kayıtları) bu depoya ASLA
//   karışmaz — yeni başarı sistemi yalnız schema:2 kuponları görür. Sunucudaki
//   eski kayıtlar silinmez, dokunulmadan geri yazılır.
// • Kayıt hatasında kupon YERELDE güvende kalır; durum `syncState` ile
//   görünür, `retrySync` ile elle tekrar denenir.
// • KİLİT MAÇ BAZINDADIR: her maç kendi başlangıcından 5 dk önce kilitlenir.
//   Kilitlenen maçın seçimi bir daha DEĞİŞEMEZ (lockMap doğrulaması) — yani
//   her tercih, ilgili maç başlamadan önce kaydedilmiş hâliyle donar ve
//   değerlendirme yalnız o hâliyle yapılır. Başlamamış maçlara hafta boyunca
//   kupon kurulabilir; GERİYE DÖNÜK BAŞARI ÜRETİLEMEZ.

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import '../session/session_state.dart';
import 'coupon_config.dart';

const String _key = 'sportoto.couponCenter.v1'; // eski anahtar OKUNMAZ
const String _dkey = 'sportoto.couponCenterDraft.v1';
const String _okey = 'sportoto.couponCenter.owner.v1';
const int _schema = 2;

List<Map<String, dynamic>> _cache = [];
Map<String, dynamic> _dcache = {'roundId': null, 'picks': <String, dynamic>{}};

/// Sunucudaki v1 kayıtlar — dokunulmaz, geri yazılır, GÖSTERİLMEZ.
List<Map<String, dynamic>> _serverLegacy = [];

SharedPreferences? _sp;

/// Değişiklikleri dinleyen ekranlar için (kaynaktaki `subscribeCoupons`).
final ValueNotifier<int> couponSurumu = ValueNotifier<int>(0);
void _emit() => couponSurumu.value++;

/// Giriş durumu oturum durumundan okunur (platformsuz tek doğruluk kaynağı).
///
/// KAYNAKTAKİ HATA NOTU: eski hâl localStorage'a bakıyordu; mobilde
/// localStorage yok, üretim web'inde belirteç HttpOnly çerezde — ikisinde de
/// her zaman false dönüyor ve kupon senkronu HİÇ çalışmıyordu.
bool _hasToken() {
  try {
    return isAuthenticated();
  } catch (_) {
    return false;
  }
}

/// Açılışta bir kez çağrılır (main.dart).
Future<void> couponStoreYukle() async {
  _sp = await SharedPreferences.getInstance();
  try {
    final raw = _sp!.getString(_key);
    if (raw != null) {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        _cache = decoded.cast<Map>().map(Map<String, dynamic>.from).toList();
      }
    }
  } catch (_) {
    _cache = [];
  }
  try {
    final raw = _sp!.getString(_dkey);
    if (raw != null) {
      final decoded = jsonDecode(raw);
      if (decoded is Map) _dcache = Map<String, dynamic>.from(decoded);
    }
  } catch (_) {
    /* bozuk taslak: boş başla */
  }
  _emit();
}

// ——— KULLANICI İZOLASYONU ———
//
// SORUN (kaynakta doğrulanmış): kupon anahtarları CİHAZA aitti, kullanıcıya
// değil. `logout()` yalnız belirteç/oturum kaydını siliyordu; kupon deposuna
// dokunmuyordu. Sonuç: A çıkış yapıp B girdiğinde B, A'nın kuponlarını
// GÖRÜYORDU — dahası ilk senkronda o kuponlar B'NİN HESABINA yazılıyordu.
//
// İKİ KATMANLI KORUMA:
//  1. `yereliTemizle()` — çıkışta çağrılır.
//  2. `sahibiAyarla(userId)` — girişte çağrılır; depoda BAŞKA bir sahip
//     yazılıysa veri silinir. Bu ikincisi, çıkışın hiç çalışmadığı durumları
//     da kapatır (uygulama öldürüldü, çökme, eski sürümden yükseltme).

String? _sahipOku() => _sp?.getString(_okey);

Future<void> _sahipYaz(String? id) async {
  if (_sp == null) return;
  if (id == null) {
    await _sp!.remove(_okey);
  } else {
    await _sp!.setString(_okey, id);
  }
}

/// Yerel kupon + taslak verisini TAMAMEN siler. Çıkışta çağrılır.
Future<void> yereliTemizle() async {
  _cache = [];
  _dcache = {'roundId': null, 'picks': <String, dynamic>{}};
  _serverLegacy = [];
  await _sp?.remove(_key);
  await _sp?.remove(_dkey);
  await _sahipYaz(null);
  _emit();
}

/// Oturum sahibini işaretler. Depoda BAŞKA bir sahip yazılıysa yerel veri
/// silinir — önceki kullanıcının kuponu yeni hesaba karışmaz.
///
/// Dönen: veri silindiyse true.
Future<bool> sahibiAyarla(Object? userId) async {
  final yeni = userId == null ? null : '$userId';
  final eski = _sahipOku();
  if (eski != null && yeni != null && eski != yeni) {
    await yereliTemizle();
    await _sahipYaz(yeni);
    return true;
  }
  await _sahipYaz(yeni);
  return false;
}

List<Map<String, dynamic>> _mergeById(List? a, List? b) {
  final map = <Object, Map<String, dynamic>>{};
  for (final raw in [...(a ?? const []), ...(b ?? const [])]) {
    if (raw is! Map) continue;
    final c = Map<String, dynamic>.from(raw);
    final id = c['id'];
    if (id == null) continue;
    final prev = map[id];
    if (prev == null ||
        '${c['updatedAt'] ?? ''}'.compareTo('${prev['updatedAt'] ?? ''}') >=
            0) {
      map[id] = c;
    }
  }
  return map.values.toList();
}

// ——— SENKRON: hata → kupon yerelde durur + Tekrar Dene ———

class SyncState {
  const SyncState({
    this.pending = false,
    this.error,
    this.lastOkAt,
    this.loggedIn = false,
  });

  final bool pending;
  final String? error;
  final String? lastOkAt;
  final bool loggedIn;
}

SyncState _syncState = const SyncState();
SyncState getSyncState() => SyncState(
  pending: _syncState.pending,
  error: _syncState.error,
  lastOkAt: _syncState.lastOkAt,
  loggedIn: _hasToken(),
);

/// [beklenenNesil]: yükleme hangi oturum ADINA başlatıldıysa o oturumun
/// nesli. `_persist` disk yazımında beklerken kullanıcı değişmiş olabilir;
/// bu durumda gövde (`_cache`) artık YENİ kullanıcının verisidir ama niyet
/// ESKİ kullanıcınındı — yükleme yapılmaz. Verilmezse (retrySync, ekran
/// tetiklemesi) "şu anki oturum adına" demektir.
Future<bool> _pushNow({int? beklenenNesil}) async {
  if (!_hasToken()) return false;
  // Gövde/cache okunmadan HEMEN ÖNCE doğrulanır; bu satırla `putCoupons`
  // çağrısı arasında `await` yoktur (Dart tek iş parçacıklı — arada oturum
  // değişemez).
  final nesil = beklenenNesil ?? oturumNesli;
  if (nesil != oturumNesli) return false;
  try {
    // Eski (v1) sunucu kayıtları KORUNARAK geri yazılır — yeni sisteme karışmaz.
    // Gövde ve başlıklar BU SATIRDA, yani hâlâ bu oturumdayken kurulur.
    await api.putCoupons([..._serverLegacy, ..._cache]);
    // Araya oturum değişimi girdiyse durum yazısı ARTIK BAŞKASININ ekranına
    // ait olurdu: yeni kullanıcı, eski kullanıcının yüklemesi için "kaydedildi"
    // görürdü. Veri değil, gösterge tutarlılığı için.
    if (nesil != oturumNesli) return false;
    _syncState = SyncState(
      pending: false,
      lastOkAt: DateTime.now().toIso8601String(),
    );
    _emit();
    return true;
  } catch (e) {
    if (nesil != oturumNesli) return false;
    _syncState = SyncState(pending: true, error: '$e');
    _emit();
    return false;
  }
}

Future<bool> retrySync() => _pushNow();

Future<void> _persist(
  List<Map<String, dynamic>> list, {
  bool push = true,
}) async {
  // Bu yazma HANGİ oturum adına? Aşağıdaki disk yazımı beklerken kullanıcı
  // değişebilir (çıkış + yeni giriş); eski işlemin o durumda `_pushNow`
  // başlatması, yeni kullanıcının sunucudaki kuponlarını eski niyetle (en
  // kötüsünde boş listeyle) ezmek olurdu. Nesil, merkezî sayaçtır
  // (session_state.oturumNesli); belirteç ROTASYONU onu artırmaz, bu yüzden
  // aynı kullanıcının işlemi gereksiz iptal edilmez.
  final nesil = oturumNesli;
  _cache = list;
  try {
    await _sp?.setString(_key, jsonEncode(list));
  } catch (_) {
    /* yerelde tutulamadıysa bellek kopyası yine doğru */
  }
  if (push && nesil == oturumNesli) {
    unawaited(_pushNow(beklenenNesil: nesil));
  }
  _emit();
}

/// Sunucudaki kuponları yerelle birleştirir.
///
/// OTURUM NESLİ KORUMASI (2026-08-09): `api.getCoupons()` ağda beklerken
/// kullanıcı çıkabilir ve BAŞKA biri girebilir (bu iş açılışta
/// `couponSahipKancasi` ile arka planda da başlatılıyor). Korunmasaydı A'nın
/// geç gelen cevabı şunları yapardı:
///   • `_mergeById(_cache, ...)` → A'nın kuponları B'nin deposuna KARIŞIR;
///   • `_persist(...)` → bu karışım B'nin cihazına yazılır;
///   • `_pushNow()` → A'nın kuponları B'NİN HESABINA yüklenir (başlıklar artık
///     B'nin belirtecini taşır).
/// Dosyanın başındaki "önceki kullanıcının kuponu yeni hesaba karışmaz" sözü
/// tam olarak burada delinirdi. Nesil `session_state`teki TEK sayaçtır; bu
/// dosya onu zaten içe aktarıyor (`isAuthenticated`), yeni bağımlılık yok.
Future<bool> syncFromServer() async {
  if (!_hasToken()) return false;
  final nesil = oturumNesli;
  try {
    final resp = await api.getCoupons();
    // Cevap ESKİ oturuma aitse hiçbir şeye dokunma: ne belleğe, ne diske, ne
    // sunucuya. Sessizce başarısız sayılır.
    if (nesil != oturumNesli) return false;
    final server = ((resp as Map?)?['coupons'] as List?) ?? const [];
    _serverLegacy = server
        .cast<Map>()
        .where((c) => c['schema'] != _schema)
        .map(Map<String, dynamic>.from)
        .toList();
    final serverV2 = server
        .cast<Map>()
        .where((c) => c['schema'] == _schema)
        .map(Map<String, dynamic>.from)
        .toList();
    final merged = _mergeById(_cache, serverV2);
    await _persist(merged, push: false);
    // Kuyruk yüklemesi de BU senkronun oturumuna bağlıdır: `_persist` disk
    // yazımında beklerken kullanıcı değiştiyse `_pushNow` gövdeyi okumadan
    // vazgeçer.
    if (jsonEncode(merged) != jsonEncode(serverV2)) {
      unawaited(_pushNow(beklenenNesil: nesil));
    }
    return true;
  } catch (_) {
    return false;
  }
}

final _rnd = Random();
String _uid() =>
    'k_${DateTime.now().millisecondsSinceEpoch}_'
    '${_rnd.nextInt(1 << 32).toRadixString(36)}';

// ——— OKUMA ———

List<Map<String, dynamic>> getWeekCoupons(Object? roundId) {
  final list = _cache.where((c) => c['roundId'] == roundId).toList()
    ..sort(
      (a, b) => ((a['couponNo'] as num?) ?? 0).compareTo(
        (b['couponNo'] as num?) ?? 0,
      ),
    );
  return list;
}

Map<String, dynamic>? getCoupon(Object? id) {
  for (final c in _cache) {
    if (c['id'] == id) return c;
  }
  return null;
}

Map<String, dynamic>? getRankedCoupon(Object? roundId) {
  for (final c in getWeekCoupons(roundId)) {
    if (c['isRankedCoupon'] == true) return c;
  }
  return null;
}

Map? finalVersion(Map? coupon) {
  final versions = coupon?['versions'];
  if (versions is! List || versions.isEmpty) return null;
  for (final v in versions.cast<Map>()) {
    if (v['id'] == coupon!['finalVersionId']) return v;
  }
  return versions.last as Map;
}

// ——— YAZMA ———

Map<String, dynamic> buildVersion(
  List<CouponSelection> selections, {
  int versionNo = 1,
}) => {
  'id': _uid(),
  'versionNo': versionNo,
  'createdAt': DateTime.now().toIso8601String(),
  'selections': [
    for (final s in selections)
      {'no': s.no, 'selectedOutcomes': s.selectedOutcomes},
  ],
  'columnCount': columnCount(selections),
  // Maliyet SAKLANMAZ — gösterim anında GERÇEK fiyat verisiyle hesaplanır
  // (coupon_config.costOf). "Fiyat uydurulamaz" kuralının depoya yansıması.
};

/// Kupon yazma işlemlerinin sonucu.
class CouponResult {
  const CouponResult({this.coupon, this.error, this.matches = const []});

  final Map<String, dynamic>? coupon;

  /// 'locked' | 'locked-match' | 'max' | 'notfound' | 'empty'
  final String? error;

  /// `locked-match` durumunda ihlal edilen maç numaraları.
  final List<Object> matches;

  bool get ok => error == null;
}

/// Yeni kupon. Haftanın ilk kuponu otomatik DERECELİ.
///
/// [lockMap] verilirse kilit MAÇ BAZINDA doğrulanır: başlamış maça seçim
/// YAPILAMAZ (geriye dönük başarı üretilemez — kesin kural). Verilmezse eski
/// davranış (bülten kilidi) korunur.
Future<CouponResult> createCoupon({
  required Object? roundId,
  Object? season,
  Object? weekNumber,
  DateTime? lockedAt,
  Map<Object, DateTime>? lockMap,
  required List<CouponSelection> selections,
  String? name,
}) async {
  if (lockMap != null) {
    final bad = lockViolations(selections: selections, lockMap: lockMap);
    if (bad.isNotEmpty) {
      return CouponResult(error: 'locked-match', matches: bad);
    }
  } else if (isLockedNow(lockedAt)) {
    return const CouponResult(error: 'locked');
  }

  final list = List<Map<String, dynamic>>.from(_cache);
  final week = list.where((c) => c['roundId'] == roundId).toList();
  if (week.length >= kMaxCouponsPerWeek) {
    return const CouponResult(error: 'max');
  }

  var enBuyuk = 0;
  for (final c in week) {
    final n = (c['couponNo'] as num?)?.toInt() ?? 0;
    if (n > enBuyuk) enBuyuk = n;
  }
  final couponNo = enBuyuk + 1;

  final version = buildVersion(selections);
  final now = DateTime.now().toIso8601String();
  final coupon = <String, dynamic>{
    'schema': _schema,
    'id': _uid(),
    'name': (name ?? '').trim().isNotEmpty ? name!.trim() : 'Kupon $couponNo',
    'season': season,
    'weekNumber': weekNumber,
    'roundId': roundId,
    'couponNo': couponNo,
    'isRankedCoupon': week.isEmpty,
    'status': 'saved',
    'createdAt': now,
    'updatedAt': now,
    'lockedAt': lockedAt?.toIso8601String(),
    'playedMarkedAt': null,
    'finalVersionId': version['id'],
    'versions': [version],
  };

  await _persist([...list, coupon]);
  return CouponResult(coupon: coupon);
}

/// Düzenleme → YENİ versiyon (izlenebilirlik; eskiler silinmez).
///
/// [lockMap] verilirse maç bazlı doğrulama: kilitli maçın seçimi önceki final
/// versiyondaki değerinden FARKLI OLAMAZ.
Future<CouponResult> addVersion(
  Object couponId,
  List<CouponSelection> selections, {
  Map<Object, DateTime>? lockMap,
}) async {
  final list = List<Map<String, dynamic>>.from(_cache);
  final c = list.where((x) => x['id'] == couponId).firstOrNull;
  if (c == null) return const CouponResult(error: 'notfound');

  if (lockMap != null) {
    final prevRaw = (finalVersion(c)?['selections'] as List?) ?? const [];
    final prev = prevRaw
        .cast<Map>()
        .map(
          (s) => CouponSelection(
            no: s['no'] as Object,
            selectedOutcomes: ((s['selectedOutcomes'] as List?) ?? const [])
                .cast<String>(),
          ),
        )
        .toList();
    final bad = lockViolations(
      selections: selections,
      prevSelections: prev,
      lockMap: lockMap,
    );
    if (bad.isNotEmpty) {
      return CouponResult(error: 'locked-match', matches: bad);
    }
  } else if (isLockedNow(_tarih(c['lockedAt']))) {
    return const CouponResult(error: 'locked');
  }

  final version = buildVersion(
    selections,
    versionNo: ((c['versions'] as List).length) + 1,
  );
  (c['versions'] as List).add(version);
  c['finalVersionId'] = version['id'];
  c['updatedAt'] = DateTime.now().toIso8601String();
  await _persist(list);
  return CouponResult(coupon: c);
}

Future<CouponResult> renameCoupon(Object couponId, String? name) async {
  final list = List<Map<String, dynamic>>.from(_cache);
  final c = list.where((x) => x['id'] == couponId).firstOrNull;
  if (c == null) return const CouponResult(error: 'notfound');
  final yeni = (name ?? '').trim();
  if (yeni.isNotEmpty) c['name'] = yeni;
  c['updatedAt'] = DateTime.now().toIso8601String();
  await _persist(list);
  return CouponResult(coupon: c);
}

/// Kuponu KOPYALA → aynı haftada yeni bağımsız kupon.
///
/// [lockMap] verilirse: kopya YENİ bir kupondur, bu yüzden başlamış maçların
/// seçimleri kopyada BOŞALTILIR (kopyaya geriye dönük isabet taşınamaz) ve
/// boşaltılan maç numaraları döndürülür.
Future<({CouponResult sonuc, List<Object> strippedNos})> copyCoupon(
  Object couponId, {
  Map<Object, DateTime>? lockMap,
}) async {
  final src = getCoupon(couponId);
  if (src == null) {
    return (
      sonuc: const CouponResult(error: 'notfound'),
      strippedNos: <Object>[],
    );
  }
  if (lockMap == null && isLockedNow(_tarih(src['lockedAt']))) {
    return (
      sonuc: const CouponResult(error: 'locked'),
      strippedNos: <Object>[],
    );
  }
  final v = finalVersion(src);
  if (v == null) {
    return (sonuc: const CouponResult(error: 'empty'), strippedNos: <Object>[]);
  }

  final stripped = <Object>[];
  final now = DateTime.now();
  final selections = ((v['selections'] as List?) ?? const []).cast<Map>().map((
    sc,
  ) {
    final no = sc['no'] as Object;
    var outcomes = ((sc['selectedOutcomes'] as List?) ?? const [])
        .cast<String>();
    final la = lockMap?[no];
    if (la != null && !now.isBefore(la) && outcomes.isNotEmpty) {
      stripped.add(no);
      outcomes = const [];
    }
    return CouponSelection(no: no, selectedOutcomes: outcomes);
  }).toList();

  final r = await createCoupon(
    season: src['season'],
    weekNumber: src['weekNumber'],
    roundId: src['roundId'],
    lockedAt: _tarih(src['lockedAt']),
    lockMap: lockMap,
    selections: selections,
    name: '${src['name']} (kopya)',
  );
  return (sonuc: r, strippedNos: stripped);
}

Future<CouponResult> setRanked(Object? roundId, Object couponId) async {
  final list = List<Map<String, dynamic>>.from(_cache);
  final week = list.where((c) => c['roundId'] == roundId).toList();
  final target = week.where((c) => c['id'] == couponId).firstOrNull;
  if (target == null) return const CouponResult(error: 'notfound');
  if (isLockedNow(_tarih(target['lockedAt']))) {
    return const CouponResult(error: 'locked');
  }
  for (final c in week) {
    c['isRankedCoupon'] = c['id'] == couponId;
  }
  await _persist(list);
  return CouponResult(coupon: target);
}

Future<void> deleteCoupon(Object id) async {
  await _persist(_cache.where((c) => c['id'] != id).toList());
}

/// "Oynadım" BEYANI — operatör entegrasyonu YOK; her yerde "kullanıcı beyanı
/// (operatör doğrulaması yok)" etiketiyle gösterilir, asla doğrulanmış gibi
/// değil.
Future<CouponResult> markPlayed(Object couponId, bool on) async {
  final list = List<Map<String, dynamic>>.from(_cache);
  final c = list.where((x) => x['id'] == couponId).firstOrNull;
  if (c == null) return const CouponResult(error: 'notfound');
  c['playedMarkedAt'] = on ? DateTime.now().toIso8601String() : null;
  c['updatedAt'] = DateTime.now().toIso8601String();
  await _persist(list);
  return CouponResult(coupon: c);
}

// ——— PAYLAŞILAN TASLAK — maç detayı "KUPONA İŞLE" / Radar / editör ortak ———

Map<String, dynamic> getDraft(Object? roundId) {
  if (_dcache['roundId'] == roundId) return _dcache;
  return {'roundId': roundId, 'picks': <String, dynamic>{}};
}

Future<void> _writeDraft(Map<String, dynamic> d) async {
  _dcache = d;
  try {
    await _sp?.setString(_dkey, jsonEncode(d));
  } catch (_) {}
}

Future<Map<String, dynamic>> setDraftPick(
  Object? roundId,
  Object no,
  List<String>? outcomes,
) async {
  final base = getDraft(roundId);
  final picks = Map<String, dynamic>.from((base['picks'] as Map?) ?? const {});
  if (outcomes == null || outcomes.isEmpty) {
    picks.remove('$no');
  } else {
    picks['$no'] = outcomes;
  }
  await _writeDraft({'roundId': roundId, 'picks': picks});
  return picks;
}

Future<void> setDraftAll(Object? roundId, Map<String, dynamic> picks) =>
    _writeDraft({'roundId': roundId, 'picks': Map.of(picks)});

Future<void> clearDraft(Object? roundId) async {
  if (_dcache['roundId'] == roundId || roundId == null) {
    await _writeDraft({'roundId': null, 'picks': <String, dynamic>{}});
  }
}

DateTime? _tarih(Object? iso) =>
    iso is String ? DateTime.tryParse(iso)?.toLocal() : null;
