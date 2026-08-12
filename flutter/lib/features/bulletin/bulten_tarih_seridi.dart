// BÜLTEN GÜN ŞERİDİ — yatay tarih filtresi (kullanıcı isteği, 2026-08-11)
//
// Screenshot_17 yalnız YERLEŞİM için örnek alındı: solda sabit bir "tümü"
// düğmesi, sağında yatay kaydırılabilir gün çipleri. Oradaki günler, tarihler
// ve saatler kopyalanmadı — buradaki her gün GÜNCEL BÜLTENİN kendi maç
// tarihlerinden üretilir (`core/bulten_gunleri.dart`).
//
// Maçı olmayan gün hiç çizilmez; şeritte görünen her çipin altında gerçekten
// oynanacak maç vardır.

import 'package:flutter/material.dart';

import '../../core/bulten_gunleri.dart';
import '../../core/theme/tokens.dart';

class BultenTarihSeridi extends StatelessWidget {
  const BultenTarihSeridi({
    super.key,
    required this.gunler,
    required this.secili,
    required this.onSec,
  });

  final List<BultenGunu> gunler;

  /// Seçili gün anahtarı; null = süzgeç kapalı (bültenin tamamı).
  final String? secili;

  final ValueChanged<String?> onSec;

  @override
  Widget build(BuildContext context) {
    // Tek gün varsa şerit bir şey seçtirmez — süzgeç anlamsızdır.
    if (gunler.length < 2) return const SizedBox.shrink();

    return Container(
      // ALT ÇİZGİ YOK: bu şerit üst panelin EN ALTIDIR ve panelin kendi
      // kenarlığı sınırı çiziyor. Bırakılsaydı yuvarlatılmış köşenin
      // üstünden düz bir çizgi geçerdi.
      decoration: BoxDecoration(color: AppColors.surface),
      child: Row(
        children: [
          // TÜMÜ — solda sabit durur, şeritle birlikte kaymaz.
          _Cip(
            anahtar: const Key('bulten-gun-tumu'),
            ustSatir: 'Tümü',
            altSatir: '${_toplam()} maç',
            secili: secili == null,
            onTap: () => onSec(null),
          ),
          Container(width: 1, height: 30, color: AppColors.border),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final g in gunler)
                    _Cip(
                      anahtar: Key('bulten-gun-${g.tarih}'),
                      ustSatir: g.gunAdi,
                      altSatir: g.kisaTarih,
                      secili: secili == g.tarih,
                      vurgulu: g.bugun,
                      onTap: () => onSec(g.tarih),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  int _toplam() => gunler.fold<int>(0, (a, g) => a + g.macSayisi);
}

class _Cip extends StatelessWidget {
  const _Cip({
    required this.anahtar,
    required this.ustSatir,
    required this.altSatir,
    required this.secili,
    required this.onTap,
    this.vurgulu = false,
  });

  final Key anahtar;
  final String ustSatir;
  final String altSatir;
  final bool secili;

  /// Bugün olan gün, seçili olmasa da hafifçe belli olur.
  final bool vurgulu;

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: secili,
    label: '$ustSatir $altSatir',
    child: GestureDetector(
      key: anahtar,
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minWidth: 62),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          // SEÇİLİ GÜN AÇIKÇA BELLİ: altında kalın accent çizgi.
          border: Border(
            bottom: BorderSide(
              color: secili ? AppColors.accent : Colors.transparent,
              width: 3,
            ),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              ustSatir,
              style: TextStyle(
                color: secili
                    ? AppColors.text
                    : (vurgulu ? AppColors.textSoft : AppColors.textMuted),
                fontSize: 12,
                fontWeight: secili || vurgulu ? AppFont.black : AppFont.bold,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              altSatir,
              style: TextStyle(
                color: secili ? AppColors.accent : AppColors.textMuted,
                fontSize: 11,
                fontWeight: secili ? AppFont.black : AppFont.semibold,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
