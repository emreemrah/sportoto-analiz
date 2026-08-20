// KAYNAK: app/src/components/BallLoader.js + LoadingState.js + ErrorState.js
// BİREBİR çeviri.
//
// Kaynakta üç ayrı dosyaydı; burada tek dosyada durur çünkü üçü de aynı işin
// parçası (bekleme / hata durumu) ve Dart'ta dosya başına bir sınıf kuralı yok.

import 'dart:async';

import 'package:flutter/material.dart';

import '../core/network/api_client.dart' show ApiException;
import '../core/theme/tokens.dart';

/// Sürekli dönen futbol topu — spinner yerine.
///
/// Kaynakta `react-native-svg` ile çizilmişti; Flutter'da aynı 48×48 viewBox
/// koordinatları `CustomPainter` ile birebir çizilir. Süre 1200 ms, doğrusal.
class BallLoader extends StatefulWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  BallLoader({super.key, this.size = 44, this.color});

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
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  LoadingState({super.key, this.message = 'Yükleniyor…'});

  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(Spacing.xxl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BallLoader(size: 44),
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
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  ErrorState({
    super.key,
    this.message,
    this.onRetry,
    this.icon = Icons.error_outline,
    this.title = 'Bir şeyler ters gitti',
  });

  final String? message;
  final VoidCallback? onRetry;

  /// VEKTÖR ikon, emoji DEĞİL (kullanıcı isteği, 2026-08-12) — emojinin rengi
  /// tema ile değişmiyordu.
  final IconData icon;
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
        // HATA İKONU ANLAMSAL RENKTE: `danger` takımdan bağımsızdır, koyu
        // temada da kırmızıdır — hata her temada hata gibi görünür.
        Icon(icon, size: 38, color: AppColors.danger),
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
                // `onPrimary`: butonun KENDİ zemininden hesaplanan yazı
                // rengi. Eskiden sayfa zemini (`bg`) yazılıyordu; ters
                // kontrast düzeninde zemin ile buton aynı aileden olduğu
                // için yazı kayboldu (ölçüldü: Trabzonspor teması).
                style: TextStyle(
                  color: AppColors.onPrimary,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

/// SUNUCU HAZIRLANIYOR — hata DEĞİL, bekleme durumu (16 Ağustos 2026).
///
/// NEDEN AYRI BİR DURUM: barındırma planı boşta kalınca servisi uyutuyor.
/// Uyanan servis bülteni hazırlayana kadar `/api/bulletin` **503** ve
/// gövdesinde "Veri henüz hazır değil" dönüyor. Ölçüldü (iki ayrı gözlem):
/// toparlanma **61 sn** ve ~90 sn. Bu pencerede ekran genel hata kartı
/// gösteriyordu ("Bir şeyler ters gitti" + ham DioException metni) — oysa
/// ters giden bir şey yok, veri hazırlanıyor. Kullanıcı bunu arıza sanıyordu.
///
/// DÜRÜSTLÜK: sunucunun KENDİ söylediği şey yazılır; "birazdan gelecek" diye
/// söz verilmez, tahmini süre "genelde" diye verilir. Veri varmış gibi
/// gösterilmez — sayı uydurulmaz.
class HazirlaniyorState extends StatefulWidget {
  // `const` DEĞİL — tema çalışma zamanında değişiyor (bkz. diğer durumlar).
  // ignore: prefer_const_constructors_in_immutables
  HazirlaniyorState({super.key, this.onRetry, this.otomatikYenileme = true});

  final VoidCallback? onRetry;

  /// Ekran kendiliğinden tekrar deniyorsa kullanıcıya söylenir — boşuna
  /// beklemesin ya da gereksiz yere düğmeye basmasın.
  ///
  /// SÖZÜNÜ KENDİSİ TUTAR (2026-08-21): bu bayrak açıkken widget 15 sn'de bir
  /// [onRetry] çağırır. Eskiden söz ekrana bırakılıyordu; ana sayfada
  /// zamanlayıcı olmadığı için bayrak kapatılmıştı ve soğuk açılışta kullanıcı
  /// elle basmazsa uygulama SONSUZA DEK bu ekranda kalıyordu ("sunucuya bir
  /// daha bağlanmadı" bildirimi, 21 Ağustos). Sunucu toparlanınca sağlayıcı
  /// veri döndürür ve bu widget ağaçtan düşer — zamanlayıcı da onunla ölür.
  final bool otomatikYenileme;

  @override
  State<HazirlaniyorState> createState() => _HazirlaniyorStateState();
}

class _HazirlaniyorStateState extends State<HazirlaniyorState> {
  Timer? _zamanlayici;

  @override
  void initState() {
    super.initState();
    _zamanlayiciKur();
  }

  /// Aynı konumdaki widget yeni yapılandırmayla güncellenirse `initState`
  /// TEKRAR ÇALIŞMAZ — zamanlayıcı burada hizalanmazsa bayrak kapatılsa bile
  /// eski zamanlayıcı yaşar ve YENİ onRetry'ı çağırırdı (testte yakalandı).
  /// Kıyas null'lık üzerinden: onRetry her build'de yeni closure'dır; kimlik
  /// kıyası zamanlayıcıyı her build'de sıfırlar ve hiç ateşlenmezdi.
  @override
  void didUpdateWidget(HazirlaniyorState eski) {
    super.didUpdateWidget(eski);
    if (eski.otomatikYenileme != widget.otomatikYenileme ||
        (eski.onRetry == null) != (widget.onRetry == null)) {
      _zamanlayiciKur();
    }
  }

  void _zamanlayiciKur() {
    _zamanlayici?.cancel();
    _zamanlayici = null;
    if (widget.otomatikYenileme && widget.onRetry != null) {
      // 15 sn: bülten ekranının canlı yenileme aralığıyla aynı tempo.
      // Soğuk açılış ölçümü 61–90 sn → toparlanma en geç ~15 sn gecikmeyle
      // yakalanır; 503 cevabı ucuzdur (sunucu yalnız cache var mı diye bakar).
      // Çağrı anında GÜNCEL widget'ın onRetry'ı okunur (closure tazelenir).
      _zamanlayici = Timer.periodic(const Duration(seconds: 15), (_) {
        if (mounted) widget.onRetry!();
      });
    }
  }

  @override
  void dispose() {
    _zamanlayici?.cancel();
    super.dispose();
  }

  VoidCallback? get onRetry => widget.onRetry;
  bool get otomatikYenileme => widget.otomatikYenileme;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(Spacing.xxl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BallLoader(size: 44),
          const SizedBox(height: Spacing.lg),
          Text(
            'Sunucu uyanıyor',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 15,
              fontWeight: AppFont.heavy,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            otomatikYenileme
                ? 'Bülten hazırlanıyor — genelde bir dakika sürer. '
                      'Ekran kendiliğinden yenilenecek, bir şey yapmana '
                      'gerek yok.'
                : 'Bülten hazırlanıyor — genelde bir dakika sürer.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.4,
              color: AppColors.textMuted,
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: Spacing.lg),
            GestureDetector(
              onTap: onRetry,
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  borderRadius: AppRadius.smR,
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  'Şimdi dene',
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 13,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

/// Hata, "sunucu henüz hazır değil" durumu mu?
///
/// Backend bu durumda **503** + gövdede kendi açıklaması ile yanıtlar
/// (`server.js`: "Veri henüz hazır değil, birkaç saniye sonra tekrar dene").
/// Başka hiçbir 5xx bu şekilde yorumlanmaz — gerçek arıza gizlenmez.
///
/// ZAMAN AŞIMI DA BU DURUMDUR (2026-08-21, telefonda ölçüldü): soğuk açılışın
/// İLK evresinde vekil isteği tutar, örnek ayağa kalkana dek HTTP yanıtı hiç
/// gelmez ve istek zaman aşımıyla ölür — 503 evresi ancak ondan sonra başlar.
/// O pencerede ham hata basmak kullanıcıya "sunucuya bir daha bağlanmadı"
/// dedirtiyordu. Bağlantının hiç KURULAMAMASI ise bu duruma sayılmaz — orada
/// sorun büyük olasılıkla telefonun kendi bağlantısıdır ve gerçek hata yazılır.
bool sunucuHazirlaniyor(Object? hata) =>
    hata is ApiException && (hata.status == 503 || hata.zamanAsimi);
