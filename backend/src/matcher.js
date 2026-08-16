// Bülten maçını (sportoto, Türkçe adlar) FootyStats maçıyla eşleştirir.
// İsim eşleştirme + tarih kontrolü (aynı hafta) ile yanlış eşleşme önlenir.
// v2: Unicode katlama (ø/æ/ł/ß…), belirsiz eşleşme reddi, izlenebilirlik.

// "Gençlerbirliği" -> "genclerbirligi", "Brøndby" -> "brondby",
// "Nordsjælland" -> "nordsjaelland", "Wisła" -> "wisla".
// NOT: ø, æ, ł, ß, œ, ð, đ, þ NFD ile AYRIŞMAZ (aksan değil, ayrı harftir) —
// eski sürüm bunları tamamen SİLİYORDU ('brøndby'→'brndby') ve bülten adı
// ('Brondby') ile eşleşme imkânsız oluyordu. Katlama tablosu bunu düzeltir;
// takım-özel hardcode DEĞİL, genel Unicode kuralıdır.
const FOLD = {
  ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ð: 'd', đ: 'd', þ: 'th', ł: 'l',
};
export function normalizeName(name) {
  return (name || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o')
    .replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[øæœßðđþł]/g, (c) => FOLD[c] || c)   // NFD'yle ayrışmayan Avrupa harfleri
    .normalize('NFD').replace(/[̀-ͯ]/g, '')          // kalan aksanlar (å, é, ń, ę, ą, …)
    .replace(/\b(fc|cf|sk|afc|if|bk|sc|ac|utd|united)\b/g, '') // genel ekler
    .replace(/[^a-z0-9]/g, ''); // boşluk/noktalama
}

// Bülten adı ↔ FootyStats adı tamamen farklı olan kulüpler
// (yeniden adlandırma / eski sponsor adı). String benzerliğiyle çözülemezler,
// bu yüzden elle eşlenir. Anahtar ve değerler normalizeName'den geçmiş hâldedir.
// KURAL: Buraya yalnız KAYNAK verisiyle doğrulanmış çiftler eklenir; tahmini
// alias eklenmez (yanlış takım bağlama riski). Diakritik farklarını alias DEĞİL
// normalizeName katlaması çözer (Brøndby/Nordsjælland/Wisła alias GEREKTİRMEZ;
// "KGHM Zagłębie Lubin" gibi sponsor önekleri kapsama kuralıyla çözülür).
const ALIASES = {
  shanghaiport: ['shanghaisipg'],            // Shanghai Port = eski adı Shanghai SIPG
  shandongtaishan: ['shandongluneng'],       // Shandong Taishan = eski adı Shandong Luneng
  qingdaowestcoast: ['qingdaoyouthisland'],  // Qingdao West Coast = FootyStats'te Qingdao Youth Island
  henansongshanlongmen: ['henanjianye'],     // Henan Songshan Longmen = FootyStats'te Henan Jianye
  daejeonhanacitizen: ['daejeoncitizen'],    // Daejeon Hana Citizen = FootyStats'te Daejeon Citizen
  helsinki: ['hjk', 'helsinginjalkapalloklubi'], // Helsinki = HJK (logo kimliğinden doğrulandı)
  shenzhenpengcity: ['sichuanjiuniu'],       // Shenzhen Peng City = eski adı Sichuan Jiuniu (2024 taşındı)
  // İskandinav KISALTMA kulüpleri — kaynağın kendi logo kimliğinden DOĞRULANDI
  // (ör. TPS logosu "finland-turun-palloseura.png"): metin benzerliğiyle
  // çözülemeyen kısaltma ↔ resmî ad çiftleri. Tahmini alias YOK, kural sürüyor.
  tps: ['turunpalloseura'],
  tpsturku: ['turunpalloseura', 'tps'],
  vps: ['vaasanpalloseura'],
  kups: ['kuopionpalloseura'],
  sjk: ['seinajoenjalkapallokerho'],
  hjk: ['helsinginjalkapalloklubi'],
  agf: ['aarhusgymnastikforening'],
  agfaarhus: ['aarhusgymnastikforening', 'agf'],
  hamkam: ['hamarkameratene'],
  ob: ['odense'],                            // OB = Odense BK (bk eki normalizasyonda düşer)
  // TÜRKÇE KULÜP ADI (exonim) ↔ kaynağın resmî adı. Bülten "Marsilya" yazar,
  // kaynak "Olympique de Marseille" — hiçbir metin katmanı bunu bağlayamaz.
  // DOĞRULAMA (16 Ağustos 2026): arma defterinde id 443 kaydı var ve arması
  // "france-olympique-de-marseille.png"; yani çift KAYNAK verisinden okundu,
  // tahmin değil. Kural sürüyor: doğrulanmamış exonim buraya eklenmez.
  marsilya: ['olympiquedemarseille', 'olympiquemarseille'],
};

// Bir bülten takımının tüm ad varyantlarını (normalize) döndürür:
// tam ad + orta (kısa) ad + varsa alias'lar. Böylece "Incheon Utd." ile
// "Incheon United" ya da kısaltmalı Çin adları da yakalanır.
// DIŞA AÇIK: arma kayıt defteri (crestRegistry.js) de aynı varyantları
// kullanır — alias tablosu tek doğruluk kaynağı olarak burada kalır.
export function nameVariants(team) {
  const raw = [team.name, team.mediumName].filter(Boolean);
  const out = new Set();
  for (const r of raw) {
    const n = normalizeName(r);
    if (!n) continue;
    out.add(n);
    for (const a of ALIASES[n] || []) out.add(a);
  }
  return [...out];
}

// KAPSAM TEŞHİSİ: bülten takımının (alias dahil) FootyStats veri havuzunda
// karşılığı VAR mı? footyNorm = normalize edilmiş FootyStats takım adları kümesi.
// (Eşleşme başarısız olunca sebebi sınıflamak için: takım hiç yok mu, yoksa
//  var ama isim/tarih mi tutmadı.)
export function hasFootyCandidate(team, footyNorm) {
  for (const v of nameVariants(team)) {
    if (!v || v.length < 3) continue;
    for (const y of footyNorm) {
      if (!y || y.length < 3) continue;
      if (v === y || v.includes(y) || y.includes(v)) return true;
    }
  }
  return false;
}

// Kapsam teşhisinde ham adlarla kelime-kümesi kontrolü (v3 önlemiyle uyumlu):
// normalize kümede bulunamayan takım, kelime kesişimiyle bulunabiliyor mu?
export function hasFootyCandidateByTokens(team, footyRawNames) {
  const raws = [team?.name, team?.mediumName].filter(Boolean);
  return raws.some((rn) => (footyRawNames || []).some((fy) => tokenMatches(rn, fy)));
}

// Normalize edilmiş bir ad varyantı, FootyStats adını karşılıyor mu:
// tam eşit ya da biri diğerini içeriyor. ("KGHM Zaglebie Lubin" ⊇ "Zagłębie
// Lubin" gibi sponsor önekleri bu kapsama kuralıyla çözülür — hardcode yok.)
function variantMatches(normVariant, footyName) {
  const y = normalizeName(footyName);
  if (!normVariant || !y || normVariant.length < 3 || y.length < 3) return false;
  return normVariant === y || normVariant.includes(y) || y.includes(normVariant);
}

// --- v3 ÖNLEM KATMANLARI (ad birebir tutmadığında) ------------------------
// Birden çok kulüpte geçen JENERİK kelimeler tek başına eşleşme kanıtı OLAMAZ
// ("İnter" ↔ "Inter Turku" gibi yanlış bağlama riski). Liste kısa ve nettir.
export const AMBIGUOUS_TOKENS = new Set([
  'inter', 'real', 'sporting', 'city', 'athletic', 'atletico', 'dynamo',
  'dinamo', 'deportivo', 'racing', 'union', 'olympic', 'lokomotiv', 'united',
]);
// Kulüp tipi ekleri (kelime düzeyinde ayıklanır; normalizeName ile uyumlu + geniş).
export const GENERIC_SUFFIX = new Set([
  'fc', 'cf', 'sk', 'afc', 'if', 'bk', 'sc', 'ac', 'utd', 'united', 'fk',
  'ff', 'ifk', 'is', 'ik', 'sv', 'bsc', 'fotball', 'fodbold', 'fotboll',
]);

// Adı AYIRT EDİCİ kelimelere böler (≥4 harf, jenerik/il tipi ekler hariç).
export function nameTokens(name) {
  return (name || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o')
    .replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[øæœßðđþł]/g, (c) => FOLD[c] || c)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim().split(/\s+/)
    .filter((t) => t.length >= 4 && !GENERIC_SUFFIX.has(t) && !AMBIGUOUS_TOKENS.has(t));
}

// KELİME KÜMESİ eşleşmesi: kısa tarafın TÜM ayırt edici kelimeleri uzun tarafta
// aynen bulunmalı ("Bodo Glimt" ↔ "FK Bodø/Glimt Fotball"). Tek jenerik kelime
// yeterli sayılmaz (yukarıdaki filtre) — yanlış kulübe bağlanmaz.
function tokenMatches(rawA, rawB) {
  const A = nameTokens(rawA), B = nameTokens(rawB);
  if (!A.length || !B.length) return false;
  const [S, L] = A.length <= B.length ? [A, B] : [B, A];
  const Lset = new Set(L);
  return S.every((t) => Lset.has(t));
}

// LOGO KİMLİĞİ: kaynak fikstür satırında takım logosu varsa slug'ı resmî ad
// gibi kullanılır ("…/finland-turun-palloseura.png" → "finlandturunpalloseura").
// Kısa görünen ad ("TPS") tutmasa bile bülten adı slug içinde yakalanır.
function logoSlugNorm(image) {
  const m = String(image || '').match(/\/([a-z0-9-]+)\.(png|jpg|jpeg|svg|webp)(\?|$)/i);
  return m ? m[1].toLowerCase().replace(/[^a-z0-9]/g, '') : null;
}

// Bülten takımı ↔ FootyStats tarafı. Katman sırası: 1) ad (birebir/kapsama +
// alias) 2) logo kimliği 3) kelime kümesi. Hangi katmanın tuttuğu izlenebilirlik
// için döndürülür; hiçbiri tutmazsa null (uydurma eşleşme yok).
// DIŞA AÇIK: arma kayıt defteri bu katmanları TAKIM başına yeniden kullanır —
// böylece armaya ayrı bir eşleştirme mantığı (ve yeni yanlış-eşleşme yüzeyi)
// yazılmaz. Fikstür kuralları (iki taraf + tarih penceresi) burada değişmez.
export function sideMatches(team, footyName, footyImage = null) {
  const variants = nameVariants(team);
  if (variants.some((v) => variantMatches(v, footyName))) return 'name';
  const slug = logoSlugNorm(footyImage);
  if (slug && variants.some((v) => v.length >= 4 && (slug.includes(v) || v.includes(slug)))) return 'logo';
  const raws = [team?.name, team?.mediumName].filter(Boolean);
  if (raws.some((rn) => tokenMatches(rn, footyName))) return 'token';
  return null;
}

const DAY = 24 * 60 * 60 * 1000;

// Bülten maçına karşılık gelen FootyStats maçını bulur.
// * Yanlış eşleşmeyi önlemek için maç tarihleri ~4 gün içinde olmalı ve HEM ev
//   HEM deplasman AYNI fikstürde tutmalı (yalnız tek isim benzerliğiyle başka
//   ülke/ligdeki takım bağlanamaz).
// * BELİRSİZLİK REDDİ (default-deny): birden fazla FARKLI fikstür aynı anda
//   tutuyorsa eşleşme KABUL EDİLMEZ ({ ambiguous: true } döner) — yanlış
//   takıma veri bağlamaktansa dürüst 'Yetersiz Veri' tercih edilir.
// * İZLENEBİLİRLİK: eşleşme kanıtı trace alanında döner (bülten adı, kaynak
//   adı, kaynak takım/maç id'si, yöntem, zaman).
export function findFootyMatch(bulletinMatch, footyMatches) {
  const bTime = new Date(bulletinMatch.date).getTime();

  // Tarihi yakın olan adaylar (footy tarihi yoksa yine de aday say)
  const candidates = footyMatches.filter((f) => {
    if (!f.dateUnix) return true;
    return Math.abs(f.dateUnix * 1000 - bTime) <= 4 * DAY;
  });

  const hits = [];
  for (const f of candidates) {
    const hN = sideMatches(bulletinMatch.home, f.homeName, f.homeImage);
    const aN = sideMatches(bulletinMatch.away, f.awayName, f.awayImage);
    if (hN && aN) {
      hits.push({ match: f, swapped: false, how: [hN, aN] });
    } else {
      const hS = sideMatches(bulletinMatch.home, f.awayName, f.awayImage);
      const aS = sideMatches(bulletinMatch.away, f.homeName, f.homeImage);
      if (hS && aS) hits.push({ match: f, swapped: true, how: [hS, aS] });
    }
  }
  if (!hits.length) return null;

  // Aynı fikstürün mükerrer kaydı (çift sezon listesi vb.) belirsizlik sayılmaz.
  const distinct = new Map();
  for (const h of hits) {
    distinct.set(String(h.match.footyMatchId ?? `${h.match.homeName}|${h.match.awayName}|${h.match.dateUnix}`), h);
  }
  if (distinct.size > 1) {
    return { ambiguous: true, candidateCount: distinct.size };
  }

  const hit = [...distinct.values()][0];
  const f = hit.match;
  return {
    ...hit,
    trace: {
      bulletinHome: bulletinMatch.home?.name ?? null,
      bulletinAway: bulletinMatch.away?.name ?? null,
      sourceHome: hit.swapped ? f.awayName : f.homeName,
      sourceAway: hit.swapped ? f.homeName : f.awayName,
      sourceHomeId: (hit.swapped ? f.awayId : f.homeId) ?? null,
      sourceAwayId: (hit.swapped ? f.homeId : f.awayId) ?? null,
      sourceMatchId: f.footyMatchId ?? null,
      seasonId: f.seasonId ?? null,
      // Ad katmanıyla eşleşince ESKİ etiket aynen korunur (mühürlü trace uyumu);
      // yardımcı katman devredeyse hangi katmanların tuttuğu açıkça yazılır.
      matchedBy: hit.how.every((x) => x === 'name')
        ? 'normalized-name+date-window'
        : `${[...new Set(hit.how)].join('+')}-match+date-window`,
      matchConfidence: hit.how.every((x) => x === 'name') ? 'exact-both-sides' : `assisted:${hit.how.join('/')}`,
      source: 'FootyStats',
      observedAt: new Date().toISOString(),
    },
  };
}
