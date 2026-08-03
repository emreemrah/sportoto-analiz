// TAHMİN KAPISI — "bu maça şu an tahmin girilebilir mi?" sorusunun SUNUCU
// tarafındaki tek cevabı.
//
// NEDEN VAR: tahmin uçları (skor, oyuncu, kadro, anket) yalnız `matchId` var mı
// diye bakıyordu. Maçın gerçekten var olup olmadığı, başlayıp başlamadığı ve
// hangi bültene ait olduğu HİÇ doğrulanmıyordu. İki somut istismar:
//
//   1. Maç bittikten (sonuç açıklandıktan) sonra doğru tahmin gönderilip
//      "önceden bilmiş" gibi kaydedilebiliyor ve katılım puanı alınabiliyordu.
//   2. Uydurma bir matchId ile sınırsız puan toplanabiliyordu — kayıt hiçbir
//      gerçek maça bağlı değil.
//
// İstemcideki kilit yeterli değildir: istemci kodu kullanıcının elindedir.
// Kural sunucuda uygulanmazsa uygulanmamış sayılır.
//
// KURAL:
//   * matchId GÜNCEL bültende olmalı (bilinmeyen/eski maça tahmin yok).
//   * Maçın kendi kilit anı geçmemiş olmalı: kickoff − 5 dk.
//     (Kupon tarafındaki kuralla aynı: her maç kendi başlangıcından 5 dk önce
//      kilitlenir; tek tek kilit, bültenin tamamı için tek zaman DEĞİL.)
//
// Saf çekirdek (`tahminKabulEdilirMi`) ayrı tutuldu: bülteni parametre alır,
// böylece testler ağa/cache'e bağlı kalmaz.
import { load } from '../cache.js';

/** Maç başlangıcından bu kadar önce tahmin kapanır. */
export const KILIT_ONCESI_MS = 5 * 60e3;

/**
 * @param {string} matchId
 * @param {object} bulletin  { matches: [{ sportotoMatchId, no, date }] }
 * @param {number} now
 * @returns {{ok:boolean, code?:string, mesaj?:string, kickoffMs?:number}}
 */
export function tahminKabulEdilirMi(matchId, bulletin, now = Date.now()) {
  const id = String(matchId ?? '').trim();
  if (!id) return { ok: false, code: 'missing_match', mesaj: 'Maç belirtilmedi.' };

  const matches = bulletin?.matches || [];
  if (!matches.length) {
    // Bülten yoksa DOĞRULAYAMIYORUZ demektir. Doğrulanamayan isteği kabul
    // etmek kapıyı tümüyle açardı; reddetmek dürüst olandır.
    return { ok: false, code: 'no_bulletin', mesaj: 'Bülten şu an okunamadı, tahmin alınamıyor.' };
  }

  const mac = matches.find((m) => String(m.sportotoMatchId ?? m.no) === id);
  if (!mac) return { ok: false, code: 'unknown_match', mesaj: 'Bu maç güncel bültende yok.' };

  const kickoffMs = mac.date ? new Date(mac.date).getTime() : NaN;
  if (!Number.isFinite(kickoffMs)) {
    return { ok: false, code: 'no_kickoff', mesaj: 'Maç saati bilinmiyor, tahmin alınamıyor.' };
  }

  if (now >= kickoffMs - KILIT_ONCESI_MS) {
    return { ok: false, code: 'match_started', mesaj: 'Maç başladı — tahmin kapandı.', kickoffMs };
  }
  return { ok: true, kickoffMs };
}

/** Üretim sarmalayıcısı: bülteni cache'ten okur. */
export function tahminKapisi(matchId, now = Date.now()) {
  const bulletin = load('bulletin')?.data || null;
  return tahminKabulEdilirMi(matchId, bulletin, now);
}

/**
 * Express yardımcısı. Reddedilirse yanıtı KENDİ yazar ve false döner;
 * çağıran `if (!tahminKapisiVeYanitla(...)) return;` diyerek çıkar.
 */
export function tahminKapisiVeYanitla(req, res, matchId, now = Date.now()) {
  const k = tahminKapisi(matchId, now);
  if (k.ok) return true;
  // 409: istek biçimsel olarak doğru ama DURUM uygun değil (maç başladı).
  // 400: istek zaten geçersiz (maç yok/bilinmiyor).
  const durum = k.code === 'match_started' ? 409 : 400;
  res.status(durum).json({ error: k.mesaj, code: k.code });
  return false;
}
