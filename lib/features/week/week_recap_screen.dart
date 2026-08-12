// KAYNAK: app/src/screens/WeekRecapScreen.js — BİREBİR çeviri.
//
// HAFTA KAPANIŞI — resmî sonuçlar geldikçe SEN vs SİSTEM karnesi yan yana.
//
// DÜRÜSTLÜK
//   • Tüm sayılar YALNIZ resmî Spor Toto sonucundan gelir (mantık:
//     week_recap.dart, testli). Canlı/geçici skor buraya yazılmaz.
//   • Karşılaştırma yalnız ikisinin de tahmin yaptığı maçlarda yapılır.
//   • Kupon yoksa kullanıcı karnesi uydurulmaz; sistemin ıskaları yine
//     gösterilir.
//   • Geçmiş ölçümdür — gelecek başarı vaadi değildir.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/coupon/coupon_store.dart';
import '../../core/network/api_client.dart';
import '../../core/services/muhurlu_sistem.dart';
import '../../core/theme/takim_paleti.dart' show okunurMetin;
import '../../core/theme/tokens.dart';
import '../../core/week_recap.dart';
import '../../widgets/states.dart';

// DİL STANDARDI (2026-08-11, kullanıcı isteği): bu ekran kullanıcıyı
// YARGILAMAZ. "Sen bilemedin", "ikiniz de bilemediniz", "sistem bildi" gibi
// suçlayıcı/küçümseyici ifadeler ve patlama/alay çağrıştıran emojiler (💥 🔥
// 🤖) kaldırıldı. Ekran yalnız İKİ ŞEYİ söyler: seçim neydi, resmî sonuçla
// eşleşti mi. "Sen" hitabı yerine kuponun kendi adı ya da "Kupon seçimi"
// kullanılır; "bildin/bilemedin" yerine "eşleşti/eşleşmedi".
//
// Başlık artık sabit bir haritadan değil, maçın KAYITLI durumundan üretilir
// (bkz. _anBasligi): aktarım damgası varsa seçimin sistemden geldiği söylenir,
// damga yoksa bu VARSAYILMAZ.

/// Karar izi adayı — hangi maçta kullanıcının kaydı mühürden farklı.
typedef _Aday = ({
  int no,
  String? kupon,
  String? muhur,
  Map<String, dynamic>? damga,
});

class WeekRecapScreen extends StatefulWidget {
  const WeekRecapScreen({super.key, this.roundId});

  final Object? roundId;

  @override
  State<WeekRecapScreen> createState() => _WeekRecapScreenState();
}

class _WeekRecapScreenState extends State<WeekRecapScreen> {
  Map<String, dynamic>? _rounds;
  Object? _roundId;
  Map<String, dynamic>? _hist;

  /// Backend karnesi — SİSTEM sütununun TEK kaynağı (tek ölçü kararı,
  /// 2026-08-11): tekli mühürlü ana tahmin × resmî sonuç. Kupon düellosu
  /// (satırlardaki pick/tik) ayrı ve 'kupon' etiketiyle durur.
  Map<String, dynamic>? _karne;

  /// Haftanın DEĞİŞTİRİLEMEZ sistem mührü — satırlardaki sistem seçiminin tek
  /// kaynağı (bkz. muhurlu_sistem.dart).
  MuhurluSistem _muhur = MuhurluSistem.yok;

  /// Karar izi ÖNBELLEĞİ (maç no → iz). Aday maçlar için ekran açılırken
  /// önden çekilir: başlığın "değişmiş olabilir" mi yoksa "değişiklikleri" mi
  /// diyeceği ve 15. maç tipi anların doğru anlatılması buna bağlı.
  final Map<int, KararIzi> _izler = {};

  /// Kullanıcının AÇTIĞI karar izi kartları (görünüm durumu).
  final Set<int> _acikIzler = {};
  String? _error;
  bool _loading = true;

  /// Rota sorgu parametresi METİN gelir ('1527'); tur kimlikleri ise SAYIdır.
  /// Normalleştirilmezse hafta başlığı ("53. Hafta / 2025/2026 Sezonu") ve
  /// kupon araması eşleşmez — kupon deposu ile hafta gezme katı `==`
  /// karşılaştırır ('1527' != 1527). Emülatörde yakalandı (2026-08-11):
  /// Haftalık Başarı'dan gelince ekran "—" başlık + "kupon yok" gösteriyordu.
  /// Sayıya çevrilemeyen kimlik olduğu gibi bırakılır.
  static Object? _kimlikNormalle(Object? id) =>
      id is String ? (int.tryParse(id) ?? id) : id;

  @override
  void initState() {
    super.initState();
    _roundId = _kimlikNormalle(widget.roundId);
    _boot();
    // Sunucudaki kuponlar yerel depoya çekilir; başarılıysa karne yeniden
    // hesaplanır (kaynakta `syncFromServer().then(setTick)`).
    syncFromServer().then((synced) {
      if (synced && mounted) setState(() {});
    });
  }

  Future<void> _boot() async {
    setState(() => _error = null);
    try {
      // Karne PARALEL alınır; alınamazsa sistem sütunu sayı UYDURMAZ.
      final sonuclar = await Future.wait([
        api.rounds(),
        api.systemScorecard().catchError((_) => null),
      ]);
      final r = (sonuclar[0] as Map).cast<String, dynamic>();
      if (!mounted) return;
      setState(() {
        _rounds = r;
        _karne = (sonuclar[1] as Map?)?.cast<String, dynamic>();
      });
      if (widget.roundId == null) {
        // Varsayılan: güncelden bir ÖNCEKİ (kapanmış) hafta.
        final all = (r['rounds'] as List?) ?? const [];
        final curIdx = all.indexWhere(
          (x) => (x as Map)['id'] == r['currentRoundId'],
        );
        final nav = curIdx >= 0 ? all.sublist(0, curIdx + 1) : all;
        setState(() {
          _roundId = nav.length >= 2
              ? (nav[nav.length - 2] as Map)['id']
              : (nav.isNotEmpty ? (nav.last as Map)['id'] : null);
        });
      }
      _haftaYukle();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _haftaYukle() async {
    final rid = _roundId;
    if (rid == null) return;
    setState(() {
      _hist = null;
      _muhur = MuhurluSistem.yok;
    });
    try {
      // Maç listesi /api/history'den, SİSTEM SEÇİMİ arşiv mühründen gelir —
      // ikisi paralel çekilir. Mühür alınamazsa sistem sütunu boş kalır,
      // history'nin canlı analize düşebilen `prediction` alanına GÜVENİLMEZ.
      final sonuclar = await Future.wait([
        api.history(rid),
        muhurluSistemSecimleri(rid),
      ]);
      final h = (sonuclar[0] as Map).cast<String, dynamic>();
      // BAYAT YANIT KORUMASI: istek uçarken kullanıcı başka haftaya geçmiş
      // olabilir; geç gelen yanıt yeni haftanın verisini EZMEZ.
      if (mounted && _roundId == rid) {
        setState(() {
          _hist = h;
          _muhur = sonuclar[1] as MuhurluSistem;
        });
        await _izleriOnYukle(rid);
      }
    } catch (_) {
      if (mounted && _roundId == rid) setState(() => _hist = null);
    }
  }

  /// Aday maçların karar izini ÖNDEN çeker (genelde 1-3 maç). Kanıt eldeyken
  /// başlık kesin konuşabilir ve "kupona aldığında sistem ne diyordu" sorusu
  /// tahminle değil kayıtla yanıtlanır.
  Future<void> _izleriOnYukle(Object rid) async {
    final adaylar = _kararIziAdaylari(finalVersion(getRankedCoupon(rid)));
    for (final a in adaylar) {
      final kimlik = _muhur.macKimlikleri[a.no];
      if (kimlik == null) continue;
      final iz = await sistemKararIzi(rid, kimlik);
      if (!mounted || _roundId != rid) return;
      setState(() => _izler[a.no] = iz);
    }
  }

  /// Aday maçlardan EN AZ BİRİNDE kayıtlı değişim var mı?
  bool _degisimKanitli(List<_Aday> adaylar) =>
      adaylar.any((a) => _izler[a.no]?.degisimler.isNotEmpty ?? false);

  /// Maç listesini MÜHÜRLÜ sistem seçimiyle yeniden yazar.
  ///
  /// `/api/history` yanıtındaki `prediction` alanı sunucu cache'inden gelir ve
  /// o cache yoksa CANLI analizi taşır (bkz. muhurlu_sistem.dart başlığı).
  /// Bu yüzden alan burada TAMAMEN atılır ve yerine yalnız arşiv mührü konur;
  /// mühürde tahmin yoksa maç sistemsiz kalır — saf `buildWeekRecap` onu
  /// karşılaştırmaya, başarıya ve "haftanın anları"na SOKMAZ.
  List<Map> _muhurluMaclar() => [
    for (final m in ((_hist?['matches'] as List?) ?? const []).cast<Map>())
      // Önce sunucudan gelen alan SİLİNİR (yayılımla korunursa mühür
      // olmayan maçta canlı tahmin sızar), sonra varsa mühür yazılır.
      Map<String, dynamic>.from(m)
        ..remove('prediction')
        ..addAll(switch (_muhur.secim(m['no'])) {
          final String s => {
            'prediction': {'symbol': s},
          },
          _ => const <String, dynamic>{},
        }),
  ];

  /// SİSTEM TAHMİNİ DEĞİŞMİŞ OLABİLECEK MAÇLAR (2026-08-11 kullanıcı isteği).
  ///
  /// Aday ölçütü — ikisi de KAYITTAN gelir, tahmin yok:
  ///  1. Kupona AKTARIM DAMGASI var ve aktarılan değer mühürden farklı
  ///     (yeni kuponlar; damga aktarım anını ve kaynağı taşır), ya da
  ///  2. Kullanıcının seçimi mühürlü sistem seçiminden farklı (eski kuponlar
  ///     — damga yoktu; 53. Hafta 15. maç böyle yakalanır).
  ///
  /// Aday olması "değişti" demek DEĞİLDİR; yalnız sorgulamaya değer demektir.
  /// Kesin cevap, açılınca sunucudaki gözlem serisinden okunur.
  List<_Aday> _kararIziAdaylari(Map? finalSurum) {
    final damgalar = aktarimDamgalari(finalSurum);
    final secimler = <int, String>{};
    for (final s in ((finalSurum?['selections'] as List?) ?? const [])) {
      if (s is! Map) continue;
      final no = int.tryParse('${s['no']}');
      final o = (s['selectedOutcomes'] as List?)?.cast<String>();
      if (no != null && o != null && o.isNotEmpty) {
        secimler[no] = normalTahmin(o.join()) ?? '';
      }
    }
    final out =
        <
          ({int no, String? kupon, String? muhur, Map<String, dynamic>? damga})
        >[];
    for (final m in ((_hist?['matches'] as List?) ?? const []).cast<Map>()) {
      final no = int.tryParse('${m['no']}');
      if (no == null) continue;
      final muhur = normalTahmin(_muhur.secim(no));
      final damga = damgalar['$no'];
      final aktarilan = normalTahmin(damga?['secim']);
      final kupon = secimler[no];
      final farkVar =
          (aktarilan != null && aktarilan != muhur) ||
          (aktarilan == null &&
              kupon != null &&
              kupon.isNotEmpty &&
              muhur != null &&
              kupon != muhur);
      if (farkVar) {
        out.add((no: no, kupon: kupon, muhur: muhur, damga: damga));
      }
    }
    return out;
  }

  Future<void> _iziAc(int no) async {
    setState(() => _acikIzler.add(no));
    if (_izler.containsKey(no)) return; // önden çekilmişti
    final iz = await sistemKararIzi(_roundId, _muhur.macKimlikleri[no]);
    if (mounted) setState(() => _izler[no] = iz);
  }

  /// Resmî sonucu gelmiş ama MÜHÜRLÜ sistem seçimi olmayan maçlar.
  /// Bunlar sistem başarısına girmez; ekranda açıkça yazılır.
  List<Map> _muhursuzCozulmusMaclar() => [
    for (final m in ((_hist?['matches'] as List?) ?? const []).cast<Map>())
      if (isOfficiallyResolved(m) && _muhur.secim(m['no']) == null) m,
  ];

  @override
  Widget build(BuildContext context) {
    if (_loading && _rounds == null) {
      return _kabuk(LoadingState(message: 'Hafta kapanışı hazırlanıyor…'));
    }
    if (_error != null) {
      return _kabuk(
        SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: Spacing.lg),
          child: ErrorState(message: _error, onRetry: _boot),
        ),
      );
    }

    // ——— hafta gezme (yalnız kapanmış/güncel haftalar) ———
    final all = (_rounds?['rounds'] as List?) ?? const [];
    final curIdx = all.indexWhere(
      (r) => (r as Map)['id'] == _rounds?['currentRoundId'],
    );
    final navRounds = curIdx >= 0 ? all.sublist(0, curIdx + 1) : all;
    final selIdx = navRounds.indexWhere((r) => (r as Map)['id'] == _roundId);
    final selMeta = selIdx >= 0 ? navRounds[selIdx] as Map : null;
    final canPrev = selIdx > 0;
    final canNext = selIdx >= 0 && selIdx < navRounds.length - 1;

    final ranked = _roundId != null ? getRankedCoupon(_roundId) : null;
    final v = ranked != null ? finalVersion(ranked) : null;
    // SİSTEM SEÇİMİ YALNIZ MÜHÜRDEN (2026-08-11): canlı analiz geçmişe
    // karışmaz; mührü olmayan maç sistem tarafında hiç yer almaz.
    final recap = buildWeekRecap(
      matches: _muhurluMaclar(),
      selections: (v?['selections'] as List?) ?? const [],
    );
    final muhursuz = _muhursuzCozulmusMaclar();
    final adaylar = _kararIziAdaylari(v);
    // KULLANICI KUPONUNDAN SONRA SİSTEM TAHMİNİ DEĞİŞEN MAÇ, bu bölümde
    // sistem başarısı olarak GÖSTERİLMEZ (2026-08-11 kullanıcı isteği).
    // Kıyaslanan iki değer aynı ana ait olmadığı için buradaki "eşleşti"
    // ifadesi yanıltıcı olurdu; o maç yalnız "Sistem Tahmini Değişiklikleri"
    // bölümünde, tarafsız biçimde yer alır.
    final oneCikanlar = [
      for (final h in recap.highlights)
        if (!_sistemKupondanSonraDegisti(h.row.no)) h,
    ];

    return _kabuk(
      ListView(
        padding: const EdgeInsets.fromLTRB(
          Spacing.md,
          Spacing.md,
          Spacing.md,
          40,
        ),
        children: [
          _haftaGezme(navRounds, selIdx, selMeta, canPrev, canNext),
          _studyoKarti(recap),
          if (_hist == null && _roundId != null)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Column(
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 6),
                  Text(
                    'Hafta yükleniyor…',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                ],
              ),
            )
          else if (!recap.hasData)
            _bosKart(
              icon: '🕐',
              baslik: 'Bu hafta için resmî sonuç yok',
              metin:
                  'Resmî Spor Toto sonuçları açıklandıkça karne burada oluşur. Geçici/canlı skorla karne yazılmaz.',
            )
          else ...[
            _senVsSistem(recap),
            if (recap.head2head case final h?) _kiyasTemeli(h),
            _anaTahminSatiri(),
            if (muhursuz.isNotEmpty) _muhurUyarisi(muhursuz),
            if (adaylar.isNotEmpty) ...[
              // BAŞLIK KANITA GÖRE (2026-08-11): karar izi değişimi
              // DOĞRULUYORSA kesin konuşulur; kanıt yoksa "olabilir" kalır.
              _BolumBasligi(
                _degisimKanitli(adaylar)
                    ? 'Sistem Tahmini Değişiklikleri'
                    : 'Sistem Tahmini Değişmiş Olabilir',
              ),
              for (final a in adaylar) _kararIziKarti(a),
            ],
            if (oneCikanlar.isNotEmpty) ...[
              const _BolumBasligi('Öne Çıkan Sonuçlar'),
              for (final h in oneCikanlar) _anKarti(h),
            ] else
              _bosKart(
                baslik: 'Ayrışan maç yok',
                metin:
                    'Kupon seçimleri ile sistem seçimleri bu hafta her maçta '
                    'aynı yöndeydi.',
              ),
            const _BolumBasligi('Tüm Resmî Sonuçlar'),
            _tablo(recap),
          ],
          Padding(
            padding: EdgeInsets.only(top: Spacing.sm),
            child: Text(
              'Karne yalnız resmî Spor Toto sonuçlarıyla hesaplanır. Geçmiş ölçümdür, '
              'gelecek sonuç vaadi değildir. 18 yaş altı kullanamaz.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                fontStyle: FontStyle.italic,
                height: 15 / 10.5,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: Spacing.md),
            child: Align(
              alignment: Alignment.centerLeft,
              child: GestureDetector(
                onTap: () => context.go('/kuponlarim'),
                child: Text(
                  'Kuponlarıma Git ›',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 13,
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

  Widget _kabuk(Widget govde) => Scaffold(
    appBar: AppBar(title: const Text('Hafta Kapanışı')),
    body: govde,
  );

  Widget _haftaGezme(
    List all,
    int selIdx,
    Map? selMeta,
    bool canPrev,
    bool canNext,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: Spacing.md),
    child: Row(
      children: [
        _ok('‹', canPrev, 'Önceki hafta', () {
          setState(() => _roundId = (all[selIdx - 1] as Map)['id']);
          _haftaYukle();
        }),
        Expanded(
          child: Column(
            children: [
              Text(
                '${selMeta?['name'] ?? '—'}',
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 16,
                  fontWeight: AppFont.black,
                ),
              ),
              Text(
                '${selMeta?['year'] ?? ''} Sezonu',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontWeight: AppFont.bold,
                ),
              ),
            ],
          ),
        ),
        _ok('›', canNext, 'Sonraki hafta', () {
          setState(() => _roundId = (all[selIdx + 1] as Map)['id']);
          _haftaYukle();
        }),
      ],
    ),
  );

  Widget _ok(String isaret, bool acik, String etiket, VoidCallback onTap) =>
      Opacity(
        opacity: acik ? 1 : 0.35,
        child: Semantics(
          button: true,
          label: etiket,
          child: GestureDetector(
            onTap: acik ? onTap : null,
            child: Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.card,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                isaret,
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 20,
                  fontWeight: AppFont.black,
                ),
              ),
            ),
          ),
        ),
      );

  /// Başlık cümlesi — SİSTEM sayısı KARNEDEN söylenir (tek ölçü kararı,
  /// 2026-08-11). Saf modülün recapHeadline'ı kupon düellosunu anlatıyordu;
  /// VS kartıyla çelişen sayı basmasın diye ekran kendi cümlesini kurar.
  /// Veri yoksa iddia üretilmez.
  String _baslikCumlesi(WeekRecap recap) {
    if (!recap.hasData) {
      return 'Resmî sonuçlar açıklandıkça hafta kapanışı burada oluşur.';
    }
    final o = recap.official;
    final scope = o.complete
        ? 'Hafta kapandı'
        : '${o.resolved}/${o.total} resmî sonuç geldi';
    // AYNI ÖLÇÜ (2026-08-11): başlık cümlesi de VS alanıyla aynı temelden
    // konuşur — ortak maçlar, kupon-kupona. Eski hâl kullanıcının kuponunu
    // (12/14) sistemin TEKLİ ana tahminiyle (5/14) yan yana koyuyordu; bu,
    // ekranın az aşağısındaki adil karşılaştırmayla çelişen bir kıyastı.
    // Tekli ana tahmin artık kendi satırında duruyor.
    final h = recap.head2head;
    if (h != null) {
      return '$scope — ortak ${h.matches} maçta kupon seçimi ${h.user}, '
          'sistemin mühürlü seçimi ${h.system} kez resmî sonuçla eşleşti.';
    }
    final u = recap.user;
    if (u != null) {
      return '$scope — kupon seçimlerinin ${u.correct}/${u.made} tanesi '
          'resmî sonuçla eşleşti.';
    }
    return '$scope — karşılaştırılacak ortak maç yok.';
  }

  Widget _studyoKarti(WeekRecap recap) {
    final o = recap.official;
    final oran = o.total > 0 ? o.resolved / o.total : 0.0;
    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: AppRadius.lgR,
        boxShadow: AppShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '🏁 HAFTA KAPANIŞI',
            style: TextStyle(
              color: AppColors.warning,
              fontSize: 11,
              fontWeight: AppFont.black,
              letterSpacing: 1.6,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              _baslikCumlesi(recap),
              style: TextStyle(
                color: okunurMetin(AppColors.warning),
                fontSize: 15,
                fontWeight: AppFont.heavy,
                height: 22 / 15,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: Container(
                height: 6,
                color: Colors.white.withValues(alpha: 0.18),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: oran,
                  child: const ColoredBox(color: AppColors.success),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Text(
              '${o.resolved}/${o.total} resmî sonuç',
              style: TextStyle(
                color: AppColors.onDarkSoft,
                fontSize: 10.5,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// "SİSTEM TAHMİNİ NEDEN DEĞİŞTİ?" — açılabilir kanıt alanı.
  ///
  /// UYDURMA YASAK: burada yalnız sunucunun gözlem serisindeki kayıtlar
  /// gösterilir (tahmin, 1/X/2 olasılıkları, oranlar, zaman). Kayıt yoksa
  /// "Değişiklik nedeni geçmiş kayıtlardan doğrulanamadı" yazar; sebep
  /// TAHMİN EDİLMEZ. Kriter bazlı öncesi/sonrası seride tutulmuyor, o yüzden
  /// gösterilmiyor — bunu da açıkça söyler.
  Widget _kararIziKarti(_Aday a) {
    final acik = _acikIzler.contains(a.no);
    final iz = _izler[a.no];
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.sm),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadius.mdR,
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              button: true,
              label: '${a.no}. maç sistem tahmini değişikliği',
              child: GestureDetector(
                onTap: () =>
                    acik ? setState(() => _izler.remove(a.no)) : _iziAc(a.no),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '#${a.no} · Sistem tahmini neden değişti?',
                          style: TextStyle(
                            color: AppColors.text,
                            fontSize: 12.5,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ),
                      Text(
                        acik ? '▲' : '▼',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (acik)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  Spacing.md,
                  0,
                  Spacing.md,
                  Spacing.md,
                ),
                child: iz == null
                    ? Text(
                        'Kayıt okunuyor…',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11.5,
                        ),
                      )
                    : _kararIziIcerik(a, iz),
              ),
          ],
        ),
      ),
    );
  }

  Widget _kararIziIcerik(_Aday a, KararIzi iz) {
    final satirlar = <Widget>[];

    // 1) Kullanıcının elindeki kayıt (varsa damga, yoksa kupon seçimi).
    if (a.damga case final d?) {
      satirlar.add(
        _izSatiri(
          'Kupona aktarılan',
          '${tahminYazisi(normalTahmin(d['secim']))} · ${_kisaZaman(d['zaman'])}'
              '${d['kaynak'] == 'radar' ? ' (radar)' : ' (sistem)'}',
        ),
      );
      if (d['analizZamani'] != null) {
        satirlar.add(_izSatiri('Kaynak analiz', _kisaZaman(d['analizZamani'])));
      }
    } else if (a.kupon != null && a.kupon!.isNotEmpty) {
      satirlar.add(
        _izSatiri(
          'Kupon seçimi',
          '${tahminYazisi(a.kupon)} — aktarım damgası yok (eski kupon)',
        ),
      );
    }
    satirlar.add(
      _izSatiri(
        'Mühürlenen (kilit)',
        '${tahminYazisi(a.muhur)} · ${_kisaZaman(_muhur.kilitZamani)}',
      ),
    );

    // 2) Sunucudaki gözlem serisi.
    if (!iz.kayitVar) {
      satirlar.add(const SizedBox(height: 6));
      satirlar.add(
        const Text(
          'Değişiklik nedeni geçmiş kayıtlardan doğrulanamadı.',
          style: TextStyle(
            color: AppColors.warning,
            fontSize: 11.5,
            fontWeight: AppFont.bold,
          ),
        ),
      );
    } else if (iz.degisimler.isEmpty) {
      satirlar.add(const SizedBox(height: 6));
      satirlar.add(
        Text(
          'Kayıtlarda bu maçta sistem tahmini değişmemiş '
          '(${iz.gozlemSayisi} gözlem); fark kupon seçiminden geliyor.',
          style: TextStyle(
            color: AppColors.textSoft,
            fontSize: 11.5,
            height: 1.35,
          ),
        ),
      );
    } else {
      satirlar.add(const SizedBox(height: 8));
      satirlar.add(
        Text(
          'Kayıtlı değişiklikler (${iz.gozlemSayisi} gözlem):',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 11.5,
            fontWeight: AppFont.black,
          ),
        ),
      );
      for (final d in iz.degisimler) {
        satirlar.add(
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${tahminYazisi(d.eski)} → ${tahminYazisi(d.yeni)}'
                  ' · ${_kisaZaman(d.zaman)}',
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 12,
                    fontWeight: AppFont.heavy,
                  ),
                ),
                if (d.eskiOlasilik != null && d.yeniOlasilik != null)
                  Text(
                    'olasılık 1/X/2: ${_uclu(d.eskiOlasilik!)}'
                    ' → ${_uclu(d.yeniOlasilik!)}',
                    style: TextStyle(color: AppColors.textSoft, fontSize: 11),
                  ),
                if (d.eskiOran != null && d.yeniOran != null)
                  Text(
                    'oran ev/ber/dep: ${_ucluOran(d.eskiOran!)}'
                    ' → ${_ucluOran(d.yeniOran!)}',
                    style: TextStyle(color: AppColors.textSoft, fontSize: 11),
                  ),
              ],
            ),
          ),
        );
      }
      satirlar.add(const SizedBox(height: 8));
      // KAYNAK KİMLİĞİ (kullanıcı isteği 2026-08-11): hangi mühür, hangi
      // analiz sürümü, hangi gözlem penceresi. Kayıt sonradan denetlenebilsin.
      satirlar.add(
        _izSatiri(
          'Kaynak',
          [
            ?_muhur.snapshotId,
            if (_muhur.yontemSurumu case final v? when v.isNotEmpty) v,
            if (_muhur.dogrulamaKodu case final h? when h.length >= 10)
              '#${h.substring(0, 10)}',
          ].join(' · '),
        ),
      );
      satirlar.add(
        _izSatiri(
          'Gözlem penceresi',
          '${_kisaZaman(iz.ilkKayit)} → ${_kisaZaman(iz.sonKayit)}',
        ),
      );
      satirlar.add(const SizedBox(height: 6));
      satirlar.add(
        Text(
          'Kriter bazlı öncesi/sonrası kayıtta tutulmuyor; bu yüzden '
          'gösterilmiyor. Yukarıdakiler sunucunun zaman damgalı gözlem '
          'kaydından okundu.',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 10.5,
            fontStyle: FontStyle.italic,
            height: 1.35,
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: satirlar,
    );
  }

  Widget _izSatiri(String baslik, String deger) => Padding(
    padding: const EdgeInsets.only(top: 3),
    child: RichText(
      text: TextSpan(
        style: TextStyle(color: AppColors.textMuted, fontSize: 11.5),
        children: [
          TextSpan(text: '$baslik: '),
          TextSpan(
            text: deger,
            style: TextStyle(color: AppColors.text, fontWeight: AppFont.bold),
          ),
        ],
      ),
    ),
  );

  String _uclu(Map<String, num> m) => '%${m['1']}/%${m['X']}/%${m['2']}';
  String _ucluOran(Map<String, num> m) =>
      '${m['home']}/${m['draw']}/${m['away']}';

  /// '2026-08-07T05:21:20.482+00:00' → '7 Ağu 05:21'. Ayrıştırılamazsa ham
  /// değer bozulmadan gösterilir (uydurma tarih yazılmaz).
  String _kisaZaman(Object? iso) {
    final d = DateTime.tryParse('${iso ?? ''}')?.toLocal();
    if (d == null) return '${iso ?? '—'}';
    const aylar = [
      'Oca',
      'Şub',
      'Mar',
      'Nis',
      'May',
      'Haz',
      'Tem',
      'Ağu',
      'Eyl',
      'Eki',
      'Kas',
      'Ara',
    ];
    String p(int n) => n.toString().padLeft(2, '0');
    return '${d.day} ${aylar[d.month - 1]} ${p(d.hour)}:${p(d.minute)}';
  }

  /// MÜHÜR YOKSA DÜRÜST UYARI (2026-08-11).
  ///
  /// Sistem, kilit öncesi mühürlenmemiş bir maçta "bildim" diyemez. Bu kart
  /// hangi maçların sistem başarısı dışında kaldığını AÇIKÇA söyler; sayıyı
  /// gizlemek, sistemi olduğundan başarılı göstermek olurdu.
  Widget _muhurUyarisi(List<Map> muhursuz) {
    final noSuz = muhursuz.map((m) => '${m['no']}').join(', ');
    final neden = _muhur.muhurVar
        ? (_muhur.gecKilit
              ? 'Bu haftanın mührü ilk maç başladıktan SONRA alınmış; '
                    'kilit öncesi kayıt sayılmaz.'
              : 'Mühürde bu maçlar için sistem seçimi yok.')
        : 'Bu hafta için arşivde kilitli sistem kaydı bulunamadı.';
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.md),
      child: Container(
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
              'Sistem tahmin kaydı doğrulanamadı',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.black,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '$neden ${muhursuz.length} maç (No $noSuz) '
                'karşılaştırmaya katılmadı; bu maçlarda sistem için eşleşme '
                'iddia edilmez.',
                style: TextStyle(
                  color: AppColors.textSoft,
                  fontSize: 11.5,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Seçili haftanın karne kaydı (roundId eşleşmesi) — yoksa null.
  Map? _karneHaftasi() {
    for (final w in ((_karne?['weeks'] as List?) ?? const []).cast<Map>()) {
      if ('${w['roundId']}' == '$_roundId') return w;
    }
    return null;
  }

  /// VS ALANI — YALNIZ AYNI ÖLÇÜ (2026-08-11 kullanıcı isteği).
  ///
  /// Bu alanın tarihçesi bir dizi düzeltmedir: önce sistem tarafında kupon
  /// kapsaması (%93) vardı, sonra tekli ana tahmin (%36) kondu. İkisi de
  /// kullanıcının ÇOKLU kuponuyla kıyaslanamazdı — farklı şeyleri ölçüyorlar.
  ///
  /// Artık iki sütun da AYNI temelden okunur: `recap.head2head`, yani
  /// İKİSİNİN DE doğrulanmış tahmini bulunan ORTAK maçlar. Solda kullanıcının
  /// kuponu, sağda sistemin MÜHÜRLÜ çoklu kuponu. Mühürsüz maç zaten sistem
  /// tarafında tahmin taşımaz, dolayısıyla ortak kümeye ve başarıya girmez.
  ///
  /// Tekli ana tahmin başarısı (5/14 gibi) buradan ÇIKARILDI; ayrı bir satırda
  /// kendi adıyla durur.
  Widget _senVsSistem(WeekRecap recap) {
    final h = recap.head2head;
    final n = h?.matches ?? 0;
    String yuzde(int dogru) =>
        n > 0 ? '%${(dogru * 100 / n).round()} eşleşme' : '—';
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.sm),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: _skorSutunu(
                baslik: _kuponAdi.toUpperCase(),
                deger: h != null ? '${h.user}/$n' : '—',
                alt: h != null ? yuzde(h.user) : 'ortak maç yok',
                onde: false,
                ton: AppColors.success,
              ),
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Center(
                child: Text(
                  'VS',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
            ),
            Expanded(
              child: _skorSutunu(
                baslik: 'SİSTEM · MÜHÜRLÜ SEÇİM',
                deger: h != null ? '${h.system}/$n' : '—',
                alt: h != null ? yuzde(h.system) : 'ortak maç yok',
                onde: false,
                ton: AppColors.info,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Karşılaştırmanın temeli — kaç ortak maç üzerinden konuşuluyor.
  Widget _kiyasTemeli(Head2Head h) => Padding(
    padding: const EdgeInsets.only(bottom: Spacing.md),
    child: Text(
      'Her iki tarafın da doğrulanmış seçimi bulunan ${h.matches} ortak maç '
      'üzerinden; sistem tarafı haftanın mühürlü çoklu seçimidir.',
      style: TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.35),
    ),
  );

  /// TEKLİ ANA TAHMİN — VS alanının DIŞINDA, kendi adıyla.
  /// Kaynak backend karnesidir; karne kaydı yoksa sayı UYDURULMAZ.
  Widget _anaTahminSatiri() {
    final kw = _karneHaftasi();
    final deg = ((kw?['evaluated'] as num?) ?? 0).toInt();
    final acc = kw?['accuracy'];
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.md),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: Spacing.md,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: AppColors.bgAlt,
          borderRadius: AppRadius.mdR,
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                'Sistem ana tahmini · eşleşen maç',
                style: TextStyle(
                  color: AppColors.textSoft,
                  fontSize: 12,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),
            Text(
              deg > 0
                  ? '${kw!['correct']}/$deg · %$acc'
                  : (kw == null ? 'karne kaydı yok' : 'sonuç bekleniyor'),
              style: TextStyle(
                color: AppColors.text,
                fontSize: 12.5,
                fontWeight: AppFont.black,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _skorSutunu({
    required String baslik,
    required String deger,
    required String alt,
    required bool onde,
    required Color ton,
  }) => Container(
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      // Kaynakta `tone + '10'` → rengin %6'sı (0x10/0xFF).
      color: onde ? ton.withValues(alpha: 0x10 / 0xFF) : AppColors.card,
      borderRadius: AppRadius.mdR,
      border: Border.all(
        color: onde ? ton : AppColors.border,
        width: onde ? 2 : 1,
      ),
    ),
    child: Column(
      children: [
        Text(
          baslik,
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 10.5,
            fontWeight: AppFont.black,
            letterSpacing: 1.4,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            deger,
            style: TextStyle(
              color: onde ? ton : AppColors.text,
              fontSize: 28,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            alt,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 11.5,
              fontWeight: AppFont.bold,
            ),
          ),
        ),
        if (onde)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              '▲ önde',
              style: TextStyle(
                color: ton,
                fontSize: 10.5,
                fontWeight: AppFont.black,
              ),
            ),
          ),
      ],
    ),
  );

  /// KULLANICI KUPONU AÇARKEN sistem ne diyordu? Önce kupona AKTARIM DAMGASI
  /// (varsa kesin kayıt), yoksa gözlem serisinden O ANDAKİ değer okunur.
  /// İkisi de yoksa null — tahmin yürütülmez.
  String? _kupondaSistem(int no) {
    final surum = finalVersion(getRankedCoupon(_roundId));
    final damga = aktarimDamgalari(surum)['$no'];
    if (damga != null) {
      final v = normalTahmin(damga['secim']);
      if (v != null) return v;
    }
    final zaman = DateTime.tryParse(
      '${surum?['createdAt'] ?? getRankedCoupon(_roundId)?['createdAt'] ?? ''}',
    );
    return _izler[no]?.zamandakiTahmin(zaman);
  }

  /// KUPONUN ADI — "Sen" hitabı yerine kullanılır. Kupon yoksa genel ad.
  String get _kuponAdi {
    final ad = '${getRankedCoupon(_roundId)?['name'] ?? ''}'.trim();
    return ad.isEmpty ? 'Kupon' : ad;
  }

  /// Maçın seçimi kupona SİSTEMDEN mi aktarılmış? Yalnız aktarım damgası
  /// varsa true; damga yoksa "aktarılmıştır" diye VARSAYILMAZ.
  bool _sistemdenAktarilmis(Object? no) {
    final damga = aktarimDamgalari(finalVersion(getRankedCoupon(_roundId)));
    return damga.containsKey('$no');
  }

  /// Kupon seçimi resmî sonucu SONRADAN değişen sistem tahminiyle mi
  /// kıyaslanıyor? (Kullanıcı kuponu açtığında sistem başka şey diyordu.)
  bool _sistemKupondanSonraDegisti(Object? no) {
    final n = int.tryParse('$no');
    if (n == null) return false;
    final kupondaki = _kupondaSistem(n);
    final muhur = normalTahmin(_muhur.secim(n));
    return kupondaki != null && muhur != null && kupondaki != muhur;
  }

  /// KART BAŞLIĞI — yalnız olguyu söyler, kimseyi suçlamaz.
  ///
  /// Sonuç hiçbir seçimde yoksa bunu doğrudan yazar ("Kuponlarda X seçeneği
  /// bulunmuyordu"); seçim sistemden aktarıldıysa bunu belirtir. Değerler
  /// maçın kendi kaydından gelir, sabit metin yoktur.
  String _anBasligi(RecapHighlight h) {
    final r = h.row;
    final kuponEsledi = r.user?.hit;
    final sistemEsledi = r.system?.hit;
    if (kuponEsledi == false) {
      // ÖNCELİK SIRASI: seçimin NEREDEN geldiği, sonucun hangi seçeneklerde
      // bulunmadığından daha bilgilendiricidir — damga varsa önce o söylenir.
      // Damga yoksa aktarım VARSAYILMAZ.
      if (_sistemdenAktarilmis(r.no)) {
        return 'Sistemden aktarılan seçim resmî sonuçla eşleşmedi';
      }
      if (sistemEsledi == false) {
        return 'Kuponlarda ${r.actual} seçeneği bulunmuyordu';
      }
      return 'Kupon seçimi resmî sonuçla eşleşmedi';
    }
    if (kuponEsledi == null && sistemEsledi == false) {
      return 'Sistem seçimi resmî sonuçla eşleşmedi';
    }
    return 'Kupon seçimi resmî sonuçla eşleşti';
  }

  Widget _anKarti(RecapHighlight h) {
    final r = h.row;
    // KÖŞE + RENKLİ SOL ŞERİT: Flutter'da `borderRadius` YALNIZ tek renkli
    // kenarlıkla boyanır ("A borderRadius can only be given on borders with
    // uniform colors"); yuvarlatmayı ClipRRect yapar, kenarlık düz kalır.
    //
    // ŞERİT RENGİ NÖTR: eskiden eşleşmeyen maç KIRMIZI, eşleşen YEŞİL şeritle
    // çiziliyordu. Kırmızı bir "hata/suç" tonu taşıdığı için bu ekranın yeni
    // dil standardında kullanılmıyor; kart bilgi verir, not vermez.
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.sm),
      child: ClipRRect(
        borderRadius: AppRadius.mdR,
        child: Container(
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: AppColors.card,
            border: Border(
              top: BorderSide(color: AppColors.border),
              right: BorderSide(color: AppColors.border),
              bottom: BorderSide(color: AppColors.border),
              left: BorderSide(color: AppColors.muted, width: 4),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _anBasligi(h),
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 12.5,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ),
                  Text(
                    '#${r.no}',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Text(
                  '${r.home} — ${r.away}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 14,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
              // TEK SATIR, SABİT SIRA: resmî sonuç → kupon seçimi → sistem
              // seçimi. Değerlerin hepsi maç kaydından gelir.
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    _cip(
                      'Resmî sonuç: ',
                      '${r.actual}',
                      r.score == null ? '' : ' (${r.score})',
                    ),
                    if (r.user case final u?)
                      _cip('Kupon seçimi: ', u.pick, ''),
                    if (r.system case final sy?)
                      _cip('Sistem seçimi: ', sy.pick, ''),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _cip(String on, String kalin, String son) => RichText(
    text: TextSpan(
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 11.5,
        fontWeight: AppFont.bold,
      ),
      children: [
        TextSpan(text: on),
        TextSpan(
          text: kalin,
          style: TextStyle(color: AppColors.text, fontWeight: AppFont.black),
        ),
        TextSpan(text: son),
      ],
    ),
  );

  Widget _tablo(WeekRecap recap) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.symmetric(horizontal: Spacing.md, vertical: 4),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.mdR,
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      children: [
        _satir(const [
          (w: 24.0, t: '#', c: null, b: false),
          (w: null, t: 'Maç', c: null, b: false),
          (w: 40.0, t: 'Sonuç', c: null, b: false),
          (w: 52.0, t: 'Kupon', c: null, b: false),
          (w: 52.0, t: 'Sistem', c: null, b: false),
        ], baslik: true),
        for (final r in recap.rows)
          _satir([
            (w: 24.0, t: '${r.no}', c: AppColors.textMuted, b: false),
            (w: null, t: '${r.home} — ${r.away}', c: null, b: false),
            (w: 40.0, t: '${r.actual}', c: null, b: true),
            (
              w: 52.0,
              t: r.user != null
                  ? '${r.user!.pick} ${r.user!.hit ? '✅' : '❌'}'
                  : '—',
              c: _hucreRengi(r.user),
              b: r.user != null,
            ),
            (
              w: 52.0,
              t: r.system != null
                  ? '${r.system!.pick} ${r.system!.hit ? '✅' : '❌'}'
                  : '—',
              c: _hucreRengi(r.system),
              b: r.system != null,
            ),
          ]),
      ],
    ),
  );

  static Color _hucreRengi(RecapCell? cell) {
    if (cell == null) return AppColors.textMuted;
    return cell.hit ? AppColors.success : AppColors.danger;
  }

  Widget _satir(
    List<({double? w, String t, Color? c, bool b})> hucreler, {
    bool baslik = false,
  }) => Container(
    padding: const EdgeInsets.symmetric(vertical: 8),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      children: [
        for (var i = 0; i < hucreler.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Builder(
            builder: (_) {
              final h = hucreler[i];
              final metin = Text(
                h.t,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: h.w != null && i > 1
                    ? TextAlign.center
                    : TextAlign.left,
                style: TextStyle(
                  color: h.c ?? (baslik ? AppColors.textMuted : AppColors.text),
                  fontSize: baslik ? 10 : 12,
                  fontWeight: baslik
                      ? AppFont.black
                      : (h.b ? AppFont.heavy : AppFont.bold),
                  letterSpacing: baslik ? 0.5 : null,
                ),
              );
              return h.w == null
                  ? Expanded(child: metin)
                  : SizedBox(width: h.w, child: metin);
            },
          ),
        ],
      ],
    ),
  );

  Widget _bosKart({
    String? icon,
    required String baslik,
    required String metin,
  }) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.lg),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.mdR,
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      children: [
        if (icon != null) Text(icon, style: const TextStyle(fontSize: 30)),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            baslik,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.text,
              fontSize: 14.5,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 5),
          child: Text(
            metin,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
              fontWeight: AppFont.semibold,
              height: 17 / 12,
            ),
          ),
        ),
      ],
    ),
  );
}

class _BolumBasligi extends StatelessWidget {
  const _BolumBasligi(this.metin);

  final String metin;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
    child: Text(
      metin,
      style: TextStyle(
        color: AppColors.text,
        fontSize: 15,
        fontWeight: AppFont.black,
      ),
    ),
  );
}
