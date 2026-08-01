// MİSLİ OYNANMA YÜZDESİ ADAPTÖRÜ — GERÇEK açık/anonim resmî veri yolu.
// ---------------------------------------------------------------------------
// DOĞRULANMIŞ KAYNAK (23 Tem 2026, kimlik/oturum/çerez YOK, HTTP 200):
//   GET https://apivx.misli.com/api/web/v1/sportoto/active
//     → { success, data: { draw: { drawNumber, events:[{ no, name:"Ev - Dep",
//         league, date }] }, playRatio: { events:[{ no, selections:[
//         { name:"0"|"1"|"2", ratio }] }] } } }
// * ANONİM: giriş/çerez GEREKMEZ. Tek koşul: User-Agent başlığı (yoksa origin 520).
// * selections.name → 1(ev)="1", X(beraberlik)="0", 2(deplasman)="2". DİZİ
//   SIRASINA GÜVENİLMEZ — name koduyla eşlenir. Yüzdeler tam sayı, toplam 100.
// * Tek REST çağrısında hem program hem oranlar (WebSocket GEREKMEZ).
// * OYNANMA YÜZDESİ ≠ ORAN — kullanıcının kupon TERCİH dağılımıdır.
// * Bülten eşleştirme + belirsizlik reddi Bilyoner/Nesine ile ORTAK
//   (matchEventToBulletin) — yanlış maça yüzde ASLA bağlanmaz.
import { createHash } from 'node:crypto';
import { matchEventToBulletin, assertAsciiHeaders } from './bilyoner.js';

export const MISLI_PARSER_VERSION = 'misli-1.0.0';
export const MISLI_SOURCE_TYPE = 'misli-sportoto-active';
const BASE = 'https://apivx.misli.com';
const PROGRAM_URL = `${BASE}/api/web/v1/sportoto/active`;
const UA = 'Mozilla/5.0 (compatible; SporTotoAnalyzer/1.0)'; // zorunlu (yoksa 520)

const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// "AGF Aarhus - Brondby" → { home, away } (ilk " - " ayırıcı).
function splitName(name) {
  const s = String(name || '');
  const i = s.indexOf(' - ');
  if (i > 0) return { home: s.slice(0, i).trim(), away: s.slice(i + 3).trim() };
  const j = s.indexOf('-');
  if (j > 0) return { home: s.slice(0, j).trim(), away: s.slice(j + 1).trim() };
  return { home: null, away: null };
}

// Ham /sportoto/active yanıtını normalize et (saf, test edilebilir).
export function parseMisliProgram(json) {
  const draw = json?.data?.draw;
  const events = draw?.events;
  if (!Array.isArray(events)) return null;
  // playRatio: no → { home('1'), draw('0'), away('2') } — name koduyla, sıraya güvenmeden.
  const ratioByNo = new Map();
  for (const pe of (json?.data?.playRatio?.events || [])) {
    const sel = {};
    for (const s of (pe?.selections || [])) sel[String(s.name)] = num(s.ratio);
    ratioByNo.set(Number(pe.no), { home: sel['1'], draw: sel['0'], away: sel['2'] });
  }
  return {
    drawNumber: draw.drawNumber ?? null,
    events: events.map((e) => {
      const { home, away } = splitName(e.name);
      return {
        eventNo: num(e.no),
        home,
        away,
        eventDate: e.date ? new Date(Number(e.date)).toISOString() : null,
        sourceMatchId: e.no != null ? String(e.no) : null,
        pct: ratioByNo.get(Number(e.no)) || { home: null, draw: null, away: null },
      };
    }),
  };
}

// GÜVENLİ HTTP: anonim (credentials:'omit'), zaman aşımlı, dürüst hata raporu.
async function getJson(url, { timeoutMs = 10000, fetchImpl = fetch } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = assertAsciiHeaders({
      accept: 'application/json, text/plain, */*',
      'user-agent': UA,          // zorunlu — yoksa origin 520
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

export function buildMisliAdapter({ fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  return {
    id: 'misli',
    name: 'Misli',
    enabled: true,               // GERÇEK açık/anonim kaynak DOĞRULANDI (23 Tem 2026).
    sourceUrl: PROGRAM_URL,
    sourceType: MISLI_SOURCE_TYPE,
    parserVersion: MISLI_PARSER_VERSION,
    note: 'Açık/anonim Spor Toto oynanma yüzdesi (apivx.misli.com/sportoto/active).',

    async fetchProgram() { return parseMisliProgram(await getJson(PROGRAM_URL, { timeoutMs, fetchImpl })); },

    async fetchPercentages(bulletinData, { now = Date.now() } = {}) {
      const program = await this.fetchProgram();
      if (!program?.events?.length) throw new Error('Misli programı alınamadı (maç yok).');
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
          sourceType: MISLI_SOURCE_TYPE,
          parserVersion: MISLI_PARSER_VERSION,
          observedAt: fetchedAt,
          fetchedAt,
          rawHash: sha({ d: program.drawNumber, e: ev.eventNo, pct: [pr.home, pr.draw, pr.away] }),
        });
      }
      if (unmatched.length) rows._unmatched = unmatched;
      return rows;
    },
  };
}

export const misliAdapter = buildMisliAdapter();
