// KAYNAK: app/src/screens/BulletinScreen.js → `hist` durumu + `checkOfficial`
//
// Geçmiş hafta verisi, resmî sonuç kontrolü ve DÜZELTME DENETİMİ.
//
// Kaynakta bu iş ekranın içindeki `useState`/`useCallback` yığınıydı. Buraya
// alınmasının sebebi davranışı değiştirmek değil, iki şeyi ayırmak: "ne
// oldu" (burada) ile "nasıl görünüyor" (ekranda). Kurallar aynen korundu:
//
//   • Yeni resmi sonuçları (fresh) çek, mevcutla karşılaştır: yeni sonuç geldi
//     mi, resmi sonuç DEĞİŞTİ mi (düzeltme). Sahte/tahmini skor asla basılmaz.
//   • Hata SESSİZ yutulur — mevcut veri ekranda kalır (yenileme başarısız diye
//     kullanıcının elindeki doğru veri silinmez).

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import 'bulletin_format.dart';

/// Oturum-içi resmi sonuç DÜZELTMESİ kaydı.
class Duzeltme {
  const Duzeltme({
    required this.no,
    this.home,
    this.away,
    required this.oldScore,
    required this.oldResult,
    required this.newScore,
    required this.newResult,
  });

  final Object no;
  final String? home;
  final String? away;
  final Map oldScore;
  final String? oldResult;
  final Map newScore;
  final String? newResult;
}

/// `histUpdateMsg`: null | 'updated' | 'noNew'
class HistoryState {
  const HistoryState({
    this.hist,
    this.loading = false,
    this.error,
    this.checking = false,
    this.updateMsg,
    this.corrections = const [],
    this.toast,
  });

  final Map<String, dynamic>? hist;
  final bool loading;
  final String? error;
  final bool checking;
  final String? updateMsg;
  final List<Duzeltme> corrections;
  final String? toast;

  HistoryState copyWith({
    Map<String, dynamic>? hist,
    bool? loading,
    Object? error = _sentinel,
    bool? checking,
    Object? updateMsg = _sentinel,
    List<Duzeltme>? corrections,
    Object? toast = _sentinel,
  }) => HistoryState(
    hist: hist ?? this.hist,
    loading: loading ?? this.loading,
    error: identical(error, _sentinel) ? this.error : error as String?,
    checking: checking ?? this.checking,
    updateMsg: identical(updateMsg, _sentinel)
        ? this.updateMsg
        : updateMsg as String?,
    corrections: corrections ?? this.corrections,
    toast: identical(toast, _sentinel) ? this.toast : toast as String?,
  );

  static const Object _sentinel = Object();
}

class HistoryController extends StateNotifier<HistoryState> {
  HistoryController(this._api) : super(const HistoryState());

  final ApiClient _api;
  int? _roundId;

  /// Geçmiş hafta seçilince: KAYITLI veriyi hemen göster, sonra resmi
  /// sonuçları arka planda kontrol et (kaynaktaki açılış davranışı).
  Future<void> yukle(int roundId) async {
    if (state.hist != null && state.hist!['roundId'] == roundId) return;
    _roundId = roundId;
    state = const HistoryState(loading: true);
    try {
      final h = await _api.history(roundId);
      if (_roundId != roundId) return; // kullanıcı hafta değiştirdi
      state = state.copyWith(
        hist: {...Map<String, dynamic>.from(h as Map), 'roundId': roundId},
        loading: false,
        error: null,
      );
      await checkOfficial(roundId);
    } catch (e) {
      if (_roundId != roundId) return;
      state = state.copyWith(loading: false, error: '$e');
    }
  }

  void temizle() {
    _roundId = null;
    state = const HistoryState();
  }

  void toastTemizle() => state = state.copyWith(toast: null);

  /// [onlyNo] verilirse yalnız o satırın resmi sonucu uygulanır
  /// ("Bu maçı yenile").
  /// [sessiz] ARKA PLAN YOKLAMASI: 15 sn'lik otomatik kontrol kendini
  /// kullanıcıya DUYURMAZ.
  ///
  /// Bildirilen sorun (16 Ağustos 2026): geçmiş haftada "Resmi sonuçlar
  /// kontrol ediliyor 🔄" yazısı ve çarkı 15 saniyede bir parlayıp duruyordu.
  /// Sebep: yoklama, kullanıcının BAŞLATTIĞI kontrolle aynı `checking`
  /// bayrağını kullanıyordu. Döngü ancak 15/15 sonuç + ikramiye gelince
  /// durduğu için, maçları henüz oynanmamış bir haftada saatlerce sürüyordu.
  ///
  /// Yoklamanın kendisi doğru — durdurulan şey yalnız GÖSTERGE. Gerçek bir
  /// değişiklik (yeni sonuç, düzeltme) yine bildirilir.
  Future<void> checkOfficial(int roundId, {Object? onlyNo, bool sessiz = false}) async {
    if (!sessiz) state = state.copyWith(checking: true);
    try {
      final freshRaw = await _api.history(roundId, fresh: true);
      final fresh = Map<String, dynamic>.from(freshRaw as Map);
      final prev = state.hist;

      if (prev == null || prev['roundId'] != roundId) {
        state = state.copyWith(
          hist: {...fresh, 'roundId': roundId},
          checking: false,
        );
        return;
      }

      final prevMatches = (prev['matches'] as List?) ?? const [];
      final freshMatches = (fresh['matches'] as List?) ?? const [];
      final prevBy = {for (final m in prevMatches.cast<Map>()) m['no']: m};

      final merged = onlyNo != null
          ? prevMatches.cast<Map>().map((m) {
              if (m['no'] != onlyNo) return m;
              return freshMatches.cast<Map>().firstWhere(
                (f) => f['no'] == onlyNo,
                orElse: () => m,
              );
            }).toList()
          : freshMatches;

      // Düzeltme tespiti: önceki RESMİ sonuç ≠ yeni RESMİ sonuç.
      final newCorr = <Duzeltme>[];
      for (final nm in merged.cast<Map>()) {
        final pm = prevBy[nm['no']];
        if (!officialResolved(pm) || !officialResolved(nm)) continue;
        // Noter maçında skor yoktur — null cast çökerdi; skorsuz çiftte
        // yalnız İŞARET değişimi düzeltme sayılır.
        final ps = pm!['score'] as Map?;
        final ns = nm['score'] as Map?;
        if (ps == null || ns == null) {
          if (pm['result'] == nm['result']) continue;
        }
        if (pm['result'] != nm['result'] ||
            (ps != null &&
                ns != null &&
                (ps['home'] != ns['home'] || ps['away'] != ns['away']))) {
          newCorr.add(
            Duzeltme(
              no: nm['no'] as Object,
              home: (nm['home'] as Map?)?['name'] as String?,
              away: (nm['away'] as Map?)?['name'] as String?,
              // Noter maçında skor yok — boş harita geçilir (ekran skoru
              // basmıyor; corrections yalnız sayım/işaret için kullanılıyor).
              oldScore: ps ?? const {},
              oldResult: pm['result'] as String?,
              newScore: ns ?? const {},
              newResult: nm['result'] as String?,
            ),
          );
        }
      }

      final prevResolved = prevMatches
          .cast<Map>()
          .where(officialResolved)
          .length;
      final newResolved = merged.cast<Map>().where(officialResolved).length;

      String? toast;
      String? updateMsg;
      var corrections = state.corrections;

      if (newCorr.isNotEmpty) {
        corrections = [...corrections, ...newCorr];
        toast = 'Resmi sonuç düzeltmesi var';
        updateMsg = 'updated';
      } else if (newResolved > prevResolved) {
        toast = 'Resmi sonuçlar güncellendi';
        updateMsg = 'updated';
      } else {
        updateMsg = 'noNew';
      }

      state = state.copyWith(
        hist: {...fresh, 'matches': merged, 'roundId': roundId},
        checking: false,
        corrections: corrections,
        updateMsg: updateMsg,
        toast: toast,
      );
    } catch (_) {
      // sessiz — mevcut veri kalır
      state = state.copyWith(checking: false);
    }
  }
}

final historyControllerProvider =
    StateNotifierProvider.autoDispose<HistoryController, HistoryState>(
      (ref) => HistoryController(api),
    );
