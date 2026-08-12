// KAYNAK: app/src/components/HaftaSecici.js — BİREBİR çeviri.
//
// HAFTA SEÇİCİ — Radar Merkezi'nin üstündeki hafta gezintisi.
//
// ESKİ HÂLİ: bütün haftalar yan yana çipti ("53 · Güncel | 52 🔏 | 51 🔏").
// Yeni sezon 1. haftayla başlayınca hem numaralar küçülüyor hem de haftalar
// birikiyor (sezonda 52) — şerit okunmaz hâle geliyor.
//
// YENİ KALIP resmî Spor Toto listesindekiyle aynıdır — İKİ açılır liste:
//
//   [2025/2026 Sezonu ▼]   [53. Hafta ▼]
//
// Hafta listesi seçili sezonun BÜTÜN haftalarını taşır, güncel dahil, en
// üstte. SEZON tek olsa bile AÇILIR kalır: düz yazı denendi ve "açılır olduğu
// anlaşılmıyor" geri bildirimi geldi; ikinci sezon gelince görünümün
// değişmemesi de daha tutarlı.
//
// Bu bileşen DURUM TUTMAZ — açık/kapalı ve seçimler RadarScreen'de yaşar.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import 'radar_screen_data.dart';

/// Liste bu yükseklikten sonra kaydırılır: 52 haftalık sezon tek ekrana
/// sığmaz (resmî listede de kaydırma vardır).
const double _kListeMaxYukseklik = 300;

class HaftaSecici extends StatelessWidget {
  const HaftaSecici({
    super.key,
    required this.weeks,
    required this.curId,
    required this.selectedId,
    this.acik, // null | 'sezon' | 'hafta' — tek seferde tek liste
    required this.onToggle,
    this.navSezon,
    required this.onSelectSezon,
    required this.onSelectWeek,
    this.onDisariTiklandi,
  });

  final List? weeks;
  final Object? curId;
  final Object? selectedId;
  final String? acik;
  final ValueChanged<String> onToggle;
  final Object? navSezon;
  final ValueChanged<String> onSelectSezon;
  final ValueChanged<int> onSelectWeek;

  /// Açık listeye DIŞARI tıklanınca kapanma (2026-08-10, "profesyonel
  /// uygulama" turu): açılır liste yalnız düğmeyle değil, ekranın başka
  /// yerine dokununca da kapanmalı — standart açılır liste davranışı.
  final VoidCallback? onDisariTiklandi;

  @override
  Widget build(BuildContext context) {
    final v = haftaSeciciVerisi(
      weeks,
      curId: curId,
      selectedId: selectedId,
      navSezon: navSezon,
    );
    if (v.liste.isEmpty) return const SizedBox.shrink();

    // LİSTE KENDİ DÜĞMESİNİN ALTINDA AÇILIR (kullanıcı bildirimi, 2026-08-10:
    // "geçmiş haftalar solda çıkıyor, güncel haftanın altında çıkmalı").
    // Eskiden iki liste de satırın SOL kenarına iniyordu; sezon değiştirince
    // açılan HAFTA listesi sezonun listesi gibi görünüyordu. Her düğme kendi
    // sütununda: listesi tam altına iner, dar ekranda Wrap alt satıra taşır.
    return TapRegion(
      onTapOutside: (_) {
        if (acik != null) onDisariTiklandi?.call();
      },
      child: _govde(v),
    );
  }

  Widget _govde(HaftaSeciciVerisi v) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // SEZON — tek sezon olsa bile AÇILIR kalır (üstteki not).
            Semantics(
              button: true,
              label: 'Sezon seç, şu an ${v.sezonAdi}',
              child: _secDugmesi(
                metin: v.sezonAdi,
                okKey: const Key('sezon-ok'),
                acikMi: acik == 'sezon',
                onTap: () => onToggle('sezon'),
              ),
            ),
            if (acik == 'sezon')
              _liste(
                kaydirmali: false,
                children: [
                  for (final s in v.sezonlar)
                    _oge(
                      metin: s.ad,
                      meta: '',
                      secili: s.y == v.seciliSezon,
                      onTap: () => onSelectSezon(s.y),
                    ),
                ],
              ),
          ],
        ),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              button: true,
              label: 'Hafta seç, şu an ${v.haftaAdi ?? 'seçili değil'}',
              child: _secDugmesi(
                metin:
                    '${v.haftaAdi ?? 'Seç'}${v.haftaGuncelMi ? ' · Güncel' : ''}',
                okKey: const Key('hafta-ok'),
                acikMi: acik == 'hafta',
                onTap: () => onToggle('hafta'),
              ),
            ),
            if (acik == 'hafta')
              _liste(
                kaydirmali: true,
                children: [
                  for (final w in v.liste)
                    _oge(
                      metin: w.ad,
                      // Sağdaki işaret: güncel mi, mühürlü mü. Mühür "sonradan
                      // değişmez" güvencesidir, gizlenmez.
                      meta: w.guncel ? 'Güncel' : (w.kilitli ? 'Kilitli' : ''),
                      secili:
                          selectedId != null &&
                          w.roundId == num.tryParse('$selectedId'),
                      onTap: () => onSelectWeek(w.roundId),
                    ),
                ],
              ),
          ],
        ),
      ],
    );
  }

  // DOKUNULABİLİR OLDUĞU BELLİ OLMALI: çerçeve + zemin + ok. Önce resmî
  // listedeki gibi çerçevesiz düz yazı denendi, "açılır olduğu anlaşılmıyor"
  // geri bildirimi geldi.
  Widget _secDugmesi({
    required String metin,
    required Key okKey,
    required bool acikMi,
    required VoidCallback onTap,
  }) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: acikMi ? AppColors.primarySoft : AppColors.surfaceSoft,
        borderRadius: AppRadius.pillR,
        border: Border.all(
          color: acikMi ? AppColors.primary : AppColors.border,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            metin,
            style: TextStyle(
              color: AppColors.text,
              fontSize: 13.5,
              fontWeight: AppFont.heavy,
            ),
          ),
          const SizedBox(width: 8),
          // ▼/▲ (U+25BC/25B2) — önce ⌄/⌃ (U+2304/2303) kullanılmıştı ve
          // cihazda GÖRÜNMÜYORDU; o karakterler birçok yazı tipinde yok. Bu
          // ikisi aynı ekranda Radar 5 satır açılımında zaten çalışıyor.
          Text(
            acikMi ? '▲' : '▼',
            key: okKey,
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 11,
              fontWeight: AppFont.black,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _liste({required bool kaydirmali, required List<Widget> children}) {
    final govde = Column(mainAxisSize: MainAxisSize.min, children: children);
    return Container(
      margin: const EdgeInsets.only(top: 6),
      constraints: BoxConstraints(
        minWidth: 210,
        maxHeight: kaydirmali ? _kListeMaxYukseklik : double.infinity,
      ),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.smR,
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.hardEdge,
      child: kaydirmali ? SingleChildScrollView(child: govde) : govde,
    );
  }

  Widget _oge({
    required String metin,
    required String meta,
    required bool secili,
    required VoidCallback onTap,
  }) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 16),
      decoration: BoxDecoration(
        color: secili ? AppColors.primarySoft : Colors.transparent,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            metin,
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 13.5,
              fontWeight: secili ? AppFont.black : AppFont.bold,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            meta,
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 11,
              fontWeight: AppFont.bold,
            ),
          ),
        ],
      ),
    ),
  );
}
