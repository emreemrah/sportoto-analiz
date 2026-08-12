// KAYNAK: app/src/screens/SystemScorecardScreen.js — BİREBİR çeviri.
//
// SİSTEM MASTER ANALİZ KARNESİ — yalnız DOĞRULANMIŞ resmî ileri-test verisi.
// * Ana kart: TEKLİ ana tahmin (1/X/2) isabeti — kapalı tercihler (1X/X2/12/1X2)
//   ana başarıya GİRMEZ; onlar AYRI "Kapsama Başarısı" bölümündedir.
// * YENİ BAŞLANGIÇ: eski/backfill/retrospektif kayıtlar KULLANICIYA HİÇBİR
//   ekranda gösterilmez (Retrospektif sekmesi kaldırıldı); teknikte yalnız
//   "resmî başarıdan ayrılmıştır" notu vardır. Karneler sıfırdan başlar.
// * Resmî veri yoksa dürüst boş durum gösterilir — sahte yüzde üretilmez.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/calibration_logic.dart';
import '../../core/network/api_client.dart';
import '../../core/scorecard_logic.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/dashboard_ui.dart';
import '../../widgets/states.dart';

// SEKMELER: yalnız resmî bölümler — Retrospektif sekmesi KULLANICIYA YOKTUR.
// Eski %69/%64/%73 tarzı legacy başarılar bu ekranın hiçbir yerinde görünmez.
const List<({String key, String label})> _sections = kUserSections;

Color _rateColor(num r) => r >= 60
    ? AppColors.success
    : (r >= 45 ? AppColors.warning : AppColors.danger);

String _fmtT(Object? iso) {
  if (iso == null || '$iso'.isEmpty) return '—';
  final d = matchDate('$iso');
  return '${d.day} ${d.time}';
}

num _n(Object? v) => v is num ? v : 0;

class SystemScorecardScreen extends StatefulWidget {
  const SystemScorecardScreen({super.key});

  @override
  State<SystemScorecardScreen> createState() => _SystemScorecardScreenState();
}

class _SystemScorecardScreenState extends State<SystemScorecardScreen> {
  /// sistem (resmî + kapsama + provenance)
  Map<String, dynamic>? _sc;

  /// resmî radar karnesi
  Map<String, dynamic>? _radar;

  /// kalibrasyon (olasılık kalitesi)
  Map<String, dynamic>? _cal;

  String? _error;
  bool _loading = true;

  /// sade özet varsayılan (2026-08-06)
  String _section = 'ozet';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final s = await api.scorecardsSystem();
      if (!mounted) return;
      setState(() => _sc = (s as Map).cast<String, dynamic>());

      // Yan karneler AYRI AYRI — biri düşerse diğerleri görünmeye devam eder.
      // (Retrospektif uç ÇAĞRILMAZ — legacy başarılar kullanıcıya gösterilmez.)
      api
          .scorecardsRadar()
          .then((r) {
            if (mounted) {
              setState(() => _radar = (r as Map).cast<String, dynamic>());
            }
          })
          .catchError((_) {});
      api
          .scorecardsCalibration()
          .then((c) {
            if (mounted) {
              setState(() => _cal = (c as Map).cast<String, dynamic>());
            }
          })
          .catchError((_) {});
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _sc == null) {
      return _kabuk(LoadingState(message: 'Sistem karnesi doğrulanıyor…'));
    }
    if (_error != null) {
      return _kabuk(
        SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: Spacing.lg),
          child: ErrorState(message: _error, onRetry: _load),
        ),
      );
    }

    final official = hasOfficialData(_sc);
    final head = officialHeadline(_sc);

    return _kabuk(
      ListView(
        padding: const EdgeInsets.fromLTRB(
          Spacing.lg,
          Spacing.lg,
          Spacing.lg,
          Spacing.xxxl,
        ),
        children: [
          DashboardHero(
            kicker: 'Analiz Merkezi · yalnız doğrulanmış ileri-test',
            title: 'Sistem Master Analiz Karnesi',
            subtitle: official
                ? '${head!.weeks} resmî hafta · ${head.total} resmî maç · tekli ana tahmin (1/X/2)'
                : 'Resmî ileri-test verisi bekleniyor',
            // Veri yoksa SAYI UYDURULMAZ — üç kutu da "—" gösterir.
            metrics: official
                ? [
                    (
                      value: '${head!.correct}',
                      label: 'Doğru',
                      tone: 'success',
                    ),
                    (value: '${head.wrong}', label: 'Yanlış', tone: 'danger'),
                    (
                      value: '%${head.accuracy}',
                      label: 'Tekli İsabet',
                      tone: null,
                    ),
                  ]
                : const [
                    (value: '—', label: 'Doğru', tone: null),
                    (value: '—', label: 'Yanlış', tone: null),
                    (value: '—', label: 'İsabet', tone: null),
                  ],
          ),
          const SizedBox(height: Spacing.md),
          FilterBar(
            options: _sections,
            value: _section,
            onChange: (v) => setState(() => _section = v),
          ),
          ..._bolum(official, head),
        ],
      ),
    );
  }

  Widget _kabuk(Widget govde) => Scaffold(
    appBar: AppBar(title: const Text('Sistem Karnesi')),
    body: govde,
  );

  List<Widget> _bolum(bool official, OfficialHeadline? head) =>
      switch (_section) {
        'ozet' => _ozet(official, head),
        'official' => _resmiKarne(official, head),
        'weeks' => _haftaHafta(official),
        'byResult' => _sonucaGore(official),
        'coverage' => _kapsama(),
        'radar' => _radarKarnesi(),
        'calibration' => _kalibrasyon(),
        _ => const [],
      };

  /* ————————————————— 0) ÖZET ————————————————— */
  // Sıradan kullanıcı için sade Türkçe (2026-08-06). Sayılar birebir resmî
  // karneden gelir; burada YENİ hesap yapılmaz.
  List<Widget> _ozet(bool official, OfficialHeadline? head) {
    if (!official) return [_bosDurum()];

    final weeks = (_sc?['weeks'] as List?) ?? const [];
    final tamamlanan = weeks.where((w) => (w as Map)['status'] != 'pending');
    final sonHafta = tamamlanan.isNotEmpty ? tamamlanan.last as Map : null;
    final yanlislar = ((_sc?['errors'] as List?) ?? const []).take(6).toList();

    return [
      _kart([
        RichText(
          text: TextSpan(
            style: TextStyle(
              color: AppColors.text,
              fontSize: 17,
              fontWeight: AppFont.heavy,
              height: 24 / 17,
            ),
            children: [
              const TextSpan(text: 'Sistem şimdiye kadar '),
              TextSpan(
                text: '${head!.total}',
                style: const TextStyle(fontWeight: AppFont.black),
              ),
              const TextSpan(text: ' tahminin '),
              TextSpan(
                text: '${head.correct}',
                style: const TextStyle(
                  color: AppColors.success,
                  fontWeight: AppFont.black,
                ),
              ),
              const TextSpan(text: "'ini bildi ("),
              TextSpan(
                text: '%${head.accuracy}',
                style: const TextStyle(fontWeight: AppFont.black),
              ),
              const TextSpan(text: ').'),
            ],
          ),
        ),
        if (sonHafta != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Son hafta (${sonHafta['round'] ?? '#${sonHafta['roundId']}'}): '
              '${weekRecordLabel(sonHafta)} doğru · %${sonHafta['accuracy']}',
              style: TextStyle(
                color: AppColors.textSoft,
                fontSize: 13,
                fontWeight: AppFont.semibold,
                height: 18 / 13,
              ),
            ),
          ),
        Padding(
          padding: EdgeInsets.only(top: 10),
          child: Text(
            'Buradaki her tahmin maç başlamadan önce kilitlenip mühürlenir — '
            'sonradan değiştirilemez. Sonuçlar yalnız resmî Spor Toto '
            'verisiyle karşılaştırılır. Yani bu sayılar şişirilemez; sistemin '
            'gerçek, kanıtlı isabetidir.',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
              height: 17 / 12,
            ),
          ),
        ),
      ]),
      if (yanlislar.isNotEmpty)
        _kart([
          Text(
            'Sistemin bilemedikleri (son ${yanlislar.length})',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 13.5,
              fontWeight: AppFont.black,
            ),
          ),
          for (final raw in yanlislar) _ozetYanlis(raw as Map),
          Padding(
            padding: EdgeInsets.only(top: 10),
            child: Text(
              'Yanlışları saklamıyoruz — dürüst ölçümün gereği bu.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                height: 17 / 12,
              ),
            ),
          ),
        ]),
      Padding(
        padding: EdgeInsets.only(top: 8),
        child: Text(
          'Daha fazla ayrıntı isteyen için üstteki sekmeler var: hafta hafta '
          'dökümler, 1/X/2 kırılımı ve teknik ölçümler. Geçmiş ölçümdür, '
          'gelecek sonuç vaadi değildir.',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 10.5,
            fontWeight: AppFont.semibold,
            height: 15 / 10.5,
          ),
        ),
      ),
    ];
  }

  Widget _ozetYanlis(Map e) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: RichText(
      text: TextSpan(
        style: TextStyle(
          color: AppColors.textSoft,
          fontSize: 13,
          fontWeight: AppFont.semibold,
          height: 18 / 13,
        ),
        children: [
          TextSpan(text: '${e['home']} - ${e['away']}: sistem '),
          TextSpan(
            // Veri anahtarı '0'dır; kullanıcıya 'X' gösterilir.
            text: '${e['system']}'.replaceAll('0', 'X'),
            style: const TextStyle(
              color: AppColors.danger,
              fontWeight: AppFont.black,
            ),
          ),
          const TextSpan(text: ' dedi, maç '),
          TextSpan(
            text: '${e['result']}',
            style: const TextStyle(
              color: AppColors.success,
              fontWeight: AppFont.black,
            ),
          ),
          TextSpan(
            text: ' bitti${e['score'] != null ? ' (${e['score']})' : ''}.',
          ),
        ],
      ),
    ),
  );

  /* ————————————————— 1) RESMÎ KARNE ————————————————— */
  List<Widget> _resmiKarne(bool official, OfficialHeadline? head) {
    if (!official) return [_bosDurum()];
    final last5 = head!.last5;
    final best = head.bestWeek;
    final pending = _sc?['pendingWeeks'];
    return [
      _kart([
        Text(
          head.title,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 13.5,
            fontWeight: AppFont.black,
          ),
        ),
        const SizedBox(height: 6),
        MetricBar(label: 'Tekli ana tahmin isabeti', value: _n(head.accuracy)),
        _satir(
          'Resmî ileri-test haftası',
          '${head.weeks}${(pending != null && pending != 0) ? ' (+$pending sonuç bekliyor)' : ''}',
        ),
        _satir('Toplam resmî maç', '${head.total}'),
        _satir('Tekli ana tahmin doğru', '${head.correct}'),
        _satir('Tekli ana tahmin yanlış', '${head.wrong}'),
        _satir(
          'Son 5 hafta',
          (last5 != null && _n(last5['total']) > 0)
              ? '${last5['correct']}/${last5['total']} · %${last5['accuracy']}'
              : '—',
        ),
        _satir(
          'En iyi resmî hafta',
          best != null
              ? '${best['round'] ?? best['roundId']} · ${best['record']} (%${best['accuracy']})'
              : '—',
        ),
        _satir(
          'Metodoloji',
          head.methodologyVersions.isNotEmpty
              ? head.methodologyVersions.join(', ')
              : '—',
          son: true,
        ),
      ]),
      if (_sc?['note'] != null) _durustNot('${_sc!['note']}'),
    ];
  }

  /* ————————————————— 2) HAFTA HAFTA ————————————————— */
  List<Widget> _haftaHafta(bool official) {
    final weeks = (_sc?['weeks'] as List?) ?? const [];
    if (!official || weeks.isEmpty) {
      return [_bosSatir('Resmî hafta kaydı yok.')];
    }
    return [
      DashboardSection(
        title: 'Resmî Hafta Performansı',
        sub:
            'Yalnız mühürlü ileri-test haftaları. Kısmi haftalar açıkça '
            'işaretlenir; sonuçlanmamış hafta başarıya yazılmaz.',
      ),
      for (final raw in weeks) _haftaKarti(raw as Map),
    ];
  }

  Widget _haftaKarti(Map w) {
    final durum = '${w['status']}';
    final pending = durum == 'pending';
    final cov = (w['coverage'] as Map?) ?? const {};
    final (Color bg, Color fg) = switch (durum) {
      'complete' => (const Color(0x1F2EA05A), AppColors.success),
      'partial' => (const Color(0x24F0A028), AppColors.warning),
      _ => (AppColors.bgAlt, AppColors.textMuted),
    };

    return Container(
      margin: const EdgeInsets.only(top: Spacing.sm),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${w['round'] ?? '#${w['roundId']}'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 13,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  durum == 'complete'
                      ? 'tam'
                      : (durum == 'partial' ? 'kısmi' : 'sonuç bekleniyor'),
                  style: TextStyle(
                    color: fg,
                    fontSize: 10.5,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                pending ? '—' : '${weekRecordLabel(w)} · %${w['accuracy']}',
                style: TextStyle(
                  color: pending
                      ? AppColors.textMuted
                      : _rateColor(_n(w['accuracy'])),
                  fontSize: 12.5,
                  fontWeight: AppFont.black,
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Tahminli ${w['predicted']}/${w['matchCount']} · '
              'resmî sonuç ${w['resolved']}/${w['matchCount']} · '
              'kapsama ${cov['covered']}/${cov['total']}',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                fontWeight: AppFont.semibold,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Mühür ${_fmtT(w['snapshotAt'])} · donma ${_fmtT(w['freezeAt'])} · '
              '#${w['verificationHashShort'] ?? '—'} · ${w['methodologyVersion'] ?? '—'}',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                fontWeight: AppFont.semibold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /* ————————————————— 3) 1/X/2 ————————————————— */
  List<Widget> _sonucaGore(bool official) {
    final byResult = _sc?['byResult'];
    if (!official || byResult is! Map) {
      return [_bosSatir('Resmî 1/X/2 verisi yok.')];
    }
    final errors = (_sc?['errors'] as List?) ?? const [];
    final ev = (byResult['1'] as Map?) ?? const {};
    final ber = (byResult['X'] as Map?) ?? const {};
    final dep = (byResult['2'] as Map?) ?? const {};

    return [
      _kart([
        Text(
          'Resmî sonuca göre tekli isabet',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 13.5,
            fontWeight: AppFont.black,
          ),
        ),
        const SizedBox(height: 6),
        MetricBar(
          label: '1 · Ev sahibi (${ev['t']} maç)',
          value: _n(ev['rate']),
          color: AppColors.primary,
        ),
        MetricBar(
          label: 'X · Beraberlik (${ber['t']} maç)',
          value: _n(ber['rate']),
          color: AppColors.gray,
        ),
        MetricBar(
          label: '2 · Deplasman (${dep['t']} maç)',
          value: _n(dep['rate']),
          color: AppColors.warning,
        ),
        if (errors.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              'Sistemin yanlışları (${errors.length})',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 13.5,
                fontWeight: AppFont.black,
              ),
            ),
          ),
          for (final raw in errors.take(15)) _yanlisSatiri(raw as Map),
        ],
      ]),
    ];
  }

  Widget _yanlisSatiri(Map e) => Padding(
    padding: const EdgeInsets.only(top: 4),
    child: RichText(
      text: TextSpan(
        style: TextStyle(
          color: AppColors.textSoft,
          fontSize: 11.5,
          fontWeight: AppFont.semibold,
          height: 16 / 11.5,
        ),
        children: [
          TextSpan(
            text:
                '${e['round'] ?? e['roundId']} #${e['no']} · '
                '${e['home']} - ${e['away']} → sistem ',
          ),
          TextSpan(
            text: '${e['system']}',
            style: const TextStyle(
              color: AppColors.danger,
              fontWeight: AppFont.black,
            ),
          ),
          const TextSpan(text: ', sonuç '),
          TextSpan(
            text: '${e['result']}',
            style: const TextStyle(
              color: AppColors.success,
              fontWeight: AppFont.black,
            ),
          ),
          TextSpan(text: e['score'] != null ? ' (${e['score']})' : ''),
        ],
      ),
    ),
  );

  /* ————————————————— 4) KAPSAMA — ana başarı DEĞİL ————————————————— */
  List<Widget> _kapsama() {
    final cov = _sc?['coverage'];
    return [
      DashboardSection(
        title: 'Kapsama Başarısı',
        sub:
            'Mühürlü kupon tercihlerinin (tek/çift/üçlü) resmî sonucu kapsama '
            'oranı.',
      ),
      if (cov is Map && cov['hasData'] == true)
        _kart([
          MetricBar(
            label: 'Genel kapsama (${cov['total']} maç)',
            value: _n(cov['rate']),
          ),
          MetricBar(
            label: 'Tekli tercihler (${(cov['single'] as Map?)?['total']} maç)',
            value: _n((cov['single'] as Map?)?['rate']),
            color: AppColors.primary,
          ),
          MetricBar(
            label:
                'Çoklu tercihler 1X/X2/12/1X2 (${(cov['multi'] as Map?)?['total']} maç)',
            value: _n((cov['multi'] as Map?)?['rate']),
            color: AppColors.warning,
          ),
        ])
      else
        _bosSatir('Resmî kapsama verisi yok.'),
      const Padding(
        padding: EdgeInsets.only(top: 8),
        child: Text(
          kCoverageNote,
          style: TextStyle(
            color: AppColors.warning,
            fontSize: 11,
            fontWeight: AppFont.heavy,
            height: 15 / 11,
          ),
        ),
      ),
    ];
  }

  /* ————————————————— 5) RADAR KARNESİ (resmî) ————————————————— */
  List<Widget> _radarKarnesi() {
    final r = _radar;
    if (r == null || r['hasData'] != true) {
      return [
        _bosSatir(
          '${r?['note'] ?? 'Henüz resmî Radar ileri-test verisi yok. Gerçek bültenler mühürlenip sonuçlandıkça karne oluşacaktır.'}',
        ),
      ];
    }
    final master = (r['master'] as Map?) ?? const {};
    final allTime = (master['allTime'] as Map?) ?? const {};
    final main = (allTime['mainAccuracy'] as Map?) ?? const {};
    final strong = (allTime['strongCandidate'] as Map?) ?? const {};
    final surprise = (allTime['surpriseCandidate'] as Map?) ?? const {};

    return [
      _kart([
        Text(
          'Resmî Radar Karnesi (mühürlü ileri-test)',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 13.5,
            fontWeight: AppFont.black,
          ),
        ),
        const SizedBox(height: 6),
        MetricBar(
          label: 'Ana tahmin (${main['total']} maç)',
          value: _n(main['rate']),
        ),
        MetricBar(
          label: 'Güçlü aday (${strong['total']} maç)',
          value: _n(strong['rate']),
          color: AppColors.success,
        ),
        MetricBar(
          label: 'Sürpriz yakalama (${surprise['total']} maç)',
          value: _n(surprise['catchRate']),
          color: AppColors.danger,
        ),
        MetricBar(
          label: 'Kesin sürpriz yönü (${surprise['total']} maç)',
          value: _n(surprise['exactRate']),
          color: AppColors.warning,
        ),
        _satir(
          'Hafta / hariç tutulan',
          '${r['includedCount'] ?? r['roundsCounted']} / ${r['excludedCount'] ?? 0}',
        ),
        _satir(
          'Metodoloji',
          ((r['methodologyVersions'] as List?) ?? const []).isNotEmpty
              ? (r['methodologyVersions'] as List).join(', ')
              : '—',
          son: true,
        ),
        if (r['note'] != null) _durustNot('${r['note']}'),
      ]),
    ];
  }

  /* ————————————————— 7) KALİBRASYON ————————————————— */
  // "kaç tuttu" DEĞİL, söylenen olasılığın kalitesi. ANA RAKAM skill score'dur;
  // isabet oranı bilerek başlıkta değildir.
  List<Widget> _kalibrasyon() {
    final cal = _cal;
    if (!hasCalibrationData(cal)) {
      return [
        _bosSatir('${cal?['insufficientNote'] ?? kCalibrationEmptyMessage}'),
      ];
    }

    final h = calibrationHeadline(cal)!;
    final t = h.vsMarket;
    final notice = marketDerivedNotice(cal);
    final bagimsiz = independentTestText(cal);
    final egri = curveRows(cal);

    return [
      _kart([
        Text(
          'Kalibrasyon — söylediğimiz olasılık ne kadar doğruydu?',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 13.5,
            fontWeight: AppFont.black,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            h.marketMissing
                ? 'Piyasa referansı yok (oran bulunamadı)'
                : (t?.metin ?? '—'),
            style: TextStyle(
              color: switch (t?.tone) {
                'success' => AppColors.success,
                'danger' => AppColors.danger,
                _ => AppColors.textSoft,
              },
              fontSize: 18,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            '${h.n} maç · ${h.weeks} hafta'
            '${h.vsBaseline != null ? ' · lig taban oranına göre: ${h.vsBaseline!.metin.replaceAll('Piyasadan', '')}' : ''}',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 11.5,
              fontWeight: AppFont.bold,
            ),
          ),
        ),
        if (notice != null) _uyariKutusu(notice.title, notice.body),
        if (bagimsiz != null)
          _uyariKutusu('${bagimsiz.title} · ${bagimsiz.n} maç', bagimsiz.body),
        _altBaslik('Skorlar (düşük = iyi)'),
        for (final r in scoreRows(cal))
          _ikiliSatir(
            '${r.ad}${r.not != null ? ' · ${r.not}' : ''}',
            'log-loss ${r.logLoss ?? '—'} · Brier ${r.brier ?? '—'}'
                '${r.n != null ? ' · ${r.n}' : ''}',
          ),
        _altBaslik('Kalibrasyon'),
        if (egri.isNotEmpty)
          for (final b in egri)
            _ikiliSatir('${b['metin']}', '${b['durumMetni']}', ikiSatir: true)
        else
          _durustNot('${curveUnavailableText(cal)}'),
        // Beklenti ayarı — ZORUNLU.
        _durustNot(kExpectationNote),
        if (cal?['conventions'] != null)
          Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              'Ölçüm: Brier [0,2] · log-loss doğal logaritma · marj temizleme multiplicative',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 9.5,
                fontWeight: AppFont.semibold,
              ),
            ),
          ),
      ]),
    ];
  }

  /* ————————————————— ORTAK PARÇALAR ————————————————— */

  Widget _kart(List<Widget> children) => Container(
    margin: const EdgeInsets.only(top: Spacing.sm),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadow.soft,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    ),
  );

  Widget _satir(String k, String v, {bool son = false}) => Container(
    padding: const EdgeInsets.symmetric(vertical: 7),
    decoration: son
        ? null
        : BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          k,
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 12,
            fontWeight: AppFont.bold,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            v,
            maxLines: 2,
            textAlign: TextAlign.right,
            style: TextStyle(
              color: AppColors.text,
              fontSize: 12,
              fontWeight: AppFont.heavy,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _ikiliSatir(String sol, String sag, {bool ikiSatir = false}) =>
      Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                sol,
                maxLines: ikiSatir ? 2 : 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 12.5,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                sag,
                textAlign: TextAlign.right,
                style: TextStyle(
                  color: AppColors.textSoft,
                  fontSize: 11.5,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
          ],
        ),
      );

  Widget _altBaslik(String metin) => Padding(
    padding: const EdgeInsets.only(top: 12, bottom: 2),
    child: Text(
      metin,
      style: TextStyle(
        color: AppColors.text,
        fontSize: 12,
        fontWeight: AppFont.black,
      ),
    ),
  );

  Widget _uyariKutusu(String baslik, String govde) => Container(
    margin: const EdgeInsets.only(top: 10),
    padding: const EdgeInsets.all(Spacing.sm),
    decoration: BoxDecoration(
      color: AppColors.bgAlt,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          baslik,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 11.5,
            fontWeight: AppFont.black,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(
            govde,
            style: TextStyle(
              color: AppColors.textSoft,
              fontSize: 11,
              fontWeight: AppFont.semibold,
              height: 16 / 11,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _durustNot(String metin) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Text(
      metin,
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 10.5,
        fontWeight: AppFont.semibold,
        height: 15 / 10.5,
      ),
    ),
  );

  Widget _bosSatir(String metin) => _kart([
    Text(
      metin,
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 12.5,
        fontWeight: AppFont.bold,
        height: 18 / 12.5,
      ),
    ),
  ]);

  Widget _bosDurum() => DashboardEmpty(
    icon: Icons.lock_outline,
    title: kOfficialEmptyTitle,
    message: kOfficialEmptyMessage,
    actionLabel: 'Bültenleri Gör',
    onAction: () => context.go('/bulten'),
  );
}
