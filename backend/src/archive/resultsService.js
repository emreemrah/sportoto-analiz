// SONUÇ + DEĞERLENDİRME + ÖĞRENME SINIRI
// * Resmî sonuçlar (yalnız 90 dk 1/X/2 + tam maç skoru) snapshot'tan AYRI
//   tabloya yazılır. İlk yarı skoru bu motora HİÇ girmez (okunmaz/yazılmaz).
// * Bülten tamamlanınca kilitli snapshot tahminleri resmî sonuçla kıyaslanır;
//   sonuç snapshot'a GERİ YAZILMAZ (hash değişmez — testler kanıtlar).
// * Öğrenme sınırı: bir bültenin değerlendirmesi ancak SONRAKİ bültenlerde
//   (roundId daha büyük) kullanılabilir → data leakage engellenir.
import { getArchiveStore } from './store.js';
import { ValidationError, NotFoundError } from './errors.js';
import { POSITION_STATS_MIN_SAMPLE } from './constants.js';

const VALID_RESULTS = new Set(['1', 'X', '2']);

// '10' → ['1','X'] · '102' → ['1','X','2'] · '0'/'X' → ['X']
export function expandPick(sym) {
  return String(sym ?? '')
    .split('')
    .map((c) => (c === '0' ? 'X' : c))
    .filter((c) => VALID_RESULTS.has(c));
}

export function pickHits(sym, officialResult) {
  const set = expandPick(sym);
  if (!set.length || !officialResult) return null;
  return set.includes(officialResult);
}

// --------------------------------------------------------------------------
// RESMÎ SONUÇ YAZIMI — yalnız 1/X/2 + tam maç skoru kabul edilir.
// officialMatches: sources/sportoto.js getBulletinByRoundId(...).matches biçimi
// ({ no, sportotoMatchId, result: '1'|'X'|'2'|null, score: {home,away}|null }).
// İlk yarı bilgisi gelse bile OKUNMAZ. Düzeltme → correctionVersion + audit.
// --------------------------------------------------------------------------
export async function ingestOfficialResults(bulletinId, officialMatches, {
  store = getArchiveStore(), source = 'Spor Toto resmi API', actor = 'worker',
} = {}) {
  const id = String(bulletinId);
  let added = 0, corrected = 0, resolved = 0;
  for (const m of officialMatches || []) {
    const result = m.result ?? null;
    const score = m.score ?? null;
    if (result == null && score == null) continue;                    // sonuç yok → yazma (uydurma yok)
    if (!VALID_RESULTS.has(result)) continue;                          // yalnız resmî 1/X/2
    if (!score || !Number.isInteger(score.home) || !Number.isInteger(score.away)
      || score.home < 0 || score.away < 0) continue;                   // tam maç skoru şart
    const { changed, corrected: wasCorrected } = await store.upsertOfficialResult({
      bulletinId: id,
      matchId: String(m.sportotoMatchId ?? m.no),
      orderNo: m.no ?? null,
      officialResult: result,
      fullTimeScore: { home: score.home, away: score.away },           // İLK YARI ALANI YOK
      resultSource: source,
    });
    resolved += 1;
    if (changed && wasCorrected) {
      corrected += 1;
      await store.appendAudit({
        bulletinId: id, action: 'result_correction', actor,
        reason: 'Resmî kaynak sonucu düzeltti — orijinal snapshot değişmedi, düzeltme ayrı kayıt.',
        newValue: { matchId: String(m.sportotoMatchId ?? m.no), result, score },
      });
    } else if (changed) {
      added += 1;
    }
  }
  if (added) {
    await store.appendAudit({ bulletinId: id, action: 'results_ingested', actor, newValue: { added, resolvedNow: resolved } });
  }
  return { added, corrected, resolved };
}

// --------------------------------------------------------------------------
// TAMAMLAMA + DEĞERLENDİRME
// 15 maçın resmî sonucu geldiyse: status=completed + snapshot_evaluations kaydı.
// Değerlendirme YALNIZ kilitli snapshot payload'ı + resmî sonuçlardan üretilir
// (güncel veri KULLANILMAZ). effectiveFromRoundId = roundId + 1.
// --------------------------------------------------------------------------
export async function maybeCompleteAndEvaluate(bulletinId, { store = getArchiveStore(), now = Date.now() } = {}) {
  const id = String(bulletinId);
  const b = await store.getBulletin(id);
  if (!b) throw new NotFoundError(`Bülten yok (${id}).`);
  if (b.status === 'completed') {
    const ev = await store.getEvaluation(id);
    if (ev) return { completed: true, evaluated: false, evaluation: ev };
  }
  const snap = await store.getSnapshot(id);
  if (!snap) return { completed: false, reason: 'snapshot_yok' };

  const results = await store.listOfficialResults(id);
  const byMatch = new Map(results.map((r) => [String(r.matchId), r]));
  const totalMatches = snap.payload?.matches?.length || 0;
  const resolved = snap.payload?.matches?.filter((m) => byMatch.has(String(m.matchId))).length || 0;
  if (!totalMatches || resolved < totalMatches) {
    return { completed: false, reason: 'sonuclar_eksik', resolved, totalMatches };
  }

  const matches = snap.payload.matches.map((m) => {
    const r = byMatch.get(String(m.matchId));
    const frozen = m.systemPrediction?.symbol ?? null;
    const correct = pickHits(frozen, r.officialResult);
    const isSingle = expandPick(frozen).length === 1;
    const favorite = m.radar?.favorite?.symbol ?? null;
    const radarLabel = m.radar?.label ?? null;
    // BANKO sonucu: "banko" denen maçta favori kazandı mı?
    const banko = radarLabel === 'BANKO' && favorite ? favorite === r.officialResult : null;
    // SÜRPRİZ sinyali sonucu: "sürprize açık" denen maçta favori KAZANAMADI mı?
    const surprise = radarLabel === 'SÜRPRİZE AÇIK' && favorite ? favorite !== r.officialResult : null;
    const criteriaHits = m.criteria?.signals
      ? Object.fromEntries(Object.entries(m.criteria.signals).map(([k, sig]) => [k, sig === r.officialResult]))
      : null;
    return {
      no: m.no, matchId: m.matchId,
      frozenPrediction: frozen, frozenDisplay: m.systemPrediction?.display ?? null,
      officialResult: r.officialResult, fullTimeScore: r.fullTimeScore,
      resultSource: r.resultSource, correctionVersion: r.correctionVersion || 1,
      correct, isSingle,
      banko, surprise,
      radarLabel, favorite,
      favoriteHit: favorite ? favorite === r.officialResult : null,
      criteriaHits,
    };
  });

  const withPick = matches.filter((m) => m.correct !== null);
  const correct = withPick.filter((m) => m.correct).length;
  const singles = matches.filter((m) => m.isSingle && m.correct !== null);
  const bankoM = matches.filter((m) => m.banko !== null);
  const surpM = matches.filter((m) => m.surprise !== null);
  const byResult = { '1': { t: 0, c: 0 }, X: { t: 0, c: 0 }, '2': { t: 0, c: 0 } };
  for (const m of withPick) {
    if (byResult[m.officialResult]) {
      byResult[m.officialResult].t += 1;
      if (m.correct) byResult[m.officialResult].c += 1;
    }
  }
  const rate = (c, t) => (t ? Math.round((c / t) * 100) : null);

  const evaluation = {
    bulletinId: id,
    roundId: b.roundId,
    snapshotId: snap.id,
    snapshotHash: snap.payloadHash,                    // hangi mühürlü halin değerlendirildiğinin kanıtı
    evaluatedAt: new Date(now).toISOString(),
    resultSource: 'Spor Toto resmi API',
    effectiveFromRoundId: b.roundId + 1,               // ÖĞRENME SINIRI: yalnız sonraki bültenlerde kullanılabilir
    summary: {
      totalMatches,
      predicted: withPick.length,
      correct,
      wrong: withPick.length - correct,
      accuracy: rate(correct, withPick.length),
      single: singles.length,
      singleCorrect: singles.filter((m) => m.correct).length,
      singleAccuracy: rate(singles.filter((m) => m.correct).length, singles.length),
      banko: { total: bankoM.length, hit: bankoM.filter((m) => m.banko).length, rate: rate(bankoM.filter((m) => m.banko).length, bankoM.length) },
      surprise: { total: surpM.length, hit: surpM.filter((m) => m.surprise).length, rate: rate(surpM.filter((m) => m.surprise).length, surpM.length) },
      byResult: {
        '1': { ...byResult['1'], rate: rate(byResult['1'].c, byResult['1'].t) },
        X: { ...byResult.X, rate: rate(byResult.X.c, byResult.X.t) },
        '2': { ...byResult['2'], rate: rate(byResult['2'].c, byResult['2'].t) },
      },
    },
    matches,
  };

  await store.saveEvaluation(evaluation);
  await store.upsertBulletin({ id, roundId: b.roundId, status: 'completed', completedAt: new Date(now).toISOString() });
  await store.appendAudit({
    bulletinId: id, action: 'evaluate', actor: 'worker',
    newValue: { correct, predicted: withPick.length, effectiveFromRoundId: evaluation.effectiveFromRoundId, snapshotHash: snap.payloadHash },
  });
  console.log(`[arsiv] ✅ bülten ${id} tamamlandı: ${correct}/${withPick.length} doğru (değerlendirme kaydedildi).`);
  return { completed: true, evaluated: true, evaluation };
}

// --------------------------------------------------------------------------
// ÖĞRENME SINIRLI PERFORMANS — "kilit anında bilinen" kriter/radar başarıları.
// forRoundId verildiğinde YALNIZ roundId < forRoundId olan (yani daha önce
// tamamlanmış) bültenlerin değerlendirmeleri toplanır. Aynı bültenin sonucu
// kendi snapshot'ına/kalan maçlarına ASLA sızmaz.
// --------------------------------------------------------------------------
export async function getCriteriaPerformanceBefore(forRoundId, { store = getArchiveStore() } = {}) {
  const evals = (await store.listEvaluations())
    .filter((e) => forRoundId == null || (Number(e.roundId) < Number(forRoundId)
      && Number(forRoundId) >= Number(e.effectiveFromRoundId ?? e.roundId + 1)));
  if (!evals.length) return { sampleRounds: 0, criteria: null, radarLabels: null };

  const criteria = {};
  const radarLabels = {};
  for (const ev of evals) {
    for (const m of ev.matches || []) {
      if (m.criteriaHits) {
        for (const [key, hit] of Object.entries(m.criteriaHits)) {
          if (!criteria[key]) criteria[key] = { total: 0, hit: 0 };
          criteria[key].total += 1;
          if (hit) criteria[key].hit += 1;
        }
      }
      if (m.radarLabel && m.favoriteHit !== null) {
        if (!radarLabels[m.radarLabel]) radarLabels[m.radarLabel] = { total: 0, favoriteWin: 0 };
        radarLabels[m.radarLabel].total += 1;
        if (m.favoriteHit) radarLabels[m.radarLabel].favoriteWin += 1;
      }
    }
  }
  for (const k of Object.keys(criteria)) {
    criteria[k].accuracy = Math.round((criteria[k].hit / criteria[k].total) * 100);
  }
  for (const k of Object.keys(radarLabels)) {
    radarLabels[k].favoriteWinRate = Math.round((radarLabels[k].favoriteWin / radarLabels[k].total) * 100);
  }
  return { sampleRounds: evals.length, upToRoundId: forRoundId ?? null, criteria, radarLabels };
}

// --------------------------------------------------------------------------
// BÜLTEN SIRA HAFIZASI — "1. sıradaki maçlar tarihsel olarak nasıl bitti?"
// Yalnız RESMÎ sonuçlanmış (completed) bültenlerden; tahminin tek nedeni olarak
// KULLANILMAZ — gelecekteki "Bülten Hafızası Radarı" için yardımcı veridir.
// --------------------------------------------------------------------------
export async function getPositionStats({ position = null, fromRound = null, toRound = null, season = null } = {}, {
  store = getArchiveStore(),
} = {}) {
  const bulletins = (await store.listBulletins())
    .filter((b) => b.status === 'completed')
    .filter((b) => (fromRound == null || b.roundId >= Number(fromRound)))
    .filter((b) => (toRound == null || b.roundId <= Number(toRound)))
    .filter((b) => (season == null || String(b.season || '') === String(season)));

  const posFilter = position != null ? Number(position) : null;
  if (posFilter != null && !(posFilter >= 1 && posFilter <= 15)) {
    throw new ValidationError('position 1–15 aralığında olmalı.');
  }

  const byPos = new Map(); // orderNo -> { total, counts: {1,X,2} }
  let usedBulletins = 0;
  let minRound = null, maxRound = null;
  for (const b of bulletins) {
    const results = await store.listOfficialResults(b.id);
    if (!results.length) continue;
    let used = false;
    for (const r of results) {
      if (r.orderNo == null || !VALID_RESULTS.has(r.officialResult)) continue;
      if (posFilter != null && Number(r.orderNo) !== posFilter) continue;
      const key = Number(r.orderNo);
      if (!byPos.has(key)) byPos.set(key, { total: 0, counts: { '1': 0, X: 0, '2': 0 } });
      const rec = byPos.get(key);
      rec.total += 1;
      rec.counts[r.officialResult] += 1;
      used = true;
    }
    if (used) {
      usedBulletins += 1;
      minRound = minRound == null ? b.roundId : Math.min(minRound, b.roundId);
      maxRound = maxRound == null ? b.roundId : Math.max(maxRound, b.roundId);
    }
  }

  const pct = (c, t) => (t ? Math.round((c / t) * 100) : null);
  const positions = [...byPos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pos, rec]) => ({
      position: pos,
      sample: rec.total,
      counts: rec.counts,
      pct: { '1': pct(rec.counts['1'], rec.total), X: pct(rec.counts.X, rec.total), '2': pct(rec.counts['2'], rec.total) },
      lowSample: rec.total < POSITION_STATS_MIN_SAMPLE,
    }));

  return {
    generatedAt: new Date().toISOString(),
    source: 'Resmî Spor Toto sonuçları (tamamlanmış bültenler)',
    filters: { position: posFilter, fromRound: fromRound != null ? Number(fromRound) : null, toRound: toRound != null ? Number(toRound) : null, season: season ?? null },
    sampleBulletins: usedBulletins,
    roundRange: usedBulletins ? { from: minRound, to: maxRound } : null,
    minSample: POSITION_STATS_MIN_SAMPLE,
    note: usedBulletins === 0
      ? 'Henüz tamamlanmış bülten yok — veri toplandıkça dolacak.'
      : (positions.some((p) => p.lowSample) ? `Bazı sıralarda örneklem ${POSITION_STATS_MIN_SAMPLE} altında — oranlar henüz istatistiksel olarak oturmadı.` : null),
    usage: 'Yardımcı veridir; tek başına tahmin gerekçesi olarak kullanılmaz.',
    positions,
  };
}
