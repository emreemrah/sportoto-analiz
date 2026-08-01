// DEFTER–VERİ MUTABAKATI — "alındı" yazan ama arşivde olmayan haftalar.
// ---------------------------------------------------------------------------
// GERÇEK OLAY (27–28 Tem): historyImportStatus "imported: 0, totalDone: 144"
// diyordu; buna rağmen Radar 5 sıra geçmişi 143 tur yerine ~67 turdan
// besleniyordu. Sebep: içe aktarıcı checkpoint'e (deftere) güvenip
// `doneSet.has(id) → atla` yapıyor, verinin gerçekten kullanılabilir olduğunu
// DOĞRULAMIYORDU. Depo/şema değişiminde (ya da tur satırı 'completed'
// olmadığında) listAllMatches o haftayı döndürmüyor; hafta bir daha ASLA
// denenmediği için örneklem kalıcı olarak küçük kalıyordu.
// Bu testler o deliği kapatır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-rec-'));
process.env.HISTORY_DRIVER = 'file';

const { importOfficialHistoryTick } = await import('../src/history/importer.js');

const mkMatch = (no, sh, sa, result) => ({
  no, home: { name: `Ev${no}` }, away: { name: `Dep${no}` },
  date: '2024-01-10T15:00:00Z', score: { home: sh, away: sa }, result,
});
const tamBulten = (roundId) => ({
  roundId,
  matches: Array.from({ length: 15 }, (_, i) => mkMatch(i + 1, 1, 0, '1')),
});

function makeApi(roundIds) {
  return {
    async getYears() { return ['2023-2024']; },
    async getRounds() { return roundIds.map((id) => ({ id, isPublished: true })); },
    async getBulletinByRoundId(id) { return tamBulten(id); },
  };
}

// Depo taklidi: checkpoint ile gerçek veri AYRI tutulur (asıl hatanın şekli).
function makeStore({ doneRounds = [], storedRounds = [] } = {}) {
  const matches = new Map();
  for (const id of storedRounds) matches.set(String(id), [{ position: 1, result: '1' }]);
  let cp = { doneRounds: [...doneRounds] };
  return {
    _matches: matches,
    async getCheckpoint() { return cp; },
    async setCheckpoint(v) { cp = v; },
    async listAllMatches() {
      const out = [];
      for (const [rid, ms] of matches) for (const m of ms) out.push({ ...m, roundId: rid });
      return out;
    },
    async getMatches(rid) { return matches.get(String(rid)) || []; },
    async upsertRound() {},
    async putMatches(rid, ms) { matches.set(String(rid), ms); },
    async appendAudit() {},
    get checkpoint() { return cp; },
  };
}

test('defter "alındı" diyor ama veri yok → hayalet kayıt düşer ve hafta yeniden alınır', async () => {
  // 3 hafta "alındı" yazıyor; arşivde yalnız 1'i gerçekten var.
  const store = makeStore({ doneRounds: ['101', '102', '103'], storedRounds: ['101'] });
  const res = await importOfficialHistoryTick({
    store, api: makeApi(['101', '102', '103']), pauseMs: 0, log: () => {},
  });
  assert.equal(res.reconciled, true);
  assert.equal(res.reconciledPhantoms, 2);          // 102 ve 103 hayaletti
  assert.equal(res.imported, 2);                    // ikisi de YENİDEN alındı
  // Artık üçü de gerçekten arşivde.
  assert.equal(store._matches.has('102'), true);
  assert.equal(store._matches.has('103'), true);
});

test('veri ile defter uyumluysa gereksiz yeniden alım YAPILMAZ', async () => {
  const store = makeStore({ doneRounds: ['101', '102'], storedRounds: ['101', '102'] });
  const res = await importOfficialHistoryTick({
    store, api: makeApi(['101', '102']), pauseMs: 0, log: () => {},
  });
  assert.equal(res.reconciledPhantoms, 0);
  assert.equal(res.imported, 0);                    // hepsi zaten yerinde
  assert.equal(res.processed, 0);
});

test('arşiv okunamazsa defter BOZULMAZ (veri kaybı riski alınmaz)', async () => {
  const store = makeStore({ doneRounds: ['101', '102'], storedRounds: [] });
  store.listAllMatches = async () => { throw new Error('gecici ag hatasi'); };
  const res = await importOfficialHistoryTick({
    store, api: makeApi(['101', '102']), pauseMs: 0, log: () => {},
  });
  assert.equal(res.reconciled, false);              // mutabakat atlandı
  assert.equal(res.reconciledPhantoms, 0);
  assert.equal(res.imported, 0);                    // defter korundu, tekrar alım yok
});

test('mutabakat sonrası defter yalnız GERÇEKTEN var olanları içerir', async () => {
  const store = makeStore({ doneRounds: ['101', '102', '999'], storedRounds: ['101'] });
  // 999 kaynakta da yok → yeniden alınamaz, deftere geri yazılmamalı.
  await importOfficialHistoryTick({
    store, api: makeApi(['101', '102']), pauseMs: 0, log: () => {},
  });
  const done = new Set((store.checkpoint.doneRounds || []).map(String));
  assert.equal(done.has('101'), true);
  assert.equal(done.has('102'), true);
  assert.equal(done.has('999'), false);             // hayalet geri gelmedi
});
