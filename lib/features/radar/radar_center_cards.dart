// KAYNAK: app/src/components/RadarCenterCards.js — BİREBİR çeviri.
//
// RADAR MERKEZİ KARTLARI — mevcut tasarım dili (beyaz/lacivert/kırmızı,
// kart + pill + ince bar) korunur. Veri yoksa alan çizilmez; "veri yok"
// durumları AÇIKÇA yazılır (uydurma yok).

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import 'radar_screen_data.dart';

typedef ClassMeta = ({String label, Color color, Color soft, String icon});

/// Kullanıcı dili sadeleştirmesi: "Orta Risk"→"Temkinli", "Sürpriz Adayı"→
/// "Sürpriz Sinyali", "Yetersiz Veri"→"Analiz Hazır Değil" (anahtarlar aynı).
/// GETTER, `final` DEĞİL: takım teması `AppColors`ı çalışma zamanında değiştirir
/// (buradaki `muted`/`surfaceSoft` yapısaldır); `final` harita donardı.
Map<String, ClassMeta> get kClassMeta => {
  'strong_candidate': (
    label: 'Güçlü Aday',
    color: AppColors.success,
    soft: AppColors.successSoft,
    icon: '🟢',
  ),
  'medium_risk': (
    label: 'Karışık Sinyal',
    color: AppColors.warning,
    soft: AppColors.warningSoft,
    icon: '🟡',
  ),
  'surprise_candidate': (
    label: 'Sürpriz Sinyali',
    color: AppColors.danger,
    soft: AppColors.dangerSoft,
    icon: '🔴',
  ),
  'insufficient_data': (
    label: 'Analiz Hazır Değil',
    color: AppColors.muted,
    soft: AppColors.surfaceSoft,
    icon: '⚪',
  ),
};

ClassMeta classMetaOf(Object? k) =>
    kClassMeta['$k'] ?? kClassMeta['insufficient_data']!;

class RadarTabDef {
  const RadarTabDef(this.k, this.label, this.sub);
  final String k;
  final String label;
  final String sub;
}

const List<RadarTabDef> kRadarTabDefs = [
  RadarTabDef('master', 'Master', 'Birleşik'),
  RadarTabDef('performance', 'Radar 1', 'Rakip Gücü'),
  RadarTabDef('expectation', 'Radar 2', 'xG'),
  RadarTabDef('publicBetting', 'Radar 3', 'Oynanma DNA'),
  RadarTabDef('market', 'Radar 4', 'Oran Takibi'),
  RadarTabDef('bulletinMemory', 'Radar 5', 'Bülten DNA'),
];

/// "Kullanılan veriler" satırı — hangi veri ailelerinin AKTİF olduğu açıkça
/// yazılır.
const Map<String, String> _dataSourceLabels = {
  'performance': 'Form · Rakip Seviyesi',
  'expectation': 'xG',
  'publicBetting': 'Oynanma DNA',
  'market': 'Oran Takibi',
  'bulletinMemory': 'Bülten Hafızası',
};

String? usedDataLine(Map? radars) {
  final used = <String>[];
  _dataSourceLabels.forEach((k, v) {
    if ((radars?[k] as Map?)?['hasData'] == true) used.add(v);
  });
  return used.isEmpty ? null : 'Kullanılan veriler: ${used.join(' · ')}';
}

String? _fmtTime(Object? iso) {
  final d = iso is String ? DateTime.tryParse(iso)?.toLocal() : null;
  if (d == null) return null;
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(d.day)}.${p(d.month)} ${p(d.hour)}:${p(d.minute)}';
}

class ClassPill extends StatelessWidget {
  const ClassPill({
    super.key,
    required this.classification,
    this.small = false,
  });

  final Object? classification;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final meta = classMetaOf(classification);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: small ? 2 : 3),
      decoration: BoxDecoration(
        color: meta.soft,
        borderRadius: AppRadius.pillR,
        border: Border.all(color: meta.color),
      ),
      child: Text(
        '${meta.icon} ${meta.label}',
        style: TextStyle(
          color: meta.color,
          fontSize: 9.5,
          fontWeight: AppFont.black,
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.value, this.tone});

  final String label;
  final String value;
  final Color? tone;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: AppColors.surfaceSoft,
      borderRadius: AppRadius.smR,
      border: Border.all(color: AppColors.border),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 9.5,
            fontWeight: AppFont.bold,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          value,
          style: TextStyle(
            color: tone ?? AppColors.text,
            fontSize: 10.5,
            fontWeight: AppFont.black,
          ),
        ),
      ],
    ),
  );
}

/// MASTER KART — 15 maçlık listede her maç.
class MasterMatchCard extends StatelessWidget {
  const MasterMatchCard({
    super.key,
    required this.item,
    this.expanded = false,
    this.onToggle,
    this.muhurluHafta = false,
  });

  final Map item;
  final bool expanded;
  final VoidCallback? onToggle;

  /// Mühürlü haftada sonucu olmayan maç SESSİZ bırakılmaz: "sonuç bekleniyor —
  /// ertelenmiş olabilir" yazılır (2026-08-10, 53. Hafta 14. maç olayı).
  final bool muhurluHafta;

  @override
  Widget build(BuildContext context) {
    final m = (item['master'] as Map?) ?? const {};
    final risk = m['favoriteFailureRisk'];
    final meta = classMetaOf(m['classification']);

    final riskReasons = (m['riskReasons'] as List?) ?? const [];
    final topReasons = (m['topReasons'] as List?) ?? const [];
    final surpriz = m['classification'] == 'surprise_candidate';
    // KARIŞIK SİNYALDE TEK İŞARET ÖNERİLMEZ (kullanıcı kararı, 2026-08-10):
    // sinyal karışıksa "Ana: 1" basmak yanlış güven verir. Motorun birleşik
    // puanının en yüksek iki işareti ÇİFT olarak önerilir; skor yoksa çift
    // uydurulmaz, tek işaret görünümü kalır.
    final cift = m['classification'] == 'medium_risk' ? ciftIhtimal(m) : null;
    final reasons = [
      if (surpriz) ...riskReasons,
      ...topReasons,
      if (!surpriz) ...riskReasons,
    ].take(expanded ? 6 : 3).cast<Map>().toList();

    final conflict = m['conflictScore'];
    final consensus = conflict is num
        ? (100 - conflict).clamp(0, 100).toInt()
        : null;

    final official = item['official'] as Map?;
    final outcome = item['outcome'] as Map?;
    final missing = (m['missingData'] as List?) ?? const [];

    // VERİ YOKKEN FAVORİ BASILMAZ (kullanıcı bildirimi, 2026-08-10: "ligler
    // yeni başladı, neye göre favori?"). Sezon başında çoğu maçın tek puan
    // kaynağı halkın oynanma yüzdesidir; onu "Favori %88" diye sunmak halk
    // parasını analiz gibi gösterir (oynanma yüzdesi oran DEĞİLDİR). Halk
    // yüklenmesi alttaki Radar 3 maddesinde kendi atfıyla zaten yazar.
    // MÜHÜRLÜ/SONUÇLU geçmiş kartlara DOKUNULMAZ: oradaki tahmin mühürlü
    // kayıttır; sonradan gizlemek geçmişi değiştirmek olur.
    final veriYetersiz =
        m['classification'] == 'insufficient_data' && official == null;

    return GestureDetector(
      onTap: onToggle,
      behavior: HitTestBehavior.opaque,
      child: Container(
        margin: const EdgeInsets.only(bottom: Spacing.sm),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadius.mdR,
          border: Border.all(
            color: expanded ? AppColors.primary : AppColors.border,
          ),
          boxShadow: AppShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 22,
                  child: Text(
                    '${item['no']}',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 15,
                      fontWeight: AppFont.heavy,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${item['home']} – ${item['away']}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.text,
                          fontSize: 13.5,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                      Text(
                        '${_fmtTime(item['kickoffAt']) ?? 'Saat bilinmiyor'}'
                        '${item['league'] != null ? ' · ${item['league']}' : ''}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10.5,
                        ),
                      ),
                      if (risk is num)
                        Padding(
                          padding: const EdgeInsets.only(top: 5),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: Container(
                              height: 6,
                              color: AppColors.cardAlt,
                              child: FractionallySizedBox(
                                alignment: Alignment.centerLeft,
                                widthFactor:
                                    (risk.clamp(0, 100)).toDouble() / 100,
                                child: Container(color: meta.color),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (risk is num)
                      Text(
                        '$risk',
                        style: TextStyle(
                          color: meta.color,
                          fontSize: 20,
                          fontWeight: AppFont.black,
                        ),
                      ),
                    const SizedBox(height: 3),
                    ClassPill(classification: m['classification'], small: true),
                  ],
                ),
              ],
            ),

            // ── Tahmin satırı ──
            if (veriYetersiz)
              Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  '— Tahmin üretilmedi: veri yetersiz.',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11.5,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              )
            else if (m['mainPrediction'] != null ||
                m['alternativePrediction'] != null ||
                m['favorite'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (cift != null)
                      // Alternatif rozeti de basılmaz: çift zaten ikinci
                      // işareti kapsıyor, ikisi birden gürültü olurdu.
                      _pill('Çift ihtimal: $cift', dolu: true)
                    else ...[
                      if (m['mainPrediction'] != null)
                        _pill('Ana: ${m['mainPrediction']}', dolu: true),
                      if (m['alternativePrediction'] != null)
                        _pill('Alternatif: ${m['alternativePrediction']}'),
                    ],
                    if (m['favorite'] is Map)
                      Text(
                        'Favori ${(m['favorite'] as Map)['symbol']} · '
                        '%${(m['favorite'] as Map)['percent']}',
                        style: TextStyle(
                          color: AppColors.textSoft,
                          fontSize: 11,
                          fontWeight: AppFont.bold,
                        ),
                      ),
                    if (m['exactDirection'] != null && surpriz)
                      Text(
                        'Sürpriz yönü: ${m['exactDirection']}',
                        style: const TextStyle(
                          color: AppColors.danger,
                          fontSize: 11,
                          fontWeight: AppFont.heavy,
                        ),
                      ),
                  ],
                ),
              ),

            // ── Ölçü satırı ──
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _MetaChip(
                    label: 'Veri',
                    value: '%${m['dataQuality'] ?? 0}',
                    tone: ((m['dataQuality'] as num?) ?? 0) < 60
                        ? AppColors.warning
                        : AppColors.success,
                  ),
                  // TAHMİN ÜRETİLMEYEN kartta "Güven %95" ve "Uzlaşma %100"
                  // basılmaz (2026-08-10 bulgusu): güven, olmayan tahminin
                  // güveni olamaz; tek radar kendi kendisiyle "uzlaşamaz"
                  // (çatışma puanı en az iki yön veren radar ister).
                  if (m['confidence'] != null && !veriYetersiz)
                    _MetaChip(label: 'Güven', value: '%${m['confidence']}'),
                  _MetaChip(
                    label: 'Radar',
                    value: '${m['activeRadarCount'] ?? 0}/5',
                  ),
                  if (consensus != null && !veriYetersiz)
                    _MetaChip(
                      label: 'Uzlaşma',
                      value: '%$consensus',
                      tone: consensus < 55 ? AppColors.danger : null,
                    ),
                  if (m['surpriseDnaScore'] != null)
                    _MetaChip(label: 'DNA', value: '${m['surpriseDnaScore']}'),
                ],
              ),
            ),

            // ── Resmî sonuç (geçmiş hafta) ──
            // NOTER KARARI (ertelenen maç): işaret açıkça yazılır ama skor ve
            // "tahmin tuttu" rozeti YOKTUR — maç oynanmadı; kupon kuralı
            // gereği işaret geçerli, radar karnesine sayılmaz (2026-08-10).
            if (official != null && official['resultType'] == 'notary_decision')
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '🏛 Ertelendi — noter kararı: ${official['result']} · '
                  'radar karnesine sayılmaz.',
                  style: TextStyle(
                    color: AppColors.textSoft,
                    fontSize: 11.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
              )
            else if (official == null && muhurluHafta)
              // Mühürlü hafta bitti ama sonuç hâlâ yok: sessizlik hata gibi
              // görünür. Dürüst durum: kaynakta sonuç yok — büyük ihtimalle
              // ertelendi; noter kararı girilince burada görünecek.
              Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  '— Sonuç bekleniyor: kaynakta resmî sonuç yok — maç '
                  'ertelenmiş olabilir. Noter kararı açıklanınca burada '
                  'görünecek.',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11.5,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              )
            else if (official != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    RichText(
                      text: TextSpan(
                        style: TextStyle(
                          color: AppColors.textSoft,
                          fontSize: 11.5,
                        ),
                        children: [
                          const TextSpan(text: 'Resmî sonuç: '),
                          TextSpan(
                            text: '${official['result']}',
                            style: TextStyle(
                              color: AppColors.text,
                              fontWeight: AppFont.black,
                            ),
                          ),
                          TextSpan(
                            text:
                                ' · ${(official['score'] as Map?)?['home']}'
                                '-${(official['score'] as Map?)?['away']}',
                          ),
                        ],
                      ),
                    ),
                    if (outcome?['mainHit'] != null)
                      _hitPill(
                        outcome!['mainHit'] == true
                            ? '✓ Ana tahmin tuttu'
                            : '✗ Ana tahmin tutmadı',
                        outcome['mainHit'] == true
                            ? AppColors.success
                            : AppColors.danger,
                      ),
                    if (outcome?['favoriteFailed'] == true)
                      _hitPill('Sürpriz oldu', AppColors.warning),
                  ],
                ),
              ),

            // ── Gerekçeler ──
            if (reasons.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final r in reasons)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: RichText(
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          text: TextSpan(
                            style: TextStyle(
                              color: AppColors.textSoft,
                              fontSize: 11,
                              height: 1.45,
                            ),
                            children: [
                              const TextSpan(text: '• '),
                              TextSpan(
                                text: '${r['radar']}: ',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontWeight: AppFont.heavy,
                                ),
                              ),
                              TextSpan(text: '${r['text']}'),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),

            // ── Eksik veri uyarısı ──
            if (!expanded && missing.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '⚠ ${missing.length} veri alanı eksik — detayda listeli.',
                  style: const TextStyle(
                    color: AppColors.warning,
                    fontSize: 10.5,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),

            // ── Genişletilmiş detay ──
            if (expanded) ..._detay(item, m),
          ],
        ),
      ),
    );
  }

  List<Widget> _detay(Map item, Map m) {
    final radars = item['radars'] as Map?;
    final usedLine = usedDataLine(radars);
    final conflictNotes = (m['conflictNotes'] as List?) ?? const [];
    final gateNotes = (m['gateNotes'] as List?) ?? const [];

    return [
      Container(
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.only(top: 10),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (usedLine != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  '📎 $usedLine',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 10.5,
                    fontWeight: AppFont.bold,
                  ),
                ),
              ),
            const _DetayBaslik('Radar kırılımı'),
            for (final k in const [
              'performance',
              'expectation',
              'publicBetting',
              'market',
              'bulletinMemory',
            ])
              _RadarRow(r: radars?[k] as Map?),
            if (conflictNotes.isNotEmpty) ...[
              const _DetayBaslik('Radar uzlaşması'),
              for (final t in conflictNotes) _detayMetni('$t'),
            ],
            if (gateNotes.isNotEmpty) ...[
              const _DetayBaslik('Sınıf kapıları'),
              for (final t in gateNotes) _detayMetni('$t'),
            ],
          ],
        ),
      ),
    ];
  }

  static Widget _detayMetni(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 2),
    child: Text(
      '• $t',
      style: TextStyle(color: AppColors.textSoft, fontSize: 11, height: 1.45),
    ),
  );

  static Widget _pill(String text, {bool dolu = false}) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: dolu ? AppColors.primary : AppColors.cardAlt,
      borderRadius: AppRadius.pillR,
    ),
    child: Text(
      text,
      style: TextStyle(
        color: dolu ? AppColors.white : AppColors.text,
        fontSize: 11.5,
        fontWeight: AppFont.black,
      ),
    ),
  );

  static Widget _hitPill(String text, Color bg) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: bg, borderRadius: AppRadius.smR),
    child: Text(
      text,
      style: const TextStyle(
        color: AppColors.white,
        fontSize: 10,
        fontWeight: AppFont.black,
      ),
    ),
  );
}

class _DetayBaslik extends StatelessWidget {
  const _DetayBaslik(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8, bottom: 4),
    child: Text(
      text,
      style: TextStyle(
        color: AppColors.text,
        fontSize: 11.5,
        fontWeight: AppFont.black,
      ),
    ),
  );
}

/// Radar satırı (detay panelinde): ad + skorlar/yön + veri kalitesi VEYA durum.
class _RadarRow extends StatelessWidget {
  const _RadarRow({required this.r});
  final Map? r;

  @override
  Widget build(BuildContext context) {
    final r = this.r;
    if (r == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${r['name']}',
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 11.5,
                    fontWeight: AppFont.heavy,
                  ),
                ),
                if (r['hasData'] == true)
                  Text(
                    '${r['homeScore'] != null ? '1 %${r['homeScore']} · X %${r['drawScore']} · 2 %${r['awayScore']}' : 'Yön puanı üretmez (yardımcı sinyal)'}'
                    '${r['favoriteFailureRisk'] != null ? ' · Sürpriz göstergesi ${r['favoriteFailureRisk']}' : ''}',
                    style: TextStyle(
                      color: AppColors.textSoft,
                      fontSize: 10.5,
                      height: 1.4,
                    ),
                  )
                else
                  Text(
                    '${r['status'] == 'no_source' ? '⏳ Veri kaynağı bekleniyor' : '— Veri yetersiz'}'
                    '${r['note'] != null ? ' · ${r['note']}' : ''}',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10.5,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
              ],
            ),
          ),
          if (r['hasData'] == true)
            Text(
              'Veri %${r['dataQuality']}',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 10,
                fontWeight: AppFont.bold,
              ),
            ),
        ],
      ),
    );
  }
}

/// TEK RADAR KARTI (Radar 1/2/5 sekmeleri).
///
/// Radar objesi hiç yoksa BİLE maçı listeden düşürme — 15 maç Spor Toto
/// sırasıyla korunur; bu maçta bu radarın verisi yoksa dürüstçe belirtilir.
class RadarTabCard extends StatelessWidget {
  const RadarTabCard({super.key, required this.item, required this.radarId});

  final Map item;
  final String radarId;

  @override
  Widget build(BuildContext context) {
    final r = (item['radars'] as Map?)?[radarId] as Map?;

    if (r == null) {
      return _kutu(
        child: _ust(
          alt: Text(
            '— Bu maçta bu radar için veri yok',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 10.5,
              fontStyle: FontStyle.italic,
            ),
          ),
        ),
      );
    }

    // Radar 1 (Rakip Gücü): backend her maç için AYNI 4 çekirdek satırı üretir
    // — kartlar tutarlı olur, "birinde var birinde yok" olmaz. coreLines yoksa
    // eski davranışa düşülür.
    final coreLines =
        ((r['details'] as Map?)?['coreLines'] as List?) ?? const [];
    final positives = (r['positives'] as List?) ?? const [];
    final negatives = (r['negatives'] as List?) ?? const [];
    final lines = radarId == 'performance'
        ? (coreLines.isNotEmpty
              ? coreLines
              : [...positives.take(2), ...negatives.take(2)])
        : [...positives, ...negatives].take(3).toList();

    final risk = r['favoriteFailureRisk'];
    final playedDna = (r['details'] as Map?)?['playedDna'] as Map?;

    return _kutu(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ust(
            alt: r['hasData'] == true
                ? Text(
                    '${r['homeScore'] != null ? '1 %${r['homeScore']} · X %${r['drawScore']} · 2 %${r['awayScore']} · ' : ''}'
                    '${r['direction'] != null ? 'Yön: ${r['direction']} · ' : ''}'
                    'Veri %${r['dataQuality']}',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10.5,
                    ),
                  )
                : Text(
                    r['status'] == 'no_source'
                        ? '⏳ Veri kaynağı bekleniyor'
                        : '— Bu maçta veri yetersiz',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10.5,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
            sag: risk is num
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '$risk',
                        style: TextStyle(
                          color: risk >= 65
                              ? AppColors.danger
                              : risk >= 35
                              ? AppColors.warning
                              : AppColors.success,
                          fontSize: 20,
                          fontWeight: AppFont.black,
                        ),
                      ),
                      Text(
                        'Sürpriz göstergesi',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 8.5,
                          fontWeight: AppFont.bold,
                        ),
                      ),
                    ],
                  )
                : null,
          ),
          for (final t in lines)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '• $t',
                maxLines: radarId == 'performance' ? 3 : 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.textSoft,
                  fontSize: 11,
                  height: 1.45,
                ),
              ),
            ),

          // OYNANMA DNA (Radar 3): kaynak cümlesi + benzer geçmiş sonuç.
          if (radarId == 'publicBetting' && playedDna != null)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.surfaceSoft,
                borderRadius: AppRadius.smR,
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '💬 ${playedDna['userSentence']}',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 11,
                      height: 1.45,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
                  if ((playedDna['similarDna'] as Map?)?['hasData'] == true)
                    Text(
                      '📈 ${(playedDna['similarDna'] as Map)['sentence']}',
                      style: TextStyle(
                        color: AppColors.textSoft,
                        fontSize: 10.5,
                        height: 1.45,
                      ),
                    )
                  else
                    Text(
                      '${(playedDna['similarDna'] as Map?)?['note'] ?? 'Benzer sonuç için sistem öğreniyor.'}',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10.5,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  if (playedDna['note'] != null)
                    Text(
                      '${playedDna['note']}',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10,
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _ust({required Widget alt, Widget? sag}) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SizedBox(
        width: 22,
        child: Text(
          '${item['no']}',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 15,
            fontWeight: AppFont.heavy,
          ),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${item['home']} – ${item['away']}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.text,
                fontSize: 13.5,
                fontWeight: AppFont.heavy,
              ),
            ),
            alt,
          ],
        ),
      ),
      if (sag != null) ...[const SizedBox(width: 8), sag],
    ],
  );

  Widget _kutu({required Widget child}) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.sm),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: AppRadius.mdR,
      border: Border.all(color: AppColors.border),
      boxShadow: AppShadow.soft,
    ),
    child: child,
  );
}
