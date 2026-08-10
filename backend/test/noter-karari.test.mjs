// NOTER KARARI — ertelenen maçın resmî işareti (2026-08-10).
//
// GERÇEK OLAY: 53. Hafta 14. maç (Raków–Zagłębie) ertelendi; sonuç
// sağlayıcıdan asla gelmeyeceği için hafta sonsuza dek 'locked' kaldı ve
// kullanıcı "sonuçlar yansımamış" gördü. Sözleşme:
//  (a) recordNotaryResult YALNIZ sonucu olmayan maça yazar (skor NULL,
//      resultType='notary_decision', audit'li) ve hafta 15/15'e ulaşınca
//      tamamlama + değerlendirme tetiklenir; satır viaNotary taşır.
//  (b) Var olan sonuca noter kararı YAZILAMAZ (resmî sonuca dokunmama kuralı).
//  (c) Radar karnesi noter maçını motor isabetine SAYMAZ — maç oynanmadı,
//      tahmin sınanamadı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-noter-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-noter-arsiv-'));
process.env.ARCHIVE_DRIVER = 'file';
process.env.HISTORY_DRIVER = 'file';
process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-noter-gecmis-'));

const { _resetArchiveStoreForTests, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { recordNotaryResult } = await import('../src/archive/resultsService.js');
const { buildRadarScorecard } = await import('../src/radar/scorecard.js');

const store = getArchiveStore();
const T0 = new Date('2026-08-08T13:55:00Z').getTime();
const iso = (t) => new Date(t).toISOString();

// ---- (a)+(b): dosya deposunda uçtan uca ------------------------------------
const RID = '9001';
await store.upsertBulletin({
  id: RID, roundId: 9001, week: '99. Hafta', season: '2025/2026', status: 'active',
  freezeAt: iso(T0), firstMatchStartAt: iso(T0 + 5 * 60e3), lockedAt: iso(T0),
});
await store.replaceMatches(RID, [
  { matchId: 'm1', orderNo: 1, homeName: 'Ev1', awayName: 'Dep1' },
  { matchId: 'm2', orderNo: 2, homeName: 'Ev2', awayName: 'Dep2' },
]);
await store.createSnapshot({
  bulletinId: RID, payloadHash: 'noter-hash', immutable: true, late: false,
  createdAt: iso(T0 - 3600e3), lockedAt: iso(T0), dataObservedAt: iso(T0 - 60e3),
  payload: {
    bulletin: { roundId: 9001, week: '99. Hafta', season: '2025/2026', freezeAt: iso(T0) },
    matches: [
      { no: 1, matchId: 'm1', systemPrediction: { symbol: '1' } },
      { no: 2, matchId: 'm2', systemPrediction: { symbol: 'X' } },
    ],
  },
});
// 1. maçın NORMAL resmî sonucu (oynandı).
await store.upsertOfficialResult({
  bulletinId: RID, matchId: 'm1', orderNo: 1,
  officialResult: '1', fullTimeScore: { home: 2, away: 0 }, resultSource: 'test',
});

test('(a) noter kararı sonuçsuz maça yazılır, haftayı tamamlar, satır viaNotary taşır', async () => {
  const durum = await recordNotaryResult(RID, { orderNo: 2, sonuc: '1' }, { store });
  assert.equal(durum.completed, true, 'son eksik sonuç noterle geldi → hafta tamamlandı');

  const b = await store.getBulletin(RID);
  assert.equal(b.status, 'completed');

  const rows = await store.listOfficialResults(RID);
  const noter = rows.find((r) => r.matchId === 'm2');
  assert.equal(noter.officialResult, '1');
  assert.equal(noter.fullTimeScore, null, 'oynanmamış maça skor uydurulmaz');
  assert.equal(noter.resultType, 'notary_decision');

  const ev = await store.getEvaluation(RID);
  const satir = ev.matches.find((m) => m.matchId === 'm2');
  assert.equal(satir.viaNotary, true, 'değerlendirme satırı noter işareti taşır');
  assert.equal(satir.officialResult, '1');
  // Kupon kuralı: frozen '2. sıra X' noter işareti '1'e karşı — tutmadı.
  assert.equal(satir.correct, false);
  const normal = ev.matches.find((m) => m.matchId === 'm1');
  assert.equal(normal.viaNotary, undefined, 'normal satırda alan yok');

  const audit = await store.listAudit(RID);
  assert.ok(audit.some((a) => a.action === 'notary_result'), 'giriş audit kaydı bıraktı');
});

test('(b) sonucu OLAN maça noter kararı yazılamaz', async () => {
  await assert.rejects(
    () => recordNotaryResult(RID, { orderNo: 1, sonuc: 'X' }, { store }),
    /zaten var/,
    'resmî sonuca dokunmama kuralı: mevcut sonuç değiştirilemez',
  );
  const rows = await store.listOfficialResults(RID);
  const m1 = rows.find((r) => r.matchId === 'm1');
  assert.equal(m1.officialResult, '1', 'mevcut sonuç aynen duruyor');
});

// ---- (d): Supabase yolu — 012 göçü UYGULANMADAN da çalışır -----------------
// Canlı şemada full_time_score NOT NULL ve result_type kolonu YOK (göç
// bekliyor). Yazım: skor alanları null bir nesne (uydurma skor değil, "skor
// yok"un şema-uyumlu hâli) + result_type kolonu hiç gönderilmez. Okuma:
// nesne NULL'a normalize edilir, kimlik kaynak sabitinden türetilir — dosya
// deposuyla AYNI şekil döner.
test('(d) Supabase deposu noter kaydını göçsüz şemayla yazar ve doğru okur', async () => {
  const { SupabaseArchiveStore } = await import('../src/archive/supabaseStore.js');
  const satirlar = [];
  const fakeSb = {
    from(table) {
      assert.equal(table, 'match_official_results');
      return {
        insert(v) { satirlar.push(v); return Promise.resolve({ error: null }); },
        select() {
          return {
            eq() { return { order: () => Promise.resolve({ data: [...satirlar], error: null }) }; },
          };
        },
      };
    },
  };
  const sbStore = new SupabaseArchiveStore(fakeSb);

  await sbStore.upsertOfficialResult({
    bulletinId: '1527', matchId: 'm14', orderNo: 14,
    officialResult: '1', fullTimeScore: null,
    resultSource: 'Noter kararı', resultType: 'notary_decision',
  });

  assert.equal(satirlar.length, 1);
  assert.deepEqual(satirlar[0].full_time_score, { home: null, away: null },
    'NOT NULL kısıtına takılmaz ama skor da uydurulmaz');
  assert.ok(!('result_type' in satirlar[0]),
    'kolonsuz şemada result_type gönderilmez (column does not exist hatası çıkmaz)');

  const okunan = await sbStore.listOfficialResults('1527');
  assert.equal(okunan[0].resultType, 'notary_decision', 'kimlik kaynaktan türetilir');
  assert.equal(okunan[0].fullTimeScore, null, 'boş skor nesnesi NULL normalize edilir');
});

// ---- (c): radar karnesi noter maçını saymaz (stub store) -------------------
const mkRc = (main) => ({
  master: {
    mainPrediction: main, classification: 'medium_risk',
    favorite: { symbol: main }, methodologyVersion: 'test', dataQuality: 80,
  },
  radars: {},
});

test('(c) radar karnesi noter maçını motor isabetine SAYMAZ', async () => {
  const bulletin = {
    id: '9100', roundId: 9100, week: '100. Hafta', season: '2025/2026', status: 'completed',
    freezeAt: iso(T0), firstMatchStartAt: iso(T0 + 5 * 60e3), lockedAt: iso(T0),
  };
  const snap = {
    id: 'snap-9100', bulletinId: '9100', payloadHash: 'h-9100', immutable: true, late: false,
    createdAt: iso(T0 - 3600e3), lockedAt: iso(T0), dataObservedAt: iso(T0 - 60e3),
    payload: {
      bulletin: { roundId: 9100, week: '100. Hafta', season: '2025/2026', freezeAt: iso(T0), firstMatchStartAt: iso(T0 + 5 * 60e3) },
      engine: { analysisEngineVersion: 'engine-test-1' },
      analysisCenter: { officialProfile: { version: 3 } },
      matches: [
        { no: 1, matchId: 'a1', radarCenter: mkRc('1') },
        { no: 2, matchId: 'a2', radarCenter: mkRc('X') },
      ],
    },
  };
  const results = [
    { matchId: 'a1', officialResult: '1', fullTimeScore: { home: 1, away: 0 } },
    { matchId: 'a2', officialResult: 'X', fullTimeScore: null, resultType: 'notary_decision' },
  ];
  const stub = {
    listBulletins: async () => [bulletin],
    getSnapshot: async () => snap,
    listOfficialResults: async () => results,
  };
  const sc = await buildRadarScorecard({ store: stub });
  // Noter maçı (a2) sayılsaydı evaluated 2 ve isabet 2/2 olurdu.
  assert.equal(sc.master.allTime.evaluated, 1, 'yalnız oynanan maç karneye girer');
  assert.equal(sc.master.allTime.mainAccuracy.total, 1);
  assert.equal(sc.master.allTime.mainAccuracy.hit, 1);
});
