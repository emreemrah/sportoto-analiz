// ALT MENÜ İKONLARI — hepsi VEKTÖR, rengi çalışma anında verilir.
//
// KAYNAK: App.js içindeki `RadarIcon` ve `TicketIcon` (react-native-svg).
// İkisi de STATİK SVG'dir; koordinatlar kaynaktan birebir alındı ve 24×24
// viewBox'tan çizim boyutuna ölçeklenir. Kaynakta `<Svg width={28} height={28}
// viewBox="0 0 24 24">` yazıyordu — aynı oran burada `scale` ile kurulur.
//
// PNG'ye çevrilmediler: kaynakta renk `focused` durumuna göre değişiyor
// (accent ↔ muted). Vektör kalınca renk çalışma anında verilebiliyor.
//
// ═══════════ HOME / BULLETIN / PROFILE SONRADAN EKLENDİ ═══════════════════
// (kullanıcı isteği, 2026-08-12): bu üçü `assets/tab-home.png`,
// `assets/tab-bulletin.png` ve `assets/tab-profile.png` idi. RASTER GÖRSELİN
// RENGİ DEĞİŞTİRİLEMEZ — alt menüde Radar ve Kuponlarım tema rengini alırken
// Ana Sayfa ile Bülten sabit renkli kalıyordu; açık/koyu/takım temasında
// menünün yarısı temadan kopuk görünüyordu. Üçü de aynı 24×24 viewBox'ta,
// aynı çizgi kalınlığında (1.6) yeniden çizildi; artık dördü de tek aile.
//
// ÇİZGİ KALINLIĞI 1.6 — TicketIcon ile aynı. Farklı kalınlık, yan yana duran
// ikonlarda birinin "daha koyu" görünmesine yol açıyor.

import 'package:flutter/material.dart';

/// Ortak çizim kurulumu: 24×24 viewBox'a ölçekler, gövdeyi çağırır.
void _viewBox24(Canvas canvas, Size size, void Function() ciz) {
  canvas.save();
  canvas.scale(size.width / 24);
  ciz();
  canvas.restore();
}

/// İkon çizgisi — dördünde de aynı kalınlık ve uç/köşe biçimi.
Paint _cizgi(Color color, [double genislik = 1.6]) => Paint()
  ..style = PaintingStyle.stroke
  ..strokeWidth = genislik
  ..strokeCap = StrokeCap.round
  ..strokeJoin = StrokeJoin.round
  ..color = color;

/// Ana Sayfa sekmesi: EV ikonu (çatı + gövde + kapı).
class HomeIcon extends StatelessWidget {
  // ignore: prefer_const_constructors_in_immutables
  HomeIcon({super.key, required this.color, this.size = 28});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size(size, size), painter: _HomeIconPainter(color));
}

class _HomeIconPainter extends CustomPainter {
  const _HomeIconPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) => _viewBox24(canvas, size, () {
    // Çatı: sol saçaktan tepeye, tepeden sağ saçağa.
    canvas.drawPath(
      Path()
        ..moveTo(3.2, 10.4)
        ..lineTo(12, 3.6)
        ..lineTo(20.8, 10.4),
      _cizgi(color),
    );
    // Gövde: iki yan duvar + taban.
    canvas.drawPath(
      Path()
        ..moveTo(5.4, 9.2)
        ..lineTo(5.4, 19.4)
        ..lineTo(18.6, 19.4)
        ..lineTo(18.6, 9.2),
      _cizgi(color),
    );
    // Kapı — üstü yuvarlatılmış dikdörtgen, tabana oturur.
    canvas.drawPath(
      Path()
        ..moveTo(9.6, 19.4)
        ..lineTo(9.6, 14.6)
        ..arcToPoint(
          const Offset(14.4, 14.6),
          radius: const Radius.circular(2.4),
          clockwise: true,
        )
        ..lineTo(14.4, 19.4),
      _cizgi(color),
    );
  });

  @override
  bool shouldRepaint(_HomeIconPainter old) => old.color != color;
}

/// Bülten sekmesi: PANO ikonu (klipsli pano + üç satır).
class BulletinIcon extends StatelessWidget {
  // ignore: prefer_const_constructors_in_immutables
  BulletinIcon({super.key, required this.color, this.size = 28});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size(size, size), painter: _BulletinIconPainter(color));
}

class _BulletinIconPainter extends CustomPainter {
  const _BulletinIconPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) => _viewBox24(canvas, size, () {
    // Pano gövdesi — klipsin oturduğu üst kenar boşluğu bırakılır.
    canvas.drawRRect(
      RRect.fromLTRBR(4.4, 4.6, 19.6, 20.4, const Radius.circular(2.4)),
      _cizgi(color),
    );
    // Klips.
    canvas.drawRRect(
      RRect.fromLTRBR(9.2, 2.6, 14.8, 6.4, const Radius.circular(1.4)),
      _cizgi(color, 1.4),
    );
    // Satırlar — bülten sırası. Sonuncusu kısa: liste bitişini anlatır.
    for (final (y, x2) in [(11.2, 16.2), (14.2, 16.2), (17.2, 13.0)]) {
      canvas.drawLine(Offset(7.8, y), Offset(x2, y), _cizgi(color, 1.4));
    }
  });

  @override
  bool shouldRepaint(_BulletinIconPainter old) => old.color != color;
}

/// Profil sekmesi: SİLÜET ikonu — YALNIZ GİRİŞ YAPILMAMIŞKEN kullanılır.
/// Giriş yapılmışsa yerini kullanıcının kendi avatarı alır (bkz. `app.dart`).
class ProfileIcon extends StatelessWidget {
  // ignore: prefer_const_constructors_in_immutables
  ProfileIcon({super.key, required this.color, this.size = 28});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size(size, size), painter: _ProfileIconPainter(color));
}

class _ProfileIconPainter extends CustomPainter {
  const _ProfileIconPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) => _viewBox24(canvas, size, () {
    canvas.drawCircle(const Offset(12, 8.4), 3.9, _cizgi(color));
    // Omuzlar — yarım elips; uçları gövdenin dışına taşmaz.
    canvas.drawArc(
      const Rect.fromLTRB(4.6, 13.4, 19.4, 24.2),
      3.4557, // 198°
      2.3562, // 135°
      false,
      _cizgi(color),
    );
  });

  @override
  bool shouldRepaint(_ProfileIconPainter old) => old.color != color;
}

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
