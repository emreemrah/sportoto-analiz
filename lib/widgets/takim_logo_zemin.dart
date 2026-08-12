// KAYNAK: app/src/components/TakimLogoZemin.js — BİREBİR çeviri.
//
// TAKIM LOGOSU ZEMİN FİLİGRANI — favori takımın arması, ekranın arkasında
// büyük ve çok soluk (kullanıcı isteği, 2026-08-04).
// ---------------------------------------------------------------------------
// Arma, takım kataloğundan ada göre bulunur (ProfileScreen ile aynı kural:
// eşleşme yoksa HİÇBİR görsel konmaz — başka kulübün arması yasak).
// Katalog isteği modül içinde TEK KEZ yapılır; her ekran tekrar sormaz.
// Dokunuşu YEMEZ.
//
// TEMAYA UYUM (kullanıcı isteği, 2026-08-12): filigran artık armanın kendi
// renklerinde değil, TEK RENK silüet olarak çizilir ve o renk temanın metin
// renginden gelir — koyu temada açık, açık temada koyu. Gerekçesi ölçülebilir:
// arma kendi renklerinde kaldığında sarı bir arma sarı zeminde kayboluyor,
// koyu bir arma koyu zeminde leke bırakıyordu. Opaklık da temaya göre ayrılır;
// koyu zeminde açık bir silüet aynı sayıda daha çok göze çarpar.

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/auth.dart';
import '../core/network/api_client.dart';
import '../core/theme/takim_paleti.dart';
import '../core/theme/tokens.dart';
import '../core/utils.dart';

/// Gövdeyi filigranın ÜSTÜNE koyar.
///
/// Kullanımı `Scaffold(body: filigranli(SafeArea(...)))` — filigran Scaffold'un
/// zemininin üstünde, içeriğin ALTINDA durur. Ekranların kendi `Scaffold`ları
/// opak zemin çizdiği için filigranı kabuğa bir kez koymak İŞE YARAMAZ; bu
/// yüzden her ana ekran gövdesini bu sarmalayıcıdan geçirir.
Widget filigranli(Widget govde) => Stack(children: [TakimLogoZemin(), govde]);

/// Tek uçuş: tüm ekranlar aynı sözü paylaşır (kaynaktaki `katalogSoz`).
Future<dynamic>? _katalogSoz;

Future<dynamic> _katalog() {
  // Hata durumunda söz SIFIRLANIR ki bir sonraki deneme yeniden istesin;
  // aksi hâlde tek bir ağ hatası uygulama ömrü boyunca filigranı öldürürdü.
  return _katalogSoz ??= api.favoriteTeams().catchError((Object e) {
    _katalogSoz = null;
    throw e;
  });
}

/// Takım adı → ARMA ADRESİ. Bulunamazsa `null`.
///
/// EŞLEŞME YOKSA NULL DÖNER; "benzeri" bir arma ASLA seçilmez — başka
/// kulübün armasını göstermek, olmayan bir armayı göstermemekten kötüdür.
///
/// TEK KAYNAK (2026-08-12): filigran, yan panel ve profil ekranı bu aynı
/// işlevi çağırır. Katalog isteği modül içinde TEK KEZ yapılır
/// (`_katalogSoz`), bu yüzden ikinci ve sonraki çağrılar AĞA ÇIKMAZ —
/// panelin armayı göstermesinin ek bir isteği yoktur.
Future<String?> takimArmasiBul(String ad) async {
  if (ad.isEmpty) return null;
  try {
    final d = await _katalog();
    final kucuk = kucukTr(ad);
    for (final lig in ((d as Map)['leagues'] as List?) ?? const []) {
      for (final t in ((lig as Map)['teams'] as List?) ?? const []) {
        final tm = t as Map;
        if (kucukTr('${tm['name']}') == kucuk ||
            kucukTr('${tm['cleanName'] ?? ''}') == kucuk) {
          final img = tm['image'];
          return (img is String && img.isNotEmpty) ? img : null;
        }
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

class TakimLogoZemin extends StatefulWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  TakimLogoZemin({super.key, this.acikSiluet});

  /// Silüet açık renk mi olsun?
  ///
  /// `null` (varsayılan) = temanın zemininden karar ver. Yan panel gibi KENDİ
  /// koyu zeminini çizen yüzeyler bunu açıkça `true` verir: orada temanın
  /// zeminine bakmak, açık temada koyu bir silüeti koyu panele koymak olurdu.
  final bool? acikSiluet;

  @override
  State<TakimLogoZemin> createState() => _TakimLogoZeminState();
}

class _TakimLogoZeminState extends State<TakimLogoZemin> {
  String? _logo;
  String? _sonAd;

  Future<void> _bul(String ad) async {
    final img = await takimArmasiBul(ad);
    if (mounted) setState(() => _logo = img);
  }

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<AuthState>(
    valueListenable: authState,
    builder: (context, s, _) {
      final ad = '${s.user?['favorite_team'] ?? ''}';
      if (_sonAd != ad) {
        _sonAd = ad;
        WidgetsBinding.instance.addPostFrameCallback((_) => _bul(ad));
      }
      if (_logo == null) return const SizedBox.shrink();
      return Positioned.fill(
        child: IgnorePointer(
          child: LayoutBuilder(
            builder: (context, c) {
              // Boyut serüveni: 320px sabit → ekran boyu (%100) → iki tık
              // küçültüldü (%70, kullanıcı isteği 2026-08-06). Ortalanmış
              // durur, oranı bozulmaz.
              // Koyu tema mı? Zeminin parlaklığından okunur — palet iki
              // eksene oturduğu için ara değer YOKTUR (bkz. takim_paleti).
              final koyuTema =
                  widget.acikSiluet ??
                  (gorecelParlaklik(AppColors.background) < 0.3);
              final siluet = koyuTema
                  ? const Color(0xFFFFFFFF)
                  : const Color(0xFF000000);

              return Stack(
                children: [
                  Positioned(
                    top: c.maxHeight * 0.15,
                    left: c.maxWidth * 0.15,
                    width: c.maxWidth * 0.70,
                    height: c.maxHeight * 0.70,
                    child: Opacity(
                      // Koyu zeminde açık silüet daha çok göze çarpar; aynı
                      // sayı iki temada aynı "soluk" hissi VERMEZ.
                      opacity: koyuTema ? 0.085 : 0.06,
                      child: ColorFiltered(
                        // srcATop: alfa korunur, renk değişir → armanın
                        // silüeti tek renge boyanır, kenarları yumuşak kalır.
                        colorFilter: ColorFilter.mode(
                          siluet,
                          BlendMode.srcATop,
                        ),
                        child: CachedNetworkImage(
                          imageUrl: _logo!,
                          fit: BoxFit.contain,
                          errorWidget: (_, _, _) => const SizedBox.shrink(),
                          placeholder: (_, _) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      );
    },
  );
}
