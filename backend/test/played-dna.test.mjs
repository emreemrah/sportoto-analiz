// OYNANMA DNA'SI — davranış kilidi.
// Bu testler spec kurallarının geri sızmasını engeller. Kırılırsa kural bozulmuş
// demektir; testi gevşetmeden önce kuralın gerçekten değiştiğinden emin ol.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findPlayedDna, findMovementDna, buildMovementRecords, movementOf,
  summarize, isSimilarDistribution, DNA_EMPTY_MESSAGE, movementWords,
  TOLERANCE_FILTERS, DEFAULT_TOLERANCE,
} from '../src/radar/playedDna.js';
import {
  buildRoundDnaRecords, weekdayOf, collectPlayedDnaRecords, _resetPlayedDnaMemo,
  buildBandHistoryRows,
} from '../src/radar/playedDnaArchive.js';
import { computeBandHistory } from '../src/radar/publicBettingRadar.js';

const CUR = { '1': 45, X: 29, '2': 26 };
const rec = (o = {}) => ({
  source: 'nesine', roundId: 1520, position: 1, weekday: 5,
  dayKey: '2026-07-24', pct: { '1': 45, X: 29, '2': 26 }, result: '1', ...o,
});

test('benzerlik: 1/X/2 ÜÇÜ BİRDEN tolerans içinde olmalı (yalnız favori yetmez)', () => {
  assert.equal(isSimilarDistribution(CUR, { '1': 45, X: 20, '2': 35 }, 2), false);
  assert.equal(isSimilarDistribution(CUR, { '1': 46, X: 28, '2': 26 }, 2), true);
});

test('yakınlık 4 seçenek: birebir(0) · ±1 · ±2 · ±3, varsayılan ±2', () => {
  assert.deepEqual(TOLERANCE_FILTERS, [0, 1, 2, 3]);
  assert.equal(DEFAULT_TOLERANCE, 2);
});

test('yakınlık seçimi tam uygulanır — OTOMATİK GENİŞLEME YOK', () => {
  // CUR = 45/29/26. Adaylar sırasıyla birebir, ±1, ±2, ±3 ve ±3 dışı.
  const arsiv = [
    rec({ matchKey: 'a', pct: { '1': 45, X: 29, '2': 26 }, result: '1' }),
    rec({ matchKey: 'b', pct: { '1': 46, X: 28, '2': 26 }, result: '2' }),
    rec({ matchKey: 'c', pct: { '1': 47, X: 29, '2': 24 }, result: '1' }),
    rec({ matchKey: 'd', pct: { '1': 48, X: 26, '2': 26 }, result: 'X' }),
    rec({ matchKey: 'e', pct: { '1': 50, X: 24, '2': 26 }, result: '2' }),
  ];
  const say = (tol) => findPlayedDna(arsiv,
    { current: CUR, source: 'nesine', position: 1, weekday: 5, tolerances: [tol] }).overall.total;
  assert.equal(say(0), 1);
  assert.equal(say(1), 2);
  assert.equal(say(2), 3);
  assert.equal(say(3), 4);   // ±3 dışındaki 'e' hiçbir seçenekte girmez
});

test('±1 seçilince ±3e KENDİLİĞİNDEN çıkmaz (boşsa boş kalır)', () => {
  // Tek aday ±3 mesafede; ±1 seçiliyken sonuç BOŞ olmalı.
  const arsiv = [rec({ roundId: 1519, pct: { '1': 48, X: 26, '2': 26 } })];
  const r1 = findPlayedDna(arsiv, { current: CUR, source: 'nesine', position: 1, weekday: 5, tolerances: [1] });
  assert.equal(r1.hasData, false);
  const r3 = findPlayedDna(arsiv, { current: CUR, source: 'nesine', position: 1, weekday: 5, tolerances: [3] });
  assert.equal(r3.hasData, true);
  assert.equal(r3.tolerance, 3);
});

test('hiç yakın kayıt yoksa dürüst mesaj döner (uydurma yok)', () => {
  const r = findPlayedDna([rec({ pct: { '1': 80, X: 10, '2': 10 } })],
    { current: CUR, source: 'nesine', position: 1, weekday: 5 });
  assert.equal(r.hasData, false);
  assert.equal(r.message, DNA_EMPTY_MESSAGE);
});

test('TEK kayıt bile gösterilir — örneklem eşiği YOK (panel gösterim amaçlı)', () => {
  const r = findPlayedDna([rec({ roundId: 1519 })],
    { current: CUR, source: 'nesine', position: 1, weekday: 5 });
  assert.equal(r.byDay.selected.total, 1);
  assert.equal(r.byDay.selected.text, '1 benzer kayıt → Ev sahibi kazandı (%100)');
});

test('kaynaklar ASLA karışmaz', () => {
  const r = findPlayedDna([rec({ roundId: 1519, source: 'misli' })],
    { current: CUR, source: 'nesine', position: 1, weekday: 5 });
  assert.equal(r.hasData, false);
});

test('aynı maçın iki günü İKİ AYRI kayıttır', () => {
  const r = findPlayedDna([
    rec({ roundId: 1519, weekday: 3, dayKey: '2026-07-22' }),
    rec({ roundId: 1519, weekday: 4, dayKey: '2026-07-23' }),
  ], { current: CUR, source: 'nesine', position: 1, weekday: 5 });
  assert.equal(r.matched, 2);
  assert.equal(r.byDay.selected.total, 0);   // seçili gün cuma
  assert.equal(r.byDay.others.total, 2);
});

test('sıra kırılımı: kendi sırası / kalan sıralar ayrı havuz', () => {
  const r = findPlayedDna([
    rec({ roundId: 1519, position: 1 }),
    rec({ roundId: 1518, position: 7 }),
    rec({ roundId: 1517, position: 12 }),
  ], { current: CUR, source: 'nesine', position: 1, weekday: 5 });
  assert.equal(r.byPosition.own.total, 1);
  assert.equal(r.byPosition.rest.total, 2);
});

test('filtre birimi MAÇ: en yeni N sonuçlanmış maç alınır', () => {
  // Tek haftada 5 farklı maç: hafta sayılsaydı hepsi gelirdi, maç sayılınca 2.
  const bes = [1, 2, 3, 4, 5].map((i) => rec({
    matchKey: `m${i}`, position: i, kickoffAt: `2026-07-2${i}T16:00:00Z`,
  }));
  const r = findPlayedDna(bes, { current: CUR, source: 'nesine', position: 1, weekday: 5, matchLimit: 2 });
  assert.equal(r.matchesUsed, 2);
  assert.equal(findPlayedDna(bes, { current: CUR, source: 'nesine', position: 1, weekday: 5 }).matchesUsed, 5);
});

test('maç penceresi TÜM kaynaklar için ortak — boşluk eski maçla doldurulmaz', () => {
  const kar = [
    rec({ matchKey: 'yeni', kickoffAt: '2026-07-24T16:00:00Z', source: 'misli' }),
    rec({ matchKey: 'eski', kickoffAt: '2026-07-10T16:00:00Z', source: 'nesine' }),
  ];
  // Son 1 maç = en yeni (misli). Nesine o maçta yok → nesine için sonuç YOK.
  const r = findPlayedDna(kar, { current: CUR, source: 'nesine', position: 1, weekday: 5, matchLimit: 1 });
  assert.equal(r.hasData, false);
});

test('aynı maçın farklı günleri TEK maç sayılır (kayıt olarak ayrı kalır)', () => {
  const g = [
    rec({ dayKey: '2026-07-22', weekday: 3 }),
    rec({ dayKey: '2026-07-23', weekday: 4 }),
    rec({ dayKey: '2026-07-24', weekday: 5 }),
  ];
  const r = findPlayedDna(g, { current: CUR, source: 'nesine', position: 1, weekday: 5, matchLimit: 1 });
  assert.equal(r.matchesUsed, 1);
  assert.equal(r.matched, 3);
});

test('yüzdeler adetten türer ve toplamı 100', () => {
  const s = summarize([{ result: '1' }, { result: '1' }, { result: 'X' }]);
  assert.equal(s.pct['1'] + s.pct.X + s.pct['2'], 100);
  assert.equal(s.counts['1'], 2);
});

test('sade dil: sonucu olmayan yön GÖSTERİLMEZ', () => {
  const s = summarize([{ result: '1' }, { result: '1' }, { result: 'X' }]);
  assert.equal(s.text.includes('2:'), false);
  assert.equal(s.text, '3 benzer kayıt → 1: %67 · X: %33');
});

test('sade dil: hiç kayıt yoksa teknik sıfırlar değil düz mesaj', () => {
  assert.equal(summarize([]).text, 'Geçmiş sonuç yok');
});

test('sade dil: tek yönde toplanınca doğal Türkçe cümle', () => {
  assert.equal(summarize([{ result: '2' }]).text, '1 benzer kayıt → Deplasman kazandı (%100)');
  assert.equal(summarize([{ result: '2' }, { result: '2' }]).text, '2 benzer kayıt → Deplasman kazandı (%100)');
});

test('hareket sözle anlatılır; 1 puan altı değişim "değişmedi"', () => {
  assert.equal(movementWords({ '1': 13, X: 0, '2': -6 }), '1 yükseldi · X değişmedi · 2 düştü');
  assert.equal(movementWords({ '1': 0.4, X: 0, '2': -0.3 }), '1 değişmedi · X değişmedi · 2 değişmedi');
});

test('hareket: tek gün ÜRETİLMEZ, iki gün delta verir', () => {
  assert.equal(movementOf([{ dayKey: '2026-07-24', pct: CUR }]), null);
  const mv = movementOf([
    { dayKey: '2026-07-19', pct: { '1': 42, X: 32, '2': 26 } },
    { dayKey: '2026-07-24', pct: { '1': 55, X: 25, '2': 20 } },
  ]);
  assert.deepEqual(mv.delta, { '1': 13, X: -7, '2': -6 });
});

test('hareket kayıtları: tek günlü grup kayıt üretmez', () => {
  const mv = buildMovementRecords([
    rec({ roundId: 1519, dayKey: '2026-07-15', pct: { '1': 42, X: 32, '2': 26 }, matchKey: 'm1' }),
    rec({ roundId: 1519, dayKey: '2026-07-17', pct: { '1': 55, X: 25, '2': 20 }, matchKey: 'm1' }),
    rec({ roundId: 1518, dayKey: '2026-07-10', matchKey: 'm2' }),
  ]);
  assert.equal(mv.length, 1);
  // Eşleşme YÜZDE üzerinden: açılış ve kapanış dağılımı birlikte tutmalı.
  const r = findMovementDna(mv, {
    current: { openPct: { '1': 42, X: 32, '2': 26 }, closePct: { '1': 55, X: 25, '2': 20 } },
    source: 'nesine', position: 1,
  });
  assert.equal(r.overall.total, 1);
});

test('hareket eşleşmesi YÜZDEYE bakar — sadece "yükseldi/düştü" yönü YETMEZ', () => {
  // Aynı yön (1 yükseldi · X düştü · 2 düştü) ama tamamen farklı tablo.
  const mv = buildMovementRecords([
    rec({ matchKey: 'z', dayKey: '2026-07-15', pct: { '1': 20, X: 30, '2': 50 } }),
    rec({ matchKey: 'z', dayKey: '2026-07-17', pct: { '1': 24, X: 28, '2': 48 } }),
  ]);
  assert.equal(mv.length, 1);
  const r = findMovementDna(mv, {
    // Yön aynı ama yüzdeler bambaşka (61/23/16 civarı) → EŞLEŞMEMELİ.
    current: { openPct: { '1': 57, X: 27, '2': 16 }, closePct: { '1': 61, X: 23, '2': 16 } },
    source: 'nesine', position: 1,
  });
  assert.equal(r.hasData, false);
});

// --- arşiv katmanı ---------------------------------------------------------
const matches = [
  { matchId: 'm1', orderNo: 1, kickoffAt: '2026-07-24T16:00:00Z' },
  { matchId: 'm2', orderNo: 2, kickoffAt: '2026-07-24T18:00:00Z' },
];
const results = [{ matchId: 'm1', orderNo: 1, officialResult: '1' }];
const obs = (o) => ({ matchId: 'm1', source: 'nesine', playedPct: { '1': 45, X: 29, '2': 26 }, ...o });

test('gün mührü: 23:55e kadarki SON gözlem alınır', () => {
  const r = buildRoundDnaRecords({ roundId: 1519, matches, results, observations: [
    obs({ observedAt: '2026-07-22T08:00:00Z', playedPct: { '1': 40, X: 30, '2': 30 } }),
    obs({ observedAt: '2026-07-22T20:00:00Z', playedPct: { '1': 45, X: 29, '2': 26 } }),
  ] });
  assert.equal(r.length, 1);
  assert.equal(r[0].pct['1'], 45);
});

test('maç günü: donma anından (ilk maç −5 dk) sonraki gözlem mühre girmez', () => {
  const r = buildRoundDnaRecords({ roundId: 1519, matches, results, observations: [
    obs({ observedAt: '2026-07-24T15:50:00Z', playedPct: { '1': 55, X: 25, '2': 20 } }),
    obs({ observedAt: '2026-07-24T15:58:00Z', playedPct: { '1': 88, X: 6, '2': 6 } }),
  ] });
  assert.equal(r.length, 1);
  assert.equal(r[0].pct['1'], 55);
});

test('mühür sonrası araştırma ve tahmine uygun olmayan gözlem DNAya sızmaz', () => {
  assert.equal(buildRoundDnaRecords({ roundId: 1519, matches, results, observations: [
    obs({ observedAt: '2026-07-22T20:00:00Z', kind: 'post_lock_research' })] }).length, 0);
  assert.equal(buildRoundDnaRecords({ roundId: 1519, matches, results, observations: [
    obs({ observedAt: '2026-07-22T20:00:00Z', usableForPrediction: false })] }).length, 0);
});

test('resmî sonucu olmayan maç/tur kayıt üretmez', () => {
  assert.equal(buildRoundDnaRecords({ roundId: 1519, matches, results: [], observations: [
    obs({ observedAt: '2026-07-22T20:00:00Z' })] }).length, 0);
  assert.equal(buildRoundDnaRecords({ roundId: 1519, matches, results, observations: [
    obs({ matchId: 'm2', observedAt: '2026-07-22T20:00:00Z' })] }).length, 0);
});

test('hafta günü Istanbul gününe göre hesaplanır', () => {
  assert.equal(weekdayOf('2026-07-22'), 3);   // Çarşamba
  assert.equal(weekdayOf('2026-07-26'), 0);   // Pazar
});

test('collect: sonucu olmayan tur atlanır, diğerleri toplanır', async () => {
  _resetPlayedDnaMemo();
  // Turlar arşiv tabanının (1525) ÜSTÜNDE seçildi ki bu test yalnız
  // "sonucu olmayan tur atlanır" davranışını ölçsün.
  const store = {
    listBulletins: async () => [{ id: 'b1', roundId: 1526 }, { id: 'b0', roundId: 1525 }],
    listObservations: async () => [obs({ observedAt: '2026-07-22T20:00:00Z' })],
    listOfficialResults: async () => results,
    getMatches: async () => matches,
  };
  assert.equal((await collectPlayedDnaRecords(store, { force: true })).length, 2);
  _resetPlayedDnaMemo();
  assert.equal((await collectPlayedDnaRecords({ ...store, listOfficialResults: async () => [] },
    { force: true })).length, 0);
});

test('arşiv tabanı: 51. hafta (roundId 1525) öncesi turlar HİÇ okunmaz', async () => {
  _resetPlayedDnaMemo();
  const okunan = [];
  const store = {
    listBulletins: async () => [
      { id: 'b1526', roundId: 1526 },
      { id: 'b1525', roundId: 1525 },   // 51. hafta — sınır, DAHİL
      { id: 'b1524', roundId: 1524 },   // öncesi — hariç
      { id: 'b1521', roundId: 1521 },   // öncesi — hariç
    ],
    listObservations: async (id) => { okunan.push(String(id)); return [obs({ observedAt: '2026-07-22T20:00:00Z' })]; },
    listOfficialResults: async () => results,
    getMatches: async () => matches,
  };
  const kayitlar = await collectPlayedDnaRecords(store, { force: true });
  assert.deepEqual(okunan.sort(), ['b1525', 'b1526']);          // eski turlar okunmadı
  assert.equal(kayitlar.every((r) => Number(r.roundId) >= 1525), true);
  assert.equal(new Set(kayitlar.map((r) => r.roundId)).size, 2);
});

test('arşiv tabanı .env ile değiştirilebilir (startRoundId)', async () => {
  _resetPlayedDnaMemo();
  const store = {
    listBulletins: async () => [{ id: 'b1526', roundId: 1526 }, { id: 'b1521', roundId: 1521 }],
    listObservations: async () => [obs({ observedAt: '2026-07-22T20:00:00Z' })],
    listOfficialResults: async () => results,
    getMatches: async () => matches,
  };
  const hepsi = await collectPlayedDnaRecords(store, { force: true, startRoundId: 1500 });
  assert.equal(new Set(hepsi.map((r) => r.roundId)).size, 2);
});


// --- Radar 3 bant geçmişi (51. haftadan itibaren gerçek arşivden) ----------
const bandRec = (o = {}) => ({
  source: 'nesine', roundId: 1525, matchKey: 'm1', position: 1,
  dayKey: '2026-07-17', pct: { '1': 72, X: 18, '2': 10 }, result: '1', ...o,
});

test('bant satırı: maç başına tek satır, kaynakların SON günü ortalanır', () => {
  const rows = buildBandHistoryRows([
    bandRec({ dayKey: '2026-07-15', pct: { '1': 60, X: 20, '2': 20 } }),
    bandRec({ dayKey: '2026-07-17', pct: { '1': 72, X: 18, '2': 10 } }),
    bandRec({ source: 'misli', dayKey: '2026-07-17', pct: { '1': 74, X: 16, '2': 10 } }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].favoritePct, 73);       // (72 + 74) / 2
  assert.equal(rows[0].favoriteSymbol, '1');
  assert.equal(rows[0].officialResult, '1');
});

test('bant satırı: resmî sonucu olmayan maç satır üretmez', () => {
  assert.equal(buildBandHistoryRows([bandRec({ result: null })]).length, 0);
});

test('bant geçmişi gerçek arşivden hesaplanır; boş arşiv uydurma üretmez', () => {
  const many = [
    ...Array.from({ length: 7 }, (_, i) => bandRec({ matchKey: `a${i}`, result: '1' })),
    ...Array.from({ length: 3 }, (_, i) => bandRec({ matchKey: `b${i}`, pct: { '1': 75, X: 15, '2': 10 }, result: 'X' })),
  ];
  const bh = computeBandHistory(buildBandHistoryRows(many));
  const b70 = bh.bands.find((b) => b.label === '%70–79');
  assert.equal(bh.hasData, true);
  assert.equal(b70.sample, 10);
  assert.equal(b70.favoriteWinRate, 70);

  const bos = computeBandHistory(buildBandHistoryRows([]));
  assert.equal(bos.hasData, false);
  assert.equal(bos.bands.every((b) => b.sample === 0), true);
});

test('TOPLAM satırı: kırılımlar aynı kayıtların iki görünümü, toplam ayrı verilir', () => {
  // 2 benzer kayıt: biri 1, diğeri 2 bitmiş. Gün kırılımı 2+0, sıra kırılımı 1+1.
  // Toplam gösterilmezse kullanıcı "2 kayıt vardı, neden 1 yazıyor?" der.
  const r = findPlayedDna([
    rec({ matchKey: 'a', position: 6, pct: { '1': 62, X: 26, '2': 12 }, result: '1' }),
    rec({ matchKey: 'b', position: 11, pct: { '1': 61, X: 27, '2': 12 }, result: '2' }),
  ], { current: { '1': 62, X: 26, '2': 12 }, source: 'nesine', position: 6, weekday: 5 });

  assert.equal(r.matched, 2);
  assert.equal(r.overall.total, 2);                       // TOPLAM mevcut
  assert.equal(r.overall.text, '2 benzer kayıt → 1: %50 · 2: %50');
  // Her kırılım kendi içinde toplama eşit (çift sayım yok).
  assert.equal(r.byDay.selected.total + r.byDay.others.total, r.overall.total);
  assert.equal(r.byPosition.own.total + r.byPosition.rest.total, r.overall.total);
});

test('öğrenme sırası: arşiv ANALİZ EDİLEN HAFTADAN ÖNCESİDİR (52→51, 53→51+52)', async () => {
  const HAFTA = { 1524: '50. Hafta', 1525: '51. Hafta', 1526: '52. Hafta', 1527: '53. Hafta' };
  const store = {
    listBulletins: async () => [1527, 1526, 1525, 1524].map((r) => ({ id: `b${r}`, roundId: r, week: HAFTA[r] })),
    listObservations: async () => [obs({ observedAt: '2026-07-22T20:00:00Z' })],
    listOfficialResults: async () => results,
    getMatches: async () => matches,
  };
  const arsiv = async (analizEdilen) => {
    _resetPlayedDnaMemo();
    const k = await collectPlayedDnaRecords(store, { beforeRoundId: analizEdilen, force: true });
    return [...new Set(k.map((x) => x.roundId))].sort();
  };
  assert.deepEqual(await arsiv(1525), []);                 // 51 analiz → öncesi yok
  assert.deepEqual(await arsiv(1526), [1525]);             // 52 analiz → 51
  assert.deepEqual(await arsiv(1527), [1525, 1526]);       // 53 analiz → 51 + 52
});

test('gelecekten sızma yok: geçmiş haftaya bakarken sonraki haftalar arşive girmez', async () => {
  const store = {
    listBulletins: async () => [1528, 1527, 1526, 1525].map((r) => ({ id: `b${r}`, roundId: r })),
    listObservations: async () => [obs({ observedAt: '2026-07-22T20:00:00Z' })],
    listOfficialResults: async () => results,
    getMatches: async () => matches,
  };
  _resetPlayedDnaMemo();
  const k = await collectPlayedDnaRecords(store, { beforeRoundId: 1526, force: true });
  assert.equal(k.every((x) => x.roundId < 1526), true);
  assert.deepEqual([...new Set(k.map((x) => x.roundId))], [1525]);
});

// --- gün başına en az bir kayıt (dedup gün sınırında durur) -----------------
import { shouldSkipAsDuplicate, isDuplicateOfLast } from '../src/providers/playedPercentages.js';
import { dayKeyOf } from '../src/radar/playedDnaArchive.js';

test('dedup GÜN İÇİNDE kalır: yüzde değişmese de her günün ilk gözlemi yazılır', () => {
  const PCT = { '1': 61, X: 23, '2': 16 };
  // Istanbul = UTC+3 → 27.07 20:00Z Pazartesi 23:00 · 27.07 21:39Z Salı 00:39
  const pazartesi = { observedAt: '2026-07-27T20:00:00Z', playedPct: PCT };
  const pazartesiSonra = Date.parse('2026-07-27T20:30:00Z');
  const sali = Date.parse('2026-07-27T21:39:00Z');

  // Aynı gün, aynı değer → yazma (gereksiz satır üretme).
  assert.equal(shouldSkipAsDuplicate(pazartesi, PCT, pazartesiSonra, dayKeyOf), true);
  // YENİ GÜN, aynı değer → MUTLAKA yaz. Aksi hâlde o güne hiç kayıt düşmez ve
  // DNA "bu gün için kayıt yok" der; oysa değerin sabit kalması gerçek bilgidir.
  assert.equal(shouldSkipAsDuplicate(pazartesi, PCT, sali, dayKeyOf), false);
  // Aynı gün ama değer değişti → yaz.
  assert.equal(shouldSkipAsDuplicate(pazartesi, { '1': 62, X: 23, '2': 15 }, pazartesiSonra, dayKeyOf), false);
  // Önceki gözlem yoksa → yaz.
  assert.equal(shouldSkipAsDuplicate(null, PCT, sali, dayKeyOf), false);
  // Ham karşılaştırma davranışı korunuyor.
  assert.equal(isDuplicateOfLast(pazartesi, PCT), true);
});
