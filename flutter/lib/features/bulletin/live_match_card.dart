// KAYNAK: app/src/components/LiveMatchCard.js — BİREBİR çeviri.
//
// Bülten liste kartı — modern, hizalı. Takım + O-G-B-M kaydı yan kolonlarda,
// skor/durum ortada; ayraç altında Sen/Sistem tahmini. Detaylı canlı istatistik
// burada YOK; maça girince görünür.

import 'package:flutter/material.dart';

import '../../core/favorite_team.dart';
import '../../core/live_logic.dart';
import 'mac_takip_ui.dart';
import '../../core/services/muhurlu_sistem.dart';
import '../../core/theme/takim_paleti.dart' show okunurMetin;
import '../../core/theme/tokens.dart';
import '../../core/ulke_seridi.dart' show macUlkesiEn;
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/form_strip.dart';
import '../../widgets/ulke_etiketi.dart';

/// Sıra sütunu ölçüleri TEK YERDE. Numara ile form şeridinin hizası buna bağlı;
/// iki ayrı sayı yazılsaydı biri değişince hiza sessizce bozulurdu.
const double _siraSutunu = 30; // 25 px yazı + iki haneli sıralar (10-15) sığsın
const double _siraBosluk = 4;

typedef _Meta = ({String text, Color color, bool pulse, bool refresh});

_Meta _statusMeta(MacDurum st, Map m) => switch (st) {
  MacDurum.live => (
    text: "CANLI${m['minute'] != null ? " ${m['minute']}'" : ''}",
    // Anlamsal: canlı her takımda kırmızı (bkz. AppColors.live).
    color: AppColors.live,
    pulse: true,
    refresh: false,
  ),
  // henüz resmi Spor Toto sonucu değil
  MacDurum.finished => (
    text: 'MS',
    color: AppColors.warning,
    pulse: false,
    refresh: false,
  ),
  MacDurum.awaiting => (
    text: 'Sonuç bekleniyor',
    color: AppColors.warning,
    pulse: false,
    refresh: true,
  ),
  MacDurum.suspended => (
    text: 'Maç durdu',
    color: AppColors.warning,
    pulse: false,
    refresh: false,
  ),
  MacDurum.postponed => (
    text: 'Ertelendi',
    color: AppColors.muted,
    pulse: false,
    refresh: false,
  ),
  MacDurum.cancelled => (
    text: 'İptal',
    color: AppColors.danger,
    pulse: false,
    refresh: false,
  ),
  MacDurum.notStarted => (
    text: 'Başlamadı',
    color: AppColors.muted,
    pulse: false,
    refresh: false,
  ),
};

class LiveMatchCard extends StatefulWidget {
  const LiveMatchCard({
    super.key,
    required this.match,
    this.onPress,
    this.anim = 'important',
    this.userPick,
    this.favoriteTeam,
    this.aktarim,
    this.roundId,
  });

  final Map<String, dynamic> match;
  final VoidCallback? onPress;

  /// Bu maç için KUPONA AKTARIM DAMGASI ({secim, zaman, kaynak, …}) — varsa
  /// kullanıcı sistem önerisini kuponuna almış demektir. Sistem o günden beri
  /// tahminini değiştirdiyse alt satırda "eski → yeni" gösterilir.
  final Map<String, dynamic>? aktarim;

  /// Karar izi sorgusu için hafta kimliği (gözlem serisi hafta bazlı).
  final Object? roundId;

  /// 'on' | 'off' | 'important'
  final String anim;
  final String? userPick;

  /// FAVORİ TAKIM VURGUSU — profildeki favori takımın maçı ⭐ ile işaretlenir.
  /// Kaynakta `useAuth()` ile okunuyordu; oturum katmanı Adım 3'te (Profil)
  /// bağlanacak. O zamana kadar null gelir ve yıldız HİÇ çizilmez — yanlış
  /// takıma yıldız koymaktansa hiç koymamak doğrudur.
  final String? favoriteTeam;

  @override
  State<LiveMatchCard> createState() => _LiveMatchCardState();
}

class _LiveMatchCardState extends State<LiveMatchCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _pulseAyarla();
  }

  @override
  void didUpdateWidget(covariant LiveMatchCard old) {
    super.didUpdateWidget(old);
    _pulseAyarla();
  }

  /// Kaynak: 700 ms'de 1 → 0.4, sonra 700 ms'de geri; sonsuz döngü.
  void _pulseAyarla() {
    final st = deriveStatus(widget.match);
    final meta = _statusMeta(st, widget.match);
    if (meta.pulse && widget.anim != 'off') {
      if (!_pulse.isAnimating) _pulse.repeat(reverse: true);
    } else {
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.match;
    final p = matchPicks(m, widget.userPick);
    final st = p.status;
    final meta = _statusMeta(st, m);

    // CANLI MAÇTA SKOR GÖSTERİLMEZ (kullanıcı kararı, 2 Ağustos 2026):
    // "skoru gösterme, sadece maçın oynandığı belli olsun". Durum rozeti
    // (meta.text) zaten "CANLI 34'" diyor. Anlık skor saniyede değişir ve
    // resmî sonuçla karışma riski taşır — projenin "yalnız resmî 90 dakika
    // sonucu kesindir" kuralıyla da aynı yönde.
    final showScore =
        st != MacDurum.notStarted &&
        st != MacDurum.postponed &&
        st != MacDurum.cancelled &&
        st != MacDurum.live &&
        m['score'] != null;
    final hidePicks = st == MacDurum.cancelled;
    final d = m['date'] != null ? matchDate(m['date'] as String?) : null;

    final home = m['home'] as Map?;
    final away = m['away'] as Map?;
    final homeName =
        (home?['mediumName'] as String?) ?? (home?['name'] as String?) ?? '';
    final awayName =
        (away?['mediumName'] as String?) ?? (away?['name'] as String?) ?? '';

    final favSide = favoriteSide(m, widget.favoriteTeam);
    final stats = m['stats'] as Map?;
    final hRec = (stats?['home'] as Map?)?['standing'] as Map?;
    final aRec = (stats?['away'] as Map?)?['standing'] as Map?;

    final uMark = st == MacDurum.postponed ? Isaret.none : p.user.mark;
    final sMark = st == MacDurum.postponed ? Isaret.none : p.system.mark;

    final coverage = m['coverage'] as Map?;

    // SİSTEM TAHMİNİ NEDEN YOK — backend, tahmin üretmediği maçta sebebini
    // `analysisAbsence` ile yazar (ör. maç başladıktan sonra tahmin
    // üretilmez: mühürlü analizi olmayan başlamış maç). Sebep çizilmediği
    // sürece kartta yalnız "Sistem —" kalıyordu ve kullanıcıya "tahminler
    // kayboldu / uygulama bozuk" gibi görünüyordu (bildirim, 22 Ağu 2026).
    final absenceText = ((m['analysisAbsence'] as Map?)?['text'] as String?)
        ?.trim();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        // Kaynak: 'rgba(255,255,255,0.86)' — zemindeki takım filigranı
        // kartların ARDINDAN hafifçe görünsün diye yarı saydam.
        color: AppColors.surface.withValues(alpha: 0.86),
        borderRadius: AppRadius.lgR,
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadow.soft,
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onPress,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Ülke satırı — hangi ülkenin maçı (kullanıcı isteği, 2026-08-04)
                //
                // SAĞ UÇTA (kullanıcı isteği, 2026-08-11): maç takibi yıldızı
                // ve o maça özel bildirim ayarları çarkı. İkisi de KART
                // AÇILMADAN çalışır; dokunuşları kartın kendi `onPress`'ine
                // karışmasın diye ayrı vurulur.
                Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Row(
                    children: [
                      Expanded(
                        child: UlkeEtiketi(
                          league: m['league'] as String?,
                          yedekUlkeEn: macUlkesiEn(m),
                        ),
                      ),
                      MacTakipSimgeleri(match: m),
                    ],
                  ),
                ),

                // ÜST BLOK: solda sıra numarası, sağda takım satırı + son
                // maçlar şeridi. `crossAxisAlignment: center` numarayı İKİ
                // SATIRIN tamamına göre ortalar; rakam böylece alttaki ev/uçak
                // şeridiyle aynı göz hizasına düşer.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: _siraSutunu,
                      child: Padding(
                        // İnce ayar (kullanıcı: "2 tık aşağı çek"): rakamın
                        // optik ağırlığı üstte kalıyordu.
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '${m['no']}',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.textSoft,
                            fontSize: 25,
                            fontWeight: AppFont.black,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: _siraBosluk),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              // ── EV SAHİBİ ──
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Logo(
                                          uri: crestOf(m, 'home'),
                                          name: homeName,
                                          size: 20,
                                        ),
                                        const SizedBox(width: 7),
                                        // FAVORİ İŞARETİ VEKTÖR (kullanıcı
                                        // isteği, 2026-08-12): ⭐ emojisiydi,
                                        // rengi temayla değişmiyordu.
                                        if (favSide == 'home') ...[
                                          Icon(
                                            Icons.star,
                                            size: 13,
                                            color: AppColors.gold,
                                          ),
                                          const SizedBox(width: 3),
                                        ],
                                        Flexible(
                                          child: Text(
                                            homeName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color: AppColors.text,
                                              fontSize: 13.5,
                                              fontWeight: AppFont.heavy,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (hRec != null) ...[
                                      const SizedBox(height: 6),
                                      RecordBadges(
                                        wins: _i(hRec['wins']),
                                        draws: _i(hRec['draws']),
                                        losses: _i(hRec['losses']),
                                        played: _iN(hRec['played']),
                                      ),
                                    ],
                                  ],
                                ),
                              ),

                              // ── ORTA: saat/gün ya da skor + durum rozeti ──
                              Container(
                                constraints: const BoxConstraints(minWidth: 64),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                ),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: st == MacDurum.notStarted
                                      ? [
                                          Text(
                                            d != null ? d.time : '—',
                                            style: TextStyle(
                                              color: AppColors.text,
                                              fontSize: 14,
                                              fontWeight: AppFont.heavy,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            d != null ? d.day : '',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color: AppColors.muted,
                                              fontSize: 10,
                                              fontWeight: AppFont.bold,
                                            ),
                                          ),
                                        ]
                                      : [
                                          if (showScore) ...[
                                            Text(
                                              '${(m['score'] as Map)['home']} - '
                                              '${(m['score'] as Map)['away']}',
                                              style: TextStyle(
                                                color: meta.color,
                                                fontSize: 18,
                                                fontWeight: AppFont.black,
                                                letterSpacing: 1,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                          ],
                                          _durumRozeti(meta),
                                        ],
                                ),
                              ),

                              // ── DEPLASMAN ──
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Flexible(
                                          child: Text(
                                            awayName,
                                            maxLines: 1,
                                            textAlign: TextAlign.right,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color: AppColors.text,
                                              fontSize: 13.5,
                                              fontWeight: AppFont.heavy,
                                            ),
                                          ),
                                        ),
                                        // Favori işareti — ev sahibindekinin
                                        // aynası; yıldız isimden SONRA gelir.
                                        if (favSide == 'away') ...[
                                          const SizedBox(width: 3),
                                          Icon(
                                            Icons.star,
                                            size: 13,
                                            color: AppColors.gold,
                                          ),
                                        ],
                                        const SizedBox(width: 7),
                                        Logo(
                                          uri: crestOf(m, 'away'),
                                          name: awayName,
                                          size: 20,
                                        ),
                                      ],
                                    ),
                                    if (aRec != null) ...[
                                      const SizedBox(height: 6),
                                      RecordBadges(
                                        wins: _i(aRec['wins']),
                                        draws: _i(aRec['draws']),
                                        losses: _i(aRec['losses']),
                                        played: _iN(aRec['played']),
                                        alignRight: true,
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),

                          // ── SON MAÇLAR ŞERİDİ ──
                          // ANALİZ ÖZETİ KALDIRILDI (kullanıcı kararı,
                          // 2026-08-08): kartta "SÜRPRİZE AÇIK · Favori 1 ·
                          // %44 · Sürpriz 78" satırı vardı. Bülten listesi
                          // maçların KİMLİĞİNİ göstersin, hükmü değil. Aynı
                          // bilgiler maç detayında ve Radar'da duruyor.
                          if (st == MacDurum.notStarted && _formVar(stats))
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  _formTarafi(stats, 'home', sag: false),
                                  Text(
                                    'son maçlar',
                                    style: TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 10,
                                      fontWeight: AppFont.bold,
                                    ),
                                  ),
                                  _formTarafi(stats, 'away', sag: true),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),

                // ── AYRAÇ ──
                Container(
                  height: 1,
                  margin: const EdgeInsets.only(top: 12, bottom: 9),
                  color: AppColors.border,
                ),

                // ── ALT: Sen / Sistem ──
                if (hidePicks)
                  Text(
                    'Resmi karar bekleniyor',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: AppFont.bold,
                      fontStyle: FontStyle.italic,
                    ),
                  )
                else
                  _tahminSatiri(p, uMark, sMark, st),

                // ── SİSTEM TAHMİNİ YOKSA SEBEBİ ──
                // Uyarı değil bilgi: bu bir arıza değil, kuralın kendisi
                // (maç başladıktan sonra tahmin üretilmez). Bu yüzden nötr
                // kutu; kapsam uyarısı sarı kalır.
                if (!hidePicks && absenceText != null && absenceText.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.bgAlt,
                      borderRadius: AppRadius.smR,
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      'ⓘ $absenceText',
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10.5,
                        fontWeight: AppFont.bold,
                        height: 14 / 10.5,
                      ),
                    ),
                  ),

                // ── KAPSAM UYARISI ──
                if (coverage != null && coverage['ok'] == false)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: AppRadius.smR,
                      border: Border.all(color: AppColors.warning),
                    ),
                    child: Text(
                      '⚠ ${coverage['reason'] ?? 'Analiz verisi hazır değil'}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: okunurMetin(AppColors.warningSoft),
                        fontSize: 10.5,
                        fontWeight: AppFont.heavy,
                        height: 14 / 10.5,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// ALT SATIR ÇİPİ (kullanıcı isteği, 2026-08-14): "Sen …" ve "Sistem …"
  /// düz yazıydı, ikisi tek bir gri satır gibi okunuyordu. Yumuşak zeminli
  /// kutu ikisini ayrıştırır; içerik ve renkler AYNEN korunur.
  Widget _cip(Widget cocuk) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: AppColors.surfaceSoft,
      borderRadius: AppRadius.pillR,
      border: Border.all(color: AppColors.border),
    ),
    child: cocuk,
  );

  Widget _durumRozeti(_Meta meta) {
    final rozet = Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: meta.color),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        meta.text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: meta.color,
          fontSize: 9.5,
          fontWeight: AppFont.black,
        ),
      ),
    );

    if (!meta.pulse || widget.anim == 'off') return rozet;

    return AnimatedBuilder(
      animation: _pulse,
      builder: (_, child) => Opacity(
        // Kaynak: 1 ↔ 0.4
        opacity: 1 - (_pulse.value * 0.6),
        child: child,
      ),
      child: rozet,
    );
  }

  /// KART ALT SATIRI — "Sen 1-X            Sistem 1-X → 1-2"
  ///
  /// DEĞİŞİM GÖSTERİMİ (2026-08-11 kullanıcı isteği): kullanıcı sistem
  /// seçimini kuponuna ALDIYSA (aktarım damgası) ve sistem o günden beri
  /// tahminini değiştirdiyse, eski seçim SOLUK, ok TURUNCU, yeni seçim KOYU
  /// yazılır. Ayrı "Değişti" etiketi ve kart içinde uzun açıklama YOK —
  /// ayrıntı satıra dokununca alttan açılan pencerede.
  ///
  /// Eski değer damgadan, yeni değer bültenin güncel tahmininden gelir;
  /// hiçbiri sabit yazılmaz. Damga yoksa ya da değer aynıysa tek değer çizilir.
  ///
  /// KUM SAATİ YOK: bekleyen maç işareti (⏳) kaldırıldı — kilit bilgisi
  /// ekranın üstünde zaten duruyor. ✅/❌ yalnız sonuç geldiğinde çizilir.
  Widget _tahminSatiri(MatchPicks p, Isaret uMark, Isaret sMark, MacDurum st) {
    // Sistem sembolü "10" → "1-X" biçiminde yazılır (kaynakta 0 → X).
    String yaz(String? sym) => sym == null
        ? '—'
        : sym.split('').map((c) => c == '0' ? 'X' : c).join('-');

    final sysSym = yaz(p.system.sym);
    final eski = _eskiSistemSecimi(p.system.sym);

    final label = TextStyle(
      color: AppColors.muted,
      fontSize: 11,
      fontWeight: AppFont.heavy,
    );
    final isaretli = TextStyle(fontSize: 12, color: AppColors.text);

    final sistemBolumu = RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: isaretli,
        children: [
          TextSpan(text: 'Sistem ', style: label),
          if (eski != null) ...[
            TextSpan(
              text: yaz(eski),
              style: TextStyle(
                color: AppColors.muted,
                fontWeight: AppFont.bold,
              ),
            ),
            const TextSpan(
              text: ' → ',
              style: TextStyle(
                color: AppColors.warning,
                fontWeight: AppFont.black,
              ),
            ),
          ],
          TextSpan(
            text: sysSym,
            style: TextStyle(color: AppColors.text, fontWeight: AppFont.black),
          ),
          if (sMark != Isaret.pending && kIsaretMetni[sMark]!.isNotEmpty)
            TextSpan(text: ' ${kIsaretMetni[sMark]}'),
        ],
      ),
    );

    final senBolumu = RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: isaretli,
        children: [
          TextSpan(text: 'Sen ', style: label),
          TextSpan(
            text: p.user.sym == null ? 'Kupon yok' : yaz(p.user.sym),
            style: TextStyle(
              color: AppColors.textSoft,
              fontWeight: AppFont.bold,
            ),
          ),
          if (uMark != Isaret.pending && kIsaretMetni[uMark]!.isNotEmpty)
            TextSpan(text: ' ${kIsaretMetni[uMark]}'),
          if (st == MacDurum.postponed)
            TextSpan(
              text: '  · Ertelendi',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                fontWeight: AppFont.bold,
                fontStyle: FontStyle.italic,
              ),
            ),
        ],
      ),
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Flexible(child: _cip(senBolumu)),
        const SizedBox(width: Spacing.sm),
        // Değişim varsa satır DOKUNULABİLİR: ayrıntı alttan açılır.
        if (eski != null)
          Flexible(
            child: Semantics(
              button: true,
              label:
                  'Sistem tahmini ${yaz(eski)} iken $sysSym oldu — '
                  'ayrıntı için dokun',
              child: GestureDetector(
                onTap: () => _degisimPenceresi(eski, p.system.sym),
                behavior: HitTestBehavior.opaque,
                child: _cip(sistemBolumu),
              ),
            ),
          )
        else
          Flexible(child: _cip(sistemBolumu)),
      ],
    );
  }

  /// ALTTAN AÇILAN PENCERE — değişimin KAYITLI ayrıntısı.
  ///
  /// İçerik yalnız gerçek kayıtlardan gelir: aktarım damgası (ne zaman, hangi
  /// değer, hangi analizden) + sunucunun zaman damgalı gözlem serisinden
  /// okunan değişim anları (olasılık ve oran öncesi/sonrası) + bültenin
  /// güncel gerekçe metni. Kayıt yoksa sebep UYDURULMAZ.
  Future<void> _degisimPenceresi(String eski, String? guncel) async {
    final no = int.tryParse('${widget.match['no']}');
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      isScrollControlled: true,
      builder: (_) => FutureBuilder<KararIzi>(
        future: _iziGetir(no),
        builder: (ctx, snap) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(Spacing.lg),
            child: SingleChildScrollView(
              child: _degisimIcerik(eski, guncel, snap.data, snap.hasData),
            ),
          ),
        ),
      ),
    );
  }

  Future<KararIzi> _iziGetir(int? no) async {
    if (no == null) return KararIzi.yok;
    // Aktif haftada mühür yoktur; arşiv maç kimliği ayrı uçtan okunur.
    final kimlikler = await arsivMacKimlikleri(widget.roundId);
    return sistemKararIzi(widget.roundId, kimlikler[no]);
  }

  Widget _degisimIcerik(String eski, String? guncel, KararIzi? iz, bool geldi) {
    String yaz(String? s) =>
        s == null ? '—' : s.split('').map((c) => c == '0' ? 'X' : c).join('-');
    final damga = widget.aktarim;
    final gerekce = (widget.match['prediction'] as Map?)?['reason'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Sistem tahmini ${yaz(eski)} → ${yaz(guncel)}',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 16,
            fontWeight: AppFont.black,
          ),
        ),
        const SizedBox(height: 10),
        if (damga != null)
          _satir(
            'Kupona aldığın',
            '${yaz(normalTahmin(damga['secim']))} · '
                '${_kisaZaman(damga['zaman'])}',
          ),
        if (!geldi)
          Padding(
            padding: EdgeInsets.only(top: 10),
            child: Text(
              'Kayıt okunuyor…',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          )
        else if (iz == null || !iz.kayitVar)
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: Text(
              'Değişiklik nedeni geçmiş kayıtlardan doğrulanamadı.',
              style: TextStyle(
                color: AppColors.warning,
                fontSize: 12.5,
                fontWeight: AppFont.bold,
              ),
            ),
          )
        else ...[
          const SizedBox(height: 8),
          Text(
            'Kayıtlı değişiklikler (${iz.gozlemSayisi} gözlem)',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 12.5,
              fontWeight: AppFont.black,
            ),
          ),
          if (iz.degisimler.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                'Kayıtlarda bu maçta sistem tahmini değişmemiş.',
                style: TextStyle(color: AppColors.textSoft, fontSize: 12),
              ),
            ),
          for (final d in iz.degisimler)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${yaz(d.eski)} → ${yaz(d.yeni)} · ${_kisaZaman(d.zaman)}',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 12.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                  if (d.eskiOlasilik case final e?)
                    if (d.yeniOlasilik case final y?)
                      Text(
                        'olasılık 1/X/2: %${e['1']}/%${e['X']}/%${e['2']}'
                        ' → %${y['1']}/%${y['X']}/%${y['2']}',
                        style: TextStyle(
                          color: AppColors.textSoft,
                          fontSize: 11.5,
                        ),
                      ),
                  if (d.eskiOran case final e?)
                    if (d.yeniOran case final y?)
                      Text(
                        'oran ev/ber/dep: '
                        '${e['home']}/${e['draw']}/${e['away']}'
                        ' → ${y['home']}/${y['draw']}/${y['away']}',
                        style: TextStyle(
                          color: AppColors.textSoft,
                          fontSize: 11.5,
                        ),
                      ),
                ],
              ),
            ),
        ],
        if (gerekce != null) ...[
          const SizedBox(height: 12),
          Text(
            'Sistemin şu anki gerekçesi',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 12.5,
              fontWeight: AppFont.black,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              '$gerekce',
              style: TextStyle(
                color: AppColors.textSoft,
                fontSize: 11.5,
                height: 1.4,
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        Text(
          'Kriter bazlı öncesi/sonrası kayıtta tutulmuyor; bu yüzden '
          'gösterilmiyor.',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 10.5,
            fontStyle: FontStyle.italic,
            height: 1.35,
          ),
        ),
      ],
    );
  }

  Widget _satir(String baslik, String deger) => Padding(
    padding: const EdgeInsets.only(top: 3),
    child: RichText(
      text: TextSpan(
        style: TextStyle(color: AppColors.textMuted, fontSize: 12),
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

  /// '2026-08-05T20:53:23.620Z' → '5 Ağu 20:53'. Ayrıştırılamazsa ham değer.
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

  /// Kupona AKTARILAN sistem seçimi, güncel seçimden farklıysa onu döndürür.
  /// Damga yoksa (elle seçim ya da eski kupon) null — "değişti" İDDİA EDİLMEZ.
  String? _eskiSistemSecimi(String? guncel) {
    final damga = widget.aktarim;
    if (damga == null || guncel == null) return null;
    final eski = normalTahmin(damga['secim']);
    final yeni = normalTahmin(guncel);
    if (eski == null || yeni == null || eski == yeni) return null;
    return eski;
  }

  bool _formVar(Map? stats) {
    final h = (stats?['home'] as Map?)?['last5'] as List?;
    final a = (stats?['away'] as Map?)?['last5'] as List?;
    return (h != null && h.isNotEmpty) || (a != null && a.isNotEmpty);
  }

  /// SAHA İKONLARI (kullanıcı isteği, 2026-08-08): harfli renkli kareler
  /// yerine maç detayındaki ev/uçak ikonlarının aynısı. `last5detail` yoksa
  /// iç saha/deplasman bilinmez — ikon uydurmak yerine harfli şeride düşülür.
  ///
  /// Boyut 18: dar telefonda kart içi ~300dp; ortadaki "son maçlar" yazısı
  /// düşünce her tarafa ~120dp kalıyor. 18 px ikonla 5 maç rahat sığıyor
  /// (5×18 + 4×3 boşluk = 102dp).
  Widget _formTarafi(Map? stats, String taraf, {required bool sag}) {
    final t = stats?[taraf] as Map?;
    final detail = t?['last5detail'] as List?;
    if (detail != null && detail.isNotEmpty) {
      return Flexible(
        child: VenueFormStrip(detail: detail, size: 18, limit: 5, sag: sag),
      );
    }
    return Flexible(child: FormStrip(form: t?['last5'] as List?, size: 14));
  }

  static int _i(Object? v) => v is num ? v.toInt() : 0;
  static int? _iN(Object? v) => v is num ? v.toInt() : null;
}
