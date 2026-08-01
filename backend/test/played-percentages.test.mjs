// OYNANMA YÜZDESİ ÇERÇEVESİ TESTLERİ (görev C)
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  validatePercentages, classifyObservationKind, isDuplicateOfLast,
  observePlayedPercentages, summarizeSeries, registerProvider,
  listProviders, enabledProviders, _clearProvidersForTests, OPENING_WINDOW_MS,
} = await import('../src/providers/playedPercentages.js');

const H = 3600e3;
// Sahte arşiv deposu (bulletin_data_observations sözleşmesi)
function memStore() {
  const rows = [];
  return {
    rows,
    async listObservations() { return rows.slice(); },
    async addObservations(bid, list) { for (const r of list) rows.push({ ...r, bulletinId: bid, matchId: r.matchId }); },
  };
}
const bulletin = (freezeInMs, now) => ({
  roundId: 1525,
  publishedAt: new Date(now - 2 * H).toISOString(),
  matches: [
    { no: 1, sportotoMatchId: 'm1', date: new Date(now + freezeInMs + 5 * 60e3).toISOString() }, // ilk maç
    { no: 2, sportotoMatchId: 'm2', date: new Date(now + freezeInMs + 2 * H).toISOString() },
  ],
});

test('1. Yüzde doğrulama: toplam ±2 tolerans; bozuk veri REDDEDİLİR', () => {
  assert.equal(validatePercentages({ '1': 33, X: 33, '2': 34 }).valid, true);
  assert.equal(validatePercentages({ '1': 33.4, X: 33.3, '2': 33.3 }).valid, true);
  assert.equal(validatePercentages({ '1': 40, X: 40, '2': 40 }).valid, false, 'toplam 120 → red');
  assert.equal(validatePercentages({ '1': 30, X: 30, '2': 30 }).valid, false, 'toplam 90 → red');
  assert.equal(validatePercentages({ '1': -5, X: 60, '2': 45 }).valid, false, 'negatif → red');
  assert.equal(validatePercentages({ '1': 'abc', X: 50, '2': 50 }).valid, false);
  assert.equal(validatePercentages(null).valid, false);
});

test('2. MÜHÜR KURALI: donma sonrası gözlem post_lock_research + tahmine kapalı', () => {
  const now = Date.now();
  const cls = classifyObservationKind({
    observedAtMs: now, publishedAtMs: now - 5 * H, freezeAtMs: now - 60e3, isFirstForProviderMatch: false,
  });
  assert.equal(cls.kind, 'post_lock_research');
  assert.equal(cls.usableForPrediction, false, 'kilit sonrası veri tahmine GİREMEZ');
});

test('3. Dürüst açılış: yayından ≤12sa ilk gözlem opening; geç başlayan takip first_observed_late', () => {
  const now = Date.now();
  const early = classifyObservationKind({
    observedAtMs: now, publishedAtMs: now - 2 * H, freezeAtMs: now + 24 * H, isFirstForProviderMatch: true,
  });
  assert.equal(early.kind, 'opening');
  assert.equal(early.firstObservedLate, false);
  const late = classifyObservationKind({
    observedAtMs: now, publishedAtMs: now - OPENING_WINDOW_MS - H, freezeAtMs: now + 24 * H, isFirstForProviderMatch: true,
  });
  assert.equal(late.kind, 'regular', 'geç ilk gözlem SAHTE opening yapılmaz');
  assert.equal(late.firstObservedLate, true);
});

test('4. Donmaya ≤10 dk kala gözlem pre_freeze işaretlenir', () => {
  const now = Date.now();
  const cls = classifyObservationKind({
    observedAtMs: now, publishedAtMs: now - 5 * H, freezeAtMs: now + 8 * 60e3, isFirstForProviderMatch: false,
  });
  assert.equal(cls.kind, 'pre_freeze');
  assert.equal(cls.usableForPrediction, true);
});

test('5. Gözlem turu: satırlar kind/usableForPrediction/hash ile yazılır', async () => {
  const now = Date.now();
  const store = memStore();
  const provider = {
    id: 'testprov', name: 'Test', enabled: true,
    async fetchPercentages() { return [{ matchNo: 'm1', pct: { '1': 50, X: 30, '2': 20 }, sourceMatchId: 'x9' }]; },
  };
  const res = await observePlayedPercentages({ bulletinData: bulletin(6 * H, now), store, now, providers: [provider], log: () => {} });
  assert.equal(res.written, 1);
  const row = store.rows[0];
  assert.equal(row.source, 'testprov');
  assert.equal(row.kind, 'opening');
  assert.equal(row.usableForPrediction, true);
  assert.equal(row.raw.sourceMatchId, 'x9', 'kaynak maç kimliği kanıt olarak saklanır');
  assert.ok(row.raw.rawHash, 'ham veri özeti saklanır');
});

test('6. Sağlayıcı İZOLASYONU: biri çökerse diğeri yazmaya devam eder', async () => {
  const now = Date.now();
  const store = memStore();
  const bad = { id: 'bozuk', name: 'Bozuk', enabled: true, async fetchPercentages() { throw new Error('site çöktü'); } };
  const good = { id: 'saglam', name: 'Sağlam', enabled: true, async fetchPercentages() { return [{ matchNo: 'm1', pct: { '1': 60, X: 25, '2': 15 } }]; } };
  const res = await observePlayedPercentages({ bulletinData: bulletin(6 * H, now), store, now, providers: [bad, good], log: () => {} });
  assert.equal(res.providers.bozuk.errors, 'site çöktü');
  assert.equal(res.providers.saglam.written, 1, 'sağlam sağlayıcı etkilenmedi');
  assert.equal(store.rows.length, 1);
});

test('7. Değişmeyen yüzde TEKRAR yazılmaz (zaman serisi şişmez)', async () => {
  // SABİT SAAT ŞART — Date.now() ile kırılgandı. Tekrar filtresi yalnız AYNI
  // GÜN içinde çalışır (shouldSkipAsDuplicate → dayKeyOf). Test +30 dakika
  // ileri gidiyor; gerçek saat 23:30'u geçtiyse bu sıçrama gece yarısını
  // aşıyor, iki gözlem AYRI GÜNE düşüyor ve tekrar sayılmıyordu. Test her
  // gece aynı yarım saatte kırmızı oluyordu (2026-08-01 23:48'de yakalandı).
  // Öğle vaktine sabitlenerek gün sınırından uzak durulur.
  const now = Date.UTC(2026, 6, 20, 10, 0, 0);
  const store = memStore();
  const p = { id: 'p1', name: 'P1', enabled: true, async fetchPercentages() { return [{ matchNo: 'm1', pct: { '1': 50, X: 30, '2': 20 } }]; } };
  await observePlayedPercentages({ bulletinData: bulletin(6 * H, now), store, now, providers: [p], log: () => {} });
  const res2 = await observePlayedPercentages({ bulletinData: bulletin(6 * H, now), store, now: now + 30 * 60e3, providers: [p], log: () => {} });
  assert.equal(res2.duplicates, 1);
  assert.equal(store.rows.length, 1, 'aynı değer ikinci satır üretmedi');
  assert.equal(isDuplicateOfLast({ playedPct: { '1': 50, X: 30, '2': 20 } }, { '1': 50, X: 30, '2': 20 }), true);
});

test('8. Bozuk yüzde satırı yazılmaz; sayaç invalid artar', async () => {
  const now = Date.now();
  const store = memStore();
  const p = { id: 'p1', name: 'P1', enabled: true, async fetchPercentages() { return [{ matchNo: 'm1', pct: { '1': 70, X: 40, '2': 30 } }]; } };
  const res = await observePlayedPercentages({ bulletinData: bulletin(6 * H, now), store, now, providers: [p], log: () => {} });
  assert.equal(res.invalid, 1);
  assert.equal(store.rows.length, 0);
});

test('9. summarizeSeries: post_lock hariç; geç başlangıçta opening=null + neden', () => {
  const t = (m) => new Date(Date.UTC(2026, 6, 20, 10, m)).toISOString();
  const freezeAtMs = Date.UTC(2026, 6, 20, 12, 0);
  const obs = [
    { playedPct: { '1': 50, X: 30, '2': 20 }, observedAt: t(0), kind: 'regular', firstObservedLate: true },
    { playedPct: { '1': 55, X: 28, '2': 17 }, observedAt: t(30), kind: 'regular' },
    { playedPct: { '1': 60, X: 25, '2': 15 }, observedAt: t(50), kind: 'pre_freeze' },
    { playedPct: { '1': 80, X: 15, '2': 5 }, observedAt: new Date(freezeAtMs + 60e3).toISOString(), kind: 'post_lock_research' },
  ];
  const s = summarizeSeries(obs, { freezeAtMs });
  assert.equal(s.opening, null, 'geç ilk gözlem opening SAYILMAZ');
  assert.equal(s.openingMissingReason, 'first_observed_late');
  assert.deepEqual(s.freeze.pct, { '1': 60, X: 25, '2': 15 }, 'kapanış = donma ÖNCESİ son gözlem (post_lock DEĞİL)');
  assert.equal(s.observationCount, 3);
  // Gerçek opening'li seri: delta hesaplanır
  const obs2 = [
    { playedPct: { '1': 40, X: 30, '2': 30 }, observedAt: t(0), kind: 'opening' },
    { playedPct: { '1': 52, X: 26, '2': 22 }, observedAt: t(40), kind: 'pre_freeze' },
  ];
  const s2 = summarizeSeries(obs2, { freezeAtMs });
  assert.deepEqual(s2.delta, { '1': 12, X: -4, '2': -8 }, 'açılış → kapanış hareketi');
});

test('10. Bilyoner adaptörü GERÇEK açık/oturumsuz kaynakla ETKİN + doğru sözleşme', () => {
  const bily = listProviders().find((p) => p.id === 'bilyoner');
  assert.ok(bily, 'Bilyoner kayıtlı');
  assert.equal(bily.enabled, true, 'doğrulanmış açık kaynak → etkin');
  assert.ok(enabledProviders().some((p) => p.id === 'bilyoner'));
  assert.match(bily.sourceUrl, /bilyoner\.com\/api\/sto/);
  assert.equal(bily.sourceType, 'bilyoner-sto-webapi');
  assert.ok(bily.parserVersion, 'parserVersion tanımlı');
  assert.equal(typeof bily.fetchPercentages, 'function');
});

test('11. Etkin sağlayıcı yokken gözlem turu sahte satır üretmez', async () => {
  const now = Date.now();
  const store = memStore();
  const res = await observePlayedPercentages({ bulletinData: bulletin(6 * H, now), store, now, providers: [], log: () => {} });
  assert.equal(res.written, 0);
  assert.equal(store.rows.length, 0, 'kaynak yoksa NÖTR %50 gibi uydurma satır YOK');
});

test('12. Radar 3 Oynanma DNA: gerçek seri → kullanıcı cümlesi + dürüst açılış + oran≠yüzde notu', async () => {
  const { computePublicBettingRadar } = await import('../src/radar/publicBettingRadar.js');
  const t = (min) => new Date(Date.UTC(2026, 6, 22, 8, min)).toISOString();
  // Açılış %63 → güncel %72 (ev), gerçek 'opening' işaretli seri.
  const series = [
    { providerId: 'bilyoner', providerName: 'Bilyoner', percentages: { '1': 63, X: 22, '2': 15 }, observedAt: t(0), kind: 'opening', firstObservedLate: false },
    { providerId: 'bilyoner', providerName: 'Bilyoner', percentages: { '1': 72, X: 17, '2': 11 }, observedAt: t(60), kind: 'regular', firstObservedLate: false },
  ];
  const r3 = computePublicBettingRadar({ no: 7 }, { matchPublicData: series, observedAt: t(60) });
  assert.equal(r3.hasData, true);
  const dna = r3.details.playedDna;
  assert.equal(dna.provider, 'Bilyoner');
  assert.match(dna.userSentence, /Bilyoner'de ev sahibi tercihi şu anda %72\. Açılışa göre \+9 puan yükseldi\./);
  assert.deepEqual(dna.opening, { '1': 63, X: 22, '2': 15, observedAt: t(0) });
  assert.equal(dna.current['1'], 72);
  assert.match(dna.note, /oran.*DEĞİLDİR/i);
  // Geçmiş yok → "sistem öğreniyor" (sahte başarı yüzdesi YOK)
  assert.equal(dna.similarDna.hasData, false);
  assert.match(dna.similarDna.note, /öğreniyor/);
});

test('13. Radar 3 Oynanma DNA: geç başlangıçta SAHTE açılış üretilmez', async () => {
  const { computePublicBettingRadar } = await import('../src/radar/publicBettingRadar.js');
  const t = (min) => new Date(Date.UTC(2026, 6, 22, 9, min)).toISOString();
  const series = [
    { providerId: 'bilyoner', providerName: 'Bilyoner', percentages: { '1': 70, X: 18, '2': 12 }, observedAt: t(0), kind: 'regular', firstObservedLate: true },
    { providerId: 'bilyoner', providerName: 'Bilyoner', percentages: { '1': 71, X: 18, '2': 11 }, observedAt: t(30), kind: 'pre_freeze', firstObservedLate: false },
  ];
  const r3 = computePublicBettingRadar({ no: 3 }, { matchPublicData: series, observedAt: t(30) });
  const dna = r3.details.playedDna;
  assert.equal(dna.opening, null, 'geç başlangıçta açılış null');
  assert.equal(dna.openingMissingReason, 'first_observed_late');
  assert.match(dna.userSentence, /Açılış anı kaçırıldığından/);
});

test('14. Radar 3 Oynanma DNA: yeterli geçmişte benzer sonuç cümlesi üretir', async () => {
  const { computePublicBettingRadar } = await import('../src/radar/publicBettingRadar.js');
  const t = (min) => new Date(Date.UTC(2026, 6, 22, 8, min)).toISOString();
  const series = [{ providerId: 'bilyoner', providerName: 'Bilyoner', percentages: { '1': 72, X: 17, '2': 11 }, observedAt: t(0), kind: 'opening', firstObservedLate: false }];
  // 12 doğrulanmış benzer kayıt (bilyoner + 7. sıra + %70-74 bandı): 6×1, 3×X, 3×2
  const rec = (result) => ({ provider: 'bilyoner', position: 7, result, favoriteSymbol: '1', closePct: { '1': 72, X: 17, '2': 11 } });
  const pctDnaRecords = [
    ...Array.from({ length: 6 }, () => rec('1')),
    ...Array.from({ length: 3 }, () => rec('X')),
    ...Array.from({ length: 3 }, () => rec('2')),
  ];
  const r3 = computePublicBettingRadar({ no: 7 }, { matchPublicData: series, observedAt: t(0), pctDnaRecords });
  const sim = r3.details.playedDna.similarDna;
  assert.equal(sim.hasData, true);
  assert.equal(sim.sample, 12);
  assert.match(sim.sentence, /Benzer 12 doğrulanmış maçta sonuçlar: 1 %50 · X %25 · 2 %25/);
});
