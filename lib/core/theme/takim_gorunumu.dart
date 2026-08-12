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
/// İdempotenttir: aynı palet iki kez uygulanabilir.
void takimGorunumunuUygula(TakimPaleti p) {
  // ZEMİN / YÜZEY
  AppColors.background = p.zemin;
  AppColors.bg = p.zemin;
  AppColors.surface = p.yuzey;
  AppColors.card = p.yuzey;

  final yuzeyAcik = gorecelParlaklik(p.yuzey) > 0.5;

  // Yardımcı yüzey: kartla zemin arasında bir ara ton (şerit, çip zemini).
  // ÜSTÜNDE DE YAZI VAR — ara tona kayarken ortak metni okutmayı bırakmamalı
  // (ölçüldü: düz kaydırmada 150 takımın 27'sinde şerit yazısı okunmuyordu).
  var araYuzey = yuzeyAcik ? karart(p.yuzey, 0.05) : acikla(p.yuzey, 0.07);
  var araAdim = 0;
  while (kontrastOrani(p.metin, araYuzey) < kAaEsigi && araAdim < 30) {
    araYuzey = yuzeyAcik ? acikla(araYuzey, 0.04) : karart(araYuzey, 0.04);
    araAdim++;
  }
  AppColors.surfaceSoft = araYuzey;
  AppColors.bgAlt = araYuzey;

  // İKİ RENK DE GÖRÜNÜR OLSUN: birincil aksiyonlar ve seçili alanlar vurgu
  // rengini kullanır — ikincil renk "küçük detay" olarak kalmaz.
  AppColors.primary = p.secili;
  AppColors.primaryDark = karart(p.secili, 0.2);
  AppColors.accent = p.vurgu;

  // ÜSTÜNDEKİ YAZI — zeminden hesaplanır. Sarı bir seçili sekmede beyaz yazı
  // okunmaz; palet zaten hangi rengin okunacağını biliyor.
  AppColors.onPrimary = p.seciliUstuMetin;
  AppColors.onAccent = p.vurguUstuMetin;

  // YUMUŞAK ZEMİNLER (rozet arkası, çip zemini, ilerleme yolu). Üstlerinde
  // `primary`/`accent` YAZI olarak duruyor (ör. `Pill`), bu yüzden ikisi de
  // AA sağlamak zorunda: yalnız "çok açık ton" üretmek yetmez.
  AppColors.primarySoft = _yumusakZemin(p.secili, yuzeyAcik);
  AppColors.accentSoft = _yumusakZemin(p.vurgu, yuzeyAcik);
  AppColors.cardAlt = AppColors.primarySoft;
  AppColors.track = AppColors.primarySoft;

  // METİN — yüzeyden hesaplanır. Palet zemin ile yüzeyi AYNI metin rengini
  // paylaşacak şekilde ürettiği için bu değer zeminde de okunur.
  AppColors.text = p.yuzeyUstuMetin;

  // SOLUK TONLAR: yazı soluklaşır ama AA eşiğinin ALTINA DÜŞMEZ. Soluk yazı
  // ÜÇ zeminin üstüne birden düşüyor (kart, ana zemin, ara şerit); en zoruna
  // göre ayarlanır, yoksa biri kazanırken diğeri kaybediyor.
  final zeminler = [p.yuzey, p.zemin, araYuzey];
  AppColors.textSoft = _solukAmaOkunur(p.metin, zeminler, 0.32);
  final soluk = _solukAmaOkunur(p.metin, zeminler, 0.52);
  AppColors.muted = soluk;
  AppColors.textMuted = soluk;
  AppColors.gray = soluk;

  AppColors.border = p.kenarlik;

  // `primary` zeminli kartlarda ikincil yazı.
  AppColors.onPrimarySoft = _solukAmaOkunur(AppColors.onPrimary, [
    p.secili,
  ], 0.30);

  // VURGULU PANEL (hero): takım temasında bu panel takımın seçili rengidir —
  // marka temasındaki lacivert hero'nun karşılığı.
  AppColors.heroZemin = p.secili;
  AppColors.onHero = p.seciliUstuMetin;
  AppColors.onHeroSoft = AppColors.onPrimarySoft;

  // KOYU PANEL zeminden AYRIŞMALI: `darkCard = p.zemin` yazıldığında panel
  // sayfanın arka planıyla birebir aynı renk oluyor ve yalnız kenarlığıyla
  // seçilebiliyordu (ölçüldü: Fenerbahçe'de ikisi de #003B7B).
  final zeminAcik = gorecelParlaklik(p.zemin) > 0.5;
  AppColors.darkCard = zeminAcik
      ? karart(p.zemin, 0.82)
      : (gorecelParlaklik(p.zemin) < 0.02
            ? acikla(p.zemin, 0.10)
            : karart(p.zemin, 0.35));
  AppColors.darkCardSoft = acikla(AppColors.darkCard, 0.08);

  // Koyu panelin üstü — `text`/`muted` AÇIK yüzeye göre üretiliyor ve açık
  // temalı bir takımda koyu panelin üstünde görünmezdi.
  AppColors.onDark = okunurMetin(AppColors.darkCard);
  AppColors.onDarkSoft = _solukAmaOkunur(AppColors.onDark, [
    AppColors.darkCard,
    AppColors.darkCardSoft,
  ], 0.32);
  AppColors.darkBorder = acikla(AppColors.darkCard, 0.16);
}

/// Rozet/çip zemini: [renk]in yumuşak tonu, ama ÜSTÜNDE [renk] yazı olarak
/// okunacak kadar ondan uzak.
Color _yumusakZemin(Color renk, bool yuzeyAcik) {
  // YÖN, RENGİN KENDİ OKUNUR METNİNE DOĞRUDUR — yüzeyin açık/koyu olmasına
  // bakmak, beyaza dayanmış bir vurgu renginde (US Lecce, Arouca, Le Mans)
  // yanlış yöne itip rozeti okunmaz bırakıyordu.
  final acigaGit = gorecelParlaklik(okunurMetin(renk)) > 0.5;
  var z = acigaGit ? acikla(renk, 0.85) : karart(renk, 0.62);
  var adim = 0;
  while (kontrastOrani(z, renk) < kAaEsigi && adim < 60) {
    final sonraki = acigaGit ? acikla(z, 0.05) : karart(z, 0.05);
    // YUVARLAMA TUZAĞI: uca çok yaklaşınca %5'lik adım aynı tamsayıya
    // yuvarlanıyor ve döngü ilerlemeden 60 turu tüketiyordu.
    if (sonraki == z) {
      z = acigaGit ? const Color(0xFFFFFFFF) : const Color(0xFF000000);
      break;
    }
    z = sonraki;
    adim++;
  }
  return z;
}

/// İkincil yazı rengi: [metin]i [oran] kadar soluklaştırır, sonra [zeminler]in
/// HEPSİNDE AA eşiğini geçene dek geri iter.
Color _solukAmaOkunur(Color metin, List<Color> zeminler, double oran) {
  final metinAcik = gorecelParlaklik(metin) > 0.5;
  var s = metinAcik ? karart(metin, oran) : acikla(metin, oran);
  var adim = 0;
  bool hepsindeOkunur() =>
      zeminler.every((z) => kontrastOrani(s, z) >= kAaEsigi);
  while (!hepsindeOkunur() && adim < 60) {
    s = metinAcik ? acikla(s, 0.05) : karart(s, 0.05);
    adim++;
  }
  return s;
}
