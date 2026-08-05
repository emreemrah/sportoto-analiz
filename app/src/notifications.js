// BİLDİRİM MERKEZİ — SAF MODÜL (React Native bağımlılığı YOK, test edilebilir).
//
// AMAÇ: Kullanıcının kaçırdığı GERÇEK olayları tek yerde toplamak:
//   • yeni bülten yayınlandı
//   • takip ettiği maç birazdan başlıyor
//   • resmî sonuçlar açıklandı / hafta kapandı
//   • sunucunun doğruladığı puan ve başarı kazanımı
//
// KESİN KURALLAR (bu dosyanın var oluş şartı):
//  1) Hiçbir bildirim UYDURULMAZ. Her satırın arkasında gerçek bir veri olmalı;
//     veri yoksa satır hiç üretilmez (boş liste dürüst sonuçtur).
//  2) Yalnız RESMÎ sonuç "sonuçlandı" sayılır (hem `result` hem `score`).
//     Canlı/geçici skor bildirime "sonuç açıklandı" diye yazılmaz.
//  3) İddialı dil yok: "kesin/garanti/banko/yanılmaz" geçmez. Bildirimler
//     kupon oynamaya teşvik etmez; yalnız olup biteni haber verir.
//  4) Puan/başarı YALNIZ sunucudan gelen `progress` ile karşılaştırılır.
//     İstemci kendi kendine puan üretemez (sahte başarı engeli).
//  5) Kimliği belirleyen alan yok — bildirim metninde e-posta, telefon,
//     belirteç veya başka kullanıcının verisi bulunmaz.

/** Resmî sonuç kuralı: hem 1/X/2 hem skor gelmiş olmalı. */
export function isOfficial(m) {
  return !!(m && m.result && m.score);
}

function toTime(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

function saatMetni(ms) {
  try {
    return new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/** Kupon deposundaki son sürümün seçimleri (yoksa boş dizi). */
function couponSelections(coupon) {
  if (!coupon || !Array.isArray(coupon.versions) || !coupon.versions.length) return [];
  const son = coupon.versions.find((v) => v.id === coupon.finalVersionId) || coupon.versions[coupon.versions.length - 1];
  return Array.isArray(son?.selections) ? son.selections : [];
}

/**
 * Kullanıcının o haftaki tüm kuponlarında işaretlediği maç numaraları.
 * `pushPlanner.js` de aynı kuralı kullanır (kupon çözümlemesi tek yerde kalsın
 * diye kopyalanmadı, dışa açıldı) — davranışı değişmedi.
 */
export function seciliMacNolari(coupons) {
  const set = new Set();
  for (const c of coupons || []) {
    for (const s of couponSelections(c)) {
      if (s && s.no != null && Array.isArray(s.selectedOutcomes) && s.selectedOutcomes.length) set.add(Number(s.no));
    }
  }
  return set;
}

const BASLIYOR_PENCERE_MS = 60 * 60 * 1000; // 1 saat içinde başlayacaklar

// Bülten `round` alanı GERÇEK API'de METİNDİR (hafta adı). Bazı çağrı yerleri
// nesne verebildiği için iki biçim de güvenle okunur.
function haftaKimlik(bulletin) {
  if (bulletin?.roundId != null) return bulletin.roundId;
  if (bulletin?.round && typeof bulletin.round === 'object' && bulletin.round.id != null) return bulletin.round.id;
  return null;
}
function haftaAdi(bulletin) {
  if (typeof bulletin?.round === 'string' && bulletin.round.trim()) return bulletin.round.trim();
  if (bulletin?.round && typeof bulletin.round === 'object' && bulletin.round.name) return bulletin.round.name;
  return null;
}

/**
 * Gerçek verilerden bildirim listesi üretir.
 *
 * @param {object} g
 * @param {number} g.now                    şu anki zaman (ms) — dışarıdan verilir (test edilebilir)
 * @param {object} [g.bulletin]             güncel bülten: { roundId, round, matches: [{no, date, home, away, status}] }
 * @param {object} [g.history]              kapanan hafta: { roundId, roundName, matches: [...] }
 * @param {Array}  [g.coupons]              kullanıcının O HAFTAKİ kuponları (kupon deposundan)
 * @param {object} [g.progress]             sunucudan: { points, level, achievements: [{key,title,icon,earned}] }
 * @param {object} [g.state]                cihazda tutulan durum: { seenAt, lastPoints, lastAchievements, knownRoundIds, dismissed }
 * @returns {{items: Array, unread: number}}
 */
export function buildNotifications({ now = 0, bulletin = null, history = null, coupons = [], progress = null, state = {} } = {}) {
  const items = [];
  const gorulen = new Set(Array.isArray(state.dismissed) ? state.dismissed : []);
  const bilinenHaftalar = new Set((Array.isArray(state.knownRoundIds) ? state.knownRoundIds : []).map(String));

  const ekle = (o) => {
    if (!o || !o.id || gorulen.has(o.id)) return;
    items.push(o);
  };

  // 1) YENİ BÜLTEN — daha önce görülmemiş bir hafta kimliği geldiyse.
  const gRound = haftaKimlik(bulletin);
  const gAd = haftaAdi(bulletin);
  if (gRound != null && bilinenHaftalar.size && !bilinenHaftalar.has(String(gRound))) {
    const sayi = Array.isArray(bulletin?.matches) ? bulletin.matches.length : 0;
    ekle({
      id: `round:${gRound}`,
      kind: 'new-round',
      icon: '🗓️',
      title: 'Yeni bülten yayında',
      body: sayi ? `${gAd || 'Bu hafta'} · ${sayi} maç listelendi.` : `${gAd || 'Yeni hafta'} açıldı.`,
      at: now,
      target: { tab: 'BulletinTab', screen: 'Bulletin' },
    });
  }

  // 2) BAŞLIYOR — YALNIZ kullanıcının kuponunda işaretlediği maçlar için ve
  //    yalnız gerçek başlama saati varsa. Saat yoksa bildirim üretilmez.
  const kuponMaclari = seciliMacNolari(coupons);
  if (kuponMaclari.size && Array.isArray(bulletin?.matches)) {
    for (const m of bulletin.matches) {
      if (!kuponMaclari.has(Number(m?.no))) continue;
      const t = toTime(m?.date);
      if (t == null) continue;                       // saat yoksa uydurma
      if (m?.status === 'finished' || isOfficial(m)) continue;
      const fark = t - now;
      if (fark <= 0 || fark > BASLIYOR_PENCERE_MS) continue;
      const ev = m?.home?.name || m?.home || '';
      const dep = m?.away?.name || m?.away || '';
      if (!ev || !dep) continue;
      ekle({
        id: `start:${gRound}:${m.no}`,
        kind: 'match-starting',
        icon: '⏰',
        title: 'Kuponundaki maç başlıyor',
        body: `${m.no}. ${ev} – ${dep} · ${saatMetni(t)}`,
        at: t,
        target: { tab: 'BulletinTab', screen: 'LiveMatchDetail', params: { no: m.no } },
      });
    }
  }

  // 3) RESMÎ SONUÇ — kapanan haftada kaç maç resmîleşti. Kısmî de olsa haber
  //    verilir ama sayı GERÇEKTİR; "hepsi bitti" denmez.
  if (history && Array.isArray(history.matches) && history.matches.length) {
    const toplam = history.matches.length;
    const resmi = history.matches.filter(isOfficial).length;
    if (resmi > 0) {
      const tamam = resmi === toplam;
      ekle({
        id: `official:${history.roundId}:${resmi}`,
        kind: 'result-official',
        icon: tamam ? '🏁' : '📣',
        title: tamam ? 'Hafta kapandı' : 'Resmî sonuçlar açıklanıyor',
        body: `${history.roundName || 'Geçen hafta'} · ${resmi}/${toplam} maçın resmî sonucu geldi.`,
        at: now,
        target: { tab: 'HomeTab', screen: 'WeekRecap', params: { roundId: history.roundId } },
      });
    }
  }

  // 4-5) PUAN ve BAŞARI bildirimleri KALDIRILDI (oyunlaştırma söküldü,
  //      kullanıcı kararı 2026-08-06). progress parametresi geriye uyum için
  //      kabul edilir ama artık hiçbir bildirim üretmez.

  // En yeni üstte; eşitlikte kararlı sıra (tür önceliği).
  const oncelik = { 'match-starting': 0, 'result-official': 1, 'new-round': 2 };
  items.sort((a, b) => (b.at - a.at) || ((oncelik[a.kind] ?? 9) - (oncelik[b.kind] ?? 9)));

  const seenAt = Number.isFinite(state?.seenAt) ? state.seenAt : 0;
  const unread = items.filter((i) => i.at > seenAt).length;
  return { items, unread };
}

/**
 * Bildirimler okunduktan sonra saklanacak yeni durum.
 * Not: `dismissed` sınırsız büyümesin diye son 200 kimlikle sınırlanır.
 */
export function nextState({ now = 0, state = {}, items = [], bulletin = null, progress = null } = {}) {
  const gRound = haftaKimlik(bulletin);
  const haftalar = new Set((Array.isArray(state.knownRoundIds) ? state.knownRoundIds : []).map(String));
  if (gRound != null) haftalar.add(String(gRound));

  const eski = Array.isArray(state.dismissed) ? state.dismissed : [];
  const yeni = [...eski, ...items.map((i) => i.id)];
  const benzersiz = Array.from(new Set(yeni)).slice(-200);

  return {
    seenAt: now,
    lastPoints: Number.isFinite(progress?.points) ? progress.points : (state.lastPoints ?? null),
    lastAchievements: (progress?.achievements || []).filter((a) => a?.earned && a.key).map((a) => a.key),
    knownRoundIds: Array.from(haftalar).slice(-24),
    dismissed: benzersiz,
  };
}

/** İlk açılışta geçmişe dönük bildirim yağmuru olmasın diye başlangıç durumu. */
export function seedState({ now = 0, bulletin = null, progress = null } = {}) {
  return nextState({ now, state: {}, items: [], bulletin, progress });
}
