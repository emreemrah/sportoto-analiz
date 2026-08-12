// KAYNAK: app/src/screens/BulletinHistoryScreen.js +
//         app/src/components/BulletinCard.js +
//         app/src/hooks/useBulletinHistory.js  — BİREBİR çeviri.
//
// A) Geçmiş Bültenler Ekranı — bülten listesi, durum, kilitlenme zamanı,
// kaç maç oynandı/sonuçlandı, sistem ANA TAHMİN isabeti.
//
// KAYNAKTAN BİLİNÇLİ SAPMA (2026-08-11, tek ölçü kararı): karttaki sistem
// yüzdesi arşivin kupon-kapsaması özeti yerine backend KARNESİNDEN (tekli
// mühürlü ana tahmin) okunur — Sistem Karnesi ekranıyla aynı sayı.
//
// DEMO BANDI: kaynakta liste tümüyle örnek veriden geldiğinde görünüyordu.
// Bu çeviride demo kapısı DAİMA KAPALI (bkz. bulletin_history_service.dart),
// yani `_demo` işaretli öğe hiç üretilmez ve bant hiç görünmez. Koşul yine de
// duruyor: kapı açılırsa uyarı kendiliğinden geri gelsin.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/services/archive_client.dart';
import '../../core/services/bulletin_history_service.dart';
import '../../core/theme/tokens.dart';
import '../../core/types/bulletin.dart';
import '../../core/utils.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/states.dart';

class BulletinHistoryScreen extends StatefulWidget {
  const BulletinHistoryScreen({super.key});

  @override
  State<BulletinHistoryScreen> createState() => _BulletinHistoryScreenState();
}

class _BulletinHistoryScreenState extends State<BulletinHistoryScreen> {
  List<Map<String, dynamic>>? _bulletins;
  bool _loading = true;
  String? _error;

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
      final list = await listBulletins();
      // TEK ÖLÇÜ (2026-08-11, kullanıcı kararı): karttaki sistem yüzdesi
      // backend KARNESİNDEN okunur (tekli ana tahmin) — arşivin kupon
      // kapsaması sayısı (resultSummary) kullanıcıya gösterilmez. Karne
      // alınamazsa satır çizilmez; kupon sayısına DÜŞÜLMEZ (iki ölçü
      // karışmasın diye bilinçli).
      Map? karne;
      try {
        karne = await api.systemScorecard() as Map?;
      } catch (_) {
        karne = null;
      }
      final karneHaftalari = <String, Map>{
        for (final w in ((karne?['weeks'] as List?) ?? const []).cast<Map>())
          '${w['roundId']}': w,
      };
      // Eski kupon servisi kaldırıldı — kuponlar artık Kupon Merkezi'nde.
      if (mounted) {
        setState(
          () => _bulletins = [
            for (final b in list)
              {
                ...b,
                'myCoupon': null,
                '_karneHaftasi': karneHaftalari['${b['roundId']}'],
              },
          ],
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = humanArchiveError(e));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = _bulletins;
    // Liste KALICI ARŞİVDEN gelir. Demo bandı yalnız backend'e ulaşılamayıp
    // örnek veriye düşüldüğünde görünür (_demo işaretli).
    final isDemo =
        list != null &&
        list.isNotEmpty &&
        list.every((b) => b['_demo'] == true);

    Widget govde;
    if (_loading && list == null) {
      govde = LoadingState(message: 'Bülten geçmişi yükleniyor…');
    } else if (_error != null) {
      govde = SingleChildScrollView(
        padding: const EdgeInsets.symmetric(vertical: Spacing.lg),
        child: ErrorState(message: _error, onRetry: _reload),
      );
    } else if (list == null || list.isEmpty) {
      govde = SingleChildScrollView(
        padding: EdgeInsets.all(Spacing.md),
        child: EmptyState(
          icon: Icons.inbox_outlined,
          title: 'Henüz bülten yok',
          message: 'Geçmiş bülten bulunamadı.',
        ),
      );
    } else {
      govde = RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _reload,
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(
            Spacing.md,
            Spacing.md,
            Spacing.md,
            Spacing.xl,
          ),
          itemCount: list.length,
          itemBuilder: (context, i) => BulletinCard(
            bulletin: list[i],
            onTap: () => context.push('/bulten/gecmis/${list[i]['id']}'),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Bülten Geçmişi')),
      body: Column(
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
                  'Bülten Geçmişi',
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 20,
                    fontWeight: AppFont.heavy,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Her bültenin maç öncesi MÜHÜRLÜ analizi ve resmî sonuçları',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                ),
              ],
            ),
          ),
          if (isDemo)
            DemoDataBanner(
              note:
                  'Arşiv sunucusuna ulaşılamadı — aşağıdaki bültenler ÖRNEKTİR, gerçek arşiv verisi değildir.',
            ),
          Expanded(child: govde),
        ],
      ),
    );
  }
}

/// `components/BulletinCard.js`
///
/// Geçmiş Bültenler listesindeki kart: durum, tarih, kaç maç oynandı, sistem
/// başarı oranı ve (varsa) kullanıcının o bültendeki kupon sonucu.
class BulletinCard extends StatelessWidget {
  const BulletinCard({super.key, required this.bulletin, required this.onTap});

  final Map<String, dynamic> bulletin;
  final VoidCallback onTap;

  static const Map<String, String> _statusTone = {
    BulletinStatus.draft: 'default',
    BulletinStatus.active: 'info',
    BulletinStatus.locked: 'warning',
    BulletinStatus.completed: 'success',
    BulletinStatus.cancelled: 'danger',
  };

  @override
  Widget build(BuildContext context) {
    final d = matchDate(bulletin['date'] as String?);
    final total = (bulletin['matches'] as List?)?.length ?? 0;
    final finished = bulletin['_finishedCount'] ?? 0;
    // Karne haftası — listeyi yükleyen ekran ekler (_reload'daki tek ölçü
    // notu); resultSummary (kupon kapsaması) kartta KULLANILMAZ.
    final kw = bulletin['_karneHaftasi'];
    final myCoupon = bulletin['myCoupon'];
    final lockedAt = bulletin['lockedAt'];
    final durum = '${bulletin['status']}';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: Spacing.sm),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadius.lgR,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Bülten ${bulletin['bulletinNo']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 15,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Bilinmeyen durum etiketi UYDURULMAZ: sözlükte yoksa ham
                // değer gösterilir, satır kaybolmaz.
                Pill(
                  label: kBulletinStatusLabel[durum] ?? durum,
                  tone: _statusTone[durum] ?? 'default',
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${d.day}${d.time.isNotEmpty ? ' · ${d.time}' : ''}',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: AppFont.semibold,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '$finished/$total maç oynandı'
              '${lockedAt != null ? ' · Kilit: ${matchDate('$lockedAt').day}' : ''}',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11.5,
                fontWeight: AppFont.semibold,
              ),
            ),
            if (kw is Map && (kw['evaluated'] as num? ?? 0) > 0) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Sistem ana tahmini',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11.5,
                      fontWeight: AppFont.bold,
                    ),
                  ),
                  Text(
                    '%${kw['accuracy']} (${kw['correct']}/${kw['evaluated']})',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 11.5,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              ProgressBar(
                value: (kw['accuracy'] as num?) ?? 0,
                tone: _ton((kw['accuracy'] as num?) ?? 0),
              ),
            ] else
              Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text(
                  'Henüz sonuç yok',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            if (myCoupon is Map && myCoupon['resultSummary'] is Map)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '🎟️ Kuponum: ${(myCoupon['resultSummary'] as Map)['correct']}/${(myCoupon['resultSummary'] as Map)['total']} doğru',
                  style: const TextStyle(
                    color: AppColors.green,
                    fontSize: 12.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              )
            else if (myCoupon != null)
              Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  '🎟️ Kuponum kayıtlı · sonuç bekleniyor',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: AppFont.semibold,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  static String _ton(num acc) =>
      acc >= 60 ? 'success' : (acc >= 40 ? 'warning' : 'danger');
}
