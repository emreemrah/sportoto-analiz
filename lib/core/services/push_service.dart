// KAYNAK: app/src/services/pushService.js — çeviri.
//
// TELEFON / KİLİT EKRANI BİLDİRİMİ — CİHAZ SARMALAYICISI
// (flutter_local_notifications).
//
// Karar mantığı burada DEĞİL:
//   • "bu ortamda bildirim kurulabilir mi?"  → core/push_env.dart     (saf)
//   • "hangi bildirim, ne zaman, ne yazacak?" → core/push_planner.dart (saf)
//   • "izin/plan/cihaz durumu nasıl uzlaşır?" → core/push_sync.dart    (saf)
// Bu dosya yalnız CİHAZLA konuşur: eklentiyi kurar, izin ister, kanalı hazırlar,
// zamanlar, iptal eder. (Aynı ayrım: security/biometric_lock.dart ↔
// bio_lock_policy.dart.)
//
// KAPSAM — DÜRÜST SINIR:
//   • Kurulan bildirimler YEREL'dir: telefon kendi saatiyle çalar, sunucu ve
//     internet gerekmez.
//   • SUNUCUDAN GÖNDERİLEN (uzak/push, FCM) bildirim BU DOSYADA YOKTUR.
//   • Bu yüzden yalnız ÖNCEDEN bilinen bir olay hatırlatılır: kullanıcının kendi
//     kuponundaki maçın başlama saati. Başlama saati yoksa bildirim UYDURULMAZ.
//
// ────────────────────────────────────────────────────────────────────────────
// KAYNAKTAKİ İKİ AŞAMALI MODÜL YÜKLEMESİ ÇEVRİLMEDİ — NEDENİ
//
// Kaynak, `expo-notifications` paketinin giriş dosyası uzak-push alt
// modüllerini de yüklediği ve Expo Go'da bunlar kayıtlı olmadığı için import'un
// patlamasına karşı iki aşamalı bir yükleme kurmuştu (önce paketin tamamı,
// olmazsa yalnız yerel bildirim alt modülleri). `flutter_local_notifications`
// tek parça bir eklentidir ve derleme zamanında bağlanır — kısmen yüklenmesi
// mümkün değildir, dolayısıyla o yedek yolun karşılığı yok.
//
// KORUNAN: gerçek hata metni saklanır ve ekranda gösterilir; sessizce
// "tarayıcı" DENMEZ. Yanlış teşhis kaynakta bulunan asıl hataydı.
//
// ────────────────────────────────────────────────────────────────────────────
// KURULU KAYITLARIN GERİ OKUNMASI
//
// `flutter_local_notifications` bekleyen kayıtları `id` (int), `title`, `body`
// ve `payload` ile döndürür — bizim metin kimliğimizi (`mac:1528:3`) ve
// `fireAt`'i taşımaz. Kaynakta bu bilgi bildirimin `content.data` alanına
// yazılıp oradan okunuyordu; burada aynı şey `payload`a JSON olarak yazılır.
// Böylece `push_sync` sözleşmesi (id + fireAt + kind) değişmeden çalışır.

import 'dart:convert';

import 'package:flutter/material.dart' show Color;
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../push_env.dart';
import '../push_planner.dart';
import '../push_sync.dart';

// YENİ anahtar — mevcut hiçbir anahtarın adı değiştirilmedi.
// İçinde kişisel veri YOK: yalnız aç/kapa tercihi ve kaç dakika önce.
const String kPushKey = 'sportoto.push.v1';

// Kanal kimliği Android'de kalıcıdır; adı değiştirilirse kullanıcının ses/
// titreşim tercihi sıfırlanır — bu yüzden sabit.
const String kKanalId = 'mac-hatirlatma';
const String _kKanalAd = 'Maç hatırlatmaları';
const String _kKanalAciklama =
    'Kuponundaki maç başlamadan önce düşen hatırlatmalar.';

final FlutterLocalNotificationsPlugin _plugin =
    FlutterLocalNotificationsPlugin();

bool _ilklendi = false;
Object? _yuklemeHatasi;

String get _platformOS => kIsWeb
    ? 'web'
    : switch (defaultTargetPlatform) {
        TargetPlatform.android => 'android',
        TargetPlatform.iOS => 'ios',
        _ => 'other',
      };

/// Uygulama açılışında bir kez çağrılır. Hata YUTULMAZ, saklanır.
Future<void> pushIlklendir() async {
  if (_ilklendi || kIsWeb) return;
  try {
    tzdata.initializeTimeZones();
    // Cihazın yerel bölgesi okunamıyorsa zamanlama UTC'ye kayar ve bildirim
    // yanlış saatte düşer; bu yüzden yerel bölge açıkça kurulur.
    tz.setLocalLocation(tz.local);

    await _plugin.initialize(
      settings: const InitializationSettings(
        // KAYNAK: app.json → plugins["expo-notifications"].icon
        // (android-icon-monochrome.png). Android bildirim ikonunu SİLUETE
        // çevirir; renkli launcher ikonu kullanılırsa beyaz bir kare görünür.
        // Bu yüzden tek renkli sürüm ayrı bir drawable olarak konuldu.
        android: AndroidInitializationSettings('ic_notification'),
        iOS: DarwinInitializationSettings(
          // İzin AÇILIŞTA istenmez: kullanıcı anahtarı çevirdiğinde sorulur
          // (kaynaktaki `ayariDegistir` düzeni).
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
    _ilklendi = true;
    _yuklemeHatasi = null;
  } catch (e) {
    _ilklendi = false;
    _yuklemeHatasi = e;
  }
}

PushOrtam get _ortam => ortamiSinifla(
  platformOS: _platformOS,
  ilklendi: _ilklendi,
  yuklemeHatasi: _yuklemeHatasi,
);

/// Ekranın gösterdiği ortam açıklaması.
String ortamMesaji() {
  final o = _ortam;
  return ortamAciklamasi(
    durum: o.durum,
    platform: o.platform,
    teknik: o.teknik,
  );
}

String ortamTani() => ortamOzeti(_ortam);

bool isDesteklenir() => _ortam.destek;

/// `push_sync.PushNative` uygulaması — TEK cihaz dokunma noktası.
class _Native implements PushNative {
  @override
  bool get destek => _ortam.destek;
  @override
  String get durum => _ortam.durum;
  @override
  String get platform => _ortam.platform;
  @override
  String get teknik => _ortam.teknik;
  @override
  String get uyari => _ortam.uyari;
  @override
  String get kaynak => _ortam.kaynak;

  AndroidFlutterLocalNotificationsPlugin? get _android => _plugin
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();

  IOSFlutterLocalNotificationsPlugin? get _ios => _plugin
      .resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin
      >();

  @override
  Future<String> izinOku() async {
    if (_platformOS == 'android') {
      final v = await _android?.areNotificationsEnabled();
      return v == true ? 'granted' : 'denied';
    }
    // iOS'ta "sorulmadan okuma" ayrı bir uç sunmaz; izin isteği zaten
    // kullanıcı anahtarı çevirince yapılır. Burada varsayım üretmemek için
    // 'denied' döner — `izinAl(sor: true)` gerçek durumu getirir.
    return 'denied';
  }

  @override
  Future<String> izinIste() async {
    if (_platformOS == 'android') {
      final v = await _android?.requestNotificationsPermission();
      if (v == true) return 'granted';
      // Android 13+ ikinci retten sonra sistem penceresi HİÇ açılmaz; bu
      // durumda kullanıcı ayarlara yönlendirilmeli.
      final acik = await _android?.areNotificationsEnabled();
      return acik == true ? 'granted' : 'blocked';
    }
    final v = await _ios?.requestPermissions(
      alert: true,
      badge: true,
      sound: true,
    );
    return v == true ? 'granted' : 'denied';
  }

  @override
  Future<List<({String id, int fireAt, String kind})>> kurulular() async {
    final list = await _plugin.pendingNotificationRequests();
    final out = <({String id, int fireAt, String kind})>[];
    for (final r in list) {
      final p = r.payload;
      if (p == null || p.isEmpty) continue;
      try {
        final m = jsonDecode(p) as Map;
        final id = m['id'];
        final fireAt = m['fireAt'];
        final kind = m['kind'];
        if (id is String && kind is String) {
          out.add((
            id: id,
            fireAt: fireAt is num ? fireAt.toInt() : 0,
            kind: kind,
          ));
        }
      } catch (_) {
        // Bizim yazmadığımız bir kayıt — atlanır, dokunulmaz.
      }
    }
    return out;
  }

  /// Metin kimliğinden KARARLI bir tamsayı üretir.
  ///
  /// Eklenti yalnız int kimlik kabul eder; kaynaktaki metin kimlik
  /// (`mac:1528:3`) korunmak zorunda çünkü tekrar kurulmayı o önlüyor. Aynı
  /// metin her zaman aynı sayıyı vermeli, yoksa iptal isteği başka bir kaydı
  /// silerdi. 31 bit'e kırpılır: Android bildirim kimliği imzalı int'tir.
  static int _sayisalId(String s) {
    var h = 0;
    for (final c in s.codeUnits) {
      h = (h * 31 + c) & 0x7FFFFFFF;
    }
    return h;
  }

  @override
  Future<void> zamanla(PlanItem p) async {
    final ne = tz.TZDateTime.fromMillisecondsSinceEpoch(tz.local, p.fireAt);
    await _plugin.zonedSchedule(
      id: _sayisalId(p.id),
      title: p.title,
      body: p.body,
      scheduledDate: ne,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          kKanalId,
          _kKanalAd,
          channelDescription: _kKanalAciklama,
          importance: Importance.high,
          priority: Priority.high,
          // KAYNAK: app.json → plugins["expo-notifications"].color
          color: Color(0xFF0B1B3A),
        ),
        iOS: DarwinNotificationDetails(),
      ),
      // Kesin zamanlama İSTENMEZ: Android 12+ "tam alarm" izni ayrı bir izindir
      // ve maç hatırlatması için birkaç dakikalık sapma kabul edilebilir.
      // İzin istemek, vermeyen kullanıcıda hiç bildirim kurulamamasına yol
      // açardı.
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      // Kimlik + düşme anı + tür yalnız buradan geri okunur (tek doğru kaynak).
      payload: jsonEncode({
        'id': p.id,
        'fireAt': p.fireAt,
        'kind': p.data['kind'],
        'tab': p.data['tab'],
        'screen': p.data['screen'],
        'params': p.data['params'],
      }),
    );
  }

  @override
  Future<void> iptal(String id) => _plugin.cancel(id: _sayisalId(id));

  @override
  Future<void> kanalHazirla() async {
    await _android?.createNotificationChannel(
      const AndroidNotificationChannel(
        kKanalId,
        _kKanalAd,
        description: _kKanalAciklama,
        importance: Importance.high,
      ),
    );
  }
}

/// Tercih deposu — `sportoto.push.v1`.
class _Store implements PushStore {
  @override
  Future<PushTercih> oku() async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(kPushKey);
    if (raw == null || raw.isEmpty) return kVarsayilanTercih;
    try {
      final m = jsonDecode(raw) as Map;
      final onceDk = m['onceDk'];
      return (
        enabled: m['enabled'] == true,
        onceDk: onceDk is num ? onceDk.toInt() : kVarsayilanTercih.onceDk,
      );
    } catch (_) {
      return kVarsayilanTercih;
    }
  }

  @override
  Future<void> yaz(PushTercih t) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(
      kPushKey,
      jsonEncode({'enabled': t.enabled, 'onceDk': t.onceDk}),
    );
  }
}

final _nat = _Native();
final _store = _Store();

// ---------------------------------------------------------------------------
// Ekranın kullandığı dışa açık yüzey (kaynaktaki adlarla)
// ---------------------------------------------------------------------------

Future<PushTercih> getPushPrefs() => _store.oku();

Future<PushDurumOzet> pushDurumu() =>
    durumOku(nat: _nat.destek ? _nat : null, store: _store);

Future<({bool enabled, String izin, SenkronSonuc? senkron, int iptal})>
setPushEnabled(bool istenen, {int? now, Map? bulletin, List? coupons}) =>
    ayariDegistir(
      nat: _nat.destek ? _nat : null,
      store: _store,
      ac: istenen,
      now: now ?? DateTime.now().millisecondsSinceEpoch,
      bulletin: bulletin,
      coupons: coupons,
    );

Future<SenkronSonuc> syncMatchReminders({
  int? now,
  Map? bulletin,
  List? coupons,
}) => macSenkron(
  nat: _nat.destek ? _nat : null,
  store: _store,
  now: now ?? DateTime.now().millisecondsSinceEpoch,
  bulletin: bulletin,
  coupons: coupons,
);

Future<TestSonuc> testBildirimiGonder({int? now}) => testKur(
  nat: _nat.destek ? _nat : null,
  store: _store,
  now: now ?? DateTime.now().millisecondsSinceEpoch,
);

Future<TestMacSonuc> macTestiGonder({int? now, Map? bulletin}) => testMacKur(
  nat: _nat.destek ? _nat : null,
  store: _store,
  now: now ?? DateTime.now().millisecondsSinceEpoch,
  bulletin: bulletin,
);

/// Oturum biterken çağrılır: bizim kurduğumuz HER kayıt temizlenir.
///
/// Üç yol da buraya bağlıdır (kaynakta `auth.js` ile aynı): normal çıkış,
/// uzaktan kapatılan oturum ve hesap silme. Aksi hâlde hesap kapandıktan
/// SONRA da telefon çalmaya devam eder; cihazı devralan kişiye eski
/// kullanıcının maçları hatırlatılır.
///
/// KAPSAM: yalnız BİZİM kimlik kalıbımızdaki kayıtlar (`hepsiniIptal` →
/// `ayikla`). Başka uygulamaların ya da sistemin bildirimlerine dokunulmaz.
Future<void> cancelAllOurNotifications() async {
  await hepsiniIptal(_nat.destek ? _nat : null);
}
