// KAYNAK: app/src/components/SnapshotSealBanner.js — BİREBİR çeviri.
//
// Bülten ekranındaki mühür durumu şeridi:
//  * Aktif:      "Kilit: {tarih saat} · kalan {süre}" (ⓘ arkasında açıklama)
//  * Kilitli:    "Mühürlü Analiz" + kilit zamanı + değiştirilemezlik + kısa hash
//  * Tamamlandı: mühür bilgisi + arşiv notu
//
// Veri backend arşivinden gelir (data.archive); arşiv yoksa hiçbir şey çizmez.

import 'dart:async';

import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';
import '../core/utils.dart';
import 'info_ipucu.dart';

String? _remainingText(int ms) {
  if (ms <= 0) return null;
  final s = ms ~/ 1000;
  final d = s ~/ 86400;
  final h = (s % 86400) ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final sec = s % 60;
  if (d > 0) return '$d gün $h sa';
  if (h > 0) return '$h sa $m dk';
  if (m > 0) return '$m dk ${sec.toString().padLeft(2, '0')} sn';
  return '$sec sn';
}

class SnapshotSealBanner extends StatefulWidget {
  // `const` DEĞİL — BİLEREK (2026-08-12): bu widget rengini `AppColors`
  // küresellerinden okuyor ve tema çalışma zamanında değişiyor. `const`
  // yapıcı widget örneğini sabitler; Flutter aynı örneği görünce alt ağacı
  // YENİDEN KURMAZ ve widget eski renkte donar (emülatörde ölçüldü:
  // Dortmund temasında kupon boş-durum kartı Galatasaray bordosunda kaldı).
  // ignore: prefer_const_constructors_in_immutables
  SnapshotSealBanner({super.key, required this.archive});

  final Map? archive;

  @override
  State<SnapshotSealBanner> createState() => _SnapshotSealBannerState();
}

class _SnapshotSealBannerState extends State<SnapshotSealBanner> {
  Timer? _saniye;
  DateTime _now = DateTime.now();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sayaciAyarla();
  }

  @override
  void didUpdateWidget(covariant SnapshotSealBanner old) {
    super.didUpdateWidget(old);
    _sayaciAyarla();
  }

  DateTime? get _freezeAt {
    final v = widget.archive?['freezeAt'];
    return v is String ? DateTime.tryParse(v)?.toLocal() : null;
  }

  bool get _counting {
    final a = widget.archive;
    final f = _freezeAt;
    return a != null && a['immutable'] != true && f != null && f.isAfter(_now);
  }

  void _sayaciAyarla() {
    if (_counting) {
      _saniye ??= Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _now = DateTime.now());
      });
    } else {
      _saniye?.cancel();
      _saniye = null;
    }
  }

  @override
  void dispose() {
    _saniye?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final archive = widget.archive;
    if (archive == null) return const SizedBox.shrink();

    final snapshot = archive['snapshot'] as Map?;

    // 1) MÜHÜRLÜ (kilitli/tamamlanmış): değiştirilemezlik + doğrulama hash'i.
    if (archive['immutable'] == true && snapshot?['exists'] == true) {
      final lockD = archive['lockedAt'] is String
          ? matchDate(archive['lockedAt'] as String)
          : null;
      final doneD = archive['completedAt'] is String
          ? matchDate(archive['completedAt'] as String)
          : null;

      return Container(
        margin: const EdgeInsets.only(top: Spacing.sm),
        padding: const EdgeInsets.symmetric(
          vertical: 8,
          horizontal: Spacing.md,
        ),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.success),
          // Kaynak: 'rgba(34,197,94,0.08)'
          color: const Color(0xFF22C55E).withValues(alpha: 0.08),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '🔏 Mühürlü Analiz'
              '${lockD != null ? ' · ${lockD.day} ${lockD.time}' : ''}',
              style: const TextStyle(
                color: AppColors.success,
                fontSize: 12.5,
                fontWeight: AppFont.black,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Bu bültenin tahmin ve analizleri kilitlendi; hiçbir şekilde '
              'değiştirilemez.'
              '${snapshot?['late'] == true ? ' (Mühür, sunucu yeniden açıldığında alındı — veri anı kayıtlıdır.)' : ''}',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11.5,
                height: 15 / 11.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Doğrulama: #${snapshot?['shortHash'] ?? '—'}'
              '${archive['status'] == 'completed' && doneD != null ? ' · Tamamlandı: ${doneD.day}' : ''}',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                fontWeight: AppFont.bold,
              ),
            ),
          ],
        ),
      );
    }

    // 2) AKTİF + kilit zamanı belli: geri sayım — MOBİL SADELİK (2026-08-06):
    //    tek satır özet, açıklama ⓘ arkasında. Veri eksiği uyarısı GÖRÜNÜR kalır.
    final freezeAt = _freezeAt;
    if (freezeAt != null) {
      final d = matchDate(archive['freezeAt'] as String);
      final left = _remainingText(freezeAt.difference(_now).inMilliseconds);
      final gaps = archive['dataGaps'] as List?;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InfoIpucu(
            renk: AppColors.warning,
            ikon: Icons.lock_outline,
            ozet:
                'Kilit: ${d.day} ${d.time}'
                '${left != null ? ' · kalan $left' : ' · mühürleniyor…'}',
            detay:
                'Kilitten sonra tahmin/analiz değişmez, arşive mühürlenir. '
                'Bu, karnelerin geriye dönük oynanamamasının güvencesidir.',
          ),
          if (gaps != null && gaps.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '⚠ ${gaps.length} maçta veri eksik — eksikler snapshot\'a '
                '"veri yok" olarak yazılır.',
                style: const TextStyle(
                  color: AppColors.warning,
                  fontSize: 11,
                  fontWeight: AppFont.bold,
                ),
              ),
            ),
        ],
      );
    }

    return const SizedBox.shrink();
  }
}
