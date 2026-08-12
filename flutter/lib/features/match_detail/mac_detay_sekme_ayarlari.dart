// MAÇ DETAY SEKME AYARLARI (kullanıcı isteği, 2026-08-11 · Screenshot_7 akışı)
//
// Sekme çubuğundaki dişliden açılır. Kullanıcı hangi sekmeleri görmek
// istediğini işaretler; seçim "Kaydet" ile diske yazılır (`prefs`).
//
// AKIŞ KURALI: işaretler önce YEREL tutulur, X ile kapatmak hiçbir şeyi
// değiştirmez. Yanlışlıkla kapatılan bir sekme, kaydetmeden çıkınca geri
// gelir — "kapat" ile "vazgeç" aynı düğme olmamalı.
//
// SIRALAMA YOK: kaynak ekranda satırların solunda sürükleme tutamağı var ama
// kullanıcı yalnız AÇ/KAPAT istedi. Çalışmayan bir tutamak çizmek, olmayan bir
// özelliği varmış gibi gösterirdi; tutamağın yerinde sekmenin kendi ikonu
// duruyor.

import 'package:flutter/material.dart';

import '../../core/theme/takim_paleti.dart' show okunurMetin;
import '../../core/theme/tokens.dart';
import 'mac_detay_sekmeleri.dart';

/// Ayar sayfasını açar. Dönüş: kullanıcı KAYDETTİ mi (ekran kendini yeniler).
Future<bool> macDetaySekmeAyarlariniAc(BuildContext context) async {
  final sonuc = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const MacDetaySekmeAyarlariSayfasi(),
  );
  return sonuc == true;
}

class MacDetaySekmeAyarlariSayfasi extends StatefulWidget {
  const MacDetaySekmeAyarlariSayfasi({super.key});

  @override
  State<MacDetaySekmeAyarlariSayfasi> createState() =>
      _MacDetaySekmeAyarlariSayfasiState();
}

class _MacDetaySekmeAyarlariSayfasiState
    extends State<MacDetaySekmeAyarlariSayfasi> {
  /// Yerel kopya — "Kaydet" basılana kadar diske YAZILMAZ.
  late final Set<String> _gizli = {...macDetayGizliSekmeler()};

  @override
  Widget build(BuildContext context) {
    final sekmeler = macDetayAyarlanabilirSekmeler;

    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.lg),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _baslik(context),
            Padding(
              padding: EdgeInsets.fromLTRB(
                Spacing.lg,
                Spacing.lg,
                Spacing.lg,
                Spacing.sm,
              ),
              child: Text(
                'Maç detay sekmelerini kendi tercihlerinize göre '
                'özelleştirebilirsiniz.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textSoft,
                  fontSize: 12.5,
                  height: 17 / 12.5,
                ),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(
                  Spacing.md,
                  Spacing.sm,
                  Spacing.md,
                  Spacing.sm,
                ),
                children: [for (final s in sekmeler) _satir(s)],
              ),
            ),
            _dugmeler(context),
          ],
        ),
      ),
    );
  }

  Widget _baslik(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(Spacing.lg, Spacing.md, Spacing.sm, 12),
    color: AppColors.primary,
    child: Row(
      children: [
        Expanded(
          child: Text(
            'Maç Detay Sekme Ayarları',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.onPrimary,
              fontSize: 15,
              fontWeight: AppFont.heavy,
            ),
          ),
        ),
        Semantics(
          button: true,
          label: 'Kapat',
          child: GestureDetector(
            key: const Key('sekme-ayar-kapat'),
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).pop(false),
            child: Padding(
              padding: EdgeInsets.all(6),
              child: Icon(Icons.close, color: AppColors.onPrimary, size: 20),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _satir(MacDetaySekme s) {
    final acik = !_gizli.contains(s.ad);
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.sm),
      child: Semantics(
        button: true,
        toggled: acik,
        label: '${s.ad} sekmesi',
        child: GestureDetector(
          key: Key('sekme-ayar-satir-${s.ad}'),
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() {
            if (acik) {
              _gizli.add(s.ad);
            } else {
              _gizli.remove(s.ad);
            }
          }),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: Spacing.md,
              vertical: 14,
            ),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: AppRadius.mdR,
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.bgAlt,
                    borderRadius: AppRadius.smR,
                  ),
                  child: Icon(s.ikon, size: 17, color: AppColors.textSoft),
                ),
                const SizedBox(width: Spacing.md),
                Expanded(
                  child: Text(
                    s.ad,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 14,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ),
                // ONAY KUTUSU — işaretliyse dolu accent + beyaz tik, değilse
                // boş çerçeve (Screenshot_7).
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: acik ? AppColors.accent : AppColors.surface,
                    borderRadius: AppRadius.smR,
                    border: Border.all(
                      color: acik ? AppColors.accent : AppColors.border,
                    ),
                  ),
                  child: acik
                      ? Icon(Icons.check, size: 17, color: AppColors.onAccent)
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _dugmeler(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(
      Spacing.md,
      Spacing.md,
      Spacing.md,
      Spacing.lg,
    ),
    decoration: BoxDecoration(
      color: AppColors.surface,
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      children: [
        Expanded(
          child: _dugme(
            anahtar: const Key('sekme-ayar-varsayilan'),
            yazi: 'Varsayılan Ayarlara Dön',
            zemin: AppColors.primary,
            // Varsayılan = HEPSİ AÇIK. Kaydedilmeden uygulanmaz; kullanıcı
            // görüp vazgeçebilir.
            onTap: () => setState(_gizli.clear),
          ),
        ),
        const SizedBox(width: Spacing.md),
        Expanded(
          child: _dugme(
            anahtar: const Key('sekme-ayar-kaydet'),
            yazi: 'Kaydet',
            zemin: AppColors.accent,
            onTap: () {
              macDetayGizliSekmeleriYaz(_gizli);
              Navigator.of(context).pop(true);
            },
          ),
        ),
      ],
    ),
  );

  Widget _dugme({
    required Key anahtar,
    required String yazi,
    required Color zemin,
    required VoidCallback onTap,
  }) => Semantics(
    button: true,
    label: yazi,
    child: GestureDetector(
      key: anahtar,
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: zemin, borderRadius: AppRadius.mdR),
        child: Text(
          yazi,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: okunurMetin(zemin),
            fontSize: 13,
            fontWeight: AppFont.heavy,
          ),
        ),
      ),
    ),
  );
}
