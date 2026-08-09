// KAYNAK: app/src/pushDevTest.js — BİREBİR çeviri.
//
// GELİŞTİRME TESTİ — GERÇEK MAÇ HATIRLATMASINI 1 DAKİKAYA KURMA (SAF MODÜL)
//
// Cihaz katmanı burada İMPORT EDİLMEZ; bu dosya yalnız "hangi gerçek maç
// seçilir ve bildirimi ne olur" sorusunu yanıtlar.
//
// NEDEN VAR: üretimdeki maç hatırlatması maçtan 60 dakika önce düşer. Bildirime
// dokununca doğru maç detayının açıldığını gerçek telefonda görmek için
// saatlerce beklemek gerekirdi.
//
// KESİN KURALLAR
//  1) MAÇ UYDURULMAZ. Yalnız güncel bültendeki gerçek ve başlamamış bir maç
//     kullanılır. Bülten yoksa ya da uygun maç kalmadıysa dürüstçe "bulunamadı"
//     denir; sahte maç, sahte saat, sahte takım üretilmez.
//  2) Bildirimin içeriği `macBildirimIcerigi` ile üretilir — yani üretimdeki
//     hatırlatmanın TIPKISI. Ayrı/sahte bir içerik yolu yoktur.
//  3) Üretimdeki 60 dakika düzeni DEĞİŞMEZ. Bu kayıt ayrı bir kimlik taşır
//     (`test:mac`), `mac:<hafta>:<no>` ailesine girmez.
//  4) Bildirimde yalnız maç numarası, takım adları ve saat bulunur. Kupon
//     verisi bu dosyada HİÇ okunmaz.
//  5) Yalnız geliştirme kipinde açılır. Yayın derlemesinde bu seçenek müşteriye
//     HİÇ görünmez.

import 'package:flutter/foundation.dart';

import 'notifications.dart';
import 'push_planner.dart';

/// Geliştirme testi kaydının sabit kimliği — üretim ailesine (`mac:`) girmez.
const String kTestMacId = 'test:mac';

/// Kaç saniye sonra düşsün (kullanıcıya "1 dakika" denir).
const int kTestMacOnceSn = 60;

// Telefonda gerçek hatırlatmayla karışmasın diye başlık açıkça işaretlidir.
// Gövde ve yönlendirme verisi üretimdekinin AYNISIDIR.
const String kTestMacBaslik = 'Geliştirme testi: maç birazdan başlıyor';

/// Geliştirme kipi mi?
///
/// Kaynakta `__DEV__` ÇAĞRI ANINDA okunuyordu. Dart'ta karşılığı `kDebugMode`
/// sabitidir; yayın derlemesinde `false`tur ve ağaç sarsma bu dalı paketten
/// TAMAMEN atar — seçeneğin metni bile müşterinin paketinde bulunmaz.
bool gelistirmeKipi() => kDebugMode;

/// Testte kullanılacak GERÇEK maçı seçer: güncel bültendeki, başlamamış,
/// başlama saati ve takım adları bilinen maçlar arasından EN YAKIN olanı.
///
/// En yakın maç seçilir çünkü bülten ilerledikçe bu maç da ilerler; böylece
/// test her zaman "gerçekten sırada olan" bir maçla yapılır.
///
/// neden: '' | 'bulten-yok' | 'mac-yok'
({bool ok, String neden, MacBilgisi? mac}) testMacSec({
  int now = 0,
  Map? bulletin,
}) {
  final maclar = bulletin?['matches'];
  // Bülten okunamadıysa maç UYDURULMAZ; bu dürüstçe ayrı bir nedendir.
  if (maclar is! List || maclar.isEmpty) {
    return (ok: false, neden: 'bulten-yok', mac: null);
  }

  MacBilgisi? secilen;
  for (final raw in maclar) {
    final m = raw as Map?;
    // Başlamış / canlı / resmî sonucu gelmiş maç testte de kullanılmaz.
    if (m?['status'] == 'finished' ||
        m?['status'] == 'live' ||
        isOfficial(m)) {
      continue;
    }

    final bilgi = macBilgisi(m);
    if (bilgi == null) continue; // numara/saat/takım eksik → atla
    if (bilgi.baslama <= now) continue; // başlama saati geçmiş → atla

    if (secilen == null || bilgi.baslama < secilen.baslama) secilen = bilgi;
  }

  if (secilen == null) return (ok: false, neden: 'mac-yok', mac: null);
  return (ok: true, neden: '', mac: secilen);
}

/// Seçilen gerçek maç için kurulacak bildirim kaydı.
///
/// Kayıt, üretimdeki hatırlatmayla aynı biçimdedir; yalnız kimliği ve düşme anı
/// farklıdır.
({bool ok, String neden, MacBilgisi? mac, PlanItem? kayit}) testMacIcerigi({
  int now = 0,
  Map? bulletin,
}) {
  final secim = testMacSec(now: now, bulletin: bulletin);
  if (!secim.ok) {
    return (ok: false, neden: secim.neden, mac: null, kayit: null);
  }

  final icerik = macBildirimIcerigi(secim.mac!, baslik: kTestMacBaslik);
  return (
    ok: true,
    neden: '',
    mac: secim.mac,
    kayit: (
      id: kTestMacId,
      fireAt: now + kTestMacOnceSn * 1000,
      title: icerik.title,
      body: icerik.body,
      data: icerik.data,
    ),
  );
}
