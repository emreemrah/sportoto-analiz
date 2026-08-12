// KAYNAK: app/src/components/KriterBasariListesi.js — BİREBİR çeviri.
//
// KRİTER BAŞARILARI — maç detayı "Analiz" sekmesinin listesi (2026-08-07)
//
// KULLANICI KARARI: maçın analizine bakarken kriterlerin BU MAÇTA ne dediği
// değil, GEÇMİŞTE ne yaptığı görünsün. Hükmü kullanıcı verir; ekran yorum
// katmaz ("bu kriter iyidir/kötüdür" cümlesi YOKTUR).
//
// Satır: kriter adı + "12 maçta 7 başarı · %58" + ›
// Satıra dokun → o kriterin ham maç tablosu (KriterKirilimScreen).
//
// KAYNAK UÇ: /api/scorecards/criteria — mühürlü maç-öncesi sinyaller × resmî
// 90 dk sonuçları. Yalnız resmî ileri-test haftaları sayılır.
//
// DÜRÜSTLÜK: sinyal üretmemiş kriter gizlenmez, "sinyal yok" / "veri yok"
// yazar. Yüzde uydurulmaz; ölçüm yoksa oran gösterilmez.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';

const List<(String, String)> _donemler = [
  ('allTime', 'Genel'),
  ('last1', 'Son Hafta'),
  ('last5', 'Son 5'),
  ('last10', 'Son 10'),
  ('last15', 'Son 15'),
];

final _kriterKarnesiProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
  (ref) async {
    final r = await api.scorecardsCriteria();
    return Map<String, dynamic>.from(r as Map);
  },
);

class KriterBasariListesi extends ConsumerStatefulWidget {
  const KriterBasariListesi({super.key, this.onKriterSec});

  /// Satıra dokununca KriterKirilim ekranına götürür.
  final void Function(String key, String ad)? onKriterSec;

  @override
  ConsumerState<KriterBasariListesi> createState() =>
      _KriterBasariListesiState();
}

class _KriterBasariListesiState extends ConsumerState<KriterBasariListesi> {
  String _donem = 'allTime';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_kriterKarnesiProvider);

    return async.when(
      loading: () => _kart(
        children: [
          Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          ),
        ],
      ),
      error: (e, _) => _kart(children: [Text('$e', style: _bos)]),
      data: (veri) {
        if (veri['hasData'] != true) {
          return _kart(
            children: [
              Text(
                '${veri['note'] ?? 'Henüz resmî kriter verisi yok — haftalar mühürlenip sonuçlandıkça dolacak.'}',
                style: _bos,
              ),
            ],
          );
        }

        final liste =
            ((veri['criteria'] as List?) ?? const [])
                .cast<Map>()
                .where((c) => c['informational'] != true)
                .toList()
              ..sort((a, b) {
                int total(Map c) =>
                    ((c['windows'] as Map?)?[_donem] as Map?)?['total']
                        as int? ??
                    0;
                return total(b).compareTo(total(a));
              });

        final includedCount = (veri['includedCount'] as num?)?.toInt() ?? 0;

        return _kart(
          children: [
            // Dönem seçici
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  for (final (k, etiket) in _donemler) ...[
                    Expanded(
                      child: Semantics(
                        button: true,
                        label: etiket,
                        child: GestureDetector(
                          onTap: () => setState(() => _donem = k),
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 5),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _donem == k
                                  ? AppColors.primary
                                  : AppColors.bgAlt,
                              borderRadius: AppRadius.smR,
                            ),
                            child: Text(
                              etiket,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: _donem == k
                                    ? AppColors.onPrimary
                                    : AppColors.textSoft,
                                fontSize: 10.5,
                                fontWeight: AppFont.heavy,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (k != _donemler.last.$1) const SizedBox(width: 4),
                  ],
                ],
              ),
            ),

            // Arşiv küçükken tüm dönemler aynı sayıyı gösterir; kullanıcı bunu
            // "bozuk" sanmasın diye tek satır bilgi. Hüküm değil, olgu.
            if (includedCount > 0 && includedCount < 5)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  'Arşivde $includedCount resmî hafta var — bu yüzden tüm '
                  'dönemler aynı sayıları gösteriyor.',
                  style: _not,
                ),
              ),

            for (final c in liste) _satir(c),

            Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                '"X maçta Y başarı" = kriterin yön gösterdiği maç sayısı ve '
                'doğru çıkan yön sayısı. Satıra dokun: o maçların tamamı oranı '
                've oynanma yüzdesiyle listelenir.',
                style: _not,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _satir(Map c) {
    final w =
        ((c['windows'] as Map?)?[_donem] as Map?) ??
        const {'rate': null, 'hits': 0, 'total': 0};
    final olculdu = w['rate'] != null;
    final noData = (c['noData'] as num?) ?? 0;
    final evaluated = (c['evaluated'] as num?) ?? 0;

    return Semantics(
      button: true,
      label: '${c['label']} kriterinin maçlarını aç',
      child: GestureDetector(
        onTap: () => widget.onKriterSec?.call('${c['key']}', '${c['label']}'),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            children: [
              // TAŞMA KORUMASI: uzun kriter adları satırdan taşıyordu.
              Expanded(
                child: Text(
                  '${c['label']}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 12.5,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                olculdu
                    ? '${w['total']} maçta ${w['hits']} başarı · %${w['rate']}'
                    : (noData >= evaluated ? 'veri yok' : 'sinyal yok'),
                style: TextStyle(
                  color: olculdu ? AppColors.text : AppColors.textMuted,
                  fontSize: 11.5,
                  fontWeight: olculdu ? AppFont.heavy : AppFont.semibold,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '›',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 16,
                  fontWeight: AppFont.black,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _kart({required List<Widget> children}) => Container(
    padding: const EdgeInsets.all(Spacing.md),
    margin: const EdgeInsets.only(bottom: Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: AppRadius.mdR,
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: 8),
          child: Text(
            'Kriter Başarıları',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 14,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        ...children,
      ],
    ),
  );
}

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _bos =>
    TextStyle(color: AppColors.textMuted, fontSize: 12, height: 17 / 12);

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _not =>
    TextStyle(color: AppColors.textMuted, fontSize: 10.5, height: 14 / 10.5);
