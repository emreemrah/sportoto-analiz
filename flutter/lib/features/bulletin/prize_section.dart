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
          Text(
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
      style: TextStyle(color: AppColors.textMuted, fontSize: 13),
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
      if (aciklama != null && aciklama.isNotEmpty) _resmiAciklama(aciklama),
    ];
  }

  /// RESMÎ AÇIKLAMA — ALINTI OLARAK GÖSTERİLİR (kullanıcı kararı, 16 Ağustos
  /// 2026).
  ///
  /// Bu metin Spor Toto'nun KENDİ ikramiye duyurusudur ve uçtan BİREBİR gelir
  /// (`prize.description`); uygulama tek kelimesini yazmaz. İçinde resmî satış
  /// kanallarının adları geçebiliyor — 53. Haftada "İDDAA.COM" geçtiği
  /// denetimde ölçüldü.
  ///
  /// Burada iki proje kuralı çatışıyordu: *"kullanıcı arayüzünde marka adı
  /// yok"* (yasal/mağaza kısıtı) ile *"resmî sonucu olduğu gibi göster"*.
  /// Metinden kelime ayıklamak, RESMÎ BİR AÇIKLAMAYI DEĞİŞTİRMEK olurdu ve bu
  /// kendi başına bir dürüstlük sorunudur.
  ///
  /// Karar: metne DOKUNULMAZ, alıntı olduğu görünür kılınır. Kaynak açıkça
  /// yazılır ve metin tırnak içinde, ayrı bir blokta durur; böylece içindeki
  /// her ifade Spor Toto'nun cümlesi olarak okunur, uygulamanın tanıtımı
  /// olarak değil.
  Widget _resmiAciklama(String metin) => Container(
    width: double.infinity,
    padding: const EdgeInsets.only(top: 9),
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Spor Toto resmî açıklaması',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 12,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 5),
        Container(
          padding: const EdgeInsets.only(left: 9),
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(color: AppColors.border, width: 2.5),
            ),
          ),
          child: Text(
            '“$metin”',
            style: TextStyle(
              color: AppColors.textSoft,
              fontSize: 12,
              height: 16 / 12,
              fontStyle: FontStyle.italic,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Metin resmî kaynaktan olduğu gibi aktarılmıştır.',
          style: TextStyle(color: AppColors.textMuted, fontSize: 10.5),
        ),
      ],
    ),
  );

  Widget _satir({
    required String hit,
    required String count,
    required String amt,
    bool devretti = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 78,
            child: Text(
              hit,
              style: TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
          Expanded(
            child: Text(
              count,
              style: TextStyle(
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
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 78,
          child: Text(
            etiket,
            style: TextStyle(
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
            style: TextStyle(
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
