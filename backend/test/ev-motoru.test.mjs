// HAVUZ EV MOTORU TESTLERİ (T10) — matematik EL HESABIYLA doğrulanır.
//
// Bu motorun çıktısı para hesabıdır; sessiz bir hata "kazanç" gibi görünen
// yanlış bir sayı üretir. Bu yüzden her parça bilinen değerlerle sınanır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync as oku, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.EV_SHADOW_DIR = mkdtempSync(join(tmpdir(), 'ev-shadow-'));

const {
  poissonBinomialPmf, tiltMarginal, expectedInverseWinners, afterTax,
  makeRng, sampleOutcome, quantile, assertMatchCount,
} = await import('../src/ev/math.js');
const {
  estimateColumnsFromWinners, poolsOf, evaluateColumn, calibrateLambda,
} = await import('../src/ev/engine.js');
const {
  writeShadowRecord, readShadowRecord, listShadowRounds, SHADOW_DIR,
} = await import('../src/ev/shadowStore.js');
const {
  TIER_SHARES, TIERS, PAYOUT_RATIO, TAX_EXEMPTION_TL, TAX_RATE, engineReadiness,
} = await import('../src/ev/config.js');

const here = dirname(fileURLToPath(import.meta.url));
const yakin = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b} olmalı`);
const esitMarj = () => ({ '1': 1 / 3, X: 1 / 3, '2': 1 / 3 });
const kolon = (s) => Array.from({ length: 15 }, () => s);
const marj15 = (m) => Array.from({ length: 15 }, () => ({ ...m }));

// ——— Poisson-binom ———
test('Poisson-binom: eşit olasılıkta binom ile birebir aynı', () => {
  const p = 0.3, n = 15;
  const pmf = poissonBinomialPmf(Array(n).fill(p));
  const binom = (k) => {
    let c = 1;
    for (let i = 0; i < k; i += 1) c = (c * (n - i)) / (i + 1);
    return c * p ** k * (1 - p) ** (n - k);
  };
  for (const k of [0, 3, 7, 12, 15]) yakin(pmf[k], binom(k), 1e-12);
});

test('Poisson-binom: farklı olasılıklarda toplam 1; kesin olaylar doğru', () => {
  const pmf = poissonBinomialPmf([0.1, 0.5, 0.9, 0.25]);
  yakin(pmf.reduce((a, b) => a + b, 0), 1, 1e-12);
  yakin(poissonBinomialPmf([1, 1, 1])[3], 1, 1e-12);
  yakin(poissonBinomialPmf([0, 0, 0])[0], 1, 1e-12);
  // El hesabı: p=(0.5,0.5) → P(1 doğru) = 0.5
  yakin(poissonBinomialPmf([0.5, 0.5])[1], 0.5, 1e-12);
});

// ——— Kalabalık keskinleştirme ———
test('tilt: λ=0 gözlenen yüzdeleri DEĞİŞTİRMEZ (bağımsızlık varsayımı)', () => {
  const t = tiltMarginal({ '1': 60, X: 25, '2': 15 }, 0);
  yakin(t['1'], 0.6, 1e-12); yakin(t.X, 0.25, 1e-12); yakin(t['2'], 0.15, 1e-12);
});

test('tilt: λ>0 kalabalığı favoriye yığar; toplam daima 1', () => {
  const t = tiltMarginal({ '1': 60, X: 25, '2': 15 }, 1);
  yakin(t['1'] + t.X + t['2'], 1, 1e-12);
  assert.ok(t['1'] > 0.6, 'favori payı artmalı');
  assert.ok(t['2'] < 0.15, 'zayıf seçeneğin payı azalmalı');
});

test('tilt: eşit dağılımda λ ne olursa olsun eşit kalır', () => {
  const t = tiltMarginal(esitMarj(), 1.5);
  yakin(t['1'], 1 / 3, 1e-12);
});

test('tilt: geçersiz girdide null (uydurma yok)', () => {
  assert.equal(tiltMarginal(null, 0), null);
  assert.equal(tiltMarginal({ '1': 0, X: 0, '2': 0 }, 0), null);
});

// ——— Paylaşım ve vergi ———
test('E[1/(1+W)]: μ→0 iken 1 (kimse yok, havuzun tamamı); büyük μ için ~1/μ', () => {
  yakin(expectedInverseWinners(0), 1);
  yakin(expectedInverseWinners(1), (1 - Math.exp(-1)) / 1, 1e-12);
  const buyuk = expectedInverseWinners(100);
  assert.ok(buyuk > 0 && buyuk < 0.011, 'çok kazanan varsa pay küçülür');
});

test('vergi: istisna altı vergisiz; üstü yalnız AŞAN kısımdan kesilir', () => {
  yakin(afterTax(50000, { rate: TAX_RATE, exemption: TAX_EXEMPTION_TL }), 50000);
  // 100.000 TL: istisna 66.935 + (33.065 × 0.80) = 66.935 + 26.452 = 93.387
  yakin(afterTax(100000, { rate: TAX_RATE, exemption: TAX_EXEMPTION_TL }), 66935 + 33065 * 0.8, 1e-9);
});

// ——— Rastgelelik: yeniden üretilebilirlik ———
test('rng tohumlu: aynı tohum aynı diziyi üretir (gölge kayıt denetlenebilir)', () => {
  const a = makeRng(42), b = makeRng(42), c = makeRng(43);
  const dizi = (r) => Array.from({ length: 5 }, () => r());
  assert.deepEqual(dizi(a), dizi(b), 'aynı tohum = aynı sonuç');
  assert.notDeepEqual(dizi(makeRng(42)), dizi(c));
});

test('sampleOutcome: uzun vadede olasılıklara yakınsar', () => {
  const rng = makeRng(7);
  const sayac = { '1': 0, X: 0, '2': 0 };
  for (let i = 0; i < 30000; i += 1) sayac[sampleOutcome({ '1': 0.5, X: 0.3, '2': 0.2 }, rng)] += 1;
  assert.ok(Math.abs(sayac['1'] / 30000 - 0.5) < 0.02);
  assert.ok(Math.abs(sayac['2'] / 30000 - 0.2) < 0.02);
});

test('assertMatchCount: 15 dışı uzunluk sessizce geçmez', () => {
  assert.throws(() => assertMatchCount([1, 2, 3], 'kolon'), /15 maç bekleniyor/);
});

// ——— N geri çıkarımı ———
test('N geri çıkarımı: ρ bilinmiyorsa hesaplanmaz (uydurma yok)', () => {
  // ρ ARTIK BİLİNİYOR (0,775 — bkz. ev-rho.test.mjs). Bu testin koruduğu
  // davranış hâlâ geçerli: ρ YOKSA N uydurulmaz. Eskiden bunu config'in
  // null olmasına dayanarak sınıyordu; config dolunca test kırıldı — oysa
  // kural değişmedi. Artık ρ AÇIKÇA null geçiliyor, config'e bağlı değil.
  const r = estimateColumnsFromWinners(
    { 13: { winners: 100, perPersonPrize: 500 } },
    { payoutRatio: null },
  );
  assert.equal(r.columns, null);
  assert.equal(r.reason, 'payout_ratio_unknown');
  assert.match(r.note, /Müşterek Oyun Planı/);
});

test('N geri çıkarımı: config ρ değeri artık DOLU — ölçek üretilebiliyor', () => {
  assert.ok(PAYOUT_RATIO > 0, 'ρ bulundu (0,775); null kalmamalı');
  const r = estimateColumnsFromWinners({ 13: { winners: 100, perPersonPrize: 500 } });
  assert.ok(r.columns > 0, 'ρ varken N hesaplanabilmeli');
});

test('N geri çıkarımı: ρ verilirse el hesabıyla doğru; kademeler çapraz doğrulanır', () => {
  // N = 1.000.000, ρ=0.5, fiyat=10 → Havuz_13 = 0.5·10·1e6·0.20 = 1.000.000 TL
  // 100 kazanan → kişi başı 10.000 TL
  const r = estimateColumnsFromWinners(
    { 13: { winners: 100, perPersonPrize: 10000 }, 12: { winners: 1000, perPersonPrize: 1250 } },
    { payoutRatio: 0.5, columnPrice: 10 },
  );
  assert.equal(r.columns, 1000000);
  assert.equal(r.consistent, true, 'iki kademe aynı N vermeli');
});

test('N geri çıkarımı: kademeler tutarsızsa ρ şüphesi bildirilir', () => {
  const r = estimateColumnsFromWinners(
    { 13: { winners: 100, perPersonPrize: 10000 }, 12: { winners: 1000, perPersonPrize: 5000 } },
    { payoutRatio: 0.5, columnPrice: 10 },
  );
  assert.equal(r.consistent, false);
  assert.match(r.note, /tutarsız/);
});

// ——— Havuzlar ———
test('havuzlar: ρ yoksa ölçeksiz; devir yine de taşınır', () => {
  const yok = poolsOf({ columns: 1e6, payoutRatio: null });
  assert.equal(yok.scaled, false);
  const devirli = poolsOf({ columns: 1e6, payoutRatio: null, rollover: { 15: 5000000 } });
  assert.equal(devirli.pools[15], 5000000, 'devreden tutar bilinen bir sayıdır');
});

test('havuzlar: ρ varsa paylar %35/%20/%20/%25 ile birebir', () => {
  const { pools, scaled } = poolsOf({ columns: 1e6, payoutRatio: 0.5, columnPrice: 10 });
  assert.equal(scaled, true);
  const toplam = 0.5 * 10 * 1e6;                    // 5.000.000 TL
  for (const t of TIERS) yakin(pools[t], toplam * TIER_SHARES[t], 1e-6);
  yakin(TIERS.reduce((s, t) => s + pools[t], 0), toplam, 1e-6);
});

// ——— EV motoru ———
test('EV: kademeler AYRIK — "en az k" sayılmaz (aksi hâlde ~%25 şişer)', () => {
  // Kolon 15/15 tutarsa yalnız 15 kademesinden ödeme alır; 14/13/12 de sayılmaz.
  const r = evaluateColumn({
    column: kolon('1'),
    outcomeProbs: marj15({ '1': 1, X: 0, '2': 0 }),   // sonuç kesin '1'
    crowdMarginals: marj15(esitMarj()),
    columns: 1000,
    pools: { 15: 1000, 14: 1000, 13: 1000, 12: 1000 },
    draws: 200,
  });
  assert.equal(r.pTier[15], 1, 'her turda 15 tutmalı');
  assert.equal(r.pTier[14], 0, 'aynı anda 14 kademesi de sayılamaz');
  assert.equal(r.pTier[13], 0);
  assert.equal(r.pTier[12], 0);
});

test('EV: 12 altı tutturmada ödeme YOK', () => {
  const r = evaluateColumn({
    column: kolon('1'),
    outcomeProbs: marj15({ '1': 0, X: 1, '2': 0 }),   // hepsi X → 0 doğru
    crowdMarginals: marj15(esitMarj()),
    columns: 1000,
    pools: { 15: 1000, 14: 1000, 13: 1000, 12: 1000 },
    draws: 100,
  });
  assert.equal(r.pAnyPrize, 0);
  assert.equal(r.expected, 0);
});

test('EV: kalabalık az oynadığı kolonda pay BÜYÜK olur (parimütüel çekirdek)', () => {
  const sonuc = marj15({ '1': 1, X: 0, '2': 0 });       // sonuç kesin '1'
  const ortak = { column: kolon('1'), outcomeProbs: sonuc, columns: 100000, pools: { 15: 1e6, 14: 0, 13: 0, 12: 0 }, draws: 60 };
  // Kalabalık da '1' diyor → çok ortak → küçük pay
  const kalabalikAyni = evaluateColumn({ ...ortak, crowdMarginals: marj15({ '1': 0.9, X: 0.05, '2': 0.05 }) });
  // Kalabalık '2' diyor → az ortak → büyük pay
  const kalabalikTers = evaluateColumn({ ...ortak, crowdMarginals: marj15({ '1': 0.05, X: 0.05, '2': 0.9 }) });
  assert.ok(kalabalikTers.expected > kalabalikAyni.expected * 5,
    `az oynanan kolon çok daha fazla kazandırmalı (${kalabalikTers.expected} vs ${kalabalikAyni.expected})`);
});

test('EV: ρ yokken TL değil "havuz payı" birimi döner (sahte TL üretilmez)', () => {
  const r = evaluateColumn({
    column: kolon('1'),
    outcomeProbs: marj15({ '1': 1, X: 0, '2': 0 }),
    crowdMarginals: marj15(esitMarj()),
    columns: null, pools: null, draws: 50,
  });
  assert.equal(r.scaled, false);
  assert.equal(r.unit, 'havuz_payi');
  assert.equal(r.perColumnCost, null);
});

test('EV: dürüstlük notu her çıktıda var; medyan tipik olarak 0', () => {
  const r = evaluateColumn({
    column: kolon('1'),
    outcomeProbs: marj15({ '1': 0.45, X: 0.27, '2': 0.28 }),
    crowdMarginals: marj15({ '1': 0.5, X: 0.3, '2': 0.2 }),
    columns: 1000000, pools: { 15: 1e7, 14: 5e6, 13: 5e6, 12: 6e6 }, draws: 3000,
  });
  assert.match(r.honestNote, /kazanç garantisi değildir/);
  assert.equal(r.median, 0, '15 maçta 12+ tutturmak nadirdir — medyan sonuç sıfırdır');
  assert.ok(r.pAnyPrize < 0.05, 'herhangi bir ikramiye olasılığı çok düşük olmalı');
});

test('EV: aynı tohum aynı sonucu verir (kayıt yeniden üretilebilir)', () => {
  const girdi = {
    column: kolon('1'),
    outcomeProbs: marj15({ '1': 0.5, X: 0.25, '2': 0.25 }),
    crowdMarginals: marj15({ '1': 0.6, X: 0.2, '2': 0.2 }),
    columns: 500000, pools: { 15: 1e6, 14: 6e5, 13: 6e5, 12: 7e5 }, draws: 500,
  };
  const a = evaluateColumn({ ...girdi, seed: 99 });
  const b = evaluateColumn({ ...girdi, seed: 99 });
  assert.equal(a.expected, b.expected);
});

// ——— λ kalibrasyonu ———
test('λ kalibrasyonu: veri yoksa 0 döner ve GÜVENİLMEZ işaretlenir', () => {
  const r = calibrateLambda([]);
  assert.equal(r.lambda, 0);
  assert.equal(r.reliable, false);
  assert.equal(r.reason, 'no_calibration_data');
});

test('λ kalibrasyonu: az haftada çalışır ama "güvenilir değil" der (≥30 şartı)', () => {
  const hafta = (roundId) => ({
    roundId,
    result: kolon('1'),
    crowdMarginals: marj15({ '1': 0.6, X: 0.2, '2': 0.2 }),
    columns: 100000,
    tiers: { 12: { winners: 50 }, 13: { winners: 5 } },
  });
  const r = calibrateLambda([hafta(1), hafta(2), hafta(3)]);
  assert.equal(r.weeksUsed, 3);
  assert.equal(r.reliable, false);
  assert.match(r.note, /≥30 hafta/);
  assert.ok(r.lambda >= 0);
});

test('λ kalibrasyonu: gerçek kazanan sayısı arttıkça λ BÜYÜR (yığınlaşma ölçülür)', () => {
  // Kalabalık marjinali 0.5/0.3/0.2, sonuç hep '1' → λ=0'da her maçta doğru
  // bilme olasılığı 0.5; N=1e6 için beklenen 12'ci ≈ 13.885, 13'cü ≈ 3.204
  // (binom C(15,k)·0.5^15). Gerçek kazanan bu beklentinin ÜSTÜNDEyse kalabalık
  // gözlenenden daha yığınlaşmış demektir → λ artmalı.
  const haftaYap = (winners12, winners13) => Array.from({ length: 6 }, (_, i) => ({
    roundId: 100 + i,
    result: kolon('1'),
    crowdMarginals: marj15({ '1': 0.5, X: 0.3, '2': 0.2 }),
    columns: 1000000,
    tiers: { 12: { winners: winners12 }, 13: { winners: winners13 } },
  }));

  const beklentiyeUygun = calibrateLambda(haftaYap(13885, 3204));
  const cokDahaYigin = calibrateLambda(haftaYap(50000, 16000));

  assert.ok(beklentiyeUygun.lambda < 0.05,
    `beklenti kadar kazanan varsa λ≈0 olmalı (bulunan: ${beklentiyeUygun.lambda})`);
  assert.ok(cokDahaYigin.lambda > beklentiyeUygun.lambda,
    `daha çok kazanan = daha yığın kalabalık = daha büyük λ (${cokDahaYigin.lambda} > ${beklentiyeUygun.lambda})`);
  assert.ok(cokDahaYigin.lambda > 0.2, `belirgin yığınlaşma λ>0.2 vermeli (bulunan: ${cokDahaYigin.lambda})`);
});

// ——— Gölge depo ———
test('gölge kayıt: yazılır, okunur ve ÜZERİNE YAZILMAZ (mühür mantığı)', () => {
  const ilk = writeShadowRecord(1530, { lambda: 0.2, expected: 4.1 });
  assert.equal(ilk.written, true);
  const tekrar = writeShadowRecord(1530, { lambda: 0.9, expected: 99 });
  assert.equal(tekrar.written, false, 'mevcut kayıt ezilemez');
  assert.equal(readShadowRecord(1530).lambda, 0.2, 'ilk kayıt korunmalı');
  assert.ok(listShadowRounds().includes('1530'));
  assert.ok(readShadowRecord(1530).writtenAt, 'zaman damgası zorunlu');
});

test('gölge kayıt: dosya adı süzülür (path traversal olamaz)', () => {
  writeShadowRecord('../../gizli', { x: 1 });
  assert.ok(!existsSync(join(SHADOW_DIR, '..', '..', 'gizli.json')), 'dizin dışına yazılamamalı');
  assert.ok(listShadowRounds().some((r) => r.includes('gizli')), 'süzülmüş adla yazılmalı');
});

// ——— GÖLGE MOD GÜVENCESİ (en kritik test) ———
test('GÖLGE MOD: EV motoru hiçbir API ucundan/rotadan çağrılmıyor', () => {
  const rotaDizini = join(here, '..', 'src', 'routes');
  for (const f of readdirSync(rotaDizini).filter((x) => x.endsWith('.js'))) {
    const kaynak = oku(join(rotaDizini, f), 'utf8');
    assert.ok(!/from '\.\.\/ev\//.test(kaynak), `${f}: EV motoru rotaya bağlanmış — motor GÖLGE modda kalmalı`);
  }
  const server = oku(join(here, '..', 'src', 'server.js'), 'utf8');
  assert.ok(!/from '\.\/ev\//.test(server), 'server.js EV motorunu bağlamış — gölge mod bozulmuş');
});

test('hazırlık durumu: displayAllowed her koşulda false (T10 kapsamı)', () => {
  assert.equal(engineReadiness(5).displayAllowed, false);
  assert.equal(engineReadiness(100).displayAllowed, false);
  assert.equal(engineReadiness(100).lambdaReliable, true);
  assert.match(engineReadiness(5).note, /gölge modda/);
});
