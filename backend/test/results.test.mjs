// SONUÇ / DEĞERLENDİRME / ÖĞRENME SINIRI TESTLERİ
import test from 'node:test';
import assert from 'node:assert/strict';
import { freezeBulletinFromData, buildSnapshotPayload } from '../src/archive/snapshotService.js';
import {
  ingestOfficialResults, maybeCompleteAndEvaluate, getCriteriaPerformanceBefore,
  getPositionStats, expandPick, pickHits,
} from '../src/archive/resultsService.js';
import { hashPayload } from '../src/archive/hash.js';
import { tmpStore, makeBulletinData, makeOfficialMatches, FREEZE_AT_UTC, deep } from './helpers/fixtures.mjs';

const FREEZE_MS = new Date(FREEZE_AT_UTC).getTime();

// 15 maçın resmî sonucu (test senaryosu)
const RESULTS = { 1: '1', 2: '2', 3: '2', 4: '1', 5: 'X', 6: '2', 7: 'X', 8: '1', 9: '2', 10: '1', 11: '1', 12: '2', 13: '1', 14: 'X', 15: '1' };

async function frozenBulletin(store, opts = {}) {
  const data = makeBulletinData(opts);
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  return data;
}

test('resmî sonuç ayrı tabloya yazılır; yalnız geçerli 90 dk 1/X/2 kabul edilir', async () => {
  const store = tmpStore();
  const data = await frozenBulletin(store, { roundId: 5001 });
  const official = makeOfficialMatches(data, { 1: '1', 2: 'X' });
  // Geçersiz girdiler: yarım skor, geçersiz sembol, ilk yarı alanı — hepsi yok sayılır/temizlenir.
  official.push({ no: 99, sportotoMatchId: 999, result: 'H', score: { home: 1, away: 0 } });
  official[0].halfTimeScore = { home: 1, away: 0 }; // gelse bile OKUNMAZ
  const r = await ingestOfficialResults('5001', official, { store });
  assert.equal(r.resolved, 2);
  const rows = await store.listOfficialResults('5001');
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.ok(['1', 'X', '2'].includes(row.officialResult));
    assert.ok(Number.isInteger(row.fullTimeScore.home));
    assert.ok(!('halfTimeScore' in row), 'sonuç kaydında ilk yarı alanı olmamalı');
  }
});

test('sonuç eklemek snapshot hash’ini DEĞİŞTİRMEZ; ilk maç sonucu diğer 14 maçın tahminini etkilemez', async () => {
  const store = tmpStore();
  const data = await frozenBulletin(store, { roundId: 5002 });
  const before = await store.getSnapshot('5002');
  const hashBefore = before.payloadHash;
  const payloadBefore = deep(before.payload);

  // 1) Yalnız İLK maçın sonucu gelir (diğer 14 devam ediyor varsayımı).
  await ingestOfficialResults('5002', makeOfficialMatches(data, { 1: RESULTS[1] }), { store });
  const mid = await store.getSnapshot('5002');
  assert.equal(mid.payloadHash, hashBefore, 'ilk sonuç hash’i değiştirmemeli');
  assert.deepEqual(deep(mid.payload), payloadBefore, 'payload baytı baytına aynı kalmalı');
  const preds = (p) => p.matches.map((m) => m.systemPrediction?.symbol ?? null);
  assert.deepEqual(preds(mid.payload), preds(payloadBefore), 'diğer 14 maçın kilitli tahmini değişmemeli');

  // 2) Tüm sonuçlar + değerlendirme sonrası da hash aynı.
  await ingestOfficialResults('5002', makeOfficialMatches(data, RESULTS), { store });
  const done = await maybeCompleteAndEvaluate('5002', { store, now: FREEZE_MS + 6 * 3600e3 });
  assert.equal(done.completed, true);
  const after = await store.getSnapshot('5002');
  assert.equal(after.payloadHash, hashBefore, 'sonuçlar+değerlendirme hash’i değiştirmemeli');
  assert.equal(hashPayload(after.payload), hashBefore, 'payload yeniden hesaplandığında da aynı');
});

test('resmî sonuç düzeltmesi: orijinal kayıt tarihçeyle güncellenir, snapshot’a dokunulmaz, audit’e yazılır', async () => {
  const store = tmpStore();
  const data = await frozenBulletin(store, { roundId: 5003 });
  const hash = (await store.getSnapshot('5003')).payloadHash;
  await ingestOfficialResults('5003', makeOfficialMatches(data, { 1: '1' }), { store });
  await ingestOfficialResults('5003', makeOfficialMatches(data, { 1: 'X' }), { store }); // düzeltme
  const row = (await store.listOfficialResults('5003'))[0];
  assert.equal(row.officialResult, 'X');
  assert.equal(row.correctionVersion, 2);
  assert.equal(row.corrections.length, 1);
  assert.equal(row.corrections[0].from.officialResult, '1');
  const audit = await store.listAudit('5003');
  assert.ok(audit.some((a) => a.action === 'result_correction'));
  assert.equal((await store.getSnapshot('5003')).payloadHash, hash);
});

test('bülten tamamlanınca dürüst değerlendirme: doğru sayısı, banko ve sürpriz sonuçları', async () => {
  const store = tmpStore();
  const data = await frozenBulletin(store, { roundId: 5004 });
  await ingestOfficialResults('5004', makeOfficialMatches(data, RESULTS), { store });
  const r = await maybeCompleteAndEvaluate('5004', { store, now: FREEZE_MS + 6 * 3600e3 });
  assert.equal(r.completed, true);
  const ev = await store.getEvaluation('5004');
  assert.ok(ev);
  assert.equal(ev.effectiveFromRoundId, 5005, 'öğrenme sınırı: sonraki round');
  assert.equal(ev.snapshotHash, (await store.getSnapshot('5004')).payloadHash);

  // Beklenen doğruluk elle hesap: tahminler fixtures'ta deterministik.
  // no%5==0 → '10' (1X), no%3==0 → '2', diğer → '1'; no=7 tahminsiz ('-').
  let expCorrect = 0, expPredicted = 0;
  for (let no = 1; no <= 15; no++) {
    if (no === 7) continue; // veri yok → tahmin yok → sayılmaz
    const sym = no % 5 === 0 ? '10' : no % 3 === 0 ? '2' : '1';
    expPredicted += 1;
    if (pickHits(sym, RESULTS[no])) expCorrect += 1;
  }
  assert.equal(ev.summary.predicted, expPredicted);
  assert.equal(ev.summary.correct, expCorrect);
  assert.equal(ev.summary.totalMatches, 15);

  // Banko: yalnız 1 maç BANKO etiketliydi (no=1, favori '1', sonuç '1' → tuttu).
  assert.equal(ev.summary.banko.total, 1);
  assert.equal(ev.summary.banko.hit, 1);
  // Sürpriz: no=2 SÜRPRİZE AÇIK, favori '1', sonuç '2' → sürpriz yakalandı.
  assert.equal(ev.summary.surprise.total, 1);
  assert.equal(ev.summary.surprise.hit, 1);

  const b = await store.getBulletin('5004');
  assert.equal(b.status, 'completed');
  assert.ok(b.completedAt);

  // Tahminsiz maç değerlendirmede null correct ile durur (yanlış sayılmaz — dürüstlük).
  const m7 = ev.matches.find((m) => m.no === 7);
  assert.equal(m7.correct, null);
  assert.equal(m7.frozenPrediction, '-');
});

test('ÖĞRENME SINIRI: bir bültenin başarısı aynı bültene sızmaz, yalnız SONRAKİ bültenlerde görünür', async () => {
  const store = tmpStore();
  const data = await frozenBulletin(store, { roundId: 6001 });
  await ingestOfficialResults('6001', makeOfficialMatches(data, RESULTS), { store });
  await maybeCompleteAndEvaluate('6001', { store });

  // Aynı round için (6001): kendi değerlendirmesi KULLANILAMAZ.
  const same = await getCriteriaPerformanceBefore(6001, { store });
  assert.equal(same.sampleRounds, 0);
  assert.equal(same.criteria, null);

  // Daha eski bir round için de görünmez (geçmişe sızma yok).
  const older = await getCriteriaPerformanceBefore(5999, { store });
  assert.equal(older.sampleRounds, 0);

  // Sonraki round (6002) için: artık kullanılabilir.
  const next = await getCriteriaPerformanceBefore(6002, { store });
  assert.equal(next.sampleRounds, 1);
  assert.ok(next.criteria && Object.keys(next.criteria).length > 0);

  // Ve SONRAKİ bültenin snapshot'ı bu geçmişi 'kilit anında bilinen' olarak mühürler…
  const nextData = makeBulletinData({ roundId: 6002, firstKickoff: '2026-08-01T20:00:00+03:00' });
  const nextPayload = await buildSnapshotPayload(nextData, { store, now: new Date('2026-08-01T16:55:00Z').getTime(), frozenAt: '2026-08-01T16:55:00.000Z' });
  const withPast = nextPayload.matches.find((m) => m.criteria.pastPerformance);
  assert.ok(withPast, 'sonraki bülten kriter geçmişini görmeli');
  // …aynı bültenin (6001) kendi snapshot'ında ise geçmiş yoktu (null).
  const ownSnap = await store.getSnapshot('6001');
  for (const m of ownSnap.payload.matches) {
    assert.equal(m.criteria.pastPerformance, null, 'kendi sonucu kendi snapshot’ına sızamaz');
  }
});

test('geçmiş bülten verisi güncel veriden yeniden hesaplanmaz: snapshot okuma bire bir mühürlü halidir', async () => {
  const store = tmpStore();
  const data = await frozenBulletin(store, { roundId: 6100 });
  const sealed = deep((await store.getSnapshot('6100')).payload);

  // "Güncel takım verisi değişti" simülasyonu: kaynak veride form/oran değişir…
  const mutated = deep(data);
  mutated.matches.forEach((m) => {
    if (m.stats) m.stats.home.standing.points = 99;
    if (m.preOdds) m.preOdds.home = 1.01;
  });
  // …ama arşivden dönen payload değişmez (yeniden hesap YOK, okuma mühürlü kayıttan).
  const rerad = (await store.getSnapshot('6100')).payload;
  assert.deepEqual(deep(rerad), sealed);
});

test('bülten sıra istatistikleri (1–15) doğru hesaplanır; az örneklem uyarısı verilir', async () => {
  const store = tmpStore();
  // İki tamamlanmış bülten
  const d1 = await frozenBulletin(store, { roundId: 7001 });
  await ingestOfficialResults('7001', makeOfficialMatches(d1, RESULTS), { store });
  await maybeCompleteAndEvaluate('7001', { store });
  const d2 = makeBulletinData({ roundId: 7002, firstKickoff: '2026-08-01T20:00:00+03:00' });
  await freezeBulletinFromData(d2, { store, now: new Date('2026-08-01T16:55:00Z').getTime() });
  const RES2 = { ...RESULTS, 1: 'X', 2: '1' };
  await ingestOfficialResults('7002', makeOfficialMatches(d2, RES2), { store });
  await maybeCompleteAndEvaluate('7002', { store });
  // Tamamlanmamış bülten SAYILMAZ:
  const d3 = makeBulletinData({ roundId: 7003, firstKickoff: '2026-08-08T20:00:00+03:00' });
  await freezeBulletinFromData(d3, { store, now: new Date('2026-08-08T16:55:00Z').getTime() });
  await ingestOfficialResults('7003', makeOfficialMatches(d3, { 1: '1' }), { store });

  const stats = await getPositionStats({}, { store });
  assert.equal(stats.sampleBulletins, 2);
  const p1 = stats.positions.find((p) => p.position === 1);
  assert.equal(p1.sample, 2);
  assert.deepEqual(p1.counts, { '1': 1, X: 1, '2': 0 });
  assert.equal(p1.pct['1'], 50);
  assert.equal(p1.lowSample, true, '2 örnek < 30 → düşük örneklem uyarısı');
  assert.ok(stats.note && stats.note.includes('örneklem'), 'az örnek notu olmalı');
  assert.ok(stats.usage.includes('tek başına'), 'tek gerekçe olamaz notu olmalı');

  // position filtresi
  const only3 = await getPositionStats({ position: 3 }, { store });
  assert.equal(only3.positions.length, 1);
  assert.equal(only3.positions[0].position, 3);
  assert.deepEqual(only3.positions[0].counts, { '1': 0, X: 0, '2': 2 });

  // round aralığı filtresi
  const ranged = await getPositionStats({ fromRound: 7002, toRound: 7002 }, { store });
  assert.equal(ranged.sampleBulletins, 1);
});

test('expandPick/pickHits: çifte ve üçlü semboller doğru açılır', () => {
  assert.deepEqual(expandPick('10'), ['1', 'X']);
  assert.deepEqual(expandPick('102'), ['1', 'X', '2']);
  assert.deepEqual(expandPick('0'), ['X']);
  assert.deepEqual(expandPick('-'), []);
  assert.equal(pickHits('10', 'X'), true);
  assert.equal(pickHits('10', '2'), false);
  assert.equal(pickHits('-', '1'), null);
});
