// KAYNAK: app/src/components/TakimLogoZemin.js — BİREBİR çeviri.
//
// TAKIM ARMASI ZEMİN FİLİGRANI — FAVORİ TAKIMIN arması, ekranın arkasında
// büyük ve çok soluk. Dokunuşu YEMEZ.
//
// ═══════════ YALNIZ SEÇİLİ TAKIM ═══════════════════════════════════════════
// 2026-08-12 akşamı kısa bir süre KATALOGDAKİ TÜM kulüplerin armasından bir
// mozaik denendi; kullanıcı bunu GERİ ALDIRDI: "hangi takım seçili ise
// sadece o olacak". Filigran tek armadır ve o arma favori takımındır.
// Takım seçilmemişse ya da ad katalogda eşleşmezse HİÇBİR görsel konmaz —
// başka kulübün arması yasak.
//
// ARMA KENDİ RENGİNDE (kullanıcı seçimi, 2026-08-12). Bu, aynı gün alınan
// tek-renk silüet kararının bilinçli olarak geri alınmasıdır. Silüete geçme
// gerekçesi ÖLÇÜLMÜŞ bir sorundu ve hâlâ geçerli: sarı bir arma sarı zeminde
// kaybolur, koyu bir arma koyu zeminde leke bırakır. Kullanıcıya seçim anında
// yazıldı, kendi renkleri tercih edildi. Elimizde kalan tek denge aracı
// OPAKLIK — açık zeminde %6, koyu zeminde %8,5.
//
// Katalog isteği modül içinde TEK KEZ yapılır (`_katalogSoz`); filigran, yan
// panel ve profil ekranı aynı `takimArmasiBul` işlevini çağırır.
//
// GİZLİLİK: adres `crestUrlOf` ile KENDİ SUNUCUMUZUN vekilinden geçer.
// Doğrudan dış adrese giden her görsel isteği kullanıcının IP'sini ve hangi
// ekranı açtığını üçüncü tarafa bildirirdi (bkz. core/crest_url.dart).

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/auth.dart';
import '../core/crest_url.dart';
import '../core/network/api_client.dart';
import '../core/network/api_config.dart';
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
  TakimLogoZemin({super.key, this.koyuZemin});

  /// Üstüne çizildiği yüzey KOYU mu?
  ///
  /// `null` (varsayılan) = temanın zemininden karar ver. Yalnız OPAKLIĞI
  /// etkiler: koyu zeminde aynı sayı daha çok göze çarptığı için iki değer
  /// ayrı ayarlanır. Yan panel gibi KENDİ koyu zeminini çizen yüzeyler bunu
  /// açıkça `true` verir — orada temanın zeminine bakmak yanlış olurdu.
  final bool? koyuZemin;

  @override
  State<TakimLogoZemin> createState() => _TakimLogoZeminState();
}

class _TakimLogoZeminState extends State<TakimLogoZemin> {
  String? _logo;
  String? _sonAd;

  Future<void> _bul(String ad) async {
    final img = await takimArmasiBul(ad);
    if (!mounted) return;
    // Adres VEKİLDEN geçirilir; ham dış adres hiç istenmez.
    final adres = img == null ? null : crestUrlOf(img, apiBase);
    if (adres != _logo) setState(() => _logo = adres);
  }

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<AuthState>(
    valueListenable: authState,
    builder: (context, s, _) {
      // Favori takım DEĞİŞİNCE arma yeniden aranır; yan etki build içinde
      // değil kare sonrasında tetiklenir.
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
              final koyu =
                  widget.koyuZemin ??
                  (gorecelParlaklik(AppColors.background) < 0.3);

              return Stack(
                children: [
                  Positioned(
                    top: c.maxHeight * 0.15,
                    left: c.maxWidth * 0.15,
                    width: c.maxWidth * 0.70,
                    height: c.maxHeight * 0.70,
                    child: Opacity(
                      // Koyu zeminde aynı sayı daha çok göze çarpar; iki tema
                      // aynı "soluk" hissini aynı değerle VERMEZ.
                      opacity: koyu ? 0.085 : 0.06,
                      child: CachedNetworkImage(
                        imageUrl: _logo!,
                        fit: BoxFit.contain,
                        // Yüklenmeyen arma SESSİZCE boş kalır — kırık görsel
                        // ikonu zemine çöp bırakırdı.
                        errorWidget: (_, _, _) => const SizedBox.shrink(),
                        placeholder: (_, _) => const SizedBox.shrink(),
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
