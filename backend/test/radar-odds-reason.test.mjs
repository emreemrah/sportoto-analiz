// RADAR 4 — EKSİK ORANIN SEBEBİ. Regresyon kilidi.
//
// Kök sorun: oranı olmayan maçların HEPSİNE aynı cümle ("Bu gün için oran kaydı
// yok") yazılıyordu. Oysa boşluğun arkasında yapısal olarak FARKLI sebepler var
// ve kullanıcı için anlamları da farklı: kapsam dışı maça oran HİÇ gelmeyecek,
// kapsam içindekine gelebilir, mühür boşluğu ise veri toplama sorunudur.
//
// Bu dosyanın koruduğu iki kural birlikte okunmalıdır:
//   1) SEBEP YAZILIR — her boş hücre kendi gerekçesini taşır.
//   2) ORAN UYDURULMAZ — sebep yazmak, değer üretmenin bahanesi değildir.
//      Hücre `null` KALIR; önceki günün oranı taşınmaz (geriye dönük üretim yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-oran-sebep-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-oran-sebep-arsiv-'));
// Sürücü sabitlenir: .env'de Supabase varsa depo gerçek arşive kayar.
process.env.ARCHIVE_DRIVER = 'file';

const { buildDailyOdds, buildDailyPlayed } = await import('../src/radar/dailyOdds.js');

// --- ortak zemin: Çarşamba "şimdi", Cuma ilk maç -----------------------------
const SIMDI = new Date('2026-07-29T14:00:00+03:00').getTime();   // Çarşamba
const ILK_MAC = new Date('2026-07-31T20:00:00+03:00').getTime(); // Cuma
const PAZAR = '2026-07-26', PZT = '2026-07-27', SALI = '2026-07-28';
const CARSAMBA = '2026-07-29', PERSEMBE = '2026-07-30', CUMA = '2026-07-31';

const mac = (no, coverage, kickoffMs = ILK_MAC) => ({
  no, matchId: String(no), home: `Ev ${no}`, away: `Dep ${no}`,
  kickoffAt: new Date(kickoffMs).toISOString(), coverage,
});
const gozlem = (matchId, iso, odds) => ({ matchId, observedAt: iso, odds, source: 'test' });
const kur = (matches, observations = [], extra = {}) =>
  buildDailyOdds({ roundId: 1526, matches, observations, firstKickoffMs: ILK_MAC, now: SIMDI, ...extra });

// ---------------------------------------------------------------------------
// A) MAÇ BAZINDA SEBEP
// ---------------------------------------------------------------------------

test('kapsam dışı maç: sebep "kapsam dışında" + kapsam raporunun GERÇEK cümlesi', () => {
  const r = kur([mac(1, { ok: false, reason: 'Union St.Gilloise için analiz verisi bulunamadı', code: 'team_not_in_source' })]);
  const m = r.matches[0];
  assert.equal(m.hasAny, false);
  assert.equal(m.absence.code, 'out_of_coverage');
  assert.match(m.absence.text, /kapsamı dışında/);
  assert.equal(m.absence.detail, 'Union St.Gilloise için analiz verisi bulunamadı',
    'kapsam raporundaki gerçek sebep aynen taşınmalı — yeniden yazılmamalı');
  assert.equal(m.absence.willArrive, false, 'kapsam dışı maça oran GELMEYECEK');
});

test('kapsam içinde ama kaynak yayınlamamış: "henüz yayınlanmadı" + kalan gün', () => {
  const r = kur([mac(2, { ok: true, reason: null })]);
  const m = r.matches[0];
  assert.equal(m.absence.code, 'not_published_yet');
  assert.match(m.absence.text, /henüz yayınlanmadı/);
  assert.match(m.absence.text, /maça 2 gün var/, 'Çarşamba → Cuma = 2 takvim günü');
  assert.equal(m.absence.willArrive, true);
});

test('kapsam BİLİNMİYOR (arşiv haftası): söz verilmez, "kayıt henüz alınamadı" denir', () => {
  const r = kur([mac(3, null)]);
  const m = r.matches[0];
  assert.equal(m.absence.code, 'not_recorded_yet');
  assert.equal(m.absence.willArrive, null, 'bilinmeyen kapsamda gelecek VAAT EDİLMEZ');
  assert.ok(!/yayınlanmadı/.test(m.absence.text),
    'kapsam bilinmiyorken "kaynak yayınlamadı" demek uydurma sebeptir');
});

test('maç geçmiş ve hiç kayıt yok: "hiç kayıt alınamadı" (artık gelmeyecek)', () => {
  const gecmis = new Date('2026-07-27T20:00:00+03:00').getTime();
  const r = buildDailyOdds({
    matches: [mac(4, { ok: true, reason: null }, gecmis)], observations: [],
    firstKickoffMs: gecmis, now: SIMDI,
  });
  const m = r.matches[0];
  assert.equal(m.absence.code, 'never_recorded');
  assert.equal(m.absence.willArrive, false);
});

test('verisi OLAN maçta absence yazılmaz (yanlış alarm yok)', () => {
  const r = kur([mac(5, { ok: true })], [gozlem('5', '2026-07-27T18:00:00+03:00', { home: 2.1, draw: 3.4, away: 3.2 })]);
  assert.equal(r.matches[0].hasAny, true);
  assert.equal(r.matches[0].absence, null);
});

// ---------------------------------------------------------------------------
// B) GÜN BAZINDA SEBEP — sıralama kritik
// ---------------------------------------------------------------------------

test('gün sebepleri: mühür boşluğu / gün açık / gün gelmedi ayrı ayrı yazılır', () => {
  const r = kur([mac(5, { ok: true })], [gozlem('5', '2026-07-27T18:00:00+03:00', { home: 2.1, draw: 3.4, away: 3.2 })]);
  const n = r.matches[0].notes;
  assert.equal(n[PZT], undefined, 'verisi olan güne sebep yazılmaz');
  assert.equal(n[PAZAR].code, 'seal_missed', 'kapanmış gün + veri yok → mühür alınamadı');
  assert.equal(n[SALI].code, 'seal_missed');
  assert.equal(n[CARSAMBA].code, 'day_open', 'bugün henüz kapanmadı → mühür kaçtı denemez');
  assert.equal(n[PERSEMBE].code, 'day_not_reached');
  assert.equal(n[CUMA].code, 'day_not_reached');
});

test('kilit sonrası gün, "henüz gelmedi"yi EZER — boş umut yazılmaz', () => {
  const r = kur([mac(5, { ok: true })], [gozlem('5', '2026-07-27T18:00:00+03:00', { home: 2.1, draw: 3.4, away: 3.2 })],
    { freezeAt: new Date('2026-07-28T19:55:00+03:00').toISOString() });
  const n = r.matches[0].notes;
  assert.equal(n[PERSEMBE].code, 'after_lock', 'kilitli bültende gelecek gün de ASLA dolmaz');
  assert.equal(n[CUMA].code, 'after_lock');
  assert.ok(!/henüz gelmedi/.test(n[PERSEMBE].text), 'kilitliyken "henüz gelmedi" yanıltıcıdır');
});

test('maça özel sebep, gerçekleşmiş günlerin hepsine yazılır; gelecek gün ayrı kalır', () => {
  const r = kur([mac(1, { ok: false, reason: 'Maç verisi eşleştirilemedi', code: 'fixture_not_matched' })]);
  const n = r.matches[1 - 1].notes;
  for (const g of [PAZAR, PZT, SALI, CARSAMBA]) {
    assert.equal(n[g].code, 'out_of_coverage', `${g}: maça özel sebep yazılmalı`);
    assert.equal(n[g].detail, 'Maç verisi eşleştirilemedi');
  }
  assert.equal(n[PERSEMBE].code, 'day_not_reached', 'gelmemiş gün yapısal sebebini korur');
});

// ---------------------------------------------------------------------------
// C) ALTIN KURAL — sebep yazmak, oran üretmenin bahanesi değildir
// ---------------------------------------------------------------------------

test('ALTIN KURAL: boş hücre null KALIR; önceki günün oranı taşınmaz', () => {
  const r = kur([mac(5, { ok: true })], [gozlem('5', '2026-07-27T18:00:00+03:00', { home: 2.1, draw: 3.4, away: 3.2 })]);
  const c = r.matches[0].cells;
  assert.deepEqual(c[PZT].odds, { home: 2.1, draw: 3.4, away: 3.2 });
  for (const g of [PAZAR, SALI, CARSAMBA, PERSEMBE, CUMA]) {
    assert.equal(c[g], null, `${g}: gözlem yokken hücre null kalmalı (geriye/ileriye oran ÜRETİLMEZ)`);
  }
});

test('sebep nesnesi ORAN ALANI TAŞIMAZ (sebep, değerin yerine geçemez)', () => {
  const r = kur([mac(1, { ok: false, reason: 'Maç verisi eşleştirilemedi' }), mac(2, { ok: true })]);
  for (const m of r.matches) {
    for (const not of Object.values(m.notes)) {
      assert.ok(!('odds' in not) && !('home' in not) && !('draw' in not) && !('away' in not),
        `sebep nesnesine oran sızmış: ${JSON.stringify(not)}`);
    }
    if (m.absence) {
      assert.ok(!('odds' in m.absence), 'absence nesnesine oran sızmış');
    }
  }
});

test('sebep metinlerinde MARKA ADI geçmez (arayüz kuralı)', () => {
  const r = kur([
    mac(1, { ok: false, reason: 'Bu lig için güncel kaynak verisi bulunamadı' }),
    mac(2, { ok: true }), mac(3, null),
  ]);
  const metinler = [];
  for (const m of r.matches) {
    if (m.absence) metinler.push(m.absence.text, m.absence.detail || '');
    for (const n of Object.values(m.notes)) metinler.push(n.text, n.detail || '');
  }
  const yasak = /footystats|bilyoner|nesine|misli|api-football/i;
  for (const t of metinler) assert.ok(!yasak.test(t), `sebep metninde marka adı var: ${t}`);
});

// ---------------------------------------------------------------------------
// D) SAYAÇ — "15 maçın 5'inde oran var"
// ---------------------------------------------------------------------------

test('sayaç gerçek sayıdır: haftalık toplam + GÜNLÜK dolu maç sayısı', () => {
  const r = kur(
    [mac(1, { ok: false, reason: 'x' }), mac(2, { ok: true }), mac(5, { ok: true }), mac(6, { ok: true })],
    [
      gozlem('5', '2026-07-27T18:00:00+03:00', { home: 2.1, draw: 3.4, away: 3.2 }),
      gozlem('6', '2026-07-27T19:00:00+03:00', { home: 1.7, draw: 3.8, away: 4.5 }),
      gozlem('6', '2026-07-28T19:00:00+03:00', { home: 1.8, draw: 3.7, away: 4.4 }),
    ],
  );
  assert.deepEqual(r.counts, { total: 4, withAny: 2, withoutAny: 2 });
  const gun = (d) => r.days.find((x) => x.date === d);
  assert.equal(gun(PAZAR).withData, 0);
  assert.equal(gun(PZT).withData, 2, 'Pazartesi iki maçta oran var');
  assert.equal(gun(SALI).withData, 1, 'Salı yalnız bir maçta mühür alınmış');
  assert.equal(gun(CUMA).withData, 0);
});

test('sayaç maç sayısını ŞİŞİRMEZ: dolu gün sayısı toplam maçı geçemez', () => {
  const r = kur([mac(5, { ok: true })], [
    gozlem('5', '2026-07-27T10:00:00+03:00', { home: 2.1, draw: 3.4, away: 3.2 }),
    gozlem('5', '2026-07-27T22:00:00+03:00', { home: 2.0, draw: 3.5, away: 3.3 }),
  ]);
  assert.equal(r.days.find((d) => d.date === PZT).withData, 1,
    'aynı maçın iki gözlemi iki maç sayılmamalı');
  assert.equal(r.counts.total, 1);
});

// ---------------------------------------------------------------------------
// E) RADAR 3 SINIRI — kapsam yalnız ORANI açıklar
// ---------------------------------------------------------------------------

test('Radar 3 (oynanma yüzdesi) eksikliği KAPSAMLA açıklanmaz — ayrı kaynaktır', () => {
  const r = buildDailyPlayed({
    matches: [mac(1, { ok: false, reason: 'Maç verisi eşleştirilemedi' })],
    observations: [], firstKickoffMs: ILK_MAC, now: SIMDI,
  });
  const m = r.matches[0];
  assert.notEqual(m.absence.code, 'out_of_coverage',
    'oynanma yüzdesi ayrı sağlayıcılardan gelir; oran kapsamıyla açıklamak yanlış sebeptir');
  assert.match(m.absence.text, /Oynanma yüzdesi/, 'metin metriğe göre yazılmalı');
});

// ---------------------------------------------------------------------------
// F) UÇ NOKTASI — kapsam bilgisi /daily-odds'a taşınıyor mu?
// ---------------------------------------------------------------------------

const { save } = await import('../src/cache.js');
const { _resetArchiveStoreForTests } = await import('../src/archive/store.js');
_resetArchiveStoreForTests();
const { default: radarRoutes } = await import('../src/routes/radar.js');
const { makeBulletinData } = await import('./helpers/fixtures.mjs');

let server, base;
test.before(async () => {
  // Fikstürde 7. maç kapsam dışı: { ok:false, reason:'Bu lig şu an analiz kapsamı dışında' }
  save('bulletin', makeBulletinData({ roundId: 4300, round: '49. Hafta' }));
  const app = express();
  app.use(express.json());
  app.use('/api/radar', radarRoutes);
  await new Promise((res) => { server = app.listen(0, '127.0.0.1', res); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server?.close(); });

test('GET /daily-odds: kapsam bilgisi taşınır → kapsam dışı maç SEBEBİNİ söyler', async () => {
  const r = await fetch(`${base}/api/radar/daily-odds?roundId=4300`);
  const body = await r.json();
  assert.equal(r.status, 200);
  const kapsamDisi = body.matches.find((m) => m.no === 7);
  assert.ok(kapsamDisi, 'fikstürdeki 7. maç yanıtta olmalı');
  assert.equal(kapsamDisi.absence?.code, 'out_of_coverage',
    'kapsam bilgisi uçta düşürülürse sebep jenerikleşir — regresyon');
  assert.equal(kapsamDisi.absence.detail, 'Bu lig şu an analiz kapsamı dışında');
  const kapsamIci = body.matches.find((m) => m.no === 1);
  assert.notEqual(kapsamIci.absence?.code, 'out_of_coverage',
    'eşleşmiş maç kapsam dışı gösterilmemeli');
});

test('GET /daily-odds: sayaç ve gün sebepleri yanıtta var', async () => {
  const { counts, days, matches } = await (await fetch(`${base}/api/radar/daily-odds?roundId=4300`)).json();
  assert.equal(counts.total, 15, 'bültendeki 15 maç sayılmalı');
  assert.equal(counts.withAny + counts.withoutAny, counts.total);
  for (const d of days) assert.ok(Number.isInteger(d.withData), `${d.date}: günlük sayaç yok`);
  for (const m of matches) {
    assert.ok(m.notes && typeof m.notes === 'object', `maç ${m.no}: sebep haritası yok`);
    for (const [tarih, hucre] of Object.entries(m.cells)) {
      if (hucre === null) assert.ok(m.notes[tarih]?.text, `maç ${m.no} / ${tarih}: boş hücrenin sebebi yazılmamış`);
      else assert.equal(m.notes[tarih], undefined, `maç ${m.no} / ${tarih}: dolu hücreye sebep yazılmış`);
    }
  }
});
