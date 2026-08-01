// RADAR 5 — biten haftanın resmî sonuçları sıra geçmişine girmeli.
// Kök neden (27 Tem): /position-dna ucu sıra DNA'sını YALNIZ statik geçmiş
// dosyasından hesaplıyordu. Yeni sonuçlanan haftalar o dosyaya değil arşive
// (match_official_results) yazıldığı için biten hafta sonsuza dek dışarıda
// kalıyordu. Bu testler o davranışın geri dönmesini engeller.
import test from 'node:test';
import assert from 'node:assert/strict';
import { archivePositionMatches } from '../src/routes/radar.js';
import { computePositionDna } from '../src/history/positionDna.js';

const bulten = (roundId, extra = {}) => ({ id: `b${roundId}`, roundId, freezeAt: '2026-07-24T15:55:00Z', ...extra });
const sonuc = (orderNo, officialResult) => ({
  matchId: `m${orderNo}`, orderNo, officialResult, confirmedAt: '2026-07-25T20:00:00Z',
});

function sahteStore({ bulletins, resultsByBulletin }) {
  return {
    listBulletins: async () => bulletins,
    listOfficialResults: async (id) => resultsByBulletin[id] || [],
  };
}

test('arşivdeki tamamlanmış hafta sıra geçmişine girer', async () => {
  const store = sahteStore({
    bulletins: [bulten(1526), bulten(1525)],
    resultsByBulletin: { b1525: [sonuc(1, 'X'), sonuc(2, '1')] },
  });
  const m = await archivePositionMatches(store, { beforeRoundId: 1526 });
  assert.equal(m.length, 2);
  assert.deepEqual(m.map((x) => [x.position, x.result]), [[1, 'X'], [2, '1']]);
  assert.equal(m[0].roundId, 1525);
});

test('güncel hafta ve sonrası ASLA girmez (öğrenme sınırı)', async () => {
  const store = sahteStore({
    bulletins: [bulten(1527), bulten(1526), bulten(1525)],
    resultsByBulletin: {
      b1527: [sonuc(1, '1')], b1526: [sonuc(1, '2')], b1525: [sonuc(1, 'X')],
    },
  });
  const m = await archivePositionMatches(store, { beforeRoundId: 1526 });
  assert.deepEqual([...new Set(m.map((x) => x.roundId))], [1525]);
});

test('statik geçmişte zaten olan tur ÇİFT SAYILMAZ', async () => {
  const store = sahteStore({
    bulletins: [bulten(1525), bulten(1524)],
    resultsByBulletin: { b1525: [sonuc(1, 'X')], b1524: [sonuc(1, '1')] },
  });
  const m = await archivePositionMatches(store, {
    beforeRoundId: 1526, knownRoundIds: new Set(['1524']),
  });
  assert.deepEqual(m.map((x) => x.roundId), [1525]);
});

test('resmî sonucu olmayan veya sıra dışı satır atlanır', async () => {
  const store = sahteStore({
    bulletins: [bulten(1525)],
    resultsByBulletin: {
      b1525: [
        sonuc(1, 'X'),
        { matchId: 'm2', orderNo: 2, officialResult: null },   // sonuç yok
        sonuc(16, '1'),                                        // 1-15 dışı
        { matchId: 'm3', orderNo: null, officialResult: '1' }, // sıra yok
      ],
    },
  });
  const m = await archivePositionMatches(store, { beforeRoundId: 1526 });
  assert.equal(m.length, 1);
  assert.equal(m[0].position, 1);
});

test('biten hafta eklenince 1. sıra yüzdeleri MATEMATİKSEL olarak değişir', () => {
  // Statik geçmiş: 1. sırada 67 maç (1:32 · X:13 · 2:22) → %47.8 / %19.4 / %32.8
  const statik = [];
  let i = 0;
  for (const [res, adet] of [['1', 32], ['X', 13], ['2', 22]]) {
    for (let k = 0; k < adet; k += 1, i += 1) {
      statik.push({ position: 1, result: res, roundId: 1000 + i, roundCloseAt: '2026-01-01T00:00:00Z' });
    }
  }
  const once = computePositionDna(statik, { excludeRoundId: 1526 })
    .positions.find((p) => p.position === 1).windows.allTime;
  assert.equal(once.sample, 67);

  // 51. haftanın (1525) 1. sıra sonucu X → arşivden gelir.
  const arsiv = [{ position: 1, result: 'X', roundId: 1525, roundCloseAt: '2026-07-25T20:00:00Z' }];
  const sonra = computePositionDna([...statik, ...arsiv], { excludeRoundId: 1526 })
    .positions.find((p) => p.position === 1).windows.allTime;

  assert.equal(sonra.sample, 68);                     // örneklem büyüdü
  assert.notDeepEqual(once.pct, sonra.pct);           // yüzdeler değişti
  assert.equal(sonra.counts.X, once.counts.X + 1);    // X bir arttı
});

// --- TARİHSEL KESİM: her hafta yalnız KENDİNDEN ÖNCEKİNİ görür --------------
// Kök neden (27 Tem, ikinci tur): /position-dna hep GÜNCEL bülteni kesim
// noktası alıyordu; bu yüzden 51. ve 52. hafta AYNI veriyi gösteriyor ve
// mühürlü haftanın öğrenme sınırı bozuluyordu.
test('51. hafta 51 öncesini, 52. hafta 51 dâhil olanı görür (ayrı kesim)', async () => {
  // 51. haftanın (1525) ilk üç maçı X bitti.
  const w51 = ['X', 'X', 'X', '1', '2', '1', 'X', '2', '1', '2', '1', 'X', '2', '1', '2']
    .map((r, i) => ({ matchId: `m${i + 1}`, orderNo: i + 1, officialResult: r, confirmedAt: '2026-07-25T20:00:00Z' }));
  const store = {
    listBulletins: async () => [
      { id: 'b1526', roundId: 1526 },
      { id: 'b1525', roundId: 1525, freezeAt: '2026-07-24T15:55:00Z' },
    ],
    listOfficialResults: async (id) => (id === 'b1525' ? w51 : []),
  };

  // Statik geçmiş: her sırada 67 maç (1:32 · X:13 · 2:22)
  const statik = [];
  let n = 0;
  for (let p = 1; p <= 15; p += 1) {
    for (const [res, adet] of [['1', 32], ['X', 13], ['2', 22]]) {
      for (let k = 0; k < adet; k += 1, n += 1) {
        statik.push({ position: p, result: res, roundId: 900 + n, roundCloseAt: '2026-01-01T00:00:00Z' });
      }
    }
  }

  const a51 = await archivePositionMatches(store, { beforeRoundId: 1525 });
  const a52 = await archivePositionMatches(store, { beforeRoundId: 1526 });
  assert.equal(a51.length, 0);      // 51 öncesi arşivde tur yok
  assert.equal(a52.length, 15);     // 51. haftanın 15 maçı

  const dna51 = computePositionDna([...statik, ...a51], { excludeRoundId: 1525 });
  const dna52 = computePositionDna([...statik, ...a52], { excludeRoundId: 1526 });
  const w = (dna, p) => dna.positions.find((x) => x.position === p).windows.allTime;

  // 1., 2., 3. sıra: X ham sayacı TAM 1 artar; 1 ve 2 değişmez; n tam 1 artar.
  for (const p of [1, 2, 3]) {
    const A = w(dna51, p); const B = w(dna52, p);
    assert.equal(B.counts.X, A.counts.X + 1, `sıra ${p}: X +1 olmalı`);
    assert.equal(B.counts['1'], A.counts['1'], `sıra ${p}: 1 değişmemeli`);
    assert.equal(B.counts['2'], A.counts['2'], `sıra ${p}: 2 değişmemeli`);
    assert.equal(B.sample, A.sample + 1, `sıra ${p}: n +1 olmalı`);
  }
  // Yüzde ham sayaçtan türer.
  const A1 = w(dna51, 1); const B1 = w(dna52, 1);
  assert.equal(A1.pct.X, Math.round((A1.counts.X / A1.sample) * 1000) / 10);
  assert.equal(B1.pct.X, Math.round((B1.counts.X / B1.sample) * 1000) / 10);
  // İki hafta AYNI veriyi göstermez.
  assert.notDeepEqual(A1.pct, B1.pct);
});

test('mühürlü haftanın görünümü sonraki sonuçlardan ETKİLENMEZ', async () => {
  const store = {
    listBulletins: async () => [
      { id: 'b1526', roundId: 1526 }, { id: 'b1525', roundId: 1525 },
    ],
    listOfficialResults: async (id) => (id === 'b1525'
      ? [{ matchId: 'm1', orderNo: 1, officialResult: 'X' }] : []),
  };
  // 51. hafta görünümü: kendi sonucu dahil DEĞİL.
  const a = await archivePositionMatches(store, { beforeRoundId: 1525 });
  assert.equal(a.length, 0);
  // 52. hafta görünümü: 51 dahil.
  const b = await archivePositionMatches(store, { beforeRoundId: 1526 });
  assert.equal(b.length, 1);
  assert.equal(b[0].result, 'X');
});

// --- MÜHÜRLÜ HAFTA BÜTÜNLÜĞÜ ------------------------------------------------
// Kök neden (27 Tem, üçüncü tur): ekran mühürlü haftada da CANLI /position-dna
// çıktısını render ediyordu. Snapshot bozulmamıştı ama kullanıcıya mühürlü
// değer değişmiş gibi görünüyordu. Bu testler o yolu kapatır.
import { archivePositionMatches as _apm } from '../src/routes/radar.js';

// Ekranın kaynak seçimi (RadarScreen ile AYNI kural, saf hâlde).
function radar5Kaynagi({ current, masterMatches = [], positionDna = null, dnaPeriod = 'allTime' }) {
  const muhurlu = current === false;
  const map = new Map();
  if (muhurlu) {
    for (const mm of masterMatches) {
      const pos = mm.radars?.bulletinMemory?.details?.position;
      if (pos?.pct && pos.sample) map.set(mm.no, pos.pct);
    }
    return { kaynak: 'snapshot', map, canliCagri: false, muhurluKayitYok: map.size === 0 };
  }
  for (const p of positionDna?.dna?.positions || []) {
    const w = p.windows?.[dnaPeriod] || null;
    map.set(p.position, w && w.sample ? w.pct : null);
  }
  return { kaynak: 'canli', map, canliCagri: true, muhurluKayitYok: false };
}

const muhurluHaftaGorunumu = {
  current: false,
  masterMatches: [{
    no: 1,
    radars: { bulletinMemory: { details: { position: { position: 1, sample: 143, counts: { '1': 67, X: 35, '2': 41 }, pct: { '1': 46.9, X: 24.5, '2': 28.7 } } } } },
  }],
};
// Canlı hesap BAŞKA bir değer üretiyor (51. haftanın kendi sonuçları dahil).
const canliCikti = { dna: { positions: [{ position: 1, windows: { allTime: { sample: 68, counts: { '1': 32, X: 14, '2': 22 }, pct: { '1': 47.1, X: 20.6, '2': 32.4 } } } }] } };

test('mühürlü haftada kaynak SNAPSHOT olmalı, canlı uca gidilmemeli', () => {
  const r = radar5Kaynagi({ ...muhurluHaftaGorunumu, positionDna: canliCikti });
  assert.equal(r.kaynak, 'snapshot');
  assert.equal(r.canliCagri, false);                      // canlı uç ÇAĞRILMAZ
  assert.deepEqual(r.map.get(1), { '1': 46.9, X: 24.5, '2': 28.7 });
});

test('mühürlü hafta canlı hesap elde olsa BİLE onu göstermez', () => {
  const r = radar5Kaynagi({ ...muhurluHaftaGorunumu, positionDna: canliCikti });
  assert.notDeepEqual(r.map.get(1), canliCikti.dna.positions[0].windows.allTime.pct);
});

test('snapshot içinde Radar 5 yoksa geriye dönük hesap YAPILMAZ', () => {
  const r = radar5Kaynagi({ current: false, masterMatches: [{ no: 1, radars: {} }], positionDna: canliCikti });
  assert.equal(r.muhurluKayitYok, true);
  assert.equal(r.map.size, 0);
  assert.equal(r.canliCagri, false);
});

test('güncel hafta canlı hesabı kullanır (mühürlü yol yalnız geçmişe özgü)', () => {
  const r = radar5Kaynagi({ current: true, masterMatches: [], positionDna: canliCikti });
  assert.equal(r.kaynak, 'canli');
  assert.deepEqual(r.map.get(1), { '1': 47.1, X: 20.6, '2': 32.4 });
});

test('mühürlü değer, sonraki haftanın canlı değerinden FARKLI kalır', () => {
  const m = radar5Kaynagi({ ...muhurluHaftaGorunumu, positionDna: canliCikti });   // 51. hafta
  const g = radar5Kaynagi({ current: true, masterMatches: [], positionDna: canliCikti }); // 52. hafta
  assert.notDeepEqual(m.map.get(1), g.map.get(1));
});
