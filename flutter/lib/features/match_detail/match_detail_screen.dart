// KAYNAK: app/src/screens/MatchDetailScreen.js (1142 satır)
//
// ÇEVRİLEN: ekran iskeleti, MatchHeader, sekmeli çubuk, **Özet sekmesinin
// tamamı**, **Analiz sekmesi** (MasterAnalysisView + KriterBasariListesi →
// KriterKirilimScreen) ve radar sekmeleri.
//
// ═══════ SEKME DÜZENİ YENİLENDİ (kullanıcı isteği, 2026-08-11) ═════════════
// Eski tek 'Radar' sekmesi KALDIRILDI; yerine üç ayrı sekme geldi:
//   Oynanma Yüzdeleri (Radar 3) · Oran Takibi (Radar 4) · Bülten Sırası (R5)
// Üçü de YALNIZ açılan maçın verisini gösterir (haftanın 15 maçı değil).
// Sekme sırası: Özet · Analiz · İstatistik · Oynanma Yüzdeleri · Oran Takibi ·
// Bülten Sırası · Yorumlar. Katalog `mac_detay_sekmeleri.dart` içinde.
//
// ANA RADAR EKRANI BU DEĞİŞİKLİKTEN ETKİLENMEZ: `features/radar/` altındaki
// hiçbir ekran/işlev kaldırılmadı; buradaki paneller o ekranın BİLEŞENLERİNİ
// yeniden kullanır (kopya bileşen ve ikinci bir hesap yazılmadı).
//
// GEÇİŞ: sekme başlığına dokunarak VEYA içerik alanını sağa-sola kaydırarak.
// İkisi de aynı `TabController`'a bağlı olduğu için seçili başlık içerikle
// kendiliğinden eşleşir — elle senkron tutulan bir durum yoktur.
//
// POLLS (app/src/Polls.js · 348 satır) BİLEREK ÇEVRİLMEDİ — kaynakta ÖLÜ KOD:
// hiçbir dosya `PollsSection`'ı içe aktarmıyor ve kendi bağımlılığı olan
// `./LineupBuilder` kaynak ağacında HİÇ YOK (import çözülemez). Yani kaynak
// uygulamada bu bölüm kullanıcıya hiç görünmüyor. Çevirseydik kaynakta
// olmayan bir özellik EKLEMİŞ olurduk; "birebir aynı" olan, olmayan şeyi de
// koymamaktır. Backend uçları (`/api/predictions/*`) api_client.dart içinde
// duruyor — bölüm kaynakta canlandırılırsa çeviri buradan devam eder.
//
// KUPONA İŞLE bloğu çalışır: kupon taslak deposu bağlı, seçim diske yazılır
// ve "Kupon Oluştur" düğmesi kupon editörünü açar.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/ust_panel.dart';
import '../../widgets/form_strip.dart';
import '../../widgets/match_header.dart';
// AppTabs artık kullanılmıyor (maç detayının kendi çubuğu var) ama Özet
// sekmesindeki Accordion ve SurpriseBadge aynı dosyadan geliyor.
import '../../widgets/tabs.dart';
import 'comments_section.dart';
import 'coupon_pick_block.dart';
import 'istatistik_tab.dart';
import 'kriter_basari_listesi.dart';
import 'mac_bulten_sirasi_paneli.dart';
import 'mac_detay_sekme_ayarlari.dart';
import 'mac_detay_sekmeleri.dart';
import 'mac_radar_paneli.dart';
import 'mac_sonuc_anketi.dart';
import 'master_analysis_view.dart';
import 'match_detail_text.dart';
import 'match_info_card.dart';
import 'takim_fikstur_modal.dart';
import '../../widgets/takim_logo_zemin.dart';

/// Hangi sekme dalındayız? Kriter Kırılımı rotası HER dala ayrı kayıtlı
/// olduğu için (kaynaktaki sessiz-başarısızlık tuzağı), gezinirken bulunduğun
/// dalın kökünü kullanmak gerekir — yoksa kullanıcı sekme değiştirmiş olur.
String _dalKoku(BuildContext context) {
  final yol = GoRouterState.of(context).uri.path;
  final ilk = yol.split('/').where((p) => p.isNotEmpty).firstOrNull;
  return '/${ilk ?? 'bulten'}';
}

/// `api.match(no)` — maç detayı.
final matchProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>((ref, no) async {
      final d = await api.match(no);
      return Map<String, dynamic>.from(d as Map);
    });

class MatchDetailScreen extends ConsumerStatefulWidget {
  const MatchDetailScreen({super.key, required this.no, this.initialTab});

  final Object no;
  final String? initialTab;

  @override
  ConsumerState<MatchDetailScreen> createState() => _MatchDetailScreenState();
}

class _MatchDetailScreenState extends ConsumerState<MatchDetailScreen>
    with TickerProviderStateMixin {
  late List<MacDetaySekme> _sekmeler;
  late TabController _tc;

  @override
  void initState() {
    super.initState();
    _sekmeler = macDetayGorunurSekmeler();
    _tc = _denetleyiciKur(_baslangicIndeksi());
  }

  /// Rotadan gelen `?tab=` adı. Tanınmayan (ör. artık olmayan 'Radar') ya da
  /// kullanıcının KAPATTIĞI bir ad geldiğinde ekran ilk sekmeyle açılır —
  /// bağlantı bozuk diye boş bir ekrana düşülmez.
  int _baslangicIndeksi() {
    final ad = widget.initialTab;
    if (ad == null) return 0;
    final i = _sekmeler.indexWhere((s) => s.ad == ad);
    return i < 0 ? 0 : i;
  }

  TabController _denetleyiciKur(int index) =>
      TabController(length: _sekmeler.length, vsync: this, initialIndex: index)
        ..addListener(_sekmeDegisti);

  /// KUPONA İŞLE bloğunun görünürlüğü seçili sekmeye bağlı; parmakla yapılan
  /// geçişte de yeniden çizilmesi gerekir.
  void _sekmeDegisti() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _tc.removeListener(_sekmeDegisti);
    _tc.dispose();
    super.dispose();
  }

  /// Ayar sayfası KAYDEDİLEREK kapandıysa sekme listesi yeniden kurulur.
  /// Kullanıcının bulunduğu sekme hâlâ açıksa orada kalınır; kapatıldıysa ilk
  /// sekmeye dönülür.
  Future<void> _ayarlariAc() async {
    final kaydedildi = await macDetaySekmeAyarlariniAc(context);
    if (!kaydedildi || !mounted) return;
    final oncekiAd = _sekmeler[_tc.index].ad;
    setState(() {
      _sekmeler = macDetayGorunurSekmeler();
      final yeni = _sekmeler.indexWhere((s) => s.ad == oncekiAd);
      _tc.removeListener(_sekmeDegisti);
      _tc.dispose();
      _tc = _denetleyiciKur(yeni < 0 ? 0 : yeni);
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(matchProvider(widget.no));

    return Scaffold(
      body: filigranli(
        SafeArea(
          bottom: false,
          child: async.when(
            loading: () => Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  '$e',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                ),
              ),
            ),
            data: _govde,
          ),
        ),
      ),
    );
  }

  Widget _govde(Map<String, dynamic> m) {
    final a = (m['analysis'] as Map?) ?? const {};
    final s = (m['stats'] as Map?) ?? const {};
    final home = m['home'] as Map?;
    final away = m['away'] as Map?;
    final homeName = '${home?['mediumName'] ?? home?['name'] ?? ''}';
    final awayName = '${away?['mediumName'] ?? away?['name'] ?? ''}';

    // Fikstür, kaynak takım kimliği olmadan çekilemez. Kimlik yoksa takım
    // adının altındaki bağlantı HİÇ çizilmez — tıklanıp boş açılan bir kart
    // olmaz (kapsam dışı maçlarda bu kimlikler gelmiyor).
    final fiksturHome = m['footyHomeId'] != null && m['footySeasonId'] != null;
    final fiksturAway = m['footyAwayId'] != null && m['footySeasonId'] != null;

    final md = matchDate(m['date'] as String?);
    final score = m['score'] as Map?;
    final headerCenter = (m['status'] == 'finished' && score != null)
        ? '${score['home']} - ${score['away']}'
        : md.time;

    final dayLabel = _gunEtiketi(m['date'] as String?, md);

    return Column(
      children: [
        // İKİ AYRI PANEL (kullanıcı isteği, 2026-08-12 son tur): maç bilgi
        // alanı bir kart, SEKMELER ayrı bir kart.
        UstPanel(
          renk: AppColors.bgAlt,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              MatchHeader(
                home: homeName,
                away: awayName,
                homeLogo: (s['home'] as Map?)?['logo'] as String?,
                awayLogo: (s['away'] as Map?)?['logo'] as String?,
                league: m['league'] as String?,
                dateLabel: dayLabel,
                time: headerCenter,
                stadium: '${m['stadium'] ?? m['stadiumName'] ?? ''}',
                onBack: () => Navigator.of(context).maybePop(),
                onShare: () {},
                // Takım kartı İSTATİSTİK değil FİKSTÜR açar (kullanıcı kararı):
                // takımın oynadığı ve oynayacağı maçlar. Sezon istatistikleri
                // "İstatistik" sekmesinde zaten duruyor.
                onHomePress: fiksturHome
                    ? () => takimFiksturuAc(
                        context,
                        teamId: m['footyHomeId'],
                        seasonId: m['footySeasonId'],
                        name: homeName,
                        logo: (s['home'] as Map?)?['logo'] as String?,
                        league: m['league'] as String?,
                      )
                    : null,
                onAwayPress: fiksturAway
                    ? () => takimFiksturuAc(
                        context,
                        teamId: m['footyAwayId'],
                        seasonId: m['footySeasonId'],
                        name: awayName,
                        logo: (s['away'] as Map?)?['logo'] as String?,
                        league: m['league'] as String?,
                      )
                    : null,
              ),
            ],
          ),
        ),
        // SEKME PANELİ — kendi kartı, `surfaceSoft` zeminiyle bilgi
        // kartından ton farkıyla da ayrışır.
        UstPanel(
          renk: AppColors.surfaceSoft,
          child: MacDetaySekmeCubugu(
            controller: _tc,
            sekmeler: _sekmeler,
            onAyarlar: _ayarlariAc,
          ),
        ),
        // KUPONA İŞLE — Yorumlar sekmesi DIŞINDA her sekmede görünür
        // (kaynakta da `tab !== 'Yorumlar'`).
        if (_sekmeler[_tc.index].ad != 'Yorumlar')
          Container(
            width: double.infinity,
            color: AppColors.bg,
            padding: const EdgeInsets.only(
              left: Spacing.lg,
              right: Spacing.lg,
              top: Spacing.md,
            ),
            child: CouponPickBlock(
              m: m,
              onKuponOlustur: (roundId) => GoRouter.of(
                context,
              ).go('${_dalKoku(context)}/kupon-editor/$roundId'),
            ),
          ),
        // İÇERİK — parmakla sağa/sola kaydırınca sekme değişir; TabBarView
        // seçili sekmeyi denetleyici üzerinden çubukla paylaşır.
        Expanded(
          child: TabBarView(
            controller: _tc,
            children: [
              for (final sekme in _sekmeler)
                _sekmeIcerigi(sekme, m, a, s, homeName, awayName),
            ],
          ),
        ),
      ],
    );
  }

  Widget _sekmeIcerigi(
    MacDetaySekme sekme,
    Map<String, dynamic> m,
    Map a,
    Map s,
    String homeName,
    String awayName,
  ) {
    return SingleChildScrollView(
      // Her sekme KENDİ kaydırma konumunu korur; sekmeler arasında gidip
      // gelirken liste başa sarmaz.
      key: PageStorageKey<String>('mac-detay-${sekme.ad}'),
      padding: const EdgeInsets.fromLTRB(
        Spacing.lg,
        Spacing.lg,
        Spacing.lg,
        Spacing.xl,
      ),
      child: switch (sekme.ad) {
        'Özet' => _ozet(m, a, s, homeName, awayName),
        // MASTER ANALİZ — kriter hesabının tek doğruluk kaynağı BACKEND'dir.
        // Mühürlü haftada mühürlü değerlendirme gösterilir. Radar kıyası ayrı
        // sistem olarak sunulur.
        //
        // KRİTER BAŞARILARI (kullanıcı kararı, 2026-08-07): burada eskiden
        // kullanıcının kriter seçtiği panel vardı; o sistem tamamen kaldırıldı.
        // Yerine kriterlerin GEÇMİŞ karnesi geldi. Ekran hüküm vermez —
        // kullanıcı ham maçlara bakarak kendi kararını verir.
        'Analiz' => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MasterAnalysisView(no: widget.no),
            KriterBasariListesi(
              onKriterSec: (key, ad) => GoRouter.of(context).go(
                '${_dalKoku(context)}/kriter/'
                '${Uri.encodeComponent(key)}'
                '?ad=${Uri.encodeQueryComponent(ad)}',
              ),
            ),
          ],
        ),
        'İstatistik' => IstatistikTab(
          m: m,
          homeName: homeName,
          awayName: awayName,
        ),
        // OYNANMA YÜZDELERİ (Radar 3) ve ORAN TAKİBİ (Radar 4): aynı panelin
        // iki bölümü, ikisi de YALNIZ bu maçın kendi sırasını gösterir. Radar
        // ekranı 15 maçı birden listeler; maçın içindeyken tek satır lazım.
        'Oynanma Yüzdeleri' => MacRadarPaneli(
          m: m,
          bolum: MacRadarBolumu.oynanma,
        ),
        'Oran Takibi' => MacRadarPaneli(m: m, bolum: MacRadarBolumu.oran),
        // BÜLTEN SIRASI (Radar 5): bu maçın bültendeki sırası ve o sırada
        // geçmişte çıkan sonuçlar.
        'Bülten Sırası' => MacBultenSirasiPaneli(m: m),
        // YORUMLAR — yorum akışı ve moderasyon. Kaynakta da sekmenin tamamı
        // budur; Polls bölümü hiçbir ekrana bağlı değil (bkz. dosya başındaki
        // not).
        _ => CommentsSection(matchId: m['sportotoMatchId'] ?? widget.no),
      },
    );
  }

  Widget _ozet(
    Map<String, dynamic> m,
    Map a,
    Map s,
    String homeName,
    String awayName,
  ) {
    // Yorum kaynağı: varsa AI yorumu, yoksa kural-tabanlı analiz yorumu.
    final comment = m['aiComment'] ?? a['comment'];
    final sinyaller = buildSinyaller(m);
    final tags = m['tags'] as List?;
    final hLast5 = (s['home'] as Map?)?['last5'] as List?;
    final aLast5 = (s['away'] as Map?)?['last5'] as List?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MatchInfoCard(m: m),

        // ── MAÇ ÖZETİ ──
        Container(
          margin: const EdgeInsets.only(bottom: Spacing.md),
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: AppRadius.mdR,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'MAÇ ÖZETİ',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10,
                  fontWeight: AppFont.heavy,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                humanize(comment),
                maxLines: 6,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 12,
                  height: 16 / 12,
                ),
              ),
            ],
          ),
        ),

        Align(
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.only(bottom: Spacing.sm),
            child: SurpriseBadge(
              label: a['label'],
              labelColor: a['labelColor'] as String?,
            ),
          ),
        ),

        // ── MAÇ SONUCU ANKETİ (kullanıcı isteği, 2026-08-11) ──
        // Kimlik, yorum bölümüyle AYNI kaynaktan alınır: anket oyları ile
        // yorumlar aynı maça bağlanmalı, yoksa iki bölüm farklı "maç"lardan
        // konuşur.
        MacSonucAnketi(
          matchId: m['sportotoMatchId'] ?? widget.no,
          homeName: homeName,
          awayName: awayName,
          macBasladi: m['started'] == true,
        ),

        // ── RİSK ETİKETLERİ — hızlı okunur, her biri nedenli
        //    (backend'den; veri yoksa satır hiç yok) ──
        if (tags != null && tags.isNotEmpty)
          Accordion(
            title: 'Risk Etiketleri',
            icon: Icons.sell_outlined,
            defaultOpen: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final tg in tags.cast<Map>())
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '• ${tg['t']}',
                          style: TextStyle(
                            color: AppColors.text,
                            fontSize: 13,
                            fontWeight: AppFont.black,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: Text(
                            '${tg['why']}',
                            style: TextStyle(
                              color: AppColors.textSoft,
                              fontSize: 11.5,
                              height: 16 / 11.5,
                              fontWeight: AppFont.semibold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

        // ── ÖNE ÇIKAN NOTLAR ──
        if (sinyaller.isNotEmpty)
          Accordion(
            title: 'Öne Çıkan Notlar',
            icon: Icons.star_outline,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final sg in sinyaller)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      '•  $sg',
                      style: TextStyle(
                        color: AppColors.textSoft,
                        fontSize: 12.5,
                        height: 17 / 12.5,
                      ),
                    ),
                  ),
              ],
            ),
          ),

        // ── SON MAÇLAR ──
        if ((hLast5?.isNotEmpty ?? false) || (aLast5?.isNotEmpty ?? false))
          Accordion(
            title: 'Son Maçlar',
            icon: Icons.calendar_month_outlined,
            defaultOpen: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Açıklama şeridi: ikon → anlam.
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Image.asset(
                        'assets/venue/home-win.png',
                        width: 15,
                        height: 15,
                      ),
                      Text(' iç saha   ·  ', style: _legendStil),
                      Image.asset(
                        'assets/venue/away-win.png',
                        width: 15,
                        height: 15,
                      ),
                      Text(
                        ' deplasman   ·   🟢 galibiyet · 🟡 beraberlik · '
                        '🔴 mağlubiyet',
                        style: _legendStil,
                      ),
                    ],
                  ),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _sonMaclarKolonu(
                        homeName,
                        (s['home'] as Map?)?['last5detail'] as List?,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _sonMaclarKolonu(
                        awayName,
                        (s['away'] as Map?)?['last5detail'] as List?,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _sonMaclarKolonu(String ad, List? detay) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          ad,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.text,
            fontSize: 12,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 6),
        if (detay == null || detay.isEmpty)
          Padding(
            padding: EdgeInsets.only(top: 2),
            child: Text(
              'Detay yok',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          )
        else
          for (final d in detay.cast<Map>())
            Container(
              padding: const EdgeInsets.symmetric(vertical: 4),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Logo(
                    uri: d['oppLogo'] as String?,
                    name: d['oppName'] as String?,
                    size: 16,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${d['oppName'] ?? '—'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11.5,
                        fontWeight: AppFont.semibold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${d['score'] ?? ''}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: AppFont.heavy,
                      color: d['result'] == 'G'
                          ? AppColors.green
                          : d['result'] == 'M'
                          ? AppColors.red
                          : AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(width: 6),
                  VenueIcon(
                    result: d['result'] as String?,
                    isHome: d['isHome'] == true,
                    size: 20,
                  ),
                ],
              ),
            ),
      ],
    );
  }

  /// Kaynaktaki `dayLabel`: bugün/yarın ise adıyla, değilse tarih.
  String _gunEtiketi(String? iso, MatchDateParts md) {
    final dt = iso != null ? DateTime.tryParse(iso)?.toLocal() : null;
    if (dt == null) return md.day;
    final now = DateTime.now();
    bool ayniGun(DateTime x, DateTime y) =>
        x.year == y.year && x.month == y.month && x.day == y.day;
    if (ayniGun(dt, now)) return 'Bugün';
    if (ayniGun(dt, now.add(const Duration(days: 1)))) return 'Yarın';
    return md.day;
  }
}

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _legendStil =>
    TextStyle(color: AppColors.textMuted, fontSize: 10, height: 14 / 10);
