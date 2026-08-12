// GÖRÜNÜM TERCİHİ — SİSTEM / AÇIK / KOYU / TAKIM (kullanıcı isteği,
// 2026-08-12)
//
// Uygulamanın görünümünü kullanıcı buradan seçer. Tercih kalıcıdır
// (`prefs` → `gorunumModu`) ve varsayılanı SİSTEM'dir.
//
// DÖRDÜNCÜ SEÇENEK — TAKIM TEMASI: yalnız o seçildiğinde favori takımın
// renkleri uygulamanın GENEL temasına uygulanır. Diğer üç seçenekte takım
// rengi yapısal yüzeylere HİÇ çıkmaz; takım yalnız arma, filigran ve küçük
// profil ayrıntılarında kalır (bkz. core/theme/gorunum.dart).
//
// TAKIM YOKSA SEÇENEK KAPALI: dokunulabilir ama hiçbir şey olmayan bir
// seçenek kullanıcıya bozuk hissettirir; kapalı görünür ve NEDEN kapalı
// olduğu yazılır.
//
// SEÇİM ANINDA UYGULANIR: `gorunumModuAyarla` hem diske yazar hem kökteki
// dinleyiciyi tetikler; ekran kapanmadan sonuç görünür.

import 'package:flutter/material.dart';

import '../../core/theme/gorunum.dart';
import '../../core/theme/takim_temasi.dart';
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
    GorunumModu.takim =>
      'Favori takımının renkleri uygulamanın genelinde kullanılır.',
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
            'İlk üç seçenekte takımın renkleri genel temaya karışmaz; arması '
            've filigranı yerinde kalır. "Takım teması"nda ise favori takımın '
            'renkleri uygulamanın geneline uygulanır.',
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
    // TAKIM TEMASI FAVORİ TAKIM İSTER. Takım yoksa seçenek KAPALI görünür ve
    // NEDEN kapalı olduğu yazılır — dokunup hiçbir şey olmaması, kullanıcıya
    // bozuk hissettirirdi (kullanıcı isteği: "takım seçmemişse seçenek
    // kullanılamasın").
    final palet = context.takimPaleti;
    final kapali = m == GorunumModu.takim && !takimTemasiKullanilabilir(palet);

    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.sm),
      child: Semantics(
        button: !kapali,
        selected: secili,
        enabled: !kapali,
        label: m.etiket,
        child: GestureDetector(
          key: Key('gorunum-${m.anahtar}'),
          behavior: HitTestBehavior.opaque,
          onTap: kapali ? null : () => _sec(m),
          child: Container(
            padding: const EdgeInsets.all(Spacing.md),
            decoration: BoxDecoration(
              color: kapali
                  ? AppColors.surfaceSoft
                  : (secili ? AppColors.primarySoft : AppColors.surface),
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
                          color: kapali ? AppColors.muted : AppColors.text,
                          fontSize: AppFont.lg,
                          fontWeight: secili ? AppFont.black : AppFont.semibold,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          kapali
                              ? 'Kullanmak için önce profilinden favori '
                                    'takımını seç.'
                              : _aciklama(m),
                          style: TextStyle(
                            color: kapali
                                ? AppColors.muted
                                : AppColors.textSoft,
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
