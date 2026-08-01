// VERİ KALİTESİ — her radar kendi dataQuality'sini (0-100) bu yardımcılarla üretir.
// Master dataQuality: aktif radarların ağırlıklı ortalaması.
// Seviyeler kullanıcıya dürüstçe gösterilir; düşük kalite güçlü etiketi ENGELLER.

export const QUALITY_LEVELS = [
  { min: 85, key: 'fresh', label: 'Güncel' },
  { min: 60, key: 'partial', label: 'Kısmen eksik' },
  { min: 35, key: 'stale', label: 'Eski/eksik veri' },
  { min: 1, key: 'poor', label: 'Yetersiz örneklem' },
  { min: 0, key: 'none', label: 'Kaynak bulunamadı' },
];

export function qualityLevel(score) {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const row = QUALITY_LEVELS.find((r) => s >= r.min) || QUALITY_LEVELS[QUALITY_LEVELS.length - 1];
  return { score: s, key: row.key, label: row.label };
}

// parts: [{ ok: boolean, weight: number }] → yüzde
export function qualityFromParts(parts) {
  const total = parts.reduce((s, p) => s + p.weight, 0);
  if (!total) return 0;
  const got = parts.reduce((s, p) => s + (p.ok ? p.weight : 0), 0);
  return Math.round((got / total) * 100);
}

// Aktif radarların ağırlıklı master kalitesi.
// items: [{ weight (normalize %), dataQuality }]
export function masterDataQuality(items) {
  const act = items.filter((r) => r.weight > 0);
  const wsum = act.reduce((s, r) => s + r.weight, 0);
  if (!wsum) return 0;
  return Math.round(act.reduce((s, r) => s + r.weight * (r.dataQuality || 0), 0) / wsum);
}
