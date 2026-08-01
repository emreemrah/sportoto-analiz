// KARNE SERVİSİ — Sistem Karnesi (resmî ileri-test), Kapsama, Retrospektif.
// ---------------------------------------------------------------------------
// * ANA SİSTEM KARNESİ yalnız mühürlü resmî profil Master Analiz tahmininin
//   (officialMasterAnalysis.mainPrediction — TEKLİ 1/X/2) resmî 90 dk
//   sonucuyla karşılaştırılmasıdır. 1X / X2 / 12 / 1X2 / 102 / 02 gibi kapalı
//   tercihler ANA BAŞARIYA GİRMEZ — yalnız ayrı "Kapsama Başarısı"nda ölçülür.
// * Uygunluk: scorecards/provenance.js'teki TEK merkezî default-deny kuralı.
// * Eski cache kayıtları SİLİNMEZ; sınıflandırılır ve yalnız Retrospektif/Legacy
//   bölümünde, "RESMÎ BAŞARIYA DAHİL DEĞİLDİR" etiketiyle raporlanır.
import { load, listSnapshotRounds, listRadarRounds } from '../cache.js';
import { getArchiveStore } from '../archive/store.js';
import {
  PROVENANCE, recordFromArchive, recordFromLegacyCache, classifyRecord, exclusionBreakdown,
} from './provenance.js';

const rate = (c, t) => (t ? Math.round((c / t) * 100) : 0);
const rate1 = (c, t) => (t ? Math.round((c / t) * 1000) / 10 : 0); // %86,7 gibi tek ondalık

// Kapalı tercih açılımı: '102' → ['1','X','2'], '02' → ['X','2'], '1' → ['1'].
export const expandPick = (sym) => String(sym || '')
  .split('')
  .map((c) => (c === '0' ? 'X' : c))
  .filter((c) => ['1', 'X', '2'].includes(c));

export const isSinglePick = (sym) => expandPick(sym).length === 1;

// ---------------------------------------------------------------------------
// ARŞİV KAYITLARINI TOPLA + SINIFLANDIR (tüm karnelerin ortak girdisi)
// ---------------------------------------------------------------------------
export async function collectArchiveRecords({ store = getArchiveStore(), requireOfficialProfile = true } = {}) {
  const rows = [];
  let bulletins = [];
  try { bulletins = await store.listBulletins(); } catch { bulletins = []; }
  for (const b of bulletins.sort((x, y) => Number(y.roundId) - Number(x.roundId))) {
    const snap = await store.getSnapshot(b.id).catch(() => null);
    const rec = recordFromArchive(b, snap);
    const cls = classifyRecord(rec, { requireOfficialProfile });
    let results = [];
    if (snap) results = await store.listOfficialResults(b.id).catch(() => []);
    rows.push({ bulletin: b, snap, rec, cls, results });
  }
  return rows;
}

// Eski dosya-cache kayıtları (snapshot-*.json) — yalnız sınıflandırma/retrospektif.
export function collectLegacyCacheRecords() {
  return listSnapshotRounds().map((roundId) => {
    const data = load(`snapshot-${roundId}`)?.data ?? null;
    const rec = recordFromLegacyCache(roundId, data);
    const cls = classifyRecord(rec); // legacy cache hiçbir zaman official_forward çıkamaz
    return { roundId: Number(roundId), data, rec, cls };
  });
}

// ---------------------------------------------------------------------------
// ANA SİSTEM KARNESİ — yalnız official_forward + resmî profil mühürlü tahmin.
// ---------------------------------------------------------------------------
export async function buildSystemScorecard({ store = getArchiveStore() } = {}) {
  const archive = await collectArchiveRecords({ store, requireOfficialProfile: true });
  const legacy = collectLegacyCacheRecords();

  const included = [];
  const excluded = [];
  for (const row of archive) (row.cls.isOfficialForward ? included : excluded).push(row);

  let total = 0, correct = 0, wrong = 0;
  const byResult = { '1': { t: 0, c: 0 }, X: { t: 0, c: 0 }, '2': { t: 0, c: 0 } };
  const cov = { total: 0, covered: 0, single: 0, singleCovered: 0, multi: 0, multiCovered: 0 };
  const weeks = [];
  const errors = [];
  const methodologies = new Set();
  const profileVersions = new Set();

  for (const { bulletin, snap, rec, results } of included) {
    const resBy = new Map(results.map((r) => [String(r.matchId), r]));
    const matches = snap.payload?.matches || [];
    const wk = {
      roundId: Number(bulletin.roundId), round: bulletin.week ?? null, year: bulletin.season ?? null,
      snapshotAt: rec.lockedAt, freezeAt: rec.freezeAt,
      methodologyVersion: rec.methodologyVersion, officialProfileVersion: rec.officialProfileVersion,
      verificationHashShort: rec.verificationHash ? rec.verificationHash.slice(0, 10) : null,
      provenanceType: PROVENANCE.OFFICIAL_FORWARD,
      matchCount: matches.length,
      predicted: 0, resolved: 0, correct: 0, wrong: 0, missing: 0,
      coverage: { total: 0, covered: 0 },
    };
    if (rec.methodologyVersion) methodologies.add(rec.methodologyVersion);
    if (rec.officialProfileVersion) profileVersions.add(String(rec.officialProfileVersion));

    for (const m of matches) {
      const master = m.analysisCenter?.officialMasterAnalysis;
      const main = master && master.ok !== false ? master.mainPrediction : null;
      const official = resBy.get(String(m.matchId));
      const officialResult = official?.officialResult ?? null;

      if (main && ['1', 'X', '2'].includes(main)) wk.predicted += 1; else { wk.missing += 1; }
      if (officialResult) wk.resolved += 1;

      // ANA BAŞARI: yalnız TEKLİ mühürlü mainPrediction × resmî sonuç.
      if (main && ['1', 'X', '2'].includes(main) && officialResult) {
        total += 1;
        if (byResult[officialResult]) byResult[officialResult].t += 1;
        const hit = main === officialResult;
        if (hit) {
          correct += 1; wk.correct += 1;
          if (byResult[officialResult]) byResult[officialResult].c += 1;
        } else {
          wrong += 1; wk.wrong += 1;
          errors.push({
            roundId: wk.roundId, round: wk.round, no: m.no,
            home: m.home?.mediumName || m.home?.name || '',
            away: m.away?.mediumName || m.away?.name || '',
            system: main, result: officialResult,
            score: official?.fullTimeScore ? `${official.fullTimeScore.home}-${official.fullTimeScore.away}` : null,
          });
        }
      }

      // KAPSAMA (AYRI ölçüm): mühürlü kupon tahmini (çoklu olabilir) sonucu kapsadı mı?
      const sym = m.systemPrediction?.symbol ?? null;
      const set = expandPick(sym);
      if (set.length && officialResult) {
        cov.total += 1; wk.coverage.total += 1;
        const coveredHit = set.includes(officialResult);
        if (coveredHit) { cov.covered += 1; wk.coverage.covered += 1; }
        if (set.length === 1) { cov.single += 1; if (coveredHit) cov.singleCovered += 1; }
        else { cov.multi += 1; if (coveredHit) cov.multiCovered += 1; }
      }
    }

    // HAFTA DURUMU: complete / partial / pending — eksik hafta "13/15" gibi
    // TAM hafta performansı olarak SUNULMAZ (status açıkça verilir).
    const evaluated = wk.correct + wk.wrong;
    wk.status = evaluated === 0 ? 'pending'
      : (wk.predicted === wk.matchCount && wk.resolved === wk.matchCount) ? 'complete' : 'partial';
    wk.evaluated = evaluated;
    wk.accuracy = rate(wk.correct, evaluated);
    wk.record = evaluated ? `${wk.correct}/${evaluated}` : null;
    weeks.push(wk);
  }

  const evaluatedWeeks = weeks.filter((w) => w.status !== 'pending');
  const pendingWeeks = weeks.filter((w) => w.status === 'pending');
  const last5 = evaluatedWeeks.slice(0, 5);
  const l5t = last5.reduce((s, w) => s + w.evaluated, 0);
  const l5c = last5.reduce((s, w) => s + w.correct, 0);
  const best = evaluatedWeeks.reduce((b, w) => (!b || w.accuracy > b.accuracy ? w : b), null);

  // Legacy/retrospektif özet (resmî başarıya DAHİL DEĞİL — yalnız sayım).
  const legacyCounts = countByType(legacy.map((l) => l.cls));
  const excludedCounts = exclusionBreakdown(excluded.map((e) => e.cls));
  for (const [k, v] of Object.entries(legacyCounts)) excludedCounts[k] = (excludedCounts[k] || 0) + v;

  return {
    generatedAt: new Date().toISOString(),
    title: 'Sistem Master Analizi — Tekli Ana Tahmin İsabeti',
    predictionSource: 'Mühürlü resmî profil Master Analiz tahmini (officialMasterAnalysis.mainPrediction)',
    resultSource: 'Resmî Spor Toto 90 dakika sonuçları (ayrı kayıt olarak eklenir)',
    note: 'Yalnız maç öncesi mühürlendiği DOĞRULANAN tahminler dahildir. Demo, backfill ve retrospektif kayıtlar bu başarıya girmez.',
    hasData: total > 0,
    hasOfficialForwardData: included.length > 0,
    isDemo: false,
    // ANA (TEKLİ) BAŞARI
    weeksCounted: evaluatedWeeks.length,
    pendingWeeks: pendingWeeks.length,
    total, correct, wrong,
    accuracy: rate(correct, total),
    accuracy1: rate1(correct, total),
    last5: { total: l5t, correct: l5c, accuracy: rate(l5c, l5t), weeks: last5.length },
    bestWeek: best ? { roundId: best.roundId, round: best.round, record: best.record, accuracy: best.accuracy } : null,
    byResult: {
      '1': { ...byResult['1'], rate: rate(byResult['1'].c, byResult['1'].t) },
      X: { ...byResult.X, rate: rate(byResult.X.c, byResult.X.t) },
      '2': { ...byResult['2'], rate: rate(byResult['2'].c, byResult['2'].t) },
    },
    // KAPSAMA (AYRI — ana başarı DEĞİL)
    coverage: {
      hasData: cov.total > 0,
      total: cov.total, covered: cov.covered, rate: rate(cov.covered, cov.total),
      single: { total: cov.single, covered: cov.singleCovered, rate: rate(cov.singleCovered, cov.single) },
      multi: { total: cov.multi, covered: cov.multiCovered, rate: rate(cov.multiCovered, cov.multi) },
      note: 'Kapsama başarısı, sistemin tekli ana tahmin doğruluğu değildir. Birden fazla sonuç seçeneği içerdiği için başarı oranı doğal olarak daha yüksektir.',
    },
    weeks,
    errors: errors.slice(0, 60),
    // PROVENANCE ŞEFFAFLIĞI
    includedCount: included.length,
    excludedCount: excluded.length + legacy.length,
    exclusionBreakdown: excludedCounts,
    // NOT: hariç tutulan kayıtların DETAY listesi resmî yanıtta taşınmaz —
    // yalnız /api/scorecards/provenance (geliştirici/denetim) ucundadır.
    legacySeparationNote: 'Eski geliştirme kayıtları resmî başarıdan ayrılmıştır ve bu karneye dahil edilmez.',
    methodologyVersions: [...methodologies],
    officialProfileVersions: [...profileVersions],
    emptyStateNote: total > 0 ? null
      : 'Henüz resmî ileri-test verisi yok. Sistem Karnesi, gerçek Spor Toto bültenlerinde ilk maçtan 5 dakika önce mühürlenen tahminler sonuçlandıkça otomatik oluşacaktır. Demo ve geçmişe dönük testler bu başarıya dahil edilmez.',
  };
}

function countByType(classList) {
  const out = {};
  for (const c of classList) out[c.provenanceType] = (out[c.provenanceType] || 0) + 1;
  return out;
}

// ---------------------------------------------------------------------------
// RETROSPEKTİF / LEGACY BÖLÜMÜ — resmî başarıya DAHİL DEĞİLDİR.
// Eski cache tahminleri (kapsama usulü) resmi sonuçlarla İSTEĞE BAĞLI ölçülür;
// sonuç servisi enjekte edilir (fetchBulletin) — ağ yoksa yalnız sayım döner.
// ---------------------------------------------------------------------------
export async function buildRetrospectiveScorecard({ fetchBulletin = null } = {}) {
  const legacy = collectLegacyCacheRecords();
  const weeks = [];
  let total = 0, covered = 0, singleTotal = 0, singleCorrect = 0;

  for (const { roundId, data, rec, cls } of legacy) {
    const picks = data?.picks || [];
    const wk = {
      roundId, round: data?.round ?? null,
      provenanceType: cls.provenanceType,
      backfilled: rec.backfilled === true,
      savedAt: rec.createdAt,
      pickCount: rec.pickCount ?? 0,
      total: 0, covered: 0, singleTotal: 0, singleCorrect: 0,
      resultsAvailable: false,
    };
    if (fetchBulletin && picks.length) {
      try {
        const bulletin = await fetchBulletin(Number(roundId));
        const byNo = new Map(picks.map((p) => [p.no, p]));
        for (const m of bulletin.matches || []) {
          if (!(m.result && m.score)) continue;
          const sym = byNo.get(m.no)?.symbol;
          const set = expandPick(sym);
          if (!set.length) continue;
          wk.resultsAvailable = true;
          wk.total += 1; total += 1;
          const hit = set.includes(m.result);
          if (hit) { wk.covered += 1; covered += 1; }
          if (set.length === 1) {
            wk.singleTotal += 1; singleTotal += 1;
            if (hit) { wk.singleCorrect += 1; singleCorrect += 1; }
          }
        }
      } catch { /* sonuç alınamadı — yalnız sayım gösterilir, uydurma yok */ }
    }
    weeks.push(wk);
  }

  const counts = countByType(legacy.map((l) => l.cls));
  return {
    generatedAt: new Date().toISOString(),
    label: 'RESMÎ BAŞARIYA DAHİL DEĞİLDİR',
    note: 'Bu bölümdeki kayıtlar geçmiş haftalara sonradan üretilmiş (backfill) veya kanıtı eksik (unknown) tahminlerdir. Yalnız teknik/retrospektif inceleme içindir; sistemin gerçek ileri-test başarısı değildir.',
    hasData: legacy.length > 0,
    isOfficialForward: false,
    weekCount: legacy.length,
    countsByType: counts,
    matchCount: total,
    coverage: { total, covered, rate: rate(covered, total) },
    single: { total: singleTotal, correct: singleCorrect, rate: rate(singleCorrect, singleTotal) },
    weeks: weeks.sort((a, b) => b.roundId - a.roundId),
  };
}

// ---------------------------------------------------------------------------
// GERİYE UYUMLU YANITLAR — eski /api/system-scorecard ve /api/criteria-scorecard
// uçları bu eşlemeleri döner (tek doğruluk kaynağı; eski kirli hesap YOK).
// ---------------------------------------------------------------------------
export async function legacySystemScorecardResponse({ store = getArchiveStore() } = {}) {
  const s = await buildSystemScorecard({ store });
  return {
    ...s,
    source: `${s.predictionSource} × ${s.resultSource}`,
    // Ana başarı zaten TEKLİ tahmin olduğundan single* alanları ana ölçümle birebirdir
    // (eski istemciler kırılmaz; kapalı tercihler bu sayılara ASLA girmez).
    single: s.total, singleCorrect: s.correct, singleAccuracy: s.accuracy,
  };
}

export async function legacyCriteriaScorecardResponse({ store = getArchiveStore(), buildCriterionScorecard } = {}) {
  const s = await buildCriterionScorecard({ store });
  return {
    generatedAt: s.generatedAt,
    source: s.source,
    hasData: s.hasData,
    hasOfficialForwardData: s.hasOfficialForwardData,
    isDemo: false,
    isOfficialForward: true,
    provenanceType: s.provenanceType,
    includedCount: s.includedCount, excludedCount: s.excludedCount,
    exclusionBreakdown: s.exclusionBreakdown,
    weeksCounted: s.roundsCounted,
    // GERÇEK sayım (analysisService'ten): resmî sonucu olan maç adedi.
    // Eski hâl "kriterler arasındaki en yüksek sinyal sayısı"nı alıyordu —
    // yalnız her maçta sinyal veren sabit homeAdvantage sayesinde tesadüfen
    // doğru görünüyordu; o kriter karneden çıkınca tanım da düzeltildi.
    matchesCounted: s.matchesCounted ?? 0,
    note: s.note,
    criteria: s.criteria
      .filter((c) => !c.informational && c.signals > 0)
      .map((c) => ({
        key: c.key, label: c.label, total: c.signals, hit: c.hits,
        accuracy: c.accuracy ?? 0, lowSample: !c.sample?.usable,
      }))
      .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total),
  };
}

// ---------------------------------------------------------------------------
// PROVENANCE DÖKÜMÜ — teknik ekran + denetim raporu.
// ---------------------------------------------------------------------------
export async function buildProvenanceReport({ store = getArchiveStore() } = {}) {
  const archive = await collectArchiveRecords({ store, requireOfficialProfile: true });
  const legacy = collectLegacyCacheRecords();
  const legacyRadar = listRadarRounds().map((rid) => {
    const d = load(`radar-${rid}`)?.data ?? null;
    return { roundId: Number(rid), source: 'legacy-radar-cache', backfilled: d?.backfilled === true, radarFrozenAt: d?.radarFrozenAt ?? null };
  });

  const records = [
    ...archive.map(({ bulletin, rec, cls, results }) => ({
      source: 'archive', roundId: Number(bulletin.roundId), round: bulletin.week ?? null,
      provenanceType: cls.provenanceType, isOfficialForward: cls.isOfficialForward,
      exclusionReason: cls.exclusionReason ?? null, reasons: cls.reasons,
      backfilled: rec.backfilled, isDemo: rec.isDemo, late: rec.late,
      verificationHashShort: rec.verificationHash ? rec.verificationHash.slice(0, 10) : null,
      lockedAt: rec.lockedAt, freezeAt: rec.freezeAt, firstMatchStartAt: rec.firstMatchStartAt,
      officialResultCount: results.length,
      sourceRecordId: rec.sourceRecordId,
    })),
    ...legacy.map(({ roundId, rec, cls }) => ({
      source: 'legacy-cache', roundId, round: rec.round,
      provenanceType: cls.provenanceType, isOfficialForward: false,
      exclusionReason: cls.exclusionReason ?? null, reasons: cls.reasons,
      backfilled: rec.backfilled, isDemo: rec.isDemo, late: false,
      verificationHashShort: null, lockedAt: null, freezeAt: null, firstMatchStartAt: null,
      officialResultCount: 0,
      sourceRecordId: rec.sourceRecordId,
      pickCount: rec.pickCount ?? 0,
      savedAt: rec.createdAt,
    })),
  ];

  const countsByType = countByType(records.map((r) => ({ provenanceType: r.provenanceType })));
  return {
    generatedAt: new Date().toISOString(),
    totalRecords: records.length,
    countsByType,
    officialForwardCount: records.filter((r) => r.isOfficialForward).length,
    excludedCount: records.filter((r) => !r.isOfficialForward).length,
    legacyRadarCaches: legacyRadar,
    records,
  };
}
