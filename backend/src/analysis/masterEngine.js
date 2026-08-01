// MASTER ANALİZ HESAPLAMA MOTORU
// Girdi: catalogEvaluations (gölge değerlendirmeler) + kullanıcı/resmî profil.
// KURALLAR:
//  * YALNIZ profildeki AÇIK ve verisi bulunan kriterler kullanılır; kapalı
//    kriter sonuca/güvene/açıklamaya SIFIR etki eder.
//  * Katkı = direction × normalizedStrength × userImpact × familyDedup ×
//    reliability (yalnız Akıllı mod) × dataQualityFactor.
//  * Aynı ailedeki benzer kriterler bağımsız oy sayılmaz (azalan katkı) ve
//    hangi kriterlerin dengelendiği açıkça raporlanır.
//  * Destek yüzdeleri OLASILIK DEĞİLDİR — "Analiz desteği" olarak sunulur.
import {
  IMPACT_WEIGHTS, IMPACT_LABELS, ANALYSIS_FAMILIES, ANALYSIS_FAMILY_DECAY,
  DECISION_RULES as R, RELIABILITY, ANALYSIS_METHODOLOGY_VERSION, sampleClass,
} from './analysisConfig.js';
import { CATALOG_MAP } from './criterionCatalog.js';

const r1 = (x) => Math.round(x * 10) / 10;

// Akıllı Destek Modu güvenilirlik faktörü: yeterli örneklem yoksa 1.0 (etkisiz);
// az örnekli yüksek başarı ASLA şişirmez. Açıklama üretir.
export function reliabilityFactor(scoreRow, direction) {
  if (!scoreRow) return { factor: 1, note: null };
  const dir = direction && scoreRow.byDirection?.[direction] ? scoreRow.byDirection[direction] : null;
  const n = dir ? dir.total : scoreRow.signals ?? 0;
  const rate = dir ? dir.shrunkRate ?? dir.rate : scoreRow.shrunkAccuracy ?? scoreRow.accuracy;
  if (n == null || rate == null || n < RELIABILITY.minSampleForAdjust) {
    return { factor: 1, note: n != null && n > 0 && n < RELIABILITY.minSampleForAdjust ? `n=${n} örnek yetersiz — ağırlık değiştirilmedi.` : null };
  }
  const baseline = RELIABILITY.baselineByDirection[direction] ?? 33.3;
  let factor = 1 + ((rate - baseline) / 100);
  // 30-99 örnekte etki yarıya kırpılır; sınırlar uygulanır.
  if (n < RELIABILITY.softSample) factor = 1 + (factor - 1) * 0.5;
  factor = Math.max(RELIABILITY.maxCut, Math.min(RELIABILITY.maxBoost, factor));
  const dirTxt = { '1': '1 yönünde', X: 'X yönünde', '2': '2 yönünde' }[direction] || '';
  const note = factor > 1.02
    ? `Geçmişte ${dirTxt} %${rate} isabet (n=${n}) → ağırlık ×${factor.toFixed(2)} artırıldı.`
    : factor < 0.98
      ? `Geçmişte ${dirTxt} %${rate} isabet (n=${n}) → ağırlık ×${factor.toFixed(2)} azaltıldı.`
      : null;
  return { factor, note };
}

export function computeMasterAnalysis({
  matchInfo = null,
  catalogEvaluations = [],
  profile,                       // { id, name, version, mode, criteria: {key:{on,impact,filters?}}, globalFilters }
  scorecardByKey = null,         // Akıllı mod için kriter karnesi (öğrenme sınırı çağıranın sorumluluğunda)
  freezeStatus = 'live',         // 'live' | 'sealed'
  calculatedAt = null,
} = {}) {
  const mode = profile?.mode === 'smart' ? 'smart' : 'manual';
  const evalByKey = new Map(catalogEvaluations.map((e) => [e.key, e]));
  const criteriaConf = profile?.criteria || {};

  // AÇIK kriterler (kapalılar HİÇ okunmaz — sızma testi bunu doğrular).
  const selectedKeys = Object.keys(criteriaConf).filter((k) => criteriaConf[k]?.on && CATALOG_MAP[k]);
  const selectedCriteriaCount = selectedKeys.length;

  if (!selectedCriteriaCount) {
    return {
      ok: false, empty: true,
      message: 'Analiz yapılabilmesi için önce analiz kriterlerinizi seçmelisiniz.',
      selectedCriteriaCount: 0, availableCriteriaCount: 0, unavailableCriteriaCount: 0,
      methodologyVersion: ANALYSIS_METHODOLOGY_VERSION,
      profileId: profile?.id ?? null, profileVersion: profile?.version ?? null,
      mode, freezeStatus, calculatedAt,
    };
  }

  // Kriter satırları: değerlendirme + kullanıcı etkisi.
  const rows = selectedKeys.map((key) => {
    const conf = criteriaConf[key];
    const ev = evalByKey.get(key) || { key, available: false, unavailableReason: 'Değerlendirme bulunamadı.' };
    const impactKey = IMPACT_WEIGHTS[conf.impact] ? conf.impact : CATALOG_MAP[key].defaultImpact;
    return {
      key,
      label: CATALOG_MAP[key].label,
      family: ev.signalFamily || CATALOG_MAP[key].signalFamily,
      impact: impactKey,
      impactLabel: IMPACT_LABELS[impactKey],
      impactWeight: IMPACT_WEIGHTS[impactKey],
      ...ev,
    };
  });

  const availableRows = rows.filter((x) => x.available);
  const unavailableRows = rows.filter((x) => !x.available);
  const directional = availableRows.filter((x) => x.side);

  // ——— KATKI + AİLE TAVANI (azalan katkı) + GÜVENİLİRLİK (Akıllı mod) ———
  const byFamily = new Map();
  for (const row of directional) {
    if (!byFamily.has(row.family)) byFamily.set(row.family, []);
    byFamily.get(row.family).push(row);
  }
  const support = { '1': 0, X: 0, '2': 0 };
  const familyNotes = [];
  const reliabilityNotes = [];
  const contributions = [];

  for (const [family, list] of byFamily.entries()) {
    // Aile içinde ham güce göre sırala (impact × strength), azalan katkı uygula.
    const scored = list.map((row) => {
      const base = row.impactWeight * (0.5 + 0.5 * (row.normalizedStrength || 0));
      return { row, base };
    }).sort((x, y) => y.base - x.base);

    scored.forEach(({ row, base }, i) => {
      const dedup = ANALYSIS_FAMILY_DECAY[Math.min(i, ANALYSIS_FAMILY_DECAY.length - 1)];
      let rel = { factor: 1, note: null };
      if (mode === 'smart') {
        rel = reliabilityFactor(scorecardByKey?.[row.key] || null, row.signal);
        if (rel.note) reliabilityNotes.push({ key: row.key, label: row.label, note: rel.note });
      }
      const dq = row.filterApplied === false && row.insufficientSample ? 0 : 1; // yetersiz filtre örneklemi zaten unavailable
      const points = base * dedup * rel.factor * dq;
      support[row.signal] += points;
      contributions.push({
        key: row.key, label: row.label, family, familyLabel: ANALYSIS_FAMILIES[family] || family,
        signal: row.signal, impact: row.impact, impactLabel: row.impactLabel,
        normalizedStrength: row.normalizedStrength, basePoints: r1(base),
        familyDedupFactor: dedup, reliabilityFactor: Math.round(rel.factor * 100) / 100,
        points: r1(points), note: row.note,
      });
    });
    if (scored.length > 1) {
      familyNotes.push({
        family, familyLabel: ANALYSIS_FAMILIES[family] || family,
        criteria: scored.map((s) => s.row.label),
        note: `${scored.map((s) => s.row.label).join(', ')} benzer veriyi (${ANALYSIS_FAMILIES[family] || family}) kullandığından tekrarlı katkı dengelendi (%100/%50/%25/%10).`,
      });
    }
  }

  const totalSupport = support['1'] + support.X + support['2'];
  // Yüzdeler EN BÜYÜK KALAN yöntemiyle 100'e tamamlanır. Eski hâl kalanı
  // koşulsuz '2'ye yüklüyordu: desteği GERÇEKTEN 0 olan seçenek bile ekranda
  // "%2" görünebiliyordu — "yok" ile "az" farkı bozuluyordu.
  const normalized = { '1': 0, X: 0, '2': 0 };
  if (totalSupport > 0) {
    const keys = ['1', 'X', '2'];
    const raw = keys.map((k) => (support[k] * 100) / totalSupport);
    const floors = raw.map(Math.floor);
    let rem = 100 - floors.reduce((a, b) => a + b, 0);
    keys.forEach((k, i) => { normalized[k] = floors[i]; });
    const byFrac = keys.map((k, i) => ({ k, frac: raw[i] - floors[i] })).sort((x, y) => y.frac - x.frac);
    for (const o of byFrac) {
      if (rem <= 0) break;
      if (support[o.k] > 0) { normalized[o.k] += 1; rem -= 1; } // desteği 0 olana pay YAZILMAZ
    }
  }

  // ——— KARAR (sürümlü kurallar) ———
  // Sıralama da fark (lead/spread) da AYNI ölçekten: ham destek yüzdesi.
  // Eski hâl sıralamayı ham, farkı yuvarlanmış değerden alıyordu — sınır
  // durumlarda lead negatif çıkıp karar zinciri yanlış dala girebiliyordu.
  const order = ['1', 'X', '2'].sort((x, y) => support[y] - support[x]);
  const top = order[0], second = order[1], third = order[2];
  const pctRaw = (k) => (totalSupport > 0 ? (support[k] * 100) / totalSupport : 0);
  const lead = Math.round(pctRaw(top) - pctRaw(second));
  const spread = Math.round(pctRaw(top) - pctRaw(third));
  const decisiveCount = directional.length;
  // GERÇEK yönlü sinyaller (SABİT ev avantajı kuralı HARİÇ). Kesin bir yön
  // kararı için en az bir TAKIM-VERİSİ sinyali şarttır; aksi halde (ör. yeni lig)
  // yalnız ev avantajı kalır ve tek başına "1 %100" gibi sahte kesinlik üretir.
  // NOT: Filtre aile ('contextual') üzerinden DEĞİL, kriter anahtarı üzerinden
  // yapılır — aynı ailedeki commonOpponents GERÇEK bir takım-verisi kriteridir;
  // aile filtresi onu da eleyip motoru sebepsiz "veri yetersiz"e düşürüyordu.
  const meaningfulDirectional = directional.filter((x) => x.key !== 'homeAdvantage').length;
  // Yön kararı yoksa (yalnız yapısal ev avantajı) destek yüzdeleri de GÖSTERİLMEZ —
  // "1 %100" gibi sahte kesinlik oluşmasın; veri yetersiz olarak sunulur.
  if (!meaningfulDirectional) { normalized['1'] = 0; normalized.X = 0; normalized['2'] = 0; }

  // Veri kalitesi: seçilenlerin ne kadarı veri buldu + yön gösteren sayısı.
  const fillRate = selectedCriteriaCount ? availableRows.length / selectedCriteriaCount : 0;
  const dataQuality = Math.round(fillRate * 70 + Math.min(1, decisiveCount / 8) * 30);

  // Uzlaşma / çatışma: yön dağılımı.
  const dirCounts = { '1': 0, X: 0, '2': 0 };
  for (const d of directional) dirCounts[d.signal] += 1;
  const agreementScore = decisiveCount ? Math.round((Math.max(dirCounts['1'], dirCounts.X, dirCounts['2']) / decisiveCount) * 100) : 0;
  const conflictScore = 100 - agreementScore;

  let mainPrediction = null, alternativePrediction = null, closedPrediction = null, decisionNote = null;
  if (!meaningfulDirectional || totalSupport <= 0) {
    closedPrediction = '1X2';
    decisionNote = decisiveCount
      ? 'Yeterli takım verisi yok (yalnız yapısal ev avantajı) — veri yetersiz, kapalı (1X2).'
      : 'Seçili kriterler yön göstermedi — veri yetersiz, kapalı (1X2) düşünülmeli.';
  } else if (spread <= R.tripleSpreadPct) {
    mainPrediction = top; alternativePrediction = second;
    closedPrediction = '1X2';
    decisionNote = 'Üç yön de birbirine yakın — Yüksek Belirsizlik, kapalı (1X2) önerilir.';
  } else if (lead >= R.clearLeadPct) {
    mainPrediction = top;
    alternativePrediction = second;
    closedPrediction = [top, second].sort((x, y) => '1X2'.indexOf(x) - '1X2'.indexOf(y)).join('');
    // "GÜVENLİ" DENMEZ. Kapalı tercih daha güvenli değil, daha GENİŞ kapsar —
    // ve genişlik bedavaya gelmez (kolon sayısı, dolayısıyla maliyet artar).
    // Bahis bağlamında "güvenli" sıfatı bir güvence iddiasıdır; bu ürünün dili
    // iddia kurmaz, ne yaptığını ve neye mal olduğunu söyler.
    decisionNote = `Ana tercih ${top} açık önde (+${lead} puan); kapalı tercih ${closedPrediction} iki sonucu birden kapsar (kolon sayısı iki katına çıkar).`;
  } else {
    mainPrediction = top;
    alternativePrediction = second;
    closedPrediction = [top, second].sort((x, y) => '1X2'.indexOf(x) - '1X2'.indexOf(y)).join('');
    decisionNote = `İlk iki yön yakın (fark ${lead} puan) — çifte tercih ${closedPrediction} iki sonucu birden kapsar (kolon sayısı iki katına çıkar).`;
  }

  // Güven — veri kalitesinden AYRI (destek yüzdesi olasılık değildir).
  let confidence;
  if (!decisiveCount || dataQuality < R.lowDataQuality) confidence = 'Düşük';
  else if (lead >= R.strongConfidenceLead && conflictScore < R.highConflict && decisiveCount >= R.minDecisiveCriteria) confidence = 'Yüksek';
  else if (lead >= R.clearLeadPct) confidence = 'Orta';
  else confidence = 'Düşük';

  const bankoEligible = confidence === 'Yüksek'
    && conflictScore < R.highConflict
    && dataQuality >= 70
    && lead >= R.strongConfidenceLead
    && mainPrediction !== 'X';
  const bankoNote = bankoEligible
    ? 'Kriter uzlaşması ve veri yeterliliği yüksek — yine de garanti değildir.'
    : conflictScore >= R.highConflict
      ? 'Kriterler arasında yüksek çatışma var — güçlü aday için uygun değil.'
      : dataQuality < 70
        ? `Veri yeterliliği %${dataQuality} — güçlü aday için uygun değil.`
        : lead < R.strongConfidenceLead
          ? 'Ana tercih yeterince belirgin değil — güçlü aday için uygun değil.'
          : 'Güçlü aday için uygun değil.';

  // ——— GEREKÇELER ———
  const sortedContrib = [...contributions].sort((x, y) => y.points - x.points);
  const strongestReasons = sortedContrib.filter((c) => c.signal === mainPrediction).slice(0, 5)
    .map((c) => ({ key: c.key, label: c.label, points: c.points, note: c.note }));
  const oppositeReasons = sortedContrib.filter((c) => c.signal && c.signal !== mainPrediction).slice(0, 5)
    .map((c) => ({ key: c.key, label: c.label, signal: c.signal, points: c.points, note: c.note }));
  const missingData = unavailableRows.map((x) => ({ key: x.key, label: x.label, reason: x.unavailableReason }));

  return {
    ok: true,
    matchInfo,
    mode,
    support1: r1(support['1']), supportX: r1(support.X), support2: r1(support['2']),
    normalizedSupport1: normalized['1'], normalizedSupportX: normalized.X, normalizedSupport2: normalized['2'],
    supportNote: 'Yüzdeler seçili kriterlerin ANALİZ DESTEĞİ dağılımıdır; kazanma olasılığı veya garanti değildir.',
    mainPrediction, alternativePrediction, closedPrediction, decisionNote,
    confidence, dataQuality,
    agreementScore, conflictScore,
    bankoEligible, bankoNote,
    selectedCriteriaCount,
    availableCriteriaCount: availableRows.length,
    unavailableCriteriaCount: unavailableRows.length,
    decisiveCriteriaCount: decisiveCount,
    directionCounts: dirCounts,
    effectiveSignalFamilyCount: byFamily.size,
    familyNotes,
    reliabilityNotes: mode === 'smart' ? reliabilityNotes : [],
    contributions,
    strongestReasons,
    oppositeReasons,
    missingData,
    profileId: profile?.id ?? null,
    profileName: profile?.name ?? null,
    profileVersion: profile?.version ?? null,
    methodologyVersion: ANALYSIS_METHODOLOGY_VERSION,
    calculatedAt: calculatedAt || null,
    freezeStatus,
  };
}

// ——— "VAY BE" ÖZETİ — tamamen mevcut veriden, şablon tabanlı (AI yok/uydurma yok) ———
export function buildMasterSummary(master, { radarMaster = null, names = {} } = {}) {
  if (!master?.ok) return master?.message || 'Analiz için kriter seçilmedi.';
  const home = names.home || 'Ev sahibi', away = names.away || 'Deplasman';
  const p = [];
  const dirName = (d) => (d === '1' ? home : d === '2' ? away : 'beraberlik');

  // En güçlü taraf + dağılım
  if (master.mainPrediction) {
    p.push(`Seçilen ${master.selectedCriteriaCount} kriterin ${master.directionCounts['1']}'i 1, ${master.directionCounts.X}'i X, ${master.directionCounts['2']}'si 2 yönünde; analiz desteği 1: %${master.normalizedSupport1} · X: %${master.normalizedSupportX} · 2: %${master.normalizedSupport2}.`);
    const top2 = master.strongestReasons.slice(0, 2).map((r) => r.label).join(' ve ');
    if (top2) p.push(`${dirName(master.mainPrediction)} tarafını en çok ${top2} destekliyor.`);
  }
  // Görünmeyen risk / karşı veri
  const opp = master.oppositeReasons[0];
  if (opp) p.push(`Karşı sinyal: ${opp.label} ${opp.signal} yönünü gösteriyor — görünmeyen risk bu.`);
  // Aile dengelemesi
  if (master.familyNotes.length) p.push(master.familyNotes[0].note);
  // Beraberlik yolu
  if (master.normalizedSupportX >= 20) p.push(`Beraberlik desteği %${master.normalizedSupportX} — X tamamen silinecek seviyede değil.`);
  // Eksik veri
  if (master.unavailableCriteriaCount) p.push(`${master.unavailableCriteriaCount} kriter veri bulamadığı için analiz dışı kaldı (bilinmeyen alanlar mevcut).`);
  // Karar cümlesi
  // "banko" YAZILMAZ — proje kuralı iddialı dili yasaklar ("kesin/garanti/
  // banko/yanılmaz/net favori"). Arayüzün geri kalanı zaten "güçlü aday"
  // diyor (bkz. MasterAnalysisView rozeti ve aşağıdaki radar cümlesi); bu
  // cümle tek istisnaydı ve kullanıcıya görünen özet metnine düşüyordu.
  p.push(`Ana tercih ${master.mainPrediction ?? '—'}${master.closedPrediction ? `, kapalı tercih ${master.closedPrediction}` : ''}; güçlü aday için ${master.bankoEligible ? 'koşullar sağlandı (garanti değildir)' : 'uygun değil'}.`);
  // Radar kıyası — ayrı sistem, gizlice karışmaz; yalnız ortak görüş/çelişki cümlesi.
  if (radarMaster?.classification) {
    const agree = radarMaster.mainPrediction && master.mainPrediction && radarMaster.mainPrediction === master.mainPrediction;
    if (agree) p.push(`Master Radar da aynı yönü (${master.mainPrediction}) gösteriyor — iki bağımsız sistem ortak görüşte.`);
    else if (radarMaster.classification === 'surprise_candidate') p.push(`Master Analiz ${master.mainPrediction ?? '—'} yönünü desteklerken Radar sistemi favori tuzağı uyarısı veriyor — güçlü aday için uygun değil.`);
    else if (radarMaster.mainPrediction) p.push(`Master Radar farklı yönde (${radarMaster.mainPrediction}) — iki sistem çelişiyor, temkinli olunmalı.`);
  }
  return p.join(' ');
}
