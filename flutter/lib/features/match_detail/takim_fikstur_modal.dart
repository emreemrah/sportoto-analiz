// KAYNAK: app/src/components/TakimFiksturModal.js — BİREBİR çeviri.
//
// TAKIM FİKSTÜRÜ — oynadığı ve oynayacağı maçlar.
// Maç detayında takım adının altındaki bağlantıdan açılır. Eskiden burada
// sezon istatistikleri vardı; kullanıcı kararıyla fikstüre çevrildi.
//
// TASARIM KARARI — tek liste, tarih sırası, "sıradaki" çizgisi:
// Oynanmış ve oynanacak maçlar AYRI sekmelere bölünmedi. Bir takımın gidişatı
// okunurken en çok işe yarayan şey, biten maçların hemen ardından sıradaki
// maçı görmek. Ayırmak, kullanıcıyı iki liste arasında gidip gelmeye zorlardı.
// Bunun yerine oynanmışlar ile oynanacaklar arasına "SIRADAKİ" ayracı konur ve
// liste ilk açılışta oraya kaydırılır.
//
// SONUÇ HARFİ YALNIZ BİTMİŞ MAÇTA: G/B/M rozeti oynanmamış maça basılmaz,
// skor yoksa yazılmaz. Sunucu da aynı kuralı uygular (takimFikstur.js).

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../core/network/api_client.dart';
import '../../core/takim_fikstur.dart';
import '../../core/theme/takim_paleti.dart' show okunurMetin;
import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';

const Map<String, Color> _sonucRengi = {
  'G': AppColors.green,
  'B': AppColors.yellow,
  'M': AppColors.red,
};

/// Modalı açan tek giriş noktası. Kaynakta `visible` bayrağıyla çizilen
/// `<Modal animationType="slide">` karşılığı: alttan kayan sayfa.
Future<void> takimFiksturuAc(
  BuildContext context, {
  required Object? teamId,
  required Object? seasonId,
  String? name,
  String? logo,
  String? league,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    // Kaynaktaki yarı saydam siyah zemin (rgba(0,0,0,0.45)).
    barrierColor: const Color(0x73000000),
    builder: (_) => TakimFiksturSayfasi(
      teamId: teamId,
      seasonId: seasonId,
      name: name,
      logo: logo,
      league: league,
    ),
  );
}

class TakimFiksturSayfasi extends StatefulWidget {
  const TakimFiksturSayfasi({
    super.key,
    this.teamId,
    this.seasonId,
    this.name,
    this.logo,
    this.league,
  });

  final Object? teamId;
  final Object? seasonId;
  final String? name;
  final String? logo;
  final String? league;

  @override
  State<TakimFiksturSayfasi> createState() => _TakimFiksturSayfasiState();
}

class _TakimFiksturSayfasiState extends State<TakimFiksturSayfasi> {
  Map? _veri;
  String? _hata;
  bool _yukleniyor = false;

  final ScrollController _kaydirma = ScrollController();
  final GlobalKey _ayracKey = GlobalKey();
  bool _kaydirildi = false;

  @override
  void initState() {
    super.initState();
    // Kimlik yoksa istek HİÇ atılmaz — kaynakta da `if (!teamId || !seasonId)`.
    if (widget.teamId == null || widget.seasonId == null) return;
    _yukleniyor = true;
    _getir();
  }

  Future<void> _getir() async {
    try {
      final r = await api.teamFixtures(widget.teamId!, widget.seasonId!);
      if (!mounted) return;
      setState(() {
        _veri = r as Map?;
        _yukleniyor = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        // Kaynakta `e.message` basılıyordu; API katmanı hatayı zaten
        // kullanıcıya okunur metinle fırlatıyor.
        _hata = '$e';
        _yukleniyor = false;
      });
    }
  }

  @override
  void dispose() {
    _kaydirma.dispose();
    super.dispose();
  }

  /// Sıradaki maçı görünür yapar: kullanıcı fikstürü açtığında sezonun
  /// başındaki eski maçlara değil, buraya bakmak ister.
  ///
  /// Kaynakta `onContentSizeChange` içinde `scrollTo({ y: ayracY - 60 })`
  /// vardı; burada aynı hesap ilk kare çizildikten sonra yapılır.
  void _ayraciGoster() {
    if (_kaydirildi) return;
    final ctx = _ayracKey.currentContext;
    if (ctx == null) return;
    final box = ctx.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return;
    if (!_kaydirma.hasClients) return;
    final y = RenderAbstractViewport.of(box).getOffsetToReveal(box, 0).offset;
    _kaydirildi = true;
    _kaydirma.jumpTo(
      math.max(0.0, y - 60).clamp(0.0, _kaydirma.position.maxScrollExtent),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fikstur = (_veri?['fikstur'] as List?) ?? const [];
    final ilkGelecek = ilkGelecekIndex(fikstur);
    final ligler = fiksturLigleri(fikstur);

    return Padding(
      // Kaynakta `justifyContent: 'flex-end'` — sayfa ekranın altına yaslanır.
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
      child: Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.86,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _baslik(),
                Flexible(child: _icerik(fikstur, ilkGelecek, ligler)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _baslik() {
    final oynanan = _veri?['oynanan'];
    final toplam = _veri?['toplam'];
    return Container(
      padding: const EdgeInsets.all(Spacing.lg),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Logo(uri: widget.logo, name: widget.name, size: 40),
          const SizedBox(width: Spacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_veri?['takimAdi'] ?? widget.name ?? '—'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 16,
                    fontWeight: AppFont.black,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    '${widget.league ?? ''}'
                    '${_veri != null ? ' · $oynanan/$toplam maç oynandı' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11.5,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: Spacing.sm),
          Semantics(
            button: true,
            label: 'Kapat',
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).maybePop(),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                child: Text(
                  '✕',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 18,
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

  Widget _icerik(List fikstur, int ilkGelecek, List<String> ligler) {
    if (_yukleniyor) {
      return Padding(
        padding: EdgeInsets.all(Spacing.xl),
        child: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }
    if (_hata != null) {
      // Hata GİZLENMEZ. "Maçı yok" ile "veri alınamadı" farklı şeyler.
      return Padding(
        padding: const EdgeInsets.all(Spacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Fikstür alınamadı',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 14,
                fontWeight: AppFont.black,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _hata!,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
            ),
          ],
        ),
      );
    }
    if (fikstur.isEmpty) {
      return Padding(
        padding: EdgeInsets.all(Spacing.xl),
        child: Text(
          'Bu takım için sezon maçı bulunamadı.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
        ),
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) => _ayraciGoster());

    return SingleChildScrollView(
      controller: _kaydirma,
      padding: const EdgeInsets.only(bottom: Spacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < fikstur.length; i++) ...[
            if (i == ilkGelecek) _ayrac(),
            _SatirMac(f: fikstur[i] as Map, ligYaz: ligler.length > 1),
          ],
          // KAPSAM NOTU — hangi turnuvaların dahil olduğu YAZILIR.
          // Liste dolu göründüğü için, kupa/Avrupa maçlarının eksik olduğu
          // ancak burada anlaşılır. Sessiz eksik, yanlış bilgiden daha
          // tehlikelidir.
          if (ligler.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(
                left: Spacing.lg,
                right: Spacing.lg,
                top: Spacing.md,
              ),
              child: Text(
                'Kapsam: ${ligler.join(' · ')}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10.5,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _ayrac() => Padding(
    key: _ayracKey,
    padding: const EdgeInsets.symmetric(horizontal: Spacing.lg, vertical: 8),
    child: Row(
      children: [
        Expanded(child: Divider(height: 1, color: AppColors.border)),
        const SizedBox(width: 8),
        Text(
          'SIRADAKİ',
          style: TextStyle(
            color: AppColors.primary,
            fontSize: 10,
            fontWeight: AppFont.black,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(child: Divider(height: 1, color: AppColors.border)),
      ],
    ),
  );
}

class _SatirMac extends StatelessWidget {
  const _SatirMac({required this.f, required this.ligYaz});

  final Map f;
  final bool ligYaz;

  @override
  Widget build(BuildContext context) {
    final evde = f['evde'] == true;
    final oynandi = f['oynandi'] == true;
    final sonuc = f['sonuc'] as String?;
    final skor = fiksturSkoru(f);
    final lig = '${f['lig'] ?? ''}';

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: Spacing.lg),
      decoration: BoxDecoration(
        color: oynandi ? null : AppColors.bgAlt,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 76,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  tarihEtiketi(f['dateUnix']),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                    fontWeight: AppFont.heavy,
                  ),
                ),
                // Turnuva adı YALNIZ birden fazla turnuva varsa yazılır — tek
                // turnuvada her satıra aynı adı basmak gürültüden ibaret olurdu.
                if (ligYaz && lig.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Opacity(
                      opacity: 0.8,
                      child: Text(
                        lig,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 9,
                          fontWeight: AppFont.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${f['home'] ?? '—'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 12.5,
                      // kartı açılan takım kalın
                      fontWeight: evde ? AppFont.black : AppFont.semibold,
                    ),
                  ),
                ),
                // Skor YALNIZ oynanmış maçta; oynanmamışta nötr ayraç.
                SizedBox(
                  width: 46,
                  child: Text(
                    skor ?? 'v',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: skor != null
                          ? AppColors.text
                          : AppColors.textMuted,
                      fontSize: skor != null ? 12.5 : 11,
                      fontWeight: skor != null ? AppFont.black : AppFont.bold,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    '${f['away'] ?? '—'}',
                    maxLines: 1,
                    textAlign: TextAlign.right,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 12.5,
                      fontWeight: evde ? AppFont.semibold : AppFont.black,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 20,
            height: 20,
            child: (sonuc != null && sonuc.isNotEmpty)
                ? Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _sonucRengi[sonuc] ?? AppColors.gray,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      sonuc,
                      style: TextStyle(
                        color: okunurMetin(
                          _sonucRengi[sonuc] ?? AppColors.gray,
                        ),
                        fontSize: 10,
                        fontWeight: AppFont.black,
                      ),
                    ),
                  )
                : null,
          ),
        ],
      ),
    );
  }
}
