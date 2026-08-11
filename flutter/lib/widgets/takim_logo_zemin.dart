// KAYNAK: app/src/components/TakimLogoZemin.js — BİREBİR çeviri.
//
// TAKIM LOGOSU ZEMİN FİLİGRANI — favori takımın arması, ekranın arkasında
// büyük ve çok soluk (kullanıcı isteği, 2026-08-04).
// ---------------------------------------------------------------------------
// Arma, takım kataloğundan ada göre bulunur (ProfileScreen ile aynı kural:
// eşleşme yoksa HİÇBİR görsel konmaz — başka kulübün arması yasak).
// Katalog isteği modül içinde TEK KEZ yapılır; her ekran tekrar sormaz.
// Opaklık 0.1 — içerik okunur kalır. Dokunuşu YEMEZ.

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/auth.dart';
import '../core/network/api_client.dart';
import '../core/utils.dart';

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

class TakimLogoZemin extends StatefulWidget {
  const TakimLogoZemin({super.key});

  @override
  State<TakimLogoZemin> createState() => _TakimLogoZeminState();
}

class _TakimLogoZeminState extends State<TakimLogoZemin> {
  String? _logo;
  String? _sonAd;

  Future<void> _bul(String ad) async {
    if (ad.isEmpty) {
      if (mounted) setState(() => _logo = null);
      return;
    }
    try {
      final d = await _katalog();
      if (!mounted) return;
      final kucuk = kucukTr(ad);
      for (final lig in ((d as Map)['leagues'] as List?) ?? const []) {
        for (final t in ((lig as Map)['teams'] as List?) ?? const []) {
          final tm = t as Map;
          if (kucukTr('${tm['name']}') == kucuk ||
              kucukTr('${tm['cleanName'] ?? ''}') == kucuk) {
            final img = tm['image'];
            if (img is String && img.isNotEmpty) {
              setState(() => _logo = img);
              return;
            }
          }
        }
      }
      setState(() => _logo = null);
    } catch (_) {
      if (mounted) setState(() => _logo = null);
    }
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
              return Stack(
                children: [
                  Positioned(
                    top: c.maxHeight * 0.15,
                    left: c.maxWidth * 0.15,
                    width: c.maxWidth * 0.70,
                    height: c.maxHeight * 0.70,
                    child: Opacity(
                      opacity: 0.1,
                      child: CachedNetworkImage(
                        imageUrl: _logo!,
                        fit: BoxFit.contain,
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
