// KAYNAK: app/src/components/LegacyRadarCard.js — BİREBİR çeviri.
//
// LEGACY SÜRPRİZ RADARI KARTI — Radar Merkezi ÖNCESİ haftaların görünümü.
//
// BU KOD DONMUŞTUR. Eski haftalar kullanıcıya o hafta göründüğü gibi
// gösterilmelidir; yeni sistemin dili, rozetleri veya hesapları buraya
// SIZDIRILMAZ. Geriye dönük "iyileştirme" yapılırsa arşiv, gerçekte hiç
// var olmamış bir görüntüyü sunmaya başlar.
//
// Ekrandan ayrılma nedeni sadece boyut değil: karışmaması gereken iki sistem
// aynı dosyada durdukça, birinde yapılan bir düzeltme kazara diğerine
// geçebiliyordu.
//
// Yeni başlangıç kararı gereği bu görünümde de BAŞARI YÜZDESİ yoktur; yalnız
// o haftanın kendi mühürlü çıktısı ve (varsa) resmî sonucu görünür.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../widgets/form_strip.dart';
import '../../widgets/tabs.dart';
import 'radar_screen_data.dart';

/// Ev sahibi / deplasman işareti — takım adının yanında tutarlı ikon.
/// Ev = ev ikonu, Deplasman = uçak. (PNG'ler opak olduğundan renklendirme
/// KULLANILMAZ; ikonlar olduğu gibi, beyaz kart üstünde gösterilir.)
class VenueMark extends StatelessWidget {
  const VenueMark({super.key, this.side = 'home', this.size = 15});

  final String side;
  final double size;

  @override
  Widget build(BuildContext context) {
    final isAway = side == 'away' || side == '2' || side == 'dep';
    return Image.asset(
      isAway ? 'assets/venue/away-win.png' : 'assets/venue/home-win.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
    );
  }
}

class LegacyRadarCard extends StatelessWidget {
  const LegacyRadarCard({
    super.key,
    required this.item,
    required this.index,
    required this.legacyView,
    required this.expanded,
    required this.onToggle,
    required this.onDetail,
  });

  final Map item;

  /// Liste sırası (kart numarası).
  final int index;

  /// 'r1' (tam kart) | diğer (yalnız sinyal satırı)
  final String legacyView;
  final bool expanded;
  final VoidCallback onToggle;
  final VoidCallback onDetail;

  @override
  Widget build(BuildContext context) {
    final c = switch (item['labelColor']) {
      'green' => LabelColors.green,
      'yellow' => LabelColors.yellow,
      'red' => LabelColors.red,
      'gray' => LabelColors.gray,
      _ => AppColors.gray,
    };
    final p = item['probabilities'] as Map?;
    final sig = item['signals'] as Map?;
    final factors = (item['factors'] as List?) ?? const [];

    // Sinyal özeti: yalnız GERÇEKTEN gelen alanlar yazılır. Eksik olan sessizce
    // atlanır — yerine sıfır/tire basılmaz (num1 null döner, satır düşer).
    final bits = <String>[];
    final pos = sig?['position'] as Map?;
    if (pos != null) {
      bits.add('Sıra ${ord(pos['home'])} – ${ord(pos['away'])}');
    }
    final venue = sig?['venue'] as Map?;
    if (venue != null && (venue['home'] != null || venue['away'] != null)) {
      bits.add(
        'İç/Dış ${wdl(venue['home'] as Map?) ?? '—'} · '
        '${wdl(venue['away'] as Map?) ?? '—'}',
      );
    }
    final xg = sig?['xg'] as Map?;
    if (xg != null) {
      final xh = num1(xg['homeVenue'] ?? xg['home']);
      final xa = num1(xg['awayVenue'] ?? xg['away']);
      if (xh != null && xa != null) bits.add('xG $xh – $xa');
    }
    final goals = sig?['goals'] as Map?;
    if (goals != null) {
      final gh = num1((goals['home'] as Map?)?['for']);
      final ga = num1((goals['away'] as Map?)?['for']);
      if (gh != null && ga != null) bits.add('Gol/maç $gh – $ga');
    }

    final score = item['score'] as Map?;
    final favorite = item['favorite'] as Map?;
    final form = sig?['form'] as Map?;

    return GestureDetector(
      onTap: onToggle,
      child: Container(
        margin: const EdgeInsets.only(bottom: Spacing.sm),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: expanded
              ? Border.all(color: AppColors.primary, width: 1.5)
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                SizedBox(
                  width: 22,
                  child: Text(
                    '${index + 1}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 16,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ),
                const SizedBox(width: Spacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          const VenueMark(side: 'home', size: 14),
                          const SizedBox(width: 4),
                          Flexible(child: _takim('${item['home'] ?? ''}')),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 5),
                            child: Text(
                              '–',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 13,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                          ),
                          const VenueMark(side: 'away', size: 14),
                          const SizedBox(width: 4),
                          Flexible(child: _takim('${item['away'] ?? ''}')),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(3),
                          child: Container(
                            height: 6,
                            color: AppColors.cardAlt,
                            child: FractionallySizedBox(
                              alignment: Alignment.centerLeft,
                              widthFactor:
                                  ((item['surpriseScore'] as num?) ?? 0)
                                      .clamp(0, 100)
                                      .toDouble() /
                                  100,
                              child: Container(color: c),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: Spacing.md),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${item['surpriseScore']}',
                      style: TextStyle(
                        color: c,
                        fontSize: 18,
                        fontWeight: AppFont.black,
                      ),
                    ),
                    const SizedBox(height: 4),
                    SurpriseBadge(
                      label: item['label'],
                      labelColor: item['labelColor'] as String?,
                      small: true,
                    ),
                  ],
                ),
              ],
            ),

            if (item['result'] != null && score != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Flexible(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            const TextSpan(text: 'Sonuç: '),
                            TextSpan(
                              text: '${item['result']}',
                              style: const TextStyle(
                                color: AppColors.text,
                                fontWeight: AppFont.black,
                              ),
                            ),
                            TextSpan(
                              text:
                                  ' · ${score['home']}-${score['away']}',
                            ),
                          ],
                        ),
                        style: const TextStyle(
                          color: AppColors.textSoft,
                          fontSize: 12,
                          fontWeight: AppFont.bold,
                        ),
                      ),
                    ),
                    if (item['favHit'] != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: item['favHit'] == true
                              ? AppColors.success
                              : AppColors.danger,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          item['favHit'] == true
                              ? '✓ Favori tuttu'
                              : '✗ Sürpriz oldu',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 10.5,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),

            if (legacyView == 'r1') ...[
              if (favorite != null || p != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (favorite != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.cardAlt,
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            // "≈": yüzde ORANDAN değil formdan türetilmiş. Bu
                            // işaret kaldırılırsa tahmini sayı piyasa oranı
                            // sanılır.
                            'Favori ${favorite['symbol']} · %${favorite['percent']}'
                            '${item['estimated'] == true ? ' ≈' : ''}',
                            style: const TextStyle(
                              color: AppColors.text,
                              fontSize: 11.5,
                              fontWeight: AppFont.black,
                            ),
                          ),
                        ),
                      if (p != null)
                        Text(
                          '1 %${p['1']} · X %${p['X']} · 2 %${p['2']}',
                          style: const TextStyle(
                            color: AppColors.textSoft,
                            fontSize: 11.5,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                    ],
                  ),
                ),
              if (bits.isNotEmpty) _sinyaller(bits.join('   ·   '), expanded ? 2 : 1),
              if (form != null &&
                  ((form['home'] as List?)?.isNotEmpty == true ||
                      (form['away'] as List?)?.isNotEmpty == true))
                Padding(
                  padding: const EdgeInsets.only(top: 7),
                  child: Row(
                    children: [
                      const Text(
                        'Form',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10.5,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                      const SizedBox(width: 6),
                      FormStrip(form: form['home'] as List?, size: 16),
                      const SizedBox(width: 6),
                      const Text(
                        '—',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10,
                        ),
                      ),
                      const SizedBox(width: 6),
                      FormStrip(form: form['away'] as List?, size: 16),
                    ],
                  ),
                ),
              if (factors.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 7),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final f
                          in (expanded
                              ? factors
                              : factors.take(3).toList()).cast<Map>())
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(text: '• ${f['label']} '),
                                TextSpan(
                                  text: '+${f['points']}',
                                  style: const TextStyle(
                                    color: AppColors.warning,
                                    fontWeight: AppFont.black,
                                  ),
                                ),
                              ],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.textSoft,
                              fontSize: 11.5,
                              fontWeight: AppFont.semibold,
                              height: 16 / 11.5,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              if (item['comment'] != null && '${item['comment']}'.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 7),
                  child: Text(
                    '${item['comment']}',
                    maxLines: expanded ? null : 2,
                    overflow: expanded ? null : TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                      height: 15 / 11,
                    ),
                  ),
                ),
            ] else
              // Radar 2 görünümü: yalnız sinyal satırı. Veri yoksa dürüst not.
              _sinyaller(
                bits.isNotEmpty
                    ? bits.join('   ·   ')
                    : 'İstatistik verisi bulunamadı.',
                2,
              ),

            Container(
              margin: const EdgeInsets.only(top: 10),
              padding: const EdgeInsets.only(top: 8),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  GestureDetector(
                    onTap: onDetail,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSoft,
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Text(
                        'Analiz ›',
                        style: TextStyle(
                          color: AppColors.textSoft,
                          fontSize: 11.5,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _takim(String ad) => Text(
    ad,
    maxLines: 1,
    overflow: TextOverflow.ellipsis,
    style: const TextStyle(
      color: AppColors.text,
      fontSize: 14,
      fontWeight: AppFont.bold,
    ),
  );

  static Widget _sinyaller(String t, int satir) => Padding(
    padding: const EdgeInsets.only(top: 7),
    child: Text(
      t,
      maxLines: satir,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 11,
        fontWeight: AppFont.bold,
      ),
    ),
  );
}
