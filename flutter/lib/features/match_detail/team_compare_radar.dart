// KAYNAK: app/src/components/TeamCompareRadar.js — BİREBİR çeviri.
//
// TAKIM GÜÇ KARŞILAŞTIRMASI — radar (örümcek ağı) grafiği.
// Eksen mantığı SAF ve TESTLİDİR (core/compare_radar.dart). İki takımın da
// gerçek verisi olan eksenler çizilir; 3'ten az eksen varsa bileşen HİÇ
// görünmez (uydurma eksen yok). Normalizasyon ikili kıyastır — mutlak güç
// iddiası değil.
//
// ÇİZİM: kaynakta `react-native-svg` kullanılıyordu; Flutter'da aynı
// koordinatlar `CustomPainter` ile çizilir. Eksen açıları, halka değerleri
// (33/66/100), yarıçap ve merkez BİREBİR aynı.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/compare_radar.dart';
import '../../core/theme/tokens.dart';

const Color _homeC = Color(0xFF2F6FED);
const Color _awayC = Color(0xFFE0762C);
const double _size = 300;
const double _cx = _size / 2;
const double _cy = 128;
const double _r = 88;

class TeamCompareRadar extends StatelessWidget {
  const TeamCompareRadar({
    super.key,
    this.home,
    this.away,
    this.homeName,
    this.awayName,
  });

  final Map? home;
  final Map? away;
  final String? homeName;
  final String? awayName;

  static String _fmt(double v, String key) {
    if (key == 'clean') return '%${v.round()}';
    final r = (v * 100).round() / 100;
    // Kaynakta `.toString()` — tam sayıysa ".0" yazmaz.
    return r == r.roundToDouble() ? '${r.toInt()}' : '$r';
  }

  @override
  Widget build(BuildContext context) {
    final axes = buildCompareAxes(home, away);
    // yeterli ortak veri yok → dürüstçe gizlenir
    if (axes.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Güç Karşılaştırması',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 15,
              fontWeight: AppFont.black,
            ),
          ),
          Padding(
            padding: EdgeInsets.only(top: 3),
            child: Text(
              'İki takımın kendi aralarında kıyası — büyük değer 100 kabul '
              'edilir; mutlak güç puanı değildir.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                fontStyle: FontStyle.italic,
                height: 14 / 10.5,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _lejant(_homeC, homeName),
                const SizedBox(width: 18),
                _lejant(_awayC, awayName),
              ],
            ),
          ),
          Center(
            child: CustomPaint(
              size: const Size(_size, 252),
              painter: _RadarBoyaci(axes),
            ),
          ),
          // Gerçek değerler — grafik kıyas, SAYILAR GERÇEK.
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Column(
              children: [
                for (final ax in axes)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: AppColors.border)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _fmt(ax.rawHome, ax.key),
                            style: const TextStyle(
                              color: _homeC,
                              fontSize: 12.5,
                              fontWeight: AppFont.black,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            ax.label,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 11.5,
                              fontWeight: AppFont.bold,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            _fmt(ax.rawAway, ax.key),
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              color: _awayC,
                              fontSize: 12.5,
                              fontWeight: AppFont.black,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _lejant(Color renk, String? ad) => Flexible(
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: renk, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            ad ?? '',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppColors.textSoft,
              fontSize: 12,
              fontWeight: AppFont.heavy,
            ),
          ),
        ),
      ],
    ),
  );
}

class _RadarBoyaci extends CustomPainter {
  const _RadarBoyaci(this.axes);

  final List<CompareAxis> axes;

  static const List<double> _rings = [33, 66, 100];

  Path _cokgen(List<num> degerler) {
    final pts = polygonPoints(degerler, _cx, _cy, _r);
    final p = Path()..moveTo(pts.first.x, pts.first.y);
    for (final pt in pts.skip(1)) {
      p.lineTo(pt.x, pt.y);
    }
    return p..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final cizgi = Paint()
      ..color = AppColors.border
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    // Halkalar
    for (final rv in _rings) {
      canvas.drawPath(_cokgen([for (final _ in axes) rv]), cizgi);
    }

    // Eksen çizgileri + etiketler
    final n = axes.length;
    for (var i = 0; i < n; i++) {
      final a = (-90 + (i * 360) / n) * (math.pi / 180);
      final dx = _cx + _r * math.cos(a);
      final dy = _cy + _r * math.sin(a);
      canvas.drawLine(const Offset(_cx, _cy), Offset(dx, dy), cizgi);

      final lx = _cx + (_r + 20) * math.cos(a);
      final ly = _cy + (_r + 20) * math.sin(a);
      final tp = TextPainter(
        text: TextSpan(
          text: axes[i].label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.bold,
            color: AppColors.textMuted,
          ),
        ),
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
      )..layout();
      // textAnchor="middle" + y+4 karşılığı: yatayda ortala, dikeyde taban
      // hizasını yazının ortasına getir.
      tp.paint(canvas, Offset(lx - tp.width / 2, ly + 4 - tp.height));
    }

    // Takım çokgenleri — kaynakta dolgu `HOME_C + '33'` ve `AWAY_C + '2e'`.
    canvas.drawPath(
      _cokgen([for (final a in axes) a.home]),
      Paint()..color = _homeC.withValues(alpha: 0x33 / 0xFF),
    );
    canvas.drawPath(
      _cokgen([for (final a in axes) a.home]),
      Paint()
        ..color = _homeC
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    canvas.drawPath(
      _cokgen([for (final a in axes) a.away]),
      Paint()..color = _awayC.withValues(alpha: 0x2E / 0xFF),
    );
    canvas.drawPath(
      _cokgen([for (final a in axes) a.away]),
      Paint()
        ..color = _awayC
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    canvas.drawCircle(
      const Offset(_cx, _cy),
      2.5,
      Paint()..color = AppColors.textMuted,
    );
  }

  @override
  bool shouldRepaint(_RadarBoyaci old) => old.axes != axes;
}
