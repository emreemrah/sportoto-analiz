// KAYNAK: app/src/components/ScoreLegend.js — BİREBİR çeviri.
//
// Skor renk açıklaması: yeşil = resmi sonuç · sarı = henüz resmi değil ·
// kırmızı = canlı. Bu şerit "yalnız resmi sonuç kesindir" kuralının GÖRSEL
// anahtarıdır; kaldırılmaz.

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

class ScoreLegend extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  ScoreLegend({super.key});

  // GETTER, `static final` DEĞİL: `accent` takım temasıyla değişir; `final`
  // liste ilk okunduğu renkte donardı.
  static List<({Color c, String l})> get _items => [
    (c: AppColors.success, l: 'Resmi sonuç'),
    (c: AppColors.warning, l: 'Henüz resmi değil'),
    (c: AppColors.live, l: 'Canlı'),
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
                decoration: BoxDecoration(
                  // NOKTA DA ZEMİNE GÖRE TONLANIR (16 Ağustos 2026).
                  // Eskiden ham anlamsal renk basılıyordu ve bazı temalarda
                  // görünmüyordu — ölçüldü: Galatasaray sarı zeminde sarı
                  // nokta 1.24, Trabzonspor bordo zeminde canlı kırmızısı
                  // 1.68 (grafik eşiği 3:1). Bu şerit "yalnız resmî sonuç
                  // kesindir" kuralının görsel anahtarı; görünmemesi kural
                  // ihlalidir. Hue korunur, yalnız ton itilir.
                  color: AppColors.anlamsalTon(it.c, AppColors.background),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                it.l,
                style: TextStyle(
                  // SAYFA ZEMİNİ üstünde duruyor, kart değil → ters
                  // kontrast düzeninde `onBackground` ailesi.
                  color: AppColors.onBackgroundMuted,
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
