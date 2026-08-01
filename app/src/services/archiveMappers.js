// app/src/services/archiveMappers.js
// SAF dönüştürücüler: backend arşiv API yanıtları → ekranların kullandığı
// Bulletin / AnalysisSnapshot biçimleri (types/bulletin.js, types/analysis.js).
// KURALLAR:
//  * halfTimeScore YENİ MOTORDA KULLANILMAZ: geriye uyumluluk için alan hep null
//    yazılır; API'den gelse bile OKUNMAZ.
//  * Veri yoksa null/"Bu veri bulunamadı" — sahte değer üretilmez.
//  * Geçmiş bülten SNAPSHOT verisinden gösterilir; güncel takım verisiyle
//    yeniden hesap YAPILMAZ (bu dosyada hiçbir analiz hesabı yoktur).

const VALID = new Set(['1', 'X', '2']);

// '1X' / '12' / '1X2' gösterimini tek tek sembollere açar (başarı kıyası için).
export function expandDisplayPick(display) {
  if (!display) return [];
  const out = [];
  for (const ch of String(display)) if (VALID.has(ch)) out.push(ch);
  return out;
}

export function displayPickHits(display, officialResult) {
  const set = expandDisplayPick(display);
  if (!set.length || !officialResult) return null;
  return set.includes(officialResult);
}

const formLine = (arr) => (Array.isArray(arr) && arr.length ? arr.join(' ') : null);

// Payload'daki GERÇEK takım verisinden kısa, dürüst özet metni. Veri yoksa null.
export function buildStatsSummary(m) {
  const parts = [];
  const h = m?.teamData?.home, a = m?.teamData?.away;
  if (h?.last5?.length) parts.push(`Ev son 5: ${formLine(h.last5)}`);
  if (a?.last5?.length) parts.push(`Dep son 5: ${formLine(a.last5)}`);
  if (h?.standing?.position != null && a?.standing?.position != null) {
    parts.push(`Sıra: ${h.standing.position}. vs ${a.standing.position}.`);
  }
  if (m?.market?.probabilities) {
    const p = m.market.probabilities;
    parts.push(`İhtimal 1/X/2: %${p['1']}/%${p['X']}/%${p['2']}${m.market.probabilitiesEstimated ? ' (tahminî)' : ''}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

// ---- Bülten listesi öğesi → Bulletin (liste kartı için) --------------------
export function mapBulletinSummary(apiB) {
  const total = apiB.totalMatches ?? null;
  const rs = apiB.resultSummary;
  return {
    id: String(apiB.id),
    bulletinNo: [apiB.season, apiB.week].filter(Boolean).join(' · ') || `#${apiB.roundId}`,
    roundId: apiB.roundId,
    date: apiB.firstMatchStartAt || apiB.createdAt || null,
    status: apiB.status,                              // draft/active/locked/completed/cancelled (aynı sözlük)
    createdAt: apiB.createdAt || null,
    firstMatchStartAt: apiB.firstMatchStartAt || null,
    freezeAt: apiB.freezeAt || null,
    lockedAt: apiB.lockedAt || null,
    completedAt: apiB.completedAt || null,
    // Liste görünümü maç satırı çizmez; kart yalnız adet kullanır.
    matches: Array.from({ length: total || 0 }, (_, i) => ({ id: `${apiB.id}-m${i + 1}`, orderNo: i + 1 })),
    preMatchSnapshotId: apiB.snapshot?.exists ? apiB.snapshot.id || `snap-${apiB.id}` : null,
    immutable: !!apiB.immutable,
    verificationHash: apiB.snapshot?.verificationHash || null,
    shortHash: apiB.snapshot?.shortHash || null,
    dataGaps: apiB.dataGaps || null,
    resultSummary: rs
      ? {
        systemCorrect: rs.correct ?? 0,
        systemWrong: (rs.predicted ?? 0) - (rs.correct ?? 0),
        systemAccuracy: rs.accuracy ?? 0,
        resolvedCount: rs.predicted ?? 0,
        totalCount: rs.totalMatches ?? total ?? 0,
      }
      : null,
    _finishedCount: apiB.resolvedCount ?? 0,
    _source: 'api',
  };
}

// ---- Bülten detayı → Bulletin (maç satırlarıyla) ---------------------------
export function mapBulletinDetail(apiB) {
  const base = mapBulletinSummary(apiB);
  const matches = (apiB.matches || []).map((m) => ({
    id: String(m.matchId),
    bulletinId: base.id,
    orderNo: m.orderNo,
    code: `${base.id}-${String(m.orderNo).padStart(2, '0')}`,
    homeTeam: { name: m.homeName || '' },
    awayTeam: { name: m.awayName || '' },
    league: m.league || '',
    startTime: m.kickoffAt || null,
    status: m.official ? 'finished' : 'not_started',
    halfTimeScore: null,                              // yeni motor okumaz/yazmaz (geriye uyumlu alan)
    fullTimeScore: m.official?.fullTimeScore ?? null, // yalnız resmî 90 dk skoru
    result1x2: m.official?.result ?? null,            // yalnız resmî 1/X/2
    resultSource: m.official?.source ?? null,
    resultConfirmedAt: m.official?.confirmedAt ?? null,
    correctionVersion: m.official?.correctionVersion ?? null,
  }));
  return { ...base, matches, _finishedCount: matches.filter((m) => m.result1x2).length };
}

// ---- Snapshot + (varsa) sonuç/değerlendirme → AnalysisSnapshot -------------
// resultsByMatchId: { [matchId]: { officialResult, fullTimeScore } }
// evalByMatchId: { [matchId]: { correct, officialResult, fullTimeScore } }
export function mapSnapshot(apiSnap, { resultsByMatchId = {}, evalByMatchId = {} } = {}) {
  if (!apiSnap?.payload) return null;
  const payload = apiSnap.payload;
  const matchesAnalysis = (payload.matches || []).map((m) => {
    const key = String(m.matchId);
    const ev = evalByMatchId[key] || null;
    const res = ev || resultsByMatchId[key] || null;
    const display = m.systemPrediction?.display || null;
    const actual = res?.officialResult ?? null;
    const systemCorrect = ev ? (ev.correct ?? null) : displayPickHits(display, actual);
    return {
      matchId: key,
      orderNo: m.no,
      prediction: display,                            // '1' | 'X' | '2' | '1X' | 'X2' | '12' | '1X2' | null
      predictionLabel: m.systemPrediction?.label ?? null,
      predictionReason: m.systemPrediction?.reason ?? null,
      confidenceScore: m.confidence?.favoritePercent ?? null,   // gerçek veriden (favori ihtimali); yoksa null
      surpriseRisk: m.confidence?.surpriseScore ?? m.radar?.surpriseScore ?? null,
      dataConfidence: m.confidence?.dataConfidence ?? null,     // 'Düşük' | 'Orta' (asla 'Yüksek' — veri eksikliği kuralı)
      analysisComment: m.aiComment || m.analysisComment || null,
      statsSummary: buildStatsSummary(m),
      lineupComment: m.missingPlayersNote || 'Bu veri bulunamadı.',
      missingPlayers: [],                             // kaynak yok — boş (uydurma isim YOK)
      radarLabel: m.radar?.label ?? null,
      favorite: m.radar?.favorite ?? null,
      dataQuality: m.dataQuality ?? null,
      dataTimestamp: payload.lock?.dataObservedAt || apiSnap.lockedAt || null,
      createdAt: apiSnap.createdAt || null,
      version: 1,
      isLocked: true,
      resultInfo: res
        ? {
          halfTimeScore: null,                        // ilk yarı bu sistemde kullanılmaz
          fullTimeScore: res.fullTimeScore ?? null,
          actualResult: actual,
          systemCorrect,
          userCorrect: null,
          errorTag: null,                             // hata etiketi verisi yok — uydurulmaz
          errorNote: systemCorrect === false && display
            ? `Sistem ${display} bekliyordu, resmî sonuç ${actual} geldi.`
            : null,
        }
        : null,
    };
  });
  return {
    id: apiSnap.id || `snap-${apiSnap.bulletinId}`,
    bulletinId: String(apiSnap.bulletinId),
    version: 1,
    schemaVersion: apiSnap.schemaVersion || null,
    engineVersion: apiSnap.engineVersion || null,
    createdAt: apiSnap.createdAt || null,
    lockedAt: apiSnap.lockedAt || null,
    dataObservedAt: apiSnap.dataObservedAt || null,
    late: !!apiSnap.late,
    isLocked: true,
    immutable: apiSnap.immutable !== false,
    verificationHash: apiSnap.verificationHash || null,
    shortHash: apiSnap.verificationHash ? apiSnap.verificationHash.slice(0, 10) : null,
    matchesAnalysis,
    _source: 'api',
  };
}

// results API yanıtı → { [matchId]: {...} } indeksi
export function indexResults(apiResults) {
  const map = {};
  for (const r of apiResults?.results || []) {
    map[String(r.matchId)] = { officialResult: r.officialResult, fullTimeScore: r.fullTimeScore };
  }
  return map;
}

// evaluation API yanıtı → { [matchId]: {...} } indeksi
export function indexEvaluation(apiEval) {
  const map = {};
  for (const m of apiEval?.matches || []) {
    map[String(m.matchId)] = { correct: m.correct, officialResult: m.officialResult, fullTimeScore: m.fullTimeScore };
  }
  return map;
}
