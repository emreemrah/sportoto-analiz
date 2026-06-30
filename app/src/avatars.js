// Hazır futbol temalı avatarlar.
// Binary asset / telifli logo YOK: her avatar = emoji + renkli yuvarlak zemin.
// Bu sayede web + native'de net görünür, lisans/asset derdi olmaz.

export const CATEGORIES = [
  { key: 'balls', label: 'Toplar' },
  { key: 'pitch', label: 'Saha' },
  { key: 'goal', label: 'Kale' },
  { key: 'tactics', label: 'Taktik' },
  { key: 'jersey', label: 'Forma' },
  { key: 'score', label: 'Tahmin / Skor' },
];

export const PRESETS = [
  // Toplar
  { key: 'ball_01', cat: 'balls', emoji: '⚽', bg: '#16a34a', label: 'Futbol Topu' },
  { key: 'ball_02', cat: 'balls', emoji: '⚽', bg: '#0f766e', label: 'Maç Topu' },
  // Saha
  { key: 'pitch_top_01', cat: 'pitch', emoji: '🏟️', bg: '#15803d', label: 'Saha (üstten)' },
  { key: 'pitch_01', cat: 'pitch', emoji: '🌱', bg: '#22c55e', label: 'Yeşil Saha' },
  { key: 'midfield_01', cat: 'pitch', emoji: '🟢', bg: '#166534', label: 'Orta Saha' },
  { key: 'lights_01', cat: 'pitch', emoji: '🌃', bg: '#0f766e', label: 'Gece Işıkları' },
  // Kale
  { key: 'goal_01', cat: 'goal', emoji: '🥅', bg: '#0ea5e9', label: 'Kale' },
  { key: 'gloves_01', cat: 'goal', emoji: '🧤', bg: '#2563eb', label: 'Kaleci Eldiveni' },
  // Taktik
  { key: 'tactics_01', cat: 'tactics', emoji: '📋', bg: '#7c3aed', label: 'Taktik Tahtası' },
  { key: 'boot_01', cat: 'tactics', emoji: '👟', bg: '#b45309', label: 'Krampon' },
  { key: 'card_01', cat: 'tactics', emoji: '🟨', bg: '#ca8a04', label: 'Kart' },
  // Forma
  { key: 'jersey_01', cat: 'jersey', emoji: '👕', bg: '#dc2626', label: 'Forma (kırmızı)' },
  { key: 'jersey_02', cat: 'jersey', emoji: '👕', bg: '#1d4ed8', label: 'Forma (mavi)' },
  // Tahmin / Skor
  { key: 'scoreboard_01', cat: 'score', emoji: '🔢', bg: '#334155', label: 'Skor Tabelası' },
  { key: 'trophy_01', cat: 'score', emoji: '🏆', bg: '#ca8a04', label: 'Kupa' },
  { key: 'pick_1', cat: 'score', emoji: '1️⃣', bg: '#2dd4bf', label: 'Tahmin 1' },
  { key: 'pick_x', cat: 'score', emoji: '✖️', bg: '#64748b', label: 'Tahmin X' },
  { key: 'pick_2', cat: 'score', emoji: '2️⃣', bg: '#fbbf24', label: 'Tahmin 2' },
];

// Varsayılan avatar (avatar seçilmemiş / kaldırılmış kullanıcı)
export const DEFAULT_AVATAR = { key: 'default', emoji: '⚽', bg: '#16a34a', label: 'Varsayılan' };

export const getPreset = (key) => PRESETS.find((p) => p.key === key) || DEFAULT_AVATAR;
export const presetsByCategory = (catKey) => PRESETS.filter((p) => p.cat === catKey);
