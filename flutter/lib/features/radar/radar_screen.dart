// KAYNAK: app/src/screens/RadarScreen.js (951 satır)
//
// ÇEVRİLEN: hafta seçici (sezon + hafta), 6 sekme (Master + Radar 1-5),
// durum makinesi (loading/error/currentPending/data/pastUnarchived), Master
// listesi (filtre çipleri + sıralama + genişleyen kartlar), Radar 1/2 kart
// listeleri, Radar 3/4 gün seçici + satırlar, Radar 3 geçmiş DNA paneli
// (played_dna_panel.dart), Radar 5 dönem filtresi + maç satırı + sıra açılımı
// (radar_memory.dart), legacy (Radar Merkezi öncesi) görünüm
// (legacy_radar_card.dart), mühür şeridi.
//
// KAYNAKTAN TAŞINAN ÜÇ TUZAK NOTU:
//
//  1. BAYAT YANIT: kullanıcı istek uçarken başka haftaya geçerse geç gelen
//     yanıt yeni haftanın verisini EZİYORDU. Riverpod'un `family` sağlayıcısı
//     bunu yapısal olarak çözer: her hafta ayrı bir sağlayıcıdır, yanıt kendi
//     haftasına yazılır.
//
//  2. SONSUZ İSTEK DÖNGÜSÜ: kaynakta her effect KENDİ doldurduğu state'i
//     bağımlılık dizisinde taşıyordu; sunucu farklı roundId dönerse effect
//     kendi sonucuyla yeniden tetikleniyor ve sessizce döngüye giriyordu.
//     Burada istek `family(roundId)` ile anahtarlanır — sonuca bağımlılık yok.
//
//  3. SEKME KORUMASI: açık radar HER DURUMDA korunur, hafta değiştirmek dahil.
//     Eskiden koşulsuz `setTab('master')` vardı ve hafta değiştirmek,
//     yenilemek, "tekrar dene" — hepsi kullanıcıyı Master'a atıyordu.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/takim_paleti.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/ust_panel.dart';
import '../../widgets/app_ui.dart';
import 'hafta_secici.dart';
import 'legacy_radar_card.dart';
import 'played_dna_panel.dart';
import 'radar_center_cards.dart';
import 'radar_memory.dart';
import 'radar_day_rows.dart';
import 'radar_screen_data.dart';
import 'radar_screen_logic.dart';
import 'radar_tab_headers.dart';
import '../../widgets/takim_logo_zemin.dart';

/// `/api/radar/weeks` — hafta listesi.
final _weeksProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
  (ref) async => Map<String, dynamic>.from(await api.radarWeeksList() as Map),
);

/// `/api/radar/current` — güncel hafta görünümü.
final _currentProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
  (ref) async => Map<String, dynamic>.from(await api.radarCurrent() as Map),
);

/// `/api/radar/:roundId` — seçili hafta. Bayat yanıt sorunu family ile çözülür.
final _roundProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>(
      (ref, rid) async =>
          Map<String, dynamic>.from(await api.radarRound(rid) as Map),
    );

final _dailyPlayedProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>(
      (ref, rid) async =>
          Map<String, dynamic>.from(await api.radarDailyPlayed(rid) as Map),
    );

final _dailyOddsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>(
      (ref, rid) async =>
          Map<String, dynamic>.from(await api.radarDailyOdds(rid) as Map),
    );

/// Radar 5 (Bülten DNA) — GÖRÜNTÜLENEN haftaya göre çekilir. Her haftanın
/// tarihsel kesimi ayrıdır (51. hafta 51 öncesini, 52. hafta 51 dâhil olanı
/// görür), bu yüzden hafta değişince YENİDEN çekilir; tek seferlik değildir.
/// Mühürlü haftada bu uç yalnız snapshot verisini döner; canlı hesap yapmaz.
///
/// Anahtar FİLTREYİ DE içerir (mod + tol): filtre değişince istek yeniden
/// atılır — anahtarda olmasaydı eski filtrenin sonucu ekranda kalırdı
/// (backend'in önbellek anahtarıyla aynı gerekçe).
final _positionDnaProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({Object rid, String? mod, num? tol})>(
      (ref, k) async => Map<String, dynamic>.from(
        await api.radarPositionDna(
              roundId: k.rid,
              oynanmaTol: k.mod == 'oynanma' ? k.tol : null,
              oranTol: k.mod == 'oran' ? k.tol : null,
            )
            as Map,
      ),
    );

/// Bir SIRANIN geçmiş maçları. Anahtar haftayı ve FİLTREYİ içerir: liste ile
/// üstteki dağılım aynı süzgeci kullanmalı — parametreler ayrışırsa kullanıcı
/// ekrandaki sayıyı doğrulayamaz.
final _siraMaclariProvider = FutureProvider.autoDispose
    .family<
      Map<String, dynamic>,
      ({Object rid, Object no, String? mod, num? tol})
    >(
      (ref, k) async => Map<String, dynamic>.from(
        await api.radarPositionMatches(
              k.no,
              roundId: k.rid,
              oynanmaTol: k.mod == 'oynanma' ? k.tol : null,
              oranTol: k.mod == 'oran' ? k.tol : null,
            )
            as Map,
      ),
    );

class RadarScreen extends ConsumerStatefulWidget {
  const RadarScreen({super.key});

  @override
  ConsumerState<RadarScreen> createState() => _RadarScreenState();
}

class _RadarScreenState extends ConsumerState<RadarScreen> {
  String _tab = 'master';
  String _filter = 'all';
  // Varsayılan: Spor Toto sırası (no 1→15). Listeyi riske göre karıştırmak
  // kupon doldurmayı zorlaştırır.
  String _sortMode = 'order';
  Object? _expandedNo;
  Object? _selectedId;
  String? _playedDay;
  String? _oddsDay;
  String? _dnaKey;
  // Hafta seçici: hangi açılır liste açık (null | 'sezon' | 'hafta') ve
  // kullanıcının elle seçtiği sezon (kaynaktaki secAcik/navSezon durumları).
  String? _secAcik;
  String? _navSezon;
  // Radar 5: dönem filtresi (Tüm/5/10/15) ve açık satır (sıra no).
  String _dnaPeriod = 'allTime';
  Object? _acikSira;
  // Radar 5 yakınlık filtresi (spec 2026-08-08): null = dönem modu.
  // Mod seçilince süzgeç TEMİZ başlar: Birebir + Tümü (kullanıcı kararı,
  // 2026-08-10) — onFiltreModSec her mod seçiminde bu değerlere döndürür.
  String? _dnaFiltreMod;
  num _dnaOynanmaTol = 0;
  num _dnaOranTol = 0;
  String _dnaMacPenceresi = 'allTime';
  // Legacy (Radar Merkezi öncesi) haftalar: eski 2 sekme + renk süzgeci.
  String _legacyView = 'r1';
  String? _legacyFilter;

  @override
  Widget build(BuildContext context) {
    final weeksAsync = ref.watch(_weeksProvider);
    final currentAsync = ref.watch(_currentProvider);

    final wk = weeksAsync.valueOrNull;
    final normalized = normalizeWeeks(wk);
    final curId = resolveCurrentId(currentAsync.valueOrNull, {
      'weeks': normalized.weeks,
      'currentRoundId': normalized.currentRoundId,
    });

    final gosterilen = _selectedId ?? curId;
    final viewAsync = gosterilen == null
        ? currentAsync
        : (gosterilen == curId
              ? currentAsync
              : ref.watch(_roundProvider(gosterilen)));

    final d = viewAsync.valueOrNull;
    final hasData =
        d?['hasData'] == true &&
        (d?['matches'] is List) &&
        (d!['matches'] as List).isNotEmpty;

    // GÜNCEL/GEÇMİŞ ayrımı backend'in `current` alanından okunur (tek doğruluk
    // kaynağı). roundId sıralamasına göre "güncellik" TAHMİN EDİLMEZ.
    final meta = <String, dynamic>{
      'round': d?['round'],
      'year': d?['year'],
      'current': d?['current'] ?? (gosterilen == curId),
      'sealed': d?['sealed'] == true,
      'sealedAt': d?['sealedAt'],
      'freezeAt': d?['radarFreezeAt'] ?? d?['freezeAt'],
      'frozenAt': d?['radarFrozenAt'] ?? d?['sealedAt'],
      'note': d?['note'],
      'pending': d?['pending'] == true,
      // Doğrulama karması KISALTILMIŞ gösterilir (10 hane) — kaynaktaki
      // `shortHash` türetimi.
      'shortHash': d?['verificationHash'] is String
          ? '${d!['verificationHash']}'.substring(
              0,
              '${d['verificationHash']}'.length.clamp(0, 10),
            )
          : null,
    };

    final durum = deriveScreenState(
      loading: viewAsync.isLoading,
      error: viewAsync.hasError ? '${viewAsync.error}' : null,
      view: d,
      legacyRadar: d?['radar'] as List?,
      meta: meta,
    );

    // Hafta seçici verisini bileşen kendisi türetir (kaynaktaki gibi);
    // buradan yalnız ham hafta listesi geçer.

    // Radar Merkezi kaydı yok ama eski sürpriz radarı arşivi var → LEGACY.
    // O görünüm DONMUŞTUR; yeni sistemin sekmeleri/rozetleri gösterilmez.
    final legacyRadar = d?['radar'] as List?;
    final legacyMode =
        !hasData &&
        ((d?['legacyOnly'] == true) ||
            (legacyRadar != null && legacyRadar.isNotEmpty));

    return Scaffold(
      // ARKA PLAN DESENİ YOK — kaynakta `ScreenBackdrop` bu ekrandan KULLANICI
      // İSTEĞİYLE kaldırıldı (2026-08-04). Dosyadaki tek "ScreenBackdrop"
      // geçişi o kaldırmayı anlatan yorumdur; sarmalayıcının kendisi yok.
      body: filigranli(
        SafeArea(
          bottom: false,
          child: Column(
            children: [
              // İKİ AYRI PANEL (kullanıcı isteği, 2026-08-12 son tur):
              // başlık + sezon/hafta seçimi bir kart, SEKMELER ayrı bir kart.
              // Tek kutuda toplandıklarında "birbirine yapışık" görünüyordu.
              // Aradaki boşluk `UstPanel`in kendi dikey marjından gelir.
              UstPanel(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ekranBasligi(meta),
                    _haftaSecici(normalized.weeks, curId, gosterilen),
                  ],
                ),
              ),
              // SEKME PANELİ — kendi kartı. Zemini `surfaceSoft`: başlık
              // kartından TON FARKIYLA da ayrışsın (ikisi de kenarlıklı ve
              // yuvarlak olduğu için yalnız boşluk yetmiyordu).
              UstPanel(
                renk: AppColors.surfaceSoft,
                child: _sekmeCubugu(legacyMode),
              ),
              Expanded(
                child: RefreshIndicator(
                  color: AppColors.accent,
                  onRefresh: () async {
                    ref.invalidate(_weeksProvider);
                    ref.invalidate(_currentProvider);
                    if (gosterilen != null && gosterilen != curId) {
                      ref.invalidate(_roundProvider(gosterilen));
                    }
                    await ref.read(_currentProvider.future);
                  },
                  child: legacyMode
                      ? _legacyListesi(legacyRadar)
                      : _govde(durum, d, meta, hasData, gosterilen),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _govde(
    RadarEkranDurumu durum,
    Map? d,
    Map meta,
    bool hasData,
    Object? gosterilen,
  ) {
    if (durum == RadarEkranDurumu.loading) {
      return ListView(
        children: [
          SizedBox(height: 40),
          Center(child: CircularProgressIndicator(color: AppColors.primary)),
        ],
      );
    }

    if (durum != RadarEkranDurumu.data) {
      final mesaj = screenStateMessage(durum, meta);
      return ListView(
        padding: const EdgeInsets.all(Spacing.md),
        children: [
          const SizedBox(height: 20),
          EmptyState(
            icon: durum == RadarEkranDurumu.error
                ? Icons.error_outline
                : Icons.hourglass_empty,
            title: durum == RadarEkranDurumu.error
                ? 'Radar verisi alınamadı'
                : durum == RadarEkranDurumu.pastUnarchived
                ? 'Arşiv kaydı yok'
                : 'Radar bekleniyor',
            message: mesaj,
          ),
        ],
      );
    }

    final matches = (d?['matches'] as List?) ?? const [];

    if (_tab == 'master') return _masterListesi(matches, meta);
    if (_tab == 'publicBetting' || _tab == 'market') {
      return _gunlukRadar(matches, gosterilen);
    }
    if (_tab == 'bulletinMemory') {
      return _bultenDnasi(matches, gosterilen, meta);
    }
    return ListView(
      padding: const EdgeInsets.all(Spacing.md),
      children: [
        // Performans sekmesinde metodoloji ⓘ'si; hiçbir maçta veri yoksa
        // "devre dışı" paneli (kaynak RadarTabHeader'ın bu dalları eksikti,
        // 2026-08-09'da tamamlandı).
        RadarSekmePaneli(tab: _tab, matches: matches),
        for (final m in matches.cast<Map>())
          RadarTabCard(item: m, radarId: _tab),
      ],
    );
  }

  /// LEGACY — Radar Merkezi öncesi haftalar. Üstte renk süzgeci şeridi,
  /// altında eski sürpriz radarı kartları (LegacyRadarCard).
  ///
  /// BU GÖRÜNÜM DONMUŞTUR: eski haftalar o hafta göründüğü gibi kalmalı,
  /// yeni sistemin dili karışmamalı.
  Widget _legacyListesi(List? legacyRadar) {
    final sayac = legacyCountsOf(legacyRadar);
    final gosterilen = legacyFiltered(legacyRadar, _legacyFilter);

    return ListView(
      padding: const EdgeInsets.all(Spacing.md),
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: Spacing.sm),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              // NOKTA VEKTÖR (kullanıcı isteği, 2026-08-12): emoji nokta
              // rengini emoji fontundan alıyordu; artık çipin anlamsal
              // tokenıyla boyanır ve rozetlerdeki renkle birebir tutar.
              for (final t in const [
                (k: 'red', label: 'Sürprize açık', renk: AppColors.danger),
                (k: 'yellow', label: 'Dikkat', renk: AppColors.warning),
                (k: 'green', label: 'Güçlü Aday', renk: AppColors.success),
              ])
                _cip(
                  '${switch (t.k) {
                    'red' => sayac.red,
                    'yellow' => sayac.yellow,
                    _ => sayac.green,
                  }} '
                  '${t.label}',
                  nokta: t.renk,
                  acik: _legacyFilter == t.k,
                  // Açık süzgece tekrar dokunmak süzgeci KALDIRIR.
                  onTap: () => setState(
                    () => _legacyFilter = _legacyFilter == t.k ? null : t.k,
                  ),
                ),
            ],
          ),
        ),
        for (var i = 0; i < gosterilen.length; i++)
          LegacyRadarCard(
            item: gosterilen[i],
            index: i,
            legacyView: _legacyView,
            expanded: _expandedNo == gosterilen[i]['no'],
            onToggle: () => setState(
              () => _expandedNo = _expandedNo == gosterilen[i]['no']
                  ? null
                  : gosterilen[i]['no'],
            ),
            onDetail: () =>
                GoRouter.of(context).go('/radar/mac/${gosterilen[i]['no']}'),
          ),
      ],
    );
  }

  /// RADAR 5 — Bülten DNA. Üstte sade dönem filtresi, altında maç odaklı
  /// satırlar; satıra dokununca o SIRANIN geçmiş maçları tablo hâlinde açılır.
  Widget _bultenDnasi(List matches, Object? gosterilen, Map meta) {
    final muhurluHafta = meta['sealed'] == true;

    // Yakınlık filtresi mühürlü haftada ETKİSİZDİR (backend de uygulamaz);
    // seçim durur, hafta değişince yeniden devreye girer.
    final filtreAktif = !muhurluHafta && _dnaFiltreMod != null;
    final num? filtreTol = !filtreAktif
        ? null
        : (_dnaFiltreMod == 'oynanma' ? _dnaOynanmaTol : _dnaOranTol);
    // Filtre modunda pencere anahtarı ALT KATMANDAN gelir ve birimi MAÇtır:
    // windows dilimleri süzgeçten SONRA kesildiği için "last5" burada
    // "süzgece uyan son 5 maç" demektir (backend sözleşmesi).
    final etkinPencere = filtreAktif ? _dnaMacPenceresi : _dnaPeriod;

    // Mühürlü haftada uç yalnız snapshot verisini döner; istek yine de
    // yapılır çünkü "snapshot'ta Radar 5 var mı" bilgisi oradan gelir.
    final dnaAsync = gosterilen == null
        ? null
        : ref.watch(
            _positionDnaProvider((
              rid: gosterilen,
              mod: filtreAktif ? _dnaFiltreMod : null,
              tol: filtreTol,
            )),
          );
    final positionDna = dnaAsync?.valueOrNull;
    // Filtreli istek daha YANITLANMADAN "verisi yok" yazmak yanlış iddiadır
    // (ilk yükleme birkaç saniye sürebiliyor; kullanıcı bunu gerçek sanıyordu).
    // Yüklenirken satırlar ve panel "hesaplanıyor" der, iddia etmez. İstek
    // BAŞARISIZ olduysa da veri yokluğu iddia edilmez — hata olduğu söylenir
    // (yaşandı: eski backend 400 dönünce ekran "verisi yok" yazıyordu).
    final filtreYukleniyor =
        filtreAktif && dnaAsync != null && dnaAsync.isLoading;
    final filtreHatasi = filtreAktif && dnaAsync != null && dnaAsync.hasError;

    final dna = dnaByPosition(
      muhurluHafta: muhurluHafta,
      masterMatches: matches,
      positionDna: positionDna,
      dnaPeriod: etkinPencere,
    );

    // BUGÜNÜN OYNANMA YÜZDESİ RADAR 5'TE (kullanıcı isteği, 3 Ağustos 2026).
    // Kaynak Radar 3'ün günlük verisidir — ayrı bir uç YOK, aynı istek.
    //
    // HANGİ GÜN: gerçek verisi olan en son geçmiş/bugün günü. Gelecek gün
    // asla seçilmez.
    final playedAsync = gosterilen == null
        ? null
        : ref.watch(_dailyPlayedProvider(gosterilen));
    final dailyPlayed = playedAsync?.valueOrNull;
    final bugunTarih = varsayilanGun(
      dailyPlayed?['days'] as List?,
      dailyPlayed?['matches'] as List?,
    );
    final bugunGunu = ((dailyPlayed?['days'] as List?) ?? const [])
        .cast<Map>()
        .where((g) => g['date'] == bugunTarih)
        .firstOrNull;
    // Gün adı maç satırının YANINDA duruyor; orada yer dar olduğu için
    // KISALTILIR — "Pazartesi 03.08" takım adını ezerdi.
    final bugunGunKisa =
        kKisaGun['${bugunGunu?['weekday']}'] ??
        (bugunGunu?['weekday'] as String?);
    final bugunler = bugunPctByNo(dailyPlayed, bugunTarih);

    // ORAN MODUNDA GÜNÜN ORANI (kullanıcı isteği, 2026-08-10): maçın yanındaki
    // şerit oynanma yüzdesi yerine o günün GERÇEK 1/X/2 oranını gösterir.
    // Kaynak Radar 4'ün günlük verisidir — ayrı uç YOK, aynı istek. İki birim
    // aynı anda basılmaz: oynanma yüzdesi oran DEĞİLDİR.
    final oranModu = filtreAktif && _dnaFiltreMod == 'oran';
    final oddsAsync = (!oranModu || gosterilen == null)
        ? null
        : ref.watch(_dailyOddsProvider(gosterilen));
    final dailyOdds = oddsAsync?.valueOrNull;
    final oranTarih = varsayilanGun(
      dailyOdds?['days'] as List?,
      dailyOdds?['matches'] as List?,
    );
    final oranGunu = ((dailyOdds?['days'] as List?) ?? const [])
        .cast<Map>()
        .where((g) => g['date'] == oranTarih)
        .firstOrNull;
    final oranGunKisa =
        kKisaGun['${oranGunu?['weekday']}'] ??
        (oranGunu?['weekday'] as String?);
    final bugunOranlar = bugunOranByNo(dailyOdds, oranTarih);

    // FİLTRE ŞERİDİ YAPIŞIK — kaynakta `stickyHeaderIndices: [0]` yalnız bu
    // sekmeye verilir. Flutter karşılığı: şerit listenin DIŞINDA, üstte sabit;
    // maç satırları altında kayar. (Radar 4'ün uzun ⓘ paneli LİSTEYLE kayar —
    // dondurulursa ekranın yarısını kaplardı; yapışıklık yalnız Radar 5'e ait.)
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            Spacing.md,
            Spacing.md,
            Spacing.md,
            0,
          ),
          child: DnaDonemFiltresi(
            positionDna: positionDna,
            dnaPeriod: _dnaPeriod,
            onSelect: (k) => setState(() => _dnaPeriod = k),
            muhurluHafta: muhurluHafta,
            muhurluRadar5Yok: dna.muhurluRadar5Yok,
            sealedAt: meta['sealedAt'],
            filtreMod: filtreAktif ? _dnaFiltreMod : null,
            onFiltreModSec: (mod) => setState(() {
              _dnaFiltreMod = mod;
              // Mod her seçildiğinde süzgeç Birebir + Tümü'ye döner —
              // önceki oturumdan kalan dar/geniş seçim sessizce taşınmaz.
              if (mod != null) {
                _dnaOynanmaTol = 0;
                _dnaOranTol = 0;
                _dnaMacPenceresi = 'allTime';
              }
            }),
            oynanmaTol: _dnaOynanmaTol,
            oranTol: _dnaOranTol,
            onTolSec: (t) => setState(() {
              if (_dnaFiltreMod == 'oran') {
                _dnaOranTol = t;
              } else {
                _dnaOynanmaTol = t;
              }
            }),
            macPenceresi: _dnaMacPenceresi,
            onMacPencereSec: (k) => setState(() => _dnaMacPenceresi = k),
            filtreYukleniyor: filtreYukleniyor,
          ),
        ),
        Expanded(
          child: _bultenDnasiListesi(
            matches,
            gosterilen,
            dna,
            bugunler,
            bugunGunKisa,
            filtreAktif: filtreAktif,
            filtreTol: filtreTol,
            filtreOzet: positionDna?['filtre'] as Map?,
            filtreYukleniyor: filtreYukleniyor,
            filtreHatasi: filtreHatasi,
            bugunOranlar: oranModu ? bugunOranlar : null,
            oranGunKisa: oranGunKisa,
          ),
        ),
      ],
    );
  }

  Widget _bultenDnasiListesi(
    List matches,
    Object? gosterilen,
    ({Map<Object, Map?> byPosition, bool muhurluRadar5Yok}) dna,
    Map<Object, List<({Object kaynak, Map pct})>> bugunler,
    String? bugunGunKisa, {
    bool filtreAktif = false,
    num? filtreTol,
    Map? filtreOzet,
    bool filtreYukleniyor = false,
    bool filtreHatasi = false,
    Map<Object, Map>? bugunOranlar,
    String? oranGunKisa,
  }) {
    // Filtre modunda etiket süzgeci de söyler: "Oynanma ±5 · Son 5 maç".
    final donemEtiketi = filtreAktif
        ? '${_dnaFiltreMod == 'oran' ? 'Oran' : 'Oynanma'} '
              '${tolEtiketi(_dnaFiltreMod!, filtreTol ?? 0)} · '
              '${kDnaMacPencereLabels[_dnaMacPenceresi]}'
        : kDnaPeriodLabels[_dnaPeriod];
    final limit = filtreAktif
        ? kDonemMacSayisi[_dnaMacPenceresi]
        : kDonemMacSayisi[_dnaPeriod];
    return ListView(
      padding: const EdgeInsets.all(Spacing.md),
      children: [
        for (final m in matches.cast<Map>())
          MemoryRow(
            item: m,
            pct: birOndalik(dna.byPosition[m['no']]),
            // Oran modunda oynanma şeridi yerine günün oranı basılır — iki
            // birim yan yana gösterilmez (Radar 3/4 ayrımı).
            bugunKaynaklar: bugunOranlar != null ? null : bugunler[m['no']],
            bugunGunKisa: bugunOranlar != null ? oranGunKisa : bugunGunKisa,
            bugunOran: bugunOranlar?[m['no']],
            acik: _acikSira == m['no'],
            // SATIR AÇILIMI — dokununca bu SIRANIN geçmiş maçları listelenir.
            onToggle: () => setState(
              () => _acikSira = _acikSira == m['no'] ? null : m['no'],
            ),
            muhurluRadar5Yok: dna.muhurluRadar5Yok,
            kayit: _acikSira == m['no']
                ? _siraKaydi(
                    gosterilen,
                    m['no'] as Object,
                    filtreAktif: filtreAktif,
                    filtreTol: filtreTol,
                  )
                : null,
            donemEtiketi: donemEtiketi,
            // Liste SEÇİLİ DÖNEMLE sınırlanır: "Son 5 Hafta" seçiliyken 51 maç
            // göstermek, üstteki yüzdeyle uyuşmayan bir liste olurdu.
            limit: limit,
            filtreMod: filtreAktif ? _dnaFiltreMod : null,
            filtreSira: filtreAktif
                ? ((filtreOzet?['positions'] as Map?)?['${m['no']}'] as Map?)
                : null,
            filtreYukleniyor: filtreYukleniyor,
            filtreHatasi: filtreHatasi,
          ),
      ],
    );
  }

  SiraKaydi _siraKaydi(
    Object? rid,
    Object no, {
    bool filtreAktif = false,
    num? filtreTol,
  }) {
    if (rid == null) {
      return (yukleniyor: false, hata: null, liste: const []);
    }
    final a = ref.watch(
      _siraMaclariProvider((
        rid: rid,
        no: no,
        mod: filtreAktif ? _dnaFiltreMod : null,
        tol: filtreAktif ? filtreTol : null,
      )),
    );
    return a.when(
      loading: () => (yukleniyor: true, hata: null, liste: null),
      error: (e, _) => (yukleniyor: false, hata: '$e', liste: null),
      data: (d) => (
        yukleniyor: false,
        hata: null,
        liste: (d['matches'] as List?) ?? const [],
      ),
    );
  }

  Widget _masterListesi(List matches, Map meta) {
    final sayac = classCountsOf(matches);
    final suzulmus = sortMaster(filterMaster(matches, _filter), _sortMode);

    int sayiOf(String k) => switch (k) {
      'strong' => sayac.strong,
      'medium' => sayac.medium,
      'surprise' => sayac.surprise,
      'insufficient' => sayac.insufficient,
      // Risk süzgeçleri (drawRisk/awaySurprise) GERÇEK eşleşme sayısını
      // gösterir — eskiden bu dal matches.length'e düşüyordu ve "X Beraberlik
      // Riski (15)" her maçı riskli gibi gösteriyordu (2026-08-10 bulgusu).
      // Sayaç, çipin açtığı listeyle AYNI süzgeçten sayar; ayrışamazlar.
      _ => filterMaster(matches, k).length,
    };

    return ListView(
      padding: const EdgeInsets.all(Spacing.md),
      children: [
        // MÜHÜR ŞERİDİ — geçmiş haftada mühür bilgisi, güncelde geri sayım.
        if (meta['sealed'] == true)
          _serit(
            '🔏 Mühürlü radar — bu haftanın kaydı değiştirilemez.',
            AppColors.success,
          )
        else if (freezeMinutes(meta, DateTime.now()) case final dk?)
          _serit('🔒 Mühürlenmeye $dk dk kaldı.', AppColors.warning),

        // Filtre çipleri
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final f in kMasterFilters)
              _cip(
                '${f.label}${f.k == 'all' ? '' : ' (${sayiOf(f.k)})'}',
                nokta: _filtreNoktasi(f.k),
                acik: _filter == f.k,
                onTap: () => setState(() => _filter = f.k),
              ),
          ],
        ),
        const SizedBox(height: 8),

        // Sıralama
        Row(
          children: [
            Text(
              'Sıralama',
              style: TextStyle(
                // SAYFA ZEMİNİ üstünde — kart değil (ters kontrast).
                color: AppColors.onBackgroundMuted,
                fontSize: 11,
                fontWeight: AppFont.heavy,
              ),
            ),
            const SizedBox(width: 8),
            _cip(
              'Bülten sırası',
              acik: _sortMode == 'order',
              onTap: () => setState(() => _sortMode = 'order'),
            ),
            const SizedBox(width: 6),
            _cip(
              'Riske göre',
              acik: _sortMode == 'risk',
              onTap: () => setState(() => _sortMode = 'risk'),
            ),
          ],
        ),
        const SizedBox(height: 10),

        if (suzulmus.isEmpty)
          Padding(
            padding: EdgeInsets.only(top: 20),
            child: Text(
              'Bu süzgeçle maç yok.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
            ),
          )
        else
          for (final m in suzulmus)
            MasterMatchCard(
              item: m,
              expanded: _expandedNo == m['no'],
              onToggle: () => setState(
                () => _expandedNo = _expandedNo == m['no'] ? null : m['no'],
              ),
              // Mühürlü haftada sonucu hâlâ olmayan maç için kart "sonuç
              // bekleniyor — ertelenmiş olabilir" der (2026-08-10, 53. Hafta
              // 14. maç olayı: sessizlik kullanıcıya hata gibi görünüyordu).
              muhurluHafta: meta['sealed'] == true,
            ),
      ],
    );
  }

  /// Radar 3 (Oynanma DNA) ve Radar 4 (Oran Takibi) — gün seçici + satırlar.
  ///
  /// PARAMETRE TUZAĞI: bu iki uç haftanın TAMAMI için çağrılır; maç süzmesi
  /// ekranda `item.no` ile yapılır. `matchId` GEÇİLMEZ — o alan Spor Toto maç
  /// kimliğidir, bülten sırası değildir.
  Widget _gunlukRadar(List matches, Object? gosterilen) {
    if (gosterilen == null) return const SizedBox.shrink();

    final oynanma = _tab == 'publicBetting';
    final async = oynanma
        ? ref.watch(_dailyPlayedProvider(gosterilen))
        : ref.watch(_dailyOddsProvider(gosterilen));

    // Gün seçimi iki radar için ortak (kaynak RadarTabHeader'daki onSelect).
    void gunSec(String g) => setState(() {
      if (oynanma) {
        _playedDay = g;
      } else {
        _oddsDay = g;
      }
    });

    return async.when(
      // Kaynakta üst panel istek sürerken de çizilir ve "yükleniyor" metnini
      // kendisi yazar (dd/dp null dalı) — spinner tek başına kalmaz.
      loading: () => ListView(
        padding: const EdgeInsets.all(Spacing.md),
        children: [
          RadarGunlukUstPanel(
            oynanma: oynanma,
            data: null,
            seciliGun: null,
            onGunSec: gunSec,
          ),
          const SizedBox(height: 24),
          Center(child: CircularProgressIndicator(color: AppColors.primary)),
        ],
      ),
      error: (e, _) => ListView(
        padding: const EdgeInsets.all(Spacing.md),
        children: [
          Text(
            '${oynanma ? 'Oynanma' : 'Oran'} verisi okunamadı: $e',
            style: TextStyle(color: AppColors.textMuted, fontSize: 11.5),
          ),
        ],
      ),
      data: (data) {
        final days = data['days'] as List?;
        final secili =
            (oynanma ? _playedDay : _oddsDay) ??
            varsayilanGun(days, data['matches'] as List?);

        return ListView(
          padding: const EdgeInsets.all(Spacing.md),
          children: [
            RadarGunlukUstPanel(
              oynanma: oynanma,
              data: data,
              seciliGun: secili,
              onGunSec: gunSec,
            ),
            for (final m in matches.cast<Map>())
              if (oynanma)
                PublicRow(
                  item: {'no': m['no'], 'home': m['home'], 'away': m['away']},
                  data: data,
                  day: secili,
                  openKey: _dnaKey,
                  onToggleDna: (k) => setState(() => _dnaKey = k),
                  dnaPanelBuilder: (kaynak) => PlayedDnaPanel(
                    roundId: gosterilen,
                    no: m['no'] as Object,
                    source: kaynak,
                    day: secili,
                  ),
                )
              else
                MarketRow(
                  item: {'no': m['no'], 'home': m['home'], 'away': m['away']},
                  data: data,
                  day: secili,
                ),
          ],
        );
      },
    );
  }

  // Eski `_gunSecici` kaldırıldı (2026-08-09): gün çipleri artık kaynaktaki
  // DayChipsRow'un birebir çevirisiyle çiziliyor (radar_tab_headers.dart) —
  // alt satırda tarih + o günün son çekim saati, maç günü ⚽ işareti ve
  // verisiz gün solukluğu da kaynaktaki gibi.

  /// SADE BAŞLIK — kaynaktaki gibi yalnız hangi haftaya bakıldığı yazar;
  /// yeşil saha paneli ve alt başlık kaldırılmıştı. MÜHÜR ROZETİ KALIYOR:
  /// teknik gösterge değil, GEÇMİŞ bir haftaya bakan kullanıcıya verilen
  /// sözdür ("sonuçlar gelse de değişmez").
  // ZEMİN YOK: başlık kendi `UstPanel` kartının içinde; zemini, kenarlığı ve
  // yuvarlaklığı panel veriyor. Burada ikinci bir dolgu çizmek kenarlığı
  // KAVİSTE örtüyordu — köşe "çapraz kesilmiş" görünüyordu (8× büyütmeyle
  // doğrulandı).
  Widget _ekranBasligi(Map meta) => Container(
    width: double.infinity,
    // İÇ BOŞLUK: üstte `md` — `sm` iken başlık panelin kenarına yapışıyordu.
    padding: const EdgeInsets.fromLTRB(Spacing.md, Spacing.md, Spacing.md, 0),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          meta['round'] != null
              ? '${meta['round']} · Radar Merkezi'
              : 'Radar Merkezi',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 17,
            fontWeight: AppFont.black,
          ),
        ),
        if (meta['sealed'] == true || meta['frozenAt'] != null)
          Container(
            margin: const EdgeInsets.only(top: 6),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: AppRadius.smR,
              border: Border.all(color: AppColors.border),
            ),
            child: Text(
              '🔏 Mühürlü analiz · '
              '${fmtClock(meta['sealedAt'] ?? meta['frozenAt'])} itibarıyla '
              'kilitlendi — sonuçlar gelse de bu görüntü değişmez'
              '${meta['shortHash'] != null ? ' · Doğrulama #${meta['shortHash']}' : ''}',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                fontWeight: AppFont.bold,
                height: 14 / 10.5,
              ),
            ),
          ),
      ],
    ),
  );

  /// HAFTA SEÇİCİ — resmî listedeki gezinti: [sezon ▼] [hafta ▼]
  /// (hafta_secici.dart, kaynaktaki HaftaSecici.js). Durum burada yaşar.
  Widget _haftaSecici(List weeks, Object? curId, Object? gosterilen) {
    if (weeks.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: Spacing.md,
        vertical: Spacing.sm,
      ),
      // ZEMİN VE ALT ÇİZGİ YOK: başlık paneli kendi yüzeyini ve kenarlığını
      // veriyor; bu blok onun İÇİNDE, en altında duruyor.
      child: HaftaSecici(
        weeks: weeks,
        curId: curId,
        selectedId: gosterilen,
        acik: _secAcik,
        onToggle: (k) => setState(() => _secAcik = _secAcik == k ? null : k),
        // Açık liste, ekranın başka yerine dokununca kapanır (standart
        // açılır liste davranışı — 2026-08-10 profesyonellik turu).
        onDisariTiklandi: () => setState(() => _secAcik = null),
        navSezon: _navSezon,
        // Sezon seçilince hafta listesi açılır: resmî sitedeki akışla aynı,
        // sıradaki doğal adım hafta seçmektir.
        onSelectSezon: (y) => setState(() {
          _navSezon = y;
          _secAcik = 'hafta';
        }),
        onSelectWeek: (rid) => setState(() {
          _secAcik = null;
          _selectedId = rid;
          // SEKME KORUMASI: hafta değişince sekme DEĞİŞMEZ.
          _expandedNo = null;
          _playedDay = null;
          _oddsDay = null;
        }),
      ),
    );
  }

  /// SEKMELER — Master + Radar 1-5 şeridi legacy haftalar DIŞINDA her durumda
  /// görünür (boş/bekleyen/hatalı durumlarda da iskelet korunur). Legacy
  /// haftada kaynaktaki eski İKİ sekme gösterilir.
  Widget _sekmeCubugu(bool legacyMode) {
    if (legacyMode) {
      const eski = [
        (k: 'r1', label: 'Radar 1', sub: 'Karar destek'),
        (k: 'r2', label: 'Radar 2', sub: 'xG görünümü'),
      ];
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
        child: Row(
          children: [
            for (final t in eski)
              Expanded(
                child: _sekme(
                  label: t.label,
                  sub: t.sub,
                  secili: _legacyView == t.k,
                  onTap: () => setState(() => _legacyView = t.k),
                ),
              ),
          ],
        ),
      );
    }

    // ZEMİN YOK: sekme paneli (`UstPanel`) kendi zeminini, kenarlığını ve
    // yuvarlaklığını veriyor. Burada ikinci bir dolgu çizilseydi köşeler
    // kareye dönerdi.
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      // Dikeyde de iç boşluk: sekmeler kartın üst/alt kenarına yapışmasın.
      padding: const EdgeInsets.symmetric(
        horizontal: Spacing.md,
        vertical: Spacing.xs,
      ),
      child: Row(
        children: [
          for (final t in kRadarTabDefs)
            _sekme(
              label: t.label,
              sub: t.sub,
              secili: _tab == t.k,
              // Sekme değişince açık kart kapanır (kaynakta
              // `setExpandedNo(null)`).
              onTap: () => setState(() {
                _tab = t.k;
                _expandedNo = null;
              }),
            ),
        ],
      ),
    );
  }

  Widget _sekme({
    required String label,
    required String sub,
    required bool secili,
    required VoidCallback onTap,
  }) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: secili ? AppColors.text : AppColors.textMuted,
              fontSize: 12.5,
              fontWeight: secili ? AppFont.black : AppFont.bold,
            ),
          ),
          Text(
            sub,
            style: TextStyle(
              color: secili ? AppColors.accent : AppColors.muted,
              fontSize: 8.5,
              fontWeight: AppFont.bold,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            height: 3,
            width: 44,
            decoration: BoxDecoration(
              color: secili ? AppColors.accent : Colors.transparent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ],
      ),
    ),
  );

  /// Filtre çipinin solundaki nokta rengi. ANLAMSAL tokenlar kullanılır:
  /// temadan bağımsızdırlar, "sürpriz" her görünümde aynı kırmızıdır.
  /// Nokta istemeyen filtreler (Tümü / X / 2) için null.
  static Color? _filtreNoktasi(String k) => switch (k) {
    'strong' => AppColors.success,
    'medium' => AppColors.warning,
    'surprise' => AppColors.danger,
    'insufficient' => AppColors.muted,
    _ => null,
  };

  /// [nokta] verilirse etiketin soluna o renkte küçük bir daire çizilir —
  /// eskiden 🔴/🟡/🟢 emojisiydi, rengi emoji fontundan geliyordu.
  Widget _cip(
    String etiket, {
    required bool acik,
    required VoidCallback onTap,
    Color? nokta,
  }) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: acik ? AppColors.primary : AppColors.cardAlt,
        borderRadius: AppRadius.smR,
        border: Border.all(color: acik ? AppColors.primary : AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (nokta != null) ...[
            Icon(Icons.circle, size: 9, color: nokta),
            const SizedBox(width: 5),
          ],
          Text(
            etiket,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: acik ? AppColors.onPrimary : AppColors.textSoft,
              fontSize: 11,
              fontWeight: AppFont.heavy,
            ),
          ),
        ],
      ),
    ),
  );

  /// Uyarı/mühür şeridi — SAYFA ZEMİNİ üstünde durur.
  ///
  /// [renk] ANLAMSAL bir renktir (uyarı/bilgi) ve anlamı korunur; yalnız
  /// parlaklığı, takım zemininde okunacak kadar itilir. Ham hâlde bırakınca
  /// sarı zeminli takımda uyarı sarısı kayboluyordu.
  Widget _serit(String metin, Color renk) {
    final okunur = kimlikTonu(renk, AppColors.background);
    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: okunur.withValues(alpha: 0.10),
        borderRadius: AppRadius.smR,
        border: Border.all(color: okunur),
      ),
      child: Text(
        metin,
        style: TextStyle(
          color: okunur,
          fontSize: 11.5,
          fontWeight: AppFont.heavy,
        ),
      ),
    );
  }
}
