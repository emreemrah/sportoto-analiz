// MAÇ TAKİBİ — KART SİMGELERİ VE BİLDİRİM AYARLARI EKRANI
// (kullanıcı isteği, 2026-08-11)
//
// Bülten listesindeki her maç satırının sağında iki simge var:
//   ★  takip aç/kapat (dokununca anında yazılır)
//   ⚙  YALNIZ O MAÇA ait bildirim ayarları ekranı
//
// Referans görseller (Screenshot_15/16) yalnız yerleşim, simge konumu ve
// açılış akışı için örnek alındı; oradaki maçlar, metinler ve seçenek adları
// kopyalanmadı — buradaki her satır uygulamanın kendi verisinden ve kendi
// bildirim türlerinden gelir.
//
// SİMGELER KARTI AÇMAZ: kart zaten dokununca maç detayına gider. Bu iki simge
// kendi dokunuşunu tüketir, yoksa yıldıza basan kullanıcı maç detayında
// bulurdu kendini.

import 'package:flutter/material.dart';

import '../../core/mac_takip.dart';
import '../../core/theme/tokens.dart';

/// Kart satırındaki ★ ve ⚙.
class MacTakipSimgeleri extends StatefulWidget {
  const MacTakipSimgeleri({super.key, required this.match});

  final Map match;

  @override
  State<MacTakipSimgeleri> createState() => _MacTakipSimgeleriState();
}

class _MacTakipSimgeleriState extends State<MacTakipSimgeleri> {
  String get _kimlik => macKimligi(widget.match);

  @override
  Widget build(BuildContext context) {
    // Kimliği olmayan maç takip edilemez: hangi maç olduğu kaydedilemezse
    // tercih başka bir maça yazılabilirdi.
    if (_kimlik.isEmpty) return const SizedBox.shrink();
    final takipte = macTakipte(_kimlik);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _Simge(
          anahtar: Key('mac-takip-yildiz-$_kimlik'),
          etiket: takipte ? 'Takibi bırak' : 'Maçı takip et',
          ikon: takipte ? Icons.star : Icons.star_border,
          renk: takipte ? AppColors.warning : AppColors.muted,
          onTap: () {
            macTakipAyarla(_kimlik, !takipte);
            setState(() {});
          },
        ),
        const SizedBox(width: 2),
        _Simge(
          anahtar: Key('mac-bildirim-carki-$_kimlik'),
          etiket: 'Maç bildirim ayarları',
          ikon: Icons.settings,
          renk: AppColors.muted,
          onTap: () async {
            await macBildirimAyarlariniAc(context, widget.match);
            if (mounted) setState(() {});
          },
        ),
      ],
    );
  }
}

class _Simge extends StatelessWidget {
  const _Simge({
    required this.anahtar,
    required this.etiket,
    required this.ikon,
    required this.renk,
    required this.onTap,
  });

  final Key anahtar;
  final String etiket;
  final IconData ikon;
  final Color renk;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: etiket,
    child: GestureDetector(
      key: anahtar,
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Icon(ikon, size: 19, color: renk),
      ),
    ),
  );
}

/// O maça ait bildirim ayarları ekranını açar.
Future<void> macBildirimAyarlariniAc(BuildContext context, Map match) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MacBildirimAyarlari(match: match),
    );

class MacBildirimAyarlari extends StatefulWidget {
  const MacBildirimAyarlari({super.key, required this.match});

  final Map match;

  @override
  State<MacBildirimAyarlari> createState() => _MacBildirimAyarlariState();
}

class _MacBildirimAyarlariState extends State<MacBildirimAyarlari> {
  String get _kimlik => macKimligi(widget.match);

  String get _macAdi {
    final h = widget.match['home'];
    final a = widget.match['away'];
    String ad(Object? t) =>
        t is Map ? '${t['mediumName'] ?? t['name'] ?? ''}' : '${t ?? ''}';
    return '${ad(h)} – ${ad(a)}';
  }

  @override
  Widget build(BuildContext context) {
    final takipte = macTakipte(_kimlik);
    final acik = macBildirimTercihleri(_kimlik);

    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.86,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.lg),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _baslik(),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(
                  Spacing.md,
                  Spacing.md,
                  Spacing.md,
                  Spacing.lg,
                ),
                children: [
                  _takipSatiri(takipte),
                  const SizedBox(height: Spacing.md),
                  _grupBasligi('Telefona düşen bildirim'),
                  for (final t in kMacBildirimTurleri)
                    if (t.yerelCalisir)
                      _turSatiri(t, acik.contains(t.anahtar), takipte),
                  const SizedBox(height: Spacing.md),
                  _grupBasligi('Maç sırasındaki bildirimler'),
                  // DÜRÜST NOT: bu türler cihazda önceden zamanlanamaz; maç
                  // sırasında sunucudan gönderilmeleri gerekir ve o altyapı
                  // henüz bağlı değil. Tercih yine de bu maça kaydedilir.
                  Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Bu bildirimler maç oynanırken oluşan olaylardır; '
                      'telefona sunucudan gönderilmeleri gerekir. O bağlantı '
                      'henüz kurulmadığı için şu an telefonuna düşmezler — '
                      'seçimin bu maça kaydedilir ve bağlandığında geçerli '
                      'olur.',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                        height: 15 / 11,
                      ),
                    ),
                  ),
                  for (final t in kMacBildirimTurleri)
                    if (!t.yerelCalisir)
                      _turSatiri(t, acik.contains(t.anahtar), takipte),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _baslik() => Container(
    padding: const EdgeInsets.fromLTRB(Spacing.lg, Spacing.md, Spacing.sm, 12),
    color: AppColors.primary,
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Maç Bildirim Ayarları',
                style: TextStyle(
                  color: AppColors.onPrimary,
                  fontSize: 14.5,
                  fontWeight: AppFont.heavy,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _macAdi,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 12,
                  fontWeight: AppFont.semibold,
                ),
              ),
            ],
          ),
        ),
        Semantics(
          button: true,
          label: 'Kapat',
          child: GestureDetector(
            key: const Key('mac-bildirim-kapat'),
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).pop(),
            child: const Padding(
              padding: EdgeInsets.all(6),
              child: Icon(Icons.close, color: AppColors.white, size: 20),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _grupBasligi(String s) => Padding(
    padding: const EdgeInsets.only(bottom: 6, top: 2),
    child: Text(
      s,
      style: TextStyle(
        color: AppColors.textSoft,
        fontSize: 11.5,
        fontWeight: AppFont.heavy,
      ),
    ),
  );

  Widget _takipSatiri(bool takipte) => Semantics(
    button: true,
    toggled: takipte,
    label: 'Bu maçı takip et',
    child: GestureDetector(
      key: const Key('mac-bildirim-takip'),
      behavior: HitTestBehavior.opaque,
      onTap: () {
        macTakipAyarla(_kimlik, !takipte);
        setState(() {});
      },
      child: Container(
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadius.mdR,
          border: Border.all(
            color: takipte ? AppColors.warning : AppColors.border,
          ),
        ),
        child: Row(
          children: [
            Icon(
              takipte ? Icons.star : Icons.star_border,
              size: 20,
              color: takipte ? AppColors.warning : AppColors.muted,
            ),
            const SizedBox(width: Spacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    takipte ? 'Bu maçı takip ediyorsun' : 'Bu maçı takip et',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 13.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    takipte
                        ? 'Aşağıdaki seçimler yalnız bu maç için geçerli.'
                        : 'Bildirim seçenekleri takip açıkken çalışır.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _turSatiri(MacBildirimTuru t, bool acik, bool takipte) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Opacity(
        // Takip kapalıyken seçenekler soluk ve dokunulamaz: kapalı bir takibin
        // altında "açık" bir bildirim göstermek yanlış olurdu.
        opacity: takipte ? 1 : 0.5,
        child: Semantics(
          button: true,
          toggled: acik,
          label: t.etiket,
          child: GestureDetector(
            key: Key('mac-bildirim-tur-${t.anahtar}'),
            behavior: HitTestBehavior.opaque,
            onTap: takipte
                ? () {
                    macBildirimAyarla(_kimlik, t.anahtar, !acik);
                    setState(() {});
                  }
                : null,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: Spacing.md,
                vertical: 13,
              ),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: AppRadius.mdR,
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      t.etiket,
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 13.5,
                        fontWeight: AppFont.semibold,
                      ),
                    ),
                  ),
                  Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: acik && takipte
                          ? AppColors.accent
                          : AppColors.surface,
                      borderRadius: AppRadius.smR,
                      border: Border.all(
                        color: acik && takipte
                            ? AppColors.accent
                            : AppColors.border,
                      ),
                    ),
                    child: acik && takipte
                        ? const Icon(
                            Icons.check,
                            size: 16,
                            color: AppColors.white,
                          )
                        : null,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
