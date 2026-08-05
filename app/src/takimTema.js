// TAKIM RENK TEMASI — favori takım seçilince uygulamanın vurgu renkleri
// kulüp renklerine döner (kullanıcı isteği, 2026-08-04; örnek: Galatasaray →
// sarı-kırmızı). Saf modül + hook.
// ---------------------------------------------------------------------------
// DÜRÜSTLÜK: kulüp renkleri kamuya açık, bilinen renklerdir. Listede OLMAYAN
// takım için renk uydurulmaz — uygulama varsayılan temada kalır.
// `ana`  = butonlar/aktif sekme için güçlü, açık zeminde okunur renk.
// `vurgu`= nokta/çerçeve/parlama gibi ikincil vurgular için parlak renk.
// NOT: Bu dosya SAF kalır (RN/auth importu yok) — testler doğrudan çalıştırır.
// Hook ayrı dosyada: useTakimTema.js.

export const TAKIM_RENKLERI = {
  // Türkiye
  galatasaray: { ana: '#A32638', vurgu: '#FDB912' },
  fenerbahce: { ana: '#163962', vurgu: '#FFED00' },
  besiktas: { ana: '#1A1A1A', vurgu: '#C4CDD5' },
  trabzonspor: { ana: '#611C35', vurgu: '#99D6EA' },
  basaksehir: { ana: '#F26522', vurgu: '#1B3F94' },
  // İngiltere
  arsenal: { ana: '#EF0107', vurgu: '#023474' },
  liverpool: { ana: '#C8102E', vurgu: '#00B2A9' },
  manchestercity: { ana: '#1C2C5B', vurgu: '#6CABDD' },
  manchesterunited: { ana: '#DA291C', vurgu: '#FBE122' },
  chelsea: { ana: '#034694', vurgu: '#DBA111' },
  tottenham: { ana: '#132257', vurgu: '#9AA0A6' },
  newcastle: { ana: '#241F20', vurgu: '#41B6E6' },
  astonvilla: { ana: '#670E36', vurgu: '#95BFE5' },
  // İspanya
  realmadrid: { ana: '#00529F', vurgu: '#FEBE10' },
  barcelona: { ana: '#A50044', vurgu: '#004D98' },
  atleticomadrid: { ana: '#CB3524', vurgu: '#262E62' },
  sevilla: { ana: '#D40026', vurgu: '#9AA0A6' },
  athleticbilbao: { ana: '#EE2523', vurgu: '#1A1A1A' },
  // İtalya
  juventus: { ana: '#1A1A1A', vurgu: '#B5B5B5' },
  // "acmilan" bilerek spesifik: "Inter Milan" adının "milan" içermesi AC Milan
  // temasını YANLIŞ tetiklemesin diye.
  acmilan: { ana: '#FB090B', vurgu: '#1A1A1A' },
  inter: { ana: '#0068A8', vurgu: '#221F20' },
  napoli: { ana: '#0F7CC0', vurgu: '#12A0D7' },
  roma: { ana: '#8E1F2F', vurgu: '#F0BC42' },
  // Almanya
  bayern: { ana: '#DC052D', vurgu: '#0066B2' },
  dortmund: { ana: '#1A1A1A', vurgu: '#FDE100' },
  leverkusen: { ana: '#E32221', vurgu: '#1A1A1A' },
  leipzig: { ana: '#DD0741', vurgu: '#001F47' },
  // Portekiz
  benfica: { ana: '#E52A30', vurgu: '#9AA0A6' },
  porto: { ana: '#003E7E', vurgu: '#9AA0A6' },
  sporting: { ana: '#008658', vurgu: '#1A1A1A' },
  // Hollanda
  ajax: { ana: '#D2122E', vurgu: '#1A1A1A' },
  psv: { ana: '#ED1C24', vurgu: '#9AA0A6' },
  feyenoord: { ana: '#E60026', vurgu: '#1A1A1A' },
  // Fransa
  parissaintgermain: { ana: '#004170', vurgu: '#DA291C' },
  marseille: { ana: '#0098D7', vurgu: '#9AA0A6' },
};

// Ad normalizasyonu: küçük harf + Türkçe karakter sadeleştirme + harf dışı at.
// "Arsenal FC" → "arsenalfc", "Beşiktaş JK" → "besiktasjk".
export function adNormalize(name) {
  return String(name || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z]/g, '');
}

/** Takım adına tema döndürür; listede yoksa null (varsayılan tema kalır). */
export function takimTemasi(name) {
  const norm = adNormalize(name);
  if (!norm) return null;
  for (const [anahtar, tema] of Object.entries(TAKIM_RENKLERI)) {
    if (norm.includes(anahtar)) return tema;
  }
  return null;
}

// ---------------------------------------------------------------------------
// KOMPLE TEMA (kullanıcı isteği, 2026-08-04: "komple her yer için"):
// tema, uygulamanın TEMEL renk paletine (theme.js colors) işlenir — böylece
// colors.primary/accent kullanan HER ekran kulüp renginde açılır.
// Stiller modül yüklenirken sabitlendiği için bu işlem AÇILIŞTA yapılır;
// takım değişince web'de sayfa bir kez yenilenir (TeamPickerScreen).
// ---------------------------------------------------------------------------

/** '#RRGGBB' rengi verilen oranda koyulaştırır (0-1). Saf. */
export function koyulastir(hex, oran) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const k = (x) => Math.max(0, Math.round(x * (1 - oran)));
  const r = k((n >> 16) & 255), g = k((n >> 8) & 255), b = k(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** '#RRGGBB' + alfa (0-1) → rgba() dizesi. Saf. */
export function alfa(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Palet ezmeleri: theme.js colors nesnesine uygulanacak alan → değer. Saf. */
export function paletEzmeleri(tema) {
  if (!tema) return {};
  return {
    primary: tema.ana,
    primaryDark: koyulastir(tema.ana, 0.3),
    primarySoft: alfa(tema.vurgu, 0.16),
    accent: tema.ana,
    accentSoft: alfa(tema.ana, 0.12),
  };
}

export const TAKIM_TEMA_ANAHTARI = 'sportoto.takimTema.v1';

/** Kalıcı tema kaydını oku (yalnız web'de senkron çalışır; yoksa null). */
export function kayitliTemayiOku() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const ham = localStorage.getItem(TAKIM_TEMA_ANAHTARI);
    if (!ham) return null;
    const t = JSON.parse(ham);
    return (t && t.ana && t.vurgu) ? t : null;
  } catch { return null; }
}

/** Temayı kalıcı yaz/sil (web). Yazma başarısızsa sessiz geçilir. */
export function temayiKaydet(tema) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (tema) localStorage.setItem(TAKIM_TEMA_ANAHTARI, JSON.stringify(tema));
    else localStorage.removeItem(TAKIM_TEMA_ANAHTARI);
  } catch { /* sessiz */ }
}

/** İki renk düzeni ("açık mod / koyu mod" gibi): ana ↔ vurgu yer değiştirir.
 * GS örneği: kırmızı-ağırlıklı düzen ↔ sarı-ağırlıklı düzen. Saf. */
export function tersTema(tema) {
  if (!tema) return null;
  return { ana: tema.vurgu, vurgu: tema.ana };
}
