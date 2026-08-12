// KAYNAK: app/src/screens/CouponShareScreen.js — BİREBİR çeviri.
//
// KUPON PAYLAŞIMI — kaydedilen kupon PNG olarak paylaşılır.
//
// GÖRÜNÜM: paylaşılan kare elle çizilen bir tuval DEĞİL, yayın stüdyosunun
// RESMÎ BÜLTEN TABLOSUDUR — sıra no · ev arması · takım adları · konuk arması ·
// 1-0-2 kutuları. Tablo parçaları coupon_studio_parts.dart'tan gelir.
//
// NEDEN TUVAL BIRAKILDI: elle çizilen tuvale kulüp armaları hiç giremiyordu.
// Ekranın kendisinin karesi alınınca armalar da kareye giriyor.
//
// GÜVENLİK/DÜRÜSTLÜK KURALLARI (kesin):
// • Görselde HESAP BİLGİSİ, telefon, e-posta, belirteç veya hassas veri YOKTUR —
//   yalnız uygulama adı, sezon/hafta, seçimler, kolon (+istenirse tutar).
//   Kupon adı ve kupon numarası da kareye GİRMEZ, dosya adına da yazılmaz.
// • "Kesin sonuç veya kazanç vaadi değildir." açıklaması her görselde vardır;
//   metin brand.dart'tan gelir, elle yazılamaz ve silinemez.
// • Kilitli tahmin YALNIZ kullanıcı beyanıysa "kullanıcı beyanı, bağımsız
//   olarak doğrulanmamıştır" diye açık yazılır — hiçbir dış doğrulama
//   entegrasyonu yoktur, asla "doğrulandı" gibi gösterilmez.
// • İPTAL HATA DEĞİLDİR: kullanıcı paylaşım menüsünü kapatınca kırmızı hata
//   basılmaz.
//
// KARE ALMA: kaynakta `react-native-view-shot`; Flutter'da karşılığı
// `RepaintBoundary.toImage()` — gerçek çizim katmanından alınır, bu yüzden
// yazı tipi ve yüklenmiş armalar kareye OLDUĞU GİBİ girer.

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/brand.dart';
import '../../core/coupon/coupon_config.dart';
import '../../core/coupon/coupon_store.dart';
import '../../core/network/api_client.dart';
import '../../core/services/studio_share.dart';
import '../../core/theme/studio_fonts.dart';
import '../../core/theme/studio_theme.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/states.dart';
import 'coupon_studio_parts.dart';

// KART: içerik kadar yüksek, ekran genişliğine uyar (sohbet/mesaj paylaşımı).
const double _kartMax = 720;

class CouponShareScreen extends StatefulWidget {
  const CouponShareScreen({
    super.key,
    required this.couponId,
    required this.roundId,
    this.roundName,
    this.season,
  });

  final String couponId;
  final Object? roundId;
  final String? roundName;
  final String? season;

  @override
  State<CouponShareScreen> createState() => _CouponShareScreenState();
}

class _CouponShareScreenState extends State<CouponShareScreen> {
  final _kareKey = GlobalKey();

  Map<String, dynamic>? _hist;
  Map<String, dynamic>? _bulten;
  Map? _pricing;
  String? _error;
  bool _loading = true;
  bool _showCost = false;
  bool _busy = false;
  String _done = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final h = await api.history(widget.roundId!);
      if (!mounted) return;
      setState(() => _hist = (h as Map).cast<String, dynamic>());

      // Güncel bülten iki iş görür: birim bedel kaydı (uydurulmaz) ve hafta
      // arşive düşmemişse maç/arma kaynağı.
      try {
        final b = await api.bulletin() as Map?;
        if (!mounted) return;
        setState(() {
          _bulten = b?.cast<String, dynamic>();
          final p = b?['couponPricing'];
          _pricing = validPricing(p as Map?) ? p as Map : null;
        });
      } catch (_) {
        if (mounted) {
          setState(() {
            _bulten = null;
            _pricing = null;
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = kuponOlcek(context);

    if (_loading && _hist == null) {
      return _kabuk(LoadingState(message: 'Kupon hazırlanıyor…'));
    }
    if (_error != null) {
      return _kabuk(
        SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: ErrorState(message: _error, onRetry: _load),
        ),
      );
    }

    final coupon = getCoupon(widget.couponId);
    if (coupon == null) {
      return _kabuk(
        SingleChildScrollView(
          padding: EdgeInsets.all(12),
          child: EmptyState(
            icon: Icons.confirmation_number_outlined,
            title: 'Kupon bulunamadı',
            message: 'Paylaşılacak kupon yok.',
          ),
        ),
      );
    }
    final v = finalVersion(coupon);
    if (v == null) {
      return _kabuk(
        SingleChildScrollView(
          padding: EdgeInsets.all(12),
          child: EmptyState(
            icon: Icons.confirmation_number_outlined,
            title: 'Kupon boş',
            message: 'Bu kuponun kayıtlı seçimi yok.',
          ),
        ),
      );
    }

    // Maç satırının GÖRSEL kaynağı: hafta arşive düştüyse arşiv, düşmediyse
    // güncel bülten. İkisi de yoksa satır çizilir ama takım adı yerine "—"
    // durur (uydurma ad ya da "benzeri" arma ASLA konmaz).
    final arsiv = (_hist?['matches'] as List?) ?? const [];
    final macKaynak = arsiv.isNotEmpty
        ? arsiv
        : ((_bulten?['matches'] as List?) ?? const []);
    final macByNo = <Object, Map>{
      for (final m in macKaynak)
        if ((m as Map)['no'] != null) m['no'] as Object: m,
    };

    final seasonTxt = widget.season != null ? '${widget.season} Sezonu' : '';
    // İç kayıt numarası ("Hafta 1527") görsele YAZILMAZ (hata düzeltmesi,
    // 2026-08-06) — resmî ad yoksa hafta numarası, o da yoksa boş kalır.
    final headSubParcalar = [
      if (seasonTxt.isNotEmpty) seasonTxt,
      if (widget.roundName != null && widget.roundName!.isNotEmpty)
        widget.roundName!,
    ];
    final headSub = headSubParcalar.isNotEmpty
        ? headSubParcalar.join(' · ')
        : (_hist?['weekNumber'] != null
              ? '${_hist!['weekNumber']}. Hafta'
              : '');

    final playedLine = coupon['playedMarkedAt'] != null
        ? 'Tahmin kilitlendi — kullanıcı beyanı, bağımsız olarak doğrulanmamıştır'
        : null;
    final kolon = v['columnCount'];
    final tutar = _showCost
        ? costOf(kolon is num ? kolon.toInt() : null, _pricing)
        : null;

    final altSatirlar = <String>[
      'Kolon: $kolon${tutar != null ? ' · Tutar: $tutar TL' : ''}',
      ?playedLine,
    ];

    return _kabuk(
      SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(SP.lg, SP.lg, SP.lg, SP.xl * 2),
        child: Column(
          children: [
            // Önizleme = paylaşılacak görselin BİREBİR kendisi (aynı düğüm).
            _kare(o, v, macByNo, headSub, altSatirlar),
            const SizedBox(height: SP.md),
            _tutarSatiri(o),
            const SizedBox(height: SP.md),
            Dugme(
              text: _busy ? 'Görsel hazırlanıyor…' : 'Kupon görselini paylaş',
              onTap: _paylas,
              disabled: _busy,
              ana: true,
              k: o.k,
            ),
            if (_done.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: SP.md),
                child: Text(
                  _done,
                  textAlign: TextAlign.center,
                  style: studioFont(
                    600,
                  ).copyWith(color: S.ink, fontSize: o.t.kucuk),
                ),
              ),
            // Hızlı paylaş (WhatsApp/Telegram metin düğmeleri) eklendi ve aynı
            // gün kullanıcı isteğiyle kaldırıldı (2026-08-06) — ana paylaşım
            // düğmesi görselle birlikte tüm uygulamalara zaten ulaşıyor.
            const SizedBox(height: SP.md),
            Not(
              k: o.k,
              text:
                  'Görselde hesap bilgisi, e-posta veya kişisel veri BULUNMAZ — yalnız sezon/hafta, seçimler ve kolon bilgisi. '
                  'İşaretler resmî yazımla gösterilir (1 - 0 - 2; "0" beraberlik). '
                  'Kupon hatası olursa görsel yerelden yeniden üretilir; kupon kaybolmaz.',
            ),
          ],
        ),
      ),
    );
  }

  Widget _kabuk(Widget govde) => Scaffold(
    backgroundColor: S.bg,
    appBar: AppBar(
      title: const Text('Kupon Paylaş'),
      backgroundColor: S.panel,
      foregroundColor: S.ink,
    ),
    body: govde,
  );

  /* ————— PAYLAŞILAN KARE —————
     Kadraj: yalnız RepaintBoundary içi. Tutar anahtarı ve paylaşım düğmesi
     kadrajın DIŞINDA kalır — görselde arayüz izi olmaz. */
  Widget _kare(
    KuponOlcek o,
    Map v,
    Map<Object, Map> macByNo,
    String headSub,
    List<String> altSatirlar,
  ) {
    // Dar ekranda kutular da dar çizilir; aksi hâlde sağ sütun taşar ve
    // işaretler kırpılır.
    final kompakt = o.dar;
    final sagGenislik = kompakt ? 104.0 : 122.0;
    final secimler = (v['selections'] as List?) ?? const [];

    return RepaintBoundary(
      key: _kareKey,
      child: Container(
        constraints: const BoxConstraints(maxWidth: _kartMax),
        color: S.bg,
        padding: const EdgeInsets.all(SP.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      kAppNameUpper,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: studioFont(700).copyWith(
                        color: S.ink,
                        fontSize: o.t.kucuk,
                        letterSpacing: kEtiketLetterSpacing,
                      ),
                    ),
                  ),
                  const Spacer(),
                  // paddingRight: tek satıra sıkışan metin kare alınırken bir
                  // tık farklı ölçülüp son harfi kırpılabiliyor; birkaç piksel
                  // pay bunu önler.
                  Padding(
                    padding: const EdgeInsets.only(right: 3),
                    child: Text(
                      headSub,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: studioFont(600).copyWith(
                        color: S.inkSoft,
                        fontSize: o.t.kucuk,
                        fontFeatures: kTabular,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SP.xs),
            Tablo(
              children: [
                Thead(
                  k: o.k,
                  children: [
                    Th(
                      text: 'SIRA',
                      k: o.k,
                      width: (32 * o.k).roundToDouble(),
                      padX: 5,
                      center: true,
                    ),
                    Th(text: 'EV SAHİBİ - KONUK TAKIM', k: o.k, esnek: true),
                    Th(
                      text: '1 - 0 - 2',
                      tam: 'Kupondaki işaret',
                      k: o.k,
                      width: (sagGenislik * o.k).roundToDouble(),
                      center: true,
                    ),
                  ],
                ),
                for (var i = 0; i < secimler.length; i++)
                  _satir(
                    o,
                    secimler[i] as Map,
                    i,
                    macByNo,
                    sagGenislik,
                    kompakt,
                  ),
                Tfoot(k: o.k, text: altSatirlar.join('\n')),
              ],
            ),
            const SizedBox(height: SP.xs),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Text(
                '$kLegalFooter · Yalnız resmî Spor Toto sonucu kesindir. '
                'Seçimler kullanıcının kendi kararıdır.',
                style: studioFont(400).copyWith(
                  color: S.inkDim,
                  fontSize: o.t.mikro,
                  height: 13 / o.t.mikro,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _satir(
    KuponOlcek o,
    Map sc,
    int i,
    Map<Object, Map> macByNo,
    double sagGenislik,
    bool kompakt,
  ) {
    final m = macByNo[sc['no']];
    final secimler = ((sc['selectedOutcomes'] as List?) ?? const [])
        .cast<String>();
    return MacSatiri(
      k: o.k,
      zebra: i % 2 == 1,
      // `secili` KASITLI OLARAK VERİLMEZ: kupondaki her satır zaten
      // işaretlidir, hepsini turuncuya boyamak hiçbir satırı ayırmaz — yalnız
      // zebrayı yutup tabloyu soluk somon bir bloğa çevirirdi. Hangi işaretin
      // basıldığını sağdaki kutular gösterir.
      sira: sc['no'] ?? '',
      home:
          (m?['home'] as Map?)?['mediumName'] as String? ??
          (m?['home'] as Map?)?['name'] as String?,
      away:
          (m?['away'] as Map?)?['mediumName'] as String? ??
          (m?['away'] as Map?)?['name'] as String?,
      homeLogo: (m?['home'] as Map?)?['logo'] as String?,
      awayLogo: (m?['away'] as Map?)?['logo'] as String?,
      // `salt` — `disabled` DEĞİL. Kare zaten dokunulamaz; `disabled` kutuları
      // %42 saydam çizip paylaşılan görseli soluk yapıyordu.
      sag: PickBoxes(outcomes: secimler, salt: true, k: o.k, compact: kompakt),
      sagGenislik: sagGenislik,
    );
  }

  Widget _tutarSatiri(KuponOlcek o) => Row(
    children: [
      Expanded(
        child: Text(
          _pricing != null
              ? 'Tutarı görselde göster'
              : 'Tutar gösterilemez — birim bedel verisi yok',
          style: studioFont(
            600,
          ).copyWith(color: S.inkSoft, fontSize: o.t.kucuk),
        ),
      ),
      const SizedBox(width: SP.sm),
      _anahtar(
        o,
        _showCost,
        _showCost ? 'AÇIK' : 'KAPALI',
        // Birim bedel verisi yoksa anahtar HİÇBİR ŞEY yapmaz: tutar
        // uydurulmaz.
        _pricing != null ? () => setState(() => _showCost = !_showCost) : null,
      ),
    ],
  );

  Widget _anahtar(
    KuponOlcek o,
    bool acik,
    String etiket,
    VoidCallback? onTap,
  ) => Semantics(
    button: true,
    selected: acik,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: acik ? S.accentSoft : S.panel,
          border: Border.all(
            color: acik ? S.accent : S.line,
            width: TABLE.hair,
          ),
          borderRadius: BorderRadius.circular(R.sm),
        ),
        child: Text(
          etiket,
          style: studioFont(600).copyWith(
            color: acik ? S.accent : S.inkSoft,
            fontSize: o.t.mikro,
            letterSpacing: kEtiketLetterSpacing,
          ),
        ),
      ),
    ),
  );

  Future<void> _paylas() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _done = '';
    });
    try {
      final png = await _kareyiAl();
      if (png == null) throw Exception('Görsel üretilemedi.');

      final dosyaAdi = couponShareFileNameOf(
        roundId: widget.roundId,
        weekNumber: _hist?['weekNumber'],
      );
      final yazi = couponShareCaptionOf(
        roundName: widget.roundName,
        weekNumber: _hist?['weekNumber'],
        columnCount: finalVersion(getCoupon(widget.couponId))?['columnCount'],
      );

      // Geçici dosya: paylaşım hedefi bayt dizisini değil DOSYAYI okur.
      final dizin = await getTemporaryDirectory();
      final dosya = File('${dizin.path}/$dosyaAdi');
      await dosya.writeAsBytes(png);

      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(dosya.path, mimeType: kShareMime)],
          text: yazi,
          subject: couponShareTitleOf(
            roundName: widget.roundName,
            weekNumber: _hist?['weekNumber'],
          ),
        ),
      );
      if (mounted) setState(() => _done = shareDoneTextOf('shared'));
    } catch (e) {
      // Kullanıcı menüyü kapattıysa bu bir hata DEĞİLDİR; ekran sessiz kalır.
      if (mounted) {
        setState(() => _done = isAbortError(e) ? '' : shareErrorTextOf(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// RepaintBoundary → PNG baytları. 2× piksel oranı: kare sohbet/hikâye
  /// boyutlarında bulanık çıkmasın.
  Future<Uint8List?> _kareyiAl() async {
    final ctx = _kareKey.currentContext;
    if (ctx == null) return null;
    final boundary = ctx.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) return null;
    final img = await boundary.toImage(pixelRatio: 2);
    final data = await img.toByteData(format: ui.ImageByteFormat.png);
    return data?.buffer.asUint8List();
  }
}
