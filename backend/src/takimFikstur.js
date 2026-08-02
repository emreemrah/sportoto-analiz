// TAKIM FİKSTÜRÜ — bir takımın sezondaki TÜM maçları: oynanmış + oynanacak.
// ---------------------------------------------------------------------------
// NEDEN AYRI: elimizdeki `matchLog` yalnız OYNANMIŞ maçları tutar (form
// hesabı için). Kullanıcı ise takımın tüm fikstürünü istiyor — geçmiş
// sonuçlar ve gelecek maçlar tek listede, tarih sırasıyla.
//
// SONUÇ HARFİ YALNIZ BİTMİŞ MAÇA YAZILIR. Oynanmamış maça G/B/M üretmek,
// olmayan veriyi varmış gibi göstermek olur (projenin temel kuralı).
// Skoru olmayan "bitmiş" maça da harf yazılmaz — durum ile skor birbirini
// tutmuyorsa susmak, uydurmaktan iyidir.
import { load, save } from './cache.js';
import { fetchSeason } from './sources/footystats.js';

// Sezon fikstürü sık değişmez; her kart açılışında kaynağa gitmek gereksiz.
export const FIKSTUR_TTL_MS = 30 * 60e3;

/**
 * Bülten maçına yazılacak KAYNAK takım kimlikleri.
 *
 * `swapped`, eşleştiricinin "bülten ev/deplasmanı ters listelemiş" demesidir.
 * Kimlikler de çevrilmezse takım kartı RAKİBİN fikstürünü açar — sessiz ve
 * fark edilmesi zor bir hata. Bu yüzden ayrı ve test edilebilir tutulur.
 */
export function kaynakTakimKimlikleri(fm, swapped) {
  if (!fm) return { home: null, away: null };
  return swapped
    ? { home: fm.awayId ?? null, away: fm.homeId ?? null }
    : { home: fm.homeId ?? null, away: fm.awayId ?? null };
}

/** Bir maçın bu takım açısından sonucu. Bitmemişse veya skor yoksa null. */
export function sonucHarfi(mac, takimId) {
  if (mac?.status !== 'finished') return null;
  const s = mac.score;
  // DİKKAT: `Number(null)` sıfırdır. Yalnız Number.isFinite'e bakan bir kontrol,
  // skoru EKSİK gelen maçı 0-2 sanıp "M" yazıyordu — yani olmayan bir sonucu
  // uyduruyordu. Bu yüzden null/undefined ÖNCE elenir.
  const sayi = (v) => (v == null || v === '' ? null : Number(v));
  const ev = sayi(s?.home);
  const dep = sayi(s?.away);
  if (!Number.isFinite(ev) || !Number.isFinite(dep)) return null;
  const evde = Number(mac.homeId) === Number(takimId);
  const attigi = evde ? ev : dep;
  const yedigi = evde ? dep : ev;
  if (attigi > yedigi) return 'G';
  if (attigi < yedigi) return 'M';
  return 'B';
}

/**
 * Sezon maçlarından tek takımın fikstürünü çıkarır (saf, test edilebilir).
 * Tarihe göre eskiden yeniye sıralanır — Spor Toto listesi de böyle okunur.
 */
export function takimFiksturu(sezonMaclari, takimId) {
  const id = Number(takimId);
  return (sezonMaclari || [])
    .filter((m) => Number(m.homeId) === id || Number(m.awayId) === id)
    .map((m) => {
      const evde = Number(m.homeId) === id;
      const bitti = m.status === 'finished';
      return {
        footyMatchId: m.footyMatchId ?? null,
        dateUnix: m.dateUnix ?? null,
        gameWeek: m.gameWeek ?? null,
        home: m.homeName ?? null,
        away: m.awayName ?? null,
        homeImage: m.homeImage ?? null,
        awayImage: m.awayImage ?? null,
        evde,
        rakip: evde ? (m.awayName ?? null) : (m.homeName ?? null),
        status: m.status ?? null,
        oynandi: bitti,
        score: bitti && m.score ? { home: m.score.home, away: m.score.away } : null,
        sonuc: sonucHarfi(m, id),
      };
    })
    .sort((a, b) => (a.dateUnix ?? 0) - (b.dateUnix ?? 0));
}

/**
 * FİKSTÜR İNDEKSİ — bültendeki takımların, ELİMİZDEKİ TÜM turnuvalardaki
 * maçları. Yenileme sırasında kurulur, uç bunu okur.
 *
 * NEDEN TEK SEZON YETMİYOR: bir takım yalnız liginde oynamaz — kupa, Avrupa
 * ve hazırlık maçları başka "sezon" kimlikleri altındadır. Yalnız maçın kendi
 * lig sezonunda arayan bir fikstür, o maçları hiç göstermez ve kullanıcı
 * eksikliği fark edemez (liste dolu görünür, sadece bazı maçlar yoktur).
 *
 * KAPSAM DÜRÜSTLÜĞÜ: burada yalnız hesabın seçili turnuvaları vardır. Bu
 * fonksiyon olmayan turnuvayı uydurmaz; ekran hangi turnuvaların geldiğini
 * satır satır yazar, böylece eksik kapsam görünür olur.
 *
 * @param {Array}  takimIdleri   indekslenecek takım kimlikleri
 * @param {Array}  tumMaclar     tüm sezonların maçları (düz dizi)
 * @param {Map}    ligBilgisi    seasonId → { name, image }
 */
export function fiksturIndeksi(takimIdleri, tumMaclar, ligBilgisi) {
  const hedef = new Set((takimIdleri || []).filter((x) => x != null).map(Number));
  const indeks = {};
  for (const m of tumMaclar || []) {
    for (const id of [Number(m.homeId), Number(m.awayId)]) {
      if (!hedef.has(id)) continue;
      const evde = Number(m.homeId) === id;
      const bitti = m.status === 'finished';
      (indeks[id] ||= []).push({
        footyMatchId: m.footyMatchId ?? null,
        dateUnix: m.dateUnix ?? null,
        gameWeek: m.gameWeek ?? null,
        lig: ligBilgisi?.get?.(String(m.seasonId))?.name ?? null,
        home: m.homeName ?? null,
        away: m.awayName ?? null,
        evde,
        rakip: evde ? (m.awayName ?? null) : (m.homeName ?? null),
        status: m.status ?? null,
        oynandi: bitti,
        score: bitti && m.score ? { home: m.score.home, away: m.score.away } : null,
        sonuc: sonucHarfi(m, id),
      });
    }
  }
  // Aynı maç iki kez sayılmasın (iki takımı da bültendeyse ayrı listelere
  // girer, bu doğru; ama aynı listeye iki kez girmemeli).
  for (const id of Object.keys(indeks)) {
    const gorulen = new Set();
    indeks[id] = indeks[id]
      .filter((f) => (f.footyMatchId == null ? true : !gorulen.has(f.footyMatchId) && gorulen.add(f.footyMatchId)))
      .sort((a, b) => (a.dateUnix ?? 0) - (b.dateUnix ?? 0));
  }
  return indeks;
}

/** TTL'li sezon okuma — aynı sezon her kart açılışında yeniden istenmez. */
async function sezonCacheli(seasonId, { ttlMs = FIKSTUR_TTL_MS, fetcher = fetchSeason } = {}) {
  const anahtar = `season-${seasonId}`;
  const eski = load(anahtar);
  if (eski?.savedAt && Date.now() - new Date(eski.savedAt).getTime() < ttlMs && eski.data?.matches) {
    return eski.data;
  }
  const taze = await fetcher(seasonId);
  try { save(anahtar, taze); } catch { /* cache yazılamadı — akış bozulmaz */ }
  return taze;
}

/**
 * Uç için hazır yanıt: takımın fikstürü + kaç maçı oynandı.
 * Sezon alınamazsa HATA FIRLATIR — boş liste dönüp "maçı yok" izlenimi
 * vermek, veri yokluğunu sessizce gizlemek olurdu.
 */
export async function takimFiksturunuGetir(takimId, seasonId, opts = {}) {
  // ÖNCE TÜM TURNUVA İNDEKSİ: yenileme sırasında kurulur ve elimizdeki BÜTÜN
  // turnuvaları kapsar (lig + kupa + Avrupa — hesapta hangileri seçiliyse).
  // Tek sezona düşmek, kupa ve Avrupa maçlarını sessizce yutardı.
  const indeks = load('teamFixtures')?.data;
  const hazir = indeks?.[String(takimId)];
  if (hazir?.fikstur?.length) {
    return {
      takimId: Number(takimId),
      seasonId: Number(seasonId),
      takimAdi: hazir.ad ?? null,
      kaynak: 'indeks',
      ligler: [...new Set(hazir.fikstur.map((f) => f.lig).filter(Boolean))],
      toplam: hazir.fikstur.length,
      oynanan: hazir.fikstur.filter((f) => f.oynandi).length,
      fikstur: hazir.fikstur,
    };
  }

  // YEDEK: indeks yoksa (ilk açılış, eski cache) yalnız maçın kendi lig
  // sezonu. Eksik kapsam `kaynak` alanıyla AÇIKÇA bildirilir — sessizce
  // "bu takımın başka maçı yok" denmez.
  const sezon = await sezonCacheli(seasonId, opts);
  const fikstur = takimFiksturu(sezon.matches, takimId);
  const takim = (sezon.teams || []).find((t) => Number(t.id ?? t.teamId) === Number(takimId)) || null;
  return {
    takimId: Number(takimId),
    seasonId: Number(seasonId),
    kaynak: 'tek-sezon',
    takimAdi: takim?.name ?? takim?.cleanName ?? null,
    toplam: fikstur.length,
    oynanan: fikstur.filter((f) => f.oynandi).length,
    fikstur,
  };
}
