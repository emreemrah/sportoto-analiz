// TAKIM TEMASI — YAPISAL RENKLERİ TAKIM PALETİNE ÇEVİRME
//
// Kullanıcı isteği (2026-08-12, ikinci tur): görünüm seçeneklerine dördüncü
// bir seçenek eklendi — "Takım teması". YALNIZ bu seçildiğinde uygulamanın
// genel teması favori takımın renklerine döner. Açık / koyu / sistem
// seçeneklerinde takım rengi yapısal yüzeylere HİÇ karışmaz.
//
// TARİHÇE: bu dosyanın içeriği `tema_uygula.dart`tan gelir. O dosya takım
// temasını ZORUNLU kıldığı için kaldırılmıştı (baf98aa); şimdi aynı hesap
// İSTEĞE BAĞLI bir mod olarak geri döndü. Hesabın kendisi değişmedi, yalnız
// ne zaman çalıştığı değişti.
//
// ANLAMSAL RENKLERE DOKUNULMAZ: success / warning / danger / info / live ve
// green / yellow / red / gold / field `const`tur ve burada hiç geçmez.
// Kırmızı takım seçilse bile "hata" kırmızısı değişmez.

import 'dart:ui';

import 'package:flutter/painting.dart';

import 'takim_paleti.dart';
import 'tokens.dart';

/// Takım temasının ÜST DÜZEY parlaklığı — `ThemeData` ve durum çubuğu için.
///
/// Palet zaten iki uçtan birine oturuyor (bkz. `paletUret`: "tema ya açık ya
/// koyu, arası yok"), bu yüzden zeminin parlaklığına bakmak yeterli.
Brightness takimParlakligi(TakimPaleti p) =>
    gorecelParlaklik(p.zemin) > 0.5 ? Brightness.light : Brightness.dark;

/// Yapısal `AppColors` alanlarını [p] takım paletine çevirir.
///
/// ═══════════ TERS KONTRAST (kullanıcı isteği, 2026-08-12) ═════════════════
///   zemin  = takımın BİRİNCİ rengi        → üstündeki yazı İKİNCİ renk
///   kart   = takımın İKİNCİ rengi         → üstündeki yazı BİRİNCİ renk
/// Beyaz artık varsayılan kart rengi DEĞİL; yalnız hiçbir tonun eşiği
/// tutmadığı son çarede destek rengi olarak devreye girer (`okunurMetin`).
///
/// Renkler `kimlikTonu` ile itilir: HSL parlaklığı oynar, hue ve doygunluk
/// KORUNUR. Bu yüzden "krem / pembe / kahverengi / alakasız mavi" üretilmez.
///
/// İdempotenttir: aynı palet iki kez uygulanabilir.
void takimGorunumunuUygula(TakimPaleti p) {
  // ── ZEMİN VE KART ────────────────────────────────────────────────────────
  AppColors.background = p.zemin;
  AppColors.bg = p.zemin;
  AppColors.surface = p.yuzey;
  AppColors.card = p.yuzey;

  // ARA YÜZEY (şerit, çip zemini): kartın kendi tonu — beyaza/griye KAÇMAZ.
  // Kartın metnini okutmak zorunda, yoksa şeritteki yazı kayboluyor.
  final araYuzey = _komsuTon(p.yuzey, p.metin);
  AppColors.surfaceSoft = araYuzey;
  AppColors.bgAlt = araYuzey;
  AppColors.cardAlt = araYuzey;
  AppColors.track = araYuzey;

  // ── METİN: HANGİ YÜZEYDE DURDUĞUNA GÖRE ──────────────────────────────────
  AppColors.text = p.metin; // kartın üstünde → ana rengin tonu
  AppColors.onBackground = p.zeminMetni; // zeminin üstünde → ikincil tonu

  // Soluk tonlar kendi yüzeylerine göre ayrı hesaplanır. Kart metni ÜÇ
  // yüzeye birden düşüyor (kart, ara şerit, çip); en zoruna göre ayarlanır.
  AppColors.textSoft = _solukAmaOkunur(p.metin, [p.yuzey, araYuzey], 0.30);
  final kartSoluk = _solukAmaOkunur(p.metin, [p.yuzey, araYuzey], 0.48);
  AppColors.muted = kartSoluk;
  AppColors.textMuted = kartSoluk;
  AppColors.gray = kartSoluk;

  AppColors.onBackgroundSoft = _solukAmaOkunur(p.zeminMetni, [p.zemin], 0.30);
  AppColors.onBackgroundMuted = _solukAmaOkunur(p.zeminMetni, [p.zemin], 0.48);

  AppColors.border = p.kenarlik;

  // ── VURGU / SEÇİLİ — buton, rozet, etkin sekme ───────────────────────────
  // Kullanıcı kuralı: "Butonlar, seçili sekmeler, rozetler ve vurgular bu
  // ters renk düzenine uysun."
  // `primary` VE `accent` İKİSİ DE KART YÜZEYİ İÇİNDİR: uygulamadaki
  // kullanımların ezici çoğunluğu kart içindedir (ölçüldü: 62 `accent`
  // kullanımının neredeyse tamamı). `accent`i zemin için türetmek kartın
  // üstündeki alt başlıkları ve bağlantıları görünmez yapıyordu — maç
  // detayında "BAĞIMSIZ ANALİZ UYGULAMASI" ve "maçlar ›" kırmızı kartta
  // kırmızı kalıyordu.
  //
  // ZEMİN ÜSTÜ vurgu ayrı tokendan gelir: `onBackgroundAccent`.
  AppColors.primary = p.vurgu;
  AppColors.onPrimary = p.vurguMetni;
  AppColors.primaryDark = _komsuTon(p.vurgu, p.vurguMetni);
  AppColors.accent = p.vurgu;
  AppColors.onAccent = p.vurguMetni;
  AppColors.onBackgroundAccent = p.secili;

  // Yumuşak rozet zeminleri: ÜSTLERİNDE aynı renk YAZI olarak duruyor
  // (`Pill`), o yüzden ikisi de AA sağlamak zorunda.
  AppColors.primarySoft = _yumusakZemin(p.vurgu);
  AppColors.accentSoft = AppColors.primarySoft;
  AppColors.onPrimarySoft = _solukAmaOkunur(p.vurguMetni, [p.vurgu], 0.28);

  // ── HERO — vurgulu büyük panel ───────────────────────────────────────────
  // Kart ailesinden: ikincil renk. Marka temasındaki lacivert hero'nun
  // karşılığı.
  AppColors.heroZemin = p.yuzey;
  AppColors.onHero = p.metin;
  AppColors.onHeroSoft = AppColors.textSoft;

  // ── YAN MENÜ / KOYU PANELLER ─────────────────────────────────────────────
  // Kullanıcı ayrıca işaret etti: "yan menüde eski sabit koyu gri, kahverengi,
  // beyaz veya lacivert yüzeyler kalmasın." Bu üçlü artık SABİT DEĞİL, takımın
  // iki renginden türüyor.
  //
  // Panel KART ailesindendir (ikincil renk); satırları ara tonu, yazısı kart
  // metni. Böylece panel zeminden ayrışır ama takımın dışına çıkmaz.
  AppColors.darkCard = p.yuzey;
  AppColors.darkCardSoft = araYuzey;
  AppColors.onDark = p.metin;
  AppColors.onDarkSoft = AppColors.textSoft;
  AppColors.darkBorder = p.kenarlik;

  // ── ANLAMSAL YUMUŞAK YÜZEYLER ────────────────────────────────────────────
  // Rozet/uyarı kartlarının zemini. HUE anlamsal renkten, PARLAKLIK karttan:
  // yüzey "uyarı sarısı ailesinden" kalır ama temanın içine oturur. Sabit
  // krem/pembe değerler takım temasının ortasında tema dışı kart bırakıyordu.
  AppColors.successSoft = _anlamsalYuzey(AppColors.success, p.yuzey);
  AppColors.warningSoft = _anlamsalYuzey(AppColors.warning, p.yuzey);
  AppColors.dangerSoft = _anlamsalYuzey(AppColors.danger, p.yuzey);
  AppColors.infoSoft = _anlamsalYuzey(AppColors.info, p.yuzey);
}

/// Anlamsal yumuşak yüzey: [anlamsal] rengin HUE'su, [kart]ın parlaklık
/// ailesi.
///
/// Açık kartta bir tık koyu, koyu kartta bir tık açık durur — böylece
/// karttan AYRIŞIR ama aynı uçta kalır. Doygunluk düşürülür ki zemin
/// bağırmasın; hue korunduğu için "uyarı", "hata", "başarı" ailesi belli
/// olmaya devam eder.
Color _anlamsalYuzey(Color anlamsal, Color kart) {
  final kartL = HSLColor.fromColor(kart).lightness;
  final h = HSLColor.fromColor(anlamsal);
  final hedefL = kartL > 0.5
      ? (kartL - 0.10).clamp(0.0, 1.0)
      : (kartL + 0.12).clamp(0.0, 1.0);
  return h
      .withLightness(hedefL)
      .withSaturation((h.saturation * 0.55).clamp(0.0, 1.0))
      .toColor();
}

/// [renk]in KOMŞU tonu — aynı hue, bir tık farklı parlaklık.
///
/// Yön [ustundekiMetin]in tersidir: koyu yazılı bir yüzey açılır, açık yazılı
/// bir yüzey koyulaşır. Böylece ara ton her zaman metinden UZAKLAŞIR.
/// Ayrımı görünür kılmak için en az 1.12 kontrast aranır.
Color _komsuTon(Color renk, Color ustundekiMetin) {
  final metinKoyu = gorecelParlaklik(ustundekiMetin) < 0.5;
  final l = HSLColor.fromColor(renk).lightness;
  for (var adim = 4; adim <= 40; adim += 2) {
    final hedef = metinKoyu ? l + adim / 100 : l - adim / 100;
    if (hedef < 0 || hedef > 1) break;
    final aday = tonla(renk, hedef);
    if (kontrastOrani(aday, renk) >= 1.12 &&
        kontrastOrani(ustundekiMetin, aday) >= kAaEsigi) {
      return aday;
    }
  }
  // Ton ekseni bitti — metni okutmak ayrımdan önce gelir.
  return renk;
}

/// Rozet/çip zemini: [renk]in yumuşak tonu, ama ÜSTÜNDE [renk] YAZI olarak
/// okunacak kadar ondan uzak. Hue korunur — gri/krem üretilmez.
Color _yumusakZemin(Color renk) {
  final acigaGit = gorecelParlaklik(renk) < 0.5;
  final l = HSLColor.fromColor(renk).lightness;
  for (var i = 1; i <= 100; i++) {
    final hedef = acigaGit ? l + i / 100 : l - i / 100;
    if (hedef < 0 || hedef > 1) break;
    final aday = tonla(renk, hedef);
    if (kontrastOrani(aday, renk) >= kAaEsigi) return aday;
  }
  // Hue ekseninde yer kalmadı → son çare beyaz/siyah (erişilebilirlik).
  return acigaGit ? const Color(0xFFFFFFFF) : const Color(0xFF000000);
}

/// İkincil yazı rengi: [metin]i soluklaştırır ama [zeminler]in HEPSİNDE AA
/// eşiğini korur. Ton korunur — soluk yazı griye kaymaz.
Color _solukAmaOkunur(Color metin, List<Color> zeminler, double oran) {
  final l = HSLColor.fromColor(metin).lightness;
  // Soluklaşma yönü zeminden UZAK değil, zemine DOĞRU olur; sonra AA'yı
  // tutana dek geri çekilir.
  final zeminAcik = gorecelParlaklik(zeminler.first) > 0.5;
  final hedef = zeminAcik ? l + oran * (1 - l) : l - oran * l;
  var aday = tonla(metin, hedef);
  var adim = 0;
  bool tamam() => zeminler.every((z) => kontrastOrani(aday, z) >= kAaEsigi);
  while (!tamam() && adim < 100) {
    final yeniL =
        HSLColor.fromColor(aday).lightness + (zeminAcik ? -0.01 : 0.01);
    if (yeniL < 0 || yeniL > 1) break;
    aday = tonla(aday, yeniL);
    adim++;
  }
  return tamam() ? aday : metin;
}
