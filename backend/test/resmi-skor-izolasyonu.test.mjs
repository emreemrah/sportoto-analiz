// RESMÎ SKOR İZOLASYONU — harici skor arşive resmî diye giremez.
//
// NEDEN VAR: bültendeki `score` alanı EKRAN içindir; maç başlayınca harici
// sağlayıcının canlı/bitmiş skoruyla ezilir (refresh.js). Aynı alan arşive de
// gidiyordu ve `ingestOfficialResults` onu `resultSource: 'Spor Toto resmi API'`
// etiketiyle mühürlüyordu. Sonuç: harici bir skor, resmî kayıt gibi
// arşivlenebiliyordu — yanlış bir sonucun "kesin" görünmesi demek.
//
// KURAL: arşiv YALNIZ `resmiSkor` okur. `score` ne olursa olsun arşive girmez.
import test from 'node:test';
import assert from 'node:assert/strict';

import { archiveOnRefresh } from '../src/archive/worker.js';

// Sadece bu testin ihtiyacı olan yüzeyi taşıyan bellek deposu.
function bellekDepo() {
  const d = { resultRows: [], audits: [], snapshot: null };
  return {
    _d: d,
    async getSnapshot() { return d.snapshot; },
    async upsertOfficialResult(row) { d.resultRows.push(row); return { changed: true, corrected: false }; },
    async appendAudit(a) { d.audits.push(a); },
    async listOfficialResults() { return d.resultRows; },
    async getBulletin() { return null; },
    async listBulletins() { return []; },
    async listSnapshotEvaluations() { return []; },
    async putSnapshotEvaluation() {},
    async updateBulletinStatus() {},
  };
}

// Maçlar geçmişte: freezeAt kaçmış sayılır, ama snapshot varmış gibi davranıp
// dondurma yoluna girmesini engelliyoruz (bu testin konusu değil).
const mac = (over = {}) => ({
  no: 1, sportotoMatchId: 'm1', date: '2026-07-01T17:00:00Z',
  home: { name: 'Ev' }, away: { name: 'Dep' },
  ...over,
});

const bulten = (matches) => ({ roundId: 1500, matches });

test('HARİCİ skor arşive YAZILMAZ (resmiSkor yoksa kayıt yok)', async () => {
  const store = bellekDepo();
  store._d.snapshot = { id: '1500' };                 // dondurma yoluna girmesin
  // Gerçekteki tehlikeli hâl: resmî sonuç harfi gelmiş, ama `score` harici
  // sağlayıcının canlı skoruyla ezilmiş ve resmî skor hiç gelmemiş.
  await archiveOnRefresh(bulten([
    mac({ result: '1', score: { home: 3, away: 0 } }),  // score HARİCİ
  ]), { store, now: Date.parse('2026-07-02T00:00:00Z') });

  assert.equal(store._d.resultRows.length, 0, 'harici skor resmî diye arşivlenmiş');
});

test('RESMÎ skor varsa arşivlenir ve harici skor DEĞİL o yazılır', async () => {
  const store = bellekDepo();
  store._d.snapshot = { id: '1500' };
  await archiveOnRefresh(bulten([
    mac({
      result: '1',
      score: { home: 3, away: 0 },        // ekranda görünen (harici, canlı)
      resmiSkor: { home: 2, away: 1 },    // resmî kaynağın kendi skoru
    }),
  ]), { store, now: Date.parse('2026-07-02T00:00:00Z') });

  assert.equal(store._d.resultRows.length, 1);
  const row = store._d.resultRows[0];
  assert.deepEqual(row.fullTimeScore, { home: 2, away: 1 }, 'arşive HARİCİ skor yazılmış');
  assert.equal(row.officialResult, '1');
});

test('resmî sonuç harfi yoksa skor olsa bile yazılmaz', async () => {
  const store = bellekDepo();
  store._d.snapshot = { id: '1500' };
  await archiveOnRefresh(bulten([
    mac({ result: null, resmiSkor: { home: 2, away: 1 } }),
  ]), { store, now: Date.parse('2026-07-02T00:00:00Z') });
  assert.equal(store._d.resultRows.length, 0);
});

test('birden çok maçta yalnız resmî skoru olanlar arşivlenir', async () => {
  const store = bellekDepo();
  store._d.snapshot = { id: '1500' };
  await archiveOnRefresh(bulten([
    mac({ no: 1, sportotoMatchId: 'm1', result: '1', score: { home: 5, away: 0 } }),                                  // yalnız harici
    mac({ no: 2, sportotoMatchId: 'm2', result: 'X', score: { home: 9, away: 9 }, resmiSkor: { home: 1, away: 1 } }),  // resmî var
    mac({ no: 3, sportotoMatchId: 'm3' }),                                                                            // hiçbiri
  ]), { store, now: Date.parse('2026-07-02T00:00:00Z') });

  assert.equal(store._d.resultRows.length, 1);
  assert.equal(store._d.resultRows[0].matchId, 'm2');
  assert.deepEqual(store._d.resultRows[0].fullTimeScore, { home: 1, away: 1 });
});
