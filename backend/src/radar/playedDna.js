// OYNANMA DNA'SI — günlük mühürlü oynanma yüzdelerinin geçmiş sonuçlarla eşleşmesi.
// ---------------------------------------------------------------------------
// AMAÇ: "Bugünkü 1/X/2 dağılımına benzer dağılımlar geçmişte hangi sonuçlarla
// bitmiş?" sorusunu YALNIZ gerçek arşiv kayıtlarıyla yanıtlar.
//
// TASARIM KARARLARI (bilinçli):
//  1) Yalnız en çok oynanan seçenek değil, 1/X/2 dağılımının TAMAMI kıyaslanır.
//     Üç seçenek de toleransın içindeyse kayıt "benzer" sayılır.
//  2) Yakınlık KULLANICI SEÇİMİDİR: birebir / ±1 / ±2 / ±3. Otomatik genişleme
//     yoktur — seçilen aralık neyse o uygulanır. Tolerans havuzun tamamı için
//     tektir; gün ve sıra kırılımları aynı yakınlıkla hesaplanır.
//  3) KAYNAK ASLA KARIŞMAZ. Nesine geçmişi yalnız Nesine, Misli yalnız Misli.
//  4) Bu modül GÖSTERİM içindir; radar skorunu/yönünü beslemez. Bu yüzden
//     "n<10 ise sinyal yok" tipi eşik YOKTUR — 1 kayıt varsa 1 kayıt gösterilir.
//     Adet her zaman yüzdeyle birlikte verilir; "1 kayıtta" ifadesi örneklemi
//     zaten şeffaf biçimde bildirir. Olasılık iddiası ÜRETİLMEZ.
//  5) Alınmamış bir günün yüzdesi SONRADAN ÜRETİLMEZ (kayıt yoksa yoktur).
export const PLAYED_DNA_VERSION = 'played-dna-2.0.0';

// YAKINLIK FİLTRESİ — kullanıcı seçer, otomatik genişleme YOKTUR.
//   0 = birebir aynı · 1 = ±1 · 2 = ±2 · 3 = ±3 (tavan)
// Seçim tek değer olduğu için sonuç öngörülebilir: "±1 seçtim ama sistem ±3'e
// çıkmış" durumu oluşmaz.
export const TOLERANCE_FILTERS = [0, 1, 2, 3];
export const DEFAULT_TOLERANCE = 2;

// Geriye dönük uyumluluk: tek elemanlı liste = tam olarak o tolerans.
export const DNA_TOLERANCES = [DEFAULT_TOLERANCE];

// MAÇ filtreleri: null = tüm maçlar. Birim HAFTA DEĞİL, resmî sonucu açıklanmış
// MAÇTIR. Önce en yeni N farklı maç belirlenir, sonra o maçların günlük
// oynanma kayıtları karşılaştırılır.
export const MATCH_FILTERS = [null, 5, 10, 15];

export const DNA_EMPTY_MESSAGE = 'Bu dağılıma yakın geçmiş sonuç yok.';
export const DNA_BUCKET_EMPTY = 'Geçmiş sonuç yok';

// Sonuçların doğal Türkçe karşılığı (teknik kod yerine cümle).
const OUTCOME_WORDS = {
  '1': 'Ev sahibi kazandı', X: 'Berabere bitti', '2': 'Deplasman kazandı',
};

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// Dağılımın kısa yazımı: "1 %61 · X %23 · 2 %16"
export const pctText = (p) => (isValidDistribution(p)
  ? `1 %${Math.round(p['1'])} · X %${Math.round(p.X)} · 2 %${Math.round(p['2'])}`
  : null);

// Ekranda "hangi kayıtlar eşleşti?" sorusunu yanıtlayan künye listesi.
// Şeffaflık için: kullanıcı sayıya değil, GERÇEK maça bakabilmeli.
export const MAX_SAMPLES = 12;
function sampleOf(r) {
  const takim = r.home && r.away ? `${r.home} – ${r.away}` : `${r.position}. maç`;
  const gun = DAY_NAMES[r.weekday] || '';
  const yuzde = isValidDistribution(r.pct)
    ? `1 %${Math.round(r.pct['1'])} · X %${Math.round(r.pct.X)} · 2 %${Math.round(r.pct['2'])}`
    : null;
  return {
    roundId: r.roundId, roundLabel: r.roundLabel || null, position: r.position,
    home: r.home || null, away: r.away || null, dayKey: r.dayKey, weekday: r.weekday,
    pct: r.pct, result: r.result,
    text: [
      r.roundLabel || `Tur ${r.roundId}`,
      `${r.position}. sıra`,
      takim,
      gun,
      yuzde,
      `→ ${OUTCOME_WORDS[r.result] || r.result}`,
    ].filter(Boolean).join(' · '),
  };
}

const KEYS = ['1', 'X', '2'];
const numOf = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Bir dağılımın üç değeri de sayı mı?
export function isValidDistribution(p) {
  return !!p && KEYS.every((k) => numOf(p[k]) != null);
}

// BENZERLİK: üç seçenek de tolerans içinde olmalı. Biri bile dışarıdaysa
// kayıt benzer DEĞİLDİR (yalnız favoriye bakmak yanıltıcı olurdu).
export function isSimilarDistribution(current, other, tol) {
  if (!isValidDistribution(current) || !isValidDistribution(other)) return false;
  return KEYS.every((k) => Math.abs(current[k] - other[k]) <= tol);
}

// Yüzdeler adetten türetilir ve toplamı 100'e tamamlanır (en büyük kalan
// yöntemi). Adet zaten gösterildiği için bu yalnız görsel tutarlılıktır.
function pctFromCounts(counts, total) {
  if (!total) return { '1': 0, X: 0, '2': 0 };
  const raw = KEYS.map((k) => ({ k, exact: (counts[k] / total) * 100 }));
  const out = {};
  let used = 0;
  for (const r of raw) { out[r.k] = Math.floor(r.exact); used += out[r.k]; }
  const rest = raw
    .map((r) => ({ k: r.k, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac);
  let left = 100 - used;
  for (let i = 0; i < rest.length && left > 0; i += 1, left -= 1) out[rest[i].k] += 1;
  return out;
}

// Bir kayıt listesini adet + yüzde özetine ve DOĞAL TÜRKÇE cümleye çevirir.
// Güven seviyesi / n= / örneklem uyarısı ÜRETİLMEZ. Sonucu olmayan yön
// GÖSTERİLMEZ ("2: 0 (%0)" gibi gereksiz bilgi kullanıcıyı yorar).
export function summarize(list) {
  const counts = { '1': 0, X: 0, '2': 0 };
  for (const r of list || []) {
    if (r?.result && counts[r.result] != null) counts[r.result] += 1;
  }
  const total = counts['1'] + counts.X + counts['2'];
  const pct = pctFromCounts(counts, total);

  let text = DNA_BUCKET_EMPTY;
  if (total) {
    const present = KEYS.filter((k) => counts[k] > 0);
    text = present.length === 1
      // Tek yönde toplanmış: kod yerine cümle → "Deplasman kazandı (%100)"
      ? `${total} benzer kayıt → ${OUTCOME_WORDS[present[0]]} (%100)`
      // Birden çok yön: yalnız sonucu OLAN yönler listelenir.
      : `${total} benzer kayıt → ${present.map((k) => `${k}: %${pct[k]}`).join(' · ')}`;
  }
  return { total, counts, pct, text };
}

// Hareketin sözle anlatımı: "1 yükseldi · X değişmedi · 2 düştü".
// 1 puandan küçük oynamalar "değişmedi" sayılır (gürültü sinyal değildir).
export function movementWords(delta) {
  if (!isValidDistribution(delta)) return null;
  return KEYS
    .map((k) => `${k} ${delta[k] >= 1 ? 'yükseldi' : delta[k] <= -1 ? 'düştü' : 'değişmedi'}`)
    .join(' · ');
}

// Bir kaydın ait olduğu MAÇ kimliği (aynı maçın farklı günleri aynı kimlik).
export const matchIdOf = (r) => `${r?.roundId}|${r?.matchKey ?? r?.position}`;

// EN YENİ N SONUÇLANMIŞ MAÇ penceresi.
// ÖNEMLİ: Pencere TÜM KAYNAKLAR için ORTAK hesaplanır (kaynak süzmesinden
// ÖNCE). Böylece Nesine ve Misli aynı maç penceresini kullanır. Bir kaynakta o
// maçın kaydı yoksa boşluk daha eski bir maçla DOLDURULMAZ — o kaynak için
// yalnız daha az kayıt görünür.
// Yenilik ölçütü: maçın başlama saati (sonuç maçtan sonra kesinleşir).
export function matchWindow(records, limit) {
  if (!limit) return null;                        // null = tüm maçlar
  const seen = new Map();
  for (const r of records || []) {
    const id = matchIdOf(r);
    const t = r?.kickoffAt ? Date.parse(r.kickoffAt) : NaN;
    const at = Number.isFinite(t) ? t : -Infinity;
    const prev = seen.get(id);
    if (!prev || at > prev.at) seen.set(id, { at, roundId: r?.roundId });
  }
  const ordered = [...seen.entries()].sort((a, b) => {
    if (b[1].at !== a[1].at) return b[1].at - a[1].at;
    return Number(b[1].roundId) - Number(a[1].roundId);   // eşitlikte yeni tur önce
  });
  return new Set(ordered.slice(0, limit).map(([id]) => id));
}

// ---------------------------------------------------------------------------
// ANA SORGU — güncel dağılıma benzer geçmiş günlük kayıtlar.
// records: [{ source, roundId, position, weekday, dayKey, pct:{'1','X','2'}, result }]
//   • Aynı geçmiş maçın çarşamba ve perşembe kaydı İKİ AYRI kayıttır (tasarım).
//   • result = resmî 90 dk sonucu; sonucu olmayan kayıt hesaba girmez.
// query: { current, source, position, weekday, weeks }
// ---------------------------------------------------------------------------
export function findPlayedDna(records, {
  current, source, position, weekday, matchLimit = null,
  tolerances = DNA_TOLERANCES,
} = {}) {
  const empty = {
    version: PLAYED_DNA_VERSION,
    hasData: false,
    tolerance: null,
    matchLimit: matchLimit ?? null,
    message: DNA_EMPTY_MESSAGE,
    overall: summarize([]),
    byDay: { selected: summarize([]), others: summarize([]) },
    byPosition: { own: summarize([]), rest: summarize([]) },
  };
  if (!isValidDistribution(current) || !source) return empty;

  // 1) Önce sonucu bağlanmış geçerli kayıtlar (TÜM kaynaklar) — maç penceresi
  //    buradan hesaplanır ki kaynaklar aynı pencereyi kullansın.
  const settled = (records || []).filter((r) => r
    && r.result && KEYS.includes(r.result)         // resmî sonucu bağlanmış
    && isValidDistribution(r.pct));
  const win = matchWindow(settled, matchLimit);

  // 2) Sonra kaynağa süz. Pencerede o kaynağın kaydı yoksa boşluk DOLDURULMAZ.
  const pool = settled.filter((r) => r.source === source && (!win || win.has(matchIdOf(r))));

  // 2) Tolerans seçimi: önce ±2, boşsa ±3 (tavan). Havuzun tamamı için TEK karar.
  let tolerance = null;
  let matched = [];
  for (const tol of tolerances) {
    const hit = pool.filter((r) => isSimilarDistribution(current, r.pct, tol));
    if (hit.length) { tolerance = tol; matched = hit; break; }
  }
  if (!matched.length) return empty;

  // 3) İki ayrı 2'li kırılım (çaprazlanmaz — spec gereği ayrı ayrı sunulur).
  const selectedDay = matched.filter((r) => r.weekday === weekday);
  const otherDays = matched.filter((r) => r.weekday !== weekday);
  const ownPos = matched.filter((r) => r.position === position);
  const restPos = matched.filter((r) => r.position !== position);

  return {
    version: PLAYED_DNA_VERSION,
    hasData: true,
    tolerance,
    matchLimit: matchLimit ?? null,
    matched: matched.length,
    // Pencerede gerçekten kaç farklı maç kullanıldı (12 tamamlandıysa 15 değil 12).
    matchesUsed: new Set(matched.map(matchIdOf)).size,
    message: null,
    // TOPLAM — eşleşen tüm kayıtlar. Aşağıdaki iki kırılım bu AYNI kayıtların
    // iki farklı görünümüdür (toplanmaz). Toplam gösterilmezse kullanıcı
    // "2 kayıt vardı, neden 1 yazıyor?" diye haklı olarak şüpheye düşer.
    overall: summarize(matched),
    byDay: { selected: summarize(selectedDay), others: summarize(otherDays) },
    byPosition: { own: summarize(ownPos), rest: summarize(restPos) },
    // HANGİ kayıtlar eşleşti — kullanıcı sayıya değil gerçek maça bakabilsin.
    samples: matched
      .slice()
      .sort((a, b) => String(b.dayKey).localeCompare(String(a.dayKey)))
      .slice(0, MAX_SAMPLES)
      .map(sampleOf),
  };
}

// ---------------------------------------------------------------------------
// HAREKET DNA'SI — yüzdelerin günler içindeki değişimi.
// 1, X ve 2 BİRLİKTE ele alınır. En az İKİ gerçek günlük kayıt gerekir.
// Eksik gün için veri ÜRETİLMEZ; yalnız mevcut gerçek günler kıyaslanır.
// ---------------------------------------------------------------------------
// daySeries: [{ weekday, dayKey, pct }] — yalnız gerçekten kaydı olan günler.
export function movementOf(daySeries) {
  const days = (daySeries || [])
    .filter((d) => isValidDistribution(d?.pct))
    .slice()
    .sort((a, b) => String(a.dayKey).localeCompare(String(b.dayKey)));
  if (days.length < 2) return null;              // tek gün → hareket YOK
  const first = days[0], last = days[days.length - 1];
  const delta = {};
  for (const k of KEYS) delta[k] = Math.round((last.pct[k] - first.pct[k]) * 10) / 10;
  // Eşleşme YÜZDE üzerinden yapılır: ilk günün ve son günün dağılımı taşınır.
  // Yalnız delta ile eşleştirmek yanlıştı — "1 yükseldi" gibi kaba bir kalıp,
  // tamamen farklı tabloları (ör. %22-28-50 ile %61-23-16) benzer sayıyordu.
  return {
    delta,
    openPct: { ...first.pct },
    closePct: { ...last.pct },
    fromDayKey: first.dayKey, toDayKey: last.dayKey, dayCount: days.length,
  };
}

// Günlük kayıtlardan geçmiş hareket kayıtları üretir.
// Aynı (kaynak, tur, maç) için günler toplanır, ilk→son değişim hesaplanır.
export function buildMovementRecords(records) {
  const groups = new Map();
  for (const r of records || []) {
    if (!r || !isValidDistribution(r.pct)) continue;
    const key = `${r.source}|${r.roundId}|${r.matchKey ?? r.position}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const out = [];
  for (const list of groups.values()) {
    const mv = movementOf(list);
    if (!mv) continue;                            // <2 gün → kayıt üretilmez
    const any = list[0];
    if (!any.result || !KEYS.includes(any.result)) continue;
    out.push({
      source: any.source, roundId: any.roundId, position: any.position,
      // Maç penceresi + künye için gerekli alanlar taşınır.
      matchKey: any.matchKey ?? any.position, kickoffAt: any.kickoffAt ?? null,
      roundLabel: any.roundLabel ?? null, home: any.home ?? null, away: any.away ?? null,
      movement: mv.delta, openPct: mv.openPct, closePct: mv.closePct,
      dayCount: mv.dayCount, result: any.result,
    });
  }
  return out;
}

// Güncel hareketi geçmiş hareketlerle eşleştirir (aynı ±2 → ±3 mantığı).
// current: { openPct, closePct } — güncel maçın ilk ve son günkü dağılımı.
// EŞLEŞME YÜZDE ÜZERİNDEN: hem başlangıç hem bitiş dağılımı tolerans içinde
// olmalı. (Yalnız "yükseldi/düştü" yönüne bakmak anlamsız eşleşmeler üretiyordu.)
export function findMovementDna(movementRecords, {
  current, source, position, matchLimit = null, tolerances = DNA_TOLERANCES,
} = {}) {
  const empty = {
    version: PLAYED_DNA_VERSION,
    hasData: false, tolerance: null, matchLimit: matchLimit ?? null,
    message: DNA_EMPTY_MESSAGE,
    byPosition: { own: summarize([]), rest: summarize([]) },
    overall: summarize([]),
    samples: [],
  };
  const acilis = current?.openPct;
  const kapanis = current?.closePct;
  if (!isValidDistribution(acilis) || !isValidDistribution(kapanis) || !source) return empty;

  // Maç penceresi burada da TÜM kaynaklar üzerinden ortak belirlenir.
  const settled = (movementRecords || []).filter((r) => r
    && r.result && KEYS.includes(r.result)
    && isValidDistribution(r.openPct) && isValidDistribution(r.closePct));
  const win = matchWindow(settled, matchLimit);
  const pool = settled.filter((r) => r.source === source && (!win || win.has(matchIdOf(r))));

  let tolerance = null;
  let matched = [];
  for (const tol of tolerances) {
    const hit = pool.filter((r) => isSimilarDistribution(acilis, r.openPct, tol)
      && isSimilarDistribution(kapanis, r.closePct, tol));
    if (hit.length) { tolerance = tol; matched = hit; break; }
  }
  if (!matched.length) return empty;

  return {
    version: PLAYED_DNA_VERSION,
    hasData: true, tolerance, matchLimit: matchLimit ?? null, matched: matched.length,
    message: null,
    byPosition: {
      own: summarize(matched.filter((r) => r.position === position)),
      rest: summarize(matched.filter((r) => r.position !== position)),
    },
    overall: summarize(matched),
    // Eşleşen hareketlerin künyesi: hangi maç, değişim ne kadardı, nasıl bitti.
    samples: matched.slice(0, MAX_SAMPLES).map((r) => ({
      roundId: r.roundId, roundLabel: r.roundLabel || null, position: r.position,
      home: r.home || null, away: r.away || null,
      openPct: r.openPct, closePct: r.closePct, movement: r.movement, result: r.result,
      // Künye de yüzde gösterir: hangi tablodan hangi tabloya gitmiş.
      text: [
        r.roundLabel || `Tur ${r.roundId}`,
        `${r.position}. sıra`,
        r.home && r.away ? `${r.home} – ${r.away}` : null,
        `${pctText(r.openPct)} → ${pctText(r.closePct)}`,
        `→ ${OUTCOME_WORDS[r.result] || r.result}`,
      ].filter(Boolean).join(' · '),
    })),
  };
}
