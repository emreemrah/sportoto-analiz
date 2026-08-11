// KAYNAK: app/src/screens/UserDashboardScreen.js — çeviri + YENİDEN DÜZEN.
//
// KAYNAKTAN BİLİNÇLİ SAPMA (2026-08-10, kullanıcı isteği) — "HAFTALIK BAŞARI":
// RN'deki "Başarı Paneli" (Sade/Detaylı/Teknik görünümleri) bu ekranda yeni
// düzene taşındı; RN tarafı henüz eski düzende. VERİ VE HESAP AYNI KALDI:
// api.rounds + api.history + api.systemScorecard + yerel kupon deposu;
// başarı YALNIZ resmi Spor Toto sonucuyla kesinleşir, canlı/geçici yazılmaz.
// Değişen yalnız sunum:
//  * Üstte hafta/sezon gezme + tamamlanma durumu + KUPON SEÇİMİ.
//  * "Sen" ve "Sistem" yan yana: doğru · toplam(resmî) · başarı yüzdesi.
//  * Sekmeler: Özet / Maçlar / Geçmiş (eski Sade/Detaylı/Teknik yerine;
//    diskte kalmış eski tercih değeri okunurken Özet'e düşer).
//  * Maçlar: Tümü/Doğru/Yanlış/Bekleyen filtreleri; kartta takım adları TAM
//    (kesme yok), tarih·saat, resmî skor, sonuç, Sen ve Sistem tahmini ayrı
//    satırlarda; ✅ doğru · ❌ yanlış · ⏳ bekliyor.
//  * Teknik bilgiler EN ALTTA, açılıp kapanan bölümde (varsayılan kapalı).

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/coupon/coupon_store.dart';
import '../../core/live_logic.dart';
import '../../core/network/api_client.dart';
import '../../core/prefs.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/score_legend.dart';
import '../../widgets/states.dart';

/// JS'te `!!(m.result && m.score)` — boş dizge de FALSY sayılır.
/// KAYNAKTAN BİLİNÇLİ SAPMA (2026-08-10): noter kararlı (viaNotary) maç
/// skorsuz da çözülmüş sayılır — bkz. bulletin_format.officialResolved.
bool _officialResolved(Map? m) {
  final r = m?['result'];
  final s = m?['score'];
  return r != null && '$r'.isNotEmpty && (s != null || m?['viaNotary'] == true);
}

String? _sysSymOf(Map m) {
  final p = m['prediction'];
  final sym = p is Map ? p['symbol'] : null;
  if (sym == null || '$sym'.isEmpty || sym == '-') return null;
  return '$sym';
}

typedef SkorGorunum = ({
  Color color,
  String score,
  String? result,
  String kind,
});

/// Skor renk kuralı (ANA KURAL): yeşil = resmi sonuç · sarı = henüz resmi değil ·
/// kırmızı = canlı. Resmi yoksa geçici skor gösterilir ama başarıya SAYILMAZ —
/// yalnız renk/bilgi amaçlı.
SkorGorunum? _scoreView(Map? m) {
  final r = m?['result'];
  final s = m?['score'];
  if (r != null && '$r'.isNotEmpty && s is Map) {
    return (
      color: AppColors.success,
      score: '${s['home']}-${s['away']}',
      result: '$r',
      kind: 'official',
    );
  }
  final pv = m?['provisional'];
  if (pv is Map && pv['score'] is Map) {
    final ps = pv['score'] as Map;
    final live = pv['live'] == true;
    return (
      color: live ? AppColors.accent : AppColors.warning,
      score: '${ps['home']}-${ps['away']}',
      result: resultFromScore(ps),
      kind: live ? 'live' : 'prov',
    );
  }
  return null;
}

typedef KuponSonuc = ({
  Object? id,
  Object? couponNo,
  bool ranked,
  int hit,
  int resolved,
  Object? columns,
  Object? amount,
});

class UserDashboardScreen extends StatefulWidget {
  const UserDashboardScreen({super.key});

  @override
  State<UserDashboardScreen> createState() => _UserDashboardScreenState();
}

class _UserDashboardScreenState extends State<UserDashboardScreen> {
  Map<String, dynamic>? _rounds;
  Object? _selectedId;
  Map<String, dynamic>? _hist;
  bool _histLoading = false;
  Map<String, dynamic>? _scorecard;

  /// Sekme: 'ozet' | 'maclar'. Diskte kalmış eski değerler (Sade/Detaylı/
  /// Teknik dönemi ve kaldırılan 'gecmis') Özet'e düşer.
  late String _view = getPref('userDashView') == 'maclar' ? 'maclar' : 'ozet';

  /// Maçlar sekmesi filtresi — oturumluk durum, tercihe yazılmaz.
  String _macFiltre = 'all';

  /// "Sen" hesabının kaynağı olan kupon. null = varsayılan (dereceli kupon,
  /// o yoksa haftanın ilk kuponu). Hafta değişince sıfırlanır.
  Object? _seciliKuponId;

  /// Teknik bilgiler bölümü — varsayılan KAPALI (ana ekranı kalabalıklaştırmaz).
  bool _teknikAcik = false;

  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _boot();
    // sunucudan kalıcı kuponlar
    syncFromServer().then((synced) {
      if (synced && mounted) setState(() {});
    });
  }

  Future<void> _boot() async {
    setState(() => _error = null);
    try {
      // İkisi PARALEL: karne alınamazsa hafta listesi yine gelir.
      final sonuclar = await Future.wait([
        api.rounds(),
        api.systemScorecard().catchError((_) => null),
      ]);
      if (!mounted) return;
      final r = (sonuclar[0] as Map).cast<String, dynamic>();
      setState(() {
        _rounds = r;
        _scorecard = (sonuclar[1] as Map?)?.cast<String, dynamic>();
      });
      // Varsayılan: en son SONUÇLANMIŞ hafta (güncelden bir önceki) — hemen
      // başarı görünür.
      final all = (r['rounds'] as List?) ?? const [];
      final curIdx = all.indexWhere(
        (x) => (x as Map)['id'] == r['currentRoundId'],
      );
      final nav = curIdx >= 0 ? all.sublist(0, curIdx + 1) : all;
      final def = nav.length >= 2
          ? (nav[nav.length - 2] as Map)['id']
          : (r['currentRoundId'] ??
                (nav.isNotEmpty ? (nav.last as Map)['id'] : null));
      setState(() => _selectedId = def);
      _haftaYukle();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _haftaYukle() async {
    final rid = _selectedId;
    if (rid == null) return;
    setState(() => _histLoading = true);
    try {
      final h = (await api.history(rid) as Map).cast<String, dynamic>();
      // BAYAT YANIT KORUMASI: kullanıcı hafta değiştirdiyse geç gelen yanıt
      // yeni haftanın verisini EZMEZ.
      if (mounted && _selectedId == rid) {
        setState(() => _hist = {...h, 'roundId': rid});
      }
    } catch (_) {
      if (mounted && _selectedId == rid) setState(() => _hist = null);
    } finally {
      if (mounted && _selectedId == rid) setState(() => _histLoading = false);
    }
  }

  void _haftaSec(Object? id) {
    if (id == null || id == _selectedId) return;
    setState(() {
      _selectedId = id;
      _seciliKuponId = null; // yeni haftanın kuponları farklı
      _hist = null;
    });
    _haftaYukle();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _rounds == null) {
      return _kabuk(
        const LoadingState(message: 'Haftalık başarın hazırlanıyor…'),
      );
    }
    if (_error != null) {
      return _kabuk(
        SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: Spacing.lg),
          child: ErrorState(message: _error, onRetry: _boot),
        ),
      );
    }

    // ——— hafta gezme ———
    final all = (_rounds?['rounds'] as List?) ?? const [];
    final currentRoundId = _rounds?['currentRoundId'];
    final curIdx = all.indexWhere((r) => (r as Map)['id'] == currentRoundId);
    final navRounds = curIdx >= 0 ? all.sublist(0, curIdx + 1) : all;
    final selIdx = navRounds.indexWhere((r) => (r as Map)['id'] == _selectedId);
    final selMeta = selIdx >= 0 ? navRounds[selIdx] as Map : null;
    final canPrev = selIdx > 0;
    final canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

    final week = _haftaHesap();

    return _kabuk(
      ListView(
        padding: const EdgeInsets.fromLTRB(
          Spacing.lg,
          Spacing.lg,
          Spacing.lg,
          Spacing.xxxl,
        ),
        children: [
          const Text(
            'Haftalık Başarı',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 22,
              fontWeight: AppFont.black,
            ),
          ),
          const SizedBox(height: Spacing.md),
          _haftaGezme(navRounds, selIdx, selMeta, canPrev, canNext),

          if (_histLoading && _hist == null)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Column(
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 8),
                  Text(
                    'Hafta yükleniyor…',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12.5,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ],
              ),
            )
          else ...[
            _durumSatiri(week),
            if (week.kuponlar.length > 1) _kuponSecici(week),
            _senKarti(week),
            _sistemSatiri(),
            _sekmeler(),
            if (_view == 'ozet') ...[
              _kuponDurumu(week),
              _kapanisBaglantisi(),
            ] else
              ..._maclarSekmesi(week),
            _teknikBolum(selMeta, week),
          ],
        ],
      ),
    );
  }

  Widget _kabuk(Widget govde) => Scaffold(
    backgroundColor: AppColors.bg,
    appBar: AppBar(title: const Text('Haftalık Başarı')),
    body: govde,
  );

  /// Seçili hafta hesabı (resmi sonuç + sistem + KULLANICI kuponu).
  _Hafta _haftaHesap() {
    final wm = (_hist?['matches'] as List?) ?? const [];
    final total = wm.length;
    final resolved = wm.where((m) => _officialResolved(m as Map)).toList();
    final hasPrize = _hist?['prize'] != null;
    final fullyResolved = total > 0 && resolved.length == total;
    final resultMap = <Object, String>{
      for (final m in resolved) (m as Map)['no'] as Object: '${m['result']}',
    };

    // Kullanıcının GERÇEK kuponları — resmi sonuçlara göre.
    KuponSonuc? couponResult(Map? coupon) {
      final v = finalVersion(coupon);
      if (v == null) return null;
      var hit = 0, res = 0;
      for (final sc in ((v['selections'] as List?) ?? const []).cast<Map>()) {
        final r = resultMap[sc['no']];
        if (r != null) {
          res += 1;
          final sec = (sc['selectedOutcomes'] as List?) ?? const [];
          if (sec.contains(r)) hit += 1;
        }
      }
      return (
        id: coupon!['id'],
        couponNo: coupon['couponNo'],
        ranked: coupon['isRankedCoupon'] == true,
        hit: hit,
        resolved: res,
        columns: v['columnCount'],
        amount: v['totalAmount'],
      );
    }

    final coupons = _selectedId != null
        ? getWeekCoupons(_selectedId)
        : <Map<String, dynamic>>[];
    final ranked = getRankedCoupon(_selectedId);
    final rankedRes = ranked != null ? couponResult(ranked) : null;
    final others = <KuponSonuc>[
      for (final c in coupons)
        if (c['isRankedCoupon'] != true) ?couponResult(c),
    ];

    // "SEN" HESABININ KAYNAĞI — kullanıcının SEÇTİĞİ kupon; seçim yoksa
    // dereceli kupon, o da yoksa haftanın ilk kuponu. Seçim listedeki bir
    // kuponu göstermiyorsa (hafta değişti) varsayılana düşülür.
    Map<String, dynamic>? secili;
    if (_seciliKuponId != null) {
      for (final c in coupons) {
        if (c['id'] == _seciliKuponId) {
          secili = c;
          break;
        }
      }
    }
    secili ??= ranked ?? (coupons.isNotEmpty ? coupons.first : null);
    final seciliRes = secili != null ? couponResult(secili) : null;

    // Seçili kupondaki maç bazlı seçim (no → seçilen sonuçlar).
    final seciliPicks = <Object, List>{};
    if (secili != null) {
      final sv = finalVersion(secili);
      if (sv != null) {
        for (final sc
            in ((sv['selections'] as List?) ?? const []).cast<Map>()) {
          final sec = (sc['selectedOutcomes'] as List?) ?? const [];
          if (sec.isNotEmpty) seciliPicks[sc['no'] as Object] = sec;
        }
      }
    }

    final String status;
    if (resolved.isEmpty) {
      status = 'Sonuçlar bekleniyor';
    } else if (!fullyResolved) {
      status = 'Resmi sonuçlar bekleniyor · ${resolved.length}/$total geldi';
    } else if (!hasPrize) {
      status = 'Maç sonuçları tamamlandı · İkramiye bekleniyor';
    } else {
      status = 'Sonuçlar açıklandı';
    }

    return _Hafta(
      total: total,
      resolvedCount: resolved.length,
      fullyResolved: fullyResolved,
      hasPrize: hasPrize,
      status: status,
      hasCoupon: coupons.isNotEmpty,
      rankedRes: rankedRes,
      others: others,
      seciliRes: seciliRes,
      seciliPicks: seciliPicks,
      kuponlar: [?rankedRes, ...others],
      hasRanked: ranked != null,
      rankedNo: ranked?['couponNo'],
    );
  }

  Widget _haftaGezme(
    List all,
    int selIdx,
    Map? selMeta,
    bool canPrev,
    bool canNext,
  ) => Container(
    padding: const EdgeInsets.all(Spacing.sm),
    decoration: BoxDecoration(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      boxShadow: AppShadow.card,
    ),
    child: Row(
      children: [
        _ok('‹', canPrev, 'Önceki hafta', () {
          _haftaSec((all[selIdx - 1] as Map)['id']);
        }),
        Expanded(
          child: Column(
            children: [
              Text(
                '${selMeta?['name'] ?? '—'}',
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 17,
                  fontWeight: AppFont.black,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  '${selMeta?['year'] ?? ''} Sezonu',
                  style: const TextStyle(
                    color: Color(0xFF9DB0CD),
                    fontSize: 11,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
        _ok('›', canNext, 'Sonraki hafta', () {
          _haftaSec((all[selIdx + 1] as Map)['id']);
        }),
      ],
    ),
  );

  Widget _ok(String isaret, bool acik, String etiket, VoidCallback onTap) =>
      Opacity(
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
              decoration: const BoxDecoration(
                color: AppColors.darkCardSoft,
                shape: BoxShape.circle,
              ),
              child: Text(
                isaret,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 24,
                  height: 26 / 24,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
          ),
        ),
      );

  /// Tamamlanma durumu — hafta gezmenin hemen altında tek satır.
  Widget _durumSatiri(_Hafta week) => Container(
    margin: const EdgeInsets.only(top: Spacing.sm),
    padding: const EdgeInsets.symmetric(horizontal: Spacing.md, vertical: 8),
    decoration: BoxDecoration(
      color: (week.fullyResolved && week.hasPrize)
          ? AppColors.successSoft
          : AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(
        color: (week.fullyResolved && week.hasPrize)
            ? AppColors.success
            : AppColors.border,
      ),
    ),
    child: Text(
      week.status,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: (week.fullyResolved && week.hasPrize)
            ? AppColors.success
            : AppColors.text,
        fontSize: 12.5,
        fontWeight: AppFont.heavy,
      ),
    ),
  );

  /// KUPON SEÇİMİ — "Sen" hesabının hangi kupondan okunduğunu kullanıcı
  /// seçer. Tek kupon varken seçici çizilmez (seçilecek şey yok).
  Widget _kuponSecici(_Hafta week) => Padding(
    padding: const EdgeInsets.only(top: Spacing.sm),
    child: Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final k in week.kuponlar)
          _cip(
            '${k.ranked ? '⭐ ' : ''}Kupon ${k.couponNo}',
            secili: k.id == week.seciliRes?.id,
            onTap: () => setState(() => _seciliKuponId = k.id),
          ),
      ],
    ),
  );

  Widget _cip(String etiket, {required bool secili, VoidCallback? onTap}) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: secili ? AppColors.primary : AppColors.card,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(
              color: secili ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Text(
            etiket,
            style: TextStyle(
              color: secili ? AppColors.white : AppColors.textSoft,
              fontSize: 12,
              fontWeight: AppFont.heavy,
            ),
          ),
        ),
      );

  /// Seçili haftanın SİSTEM karne kaydı — Genel Özet ve Hafta Hafta ile AYNI
  /// MERKEZÎ hesap (backend: mühürlü TEKLİ ana tahmin × resmî 1/X/2; ikisi de
  /// olmayan maç sayılmaz). Üst kart ayrı bir yerel hesap YAPMAZ.
  ///
  /// DÜZELTME (2026-08-10, kullanıcı bulgusu): eski kart, bültendeki ÇOKLU
  /// ihtimalli sistem önerisini pickHits ile sayıyordu (53. Hafta 13/14 %93);
  /// Geçmiş bölümü ise karnenin tekli hesabını gösteriyordu (5/14 %36). İki
  /// bölüm aynı haftaya farklı sayı basamaz — tek kaynak karnedir.
  Map? _karneHaftasi() {
    final weeks = (_scorecard?['weeks'] as List?) ?? const [];
    for (final w in weeks.cast<Map>()) {
      if ('${w['roundId']}' == '$_selectedId') return w;
    }
    return null;
  }

  /// SEN kartı — kullanıcının seçili kupon başarısı, tam genişlik.
  ///
  /// ROL AYRIMI (2026-08-10, kullanıcı kararı): bu ekran KULLANICIYI anlatır.
  /// Önceki çift ölçülü SİSTEM kartı ("Kupon başarısı" + "Ana tahmin") ve
  /// Geçmiş sekmesindeki karne özeti, Sistem Karnesi ekranıyla üst üste
  /// binip kafa karıştırıyordu — kaldırıldı. Sistem başarısının tek adresi
  /// Sistem Karnesi'dir; burada yalnız tek satırlık özet + bağlantı durur
  /// (_sistemSatiri).
  Widget _senKarti(_Hafta week) {
    final sen = week.seciliRes;
    return Padding(
      padding: const EdgeInsets.only(top: Spacing.sm),
      child: _skorKarti(
        baslik: week.seciliRes?.ranked == true
            ? 'SEN · Kupon ${sen?.couponNo} (dereceli)'
            : sen != null
            ? 'SEN · Kupon ${sen.couponNo}'
            : 'SEN',
        dogru: sen?.hit,
        toplam: sen?.resolved,
        bosNot: week.hasCoupon ? 'sonuç bekleniyor' : 'Bu hafta kupon yok',
      ),
    );
  }

  /// Sistemin TEK SATIRLIK özeti: karnenin ana tahmin kaydı + karneye
  /// bağlantı. Sayı karneden AYNEN okunur; karnede kayıt yoksa uydurulmaz.
  Widget _sistemSatiri() {
    final karne = _karneHaftasi();
    final degerlendirilen = ((karne?['evaluated'] as num?) ?? 0).toInt();
    final ozet = karne == null
        ? 'resmî karne kaydı yok'
        : degerlendirilen == 0
        ? 'sonuç bekleniyor'
        : '${karne['correct']}/$degerlendirilen · %${karne['accuracy']}';
    return Semantics(
      button: true,
      label: 'Sistem Karnesi ekranını aç',
      child: GestureDetector(
        onTap: () => context.go('/profil/sistem-karnesi'),
        behavior: HitTestBehavior.opaque,
        child: Container(
          margin: const EdgeInsets.only(top: Spacing.sm),
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.md,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: RichText(
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  text: TextSpan(
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                      fontWeight: AppFont.bold,
                    ),
                    children: [
                      const TextSpan(text: 'Sistem ana tahmin: '),
                      TextSpan(
                        text: ozet,
                        style: const TextStyle(
                          color: AppColors.text,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Sistem Karnesi ›',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 12,
                  fontWeight: AppFont.heavy,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Tek karşılaştırma kartı. Yüzde YALNIZ değerlendirilen maçlardan; hiç
  /// sonuç yoksa sayı UYDURULMAZ, not yazılır.
  Widget _skorKarti({
    required String baslik,
    required int? dogru,
    required int? toplam,
    required String bosNot,
  }) {
    final yuzde = (dogru != null && toplam != null && toplam > 0)
        ? (dogru / toplam * 100).round()
        : null;
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            baslik,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 10.5,
              fontWeight: AppFont.black,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          if (dogru == null || toplam == null || toplam == 0)
            Text(
              bosNot,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12.5,
                fontWeight: AppFont.semibold,
              ),
            )
          else ...[
            RichText(
              text: TextSpan(
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 24,
                  fontWeight: AppFont.black,
                ),
                children: [
                  TextSpan(
                    text: '$dogru',
                    style: const TextStyle(color: AppColors.success),
                  ),
                  TextSpan(
                    text: '/$toplam',
                    style: const TextStyle(
                      color: AppColors.textSoft,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'doğru · %$yuzde başarı',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 11.5,
                fontWeight: AppFont.bold,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ——— Sekmeler ———

  // 'Geçmiş' sekmesi KALDIRILDI (2026-08-10, rol ayrımı): içeriği Sistem
  // Karnesi'nin özetiydi; karne özeti artık yalnız karnede.
  static const List<({String k, String l})> _sekmeListesi = [
    (k: 'ozet', l: 'Özet'),
    (k: 'maclar', l: 'Maçlar'),
  ];

  Widget _sekmeler() => Padding(
    padding: const EdgeInsets.only(top: Spacing.md, bottom: Spacing.xs),
    child: Row(
      children: [
        for (final s in _sekmeListesi) ...[
          Expanded(
            child: _cip(
              s.l,
              secili: _view == s.k,
              onTap: () {
                setState(() => _view = s.k);
                setPref('userDashView', s.k);
              },
            ),
          ),
          if (s.k != 'maclar') const SizedBox(width: 6),
        ],
      ],
    ),
  );

  // ——— Özet sekmesi ———

  Widget _kart(List<Widget> children) => Container(
    margin: const EdgeInsets.only(top: Spacing.sm),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadow.soft,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    ),
  );

  Widget _kuponDurumu(_Hafta week) {
    if (!week.hasCoupon) {
      return Container(
        margin: const EdgeInsets.only(top: Spacing.sm, bottom: Spacing.md),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
          boxShadow: AppShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Bu hafta kupon oluşturmadın',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 15,
                fontWeight: AppFont.black,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Bu haftanın resmi sonuçları görüntülenebilir, ancak senin başarı hesabın için kayıtlı kupon yok.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12.5,
                height: 18 / 12.5,
              ),
            ),
            const SizedBox(height: Spacing.sm),
            _dugme('Bülten Detayını Gör', () => context.go('/bulten')),
          ],
        ),
      );
    }

    final r = week.rankedRes;
    return Container(
      margin: const EdgeInsets.only(top: Spacing.sm, bottom: Spacing.md),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.warning, width: 1.5),
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '⭐ ANA DERECE · Dereceli Kupon',
            style: TextStyle(
              color: Color(0xFF7A4A00),
              fontSize: 10.5,
              fontWeight: AppFont.black,
              letterSpacing: 0.5,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: r == null
                ? const Text(
                    '—',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 20,
                      fontWeight: AppFont.black,
                    ),
                  )
                : RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 20,
                        fontWeight: AppFont.black,
                      ),
                      children: [
                        if (r.resolved > 0) ...[
                          TextSpan(
                            text: '${r.hit}',
                            style: const TextStyle(color: AppColors.success),
                          ),
                          TextSpan(text: '/${r.resolved} doğru'),
                          if (r.resolved < 15)
                            TextSpan(
                              text: '  · ${r.resolved}/15 resmi',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                        ] else
                          const TextSpan(text: 'sonuçlar bekleniyor'),
                      ],
                    ),
                  ),
          ),
          if (week.others.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(top: Spacing.md, bottom: 4),
              child: Text(
                'Diğer Kuponlar · ${week.others.length}',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11.5,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
            for (final o in week.others) _digerKuponSatiri(o),
          ],
          const SizedBox(height: Spacing.sm),
          _dugme('Kuponlarım', () => context.go('/kuponlarim')),
        ],
      ),
    );
  }

  Widget _digerKuponSatiri(KuponSonuc o) => GestureDetector(
    // 'Coupons' diye bir ekran YOK — kaynakta bu satır hiçbir yere gitmiyordu.
    // Kuponlarım sekmesindeki GERÇEK sonuç ekranına gider.
    onTap: () =>
        context.go('/kuponlarim/kupon-sonuc/$_selectedId?couponId=${o.id}'),
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: RichText(
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              text: TextSpan(
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 13,
                  fontWeight: AppFont.bold,
                ),
                children: [
                  TextSpan(text: 'Kupon ${o.couponNo}'),
                  const TextSpan(
                    text: '  · Derecesiz',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          RichText(
            text: TextSpan(
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: AppFont.semibold,
              ),
              children: [
                if (o.resolved > 0) ...[
                  TextSpan(
                    text: '${o.hit}',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontWeight: AppFont.black,
                    ),
                  ),
                  TextSpan(text: '/${o.resolved} doğru'),
                ] else
                  TextSpan(text: '${o.columns} kolon · ${o.amount}₺'),
                const TextSpan(text: '  ›'),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _dugme(String metin, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 11),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(
        metin,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 13.5,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );

  /// HAFTA KAPANIŞI — seçili haftanın sen vs sistem karnesi.
  Widget _kapanisBaglantisi() => GestureDetector(
    onTap: () => context.go('/ana-sayfa/hafta-kapanisi?roundId=$_selectedId'),
    behavior: HitTestBehavior.opaque,
    child: Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.symmetric(vertical: 12),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFF132244),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: const Text(
        '🏁 Bu Haftanın Kapanışı · Sen vs Sistem ›',
        style: TextStyle(
          color: AppColors.white,
          fontSize: 13,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );

  // ——— Maçlar sekmesi ———

  static const List<({String k, String l})> _filtreler = [
    (k: 'all', l: 'Tümü'),
    (k: 'dogru', l: 'Doğru'),
    (k: 'yanlis', l: 'Yanlış'),
    (k: 'bekleyen', l: 'Bekleyen'),
  ];

  /// Filtrenin baktığı tahmin: kupon varsa SENİN tahminin, yoksa SİSTEMİN.
  /// (İkisini karıştırmak "doğru" sayısını belirsizleştirirdi; hangisine
  /// bakıldığı ekranda da yazar.)
  bool? _filtreHit(Map m, _Hafta week) {
    if (!_officialResolved(m)) return null;
    if (week.hasCoupon) {
      final pick = week.seciliPicks[m['no']];
      if (pick == null) return null;
      return pick.contains('${m['result']}');
    }
    final sym = _sysSymOf(m);
    if (sym == null) return null;
    return pickHits(sym, '${m['result']}') == true;
  }

  bool _filtreyeUyar(Map m, _Hafta week) => switch (_macFiltre) {
    'dogru' => _filtreHit(m, week) == true,
    'yanlis' => _filtreHit(m, week) == false,
    'bekleyen' => !_officialResolved(m),
    _ => true,
  };

  List<Widget> _maclarSekmesi(_Hafta week) {
    final maclar = ((_hist?['matches'] as List?) ?? const []).cast<Map>();
    final filtreli = maclar.where((m) => _filtreyeUyar(m, week)).toList();
    int say(String f) => switch (f) {
      'dogru' => maclar.where((m) => _filtreHit(m, week) == true).length,
      'yanlis' => maclar.where((m) => _filtreHit(m, week) == false).length,
      'bekleyen' => maclar.where((m) => !_officialResolved(m)).length,
      _ => maclar.length,
    };

    return [
      Padding(
        padding: const EdgeInsets.only(top: Spacing.sm),
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final f in _filtreler)
              _cip(
                '${f.l} (${say(f.k)})',
                secili: _macFiltre == f.k,
                onTap: () => setState(() => _macFiltre = f.k),
              ),
          ],
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(
          week.hasCoupon
              ? 'Doğru/Yanlış filtresi senin tahminine göredir.'
              : 'Kupon yok — Doğru/Yanlış filtresi sistem tahminine göredir.',
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
            fontStyle: FontStyle.italic,
          ),
        ),
      ),
      const Padding(
        padding: EdgeInsets.only(top: Spacing.sm),
        child: ScoreLegend(),
      ),
      if (filtreli.isEmpty)
        const Padding(
          padding: EdgeInsets.only(top: 16),
          child: Text(
            'Bu filtreye uyan maç yok.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
          ),
        )
      else
        for (final m in filtreli) _macKarti(m, week),
    ];
  }

  Widget _macKarti(Map m, _Hafta week) {
    // ✅/❌ YALNIZ resmi sonuçtan.
    final res = _officialResolved(m);
    final sv = _scoreView(m);
    final sym = _sysSymOf(m);
    final sysHit = (res && sym != null)
        ? pickHits(sym, '${m['result']}')
        : null;
    final myPick = week.seciliPicks[m['no']];
    final myHit = (res && myPick != null)
        ? myPick.contains('${m['result']}')
        : null;
    final d = matchDate(m['date'] as String?);

    String isaret(bool? hit) => hit == null ? '⏳' : (hit ? '✅' : '❌');

    return Container(
      margin: const EdgeInsets.only(top: Spacing.sm),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 22,
            child: Text(
              '${m['no']}',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: AppFont.black,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // TAKIM ADLARI TAM — kesme/üç nokta yok; uzun ad sarar.
                Text(
                  '${(m['home'] as Map?)?['name']} - ${(m['away'] as Map?)?['name']}',
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 13.5,
                    fontWeight: AppFont.heavy,
                    height: 18 / 13.5,
                  ),
                ),
                if (d.day.isNotEmpty || d.time.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '${d.day}${d.day.isNotEmpty && d.time.isNotEmpty ? ' · ' : ''}${d.time}',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (sv != null)
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 13),
                    children: [
                      TextSpan(
                        text: sv.score,
                        style: TextStyle(
                          color: sv.color,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      if (sv.result != null) ...[
                        const TextSpan(
                          text: ' · ',
                          style: TextStyle(color: AppColors.textMuted),
                        ),
                        TextSpan(
                          text: sv.result,
                          style: TextStyle(
                            color: sv.color,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ],
                    ],
                  ),
                )
              else if (res && m['viaNotary'] == true)
                // NOTER KARARI (ertelenen maç): resmî sonuç VAR, skor YOK —
                // "bekliyor" yazmak ✅/❌ işaretleriyle çelişirdi (2026-08-10
                // canlı doğrulamada görüldü: 53. Hafta 14. maç).
                Text(
                  'NOTER · ${m['result']}',
                  style: const TextStyle(
                    color: AppColors.success,
                    fontSize: 12,
                    fontWeight: AppFont.black,
                  ),
                )
              else
                const Text(
                  'bekliyor',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11.5),
                ),
              // SEN ve SİSTEM AYRI SATIRLARDA — açıkça ayrılır.
              if (myPick != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11.5,
                      ),
                      children: [
                        const TextSpan(text: 'Sen: '),
                        TextSpan(
                          text: myPick.join('/'),
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: AppFont.black,
                          ),
                        ),
                        TextSpan(text: ' ${isaret(myHit)}'),
                      ],
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11.5,
                    ),
                    children: [
                      const TextSpan(text: 'Sistem: '),
                      TextSpan(
                        text: sym ?? '—',
                        style: const TextStyle(
                          color: AppColors.text,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      if (sym != null) TextSpan(text: ' ${isaret(sysHit)}'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ——— Teknik bilgiler (en altta, açılır/kapanır) ———

  Widget _teknikBolum(Map? selMeta, _Hafta week) => Padding(
    padding: const EdgeInsets.only(top: Spacing.lg),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          label: _teknikAcik
              ? 'Teknik bilgileri gizle'
              : 'Teknik bilgileri göster',
          child: GestureDetector(
            onTap: () => setState(() => _teknikAcik = !_teknikAcik),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: Spacing.md,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      '⚙ Teknik bilgiler',
                      style: TextStyle(
                        color: AppColors.textSoft,
                        fontSize: 12.5,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                  ),
                  Text(
                    _teknikAcik ? '▲' : '▼',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_teknikAcik) _teknikKart(selMeta, week),
      ],
    ),
  );

  Widget _teknikKart(Map? selMeta, _Hafta week) => _kart([
    _teknikSatir('Sezon', '${selMeta?['year'] ?? '—'}'),
    _teknikSatir('Hafta', '${selMeta?['name'] ?? '—'}'),
    _teknikSatir('roundId / bulletinId', '${_selectedId ?? '—'}'),
    _teknikSatir('Resmi sonuç', '${week.resolvedCount}/${week.total} geldi'),
    _teknikSatir(
      'Kupon',
      week.hasCoupon
          ? '${week.others.length + (week.hasRanked ? 1 : 0)} kayıtlı kupon'
          : 'kayıtlı kupon yok',
      son: true,
    ),
  ]);

  Widget _teknikSatir(String k, String v, {bool son = false}) => Container(
    padding: const EdgeInsets.symmetric(vertical: 7),
    decoration: son
        ? null
        : const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            k,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 11.5,
              fontWeight: AppFont.bold,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Text(
            v,
            maxLines: 2,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 11.5,
              fontWeight: AppFont.semibold,
            ),
          ),
        ),
      ],
    ),
  );
}

class _Hafta {
  const _Hafta({
    required this.total,
    required this.resolvedCount,
    required this.fullyResolved,
    required this.hasPrize,
    required this.status,
    required this.hasCoupon,
    required this.rankedRes,
    required this.others,
    required this.seciliRes,
    required this.seciliPicks,
    required this.kuponlar,
    required this.hasRanked,
    required this.rankedNo,
  });

  final int total;
  final int resolvedCount;
  final bool fullyResolved;
  final bool hasPrize;
  final String status;
  final bool hasCoupon;
  final KuponSonuc? rankedRes;
  final List<KuponSonuc> others;

  /// "Sen" hesabının kaynağı: kullanıcının seçtiği (varsayılan dereceli) kupon.
  final KuponSonuc? seciliRes;
  final Map<Object, List> seciliPicks;

  /// Kupon seçici listesi (dereceli önde).
  final List<KuponSonuc> kuponlar;
  final bool hasRanked;
  final Object? rankedNo;
}
