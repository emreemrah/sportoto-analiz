// KAYNAK: app/src/screens/GecmisMacDetayScreen.js — BİREBİR çeviri.
//
// GEÇMİŞ (MÜHÜRLÜ) MAÇ DETAYI
//
// NEDEN VAR: geçmiş bültende maç kartına basılamıyordu. Oysa mühürlü haftada
// elimizdeki en değerli şey tam da bu: maç OYNANMADAN ÖNCE ne demişiz, sonra
// ne olmuş. Karne bunu toplu yüzde olarak gösteriyordu; tek maçta "hangi
// kriter ne dedi" görünmüyordu.
//
// NE GÖSTERİR (hepsi mühürlü kayıttan, yeniden hesap YOK):
//   • Resmî sonuç ve skor
//   • Maç öncesi mühürlenmiş sistem tahmini + tuttu mu
//   • Kriter kriter: hangi kriter hangi yönü söyledi, doğru muydu
//   • Mühür kanıtı: ne zaman mühürlendi, doğrulama özeti
//
// DÜRÜSTLÜK KURALLARI (proje kuralı, burada da geçerli):
//   • Mühür yoksa analiz UYDURULMAZ; "maç öncesi kayıt yok" yazılır.
//   • Resmî sonuç gelmemişse "tuttu/tutmadı" DENMEZ; "henüz resmî değil" denir.
//   • Bugünkü motorla geçmiş maç yeniden hesaplanmaz.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';

const Map<String, String> _sembol = {
  '1': 'Ev sahibi (1)',
  'X': 'Beraberlik (X)',
  '2': 'Deplasman (2)',
};

/// Sinyali okunur yöne çevirir; bilinmeyen değer uydurulmaz.
String? yon(Object? sym) {
  final s = sym == null ? '' : '$sym';
  return _sembol[s] ?? (s.isNotEmpty ? s : null);
}

final _muhurluMacProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({Object roundId, Object no})>(
      (ref, k) async => Map<String, dynamic>.from(
        await api.analysisSealedMatch(k.roundId, k.no) as Map,
      ),
    );

class GecmisMacDetayScreen extends ConsumerWidget {
  const GecmisMacDetayScreen({
    super.key,
    required this.roundId,
    required this.no,
    this.mac,
  });

  final Object roundId;
  final Object no;

  /// Bültenden gelen maç kaydı — resmî sonuç ve skor buradan okunur.
  final Map? mac;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_muhurluMacProvider((roundId: roundId, no: no)));
    final veri = async.valueOrNull;
    // SESSİZ YUTMA YOK: sebep ekranda yazar (404 = mühür yok).
    final hata = async.hasError ? '${async.error}' : null;

    final resmiSonuc = mac?['result'] as String?; // '1' | 'X' | '2' | null
    final skorMap = mac?['score'] as Map?;
    final skor = skorMap != null
        ? '${skorMap['home']} - ${skorMap['away']}'
        : null;
    final master = (veri?['match'] as Map?)?['master'] as Map?;
    final tahmin = master?['mainPrediction'];
    final muhurlu = veri?['freezeStatus'] == 'sealed';

    // İSABET yalnız RESMÎ sonuç varsa hesaplanır. Geçici/canlı skor sayılmaz.
    final bool? isabet = (resmiSonuc != null && tahmin != null)
        ? '$tahmin' == resmiSonuc
        : null;

    // Kriter kırılımı: mühürlü katkılar. Her satır kendi yönünü ve (resmî
    // sonuç varsa) doğru olup olmadığını taşır.
    final katkilar = (master?['contributions'] as List?) ?? const [];
    final veriYok = (master?['missingData'] as List?) ?? const [];

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _ust(context),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(
                  left: Spacing.md,
                  right: Spacing.md,
                  top: Spacing.md,
                  bottom: Spacing.xl,
                ),
                children: [
                  // 1) RESMÎ SONUÇ
                  _Kart(
                    baslik: 'Resmî Sonuç',
                    children: [
                      if (skor != null) ...[
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            skor,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: AppColors.text,
                              fontSize: 30,
                              fontWeight: AppFont.black,
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            resmiSonuc != null
                                ? 'Maç sonucu: ${yon(resmiSonuc)}'
                                : 'Sonuç harfi bilinmiyor',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: AppColors.textSoft,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ] else
                        const _Bos('Bu maç için resmî skor bulunamadı.'),
                    ],
                  ),

                  // 2) MAÇ ÖNCESİ NE DEMİŞİZ
                  _Kart(
                    baslik: 'Maç Öncesi Tahminimiz',
                    children: [
                      if (async.isLoading)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.primary,
                                ),
                              ),
                              SizedBox(width: 8),
                              Text(
                                'Mühürlü kayıt okunuyor…',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        )
                      else if (hata != null)
                        _Bos(
                          'Bu maç için maç öncesi mühürlü analiz kaydı '
                          'bulunamadı.\nSebep: $hata\n\n'
                          'Mühür, tahminin maç başlamadan üretildiğinin '
                          'kanıtıdır. Kaydı olmayan maç için sonradan analiz '
                          'üretilmez.',
                        )
                      else if (tahmin == null)
                        const _Bos(
                          'Mühürlü kayıt var ama bu maçta sistem tek bir yön '
                          'söylememiş (kriterler denk çıkmış). Uydurma bir '
                          'tahmin yazılmaz.',
                        )
                      else ...[
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Sistem dedi',
                                    style: TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 10,
                                      fontWeight: AppFont.heavy,
                                    ),
                                  ),
                                  Text(
                                    '${yon(tahmin)}',
                                    style: const TextStyle(
                                      color: AppColors.text,
                                      fontSize: 16,
                                      fontWeight: AppFont.black,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: isabet == null
                                    ? AppColors.bgAlt
                                    : isabet
                                    ? AppColors.successSoft
                                    : AppColors.dangerSoft,
                                borderRadius: AppRadius.smR,
                              ),
                              child: Text(
                                isabet == null
                                    ? 'henüz resmî değil'
                                    : isabet
                                    ? '✓ tuttu'
                                    : '✗ tutmadı',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: AppFont.heavy,
                                  color: AppColors.text,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (master?['confidence'] != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              'Güven: ${master!['confidence']}',
                              style: const TextStyle(
                                color: AppColors.textSoft,
                                fontSize: 11.5,
                              ),
                            ),
                          ),
                        if (master?['summary'] != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              '${master!['summary']}',
                              style: const TextStyle(
                                color: AppColors.text,
                                fontSize: 12.5,
                                height: 17 / 12.5,
                              ),
                            ),
                          ),
                        // MÜHÜR KANITI — bu ekranın en önemli satırı.
                        Container(
                          margin: const EdgeInsets.only(top: Spacing.sm),
                          padding: const EdgeInsets.only(top: Spacing.sm),
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(color: AppColors.border),
                            ),
                          ),
                          child: Text(
                            muhurlu
                                ? 'Bu analiz maç öncesinde mühürlendi ve '
                                      'bugünkü verilerle yeniden hesaplanmadı '
                                      '— gördüğün, o gün söylediğimizdir.'
                                : 'Bu hafta mühürlenmemiş; gösterilen değerler '
                                      'maç öncesi dondurulmuş kayıttan '
                                      'gelmiyor olabilir.',
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 10.5,
                              height: 15 / 10.5,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),

                  // 3) KRİTER KIRILIMI
                  if (katkilar.isNotEmpty)
                    _Kart(
                      baslik: 'Hangi Kriter Ne Dedi',
                      alt: resmiSonuc != null
                          ? 'Sağdaki işaret, kriterin söylediği yönün resmî '
                                'sonuçla uyup uymadığını gösterir.'
                          : 'Resmî sonuç gelmediği için doğru/yanlış işareti '
                                'konmadı.',
                      children: [
                        for (final k in katkilar.cast<Map>())
                          _kriterSatiri(k, resmiSonuc),
                      ],
                    ),

                  // 4) VERİ BULAMAYAN KRİTERLER — gizlenmez.
                  if (veriYok.isNotEmpty)
                    _Kart(
                      baslik: 'Veri Bulamayan Kriterler (${veriYok.length})',
                      alt:
                          'Bu kriterler bu maçta konuşmadı; sebebi aşağıda. '
                          'Eksik veri gizlenmez, "bilinmiyor" olarak durur.',
                      children: [
                        for (final v in veriYok.cast<Map>())
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            decoration: const BoxDecoration(
                              border: Border(
                                top: BorderSide(color: AppColors.border),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${v['label']}',
                                  style: const TextStyle(
                                    color: AppColors.text,
                                    fontSize: 12,
                                    fontWeight: AppFont.bold,
                                  ),
                                ),
                                Text(
                                  '${v['reason'] ?? 'Veri yok'}',
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 10.5,
                                    height: 14 / 10.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),

                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text(
                      'Bu ekran geçmişe bakar; kesin sonuç veya kazanç vaadi '
                      'değildir.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _ust(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(
      horizontal: Spacing.md,
      vertical: Spacing.sm,
    ),
    decoration: const BoxDecoration(
      color: AppColors.surface,
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      children: [
        Semantics(
          button: true,
          label: 'Geri dön',
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).maybePop(),
            child: const SizedBox(
              width: 34,
              height: 34,
              child: Center(
                child: Text(
                  '‹',
                  style: TextStyle(
                    fontSize: 26,
                    color: AppColors.primary,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 4),
        // TAŞMA KORUMASI: başlık uzun takım adlarında satırdan taşıyordu.
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '#$no',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10,
                  fontWeight: AppFont.heavy,
                ),
              ),
              Text(
                '${(mac?['home'] as Map?)?['name'] ?? 'Ev sahibi'} – '
                '${(mac?['away'] as Map?)?['name'] ?? 'Deplasman'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 14,
                  fontWeight: AppFont.heavy,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _kriterSatiri(Map k, String? resmiSonuc) {
    final bool? dogru = resmiSonuc != null ? k['signal'] == resmiSonuc : null;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${k['label']}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 12.5,
                    fontWeight: AppFont.bold,
                  ),
                ),
                if (k['familyLabel'] != null)
                  Text(
                    '${k['familyLabel']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 22,
            child: Text(
              '${k['signal'] ?? ''}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.black,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 20,
            child: Text(
              dogru == null ? '–' : (dogru ? '✓' : '✗'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: AppFont.black,
                color: dogru == null
                    ? AppColors.textMuted
                    : dogru
                    ? AppColors.success
                    : AppColors.danger,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Kart extends StatelessWidget {
  const _Kart({required this.baslik, this.alt, required this.children});

  final String baslik;
  final String? alt;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text(
            baslik,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 13,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        if (alt != null)
          Padding(
            padding: const EdgeInsets.only(bottom: Spacing.sm),
            child: Text(
              alt!,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                height: 15 / 11,
              ),
            ),
          ),
        ...children,
      ],
    ),
  );
}

class _Bos extends StatelessWidget {
  const _Bos(this.metin);

  final String metin;

  @override
  Widget build(BuildContext context) => Text(
    metin,
    style: const TextStyle(
      color: AppColors.textMuted,
      fontSize: 12,
      height: 17 / 12,
    ),
  );
}
