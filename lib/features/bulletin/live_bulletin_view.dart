// KAYNAK: app/src/components/LiveBulletinView.js — BİREBİR çeviri.
//
// PAYLAŞILAN CANLI YAPI — sade maç kartı listesi. Hem "Canlı" hem "Bülten"
// ekranında AYNI yapı için kullanılır.
//
// ÜST ÇUBUK KALDIRILDI (kullanıcı isteği): ayar düğmesi + ayar paneli, sayaç
// kutuları (Canlı/Başlamadı/Sonuç Bekleniyor/Biten/Kupon Riskte/Sistem Riskte)
// ve filtre çipleri artık yok — ekran sade, liste bülten sırasında akar.
// Skor renk açıklaması KALIR.
//
// Veri çekme/teyit kilidi/polling ÜST ekranda; bu bileşen sadece görünüm.

import 'package:flutter/material.dart';

import '../../core/live_logic.dart';
import '../../core/prefs.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/score_legend.dart';
import 'live_match_card.dart';

List<Map<String, dynamic>> _sortList(List matches, Object? sort) {
  final arr = matches.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  int byNo(Map a, Map b) =>
      ((a['no'] as num?) ?? 0).compareTo((b['no'] as num?) ?? 0);

  if (sort == 'liveTop') {
    int w(Map m) {
      final st = deriveStatus(m);
      return st == MacDurum.live
          ? 0
          : (st == MacDurum.awaiting || st == MacDurum.suspended)
          ? 1
          : st == MacDurum.finished
          ? 3
          : 2;
    }

    arr.sort((a, b) {
      final c = w(a).compareTo(w(b));
      return c != 0 ? c : byNo(a, b);
    });
    return arr;
  }

  if (sort == 'doneBottom') {
    int w(Map m) => deriveStatus(m) == MacDurum.finished ? 1 : 0;
    arr.sort((a, b) {
      final c = w(a).compareTo(w(b));
      return c != 0 ? c : byNo(a, b);
    });
    return arr;
  }

  arr.sort(byNo);
  return arr;
}

class LiveBulletinView extends StatelessWidget {
  const LiveBulletinView({
    super.key,
    required this.matches,
    this.onCardPress,
    this.onRefresh,
    this.subtitle,
    this.userPicks = const {},
    this.aktarimlar = const {},
    this.roundId,
    this.favoriteTeam,
    this.header,
  });

  final List matches;
  final void Function(Object no)? onCardPress;
  final Future<void> Function()? onRefresh;
  final String? subtitle;
  final Map<Object, String> userPicks;

  /// Maç no → kupona aktarım damgası. Kart, sistem tahmini damgadan beri
  /// değiştiyse "eski → yeni" gösterir (bkz. live_match_card).
  final Map<Object, Map<String, dynamic>> aktarimlar;

  /// Karar izi sorgusu için hafta kimliği.
  final Object? roundId;
  final String? favoriteTeam;

  /// Kaynakta bülten başlığı ekranın kendisindeydi ve liste ayrı bir
  /// FlatList'ti. Flutter'da iki ayrı kaydırma alanı iç içe geçemeyeceği için
  /// başlık listenin ListHeader'ına verilir — kaydırma davranışı kaynaktakiyle
  /// aynı kalır (başlık listeyle birlikte yukarı kayar).
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    // Görünüm tercihleri kayıtlıdan okunur (bu ekranda ayar arayüzü yok).
    final sort = getPref('liveSort');
    final anim = getPref('liveAnim') as String? ?? 'important';

    final liste = _sortList(matches, sort);

    final list = CustomScrollView(
      slivers: [
        if (header != null) SliverToBoxAdapter(child: header),
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (subtitle != null && subtitle!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Spacing.md,
                    vertical: Spacing.sm,
                  ),
                  child: Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      // Başlık bloğunun ALTINDA, sayfa zemini üstünde.
                      color: AppColors.onBackgroundMuted,
                      fontSize: 11.5,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                ),
              ScoreLegend(),
            ],
          ),
        ),
        if (liste.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.only(top: 30),
              child: Text(
                'Bu bültende maç yok.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textMuted, fontSize: 13),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.only(
              left: Spacing.md,
              right: Spacing.md,
              bottom: Spacing.xl,
            ),
            sliver: SliverList.builder(
              itemCount: liste.length,
              itemBuilder: (context, i) {
                final m = liste[i];
                return LiveMatchCard(
                  match: m,
                  anim: anim,
                  userPick: userPicks[m['no']],
                  aktarim: aktarimlar[m['no']],
                  roundId: roundId,
                  favoriteTeam: favoriteTeam,
                  onPress: onCardPress == null
                      ? null
                      : () => onCardPress!(m['no'] as Object),
                );
              },
            ),
          ),
      ],
    );

    if (onRefresh == null) return list;
    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: onRefresh!,
      child: list,
    );
  }
}
