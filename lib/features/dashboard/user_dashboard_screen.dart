// KAYNAK: app/src/screens/UserDashboardScreen.js — BİREBİR çeviri.
//
// KULLANICI BAŞARI PANELİ — Spor Toto bülteniyle EŞ ZAMANLI: üstte ← hafta →
// gezme. Her hafta o haftanın resmi sonuç durumu + SİSTEMİN o haftaki GERÇEK
// başarısı + kullanıcının kupon durumu (gerçek kupon yoksa "kupon yok").
// Başarı YALNIZ resmi Spor Toto sonucuyla kesinleşir — canlı/geçici yazılmaz.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/coupon/coupon_store.dart';
import '../../core/live_logic.dart';
import '../../core/network/api_client.dart';
import '../../core/prefs.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/dashboard_ui.dart';
import '../../widgets/score_legend.dart';
import '../../widgets/states.dart';

/// JS'te `!!(m.result && m.score)` — boş dizge de FALSY sayılır.
bool _officialResolved(Map? m) {
  final r = m?['result'];
  final s = m?['score'];
  return r != null && '$r'.isNotEmpty && s != null;
}

String? _sysSymOf(Map m) {
  final p = m['prediction'];
  final sym = p is Map ? p['symbol'] : null;
  if (sym == null || '$sym'.isEmpty || sym == '-') return null;
  return '$sym';
}

typedef SkorGorunum = ({Color color, String score, String? result, String kind});

/// Skor renk kuralı (ANA KURAL): yeşil = resmi sonuç · sarı = henüz resmi değil ·
/// kırmızı = canlı. Resmi yoksa geçici skor gösterilir ama başarıya SAYILMAZ —
/// yalnız renk/bilgi amaçlı.
SkorGorunum? _scoreView(Map? m) {
  final r = m?['result'];
  final s = m?['score'];
  if (r != null && '$r'.isNotEmpty && s is Map) {
    return (
      color: AppColors.success,
      score: '${s['home']}-${s['away']}',
      result: '$r',
      kind: 'official',
    );
  }
  final pv = m?['provisional'];
  if (pv is Map && pv['score'] is Map) {
    final ps = pv['score'] as Map;
    final live = pv['live'] == true;
    return (
      color: live ? AppColors.accent : AppColors.warning,
      score: '${ps['home']}-${ps['away']}',
      result: resultFromScore(ps),
      kind: live ? 'live' : 'prov',
    );
  }
  return null;
}

typedef KuponSonuc = ({
  Object? id,
  Object? couponNo,
  bool ranked,
  int hit,
  int resolved,
  Object? columns,
  Object? amount,
});

class UserDashboardScreen extends StatefulWidget {
  const UserDashboardScreen({super.key});

  @override
  State<UserDashboardScreen> createState() => _UserDashboardScreenState();
}

class _UserDashboardScreenState extends State<UserDashboardScreen> {
  Map<String, dynamic>? _rounds;
  Object? _selectedId;
  Map<String, dynamic>? _hist;
  bool _histLoading = false;
  Map<String, dynamic>? _scorecard;
  late String _view = '${getPref('userDashView') ?? 'detailed'}';
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _boot();
    // sunucudan kalıcı kuponlar
    syncFromServer().then((synced) {
      if (synced && mounted) setState(() {});
    });
  }

  Future<void> _boot() async {
    setState(() => _error = null);
    try {
      // İkisi PARALEL: karne alınamazsa hafta listesi yine gelir.
      final sonuclar = await Future.wait([
        api.rounds(),
        api.systemScorecard().catchError((_) => null),
      ]);
      if (!mounted) return;
      final r = (sonuclar[0] as Map).cast<String, dynamic>();
      setState(() {
        _rounds = r;
        _scorecard = (sonuclar[1] as Map?)?.cast<String, dynamic>();
      });
      // Varsayılan: en son SONUÇLANMIŞ hafta (güncelden bir önceki) — hemen
      // başarı görünür.
      final all = (r['rounds'] as List?) ?? const [];
      final curIdx =
          all.indexWhere((x) => (x as Map)['id'] == r['currentRoundId']);
      final nav = curIdx >= 0 ? all.sublist(0, curIdx + 1) : all;
      final def = nav.length >= 2
          ? (nav[nav.length - 2] as Map)['id']
          : (r['currentRoundId'] ??
              (nav.isNotEmpty ? (nav.last as Map)['id'] : null));
      setState(() => _selectedId = def);
      _haftaYukle();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _haftaYukle() async {
    final rid = _selectedId;
    if (rid == null) return;
    setState(() => _histLoading = true);
    try {
      final h = (await api.history(rid) as Map).cast<String, dynamic>();
      // BAYAT YANIT KORUMASI: kullanıcı hafta değiştirdiyse geç gelen yanıt
      // yeni haftanın verisini EZMEZ.
      if (mounted && _selectedId == rid) {
        setState(() => _hist = {...h, 'roundId': rid});
      }
    } catch (_) {
      if (mounted && _selectedId == rid) setState(() => _hist = null);
    } finally {
      if (mounted && _selectedId == rid) setState(() => _histLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _rounds == null) {
      return _kabuk(const LoadingState(message: 'Başarı panelin hazırlanıyor…'));
    }
    if (_error != null) {
      return _kabuk(
        SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: Spacing.lg),
          child: ErrorState(message: _error, onRetry: _boot),
        ),
      );
    }

    // ——— hafta gezme ———
    final all = (_rounds?['rounds'] as List?) ?? const [];
    final currentRoundId = _rounds?['currentRoundId'];
    final curIdx = all.indexWhere((r) => (r as Map)['id'] == currentRoundId);
    final navRounds = curIdx >= 0 ? all.sublist(0, curIdx + 1) : all;
    final selIdx = navRounds.indexWhere((r) => (r as Map)['id'] == _selectedId);
    final selMeta = selIdx >= 0 ? navRounds[selIdx] as Map : null;
    final canPrev = selIdx > 0;
    final canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

    final week = _haftaHesap();
    final detailed = _view != 'simple';
    final technical = _view == 'technical';
    final overall = _scorecard?['hasData'] == true ? _scorecard : null;

    final weeks = (overall?['weeks'] as List?) ?? const [];
    Map? bestWeek;
    Map? worstWeek;
    if (weeks.isNotEmpty) {
      final s = weeks.cast<Map>().toList()
        ..sort((a, b) => _num(b['accuracy']).compareTo(_num(a['accuracy'])));
      bestWeek = s.first;
      worstWeek = s.last;
    }

    return _kabuk(
      ListView(
        padding: const EdgeInsets.fromLTRB(
          Spacing.lg,
          Spacing.lg,
          Spacing.lg,
          Spacing.xxxl,
        ),
        children: [
          const Text(
            'Başarı Panelim',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 22,
              fontWeight: AppFont.black,
            ),
          ),
          const SizedBox(height: Spacing.md),
          _haftaGezme(navRounds, selIdx, selMeta, canPrev, canNext),
          Padding(
            padding: const EdgeInsets.only(
              top: Spacing.md,
              bottom: Spacing.sm,
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: ViewModeToggle(
                value: _view,
                onChange: (v) {
                  setState(() => _view = v);
                  setPref('userDashView', v);
                },
              ),
            ),
          ),

          if (_histLoading && _hist == null)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Column(
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 8),
                  Text(
                    'Hafta yükleniyor…',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12.5,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ],
              ),
            )
          else ...[
            _kuponDurumu(week),
            _kapanisBaglantisi(),
            _haftaKarti(week),
            if (detailed) ...[
              DashboardSection(
                title: 'Maç Bazlı',
                sub: week.hasRanked
                    ? 'Sistem tahmini · resmi sonuç · dereceli kuponun (Kupon ${week.rankedNo}).'
                    : 'Sistemin tahmini ile resmi sonuç. (Dereceli kuponun yok.)',
              ),
              const ScoreLegend(),
              for (final m in ((_hist?['matches'] as List?) ?? const []))
                _macSatiri(m as Map, week),
            ],
            if (technical) ...[
              const DashboardSection(title: 'Teknik'),
              _teknikKart(selMeta, week),
            ],
          ],

          const DashboardSection(
            title: 'Genel Özet',
            sub: 'Tüm haftalar — resmi sonuçlara göre',
          ),
          if (overall != null)
            _genelOzet(overall, bestWeek, worstWeek)
          else
            _kart(const [
              Text(
                'Henüz resmi sonuçlanan maç yok — genel özet, resmi sonuçlar geldikçe oluşacak.',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12.5,
                  fontWeight: AppFont.semibold,
                ),
              ),
            ]),
        ],
      ),
    );
  }

  Widget _kabuk(Widget govde) => Scaffold(
    backgroundColor: AppColors.bg,
    appBar: AppBar(title: const Text('Başarı Panelim')),
    body: govde,
  );

  static num _num(Object? v) => v is num ? v : 0;

  /// Seçili hafta hesabı (resmi sonuç + sistem + KULLANICI dereceli kupon).
  _Hafta _haftaHesap() {
    final wm = (_hist?['matches'] as List?) ?? const [];
    final total = wm.length;
    final resolved = wm.where((m) => _officialResolved(m as Map)).toList();
    final sysR = resolved.where((m) => _sysSymOf(m as Map) != null).toList();
    final sysCorrect = sysR
        .where((m) => pickHits(_sysSymOf(m as Map), '${m['result']}') == true)
        .length;
    final hasPrize = _hist?['prize'] != null;
    final fullyResolved = total > 0 && resolved.length == total;
    final resultMap = <Object, String>{
      for (final m in resolved) (m as Map)['no'] as Object: '${m['result']}',
    };

    // Kullanıcının GERÇEK kuponları — resmi sonuçlara göre.
    KuponSonuc? couponResult(Map? coupon) {
      final v = finalVersion(coupon);
      if (v == null) return null;
      var hit = 0, res = 0;
      for (final sc in ((v['selections'] as List?) ?? const []).cast<Map>()) {
        final r = resultMap[sc['no']];
        if (r != null) {
          res += 1;
          final sec = (sc['selectedOutcomes'] as List?) ?? const [];
          if (sec.contains(r)) hit += 1;
        }
      }
      return (
        id: coupon!['id'],
        couponNo: coupon['couponNo'],
        ranked: coupon['isRankedCoupon'] == true,
        hit: hit,
        resolved: res,
        columns: v['columnCount'],
        amount: v['totalAmount'],
      );
    }

    final coupons =
        _selectedId != null ? getWeekCoupons(_selectedId) : <Map<String, dynamic>>[];
    final ranked = getRankedCoupon(_selectedId);
    final rankedRes = ranked != null ? couponResult(ranked) : null;
    final others = <KuponSonuc>[
      for (final c in coupons)
        if (c['isRankedCoupon'] != true) ?couponResult(c),
    ];

    // Dereceli kupondaki maç bazlı seçim (no → seçilen sonuçlar).
    final rankedPicks = <Object, List>{};
    if (ranked != null) {
      final rv = finalVersion(ranked);
      if (rv != null) {
        for (final sc in ((rv['selections'] as List?) ?? const []).cast<Map>()) {
          final sec = (sc['selectedOutcomes'] as List?) ?? const [];
          if (sec.isNotEmpty) rankedPicks[sc['no'] as Object] = sec;
        }
      }
    }

    final String status;
    if (resolved.isEmpty) {
      status = 'Sonuçlar bekleniyor';
    } else if (!fullyResolved) {
      status = 'Resmi sonuçlar bekleniyor · ${resolved.length}/$total geldi';
    } else if (!hasPrize) {
      status = 'Maç sonuçları tamamlandı · İkramiye bekleniyor';
    } else {
      status = 'Sonuçlar açıklandı';
    }

    return _Hafta(
      total: total,
      resolvedCount: resolved.length,
      fullyResolved: fullyResolved,
      hasPrize: hasPrize,
      sysTotal: sysR.length,
      sysCorrect: sysCorrect,
      status: status,
      hasCoupon: coupons.isNotEmpty,
      rankedRes: rankedRes,
      others: others,
      rankedPicks: rankedPicks,
      hasRanked: ranked != null,
      rankedNo: ranked?['couponNo'],
    );
  }

  Widget _haftaGezme(
    List all,
    int selIdx,
    Map? selMeta,
    bool canPrev,
    bool canNext,
  ) =>
      Container(
        padding: const EdgeInsets.all(Spacing.sm),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadow.card,
        ),
        child: Row(
          children: [
            _ok('‹', canPrev, 'Önceki hafta', () {
              setState(() => _selectedId = (all[selIdx - 1] as Map)['id']);
              _haftaYukle();
            }),
            Expanded(
              child: Column(
                children: [
                  Text(
                    '${selMeta?['name'] ?? '—'}',
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 17,
                      fontWeight: AppFont.black,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '${selMeta?['year'] ?? ''} Sezonu',
                      style: const TextStyle(
                        color: Color(0xFF9DB0CD),
                        fontSize: 11,
                        fontWeight: AppFont.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            _ok('›', canNext, 'Sonraki hafta', () {
              setState(() => _selectedId = (all[selIdx + 1] as Map)['id']);
              _haftaYukle();
            }),
          ],
        ),
      );

  Widget _ok(String isaret, bool acik, String etiket, VoidCallback onTap) =>
      Opacity(
        opacity: acik ? 1 : 0.3,
        child: Semantics(
          button: true,
          label: etiket,
          child: GestureDetector(
            onTap: acik ? onTap : null,
            child: Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.darkCardSoft,
                shape: BoxShape.circle,
              ),
              child: Text(
                isaret,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 24,
                  height: 26 / 24,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
          ),
        ),
      );

  Widget _kart(List<Widget> children) => Container(
    margin: const EdgeInsets.only(top: Spacing.sm),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadow.soft,
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );

  Widget _kuponDurumu(_Hafta week) {
    if (!week.hasCoupon) {
      return Container(
        margin: const EdgeInsets.only(top: Spacing.sm, bottom: Spacing.md),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
          boxShadow: AppShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Bu hafta kupon oluşturmadın',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 15,
                fontWeight: AppFont.black,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Bu haftanın resmi sonuçları görüntülenebilir, ancak senin başarı hesabın için kayıtlı kupon yok.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12.5,
                height: 18 / 12.5,
              ),
            ),
            const SizedBox(height: Spacing.sm),
            _dugme('Bülten Detayını Gör', () => context.go('/bulten')),
          ],
        ),
      );
    }

    final r = week.rankedRes;
    return Container(
      margin: const EdgeInsets.only(top: Spacing.sm, bottom: Spacing.md),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.warning, width: 1.5),
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '⭐ ANA DERECE · Dereceli Kupon',
            style: TextStyle(
              color: Color(0xFF7A4A00),
              fontSize: 10.5,
              fontWeight: AppFont.black,
              letterSpacing: 0.5,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: r == null
                ? const Text(
                    '—',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 20,
                      fontWeight: AppFont.black,
                    ),
                  )
                : RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 20,
                        fontWeight: AppFont.black,
                      ),
                      children: [
                        if (r.resolved > 0) ...[
                          TextSpan(
                            text: '${r.hit}',
                            style: const TextStyle(color: AppColors.success),
                          ),
                          TextSpan(text: '/${r.resolved} doğru'),
                          if (r.resolved < 15)
                            TextSpan(
                              text: '  · ${r.resolved}/15 resmi',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                        ] else
                          const TextSpan(text: 'sonuçlar bekleniyor'),
                      ],
                    ),
                  ),
          ),
          if (week.others.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(top: Spacing.md, bottom: 4),
              child: Text(
                'Diğer Kuponlar · ${week.others.length}',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11.5,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
            for (final o in week.others) _digerKuponSatiri(o),
          ],
          const SizedBox(height: Spacing.sm),
          _dugme('Kuponlarım', () => context.go('/kuponlarim')),
        ],
      ),
    );
  }

  Widget _digerKuponSatiri(KuponSonuc o) => GestureDetector(
    // 'Coupons' diye bir ekran YOK — kaynakta bu satır hiçbir yere gitmiyordu.
    // Kuponlarım sekmesindeki GERÇEK sonuç ekranına gider.
    onTap: () => context.go(
      '/kuponlarim/kupon-sonuc/$_selectedId?couponId=${o.id}',
    ),
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: RichText(
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              text: TextSpan(
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 13,
                  fontWeight: AppFont.bold,
                ),
                children: [
                  TextSpan(text: 'Kupon ${o.couponNo}'),
                  const TextSpan(
                    text: '  · Derecesiz',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          RichText(
            text: TextSpan(
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: AppFont.semibold,
              ),
              children: [
                if (o.resolved > 0) ...[
                  TextSpan(
                    text: '${o.hit}',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontWeight: AppFont.black,
                    ),
                  ),
                  TextSpan(text: '/${o.resolved} doğru'),
                ] else
                  TextSpan(text: '${o.columns} kolon · ${o.amount}₺'),
                const TextSpan(text: '  ›'),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _dugme(String metin, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 11),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(
        metin,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 13.5,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );

  /// HAFTA KAPANIŞI — seçili haftanın sen vs sistem karnesi.
  Widget _kapanisBaglantisi() => GestureDetector(
    onTap: () =>
        context.go('/ana-sayfa/hafta-kapanisi?roundId=$_selectedId'),
    behavior: HitTestBehavior.opaque,
    child: Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.symmetric(vertical: 12),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFF132244),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: const Text(
        '🏁 Bu Haftanın Kapanışı · Sen vs Sistem ›',
        style: TextStyle(
          color: AppColors.white,
          fontSize: 13,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );

  Widget _haftaKarti(_Hafta week) => _kart([
    _satir(
      'Resmi sonuç durumu',
      Text(
        week.status,
        textAlign: TextAlign.right,
        style: TextStyle(
          color: (week.fullyResolved && week.hasPrize)
              ? AppColors.success
              : AppColors.text,
          fontSize: 12.5,
          fontWeight: AppFont.bold,
        ),
      ),
    ),
    _satir(
      'Sistem bu hafta',
      week.sysTotal > 0
          ? RichText(
              text: TextSpan(
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 12.5,
                  fontWeight: AppFont.bold,
                ),
                children: [
                  TextSpan(
                    text: '${week.sysCorrect}',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontWeight: AppFont.black,
                    ),
                  ),
                  TextSpan(text: '/${week.sysTotal} doğru'),
                ],
              ),
            )
          : Text(
              week.resolvedCount == 0 ? 'sonuç bekleniyor' : '—',
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 12.5,
                fontWeight: AppFont.bold,
              ),
            ),
    ),
    _satir(
      'Senin doğru sayın (dereceli)',
      (week.hasCoupon && week.rankedRes != null && week.rankedRes!.resolved > 0)
          ? RichText(
              text: TextSpan(
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 12.5,
                  fontWeight: AppFont.bold,
                ),
                children: [
                  TextSpan(
                    text: '${week.rankedRes!.hit}',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontWeight: AppFont.black,
                    ),
                  ),
                  TextSpan(text: '/${week.rankedRes!.resolved}'),
                ],
              ),
            )
          : Text(
              week.hasCoupon ? 'sonuç bekleniyor' : 'kupon yok',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12.5,
                fontWeight: AppFont.semibold,
              ),
            ),
      son: true,
    ),
  ]);

  Widget _satir(String k, Widget v, {bool son = false}) => Container(
    padding: const EdgeInsets.symmetric(vertical: 9),
    decoration: son
        ? null
        : const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            k,
            style: const TextStyle(
              color: AppColors.textSoft,
              fontSize: 12.5,
              fontWeight: AppFont.semibold,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Flexible(child: v),
      ],
    ),
  );

  Widget _macSatiri(Map m, _Hafta week) {
    // ✅/❌ YALNIZ resmi sonuçtan.
    final res = _officialResolved(m);
    final sv = _scoreView(m);
    final sym = _sysSymOf(m);
    final sysHit = (res && sym != null) ? pickHits(sym, '${m['result']}') : null;
    final myPick = week.rankedPicks[m['no']];
    final myHit = (res && myPick != null) ? myPick.contains('${m['result']}') : null;
    final d = matchDate(m['date'] as String?);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 22,
            child: Text(
              '${m['no']}',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: AppFont.black,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${(m['home'] as Map?)?['name']} - ${(m['away'] as Map?)?['name']}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 13,
                    fontWeight: AppFont.bold,
                  ),
                ),
                if (d.day.isNotEmpty || d.time.isNotEmpty)
                  Text(
                    '${d.day}${d.day.isNotEmpty && d.time.isNotEmpty ? ' · ' : ''}${d.time}',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (sv != null)
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 12.5),
                    children: [
                      TextSpan(
                        text: sv.score,
                        style: TextStyle(
                          color: sv.color,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      if (sv.result != null) ...[
                        const TextSpan(
                          text: ' · ',
                          style: TextStyle(color: AppColors.textMuted),
                        ),
                        TextSpan(
                          text: sv.result,
                          style: TextStyle(
                            color: sv.color,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ],
                    ],
                  ),
                )
              else
                const Text(
                  'bekliyor',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11.5),
                ),
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: RichText(
                  textAlign: TextAlign.right,
                  text: TextSpan(
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                    children: [
                      const TextSpan(text: 'Sistem: '),
                      TextSpan(
                        text: sym ?? '—',
                        style: const TextStyle(
                          color: AppColors.text,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      TextSpan(
                        text: ' ${sysHit == null ? '⏳' : (sysHit ? '✅' : '❌')}',
                      ),
                      const TextSpan(text: '  ·  Sen: '),
                      TextSpan(
                        text: myPick != null ? myPick.join('/') : '—',
                        style: TextStyle(
                          color: myPick != null
                              ? AppColors.primary
                              : AppColors.textMuted,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      TextSpan(
                        text: myPick == null
                            ? ''
                            : ' ${myHit == null ? '⏳' : (myHit ? '✅' : '❌')}',
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _teknikKart(Map? selMeta, _Hafta week) => _kart([
    _teknikSatir('Sezon', '${selMeta?['year'] ?? '—'}'),
    _teknikSatir('Hafta', '${selMeta?['name'] ?? '—'}'),
    _teknikSatir('roundId / bulletinId', '${_selectedId ?? '—'}'),
    _teknikSatir(
      'Resmi sonuç',
      '${week.resolvedCount}/${week.total} geldi',
    ),
    _teknikSatir(
      'Kupon',
      week.hasCoupon
          ? '${week.others.length + (week.hasRanked ? 1 : 0)} kayıtlı kupon'
          : 'kayıtlı kupon yok',
      son: true,
    ),
  ]);

  Widget _teknikSatir(String k, String v, {bool son = false}) => Container(
    padding: const EdgeInsets.symmetric(vertical: 7),
    decoration: son
        ? null
        : const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            k,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 11.5,
              fontWeight: AppFont.bold,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Text(
            v,
            maxLines: 2,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 11.5,
              fontWeight: AppFont.semibold,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _genelOzet(Map overall, Map? bestWeek, Map? worstWeek) => _kart([
    MetricBar(
      label: 'Sistem genel isabeti',
      value: _num(overall['accuracy']),
    ),
    Row(
      children: [
        _ozetHucre('Toplam maç', '${overall['total']}'),
        _ozetHucre('Doğru', '${overall['correct']}', AppColors.success),
        _ozetHucre('Yanlış', '${overall['wrong']}', AppColors.danger),
      ],
    ),
    if (bestWeek != null && worstWeek != null)
      Padding(
        padding: const EdgeInsets.only(top: Spacing.sm),
        child: Row(
          children: [
            _ozetHucre(
              'En başarılı hafta',
              '${bestWeek['round']} · %${bestWeek['accuracy']}',
              null,
              true,
            ),
            _ozetHucre(
              'En zayıf hafta',
              '${worstWeek['round']} · %${worstWeek['accuracy']}',
              null,
              true,
            ),
          ],
        ),
      ),
  ]);

  Widget _ozetHucre(
    String label,
    String v, [
    Color? c,
    bool kucuk = false,
  ]) {
    return _ozetHucreIc(label, v, c, kucuk);
  }

  Widget _ozetHucreIc(String label, String v, Color? c, bool kucuk) =>
      Expanded(
        child: Column(
          children: [
            Text(
              v,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: c ?? AppColors.text,
                fontSize: kucuk ? 12.5 : 18,
                fontWeight: AppFont.black,
              ),
            ),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                fontWeight: AppFont.bold,
              ),
            ),
          ],
        ),
      );
}

class _Hafta {
  const _Hafta({
    required this.total,
    required this.resolvedCount,
    required this.fullyResolved,
    required this.hasPrize,
    required this.sysTotal,
    required this.sysCorrect,
    required this.status,
    required this.hasCoupon,
    required this.rankedRes,
    required this.others,
    required this.rankedPicks,
    required this.hasRanked,
    required this.rankedNo,
  });

  final int total;
  final int resolvedCount;
  final bool fullyResolved;
  final bool hasPrize;
  final int sysTotal;
  final int sysCorrect;
  final String status;
  final bool hasCoupon;
  final KuponSonuc? rankedRes;
  final List<KuponSonuc> others;
  final Map<Object, List> rankedPicks;
  final bool hasRanked;
  final Object? rankedNo;
}
