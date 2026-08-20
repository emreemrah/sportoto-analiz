// RADAR 5 — SEZON DEVRİNDE YENİ SEZONUN İLK HAFTALARI KAYBOLMAZ.
//
// DOĞRULANMIŞ HATA (21 Ağustos 2026, kullanıcı bildirdi: "Radar 5'e 1. Hafta
// sonuçları yansımamış"): sezon, yalnız STATİK geçmiş deposunun tur
// listesinden çözülüyordu. Statik depo donmuş bir içe aktarımdır ve yeni
// sezonu bilmez; yeni sezonun ilk haftalarında arama boş düşünce sezon "son
// tamamlanmış statik turun sezonu"na — yani GEÇEN sezona — kayıyordu.
// Sonuç: 2. Hafta'nın (2026/2027) Radar 5'i 2025/2026 ile hesaplanıyor,
// arşivde 15/15 sonuçlanmış 1. Hafta sezon süzgecine takılıp SESSİZCE
// düşüyordu (üretimde ölçüldü: archiveMatches=0, cut.season=2025/2026).
//
// SÖZLEŞME: sezon SEÇİLEN haftanın kendi sezonudur — statik depo bilmiyorsa
// ARŞİV bültenine sorulur. Sabit pencerelerin aktif sezona bağlanması
// (1 Ağustos 2026 kullanıcı kararı: iki sezonun lig bileşimi tek ortalamada
// toplanmaz) DEĞİŞMEZ; yalnız "aktif sezon" doğru çözülür.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5sezon-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5sezon-arsiv-'));
process.env.ARCHIVE_DRIVER = 'file';
process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-r5sezon-hist-'));
process.env.HISTORY_DRIVER = 'file';

const { _resetArchiveStoreForTests, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { _resetHistoryStoreForTests, getHistoryStore } = await import('../src/history/historyStore.js');
_resetHistoryStoreForTests();

const ESKI_SEZON = '2025-2026';
const YENI_SEZON = '2026-2027';

const mkRow = (position, result) => ({
  position,
  result,
  resultValid: true,
  scoreHome: result === 'X' ? 1 : 2,
  scoreAway: result === 'X' ? 1 : 0,
  sourceHash: `h${position}${result}`,
  provenanceType: 'official_result_history',
  correctionVersion: 1,
});

// TOHUM BİR KEZ (modül seviyesinde): 'completed' bülten arşivde KİLİTLENİR;
// testler tekrar tohumlamaya kalkarsa ImmutableError alır. Kilit de sıra
// buradan: bülten 'active' açılır, maç + sonuç yazılır, SONRA kapatılır.
{
  // GEÇEN sezonun son haftaları statik depoda (1525–1526, hepsi '1').
  const hist = getHistoryStore();
  for (const [rid, closeAt] of [['1525', '2026-07-20T00:00:00Z'], ['1526', '2026-07-27T00:00:00Z']]) {
    await hist.upsertRound({ roundId: rid, seasonYear: ESKI_SEZON, status: 'completed', roundCloseAt: closeAt });
    await hist.putMatches(rid, Array.from({ length: 15 }, (_, i) => mkRow(i + 1, '1')));
  }

  // YENİ sezonun 1. Haftası (1528) yalnız ARŞİVDE: 15/15 sonuçlu, hepsi '2'
  // (statik '1'lerden ayrışsın — sızma/dahil olma tek bakışta görünür).
  const store = getArchiveStore();
  await store.upsertBulletin({
    id: '1528', roundId: 1528, week: '1. Hafta', status: 'active',
    season: YENI_SEZON, freezeAt: '2026-08-14T18:25:00Z',
  });
  await store.replaceMatches('1528', Array.from({ length: 15 }, (_, i) => ({
    matchId: `m1528_${i + 1}`, orderNo: i + 1, kickoffAt: '2026-08-14T18:30:00Z',
    homeName: `Ev${i + 1}`, awayName: `Dep${i + 1}`,
  })));
  for (let pos = 1; pos <= 15; pos += 1) {
    await store.upsertOfficialResult({
      bulletinId: '1528', matchId: `m1528_${pos}`, orderNo: pos,
      officialResult: '2', fullTimeScore: { home: 0, away: 1 },
    });
  }
  await store.upsertBulletin({ id: '1528', roundId: 1528, status: 'completed' });
  // Güncel hafta (1529) da yeni sezonda ve YALNIZ arşivde bilinir.
  await store.upsertBulletin({
    id: '1529', roundId: 1529, week: '2. Hafta', status: 'active',
    season: YENI_SEZON, freezeAt: '2026-08-21T18:25:00Z',
  });

  const { save } = await import('../src/cache.js');
  save('bulletin', { roundId: 1529, round: '2. Hafta', matches: [] });
}

async function kur() {
  const express = (await import('express')).default;
  const router = (await import('../src/routes/radar.js')).default;
  const app = express();
  app.use('/api/radar', router);
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('sezon devrinde 1. Hafta sonuçları Radar 5 yüzdesine GİRER', async () => {
  const { server, base } = await kur();
  try {
    const dna = await (await fetch(`${base}/api/radar/position-dna`)).json();
    assert.equal(dna.hasData, true, 'veri var');

    // Sezon SEÇİLEN haftanın (1529) kendi sezonu — geçen sezona kaymaz.
    assert.equal(dna.cut.season, YENI_SEZON,
      'sezon arşivden çözülmeli; statik deponun son sezonuna düşerse 1. Hafta kaybolur');

    // Yeni sezonda tek tamamlanmış hafta: 1528 → 15 maç, hepsi arşivden.
    assert.equal(dna.dna.totalMatches, 15, '1. Haftanın 15 maçı sayılmalı');
    assert.deepEqual(dna.cut.archiveRounds ?? [], ['1528']);

    // 1. sıra: 1528'de '2' bitti; geçen sezonun '1'leri sabit pencereye girmez
    // (1 Ağustos kararı: sezonlar tek ortalamada toplanmaz).
    const p1 = dna.dna.positions.find((p) => p.position === 1);
    assert.equal(p1.windows.allTime.sample, 1);
    assert.equal(Number(p1.windows.allTime.pct['2']), 100);
  } finally { server.close(); }
});

test('LİSTE de aynı sezon kesimini kullanır — 1. Hafta satırı açılır', async () => {
  const { server, base } = await kur();
  try {
    const r = await (await fetch(`${base}/api/radar/position-matches?position=1`)).json();
    assert.equal(r.season, YENI_SEZON);
    assert.deepEqual((r.matches || []).map((m) => m.roundId), ['1528'],
      'listede yalnız yeni sezonun 1. Haftası olmalı — yüzdeyle aynı küme');
    assert.equal(r.matches[0].week, '1. Hafta');
    assert.equal(r.matches[0].result, '2');
  } finally { server.close(); }
});
