// CANLI OLAY ŞERİDİ + BASKI GÖSTERGESİ — saf mantık (RN bağımlılığı YOK, testli).
//
// DÜRÜSTLÜK KURALLARI
//   • Buradaki her sayı, backend'den gelen GERÇEK API-Football olay/istatistik
//     verisinden türetilir. Veri yoksa null döner — uydurma dakika, uydurma
//     baskı yüzdesi ASLA üretilmez.
//   • Baskı göstergesi bir TAHMİN DEĞİLDİR; yalnız o an mevcut istatistiklerin
//     (şut, korner, topla oynama...) ikili payıdır. Sonuç iddiası içermez.
//   • Zaman çizelgesi yalnız GÖRSELDİR; resmi sonuç yalnız Spor Toto'dan gelir.

export const REG_MINUTES = 90;      // normal süre
export const HALF_MINUTES = 45;     // devre arası çizgisi

const KIND_BY_TYPE = { goal: 'goal', card: 'card', subst: 'sub', var: 'var' };

// Tek olayı normalize et. Tanınmayan/dakikasız olay ATILIR (uydurma yok).
export function normalizeEvent(e) {
  if (!e) return null;
  const minute = Number.isFinite(Number(e.minute)) ? Number(e.minute) : null;
  if (minute == null) return null;
  const extra = Number.isFinite(Number(e.extra)) ? Number(e.extra) : 0;
  const type = String(e.type || '').toLowerCase();
  const detail = String(e.detail || '');
  const dl = detail.toLowerCase();
  let kind = KIND_BY_TYPE[type] || null;
  if (!kind) return null;
  if (kind === 'card') kind = dl.includes('red') ? 'red' : 'yellow';
  // İptal edilen gol (VAR) gol sayılmaz — resmi skorla çelişmemeli.
  if (kind === 'goal' && (dl.includes('cancelled') || dl.includes('disallowed'))) return null;
  const side = e.side === 'home' || e.side === 'away' ? e.side : null;
  return {
    minute, extra, kind, detail, side,
    penalty: kind === 'goal' && dl.includes('penalty'),
    ownGoal: kind === 'goal' && dl.includes('own'),
    player: e.player || null,
    assist: e.assist || null,
    at: minute + extra,                       // sıralama anahtarı
  };
}

// Olay listesini normalize + dakikaya göre sırala.
export function normalizeEvents(events) {
  return (events || [])
    .map(normalizeEvent)
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
}

// Şeritte GÖSTERİLECEK olaylar: gol + kırmızı kart (şeridi kalabalıklaştıran
// sarı kart/değişiklik listede kalır, şeritte gösterilmez).
const STRIP_KINDS = new Set(['goal', 'red']);

// Dakikayı 0..1 aralığına oturt. Uzatma dakikaları (90+) sona sıkıştırılır.
export function positionOf(minute, extra = 0, maxMinute = REG_MINUTES) {
  const m = Math.max(0, Number(minute) || 0);
  const cap = Math.max(REG_MINUTES, maxMinute);
  const raw = extra > 0 ? Math.min(m + extra, cap) : Math.min(m, cap);
  return Math.max(0, Math.min(1, raw / cap));
}

// Şerit için işaretçiler. Aynı dakikadaki iki olay üst üste binmesin diye
// hafif kaydırma bilgisi (slot) verilir.
export function timelineMarkers(events, { maxMinute = REG_MINUTES } = {}) {
  const evs = normalizeEvents(events).filter((e) => STRIP_KINDS.has(e.kind));
  if (!evs.length) return [];
  const cap = Math.max(REG_MINUTES, maxMinute, ...evs.map((e) => e.at));
  const seen = new Map();
  return evs.map((e) => {
    const key = `${e.side || '?'}:${Math.round(e.at / 3)}`;   // ~3 dk'lık kova
    const slot = seen.get(key) || 0;
    seen.set(key, slot + 1);
    return { ...e, pos: positionOf(e.minute, e.extra, cap), slot };
  });
}

// Gol zaman çizelgesi: her golden sonraki KOŞAN SKOR. Kendi kalesine goller
// karşı takıma yazılır (API 'Own Goal' detayını verdiğinde).
export function goalProgression(events) {
  const out = [];
  let h = 0, a = 0;
  for (const e of normalizeEvents(events)) {
    if (e.kind !== 'goal' || !e.side) continue;
    const scoring = e.ownGoal ? (e.side === 'home' ? 'away' : 'home') : e.side;
    if (scoring === 'home') h += 1; else a += 1;
    out.push({ minute: e.minute, extra: e.extra, side: scoring, home: h, away: a, player: e.player, penalty: e.penalty, ownGoal: e.ownGoal });
  }
  return out;
}

// —————————————————————————————————————————————————————————————
// BASKI GÖSTERGESİ
// Yalnız aşağıdaki gerçek istatistikler kullanılır. En az 2 tanesi yoksa
// gösterge HİÇ üretilmez (null) — yarım veriyle "baskı" iddia edilmez.
export const PRESSURE_STATS = [
  { type: 'Total Shots', label: 'Şut', weight: 1 },
  { type: 'Shots on Goal', label: 'İsabetli şut', weight: 1.5 },
  { type: 'Corner Kicks', label: 'Korner', weight: 0.75 },
  { type: 'Ball Possession', label: 'Topla oynama', weight: 0.75 },
  { type: 'Dangerous Attacks', label: 'Tehlikeli atak', weight: 1.25 },
];

const numOrNull = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
};

export function pressureIndex(stats) {
  const rows = [];
  for (const def of PRESSURE_STATS) {
    const row = (stats || []).find((s) => s && s.type === def.type);
    if (!row) continue;
    const h = numOrNull(row.home);
    const a = numOrNull(row.away);
    if (h == null || a == null) continue;
    if (h + a <= 0) continue;                     // 0-0 veri taşımaz
    rows.push({ label: def.label, weight: def.weight, home: h, away: a, share: h / (h + a) });
  }
  if (rows.length < 2) return null;               // yetersiz veri → gösterge yok
  const wsum = rows.reduce((t, r) => t + r.weight, 0);
  const homeShare = rows.reduce((t, r) => t + r.share * r.weight, 0) / wsum;
  const home = Math.round(homeShare * 100);
  return { home, away: 100 - home, basis: rows.map((r) => r.label), rows };
}

// İSTATİSTİK ÖNCELİĞİ — yayında ilk bakışta görülmesi gerekenler üstte.
const STAT_ORDER = [
  'Ball Possession', 'Total Shots', 'Shots on Goal', 'expected_goals',
  'Corner Kicks', 'Dangerous Attacks', 'Fouls', 'Yellow Cards', 'Red Cards',
  'Goalkeeper Saves', 'Offsides', 'Passes %',
];

export function sortStats(stats) {
  const idx = (t) => { const i = STAT_ORDER.indexOf(t); return i === -1 ? STAT_ORDER.length : i; };
  return [...(stats || [])].sort((a, b) => idx(a?.type) - idx(b?.type));
}
