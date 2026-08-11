// KAYNAK: app/src/localData.js — BİREBİR çeviri.
//
// CİHAZDAKİ YEREL VERİ — anahtar listesi ve temizleme.
//
// Bu anahtarlar cihazda tutulan oturum, tercih ve kupon taslaklarıdır; sunucuya
// gönderilmezler. Hesap SİLİNDİKTEN SONRA cihazda iz kalmaması için temizlenir.
//
// KESİN KURAL: Anahtar adları DEĞİŞTİRİLEMEZ. Adı değişen bir anahtar,
// kullanıcının mevcut verisini erişilemez hâle getirir (yetim veri).

import 'package:shared_preferences/shared_preferences.dart';

const List<String> kLocalKeys = [
  'sportoto.token', // oturum belirteci
  'sportoto.refresh', // oturum yenileme anahtarı
  'sportoto.session', // sunucu oturum kimliği
  'sportoto.prefs', // ekran tercihleri
  'sportoto.coupons.v1', // eski kupon deposu
  'sportoto.couponCenter.v1', // kupon merkezi
  'sportoto.couponCenterDraft.v1', // kupon taslağı
  // Kriter seçme sistemi 2026-08-07'de kaldırıldı. Anahtarlar listede KALIYOR:
  // eski sürümden kalan veriyi hesap silme / çıkış akışında temizlemek gerekir.
  'sportoto.analysisProfiles.v2', // (kaldırıldı) analiz profilleri
  'sportoto.analysisProfile.v1', // (kaldırıldı) eski tekil analiz profili
  'sportoto.notifications.v1', // bildirim merkezi durumu (okunmuşlar)
  'sportoto.push.v1', // telefon bildirimi tercihi (aç/kapa + kaç dk önce)
];
// Not: 'sportoto.device' bilerek listede DEĞİL — rastgele, kişisel veri
// içermeyen cihaz kimliğidir; güvenli depodaki temizlik logout() içindeki
// clearPersisted() ile yapılır.

class WipeResult {
  const WipeResult(this.cleared, this.failed);
  final List<String> cleared;
  final List<String> failed;
}

/// Yerel verileri temizler. Bir anahtarın hata vermesi diğerini ENGELLEMEZ;
/// hangi anahtarların silindiği dürüstçe döndürülür.
///
/// Kaynakta iki depo (localStorage + AsyncStorage) parametre olarak geçiyordu;
/// Flutter'da ikisinin karşılığı tek `SharedPreferences`tır (web'de zaten
/// localStorage üstünde çalışır), bu yüzden tek depo yeter.
Future<WipeResult> wipeLocalData({SharedPreferences? store}) async {
  final cleared = <String>[];
  final failed = <String>[];
  final sp = store ?? await SharedPreferences.getInstance();

  for (final key in kLocalKeys) {
    try {
      await sp.remove(key);
      cleared.add(key);
    } catch (_) {
      failed.add(key);
    }
  }

  return WipeResult(cleared, failed);
}
