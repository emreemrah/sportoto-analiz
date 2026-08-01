// DEĞİŞMEZLİK & ÖĞRENME SINIRI TESTLERİ (görev I) + kullanıcı dili (görev E)
// Radar Merkezi'ne yeni DNA kaynaklarının SIZDIRMAZLIK kuralları:
//  * post_lock gözlem tahmine giremez, geçmiş arşiv güncel haftaya sızamaz,
//  * kilitli snapshot yeni veriyle DEĞİŞMEZ, güncel sonuç DNA'ya aynı hafta giremez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-dnab-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-dnab-arsiv-'));
// Sürücü sabitlenir: .env'de Supabase varsa depo gerçek arşive kayar (bkz. api.test.mjs).
process.env.ARCHIVE_DRIVER = 'file';
process.env.HISTORY_DIR = mkdtempSync(join(tmpdir(), 'sportoto-dnab-hist-'));
process.env.HISTORY_DRIVER = 'file';

const { _resetArchiveStoreForTests, getArchiveStore } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { _resetHistoryStoreForTests, getHistoryStore } = await import('../src/history/historyStore.js');
_resetHistoryStoreForTests();
const { computeRadarCenterForData } = await import('../src/radar/radarService.js');
const { registerBulletinFromData, freezeBulletinFromData } = await import('../src/archive/snapshotService.js');
const { CLASSIFICATION_LABELS, RADAR_META, RADAR_IDS } = await import('../src/radar/config.js');
const { combineMaster } = await import('../src/radar/masterRadar.js');

const H = 3600e3;
const NOW = Date.UTC(2026, 6, 22, 10, 0);            // 2026-07-22 10:00Z
const KICKOFF = new Date(NOW + 6 * H).toISOString(); // ilk maç +6 saat
const FREEZE = new Date(NOW + 6 * H - 5 * 60e3).toISOString();

const mkData = (roundId = 1525) => ({
  roundId, round: `${roundId}. Hafta`, year: '2026',
  matches: Array.from({ length: 15 }, (_, i) => ({
    no: i + 1, sportotoMatchId: `m${i + 1}`,
    home: { name: `Ev${i + 1}` }, away: { name: `Dep${i + 1}` },
    date: new Date(new Date(KICKOFF).getTime() + i * H).toISOString(),
  })),
});

// Arşiv deposu üstüne gözlem enjeksiyonu için ince sarmalayıcı
function storeWithObservations(obs) {
  const real = getArchiveStore();
  return new Proxy(real, {
    get(t, k) {
      if (k === 'listObservations') return async () => obs;
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

test('1. MÜHÜR SINIRI: post_lock_research + donma sonrası gözlem Radar 3\'e GİREMEZ', async () => {
  const preFreeze = new Date(NOW).toISOString();
  const postFreeze = new Date(new Date(FREEZE).getTime() + 10 * 60e3).toISOString();
  const obs = [
    { matchId: 'm1', source: 'prov', observedAt: preFreeze, playedPct: { '1': 50, X: 30, '2': 20 }, kind: 'regular', usableForPrediction: true },
    { matchId: 'm1', source: 'prov', observedAt: postFreeze, playedPct: { '1': 90, X: 5, '2': 5 }, kind: 'post_lock_research', usableForPrediction: false },
    { matchId: 'm1', source: 'prov', observedAt: postFreeze, playedPct: { '1': 88, X: 7, '2': 5 }, kind: 'regular', usableForPrediction: true }, // kind doğru olsa bile donma SONRASI zaman → dışarıda
  ];
  const view = await computeRadarCenterForData(mkData(), { store: storeWithObservations(obs), now: NOW });
  const r3 = view.matches[0].radars[RADAR_IDS.PUBLIC];
  assert.equal(r3.hasData, true);
  const prov = r3.details.providers.find((p) => p.provider === 'prov');
  assert.equal(prov.observations, 1, 'yalnız donma öncesi geçerli gözlem sayıldı');
  assert.deepEqual({ ...prov.last, observedAt: undefined }, { '1': 50, X: 30, '2': 20, observedAt: undefined }, 'post_lock %90 değeri karara SIZMADI');
});

test('2. ÖĞRENME SINIRI: geçmiş arşiv yalnız roundId < güncel olan haftalardan Radar 5\'e akar', async () => {
  const hist = getHistoryStore();
  const mkRow = (pos, result) => ({
    position: pos, homeTeam: 'A', awayTeam: 'B', matchAt: '2026-01-01T12:00:00Z',
    scoreHome: 1, scoreAway: 0, result, resultValid: true, conflict: null,
    sourceHash: 'h', observedAt: 'x', fetchedAt: 'x', provenanceType: 'official_result_history', correctionVersion: 1,
  });
  // Geçmiş hafta (1400: tamam) + GÜNCEL hafta kaydı (1525: asla girmemeli) + gelecek (1600)
  await hist.upsertRound({ roundId: '1400', seasonYear: '2025-2026', status: 'completed', roundCloseAt: '2026-01-02T00:00:00Z' });
  await hist.putMatches('1400', Array.from({ length: 15 }, (_, i) => mkRow(i + 1, '1')));
  await hist.upsertRound({ roundId: '1525', seasonYear: '2025-2026', status: 'completed', roundCloseAt: '2026-07-20T00:00:00Z' });
  await hist.putMatches('1525', Array.from({ length: 15 }, (_, i) => mkRow(i + 1, '2')));
  await hist.upsertRound({ roundId: '1600', seasonYear: '2026-2027', status: 'completed', roundCloseAt: '2027-01-02T00:00:00Z' });
  await hist.putMatches('1600', Array.from({ length: 15 }, (_, i) => mkRow(i + 1, '2')));

  const view = await computeRadarCenterForData(mkData(1525), { store: getArchiveStore(), now: NOW });
  // Radar 5 maç detayında sıra istatistiği geçmiş arşivden gelir:
  const r5 = view.matches[0].radars[RADAR_IDS.MEMORY];
  const memPos = r5.details?.position || null;
  assert.ok(memPos, 'hafıza bağlamı geçmiş arşivle doldu');
  assert.equal(memPos.sample, 1, 'yalnız 1400 sayıldı');
  assert.equal(memPos.counts['1'], 1, 'güncel (1525) ve sonrası (1600) SIZMADI');
  // Geçmiş arşiv YÖN skoru üretmez (yardımcı sinyal kuralı):
  assert.ok(r5.scores == null);
});

test('3. KİLİTLİ SNAPSHOT: sonradan gelen geçmiş arşiv/gözlem mühürlü payload hash\'ini DEĞİŞTİREMEZ', async () => {
  const store = getArchiveStore();
  const data = mkData(1500);
  // Donma anı geçmiş bir bülteni kilitle:
  const past = { ...data, matches: data.matches.map((m) => ({ ...m, date: new Date(NOW - 2 * H).toISOString() })) };
  await registerBulletinFromData(past, { store, now: NOW - 3 * H });
  const frozen = await freezeBulletinFromData(past, { store, now: NOW });
  assert.ok(frozen.snapshot, 'snapshot alındı');
  const hashBefore = frozen.snapshot.payloadHash;

  // Kilitten SONRA: yeni geçmiş arşiv haftası + yeni gözlem eklensin
  const hist = getHistoryStore();
  await hist.upsertRound({ roundId: '1499', seasonYear: '2025-2026', status: 'completed', roundCloseAt: '2026-05-02T00:00:00Z' });
  await hist.putMatches('1499', [{ position: 1, result: 'X', resultValid: true, scoreHome: 0, scoreAway: 0, sourceHash: 'q', provenanceType: 'official_result_history', correctionVersion: 1 }]);
  await store.addObservations('1500', [{ matchId: 'm1', source: 'prov', observedAt: new Date(NOW + H).toISOString(), playedPct: { '1': 99, X: 1, '2': 0 }, kind: 'post_lock_research', usableForPrediction: false }]);

  const snap = await store.getSnapshot('1500');
  assert.equal(snap.payloadHash, hashBefore, 'mühürlü hash bit bit AYNI');
  const again = await freezeBulletinFromData(past, { store, now: NOW + 2 * H });
  assert.equal(again.alreadyFrozen, true, 'ikinci freeze yeni snapshot ÜRETMEZ');
  assert.equal(again.snapshot.payloadHash, hashBefore, 'yeniden freeze denemesi aynı snapshot\'ı döndürür');
});

test('4. Kullanıcı dili: Temkinli / Sürpriz Sinyali / Analiz Hazır Değil + radar adları', () => {
  assert.equal(CLASSIFICATION_LABELS.medium_risk, 'Temkinli');
  assert.equal(CLASSIFICATION_LABELS.surprise_candidate, 'Sürpriz Sinyali');
  assert.equal(CLASSIFICATION_LABELS.insufficient_data, 'Analiz Hazır Değil');
  assert.equal(CLASSIFICATION_LABELS.strong_candidate, 'Güçlü Aday');
  assert.match(RADAR_META[RADAR_IDS.PERFORMANCE].name, /Rakip Gücü/);
  assert.match(RADAR_META[RADAR_IDS.PUBLIC].name, /Oynanma DNA/);
  assert.match(RADAR_META[RADAR_IDS.MEMORY].name, /Bülten DNA/);
});

test('5. unsupported alanlar Master eksik-veri listesinde TEKRARLANMAZ; match_missing kalır', () => {
  const radars = {
    performance: {
      id: 'performance', name: 'Radar 1', hasData: true, dataQuality: 80, homeScore: 50, drawScore: 25, awayScore: 25,
      scores: { home: 50, draw: 25, away: 25 }, direction: '1', favoriteFailureRisk: 30,
      missingSignals: [
        { key: 'missingPlayers', label: 'Eksik oyuncular', reason: 'Kaynak yok.', availability: 'unsupported' },
        { key: 'shots', label: 'Şut verisi', reason: 'Bu maçta yok.', availability: 'match_missing' },
      ],
      positives: [], negatives: [],
    },
  };
  const master = combineMaster(radars);
  const reasons = master.missingData.map((x) => x.reason).join(' | ');
  assert.ok(!reasons.includes('Eksik oyuncular'), 'unsupported alan LİSTELENMEZ (metodolojide bir kez açıklanır)');
  assert.ok(reasons.includes('Şut verisi'), 'match_missing dürüstçe listelenir');
});

test('6. GEÇMİŞE TAHMİN YAZILMAZ: geçmiş arşiv haftası için radar/tahmin kaydı üretilmemiş olmalı', async () => {
  // computeRadarCenterForData yalnız GÜNCEL bülten verisiyle çağrılır; geçmiş
  // arşiv haftaları (1400/1499) için radar cache dosyası oluşmamalı.
  const { load } = await import('../src/cache.js');
  assert.equal(load('radar-1400'), null, 'geçmiş haftaya radar yazılmadı');
  assert.equal(load('radar-1499'), null);
  // Snapshot deposunda da yalnız bilerek kilitlediğimiz 1500 var:
  const store = getArchiveStore();
  const all = await store.listBulletins();
  const ids = all.map((b) => String(b.roundId));
  assert.ok(!ids.includes('1400') && !ids.includes('1499'), 'geçmiş arşiv haftaları ileri-test arşivine SIZMADI');
});

test('7. GET /api/radar/position-dna + /history-archive: öğrenme sınırlı, dürüst uçlar', async () => {
  const express = (await import('express')).default;
  const { save } = await import('../src/cache.js');
  save('bulletin', { roundId: 1525, round: '1525. Hafta', matches: [] });
  const router = (await import('../src/routes/radar.js')).default;
  const app = express();
  app.use('/api/radar', router);
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const dna = await (await fetch(`${base}/api/radar/position-dna`)).json();
    assert.equal(dna.hasData, true);
    // Öğrenme sınırı: 1400 (15 maç) + 1499 (1 maç) sayılır; 1525 ve 1600 SAYILMAZ.
    assert.equal(dna.dna.totalMatches, 16, 'güncel hafta ve sonrası uçtan da SIZMAZ');
    const p1 = dna.dna.positions.find((p) => p.position === 1);
    assert.equal(p1.sample, 2);
    assert.match(dna.disclaimer, /yardımcı sinyal/);
    assert.ok(Array.isArray(dna.examples) && dna.examples.length === 2, '4. ve 14. sıra örnek cümleleri');

    const arch = await (await fetch(`${base}/api/radar/history-archive`)).json();
    assert.equal(arch.hasData, true);
    assert.ok(arch.totalBulletins >= 2);
    assert.ok(!JSON.stringify(arch).match(/seasonId|endpoint|\.env|npm/i), 'teknik sızıntı yok');
  } finally {
    server.close();
  }
});
