// app/src/services/analysisPerformanceService.js
// Analiz Başarı Dashboard hesap katmanı.
//
// UI mock veriyi doğrudan okumaz; bu servis üzerinden erişir (mevcut
// performanceService deseniyle aynı). Hesaplar SADECE kilitli (isLocked)
// snapshot'lar + sonradan eklenen sonuç alanları üzerinden yapılır — eski
// analiz ezilmez, sonuç ayrı değerlendirilir.
import {
  mockAnalysisSectionResults,
  mockSignalResults,
  ANALYSIS_SECTIONS,
  ANALYSIS_SIGNALS,
  ERROR_TAG_LABEL,
} from '../data/mockAnalysisSectionResults';

const rate = (correct, total) => (total ? Math.round((correct / total) * 100) : 0);

function acc(list) {
  const total = list.length;
  const correct = list.filter((x) => x.wasCorrect).length;
  const misleading = list.filter((x) => x.wasMisleading).length;
  return { total, correct, misleading, rate: rate(correct, total) };
}

// Bir liste için lig bazlı başarı kırılımı
function byLeague(list, minTotal = 3) {
  const map = new Map();
  for (const x of list) {
    const k = x.league || 'Bilinmeyen';
    const e = map.get(k) || { league: k, total: 0, correct: 0 };
    e.total += 1;
    if (x.wasCorrect) e.correct += 1;
    map.set(k, e);
  }
  return [...map.values()]
    .filter((e) => e.total >= minTotal)
    .map((e) => ({ ...e, rate: rate(e.correct, e.total) }))
    .sort((a, b) => b.rate - a.rate);
}

// En sık hata etiketi
function topErrorTag(list) {
  const counts = {};
  for (const x of list) for (const t of x.errorTags || []) counts[t] = (counts[t] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? { tag: top[0], label: ERROR_TAG_LABEL[top[0]] || top[0], count: top[1] } : null;
}

const avg = (nums) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0);

export async function getAnalysisPerformanceDashboard() {
  // ⚠️ PROVENANCE: tamamen mock veri — üretimde gerçek karne yerine GÖSTERİLMEZ.
  const { demoDataAllowed } = await import('./performanceService');
  if (!demoDataAllowed()) return null;
  const sections = mockAnalysisSectionResults;
  const signals = mockSignalResults;

  // A) Genel karne
  const measurable = sections.filter((s) => s.signalDirection !== 'no_clear_signal');
  const overall = acc(measurable);
  const byDir = (d) => acc(measurable.filter((s) => s.signalDirection === d));

  // B) Bölüm bazlı başarı tablosu
  const sectionPerf = ANALYSIS_SECTIONS.map((sec) => {
    const all = sections.filter((s) => s.sectionKey === sec.key);
    const measured = all.filter((s) => s.signalDirection !== 'no_clear_signal');
    const a = acc(measured);
    return {
      key: sec.key,
      title: sec.title,
      type: sec.type,
      ...a,                                   // total, correct, misleading, rate
      noSignal: all.length - measured.length, // no_clear_signal sayısı (ayrı işlenir)
      avgConfidence: avg(measured.map((s) => s.confidence)),
      avgImpact: avg(measured.map((s) => s.impactScore)),
      topError: topErrorTag(measured),
      leagues: byLeague(measured),
    };
  }).filter((s) => s.total > 0)
    .sort((a, b) => b.rate - a.rate);

  // C) Sinyal bazlı başarı (yüksek/düşük ayrımıyla)
  const signalPerf = ANALYSIS_SIGNALS.map((sig) => {
    const all = signals.filter((s) => s.signalKey === sig.key);
    const a = acc(all);
    const highList = all.filter((s) => s.strength === 'high');
    const lowList = all.filter((s) => s.strength === 'low');
    return {
      key: sig.key,
      title: sig.title,
      ...a,
      whenHigh: acc(highList),
      whenLow: acc(lowList),
      leagues: byLeague(all),
    };
  }).filter((s) => s.total > 0)
    .sort((a, b) => b.rate - a.rate);

  const mostSuccessfulSignals = [...signalPerf].filter((s) => s.total >= 5).slice(0, 5);
  const mostMisleadingSignals = [...signalPerf]
    .filter((s) => s.total >= 5)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  // D) Hata haritası (etiket dağılımı + örnek hatalar)
  const errorCounts = {};
  for (const s of sections) for (const t of s.errorTags || []) errorCounts[t] = (errorCounts[t] || 0) + 1;
  const errorBreakdown = Object.entries(errorCounts)
    .map(([tag, count]) => ({ tag, label: ERROR_TAG_LABEL[tag] || tag, count }))
    .sort((a, b) => b.count - a.count);

  const sampleErrors = sections
    .filter((s) => s.wasMisleading)
    .slice(0, 6)
    .map((s) => ({
      matchId: s.matchId,
      league: s.league,
      section: s.sectionTitle,
      systemSaid: s.signalDirection,
      actual: s.actualOutcome,
      errorTag: s.errorTags[0] || 'unknown',
      errorLabel: ERROR_TAG_LABEL[s.errorTags[0]] || 'Belirsiz',
    }));

  // E) Lig bazlı genel başarı
  const leaguePerf = byLeague(measurable, 4);

  // F) Risk analizi / güçlü sinyal doğrulaması
  const riskSections = measurable.filter((s) => s.sectionType === 'risk');
  const riskWarned = riskSections.filter((s) => s.signalDirection === 'risky');
  const riskHitRate = riskWarned.length
    ? rate(riskWarned.filter((s) => s.actualOutcome === '2' || s.actualOutcome === 'X').length, riskWarned.length)
    : 0;
  const strong = sections.filter((s) => s.sectionKey === 'strong_signals' && s.signalStrength === 'high' && s.signalDirection !== 'no_clear_signal');
  const strongRate = acc(strong).rate;

  const worstArea = sectionPerf.length ? [...sectionPerf].sort((a, b) => a.rate - b.rate)[0] : null;

  return {
    generatedAt: new Date().toISOString(),
    // GÜVEN BAYRAĞI: Bu veri şu an MOCK. Gerçek section-result snapshot'ları
    // (maç-öncesi bölüm sinyali + sonuç değerlendirmesi) üretilmeden, başarı
    // oranları kullanıcıya GERÇEK gibi gösterilmez. Gerçek pipeline eklenince
    // hasRealData=true olur ve isDemo=false döner.
    isDemo: true,
    provenanceType: 'demo',
    hasRealData: false,
    // A
    totalMeasured: overall.total,
    matchesCovered: new Set(sections.map((s) => s.matchId)).size,
    overallRate: overall.rate,
    overallCorrect: overall.correct,
    overallMisleading: overall.misleading,
    byPick: { '1': byDir('1'), X: byDir('X'), '2': byDir('2') },
    avgConfidence: avg(measurable.map((s) => s.confidence)),
    worstArea,
    riskHitRate,
    strongSignalRate: strongRate,
    // B / C / D / E
    sectionPerf,
    signalPerf,
    mostSuccessfulSignals,
    mostMisleadingSignals,
    errorBreakdown,
    sampleErrors,
    leaguePerf,
  };
}
