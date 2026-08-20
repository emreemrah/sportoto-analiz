// RADAR 5 — SEZON DEVRİNDE HİÇBİR HAFTA KAYBOLMAZ: NE YENİ NE ESKİ.
//
// İKİ AŞAMADA DOĞRULANMIŞ HATA + KARAR (21 Ağustos 2026, kullanıcı):
// 1) "1. Hafta sonuçları yansımamış": sezon yalnız STATİK geçmiş deposundan
//    çözülüyordu; yeni sezon orada olmadığından sezon GEÇEN sezona kayıyor,
//    arşivde 15/15 sonuçlu 1528 sezon süzgecine takılıp düşüyordu (üretimde
//    ölçüldü: archiveMatches=0). Düzeltme: sezon önce arşiv bülteninden
//    çözülür (arsivSezonu).
// 2) Sezon doğru çözülünce bu kez GEÇEN sezonun haftaları (1525-1527) sabit
//    pencerelerden düştü ve ekran n=1'e indi. Kullanıcı reddetti: "TÜM
//    SEZONLAR OLACAK". Sezon süzgeci kaldırıldı — 1 Ağustos'taki sezon sınırı
//    kararının YERİNE geçer. O günkü kaygı (150 haftalık dört sezonun tek
//    ortalamada seyrelmesi) bugün yapısal olarak imkânsız: eskiHaftalariAt
//    zaten 1525 başlangıcından keser.
//
// SÖZLEŞME: "Tüm Haftalar" = 1525 kesimi içindeki TÜM sezonlar. `season`
// alanı yalnız bakılan haftanın kendi sezonunu söyleyen üst veridir, süzmez.
// Liste (/position-matches) ile yüzde (/position-dna) aynı kümeyi kullanır.
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
  // (statik '1'lerden ayrışsın — iki sezonun da sayıldığı tek bakışta görünür).
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

test('sezon devrinde ESKİ + YENİ sezon birlikte sayılır', async () => {
  const { server, base } = await kur();
  try {
    const dna = await (await fetch(`${base}/api/radar/position-dna`)).json();
    assert.equal(dna.hasData, true, 'veri var');

    // Üst veri: bakılan haftanın (1529) kendi sezonu — geçen sezona kaymaz.
    // (Süzgeç DEĞİL; yalnız doğru etiket.)
    assert.equal(dna.cut.season, YENI_SEZON,
      'season üst verisi arşivden çözülmeli — statik deponun son sezonuna düşmemeli');

    // TÜM SEZONLAR: 1525 + 1526 (eski, 30 maç) + 1528 (yeni, 15 maç) = 45.
    // Sezon süzgeci geri gelirse bu 15'e (yalnız yeni) ya da 30'a (yalnız
    // eski) düşer — ikisi de kullanıcı kararına aykırı.
    assert.equal(dna.dna.totalMatches, 45, 'eski + yeni sezon birlikte sayılmalı');
    assert.deepEqual(dna.cut.archiveRounds ?? [], ['1528'], '1. Hafta arşivden geldi');
    assert.equal(dna.cut.historyMatches, 30, 'statik geçmiş sezonsuz sayılmalı');

    // 1. sıra: 1525 '1', 1526 '1', 1528 '2' → n=3, 1 %66.7 · 2 %33.3.
    const p1 = dna.dna.positions.find((p) => p.position === 1);
    assert.equal(p1.windows.allTime.sample, 3);
    assert.equal(p1.windows.allTime.counts['1'], 2);
    assert.equal(p1.windows.allTime.counts['2'], 1);
  } finally { server.close(); }
});

test('LİSTE de aynı kümeyi kullanır — iki sezonun haftaları birlikte açılır', async () => {
  const { server, base } = await kur();
  try {
    const r = await (await fetch(`${base}/api/radar/position-matches?position=1`)).json();
    assert.equal(r.season, YENI_SEZON, 'season üst verisi bakılan haftanın sezonu');
    // Yeniden → eskiye: 1. Hafta (14 Ağu) → 1526 (27 Tem) → 1525 (20 Tem).
    assert.deepEqual((r.matches || []).map((m) => m.roundId), ['1528', '1526', '1525'],
      'liste yüzdeyle aynı kümeden gelmeli — sezon süzgeci liste tarafına da dönmemeli');
    assert.equal(r.matches[0].week, '1. Hafta');
    assert.equal(r.matches[0].result, '2');
  } finally { server.close(); }
});
