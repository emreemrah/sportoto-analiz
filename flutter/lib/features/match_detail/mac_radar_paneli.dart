// KAYNAK: app/src/components/MacRadarPaneli.js — BİREBİR çeviri.
//
// MAÇ RADAR PANELİ — Radar 3 / 4, YALNIZ BU MAÇ İÇİN (2026-08-07)
//
// KULLANICI İSTEĞİ: "Radar 3-4-5'i maç detayına koyalım ama her maçın KENDİ
// sırasını koyacağız." Radar sekmesinde bu paneller bültenin 15 maçını birden
// listeliyor; maçın içindeyken o kalabalığa gerek yok — tek satır lazım.
//
// RADAR 5 KALDIRILDI (2026-08-08): kullanıcı "radar5 bugün yaptığımızı
// beğenmedim" dedi. Bülten DNA bölümü buradan çıkarıldı.
//
// TASARIM KARARI: satırları Radar ekranındaki bileşenlerin AYNISI çizer
// (`radar_day_rows.dart`). Kopya bileşen yazılmadı; iki ekran aynı veriyi
// farklı gösterirse hangisinin doğru olduğu bilinemez.
//
// ═══════════════ PARAMETRE TUZAĞI (2026-08-07 hatası) ══════════════════════
// `radarDailyPlayed(roundId, matchId)` ve `radarDailyOdds(roundId, matchId)`
// ikinci parametreyi `matchId` olarak alır ve backend bununla GÖZLEMLERİ
// süzer. `matchId` BÜLTEN SIRASI DEĞİLDİR — Spor Toto maç kimliğidir. İlk
// sürümde buraya sıra numarası (1) geçilmişti; hiçbir gözlemle eşleşmedi,
// hücreler boş döndü ve ekran "bu gün için kayıt yok" yazdı. Veri vardı, sorgu
// yanlıştı — ve bu SESSİZ bir hataydı: uç 200 döndü, hata basılmadı, yalnız
// sayılar yoktu.
//
// KURAL: bu iki uç haftanın TAMAMI için çağrılır; maç süzmesi ekranda
// `item.no` ile yapılır. Aşağıdaki çağrılarda matchId GEÇİLMEZ.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/tokens.dart';
import '../radar/played_dna_panel.dart';
import '../radar/radar_day_rows.dart';

const Map<String, String> _kisaGun = {
  'Pazartesi': 'Pzt',
  'Salı': 'Sal',
  'Çarşamba': 'Çar',
  'Perşembe': 'Per',
  'Cuma': 'Cum',
  'Cumartesi': 'Cmt',
  'Pazar': 'Paz',
};

/// matchId GEÇİLMEZ — bkz. dosya başındaki "PARAMETRE TUZAĞI" notu.
final _dailyPlayedProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>((ref, roundId) async {
      final d = await api.radarDailyPlayed(roundId);
      return Map<String, dynamic>.from(d as Map);
    });

final _dailyOddsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, Object>((ref, roundId) async {
      final d = await api.radarDailyOdds(roundId);
      return Map<String, dynamic>.from(d as Map);
    });

/// Son (en güncel) veri günü: gelecek OLMAYAN günlerin sonuncusu.
/// Hiç uygun gün yoksa ilk gün — varsayılan gün UYDURULMAZ.
String? _sonGun(List? gunler) {
  final uygun = (gunler ?? const [])
      .cast<Map>()
      .where((g) => g['future'] != true)
      .toList();
  if (uygun.isNotEmpty) return uygun.last['date'] as String?;
  final hepsi = (gunler ?? const []).cast<Map>();
  return hepsi.isEmpty ? null : hepsi.first['date'] as String?;
}

class MacRadarPaneli extends ConsumerStatefulWidget {
  const MacRadarPaneli({super.key, required this.m});

  final Map<String, dynamic> m;

  @override
  ConsumerState<MacRadarPaneli> createState() => _MacRadarPaneliState();
}

class _MacRadarPaneliState extends ConsumerState<MacRadarPaneli> {
  String? _oynanmaGun;
  String? _oranGun;
  String? _acikDna; // "<no>|<kaynak>"

  @override
  Widget build(BuildContext context) {
    final roundId = widget.m['roundId'];
    final no = widget.m['no'];

    if (roundId == null || no == null) {
      return const _Kart(
        children: [
          Text(
            'Bu maç için hafta/sıra bilgisi yok — radar gösterilemez.',
            style: _bos,
          ),
        ],
      );
    }

    // Satır bileşenlerinin beklediği asgari şekil: { no, home, away }.
    final home = widget.m['home'] as Map?;
    final away = widget.m['away'] as Map?;
    final satir = {
      'no': no,
      'home': home?['mediumName'] ?? home?['name'] ?? 'Ev sahibi',
      'away': away?['mediumName'] ?? away?['name'] ?? 'Deplasman',
    };

    final oynanma = ref.watch(_dailyPlayedProvider(roundId));
    final oran = ref.watch(_dailyOddsProvider(roundId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ——— RADAR 3 ———
        _Kart(
          baslik: 'Radar 3 · Oynanma DNA',
          alt:
              '$no. sıra — günlük 1/X/2 oynanma yüzdeleri. Her kaynak ayrı '
              'satır; dokununca o kaynağın geçmişi açılır.',
          children: [
            oynanma.when(
              loading: () => const _Bekle(),
              error: (e, _) =>
                  Text('Oynanma verisi okunamadı: $e', style: _bos),
              data: (d) {
                final secili = _oynanmaGun ?? _sonGun(d['days'] as List?);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _GunSecici(
                      gunler: d['days'] as List?,
                      secili: secili,
                      onSec: (g) => setState(() => _oynanmaGun = g),
                    ),
                    PublicRow(
                      item: satir,
                      data: d,
                      day: secili,
                      openKey: _acikDna,
                      onToggleDna: (k) => setState(() => _acikDna = k),
                      dnaPanelBuilder: (kaynak) => PlayedDnaPanel(
                        roundId: roundId,
                        no: no,
                        source: kaynak,
                        day: secili,
                        // Maç detayında otomatik tazeleme yok (Radar ekranının
                        // 60 sn'lik sayacı buraya taşınmadı — kaynakta da 0).
                        tick: 0,
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),

        // ——— RADAR 4 ———
        _Kart(
          baslik: 'Radar 4 · Oran Takibi',
          alt:
              '$no. sıra — maç öncesi mühürlenmiş günlük 1/X/2 oranı ve bir '
              'önceki güne göre yönü.',
          children: [
            oran.when(
              loading: () => const _Bekle(),
              error: (e, _) => Text('Oran verisi okunamadı: $e', style: _bos),
              data: (d) {
                final secili = _oranGun ?? _sonGun(d['days'] as List?);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _GunSecici(
                      gunler: d['days'] as List?,
                      secili: secili,
                      onSec: (g) => setState(() => _oranGun = g),
                    ),
                    MarketRow(item: satir, data: d, day: secili),
                  ],
                );
              },
            ),
          ],
        ),
      ],
    );
  }
}

/// Gün seçici — Radar ekranındakiyle aynı mantık, dar alana göre kısaltılmış.
class _GunSecici extends StatelessWidget {
  const _GunSecici({
    required this.gunler,
    required this.secili,
    required this.onSec,
  });

  final List? gunler;
  final String? secili;
  final ValueChanged<String> onSec;

  @override
  Widget build(BuildContext context) {
    if (gunler == null || gunler!.isEmpty) return const SizedBox.shrink();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          for (final g in gunler!.cast<Map>()) ...[
            _gun(g),
            const SizedBox(width: 5),
          ],
        ],
      ),
    );
  }

  Widget _gun(Map g) {
    final acik = g['date'] == secili;
    final gelecek = g['future'] == true;
    final weekday = '${g['weekday'] ?? ''}';
    final date = '${g['date'] ?? ''}';

    return Semantics(
      button: true,
      label: '${weekday.isNotEmpty ? weekday : date} gününü seç',
      child: Opacity(
        opacity: gelecek ? 0.55 : 1,
        child: GestureDetector(
          onTap: () => onSec(date),
          behavior: HitTestBehavior.opaque,
          child: Container(
            constraints: const BoxConstraints(minWidth: 46),
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(
              color: acik ? AppColors.primary : AppColors.bgAlt,
              borderRadius: AppRadius.smR,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _kisaGun[weekday] ?? (weekday.isNotEmpty ? weekday : date),
                  style: TextStyle(
                    color: acik ? AppColors.white : AppColors.textSoft,
                    fontSize: 11,
                    fontWeight: AppFont.heavy,
                  ),
                ),
                Text(
                  date.length > 5 ? date.substring(5) : date,
                  style: TextStyle(
                    color: acik ? AppColors.white : AppColors.textMuted,
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Kart extends StatelessWidget {
  const _Kart({this.baslik, this.alt, required this.children});

  final String? baslik;
  final String? alt;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: Spacing.md),
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: AppRadius.mdR,
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (baslik != null)
          Text(
            baslik!,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 13.5,
              fontWeight: AppFont.black,
            ),
          ),
        if (alt != null)
          Padding(
            padding: const EdgeInsets.only(top: 2, bottom: 8),
            child: Text(
              alt!,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 10.5,
                height: 14 / 10.5,
              ),
            ),
          ),
        ...children,
      ],
    ),
  );
}

class _Bekle extends StatelessWidget {
  const _Bekle();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 12),
    child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
  );
}

const TextStyle _bos = TextStyle(
  color: AppColors.textMuted,
  fontSize: 11.5,
  height: 16 / 11.5,
);
