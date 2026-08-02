// OYNANMA YÜZDESİ DNA TESTLERİ (görev C — bantlar + geri çekilme + uzlaşma)
import test from 'node:test';
import assert from 'node:assert/strict';

const { findSimilarDna, providerConsensus, bandOfClose, bandOfMove, PCT_BANDS } =
  await import('../src/providers/percentageDna.js');

const rec = (provider, position, result, closeFav, openFav = null, favoriteSymbol = '1') => ({
  provider, position, result, favoriteSymbol,
  closePct: { '1': favoriteSymbol === '1' ? closeFav : 20, X: 20, '2': 20, [favoriteSymbol]: closeFav },
  openPct: openFav == null ? null : { [favoriteSymbol]: openFav },
});

test('1. Bantlar: kapanış ve hareket bandı seçimi (sürümlü)', () => {
  assert.deepEqual(bandOfClose(72), [70, 74]);
  assert.deepEqual(bandOfClose(85), [85, 100]);
  assert.deepEqual(bandOfMove(9), [8, 100]);
  assert.deepEqual(bandOfMove(-10), [-100, -8]);
  assert.deepEqual(bandOfMove(0), [-2.9, 2.9]);
  assert.equal(PCT_BANDS.version, 'played-pct-dna-1.0.0');
});

test('2. Geri çekilme SEVİYE 1: sağlayıcı+sıra+bant+hareket (örneklem yeterliyse)', () => {
  const records = [
    // 14. sırada %70-74 kapanan + ≥8 puan yükselen 12 maç: 7 kez 1, 3 X, 2 kez 2
    ...Array.from({ length: 7 }, () => rec('bilyoner', 14, '1', 72, 60)),
    ...Array.from({ length: 3 }, () => rec('bilyoner', 14, 'X', 71, 62)),
    ...Array.from({ length: 2 }, () => rec('bilyoner', 14, '2', 73, 61)),
    // gürültü: farklı sıra/sağlayıcı
    ...Array.from({ length: 20 }, () => rec('nesine', 14, '2', 72, 60)),
    ...Array.from({ length: 20 }, () => rec('bilyoner', 3, '2', 72, 60)),
  ];
  const q = { provider: 'bilyoner', position: 14, favoriteSymbol: '1', closeValue: 72, moveValue: 10 };
  const r = findSimilarDna(records, q);
  assert.equal(r.hasData, true);
  assert.equal(r.level, 'provider+position+band+move');
  assert.equal(r.sample, 12, 'yalnız bilyoner + 14. sıra + bant + hareket');
  assert.equal(r.favoriteWinRate, 58);
});

test('3. Geri çekilme SEVİYE 2→3: sıra örneklemi yetmezse segment, o da yetmezse bant', () => {
  // 14. sırada yalnız 4 maç; ama son-5 segmentinde (11-15) toplam 15 maç.
  const records = [
    ...Array.from({ length: 4 }, () => rec('bilyoner', 14, '1', 72, 60)),
    ...Array.from({ length: 11 }, () => rec('bilyoner', 12, '1', 71, 60)),
  ];
  const q = { provider: 'bilyoner', position: 14, favoriteSymbol: '1', closeValue: 72, moveValue: 10 };
  const r = findSimilarDna(records, q);
  assert.equal(r.hasData, true);
  assert.equal(r.level, 'provider+segment+band', 'sıra yetersiz → segmente çekilir');
  assert.equal(r.sample, 15);
  // Segment de yetmezse sağlayıcı+bant:
  const records2 = [
    ...Array.from({ length: 5 }, () => rec('bilyoner', 14, '1', 72)),
    ...Array.from({ length: 6 }, () => rec('bilyoner', 2, '1', 71)),
  ];
  const r2 = findSimilarDna(records2, { ...q, moveValue: null });
  assert.equal(r2.level, 'provider+band');
  assert.equal(r2.sample, 11);
});

test('4. n<10 → YÖN SİNYALİ YOK (dürüst "sistem öğreniyor")', () => {
  const records = Array.from({ length: 6 }, () => rec('bilyoner', 14, '1', 72, 60));
  const r = findSimilarDna(records, { provider: 'bilyoner', position: 14, favoriteSymbol: '1', closeValue: 72, moveValue: 10 });
  assert.equal(r.hasData, false);
  assert.equal(r.reason, 'insufficient_sample');
  assert.match(r.note, /öğreniyor/);
});

test('5. Sağlayıcılar HAM veride karışmaz: sorgu yalnız kendi sağlayıcısını görür', () => {
  const records = [
    ...Array.from({ length: 30 }, () => rec('nesine', 14, '2', 72, 60)), // nesine'de hep 2
    ...Array.from({ length: 12 }, () => rec('bilyoner', 14, '1', 72, 60)), // bilyoner'de hep 1
  ];
  const r = findSimilarDna(records, { provider: 'bilyoner', position: 14, favoriteSymbol: '1', closeValue: 72, moveValue: 10 });
  assert.equal(r.sample, 12, 'nesine kayıtları bilyoner sorgusuna KARIŞMADI');
  assert.equal(r.pct['1'], 100);
});

test('6. Sağlayıcı uzlaşması: medyan + fark + uzlaşma/çatışma bayrağı', () => {
  const agree = providerConsensus({
    bilyoner: { '1': 60, X: 25, '2': 15 },
    nesine: { '1': 55, X: 28, '2': 17 },
    misli: { '1': 58, X: 26, '2': 16 },
  });
  assert.equal(agree.hasData, true);
  assert.equal(agree.consensus, true);
  assert.equal(agree.conflict, false);
  assert.equal(agree.median['1'], 58);
  const clash = providerConsensus({
    bilyoner: { '1': 60, X: 25, '2': 15 },
    nesine: { '1': 30, X: 25, '2': 45 },
  });
  assert.equal(clash.conflict, true, 'farklı favoriler → sağlayıcı çelişkisi');
  const single = providerConsensus({ bilyoner: { '1': 60, X: 25, '2': 15 } });
  assert.equal(single.hasData, false, 'tek sağlayıcıyla uzlaşma analizi yapılmaz');
});

// --- GÜNLÜK KAYIT → pct-DNA DÖNÜŞTÜRÜCÜ (kablolama adaptörü) ---------------
const { toPctDnaRecords } = await import('../src/providers/percentageDna.js');

test('toPctDnaRecords: ilk gün açılış, son gün kapanış, favori kapanıştan', () => {
  const gunluk = [
    { source: 'nesine', roundId: 1525, matchKey: 'm1', position: 3, dayKey: '2026-07-22', pct: { '1': 58, X: 24, '2': 18 }, result: 'X' },
    { source: 'nesine', roundId: 1525, matchKey: 'm1', position: 3, dayKey: '2026-07-24', pct: { '1': 45, X: 30, '2': 25 }, result: 'X' },
  ];
  const [r] = toPctDnaRecords(gunluk);
  assert.equal(r.provider, 'nesine');
  assert.equal(r.position, 3);
  assert.equal(r.result, 'X');
  assert.deepEqual(r.openPct, { '1': 58, X: 24, '2': 18 });
  assert.deepEqual(r.closePct, { '1': 45, X: 30, '2': 25 });
  assert.equal(r.favoriteSymbol, '1', 'favori KAPANIŞTAKİ en yüksek pay');
});

test('toPctDnaRecords: tek günlü maçta açılış UYDURULMAZ (openPct null)', () => {
  const [r] = toPctDnaRecords([
    { source: 'misli', roundId: 1525, matchKey: 'm2', position: 1, dayKey: '2026-07-24', pct: { '1': 40, X: 35, '2': 25 }, result: '1' },
  ]);
  assert.equal(r.openPct, null);
  assert.deepEqual(r.closePct, { '1': 40, X: 35, '2': 25 });
});

test('toPctDnaRecords: sonucu olmayan kayıt dönüşmez, kaynaklar ayrı kalır', () => {
  const out = toPctDnaRecords([
    { source: 'nesine', roundId: 1525, matchKey: 'm1', position: 1, dayKey: '2026-07-22', pct: { '1': 50, X: 30, '2': 20 }, result: null },
    { source: 'nesine', roundId: 1525, matchKey: 'm3', position: 2, dayKey: '2026-07-22', pct: { '1': 50, X: 30, '2': 20 }, result: '1' },
    { source: 'misli', roundId: 1525, matchKey: 'm3', position: 2, dayKey: '2026-07-22', pct: { '1': 48, X: 30, '2': 22 }, result: '1' },
  ]);
  assert.equal(out.length, 2, 'sonuçsuz kayıt girmez; aynı maçın iki kaynağı İKİ ayrı kayıttır');
  assert.deepEqual(out.map((r) => r.provider).sort(), ['misli', 'nesine']);
});
