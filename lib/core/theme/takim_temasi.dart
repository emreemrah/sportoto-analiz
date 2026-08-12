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
import 'tokens.dart';

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

/// Yapısal renk erişimcileri. Her biri palet yoksa `AppColors`a düşer —
/// çağıran tarafta `?? AppColors.x` yazmak gerekmesin.
extension TakimTemasiErisim on BuildContext {
  TakimPaleti? get takimPaleti => TakimTemasi.paletOf(this);

  /// Uygulama ana arka planı.
  Color get temaZemin => takimPaleti?.zemin ?? AppColors.bg;

  /// Kart ve yüzeyler.
  Color get temaYuzey => takimPaleti?.yuzey ?? AppColors.card;

  /// Kenarlık ve ayırıcılar.
  Color get temaKenarlik => takimPaleti?.kenarlik ?? AppColors.border;

  /// Birincil vurgu (butonlar, etkin göstergeler).
  Color get temaVurgu => takimPaleti?.vurgu ?? AppColors.accent;

  /// Seçili durum (etkin sekme, işaretli seçenek).
  Color get temaSecili => takimPaleti?.secili ?? AppColors.primary;

  /// Zemin üzerindeki metin — parlaklıktan hesaplanır.
  Color get temaZeminMetin => takimPaleti?.zeminUstuMetin ?? AppColors.text;

  /// Yüzey (kart) üzerindeki metin.
  Color get temaYuzeyMetin => takimPaleti?.yuzeyUstuMetin ?? AppColors.text;

  /// Vurgu üzerindeki metin (buton yazısı).
  Color get temaVurguMetin => takimPaleti?.vurguUstuMetin ?? AppColors.white;

  /// İkincil/soluk metin — yüzey metninin yumuşatılmış hâli.
  Color get temaSolukMetin {
    final p = takimPaleti;
    if (p == null) return AppColors.textMuted;
    // Yüzey açıksa metni açarak, koyuysa karartarak soluklaştır: her iki uçta
    // da okunur kalsın.
    return gorecelParlaklik(p.yuzey) > 0.4
        ? acikla(p.yuzeyUstuMetin, 0.45)
        : karart(p.yuzeyUstuMetin, 0.35);
  }
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
