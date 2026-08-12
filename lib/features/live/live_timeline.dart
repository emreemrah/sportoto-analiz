// KAYNAK: app/src/components/LiveTimeline.js — BİREBİR çeviri.
//
// CANLI OLAY ŞERİDİ — maçın gol/kırmızı kart dakikaları tek bakışta.
// Ev sahibi olayları üst şeritte, deplasman alt şeritte. Mantık saf modülde
// (core/live_events.dart) ve testlidir. Gösterilecek olay yoksa bileşen HİÇ
// görünmez — boş/uydurma şerit çizilmez.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/live_events.dart';
import '../../core/theme/tokens.dart';

const Color _homeC = Color(0xFF2F6FED);
const Color _awayC = Color(0xFFE0762C);

/// Olay ikonu VEKTÖR (kullanıcı isteği, 2026-08-12): 🟥/⚽ emojisiydi ve
/// rengi emoji fontundan geliyordu. Kırmızı kart ANLAMSAL `danger` tonunu
/// alır — temadan bağımsızdır, her görünümde kırmızıdır.
IconData _iconOf(LiveEvent e) =>
    e.kind == 'red' ? Icons.square : Icons.sports_soccer;

Color _iconColorOf(LiveEvent e) =>
    e.kind == 'red' ? AppColors.danger : AppColors.textSoft;

class LiveTimeline extends StatelessWidget {
  const LiveTimeline({
    super.key,
    this.events,
    this.minute,
    this.homeName = '',
    this.awayName = '',
  });

  final List? events;
  final Object? minute;
  final String homeName;
  final String awayName;

  @override
  Widget build(BuildContext context) {
    final dk = minute is num ? (minute as num).toInt() : null;
    final markers = timelineMarkers(events, maxMinute: dk ?? kRegMinutes);
    if (markers.isEmpty) return const SizedBox.shrink();

    var cap = math.max(kRegMinutes, dk ?? 0);
    for (final m in markers) {
      cap = math.max(cap, m.e.at);
    }
    final nowPos = dk != null ? math.max(0.0, math.min(1.0, dk / cap)) : null;
    final halfPos = kHalfMinutes / cap;
    final home = markers.where((m) => m.e.side == 'home').toList();
    final away = markers.where((m) => m.e.side == 'away').toList();
    final noSide = markers.where((m) => m.e.side == null).toList();

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.only(
        left: Spacing.md,
        right: Spacing.md,
        top: 8,
        bottom: 10,
      ),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Row(
              children: [
                Expanded(child: _yan(homeName, _homeC, TextAlign.start)),
                Text(
                  'Maç Şeridi',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 10,
                    fontWeight: AppFont.black,
                    letterSpacing: 1,
                  ),
                ),
                Expanded(child: _yan(awayName, _awayC, TextAlign.end)),
              ],
            ),
          ),

          _serit(home, _homeC, ust: true),

          // Zemin çizgisi: devre arası çizgisi, "şu an" imleci ve oynanan pay.
          SizedBox(
            height: 6,
            child: LayoutBuilder(
              builder: (context, c) => ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: Stack(
                  children: [
                    Container(color: AppColors.surfaceSoft),
                    if (nowPos != null)
                      Positioned(
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: c.maxWidth * nowPos,
                        child: Container(color: AppColors.border),
                      ),
                    Positioned(
                      left: c.maxWidth * halfPos,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      child: Opacity(
                        opacity: 0.5,
                        child: Container(color: AppColors.textMuted),
                      ),
                    ),
                    if (nowPos != null)
                      Positioned(
                        left: (c.maxWidth * nowPos).clamp(0, c.maxWidth - 2),
                        top: 0,
                        bottom: 0,
                        width: 2,
                        child: Container(color: AppColors.accent),
                      ),
                  ],
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const _Olcek("0'"),
                const _Olcek("45'"),
                _Olcek(cap > kRegMinutes ? "$cap'" : "90'"),
              ],
            ),
          ),

          _serit(away, _awayC, ust: false),

          if (noSide.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${noSide.length} olayın takımı eşleştirilemedi — şeritte '
                'gösterilmiyor, listede duruyor.',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 9.5,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
        ],
      ),
    );
  }

  static Widget _yan(String ad, Color renk, TextAlign hiza) => Text(
    ad,
    maxLines: 1,
    overflow: TextOverflow.ellipsis,
    textAlign: hiza,
    style: TextStyle(color: renk, fontSize: 11, fontWeight: AppFont.black),
  );

  /// Bir şerit (ev üstte, deplasman altta). İşaretçiler mutlak konumlanır;
  /// aynı kovadaki olaylar `slot` kadar dikey kaydırılır.
  Widget _serit(
    List<TimelineMarker> liste,
    Color renk, {
    required bool ust,
  }) => SizedBox(
    height: 26,
    child: LayoutBuilder(
      builder: (context, c) => Stack(
        clipBehavior: Clip.none,
        children: [
          for (final m in liste)
            Positioned(
              // Kaynakta `left: pos%` + `translateX(-11)`, genişlik 22.
              left: c.maxWidth * m.pos - 11,
              top: 0,
              bottom: 0,
              width: 22,
              child: Transform.translate(
                offset: Offset(0, ust ? -m.slot.toDouble() : m.slot.toDouble()),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(_iconOf(m.e), size: 12, color: _iconColorOf(m.e)),
                    Text(
                      "${m.e.minute}${m.e.extra > 0 ? '+${m.e.extra}' : ''}'",
                      style: TextStyle(
                        color: renk,
                        fontSize: 8.5,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _Olcek extends StatelessWidget {
  const _Olcek(this.t);

  final String t;

  @override
  Widget build(BuildContext context) => Text(
    t,
    style: TextStyle(
      color: AppColors.textMuted,
      fontSize: 8.5,
      fontWeight: AppFont.heavy,
    ),
  );
}
