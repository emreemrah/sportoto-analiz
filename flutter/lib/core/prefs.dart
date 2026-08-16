// KAYNAK: app/src/prefs.js — BİREBİR çeviri.
//
// Kullanıcı GÖRÜNÜM/KULLANIM tercihleri (veri doğruluğu / resmi kaynak DEĞİL —
// onlar asla kullanıcıya bırakılmaz). Sahte veri / resmi olmayan bülten
// seçeneği burada YOKTUR.
//
// KALICILIK: shared_preferences (kaynakta web'de localStorage, telefonda
// AsyncStorage). Anahtar adı 'sportoto.prefs' KORUNDU.
//
// SENKRON OKUMA: kaynakta `getPref(k)` senkrondu ve ekranlar doğrudan çağırıyor.
// Aynı imza korunsun diye değerler bellekte tutulur; disk okuması açılışta bir
// kez yapılır (`prefsYukle`). Kaynaktaki "geç gelen disk taze seçimi ezmez"
// kuralı da aynen taşındı.

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _key = 'sportoto.prefs';

/// Kaynaktaki `defaults`. Değerler ve yorumlar birebir.
const Map<String, Object?> kPrefDefaults = {
  'liveStatView': 'table', // 'table' | 'graph'
  'liveSort': 'bulletin', // 'bulletin' | 'liveTop' | 'doneBottom'
  'rememberFilter': true, // filtre seçimini hatırla
  'liveLastFilter': 'all', // 'all' | 'live' | 'risk' | 'coupon' | 'done'
  'liveAnim': 'important', // 'on' | 'off' | 'important'
  // SAPMA (2026-08-10): kaynaktaki 'prizeView' ('list'|'table'|'card')
  // KALDIRILDI — ikramiye bölümü tek görünüm (resmî Liste yazımı,
  // prize_section.dart). Diskte kalmış eski değer okunmaz, zararsızdır.
  'histResultMode': 'simple', // 'simple' | 'detailed' | 'technical'
  'histSort': 'bulletin', // 'bulletin' | 'resolvedTop' | 'waitingBottom'
  'sysDashView': 'simple', // 'simple' | 'detailed' | 'technical'
  'sysDashRange': 'all', // 'all' | 'last5' | 'last10'
  // SAPMA (2026-08-10): kullanıcı paneli "Haftalık Başarı" düzenine geçti —
  // değerler 'ozet' | 'maclar' (rol ayrımıyla 'gecmis' kaldırıldı); diskte
  // kalmış eski değerler okunurken Özet'e düşer.
  'userDashView': 'ozet',
  'couponPlace': 'both', // kolon/tutar yeri: 'top' | 'bottom' | 'both'
  'couponPreview': true, // kayıt öncesi önizleme
  // KUPON AKTARIM GENİŞLİĞİ. Kaynakta iki değerliydi ('single'|'wide');
  // 2026-08-11'de kullanıcı isteğiyle dörde çıktı ve VARSAYILAN OTOMATİK oldu:
  // "tekli geniş seçimi maçın kazanır oranına göre kendi belirlenecek".
  // 'auto' | 'single' | 'double' | 'closed'  ('wide' eski kayıt → çifte)
  'couponSysMode': 'auto',
  'couponBudget': null, // kullanıcı bütçe limiti (TL) — null = yok
  // MAÇ DETAYI SEKME GÖRÜNÜRLÜĞÜ (2026-08-11 kullanıcı isteği): kullanıcının
  // KAPATTIĞI sekmelerin adları. Açık sekmeler değil KAPALI olanlar tutulur —
  // ileride yeni bir sekme eklenirse eski kayıtlarda kendiliğinden AÇIK gelir;
  // kullanıcı hiç görmediği bir sekmeyi kapatmış sayılmaz.
  'macDetayGizliSekmeler': <String>[],
  // GÖRÜNÜM TERCİHİ (kullanıcı isteği, 2026-08-12).
  //
  // Uygulamanın açık/koyu görünümü ARTIK FAVORİ TAKIMDAN GELMEZ; yalnız bu
  // tercih belirler. Favori takım profil, arma ve filigran gibi KİMLİK
  // alanlarında kalır.
  //
  // 'sistem' | 'acik' | 'koyu' — varsayılan, cihazın kendi ayarını izler.
  'gorunumModu': 'sistem',
};

Map<String, Object?> _cache = Map.of(kPrefDefaults);
bool _diskYuklendi = false;

/// Tercih değişince haber verir (kaynaktaki `subscribePrefs`).
final ValueNotifier<int> prefsSurumu = ValueNotifier<int>(0);

void _duyur() => prefsSurumu.value++;

/// Tercihler diskten yüklendi mi? (ekran isterse bekleyebilir)
bool prefsHazir() => _diskYuklendi;

/// Açılışta BİR KEZ çağrılır (main.dart).
///
/// Kaynaktaki kural: diskten gelen değerler ALTA serilir, mevcut bellek üstte
/// kalır — geç gelen disk, kullanıcının o arada yaptığı taze seçimi ezmez.
Future<void> prefsYukle() async {
  try {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(_key);
    if (raw != null && raw.isNotEmpty) {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        _cache = {
          ...kPrefDefaults,
          ...decoded.map((k, v) => MapEntry('$k', v)),
          ..._degistirilenler,
        };
      }
    }
  } catch (_) {
    /* bozuk kayıt: varsayılanlarla devam */
  } finally {
    _diskYuklendi = true;
    _duyur();
    // Disk gelmeden yapılan seçimler bekletiliyordu; artık güvenle yazılır
    // (blob diskteki değerlerle BİRLEŞMİŞ hâlde). Bekleyen seçim yoksa
    // gereksiz yazma yapılmaz.
    if (_degistirilenler.isNotEmpty) _diskeYaz();
  }
}

/// Disk gelmeden önce kullanıcının değiştirdiği anahtarlar.
final Map<String, Object?> _degistirilenler = {};

Object? getPref(String k) => _cache[k];

Map<String, Object?> getPrefs() => Map.of(_cache);

void setPref(String k, Object? v) {
  _cache = {..._cache, k: v};
  _degistirilenler[k] = v;
  _duyur();
  // DİSK GELMEDEN YAZILMAZ (16 Ağustos 2026 — ölçülen veri kaybı).
  //
  // Tüm tercihler TEK JSON blob'unda tutuluyor ve `setPref` blob'un TAMAMINI
  // yazıyor. Açılışta disk henüz yüklenmemişken `_cache` yalnız
  // VARSAYILANLARDIR; o anda herhangi bir tercih yazılırsa (bir liste
  // sıralaması, takip edilen maç, kupon ayarı…) diskteki KAYITLI TERCİHLERİN
  // HEPSİ varsayılanlarla ezilirdi.
  //
  // Gerçekte yaşandı: kullanıcı takım temasını seçti, sonraki bir açılışta
  // `gorunumModu` diskte 'sistem'e döndü ve uygulama varsayılan açık temada
  // açıldı. Yükleme tarafında ters yön zaten korunuyordu (`_degistirilenler`
  // geç gelen diskin taze seçimi ezmesini engelliyor); eksik olan bu yöndü.
  //
  // Değişiklik bellekte ve `_degistirilenler`de DURUR; disk yüklenince
  // `prefsYukle` onları birleştirip yazar. Yani hiçbir seçim kaybolmaz.
  if (!_diskYuklendi) return;
  _diskeYaz();
}

/// Belleği diske yazar. Eşzamansızdır ve hatası akışı BOZMAZ — bir tercihin
/// kaydedilememesi, ekranın çökmesinden iyidir.
void _diskeYaz() {
  () async {
    try {
      final sp = await SharedPreferences.getInstance();
      await sp.setString(_key, jsonEncode(_cache));
    } catch (_) {
      /* yok sayılır */
    }
  }();
}
