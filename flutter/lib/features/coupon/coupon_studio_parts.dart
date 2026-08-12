// KAYNAK: app/src/screens/couponStudioParts.js (+ studioParts.js → TeamCrest)
// BİREBİR çeviri.
//
// KUPON EKRANLARI — yayın stüdyosuyla AYNI tablo görünümü.
//
// NEDEN AYRI DOSYA: Kupon tarafı (hazırla / kuponlarım / sonuç / paylaş) dört
// ayrı ekran. Tablo çerçevesi, zebra satır, arma+ad hücresi her ekranda ayrı
// yazılırsa dördü birbirinden farklı görünür. Tek kaynak burasıdır.
//
// KURALLAR:
//  • Bu dosya HESAP YAPMAZ. Kolon, maliyet, isabet, kilit — hepsi ekranlara
//    hazır gelir (yinelenen istatistik yasağı).
//  • Hiçbir metin veya renk "kesin/garanti/banko" anlamı taşımaz.
//  • Arma UYDURULMAZ: kulüp arması yoksa nötr simge çizilir (TeamCrest).
//  • Kişisel veri almaz: yalnız bülten satırı ve kullanıcının kendi seçimi.

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/crest_url.dart';
import '../../core/network/api_config.dart';
import '../../core/theme/studio_fonts.dart';
import '../../core/theme/studio_theme.dart';

/* ————————————————————————— ÖLÇEK ————————————————————————— */

typedef KuponOlcek = ({double width, double k, StudioPunto t, bool dar});

/// Ekran genişliğine göre ölçek + punto + dar yerleşim.
/// Dört kupon ekranı da aynı eşikleri kullansın diye tek yerde.
KuponOlcek kuponOlcek(BuildContext context) {
  final w = MediaQuery.sizeOf(context).width;
  final k = scaleFor(w);
  return (width: w, k: k, t: T(k), dar: w <= kNarrowMax);
}

/* ————————————————————————— ARMA ————————————————————————— */

/// `studioParts.js` → `TeamCrest`
///
/// Arma yoksa ya da yüklenemezse NÖTR ⚽ çizilir — başka kulübün arması ya da
/// "benzeri" bir görsel ASLA konmaz.
class TeamCrest extends StatelessWidget {
  const TeamCrest({super.key, this.uri, this.size = 18});

  final String? uri;
  final double size;

  @override
  Widget build(BuildContext context) {
    final adres = crestUrlOf(uri, apiBase);
    if (adres.isEmpty) return _bos();
    return ClipRRect(
      borderRadius: BorderRadius.circular(R.sm),
      child: CachedNetworkImage(
        imageUrl: adres,
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorWidget: (_, _, _) => _bos(),
        placeholder: (_, _) => _bos(),
      ),
    );
  }

  Widget _bos() => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: S.panel3,
      borderRadius: BorderRadius.circular(R.sm),
    ),
    child: Text(
      '⚽',
      style: TextStyle(
        fontSize: (size * 0.62).roundToDouble(),
        height: 0.95 / 0.62,
      ),
    ),
  );
}

/* ————————————————————————— TABLO ————————————————————————— */

/// Tablo çerçevesi — ince gri çizgi, köşeli, taşan içerik kırpılır.
class Tablo extends StatelessWidget {
  const Tablo({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: S.panel,
      border: Border.all(color: S.line, width: TABLE.hair),
      borderRadius: BorderRadius.circular(R.md),
    ),
    clipBehavior: Clip.antiAlias,
    child: Column(children: children),
  );
}

/// Koyu sütun başlığı şeridi.
class Thead extends StatelessWidget {
  const Thead({super.key, this.k = 1, required this.children});

  final double k;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    height: (TABLE.headH * k).roundToDouble(),
    color: S.head,
    child: Row(children: children),
  );
}

/// Tek sütun başlığı. [tam] dar ekranda kısaltılmış başlığın AÇIK hâlidir —
/// kırpılmış bir başlık sütunun neyi gösterdiğini saklar, tam adı ekran
/// okuyucuya verilir.
class Th extends StatelessWidget {
  const Th({
    super.key,
    required this.text,
    this.k = 1,
    this.width,
    this.esnek = false,
    this.center = false,
    this.tam,
    this.padX,
  });

  final String text;
  final double k;
  final double? width;
  final bool esnek;
  final bool center;
  final String? tam;
  final double? padX;

  @override
  Widget build(BuildContext context) {
    final icerik = Semantics(
      label: tam ?? text,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: padX ?? TABLE.cellPadX),
        alignment: center ? Alignment.center : Alignment.centerLeft,
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: studioFont(600).copyWith(
            color: S.headInk,
            fontSize: T(k).mikro,
            letterSpacing: kEtiketLetterSpacing,
          ),
        ),
      ),
    );
    if (esnek) return Expanded(child: icerik);
    return SizedBox(width: width, child: icerik);
  }
}

/// Satır çerçevesi. [secili] turuncu, [kilitli] soluk — ikisi de yalnız görsel.
class Tr extends StatelessWidget {
  const Tr({
    super.key,
    this.k = 1,
    this.zebra = false,
    this.secili = false,
    this.kilitli = false,
    required this.children,
  });

  final double k;
  final bool zebra;
  final bool secili;
  final bool kilitli;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: kilitli ? 0.78 : 1,
    child: Container(
      constraints: BoxConstraints(minHeight: (TABLE.rowH * k).roundToDouble()),
      decoration: BoxDecoration(
        color: secili ? S.accentSoft : (zebra ? S.panel2 : null),
        border: const Border(
          bottom: BorderSide(color: S.lineSoft, width: TABLE.hair),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: children,
      ),
    ),
  );
}

/// Hücre. [dar] sayı sütunları için (dolgu daralır, "20:00" kırpılmaz).
class Td extends StatelessWidget {
  const Td({
    super.key,
    required this.child,
    this.width,
    this.esnek = false,
    this.center = false,
    this.dar = false,
  });

  final Widget child;
  final double? width;
  final bool esnek;
  final bool center;
  final bool dar;

  @override
  Widget build(BuildContext context) {
    final icerik = Container(
      padding: EdgeInsets.symmetric(
        horizontal: dar ? 5 : TABLE.cellPadX,
        vertical: SP.xs,
      ),
      alignment: center ? Alignment.center : Alignment.centerLeft,
      child: child,
    );
    if (esnek) return Expanded(child: icerik);
    return SizedBox(width: width, child: icerik);
  }
}

/// Tablo altı açıklama şeridi.
class Tfoot extends StatelessWidget {
  const Tfoot({super.key, this.k = 1, required this.text});

  final double k;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    color: S.panel2,
    padding: EdgeInsets.symmetric(horizontal: TABLE.cellPadX, vertical: SP.sm),
    child: Text(
      text,
      style: studioFont(400).copyWith(
        color: S.inkDim,
        fontSize: T(k).kucuk,
        height: 16 / T(k).kucuk,
      ),
    ),
  );
}

/* ————————————————————————— MAÇ SATIRI ————————————————————————— */

/// Kupon tarafının ana satırı — yayın stüdyosundaki satırın birebir karşılığı:
///   SIRA | arma  EV SAHİBİ - KONUK  arma | (ekrana özel sağ yuva)
///
/// [sag] her ekranda farklıdır: hazırla ekranında 1-0-2 kutuları, sonuç
/// ekranında ✅/❌/⏳. Satırın SOL yarısı hep aynıdır.
class MacSatiri extends StatelessWidget {
  const MacSatiri({
    super.key,
    this.k = 1,
    this.zebra = false,
    this.secili = false,
    this.kilitli = false,
    required this.sira,
    this.home,
    this.away,
    this.homeLogo,
    this.awayLogo,
    this.alt,
    this.ek,
    this.ekGenislik,
    this.sag,
    this.sagGenislik,
    this.onTap,
    this.erisimEtiketi,
    this.siraGenislik = 32,
  });

  final double k;
  final bool zebra;
  final bool secili;
  final bool kilitli;
  final Object sira;
  final String? home;
  final String? away;
  final String? homeLogo;
  final String? awayLogo;
  final Widget? alt;
  final Widget? ek;
  final double? ekGenislik;
  final Widget? sag;
  final double? sagGenislik;
  final VoidCallback? onTap;
  final String? erisimEtiketi;
  final double siraGenislik;

  @override
  Widget build(BuildContext context) {
    final t = T(k);
    final armaBoy = (17 * k).roundToDouble();

    final adlar = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            TeamCrest(uri: homeLogo, size: armaBoy),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                home ?? '—',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: studioFont(600).copyWith(color: S.ink, fontSize: t.orta),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Text(
                '-',
                style: studioFont(
                  400,
                ).copyWith(color: S.inkDim, fontSize: t.kucuk),
              ),
            ),
            Flexible(
              child: Text(
                away ?? '—',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: studioFont(600).copyWith(color: S.ink, fontSize: t.orta),
              ),
            ),
            const SizedBox(width: 5),
            TeamCrest(uri: awayLogo, size: armaBoy),
            if (kilitli)
              Padding(
                padding: const EdgeInsets.only(left: 2),
                // STÜDYO KENDİ PALETİNİ KULLANIR: bu bir paylaşım GÖRSELİDİR,
                // uygulama arayüzü değil — rengi uygulama temasıyla değişmez.
                child: Icon(Icons.lock_outline, size: t.kucuk, color: S.inkDim),
              ),
          ],
        ),
        if (alt != null)
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Wrap(spacing: SP.sm, runSpacing: 2, children: [alt!]),
          ),
      ],
    );

    return Tr(
      k: k,
      zebra: zebra,
      secili: secili,
      kilitli: kilitli,
      children: [
        Td(
          center: true,
          dar: true,
          width: (siraGenislik * k).roundToDouble(),
          child: Text(
            '$sira',
            style: studioFont(700).copyWith(
              color: S.inkSoft,
              fontSize: t.orta,
              fontFeatures: kTabular,
            ),
          ),
        ),
        Expanded(
          child: onTap != null
              ? Semantics(
                  button: true,
                  label: erisimEtiketi ?? '$sira. maç',
                  child: GestureDetector(
                    onTap: onTap,
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: TABLE.cellPadX,
                        vertical: SP.xs,
                      ),
                      child: adlar,
                    ),
                  ),
                )
              : Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: TABLE.cellPadX,
                    vertical: SP.xs,
                  ),
                  child: adlar,
                ),
        ),
        if (ek != null)
          Td(
            width: ekGenislik != null
                ? (ekGenislik! * k).roundToDouble()
                : null,
            child: ek!,
          ),
        if (sag != null)
          Td(
            center: true,
            // DAR DOLGU: sağ yuva sabit genişliktedir ve 1-0-2 kutuları en
            // dar ölçekte (k=0.86) standart 8px dolguyla 11 piksel TAŞIYOR.
            // Kaynakta RN bunu sessizce kırpıyordu — üçüncü kutunun bir kısmı
            // görünmüyordu ve kimse fark etmiyordu. Flutter taşmayı görünür
            // yaptığı için burada düzeltildi.
            dar: true,
            width: sagGenislik != null
                ? (sagGenislik! * k).roundToDouble()
                : null,
            // İkinci koruma: veri beklenmedik biçimde genişlerse içerik
            // KIRPILMAK yerine bir tık küçülür.
            child: FittedBox(fit: BoxFit.scaleDown, child: sag!),
          ),
      ],
    );
  }
}

/// Takım adlarının altındaki küçük gri satır (lig, saat, "Sen 1-0").
class AltBilgi extends StatelessWidget {
  const AltBilgi({
    super.key,
    required this.text,
    this.k = 1,
    this.color = S.inkDim,
    this.sayi = false,
  });

  final String? text;
  final double k;
  final Color color;
  final bool sayi;

  @override
  Widget build(BuildContext context) {
    if (text == null || text!.isEmpty) return const SizedBox.shrink();
    return Text(
      text!,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: studioFont(500).copyWith(
        color: color,
        fontSize: T(k).mikro,
        fontFeatures: sayi ? kTabular : null,
      ),
    );
  }
}

/* ————————————————————————— KÜÇÜK PARÇALAR ————————————————————————— */

/// Üstte büyük-harf etiket, altında sayı. Değer VERİLİR — burada hesaplanmaz.
class SayiKutu extends StatelessWidget {
  const SayiKutu({
    super.key,
    required this.etiket,
    required this.deger,
    this.alt,
    this.tone = S.ink,
    this.k = 1,
  });

  final String etiket;
  final String deger;
  final String? alt;
  final Color tone;
  final double k;

  @override
  Widget build(BuildContext context) {
    final t = T(k);
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 62),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            etiket,
            maxLines: 1,
            style: studioFont(600).copyWith(
              color: S.inkDim,
              fontSize: t.mikro,
              letterSpacing: kEtiketLetterSpacing,
            ),
          ),
          Text(
            deger,
            maxLines: 1,
            style: studioFont(
              700,
            ).copyWith(color: tone, fontSize: t.buyuk, fontFeatures: kTabular),
          ),
          if (alt != null)
            Text(
              alt!,
              maxLines: 1,
              style: studioFont(500).copyWith(color: tone, fontSize: t.mikro),
            ),
        ],
      ),
    );
  }
}

/// Düğme. [ana] dolu turuncu, aksi hâlde açık zemin + ince çizgi.
///
/// KURAL (projede geçerli): sebepsiz kapalı düğme, sessiz düğmeden beterdir —
/// [disabled] verilecekse ekran mutlaka bir sebep yazısı da göstermelidir.
class Dugme extends StatelessWidget {
  const Dugme({
    super.key,
    required this.text,
    this.onTap,
    this.k = 1,
    this.ana = false,
    this.disabled = false,
    this.tone,
  });

  final String text;
  final VoidCallback? onTap;
  final double k;
  final bool ana;
  final bool disabled;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final renk = tone ?? (ana ? S.accent : S.line);
    return Opacity(
      opacity: disabled ? 0.45 : 1,
      child: Semantics(
        button: true,
        enabled: !disabled,
        child: GestureDetector(
          onTap: disabled ? null : onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: SP.md,
              vertical: SP.sm,
            ),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: ana ? renk : S.panel,
              border: Border.all(color: renk, width: TABLE.hair),
              borderRadius: BorderRadius.circular(R.sm),
            ),
            child: Text(
              text,
              maxLines: 1,
              style: studioFont(ana ? 700 : 600).copyWith(
                color: ana ? S.accentInk : S.ink,
                fontSize: T(k).metin,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Küçük eğik açıklama — dürüstlük notları bu yazımla görünür.
class Not extends StatelessWidget {
  const Not({super.key, required this.text, this.k = 1, this.tone = S.inkDim});

  final String? text;
  final double k;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    if (text == null || text!.isEmpty) return const SizedBox.shrink();
    return Text(
      text!,
      style: studioFont(400).copyWith(
        color: tone,
        fontSize: T(k).kucuk,
        fontStyle: FontStyle.italic,
        height: 15 / T(k).kucuk,
      ),
    );
  }
}

/// Ekran başlığı şeridi — koyu bant, solda başlık, sağda serbest yuva.
class StudioBaslik extends StatelessWidget {
  const StudioBaslik({
    super.key,
    required this.text,
    this.alt,
    this.right,
    this.k = 1,
  });

  final String text;
  final String? alt;
  final Widget? right;
  final double k;

  @override
  Widget build(BuildContext context) {
    final t = T(k);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: SP.md, vertical: SP.sm),
      decoration: BoxDecoration(
        color: S.head,
        borderRadius: BorderRadius.circular(R.md),
      ),
      child: Row(
        children: [
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: studioFont(700).copyWith(
                    color: S.headInk,
                    fontSize: t.metin,
                    letterSpacing: kEtiketLetterSpacing,
                  ),
                ),
                if (alt != null)
                  Text(
                    alt!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: studioFont(500).copyWith(
                      color: const Color(0xFFD6DDE5),
                      fontSize: t.mikro,
                    ),
                  ),
              ],
            ),
          ),
          const Spacer(),
          ?right,
        ],
      ),
    );
  }
}

/* ————————————————————————— SEÇİM KUTULARI ————————————————————————— */

/// `studioParts.js` → `PickBoxes`
///
/// 1 - 0 - 2 kutuları. İşaret RESMÎ yazımla gösterilir ('X' → '0').
///
/// [salt] ile [disabled] AYRI şeylerdir ve kaynaktaki ayrım korunur:
/// dokunulamazlık iki sebepten olabilir ama SOLUKLUK yalnız kilitten gelir.
/// Paylaşılan görselde kutular `salt`tır; `disabled` verilse %42 saydam çizilir
/// ve kare soluk çıkardı.
class PickBoxes extends StatelessWidget {
  const PickBoxes({
    super.key,
    this.outcomes = const [],
    this.onToggle,
    this.disabled = false,
    this.salt = false,
    this.k = 1,
    this.compact = false,
  });

  final List<String> outcomes;
  final void Function(String)? onToggle;
  final bool disabled;
  final bool salt;
  final double k;
  final bool compact;

  /// `couponConfig.OUTCOMES` — ekranda görünen sıra.
  static const List<String> _outcomes = ['1', 'X', '2'];

  /// `couponConfig.toOfficial` — 'X' resmî bültende '0' yazılır.
  static String _resmi(String o) => o == 'X' ? '0' : o;

  @override
  Widget build(BuildContext context) {
    final h = ((compact ? 26 : 30) * k).roundToDouble();
    final w = ((compact ? 30 : 36) * k).roundToDouble();
    final bosluk = (4 * k).roundToDouble();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < _outcomes.length; i++) ...[
          if (i > 0) SizedBox(width: bosluk),
          _kutu(_outcomes[i], h, w),
        ],
      ],
    );
  }

  Widget _kutu(String o, double h, double w) {
    final on = outcomes.contains(o);
    final pasif = disabled || salt;
    return Semantics(
      // Salt görüntülemede kutu bir düğme DEĞİLDİR; ekran okuyucuya "kapalı
      // düğme" diye okutmak yanlış olur, okunacak şey işaretin kendisidir.
      button: !salt,
      selected: on,
      enabled: !disabled,
      label:
          '${_resmi(o)} işareti'
          '${on ? ', seçili' : ''}${disabled ? ', kilitli' : ''}',
      child: Opacity(
        opacity: disabled ? 0.42 : 1,
        child: GestureDetector(
          onTap: pasif ? null : () => onToggle?.call(o),
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: h,
            constraints: BoxConstraints(minWidth: w),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              color: on ? S.accent : S.panel,
              border: Border.all(color: on ? S.accent : S.lineStrong),
              borderRadius: BorderRadius.circular(R.sm),
            ),
            child: Text(
              _resmi(o),
              style: studioFont(700).copyWith(
                color: on ? S.accentInk : S.inkSoft,
                fontSize: ((compact ? 13 : 15) * k).roundToDouble(),
                fontFeatures: kTabular,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
