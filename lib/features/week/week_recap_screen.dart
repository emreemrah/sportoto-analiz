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
import '../../core/theme/tokens.dart';
import '../../core/week_recap.dart';
import '../../widgets/states.dart';

const Map<String, ({String icon, String title, Color color})> _hl = {
  'user-win': (
    icon: '🔥',
    title: 'Sen bildin, sistem bilemedi',
    color: AppColors.success,
  ),
  // Düello başlıkları KUPON bazlıdır (tek ölçü kararı, 2026-08-11):
  // 'kuponu' sözcüğü, karnedeki tekli ana tahminle karışmasın diye açık.
  'system-win': (
    icon: '🤖',
    title: 'Sistem kuponu bildi, sen bilemedin',
    color: AppColors.info,
  ),
  'both-missed': (
    icon: '💥',
    title: 'İkiniz de bilemediniz',
    color: AppColors.danger,
  ),
  'system-missed': (
    icon: '💥',
    title: 'Sistem kuponu ıskaladı',
    color: AppColors.danger,
  ),
};

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
    setState(() => _hist = null);
    try {
      final h = (await api.history(rid) as Map).cast<String, dynamic>();
      // BAYAT YANIT KORUMASI: istek uçarken kullanıcı başka haftaya geçmiş
      // olabilir; geç gelen yanıt yeni haftanın verisini EZMEZ.
      if (mounted && _roundId == rid) setState(() => _hist = h);
    } catch (_) {
      if (mounted && _roundId == rid) setState(() => _hist = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _rounds == null) {
      return _kabuk(
        const LoadingState(message: 'Hafta kapanışı hazırlanıyor…'),
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
    final recap = buildWeekRecap(
      matches: (_hist?['matches'] as List?) ?? const [],
      selections: (v?['selections'] as List?) ?? const [],
    );

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
            const Padding(
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
            if (recap.head2head case final h?) _h2hKart(h),
            if (recap.highlights.isNotEmpty) ...[
              const _BolumBasligi('Haftanın Anları'),
              for (final h in recap.highlights) _anKarti(h),
            ] else
              _bosKart(
                baslik: 'Ayrışan maç yok',
                metin:
                    'Bu hafta sen ve sistem aynı maçlarda aynı yönde kaldınız.',
              ),
            const _BolumBasligi('Tüm Resmî Sonuçlar'),
            _tablo(recap),
          ],
          const Padding(
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
                child: const Text(
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
    backgroundColor: AppColors.bg,
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
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 16,
                  fontWeight: AppFont.black,
                ),
              ),
              Text(
                '${selMeta?['year'] ?? ''} Sezonu',
                style: const TextStyle(
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
                style: const TextStyle(
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
    final u = recap.user;
    final kw = _karneHaftasi();
    final deg = ((kw?['evaluated'] as num?) ?? 0).toInt();
    final sys = deg > 0 ? 'sistem ana tahmini ${kw!['correct']}/$deg' : null;
    if (u != null && sys != null) {
      return '$scope — sen ${u.correct}/${u.made} · $sys.';
    }
    if (u != null) return '$scope — kuponunda ${u.correct}/${u.made} isabet.';
    if (sys != null) return '$scope — $sys; bu hafta kayıtlı kuponun yok.';
    return '$scope — değerlendirilecek tahmin yok.';
  }

  Widget _studyoKarti(WeekRecap recap) {
    final o = recap.official;
    final oran = o.total > 0 ? o.resolved / o.total : 0.0;
    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFF132244),
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
              style: const TextStyle(
                color: AppColors.white,
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
              style: const TextStyle(
                color: Color(0xFFB9C6DC),
                fontSize: 10.5,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
        ],
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

  Widget _senVsSistem(WeekRecap recap) {
    final u = recap.user;
    // TEK ÖLÇÜ (2026-08-11): SİSTEM sütunu karneden okunur (tekli ana
    // tahmin) — kupon kapsaması yüzdesi (%93 tarzı) burada GÖSTERİLMEZ.
    //
    // 'ÖNDE' ROZETİ KALDIRILDI (2026-08-11, emülatörde yakalandı): iki sütun
    // artık AYNI ŞEYİ ölçmüyor — solda kullanıcının çoklu seçimli KUPONU,
    // sağda sistemin TEKLİ ana tahmini. Yüzdeleri kıyaslamak kullanıcıyı
    // "%86 ile öndesin" diye ödüllendirirken hemen altındaki adil
    // karşılaştırma "13 maçta sen 11, sistem 12" diyordu — ekranın kendi
    // dürüstlük kuralına aykırı (dosya başlığı: karşılaştırma yalnız
    // ikisinin de tahmin yaptığı maçlarda yapılır). Kıyas artık YALNIZ
    // h2h kartında, kupon-kupona yapılır.
    final kw = _karneHaftasi();
    final deg = ((kw?['evaluated'] as num?) ?? 0).toInt();
    final sysAcc = deg > 0 ? (kw?['accuracy'] as num?) : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.md),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: _skorSutunu(
                baslik: 'SEN · Kupon',
                deger: u != null ? '${u.correct}/${u.made}' : '—',
                alt: u != null ? '%${u.accuracy} isabet' : 'kupon yok',
                onde: false,
                ton: AppColors.success,
              ),
            ),
            const Padding(
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
                baslik: 'SİSTEM · Ana tahmin',
                deger: deg > 0 ? '${kw!['correct']}/$deg' : '—',
                alt: deg > 0
                    ? '%$sysAcc isabet'
                    : (kw == null ? 'karne kaydı yok' : 'sonuç bekleniyor'),
                onde: false,
                ton: AppColors.info,
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
          style: const TextStyle(
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
            style: const TextStyle(
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

  Widget _h2hKart(Head2Head h) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.surfaceSoft,
      borderRadius: AppRadius.mdR,
    ),
    child: RichText(
      text: TextSpan(
        style: const TextStyle(
          color: AppColors.textSoft,
          fontSize: 12.5,
          fontWeight: AppFont.bold,
          height: 19 / 12.5,
        ),
        children: [
          const TextSpan(
            text: 'Adil karşılaştırma: ikinizin de tahmin yaptığı ',
          ),
          TextSpan(
            text: '${h.matches}',
            style: const TextStyle(
              color: AppColors.text,
              fontWeight: AppFont.black,
            ),
          ),
          const TextSpan(text: ' maçta sen '),
          TextSpan(
            text: '${h.user}',
            style: const TextStyle(
              color: AppColors.success,
              fontWeight: AppFont.black,
            ),
          ),
          const TextSpan(text: ', sistem '),
          TextSpan(
            text: '${h.system}',
            style: const TextStyle(
              color: AppColors.info,
              fontWeight: AppFont.black,
            ),
          ),
          const TextSpan(text: ' isabet.'),
        ],
      ),
    ),
  );

  Widget _anKarti(RecapHighlight h) {
    final meta = _hl[h.kind]!;
    final r = h.row;
    // KÖŞE + RENKLİ SOL ŞERİT: Flutter'da `borderRadius` YALNIZ tek renkli
    // kenarlıkla boyanır ("A borderRadius can only be given on borders with
    // uniform colors"). Eski hâl ikisini birlikte veriyordu; boyama iptal
    // oluyor ve kart EKRANDA BOMBOŞ çıkıyordu (2026-08-11 emülatörde
    // görüldü: "Haftanın Anları" başlığının altında beyaz boş kart).
    // Çözüm: yuvarlatmayı ClipRRect yapar, kenarlık düz kalır — kaynaktaki
    // görünüm (yuvarlak kart + 4px renkli sol şerit) korunur.
    return Padding(
      padding: const EdgeInsets.only(bottom: Spacing.sm),
      child: ClipRRect(
        borderRadius: AppRadius.mdR,
        child: Container(
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: AppColors.card,
            border: Border(
              top: const BorderSide(color: AppColors.border),
              right: const BorderSide(color: AppColors.border),
              bottom: const BorderSide(color: AppColors.border),
              left: BorderSide(color: meta.color, width: 4),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(meta.icon, style: const TextStyle(fontSize: 14)),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      meta.title,
                      style: TextStyle(
                        color: meta.color,
                        fontSize: 12.5,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  ),
                  Text(
                    '#${r.no}',
                    style: const TextStyle(
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
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 14,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    _cip('Sonuç ', '${r.actual}', ' (${r.score})'),
                    if (r.user case final u?) _cip('Sen ', u.pick, ''),
                    if (r.system case final s?)
                      _cip('Sistem kuponu ', s.pick, ''),
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
      style: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 11.5,
        fontWeight: AppFont.bold,
      ),
      children: [
        TextSpan(text: on),
        TextSpan(
          text: kalin,
          style: const TextStyle(
            color: AppColors.text,
            fontWeight: AppFont.black,
          ),
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
          (w: 52.0, t: 'Sen', c: null, b: false),
          (w: 52.0, t: 'S. kupon', c: null, b: false),
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
    decoration: const BoxDecoration(
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
            style: const TextStyle(
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
            style: const TextStyle(
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
      style: const TextStyle(
        color: AppColors.text,
        fontSize: 15,
        fontWeight: AppFont.black,
      ),
    ),
  );
}
