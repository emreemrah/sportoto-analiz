// KAYNAK: app/src/screens/AboutScreen.js — BİREBİR çeviri.
//
// HAKKINDA — marka, sürüm, telif, bağımsızlık bildirimi ve yasal bağlantılar.
//
// Buradaki metinlerin hiçbiri elle yazılmaz; hepsi core/brand.dart'tan okunur.
// Kurum/operatör logosu, amblemi veya başka uygulamanın simgesi KULLANILMAZ.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/brand.dart';
import '../../core/network/api_config.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/screen_backdrop.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  Future<void> _ac(BuildContext context, String url, String ad) async {
    var acildi = false;
    try {
      acildi = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      acildi = false;
    }
    if (acildi || !context.mounted) return;
    // Kaynaktaki `uyari.alert(ad, ...)` — adres kullanıcıya GÖSTERİLİR ki
    // tarayıcıya elle yazabilsin; sessizce yutulmaz.
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(ad),
        content: Text(
          'Sayfa açılamadı. Tarayıcından şu adresi ziyaret edebilirsin:\n\n$url',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final links = legalUrls(apiBase);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('Hakkında')),
      body: ScreenBackdrop(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            Spacing.lg,
            Spacing.lg,
            Spacing.lg,
            Spacing.xl * 2,
          ),
          children: [
            const Text(
              kAppName,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.text,
                fontSize: 24,
                fontWeight: AppFont.black,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Sürüm $kAppVersion',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
            ),
            const SizedBox(height: 12),
            const Text(
              kAppTagline,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 14,
                height: 20 / 14,
              ),
            ),
            const SizedBox(height: Spacing.lg),

            const _Kart(
              baslik: 'Bağımsızlık',
              children: [
                _Govde(kIndependenceNotice),
                _Govde(
                  'Uygulamada kullanılan simge, renk ve görsellerin tamamı bu uygulamaya özgüdür. '
                  'Hiçbir kurumun logosu veya amblemi kullanılmaz.',
                ),
              ],
            ),

            const _Kart(
              baslik: 'Analiz dürüstlüğü',
              children: [
                _Govde(kNoGuaranteeNotice),
                _Govde(kOfficialResultNotice),
                _Govde(
                  'Analizler, oynanma yüzdeleri ve oran hareketleri yalnızca karar desteğidir; kesin '
                  'sonuç değildir. Veri eksikse "veri yok" yazılır, tahmin uydurulmaz.',
                ),
              ],
            ),

            const _Kart(
              baslik: 'Bahis ve ödeme',
              children: [
                _Govde(
                  'Bu uygulama bahis veya şans oyunu hizmeti değildir. Bahis oynatmaz, para kabul '
                  'etmez, ödeme almaz; herhangi bir operatöre üyelik, para yatırma veya oyun '
                  'yönlendirmesi yapmaz.',
                ),
              ],
            ),

            _Kart(
              baslik: 'Yasal',
              children: [
                _Baglanti(
                  '🔒  Gizlilik Politikası',
                  () => _ac(context, links.privacy, 'Gizlilik Politikası'),
                ),
                // Topluluk Kuralları: yorum yazan herkesi bağlar. Bildirme ve
                // engelleme yolları uygulamanın içinde; kuralların kendisi ise
                // uygulama kurulmadan da açılabilen bir sayfada durur.
                _Baglanti(
                  '📋  Topluluk Kuralları',
                  () => _ac(context, links.rules, 'Topluluk Kuralları'),
                ),
                // Sorumlu Oyun sayfası: kazanç garantisi olmadığı beyanı. Mağaza
                // incelemesi için uygulama dışından da açılabilir bir sayfadır
                // (backend/legal/sorumlu-oyun.html).
                // Destek hattı numarası bağlantı METNİNDEN kaldırıldı (kullanıcı
                // kararı, 2 Ağustos 2026); sayfanın kendisi yerinde duruyor.
                _Baglanti(
                  '🛟  Sorumlu Oyun',
                  () => _ac(context, links.responsibleGaming, 'Sorumlu Oyun'),
                ),
                _Baglanti(
                  '🗑️  Hesabımı Sil',
                  () => context.go('/profil/hesap-sil'),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Hesabını uygulamayı kurmadan da silebilirsin: ${links.deleteAccount}',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11.5,
                      height: 17 / 11.5,
                    ),
                  ),
                ),
              ],
            ),

            const Padding(
              padding: EdgeInsets.only(top: Spacing.lg, bottom: Spacing.md),
              child: Text(
                kCopyright,
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Kart extends StatelessWidget {
  const _Kart({this.baslik, required this.children});

  final String? baslik;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (baslik != null) ...[
          Text(
            baslik!,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 15,
              fontWeight: AppFont.heavy,
            ),
          ),
          const SizedBox(height: 8),
        ],
        ...children,
      ],
    ),
  );
}

class _Govde extends StatelessWidget {
  const _Govde(this.metin);

  final String metin;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      metin,
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 13.5,
        height: 20 / 13.5,
      ),
    ),
  );
}

class _Baglanti extends StatelessWidget {
  const _Baglanti(this.metin, this.onTap);

  final String metin;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.cardAlt,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Text(
          metin,
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 14,
            fontWeight: AppFont.bold,
          ),
        ),
      ),
    ),
  );
}
