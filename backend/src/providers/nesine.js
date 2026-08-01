// NESİNE OYNANMA YÜZDESİ ADAPTÖRÜ — GERÇEK açık/anonim resmî veri yolu.
// ---------------------------------------------------------------------------
// DOĞRULANMIŞ KAYNAK (22 Tem 2026, kimlik/oturum/çerez YOK, HTTP 200):
//   GET https://st.nesine.com/v2/Program
//     → { sc:200, d:{ matches:[{ matchNo, homeTeam, awayTeam, eventDateEpoch,
//         percentage1, percentage0, percentage2, mid, ... }] } }
// * ANONİM: kullanıcı/giriş/çerez GEREKMEZ (kullanıcı Power Query'de de böyle çeker).
// * percentage1 → 1 (ev), percentage0 → X (beraberlik), percentage2 → 2 (deplasman).
// * Captcha/giriş/koruma atlatma YOK; sitenin kendi açık ucu; makul hız (oturumsuz).
// * OYNANMA YÜZDESİ ≠ ORAN — kullanıcının kupon TERCİH yüzdesidir.
// * Bülten eşleştirme + belirsizlik reddi Bilyoner adaptörüyle ORTAK
//   (matchEventToBulletin) — yanlış maça yüzde ASLA bağlanmaz; eşleşmeyen düşer.
import { createHash } from 'node:crypto';
import { matchEventToBulletin, assertAsciiHeaders } from './bilyoner.js';

export const NESINE_PARSER_VERSION = 'nesine-1.0.0';
export const NESINE_SOURCE_TYPE = 'nesine-sto-v2';
const BASE = 'https://st.nesine.com';
const PROGRAM_URL = `${BASE}/v2/Program`;
const UA = 'Mozilla/5.0 (compatible; SporTotoAnalyzer/1.0)'; // dürüst kimlik (tarayıcı taklidi değil)

const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Ham /v2/Program yanıtını normalize et (saf, test edilebilir).
export function parseNesineProgram(json) {
  const matches = json?.d?.matches;
  if (!Array.isArray(matches)) return null;
  return {
    programNo: json.d.pNo ?? json.d.id ?? null,
    events: matches.map((m) => ({
      eventNo: num(m.matchNo),
      home: m.homeTeam || null,
      away: m.awayTeam || null,
      // eventDateEpoch ms cinsinden; yoksa "dd.MM.yyyy HH:mm" alanları yedek.
      eventDate: m.eventDateEpoch ? new Date(Number(m.eventDateEpoch)).toISOString() : null,
      sourceMatchId: m.mid != null ? String(m.mid) : null,
      pct: { home: num(m.percentage1), draw: num(m.percentage0), away: num(m.percentage2) },
    })),
  };
}

// GÜVENLİ HTTP: anonim (credentials:'omit'), zaman aşımlı, dürüst hata raporu.
async function getJson(url, { timeoutMs = 10000, fetchImpl = fetch } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = assertAsciiHeaders({
      accept: 'application/json, text/plain, */*',
      'user-agent': UA,
      'accept-language': 'tr',
    });
    const r = await fetchImpl(url, { credentials: 'omit', redirect: 'follow', headers, signal: ctrl.signal });
    if (!r.ok) {
      let reason = '';
      try { reason = (await r.text()).slice(0, 80); } catch { /* gövde okunamadı */ }
      throw new Error(`HTTP ${r.status}${reason ? ` — kaynak yanıtı: ${reason}` : ''}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// --- ADAPTÖR SÖZLEŞMESİ: fetchPercentages(bulletinData) → satırlar ------------
// Dönen satır Bilyoner ile AYNI şema (playedPercentages ortak işler): { matchKey,
//   matchNo, pct:{'1','X','2'}, sourceMatchId, providerHome/Away, matchedBy, ... }.
// Eşleşmeyen event listeden DÜŞER; yüzdesi başka maça verilmez.
export function buildNesineAdapter({ fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  return {
    id: 'nesine',
    name: 'Nesine',
    enabled: true,               // GERÇEK açık/anonim kaynak DOĞRULANDI (22 Tem 2026).
    sourceUrl: PROGRAM_URL,
    sourceType: NESINE_SOURCE_TYPE,
    parserVersion: NESINE_PARSER_VERSION,
    note: 'Açık/anonim Spor Toto oynanma yüzdesi (st.nesine.com/v2/Program).',

    async fetchProgram() { return parseNesineProgram(await getJson(PROGRAM_URL, { timeoutMs, fetchImpl })); },

    async fetchPercentages(bulletinData, { now = Date.now() } = {}) {
      const program = await this.fetchProgram();
      if (!program?.events?.length) throw new Error('Nesine programı alınamadı (maç yok).');
      const bulletinMatches = bulletinData?.matches || [];
      const fetchedAt = new Date(now).toISOString();
      const rows = [];
      const unmatched = [];
      for (const ev of program.events) {
        const pr = ev.pct;
        if (pr.home == null || pr.draw == null || pr.away == null) continue; // yüzdesi eksik
        const m = matchEventToBulletin(ev, bulletinMatches, { now });
        if (!m.matched) {
          unmatched.push({ eventNo: ev.eventNo, home: ev.home, away: ev.away, reason: m.reason, candidateCount: m.candidateCount });
          continue;
        }
        // Bülten ev/dep ters listelediyse yüzdeleri de çevir.
        const pct = m.matched.swapped
          ? { '1': pr.away, X: pr.draw, '2': pr.home }
          : { '1': pr.home, X: pr.draw, '2': pr.away };
        rows.push({
          matchKey: m.matched.matchKey,
          matchNo: m.matched.bulletinPosition,
          pct,
          sourceMatchId: ev.sourceMatchId,
          providerHome: ev.home, providerAway: ev.away,
          bulletinHome: m.matched.bulletinHome, bulletinAway: m.matched.bulletinAway,
          position: ev.eventNo,
          matchedBy: m.matched.matchedBy,
          matchConfidence: m.matched.matchConfidence,
          sourceType: NESINE_SOURCE_TYPE,
          parserVersion: NESINE_PARSER_VERSION,
          observedAt: fetchedAt,
          fetchedAt,
          rawHash: sha({ p: program.programNo, e: ev.eventNo, pct: [pr.home, pr.draw, pr.away] }),
        });
      }
      if (unmatched.length) rows._unmatched = unmatched;
      return rows;
    },
  };
}

export const nesineAdapter = buildNesineAdapter();
