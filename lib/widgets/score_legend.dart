// KAYNAK: app/src/components/ScoreLegend.js — BİREBİR çeviri.
//
// Skor renk açıklaması: yeşil = resmi sonuç · sarı = henüz resmi değil ·
// kırmızı = canlı. Bu şerit "yalnız resmi sonuç kesindir" kuralının GÖRSEL
// anahtarıdır; kaldırılmaz.

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

class ScoreLegend extends StatelessWidget {
  const ScoreLegend({super.key});

  static const _items = <({Color c, String l})>[
    (c: AppColors.success, l: 'Resmi sonuç'),
    (c: AppColors.warning, l: 'Henüz resmi değil'),
    (c: AppColors.accent, l: 'Canlı'),
  ];

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(
      left: Spacing.md,
      right: Spacing.md,
      bottom: Spacing.sm,
    ),
    child: Wrap(
      spacing: 14,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final it in _items)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: it.c, shape: BoxShape.circle),
              ),
              const SizedBox(width: 5),
              Text(
                it.l,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10.5,
                  fontWeight: AppFont.bold,
                ),
              ),
            ],
          ),
      ],
    ),
  );
}
