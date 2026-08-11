// KAYNAK: app/src/components/MasterAnalysisView.js — BİREBİR çeviri.
//
// MASTER ANALİZ GÖRÜNÜMÜ — Maç Detayı "Analiz" sekmesinin backend paneli.
// Kriter hesabının TEK doğruluk kaynağı backend'dir; bu bileşen yalnız sonucu
// ve açıklamaları gösterir.
//
// ÇEVRİMDIŞI (2026-08-07): cihazda yedek motor ARTIK YOK — yerel hafif motor
// kriter seçme sistemiyle birlikte kaldırıldı. Sunucuya ulaşılamazsa analiz
// GÖSTERİLMEZ; uydurma sonuç üretmek yerine durum dürüstçe yazılır.
//
// KULLANICI PROFİLİ KALDIRILDI (2026-08-07, kullanıcı kararı). Analiz artık
// HER ZAMAN resmî profille hesaplanır; kriter seçme sistemi tamamen kalktı.
// Bileşen profile göndermez (null) → backend `buildOfficialProfile()` kullanır.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/labels.dart';
import '../../core/services/master_analysis_service.dart';
import '../../core/theme/tokens.dart';

const Map<String, String> _outName = {
  '1': 'Ev',
  'X': 'Beraberlik',
  '2': 'Deplasman',
};

/// `calculateMatchMaster(no, null)` — null dönerse ÇEVRİMDIŞI demektir.
final masterAnalysisProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>?, Object>(
      (ref, no) => calculateMatchMaster(no),
    );

class MasterAnalysisView extends ConsumerStatefulWidget {
  const MasterAnalysisView({super.key, required this.no});

  final Object no;

  @override
  ConsumerState<MasterAnalysisView> createState() => _MasterAnalysisViewState();
}

class _MasterAnalysisViewState extends ConsumerState<MasterAnalysisView> {
  bool _showDetail = false;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(masterAnalysisProvider(widget.no));

    return async.when(
      loading: () => _kutu(
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Baslik(),
            Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Column(
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 8),
                  Text('Sunucuda hesaplanıyor…', style: _mutedTxt),
                ],
              ),
            ),
          ],
        ),
      ),
      // Servis zaten hatayı yutup null döndürüyor; buraya düşerse de aynı
      // dürüst mesaj gösterilir.
      error: (_, _) => _cevrimdisi(),
      data: (res) {
        final master = ((res?['match'] as Map?)?['master']) as Map?;
        if (res == null || master == null) return _cevrimdisi();

        if (master['ok'] != true) {
          return _kutu(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _Baslik(),
                Text(
                  '${master['message'] ?? 'Analiz üretilemedi.'}',
                  style: _mutedTxt,
                ),
              ],
            ),
          );
        }

        return _icerik(
          master,
          (res['match'] as Map)['radarMaster'] as Map?,
          res['freezeStatus'] as String?,
        );
      },
    );
  }

  Widget _cevrimdisi() => _kutu(
    child: const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Baslik(),
        SizedBox(height: 6),
        Text(
          '⚠ Analiz sunucudan alınamadı. Cihazda yedek hesap yapılmaz — '
          'yanlış sayı göstermektense hiç göstermemek doğrudur. '
          'Bağlantını kontrol edip tekrar dene. Mühürlü/resmî sonuçlar '
          'için bağlantı gerekir.',
          style: TextStyle(
            color: AppColors.warning,
            fontSize: 12,
            height: 17 / 12,
            fontWeight: AppFont.bold,
          ),
        ),
      ],
    ),
  );

  Widget _icerik(Map ms, Map? radar, String? freezeStatus) {
    List<Map> dirRows(Object? sig) =>
        ((ms['contributions'] as List?) ?? const [])
            .cast<Map>()
            .where((c) => c['signal'] == sig)
            .toList();

    final cappedFamilies = (ms['familyNotes'] as List?) ?? const [];
    final agree =
        radar?['mainPrediction'] != null &&
        ms['mainPrediction'] != null &&
        radar!['mainPrediction'] == ms['mainPrediction'];
    final ana = ms['mainPrediction'];

    return _kutu(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── ÜST: başlık + mühür durumu ──
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Flexible(child: _Baslik()),
              if (freezeStatus == 'sealed')
                const _Chip(label: '🔏 Mühürlü', tone: AppColors.success)
              else
                const _Chip(label: 'Canlı — kilitte mühürlenecek'),
            ],
          ),

          // Profil satırı kaldırıldı: tek profil var (resmî), seçim yok.
          _ChipSatiri(
            children: [
              _Chip(label: 'Kriter ${ms['selectedCriteriaCount']}'),
              _Chip(
                label: 'Verisi olan ${ms['availableCriteriaCount']}',
                tone: AppColors.success,
              ),
              if ((ms['unavailableCriteriaCount'] as num? ?? 0) > 0)
                _Chip(
                  label: 'Veri yok ${ms['unavailableCriteriaCount']}',
                  tone: AppColors.warning,
                ),
              _Chip(
                label: 'Veri yeterliliği %${ms['dataQuality']}',
                tone: (ms['dataQuality'] as num? ?? 0) >= 70
                    ? AppColors.success
                    : AppColors.warning,
              ),
              _Chip(
                label: 'Güven: ${ms['confidence']}',
                tone: ms['confidence'] == 'Yüksek'
                    ? AppColors.success
                    : ms['confidence'] == 'Orta'
                    ? AppColors.warning
                    : AppColors.danger,
              ),
            ],
          ),

          // ── ANA KARAR ──
          _Section(
            title: 'Analiz Desteği (1 / X / 2)',
            children: [
              _SupportBar(
                label: '1',
                value: ms['normalizedSupport1'] as num?,
                tone: AppColors.success,
              ),
              _SupportBar(
                label: 'X',
                value: ms['normalizedSupportX'] as num?,
                tone: AppColors.warning,
              ),
              _SupportBar(
                label: '2',
                value: ms['normalizedSupport2'] as num?,
                tone: AppColors.danger,
              ),
              Text(
                humanizeVerdictText('${ms['supportNote'] ?? ''}') ?? '',
                style: _tinyNote,
              ),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (ana != null) _AnaPill(text: 'Ana: $ana'),
                    if (ms['alternativePrediction'] != null)
                      _AltPill(
                        text: 'Alternatif: ${ms['alternativePrediction']}',
                      ),
                    if (ms['closedPrediction'] != null)
                      _AltPill(text: 'Kapalı: ${ms['closedPrediction']}'),
                  ],
                ),
              ),
              _ChipSatiri(
                children: [
                  // "Güçlü aday" ifadesi bilinçli: "banko" kelimesi kullanıcıya
                  // ASLA gösterilmez ve yanına "(garanti değil)" yazılır.
                  _Chip(
                    label: ms['bankoEligible'] == true
                        ? 'Güçlü aday koşulları sağlandı (garanti değil)'
                        : 'Güçlü aday için uygun değil',
                    tone: ms['bankoEligible'] == true
                        ? AppColors.success
                        : AppColors.danger,
                  ),
                  _Chip(label: 'Uzlaşma %${ms['agreementScore']}'),
                  _Chip(
                    label: 'Çatışma %${ms['conflictScore']}',
                    tone: (ms['conflictScore'] as num? ?? 0) >= 55
                        ? AppColors.danger
                        : null,
                  ),
                ],
              ),
              if (ms['decisionNote'] != null)
                Text(
                  humanizeVerdictText('${ms['decisionNote']}') ?? '',
                  style: _noteTxt,
                ),
              if (ms['bankoEligible'] != true && ms['bankoNote'] != null)
                Text(
                  humanizeVerdictText('${ms['bankoNote']}') ?? '',
                  style: _noteTxt,
                ),
            ],
          ),

          // ── ÖZET ──
          if (ms['summary'] != null)
            _Section(
              title: 'Master Analiz Özeti',
              children: [
                Text(
                  humanizeVerdictText('${ms['summary']}') ?? '',
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 12.5,
                    height: 19 / 12.5,
                    fontWeight: AppFont.semibold,
                  ),
                ),
              ],
            ),

          // ── RADAR KIYASI — AYRI SİSTEM ──
          if (radar != null)
            _Section(
              title: 'Radar Sistemiyle Karşılaştırma (ayrı sistem)',
              children: [
                Text(
                  'Master Analiz: ${ana ?? '—'} · '
                  'Master Radar: ${radar['mainPrediction'] ?? '—'}'
                  '${radar['classification'] == 'surprise_candidate' ? ' · Radar favori tuzağı uyarısı veriyor' : ''}',
                  style: _noteTxt,
                ),
                Text(
                  agree
                      ? '✔ İki bağımsız sistem ortak görüşte.'
                      : '⚠ Sistemler farklı görüşte — temkinli olunmalı.',
                  style: _noteTxt.copyWith(
                    color: agree ? AppColors.success : AppColors.warning,
                  ),
                ),
              ],
            ),

          // ── DETAY AÇ/KAPA ──
          Padding(
            padding: const EdgeInsets.only(top: Spacing.md),
            child: GestureDetector(
              onTap: () => setState(() => _showDetail = !_showDetail),
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.surfaceSoft,
                  borderRadius: AppRadius.smR,
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  _showDetail
                      ? 'Kriter detaylarını gizle ▲'
                      : 'Kriter detaylarını göster ▼',
                  style: const TextStyle(
                    color: AppColors.textSoft,
                    fontSize: 12,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              ),
            ),
          ),

          if (_showDetail) ..._detay(ms, dirRows, cappedFamilies, freezeStatus),
        ],
      ),
    );
  }

  List<Widget> _detay(
    Map ms,
    List<Map> Function(Object?) dirRows,
    List cappedFamilies,
    String? freezeStatus,
  ) {
    final ana = ms['mainPrediction'];
    final anaSatirlar = dirRows(ana);
    final missing = (ms['missingData'] as List?) ?? const [];
    final reliability = (ms['reliabilityNotes'] as List?) ?? const [];

    return [
      _Section(
        title: 'Ana tercihi destekleyenler (${anaSatirlar.length})',
        children: [
          if (anaSatirlar.isEmpty)
            const Text('Bu yönü destekleyen kriter yok.', style: _mutedTxt)
          else
            for (final c in anaSatirlar.take(8)) _kriterSatiri(c, aile: true),
        ],
      ),
      for (final o in const ['1', 'X', '2'].where((x) => x != ana))
        _Section(
          title:
              '${_outName[o]} ($o) yönünü destekleyenler (${dirRows(o).length})',
          children: [
            if (dirRows(o).isEmpty)
              const Text('Sinyal yok.', style: _mutedTxt)
            else
              for (final c in dirRows(o).take(5)) _kriterSatiri(c),
          ],
        ),
      if (missing.isNotEmpty)
        _Section(
          title: 'Veri bulunamayan kriterler (${missing.length})',
          children: [
            for (final x in missing.take(8).cast<Map>())
              Text('– ${x['label']}', style: _mutedTxt),
          ],
        ),
      if (cappedFamilies.isNotEmpty)
        _Section(
          title: 'Aile dengelemesi (çifte sayım engeli)',
          children: [
            for (final f in cappedFamilies.cast<Map>())
              Text(
                '• ${humanizeVerdictText('${f['note']}') ?? ''}',
                style: _noteTxt,
              ),
          ],
        ),
      if (ms['mode'] == 'smart' && reliability.isNotEmpty)
        _Section(
          title: 'Akıllı Destek ayarlamaları',
          children: [
            for (final r in reliability.cast<Map>())
              Text(
                '• ${r['label']}: ${humanizeVerdictText('${r['note']}') ?? ''}',
                style: _noteTxt,
              ),
          ],
        ),
      Text(
        'Metodoloji: ${ms['methodologyVersion']} · '
        'Hesap: ${_zaman(ms['calculatedAt'])}'
        '${freezeStatus == 'sealed' ? ' · 🔏 Kilitli analiz — güncel motorla yeniden hesaplanmaz.' : ''}',
        style: _tinyNote,
      ),
    ];
  }

  Widget _kriterSatiri(Map c, {bool aile = false}) {
    final dedup = c['familyDedupFactor'];
    return RichText(
      text: TextSpan(
        style: const TextStyle(
          color: AppColors.textSoft,
          fontSize: 11.5,
          height: 17 / 11.5,
        ),
        children: [
          TextSpan(text: '• ${c['label']} '),
          TextSpan(
            text: '+${c['points']}',
            style: const TextStyle(
              color: AppColors.success,
              fontWeight: AppFont.black,
            ),
          ),
          if (aile && dedup is num && dedup < 1)
            TextSpan(
              text: ' (aile dengesi ×$dedup)',
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
              ),
            ),
        ],
      ),
    );
  }

  /// Kaynakta `new Date(...).toLocaleString('tr-TR')`.
  String _zaman(Object? iso) {
    final d = iso is String
        ? DateTime.tryParse(iso)?.toLocal()
        : DateTime.now();
    if (d == null) return '—';
    String p(int n) => n.toString().padLeft(2, '0');
    return '${p(d.day)}.${p(d.month)}.${d.year} ${p(d.hour)}:${p(d.minute)}';
  }

  Widget _kutu({required Widget child}) => Container(
    padding: const EdgeInsets.all(Spacing.md),
    margin: const EdgeInsets.only(bottom: Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.mdR,
      border: Border.all(color: AppColors.border),
    ),
    child: child,
  );
}

class _Baslik extends StatelessWidget {
  const _Baslik();

  @override
  Widget build(BuildContext context) => const Text(
    '🧠 Master Analiz',
    style: TextStyle(
      color: AppColors.text,
      fontSize: 16,
      fontWeight: AppFont.black,
    ),
  );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, this.tone});

  final String label;
  final Color? tone;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: AppColors.surfaceSoft,
      borderRadius: AppRadius.pillR,
      border: Border.all(color: tone ?? AppColors.border),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: tone ?? AppColors.textSoft,
        fontSize: 10.5,
        fontWeight: AppFont.heavy,
      ),
    ),
  );
}

class _ChipSatiri extends StatelessWidget {
  const _ChipSatiri({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Wrap(spacing: 6, runSpacing: 6, children: children),
  );
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: Spacing.md),
    padding: const EdgeInsets.only(top: 8),
    decoration: const BoxDecoration(
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            title,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 12.5,
              fontWeight: AppFont.black,
            ),
          ),
        ),
        ...children,
      ],
    ),
  );
}

class _SupportBar extends StatelessWidget {
  const _SupportBar({
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final num? value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final v = (value ?? 0).toDouble();
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        children: [
          SizedBox(
            width: 16,
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 12.5,
                fontWeight: AppFont.black,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(5),
              child: Container(
                height: 10,
                color: AppColors.cardAlt,
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  // Kaynak: `Math.max(2, value)` — sıfır bile olsa 2 birim
                  // çizilir ki çubuğun varlığı görünsün.
                  widthFactor: (v < 2 ? 2 : (v > 100 ? 100 : v)) / 100,
                  child: Container(color: tone),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 44,
            child: Text(
              '%${value ?? 0}',
              textAlign: TextAlign.right,
              style: TextStyle(
                color: tone,
                fontSize: 12,
                fontWeight: AppFont.black,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnaPill extends StatelessWidget {
  const _AnaPill({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: const BoxDecoration(
      color: AppColors.primary,
      borderRadius: AppRadius.pillR,
    ),
    child: Text(
      text,
      style: const TextStyle(
        color: AppColors.white,
        fontSize: 13,
        fontWeight: AppFont.black,
      ),
    ),
  );
}

class _AltPill extends StatelessWidget {
  const _AltPill({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: const BoxDecoration(
      color: AppColors.cardAlt,
      borderRadius: AppRadius.pillR,
    ),
    child: Text(
      text,
      style: const TextStyle(
        color: AppColors.text,
        fontSize: 12.5,
        fontWeight: AppFont.heavy,
      ),
    ),
  );
}

const TextStyle _mutedTxt = TextStyle(
  color: AppColors.textMuted,
  fontSize: 12,
  height: 17 / 12,
);

const TextStyle _noteTxt = TextStyle(
  color: AppColors.textSoft,
  fontSize: 11.5,
  height: 16 / 11.5,
);

const TextStyle _tinyNote = TextStyle(
  color: AppColors.textMuted,
  fontSize: 10,
  height: 14 / 10,
  fontStyle: FontStyle.italic,
);
