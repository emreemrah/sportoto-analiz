// TAKIM TEMASI — ÇALIŞMA ZAMANI KATMANI (kullanıcı isteği, 2026-08-11)
//
// Favori takım değiştiğinde uygulama YENİDEN BAŞLATILMADAN o takımın paletine
// geçer. Palet `auth.authState` üzerinden okunur (favori takım zaten orada
// tutuluyor), bu yüzden profil ekranında takım değişince ağaç kendiliğinden
// yeniden kurulur.
//
// ═══════ NEDEN AYRI BİR KATMAN — `AppColors` DEĞİŞTİRİLMEDİ ═══════════════
// Ölçüldü (2026-08-11): `AppColors` sabitleri 1834 yerde kullanılıyor ve tek
// bir rengi `const` olmaktan çıkarmak 221 derleme hatası veriyor — yani
// kullanımların ~%89'u `const` bağlamında. Bütün paleti çalışma zamanına
// çevirmek ~1600 noktada `const` kaldırmayı gerektirirdi; bu hem tek seferde
// güvenle yapılamaz hem de her kaldırılan `const` yeniden çizim maliyetidir.
//
// Bu yüzden mimari KATMANLI:
//   • `AppColors`  → VARSAYILAN palet, `const` kalır, hiçbir şey kırılmaz.
//   • `TakimTemasi` → çalışma zamanı palet; YAPISAL yüzeyler bunu okur.
// Takım seçilmemişse ya da eşleşme yoksa erişimciler `AppColors`a düşer;
// uygulama bugünkü hâliyle birebir aynı görünür.
//
// ═══════ ANLAMSAL RENKLER BU KATMANDA YOK ═════════════════════════════════
// success / danger / warning / info ve "canlı", "kilitli" göstergeleri
// `AppColors` üzerinden sabit okunmaya devam eder. Kırmızı takım seçildiğinde
// kırmızının "mağlubiyet" anlamı, sarı takımda uyarı sarısı kaybolmaz.

import 'package:flutter/material.dart';

import '../auth.dart' as auth;
import 'takim_paleti.dart';
import 'takim_renkleri.dart';

/// Ağaçta gezen palet. `null` → varsayılan tema.
class TakimTemasi extends InheritedWidget {
  const TakimTemasi({super.key, required this.palet, required super.child});

  final TakimPaleti? palet;

  static TakimPaleti? paletOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<TakimTemasi>()?.palet;

  /// Yalnız TAKIM değişince haber verilir; aynı takımın paleti yeniden
  /// üretildiğinde ağaç boşuna çizilmez.
  @override
  bool updateShouldNotify(TakimTemasi eski) =>
      eski.palet?.takim != palet?.takim;
}

/// Favori takımın paletine erişim.
///
/// YAPISAL RENK ERİŞİMCİLERİ KALDIRILDI (kullanıcı isteği, 2026-08-12).
/// Burada eskiden `temaZemin` / `temaYuzey` / `temaKenarlik` / `temaVurgu` /
/// `temaSecili` / `temaYuzeyMetin` / `temaSolukMetin` vardı ve alt çubuk ile
/// sekme çubuğu renklerini oradan alıyordu. Yeni kural: uygulamanın zemini,
/// metni, kartı ve navigasyonu YALNIZ görünüm tercihinden gelir
/// (`gorunum.dart`). O yüzeyler artık doğrudan `AppColors` okuyor.
///
/// Geriye kalan tek erişimci paletin KENDİSİDİR: takım kimliği gösteren
/// yüzeyler (profil, arma, filigran, küçük takım vurguları) onu okur.
extension TakimTemasiErisim on BuildContext {
  TakimPaleti? get takimPaleti => TakimTemasi.paletOf(this);
}

/// Favori takımı dinleyip paleti ağaca veren kabuk.
///
/// `MaterialApp` içine `builder` ile takılır; böylece rotalar, modallar ve alt
/// sayfalar da aynı paleti görür (hepsi Navigator'ın altındadır).
class TakimTemasiKabugu extends StatelessWidget {
  const TakimTemasiKabugu({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<auth.AuthState>(
    valueListenable: auth.authState,
    builder: (_, s, _) =>
        TakimTemasi(palet: favoriTakimPaleti(s), child: child),
  );
}

/// Oturumdaki favori takımın paleti; yoksa null.
TakimPaleti? favoriTakimPaleti(auth.AuthState s) =>
    takimPaletiBul('${s.user?['favorite_team'] ?? ''}');
