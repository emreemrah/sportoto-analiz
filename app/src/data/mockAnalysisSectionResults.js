// app/src/data/mockAnalysisSectionResults.js
// Analiz Başarı Dashboard için MOCK veri katmanı.
//
// GEÇMİŞ KAYIT MANTIĞI: Her kayıt, maç BAŞLAMADAN ÖNCEKİ analiz bölümünün
// snapshot'ıdır (createdAt/lockedAt/isLocked). Sonuç geldikten sonra bu snapshot
// DEĞİŞMEZ; yalnızca ayrı alanlar (actualOutcome/wasCorrect/wasMisleading/…)
// sonradan doldurulur. Yani eski analiz ezilmez, sonuç ayrı eklenir.
//
// UI bu dosyayı DOĞRUDAN okumaz — services/analysisPerformanceService.js üzerinden
// erişilir (mevcut mockPerformance/performanceService deseniyle aynı).

// ————— Ölçülen analiz bölümleri (esnek liste; sabit hardcoded değil) —————
export const ANALYSIS_SECTIONS = [
  { key: 'match_summary', title: 'Maç Özeti', type: 'text' },
  { key: 'recent_matches', title: 'Son Maçlar', type: 'form' },
  { key: 'match_analysis', title: 'Maç Analizi', type: 'analysis' },
  { key: 'prediction_analysis', title: 'Tahmin Analizi', type: 'prediction' },
  { key: 'strong_signals', title: 'Güçlü Sinyaller', type: 'signal' },
  { key: 'win_probabilities', title: 'Kazanma İhtimalleri', type: 'probability' },
  { key: 'prediction_note', title: 'Tahmin Notu', type: 'note' },
  { key: 'risk_analysis', title: 'Risk Analizi', type: 'risk' },
  { key: 'lineup_analysis', title: 'Kadro Analizi', type: 'lineup' },
  { key: 'missing_players', title: 'Eksik / Cezalı Oyuncular', type: 'lineup' },
  { key: 'form_status', title: 'Form Durumu', type: 'form' },
  { key: 'stats_summary', title: 'İstatistik Özeti', type: 'stats' },
  { key: 'xg_stats', title: 'xG / Şut İstatistikleri', type: 'stats' },
  { key: 'home_away_performance', title: 'Ev / Deplasman Performansı', type: 'stats' },
  { key: 'community_prediction', title: 'Topluluk Tahmini', type: 'community' },
  { key: 'confidence_score', title: 'Güven Skoru', type: 'signal' },
  { key: 'surprise_risk', title: 'Sürpriz Riski', type: 'risk' },
];

// ————— Ölçülen istatistik sinyalleri —————
export const ANALYSIS_SIGNALS = [
  { key: 'last5_form', title: 'Son 5 Maç Formu' },
  { key: 'last10_form', title: 'Son 10 Maç Formu' },
  { key: 'home_performance', title: 'Ev Sahibi Performansı' },
  { key: 'away_performance', title: 'Deplasman Performansı' },
  { key: 'goal_avg', title: 'Gol Ortalaması' },
  { key: 'conceded_avg', title: 'Yenen Gol Ortalaması' },
  { key: 'xg_value', title: 'xG Değeri' },
  { key: 'shots', title: 'Şut Sayısı' },
  { key: 'shots_on_target', title: 'İsabetli Şut' },
  { key: 'corners', title: 'Korner' },
  { key: 'card_risk', title: 'Kart Riski' },
  { key: 'missing_players', title: 'Kadro Eksikleri' },
  { key: 'suspension_effect', title: 'Cezalı Oyuncu Etkisi' },
  { key: 'injury_effect', title: 'Sakat Oyuncu Etkisi' },
  { key: 'favorite_odds', title: 'Favori Oranı' },
  { key: 'draw_tendency', title: 'Beraberlik Eğilimi' },
  { key: 'surprise_risk', title: 'Sürpriz Riski' },
  { key: 'community_majority', title: 'Topluluk Tahmin Çoğunluğu' },
  { key: 'confidence_score', title: 'Sistem Güven Skoru' },
];

export const ERROR_TAGS = [
  'favorite_failed', 'draw_missed', 'away_win_missed', 'home_win_overrated',
  'lineup_effect_missed', 'injury_effect_missed', 'red_card_effect', 'late_goal',
  'low_confidence_prediction', 'high_confidence_failed', 'surprise_not_detected',
  'form_signal_failed', 'xg_signal_failed', 'community_signal_failed',
  'risk_analysis_failed', 'strong_signal_failed', 'odds_misleading', 'unknown',
];

export const ERROR_TAG_LABEL = {
  favorite_failed: 'Favori kaybetti',
  draw_missed: 'Kaçırılan beraberlik',
  away_win_missed: 'Kaçırılan deplasman galibiyeti',
  home_win_overrated: 'Ev sahibi abartıldı',
  lineup_effect_missed: 'Kadro etkisi kaçırıldı',
  injury_effect_missed: 'Sakatlık etkisi kaçırıldı',
  red_card_effect: 'Kırmızı kart etkisi',
  late_goal: 'Geç gol',
  low_confidence_prediction: 'Düşük güvenli tahmin',
  high_confidence_failed: 'Yüksek güven yanıldı',
  surprise_not_detected: 'Sürpriz yakalanamadı',
  form_signal_failed: 'Form sinyali yanıltıcı',
  xg_signal_failed: 'xG sinyali yanıltıcı',
  community_signal_failed: 'Topluluk sinyali yanıltıcı',
  risk_analysis_failed: 'Risk analizi yanıltıcı',
  strong_signal_failed: 'Güçlü sinyal yanıltıcı',
  odds_misleading: 'Oran yanıltıcı',
  unknown: 'Belirsiz',
};

export const SUCCESS_TAGS = [
  'favorite_correct', 'draw_detected', 'away_win_detected', 'lineup_risk_detected',
  'surprise_detected', 'strong_signal_worked', 'confidence_score_worked',
  'risk_warning_worked', 'form_signal_worked', 'stats_signal_worked',
];

export const SIGNAL_DIRECTIONS = ['1', 'X', '2', 'over', 'under', 'risky', 'safe', 'no_clear_signal'];
export const SIGNAL_STRENGTHS = ['low', 'medium', 'high'];

const LEAGUES = ['Allsvenskan', 'K League 1', 'Süper Lig CN', 'İrlanda Prem.', 'Superettan'];
const MATCH_TYPES = ['favorite', 'balanced', 'surprise'];

// ————— Deterministik sözde-rastgele (seed sabit → her yüklemede aynı veri) —————
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260704);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// Her bölümün "tasarımsal" başarı eğilimi (gerçekçi kırılım için) — 0-1 doğru olasılığı.
const SECTION_BASE_RATE = {
  match_summary: 0.68, recent_matches: 0.61, match_analysis: 0.71, prediction_analysis: 0.66,
  strong_signals: 0.70, win_probabilities: 0.64, prediction_note: 0.63, risk_analysis: 0.57,
  lineup_analysis: 0.73, missing_players: 0.72, form_status: 0.60, stats_summary: 0.65,
  xg_stats: 0.69, home_away_performance: 0.67, community_prediction: 0.52, confidence_score: 0.71,
  surprise_risk: 0.58,
};
const SIGNAL_BASE_RATE = {
  last5_form: 0.58, last10_form: 0.62, home_performance: 0.70, away_performance: 0.55,
  goal_avg: 0.61, conceded_avg: 0.60, xg_value: 0.72, shots: 0.59, shots_on_target: 0.66,
  corners: 0.51, card_risk: 0.54, missing_players: 0.73, suspension_effect: 0.68,
  injury_effect: 0.64, favorite_odds: 0.63, draw_tendency: 0.40, surprise_risk: 0.62,
  community_majority: 0.49, confidence_score: 0.71,
};

const ERROR_BY_OUTCOME = {
  '1': ['home_win_overrated', 'high_confidence_failed', 'strong_signal_failed', 'odds_misleading'],
  'X': ['draw_missed', 'form_signal_failed', 'community_signal_failed'],
  '2': ['away_win_missed', 'favorite_failed', 'surprise_not_detected', 'lineup_effect_missed'],
};
const SUCCESS_BY_DIR = {
  '1': ['favorite_correct', 'form_signal_worked', 'stats_signal_worked'],
  'X': ['draw_detected', 'strong_signal_worked'],
  '2': ['away_win_detected', 'surprise_detected', 'confidence_score_worked'],
  risky: ['risk_warning_worked', 'surprise_detected'],
  safe: ['confidence_score_worked', 'favorite_correct'],
};

// ————— Kayıtları üret —————
const N_MATCHES = 48; // ölçülen maç sayısı
const nowIso = '2026-07-01T18:00:00.000Z';

function buildMatches() {
  const matches = [];
  for (let i = 0; i < N_MATCHES; i++) {
    const league = pick(LEAGUES);
    const matchType = pick(MATCH_TYPES);
    const actual = matchType === 'surprise'
      ? pick(['X', '2', '2'])
      : matchType === 'favorite'
        ? pick(['1', '1', '1', 'X'])
        : pick(['1', 'X', '2']);
    const confidence = matchType === 'favorite' ? 60 + Math.floor(rnd() * 35)
      : matchType === 'surprise' ? 30 + Math.floor(rnd() * 30)
        : 45 + Math.floor(rnd() * 30);
    const surpriseRisk = matchType === 'surprise' ? 60 + Math.floor(rnd() * 35)
      : matchType === 'favorite' ? 10 + Math.floor(rnd() * 30)
        : 35 + Math.floor(rnd() * 30);
    matches.push({
      matchId: `m_${1000 + i}`,
      bulletinId: `2025/2026-${44 + (i % 4)}`,
      league,
      matchType,
      home: `Takım ${String.fromCharCode(65 + (i % 20))}`,
      away: `Takım ${String.fromCharCode(66 + (i % 19))}`,
      actualOutcome: actual,
      confidence,
      surpriseRisk,
    });
  }
  return matches;
}

const MATCHES = buildMatches();

// AnalysisSectionResult snapshot'ları (maç × bölüm)
function buildSectionResults() {
  const out = [];
  let id = 1;
  for (const m of MATCHES) {
    for (const sec of ANALYSIS_SECTIONS) {
      // Her bölüm her maçta ölçülmeyebilir (kadro gibi veriye bağlı) → gerçekçi eksik veri
      if (sec.type === 'lineup' && rnd() < 0.35) continue;
      const strength = pick(SIGNAL_STRENGTHS);
      // Bölümün yönlendirdiği sinyal yönü (maç öncesi tahmin)
      let dir = rnd() < 0.15 ? 'no_clear_signal'
        : (sec.type === 'risk' ? pick(['risky', 'safe'])
          : pick(['1', '1', 'X', '2']));
      const base = SECTION_BASE_RATE[sec.key] ?? 0.6;
      const correct = dir !== 'no_clear_signal' && rnd() < base;
      // Güçlü sinyal verip ters gelirse "misleading"
      const wasMisleading = !correct && dir !== 'no_clear_signal' && strength === 'high';
      const errorTags = correct ? []
        : (dir === 'no_clear_signal' ? []
          : [pick(ERROR_BY_OUTCOME[m.actualOutcome] || ['unknown'])]);
      const successTags = correct ? [pick(SUCCESS_BY_DIR[dir] || ['stats_signal_worked'])] : [];
      out.push({
        id: `asr_${id++}`,
        bulletinId: m.bulletinId,
        matchId: m.matchId,
        league: m.league,
        matchType: m.matchType,
        sectionKey: sec.key,
        sectionTitle: sec.title,
        sectionType: sec.type,
        createdAt: nowIso,
        lockedAt: nowIso,
        isLocked: true,
        signalDirection: dir,
        signalStrength: strength,
        confidence: m.confidence,
        summaryText: `${sec.title} → ${dir} (${strength})`,
        dataUsed: ['form', 'odds', 'xg'].slice(0, 1 + Math.floor(rnd() * 3)),
        expectedOutcome: dir,
        actualOutcome: m.actualOutcome,
        wasCorrect: correct,
        wasMisleading,
        impactScore: Math.round((correct ? 55 : 20) + rnd() * 40),
        errorTags,
        successTags,
        notes: '',
      });
    }
  }
  return out;
}

// Sinyal ölçüm kayıtları (maç × sinyal)
function buildSignalResults() {
  const out = [];
  let id = 1;
  for (const m of MATCHES) {
    for (const sig of ANALYSIS_SIGNALS) {
      if (rnd() < 0.25) continue; // her sinyal her maçta kullanılmaz
      const strength = pick(SIGNAL_STRENGTHS);
      const base = SIGNAL_BASE_RATE[sig.key] ?? 0.6;
      const correct = rnd() < base;
      out.push({
        id: `sig_${id++}`,
        bulletinId: m.bulletinId,
        matchId: m.matchId,
        league: m.league,
        matchType: m.matchType,
        signalKey: sig.key,
        signalTitle: sig.title,
        strength,          // low | medium | high
        value: Math.round(rnd() * 100),
        wasCorrect: correct,
        wasMisleading: !correct && strength === 'high',
        actualOutcome: m.actualOutcome,
        createdAt: nowIso,
        isLocked: true,
      });
    }
  }
  return out;
}

export const mockAnalysisSectionResults = buildSectionResults();
export const mockSignalResults = buildSignalResults();
export const mockAnalysisMatches = MATCHES;
