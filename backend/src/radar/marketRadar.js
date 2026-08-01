// RADAR 4 — ORAN VE PİYASA HAREKETİ RADARI
// Girdi: arşivin bulletin_data_observations zaman serisindeki maç-öncesi oranlar
// + kilit anındaki oran.
// Overround temizlenir; hareket analizi için EN AZ İKİ farklı zamanlı gözlem
// ŞARTTIR — tek gözlemle "oran hareketi" ÜRETİLMEZ (yalnız seviye analizi yapılır).
//
// ÇOK KAYNAK UYARISI (kritik): HAREKET analizi TEK KAYNAK üzerinden yapılır.
// İki kaynağın gözlemleri aynı çizelgeye karıştırılırsa, kaynak A 2.10 kaynak B
// 2.30 derken çizelge sahte bir "oran hareketi" üretir. Bu yüzden çizelge
// BİRİNCİL kaynakla süzülür; ikinci kaynak yalnız ÇAPRAZ KIYAS (crossBook)
// için, aynı ana yakın gözlemle karşılaştırılır.
import { RADAR_IDS, RADAR_META, MARKET_RULES, SIGNAL_FAMILIES as F } from './config.js';
import { aggregateSignals, sidesToScores } from './signalFamilies.js';
import { qualityFromParts } from './dataQuality.js';
import { num, clamp, round1, impliedFromOdds, radarOutput, favoriteOfScores, directionOf } from './util.js';
import { LEGACY_ODDS_SOURCE, oddsSourceLabel, sortOddsSources } from '../providers/oddsSources.js';

const SRC = 'Maç-öncesi 1/X/2 oranları';   // marka adı YOK (arayüz kuralı)

// Çapraz kıyas penceresi: iki kaynağın gözlemi bu süreden uzaksa kıyaslanmaz
// (farklı anların oranı "kaynak farkı" değildir — zaman farkıdır).
const CROSS_WINDOW_MS = 6 * 3600e3;
// Anlamlı sayılan çapraz fark (yüzde puanı) — altındaki gürültüdür.
const CROSS_DIFF_PTS = 4;

// Gözlem serisinden oran zaman çizelgesi çıkarır (odds olan, zamana göre sıralı).
// opts.source verilirse YALNIZ o kaynağın gözlemleri alınır (kaynak karışmaz).
export function oddsTimeline(observations, { source = null } = {}) {
  return (observations || [])
    .filter((o) => o?.odds && num(o.odds.home) && num(o.odds.draw) && num(o.odds.away))
    .filter((o) => source == null || o.source === source)
    .map((o) => ({
      observedAt: o.observedAt, odds: o.odds, implied: impliedFromOdds(o.odds),
      source: o.source ?? null,
    }))
    .filter((o) => o.implied)
    .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
}

// Gözlemleri kaynağa göre ayırır: { [kaynak]: timeline }.
export function oddsTimelinesBySource(observations) {
  const all = oddsTimeline(observations);
  const out = {};
  for (const t of all) {
    const id = t.source || 'bilinmiyor';
    (out[id] ||= []).push(t);
  }
  return out;
}

// HAREKET için kullanılacak kaynak: birincil varsa O. Yoksa (ör. eski arşiv
// veya birincil o hafta hiç yazmamış) en çok gözlemi olan kaynak seçilir —
// seçim GİZLENMEZ, döndürülür ve rapora yazılır.
export function pickPrimaryOddsSource(bySource) {
  const ids = Object.keys(bySource || {});
  if (!ids.length) return null;
  if (bySource[LEGACY_ODDS_SOURCE]?.length) return LEGACY_ODDS_SOURCE;
  return sortOddsSources(ids).sort((a, b) => bySource[b].length - bySource[a].length)[0];
}

// ÇAPRAZ KAYNAK KIYASI — aynı ana yakın (≤6 sa) son gözlemler karşılaştırılır.
// Kaynaklar ORTALANMAZ; yalnız FARK raporlanır.
export function crossSourceCompare(bySource, primaryId) {
  const p = bySource?.[primaryId];
  if (!p?.length) return null;
  const pl = p[p.length - 1];
  const others = [];
  for (const id of sortOddsSources(Object.keys(bySource))) {
    if (id === primaryId) continue;
    const list = bySource[id];
    if (!list?.length) continue;
    const ol = list[list.length - 1];
    const gap = Math.abs(new Date(ol.observedAt).getTime() - new Date(pl.observedAt).getTime());
    if (gap > CROSS_WINDOW_MS) continue;             // farklı anlar kıyaslanmaz
    const diff = {
      '1': round1(ol.implied.home - pl.implied.home),
      X: round1(ol.implied.draw - pl.implied.draw),
      '2': round1(ol.implied.away - pl.implied.away),
    };
    others.push({
      source: id, label: oddsSourceLabel(id),
      odds: ol.odds, implied: ol.implied, observedAt: ol.observedAt,
      diff, maxDiff: round1(Math.max(...Object.values(diff).map(Math.abs))),
    });
  }
  if (!others.length) return null;
  return {
    primary: {
      source: primaryId, label: oddsSourceLabel(primaryId),
      odds: pl.odds, implied: pl.implied, observedAt: pl.observedAt,
    },
    others,
    maxDiff: round1(Math.max(...others.map((o) => o.maxDiff))),
    threshold: CROSS_DIFF_PTS,
  };
}

export function computeMarketRadar(m, {
  observations = [], publicRadar = null, lockAt = null, observedAt,
} = {}) {
  const meta = RADAR_META[RADAR_IDS.MARKET];
  // Kaynak bazında ayır → hareket YALNIZ birincil kaynakta hesaplanır.
  const bySource = oddsTimelinesBySource(observations);
  const primarySource = pickPrimaryOddsSource(bySource);
  const timeline = primarySource ? bySource[primarySource] : [];
  const cross = primarySource ? crossSourceCompare(bySource, primarySource) : null;
  const currentOdds = m?.preOdds || null;
  const currentImplied = impliedFromOdds(currentOdds);

  // Ne seri ne güncel oran → radar devre dışı.
  if (!timeline.length && !currentImplied) {
    return radarOutput({
      id: RADAR_IDS.MARKET, name: meta.name, version: meta.version,
      hasData: false, status: 'insufficient', dataQuality: 0,
      missingSignals: [{ key: 'odds', label: '1/X/2 oranları', reason: 'Bu maç için oran verisi yok.' }],
      note: 'Oran verisi olmadan piyasa analizi yapılmaz.',
    });
  }

  const opening = timeline[0] || null;
  const latest = timeline[timeline.length - 1] || null;
  const lockObs = lockAt
    ? [...timeline].reverse().find((o) => new Date(o.observedAt).getTime() <= new Date(lockAt).getTime()) || latest
    : latest;
  const nowImplied = currentImplied || latest?.implied || null;

  const signals = [];
  const positives = [];
  const negatives = [];
  const missing = [];
  const add = (key, label, side, weight, note) =>
    signals.push({ key, family: F.MARKET, label, side, weight, note: note || null, source: SRC, observedAt: observedAt || null });

  // 1) SEVİYE analizi: normalize piyasa olasılıkları taraf sinyali olarak.
  if (nowImplied) {
    add('marketLevelHome', 'Piyasa olasılığı (1)', 'home', nowImplied.home / 10, `%${nowImplied.home}`);
    add('marketLevelDraw', 'Piyasa olasılığı (X)', 'draw', nowImplied.draw / 10, `%${nowImplied.draw}`);
    add('marketLevelAway', 'Piyasa olasılığı (2)', 'away', nowImplied.away / 10, `%${nowImplied.away}`);
  }

  // 2) HAREKET analizi — EN AZ 2 farklı zamanlı gözlem şartı.
  const distinctTimes = new Set(timeline.map((o) => String(o.observedAt))).size;
  let movement = null;
  if (distinctTimes >= MARKET_RULES.minObservationsForMovement && opening && lockObs && opening.observedAt !== lockObs.observedAt) {
    const dHome = round1(lockObs.implied.home - opening.implied.home);
    const dDraw = round1(lockObs.implied.draw - opening.implied.draw);
    const dAway = round1(lockObs.implied.away - opening.implied.away);
    movement = {
      from: opening.implied, to: lockObs.implied,
      fromAt: opening.observedAt, toAt: lockObs.observedAt,
      delta: { '1': dHome, X: dDraw, '2': dAway },
      observations: timeline.length,
    };
    const moves = [{ k: '1', d: dHome, side: 'home' }, { k: 'X', d: dDraw, side: 'draw' }, { k: '2', d: dAway, side: 'away' }];
    for (const mv of moves) {
      if (mv.d >= MARKET_RULES.driftSignalPts) {
        add(`drift_${mv.k}`, `Piyasa ${mv.k} yönüne kaydı (+${mv.d} puan)`, mv.side, Math.min(6, mv.d * 1.2),
          `%${round1(opening.implied[mv.side === 'home' ? 'home' : mv.side === 'draw' ? 'draw' : 'away'])} → %${round1(lockObs.implied[mv.side === 'home' ? 'home' : mv.side === 'draw' ? 'draw' : 'away'])}`);
        positives.push(`Piyasa olasılığı ${mv.k} yönünde ${mv.d} puan yükseldi.`);
      }
    }
    // Geç/sert hareket: kilit öncesi pencere içinde büyük değişim.
    if (lockObs && timeline.length >= 2) {
      const windowStart = new Date(lockObs.observedAt).getTime() - MARKET_RULES.sharpWindowHours * 3600e3;
      const inWindow = timeline.filter((o) => new Date(o.observedAt).getTime() >= windowStart);
      if (inWindow.length >= 2) {
        const w0 = inWindow[0].implied, w1 = inWindow[inWindow.length - 1].implied;
        const sharp = Math.max(Math.abs(w1.home - w0.home), Math.abs(w1.draw - w0.draw), Math.abs(w1.away - w0.away));
        if (sharp >= MARKET_RULES.sharpMovePts) {
          negatives.push(`Maç saatine yakın pencerede piyasa ${round1(sharp)} puan oynadı — sert hareket.`);
        }
      }
    }
  } else if (timeline.length <= 1) {
    missing.push({
      key: 'movement', label: 'Oran hareketi',
      reason: `Hareket analizi için en az ${MARKET_RULES.minObservationsForMovement} farklı zamanlı gözlem gerekir; eldeki gözlem: ${timeline.length || (currentImplied ? 1 : 0)}. Yalnız mevcut oran seviyesi analiz edildi.`,
    });
  }

  // 3) Halk ↔ piyasa TERSLİĞİ: halk favoriye yığılırken favorinin piyasa
  //    olasılığı DÜŞÜYORSA ters hareket (halk verisi + hareket verisi şart).
  let inversion = null;
  const publicTop = publicRadar?.hasData ? publicRadar.details?.consensus : null;
  if (publicTop && movement) {
    const pubFav = ['1', 'X', '2'].map((k) => ({ k, v: num(publicTop[k]) ?? 0 })).sort((x, y) => y.v - x.v)[0];
    const d = movement.delta[pubFav.k];
    if (pubFav.v >= 60 && d <= -MARKET_RULES.driftSignalPts) {
      inversion = { publicPick: pubFav.k, publicPct: pubFav.v, marketDelta: d };
      const favName = pubFav.k === '1' ? 'ev sahibine' : pubFav.k === '2' ? 'deplasmana' : 'beraberliğe';
      negatives.push(`Halk ${favName} yönelirken (${'%'}${pubFav.v}) aynı yönün piyasa olasılığı ${Math.abs(d)} puan düştü — ters piyasa hareketi tespit edildi.`);
      add('inversion', 'Halk-piyasa tersliği', pubFav.k === '1' ? 'away' : pubFav.k === '2' ? 'home' : 'draw', 6, null);
    }
  } else if (!publicRadar?.hasData) {
    missing.push({ key: 'publicVsMarket', label: 'Halk-piyasa tersliği', reason: 'Oynanma yüzdesi kaynağı olmadığı için terslik analizi yapılamadı.' });
  }

  // 4) ÇAPRAZ KAYNAK FARKI — iki kaynak aynı maça farklı oran veriyorsa bu
  //    GERÇEK bir belirsizlik işaretidir. Kaynaklar ORTALANMAZ; fark yazılır.
  //    Kıyas yapılamıyorsa SEBEBİ yazılır (sessiz boşluk yok).
  if (cross) {
    if (cross.maxDiff >= CROSS_DIFF_PTS) {
      const en = [...cross.others].sort((a, b) => b.maxDiff - a.maxDiff)[0];
      negatives.push(`Oran kaynakları bu maçta ayrışıyor: ${cross.primary.label} ile ${en.label} arasında en çok ${en.maxDiff} puan fark var — piyasa fiyatı net değil.`);
      add('crossBook', 'Kaynaklar arası oran farkı', 'draw', 0,
        `${cross.primary.label} ↔ ${en.label}: ${en.maxDiff} puan`);
    } else {
      positives.push(`Oran kaynakları bu maçta birbirini doğruluyor (en çok ${cross.maxDiff} puan fark).`);
    }
  } else {
    const kaynakSayisi = Object.keys(bySource).length;
    missing.push({
      key: 'crossBook', label: 'Kaynaklar arası oran farkı',
      reason: kaynakSayisi >= 2
        ? 'İkinci kaynağın gözlemi birincilden çok farklı bir ana ait — zaman farkı kaynak farkı sayılmaz.'
        : 'Bu maç için tek oran kaynağından kayıt var — çapraz kaynak kıyası yapılamadı.',
    });
  }

  const { sides, applied, families } = aggregateSignals(signals);
  const scores = sidesToScores(sides, { drawFloor: 10 });
  const fav = favoriteOfScores(scores);

  let failureRisk = null;
  if (nowImplied) {
    const favSym = ['1', 'X', '2'].map((k) => ({ k, v: nowImplied[k === '1' ? 'home' : k === 'X' ? 'draw' : 'away'] })).sort((x, y) => y.v - x.v)[0];
    let bump = 0;
    if (movement && movement.delta[favSym.k] <= -MARKET_RULES.driftSignalPts) bump += 12;
    if (inversion) bump += 10;
    failureRisk = clamp(Math.round(100 - favSym.v + bump), 0, 100);
  }

  const dq = qualityFromParts([
    { ok: !!nowImplied, weight: 40 },
    { ok: distinctTimes >= 2, weight: 30 },
    { ok: timeline.length >= 4, weight: 15 },
    { ok: !!publicTop, weight: 15 },
  ]);

  const dir = directionOf(scores, fav?.symbol);
  return radarOutput({
    id: RADAR_IDS.MARKET, name: meta.name, version: meta.version,
    hasData: !!scores, status: scores ? 'ok' : 'insufficient', dataQuality: dq,
    scores, favoriteFailureRisk: failureRisk,
    direction: dir.direction, surpriseDirection: dir.surpriseDirection,
    activeSignals: applied, missingSignals: missing,
    positives, negatives, families,
    // Kaynak listesi GERÇEKTEN kullanılan kaynaklardan üretilir (marka adı yok).
    sources: (Object.keys(bySource).length
      ? sortOddsSources(Object.keys(bySource)).map((id) => ({
        name: oddsSourceLabel(id),
        observedAt: bySource[id][bySource[id].length - 1]?.observedAt || null,
        role: id === primarySource ? 'primary' : 'secondary',
      }))
      : [{ name: SRC, observedAt: latest?.observedAt || observedAt || null }]),
    details: {
      openingImplied: opening?.implied || null,
      lockImplied: lockObs?.implied || null,
      currentImplied: nowImplied,
      overroundPct: nowImplied?.overroundPct ?? null,
      movement, inversion,
      observationCount: timeline.length,
      // HAREKET hangi kaynaktan hesaplandı — gizlenmez.
      movementSource: primarySource ? { id: primarySource, label: oddsSourceLabel(primarySource) } : null,
      crossSource: cross,
    },
  });
}
