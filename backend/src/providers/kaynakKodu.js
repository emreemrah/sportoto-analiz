// KAYNAK KODLARI — bahis sitesi kimliği API SINIRINDA nötrlenir.
// ---------------------------------------------------------------------------
// NEDEN: Uygulama bahis sitesi tanıtımı yapamaz (yasal + mağaza politikası).
// Kullanıcıya görünen metinlerde marka adı zaten yok (renk adı kullanılır),
// ama HTTP yanıtlarında hâlâ 'nesine'/'misli' gibi ANAHTARLAR geçiyordu
// (sources dizisi, bySource anahtarları, providerId, played-dna sorgu paramı).
// Ağ trafiğine bakan biri markayı görebiliyordu.
//
// ÇÖZÜM: iç kimlik ile dış kod AYRILIR.
//   • İÇERİDE (veritabanı, arşiv, DNA eşleştirme) kimlik AYNEN kalır —
//     observations.source sütunu ve tüm geçmiş kayıtlar dokunulmadan durur.
//     Veri göçü YOK; yanlış göç bütün geçmişi bozardı.
//   • DIŞARIDA yalnız kod görünür: k1, k2, k3…
//
// EŞLEME SABİTTİR ve renklerle hizalıdır (k1 sarı, k2 turuncu, k3 yeşil):
// aynı kaynak her hafta aynı kod + aynı renk olmalı, yoksa kullanıcı haftalar
// arasında kıyas yapamaz ve DNA geçmişi kayar.
//
// Bilinmeyen kimlik: kod ÜRETİLMEZ, 'k0' döner (tek kova). Uydurma kod
// üretmek, yeni bir sağlayıcı eklendiğinde onu sessizce mevcut bir kaynakla
// karıştırma riski taşırdı.

export const KAYNAK_KODLARI = {
  nesine: 'k1',
  misli: 'k2',
  oley: 'k4',
  iddaa: 'k5',
};

const TERS = Object.fromEntries(Object.entries(KAYNAK_KODLARI).map(([id, k]) => [k, id]));

/** İç kimlik → dış kod. Bilinmeyen: 'k0'. */
export const kaynakKodu = (id) => KAYNAK_KODLARI[id] || 'k0';

/**
 * Dış kod → iç kimlik. Bilinmeyen kod null döner (çağıran "kaynak yok" der).
 * GERİYE UYUMLULUK: eski istemciler ham kimlik gönderiyor olabilir; kimlik
 * tanınıyorsa aynen kabul edilir (yeni sürüm çıkana kadar panel çalışsın).
 */
export const kaynakId = (kod) => {
  if (!kod) return null;
  if (TERS[kod]) return TERS[kod];
  if (KAYNAK_KODLARI[kod]) return kod;      // eski istemci ham kimlik yolladı
  return null;
};

/** Bir nesnenin ANAHTARLARINI kimlikten koda çevirir (bySource gibi). */
export function anahtarlariKodla(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [id, v] of Object.entries(obj)) out[kaynakKodu(id)] = v;
  return out;
}
