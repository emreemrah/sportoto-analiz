// KAYNAK: app/src/components/LiveMatchCard.js — BİREBİR çeviri.
//
// Bülten liste kartı — modern, hizalı. Takım + O-G-B-M kaydı yan kolonlarda,
// skor/durum ortada; ayraç altında Sen/Sistem tahmini. Detaylı canlı istatistik
// burada YOK; maça girince görünür.

import 'package:flutter/material.dart';

import '../../core/favorite_team.dart';
import '../../core/live_logic.dart';
import '../../core/theme/tokens.dart';
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
    color: AppColors.accent,
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
  });

  final Map<String, dynamic> match;
  final VoidCallback? onPress;

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

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        // Kaynak: 'rgba(255,255,255,0.86)' — zemindeki takım filigranı
        // kartların ARDINDAN hafifçe görünsün diye yarı saydam.
        color: const Color(0xFFFFFFFF).withValues(alpha: 0.86),
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
                Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: UlkeEtiketi(league: m['league'] as String?),
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
                          style: const TextStyle(
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
                                        Flexible(
                                          child: Text(
                                            '${favSide == 'home' ? '⭐ ' : ''}$homeName',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
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
                                            style: const TextStyle(
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
                                            style: const TextStyle(
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
                                            '$awayName${favSide == 'away' ? ' ⭐' : ''}',
                                            maxLines: 1,
                                            textAlign: TextAlign.right,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: AppColors.text,
                                              fontSize: 13.5,
                                              fontWeight: AppFont.heavy,
                                            ),
                                          ),
                                        ),
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
                                  const Text(
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
                  const Text(
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
                      style: const TextStyle(
                        color: Color(0xFF7A4A00),
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

  Widget _tahminSatiri(MatchPicks p, Isaret uMark, Isaret sMark, MacDurum st) {
    // Sistem sembolü "10" → "1-X" biçiminde yazılır (kaynakta 0 → X).
    final sysSym = p.system.sym == null
        ? '—'
        : p.system.sym!.split('').map((c) => c == '0' ? 'X' : c).join('-');

    const label = TextStyle(
      color: AppColors.muted,
      fontSize: 11,
      fontWeight: AppFont.heavy,
    );

    return RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: const TextStyle(fontSize: 12, color: AppColors.text),
        children: [
          const TextSpan(text: 'Sen ', style: label),
          TextSpan(
            text: p.user.sym ?? 'Kupon yok',
            style: const TextStyle(
              color: AppColors.textSoft,
              fontWeight: AppFont.bold,
            ),
          ),
          if (kIsaretMetni[uMark]!.isNotEmpty)
            TextSpan(text: ' ${kIsaretMetni[uMark]}'),
          const TextSpan(
            text: '    ·    ',
            style: TextStyle(color: AppColors.border),
          ),
          const TextSpan(text: 'Sistem ', style: label),
          TextSpan(
            text: sysSym,
            style: const TextStyle(
              color: AppColors.text,
              fontWeight: AppFont.black,
            ),
          ),
          if (kIsaretMetni[sMark]!.isNotEmpty)
            TextSpan(text: ' ${kIsaretMetni[sMark]}'),
          if (st == MacDurum.postponed)
            const TextSpan(
              text: '   · Ertelendi',
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
