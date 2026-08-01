// ---------------------------------------------------------------------------
// MODERASYON — yorum bildirme + kullanıcı engelleme (yayın kontrol listesi E9)
// ---------------------------------------------------------------------------
// Google Play, kullanıcı içeriği barındıran uygulamalardan üç şey ister:
// uygunsuz içeriği BİLDİRME yolu, rahatsız eden kullanıcıyı ENGELLEME yolu ve
// bildirimlere karşılık veren bir moderasyon süreci. Bu dosya bunun karar
// mantığını taşır; veri tarafı `migrations/007_moderation_report_block.sql`.
//
// Bu modülün ÇEKİRDEĞİ SAF'tır: `gorunurYorumlar` veritabanına dokunmaz, bu
// yüzden bağlantı olmadan, gerçek satır şekilleriyle test edilebilir. Yalnız
// `engelSeti` veritabanı okur ve o da istemciyi dışarıdan alır.

/**
 * Kabul edilen bildirim sebepleri. Liste KAPALIDIR: serbest metin sebep olarak
 * kabul edilmez (aynı kısıt veritabanında da var — 007'deki CHECK).
 *
 * Arayüzdeki etiketler `app/src/moderationReasons.js` dosyasındadır ve iki
 * listenin anahtarlarının aynı kaldığı testle ölçülür; elle eşleşmeye
 * güvenilmez.
 */
export const BILDIRIM_SEBEPLERI = Object.freeze([
  'spam',
  'hakaret',
  'nefret',
  'cinsel',
  'siddet',
  'yaniltici',
  'diger',
]);

/** Otomatik gizlemenin veritabanına yazdığı sebep (007'deki trigger ile aynı). */
export const OTOMATIK_GIZLEME_SEBEBI = 'otomatik: bildirim esigi';

/** Yazarına gösterilen açıklama. Kaç kişinin bildirdiği AÇIKLANMAZ. */
export const GIZLI_YORUM_NOTU =
  'Bu yorum, gelen bildirimler üzerine otomatik olarak gizlendi. Şu an yalnız sen görüyorsun.';

/** Bildirim not alanının üst sınırı (007'deki CHECK ile aynı). */
export const NOT_SINIRI = 300;

/**
 * Kullanıcının GÖRMEMESİ gereken kimlikler.
 *
 * Engel kaydı TEK YÖNLÜDÜR (blocker → blocked) ama görünürlükte ÇİFT YÖNLÜ
 * uygulanır: engelleyen engellenenin yorumlarını görmez, engellenen de
 * engelleyenin yorumlarını görmez. Böylece engel karşı tarafa ilan edilmeden
 * taciz zinciri kesilir.
 *
 * Hata YUTULMAZ: liste okunamazsa çağıran tarafın işi durdurması gerekir.
 * Sessizce boş küme dönmek, engellenen kişinin yorumlarını engelleyene
 * göstermek demektir — yani özelliğin var olma sebebini ortadan kaldırır.
 *
 * @param {object} sb      Supabase admin istemcisi
 * @param {string|null} userId
 * @returns {Promise<Set<string>>}
 */
export async function engelSeti(sb, userId) {
  if (!userId) return new Set();
  const [benimkiler, banaGelenler] = await Promise.all([
    sb.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
    sb.from('user_blocks').select('blocker_id').eq('blocked_id', userId),
  ]);
  if (benimkiler.error) throw new Error(benimkiler.error.message);
  if (banaGelenler.error) throw new Error(banaGelenler.error.message);

  const kume = new Set();
  (benimkiler.data || []).forEach((r) => kume.add(r.blocked_id));
  (banaGelenler.data || []).forEach((r) => kume.add(r.blocker_id));
  return kume;
}

/**
 * Görünürlük süzgeci — SAF fonksiyon.
 *
 * Üç kural:
 *   1. Engelli tarafın (her iki yön) yorumları düşer.
 *   2. Gizlenmiş yorumlar düşer — YAZARI hariç. Yazar kendi gizlenmiş yorumunu
 *      görür; yoksa yorumu "kayboldu" sanır ve ne olduğunu öğrenemez.
 *   3. Ebeveyni düşen cevap da düşer (zincir boyunca).
 *
 * (3) neden gerekli: cevap, düşen bir yorumun altına asılı kalırsa arayüz onu
 * çizemez ama sayaç onu saymaya devam eder — kullanıcı "12 yorum" görür, 9
 * tane sayar. Süzme sunucuda yapılınca sayı ile ekran birbirini tutar.
 *
 * @param {object[]} satirlar  Ham `comments` satırları (id, user_id, parent_id, hidden_at)
 * @param {object}   secenek
 * @param {string|null} secenek.userId   İsteği yapan kullanıcı (yoksa null)
 * @param {Set<string>} secenek.engelli  `engelSeti` çıktısı
 * @returns {object[]} Girdi sırasını KORUYAN, süzülmüş satırlar
 */
export function gorunurYorumlar(satirlar, { userId = null, engelli = new Set() } = {}) {
  const kalan = new Map();
  for (const r of satirlar) {
    if (engelli.has(r.user_id)) continue;
    if (r.hidden_at && r.user_id !== userId) continue;
    kalan.set(String(r.id), r);
  }

  // Ebeveyni düşenleri zincir boyunca eleme. Liste her turda küçüldüğü için
  // döngü sonludur; en fazla cevap zinciri derinliği kadar tur döner.
  let degisti = true;
  while (degisti) {
    degisti = false;
    for (const [id, r] of kalan) {
      if (r.parent_id == null) continue;
      if (!kalan.has(String(r.parent_id))) {
        kalan.delete(id);
        degisti = true;
      }
    }
  }

  return satirlar.filter((r) => kalan.has(String(r.id)));
}

/**
 * Supabase/PostgreSQL hata metninden "bu kayıt zaten var" durumunu tanır.
 * Bildirme ve engelleme İDEMPOTENT'tir: ikinci kez denemek hata değildir.
 */
export function zatenVarMi(hata) {
  return /duplicate key|already exists|unique constraint|23505|conflict/i.test(String(hata || ''));
}

/** Var olmayan kullanıcı/yorum kimliği (FK ihlali veya bozuk uuid). */
export function gecersizHedefMi(hata) {
  return /foreign key|violates foreign key|23503|invalid input syntax|22P02/i.test(String(hata || ''));
}
