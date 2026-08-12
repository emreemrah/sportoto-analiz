// KAYNAK: app/src/components.js → FormStrip
//         app/src/components/VenueFormStrip.js → VenueFormStrip / VenueIcon
//
// İki şerit de "son 5 maç"ı gösterir. Fark: VenueFormStrip iç saha/deplasman
// bilgisini de taşır (ev/uçak ikonu). Detay yoksa şerit ÇİZİLMEZ ve çağıran
// harfli şeride düşer — iç saha/deplasman bilgisi olmadan ev/uçak ikonu seçmek
// UYDURMAK olurdu.

import 'package:flutter/material.dart';

import '../core/theme/takim_paleti.dart' show okunurMetin;
import '../core/theme/tokens.dart';

const Map<String, Color> _formColor = {
  'G': AppColors.green,
  'B': AppColors.yellow,
  'M': AppColors.red,
};

/// `components.js` → `FormStrip` (harfli renkli kareler)
class FormStrip extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  FormStrip({super.key, required this.form, this.size = 18});

  final List? form;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (form == null || form!.isEmpty) {
      return Text(
        '–',
        style: TextStyle(color: AppColors.textMuted, fontSize: 12),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < form!.length; i++) ...[
          if (i > 0) const SizedBox(width: 2),
          Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _formColor['${form![i]}'] ?? AppColors.gray,
              borderRadius: BorderRadius.circular(3),
            ),
            child: Text(
              '${form![i]}',
              // Zeminden hesaplanır: sarı "B" kutusunda sabit beyaz
              // okunmuyordu (kontrast 2.1).
              style: TextStyle(
                color: okunurMetin(_formColor['${form![i]}'] ?? AppColors.gray),
                fontWeight: AppFont.black,
                fontSize: size * 0.58,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Tek maç ikonu: ev/uçak + sonuç rengi. Bilinmeyen sonuç → beraberlik ikonu.
class VenueIcon extends StatelessWidget {
  const VenueIcon({
    super.key,
    required this.result,
    required this.isHome,
    this.size = 22,
  });

  final String? result;
  final bool isHome;
  final double size;

  static const Map<bool, Map<String, String>> _ikon = {
    true: {
      'G': 'assets/venue/home-win.png',
      'M': 'assets/venue/home-loss.png',
      'B': 'assets/venue/home-draw.png',
    },
    false: {
      'G': 'assets/venue/away-win.png',
      'M': 'assets/venue/away-loss.png',
      'B': 'assets/venue/away-draw.png',
    },
  };

  @override
  Widget build(BuildContext context) {
    final set = _ikon[isHome]!;
    final src = set[result] ?? set['B']!;
    return Image.asset(src, width: size, height: size, fit: BoxFit.contain);
  }
}

/// `VenueFormStrip.js` → varsayılan dışa aktarım.
///
/// [detail]   last5detail dizisi (en YENİ maç başta gelir)
/// [eskiOnce] true → eski maçtan yeniye doğru dizilir (maç detayı böyle)
/// [sag]      true → sağa yaslanır (bülten kartında deplasman tarafı)
class VenueFormStrip extends StatelessWidget {
  const VenueFormStrip({
    super.key,
    required this.detail,
    this.size = 16,
    this.eskiOnce = false,
    this.sag = false,
    this.limit,
  });

  final List? detail;
  final double size;
  final bool eskiOnce;
  final bool sag;
  final int? limit;

  @override
  Widget build(BuildContext context) {
    final ham = detail ?? const [];
    if (ham.isEmpty) return const SizedBox.shrink(); // veri yoksa uydurulmaz

    final kesit = limit != null && limit! < ham.length
        ? ham.sublist(0, limit!)
        : ham;
    final dizi = eskiOnce ? kesit.reversed.toList() : kesit;

    // TAŞMA KORUMASI: şerit, dar ekranda satırı zorlamak yerine kendi kutusunda
    // küçülsün. Kaynakta flexShrink:1 + minWidth:0 + overflow:hidden vardı.
    return ClipRect(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: sag
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        children: [
          for (var i = 0; i < dizi.length; i++) ...[
            if (i > 0) const SizedBox(width: 3),
            VenueIcon(
              result: (dizi[i] as Map)['result'] as String?,
              isHome: (dizi[i] as Map)['isHome'] == true,
              size: size,
            ),
          ],
        ],
      ),
    );
  }
}
