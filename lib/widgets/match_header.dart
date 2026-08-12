// KAYNAK: app/src/ui.js → `MatchHeader`
//
// Maç detayının kendi premium başlığı. Alt sekme yığınının native başlığı bu
// ekranda GİZLİDİR (App.js: `headerShown: false`) — çünkü başlığın içinde
// takımlar, lig, saat ve stadyum var.

import 'package:flutter/material.dart';

import '../core/brand.dart';
import '../core/theme/tokens.dart';
import 'app_ui.dart';

class MatchHeader extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  MatchHeader({
    super.key,
    required this.home,
    required this.away,
    this.homeLogo,
    this.awayLogo,
    this.league,
    this.dateLabel,
    required this.time,
    this.stadium,
    this.onBack,
    this.onShare,
    this.onHomePress,
    this.onAwayPress,
  });

  final String home;
  final String away;
  final String? homeLogo;
  final String? awayLogo;
  final String? league;
  final String? dateLabel;
  final String time;
  final String? stadium;
  final VoidCallback? onBack;
  final VoidCallback? onShare;
  final VoidCallback? onHomePress;
  final VoidCallback? onAwayPress;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(bottom: Spacing.lg),
      decoration: BoxDecoration(
        color: AppColors.bgAlt,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          // ── üst çubuk: geri · marka · yıldız ──
          Padding(
            padding: const EdgeInsets.only(
              left: Spacing.md,
              right: Spacing.md,
              top: Spacing.md,
              bottom: Spacing.sm,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Semantics(
                  button: true,
                  label: 'Geri',
                  child: GestureDetector(
                    onTap: onBack,
                    behavior: HitTestBehavior.opaque,
                    // Kaynaktaki hitSlop 10 → dokunma alanı büyütülür.
                    child: Padding(
                      padding: EdgeInsets.all(10),
                      child: Icon(
                        Icons.chevron_left,
                        size: 30,
                        color: AppColors.text,
                      ),
                    ),
                  ),
                ),
                Column(
                  children: [
                    // BAŞLIK İKONU AYRI WIDGET: emojiyken rengi metinden
                    // bağımsızdı ve koyu/takım temasında başlık koyulaşırken
                    // top olduğu gibi kalıyordu.
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.sports_soccer,
                          size: 16,
                          color: AppColors.text,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          kAppNameUpper,
                          style: TextStyle(
                            color: AppColors.text,
                            fontSize: 16,
                            fontWeight: AppFont.black,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                    Padding(
                      padding: EdgeInsets.only(top: 1),
                      child: Text(
                        'BAĞIMSIZ ANALİZ UYGULAMASI',
                        style: TextStyle(
                          color: AppColors.accent,
                          fontSize: 8.5,
                          fontWeight: AppFont.heavy,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: onShare,
                  behavior: HitTestBehavior.opaque,
                  child: const Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(
                      Icons.star_border,
                      size: 24,
                      color: AppColors.gold,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── ana blok: takımlar + orta ──
          Padding(
            padding: const EdgeInsets.only(
              left: Spacing.lg,
              right: Spacing.lg,
              top: Spacing.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _takim(home, homeLogo, onHomePress)),
                SizedBox(
                  width: 116,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Column(
                      children: [
                        if (league != null && league!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              league!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 10.5,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                          ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const _Tire(),
                            const SizedBox(width: 10),
                            Column(
                              children: [
                                if (dateLabel != null && dateLabel!.isNotEmpty)
                                  Text(
                                    dateLabel!,
                                    style: TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 11,
                                      fontWeight: AppFont.bold,
                                    ),
                                  ),
                                Text(
                                  time,
                                  style: TextStyle(
                                    color: AppColors.text,
                                    fontSize: 21,
                                    fontWeight: AppFont.black,
                                    letterSpacing: 1,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(width: 10),
                            const _Tire(),
                          ],
                        ),
                        if (stadium != null && stadium!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              stadium!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 10.5,
                                fontWeight: AppFont.semibold,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                Expanded(child: _takim(away, awayLogo, onAwayPress)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _takim(String ad, String? logo, VoidCallback? onTap) {
    final icerik = Column(
      children: [
        Logo(uri: logo, name: ad, size: 50),
        const SizedBox(height: 8),
        Text(
          ad,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 14,
            fontWeight: AppFont.heavy,
          ),
        ),
        // Fikstür bağlantısı yalnız kaynak takım kimliği VARSA çizilir —
        // tıklanıp boş açılan bir kart olmaz.
        if (onTap != null)
          Padding(
            padding: EdgeInsets.only(top: 0),
            child: Text(
              'maçlar ›',
              style: TextStyle(
                color: AppColors.accent,
                fontSize: 10,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
      ],
    );

    if (onTap == null) return icerik;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: icerik,
    );
  }
}

class _Tire extends StatelessWidget {
  const _Tire();

  @override
  Widget build(BuildContext context) => Text(
    '-',
    style: TextStyle(
      color: AppColors.textMuted,
      fontSize: 16,
      fontWeight: AppFont.heavy,
    ),
  );
}
