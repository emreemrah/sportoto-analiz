// KAYNAK: app/src/screens/CouponCenterScreen.js (511 satır)
//
// KUPON MERKEZİ — kupon listesi/yönetim ekranı. Hafta hafta gezilir; her
// kuponun adı, oluşturma/güncelleme zamanı, kolon sayısı, (fiyat verisi varsa)
// maliyeti ve durumu görünür. Kuponlar birbirinden bağımsızdır (kopya dahil).
// Başarı YALNIZ resmi sonuçla, kilitli final versiyonla kesinleşir.
//
// KUTULAR SALT OKUNUR: kupon burada DÜZENLENMEZ. 1-0-2 kutuları yalnız kayıtlı
// seçimi gösterir; değiştirme tek yerden, Kupon Editörü'nden yapılır.
//
// KAYNAKTAN TAŞINAN İKİ İLKE:
//
//  1. "SEBEPSİZ KAPALI DÜĞME, SESSİZ DÜĞMEDEN BETERDİR." Silme kapalıysa
//     sebebi YAZILIR: kilitli/geçmiş hafta kuponu silinmez, çünkü silinirse
//     tutturma karnesi geriye dönük değişir.
//
//  2. "OYNADIM" YALNIZ BEYANDIR. Operatör entegrasyonu YOK; işaret her yerde
//     "kullanıcı beyanı (doğrulanmamış)" etiketiyle görünür.
//
// KAPSAM DIŞI — YAYIN STÜDYOSU: `studioParts.js` tablo görünümü (arma +
// 1-0-2 kutulu resmî bülten tablosu) kullanıcı kararıyla projeden
// çıkarılmıştır. Eksik çeviri DEĞİLDİR: parite denetimlerinde eksik özellik
// sayılmaz ve yeniden eklenmez. Bu ekran sade kupon kartını çizer.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/coupon/coupon_config.dart';
import '../../core/coupon/coupon_eval.dart';
import '../../core/coupon/coupon_store.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/takim_logo_zemin.dart';

String _fmtTL(num n) {
  final s = n.round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
    buf.write(s[i]);
  }
  return '$buf TL';
}

String _fmtDT(Object? iso) {
  final d = iso is String ? DateTime.tryParse(iso)?.toLocal() : null;
  if (d == null) return '';
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(d.day)}.${p(d.month)} ${p(d.hour)}:${p(d.minute)}';
}

/// Resmî gösterim: ['1','X'] → "1-0"
String? _resmi(Object? sym) {
  if (sym == null) return null;
  return '$sym'.split('').map(toOfficial).join('-');
}

final _roundsProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
  (ref) async => Map<String, dynamic>.from(await api.rounds() as Map),
);

final _bulletinProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((
  ref,
) async {
  try {
    return Map<String, dynamic>.from(await api.bulletin() as Map);
  } catch (_) {
    return null;
  }
});

final _historyProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>?, Object>((ref, rid) async {
      try {
        return Map<String, dynamic>.from(await api.history(rid) as Map);
      } catch (_) {
        return null;
      }
    });

class CouponCenterScreen extends ConsumerStatefulWidget {
  const CouponCenterScreen({super.key});

  @override
  ConsumerState<CouponCenterScreen> createState() => _CouponCenterScreenState();
}

class _CouponCenterScreenState extends ConsumerState<CouponCenterScreen> {
  Object? _selectedId;
  final Set<Object> _acikTablo = {};

  @override
  void initState() {
    super.initState();
    // Ekran açılınca sunucudaki kuponları çek/birleştir.
    Future.microtask(syncFromServer);
  }

  @override
  Widget build(BuildContext context) {
    final roundsAsync = ref.watch(_roundsProvider);
    final bulletin = ref.watch(_bulletinProvider).valueOrNull;
    // Depo değişince ekran tazelensin.
    ref.watch(couponSurumuProvider);

    if (roundsAsync.isLoading) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    final rounds = roundsAsync.valueOrNull;
    final all = (rounds?['rounds'] as List?) ?? const [];
    final currentRoundId = rounds?['currentRoundId'];
    final curIdx = all.indexWhere((r) => (r as Map)['id'] == currentRoundId);
    final navRounds = curIdx >= 0 ? all.sublist(0, curIdx + 1) : all;

    final selectedId = _selectedId ?? currentRoundId;
    final selIdx = navRounds.indexWhere((r) => (r as Map)['id'] == selectedId);
    final selMeta = selIdx >= 0 ? navRounds[selIdx] as Map : null;
    final canPrev = selIdx > 0;
    final canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

    final hist = selectedId == null
        ? null
        : ref.watch(_historyProvider(selectedId)).valueOrNull;

    final coupons = selectedId != null ? getWeekCoupons(selectedId) : <Map>[];

    final resultMap = <Object, Object?>{
      for (final m in ((hist?['matches'] as List?) ?? const []).cast<Map>())
        if (m['result'] != null && m['score'] != null)
          m['no'] as Object: m['result'],
    };

    final pricingRaw = bulletin?['couponPricing'] as Map?;
    final pricing = validPricing(pricingRaw) ? pricingRaw : null;

    final isCurrent = selectedId == currentRoundId;

    // KİLİT MAÇ BAZINDA: güncel haftada EN AZ BİR maç başlamadıysa kupon
    // açılabilir/düzenlenebilir; yalnız TÜM maçlar başlayınca hafta kapanır.
    final bulletinMatches = (isCurrent && bulletin?['roundId'] == selectedId)
        ? ((bulletin?['matches'] as List?) ?? const [])
        : const [];
    final lockMap = lockMapOf(bulletinMatches);
    final now = DateTime.now();
    final openCount = bulletinMatches.cast<Map>().where((m) {
      final la = lockMap[m['no']];
      return la == null || now.isBefore(la);
    }).length;

    final lockAt = coupons.isNotEmpty
        ? (coupons.first['lockedAt'] is String
              ? DateTime.tryParse(
                  coupons.first['lockedAt'] as String,
                )?.toLocal()
              : null)
        : null;
    final locked = isLockedNow(lockAt);
    final canEdit =
        isCurrent && (bulletinMatches.isNotEmpty ? openCount > 0 : !locked);

    // SİLME NEDEN KAPALI? — düğmeyi sessizce yok etmek yerine sebebini yazarız.
    final silmeSebebi = canEdit
        ? null
        : (!isCurrent
              ? 'Geçmiş haftanın kuponu silinemez — karne kaydı geriye dönük '
                    'değişmesin diye arşivde kalır.'
              : 'Maçlar başladı, hafta kilitlendi — kilitli kupon silinemez '
                    '(geriye dönük karne değişmesin).');

    final sync = getSyncState();

    return Scaffold(
      body: filigranli(
        SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.all(Spacing.md),
            children: [
              // ── Hafta gezinme ──
              Row(
                children: [
                  _okDugme('‹', canPrev, () {
                    setState(
                      () => _selectedId = (navRounds[selIdx - 1] as Map)['id'],
                    );
                  }),
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          'Kupon Merkezi',
                          style: TextStyle(
                            color: AppColors.text,
                            fontSize: 17,
                            fontWeight: AppFont.black,
                          ),
                        ),
                        Text(
                          '${selMeta?['name'] ?? '—'}'
                          '${selMeta?['year'] != null ? ' · ${selMeta!['year']}' : ''}',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _okDugme('›', canNext, () {
                    setState(
                      () => _selectedId = (navRounds[selIdx + 1] as Map)['id'],
                    );
                  }),
                ],
              ),
              const SizedBox(height: 10),

              // ── Senkron durumu — kayıt hatasında kupon YERELDE güvende ──
              if (sync.loggedIn && sync.error != null)
                _serit(
                  '⚠ Sunucuya kaydedilemedi: ${sync.error}\n'
                  'Kuponların cihazda güvende — tekrar denenebilir.',
                  AppColors.warning,
                  eylem: 'Tekrar Dene',
                  onEylem: () async {
                    await retrySync();
                    if (mounted) setState(() {});
                  },
                )
              else if (!sync.loggedIn)
                _serit(
                  'Kuponlar yalnız bu cihazda. Hesabına bağlamak ve başka '
                  'cihazdan görmek için Profil sekmesinden giriş yap.',
                  AppColors.info,
                ),

              // ── Yeni kupon ──
              if (canEdit)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _dugme(
                    '+ Yeni Kupon'
                    '${bulletinMatches.isNotEmpty && openCount < bulletinMatches.length ? ' · $openCount maç açık' : ''}',
                    dolu: true,
                    onTap: () => GoRouter.of(
                      context,
                    ).go('/kuponlarim/kupon-editor/$selectedId'),
                  ),
                )
              else if (silmeSebebi != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(silmeSebebi, style: _notStil),
                ),

              if (coupons.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 20),
                  child: EmptyState(
                    icon: '🎟️',
                    title: 'Bu hafta için kupon yok',
                    message:
                        'Maç detayındaki "KUPONA İŞLE" bloğundan seçim '
                        'yapıp Kupon Oluştur ile kaydedebilirsin.',
                  ),
                )
              else
                for (final c in coupons)
                  _kuponKarti(
                    c,
                    resultMap: resultMap,
                    pricing: pricing,
                    canEdit: canEdit,
                    silmeSebebi: silmeSebebi,
                    openCount: openCount,
                    toplamMac: bulletinMatches.length,
                    lockMap: lockMap,
                    selectedId: selectedId,
                    selMeta: selMeta,
                  ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _kuponKarti(
    Map c, {
    required Map<Object, Object?> resultMap,
    required Map? pricing,
    required bool canEdit,
    required String? silmeSebebi,
    required int openCount,
    required int toplamMac,
    required Map<Object, DateTime> lockMap,
    required Object? selectedId,
    required Map? selMeta,
  }) {
    final v = finalVersion(c);
    final ev = evalCoupon(c, resultMap);
    final kolon = v?['columnCount'];
    final maliyet = costOf(kolon is num ? kolon.toInt() : null, pricing);

    final durum = canEdit
        ? (openCount > 0 && toplamMac > 0 && openCount < toplamMac
              ? 'Açık · $openCount maç düzenlenebilir'
              : 'Açık · düzenlenebilir')
        : (ev == null || ev.resolved == 0
              ? 'Kilitli · sonuçlar bekleniyor'
              : (!ev.allResolved
                    ? 'Resmî sonuçlar: ${ev.resolved}/${ev.total}'
                    : 'Sonuçlandı'));

    final acik = _acikTablo.contains(c['id']);

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
        border: Border.all(
          color: c['isRankedCoupon'] == true
              ? AppColors.primary
              : AppColors.border,
        ),
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${c['name']}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 14,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
              if (c['isRankedCoupon'] == true)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: AppRadius.smR,
                    border: Border.all(color: AppColors.primary),
                  ),
                  child: Text(
                    'DERECELİ',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 8.5,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${_fmtDT(c['updatedAt'] ?? c['createdAt'])} · '
            'Kolon: ${kolon ?? '—'}'
            // FİYAT UYDURULMAZ: veri yoksa tutar satırı hiç yazılmaz.
            '${maliyet != null ? ' · ${_fmtTL(maliyet)}' : ''}',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 11,
              fontWeight: AppFont.bold,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(
                  durum,
                  style: TextStyle(
                    color: canEdit ? AppColors.success : AppColors.textSoft,
                    fontSize: 11.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
              if (ev?.tier != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.successSoft,
                    borderRadius: AppRadius.smR,
                    border: Border.all(color: AppColors.success),
                  ),
                  child: Text(
                    '${ev!.tier} bildi',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontSize: 10.5,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
            ],
          ),

          // "OYNADIM" BEYANI — doğrulanmış gibi ASLA gösterilmez.
          if (c['playedMarkedAt'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '🔒 Tahmin kilitlendi — kullanıcı beyanı, bağımsız olarak '
                'doğrulanmamıştır.',
                style: _notStil,
              ),
            ),

          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _kucukDugme(
                acik ? 'Seçimleri gizle ▲' : 'Seçimleri göster ▼',
                () => setState(() {
                  if (acik) {
                    _acikTablo.remove(c['id']);
                  } else {
                    _acikTablo.add(c['id'] as Object);
                  }
                }),
              ),
              _kucukDugme(
                c['playedMarkedAt'] != null
                    ? 'Kilidi kaldır'
                    : 'Tahminimi Kilitle',
                () => _oynadimDegistir(c),
              ),
              _kucukDugme('Çoğalt', () => _cogalt(c, lockMap)),
              if (c['isRankedCoupon'] != true && canEdit)
                _kucukDugme('Dereceli yap', () => _dereceliYap(c)),
              // SONUÇ düğmesi YALNIZ resmî sonuç geldiyse görünür — sonuçsuz
              // bir hafta için "Sonuç" demek boş bir tablo açmak olurdu.
              if (resultMap.isNotEmpty)
                _kucukDugme(
                  'Sonuç',
                  () => context.push(
                    '/kuponlarim/kupon-sonuc/$selectedId?couponId=${c['id']}'
                    '&roundName=${Uri.encodeComponent('${selMeta?['name'] ?? ''}')}'
                    '&season=${Uri.encodeComponent('${selMeta?['year'] ?? ''}')}',
                  ),
                ),
              _kucukDugme(
                'Paylaş',
                () => context.push(
                  '/kuponlarim/kupon-paylas/${c['id']}?roundId=$selectedId'
                  '&roundName=${Uri.encodeComponent('${selMeta?['name'] ?? ''}')}'
                  '&season=${Uri.encodeComponent('${selMeta?['year'] ?? ''}')}',
                ),
              ),
              if (canEdit) _kucukDugme('Sil', () => _sil(c), tehlike: true),
            ],
          ),

          if (acik) _secimTablosu(v, resultMap),
        ],
      ),
    );
  }

  Widget _secimTablosu(Map? v, Map<Object, Object?> resultMap) {
    final selections = (v?['selections'] as List?) ?? const [];
    if (selections.isEmpty) {
      return Padding(
        padding: EdgeInsets.only(top: 8),
        child: Text('Bu kuponda seçim yok.', style: _notStil),
      );
    }

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          for (final sc in selections.cast<Map>())
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  SizedBox(
                    width: 22,
                    child: Text(
                      '${sc['no']}',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      _resmi(
                            ((sc['selectedOutcomes'] as List?) ?? const [])
                                .join(),
                          ) ??
                          '—',
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 12.5,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                  ),
                  // Resmî sonuç YOKSA işaret konmaz (⏳) — uydurma
                  // değerlendirme yapılmaz.
                  Builder(
                    builder: (_) {
                      final actual = normResult(resultMap[sc['no']]);
                      if (actual == null) {
                        return const Text('⏳', style: TextStyle(fontSize: 12));
                      }
                      final tuttu =
                          ((sc['selectedOutcomes'] as List?) ?? const [])
                              .contains(actual);
                      return Text(
                        tuttu ? '✅' : '❌',
                        style: const TextStyle(fontSize: 12),
                      );
                    },
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _oynadimDegistir(Map c) async {
    if (c['playedMarkedAt'] == null) {
      final onay = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: AppColors.surface,
          title: const Text('Tahminimi Kilitle'),
          content: const Text(
            'Bu işaret YALNIZCA senin beyanındır; bağımsız olarak '
            'DOĞRULANMAZ ve her yerde "kullanıcı beyanı" olarak görünür. '
            'Kilitlensin mi?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Vazgeç'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('İşaretle'),
            ),
          ],
        ),
      );
      if (onay != true) return;
      await markPlayed(c['id'] as Object, true);
    } else {
      await markPlayed(c['id'] as Object, false);
    }
    if (mounted) setState(() {});
  }

  Future<void> _cogalt(Map c, Map<Object, DateTime> lockMap) async {
    final r = await copyCoupon(
      c['id'] as Object,
      lockMap: lockMap.isNotEmpty ? lockMap : null,
    );
    if (!mounted) return;
    final hata = r.sonuc.error;
    if (hata == 'locked') {
      _uyar('Kilitli haftada kupon kopyalanamaz (yeni kupon açılamaz).');
    } else if (hata == 'locked-match') {
      _uyar('Başlamış maç seçimleri yeni kupona taşınamaz.');
    } else if (hata == 'max') {
      _uyar('Haftalık $kMaxCouponsPerWeek kupon hakkı doldu.');
    } else if (r.strippedNos.isNotEmpty) {
      _uyar(
        'Başlamış ${r.strippedNos.length} maçın seçimi kopyaya taşınmadı '
        '(${r.strippedNos.join(', ')}. maç) — geriye dönük isabet üretilmez.',
      );
    }
    setState(() {});
  }

  Future<void> _dereceliYap(Map c) async {
    final r = await setRanked(c['roundId'], c['id'] as Object);
    if (!mounted) return;
    if (r.error == 'locked') {
      _uyar('Kilit sonrası dereceli kupon değiştirilemez.');
    }
    setState(() {});
  }

  Future<void> _sil(Map c) async {
    final onay = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Kupon sil'),
        content: Text('"${c['name']}" silinsin mi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sil', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (onay != true) return;
    await deleteCoupon(c['id'] as Object);
    if (mounted) setState(() {});
  }

  void _uyar(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Widget _okDugme(String ok, bool acik, VoidCallback onTap) => Opacity(
    opacity: acik ? 1 : 0.3,
    child: GestureDetector(
      onTap: acik ? onTap : null,
      child: Container(
        width: 36,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.cardAlt,
          shape: BoxShape.circle,
        ),
        child: Text(
          ok,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 20,
            fontWeight: AppFont.black,
            height: 1,
          ),
        ),
      ),
    ),
  );

  Widget _dugme(String etiket, {bool dolu = false, VoidCallback? onTap}) =>
      GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: dolu ? AppColors.primary : AppColors.card,
            borderRadius: AppRadius.mdR,
            border: Border.all(
              color: dolu ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Text(
            etiket,
            style: TextStyle(
              color: dolu ? AppColors.white : AppColors.text,
              fontSize: 13.5,
              fontWeight: AppFont.black,
            ),
          ),
        ),
      );

  Widget _kucukDugme(
    String etiket,
    VoidCallback onTap, {
    bool tehlike = false,
  }) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tehlike ? AppColors.dangerSoft : AppColors.bgAlt,
        borderRadius: AppRadius.smR,
        border: Border.all(
          color: tehlike ? AppColors.danger : AppColors.border,
        ),
      ),
      child: Text(
        etiket,
        style: TextStyle(
          color: tehlike ? AppColors.danger : AppColors.textSoft,
          fontSize: 11,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );

  Widget _serit(
    String metin,
    Color renk, {
    String? eylem,
    VoidCallback? onEylem,
  }) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: renk.withValues(alpha: 0.08),
      borderRadius: AppRadius.smR,
      border: Border.all(color: renk),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          metin,
          style: TextStyle(
            color: renk,
            fontSize: 11.5,
            height: 1.45,
            fontWeight: AppFont.bold,
          ),
        ),
        if (eylem != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: _kucukDugme(eylem, onEylem ?? () {}),
          ),
      ],
    ),
  );
}

TextStyle _notStil = TextStyle(
  color: AppColors.textMuted,
  fontSize: 10.5,
  height: 1.4,
);

/// Kupon deposu değişince ekranı tazeleyen köprü.
final couponSurumuProvider = StreamProvider.autoDispose<int>((ref) {
  final ctl = StreamController<int>();
  void dinle() => ctl.add(couponSurumu.value);
  couponSurumu.addListener(dinle);
  ref.onDispose(() {
    couponSurumu.removeListener(dinle);
    ctl.close();
  });
  return ctl.stream;
});
