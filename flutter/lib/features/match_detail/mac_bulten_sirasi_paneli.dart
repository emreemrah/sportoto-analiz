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
// YAKINLIK FİLTRESİ VAR (kullanıcı kararı, 16 Ağustos 2026 — 11 Ağustos'taki
// karar TERSİNE DÖNDÜ).
//
// Önce "maç detayında sıranın kendisi yeter" denip Radar ekranındaki
// "Oynanma ±5 / Oran ±0.25" süzgeci buraya taşınmamıştı. Kullanıcı bunu eksik
// buldu: maçın içindeyken de o sırada BENZER oynanma/oran koşullarında ne
// çıktığını görmek istiyor.
//
// Süzgeç Radar ekranının KENDİ bileşeniyle (`DnaDonemFiltresi`) ve AYNI
// parametrelerle bağlandı; ikinci bir filtre arayüzü ya da ikinci bir istek
// biçimi yazılmadı. İki ekran aynı süzgeci farklı uygularsa hangisinin doğru
// olduğu bilinemez.
//
// Dönem çipleri DURUYOR, çünkü yüzdenin hangi döneme ait olduğu yazılmazsa
// sayı doğrulanamaz.
//
// 17 AĞUSTOS 2026 — SÜZGEÇ BAĞLANMAMIŞTI (kullanıcı: "filtre çalışmıyor").
// Çipler geldi ama süzgecin ALT KATMANI ekrana bağlı değildi. Beş kopuk uç:
//   1. `_macPenceresi` ölü durumdu — çip basılıyor, hiçbir yerde okunmuyordu.
//      Yüzde her zaman `_donem`den okunuyordu. İki katman aynı anahtarları
//      (allTime/last5/last10/last15) taşıdığı için HATA VERMEDİ: çip seçili
//      görünür, sayı hiç değişmez. Radar ekranındaki `etkinPencere` ayrımı
//      buraya taşındı.
//   2. Satır açılımı süzgeçsizdi (`_siraMaclariProvider` anahtarında mod/tol
//      yoktu) — üstteki yüzde süzülü, alttaki maç listesi süzülmemişti.
//   3. `filtreAktif` hiç hesaplanmıyordu: "istek attım" ile "uç uyguladı"
//      ayrımı yoktu, mühürlü haftada süzgeç uygulanmış sayılıyordu.
//   4. Satır etiketi süzgeci söylemiyordu ("Tüm Haftalar" yazıyordu).
//   5. Oran modunda şerit hâlâ oynanma yüzdesi basıyordu; günün gerçek 1/X/2
//      oranı (Radar 4 günlük verisi) hiç istenmiyordu.
// Ders: "çipi göster" ile "süzgeci uygula" ayrı işlerdir; birincisi ikincisi
// olmadan sessizce yanlış görünür.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../radar/radar_memory.dart';
import '../radar/radar_screen_data.dart';
import '../radar/radar_screen_logic.dart';
import 'mac_radar_paneli.dart';

/// Haftanın sıra dağılımı.
///
/// ANAHTAR SÜZGECİ DE İÇERİR: süzgeç değişince istek yeniden atılmalı. Yalnız
/// `roundId` anahtar olsaydı eski süzgecin sonucu ekranda kalırdı (Radar
/// ekranındaki sağlayıcıyla aynı gerekçe).
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

/// Günün 1/X/2 oranları (Radar 4'ün günlük verisi) — ORAN modunda şerit
/// oynanma yüzdesi yerine bunu yazar. Radar ekranındaki sağlayıcının aynısı.
final _dailyOddsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>(
      (ref, rid) async =>
          Map<String, dynamic>.from(await api.radarDailyOdds(rid) as Map),
    );

/// Satır açılımı: bu SIRANIN geçmiş maçları.
///
/// ANAHTAR SÜZGECİ DE İÇERİR: liste ile üstteki yüzde AYNI süzgeci kullanmak
/// zorunda. Süzgeç yalnız yüzdeye uygulanırsa altta süzülmemiş maçlar
/// listelenir ve kullanıcı ekrandaki sayıyı doğrulayamaz.
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

  // YAKINLIK SÜZGECİ — Radar ekranındaki alanların birebir karşılığı.
  // `_filtreMod` null = dönem modu (süzgeç kapalı).
  String? _filtreMod;
  num _oynanmaTol = 0;
  num _oranTol = 0;
  String _macPenceresi = 'allTime';

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

    // SÜZGEÇ İSTEĞİ: mod seçiliyse tolerans da gönderilir.
    final filtreIstegi = _filtreMod != null;
    final num? istekTol = !filtreIstegi
        ? null
        : (_filtreMod == 'oran' ? _oranTol : _oynanmaTol);
    final dnaAsync = ref.watch(
      _positionDnaProvider((rid: roundId, mod: _filtreMod, tol: istekTol)),
    );
    final positionDna = dnaAsync.valueOrNull;
    final filtreOzet = positionDna?['filtre'] as Map?;

    // İSTEK ile UYGULANDI AYRIDIR (Radar ekranındaki ayrımın aynısı): canlı
    // haftada süzgeç her zaman uygulanır, mühürlü haftada ancak o kırılım
    // mühürde varsa. Ekran neyin uygulandığını YANITTAN öğrenir.
    final filtreAktif =
        filtreIstegi && (!muhurluHafta || filtreOzet?['uygulanmadi'] == false);
    final num? filtreTol = filtreAktif ? istekTol : null;
    final filtreYukleniyor = filtreIstegi && dnaAsync.isLoading;
    final filtreHatasi = filtreIstegi && dnaAsync.hasError;

    // PENCERE SÜZGEÇTEN GELİR — ATLANMASI SESSİZ HATA OLAN NOKTA (bu bir
    // hataydı, 17 Ağustos 2026): süzgeç açıkken pencere `_macPenceresi`dir ve
    // birimi MAÇtır ("süzgece uyan son 5 maç"); kapalıyken `_donem`dir ve
    // birimi HAFTAdır. İki katmanın anahtarları aynı adları taşıdığı için
    // (allTime/last5/last10/last15) yanlış olanı okumak hata vermez: çip
    // seçili görünür, istek yeniden atılmaz, ekrandaki sayı hiç değişmez.
    final etkinPencere = filtreAktif ? _macPenceresi : _donem;

    final dna = dnaByPosition(
      // Süzgeç uygulandıysa değer de uçtan gelir (mühürlü haftada mühürden
      // OKUNMUŞ hâliyle — yeniden hesap değil).
      muhurluHafta: muhurluHafta && !filtreAktif,
      // Mühürlü haftada kaynak SNAPSHOT'tur ve bu maçın kaydı yeter; canlı
      // haftada bu liste zaten kullanılmaz.
      masterMatches: master is Map ? [master] : const [],
      positionDna: positionDna,
      dnaPeriod: etkinPencere,
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

    // ORAN MODUNDA GÜNÜN ORANI — şerit oynanma yüzdesi yerine o günün gerçek
    // 1/X/2 oranını yazar (Radar ekranıyla aynı kural). İki birim yan yana
    // basılmaz: oynanma yüzdesi oran DEĞİLDİR. Mühürlü haftada da çalışır —
    // arşivlenmiş gözlemi göstermek yeniden hesap değildir.
    final oranModu = _filtreMod == 'oran' && (filtreAktif || muhurluHafta);
    final oddsAsync = oranModu ? ref.watch(_dailyOddsProvider(roundId)) : null;
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

    // ETİKET SÜZGECİ DE SÖYLER: "Oynanma ±5 · Son 5 maç". Süzgeç açıkken
    // "Tüm Haftalar" yazmak, yüzdenin hangi kümeden geldiği konusunda yanlış
    // bilgi olurdu.
    final donemEtiketi = filtreAktif
        ? '${_filtreMod == 'oran' ? 'Oran' : 'Oynanma'} '
              '${tolEtiketi(_filtreMod!, filtreTol ?? 0)} · '
              '${kDnaMacPencereLabels[_macPenceresi]}'
        : (muhurluHafta ? null : kDnaPeriodLabels[_donem]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Mühürlü haftada süzgeç şeridi kendi açıklamasını yazıyor (dna yoksa).
        // Dna VARSA şerit çipleri çiziyor; mühür durumu o zaman burada söylenir
        // — aynı cümle iki kez yazılmaz.
        if (muhurluHafta && positionDna?['dna'] != null)
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
          ),
        _filtrePaneli(
          positionDna,
          muhurluHafta,
          dna,
          macKaydi['sealedAt'],
          filtreAktif: filtreAktif,
          filtreYukleniyor: filtreYukleniyor,
        ),
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
            bugunKaynaklar: oranModu ? null : bugunler[no],
            bugunGunKisa: oranModu ? oranGunKisa : bugunGunKisa,
            bugunOran: oranModu ? bugunOranlar[no] : null,
            acik: _acik,
            onToggle: () => setState(() => _acik = !_acik),
            muhurluRadar5Yok: dna.muhurluRadar5Yok,
            kayit: _acik
                ? _siraKaydi(
                    roundId,
                    no,
                    filtreAktif: filtreAktif,
                    filtreTol: filtreTol,
                  )
                : null,
            donemEtiketi: donemEtiketi,
            // Liste ETKİN pencereyle sınırlanır — üstteki yüzdeyle uyuşmayan
            // bir liste gösterilmez.
            limit: kDonemMacSayisi[etkinPencere],
            // Boş sonucun SEBEBİ: "güncel veri yok" ile "yakın maç yok" farklı
            // şeylerdir; özet olmadan satır yanlış sebep yazardı.
            filtreMod: filtreAktif ? _filtreMod : null,
            filtreSira: filtreAktif
                ? ((filtreOzet?['positions'] as Map?)?['$no'] as Map?)
                : null,
            filtreYukleniyor: filtreYukleniyor,
            filtreHatasi: filtreHatasi,
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

  SiraKaydi _siraKaydi(
    Object rid,
    Object no, {
    bool filtreAktif = false,
    num? filtreTol,
  }) {
    final a = ref.watch(
      _siraMaclariProvider((
        rid: rid,
        no: no,
        mod: filtreAktif ? _filtreMod : null,
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

  /// SÜZGEÇ PANELİ — Radar ekranının KENDİ bileşeni (`DnaDonemFiltresi`).
  ///
  /// Kopya bir arayüz yazılmadı: iki ekran aynı süzgeci farklı sunarsa
  /// hangisinin doğru olduğu bilinemez. Mühürlü haftada yalnız mühre yazılmış
  /// (ya da haftanın kesiminden TÜREV olarak üretilebilen) adımlar çip olur —
  /// basınca hiçbir şey değişmeyen bir seçenek kullanıcıyı yanıltırdı.
  Widget _filtrePaneli(
    Map? positionDna,
    bool muhurluHafta,
    ({bool muhurluRadar5Yok, Map? byPosition}) dna,
    Object? sealedAt, {
    required bool filtreAktif,
    required bool filtreYukleniyor,
  }) {
    final secilebilir = <String>{
      ...((positionDna?['muhurluFiltreler'] as List?) ?? const []).map((e) => '$e'),
      ...((positionDna?['turevFiltreler'] as List?) ?? const []).map((e) => '$e'),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.sm),
      child: DnaDonemFiltresi(
        positionDna: positionDna,
        dnaPeriod: _donem,
        onSelect: (k) => setState(() => _donem = k),
        muhurluHafta: muhurluHafta,
        muhurluRadar5Yok: dna.muhurluRadar5Yok,
        sealedAt: sealedAt,
        // Mühürlü haftada çip SEÇİLİ görünmeli: orada süzgeç mühre yazılmamış
        // olsa bile GÖRÜNÜM modu çalışıyor (bkz. oranModu). `filtreAktif`e
        // bağlansaydı seçim hiç işaretlenmezdi.
        filtreMod: (filtreAktif || muhurluHafta) ? _filtreMod : null,
        muhurluFiltreler: secilebilir,
        turevGorunum: positionDna?['turev'] == true,
        onFiltreModSec: (mod) => setState(() {
          _filtreMod = mod;
          // Mod her seçildiğinde süzgeç Birebir + Tümü'ye döner — önceki
          // seçimden kalan dar/geniş değer sessizce taşınmaz (Radar ekranıyla
          // aynı kural).
          if (mod != null) {
            _oynanmaTol = 0;
            _oranTol = 0;
            _macPenceresi = 'allTime';
          }
        }),
        oynanmaTol: _oynanmaTol,
        oranTol: _oranTol,
        onTolSec: (t) => setState(() {
          if (_filtreMod == 'oran') {
            _oranTol = t;
          } else {
            _oynanmaTol = t;
          }
        }),
        macPenceresi: _macPenceresi,
        onMacPencereSec: (k) => setState(() => _macPenceresi = k),
        filtreYukleniyor: filtreYukleniyor,
      ),
    );
  }

}
