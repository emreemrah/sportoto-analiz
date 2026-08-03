// SAĞLAYICI ORTAK YARDIMCILARI — kaynak-bağımsız.
//
// NEDEN AYRI DOSYA: bu iki yardımcı (HTTP header ASCII koruması ve sağlayıcı
// event → bülten maçı eşleştirmesi) önce üçüncü bir sağlayıcının dosyasında
// yaşıyordu; nesine.js ve misli.js oradan import ediyordu. O sağlayıcı
// projeden TÜMÜYLE kaldırılınca (kullanıcı kararı) ortak kod da onunla
// gidecekti. İkisi de kaynağa özel hiçbir şey içermiyor — buraya taşındılar.
import { normalizeName } from '../matcher.js';

// Eşleştirmede tarih penceresi için (farklı haftanın maçı elenir).
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

// --- BÜLTEN EŞLEŞTİRME — sağlayıcı eventi ↔ resmî bültenin 15 maçı -----------
// İki-taraf normalize (matcher katlaması), tarih penceresi ve BELİRSİZLİK
// REDDİ. Yanlış maça yüzde bağlamaktansa satırı boş bırakmak yeğdir: birden
// çok bülten maçı tutuyorsa veri HİÇ bağlanmaz, sebebi trace'e yazılır.
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

  // TIER 2 — SIRA ÇAPALI YEDEK: sağlayıcı listesi RESMÎ Spor Toto programının
  // AYNISIDIR (eventNo == bülten sırası). İki-taraf tam eşleşme, adlardan biri
  // varyant olduğunda (ör. resmî "Ilves" ↔ sağlayıcıda "Tampereen") başarısız olur.
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
