// TAKIM TEMASI — PALET MODELİ VE TÜRETME (SAF MODÜL)
// (kullanıcı isteği, 2026-08-11)
//
// Kullanıcı favori takımını seçtiğinde uygulamanın YAPISAL renkleri o takımın
// paletine döner. Bu dosya yalnız "hangi renk" sorusunu yanıtlar; çizim yapmaz
// ve Flutter durumuna bağlı değildir — düz Dart testinden doğrudan çağrılır.
//
// ═══════════ İKİ RENK ELLE, KALANI TÜRETME ════════════════════════════════
// Her takım için elle tutulan YALNIZ iki değer var: ana ve ikincil renk.
// Diğer yedi alan bunlardan hesaplanır. Gerekçe: 150 takım × 9 renk = 1350
// elle değer, hem yönetilemez hem denetlenemez olurdu; türetme ise tek yerde
// test edilir ve her takımda AYNI kuralı uygular.
//
// ═══════════ METİN RENGİ HESAPLANIR, SEÇİLMEZ ═════════════════════════════
// Zeminin üstündeki yazı rengi WCAG göreceli parlaklığından bulunur. Elle
// yazılsaydı 150 takımda 150 ayrı hata fırsatı olurdu; ölçüldü: Dortmund
// sarısında siyah 13.48:1, beyaz 1.32:1 — yani yanlış seçim metni okunmaz
// yapar.
//
// ═══════════ ANLAMSAL RENKLER BU DOSYADA YOKTUR ═══════════════════════════
// Başarı / hata / uyarı / canlı / kilitli renkleri takım temasına GİRMEZ.
// Kırmızı takım seçildiğinde kırmızı hem tema hem "mağlubiyet" olamaz; sarı
// takımda uyarı sarısı kaybolamaz. O renkler `AppColors` içinde sabit kalır.

import 'dart:math' as math;

// HSLColor için — ton (hue/doygunluk) koruyan parlaklık ayarı oradan gelir.
// `painting` seçildi, `material` değil: materyalin tamamı widget getirir, bu
// dosya ise widget bilmez (başlıktaki "saf modül" kuralı).
import 'package:flutter/painting.dart';

/// WCAG 2.x göreceli parlaklık (0 = siyah, 1 = beyaz).
double gorecelParlaklik(Color c) {
  double kanal(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * kanal(c.r) + 0.7152 * kanal(c.g) + 0.0722 * kanal(c.b);
}

/// İki rengin kontrast oranı (1 → aynı, 21 → siyah/beyaz).
double kontrastOrani(Color a, Color b) {
  final l1 = gorecelParlaklik(a);
  final l2 = gorecelParlaklik(b);
  final buyuk = l1 > l2 ? l1 : l2;
  final kucuk = l1 > l2 ? l2 : l1;
  return (buyuk + 0.05) / (kucuk + 0.05);
}

/// WCAG AA eşiği (normal metin).
const double kAaEsigi = 4.5;

/// WCAG AA eşiği — BÜYÜK/KALIN metin ve arayüz bileşenleri (3:1).
///
/// Yalnız rozet, buton, sekme gibi kalın-büyük yüzeyler için geçerlidir;
/// gövde metnine uygulanmaz.
const double kAaBuyukEsigi = 3.0;

/// Zeminin üstünde okunacak metin rengi — HESAPLANIR.
///
/// Koyu seçenek projenin kendi metin rengidir (saf siyah değil): açık
/// zeminlerde uygulamanın mevcut görsel dili korunsun.
Color okunurMetin(
  Color zemin, {
  Color koyu = const Color(0xFF101828),
  Color acik = const Color(0xFFFFFFFF),
}) => kontrastOrani(zemin, koyu) >= kontrastOrani(zemin, acik) ? koyu : acik;

/// Rengi beyaza doğru [oran] kadar açar (0..1).
Color acikla(Color c, double oran) => Color.fromARGB(
  (c.a * 255).round(),
  _karistir((c.r * 255).round(), 255, oran),
  _karistir((c.g * 255).round(), 255, oran),
  _karistir((c.b * 255).round(), 255, oran),
);

/// Rengi siyaha doğru [oran] kadar karartır (0..1).
Color karart(Color c, double oran) => Color.fromARGB(
  (c.a * 255).round(),
  _karistir((c.r * 255).round(), 0, oran),
  _karistir((c.g * 255).round(), 0, oran),
  _karistir((c.b * 255).round(), 0, oran),
);

int _karistir(int a, int b, double oran) {
  final o = oran < 0 ? 0.0 : (oran > 1 ? 1.0 : oran);
  return (a + (b - a) * o).round().clamp(0, 255);
}

// ═══════════ KİMLİK KORUYAN TON — HSL ═══════════════════════════════════════
//
// NEDEN `acikla`/`karart` YETMİYOR (kullanıcı isteği, 2026-08-12 iki renkli
// tema): ikisi de RGB'de beyaza/siyaha karıştırır ve TONU KAYDIRIR —
//   acikla(sarı)  → krem      acikla(kırmızı) → pembe
//   karart(sarı)  → kahverengi
// Kullanıcı bu üçünü de açıkça yasakladı ("rastgele gri, krem, pembe,
// kahverengi ... tonlara dönme"). HSL'de yalnız PARLAKLIK oynatıldığında
// hue ve doygunluk sabit kalır: sarı daha koyu sarı, kırmızı daha açık
// kırmızı olur — kulüp kimliği korunur.

/// Rengin HSL parlaklığını [l] yapar; hue ve doygunluk KORUNUR.
Color tonla(Color c, double l) =>
    HSLColor.fromColor(c).withLightness(l.clamp(0.0, 1.0)).toColor();

/// [renk]i, [zemin] üstünde [esik] kontrastına ulaşana dek TONLAYARAK iter.
///
/// Hue ve doygunluk sabit kalır — dönen renk hâlâ "o kulübün rengi"dir,
/// yalnız daha açık ya da daha koyu tonu. İki yön de denenir ve eşiği
/// sağlayanlardan ÖZGÜN PARLAKLIĞA EN YAKIN olan seçilir: gereğinden fazla
/// açmak/karartmak kimliği boşuna uzaklaştırır.
///
/// Hiçbir ton eşiği tutmuyorsa (çok nadir; zemin orta parlaklıktaysa olur)
/// son çare [yedek] döner — çağıran taraf oraya beyaz/siyah verir.
/// Kullanıcının kuralı: "Beyaz yalnız erişilebilirlik için zorunlu olduğunda
/// destek rengi olarak kullanılsın."
Color kimlikTonu(
  Color renk,
  Color zemin, {
  double esik = kAaEsigi,
  Color? yedek,
}) {
  final h = HSLColor.fromColor(renk);
  if (kontrastOrani(renk, zemin) >= esik) return renk;

  Color? enIyi;
  var enIyiUzaklik = 2.0;
  // 1/100 adımlarla tüm parlaklık ekseni taranır — döngü sayısı sabit, bu
  // yüzden "adım küçülünce yuvarlanıp ilerlemiyor" tuzağı yok.
  for (var i = 0; i <= 100; i++) {
    final l = i / 100;
    final aday = h.withLightness(l).toColor();
    if (kontrastOrani(aday, zemin) < esik) continue;
    final uzaklik = (l - h.lightness).abs();
    if (uzaklik < enIyiUzaklik) {
      enIyiUzaklik = uzaklik;
      enIyi = aday;
    }
  }
  return enIyi ?? yedek ?? okunurMetin(zemin);
}

/// [renk]i, VERİLEN ZEMİNLERİN HEPSİNDE [esik]i tutana dek tonlar.
///
/// Tek zeminli [kimlikTonu]nun çoklu hâli. Gerekliydi: küçük yazı hem kartın
/// hem de kart içindeki ARA YÜZEYİN (çip, şerit) üstüne düşüyor; yalnız birine
/// göre hesaplamak ötekinde okunmaz bırakıyordu.
Color kimlikTonuCoklu(
  Color renk,
  List<Color> zeminler, {
  double esik = kAaEsigi,
  Color? yedek,
}) {
  bool tutar(Color c) => zeminler.every((z) => kontrastOrani(c, z) >= esik);
  if (tutar(renk)) return renk;

  final h = HSLColor.fromColor(renk);
  Color? enIyi;
  var enIyiUzaklik = 2.0;
  for (var i = 0; i <= 100; i++) {
    final l = i / 100;
    final aday = h.withLightness(l).toColor();
    if (!tutar(aday)) continue;
    final uzaklik = (l - h.lightness).abs();
    if (uzaklik < enIyiUzaklik) {
      enIyiUzaklik = uzaklik;
      enIyi = aday;
    }
  }
  if (enIyi != null) return enIyi;

  // HUE EKSENİNDE ÇÖZÜM YOK. Bu durumda "ilk zemine göre okunur renk" demek
  // YETMEZ — ölçüldü: soluk yazı ara yüzeyde 3.99'a düşüyordu, çünkü yedek
  // yalnız BİRİNCİ zemini garanti ediyordu. Adaylar arasından EN KÖTÜ zemini
  // en iyi yapan seçilir (maximin).
  final adaylar = <Color>[
    const Color(0xFF000000),
    const Color(0xFFFFFFFF),
    const Color(0xFF101828),
    const Color(0xFFE9ECF2),
    ?yedek,
  ];
  var enIyiAday = adaylar.first;
  var enIyiEnKotu = -1.0;
  for (final c in adaylar) {
    final enKotu = zeminler
        .map((z) => kontrastOrani(c, z))
        .reduce((a, b) => a < b ? a : b);
    if (enKotu > enIyiEnKotu) {
      enIyiEnKotu = enKotu;
      enIyiAday = c;
    }
  }
  return enIyiAday;
}

/// [renk]in KOMŞU tonu: aynı hue, gözle seçilebilecek kadar farklı parlaklık.
///
/// [ayrimEsigi] iki büyük yüzey arasındaki fark içindir; WCAG'ın metin eşiği
/// DEĞİLDİR. 1.25 ölçülerek seçildi: altında göz sınırı seçemiyor.
/// [uzakDurulacak] verilirse aday ondan da ayrışmak zorunda — ara yüzeyin
/// sayfanın zeminine düşüp kaybolmasını engeller.
Color komsuTon(Color renk, {double ayrimEsigi = 1.25, Color? uzakDurulacak}) {
  final h = HSLColor.fromColor(renk);
  // Yön: yüzey açıksa koyulaş, koyuysa açıl — uçta sıkışmayı önler.
  final acik = h.lightness > 0.5;
  bool uygun(Color c) =>
      kontrastOrani(c, renk) >= ayrimEsigi &&
      (uzakDurulacak == null || kontrastOrani(c, uzakDurulacak) >= ayrimEsigi);

  for (var adim = 2; adim <= 60; adim++) {
    for (final yon in acik ? const [-1, 1] : const [1, -1]) {
      final l = h.lightness + yon * adim / 100;
      if (l < 0 || l > 1) continue;
      final aday = h.withLightness(l).toColor();
      if (uygun(aday)) return aday;
    }
  }
  return renk;
}

/// ARA YÜZEY ile KART METNİNİ birlikte çözer.
///
/// Ara yüzey karttan (≥1.25) ve zeminden (≥1.25) ayrışmalı; AYNI ZAMANDA
/// [ana] renginin bir tonu iki yüzeyde birden AA'yı tutmalı. İki koşul
/// birbirine bağlı olduğu için tek döngüde aranır: kartın parlaklığından
/// başlanıp iki yöne açılarak ilk ÇALIŞAN çift alınır.
(Color, Color) _araYuzeyVeMetin(Color kart, Color zemin, Color ana) {
  final h = HSLColor.fromColor(kart);
  (Color, Color)? maximin;
  var enIyiEnKotu = -1.0;

  for (var adim = 2; adim <= 60; adim++) {
    for (final yon in h.lightness > 0.5 ? const [-1, 1] : const [1, -1]) {
      final l = h.lightness + yon * adim / 100;
      if (l < 0 || l > 1) continue;
      final aday = h.withLightness(l).toColor();
      if (kontrastOrani(aday, kart) < 1.25) continue;
      if (kontrastOrani(aday, zemin) < 1.25) continue;

      final yazi = kimlikTonuCoklu(ana, [kart, aday]);
      final enKotu = math.min(
        kontrastOrani(yazi, kart),
        kontrastOrani(yazi, aday),
      );
      if (enKotu >= kAaEsigi) return (aday, yazi);
      if (enKotu > enIyiEnKotu) {
        enIyiEnKotu = enKotu;
        maximin = (aday, yazi);
      }
    }
  }
  // Hiçbir çift AA'yı tutturamadı — en kötü tarafı en iyi yapan alınır.
  return maximin ?? (kart, okunurMetin(kart));
}

/// KUTU KENARLIĞI — hem kartla hem zeminle ayrışır.
///
/// Kenarlık kutunun SINIRIDIR: iki yüzey arasında durur ve ikisinden de
/// seçilebilmelidir. Kartta WCAG'ın arayüz bileşeni eşiği (3.0), zeminde
/// kart/zemin tabanı kadar (1.60) aranır. İkisini birden tutan tonlardan
/// özgün parlaklığa en yakını seçilir; hiçbiri tutmazsa en kötü tarafı en iyi
/// yapan ton (maximin) alınır — kenarlık her hâlükârda çizilir.
Color _kenarlikUret(Color kaynak, Color kart, Color zemin) {
  final h = HSLColor.fromColor(kaynak);
  Color? enIyi;
  var enIyiUzaklik = 2.0;
  Color? maximin;
  var enIyiEnKotu = -1.0;

  for (var i = 0; i <= 100; i++) {
    final l = i / 100;
    final aday = h.withLightness(l).toColor();
    final kartta = kontrastOrani(aday, kart);
    final zeminde = kontrastOrani(aday, zemin);
    if (kartta >= 3.0 && zeminde >= 1.60) {
      final uzaklik = (l - h.lightness).abs();
      if (uzaklik < enIyiUzaklik) {
        enIyiUzaklik = uzaklik;
        enIyi = aday;
      }
    }
    // Ölçek farkını dengele: 3.0 ve 1.60 eşiklerine göre normalize.
    final enKotu = math.min(kartta / 3.0, zeminde / 1.60);
    if (enKotu > enIyiEnKotu) {
      enIyiEnKotu = enKotu;
      maximin = aday;
    }
  }
  return enIyi ?? maximin ?? kaynak;
}

/// Bir takımın tema paleti — kullanıcının saydığı dokuz alan.
class TakimPaleti {
  const TakimPaleti({
    required this.takim,
    required this.ana,
    required this.ikincil,
    required this.zemin,
    required this.yuzey,
    required this.yuzeySoft,
    required this.kenarlik,
    required this.vurgu,
    required this.secili,
    required this.metin,
    required this.zeminMetni,
    required this.vurguMetni,
    required this.seciliMetni,
    required this.acikUstuMetin,
    required this.koyuUstuMetin,
  });

  /// Katalogdaki takım adı (eşleşme bu adla yapılır).
  final String takim;

  final Color ana;
  final Color ikincil;

  /// Uygulamanın ana arka planı.
  final Color zemin;

  /// Kart ve yüzeyler.
  final Color yuzey;

  /// KART İÇİNDEKİ ara yüzey — çip, şerit, iç kutu zemini.
  ///
  /// Kartla AYNI OLAMAZ: aynı olduğunda kullanıcı "kutu olduğu anlaşılmıyor"
  /// diyordu (ölçüldü: 150 takımın 149'unda kontrast 1.00). Kartın hue'sunu
  /// korur, yalnız parlaklığı bir tık kayar; sayfa zemininden de ayrışır.
  final Color yuzeySoft;

  final Color kenarlik;

  /// Birincil vurgu (butonlar, etkin göstergeler).
  final Color vurgu;

  /// Seçili durum (etkin sekme, işaretli seçenek).
  final Color secili;

  /// Açık zemin üzerindeki metin.
  final Color acikUstuMetin;

  /// Koyu zemin üzerindeki metin.
  final Color koyuUstuMetin;

  /// KARTIN üstünde okunacak metin — ANA rengin tonu.
  ///
  /// TERS KONTRAST (kullanıcı isteği, 2026-08-12): kart ikincil renktedir, o
  /// yüzden kartın yazısı ANA renktir. Eskiden zemin ve kart TEK bir metin
  /// rengini paylaşıyordu; iki renkli düzende bu imkânsız — Galatasaray'da
  /// kart yazısı sarı olacak ama aynı sarı, sarı zeminde görünmez.
  final Color metin;

  /// ZEMİNİN üstünde okunacak metin — İKİNCİL rengin tonu.
  final Color zeminMetni;

  /// [vurgu] zemininde okunacak metin.
  final Color vurguMetni;

  /// [secili] zemininde okunacak metin.
  final Color seciliMetni;

  /// Zeminin üstünde okunacak metin.
  Color get zeminUstuMetin => zeminMetni;

  /// Yüzeyin (kartın) üstünde okunacak metin.
  Color get yuzeyUstuMetin => metin;

  /// Vurgunun üstünde okunacak metin (buton yazısı).
  Color get vurguUstuMetin => vurguMetni;

  /// Seçili durumun üstünde okunacak metin (etkin sekme yazısı).
  Color get seciliUstuMetin => seciliMetni;
}

/// Takımın İKİ RENGİNİ karşılıklı kullanan bir yüzey çifti.
typedef KimlikCifti = ({Color zemin, Color yazi});

/// KARŞILIKLI RENK — kimlik yüzeyleri için (kullanıcı isteği, 2026-08-12).
///
/// Kural kullanıcının kendi cümlesi: "Galatasaray temasında bir kutunun zemini
/// sarıysa yazı ve ikonlar kırmızı olsun; kutunun zemini kırmızıysa yazı ve
/// ikonlar sarı olsun." Yani takımın iki rengi birbirinin üstünde kullanılır;
/// biri yalnız zemin, diğeri yalnız küçük detay olarak kalmaz.
///
/// [anaZemin] true → zemin ANA renk, yazı İKİNCİL renk. false → tersi.
///
/// EŞİK NEDEN [kAaBuyukEsigi] (3.0), 4.5 DEĞİL — ölçülmüş bir zorunluluk:
/// Galatasaray'ın sarısı kendi kırmızısının üstünde **4.41** veriyor, yani
/// normal metin eşiğinin kılpayı altında. 4.5 dayatılsaydı kullanıcının
/// ADIYLA istediği örnek ("kırmızı zeminde sarı") hiç uygulanamazdı.
/// 3.0, WCAG'ın BÜYÜK/KALIN metin ve arayüz bileşeni eşiğidir; bu çift zaten
/// yalnız rozet, buton ve sekme gibi kalın-büyük yüzeylerde kullanılır.
/// Küçük gövde metninde KULLANILMAZ.
///
/// OKUNURLUK YİNE DE EZER: eşiği de geçemeyen çiftlerde (iki rengi birbirine
/// çok yakın takımlar) yazı, zeminin kendi okunur metnine düşer. Kullanıcının
/// şartı buydu: "kontrastı koruduğu sürece".
KimlikCifti kimlikCifti(TakimPaleti p, {bool anaZemin = true}) {
  final zemin = anaZemin ? p.ana : p.ikincil;
  final karsi = anaZemin ? p.ikincil : p.ana;
  return (
    zemin: zemin,
    yazi: kontrastOrani(karsi, zemin) >= kAaBuyukEsigi
        ? karsi
        : okunurMetin(zemin),
  );
}

/// İki elle renkten TERS KONTRAST paletini türetir.
///
/// ═══════════ KURAL (kullanıcı isteği, 2026-08-12) ═════════════════════════
/// "Uygulamanın ana arka planı takımın birinci ana rengi olsun. Beyaz veya
/// nötr kartlar, takımın ikinci ana rengine dönüşsün. Birinci renkli zemin
/// üzerinde ikinci renkli metin; ikinci renkli zemin üzerinde birinci renkli
/// metin kullanılsın."
///
///   zemin      = ana
///   yuzey      = ikincil            (kart — beyaz DEĞİL)
///   metin      = ana tonu           (kartın üstünde)
///   zeminMetni = ikincil tonu       (zeminin üstünde)
///   vurgu      = ana tonu           (kart üstündeki buton/rozet)
///   secili     = ikincil tonu       (zemin üstündeki etkin sekme)
///
/// ═══════════ OKUNURLUK: TON İTİLİR, RENK DEĞİŞTİRİLMEZ ════════════════════
/// İki resmî renk doğrudan yeterli değilse [kimlikTonu] devreye girer:
/// HSL parlaklığı oynatılır, hue ve doygunluk KORUNUR. Ölçüldü — ham hâlde
/// 150 takımın yalnız 87'si AA geçiyor, ton ayarından sonra 150'si de
/// geçiyor (test/iki_renk_olcum.dart).
///
/// Beyaz/siyah YALNIZ son çaredir (`yedek`): hiçbir ton eşiği tutmadığında
/// devreye girer. Kullanıcının kuralı: "Beyaz yalnız erişilebilirlik için
/// zorunlu olduğunda destek rengi olarak kullanılsın."
TakimPaleti paletUret({
  required String takim,
  required Color ana,
  required Color ikincil,
}) {
  // ZEMİN = ANA RENK, olduğu gibi. Eskiden yumuşatılıyordu; kullanıcı artık
  // zeminin takımın birinci rengi OLMASINI istiyor.
  final zemin = ana;

  // KART = İKİNCİL RENK. Zeminden GÖRÜNÜR biçimde ayrılmalı, yoksa kartın
  // sınırı kaybolur. Eşik 1.35'ten 1.60'a çıkarıldı: 1.35'te en kötü takımda
  // kart/zemin 1.36 kalıyordu ve kullanıcı "kutu olduğu anlaşılmıyor" dedi.
  final yuzey = kimlikTonu(
    ikincil,
    zemin,
    esik: 1.60,
    yedek: okunurMetin(zemin),
  );

  // KART İÇİ ARA YÜZEY (çip, şerit, iç kutu) + KART YAZISI **BİRLİKTE**.
  //
  // Ayrı ayrı çözüldüğünde ara yüzey kartla arasını açıyor, ama iki yüzeyde
  // BİRDEN 4.5'i tutan bir metin tonu kalmıyordu — ölçüldü: 5 takımda küçük
  // yazı 4.15–4.39'a düşüyordu. Ara yüzeyin yeri metnin varlığına bağlı, bu
  // yüzden adaylar sırayla denenip METNİ MÜMKÜN KILAN ilki seçilir.
  final (yuzeySoft, metin) = _araYuzeyVeMetin(yuzey, zemin, ana);
  // ZEMİNİN YAZISI = İKİNCİL rengin tonu.
  final zeminMetni = kimlikTonu(ikincil, zemin, yedek: okunurMetin(zemin));

  // KENARLIK: kutunun sınırını çizer, yani HEM KARTTAN HEM ZEMİNDEN ayrışmak
  // zorunda. Eskiden yalnız karta bakılıyordu ve 150 takımın 130'unda
  // kenarlık/zemin 1.00 çıkıyordu — sınır görünmüyordu. Kenarlık bir ARAYÜZ
  // BİLEŞENİDİR: kartta WCAG eşiği 3.0, zeminde gözle seçilecek kadar (1.25).
  // İKİ KISIT AYNI ANDA TARANIR. Sırayla uygulandığında ikinci itiş birincinin
  // kazandığını geri veriyordu — ölçüldü: kenarlık/zemin düzeltilince
  // kenarlık/kart 2.92'den 2.10'a düşüyordu.
  final kenarlik = _kenarlikUret(metin, yuzey, zemin);

  // VURGU: kart ÜSTÜNDE duran buton/rozet zemini → ana rengin tonu.
  // Rozet ve buton kalın-büyük yüzeydir, eşiği 3.0 (kAaBuyukEsigi).
  final vurgu = kimlikTonu(
    ana,
    yuzey,
    esik: kAaBuyukEsigi,
    yedek: okunurMetin(yuzey),
  );
  // Üstündeki yazı ters renk: ikincil tonu.
  final vurguMetni = kimlikTonu(ikincil, vurgu, yedek: okunurMetin(vurgu));

  // SEÇİLİ: ZEMİN üstünde duran etkin sekme/işaret → ikincil rengin tonu.
  final secili = kimlikTonu(
    ikincil,
    zemin,
    esik: kAaBuyukEsigi,
    yedek: okunurMetin(zemin),
  );
  final seciliMetni = kimlikTonu(ana, secili, yedek: okunurMetin(secili));

  return TakimPaleti(
    takim: takim,
    ana: ana,
    ikincil: ikincil,
    zemin: zemin,
    yuzey: yuzey,
    yuzeySoft: yuzeySoft,
    kenarlik: kenarlik,
    vurgu: vurgu,
    secili: secili,
    metin: metin,
    zeminMetni: zeminMetni,
    vurguMetni: vurguMetni,
    seciliMetni: seciliMetni,
    acikUstuMetin: const Color(0xFF101828),
    koyuUstuMetin: const Color(0xFFFFFFFF),
  );
}
