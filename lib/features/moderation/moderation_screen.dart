// KAYNAK: app/src/screens/ModerationScreen.js — BİREBİR çeviri.
//
// ---------------------------------------------------------------------------
// İNCELEME EKRANI — yalnız operatör (E9 / Google Play üçüncü şart)
// ---------------------------------------------------------------------------
// Topluluk Kuralları sayfası "her bildirim elle incelenir" diye söz veriyor.
// Bu ekran, o sözü tutmanın yeridir: bekleyen bildirimleri listeler, yorumu
// GİZLE / GERİ AL, bildirimi YOK SAY.
//
// ═══ YETKİ UYGULAMADA DEĞİL, SUNUCUDA ═══
// Bu dosyada hiçbir e-posta, kullanıcı adı veya kimlik YAZILI DEĞİLDİR. Ekran
// açılırken `api.moderationAccess()` sorulur ve karar sunucudan gelir. Yetki
// listesi sunucu ortam değişkenlerindedir; uygulamanın paketine hiç girmez —
// Android paketi açılıp okunabilir bir dosyadır, oraya yazılan her şey herkese
// açıktır.
//
// Yetkisiz hesap buraya normalde HİÇ GELMEZ (Profil'deki giriş de aynı cevaba
// bağlıdır). Yine de gelirse ham bir 403 hatası değil, sade bir bilgi görür.
//
// ═══ GİZLİLİK ═══
// Sunucu bildiren kişinin kimliğini döndürmez; bu ekran da öyle bir alan
// okumaz. Operatör kararı verirken yorumun METNİNE, sebeplere ve nota bakar —
// kimin bildirdiğine değil.
//
// ═══ DÜRÜSTLÜK ═══
// Sayılar olduğu gibi yazılır. Silinmiş yoruma ait bildirimler ve listenin
// kesildiği durum ayrıca söylenir; "hepsi bu" izlenimi verilmez.

import 'package:flutter/material.dart';

import '../../core/moderation_reasons.dart';
import '../../core/moderation_view.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/screen_backdrop.dart';

const Map<String, Color> _rozetRengi = {
  'kirmizi': AppColors.red,
  'turuncu': AppColors.orange,
  'yesil': AppColors.green,
};

class ModerationScreen extends StatefulWidget {
  const ModerationScreen({super.key});

  @override
  State<ModerationScreen> createState() => _ModerationScreenState();
}

class _ModerationScreenState extends State<ModerationScreen> {
  /// null = bilinmiyor, {operator, sebep}
  Map<String, dynamic>? _yetki;
  Map<String, dynamic>? _veri;
  String? _hata;

  /// 'yorum:12' | 'bildirim:5'
  String? _mesgul;

  /// yok sayma onayı bekleyen bildirim
  Object? _onay;

  @override
  void initState() {
    super.initState();
    _yukle();
  }

  Future<void> _yukle() async {
    if (mounted) setState(() => _hata = null);
    try {
      final erisim = (await api.moderationAccess() as Map).cast<String, dynamic>();
      if (!mounted) return;
      setState(() => _yetki = erisim);
      // Yetki yoksa liste ucu HİÇ çağrılmaz: reddedilecek bir isteği yollamak,
      // sunucu kayıtlarını gereksiz 403'lerle doldurmaktan başka işe yaramaz.
      if (erisim['operator'] != true) {
        setState(() => _veri = null);
        return;
      }
      final v = (await api.moderationReports() as Map).cast<String, dynamic>();
      if (mounted) setState(() => _veri = v);
    } catch (e) {
      if (mounted) setState(() => _hata = '$e');
    }
  }

  // Her işlemden sonra liste YENİDEN OKUNUR. Ekranı yerel olarak güncellemek
  // daha hızlı görünürdü ama yanıltıcı olurdu: bir bildirimi yok saymak, eşiğin
  // altına düşen BAŞKA bir yorumu da görünür yapabilir. Doğru olan, sunucunun
  // yeni durumunu göstermektir.
  Future<void> _islet(String anahtar, Future<void> Function() calistir) async {
    setState(() {
      _mesgul = anahtar;
      _hata = null;
      _onay = null;
    });
    try {
      await calistir();
      await _yukle();
    } catch (e) {
      if (mounted) setState(() => _hata = '$e');
    } finally {
      if (mounted) setState(() => _mesgul = null);
    }
  }

  void _gizle(Object id) =>
      _islet('yorum:$id', () async => api.hideComment(id));
  void _geriAl(Object id) =>
      _islet('yorum:$id', () async => api.unhideComment(id));
  void _yokSay(Object id) =>
      _islet('bildirim:$id', () async => api.dismissReport(id));

  @override
  Widget build(BuildContext context) {
    final items = (_veri?['items'] as List?) ?? const [];
    final operator = _yetki?['operator'] == true;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('İnceleme')),
      body: ScreenBackdrop(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _yukle,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              Spacing.lg,
              Spacing.lg,
              Spacing.lg,
              Spacing.xl * 2,
            ),
            children: [
              const Text(
                'İnceleme',
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 22,
                  fontWeight: AppFont.heavy,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Bildirilen yorumlar burada elle incelenir. Kararın herkesi etkiler: gizlenen yorumu '
                'yazarı dışında kimse göremez. Bildirimi yapan kişinin kimliği bu ekranda gösterilmez.',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12.5,
                  height: 18 / 12.5,
                ),
              ),
              const SizedBox(height: Spacing.md),

              if (_hata != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: Spacing.sm),
                  child: Text(
                    _hata!,
                    style: const TextStyle(
                      color: AppColors.red,
                      fontSize: 13,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                ),

              if (_yetki == null && _hata == null)
                const Padding(
                  padding: EdgeInsets.only(top: Spacing.lg),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                ),

              if (_yetki != null && !operator) _yetkisizKutu(),

              if (operator && _veri == null && _hata == null)
                const Padding(
                  padding: EdgeInsets.only(top: Spacing.lg),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                ),

              if (operator && _veri != null) _ozetKutusu(),

              for (final raw in items) _kart(raw as Map),

              if (operator && _veri != null && items.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: Spacing.lg),
                  child: Text(
                    'Şu an incelenmeyi bekleyen yorum yok. Yeni bir bildirim geldiğinde burada görünür.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12.5,
                      height: 18 / 12.5,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _yetkisizKutu() => Container(
    margin: const EdgeInsets.only(top: Spacing.sm),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadius.md),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Bu ekran inceleme yetkisi ister.',
          style: TextStyle(
            color: AppColors.text,
            fontSize: 14.5,
            fontWeight: AppFont.heavy,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _yetki?['sebep'] == 'eposta-dogrulanmamis'
              ? 'Hesabın listede görünüyor ama e-posta adresin henüz doğrulanmamış. Doğruladıktan sonra bu ekran açılır.'
              : 'Hesabında inceleme yetkisi yok. Yorumları bildirme ve kullanıcı engelleme yolları herkese açıktır.',
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 13,
            height: 19 / 13,
          ),
        ),
      ],
    ),
  );

  Widget _ozetKutusu() => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.cardAlt,
      borderRadius: BorderRadius.circular(AppRadius.sm),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final s in ozetSatirlari(_veri))
          Text(
            s,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 12.5,
              height: 18 / 12.5,
            ),
          ),
      ],
    ),
  );

  Widget _kart(Map item) {
    final durum = gizlemeDurumu(item);
    final yorumMesgul = _mesgul == 'yorum:${item['commentId']}';
    final reports = (item['reports'] as List?) ?? const [];
    final sebepler = sebepOzeti(item['reasons'] as Map?);
    final eylemListesi = eylemler(item);

    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(child: _rozet(durum)),
              const SizedBox(width: 8),
              Text(
                bildirimOzeti(item),
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11.5,
                  fontWeight: AppFont.bold,
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              '${(item['author'] as Map?)?['username'] ?? ''}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 14.5,
                fontWeight: AppFont.heavy,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              'Yorum: ${tarihKisa(item['createdAt'])}'
              '${item['matchId'] != null ? '  ·  Maç: ${item['matchId']}' : ''}',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 11.5,
              ),
            ),
          ),

          // Yorum metni KISALTILMAZ: karar metnin tamamına bakılarak verilir.
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(Spacing.sm),
            decoration: BoxDecoration(
              color: AppColors.bgAlt,
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(
              '${item['text'] ?? ''}',
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 13.5,
                height: 20 / 13.5,
              ),
            ),
          ),

          if (sebepler.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                sebepler,
                style: const TextStyle(
                  color: AppColors.orange,
                  fontSize: 12,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),

          // Bildirimler — tek tek yok sayılabilir. Notlar, bildiren kişiyi
          // değil bildirimin GEREKÇESİNİ taşır.
          for (final raw in reports) _bildirimSatiri(raw as Map),

          // Yok sayma geri alınamaz; onay bu yüzden istenir.
          if (_onay != null &&
              reports.any((r) => (r as Map)['id'] == _onay))
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Yok sayılan bildirim listeden kalıcı olarak düşer; bu adım geri alınamaz.',
                style: TextStyle(
                  color: AppColors.red,
                  fontSize: 11.5,
                  height: 17 / 11.5,
                ),
              ),
            ),

          Padding(
            padding: const EdgeInsets.only(top: Spacing.md),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final e in eylemListesi)
                  _eylemDugmesi(e, yorumMesgul, item),
              ],
            ),
          ),
          // Her düğmenin ne yaptığı ALTINDA yazar: "Gizli Kalsın" adı tek
          // başına, kararın mühürlendiğini anlatmaz.
          for (final e in eylemListesi)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '${e.label}: ${e.aciklama}',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11.5,
                  height: 17 / 11.5,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _rozet(GizlemeDurumu durum) {
    final renk = _rozetRengi[durum.renk] ?? AppColors.muted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: renk),
      ),
      child: Text(
        durum.etiket,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: renk,
          fontSize: 11,
          fontWeight: AppFont.heavy,
        ),
      ),
    );
  }

  Widget _bildirimSatiri(Map r) {
    final id = r['id'];
    final bildirimMesgul = _mesgul == 'bildirim:$id';
    final onaydaMi = _onay == id;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.only(top: 8),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${sebepEtiketi(r['reason'])}  ·  ${tarihKisa(r['createdAt'])}',
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 12.5,
                    fontWeight: AppFont.bold,
                  ),
                ),
                if (r['note'] != null && '${r['note']}'.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      '“${r['note']}”',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                        height: 17 / 12,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (onaydaMi)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _kucukDugme(
                  'Evet, yok say',
                  bildirimMesgul ? null : () => _yokSay(id as Object),
                  tehlike: true,
                ),
                const SizedBox(width: 6),
                _kucukDugme('Vazgeç', () => setState(() => _onay = null)),
              ],
            )
          else
            _kucukDugme(
              'Yok say',
              bildirimMesgul ? null : () => setState(() => _onay = id),
              mesgul: bildirimMesgul,
            ),
        ],
      ),
    );
  }

  Widget _kucukDugme(
    String metin,
    VoidCallback? onTap, {
    bool tehlike = false,
    bool mesgul = false,
  }) =>
      GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            border: Border.all(
              color: tehlike ? AppColors.red : AppColors.border,
            ),
          ),
          child: mesgul
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primary,
                  ),
                )
              : Text(
                  metin,
                  style: TextStyle(
                    color: tehlike ? AppColors.red : AppColors.textSoft,
                    fontSize: 11.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
        ),
      );

  Widget _eylemDugmesi(ModEylem e, bool mesgul, Map item) => GestureDetector(
    onTap: mesgul
        ? null
        : () => e.key == 'hide'
            ? _gizle(item['commentId'] as Object)
            : _geriAl(item['commentId'] as Object),
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: e.tehlike ? AppColors.dangerSoft : null,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(
          color: e.tehlike ? AppColors.red : AppColors.primary,
        ),
      ),
      child: mesgul
          ? const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.primary,
              ),
            )
          : Text(
              e.label,
              style: TextStyle(
                color: e.tehlike ? AppColors.red : AppColors.primary,
                fontSize: 12.5,
                fontWeight: AppFont.heavy,
              ),
            ),
    ),
  );
}
