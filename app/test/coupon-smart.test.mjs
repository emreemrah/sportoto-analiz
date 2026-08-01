// AKILLI KUPON + AKTARIM testleri — dürüstlük ve sınır garantileri.
import test from 'node:test';
import assert from 'node:assert/strict';

const M = (no, { probs, sys, radar, surprise, dq } = {}) => ({
  no,
  probabilities: probs || null,
  prediction: sys ? { symbol: sys, label: 'TEST' } : null,
  analysis: surprise != null ? { surpriseScore: surprise } : null,
  radarCenter: (radar || dq != null) ? { master: { favorite: radar ? { symbol: radar, percent: 50 } : null, dataQuality: dq ?? null } } : null,
});

test('buildSmartCoupon: bütçe ve 2500 kolon sınırı ASLA aşılmaz', async () => {
  const { buildSmartCoupon } = await import('../src/coupon/smart.js');
  // 15 çok belirsiz maç → sınırsız bütçede bile 2500 aşılmamalı
  const matches = Array.from({ length: 15 }, (_, i) => M(i + 1, { probs: { 1: 34, X: 33, 2: 33 }, surprise: 80 }));
  const res = buildSmartCoupon({ matches, budgetColumns: 999999, target: 15 });
  assert.ok(res.columns <= 2500, `kolon ${res.columns} ≤ 2500 olmalı`);
  const res2 = buildSmartCoupon({ matches, budgetColumns: 8, target: 15 });
  assert.ok(res2.columns <= 8, `bütçe 8 kolon → ${res2.columns} ≤ 8 olmalı`);
});

test('buildSmartCoupon: kesin maç tekli kalır, belirsiz maç genişler; açıklama insanca', async () => {
  const { buildSmartCoupon } = await import('../src/coupon/smart.js');
  const matches = [
    M(1, { probs: { 1: 70, X: 20, 2: 10 }, sys: '1', radar: '1', surprise: 10 }),  // net favori
    M(2, { probs: { 1: 36, X: 34, 2: 30 }, sys: '1', radar: '2', surprise: 70 }),  // tam belirsiz + çatışma
  ];
  const res = buildSmartCoupon({ matches, budgetColumns: 6, target: 14 });
  const s1 = res.selections.find((s) => s.no === 1);
  const s2 = res.selections.find((s) => s.no === 2);
  assert.equal(s1.selectedOutcomes.length, 1, 'net favori tekli kalmalı');
  assert.ok(s2.selectedOutcomes.length >= 2, 'belirsiz + Master/Radar çatışmalı maç genişlemeli');
  const e2 = res.explanations.find((e) => e.no === 2);
  assert.ok(/farklı yönde|yakın|sürpriz/.test(e2.text), 'açıklama insanca gerekçe içermeli');
  assert.ok(!/formül|sigma|Σ|logaritma/i.test(res.explanations.map((e) => e.text).join(' ')), 'teknik formül ana metne sızmaz');
  assert.ok(res.coverageNote.includes('DEĞİLDİR'), 'kapsama kesin kazanma ihtimali gibi sunulmaz');
});

test('buildSmartCoupon: verisiz maç UYDURULMAZ — boş bırakılır ve bildirilir', async () => {
  const { buildSmartCoupon } = await import('../src/coupon/smart.js');
  const matches = [M(1, { probs: { 1: 50, X: 30, 2: 20 } }), M(2, {})]; // 2. maçta hiç sinyal yok
  const res = buildSmartCoupon({ matches, budgetColumns: 100, target: 13 });
  assert.deepEqual(res.insufficient, [2], 'sinyalsiz maç "veri yetersiz" listesinde');
  assert.ok(!res.selections.find((s) => s.no === 2), 'sinyalsiz maça seçim üretilmez');
});

test('buildSmartCoupon: hedef düştükçe kupon daralır (12 hedef ≤ 15 hedef kolonu)', async () => {
  const { buildSmartCoupon } = await import('../src/coupon/smart.js');
  const matches = Array.from({ length: 15 }, (_, i) => M(i + 1, { probs: { 1: 40, X: 32, 2: 28 }, surprise: 50 }));
  const c15 = buildSmartCoupon({ matches, budgetColumns: 512, target: 15 }).columns;
  const c12 = buildSmartCoupon({ matches, budgetColumns: 512, target: 12 }).columns;
  assert.ok(c12 <= c15, `hedef 12 (${c12}) hedef 15'ten (${c15}) pahalı olmamalı`);
});

test('diffSelections: mevcut seçim SESSİZCE ezilmez — her fark raporlanır', async () => {
  const { diffSelections } = await import('../src/coupon/smart.js');
  const cur = { 1: ['1'], 2: ['X'] };
  const prop = { 1: ['1'], 2: ['1', 'X'], 3: ['2'] };
  const d = diffSelections(cur, prop);
  assert.equal(d.length, 2, 'aynı kalan 1. maç fark listesine girmez');
  assert.deepEqual(d.find((x) => x.no === 2), { no: 2, from: 'X', to: '1-X', kind: 'change' });
  assert.deepEqual(d.find((x) => x.no === 3), { no: 3, from: '(boş)', to: '2', kind: 'fill' });
});

test('proposalFrom: kayıt yoksa öneri üretilmez (uydurma aktarım yok)', async () => {
  const { proposalFrom } = await import('../src/coupon/smart.js');
  const matches = [M(1, { sys: '10' }), M(2, {}), M(3, { radar: '2', probs: { 1: 30, X: 33, 2: 37 } })];
  const sys = proposalFrom(matches, 'system');
  assert.deepEqual(sys[1], ['1', 'X'], "resmi '10' → 1-X");
  assert.ok(!sys[2] && !sys[3], 'sistem kaydı olmayan maça öneri yok');
  const radar = proposalFrom(matches, 'radar');
  assert.ok(!radar[1] && !radar[2], 'radar kaydı olmayan maça öneri yok');
  assert.ok(radar[3].includes('2'), 'radar favorisi önerinin içinde');
});
