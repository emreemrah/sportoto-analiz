// KUPON DEĞERLENDİRME testleri — dürüstlük + dondurulmuş versiyon garantisi.
import test from 'node:test';
import assert from 'node:assert/strict';

const sel = (no, outcomes) => ({ no, selectedOutcomes: outcomes });

test('evalSelections: resmi sonuçla ✅/❌/⏳ ve 15-14-13-12 bilgisi', async () => {
  const { evalSelections } = await import('../src/couponEval.js');
  const selections = [sel(1, ['1']), sel(2, ['X']), sel(3, ['1', 'X']), sel(4, ['2']), sel(5, ['1'])];
  const results = new Map([[1, '1'], [2, '2'], [3, 'X'], [4, '2']]); // 5 sonuçsuz
  const ev = evalSelections(selections, results);
  assert.equal(ev.correct, 3);
  assert.equal(ev.wrong, 1);
  assert.equal(ev.pending, 1);
  assert.equal(ev.allResolved, false);
  assert.equal(ev.tier, null, 'tüm sonuçlar gelmeden 12-15 bilgisi KESİNLEŞMEZ');
  assert.equal(ev.misses.length, 1);
  assert.equal(ev.misses[0].no, 2);
  assert.equal(ev.rows[4].hit, null, 'sonuçsuz maç ⏳ (uydurma değerlendirme yok)');
});

test('evalSelections: 15 maç tam çözüldüğünde tier doğru; 12 altı null', async () => {
  const { evalSelections } = await import('../src/couponEval.js');
  const mk = (correctCount) => {
    const selections = []; const results = new Map();
    for (let i = 1; i <= 15; i++) {
      selections.push(sel(i, ['1']));
      results.set(i, i <= correctCount ? '1' : '2');
    }
    return evalSelections(selections, results);
  };
  assert.equal(mk(15).tier, 15);
  assert.equal(mk(13).tier, 13);
  assert.equal(mk(12).tier, 12);
  assert.equal(mk(11).tier, null, '12 barajının altı → tier yok');
  assert.equal(mk(11).allResolved, true);
});

test('normResult: resmi 0 → X normalize; bilinmeyen değer null (uydurma yok)', async () => {
  const { normResult } = await import('../src/couponEval.js');
  assert.equal(normResult('0'), 'X');
  assert.equal(normResult('X'), 'X');
  assert.equal(normResult('1'), '1');
  assert.equal(normResult('2'), '2');
  assert.equal(normResult('garbage'), null);
  assert.equal(normResult(null), null);
});

test('evalCoupon: KİLİTLİ FINAL versiyonla değerlendirir — eski versiyon değil', async () => {
  const { evalCoupon } = await import('../src/couponEval.js');
  const v1 = { id: 'v1', versionNo: 1, selections: [sel(1, ['2'])], columnCount: 1, totalAmount: 10 };
  const v2 = { id: 'v2', versionNo: 2, selections: [sel(1, ['1'])], columnCount: 1, totalAmount: 10 };
  const coupon = { id: 'c1', versions: [v1, v2], finalVersionId: 'v2' };
  const ev = evalCoupon(coupon, new Map([[1, '1']]));
  assert.equal(ev.versionNo, 2, 'final (kilit anındaki) versiyon kullanılmalı');
  assert.equal(ev.correct, 1, 'v2 seçimi (1) sonuçla eşleşir; v1 (2) DEĞİL');
});

test('picksMapOf: seçimler resmi sembole çevrilir (X→0); kupon yoksa boş', async () => {
  const { picksMapOf } = await import('../src/couponEval.js');
  const v = { id: 'v1', versionNo: 1, selections: [sel(3, ['1', 'X']), sel(7, ['2'])] };
  const map = picksMapOf({ versions: [v], finalVersionId: 'v1' });
  assert.equal(map[3], '10', "['1','X'] → '10' (resmi gösterim)");
  assert.equal(map[7], '2');
  assert.deepEqual(picksMapOf(null), {}, 'kupon yoksa boş harita (Kuponum filtresi yine görünür)');
});

test('buildShareText: hassas veri yok + zorunlu açıklama + beyan etiketi', async () => {
  const { buildShareText } = await import('../src/couponEval.js');
  const v = { id: 'v1', versionNo: 1, selections: [sel(1, ['1']), sel(2, ['X', '2'])], columnCount: 2 };
  const coupon = { versions: [v], finalVersionId: 'v1', playedMarkedAt: '2026-07-24T10:00:00Z' };
  const teams = { 1: { home: 'Helsinki', away: 'TPS Turku' } };
  // Tutar yalnız GERÇEK fiyat verisiyle hesaplanıp dışarıdan verilir (uydurulmaz).
  const txt = buildShareText({ coupon, roundName: '51. Hafta', season: '2026 Sezonu', teamsByNo: teams, cost: 20 });
  assert.ok(txt.includes('SPORTOTO MASTER ANALİZ'));
  assert.ok(txt.includes('51. Hafta'));
  assert.ok(txt.includes('Helsinki - TPS Turku → 1'));
  assert.ok(txt.includes('Kolon: 2'));
  assert.ok(txt.includes('Tutar: 20 TL'), 'istenirse maliyet görünür');
  assert.ok(txt.includes('Kesin sonuç veya kazanç vaadi değildir'), 'zorunlu açıklama');
  assert.ok(txt.includes('kullanıcı beyanı, bağımsız olarak doğrulanmamıştır'), 'beyan asla doğrulanmış gibi gösterilmez');
  assert.ok(!/token|@|e-posta|email/i.test(txt), 'hassas veri sızmaz');
  const txt2 = buildShareText({ coupon: { versions: [v], finalVersionId: 'v1' }, teamsByNo: teams, cost: null });
  assert.ok(!txt2.includes('Tutar:'), 'fiyat verisi yoksa/istenmezse tutar görünmez');
  assert.ok(!txt2.includes('beyan'), 'beyan işareti yoksa satır da yok');
});
