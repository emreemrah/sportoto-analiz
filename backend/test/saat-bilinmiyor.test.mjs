// SAAT GİRİLMEMİŞ MAÇ — "00:00" yer tutucu gerçek başlama anı DEĞİLDİR.
//
// GERÇEK ARIZA (29 Ağu 2026, 4. Hafta): Spor Toto 9 Süper Lig maçını
// "2026-09-06T00:00:00" ile yayınladı (TFF saatleri açıklamamıştı). Kart 00:00
// basıyor, 6 Eylül gece yarısı maçlar "başladı" sayılacak, kilit/dondurma
// erkene kayacaktı. Bu test kuralı gerçek veriyle bekçiler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { saatBilinir, baslamaAniMs, tahminiBaslama, macAniMs } from '../src/time/turkiyeSaati.js';
import { firstKickoffMs, computeFreezeAt } from '../src/archive/snapshotService.js';
import { freezeMsOf } from '../src/providers/marketOdds.js';

test('saatBilinir: 00:00:00 yer tutucu → bilinmiyor; gerçek saat → bilinir', () => {
  assert.equal(saatBilinir('2026-09-06T00:00:00'), false);
  assert.equal(saatBilinir('2026-09-06'), false);
  assert.equal(saatBilinir(null), false);
  assert.equal(saatBilinir(''), false);
  assert.equal(saatBilinir('2026-09-05T17:15:00'), true);
  assert.equal(saatBilinir('2026-08-28T21:30:00'), true);
  assert.equal(saatBilinir('2026-09-06T00:05:00'), true);
});

test('ilk maç / dondurma anı saati girilmemiş maçı SAYMAZ', () => {
  const maclar = [
    { no: 1, date: '2026-09-06T00:00:00', kickoffTimeKnown: false },
    { no: 12, date: '2026-09-05T17:15:00', kickoffTimeKnown: true },
    { no: 13, date: '2026-09-05T19:00:00', kickoffTimeKnown: true },
  ];
  const beklenen = new Date(firstKickoffMs([maclar[1]])).toISOString();
  assert.equal(new Date(firstKickoffMs(maclar)).toISOString(), beklenen);
  assert.equal(computeFreezeAt(maclar), computeFreezeAt([maclar[1], maclar[2]]));
  assert.equal(freezeMsOf({ matches: maclar }), freezeMsOf({ matches: [maclar[1], maclar[2]] }));
  // Hepsi saatsizse dondurma anı YOK (uydurulmaz).
  assert.equal(firstKickoffMs([maclar[0]]), null);
  assert.equal(freezeMsOf({ matches: [maclar[0]] }), null);
  // Bayrağı olmayan eski kayıt (mühürlü haftalar) eski davranışı korur.
  assert.ok(firstKickoffMs([{ date: '2026-08-28T21:30:00' }]) > 0);
});

test('tahminiBaslama: kaynak anı Türkiye duvar saatine; 00:00 UTC yer tutucu → null', () => {
  // 29 Ağu 2026 gerçek değerler: Erzurumspor–Konyaspor 1788616800 = 5 Eyl 17:00 TR;
  // F.Bahçe–Beşiktaş 1788652800 = 00:00 UTC (kaynağın yer tutucusu).
  assert.equal(tahminiBaslama(1788616800), '2026-09-05T17:00:00');
  assert.equal(tahminiBaslama(1788714000), '2026-09-06T20:00:00');
  assert.equal(tahminiBaslama(1788652800), null);
  assert.equal(tahminiBaslama(null), null);
});

test('baslamaAniMs: resmî saat > tahmin > yok; dondurma tahmini de sayar', () => {
  const resmi = { date: '2026-09-05T17:15:00', kickoffTimeKnown: true };
  const tahminli = { date: '2026-09-06T00:00:00', kickoffTimeKnown: false, kickoffEstimate: '2026-09-05T17:00:00' };
  const saatsiz = { date: '2026-09-06T00:00:00', kickoffTimeKnown: false, kickoffEstimate: null };
  assert.equal(baslamaAniMs(resmi), macAniMs('2026-09-05T17:15:00'));
  assert.equal(baslamaAniMs(tahminli), macAniMs('2026-09-05T17:00:00'));
  assert.equal(baslamaAniMs(saatsiz), null);
  // Resmî saat girildiyse tahmin YOK SAYILIR (resmî olan kazanır).
  assert.equal(baslamaAniMs({ ...resmi, kickoffEstimate: '2026-09-07T20:00:00' }), macAniMs('2026-09-05T17:15:00'));
  assert.equal(firstKickoffMs([resmi, tahminli, saatsiz]), macAniMs('2026-09-05T17:00:00'));
  assert.equal(freezeMsOf({ matches: [tahminli, saatsiz] }), macAniMs('2026-09-05T17:00:00') - 5 * 60e3);
});
