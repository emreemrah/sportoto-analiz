// KAYNAK: app/src/screens/BulletinScreen.js → `renderHistoryItem`
//
// Geçmiş bülten satırı — RESMÎ sonuç odaklı. Resmi sonuç yoksa ASLA "-" yazmaz;
// "Resmi sonuç bekleniyor" gösterir. (Geçmiş bültende canlı/geçici skor
// tutulmaz; canlı takip ayrı ekranda.)
//
// TIKLANABİLİR (2026-08-07): geçmiş bültende kart düz bir kutuydu; maçın içine
// girmenin hiçbir yolu yoktu. Oysa mühürlü haftada en değerli bilgi orada:
// maç öncesi ne demişiz, sonra ne olmuş.

import 'package:flutter/material.dart';

import '../../core/live_logic.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/form_strip.dart';
import '../../widgets/ulke_etiketi.dart';
import 'bulletin_format.dart';

class HistoryMatchCard extends StatelessWidget {
  const HistoryMatchCard({
    super.key,
    required this.item,
    this.duzeltmeVar = false,
    this.onTap,
    this.onDuzeltme,
  });

  final Map<String, dynamic> item;

  /// Bu maçta resmî sonuç DEĞİŞTİ mi (oturum içi düzeltme denetimi).
  final bool duzeltmeVar;
  final VoidCallback? onTap;
  final VoidCallback? onDuzeltme;

  @override
  Widget build(BuildContext context) {
    final resolved = officialResolved(item);
    final prov = !resolved ? item['provisional'] as Map? : null;
    final notStarted = pastStatus(item) == 'notStarted';
    final d = item['date'] != null ? matchDate(item['date'] as String?) : null;

    final prediction = item['prediction'] as Map?;
    final rawSym = prediction?['symbol'] as String?;
    final sysSym = (rawSym != null && rawSym != '-') ? rawSym : null;

    var sysMark = Isaret.none;
    if (sysSym != null) {
      sysMark = resolved
          ? (pickHits(sysSym, item['result'] as String?) == true
                ? Isaret.correct
                : Isaret.wrong)
          : Isaret.pending;
    }

    final home = item['home'] as Map?;
    final away = item['away'] as Map?;
    final analysis = item['analysis'] as Map?;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.lgR,
        border: Border.all(
          color: duzeltmeVar ? AppColors.warning : AppColors.border,
        ),
        boxShadow: AppShadow.soft,
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Ülke satırı. Geçmiş bültende lig alanı "Final" gibi tur adı
                // olabilir — ülke çıkarılamıyorsa satır çizilmez, ülke
                // uydurulmaz (gizleTanimsiz).
                Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: UlkeEtiketi(
                    league: item['league'] as String?,
                    gizleTanimsiz: true,
                  ),
                ),

                Row(
                  children: [
                    SizedBox(
                      width: 16,
                      child: Text(
                        '${item['no']}',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),

                    // ── EV SAHİBİ ──
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Logo(
                                uri: home?['logo'] as String?,
                                name: home?['name'] as String?,
                                size: 20,
                              ),
                              const SizedBox(width: 7),
                              Flexible(
                                child: Text(
                                  '${home?['name'] ?? ''}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: AppColors.text,
                                    fontSize: 13.5,
                                    fontWeight: AppFont.heavy,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          _rec(home?['record'] as Map?),
                        ],
                      ),
                    ),

                    // ── ORTA ──
                    Container(
                      constraints: const BoxConstraints(minWidth: 64),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: _orta(resolved, prov, d),
                    ),

                    // ── DEPLASMAN ──
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Flexible(
                                child: Text(
                                  '${away?['name'] ?? ''}',
                                  maxLines: 1,
                                  textAlign: TextAlign.right,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: AppColors.text,
                                    fontSize: 13.5,
                                    fontWeight: AppFont.heavy,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 7),
                              Logo(
                                uri: away?['logo'] as String?,
                                name: away?['name'] as String?,
                                size: 20,
                              ),
                            ],
                          ),
                          _rec(away?['record'] as Map?, alignRight: true),
                        ],
                      ),
                    ),
                  ],
                ),

                // ── ANALİZ ÖZETİ — yalnız başlamamış maçta ──
                if (notStarted &&
                    analysis != null &&
                    (analysis['label'] != null || analysis['favorite'] != null))
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Wrap(
                      spacing: 10,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (analysis['label'] != null)
                          _surprizRozeti(
                            '${analysis['label']}',
                            analysis['labelColor'] as String?,
                          ),
                        if (analysis['favorite'] is Map)
                          RichText(
                            text: TextSpan(
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 11.5,
                                fontWeight: AppFont.bold,
                              ),
                              children: [
                                const TextSpan(text: 'Favori '),
                                TextSpan(
                                  text:
                                      '${(analysis['favorite'] as Map)['symbol']}'
                                          .replaceAll('0', 'X'),
                                  style: TextStyle(
                                    color: AppColors.text,
                                    fontWeight: AppFont.black,
                                  ),
                                ),
                                TextSpan(
                                  text:
                                      ' · %'
                                      '${(analysis['favorite'] as Map)['percent']}'
                                      '${analysis['estimated'] == true ? ' ≈' : ''}',
                                ),
                              ],
                            ),
                          ),
                        if (analysis['surpriseScore'] != null)
                          Text(
                            'Sürpriz ${analysis['surpriseScore']}',
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 11.5,
                              fontWeight: AppFont.bold,
                            ),
                          ),
                      ],
                    ),
                  ),

                if (notStarted && _formVar(home, away))
                  Padding(
                    padding: const EdgeInsets.only(top: 7),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: FormStrip(
                            form: home?['form'] as List?,
                            size: 15,
                          ),
                        ),
                        Text(
                          'son maçlar',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 10,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                        Flexible(
                          child: FormStrip(
                            form: away?['form'] as List?,
                            size: 15,
                          ),
                        ),
                      ],
                    ),
                  ),

                // ── AYRAÇ ──
                Container(
                  height: 1,
                  margin: const EdgeInsets.only(top: 12, bottom: 9),
                  color: AppColors.border,
                ),

                // ── ALT ──
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _durumYazisi(resolved, notStarted, prov),
                          const SizedBox(height: 3),
                          _tahminSatiri(sysSym, sysMark),
                        ],
                      ),
                    ),
                    if (duzeltmeVar) ...[
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: onDuzeltme,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.warningSoft,
                            borderRadius: AppRadius.smR,
                            border: Border.all(color: AppColors.warning),
                          ),
                          child: const Text(
                            'Düzeltme',
                            style: TextStyle(
                              color: Color(0xFF7A4A00),
                              fontSize: 10.5,
                              fontWeight: AppFont.black,
                            ),
                          ),
                        ),
                      ),
                    ],
                    // Tıklanabilir olduğunu belli eden tek işaret.
                    Padding(
                      padding: EdgeInsets.only(left: 6),
                      child: Text(
                        '›',
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 20,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _rec(Map? r, {bool alignRight = false}) {
    if (r == null) return const SizedBox.shrink();
    // Geçmiş bültende kayıt alanları kısa adlı: w/d/l/p.
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Align(
        alignment: alignRight ? Alignment.centerRight : Alignment.centerLeft,
        child: RecordBadges(
          wins: _i(r['w']),
          draws: _i(r['d']),
          losses: _i(r['l']),
          played: _iN(r['p']),
          alignRight: alignRight,
        ),
      ),
    );
  }

  /// CANLI MAÇTA SKOR GÖSTERİLMEZ (kullanıcı kararı, 2 Ağustos 2026).
  /// Yalnız maçın oynanmakta olduğu belirtilir — projenin "yalnız resmî 90
  /// dakika sonucu kesindir" kuralıyla aynı yönde. Skordan türetilen 1/X/2
  /// harfi de yazılmaz.
  Widget _orta(bool resolved, Map? prov, MatchDateParts? d) {
    if (!resolved && prov != null && prov['live'] == true) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'CANLI',
            style: TextStyle(
              color: AppColors.accent,
              fontSize: 15,
              fontWeight: AppFont.black,
              letterSpacing: 1.5,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Text(
              prov['minute'] != null ? "${prov['minute']}'" : 'oynanıyor',
              style: TextStyle(
                color: AppColors.textSoft,
                fontSize: 11,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
        ],
      );
    }

    // NOTER KARARI (ertelenen maç): resmî işaret VAR, skor YOK — skor yerine
    // 'NOTER' yazılır (2026-08-10; skor uydurulmaz, "$h - $a" null basardı).
    if (resolved && item['viaNotary'] == true) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'NOTER',
            style: TextStyle(
              color: AppColors.success,
              fontSize: 13,
              fontWeight: AppFont.black,
              letterSpacing: 1.2,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Text(
              '${item['result'] ?? ''}',
              style: const TextStyle(
                color: AppColors.success,
                fontSize: 15,
                fontWeight: AppFont.black,
              ),
            ),
          ),
        ],
      );
    }

    if (resolved || prov != null) {
      // RESMÎ ile GEÇİCİ sonuç ayrımı RENKLE YETİNMEZ, YAZIYLA da söylenir.
      // Renk tek ayırt ediciyken renk körü kullanıcı — ya da rengin anlamını
      // bilmeyen herkes — türetilmiş bir sonucu resmî sanıyordu.
      final sc = (resolved ? item['score'] : prov!['score']) as Map;
      final col = resolved ? AppColors.success : AppColors.warning;
      final h = sc['home'];
      final a = sc['away'];
      final res = resolved
          ? item['result'] as String?
          : (h is num && a is num ? (h > a ? '1' : (h < a ? '2' : 'X')) : null);

      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$h - $a',
            style: TextStyle(
              color: col,
              fontSize: 18,
              fontWeight: AppFont.black,
              letterSpacing: 1,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Text(
              res ?? '',
              style: TextStyle(
                color: col,
                fontSize: 12,
                fontWeight: AppFont.black,
              ),
            ),
          ),
          if (!resolved)
            const Padding(
              padding: EdgeInsets.only(top: 1),
              child: Text(
                'geçici · resmî değil',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.warning,
                  fontSize: 9.5,
                  fontWeight: AppFont.heavy,
                ),
              ),
            ),
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          d != null ? d.time : '—',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 14,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          d != null ? d.day : '',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.muted,
            fontSize: 10,
            fontWeight: AppFont.bold,
          ),
        ),
      ],
    );
  }

  Widget _durumYazisi(bool resolved, bool notStarted, Map? prov) {
    if (resolved && item['viaNotary'] == true) {
      // Ertelenen maç: sonuç noter kararıyla — skor değil karar resmî.
      return const Text(
        'Ertelendi · Noter Kararı',
        style: TextStyle(
          color: AppColors.success,
          fontSize: 11,
          fontWeight: AppFont.black,
          letterSpacing: 0.2,
        ),
      );
    }
    if (resolved) {
      return const Text(
        'MS · Resmi Sonuç',
        style: TextStyle(
          color: AppColors.success,
          fontSize: 11,
          fontWeight: AppFont.black,
          letterSpacing: 0.2,
        ),
      );
    }
    if (notStarted) {
      return Text(
        'Başlamadı',
        style: TextStyle(
          color: AppColors.muted,
          fontSize: 11,
          fontWeight: AppFont.heavy,
        ),
      );
    }
    if (prov != null && prov['live'] == true) {
      return Text(
        "🔴 CANLI${prov['minute'] != null ? " ${prov['minute']}'" : ''}",
        style: TextStyle(
          color: AppColors.accent,
          fontSize: 11,
          fontWeight: AppFont.black,
          letterSpacing: 0.2,
        ),
      );
    }
    return Text(
      prov != null && prov['finished'] == true
          ? 'Bitti · resmi sonuç bekleniyor'
          : 'Resmi sonuç bekliyor',
      style: const TextStyle(
        color: AppColors.warning,
        fontSize: 11,
        fontWeight: AppFont.black,
        letterSpacing: 0.2,
      ),
    );
  }

  Widget _tahminSatiri(String? sysSym, Isaret sysMark) {
    final gosterim = sysSym == null
        ? '—'
        : sysSym.split('').map((c) => c == '0' ? 'X' : c).join('-');

    final label = TextStyle(
      color: AppColors.muted,
      fontSize: 11,
      fontWeight: AppFont.heavy,
    );

    return RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: TextStyle(fontSize: 12, color: AppColors.text),
        children: [
          TextSpan(text: 'Sen ', style: label),
          TextSpan(
            text: 'Kupon yok',
            style: TextStyle(
              color: AppColors.textSoft,
              fontWeight: AppFont.bold,
            ),
          ),
          TextSpan(
            text: '    ·    ',
            style: TextStyle(color: AppColors.border),
          ),
          TextSpan(text: 'Sistem ', style: label),
          TextSpan(
            text: gosterim,
            style: TextStyle(color: AppColors.text, fontWeight: AppFont.black),
          ),
          if (sysMark != Isaret.none)
            TextSpan(text: ' ${kIsaretMetni[sysMark]}'),
        ],
      ),
    );
  }

  /// `components.js` → `SurpriseBadge` (small)
  Widget _surprizRozeti(String label, String? labelColor) {
    final c = switch (labelColor) {
      'green' => AppColors.success,
      'yellow' => AppColors.warning,
      'red' => AppColors.danger,
      _ => AppColors.muted,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0x22 / 255),
        borderRadius: AppRadius.smR,
        border: Border.all(color: c),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: c,
          fontSize: 10,
          fontWeight: AppFont.black,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  bool _formVar(Map? home, Map? away) {
    final h = home?['form'] as List?;
    final a = away?['form'] as List?;
    return (h != null && h.isNotEmpty) || (a != null && a.isNotEmpty);
  }

  static int _i(Object? v) => v is num ? v.toInt() : 0;
  static int? _iN(Object? v) => v is num ? v.toInt() : null;
}
