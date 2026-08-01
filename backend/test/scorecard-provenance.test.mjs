// KARNE PROVENANCE + RESMÎ İLERİ-TEST TESTLERİ (spec 16: 1–21, 24, 26–28)
// Kural: kanıtlanamayan kayıt resmî başarıya GİRMEZ (default-deny). Eski %69
// hesabını üreten iki hata burada kilitlenir: (a) backfilled/demo/legacy kayıt
// sayılması, (b) kapalı tercihlerin (1X/X2/12/102) "doğru" sayılması.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-sc-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-sc-arsiv-'));
// Sürücü sabitlenir: .env'de Supabase varsa depo gerçek arşive kayar (bkz. api.test.mjs).
process.env.ARCHIVE_DRIVER = 'file';
// GEÇMİŞ DEPOSU DA SABİT: .env'de Supabase varsa getHistoryStore() CANLI
// veritabanına düşer ve test geliştirme makinesindeki gerçek veriyi okur
// (legacy-isolation'da tam olarak bu olmuştu). Testler ağa çıkmaz.
process.env.HISTORY_DRIVER = 'file';
process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-gecmis-'));

const { save } = await import('../src/cache.js');
const { _resetArchiveStoreForTests, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const {
  PROVENANCE, recordFromArchive, recordFromLegacyCache, classifyRecord, officialForwardEligibility,
} = await import('../src/scorecards/provenance.js');
const {
  buildSystemScorecard, buildRetrospectiveScorecard, buildProvenanceReport,
  legacySystemScorecardResponse, legacyCriteriaScorecardResponse, expandPick, isSinglePick,
} = await import('../src/scorecards/scorecardService.js');
const { buildRadarScorecard } = await import('../src/radar/scorecard.js');
const { buildCriterionScorecard, computeAnalysisCenterForData } = await import('../src/analysis/analysisService.js');
const { computeRadarCenterForData } = await import('../src/radar/radarService.js');
const { registerBulletinFromData, freezeBulletinFromData } = await import('../src/archive/snapshotService.js');
const { ingestOfficialResults } = await import('../src/archive/resultsService.js');
const makeScorecardsRouter = (await import('../src/routes/scorecards.js')).default;
const { makeBulletinData, makeOfficialMatches, FREEZE_AT_UTC } = await import('./helpers/fixtures.mjs');

const T0 = new Date(FREEZE_AT_UTC).getTime();          // freezeAt (UTC)
const iso = (t) => new Date(t).toISOString();
const FIRST = T0 + 5 * 60e3;                            // ilk maç: freeze + 5 dk

// ---------- el yapımı fikstürler (stub store: kesin kontrol) ----------------
const mkBulletin = (rid) => ({
  id: String(rid), roundId: rid, week: `${rid}. Hafta`, season: '2026/2027', status: 'completed',
  freezeAt: iso(T0), firstMatchStartAt: iso(FIRST), lockedAt: iso(T0),
});
const mkMatch = (no, main, sym) => ({
  no, matchId: String(no),
  home: { name: `Ev${no}` }, away: { name: `Dep${no}` },
  analysisCenter: main ? { officialMasterAnalysis: { ok: true, mainPrediction: main } } : null,
  systemPrediction: sym ? { symbol: sym } : null,
});
const mkSnap = (rid, matches, over = {}, payloadOver = {}) => ({
  id: `snap-${rid}`, bulletinId: String(rid),
  payloadHash: `hash-${rid}`, immutable: true, late: false,
  createdAt: iso(T0 - 3600e3), lockedAt: iso(T0), dataObservedAt: iso(T0 - 60e3),
  payload: {
    bulletin: { roundId: rid, week: `${rid}. Hafta`, season: '2026/2027', freezeAt: iso(T0), firstMatchStartAt: iso(FIRST) },
    engine: { analysisEngineVersion: 'engine-test-1' },
    analysisCenter: { officialProfile: { version: 3 } },
    matches,
    ...payloadOver,
  },
  ...over,
});
const mkResult = (no, r) => ({ matchId: String(no), officialResult: r, fullTimeScore: { home: 1, away: 0 } });
const stubStore = (rows) => ({
  listBulletins: async () => rows.map((r) => r.bulletin),
  getSnapshot: async (id) => rows.find((r) => String(r.bulletin.id) === String(id))?.snap ?? null,
  listOfficialResults: async (id) => rows.find((r) => String(r.bulletin.id) === String(id))?.results ?? [],
});

// ---------------------------------------------------------------------------
// UYGUNLUK KURALI (default-deny) — spec testleri 1–6, 8, 9, 10
// ---------------------------------------------------------------------------
test('1. backfilled:true kayıt resmî sistem karnesine girmiyor', async () => {
  const rows = [{ bulletin: mkBulletin(700), snap: mkSnap(700, [mkMatch(1, '1', '1')], {}, { backfilled: true }), results: [mkResult(1, '1')] }];
  const sc = await buildSystemScorecard({ store: stubStore(rows) });
  assert.equal(sc.total, 0, 'backfilled maç sayılmaz');
  assert.equal(sc.hasOfficialForwardData, false);
  assert.equal(sc.exclusionBreakdown[PROVENANCE.LEGACY_BACKFILL], 1);
});

test('2. legacy cache snapshot (kanıtsız) resmî karneye girmiyor — default-deny', () => {
  const rec = recordFromLegacyCache(508, { roundId: 508, savedAt: '2026-07-05T01:32:31.841Z', backfilled: true, picks: [{ no: 1, symbol: '02' }] });
  const cls = classifyRecord(rec);
  assert.equal(cls.isOfficialForward, false);
  assert.equal(cls.provenanceType, PROVENANCE.LEGACY_BACKFILL);
  // backfilled alanı OLMAYAN eski kayıt da otomatik resmî SAYILMAZ:
  const cls2 = classifyRecord(recordFromLegacyCache(1521, { roundId: 1521, savedAt: '2026-07-07T14:25:15.352Z', picks: [] }));
  assert.equal(cls2.isOfficialForward, false);
  assert.equal(cls2.provenanceType, PROVENANCE.UNKNOWN, 'kanıt yok → unknown (varsayım yapılmaz)');
});

test('3. demo snapshot resmî karneye girmiyor', async () => {
  const rows = [{ bulletin: mkBulletin(701), snap: mkSnap(701, [mkMatch(1, '1', '1')], {}, { isDemo: true }), results: [mkResult(1, '1')] }];
  const sc = await buildSystemScorecard({ store: stubStore(rows) });
  assert.equal(sc.total, 0);
  assert.equal(sc.exclusionBreakdown[PROVENANCE.DEMO], 1);
});

test('4. retrospektif backtest resmî karneye girmiyor', async () => {
  const rows = [{ bulletin: mkBulletin(702), snap: mkSnap(702, [mkMatch(1, '1', '1')], {}, { retrospective: true }), results: [mkResult(1, '1')] }];
  const sc = await buildSystemScorecard({ store: stubStore(rows) });
  assert.equal(sc.total, 0);
  assert.equal(sc.exclusionBreakdown[PROVENANCE.RETROSPECTIVE_BACKTEST], 1);
});

test('5. provenance kanıtı eksik kayıt default-deny ile hariç + exclusionReason', () => {
  const rec = recordFromArchive(mkBulletin(703), mkSnap(703, [], { payloadHash: null }));
  const { eligible, reasons } = officialForwardEligibility(rec, { requireOfficialProfile: true });
  assert.equal(eligible, false);
  assert.ok(reasons.includes('no_verification_hash'));
  const cls = classifyRecord(rec, { requireOfficialProfile: true });
  assert.equal(cls.provenanceType, PROVENANCE.UNKNOWN);
  assert.ok(cls.exclusionReason, 'hariç tutma nedeni açıkça döner');
});

test('6. late/unverified (geç kilit) ana karneye girmiyor', async () => {
  const rows = [{ bulletin: mkBulletin(704), snap: mkSnap(704, [mkMatch(1, '1', '1')], { late: true }), results: [mkResult(1, '1')] }];
  const sc = await buildSystemScorecard({ store: stubStore(rows) });
  assert.equal(sc.total, 0);
  assert.equal(sc.exclusionBreakdown[PROVENANCE.LATE_UNVERIFIED], 1);
});

test('8. geçerli verificationHash zorunlu (hash yoksa resmî sayılmaz)', () => {
  const ok = classifyRecord(recordFromArchive(mkBulletin(705), mkSnap(705, [])), { requireOfficialProfile: true });
  assert.equal(ok.isOfficialForward, true, 'tam kanıtlı kayıt resmî');
  const bad = classifyRecord(recordFromArchive(mkBulletin(705), mkSnap(705, [], { payloadHash: '' })), { requireOfficialProfile: true });
  assert.equal(bad.isOfficialForward, false);
});

test('9. kilit zamanından SONRA üretilen tahmin hariç (prediction_after_lock)', () => {
  const rec = recordFromArchive(mkBulletin(706), mkSnap(706, [], { dataObservedAt: iso(T0 + 60e3) }));
  const { eligible, reasons } = officialForwardEligibility(rec);
  assert.equal(eligible, false);
  assert.ok(reasons.includes('prediction_after_lock'));
});

test('10. ilk maçtan SONRA kilitlenen tahmin hariç (locked_after_first_match)', () => {
  const rec = recordFromArchive(mkBulletin(707), mkSnap(707, [], { lockedAt: iso(FIRST + 60e3), dataObservedAt: iso(FIRST + 30e3) }));
  const { eligible, reasons } = officialForwardEligibility(rec);
  assert.equal(eligible, false);
  assert.ok(reasons.includes('locked_after_first_match'));
});

// ---------------------------------------------------------------------------
// ANA BAŞARI SAYIMI — spec testleri 11–15
// ---------------------------------------------------------------------------
const countingRows = [{
  bulletin: mkBulletin(710),
  snap: mkSnap(710, [
    mkMatch(1, '1', '1'),    // main 1, sonuç 1 → doğru
    mkMatch(2, 'X', 'X'),    // main X, sonuç X → doğru
    mkMatch(3, '2', '2'),    // main 2, sonuç 2 → doğru
    mkMatch(4, '1', '1'),    // main 1, sonuç 2 → yanlış
    mkMatch(5, null, '1X'),  // main YOK, kapalı tercih 1X → ana başarıya GİRMEZ
    mkMatch(6, null, '102'), // main YOK, üçlü tercih → ana başarıya GİRMEZ
  ]),
  results: [mkResult(1, '1'), mkResult(2, 'X'), mkResult(3, '2'), mkResult(4, '2'), mkResult(5, '1'), mkResult(6, 'X')],
}];

test('11-13. mainPrediction 1/X/2 yalnız birebir sonuçla doğru sayılıyor', async () => {
  const sc = await buildSystemScorecard({ store: stubStore(countingRows) });
  assert.equal(sc.total, 4, 'yalnız TEKLİ main tahminli maçlar');
  assert.equal(sc.correct, 3);
  assert.equal(sc.wrong, 1);
  assert.equal(sc.byResult['1'].c, 1);
  assert.equal(sc.byResult.X.c, 1);
  assert.equal(sc.byResult['2'].c, 1);
  assert.equal(sc.errors.length, 1);
  assert.equal(sc.errors[0].no, 4);
});

test('14. 1X / X2 / 12 / 1X2 / 102 ana doğruluğa GİRMİYOR', async () => {
  const sc = await buildSystemScorecard({ store: stubStore(countingRows) });
  // 5 ve 6 numaralı maçların sonuçları tercih setinin içinde olsa da total=4 kaldı:
  assert.equal(sc.total, 4);
  assert.deepEqual(expandPick('1X2'), ['1', 'X', '2']);
  assert.deepEqual(expandPick('102'), ['1', 'X', '2']);
  assert.deepEqual(expandPick('02'), ['X', '2']);
  assert.equal(isSinglePick('1X'), false);
  assert.equal(isSinglePick('2'), true);
});

test('15. kapalı tercihler YALNIZ Kapsama Başarısında hesaplanıyor (ayrı bölüm)', async () => {
  const sc = await buildSystemScorecard({ store: stubStore(countingRows) });
  assert.equal(sc.coverage.total, 6, 'kapsama tüm mühürlü tercihileri ölçer');
  assert.equal(sc.coverage.multi.total, 2, '1X + 102');
  assert.equal(sc.coverage.multi.covered, 2, 'sonuçlar set içinde');
  assert.ok(sc.coverage.note.includes('tekli ana tahmin doğruluğu değildir'));
  assert.ok(sc.coverage.rate >= sc.accuracy, 'kapsama doğal olarak yüksek — ana başarıyla KARIŞMAZ');
});

// ---------------------------------------------------------------------------
// HAFTA DURUMU — spec testleri 16, 17
// ---------------------------------------------------------------------------
test('16. eksik tahminli hafta partial işaretleniyor (tam hafta gibi sunulmaz)', async () => {
  const sc = await buildSystemScorecard({ store: stubStore(countingRows) });
  const wk = sc.weeks.find((w) => w.roundId === 710);
  assert.equal(wk.status, 'partial', '6 maçın 4ünde main var → partial');
  assert.equal(wk.predicted, 4);
  assert.equal(wk.matchCount, 6);
});

test('17. sonucu gelmemiş hafta başarıya eklenmiyor (pending, sayılmaz)', async () => {
  const rows = [
    ...countingRows,
    { bulletin: mkBulletin(711), snap: mkSnap(711, [mkMatch(1, '1', '1')]), results: [] }, // sonuç YOK
  ];
  const sc = await buildSystemScorecard({ store: stubStore(rows) });
  assert.equal(sc.total, 4, 'sonuçsuz hafta ana sayımı DEĞİŞTİRMEZ');
  const wk = sc.weeks.find((w) => w.roundId === 711);
  assert.equal(wk.status, 'pending');
  assert.equal(sc.weeksCounted, 1, 'pending hafta weeksCounted dışında');
  assert.equal(sc.pendingWeeks, 1);
});

// ---------------------------------------------------------------------------
// RADAR + KRİTER KAPILARI — spec testleri 19, 20, 21
// ---------------------------------------------------------------------------
test('19. backfilled radar kaydı Resmî Radar Karnesine girmiyor', async () => {
  const radarMatch = (no, main) => ({
    no, matchId: String(no), league: 'Test',
    radarCenter: { master: { mainPrediction: main, classification: 'strong_candidate', favorite: { symbol: main }, methodologyVersion: 'r1', dataQuality: 80 }, radars: {} },
  });
  const rows = [
    { bulletin: mkBulletin(720), snap: mkSnap(720, [radarMatch(1, '1')]), results: [mkResult(1, '1')] },
    { bulletin: mkBulletin(721), snap: mkSnap(721, [radarMatch(1, '1')], {}, { backfilled: true }), results: [mkResult(1, '1')] },
  ];
  const rs = await buildRadarScorecard({ store: stubStore(rows) });
  assert.equal(rs.roundsCounted, 1, 'yalnız official_forward hafta');
  assert.equal(rs.excludedCount, 1);
  assert.equal(rs.exclusionBreakdown[PROVENANCE.LEGACY_BACKFILL], 1);
  assert.equal(rs.isOfficialForward, true);
});

test('20-21. backfilled kriter sinyali Kriter Karnesine girmiyor; rozet yalnız official_forward katalogdan', async () => {
  const critMatch = (no, signal) => ({
    no, matchId: String(no), league: 'Test',
    analysisCenter: { context: {}, catalogEvaluations: [{ key: 'position', available: true, signal }] },
  });
  const rows = [
    { bulletin: mkBulletin(730), snap: mkSnap(730, [critMatch(1, '1')]), results: [mkResult(1, '1')] },
    { bulletin: mkBulletin(731), snap: mkSnap(731, [critMatch(1, '2')], {}, { backfilled: true }), results: [mkResult(1, '2')] },
  ];
  const cs = await buildCriterionScorecard({ store: stubStore(rows) });
  assert.equal(cs.roundsCounted, 1);
  assert.equal(cs.excludedCount, 1);
  const pos = cs.criteria.find((c) => c.key === 'position');
  assert.equal(pos.signals, 1, 'backfilled sinyal SAYILMADI (yalnız official hafta)');
  assert.equal(cs.provenanceType, 'official_forward');
});

// ---------------------------------------------------------------------------
// BOŞ DURUM + ESKİ UÇLAR — spec testleri 24, 27, 28
// ---------------------------------------------------------------------------
test('24. resmî veri yokken %69 tarzı eski başarı DÖNMÜYOR (dürüst boş durum)', async () => {
  // Cihazdaki gerçek durumun benzeri: yalnız backfilled legacy cache kayıtları var.
  save('snapshot-508', { roundId: 508, savedAt: '2026-07-05T01:32:31.841Z', backfilled: true, picks: [{ no: 1, symbol: '02' }] });
  save('snapshot-1511', { roundId: 1511, savedAt: '2026-07-05T01:32:31.856Z', backfilled: true, picks: [{ no: 1, symbol: '1' }] });
  save('snapshot-1521', { roundId: 1521, round: '49. Hafta', savedAt: '2026-07-07T14:25:15.352Z', picks: [{ no: 1, symbol: '1' }] });
  const sc = await legacySystemScorecardResponse({ store: stubStore([]) });
  assert.equal(sc.hasData, false);
  assert.equal(sc.total, 0);
  assert.equal(sc.accuracy, 0, 'eski 83/37/%69 hesabı tamamen gitti');
  assert.ok(sc.emptyStateNote.includes('Henüz resmî ileri-test verisi yok'));
  assert.equal(sc.exclusionBreakdown[PROVENANCE.LEGACY_BACKFILL], 2);
  assert.equal(sc.exclusionBreakdown[PROVENANCE.UNKNOWN], 1, 'backfilled alanı olmayan eski kayıt da unknown → hariç');
});

test('27. teknik döküm: dahil/hariç sayıları ve nedenler doğru', async () => {
  const rows = [
    { bulletin: mkBulletin(740), snap: mkSnap(740, [mkMatch(1, '1', '1')]), results: [mkResult(1, '1')] },
    { bulletin: mkBulletin(741), snap: mkSnap(741, [], { late: true }), results: [] },
  ];
  const sc = await buildSystemScorecard({ store: stubStore(rows) });
  assert.equal(sc.includedCount, 1);
  // hariç: 1 arşiv (late) + 3 legacy cache (test 24'te yazıldı)
  assert.equal(sc.excludedCount, 4);
  const p = await buildProvenanceReport({ store: stubStore(rows) });
  assert.equal(p.officialForwardCount, 1);
  assert.equal(p.countsByType[PROVENANCE.LATE_UNVERIFIED], 1);
  assert.equal(p.countsByType[PROVENANCE.LEGACY_BACKFILL], 2);
  assert.ok(p.records.every((r) => r.isOfficialForward === (r.provenanceType === 'official_forward')));
});

test('28. eski uçların yanıtları yeni güvenli hesabı döndürüyor (geriye uyumlu şekil)', async () => {
  const sc = await legacySystemScorecardResponse({ store: stubStore(countingRows) });
  // eski istemci alanları:
  for (const k of ['hasData', 'weeksCounted', 'total', 'correct', 'wrong', 'accuracy', 'single', 'singleCorrect', 'singleAccuracy', 'byResult', 'weeks', 'errors']) {
    assert.ok(k in sc, `eski alan korunur: ${k}`);
  }
  assert.equal(sc.single, sc.total, 'ana ölçüm TEKLİ olduğundan single=total');
  assert.equal(sc.accuracy, Math.round((3 / 4) * 100));
  assert.equal(sc.hasOfficialForwardData, true);
  const cs = await legacyCriteriaScorecardResponse({ store: stubStore([]), buildCriterionScorecard });
  assert.equal(cs.hasData, false);
  assert.equal(cs.isOfficialForward, true);
  assert.ok('provenanceType' in cs && 'exclusionBreakdown' in cs);
});

// ---------------------------------------------------------------------------
// RETROSPEKTİF BÖLÜM — spec testi 26 (backend tarafı)
// ---------------------------------------------------------------------------
test('26. retrospektif bölüm ayrı, açık etiketli ve resmî başarıdan bağımsız', async () => {
  const fetchStub = async () => ({ matches: [{ no: 1, result: 'X', score: { home: 1, away: 1 } }] });
  const r = await buildRetrospectiveScorecard({ fetchBulletin: fetchStub });
  assert.equal(r.label, 'RESMÎ BAŞARIYA DAHİL DEĞİLDİR');
  assert.equal(r.isOfficialForward, false);
  assert.equal(r.weekCount, 3, 'test 24te yazılan 3 legacy kayıt');
  assert.ok(r.countsByType[PROVENANCE.LEGACY_BACKFILL] >= 2);
  // '02' tercihi X sonucunu kapsar → retrospektif kapsama sayıldı (ayrı bölümde):
  assert.ok(r.coverage.total >= 1);
  assert.ok(r.note.includes('gerçek ileri-test başarısı değildir'));
});

// ---------------------------------------------------------------------------
// GERÇEK PİPELİNE ENTEGRASYONU — spec testleri 7, 18 (uçtan uca)
// ---------------------------------------------------------------------------
test('7+18. gerçek mühürlü official_forward hafta karneye giriyor; sonuç eklemek hash değiştirmiyor', async () => {
  const store = getArchiveStore();
  const data = makeBulletinData({ roundId: 4400, round: '50. Hafta' });
  data.analysisCenter = computeAnalysisCenterForData(data, { now: T0 - 3600e3 });
  data.radarCenter = await computeRadarCenterForData(data, { store, now: T0 - 3600e3 });
  await registerBulletinFromData(data, { store, now: T0 - 3600e3 });
  const fr = await freezeBulletinFromData(data, { store, now: T0 + 60e3 }); // eşik (2 dk) altı → late değil
  assert.equal(fr.frozen, true);

  const before = await store.getSnapshot('4400');
  const hashBefore = before.payloadHash;

  // Resmî sonuçlar AYRI kayıt olarak eklenir:
  const RESULTS = { 1: '1', 2: '1', 3: 'X', 4: '2', 5: '1', 6: 'X', 7: '2', 8: '1', 9: '1', 10: 'X', 11: '1', 12: '2', 13: '1', 14: '1', 15: 'X' };
  await ingestOfficialResults('4400', makeOfficialMatches(data, RESULTS), { store });

  const after = await store.getSnapshot('4400');
  assert.equal(after.payloadHash, hashBefore, '18: sonuç eklemek mühürlü hash\'i DEĞİŞTİRMEZ');
  assert.deepEqual(after.payload.matches.map((m) => m.no), before.payload.matches.map((m) => m.no));

  const sc = await buildSystemScorecard({ store });
  assert.equal(sc.hasOfficialForwardData, true, '7: gerçek official_forward hafta dahil');
  assert.ok(sc.total > 0);
  const wk = sc.weeks.find((w) => w.roundId === 4400);
  assert.ok(wk, 'hafta listede');
  assert.equal(wk.provenanceType, PROVENANCE.OFFICIAL_FORWARD);
  assert.ok(wk.verificationHashShort, 'hash kısa gösterimi var');
});

// ---------------------------------------------------------------------------
// HTTP UÇLARI — /api/scorecards/* yapısı
// ---------------------------------------------------------------------------
test('/api/scorecards/* uçları provenance alanlarıyla yanıt veriyor', async () => {
  const app = express();
  app.use('/api/scorecards', makeScorecardsRouter({ fetchBulletin: async () => ({ matches: [] }) }));
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const sys = await (await fetch(`${base}/api/scorecards/system`)).json();
    assert.ok('hasOfficialForwardData' in sys && 'exclusionBreakdown' in sys && 'includedCount' in sys);
    assert.equal(sys.isDemo, false);
    const cov = await (await fetch(`${base}/api/scorecards/coverage`)).json();
    assert.ok(cov.note.includes('tekli ana tahmin doğruluğu değildir'));
    const radar = await (await fetch(`${base}/api/scorecards/radar`)).json();
    assert.equal(radar.isOfficialForward, true);
    // Retrospektif uç VARSAYILAN KAPALI (normal kullanıcıya legacy sızmaz):
    const retroRes = await fetch(`${base}/api/scorecards/retrospective`);
    assert.equal(retroRes.status, 404, 'ENABLE_LEGACY_RETROSPECTIVE yokken kapalı');
    const prov = await (await fetch(`${base}/api/scorecards/provenance`)).json();
    assert.ok(prov.totalRecords >= 1 && 'countsByType' in prov);
  } finally { server.close(); }
});
