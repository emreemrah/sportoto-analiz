// İSTATİSTİK — GÖRSEL ÖZET (kullanıcı isteği, 2026-08-11)
//
// Kullanıcı istatistiklerin "yoğun tablo" yerine sade kartlar, karşılaştırma
// çubukları ve yüzdelerle sunulmasını istedi. Bu dosya o iki yüzeyi taşır:
//
//   1) FORM KARTLARI  — kaydırmalı kartlar; her kart bir kesitin galibiyet /
//      beraberlik / mağlubiyet dağılımını oranlı çubukla, altında 2.5 üst ·
//      karşılıklı gol · gol yemediği maç yüzdeleriyle gösterir.
//   2) KARŞILAŞTIRMA ÇUBUKLARI — iki takımın maç başına ortalamaları
//      (topla oynama, şut, isabetli şut, korner, faul, ofsayt, kart) yan yana.
//
// REFERANS GÖRSELLER YALNIZ DÜZEN İÇİNDİR: Screenshot_1-5 ve 10-12 yalnız
// yerleşim, oranlı çubuk fikri ve boşluk düzeni için örnek alındı; oradaki
// takımlar, sayılar ve etiketler kopyalanmadı.
//
// ═══════════════ VERİSİ OLMAYAN HİÇBİR ŞEY ÇİZİLMEZ ═══════════════════════
// Bu ekranın tek işi farkı göstermek; olmayan farkı "0 - 0" diye çizmek
// kullanıcıya veri varmış gibi gösterirdi. Kurallar:
//   • Kesitte hiç maç yoksa (n == 0) o KART hiç yok.
//   • Bir ölçümde iki takımın da değeri yoksa o SATIR hiç yok.
//   • Hiçbir ölçümün değeri yoksa BÖLÜM hiç yok.
// Yeni sezonun ilk haftalarında maç logu boştur ve bu yüzeyler kendiliğinden
// görünmez — ölçüldü (2026-08-11, 1. hafta: `matchLog` ve `last5detail` boş).
//
// İLK YARI VERİSİ YOK: kullanıcı "ilk yarı verileri" de istedi ama maç logu
// satırları yalnız maç sonu golünü taşıyor (`gf`/`ga`); ilk yarı skoru hiçbir
// alanda gelmiyor. Uydurulmadı — o kutunun yerinde GERÇEK bir ölçüm duruyor
// (gol yemediği maç yüzdesi). İlk yarı istenirse önce backend alanı gerekir.

import 'package:flutter/material.dart';

import '../../core/analysis/stats_from_log.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';
// SectionCard burada tanımlı (ui.js karşılığı) — kart kabuğu için gerekli.
import '../../widgets/tabs.dart';

/// Ev sahibi / deplasman renkleri — iki taraf her yüzeyde AYNI renkle anılır,
/// yoksa kullanıcı hangi çubuğun kime ait olduğunu her kartta yeniden öğrenir.
///
/// GETTER, `final` DEĞİL: takım teması `AppColors`ı çalışma zamanında yazar;
/// modül düzeyi `final` ilk okunduğu tonda donar ve istatistik çubukları
/// temayla birlikte değişmezdi.
Color get kEvRengi => AppColors.accent;
Color get kDepRengi => AppColors.primary;

// ═══════════════════════════ FORM KARTLARI ════════════════════════════════

/// Tek bir kesit: "{takım} son 5 maçı", "son 5 iç saha" gibi.
class FormKesiti {
  const FormKesiti({
    required this.baslik,
    required this.veri,
    this.logo,
    this.renk,
  });

  final String baslik;
  final LogStats veri;
  final String? logo;

  /// Boş bırakılırsa çizim yerinde `kEvRengi`ne düşer. VARSAYILAN DEĞER
  /// OLARAK YAZILAMAZ: `kEvRengi` artık takım temasıyla değişen bir alan,
  /// isteğe bağlı parametre varsayılanı ise derleme zamanı sabiti olmak
  /// zorunda.
  final Color? renk;
}

/// Yatay kaydırmalı form kartları + altında sayfa noktaları.
class FormKartlari extends StatefulWidget {
  const FormKartlari({super.key, required this.kesitler});

  final List<FormKesiti> kesitler;

  @override
  State<FormKartlari> createState() => _FormKartlariState();
}

class _FormKartlariState extends State<FormKartlari> {
  final _denetleyici = PageController();
  int _sayfa = 0;

  @override
  void dispose() {
    _denetleyici.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Maçı olmayan kesit çizilmez; hiç kesit kalmazsa bölüm de yok.
    final dolu = widget.kesitler.where((k) => k.veri.n > 0).toList();
    if (dolu.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 186,
          child: PageView.builder(
            controller: _denetleyici,
            onPageChanged: (i) => setState(() => _sayfa = i),
            itemCount: dolu.length,
            itemBuilder: (_, i) => _Kart(kesit: dolu[i]),
          ),
        ),
        if (dolu.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: Spacing.sm),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < dolu.length; i++)
                  Container(
                    width: _sayfa == i ? 8 : 6,
                    height: _sayfa == i ? 8 : 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: _sayfa == i ? AppColors.accent : AppColors.border,
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Kart extends StatelessWidget {
  const _Kart({required this.kesit});

  final FormKesiti kesit;

  @override
  Widget build(BuildContext context) {
    final v = kesit.veri;

    return Container(
      margin: const EdgeInsets.only(right: Spacing.sm, bottom: 2),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.lgR,
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (kesit.logo != null) ...[
                Logo(uri: kesit.logo, name: kesit.baslik, size: 22),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Text(
                  kesit.baslik,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 13.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
              Text(
                '${v.n} maç',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontWeight: AppFont.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _OranCubugu(
            paylar: [
              (v.w, kEvRengi),
              (v.d, AppColors.border),
              (v.l, kDepRengi),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _Kutu(sayi: '${v.w}', etiket: 'Galibiyet', renk: kEvRengi),
              const SizedBox(width: 6),
              _Kutu(
                sayi: '${v.d}',
                etiket: 'Beraberlik',
                renk: AppColors.textMuted,
              ),
              const SizedBox(width: 6),
              _Kutu(sayi: '${v.l}', etiket: 'Mağlubiyet', renk: kDepRengi),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _Kutu(sayi: _yuzde(v.overPct), etiket: '2.5 Üst', kucuk: true),
              const SizedBox(width: 6),
              _Kutu(sayi: _yuzde(v.bttsPct), etiket: 'KG Var', kucuk: true),
              const SizedBox(width: 6),
              _Kutu(sayi: _yuzde(v.csPct), etiket: 'Gol Yemedi', kucuk: true),
            ],
          ),
        ],
      ),
    );
  }

  /// Yüzde yoksa "—": bilinmeyen değer sıfır gibi yazılmaz.
  static String _yuzde(int? v) => v == null ? '—' : '%$v';
}

/// G/B/M dağılımının oranlı çubuğu. Paylar sıfırsa çubuk hiç çizilmez.
///
/// ÇİZİM TUZAĞI (2026-08-11'de yaşandı): yuvarlatılmış köşe + birden çok
/// görünür renk aynı `Border`'da çizilemez ve kart BOMBOŞ çıkar. Burada
/// kenarlık yok; yuvarlatmayı `ClipRRect` yapıyor.
class _OranCubugu extends StatelessWidget {
  const _OranCubugu({required this.paylar});

  final List<(int, Color)> paylar;

  @override
  Widget build(BuildContext context) {
    final toplam = paylar.fold<int>(0, (a, p) => a + p.$1);
    if (toplam <= 0) return const SizedBox.shrink();

    return ClipRRect(
      borderRadius: BorderRadius.circular(5),
      child: SizedBox(
        height: 9,
        child: Row(
          // ÇİZİM TUZAĞI (2026-08-11'de önizlemede yakalandı): Row dikeyde
          // varsayılan olarak MERKEZLER ve çocuğuna gevşek yükseklik verir;
          // çocuksuz bir `ColoredBox` o gevşeklikte SIFIR yükseklik alır ve
          // çubuk hiç görünmez. `stretch` yüksekliği doldurur.
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (pay, renk) in paylar)
              if (pay > 0)
                Expanded(
                  flex: pay,
                  child: ColoredBox(color: renk),
                ),
          ],
        ),
      ),
    );
  }
}

class _Kutu extends StatelessWidget {
  const _Kutu({
    required this.sayi,
    required this.etiket,
    this.renk,
    this.kucuk = false,
  });

  final String sayi;
  final String etiket;
  final Color? renk;
  final bool kucuk;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: EdgeInsets.symmetric(vertical: kucuk ? 6 : 8, horizontal: 4),
      decoration: BoxDecoration(
        color: AppColors.bgAlt,
        borderRadius: AppRadius.smR,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              sayi,
              style: TextStyle(
                color: renk ?? AppColors.text,
                fontSize: kucuk ? 13 : 16,
                fontWeight: AppFont.black,
              ),
            ),
          ),
          const SizedBox(height: 1),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              etiket,
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 9.5,
                fontWeight: AppFont.bold,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

// ═══════════════════ KARŞILAŞTIRMA ÇUBUKLARI ══════════════════════════════

/// Maç başına ortalamalar — kaynak `stats.<taraf>.season.avg`.
/// Sıra kullanıcının saydığı sıradır.
const List<(String anahtar, String etiket, bool yuzde)> kOlcumler = [
  ('possession', 'Topla Oynama', true),
  ('shots', 'Şut', false),
  ('shotsOnTarget', 'İsabetli Şut', false),
  ('corners', 'Köşe Vuruşu', false),
  ('fouls', 'Faul', false),
  ('offsides', 'Ofsayt', false),
  ('cards', 'Kart', false),
];

/// İki takımın maç başına ortalamalarını yan yana çizer.
class KarsilastirmaCubuklari extends StatelessWidget {
  const KarsilastirmaCubuklari({
    super.key,
    required this.home,
    required this.away,
    required this.homeName,
    required this.awayName,
  });

  final Map? home;
  final Map? away;
  final String homeName;
  final String awayName;

  static num? _deger(Map? taraf, String anahtar) {
    final avg = ((taraf?['season'] as Map?)?['avg'] as Map?)?[anahtar];
    final n = avg is num ? avg : num.tryParse('$avg');
    // 0 "veri yok" demektir: bu alanlar sezon başında sıfır gelir, oysa hiçbir
    // takım maç başına 0 şut çekmez. Sıfırı gerçek değer gibi çizmek, olmayan
    // bir bilgiyi varmış gibi göstermek olurdu.
    return (n != null && n.isFinite && n > 0) ? n : null;
  }

  static String _bic(num v, bool yuzde) {
    final s = v == v.roundToDouble() ? '${v.toInt()}' : v.toStringAsFixed(1);
    return yuzde ? '%$s' : s;
  }

  @override
  Widget build(BuildContext context) {
    final satirlar = <Widget>[];
    for (final (anahtar, etiket, yuzde) in kOlcumler) {
      final h = _deger(home, anahtar);
      final a = _deger(away, anahtar);
      if (h == null && a == null) continue; // iki tarafta da yok → satır yok
      satirlar.add(
        _OlcumSatiri(
          etiket: etiket,
          solMetin: h == null ? '—' : _bic(h, yuzde),
          sagMetin: a == null ? '—' : _bic(a, yuzde),
          sol: h ?? 0,
          sag: a ?? 0,
        ),
      );
    }
    if (satirlar.isEmpty) return const SizedBox.shrink();

    return SectionCard(
      title: '📊  Maç Başına Ortalamalar',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TarafBasligi(homeName: homeName, awayName: awayName),
          const SizedBox(height: Spacing.sm),
          ...satirlar,
          Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text(
              'Değerler bu sezonun maç başına ortalamalarıdır; verisi olmayan '
              'ölçüm hiç yazılmaz.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                height: 14 / 10.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TarafBasligi extends StatelessWidget {
  const _TarafBasligi({required this.homeName, required this.awayName});

  final String homeName;
  final String awayName;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Row(
          children: [
            _nokta(kEvRengi),
            const SizedBox(width: 5),
            Expanded(child: _ad(homeName, TextAlign.left)),
          ],
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Row(
          children: [
            Expanded(child: _ad(awayName, TextAlign.right)),
            const SizedBox(width: 5),
            _nokta(kDepRengi),
          ],
        ),
      ),
    ],
  );

  Widget _nokta(Color c) => Container(
    width: 9,
    height: 9,
    decoration: BoxDecoration(color: c, shape: BoxShape.circle),
  );

  Widget _ad(String s, TextAlign hiza) => Text(
    s,
    textAlign: hiza,
    maxLines: 1,
    overflow: TextOverflow.ellipsis,
    style: TextStyle(
      color: AppColors.textSoft,
      fontSize: 11.5,
      fontWeight: AppFont.heavy,
    ),
  );
}

class _OlcumSatiri extends StatelessWidget {
  const _OlcumSatiri({
    required this.etiket,
    required this.solMetin,
    required this.sagMetin,
    required this.sol,
    required this.sag,
  });

  final String etiket;
  final String solMetin;
  final String sagMetin;
  final num sol;
  final num sag;

  @override
  Widget build(BuildContext context) {
    final toplam = sol + sag;
    // BÜYÜK olan değer koyu yazılır — yalnız sayısal fark vurgulanır.
    // "Üstün/iyi" yorumu YAPILMAZ: faul ve kartta büyük olan iyi değildir;
    // ekran hangi sayının büyük olduğunu söyler, hüküm vermez.
    final solOnde = sol > sag;
    final sagOnde = sag > sol;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SizedBox(
                width: 46,
                child: Text(
                  solMetin,
                  style: TextStyle(
                    color: solOnde ? kEvRengi : AppColors.textSoft,
                    fontSize: 13,
                    fontWeight: solOnde ? AppFont.black : AppFont.bold,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  etiket,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11.5,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
              SizedBox(
                width: 46,
                child: Text(
                  sagMetin,
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: sagOnde ? kDepRengi : AppColors.textSoft,
                    fontSize: 13,
                    fontWeight: sagOnde ? AppFont.black : AppFont.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          if (toplam > 0)
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: SizedBox(
                height: 7,
                child: Row(
                  // Bkz. _OranCubugu'ndaki çizim tuzağı notu.
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      flex: (sol * 1000).round().clamp(0, 1 << 30),
                      child: ColoredBox(color: kEvRengi),
                    ),
                    const SizedBox(width: 2),
                    Expanded(
                      flex: (sag * 1000).round().clamp(0, 1 << 30),
                      child: ColoredBox(color: kDepRengi),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
