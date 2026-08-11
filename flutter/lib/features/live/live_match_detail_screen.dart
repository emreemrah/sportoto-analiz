// KAYNAK: app/src/screens/LiveMatchDetailScreen.js — BİREBİR çeviri.
//
// CANLI MAÇ DETAY — sekmeler: İstatistik (varsayılan) · Olaylar · Kupon/Sistem ·
// Özet. Tüm canlı istatistik/olaylar GERÇEK API-Football verisidir; veri yoksa
// alan gizlenir / boş durum gösterilir (uydurma YOK). 15 sn'de bir yenilenir.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/coupon/coupon_store.dart';
import '../../core/live_events.dart';
import '../../core/live_logic.dart';
import '../../core/network/api_client.dart';
import '../../core/prefs.dart';
import '../../core/theme/tokens.dart';
import 'live_timeline.dart';

const Duration _kRefresh = Duration(seconds: 15);
const List<String> _kTabs = ['İstatistik', 'Olaylar', 'Kupon/Sistem', 'Özet'];

/// API-Football istatistik türü → Türkçe. Bilinmeyen tür ham gösterilir.
const Map<String, String> _statTr = {
  'Shots on Goal': 'İsabetli Şut',
  'Shots off Goal': 'İsabetsiz Şut',
  'Total Shots': 'Şut',
  'Blocked Shots': 'Bloklanan Şut',
  'Shots insidebox': 'Ceza Sahası İçi Şut',
  'Shots outsidebox': 'Ceza Sahası Dışı Şut',
  'Fouls': 'Faul',
  'Corner Kicks': 'Korner',
  'Offsides': 'Ofsayt',
  'Ball Possession': 'Topla Oynama',
  'Yellow Cards': 'Sarı Kart',
  'Red Cards': 'Kırmızı Kart',
  'Goalkeeper Saves': 'Kaleci Kurtarışı',
  'Total passes': 'Pas',
  'Passes accurate': 'İsabetli Pas',
  'Passes %': 'Pas İsabeti',
  'expected_goals': 'xG',
};

String _statLabel(Object? t) => _statTr['$t'] ?? '$t';

/// Grafik payı için sayı — çevrilemeyen değer 0 sayılır (kaynakta da böyle;
/// yalnız çubuk oranı için kullanılır, ekrana ham değer basılır).
double _numOf(Object? v) => sayiVeyaNull(v) ?? 0;

String _eventIcon(Map e) {
  final t = '${e['type'] ?? ''}'.toLowerCase();
  final d = '${e['detail'] ?? ''}'.toLowerCase();
  if (t == 'goal') return '⚽';
  if (t == 'card') return d.contains('red') ? '🟥' : '🟨';
  if (t == 'subst') return '🔁';
  if (t == 'var') return '📺';
  return '•';
}

String _eventLabel(Map e) {
  final t = '${e['type'] ?? ''}'.toLowerCase();
  final d = '${e['detail'] ?? ''}';
  if (t == 'goal') {
    return d.toLowerCase().contains('penalty') ? 'Gol (Penaltı)' : 'Gol';
  }
  if (t == 'card') {
    return d.toLowerCase().contains('red') ? 'Kırmızı Kart' : 'Sarı Kart';
  }
  if (t == 'subst') return 'Oyuncu Değişikliği';
  if (t == 'var') return 'VAR${d.isNotEmpty ? ' · $d' : ''}';
  return '${e['type'] ?? 'Olay'}';
}

/// Kullanıcının bu maça yaptığı gerçek kupon seçimi.
typedef _MyPick = ({
  Object? id,
  Object? couponNo,
  bool ranked,
  List outcomes,
  String label,
  bool? hit,
});

class LiveMatchDetailScreen extends StatefulWidget {
  const LiveMatchDetailScreen({super.key, required this.no});

  final Object no;

  @override
  State<LiveMatchDetailScreen> createState() => _LiveMatchDetailScreenState();
}

class _LiveMatchDetailScreenState extends State<LiveMatchDetailScreen>
    // İKİ denetleyici var (nabız + flaş) → Single* DEĞİL, çoklu ticker mixin'i.
    with
        TickerProviderStateMixin,
        WidgetsBindingObserver {
  Map? _d;
  String? _error;
  bool _loading = true;
  String _tab = 'İstatistik';
  String? _statView;

  Timer? _zamanlayici;
  late final AnimationController _nabiz;
  late final AnimationController _flas;
  String? _oncekiSkor;

  @override
  void initState() {
    super.initState();
    // Kaynakta varsayılan `undefined`dı ve `statView === 'table'` karşılaştırması
    // false kalıyordu; ilk açılışta hiçbir çip seçili görünmeden TABLO
    // çiziliyordu (else dalı). Burada 'table' varsayılan yapıldı: aynı içerik,
    // ama çipi de doğru gösterir.
    _statView = getPref('liveStatView') as String? ?? 'table';
    _nabiz = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
      lowerBound: 0.4,
      upperBound: 1,
    )..value = 1;
    _flas = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    WidgetsBinding.instance.addObserver(this);
    _yukle();
    _zamanlayici = Timer.periodic(_kRefresh, (_) {
      // Kaynakta `document.visibilityState === 'hidden'` kontrolü vardı;
      // Flutter karşılığı uygulama yaşam döngüsüdür.
      final yasam = WidgetsBinding.instance.lifecycleState;
      if (yasam != null && yasam != AppLifecycleState.resumed) return;
      _yukle();
    });
  }

  @override
  void dispose() {
    _zamanlayici?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _nabiz.dispose();
    _flas.dispose();
    super.dispose();
  }

  Future<void> _yukle() async {
    try {
      final res = await api.live(widget.no);
      if (!mounted) return;
      setState(() {
        _error = null;
        _d = res as Map?;
        _loading = false;
      });
      _animasyonlariGuncelle();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  /// CANLI rozeti nabız + skor değişince kısa flash.
  void _animasyonlariGuncelle() {
    final anim = getPref('liveAnim');
    final st = _d != null ? deriveStatus(_d!.cast<String, dynamic>()) : null;

    if (st == MacDurum.live && anim != 'off') {
      if (!_nabiz.isAnimating) _nabiz.repeat(reverse: true);
    } else {
      _nabiz
        ..stop()
        ..value = 1;
    }

    final skor = _d?['score'] as Map?;
    final simdi = skor != null ? '${skor['home']}-${skor['away']}' : null;
    if (_oncekiSkor != null &&
        simdi != null &&
        simdi != _oncekiSkor &&
        anim != 'off') {
      _flas
        ..value = 1
        ..reverse(from: 1);
    }
    _oncekiSkor = simdi;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _d == null) {
      return _sarmal(
        const Expanded(
          child: Center(
            child: SizedBox(
              width: 44,
              height: 44,
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          ),
        ),
      );
    }

    if (_error != null) {
      return _sarmal(
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(40),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('⚠️', style: TextStyle(fontSize: 40)),
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text(
                      'Canlı veri alınamadı.',
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 16,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: GestureDetector(
                      onTap: _yukle,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 11,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text(
                          'Tekrar Dene',
                          style: TextStyle(
                            color: AppColors.white,
                            fontWeight: AppFont.heavy,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final d = _d!;
    final st = deriveStatus(d.cast<String, dynamic>());
    final minute = d['minute'];
    final statusText = switch (st) {
      MacDurum.live => 'CANLI${minute != null ? " $minute'" : ''}',
      MacDurum.finished => 'Maç Sonu',
      MacDurum.awaiting => 'Sonuç bekleniyor',
      MacDurum.suspended => 'Maç durdu',
      MacDurum.postponed => 'Ertelendi',
      MacDurum.cancelled => 'İptal',
      MacDurum.notStarted => 'Başlamadı',
    };
    final actual = resultFromScore(d['score'] as Map?);
    final pred = d['prediction'] as Map?;
    final sysSym = (pred != null && pred['symbol'] != '-')
        ? pred['symbol'] as String?
        : null;
    final scored = st == MacDurum.live || st == MacDurum.finished;
    final skor = d['score'] as Map?;

    final myPicks = _kuponlarim(d, actual);
    final rankedPick = myPicks.where((p) => p.ranked).firstOrNull;
    // "Kupon riskte": CANLI maçta dereceli kuponun seçimi şu an tutmuyor.
    final bool? couponAtRisk = st == MacDurum.live && rankedPick != null
        ? rankedPick.hit == false
        : null;
    final pressure = pressureIndex(d['stats'] as List?);
    final statRows = sortStats(d['stats'] as List?);
    final goals = goalProgression(d['events'] as List?);

    return _sarmal(
      Expanded(
        child: Column(
          children: [
            // skor başlığı
            AnimatedBuilder(
              animation: _flas,
              builder: (_, child) => Container(
                color: Color.lerp(
                  const Color(0x00000000),
                  AppColors.accentSoft,
                  _flas.value,
                ),
                child: child,
              ),
              child: Padding(
                padding: const EdgeInsets.all(Spacing.md),
                child: Row(
                  children: [
                    Expanded(child: _takim('${d['home'] ?? ''}')),
                    const SizedBox(width: 8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(minWidth: 96),
                      child: Column(
                        children: [
                          Text(
                            skor != null
                                ? '${skor['home']} - ${skor['away']}'
                                : '–',
                            style: const TextStyle(
                              color: AppColors.text,
                              fontSize: 24,
                              fontWeight: AppFont.black,
                              letterSpacing: 1,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: FadeTransition(
                              opacity: st == MacDurum.live
                                  ? _nabiz
                                  : const AlwaysStoppedAnimation(1),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceSoft,
                                  borderRadius: BorderRadius.circular(
                                    AppRadius.pill,
                                  ),
                                ),
                                child: Text(
                                  statusText,
                                  style: TextStyle(
                                    color: st == MacDurum.live
                                        ? AppColors.accent
                                        : AppColors.textSoft,
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
                    const SizedBox(width: 8),
                    Expanded(
                      child: _takim('${d['away'] ?? ''}', hiza: TextAlign.end),
                    ),
                  ],
                ),
              ),
            ),

            // sekmeler
            Container(
              decoration: const BoxDecoration(
                color: AppColors.card,
                border: Border(
                  top: BorderSide(color: AppColors.border),
                  bottom: BorderSide(color: AppColors.border),
                ),
              ),
              child: Row(
                children: [
                  for (final t in _kTabs)
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => _tab = t),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(
                                width: 2,
                                color: _tab == t
                                    ? AppColors.accent
                                    : Colors.transparent,
                              ),
                            ),
                          ),
                          child: Text(
                            t,
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: _tab == t
                                  ? AppColors.text
                                  : AppColors.textMuted,
                              fontSize: 12,
                              fontWeight: AppFont.heavy,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(
                  left: Spacing.md,
                  right: Spacing.md,
                  top: Spacing.md,
                  bottom: Spacing.xl,
                ),
                children: [
                  // OLAY ŞERİDİ — her sekmede görünür.
                  LiveTimeline(
                    events: d['events'] as List?,
                    minute: st == MacDurum.live ? minute : null,
                    homeName: '${d['home'] ?? ''}',
                    awayName: '${d['away'] ?? ''}',
                  ),

                  if (_tab == 'İstatistik')
                    ..._istatistik(d, pressure, statRows)
                  else if (_tab == 'Olaylar')
                    ..._olaylar(d, goals)
                  else if (_tab == 'Kupon/Sistem')
                    ..._kuponSistem(
                      d,
                      myPicks: myPicks,
                      rankedPick: rankedPick,
                      couponAtRisk: couponAtRisk,
                      sysSym: sysSym,
                      actual: actual,
                      scored: scored,
                      st: st,
                    )
                  else
                    ..._ozet(d, statusText, sysSym, st),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ——— sekmeler ———

  List<Widget> _istatistik(Map d, Pressure? pressure, List<Map> statRows) {
    if ((d['stats'] as List?)?.isNotEmpty != true) {
      return const [_Bos('Canlı istatistik bilgisi henüz yok.')];
    }
    return [
      // BASKI GÖSTERGESİ — yalnız gerçek istatistiklerden; tahmin değil.
      if (pressure != null)
        Container(
          margin: const EdgeInsets.only(bottom: Spacing.md),
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '%${pressure.home}',
                        style: const TextStyle(
                          color: AppColors.info,
                          fontSize: 15,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    ),
                    const Text(
                      'BASKI GÖSTERGESİ',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 9.5,
                        fontWeight: AppFont.black,
                        letterSpacing: 1,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        '%${pressure.away}',
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: AppColors.accent,
                          fontSize: 15,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              ClipRRect(
                borderRadius: BorderRadius.circular(5),
                child: SizedBox(
                  height: 10,
                  child: Row(
                    children: [
                      Expanded(
                        flex: pressure.home == 0 ? 1 : pressure.home,
                        child: Container(color: AppColors.info),
                      ),
                      Expanded(
                        flex: pressure.away == 0 ? 1 : pressure.away,
                        child: Container(color: AppColors.accent),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '${pressure.basis.join(' · ')} verilerinin payı. '
                  'Sonuç tahmini değildir.',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 10,
                    fontStyle: FontStyle.italic,
                    height: 14 / 10,
                  ),
                ),
              ),
            ],
          ),
        ),

      Padding(
        padding: const EdgeInsets.only(bottom: Spacing.md),
        child: Row(
          children: [
            for (final v in const ['table', 'graph']) ...[
              GestureDetector(
                onTap: () {
                  setPref('liveStatView', v);
                  setState(() => _statView = v);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: _statView == v
                        ? AppColors.primary
                        : AppColors.cardAlt,
                    borderRadius: AppRadius.smR,
                  ),
                  child: Text(
                    v == 'table' ? 'Tablo' : 'Grafik',
                    style: TextStyle(
                      color: _statView == v
                          ? AppColors.white
                          : AppColors.textSoft,
                      fontSize: 12,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ),
              ),
              if (v == 'table') const SizedBox(width: 6),
            ],
          ],
        ),
      ),

      for (final row in statRows)
        _statView == 'table'
            ? _StatTablo(
                label: _statLabel(row['type']),
                home: row['home'],
                away: row['away'],
              )
            : _StatGrafik(
                label: _statLabel(row['type']),
                home: row['home'],
                away: row['away'],
              ),
    ];
  }

  List<Widget> _olaylar(Map d, List<GoalStep> goals) {
    final events = (d['events'] as List?) ?? const [];
    if (events.isEmpty) {
      return const [_Bos('Canlı olay bilgisi henüz yok.')];
    }
    return [
      // GOL AKIŞI — her golden sonraki koşan skor.
      if (goals.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: Spacing.md),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final g in goals)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSoft,
                    borderRadius: AppRadius.smR,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        "${g.minute}${g.extra > 0 ? '+${g.extra}' : ''}'",
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10.5,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${g.home}-${g.away}',
                        style: const TextStyle(
                          color: AppColors.text,
                          fontSize: 12.5,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      if (g.penalty) ...[
                        const SizedBox(width: 5),
                        const _GolEtiketi('P'),
                      ],
                      if (g.ownGoal) ...[
                        const SizedBox(width: 5),
                        const _GolEtiketi('KK'),
                      ],
                    ],
                  ),
                ),
            ],
          ),
        ),
      for (final e in events.cast<Map>())
        Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 42,
                child: Text(
                  e['minute'] != null
                      ? "${e['minute']}${e['extra'] != null ? '+${e['extra']}' : ''}'"
                      : '',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(_eventIcon(e), style: const TextStyle(fontSize: 16)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_eventLabel(e)}'
                      '${e['side'] != null ? ' · ${e['side'] == 'home' ? d['home'] : d['away']}' : (e['team'] != null ? ' · ${e['team']}' : '')}',
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 13,
                        fontWeight: AppFont.bold,
                      ),
                    ),
                    if (e['player'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Text(
                          '${e['player']}'
                          '${e['assist'] != null ? ' (asist: ${e['assist']})' : ''}',
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11.5,
                            fontWeight: AppFont.semibold,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
    ];
  }

  List<Widget> _kuponSistem(
    Map d, {
    required List<_MyPick> myPicks,
    required _MyPick? rankedPick,
    required bool? couponAtRisk,
    required String? sysSym,
    required String? actual,
    required bool scored,
    required MacDurum st,
  }) {
    final skor = d['score'] as Map?;
    return [
      // SENİN KUPONUN — bu haftanın GERÇEK kayıtlı kuponlarındaki seçim.
      // Kupon yoksa dürüstçe "kupon yok" der; sahte seçim gösterilmez.
      _Kart(
        baslik: 'Senin Kuponun',
        children: [
          if (myPicks.isEmpty) ...[
            const Text(
              'Kupon yok',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 15,
                fontWeight: AppFont.black,
              ),
            ),
            const _Not(
              'Bu bülten için bu maça yapılmış kayıtlı seçimin yok.',
            ),
            if (d['roundId'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: GestureDetector(
                    onTap: () => GoRouter.of(
                      context,
                    ).go('/bulten/kupon-editor/${d['roundId']}'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: AppRadius.smR,
                      ),
                      child: const Text(
                        'Kupon Oluştur',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 12.5,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ] else
            for (final p in myPicks)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 7),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: 'Kupon ${p.couponNo}'),
                            if (p.ranked)
                              const TextSpan(
                                text: '  ⭐ dereceli',
                                style: TextStyle(
                                  color: AppColors.warning,
                                  fontSize: 10.5,
                                  fontWeight: AppFont.black,
                                ),
                              ),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.text,
                          fontSize: 12.5,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      p.label,
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 15,
                        fontWeight: AppFont.black,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 70,
                      child: Text(
                        (!scored || p.hit == null)
                            ? '⏳'
                            : p.hit!
                            ? (st == MacDurum.finished ? '✅ doğru' : '✅ anlık')
                            : (st == MacDurum.finished
                                  ? '❌ yanlış'
                                  : '❌ anlık'),
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: AppFont.heavy,
                          color: (!scored || p.hit == null)
                              ? AppColors.textMuted
                              : p.hit!
                              ? AppColors.success
                              : AppColors.danger,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          if (myPicks.isNotEmpty && st != MacDurum.finished)
            const _Not(
              'Anlık işaretler geçicidir — kesin sonuç yalnız resmî Spor Toto '
              'sonucuyla belirlenir.',
            ),
        ],
      ),

      _Kart(
        baslik: 'Sistem Tahmini',
        children: [
          Row(
            children: [
              Text(
                sysSym ?? '—',
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 22,
                  fontWeight: AppFont.black,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                sysSym == null
                    ? ''
                    : !scored
                    ? '⏳ bekliyor'
                    : pickHits(sysSym, actual) == true
                    ? (st == MacDurum.finished
                          ? '✅ doğru (kesin)'
                          : '✅ anlık doğru')
                    : (st == MacDurum.finished
                          ? '❌ yanlış (kesin)'
                          : '❌ anlık yanlış'),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: AppFont.heavy,
                  color: (!scored || sysSym == null)
                      ? AppColors.textMuted
                      : pickHits(sysSym, actual) == true
                      ? AppColors.success
                      : AppColors.danger,
                ),
              ),
            ],
          ),
          _Not(
            'Anlık skor: ${skor != null ? '${skor['home']} - ${skor['away']}' : '–'}',
          ),
        ],
      ),

      _Kart(
        baslik: 'Risk',
        vurgulu: true,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'Kupon Riskte: '),
                  if (rankedPick != null)
                    TextSpan(
                      text: couponAtRisk == true ? 'EVET (anlık)' : 'hayır',
                      style: TextStyle(
                        fontWeight: AppFont.black,
                        color: couponAtRisk == true
                            ? AppColors.danger
                            : AppColors.success,
                      ),
                    )
                  else ...[
                    const TextSpan(
                      text: '—',
                      style: TextStyle(fontWeight: AppFont.black),
                    ),
                    const TextSpan(text: ' (kupon yok)'),
                  ],
                ],
              ),
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.bold,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'Sistem Riskte: '),
                  TextSpan(
                    text:
                        st == MacDurum.live &&
                            pickHits(sysSym, actual) == false
                        ? 'EVET (anlık)'
                        : 'hayır',
                    style: TextStyle(
                      fontWeight: AppFont.black,
                      color:
                          st == MacDurum.live &&
                              pickHits(sysSym, actual) == false
                          ? AppColors.danger
                          : AppColors.success,
                    ),
                  ),
                ],
              ),
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.bold,
              ),
            ),
          ),
          if (st == MacDurum.suspended ||
              st == MacDurum.cancelled ||
              st == MacDurum.postponed)
            const _Not(
              'Resmi karar bekleniyor — kupon/sistem sonucu kesinleşmedi.',
            ),
        ],
      ),
    ];
  }

  List<Widget> _ozet(Map d, String statusText, String? sysSym, MacDurum st) {
    final skor = d['score'] as Map?;
    return [
      _OzetSatiri('Durum', statusText),
      _OzetSatiri(
        'Skor',
        skor != null ? '${skor['home']} - ${skor['away']}' : '–',
      ),
      if (d['minute'] != null && st == MacDurum.live)
        _OzetSatiri('Dakika', "${d['minute']}'"),
      _OzetSatiri('Sistem tahmini', sysSym ?? '—'),
      _OzetSatiri(
        'Canlı veri',
        d['hasLiveData'] == true
            ? 'Gerçek zamanlı veri'
            : 'Şu an canlı ayrıntı yok',
      ),
      if (st == MacDurum.awaiting)
        const _Not(
          'Resmi sonuç bekleniyor. Sonuç kesinleşmeden kupon/sistem sonucu '
          'hesaplanmaz.',
        ),
      if (st == MacDurum.suspended)
        const _Not('Maç yarıda kaldı / durduruldu. Resmi karar bekleniyor.'),
    ];
  }

  /// KULLANICININ GERÇEK KUPONLARI — bu haftanın kayıtlı kuponlarında bu maça
  /// yapılmış seçim. Kupon yoksa liste boş kalır (uydurma kupon gösterilmez).
  List<_MyPick> _kuponlarim(Map d, String? actual) {
    if (d['roundId'] == null) return const [];
    final out = <_MyPick>[];
    for (final c in getWeekCoupons(d['roundId'])) {
      final v = finalVersion(c);
      final sels = (v?['selections'] as List?) ?? const [];
      final sel = sels.cast<Map?>().firstWhere(
        (s) => s != null && num.tryParse('${s['no']}') == num.tryParse('${d['no']}'),
        orElse: () => null,
      );
      final outcomes = (sel?['selectedOutcomes'] as List?) ?? const [];
      if (outcomes.isEmpty) continue;
      out.add((
        id: c['id'],
        couponNo: c['couponNo'],
        ranked: c['isRankedCoupon'] == true,
        outcomes: outcomes,
        label: outcomes.join('-'),
        hit: actual != null ? outcomes.contains(actual) : null,
      ));
    }
    return out;
  }

  // ——— kabuk ———

  Widget _sarmal(Widget child) => Scaffold(
    backgroundColor: AppColors.bg,
    body: SafeArea(
      bottom: false,
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).maybePop(),
              child: const Padding(
                padding: EdgeInsets.only(
                  left: Spacing.md,
                  right: Spacing.md,
                  top: Spacing.md,
                  bottom: 6,
                ),
                child: Text(
                  '‹ Canlı Bülten',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 13,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    ),
  );

  static Widget _takim(String ad, {TextAlign hiza = TextAlign.start}) => Text(
    ad,
    maxLines: 1,
    overflow: TextOverflow.ellipsis,
    textAlign: hiza,
    style: const TextStyle(
      color: AppColors.text,
      fontSize: 14,
      fontWeight: AppFont.heavy,
    ),
  );
}

class _StatTablo extends StatelessWidget {
  const _StatTablo({required this.label, this.home, this.away});

  final String label;
  final Object? home;
  final Object? away;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 9),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      children: [
        SizedBox(width: 58, child: _deger(home)),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textSoft,
              fontSize: 12.5,
              fontWeight: AppFont.semibold,
            ),
          ),
        ),
        SizedBox(width: 58, child: _deger(away, hiza: TextAlign.right)),
      ],
    ),
  );

  static Widget _deger(Object? v, {TextAlign hiza = TextAlign.start}) => Text(
    v == null ? '–' : '$v',
    textAlign: hiza,
    style: const TextStyle(
      color: AppColors.text,
      fontSize: 14,
      fontWeight: AppFont.heavy,
    ),
  );
}

class _StatGrafik extends StatelessWidget {
  const _StatGrafik({required this.label, this.home, this.away});

  final String label;
  final Object? home;
  final Object? away;

  @override
  Widget build(BuildContext context) {
    final h = _numOf(home);
    final a = _numOf(away);
    final tot = (h + a) == 0 ? 1.0 : h + a;
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 5),
            child: Row(
              children: [
                SizedBox(width: 58, child: _StatTablo._deger(home)),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.textSoft,
                      fontSize: 12.5,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ),
                SizedBox(
                  width: 58,
                  child: _StatTablo._deger(away, hiza: TextAlign.right),
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: SizedBox(
              height: 7,
              child: Row(
                children: [
                  Expanded(
                    flex: (h / tot * 1000).round().clamp(0, 1000),
                    child: Container(color: AppColors.info),
                  ),
                  Expanded(
                    flex: (a / tot * 1000).round().clamp(0, 1000),
                    child: Container(color: AppColors.accent),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OzetSatiri extends StatelessWidget {
  const _OzetSatiri(this.k, this.v);

  final String k;
  final String v;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 10),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          k,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 13,
            fontWeight: AppFont.bold,
          ),
        ),
        Text(
          v,
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 13,
            fontWeight: AppFont.black,
          ),
        ),
      ],
    ),
  );
}

class _Kart extends StatelessWidget {
  const _Kart({
    required this.baslik,
    required this.children,
    this.vurgulu = false,
  });

  final String baslik;
  final List<Widget> children;
  final bool vurgulu;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.sm),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: vurgulu ? AppColors.warningSoft : AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(
        color: vurgulu ? AppColors.warning : AppColors.border,
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            baslik,
            style: const TextStyle(
              color: AppColors.textSoft,
              fontSize: 12,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        ...children,
      ],
    ),
  );
}

class _Not extends StatelessWidget {
  const _Not(this.t);

  final String t;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text(
      t,
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 11.5,
        fontWeight: AppFont.semibold,
        height: 16 / 11.5,
      ),
    ),
  );
}

class _Bos extends StatelessWidget {
  const _Bos(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(30),
    child: Text(
      text,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 13,
        fontWeight: AppFont.semibold,
      ),
    ),
  );
}

class _GolEtiketi extends StatelessWidget {
  const _GolEtiketi(this.t);

  final String t;

  @override
  Widget build(BuildContext context) => Text(
    t,
    style: const TextStyle(
      color: AppColors.accent,
      fontSize: 9,
      fontWeight: AppFont.black,
    ),
  );
}
