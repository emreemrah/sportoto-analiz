// EKRANIN EN ÜSTÜNDEKİ GENİŞ BAŞLIK/FİLTRE PANELİ
// (kullanıcı isteği, 2026-08-12)
//
// NE: Radar, Bülten, Kupon ve Profil gibi ekranların tepesindeki geniş blok.
// Eskiden keskin bir dikdörtgendi ve altında saç teli bir çizgi vardı;
// kullanıcı "keskin dikdörtgen bir blok gibi görünmesin, alt köşeler oval
// olsun" dedi.
//
// ÜST KENAR EKRANIN DOĞAL SINIRINDA KALIR: yalnız ALT iki köşe yuvarlanır
// (`AppRadius.ustPanelR`). Panel yukarıda ekranın kenarına dayandığı için üst
// köşeleri yuvarlamak boşlukta yüzen bir kutu hissi verirdi.
//
// KIRPMA BİLEREK AÇIK (`Clip.antiAlias`): panelin İÇİNDE kendi zeminini çizen
// bloklar var (sekme şeridi `bgAlt` ile dolu). Kırpma olmadan o zemin alt
// köşelerde kareyi geri getiriyor ve yuvarlaklık görünmüyordu. İçerideki
// yazı ve çipler yatay boşluk (padding) içinde durduğu için kırpma onlara
// DEĞMEZ — yalnız blok zeminleri köşede eğrilir.
//
// KENARLIK TEK PARÇA: `BoxDecoration`, `borderRadius` ile birlikte YALNIZ
// tek renkli/tek biçimli kenarlık kabul eder; "yalnız alt kenar" veren
// `Border(bottom: …)` ile `borderRadius` birlikte kullanılamaz (assert).
// Bu yüzden panelin kendi alt çizgisi kenarlığa dönüştü.

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

class UstPanel extends StatelessWidget {
  // `const` DEĞİL — BİLEREK: rengini `AppColors` küresellerinden okuyor ve
  // tema çalışma zamanında değişiyor. `const` yapıcı widget örneğini
  // sabitler; Flutter aynı örneği görünce alt ağacı yeniden kurmaz ve panel
  // eski renkte donar.
  // ignore: prefer_const_constructors_in_immutables
  UstPanel({super.key, required this.child, this.renk});

  final Widget child;

  /// Panel zemini. Verilmezse kart yüzeyi kullanılır — açık, koyu ve takım
  /// temalarında aynı token okunduğu için görünüm tutarlı kalır.
  final Color? renk;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: renk ?? AppColors.surface,
      borderRadius: AppRadius.ustPanelR,
      border: Border.all(color: AppColors.border),
    ),
    child: child,
  );
}
