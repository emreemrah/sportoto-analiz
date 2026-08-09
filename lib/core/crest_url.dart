// KAYNAK: app/src/crestUrl.js — BİREBİR çeviri.
//
// KULÜP ARMASI ADRESİ — dış adresi kendi sunucumuzun üstünden geçirir.
// (Saf modül: Flutter yok → testten doğrudan import edilir.)
//
// NEDEN VAR: Arma adresleri dış bir kaynağa işaret ediyor. Ekranda sorunsuz
// çiziliyor; ama "📸 Ekran görselini paylaş" karesine KONAMIYOR. Sebebi: kareyi
// çıkaran katman tuvale ancak "bu görseli okuyabilirsin" izni (CORS) veren bir
// kaynağı çizebiliyor. Dış kaynak bu izni vermeyince görsel HATA VERMEDEN
// düşüyor. Paylaşılan bültende armaların boş çıkmasının sebebi buydu.
//
// ÇÖZÜM: adres kendi sunucumuza çevrilir (/api/crest?u=…). Sunucu ile uygulama
// arasında bu izin zaten var, arma kareye giriyor.
//
// BU DOSYADA SAĞLAYICI ADI GEÇMEZ. Hangi dış konağın geçerli olduğuna sunucu
// karar verir (backend/src/crestProxy.js, varsayılan-ret). Uygulama tarafı
// yalnız "kendi sunucum değilse vekilden geçir" der; böylece marka adı istemci
// koduna sızmaz ve izinli konak listesi tek yerde durur.
//
// BOZMAMA KURALI: taban adres bilinmiyorsa ya da adres zaten yerel/gömülü ise
// adrese DOKUNULMAZ — bugün çalışan bir görsel bu dosya yüzünden kaybolmaz.
//
// NOT: Flutter'da tuval/CORS kısıtı yalnız WEB derlemesinde geçerlidir; Android
// ve iOS'ta arma doğrudan da çizilirdi. Vekil yine de KORUNDU, çünkü ikinci ve
// daha önemli gerekçesi GİZLİLİKTİR: doğrudan dış adrese giden her görsel
// isteği kullanıcının IP'sini ve hangi ekranı açtığını üçüncü tarafa bildirir.

final RegExp _gomulu = RegExp(r'^(data:|blob:)', caseSensitive: false);
final RegExp _mutlak = RegExp(r'^https?:\/\/', caseSensitive: false);
final RegExp _sondakiEgikler = RegExp(r'\/+$');

/// Sondaki eğik çizgileri atar: 'http://a:4000/' → 'http://a:4000'
String _tabanla(String? v) => (v ?? '').trim().replaceAll(_sondakiEgikler, '');

/// Arma adresini paylaşılabilir (vekilden geçen) hâline çevirir.
///
/// [uri]     Backend'den gelen arma adresi (boş olabilir).
/// [apiBase] Kendi sunucumuzun kök adresi.
/// Girdi boşsa '' döner.
String crestUrlOf(String? uri, String? apiBase) {
  final adres = (uri ?? '').trim();
  if (adres.isEmpty) return '';
  // Zaten gömülü görsel (data:/blob:) — vekile gerek yok, tuvale de girer.
  if (_gomulu.hasMatch(adres)) return adres;
  // Göreli adres zaten kendi kaynağımızdadır.
  if (!_mutlak.hasMatch(adres)) return adres;

  final taban = _tabanla(apiBase);
  if (taban.isEmpty) return adres; // taban bilinmiyor — çalışan adresi bozma

  // Kendi sunucumuzsa olduğu gibi kalır (vekilin vekili olmaz).
  final kucuk = adres.toLowerCase();
  final tabanKucuk = taban.toLowerCase();
  if (kucuk == tabanKucuk || kucuk.startsWith('$tabanKucuk/')) return adres;

  return '$taban/api/crest?u=${Uri.encodeComponent(adres)}';
}
