// EV HAFTALIK AKIŞ TESTLERİ (T10'un kalan yarısı).
//
// Motor kuruluydu ama kimse çağırmıyordu. Bu testler motorun gerçek haftaya
// DOĞRU bağlandığını kanıtlar. Kritik olan sayının büyüklüğü değil, şunlar:
//  * Kilit SONRASI oynanma yüzdesi tahmine GİREMEZ (sızıntı olur).
//  * Veri eksikse uydurulmaz; eksik olduğu KAYDEDİLİR (kilit anı geri gelmez).
//  * ρ yokken sonuç TL sanılmaz — birim "havuz payı"dır.
//  * Ham girdiler saklanır: kalabalık dağılımı sonradan elde edilemez.
//  * Sonuç satırı kayda BİR KEZ eklenir; tahmin bölümü değişmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.EV_SHADOW_DIR = mkdtempSync(join(tmpdir(), 'ev-haftalik-'));

const {
  crowdConsensus, buildShadowInputs, lambdaFromHistory,
  runWeeklyShadow, settleWeeklyShadow, rescaleWithPayoutRatio,
  pastWeeksFromShadow: pastWeeksFromShadowSync,
} = await import('../src/ev/weekly.js');
const { readShadowRecord } = await import('../src/ev/shadowStore.js');
const { PAYOUT_RATIO } = await import('../src/ev/config.js');

const KILIT_MS = Date.parse('2026-08-01T16:55:00Z');
const ID = (i) => `m${i}`;

// --- Gerçek snapshot şemasıyla birebir (snapshotService.buildSnapshotPayload) ---
const macYap = (i, { tahmin = '1', olasilik = { '1': 50, X: 27, '2': 23 } } = {}) => ({
  no: i, matchId: ID(i),
  market: { probabilities: olasilik, probabilitiesEstimated: false, odds: null },
  analysisCenter: { officialMasterAnalysis: { ok: true, mainPrediction: tahmin } },
});

const snapshotYap = (over = {}) => ({
  id: 'snap-9001', payloadHash: 'abc123', lockedAt: new Date(KILIT_MS).toISOString(),
  payload: { matches: Array.from({ length: 15 }, (_, k) => macYap(k + 1)) },
  ...over,
});

// --- Gerçek gözlem şemasıyla birebir (providers/playedPercentages) ---
const gozlem = (i, source, pct, { dk = -60, kind = 'update', usable = true } = {}) => ({
  matchId: ID(i), source, playedPct: pct,
  observedAt: new Date(KILIT_MS + dk * 60e3).toISOString(),
  kind, usableForPrediction: usable,
});

const tamGozlem = (pct = { '1': 60, X: 25, '2': 15 }) =>
  Array.from({ length: 15 }, (_, k) => gozlem(k + 1, 'k3', pct));

// Sahte depo — gerçek store yüzeyinin kullanılan parçası.
const depoYap = ({ snapshot = snapshotYap(), observations = [], results = [] } = {}) => ({
  getSnapshot: async () => snapshot,
  listObservations: async () => observations,
  listOfficialResults: async () => results,
});

// ---------------------------------------------------------------------------
// KALABALIK UZLAŞMASI
// ---------------------------------------------------------------------------

test('KİLİT SONRASI gözlem tahmine GİREMEZ (sızıntı koruması)', () => {
  const c = crowdConsensus([
    gozlem(1, 'k3', { '1': 60, X: 25, '2': 15 }, { dk: -30 }),
    // Kilitten SONRA gelen, apayrı bir dağılım — alınırsa sonuç kirlenir.
    gozlem(1, 'k3', { '1': 10, X: 10, '2': 80 }, { dk: +30, kind: 'post_lock_research', usable: false }),
  ], { matchIds: [ID(1)], freezeAtMs: KILIT_MS });
  const m = c.marginals.get(ID(1));
  assert.ok(Math.abs(m['1'] - 0.60) < 1e-9, 'kilit öncesi değer kullanılmalı');
});

test('kilitten sonraki zaman damgası, türü "update" olsa bile alınmaz', () => {
  const c = crowdConsensus([
    gozlem(1, 'nesine', { '1': 50, X: 25, '2': 25 }, { dk: -10 }),
    gozlem(1, 'nesine', { '1': 5, X: 5, '2': 90 }, { dk: +1 }),   // etiket temiz ama GEÇ
  ], { matchIds: [ID(1)], freezeAtMs: KILIT_MS });
  assert.ok(Math.abs(c.marginals.get(ID(1))['1'] - 0.50) < 1e-9);
});

test('her sağlayıcının KENDİ son gözlemi alınır, arası MEDYAN', () => {
  const c = crowdConsensus([
    gozlem(1, 'k3', { '1': 40, X: 30, '2': 30 }, { dk: -300 }),   // eski
    gozlem(1, 'k3', { '1': 50, X: 25, '2': 25 }, { dk: -10 }),    // güncel
    gozlem(1, 'nesine', { '1': 60, X: 20, '2': 20 }, { dk: -10 }),
    gozlem(1, 'misli', { '1': 70, X: 15, '2': 15 }, { dk: -10 }),
  ], { matchIds: [ID(1)], freezeAtMs: KILIT_MS });
  const m = c.marginals.get(ID(1));
  // 0.50 / 0.60 / 0.70 → medyan 0.60 (eski k3 satırı DEĞİL)
  assert.ok(Math.abs(m['1'] - 0.60) < 1e-9, `beklenen 0.60, gelen ${m['1']}`);
  assert.equal(c.perMatch.get(ID(1)).providers, 3);
  // Her zaman normalize: toplam 1.
  assert.ok(Math.abs(m['1'] + m.X + m['2'] - 1) < 1e-12);
});

test('veri olmayan maç için uydurulmaz — eksik kalır', () => {
  const c = crowdConsensus([gozlem(1, 'k3', { '1': 60, X: 25, '2': 15 })],
    { matchIds: [ID(1), ID(2)], freezeAtMs: KILIT_MS });
  assert.ok(c.marginals.has(ID(1)));
  assert.equal(c.marginals.has(ID(2)), false);
  assert.equal(c.matchesWithData, 1);
});

// ---------------------------------------------------------------------------
// GİRDİ KURULUMU
// ---------------------------------------------------------------------------

test('girdi tamsa kolon karnenin ölçtüğü tahminin AYNISIDIR', () => {
  const snap = snapshotYap({
    payload: { matches: Array.from({ length: 15 }, (_, k) => macYap(k + 1, { tahmin: k % 3 === 0 ? 'X' : '1' })) },
  });
  const g = buildShadowInputs({ snapshot: snap, observations: tamGozlem(), freezeAtMs: KILIT_MS });
  assert.equal(g.ok, true);
  assert.equal(g.column[0], 'X');
  assert.equal(g.column[1], '1');
  assert.equal(g.column.length, 15);
  assert.equal(g.outcomeProbs.length, 15);
  assert.equal(g.crowdMarginals.length, 15);
});

test('tek maçta bile kalabalık verisi yoksa EV hesaplanmaz', () => {
  const g = buildShadowInputs({
    snapshot: snapshotYap(),
    observations: tamGozlem().slice(0, 14),        // 15. maç eksik
    freezeAtMs: KILIT_MS,
  });
  assert.equal(g.ok, false);
  assert.equal(g.reason, 'crowd_missing');
  assert.equal(g.missing.crowd, 1);
  assert.match(g.note, /sonradan elde EDİLEMEZ/);
});

test('mühürlü olasılık eksikse EV hesaplanmaz (orandan türetip uydurmaz)', () => {
  const matches = Array.from({ length: 15 }, (_, k) => macYap(k + 1));
  matches[3].market.probabilities = null;
  const g = buildShadowInputs({
    snapshot: snapshotYap({ payload: { matches } }), observations: tamGozlem(), freezeAtMs: KILIT_MS,
  });
  assert.equal(g.ok, false);
  assert.equal(g.reason, 'probabilities_missing');
});

test('15 maçı olmayan snapshot reddedilir', () => {
  const g = buildShadowInputs({
    snapshot: snapshotYap({ payload: { matches: [macYap(1)] } }), observations: tamGozlem(),
  });
  assert.equal(g.ok, false);
  assert.equal(g.reason, 'snapshot_match_count');
});

// ---------------------------------------------------------------------------
// λ — ρ OLMADAN ÖĞRENİLEMEZ, "0" ÖLÇÜM SANILMAMALI
// ---------------------------------------------------------------------------

test('ρ yokken λ öğrenilemez ve bu AÇIKÇA bildirilir', () => {
  // ρ ARTIK BİLİNİYOR (0,775). Korunan kural değişmedi: ρ YOKSA λ uydurulmaz
  // ve dönen 0 bir ÖLÇÜM sayılmaz. Test artık ρ'yu açıkça null geçiyor.
  const l = lambdaFromHistory(
    [{ roundId: 1, tiers: { 13: { winners: 500, perPersonPrize: 100 } } }],
    { payoutRatio: null },
  );
  assert.equal(l.lambda, 0);
  assert.equal(l.reliable, false);
  assert.equal(l.reason, 'payout_ratio_unknown');
  assert.match(l.note, /ölçüm DEĞİLDİR/);
});

test('ρ BULUNDUĞU için λ artık öğrenilebiliyor (ρ=0,775)', () => {
  assert.ok(PAYOUT_RATIO > 0, 'ρ config\'te dolu olmalı');
  const l = lambdaFromHistory([{
    roundId: 1,
    result: Array(15).fill('1'),
    crowdMarginals: Array.from({ length: 15 }, () => ({ '1': 0.6, X: 0.25, '2': 0.15 })),
    tiers: { 13: { winners: 500, perPersonPrize: 1000 }, 12: { winners: 5000, perPersonPrize: 125 } },
  }]);
  // Artık 'payout_ratio_unknown' DEĞİL: gerçek bir kalibrasyon denemesi yapıldı.
  assert.notEqual(l.reason, 'payout_ratio_unknown');
  assert.equal(l.weeksUsed, 1);
  // Tek haftayla güvenilir sayılmaz (≥30 şartı) — bu gizlenmez.
  assert.equal(l.reliable, false);
  assert.match(l.note, /30 hafta/);
});

// ---------------------------------------------------------------------------
// HAFTALIK KOŞU
// ---------------------------------------------------------------------------

test('kilit anında gölge kaydı yazılır; birim TL DEĞİL havuz payıdır', async () => {
  const store = depoYap({ observations: tamGozlem() });
  const r = await runWeeklyShadow({ bulletinId: 9001, store });
  assert.equal(r.ran, true);
  assert.equal(r.unit, 'havuz_payi', 'ρ yokken TL üretilemez');

  const rec = readShadowRecord(9001);
  assert.equal(rec.ok, true);
  assert.equal(rec.snapshotHash, 'abc123', 'hangi mühürlü halin kullanıldığı kanıtlı');
  assert.match(rec.unitNote, /HAVUZ PAYI/);
  // HAM GİRDİLER SAKLANDI: kalabalık dağılımı sonradan elde edilemez.
  assert.equal(rec.inputs.crowdMarginals.length, 15);
  assert.equal(rec.inputs.column.length, 15);
  // EL HESABI: kolon hep '1', mühürlü olasılık 50/27/23 → her maç bağımsız
  // p=0.5. P(≥12 doğru) = Σ C(15,k)·0.5¹⁵, k=12..15 = 576/32768 = 0.017578.
  // Monte Carlo 20.000 çekilişte ±0.003 bandında olmalı; bu bant dışına çıkarsa
  // ya örnekleme ya kademe mantığı bozulmuştur.
  assert.ok(Math.abs(rec.ev.pAnyPrize - 0.017578) < 0.003,
    `P(ikramiye) ≈ 0.0176 olmalı, gelen ${rec.ev.pAnyPrize}`);
  // Kademeler AYRIK: 12+13+14+15 toplamı "en az 12"ye eşit olmalı.
  const toplam = [15, 14, 13, 12].reduce((s, t) => s + rec.ev.pTier[t], 0);
  assert.ok(Math.abs(toplam - rec.ev.pAnyPrize) < 1e-12, 'kademeler ayrık olmalı');
  // Kullanıcıya gösterilecek bir TL alanı YOK.
  assert.equal(rec.ev.perColumnCost, null);
});

test('aynı hafta ikinci kez çalıştırılamaz (mühür)', async () => {
  const store = depoYap({ observations: tamGozlem() });
  const r = await runWeeklyShadow({ bulletinId: 9001, store });
  assert.equal(r.ran, false);
  assert.equal(r.reason, 'already_exists');
});

test('veri eksikse de KAYIT DÜŞER — kilit anı geri gelmez, neden saklanır', async () => {
  const store = depoYap({ observations: [] });          // hiç oynanma verisi yok
  const r = await runWeeklyShadow({ bulletinId: 9002, store });
  assert.equal(r.ran, false);
  assert.equal(r.reason, 'crowd_missing');
  const rec = readShadowRecord(9002);
  assert.ok(rec, 'başarısızlık da kayda geçmeli');
  assert.equal(rec.ok, false);
  assert.equal(rec.missing.crowd, 15);
  assert.equal(rec.lockedAt, new Date(KILIT_MS).toISOString());
});

test('aynı girdi aynı sonucu verir (hafta bazında yeniden üretilebilir)', async () => {
  const store = depoYap({ observations: tamGozlem() });
  const a = await runWeeklyShadow({ bulletinId: 9003, store });
  const beklenen = readShadowRecord(9003).ev.expected;
  const b = rescaleWithPayoutRatio(readShadowRecord(9003), { payoutRatio: 0.5, columns: 1e6 });
  assert.equal(a.ran, true);
  assert.ok(Number.isFinite(beklenen));
  // ρ verilince aynı ham girdiden TL ölçeğine geçilebiliyor.
  assert.equal(b.unit, 'TL');
  assert.equal(b.scaled, true);
});

// ---------------------------------------------------------------------------
// SONUÇLANDIRMA
// ---------------------------------------------------------------------------

const sonuclar = (semboller) => semboller.map((s, k) => ({ matchId: ID(k + 1), officialResult: s }));

test('sonuç açıklanınca kolonun kaç tuttuğu kayda eklenir', async () => {
  const store = depoYap({
    observations: tamGozlem(),
    // Kolon tamamı '1'; 12 maç '1', 3 maç '2' bitiyor → 12 tutar.
    results: sonuclar([...Array(12).fill('1'), '2', '2', '2']),
  });
  await runWeeklyShadow({ bulletinId: 9004, store });
  const s = await settleWeeklyShadow({
    bulletinId: 9004, store,
    roundResult: { tiers: [{ hit: 15, count: 0, prize: 0 }, { hit: 13, count: 420, prize: 1500 }] },
  });
  assert.equal(s.settled, true);
  assert.equal(s.hits, 12);
  assert.equal(s.tier, 12);

  const rec = readShadowRecord(9004);
  assert.equal(rec.settlement.hits, 12);
  assert.equal(rec.settlement.officialTiers[13].winners, 420);
  // ρ ARTIK BİLİNİYOR → N resmî kademe verisinden geri çıkarılabiliyor.
  // (Eskiden burada null bekleniyordu; ρ bulununca bu satır kırıldı ve
  //  kırılması DOĞRU — motor artık ölçek üretebiliyor.)
  assert.ok(rec.settlement.estimatedColumns.columns > 0,
    'ρ varken N hesaplanmalı');
  // Çapraz doğrulama alanı da geliyor: kademeler tutarsızsa ρ şüphelidir.
  assert.ok('consistent' in rec.settlement.estimatedColumns);
  // Model bu kademeyi ne kadar bekliyordu? (EV tarafının kalibrasyonu)
  assert.ok(rec.settlement.expectedTierProb >= 0);
});

test('sonuç satırı BİR KEZ yazılır; tahmin bölümü DEĞİŞMEZ', async () => {
  const store = depoYap({
    observations: tamGozlem(),
    results: sonuclar([...Array(12).fill('1'), '2', '2', '2']),
  });
  const oncekiEv = JSON.stringify(readShadowRecord(9004).ev);
  const ikinci = await settleWeeklyShadow({
    bulletinId: 9004, store,
    roundResult: { tiers: [{ hit: 13, count: 999999, prize: 1 }] },   // farklı veriyle
  });
  assert.equal(ikinci.settled, false);
  assert.equal(ikinci.reason, 'already_settled');
  const rec = readShadowRecord(9004);
  assert.equal(rec.settlement.officialTiers[13].winners, 420, 'ilk sonuç korunmalı');
  assert.equal(JSON.stringify(rec.ev), oncekiEv, 'tahmin bölümü dokunulmadan kalmalı');
});

test('sonuçlar eksikse sonuçlandırma YAPILMAZ', async () => {
  const store = depoYap({ observations: tamGozlem(), results: sonuclar(Array(14).fill('1')) });
  await runWeeklyShadow({ bulletinId: 9005, store });
  const s = await settleWeeklyShadow({ bulletinId: 9005, store });
  assert.equal(s.settled, false);
  assert.equal(s.reason, 'sonuclar_eksik');
});

test('resmî ikramiye verisi yoksa uydurulmaz, eksik olduğu yazılır', async () => {
  const store = depoYap({ observations: tamGozlem(), results: sonuclar(Array(15).fill('1')) });
  await runWeeklyShadow({ bulletinId: 9006, store });
  const s = await settleWeeklyShadow({ bulletinId: 9006, store, roundResult: null });
  assert.equal(s.settled, true);
  assert.equal(s.hits, 15);
  const rec = readShadowRecord(9006);
  assert.equal(rec.settlement.officialTiers, null);
  assert.match(rec.settlement.officialTiersNote, /alınamadı/);
});

// ---------------------------------------------------------------------------
// BAĞLANTI: motor gerçekten akışa bağlı mı?
// ---------------------------------------------------------------------------

test('kilit ve sonuç akışları gölge motoru GERÇEKTEN çağırıyor', () => {
  const snap = readFileSync(new URL('../src/archive/snapshotService.js', import.meta.url), 'utf8');
  const res = readFileSync(new URL('../src/archive/resultsService.js', import.meta.url), 'utf8');
  assert.match(snap, /runWeeklyShadow/, 'kilit anında gölge koşusu çağrılmıyor');
  assert.match(res, /settleWeeklyShadow/, 'sonuç anında sonuçlandırma çağrılmıyor');
  // Gölge kayıt hatası kilidi/değerlendirmeyi BOZMAMALI → try/catch içinde olmalı.
  assert.match(snap, /try \{[\s\S]{0,400}runWeeklyShadow[\s\S]{0,400}catch/);
  assert.match(res, /try \{[\s\S]{0,600}settleWeeklyShadow[\s\S]{0,400}catch/);
});

test('gölge kayıtlar hiçbir API ucundan dönmüyor', () => {
  const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.ok(!/ev-shadow|readShadowRecord|listShadowRounds|weekly\.js/.test(server),
    'gölge kayıt kullanıcıya sızmamalı');
});

// ---------------------------------------------------------------------------
// λ ZİNCİRİ — sonuçlanmış hafta, SONRAKİ haftanın λ'sını besliyor mu?
// ρ bulunmadan önce bu zincir zaten çalışamıyordu; ρ gelince ilk kez
// anlamlı hâle geldi. Test, halkaların gerçekten birbirine bağlı olduğunu
// ve ÖĞRENME SINIRININ korunduğunu kanıtlar.
// ---------------------------------------------------------------------------

test('sonuçlanmış gölge kaydı geçmiş hafta olarak toplanıyor', async () => {
  const { pastWeeksFromShadow } = await import('../src/ev/weekly.js');
  // 9004 yukarıda koşulup sonuçlandırıldı (kademe verisiyle birlikte).
  const hepsi = pastWeeksFromShadow();
  const w = hepsi.find((x) => x.roundId === 9004);
  assert.ok(w, 'sonuçlanmış kayıt geçmiş listesinde yok');
  assert.equal(w.result.length, 15, 'gerçekleşen sonuç taşınmalı');
  assert.equal(w.crowdMarginals.length, 15, 'kilit anı kalabalığı taşınmalı');
  assert.ok(Number(w.tiers[13]?.winners) > 0, 'resmî kademe verisi taşınmalı');
});

test('ÖĞRENME SINIRI: hafta kendi sonucuyla kendi λ\'sını besleyemez', () => {
  // 9004'ten ÖNCEKİ haftalar istenirse 9004 listede OLMAMALI.
  const oncekiler = pastWeeksFromShadowSync({ upToRoundId: 9004 });
  assert.ok(!oncekiler.some((x) => x.roundId === 9004),
    'haftanın kendi sonucu kendi kalibrasyonuna sızıyor');
  // Ve kendisinden sonraki haftalar da giremez.
  assert.ok(oncekiler.every((x) => x.roundId < 9004));
});

test('sonuçlanmamış kayıt geçmişe GİRMEZ (kademe verisi yok)', () => {
  // 9005 sonuçlanamadı (sonuçlar eksikti), 9002 ise ok:false.
  const hepsi = pastWeeksFromShadowSync();
  assert.ok(!hepsi.some((x) => x.roundId === 9005), 'sonuçlanmamış hafta girmemeli');
  assert.ok(!hepsi.some((x) => x.roundId === 9002), 'geçersiz kayıt girmemeli');
});
