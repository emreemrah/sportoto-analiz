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

/// Bir takımın tema paleti — kullanıcının saydığı dokuz alan.
class TakimPaleti {
  const TakimPaleti({
    required this.takim,
    required this.ana,
    required this.ikincil,
    required this.zemin,
    required this.yuzey,
    required this.kenarlik,
    required this.vurgu,
    required this.secili,
    required this.metin,
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

  final Color kenarlik;

  /// Birincil vurgu (butonlar, etkin göstergeler).
  final Color vurgu;

  /// Seçili durum (etkin sekme, işaretli seçenek).
  final Color secili;

  /// Açık zemin üzerindeki metin.
  final Color acikUstuMetin;

  /// Koyu zemin üzerindeki metin.
  final Color koyuUstuMetin;

  /// ZEMİNDE DE KARTTA DA okunan tek metin rengi.
  ///
  /// Tek olması şart: iki ayrı renk hesaplanınca zemine doğrudan yazılan
  /// başlıklar kayboluyordu (ölçüldü: 150 takımın 54'ünde). [paletUret] hem
  /// zemini hem kartı bu rengi okutacak şekilde üretir.
  final Color metin;

  /// Zeminin üstünde okunacak metin. [metin] ile aynıdır — ayrı hesaplanmaz.
  Color get zeminUstuMetin => metin;

  /// Yüzeyin üstünde okunacak metin. [metin] ile aynıdır — ayrı hesaplanmaz.
  Color get yuzeyUstuMetin => metin;

  /// Vurgunun üstünde okunacak metin (buton yazısı).
  Color get vurguUstuMetin => okunurMetin(vurgu);

  /// Seçili durumun üstünde okunacak metin (etkin sekme yazısı).
  Color get seciliUstuMetin => okunurMetin(secili);
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

/// İki elle renkten dokuz alanlı paleti türetir.
///
/// TÜRETME KURALLARI (hepsi test edilir):
///  • zemin  = ana renk yumuşatılmış hâli. Çok parlak renk bir miktar
///    karartılır, çok koyu renk bir miktar açılır: tam doygun bir zemin uzun
///    okumada yorar ve koyu uçta uygulamanın açık görsel diliyle çakışır.
///  • yuzey  = zemine göre AYIRT EDİLEBİLİR kart rengi. Açık zeminde beyaza,
///    koyu zeminde bir tık açığa gider — kart hep zeminden ayrılmalı.
///  • kenarlik = zemin ile yüzey arasında düşük kontrastlı çizgi.
///  • vurgu  = ikincil renk; ANA RENKLE KARIŞMAMALI. İkincil, zemine çok
///    yakınsa (ör. sarı-sarı) ana renk koyulaştırılarak kullanılır.
///  • secili = vurgunun bir tık koyu/açık tonu.
TakimPaleti paletUret({
  required String takim,
  required Color ana,
  required Color ikincil,
}) {
  // BEYAZ AĞIRLIKLI TAKIM: kimlik ana renkten alınsaydı beyaz olurdu ve tema
  // varsayılandan ayırt edilemezdi (kullanıcı isteği: "beyaz ağırlıklı
  // takımlarda yalnızca beyaz tema kullanma; ikincil renk veya ton farkı ile
  // kimlik belirgin olsun"). Bu yüzden kaynak İKİNCİL renk olur:
  // Real Madrid'de krem-altın, Tottenham'da açık lacivert tonu.
  final kaynak = gorecelParlaklik(ana) > 0.85 ? ikincil : ana;

  // ═══ İKİ EKSEN: TEMA YA AÇIK YA KOYU — ARASI YOK ═══
  //
  // Bu bir estetik tercih değil, ölçülmüş bir zorunluluk. Zemin orta
  // parlaklıkta (L≈0.4) kaldığında ne beyaz ne siyah metin AA'ya yaklaşır ve
  // üstüne konacak HİÇBİR vurgu rengi 4.5:1'e ulaşamaz — 150 takımın
  // 74'ünde birincil renk kartta okunmuyordu. Uçlara oturunca aynı ölçüm
  // sıfıra iner.
  //
  // Eşik 0.16: bunun altındaki renkler (siyah, lacivert, bordo, koyu yeşil)
  // gerçekten koyudur ve koyu tema onların kimliğini KORUR. Üstündekiler —
  // kırmızı, sarı, turuncu, açık mavi — açık temanın zemininde kendi açık
  // tonlarıyla görünür; koyulaştırılsalardı kullanıcının istemediği "rastgele
  // ton"a dönerlerdi.
  final koyuTema = gorecelParlaklik(kaynak) <= 0.16;

  final zemin = koyuTema ? _koyuZemin(kaynak) : _acikZemin(kaynak);

  // ORTAK METİN — zemin belirler ve kart da bunu okutmak ZORUNDA. Tek renk
  // olması şart: kart kendi metnini seçtiğinde, aynı yazı zemine düştüğünde
  // kayboluyordu.
  final metin = okunurMetin(zemin);

  // KART: zeminden AYRILIR ama aynı uçta kalır.
  final yuzey = _kartUret(zemin, koyuTema);

  // Kenarlık kart ile zemin arasında durur; görünür ama bağırmaz.
  final kenarlik = koyuTema ? acikla(yuzey, 0.22) : karart(yuzey, 0.14);
  final zeminAcik = !koyuTema;

  // VURGU: ikincil renk. Zeminden ayrışmıyorsa (ör. beyaz takımda beyaz
  // ikincil) ana rengin zıt tonuna düşülür.
  final hamVurgu = kontrastOrani(ikincil, zemin) >= 1.6
      ? ikincil
      : (zeminAcik ? karart(ana, 0.5) : acikla(ana, 0.5));

  // VURGU İKİ ROLDE BİRDEN KULLANILIYOR ve her ikisi de kısıt getirir:
  //   • METİN olarak (kart içindeki vurgulu yazı, ikon, sayı) → KARTLA AA
  //     sağlamalı. Bu kısıt olmadan 150 takımın 76'sında vurgulu yazı beyaz
  //     kartta kayboluyordu (ölçüldü).
  //   • ZEMİN olarak (birincil buton, etkin sekme) → ÜSTÜNDEKİ yazıyı
  //     okutmalı.
  final vurgu = _vurguUret(
    kontrastOrani(hamVurgu, zemin) >= 1.6
        ? hamVurgu
        : (zeminAcik ? karart(zemin, 0.55) : acikla(zemin, 0.55)),
    yuzey,
    zemin,
  );

  // SEÇİLİ: vurgunun bir tık farklı tonu — ama aynı iki kısıta tabi, yoksa
  // etkin sekme yazısı okunmaz.
  final secili = _vurguUret(
    gorecelParlaklik(vurgu) > 0.5 ? karart(vurgu, 0.18) : acikla(vurgu, 0.18),
    yuzey,
    zemin,
  );

  return TakimPaleti(
    takim: takim,
    ana: ana,
    ikincil: ikincil,
    zemin: zemin,
    yuzey: yuzey,
    kenarlik: kenarlik,
    vurgu: vurgu,
    secili: secili,
    metin: metin,
    acikUstuMetin: const Color(0xFF101828),
    koyuUstuMetin: const Color(0xFFFFFFFF),
  );
}

/// Vurgu / seçili rengi: kartta YAZI olarak okunsun VE üstündeki yazıyı
/// okutsun.
///
/// İKİ KOŞUL TEK DÖNGÜDE: önce biri sonra diğeri uygulandığında ikinci itiş
/// birincinin kazandığını geri veriyordu (ölçüldü — art arda çağrıda
/// `primary@surface` 150 takımın 75'inde hâlâ AA altındaydı). İtiş yönü ikisi
/// için de aynı: açık kartta koyulaştır, koyu kartta açıklaştır. Bu yüzden
/// tek döngü iki koşulu birden götürebilir.
Color _vurguUret(Color ham, Color yuzey, Color zemin) {
  // YÖN, YÜZEYİN METNİNE DOĞRUDUR — "yüzey açık mı" diye sormak yetmez.
  // Orta parlaklıktaki bir kartta (L≈0.4) beyaza doğru itmenin tavanı 2.33:1
  // olur ve AA'ya HİÇ ulaşılamaz; oysa aynı kartta siyaha doğru itmek 9:1'e
  // çıkar. Yüzeyin kendi metin rengi hangi uçtaysa o uca gidilir.
  final koyulastir = gorecelParlaklik(okunurMetin(yuzey)) < 0.5;
  var r = ham;
  var adim = 0;
  while (adim < 60) {
    // HEM KARTTA HEM ZEMİNDE okunmalı: vurgulu yazı ikisinin de üstüne
    // düşüyor (kart içi sayı ↔ zemine oturan başlık). Yalnız karta bakmak
    // 150 takımın 16'sında zemindeki vurguyu okunmaz bırakıyordu.
    final kartta = kontrastOrani(r, yuzey) >= kAaEsigi;
    final zeminde = kontrastOrani(r, zemin) >= kAaEsigi;
    final ustundeki = kontrastOrani(r, okunurMetin(r)) >= kAaEsigi;
    if (kartta && zeminde && ustundeki) break;
    r = koyulastir ? karart(r, 0.05) : acikla(r, 0.05);
    adim++;
  }
  return r;
}

/// Kart rengi: zeminden ayrışsın VE [metin] rengini okutsun.
///
/// KART HER ZAMAN ZEMİNDEN AÇIKTIR — açık temada beyaza, koyu temada bir tık
/// yukarı. Bu hem mevcut temanın düzeni (zemin #F3F5F9, kart beyaz) hem de
/// koyu arayüzlerin genel deseni. Ters yön denendi ve siyah ana renkli
/// takımlarda (Venezia, Frankfurt, Casa Pia…) tavana dayanıp kart zeminden
/// hiç ayrışmadı: kontrast 1.000 ölçüldü.
///
/// [metin] DIŞARIDAN GELİR (zeminin metni). Kart kendi metnini seçseydi koyu
/// temada "koyu gri kart + siyah yazı" çıkıyor, aynı siyah yazı zeminde
/// kayboluyordu.
/// AÇIK TEMA ZEMİNİ: takım renginin çok açık tonu (L ≥ 0.55).
///
/// Mevcut uygulamanın zemini de böyledir (#F3F5F9). Renk burada YUMUŞAR ama
/// kaybolmaz — kimliği asıl taşıyan vurgu, seçili ve kenarlık tonlarıdır.
Color _acikZemin(Color kaynak) {
  // TON KORUNUR (kullanıcı isteği 2026-08-12: "renkler rastgele tonlara
  // dönüşmesin, takımın bilinen ana renkleri esas alınsın").
  //
  // Önce şöyleydi: beyazla %86 karıştır, sonra fazla açıksa SİYAHA doğru
  // karart. İkinci adım hatalıydı — siyaha doğru karartmak rengi aynı anda
  // hem koyultup hem DOYGUNLUĞUNU düşürür. Ölçüldü: Dortmund sarısı
  // (#FDE100) bu yolla #F0ECCE'ye, yani KREME dönüyordu; ekranda "sarı takım"
  // hissi kalmıyordu.
  //
  // Şimdi tek bir düğme çevriliyor: BEYAZ KARIŞIM ORANI. Oranı azaltmak
  // rengin kendisine geri döner (ton korunur), artırmak açar. Parlaklık
  // hedefi aynı bandda kaldığı için kartın zeminden ayrışması bozulmaz.
  var oran = 0.86;
  var z = acikla(kaynak, oran);

  // ÜST SINIR: zemin beyaza dayanırsa kart (beyaz) ondan AYRIŞAMAZ — ölçüldü,
  // Göztepe'de ayrım 1.050'ye kadar düşüyordu. Varsayılan temanın zemini de
  // #F3F5F9 (L≈0.90); aynı hizada tutulur.
  var adim = 0;
  while (gorecelParlaklik(z) > 0.88 && oran > 0.02 && adim < 60) {
    oran -= 0.02;
    z = acikla(kaynak, oran);
    adim++;
  }

  // ALT SINIR: koyu bir kaynak renkte zemin fazla koyu kalmasın.
  adim = 0;
  while (gorecelParlaklik(z) < 0.55 && oran < 0.98 && adim < 60) {
    oran += 0.02;
    z = acikla(kaynak, oran);
    adim++;
  }
  return z;
}

/// KOYU TEMA ZEMİNİ: koyu takım renginin dengelenmiş hâli (L ≤ 0.055).
///
/// Neden bu kadar koyu: kart zeminden AÇIK olmak zorunda ama beyaz yazıyı
/// 7:1 ile okutmak için L ≤ 0.10'da kalmalı. İkisi arasında yer kalması için
/// zeminin tavanı düşük tutulur. Ölçüldü — zemin L=0.12'de bırakıldığında
/// kart 0.17'ye taşıyor ve Bayern/Atalanta/Atlético'da bütün kontrastlar
/// 4.5'in hemen altına (4.37–4.48) düşüyordu. Beşiktaş'ın siyahı siyah,
/// Fenerbahçe'nin laciverti lacivert kalır.
Color _koyuZemin(Color kaynak) {
  var z = kaynak;
  var adim = 0;
  while (gorecelParlaklik(z) > 0.055 && adim < 40) {
    z = karart(z, 0.06);
    adim++;
  }
  return z;
}

/// KART, ZEMİNLE AYNI UÇTA DURUR ama ondan ayrışır.
///
/// Açık temada beyaza gider, koyu temada zeminin bir tık üstüne — ama TAVANI
/// AŞMADAN. Ayrışma ile tavan tek döngüde tutulur: art arda iki döngü
/// yazıldığında ikincisi birincinin garantisini bozuyordu.
Color _kartUret(Color zemin, bool koyuTema) {
  if (koyuTema) {
    var kart = zemin;
    var adim = 0;
    while (adim < 40) {
      if (kontrastOrani(zemin, kart) >= 1.22) break;
      final sonraki = acikla(kart, 0.04);
      // TAVAN: beyaz yazının 7:1 okunduğu sınırı geçme. Ayrışma bir tık zayıf
      // kalırsa kenarlık taşır; okunmayan yazının telafisi yoktur.
      if (gorecelParlaklik(sonraki) > 0.10) break;
      kart = sonraki;
      adim++;
    }
    return kart;
  }

  var kart = acikla(zemin, 0.9);
  var adim = 0;
  // Eşik 1.12: varsayılan temanın kendi ayrımı (#F3F5F9 zemin ↔ beyaz kart)
  // 1.105'tir. Daha yükseğini istemek, mevcut uygulamanın hiç sağlamadığı bir
  // şeyi takım temasından beklemek olurdu. Ayrımı kenarlık ve gölge tamamlar.
  while (kontrastOrani(zemin, kart) < 1.12 && adim < 30) {
    final sonraki = acikla(kart, 0.05);
    // YUVARLAMA TUZAĞI: beyaza yaklaşınca %5'lik adım aynı tamsayıya
    // yuvarlanıyor ve döngü ilerlemeden dönüyordu (Lorient, Marseille:
    // 1.118'de takılıyordu). İlerleme durunca doğrudan beyaza gidilir.
    if (sonraki == kart) {
      kart = const Color(0xFFFFFFFF);
      break;
    }
    kart = sonraki;
    adim++;
  }
  return kart;
}
