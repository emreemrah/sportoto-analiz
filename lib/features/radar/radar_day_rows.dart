// KAYNAK: app/src/components/RadarDayRows.js — BİREBİR çeviri.
//
// RADAR 3 / RADAR 4 GÜN SATIRLARI — seçili günün mühürlü değeri + önceki güne
// göre yön oku.
//
// İKİ RADAR KARIŞTIRILMAZ:
//  * Radar 4 = gerçek 1/X/2 ORANI (1.61 · 3.20 · 4.25)
//  * Radar 3 = kullanıcıların oynama YÜZDESİ (%62 · %21 · %17)
// Aynı ok/renk dili kullanılır ama birimler farklıdır.
//
// UYDURMA YOK: değeri olmayan satır boş bırakılmaz, KENDİ sebebini yazar.
// Sebep arka uçta üretilir (notes) — burada üretilmez.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import 'provider_labels.dart';

String _fmtOdd(Object? v) =>
    v == null ? '—' : (v is num ? v.toStringAsFixed(2) : '$v');

typedef Yon = ({String s, Color c});

/// Yön oku: yükseliş yeşil ▲ · düşüş kırmızı ▼ · sabit sarı =.
/// Sabit değer de BİR BİLGİDİR; ok basmamak "veri yok" ile karışırdı.
Yon? yonOku(Object? cur, Object? prev) {
  if (prev is! num || cur is! num) return null;
  final d = cur - prev;
  if (d.abs() < 0.005) return (s: '=', c: AppColors.warning);
  return d > 0 ? (s: '▲', c: AppColors.success) : (s: '▼', c: AppColors.danger);
}

/// Seçili günden ÖNCEKİ en yakın DOLU günü bulur (kıyas için).
/// "Bir önceki gün" değil "bir önceki KAYITLI gün": arada boş gün varsa kıyas
/// atlanmaz, yoksa hareket görünmez olurdu.
Map? _oncekiDoluGun(List days, int selIdx, Map? Function(Map) sec) {
  for (var i = selIdx - 1; i >= 0; i--) {
    final v = sec(days[i] as Map);
    if (v != null) return v;
  }
  return null;
}

class _SatirBasi extends StatelessWidget {
  const _SatirBasi({required this.item});
  final Map item;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(
        width: 22,
        child: Text(
          '${item['no']}',
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 15,
            fontWeight: AppFont.heavy,
          ),
        ),
      ),
      const SizedBox(width: Spacing.md),
      Expanded(
        child: Text(
          '${item['home']} – ${item['away']}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 14,
            fontWeight: AppFont.heavy,
          ),
        ),
      ),
    ],
  );
}

/// 1/X/2 üçlüsü + önceki kayıtlı güne göre yön oku.
class OddsTriple extends StatelessWidget {
  const OddsTriple({super.key, required this.odds, this.prev});

  final Map? odds;
  final Map? prev;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 10,
    runSpacing: 10,
    children: [
      for (final (lbl, key) in const [
        ('1', 'home'),
        ('X', 'draw'),
        ('2', 'away'),
      ])
        _hucre(lbl, odds?[key], yonOku(odds?[key], prev?[key])),
    ],
  );

  Widget _hucre(String lbl, Object? v, Yon? a) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: AppColors.surfaceSoft,
      borderRadius: AppRadius.smR,
      border: Border.all(color: AppColors.border),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          lbl,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
            fontWeight: AppFont.black,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          _fmtOdd(v),
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 14,
            fontWeight: AppFont.black,
          ),
        ),
        if (a != null) ...[
          const SizedBox(width: 4),
          Text(
            a.s,
            style: TextStyle(
              color: a.c,
              fontSize: 11,
              fontWeight: AppFont.black,
            ),
          ),
        ],
      ],
    ),
  );
}

/// RADAR 4 — bir maçın seçili gündeki mühürlü oranı.
/// [data] `/api/radar/daily-odds` yanıtı (gün listesi + maç hücreleri)
class MarketRow extends StatelessWidget {
  const MarketRow({
    super.key,
    required this.item,
    required this.data,
    required this.day,
  });

  final Map item;
  final Map? data;
  final String? day;

  @override
  Widget build(BuildContext context) {
    final days = (data?['days'] as List?) ?? const [];
    final selIdx = days.indexWhere((d) => (d as Map)['date'] == day);
    final mac = ((data?['matches'] as List?) ?? const [])
        .cast<Map>()
        .where((m) => m['no'] == item['no'])
        .firstOrNull;
    final cells = (mac?['cells'] as Map?) ?? const {};
    final notes = (mac?['notes'] as Map?) ?? const {};
    final cell = cells[day] as Map?;
    // Arka uç sebebi vermiyorsa (eski sürüm) tek jenerik cümleye düşülür.
    final why = cell == null ? notes[day] as Map? : null;
    final prev = cell != null
        ? _oncekiDoluGun(days, selIdx, (d) => cells[d['date']] as Map?)
        : null;

    return _Kutu(
      children: [
        _SatirBasi(item: item),
        if (cell != null)
          Padding(
            padding: const EdgeInsets.only(top: 8, left: 34),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                OddsTriple(
                  odds: cell['odds'] as Map?,
                  prev: prev?['odds'] as Map?,
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Text(
                    prev != null
                        ? 'Bir önceki güne göre değişim'
                        : 'İlk kayıtlı gün (kıyas yok)',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                ),
              ],
            ),
          )
        else ...[
          _Yok(
            metin: why?['text'] != null
                ? '${why!['text']}.'
                : 'Bu gün için oran kaydı yok.',
          ),
          if (why?['detail'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 2, left: 34),
              child: Opacity(
                opacity: 0.85,
                child: Text(
                  '${why!['detail']}',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

/// RADAR 3 — bir maçın seçili gündeki oynanma yüzdeleri, HER KAYNAK AYRI SATIR.
///
/// Kaynaklar ORTALANMAZ: iki site farklı yüzde veriyorsa bu bir bilgidir, tek
/// sayıya indirilirse kaybolur.
class PublicRow extends StatelessWidget {
  const PublicRow({
    super.key,
    required this.item,
    required this.data,
    required this.day,
    this.openKey,
    this.onToggleDna,
    this.dnaPanelBuilder,
  });

  final Map item;
  final Map? data;
  final String? day;

  /// Açık DNA paneli anahtarı (`"<maçNo>|<kaynak>"`)
  final String? openKey;
  final ValueChanged<String?>? onToggleDna;

  /// Açılan geçmiş DNA paneli. Verilmezse satır yalnız açılıp kapanır.
  final Widget Function(Object kaynak)? dnaPanelBuilder;

  @override
  Widget build(BuildContext context) {
    final days = (data?['days'] as List?) ?? const [];
    final gun = days.cast<Map>().where((d) => d['date'] == day).firstOrNull;

    // Seçili gün henüz gelmediyse yüzde BASILMAZ (uydurma yerine dürüst not).
    if (gun?['future'] == true) {
      return _Kutu(
        children: [
          _SatirBasi(item: item),
          const _Yok(
            metin: 'Bu gün henüz gelmedi — yüzde o gün oluştukça dolar.',
          ),
        ],
      );
    }

    final selIdx = days.indexWhere((d) => (d as Map)['date'] == day);
    final mac = ((data?['matches'] as List?) ?? const [])
        .cast<Map>()
        .where((m) => m['no'] == item['no'])
        .firstOrNull;
    final cells = (mac?['cells'] as Map?) ?? const {};
    final bySource = (cells[day] as Map?)?['bySource'] as Map?;
    final saglayicilar = aktifSaglayicilar(data?['sources'] as List?);

    return _Kutu(
      children: [
        _SatirBasi(item: item),
        if (saglayicilar.isEmpty)
          const _Yok(metin: 'Bu gün için oynanma yüzdesi kaydı yok.')
        else
          for (final pv in saglayicilar)
            _kaynakSatiri(pv, bySource, cells, days, selIdx),
      ],
    );
  }

  Widget _kaynakSatiri(
    Object pv,
    Map? bySource,
    Map cells,
    List days,
    int selIdx,
  ) {
    final c = bySource?[pv] as Map?;
    final prev = c != null
        ? _oncekiDoluGun(
            days,
            selIdx,
            (d) =>
                ((cells[d['date']] as Map?)?['bySource'] as Map?)?[pv] as Map?,
          )
        : null;
    final key = '${item['no']}|$pv';
    final acik = openKey == key;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          onTap: c == null ? null : () => onToggleDna?.call(acik ? null : key),
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.only(top: 6, left: 34),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // KAYNAK RENKLİ NOKTAYLA GÖSTERİLİR. Bahis sitesi adı hiçbir
                // yerde geçmez. Erişilebilirlik: renk tek ayırt edici olmasın
                // diye etiket kaynağın RENK ADINI söyler.
                Semantics(
                  key: Key('kaynak-nokta-${kaynakKodu(pv)}'),
                  label: providerLabel(pv),
                  child: Container(
                    width: 11,
                    height: 11,
                    decoration: BoxDecoration(
                      color: providerColor(pv),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0x2E000000)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                if (c == null)
                  const Text(
                    'bu gün kayıt yok',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                    ),
                  )
                else
                  Expanded(
                    child: Wrap(
                      spacing: 12,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        for (final k in const ['1', 'X', '2'])
                          _yuzde(
                            k,
                            (c['percentages'] as Map?)?[k],
                            yonOku(
                              (c['percentages'] as Map?)?[k],
                              (prev?['percentages'] as Map?)?[k],
                            ),
                          ),
                        Text(
                          acik ? '▾' : '›',
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (acik && dnaPanelBuilder != null) dnaPanelBuilder!(pv),
      ],
    );
  }

  Widget _yuzde(String k, Object? v, Yon? a) => RichText(
    text: TextSpan(
      style: const TextStyle(
        color: AppColors.textSoft,
        fontSize: 13,
        fontWeight: AppFont.heavy,
      ),
      children: [
        TextSpan(text: '$k %${v is num ? v.round() : '—'}'),
        if (a != null)
          TextSpan(
            text: ' ${a.s}',
            style: TextStyle(color: a.c, fontWeight: AppFont.black),
          ),
      ],
    ),
  );
}

class _Kutu extends StatelessWidget {
  const _Kutu({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.sm),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.mdR,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    ),
  );
}

class _Yok extends StatelessWidget {
  const _Yok({required this.metin});
  final String metin;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 6, left: 34),
    child: Text(
      metin,
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 12,
        fontStyle: FontStyle.italic,
      ),
    ),
  );
}
