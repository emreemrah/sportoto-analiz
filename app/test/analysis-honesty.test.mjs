// SIFIR-SEZON DÜRÜSTLÜĞÜ — kullanıcı seçimli analiz motoru (engine.js)
// Hata: sezon başında tüm istatistikler 0 iken "iki takım eşit (0 — 0)" X'e
// puan sayılıyor, X 15+ puanla "açık ara önde" görünüp GÜVEN: YÜKSEK çıkıyordu.
// Kurallar: EŞİTLİK ≠ BERABERLİK (yön yok) · 0—0 kıyas = veri yok (analiz dışı).
import test from 'node:test';
import assert from 'node:assert/strict';
import { userSelectedAnalysisEngine } from '../src/analysis/engine.js';
import { getProfileTemplate } from '../src/analysisProfile.js';

const names = { home: 'Aarhus', away: 'Brondby' };
const zeroSeason = { xgFor: 0, xgAgainst: 0, cleanSheetPct: 0, possessionPct: 0, avg: { shots: 0, corners: 0 }, xgForHome: 0, xgForAway: 0, xgAgainstHome: 0, xgAgainstAway: 0 };
const zeroStanding = { position: 1, points: 0, played: 0, wins: 0, draws: 0, losses: 0, ppg: 0 };

function makeMatch(overrides = {}) {
  return {
    no: 1,
    home: { name: 'Aarhus' }, away: { name: 'Brondby' },
    stats: {
      home: { standing: { ...zeroStanding }, season: { ...zeroSeason } },
      away: { standing: { ...zeroStanding }, season: { ...zeroSeason } },
      ...overrides,
    },
  };
}

function profileWith(keys) {
  const criteria = getProfileTemplate().criteria;
  for (const k of keys) if (criteria[k]) criteria[k] = { on: true, impact: 'critical' };
  return { criteria, name: 'test', version: 1 };
}

const XG_KEYS = ['xgFor', 'xgAgainst', 'cleanSheet', 'possession', 'shots', 'ppg', 'corners'];

test('SIFIR-SEZON: 0—0 kıyaslar X üretmez — güven YÜKSEK olamaz, X "açık ara önde" olamaz', () => {
  const out = userSelectedAnalysisEngine(makeMatch(), profileWith(XG_KEYS));
  assert.equal(out.ok, true);
  const v = out.verdict;
  // Eski hata: drawScore ~15, main 'X', confidence 'Yüksek'. Yeni: X'e puan akmaz.
  const drawPts = out.results.filter((r) => r.available && r.side === 'draw').reduce((s, r) => s + r.points, 0);
  assert.equal(drawPts, 0, `0—0 eşitlikten X puanı üretilemez (drawPts=${drawPts})`);
  assert.notEqual(v.confidence, 'Yüksek', 'verisiz maçta güven Yüksek olamaz');
  assert.ok(!(v.main === 'X' && v.confidence !== 'Düşük'), 'X sahte favori olamaz');
  // 0—0 kıyaslar dürüstçe "analiz dışı" bırakılır:
  const na = out.results.filter((r) => !r.available);
  assert.ok(na.length >= 3, `sıfır kıyaslar analiz dışı kalmalı (na=${na.length})`);
  assert.ok(na.some((r) => /veri henüz oluşmamış/.test(r.note)), 'sebep açıkça yazılır');
});

test('GERÇEK eşitlik (sıfır değil): yön sinyali yok — X kanıtı sayılmaz ama kriter analizde kalır', () => {
  const m = makeMatch();
  m.stats.home.season = { ...zeroSeason, xgFor: 1.4 };
  m.stats.away.season = { ...zeroSeason, xgFor: 1.4 };
  const out = userSelectedAnalysisEngine(m, profileWith(['xgFor']));
  const row = out.results.find((r) => r.key === 'xgFor');
  assert.equal(row.available, true);
  assert.equal(row.side, null, 'eşitlik → yön yok (draw DEĞİL)');
  assert.equal(row.points, 0);
  assert.ok(/yön sinyali yok/.test(row.note), row.note);
});

test('GERÇEK beraberlik eğilimi kriteri X sinyali vermeye DEVAM eder (meşru X yolu kapanmaz)', () => {
  const m = makeMatch();
  m.stats.home.standing = { ...zeroStanding, played: 10, draws: 4, wins: 3, losses: 3, points: 13, ppg: 1.3 };
  m.stats.away.standing = { ...zeroStanding, played: 10, draws: 4, wins: 2, losses: 4, points: 10, ppg: 1.0 };
  const out = userSelectedAnalysisEngine(m, profileWith(['draws']));
  const row = out.results.find((r) => r.key === 'draws');
  assert.equal(row.available, true);
  assert.equal(row.side, 'draw', 'gerçek beraberlik eğilimi X sinyali vermeli (%40 ≥ %28)');
});

// ——— GENEL FİLTRELER: "41 kritere uygulanıyor mu?" dürüstlük sözleşmesi ———
const TABLE14 = { overall: Array.from({ length: 14 }, (_, i) => ({
  position: i + 1, name: `Takim${i + 1}`,
  points: [30, 27, 24, 21, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1][i], played: 12,
})) };
function detailVs(list) { return list.map(([res, opp]) => ({ result: res, oppName: opp, score: '1-0' })); }

test('FİLTRE: "Güçlüye karşı" seçilince form/PPG yalnız güçlü rakip maçlarından hesaplanır ([Filtre] notu + altın kural sınıfı)', () => {
  const m = makeMatch();
  // Ev 8. sıra (13p/12maç, ppg 1.08): güçlü = kendisinden ≥10 puan üstü → 1.-4. sıralar.
  m.stats.leagueTable = TABLE14;
  m.stats.home.standing = { position: 8, points: 13, played: 12, wins: 3, draws: 4, losses: 5, ppg: 1.083 };
  m.stats.away.standing = { position: 9, points: 11, played: 12, wins: 3, draws: 2, losses: 7, ppg: 0.917 };
  m.stats.home.last5detail = detailVs([['G', 'Takim1'], ['M', 'Takim2'], ['G', 'Takim13'], ['B', 'Takim7'], ['G', 'Takim14']]);
  m.stats.away.last5detail = detailVs([['M', 'Takim1'], ['M', 'Takim3'], ['G', 'Takim12'], ['B', 'Takim8'], ['G', 'Takim11']]);
  const profile = profileWith(['formGeneral', 'ppg', 'possession']);
  profile.globalFilters = { period: 'season', venueScope: 'overall', opponentStrength: 'strong' };
  m.stats.home.season.avg = { ...(m.stats.home.season.avg || {}), possession: 55 };
  m.stats.away.season.avg = { ...(m.stats.away.season.avg || {}), possession: 45 };
  const out = userSelectedAnalysisEngine(m, profile);
  const form = out.results.find((r) => r.key === 'formGeneral');
  // Ev güçlüye karşı: T1(G), T2(M) → n=2 · Dep: T1(M), T3(M) → n=2 → uygulanır.
  assert.equal(form.available, true);
  assert.equal(form.filterApplied, true, 'form filtreyi uygulamalı');
  assert.ok(/\[Filtre: Güçlü rakipler — n=2\/2\]/.test(form.note), form.note);
  const ppg = out.results.find((r) => r.key === 'ppg');
  assert.equal(ppg.filterApplied, true, 'PPG filtreyi uygulamalı');
  // Filtre uygulayamayan kriter SESSİZCE genel değere düşmez — açıkça işaretlenir:
  const poss = out.results.find((r) => r.key === 'possession');
  assert.ok(!poss.filterApplied);
  assert.ok(/Filtre bu kriterde uygulanamadı/.test(poss.note), poss.note);
});

test('FİLTRE dürüstlüğü: yeterli güçlü-rakip maçı yoksa kriter uydurmaz, "analiz dışı" kalır', () => {
  const m = makeMatch();
  m.stats.leagueTable = TABLE14;
  m.stats.home.standing = { position: 8, points: 13, played: 12, wins: 3, draws: 4, losses: 5, ppg: 1.083 };
  m.stats.away.standing = { position: 9, points: 11, played: 12, wins: 3, draws: 2, losses: 7, ppg: 0.917 };
  m.stats.home.last5detail = detailVs([['G', 'Takim13'], ['G', 'Takim14'], ['B', 'Takim12']]); // hiç güçlü yok
  m.stats.away.last5detail = detailVs([['M', 'Takim1'], ['M', 'Takim2'], ['B', 'Takim3']]);
  const profile = profileWith(['formGeneral']);
  profile.globalFilters = { period: 'season', venueScope: 'overall', opponentStrength: 'strong' };
  const out = userSelectedAnalysisEngine(m, profile);
  const form = out.results.find((r) => r.key === 'formGeneral');
  assert.equal(form.available, false, 'örneklem yetersiz → analiz dışı');
  assert.ok(/yeterli geçmiş maç yok/.test(form.note), form.note);
});

test('FİLTRE kapalıyken (varsayılan) davranış birebir eski hali — filtre notu üretilmez', () => {
  const m = makeMatch();
  m.stats.home.standing = { position: 8, points: 13, played: 12, wins: 3, draws: 4, losses: 5, ppg: 1.5 };
  m.stats.away.standing = { position: 9, points: 11, played: 12, wins: 3, draws: 2, losses: 7, ppg: 1.0 };
  const out = userSelectedAnalysisEngine(m, profileWith(['ppg']));
  const ppg = out.results.find((r) => r.key === 'ppg');
  assert.equal(ppg.available, true);
  assert.ok(!/\[Filtre/.test(ppg.note) && !/uygulanamadı/.test(ppg.note), ppg.note);
});

test('MAÇ LOGU BAĞLANDI: temiz kale gibi kriterler de "Güçlüye karşı" filtresini gerçek satırlardan uygular', () => {
  const m = makeMatch();
  m.stats.home.standing = { position: 5, points: 18, played: 12, wins: 5, draws: 3, losses: 4, ppg: 1.5 };
  m.stats.away.standing = { position: 8, points: 14, played: 12, wins: 4, draws: 2, losses: 6, ppg: 1.17 };
  const row = (result, gf, ga, isHome, oppTier) => ({ result, gf, ga, isHome, oppName: 'X', oppTier });
  m.stats.home.matchLog = [row('G', 2, 0, true, 'strong'), row('B', 0, 0, false, 'strong'), row('M', 1, 2, true, 'weak')];
  m.stats.away.matchLog = [row('M', 1, 3, false, 'strong'), row('M', 0, 2, true, 'strong'), row('G', 2, 0, false, 'weak')];
  const profile = profileWith(['cleanSheet']);
  profile.globalFilters = { period: 'season', venueScope: 'overall', opponentStrength: 'strong' };
  const out = userSelectedAnalysisEngine(m, profile);
  const cs = out.results.find((r) => r.key === 'cleanSheet');
  assert.equal(cs.available, true);
  assert.equal(cs.filterApplied, true, 'maç loguyla filtre uygulanmalı');
  assert.equal(cs.side, 'home', 'ev güçlüye karşı 2/2 temiz kale, dep 0/2');
  assert.ok(/\[Filtre: Güçlü rakipler — n=2\/2\]/.test(cs.note), cs.note);
});

test('MAÇ LOGU yoksa (eski cache) merkezî filtre devreye girmez — dürüst "genel değer" işareti kalır', () => {
  const m = makeMatch();
  m.stats.home.standing = { position: 5, points: 18, played: 12, wins: 5, draws: 3, losses: 4, ppg: 1.5 };
  m.stats.away.standing = { position: 8, points: 14, played: 12, wins: 4, draws: 2, losses: 6, ppg: 1.17 };
  m.stats.home.season.cleanSheetPct = 40; m.stats.away.season.cleanSheetPct = 20;
  const profile = profileWith(['cleanSheet']);
  profile.globalFilters = { period: 'season', venueScope: 'overall', opponentStrength: 'strong' };
  const out = userSelectedAnalysisEngine(m, profile);
  const cs = out.results.find((r) => r.key === 'cleanSheet');
  assert.equal(cs.available, true, 'sezon yüzdesi yoluna düşer');
  assert.ok(!cs.filterApplied);
  assert.ok(/Filtre bu kriterde uygulanamadı/.test(cs.note), cs.note);
});

// ——— HEDGE KURALI: ezici favoride alternatif 1X'tir, "12" saçmalığı üretilmez ———
test('EZİCİ EV FAVORİSİ: karşı tarafın kırıntı puanı (2.2 vs 12.4) alternatifi 12 YAPAMAZ → 1X', () => {
  const m = makeMatch();
  // Helsinki–TPS vakasının birebir yapısı: 8 kriter ev, 1 kriter dep, X 0.
  m.stats.home.standing = { position: 5, points: 25, played: 16, wins: 7, draws: 4, losses: 5, ppg: 1.56 };
  m.stats.away.standing = { position: 8, points: 22, played: 16, wins: 6, draws: 4, losses: 6, ppg: 1.38 };
  m.stats.home.season = { ...zeroSeason, xgFor: 1.53, xgAgainst: 1.46, xgForHome: 1.56, xgAgainstHome: 1.57, avg: { shots: 13, possession: 52, corners: 10.81 } };
  m.stats.away.season = { ...zeroSeason, xgFor: 1.45, xgAgainst: 1.59, xgForAway: 1.5, xgAgainstAway: 1.38, avg: { shots: 11.69, possession: 47, corners: 10.13 } };
  const out = userSelectedAnalysisEngine(m, profileWith(['shots', 'possession', 'xgAgainst', 'xgFor', 'ppg', 'corners']));
  const v = out.verdict;
  assert.equal(v.main, '1', 'ana seçim ev');
  assert.equal(v.alt, '1X', 'ezici favorinin gerçekçi riski BERABERLİKTİR — alternatif 1X olmalı, 12 değil');
  const d = out.sportotoDecision;
  assert.deepEqual(d.safeCoupon, ['1', 'X'], 'güvenli kupon da 1-X olmalı');
});

test('GERÇEK iki taraflı maçta 12 alternatifi KORUNUR (kural aşırıya kaçmaz)', () => {
  const m = makeMatch();
  m.stats.home.standing = { position: 3, points: 30, played: 15, wins: 9, draws: 3, losses: 3, ppg: 2.0 };
  m.stats.away.standing = { position: 4, points: 27, played: 15, wins: 8, draws: 3, losses: 4, ppg: 1.8 };
  // Ev iki kriterde önde, dep bir kriterde belirgin önde → dep gerçek rakip.
  m.stats.home.season = { ...zeroSeason, xgFor: 1.9, xgAgainst: 1.2, avg: { shots: 14, possession: 54 } };
  m.stats.away.season = { ...zeroSeason, xgFor: 1.7, xgAgainst: 1.0, avg: { shots: 15.5, possession: 51 } };
  const out = userSelectedAnalysisEngine(m, profileWith(['xgFor', 'possession', 'shots', 'xgAgainst']));
  const v = out.verdict;
  if (v.main === '1' && v.confidence !== 'Düşük') {
    // dep payı ana seçimin %45'ini geçiyorsa 12 meşru kalır:
    const s = out.results.filter((r) => r.available && r.side === 'away').reduce((t, r) => t + r.points, 0);
    const h2 = out.results.filter((r) => r.available && r.side === 'home').reduce((t, r) => t + r.points, 0);
    if (s >= h2 * 0.45) assert.equal(v.alt, '12', `gerçek rakipte 12 korunmalı (dep ${s} vs ev ${h2})`);
  }
});

// ——— İSTATİSTİK FİLTRELİ KARNE yardımcısı ———
test('statsFromLog: seçilen kesit gerçek satırlardan hesaplanır; log yoksa null (uydurma yok)', async () => {
  const { statsFromLog } = await import('../src/analysis/criteria.js');
  const row = (result, gf, ga, isHome, oppTier) => ({ result, gf, ga, isHome, oppName: 'X', oppTier });
  const team = { matchLog: [
    row('G', 2, 0, true, 'strong'), row('B', 1, 1, false, 'strong'),
    row('M', 0, 2, true, 'weak'), row('G', 3, 1, false, 'mid'), row('G', 2, 1, true, 'mid'),
  ] };
  const v = statsFromLog(team, { period: 'season', venueScope: 'overall', opponentStrength: 'strong' }, 'home');
  assert.equal(v.n, 2); assert.equal(v.w, 1); assert.equal(v.d, 1);
  assert.equal(v.gfPg, 1.5); assert.equal(v.csPct, 50);
  const split = statsFromLog(team, { period: 'season', venueScope: 'split', opponentStrength: 'all' }, 'home');
  assert.equal(split.n, 3, 'split + home → yalnız iç saha satırları');
  assert.equal(statsFromLog({ }, { period: 'season', venueScope: 'overall', opponentStrength: 'strong' }, 'home'), null, 'log yoksa null');
});

// ——— ÜRETİLMİŞ GÖSTERGELER (derivedStats) ———
test('derivedStats: şeffaf formüller doğru hesaplar; veri yoksa null (uydurma yok)', async () => {
  const { derivedStats } = await import('../src/analysis/criteria.js');
  const row = (result, gf, ga, isHome, oppTier) => ({ result, gf, ga, isHome, oppName: 'X', oppTier });
  const team = {
    season: { goalsPerGame: 1.8, xgFor: 1.5, concededPerGame: 1.2, xgAgainst: 1.5, avg: { shots: 12, shotsOnTarget: 4.8 } },
    matchLog: [
      row('G', 2, 0, true, 'strong'), row('G', 1, 0, false, 'weak'),
      row('B', 1, 1, true, 'mid'), row('M', 0, 2, false, 'strong'),
      row('G', 3, 1, true, 'weak'), row('M', 0, 1, false, 'mid'),
      row('M', 1, 2, true, 'mid'), row('B', 2, 2, false, 'weak'),
    ],
  };
  const d = derivedStats(team);
  assert.equal(d.finishing, 1.2, 'Gol÷xG = 1.8/1.5');
  assert.equal(d.defEff, 0.8, 'Yediği÷xGA = 1.2/1.5');
  assert.equal(d.shotAcc, 40, 'isabet % = 4.8/12');
  assert.equal(d.goalsPerShot, 0.15, 'gol/şut = 1.8/12');
  assert.equal(d.unbeatenRun, 3, 'G G B sonra M → 3');
  assert.equal(d.winRun, 2);
  assert.equal(d.scoringRun, 3, 'gf 2,1,1 sonra 0 → 3');
  assert.equal(d.csRun, 2, 'ga 0,0 sonra 1 → 2');
  assert.equal(d.bttsRun, 0, 'ilk maç 2-0 → KG serisi 0');
  // son 5 ppg = (3+3+1+0+3)/5 = 2.0; tüm log ppg = 11/8 = 1.375 → +0.63
  assert.equal(d.momentum, 0.63);
  // ağırlıklı son 5: G×1.5=4.5 + G×0.5=1.5 + B×1=1 + M=0 + G×0.5=1.5 = 8.5
  assert.equal(d.weightedLast5, 8.5);
  // iç ppg (3+1+3+0)/4 = 1.75; dış ppg (3+0+0+1)/4 = 1.0 → +0.75
  assert.equal(d.venueGap, 0.75);
});

test('derivedStats dürüstlük: boş takım/junk sıfırlar satır üretmez', async () => {
  const { derivedStats } = await import('../src/analysis/criteria.js');
  const empty = derivedStats({});
  for (const k of Object.keys(empty)) assert.equal(empty[k], null, `${k} veri yokken null olmalı`);
  // Sezon başı junk: her şey 0 → xG oranları null (0'dan oran uydurulmaz)
  const junk = derivedStats({ season: { goalsPerGame: 0, xgFor: 0, concededPerGame: 0, xgAgainst: 0, avg: { shots: 0, shotsOnTarget: 0 } } });
  assert.equal(junk.finishing, null); assert.equal(junk.defEff, null);
  assert.equal(junk.shotAcc, null); assert.equal(junk.goalsPerShot, null);
  // Kısa log: 5 maç → momentum null (son5 = sezon olurdu, sahte sinyal); seriler yine gerçek
  const rowG = { result: 'G', gf: 1, ga: 0, isHome: true, oppTier: 'mid' };
  const short = derivedStats({ matchLog: [rowG, rowG, rowG, rowG, rowG] });
  assert.equal(short.momentum, null, '6 maçtan az → ivme hesaplanmaz');
  assert.equal(short.winRun, 5, 'seriler gerçek sayımdır');
  assert.equal(short.venueGap, null, 'dış saha ≥3 maç yoksa ev/dep farkı yok');
});
