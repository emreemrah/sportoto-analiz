// KAYNAK: app/src/screens/BulletinScreen.js
//
// GÜNCEL BÜLTEN yolu çevrildi: başlık, hafta/sezon seçici, mühür şeridi,
// LiveBulletinView + LiveMatchCard listesi, 15 sn canlı yenileme.
//
// SONRADAN ÇEVRİLDİ:
//   • Geçmiş hafta görünümü: renderHistoryItem, ikramiye bölümü,
//     checkOfficial 15 sn oto kontrol, resmî sonuç düzeltme denetimi +
//     toast, histSort sıralaması. İkramiye bölümünde kaynaktan sapma var:
//     bölüm EN ÜSTTE ve tek görünüm — resmî Liste yazımı
//     (bkz. prize_section.dart).
//   • Kullanıcının dereceli kupon seçimleri ("Sen" satırı) — coupon_store
//     Adım 3'te geldi; kupon yoksa kart "Kupon yok" yazar (uydurma seçim
//     gösterilmez).
//   • Favori takım yıldızı + zemin filigranı — live_match_card'da.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/bulten_gunleri.dart';
import '../../core/coupon/coupon_eval.dart';
import '../../core/coupon/coupon_store.dart';
import '../../core/prefs.dart';
import '../../core/theme/takim_paleti.dart' show okunurMetin;
import '../../core/theme/tokens.dart';
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/states.dart' show HazirlaniyorState, sunucuHazirlaniyor;
import '../../widgets/score_legend.dart';
import '../../widgets/ust_panel.dart';
import '../../widgets/snapshot_seal_banner.dart';
import 'bulletin_format.dart';
import 'bulten_tarih_seridi.dart';
import '../live/live_match_detail_screen.dart';
import '../match_detail/gecmis_mac_detay_screen.dart';
import 'bulletin_providers.dart';
import 'history_controller.dart';
import 'history_match_card.dart';
import 'live_bulletin_view.dart';
import 'prize_section.dart';
import '../../widgets/takim_logo_zemin.dart';

/// Maç başlamış mı? Sonucu/skoru var VEYA maç saati geçmiş
/// (görüntüleme anında hesaplanır).
bool _isStarted(Map m) {
  if (m['status'] == 'finished') return true;
  final date = m['date'] as String?;
  if (date == null) return false;
  final t = DateTime.tryParse(date);
  return t != null && !t.toLocal().isAfter(DateTime.now());
}

class BulletinScreen extends ConsumerStatefulWidget {
  const BulletinScreen({super.key});

  @override
  ConsumerState<BulletinScreen> createState() => _BulletinScreenState();
}

class _BulletinScreenState extends ConsumerState<BulletinScreen> {
  /// Gün şeridinde seçili gün; null = süzgeç kapalı (bültenin tamamı).
  String? _seciliGun;

  Timer? _canliZamanlayici;
  bool _sezonAcik = false;

  @override
  void initState() {
    super.initState();
    // Güncel bülten 15 sn CANLI yenileme — kaynaktaki `setInterval(..., 15000)`.
    //
    // Kaynakta ek olarak `isFocused` (sekme odağı) ve web'de
    // `document.visibilityState === 'hidden'` kontrolü vardı. Flutter
    // karşılıkları: sekme odağı go_router dalının görünürlüğü,
    // görünürlük ise AppLifecycleState. İkisi de aşağıda kuruldu.
    _canliZamanlayici = Timer.periodic(const Duration(seconds: 15), (_) {
      if (!mounted) return;
      // Uygulama arka plandaysa yenileme — kaynakla aynı kural.
      final yasam = WidgetsBinding.instance.lifecycleState;
      if (yasam != null && yasam != AppLifecycleState.resumed) return;
      final secili = ref.read(selectedRoundIdProvider);
      if (secili == null) {
        // Güncel hafta görünürken bülteni tazele.
        ref.invalidate(bulletinProvider);
        return;
      }

      // GEÇMİŞ HAFTA 15 sn OTO KONTROL — 15/15 resmi sonuç + ikramiye gelince
      // DURUR (kaynaktaki `done` koşulu). Boşuna sunucu yormaz.
      final h = ref.read(historyControllerProvider);
      final ms = (h.hist?['matches'] as List?) ?? const [];
      final done =
          ms.isNotEmpty &&
          ms.cast<Map>().every(officialResolved) &&
          h.hist?['prize'] != null;
      if (done) return;
      // SESSİZ: arka plan yoklaması "kontrol ediliyor" göstergesini
      // yakmaz (bkz. checkOfficial). Elle yenilemede gösterge KALIR.
      ref
          .read(historyControllerProvider.notifier)
          .checkOfficial(secili, sessiz: true);
    });
  }

  @override
  void dispose() {
    _canliZamanlayici?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bulletinAsync = ref.watch(bulletinProvider);
    final rounds = ref.watch(roundsProvider).valueOrNull;
    final selectedId = ref.watch(selectedRoundIdProvider);

    // TOAST — kaynakta 2400 ms görünüp kaybolan kendi kutusuydu; Android'in
    // yerli karşılığı SnackBar. Metin ve süre aynı.
    ref.listen<HistoryState>(historyControllerProvider, (onceki, yeni) {
      final mesaj = yeni.toast;
      if (mesaj == null || mesaj == onceki?.toast) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(mesaj),
          duration: const Duration(milliseconds: 2400),
        ),
      );
      ref.read(historyControllerProvider.notifier).toastTemizle();
    });

    return Scaffold(
      body: filigranli(
        SafeArea(
          bottom: false,
          child: bulletinAsync.when(
            // İlk yükleme: hiç veri yokken tam ekran bekleme
            loading: () => _Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 12),
                  Text(
                    'Bülten yükleniyor…',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
            // SUNUCU UYANIYORSA HATA GÖSTERİLMEZ (16 Ağustos 2026).
            // Barındırma planı servisi uyutuyor; uyanışta bülten hazırlanana
            // dek uç 503 döner (ölçüm: 61 sn ve ~90 sn). Bu bir arıza değil,
            // bekleme. Ekran zaten 15 sn'de bir kendiliğinden yeniliyor
            // (yukarıdaki zamanlayıcı), o yüzden kullanıcıya "bir şey yapma"
            // denebiliyor.
            error: (e, _) => sunucuHazirlaniyor(e)
                ? HazirlaniyorState(
                    onRetry: () => ref.invalidate(bulletinProvider),
                  )
                : _Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline, size: 36, color: AppColors.danger),
                  const SizedBox(height: 10),
                  Text(
                    'Güncel başlamamış haftalık program alınamadı.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 15,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$e',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12.5,
                    ),
                  ),
                  const SizedBox(height: 14),
                  GestureDetector(
                    onTap: () => ref.invalidate(bulletinProvider),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 9,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: AppRadius.smR,
                      ),
                      child: Text(
                        'Tekrar Dene',
                        style: TextStyle(
                          color: AppColors.onPrimary,
                          fontSize: 13,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            data: (data) => _icerik(data, rounds, selectedId),
          ),
        ),
      ),
    );
  }

  Widget _icerik(
    Map<String, dynamic> data,
    Map<String, dynamic>? rounds,
    int? selectedId,
  ) {
    final currentRoundId = rounds?['currentRoundId'] as int?;
    final effectiveId = selectedId ?? currentRoundId;
    final viewingCurrent = effectiveId == null || effectiveId == currentRoundId;

    // Navigasyon listesi: en eski → güncel
    // (gelecekteki yayımlanmamış haftalar hariç)
    final allRounds = (rounds?['rounds'] as List?) ?? const [];
    final curIdx = allRounds.indexWhere(
      (r) => (r as Map)['id'] == currentRoundId,
    );
    final navRounds = curIdx >= 0
        ? allRounds.sublist(0, curIdx + 1)
        : allRounds;
    final selIdx = navRounds.indexWhere((r) => (r as Map)['id'] == effectiveId);
    final selMeta = selIdx >= 0 ? navRounds[selIdx] as Map : null;
    final canPrev = selIdx > 0; // daha eski hafta var
    final canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

    final currentMatches = (data['matches'] is List)
        ? data['matches'] as List
        : const [];
    final upcomingCount = currentMatches
        .where((m) => !_isStarted(m as Map))
        .length;

    final roundName =
        (selMeta?['name'] as String?) ?? (data['round'] as String?) ?? '—';
    final roundYear = selMeta?['year'] ?? data['year'];

    // Sezon listesi navRounds'tan: yayımlanmamış gelecek haftalar girmez.
    // Yeniden eskiye — kullanıcı önce güncel sezonu arar.
    final sezonlar =
        navRounds
            .map((r) => (r as Map)['year'])
            .where((y) => y != null)
            .toSet()
            .toList()
          ..sort((a, b) => '$b'.compareTo('$a'));

    // ── GEÇMİŞ HAFTA DURUMU ──
    final hist = ref.watch(historyControllerProvider);
    // Geçmiş hafta seçilince yükle; güncele dönünce temizle. Kaynakta bu bir
    // `useEffect([effectiveId, viewingCurrent])` idi.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final c = ref.read(historyControllerProvider.notifier);
      if (viewingCurrent) {
        if (hist.hist != null || hist.error != null) c.temizle();
      } else {
        // `viewingCurrent` tanımı gereği burada effectiveId null olamaz
        // (null ise viewingCurrent zaten true olurdu). Dart bunu yerel boolean
        // üzerinden kendisi çıkarıyor; `!` gerekmiyor.
        c.yukle(effectiveId);
      }
    });

    final histMatches = (hist.hist?['matches'] as List?) ?? const [];
    final totalM = histMatches.length;
    final resolvedCount = histMatches
        .cast<Map>()
        .where(officialResolved)
        .length;
    final hasPrize = hist.hist?['prize'] != null;
    // GEÇMİŞ SONUÇ DURUMU — "Sonuçlar açıklandı" YALNIZ 15/15 resmi skor +
    // 1/X/2 + ikramiye gelince. Aksi halde dereceli durum (n/15).
    final fullyResolved = totalM > 0 && resolvedCount == totalM;
    final allAnnounced = fullyResolved && hasPrize;

    final subtitle = viewingCurrent
        ? (data['pending'] == true
              ? 'güncel resmi bülten bekleniyor'
              : upcomingCount > 0
              ? '$upcomingCount/${data['matchCount'] ?? currentMatches.length}'
                    ' maç başlamadı · analiz hazır'
                    '${data['usingExampleKey'] == true ? ' · (örnek anahtar)' : ''}'
              : 'bu haftanın maçları başladı')
        : (hist.loading
              ? 'yükleniyor…'
              : hist.error != null
              ? 'sonuç alınamadı'
              : hist.checking && totalM == 0
              ? 'Resmi sonuçlar kontrol ediliyor 🔄'
              : allAnnounced
              ? 'Sonuçlar açıklandı'
              : hist.checking
              ? 'Resmi sonuçlar kontrol ediliyor 🔄'
                    '${resolvedCount > 0 ? ' · $resolvedCount/$totalM geldi' : ''}'
              : fullyResolved
              ? 'Maç sonuçları tamamlandı · İkramiye bekleniyor'
              : hist.corrections.isNotEmpty
              ? 'Resmi sonuç düzeltmesi var · $resolvedCount/$totalM geldi'
              : hist.updateMsg == 'updated'
              ? 'Resmi sonuçlar güncellendi · $resolvedCount/$totalM geldi'
              : hist.updateMsg == 'noNew'
              ? 'Yeni resmi sonuç bulunamadı · $resolvedCount/$totalM geldi'
              : 'Resmi sonuçlar bekleniyor'
                    '${resolvedCount > 0 ? ' · $resolvedCount/$totalM geldi' : ''}');

    // Resmi teyit rozeti — sadece güncel + teyit edilmiş bültende.
    final verification = data['verification'] as Map?;
    final verifiedNow =
        viewingCurrent &&
        data['pending'] != true &&
        verification?['status'] == 'confirmed';
    final verifiedAt = verification?['verifiedAt'] is String
        ? matchDate(verification!['verifiedAt'] as String)
        : null;

    final header = _baslik(
      roundName: roundName,
      roundYear: roundYear,
      subtitle: viewingCurrent ? null : subtitle,
      sezonlar: sezonlar,
      navRounds: navRounds,
      selIdx: selIdx,
      canPrev: canPrev,
      canNext: canNext,
      viewingCurrent: viewingCurrent,
      currentRoundId: currentRoundId,
      verifiedNow: verifiedNow,
      verifiedAt: verifiedAt,
      // MÜHÜR DURUMU — kilit geri sayımı / "Mühürlü Analiz" + doğrulama
      // hash'i. Veri kalıcı arşivden (data.archive); arşiv yoksa şerit
      // çizilmez.
      archive: viewingCurrent && data['pending'] != true
          ? data['archive'] as Map?
          : null,
    );

    if (!viewingCurrent) {
      return _gecmisGovde(
        header: header,
        hist: hist,
        effectiveId: effectiveId,
        resolvedCount: resolvedCount,
        totalM: totalM,
        fullyResolved: fullyResolved,
        selMetaCloseDate: selMeta?['closeDate'] as String?,
      );
    }

    // DERECELİ kupon seçimleri (no → sembol, ör. '10') — kart altındaki
    // "Sen" satırını besler. Kaynakta da haftanın DERECELİ kuponundan okunur;
    // kupon yoksa harita boştur ve kart "Kupon yok" yazar (uydurma seçim yok).
    final userPicks = picksMapOf(getRankedCoupon(data['roundId']));

    // AKTARIM DAMGALARI (2026-08-11): kullanıcı sistem önerisini kuponuna
    // aldıysa maç bazında {secim, zaman, kaynak, …} kayıtlıdır. Kart, sistem
    // o günden beri tahminini değiştirdiyse "eski → yeni" yazar. Damga yoksa
    // değişim İDDİA EDİLMEZ — elle seçimde damga zaten yazılmaz.
    final aktarimlar = <Object, Map<String, dynamic>>{
      for (final e in aktarimDamgalari(
        finalVersion(getRankedCoupon(data['roundId'])),
      ).entries)
        ?int.tryParse(e.key): e.value,
    };

    // GÜN ŞERİDİ (kullanıcı isteği, 2026-08-11): günler bültenin KENDİ maç
    // tarihlerinden türetilir; maçı olmayan gün çizilmez. Varsayılan seçim
    // YOK ("Tümü") — bülten açılışta bugüne kadar hep 15 maçı birden
    // gösteriyordu, süzgeç kullanıcının dokunuşuyla devreye girer.
    final gunler = bultenGunleri(currentMatches);
    final gosterilenMaclar = filtreleGune(currentMatches, _seciliGun);

    return LiveBulletinView(
      // İKİ AYRI PANEL (kullanıcı isteği, 2026-08-12 son tur): başlık,
      // hafta seçimi ve durum bir kart; TARİH SÜZGECİ ayrı bir kart.
      // Tek kutuda toplandıklarında "birbirine yapışık" görünüyorlardı.
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          UstPanel(child: header),
          // SÜZGEÇ PANELİ — zemini `surfaceSoft`: başlık kartından TON
          // FARKIYLA da ayrışsın (ikisi de kenarlıklı ve yuvarlak olduğu
          // için yalnız boşluk yetmiyordu).
          UstPanel(
            renk: AppColors.surfaceSoft,
            // İÇ BOŞLUK: seçili günün altındaki kalın accent çizgi kartın
            // KENARINA değiyor ve yuvarlatılmış köşede kırpılıyordu. Alttan
            // ve yanlardan boşluk bırakılınca çizgi kartın içinde kalıyor.
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Spacing.sm, 0, Spacing.sm, 6),
              child: BultenTarihSeridi(
                gunler: gunler,
                secili: _seciliGun,
                onSec: (g) => setState(() => _seciliGun = g),
              ),
            ),
          ),
        ],
      ),
      matches: gosterilenMaclar,
      subtitle: subtitle,
      userPicks: userPicks,
      aktarimlar: aktarimlar,
      roundId: data['roundId'],
      onRefresh: () async {
        ref.invalidate(bulletinProvider);
        ref.invalidate(roundsProvider);
        await ref.read(bulletinProvider.future);
      },
      onCardPress: (no) {
        // KAYNAKTAKİ DAL: başlamış maç → LiveMatchDetail (canlı istatistik),
        // başlamamış maç → MatchDetail.
        final m = currentMatches.cast<Map>().firstWhere(
          (x) => x['no'] == no,
          orElse: () => const {},
        );
        final started =
            m['started'] == true ||
            m['live'] == true ||
            m['finalized'] == true ||
            (m['date'] is String &&
                DateTime.tryParse(
                      m['date'] as String,
                    )?.toLocal().isAfter(DateTime.now()) ==
                    false);
        if (started) {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => LiveMatchDetailScreen(no: no),
            ),
          );
          return;
        }
        GoRouter.of(context).go('/bulten/mac/$no');
      },
    );
  }

  /// Geçmiş hafta gövdesi — kaynaktaki `body` dallarının geçmiş kısmı.

  Widget _gecmisGovde({
    // GEÇMİŞ HAFTA BAŞLIK PANELİ — bkz. `_gecmisBaslikPaneli`.
    required Widget header,
    required HistoryState hist,
    required int? effectiveId,
    required int resolvedCount,
    required int totalM,
    required bool fullyResolved,
    required String? selMetaCloseDate,
  }) {
    if (hist.loading) {
      return Column(
        children: [
          UstPanel(child: header),
          Expanded(
            child: _Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 12),
                  Text(
                    'Geçmiş bülten yükleniyor…',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    if (hist.error != null) {
      return Column(
        children: [
          UstPanel(child: header),
          Expanded(
            child: _Center(
              child: EmptyState(
                icon: Icons.error_outline,
                title: 'Geçmiş hafta sonucu alınamadı',
                message: hist.error,
              ),
            ),
          ),
        ],
      );
    }

    final histMatches = (hist.hist?['matches'] as List?) ?? const [];

    // Geçmiş bülten sıralaması (filtre yok — 15 maç olduğu gibi listelenir).
    final histSort = getPref('histSort');
    final sirali = histMatches
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    int byNo(Map a, Map b) =>
        ((a['no'] as num?) ?? 0).compareTo((b['no'] as num?) ?? 0);
    if (histSort == 'resolvedTop') {
      int w(Map m) => switch (histCategory(m)) {
        'official' => 0,
        'provisional' => 1,
        _ => 2,
      };
      sirali.sort((a, b) {
        final c = w(a).compareTo(w(b));
        return c != 0 ? c : byNo(a, b);
      });
    } else if (histSort == 'waitingBottom') {
      int w(Map m) => histCategory(m) == 'waiting' ? 1 : 0;
      sirali.sort((a, b) {
        final c = w(a).compareTo(w(b));
        return c != 0 ? c : byNo(a, b);
      });
    } else {
      sirali.sort(byNo);
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async {
        if (effectiveId != null) {
          await ref
              .read(historyControllerProvider.notifier)
              .checkOfficial(effectiveId);
        }
      },
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: UstPanel(child: header)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(
              Spacing.md,
              Spacing.md,
              Spacing.md,
              Spacing.xl,
            ),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // KAYNAKTAN BİLİNÇLİ SAPMA (2026-08-10, kullanıcı isteği):
                // ikramiye & bilen kişi kaynakta listenin EN ALTINDAydı;
                // geçmiş haftanın en değerli özeti olduğu için EN ÜSTE alındı.
                PrizeSection(
                  prize: hist.hist?['prize'] as Map?,
                  resolvedCount: resolvedCount,
                  totalM: totalM,
                  fullyResolved: fullyResolved,
                  selMetaCloseDate: selMetaCloseDate,
                ),
                // Güncel bültenle BİREBİR AYNI sade başlık.
                ScoreLegend(),
                if (hist.checking)
                  Container(
                    margin: const EdgeInsets.only(bottom: Spacing.sm),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.infoSoft,
                      borderRadius: AppRadius.smR,
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'Resmi sonuçlar kontrol ediliyor…',
                          style: TextStyle(
                            color: AppColors.info,
                            fontSize: 12,
                            fontWeight: AppFont.heavy,
                          ),
                        ),
                      ],
                    ),
                  ),
                if (hist.corrections.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(bottom: Spacing.sm),
                    padding: const EdgeInsets.all(Spacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: AppRadius.mdR,
                      border: Border.all(color: AppColors.warning),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Resmi sonuç düzeltmesi var',
                          style: TextStyle(
                            color: okunurMetin(AppColors.warningSoft),
                            fontSize: 13,
                            fontWeight: AppFont.black,
                          ),
                        ),
                        Text(
                          '${hist.corrections.length} maçta resmi sonuç '
                          'güncellendi.',
                          style: TextStyle(
                            color: okunurMetin(AppColors.warningSoft),
                            fontSize: 12,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                if (sirali.isEmpty)
                  Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: Text(
                      'Bu haftanın maç listesi bulunamadı.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 13,
                      ),
                    ),
                  )
                else
                  for (final m in sirali)
                    HistoryMatchCard(
                      item: m,
                      duzeltmeVar: hist.corrections.any((c) => c.no == m['no']),
                      // Geçmiş bültende en değerli bilgi burada: maç öncesi ne
                      // demişiz, sonra ne olmuş. Detay ekranı arşivdeki
                      // MÜHÜRLÜ kaydı okur; yeniden hesap yapmaz.
                      onTap: effectiveId == null
                          ? null
                          : () => Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => GecmisMacDetayScreen(
                                  roundId: effectiveId,
                                  no: m['no'] as Object,
                                  mac: m,
                                ),
                              ),
                            ),
                    ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _baslik({
    required String roundName,
    required Object? roundYear,
    required String? subtitle,
    required List<Object?> sezonlar,
    required List navRounds,
    required int selIdx,
    required bool canPrev,
    required bool canNext,
    required bool viewingCurrent,
    required int? currentRoundId,
    required bool verifiedNow,
    required MatchDateParts? verifiedAt,
    required Map? archive,
  }) {
    // GECMIS HAFTA BASLIGI DA PANELIN ICINDE (kullanici karari, 16 Agustos).
    //
    // Gecmis haftada baslik PANELSIZ basiliyordu: sari zeminde kartsiz
    // kaliyor, kart icin turetilmis yazilar soluyor ve "Guncel Bultene Don"
    // dugmesi (dolgu/cerceve/yazi hepsi primary) zeminle ayni renge dusup
    // TAMAMEN GORUNMEZ oluyordu. Artik iki hafta da ayni UstPanel icinde:
    // KART KIRMIZI, YAZI SARI. Yuzey tek oldugu icin renkler dallanmaz;
    // kart ailesi (text / textMuted / primary) yeterlidir.
    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: Spacing.md,
        horizontal: Spacing.md,
      ),
      // ZEMİN VE ALT ÇİZGİ YOK: başlık kendi `UstPanel` kartının içinde;
      // zemini, kenarlığı ve yuvarlaklığı panel veriyor. Burada ikinci bir
      // dolgu çizmek kenarlığı KAVİSTE örtüyor ve köşeyi "çapraz kesilmiş"
      // gösteriyordu (8× büyütmeyle doğrulandı).
      child: Column(
        children: [
          Row(
            children: [
              _navBtn('‹', canPrev, 'Önceki hafta', () {
                ref.read(selectedRoundIdProvider.notifier).state =
                    (navRounds[selIdx - 1] as Map)['id'] as int;
              }),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Column(
                    children: [
                      if (roundYear != null)
                        sezonlar.length > 1
                            ? _sezonChip(roundYear, navRounds, sezonlar)
                            : Text(
                                sezonAdi(roundYear),
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 11,
                                  fontWeight: AppFont.bold,
                                ),
                              ),
                      Text(
                        'Haftalık Bülten · $roundName',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.text,
                          fontSize: 18,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12.5,
                          ),
                        ),
                      ],
                      if (verifiedNow) ...[
                        const SizedBox(height: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 3,
                          ),
                          // YEŞİL BİLEREK: "resmî / doğrulanmış" bu uygulamanın
                          // durum dili — aynı ekranın altındaki gösterge de
                          // 🟢 Resmî sonuç · 🟡 Henüz resmî değil · 🔴 Canlı
                          // der. Takım rengine BAĞLANMAZ: Galatasaray'da
                          // "resmî" kırmızıya dönüp "canlı" ile çakışırdı,
                          // yeşil formalı bir takımda da takım renginden
                          // ayrılamazdı.
                          //
                          // AMA TONU OKUNUR OLMALI (16 Ağustos 2026 ölçümü):
                          // açık/koyu modda zemin markanın sabit mint'i
                          // (#E8F7EE) ve `success` (#16A34A) üstünde kontrast
                          // 2.98 — AA eşiğinin (4.5) ALTINDA. Takım temasında
                          // zemin `_anlamsalYuzey` ile yeniden hesaplandığı
                          // için sorun görünmüyordu; varsayılan modlarda o
                          // koruma yoktu. `kimlikTonu` hue ve doygunluğu
                          // KORUYARAK tonu okunana dek iter — yeşil yine
                          // yeşildir, yalnız okunur.
                          decoration: BoxDecoration(
                            color: AppColors.successSoft,
                            borderRadius: AppRadius.smR,
                            border: Border.all(color: AppColors.onSuccessSoft),
                          ),
                          child: Text(
                            '✓ Resmi bülten teyit edildi'
                            '${verifiedAt != null ? ' · ${verifiedAt.day} ${verifiedAt.time}' : ''}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: AppColors.onSuccessSoft,
                              fontSize: 10.5,
                              fontWeight: AppFont.heavy,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              _navBtn('›', canNext, 'Sonraki hafta', () {
                ref.read(selectedRoundIdProvider.notifier).state =
                    (navRounds[selIdx + 1] as Map)['id'] as int;
              }),
            ],
          ),
          if (!viewingCurrent) ...[
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => ref.read(selectedRoundIdProvider.notifier).state =
                  currentRoundId,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  // Kaynakta `colors.primary + '22'` — %13 opaklıkta lacivert.
                  color: AppColors.primary.withValues(alpha: 0x22 / 255),
                  borderRadius: AppRadius.smR,
                  border: Border.all(color: AppColors.primary),
                ),
                child: Text(
                  'Güncel Bültene Dön',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 12.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => context.push('/bulten/gecmis'),
            behavior: HitTestBehavior.opaque,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.history_edu, size: 14, color: AppColors.primary),
                const SizedBox(width: 5),
                Text(
                  'Bülten Geçmişi · Kilitli Analiz ›',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 12,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ],
            ),
          ),
          if (archive != null) SnapshotSealBanner(archive: archive),
          const SizedBox(height: 10),
          Text(
            kLegalFooter,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 10,
              fontWeight: AppFont.semibold,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _navBtn(String arrow, bool enabled, String label, VoidCallback onTap) {
    return Opacity(
      opacity: enabled ? 1 : 0.3,
      child: Semantics(
        button: true,
        label: label,
        child: GestureDetector(
          onTap: enabled ? onTap : null,
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.cardAlt,
              shape: BoxShape.circle,
            ),
            child: Text(
              arrow,
              style: TextStyle(
                color: AppColors.text,
                fontSize: 24,
                fontWeight: AppFont.black,
                height: 26 / 24,
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// SEZON SEÇİMİ — resmî listedeki gibi açılır liste. Sezon seçilince o
  /// sezonun EN YENİ haftasına gidilir. Tek sezon varsa liste açılmaz.
  Widget _sezonChip(Object? roundYear, List navRounds, List<Object?> sezonlar) {
    return Column(
      children: [
        Semantics(
          button: true,
          label: 'Sezon seç, şu an ${sezonAdi(roundYear)}',
          child: GestureDetector(
            onTap: () => setState(() => _sezonAcik = !_sezonAcik),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _sezonAcik ? AppColors.primarySoft : AppColors.cardAlt,
                borderRadius: AppRadius.smR,
                border: Border.all(
                  color: _sezonAcik ? AppColors.primary : AppColors.border,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'SEZON',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 9,
                      fontWeight: AppFont.heavy,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    sezonAdi(roundYear),
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 11.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _sezonAcik ? '▲' : '▼',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 9),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_sezonAcik)
          Container(
            margin: const EdgeInsets.only(top: 6),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: AppRadius.smR,
              border: Border.all(color: AppColors.border),
              boxShadow: AppShadow.soft,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final y in sezonlar)
                  GestureDetector(
                    onTap: () {
                      // O sezonun EN YENİ haftası
                      // (navRounds zaten güncelle sınırlı).
                      final enYeni = navRounds.reversed
                          .cast<Map>()
                          .where((r) => r['year'] == y)
                          .firstOrNull;
                      if (enYeni != null) {
                        ref.read(selectedRoundIdProvider.notifier).state =
                            enYeni['id'] as int;
                      }
                      setState(() => _sezonAcik = false);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      color: y == roundYear
                          ? AppColors.primarySoft
                          : Colors.transparent,
                      child: Text(
                        sezonAdi(y),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: y == roundYear
                              ? AppColors.primary
                              : AppColors.textSoft,
                          fontSize: 12,
                          fontWeight: y == roundYear
                              ? AppFont.heavy
                              : AppFont.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Center extends StatelessWidget {
  const _Center({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    color: AppColors.bg,
    alignment: Alignment.center,
    padding: const EdgeInsets.all(24),
    child: child,
  );
}
