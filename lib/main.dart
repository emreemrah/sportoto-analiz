// KAYNAK: app/index.js + app/App.js (kök kurulum).
//
// Kaynakta ekran yönü ve durum çubuğu app.json + expo-status-bar ile
// ayarlanıyordu ("orientation": "portrait"). Flutter'da karşılığı burada
// açıkça kurulur.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/auth.dart';
import 'core/coupon/coupon_store.dart';
import 'core/prefs.dart';
import 'core/security/biometric_lock.dart';
import 'core/services/push_service.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // GÖRÜNÜM TERCİHLERİ — kaynakta `prefs.js` modül yüklenirken diski okumaya
  // başlıyor ve ekranlar `getPref()` ile SENKRON okuyordu. Aynı imzayı
  // korumak için disk okuması burada, ilk kare çizilmeden bitirilir.
  // Beklemek güvenli: tek bir küçük anahtar okunur.
  await prefsYukle();

  // app.json → "orientation": "portrait"
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Uygulamanın zemini açıktır; durum çubuğu simgeleri koyu olmalı.
  SystemChrome.setSystemUIOverlayStyle(AppTheme.lightScreenOverlay);

  // YEREL BİLDİRİM — eklenti burada ilklendirilir. İZİN SORULMAZ: kullanıcı
  // Bildirimler ekranındaki anahtarı çevirene kadar hiçbir şey istenmez
  // (kaynaktaki `ayariDegistir` düzeni). Hata yutulmaz, saklanır ve o ekranda
  // gerçek teknik durum olarak gösterilir.
  await pushIlklendir();

  // KUPON DEPOSU — diskten geri yükle, sonra oturum kancalarını bağla.
  //
  // Kancalar auth.dart'ta BİLEREK açık bırakılmıştı. Bağlanmazsa kaynakta bir
  // kez yaşanmış olan hata sessizce geri gelir: A çıkış yapıp B girdiğinde B,
  // A'nın kuponlarını GÖRÜR — dahası ilk senkronda o kuponlar B'NİN HESABINA
  // yazılır. İki katmanlı koruma buradan kurulur.
  await couponStoreYukle();
  couponIzolasyonKancasi = yereliTemizle;
  couponSahipKancasi = (userId) async {
    await sahibiAyarla(userId);
    await syncFromServer();
  };

  // BİLDİRİM İPTAL KANCASI — kaynakta `auth.js` çıkışta ve uzaktan oturum
  // kapatmada `cancelAllOurNotifications()` çağırıyor. Kanca bağlanmazsa
  // `auth.dart`taki `bildirimIptalKancasi?.call()` null olur ve SESSİZCE
  // atlanır: çıkan kullanıcının maç hatırlatmaları telefonda kalır, cihazı
  // devralan kişiye onun maçları bildirilir. Hata ne derlemede ne analizde
  // görünür — bu yüzden bağlantı burada, diğer iki kancayla aynı yerde.
  bildirimIptalKancasi = cancelAllOurNotifications;

  // ─── AÇILIŞ SIRASI (kaynak App.js ile aynı) ───────────────────────────
  // servisler hazır → YEREL oturum yüklenir → giriş durumu belli →
  // biyometrik ayar okunur → gerekiyorsa kilit → korunan uygulama. Uzak
  // doğrulama/tazeleme açılışı BEKLETMEZ.
  //
  // ZAMAN AŞIMI BİLEREK YOK (8 sn'lik sınır 2026-08-09'da kaldırıldı):
  // beklenen aşama yalnız DİSK okur (initAuthYerel — token_store her okuma
  // hatasını null'a çevirir, asılacak ağ çağrısı yoktur). Eski kurgu tek
  // `initAuth()`ı 8 sn ile kesiyordu; ağ yavaşken `authState.token` daha
  // dolmadan karar veriliyor (giriş ekranı parlıyor, kilit atlanabiliyordu)
  // ve kesilen Future arkada yaşamaya devam edip geç `catch` ile oturumu
  // KALICI silebiliyordu. Ayrıntı: core/auth.dart, iki aşamanın başındaki
  // not.
  final kilitli = await acilisKilitKarari(
    oturumuYukle: initAuthYerel,
    kilitGerekliMi: needsLockOnLaunch,
    girisliMi: () => getToken() != null,
  );

  // Profil tazeleme + sessiz belirteç yenileme arka planda sürer; sonucu
  // `authState` üzerinden olağan yolla akar. Yalnız KESİN sunucu reddi
  // (401) oturumu düşürür — geçici ağ hatası oturuma dokunmaz.
  unawaited(initAuthUzak());

  runApp(ProviderScope(child: MasterAnalizApp(baslangictaKilitli: kilitli)));
}

/// AÇILIŞ KARARI — sınanabilir dikiş.
///
/// `main()` doğrudan bu işlevden geçer; testler aynı sırayı sahte
/// bağımlılıklarla sınar (test/acilis_sirasi_test.dart). Sözleşme:
///   1. Önce [oturumuYukle] TAMAMLANIR (yerel disk; zaman aşımı yok).
///   2. Giriş durumu ANCAK ondan sonra okunur — karar, yüklenmemiş duruma
///      bakamaz.
///   3. Her iki adımın hatası da açılışı engellemez: oturum yüklenemezse
///      oturumsuz (kilitsiz) devam edilir, kilit sorgusu patlarsa uygulama
///      kilitsiz açılır (erişim kaybettirmek hata durumunun cezası olamaz;
///      oturum yoksa korunacak içerik de yoktur — giriş zaten şifre ister).
@visibleForTesting
Future<bool> acilisKilitKarari({
  required Future<void> Function() oturumuYukle,
  required Future<bool> Function(bool girisli) kilitGerekliMi,
  required bool Function() girisliMi,
}) async {
  try {
    await oturumuYukle();
  } catch (_) {
    // yüklenemeyen oturum = oturumsuz açılış
  }
  final girisli = girisliMi();
  try {
    return await kilitGerekliMi(girisli);
  } catch (_) {
    return false;
  }
}
