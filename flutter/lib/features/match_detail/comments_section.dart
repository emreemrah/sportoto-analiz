// KAYNAK: app/src/CommentsSection.js — BİREBİR çeviri.
//
// Maç detayı "Yorumlar" sekmesi: liste, filtre çipleri, yazma alanı, beğeni,
// cevap, düzenle/sil ve MODERASYON (bildir / engelle).
//
// KAYNAKTAN TAŞINAN DÜRÜSTLÜK KURALLARI:
//   • Bildirme penceresi SONUCU SÖZ VERMEZ. "Bu yorum kaldırılacak" demek
//     tutamayacağımız bir söz olurdu; karar moderasyona aittir.
//   • Kaç kişinin bildirdiği HİÇBİR YERDE yazmaz (bildireni tahmin ettirir).
//   • Gizlenmiş yorum YALNIZ yazarına gösterilir — yoksa "kayboldu" sanır.
//   • Moderasyon düğmeleri yalnız BAŞKASININ yorumunda ve yalnız girişliyken
//     çizilir: kullanıcı reddedilecek bir yola hiç sokulmaz.
//   • Hata pencerenin İÇİNDE gösterilir, pencere kapanmaz — kullanıcı yazdığı
//     açıklamayı kaybetmesin diye. Pencere yalnız BAŞARIDA kapanır.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/auth.dart';
import '../../core/moderation_reasons.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/takim_paleti.dart' show okunurMetin;
import '../../core/theme/tokens.dart';
import '../../widgets/avatar.dart';

String timeAgo(Object? iso) {
  final t = iso is String ? DateTime.tryParse(iso) : null;
  if (t == null) return '';
  final s = DateTime.now().difference(t.toLocal()).inSeconds;
  final sn = s < 0 ? 0 : s;
  if (sn < 60) return 'az önce';
  if (sn < 3600) return '${sn ~/ 60} dk';
  if (sn < 86400) return '${sn ~/ 3600} sa';
  return '${sn ~/ 86400} g';
}

class CommentsSection extends StatefulWidget {
  const CommentsSection({super.key, required this.matchId});

  final Object matchId;

  @override
  State<CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends State<CommentsSection> {
  List<Map> _comments = const [];
  bool _loading = true;
  final _textCtl = TextEditingController();
  Map? _replyTo;
  bool _posting = false;
  String? _err;
  String _filter = 'En Yeni';
  final Set<Object> _viewed = {};
  String? _notice;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _textCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await api.comments(widget.matchId);
      final list = ((r as Map)['comments'] as List?)?.cast<Map>() ?? const [];
      if (!mounted) return;
      setState(() {
        _comments = list;
        _loading = false;
      });
      // Görüntülenme: her yorum için mount başına BİR KEZ (ateşle-unut).
      for (final c in list) {
        final id = c['id'];
        if (id != null && _viewed.add(id)) {
          api.viewComment(id).catchError((_) => null);
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _err = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _post() async {
    final t = _textCtl.text.trim();
    if (t.isEmpty) return;
    setState(() {
      _posting = true;
      _err = null;
    });
    try {
      await api.addComment({
        'matchId': widget.matchId,
        'text': t,
        if (_replyTo != null)
          'parentId': _replyTo!['parentId'] ?? _replyTo!['id'],
      });
      if (!mounted) return;
      _textCtl.clear();
      setState(() => _replyTo = null);
      await _load();
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _onLike(Map c) async {
    try {
      if (c['likedByMe'] == true) {
        await api.unlikeComment(c['id'] as Object);
      } else {
        await api.likeComment(c['id'] as Object);
      }
      await _load();
    } catch (_) {
      /* kaynakta da sessiz */
    }
  }

  Future<void> _onEdit(Map c, String t) async {
    try {
      await api.editComment(c['id'] as Object, t);
      await _load();
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    }
  }

  Future<void> _onDelete(Map c) async {
    try {
      await api.deleteComment(c['id'] as Object);
      await _load();
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    }
  }

  // --- MODERASYON ---------------------------------------------------------

  Future<void> _onReport(Map c) async {
    setState(() {
      _err = null;
      _notice = null;
    });
    final sonuc = await showModalBottomSheet<Map?>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReportSheet(comment: c),
    );
    if (sonuc == null || !mounted) return;
    setState(
      () => _notice = sonuc['already'] == true
          ? 'Bu yorumu zaten bildirmiştin; bildirimin duruyor.'
          : 'Bildirimin alındı ve incelenmek üzere kaydedildi.',
    );
  }

  Future<void> _onBlock(Map c) async {
    setState(() {
      _err = null;
      _notice = null;
    });
    final sonuc = await showDialog<Map?>(
      context: context,
      builder: (_) => _BlockDialog(comment: c),
    );
    if (sonuc == null || !mounted) return;
    setState(
      () => _notice = sonuc['already'] == true
          ? 'Bu kullanıcı zaten engelliydi.'
          : 'Kullanıcı engellendi. Yorumları artık sana görünmüyor.',
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AuthState>(
      valueListenable: authState,
      builder: (context, auth, _) {
        final girisli = auth.girisli;

        final tops = _comments.where((c) => c['parentId'] == null).toList();
        final replies = _comments.where((c) => c['parentId'] != null).toList();
        List<Map> repliesOf(Object? id) =>
            _comments.where((c) => c['parentId'] == id).toList();
        final popularCount = tops
            .where((c) => ((c['likeCount'] as num?) ?? 0) > 0)
            .length;

        final filters = [
          ('En Yeni', tops.length),
          ('En Popüler', popularCount),
          ('Cevaplar', replies.length),
        ];

        DateTime tarih(Map c) =>
            DateTime.tryParse('${c['createdAt']}') ?? DateTime(1970);
        var displayTops = tops.toList();
        if (_filter == 'En Popüler') {
          displayTops.sort((a, b) {
            final c = ((b['likeCount'] as num?) ?? 0).compareTo(
              (a['likeCount'] as num?) ?? 0,
            );
            return c != 0 ? c : tarih(b).compareTo(tarih(a));
          });
        } else if (_filter == 'Cevaplar') {
          displayTops =
              displayTops.where((c) => repliesOf(c['id']).isNotEmpty).toList()
                ..sort((a, b) => tarih(b).compareTo(tarih(a)));
        } else {
          displayTops.sort((a, b) => tarih(b).compareTo(tarih(a)));
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Yorumlar (${_comments.length})',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 16,
                fontWeight: AppFont.black,
              ),
            ),
            const SizedBox(height: 10),

            // Filtre çipleri
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final (key, count) in filters)
                  _filtreCipi(key, count, _filter == key),
              ],
            ),
            const SizedBox(height: 10),

            if (girisli) _composer() else const _GuestNote(),

            if (_err != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_err!, style: _errStil),
              ),

            // Moderasyon sonucu — dokununca kapanır.
            if (_notice != null)
              GestureDetector(
                onTap: () => setState(() => _notice = null),
                child: Container(
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.infoSoft,
                    borderRadius: AppRadius.smR,
                    border: Border.all(color: AppColors.info),
                  ),
                  child: Text(
                    _notice!,
                    style: const TextStyle(
                      color: AppColors.info,
                      fontSize: 12,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                ),
              ),

            if (_loading)
              Padding(
                padding: EdgeInsets.only(top: 16),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (displayTops.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  _filter == 'Cevaplar'
                      ? 'Henüz cevaplanan yorum yok.'
                      : 'Henüz yorum yok. İlk yorumu sen yaz! 👀',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                ),
              )
            else
              for (final c in displayTops) ...[
                _CommentCard(
                  comment: c,
                  depth: 0,
                  canAct: girisli,
                  onLike: _onLike,
                  onReply: (x) => setState(() => _replyTo = x),
                  onEdit: _onEdit,
                  onDelete: _onDelete,
                  onReport: _onReport,
                  onBlock: _onBlock,
                ),
                for (final r in repliesOf(c['id']))
                  _CommentCard(
                    comment: r,
                    depth: 1,
                    canAct: girisli,
                    onLike: _onLike,
                    onReply: (x) => setState(() => _replyTo = x),
                    onEdit: _onEdit,
                    onDelete: _onDelete,
                    onReport: _onReport,
                    onBlock: _onBlock,
                  ),
              ],
          ],
        );
      },
    );
  }

  Widget _filtreCipi(String key, int count, bool on) => GestureDetector(
    onTap: () => setState(() => _filter = key),
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: on ? AppColors.primary : AppColors.card,
        borderRadius: AppRadius.pillR,
        border: Border.all(color: on ? AppColors.primary : AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            key,
            style: TextStyle(
              color: on ? AppColors.onPrimary : AppColors.textSoft,
              fontSize: 12,
              fontWeight: AppFont.heavy,
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(
              color: on
                  ? AppColors.onPrimary.withValues(alpha: 0.2)
                  : AppColors.cardAlt,
              borderRadius: AppRadius.pillR,
            ),
            child: Text(
              '$count',
              style: TextStyle(
                color: on ? AppColors.onPrimary : AppColors.textSoft,
                fontSize: 10.5,
                fontWeight: AppFont.black,
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _composer() => Container(
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.mdR,
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_replyTo != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '↳ ${(_replyTo!['author'] as Map?)?['username'] ?? 'Kullanıcı'}'
                    ' kullanıcısına cevap',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 11.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ),
                Semantics(
                  button: true,
                  label: 'Yanıtı iptal et',
                  child: GestureDetector(
                    onTap: () => setState(() => _replyTo = null),
                    child: Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(
                        Icons.close,
                        size: 15,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        TextField(
          controller: _textCtl,
          maxLines: null,
          minLines: 2,
          maxLength: 500,
          buildCounter:
              (_, {required currentLength, required isFocused, maxLength}) =>
                  null,
          onChanged: (_) => setState(() {}),
          style: TextStyle(color: AppColors.text, fontSize: 13.5),
          decoration: InputDecoration(
            hintText: 'Bu maç hakkında ne düşünüyorsun?',
            hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 13.5),
            border: InputBorder.none,
            isDense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '${_textCtl.text.length}/500',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
            Opacity(
              opacity: (_posting || _textCtl.text.trim().isEmpty) ? 0.5 : 1,
              child: GestureDetector(
                onTap: (_posting || _textCtl.text.trim().isEmpty)
                    ? null
                    : _post,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: AppRadius.smR,
                  ),
                  child: Text(
                    _posting ? '...' : 'Gönder',
                    style: TextStyle(
                      color: AppColors.onPrimary,
                      fontSize: 13,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _GuestNote extends StatelessWidget {
  const _GuestNote();

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 6),
    child: Text(
      'Yorum yazmak ve beğenmek için Profil sekmesinden giriş yap. '
      'Yorumları herkes görebilir.',
      style: TextStyle(
        color: AppColors.textMuted,
        fontSize: 12,
        height: 17 / 12,
      ),
    ),
  );
}

class _CommentCard extends StatefulWidget {
  const _CommentCard({
    required this.comment,
    required this.depth,
    required this.canAct,
    required this.onLike,
    required this.onReply,
    required this.onEdit,
    required this.onDelete,
    required this.onReport,
    required this.onBlock,
  });

  final Map comment;
  final int depth;
  final bool canAct;
  final Future<void> Function(Map) onLike;
  final void Function(Map) onReply;
  final Future<void> Function(Map, String) onEdit;
  final Future<void> Function(Map) onDelete;
  final Future<void> Function(Map) onReport;
  final Future<void> Function(Map) onBlock;

  @override
  State<_CommentCard> createState() => _CommentCardState();
}

class _CommentCardState extends State<_CommentCard> {
  bool _editing = false;
  late final TextEditingController _ctl = TextEditingController(
    text: '${widget.comment['text'] ?? ''}',
  );

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final t = _ctl.text.trim();
    if (t.isNotEmpty && t != widget.comment['text']) {
      await widget.onEdit(widget.comment, t);
    }
    if (mounted) setState(() => _editing = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.comment;
    final mine = c['mine'] == true;
    final author = c['author'] as Map?;

    return Container(
      margin: EdgeInsets.only(top: 10, left: widget.depth > 0 ? 28 : 0),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: AppRadius.mdR,
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CommentAvatar(size: widget.depth > 0 ? 28 : 34, author: author),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        '${author?['username'] ?? 'Kullanıcı'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.text,
                          fontSize: 13,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '· ${timeAgo(c['createdAt'])}'
                      '${c['editedAt'] != null ? ' · düzenlendi' : ''}',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                if (_editing)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _ctl,
                        maxLines: null,
                        maxLength: 500,
                        buildCounter:
                            (
                              _, {
                              required currentLength,
                              required isFocused,
                              maxLength,
                            }) => null,
                        style: TextStyle(color: AppColors.text, fontSize: 13),
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: const EdgeInsets.all(8),
                          border: OutlineInputBorder(
                            borderRadius: AppRadius.smR,
                            borderSide: BorderSide(color: AppColors.border),
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _kucukDugme('Kaydet', dolu: true, onTap: _save),
                          const SizedBox(width: 8),
                          _kucukDugme(
                            'Vazgeç',
                            dolu: false,
                            onTap: () {
                              _ctl.text = '${c['text'] ?? ''}';
                              setState(() => _editing = false);
                            },
                          ),
                        ],
                      ),
                    ],
                  )
                else
                  Text(
                    '${c['text'] ?? ''}',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 13.5,
                      height: 19 / 13.5,
                    ),
                  ),

                // GİZLENMİŞ YORUM — sunucu bunu YALNIZ yazarına gönderir.
                // Yazarına göstermek şart: yoksa yorumu "kayboldu" sanır,
                // sebebini bilemez. Kaç kişinin bildirdiği burada da YAZMAZ.
                if (c['hidden'] == true)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: AppRadius.smR,
                      border: Border.all(color: AppColors.warning),
                    ),
                    child: Text(
                      '${c['hiddenNote'] ?? 'Bu yorum gizlendi. Şu an yalnız sen görüyorsun.'}',
                      style: TextStyle(
                        color: okunurMetin(AppColors.warningSoft),
                        fontSize: 11.5,
                        fontWeight: AppFont.bold,
                      ),
                    ),
                  ),

                const SizedBox(height: 6),
                Wrap(
                  spacing: 14,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    GestureDetector(
                      onTap: widget.canAct
                          ? () => widget.onLike(widget.comment)
                          : null,
                      behavior: HitTestBehavior.opaque,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            c['likedByMe'] == true
                                ? Icons.favorite
                                : Icons.favorite_border,
                            size: 15,
                            color: c['likedByMe'] == true
                                ? AppColors.red
                                : AppColors.textMuted,
                          ),
                          const SizedBox(width: 4),
                          Text('${c['likeCount'] ?? 0}', style: _metaTxt),
                        ],
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.visibility_outlined,
                          size: 14,
                          color: AppColors.textMuted,
                        ),
                        const SizedBox(width: 3),
                        Text('${c['viewCount'] ?? 0}', style: _metaTxt),
                      ],
                    ),
                    if (widget.canAct && widget.depth == 0)
                      _metaDugme(
                        'Cevapla',
                        () => widget.onReply(widget.comment),
                      ),
                    if (mine && !_editing) ...[
                      _metaDugme(
                        'Düzenle',
                        () => setState(() => _editing = true),
                      ),
                      _metaDugme(
                        'Sil',
                        () => widget.onDelete(widget.comment),
                        renk: AppColors.red,
                      ),
                    ],
                    // MODERASYON — yalnız BAŞKASININ yorumunda ve yalnız
                    // girişliyken. Kendi yorumunu bildirmek/kendini engellemek
                    // sunucuda da reddedilir; düğmeyi hiç göstermemek,
                    // reddedilecek bir yola sokmamaktır.
                    if (widget.canAct && !mine) ...[
                      _metaDugme(
                        'Bildir',
                        () => widget.onReport(widget.comment),
                      ),
                      _metaDugme(
                        'Engelle',
                        () => widget.onBlock(widget.comment),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaDugme(String etiket, VoidCallback onTap, {Color? renk}) =>
      GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Text(
          etiket,
          style: _metaTxt.copyWith(color: renk ?? AppColors.textMuted),
        ),
      );

  Widget _kucukDugme(
    String etiket, {
    required bool dolu,
    required VoidCallback onTap,
  }) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: dolu ? AppColors.primary : Colors.transparent,
        borderRadius: AppRadius.smR,
        border: Border.all(color: dolu ? AppColors.primary : AppColors.border),
      ),
      child: Text(
        etiket,
        style: TextStyle(
          color: dolu ? AppColors.onPrimary : AppColors.textSoft,
          fontSize: 12,
          fontWeight: AppFont.heavy,
        ),
      ),
    ),
  );
}

/// BİLDİRME PENCERESİ
///
/// Sebep listesi KAPALIDIR (serbest metin sebep olamaz) ve anahtarlar
/// `moderation_reasons.dart` üzerinden sunucuyla aynı tutulur.
///
/// Pencere, bildirimin SONUCUNU söz vermez.
class _ReportSheet extends StatefulWidget {
  const _ReportSheet({required this.comment});
  final Map comment;

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  String? _reason;
  final _noteCtl = TextEditingController();
  String? _err;
  bool _busy = false;

  @override
  void dispose() {
    _noteCtl.dispose();
    super.dispose();
  }

  Future<void> _gonder() async {
    setState(() {
      _err = null;
      _busy = true;
    });
    try {
      final r = await api.reportComment(
        widget.comment['id'] as Object,
        _reason,
        _noteCtl.text.trim(),
      );
      if (mounted) {
        Navigator.of(context).pop(r is Map ? Map<String, dynamic>.from(r) : {});
      }
    } catch (e) {
      // Hata pencerenin İÇİNDE gösterilir, pencere KAPANMAZ — kullanıcı
      // yazdığı açıklamayı kaybetmeden tekrar deneyebilsin diye.
      if (mounted) setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final zorunlu = aciklamaZorunluMu(_reason);
    final eksik = _reason == null || (zorunlu && _noteCtl.text.trim().isEmpty);
    final secili = kBildirimSebepleri
        .where((s) => s.key == _reason)
        .firstOrNull;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        padding: const EdgeInsets.all(Spacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Bu yorumu bildir',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 15,
                fontWeight: AppFont.black,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Bildirimin incelenmek üzere kaydedilir. Sonucu sana '
              'bildirilmez.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11.5,
                height: 16 / 11.5,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final s in kBildirimSebepleri)
                  GestureDetector(
                    onTap: () => setState(() => _reason = s.key),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: _reason == s.key
                            ? AppColors.primary
                            : AppColors.bgAlt,
                        borderRadius: AppRadius.pillR,
                        border: Border.all(
                          color: _reason == s.key
                              ? AppColors.primary
                              : AppColors.border,
                        ),
                      ),
                      child: Text(
                        s.label,
                        style: TextStyle(
                          color: _reason == s.key
                              ? AppColors.onPrimary
                              : AppColors.textSoft,
                          fontSize: 12,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            if (secili != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  secili.hint,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11.5,
                    height: 16 / 11.5,
                  ),
                ),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteCtl,
              maxLines: 3,
              maxLength: kNotSiniri,
              inputFormatters: [LengthLimitingTextInputFormatter(kNotSiniri)],
              onChanged: (_) => setState(() {}),
              style: TextStyle(color: AppColors.text, fontSize: 13),
              decoration: InputDecoration(
                hintText: zorunlu
                    ? 'Kısaca açıkla (zorunlu)'
                    : 'Eklemek istediğin bir şey var mı? (isteğe bağlı)',
                hintStyle: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12.5,
                ),
                border: OutlineInputBorder(
                  borderRadius: AppRadius.smR,
                  borderSide: BorderSide(color: AppColors.border),
                ),
                isDense: true,
              ),
            ),
            if (_err != null) Text(_err!, style: _errStil),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _busy ? null : () => Navigator.of(context).pop(),
                  child: Text(
                    'Vazgeç',
                    style: TextStyle(color: AppColors.textSoft),
                  ),
                ),
                const SizedBox(width: 8),
                Opacity(
                  opacity: (eksik || _busy) ? 0.5 : 1,
                  child: GestureDetector(
                    onTap: (eksik || _busy) ? null : _gonder,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 9,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: AppRadius.smR,
                      ),
                      child: _busy
                          ? SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.onPrimary,
                              ),
                            )
                          : Text(
                              'Gönder',
                              style: TextStyle(
                                color: AppColors.onPrimary,
                                fontSize: 13,
                                fontWeight: AppFont.black,
                              ),
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// ENGELLEME PENCERESİ — karşı tarafa bildirim GİTMEDİĞİ açıkça söylenir:
/// insanlar çoğu zaman bunu bilmediği için engellemekten çekinir.
class _BlockDialog extends StatefulWidget {
  const _BlockDialog({required this.comment});
  final Map comment;

  @override
  State<_BlockDialog> createState() => _BlockDialogState();
}

class _BlockDialogState extends State<_BlockDialog> {
  String? _err;
  bool _busy = false;

  Future<void> _uygula() async {
    setState(() {
      _err = null;
      _busy = true;
    });
    try {
      final uid = (widget.comment['author'] as Map?)?['id'];
      // Kimlik yoksa istek GÖNDERİLMEZ: sunucuya boş userId yollamak
      // "Kullanıcı bulunamadı." gibi YANILTICI bir hata döndürürdü.
      if (uid == null) throw Exception('Bu yorumun sahibi belirlenemedi.');
      final r = await api.blockUser(uid as Object);
      if (mounted) {
        Navigator.of(context).pop(r is Map ? Map<String, dynamic>.from(r) : {});
      }
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ad =
        (widget.comment['author'] as Map?)?['username'] ?? 'Bu kullanıcı';

    return AlertDialog(
      backgroundColor: AppColors.surface,
      title: Text(
        '$ad engellensin mi?',
        style: TextStyle(
          color: AppColors.text,
          fontSize: 15,
          fontWeight: AppFont.black,
        ),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Engellersen onun yorumlarını görmezsin, o da seninkileri '
            'göremez. Karşı tarafa bildirim gitmez. İstediğin zaman '
            'Profil → Engellenen Kullanıcılar ekranından geri alabilirsin.',
            style: TextStyle(
              color: AppColors.textSoft,
              fontSize: 12.5,
              height: 18 / 12.5,
            ),
          ),
          if (_err != null) Text(_err!, style: _errStil),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: Text('Vazgeç', style: TextStyle(color: AppColors.textSoft)),
        ),
        Opacity(
          opacity: _busy ? 0.5 : 1,
          child: GestureDetector(
            onTap: _busy ? null : _uygula,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              decoration: BoxDecoration(
                color: AppColors.danger,
                borderRadius: AppRadius.smR,
              ),
              child: _busy
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.white,
                      ),
                    )
                  : const Text(
                      'Engelle',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 13,
                        fontWeight: AppFont.black,
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _metaTxt => TextStyle(
  color: AppColors.textMuted,
  fontSize: 12,
  fontWeight: AppFont.bold,
);

const TextStyle _errStil = TextStyle(
  color: AppColors.danger,
  fontSize: 12,
  height: 17 / 12,
);
