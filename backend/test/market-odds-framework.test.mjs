// ORAN SAĞLAYICI ÇERÇEVESİ — BİRİNCİL KAYNAĞI KORUYAN KİLİTLER.
//
// Tarihçe (önemli, silinmesin): Radar 4'e bir süre İKİNCİ bir oran kaynağı
// bağlıydı. 27 Temmuz 2026'da kullanıcı o kaynağın aboneliğini iptal etti ve
// "sadece Radar 4'e eklediğimiz 2. oran satırını silelim, diğerleri eskisi gibi
// kalsın" dedi. Sağlayıcı kaldırıldı; ÇERÇEVE kaldı, çünkü birincil kaynağı
// koruyan kilitler burada:
//   1) KAYITLI SAĞLAYICI YOKTUR — ikinci bir kaynak sessizce geri eklenemez.
//   2) `'refresh'` (birincil kimlik) sağlayıcı olarak kaydedilemez; aksi hâlde
//      hangi satırın nereden geldiği kaybolur (kaynak karışması).
//   3) Sağlayıcısız tur ZARARSIZDIR: hiçbir şey yazılmaz, oran UYDURULMAZ.
//   4) Mühür/kilit semantiği birincil kaynakla BİREBİR aynıdır.
//   5) Bozuk oran reddedilir, düzeltilmez; eşleşmeyen maça değer yazılmaz.
//
// Bu dosya, kaldırılan `market-odds-second-source.test.mjs` içindeki
// kaynak-bağımsız güvenceleri devralır. Buradaki sahte sağlayıcılar yalnız
// TEST içindir; üretimde kayıtlı sağlayıcı yoktur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-oran-cerceve-cache-'));
process.env.ARCHIVE_DIR = mkdtempSync(join(tmpdir(), 'sportoto-oran-cerceve-arsiv-'));
process.env.ARCHIVE_DRIVER = 'file';

const { buildDailyOdds } = await import('../src/radar/dailyOdds.js');
const {
  LEGACY_ODDS_SOURCE, oddsSourceLabel, sortOddsSources,
} = await import('../src/providers/oddsSources.js');
const {
  validateOdds, isDuplicateOfLastOdds, collectKnownFixtureIds, observeMarketOdds,
  registerOddsProvider, listOddsProviders, enabledOddsProviders, freezeMsOf,
} = await import('../src/providers/marketOdds.js');

// Testlerde kullanılan sahte kaynak kimliği — üretimde KARŞILIĞI YOKTUR.
const SAHTE = 'test-kaynak';

// --- ortak zemin -------------------------------------------------------------
const SIMDI = new Date('2026-07-29T14:00:00+03:00').getTime();   // Çarşamba
const ILK_MAC = new Date('2026-07-31T20:00:00+03:00').getTime(); // Cuma
const PZT = '2026-07-27', SALI = '2026-07-28';

const mac = (no) => ({
  no, matchId: String(no), home: `Ev ${no}`, away: `Dep ${no}`,
  kickoffAt: new Date(ILK_MAC).toISOString(), coverage: { ok: true, reason: null, code: null },
});
const gozlem = (matchId, iso, odds, source) => ({ matchId, observedAt: iso, odds, source });
const kur = (matches, observations) => buildDailyOdds({
  roundId: 1526, matches, observations, firstKickoffMs: ILK_MAC, now: SIMDI,
});

// ===========================================================================
// 1) İKİNCİ KAYNAK KALDIRILDI — GERİ SIZMASIN
// ===========================================================================

test('KİLİT: üretimde KAYITLI ORAN SAĞLAYICISI YOKTUR', () => {
  assert.deepEqual(listOddsProviders(), [],
    'Bir sağlayıcı geri eklendiyse bu kullanıcı kararına aykırıdır — önce sorulmalı.');
  assert.deepEqual(enabledOddsProviders(), []);
});

test('KİLİT: sağlayıcısız tur hiçbir şey yazmaz (sessiz uydurma yok)', async () => {
  const store = sahteDepo();
  const res = await observeMarketOdds({
    bulletinData: bulten(), store, now: SIMDI, providers: [], log: () => {},
  });
  assert.equal(res.skipped, true);
  assert.equal(res.reason, 'no-provider');
  assert.equal(store.rows.length, 0);
});

test("KİLİT: 'refresh' (birincil kimlik) sağlayıcı olarak kaydedilemez", () => {
  assert.throws(() => registerOddsProvider({ id: LEGACY_ODDS_SOURCE, enabled: true }), /birincil/i);
  assert.deepEqual(listOddsProviders(), [], 'reddedilen sağlayıcı kayda girmemeli');
});

// ===========================================================================
// 2) RADAR 4 — TEK KAYNAKLI DAVRANIŞ (eskisi gibi)
// ===========================================================================

test('birincil kaynak tek başına: hücre dolu, kaynak yazılı, sayaç 1', () => {
  const r = kur([mac(1)], [
    gozlem('1', '2026-07-28T21:00:00+03:00', { home: 2.10, draw: 3.30, away: 3.40 }, LEGACY_ODDS_SOURCE),
  ]);
  const h = r.matches[0].cells[SALI];
  assert.deepEqual(h.odds, { home: 2.10, draw: 3.30, away: 3.40 });
  assert.equal(h.source, LEGACY_ODDS_SOURCE);
  assert.equal(h.sourceCount, 1);
  assert.deepEqual(r.sources, [LEGACY_ODDS_SOURCE]);
  assert.equal(r.sourceLabels[LEGACY_ODDS_SOURCE], 'Birincil oran kaynağı');
});

test('ALTIN KURAL: kaynak bir gün susarsa o gün BOŞTUR — önceki günden taşınmaz', () => {
  const r = kur([mac(1)], [
    gozlem('1', '2026-07-27T21:00:00+03:00', { home: 2.10, draw: 3.30, away: 3.40 }, LEGACY_ODDS_SOURCE),
  ]);
  const m = r.matches[0];
  assert.ok(m.cells[PZT], 'Pazartesi dolu olmalı');
  assert.equal(m.cells[SALI], null, 'gözlemsiz güne GERİYE DÖNÜK oran üretilemez');
  assert.ok(m.notes[SALI]?.text, 'boş günün sebebi yazılmalı');
  assert.equal(m.cells['2026-07-30'], null, 'gelecek güne veri basılmaz');
  assert.equal(m.cells['2026-07-31'], null);
});

test('bozuk oran (1.00 gibi) hücreye giremez', () => {
  const r = kur([mac(1)], [
    gozlem('1', '2026-07-28T21:00:00+03:00', { home: 1.00, draw: 0, away: null }, LEGACY_ODDS_SOURCE),
  ]);
  assert.equal(r.matches[0].cells[SALI], null);
});

test('etiketler nötr ve sıra deterministik (marka adı yok)', () => {
  const r = kur([mac(1)], [
    gozlem('1', '2026-07-28T21:00:00+03:00', { home: 2.10, draw: 3.30, away: 3.40 }, LEGACY_ODDS_SOURCE),
  ]);
  const metin = JSON.stringify(r.sourceLabels) + JSON.stringify(r.matches[0].cells[SALI].sourceLabel);
  for (const marka of ['FootyStats', 'footystats', 'API-Football', 'api-sports', 'Bilyoner', 'Nesine', 'Misli']) {
    assert.ok(!metin.includes(marka), `etiketlerde marka adı olmamalı: ${marka}`);
  }
  assert.equal(oddsSourceLabel(null), 'Kaynak belirtilmemiş');
  // Arşivde kalmış eski/bilinmeyen kimlikli satır SİLİNMEZ; nötr etiketle görünür.
  assert.equal(oddsSourceLabel('bilinmeyen-kaynak'), 'Diğer oran kaynağı');
  assert.deepEqual(sortOddsSources(['zzz', 'aaa', LEGACY_ODDS_SOURCE]), [LEGACY_ODDS_SOURCE, 'aaa', 'zzz']);
});

// ===========================================================================
// 3) DOĞRULAMA — uydurma/bozuk oran reddedilir (düzeltilmez)
// ===========================================================================

test('validateOdds: geçerli oran kabul, bozuk oran RED', () => {
  const ok = validateOdds({ home: 2.10, draw: 3.30, away: 3.40 });
  assert.equal(ok.valid, true);
  assert.ok(ok.overround >= 100 && ok.overround <= 120);
  assert.equal(validateOdds(null).valid, false);
  assert.equal(validateOdds({ home: 2, draw: 3 }).valid, false);            // eksik ayak
  assert.equal(validateOdds({ home: 1.0, draw: 3, away: 4 }).valid, false); // 1.01 altı
  assert.equal(validateOdds({ home: 5000, draw: 3, away: 4 }).valid, false);
  // Toplam ihtimal %100'ün ALTINDA → imkânsız, düzeltilmez, reddedilir.
  assert.equal(validateOdds({ home: 4, draw: 4, away: 4 }).valid, false);
  // Aşırı yüksek overround (bozuk/ölçeksiz veri) → red.
  assert.equal(validateOdds({ home: 1.5, draw: 1.5, away: 1.5 }).valid, false);
});

test('isDuplicateOfLastOdds: oran kımıldamadıysa yeni satır yazılmaz', () => {
  const o = { home: 2.10, draw: 3.30, away: 3.40 };
  assert.equal(isDuplicateOfLastOdds({ odds: { home: 2.10, draw: 3.30, away: 3.40 } }, o), true);
  assert.equal(isDuplicateOfLastOdds({ odds: { home: 2.11, draw: 3.30, away: 3.40 } }, o), false);
  assert.equal(isDuplicateOfLastOdds(null, o), false);
});

test('freezeMsOf: ilk maç −5 dk (birincil kaynakla AYNI kural)', () => {
  assert.equal(freezeMsOf(bulten()), ILK_MAC - 5 * 60e3);
  assert.equal(freezeMsOf({ matches: [] }), null);
});

test('collectKnownFixtureIds: çözülmüş kimlik yalnız ARŞİVDEN okunur', () => {
  const map = collectKnownFixtureIds([
    { matchId: 'm1', source: SAHTE, raw: { sourceMatchId: '111', swapped: true } },
    { matchId: 'm2', source: LEGACY_ODDS_SOURCE, raw: { sourceMatchId: '222' } },   // başka kaynak → alınmaz
    { matchId: 'm3', source: SAHTE, raw: {} },                                      // kimliksiz → alınmaz
  ], SAHTE);
  assert.equal(map.size, 1);
  assert.equal(map.get('m1').fixtureId, '111');
  assert.equal(map.get('m1').swapped, true);
});

// ===========================================================================
// 4) GÖZLEM TURU — BİRİNCİL KAYNAĞA DOKUNULMAZ
// ===========================================================================

function sahteDepo(baslangic = []) {
  const rows = [...baslangic];
  return {
    rows,
    async getBulletin() { return { id: '1526', status: 'active', freezeAt: new Date(ILK_MAC - 5 * 60e3).toISOString() }; },
    async listObservations() { return rows; },
    async addObservations(_id, yeni) { rows.push(...yeni); return yeni.length; },
  };
}
const bulten = () => ({
  roundId: 1526,
  matches: [
    { no: 1, sportotoMatchId: 'm1', home: { name: 'Ev 1' }, away: { name: 'Dep 1' }, date: new Date(ILK_MAC).toISOString() },
    { no: 2, sportotoMatchId: 'm2', home: { name: 'Ev 2' }, away: { name: 'Dep 2' }, date: new Date(ILK_MAC).toISOString() },
  ],
});
const sahteSaglayici = (rows, id = SAHTE) => ({
  id, name: 'Test oran kaynağı', enabled: true,
  available: () => ({ ok: true, reason: null }),
  fetchOdds: async () => rows,
});

test('BİRİNCİL KAYNAK KORUNUR: gözlem turu eski satırları silmez/değiştirmez', async () => {
  const eski = {
    matchId: 'm1', source: LEGACY_ODDS_SOURCE, observedAt: '2026-07-28T21:00:00.000Z',
    odds: { home: 2.10, draw: 3.30, away: 3.40 }, playedPct: null,
  };
  const store = sahteDepo([{ ...eski }]);
  const rows = [{ matchKey: 'm1', matchNo: 1, odds: { home: 2.30, draw: 3.20, away: 3.10 }, sourceMatchId: '999' }];
  const res = await observeMarketOdds({
    bulletinData: bulten(), store, now: SIMDI, providers: [sahteSaglayici(rows)], log: () => {},
  });
  assert.equal(res.written, 1);
  const kalan = store.rows.filter((r) => r.source === LEGACY_ODDS_SOURCE);
  assert.equal(kalan.length, 1);
  assert.deepEqual(kalan[0], eski, 'birincil kaynağın satırı BİREBİR aynı kalmalı');
  const yeni = store.rows.filter((r) => r.source === SAHTE);
  assert.equal(yeni.length, 1, 'sağlayıcı KENDİ kimliğiyle yazar');
  assert.notEqual(yeni[0].source, LEGACY_ODDS_SOURCE);
});

test('MÜHÜR: donma sonrası sağlayıcı da yazamaz (birincille aynı kural)', async () => {
  const store = sahteDepo();
  const rows = [{ matchKey: 'm1', matchNo: 1, odds: { home: 2.30, draw: 3.20, away: 3.10 } }];
  const res = await observeMarketOdds({
    bulletinData: bulten(), store, now: ILK_MAC - 60e3,   // freeze = ilk maç −5 dk
    providers: [sahteSaglayici(rows)], log: () => {},
  });
  assert.equal(res.skipped, true);
  assert.equal(res.reason, 'after-freeze');
  assert.equal(store.rows.length, 0);
});

test('KİLİTLİ bültende sağlayıcı yazamaz', async () => {
  const store = sahteDepo();
  store.getBulletin = async () => ({ id: '1526', status: 'locked' });
  const res = await observeMarketOdds({
    bulletinData: bulten(), store, now: SIMDI,
    providers: [sahteSaglayici([{ matchKey: 'm1', odds: { home: 2, draw: 3.4, away: 3.6 } }])], log: () => {},
  });
  assert.equal(res.skipped, true);
  assert.equal(res.reason, 'locked');
  assert.equal(store.rows.length, 0);
});

test('bozuk oran gelirse YAZILMAZ ve sayılır (uydurma yok)', async () => {
  const store = sahteDepo();
  const rows = [
    { matchKey: 'm1', odds: { home: 1.0, draw: 1.0, away: 1.0 } },
    { matchKey: 'm2', odds: { home: 2.00, draw: 3.40, away: 3.60 } },
  ];
  const res = await observeMarketOdds({
    bulletinData: bulten(), store, now: SIMDI, providers: [sahteSaglayici(rows)], log: () => {},
  });
  assert.equal(res.invalid, 1);
  assert.equal(res.written, 1);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].matchId, 'm2');
});

test('değişmeyen oran tekrar yazılmaz (dedup)', async () => {
  const store = sahteDepo([{
    matchId: 'm1', source: SAHTE, observedAt: '2026-07-28T21:00:00.000Z',
    odds: { home: 2.30, draw: 3.20, away: 3.10 },
  }]);
  const rows = [{ matchKey: 'm1', odds: { home: 2.30, draw: 3.20, away: 3.10 } }];
  const res = await observeMarketOdds({
    bulletinData: bulten(), store, now: SIMDI, providers: [sahteSaglayici(rows)], log: () => {},
  });
  assert.equal(res.written, 0);
  assert.equal(res.duplicates, 1);
  assert.equal(store.rows.length, 1);
});

test('EŞLEŞMEYEN maça oran uydurulmaz — sebep taşınır', async () => {
  const store = sahteDepo();
  const rows = [{ matchKey: 'm1', odds: { home: 2.00, draw: 3.40, away: 3.60 } }];
  rows._unmatched = [{ matchKey: 'm2', no: 2, reason: 'no_fixture_match' }];
  const res = await observeMarketOdds({
    bulletinData: bulten(), store, now: SIMDI, providers: [sahteSaglayici(rows)], log: () => {},
  });
  assert.equal(res.unmatched, 1);
  assert.equal(store.rows.filter((r) => r.matchId === 'm2').length, 0);   // m2'ye satır YOK
  assert.equal(res.providers[SAHTE].unmatched[0].reason, 'no_fixture_match');
});

test('sağlayıcı çökerse tur çökmez, sebep taşınır (izolasyon)', async () => {
  const store = sahteDepo();
  const patlak = { id: 'patlak', enabled: true, available: () => ({ ok: true }), fetchOdds: async () => { throw new Error('kota bitti'); } };
  const saglam = sahteSaglayici([{ matchKey: 'm1', odds: { home: 2.00, draw: 3.40, away: 3.60 } }]);
  const res = await observeMarketOdds({
    bulletinData: bulten(), store, now: SIMDI, providers: [patlak, saglam], log: () => {},
  });
  assert.equal(res.ok, true);
  assert.equal(res.providers.patlak.errors, 'kota bitti');
  assert.equal(res.written, 1);
});

test('erişilemeyen sağlayıcı: sessiz boşluk değil — SEBEP yazılır, satır yazılmaz', async () => {
  const store = sahteDepo();
  const anahtarsiz = {
    id: SAHTE, enabled: true,
    available: () => ({ ok: false, reason: 'Bu kaynak için erişim anahtarı tanımlı değil.' }),
    fetchOdds: async () => { throw new Error('çağrılmamalıydı'); },
  };
  const res = await observeMarketOdds({ bulletinData: bulten(), store, now: SIMDI, providers: [anahtarsiz], log: () => {} });
  assert.equal(res.written, 0);
  assert.match(res.providers[SAHTE].errors, /anahtar/i);
  assert.equal(store.rows.length, 0);
});

test('bülten yoksa tur yapılmaz (boş bültene oran yazılmaz)', async () => {
  const store = sahteDepo();
  const res = await observeMarketOdds({
    bulletinData: { pending: true, matches: [] }, store, now: SIMDI,
    providers: [sahteSaglayici([{ matchKey: 'm1', odds: { home: 2, draw: 3.4, away: 3.6 } }])], log: () => {},
  });
  assert.equal(res.skipped, true);
  assert.equal(res.reason, 'no-bulletin');
  assert.equal(store.rows.length, 0);
});
