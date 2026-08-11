// KAYNAK: app/src/ui.js + app/src/components.js — ortak bileşenler.
//
// Ölçüler (padding, yarıçap, yazı boyutu, harf aralığı) kaynaktaki StyleSheet
// değerlerinden BİREBİR alındı; "yakın" değer yazılmadı.
//
// RN → Flutter karşılıkları:
//   View + flexDirection:'row' + gap  →  Row + SizedBox / spacing
//   TouchableOpacity activeOpacity    →  InkWell (Android dalgası) — kaynakta
//                                        opaklık sönümüydü; Android'de yerli
//                                        davranış dalgadır ve kullanıcı bunu
//                                        bekler. Tek bilinçli görsel sapma.
//   numberOfLines={1}                 →  maxLines: 1 + TextOverflow.ellipsis

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/crest_url.dart';
import '../core/network/api_config.dart';
import '../core/theme/tokens.dart';
import '../core/utils.dart';

/// `ui.js` → `Logo`
///
/// Kulüp arması / nötr top. ADRES VEKİLDEN GEÇER (/api/crest) — gerekçe
/// gizlilik: doğrudan dış adrese giden her görsel isteği kullanıcının IP'sini
/// ve hangi ekranı açtığını üçüncü tarafa bildirir.
class Logo extends StatelessWidget {
  const Logo({super.key, this.uri, this.name, this.size = 40});

  final String? uri;
  final String? name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final adres = crestUrlOf(uri, apiBase);
    if (adres.isEmpty) return _fallback();

    return CachedNetworkImage(
      imageUrl: adres,
      width: size,
      height: size,
      fit: BoxFit.contain,
      // Kaynakta `onError` ile nötr topa düşülüyordu; aynı davranış.
      errorWidget: (_, _, _) => _fallback(),
      placeholder: (_, _) => SizedBox(width: size, height: size),
      imageBuilder: (_, provider) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppColors.cardAlt,
          borderRadius: BorderRadius.circular(size * 0.22),
          image: DecorationImage(image: provider, fit: BoxFit.contain),
        ),
      ),
    );
  }

  Widget _fallback() => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: const BoxDecoration(
      color: AppColors.cardAlt,
      shape: BoxShape.circle,
    ),
    child: Text('⚽', style: TextStyle(fontSize: size * 0.5)),
  );
}

/// `components.js` → `RecordBadges`
///
/// Sezon başı: hiç maç yoksa sıfır dolu rozet dizmek bilgi vermez, "bozuk"
/// görünür — hiç veri yoksa rozetler tümüyle gizlenir (uydurma sayı yok).
class RecordBadges extends StatelessWidget {
  const RecordBadges({
    super.key,
    this.wins = 0,
    this.draws = 0,
    this.losses = 0,
    this.played,
    this.alignRight = false,
  });

  final int wins;
  final int draws;
  final int losses;
  final int? played;
  final bool alignRight;

  @override
  Widget build(BuildContext context) {
    // KAYNAKTAKİ KOŞUL: `if (!played && !wins && !draws && !losses) return null;`
    //
    // JavaScript'te `!0` DOĞRUDUR. Yani sezon başında (played=0, w/d/l=0) kaynak
    // rozetleri HİÇ çizmez — kendi yorumunun dediği gibi: "sıfır dolu rozet
    // dizmek bilgi vermez, 'bozuk' görünür".
    //
    // İlk çeviride bu `played == null` yazılmıştı; Dart'ta 0 ≠ null olduğu için
    // emülatörde 15 maçın hepsinde "0G 0B 0M" çıktı. Sayı uydurulmuyordu ama
    // kaynağın sakladığı bir boşluk gösteriliyordu — sessiz bir sadakat hatası.
    // Aşağısı JS'in "falsy" anlamını birebir kurar.
    final playedFalsy = played == null || played == 0;
    if (playedFalsy && wins == 0 && draws == 0 && losses == 0) {
      return const SizedBox.shrink();
    }

    Widget cell(int n, String letter, Color c) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: c,
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(
        '$n$letter',
        style: const TextStyle(
          color: Color(0xFFFFFFFF),
          fontSize: 12,
          fontWeight: AppFont.heavy,
        ),
      ),
    );

    // Sağda ⚽ rozetlerden önce (⚽ 10 ...), solda rozetlerden sonra (... 10 ⚽).
    final playedTag = played == null
        ? null
        : Padding(
            padding: const EdgeInsets.only(right: 2),
            child: Text(
              alignRight ? '⚽ $played' : '$played ⚽',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: AppFont.bold,
              ),
            ),
          );

    return Wrap(
      spacing: 4,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      alignment: alignRight ? WrapAlignment.end : WrapAlignment.start,
      children: [
        if (alignRight && playedTag != null) playedTag,
        cell(wins, 'G', AppColors.green),
        cell(draws, 'B', AppColors.yellow),
        cell(losses, 'M', AppColors.red),
        if (!alignRight && playedTag != null) playedTag,
      ],
    );
  }
}

/// `ui.js` → `Skeleton`
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height = 14, this.width});

  final double height;
  final double? width;

  @override
  Widget build(BuildContext context) => Container(
    height: height,
    width: width,
    decoration: BoxDecoration(
      color: AppColors.cardAlt,
      borderRadius: BorderRadius.circular(6),
    ),
  );
}

/// `ui.js` → `SkeletonCard`
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(Spacing.lg),
    margin: const EdgeInsets.only(bottom: Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.lgR,
      boxShadow: AppShadow.soft,
    ),
    child: LayoutBuilder(
      builder: (context, c) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Skeleton(height: 16, width: c.maxWidth * 0.55),
          const SizedBox(height: 10),
          Skeleton(height: 12, width: c.maxWidth * 0.80),
          const SizedBox(height: 10),
          Skeleton(height: 12, width: c.maxWidth * 0.70),
          const SizedBox(height: 16),
          const Skeleton(height: 36),
        ],
      ),
    ),
  );
}

/// `ui.js` → `EmptyState`
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    this.icon = '📭',
    required this.title,
    this.message,
  });

  final String icon;
  final String title;
  final String? message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(
      horizontal: Spacing.lg,
      vertical: Spacing.xxxl,
    ),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: AppRadius.xlR,
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadow.card,
    ),
    child: Column(
      // SINIRSIZ ALAN KORUMASI: Center/Expanded içinde çizildiğinde kart
      // ekranın tamamına yayılıyordu. Kaynakta RN'in varsayılanı zaten
      // "içerik kadar"dır; Flutter'ın varsayılanı ters olduğu için açıkça
      // yazılır.
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(icon, style: const TextStyle(fontSize: 34)),
        const SizedBox(height: Spacing.md),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppColors.text,
            fontSize: AppFont.lg,
            fontWeight: AppFont.heavy,
          ),
        ),
        if (message != null && message!.isNotEmpty) ...[
          const SizedBox(height: Spacing.xs),
          Text(
            message!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textSoft,
              fontSize: AppFont.sm,
            ),
          ),
        ],
      ],
    ),
  );
}

/// `ui.js` → `MatchCard` (bülten maç kartı)
class MatchCard extends StatelessWidget {
  const MatchCard({super.key, required this.match, this.onTap});

  final Map<String, dynamic> match;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final d = matchDate(match['date'] as String?);
    final stats = match['stats'] as Map?;
    final hs = (stats?['home'] as Map?)?['standing'] as Map?;
    final as_ = (stats?['away'] as Map?)?['standing'] as Map?;
    final sc = match['score'] as Map?;
    final live = match['live'] == true;

    // Bitmiş maç = başlamış + canlı değil + skor var. MS sonucu (1/X/2):
    // resmi 'result' varsa onu, yoksa skordan hesapla. Skor ASLA MS ile
    // karışmaz.
    final isFinished = match['started'] == true && !live && sc != null;
    final scHome = sc?['home'];
    final scAway = sc?['away'];
    final res =
        (match['result'] as String?) ??
        (sc != null && scHome != null && scAway != null
            ? ((scHome as num) > (scAway as num)
                  ? '1'
                  : (scHome) < (scAway)
                  ? '2'
                  : 'X')
            : null);
    final resColor = res == '1'
        ? AppColors.primary
        : res == '2'
        ? AppColors.yellow
        : AppColors.gray;

    final homeName = (match['home'] as Map?)?['name'] as String? ?? '';
    final awayName = (match['away'] as Map?)?['name'] as String? ?? '';
    final league = match['league'] as String?;

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.lgR,
        boxShadow: AppShadow.soft,
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(Spacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── üst şerit: no · lig · durum ──
                Row(
                  children: [
                    Text(
                      '#${match['no']}',
                      style: const TextStyle(
                        color: AppColors.accent,
                        fontSize: 12,
                        fontWeight: AppFont.black,
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (league != null && league.isNotEmpty)
                      Expanded(
                        child: Text(
                          league,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                      )
                    else
                      const Spacer(),
                    const SizedBox(width: 8),
                    if (live)
                      _liveTag(match['minute'])
                    else if (isFinished && res != null)
                      _msTag(res, resColor)
                    else
                      Text(
                        '${d.day} · ${d.time}',
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11.5,
                          fontWeight: AppFont.bold,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),

                // ── ana satır: ev · skor/VS · deplasman ──
                Row(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Logo(
                            uri: crestOf(match, 'home'),
                            name: homeName,
                            size: 30,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              homeName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.text,
                                fontSize: 14.5,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: Spacing.sm),
                    if (sc != null)
                      _scoreTag('$scHome - $scAway', live)
                    else
                      _vsTag(),
                    const SizedBox(width: Spacing.sm),
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Text(
                              awayName,
                              maxLines: 1,
                              textAlign: TextAlign.right,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.text,
                                fontSize: 14.5,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Logo(
                            uri: crestOf(match, 'away'),
                            name: awayName,
                            size: 30,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // ── form şeridi (varsa) ──
                if (hs != null || as_ != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.only(top: 10),
                    decoration: const BoxDecoration(
                      border: Border(top: BorderSide(color: AppColors.border)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: hs == null
                              ? const SizedBox.shrink()
                              : RecordBadges(
                                  wins: _i(hs['wins']),
                                  draws: _i(hs['draws']),
                                  losses: _i(hs['losses']),
                                  played: hs['played'] as int?,
                                ),
                        ),
                        Expanded(
                          child: as_ == null
                              ? const SizedBox.shrink()
                              : Align(
                                  alignment: Alignment.centerRight,
                                  child: RecordBadges(
                                    wins: _i(as_['wins']),
                                    draws: _i(as_['draws']),
                                    losses: _i(as_['losses']),
                                    played: as_['played'] as int?,
                                    alignRight: true,
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  static int _i(Object? v) => v is num ? v.toInt() : 0;

  Widget _vsTag() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
    decoration: BoxDecoration(
      color: AppColors.bgAlt,
      borderRadius: BorderRadius.circular(6),
    ),
    child: const Text(
      'VS',
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 12,
        fontWeight: AppFont.black,
        letterSpacing: 1,
      ),
    ),
  );

  Widget _scoreTag(String text, bool live) => Container(
    constraints: const BoxConstraints(minWidth: 46),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: live ? AppColors.accent : AppColors.bgAlt,
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      text,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: live ? const Color(0xFFFFFFFF) : AppColors.text,
        fontSize: 16,
        fontWeight: AppFont.black,
        letterSpacing: 1,
      ),
    ),
  );

  Widget _liveTag(Object? minute) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: AppColors.accent,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: const BoxDecoration(
            color: Color(0xFFFFFFFF),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          "CANLI${minute != null ? " $minute'" : ''}",
          style: const TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 10,
            fontWeight: AppFont.black,
            letterSpacing: 0.5,
          ),
        ),
      ],
    ),
  );

  Widget _msTag(String res, Color c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: c,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      'MS $res',
      style: const TextStyle(
        color: Color(0xFFFFFFFF),
        fontSize: 10.5,
        fontWeight: AppFont.black,
        letterSpacing: 0.5,
      ),
    ),
  );
}

/// `ui.js` → `Pill`
///
/// Ton adları kaynaktakiyle aynı; bilinmeyen ton `default`a düşer (kaynakta
/// `pillTone[tone] || pillTone.default`).
class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, this.tone = 'default'});

  final String label;
  final String tone;

  static const Map<String, (Color, Color)> _tones = {
    'default': (AppColors.primarySoft, AppColors.primary),
    'primary': (AppColors.primarySoft, AppColors.primary),
    'accent': (AppColors.accentSoft, AppColors.accent),
    'success': (AppColors.successSoft, AppColors.success),
    'warning': (AppColors.warningSoft, AppColors.warning),
    'danger': (AppColors.dangerSoft, AppColors.danger),
    'info': (AppColors.infoSoft, AppColors.info),
    'dark': (AppColors.darkCardSoft, AppColors.white),
  };

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _tones[tone] ?? _tones['default']!;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: Spacing.md,
        vertical: Spacing.xs,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: AppRadius.pillR,
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: AppFont.xs,
          fontWeight: AppFont.bold,
        ),
      ),
    );
  }
}

/// `ui.js` → `ProgressBar`. Değer 0–100 arasına KIRPILIR: sunucudan gelen
/// bozuk bir yüzde çubuğu taşırmaz.
class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, this.value = 0, this.tone = 'primary'});

  final num value;
  final String tone;

  static const Map<String, Color> _tones = {
    'primary': AppColors.primary,
    'accent': AppColors.accent,
    'success': AppColors.success,
    'warning': AppColors.warning,
    'danger': AppColors.danger,
    'info': AppColors.info,
  };

  @override
  Widget build(BuildContext context) {
    final safe = value.clamp(0, 100).toDouble();
    return ClipRRect(
      borderRadius: AppRadius.pillR,
      child: Container(
        height: 8,
        color: AppColors.primarySoft,
        child: FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: safe / 100,
          child: Container(
            decoration: BoxDecoration(
              color: _tones[tone] ?? AppColors.primary,
              borderRadius: AppRadius.pillR,
            ),
          ),
        ),
      ),
    );
  }
}

/// `components/DemoDataBanner.js`
///
/// GÜVEN KURALI: Bu ekrandaki bülten/sonuç/kupon verileri MOCK (örnek)
/// veridir, gerçek Spor Toto verisi DEĞİLDİR. Kullanıcıya asla gerçekmiş gibi
/// gösterilmez; bu bant her mock-beslemeli ekranın en üstünde büyük ve net
/// durur.
class DemoDataBanner extends StatelessWidget {
  const DemoDataBanner({super.key, this.note});

  final String? note;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.fromLTRB(Spacing.md, Spacing.md, Spacing.md, 0),
    padding: const EdgeInsets.symmetric(
      vertical: 10,
      horizontal: Spacing.md,
    ),
    decoration: BoxDecoration(
      color: AppColors.warningSoft,
      border: Border.all(color: AppColors.warning, width: 1.5),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.warning,
            borderRadius: BorderRadius.circular(6),
          ),
          child: const Text(
            '🧪 DEMO VERİ',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 12,
              fontWeight: AppFont.black,
              letterSpacing: 0.4,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            note ??
                'Bu ekrandaki bülten/sonuç/kupon örnektir — gerçek Spor Toto verisi değildir.',
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 12,
              height: 17 / 12,
            ),
          ),
        ),
      ],
    ),
  );
}
