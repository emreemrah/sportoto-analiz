// ORAN KAYNAK KİMLİKLERİ + NÖTR ETİKETLER — saf yaprak modül (import yok).
// ---------------------------------------------------------------------------
// Neden ayrı dosya: hem gözlem yazan taraf (providers/marketOdds.js) hem de
// okuyan/gösteren taraf (radar/dailyOdds.js) aynı kimlik ve etiketi kullanmalı.
// Bu dosyanın ağ/config bağımlılığı YOKTUR; Radar 4'ün saf kalmasını sağlar.
//
// ARAYÜZ KURALI: kullanıcıya MARKA ADI gösterilmez. Kimlikler (veri anahtarları)
// teknik ve DEĞİŞMEZDİR — arşivdeki geçmiş gözlemler bu kimliklerle duruyor;
// yeniden adlandırmak geçmiş kayıtları kopuk bırakır.

// Eski/birincil kaynak — archive/snapshotService.js'in yazdığı değer.
// 27 Temmuz 2026: denenen ikinci kaynak kullanıcı kararıyla kaldırıldı, bu
// yüzden şu an TEK kimlik var. Arşivde başka kimlikli eski satır bulunursa
// oddsSourceLabel onu "Diğer oran kaynağı" olarak gösterir; kayıt SİLİNMEZ.
export const LEGACY_ODDS_SOURCE = 'refresh';

const KAYNAK_ADLARI = {
  [LEGACY_ODDS_SOURCE]: 'Birincil oran kaynağı',
};

export function oddsSourceLabel(sourceId) {
  if (!sourceId) return 'Kaynak belirtilmemiş';
  return KAYNAK_ADLARI[sourceId] || 'Diğer oran kaynağı';
}

// Gösterim sırası: birincil kaynak HER ZAMAN önce (geçmişle süreklilik),
// sonra bilinmeyenler alfabetik. Deterministik olmalı ki aynı veri her
// açılışta aynı sırada görünsün.
const RANK = { [LEGACY_ODDS_SOURCE]: 0 };
export function sortOddsSources(ids) {
  return [...(ids || [])].sort((a, b) => {
    const ra = RANK[a] ?? 9, rb = RANK[b] ?? 9;
    return ra !== rb ? ra - rb : String(a).localeCompare(String(b));
  });
}
