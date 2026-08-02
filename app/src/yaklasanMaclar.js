// YAKLAŞAN MAÇ LİSTESİ — güncel bülten + ÖNCEKİ HAFTADAN devam edenler.
// ---------------------------------------------------------------------------
// NEDEN ÖNCEKİ HAFTA DA VAR: Spor Toto haftaları üst üste biner. Yeni bülten
// açıldığında bir önceki haftanın maçlarının bir kısmı HENÜZ OYNANMAMIŞTIR.
// Gerçek örnek (2 Ağustos 2026): 53. Hafta yayındaydı ve maçları 8-9 Ağustos'ta
// oynanacaktı; ama 52. Hafta'nın 11 maçı O GÜN ve ertesi gün oynanıyordu.
// Yalnız güncel bülteni gösteren bir liste, kullanıcıya EN YAKIN maçları hiç
// göstermiyordu — bir hafta sonrasını "yaklaşan" diye sunuyordu.
//
// HAFTA ETİKETİ ŞART: iki haftanın maçları aynı listede karışır. Hangi maçın
// hangi haftaya ait olduğu yazılmazsa kullanıcı kupon yaparken yanlış haftaya
// bakar. Bu yüzden her kayıt roundId + hafta adı taşır.
//
// TIKLAMA HEDEFİ AYRIDIR: güncel haftanın maçı maç detayına gider; önceki
// haftanınki GİDEMEZ, çünkü maç detayı sıra numarasını GÜNCEL bültende arar ve
// aynı numaradaki BAŞKA bir maçı açardı. Önceki hafta kartları o haftanın
// bülten detayına gider.

// Sonucu belli olmayan durumlar. 'void_no_result' resmî sonucu hiç
// yayımlanmayacak maçtır (ertelenmiş/iptal) — "yaklaşan" değildir, listeye
// girmez; yoksa hiç oynanmayacak bir maç haftalarca listede kalırdı.
const BITMEMIS_DURUMLAR = new Set(['upcoming', 'scheduled', 'live', 'postponed']);

/** rounds yanıtından bir önceki haftanın id'si. Yoksa null. */
export function oncekiRoundId(roundsYaniti) {
  const hepsi = roundsYaniti?.rounds || [];
  const i = hepsi.findIndex((r) => r.id === roundsYaniti?.currentRoundId);
  if (i < 1) return null;                 // güncel hafta ilk sırada ya da bulunamadı
  return hepsi[i - 1]?.id ?? null;
}

function tarihGecerli(m) {
  if (!m?.date) return false;
  return !Number.isNaN(new Date(m.date).getTime());
}

function bitmemis(m) {
  // Durum alanı hiç yoksa maçı düşürmeyiz (eski kayıtlar); yalnız BİLİNEN
  // bitmiş/geçersiz durumlar elenir.
  if (!m?.status) return true;
  return BITMEMIS_DURUMLAR.has(m.status);
}

// Başlama saati geçmiş ama henüz bitmemiş maç, oynanıyor olabilir; bu kadar
// süre boyunca listede kalır. Sonrasında "yaklaşan" değil, SONUCU BEKLENEN
// maçtır ve bu listeye ait değildir — dün oynanmış bir maçı "yaklaşan" diye
// göstermek kullanıcıyı yanıltır.
const CANLI_PAY_MS = 150 * 60e3;                  // 2,5 saat

/**
 * Güncel ve önceki haftanın HENÜZ OYNANMAMIŞ maçlarını tek listede birleştirir,
 * tarihe göre en yakından uzağa sıralar.
 *
 * GÜNCEL HAFTAYA YER AYRILIR: yalnız tarihe göre kesmek, önceki haftanın
 * maçları daha yakın olduğu için GÜNCEL bülteni ekrandan tamamen siliyordu.
 * Ana sayfanın bu haftanın bülteninden hiç maç göstermemesi kabul edilemez.
 *
 * @param {object}   guncel        { roundId, round, matches }
 * @param {object?}  onceki        { roundId, round, matches } — yoksa yalnız güncel
 * @param {number}   enCok         listedeki üst sınır
 * @param {number}   enAzGuncel    güncel haftaya ayrılan asgari yer
 * @param {number}   simdi         "şu an" (test için sabitlenebilir)
 */
export function yaklasanMaclar(guncel, onceki = null, {
  enCok = 10, enAzGuncel = 3, simdi = Date.now(),
} = {}) {
  const kayit = (m, kaynak, oncekiHafta) => ({
    ...m,
    roundId: kaynak?.roundId ?? null,
    haftaAdi: kaynak?.round ?? null,
    oncekiHafta,
  });

  const uygun = (m) => bitmemis(m) && tarihGecerli(m)
    && new Date(m.date).getTime() >= simdi - CANLI_PAY_MS;

  const sirala = (a, b) => new Date(a.date) - new Date(b.date);
  const topla = (kaynak, oncekiHafta) => (kaynak?.matches || [])
    .filter(uygun)
    .map((m) => kayit(m, kaynak, oncekiHafta))
    .sort(sirala);

  const guncelListe = topla(guncel, false);
  const oncekiListe = topla(onceki, true);

  // Önce güncel haftaya yerini ayır, kalanı önceki haftaya ver, artanı yine
  // güncel haftadan tamamla.
  const oncekiPay = Math.max(0, enCok - Math.min(guncelListe.length, enAzGuncel));
  const secilenOnceki = oncekiListe.slice(0, oncekiPay);
  const secilenGuncel = guncelListe.slice(0, enCok - secilenOnceki.length);

  return [...secilenOnceki, ...secilenGuncel].sort(sirala);
}
