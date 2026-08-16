// KAYNAK: app/src/components/LigSeridi.js — BİREBİR çeviri.
//
// ANA SAYFA ÜLKE ŞERİDİ — bu haftanın bültenindeki ÜLKELER: bayrak + ad,
// soldan sağa kayan tek satır.
//
// Eskiden lig logosu + lig adı gösteriyordu; kullanıcı isteğiyle (2026-08-04)
// ülke bayrağı + BÜYÜK HARF ülke adına çevrildi. Ülke çıkarma mantığı saf
// modülde: core/ulke_seridi.dart (ayrıca test edilir).
//
// BAYRAK YOKSA: uydurma URL kurulmaz. "Kulüp" (kapsam dışı maçlar) ve
// tanınmayan ülkeler nötr ⚽ simgesiyle görünür — bu bir hata değil.

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../core/ulke_seridi.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/kayan_serit.dart';

class LigSeridi extends StatelessWidget {
  const LigSeridi({super.key, required this.matches});

  final List? matches;

  /// Türkçe büyük harf (Dart'ın toUpperCase()'i 'i' → 'I' yapar).
  static String _buyukTr(String s) =>
      s.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();

  @override
  Widget build(BuildContext context) {
    final ulkeler = ulkeListesi(matches);

    // Ülke yoksa boş bir çubuk çizilmez — bülten gelmeden şerit hiç görünmez.
    if (ulkeler.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: Spacing.md),
      child: KayanSerit(
        // YATAY BOŞLUK YOK — BİLEREK (16 Ağustos 2026'da ölçüldü).
        //
        // `KayanSerit` kendini sürekli kaydıran bir şerittir: içeriğin İKİ
        // kopyasını yan yana koyar ve bir kopya genişliği kadar kayınca başa
        // döner. `_kopyaGenislik` YALNIZ kopyanın genişliğini ölçer; şeridin
        // `padding`'i bunun dışındadır. Yatay boşluk verilirse başa dönüşte
        // ekranın solunda boşluk kadar bir SIÇRAMA oluşur — dikişsiz döngü
        // bozulur. Ekran görüntüsünde ilk çipin kesik görünmesi kusur değil,
        // hareketin bir anıdır.
        padding: const EdgeInsets.symmetric(vertical: 8),
        semanticsLabel:
            'Bu haftanın ülkeleri: ${ulkeler.map((u) => u.name).join(', ')}',
        children: [for (final u in ulkeler) _UlkeRozeti(ulke: u)],
      ),
    );
  }
}

class _UlkeRozeti extends StatelessWidget {
  const _UlkeRozeti({required this.ulke});

  final UlkeSatiri ulke;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(right: 8),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: AppColors.cardAlt,
      borderRadius: AppRadius.mdR,
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (ulke.code.isNotEmpty)
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: CachedNetworkImage(
              imageUrl: 'https://flagcdn.com/48x36/${ulke.code}.png',
              width: 22,
              height: 16,
              fit: BoxFit.cover,
              errorWidget: (_, _, _) => const SizedBox(width: 22, height: 16),
              placeholder: (_, _) => const SizedBox(width: 22, height: 16),
            ),
          )
        else
          // Bayrak yoksa uydurma URL kurulmaz — nötr ⚽.
          //
          // `name` BİLEREK VERİLMEZ: `Logo` artık ad verilince BAŞ HARF rozeti
          // çiziyor (armasız kulüpler için). Burada satırın öznesi kulüp değil
          // ÜLKEDİR; "KU" gibi bir ülke kısaltması uydurmak yanlış olurdu.
          Logo(size: 20),
        const SizedBox(width: 7),
        Text(
          LigSeridi._buyukTr(ulke.name),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 11.5,
            fontWeight: AppFont.black,
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(width: 6),
        // Maç sayısı rozeti (kullanıcı isteği, 2026-08-04).
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: AppRadius.pillR,
          ),
          child: Text(
            '${ulke.count}',
            style: TextStyle(
              color: AppColors.textSoft,
              fontSize: 10.5,
              fontWeight: AppFont.black,
            ),
          ),
        ),
      ],
    ),
  );
}
