// ---------------------------------------------------------------------------
// KEŞİF HAVUZU — kapı testleri (2026-08-07)
// ---------------------------------------------------------------------------
// NEDEN: başarı karnesine sayılan tek hafta var (12 maç). Bu boyutta örüntü
// aramak gürültü üretir. Çözüm, mührü GEÇ atılmış haftaları örüntü taramasına
// ayrı etiketle almaktı.
//
// BU TESTLERİN İŞİ, özelliğin çalıştığını göstermek DEĞİL; özelliğin
// KARNEYE SIZMADIĞINI ve UYDURMA VERİ ALMADIĞINI kanıtlamaktır. Buradaki bir
// gevşeme, "sistem şu kadar başarılı" cümlesini yalan yapar.
import test from 'node:test';
import assert from 'node:assert/strict';

import { sinyalKayitlariniTopla } from '../src/analysis/sinyalToplama.js';

const ONCE = '2026-01-10T10:00:00.000Z';   // kilit / gözlem anı
const ILK  = '2026-01-10T17:00:00.000Z';   // ilk maç başlangıcı

/** Resmî ileri-test kanıtlarının TAMAMINI taşıyan snapshot. */
function snapshot(id, { late = false, backfilled = false, demo = false, retrospective = false } = {}) {
  return {
    id,
    immutable: true,
    payloadHash: `hash-${id}`,
    createdAt: ONCE,
    dataObservedAt: ONCE,
    lockedAt: ONCE,
    late,
    backfilled,
    isDemo: demo,
    retrospective,
    payload: {
      bulletin: { freezeAt: ONCE, firstMatchStartAt: ILK },
      engine: { analysisEngineVersion: 'test-1' },
      matches: [
        { matchId: `${id}-a`, no: 1, radarCenter: { master: { mainPrediction: '1' } } },
        { matchId: `${id}-b`, no: 2, radarCenter: { master: { mainPrediction: '2' } } },
      ],
    },
  };
}

function sahteDepo(haftalar) {
  return {
    async listBulletins() {
      return haftalar.map((h, i) => ({ id: h.id, roundId: 1500 + i, week: `#${h.id}`, season: 2026 }));
    },
    async getSnapshot(id) {
      const h = haftalar.find((x) => x.id === id);
      return h ? snapshot(id, h.bayrak) : null;
    },
    async listOfficialResults(id) {
      return [
        { matchId: `${id}-a`, orderNo: 1, officialResult: '1', fullTimeScore: { home: 2, away: 0 } },
        { matchId: `${id}-b`, orderNo: 2, officialResult: '2', fullTimeScore: { home: 0, away: 1 } },
      ];
    },
  };
}

const DEPO = () => sahteDepo([
  { id: 'resmi', bayrak: {} },
  { id: 'gec', bayrak: { late: true } },                    // late_unverified
  { id: 'doldurma', bayrak: { backfilled: true } },         // legacy_backfill
  { id: 'demo', bayrak: { demo: true } },                   // demo
  { id: 'geriye', bayrak: { retrospective: true } },        // retrospective_backtest
]);

test('keşif KAPALI: yalnız resmî hafta sayılır (mevcut davranış bozulmadı)', async () => {
  const { kayitlar, kapsam } = await sinyalKayitlariniTopla({ tur: 'master', store: DEPO() });
  assert.equal(kapsam.haftaDahil, 1, 'yalnız resmî hafta sayılmalı');
  assert.equal(kapsam.haftaKesif, 0);
  assert.equal(kapsam.macKesif, 0);
  assert.equal(kayitlar.length, 2);
  assert.ok(kayitlar.every((k) => k.kesif === false));
});

test('keşif AÇIK: yalnız geç mühürlü hafta eklenir', async () => {
  const { kayitlar, kapsam } = await sinyalKayitlariniTopla({ tur: 'master', store: DEPO(), kesif: true });
  assert.equal(kapsam.haftaDahil, 1, 'resmî hafta sayısı DEĞİŞMEMELİ');
  assert.equal(kapsam.haftaKesif, 1, 'yalnız late_unverified hafta keşfe girmeli');
  assert.equal(kayitlar.length, 4, '2 resmî + 2 keşif maç');
  assert.equal(kapsam.macKesif, 2);
});

// EN ÖNEMLİ TEST: uydurma/üretilmiş veri keşfe DE giremez.
test('keşif AÇIK: demo, geriye dönük ve doldurma haftaları ASLA girmez', async () => {
  const { kayitlar } = await sinyalKayitlariniTopla({ tur: 'master', store: DEPO(), kesif: true });
  const turler = new Set(kayitlar.map((k) => k.muhurTuru));
  assert.ok(!turler.has('demo'), 'demo veri keşfe sızdı');
  assert.ok(!turler.has('legacy_backfill'), 'sonradan doldurulmuş veri keşfe sızdı');
  assert.ok(!turler.has('retrospective_backtest'), 'geriye dönük test verisi keşfe sızdı');
  assert.deepEqual([...turler].sort(), ['late_unverified', 'official_forward']);
});

// KARIŞTIRILAMAZLIK: her satır kaynağını kendi üstünde taşır.
test('her kayıt kaynağını taşır — keşif satırı resmî satırdan ayırt edilebilir', async () => {
  const { kayitlar } = await sinyalKayitlariniTopla({ tur: 'master', store: DEPO(), kesif: true });
  for (const k of kayitlar) {
    assert.equal(typeof k.kesif, 'boolean', 'keşif etiketi eksik');
    assert.ok(k.muhurTuru, 'mühür türü eksik');
    assert.equal(k.kesif, k.muhurTuru !== 'official_forward');
  }
});
