// KAYNAK: app/src/screens/KriterKirilimScreen.js — BİREBİR çeviri.
//
// KRİTER MAÇ TABLOSU — ham veri, yorum yok (2026-08-07)
//
// KULLANICI TALİMATI (birebir): "Yorum katmayacaksın, olanı göstereceksin.
// 'Bu kriter burada başarılı' demeyecek — bunu ben tutan maçlardan kendim
// bakarak anlamam lazım."
//
// Bu yüzden ekranda YOK:
//   • "uzmanlık", "zayıf alan", "şurada iyi" gibi hiçbir hüküm
//   • bant adları ("ağır favori", "kalabalık kararlı") — türetilmiş etiketler
//   • hangi eksenin daha önemli olduğunu söyleyen açıklama paragrafları
//
// Ekranda VAR: kriterin yön söylediği her maç, ham değerleriyle tek tabloda.
//   Sıra · Maç · Oran (1/X/2) · Oynanma % (1/X/2) · Kriter · Sonuç · ✓/✗
//
// Araçlar (hüküm değil, süzgeç): tuttu / tutmadı filtresi ve sıralama.
// Yorumu kullanıcı yapar.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';

const List<(String, String)> _suzgecler = [
  ('hepsi', 'Hepsi'),
  ('tuttu', 'Tuttu'),
  ('tutmadi', 'Tutmadı'),
];

const List<(String, String)> _siralamalar = [
  ('hafta', 'Hafta'),
  ('sira', 'Sıra'),
  ('oran', 'Oran'),
  ('oynanma', 'Oynanma'),
];

/// Değeri yazar; yoksa "—". Sıfır uydurulmaz.
String _d(Object? v) => (v == null || v == '') ? '—' : '$v';

/// Üçlü değeri "a / b / c" biçiminde yazar.
String _uclu(Map? o, List<String> anahtarlar) {
  if (o == null) return '—';
  return anahtarlar.map((k) => _d(o[k])).join(' / ');
}

final _kirilimProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, key) async {
      final r = await api.analysisCriterionKirilim(key);
      return Map<String, dynamic>.from(r as Map);
    });

class KriterKirilimScreen extends ConsumerStatefulWidget {
  const KriterKirilimScreen({super.key, required this.kriterKey, this.ad});

  final String kriterKey;
  final String? ad;

  @override
  ConsumerState<KriterKirilimScreen> createState() =>
      _KriterKirilimScreenState();
}

class _KriterKirilimScreenState extends ConsumerState<KriterKirilimScreen> {
  String _suzgec = 'hepsi';
  String _sirala = 'hafta';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_kirilimProvider(widget.kriterKey));
    final veri = async.valueOrNull;

    final tumMaclar = ((veri?['maclar'] as List?) ?? const []).cast<Map>();
    final tuttu = tumMaclar.where((m) => m['dogru'] == true).length;
    final toplam = tumMaclar.length;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _baslikCubugu(veri, toplam, tuttu),
            _araclar(),
            Expanded(
              child: async.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Text(
                    '$e',
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontSize: 12.5,
                      height: 18 / 12.5,
                    ),
                  ),
                ),
                data: (v) => _liste(v, tumMaclar),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _baslikCubugu(Map? veri, int toplam, int tuttu) => Container(
    padding: const EdgeInsets.symmetric(
      horizontal: Spacing.md,
      vertical: Spacing.sm,
    ),
    decoration: const BoxDecoration(
      color: AppColors.surface,
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      children: [
        Semantics(
          button: true,
          label: 'Geri dön',
          child: GestureDetector(
            onTap: () => Navigator.of(context).maybePop(),
            behavior: HitTestBehavior.opaque,
            child: const SizedBox(
              width: 34,
              height: 34,
              child: Center(
                child: Text(
                  '‹',
                  style: TextStyle(
                    fontSize: 26,
                    color: AppColors.primary,
                    fontWeight: AppFont.heavy,
                    height: 1,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${veri?['ad'] ?? widget.ad ?? widget.kriterKey}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 15,
                  fontWeight: AppFont.black,
                ),
              ),
              Text(
                toplam > 0 ? '$toplam maçta $tuttu' : 'ölçülebilir maç yok',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11.5,
                  fontWeight: AppFont.bold,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _araclar() => Container(
    padding: const EdgeInsets.only(
      left: Spacing.md,
      right: Spacing.md,
      bottom: 8,
    ),
    decoration: const BoxDecoration(
      color: AppColors.surface,
      border: Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Column(
      children: [
        Row(
          children: [
            for (final (k, etiket) in _suzgecler) ...[
              Expanded(
                child: _dugme(
                  etiket: etiket,
                  acik: _suzgec == k,
                  buyuk: true,
                  onTap: () => setState(() => _suzgec = k),
                ),
              ),
              if (k != _suzgecler.last.$1) const SizedBox(width: 6),
            ],
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            for (final (k, etiket) in _siralamalar) ...[
              Expanded(
                child: _dugme(
                  etiket: etiket,
                  acik: _sirala == k,
                  buyuk: false,
                  onTap: () => setState(() => _sirala = k),
                  semantik: '$etiket sırala',
                ),
              ),
              if (k != _siralamalar.last.$1) const SizedBox(width: 6),
            ],
          ],
        ),
      ],
    ),
  );

  Widget _dugme({
    required String etiket,
    required bool acik,
    required bool buyuk,
    required VoidCallback onTap,
    String? semantik,
  }) => Semantics(
    button: true,
    label: semantik ?? etiket,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: EdgeInsets.symmetric(vertical: buyuk ? 6 : 5),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: acik ? AppColors.primary : AppColors.bgAlt,
          borderRadius: AppRadius.smR,
        ),
        child: Text(
          etiket,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: acik ? AppColors.white : AppColors.textSoft,
            fontSize: buyuk ? 12.5 : 11,
            fontWeight: buyuk ? AppFont.heavy : AppFont.bold,
          ),
        ),
      ),
    ),
  );

  Widget _liste(Map<String, dynamic> veri, List<Map> tumMaclar) {
    final maclar = _sirala_(tumMaclar);
    final kesildi = veri['kesildi'];

    return SingleChildScrollView(
      padding: const EdgeInsets.only(
        left: Spacing.md,
        right: Spacing.md,
        top: Spacing.md,
        bottom: Spacing.xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (maclar.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Bu süzgeçle maç yok.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            )
          else
            for (final m in maclar) _satir(m),
          if (kesildi != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                '$kesildi eski maç listeye sığmadı.',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Sıralama bir ARAÇTIR, hüküm değil. Eksik değer her zaman sona düşer;
  /// `Number(null) === 0` tuzağına düşmemek için açıkça elenir.
  List<Map> _sirala_(List<Map> tum) {
    var liste = tum.toList();
    if (_suzgec == 'tuttu') {
      liste = liste.where((m) => m['dogru'] == true).toList();
    }
    if (_suzgec == 'tutmadi') {
      liste = liste.where((m) => m['dogru'] != true).toList();
    }

    num? sayi(Object? v) {
      if (v is num) return v;
      if (v is String) return num.tryParse(v);
      return null;
    }

    num? enDusukOran(Map m) {
      final o = m['oran'] as Map?;
      if (o == null) return null;
      final x = [
        o['home'],
        o['draw'],
        o['away'],
      ].map(sayi).whereType<num>().toList();
      return x.length == 3 ? x.reduce((a, b) => a < b ? a : b) : null;
    }

    num? enYuksekOynanma(Map m) {
      final o = m['oynanma'] as Map?;
      if (o == null) return null;
      final x = [
        '1',
        'X',
        '2',
      ].map((k) => sayi(o[k])).whereType<num>().toList();
      return x.length == 3 ? x.reduce((a, b) => a > b ? a : b) : null;
    }

    final anahtar = switch (_sirala) {
      'hafta' => (Map m) => sayi(m['roundId']),
      'sira' => (Map m) => sayi(m['no']),
      'oran' => enDusukOran,
      _ => enYuksekOynanma,
    };

    liste.sort((a, b) {
      final x = anahtar(a);
      final y = anahtar(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1; // verisi olmayan sona
      if (y == null) return -1;
      if (_sirala == 'hafta') {
        final c = y.compareTo(x); // hafta: yeniden eskiye
        if (c != 0) return c;
        return (sayi(a['no']) ?? 0).compareTo(sayi(b['no']) ?? 0);
      }
      return x.compareTo(y);
    });

    return liste;
  }

  Widget _satir(Map m) {
    final dogru = m['dogru'] == true;
    const etiket = TextStyle(
      color: AppColors.textMuted,
      fontSize: 10.5,
      fontWeight: AppFont.semibold,
    );
    const bilgi = TextStyle(
      color: AppColors.text,
      fontSize: 11.5,
      fontWeight: AppFont.bold,
    );

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.smR,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Row(
              children: [
                SizedBox(
                  width: 18,
                  child: Text(
                    _d(m['no']),
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: AppFont.black,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '${m['ev'] ?? '—'} – ${m['deplasman'] ?? '—'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.text,
                      fontSize: 12.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  width: 18,
                  child: Text(
                    dogru ? '✓' : '✗',
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: AppFont.black,
                      color: dogru ? AppColors.success : AppColors.danger,
                    ),
                  ),
                ),
              ],
            ),
          ),
          RichText(
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            text: TextSpan(
              style: bilgi,
              children: [
                const TextSpan(text: 'Oran ', style: etiket),
                TextSpan(
                  text: _uclu(m['oran'] as Map?, const [
                    'home',
                    'draw',
                    'away',
                  ]),
                ),
                const TextSpan(text: '   Oynanma ', style: etiket),
                TextSpan(
                  text: _uclu(m['oynanma'] as Map?, const ['1', 'X', '2']),
                ),
              ],
            ),
          ),
          RichText(
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            text: TextSpan(
              style: bilgi,
              children: [
                const TextSpan(text: 'Kriter ', style: etiket),
                TextSpan(text: _d(m['sinyal'])),
                const TextSpan(text: '   Sonuç ', style: etiket),
                TextSpan(text: _d(m['sonuc'])),
                if (m['skor'] != null)
                  TextSpan(text: '  ${m['skor']}', style: etiket),
                TextSpan(text: '   ${_d(m['hafta'])}', style: etiket),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
