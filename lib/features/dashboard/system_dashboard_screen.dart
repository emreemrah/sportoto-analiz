// KAYNAK: app/src/screens/SystemDashboardScreen.js +
//         app/src/hooks/useSystemAnalysisDashboard.js +
//         app/src/services/performanceService.js → getSystemDashboard
//
// F) SİSTEM ANALİZ PANOSU — sistemin kendi başarı oranı, hata dağılımı, lig
// bazlı performans, güven/sürpriz skoru başarı grafiği.
//
// ════════════════════════════════════════════════════════════════════════════
// BU EKRAN NEDEN YALNIZ BOŞ DURUMDAN İBARET — GERÇEK SEBEP
//
// Kaynaktaki veri kaynağı `getSystemDashboard()`tur ve ilk satırı şudur:
//
//     if (!demoDataAllowed()) return null;   // üretimde mock başarı YOK
//
// Yani grafiklerin TAMAMI `mockAnalysisSnapshots` üstünde hesaplanır; gerçek
// bir uçtan tek bir sayı bile gelmez. Yayın derlemesinde `demoDataAllowed()`
// false döner, veri null gelir ve ekran "Demo karne kapalı" boş durumunu
// gösterir — aşağıdaki hâlin AYNISI.
//
// Ekran ayrıca kaynakta yalnız geliştirme derlemesinde kayıtlıdır
// (App.js: `IS_DEV_BUILD ? <Stack.Screen name="SystemDashboard" …> : null`).
//
// Bu çeviride demo kapısı DAİMA KAPALIDIR (bkz. bulletin_history_service.dart
// başlığındaki gerekçe: uydurma başarı oranı üretmemek). Dolayısıyla grafik
// kodunun ulaşabileceği HİÇBİR durum yoktur. Çalışmayacak 300 satır grafik
// yazmak yerine, ekranın gerçekten ulaşabildiği tek durum yazıldı ve sebebi
// buraya kaydedildi.
//
// GERÇEK BAŞARI İÇİN DOĞRU EKRAN: Sistem Karnesi (system_scorecard_screen.dart)
// — orada yalnız maç öncesi mühürlendiği doğrulanan tahminler sayılır.

import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../widgets/app_ui.dart';

class SystemDashboardScreen extends StatelessWidget {
  const SystemDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Analiz Detayı (Demo)')),
    body: ListView(
      padding: const EdgeInsets.all(Spacing.lg),
      children: const [
        // DEMO KAPALI (üretim): mock başarı ASLA gerçek karne yerine
        // gösterilmez.
        EmptyState(
          icon: '🧪',
          title: 'Demo karne kapalı',
          message:
              'Bu ekran yalnız demo/geliştirme verisi gösterir ve üretimde kapalıdır. '
              'Gerçek başarı için Sistem Karnesi ekranını kullanın — orada yalnız '
              'maç öncesi mühürlendiği doğrulanan tahminler sayılır.',
        ),
      ],
    ),
  );
}
