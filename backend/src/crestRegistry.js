// TAKIM ARMASI KAYIT DEFTERİ (crest registry)
// ---------------------------------------------------------------------------
// SORUN: Kulüp arması bugüne kadar FİKSTÜR eşleşmesinin yan ürünüydü. Arma
// yalnız findFootyMatch tuttuğunda (enrich → stats.home.logo) doluyordu; tek bir
// maç eşleşmediğinde, takımın arması kaynaktan ÇEKİLMİŞ olsa bile İKİ takımın
// arması birden boş kalıyordu. Yani "maçı eşleştiremedim" ile "bu takımın
// armasını bilmiyorum" aynı şeymiş gibi davranıyordu — oysa bunlar ayrı sorular.
//
// ÖNLEM: Takım armaları, fikstür eşleşmesinden BAĞIMSIZ, kalıcı bir deftere
// işlenir. Her yenilemede kaynağın sezon takım listelerindeki armalar deftere
// eklenir; defter cache'te kalıcıdır, yani bir lig sonraki haftalarda kapsam
// dışına düşse bile o takımların arması korunur.
//
// DÜRÜSTLÜK KURALI (kod tarafında zorlanır): "başka kulübün arması veya
// 'benzeri' bir görsel ASLA konmaz." Bu yüzden defter VARSAYILAN-RET çalışır:
//   • Aynı normalize ada birden fazla FARKLI kulüp (farklı kaynak takım kimliği
//     + farklı arma) denk geliyorsa → o ad BELİRSİZ sayılır, arma verilmez.
//   • Arama katmanları sıkıdan gevşeğe ilerler; bir katman tek ve kesin sonuç
//     verirse orada durulur, gevşek katmana hiç inilmez.
//   • Hiçbir katman tek sonuç vermezse null döner → ekranda nötr ⚽ kalır.
// Yanlış arma göstermektense arma göstermemek tercih edilir.
//
// NEDEN AYRI (ve DAHA SIKI) BİR ARAMA: matcher.js'in sideMatches katmanları
// FİKSTÜR için tasarlandı — orada bir eşleşmenin geçerli olması için HEM ev HEM
// deplasman aynı maçta tutmalı ve tarih ±4 gün içinde olmalı. Bu iki koşul,
// tek başına gevşek kalan bir katmanı güvenli hâle getirir. Arma araması ise
// TEK takım üzerinden yapılır; aynı gevşeklik burada doğrudan yanlış armaya
// dönüşür. Gerçek veriyle ölçüldü: sideMatches'in logo katmanı ham "içeriyor mu"
// baktığı için bülten takımı "Porto", Polonya kulübü "…klub-SPORTOwy-wieczysta…"
// armasına bağlanıyordu ('sportowy' kelimesinin içinde 'porto' geçiyor).
// Bu yüzden defter kendi katman merdivenini kullanır: kelime/parça SINIRINA
// oturmayan hiçbir benzerlik kanıt sayılmaz. Alias tablosu ve kelime ayıklama
// kuralları yine matcher.js'ten gelir (tek doğruluk kaynağı orada kalır).

import {
  normalizeName, nameVariants, nameTokens, AMBIGUOUS_TOKENS, GENERIC_SUFFIX,
} from './matcher.js';
import { save, load } from './cache.js';

const KEY = 'crests';
// Defter yıllar içinde şişmesin diye üst sınır (en eski görülenler düşer).
// Elli sezonluk kapsamda ~1.000 takım beklenir; sınır fazlasıyla geniştir.
const MAX_ENTRIES = 20000;

const isHttpUrl = (u) => typeof u === 'string' && /^https?:\/\/\S+$/i.test(u.trim());

// Bir kaynak takım kaydından deftere yazılacak adları çıkarır.
// name ve cleanName ayrı ayrı anahtarlanır (ikisi de aynı kulübe işaret ettiği
// için belirsizlik doğurmaz); shortHand ("POR" gibi) BİLEREK kullanılmaz —
// kısaltmalar farklı kulüplerde çakışır ve yanlış bağlama riski taşır.
function teamNames(t) {
  const out = [];
  for (const n of [t?.name, t?.cleanName]) {
    const s = String(n || '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function emptyRegistry() {
  return { version: 1, updatedAt: null, entries: [] };
}

// Diskteki defteri okur. Bozuk/eksik dosya sessizce boş defter sayılır
// (arma yokluğu ekranı bozmaz, nötr ⚽ çizilir).
export function loadRegistry() {
  const raw = load(KEY);
  const d = raw?.data;
  if (!d || !Array.isArray(d.entries)) return emptyRegistry();
  return { version: d.version || 1, updatedAt: d.updatedAt || null, entries: d.entries.filter((e) => e && isHttpUrl(e.image)) };
}

export function saveRegistry(reg) {
  save(KEY, { version: 1, updatedAt: new Date().toISOString(), entries: reg.entries });
}

// Kaynak sezon takım listelerini deftere işler.
// teamsBySeason: Map<seasonId, teams[]> (ya da [seasonId, teams[]] çiftleri).
// Aynı kulüp birden çok sezonda görülürse tek kayıtta birleşir; arma en son
// görülen değerle tazelenir (kaynak CDN adresini değiştirirse defter uyar).
export function harvestCrests(teamsBySeason, { registry = loadRegistry(), now = new Date() } = {}) {
  const iso = now.toISOString();
  const entries = registry.entries.map((e) => ({ ...e }));

  // Kimlik: kaynak takım kimliği varsa o; yoksa normalize ad + arma adresi.
  const identOf = (id, name, image) => (id != null ? `id:${id}` : `nm:${normalizeName(name)}|${image}`);
  const byIdent = new Map();
  for (const e of entries) byIdent.set(identOf(e.id, e.names?.[0], e.image), e);

  let added = 0, refreshed = 0, seen = 0;
  for (const [sid, teams] of (teamsBySeason instanceof Map ? teamsBySeason.entries() : teamsBySeason || [])) {
    for (const t of teams || []) {
      const image = String(t?.image || '').trim();
      const names = teamNames(t);
      if (!isHttpUrl(image) || !names.length || !normalizeName(names[0])) continue;
      seen++;
      const ident = identOf(t.id, names[0], image);
      const prev = byIdent.get(ident);
      if (prev) {
        for (const n of names) if (!prev.names.includes(n)) prev.names.push(n);
        if (prev.image !== image) { prev.image = image; refreshed++; }
        if (sid != null && !prev.seasons.includes(sid)) prev.seasons.push(sid);
        prev.lastSeenAt = iso;
      } else {
        const rec = {
          id: t.id ?? null, names, image,
          seasons: sid != null ? [sid] : [],
          firstSeenAt: iso, lastSeenAt: iso,
        };
        entries.push(rec);
        byIdent.set(ident, rec);
        added++;
      }
    }
  }

  // Üst sınır: en eski görülenler düşer (yeni veri her zaman korunur).
  entries.sort((a, b) => String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')));
  const kept = entries.slice(0, MAX_ENTRIES);
  const out = { version: 1, updatedAt: iso, entries: kept };
  return { registry: out, added, refreshed, seen, total: kept.length, dropped: entries.length - kept.length };
}

// --- TAKIM SÜRÜMÜ İŞARETLERİ ------------------------------------------------
// A takımı ile B takımı / kadın takımı / altyapı aynı kulübün ADINI taşır ama
// AYRI armaları vardır. Bunları birbirine bağlamak "yanlış arma"dır. İşaretler
// kelime düzeyinde okunur; birebir ad katmanı dışındaki tüm katmanlarda iki
// tarafın işaret kümesi AYNI olmak zorundadır ("Porto" ≠ "Porto B").
const VARIANT_MARKERS = new Set([
  'b', 'ii', 'iii', '2', '3',
  'u16', 'u17', 'u18', 'u19', 'u20', 'u21', 'u23',
  'youth', 'junior', 'juniors', 'jr', 'academy', 'akademi', 'akademia',
  'reserve', 'reserves', 'amateur',
  'w', 'women', 'womens', 'ladies', 'feminin', 'feminine', 'femenino',
  'femminile', 'kadin', 'kadinlar', 'frauen', 'dames', 'damer', 'naiset',
]);

function words(name) {
  return String(name || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim().split(/\s+/).filter(Boolean);
}

// İşaret kümesinin karşılaştırılabilir tek anahtarı ('' = sürüm işareti yok).
function markerKey(...names) {
  const m = new Set();
  for (const n of names) for (const w of words(n)) if (VARIANT_MARKERS.has(w)) m.add(w);
  return [...m].sort().join('|');
}

// --- ARMA ADRESİ PARÇALARI --------------------------------------------------
// "…/finland-turun-palloseura.png" → ['finland','turun','palloseura'].
function slugSegments(image) {
  const m = String(image || '').match(/\/([a-z0-9-]+)\.(png|jpg|jpeg|svg|webp)(\?|$)/i);
  return m ? m[1].toLowerCase().split('-').filter(Boolean) : [];
}

// Adresteki ARDIŞIK parça dizilerini üretir ("turun"+"palloseura" ✓).
// Ham "içeriyor mu" karşılaştırması BİLEREK yapılmaz: kelime sınırına oturmayan
// benzerlik (porto ⊂ sportowy) kanıt sayılmaz.
// Tek parçalık diziler elenir: (a) jenerik/belirsiz kelimeler, (b) adresin ilk
// parçası — orası neredeyse her zaman ÜLKE önekidir, kulüp adı değildir.
function slugRuns(segs) {
  const out = new Set();
  for (let i = 0; i < segs.length; i++) {
    let acc = '';
    for (let j = i; j < segs.length; j++) {
      acc += segs[j];
      const single = j === i;
      if (single && (AMBIGUOUS_TOKENS.has(segs[j]) || GENERIC_SUFFIX.has(segs[j]) || (i === 0 && segs.length > 1))) continue;
      if (acc.length >= 5) out.add(acc);
    }
  }
  return out;
}

// Kapsama YALNIZ uçtan: uzun ad kısa adla başlıyor ya da bitiyorsa
// ("KGHM Zaglebie Lubin" ⊇ "Zaglebie Lubin"). Ortadan yakalama yok.
function edgeContains(a, b) {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 5 && (l.startsWith(s) || l.endsWith(s));
}

// Kelime kümesi: kısa tarafın TÜM ayırt edici kelimeleri uzun tarafta olmalı ve
// kısa tarafta EN AZ İKİ ayırt edici kelime bulunmalı. Tek kelimelik benzerlik
// ("Northport" → "Northport Rangers") bu katmanda kanıt sayılmaz.
function tokenSubset(A, B) {
  if (!A.length || !B.length) return false;
  const [S, L] = A.length <= B.length ? [A, B] : [B, A];
  if (S.length < 2) return false;
  const Lset = new Set(L);
  return S.every((t) => Lset.has(t));
}

// Defteri aramaya hazır hâle getirir. Her kayıt için arama alanları önceden
// hesaplanır: normalize adlar, sürüm işaretleri, arma adresi parçaları,
// ayırt edici kelimeler. Kayıtların kendisi DEĞİŞTİRİLMEZ (diske yazılan defter
// saf kalır); dizin ayrı bir katman olarak tutulur.
export function indexRegistry(registry = loadRegistry()) {
  const byKey = new Map();
  const records = [];
  for (const e of registry.entries) {
    const names = e.names || [];
    const keys = [];
    const tokens = new Set();
    for (const n of names) {
      const k = normalizeName(n);
      if (k && k.length >= 3 && !keys.includes(k)) keys.push(k);
      for (const t of nameTokens(n)) tokens.add(t);
    }
    const rec = {
      entry: e, keys, tokens: [...tokens],
      marks: markerKey(...names),
      runs: slugRuns(slugSegments(e.image)),
    };
    records.push(rec);
    for (const k of keys) {
      if (!byKey.has(k)) byKey.set(k, []);
      const arr = byKey.get(k);
      if (!arr.includes(rec)) arr.push(rec);
    }
  }
  return { registry, byKey, records, entries: registry.entries };
}

// Bir kayıt kümesi TEK kulübe mi işaret ediyor? Varsayılan-ret kararı burada.
// * Tek kaynak kimliği → aynı kulüp, en son arma kullanılır.
// * Kimlikler farklı ama arma aynı → yine aynı kulüp (mükerrer kayıt), kabul.
// * Kimlikler farklı VE armalar farklı → BELİRSİZ, arma verilmez.
function resolveOne(cands) {
  if (!cands || !cands.length) return { image: null, reason: 'not_found' };
  const ids = new Set(cands.map((e) => (e.id != null ? String(e.id) : `nm:${e.image}`)));
  const images = new Set(cands.map((e) => e.image));
  if (ids.size === 1 || images.size === 1) {
    const latest = [...cands].sort((a, b) => String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')))[0];
    return { image: latest.image, reason: null, entry: latest };
  }
  return { image: null, reason: 'ambiguous', candidateCount: ids.size };
}

// Bülten takımının armasını defterden bulur. Katman merdiveni SIKIDAN GEVŞEĞE:
//   1) 'exact'   — normalize ad (alias dahil) birebir aynı.
//   2) 'contain' — uçtan kapsama (sponsor öneki: "KGHM Zaglebie Lubin").
//   3) 'slug'    — ad, arma adresinin ARDIŞIK parçalarına birebir oturuyor
//                  (kaynak kısa adı yazmışsa: "TPS" ↔ turun-palloseura).
//   4) 'token'   — en az iki ayırt edici kelime kümesi kapsaması.
//
// İKİ KESİN KURAL:
// * Bir katman aday üretiyorsa karar ORADA verilir. Aday belirsizse REDDEDİLİR;
//   daha gevşek katmana İNİLMEZ (gevşeterek "bir şey bulmak" yasak).
// * Birebir ad dışındaki katmanlarda iki tarafın sürüm işaretleri aynı olmalı
//   ("Porto" ile "Porto B" hiçbir katmanda buluşamaz).
// Dönen değer: { image, matchedBy, sourceName } veya { image: null, reason }.
export function lookupCrest(team, index) {
  const idx = index || indexRegistry();
  const variants = nameVariants(team || {});
  if (!variants.length) return { image: null, reason: 'no_name' };

  const vset = new Set(variants);
  const marks = markerKey(team?.name, team?.mediumName);
  const tokens = [...new Set([team?.name, team?.mediumName].filter(Boolean).flatMap((n) => nameTokens(n)))];

  // Katman testleri (sırayla denenir; ilk aday üreten katman kararı verir).
  const layers = [
    ['exact', (r) => r.keys.some((k) => vset.has(k))],
    ['contain', (r) => r.marks === marks && r.keys.some((k) => variants.some((v) => edgeContains(v, k)))],
    ['slug', (r) => r.marks === marks && variants.some((v) => v.length >= 5 && r.runs.has(v))],
    ['token', (r) => r.marks === marks && tokenSubset(tokens, r.tokens)],
  ];

  for (const [name, test] of layers) {
    // 'exact' için tüm defteri taramaya gerek yok: ad dizini zaten hazır.
    const recs = name === 'exact'
      ? [...new Set(variants.flatMap((v) => idx.byKey.get(v) || []))]
      : (idx.records || []).filter(test);
    if (!recs.length) continue;
    const hit = resolveOne(recs.map((r) => r.entry));
    if (hit.image) return { image: hit.image, matchedBy: `registry-${name}`, sourceName: hit.entry.names[0] };
    return { image: null, reason: hit.reason, candidateCount: hit.candidateCount };
  }
  return { image: null, reason: 'not_found' };
}

// Bülten maçlarına arma iliştirir. Her maçın İKİ tarafı için AYRI karar verilir:
//   1) maçın kendi kaynak eşleşmesinden gelen arma (stats[side].logo) — en kesin,
//   2) yoksa arma kayıt defteri — fikstür eşleşmesine İHTİYAÇ DUYMAZ,
//   3) o da yoksa boş bırakılır → ekranda nötr ⚽ çizilir.
// m.home / m.away YENİ nesneyle değiştirilir; verilen bülten nesnesinin kendi
// takım kayıtları (resmî veri) DEĞİŞTİRİLMEZ — imza/teyit akışı etkilenmez.
export function attachCrests(matches, index) {
  for (const m of matches || []) {
    for (const side of ['home', 'away']) {
      if (!m?.[side]) continue;
      const fromFixture = m.stats?.[side]?.logo || '';
      if (fromFixture) { m[side] = { ...m[side], logo: fromFixture, logoSource: 'fixture' }; continue; }
      const hit = index ? lookupCrest(m[side], index) : { image: null, reason: 'no_registry' };
      m[side] = hit.image
        ? { ...m[side], logo: hit.image, logoSource: 'registry', logoMatchedBy: hit.matchedBy || null }
        : { ...m[side], logo: '', logoSource: null, logoReason: hit.reason || 'not_found' };
    }
  }
  return matches;
}

// KAPSAM TEŞHİSİ: bülten maçlarının kaç arma yerinin dolu olduğunu, hangi
// takımların hâlâ armasız kaldığını ve sebebini raporlar. Uydurma yok:
// bulunamayan takım listelenir ki kaynak panelinden ligi kapsama alabilesin.
export function crestCoverage(matches) {
  const slots = [];
  for (const m of matches || []) {
    for (const side of ['home', 'away']) {
      const t = m?.[side];
      if (!t) continue;
      slots.push({ no: m.no ?? null, side, name: t.name || '', logo: t.logo || '', via: t.logoSource || null });
    }
  }
  const filled = slots.filter((s) => s.logo);
  const missing = slots.filter((s) => !s.logo);
  const byName = new Map();
  for (const s of missing) if (!byName.has(s.name)) byName.set(s.name, { no: s.no, name: s.name });
  return {
    total: slots.length,
    filled: filled.length,
    missing: missing.length,
    fromFixture: filled.filter((s) => s.via === 'fixture').length,
    fromRegistry: filled.filter((s) => s.via === 'registry').length,
    missingTeams: [...byName.values()],
  };
}
