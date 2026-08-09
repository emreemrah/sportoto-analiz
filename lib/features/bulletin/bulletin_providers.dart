// KAYNAK: app/src/screens/BulletinScreen.js — veri yükleme bölümü.
//
// Kaynakta veri `useState` + `useEffect` ile ekranın içinde tutuluyordu.
// Flutter'da aynı iş Riverpod sağlayıcılarına taşındı: ekran yeniden
// çizildiğinde istek TEKRARLANMAZ ve sekme değişiminde veri korunur —
// kaynaktaki `useEffect(..., [load])` davranışının karşılığı budur.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';

final apiProvider = Provider<ApiClient>((ref) => api);

/// Güncel analizli bülten — `api.bulletin()`
final bulletinProvider = FutureProvider.autoDispose<Map<String, dynamic>>((
  ref,
) async {
  final data = await ref.watch(apiProvider).bulletin();
  return Map<String, dynamic>.from(data as Map);
});

/// Hafta listesi / navigasyon — `api.rounds()`
///
/// Kaynakta `api.rounds().catch(() => null)` ile SESSİZCE düşürülüyordu:
/// hafta listesi gelmezse bülten yine gösterilmeli. Aynı davranış korundu.
final roundsProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((
  ref,
) async {
  try {
    final data = await ref.watch(apiProvider).rounds();
    return Map<String, dynamic>.from(data as Map);
  } catch (_) {
    return null;
  }
});

/// Görüntülenen hafta (null = güncel). Kaynaktaki `selectedId`.
final selectedRoundIdProvider = StateProvider.autoDispose<int?>((ref) => null);

/// Geçmiş hafta verisi — `api.history(roundId)`
///
/// Yalnız güncel hafta DIŞINDA bir hafta seçiliyken çalışır; kaynakta da
/// `viewingCurrent` kontrolüyle aynı koşul vardı.
final historyProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, int>((ref, roundId) async {
      final data = await ref.watch(apiProvider).history(roundId);
      return {...Map<String, dynamic>.from(data as Map), 'roundId': roundId};
    });
