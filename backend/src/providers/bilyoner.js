// BİLYONER OYNANMA YÜZDESİ ADAPTÖRÜ — GERÇEK açık/oturumsuz resmî veri yolu.
// ---------------------------------------------------------------------------
// DOĞRULANMIŞ KAYNAK (22 Tem 2026, credentials:'omit' ile HTTP 200):
//   GET https://www.bilyoner.com/api/sto/programs/active
//     → { gameCycleEntityModel: { gcNo, weekNumberText, payinEndDate,
//         eventVOs:[{ eventNo, eventDescription:"Ev-Dep", eventDate, ... }] } }
//   GET https://www.bilyoner.com/api/sto/playratio?gcNo=<gcNo>
//     → { playRatioList:[{ eventNo, count_1, count_0, count_2 }] }
// * OTURUMSUZ: çerez/oturum/kullanıcı belirteci GEREKMEZ (public game-code veri).
// * gcNo DİNAMİK keşfedilir (programs/active) — sabit kodlanmaz.
// * count_1 → 1 (ev), count_0 → X (beraberlik), count_2 → 2 (deplasman).
// * Captcha/giriş/koruma atlatma YOK; yalnız sitenin kendi açık uçları; makul hız.
// * OYNANMA YÜZDESİ ≠ ORAN. Bu uç kullanıcı TERCİH yüzdesidir (kupon dağılımı).
import { createHash } from 'node:crypto';
import { normalizeName } from '../matcher.js';

export const BILYONER_PARSER_VERSION = 'bilyoner-1.0.0';
export const BILYONER_SOURCE_TYPE = 'bilyoner-sto-webapi';
const BASE = 'https://www.bilyoner.com';
const PROGRAM_URL = `${BASE}/api/sto/programs/active`;
const PLAYRATIO_URL = (gcNo) => `${BASE}/api/sto/playratio?gcNo=${encodeURIComponent(gcNo)}`;
// HTTP header degerleri YALNIZ ASCII olmali (fetch/undici ByteString kurali:
// >255 kod noktasi "Cannot convert argument to a ByteString" hatasi verir).
// Onceki UA'daki Turkce 'ı' (U+0131=305, indeks 60) tam bu hatayi uretiyordu.
// Turkce/Unicode YALNIZ veri katmaninda serbesttir (takim adlari aynen korunur);
// protokol basliklari saf ASCII tutulur.
const UA = 'Mozilla/5.0 (compatible; SporTotoAnalyzer/1.0)';
const DAY = 24 * 3600e3;

// ---------------------------------------------------------------------------
// HEADER ASCII KORUMASI — gonderim ONCESI dogrulama (sessiz donusturme YOK).
// Printable ASCII (0x20-0x7E) disinda karakter varsa istek HIC gonderilmez;
// anlasilir teknik hata uretilir: alan adi + indeks + unicode kodu. Header
// DEGERI hataya yazilmaz (cookie/token sizintisi olmamasi icin) — zaten bu
// adaptorde gizli deger yoktur ama koruma geneldir.
// ---------------------------------------------------------------------------
export function assertAsciiHeaders(headers) {
  for (const [name, value] of Object.entries(headers || {})) {
    for (const [label, s] of [['header adi', String(name)], ['header degeri', String(value)]]) {
      for (let i = 0; i < s.length; i++) {
        const code = s.codePointAt(i);
        if (code < 0x20 || code > 0x7e) {
          throw new Error(
            `HTTP ${label} ASCII disi: alan "${name}", indeks ${i}, unicode ${code} — istek gonderilmedi.`,
          );
        }
      }
    }
  }
  return headers;
}

const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

// --- Yüzde ayrıştırma: sayı | "57,4" | "%57.4" | "57.4%" hepsini okur. -------
export function parsePct(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace('%', '').replace(',', '.').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// --- eventDescription → { home, away } (ev-dep) ------------------------------
// "eventDescriptionFormatted" varsa ("Ev\nDep") satır ayırıcı KESİN; yoksa
// "eventDescription" ("Ev-Dep") ilk '-' ile ayrılır (takım adında '-' beklenmez;
// belirsizlikte eşleştirme zaten iki-taraf normalize + tarih ile korunur).
export function splitTeams(ev) {
  const fmt = ev?.eventDescriptionFormatted;
  if (fmt && fmt.includes('\n')) {
    const [h, a] = fmt.split('\n');
    if (h && a) return { home: h.trim(), away: a.trim() };
  }
  const desc = ev?.eventDescription || '';
  const i = desc.indexOf('-');
  if (i > 0 && i < desc.length - 1) {
    return { home: desc.slice(0, i).trim(), away: desc.slice(i + 1).trim() };
  }
  return { home: null, away: null };
}

// --- Ham API yanıtlarını normalize et (saf, test edilebilir) -----------------
export function parseProgram(programJson) {
  const gc = programJson?.gameCycleEntityModel;
  if (!gc || !Array.isArray(gc.eventVOs)) return null;
  return {
    gcNo: gc.gcNo ?? null,
    weekText: gc.weekNumberText ?? null,
    payinEndDate: gc.payinEndDate ?? null,     // = donma referansı (19:55 kapanış)
    events: gc.eventVOs.map((ev) => {
      const { home, away } = splitTeams(ev);
      return {
        eventNo: ev.eventNo, home, away,
        competitionName: ev.competitionName ?? null,
        eventDate: ev.eventDate ?? null,
        sourceMatchId: ev.id != null ? String(ev.id) : null,
      };
    }),
  };
}

export function parsePlayRatios(playratioJson) {
  const list = playratioJson?.playRatioList;
  if (!Array.isArray(list)) return new Map();
  const byEvent = new Map();
  for (const r of list) {
    if (r?.eventNo == null) continue;
    byEvent.set(Number(r.eventNo), {
      // count_1 → ev(1), count_0 → beraberlik(X), count_2 → deplasman(2)
      home: parsePct(r.count_1), draw: parsePct(r.count_0), away: parsePct(r.count_2),
    });
  }
  return byEvent;
}

// --- GÜVENLİ HTTP: oturumsuz, zaman aşımlı, tek tekrarlı (kaynağa nazik) ------
async function getJson(url, { timeoutMs = 10000, fetchImpl = fetch } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Yalnizca gercekten gereken, SAF ASCII basliklar (ByteString guvenli).
    const headers = assertAsciiHeaders({
      accept: 'application/json, text/plain, */*',
      'user-agent': UA,
      'accept-language': 'tr',
      referer: `${BASE}/spor-toto`,
    });
    const r = await fetchImpl(url, {
      // OTURUMSUZ: çerez gönderilmez/alınmaz — kullanıcı hesabıyla ilişkilendirilemez.
      credentials: 'omit',
      redirect: 'follow',
      headers,
      signal: ctrl.signal,
    });
    if (!r.ok) {
      // Kaynak sunucu isteği reddetti. Bilyoner API'si sunucu tarafı (tarayıcı
      // dışı) isteklere erişim korumasıyla 400/40319 dönebilir; bu DURUMU dürüst
      // raporlarız — koruma AŞILMAZ. Gövde başı yalnız teşhis içindir (gizli veri
      // yok; çerez/oturum zaten gönderilmedi).
      let reason = '';
      try { reason = (await r.text()).slice(0, 80); } catch { /* gövde okunamadı */ }
      throw new Error(`HTTP ${r.status}${reason ? ` — kaynak yanıtı: ${reason}` : ''}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// --- BÜLTEN EŞLEŞTİRME — Bilyoner eventi ↔ resmî bültenin 15 maçı -------------
// İki-taraf normalize (matcher katlaması), sıra(eventNo↔position) çapraz kontrolü,
// tarih penceresi ve BELİRSİZLİK REDDİ. Yanlış maça yüzde bağlamaktansa boş bırak.
export function matchEventToBulletin(event, bulletinMatches, { now = Date.now() } = {}) {
  if (!event.home || !event.away) return { matched: null, reason: 'missing_event_teams' };
  const eh = normalizeName(event.home), ea = normalizeName(event.away);
  if (eh.length < 3 || ea.length < 3) return { matched: null, reason: 'unparseable_event' };

  const evTime = event.eventDate ? new Date(event.eventDate).getTime() : null;
  const hits = [];
  for (const bm of bulletinMatches) {
    const bh = normalizeName(bm.home?.name || bm.home?.mediumName || '');
    const ba = normalizeName(bm.away?.name || bm.away?.mediumName || '');
    if (bh.length < 3 || ba.length < 3) continue;
    const direct = pairMatch(eh, ea, bh, ba);
    const swapped = pairMatch(eh, ea, ba, bh);
    if (!direct && !swapped) continue;
    if (evTime && bm.date) {
      const bt = new Date(bm.date).getTime();
      if (Number.isFinite(bt) && Math.abs(bt - evTime) > 4 * DAY) continue; // farklı hafta → ele
    }
    hits.push({ bm, swapped: !direct && swapped });
  }
  if (hits.length) {
    const distinct = new Map();
    for (const h of hits) distinct.set(String(h.bm.sportotoMatchId ?? h.bm.no), h);
    if (distinct.size > 1) {
      // BELİRSİZLİK: birden çok bülten maçı tuttu → veri BAĞLANMAZ (audit'e).
      return { matched: null, reason: 'ambiguous_provider_match', candidateCount: distinct.size };
    }
    const hit = [...distinct.values()][0];
    const posAgree = Number(hit.bm.no) === Number(event.eventNo);
    return { matched: describe(hit, event, posAgree ? 'exact-both-sides+position' : 'exact-both-sides') };
  }

  // TIER 2 — SIRA ÇAPALI YEDEK: Bilyoner listesi RESMÎ Spor Toto programının
  // AYNISIDIR (eventNo == bülten sırası). İki-taraf tam eşleşme, adlardan biri
  // varyant olduğunda (ör. resmî "Ilves" ↔ Bilyoner "Tampereen") başarısız olur.
  // Bu durumda YALNIZCA: aynı sıradaki (eventNo==no) tek bülten maçı + tarih
  // penceresi + EN AZ BİR tarafın doğrulaması varsa bağlanır. Hiçbir taraf
  // doğrulamıyorsa (tamamen farklı program) BAĞLANMAZ — kart boş kalır.
  const anchor = bulletinMatches.find((bm) => Number(bm.no) === Number(event.eventNo));
  if (anchor) {
    const bh = normalizeName(anchor.home?.name || anchor.home?.mediumName || '');
    const ba = normalizeName(anchor.away?.name || anchor.away?.mediumName || '');
    const dateOk = !(evTime && anchor.date) || Math.abs(new Date(anchor.date).getTime() - evTime) <= 4 * DAY;
    const direct = (sideEq(eh, bh) || sideEq(ea, ba));
    const swap = (sideEq(eh, ba) || sideEq(ea, bh));
    if (dateOk && (direct || swap)) {
      return { matched: describe({ bm: anchor, swapped: !direct && swap }, event, 'position-anchored+one-side') };
    }
    return { matched: null, reason: 'position_anchor_no_side_corroboration' };
  }
  return { matched: null, reason: 'no_bulletin_match' };
}

function describe(hit, event, matchConfidence) {
  return {
    matchKey: String(hit.bm.sportotoMatchId ?? hit.bm.no),
    bulletinPosition: hit.bm.no,
    bulletinHome: hit.bm.home?.name ?? null,
    bulletinAway: hit.bm.away?.name ?? null,
    swapped: hit.swapped,
    matchConfidence,
    matchedBy: matchConfidence.startsWith('position-anchored')
      ? 'position-anchor+one-side+date' : 'normalized-name+date-window',
  };
}

// İki normalize ad çifti aynı fikstür mü (kapsama toleranslı: "wisla krakow" ⊇ "wisla").
function pairMatch(eh, ea, bh, ba) {
  return sideEq(eh, bh) && sideEq(ea, ba);
}
function sideEq(x, y) {
  if (!x || !y || x.length < 3 || y.length < 3) return false;
  return x === y || x.includes(y) || y.includes(x);
}

// --- ADAPTÖR SÖZLEŞMESİ: fetchPercentages(bulletinData) → satırlar -----------
// Dönen her satır: { matchNo/matchKey, pct:{'1','X','2'}, sourceMatchId,
//   home, away, position, competitionName, matchedBy, matchConfidence,
//   sourceType, parserVersion, rawHash }. Eşleşmeyen event listeden DÜŞMEZ ama
//   yüzdesi başka maça verilmez (matched=null → atlanır + trace döner).
export function buildBilyonerAdapter({ fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  return {
    id: 'bilyoner',
    name: 'Bilyoner',
    enabled: true,               // GERÇEK açık/oturumsuz kaynak DOĞRULANDI (22 Tem 2026).
    sourceUrl: PROGRAM_URL,
    sourceType: BILYONER_SOURCE_TYPE,
    parserVersion: BILYONER_PARSER_VERSION,
    note: 'Resmî açık/oturumsuz Spor Toto oynanma yüzdesi (bilyoner.com/api/sto).',

    // Test/enjeksiyon için ayrı ayrı da çağrılabilir.
    async fetchProgram() { return parseProgram(await getJson(PROGRAM_URL, { timeoutMs, fetchImpl })); },
    async fetchPlayRatios(gcNo) { return parsePlayRatios(await getJson(PLAYRATIO_URL(gcNo), { timeoutMs, fetchImpl })); },

    async fetchPercentages(bulletinData, { now = Date.now() } = {}) {
      const program = await this.fetchProgram();
      if (!program?.gcNo) throw new Error('Bilyoner program alınamadı (gcNo yok).');
      const ratios = await this.fetchPlayRatios(program.gcNo);   // eventNo → {home,draw,away}
      const bulletinMatches = bulletinData?.matches || [];
      const fetchedAt = new Date(now).toISOString();

      const rows = [];
      const unmatched = [];
      for (const ev of program.events) {
        const pr = ratios.get(Number(ev.eventNo));
        if (!pr) continue;                                       // yüzdesi gelmemiş event
        const m = matchEventToBulletin(ev, bulletinMatches, { now });
        if (!m.matched) { unmatched.push({ eventNo: ev.eventNo, home: ev.home, away: ev.away, reason: m.reason, candidateCount: m.candidateCount }); continue; }
        // Taraf yer değiştirdiyse (bülten ev/dep ters listelemiş) yüzdeleri de çevir.
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
          competitionName: ev.competitionName,
          matchedBy: m.matched.matchedBy,
          matchConfidence: m.matched.matchConfidence,
          sourceType: BILYONER_SOURCE_TYPE,
          parserVersion: BILYONER_PARSER_VERSION,
          observedAt: fetchedAt,
          fetchedAt,
          gcNo: program.gcNo,
          rawHash: sha({ gcNo: program.gcNo, e: ev.eventNo, p: [pr.home, pr.draw, pr.away] }),
        });
      }
      // Eşleşmeyenler operasyonel trace (kart düşmez; yüzdesi başka maça verilmez).
      if (unmatched.length) rows._unmatched = unmatched;
      return rows;
    },
  };
}

export const bilyonerAdapter = buildBilyonerAdapter();
