// KAYNAK: app/src/services/notificationsService.js — BİREBİR çeviri.
//
// BİLDİRİM MERKEZİ SERVİSİ — gerçek uçlardan veri toplar, saf modüle verir.
//
// Depolama anahtarı: 'sportoto.notifications.v1' (mevcut hiçbir anahtarın adı
// değiştirilmedi). İçinde kişisel veri YOK: yalnız en son görülme zamanı, son
// puan toplamı, kazanılmış başarı anahtarları ve okunmuş bildirim kimlikleri
// tutulur.

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../coupon/coupon_store.dart';
import '../network/api_client.dart';
import '../notifications.dart';

const String kNotifKey = 'sportoto.notifications.v1'; // AD DEĞİŞMEZ

SharedPreferences? _sp;

/// Depo bir kez açılır; ekran her tazelemede yeniden açmaz.
Future<SharedPreferences> _store() async =>
    _sp ??= await SharedPreferences.getInstance();

Future<Map<String, dynamic>> readState() async {
  try {
    final raw = (await _store()).getString(kNotifKey);
    if (raw == null || raw.isEmpty) return {};
    return (jsonDecode(raw) as Map).cast<String, dynamic>();
  } catch (_) {
    return {};
  }
}

Future<void> writeState(Map<String, dynamic> s) async {
  try {
    await (await _store()).setString(kNotifKey, jsonEncode(s));
  } catch (_) {
    // depo yoksa sessiz geç
  }
}

/// Bir isteğin patlaması diğerlerini engellemesin — eksik veri "yok" sayılır.
Future<dynamic> _safe(Future<dynamic> p) async {
  try {
    return await p;
  } catch (_) {
    return null;
  }
}

typedef LoadedNotifications = ({
  List<NotifItem> items,
  int unread,
  bool firstRun,
  ({Map? bulletin, Map? progress}) ctx,
});

/// Gerçek verileri çeker ve bildirim listesini üretir.
/// Hiçbir uç cevap vermezse sonuç BOŞ listedir (uydurma yapılmaz).
Future<LoadedNotifications> loadNotifications({int? now}) async {
  final simdi = now ?? DateTime.now().millisecondsSinceEpoch;
  final state = await readState();

  // (api.progress kaldırıldı — oyunlaştırma söküldü, 2026-08-06)
  final sonuclar = await Future.wait([
    _safe(api.bulletin()),
    _safe(api.rounds()),
  ]);
  final bulletin = sonuclar[0] as Map?;
  final roundsRes = sonuclar[1] as Map?;
  const Map? progress = null;

  // Kapanan hafta: hafta listesindeki güncel haftadan bir öncesi.
  Map? history;
  final list = (roundsRes?['rounds'] as List?) ?? const [];
  final guncelId = roundsRes?['currentRoundId'] ?? bulletin?['roundId'];
  final idx = list.indexWhere((r) => '${(r as Map)['id']}' == '$guncelId');
  final onceki = idx > 0
      ? list[idx - 1] as Map
      : (idx == -1 && list.length > 1 ? list[list.length - 2] as Map : null);
  if (onceki?['id'] != null) {
    final h = await _safe(api.history(onceki!['id'] as Object)) as Map?;
    if (h != null && h['matches'] is List) {
      history = {
        'roundId': onceki['id'],
        'roundName': onceki['name'],
        'matches': h['matches'],
      };
    }
  }

  final gRound = bulletin?['roundId'] ??
      (bulletin?['round'] is Map ? (bulletin!['round'] as Map)['id'] : null) ??
      guncelId;
  List coupons = const [];
  try {
    coupons = gRound != null ? getWeekCoupons(gRound) : const [];
  } catch (_) {
    coupons = const [];
  }

  // İlk kurulum: geçmişe dönük bildirim yağmuru olmasın diye durum tohumlanır.
  final ilkKez =
      state['lastPoints'] == null && state['knownRoundIds'] is! List;
  if (ilkKez) {
    await writeState(seedState(now: simdi, bulletin: bulletin));
    return (
      items: const <NotifItem>[],
      unread: 0,
      firstRun: true,
      ctx: (bulletin: bulletin, progress: progress),
    );
  }

  final r = buildNotifications(
    now: simdi,
    bulletin: bulletin,
    history: history,
    coupons: coupons,
    state: state,
  );
  return (
    items: r.items,
    unread: r.unread,
    firstRun: false,
    ctx: (bulletin: bulletin, progress: progress),
  );
}

/// Telefon hatırlatmalarını planlamak için gereken GERÇEK girdiler.
///
/// push servisi bilerek `api`'yi tanımaz (cihaz katmanı ile veri katmanı ayrı
/// kalsın diye); veriyi toplayan taraf burasıdır. Uç cevap vermezse bülten
/// null döner ve hiçbir hatırlatma kurulmaz — uydurma yapılmaz.
Future<({Map? bulletin, List coupons})> loadPushInputs() async {
  final bulletin = await _safe(api.bulletin()) as Map?;
  final gRound = bulletin?['roundId'] ??
      (bulletin?['round'] is Map ? (bulletin!['round'] as Map)['id'] : null);
  List coupons = const [];
  try {
    coupons = gRound != null ? getWeekCoupons(gRound) : const [];
  } catch (_) {
    coupons = const [];
  }
  return (bulletin: bulletin, coupons: coupons);
}

/// Kullanıcı bildirimleri açtı: okunmuş say ve durumu kaydet.
Future<Map<String, dynamic>> markSeen({
  int? now,
  List<NotifItem> items = const [],
  ({Map? bulletin, Map? progress})? ctx,
}) async {
  final s = nextState(
    now: now ?? DateTime.now().millisecondsSinceEpoch,
    state: await readState(),
    items: items,
    bulletin: ctx?.bulletin,
    progress: ctx?.progress,
  );
  await writeState(s);
  return s;
}
