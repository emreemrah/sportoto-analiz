// KAYNAK: app/src/pushSync.js — BİREBİR çeviri.
//
// TELEFON BİLDİRİMİ — İZİN VE ZAMANLAMA DÜZENİ (SAF MODÜL)
//
// Bildirim eklentisi burada İMPORT EDİLMEZ. Cihazla konuşan her çağrı
// dışarıdan `nat` (yerli katman) olarak enjekte edilir; tercih deposu da
// `store` olarak. Böylece "izin reddedilirse ne olur", "izin geri alınırsa ne
// olur", "aynı maç iki kupondaysa kaç bildirim kurulur" gibi sorular düz Dart
// testinde CİHAZSIZ doğrulanabilir.
//
// Bölüşüm:
//   push_env.dart     → "bu ortamda bildirim kurulabilir mi?" (ortam/yetenek)
//   push_planner.dart → "hangi bildirim, ne zaman, hangi metinle?" (plan)
//   push_sync.dart    → "izin/plan/cihaz durumu nasıl uzlaştırılır?" (bu dosya)
//   services/push_service.dart → gerçek eklenti çağrıları (yerli katman)
//
// DÜRÜSTLÜK KURALLARI:
//  1) İzin verilmediyse tercih "açık" olarak YAZILMAZ. Aksi hâlde ekran "açık"
//     görünür ama telefona hiçbir şey düşmezdi.
//  2) İzin sonradan telefon ayarlarından geri alındıysa, uygulama öne geldiğinde
//     tercih dürüstçe kapanır.
//  3) "Kuruldu" demeden ÖNCE cihazdan geri okunur. İşletim sistemi zamanlamayı
//     kabul etmediyse kurulmuş sayılmaz.
//  4) Kimlikler maç kimliğiyle ilişkilidir (`mac:<hafta>:<no>`); aynı maç birden
//     çok kupon/tahminde geçse de tek bildirim kurulur.
//  5) Test bildirimi kişisel veri TAŞIMAZ.

import 'push_dev_test.dart';
import 'push_planner.dart';

/// Bildirim türleri — cihazdaki kayıtları ayırt etmek için.
const String kMacKind = 'match-starting';
const String kTestKind = 'test-notification';

/// Test bildiriminin sabit kimliği — tekrar basılınca çoğalmaz, üzerine yazılır.
const String kTestId = 'test:bildirim';

/// Test bildirimi kaç saniye sonra düşsün (kullanıcıya "1 dakika" denir).
const int kTestOnceSn = 60;

typedef PushTercih = ({bool enabled, int onceDk});
const PushTercih kVarsayilanTercih = (
  enabled: false,
  onceDk: kVarsayilanOnceDk,
);

/// Cihaz katmanı sözleşmesi — testte sahte bir uygulama takılabilir.
abstract class PushNative {
  bool get destek;
  String get durum;
  String get platform;
  String get teknik;
  String get uyari;
  String get kaynak;

  /// Mevcut izin durumu ('granted' | 'denied' | 'blocked').
  Future<String> izinOku();

  /// Sistem izin penceresini açar.
  Future<String> izinIste();

  /// Kurulu bildirim kayıtları.
  Future<List<({String id, int fireAt, String kind})>> kurulular();

  Future<void> zamanla(PlanItem p);
  Future<void> iptal(String id);
  Future<void> kanalHazirla();
}

/// Tercih deposu sözleşmesi.
abstract class PushStore {
  Future<PushTercih> oku();
  Future<void> yaz(PushTercih t);
}

// ---------------------------------------------------------------------------
// Saf yardımcılar
// ---------------------------------------------------------------------------

/// Test bildiriminin içeriği.
/// Metin tek bir şeyi söyler: bildirim kurulumu çalıştı. Maç, tahmin, skor,
/// puan, e-posta ya da kullanıcı adı GEÇMEZ.
PlanItem testIcerigi({int now = 0}) => (
  id: kTestId,
  fireAt: now + kTestOnceSn * 1000,
  title: 'Bildirim testi',
  body: 'Test bildirimi başarıyla çalıştı.',
  // Dokunulunca Bildirimler ekranı açılır. Hedefi `kind` belirler;
  // `tab`/`screen` yalnız insan okusun diye durur, gezinmeyi serbest
  // metin SÜRÜKLEYEMEZ.
  data: {'tab': 'HomeTab', 'screen': 'Notifications', 'kind': kTestKind},
);

/// Yalnız BİZİM kurduğumuz maç hatırlatmaları.
bool bizimMac(({String id, int fireAt, String kind}) r) =>
    r.id.startsWith('mac:') && r.kind == kMacKind;

/// Yalnız test bildirimi kaydı.
bool bizimTest(({String id, int fireAt, String kind}) r) =>
    r.id == kTestId && r.kind == kTestKind;

/// Geliştirme kipindeki "maç hatırlatmasını test et" kaydı.
/// Türü üretimle AYNIDIR (`match-starting`) ama kimliği `mac:` ile başlamaz;
/// bu yüzden `bizimMac` onu yakalamaz ve eşitleme ona DOKUNMAZ.
bool bizimTestMac(({String id, int fireAt, String kind}) r) =>
    r.id == kTestMacId && r.kind == kMacKind;

/// Cihazdan okunan kayıtlardan maç hatırlatmalarını çıkarır.
List<({String id, int fireAt})> ayikla(
  List<({String id, int fireAt, String kind})>? list,
) => [
  for (final r in list ?? const [])
    if (bizimMac(r)) (id: r.id, fireAt: r.fireAt),
];

/// Cihazdaki test kaydı (yoksa null).
({String id, int fireAt})? testKaydi(
  List<({String id, int fireAt, String kind})>? list,
) {
  for (final r in list ?? const []) {
    if (bizimTest(r)) return (id: r.id, fireAt: r.fireAt);
  }
  return null;
}

/// Cihazdaki geliştirme testi kaydı (yoksa null).
({String id, int fireAt})? testMacKaydi(
  List<({String id, int fireAt, String kind})>? list,
) {
  for (final r in list ?? const []) {
    if (bizimTestMac(r)) return (id: r.id, fireAt: r.fireAt);
  }
  return null;
}

/// Tercihle gerçek izni uzlaştırır.
/// İzin yoksa "açık" olamaz — kullanıcıya yalan söylenmez.
({bool enabled, bool degisti}) uzlastir({
  bool enabled = false,
  String izin = 'denied',
}) {
  final gercek = enabled && izin == 'granted';
  return (enabled: gercek, degisti: enabled != gercek);
}

// ---------------------------------------------------------------------------
// Cihazla konuşan sarmalayıcılar (hepsi hata yutar, çünkü tek bir başarısız
// çağrı tüm eşitlemeyi düşürmemeli — sonuç zaten geri okunarak doğrulanır)
// ---------------------------------------------------------------------------
Future<List<({String id, int fireAt, String kind})>> _guvenliKurulular(
  PushNative nat,
) async {
  try {
    return await nat.kurulular();
  } catch (_) {
    return const [];
  }
}

Future<bool> _guvenliIptal(PushNative nat, String id) async {
  try {
    await nat.iptal(id);
    return true;
  } catch (_) {
    return false;
  }
}

Future<bool> _guvenliZamanla(PushNative nat, PlanItem p) async {
  try {
    await nat.zamanla(p);
    return true;
  } catch (_) {
    return false;
  }
}

Future<void> _guvenliKanal(PushNative nat) async {
  try {
    await nat.kanalHazirla();
  } catch (_) {
    // sistem varsayılan kanalı
  }
}

Future<PushTercih> _tercihOku(PushStore store) async {
  try {
    return await store.oku();
  } catch (_) {
    return kVarsayilanTercih;
  }
}

Future<PushTercih> _tercihYaz(PushStore store, PushTercih next) async {
  try {
    await store.yaz(next);
  } catch (_) {
    // depo yazamazsa oturum içinde kalır
  }
  return next;
}

// ---------------------------------------------------------------------------
// İzin
// ---------------------------------------------------------------------------

/// 'granted' | 'denied' | 'blocked' | 'unsupported' | 'hata'
///   blocked = kullanıcı reddetti ve uygulama bir daha soramaz → ayarlara gidilir
///   hata    = çağrı patladı; "desteklenmiyor" demek yanlış olurdu, ayrı tutulur
Future<String> izinAl(PushNative? nat, {bool sor = false}) async {
  if (nat == null || !nat.destek) return 'unsupported';
  try {
    final d = await nat.izinOku();
    if (d == 'granted') return 'granted';
    if (!sor) return d;
    return await nat.izinIste();
  } catch (_) {
    return 'hata';
  }
}

// ---------------------------------------------------------------------------
// İptal
// ---------------------------------------------------------------------------

/// Yalnız maç hatırlatmalarını siler (kullanıcının diğer bildirimlerine
/// dokunulmaz).
Future<({int iptal})> macIptal(PushNative? nat) async {
  if (nat == null || !nat.destek) return (iptal: 0);
  final kayitlar = ayikla(await _guvenliKurulular(nat));
  var n = 0;
  for (final k in kayitlar) {
    if (await _guvenliIptal(nat, k.id)) n += 1;
  }
  return (iptal: n);
}

/// Bizim kurduğumuz HER ŞEY (maç hatırlatmaları + test kayıtları).
Future<({int iptal})> hepsiniIptal(PushNative? nat) async {
  if (nat == null || !nat.destek) return (iptal: 0);
  final hepsi = await _guvenliKurulular(nat);
  final idler = <String>[for (final k in ayikla(hepsi)) k.id];
  final t = testKaydi(hepsi);
  if (t != null) idler.add(t.id);
  // Geliştirme testi kaydı da bizimdir: bildirim kapatılırken geride kalmamalı.
  final tm = testMacKaydi(hepsi);
  if (tm != null) idler.add(tm.id);
  var n = 0;
  for (final id in idler) {
    if (await _guvenliIptal(nat, id)) n += 1;
  }
  return (iptal: n);
}

// ---------------------------------------------------------------------------
// Durum okuma (ekran bunu gösterir)
// ---------------------------------------------------------------------------

typedef PushDurumOzet = ({
  bool destek,
  String durum,
  String platform,
  String teknik,
  String uyari,
  String kaynak,
  String izin,
  bool acik,
  int kurulu,
  bool test,
  bool tercihDuzeltildi,
  int onceDk,
});

/// Ekranın ihtiyaç duyduğu HER ŞEY tek yerden, hiçbiri varsayılmadan.
/// İzin geri alınmışsa tercih burada dürüstçe kapatılır.
Future<PushDurumOzet> durumOku({
  required PushNative? nat,
  required PushStore store,
}) async {
  final destek = nat?.destek == true;
  final tercih = await _tercihOku(store);

  if (!destek) {
    return (
      destek: false,
      durum: nat?.durum ?? '',
      platform: nat?.platform ?? '',
      teknik: nat?.teknik ?? '',
      uyari: nat?.uyari ?? '',
      kaynak: nat?.kaynak ?? '',
      izin: 'unsupported',
      acik: false,
      kurulu: 0,
      test: false,
      tercihDuzeltildi: false,
      onceDk: tercih.onceDk,
    );
  }

  final izin = await izinAl(nat, sor: false);
  final u = uzlastir(enabled: tercih.enabled, izin: izin);
  if (u.degisti) {
    // İzin telefon ayarlarından geri alınmış → hem tercih hem kurulu kayıtlar
    // temizlenir.
    await _tercihYaz(store, (enabled: false, onceDk: tercih.onceDk));
    await hepsiniIptal(nat);
  }

  final hepsi = u.degisti
      ? const <({String id, int fireAt, String kind})>[]
      : await _guvenliKurulular(nat!);
  return (
    destek: true,
    durum: nat!.durum,
    platform: nat.platform,
    teknik: nat.teknik,
    uyari: nat.uyari,
    kaynak: nat.kaynak,
    izin: izin,
    acik: u.enabled,
    kurulu: ayikla(hepsi).length,
    test: testKaydi(hepsi) != null,
    tercihDuzeltildi: u.degisti,
    onceDk: tercih.onceDk,
  );
}

// ---------------------------------------------------------------------------
// Zamanlama eşitlemesi
// ---------------------------------------------------------------------------

typedef SenkronSonuc = ({
  String durum,
  int kuruldu,
  int iptal,
  int denenen,
  int dogrulanan,
  int plan,
  Atlanan? atlanan,
});

/// Planı cihazdaki kayıtlarla eşitler ve SONUCU CİHAZDAN GERİ OKUYARAK
/// doğrular.
///
/// durum: 'ok' | 'eksik' | 'kapali' | 'denied' | 'blocked' | 'unsupported' | 'hata'
///   'eksik' = plan kuruldu sayılamadı; işletim sistemi hepsini kabul etmedi.
Future<SenkronSonuc> macSenkron({
  required PushNative? nat,
  required PushStore store,
  int now = 0,
  Map? bulletin,
  List? coupons,
}) async {
  SenkronSonuc bos(String durum, {int iptal = 0}) => (
    durum: durum,
    kuruldu: 0,
    iptal: iptal,
    denenen: 0,
    dogrulanan: 0,
    plan: 0,
    atlanan: null,
  );

  if (nat == null || !nat.destek) return bos('unsupported');

  final tercih = await _tercihOku(store);
  if (!tercih.enabled) {
    final t = await macIptal(nat);
    return bos('kapali', iptal: t.iptal);
  }

  final izin = await izinAl(nat, sor: false);
  if (izin != 'granted') {
    // İzin yokken "açık" tercih tutmak yanıltıcı olur.
    await _tercihYaz(store, (enabled: false, onceDk: tercih.onceDk));
    final t = await hepsiniIptal(nat);
    return bos(izin, iptal: t.iptal);
  }

  final plan = planMatchReminders(
    now: now,
    bulletin: bulletin,
    coupons: coupons,
    onceDk: tercih.onceDk,
  );
  final oncekiler = ayikla(await _guvenliKurulular(nat));
  final fark = diffSchedule(plan.items, oncekiler);

  var iptalSayisi = 0;
  for (final id in fark.iptal) {
    if (await _guvenliIptal(nat, id)) iptalSayisi += 1;
  }

  var denenen = 0;
  for (final p in fark.kurulacak) {
    denenen += 1;
    await _guvenliZamanla(nat, p);
  }

  // DÜRÜSTLÜK: kurduk demeden önce cihazdan geri oku.
  final sonrakiler = ayikla(await _guvenliKurulular(nat));
  final varOlan = {for (final k in sonrakiler) k.id};
  final dogrulanan = plan.items.where((p) => varOlan.contains(p.id)).length;
  final kuruldu = fark.kurulacak.where((p) => varOlan.contains(p.id)).length;

  return (
    durum: dogrulanan == plan.items.length ? 'ok' : 'eksik',
    kuruldu: kuruldu,
    iptal: iptalSayisi,
    denenen: denenen,
    dogrulanan: dogrulanan,
    plan: plan.items.length,
    atlanan: plan.atlanan,
  );
}

/// Ayardan aç/kapat. Açarken sistem izni SORULUR; izin verilmezse tercih
/// AÇILMAZ.
Future<({bool enabled, String izin, SenkronSonuc? senkron, int iptal})>
ayariDegistir({
  required PushNative? nat,
  required PushStore store,
  bool ac = false,
  int now = 0,
  Map? bulletin,
  List? coupons,
}) async {
  if (nat == null || !nat.destek) {
    return (enabled: false, izin: 'unsupported', senkron: null, iptal: 0);
  }

  final tercih = await _tercihOku(store);

  if (!ac) {
    await _tercihYaz(store, (enabled: false, onceDk: tercih.onceDk));
    final t = await hepsiniIptal(nat);
    return (enabled: false, izin: 'kapali', senkron: null, iptal: t.iptal);
  }

  final izin = await izinAl(nat, sor: true);
  if (izin != 'granted') {
    await _tercihYaz(store, (enabled: false, onceDk: tercih.onceDk));
    return (enabled: false, izin: izin, senkron: null, iptal: 0);
  }

  await _guvenliKanal(nat);
  await _tercihYaz(store, (enabled: true, onceDk: tercih.onceDk));
  final senkron = await macSenkron(
    nat: nat,
    store: store,
    now: now,
    bulletin: bulletin,
    coupons: coupons,
  );
  return (enabled: true, izin: 'granted', senkron: senkron, iptal: 0);
}

typedef TestSonuc = ({
  bool ok,
  String izin,
  int saniye,
  int fireAt,
  String neden,
});

/// "Test Bildirimi Gönder" — GERÇEK bildirim kanalı ve GERÇEK zamanlama yolu.
/// Ayrı/sahte bir yol kullanılmaz; amaç kullanıcının telefon ayarlarının
/// hatırlatmalara izin verdiğini kendi gözüyle doğrulaması.
Future<TestSonuc> testKur({
  required PushNative? nat,
  required PushStore store,
  int now = 0,
}) async {
  if (nat == null || !nat.destek) {
    return (
      ok: false,
      izin: 'unsupported',
      saniye: kTestOnceSn,
      fireAt: 0,
      neden: 'destek-yok',
    );
  }

  final izin = await izinAl(nat, sor: false);
  if (izin != 'granted') {
    return (
      ok: false,
      izin: izin,
      saniye: kTestOnceSn,
      fireAt: 0,
      neden: 'izin',
    );
  }

  await _guvenliKanal(nat);
  final icerik = testIcerigi(now: now);

  // Tekrar basılınca çoğalmasın: önce eski test kaydı silinir.
  await _guvenliIptal(nat, kTestId);
  await _guvenliZamanla(nat, icerik);

  // İşletim sistemi kabul etmediyse "kuruldu" demiyoruz.
  final kayit = testKaydi(await _guvenliKurulular(nat));
  if (kayit == null) {
    return (
      ok: false,
      izin: 'granted',
      saniye: kTestOnceSn,
      fireAt: 0,
      neden: 'zamanlanamadi',
    );
  }
  return (
    ok: true,
    izin: 'granted',
    saniye: kTestOnceSn,
    fireAt: icerik.fireAt,
    neden: '',
  );
}

typedef TestMacSonuc = ({
  bool ok,
  String izin,
  int saniye,
  int fireAt,
  MacBilgisi? mac,
  String neden,
});

/// GELİŞTİRME TESTİ — "Maç hatırlatmasını test et".
///
/// Güncel bültendeki gerçek ve başlamamış bir maç için, ÜRETİMDE KULLANILAN
/// `match-starting` bildiriminin aynısını 1 dakika sonrasına kurar.
///
/// Üretim düzenine dokunmaz: ayrı kimlik (`test:mac`) kullanır, eşitleme
/// (`macSenkron`) bu kaydı ne kurar ne siler. Uygun maç yoksa MAÇ UYDURULMAZ.
///
/// neden: '' | 'destek-yok' | 'izin' | 'bulten-yok' | 'mac-yok' | 'zamanlanamadi'
Future<TestMacSonuc> testMacKur({
  required PushNative? nat,
  required PushStore store,
  int now = 0,
  Map? bulletin,
}) async {
  TestMacSonuc bos(String izin, String neden) => (
    ok: false,
    izin: izin,
    saniye: kTestMacOnceSn,
    fireAt: 0,
    mac: null,
    neden: neden,
  );

  if (nat == null || !nat.destek) return bos('unsupported', 'destek-yok');

  final izin = await izinAl(nat, sor: false);
  if (izin != 'granted') return bos(izin, 'izin');

  // Önce maç seçilir: uygun maç yoksa cihaza hiç dokunulmaz.
  final secim = testMacIcerigi(now: now, bulletin: bulletin);
  if (!secim.ok) return bos('granted', secim.neden);

  await _guvenliKanal(nat);

  // Tekrar basılınca çoğalmasın: önce eski geliştirme testi kaydı silinir.
  await _guvenliIptal(nat, kTestMacId);
  await _guvenliZamanla(nat, secim.kayit!);

  // İşletim sistemi kabul etmediyse "kuruldu" demiyoruz.
  final kayit = testMacKaydi(await _guvenliKurulular(nat));
  if (kayit == null) return bos('granted', 'zamanlanamadi');
  return (
    ok: true,
    izin: 'granted',
    saniye: kTestMacOnceSn,
    fireAt: secim.kayit!.fireAt,
    mac: secim.mac,
    neden: '',
  );
}
