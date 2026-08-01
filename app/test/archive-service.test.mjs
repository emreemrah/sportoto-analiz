// FRONTEND SERVİS TESTLERİ — bülten geçmişi/snapshot servisleri GERÇEK API
// sözleşmesiyle çalışır (sahte fetcher enjekte edilir; RN gerekmez).
// Çalıştırma: cd app && npm test   (Node >= 22.7 — ESM sözdizimi otomatik algılanır)
import test from 'node:test';
import assert from 'node:assert/strict';
import { setArchiveFetcher, humanArchiveError } from '../src/services/archiveClient.js';
import { listBulletins, getBulletinById } from '../src/services/bulletinHistoryService.js';
import { getSnapshot, updateMatchAnalysis } from '../src/services/analysisSnapshotService.js';
import { mapSnapshot, displayPickHits, expandDisplayPick } from '../src/services/archiveMappers.js';

// ---- Backend arşiv API'sinin sahte yanıtları (gerçek sözleşmeyle birebir) ----
const API_LIST = {
  generatedAt: '2026-07-20T10:00:00.000Z',
  driver: 'file',
  count: 2,
  bulletins: [
    {
      id: '4200', roundId: 4200, season: '2026/2027', week: '49. Hafta', status: 'completed',
      firstMatchStartAt: '2026-07-25T17:00:00.000Z', freezeAt: '2026-07-25T16:55:00.000Z',
      lockedAt: '2026-07-25T16:55:00.000Z', completedAt: '2026-07-26T22:00:00.000Z',
      createdAt: '2026-07-21T09:00:00.000Z', updatedAt: '2026-07-26T22:00:00.000Z',
      immutable: true,
      snapshot: { exists: true, id: 'snap-4200', lockedAt: '2026-07-25T16:55:00.000Z', late: false, schemaVersion: '1.0.0', verificationHash: 'a'.repeat(64), shortHash: 'aaaaaaaaaa' },
      totalMatches: 15, resolvedCount: 15,
      resultSummary: { correct: 13, predicted: 15, totalMatches: 15, accuracy: 87, banko: { total: 2, hit: 2, rate: 100 }, surprise: { total: 1, hit: 1, rate: 100 } },
      dataGaps: null,
    },
    {
      id: '4199', roundId: 4199, season: '2026/2027', week: '48. Hafta', status: 'locked',
      firstMatchStartAt: '2026-07-18T17:00:00.000Z', freezeAt: '2026-07-18T16:55:00.000Z',
      lockedAt: '2026-07-18T16:55:00.000Z', completedAt: null,
      createdAt: '2026-07-14T09:00:00.000Z', updatedAt: '2026-07-18T16:55:00.000Z',
      immutable: true,
      snapshot: { exists: true, id: 'snap-4199', lockedAt: '2026-07-18T16:55:00.000Z', late: false, schemaVersion: '1.0.0', verificationHash: 'b'.repeat(64), shortHash: 'bbbbbbbbbb' },
      totalMatches: 15, resolvedCount: 4, resultSummary: null, dataGaps: [{ no: 7, reason: 'Bu lig kapsam dışında' }],
    },
  ],
};

const API_DETAIL_4200 = {
  ...API_LIST.bulletins[0],
  matches: [
    {
      matchId: '91001', orderNo: 1, homeName: 'Galatasaray', awayName: 'Fenerbahçe', league: 'Süper Lig',
      kickoffAt: '2026-07-25T17:00:00.000Z', externalIds: {},
      official: {
        result: '1', fullTimeScore: { home: 2, away: 0 }, confirmedAt: '2026-07-25T19:00:00.000Z',
        sourceUpdatedAt: '2026-07-25T19:00:00.000Z', correctionVersion: 1, source: 'Spor Toto resmi API',
        // Sinsi girdi: API bir gün ilk yarı skoru göndermeye başlasa bile OKUNMAMALI:
        halfTimeScore: { home: 1, away: 0 },
      },
    },
    {
      matchId: '91002', orderNo: 2, homeName: 'Beşiktaş', awayName: 'Trabzonspor', league: 'Süper Lig',
      kickoffAt: '2026-07-25T18:00:00.000Z', externalIds: {}, official: null,
    },
  ],
};

const API_SNAPSHOT_4200 = {
  id: 'snap-4200', bulletinId: '4200', schemaVersion: '1.0.0', engineVersion: 'backend-analysis-1.0.0',
  sourceVersions: {}, createdAt: '2026-07-25T16:55:00.000Z', lockedAt: '2026-07-25T16:55:00.000Z',
  dataObservedAt: '2026-07-25T16:55:00.000Z', late: false, immutable: true,
  verificationHash: 'a'.repeat(64), hashAlgo: 'sha256-canonical-json-v1',
  payload: {
    schemaVersion: '1.0.0',
    lock: { frozenAt: '2026-07-25T16:55:00.000Z', dataObservedAt: '2026-07-25T16:55:00.000Z', late: false },
    matches: [
      {
        no: 1, matchId: '91001',
        systemPrediction: { symbol: '1', display: '1', label: 'NET', reason: 'test', estimated: false },
        confidence: { favoritePercent: 52, surpriseScore: 22, dataConfidence: 'Orta' },
        radar: { label: 'BANKO', favorite: { symbol: '1', percent: 52 }, surpriseScore: 22 },
        market: { odds: { home: 1.8, draw: 3.5, away: 4.2 }, probabilities: { '1': 52, X: 26, '2': 22 }, probabilitiesEstimated: false, playedPercentages: null },
        teamData: { home: { last5: ['G', 'G', 'B', 'G', 'M'], standing: { position: 2 } }, away: { last5: ['M', 'B', 'M', 'G', 'M'], standing: { position: 9 } } },
        dataQuality: { matched: true },
        missingPlayersNote: 'Bu veri bulunamadı (eksik/cezalı oyuncu kaynağı yok).',
        analysisComment: 'Test yorumu', aiComment: null,
      },
      {
        no: 2, matchId: '91002',
        systemPrediction: { symbol: '10', display: '1X', label: 'ÇİFTE', reason: 'test', estimated: false },
        confidence: { favoritePercent: null, surpriseScore: 48, dataConfidence: 'Düşük' },
        radar: null,
        market: { odds: null, probabilities: null, probabilitiesEstimated: null, playedPercentages: null },
        teamData: null, dataQuality: { matched: false, reason: 'Veri yok' },
        missingPlayersNote: 'Bu veri bulunamadı.', analysisComment: null, aiComment: null,
      },
    ],
  },
};

const API_RESULTS_4200 = {
  bulletinId: '4200', status: 'completed', resolvedCount: 1,
  results: [{ bulletinId: '4200', matchId: '91001', orderNo: 1, officialResult: '1', fullTimeScore: { home: 2, away: 0 }, resultSource: 'Spor Toto resmi API', confirmedAt: '2026-07-25T19:00:00.000Z', correctionVersion: 1 }],
};

const API_EVAL_4200 = {
  bulletinId: '4200', roundId: 4200, snapshotHash: 'a'.repeat(64), effectiveFromRoundId: 4201,
  summary: { correct: 1, predicted: 2 },
  matches: [
    { no: 1, matchId: '91001', frozenPrediction: '1', officialResult: '1', fullTimeScore: { home: 2, away: 0 }, correct: true },
    { no: 2, matchId: '91002', frozenPrediction: '10', officialResult: '2', fullTimeScore: { home: 0, away: 1 }, correct: false },
  ],
};

function apiFetcher(routes) {
  return async (path) => {
    for (const [prefix, val] of Object.entries(routes)) {
      if (path === prefix) {
        if (val instanceof Error) throw val;
        return JSON.parse(JSON.stringify(val));
      }
    }
    const err = new Error(`Sunucu hatası (404)`);
    throw err;
  };
}

test('listBulletins: veri MOCK’tan değil GERÇEK API’den gelir ve ekran biçimine eşlenir', async () => {
  setArchiveFetcher(apiFetcher({ '/api/bulletins': API_LIST }));
  const list = await listBulletins();
  assert.equal(list.length, 2);
  assert.equal(list[0].id, '4200');
  assert.equal(list[0].bulletinNo, '2026/2027 · 49. Hafta');
  assert.equal(list[0].status, 'completed');
  assert.equal(list[0]._source, 'api');
  assert.ok(!list[0]._demo, 'gerçek veri demo işaretli olamaz');
  assert.equal(list[0].matches.length, 15, 'liste kartı 15 maç sayısını görmeli');
  assert.equal(list[0].resultSummary.systemCorrect, 13);
  assert.equal(list[0].resultSummary.totalCount, 15);
  assert.equal(list[0].verificationHash, 'a'.repeat(64));
  assert.equal(list[1].status, 'locked');
  assert.deepEqual(list[1].dataGaps, [{ no: 7, reason: 'Bu lig kapsam dışında' }]);
  // Mock takımları değil ('b27' id'leri yok):
  assert.ok(!list.some((b) => String(b.id).startsWith('b')), 'mock id sızmamalı');
});

// Geçici olarak demo/geliştirme kipine geçir (demoDataAllowed() __DEV__'i
// ÇAĞRI ANINDA okur, bu yüzden global'i set etmek yeterli). finally ile geri
// alınır — aksi halde sonraki testler yanlışlıkla demo kipinde çalışır.
async function demoKipinde(fn) {
  const onceki = globalThis.__DEV__;
  globalThis.__DEV__ = true;
  try { return await fn(); } finally { globalThis.__DEV__ = onceki; }
}

test('ÜRETİM: API ulaşılamazsa örnek bülten UYDURULMAZ, hata dürüstçe yukarı verilir', async () => {
  // Bu, denetimde bulunan gerçek kusurun testidir: eskiden ağ hatasında
  // üretimde de mock listeye düşülüyordu ve o listenin resultSummary'si
  // UYDURMA bir başarı yüzdesi (systemAccuracy) taşıyordu. "Demo, rastgele
  // veya uydurma kupon, maliyet, başarı oranı ve sonuç üretilmemeli" kuralı
  // gereği artık hata ekrana taşınır (ekranda "Tekrar dene" durumu var).
  setArchiveFetcher(async () => { throw new Error('Network request failed'); });
  await assert.rejects(() => listBulletins(), /Network request failed/);
});

test('ÜRETİM: demo id (b27) istense bile örnek bülten dönmez', async () => {
  setArchiveFetcher(apiFetcher({}));
  await assert.rejects(() => getBulletinById('b27'), /bulunamadı/);
});

test('ÜRETİM: demo id için analiz snapshot’ı da uydurulmaz (null döner)', async () => {
  setArchiveFetcher(apiFetcher({}));
  assert.equal(await getSnapshot('b27'), null);
});

test('DEMO/GELİŞTİRME: API ulaşılamazsa liste açıkça _demo işaretli örneğe düşer', async () => {
  await demoKipinde(async () => {
    setArchiveFetcher(async () => { throw new Error('Network request failed'); });
    const list = await listBulletins();
    assert.ok(list.length > 0);
    assert.ok(list.every((b) => b._demo === true), 'fallback verinin TAMAMI _demo işaretli olmalı');
  });
});

test('getBulletinById: maçlar resmî sonuçla eşlenir; halfTimeScore API’den gelse bile OKUNMAZ', async () => {
  setArchiveFetcher(apiFetcher({ '/api/bulletins/4200': API_DETAIL_4200 }));
  const b = await getBulletinById('4200');
  assert.equal(b.matches.length, 2);
  const m1 = b.matches.find((m) => m.orderNo === 1);
  assert.equal(m1.homeTeam.name, 'Galatasaray');
  assert.equal(m1.result1x2, '1');
  assert.deepEqual(m1.fullTimeScore, { home: 2, away: 0 });
  assert.equal(m1.status, 'finished');
  assert.equal(m1.halfTimeScore, null, 'yeni motor ilk yarı skorunu TAŞIMAZ (geriye uyumlu alan hep null)');
  const m2 = b.matches.find((m) => m.orderNo === 2);
  assert.equal(m2.result1x2, null);
  assert.equal(m2.status, 'not_started');
  assert.equal(b._finishedCount, 1);
});

test('getSnapshot: mühürlü payload ekran biçimine eşlenir; sonuçlar AYRI kayıttan yanına konur', async () => {
  setArchiveFetcher(apiFetcher({
    '/api/bulletins/4200/snapshot': API_SNAPSHOT_4200,
    '/api/bulletins/4200/results': API_RESULTS_4200,
    '/api/bulletins/4200/evaluation': API_EVAL_4200,
  }));
  const s = await getSnapshot('4200');
  assert.equal(s.isLocked, true);
  assert.equal(s.verificationHash, 'a'.repeat(64));
  assert.equal(s.shortHash, 'aaaaaaaaaa');
  const a1 = s.matchesAnalysis.find((m) => m.matchId === '91001');
  assert.equal(a1.prediction, '1');
  assert.equal(a1.confidenceScore, 52);
  assert.equal(a1.surpriseRisk, 22);
  assert.equal(a1.resultInfo.actualResult, '1');
  assert.equal(a1.resultInfo.systemCorrect, true);
  assert.equal(a1.resultInfo.halfTimeScore, null, 'ilk yarı değerlendirmeye girmez');
  const a2 = s.matchesAnalysis.find((m) => m.matchId === '91002');
  assert.equal(a2.prediction, '1X', 'çifte sembol kullanıcı gösterimiyle eşlenir');
  assert.equal(a2.confidenceScore, null, 'veri yoksa yüzde uydurulmaz');
  assert.equal(a2.resultInfo.systemCorrect, false);
  assert.ok(a2.resultInfo.errorNote.includes('1X'), 'yanlışta dürüst açıklama');
  assert.equal(a2.dataConfidence, 'Düşük');
});

test('snapshot yoksa (aktif bülten): null döner, hata sayılmaz', async () => {
  setArchiveFetcher(apiFetcher({}));
  const s = await getSnapshot('4300');
  assert.equal(s, null);
});

test('DEĞİŞMEZLİK (istemci tarafı): arşiv bülteninde analiz düzenleme her koşulda reddedilir', async () => {
  setArchiveFetcher(apiFetcher({}));
  await assert.rejects(
    () => updateMatchAnalysis('4200', '91001', { analysisComment: 'hack' }),
    /değiştirilemez/,
  );
});

test('ağ hatası kullanıcıya teknik dizge olarak gösterilmez', () => {
  // Arşiv hatası artık ÜRETİMDE de ekrana çıkıyor (örnek veri uydurulmadığı
  // için). Ekranda "ECONNREFUSED" yazması kullanıcıya hiçbir şey anlatmaz.
  for (const ham of ['Network request failed', 'Failed to fetch', 'connect ECONNREFUSED 127.0.0.1:4000', 'Sunucu hatası (503)']) {
    const cikti = humanArchiveError(new Error(ham));
    assert.ok(/tekrar dene/i.test(cikti), `insan diline çevrilmemiş: "${cikti}"`);
    assert.ok(!/ECONNREFUSED|Failed to fetch|Network request failed/i.test(cikti), `teknik dizge sızdı: "${cikti}"`);
  }
  // Sunucunun ANLAMLI mesajı korunur — bilgi gizlenmez.
  assert.equal(humanArchiveError(new Error('Bu bülten arşivde bulunamadı.')), 'Bu bülten arşivde bulunamadı.');
  // Boş/eksik girdide çökmez.
  assert.ok(humanArchiveError(undefined).length > 0);
});

test('mapSnapshot: eksik payload null döner; expand/pick yardımcıları doğru', () => {
  assert.equal(mapSnapshot(null), null);
  assert.deepEqual(expandDisplayPick('1X2'), ['1', 'X', '2']);
  assert.equal(displayPickHits('1X', 'X'), true);
  assert.equal(displayPickHits('1X', '2'), false);
  assert.equal(displayPickHits(null, '1'), null);
});
