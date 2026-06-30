export const colors = {
  bg: '#0a1715',        // koyu petrol yeşili (siyaha yakın)
  card: '#142e29',      // koyu petrol kart
  cardAlt: '#1c3b35',
  text: '#f1f5f9',
  textMuted: '#9bb3ac',
  border: '#26483f',
  primary: '#2dd4bf',
  // sürpriz etiket renkleri
  green: '#22c55e',
  yellow: '#fbbf24',
  red: '#ef4444',
  gray: '#64748b',
  orange: '#f97316', // kıyas çubuğunda deplasman
  track: '#26483f',  // çubuk arka planı

  // --- Premium yeniden tasarım token'ları ---
  accent: '#f97316',                 // ANA VURGU — turuncu (aktif sekme, butonlar)
  accentSoft: 'rgba(249,115,22,0.14)',
  field: '#22c55e',                  // ikincil vurgu — saha yeşili
  gold: '#fbbf24',                   // yardımcı vurgu (çok az)
  bgAlt: '#0f2420',                  // yumuşak koyu petrol zemin (header/şerit)
};

// Premium kart gölgeleri (temiz, hafif)
export const shadows = {
  card: {
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  soft: {
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
};

// Backend'ten gelen labelColor -> gerçek renk
export const labelColors = {
  green: colors.green,
  yellow: colors.yellow,
  red: colors.red,
  gray: colors.gray,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16 };
