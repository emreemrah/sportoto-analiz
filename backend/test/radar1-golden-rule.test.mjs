// RADAR 1 — ALTIN KURAL TESTLERİ
// Kural: güçlü/denk/zayıf ayrımı her kriter cümlesinde uygulanır ve maçın
// kendisi için "bu iki takım denk mi, hangisi güçlü?" sorusu açıkça cevaplanır.
// Ayrıca sinyal-normalize skorlar asla %100/%0 kesinlik iddiasına dönüşemez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computePerformanceRadar } from '../src/radar/performanceRadar.js';
import { sidesToScores } from '../src/radar/signalFamilies.js';
import { positionByName } from '../src/radar/util.js';

// Ortak fixture: iki takımın da saha profili + güç kaydı olan gerçekçi maç.
function makeMatch({ tier = 'weak' } = {}) {
  const vp = (venue, ownRank, oppRank) => ({
    venue,
    byTier: {
      strong: { p: 2, w: 0, d: 1, l: 1, ppg: 0.5 },
      even: { p: 2, w: 1, d: 1, l: 0, ppg: 2 },
      weak: { p: 3, w: 3, d: 0, l: 0, ppg: 3 },
      unknown: { p: 0, w: 0, d: 0, l: 0, ppg: null },
    },
    last5: { p: 5, w: 3, d: 1, l: 1 },
    last5TierCounts: { strong: 1, even: 2, weak: 2, unknown: 0 },
    qualityLabel: { key: 'normal', label: 'Normal Form', reason: 'Rakip dağılımı dengeli.' },
    narrative: `${venue === 'home' ? 'Ev sahibi' : 'Deplasman'} son 5 ${venue === 'home' ? 'iç saha' : 'dış saha'} maçında 3G 1B 1M aldı — güçlü rakiple 1 maç 0G 1B 0M · denk rakiple 2 maç 1G 0B 1M · zayıf rakiple 2 maç 2G 0B 0M.`,
    currentOpponentTier: tier,
    currentOpponentLabel: tier === 'weak' ? 'Zayıf rakip' : tier === 'strong' ? 'Güçlü rakip' : 'Denk rakip',
    vsCurrentTier: { p: 3, w: 2, d: 1, l: 0, ppg: 2.33 },
    ownStrength: { rank: 2, teamCount: 14, percentile: 0.08, ppg: 2.4, played: 12 },
    opponentStrength: { rank: tier === 'weak' ? 12 : tier === 'strong' ? 1 : 4, teamCount: 14, percentile: tier === 'weak' ? 0.85 : tier === 'strong' ? 0.0 : 0.23, ppg: 1.0, played: 12 },
  });
  return {
    no: 1,
    stats: {
      home: {
        standing: { position: 2, points: 30, wins: 9, draws: 3, losses: 2, ppg: 2.4, played: 14, home: { wins: 5, draws: 1, losses: 0 } },
        last5: ['G', 'G', 'B', 'G', 'M'],
        season: { goalsPerGame: 2.1, concededPerGame: 0.9 },
        venueProfile: vp('home'),
      },
      away: {
        standing: { position: 12, points: 12, wins: 3, draws: 3, losses: 8, ppg: 0.86, played: 14, away: { wins: 1, draws: 1, losses: 5 } },
        last5: ['M', 'M', 'B', 'M', 'G'],
        season: { goalsPerGame: 0.9, concededPerGame: 1.8 },
        venueProfile: vp('away', 12, 2),
      },
    },
  };
}

test('güç dengesi başlığı: "bu iki takım denk mi, kim güçlü?" her kartta İLK cümle olarak cevaplanır', () => {
  const r = computePerformanceRadar(makeMatch({ tier: 'weak' }), {});
  assert.ok(r.positives[0].startsWith('Güç dengesi:'), `ilk cümle güç dengesi olmalı: ${r.positives[0]}`);
  assert.ok(r.positives[0].includes('ev sahibi kağıt üstünde GÜÇLÜ'), r.positives[0]);
  assert.ok(r.positives[0].includes('lig sırası: ev 2./14 · dep 12./14'), `sıralar açık: ${r.positives[0]}`);
  assert.equal(r.details.strengthBalance.tier, 'weak');
  assert.equal(r.details.strengthBalance.label, 'Ev güçlü');
});

test('güç dengesi: DENK durum açıkça söylenir; deplasman güçlüyse o da söylenir', () => {
  const even = computePerformanceRadar(makeMatch({ tier: 'even' }), {});
  assert.ok(even.positives[0].includes('birbirine DENK'), even.positives[0]);
  const strong = computePerformanceRadar(makeMatch({ tier: 'strong' }), {});
  assert.ok(strong.positives[0].includes('deplasman kağıt üstünde GÜÇLÜ'), strong.positives[0]);
  assert.equal(strong.details.strengthBalance.label, 'Deplasman güçlü');
});

test('iç/dış saha puan cümlelerine seviye kırılımı eklenir (güçlüye/denke/zayıfa puan/maç)', () => {
  const r = computePerformanceRadar(makeMatch(), {});
  const venueLine = [...r.positives, ...r.negatives].find((t) => t.includes('iç sahada maç başı'));
  assert.ok(venueLine, 'iç saha cümlesi olmalı');
  assert.ok(venueLine.includes('güçlüye 0.5') && venueLine.includes('denke 2') && venueLine.includes('zayıfa 3'),
    `seviye kırılımı cümlede olmalı: ${venueLine}`);
});

test('son 5 form cümlesi rakip gücü ayarlı kıyası da taşır (ham dizi tek başına bırakılmaz)', () => {
  const m = makeMatch();
  // Lig tablosu PUAN/MAÇ ile: sınıf artık ppg farkına göre (≥0.5 → güçlü/zayıf).
  const PTS = [26, 24, 22, 20, 18, 16, 14, 13, 12, 10, 8, 7, 6, 4];
  const table = { overall: Array.from({ length: 14 }, (_, i) => ({ position: i + 1, name: `Takim${i + 1}`, points: PTS[i], played: 10 })) };
  m.stats.leagueTable = table;
  m.stats.home.last5detail = [
    { result: 'G', oppName: 'Takim1' }, { result: 'G', oppName: 'Takim2' },
    { result: 'B', oppName: 'Takim7' }, { result: 'G', oppName: 'Takim13' }, { result: 'M', oppName: 'Takim14' },
  ];
  m.stats.away.last5detail = [
    { result: 'M', oppName: 'Takim1' }, { result: 'M', oppName: 'Takim8' },
    { result: 'B', oppName: 'Takim9' }, { result: 'M', oppName: 'Takim13' }, { result: 'G', oppName: 'Takim14' },
  ];
  const r = computePerformanceRadar(m, {});
  const formLine = [...r.positives, ...r.negatives].find((t) => t.startsWith('Son 5 form'));
  assert.ok(formLine, 'form cümlesi olmalı');
  // ALTIN KURAL: soyut endeks değil, seviye başına AÇIK sonuç dökümü — sınıf
  // PUAN/MAÇ farkıyla (±0.5). Ev ppg 2.4: T1(2.6)/T2(2.4) denk, T7(1.4)/T13(0.6)/
  // T14(0.4) zayıf. Dep ppg 0.86: T1(2.6) güçlü (+1.74); T8(1.3)/T9(1.2)/T13/T14 denk.
  assert.ok(formLine.includes('Ev 3G 1B 1M (denk rakiple 2 maç 2G 0B 0M · zayıf rakiple 3 maç 1G 1B 1M)'),
    `ev kırılımı ppg kuralına göre olmalı: ${formLine}`);
  assert.ok(formLine.includes('güçlü rakiple 1 maç 0G 0B 1M'), `dep için yalnız GERÇEK sınıf farkı güçlü sayılmalı: ${formLine}`);
  assert.ok(formLine.includes('denk rakiple 4 maç 1G 1B 2M'), `sıkışık orta grup denk sayılmalı: ${formLine}`);
  assert.ok(!formLine.includes('/100'), 'soyut endeks kartta gösterilmez (anlaşılır dil kuralı)');
});

test('rakip çözülemezse form kırılımı "seviyesi bilinmeyen" olarak DÜRÜSTÇE yazılır', () => {
  const m = makeMatch();
  const PTS = [26, 24, 22, 20, 18, 16, 14, 13, 12, 10, 8, 7, 6, 4];
  const table = { overall: Array.from({ length: 14 }, (_, i) => ({ position: i + 1, name: `Takim${i + 1}`, points: PTS[i], played: 10 })) };
  m.stats.leagueTable = table;
  m.stats.home.last5detail = [
    { result: 'G', oppName: 'Takim1' }, { result: 'M', oppName: 'Hic Olmayan Kulup' },
    { result: 'B', oppName: 'Takim7' }, { result: 'G', oppName: 'Takim13' }, { result: 'M', oppName: 'Takim14' },
  ];
  m.stats.away.last5detail = m.stats.home.last5detail.map((x) => ({ ...x }));
  const r = computePerformanceRadar(m, {});
  const formLine = r.details.coreLines[3];
  assert.ok(formLine.includes('seviyesi bilinmeyenle 1 maç 0G 0B 1M'), `bilinmeyen rakip uydurulmaz, açık yazılır: ${formLine}`);
});

test('rakip eşleşmesi: LOGO kimliği kısa/uzun ad farkını çözer ("TPS" ↔ "Turun Palloseura"); belirsiz içerme reddedilir', () => {
  const lt = { overall: [
    { position: 1, name: 'KuPS', logo: 'https://cdn.x.org/img/teams/finland-kuopion-palloseura.png' },
    { position: 8, name: 'TPS', logo: 'https://cdn.x.org/img/teams/finland-turun-palloseura.png' },
    { position: 11, name: 'Jaro', logo: 'https://cdn.x.org/img/teams/finland-ff-jaro.png' },
    { position: 5, name: 'Inter Turku', logo: 'https://cdn.x.org/img/teams/finland-fc-inter-turku.png' },
  ] };
  // 1) Logo kimliği: ad hiç tutmasa da kesin eşleşir (bu tabloda puan yok → ppg null).
  assert.deepEqual(positionByName(lt, 'Turun Palloseura', 'https://cdn.x.org/img/teams/finland-turun-palloseura.png'),
    { position: 8, teamCount: 4, ppg: null, played: null });
  // 2) İçerme: "FF Jaro" ↔ "Jaro" (tek aday) logosuz da çözülür.
  assert.deepEqual(positionByName(lt, 'FF Jaro'), { position: 11, teamCount: 4, ppg: null, played: null });
  // 3) Belirsizlik reddi: "Turku" hem TPS'in eski adına hem Inter Turku'ya benzeyebilir —
  //    burada tek aday değilse null (yanlış takıma bağlanmaz). Kısa (<4) anahtarlar da reddedilir.
  assert.equal(positionByName(lt, 'FC'), null);
  // 4) Logo eşleşmezse ada düşer; o da yoksa null (uydurma yok).
  assert.equal(positionByName(lt, 'Bilinmeyen Takim', 'https://cdn.x.org/img/teams/finland-yok-boyle-takim.png'), null);
});

test('sidesToScores yumuşatma: tek yönlü sinyal yığılması asla %100/%0 üretmez (kesinlik iddiası yok)', () => {
  const s = sidesToScores({ home: 10, draw: 0, away: 0 });
  assert.equal(s.home + s.draw + s.away, 100);
  assert.ok(s.home < 100, `%100 gösterilemez: ${JSON.stringify(s)}`);
  assert.ok(s.draw > 0 && s.away > 0, `hiçbir taraf %0 olamaz: ${JSON.stringify(s)}`);
  assert.ok(s.home >= 70, `yön/üstünlük yine de korunur: ${JSON.stringify(s)}`);
  // Sinyal yoksa yine null (nötr 50 uydurulmaz — dürüstlük kuralı değişmedi).
  assert.equal(sidesToScores({ home: 0, draw: 0, away: 0 }), null);
});

test('KART TUTARLILIĞI: her maçta AYNI 4 çekirdek satır — güç dengesi, ev karnesi, dep karnesi, form hükmü', () => {
  const r = computePerformanceRadar(makeMatch(), {});
  const cl = r.details.coreLines;
  assert.equal(cl.length, 4, 'her kartta tam 4 çekirdek satır');
  assert.ok(cl[0].startsWith('Güç dengesi:'), cl[0]);
  assert.ok(cl[1].includes('iç saha'), cl[1]);
  assert.ok(cl[2].includes('dış saha'), cl[2]);
  assert.ok(cl[3].startsWith('Son 5 form'), cl[3]);
});

test('form farkı küçükse hüküm DENK olarak AÇIKÇA yazılır (satır sessizce kaybolmaz)', () => {
  const m = makeMatch();
  m.stats.home.last5 = ['G', 'B', 'M', 'G', 'M'];   // 0.5
  m.stats.away.last5 = ['M', 'G', 'B', 'M', 'G'];   // 0.5 → fark 0 < 0.15
  const r = computePerformanceRadar(m, {});
  assert.ok(r.details.coreLines[3].includes('iki takım DENK'), r.details.coreLines[3]);
  assert.ok(!r.activeSignals.some((s) => s.key === 'formGeneral'), 'denk formdan sinyal üretilmez (skor şişmez)');
});

test('veri eksikse çekirdek satırlar uydurulmaz — dürüst "verisi yok" metni yazılır', () => {
  const m = makeMatch();
  delete m.stats.home.last5;
  delete m.stats.home.venueProfile;
  const r = computePerformanceRadar(m, {});
  const cl = r.details.coreLines;
  assert.equal(cl.length, 4);
  assert.ok(cl[0].includes('yeterli lig verisi yok'), cl[0]);
  assert.ok(cl[1].includes('yeterli sezon maçı eşleşmedi'), cl[1]);
  assert.ok(cl[3].includes('verisi yok'), cl[3]);
});

test('güç verisi yoksa güç dengesi uydurulmaz; dürüst eksik kaydı düşülür', () => {
  const m = makeMatch();
  delete m.stats.home.venueProfile.ownStrength;
  const r = computePerformanceRadar(m, {});
  assert.ok(!r.positives.some((t) => t.startsWith('Güç dengesi:')), 'verisiz güç dengesi cümlesi olmamalı');
  assert.equal(r.details.strengthBalance, null);
  assert.ok(r.missingSignals.some((s) => s.key === 'strengthBalance'));
});
