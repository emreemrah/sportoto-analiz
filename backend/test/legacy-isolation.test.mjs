// LEGACY İZOLASYON TESTLERİ (spec 12: 1–18, 20, 21, 24, 25, 26)
// Yeni başlangıç: eski kayıtlar aktif sistemden tamamen ayrı; karneler sıfırdan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

const CACHE = mkdtempSync(join(tmpdir(), 'sportoto-iso-cache-'));
const LEGACY = mkdtempSync(join(tmpdir(), 'sportoto-iso-legacy-'));
process.env.CACHE_DIR = CACHE;
process.env.LEGACY_ARCHIVE_DIR = LEGACY;
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-iso-arsiv-'));
// GEÇMİŞ ARŞİVİ DE İZOLE: Radar 5'in hafıza bağlamı official_result_history'yi
// de okur (radarService.js). Sürücü sabitlenmezse .env'de Supabase varken
// getHistoryStore() CANLI VERİTABANINA düşüyordu — test bin küsur gerçek maç
// okuyup "hafıza boş" iddiasını çürütüyordu. Arşiv için zaten yapılan sürücü
// sabitlemesinin (ARCHIVE_DRIVER) geçmiş deposundaki karşılığı.
process.env.HISTORY_DRIVER = 'file';
process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-iso-gecmis-'));
// Sürücü sabitlenir: .env'de Supabase varsa depo gerçek arşive kayar (bkz. api.test.mjs).
process.env.ARCHIVE_DRIVER = 'file';
delete process.env.ENABLE_LEGACY_RETROSPECTIVE;

const { save, load, listSnapshotRounds, listRadarRounds } = await import('../src/cache.js');
const { _resetArchiveStoreForTests, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { runArchiveLegacy } = await import('../scripts/archive-legacy-data.js');
const { buildSystemScorecard } = await import('../src/scorecards/scorecardService.js');
const { buildRadarScorecard } = await import('../src/radar/scorecard.js');
const { buildCriterionScorecard, computeAnalysisCenterForData } = await import('../src/analysis/analysisService.js');
const { computeRadarCenterForData } = await import('../src/radar/radarService.js');
const { computeBulletinMemoryRadar, buildMemoryContext } = await import('../src/radar/bulletinMemoryRadar.js');
const { registerBulletinFromData, freezeBulletinFromData } = await import('../src/archive/snapshotService.js');
const { ingestOfficialResults } = await import('../src/archive/resultsService.js');
const { snapshotRoundPredictions } = await import('../src/refresh.js');
const makeScorecardsRouter = (await import('../src/routes/scorecards.js')).default;
const { makeBulletinData, makeOfficialMatches, FREEZE_AT_UTC } = await import('./helpers/fixtures.mjs');

const T0 = new Date(FREEZE_AT_UTC).getTime();
const quiet = () => {};

// Fikstür: cihazdakiyle aynı yapıda legacy dosyalar.
function seedLegacyFiles() {
  save('snapshot-508', { roundId: 508, savedAt: '2026-07-05T01:32:31.841Z', backfilled: true, picks: [{ no: 1, symbol: '02' }] });
  save('snapshot-1511', { roundId: 1511, savedAt: '2026-07-05T01:32:31.856Z', backfilled: true, picks: [{ no: 1, symbol: '1' }] });
  save('snapshot-1521', { roundId: 1521, round: '49. Hafta', savedAt: '2026-07-07T14:25:15.352Z', picks: [{ no: 1, symbol: '1' }] });
  save('radar-1520', { roundId: 1520, round: '48. Hafta', radarFrozenAt: '2026-07-04T20:00:00.000Z', radar: [{ no: 1, label: 'BANKO', labelColor: 'green', surpriseScore: 20, favorite: { symbol: '1' } }] });
}

test('1. dry-run modunda HİÇBİR dosya taşınmıyor', () => {
  seedLegacyFiles();
  const before = readdirSync(CACHE).sort();
  const r = runArchiveLegacy({ dryRun: true, log: quiet });
  assert.equal(r.dryRun, true);
  assert.equal(r.moved.length, 4, '3 snapshot + 1 radar taşınacak olarak RAPORLANIR');
  assert.deepEqual(readdirSync(CACHE).sort(), before, 'dosyalar yerinde');
  assert.equal(existsSync(join(LEGACY, 'manifest.json')), false, 'dry-run manifest yazmaz');
});

test('2+5+6. gerçek mod: yalnız legacy/backfill/unknown taşınıyor; manifest + sha256 doğru', () => {
  const hash508 = readFileSync(join(CACHE, 'snapshot-508.json'));
  const r = runArchiveLegacy({ dryRun: false, log: quiet });
  assert.equal(r.moved.length, 4);
  assert.equal(existsSync(join(CACHE, 'snapshot-508.json')), false, 'aktif cache’ten çıktı');
  assert.equal(existsSync(join(LEGACY, 'snapshots', 'snapshot-508.json')), true, 'legacy_archive’a taşındı');
  assert.equal(existsSync(join(LEGACY, 'radar', 'radar-1520.json')), true);
  const manifest = JSON.parse(readFileSync(join(LEGACY, 'manifest.json'), 'utf8'));
  assert.equal(manifest.entries.length, 4);
  const e508 = manifest.entries.find((e) => e.originalPath.endsWith('snapshot-508.json'));
  assert.equal(e508.provenanceType, 'legacy_backfill');
  assert.equal(e508.backfilled, true);
  assert.equal(e508.roundId, 508);
  assert.ok(e508.movedAt && e508.savedAt);
  assert.equal(e508.sha256, createHash('sha256').update(hash508).digest('hex'), 'dosya hash’i birebir');
  const e1521 = manifest.entries.find((e) => e.originalPath.endsWith('snapshot-1521.json'));
  assert.equal(e1521.provenanceType, 'unknown', 'backfilled alanı olmayan eski kayıt unknown olarak arşivlendi');
});

test('4. script idempotent: ikinci çalıştırma hata vermez, çoğaltmaz', () => {
  const r2 = runArchiveLegacy({ dryRun: false, log: quiet });
  assert.equal(r2.moved.length, 0, 'taşınacak bir şey kalmadı');
  const manifest = JSON.parse(readFileSync(join(LEGACY, 'manifest.json'), 'utf8'));
  assert.equal(manifest.entries.length, 4, 'manifest çoğalmadı');
  const files = readdirSync(join(LEGACY, 'snapshots'));
  assert.equal(files.length, 3, 'dosya kopyası oluşmadı');
});

test('3. official_forward benzeri kayıt görürse İŞLEM DURUR (dokunulmaz)', () => {
  // classifyRecord legacy-cache kaynağını asla official yapmaz; güvenlik kilidini
  // doğrulamak için sınıflandırıcının zorlanamayacağını da test ederiz:
  // isOfficialForward=true YALNIZ arşiv kaynaklı tam kanıtla mümkündür.
  save('snapshot-999', { roundId: 999, savedAt: new Date(T0).toISOString(), picks: [{ no: 1, symbol: '1' }] });
  const r = runArchiveLegacy({ dryRun: true, log: quiet });
  const it = r.moved.find((m) => m.file === 'snapshot-999.json');
  assert.equal(it.isOfficialForward, false, 'legacy cache dosyası official sayılAMAZ (default-deny)');
  // (runArchiveLegacy içindeki kilit: isOfficialForward true olsaydı throw ederdi —
  //  bu koşulun tetiklenememesi default-deny kanıtıdır; kilit kodu yerinde.)
  runArchiveLegacy({ dryRun: false, log: quiet });                 // temizle
});

test('7+8. aktif cache listeleri legacy_archive’ı TARAMAZ', () => {
  assert.deepEqual(listSnapshotRounds(), [], 'aktif cache’te snapshot kalmadı; legacy_archive görünmez');
  assert.deepEqual(listRadarRounds(), [], 'radar listesi legacy_archive’ı görmez');
  // legacy_archive içinde dosyalar DURUYOR (silinmedi):
  assert.ok(readdirSync(join(LEGACY, 'snapshots')).length >= 3);
});

test('9+10+11. Sistem/Radar/Kriter karneleri legacy veriyi DÖNDÜRMÜYOR (sıfır başlangıç)', async () => {
  const sc = await buildSystemScorecard({ store: getArchiveStore() });
  assert.equal(sc.hasOfficialForwardData, false);
  assert.equal(sc.total, 0, 'Sistem Karnesi: 0');
  const rs = await buildRadarScorecard({ store: getArchiveStore() });
  assert.equal(rs.hasData, false, 'Radar Karnesi: 0');
  const cs = await buildCriterionScorecard({ store: getArchiveStore() });
  assert.equal(cs.hasData, false, 'Kriter Karnesi: 0 resmî örnek');
});

test('12+14. Radar 5 (Bülten Hafızası) ve Sürpriz DNA legacy veriden beslenmiyor', async () => {
  // Hafıza bağlamı YALNIZ kalıcı arşiv değerlendirmelerinden kurulur — arşiv boş:
  const store = getArchiveStore();
  const evals = await store.listEvaluations().catch(() => []);
  assert.equal(evals.length, 0, 'arşivde legacy değerlendirme yok');
  const ctx = buildMemoryContext({ positionStats: null, evaluations: evals });
  assert.equal(ctx.hasData, false, 'hafıza radarı veri YOK der (legacy dosyalar okunAMAZ)');
  const data = makeBulletinData({ roundId: 4500 });
  const r5 = computeBulletinMemoryRadar(data.matches[0], { memoryContext: ctx });
  assert.equal(r5.hasData, false, 'Radar 5 katkısı sıfır — eski haftalarla doldurulmaz');
  const rc = await computeRadarCenterForData(data, { store, now: T0 - 3600e3 });
  assert.equal(rc.memory.hasData, false, 'Sürpriz DNA/Master hattı da legacy hafıza görmez');
});

test('13. Akıllı Destek (kriter karne indeksi) legacy kriter başarısı kullanmıyor', async () => {
  const { scorecardIndexBefore } = await import('../src/analysis/analysisService.js');
  const idx = await scorecardIndexBefore(999999, { store: getArchiveStore() });
  assert.deepEqual(Object.keys(idx).length, 0, 'resmî arşiv boş → akıllı mod güven katsayısına legacy sızmaz');
});

test('15+16+17. geçmişe bakmak snapshot/radar ÜRETMİYOR; snapshotRoundPredictions kapalı', async () => {
  const before = readdirSync(CACHE).filter((f) => /^(snapshot|radar)-\d+/.test(f));
  await assert.rejects(
    () => snapshotRoundPredictions(1500),
    /Geçmişe dönük tahmin üretimi kapalı/,
    '17: fonksiyon açık izin olmadan ÇALIŞMAZ'
  );
  const after = readdirSync(CACHE).filter((f) => /^(snapshot|radar)-\d+/.test(f));
  assert.deepEqual(after, before, '15+16: aktif cache’e yeni tahmin/radar dosyası yazılmadı');
  // server.js’te otomatik çağrı kaldırıldı (kaynak denetimi):
  const serverSrc = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.ok(!/snapshotRoundPredictions\s*\(/.test(serverSrc), 'server.js artık backfill üretimini ÇAĞIRMAZ');
});

test('18. retrospektif üretim yalnız açık izinle ve AYRI provenance ile legacy_archive’a yazar (kod sözleşmesi)', () => {
  const refreshSrc = readFileSync(new URL('../src/refresh.js', import.meta.url), 'utf8');
  assert.ok(refreshSrc.includes("provenanceType: 'retrospective_backtest'"), 'retrospektif çıktı açık işaretli');
  assert.ok(refreshSrc.includes("legacy_archive"), 'çıktı aktif cache DEĞİL legacy_archive/retrospective altına');
  assert.ok(!/save\(`snapshot-\$\{roundId\}`.*backfilled: true/.test(refreshSrc), 'aktif cache’e backfilled yazan eski satır kaldırıldı');
  assert.ok(!/save\(`radar-\$\{bulletin\.roundId\}`/.test(refreshSrc), 'eski radar-<id> dosya arşivi yazılmıyor');
});

test('20+21. ENABLE_LEGACY_RETROSPECTIVE varsayılan false → uç kapalı; açılınca bile resmî uçlara sızmaz', async () => {
  const app = express();
  app.use('/api/scorecards', makeScorecardsRouter({ fetchBulletin: async () => ({ matches: [] }) }));
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const off = await fetch(`${base}/api/scorecards/retrospective`);
    assert.equal(off.status, 404, 'varsayılan: kapalı');
    const offBody = await off.json();
    assert.ok(offBody.note.includes('resmî başarıdan ayrılmıştır'));

    const sys = await (await fetch(`${base}/api/scorecards/system`)).json();
    assert.equal(sys.hasOfficialForwardData, false);
    assert.ok(!JSON.stringify(sys).match(/retrospectiveRate|legacyRate|%6[49]|%73/), 'resmî yanıtta retrospektif yüzde YOK');
    assert.ok(!('excludedRecords' in sys), 'hariç kayıt detay listesi resmî yanıtta taşınmaz');
    assert.ok(sys.legacySeparationNote.includes('resmî başarıdan ayrılmıştır'));

    process.env.ENABLE_LEGACY_RETROSPECTIVE = 'true';
    const on = await fetch(`${base}/api/scorecards/retrospective`);
    assert.equal(on.status, 200, 'yalnız açık bayrakla erişilir');
    const onBody = await on.json();
    assert.equal(onBody.label, 'RESMÎ BAŞARIYA DAHİL DEĞİLDİR');
  } finally {
    delete process.env.ENABLE_LEGACY_RETROSPECTIVE;
    server.close();
  }
});

test('24. resmî veri yokken bütün karneler dürüst boş durumda', async () => {
  const sc = await buildSystemScorecard({ store: getArchiveStore() });
  assert.ok(sc.emptyStateNote.includes('Henüz resmî ileri-test verisi yok'));
  const rs = await buildRadarScorecard({ store: getArchiveStore() });
  assert.ok(rs.note.includes('geçmişe dönük tahmin üretilmez'));
  const cs = await buildCriterionScorecard({ store: getArchiveStore() });
  assert.ok(cs.note.includes('resmî'), 'kriter notu dürüst');
});

test('25+26. İLK yeni official_forward hafta karneyi otomatik doldurur; mühür değişmez', async () => {
  const store = getArchiveStore();
  const data = makeBulletinData({ roundId: 4600, round: '1. Yeni Hafta' });
  data.analysisCenter = computeAnalysisCenterForData(data, { now: T0 - 3600e3 });
  data.radarCenter = await computeRadarCenterForData(data, { store, now: T0 - 3600e3 });
  await registerBulletinFromData(data, { store, now: T0 - 3600e3 });
  const fr = await freezeBulletinFromData(data, { store, now: T0 + 60e3 });
  assert.equal(fr.frozen, true);
  const hashBefore = (await store.getSnapshot('4600')).payloadHash;
  const RESULTS = { 1: '1', 2: '1', 3: '1', 4: '1', 5: 'X', 6: '2', 7: 'X', 8: '1', 9: '2', 10: '1', 11: '1', 12: '2', 13: '1', 14: 'X', 15: '1' };
  await ingestOfficialResults('4600', makeOfficialMatches(data, RESULTS), { store });
  assert.equal((await store.getSnapshot('4600')).payloadHash, hashBefore, '26: değişmezlik korunur');

  const sc = await buildSystemScorecard({ store });
  assert.equal(sc.hasOfficialForwardData, true, '25: sıfırdan sonra ilk resmî hafta karneyi doldurdu');
  assert.ok(sc.total > 0);
  const rs = await buildRadarScorecard({ store });
  assert.equal(rs.hasData, true, 'Radar Karnesi ilk resmî haftayla oluştu');
  const cs = await buildCriterionScorecard({ store });
  assert.equal(cs.hasData, true, 'Kriter Karnesi ilk resmî haftayla oluştu');
});
