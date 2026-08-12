// KAYNAK: app/src/pushEnv.js — çeviri.
//
// TELEFON BİLDİRİMİ — ORTAM VE YETENEK SINIFLANDIRMASI (SAF MODÜL)
//
// KULLANICIYA GÖRÜNEN METİNLER VE DURUM ADLARI BİREBİR KORUNDU.
//
// ────────────────────────────────────────────────────────────────────────────
// ÇEVİRİDE DARALAN TEK PARÇA — VE NEDENİ
//
// Kaynaktaki `ortamiSinifla`, `expo-notifications` paketinin giriş dosyası
// UZAK-PUSH alt modüllerini de yüklediği ve Expo Go'da bunlar kayıtlı olmadığı
// için import'un PATLAMASINDAN doğmuştu. Sonuç: gerçek Android telefon "web"
// gibi görünüyor ve ekranda "Tarayıcıda telefon bildirimi kurulamaz." yazıyordu
// — YANLIŞ TEŞHİS. Kaynak bu yüzden modülü iki aşamalı yükleyip hangi tek tek
// işlevin elde olduğunu ölçüyordu (GEREKLI_API / SECMELI_API listeleri).
//
// Flutter'da bu sorunun karşılığı YOKTUR: `flutter_local_notifications` tek
// parça bir eklentidir, uzak-push alt modülü içermez ve derleme zamanında
// bağlanır — kısmen yüklenmesi mümkün değildir. "Hangi işlev elde?" sorusunu
// çalışma zamanında sormak bu yüzden anlamsız olurdu.
//
// KORUNAN: DURUM sözlüğü, `ortamAciklamasi` metinleri ve `ortamOzeti` biçimi
// aynen duruyor — ekran hiçbir farkla karşılaşmaz. Sınıflandırma artık iki
// GERÇEK girdiye bakar: platform ve eklentinin ilklendirilip ilklendirilemediği.

/// Ortamın ayrıştırılmış hâlleri.
abstract final class PushDurum {
  static const String web = 'web'; // gerçekten tarayıcı → yerel bildirim yok
  static const String hazir = 'hazir'; // yerel bildirim API'si elde
  static const String modulYok = 'modul-yok'; // paket bulunamadı
  static const String modulHata = 'modul-hata'; // paket var ama hata verdi
  static const String apiEksik = 'api-eksik'; // yüklendi ama işlevler yok
}

typedef PushOrtam = ({
  String durum,
  bool destek,
  String platform,
  String teknik,
  String uyari,
  String kaynak,
});

String _hataMetni(Object? e) {
  if (e == null) return '';
  return '$e'.trim();
}

/// Ortamı sınıflandırır.
///
/// [ilklendi] eklenti başarıyla kurulduysa true.
/// [yuklemeHatasi] kurulamadıysa GERÇEK hata (sessizce yutulmaz).
PushOrtam ortamiSinifla({
  String platformOS = '',
  bool ilklendi = false,
  Object? yuklemeHatasi,
}) {
  final platform = platformOS.toLowerCase();
  final teknikHata = _hataMetni(yuklemeHatasi);

  // 1) Tarayıcı GERÇEKTEN tarayıcıdır — burada yerel bildirim yoktur.
  //    Bu dalın tek koşulu platformun web olması; eklenti durumu ölçülmez.
  if (platform == 'web') {
    return (
      durum: PushDurum.web,
      destek: false,
      platform: platform,
      teknik: '',
      uyari: '',
      kaynak: '',
    );
  }

  // 2) Eklenti çalışıyorsa hazırız. Önceki bir uyarı ölümcül değildir; tanı
  //    için taşınır ama kullanıcıyı ENGELLEMEZ.
  if (ilklendi) {
    return (
      durum: PushDurum.hazir,
      destek: true,
      platform: platform,
      teknik: '',
      uyari: teknikHata,
      kaynak: 'paket',
    );
  }

  // 3) Eklenti yok ama GERÇEK bir hata var → sessizce "tarayıcı" deme.
  if (teknikHata.isNotEmpty) {
    return (
      durum: PushDurum.modulHata,
      destek: false,
      platform: platform,
      teknik: teknikHata,
      uyari: '',
      kaynak: '',
    );
  }

  // 4) Ne eklenti ne hata → henüz ilklendirilmemiş.
  return (
    durum: PushDurum.modulYok,
    destek: false,
    platform: platform,
    teknik: '',
    uyari: '',
    kaynak: '',
  );
}

/// Ekranda gösterilecek DÜRÜST açıklama — durum ne ise o yazılır.
String ortamAciklamasi({
  String durum = '',
  String platform = '',
  String teknik = '',
}) => switch (durum) {
  PushDurum.web =>
    'Tarayıcıda telefon bildirimi kurulamaz. Bu özellik yalnız Android/iOS '
        'uygulamasında çalışır; buradaki bildirim listesi çalışmaya devam eder.',
  PushDurum.hazir => '',
  PushDurum.modulYok =>
    'Bildirim modülü bu derlemede bulunamadı, bu yüzden telefon hatırlatması '
        'kurulamıyor. Uygulamanın güncel sürümünü açtığında bu bölüm kendiliğinden '
        'çalışır hâle gelir.',
  PushDurum.modulHata =>
    'Bildirim modülü bu cihazda yüklenemedi, bu yüzden telefon hatırlatması '
        'kurulamıyor (platform: ${platform.isEmpty ? 'bilinmiyor' : platform}). '
        'Bu bir tarayıcı sınırı değil; cihazdaki teknik durum: '
        '${teknik.isEmpty ? 'ayrıntı alınamadı' : teknik}',
  PushDurum.apiEksik =>
    'Bildirim modülü yüklendi ancak yerel bildirim işlevleri eksik olduğu için '
        'hatırlatma kurulamıyor. Teknik durum: '
        '${teknik.isEmpty ? 'ayrıntı alınamadı' : teknik}',
  _ =>
    'Bildirim ortamı okunamadı; hatırlatma kurulup kurulamayacağı doğrulanamıyor.',
};

/// Kısa tanı satırı (tanı amaçlı; kişisel veri içermez).
String ortamOzeti(PushOrtam? o) {
  if (o == null) return 'durum: bilinmiyor · platform: bilinmiyor';
  final p = o.platform.isEmpty ? 'bilinmiyor' : o.platform;
  final k = o.kaynak.isNotEmpty ? ' · kaynak: ${o.kaynak}' : '';
  final t = o.teknik.isNotEmpty ? ' · ${o.teknik}' : '';
  final u = o.teknik.isEmpty && o.uyari.isNotEmpty
      ? ' · uyarı: ${o.uyari}'
      : '';
  final d = o.durum.isEmpty ? 'bilinmiyor' : o.durum;
  return 'durum: $d · platform: $p$k$t$u';
}
