// FAVORİ TAKIM EŞLEŞTİRME — saf modül (RN yok).
// Profildeki serbest metinli "favori takım" alanı, bültendeki resmî takım
// adlarıyla esnek ama TEMKİNLİ eşleştirilir: kısacık girdilerle yanlış
// eşleşme olmasın diye en az 3 karakter aranır.

const norm = (s) => String(s || '')
  .toLocaleLowerCase('tr-TR')
  .replace(/[^a-zçğıöşü0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** Takım adı, kullanıcının favori takımıyla eşleşiyor mu? */
export function isFavoriteTeam(teamName, favorite) {
  const t = norm(teamName);
  const f = norm(favorite);
  if (t.length < 3 || f.length < 3) return false;
  return t.includes(f) || f.includes(t);
}

/** Maçta favori takım oynuyor mu? → 'home' | 'away' | null */
export function favoriteSide(match, favorite) {
  if (!favorite) return null;
  const names = (t) => [t?.name, t?.mediumName, t?.shortName].filter(Boolean);
  if (names(match?.home).some((n) => isFavoriteTeam(n, favorite))) return 'home';
  if (names(match?.away).some((n) => isFavoriteTeam(n, favorite))) return 'away';
  return null;
}
