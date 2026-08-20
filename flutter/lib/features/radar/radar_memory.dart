// KAYNAK: app/src/components/SiraGecmisListesi.js + RadarScreen.js'in
// `renderMemoryRow` bölümü + RadarTabHeaders.js'in `bulletinMemory` paneli.
// BİREBİR çeviri.
//
// RADAR 5 — BÜLTEN DNA: "bu SIRADA geçmişte ne çıktı?"
//
// TASARIM (kaynaktaki kararlar, sadeleştirilmemeli):
//  * Sade maç odaklı görünüm: üstte yalnız küçük dönem filtresi. Teknik
//    bilgiler (n, arşiv sayısı, shrinkage) ana ekranda YOK.
//  * Satıra dokununca o sıranın geçmiş maçları TABLO hâlinde açılır. Yüzdenin
//    arkasındaki maçlar gösterilmezse kullanıcı sayıyı doğrulayamaz.
//  * Liste SEÇİLİ DÖNEMLE sınırlanır: "Son 5 Hafta" seçiliyken 51 maç
//    göstermek, üstteki yüzdeyle uyuşmayan bir liste olurdu.
//  * BUGÜNÜN oynanma yüzdesi maçın YANINDA durur ve kaynaklar ORTALANMAZ —
//    iki kaynak farklı yüzde veriyorsa bu bir bilgidir.
//  * Mühürlü haftada dönem filtresi GÖSTERİLMEZ; tek doğru kaynak snapshot'tur.
//
// KAYNAKTAN BİLİNÇLİ SAPMA (2026-08-10, kullanıcı isteği) — kart düzeni:
//  * Takım adları İKİ AYRI SATIRDA ve TAM (kesme/üç nokta yok; uzun ad alt
//    satıra sarar — 320px'te bile taşmaz).
//  * Gün adı + kaynak noktası + açma oku SAĞ ÜSTTE kompakt kümede.
//  * Günün değerleri (oynanma %'si ya da oran modunda günün oranı) takım
//    adlarının SAĞINDA, kutusuz kompakt şerit: "1 %72 · X %16 · 2 %12".
//    Yüzde işareti PROJE DİLİNDE önde kalır (alt rozetler ve tablo da %N).

import 'package:flutter/material.dart';

import '../../core/theme/takim_paleti.dart' show okunurMetin;
import '../../core/theme/tokens.dart';
import 'provider_labels.dart';
import 'radar_screen_data.dart';
import 'radar_screen_logic.dart';

// DÖNEM SABİTLERİ (kDnaPeriods / kDonemMacSayisi / kDnaPeriodLabels) zaten
// radar_screen_data.dart içinde — burada TEKRARLANMAZ, oradan gelir.

/// "Pazar" ve "Pazartesi" ilk üç harfte aynı olduğu için kesme değil, açık
/// eşleme kullanılır.
const Map<String, String> kKisaGun = {
  'Pazar': 'Paz',
  'Pazartesi': 'Pzt',
  'Salı': 'Sal',
  'Çarşamba': 'Çar',
  'Perşembe': 'Per',
  'Cuma': 'Cum',
  'Cumartesi': 'Cmt',
};

/// Bir sıranın geçmiş maç kaydı: yükleniyor / hata / liste.
typedef SiraKaydi = ({bool yukleniyor, String? hata, List? liste});

// ——— Dönem filtresi (sekme üst paneli) ———

class DnaDonemFiltresi extends StatelessWidget {
  const DnaDonemFiltresi({
    super.key,
    required this.positionDna,
    required this.dnaPeriod,
    required this.onSelect,
    required this.muhurluHafta,
    required this.muhurluRadar5Yok,
    this.sealedAt,
    // Yakınlık filtresi (spec 2026-08-08; KAYNAKTA HENÜZ YOK — bkz.
    // radar_screen_data.dart notu). filtreMod null = dönem modu.
    this.filtreMod,
    this.onFiltreModSec,
    this.oynanmaTol = 0,
    this.oranTol = 0,
    this.onTolSec,
    this.macPenceresi = 'allTime',
    this.onMacPencereSec,
    this.filtreYukleniyor = false,
    this.muhurluFiltreler = const <String>{},
    this.turevGorunum = false,
  });

  final Map? positionDna;
  final String dnaPeriod;
  final ValueChanged<String> onSelect;
  final bool muhurluHafta;
  final bool muhurluRadar5Yok;
  final Object? sealedAt;

  final String? filtreMod;
  final ValueChanged<String?>? onFiltreModSec;
  final num oynanmaTol;
  final num oranTol;
  final ValueChanged<num>? onTolSec;
  final String macPenceresi;
  final ValueChanged<String>? onMacPencereSec;
  final bool filtreYukleniyor;

  /// MÜHÜRLÜ HAFTADA KULLANILABİLİR SÜZGEÇ SEÇİMLERİ — `'oynanma:3'` biçiminde
  /// anahtarlar (16 Ağustos 2026). Mühür artık yakınlık kırılımlarını da
  /// taşıyor; ama YALNIZ bu tarihten sonra mühürlenen haftalarda. Bu küme,
  /// mühürde karşılığı OLMAYAN bir adımın çip olarak sunulmasını engeller —
  /// basınca hiçbir şey değişmeyen ya da sessizce süzgeçsiz değere düşen bir
  /// seçenek, kullanıcıyı yanıltırdı. Boş küme = eski mühür (süzgeç yok).
  final Set<String> muhurluFiltreler;

  /// Sayılar mühürden mi okundu, yoksa mührün kesimiyle BUGÜN mü hesaplandı?
  /// Türev görünümde ekran bunu açıkça yazar — kullanıcı elindeki sayının
  /// noter kaydı mı yoksa yeniden üretilmiş bir çözümleme mi olduğunu
  /// bilmeden karar vermemeli.
  final bool turevGorunum;

  /// Bu modda mühürde kayıtlı yakınlık adımları (mühürlü hafta için).
  List<num> _muhurluAdimlar(String mod) {
    final tumu = mod == 'oynanma' ? kOynanmaTolAdimlari : kOranTolAdimlari;
    return tumu.where((t) => muhurluFiltreler.contains('$mod:$t')).toList();
  }

  /// Mühürlü haftada seçili mod için süzgeç sunulabilir mi?
  bool get _muhurluSuzgecVar =>
      filtreMod != null && _muhurluAdimlar(filtreMod!).isNotEmpty;

  @override
  Widget build(BuildContext context) {
    // MÜHÜRLÜ HAFTA: dönem filtresi GÖSTERİLMEZ. Filtre canlı yeniden hesap
    // demektir; mühürlü haftada tek doğru kaynak snapshot'taki dondurulmuş
    // değerdir. Yalnız hangi ana ait olduğu yazılır.
    if (muhurluHafta && positionDna?['dna'] == null) {
      final an = sealedAt == null
          ? ''
          : ' (${'$sealedAt'.substring(0, '$sealedAt'.length.clamp(0, 10))})';
      return _sarmal(
        child: _ipucu(
          muhurluRadar5Yok
              ? 'Bu hafta için mühürlü Radar 5 kaydı yok.'
              : 'Mühürlü kayıt — bu hafta donduğu andaki değerler$an. '
                    'Sonradan gelen sonuçlar bu ekranı değiştirmez.',
        ),
      );
    }

    return _sarmal(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final p in kDnaPeriods)
                // ÇİP YALNIZ FİLTREDİR. Üzerinde "· %66.7" ve eğilim oku
                // duruyordu; kullanıcı kararıyla kaldırıldı.
                _cip(
                  p.label,
                  secili: filtreMod == null && dnaPeriod == p.k,
                  onTap: () {
                    onFiltreModSec?.call(null);
                    onSelect(p.k);
                  },
                ),
              // ÜST KATMAN MOD ÇİPLERİ (spec: dönemlerin YANINA eklenir).
              //
              // MÜHÜRLÜ HAFTADA DA GÖSTERİLİR (kullanıcı kararı, 16 Ağustos
              // 2026) — ama ANLAMI DEĞİŞİR: orada çip bir FİLTRE değil,
              // GÖRÜNÜM SEÇİCİDİR. Mühürlü haftada oynanma ve oran değerleri
              // arşivlenmiş gözlemlerde zaten duruyor; onları yazmak yeniden
              // hesap değildir. Yakınlık ve maç penceresi satırları (aşağıda)
              // filtreye ait olduğu için mühürlü haftada yine çizilmez.
              //
              // Önceki karar (2026-08-10) çipleri tümden gizliyordu; kullanıcı
              // geçmiş haftada bu değerleri göremediğini bildirdi ve ölçüm
              // gizlemenin gereksiz olduğunu gösterdi: /api/radar/daily-odds
              // mühürlü hafta için de gerçek oranları döndürüyor.
              for (final p in kDnaFiltreModlari)
                _cip(
                  p.label,
                  secili: filtreMod == p.k,
                  onTap: () => onFiltreModSec?.call(p.k),
                ),
            ],
          ),
          // MÜHÜRLÜ HAFTADA NE OLDUĞU AÇIKÇA YAZILIR. Çip görünüyor ama
          // yakınlık/pencere satırları yok; kullanıcı "filtre bozuk mu?"
          // diye düşünmesin diye sebebi söylenir. Dürüstlük gereği değerin
          // hangi ana ait olduğu da burada durur.
          if (muhurluHafta && filtreMod != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: _ipucu(
                turevGorunum
                    // TÜREV: mühürde kırılım yok; haftanın KENDİ kesimiyle
                    // (donma anından öncesi) bugün hesaplandı. Geçmiş o
                    // kesimle sınırlı olduğu için sonraki haftalar biriktikçe
                    // tablo büyümez; yine de mühürlü kayıt DEĞİLDİR ve bu
                    // saklanmaz.
                    ? 'TÜREV GÖRÜNÜM — bu sayılar mühürde yok. Haftanın kendi '
                          'kesimiyle (donma anından öncesi) bugün hesaplandı; '
                          'mühürlü kayıt değişmedi.'
                    : _muhurluSuzgecVar
                    // Kırılım mühürde VAR: süzgeç çalışır ama değer yeniden
                    // hesaplanmaz — hafta donduğu anda yazılmış olan okunur.
                    ? 'Mühürlü hafta — süzgeç sonucu da hafta donduğu anda '
                          'mühürlendi. Buradaki sayılar yeniden hesaplanmaz; '
                          'ileride arşiv büyüse de değişmez.'
                    // Ne mühürde var ne türev üretilebildi.
                    : 'Mühürlü hafta — hafta donduğu andaki '
                          '${filtreMod == 'oran' ? 'oranlar' : 'oynanma yüzdeleri'} '
                          'gösteriliyor. Bu hafta için yakınlık kırılımı ne '
                          'mühürde var ne de hesaplanabildi.',
              ),
            ),
          // Süzgeç satırları: canlı haftada her zaman; mühürlü haftada ancak
          // kırılım MÜHÜRDE varsa ya da TÜREV olarak hesaplanabildiyse.
          if (filtreMod != null &&
              (!muhurluHafta || _muhurluSuzgecVar || turevGorunum)) ...[
            // ALT KATMAN 1 — yakınlık adımı. Kullanıcı seçer, otomatik
            // genişleme yok (Radar 3 dili).
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    'Yakınlık:',
                    style: TextStyle(
                      color: AppColors.textSoft,
                      fontSize: 11.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                  // MÜHÜRLÜ HAFTADA YALNIZ MÜHÜRDEKİ ADIMLAR. Canlı haftada
                  // hepsi hesaplanabilir; mühürlü haftada yalnız donarken
                  // yazılanlar vardır ve olmayanı çip yapmak yanıltıcı olur.
                  for (final t
                      in muhurluHafta && !turevGorunum
                          ? _muhurluAdimlar(filtreMod!)
                          : (filtreMod == 'oynanma'
                                ? kOynanmaTolAdimlari
                                : kOranTolAdimlari))
                    _cip(
                      tolEtiketi(filtreMod!, t),
                      secili:
                          t == (filtreMod == 'oynanma' ? oynanmaTol : oranTol),
                      onTap: () => onTolSec?.call(t),
                    ),
                ],
              ),
            ),
            // ALT KATMAN 2 — pencere. BİRİM MAÇTIR, HAFTA DEĞİL: "Son 5 maç"
            // = süzgece uyan son 5 maç; 5 hafta değil (spec'in atlanmaması
            // gereken noktası).
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final p in kDnaMacPencereleri)
                    _cip(
                      p.label,
                      secili: macPenceresi == p.k,
                      onTap: () => onMacPencereSec?.call(p.k),
                    ),
                ],
              ),
            ),
            ..._filtreIpuclari(),
          ],
          if (positionDna != null && positionDna!['hasData'] != true)
            _ipucu(
              '${positionDna!['note'] ?? 'Resmî geçmiş arşiv birikiyor — veri geldikçe sıra yüzdeleri görünür.'}',
            ),
          if (positionDna?['retrospective'] == true)
            _ipucu(
              'Simülasyon: bu hafta için resmî mühür yok. Hesap yalnız bu '
              'haftadan önce tamamlanmış sonuçlardan üretildi.',
            ),
        ],
      ),
    );
  }

  /// Filtre modunun dürüstlük satırları: kaç maçın verisi bilindiği AÇIKÇA
  /// yazılır (eksik veri yüzdeye çevrilip gizlenmez — spec kararı 3).
  List<Widget> _filtreIpuclari() {
    final f = positionDna?['filtre'];
    final pozisyonlar = f is Map ? f['positions'] : null;
    if (pozisyonlar is! Map) {
      return [
        _ipucu(
          filtreYukleniyor
              ? 'Süzgeç hesaplanıyor…'
              : 'Her sıra, güncel haftanın aynı sırasındaki maçın son kayıtlı '
                    'değerine göre süzülür.',
        ),
      ];
    }
    num aday = 0;
    num verili = 0;
    num uyan = 0;
    var guncelsiz = 0;
    pozisyonlar.forEach((_, v) {
      if (v is! Map) return;
      aday += (v['aday'] as num?) ?? 0;
      verili += (v['verili'] as num?) ?? 0;
      uyan += (v['uyan'] as num?) ?? 0;
      if (v['guncel'] == null) guncelsiz += 1;
    });
    return [
      _ipucu(
        'Her sıra, güncel haftanın aynı sırasındaki maçın son kayıtlı '
        'değerine göre süzülür. '
        '${filtreMod == 'oran' ? 'Oranı' : 'Oynanması'} bilinen geçmiş maç: '
        '$verili/$aday · süzgeci geçen: $uyan.'
        '${guncelsiz > 0 ? ' $guncelsiz sıranın güncel verisi yok — o sıralarda filtre uygulanamadı.' : ''}',
      ),
    ];
  }

  /// Dönem/mod/yakınlık çipi — hepsi aynı görsel dil.
  Widget _cip(String etiket, {required bool secili, VoidCallback? onTap}) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
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
              color: secili ? AppColors.onPrimary : AppColors.textSoft,
              fontSize: 12,
              fontWeight: AppFont.heavy,
            ),
          ),
        ),
      );

  static Widget _sarmal({required Widget child}) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.sm),
    padding: const EdgeInsets.only(top: 2, bottom: 6),
    color: AppColors.bg,
    child: child,
  );

  static Widget _ipucu(String t) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Text(
      t,
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 11.5,
        height: 16 / 11.5,
      ),
    ),
  );
}

// ——— Radar 5 maç satırı ———

class MemoryRow extends StatelessWidget {
  const MemoryRow({
    super.key,
    required this.item,
    required this.pct,
    required this.bugunKaynaklar,
    required this.bugunGunKisa,
    required this.acik,
    required this.onToggle,
    required this.muhurluRadar5Yok,
    required this.kayit,
    required this.donemEtiketi,
    required this.limit,
    this.filtreMod,
    this.filtreSira,
    this.filtreYukleniyor = false,
    this.filtreHatasi = false,
    this.bugunOran,
  });

  final Map item;

  /// Geçmiş sıra yüzdeleri (bir ondalıklı). Yoksa null → dürüst not.
  final Map<String, String>? pct;

  /// Bugünün oynanma yüzdeleri: `[(kaynak, pct)]`. Yoksa null.
  final List<({Object kaynak, Map pct})>? bugunKaynaklar;
  final String? bugunGunKisa;

  final bool acik;
  final VoidCallback onToggle;
  final bool muhurluRadar5Yok;

  final SiraKaydi? kayit;
  final String? donemEtiketi;
  final int? limit;

  /// Yakınlık filtresi modu (null = dönem modu) ve bu SIRANIN filtre özeti
  /// (backend `filtre.positions[no]`: guncel/aday/verili/uyan). Boş sonucun
  /// SEBEBİNİ doğru yazmak için gerekir: "güncel veri yok" ile "yakın maç
  /// yok" farklı şeylerdir; ikisini tek cümleye indirmek yanlış sebep yazar.
  final String? filtreMod;
  final Map? filtreSira;

  /// Filtreli istek hâlâ uçuyorsa true — satır "verisi yok" İDDİA ETMEZ,
  /// "hesaplanıyor" der (yanıt gelmeden yokluk iddiası yanlış bilgiydi).
  final bool filtreYukleniyor;

  /// Filtreli istek HATAYLA döndüyse true — "verisi yok" değil "sonuç
  /// alınamadı" yazılır. Yaşandı: eski backend 400 dönünce ekran yokluk
  /// iddia ediyordu; hata ile yokluk farklı şeylerdir.
  final bool filtreHatasi;

  /// Oran modunda maçın yanındaki şerit GÜNÜN GERÇEK 1/X/2 ORANIDIR
  /// (kullanıcı isteği, 2026-08-10) — kaynak Radar 4'ün günlük verisi.
  /// Doluysa oynanma şeridinin yerine geçer: iki birim yan yana basılmaz
  /// (oynanma yüzdesi oran DEĞİLDİR — Radar 3/4 ayrımı burada da korunur).
  final Map? bugunOran;

  @override
  Widget build(BuildContext context) {
    // DAR EKRAN: rozet bloğunun sol girintisi kalkar (rozetler artık HER
    // genişlikte alt düzende — bkz. aşağıdaki taşmaz düzen açıklaması).
    final darEkran = MediaQuery.of(context).size.width < 360;

    // Günün değeri var mı? (oynanma ya da oran modu). Gün adı yalnız değerle
    // birlikte anlamlıdır; değer yoksa sağ üstte yalnız ok durur.
    final gunlukVar = bugunOran != null || bugunKaynaklar != null;
    // Nokta o değerlerin KAYNAĞINI söyler. Tek kaynakta sağ üst kümeye
    // alınır; çok kaynakta her değer satırının önünde durur — kaynaklar tek
    // noktaya indirgenmez (dosya başındaki bütünlük kuralı).
    final tekKaynak = bugunOran == null && (bugunKaynaklar?.length ?? 0) == 1;

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            label:
                '${item['no']}. sıranın geçmiş maçları${acik ? ' — kapat' : ''}',
            child: GestureDetector(
              key: Key('radar5-satir-${item['no']}'),
              behavior: HitTestBehavior.opaque,
              onTap: onToggle,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 22,
                    child: Text(
                      '${item['no']}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 15,
                        fontWeight: AppFont.heavy,
                      ),
                    ),
                  ),
                  const SizedBox(width: Spacing.md),
                  // TAKIM ADLARI İKİ AYRI SATIRDA VE TAM — kesme/üç nokta
                  // YOK; uzun ad alt satıra sarar (kullanıcı isteği,
                  // 2026-08-10).
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _takimAdi('${item['home']}'),
                        const SizedBox(height: 2),
                        _takimAdi('${item['away']}'),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  // SAĞ SÜTUN — üstte kompakt küme (gün + tek kaynaksa nokta
                  // + ok), altında günün değerleri. Gün adı önde durur, yoksa
                  // alttaki "Geçmiş N. sıra" satırıyla karışır: biri BU MAÇA
                  // bu haftayı, öteki o SIRADA geçmişi söyler.
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (gunlukVar) ...[
                            Text(
                              bugunGunKisa ?? 'Bugün',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 12.5,
                                fontWeight: AppFont.heavy,
                              ),
                            ),
                            const SizedBox(width: 6),
                          ],
                          if (tekKaynak) ...[
                            _kaynakNokta(bugunKaynaklar!.first.kaynak),
                            const SizedBox(width: 6),
                          ],
                          Text(
                            acik ? '▲' : '▼',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontSize: 11,
                              fontWeight: AppFont.black,
                            ),
                          ),
                        ],
                      ),
                      if (bugunOran != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: _oranDegerleri(),
                        )
                      else if (bugunKaynaklar != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: _oynanmaDegerleri(noktali: !tekKaynak),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          if (pct != null)
            Padding(
              padding: EdgeInsets.only(top: 6, left: darEkran ? 0 : 34),
              // TAŞMAZ DÜZEN — HER GENİŞLİKTE (2026-08-21): etiket kendi
              // satırında, üç rozet ALTTA eşit genişlikte; FittedBox rozeti
              // pay dar gelirse ORANLI küçültür — basamak sayısı ne olursa
              // olsun taşmaz (320px kanıtı testte). Eskiden bu yalnız 360px
              // altındaydı; geniş dalda rozetler Wrap'ın ayrı öğeleriydi ve
              // 360-400dp telefonlarda gerçek yüzdelerle ('%54.5' gibi) yer
              // bitince '2' rozeti ALT SATIRA kayıyordu (2. Hafta mührüyle
              // yüzdeler ilk kez gerçek veriyle dolunca telefonda görüldü).
              // Sığmayınca alta atmak Wrap'ın tanımıdır; "asla kaymasın"
              // isteniyorsa tek doğru düzen zaten dar ekrandaki bu düzendir.
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _pctEtiketi(),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      for (final k in const ['1', 'X', '2']) ...[
                        Expanded(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: _rozet(k),
                          ),
                        ),
                        if (k != '2') const SizedBox(width: 6),
                      ],
                    ],
                  ),
                ],
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(top: 6, left: 34),
              child: Text(
                muhurluRadar5Yok
                    ? 'Bu hafta için mühürlü Radar 5 kaydı yok.'
                    : filtreMod != null
                    ? (filtreYukleniyor
                          ? 'Süzgeç hesaplanıyor…'
                          : filtreHatasi
                          ? 'Süzgeç sonucu alınamadı — tekrar deneyin.'
                          : filtreSira?['guncel'] == null
                          ? 'Bu maçın güncel ${filtreMod == 'oran' ? 'oran' : 'oynanma'} '
                                'verisi yok — filtre uygulanamadı.'
                          : 'Bu yakınlıkta geçmiş maç yok.')
                    : 'Bu dönemde geçmiş sonuç yok.',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),

          if (acik)
            SiraGecmisListesi(
              kayit: kayit,
              donemEtiketi: donemEtiketi,
              limit: limit,
              filtreli: filtreMod != null,
            ),
        ],
      ),
    );
  }

  Widget _pctEtiketi() => Text(
    // Hafta sayısı parantez içinde yazılıyordu, kullanıcı kararıyla kaldırıldı.
    'Geçmiş ${item['no']}. sıra',
    style: TextStyle(
      color: AppColors.textSoft,
      fontSize: 12,
      fontWeight: AppFont.heavy,
    ),
  );

  // GETTER, `static final` DEĞİL: takım teması `AppColors`ı çalışma zamanında
  // değiştirir.
  static Map<String, Color> get _harfRengi => {
    '1': AppColors.info,
    'X': AppColors.warning,
    '2': AppColors.accent,
  };

  Widget _rozet(String k) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
    decoration: BoxDecoration(
      color: AppColors.surfaceSoft,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      border: Border.all(color: AppColors.border),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          constraints: const BoxConstraints(minWidth: 20),
          padding: const EdgeInsets.symmetric(vertical: 2),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _harfRengi[k],
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          child: Text(
            k,
            style: TextStyle(
              // Sarı zeminde beyaz okunmaz; X'te yazı lacivert olur.
              color: okunurMetin(_harfRengi[k] ?? AppColors.gray),
              fontSize: 11,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          '%${pct?[k]}',
          style: TextStyle(
            color: AppColors.textSoft,
            fontSize: 12,
            fontWeight: AppFont.black,
          ),
        ),
      ],
    ),
  );

  /// Takım adı TAM yazılır: maxLines/ellipsis YOK — uzun ad alt satıra
  /// sarar. TAM ad ekranda olduğu için ayrı bir erişilebilirlik kopyası
  /// gerekmez.
  Widget _takimAdi(String ad) => Text(
    ad,
    style: TextStyle(
      color: AppColors.text,
      fontSize: 14,
      fontWeight: AppFont.heavy,
      height: 19 / 14,
    ),
  );

  /// Kaynak RENKLİ NOKTAYLA gösterilir; adı hiçbir yerde geçmez
  /// (yasal/mağaza kısıtı). Etiket renk adını söyler.
  Widget _kaynakNokta(Object kaynak) => Semantics(
    key: Key('radar5-bugun-nokta-${kaynakKodu(kaynak)}'),
    label: providerLabel(kaynak),
    child: Container(
      width: 9,
      height: 9,
      decoration: BoxDecoration(
        color: providerColor(kaynak),
        shape: BoxShape.circle,
      ),
    ),
  );

  /// Değer bloğunun sabit tavanı: Wrap ancak SINIRLI genişlikte sarar (Row
  /// içindeki Wrap hiç sarmaz — bilinen Flutter tuzağı). 170px, en geniş
  /// gerçek içerikte ("1 %100 · X %100 · 2 %100") tek satıra yeter; taşarsa
  /// alt satıra kırılır, ekran taşmaz.
  static const double _kDegerTavani = 170;

  /// "h değer" çifti: harf renksiz ve küçük, değer belirgin. Alt satırdaki
  /// rozetler renkli; burada renk kullanılsaydı iki satır aynı şeymiş gibi
  /// görünürdü — oysa biri bu haftanın değeri, öteki geçmişin sonucu.
  Widget _cift(String h, String deger) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        h,
        style: TextStyle(
          color: AppColors.textSoft,
          fontSize: 11.5,
          fontWeight: AppFont.heavy,
        ),
      ),
      const SizedBox(width: 3),
      Text(
        deger,
        style: TextStyle(
          color: AppColors.text,
          fontSize: 12.5,
          fontWeight: AppFont.heavy,
        ),
      ),
    ],
  );

  // GETTER, statik alan DEĞİL (2026-08-12): `textMuted` takım temasıyla
  // değişir; statik alan ilk okunduğu renkte donar ve tema değişince
  // güncellenmezdi.
  static Widget get _ayrac => Padding(
    padding: EdgeInsets.symmetric(horizontal: 4),
    child: Text(
      '·',
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 11.5,
        fontWeight: AppFont.heavy,
      ),
    ),
  );

  /// Üçlü kompakt şerit: "1 %72 · X %16 · 2 %12" (kutusuz — kullanıcı
  /// isteği, 2026-08-10). Nokta verilirse şeridin başında durur ve o
  /// satırın kaynağını söyler.
  Widget _ucluSerit(List<(String, String)> ciftler, {Object? kaynak}) =>
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _kDegerTavani),
        child: Wrap(
          alignment: WrapAlignment.end,
          crossAxisAlignment: WrapCrossAlignment.center,
          runSpacing: 2,
          children: [
            if (kaynak != null)
              Padding(
                padding: const EdgeInsets.only(right: 5),
                child: _kaynakNokta(kaynak),
              ),
            for (final (i, c) in ciftler.indexed) ...[
              if (i > 0) _ayrac,
              _cift(c.$1, c.$2),
            ],
          ],
        ),
      );

  /// Günün oynanma yüzdeleri — takım adlarının sağında. Çok kaynakta her
  /// satır kendi noktasıyla başlar; kaynaklar ortalanmaz.
  Widget _oynanmaDegerleri({required bool noktali}) => Column(
    crossAxisAlignment: CrossAxisAlignment.end,
    children: [
      for (final (i, k) in bugunKaynaklar!.indexed) ...[
        if (i > 0) const SizedBox(height: 4),
        _ucluSerit([
          for (final h in _kSecenekler) (h, '%${k.pct[h]}'),
        ], kaynak: noktali ? k.kaynak : null),
      ],
    ],
  );

  /// Oran modunun değerleri: günün gerçek 1/X/2 oranı, iki ondalıkla.
  /// KAYNAK NOKTASI YOK — Radar 4 verisi tek birincil kaynaktan gelir.
  /// Değeri olmayan seçenek tire alır; oran UYDURULMAZ.
  Widget _oranDegerleri() {
    String bicim(Object? v) => v is num ? v.toStringAsFixed(2) : '–';
    return _ucluSerit([
      ('1', bicim(bugunOran?['home'])),
      ('X', bicim(bugunOran?['draw'])),
      ('2', bicim(bugunOran?['away'])),
    ]);
  }
}

// ——— Sıra geçmiş listesi (tablo) ———

/// Sütun genişlikleri dar telefona göre seçildi: 3×30 oran + 26 sonuç +
/// boşluklar → karşılaşmaya yeterli yer kalır.
const double _kOranGenislik = 30;

const List<String> _kSecenekler = ['1', 'X', '2'];

class SiraGecmisListesi extends StatefulWidget {
  const SiraGecmisListesi({
    super.key,
    required this.kayit,
    this.donemEtiketi,
    this.limit,
    this.filtreli = false,
  });

  final SiraKaydi? kayit;
  final String? donemEtiketi;
  final int? limit;

  /// Yakınlık filtresi açıkken kapsam notunun kapanış cümlesi değişir:
  /// "tüm haftalardan" demek filtreli ekranda YANLIŞ olurdu.
  final bool filtreli;

  @override
  State<SiraGecmisListesi> createState() => _SiraGecmisListesiState();
}

class _SiraGecmisListesiState extends State<SiraGecmisListesi> {
  // Kapsam notları varsayılan KAPALI — tablo daha çok yer bulsun.
  bool _notAcik = false;

  @override
  Widget build(BuildContext context) {
    final k = widget.kayit;
    if (k?.yukleniyor == true) return _kutu(_bilgi('Maçlar yükleniyor…'));
    if (k?.hata != null) {
      return _kutu(_bilgi('Maçlar okunamadı: ${k!.hata}'));
    }

    final tumu = k?.liste ?? const [];
    if (tumu.isEmpty) {
      return _kutu(_bilgi('Bu sıra için doğrulanmış geçmiş sonuç yok.'));
    }

    final liste = widget.limit != null && widget.limit! < tumu.length
        ? tumu.sublist(0, widget.limit!)
        : tumu;
    final enEski = (liste.last as Map)['week'];
    final kayitsiz = liste
        .where(
          (m) =>
              (m as Map)['played'] is! Map ||
              (m['played'] as Map)['pct'] == null,
        )
        .length;

    return _kutu(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // BAŞLIK SATIRI — 1/X/2'nin ne olduğu BİR KEZ burada söylenir.
          Container(
            padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 6),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(6),
                topRight: Radius.circular(6),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const Flexible(child: _Baslik('KARŞILAŞMA')),
                      const SizedBox(width: 6),
                      // KAPSAM NOTLARI ⓘ ARKASINDA. Notlar SİLİNMEDİ —
                      // dürüstlük gereği duruyorlar, sadece istenince
                      // görünüyorlar.
                      Semantics(
                        button: true,
                        label: _notAcik
                            ? 'Kapsam bilgisini gizle'
                            : 'Bu liste ne kadarını kapsıyor?',
                        child: GestureDetector(
                          onTap: () => setState(() => _notAcik = !_notAcik),
                          child: Container(
                            width: 14,
                            height: 14,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.onPrimary.withValues(
                                  alpha: 0.60,
                                ),
                              ),
                            ),
                            child: Text(
                              _notAcik ? '✕' : 'i',
                              style: TextStyle(
                                color: AppColors.onPrimary,
                                fontSize: 8.5,
                                fontWeight: AppFont.black,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                for (final s in _kSecenekler)
                  SizedBox(
                    width: _kOranGenislik,
                    child: _Baslik(s, orta: true),
                  ),
                const SizedBox(width: 26, child: _Baslik('SON', orta: true)),
              ],
            ),
          ),
          // Alt başlık kullanıcı kararıyla kaldırıldı (3 Ağustos 2026).
          for (var i = 0; i < liste.length; i++)
            _Satir(mac: liste[i] as Map, cift: i % 2 == 1),

          // KAPSAM — iki gerçek de söylenir: listenin nereden başladığı ve
          // üstteki yüzdenin ondan BAĞIMSIZ hesaplandığı. İkincisi olmazsa
          // kullanıcı iki maçlık listeye bakıp üstteki yüzdeyi doğrulamaya
          // çalışır.
          if (_notAcik)
            _bilgi(
              '${widget.donemEtiketi ?? 'Seçili dönem'} · ${liste.length} maç · '
              "liste ${enEski ?? 'kayıt başlangıcı'}'ndan başlar"
              '${kayitsiz > 0 ? ' · $kayitsiz maçta oynanma kaydı yok (–)' : ''}'
              '\n${widget.filtreli ? 'Üstteki yüzde yalnız süzgeci geçen maçlardan hesaplanır.' : 'Üstteki yüzde tüm haftalardan hesaplanır.'}',
            ),
        ],
      ),
    );
  }

  // SOL PAY 34 → 6 (kullanıcı isteği, 2026-08-06: "sığdır"). Tablo kendi
  // başlık satırıyla zaten ayrı bir birim — hizaya ihtiyacı yok.
  static Widget _kutu(Widget child) => Container(
    margin: const EdgeInsets.only(top: 8, left: 6),
    padding: const EdgeInsets.only(top: 8),
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: child,
  );

  static Widget _bilgi(String t) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text(
      t,
      style: TextStyle(
        color: AppColors.muted,
        fontSize: 11,
        fontStyle: FontStyle.italic,
      ),
    ),
  );
}

class _Baslik extends StatelessWidget {
  const _Baslik(this.t, {this.orta = false});

  final String t;
  final bool orta;

  @override
  Widget build(BuildContext context) => Text(
    t,
    maxLines: 1,
    overflow: TextOverflow.ellipsis,
    textAlign: orta ? TextAlign.center : TextAlign.start,
    style: TextStyle(
      color: AppColors.onPrimary,
      fontSize: 9,
      fontWeight: AppFont.black,
      letterSpacing: 0.4,
    ),
  );
}

class _Satir extends StatelessWidget {
  const _Satir({required this.mac, required this.cift});

  final Map mac;
  final bool cift;

  /// Sonuç rozetinin rengi. 1 mavi, X amber, 2 kırmızı — ekranın geri
  /// kalanıyla aynı dil.
  // GETTER, `static final` DEĞİL: takım teması `AppColors`ı çalışma zamanında
  // değiştirir.
  static Map<String, Color> get _rozetZemin => {
    '1': AppColors.info,
    'X': AppColors.warning,
    '2': AppColors.accent,
  };

  @override
  Widget build(BuildContext context) {
    final week = mac['week'];
    final home = '${mac['home'] ?? ''}';
    final away = '${mac['away'] ?? ''}';
    final score = mac['score'];
    final result = mac['result'] as String?;
    final pct = (mac['played'] as Map?)?['pct'] as Map?;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 6),
      decoration: BoxDecoration(
        // Şeritleme — uzun listede gözün satırı kaybetmemesi için.
        color: cift ? AppColors.surfaceSoft : null,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 6),
              // DÜZEN (kullanıcı kararı, 3 Ağustos 2026): hafta maçın BAŞINDA,
              // skor iki takımın ORTASINDA — yani tirenin durduğu yerde. Skor
              // yoksa tire kalır; boşluk bırakmak takım adlarını birbirine
              // yapıştırırdı.
              //
              // TEK SATIR (kullanıcı bildirimi, 2026-08-06: "takım ismi aşağı
              // taşmış"). Sığmayan ad üç noktayla kesilir; TAM ad ekran
              // okuyucu etiketinde durur.
              child: Semantics(
                label: '${week ?? ''} $home ${score ?? ''} $away'.trim(),
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: '${week ?? '—'}',
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 9,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                      TextSpan(text: '  $home '),
                      TextSpan(
                        // SKOR satırın en belirgin ögesidir (kullanıcı
                        // kararı): marka rengi, takım adından büyük ve daha
                        // kalın.
                        text: '${score ?? '–'}',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 12.5,
                          fontWeight: AppFont.black,
                          letterSpacing: 0.3,
                        ),
                      ),
                      TextSpan(text: ' $away'),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 11,
                    fontWeight: AppFont.bold,
                    height: 16 / 11,
                  ),
                ),
              ),
            ),
          ),

          for (final k in _kSecenekler)
            Container(
              width: _kOranGenislik,
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(vertical: 2),
              decoration: BoxDecoration(
                // Gerçekleşen sonucun hücresi koyulaşır: hangi seçeneğin
                // çıktığı, yüzdesiyle BİRLİKTE okunur.
                color: result == k ? AppColors.primarySoft : null,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                // Veri yoksa TİRE konur; %0 yazmak olmayan bilgiyi gerçek gibi
                // gösterirdi. Tire, tablo dilinde "kayıt yok" demektir.
                pct?[k] == null ? '–' : '%${pct![k]}',
                style: TextStyle(
                  color: result == k ? AppColors.primary : AppColors.textSoft,
                  fontSize: 11,
                  fontWeight: result == k ? AppFont.black : AppFont.bold,
                ),
              ),
            ),

          SizedBox(
            width: 26,
            child: Center(
              child: Container(
                constraints: const BoxConstraints(minWidth: 22),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(vertical: 2),
                decoration: BoxDecoration(
                  color: _rozetZemin[result] ?? AppColors.border,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  result ?? '?',
                  style: TextStyle(
                    color: result == 'X'
                        ? AppColors.primary
                        : result == null
                        ? AppColors.textSoft
                        : AppColors.onPrimary,
                    fontSize: 11,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Radar 5 satırı için "bugünün oynanma yüzdeleri" haritası — Radar 3'ün
/// günlük verisinden okunur, AYRI İSTEK YAPILMAZ.
///
/// KAYNAKLAR ORTALANMAZ: iki kaynak farklı yüzde veriyorsa bu bir bilgidir,
/// tek sayıya indirilirse kaybolur.
Map<Object, List<({Object kaynak, Map pct})>> bugunPctByNo(
  Map? dailyPlayed,
  String? bugunTarih,
) {
  final out = <Object, List<({Object kaynak, Map pct})>>{};
  for (final m in (dailyPlayed?['matches'] as List?) ?? const []) {
    final hucre = (m as Map)['cells'] is Map
        ? (m['cells'] as Map)[bugunTarih]
        : null;
    if (!hucreDolu(hucre)) continue;
    final kaynaklar = <({Object kaynak, Map pct})>[];
    final by = (hucre as Map)['bySource'];
    if (by is Map) {
      by.forEach((k, v) {
        final p = (v as Map?)?['percentages'];
        if (p is Map) kaynaklar.add((kaynak: k as Object, pct: p));
      });
    }
    if (kaynaklar.isNotEmpty) out[m['no'] as Object] = kaynaklar;
  }
  return out;
}

/// Radar 5 satırı için "günün 1/X/2 oranı" haritası — Radar 4'ün günlük
/// verisinden okunur, AYRI İSTEK YAPILMAZ (oynanmadaki bugunPctByNo ile aynı
/// desen). Hücresi olmayan maç haritaya girmez; oran uydurulmaz.
Map<Object, Map> bugunOranByNo(Map? dailyOdds, String? tarih) {
  final out = <Object, Map>{};
  for (final m in (dailyOdds?['matches'] as List?) ?? const []) {
    final hucre = (m as Map)['cells'] is Map
        ? (m['cells'] as Map)[tarih]
        : null;
    if (hucre is! Map) continue;
    final oran = hucre['odds'];
    if (oran is Map) out[m['no'] as Object] = oran;
  }
  return out;
}

/// Seçili dönemin sıra→yüzde haritası.
///
/// KAYNAK AYRIMI (bütünlük kuralı):
///  • Mühürlü hafta → YALNIZ snapshot içindeki dondurulmuş Radar 5 çıktısı.
///    Canlı hesap yapılmaz. O haftanın kendi sonuçları kendi ekranına ASLA
///    yansımaz.
///  • Güncel/kilitsiz hafta → canlı hesap (önceki tamamlanmış haftalarla).
({Map<Object, Map?> byPosition, bool muhurluRadar5Yok}) dnaByPosition({
  required bool muhurluHafta,
  required List masterMatches,
  required Map? positionDna,
  required String dnaPeriod,
}) {
  final out = <Object, Map?>{};
  if (muhurluHafta) {
    var bulundu = false;
    for (final mm in masterMatches.cast<Map>()) {
      final pos =
          ((mm['radars'] as Map?)?['bulletinMemory'] as Map?)?['details']
              as Map?;
      final p = pos?['position'] as Map?;
      if (p?['pct'] != null && p?['sample'] != null) {
        out[mm['no'] as Object] = p!['pct'] as Map?;
        bulundu = true;
      }
    }
    // Snapshot'ta Radar 5 kaydı yoksa GERİYE DÖNÜK HESAP YAPILMAZ.
    return (byPosition: out, muhurluRadar5Yok: !bulundu);
  }

  final positions = ((positionDna?['dna'] as Map?)?['positions'] as List?);
  if (positions != null) {
    for (final p in positions.cast<Map>()) {
      final w = (p['windows'] as Map?)?[dnaPeriod] as Map?;
      out[p['position'] as Object] = (w != null && w['sample'] != null)
          ? w['pct'] as Map?
          : null;
    }
  }
  return (byPosition: out, muhurluRadar5Yok: false);
}
