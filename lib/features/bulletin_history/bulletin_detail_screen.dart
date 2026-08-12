// KAYNAK: app/src/screens/BulletinDetailScreen.js +
//         app/src/hooks/useBulletinHistory.js → useBulletinDetail
// BİREBİR çeviri.
//
// B) Bülten Detay Ekranı — sekmeli: Maçlar / Kilitli Analiz / Kuponum /
// Sonuçlar / Sistem Karnesi. Hem aktif hem geçmiş bültenler için kullanılır.
//
// EKRANIN TAŞIDIĞI KURAL: mühürlü analiz ile resmî sonuç AYRI kayıtlardır.
// Sonuç, analizi geriye dönük DEĞİŞTİRMEZ; ekran ikisini yan yana gösterir.

import 'package:flutter/material.dart';

import '../../core/services/archive_client.dart';
import '../../core/services/bulletin_history_service.dart';
import '../../core/theme/tokens.dart';
import '../../core/types/bulletin.dart';
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/states.dart';
import '../../widgets/tabs.dart';
import 'history_widgets.dart';

const List<String> _tabNames = [
  'Maçlar',
  'Kilitli Analiz',
  'Kuponum',
  'Sonuçlar',
  'Sistem Karnesi',
];

class BulletinDetailScreen extends StatefulWidget {
  const BulletinDetailScreen({super.key, required this.bulletinId});

  final Object bulletinId;

  @override
  State<BulletinDetailScreen> createState() => _BulletinDetailScreenState();
}

class _BulletinDetailScreenState extends State<BulletinDetailScreen> {
  Map<String, dynamic>? _bulletin;
  Map<String, dynamic>? _snapshot;
  bool _loading = true;
  String? _error;
  String _tab = _tabNames[0];

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Kaynakta Promise.all — ikisi PARALEL istenir. Snapshot yoksa (aktif
      // bülten) null döner ve bu bir hata DEĞİLDİR.
      final sonuclar = await Future.wait([
        getBulletinById(widget.bulletinId),
        getSnapshot(widget.bulletinId),
      ]);
      final bulletin = sonuclar[0];
      if (bulletin == null) throw Exception('Bülten bulunamadı.');
      if (!mounted) return;
      setState(() {
        _bulletin = bulletin;
        _snapshot = sonuclar[1];
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = humanArchiveError(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = _bulletin;

    if (_loading && b == null) {
      return _kabuk(const LoadingState(message: 'Bülten detayı yükleniyor…'));
    }
    if (_error != null) {
      return _kabuk(
        SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: Spacing.lg),
          child: ErrorState(message: _error, onRetry: _reload),
        ),
      );
    }
    if (b == null) return _kabuk(const SizedBox.shrink());

    final snap = _snapshot;
    final sealed = snap != null && snap['isLocked'] == true;
    final shortHash = snap?['shortHash'];
    final lockedAt = b['lockedAt'];
    final freezeAt = b['freezeAt'];
    final durum = '${b['status']}';

    final altSatir = StringBuffer(kBulletinStatusLabel[durum] ?? durum);
    if (lockedAt != null) {
      final d = matchDate('$lockedAt');
      altSatir.write(' · Kilit: ${d.day} ${d.time}');
    }
    // TEK ÖLÇÜ (2026-08-11): başlıktaki 'Sistem: X/Y' kupon kapsaması
    // sayısıydı — karneyle çelişen yüzdelerin kaynaklarından biri. Kaldırıldı;
    // sistem başarısı yalnız 'Sistem Karnesi' sekmesinde (tekli) yazar.

    return _kabuk(
      Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(Spacing.lg),
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bülten ${b['bulletinNo']}',
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 18,
                    fontWeight: AppFont.heavy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  altSatir.toString(),
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                ),
                if (sealed)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      '🔏 Mühürlü Analiz — bu bültenin tahmin ve analizleri değiştirilemez'
                      '${shortHash != null ? ' · Doğrulama: #$shortHash' : ''}',
                      style: const TextStyle(
                        color: AppColors.green,
                        fontSize: 11.5,
                        fontWeight: AppFont.heavy,
                        height: 15 / 11.5,
                      ),
                    ),
                  )
                else if (freezeAt != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      '🔒 Analizler ${matchDate('$freezeAt').day} ${matchDate('$freezeAt').time} itibarıyla kilitlenecek',
                      style: const TextStyle(
                        color: AppColors.orange,
                        fontSize: 11.5,
                        fontWeight: AppFont.heavy,
                        height: 15 / 11.5,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (b['_demo'] == true)
            const DemoDataBanner(
              note:
                  'Arşiv sunucusuna ulaşılamadı — bu bülten detayı ÖRNEK veridir, gerçek Spor Toto bülteni/sonucu değildir.',
            ),
          AppTabs(
            tabs: _tabNames,
            active: _tab,
            onChange: (t) => setState(() => _tab = t),
          ),
          Expanded(child: _icerik(b, snap)),
        ],
      ),
    );
  }

  Widget _kabuk(Widget govde) => Scaffold(
    appBar: AppBar(title: const Text('Bülten Detayı')),
    body: govde,
  );

  Widget _icerik(Map<String, dynamic> b, Map<String, dynamic>? snap) =>
      switch (_tab) {
        'Maçlar' => _maclarSekmesi(b),
        'Kilitli Analiz' => _kilitliAnalizSekmesi(b, snap),
        'Kuponum' => _kuponSekmesi(),
        'Sonuçlar' => _sonuclarSekmesi(b, snap),
        _ => _sistemKarnesiSekmesi(snap),
      };

  static const _listPad = EdgeInsets.fromLTRB(
    Spacing.md,
    Spacing.md,
    Spacing.md,
    Spacing.xl,
  );

  Widget _maclarSekmesi(Map<String, dynamic> b) {
    final matches = (b['matches'] as List?) ?? const [];
    return ListView.builder(
      padding: _listPad,
      itemCount: matches.length,
      itemBuilder: (_, i) =>
          MatchPredictionRow(match: matches[i] as Map, analysis: null),
    );
  }

  Widget _kilitliAnalizSekmesi(
    Map<String, dynamic> b,
    Map<String, dynamic>? snap,
  ) {
    if (snap == null) {
      final freezeAt = b['freezeAt'];
      final f = freezeAt != null ? matchDate('$freezeAt') : null;
      return SingleChildScrollView(
        padding: _listPad,
        child: EmptyState(
          icon: '🔒',
          title: 'Analiz henüz mühürlenmedi',
          message: f != null
              ? 'Analizler ${f.day} ${f.time} itibarıyla (ilk maçtan 5 dk önce) kilitlenecek ve arşive mühürlenecek.'
              : 'Bu bülten için henüz bir analiz kaydı oluşmadı.',
        ),
      );
    }

    final matches = (b['matches'] as List?) ?? const [];
    final analizler = (snap['matchesAnalysis'] as List?) ?? const [];
    final lockedAt = snap['lockedAt'];
    final lockD = lockedAt != null ? matchDate('$lockedAt') : null;
    final shortHash = snap['shortHash'];

    final not = snap['isLocked'] == true
        ? '🔏 Mühürlü Analiz${lockD != null ? ' · ${lockD.day} ${lockD.time}' : ''} '
              '— maçlar başlamadan önce donduruldu; bu bültenin tahmin ve analizleri '
              'değiştirilemez. Sonradan gelen skor/istatistik bu kayda işlemez.'
              '${shortHash != null ? ' Doğrulama: #$shortHash' : ''}'
        : '🔓 Analiz henüz düzenlenebilir (ilk maç başlamadı).';

    return ListView.builder(
      padding: _listPad,
      itemCount: matches.length + 1,
      itemBuilder: (_, i) {
        if (i == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: Spacing.sm),
            child: Text(
              not,
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontStyle: FontStyle.italic,
                height: 17 / 12,
              ),
            ),
          );
        }
        final m = matches[i - 1] as Map;
        Map? analiz;
        for (final a in analizler) {
          if ('${(a as Map)['matchId']}' == '${m['id']}') {
            analiz = a;
            break;
          }
        }
        return MatchPredictionRow(match: m, analysis: analiz);
      },
    );
  }

  /// ESKİ demo kupon akışı KALDIRILDI. Kuponlar artık tek yerden, GERÇEK
  /// veriyle çalışan Kupon Merkezi'nden yönetilir (alt bar → Kuponlarım).
  Widget _kuponSekmesi() => const SingleChildScrollView(
    padding: _listPad,
    child: EmptyState(
      icon: '🎟️',
      title: "Kuponlar Kupon Merkezi'nde",
      message:
          'Kupon oluşturma, sonuç ve paylaşım artık alt bardaki Kuponlarım (Kupon Merkezi) bölümünde — gerçek veriyle çalışır, demo kupon üretilmez.',
    ),
  );

  Widget _sonuclarSekmesi(Map<String, dynamic> b, Map<String, dynamic>? snap) {
    if (snap == null) {
      return const SingleChildScrollView(
        padding: _listPad,
        child: EmptyState(
          icon: '📭',
          title: 'Sonuç yok',
          message: 'Bu hafta için analiz/sonuç kaydı yok.',
        ),
      );
    }

    final rows = [
      for (final m in (snap['matchesAnalysis'] as List?) ?? const [])
        if ((m as Map)['resultInfo'] is Map &&
            (m['resultInfo'] as Map)['actualResult'] != null)
          m,
    ];

    if (rows.isEmpty) {
      return const SingleChildScrollView(
        padding: _listPad,
        child: EmptyState(
          icon: '⏳',
          title: 'Resmî sonuçlar henüz açıklanmadı',
          message:
              'Resmî 90 dakika sonuçları (1/X/2) geldikçe burada görünecek.',
        ),
      );
    }

    final ts = rows.first['dataTimestamp'];
    final dataD = ts != null ? matchDate('$ts') : null;
    final matches = (b['matches'] as List?) ?? const [];

    return ListView.builder(
      padding: _listPad,
      itemCount: rows.length + 1,
      itemBuilder: (_, i) {
        if (i == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: Spacing.sm),
            child: Text(
              'Soldaki tahminler ${dataD != null ? '${dataD.day} ${dataD.time}' : 'kilit anı'} '
              'verisiyle MÜHÜRLENMİŞ hali; sağdaki sonuçlar resmî Spor Toto 90 dk '
              'sonucudur. İkisi ayrı kayıtlarda tutulur — sonuç, analizi geriye '
              'dönük değiştirmez.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontStyle: FontStyle.italic,
                height: 17 / 12,
              ),
            ),
          );
        }
        final item = rows[i - 1];
        Map? match;
        for (final m2 in matches) {
          if ('${(m2 as Map)['id']}' == '${item['matchId']}') {
            match = m2;
            break;
          }
        }
        final ri = item['resultInfo'] as Map;
        // TEK ÖLÇÜ (2026-08-11): tik TEKLİ ana tahmine göredir (karneyle
        // aynı kural). Ana tahmin mühürde yoksa kupon önerisi tiksiz görünür
        // — "yanlış" denmez, değerlendirmeye girmez.
        return ResultComparisonCard(
          orderNo: match?['orderNo'] ?? item['orderNo'],
          homeTeam: (match?['homeTeam'] as Map?)?['name'] as String?,
          awayTeam: (match?['awayTeam'] as Map?)?['name'] as String?,
          userPick: null,
          systemPick: (item['anaTahmin'] ?? item['prediction']) as String?,
          actualResult: ri['actualResult'] as String?,
          isCorrect: ri['anaTahminCorrect'] as bool?,
        );
      },
    );
  }

  Widget _sistemKarnesiSekmesi(Map<String, dynamic>? snap) {
    if (snap == null) {
      return const SingleChildScrollView(
        padding: _listPad,
        child: EmptyState(
          icon: '📊',
          title: 'Veri yok',
          message: 'Bu bülten için sistem karnesi oluşmadı.',
        ),
      );
    }

    // TEK ÖLÇÜ (2026-08-11): bu sekme TEKLİ mühürlü ana tahmini sayar —
    // Sistem Karnesi ekranıyla AYNI kural, aynı sayı. (Önceden çoklu kupon
    // kapsamasını sayıyordu; karneyle çelişen %93/%36 karmaşasının
    // kaynağıydı.) anaTahminCorrect null ise maç değerlendirilmemiştir;
    // paydaya katılmaz — katsaydı oran yapay düşerdi.
    final resolved = [
      for (final m in (snap['matchesAnalysis'] as List?) ?? const [])
        if ((m as Map)['resultInfo'] is Map &&
            (m['resultInfo'] as Map)['anaTahminCorrect'] != null)
          m,
    ];

    if (resolved.isEmpty) {
      return const SingleChildScrollView(
        padding: _listPad,
        child: EmptyState(
          icon: '⏳',
          title: 'Henüz sonuç yok',
          message: 'Maçlar sonuçlandıkça sistem karnesi burada oluşacak.',
        ),
      );
    }

    final correct = resolved
        .where((m) => (m['resultInfo'] as Map)['anaTahminCorrect'] == true)
        .length;
    final rate = (correct / resolved.length * 100).round();
    final wrong = resolved.length - correct;

    final errorCounts = <String, int>{};
    for (final m in resolved) {
      final ri = m['resultInfo'] as Map;
      final tag = ri['errorTag'];
      if (ri['anaTahminCorrect'] != true && tag != null) {
        errorCounts['$tag'] = (errorCounts['$tag'] ?? 0) + 1;
      }
    }

    return ListView(
      padding: _listPad,
      children: [
        DashboardChartCard(
          title: 'Ana tahmin başarısı: $correct/${resolved.length} (%$rate)',
          rows: [(label: 'Doğru oran', value: rate, color: AppColors.green)],
        ),
        if (errorCounts.isNotEmpty)
          DashboardChartCard(
            title: 'Hata dağılımı',
            rows: [
              for (final e in errorCounts.entries)
                (
                  label: '${kErrorTagLabel[e.key] ?? e.key} (${e.value})',
                  value: wrong > 0 ? (e.value / wrong * 100).round() : 0,
                  color: AppColors.red,
                ),
            ],
          ),
      ],
    );
  }
}
