// KAYNAK: app/src/components/MatchPredictionRow.js +
//         app/src/components/ResultComparisonCard.js +
//         app/src/components/DashboardChartCard.js +
//         app/src/ui.js → PercentBar +
//         app/src/components.js → PredictionBadge +
//         app/src/types/analysis.js → ERROR_TAG_LABEL
// BİREBİR çeviri.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../core/utils.dart';

/// `types/analysis.js` → ERROR_TAGS / ERROR_TAG_LABEL
const Map<String, String> kErrorTagLabel = {
  'favorite_failed': 'Favori kaybetti',
  'draw_missed': 'Kaçırılan beraberlik',
  'away_win_missed': 'Kaçırılan deplasman galibiyeti',
  'lineup_risk': 'Kadro riski',
  'red_card_effect': 'Kırmızı kart etkisi',
  'late_goal': 'Geç gol',
  'low_confidence': 'Düşük güven skoru',
  'surprise_match': 'Sürpriz maç',
  'unknown': 'Belirsiz',
};

/// `components.js` → `PredictionBadge`
///
/// Kupon tahmini rozeti (1 / 0 / 2 / 10 / 02 / 12 / 102).
/// Renk = RİSK: tek tahmin lacivert, çifte sarı, üçlü kırmızı. Tahmin yoksa
/// gri "–" — uydurma bir sembol BASILMAZ.
class PredictionBadge extends StatelessWidget {
  const PredictionBadge({super.key, this.symbol, this.small = false});

  final String? symbol;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final s = symbol;
    final bos = s == null || s.isEmpty || s == '-';
    final c = bos
        ? AppColors.gray
        : (s == '102'
              ? AppColors.red
              : (s.length == 2 ? AppColors.yellow : AppColors.primary));

    return Container(
      constraints: BoxConstraints(minWidth: small ? 30 : 38),
      padding: EdgeInsets.symmetric(
        horizontal: small ? 6 : 8,
        vertical: small ? 2 : 3,
      ),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        // Kaynakta `c + '22'` → rengin %13'ü (0x22/0xFF).
        color: c.withValues(alpha: 0x22 / 0xFF),
        border: Border.all(color: c, width: 1.5),
        borderRadius: AppRadius.smR,
      ),
      child: Text(
        bos ? '–' : s,
        style: TextStyle(
          color: c,
          fontSize: small ? 12 : 15,
          fontWeight: AppFont.black,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

/// `ui.js` → `PercentBar`
class PercentBar extends StatelessWidget {
  const PercentBar({
    super.key,
    required this.label,
    required this.value,
    this.color,
  });

  final String label;
  final num value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final v = value.clamp(0, 100).toDouble();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '%$value',
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 12,
                  fontWeight: AppFont.heavy,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Container(
              height: 8,
              color: AppColors.track,
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: v / 100,
                child: Container(
                  decoration: BoxDecoration(
                    color: color ?? AppColors.accent,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// `components/DashboardChartCard.js`
///
/// Grafik kütüphanesi kullanmadan basit çubuklu kart.
class DashboardChartCard extends StatelessWidget {
  const DashboardChartCard({
    super.key,
    this.title,
    required this.rows,
    this.emptyText,
  });

  final String? title;
  final List<({String label, num value, Color color})> rows;
  final String? emptyText;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.sm),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.lgR,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null && title!.isNotEmpty) ...[
          Text(
            title!,
            style: TextStyle(
              color: AppColors.text,
              fontSize: 14,
              fontWeight: AppFont.heavy,
            ),
          ),
          const SizedBox(height: 8),
        ],
        if (rows.isNotEmpty)
          for (final r in rows)
            PercentBar(label: r.label, value: r.value, color: r.color)
        else
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              emptyText ?? 'Henüz veri yok.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
      ],
    ),
  );
}

/// `components/MatchPredictionRow.js`
///
/// "Maçlar" / "Kilitli Analiz" sekmelerindeki satır: sistem önerisi, güven
/// skoru, sürpriz riski, kısa analiz yorumu ve eksik oyuncular.
class MatchPredictionRow extends StatelessWidget {
  const MatchPredictionRow({super.key, required this.match, this.analysis});

  final Map match;
  final Map? analysis;

  @override
  Widget build(BuildContext context) {
    final d = matchDate(match['startTime'] as String?);
    final a = analysis;
    final home = (match['homeTeam'] as Map?)?['name'] ?? '';
    final away = (match['awayTeam'] as Map?)?['name'] ?? '';
    final missing = (a?['missingPlayers'] as List?) ?? const [];
    final yorum = a?['analysisComment'];

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 20,
                child: Text(
                  '${match['orderNo'] ?? ''}',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 13,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
              const SizedBox(width: Spacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$home - $away',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 14,
                        fontWeight: AppFont.bold,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        '${match['league'] ?? ''} · ${d.day} ${d.time}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: Spacing.sm),
              PredictionBadge(symbol: a?['prediction'] as String?, small: true),
            ],
          ),
          if (a != null) ...[
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                children: [
                  // Veri yoksa sahte yüzde BASILMAZ — "—" gösterilir.
                  _Olcut(
                    label: 'Güven',
                    value: a['confidenceScore'] != null
                        ? '%${a['confidenceScore']}'
                        : '—',
                    color: AppColors.green,
                  ),
                  const SizedBox(width: Spacing.lg),
                  _Olcut(
                    label: 'Sürpriz',
                    value: a['surpriseRisk'] != null
                        ? '%${a['surpriseRisk']}'
                        : '—',
                    color: AppColors.orange,
                  ),
                  if (a['dataConfidence'] != null) ...[
                    const SizedBox(width: Spacing.lg),
                    _Olcut(
                      label: 'Veri',
                      value: '${a['dataConfidence']}',
                      color: AppColors.textMuted,
                    ),
                  ],
                ],
              ),
            ),
            if (yorum != null && '$yorum'.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '$yorum',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11.5,
                    height: 16 / 11.5,
                  ),
                ),
              ),
            if (missing.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '⚠ ${missing.map((p) => (p as Map)['name']).join(', ')}',
                  style: const TextStyle(
                    color: AppColors.orange,
                    fontSize: 11,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _Olcut extends StatelessWidget {
  const _Olcut({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: TextStyle(
          color: AppColors.textMuted,
          fontSize: 10,
          fontWeight: AppFont.bold,
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(top: 1),
        child: Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: AppFont.black,
          ),
        ),
      ),
    ],
  );
}

/// `components/ResultComparisonCard.js`
///
/// Kullanıcı seçimi vs sistem önerisi vs gerçek sonuç, doğru/yanlış rengiyle.
/// Sonuç GELMEDİYSE satır nötr kalır (⏳) — erken "yanlış" damgası vurulmaz.
///
/// ÜÇÜNCÜ DURUM (2026-08-11, emülatörde yakalandı): sonuç GELDİ ama maç
/// DEĞERLENDİRİLEMEDİ (isCorrect == null; ör. mühürde tekli ana tahmin yok).
/// Eski hâl bunu ✗/kırmızı basıyordu — "tahmin yok" ile "yanlış"ı aynı
/// gösteriyordu. Artık nötr tire (–) çizilir; başarı paydasına da girmez.
class ResultComparisonCard extends StatelessWidget {
  const ResultComparisonCard({
    super.key,
    this.orderNo,
    this.homeTeam,
    this.awayTeam,
    this.userPick,
    this.systemPick,
    this.actualResult,
    this.isCorrect,
  });

  final Object? orderNo;
  final String? homeTeam;
  final String? awayTeam;
  final String? userPick;
  final String? systemPick;
  final String? actualResult;
  final bool? isCorrect;

  @override
  Widget build(BuildContext context) {
    final pending = actualResult == null;
    // Değerlendirilmemiş: sonuç var ama karar yok → nötr (yanlış DEĞİL).
    final degerlendirilmedi = !pending && isCorrect == null;
    final kenar = (pending || degerlendirilmedi)
        ? AppColors.border
        : (isCorrect == true ? AppColors.green : AppColors.red);

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
        border: Border(left: BorderSide(color: kenar, width: 4)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 18,
            child: Text(
              '${orderNo ?? ''}',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
          const SizedBox(width: Spacing.sm),
          Expanded(
            child: Text(
              '$homeTeam - $awayTeam',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.bold,
              ),
            ),
          ),
          const SizedBox(width: Spacing.sm),
          _Sutun(label: 'Sen', value: userPick),
          const SizedBox(width: 10),
          _Sutun(label: 'Sistem', value: systemPick),
          const SizedBox(width: 10),
          _Sutun(
            label: 'Sonuç',
            value: pending ? '–' : actualResult,
            highlight: !pending,
          ),
          const SizedBox(width: Spacing.sm),
          SizedBox(
            width: 20,
            child: Text(
              pending
                  ? '⏳'
                  : degerlendirilmedi
                  ? '–'
                  : (isCorrect == true ? '✓' : '✗'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }
}

class _Sutun extends StatelessWidget {
  const _Sutun({required this.label, this.value, this.highlight = false});

  final String label;
  final String? value;
  final bool highlight;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 38,
    child: Column(
      children: [
        Text(
          label,
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 9,
            fontWeight: AppFont.bold,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Text(
            value ?? '–',
            style: TextStyle(
              color: highlight ? AppColors.text : AppColors.textMuted,
              fontSize: 13,
              fontWeight: highlight ? AppFont.black : AppFont.heavy,
            ),
          ),
        ),
      ],
    ),
  );
}
