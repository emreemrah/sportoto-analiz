// MASTER RADAR — beş radarı tek AÇIKLANABİLİR kararda birleştirir.
// * Verisi olmayan radarın ağırlığı SIFIRLANIR; kalan aktifler 100'e normalize
//   edilir. Verisiz radar "nötr 50" ile karara sızamaz.
// * Banko/Güçlü Aday ve Sürpriz Adayı sınıfları veri kalitesi + radar uzlaşması
//   kapılarına bağlıdır (bkz. config.GATES). Şartlar yoksa Orta Risk gösterilir.
// * "Banko" garantisi yoktur — sınıf adları "aday" dilindedir.
import {
  RADAR_IDS, BASE_WEIGHTS, MEMORY_WEIGHT_CAP, GATES, CLASS_BANDS,
  CLASSIFICATIONS, CLASSIFICATION_LABELS, METHODOLOGY_VERSION,
} from './config.js';
import { masterDataQuality, qualityLevel } from './dataQuality.js';
import { clamp, favoriteOfScores } from './util.js';
import { computeSurpriseDna } from './surpriseDna.js';

// Aktif radar ağırlıklarını normalize eder (+ hafıza tavanı uygular).
export function normalizeWeights(radars) {
  const entries = Object.values(RADAR_IDS).map((id) => ({
    id,
    base: BASE_WEIGHTS[id] || 0,
    active: !!radars[id]?.hasData,
  }));
  const activeSum = entries.filter((e) => e.active).reduce((s, e) => s + e.base, 0);
  const weights = {};
  for (const e of entries) weights[e.id] = e.active && activeSum > 0 ? (e.base / activeSum) * 100 : 0;

  // Radar 5 tavanı: hafıza yardımcı sinyaldir, normalize sonrası bile şişemez.
  if (weights[RADAR_IDS.MEMORY] > MEMORY_WEIGHT_CAP) {
    const others = entries.filter((e) => e.active && e.id !== RADAR_IDS.MEMORY);
    if (others.length) {
      const excess = weights[RADAR_IDS.MEMORY] - MEMORY_WEIGHT_CAP;
      weights[RADAR_IDS.MEMORY] = MEMORY_WEIGHT_CAP;
      const otherSum = others.reduce((s, e) => s + weights[e.id], 0);
      for (const e of others) weights[e.id] += otherSum > 0 ? (weights[e.id] / otherSum) * excess : 0;
    }
    // Dağıtılacak başka aktif radar yoksa tavan UYGULANAMAZ: fazlalık kaybolup
    // ağırlık toplamını ~15'e düşürüyordu (veri kalitesi hesabı + ekran bozuk).
    // Toplam-100 değişmezi korunur; hafızanın tek başına karar sürmesini asıl
    // engelleyen mekanizma zaten sınıf kapılarıdır (GATES).
  }
  for (const k of Object.keys(weights)) weights[k] = Math.round(weights[k] * 10) / 10;
  return weights;
}

// Radarlar arası ÇATIŞMA puanı (0-100): yön anlaşmazlığı + risk sapması.
export function computeConflict(radars) {
  const act = Object.values(radars).filter((r) => r?.hasData);
  const withDir = act.filter((r) => r.direction);
  let conflict = 0;
  const notes = [];

  if (withDir.length >= 2) {
    const dirs = withDir.map((r) => r.direction);
    const uniq = new Set(dirs);
    if (uniq.size > 1) {
      const counts = {};
      for (const d of dirs) counts[d] = (counts[d] || 0) + 1;
      const maxAgree = Math.max(...Object.values(counts));
      conflict += Math.round(((withDir.length - maxAgree) / withDir.length) * 60);
    }
  }
  const risks = act.filter((r) => r.favoriteFailureRisk != null).map((r) => r.favoriteFailureRisk);
  if (risks.length >= 2) {
    const spread = Math.max(...risks) - Math.min(...risks);
    conflict += Math.round(Math.min(40, spread * 0.5));
  }
  conflict = clamp(conflict, 0, 100);

  // İnsan-okunur çatışma açıklaması.
  if (withDir.length >= 2) {
    const homeSide = withDir.filter((r) => r.direction === '1').map((r) => r.name);
    const riskSide = act.filter((r) => r.favoriteFailureRisk != null && r.favoriteFailureRisk >= GATES.surprise.radarFailureRiskSignal).map((r) => r.name);
    if (homeSide.length && riskSide.length && conflict >= 30) {
      notes.push(`${homeSide.join(' ve ')} favoriyi destekliyor; ${riskSide.join(' ve ')} risk sinyalini yükseltiyor. Radar uzlaşması düşük.`);
    }
  }
  return { score: conflict, notes };
}

export function combineMaster(radars, { surpriseDna: dnaIn = null } = {}) {
  // KARAR TABANI: Radar 5 (Bülten DNA / kupon sırası) karara KATILMAZ.
  // Kupon sırasının maç sonucuyla nedensel bağı yoktur (bağımsız çoklu-model
  // araştırması + iç inceleme, Ağustos 2026). Radar 5 kartı yalnız bilgi
  // panelidir: ağırlığa, veri kalitesine, risk ortalamasına, sınıf kapılarına
  // ve karar gerekçelerine GİREMEZ. Eskiden favoriteFailureRisk'i risk
  // ortalamasına, varlığı da aktif-radar kapısına sayılıyordu — sahte örüntü
  // bu kanallardan karara sızıyordu.
  const coreRadars = Object.fromEntries(
    Object.entries(radars).filter(([id]) => id !== RADAR_IDS.MEMORY),
  );
  const weights = normalizeWeights(coreRadars);
  weights[RADAR_IDS.MEMORY] = 0; // alan sözleşmesi korunur; katkı daima 0
  const active = Object.values(RADAR_IDS).filter((id) => coreRadars[id]?.hasData);
  const activeRadarCount = active.length;

  const dq = masterDataQuality(active.map((id) => ({ weight: weights[id], dataQuality: radars[id].dataQuality })));
  const conflict = computeConflict(coreRadars);
  const dna = dnaIn || computeSurpriseDna(radars);

  // Birleşik 1/X/2 skorları — yalnız YÖN skoru üreten radarlardan (hafıza üretmez).
  const scored = active.filter((id) => radars[id].homeScore != null);
  const scoreWeightSum = scored.reduce((s, id) => s + weights[id], 0);
  let scores = null;
  if (scored.length && scoreWeightSum > 0) {
    const agg = { home: 0, draw: 0, away: 0 };
    for (const id of scored) {
      const r = radars[id];
      const w = weights[id] / scoreWeightSum;
      agg.home += r.homeScore * w;
      agg.draw += r.drawScore * w;
      agg.away += r.awayScore * w;
    }
    const tot = agg.home + agg.draw + agg.away;
    scores = {
      home: Math.round((agg.home / tot) * 100),
      draw: Math.round((agg.draw / tot) * 100),
      away: Math.max(0, 100 - Math.round((agg.home / tot) * 100) - Math.round((agg.draw / tot) * 100)),
    };
  }
  const favorite = favoriteOfScores(scores);

  // Birleşik favori kazanamama riski (ağırlıklı; risk üretenler üzerinden).
  const riskRadars = active.filter((id) => radars[id].favoriteFailureRisk != null);
  const riskWeightSum = riskRadars.reduce((s, id) => s + weights[id], 0);
  const failureRisk = riskWeightSum > 0
    ? clamp(Math.round(riskRadars.reduce((s, id) => s + radars[id].favoriteFailureRisk * (weights[id] / riskWeightSum), 0)), 0, 100)
    : null;

  // Ana + alternatif tahmin.
  let mainPrediction = favorite?.symbol ?? null;
  let alternativePrediction = null;
  if (favorite && favorite.gap < 10) alternativePrediction = favorite.second;

  // exactDirection: favori kazanamazsa X mi karşı galibiyet mi ağırlıklı?
  let exactDirection = null;
  if (scores && favorite) {
    if (favorite.symbol === '1') exactDirection = scores.draw >= scores.away ? 'X' : '2';
    else if (favorite.symbol === '2') exactDirection = scores.draw >= scores.home ? 'X' : '1';
    else exactDirection = scores.home >= scores.away ? '1' : '2';
  }

  // Sürpriz yönünde sinyal veren bağımsız radar sayısı.
  const surpriseAgreeing = riskRadars.filter((id) => radars[id].favoriteFailureRisk >= GATES.surprise.radarFailureRiskSignal);

  // ---- SINIFLANDIRMA (kapılı) ----
  let classification = CLASSIFICATIONS.MEDIUM;
  const gateNotes = [];
  if (activeRadarCount < GATES.minActiveRadars || dq < GATES.minMasterDataQuality || failureRisk == null || !mainPrediction) {
    classification = CLASSIFICATIONS.INSUFFICIENT;
    gateNotes.push(`Aktif radar ${activeRadarCount}/${GATES.minActiveRadars} veya veri yeterliliği %${dq} — sınıf üretilmedi.`);
  } else if (failureRisk <= CLASS_BANDS.strongMax) {
    const g = GATES.strong;
    const ok = activeRadarCount >= g.minActiveRadars
      && dq >= g.minDataQuality
      && (favorite?.percent ?? 0) >= g.minFavoriteProb
      && (favorite?.gap ?? 0) >= g.minPredictionGap
      && conflict.score <= g.maxConflict;
    if (ok) classification = CLASSIFICATIONS.STRONG;
    else {
      classification = CLASSIFICATIONS.MEDIUM;
      if (activeRadarCount < g.minActiveRadars) gateNotes.push(`Güçlü Aday için en az ${g.minActiveRadars} aktif radar gerekir (şu an ${activeRadarCount}).`);
      if (dq < g.minDataQuality) gateNotes.push(`Güçlü Aday için veri yeterliliği en az %${g.minDataQuality} olmalı (şu an %${dq}).`);
      if ((favorite?.percent ?? 0) < g.minFavoriteProb) gateNotes.push(`Favorinin tahmini kazanma olasılığı %${g.minFavoriteProb} altında.`);
      if ((favorite?.gap ?? 0) < g.minPredictionGap) gateNotes.push('Ana tercih yeterince belirgin değil.');
      if (conflict.score > g.maxConflict) gateNotes.push('Radarlar arasında ağır çatışma var — güçlü aday için uygun değil.');
    }
  } else if (failureRisk >= CLASS_BANDS.mediumMax + 1) {
    const g = GATES.surprise;
    const ok = surpriseAgreeing.length >= g.minRadarsAgreeing
      && dq >= g.minDataQuality
      && failureRisk >= g.minFailureRisk;
    if (ok) classification = CLASSIFICATIONS.SURPRISE;
    else {
      classification = CLASSIFICATIONS.MEDIUM;
      if (surpriseAgreeing.length < g.minRadarsAgreeing) gateNotes.push(`Sürpriz Sinyali için en az ${g.minRadarsAgreeing} bağımsız radar sürpriz yönünde sinyal vermeli (şu an ${surpriseAgreeing.length}).`);
      if (dq < g.minDataQuality) gateNotes.push(`Sürpriz Sinyali için veri yeterliliği en az %${g.minDataQuality} olmalı.`);
    }
  }

  // Güven (tahmin güveni) — veri yeterliliğinden AYRI gösterilir.
  // 1.4.0 KAYNAK ÇEŞİTLİLİĞİ TAVANI: formül puanı kaç bağımsız radarın
  // konuştuğunu saymıyordu — sezon başında tek kaynaklı (halk yüzdesi) bir maç
  // gap teriminden %95 güvene çıkabiliyordu. İki radarla tavan %70; üç ve
  // üzeri eski tavanda (95). Tek radar bu satıra hiç gelmez (sınıf kapısı
  // insufficient yapar ve aşağıda güven null'a çekilir).
  const cesitlilikTavani = activeRadarCount >= 3 ? 95 : 70;
  let confidence = scores && favorite
    ? clamp(Math.round(favorite.percent * 0.6 + (favorite.gap ?? 0) * 1.2 + dq * 0.2 - conflict.score * 0.25), 5, cesitlilikTavani)
    : null;

  // 1.4.0 SINIF ÜRETİLMEDİYSE TAHMİN DE ÜRETİLMEZ: "Analiz hazır değil"
  // derken ana tahmin + güven basmak kendi sözümüzle çelişiyordu; karne de
  // (feedBucket, mainPrediction şartı) bu tahminleri genel isabete sayıyordu.
  // favorite + scores BİLGİ olarak kalır (ekranlar halk/oran dağılımını kendi
  // atfıyla gösterebilir); tahmin alanları null döner, karne bu maçı saymaz.
  // Mühürlü geçmiş etkilenmez: eski haftalar eski sürümle mühürlüdür.
  if (classification === CLASSIFICATIONS.INSUFFICIENT) {
    mainPrediction = null;
    alternativePrediction = null;
    exactDirection = null;
    confidence = null;
  }

  // Gerekçeler: aktif radarların pozitif/negatiflerinden ağırlık sırasıyla derlenir.
  const collect = (field) => {
    const out = [];
    for (const id of [...active].sort((x, y) => weights[y] - weights[x])) {
      for (const r of radars[id][field] || []) out.push({ radar: radars[id].name, text: r });
    }
    return out;
  };
  const topReasons = collect('positives').slice(0, 5);
  const riskReasons = [...collect('negatives'), ...conflict.notes.map((t) => ({ radar: 'Radar Uzlaşması', text: t }))].slice(0, 6);
  const missingData = [];
  for (const id of Object.values(RADAR_IDS)) {
    const r = radars[id];
    if (!r) continue;
    if (!r.hasData) missingData.push({ radar: r.name, reason: r.note || r.missingSignals?.[0]?.reason || 'Veri yok.', availability: r.status === 'no_source' ? 'accumulating' : 'match_missing' });
    else {
      for (const ms of r.missingSignals || []) {
        // 'unsupported' (kaynakta yapısal olarak yok, ör. sakatlık listesi):
        // veri kalitesine zaten girmiyor; kartlarda TEKRAR TEKRAR gösterilmez —
        // metodolojide bir kez açıklanır.
        if (ms.availability === 'unsupported') continue;
        missingData.push({ radar: r.name, reason: `${ms.label}: ${ms.reason}`, availability: ms.availability || 'match_missing' });
      }
    }
  }

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    weights,
    activeRadarCount,
    activeRadars: active,
    inactiveRadars: Object.values(RADAR_IDS).filter((id) => !radars[id]?.hasData),
    dataQuality: dq,
    dataQualityLevel: qualityLevel(dq),
    conflictScore: conflict.score,
    conflictNotes: conflict.notes,
    scores,
    favorite: favorite ? { symbol: favorite.symbol, percent: favorite.percent } : null,
    favoriteFailureRisk: failureRisk,
    surpriseDnaScore: dna.surpriseDnaScore,
    surpriseDna: dna,
    mainPrediction,
    alternativePrediction,
    exactDirection,
    classification,
    classificationLabel: CLASSIFICATION_LABELS[classification],
    gateNotes,
    confidence,
    surpriseAgreeingRadars: surpriseAgreeing,
    topReasons,
    riskReasons,
    missingData,
  };
}
