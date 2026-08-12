// GÖRÜNÜM TERCİHİ — AÇIK / KOYU / SİSTEM (kullanıcı isteği, 2026-08-12)
//
// Uygulamanın açık/koyu görünümünü kullanıcı buradan seçer. Tercih kalıcıdır
// (`prefs` → `gorunumModu`) ve varsayılanı SİSTEM'dir.
//
// FAVORİ TAKIMLA İLİŞKİSİ YOK: takım seçimi profilde durur ve arma, filigran
// ve küçük kimlik vurgularında kullanılır; uygulamanın zemini, metni, kartı
// ve navigasyonu YALNIZ buradaki tercihe bakar (bkz. core/theme/gorunum.dart).
//
// SEÇİM ANINDA UYGULANIR: `gorunumModuAyarla` hem diske yazar hem kökteki
// dinleyiciyi tetikler; ekran kapanmadan sonuç görünür.

import 'package:flutter/material.dart';

import '../../core/theme/gorunum.dart';
import '../../core/theme/tokens.dart';

class GorunumSecimScreen extends StatefulWidget {
  const GorunumSecimScreen({super.key});

  @override
  State<GorunumSecimScreen> createState() => _GorunumSecimScreenState();
}

class _GorunumSecimScreenState extends State<GorunumSecimScreen> {
  late GorunumModu _secili = gorunumModu();

  /// Her seçeneğin ne yaptığını TEK CÜMLEYLE söyler. "Sistem"in ne demek
  /// olduğu herkes için açık değil; tahmin ettirmek yerine yazılır.
  static String _aciklama(GorunumModu m) => switch (m) {
    GorunumModu.sistem =>
      'Cihazın açık/koyu ayarı neyse uygulama da onu izler.',
    GorunumModu.acik => 'Uygulama her zaman açık görünümde açılır.',
    GorunumModu.koyu => 'Uygulama her zaman koyu görünümde açılır.',
  };

  void _sec(GorunumModu m) {
    if (m == _secili) return;
    setState(() => _secili = m);
    gorunumModuAyarla(m);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Görünüm')),
    body: ListView(
      padding: const EdgeInsets.all(Spacing.lg),
      children: [
        Text(
          'Uygulamanın Görünümü',
          style: TextStyle(
            color: AppColors.text,
            fontSize: AppFont.xl,
            fontWeight: AppFont.black,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: Spacing.lg),
          child: Text(
            'Favori takımın bu ayarı değiştirmez; takımın arması ve renkleri '
            'profilinde ve arka plan filigranında kalır.',
            style: TextStyle(
              color: AppColors.textSoft,
              fontSize: AppFont.md,
              height: 20 / 14,
            ),
          ),
        ),
        for (final m in GorunumModu.values) _secenek(m),
      ],
    ),
  );

  Widget _secenek(GorunumModu m) {
    final secili = m == _secili;
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.sm),
      child: Semantics(
        button: true,
        selected: secili,
        label: m.etiket,
        child: GestureDetector(
          key: Key('gorunum-${m.anahtar}'),
          behavior: HitTestBehavior.opaque,
          onTap: () => _sec(m),
          child: Container(
            padding: const EdgeInsets.all(Spacing.md),
            decoration: BoxDecoration(
              color: secili ? AppColors.primarySoft : AppColors.surface,
              borderRadius: AppRadius.lgR,
              border: Border.all(
                color: secili ? AppColors.primary : AppColors.border,
                width: secili ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                // İŞARET: seçili seçenek yalnız renkle değil ŞEKİLLE de
                // ayrılır — renk körlüğünde tek başına renk yetmez.
                Container(
                  width: 20,
                  height: 20,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: secili ? AppColors.primary : Colors.transparent,
                    border: Border.all(
                      color: secili ? AppColors.primary : AppColors.border,
                      width: 2,
                    ),
                  ),
                  child: secili
                      ? Icon(Icons.check, size: 13, color: AppColors.onPrimary)
                      : null,
                ),
                const SizedBox(width: Spacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        m.etiket,
                        style: TextStyle(
                          color: AppColors.text,
                          fontSize: AppFont.lg,
                          fontWeight: secili ? AppFont.black : AppFont.semibold,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          _aciklama(m),
                          style: TextStyle(
                            color: AppColors.textSoft,
                            fontSize: AppFont.sm,
                            height: 17 / 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
