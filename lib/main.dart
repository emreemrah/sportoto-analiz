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

  // OTURUM GERİ YÜKLEME — kaynakta App.js açılış animasyonu boyunca
  // `initAuth()` bekleniyordu (splash en az 1.2 sn görünür kalır).
  // Açılış ekranı henüz çevrilmedi (Adım 4), bu yüzden BEKLENMEZ: ağ
  // yavaşsa uygulama açılışı kilitlenmesin. Ekranlar `authState`i dinliyor;
  // oturum gelince kendini tazeliyor. Splash gelince burası `await`e döner.
  unawaited(initAuth());

  runApp(const ProviderScope(child: MasterAnalizApp()));
}
