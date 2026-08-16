// RADAR 5 — OYNANMA + ORAN YAKINLIK FİLTRESİ (spec: tasks/todo.md, 2026-08-08).
//
// SÖZLEŞMELER:
//  (a) Yakınlık süzgeci DOĞRU maçları seçer — her sıra GÜNCEL haftanın aynı
//      sırasındaki maçın son kayıtlı değerine bakar; üç değer birden tolerans
//      içinde olmalı; otomatik genişleme yok.
//  (b) Filtre değişince önbellek YENİLENİR — anahtarda filtre parametreleri
//      var; eski filtrenin sonucu dönemez (sessiz hata sınıfı).
//  (c) Verisi olmayan maç EŞLEŞMEZ ve sayısı açıkça döner (aday/verili/uyan);
//      eksik veriyle yüzde uydurulmaz.
//  (d) Süzgeç sonrası örneklem düşünce yön sinyali ÜRETİLMEZ (directional
//      false, sampleTier 'info') — ekran yüzde yerine "yetersiz" yazar.
//  (e) Mühürlü haftada filtre UYGULANMAZ; yok sayıldığı yanıtta açıkça yazar.
//  (f) Liste (/position-matches) ile dağılım (/position-dna) AYNI süzgeci
//      kullanır — filtreli sayılar birbirini tutar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5filtre-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5filtre-arsiv-'));
process.env.ARCHIVE_DRIVER = 'file';
process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5filtre-hist-'));
process.env.HISTORY_DRIVER = 'file';

const { _resetArchiveStoreForTests, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { _resetHistoryStoreForTests } = await import('../src/history/historyStore.js');
_resetHistoryStoreForTests();
const { oranYakin, oynanmaYakin } = await import('../src/radar/siraFiltre.js');

// ---------------------------------------------------------------------------
// FİKSTÜR — geçmiş turlar YALNIZ arşivde (official_forward yolu): tek depo,
// gözlem/sonuç/kimlik aynı yerden. 1. sıranın senaryosu bilinçli örülür:
//
//   Güncel (1531) 1. sıra:  oynanma {60,25,15} · oran {1.85, 3.40, 4.20}
//   1525: oynanma birebir {60,25,15}   · oran birebir            → sonuç '1'
//   1526: oynanma ±3 {63,22,15}        · oran ±0.03 SINIRDA      → sonuç 'X'
//   1527: oynanma yalnız ±10 {70,20,10}· oran YOK                → sonuç '2'
//   1528: oynanma YOK                  · oran YOK                → sonuç '1'
//   1529: oynanma ±3 {60,24,16}        · oran ±0.02 SINIRDA      → sonuç '1'
//   1530: oynanma birebir AMA 0-1 ölçekli {0.6,0.25,0.15}        → sonuç 'X'
//
// Beklenen (1. sıra, oynanma): aday 6 · verili 5 · tol0→2 · tol3→4 · tol10→5.
// Beklenen (1. sıra, oran):    aday 6 · verili 3 · tol0→1 · tol0.02→2 · tol0.03→3.
// ---------------------------------------------------------------------------
const store = getArchiveStore();

const kickoff = {
  1525: '2026-06-06T18:00:00Z',
  1526: '2026-06-13T18:00:00Z',
  1527: '2026-06-20T18:00:00Z',
  1528: '2026-06-27T18:00:00Z',
  1529: '2026-07-04T18:00:00Z',
  1530: '2026-07-11T18:00:00Z',
};
// Gözlem günü: maçtan önceki Cuma 12:00Z (İstanbul 15:00 — gün mührü içinde).
const cumaGozlem = (kick) => new Date(new Date(kick).getTime() - 30 * 3600e3).toISOString();

const SONUC = { 1525: '1', 1526: 'X', 1527: '2', 1528: '1', 1529: '1', 1530: 'X' };
const PCT = {
  1525: { '1': 60, X: 25, '2': 15 },
  1526: { '1': 63, X: 22, '2': 15 },
  1527: { '1': 70, X: 20, '2': 10 },
  1529: { '1': 60, X: 24, '2': 16 },
  // 0-1 ölçek: yuzdeye normalizasyonu olmadan hiçbir tolda eşleşmezdi.
  1530: { '1': 0.6, X: 0.25, '2': 0.15 },
};
const ORAN = {
  1525: { home: 1.85, draw: 3.4, away: 4.2 },
  // ±0.03 sınırı: 1.88−1.85 ikilik tabanda tam 0.03 ÇIKMAZ (0.0300…027);
  // pay (EPS) olmadan bu maç ±0.03'te sessizce elenirdi.
  1526: { home: 1.88, draw: 3.43, away: 4.23 },
  // ±0.02 sınırı: 1.87−1.85 ve 4.22−4.20 de aynı şekilde payla tutar.
  1529: { home: 1.87, draw: 3.42, away: 4.22 },
};

for (const [ridStr, kick] of Object.entries(kickoff)) {
  const rid = Number(ridStr);
  const freezeAt = new Date(new Date(kick).getTime() - 5 * 60e3).toISOString();
  await store.upsertBulletin({
    id: String(rid), roundId: rid, week: `${rid - 1474}. Hafta`, status: 'active',
    firstMatchStartAt: kick, freezeAt, season: '2025-2026',
  });
  await store.replaceMatches(String(rid), Array.from({ length: 15 }, (_, i) => ({
    matchId: `m${rid}_${i + 1}`, orderNo: i + 1, kickoffAt: kick,
    homeName: `Ev${i + 1}`, awayName: `Dep${i + 1}`,
  })));
  for (let pos = 1; pos <= 15; pos += 1) {
    await store.upsertOfficialResult({
      bulletinId: String(rid), matchId: `m${rid}_${pos}`, orderNo: pos,
      officialResult: pos === 1 ? SONUC[rid] : '1',
      fullTimeScore: { home: 1, away: 0 },
    });
  }
  const gozlemler = [];
  if (PCT[rid]) {
    gozlemler.push({ matchId: `m${rid}_1`, source: 'nesine', observedAt: cumaGozlem(kick), playedPct: PCT[rid] });
  }
  if (ORAN[rid]) {
    gozlemler.push({ matchId: `m${rid}_1`, source: 'oranx', observedAt: cumaGozlem(kick), odds: ORAN[rid] });
  }
  if (gozlemler.length) await store.addObservations(String(rid), gozlemler);
}

// Güncel hafta (1531) — bülten cache'te, gözlemleri arşivde.
const GUNCEL_KICK = '2026-07-18T18:00:00Z';
const { save } = await import('../src/cache.js');
save('bulletin', {
  roundId: 1531,
  round: '57. Hafta',
  matches: Array.from({ length: 15 }, (_, i) => ({
    no: i + 1, sportotoMatchId: `m1531_${i + 1}`,
    home: { name: `Ev${i + 1}` }, away: { name: `Dep${i + 1}` },
    date: GUNCEL_KICK,
  })),
});
await store.addObservations('1531', [
  { matchId: 'm1531_1', source: 'nesine', observedAt: cumaGozlem(GUNCEL_KICK), playedPct: { '1': 60, X: 25, '2': 15 } },
  { matchId: 'm1531_1', source: 'oranx', observedAt: cumaGozlem(GUNCEL_KICK), odds: { home: 1.85, draw: 3.4, away: 4.2 } },
]);

// Mühürlü hafta örneği: 1524'ün (listede zaten görünmeyen tur) snapshot'ı.
// ESKİ MÜHÜR — süzgeç kırılımı YOK (16 Ağustos 2026 öncesinde mühürlenmiş
// haftaları temsil eder; o haftalarda süzgeç sunulamaz).
await store.createSnapshot({
  bulletinId: '1524', payloadHash: 'test-hash', lockedAt: '2026-05-30T17:55:00Z',
  payload: { radar5: { dna: { totalMatches: 42 }, cut: { roundId: 1524 } } },
});

// YENİ MÜHÜR — süzgeç kırılımları da yazılmış hafta (1523). Buradaki değerler
// hafta donduğu anda hesaplanıp mühürlendi; uç onları YENİDEN HESAPLAMADAN
// okur. Kırılımı OLMAYAN bir seçim (oynanma:10) bilerek dışarıda bırakıldı:
// eksik anahtarın "mühürlü değil" olarak bildirildiği de sınanır.
await store.createSnapshot({
  bulletinId: '1523', payloadHash: 'test-hash-1523', lockedAt: '2026-05-23T17:55:00Z',
  payload: {
    radar5: {
      dna: { totalMatches: 40 },
      cut: { roundId: 1523 },
      periods: ['allTime', 'last5', 'last10', 'last15'],
      filtreler: {
        'oynanma:0': { dna: { totalMatches: 7 }, filtre: { mod: 'oynanma', tol: 0, positions: {} } },
        'oynanma:3': { dna: { totalMatches: 11 }, filtre: { mod: 'oynanma', tol: 3, positions: {} } },
        'oran:0.02': { dna: { totalMatches: 5 }, filtre: { mod: 'oran', tol: 0.02, positions: {} } },
      },
    },
  },
});

async function kur() {
  const express = (await import('express')).default;
  const router = (await import('../src/routes/radar.js')).default;
  const app = express();
  app.use('/api/radar', router);
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const p1 = (dna) => dna.dna.positions.find((p) => p.position === 1);

test('oranYakin kayan nokta sınırında maçı YUTMAZ (pay), payı da abartmaz', () => {
  const a = { home: 1.85, draw: 3.4, away: 4.2 };
  assert.equal(oranYakin(a, { home: 1.87, draw: 3.42, away: 4.22 }, 0.02), true, 'tam sınır ±0.02 içindedir');
  assert.equal(oranYakin(a, { home: 1.88, draw: 3.42, away: 4.22 }, 0.02), false, '0.03 fark ±0.02 dışıdır');
  assert.equal(oranYakin(a, { home: 1.85, draw: 3.4, away: 4.2 }, 0), true, 'birebir oran birebir tutar');
  assert.equal(oynanmaYakin({ '1': 60, X: 25, '2': 15 }, { '1': 60, X: 25, '2': 15 }, 0), true);
  assert.equal(oynanmaYakin({ '1': 60, X: 25, '2': 15 }, { '1': 60, X: 24, '2': 16 }, 0), false,
    'birebir: tek değer bile sapamaz');
});

test('(a) OYNANMA süzgeci doğru maçları seçer — ölçek farkı dahil', async () => {
  const { server, base } = await kur();
  try {
    const tol0 = await (await fetch(`${base}/api/radar/position-dna?oynanmaTol=0`)).json();
    assert.equal(p1(tol0).windows.allTime.sample, 2, 'birebir: 1525 + 1530 (0-1 ölçek normalize)');

    const tol3 = await (await fetch(`${base}/api/radar/position-dna?oynanmaTol=3`)).json();
    assert.equal(p1(tol3).windows.allTime.sample, 4, '±3: 1525, 1526, 1529, 1530');
    assert.deepEqual(p1(tol3).windows.allTime.counts, { '1': 2, X: 2, '2': 0 },
      'dağılım süzülen maçların SONUÇLARINDAN gelir');

    const tol10 = await (await fetch(`${base}/api/radar/position-dna?oynanmaTol=10`)).json();
    assert.equal(p1(tol10).windows.allTime.sample, 5, '±10: verisi olan 5 maçın tamamı');
  } finally { server.close(); }
});

test('(a) ORAN süzgeci doğru maçları seçer', async () => {
  const { server, base } = await kur();
  try {
    const birebir = await (await fetch(`${base}/api/radar/position-dna?oranTol=0`)).json();
    assert.equal(p1(birebir).windows.allTime.sample, 1, 'birebir: yalnız 1525');

    const dar = await (await fetch(`${base}/api/radar/position-dna?oranTol=0.02`)).json();
    assert.equal(p1(dar).windows.allTime.sample, 2, '±0.02: 1525 (birebir) + 1529 (sınırda)');
    assert.deepEqual(p1(dar).windows.allTime.counts, { '1': 2, X: 0, '2': 0 });

    const genis = await (await fetch(`${base}/api/radar/position-dna?oranTol=0.03`)).json();
    assert.equal(p1(genis).windows.allTime.sample, 3, '±0.03: 1526 da girer');
  } finally { server.close(); }
});

test('(b) filtre değişince önbellek yenilenir — bayat sonuç dönmez', async () => {
  const { server, base } = await kur();
  try {
    const ilk = await (await fetch(`${base}/api/radar/position-dna?oynanmaTol=3`)).json();
    assert.equal(p1(ilk).windows.allTime.sample, 4);
    // Aynı 10 dk penceresinde farklı tolerans: anahtar filtreyi içermeseydi
    // buradan 4 dönerdi.
    const iki = await (await fetch(`${base}/api/radar/position-dna?oynanmaTol=10`)).json();
    assert.equal(p1(iki).windows.allTime.sample, 5, 'tolerans değişti, sonuç da değişti');
    const suz = await (await fetch(`${base}/api/radar/position-dna`)).json();
    assert.equal(p1(suz).windows.allTime.sample, 6, 'filtresiz istek filtreli önbelleğe düşmez');
    assert.equal(suz.filtre, null, 'filtresiz yanıtta filtre alanı null — yanıt şekli geriye uyumlu');
  } finally { server.close(); }
});

test('(c) verisi olmayan maç sayısı AÇIKÇA döner (aday/verili/uyan)', async () => {
  const { server, base } = await kur();
  try {
    const oyn = await (await fetch(`${base}/api/radar/position-dna?oynanmaTol=3`)).json();
    assert.deepEqual(
      { aday: oyn.filtre.positions['1'].aday, verili: oyn.filtre.positions['1'].verili, uyan: oyn.filtre.positions['1'].uyan },
      { aday: 6, verili: 5, uyan: 4 },
      'oynanma: 6 adayın 5\'inin verisi var, 4\'ü uydu (1528 verisiz)',
    );
    assert.deepEqual(oyn.filtre.positions['1'].guncel, { '1': 60, X: 25, '2': 15 }, 'karşılaştırma noktası yanıtında');

    const orn = await (await fetch(`${base}/api/radar/position-dna?oranTol=0.03`)).json();
    assert.deepEqual(
      { aday: orn.filtre.positions['1'].aday, verili: orn.filtre.positions['1'].verili, uyan: orn.filtre.positions['1'].uyan },
      { aday: 6, verili: 3, uyan: 3 },
      'oran: yalnız 3 maçın oranı var — eksik veri yüzdeye çevrilip gizlenmez',
    );
    // Gözlemi hiç olmayan sırada dürüstlük: veri yok, uyan yok, güncel yok.
    assert.equal(orn.filtre.positions['2'].verili, 0);
    assert.equal(orn.filtre.positions['2'].uyan, 0);
    assert.equal(orn.filtre.positions['2'].guncel, null);
  } finally { server.close(); }
});

test('(d) süzgeç sonrası küçük örneklem yön sinyali ÜRETMEZ', async () => {
  const { server, base } = await kur();
  try {
    const dna = await (await fetch(`${base}/api/radar/position-dna?oynanmaTol=0`)).json();
    const p = p1(dna);
    assert.equal(p.windows.allTime.sample, 2);
    assert.equal(p.directional, false, 'n<10 → yön sinyali yok');
    assert.equal(p.sampleTier, 'info', 'ekran bu kademede yüzde yerine "yetersiz" yazar');
  } finally { server.close(); }
});

test('(e) mühürde kırılım yoksa süzgeç TÜREV olur ve mühürlü sayılmaz', async () => {
  const { server, base } = await kur();
  try {
    // FİLTRESİZ istek: mühürlü değer AYNEN döner — burada yeniden hesap YOK.
    const f = await (await fetch(`${base}/api/radar/position-dna?roundId=1524`)).json();
    assert.equal(f.sealed, true);
    assert.equal(f.turev, false, 'filtresiz görünüm mühürden gelir');
    assert.equal(f.dna.totalMatches, 42, 'mühürlü değer AYNEN döner');

    // FİLTRELİ istek: mühürde kırılım yok → türev.
    const r = await (await fetch(`${base}/api/radar/position-dna?roundId=1524&oynanmaTol=3`)).json();
    assert.equal(r.sealed, true);
    // KARAR DEĞİŞTİ (16 Ağustos 2026): süzgeç artık TÜREV olarak hesaplanır.
    // Kullanıcı, mühürlenmiş bir haftanın süzgeçli tablosunu sonradan
    // inceleyemediği için tıkanmıştı. Kesim MÜHÜRDEN gelir (o haftanın donma
    // anından öncesi), dolayısıyla sonraki haftalar biriktikçe tablo BÜYÜMEZ.
    // Değişmeyen kural: bu bir MÜHÜRLÜ DEĞER DEĞİLDİR ve gizlenmez.
    assert.equal(r.filtre.uygulanmadi, false, 'türev hesap uygulanır');
    assert.equal(r.filtre.muhurlu, false, 'ama mühürlü kayıt DEĞİLDİR');
    assert.equal(r.filtre.turev, true);
    assert.equal(r.turev, true);
    assert.match(r.filtre.notu, /TÜREV/);
    assert.deepEqual(r.muhurluFiltreler, [], 'eski mühürde hiçbir seçim yok');

    // MÜHÜR DOKUNULMAZ: türev hesap snapshot'ı DEĞİŞTİRMEZ.
    const snap = await getArchiveStore().getSnapshot('1524');
    assert.equal(snap.payload.radar5.dna.totalMatches, 42, 'mühürlü kayıt aynen durur');
    assert.equal(snap.payload.radar5.filtreler, undefined, 'mühre süzgeç YAZILMAZ');
  } finally { server.close(); }
});

// (g) SÜZGEÇ KIRILIMI MÜHÜRDE VARSA SUNULUR (16 Ağustos 2026).
// Kritik ayrım: bu YENİDEN HESAP DEĞİLDİR. Uç, mühürdeki hazır değeri okur;
// bu yüzden `uygulanmadi: false` döner ve dönen dna mühürdeki dna'dır.
test('(g) mühürlü haftada süzgeç kırılımı MÜHÜRDEN okunur (yeniden hesap yok)', async () => {
  const { server, base } = await kur();
  try {
    const r = await (await fetch(`${base}/api/radar/position-dna?roundId=1523&oynanmaTol=3`)).json();
    assert.equal(r.sealed, true);
    assert.equal(r.useSnapshot, true);
    assert.equal(r.filtre.uygulanmadi, false, 'mühürde var → uygulandı sayılır');
    assert.equal(r.filtre.muhurlu, true);
    assert.equal(r.dna.totalMatches, 11, 'mühürdeki SÜZGEÇLİ değer döner');
    assert.match(r.note, /süzgeç sonucu da hafta donduğu anda mühürlendi/);
  } finally { server.close(); }
});

test('(g2) mühürde OLMAYAN seçim TÜREV olur; mühürlü sayılmaz', async () => {
  const { server, base } = await kur();
  try {
    // oynanma:10 bu haftanın mührüne yazılmadı → türev hesaplanır.
    const r = await (await fetch(`${base}/api/radar/position-dna?roundId=1523&oynanmaTol=10`)).json();
    assert.equal(r.filtre.turev, true, 'mühürde yok → türev');
    assert.equal(r.filtre.muhurlu, false);
    // MÜHÜRLÜ olanlar ayrı bildirilir: istemci hangisinin noter kaydı,
    // hangisinin bugün hesaplandığını ayırt edebilmeli.
    assert.deepEqual(
      r.muhurluFiltreler.sort(),
      ['oran:0.02', 'oynanma:0', 'oynanma:3'],
    );
  } finally { server.close(); }
});

test('(g4) MÜHÜRDE OLAN seçim türev DEĞİLDİR — mühürden okunur', async () => {
  const { server, base } = await kur();
  try {
    const r = await (await fetch(`${base}/api/radar/position-dna?roundId=1523&oynanmaTol=3`)).json();
    assert.equal(r.filtre.muhurlu, true, 'mühürde var → mühürlü');
    assert.notEqual(r.filtre.turev, true, 'türev DEĞİL');
    assert.equal(r.turev, false);
    assert.equal(r.dna.totalMatches, 11, 'mühürdeki süzgeçli değer');
  } finally { server.close(); }
});

test('(g3) filtresiz istek mühürlü süzgeç varken de SÜZGEÇSİZ değeri döner', async () => {
  const { server, base } = await kur();
  try {
    const r = await (await fetch(`${base}/api/radar/position-dna?roundId=1523`)).json();
    assert.equal(r.filtre, null);
    assert.equal(r.dna.totalMatches, 40);
  } finally { server.close(); }
});

test('(f) liste ile dağılım aynı süzgeci kullanır; oran modunda satırda oran var', async () => {
  const { server, base } = await kur();
  try {
    const dna = await (await fetch(`${base}/api/radar/position-dna?oynanmaTol=3`)).json();
    const liste = await (await fetch(`${base}/api/radar/position-matches?position=1&oynanmaTol=3`)).json();
    assert.equal(liste.count, p1(dna).windows.allTime.sample, 'liste sayısı = dağılımın tabanı');
    assert.deepEqual(
      liste.matches.map((m) => m.roundId).sort(),
      ['1525', '1526', '1529', '1530'],
      'tam olarak süzgeci geçen haftalar',
    );
    assert.deepEqual(
      { aday: liste.filtre.aday, verili: liste.filtre.verili, uyan: liste.filtre.uyan },
      { aday: 6, verili: 5, uyan: 4 },
    );

    const oranListe = await (await fetch(`${base}/api/radar/position-matches?position=1&oranTol=0.02`)).json();
    assert.equal(oranListe.count, 2);
    for (const m of oranListe.matches) {
      assert.ok(m.oran && typeof m.oran.home === 'number', 'satır hangi orana benzediğini gösterir');
    }
    // Verisi olmayan sırada filtre uygulanamaz — boş liste + dürüst not.
    const bos = await (await fetch(`${base}/api/radar/position-matches?position=2&oranTol=0.02`)).json();
    assert.equal(bos.hasData, false);
    assert.equal(bos.filtre.guncel, null);
    assert.match(bos.note, /karşılaştırılacak kayıt yok/);
  } finally { server.close(); }
});

test('geçersiz filtre 400 döner — sessizce varsayılana düşülmez', async () => {
  const { server, base } = await kur();
  try {
    // 0.25 önceki adım kümesindendi — artık geçersiz; sessizce kabul edilmemeli.
    for (const q of ['oynanmaTol=7', 'oranTol=0.25', 'oynanmaTol=3&oranTol=0.02']) {
      const r = await fetch(`${base}/api/radar/position-dna?${q}`);
      assert.equal(r.status, 400, `${q} kabul edilmemeli`);
    }
    const r = await fetch(`${base}/api/radar/position-matches?position=1&oynanmaTol=abc`);
    assert.equal(r.status, 400);
  } finally { server.close(); }
});
