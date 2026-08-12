// KAYNAK: app/src/screens/CouponResultScreen.js — BİREBİR çeviri.
//
// KUPON SONUCU — GERÇEK veriyle (mock değil).
// KURALLAR:
// • Değerlendirme kilit anındaki FINAL versiyonla yapılır (coupon_eval) —
//   sonradan değişen analiz/tahmin sonucu ETKİLEMEZ.
// • Yalnız RESMİ 90 dakika sonucu (1/X/2) esas alınır; gelmeyen maç ⏳ bekler.
// • Sistem sütunu = maç-öncesi KAYITLI sistem tahmini (snapshot).
//   Radar sütunu = kayıtlı radar favorisi (yalnız güncel bültende mevcutsa;
//   kayıt yoksa dürüstçe "—" gösterilir, uydurulmaz).
//
// GÖRÜNÜM: yayın stüdyosunun RESMÎ BÜLTEN TABLOSU. Satır = sıra no · ev arması ·
// takım adları · konuk arması · skor · resmî sonuç. Tablo parçaları
// coupon_studio_parts.dart'tan gelir; burada ikinci bir tablo yazılmaz.
//
// YAZIM: seçimler ve sonuçlar stüdyodaki gibi RESMÎ yazımla gösterilir
// (1 - 0 - 2; "0" beraberlik). Saklanan değer değişmez, yalnız gösterim.

import 'package:flutter/material.dart';

import '../../core/coupon/coupon_config.dart';
import '../../core/coupon/coupon_eval.dart';
import '../../core/coupon/coupon_store.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/studio_fonts.dart';
import '../../core/theme/studio_theme.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/states.dart';
import 'coupon_studio_parts.dart';

const Map<String, String> _mark = {'true': '✅', 'false': '❌', 'null': '⏳'};
const Map<String, String> _markEtiket = {
  'true': 'tuttu',
  'false': 'yattı',
  'null': 'resmî sonuç bekleniyor',
};

/// Resmî bülten yazımı: 'X' → '0', çoklu seçim tire ile ayrılır ('1X' → '1-0').
String? _resmi(Object? sym) {
  if (sym == null || '$sym'.isEmpty) return null;
  return '$sym'.split('').map(toOfficial).join('-');
}

class CouponResultScreen extends StatefulWidget {
  const CouponResultScreen({
    super.key,
    required this.roundId,
    this.couponId,
    this.roundName,
    this.season,
  });

  final Object? roundId;
  final String? couponId;
  final String? roundName;
  final String? season;

  @override
  State<CouponResultScreen> createState() => _CouponResultScreenState();
}

class _CouponResultScreenState extends State<CouponResultScreen> {
  Map<String, dynamic>? _hist;
  Map<Object, String> _radarMap = const {};
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.roundId == null) {
      setState(() {
        _error = 'Hafta bilgisi eksik.';
        _loading = false;
      });
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final h = await api.history(widget.roundId!);
      if (!mounted) return;
      setState(() => _hist = (h as Map).cast<String, dynamic>());

      // Radar favorisi yalnız güncel bültende kayıtlı — varsa maça bağla.
      try {
        final b = await api.bulletin() as Map?;
        if (!mounted) return;
        if (b != null && b['roundId'] == widget.roundId) {
          final rm = <Object, String>{};
          for (final raw in (b['matches'] as List?) ?? const []) {
            final m = raw as Map;
            final rc = m['radarCenter'];
            final master = rc is Map ? rc['master'] : null;
            final fav = master is Map ? master['favorite'] : null;
            final sym = fav is Map ? fav['symbol'] : null;
            if (sym != null && m['no'] != null) {
              rm[m['no'] as Object] = '$sym';
            }
          }
          setState(() => _radarMap = rm);
        } else {
          setState(() => _radarMap = const {});
        }
      } catch (_) {
        if (mounted) setState(() => _radarMap = const {});
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = kuponOlcek(context);

    if (_loading && _hist == null) {
      return _kabuk(LoadingState(message: 'Kupon sonucu yükleniyor…'));
    }
    if (_error != null) {
      return _kabuk(
        SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: ErrorState(message: _error, onRetry: _load),
        ),
      );
    }

    final coupon = widget.couponId != null
        ? getCoupon(widget.couponId)
        : getRankedCoupon(widget.roundId);
    if (coupon == null) {
      return _kabuk(
        SingleChildScrollView(
          padding: EdgeInsets.all(12),
          child: EmptyState(
            icon: Icons.confirmation_number_outlined,
            title: 'Kupon yok',
            message: 'Bu bülten için kaydedilmiş bir kuponun yok.',
          ),
        ),
      );
    }

    final matches = (_hist?['matches'] as List?) ?? const [];
    final byNo = <Object, Map>{
      for (final m in matches)
        if ((m as Map)['no'] != null) m['no'] as Object: m,
    };
    // YALNIZ RESMÎ: hem `result` hem `score` gelmiş maçlar değerlendirilir.
    final resultMap = <Object, Object?>{
      for (final raw in matches)
        if ((raw as Map)['result'] != null && raw['score'] != null)
          raw['no'] as Object: raw['result'],
    };
    final ev = evalCoupon(coupon, resultMap);
    if (ev == null) {
      return _kabuk(
        SingleChildScrollView(
          padding: EdgeInsets.all(12),
          child: EmptyState(
            icon: Icons.confirmation_number_outlined,
            title: 'Kupon boş',
            message: 'Bu kuponun kayıtlı seçimi bulunamadı.',
          ),
        ),
      );
    }

    // 15/14/13/12 satırı — yalnız tüm resmî sonuçlar gelince kesin konuşulur.
    final tierLine = ev.allResolved
        ? (ev.tier != null
              ? '🎯 ${ev.tier} bildin — 12+ barajının üstünde'
              : '12 barajının altında (${ev.correct} doğru)')
        : '${ev.resolved}/${ev.total} resmî sonuç geldi — kalan maçlar ⏳';

    final sagGenislik = o.dar ? 66.0 : 80.0;

    return _kabuk(
      Column(
        children: [
          _ustBaslik(o, coupon, ev, tierLine),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(SP.md, SP.md, SP.md, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _yatanlar(o, ev, byNo),
                  Tablo(
                    children: [
                      Thead(
                        k: o.k,
                        children: [
                          Th(
                            text: 'SIRA',
                            k: o.k,
                            width: (32 * o.k).roundToDouble(),
                            padX: 5,
                            center: true,
                          ),
                          Th(
                            text: 'EV SAHİBİ - KONUK TAKIM',
                            k: o.k,
                            esnek: true,
                          ),
                          if (!o.dar)
                            Th(
                              text: 'SKOR',
                              k: o.k,
                              width: (54 * o.k).roundToDouble(),
                            ),
                          Th(
                            text: 'SONUÇ',
                            k: o.k,
                            width: (sagGenislik * o.k).roundToDouble(),
                            center: true,
                          ),
                        ],
                      ),
                      for (var i = 0; i < ev.rows.length; i++)
                        _satir(o, ev.rows[i], i, byNo, sagGenislik),
                      Tfoot(
                        k: o.k,
                        text:
                            'Sen / Sistem / Radar satırları maç-öncesi KAYITLI değerlerdir; kayıt '
                            'yoksa "—" yazar, uydurulmaz. Seçim ve sonuçlar resmî bülten yazımıyla '
                            'gösterilir: 1 - 0 - 2 ("0" beraberlik). Bir maç yalnız resmî 90 '
                            'dakika sonucu geldiğinde ✅/❌ olur; gelmeyen maç ⏳ bekler. Bu ekran '
                            'analiz amaçlıdır; kesin sonuç veya kazanç vaadi değildir.',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _kabuk(Widget govde) => Scaffold(
    // STÜDYO PALETİ — genel uygulama teması (tokens.dart) burada
    // KULLANILMAZ; iki palet karışırsa aynı ekranda iki farklı gri, iki
    // farklı köşe yarıçapı çıkıyor.
    backgroundColor: S.bg,
    appBar: AppBar(
      title: const Text('Kupon Sonucu'),
      backgroundColor: S.panel,
      foregroundColor: S.ink,
    ),
    body: govde,
  );

  String? _scoreOf(Map? m) {
    final s = m?['score'];
    if (s is Map && s['home'] != null) return '${s['home']}-${s['away']}';
    return null;
  }

  Widget _ustBaslik(
    KuponOlcek o,
    Map coupon,
    EvalResult ev,
    String tierLine,
  ) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: SP.md, vertical: SP.sm),
    decoration: const BoxDecoration(
      color: S.panel,
      border: Border(
        bottom: BorderSide(color: S.line, width: TABLE.hair),
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Kupon ${coupon['couponNo']} Sonucu',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: studioFont(700).copyWith(color: S.ink, fontSize: o.t.baslik),
        ),
        const SizedBox(height: 2),
        Text(
          [
                if (widget.roundName != null) widget.roundName!,
                if (widget.season != null) '${widget.season} Sezonu',
              ].join(' · ').isEmpty
              ? 'Hafta bilgisi yok'
              : [
                  if (widget.roundName != null) widget.roundName!,
                  if (widget.season != null) '${widget.season} Sezonu',
                ].join(' · '),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: studioFont(500).copyWith(color: S.inkDim, fontSize: o.t.kucuk),
        ),
        const SizedBox(height: SP.sm),
        Wrap(
          spacing: SP.lg,
          runSpacing: SP.sm,
          children: [
            SayiKutu(
              k: o.k,
              etiket: 'DOĞRU',
              deger: '${ev.correct}/${ev.resolved}',
              tone: S.good,
              alt: '${ev.total} maçta',
            ),
            SayiKutu(
              k: o.k,
              etiket: 'YANLIŞ',
              deger: '${ev.wrong}',
              tone: ev.wrong > 0 ? S.bad : S.inkDim,
            ),
            SayiKutu(
              k: o.k,
              etiket: 'BEKLEYEN',
              deger: '${ev.pending}',
              tone: ev.pending > 0 ? S.warn : S.inkDim,
              alt: ev.pending > 0 ? 'resmî sonuç yok' : null,
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: SP.xs),
          child: Text(
            tierLine,
            style: studioFont(
              700,
            ).copyWith(color: S.accent, fontSize: o.t.metin),
          ),
        ),
        Not(
          k: o.k,
          text:
              'Değerlendirme: kilitli final versiyon (V${ev.versionNo}) · yalnız resmî 90 dakika sonucu',
        ),
      ],
    ),
  );

  /// "Nereden yattım?" — hata hangi karar noktasından? Kilit anındaki KAYITLI
  /// sinyallerle kıyaslanır; kayıt yoksa "kaydı yok" denir, uydurulmaz.
  Widget _yatanlar(KuponOlcek o, EvalResult ev, Map<Object, Map> byNo) {
    if (ev.misses.isNotEmpty) {
      return Container(
        margin: const EdgeInsets.only(bottom: SP.md),
        padding: const EdgeInsets.all(SP.md),
        decoration: BoxDecoration(
          color: S.badSoft,
          border: Border.all(color: S.bad, width: TABLE.hair),
          borderRadius: BorderRadius.circular(R.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Nereden yattım? (${ev.misses.length} maç)',
              style: studioFont(
                700,
              ).copyWith(color: S.bad, fontSize: o.t.metin),
            ),
            for (final r in ev.misses) _yatanSatir(o, r, byNo),
          ],
        ),
      );
    }
    if (ev.allResolved && ev.wrong == 0) {
      return Container(
        margin: const EdgeInsets.only(bottom: SP.md),
        padding: const EdgeInsets.all(SP.md),
        decoration: BoxDecoration(
          color: S.goodSoft,
          border: Border.all(color: S.good, width: TABLE.hair),
          borderRadius: BorderRadius.circular(R.md),
        ),
        child: Text(
          'Hiç yatan maç yok — tüm seçimler tuttu.',
          style: studioFont(700).copyWith(color: S.good, fontSize: o.t.metin),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _yatanSatir(KuponOlcek o, EvalRow r, Map<Object, Map> byNo) {
    final m = byNo[r.no];
    final pred = m?['prediction'];
    final sys = _resmi(pred is Map ? pred['symbol'] : null);
    final radar = _resmi(_radarMap[r.no]);
    final actual = _resmi(r.actual);
    final sysHit = sys?.split('-').contains(actual);
    final radHit = radar != null ? radar == actual : null;
    final ctx = [
      sys != null
          ? 'Sistem $sys demişti (${sysHit! ? 'tutmuş' : 'o da yatmış'})'
          : 'Sistem kaydı yok',
      radar != null
          ? 'Radar $radar demişti (${radHit! ? 'tutmuş' : 'o da yatmış'})'
          : 'Radar kaydı yok',
    ].join(' · ');
    final skor = _scoreOf(m);
    final ad = m != null
        ? '${(m['home'] as Map?)?['mediumName'] ?? ''} - ${(m['away'] as Map?)?['mediumName'] ?? ''}'
        : 'maç';

    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Text(
        '${r.no}. $ad: Sen ${_resmi(r.outcomes.join())} seçmiştin, sonuç $actual geldi'
        '${skor != null ? ' ($skor)' : ''}. $ctx.',
        style: studioFont(
          500,
        ).copyWith(color: S.ink, fontSize: o.t.kucuk, height: 17 / o.t.kucuk),
      ),
    );
  }

  Widget _satir(
    KuponOlcek o,
    EvalRow item,
    int i,
    Map<Object, Map> byNo,
    double sagGenislik,
  ) {
    final m = byNo[item.no];
    final pred = m?['prediction'];
    final sys = _resmi(pred is Map ? pred['symbol'] : null);
    final radar = _resmi(_radarMap[item.no]);
    final sen = item.outcomes.isNotEmpty ? _resmi(item.outcomes.join()) : null;
    final skor = _scoreOf(m);
    final senRenk = item.hit == true
        ? S.good
        : (item.hit == false ? S.bad : S.inkSoft);

    return MacSatiri(
      k: o.k,
      zebra: i % 2 == 1,
      sira: item.no ?? '',
      home:
          (m?['home'] as Map?)?['mediumName'] as String? ??
          (m?['home'] as Map?)?['name'] as String?,
      away:
          (m?['away'] as Map?)?['mediumName'] as String? ??
          (m?['away'] as Map?)?['name'] as String?,
      homeLogo: (m?['home'] as Map?)?['logo'] as String?,
      awayLogo: (m?['away'] as Map?)?['logo'] as String?,
      alt: Wrap(
        spacing: SP.sm,
        children: [
          AltBilgi(
            k: o.k,
            text: 'Sen ${sen ?? '—'}',
            color: senRenk,
            sayi: true,
          ),
          AltBilgi(k: o.k, text: 'Sistem ${sys ?? '—'}', sayi: true),
          AltBilgi(k: o.k, text: 'Radar ${radar ?? '—'}', sayi: true),
          if (o.dar && skor != null)
            AltBilgi(k: o.k, text: 'Skor $skor', color: S.ink, sayi: true),
        ],
      ),
      ek: o.dar
          ? null
          : Text(
              skor ?? '—',
              maxLines: 1,
              style: studioFont(700).copyWith(
                color: S.ink,
                fontSize: o.t.orta,
                fontFeatures: kTabular,
              ),
            ),
      ekGenislik: o.dar ? null : 54,
      sag: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            constraints: const BoxConstraints(minWidth: 22),
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: item.actual != null ? S.panel3 : S.panel2,
              border: Border.all(
                color: item.actual != null ? S.lineStrong : S.line,
                width: TABLE.hair,
              ),
              borderRadius: BorderRadius.circular(R.sm),
            ),
            child: Text(
              item.actual != null ? _resmi(item.actual)! : '—',
              style: studioFont(700).copyWith(
                color: S.ink,
                fontSize: o.t.orta,
                fontFeatures: kTabular,
              ),
            ),
          ),
          const SizedBox(width: 4),
          Semantics(
            label: _markEtiket['${item.hit}'],
            child: Text(
              _mark['${item.hit}'] ?? '⏳',
              style: TextStyle(fontSize: o.t.orta),
            ),
          ),
        ],
      ),
      sagGenislik: sagGenislik,
    );
  }
}
