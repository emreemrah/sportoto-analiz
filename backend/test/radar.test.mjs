// RADAR MERKEZİ TESTLERİ — motorlar, normalizasyon, kapılar, mühürleme, karne.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computePerformanceRadar } from '../src/radar/performanceRadar.js';
import { computeExpectationRadar } from '../src/radar/expectationRadar.js';
import { computePublicBettingRadar, computeBandHistory, bandOf } from '../src/radar/publicBettingRadar.js';
import { computeMarketRadar, oddsTimeline } from '../src/radar/marketRadar.js';
import { computeBulletinMemoryRadar, buildMemoryContext } from '../src/radar/bulletinMemoryRadar.js';
import { computeSurpriseDna } from '../src/radar/surpriseDna.js';
import { combineMaster, normalizeWeights, computeConflict } from '../src/radar/masterRadar.js';
import { aggregateSignals } from '../src/radar/signalFamilies.js';
import { impliedFromOdds, radarOutput } from '../src/radar/util.js';
import { RADAR_IDS, GATES } from '../src/radar/config.js';
import { computeRadarCenterForData, prepareRadarCenter, sealedRadarCenterFromSnapshot } from '../src/radar/radarService.js';
import { buildRadarScorecard } from '../src/radar/scorecard.js';
import { freezeBulletinFromData } from '../src/archive/snapshotService.js';
import { ingestOfficialResults, maybeCompleteAndEvaluate } from '../src/archive/resultsService.js';
import { tmpStore, makeBulletinData, makeOfficialMatches, FREEZE_AT_UTC, deep } from './helpers/fixtures.mjs';

const FREEZE_MS = new Date(FREEZE_AT_UTC).getTime();
const RESULTS = { 1: '1', 2: '2', 3: '2', 4: '1', 5: 'X', 6: '2', 7: 'X', 8: '1', 9: '2', 10: '1', 11: '1', 12: '2', 13: '1', 14: 'X', 15: '1' };

const OUT_KEYS = ['id', 'name', 'version', 'hasData', 'status', 'dataQuality', 'homeScore', 'drawScore', 'awayScore',
  'favoriteFailureRisk', 'direction', 'surpriseDirection', 'activeSignals', 'missingSignals', 'positives', 'negatives', 'methodologyVersion'];

function fakeRadar(id, { hasData = true, scores = { home: 60, draw: 22, away: 18 }, risk = 30, dq = 80, direction = '1' } = {}) {
  return radarOutput({
    id, name: id, version: 'test-1', hasData, status: hasData ? 'ok' : 'insufficient',
    dataQuality: dq, scores: hasData ? scores : null, favoriteFailureRisk: hasData ? risk : null,
    direction: hasData ? direction : null, surpriseDirection: hasData ? 'X' : null,
  });
}

test('beş radar da aynı standart çıktı tipini üretir', async () => {
  const data = makeBulletinData({ roundId: 9001 });
  const m = data.matches[0];
  const store = tmpStore();
  const memoryContext = buildMemoryContext({ positionStats: null, evaluations: [] });
  const outputs = [
    computePerformanceRadar(m, {}),
    computeExpectationRadar(m, {}),
    computePublicBettingRadar(m, {}),
    computeMarketRadar(m, { observations: [] }),
    computeBulletinMemoryRadar(m, { memoryContext }),
  ];
  for (const o of outputs) {
    for (const k of OUT_KEYS) assert.ok(k in o, `${o.id} çıktısında ${k} alanı olmalı`);
    assert.ok(['ok', 'no_source', 'insufficient'].includes(o.status));
  }
  // Radar Merkezi uçtan uca: 15 maç için de standart yapı.
  const rc = await computeRadarCenterForData(data, { store, now: FREEZE_MS - 3600e3 });
  assert.equal(rc.matches.length, 15);
  for (const mm of rc.matches) {
    assert.ok(mm.master.classification);
    for (const id of Object.values(RADAR_IDS)) assert.ok(mm.radars[id], `maç ${mm.no} → ${id} çıktısı olmalı`);
  }
});

test('eksik radar verisi: ağırlıklar yalnız aktif radarlar üzerinden 100’e normalize edilir', () => {
  const radars = {
    [RADAR_IDS.PERFORMANCE]: fakeRadar(RADAR_IDS.PERFORMANCE),
    [RADAR_IDS.EXPECTATION]: fakeRadar(RADAR_IDS.EXPECTATION),
    [RADAR_IDS.PUBLIC]: fakeRadar(RADAR_IDS.PUBLIC, { hasData: false }),
    [RADAR_IDS.MARKET]: fakeRadar(RADAR_IDS.MARKET, { hasData: false }),
    [RADAR_IDS.MEMORY]: fakeRadar(RADAR_IDS.MEMORY, { hasData: false }),
  };
  const w = normalizeWeights(radars);
  assert.equal(w[RADAR_IDS.PUBLIC], 0);
  assert.equal(w[RADAR_IDS.MARKET], 0);
  assert.equal(w[RADAR_IDS.MEMORY], 0);
  assert.ok(Math.abs(w[RADAR_IDS.PERFORMANCE] - (30 / 55) * 100) < 0.2);
  assert.ok(Math.abs(w[RADAR_IDS.EXPECTATION] - (25 / 55) * 100) < 0.2);
  assert.ok(Math.abs(w[RADAR_IDS.PERFORMANCE] + w[RADAR_IDS.EXPECTATION] - 100) < 0.3);

  // Hafıza tavanı: yalnız performans + hafıza aktifse hafıza %15'i aşamaz.
  const w2 = normalizeWeights({
    [RADAR_IDS.PERFORMANCE]: fakeRadar(RADAR_IDS.PERFORMANCE),
    [RADAR_IDS.MEMORY]: fakeRadar(RADAR_IDS.MEMORY),
  });
  assert.ok(w2[RADAR_IDS.MEMORY] <= 15.01, `hafıza tavanı aşıldı: ${w2[RADAR_IDS.MEMORY]}`);
});

test('verisi olmayan radar sonucu nötr 50 ile etkilemez', () => {
  const base = {
    [RADAR_IDS.PERFORMANCE]: fakeRadar(RADAR_IDS.PERFORMANCE, { risk: 20 }),
    [RADAR_IDS.EXPECTATION]: fakeRadar(RADAR_IDS.EXPECTATION, { risk: 24 }),
  };
  const withMissing = combineMaster({
    ...base,
    [RADAR_IDS.PUBLIC]: fakeRadar(RADAR_IDS.PUBLIC, { hasData: false }),
  });
  const withoutMissing = combineMaster(base);
  // Eksik radar eklemek riski DEĞİŞTİRMEMELİ (nötr 50 sızması yok).
  assert.equal(withMissing.favoriteFailureRisk, withoutMissing.favoriteFailureRisk);
  assert.deepEqual(withMissing.scores, withoutMissing.scores);
  assert.equal(withMissing.weights[RADAR_IDS.PUBLIC], 0);
});

test('halk verisi yoksa Radar 3: hasData=false + no_source; API sahte veri dönmez', () => {
  const r3 = computePublicBettingRadar({ no: 1 }, { matchPublicData: null });
  assert.equal(r3.hasData, false);
  assert.equal(r3.status, 'no_source');
  assert.equal(r3.homeScore, null);
  // Bilyoner artık bağlı kaynak: bu maçta gözlem yoksa availability 'match_missing'
  // ("bu maç için gözlem yok"); kaynak hiç yokken 'accumulating' ("bekleniyor").
  const miss = r3.missingSignals?.[0];
  assert.ok(['match_missing', 'accumulating'].includes(miss?.availability));
  assert.ok(/gözlem|bekleniyor/.test(r3.note));
});

test('Radar 3: sentetik sağlayıcı verisiyle bant + yığılma + örneklem merdiveni çalışır', () => {
  const mk = (p1, at) => ({ providerId: 'test', providerName: 'Test Kaynak', percentages: { '1': p1, X: Math.round((100 - p1) / 2), '2': 100 - p1 - Math.round((100 - p1) / 2) }, observedAt: at });
  const history = computeBandHistory([
    ...Array.from({ length: 84 }, (_, i) => ({ favoritePct: 76, favoriteSymbol: '1', officialResult: i < 46 ? '1' : i % 2 ? 'X' : '2' })),
  ]);
  const b = history.bands.find((x) => x.label === '%70–79');
  assert.equal(b.sample, 84);
  assert.equal(b.favoriteWinRate, 55);
  assert.equal(b.confidence.label, 'Orta güven');
  assert.equal(bandOf(76).label, '%70–79');

  const r3 = computePublicBettingRadar({ no: 1 }, {
    matchPublicData: [mk(76, '2026-07-24T10:00:00Z'), mk(79, '2026-07-25T10:00:00Z')],
    bandHistory: history,
  });
  assert.equal(r3.hasData, true);
  assert.equal(r3.details.overloaded, true);
  assert.ok(r3.negatives.some((t) => t.includes('yığılma')));
  assert.ok(r3.negatives.some((t) => t.includes('84 maç')), 'bant geçmişi açıklaması üretilmeli');
});

test('overround temizleme doğru (marj kaldırılır, toplam %100)', () => {
  const imp = impliedFromOdds({ home: 2.0, draw: 3.6, away: 4.0 });
  const sum = imp.home + imp.draw + imp.away;
  assert.ok(Math.abs(sum - 100) < 0.3, `toplam %100 olmalı (${sum})`);
  // 1/2.0=0.5, 1/3.6=0.2778, 1/4.0=0.25 → toplam 1.0278 → ev %48.6
  assert.ok(Math.abs(imp.home - 48.6) < 0.2);
  assert.ok(imp.overroundPct > 2 && imp.overroundPct < 4);
});

test('TEK oran gözlemiyle "hareket" sinyali ÜRETİLMEZ; iki gözlemle yön doğru hesaplanır', () => {
  const m = { no: 1, preOdds: { home: 1.8, draw: 3.5, away: 4.4 } };
  const single = computeMarketRadar(m, { observations: [{ observedAt: '2026-07-25T10:00:00Z', odds: m.preOdds }] });
  assert.equal(single.details.movement, null, 'tek gözlem → hareket yok');
  assert.ok(single.missingSignals.some((s) => s.key === 'movement'));
  assert.ok(!single.activeSignals.some((s) => s.key.startsWith('drift_')));

  const two = computeMarketRadar(m, {
    observations: [
      { observedAt: '2026-07-24T10:00:00Z', odds: { home: 2.2, draw: 3.4, away: 3.4 } },
      { observedAt: '2026-07-25T10:00:00Z', odds: { home: 1.8, draw: 3.5, away: 4.4 } },
    ],
  });
  assert.ok(two.details.movement, 'iki gözlem → hareket analizi var');
  assert.ok(two.details.movement.delta['1'] > 0, 'ev olasılığı yükselmiş olmalı');
  assert.ok(two.activeSignals.some((s) => s.key === 'drift_1'), 'ev yönlü sürüklenme sinyali');
});

test('az örnekli Hafıza Radarı güçlü sinyal üretmez; bülten sırası TEK BAŞINA sürpriz oluşturamaz', () => {
  // 5 maçlık minicik örneklem → usable değil.
  const ctxSmall = buildMemoryContext({
    positionStats: { sampleBulletins: 1, positions: [{ position: 1, sample: 1, counts: { '1': 1, X: 0, '2': 0 }, pct: { '1': 100, X: 0, '2': 0 } }] },
    evaluations: [{ roundId: 1, matches: [{ no: 1, favoriteHit: false, radarLabel: null }] }],
  });
  const r5small = computeBulletinMemoryRadar({ no: 1 }, { memoryContext: ctxSmall });
  assert.equal(r5small.hasData, false, 'n<10 → radar kullanılamaz');

  // Yeterli örneklemde bile: hafıza yön puanı üretmez + master tek radar ile sınıf VERMEZ.
  const evals = Array.from({ length: 12 }, (_, i) => ({ roundId: i + 1, matches: [{ no: 1, favoriteHit: i % 3 === 0, radarLabel: null }] }));
  const ctx = buildMemoryContext({ positionStats: null, evaluations: evals });
  const r5 = computeBulletinMemoryRadar({ no: 1 }, { memoryContext: ctx });
  assert.equal(r5.hasData, true);
  assert.equal(r5.homeScore, null, 'hafıza yön puanı üretmez');
  assert.ok(r5.favoriteFailureRisk >= 50, 'favoriler bu sırada çok kaybetmiş');
  assert.ok(r5.note.includes('nedensel bağı yoktur') && r5.note.includes('KATILMAZ'),
    'dürüstlük uyarısı zorunlu: sıra nedensel değildir + karara katılmaz (radar-center-1.2.0)');

  const master = combineMaster({ [RADAR_IDS.MEMORY]: r5 });
  assert.equal(master.classification, 'insufficient_data', 'tek (yalnız hafıza) radar → sınıf üretilmez');
  assert.notEqual(master.classification, 'surprise_candidate');
});

test('aynı ailedeki benzer sinyaller bağımsız oylar gibi TEKRAR sayılmaz (azalan katkı)', () => {
  const one = aggregateSignals([{ key: 'a', family: 'form', label: 'Son 5', side: 'home', weight: 10 }]);
  const three = aggregateSignals([
    { key: 'a', family: 'form', label: 'Son 5', side: 'home', weight: 10 },
    { key: 'b', family: 'form', label: 'Son 6', side: 'home', weight: 10 },
    { key: 'c', family: 'form', label: 'Galibiyet serisi', side: 'home', weight: 10 },
  ]);
  assert.equal(one.sides.home, 10);
  assert.equal(three.sides.home, 17.5, '10 + 10×0.5 + 10×0.25 = 17.5 (30 DEĞİL)');
  assert.equal(three.families.form.capped, true);
  // Farklı aileler kısıtlanmaz:
  const mixed = aggregateSignals([
    { key: 'a', family: 'form', label: 'x', side: 'home', weight: 10 },
    { key: 'b', family: 'venue', label: 'y', side: 'home', weight: 10 },
  ]);
  assert.equal(mixed.sides.home, 20);
});

test('radar çatışması BANKO/Güçlü Aday etiketini engeller ve açıkça raporlanır', () => {
  const radars = {
    [RADAR_IDS.PERFORMANCE]: fakeRadar(RADAR_IDS.PERFORMANCE, { scores: { home: 70, draw: 18, away: 12 }, risk: 15, dq: 90, direction: '1' }),
    [RADAR_IDS.EXPECTATION]: fakeRadar(RADAR_IDS.EXPECTATION, { scores: { home: 15, draw: 20, away: 65 }, risk: 80, dq: 90, direction: '2' }),
    [RADAR_IDS.MARKET]: fakeRadar(RADAR_IDS.MARKET, { scores: { home: 66, draw: 20, away: 14 }, risk: 18, dq: 90, direction: '1' }),
  };
  const conflict = computeConflict(radars);
  assert.ok(conflict.score > GATES.strong.maxConflict, `çatışma yüksek olmalı (${conflict.score})`);
  const master = combineMaster(radars);
  assert.notEqual(master.classification, 'strong_candidate', 'çatışma varken banko verilemez');
  assert.ok(master.gateNotes.some((t) => t.includes('çatışma')) || master.conflictNotes.length > 0, 'çatışma açıkça raporlanmalı');
});

test('düşük dataQuality güçlü etiketleri engeller (banko ve sürpriz)', () => {
  const strongish = {
    [RADAR_IDS.PERFORMANCE]: fakeRadar(RADAR_IDS.PERFORMANCE, { scores: { home: 72, draw: 16, away: 12 }, risk: 12, dq: 30, direction: '1' }),
    [RADAR_IDS.EXPECTATION]: fakeRadar(RADAR_IDS.EXPECTATION, { scores: { home: 70, draw: 18, away: 12 }, risk: 15, dq: 30, direction: '1' }),
    [RADAR_IDS.MARKET]: fakeRadar(RADAR_IDS.MARKET, { scores: { home: 71, draw: 17, away: 12 }, risk: 14, dq: 35, direction: '1' }),
  };
  const m1 = combineMaster(strongish);
  assert.notEqual(m1.classification, 'strong_candidate', 'dq<50 → insufficient; asla güçlü aday değil');
  assert.equal(m1.classification, 'insufficient_data');

  const surprisish = {
    [RADAR_IDS.PERFORMANCE]: fakeRadar(RADAR_IDS.PERFORMANCE, { scores: { home: 30, draw: 30, away: 40 }, risk: 80, dq: 55, direction: '2' }),
    [RADAR_IDS.EXPECTATION]: fakeRadar(RADAR_IDS.EXPECTATION, { scores: { home: 28, draw: 30, away: 42 }, risk: 78, dq: 52, direction: '2' }),
  };
  const m2 = combineMaster(surprisish);
  assert.notEqual(m2.classification, 'surprise_candidate', 'dq<60 → sürpriz adayı verilemez');
});

test('Sürpriz DNA: açıklanabilir, veri yoksa özellik "unavailable" ve payda dışı', () => {
  const radars = {
    [RADAR_IDS.PERFORMANCE]: fakeRadar(RADAR_IDS.PERFORMANCE, { risk: 70 }),
    [RADAR_IDS.EXPECTATION]: { ...fakeRadar(RADAR_IDS.EXPECTATION, { risk: 72 }), details: { fakeFavorite: true, goalMinusXg: { home: 0.5, away: 0 } } },
    [RADAR_IDS.PUBLIC]: fakeRadar(RADAR_IDS.PUBLIC, { hasData: false }),
    [RADAR_IDS.MARKET]: fakeRadar(RADAR_IDS.MARKET, { hasData: false }),
    [RADAR_IDS.MEMORY]: fakeRadar(RADAR_IDS.MEMORY, { hasData: false }),
  };
  const dna = computeSurpriseDna(radars);
  assert.ok(dna.surpriseDnaScore > 0);
  assert.ok(dna.features.every((f) => ['present', 'absent', 'unavailable'].includes(f.state)));
  const unavailable = dna.features.filter((f) => f.state === 'unavailable');
  assert.ok(unavailable.some((f) => f.key === 'publicOverload'));
  assert.ok(unavailable.some((f) => f.key === 'squadIssue'), 'kadro verisi yok → unavailable (uydurma yok)');
  assert.ok(dna.matchedFeatures.includes('fallingFavoriteXg'));
});

test('MÜHÜR: radar çıktıları snapshot’a mühürlenir; kilit sonrası yeniden hesaplanmaz; sonuç hash’i değiştirmez', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 9100 });
  data.radarCenter = await computeRadarCenterForData(data, { store, now: FREEZE_MS - 3600e3 });
  assert.ok(data.radarCenter.matches.length === 15);

  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  const snap = await store.getSnapshot('9100');
  const sealedM1 = snap.payload.matches.find((m) => m.no === 1);
  assert.ok(sealedM1.radarCenter?.master?.classification, 'Radar Merkezi snapshot’a mühürlenmeli');
  assert.equal(snap.payload.radarCenter.methodologyVersion, data.radarCenter.methodologyVersion);
  assert.ok(snap.payload.radarCenter.baseWeights, 'kullanılan ağırlıklar mühürlenmeli');
  const hashBefore = snap.payloadHash;

  // Kilit sonrası: prepareRadarCenter önceki sonucu AYNEN döndürür (hesap yok).
  const mutated = deep(data);
  mutated.matches.forEach((m) => { if (m.stats) m.stats.home.standing.points = 99; });
  const reused = await prepareRadarCenter(mutated, { previous: data, isLocked: true, store, now: FREEZE_MS + 3600e3 });
  assert.deepEqual(deep(reused), deep(data.radarCenter), 'kilitli haftada radar yeniden hesaplanamaz');

  // İlk maçın sonucu gelir → diğer maçların mühürlü radarı DEĞİŞMEZ, hash aynı.
  await ingestOfficialResults('9100', makeOfficialMatches(data, { 1: '1' }), { store });
  const after = await store.getSnapshot('9100');
  assert.equal(after.payloadHash, hashBefore, 'sonuç eklemek snapshot hash’ini değiştiremez');
  assert.deepEqual(
    deep(after.payload.matches.map((m) => m.radarCenter)),
    deep(snap.payload.matches.map((m) => m.radarCenter)),
    'ilk maç sonucu diğer maçların radarını etkileyemez',
  );

  // Geçmiş hafta okuma: yalnız mühürlü çıktı (sealedRadarCenterFromSnapshot).
  const sealedView = sealedRadarCenterFromSnapshot(after);
  assert.equal(sealedView.sealed, true);
  assert.equal(sealedView.verificationHash, hashBefore);
  assert.deepEqual(
    deep(sealedView.matches.find((m) => m.no === 2).master),
    deep(data.radarCenter.matches.find((m) => m.no === 2).master),
    'geçmiş hafta güncel motorla yeniden hesaplanmaz — mühürlü hali döner',
  );

  // İlk yarı verisi hiçbir radar/karne alanına girmez.
  assert.ok(!/halfTime/i.test(JSON.stringify(after.payload)), 'payload halfTime içermemeli');
});

test('RADAR KARNESİ: yalnız mühürlü tahminlerden; sürpriz yakalama ile kesin yön AYRI; n değerleri açık', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 9200 });
  data.radarCenter = await computeRadarCenterForData(data, { store, now: FREEZE_MS - 3600e3 });
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  await ingestOfficialResults('9200', makeOfficialMatches(data, RESULTS), { store });
  await maybeCompleteAndEvaluate('9200', { store });

  // Mühürsüz hafta karneye GİRMEZ: snapshot'sız bülten + sonuç ekle.
  await store.upsertBulletin({ id: '9199', roundId: 9199, status: 'active' });
  await store.upsertOfficialResult({ bulletinId: '9199', matchId: 'x1', orderNo: 1, officialResult: '1', fullTimeScore: { home: 1, away: 0 } });

  const sc = await buildRadarScorecard({ store });
  assert.equal(sc.hasData, true);
  assert.equal(sc.roundsCounted, 1, 'yalnız mühürlü hafta sayılmalı');
  const at = sc.master.allTime;
  assert.ok(at.mainAccuracy.total > 0 && at.mainAccuracy.total <= 15);
  assert.ok(typeof at.mainAccuracy.hit === 'number');
  assert.ok(at.mainAccuracy.confidence.n === at.mainAccuracy.total, 'her oran n ile birlikte');
  // Sürpriz yakalama ve kesin yön ayrı alanlar:
  assert.ok('catchRate' in at.surpriseCandidate && 'exactRate' in at.surpriseCandidate);
  assert.ok(!/halfTime/i.test(JSON.stringify(sc)), 'karnede ilk yarı verisi olamaz');
  // Küçük örneklem uyarısı:
  assert.ok(sc.note && sc.note.includes('Örneklem'), 'küçük n’de dürüst uyarı');
  // Radar bazlı satırlar mevcut:
  assert.equal(sc.perRadar.length, 5);
});

test('oddsTimeline: oranı olmayan gözlemleri eler, zamana göre sıralar', () => {
  const tl = oddsTimeline([
    { observedAt: '2026-07-25T10:00:00Z', odds: { home: 2.0, draw: 3.4, away: 3.8 } },
    { observedAt: '2026-07-24T10:00:00Z', odds: { home: 2.1, draw: 3.4, away: 3.6 } },
    { observedAt: '2026-07-23T10:00:00Z', odds: null },
  ]);
  assert.equal(tl.length, 2);
  assert.ok(new Date(tl[0].observedAt) < new Date(tl[1].observedAt));
});

test('KRİTER KARNESİ: sinyal × lig + güç dengesi kuralı yalnız mühürlü ileri-testten ölçülür', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 9300, noDataAt: 0 }); // 15 maçın 15'i verili
  // İki lige böl: kriterlerin lig kırılımı gerçek alanla ölçülsün.
  data.matches.forEach((m, i) => { m.league = i % 2 === 0 ? 'Lig A' : 'Lig B'; });
  data.radarCenter = await computeRadarCenterForData(data, { store, now: FREEZE_MS - 3600e3 });
  // Güç dengesi kuralı: fikstürde saha profili olmadığından mühürlenecek değere
  // kural çıktısı yerleştirilir (sahada enrich üretir) — akış aynen: mühürle→sonuç→karne.
  data.radarCenter.matches.forEach((mm, i) => {
    mm.radars.performance.details = {
      ...(mm.radars.performance.details || {}),
      strengthBalance: { tier: i % 3 === 0 ? 'weak' : i % 3 === 1 ? 'strong' : 'even', label: 'test' },
    };
  });
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  await ingestOfficialResults('9300', makeOfficialMatches(data, RESULTS), { store });
  await maybeCompleteAndEvaluate('9300', { store });

  const sc = await buildRadarScorecard({ store });
  const cr = sc.criteria;
  assert.ok(cr, 'kriter karnesi alanı olmalı');

  // 1) SİNYAL × LİG: form sinyali her maçta ateşlenir → 15 ölçüm, iki lige bölünür.
  const form = cr.signals.find((s) => s.key === 'formGeneral');
  assert.ok(form, 'form sinyali karnede olmalı');
  assert.equal(form.overall.total, 15);
  assert.equal(form.byLeague.length, 2, 'lig kırılımı olmalı');
  assert.equal(form.byLeague.reduce((s, l) => s + l.total, 0), form.overall.total, 'lig toplamları genel toplama eşit');
  assert.ok(form.byLeague.every((l) => ['Lig A', 'Lig B'].includes(l.league)));
  assert.ok(form.overall.confidence && typeof form.overall.confidence.n === 'number', 'her hücrede n/güven etiketi');

  // 2) RADAR × LİG: "xG hangi ligde işliyor" sorusunun veri karşılığı mevcut.
  assert.ok(cr.perRadarByLeague.some((r) => r.id === 'performance' && r.league === 'Lig A'));

  // 3) GÜÇ DENGESİ KURALI ileri-test: "Ev güçlü" dendiğinde 1 gelme oranı ölçülür.
  const sr = cr.strengthRule;
  assert.equal(sr.evaluated, 15);
  assert.equal(sr.tiers.homeStrong.total, 5);
  // "Ev güçlü" denen maçlar (no 1,4,7,10,13) → resmî sonuçlar 1,1,X,1,1 → %80.
  assert.equal(sr.tiers.homeStrong.expectedRate, 80);
  // "Denk" denen maçlarda beklenen taraf YOK → yalnız dürüst dağılım raporlanır.
  assert.equal(sr.tiers.even.expectedRate, null);
  assert.equal(sr.tiers.even.results['2'], 4, 'denk dağılımı resmî sonuçlardan');
  assert.ok(sr.byLeague.length === 2 && sr.byLeague.every((l) => ['Lig A', 'Lig B'].includes(l.league)));

  // 4) İKİNCİ BOYUT (altın kural): sinyal başarısı RAKİP SINIFINA göre de kırılır.
  //    formGeneral hep ev yönlü → rakibi deplasman → sınıfı maçın sb.tier'ı:
  //    weak(5) + strong(5) + even(5) → üç kovanın toplamı genel toplama eşit.
  const tierSum = ['strong', 'even', 'weak'].reduce((t, k) => t + (form.byOpponentTier[k]?.total || 0), 0);
  assert.equal(tierSum, form.overall.total, 'rakip sınıfı kovaları genel toplama eşit');
  assert.equal(form.byOpponentTier.strong.total, 5);
  assert.ok(form.byOpponentTier.strong.confidence, 'sınıf hücresinde de n/güven etiketi');

  // 5) Maç tipine göre Master başarı: denk maçlar ayrı ölçülür.
  assert.equal(cr.masterByBalance.even.mainAccuracy.total, 5, 'denk maçlar ayrı kovada');
  assert.equal(
    cr.masterByBalance.even.mainAccuracy.total
    + cr.masterByBalance.homeStrong.mainAccuracy.total
    + cr.masterByBalance.awayStrong.mainAccuracy.total,
    15,
    'maç tipi kovaları bütünü kapsar',
  );

  // 6) DÜRÜSTLÜK: mühürsüz hafta kriter karnesine de GİRMEZ (tek hafta sayıldı).
  assert.equal(sc.roundsCounted, 1);
});
