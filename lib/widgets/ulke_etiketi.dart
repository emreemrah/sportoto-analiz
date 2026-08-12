// KAYNAK: app/src/components/UlkeEtiketi.js — BİREBİR çeviri.
//
// ÜLKE ETİKETİ — maç kartlarında "hangi ülkenin maçı" bilgisi:
// bayrak + BÜYÜK HARF ülke adı (+ istenirse lig kalanı).
//
// DÜRÜSTLÜK: tanınmayan lig adı için ülke UYDURULMAZ — `gizleTanimsiz` açıksa
// hiç çizilmez, değilse lig adı olduğu gibi yazılır.
//
// NOT — DIŞ ADRES: bayraklar kaynakta olduğu gibi doğrudan flagcdn'den gelir
// (kulüp armalarının aksine vekilden GEÇMEZ). Kaynağın davranışı böyle olduğu
// için korundu; değiştirmek çeviri değil, yeni bir karar olurdu. Armalardaki
// gizlilik gerekçesi buraya da uygulanmak istenirse bu ayrı bir iştir ve
// backend tarafında bir bayrak vekili gerektirir.

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';
import '../core/ulke_seridi.dart';
import '../core/utils.dart';

class UlkeEtiketi extends StatelessWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  UlkeEtiketi({
    super.key,
    required this.league,
    this.ligGoster = true,
    this.gizleTanimsiz = false,
    this.kisa = false,
  });

  final String? league;
  final bool ligGoster;
  final bool gizleTanimsiz;

  /// YALNIZ bayrak çizilir (ülke adı yazılmaz). Dar ekranda yan yana duran
  /// kartlarda "FİNLANDİYA" yazısı satırı taşırıyordu; bilgi kaybolmasın diye
  /// ülke adı erişilebilirlik etiketinde ve bayrakta duruyor.
  final bool kisa;

  /// Türkçe büyük harf: Dart'ın toUpperCase()'i 'i' → 'I' yapar, Türkçe'de
  /// 'İ' olmalıdır. Kaynak `toLocaleUpperCase('tr-TR')` kullanıyordu.
  static String _buyukTr(String s) =>
      s.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();

  @override
  Widget build(BuildContext context) {
    final u = ulkeAyikla(league);
    if (u == null) return const SizedBox.shrink();

    // Tanınmayan lig (ülkesiz ve "Kulüp Maçları" da değil).
    if (u.en == null && league != kKulupEtiketi) {
      if (gizleTanimsiz) return const SizedBox.shrink();
      return Text(
        league ?? '',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: AppColors.muted,
          fontSize: 10.5,
          fontWeight: AppFont.bold,
        ),
      );
    }

    final code = u.en != null ? countryCode(u.en) : '';
    final ligKalan = (ligGoster && u.en != null)
        ? (league ?? '').substring(u.en!.length).trim()
        : '';
    final ad = _buyukTr(u.name);

    if (kisa) {
      return code.isNotEmpty
          ? Semantics(label: ad, child: _bayrak(code, tekBasina: true))
          : Semantics(
              label: ad,
              child: const Text('⚽', style: TextStyle(fontSize: 11)),
            );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (code.isNotEmpty)
          _bayrak(code)
        else
          const Padding(
            padding: EdgeInsets.only(right: 4),
            child: Text('⚽', style: TextStyle(fontSize: 11)),
          ),
        Flexible(
          child: Text(
            ad,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppColors.textSoft,
              fontSize: 10.5,
              fontWeight: AppFont.black,
              letterSpacing: 0.5,
            ),
          ),
        ),
        if (ligKalan.isNotEmpty)
          Flexible(
            child: Text(
              ' · $ligKalan',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.muted,
                fontSize: 10.5,
                fontWeight: AppFont.bold,
              ),
            ),
          ),
      ],
    );
  }

  Widget _bayrak(String code, {bool tekBasina = false}) => Padding(
    padding: EdgeInsets.only(right: tekBasina ? 0 : 5),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: CachedNetworkImage(
        imageUrl: 'https://flagcdn.com/48x36/$code.png',
        width: 18,
        height: 13,
        fit: BoxFit.cover,
        errorWidget: (_, _, _) => const SizedBox(width: 18, height: 13),
        placeholder: (_, _) => const SizedBox(width: 18, height: 13),
      ),
    ),
  );
}
