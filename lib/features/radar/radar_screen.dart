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
import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';
import 'legacy_radar_card.dart';
import 'played_dna_panel.dart';
import 'radar_center_cards.dart';
import 'radar_memory.dart';
import 'radar_day_rows.dart';
import 'radar_screen_data.dart';
import 'radar_screen_logic.dart';
import 'radar_tab_headers.dart';

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
final _positionDnaProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>(
      (ref, rid) async =>
          Map<String, dynamic>.from(await api.radarPositionDna(rid) as Map),
    );

/// Bir SIRANIN geçmiş maçları. Anahtar haftayı da içerir: başka haftaya
/// geçilince liste yeniden çekilir.
final _siraMaclariProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({Object rid, Object no})>(
      (ref, k) async => Map<String, dynamic>.from(
        await api.radarPositionMatches(k.no, k.rid) as Map,
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
  bool _haftaAcik = false;
  // Radar 5: dönem filtresi (Tüm/5/10/15) ve açık satır (sıra no).
  String _dnaPeriod = 'allTime';
  Object? _acikSira;
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
    };

    final durum = deriveScreenState(
      loading: viewAsync.isLoading,
      error: viewAsync.hasError ? '${viewAsync.error}' : null,
      view: d,
      legacyRadar: d?['radar'] as List?,
      meta: meta,
    );

    final secici = haftaSeciciVerisi(
      normalized.weeks,
      curId: curId,
      selectedId: gosterilen,
    );

    // Radar Merkezi kaydı yok ama eski sürpriz radarı arşivi var → LEGACY.
    // O görünüm DONMUŞTUR; yeni sistemin sekmeleri/rozetleri gösterilmez.
    final legacyRadar = d?['radar'] as List?;
    final legacyMode =
        !hasData &&
        ((d?['legacyOnly'] == true) ||
            (legacyRadar != null && legacyRadar.isNotEmpty));

    return Scaffold(
      backgroundColor: AppColors.bg,
      // ARKA PLAN DESENİ YOK — kaynakta `ScreenBackdrop` bu ekrandan KULLANICI
      // İSTEĞİYLE kaldırıldı (2026-08-04). Dosyadaki tek "ScreenBackdrop"
      // geçişi o kaldırmayı anlatan yorumdur; sarmalayıcının kendisi yok.
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _haftaSecici(secici, curId),
            _sekmeCubugu(legacyMode),
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
        children: const [
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
            icon: durum == RadarEkranDurumu.error ? '⚠️' : '⏳',
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
              for (final t in const [
                (k: 'red', label: 'Sürprize açık', icon: '🔴'),
                (k: 'yellow', label: 'Dikkat', icon: '🟡'),
                (k: 'green', label: 'Güçlü Aday', icon: '🟢'),
              ])
                _cip(
                  '${t.icon} '
                  '${switch (t.k) {
                    'red' => sayac.red,
                    'yellow' => sayac.yellow,
                    _ => sayac.green,
                  }} '
                  '${t.label}',
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

    // Mühürlü haftada uç yalnız snapshot verisini döner; istek yine de
    // yapılır çünkü "snapshot'ta Radar 5 var mı" bilgisi oradan gelir.
    final dnaAsync = gosterilen == null
        ? null
        : ref.watch(_positionDnaProvider(gosterilen));
    final positionDna = dnaAsync?.valueOrNull;

    final dna = dnaByPosition(
      muhurluHafta: muhurluHafta,
      masterMatches: matches,
      positionDna: positionDna,
      dnaPeriod: _dnaPeriod,
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

    return ListView(
      padding: const EdgeInsets.all(Spacing.md),
      children: [
        DnaDonemFiltresi(
          positionDna: positionDna,
          dnaPeriod: _dnaPeriod,
          onSelect: (k) => setState(() => _dnaPeriod = k),
          muhurluHafta: muhurluHafta,
          muhurluRadar5Yok: dna.muhurluRadar5Yok,
          sealedAt: meta['sealedAt'],
        ),
        for (final m in matches.cast<Map>())
          MemoryRow(
            item: m,
            pct: birOndalik(dna.byPosition[m['no']]),
            bugunKaynaklar: bugunler[m['no']],
            bugunGunKisa: bugunGunKisa,
            acik: _acikSira == m['no'],
            // SATIR AÇILIMI — dokununca bu SIRANIN geçmiş maçları listelenir.
            onToggle: () => setState(
              () => _acikSira = _acikSira == m['no'] ? null : m['no'],
            ),
            muhurluRadar5Yok: dna.muhurluRadar5Yok,
            kayit: _acikSira == m['no']
                ? _siraKaydi(gosterilen, m['no'] as Object)
                : null,
            donemEtiketi: kDnaPeriodLabels[_dnaPeriod],
            // Liste SEÇİLİ DÖNEMLE sınırlanır: "Son 5 Hafta" seçiliyken 51 maç
            // göstermek, üstteki yüzdeyle uyuşmayan bir liste olurdu.
            limit: kDonemMacSayisi[_dnaPeriod],
          ),
      ],
    );
  }

  SiraKaydi _siraKaydi(Object? rid, Object no) {
    if (rid == null) {
      return (yukleniyor: false, hata: null, liste: const []);
    }
    final a = ref.watch(_siraMaclariProvider((rid: rid, no: no)));
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
      _ => matches.length,
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
                acik: _filter == f.k,
                onTap: () => setState(() => _filter = f.k),
              ),
          ],
        ),
        const SizedBox(height: 8),

        // Sıralama
        Row(
          children: [
            const Text(
              'Sıralama',
              style: TextStyle(
                color: AppColors.textMuted,
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
          const Padding(
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
          const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
        ],
      ),
      error: (e, _) => ListView(
        padding: const EdgeInsets.all(Spacing.md),
        children: [
          Text(
            '${oynanma ? 'Oynanma' : 'Oran'} verisi okunamadı: $e',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 11.5),
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

  Widget _haftaSecici(HaftaSeciciVerisi s, Object? curId) => Container(
    padding: const EdgeInsets.symmetric(
      horizontal: Spacing.md,
      vertical: Spacing.sm,
    ),
    decoration: const BoxDecoration(
      color: AppColors.surface,
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Text(
              'Radar Merkezi',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 17,
                fontWeight: AppFont.black,
              ),
            ),
            const Spacer(),
            if (s.sezonlar.length > 1)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Text(
                  s.sezonAdi,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
            GestureDetector(
              onTap: () => setState(() => _haftaAcik = !_haftaAcik),
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: AppColors.cardAlt,
                  borderRadius: AppRadius.smR,
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      s.haftaAdi ?? '—',
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 12,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                    if (s.haftaGuncelMi)
                      const Padding(
                        padding: EdgeInsets.only(left: 5),
                        child: Text(
                          'GÜNCEL',
                          style: TextStyle(
                            color: AppColors.accent,
                            fontSize: 8.5,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ),
                    const SizedBox(width: 4),
                    Text(
                      _haftaAcik ? '▲' : '▼',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 9,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        if (_haftaAcik)
          Container(
            constraints: const BoxConstraints(maxHeight: 220),
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: AppRadius.smR,
              border: Border.all(color: AppColors.border),
            ),
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final w in s.liste)
                  GestureDetector(
                    onTap: () => setState(() {
                      _selectedId = w.roundId;
                      _haftaAcik = false;
                      // SEKME KORUMASI: hafta değişince sekme DEĞİŞMEZ.
                      _expandedNo = null;
                      _playedDay = null;
                      _oddsDay = null;
                    }),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 9,
                      ),
                      color: w.roundId == (_selectedId ?? curId)
                          ? AppColors.primarySoft
                          : Colors.transparent,
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              w.ad,
                              style: TextStyle(
                                color: w.roundId == (_selectedId ?? curId)
                                    ? AppColors.primary
                                    : AppColors.text,
                                fontSize: 12.5,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                          ),
                          if (w.guncel)
                            const Text(
                              'GÜNCEL',
                              style: TextStyle(
                                color: AppColors.accent,
                                fontSize: 8.5,
                                fontWeight: AppFont.black,
                              ),
                            )
                          else if (w.kilitli)
                            const Text('🔏', style: TextStyle(fontSize: 11)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    ),
  );

  /// SEKMELER — Master + Radar 1-5 şeridi legacy haftalar DIŞINDA her durumda
  /// görünür (boş/bekleyen/hatalı durumlarda da iskelet korunur). Legacy
  /// haftada kaynaktaki eski İKİ sekme gösterilir.
  Widget _sekmeCubugu(bool legacyMode) {
    if (legacyMode) {
      const eski = [
        (k: 'r1', label: 'Radar 1', sub: 'Karar destek'),
        (k: 'r2', label: 'Radar 2', sub: 'xG görünümü'),
      ];
      return Container(
        decoration: const BoxDecoration(
          color: AppColors.bgAlt,
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
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

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bgAlt,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
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

  Widget _cip(
    String etiket, {
    required bool acik,
    required VoidCallback onTap,
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
      child: Text(
        etiket,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: acik ? AppColors.white : AppColors.textSoft,
          fontSize: 11,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );

  Widget _serit(String metin, Color renk) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.sm),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: renk.withValues(alpha: 0.08),
      borderRadius: AppRadius.smR,
      border: Border.all(color: renk),
    ),
    child: Text(
      metin,
      style: TextStyle(color: renk, fontSize: 11.5, fontWeight: AppFont.heavy),
    ),
  );
}
