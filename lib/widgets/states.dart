// KAYNAK: app/src/components/BallLoader.js + LoadingState.js + ErrorState.js
// BİREBİR çeviri.
//
// Kaynakta üç ayrı dosyaydı; burada tek dosyada durur çünkü üçü de aynı işin
// parçası (bekleme / hata durumu) ve Dart'ta dosya başına bir sınıf kuralı yok.

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

/// Sürekli dönen futbol topu — spinner yerine.
///
/// Kaynakta `react-native-svg` ile çizilmişti; Flutter'da aynı 48×48 viewBox
/// koordinatları `CustomPainter` ile birebir çizilir. Süre 1200 ms, doğrusal.
class BallLoader extends StatefulWidget {
  const BallLoader({super.key, this.size = 44, this.color});

  final double size;
  final Color? color;

  @override
  State<BallLoader> createState() => _BallLoaderState();
}

class _BallLoaderState extends State<BallLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
    turns: _c,
    child: CustomPaint(
      size: Size.square(widget.size),
      painter: _TopBoyaci(widget.color ?? AppColors.primary),
    ),
  );
}

class _TopBoyaci extends CustomPainter {
  const _TopBoyaci(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    // Kaynaktaki viewBox="0 0 48 48" — ölçek tek çarpanla taşınır.
    final k = size.width / 48;
    Offset p(double x, double y) => Offset(x * k, y * k);

    final cizgi = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5 * k;

    // Dış çember
    canvas.drawCircle(p(24, 24), 21 * k, cizgi);

    // Orta pentagon (dolu)
    final pentagon = Path()
      ..moveTo(24 * k, 16 * k)
      ..lineTo(31.6 * k, 21.5 * k)
      ..lineTo(28.7 * k, 30.5 * k)
      ..lineTo(19.3 * k, 30.5 * k)
      ..lineTo(16.4 * k, 21.5 * k)
      ..close();
    canvas.drawPath(pentagon, Paint()..color = color);

    // Dikişler: pentagon köşelerinden dışa
    final dikis = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2 * k
      ..strokeCap = StrokeCap.round;
    const kenarlar = <(double, double, double, double)>[
      (24, 16, 24, 4),
      (31.6, 21.5, 43, 17.8),
      (28.7, 30.5, 35.8, 40.2),
      (19.3, 30.5, 12.2, 40.2),
      (16.4, 21.5, 5, 17.8),
    ];
    for (final (x1, y1, x2, y2) in kenarlar) {
      canvas.drawLine(p(x1, y1), p(x2, y2), dikis);
    }
  }

  @override
  bool shouldRepaint(_TopBoyaci old) => old.color != color;
}

/// Ekran içine gömülen bekleme durumu (tam ekran değil).
class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.message = 'Yükleniyor…'});

  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(Spacing.xxl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const BallLoader(size: 44),
          const SizedBox(height: Spacing.lg),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: AppFont.md, color: AppColors.textSoft),
          ),
        ],
      ),
    ),
  );
}

/// Ortak hata durumu kartı.
class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    this.message,
    this.onRetry,
    this.icon = '⚠️',
    this.title = 'Bir şeyler ters gitti',
  });

  final String? message;
  final VoidCallback? onRetry;
  final String icon;
  final String title;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(horizontal: Spacing.md),
    padding: const EdgeInsets.symmetric(
      vertical: Spacing.xxxl,
      horizontal: Spacing.md,
    ),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(icon, style: const TextStyle(fontSize: 34)),
        const SizedBox(height: Spacing.md),
        Text(
          title,
          style: TextStyle(
            color: AppColors.text,
            fontSize: AppFont.lg,
            fontWeight: AppFont.heavy,
          ),
        ),
        if (message != null && message!.isNotEmpty) ...[
          const SizedBox(height: Spacing.xs),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Spacing.lg),
            child: Text(
              message!,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSoft, fontSize: AppFont.sm),
            ),
          ),
        ],
        if (onRetry != null) ...[
          const SizedBox(height: Spacing.lg),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'Tekrar Dene',
                style: TextStyle(color: AppColors.bg, fontWeight: AppFont.bold),
              ),
            ),
          ),
        ],
      ],
    ),
  );
}
