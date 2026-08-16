// KAYNAK: app/src/screens/WeekSummaryScreen.js — BİREBİR çeviri.
//
// HAFTANIN ÖZETİ — yayın açılış segmenti: güçlü adaylar + sürpriz adayları,
// tek gösterişli koyu ekranda. Yayıncı yayına bu ekranla girer.
//
// "BÜLTEN ZORLUĞU" bandı 16 Ağustos 2026'da KALDIRILDI (kullanıcı kararı):
// haftanın "kolay" olması diye bir şey yok, etiket tutturma kolaylığı vaat
// ediyordu. Backend'in `difficulty` alanı duruyor; hiçbir ekran göstermiyor.
//
//   • Tüm veriler bültendeki GERÇEK analizden gelir (week_summary.dart — saf).
//   • Güçlü aday yoksa dürüstçe "yok" denir; liste zorla doldurulmaz.
//   • İddialı dil yok; etiketler displayLabel sözlüğünden geçer.
//
// TASARIM NOTU (kaynaktan aynen taşındı) — iki turluk kullanıcı geri
// bildirimiyle şekillendi. ASIL TEŞHİS: ekranın "yapay zeka yapımı" görünme
// sebebi renk ya da içerik değil, KUTU YIĞINIYDI. Kartın içinde bordürlü kutu,
// onun içinde bordürlü satır, satırın içinde bordürlü hap.
//
// YÖN: yayın grafiği dili — kutu yerine AYRAÇ, çerçeve yerine BOŞLUK,
// dekorasyon yerine TİPOGRAFİ. Armalar BÜLTENDEKİ DESENE göre: her arma KENDİ
// takımının adına yapışık, ev solda / deplasman sağda.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/labels.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../core/week_summary.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/states.dart';

// YAPISAL RENKLER TAKIM TEMASINDAN OKUNUR (kullanıcı isteği, 2026-08-12).
//
// Bu dört değer eskiden marka laciverdine sabitliydi (0xFF0F2038, 0xFF1C3A5E,
// 0xFF9DB0CD, 0xFF17304F) ve seçilen takım ne olursa olsun değişmiyordu —
// kullanıcının "eski lacivert birçok yerde kalıyor" dediği yerlerden biri
// tam olarak burasıydı. Getter oldular: ad ve 22 kullanım noktası aynı kaldı,
// yalnız kaynak değişti. `const` olamazlar, çünkü tema çalışma zamanında
// değişiyor.
Color get _navy => AppColors.darkCard;
// NOT: eskiden satırların ve zorluk kutusunun zemini olan NAVY_SOFT kaldırıldı —
// artık iç kutu yok, ayraç çizgisi ve boşluk kullanılıyor.
Color get _line => AppColors.darkBorder;
Color get _inkSoft => AppColors.onDarkSoft;
Color get _ayrac => AppColors.darkCardSoft;

// ANLAMSAL — takım temasından ETKİLENMEZ (kullanıcı isteği: "takım rengiyle
// hata, mağlubiyet veya uyarı anlamları çakışmasın"). Bunlar koyu panel için
// açılmış success/warning/danger tonlarıdır; koyu panel her temada koyu
// kaldığı için okunurlukları korunur.
const Color _amber = Color(0xFFFFB35C);
const Color _yesil = Color(0xFF5DD39E);
const Color _kirmizi = Color(0xFFFF7A6E);

class WeekSummaryScreen extends StatefulWidget {
  const WeekSummaryScreen({super.key});

  @override
  State<WeekSummaryScreen> createState() => _WeekSummaryScreenState();
}

class _WeekSummaryScreenState extends State<WeekSummaryScreen> {
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final d = await api.bulletin();
      if (mounted) setState(() => _data = (d as Map).cast<String, dynamic>());
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  void _goMatch(Object? no) => context.push('/ana-sayfa/mac/$no');

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return _kabuk(
        SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: Spacing.lg),
          child: ErrorState(message: _error, onRetry: _load),
        ),
      );
    }
    final data = _data;
    if (data == null) {
      return _kabuk(LoadingState(message: 'Haftanın özeti hazırlanıyor…'));
    }

    final sum = buildWeekSummary(data['matches'] as List?);
    final weekTxt = [
      if (data['season'] != null) '${data['season']} Sezonu',
      if (data['weekNumber'] != null) '${data['weekNumber']}. Hafta',
    ].join(' · ');

    // Haftanın bileşimi. "Diğer" = kalanlar; toplamı bültenle tutturur ki
    // çubuk eksik parça göstermesin.
    final diger =
        (sum.total - sum.strong.length - sum.surprises.length - sum.balanced)
            .clamp(0, sum.total);
    final parcalar = <({String ad, int n, Color renk})>[
      (ad: 'Güçlü', n: sum.strong.length, renk: _yesil),
      (ad: 'Sürpriz', n: sum.surprises.length, renk: _kirmizi),
      (ad: 'Denk', n: sum.balanced, renk: _amber),
      // "Diğer" NÖTR olmalı — yanındaki üçü anlamlı (güçlü/sürpriz/denk).
      // Eskiden sabit lacivertti; artık koyu panelin kendi nötr tonu.
      (ad: 'Diğer', n: diger, renk: AppColors.darkBorder),
    ];

    final ilkNo = sum.strong.isNotEmpty
        ? sum.strong.first['no']
        : (sum.surprises.isNotEmpty ? sum.surprises.first['no'] : 1);

    return _kabuk(
      SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          Spacing.md,
          Spacing.md,
          Spacing.md,
          Spacing.xl,
        ),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(Spacing.lg),
                  decoration: BoxDecoration(
                    color: _navy,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: _line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _baslikSatiri(sum.total, weekTxt),
                      _bilesimCubugu(parcalar, sum.total),
                      _lejant(parcalar),
                      // BÜLTEN ZORLUĞU BANDI KALDIRILDI (kullanıcı kararı,
                      // 16 Ağustos 2026 — ana sayfadaki "Zorluk: Kolay"
                      // etiketiyle AYNI gerekçe). Haftanın "kolay" olması
                      // diye bir şey yok; etiket tutturma kolaylığı vaat
                      // ediyordu. Aynı kaldırma iki ekranda ayrı ayrı
                      // yapılmak zorunda kaldığı için artık bir bekçi test
                      // var: gorsel_kurallar_test.dart.
                      _bolumBasligi(
                        _yesil,
                        'GÜÇLÜ ADAYLAR',
                        sum.strong.isEmpty ? null : sum.strong.length,
                      ),
                      if (sum.strong.isNotEmpty)
                        for (var i = 0; i < sum.strong.length; i++)
                          _macSatiri(
                            m: sum.strong[i],
                            renk: _yesil,
                            altMetin: _guecluAlt(sum.strong[i]),
                            olcut: _guecluOlcut(sum.strong[i]),
                            sonMu: i == sum.strong.length - 1,
                          )
                      else
                        Text(
                          'Bu hafta güçlü aday çıkmadı — zorla aday üretilmez; temkinli hafta.',
                          style: TextStyle(
                            color: _inkSoft,
                            fontSize: 12.5,
                            fontStyle: FontStyle.italic,
                            height: 18 / 12.5,
                          ),
                        ),
                      _bolumBasligi(
                        _kirmizi,
                        'SÜRPRİZ ADAYLARI',
                        sum.surprises.isEmpty ? null : sum.surprises.length,
                      ),
                      if (sum.surprises.isNotEmpty)
                        for (var i = 0; i < sum.surprises.length; i++)
                          _macSatiri(
                            m: sum.surprises[i],
                            renk: _kirmizi,
                            altMetin: _surprizAlt(sum.surprises[i]),
                            olcut:
                                'Sürpriz ${(sum.surprises[i]['analysis'] as Map)['surpriseScore']}',
                            sonMu: i == sum.surprises.length - 1,
                          )
                      else
                        Text(
                          'Sürprize açık maç işareti yok.',
                          style: TextStyle(
                            color: _inkSoft,
                            fontSize: 12.5,
                            fontStyle: FontStyle.italic,
                            height: 18 / 12.5,
                          ),
                        ),
                      if (sum.startedCount > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: Spacing.md),
                          child: Text(
                            'ℹ️ ${sum.startedCount} maç başladığı için aday listelerinde gösterilmiyor.',
                            style: TextStyle(
                              color: _inkSoft,
                              fontSize: 11.5,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ),
                      Container(
                        height: 1,
                        margin: const EdgeInsets.symmetric(
                          vertical: Spacing.md,
                        ),
                        color: _line,
                      ),
                      Text(
                        kLegalFooter,
                        style: TextStyle(
                          color: _inkSoft,
                          fontSize: 10.5,
                          fontStyle: FontStyle.italic,
                          height: 15 / 10.5,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: Spacing.md),
                  child: Center(
                    child: GestureDetector(
                      onTap: () => _goMatch(ilkNo),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          vertical: 13,
                          horizontal: 36,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: AppRadius.mdR,
                        ),
                        child: Text(
                          'İlk Maçın Analizine Git ›',
                          style: TextStyle(
                            color: AppColors.onPrimary,
                            fontSize: 14,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _kabuk(Widget govde) => Scaffold(
    appBar: AppBar(title: const Text('Haftanın Özeti')),
    body: govde,
  );

  /// Favori sembolü kullanıcıya 'X' olarak gösterilir — veri anahtarı '0'dır.
  static String _sembol(Object? s) => '$s'.replaceAll('0', 'X');

  static String _guecluAlt(Map m) {
    final a = m['analysis'] as Map;
    return '${displayLabel(a['label'])} · Sürpriz ${a['surpriseScore'] ?? '—'}';
  }

  static String _guecluOlcut(Map m) {
    final fav = (m['analysis'] as Map)['favorite'] as Map;
    return '${_sembol(fav['symbol'])} · %${fav['percent']}';
  }

  static String _surprizAlt(Map m) {
    final a = m['analysis'] as Map;
    final fav = a['favorite'];
    final ek = fav is Map
        ? ' · Favori ${_sembol(fav['symbol'])} yalnız %${fav['percent']}'
        : '';
    return '${displayLabel(a['label'])}$ek';
  }

  Widget _baslikSatiri(int toplam, String weekTxt) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            RichText(
              text: TextSpan(
                style: TextStyle(
                  color: AppColors.onDark,
                  fontSize: 22,
                  fontWeight: AppFont.black,
                  letterSpacing: -0.3,
                ),
                children: [
                  TextSpan(text: '$kBrandLine1 '),
                  TextSpan(
                    text: kBrandLine2,
                    style: const TextStyle(color: _amber),
                  ),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(top: 2),
              child: Text(
                'HAFTANIN ÖZETİ',
                style: TextStyle(
                  color: _amber,
                  fontSize: 12,
                  fontWeight: AppFont.black,
                  letterSpacing: 2.5,
                ),
              ),
            ),
            if (weekTxt.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  weekTxt,
                  style: TextStyle(
                    color: _inkSoft,
                    fontSize: 12.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
          ],
        ),
      ),
      const SizedBox(width: Spacing.md),
      // Maç sayısı: kutu değil, sağa hizalı iri sayı.
      Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            '$toplam',
            style: TextStyle(
              color: AppColors.onDark,
              fontSize: 40,
              height: 1,
              fontWeight: AppFont.black,
              letterSpacing: -1.5,
            ),
          ),
          Text(
            'MAÇ',
            style: TextStyle(
              color: _inkSoft,
              fontSize: 9.5,
              fontWeight: AppFont.black,
              letterSpacing: 2,
            ),
          ),
        ],
      ),
    ],
  );

  /// HAFTANIN BİLEŞİMİ — tek yığılmış çubuk.
  /// Sıfır genişlikli dilim ÇİZİLMEZ: bir kategori yoksa çubukta yeri de
  /// olmaz, yoksa "var ama küçük" gibi görünürdü.
  Widget _bilesimCubugu(
    List<({String ad, int n, Color renk})> parcalar,
    int toplam,
  ) {
    if (toplam == 0) return const SizedBox.shrink();
    return Container(
      height: 8,
      margin: const EdgeInsets.only(top: Spacing.md),
      decoration: BoxDecoration(
        color: _line,
        borderRadius: BorderRadius.circular(4),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          for (final p in parcalar)
            if (p.n > 0)
              Expanded(
                flex: p.n,
                child: ColoredBox(color: p.renk),
              ),
        ],
      ),
    );
  }

  /// Bileşim açıklaması — renk + sayı + ad.
  Widget _lejant(List<({String ad, int n, Color renk})> parcalar) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Wrap(
      spacing: 12,
      runSpacing: 6,
      children: [
        for (final p in parcalar)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: p.renk,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                '${p.n}',
                style: TextStyle(
                  color: AppColors.onDark,
                  fontSize: 12,
                  fontWeight: AppFont.black,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                p.ad,
                style: TextStyle(
                  color: _inkSoft,
                  fontSize: 11,
                  fontWeight: AppFont.bold,
                ),
              ),
            ],
          ),
      ],
    ),
  );

  /// Bölüm başlığı — renkli aksan çubuğuyla.
  Widget _bolumBasligi(Color renk, String baslik, int? sayi) => Padding(
    padding: const EdgeInsets.only(top: Spacing.lg, bottom: 9),
    child: Row(
      children: [
        Container(
          width: 3,
          height: 15,
          decoration: BoxDecoration(
            color: renk,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            baslik,
            style: TextStyle(
              color: AppColors.onDark,
              fontSize: 13,
              fontWeight: AppFont.black,
              letterSpacing: 1.2,
            ),
          ),
        ),
        if (sayi != null)
          Text(
            '$sayi',
            style: TextStyle(
              color: renk,
              fontSize: 13,
              fontWeight: AppFont.black,
            ),
          ),
      ],
    ),
  );

  /// Maç satırı — bültendeki desen: arma KENDİ takımının adına yapışık,
  /// ev solda / deplasman sağda. Arma yoksa Logo nötr ⚽ çizer.
  Widget _macSatiri({
    required Map m,
    required Color renk,
    required String altMetin,
    required String olcut,
    required bool sonMu,
  }) => GestureDetector(
    onTap: () => _goMatch(m['no']),
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(
        border: sonMu ? null : Border(bottom: BorderSide(color: _ayrac)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Logo(
                      uri: crestOf(m.cast<String, dynamic>(), 'home'),
                      name: (m['home'] as Map?)?['name'] as String?,
                      size: 22,
                    ),
                    const SizedBox(width: 7),
                    Flexible(
                      child: Text(
                        takimAdi(m['home']),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.onDark,
                          fontSize: 14,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Flexible(
                      child: Text(
                        takimAdi(m['away']),
                        maxLines: 1,
                        textAlign: TextAlign.right,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.onDark,
                          fontSize: 14,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                    const SizedBox(width: 7),
                    Logo(
                      uri: crestOf(m.cast<String, dynamic>(), 'away'),
                      name: (m['away'] as Map?)?['name'] as String?,
                      size: 22,
                    ),
                  ],
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              children: [
                Expanded(
                  child: RichText(
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    text: TextSpan(
                      style: TextStyle(
                        color: _inkSoft,
                        fontSize: 11,
                        fontWeight: AppFont.bold,
                        letterSpacing: 0.2,
                      ),
                      children: [
                        TextSpan(
                          text: '${m['no']}',
                          style: TextStyle(
                            color: _inkSoft,
                            fontWeight: AppFont.black,
                          ),
                        ),
                        TextSpan(text: '  ·  $altMetin'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                // Ölçüt: çerçevesiz, renkli ve kalın.
                Text(
                  olcut,
                  style: TextStyle(
                    color: renk,
                    fontSize: 13.5,
                    fontWeight: AppFont.black,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
