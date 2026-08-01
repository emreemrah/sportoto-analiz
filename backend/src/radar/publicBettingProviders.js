// HALK OYNANMA YÜZDESİ SAĞLAYICI ARAYÜZÜ (provider/adaptör kaydı)
// Radar 3'ün veri kaynağı katmanı. ŞU AN KAYITLI GERÇEK SAĞLAYICI YOK —
// Nesine/Bilyoner/Misli/Oley gibi kaynaklar için resmî/izinli bir erişim
// sağlandığında buraya bir adaptör eklenir; Radar 3 otomatik devreye girer.
//
// KURAL: Kullanım şartlarını ihlal eden, giriş aşan veya koruma atlatan
// scraping YAZILMAZ. Adaptör yalnız izinli/yasal bir API veya veri anlaşması
// üzerinden beslenebilir.
//
// Sağlayıcı arayüzü:
//   {
//     id: 'nesine',                 // benzersiz anahtar
//     name: 'Nesine',               // kullanıcıya görünen ad
//     enabled: true,
//     // matches: bülten maçları [{ no, sportotoMatchId, home, away, date }]
//     // dönen: [{ matchId, percentages: { '1': n, 'X': n, '2': n }, observedAt }]
//     async fetchPercentages(matches) { ... }
//   }

import { enabledProviders as enabledPlayedProviders } from '../providers/playedPercentages.js';

const providers = [];

export function listPublicProviders() {
  // TEK DOĞRULUK KAYNAĞI: gerçek gözlem akışı providers/playedPercentages
  // kaydından beslenir (Bilyoner vb.). Radar 3 "kaynak var mı?" durumu da
  // oradan okunur; bu yerel liste yalnız ek/eski adaptörler içindir.
  const played = enabledPlayedProviders().map((p) => ({ id: p.id, name: p.name, enabled: true }));
  const local = providers.filter((p) => p && p.enabled !== false);
  const byId = new Map();
  for (const p of [...played, ...local]) byId.set(p.id, p);
  return [...byId.values()];
}

export function registerPublicProvider(provider) {
  if (!provider?.id || typeof provider.fetchPercentages !== 'function') {
    throw new Error('Geçersiz sağlayıcı: id ve fetchPercentages zorunlu.');
  }
  const idx = providers.findIndex((p) => p.id === provider.id);
  if (idx === -1) providers.push(provider); else providers[idx] = provider;
  return provider;
}

// Testler için: kayıtlı sağlayıcıları temizle.
export function _clearPublicProvidersForTests() {
  providers.length = 0;
}

export function publicSourceStatus() {
  const list = listPublicProviders();
  return {
    hasSource: list.length > 0,
    providers: list.map((p) => ({ id: p.id, name: p.name })),
    note: list.length
      ? null
      : 'Veri kaynağı bekleniyor — oynanma yüzdesi sağlayıcısı henüz bağlı değil. İzinli bir kaynak eklendiğinde Radar 3 otomatik devreye girer.',
  };
}
