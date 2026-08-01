// app/src/services/archiveClient.js
// Arşiv API'sine erişimin TEK kapısı. React Native'e üst-seviye bağımlılığı
// YOKTUR (api.js lazy import edilir) — böylece servisler node testlerinde
// sahte fetcher ile çalıştırılabilir. Uygulamada varsayılan yol api.js'tir
// (yalnız kendi backend'imiz; dışarıya API anahtarı çıkmaz).

let customFetcher = null;

// Test/özel ortam: (path) => Promise<json> imzalı fetcher tak.
export function setArchiveFetcher(fn) {
  customFetcher = fn;
}

export async function archiveGet(path) {
  if (customFetcher) return customFetcher(path);
  const { api } = await import('../api');
  return api.archiveGet(path);
}

// POST — Master Analiz hesap uçları için (test fetcher'ı (path, opts) alır).
export async function archivePost(path, body) {
  if (customFetcher) return customFetcher(path, { method: 'POST', body });
  const { api } = await import('../api');
  return api.archivePost(path, body);
}

// Backend'in eski olduğu (arşiv uçları bulunmadığı) durumu ayırt etmek için:
// req() hata mesajına HTTP kodunu gömer ("Sunucu hatası (404)").
export function isMissingEndpoint(err) {
  return /\(404\)/.test(String(err?.message || ''));
}

// Ağ hatasının KULLANICIYA görünen hâli.
//
// Neden gerekli: arşive ulaşılamadığında artık örnek veri UYDURULMUYOR, hata
// dürüstçe ekrana taşınıyor (bkz. bulletinHistoryService başlığı). Ama ham
// hata metni "ECONNREFUSED" / "Network request failed" gibi teknik bir dizgedir;
// canlı yayında ekranda böyle bir şey görünmesi kullanıcıya hiçbir şey anlatmaz.
// Burada YALNIZ ağ/sunucu erişim hataları insan diline çevrilir; sunucunun
// anlamlı mesajları ("Bu bülten arşivde bulunamadı.") olduğu gibi bırakılır —
// bilgi gizlenmez, sadece anlaşılır hâle getirilir.
const AG_HATASI = /network request failed|failed to fetch|networkerror|load failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|timeout|abort/i;
const SUNUCU_ERISILEMEZ = /\((?:429|500|502|503|504)\)/;

export function humanArchiveError(err) {
  const ham = String(err?.message || err || '').trim();
  if (!ham) return 'Arşive şu anda ulaşılamıyor. Bağlantını kontrol edip tekrar dene.';
  if (AG_HATASI.test(ham)) {
    return 'Arşive şu anda ulaşılamıyor. İnternet bağlantını kontrol edip tekrar dene.';
  }
  if (SUNUCU_ERISILEMEZ.test(ham)) {
    return 'Arşiv sunucusu şu anda yanıt vermiyor. Birazdan tekrar dene.';
  }
  return ham;
}
