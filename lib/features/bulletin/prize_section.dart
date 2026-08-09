// KAYNAK: app/src/screens/BulletinScreen.js → `PrizeSection`
//
// İkramiye & bilen kişi — YALNIZ en altta. 15/15 resmî sonuç gelmeden
// gösterilmez: eksik veriyle "ikramiye" yazmak, tamamlanmamış bir haftayı
// tamamlanmış göstermek olurdu.

import 'package:flutter/material.dart';

import '../../core/prefs.dart';
import '../../core/theme/tokens.dart';
import 'bulletin_format.dart';

class PrizeSection extends StatefulWidget {
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
  State<PrizeSection> createState() => _PrizeSectionState();
}

class _PrizeSectionState extends State<PrizeSection> {
  late String _view = '${getPref('prizeView') ?? 'table'}';

  @override
  Widget build(BuildContext context) {
    final hasPrize = widget.prize != null;

    return Container(
      margin: const EdgeInsets.only(top: Spacing.sm),
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
          if (!widget.fullyResolved)
            _bos(
              widget.resolvedCount == 0
                  ? 'Resmi sonuçlar bekleniyor. Tüm maçlar tamamlanınca '
                        'ikramiye burada görünecek.'
                  : 'Şu ana kadar ${widget.resolvedCount}/${widget.totalM} '
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
    final tiers = (widget.prize!['tiers'] as List?) ?? const [];
    final kapanis = kapanisResmi(
      (widget.prize!['closeDate'] as String?) ?? widget.selMetaCloseDate,
    );
    final aciklama = widget.prize!['description'] as String?;

    return [
      // Görünüm seçici
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            for (final v in const [
              (k: 'list', l: 'Liste'),
              (k: 'table', l: 'Tablo'),
              (k: 'card', l: 'Kart'),
            ]) ...[
              GestureDetector(
                onTap: () {
                  setState(() => _view = v.k);
                  setPref('prizeView', v.k);
                },
                child: Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: _view == v.k ? AppColors.primary : AppColors.cardAlt,
                    borderRadius: AppRadius.smR,
                  ),
                  child: Text(
                    v.l,
                    style: TextStyle(
                      color: _view == v.k
                          ? AppColors.white
                          : AppColors.textSoft,
                      fontSize: 11.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),

      if (_view == 'table') ...[
        _satir(
          hit: 'Derece',
          count: 'Kişi',
          amt: 'İkramiye',
          baslik: true,
          ustCizgi: false,
        ),
        for (final t in tiers.cast<Map>())
          _satir(
            hit: '${t['hit']}',
            count: fmtCount(t['count'] as num?),
            amt: t['count'] == 0 ? 'Devretti' : fmtTL(t['prize'] as num?),
            devretti: t['count'] == 0,
          ),
      ] else if (_view == 'card')
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final t in tiers.cast<Map>())
              LayoutBuilder(builder: (context, _) => _kart(t)),
          ],
        )
      else
        // LİSTE görünümü RESMÎ yazımda: "9 ADET 4.035.942,42 ₺".
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
    bool baslik = false,
    bool devretti = false,
    bool ustCizgi = true,
  }) {
    final basStil = baslik
        ? const TextStyle(
            color: AppColors.textMuted,
            fontWeight: AppFont.black,
            fontSize: 11,
          )
        : null;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: ustCizgi
          ? const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.border)),
            )
          : null,
      child: Row(
        children: [
          SizedBox(
            width: 78,
            child: Text(
              hit,
              style:
                  basStil ??
                  const TextStyle(
                    color: AppColors.text,
                    fontSize: 13,
                    fontWeight: AppFont.heavy,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              count,
              style:
                  basStil ??
                  const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12.5,
                    fontWeight: AppFont.semibold,
                  ),
            ),
          ),
          Text(
            amt,
            style:
                basStil ??
                TextStyle(
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

  Widget _kart(Map t) {
    final devretti = t['count'] == 0;
    return FractionallySizedBox(
      widthFactor: 1,
      child: Container(
        width: (MediaQuery.sizeOf(context).width - Spacing.md * 4 - 8) / 2,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.surfaceSoft,
          borderRadius: AppRadius.mdR,
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${t['hit']} Bilen',
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.black,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${fmtCount(t['count'] as num?)} kişi',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 11.5,
                fontWeight: AppFont.bold,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              devretti ? 'Devretti' : fmtTL(t['prize'] as num?),
              style: TextStyle(
                color: devretti ? AppColors.textMuted : AppColors.green,
                fontSize: 13,
                fontWeight: devretti ? AppFont.bold : AppFont.heavy,
                fontStyle: devretti ? FontStyle.italic : FontStyle.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
