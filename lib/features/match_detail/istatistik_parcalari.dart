// KAYNAK: app/src/screens/MatchDetailScreen.js → İstatistik sekmesinin
// yardımcı bileşenleri: H2hCell, InjuryCol, SquadSection, TableLogo,
// LeagueTableFull. BİREBİR çeviri.
//
// GİZLİLİK NOTU (kaynaktan aynen): lig tablosu tek ekranda 18-20 arma çizer ve
// en yoğun sızıntı noktası burasıdır — bu yüzden arma adresi VEKİLDEN geçer
// (crestUrlOf). Gerçek arma yoksa nötr küçük yer tutucu çizilir; BAŞKA kulübün
// arması ASLA konmaz.

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/crest_url.dart';
import '../../core/network/api_config.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';

/// H2H mini kartı — eski görünüm (kullanıcı tercihi): ikon + büyük sayı +
/// etiket.
class H2hCell extends StatelessWidget {
  const H2hCell({
    super.key,
    required this.n,
    required this.label,
    required this.icon,
    required this.color,
  });

  final Object? n;
  final String label;
  final String icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
      decoration: BoxDecoration(
        // Kaynakta `color + '66'` kenarlık, `color + '14'` zemin.
        color: color.withValues(alpha: 0x14 / 0xFF),
        border: Border.all(color: color.withValues(alpha: 0x66 / 0xFF)),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        children: [
          Text(icon, style: const TextStyle(fontSize: 18)),
          Text(
            '$n',
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: AppFont.black,
            ),
          ),
          Text(
            label,
            maxLines: 2,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 10.5,
              fontWeight: AppFont.bold,
            ),
          ),
        ],
      ),
    ),
  );
}

/// Eksikler sütunu. Liste boşsa "Bilinen eksik yok" der — bu, "eksik yok"
/// iddiası DEĞİL, "bilgimiz yok" ifadesidir.
class InjuryCol extends StatelessWidget {
  const InjuryCol({super.key, required this.title, this.list});

  final String title;
  final List? list;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 12.5,
            fontWeight: AppFont.black,
          ),
        ),
        if (list != null && list!.isNotEmpty)
          for (final raw in list!)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '🚑 ${(raw as Map)['name']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 12,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                  if (raw['reason'] != null)
                    Text(
                      '${raw['reason']}',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                ],
              ),
            )
        else
          Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              'Bilinen eksik yok',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ),
      ],
    ),
  );
}

const Map<String, String> _posLong = {
  'K': 'Kaleci',
  'D': 'Defans',
  'O': 'Orta Saha',
  'F': 'Forvet',
};

/// Tam kadro — açılır/kapanır, yatay kaydırmalı tablo.
class SquadSection extends StatelessWidget {
  const SquadSection({
    super.key,
    required this.title,
    this.squad,
    required this.open,
    required this.onToggle,
  });

  final String title;
  final List? squad;
  final bool open;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final s = squad;
    if (s == null || s.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          GestureDetector(
            onTap: onToggle,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.all(Spacing.md),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '$title  ·  ${s.length} oyuncu',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 13,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ),
                  Text(
                    open ? '▲' : '▼',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
          if (open)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Column(
                children: [
                  _baslik(),
                  for (var i = 0; i < s.length; i++)
                    _satir((s[i] as Map).cast<String, dynamic>(), i),
                ],
              ),
            ),
        ],
      ),
    );
  }

  static const double _wName = 150;
  static const double _wPos = 78;
  static const double _wCell = 42;

  Widget _baslik() => Container(
    color: AppColors.bgAlt,
    padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 8),
    child: Row(
      children: const [
        SizedBox(width: _wName, child: _Bh('Oyuncu')),
        SizedBox(width: _wPos, child: _Bh('Poz')),
        SizedBox(width: _wCell, child: _Bh('Yaş', orta: true)),
        SizedBox(width: _wCell, child: _Bh('Maç', orta: true)),
        SizedBox(width: _wCell, child: _Bh('⚽', orta: true)),
        SizedBox(width: _wCell, child: _Bh('As', orta: true)),
        SizedBox(width: _wCell, child: _Bh('🟨', orta: true)),
        SizedBox(width: _wCell, child: _Bh('🟥', orta: true)),
      ],
    ),
  );

  Widget _satir(Map<String, dynamic> p, int i) {
    final kod = countryCode(p['nat'] as String?);
    return Container(
      color: i % 2 == 1 ? AppColors.bgAlt : null,
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
      child: Row(
        children: [
          SizedBox(
            width: _wName,
            child: Row(
              children: [
                if (kod.isNotEmpty) ...[
                  // Bayrak GÖRSELİ — ülke adı eşleşmezse hiç çizilmez.
                  CachedNetworkImage(
                    imageUrl: 'https://flagcdn.com/32x24/$kod.png',
                    width: 16,
                    height: 12,
                    fit: BoxFit.contain,
                    errorWidget: (_, _, _) => const SizedBox(width: 16),
                    placeholder: (_, _) => const SizedBox(width: 16),
                  ),
                  const SizedBox(width: 5),
                ],
                Expanded(
                  child: Text(
                    '${p['name'] ?? ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 12,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: _wPos,
            child: Text(
              _posLong['${p['pos']}'] ?? '${p['pos'] ?? ''}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: AppColors.textMuted, fontSize: 11.5),
            ),
          ),
          _hucre('${p['age'] ?? '-'}', soluk: true),
          _hucre('${p['apps'] ?? ''}'),
          _hucre(_bosSifir(p['goals']), kalin: true),
          _hucre(_bosSifir(p['assists'])),
          _hucre(_bosSifir(p['yellow'])),
          _hucre(_bosSifir(p['red'])),
        ],
      ),
    );
  }

  /// Kaynakta `{p.goals || ''}` — 0 ve null BOŞ yazılır. Sıfırı "0" diye
  /// basmak tabloyu okunmaz hâle getiriyordu.
  static String _bosSifir(Object? v) {
    if (v == null) return '';
    if (v is num && v == 0) return '';
    if ('$v' == '0') return '';
    return '$v';
  }

  Widget _hucre(String v, {bool soluk = false, bool kalin = false}) => SizedBox(
    width: _wCell,
    child: Text(
      v,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: soluk ? AppColors.textMuted : AppColors.text,
        fontSize: 11.5,
        fontWeight: kalin ? AppFont.black : AppFont.semibold,
      ),
    ),
  );
}

class _Bh extends StatelessWidget {
  const _Bh(this.t, {this.orta = false});

  final String t;
  final bool orta;

  @override
  Widget build(BuildContext context) => Text(
    t,
    textAlign: orta ? TextAlign.center : TextAlign.left,
    style: TextStyle(
      color: AppColors.textMuted,
      fontSize: 10.5,
      fontWeight: AppFont.black,
    ),
  );
}

/// Lig tablosu satır logosu — gerçek arma varsa onu, yoksa nötr yer tutucu.
class TableLogo extends StatelessWidget {
  const TableLogo({super.key, this.logo});

  final String? logo;

  @override
  Widget build(BuildContext context) {
    final adres = crestUrlOf(logo, apiBase);
    if (adres.isEmpty) return _bos();
    return CachedNetworkImage(
      imageUrl: adres,
      width: 16,
      height: 16,
      fit: BoxFit.contain,
      errorWidget: (_, _, _) => _bos(),
      placeholder: (_, _) => _bos(),
    );
  }

  Widget _bos() => Container(
    width: 16,
    height: 16,
    decoration: BoxDecoration(
      color: AppColors.bgAlt,
      borderRadius: BorderRadius.circular(3),
    ),
  );
}

const List<({String key, String label})> _ltTabs = [
  (key: 'overall', label: 'Tümü'),
  (key: 'home', label: 'İç Saha'),
  (key: 'away', label: 'Deplasman'),
];

/// Pozisyon bölgeleri — Avrupa lig düzenine göre GÖRSEL yaklaşım (yalnızca
/// tasarım/renk amaçlı; gerçek kupa kotaları lige göre değişebilir).
String? _zoneOf(Object? pos, int n) {
  final p = pos is num ? pos.toInt() : int.tryParse('$pos');
  if (p == null) return null;
  if (p == 1) return 'ucl';
  if (p <= 3) return 'conf';
  if (n >= 6 && p == n - 2) return 'playoff';
  if (n >= 6 && p >= n - 1) return 'releg';
  return null;
}

const Map<String, Color> _zoneColor = {
  'ucl': AppColors.info,
  'conf': AppColors.success,
  'playoff': AppColors.warning,
  'releg': AppColors.danger,
};

const List<({String key, String label})> _zoneLegend = [
  (key: 'ucl', label: 'Şampiyonlar Ligi Eleme'),
  (key: 'conf', label: 'Konferans Ligi Eleme'),
  (key: 'playoff', label: 'Küme Düşme Play-off'),
  (key: 'releg', label: 'Küme Düşme'),
];

/// Tek kart · Tümü/İç Saha/Deplasman sekmeli tam lig tablosu.
class LeagueTableFull extends StatefulWidget {
  const LeagueTableFull({
    super.key,
    this.table,
    this.homeId,
    this.awayId,
    this.homeLogo,
    this.awayLogo,
    this.league,
  });

  final Object? table;
  final Object? homeId;
  final Object? awayId;
  final String? homeLogo;
  final String? awayLogo;
  final String? league;

  @override
  State<LeagueTableFull> createState() => _LeagueTableFullState();
}

class _LeagueTableFullState extends State<LeagueTableFull> {
  String _view = 'overall';

  @override
  Widget build(BuildContext context) {
    // Eski sürümle uyum: table DİZİ gelirse genel kabul edilir.
    final variants = widget.table is List
        ? {'overall': widget.table as List, 'home': const [], 'away': const []}
        : ((widget.table as Map?) ?? const {});

    final tabs = [
      for (final t in _ltTabs)
        if ((variants[t.key] as List?)?.isNotEmpty ?? false) t,
    ];
    final aktifVar = (variants[_view] as List?)?.isNotEmpty ?? false;
    final active = aktifVar ? _view : 'overall';
    final rows = (variants[active] as List?) ?? const [];
    final n = rows.length;

    return Container(
      padding: const EdgeInsets.all(Spacing.sm),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.league != null && widget.league!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                widget.league!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 12.5,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
          if (tabs.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  for (final t in tabs) ...[
                    GestureDetector(
                      onTap: () => setState(() => _view = t.key),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: t.key == active
                              ? AppColors.primary
                              : AppColors.bgAlt,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          t.label,
                          style: TextStyle(
                            color: t.key == active
                                ? AppColors.white
                                : AppColors.textMuted,
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
          _baslikSatiri(),
          for (var i = 0; i < rows.length; i++)
            _satir((rows[i] as Map).cast<String, dynamic>(), i, n),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                for (final z in _zoneLegend)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 3, height: 11, color: _zoneColor[z.key]),
                      const SizedBox(width: 5),
                      Text(
                        z.label,
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static const double _cPos = 22;
  static const double _cN = 22;
  static const double _cAv = 30;
  static const double _cP = 26;

  Widget _baslikSatiri() => Container(
    padding: const EdgeInsets.symmetric(vertical: 6),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      children: const [
        SizedBox(width: 4),
        SizedBox(width: _cPos, child: _Bh('#', orta: true)),
        Expanded(child: _Bh('Takım')),
        SizedBox(width: _cN, child: _Bh('O', orta: true)),
        SizedBox(width: _cN, child: _Bh('G', orta: true)),
        SizedBox(width: _cN, child: _Bh('B', orta: true)),
        SizedBox(width: _cN, child: _Bh('M', orta: true)),
        SizedBox(width: _cAv, child: _Bh('Av.', orta: true)),
        SizedBox(width: _cP, child: _Bh('P', orta: true)),
      ],
    ),
  );

  Widget _satir(Map<String, dynamic> r, int idx, int n) {
    final isHome = r['teamId'] == widget.homeId;
    final isAway = r['teamId'] == widget.awayId;
    final mine = isHome || isAway;
    final z = _zoneOf(r['position'], n);
    final av = r['goalDiff'];
    final avNum = av is num ? av : (num.tryParse('$av') ?? 0);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 5),
      decoration: BoxDecoration(
        color: isHome
            ? AppColors.primarySoft
            : (isAway
                  ? AppColors.warningSoft
                  : (idx % 2 == 1 ? AppColors.bgAlt : null)),
        border: Border(
          left: BorderSide(
            color: z != null ? _zoneColor[z]! : Colors.transparent,
            width: 3,
          ),
        ),
      ),
      child: Row(
        children: [
          const SizedBox(width: 1),
          SizedBox(
            width: _cPos,
            child: Text(
              '${r['position']}',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                fontWeight: AppFont.semibold,
              ),
            ),
          ),
          Expanded(
            child: Row(
              children: [
                TableLogo(
                  logo:
                      (r['logo'] as String?) ??
                      (isHome
                          ? widget.homeLogo
                          : (isAway ? widget.awayLogo : null)),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    '${r['name'] ?? ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 11.5,
                      fontWeight: mine ? AppFont.black : AppFont.semibold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          _sayi('${r['played'] ?? ''}', soluk: true),
          _sayi('${r['wins'] ?? ''}'),
          _sayi('${r['draws'] ?? ''}'),
          _sayi('${r['losses'] ?? ''}'),
          SizedBox(
            width: _cAv,
            child: Text(
              '${avNum >= 0 ? '+' : ''}$avNum',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ),
          SizedBox(
            width: _cP,
            child: Text(
              '${r['points'] ?? ''}',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.text,
                fontSize: 11.5,
                fontWeight: AppFont.black,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sayi(String v, {bool soluk = false}) => SizedBox(
    width: _cN,
    child: Text(
      v,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: soluk ? AppColors.textMuted : AppColors.text,
        fontSize: 11,
        fontWeight: AppFont.semibold,
      ),
    ),
  );
}
