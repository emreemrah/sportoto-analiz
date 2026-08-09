// KAYNAK: app/src/components/RadarTabHeaders.js — BİREBİR çeviri (widget'lar).
//
// RADAR SEKME BAŞLIKLARI — Radar 3/4 gün paneli ve Radar 1/2/performans üst
// notları. Kaynak dosyanın kaynak-kodu/ad/renk eşlemesi provider_labels.dart
// içindedir; Radar 5 (bulletinMemory) başlığı radar_memory.dart'tadır. Burada
// kaynağın GERİ KALANI durur: DayChipsRow, OddsCounter, GunCekimBilgisi ve
// sekme üst paneli dalları.
//
// Panellerdeki metinler ürünün dürüstlük sözleşmesidir; sadeleştirilmemeli:
//  * Radar 3 (oynanma YÜZDESİ) ile Radar 4 (gerçek ORAN) her panelde ayrı ayrı
//    ayrıştırılır — kullanıcı ikisini karıştırırsa yanlış sonuç çıkarır.
//  * "Mühürlenir ve sonradan değişmez" cümlesi her iki panelde de durur.
//  * Kaynak yoksa uydurma yüzde gösterilmez; bunun söylendiği satır da burada.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../widgets/info_ipucu.dart';

/// Hücre "var" mı? Kaynaktaki `m.cells?.[date]` doğruluk denetiminin birebir
/// karşılığı: null dışı her değer (BOŞ NESNE DAHİL) var sayılır. Bu bilinçli:
/// çip soluklaştırma kozmetiktir; "hangi gün varsayılan açılır" kararı ise
/// radar_screen_logic.hucreDolu ile boş nesneyi ELER. İki ölçüt karışmamalı.
bool _hucreVar(Map? m, String date) => (m?['cells'] as Map?)?[date] != null;

Map? _gunBul(Map? data, String? day) => ((data?['days'] as List?) ?? const [])
    .cast<Map>()
    .where((x) => x['date'] == day)
    .firstOrNull;

/// SEÇİLİ GÜNÜN ÇEKİM SAATİ — "bu günün sayıları kaynaktan kaçta alındı".
///
/// İLK SÜRÜM YANLIŞTI: haftanın EN SON çekimini yazıyordu ("Son güncelleme:
/// 22:39"). Kullanıcı Pazar sekmesine bakarken Pazartesi'nin saatini görüyordu
/// ve haklı olarak "ne alaka" dedi. Ekranda TEK GÜN görünür; o yüzden buradaki
/// saat de SEÇİLİ GÜNE ait olmalı.
///
/// Saat SUNUCUDA İstanbul'a çevrilir (`days[].lastObservedLabel`); cihazın
/// saat dilimi yanlışsa burada yanlış saat görünmesin diye biçimlendirme
/// yapılmaz. O gün gözlem alınmamışsa saat UYDURULMAZ, sebebi yazılır.
class GunCekimBilgisi extends StatelessWidget {
  const GunCekimBilgisi({super.key, required this.data, required this.day});

  final Map? data;
  final String? day;

  @override
  Widget build(BuildContext context) {
    final d = _gunBul(data, day);
    if (d == null || d['future'] == true) {
      return const SizedBox.shrink(); // gelecek günde çekim beklenmez
    }
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Text(
        '${d['label']} · '
        '${d['lastObservedLabel'] != null ? 'kaynaktan son çekim ${d['lastObservedLabel']}' : 'bu gün için kayıt alınamadı'}',
        style: const TextStyle(
          // Verinin yaşı — uyarı değil, olgu. Bu yüzden uyarı sarısı değil
          // sönük ton.
          color: AppColors.textMuted,
          fontSize: 11,
          fontWeight: AppFont.heavy,
        ),
      ),
    );
  }
}

/// Gün çipleri (Pazar→Cuma). Verisi olmayan gün soluk gösterilir, GİZLENMEZ.
class DayChipsRow extends StatelessWidget {
  const DayChipsRow({
    super.key,
    required this.data,
    required this.selected,
    required this.onSelect,
  });

  final Map? data;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final days = (data?['days'] as List?) ?? const [];
    if (days.isEmpty) return const SizedBox.shrink();
    final matches = ((data?['matches'] as List?) ?? const []).cast<Map>();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.only(top: 2, bottom: 10),
      child: Row(
        children: [
          for (final raw in days.cast<Map>()) ...[
            _gunCipi(raw, matches),
            const SizedBox(width: 6),
          ],
        ],
      ),
    );
  }

  Widget _gunCipi(Map day, List<Map> matches) {
    final date = '${day['date']}';
    final on = selected == date;
    final has = matches.any((m) => _hucreVar(m, date));
    final label = '${day['label'] ?? ''}'.split(' ');

    // Alt satır: tarih + O GÜNÜN son çekim saati. Her gün ayrı mühürlendiği
    // için her günün kendi tazeliği vardır — Salı 23:52'de kapanmış, Çarşamba
    // 14:03'te susmuş olabilir. Saat yoksa (o gün gözlem alınamamış) "· yok"
    // yazar; uydurulmaz.
    final alt =
        (label.length > 1 ? label[1] : '') +
        (day['lastObservedLabel'] != null
            ? ' · ${day['lastObservedLabel']}'
            : (has ? '' : ' · yok'));

    // Kaynakta verisiz gün kesikli çerçeveyle de ayrışır; Flutter'da düz
    // Border kesikli çizilemediği için o ayrım yalnız solukluğa taşındı.
    return Opacity(
      opacity: !has && !on ? 0.55 : 1,
      child: GestureDetector(
        onTap: () => onSelect(date),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: on ? AppColors.primary : AppColors.card,
            borderRadius: AppRadius.pillR,
            border: Border.all(
              color: on ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${day['weekday']}${day['isMatchDay'] == true ? ' ⚽' : ''}',
                style: TextStyle(
                  color: on ? const Color(0xFFFFFFFF) : AppColors.textSoft,
                  fontSize: 12,
                  fontWeight: AppFont.heavy,
                ),
              ),
              Text(
                alt,
                style: TextStyle(
                  color: on ? const Color(0xFFFFFFFF) : AppColors.textMuted,
                  fontSize: 9.5,
                  fontWeight: AppFont.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// SAYAÇ (Radar 4): "15 maçın 5'inde oran var". Ekranda TEK GÜN görüldüğü için
/// asıl sayı o güne aittir; eksik olanların sebebi kendi satırlarında yazar.
/// Sayı arka uçtan gelir (day.withData) — burada uydurulmaz/tahmin edilmez.
class OddsCounter extends StatelessWidget {
  const OddsCounter({super.key, required this.data, required this.day});

  final Map? data;
  final String? day;

  @override
  Widget build(BuildContext context) {
    final d = _gunBul(data, day);
    final matches = ((data?['matches'] as List?) ?? const []).cast<Map>();
    final toplam =
        ((data?['counts'] as Map?)?['total'] as num?)?.toInt() ??
        matches.length;
    if (toplam == 0 || d == null) return const SizedBox.shrink();
    final varOlan =
        (d['withData'] as num?)?.toInt() ??
        matches.where((m) => day != null && _hucreVar(m, day!)).length;
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 2),
      child: Text(
        "${d['label']}: $toplam maçın $varOlan'inde oran var"
        '${varOlan < toplam ? ' · ${toplam - varOlan} maçta yok (sebebi satırında yazıyor)' : ''}',
        style: const TextStyle(
          color: AppColors.textMuted,
          fontSize: 11.5,
          fontWeight: AppFont.bold,
        ),
      ),
    );
  }
}

Widget _not(String metin) => Padding(
  padding: const EdgeInsets.only(top: 8),
  child: Text(
    metin,
    style: const TextStyle(
      color: AppColors.textMuted,
      fontSize: 11.5,
      height: 16 / 11.5,
    ),
  ),
);

/// RADAR 3/4 ÜST PANELİ — ⓘ açıklama + gün çipleri + (Radar 4'te) oran sayacı
/// + seçili günün çekim bilgisi. Veri yokken dürüst not gösterir; [data] null
/// iken (istek sürüyor) "yükleniyor" metni kaynaktaki gibi burada yazılır.
class RadarGunlukUstPanel extends StatelessWidget {
  const RadarGunlukUstPanel({
    super.key,
    required this.oynanma,
    required this.data,
    required this.seciliGun,
    required this.onGunSec,
  });

  /// true → Radar 3 (publicBetting) · false → Radar 4 (market).
  final bool oynanma;
  final Map? data;
  final String? seciliGun;
  final ValueChanged<String> onGunSec;

  @override
  Widget build(BuildContext context) {
    final gunler = (data?['days'] as List?) ?? const [];

    // RADAR 4 — ORAN TAKİBİ: gün filtreleri (Pazar→Cuma) + Radar 3/4 ayrımı.
    if (!oynanma) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // MOBİL SADELİK (2026-08-06): açıklamalar ⓘ arkasında — yer kaplamaz.
          const InfoIpucu(
            ozet: '💹 Oran Takibi · Günlük 1/X/2 Oranları',
            detay:
                'Gerçek 1/X/2 maç oranlarının gün gün hareketi. Bir gün seçin; '
                '15 maçın o güne ait mühürlü oranı kendi satırında görünür '
                '(ör. 1: 1.61 · X: 3.20 · 2: 4.25). Oran bir önceki güne göre '
                'yükseldi (▲), düştü (▼) veya sabit (=) olarak işaretlenir.\n\n'
                'Radar 3 (Oynanma DNA) kullanıcıların oynama YÜZDESİNİ, Radar 4 '
                'ise gerçek 1/X/2 ORANINI gösterir — burada yüzde değil, oran '
                'vardır.\n\n'
                "Her günün oranı 23:55'te (maç günü ilk maçtan 5 dk önce) "
                'mühürlenir ve sonradan değişmez.',
          ),
          if (gunler.isNotEmpty) ...[
            DayChipsRow(data: data, selected: seciliGun, onSelect: onGunSec),
            OddsCounter(data: data, day: seciliGun),
            GunCekimBilgisi(data: data, day: seciliGun),
          ] else
            _not(
              data != null
                  ? '${data!['note'] ?? 'Bu hafta için oran kaydı yok.'}'
                  : 'Oran kayıtları yükleniyor…',
            ),
        ],
      );
    }

    // RADAR 3 — OYNANMA DNA: gün filtreleri (Pazar→Cuma) + günlük mühürlü yüzde.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // MOBİL SADELİK (2026-08-06): açıklamalar ⓘ arkasında. VERİ YOKLUĞU
        // notu ⓘ DIŞINDA görünür kalır — dürüstlük kuralı gizlenmez.
        const InfoIpucu(
          ozet: '📊 Oynanma DNA · Günlük 1/X/2 Yüzdeleri',
          detay:
              'Kullanıcıların 1/X/2 OYNAMA YÜZDESİNİN gün gün değişimi. Bir '
              'gün seçin; 15 maçın o güne ait mühürlü yüzdesi kendi satırında '
              'görünür (ör. 1 %62 · X %21 · 2 %17). Yüzde bir önceki güne göre '
              'yükseldi (▲), düştü (▼) veya sabit (=) olarak işaretlenir.\n\n'
              'Bu bir ORAN değildir — Radar 4 (Oran Takibi) gerçek oranı '
              'gösterir; Radar 3 oynanma yüzdesidir.\n\n'
              "Her günün yüzdesi 23:55'te (maç günü ilk maçtan 5 dk önce) "
              'mühürlenir ve sonradan değişmez. Kaynak yoksa uydurma yüzde '
              'gösterilmez.',
        ),
        if (data != null && ((data!['sources'] as List?) ?? const []).isEmpty)
          _not('Kaynak yok — veri bekleniyor (uydurma yüzde gösterilmez).'),
        // KAYNAK LEJANTI eskiden kaldırılmıştı; VERİ YOKLUĞU notu yukarıda
        // GÖRÜNÜR duruyor (ⓘ'ye saklanmaz — dürüstlük kuralı).
        if (gunler.isNotEmpty) ...[
          DayChipsRow(data: data, selected: seciliGun, onSelect: onGunSec),
          // Çekim saati çiplerin ALTINDA: hangi güne ait olduğu ancak gün
          // seçildikten sonra anlamlı. Başlıkta dururken haftanın en son
          // saatini gösteriyordu ve seçili günle ilgisizdi.
          GunCekimBilgisi(data: data, day: seciliGun),
        ] else
          _not(
            data != null
                ? '${data!['note'] ?? 'Oynanma yüzdesi gözlemi yok — veri kaynağı bekleniyor.'}'
                : 'Yükleniyor…',
          ),
      ],
    );
  }
}

/// RADAR 1/2/PERFORMANS ÜST NOTU — performans sekmesinde metodoloji ⓘ'si;
/// hiçbir maçta veri yoksa "devre dışı" paneli. Master ve Radar 5 başlıkları
/// burada DEĞİL (Master'da panel yok; Radar 5 radar_memory.dart'ta).
class RadarSekmePaneli extends StatelessWidget {
  const RadarSekmePaneli({super.key, required this.tab, required this.matches});

  final String tab;
  final List matches;

  @override
  Widget build(BuildContext context) {
    final items = matches
        .cast<Map>()
        .map((mm) => (mm['radars'] as Map?)?[tab])
        .whereType<Map>()
        .toList();
    final anyData = items.any((r) => r['hasData'] == true);

    if (tab == 'performance' && anyData) {
      // MOBİL SADELİK (2026-08-06): açıklama ⓘ arkasında.
      return const InfoIpucu(
        ozet: '🛡 Rakip Gücü & Saha Performansı',
        detay:
            'Form, rakibin MAÇ TARİHİNDEKİ ligdeki yerine göre tartılır '
            '(bugünkü tablo geçmişe uygulanmaz). Ev sahibi yalnız İÇ SAHA, '
            'deplasman yalnız DEPLASMAN maçlarıyla değerlendirilir. Zayıf '
            'rakiplere karşı gelen seriler "Şişirilmiş Form", güçlü rakiplere '
            'karşı gelenler "Kaliteli Form" olarak etiketlenir; ham form da '
            'ayrıca gösterilir — hiçbir veri gizlenmez.',
      );
    }

    if (!anyData) {
      return Container(
        margin: const EdgeInsets.only(bottom: Spacing.sm),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadius.mdR,
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '— Bu radar bu hafta devre dışı',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: AppFont.black,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${items.firstOrNull?['note'] ?? 'Gerekli veri bulunamadı; skora katkısı yok.'}',
                style: const TextStyle(
                  color: AppColors.textSoft,
                  fontSize: 11.5,
                  height: 16 / 11.5,
                ),
              ),
            ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }
}
