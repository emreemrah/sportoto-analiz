// app/src/theme.js

export const colors = {
  background: '#F3F5F9',
  surface: '#FFFFFF',
  surfaceSoft: '#F8FAFC',

  primary: '#0B1B3A',
  primaryDark: '#071329',
  primarySoft: '#E8EEF8',

  accent: '#E21B2D',
  accentSoft: '#FFE8EB',

  success: '#16A34A',
  successSoft: '#E8F7EE',

  warning: '#F59E0B',
  warningSoft: '#FFF4DD',

  danger: '#DC2626',
  dangerSoft: '#FEE2E2',

  info: '#2563EB',
  infoSoft: '#EAF1FF',

  text: '#101828',
  textSoft: '#475467',
  muted: '#98A2B3',
  border: '#E4E7EC',

  darkCard: '#111C34',
  darkCardSoft: '#18243F',
  white: '#FFFFFF',
  black: '#000000',

  // --- Geriye dönük uyumluluk (eski token adları → yeni palet) ---
  bg: '#F3F5F9',
  bgAlt: '#F8FAFC',
  card: '#FFFFFF',
  cardAlt: '#E8EEF8',
  textMuted: '#98A2B3',
  field: '#16A34A',
  gold: '#F59E0B',
  green: '#16A34A',
  yellow: '#F59E0B',
  red: '#DC2626',
  gray: '#98A2B3',
  orange: '#F59E0B',
  track: '#E8EEF8',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const font = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 26,

  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
};

export const shadow = {
  card: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  soft: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
};

// --- Geriye dönük uyumluluk export'ları (eski isimler) ---
export const shadows = shadow;
export const labelColors = {
  green: colors.success,
  yellow: colors.warning,
  red: colors.danger,
  gray: colors.muted,
};

export const theme = {
  colors,
  spacing,
  radius,
  font,
  shadow,
  shadows,
};

export default theme;
