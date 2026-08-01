// FREEZE + DEĞİŞMEZLİK TESTLERİ
// Çalıştırma: cd backend && npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFreezeAt, freezeBulletinFromData, registerBulletinFromData,
  recordObservationsFromData, buildSnapshotPayload, getArchiveStatus,
} from '../src/archive/snapshotService.js';
import { hashPayload } from '../src/archive/hash.js';
import { ImmutableError } from '../src/archive/errors.js';
import { tmpStore, makeBulletinData, FREEZE_AT_UTC, deep } from './helpers/fixtures.mjs';

const FREEZE_MS = new Date(FREEZE_AT_UTC).getTime();

test('freezeAt ilk maçtan tam 5 dakika önce hesaplanır (Europe/Istanbul → UTC doğru)', () => {
  const data = makeBulletinData();
  const freezeAt = computeFreezeAt(data.matches);
  // 20:00 +03:00 = 17:00 UTC → freeze 16:55 UTC
  assert.equal(freezeAt, FREEZE_AT_UTC);
  const first = Math.min(...data.matches.map((m) => new Date(m.date).getTime()));
  assert.equal(first - new Date(freezeAt).getTime(), 5 * 60 * 1000);
});

test('freeze zamanı gelmeden kilit atılmaz', async () => {
  const store = tmpStore();
  const data = makeBulletinData();
  const r = await freezeBulletinFromData(data, { store, now: FREEZE_MS - 60 * 1000 });
  assert.equal(r.frozen, false);
  assert.equal(r.reason, 'not_due');
  assert.equal(await store.getSnapshot(String(data.roundId)), null);
});

test('freeze anında snapshot oluşur: kilitli, hash’li, sonuçsuz ve halfTimeScore’suz', async () => {
  const store = tmpStore();
  const data = makeBulletinData();
  await registerBulletinFromData(data, { store, now: FREEZE_MS - 3600e3 });
  const r = await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  assert.equal(r.frozen, true);

  const snap = await store.getSnapshot(String(data.roundId));
  assert.ok(snap, 'snapshot kaydedilmeli');
  assert.equal(snap.immutable, true);
  assert.equal(snap.lockedAt, new Date(FREEZE_MS).toISOString());
  assert.match(snap.payloadHash, /^[0-9a-f]{64}$/);
  assert.equal(hashPayload(snap.payload), snap.payloadHash, 'hash payload ile tutarlı olmalı');

  // Payload'da SONUÇ ve İLK YARI alanı OLMAMALI (yeni motor halfTime kullanmaz).
  const raw = JSON.stringify(snap.payload);
  assert.ok(!/halfTime/i.test(raw), 'snapshot payload halfTimeScore içermemeli');
  assert.ok(!/"officialResult"/.test(raw), 'snapshot payload resmî sonuç içermemeli');
  assert.ok(!/"fullTimeScore"/.test(raw), 'snapshot payload maç sonucu içermemeli');

  // 15 maç, kesin sırayla.
  assert.equal(snap.payload.matches.length, 15);
  assert.deepEqual(snap.payload.matches.map((m) => m.no), Array.from({ length: 15 }, (_, i) => i + 1));

  // Bülten durumu locked + lockedAt.
  const b = await store.getBulletin(String(data.roundId));
  assert.equal(b.status, 'locked');
  assert.ok(b.lockedAt);

  const status = await getArchiveStatus(data.roundId, { store });
  assert.equal(status.immutable, true);
  assert.equal(status.snapshot.exists, true);
  assert.equal(status.snapshot.verificationHash, snap.payloadHash);
});

test('freeze idempotent: tekrar ve EŞZAMANLI çağrılar ikinci snapshot üretmez', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 4201 });
  const [a, b] = await Promise.all([
    freezeBulletinFromData(data, { store, now: FREEZE_MS + 1000 }),
    freezeBulletinFromData(data, { store, now: FREEZE_MS + 1000 }),
  ]);
  const frozenCount = [a, b].filter((x) => x.frozen).length;
  assert.equal(frozenCount, 1, 'yarışta yalnız biri kilitlemeli');
  const again = await freezeBulletinFromData(data, { store, now: FREEZE_MS + 5000 });
  assert.equal(again.frozen, false);
  assert.equal(again.alreadyFrozen, true);
  const snap = await store.getSnapshot('4201');
  assert.ok(snap);
  // Hash sabit: sonraki denemeler mevcut mührü DEĞİŞTİRMEZ.
  assert.equal(again.snapshot.payloadHash, snap.payloadHash);
});

test('kilitli snapshot UPDATE edilemez ve DELETE edilemez', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 4202 });
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  await assert.rejects(() => store.updateSnapshot('4202'), ImmutableError);
  await assert.rejects(() => store.deleteSnapshot('4202'), ImmutableError);
});

test('kilit sonrası maç kimlikleri/sıraları ve bülten zaman alanları değişemez', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 4203 });
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });

  await assert.rejects(() => store.replaceMatches('4203', []), ImmutableError);
  await assert.rejects(
    () => store.upsertBulletin({ id: '4203', roundId: 4203, firstMatchStartAt: '2030-01-01T00:00:00.000Z' }),
    ImmutableError,
  );
  await assert.rejects(
    () => store.upsertBulletin({ id: '4203', roundId: 4203, status: 'active' }),
    ImmutableError,
    'kilitli bülten geri açılamaz',
  );

  // Resmî kaynak kilit sonrası takım adı değiştirirse: SESSİZCE uygulanmaz, audit'e yazılır.
  const changed = deep(data);
  changed.matches[0].home.name = 'BAŞKA TAKIM';
  changed.matches[1].no = 99;
  await registerBulletinFromData(changed, { store, now: FREEZE_MS + 1000 });
  const stored = await store.getMatches('4203');
  assert.equal(stored.find((m) => m.orderNo === 1).homeName, 'Galatasaray', 'kilitli kimlik korunmalı');
  const audit = await store.listAudit('4203');
  const rejected = audit.filter((a) => a.action === 'rejected_identity_change' && a.rejected);
  assert.ok(rejected.length >= 1, 'reddedilen değişiklik audit’e yazılmalı');
  assert.ok(rejected[0].reason, 'reddetme gerekçesi olmalı');
});

test('sunucu freeze anında kapalıysa: sonradan alınan snapshot "late" işaretlenir, veri anı açık yazılır', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 4204 });
  const lateNow = FREEZE_MS + 45 * 60 * 1000; // 45 dk gecikme (yeniden açılış)
  const r = await freezeBulletinFromData(data, { store, now: lateNow });
  assert.equal(r.frozen, true);
  const snap = await store.getSnapshot('4204');
  assert.equal(snap.late, true);
  assert.equal(snap.payload.lock.late, true);
  assert.equal(snap.payload.lock.dataObservedAt, new Date(lateNow).toISOString());
  assert.ok(snap.payload.lock.note.includes('geriye dönük veri uydurulmadı'));
});

test('eksik veri: sahte değer üretilmez — alanlar null + "veri yok" notu', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 4205, noDataAt: 7 });
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  const snap = await store.getSnapshot('4205');
  const m7 = snap.payload.matches.find((m) => m.no === 7);
  assert.equal(m7.market.odds, null);
  assert.equal(m7.market.probabilities, null);
  assert.equal(m7.teamData, null);
  assert.equal(m7.criteria.signals, null);
  assert.equal(m7.dataQuality.matched, false);
  assert.ok(m7.dataQuality.reason, 'eksikliğin sebebi yazılmalı');
  assert.equal(m7.confidence.dataConfidence, 'Düşük');
  // Eksik oyuncu / hoca verisi kaynak yok → null + açık not; asla uydurma liste yok.
  for (const m of snap.payload.matches) {
    assert.equal(m.missingPlayers, null);
    assert.ok(m.missingPlayersNote.includes('bulunamadı'));
    assert.equal(m.managerChange, null);
    assert.equal(m.market.playedPercentages, null, 'oynanma yüzdesi kaynağı yok → null');
    assert.notEqual(m.confidence.dataConfidence, 'Yüksek', 'eksik oyuncu/hoca verisi yokken güven asla Yüksek olamaz');
  }
});

test('gözlemler kilide kadar toplanır; kilitten sonra yazılmaz', async () => {
  const store = tmpStore();
  const data = makeBulletinData({ roundId: 4206 });
  await registerBulletinFromData(data, { store, now: FREEZE_MS - 7200e3 });
  const n1 = await recordObservationsFromData(data, { store, now: FREEZE_MS - 7200e3 });
  assert.equal(n1, 15);
  const n2 = await recordObservationsFromData(data, { store, now: FREEZE_MS - 3600e3 });
  assert.equal(n2, 15);
  await freezeBulletinFromData(data, { store, now: FREEZE_MS });
  const n3 = await recordObservationsFromData(data, { store, now: FREEZE_MS + 1000 });
  assert.equal(n3, 0, 'kilit sonrası gözlem yazılmamalı');
  const obs = await store.listObservations('4206');
  assert.equal(obs.length, 30);
  // Gözlemde oynanma yüzdesi kaynağı yok → null (uydurma yok); oranlar gerçek alandan.
  assert.ok(obs.every((o) => o.playedPct === null));
  assert.ok(obs.some((o) => o.odds && o.odds.home === 1.85));
  // Snapshot payload'ı gözlem serisine SAYI + REFERANS ile bağlanır.
  const payload = await buildSnapshotPayload(data, { store, now: FREEZE_MS, frozenAt: new Date(FREEZE_MS).toISOString() });
  const m1 = payload.matches.find((m) => m.no === 1);
  assert.equal(m1.observationSeries.count, 2);
  assert.ok(m1.observationSeries.ref.includes('/observations'));
});
