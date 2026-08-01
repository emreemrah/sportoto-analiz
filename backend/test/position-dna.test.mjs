// BÜLTEN SIRA DNA'SI TESTLERİ (görev B)
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  computePositionDna, shrunkPct, sampleTier, positionStatsFromHistory,
  mergePositionStats, positionSummaryText,
} = await import('../src/history/positionDna.js');

// Yardımcı: n bülten × 15 sıra sentetik arşiv. resFn(pos, i) sonucu belirler.
function makeMatches(n, resFn, { startRound = 1000 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const roundId = startRound + i;
    const closeAt = new Date(Date.UTC(2024, 0, 1) + i * 7 * 86400e3).toISOString();
    for (let pos = 1; pos <= 15; pos++) {
      out.push({ position: pos, result: resFn(pos, i), roundId, roundCloseAt: closeAt, seasonYear: i < n / 2 ? '2023-2024' : '2024-2025' });
    }
  }
  return out;
}

test('1. Pencereler: son 5/10/25/50 en YENİ bültenlerden sayılır', () => {
  // 14. sıra: ilk 40 bülten hep '1', son 10 bülten hep '2'.
  const ms = makeMatches(50, (pos, i) => (pos === 14 ? (i >= 40 ? '2' : '1') : 'X'));
  const dna = computePositionDna(ms);
  const p14 = dna.positions.find((p) => p.position === 14);
  assert.equal(p14.windows.last5.counts['2'], 5, 'son 5 bülten = en yeni 5');
  assert.equal(p14.windows.last10.counts['2'], 10);
  assert.equal(p14.windows.last50.counts['1'], 40);
  assert.equal(p14.windows.allTime.sample, 50);
});

test('2. Küçük örneklem: n<10 yön sinyali ÜRETMEZ (yalnız bilgi)', () => {
  const ms = makeMatches(4, () => '1');
  const dna = computePositionDna(ms);
  for (const p of dna.positions) {
    assert.equal(p.sample, 4);
    assert.equal(p.directional, false, 'n<10 → directional=false');
    assert.equal(p.sampleTier, 'info');
  }
  assert.equal(sampleTier(5).key, 'info');
  assert.equal(sampleTier(10).key, 'low');
  assert.equal(sampleTier(30).key, 'mid');
  assert.equal(sampleTier(100).key, 'strong');
});

test('3. Shrinkage: 3/3 galibiyet "%100 güçlü eğilim" olarak SUNULAMAZ', () => {
  const s = shrunkPct({ '1': 3, X: 0, '2': 0 }, 3, { '1': 33.3, X: 33.3, '2': 33.3 });
  assert.ok(s['1'] < 50, `3/3 shrinkage sonrası %${s['1']} — asla 100 değil`);
  assert.ok(s['1'] > 33.3, 'ama prior üstünde (bilgi tamamen yok sayılmaz)');
  // Büyük örneklemde shrinkage etkisi küçülür:
  const big = shrunkPct({ '1': 300, X: 0, '2': 0 }, 300, { '1': 33.3, X: 33.3, '2': 33.3 });
  assert.ok(big['1'] > 90, 'n=300 iken gerçek orana yaklaşır');
});

test('4. Öğrenme sınırı: excludeRoundId güncel haftayı, upToRoundCloseAt sonrasını DIŞLAR', () => {
  const ms = makeMatches(10, () => '1', { startRound: 1000 });
  const withoutCurrent = computePositionDna(ms, { excludeRoundId: 1009 });
  assert.equal(withoutCurrent.positions[0].sample, 9, 'güncel hafta (1009) hariç');
  const cutoff = new Date(Date.UTC(2024, 0, 1) + 5 * 7 * 86400e3).toISOString();
  const bounded = computePositionDna(ms, { upToRoundCloseAt: cutoff });
  assert.equal(bounded.positions[0].sample, 5, 'sınır tarihinden sonrası hariç (aynı hafta dahil değil)');
});

test('5. Geçersiz satırlar (conflict/aralık dışı) DNA\'ya girmez', () => {
  const ms = [
    { position: 1, result: '1', roundId: 1, roundCloseAt: '2024-01-01T00:00:00Z', seasonYear: 's' },
    { position: 1, result: null, roundId: 2, roundCloseAt: '2024-01-08T00:00:00Z', seasonYear: 's' },  // conflict satırı
    { position: 16, result: '1', roundId: 3, roundCloseAt: '2024-01-15T00:00:00Z', seasonYear: 's' },  // aralık dışı
    { position: 1, result: 'B', roundId: 4, roundCloseAt: '2024-01-22T00:00:00Z', seasonYear: 's' },   // bozuk sembol
  ];
  const dna = computePositionDna(ms);
  assert.equal(dna.totalMatches, 1);
  assert.equal(dna.positions[0].sample, 1);
});

test('6. Eğilim: son 25 ile tüm zaman farkı ≥7 puan → yükseliyor/düşüyor', () => {
  // 1. sıra: eski 75 bülten '1', son 25 bülten '2' → 2 yükseliyor.
  const ms = makeMatches(100, (pos, i) => (pos === 1 ? (i >= 75 ? '2' : '1') : 'X'));
  const dna = computePositionDna(ms);
  const p1 = dna.positions.find((p) => p.position === 1);
  // En büyük mutlak değişim raporlanır: ya "1 düşüyor" ya "2 yükseliyor" —
  // ikisi de aynı kaymanın dürüst okumasıdır.
  assert.notEqual(p1.trend.key, 'flat', 'belirgin kayma yatay sayılamaz');
  assert.ok(
    (p1.trend.outcome === '2' && p1.trend.key === 'rising')
    || (p1.trend.outcome === '1' && p1.trend.key === 'falling'),
    `tutarlı yön: ${JSON.stringify(p1.trend)}`,
  );
  assert.ok(Math.abs(p1.trend.delta) >= 7);
  // Sabit dağılımda eğilim yatay:
  const flat = computePositionDna(makeMatches(100, () => '1'));
  assert.equal(flat.positions[0].trend.key, 'flat');
});

test('7. Sezon kırılımı + segmentler (İlk5/Orta5/Son5) + bülten başına ortalama', () => {
  const ms = makeMatches(20, (pos) => (pos <= 5 ? '1' : pos <= 10 ? 'X' : '2'));
  const dna = computePositionDna(ms);
  const p3 = dna.positions.find((p) => p.position === 3);
  assert.deepEqual(Object.keys(p3.bySeason).sort(), ['2023-2024', '2024-2025']);
  assert.equal(p3.bySeason['2023-2024'].n, 10);
  assert.equal(dna.segments.first5.counts['1'], 100, 'ilk 5 sırada 20 bülten × 5 sıra = 100 maç hepsi 1');
  assert.equal(dna.segments.mid5.counts.X, 100);
  assert.equal(dna.segments.last5.counts['2'], 100);
  assert.equal(dna.perBulletinAvg['1'], 5, 'bülten başına ortalama 5 tane 1');
  assert.equal(dna.totalBulletins, 20);
});

test('8. Kullanıcı cümlesi biçimi: "14. sıradaki maçlar son 50 bültende ..."', () => {
  const ms = makeMatches(50, (pos, i) => {
    if (pos !== 14) return 'X';
    return i % 50 < 19 ? '1' : i % 50 < 36 ? 'X' : '2'; // 19×1, 17×X, 14×2
  });
  const dna = computePositionDna(ms);
  const txt = positionSummaryText(dna, 14, 'last50');
  assert.match(txt, /^14\. sıradaki maçlar son 50 bültende: 1 %38 · X %34 · 2 %28 · n=50$/);
  // Boş sıra dürüst mesaj:
  const empty = computePositionDna([]);
  assert.match(positionSummaryText(empty, 7, 'last50'), /yeterli doğrulanmış geçmiş sonuç yok/);
});

test('9. Radar 5 köprüsü: positionStatsFromHistory + mergePositionStats toplama', () => {
  const hist = [
    { position: 1, result: '1' }, { position: 1, result: '1' }, { position: 1, result: 'X' },
    { position: 2, result: '2' },
  ];
  const fromHist = positionStatsFromHistory(hist);
  assert.equal(fromHist.positions[0].sample, 3);
  assert.equal(fromHist.positions[0].counts['1'], 2);
  const forward = { positions: [{ position: 1, sample: 2, counts: { '1': 0, X: 1, '2': 1 }, pct: null }] };
  const merged = mergePositionStats(forward, fromHist);
  const m1 = merged.positions.find((p) => p.position === 1);
  assert.equal(m1.sample, 5, 'ileri-test + geçmiş arşiv toplanır');
  assert.equal(m1.counts.X, 2);
  assert.equal(m1.pct['1'], 40);
  // Tek taraf boşsa diğeri döner:
  assert.equal(mergePositionStats(null, fromHist), fromHist);
  assert.equal(mergePositionStats(forward, { positions: [] }), forward);
});

test('10. Metodoloji + feragat metni sabit', () => {
  const dna = computePositionDna([]);
  assert.equal(dna.methodologyVersion, 'position-dna-1.0.0');
  assert.equal(dna.disclaimer, 'Tarihsel yardımcı sinyal; tek başına tahmin gerekçesi değildir.');
});

test('11. historyLearningFilter: kapanış tarihi öncelikli, roundId güvenli yedek, güncel hafta her durumda dışarıda', async () => {
  const { historyLearningFilter } = await import('../src/history/positionDna.js');
  const f = historyLearningFilter({ currentRoundId: 1525, currentFreezeAt: '2026-07-24T19:55:00.000Z' });
  // Tarihli geçmiş hafta (id BÜYÜK olsa bile) kapanışı freeze'den önceyse KULLANILIR:
  assert.equal(f({ resultValid: true, roundId: 1600, roundCloseAt: '2026-05-01T00:00:00.000Z' }), true,
    'resmî id monoton olmasa da gerçek zaman çapası kazanır');
  // Kapanışı freeze sonrasında olan hafta KULLANILAMAZ:
  assert.equal(f({ resultValid: true, roundId: 1400, roundCloseAt: '2026-08-01T00:00:00.000Z' }), false);
  // Tarihi olmayan eski kayıt: roundId yedeği (küçük id → geçmiş):
  assert.equal(f({ resultValid: true, roundId: 500, roundCloseAt: null }), true);
  assert.equal(f({ resultValid: true, roundId: 1526, roundCloseAt: null }), false);
  // Güncel haftanın kendisi HER DURUMDA dışarıda:
  assert.equal(f({ resultValid: true, roundId: 1525, roundCloseAt: '2020-01-01T00:00:00.000Z' }), false);
  // Geçersiz sonuç asla giremez:
  assert.equal(f({ resultValid: false, roundId: 500 }), false);
});

test('12. Dönem pencereleri: last15 EN SON bültenden geriye; güncel hafta hariç; sıra bazlı', () => {
  // 20 bülten (i=0..19): 4. sırada ilk 4 hafta '1', kalan hepsi '2'.
  // Güncel hafta i=19 hariç → 19 kullanılabilir: i=0-3 '1' (4), i=4-18 '2' (15).
  const ms = makeMatches(20, (pos, i) => (pos === 4 ? (i < 4 ? '1' : '2') : 'X'), { startRound: 2000 });
  const dna = computePositionDna(ms, { excludeRoundId: 2019 }); // güncel (son) hafta hariç
  const p4 = dna.positions.find((p) => p.position === 4);
  assert.ok(p4.windows.last15, 'last15 penceresi eklendi');
  // En son 15 (i=18..4) = hepsi '2' → arşivin İLK haftalarından DEĞİL, sondan geriye.
  assert.equal(p4.windows.last15.pct['2'], 100, 'son 15 hafta hep 2 (sondan geriye)');
  assert.equal(p4.windows.last15.sample, 15);
  assert.equal(p4.windows.last5.pct['2'], 100);
  assert.equal(p4.windows.allTime.sample, 19, 'güncel hafta allTime\'a da girmez');
  assert.equal(p4.windows.allTime.counts['1'], 4);
});

test('13. Sezon filtresi: Radar 5 seçili sezon dışındaki haftaları kullanmaz', () => {
  const ms = [
    ...makeMatches(5, () => '1', { startRound: 1000 }).map((m) => ({ ...m, seasonYear: 'eski' })),
    ...makeMatches(5, () => '2', { startRound: 2000 }).map((m) => ({ ...m, seasonYear: 'yeni' })),
  ];
  const dna = computePositionDna(ms, { seasonYear: 'yeni' });
  const first = dna.positions.find((p) => p.position === 1);
  assert.equal(dna.totalBulletins, 5);
  assert.equal(first.windows.allTime.sample, 5);
  assert.equal(first.windows.allTime.counts['2'], 5);
  assert.equal(first.windows.allTime.counts['1'], 0);
});

// --- SIRA MAÇ LİSTESİ (Radar 5 satır açılımı) --------------------------------
// "%54.5 hangi maçlardan geliyor?" — yüzdenin arkasındaki maçlar. Liste
// computePositionDna ile AYNI sırada olmalı, yoksa "Son 5 Hafta" seçiliyken
// listenin ilk 5'i ekrandaki yüzdeyle uyuşmaz.
const { positionMatchList } = await import('../src/history/positionDna.js');

const mac = (pos, rid, kapanis, over = {}) => ({
  position: pos, roundId: rid, roundCloseAt: kapanis, result: '1',
  homeTeam: `Ev${rid}`, awayTeam: `Dep${rid}`, scoreHome: 2, scoreAway: 0, ...over,
});

test('14. Sıra maç listesi YENİDEN ESKİYE sıralanır (pencerelerle aynı)', () => {
  const liste = positionMatchList([
    mac(1, 1520, '2026-05-01'),
    mac(1, 1526, '2026-07-01'),
    mac(1, 1523, '2026-06-01'),
    mac(2, 1526, '2026-07-01'),          // başka sıra — girmemeli
  ], { position: 1 });
  assert.deepEqual(liste.map((m) => m.roundId), ['1526', '1523', '1520']);
  assert.equal(liste.length, 3, 'yalnız istenen sıranın maçları');
});

test('15. Sonucu olmayan maç listeye GİRMEZ (yüzdeye de girmiyor)', () => {
  const liste = positionMatchList([
    mac(1, 1526, '2026-07-01'),
    mac(1, 1525, '2026-06-24', { result: null }),        // ertelenen/iptal
    mac(1, 1524, '2026-06-17', { result: 'çöp' }),       // geçersiz simge
  ], { position: 1 });
  assert.deepEqual(liste.map((m) => m.roundId), ['1526'],
    'liste ile yüzde AYNI kümeden gelmeli');
});

test('16. Hafta adı: satırın kendi adı öncelikli, yoksa ad tablosu, yoksa null', () => {
  const liste = positionMatchList([
    mac(1, 1526, '2026-07-03', { weekName: '52. Hafta' }),   // arşiv haftası (ad tablosunda YOK)
    mac(1, 1525, '2026-07-02'),                              // ad tablosundan
    mac(1, 1524, '2026-07-01'),                              // hiçbir yerde yok
  ], { position: 1, roundNames: { 1525: '51. Hafta' } });
  assert.equal(liste[0].week, '52. Hafta');
  assert.equal(liste[1].week, '51. Hafta');
  assert.equal(liste[2].week, null, 'bilinmeyen hafta adı UYDURULMAZ');
});

test('17. Skoru olmayan maçta "0-0" yazılmaz', () => {
  const liste = positionMatchList([
    mac(1, 1526, '2026-07-01', { scoreHome: null, scoreAway: null }),
    mac(1, 1525, '2026-06-24', { scoreHome: 0, scoreAway: 0 }),
  ], { position: 1 });
  assert.equal(liste[0].score, null, 'bilinmeyen skor sonuç gibi gösterilemez');
  assert.equal(liste[1].score, '0-0', 'gerçek 0-0 ise yazılır');
});

test('18. Liste yalnız EKRANDA GÖRÜNEN alanları taşır (yanıt şişmesin)', () => {
  const [satir] = positionMatchList([mac(1, 1526, '2026-07-01', { seasonYear: '2025/2026', sourceHash: 'x' })],
    { position: 1 });
  assert.deepEqual(Object.keys(satir).sort(), ['away', 'home', 'result', 'roundId', 'score', 'week']);
});
