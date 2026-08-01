// MASTER ANALİZ MOTORU — sürümlü/configurable ayarlar (tek kaynak).
// Değerler değişirse METHODOLOGY_VERSION artırılır; eski mühürlü analizler
// kendi sürümleriyle DEĞİŞMEDEN kalır.

export const ANALYSIS_METHODOLOGY_VERSION = 'master-analysis-1.0.0';
export const CRITERIA_CATALOG_VERSION = 'criteria-catalog-2.0.0'; // 40 mevcut kriter, key'ler DEĞİŞMEDİ

// Etki seviyeleri (kullanıcı seçer)
export const IMPACT_WEIGHTS = { low: 1, mid: 2, high: 3, critical: 4 };
export const IMPACT_LABELS = { low: 'Düşük', mid: 'Orta', high: 'Yüksek', critical: 'Kritik' };
export const IMPACT_ORDER = ['low', 'mid', 'high', 'critical'];

// SİNYAL AİLELERİ — aynı bilgiyi ölçen kriterler bağımsız oy sayılmaz.
export const ANALYSIS_FAMILIES = {
  league_strength: 'Lig Gücü',
  form: 'Form',
  points_results: 'Puan / Sonuçlar',
  goals: 'Gol',
  xg: 'xG',
  venue: 'İç Saha / Deplasman',
  attacking_activity: 'Hücum Aktivitesi',
  discipline: 'Disiplin',
  squad: 'Kadro',
  coach: 'Teknik Direktör',
  contextual: 'Bağlamsal',
  draw_tendency: 'Beraberlik Eğilimi',
};

// Aile içi azalan katkı: en güçlü %100, ikinci %50, üçüncü %25, sonrası %10.
export const ANALYSIS_FAMILY_DECAY = [1, 0.5, 0.25, 0.1];

// Karar eşikleri (sürümlü başlangıç yaklaşımı)
export const DECISION_RULES = {
  clearLeadPct: 12,          // normalize destek: lider - ikinci ≥ 12 puan → TEKLİ tercih
  doubleBandPct: 12,         // ilk iki yakınsa → ÇİFTE tercih
  tripleSpreadPct: 12,       // üç yön de bu banda sıkışıksa → 1X2 / Yüksek Belirsizlik
  minDecisiveCriteria: 2,    // yön gösteren kriter sayısı altındaysa güçlü tahmin yok
  lowDataQuality: 50,        // altında güçlü tahmin/etiket verilmez
  highConflict: 55,          // üstünde "Banko için uygun değil"
  strongConfidenceLead: 20,
};

// Akıllı Destek Modu — güvenilirlik faktörü sınırları (aşırı ağırlık engeli)
export const RELIABILITY = {
  minSampleForAdjust: 30,    // altında ağırlık HİÇ değişmez (az örnekli %100 şişemez)
  softSample: 100,           // 30-99 arası etki yarıya kırpılır
  maxBoost: 1.25,            // en fazla +%25
  maxCut: 0.75,              // en fazla −%25
  baselineByDirection: { '1': 45, X: 27, '2': 28 }, // kaba taban oranlar (kıyas çapası)
};

// Rakip gücü dilimleri — SIRA YÜZDELİĞİ ile (küçük ligde sabit sıra yanıltmasın)
export const OPPONENT_TIERS = {
  version: 'opponent-tiers-1.0.0',
  strongMaxPct: 0.33,        // üst %33 → Güçlü
  midMaxPct: 0.67,           // %34-67 → Orta
  labels: { strong: 'Güçlü', mid: 'Orta', weak: 'Zayıf' },
  minSampleForFilter: 2,     // filtreli formda en az 2 maç yoksa "yeterli maç yok"
};

// Filtre seçenekleri (global + kriter bazlı override)
export const FILTER_OPTIONS = {
  period: [
    { key: 'season', label: 'Bu sezon' },
    { key: 'last5', label: 'Son 5 maç' },
    { key: 'blend', label: 'Sezon + Son 5 ağırlıklı' },
  ],
  venueScope: [
    { key: 'overall', label: 'Genel' },
    { key: 'split', label: 'Ev içi / Dep dışı' },
    { key: 'weighted', label: 'İç/Dış ağırlıklı' },
  ],
  opponentStrength: [
    { key: 'all', label: 'Tümü' },
    { key: 'strong', label: 'Güçlü rakiplere karşı' },
    { key: 'mid', label: 'Orta rakiplere karşı' },
    { key: 'weak', label: 'Zayıf rakiplere karşı' },
  ],
};
export const DEFAULT_FILTERS = { period: 'season', venueScope: 'overall', opponentStrength: 'all' };

// Örneklem merdiveni (karne)
export const SAMPLE_CLASSES = [
  { min: 0, max: 9, label: 'Yetersiz', usable: false },
  { min: 10, max: 29, label: 'Düşük', usable: true },
  { min: 30, max: 99, label: 'Orta', usable: true },
  { min: 100, max: Infinity, label: 'Güçlü', usable: true },
];
export function sampleClass(n) {
  const r = SAMPLE_CLASSES.find((x) => n >= x.min && n <= x.max) || SAMPLE_CLASSES[0];
  return { n, label: r.label, usable: r.usable };
}

// Bayesian shrinkage: küçük örneklemde oran tabana çekilir (3/3 = %100 şişmez).
export function shrunkRate(hits, total, baselinePct = 33.3, priorN = 12) {
  if (!total) return null;
  return Math.round(((hits + (baselinePct / 100) * priorN) / (total + priorN)) * 100);
}

// RESMÎ SİSTEM PROFİLİ — uygulamanın yayımladığı Master Analiz bu profille
// hesaplanır ve her hafta snapshot'a mühürlenir. Sürümlüdür.
export const OFFICIAL_PROFILE = {
  id: 'official-master',
  name: 'Sistem Master Analizi',
  version: 'official-profile-1.0.0',
  mode: 'manual',                 // resmî analiz manuel ağırlıklarla (deterministik)
  globalFilters: { ...DEFAULT_FILTERS },
  // Kriterler: veri gelen TÜM kriterler varsayılan etkileriyle açık.
  // (missingPlayers vb. veri-yok kriterleri açıktır ama veri gelmediği sürece
  //  otomatik "analiz dışı" kalır — dürüstlük kuralı.)
  allOnWithDefaults: true,
};
