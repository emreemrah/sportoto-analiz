// Bülten maçını (sportoto, Türkçe adlar) FootyStats maçıyla eşleştirir.
// İsim eşleştirme + tarih kontrolü (aynı hafta) ile yanlış eşleşme önlenir.

// "Gençlerbirliği" -> "genclerbirligi"
export function normalizeName(name) {
  return (name || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o')
    .replace(/ş/g, 's').replace(/ü/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // kalan aksanlar
    .replace(/\b(fc|cf|sk|afc|if|bk|sc|ac|utd|united)\b/g, '') // genel ekler
    .replace(/[^a-z0-9]/g, ''); // boşluk/noktalama
}

// Bülten adı ↔ FootyStats adı tamamen farklı olan kulüpler
// (yeniden adlandırma / eski sponsor adı). String benzerliğiyle çözülemezler,
// bu yüzden elle eşlenir. Anahtar ve değerler normalizeName'den geçmiş hâldedir.
const ALIASES = {
  shanghaiport: ['shanghaisipg'],            // Shanghai Port = eski adı Shanghai SIPG
  shandongtaishan: ['shandongluneng'],       // Shandong Taishan = eski adı Shandong Luneng
  qingdaowestcoast: ['qingdaoyouthisland'],  // Qingdao West Coast = FootyStats'te Qingdao Youth Island
};

// Bir bülten takımının tüm ad varyantlarını (normalize) döndürür:
// tam ad + orta (kısa) ad + varsa alias'lar. Böylece "Incheon Utd." ile
// "Incheon United" ya da kısaltmalı Çin adları da yakalanır.
function nameVariants(team) {
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

// Normalize edilmiş bir ad varyantı, FootyStats adını karşılıyor mu:
// tam eşit ya da biri diğerini içeriyor.
function variantMatches(normVariant, footyName) {
  const y = normalizeName(footyName);
  if (!normVariant || !y || normVariant.length < 3 || y.length < 3) return false;
  return normVariant === y || normVariant.includes(y) || y.includes(normVariant);
}

// Bülten takımı ↔ FootyStats adı: varyantlardan biri tutuyorsa eşleşir.
function sideMatches(team, footyName) {
  return nameVariants(team).some((v) => variantMatches(v, footyName));
}

const DAY = 24 * 60 * 60 * 1000;

// Bülten maçına karşılık gelen FootyStats maçını bulur (yoksa null).
// Yanlış eşleşmeyi önlemek için maç tarihleri ~4 gün içinde olmalı.
export function findFootyMatch(bulletinMatch, footyMatches) {
  const bTime = new Date(bulletinMatch.date).getTime();

  // Tarihi yakın olan adaylar (footy tarihi yoksa yine de aday say)
  const candidates = footyMatches.filter((f) => {
    if (!f.dateUnix) return true;
    return Math.abs(f.dateUnix * 1000 - bTime) <= 4 * DAY;
  });

  let hit = candidates.find(
    (f) => sideMatches(bulletinMatch.home, f.homeName) && sideMatches(bulletinMatch.away, f.awayName)
  );
  if (hit) return { match: hit, swapped: false };

  hit = candidates.find(
    (f) => sideMatches(bulletinMatch.home, f.awayName) && sideMatches(bulletinMatch.away, f.homeName)
  );
  if (hit) return { match: hit, swapped: true };

  return null;
}
