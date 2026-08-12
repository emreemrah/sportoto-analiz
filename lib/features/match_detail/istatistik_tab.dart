// KAYNAK: app/src/screens/MatchDetailScreen.js → "İstatistik" sekmesi.
//
// BU TURDA ÇEVRİLEN:
//   • KARNE — maç logundan filtreli gerçek istatistikler (Dönem × Saha)
//   • Maç log yoksa resmî sezon karnesine DÜRÜST geri düşüş (filtreler gizlenir)
//   • Sezon başı geri düşüşü: seçili kesitte yeterli maç yoksa "Son 15 (geçen
//     sezon dahil)" AÇIK ETİKETLE gösterilir — uydurma hesap yok
//   • Maç Başına Ortalamalar kartı
//   • Güç Karşılaştırması radarı (TeamCompareRadar)
//   • Karşılıklı maç geçmişi (H2H), Lig Tablosu, Kadrolar, Eksikler
//
// HER BÖLÜM KENDİ VERİSİ YOKSA HİÇ ÇİZİLMEZ — boş bir başlık açıp altını
// "veri yok" ile doldurmak yerine bölüm hiç görünmez. Tek istisna Eksikler
// sütunudur: orada "Bilinen eksik yok" yazar, çünkü bu "eksik yok" iddiası
// değil "bilgimiz yok" ifadesidir ve ikisi farklı şeylerdir.

import 'package:flutter/material.dart';

import '../../core/analysis/stats_from_log.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/tabs.dart';
import 'istatistik_gorsel.dart';
import 'istatistik_parcalari.dart';
import 'team_compare_radar.dart';

const List<(String etiket, String anahtar, List<(String, String)> secenekler)>
_fDims = [
  (
    'Dönem',
    'period',
    [
      ('season', 'Sezon'),
      ('last5', 'Son 5'),
      ('last10', 'Son 10'),
      ('last15', 'Son 15'),
    ],
  ),
  (
    'Saha',
    'venueScope',
    [
      ('overall', 'Genel'),
      ('home', 'İçeride'),
      ('away', 'Dışarıda'),
      ('split', 'İç/Dış'),
    ],
  ),
];

/// Maç başına ortalama kıyası — kaynaktaki `AVG_PICK` sırası korunur.
const List<(String kaynakAnahtar, String etiket)> _avgPick = [
  ('Maç Başı Gol', 'Gol'),
  ('Yediği Gol', 'Yediği Gol'),
  ('Toplam Şut', 'Şut'),
  ('Korner', 'Korner'),
  ('Kart', 'Kart'),
  ('Faul', 'Faul'),
];

String _fmtAvg(Object? v, String sfx) {
  final n = v is num ? v : num.tryParse('$v');
  if (n == null || !n.isFinite) return '$v$sfx';
  return '${n is int || n == n.roundToDouble() ? n.toInt() : n.toStringAsFixed(1)}$sfx';
}

class IstatistikTab extends StatefulWidget {
  const IstatistikTab({
    super.key,
    required this.m,
    required this.homeName,
    required this.awayName,
  });

  final Map<String, dynamic> m;
  final String homeName;
  final String awayName;

  @override
  State<IstatistikTab> createState() => _IstatistikTabState();
}

class _IstatistikTabState extends State<IstatistikTab> {
  // İstatistik karne filtresi — yalnız Dönem + Saha. (Rakip gücü filtresi
  // kullanıcı kararıyla panelden tamamen kaldırıldı; altın kural sınıflaması
  // analiz/radar tarafında yaşamaya devam eder.)
  StatFiltre _statF = const StatFiltre();

  /// Aynı anda TEK kadro açık — iki uzun tablo üst üste gelmesin.
  String? _openSquad;

  @override
  Widget build(BuildContext context) {
    final s = (widget.m['stats'] as Map?) ?? const {};
    final home = s['home'] as Map?;
    final away = s['away'] as Map?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── GÖRSEL ÖZET (kullanıcı isteği, 2026-08-11) ──
        // Önce bir bakışta okunan kartlar ve çubuklar; sayı tabloları ve uzun
        // listeler altta durmaya devam eder. İkisi de AYNI veriden beslenir —
        // görsel özet ayrı bir hesap yapmaz, `statsFromLog` ve sezon
        // ortalamaları neyse onu çizer.
        FormKartlari(kesitler: _formKesitleri(home, away)),
        KarsilastirmaCubuklari(
          home: home,
          away: away,
          homeName: widget.homeName,
          awayName: widget.awayName,
        ),
        _karne(s, home, away),
        // Güç karşılaştırması — 3'ten az ortak eksen varsa KENDİSİ gizlenir.
        TeamCompareRadar(
          home: home,
          away: away,
          homeName: widget.homeName,
          awayName: widget.awayName,
        ),
        _ortalamalar(),
        _h2h(s),
        _ligTablosu(s),
        _kadrolar(s),
        _eksikler(s),
      ],
    );
  }

  /// Form kartlarının kesitleri: her takımın son 5 maçı ve kendi sahasındaki
  /// son 5 maçı. Kesitin maçı yoksa kart HİÇ eklenmez — boş bir kart, veri
  /// varmış gibi bir izlenim bırakırdı.
  ///
  /// Kaynak `statsFromLog`: karne bölümüyle AYNI fonksiyon. Kartlar için ikinci
  /// bir hesap yazılmadı; iki yüzey aynı sayıyı farklı gösterirse hangisinin
  /// doğru olduğu bilinemez.
  List<FormKesiti> _formKesitleri(Map? home, Map? away) {
    const son5 = StatFiltre(period: 'last5');
    const son5Ic = StatFiltre(period: 'last5', venueScope: 'home');
    const son5Dis = StatFiltre(period: 'last5', venueScope: 'away');

    final hLogo = home?['logo'] as String?;
    final aLogo = away?['logo'] as String?;
    final liste = <FormKesiti>[];

    void ekle(String baslik, LogStats? v, String? logo, Color renk) {
      if (v == null || v.n == 0) return;
      liste.add(FormKesiti(baslik: baslik, veri: v, logo: logo, renk: renk));
    }

    ekle(
      '${widget.homeName} · Son 5 Maç',
      statsFromLog(home, son5, 'home'),
      hLogo,
      kEvRengi,
    );
    ekle(
      '${widget.awayName} · Son 5 Maç',
      statsFromLog(away, son5, 'away'),
      aLogo,
      kDepRengi,
    );
    ekle(
      '${widget.homeName} · Son 5 İç Saha',
      statsFromLog(home, son5Ic, 'home'),
      hLogo,
      kEvRengi,
    );
    ekle(
      '${widget.awayName} · Son 5 Deplasman',
      statsFromLog(away, son5Dis, 'away'),
      aLogo,
      kDepRengi,
    );
    return liste;
  }

  /// Karşılıklı maç geçmişi — veri yoksa bölüm HİÇ çizilmez.
  Widget _h2h(Map s) {
    final h2h = s['h2h'] as Map?;
    if (h2h == null) return const SizedBox.shrink();
    return SectionCard(
      title: '⚔️  Karşılıklı Maç Geçmişi',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          H2hCell(
            n: h2h['homeWins'],
            label: '${widget.homeName} galibiyeti',
            icon: '🔵',
            color: AppColors.primary,
          ),
          const SizedBox(width: 8),
          H2hCell(
            n: h2h['draws'],
            label: 'Beraberlik',
            icon: '🤝',
            color: AppColors.gray,
          ),
          const SizedBox(width: 8),
          H2hCell(
            n: h2h['awayWins'],
            label: '${widget.awayName} galibiyeti',
            icon: '🟠',
            color: AppColors.orange,
          ),
        ],
      ),
    );
  }

  Widget _ligTablosu(Map s) {
    final t = s['leagueTable'];
    final dolu = t is List
        ? t.isNotEmpty
        : (t is Map && ((t['overall'] as List?)?.isNotEmpty ?? false));
    if (!dolu) return const SizedBox.shrink();
    return Accordion(
      title: 'Lig Tablosu',
      icon: '📋',
      child: LeagueTableFull(
        table: t,
        homeId: ((s['home'] as Map?)?['standing'] as Map?)?['teamId'],
        awayId: ((s['away'] as Map?)?['standing'] as Map?)?['teamId'],
        homeLogo: (s['home'] as Map?)?['logo'] as String?,
        awayLogo: (s['away'] as Map?)?['logo'] as String?,
        league: widget.m['league'] as String?,
      ),
    );
  }

  Widget _kadrolar(Map s) {
    final hs = (s['home'] as Map?)?['squad'] as List?;
    final as_ = (s['away'] as Map?)?['squad'] as List?;
    if ((hs?.isEmpty ?? true) && (as_?.isEmpty ?? true)) {
      return const SizedBox.shrink();
    }
    return Accordion(
      title: 'Kadrolar',
      icon: '👥',
      child: Column(
        children: [
          SquadSection(
            title: widget.homeName,
            squad: hs,
            open: _openSquad == 'home',
            onToggle: () => setState(
              () => _openSquad = _openSquad == 'home' ? null : 'home',
            ),
          ),
          SquadSection(
            title: widget.awayName,
            squad: as_,
            open: _openSquad == 'away',
            onToggle: () => setState(
              () => _openSquad = _openSquad == 'away' ? null : 'away',
            ),
          ),
        ],
      ),
    );
  }

  Widget _eksikler(Map s) {
    final inj = s['injuries'] as Map?;
    final h = inj?['home'] as List?;
    final a = inj?['away'] as List?;
    if ((h?.isEmpty ?? true) && (a?.isEmpty ?? true)) {
      return const SizedBox.shrink();
    }
    return Accordion(
      title: 'Eksikler',
      icon: '🚑',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InjuryCol(title: widget.homeName, list: h),
          const SizedBox(width: 12),
          InjuryCol(title: widget.awayName, list: a),
        ],
      ),
    );
  }

  Widget _karne(Map s, Map? home, Map? away) {
    final hv = statsFromLog(home, _statF, 'home');
    final av = statsFromLog(away, _statF, 'away');
    final noLog = hv == null || av == null;

    // MAÇ LOGU YOKSA (eski cache): resmi sezon karnesine dürüstçe geri düş,
    // filtre çiplerini HİÇ gösterme — tıklanıp da değişmeyen filtre kafa
    // karışıklığıdır.
    if (noLog) return _logsuzKarne(s, home, away);

    final tooFew = (hv.n) < 2 || (av.n) < 2;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CmpHead(s: s, homeName: widget.homeName, awayName: widget.awayName),
          const _CmpTitle('Karne'),
          for (final (etiket, anahtar, secenekler) in _fDims)
            _filtreSatiri(etiket, anahtar, secenekler),
          if (tooFew)
            ..._sezonBasiGeriDusus(home, away, hv, av)
          else
            ..._karneSatirlari(hv, av),
          if (_statF.venueScope == 'split')
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'İç/Dış: ${widget.homeName} içerideki, ${widget.awayName} '
                'dışarıdaki maçları.',
                style: _fltHint,
              ),
            ),
        ],
      ),
    );
  }

  /// SEZON BAŞI GERİ DÜŞÜŞÜ: seçili kesitte yeterli maç yoksa ve "Sezon"
  /// seçiliyken Son 15 (geçen sezon dahil) yeterliyse, ölü alan yerine o kesit
  /// AÇIK ETİKETLE gösterilir. Uydurma hesap yok: veriler yine gerçek maç
  /// logundan gelir, kaynağı yazılıdır.
  List<Widget> _sezonBasiGeriDusus(
    Map? home,
    Map? away,
    LogStats hv,
    LogStats av,
  ) {
    final fbF = _statF.copyWith(period: 'last15');
    final fh = _statF.period == 'season'
        ? statsFromLog(home, fbF, 'home')
        : null;
    final fa = _statF.period == 'season'
        ? statsFromLog(away, fbF, 'away')
        : null;
    final fbOk = fh != null && fa != null && fh.n >= 2 && fa.n >= 2;

    if (!fbOk) {
      return [
        Text(
          'Bu kesit için yeterli maç yok (${widget.homeName} ${hv.n} · '
          '${widget.awayName} ${av.n} maç) — karne gösterilmez, uydurma hesap '
          'yapılmaz.',
          style: _muted,
        ),
      ];
    }

    return [
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: RichText(
          text: TextSpan(
            style: _fltHint,
            children: [
              TextSpan(
                text:
                    'Sezon henüz başladı (${widget.homeName} ${hv.n} · '
                    '${widget.awayName} ${av.n} maç) — aşağıda ',
              ),
              const TextSpan(
                text: 'Son 15 maç (geçen sezon dahil)',
                style: TextStyle(fontWeight: AppFont.black),
              ),
              const TextSpan(text: ' gösteriliyor.'),
            ],
          ),
        ),
      ),
      ..._karneSatirlari(fh, fa),
    ];
  }

  List<Widget> _karneSatirlari(LogStats h, LogStats a) => [
    _CmpRow(label: 'Maç', home: '${h.n}', away: '${a.n}'),
    _CmpRow(
      label: 'G-B-M',
      left: RecordBadges(wins: h.w, draws: h.d, losses: h.l, played: h.n),
      right: RecordBadges(
        wins: a.w,
        draws: a.d,
        losses: a.l,
        played: a.n,
        alignRight: true,
      ),
    ),
    _CmpRow(label: 'Puan / Maç', home: '${h.ppg}', away: '${a.ppg}'),
    _CmpRow(label: 'Gol', home: '${h.gfPg}', away: '${a.gfPg}'),
    _CmpRow(label: 'Yediği Gol', home: '${h.gaPg}', away: '${a.gaPg}'),
    _CmpRow(label: 'Temiz Kale', home: '%${h.csPct}', away: '%${a.csPct}'),
    _CmpRow(label: 'Gol Atamadı', home: '%${h.ftsPct}', away: '%${a.ftsPct}'),
    _CmpRow(label: 'KG Var', home: '%${h.bttsPct}', away: '%${a.bttsPct}'),
    _CmpRow(
      label: '2.5 Üst',
      home: '%${h.overPct}',
      away: '%${a.overPct}',
      last: true,
    ),
  ];

  Widget _logsuzKarne(Map s, Map? home, Map? away) {
    final hstd = home?['standing'] as Map?;
    final astd = away?['standing'] as Map?;

    String pp(Map? t) {
      final played = t?['played'];
      final points = t?['points'];
      if (played is! num || played <= 0 || points is! num) return '—';
      return '${((points / played) * 100).round() / 100}';
    }

    String num_(Object? x) => x == null ? '—' : '$x';

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CmpHead(s: s, homeName: widget.homeName, awayName: widget.awayName),
          const _CmpTitle('Karne'),
          if (hstd != null || astd != null) ...[
            _CmpRow(
              label: 'Maç',
              home: num_(hstd?['played']),
              away: num_(astd?['played']),
            ),
            _CmpRow(
              label: 'G-B-M',
              left: hstd == null
                  ? Text('—', style: _clVal)
                  : RecordBadges(
                      wins: _i(hstd['wins']),
                      draws: _i(hstd['draws']),
                      losses: _i(hstd['losses']),
                      played: _i(hstd['played']),
                    ),
              right: astd == null
                  ? Text('—', style: _clVal)
                  : RecordBadges(
                      wins: _i(astd['wins']),
                      draws: _i(astd['draws']),
                      losses: _i(astd['losses']),
                      played: _i(astd['played']),
                      alignRight: true,
                    ),
            ),
            _CmpRow(
              label: 'Puan / Maç',
              home: pp(hstd),
              away: pp(astd),
              last: true,
            ),
          ] else
            Text('Bu maç için karne verisi bulunamadı.', style: _muted),
          Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              'Filtreler bu maçta henüz kullanılamıyor — maç logu bir sonraki '
              'bülten tazelemesinde oluşur. Yukarıdaki değerler resmi sezon '
              'karnesidir; uydurma hesap yapılmaz.',
              style: _fltHint,
            ),
          ),
        ],
      ),
    );
  }

  Widget _filtreSatiri(
    String etiket,
    String anahtar,
    List<(String, String)> secenekler,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Wrap(
      spacing: 6,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SizedBox(
          width: 60,
          child: Text(
            etiket,
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 11,
              fontWeight: AppFont.heavy,
            ),
          ),
        ),
        for (final (k, l) in secenekler)
          _filtreDugmesi(
            l,
            acik: anahtar == 'period'
                ? _statF.period == k
                : _statF.venueScope == k,
            onTap: () => setState(() {
              _statF = anahtar == 'period'
                  ? _statF.copyWith(period: k)
                  : _statF.copyWith(venueScope: k);
            }),
          ),
      ],
    ),
  );

  Widget _filtreDugmesi(
    String etiket, {
    required bool acik,
    required VoidCallback onTap,
  }) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
      decoration: BoxDecoration(
        color: acik ? AppColors.primary : AppColors.card,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: acik ? AppColors.primary : AppColors.border),
      ),
      child: Text(
        etiket,
        style: TextStyle(
          color: acik ? AppColors.onPrimary : AppColors.textSoft,
          fontSize: 11,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );

  /// Maç Başına Ortalamalar — kaynağın verdiği sezon istatistikleri.
  Widget _ortalamalar() {
    final compare = widget.m['compare'] as List?;
    if (compare == null || compare.isEmpty) return const SizedBox.shrink();

    final byLabel = {for (final c in compare.cast<Map>()) '${c['label']}': c};
    final rows =
        <({String label, Object? home, Object? away, String suffix})>[];
    for (final (key, label) in _avgPick) {
      final c = byLabel[key];
      if (c == null) continue;
      rows.add((
        label: label,
        home: c['home'],
        away: c['away'],
        suffix: '${c['suffix'] ?? ''}',
      ));
    }
    if (rows.isEmpty) return const SizedBox.shrink();

    final s = (widget.m['stats'] as Map?) ?? const {};

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.lgR,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CmpHead(s: s, homeName: widget.homeName, awayName: widget.awayName),
          Padding(
            padding: EdgeInsets.only(top: 6, bottom: 2),
            child: Text(
              'Maç Başına Ortalamalar',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textSoft,
                fontSize: 12.5,
                fontWeight: AppFont.bold,
              ),
            ),
          ),
          for (var i = 0; i < rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: i == 0
                  ? null
                  : BoxDecoration(
                      border: Border(top: BorderSide(color: AppColors.border)),
                    ),
              child: Row(
                children: [
                  SizedBox(
                    width: 56,
                    child: Text(
                      _fmtAvg(rows[i].home, rows[i].suffix),
                      style: _clVal,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      rows[i].label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.textSoft,
                        fontSize: 12.5,
                        fontWeight: AppFont.semibold,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 56,
                    child: Text(
                      _fmtAvg(rows[i].away, rows[i].suffix),
                      textAlign: TextAlign.right,
                      style: _clVal,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  static int _i(Object? v) => v is num ? v.toInt() : 0;
}

class _CmpHead extends StatelessWidget {
  const _CmpHead({
    required this.s,
    required this.homeName,
    required this.awayName,
  });

  final Map s;
  final String homeName;
  final String awayName;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Row(
          children: [
            Logo(
              uri: (s['home'] as Map?)?['logo'] as String?,
              name: homeName,
              size: 22,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                homeName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _chName,
              ),
            ),
          ],
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Flexible(
              child: Text(
                awayName,
                maxLines: 1,
                textAlign: TextAlign.right,
                overflow: TextOverflow.ellipsis,
                style: _chName,
              ),
            ),
            const SizedBox(width: 8),
            Logo(
              uri: (s['away'] as Map?)?['logo'] as String?,
              name: awayName,
              size: 22,
            ),
          ],
        ),
      ),
    ],
  );
}

/// Ortalanmış bölüm başlığı.
class _CmpTitle extends StatelessWidget {
  const _CmpTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: Spacing.md, bottom: 2),
    child: Text(
      text,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: AppColors.text,
        fontSize: 13.5,
        fontWeight: AppFont.heavy,
      ),
    ),
  );
}

/// Temiz kıyas satırı: solda/sağda kalın değer (veya özel içerik), ortada soluk
/// etiket, altta ince ayraç (son satırda yok). Bar YOK — referans tasarım.
class _CmpRow extends StatelessWidget {
  const _CmpRow({
    required this.label,
    this.home,
    this.away,
    this.left,
    this.right,
    this.last = false,
  });

  final String label;
  final String? home;
  final String? away;
  final Widget? left;
  final Widget? right;
  final bool last;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 11),
    decoration: last
        ? null
        : BoxDecoration(
            border: Border(
              bottom: BorderSide(color: AppColors.border, width: 0.5),
            ),
          ),
    child: Row(
      children: [
        Expanded(
          child: Align(
            alignment: Alignment.centerLeft,
            child: left ?? Text('$home', style: _clVal),
          ),
        ),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSoft, fontSize: 12),
          ),
        ),
        Expanded(
          child: Align(
            alignment: Alignment.centerRight,
            child:
                right ??
                Text('$away', textAlign: TextAlign.right, style: _clVal),
          ),
        ),
      ],
    ),
  );
}

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _chName =>
    TextStyle(color: AppColors.text, fontSize: 13.5, fontWeight: AppFont.heavy);

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _clVal => TextStyle(
  color: AppColors.text,
  fontSize: 14.5,
  fontWeight: AppFont.heavy,
  fontFeatures: [FontFeature.tabularFigures()],
);

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _fltHint => TextStyle(
  color: AppColors.textMuted,
  fontSize: 10.5,
  height: 14 / 10.5,
  fontStyle: FontStyle.italic,
);

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _muted =>
    TextStyle(color: AppColors.textMuted, fontSize: 12, height: 18 / 12);
