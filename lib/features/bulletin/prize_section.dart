// KAYNAK: app/src/screens/BulletinScreen.js → `PrizeSection`
//
// İkramiye & bilen kişi. 15/15 resmî sonuç gelmeden içerik gösterilmez:
// eksik veriyle "ikramiye" yazmak, tamamlanmamış bir haftayı tamamlanmış
// göstermek olurdu.
//
// KAYNAKTAN BİLİNÇLİ SAPMA (2026-08-10, kullanıcı isteği): kaynakta bölüm
// geçmiş listenin EN ALTINDA ve üç görünümlüydü (list/table/card, `prizeView`
// tercihiyle). Burada bölüm geçmiş bülten gövdesinin EN ÜSTÜNE alındı ve
// görünüm TEKE indi: yalnız resmî Liste yazımı ("9 ADET 4.035.942,42 ₺").
// Tablo ve Kart kaldırıldı — bölüm üstteyken kart ızgarası maç listesini
// ekranın çok altına itiyordu. `prizeView` tercihi de kaldırıldı; diskte
// kalmış eski değer okunmaz.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import 'bulletin_format.dart';

class PrizeSection extends StatelessWidget {
  const PrizeSection({
    super.key,
    required this.prize,
    required this.resolvedCount,
    required this.totalM,
    required this.fullyResolved,
    this.selMetaCloseDate,
  });

  final Map? prize;
  final int resolvedCount;
  final int totalM;
  final bool fullyResolved;
  final String? selMetaCloseDate;

  @override
  Widget build(BuildContext context) {
    final hasPrize = prize != null;

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'İkramiye & Bilen Kişiler',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 15,
              fontWeight: AppFont.heavy,
            ),
          ),
          const SizedBox(height: 10),
          if (!fullyResolved)
            _bos(
              resolvedCount == 0
                  ? 'Resmi sonuçlar bekleniyor. Tüm maçlar tamamlanınca '
                        'ikramiye burada görünecek.'
                  : 'Şu ana kadar $resolvedCount/$totalM '
                        'resmi sonuç geldi. Tüm sonuçlar tamamlanınca ikramiye '
                        'görünecek.',
            )
          else if (!hasPrize)
            _bos(
              '15/15 resmi sonuç geldi.\n12/13/14/15 bilen kişi ve '
              'ikramiye bilgileri bekleniyor.',
            )
          else
            ..._icerik(),
        ],
      ),
    );
  }

  Widget _bos(String metin) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Text(
      metin,
      style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
    ),
  );

  List<Widget> _icerik() {
    final tiers = (prize!['tiers'] as List?) ?? const [];
    final kapanis = kapanisResmi(
      (prize!['closeDate'] as String?) ?? selMetaCloseDate,
    );
    final aciklama = prize!['description'] as String?;

    return [
      // LİSTE — RESMÎ yazımda: "9 ADET 4.035.942,42 ₺".
      for (final t in tiers.cast<Map>())
        _satir(
          hit: '${t['hit']} Bilen',
          count: '${fmtCount(t['count'] as num?)} ADET',
          amt: t['count'] == 0 ? 'Devretti' : fmtTLResmi(t['prize'] as num?),
          devretti: t['count'] == 0,
        ),

      // KAPANIŞ ve AÇIKLAMALAR — resmî listede etiketli satır olarak duruyor.
      // Veri yoksa satır ÇİZİLMEZ (uydurulmaz).
      if (kapanis != null) _metaSatir('Kapanış', kapanis),
      if (aciklama != null && aciklama.isNotEmpty)
        _metaSatir('Açıklamalar', aciklama),
    ];
  }

  Widget _satir({
    required String hit,
    required String count,
    required String amt,
    bool devretti = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 78,
            child: Text(
              hit,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
          Expanded(
            child: Text(
              count,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12.5,
                fontWeight: AppFont.semibold,
              ),
            ),
          ),
          Text(
            amt,
            style: TextStyle(
              color: devretti ? AppColors.textMuted : AppColors.green,
              fontSize: 13,
              fontWeight: devretti ? AppFont.bold : AppFont.heavy,
              fontStyle: devretti ? FontStyle.italic : FontStyle.normal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaSatir(String etiket, String deger) => Container(
    padding: const EdgeInsets.symmetric(vertical: 7),
    decoration: const BoxDecoration(
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 78,
          child: Text(
            etiket,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 13,
              fontWeight: AppFont.heavy,
            ),
          ),
        ),
        Expanded(
          child: Text(
            deger,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppColors.textSoft,
              fontSize: 12,
              fontWeight: AppFont.bold,
            ),
          ),
        ),
      ],
    ),
  );
}
