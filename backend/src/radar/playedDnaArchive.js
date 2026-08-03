// OYNANMA DNA'SI — ARŞİV KATMANI
// ---------------------------------------------------------------------------
// Geçmiş turların GÜNLÜK MÜHÜRLÜ oynanma yüzdelerini çıkarır ve her kayda o
// maçın resmî 90 dk sonucunu bağlar. Çıktısı playedDna.js'in beklediği kayıt
// listesidir (saf motor arşivi bilmez, bu dosya DB'yi bilir).
//
// KURALLAR:
//  • Alınmamış bir günün yüzdesi SONRADAN ÜRETİLMEZ. Gözlem yoksa gün yoktur.
//  • Bir günün değeri = o günün MÜHÜR ANINA kadarki SON gözlemdir.
//      – normal gün: 23:55 (Europe/Istanbul)
//      – maç günü:   ilk maçtan 5 dk önce (donma anı) ile 23:55'in ERKENİ
//  • Mühür sonrası araştırma gözlemleri (post_lock_research) ve tahmine uygun
//    olmayan gözlemler DNA'ya GİRMEZ — geçmişe sızma olmaz.
//  • Resmî sonucu olmayan tur/maç kayıt üretmez (sonuç bağlanamaz).
//  • Şema değişikliği YOK: mevcut store metodları (listBulletins, getMatches,
//    listObservations, listOfficialResults) bestelenerek çalışır.
// Türkiye sabit UTC+3 (yaz saati uygulaması yok) — dailyOdds.js ile aynı kabul.
const TR_OFFSET_MS = 3 * 3600e3;
const SEAL_HOUR = 23;
const SEAL_MINUTE = 55;
const FREEZE_BEFORE_KICKOFF_MS = 5 * 60e3;
// 23:55 SINIRINA KÜÇÜK PAY. Günlük mühür turu tam 23:55'te koşar ve gözlemini
// 23:55:00.x'te YAZAR; katı "at > cap" karşılaştırması bu gözlemi güne dahil
// etmiyordu. Ölçülen gerçek: içeri alınan 45 kaydın damgası
// 23:55:00.6–23:55:02 → TAMAMI DNA dışı kalıyordu; nesine/misli'nin 23:55
// mühür gözlemleri de hiç sayılmıyordu. Pay yalnız 23:55 sınırına tanınır —
// DONMA (ilk maç −5 dk) sınırı PAYSIZ kalır: donma sonrası veri tahmine
// sızamaz (o kayıtlar zaten post_lock_research olarak da elenir).
const SEAL_GRACE_MS = 60e3;

// Varsayılan derinlik: maç filtrelerinin en genişi 15 maç → biraz pay bırakılır.
export const DEFAULT_MAX_ROUNDS = 20;

// ARŞİV BAŞLANGICI — Oynanma DNA'sı 51. haftadan (roundId 1525) İTİBAREN sayar.
// Sebep: günlük oynanma yüzdesi gözlemi bu haftadan önce TOPLANMADI. Daha eski
// turlar için geçmişe dönük yüzde üretilemez (kural), o yüzden hiç okunmazlar —
// eksik/yanıltıcı kayıt DNA'ya karışmaz. Gerekirse .env ile değiştirilebilir.
export const DNA_START_ROUND_ID = Number(process.env.PLAYED_DNA_START_ROUND_ID) || 1525;

const msOf = (v) => {
  if (v == null) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

// UTC ms → Istanbul gün anahtarı (YYYY-MM-DD)
export function dayKeyOf(ms) {
  const d = new Date(ms + TR_OFFSET_MS);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// Istanbul gün anahtarı + saat → UTC ms
function istanbulTimeToUtcMs(dayKey, hour, minute) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d, hour, minute, 0) - TR_OFFSET_MS;
}

// Gün anahtarından hafta günü (0=Pazar … 6=Cumartesi)
export function weekdayOf(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const validPct = (p) => !!p && ['1', 'X', '2'].every((k) => typeof p[k] === 'number' && Number.isFinite(p[k]));

// (maç, kaynak, gün) → o günün mühür anına kadarki SON gözlem.
// buildRoundDnaRecords'un çekirdeği; snapshot mühürleme de AYNI kuralı
// kullansın diye ayrı dışa verildi (iki ayrı gün-mühürleme tanımı olamaz:
// arşivle mühür farklı değer seçerse kıyas bozulur).
export function sealDailyPct({ observations = [], freezeMs = null } = {}) {
  const sealed = new Map();
  for (const o of observations) {
    if (!o || !validPct(o.playedPct)) continue;
    // Mühür sonrası araştırma / tahmine uygun olmayan gözlem girmez.
    if (o.kind === 'post_lock_research') continue;
    if (o.usableForPrediction === false) continue;
    const at = msOf(o.observedAt);
    if (at == null) continue;

    const dayKey = dayKeyOf(at);
    // Bu günün mühür tavanı: 23:55 (+pay, bkz. SEAL_GRACE_MS) ile donma anının
    // ERKENİ. Donma sınırına pay YOKTUR.
    let cap = istanbulTimeToUtcMs(dayKey, SEAL_HOUR, SEAL_MINUTE) + SEAL_GRACE_MS;
    if (freezeMs != null && freezeMs < cap) cap = freezeMs;
    if (at > cap) continue;                       // mühürden sonraki değer sayılmaz

    const matchKey = String(o.matchId);
    const key = `${matchKey}|${o.source}|${dayKey}`;
    const prev = sealed.get(key);
    if (!prev || at > prev.at) {
      sealed.set(key, { at, matchKey, source: o.source, dayKey, pct: o.playedPct });
    }
  }
  return [...sealed.values()];
}

// Tek turun günlük mühürlü kayıtlarını üretir (saf: veri dışarıdan verilir).
// observations / results / matches: store'dan gelen ham listeler.
export function buildRoundDnaRecords({
  roundId, roundLabel = null, observations = [], results = [], matches = [],
}) {
  // Maç no (bülten sırası), takım adları ve ilk maç saati.
  const posByMatch = new Map();
  const kickoffByMatch = new Map();
  const teamsByMatch = new Map();
  let firstKickoffMs = null;
  for (const m of matches) {
    if (m?.matchId != null && m.orderNo != null) posByMatch.set(String(m.matchId), m.orderNo);
    const k = msOf(m?.kickoffAt);
    // Maç penceresi (Son 5/10/15 MAÇ) bu saate göre sıralanır.
    if (m?.matchId != null && k != null) kickoffByMatch.set(String(m.matchId), new Date(k).toISOString());
    // Takım adları resmî listedeki gibi taşınır (çeviri/kısaltma yapılmaz).
    if (m?.matchId != null && (m.homeName || m.awayName)) {
      teamsByMatch.set(String(m.matchId), { home: m.homeName || null, away: m.awayName || null });
    }
    if (k != null && (firstKickoffMs == null || k < firstKickoffMs)) firstKickoffMs = k;
  }
  // Resmî sonuç haritası — sonucu olmayan maç DNA'ya girmez.
  const resultByMatch = new Map();
  for (const r of results) {
    if (r?.matchId != null && r.officialResult) resultByMatch.set(String(r.matchId), r.officialResult);
    if (r?.orderNo != null && r.officialResult && !posByMatch.size) {
      resultByMatch.set(`order:${r.orderNo}`, r.officialResult);
    }
  }
  const freezeMs = firstKickoffMs != null ? firstKickoffMs - FREEZE_BEFORE_KICKOFF_MS : null;

  // (maç, kaynak, gün) → günlük mühürlü değerler (ortak çekirdek: sealDailyPct).
  const sealed = sealDailyPct({ observations, freezeMs });

  const out = [];
  for (const s of sealed) {
    const result = resultByMatch.get(s.matchKey);
    if (!result) continue;                        // resmî sonuç yoksa kayıt yok
    const position = posByMatch.get(s.matchKey) ?? null;
    if (position == null) continue;               // sıra bilinmiyorsa kırılım yapılamaz
    const takim = teamsByMatch.get(s.matchKey) || {};
    out.push({
      source: s.source,
      roundId,
      roundLabel,
      matchKey: s.matchKey,
      position,
      home: takim.home || null,
      away: takim.away || null,
      kickoffAt: kickoffByMatch.get(s.matchKey) || null,
      dayKey: s.dayKey,
      weekday: weekdayOf(s.dayKey),
      pct: { '1': s.pct['1'], X: s.pct.X, '2': s.pct['2'] },
      sealedAt: new Date(s.at).toISOString(),
      result,
    });
  }
  return out;
}

// BANT GEÇMİŞİ SATIRLARI — Radar 3'ün "%70–79 aralığı geçmişte nasıl bitmiş?"
// istatistiği için. Radar, bandı KAYNAKLARIN UZLAŞMASI (ortalama) üzerinden
// hesapladığı için geçmiş satırlar da aynı yöntemle üretilir; yoksa ölçüt
// değişir ve kıyas bozulur.
// Maç başına TEK satır: her kaynağın SON mühürlü günü alınır, ortalanır,
// en yüksek seçenek favori sayılır. Sonucu olmayan maç satır üretmez.
export function buildBandHistoryRows(records) {
  const byMatch = new Map();
  for (const r of records || []) {
    if (!r?.result || !validPct(r.pct)) continue;
    const mk = `${r.roundId}|${r.matchKey}`;
    if (!byMatch.has(mk)) byMatch.set(mk, { result: r.result, bySource: new Map() });
    const grup = byMatch.get(mk);
    const onceki = grup.bySource.get(r.source);
    // Kaynağın SON mühürlü günü (gün anahtarı en büyük olan).
    if (!onceki || String(r.dayKey) > String(onceki.dayKey)) grup.bySource.set(r.source, r);
  }

  const rows = [];
  for (const grup of byMatch.values()) {
    const list = [...grup.bySource.values()];
    if (!list.length) continue;
    const ort = {};
    for (const k of ['1', 'X', '2']) {
      ort[k] = list.reduce((s, r) => s + r.pct[k], 0) / list.length;
    }
    const top = ['1', 'X', '2'].reduce((a, b) => (ort[b] > ort[a] ? b : a), '1');
    rows.push({
      favoritePct: Math.round(ort[top] * 10) / 10,
      favoriteSymbol: top,
      officialResult: grup.result,
    });
  }
  return rows;
}

// --- Arşivden toplama (I/O) + kısa ömürlü bellek önbelleği -----------------
let memo = { at: 0, key: null, records: null };
const MEMO_TTL_MS = 5 * 60e3;

export function _resetPlayedDnaMemo() { memo = { at: 0, key: null, records: null }; }

// Geçmiş turların tüm günlük DNA kayıtlarını toplar.
//
// İKİ SINIR birlikte uygulanır:
//   • ALT SINIR (startRoundId) — arşiv 51. haftada (1525) başlar. Öncesinde
//     günlük oynanma gözlemi toplanmadı; o turlar hiç okunmaz.
//   • ÜST SINIR (beforeRoundId) — arşiv, ANALİZ EDİLEN HAFTADAN ÖNCESİDİR.
//     Yalnız "güncel turu dışla" demek yetmez: geçmiş bir haftaya bakarken
//     ondan SONRAKİ haftalar da arşive girer ve gelecekten bilgi sızardı.
//
// Böylece sıra doğal olarak şöyle işler:
//   52. hafta analiz edilir → arşiv: 51
//   53. hafta analiz edilir → arşiv: 51 + 52
//   51. hafta analiz edilir → arşiv boş (öncesi yok) — DNA gösterilmez.
export async function collectPlayedDnaRecords(store, {
  maxRounds = DEFAULT_MAX_ROUNDS, beforeRoundId = null, now = Date.now(), force = false,
  startRoundId = DNA_START_ROUND_ID,
} = {}) {
  const key = `${maxRounds}|${beforeRoundId ?? ''}|${startRoundId}`;
  if (!force && memo.records && memo.key === key && now - memo.at < MEMO_TTL_MS) {
    return memo.records;
  }
  // DİKKAT: Number(null) === 0 ve 0 sonlu bir sayıdır. Doğrudan Number(...)
  // kullanılırsa "üst sınır yok" hâli üst sınır 0 sanılır ve TÜM turlar elenir.
  const ust = beforeRoundId == null || beforeRoundId === '' ? null : Number(beforeRoundId);
  const bulletins = await store.listBulletins();
  const ordered = (bulletins || [])
    .filter((b) => {
      if (!b) return false;
      const n = Number(b.roundId ?? b.id);
      if (!Number.isFinite(n)) return false;
      if (startRoundId && n < startRoundId) return false;                 // 51. haftadan önce: yok
      if (ust != null && Number.isFinite(ust) && n >= ust) return false;  // analiz edilen hafta ve sonrası: yok
      return true;
    })
    .slice(0, maxRounds);

  const records = [];
  for (const b of ordered) {
    const bulletinId = b.id ?? b.bulletinId;
    const roundId = b.roundId ?? bulletinId;
    try {
      const [observations, results, matches] = await Promise.all([
        store.listObservations(bulletinId),
        store.listOfficialResults(bulletinId),
        store.getMatches(bulletinId),
      ]);
      // Sonucu hiç olmayan tur (henüz oynanmamış) kayıt üretmez.
      if (!results?.length) continue;
      records.push(...buildRoundDnaRecords({
        roundId, roundLabel: b.week ?? b.round ?? null, observations, results, matches,
      }));
    } catch {
      // Tek tur okunamazsa DNA tümüyle çökmemeli — o tur atlanır.
      continue;
    }
  }
  memo = { at: now, key, records };
  return records;
}
