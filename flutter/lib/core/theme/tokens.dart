// KAYNAK: app/src/theme.js — BİREBİR çeviri.
//
// Değer eklenmedi, çıkarılmadı, yuvarlanmadı. Kaynaktaki "geriye dönük
// uyumluluk" takma adları da AYNEN korundu: 159 kaynak dosyanın bir kısmı
// eski adları (bg, card, textMuted, gold, ...), bir kısmı yeni adları
// (background, surface, muted, warning, ...) kullanıyor. Birini atmak,
// çevirinin ortasında sessiz renk kayması demek olurdu.
//
// RN → Flutter tek gerçek fark: gölge. React Native'de shadowOpacity ayrı bir
// alandır; Flutter'da renge gömülüdür. Opaklık ARGB alfasına çevrildi
// (0.08 × 255 ≈ 0x14, 0.05 × 255 ≈ 0x0D).

import 'package:flutter/material.dart';

import 'takim_paleti.dart' show kimlikTonu, okunurMetin;

// ═══════════ TAKIM TEMASI: YAPISAL RENKLER ARTIK DEĞİŞKEN ════════════════
// (kullanıcı isteği, 2026-08-11 → bütüncül tema)
//
// Önce yalnız birkaç yüzey temaya bağlanmıştı; kullanıcı haklı olarak "eski
// lacivert/kırmızı/beyaz/gri birçok yerde kalıyor" dedi. Sebebi ölçüldü:
// `AppColors` 1834 yerde DOĞRUDAN kullanılıyor ve `Theme.of(context)` hiç
// kullanılmıyor — yani ekranlar temayı hiç sormuyor.
//
// ÇÖZÜM: yapısal renkler `const` olmaktan çıkıp DEĞİŞKEN oldu. Tema
// değiştiğinde [temayiUygula] bu alanları yeniden yazar ve ağaç yeniden
// çizilince 1834 kullanımın HEPSİ yeni rengi okur — tek tek dosya
// değiştirmeye gerek kalmaz.
//
// BEDELİ AÇIK: `const` bağlamda kullanılan 756 nokta artık `const` olamıyor
// (ölçüldü). O widget'lar her çizimde yeniden kurulur. Bütüncül tema bunu
// gerektiriyordu; başka yolu yok çünkü Flutter'da derleme zamanı bir sabit
// çalışma zamanında değişemez.
//
// ANLAMSAL RENKLER `const` KALDI: success / warning / danger / info ve
// green / yellow / red / orange / gold / field. Bunlar takım temasından
// ETKİLENMEZ — kırmızı "hata", yeşil "galibiyet" anlamını korur.

/// `theme.js` → `colors`
abstract final class AppColors {
  /// EN SON UYGULANAN görünüm TAKIM PALETİ miydi? (17 Ağustos 2026)
  ///
  /// NEDEN GEREKLİ: neredeyse tüm yüzeyler zaten rol tokenlarından geldiği için
  /// hangi modda olduğumuzu sormaya gerek kalmıyor. Tek istisna MARKA KİMLİĞİ
  /// taşıyan sabit renkler (ör. hafta rozetinin marka laciverti): bunlar
  /// açık/koyu görünümde kasıtlı olarak sabittir, ama takım temasında uygulamanın
  /// her yüzeyi takımın iki rengine dönerken tema dışında kalırlar.
  ///
  /// Bayrağı TERCİH DEĞİL UYGULAMA yazar: `gorunumuUygula` false,
  /// `takimGorunumunuUygula` true. Tercih ('takim') ile gerçek aynı şey
  /// değildir — takım seçilmemişse tercih 'takim' kalır ama varsayılan açık
  /// uygulanır. Ekran gerçeği okumalı.
  static bool takimTemasiEtkin = false;

  static Color background = Color(0xFFF3F5F9);
  static Color surface = Color(0xFFFFFFFF);
  static Color surfaceSoft = Color(0xFFF8FAFC);

  static Color primary = Color(0xFF0B1B3A);
  static Color primaryDark = Color(0xFF071329);
  static Color primarySoft = Color(0xFFE8EEF8);

  static Color accent = Color(0xFFE21B2D);
  static Color accentSoft = Color(0xFFFFE8EB);

  // ÜSTÜNDEKİ YAZI (kullanıcı isteği: "kontrast her ekranda korunacak").
  //
  // Varsayılan markada `primary` lacivert, `accent` kırmızıdır ve ikisinin de
  // üstüne BEYAZ yazılır — o yüzden başlangıç değeri beyazdır ve bugünkü
  // görünüm birebir korunur. Takım temasında bu iki alan zemin renginden
  // HESAPLANIR: sarı bir buton üstünde beyaz yazı okunmaz, siyah yazılır.
  //
  // Ölçüm (150 takım): `primary` zemininde beyaz yazı 110 takımda, `accent`
  // zemininde 97 takımda AA eşiğinin altında kalıyordu.
  static Color onPrimary = Color(0xFFFFFFFF);
  static Color onAccent = Color(0xFFFFFFFF);

  /// `primary` zemininde İKİNCİL yazı (üst başlık, alt satır).
  ///
  /// Gerekliydi: `primary` zeminli kartlarda ekranlar kendi soluk grilerini
  /// yazmıştı (0xFF8FA6C9, 0xFFB7C4DA, 0xFFD7DEEA) — hepsi marka laciverdine
  /// göre seçilmişti ve sarı bir `primary` üstünde okunmuyordu. [temayiUygula]
  /// bunu AA eşiğini geçene kadar iterek hesaplar.
  static Color onPrimarySoft = Color(0xFFB7C4DA);

  // ANLAMSAL RENKLER `const` KALIR — anlamları takımdan bağımsızdır.
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFDC2626);
  static const info = Color(0xFF2563EB);

  // ANLAMSAL YUMUŞAK YÜZEYLER `const` DEĞİL (kullanıcı isteği, 2026-08-12).
  //
  // Bu dördü rozet ve uyarı KARTLARININ ZEMİNİDİR. Sabit krem/pembe/açık
  // yeşil değerlerde bırakılınca takım temasında ekranın ortasında tema
  // dışı krem bir kart kalıyordu — kullanıcının açıkça yasakladığı şey
  // ("beyaz veya nötr kartlar takımın ikinci rengine dönüşsün", "krem,
  // pembe ... tonlara dönme").
  //
  // Takım temasında HUE anlamsal renkten, PARLAKLIK karttan gelir: yüzey
  // "uyarı sarısı ailesinden" kalır ama temanın içine oturur. Açık/koyu
  // görünümlerde markanın bugünkü değerleri birebir geri yazılır.
  static Color successSoft = Color(0xFFE8F7EE);
  static Color warningSoft = Color(0xFFFFF4DD);
  static Color dangerSoft = Color(0xFFFEE2E2);
  static Color infoSoft = Color(0xFFEAF1FF);

  // ANLAMSAL YUMUŞAK YÜZEYİN ÜSTÜNDEKİ YAZI (16 Ağustos 2026).
  //
  // Rozetlerin yazısı anlamsal rengin KENDİSİ yazılıyordu
  // (`Text(color: AppColors.success)` + `color: AppColors.successSoft`) ve o
  // renk `const`tur. Takım temasında zemin `_anlamsalYuzey` ile yeniden
  // hesaplandığı için okunuyordu; VARSAYILAN açık/koyu modda o koruma yoktu.
  // Ölçüldü: success #16A34A / successSoft #E8F7EE = 2.98 — AA (4.5) ALTINDA.
  //
  // Bu dört alan `kimlikTonu` ile üretilir: HUE VE DOYGUNLUK KORUNUR, yalnız
  // parlaklık okunana dek itilir. Yani yeşil yeşil, kırmızı kırmızı kalır —
  // "resmî", "hata", "uyarı" anlamları takım renginden bağımsız sürer, sadece
  // okunur olur. Tek hesap yeri tema uygulayıcılarıdır (gorunum.dart ve
  // takim_gorunumu.dart); ekranlar yalnız bu alanı okur.
  static Color onSuccessSoft = Color(0xFF16A34A);
  static Color onWarningSoft = Color(0xFFF59E0B);
  static Color onDangerSoft = Color(0xFFDC2626);
  static Color onInfoSoft = Color(0xFF2563EB);

  /// Anlamsal rengi, ÜSTÜNDE DURDUĞU yüzeyde okunur tona iter.
  ///
  /// NEDEN PARAMETRELİ (16 Ağustos 2026): aynı rozet iki farklı yüzeyde
  /// çizilebiliyor — `SurpriseBadge` maç detayında SAYFA ZEMİNİNDE, radar
  /// kartında ise KART üstünde duruyor. Sabit bir token ikisine birden doğru
  /// cevap veremez; yüzeyi çağıran taraf bilir.
  ///
  /// ÖLÇÜLEN KUSUR: durum noktaları (🟢 resmî · 🟡 henüz resmî değil ·
  /// 🔴 canlı) ham anlamsal renkle doğrudan zemine çiziliyordu. Galatasaray
  /// temasında sarı nokta sarı zeminde kontrast **1.24**, Trabzonspor
  /// kartında **1.03** — grafik nesneler için eşik 3:1. Bu şerit "yalnız
  /// resmî sonuç kesindir" kuralının görsel anahtarı olduğu için görünmemesi
  /// kozmetik değil, DÜRÜSTLÜK sorunuydu.
  ///
  /// `kimlikTonu` hue ve doygunluğu KORUR: yeşil yeşil, sarı sarı kalır.
  static Color anlamsalTon(Color anlamsal, Color yuzey) =>
      kimlikTonu(anlamsal, yuzey, yedek: okunurMetin(yuzey));

  /// Yumuşak yüzeylerin üstündeki yazı tonlarını YENİDEN hesaplar.
  ///
  /// Hem `gorunumuUygula` (açık/koyu) hem `takimGorunumunuUygula` yüzeyleri
  /// yazdıktan SONRA bunu çağırır — tek tanım, iki yol. Ayrı ayrı yazılsaydı
  /// biri güncellenip diğeri unutulurdu.
  static void anlamsalYazilariTazele() {
    Color yazi(Color anlamsal, Color zemin) =>
        kimlikTonu(anlamsal, zemin, yedek: okunurMetin(zemin));
    onSuccessSoft = yazi(success, successSoft);
    onWarningSoft = yazi(warning, warningSoft);
    onDangerSoft = yazi(danger, dangerSoft);
    onInfoSoft = yazi(info, infoSoft);
  }

  // CANLI — ANLAMSAL, takım temasından BAĞIMSIZ (kullanıcı isteği 2026-08-12:
  // "başarı, hata, uyarı ve canlı durum gibi anlamsal renkler tema renginden
  // bağımsız kalsın").
  //
  // Eskiden canlı rozeti `accent` kullanıyordu. Varsayılan markada accent
  // kırmızı olduğu için sorun görünmüyordu; takım temasında accent ikincil
  // takım rengine döndüğü an "CANLI" Dortmund'da sarı, Fenerbahçe'de sarı
  // oluyordu — yayıncılıktaki "canlı = kırmızı" kuralı bozuluyordu.
  //
  // Değer, markanın bugünkü accent kırmızısının AYNISI: varsayılan temada
  // hiçbir piksel değişmez. [onLive] beyazdır (kontrast 4.54 — AA).
  static const live = Color(0xFFE21B2D);
  static const liveSoft = Color(0xFFFFE8EB);
  static const onLive = Color(0xFFFFFFFF);

  // METİN — KART yüzeyinin üstünde okunur.
  //
  // TERS KONTRAST (kullanıcı isteği, 2026-08-12): iki renkli takım temasında
  // kart ikincil renktedir ve yazısı ANA renktir; zemin ise ana renktedir ve
  // yazısı İKİNCİL renktir. Yani tek bir metin rengi iki yüzeye birden
  // yetmiyor — Galatasaray'da kart yazısı sarı olur, aynı sarı sarı zeminde
  // görünmez.
  //
  // Uygulamadaki yazının EZİCİ ÇOĞUNLUĞU kart içindedir; bu yüzden `text`
  // ailesi KARTIN metni sayıldı ve zemine doğrudan yazılan başlıklar için
  // ayrı [onBackground] ailesi eklendi. Açık/koyu/sistem görünümlerinde
  // ikisi AYNI değeri alır — o modlarda hiçbir şey değişmez.
  static Color text = Color(0xFF101828);
  static Color textSoft = Color(0xFF475467);
  static Color muted = Color(0xFF98A2B3);
  static Color border = Color(0xFFE4E7EC);

  // ZEMİNE DOĞRUDAN yazılan metin (bölüm başlıkları, "Tümünü Gör" gibi
  // kart dışı satırlar). Takım temasında ikincil rengin tonudur.
  static Color onBackground = Color(0xFF101828);
  static Color onBackgroundSoft = Color(0xFF475467);
  static Color onBackgroundMuted = Color(0xFF98A2B3);

  // ZEMİN ÜSTÜNDEKİ VURGU — "Tümünü Gör ›" gibi kart dışı bağlantılar.
  //
  // `accent` KART yüzeyi için türetilir (uygulamadaki 62 kullanımın ezici
  // çoğunluğu kart içindedir). Ters kontrast düzeninde kartın vurgusu ANA
  // rengin tonudur ve zeminin üstüne konduğunda zeminle çakışır — ölçüldü:
  // Galatasaray temasında sarı zeminde sarı bağlantı. Zemin üstü vurgu bu
  // ayrı tokendan gelir (takım temasında İKİNCİL rengin tonu).
  static Color onBackgroundAccent = Color(0xFFE11D2E);

  /// [onBackgroundAccent] ZEMİN OLARAK kullanıldığında üstündeki yazı.
  ///
  /// Sayfa zeminine oturan DOLU butonlar (ör. "+ Yeni Kupon") için gerekli:
  /// dolguyu `primary` yapmak yanlıştı, çünkü `primary` KART için türetilir ve
  /// zeminle çakışıp butonun kutusunu görünmez bırakıyordu (ölçüldü:
  /// BB Erzurumspor teması, mavi zeminde mavi buton).
  static Color onBackgroundAccentText = Color(0xFFFFFFFF);

  static Color darkCard = Color(0xFF111C34);
  static Color darkCardSoft = Color(0xFF18243F);

  // KOYU YÜZEYİN ÜSTÜ (kullanıcı isteği 2026-08-12: "eski lacivert/gri
  // renkler birçok yerde kalıyor").
  //
  // Uygulamada koyu panelli ekranlar var (Haftalık Özet, Hafta Kapanışı,
  // bildirimler, kilit ekranı, yan menü, gösterge kartları). Bunların
  // üstündeki yazı için TOKEN YOKTU; her ekran kendi açık grisini elle
  // yazmıştı — ölçüldü: 0xFF9DB0CD, 0xFFC9D4EA, 0xFFB7C4DA, 0xFF8FA6C9,
  // 0xFFB9C6DC, 0xFFD7DEEA, 0xFFB8C1D1, 0xFFD6DDE5, 0xFF8FA3BD, 0xFF7F93B4
  // — hepsi marka laciverdinin tonu, hiçbiri takım temasını dinlemiyordu.
  //
  // Artık üçü de [darkCard]tan HESAPLANIR ve AA eşiğini geçer. Varsayılan
  // değerler bugünkü marka görünümüyle birebir aynı bırakıldı.
  static Color onDark = Color(0xFFFFFFFF);
  static Color onDarkSoft = Color(0xFF9DB0CD);
  static Color darkBorder = Color(0xFF2A3A57);

  // VURGULU PANEL — "hero" kartı (kullanıcı isteği 2026-08-12: koyu mod
  // "sade" olacak).
  //
  // Bu panel eskiden `primary`yi ZEMİN olarak kullanıyordu. Açık görünümde
  // doğru (lacivert hero), ama koyu görünümde `primary` AÇIK olmak zorunda
  // (kart içinde YAZI olarak da okunuyor) ve sonuç, siyah bir ekranın
  // ortasında parlak açık mavi bir blok oluyordu — emülatörde görüldü.
  //
  // Ayrı token: açık görünümde marka laciverti, koyu görünümde yükseltilmiş
  // koyu yüzey. İki rolü tek renge yükleme sorunu böylece bitiyor.
  static Color heroZemin = Color(0xFF0B1B3A);
  static Color onHero = Color(0xFFFFFFFF);
  static Color onHeroSoft = Color(0xFFB7C4DA);

  static const white = Color(0xFFFFFFFF);
  static const black = Color(0xFF000000);

  // --- Geriye dönük uyumluluk (eski token adları → yeni palet) ---
  static Color bg = Color(0xFFF3F5F9);
  static Color bgAlt = Color(0xFFF8FAFC);
  static Color card = Color(0xFFFFFFFF);
  static Color cardAlt = Color(0xFFE8EEF8);
  static Color textMuted = Color(0xFF98A2B3);
  static const field = Color(0xFF16A34A);
  static const gold = Color(0xFFF59E0B);
  static const green = Color(0xFF16A34A);
  static const yellow = Color(0xFFF59E0B);
  static const red = Color(0xFFDC2626);
  static Color gray = Color(0xFF98A2B3);
  static const orange = Color(0xFFF59E0B);
  static Color track = Color(0xFFE8EEF8);
}

/// VARSAYILAN (marka) yapısal renkler — takım seçilmediğinde bunlara dönülür.
/// `AppColors` değişken alanlarının başlangıç değerleriyle birebir aynıdır.
abstract final class VarsayilanRenkler {
  static const heroZemin = Color(0xFF0B1B3A);
  static const onHero = Color(0xFFFFFFFF);
  static const onHeroSoft = Color(0xFFB7C4DA);
  static const background = Color(0xFFF3F5F9);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceSoft = Color(0xFFF8FAFC);
  static const primary = Color(0xFF0B1B3A);
  static const primaryDark = Color(0xFF071329);
  static const primarySoft = Color(0xFFE8EEF8);
  static const accent = Color(0xFFE21B2D);
  static const accentSoft = Color(0xFFFFE8EB);
  static const onPrimary = Color(0xFFFFFFFF);
  static const onAccent = Color(0xFFFFFFFF);
  static const onPrimarySoft = Color(0xFFB7C4DA);
  static const text = Color(0xFF101828);
  static const textSoft = Color(0xFF475467);
  static const muted = Color(0xFF98A2B3);
  static const border = Color(0xFFE4E7EC);
  static const darkCard = Color(0xFF111C34);
  static const darkCardSoft = Color(0xFF18243F);
  static const onDark = Color(0xFFFFFFFF);
  static const onDarkSoft = Color(0xFF9DB0CD);
  static const darkBorder = Color(0xFF2A3A57);
  static const cardAlt = Color(0xFFE8EEF8);
  static const track = Color(0xFFE8EEF8);
}

/// KOYU GÖRÜNÜM — yapısal renkler (kullanıcı isteği, 2026-08-12).
///
/// TAKIMDAN BAĞIMSIZ. Uygulamanın genel zemini, metni, kartı ve navigasyonu
/// artık yalnız görünüm tercihiyle (açık / koyu / sistem) belirlenir; favori
/// takım bu değerlere karışmaz.
///
/// ROL KURALLARI [VarsayilanRenkler] ile AYNIDIR, yalnız uçlar terstir:
///  • `primary` ve `accent` hem ZEMİN (buton, seçili sekme) hem YAZI (kart
///    içi vurgu) olarak kullanılıyor. Koyu görünümde bu ikisi AÇIK tonda
///    olmak zorunda: koyu kartın üstünde okunacaklar. Üstlerindeki yazı da
///    bu yüzden KOYU (`onPrimary` / `onAccent`).
///  • Marka kimliği korunur: `primary` laciverdin açık tonu, `accent`
///    markanın kırmızısının açık tonudur — yeni bir renk ailesi
///    uydurulmadı.
///  • Değerler `test/gorunum_modu_test.dart` içinde AA eşiğine karşı
///    ölçülür; elle "olur herhâlde" denmedi.
abstract final class KoyuRenkler {
  /// Koyu görünümde hero, ayrı bir renk değil YÜKSELTİLMİŞ yüzeydir.
  static const heroZemin = Color(0xFF242A35);
  static const onHero = Color(0xFFE9ECF2);
  static const onHeroSoft = Color(0xFFA9B2C0);
  // ÜÇ KADEME: koyu panel < zemin < kart. Aralar ÖLÇÜLEREK açıldı — ilk
  // denemede panel ile zemin 1.0475'te kalıyordu (eşik 1.05) ve Haftalık
  // Özet gibi tek panelden ibaret ekranlar zeminden ayrışmıyordu.
  static const background = Color(0xFF12161D);
  static const surface = Color(0xFF1B2029);
  static const surfaceSoft = Color(0xFF242A35);

  static const primary = Color(0xFF7FA8EE);
  static const primaryDark = Color(0xFF5B84C8);
  static const primarySoft = Color(0xFF1C2740);

  /// Markanın kırmızısının koyu görünüm karşılığı.
  ///
  /// İLK DENEME #FF8A94'TÜ VE PEMBEYE KAÇIYORDU (vitrinde görüldü). Koyu
  /// zeminde okunması için açılması gerekiyor ama açtıkça doygunluk düşüp
  /// somona dönüyor. #FF5A66 dengeyi tutuyor: kart üstünde 5.4, üstündeki
  /// koyu yazıyla 6.4 — ikisi de AA, ve renk hâlâ KIRMIZI okunuyor.
  static const accent = Color(0xFFFF5A66);
  static const accentSoft = Color(0xFF3A1418);

  static const onPrimary = Color(0xFF0E1116);
  static const onAccent = Color(0xFF17090C);

  /// `primary` zemininde İKİNCİL yazı. Koyu görünümde `primary` AÇIK bir
  /// mavidir, dolayısıyla üstündeki ikincil yazı da KOYU olmak zorunda —
  /// açık görünümdekinin (soluk gri-mavi) aynısını koymak 1.37 kontrast
  /// verirdi (hesaplandı, test bunu bekçiliyor).
  static const onPrimarySoft = Color(0xFF2A3340);

  static const text = Color(0xFFE9ECF2);
  static const textSoft = Color(0xFFB4BCC9);
  static const muted = Color(0xFF8A93A3);
  static const border = Color(0xFF2C333F);

  /// Koyu görünümde "koyu panel" zeminden bir tık DAHA koyudur; açık
  /// görünümdeki kontrastın karşılığı budur.
  static const darkCard = Color(0xFF05070A);
  static const darkCardSoft = Color(0xFF0F1318);
  static const onDark = Color(0xFFE9ECF2);
  static const onDarkSoft = Color(0xFFA9B2C0);
  static const darkBorder = Color(0xFF262C36);

  static const cardAlt = Color(0xFF1C2740);
  static const track = Color(0xFF242A35);
}

/// `theme.js` → `labelColors`
///
/// ANLAMSAL — takım temasından etkilenmez, bu yüzden hepsi `const` ve
/// `AppColors`ın değişken alanlarına BAĞLI DEĞİL.
abstract final class LabelColors {
  static const green = AppColors.success;
  static const yellow = AppColors.warning;
  static const red = AppColors.danger;
  static const gray = Color(0xFF98A2B3);
}

/// `theme.js` → `spacing`
abstract final class Spacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
}

/// `theme.js` → `radius`
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 22;
  static const double pill = 999;

  static const smR = BorderRadius.all(Radius.circular(sm));
  static const mdR = BorderRadius.all(Radius.circular(md));
  static const lgR = BorderRadius.all(Radius.circular(lg));
  static const xlR = BorderRadius.all(Radius.circular(xl));
  static const pillR = BorderRadius.all(Radius.circular(pill));
}

/// `theme.js` → `font` (boyutlar + ağırlıklar)
abstract final class AppFont {
  static const double xs = 11;
  static const double sm = 12;
  static const double md = 14;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 26;

  static const regular = FontWeight.w400;
  static const medium = FontWeight.w500;
  static const semibold = FontWeight.w600;
  static const bold = FontWeight.w700;
  static const heavy = FontWeight.w800;

  /// RN'de `fontWeight: '900'` doğrudan yazılan yerler var (marka, skor,
  /// rozet metinleri). Kaynakta token değil ham değer olduğu için burada da
  /// ayrı duruyor — token listesine uydurma bir isim eklenmedi.
  static const black = FontWeight.w900;
}

/// `theme.js` → `shadow` / `shadows`
abstract final class AppShadow {
  /// RN: shadowColor #101828, offset (0,8), opacity .08, radius 18, elevation 4
  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x14101828), offset: Offset(0, 8), blurRadius: 18),
  ];

  /// RN: shadowColor #101828, offset (0,4), opacity .05, radius 10, elevation 2
  static const List<BoxShadow> soft = [
    BoxShadow(color: Color(0x0D101828), offset: Offset(0, 4), blurRadius: 10),
  ];
}
