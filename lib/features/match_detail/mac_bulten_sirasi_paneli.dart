// BÜLTEN SIRASI (RADAR 5) — YALNIZ BU MAÇ İÇİN (kullanıcı isteği, 2026-08-11)
//
// Radar ekranındaki Radar 5 sekmesi haftanın 15 sırasını birden listeler.
// Maçın içindeyken kullanıcı tek bir şeyi soruyor: "BU maç bültende kaçıncı
// sırada ve o sırada geçmişte ne çıkmış?" Bu panel yalnız onu yanıtlar.
//
// TASARIM KARARI (mac_radar_paneli.dart ile aynı gerekçe): satırı Radar
// ekranının KENDİ bileşeni çizer (`MemoryRow`) ve yüzdeyi Radar ekranının
// KENDİ fonksiyonu hesaplar (`dnaByPosition` + `birOndalik`). Kopya bileşen ya
// da ikinci bir hesap yazılmadı; iki ekran aynı veriyi farklı gösterirse
// hangisinin doğru olduğu bilinemez.
//
// MÜHÜR KURALI DEĞİŞMEDEN TAŞINDI: mühürlü haftada değerler YALNIZ snapshot'tan
// okunur, canlı hesap yapılmaz ve dönem filtresi gösterilmez (tek doğru kaynak
// snapshot'tur). Bu yüzden mühür durumu BİLİNMEDEN yüzde çizilmez: `radarMatch`
// yanıtı gelene kadar ekran "hesaplanıyor" der, yokluk ya da değer İDDİA ETMEZ.
//
// YAKINLIK FİLTRESİ YOK: Radar ekranındaki "Oynanma ±5 / Oran ±0.25" üst-katman
// süzgeci buraya taşınmadı — kullanıcı maç detayında sıranın kendisini istedi.
// Dönem çipleri (Tüm/5/10/15 hafta) DURUYOR, çünkü yüzdenin hangi döneme ait
// olduğu yazılmazsa sayı doğrulanamaz.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../radar/radar_memory.dart';
import '../radar/radar_screen_data.dart';
import '../radar/radar_screen_logic.dart';
import 'mac_radar_paneli.dart';

/// Haftanın sıra dağılımı. Yakınlık süzgeci GEÇİLMEZ (bkz. dosya başı).
final _positionDnaProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>(
      (ref, rid) async => Map<String, dynamic>.from(
        await api.radarPositionDna(roundId: rid) as Map,
      ),
    );

/// Maçın Radar Merkezi kaydı + HAFTANIN MÜHÜR DURUMU (`/api/radar/:rid/match/
/// :no`). Mühürlü haftada sıra yüzdesi bu kaydın içindeki dondurulmuş
/// `radars.bulletinMemory` değerinden okunur.
final _radarMacProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({Object rid, Object no})>(
      (ref, k) async =>
          Map<String, dynamic>.from(await api.radarMatch(k.rid, k.no) as Map),
    );

/// Günün oynanma yüzdeleri (Radar 3'ün günlük verisi) — satırın yanındaki
/// şerit. AYRI bir uç yok; matchId GEÇİLMEZ (radar_panel_parametre bekçisi).
final _dailyPlayedProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>((ref, rid) async {
      final d = await api.radarDailyPlayed(rid);
      return Map<String, dynamic>.from(d as Map);
    });

/// Satır açılımı: bu SIRANIN geçmiş maçları.
final _siraMaclariProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({Object rid, Object no})>(
      (ref, k) async => Map<String, dynamic>.from(
        await api.radarPositionMatches(k.no, roundId: k.rid) as Map,
      ),
    );

class MacBultenSirasiPaneli extends ConsumerStatefulWidget {
  const MacBultenSirasiPaneli({super.key, required this.m});

  final Map<String, dynamic> m;

  @override
  ConsumerState<MacBultenSirasiPaneli> createState() =>
      _MacBultenSirasiPaneliState();
}

class _MacBultenSirasiPaneliState extends ConsumerState<MacBultenSirasiPaneli> {
  String _donem = 'allTime';
  bool _acik = false;

  @override
  Widget build(BuildContext context) {
    final roundId = widget.m['roundId'];
    final no = widget.m['no'];

    if (roundId == null || no == null) {
      return MacRadarKart(
        children: [
          Text(
            'Bu maç için hafta/sıra bilgisi yok — bülten sırası gösterilemez.',
            style: kMacRadarBos,
          ),
        ],
      );
    }

    final home = widget.m['home'] as Map?;
    final away = widget.m['away'] as Map?;
    final satir = {
      'no': no,
      'home': home?['mediumName'] ?? home?['name'] ?? 'Ev sahibi',
      'away': away?['mediumName'] ?? away?['name'] ?? 'Deplasman',
    };

    final macAsync = ref.watch(_radarMacProvider((rid: roundId, no: no)));

    return MacRadarKart(
      baslik: 'Radar 5 · Bülten Sırası',
      alt:
          '$no. sıra — bu maç bültendeki $no. sırada. Aşağıdaki yüzdeler o '
          'SIRADA geçmiş haftalarda çıkan sonuçlardır; satıra dokununca hangi '
          'maçlardan geldiği listelenir.',
      children: [
        macAsync.when(
          loading: () => const MacRadarBekle(),
          // Bu hafta için Radar Merkezi kaydı yoksa uç 404 döner. "Veri yok"
          // demek yerine sebebi yazılır — hata ile yokluk aynı şey değildir.
          error: (e, _) =>
              Text('Bülten sırası verisi okunamadı: $e', style: kMacRadarBos),
          data: (kayit) => _govde(kayit, roundId, no, satir),
        ),
      ],
    );
  }

  Widget _govde(
    Map<String, dynamic> macKaydi,
    Object roundId,
    Object no,
    Map satir,
  ) {
    final muhurluHafta = macKaydi['sealed'] == true;
    final master = macKaydi['match'];

    final dnaAsync = ref.watch(_positionDnaProvider(roundId));
    final positionDna = dnaAsync.valueOrNull;

    final dna = dnaByPosition(
      muhurluHafta: muhurluHafta,
      // Mühürlü haftada kaynak SNAPSHOT'tur ve bu maçın kaydı yeter; canlı
      // haftada bu liste zaten kullanılmaz.
      masterMatches: master is Map ? [master] : const [],
      positionDna: positionDna,
      dnaPeriod: _donem,
    );

    // Günün oynanma yüzdesi satırın yanında durur (Radar 5'in kendi dili).
    final playedAsync = ref.watch(_dailyPlayedProvider(roundId));
    final dailyPlayed = playedAsync.valueOrNull;
    final bugunTarih = varsayilanGun(
      dailyPlayed?['days'] as List?,
      dailyPlayed?['matches'] as List?,
    );
    final bugunGunu = ((dailyPlayed?['days'] as List?) ?? const [])
        .cast<Map>()
        .where((g) => g['date'] == bugunTarih)
        .firstOrNull;
    final bugunGunKisa =
        kKisaGun['${bugunGunu?['weekday']}'] ??
        (bugunGunu?['weekday'] as String?);
    final bugunler = bugunPctByNo(dailyPlayed, bugunTarih);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (muhurluHafta)
          Padding(
            padding: const EdgeInsets.only(bottom: Spacing.sm),
            child: Text(
              dna.muhurluRadar5Yok
                  ? 'Bu hafta için mühürlü Radar 5 kaydı yok.'
                  : 'Mühürlü kayıt — bu hafta donduğu andaki değerler'
                        '${_muhurTarihi(macKaydi['sealedAt'])}. Sonradan gelen '
                        'sonuçlar bu ekranı değiştirmez.',
              style: kMacRadarBos,
            ),
          )
        else
          _donemCipleri(),
        // Yüzde HENÜZ gelmediyse satır "yok" demez: dağılım isteği uçarken
        // pct null geçmek "bu dönemde geçmiş sonuç yok" cümlesini bastırırdı.
        if (!muhurluHafta && dnaAsync.isLoading)
          const MacRadarBekle()
        else if (!muhurluHafta && dnaAsync.hasError)
          Text(
            'Sıra dağılımı alınamadı: ${dnaAsync.error}',
            style: kMacRadarBos,
          )
        else
          MemoryRow(
            item: satir,
            pct: birOndalik(_sirayiBul(dna.byPosition, no)),
            bugunKaynaklar: bugunler[no],
            bugunGunKisa: bugunGunKisa,
            acik: _acik,
            onToggle: () => setState(() => _acik = !_acik),
            muhurluRadar5Yok: dna.muhurluRadar5Yok,
            kayit: _acik ? _siraKaydi(roundId, no) : null,
            donemEtiketi: muhurluHafta ? null : kDnaPeriodLabels[_donem],
            // Liste seçili dönemle sınırlanır — üstteki yüzdeyle uyuşmayan bir
            // liste gösterilmez.
            limit: kDonemMacSayisi[_donem],
          ),
      ],
    );
  }

  String _muhurTarihi(Object? sealedAt) {
    if (sealedAt == null) return '';
    final s = '$sealedAt';
    return ' (${s.substring(0, s.length.clamp(0, 10))})';
  }

  /// Sıra anahtarı JSON'dan sayı ya da metin gelebilir; ikisi de aynı sıradır.
  /// Tip yüzünden eşleşmeyen bir anahtar ekranda SESSİZ "veri yok" olurdu.
  Map? _sirayiBul(Map<Object, Map?> byPosition, Object no) {
    if (byPosition.containsKey(no)) return byPosition[no];
    for (final e in byPosition.entries) {
      if ('${e.key}' == '$no') return e.value;
    }
    return null;
  }

  SiraKaydi _siraKaydi(Object rid, Object no) {
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

  /// Dönem çipleri — Radar ekranındaki dört dönem, aynı anahtarlarla.
  Widget _donemCipleri() => Padding(
    padding: const EdgeInsets.only(bottom: Spacing.sm),
    child: Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final p in kDnaPeriods)
          Semantics(
            button: true,
            selected: _donem == p.k,
            label: p.label,
            child: GestureDetector(
              key: Key('bulten-sirasi-donem-${p.k}'),
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _donem = p.k),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: _donem == p.k ? AppColors.primary : AppColors.bgAlt,
                  borderRadius: AppRadius.smR,
                  border: Border.all(
                    color: _donem == p.k ? AppColors.primary : AppColors.border,
                  ),
                ),
                child: Text(
                  p.label,
                  style: TextStyle(
                    color: _donem == p.k ? AppColors.white : AppColors.textSoft,
                    fontSize: 11.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );
}
