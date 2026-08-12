// TEMA VİTRİNİ — GÖRSEL DOĞRULAMA ÜRETECİ (geçici araç, 2026-08-12)
//
// Kullanıcının istediği görsel kontrolü yapabilmek için, seçilen takım
// paletini uygulayıp yapısal yüzeylerin HEPSİNİ tek ekranda çizer ve PNG
// olarak diske yazar. Girişe, ağa ve emülatöre bağlı değildir: `temayiUygula`
// saf bir fonksiyondur, testten doğrudan çağrılabilir.
//
// Kapsanan yüzeyler kullanıcının saydıklarıdır: ana arka plan · üst çubuk ·
// kartlar · sekmeler ve seçili sekme · birincil butonlar · kenarlıklar ·
// boş durumlar · kullanıcı yan menüsü · koyu panel · anlamsal renkler.
//
// ÇALIŞTIRMA: flutter test test/tema_vitrini_uret.dart
// Çıktı: test/vitrin/<gorunum>.png (--update-goldens ile)

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:masteranaliz/core/theme/gorunum.dart';
import 'package:masteranaliz/core/theme/tokens.dart';
import 'package:masteranaliz/widgets/app_ui.dart';
import 'package:masteranaliz/widgets/dashboard_ui.dart';
import 'package:masteranaliz/widgets/form_strip.dart';
import 'package:masteranaliz/widgets/tabs.dart';

/// ARTIK TAKIM DEĞİL GÖRÜNÜM (2026-08-12): yapısal renkler favori takımdan
/// çıkarıldı, vitrin de buna göre açık/koyu çiziyor.
const _gorunumler = <String, Brightness>{
  '1-acik': Brightness.light,
  '2-koyu': Brightness.dark,
};

void main() {
  // HER GÖRÜNÜM AYRI TEST: tek testin içinde arka arkaya golden almak
  // ikinci turda kilitleniyordu (ölçüldü). Ayrı testler bağlamı sıfırlar.
  for (final giris in _gorunumler.entries) {
    testWidgets('vitrin: ${giris.key}', (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 1500));
      addTearDown(() async {
        await tester.binding.setSurfaceSize(null);
        // Vitrin başka testlerin görünümünü kirletmesin.
        gorunumuUygula(Brightness.light);
      });

      gorunumuUygula(giris.value);

      final anahtar = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: anahtar,
          child: MediaQuery(
            data: const MediaQueryData(size: Size(430, 1500)),
            child: Directionality(
              textDirection: TextDirection.ltr,
              // `TakimTemasi` sarmalayıcısı ARTIK GEREKMİYOR: sekme çubuğu ve
              // alt çubuk da renklerini doğrudan `AppColors`tan okuyor.
              child: _Vitrin(baslik: giris.key),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 120));

      // `toImage()` testin sahte-async bölgesinde ÇÖZÜLMÜYOR ("did not
      // complete" — ölçüldü). Flutter'ın bu iş için tasarlanmış yolu golden
      // karşılaştırmasıdır; `--update-goldens` PNG'yi kendisi yazar.
      await expectLater(
        find.byKey(anahtar),
        matchesGoldenFile('vitrin/${giris.key}.png'),
      );
    });
  }
}

class _Vitrin extends StatelessWidget {
  const _Vitrin({required this.baslik});

  final String baslik;

  @override
  Widget build(BuildContext context) => Container(
    color: AppColors.background,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ÜST ÇUBUK
        Container(
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 12),
          color: AppColors.primary,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'GÖRÜNÜM  ·  $baslik',
                  style: TextStyle(
                    color: AppColors.onPrimary,
                    fontSize: 15,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: AppColors.live,
                  borderRadius: AppRadius.pillR,
                ),
                child: Text(
                  'CANLI',
                  style: TextStyle(
                    color: AppColors.onLive,
                    fontSize: 10,
                    fontWeight: AppFont.black,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DashboardHero(
                        kicker: 'KICKER',
                        title: 'Hero başlık',
                        subtitle: 'Alt satır — onPrimarySoft',
                        metrics: const [
                          (value: '12', label: 'DOĞRU', tone: null),
                          (value: '3', label: 'YANLIŞ', tone: 'danger'),
                          (value: '80%', label: 'ORAN', tone: 'success'),
                        ],
                      ),
                      const SizedBox(height: 12),
                      // KART + KENARLIK
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: AppRadius.lgR,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Kart başlığı (text)',
                              style: TextStyle(
                                color: AppColors.text,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                            Text(
                              'İkincil satır (textSoft)',
                              style: TextStyle(color: AppColors.textSoft),
                            ),
                            Text(
                              'Soluk satır (muted)',
                              style: TextStyle(color: AppColors.muted),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Pill(label: 'primary'),
                                const SizedBox(width: 6),
                                Pill(label: 'accent', tone: 'accent'),
                                const SizedBox(width: 6),
                                Pill(label: 'ok', tone: 'success'),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ProgressBar(value: 62),
                            const SizedBox(height: 8),
                            FormStrip(form: ['G', 'B', 'M', 'G', 'G']),
                            const SizedBox(height: 6),
                            RecordBadges(
                              wins: 7,
                              draws: 2,
                              losses: 3,
                              played: 12,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      // SEKMELER + SEÇİLİ SEKME
                      AppTabs(
                        tabs: const ['Özet', 'Maçlar', 'Geçmiş'],
                        active: 'Maçlar',
                        onChange: (_) {},
                      ),
                      const SizedBox(height: 12),
                      // BİRİNCİL / İKİNCİL BUTON
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              alignment: Alignment.center,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: AppColors.accent,
                                borderRadius: AppRadius.mdR,
                              ),
                              child: Text(
                                'BİRİNCİL',
                                style: TextStyle(
                                  color: AppColors.onAccent,
                                  fontWeight: AppFont.black,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Container(
                              alignment: Alignment.center,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: AppRadius.mdR,
                              ),
                              child: Text(
                                'SEÇİLİ',
                                style: TextStyle(
                                  color: AppColors.onPrimary,
                                  fontWeight: AppFont.black,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      // KOYU PANEL (Haftalık Özet / bildirimler / kilit)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.darkCard,
                          borderRadius: AppRadius.lgR,
                          border: Border.all(color: AppColors.darkBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Koyu panel başlığı (onDark)',
                              style: TextStyle(
                                color: AppColors.onDark,
                                fontWeight: AppFont.bold,
                              ),
                            ),
                            Text(
                              'Koyu panel alt satırı (onDarkSoft)',
                              style: TextStyle(color: AppColors.onDarkSoft),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      // BOŞ DURUM
                      EmptyState(
                        title: 'Boş durum',
                        message: 'Bu haftaya ait kayıt yok.',
                      ),
                      const SizedBox(height: 12),
                      // ANLAMSAL RENKLER — takımdan ETKİLENMEMELİ
                      Row(
                        children: [
                          for (final s in [
                            ('BAŞARI', AppColors.success),
                            ('UYARI', AppColors.warning),
                            ('HATA', AppColors.danger),
                            ('CANLI', AppColors.live),
                          ]) ...[
                            Expanded(
                              child: Container(
                                alignment: Alignment.center,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 8,
                                ),
                                color: s.$2,
                                child: Text(
                                  s.$1,
                                  style: const TextStyle(
                                    color: Color(0xFFFFFFFF),
                                    fontSize: 9,
                                    fontWeight: AppFont.black,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              // KULLANICI YAN MENÜSÜ (sağdan açılan koyu panel)
              Container(
                width: 132,
                padding: const EdgeInsets.all(10),
                color: AppColors.darkCard,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'YAN MENÜ',
                      style: TextStyle(
                        color: AppColors.onDark,
                        fontSize: 11,
                        fontWeight: AppFont.black,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final s in ['Profil', 'Kuponlar', 'Bildirim'])
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          s,
                          style: TextStyle(
                            color: AppColors.onDarkSoft,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    Container(height: 1, color: AppColors.darkBorder),
                  ],
                ),
              ),
            ],
          ),
        ),
        // ALT MENÜ
        Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              for (var i = 0; i < 4; i++)
                Text(
                  'Sekme$i',
                  style: TextStyle(
                    color: i == 1 ? AppColors.primary : AppColors.muted,
                    fontSize: 11,
                    fontWeight: i == 1 ? AppFont.black : AppFont.medium,
                  ),
                ),
            ],
          ),
        ),
      ],
    ),
  );
}
