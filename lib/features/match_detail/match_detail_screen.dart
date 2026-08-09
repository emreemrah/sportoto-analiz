// KAYNAK: app/src/screens/MatchDetailScreen.js (1142 satır)
//
// ÇEVRİLEN: ekran iskeleti, MatchHeader, 5 sekmeli çubuk, **Özet sekmesinin
// tamamı**, **Analiz sekmesi** (MasterAnalysisView + KriterBasariListesi →
// KriterKirilimScreen) ve **Radar sekmesi** (MacRadarPaneli · Radar 3/4).
//
// POLLS (app/src/Polls.js · 348 satır) BİLEREK ÇEVRİLMEDİ — kaynakta ÖLÜ KOD:
// hiçbir dosya `PollsSection`'ı içe aktarmıyor ve kendi bağımlılığı olan
// `./LineupBuilder` kaynak ağacında HİÇ YOK (import çözülemez). Yani kaynak
// uygulamada bu bölüm kullanıcıya hiç görünmüyor. Çevirseydik kaynakta
// olmayan bir özellik EKLEMİŞ olurduk; "birebir aynı" olan, olmayan şeyi de
// koymamaktır. Backend uçları (`/api/predictions/*`) api_client.dart içinde
// duruyor — bölüm kaynakta canlandırılırsa çeviri buradan devam eder.
//
// KUPONA İŞLE bloğu ARTIK ÇALIŞIYOR: kupon taslak deposu (Adım 3) bağlandı,
// seçim diske yazılıyor. "Kupon Oluştur" düğmesinin gideceği editör ekranı
// henüz çevrilmedi ve bunu söylüyor.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/form_strip.dart';
import '../../widgets/match_header.dart';
import '../../widgets/tabs.dart';
import 'comments_section.dart';
import 'coupon_pick_block.dart';
import 'istatistik_tab.dart';
import 'kriter_basari_listesi.dart';
import 'mac_radar_paneli.dart';
import 'master_analysis_view.dart';
import 'match_detail_text.dart';
import 'match_info_card.dart';
import 'takim_fikstur_modal.dart';

/// Hangi sekme dalındayız? Kriter Kırılımı rotası HER dala ayrı kayıtlı
/// olduğu için (kaynaktaki sessiz-başarısızlık tuzağı), gezinirken bulunduğun
/// dalın kökünü kullanmak gerekir — yoksa kullanıcı sekme değiştirmiş olur.
String _dalKoku(BuildContext context) {
  final yol = GoRouterState.of(context).uri.path;
  final ilk = yol.split('/').where((p) => p.isNotEmpty).firstOrNull;
  return '/${ilk ?? 'bulten'}';
}

const List<String> _kTabs = [
  'Özet',
  'Analiz',
  'İstatistik',
  'Radar',
  'Yorumlar',
];

const Map<String, String> _kTabIcons = {
  'Özet': '🕐',
  'Analiz': '📈',
  'İstatistik': '📊',
  'Radar': '🎯',
  'Yorumlar': '💬',
};

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

class _MatchDetailScreenState extends ConsumerState<MatchDetailScreen> {
  late String _tab = widget.initialTab ?? 'Özet';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(matchProvider(widget.no));

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: async.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                '$e',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12.5,
                ),
              ),
            ),
          ),
          data: _govde,
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
        AppTabs(
          tabs: _kTabs,
          active: _tab,
          onChange: (t) => setState(() => _tab = t),
          icons: _kTabIcons,
        ),
        // KUPONA İŞLE — Yorumlar sekmesi DIŞINDA her sekmede görünür
        // (kaynakta da `tab !== 'Yorumlar'`).
        if (_tab != 'Yorumlar')
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
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              Spacing.lg,
              Spacing.lg,
              Spacing.lg,
              Spacing.xl,
            ),
            child: switch (_tab) {
              'Özet' => _ozet(m, a, s, homeName, awayName),
              // MASTER ANALİZ — kriter hesabının tek doğruluk kaynağı
              // BACKEND'dir. Mühürlü haftada mühürlü değerlendirme gösterilir.
              // Radar kıyası ayrı sistem olarak sunulur.
              //
              // KRİTER BAŞARILARI (kullanıcı kararı, 2026-08-07): burada
              // eskiden kullanıcının kriter seçtiği panel vardı; o sistem
              // tamamen kaldırıldı. Yerine kriterlerin GEÇMİŞ karnesi geldi.
              // Ekran hüküm vermez — kullanıcı ham maçlara bakarak kendi
              // kararını verir.
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
              // RADAR SEKMESİ (kullanıcı isteği, 2026-08-07): Radar 3/4 maçın
              // içinde, YALNIZ bu maçın kendi sırasıyla. Radar ekranı 15 maçı
              // birden listeler; maçın içindeyken tek satır lazım.
              'Radar' => MacRadarPaneli(m: m),
              // YORUMLAR — yorum akışı ve moderasyon. Kaynakta da sekmenin
              // tamamı budur; Polls bölümü hiçbir ekrana bağlı değil (bkz.
              // dosya başındaki not).
              _ => CommentsSection(matchId: m['sportotoMatchId'] ?? widget.no),
            },
          ),
        ),
      ],
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
              const Text(
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
                style: const TextStyle(
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

        // ── RİSK ETİKETLERİ — hızlı okunur, her biri nedenli
        //    (backend'den; veri yoksa satır hiç yok) ──
        if (tags != null && tags.isNotEmpty)
          Accordion(
            title: 'Risk Etiketleri',
            icon: '🏷️',
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
                          style: const TextStyle(
                            color: AppColors.text,
                            fontSize: 13,
                            fontWeight: AppFont.black,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(left: 12),
                          child: Text(
                            '${tg['why']}',
                            style: const TextStyle(
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
            icon: '⭐',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final sg in sinyaller)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      '•  $sg',
                      style: const TextStyle(
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
            icon: '🗓️',
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
                      const Text(' iç saha   ·  ', style: _legendStil),
                      Image.asset(
                        'assets/venue/away-win.png',
                        width: 15,
                        height: 15,
                      ),
                      const Text(
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
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 12,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 6),
        if (detay == null || detay.isEmpty)
          const Padding(
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
              decoration: const BoxDecoration(
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
                      style: const TextStyle(
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

const TextStyle _legendStil = TextStyle(
  color: AppColors.textMuted,
  fontSize: 10,
  height: 14 / 10,
);
