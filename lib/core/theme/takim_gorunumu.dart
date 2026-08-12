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

  // ARA YÜZEY (şerit, çip zemini) PALETTEN gelir: kartla AYNI OLMAMASI
  // türetmede garanti edilir. Burada hesaplandığında, "kartın metni hâlâ
  // okunmalı" kısıtı yüzünden döngü hep başa dönüyor ve ara yüzey KARTIN
  // AYNISI kalıyordu — ölçüldü: 150 takımın 149'unda kontrast 1.00, yani
  // kullanıcının dediği gibi "kutu olduğu anlaşılmıyordu". Artık `metin`
  // İKİ YÜZEYE göre türetiliyor (bkz. paletUret), kısıt oraya taşındı.
  final araYuzey = p.yuzeySoft;
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
  AppColors.onBackgroundAccentText = p.seciliMetni;

  // Yumuşak rozet zeminleri: ÜSTLERİNDE aynı renk YAZI olarak duruyor
  // (`Pill`), o yüzden ikisi de AA sağlamak zorunda.
  // Rozet zemini KARTTAN DA ayrışmalı: yalnız "üstündeki yazı okunsun"
  // kısıtıyla üretilince 150 takımın 47'sinde tam kartın rengine oturuyordu
  // (ölçüldü: primarySoft/kart = 1.00) ve rozetin sınırı kayboluyordu.
  AppColors.primarySoft = _yumusakZemin(p.vurgu, p.yuzey);
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
///
/// ÜSTÜNDEKİ YAZI DA OKUNMALI (2026-08-13). Rozetlerin yazısı anlamsal
/// rengin KENDİSİDİR (`Text(style: color: AppColors.success)`) ve o renk
/// `const`tur — değiştirilemez. Bu yüzden okunabilirliği ZEMİN taşır: kartın
/// parlaklığından başlanır, iki yöne birden taranır ve anlamsal rengi AA
/// eşiğinde okutan, KARTA EN YAKIN parlaklık seçilir. Eskiden zemin sadece
/// kartı takip ediyordu; takım temasında bu, kartla yazının aynı parlaklığa
/// düştüğü yerlerde rozeti GÖRÜNMEZ yapıyordu (ölçüm: 150 takımın 129'unda
/// "başarı", en kötüsü 1.00).
Color _anlamsalYuzey(Color anlamsal, Color kart) {
  final h = HSLColor.fromColor(anlamsal);
  final doygunluk = (h.saturation * 0.55).clamp(0.0, 1.0);
  final kartL = HSLColor.fromColor(kart).lightness;

  Color uret(double l) =>
      h.withLightness(l.clamp(0.0, 1.0)).withSaturation(doygunluk).toColor();

  // İKİ KISIT BİRDEN: yazı okunacak (AA) VE rozet karttan ayrışacak. Beyaz
  // kartta bu ikisi çakışabiliyor — "hata" kırmızısı beyazda 5.25 okunur ama
  // beyaz zemin karttan hiç ayrışmaz; bir tık koyulaştırınca ayrışır ve AA
  // yine tutar. Bu yüzden TÜM parlaklık aralığı taranıyor: ayrımı sağlayan
  // adaylar arasından AA'yı tutturan ve KARTA EN YAKIN olan seçilir.
  // ÖNCE YAZI OKUNSUN, AYRIM SONRA. İki kısıt BEYAZ kartta gerçekten
  // çakışıyor; ölçüldü (Beşiktaş, kart #FFFFFF, hata kırmızısı):
  //   parlaklık 0.940 → yazı 4.11, ayrım 1.175
  //   parlaklık 0.980 → yazı 4.58, ayrım 1.054
  // Yani ayrımı 1.15'te tutmak yazıyı AA'nın altına düşürüyor. Bu rozetler
  // zaten anlamsal renkte bir KENARLIK taşıyor (`Border.all(success)` —
  // bulletin_screen.dart:739, coupon_center_screen.dart:436,
  // notifications_screen.dart:72), yani kutunun sınırı dolgudan değil
  // kenarlıktan geliyor. Okunmayan yazının ise telafisi yok; sıra bu yüzden
  // "önce AA, sonra elde kalanın en yükseği".
  Color? yedek; // AA hiç tutmazsa en okunur olan
  var yedekOran = 0.0;

  // ADIM İNCE: geçerli pencere beyaz kartta 0.04 parlaklık kadar dar.
  Color? enGenisAyrim;
  var enGenisAyrimDegeri = 0.0;
  final asamalar = <double, ({Color renk, double uzaklik})?>{
    1.15: null,
    1.10: null,
  };
  for (var adim = 0; adim <= 1000; adim++) {
    final l = adim / 1000.0;
    final aday = uret(l);
    final ayrim = kontrastOrani(aday, kart);
    final oran = kontrastOrani(anlamsal, aday);
    if (oran < kAaEsigi) {
      if (ayrim >= 1.10 && oran > yedekOran) {
        yedekOran = oran;
        yedek = aday;
      }
      continue;
    }
    // AA tutuyor. Yüksek ayrım eşiklerinde KARTA EN YAKIN olanı sakla.
    for (final esik in asamalar.keys.toList()) {
      if (ayrim < esik) continue;
      final uzaklik = (l - kartL).abs();
      final onceki = asamalar[esik];
      if (onceki == null || uzaklik < onceki.uzaklik) {
        asamalar[esik] = (renk: aday, uzaklik: uzaklik);
      }
    }
    if (ayrim > enGenisAyrimDegeri) {
      enGenisAyrimDegeri = ayrim;
      enGenisAyrim = aday;
    }
  }
  for (final esik in [1.15, 1.10]) {
    final v = asamalar[esik];
    if (v != null) return v.renk;
  }
  // AA tutan hiçbir aday 1.10 ayrımı sağlamıyorsa (beyaz kart), AA'yı koru
  // ve elde kalanların EN AYRIŞANINI seç.
  return enGenisAyrim ?? yedek ?? kart;
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
Color _yumusakZemin(Color renk, Color kart) {
  final acigaGit = gorecelParlaklik(renk) < 0.5;
  final l = HSLColor.fromColor(renk).lightness;
  bool uygun(Color c) =>
      // Üstünde [renk] YAZI olarak duruyor → AA.
      kontrastOrani(c, renk) >= kAaEsigi &&
      // Kartın üstünde bir KUTU → sınırı seçilebilmeli.
      kontrastOrani(c, kart) >= 1.25;
  for (var i = 1; i <= 100; i++) {
    final hedef = acigaGit ? l + i / 100 : l - i / 100;
    if (hedef < 0 || hedef > 1) break;
    final aday = tonla(renk, hedef);
    if (uygun(aday)) return aday;
  }
  // Ters yönü de dene — bir uçta sıkışmış olabilir.
  for (var i = 1; i <= 100; i++) {
    final hedef = acigaGit ? l - i / 100 : l + i / 100;
    if (hedef < 0 || hedef > 1) break;
    final aday = tonla(renk, hedef);
    if (uygun(aday)) return aday;
  }
  // İKİ YÖN DE TUTMADI. Beyaz/siyaha düşmek YANLIŞ olurdu: kart zaten beyaz
  // olan takımlarda rozet tam kartın rengine oturuyor ve sınırı kayboluyordu
  // (ölçüldü: 18 takımda primarySoft/kart = 1.00). Öncelik KUTUNUN GÖRÜNMESİ:
  // kartın kendi komşu tonuna düşülür. Üstündeki yazı `primary`dir ve rozet
  // kalın-büyük bir yüzeydir (WCAG 3.0), gövde metni değil.
  return komsuTon(kart, ayrimEsigi: 1.40);
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
