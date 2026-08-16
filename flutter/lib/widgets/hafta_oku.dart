// HAFTA GEZİNME OKU — TEK TANIM.
//
// Uygulamada üç ayrı yerde hafta/dönem gezinme oku vardı ve üçü de AYRI
// yazılmıştı: bülten başlığı (40 px · `cardAlt` · `text`), Haftalık Başarı
// hafta seçici (40 px · `darkCardSoft` · `onDark`) ve Kupon Merkezi (36 px ·
// `cardAlt` · `text`). Aynı işi yapan düğmeler farklı boyut ve farklı renk
// tokenleriyle çiziliyordu.
//
// Ayrıca hepsi ÇERÇEVESİZDİ. Kartlar kırmızıya alınınca yuvarlağın tonu kartın
// kırmızısına çok yaklaştı ve düğmeler kartın içinde eriyip kayboldu
// (kullanıcı bildirdi, 16 Ağustos 2026).
//
// Artık tek bileşen: yuvarlak SARI (`primary`) çerçeveyle kendi kartından
// ayrılır. Tek tanım olduğu için bir daha ayrışamazlar.
//
// PASİF DURUM: gidilecek hafta yoksa düğme soluklaşır ve dokunma kapanır —
// "tıkladım ama bir şey olmadı" durumu oluşmaz.

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

/// Hafta/dönem gezinme oku. [ileri] false ise sol (‹), true ise sağ (›).
class HaftaOku extends StatelessWidget {
  // `const` DEĞİL — BİLEREK: renkleri `AppColors` küresellerinden okuyor ve
  // tema çalışma zamanında değişiyor. `const` yapıcı örneği sabitler; Flutter
  // aynı örneği görünce alt ağacı yeniden kurmaz ve düğme eski renkte donar.
  // ignore: prefer_const_constructors_in_immutables
  HaftaOku({
    super.key,
    required this.ileri,
    required this.acik,
    required this.etiket,
    required this.onTap,
  });

  final bool ileri;
  final bool acik;
  final String etiket;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: acik ? 1 : 0.3,
    child: Semantics(
      button: true,
      label: etiket,
      child: GestureDetector(
        onTap: acik ? onTap : null,
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.cardAlt,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.primary, width: 1.5),
          ),
          child: Text(
            ileri ? '›' : '‹',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 24,
              height: 26 / 24,
              fontWeight: AppFont.black,
            ),
          ),
        ),
      ),
    ),
  );
}
