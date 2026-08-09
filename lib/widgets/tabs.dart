// KAYNAK: app/src/ui.js → `Tabs`, `Accordion`, `SectionCard`, `SurpriseBadge`
//
// Yatay kaydırılabilir ana sekmeler ve açılır-kapanır bölüm. Ölçüler kaynaktaki
// StyleSheet'ten birebir.

import 'package:flutter/material.dart';

import '../core/labels.dart';
import '../core/theme/tokens.dart';

/// `ui.js` → `Tabs`
class AppTabs extends StatelessWidget {
  const AppTabs({
    super.key,
    required this.tabs,
    required this.active,
    required this.onChange,
    this.icons = const {},
  });

  final List<String> tabs;
  final String active;
  final ValueChanged<String> onChange;
  final Map<String, String> icons;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bgAlt,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
        child: Row(
          children: [
            for (final t in tabs) ...[
              GestureDetector(
                onTap: () => onChange(t),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.only(left: 14, right: 14, top: 10),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (icons[t] != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Opacity(
                            opacity: active == t ? 1 : 0.55,
                            child: Text(
                              icons[t]!,
                              style: const TextStyle(fontSize: 17),
                            ),
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          t,
                          style: TextStyle(
                            color: active == t
                                ? AppColors.text
                                : AppColors.textMuted,
                            fontSize: 13,
                            fontWeight: active == t
                                ? AppFont.black
                                : AppFont.bold,
                          ),
                        ),
                      ),
                      Container(
                        height: 3,
                        width: 40,
                        decoration: BoxDecoration(
                          color: active == t
                              ? AppColors.accent
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 2),
            ],
          ],
        ),
      ),
    );
  }
}

/// `ui.js` → `Accordion` (açılır-kapanır bölüm)
class Accordion extends StatefulWidget {
  const Accordion({
    super.key,
    required this.title,
    this.icon,
    this.defaultOpen = false,
    required this.child,
  });

  final String title;
  final String? icon;
  final bool defaultOpen;
  final Widget child;

  @override
  State<Accordion> createState() => _AccordionState();
}

class _AccordionState extends State<Accordion> {
  late bool _open = widget.defaultOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            onTap: () => setState(() => _open = !_open),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.all(Spacing.md),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${widget.icon != null ? '${widget.icon}  ' : ''}'
                      '${widget.title}',
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 14.5,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Text(
                      _open ? '▴' : '▾',
                      style: TextStyle(
                        color: _open ? AppColors.accent : AppColors.textMuted,
                        fontSize: 16,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_open)
            Container(
              padding: const EdgeInsets.only(
                left: Spacing.md,
                right: Spacing.md,
                bottom: Spacing.md,
                top: Spacing.md,
              ),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: widget.child,
            ),
        ],
      ),
    );
  }
}

/// `ui.js` → `SectionCard` (premium kart / bölüm)
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, this.title, this.right, required this.child});

  final String? title;
  final Widget? right;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(Spacing.lg),
    margin: const EdgeInsets.only(bottom: Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.lgR,
      boxShadow: AppShadow.soft,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (title != null || right != null)
          Padding(
            padding: const EdgeInsets.only(bottom: Spacing.sm),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (title != null)
                  Expanded(
                    child: Text(
                      title!,
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 15,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                  )
                else
                  const Spacer(),
                ?right,
              ],
            ),
          ),
        child,
      ],
    ),
  );
}

/// `components.js` → `SurpriseBadge`
///
/// Etiket HER ZAMAN `displayLabel`'dan geçer: veri anahtarı "BANKO" olsa bile
/// kullanıcı "GÜÇLÜ ADAY" görür. Kesinlik iması taşıyan yazı gösterilmez.
class SurpriseBadge extends StatelessWidget {
  const SurpriseBadge({
    super.key,
    required this.label,
    this.labelColor,
    this.small = false,
  });

  final Object? label;
  final String? labelColor;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final c = switch (labelColor) {
      'green' => LabelColors.green,
      'yellow' => LabelColors.yellow,
      'red' => LabelColors.red,
      'gray' => LabelColors.gray,
      _ => AppColors.gray,
    };

    return Container(
      padding: small
          ? const EdgeInsets.symmetric(horizontal: 6, vertical: 2)
          : const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        // Kaynakta `c + '22'` — %13 opaklık.
        color: c.withValues(alpha: 0x22 / 255),
        borderRadius: AppRadius.smR,
        border: Border.all(color: c),
      ),
      child: Text(
        displayLabel(label) ?? '',
        style: TextStyle(
          color: c,
          fontSize: small ? 10 : 12,
          fontWeight: AppFont.heavy,
        ),
      ),
    );
  }
}
