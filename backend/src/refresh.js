// YENİLEME İŞİ
// 1) sportoto bültenini çeker
// 2) FootyStats sezonlarını (config'teki id'ler) çeker
// 3) Her bülten maçını FootyStats maçıyla eşleştirip analiz eder
// 4) Sonucu cache'e yazar (mobil uygulama buradan okur)
import { config, usingExampleKey } from './config.js';
import { getLatestBulletin } from './sources/sportoto.js';
import { fetchSeason } from './sources/footystats.js';
import { findFootyMatch } from './matcher.js';
import { analyzeMatch } from './analysis/surprise.js';
import { createExtrasCache, buildMatchStats } from './enrich.js';
import { predict } from './analysis/prediction.js';
import { attachAiComments, aiEnabled } from './analysis/aiComment.js';
import { save } from './cache.js';

export async function refreshAll() {
  const startedAt = new Date().toISOString();
  console.log(`[refresh] başladı ${startedAt} (anahtar: ${usingExampleKey ? 'example/örnek' : 'gerçek'})`);

  // 1) Bülten
  const bulletin = await getLatestBulletin();
  console.log(`[refresh] bülten: ${bulletin.year} ${bulletin.round} — ${bulletin.matchCount} maç`);

  // 2) FootyStats sezonları → tek havuz (+ sezon bazlı, son 5 formu için)
  const footyMatches = [];
  const matchesBySeason = new Map();
  const teamsBySeason = new Map();
  for (const sid of config.seasonIds) {
    try {
      const season = await fetchSeason(sid);
      footyMatches.push(...season.matches);
      matchesBySeason.set(sid, season.matches);
      teamsBySeason.set(sid, season.teams);
      console.log(`[refresh] FootyStats sezon ${sid}: ${season.matches.length} maç`);
    } catch (e) {
      console.warn(`[refresh] FootyStats sezon ${sid} alınamadı: ${e.message}`);
    }
  }

  // 3) Eşleştir + analiz et + zenginleştir (puan durumu, oyuncular, h2h)
  let matched = 0;
  const getExtras = createExtrasCache(matchesBySeason, teamsBySeason);
  const analyzedMatches = [];
  for (const bm of bulletin.matches) {
    // Başlamış maç = sonucu/skoru var VEYA maç saati geçmiş → analiz dışı (pasif).
    const started = bm.status === 'finished'
      || (bm.date && new Date(bm.date).getTime() <= Date.now());
    if (started) {
      analyzedMatches.push({
        ...bm,
        started: true,
        analysis: { started: true, label: '—', surpriseScore: null, probabilities: null },
        stats: null,
        prediction: null,
      });
      continue;
    }
    const found = findFootyMatch(bm, footyMatches);
    let analysis, stats = null;
    if (found) {
      matched++;
      const fm = found.match;
      // ev/deplasman ters eşleştiyse oranları da ters çevir
      const odds = found.swapped
        ? { home: fm.odds.away, draw: fm.odds.draw, away: fm.odds.home }
        : fm.odds;
      const preXg = found.swapped
        ? { home: fm.preXg.away, away: fm.preXg.home }
        : fm.preXg;
      const prePpg = found.swapped
        ? { home: fm.prePpg.away, away: fm.prePpg.home }
        : fm.prePpg;
      analysis = analyzeMatch({ odds, preXg, prePpg });
      // Puan durumu + önemli oyuncular + h2h + potansiyel
      try {
        stats = await buildMatchStats(found, getExtras);
      } catch (e) {
        console.warn(`[refresh] zenginleştirme atlandı (#${bm.no}): ${e.message}`);
      }
    } else {
      analysis = analyzeMatch({ odds: null }); // veri yok
    }
    const prediction = predict({ analysis, stats });
    analyzedMatches.push({ ...bm, started: false, analysis, stats, prediction });
  }

  const upcomingCount = analyzedMatches.filter((m) => !m.started).length;
  console.log(`[refresh] başlamamış maç: ${upcomingCount}/${bulletin.matchCount} · eşleşen: ${matched}`);

  // 3b) Claude maç yorumları (anahtar varsa)
  if (aiEnabled) {
    console.log(`[refresh] Claude yorumları üretiliyor…`);
    await attachAiComments(analyzedMatches);
    const done = analyzedMatches.filter((m) => m.aiComment).length;
    console.log(`[refresh] AI yorumu yazılan maç: ${done}`);
  } else {
    console.log(`[refresh] AI yorumu kapalı (ANTHROPIC_API_KEY yok) — kural-tabanlı yorum kullanılacak.`);
  }

  // 4) Sürpriz radarı: puanı olan (oranlı VEYA tahmini) maçları sırala
  const radar = analyzedMatches
    .filter((m) => m.analysis.surpriseScore != null)
    .sort((a, b) => b.analysis.surpriseScore - a.analysis.surpriseScore)
    .map((m) => ({
      no: m.no,
      home: m.home.mediumName,
      away: m.away.mediumName,
      surpriseScore: m.analysis.surpriseScore,
      label: m.analysis.label,
      labelColor: m.analysis.labelColor,
      estimated: m.analysis.estimated,
      prediction: m.prediction?.symbol,
    }));

  const result = {
    updatedAt: new Date().toISOString(),
    usingExampleKey,
    year: bulletin.year,
    round: bulletin.round,
    matchCount: bulletin.matchCount,
    matchedCount: matched,
    upcomingCount,
    noUpcoming: upcomingCount === 0,
    matches: analyzedMatches,
    radar,
  };

  save('bulletin', result);
  console.log(`[refresh] bitti, cache'e yazıldı.`);
  return result;
}

// Doğrudan "node src/refresh.js" ile çalıştırılırsa bir kez yenile
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  refreshAll().catch((e) => {
    console.error('[refresh] HATA:', e.message);
    process.exit(1);
  });
}
