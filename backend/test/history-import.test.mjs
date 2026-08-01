// RESMÎ GEÇMİŞ BÜLTEN HAFIZASI TESTLERİ (görev A)
// Kaynak: sportoto.gov.tr'nin kendi açık webapi'si (fixture ile taklit edilir —
// gerçek kaynak testi cihaz ortamında scheduler kanıtıyla yapılır, burada DEĞİL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-hist-'));
process.env.HISTORY_DRIVER = 'file';

const { normalizeResultSymbol, validateScoreResult, buildHistoryMatches, importOfficialHistoryTick } =
  await import('../src/history/importer.js');
const { getHistoryStore, _resetHistoryStoreForTests, FileHistoryStore, HISTORY_PROVENANCE } =
  await import('../src/history/historyStore.js');

const mkStore = () => new FileHistoryStore(mkdtempSync(join(tmpdir(), 'sportoto-hist-s-')));

// Fixture: resmî webapi biçiminde sahte kaynak (sources/sportoto çıktı sözleşmesi).
function makeApi({ years = ['2023-2024'], roundsByYear = {}, bulletins = {}, failRounds = [] } = {}) {
  return {
    calls: { years: 0, rounds: 0, bulletins: [] },
    async getYears() { this.calls.years += 1; return years; },
    async getRounds(y) { this.calls.rounds += 1; return roundsByYear[y] || []; },
    async getBulletinByRoundId(id) {
      this.calls.bulletins.push(id);
      if (failRounds.includes(id)) throw new Error('kaynak geçici hata');
      const b = bulletins[id];
      if (!b) throw new Error('bulunamadı');
      return b;
    },
  };
}

const mkMatch = (no, sh, sa, result, date = '2024-01-10T15:00:00Z') => ({
  no, home: { name: `Ev${no}` }, away: { name: `Dep${no}` },
  date, score: { home: sh, away: sa }, result,
});
const mkBulletin = (roundId, matches) => ({ roundId, matches });
const fullRound = (rid, resultFn = (i) => (i % 3 === 0 ? 'X' : i % 3 === 1 ? '1' : '2')) =>
  mkBulletin(rid, Array.from({ length: 15 }, (_, i) => {
    const r = resultFn(i + 1);
    const [sh, sa] = r === '1' ? [2, 0] : r === '2' ? [0, 1] : [1, 1];
    return mkMatch(i + 1, sh, sa, r);
  }));

test('1. Sonuç normalizasyonu: 0→X, 1→1, 2→2, çöp→null', () => {
  assert.equal(normalizeResultSymbol('0'), 'X');
  assert.equal(normalizeResultSymbol('X'), 'X');
  assert.equal(normalizeResultSymbol('x'), 'X');
  assert.equal(normalizeResultSymbol('1'), '1');
  assert.equal(normalizeResultSymbol('2'), '2');
  assert.equal(normalizeResultSymbol(''), null);
  assert.equal(normalizeResultSymbol('3'), null);
  assert.equal(normalizeResultSymbol(null), null);
});

test('2. Skor↔sonuç çapraz doğrulama: türetme + uyuşmazlık işaretleri', () => {
  assert.deepEqual(validateScoreResult(2, 0, '1'), { valid: true, derived: '1', conflict: null });
  assert.deepEqual(validateScoreResult(1, 1, '0'), { valid: true, derived: 'X', conflict: null });
  assert.deepEqual(validateScoreResult(0, 3, '2'), { valid: true, derived: '2', conflict: null });
  // Skor 2-0 ama kaynak 'X' diyor → result_conflict (analiz dışı)
  assert.equal(validateScoreResult(2, 0, 'X').conflict, 'result_conflict');
  assert.equal(validateScoreResult(2, 0, 'X').valid, false);
  assert.equal(validateScoreResult(null, 0, '1').conflict, 'missing_score');
  assert.equal(validateScoreResult(2, 0, null).conflict, 'missing_result');
});

test('3. buildHistoryMatches: çelişkili satır result=null + conflict; İLK YARI alanı yok', () => {
  const b = mkBulletin(500, [
    mkMatch(1, 2, 1, '1'),
    { ...mkMatch(2, 0, 0, '1'), halfTimeScore: { home: 0, away: 0 } }, // kaynak yanlış + ilk yarı sızıntı denemesi
  ]);
  const rows = buildHistoryMatches(b, { now: '2026-01-01T00:00:00.000Z' });
  assert.equal(rows[0].result, '1');
  assert.equal(rows[0].resultValid, true);
  assert.equal(rows[1].result, null, 'çelişkili sonuç veriye GİRMEZ');
  assert.equal(rows[1].conflict, 'result_conflict');
  // İlk yarı hiçbir alana taşınmaz (yapısal güvence):
  for (const r of rows) {
    const s = JSON.stringify(r).toLowerCase();
    assert.ok(!s.includes('halftime') && !s.includes('half_time'), 'ilk yarı verisi arşive sızamaz');
  }
  assert.equal(rows[0].provenanceType, 'official_result_history');
});

test('4. İçe aktarım: tamamlanmış hafta arşive girer (round + 15 maç + provenance)', async () => {
  const store = mkStore();
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1400, name: '1400. Hafta', isPublished: true, closeDate: '2024-01-12T00:00:00Z' }] },
    bulletins: { 1400: fullRound(1400) },
  });
  const res = await importOfficialHistoryTick({ store, api, pauseMs: 0, log: () => {} });
  assert.equal(res.ok, true);
  assert.equal(res.imported, 1);
  const round = await store.getRound('1400');
  assert.equal(round.status, 'completed');
  assert.equal(round.provenanceType, HISTORY_PROVENANCE);
  assert.equal(round.sourceType, 'sportoto-webapi');
  assert.ok(round.sourceUrl.includes('sportoto.gov.tr'));
  const ms = await store.getMatches('1400');
  assert.equal(ms.length, 15);
  assert.ok(ms.every((m) => m.resultValid && ['1', 'X', '2'].includes(m.result)));
});

test('5. Idempotentlik: ikinci çalıştırma AYNI haftayı tekrar almaz', async () => {
  const store = mkStore();
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1400, isPublished: true }] },
    bulletins: { 1400: fullRound(1400) },
  });
  await importOfficialHistoryTick({ store, api, pauseMs: 0, log: () => {} });
  const res2 = await importOfficialHistoryTick({ store, api, pauseMs: 0, log: () => {} });
  assert.equal(res2.imported, 0, 'işlenmiş hafta checkpoint sayesinde atlanır');
  assert.equal(res2.processed, 0);
});

test('6. Güncel hafta ASLA geçmiş arşivine alınmaz', async () => {
  const store = mkStore();
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1525, isPublished: true }, { id: 1400, isPublished: true }] },
    bulletins: { 1525: fullRound(1525), 1400: fullRound(1400) },
  });
  await importOfficialHistoryTick({ store, api, pauseMs: 0, currentRoundId: 1525, log: () => {} });
  assert.equal(await store.getRound('1525'), null, 'güncel hafta arşivde OLMAMALI');
  assert.notEqual(await store.getRound('1400'), null);
});

test('7. Kaynak düzeltmesi: correctionVersion artar + audit izi (eski değer sessizce ezilmez)', async () => {
  const store = mkStore();
  const b1 = fullRound(1400);
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1400, isPublished: true }] },
    bulletins: { 1400: b1 },
  });
  await importOfficialHistoryTick({ store, api, pauseMs: 0, log: () => {} });
  // Kaynak 3. maçın skorunu düzeltir (1-1 'X' → 2-0 '1')
  const b2 = JSON.parse(JSON.stringify(b1));
  b2.matches[2] = mkMatch(3, 2, 0, '1');
  const api2 = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1400, isPublished: true }] },
    bulletins: { 1400: b2 },
  });
  // Checkpoint'te işli olsa da düzeltme algılansın diye done listesinden çıkar:
  const cp = await store.getCheckpoint();
  await store.setCheckpoint({ ...cp, doneRounds: [] });
  const res = await importOfficialHistoryTick({ store, api: api2, pauseMs: 0, log: () => {} });
  assert.equal(res.correctionsFound, 1);
  const ms = await store.getMatches('1400');
  const m3 = ms.find((m) => m.position === 3);
  assert.equal(m3.result, '1');
  assert.equal(m3.correctionVersion, 2, 'düzeltme sürümü artar');
  const audit = await store.listAudit();
  const corr = audit.filter((a) => a.action === 'correction');
  assert.equal(corr.length, 1);
  assert.ok(corr[0].oldValue.includes('"X"'), 'eski değer audit\'te saklı');
});

test('8. result_conflict satırı: analiz dışı + audit kaydı', async () => {
  const store = mkStore();
  const b = fullRound(1401);
  b.matches[4] = mkMatch(5, 3, 0, 'X'); // skor 3-0 ama kaynak X — uyuşmazlık
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1401, isPublished: true }] },
    bulletins: { 1401: b },
  });
  const res = await importOfficialHistoryTick({ store, api, pauseMs: 0, log: () => {} });
  assert.equal(res.conflicts, 1);
  const all = await store.listAllMatches();
  const conflicted = all.find((m) => String(m.roundId) === '1401' && m.position === 5);
  assert.equal(conflicted.resultValid, false, 'çelişkili satır DNA/analize giremez');
  assert.equal(conflicted.result, null);
  const audit = await store.listAudit();
  assert.ok(audit.some((a) => a.action === 'result_conflict' && a.position === 5));
});

test('9. Sayfalı + checkpoint devam: her turda en çok maxRoundsPerRun hafta', async () => {
  const store = mkStore();
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1400, isPublished: true }, { id: 1401, isPublished: true }, { id: 1402, isPublished: true }] },
    bulletins: { 1400: fullRound(1400), 1401: fullRound(1401), 1402: fullRound(1402) },
  });
  const r1 = await importOfficialHistoryTick({ store, api, pauseMs: 0, maxRoundsPerRun: 1, log: () => {} });
  assert.equal(r1.imported, 1);
  assert.equal((await store.listRounds()).length, 1);
  const r2 = await importOfficialHistoryTick({ store, api, pauseMs: 0, maxRoundsPerRun: 1, log: () => {} });
  assert.equal(r2.imported, 1, 'checkpoint kaldığı yerden devam eder');
  const r3 = await importOfficialHistoryTick({ store, api, pauseMs: 0, maxRoundsPerRun: 5, log: () => {} });
  assert.equal(r3.imported, 1, 'kalan tek hafta alınır');
  assert.equal((await store.listRounds()).length, 3);
});

test('10. Tek haftanın kaynak hatası turu ÖLDÜRMEZ; hata alan hafta sonra tekrar denenir', async () => {
  const store = mkStore();
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1400, isPublished: true }, { id: 1401, isPublished: true }] },
    bulletins: { 1400: fullRound(1400), 1401: fullRound(1401) },
    failRounds: [1400],
  });
  const r1 = await importOfficialHistoryTick({ store, api, pauseMs: 0, log: () => {} });
  assert.equal(r1.ok, true, 'tur hatasız biter (izolasyon)');
  assert.equal(r1.imported, 1, 'sağlam hafta yine de alınır');
  assert.equal(await store.getRound('1400'), null);
  // Kaynak düzeldi → aynı hafta sonraki turda gelir (checkpoint\'e yazılmamıştı)
  const api2 = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1400, isPublished: true }, { id: 1401, isPublished: true }] },
    bulletins: { 1400: fullRound(1400), 1401: fullRound(1401) },
  });
  const r2 = await importOfficialHistoryTick({ store, api: api2, pauseMs: 0, log: () => {} });
  assert.equal(r2.imported, 1);
  assert.notEqual(await store.getRound('1400'), null);
});

test('11. SÜREN hafta arşive ALINMAZ (7 günlük bekleme penceresi)', async () => {
  const store = mkStore();
  const b = fullRound(1403);
  b.matches[7] = { ...mkMatch(8, null, null, null), score: null }; // 8. maç sonuçsuz
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1403, isPublished: true }] },
    bulletins: { 1403: b },
  });
  // Maçlar 10 Ocak'ta; "şimdi" 11 Ocak — hafta bekleme penceresinin İÇİNDE.
  // Sonuç henüz yayımlanmamış olabilir; erken arşivleme yok.
  const res = await importOfficialHistoryTick({
    store, api, pauseMs: 0, log: () => {}, now: () => '2024-01-11T00:00:00.000Z',
  });
  assert.equal(res.imported, 0);
  assert.equal(await store.getRound('1403'), null);
});

test('11b. BİTMİŞ haftanın sonuçsuz maçı VOID işaretlenir, haftanın kalanı arşive girer', async () => {
  // Gerçek olay: resmî API ertelenen/iptal maçların sonucunu HİÇ yayımlamıyor
  // (2024/2025 17. Hafta Fiorentina-Inter; 2025/2026 49. Hafta iki Çin ligi
  // maçı). Eski kural bu haftaları sonsuza dek dışarıda bırakıyordu ve sezon
  // "45 hafta" görünüyordu — gerçekte 51 hafta tamamlanmıştı.
  const store = mkStore();
  const b = fullRound(1404);
  b.matches[7] = { ...mkMatch(8, null, null, null), score: null };
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1404, isPublished: true }] },
    bulletins: { 1404: b },
  });
  // Maçlar 10 Ocak'ta; "şimdi" 20 Ocak — pencere (7 gün) GEÇİLDİ: hafta bitti.
  const res = await importOfficialHistoryTick({
    store, api, pauseMs: 0, log: () => {}, now: () => '2024-01-20T00:00:00.000Z',
  });
  assert.equal(res.imported, 1);
  const rows = await store.getMatches('1404');
  assert.equal(rows.length, 15, 'void maç da satır olarak durur (hafta 15 maçlıydı)');
  const voidRow = rows.find((m) => m.position === 8);
  // Sonuç UYDURULMAZ: satır analiz dışıdır ve nedeni bellidir.
  assert.equal(voidRow.result, null);
  assert.equal(voidRow.resultValid, false);
  assert.equal(voidRow.conflict, 'void_no_result');
  // Kalan 14 maç normal doğrulanmış sonuç taşır.
  assert.equal(rows.filter((m) => m.resultValid).length, 14);
  // Şeffaflık: void kararı audit'e yazılır.
  const audit = await store.listAudit();
  const v = audit.find((a) => a.action === 'void' && String(a.roundId) === '1404');
  assert.ok(v, 'void kaydı audit izinde olmalı');
  assert.equal(v.position, 8);
});

test('11d. AYLAR sonrasına ertelenen maç haftayı açık TUTMAZ (çapa: son sonuçlu maç)', async () => {
  // Gerçek olay: 2025/2026 43. Hafta — 13 maç mayısta sonuçlandı, 2 ertelenen
  // maç resmî API'de 3 Eylül tarihiyle aynı bültende duruyor. Planlı son maça
  // bakan çapa haftayı eylüle dek "sürüyor" sayardı.
  const store = mkStore();
  const b = fullRound(1406);
  b.matches[10] = { ...mkMatch(11, null, null, null, '2024-03-15T18:00:00Z'), score: null };
  b.matches[12] = { ...mkMatch(13, null, null, null, '2024-03-15T20:00:00Z'), score: null };
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1406, isPublished: true }] },
    bulletins: { 1406: b },
  });
  // Sonuçlu maçlar 10 Ocak'ta; "şimdi" 20 Ocak. Ertelemeler 15 Mart'ta ama
  // sonuç penceresi kapanalı 10 gün oldu → hafta bitti, ertelemeler void.
  const res = await importOfficialHistoryTick({
    store, api, pauseMs: 0, log: () => {}, now: () => '2024-01-20T00:00:00.000Z',
  });
  assert.equal(res.imported, 1);
  const rows = await store.getMatches('1406');
  assert.equal(rows.filter((m) => m.conflict === 'void_no_result').length, 2);
  assert.equal(rows.filter((m) => m.resultValid).length, 13);
});

test('11c. HİÇ sonucu olmayan eski hafta yine de arşive alınmaz', async () => {
  // "Bitti ama yayımlanmadı" ile "hiç oynanmadı" ayrılamaz; 15/15 sonuçsuz
  // bir haftayı void diye arşivlemek hafta sayısını şişirir.
  const store = mkStore();
  const b = mkBulletin(1405, Array.from({ length: 15 }, (_, i) => (
    { ...mkMatch(i + 1, null, null, null), score: null }
  )));
  const api = makeApi({
    roundsByYear: { '2023-2024': [{ id: 1405, isPublished: true }] },
    bulletins: { 1405: b },
  });
  const res = await importOfficialHistoryTick({
    store, api, pauseMs: 0, log: () => {}, now: () => '2024-06-01T00:00:00.000Z',
  });
  assert.equal(res.imported, 0);
  assert.equal(await store.getRound('1405'), null);
});

test('12. Single-flight: eşzamanlı ikinci içe aktarma çağrısı atlanır', async () => {
  const store = mkStore();
  let release;
  const gate = new Promise((res) => { release = res; });
  const api = {
    async getYears() { await gate; return []; },
    async getRounds() { return []; },
    async getBulletinByRoundId() { throw new Error('yok'); },
  };
  const p1 = importOfficialHistoryTick({ store, api, pauseMs: 0, log: () => {} });
  const p2 = importOfficialHistoryTick({ store, api, pauseMs: 0, log: () => {} });
  release();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.ok, true);
  assert.equal(r2.skipped, true);
  assert.equal(r2.reason, 'in-flight');
});

test('13. getHistoryStore: file sürücüsü seçimi + reset', () => {
  _resetHistoryStoreForTests();
  const s = getHistoryStore();
  assert.ok(s instanceof FileHistoryStore, 'HISTORY_DRIVER=file iken dosya sürücüsü');
  _resetHistoryStoreForTests();
});

test('14. Dayanıklı depo: Supabase 005 tabloları yokken DOSYA arşivine düşer (migration beklemez)', async () => {
  const { ResilientHistoryStore } = await import('../src/history/historyStore.js');
  const failing = {
    async listRounds() { throw new Error(`Could not find the table 'public.sportoto_history_rounds' in the schema cache`); },
  };
  let fallbackUsed = false;
  const fb = { async listRounds() { fallbackUsed = true; return [{ roundId: '1' }]; } };
  const rs = new ResilientHistoryStore(failing, () => fb, () => {});
  const rounds = await rs.listRounds();
  assert.equal(fallbackUsed, true, 'tablo-yok hatasında dosya sürücüsüne geçildi');
  assert.equal(rounds.length, 1);
  // Alakasız hatalar YUTULMAZ (yanlış fallback tetiklenmez):
  const netFail = { async listRounds() { throw new Error('fetch failed'); } };
  const rs2 = new ResilientHistoryStore(netFail, () => fb, () => {});
  await assert.rejects(() => rs2.listRounds(), /fetch failed/);
});
