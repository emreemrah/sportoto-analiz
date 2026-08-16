// KAYNAK: app/src/components/DashboardUI.js — BİREBİR çeviri.
//
// Dashboard tasarım kiti — futbol analiz paneli hissi. Koyu "hero" panel + açık
// metrik kartları + bölümler + görünüm modu + filtre çubuğu + boş durum + barlar.
// Tüm renkler temadan; hem Kullanıcı Paneli hem Sistem Karnesi bunu kullanır.

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

Color _toneColor(Object? tone) {
  if (tone is Color) return tone;
  return switch (tone) {
    'primary' => AppColors.primary,
    'success' => AppColors.success,
    'warning' => AppColors.warning,
    'danger' => AppColors.danger,
    'info' => AppColors.info,
    'neutral' => AppColors.textSoft,
    _ => AppColors.primary,
  };
}

typedef HeroMetric = ({String value, String label, Object? tone});

/// Koyu hero panel: başlık + alt metin + öne çıkan metrikler.
class DashboardHero extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  DashboardHero({
    super.key,
    required this.title,
    this.subtitle,
    this.kicker,
    this.metrics = const [],
    this.right,
  });

  final String title;
  final String? subtitle;
  final String? kicker;
  final List<HeroMetric> metrics;
  final Widget? right;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(Spacing.lg),
    decoration: BoxDecoration(
      // HERO KENDİ TOKENİYLE BOYANIR (16 Ağustos 2026 denetimi).
      //
      // Burada `primary` kullanılıyordu; oysa tema hero için AYRI bir yüzey
      // tanımlıyor (`heroZemin`) ve hero yazıları (`onHero`/`onHeroSoft`) tam
      // O YÜZEYE göre türetiliyor (bkz. takim_gorunumu.dart). Yüzey `primary`
      // olunca yazılar başka bir yüzeyin renginden geliyordu ve takım
      // temasında Sistem Karnesi başlığı okunmuyordu (ölçüldü:
      // `t18_sistem_karnesi.png` — "Sistem Master Analiz Karnesi" silik).
      //
      // Ana sayfadaki hero zaten `heroZemin` kullanıyor; iki hero ayrışmasın.
      color: AppColors.heroZemin,
      borderRadius: BorderRadius.circular(AppRadius.xl),
      boxShadow: AppShadow.card,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (kicker != null)
                    Text(
                      kicker!.toUpperCase(),
                      // Kartın zemini `AppColors.primary` — yazılar ona göre
                      // hesaplanır. Eskiden marka laciverdine göre seçilmiş
                      // sabit grilerdi ve sarı temalı takımda okunmuyordu.
                      style: TextStyle(
                        color: AppColors.onHeroSoft,
                        fontSize: 10.5,
                        fontWeight: AppFont.black,
                        letterSpacing: 1.2,
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      title,
                      style: TextStyle(
                        color: AppColors.onHero,
                        fontSize: 21,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ),
                  if (subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        subtitle!,
                        style: TextStyle(
                          color: AppColors.onHeroSoft,
                          fontSize: 12,
                          fontWeight: AppFont.semibold,
                          height: 16 / 12,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            ?right,
          ],
        ),
        if (metrics.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: Spacing.lg),
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.darkCardSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  for (var i = 0; i < metrics.length; i++)
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        decoration: i > 0
                            ? BoxDecoration(
                                border: Border(
                                  left: BorderSide(color: AppColors.darkBorder),
                                ),
                              )
                            : null,
                        child: Column(
                          children: [
                            Text(
                              metrics[i].value,
                              style: TextStyle(
                                color: metrics[i].tone != null
                                    ? _toneColor(metrics[i].tone)
                                    : AppColors.onDark,
                                fontSize: 22,
                                fontWeight: AppFont.black,
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Text(
                                metrics[i].label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                // İç kutunun zemini `darkCardSoft`.
                                style: TextStyle(
                                  color: AppColors.onDarkSoft,
                                  fontSize: 10,
                                  fontWeight: AppFont.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
      ],
    ),
  );
}

/// Açık metrik kartı: değer + etiket + küçük açıklama.
class DashboardMetric extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  DashboardMetric({
    super.key,
    required this.value,
    required this.label,
    this.hint,
    this.tone = 'primary',
    this.icon,
  });

  final String value;
  final String label;
  final String? hint;
  final Object tone;
  final String? icon;

  @override
  Widget build(BuildContext context) {
    final c = _toneColor(tone);
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    // Kaynakta `c + '18'` → rengin %9'u.
                    color: c.withValues(alpha: 0x18 / 0xFF),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    icon!,
                    style: TextStyle(
                      color: c,
                      fontSize: 13,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c,
                    fontSize: 22,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.textSoft,
                fontSize: 12,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
          if (hint != null)
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(
                hint!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10.5,
                  fontWeight: AppFont.semibold,
                  height: 14 / 10.5,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Bölüm başlığı.
class DashboardSection extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  DashboardSection({
    super.key,
    required this.title,
    this.count,
    this.sub,
    this.right,
    this.danger = false,
  });

  final String title;
  final Object? count;
  final String? sub;
  final Widget? right;
  final bool danger;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: Spacing.xl, bottom: Spacing.sm),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: RichText(
                text: TextSpan(
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 16,
                    fontWeight: AppFont.black,
                  ),
                  children: [
                    TextSpan(text: title),
                    if (count != null)
                      TextSpan(
                        text: '  $count',
                        style: TextStyle(
                          color: danger
                              ? AppColors.danger
                              : AppColors.textMuted,
                          fontSize: 15,
                          fontWeight: AppFont.black,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            ?right,
          ],
        ),
        if (sub != null)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              sub!,
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11.5,
                fontWeight: AppFont.semibold,
              ),
            ),
          ),
      ],
    ),
  );
}

/// Görünüm modu: Sade / Detaylı / Teknik.
class ViewModeToggle extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  ViewModeToggle({super.key, required this.value, required this.onChange});

  final String? value;
  final ValueChanged<String> onChange;

  static const List<({String k, String l})> _modes = [
    (k: 'simple', l: 'Sade'),
    (k: 'detailed', l: 'Detaylı'),
    (k: 'technical', l: 'Teknik'),
  ];

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(3),
    decoration: BoxDecoration(
      color: AppColors.cardAlt,
      borderRadius: BorderRadius.circular(AppRadius.md),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < _modes.length; i++) ...[
          if (i > 0) const SizedBox(width: 2),
          GestureDetector(
            onTap: () => onChange(_modes[i].k),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: value == _modes[i].k
                  ? BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                      boxShadow: AppShadow.soft,
                    )
                  : null,
              child: Text(
                _modes[i].l,
                style: TextStyle(
                  color: value == _modes[i].k
                      ? AppColors.primary
                      : AppColors.textMuted,
                  fontSize: 12,
                  fontWeight: AppFont.heavy,
                ),
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

/// Yatay filtre çubuğu.
class FilterBar extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  FilterBar({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
  });

  final List<({String key, String label})> options;
  final String? value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(
      children: [
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) const SizedBox(width: 7),
          GestureDetector(
            onTap: () => onChange(options[i].key),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
              decoration: BoxDecoration(
                // SEÇİLİ ÇİP ZEMİNDE DURUYOR (16 Ağustos 2026 denetimi).
                //
                // Dolgu `primary`ydi; takım temasının "birinci renk" modunda
                // sayfa zemini de o aileden olduğu için seçili çip kayboluyor,
                // sekme adı yalın yazı gibi kalıyordu (ölçüldü:
                // `t18_sistem_karnesi.png` — "Özet" çipsiz görünüyor).
                // Kullanıcı kararıyla aynı dil: KART dolgusu, SARI (primary)
                // çerçeve ve yazı.
                color: value == options[i].key
                    ? AppColors.card
                    : AppColors.cardAlt,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(
                  color: value == options[i].key
                      ? AppColors.primary
                      : AppColors.border,
                  width: value == options[i].key ? 1.5 : 1,
                ),
              ),
              child: Text(
                options[i].label,
                style: TextStyle(
                  color: value == options[i].key
                      ? AppColors.primary
                      : AppColors.textSoft,
                  fontSize: 12,
                  fontWeight: AppFont.heavy,
                ),
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

/// Etiketli oran barı.
///
/// Renk eşiği kaynaktan: %60+ yeşil, %45+ sarı, altı kırmızı. Bu renk bir
/// "kazanır/kaybeder" iddiası DEĞİL, yalnız ölçünün nerede durduğudur.
class MetricBar extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  MetricBar({
    super.key,
    required this.label,
    required this.value,
    this.total,
    this.color,
    this.suffix = '%',
  });

  final String label;
  final num value;
  final Object? total;
  final Color? color;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    final c =
        color ??
        (value >= 60
            ? AppColors.success
            : (value >= 45 ? AppColors.warning : AppColors.danger));
    final safe = value.clamp(0, 100).toDouble();
    return Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: RichText(
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  text: TextSpan(
                    style: TextStyle(
                      color: AppColors.textSoft,
                      fontSize: 12,
                      fontWeight: AppFont.bold,
                    ),
                    children: [
                      TextSpan(text: label),
                      if (total != null)
                        TextSpan(
                          text: '  ($total)',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '$value$suffix',
                style: TextStyle(
                  color: c,
                  fontSize: 13,
                  fontWeight: AppFont.black,
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: Container(
              height: 8,
              color: AppColors.bgAlt,
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: safe / 100,
                child: ColoredBox(color: c),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Profesyonel boş durum.
class DashboardEmpty extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  DashboardEmpty({
    super.key,
    this.icon = Icons.bar_chart,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  /// VEKTÖR ikon, emoji DEĞİL (kullanıcı isteği, 2026-08-12).
  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(minHeight: 320),
    padding: const EdgeInsets.all(32),
    alignment: Alignment.center,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 48, color: AppColors.textSoft),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.text,
              fontSize: 17,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        if (message != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Text(
                message!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 13,
                  fontWeight: AppFont.semibold,
                  height: 19 / 13,
                ),
              ),
            ),
          ),
        if (actionLabel != null && onAction != null)
          Padding(
            padding: const EdgeInsets.only(top: 18),
            child: GestureDetector(
              onTap: onAction,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 22,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(
                  actionLabel!,
                  style: TextStyle(
                    color: AppColors.onPrimary,
                    fontSize: 13.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );
}
