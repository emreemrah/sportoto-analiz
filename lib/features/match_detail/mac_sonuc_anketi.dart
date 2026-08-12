// MAÇ SONUCU ANKETİ (kullanıcı isteği, 2026-08-11)
//
// Her maç detayında o maça ÖZEL 1/X/2 anketi. Seçenekler açılan maçın kendi
// takımlarından üretilir ("{ev} kazanır" · "Berabere biter" · "{dep} kazanır").
//
// ═══════════ TEMEL KURAL: OY VERMEDEN SONUÇ GÖRÜNMEZ ══════════════════════
// Kullanıcı bunu açıkça istedi: "kendi tahminini seçmeden önce anketin toplam
// katılımı, seçeneklerin oy sayıları ve yüzdeleri KESİNLİKLE görünmesin."
// Bu yüzden oy verilmeden önce ekranda hiçbir sayı, yüzde, çubuk ya da katılım
// bilgisi ÇİZİLMEZ — yalnız seçenekler durur. Sonuçlar oydan sonra açılır.
//
// (Referans Screenshot_14'te katılım sayısı oy vermeden de görünüyordu;
// kullanıcının kuralı referansın önündedir ve bilerek ayrılındı.)
//
// ═══════════ BACKEND SÖZLEŞMESİ — DEĞERLER UYDURULAMAZ ════════════════════
// GET  /api/predictions/poll?matchId=X  → { results: { <pollKey>: { total,
//      options } }, mine: { <pollKey>: seçim } }   (giriş şart değil)
// POST /api/predictions/poll            → { matchId, pollKey, selectedOption }
//      (giriş ŞART; kayıt `match_id,user_id,poll_key` üzerinde upsert edilir,
//      yani kullanıcı başına TEK oy tutulur.)
//
// ANAHTAR VE SEÇENEK ADLARI SABİTTİR: backend'in `/ms-summary` ucu yalnız
// `poll_key = 'ms'` satırlarını okur ve seçenekleri `home` / `draw` / `away`
// diye sayar (routes/predictions.js). Buraya '1'/'X'/'2' yazılsaydı oylar
// kaydedilir ama o özet onları SESSİZCE sayamazdı — sayı hiç artmazdı ve
// sebebi görünmezdi. Ekranda 1/X/2 yazar, telde home/draw/away gider.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth.dart' as auth;
import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../widgets/tabs.dart';

/// Backend'in beklediği anket anahtarı.
const String kAnketAnahtari = 'ms';

/// (telde giden değer, ekranda görünen kısa ad)
const List<(String kod, String kisa)> kAnketSecenekleri = [
  ('home', '1'),
  ('draw', 'X'),
  ('away', '2'),
];

/// Bir maçın anket durumu.
class AnketDurumu {
  const AnketDurumu({
    required this.toplam,
    required this.sayilar,
    this.benimSecim,
  });

  /// Toplam oy sayısı.
  final int toplam;

  /// Seçenek kodu → oy sayısı.
  final Map<String, int> sayilar;

  /// Bu kullanıcının seçimi; oy vermediyse null.
  final String? benimSecim;

  bool get oyVerdim => benimSecim != null;

  int sayi(String kod) => sayilar[kod] ?? 0;

  /// Yüzde — toplam 0 iken bölme yapılmaz.
  int yuzde(String kod) =>
      toplam <= 0 ? 0 : ((sayi(kod) / toplam) * 100).round();
}

final macAnketiProvider = FutureProvider.autoDispose
    .family<AnketDurumu, Object>((ref, matchId) async {
      final ham = await api.getPoll(matchId);
      final m = Map<String, dynamic>.from(ham as Map);
      final sonuc = (m['results'] as Map?)?[kAnketAnahtari] as Map?;
      final secenekler = (sonuc?['options'] as Map?) ?? const {};
      final benim = (m['mine'] as Map?)?[kAnketAnahtari];

      return AnketDurumu(
        toplam: (sonuc?['total'] as num?)?.toInt() ?? 0,
        sayilar: {
          for (final e in secenekler.entries)
            '${e.key}': (e.value as num?)?.toInt() ?? 0,
        },
        benimSecim: benim is String && benim.isNotEmpty ? benim : null,
      );
    });

class MacSonucAnketi extends ConsumerStatefulWidget {
  const MacSonucAnketi({
    super.key,
    required this.matchId,
    required this.homeName,
    required this.awayName,
    this.macBasladi = false,
  });

  final Object matchId;
  final String homeName;
  final String awayName;

  /// Maç başladıysa backend oy kabul etmez (409). Ekran bunu önden söyler.
  final bool macBasladi;

  @override
  ConsumerState<MacSonucAnketi> createState() => _MacSonucAnketiState();
}

class _MacSonucAnketiState extends ConsumerState<MacSonucAnketi> {
  bool _gonderiliyor = false;
  String? _hata;

  String _etiket(String kod) => switch (kod) {
    'home' => '${widget.homeName} kazanır',
    'draw' => 'Berabere biter',
    _ => '${widget.awayName} kazanır',
  };

  Future<void> _oyVer(String kod) async {
    setState(() {
      _gonderiliyor = true;
      _hata = null;
    });
    try {
      await api.savePoll({
        'matchId': widget.matchId,
        'pollKey': kAnketAnahtari,
        'selectedOption': kod,
      });
      // Sayılar sunucudan YENİDEN okunur; yerelde artırılmaz. Kendi oyunu
      // ekleyip beklenen sayıyı çizmek, başkalarının o sırada verdiği oyları
      // atlayan bir tahmin olurdu.
      ref.invalidate(macAnketiProvider(widget.matchId));
    } on ApiException catch (e) {
      setState(() => _hata = _hataMetni(e));
    } catch (_) {
      setState(() => _hata = 'Oyun kaydedilemedi — bağlantıyı kontrol edin.');
    } finally {
      if (mounted) setState(() => _gonderiliyor = false);
    }
  }

  /// Sunucunun kendi mesajı varsa o gösterilir; yoksa duruma göre açık bir
  /// cümle yazılır. "Bir hata oluştu" demek sebebi gizlemek olurdu.
  String _hataMetni(ApiException e) => switch (e.status) {
    401 || 403 => 'Oy vermek için giriş yapmalısın.',
    409 => e.message.isNotEmpty ? e.message : 'Maç başladı — anket kapandı.',
    _ => e.message.isNotEmpty ? e.message : 'Oyun kaydedilemedi.',
  };

  @override
  Widget build(BuildContext context) {
    final girisli = auth.authState.value.girisli;
    final async = ref.watch(macAnketiProvider(widget.matchId));

    return SectionCard(
      title: '🗳️  Maç Sonucu Anketi',
      child: async.when(
        loading: () => Padding(
          padding: EdgeInsets.symmetric(vertical: 14),
          child: Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.primary,
              ),
            ),
          ),
        ),
        // Anket okunamadıysa "oy yok" denmez; okunamadığı söylenir.
        error: (e, _) => Text(
          'Anket şu an okunamadı: ${e is ApiException ? e.message : e}',
          style: _bos,
        ),
        data: (durum) => _govde(durum, girisli),
      ),
    );
  }

  Widget _govde(AnketDurumu durum, bool girisli) {
    // OY VERİLDİYSE → sonuçlar. Tek yol budur; başka hiçbir durumda sayı
    // çizilmez.
    if (durum.oyVerdim) return _sonuclar(durum);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          girisli
              ? 'Sence bu maç nasıl biter? Oyunu verdikten sonra herkesin '
                    'dağılımını görürsün.'
              : 'Oy vermek ve dağılımı görmek için giriş yapman gerekiyor.',
          style: _ipucu,
        ),
        const SizedBox(height: Spacing.md),
        for (final (kod, kisa) in kAnketSecenekleri) ...[
          _SecenekDugmesi(
            kod: kod,
            kisa: kisa,
            etiket: _etiket(kod),
            // Maç başladıysa ya da giriş yoksa dokunuş kapalıdır; sunucu da
            // reddederdi, ekran önceden dürüst davranır.
            onTap: (!girisli || widget.macBasladi || _gonderiliyor)
                ? null
                : () => _oyVer(kod),
          ),
          const SizedBox(height: 8),
        ],
        if (widget.macBasladi)
          Text('Maç başladı — anket kapandı.', style: _bos),
        if (_hata != null) Text(_hata!, style: _bos),
      ],
    );
  }

  Widget _sonuclar(AnketDurumu durum) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (kod, kisa) in kAnketSecenekleri) ...[
          _SonucSatiri(
            kisa: kisa,
            etiket: _etiket(kod),
            sayi: durum.sayi(kod),
            yuzde: durum.yuzde(kod),
            benimSecimim: durum.benimSecim == kod,
          ),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 2),
        Text(
          'Toplam ${durum.toplam} oy · senin seçimin '
          '${kAnketSecenekleri.firstWhere((s) => s.$1 == durum.benimSecim).$2}',
          style: _ipucu,
        ),
        Padding(
          padding: EdgeInsets.only(top: 4),
          child: Text(
            'Oyunu bir kez kullanabilirsin; sayılar bu maçın gerçek oylarından '
            'gelir.',
            style: _bos,
          ),
        ),
      ],
    );
  }
}

/// Oy vermeden önceki seçenek. Üzerinde HİÇBİR sayı yoktur.
class _SecenekDugmesi extends StatelessWidget {
  const _SecenekDugmesi({
    required this.kod,
    required this.kisa,
    required this.etiket,
    required this.onTap,
  });

  final String kod;
  final String kisa;
  final String etiket;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    enabled: onTap != null,
    label: etiket,
    child: GestureDetector(
      key: Key('anket-secenek-$kod'),
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.55 : 1,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.md,
            vertical: 13,
          ),
          decoration: BoxDecoration(
            color: AppColors.bgAlt,
            borderRadius: AppRadius.mdR,
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: AppRadius.smR,
                ),
                child: Text(
                  kisa,
                  style: TextStyle(
                    color: AppColors.onPrimary,
                    fontSize: 12.5,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
              const SizedBox(width: Spacing.md),
              Expanded(
                child: Text(
                  etiket,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 13.5,
                    fontWeight: AppFont.semibold,
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

/// Oydan sonraki sonuç satırı: sayı + yüzde + oranlı çubuk.
class _SonucSatiri extends StatelessWidget {
  const _SonucSatiri({
    required this.kisa,
    required this.etiket,
    required this.sayi,
    required this.yuzde,
    required this.benimSecimim,
  });

  final String kisa;
  final String etiket;
  final int sayi;
  final int yuzde;
  final bool benimSecimim;

  @override
  Widget build(BuildContext context) {
    final renk = benimSecimim ? AppColors.accent : AppColors.primary;

    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgAlt,
        borderRadius: AppRadius.mdR,
        border: Border.all(
          color: benimSecimim ? AppColors.accent : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                kisa,
                style: TextStyle(
                  color: renk,
                  fontSize: 13,
                  fontWeight: AppFont.black,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  etiket,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 13,
                    fontWeight: AppFont.semibold,
                  ),
                ),
              ),
              if (benimSecimim)
                Padding(
                  padding: EdgeInsets.only(right: 6),
                  child: Icon(Icons.check, size: 15, color: AppColors.accent),
                ),
              Text(
                '$sayi oy · %$yuzde',
                style: TextStyle(
                  color: renk,
                  fontSize: 12.5,
                  fontWeight: AppFont.heavy,
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          // Oran çubuğu: `Row` dikeyde merkezlediği için çocuksuz kutu sıfır
          // yükseklik alırdı (aynı tuzak istatistik kartlarında yaşandı).
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: SizedBox(
              height: 7,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (yuzde > 0)
                    Expanded(
                      flex: yuzde,
                      child: ColoredBox(color: renk),
                    ),
                  if (yuzde < 100)
                    Expanded(
                      flex: 100 - yuzde,
                      child: ColoredBox(color: AppColors.border),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _ipucu =>
    TextStyle(color: AppColors.textSoft, fontSize: 12, height: 16 / 12);

// GETTER: dosya düzeyi değişken Dart'ta bir kez hesaplanır ve takım
// teması değişince ESKİ renkte donardı (2026-08-12, emülatörde görüldü).
TextStyle get _bos =>
    TextStyle(color: AppColors.textMuted, fontSize: 11.5, height: 16 / 11.5);
