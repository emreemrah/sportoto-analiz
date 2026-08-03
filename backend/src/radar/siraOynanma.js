// SIRA GEÇMİŞİNE OYNANMA YÜZDESİ — Radar 5'in geçmiş maç listesi için.
//
// NEDEN VAR: Radar 5, bir sıraya (1..15) dokununca o sırada geçmişte oynanmış
// maçları sonucuyla listeliyor. Kullanıcı isteği: her satırın altında O MAÇIN
// oynanma yüzdesi de görünsün — "1. sıradaki maçlar nasıl bitmiş ve o maçlara
// ne oynanmıştı" tek bakışta okunsun.
//
// HANGİ GÜNÜN YÜZDESİ: haftanın SON kayıtlı günü (pencerenin Cuma'sı).
// Gerekçe kullanıcıdan: "sadece cuma günü olan oynanmayı koysan yeterli".
// Bu, maçlara en yakın ve OTURMUŞ değerdir; hafta başındaki değerler henüz
// az kuponla oluştuğu için oynaktır.
//
// KAPSAM SINIRI — DÜRÜSTÇE SÖYLENİR: oynanma arşivi 51. haftada başladı.
// Daha eski maçlarda yüzde YOKTUR ve UYDURULMAZ; o satırlar `played: null`
// döner, ekran da sayı yerine boşluk gösterir.
//
// Saf modül: ağ/veritabanı yok, girdi olarak DNA kayıtlarını alır.

const SECENEKLER = ['1', 'X', '2'];

// RADAR 5 GEÇMİŞ LİSTESİNİN BAŞLANGICI — 51. Hafta (roundId 1525).
// Kullanıcı kararı (3 Ağustos 2026): önce "49. haftadan geriye silelim elimizde
// veri yok", ardından "50 de dahil olsun veri yok". 50. Hafta = 1522,
// 49. Hafta = 1521; ikisinde de oynanma gözlemi YOK.
//
// SINIR TESADÜF DEĞİL: 1525, oynanma toplamanın gerçekten başladığı turdur
// (playedDnaArchive.DNA_START_ROUND_ID ile AYNI sayı). Liste artık tam olarak
// elimizde veri OLAN haftaları gösterir.
//
// NE SİLİNMEZ: bu yalnız LİSTE görünümüdür. Resmî sonuç arşivi yerinde durur
// ve Radar 5'in yüzdeleri (position-dna) 52 haftanın tamamından hesaplanmaya
// DEVAM eder — 2 maçtan çıkan bir yüzde istatistik olmazdı.
export const LISTE_BASLANGIC_ROUND_ID = Number(process.env.RADAR5_LISTE_BASLANGIC) || 1525;

/**
 * Sınırdan eski haftaları listeden atar. roundId okunamayan kayıt DA atılır:
 * sıralaması bilinmeyen bir satır listenin neresine düşeceği belli olmadığı
 * için sessizce en eskiye karışır.
 */
export function eskiHaftalariAt(matches, baslangic = LISTE_BASLANGIC_ROUND_ID) {
  return (matches || []).filter((m) => {
    const r = Number(m?.roundId);
    return Number.isFinite(r) && r >= baslangic;
  });
}

// Yüzdeler arşivde 0-100 ya da 0-1 olarak durabiliyor (kaydın yaşına göre).
// Ölçek TOPLAMDAN tespit edilir; tahmin edilmez.
function yuzdeye(pct) {
  if (!pct) return null;
  const v = SECENEKLER.map((k) => {
    const x = pct[k];
    // DİKKAT: Number(null) === 0. Elenmezse eksik bir seçenek sessizce %0 olur,
    // toplam yine ~100 çıkar ve olmayan veriden satır üretiriz.
    return (x == null || x === '' || typeof x === 'boolean') ? NaN : Number(x);
  });
  if (v.some((x) => !Number.isFinite(x) || x < 0)) return null;
  const t = v[0] + v[1] + v[2];
  if (t > 80 && t < 120) return { '1': Math.round(v[0]), X: Math.round(v[1]), '2': Math.round(v[2]) };
  if (t > 0.8 && t < 1.2) return { '1': Math.round(v[0] * 100), X: Math.round(v[1] * 100), '2': Math.round(v[2] * 100) };
  return null;
}

/**
 * (tur, sıra) → o haftanın SON kayıtlı gününe ait oynanma yüzdesi.
 *
 * @param {Array} records  playedDnaArchive.collectPlayedDnaRecords çıktısı
 * @param {string} kaynak  yalnız bu sağlayıcının kaydı kullanılır
 * @returns {Map<string, {gun, pct, favori, favoriPct}>}  anahtar: `${roundId}|${position}`
 */
export function sonGunOynanmaIndeksi(records, kaynak = 'nesine') {
  const enIyi = new Map();
  for (const r of records || []) {
    if (!r || r.source !== kaynak) continue;
    if (r.position == null || !r.dayKey) continue;
    const pct = yuzdeye(r.pct);
    if (!pct) continue;
    const anahtar = `${r.roundId}|${Number(r.position)}`;
    const onceki = enIyi.get(anahtar);
    // Haftanın SON günü kazanır. Gün anahtarı 'YYYY-MM-DD' olduğu için
    // metin karşılaştırması tarih sırasıyla aynıdır.
    if (!onceki || String(r.dayKey) > String(onceki.gun)) {
      const favori = SECENEKLER.reduce((a, b) => (pct[b] > pct[a] ? b : a), '1');
      enIyi.set(anahtar, { gun: r.dayKey, pct, favori, favoriPct: pct[favori] });
    }
  }
  return enIyi;
}

/**
 * Geçmiş maç listesine yüzdeyi İLİŞTİRİR. Liste kendi kaynağından (resmî sonuç
 * geçmişi) gelmeye devam eder; yalnız eşleşen satırlara `played` eklenir.
 *
 * @returns {{matches:Array, yuzdeliSayi:number}}
 */
export function oynanmaEkle(matches, indeks, position) {
  let yuzdeliSayi = 0;
  const cikti = (matches || []).map((m) => {
    const s = indeks.get(`${m.roundId}|${Number(position)}`);
    if (!s) return { ...m, played: null };
    yuzdeliSayi += 1;
    return { ...m, played: { gun: s.gun, pct: s.pct, favori: s.favori, favoriPct: s.favoriPct } };
  });
  return { matches: cikti, yuzdeliSayi };
}
