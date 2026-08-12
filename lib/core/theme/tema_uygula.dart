// YAPISAL RENKLERİ TAKIM PALETİNE ÇEVİRME (kullanıcı isteği, 2026-08-11)
//
// `AppColors`ın yapısal alanları artık değişken (bkz. tokens.dart). Bu dosya
// onları seçili takımın paletine yazar; palet yoksa marka varsayılanlarına
// geri döner.
//
// NEDEN BÖYLE: uygulamada `Theme.of(context)` hiç kullanılmıyor ve renkler
// 1834 yerde doğrudan `AppColors.x` olarak okunuyor. Tek tek dosya
// değiştirmek yerine KAYNAĞI değiştiriyoruz; ağaç yeniden çizilince bütün
// ekranlar — bülten kartları, maç kartları, modallar, yan menü, boş durumlar —
// yeni paleti okur. Kullanıcının istediği bütüncüllük ancak böyle olur.
//
// ANLAMSAL RENKLERE DOKUNULMAZ: success / warning / danger / info ve
// green / yellow / red / orange / gold / field `const` kaldı ve burada hiç
// geçmiyor. Kırmızı takım seçilse bile "hata" kırmızısı değişmez.

import 'dart:ui';

import 'takim_paleti.dart';
import 'tokens.dart';

/// Şu an uygulanmış palet (null = varsayılan marka teması).
TakimPaleti? _aktifPalet;

TakimPaleti? get aktifTakimPaleti => _aktifPalet;

/// Yapısal renkleri [p] paletine çevirir; [p] null ise varsayılana döner.
///
/// Aynı takım için iki kez çağrılması zararsızdır (idempotent).
void temayiUygula(TakimPaleti? p) {
  _aktifPalet = p;

  if (p == null) {
    AppColors.background = VarsayilanRenkler.background;
    AppColors.surface = VarsayilanRenkler.surface;
    AppColors.surfaceSoft = VarsayilanRenkler.surfaceSoft;
    AppColors.primary = VarsayilanRenkler.primary;
    AppColors.primaryDark = VarsayilanRenkler.primaryDark;
    AppColors.primarySoft = VarsayilanRenkler.primarySoft;
    AppColors.accent = VarsayilanRenkler.accent;
    AppColors.accentSoft = VarsayilanRenkler.accentSoft;
    AppColors.text = VarsayilanRenkler.text;
    AppColors.textSoft = VarsayilanRenkler.textSoft;
    AppColors.muted = VarsayilanRenkler.muted;
    AppColors.border = VarsayilanRenkler.border;
    AppColors.darkCard = VarsayilanRenkler.darkCard;
    AppColors.darkCardSoft = VarsayilanRenkler.darkCardSoft;
    AppColors.bg = VarsayilanRenkler.background;
    AppColors.bgAlt = VarsayilanRenkler.surfaceSoft;
    AppColors.card = VarsayilanRenkler.surface;
    AppColors.cardAlt = VarsayilanRenkler.cardAlt;
    AppColors.textMuted = VarsayilanRenkler.muted;
    AppColors.gray = VarsayilanRenkler.muted;
    AppColors.track = VarsayilanRenkler.track;
    AppColors.onPrimary = VarsayilanRenkler.onPrimary;
    AppColors.onAccent = VarsayilanRenkler.onAccent;
    return;
  }

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

  // İKİNCİ RENK GÖRÜNÜR OLSUN (kullanıcı isteği): birincil aksiyonlar ve
  // seçili alanlar vurgu rengini kullanır — ikincil renk "küçük detay" olarak
  // kalmaz.
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

  // SOLUK TONLAR: yazı soluklaşır ama AA eşiğinin ALTINA DÜŞMEZ. Önce
  // yüzeye doğru çekilir, sonra eşiği geçene dek geri itilir — ölçüldü, düz
  // soluklaştırmada 150 takımın 86'sında ikincil yazı okunmuyordu.
  // Soluk yazı ÜÇ zeminin üstüne birden düşüyor (kart, ana zemin, ara şerit);
  // en zoruna göre ayarlanır, yoksa biri kazanırken diğeri kaybediyor.
  final zeminler = [p.yuzey, p.zemin, araYuzey];
  AppColors.textSoft = _solukAmaOkunur(p.metin, zeminler, 0.32);
  final soluk = _solukAmaOkunur(p.metin, zeminler, 0.52);
  AppColors.muted = soluk;
  AppColors.textMuted = soluk;
  AppColors.gray = soluk;

  AppColors.border = p.kenarlik;

  // Koyu kart yüzeyleri (açılış/kilit ekranı gibi) takımın koyu tonuna gider.
  AppColors.darkCard = gorecelParlaklik(p.zemin) > 0.5
      ? karart(p.zemin, 0.82)
      : p.zemin;
  AppColors.darkCardSoft = acikla(AppColors.darkCard, 0.08);
}

/// Rozet/çip zemini: [renk]in yumuşak tonu, ama ÜSTÜNDE [renk] yazı olarak
/// okunacak kadar ondan uzak.
///
/// `Pill` gibi bileşenler (zemin, yazı) çiftini `(primarySoft, primary)` diye
/// kullanıyor; iki değer birbirine yaklaşırsa rozet okunmaz hâle gelir.
Color _yumusakZemin(Color renk, bool yuzeyAcik) {
  // YÖN, RENGİN KENDİ OKUNUR METNİNE DOĞRUDUR — yüzeyin açık/koyu olmasına
  // bakmak, beyaza dayanmış bir vurgu renginde (US Lecce, Arouca, Le Mans)
  // yanlış yöne itip rozeti okunmaz bırakıyordu. Renk koyuysa zemin açılır,
  // renk açıksa zemin koyulaşır; bu aynı zamanda kartın uçlarıyla da uyumlu.
  final acigaGit = gorecelParlaklik(okunurMetin(renk)) > 0.5;
  var z = acigaGit ? acikla(renk, 0.85) : karart(renk, 0.62);
  var adim = 0;
  while (kontrastOrani(z, renk) < kAaEsigi && adim < 60) {
    final sonraki = acigaGit ? acikla(z, 0.05) : karart(z, 0.05);
    // YUVARLAMA TUZAĞI: uca çok yaklaşınca %5'lik adım aynı tamsayıya
    // yuvarlanıyor ve döngü ilerlemeden 60 turu tüketiyordu (US Lecce,
    // Arouca, Le Mans: 4.43'te takılı kalıyordu, oysa saf beyazla 4.77
    // sağlanıyor). İlerleme durduğunda doğrudan uca gidilir.
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
///
/// Sıralama önemli: önce soluklaştırıp sonra eşiğe çekmek, "olabildiğince
/// soluk ama hâlâ okunur" en iyi noktayı verir. Tersi (önce eşik) her zaman
/// ana metinle aynı tonu üretirdi.
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
