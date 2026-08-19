// NOTER KARARI — RESMÎ API'DEN OTOMATİK İŞLEME (2026-08-20)
// ---------------------------------------------------------------------------
// GERÇEK OLAY: 1. Hafta 15. maç (Celta Vigo – Osasuna) ertelendi; kura noter
// huzurunda çekildi ve resmî webapi kararı `match.noterWin = 1` alanında
// yayımladı — ama istemci bu alanı hiç okumuyordu ve hafta "kesinleşmemiş"
// kalmaya devam etti (kullanıcı bildirdi). Korunan sözleşme:
//  (a) sportoto.js: skorsuz maçta noterWin → result + viaNotary; skor
//      UYDURULMAZ. Üst satır null olsa da iç `match` nesnesinden okunur
//      (1528'de ölçülen gerçek biçim). Bitmiş maç viaNotary TAŞIMAZ.
//  (b) ingestNotaryResults: viaNotary satırı arşive notary_decision olarak
//      otomatik yazar; idempotenttir; kayıtlı/mevcut sonucu ASLA ezmez;
//      skorlu ya da geçersiz satırı almaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-noter-oto-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-noter-oto-arsiv-'));
process.env.ARCHIVE_DRIVER = 'file';

const { _resetArchiveStoreForTests, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { ingestNotaryResults, recordNotaryResult } = await import('../src/archive/resultsService.js');
const { getBulletinByRoundId } = await import('../src/sources/sportoto.js');

// ---- (a) resmî API eşlemesi — fetch sahtelenir, gerçek 1528 biçimi --------
const hamSatir = (over = {}, macOver = {}) => ({
  fullTimeWin: null, noterWin: null, date: '2026-08-27T21:30:00',
  match: {
    id: 'm-15', date: '2026-08-27T21:30:00',
    fullTimeWin: null, noterWin: null, score: null,
    homeTeam: { name: 'Celta Vigo' }, awayTeam: { name: 'Osasuna' },
    stage: { name: 'La Liga' },
    ...macOver,
  },
  ...over,
});

async function fetchIleBulten(rows) {
  const eskiFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ isSucceed: true, object: rows }),
  });
  try { return await getBulletinByRoundId(1528); }
  finally { globalThis.fetch = eskiFetch; }
}

test('(a) noterWin iç match nesnesinden okunur: result + viaNotary, skor NULL', async () => {
  // 1528'de ölçülen gerçek biçim: üst satırda noterWin null, iç match'te 1.
  const b = await fetchIleBulten([hamSatir({}, { fullTimeWin: 1, noterWin: 1 })]);
  const m = b.matches[0];
  assert.equal(m.result, '1');
  assert.equal(m.viaNotary, true);
  assert.equal(m.score, null, 'oynanmamış maça skor uydurulmaz');
  assert.equal(m.status, 'upcoming', 'maç oynanmadı — finished denmez');
});

test('(a) noterWin=0 → X; geçersiz değer → sonuç YOK (uydurma yok)', async () => {
  const b = await fetchIleBulten([
    hamSatir({}, { noterWin: 0 }),
    hamSatir({}, { noterWin: 7 }),
    hamSatir({}, {}),
  ]);
  assert.equal(b.matches[0].result, 'X');
  assert.equal(b.matches[0].viaNotary, true);
  assert.equal(b.matches[1].result, null);
  assert.equal(b.matches[1].viaNotary, undefined);
  assert.equal(b.matches[2].result, null);
});

test('(a) BİTMİŞ maç viaNotary taşımaz — normal sonuç akışı değişmedi', async () => {
  const b = await fetchIleBulten([
    hamSatir({}, {
      fullTimeWin: 2, noterWin: 1, // ikisi de dolu olsa bile skor kazanır
      score: { homeRegular: 0, awayRegular: 2 },
    }),
  ]);
  const m = b.matches[0];
  assert.equal(m.result, '2');
  assert.equal(m.viaNotary, undefined);
  assert.deepEqual(m.score, { home: 0, away: 2 });
  assert.equal(m.status, 'finished');
});

// ---- (b) arşive otomatik işleme -------------------------------------------
const store = getArchiveStore();
const T0 = new Date('2026-08-14T18:30:00Z').getTime();
const iso = (t) => new Date(t).toISOString();
const RID = '9100';

await store.upsertBulletin({
  id: RID, roundId: 9100, week: '1. Hafta', season: '2026/2027', status: 'active',
  freezeAt: iso(T0), firstMatchStartAt: iso(T0 + 5 * 60e3),
});
await store.replaceMatches(RID, [
  { matchId: 'n1', orderNo: 1, homeName: 'Ev1', awayName: 'Dep1', kickoffAt: iso(T0) },
  { matchId: 'n15', orderNo: 15, homeName: 'Celta Vigo', awayName: 'Osasuna', kickoffAt: iso(T0 + 13 * 86400e3) },
]);
await store.upsertBulletin({ id: RID, roundId: 9100, status: 'locked', lockedAt: iso(T0) });

test('(b) viaNotary satırı notary_decision olarak otomatik yazılır — skorsuz, audit\'li', async () => {
  const r = await ingestNotaryResults(RID, [
    { no: 1, result: '1', score: { home: 2, away: 0 } },          // skorlu → bu akışın işi değil
    { no: 15, result: '1', score: null, viaNotary: true },        // resmî noter alanı
  ], { store });
  assert.equal(r.added, 1);
  const kayit = (await store.listOfficialResults(RID)).find((x) => x.orderNo === 15);
  assert.equal(kayit.officialResult, '1');
  assert.equal(kayit.resultType, 'notary_decision');
  assert.equal(kayit.fullTimeScore, null, 'noter kaydında skor OLMAZ');
});

test('(b) idempotent: ikinci geçiş hiçbir şey eklemez, kaydı ezmez', async () => {
  const r = await ingestNotaryResults(RID, [
    { no: 15, result: '2', score: null, viaNotary: true }, // farklı değerle bile
  ], { store });
  assert.equal(r.added, 0);
  const kayit = (await store.listOfficialResults(RID)).find((x) => x.orderNo === 15);
  assert.equal(kayit.officialResult, '1', 'mevcut resmî kayıt ASLA ezilmez');
});

test('(b) viaNotary İŞARETSİZ skorsuz satır alınmaz — uydurma kapısı yok', async () => {
  const r = await ingestNotaryResults(RID, [
    { no: 1, result: 'X', score: null },
  ], { store });
  assert.equal(r.added, 0);
  assert.equal((await store.listOfficialResults(RID)).some((x) => x.orderNo === 1), false);
});

test('(b) elle giriş yedeği hâlâ çalışır ve otomatik geçiş onu da ezmez', async () => {
  const RID2 = '9101';
  await store.upsertBulletin({
    id: RID2, roundId: 9101, week: '2. Hafta', season: '2026/2027', status: 'active',
    freezeAt: iso(T0), firstMatchStartAt: iso(T0 + 5 * 60e3),
  });
  await store.replaceMatches(RID2, [
    { matchId: 'p14', orderNo: 14, homeName: 'Ev', awayName: 'Dep', kickoffAt: iso(T0) },
  ]);
  await store.upsertBulletin({ id: RID2, roundId: 9101, status: 'locked', lockedAt: iso(T0) });
  await recordNotaryResult(RID2, { orderNo: 14, sonuc: 'X' }, { store, actor: 'operator' });
  const r = await ingestNotaryResults(RID2, [
    { no: 14, result: '1', score: null, viaNotary: true },
  ], { store });
  assert.equal(r.added, 0);
  const kayit = (await store.listOfficialResults(RID2)).find((x) => x.orderNo === 14);
  assert.equal(kayit.officialResult, 'X', 'operatörün girdiği kayıt korunur');
});
