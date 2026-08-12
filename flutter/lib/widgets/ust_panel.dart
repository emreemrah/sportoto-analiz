// EKRANIN EN ÜSTÜNDEKİ GENİŞ BAŞLIK/FİLTRE PANELİ
// (kullanıcı isteği, 2026-08-12)
//
// NE: Radar, Bülten, Kupon ve maç detayı gibi ekranların tepesindeki geniş
// blok — başlık, sezon/hafta seçimi, sekmeler ve filtreler.
//
// ═══════════ MAÇ KARTIYLA AYNI GÖRÜNÜM ════════════════════════════════════
// Kullanıcı isteği (ikinci tur): "Üst başlık alanları keskin köşeli veya
// ekran kenarına yapışık düz bloklar olarak görünmesin. Maç kartlarındaki
// gibi dört köşesi yumuşak biçimde oval, ince kenarlıklı ve arka plandan
// ayrışan bağımsız kart/panel görünümünde olsun."
//
// Reçete `LiveMatchCard`tan BİREBİR alındı — ayrı sayı yazılsaydı ikisi
// zamanla birbirinden kayardı:
//   yarıçap  AppRadius.lgR       kenarlık  Border.all(AppColors.border)
//   gölge    AppShadow.soft      yüzey     surface @ %86 saydamlık
//
// YÜZEY YARI SAYDAM: maç kartlarındaki gerekçenin aynısı — zemindeki takım
// filigranı kartların ARDINDAN hafifçe görünsün.
//
// KENAR BOŞLUĞU: yatayda `Spacing.md`, yani liste kartlarının aldığı yastığın
// aynısı. Panel böylece ekran kenarına yapışmaz, kartlarla aynı hizada durur.
//
// KIRPMA BİLEREK AÇIK (`Clip.antiAlias`): panelin İÇİNDE kendi zeminini çizen
// bloklar var (sekme şeridi `bgAlt`). Kırpma olmadan o zemin köşelerde kareyi
// geri getiriyor ve yuvarlaklık görünmüyordu. İçerideki yazı ve çipler yatay
// boşluk içinde durduğu için kırpma onlara DEĞMEZ.
//
// KENARLIK TEK PARÇA: `BoxDecoration`, `borderRadius` ile birlikte YALNIZ tek
// biçimli kenarlık kabul eder; "yalnız alt kenar" veren `Border(bottom: …)`
// ile birlikte assert atar. Panellerin eski alt çizgisi bu yüzden kenarlığa
// dönüştü.
//
// ═══════════ KENARLIK `foregroundDecoration`DA — SEBEBİ ÖLÇÜLDÜ ═══════════
// `Container` sırayla şunu yapar: önce `decoration`ı (dolgu + kenarlık) çizer,
// SONRA çocuğu yuvarlak dikdörtgene kırpıp üstüne çizer. Çocuk kendi zeminini
// tam alana boyadığında kenarlığın iç yarısını ÖRTER; düz kenarda fark
// edilmez ama KAVİSTE kenarlık tamamen kaybolur ve köşe "çapraz kesilmiş"
// gibi görünür — kullanıcının tarifi buydu, ekran görüntüsü 8× büyütülerek
// doğrulandı (düz kenarda çizgi var, yayda yok).
//
// `foregroundDecoration` çocuktan SONRA çizilir; kenarlık artık kavsi kesintisiz
// takip eder.

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
    margin: const EdgeInsets.fromLTRB(
      Spacing.md,
      Spacing.sm,
      Spacing.md,
      Spacing.sm,
    ),
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: (renk ?? AppColors.surface).withValues(alpha: 0.86),
      borderRadius: AppRadius.lgR,
      boxShadow: AppShadow.soft,
    ),
    // ÇOCUKTAN SONRA çizilir → kenarlık kavsi kesintisiz takip eder.
    foregroundDecoration: BoxDecoration(
      borderRadius: AppRadius.lgR,
      border: Border.all(color: AppColors.border),
    ),
    child: child,
  );
}
