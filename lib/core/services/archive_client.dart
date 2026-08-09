// KAYNAK: app/src/services/archiveClient.js — BİREBİR çeviri.
//
// Arşiv API'sine erişimin TEK kapısı. Uygulamada varsayılan yol api_client'tır
// (yalnız kendi backend'imiz; dışarıya API anahtarı çıkmaz). Test/özel ortam
// için `setArchiveFetcher` ile sahte bir getirici takılabilir.

import '../network/api_client.dart';

typedef ArchiveFetcher = Future<dynamic> Function(
  String path, {
  String? method,
  Object? body,
});

ArchiveFetcher? _customFetcher;

/// Test/özel ortam: `(path) => Future<json>` imzalı getirici tak.
void setArchiveFetcher(ArchiveFetcher? fn) => _customFetcher = fn;

Future<dynamic> archiveGet(String path) {
  final f = _customFetcher;
  if (f != null) return f(path);
  return api.archiveGet(path);
}

/// POST — Master Analiz hesap uçları için.
Future<dynamic> archivePost(String path, Object? body) {
  final f = _customFetcher;
  if (f != null) return f(path, method: 'POST', body: body);
  return api.archivePost(path, body);
}

/// Backend'in eski olduğu (arşiv uçları bulunmadığı) durumu ayırt etmek için:
/// istek katmanı hata mesajına HTTP kodunu gömer ("Sunucu hatası (404)").
bool isMissingEndpoint(Object? err) =>
    RegExp(r'\(404\)').hasMatch('${err ?? ''}');

// Ağ hatasının KULLANICIYA görünen hâli.
//
// Neden gerekli: arşive ulaşılamadığında artık örnek veri UYDURULMUYOR, hata
// dürüstçe ekrana taşınıyor. Ama ham hata metni "ECONNREFUSED" /
// "Network request failed" gibi teknik bir dizgedir; canlı yayında ekranda
// böyle bir şey görünmesi kullanıcıya hiçbir şey anlatmaz. Burada YALNIZ
// ağ/sunucu erişim hataları insan diline çevrilir; sunucunun anlamlı mesajları
// ("Bu bülten arşivde bulunamadı.") olduğu gibi bırakılır — bilgi gizlenmez,
// sadece anlaşılır hâle getirilir.
final RegExp _agHatasi = RegExp(
  r'network request failed|failed to fetch|networkerror|load failed|'
  r'ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|timeout|abort',
  caseSensitive: false,
);
final RegExp _sunucuErisilemez = RegExp(r'\((?:429|500|502|503|504)\)');

String humanArchiveError(Object? err) {
  final ham = '${err ?? ''}'.trim();
  if (ham.isEmpty) {
    return 'Arşive şu anda ulaşılamıyor. Bağlantını kontrol edip tekrar dene.';
  }
  if (_agHatasi.hasMatch(ham)) {
    return 'Arşive şu anda ulaşılamıyor. İnternet bağlantını kontrol edip tekrar dene.';
  }
  if (_sunucuErisilemez.hasMatch(ham)) {
    return 'Arşiv sunucusu şu anda yanıt vermiyor. Birazdan tekrar dene.';
  }
  return ham;
}
