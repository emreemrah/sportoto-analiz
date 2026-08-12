// KAYNAK: app/src/components/CouponPickBlock.js — BİREBİR çeviri.
//
// Maç detayında KUPON SEÇİM bloğu — analiz görürken [1][X][2] + Sistemden al.
// Seçim paylaşılan TASLAĞA işlenir; Kupon Oluştur'dan kaydedilir. Kilit
// sonrası sadece görüntüleme. Yalnız resmi TEYİTLİ güncel bültendeki maçta
// görünür.
//
// KİLİT MAÇ BAZINDA: yalnız BU maç başladıysa seçim donar; bülten mühürlense
// bile başlamamış maça hafta boyunca seçim yapılabilir. Maç saati yoksa
// (belirsizlik) eski bülten kapanışına düşülür — asla habersiz açık kalmaz.

import 'package:flutter/material.dart';

import '../../core/coupon/coupon_config.dart';
import '../../core/coupon/coupon_store.dart';
import '../../core/theme/tokens.dart';

class CouponPickBlock extends StatefulWidget {
  const CouponPickBlock({super.key, required this.m, this.onKuponOlustur});

  final Map<String, dynamic> m;
  final void Function(Object roundId)? onKuponOlustur;

  @override
  State<CouponPickBlock> createState() => _CouponPickBlockState();
}

class _CouponPickBlockState extends State<CouponPickBlock> {
  List<String> _pick = const [];

  @override
  void initState() {
    super.initState();
    // Taslakta bu maç için kayıtlı seçim varsa geri yüklenir. Kaynakta blok
    // her açılışta boş başlıyordu (`useState([])`); taslak zaten diskte
    // durduğu için seçimi göstermemek kullanıcıya "kaydolmadı" izlenimi
    // veriyordu. Depo aynı, gösterim dürüstleşti.
    final roundId = widget.m['roundId'];
    final no = widget.m['no'];
    if (roundId == null || no == null) return;
    final picks = (getDraft(roundId)['picks'] as Map?) ?? const {};
    final mevcut = picks['$no'];
    if (mevcut is List) _pick = mevcut.cast<String>();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.m;
    // Yalnız resmi TEYİTLİ güncel bültendeki maçta görünür.
    if (m['verificationStatus'] != 'confirmed' || m['roundId'] == null) {
      return const SizedBox.shrink();
    }

    final locked = m['date'] != null
        ? isMatchLocked(m)
        : (m['closeDate'] != null &&
              !DateTime.now().isBefore(
                DateTime.tryParse('${m['closeDate']}')?.toLocal() ??
                    DateTime(9999),
              ));

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
        border: Border.all(color: AppColors.primary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '🎟️ KUPONA İŞLE',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: AppFont.black,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
              if (!locked)
                GestureDetector(
                  onTap: () =>
                      widget.onKuponOlustur?.call(m['roundId'] as Object),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: AppRadius.smR,
                    ),
                    child: Text(
                      'Kupon Oluştur ›',
                      style: TextStyle(
                        color: AppColors.onPrimary,
                        fontSize: 10.5,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          if (locked)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                '🔒 Maç başladı — bu maç için seçim değiştirilemez.',
                style: TextStyle(
                  color: AppColors.warning,
                  fontSize: 11.5,
                  fontWeight: AppFont.heavy,
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(top: 7),
              child: Row(
                children: [
                  for (final o in kOutcomes) ...[
                    Expanded(child: _isaretDugmesi(o)),
                    const SizedBox(width: 6),
                  ],
                  Flexible(
                    child: GestureDetector(
                      onTap: _sistemdenAl,
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSoft,
                          borderRadius: AppRadius.smR,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          '⚙ Sistemden al',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 10.5,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _isaretDugmesi(String o) {
    final on = _pick.contains(o);
    return Semantics(
      button: true,
      selected: on,
      label: '$o işareti${on ? ' — seçili' : ''}',
      child: GestureDetector(
        onTap: () => _degistir(o),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? AppColors.primary : AppColors.cardAlt,
            borderRadius: AppRadius.smR,
            border: Border.all(
              color: on ? AppColors.primary : Colors.transparent,
              width: 2,
            ),
            boxShadow: on ? AppShadow.soft : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (on) ...[
                Text(
                  '✓',
                  style: TextStyle(
                    color: AppColors.onPrimary,
                    fontSize: 11,
                    fontWeight: AppFont.black,
                  ),
                ),
                const SizedBox(width: 4),
              ],
              Text(
                o,
                style: TextStyle(
                  color: on ? AppColors.onPrimary : AppColors.textSoft,
                  fontSize: 14,
                  fontWeight: AppFont.black,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _yaz(List<String> arr) async {
    setState(() => _pick = arr);
    await setDraftPick(widget.m['roundId'], widget.m['no'] as Object, arr);
  }

  void _degistir(String o) {
    final set = _pick.toSet();
    if (!set.add(o)) set.remove(o);
    _yaz(kOutcomes.where(set.contains).toList());
  }

  /// "Sistemden al" → RESMÎ SİSTEM TAHMİNİ (2026-08-07).
  ///
  /// Eskiden kullanıcının kendi kriter profilinden hesaplanıyordu; kriter
  /// seçme sistemi kullanıcı kararıyla tamamen kaldırıldığı için artık
  /// bültenin resmî tahmini kullanılır. Tahmin yoksa SEÇİM YAPILMAZ
  /// (uydurma sembol yazılmaz).
  void _sistemdenAl() {
    final sym = (widget.m['prediction'] as Map?)?['symbol'] as String?;
    if (sym == null || sym == '-') return;
    // Resmî sembol '0' beraberliği gösterir; kupon tarafında 'X' kullanılır.
    final main = sym.split('').map((c) => c == '0' ? 'X' : c).join();
    _yaz(kOutcomes.where(main.contains).toList());
  }
}
