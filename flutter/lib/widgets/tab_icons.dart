// KAYNAK: App.js içindeki `RadarIcon` ve `TicketIcon` (react-native-svg).
//
// İkisi de STATİK SVG'dir; koordinatlar kaynaktan birebir alındı ve 24×24
// viewBox'tan çizim boyutuna ölçeklenir. Kaynakta `<Svg width={28} height={28}
// viewBox="0 0 24 24">` yazıyordu — aynı oran burada `scale` ile kurulur.
//
// PNG'ye çevrilmediler: kaynakta renk `focused` durumuna göre değişiyor
// (accent ↔ muted). Vektör kalınca renk çalışma anında verilebiliyor.

import 'package:flutter/material.dart';

/// Analiz sekmesi: RADAR ikonu (eş merkezli halkalar + tarama kolu + iz).
class RadarIcon extends StatelessWidget {
  const RadarIcon({super.key, required this.color, this.size = 28});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size(size, size), painter: _RadarIconPainter(color));
}

class _RadarIconPainter extends CustomPainter {
  const _RadarIconPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 24; // viewBox 0 0 24 24
    canvas.save();
    canvas.scale(k);

    void ring(double r, double opacity) {
      canvas.drawCircle(
        const Offset(12, 12),
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = color.withValues(alpha: opacity),
      );
    }

    ring(9.5, 0.45);
    ring(6, 0.55);
    ring(2.6, 0.75);

    // Tarama kolu
    canvas.drawLine(
      const Offset(12, 12),
      const Offset(20, 6),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = color,
    );

    final fill = Paint()..color = color;
    canvas.drawCircle(const Offset(16.6, 8.4), 1.7, fill); // iz noktası
    canvas.drawCircle(const Offset(12, 12), 1.1, fill); // merkez

    canvas.restore();
  }

  @override
  bool shouldRepaint(_RadarIconPainter old) => old.color != color;
}

/// Kuponlarım sekmesi: BİLET ikonu (kenar çentikli kupon + zımba çizgisi).
class TicketIcon extends StatelessWidget {
  const TicketIcon({super.key, required this.color, this.size = 28});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size(size, size), painter: _TicketIconPainter(color));
}

class _TicketIconPainter extends CustomPainter {
  const _TicketIconPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 24;
    canvas.save();
    canvas.scale(k);

    // Kaynaktaki `d` özniteliğinin komut komut karşılığı:
    // M3.5 8.2 c0-1.1.9-2 2-2 h13 c1.1 0 2 .9 2 2 v1.6
    // a2.2 2.2 0 0 0 0 4.4 v1.6 c0 1.1-.9 2-2 2 h-13
    // c-1.1 0-2-.9-2-2 v-1.6 a2.2 2.2 0 0 0 0-4.4 V8.2 z
    final path = Path()
      ..moveTo(3.5, 8.2)
      ..relativeCubicTo(0, -1.1, 0.9, -2, 2, -2)
      ..relativeLineTo(13, 0)
      ..relativeCubicTo(1.1, 0, 2, 0.9, 2, 2)
      ..relativeLineTo(0, 1.6)
      ..relativeArcToPoint(
        const Offset(0, 4.4),
        radius: const Radius.circular(2.2),
        largeArc: false,
        clockwise: false,
      )
      ..relativeLineTo(0, 1.6)
      ..relativeCubicTo(0, 1.1, -0.9, 2, -2, 2)
      ..relativeLineTo(-13, 0)
      ..relativeCubicTo(-1.1, 0, -2, -0.9, -2, -2)
      ..relativeLineTo(0, -1.6)
      ..relativeArcToPoint(
        const Offset(0, -4.4),
        radius: const Radius.circular(2.2),
        largeArc: false,
        clockwise: false,
      )
      ..close();

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..strokeJoin = StrokeJoin.round
        ..color = color,
    );

    // Zımba çizgisi — SVG'de strokeDasharray="2.1 2.1"
    _dashedLine(
      canvas,
      const Offset(14.6, 7.4),
      const Offset(14.6, 16.6),
      dash: 2.1,
      gap: 2.1,
      paint: Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = color,
    );

    canvas.restore();
  }

  void _dashedLine(
    Canvas canvas,
    Offset a,
    Offset b, {
    required double dash,
    required double gap,
    required Paint paint,
  }) {
    final total = (b - a).distance;
    final dir = (b - a) / total;
    var travelled = 0.0;
    while (travelled < total) {
      final end = (travelled + dash).clamp(0.0, total);
      canvas.drawLine(a + dir * travelled, a + dir * end, paint);
      travelled += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_TicketIconPainter old) => old.color != color;
}
