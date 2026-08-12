// KAYNAK: app/src/components/ScreenBackdrop.js — BİREBİR çeviri.
//
// Ana ekranların arkasına çok soluk "taktik tahtası" dokusu koyan sarmalayıcı.
// Kaynakta iki SVG katmanı vardı: (1) statik saha çizgileri + üst parıltı,
// (2) 3 sn'de bir 1 ↔ 0.5 arası "nefes alan" X/O işaretleri.
//
// PRESERVEASPECTRATIO="xMidYMid slice" KARŞILIĞI: SVG'de bu, deseni ekranı
// KAPLAYACAK şekilde büyütüp ortalar (taşan kenar kırpılır). Flutter'da
// yerleşik karşılığı yok; ölçek `max(en/360, boy/720)` ile hesaplanıp tuval
// elle ortalanır. `min` kullanmak deseni ekrana SIĞDIRIR ve kenarlarda boş
// şerit bırakırdı — kaynaktaki görüntü bu değil.
//
// Desen dokunuşu ENGELLEMEZ (kaynakta pointerEvents="none"): burada
// `IgnorePointer` ile karşılanır.

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

// DESEN ARTIK TEMAYI DİNLER (kullanıcı isteği, 2026-08-12).
//
// Kaynakta dördü de sabitti: saha çizgileri ve X marka laciverdi (11,27,58),
// O marka kırmızısı (226,27,45). Opaklıklar KAYNAKTAKİ değerlerdir, değişmedi
// — yalnız hangi rengin soluklaştığı değişti.
//
// ÇİZGİ VE X NEDEN `text`, `primary` DEĞİL: bu bir doku, vurgu değil. `text`
// zeminin karşı ucundadır (açık temada koyu, koyu temada açık), yani desen
// HER temada görünür kalır. `primary` kullansaydık Beşiktaş gibi koyu bir
// temada koyu desen koyu zeminde kaybolurdu.
//
// O NEDEN `accent`: kaynakta da ikinci renkti. Kullanıcının "iki ana renk
// dengeli kullanılsın" isteği burada da geçerli — desen tek renge inmemeli.
Color get _kLine => AppColors.text.withValues(alpha: 0.09);
Color get _kLineSoft => AppColors.text.withValues(alpha: 0.06);
Color get _kX => AppColors.text.withValues(alpha: 0.22);
Color get _kO => AppColors.accent.withValues(alpha: 0.22);

class ScreenBackdrop extends StatefulWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  ScreenBackdrop({super.key, required this.child, this.animated = true});

  final Widget child;
  final bool animated;

  @override
  State<ScreenBackdrop> createState() => _ScreenBackdropState();
}

class _ScreenBackdropState extends State<ScreenBackdrop>
    with SingleTickerProviderStateMixin {
  // Kaynakta sequence(3000 ms → 0.5, 3000 ms → 1) döngüsü; Flutter'da tek
  // denetleyici `reverse` ile aynı gidiş-dönüşü verir.
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3000),
    value: 1,
    lowerBound: 0.5,
    upperBound: 1,
  );

  @override
  void initState() {
    super.initState();
    if (widget.animated) _c.repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: AppColors.bg,
    child: Stack(
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(painter: const _SahaBoyaci()),
          ),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: widget.animated
                ? AnimatedBuilder(
                    animation: _c,
                    builder: (_, _) => Opacity(
                      opacity: _c.value,
                      child: const CustomPaint(painter: _IsaretBoyaci()),
                    ),
                  )
                : const CustomPaint(painter: _IsaretBoyaci()),
          ),
        ),
        widget.child,
      ],
    ),
  );
}

/// viewBox 0 0 360 720 → tuval dönüşümü ("slice": kaplayacak kadar büyüt,
/// ortala, taşanı kırp).
void _viewBox(Canvas canvas, Size size) {
  const w = 360.0, h = 720.0;
  final k = (size.width / w) > (size.height / h)
      ? size.width / w
      : size.height / h;
  canvas.clipRect(Offset.zero & size);
  canvas.translate((size.width - w * k) / 2, (size.height - h * k) / 2);
  canvas.scale(k);
}

class _SahaBoyaci extends CustomPainter {
  const _SahaBoyaci();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    _viewBox(canvas, size);

    // Üst parıltı: merkez %50/%10, yarıçap %65 — primary rengin %10'undan
    // saydama.
    final glow = Paint()
      ..shader = RadialGradient(
        center: const Alignment(0, -0.8), // cx 50%, cy 10%
        radius: 0.65 * 2, // SVG r yüzdesi çapa göre; Flutter yarıçapa göre
        colors: [
          AppColors.primary.withValues(alpha: 0.10),
          AppColors.primary.withValues(alpha: 0),
        ],
      ).createShader(const Rect.fromLTWH(0, 0, 360, 720));
    canvas.drawRect(const Rect.fromLTWH(0, 0, 360, 720), glow);

    final cizgi = Paint()
      ..color = _kLine
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final soluk = Paint()
      ..color = _kLineSoft
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    // Saha dış çizgisi
    canvas.drawRect(const Rect.fromLTWH(24, 40, 312, 640), cizgi);
    // Orta çizgi + orta yuvarlak + nokta
    canvas.drawLine(const Offset(24, 360), const Offset(336, 360), cizgi);
    canvas.drawCircle(const Offset(180, 360), 52, cizgi);
    canvas.drawCircle(const Offset(180, 360), 3, Paint()..color = _kLine);
    // Üst ceza sahası + kale kutusu
    canvas.drawRect(const Rect.fromLTWH(92, 40, 176, 92), cizgi);
    canvas.drawRect(const Rect.fromLTWH(136, 40, 88, 36), soluk);
    // Alt ceza sahası + kale kutusu
    canvas.drawRect(const Rect.fromLTWH(92, 588, 176, 92), cizgi);
    canvas.drawRect(const Rect.fromLTWH(136, 644, 88, 36), soluk);

    canvas.restore();
  }

  @override
  bool shouldRepaint(_SahaBoyaci old) => false;
}

class _IsaretBoyaci extends CustomPainter {
  const _IsaretBoyaci();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    _viewBox(canvas, size);

    final x = Paint()
      ..color = _kX
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    final o = Paint()
      ..color = _kO
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;

    void carpi(double cx, double cy, [double s = 10]) {
      canvas.drawLine(Offset(cx - s, cy - s), Offset(cx + s, cy + s), x);
      canvas.drawLine(Offset(cx - s, cy + s), Offset(cx + s, cy - s), x);
    }

    carpi(100, 250);
    canvas.drawCircle(const Offset(250, 220), 10, o);
    carpi(240, 500);
    canvas.drawCircle(const Offset(110, 540), 10, o);

    canvas.restore();
  }

  @override
  bool shouldRepaint(_IsaretBoyaci old) => false;
}
