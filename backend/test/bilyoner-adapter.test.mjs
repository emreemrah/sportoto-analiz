// BİLYONER ADAPTÖRÜ TESTLERİ — GERÇEK yakalanmış açık/oturumsuz veriyle (fixture).
// Kaynak: /api/sto/programs/active + /api/sto/playratio (credentials:'omit' → 200).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FX = JSON.parse(readFileSync(join(here, 'fixtures', 'bilyoner-1525.json'), 'utf8'));

const {
  buildBilyonerAdapter, parseProgram, parsePlayRatios, parsePct,
  splitTeams, matchEventToBulletin, BILYONER_PARSER_VERSION,
} = await import('../src/providers/bilyoner.js');

// Fixture'ı sunan sahte fetch (ağ YOK — gerçek yanıt biçimi birebir).
const fakeFetch = (program = FX.programsActive, ratio = FX.playratio) => async (url) => ({
  ok: true, status: 200,
  json: async () => (String(url).includes('playratio') ? ratio : program),
});

// Resmî bültenin 15 maçı (cihaz adlarıyla; 4 ve 6 ad varyantı içerir).
const BULLETIN = {
  roundId: 1525,
  matches: [
    { no: 1, sportotoMatchId: 'm1', home: { name: 'AGF Aarhus' }, away: { name: 'Brondby' }, date: '2026-07-25T19:00:00+03:00' },
    { no: 2, sportotoMatchId: 'm2', home: { name: 'Horsens' }, away: { name: 'FC Nordsjaelland' }, date: '2026-07-26T19:00:00+03:00' },
    { no: 3, sportotoMatchId: 'm3', home: { name: 'Randers' }, away: { name: 'Silkeborg' }, date: '2026-07-27T20:00:00+03:00' },
    { no: 4, sportotoMatchId: 'm4', home: { name: 'Ilves' }, away: { name: 'Lahti' }, date: '2026-07-26T15:00:00+03:00' },
    { no: 5, sportotoMatchId: 'm5', home: { name: 'Helsinki' }, away: { name: 'TPS Turku' }, date: '2026-07-26T17:00:00+03:00' },
    { no: 6, sportotoMatchId: 'm6', home: { name: 'Vasteras SK', mediumName: 'Västerås' }, away: { name: 'Örgryte IS', mediumName: 'Örgryte' }, date: '2026-07-24T20:00:00+03:00' },
    { no: 7, sportotoMatchId: 'm7', home: { name: 'Sirius' }, away: { name: 'Göteborg' }, date: '2026-07-26T15:00:00+03:00' },
    { no: 8, sportotoMatchId: 'm8', home: { name: 'Malmo FF', mediumName: 'Malmö' }, away: { name: 'Elfsborg' }, date: '2026-07-26T17:30:00+03:00' },
    { no: 9, sportotoMatchId: 'm9', home: { name: 'Kfum Oslo' }, away: { name: 'Molde' }, date: '2026-07-26T18:00:00+03:00' },
    { no: 10, sportotoMatchId: 'm10', home: { name: 'Sandefjord' }, away: { name: 'Bodo Glimt' }, date: '2026-07-26T18:00:00+03:00' },
    { no: 11, sportotoMatchId: 'm11', home: { name: 'Rosenborg' }, away: { name: 'Fredrikstad' }, date: '2026-07-27T20:00:00+03:00' },
    { no: 12, sportotoMatchId: 'm12', home: { name: 'Pogon Szczecin' }, away: { name: 'Legia Varsova' }, date: '2026-07-24T21:30:00+03:00' },
    { no: 13, sportotoMatchId: 'm13', home: { name: 'Lech Poznan' }, away: { name: 'Cracovia' }, date: '2026-07-25T21:15:00+03:00' },
    { no: 14, sportotoMatchId: 'm14', home: { name: 'Wisla Krakow' }, away: { name: 'GKS Katowice' }, date: '2026-07-26T21:15:00+03:00' },
    { no: 15, sportotoMatchId: 'm15', home: { name: 'Zaglebie Lubin' }, away: { name: 'Piast Gliwice' }, date: '2026-07-27T20:00:00+03:00' },
  ],
};

test('1. parsePct: sayı, "%57,4", "57.4%", "%57.4" hepsi doğru okunur', () => {
  assert.equal(parsePct(57.4), 57.4);
  assert.equal(parsePct('%57,4'), 57.4);
  assert.equal(parsePct('57.4%'), 57.4);
  assert.equal(parsePct('%57.4'), 57.4);
  assert.equal(parsePct(''), null);
  assert.equal(parsePct(null), null);
});

test('2. splitTeams: eventDescriptionFormatted (\\n) önce, sonra "Ev-Dep"', () => {
  assert.deepEqual(splitTeams({ eventDescriptionFormatted: 'AGF Aarhus\nBrondby' }), { home: 'AGF Aarhus', away: 'Brondby' });
  assert.deepEqual(splitTeams({ eventDescription: 'Randers-Silkeborg' }), { home: 'Randers', away: 'Silkeborg' });
  assert.deepEqual(splitTeams({ eventDescription: '' }), { home: null, away: null });
});

test('3. parseProgram: gcNo + 15 event + donma referansı (payinEndDate)', () => {
  const p = parseProgram(FX.programsActive);
  assert.equal(p.gcNo, 350);
  assert.equal(p.events.length, 15);
  assert.equal(p.events[0].home, 'AGF Aarhus');
  assert.equal(p.events[0].sourceMatchId, '91835');
  assert.match(p.payinEndDate, /2026-07-24T19:55/);
});

test('4. parsePlayRatios: count_1→1(ev), count_0→X, count_2→2(dep)', () => {
  const r = parsePlayRatios(FX.playratio);
  assert.deepEqual(r.get(1), { home: 42.5, draw: 34, away: 23.5 });
  assert.deepEqual(r.get(10), { home: 8.6, draw: 12.1, away: 79.3 });
  assert.equal(r.size, 15);
});

test('5. GERÇEK fixture → 15/15 maç eşleşir, yüzde toplamı 100±2, sourceMatchId dolu', async () => {
  const adapter = buildBilyonerAdapter({ fetchImpl: fakeFetch() });
  const rows = await adapter.fetchPercentages(BULLETIN, { now: Date.parse('2026-07-22T11:00:00Z') });
  assert.equal(rows.length, 15, 'tüm maçlar eşleşti');
  assert.ok(!rows._unmatched, 'eşleşmeyen yok');
  for (const r of rows) {
    const sum = r.pct['1'] + r.pct.X + r.pct['2'];
    assert.ok(Math.abs(sum - 100) <= 2, `pos${r.position} toplam ${sum}`);
    assert.ok(r.sourceMatchId, 'sourceMatchId taşınır');
    assert.equal(r.sourceType, 'bilyoner-sto-webapi');
    assert.equal(r.parserVersion, BILYONER_PARSER_VERSION);
    assert.ok(r.rawHash, 'ham hash');
  }
  const p1 = rows.find((r) => r.position === 1);
  assert.deepEqual(p1.pct, { '1': 42.5, X: 34, '2': 23.5 }, 'ekrandaki gerçek değerle birebir');
  assert.equal(p1.matchKey, 'm1');
});

test('6. Ad varyantı: sıra-çapalı yedek (Ilves↔Tampereen, Vasteras↔Vasteraas) tek-taraf doğrulamayla', async () => {
  const adapter = buildBilyonerAdapter({ fetchImpl: fakeFetch() });
  const rows = await adapter.fetchPercentages(BULLETIN, { now: Date.parse('2026-07-22T11:00:00Z') });
  const p4 = rows.find((r) => r.position === 4);
  assert.equal(p4.matchKey, 'm4', 'Tampereen-Lahti → Ilves-Lahti (sıra+Lahti doğruladı)');
  assert.equal(p4.matchConfidence, 'position-anchored+one-side');
  assert.deepEqual(p4.pct, { '1': 38.5, X: 33.6, '2': 28 });
});

test('7. Yanlış program: hiçbir taraf doğrulamıyorsa BAĞLANMAZ (kart boş kalır)', () => {
  const ev = { eventNo: 4, home: 'Barcelona', away: 'Real Madrid', eventDate: '2026-07-26T15:00:00+03:00' };
  const r = matchEventToBulletin(ev, BULLETIN.matches);
  assert.equal(r.matched, null);
  assert.equal(r.reason, 'position_anchor_no_side_corroboration');
});

test('8. BELİRSİZLİK REDDİ: iki bülten maçı da tutarsa veri bağlanmaz', () => {
  const dupe = { roundId: 1, matches: [
    { no: 1, sportotoMatchId: 'a', home: { name: 'Randers' }, away: { name: 'Silkeborg' }, date: '2026-07-27T20:00:00+03:00' },
    { no: 2, sportotoMatchId: 'b', home: { name: 'Randers' }, away: { name: 'Silkeborg' }, date: '2026-07-27T20:00:00+03:00' },
  ] };
  const ev = { eventNo: 3, home: 'Randers', away: 'Silkeborg', eventDate: '2026-07-27T20:00:00+03:00' };
  const r = matchEventToBulletin(ev, dupe.matches);
  assert.equal(r.matched, null);
  assert.equal(r.reason, 'ambiguous_provider_match');
  assert.equal(r.candidateCount, 2);
});

test('9. Farklı hafta (tarih penceresi dışı) event eşleşmez', () => {
  const ev = { eventNo: 1, home: 'AGF Aarhus', away: 'Brondby', eventDate: '2026-09-01T19:00:00+03:00' };
  const r = matchEventToBulletin(ev, BULLETIN.matches);
  // 4 günden uzak → both-sides elenir; sıra-çapa da tarih penceresi ister → bağlanmaz
  assert.equal(r.matched, null);
});

test('10. Taraf yer değiştirmişse yüzdeler de çevrilir (1↔2)', async () => {
  // Bülteni ters listelenmiş bir maçla kur: Bilyoner "AGF Aarhus-Brondby",
  // bülten "Brondby(ev)-AGF Aarhus(dep)" → swapped; 1 ve 2 yer değişir.
  const swapped = { roundId: 1, matches: [
    { no: 1, sportotoMatchId: 's1', home: { name: 'Brondby' }, away: { name: 'AGF Aarhus' }, date: '2026-07-25T19:00:00+03:00' },
    ...BULLETIN.matches.slice(1),
  ] };
  const adapter = buildBilyonerAdapter({ fetchImpl: fakeFetch() });
  const rows = await adapter.fetchPercentages(swapped, { now: Date.parse('2026-07-22T11:00:00Z') });
  const p1 = rows.find((r) => r.matchKey === 's1');
  assert.ok(p1.matchConfidence.includes('both-sides') || p1.matchConfidence.includes('position'));
  // Bilyoner: 1=%42.5 (AGF ev), 2=%23.5 (Brondby dep). Bülten ters olduğundan
  // ev=Brondby → "1" artık %23.5, "2" (AGF) %42.5, X sabit.
  assert.deepEqual(p1.pct, { '1': 23.5, X: 34, '2': 42.5 });
});

test('11. Ağ hatası izolasyonu: fetch çökerse adaptör hata fırlatır (çerçeve yakalar)', async () => {
  const adapter = buildBilyonerAdapter({ fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  await assert.rejects(() => adapter.fetchPercentages(BULLETIN), /ECONNRESET|program alınamadı/);
});

test('12. Oynanma ≠ oran: sözleşmede oran alanı YOK, yalnız tercih yüzdesi', async () => {
  const adapter = buildBilyonerAdapter({ fetchImpl: fakeFetch() });
  const rows = await adapter.fetchPercentages(BULLETIN, { now: Date.parse('2026-07-22T11:00:00Z') });
  for (const r of rows) {
    assert.ok(!('odds' in r) && !('oran' in r), 'oran alanı taşınmaz');
    // Yüzdeler 0-100; oran gibi 1.x-10 değil.
    for (const k of ['1', 'X', '2']) assert.ok(r.pct[k] >= 0 && r.pct[k] <= 100);
  }
});
