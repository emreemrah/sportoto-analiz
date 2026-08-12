// KAYNAK: app/src/components/TakimLogoZemin.js — BİREBİR çeviri (başlangıç).
//
// TAKIM ARMASI ZEMİN FİLİGRANI — ekranın arkasında, çok soluk, dokunuşu YEMEZ.
//
// ═══════════ BUGÜNKÜ DAVRANIŞ (kullanıcı isteği, 2026-08-12 akşamı) ════════
// "arka planda HER TAKIMIN logosu görünsün" → filigran artık tek bir armayı
// (favori takımı) büyük çizmez; KATALOGDAKİ TÜM KULÜPLERİN armasını bir
// MOZAİK olarak dizer. Desen her ekranda AYNIDIR, ekranın içeriğine bakmaz.
//
// HER TAKIM BİRER KEZ: ızgara, takım sayısına göre hesaplanır (kare-en-boy
// yaklaşımı) — 148 kulüp varsa 148 hücre olur ve hiçbiri elenmez. "Her
// takımın logosu görünsün" isteğinin karşılığı budur; ekrana sığan kadarını
// gösterip gerisini atmak isteği karşılamazdı.
//
// ARMALAR KENDİ RENKLERİNDE (kullanıcı kararı, 2026-08-12). Bu, aynı gün
// alınan silüet kararının BİLİNÇLİ olarak geri alınmasıdır. Silüete geçme
// gerekçesi ölçülmüş bir sorundu ve HÂLÂ GEÇERLİDİR: sarı bir arma sarı
// zeminde kaybolur, koyu bir arma koyu zeminde leke bırakır. Kullanıcıya
// bu söylendi ve kendi renkleri tercih edildi; mozaikte tek bir arma
// kaybolsa bile desenin bütünü okunduğu için etki tek-arma hâlindekinden
// düşük. Elimizde kalan tek denge aracı OPAKLIK.
//
// MALİYET (önden söylendi): ~148 arma indirilir. Üç önlem var —
//   1. Katalog isteği modül içinde TEK KEZ yapılır (`_katalogSoz`).
//   2. Adresler `CachedNetworkImage` ile disk+bellek önbelleğine girer;
//      ikinci ekranda ağ trafiği yoktur.
//   3. `memCacheWidth` hücre genişliğine kısılır — 148 armayı tam boyda
//      çözmek belleği gereksiz şişirirdi.
//
// GİZLİLİK: adresler `crestUrlOf` ile KENDİ SUNUCUMUZUN vekilinden geçer.
// Tek armada bile kural buydu; 148 armayı doğrudan dış konağa sormak
// kullanıcının IP'sini ve hangi ekranı açtığını çok daha fazla ele verirdi.

import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

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

/// KATALOGDAKİ TÜM ARMALAR — vekilden geçmiş adresler, katalog sırasında.
///
/// Sıra KATALOĞUN kendi sırasıdır (rastgele değil): aynı cihazda mozaik her
/// açılışta aynı görünsün, "ekran değişti" hissi vermesin.
/// Aynı adres iki ligde geçerse BİR KEZ alınır.
List<String>? _tumArmalarOnbellek;

Future<List<String>> tumTakimArmalari() async {
  if (_tumArmalarOnbellek != null) return _tumArmalarOnbellek!;
  try {
    final d = await _katalog();
    final gorulen = <String>{};
    final liste = <String>[];
    for (final lig in ((d as Map)['leagues'] as List?) ?? const []) {
      for (final t in ((lig as Map)['teams'] as List?) ?? const []) {
        final img = (t as Map)['image'];
        if (img is! String || img.isEmpty) continue;
        final adres = crestUrlOf(img, apiBase);
        if (adres.isNotEmpty && gorulen.add(adres)) liste.add(adres);
      }
    }
    return _tumArmalarOnbellek = liste;
  } catch (_) {
    // Ağ hatasında ÖNBELLEĞE YAZILMAZ: bir sonraki ekran yeniden dener.
    return const [];
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
  List<String> _armalar = const [];

  @override
  void initState() {
    super.initState();
    tumTakimArmalari().then((v) {
      if (mounted && v.isNotEmpty) setState(() => _armalar = v);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_armalar.isEmpty) return const SizedBox.shrink();

    return Positioned.fill(
      child: IgnorePointer(
        child: LayoutBuilder(
          builder: (context, c) {
            if (c.maxWidth <= 0 || c.maxHeight <= 0) {
              return const SizedBox.shrink();
            }

            // IZGARA: her takıma BİR hücre. Sütun sayısı, hücreler kareye
            // yakın çıksın diye alanın en-boy oranından türetilir:
            //   sütun ≈ √(adet × genişlik / yükseklik)
            // Böylece 148 arma da ekranı doldurur, hiçbiri elenmez.
            final adet = _armalar.length;
            final sutun = math
                .sqrt(adet * c.maxWidth / c.maxHeight)
                .ceil()
                .clamp(1, adet);
            final satir = (adet / sutun).ceil();
            final hucreW = c.maxWidth / sutun;
            final hucreH = c.maxHeight / satir;

            final koyu =
                widget.koyuZemin ??
                (gorecelParlaklik(AppColors.background) < 0.3);

            // Çözünürlük hücre kadar: 148 armayı tam boyda çözmek belleği
            // gereksiz şişirirdi.
            final enPx = (hucreW * MediaQuery.devicePixelRatioOf(context))
                .round();

            return Opacity(
              // Koyu zeminde aynı sayı daha çok göze çarpar; iki tema aynı
              // "soluk" hissini aynı değerle VERMEZ.
              opacity: koyu ? 0.085 : 0.06,
              child: Stack(
                children: [
                  for (var i = 0; i < adet; i++)
                    Positioned(
                      left: (i % sutun) * hucreW,
                      top: (i ~/ sutun) * hucreH,
                      width: hucreW,
                      height: hucreH,
                      child: Padding(
                        // Armalar birbirine değmesin; desen ızgara değil
                        // DOKU gibi okunsun.
                        padding: EdgeInsets.all(
                          math.min(hucreW, hucreH) * 0.12,
                        ),
                        child: CachedNetworkImage(
                          imageUrl: _armalar[i],
                          fit: BoxFit.contain,
                          memCacheWidth: enPx > 0 ? enPx : null,
                          // Yüklenmeyen arma SESSİZCE boş kalır — kırık
                          // görsel ikonu zemine çöp bırakırdı.
                          errorWidget: (_, _, _) => const SizedBox.shrink(),
                          placeholder: (_, _) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
