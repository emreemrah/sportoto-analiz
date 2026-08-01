// RAKİP SEVİYESİ & SAHA PERFORMANSI TESTLERİ (görev D)
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  tableBefore, strengthAt, classifyOpponent, venueProfile, formQualityLabel,
  attachVenueProfiles, venueNarrative, OPP_THRESHOLDS,
} = await import('../src/analysis/opponentStrength.js');

const DAY = 86400;
const T0 = 1700000000;
const g = (homeId, awayId, sh, sa, day, extra = {}) => ({
  homeId, awayId, homeName: `T${homeId}`, awayName: `T${awayId}`,
  score: { home: sh, away: sa }, status: 'finished', dateUnix: T0 + day * DAY, ...extra,
});

// Sentetik 6 takımlı lig: T1 hep kazanır, T6 hep kaybeder; her takım her hafta oynar.
function makeLeague(weeks) {
  const ms = [];
  for (let w = 0; w < weeks; w++) {
    // basit eşleşme düzeni (ev/dep dönüşümlü)
    ms.push(g(1, 6, 3, 0, w * 7));       // T1 güçlü, T6 zayıf
    ms.push(g(2, 5, 2, 1, w * 7));
    ms.push(g(3, 4, 1, 1, w * 7));
  }
  return ms;
}

test('1. Point-in-time tablo: yalnız kesimden ÖNCE bitmiş maçlar sayılır', () => {
  const ms = makeLeague(4);                       // 0., 7., 14., 21. günler
  const t = tableBefore(ms, T0 + 8 * DAY);        // yalnız ilk 2 hafta
  assert.equal(t.byId.get(1).p, 2);
  assert.equal(t.byId.get(1).pts, 6);
  // Sonradan oynanan maçlar tabloyu DEĞİŞTİRMEZ (geçmişe bugünkü sıra uygulanmaz):
  const withFuture = tableBefore([...ms, g(6, 1, 9, 0, 100)], T0 + 8 * DAY);
  assert.deepEqual(
    { p: withFuture.byId.get(1).p, pts: withFuture.byId.get(1).pts },
    { p: 2, pts: 6 },
    'gelecekteki sonuç geçmiş tabloya sızamaz',
  );
});

test('2. Lig büyüklüğüne duyarlı yüzdelik: lider 0, sonuncu 1 (sabit "ilk 5" yok)', () => {
  const ms = makeLeague(4);
  const t = tableBefore(ms, T0 + 30 * DAY);
  assert.equal(t.byId.get(1).percentile, 0, 'lider yüzdelik 0');
  assert.equal(t.byId.get(6).percentile, 1, 'sonuncu yüzdelik 1');
  // 6 takımda da 20 takımda da aynı ölçek (0-1):
  assert.ok(t.teams.every((r) => r.percentile >= 0 && r.percentile <= 1));
});

test('3. strengthAt: asgari maç sayısı altında null (uydurma güç üretilmez)', () => {
  const ms = makeLeague(2);                       // takım başına 2 maç < minPlayed 3
  assert.equal(strengthAt(1, ms, T0 + 30 * DAY), null);
  const ms4 = makeLeague(4);
  const s = strengthAt(1, ms4, T0 + 30 * DAY);
  assert.ok(s && s.played === 4 && s.percentile === 0);
});

test('4. classifyOpponent: GERÇEK PUAN FARKINA göre güçlü/denk/zayıf; veri yoksa unknown', () => {
  const own = { ppg: 1.0, played: 15 };
  assert.equal(classifyOpponent(own, { ppg: 2.0, played: 15 }).tier, 'strong', 'fark 15 puan → güçlü');
  assert.equal(classifyOpponent({ ppg: 2.0, played: 15 }, own).tier, 'weak', 'fark −15 puan → zayıf');
  assert.equal(classifyOpponent(own, { ppg: 1.5, played: 15 }).tier, 'even', 'fark 7.5 < 10 → denk');
  assert.equal(classifyOpponent(own, null).tier, 'unknown');
  assert.equal(classifyOpponent(null, { ppg: 2.0, played: 15 }).tier, 'unknown', 'kendi gücü bilinmeden sınıf uydurulmaz');
});

test('4b. KULLANICI KURALI: sınıf farkı için ≥10 puan (10-12 bandı kabul); 6 puanlık "14 sıra" DENK', () => {
  // Sıkışık tablo: 1. sıra 2.0 ppg, 15. sıra 1.6 ppg (15 maçta 6 puan fark):
  // sıralamada uçurum görünür ama 2 maçlık iş — sınıf farkı DEĞİL.
  const leader = { ppg: 2.0, played: 15 }, fifteenth = { ppg: 1.6, played: 15 };
  assert.equal(classifyOpponent(fifteenth, leader).tier, 'even', '6 puan < 10 → lider bile DENK');
  assert.equal(classifyOpponent(leader, fifteenth).tier, 'even');
  // Band sınırları: 10 puan kabul, 12 puan kesin, 9 puan denk.
  assert.equal(classifyOpponent({ ppg: 1.0, played: 20 }, { ppg: 1.5, played: 20 }).tier, 'strong', 'fark tam 10 → kabul');
  assert.equal(classifyOpponent({ ppg: 1.0, played: 20 }, { ppg: 1.6, played: 20 }).tier, 'strong', 'fark 12 → kesin güçlü');
  assert.equal(classifyOpponent({ ppg: 1.0, played: 18 }, { ppg: 1.5, played: 18 }).tier, 'even', 'fark 9 < 10 → denk');
  // Farklı maç sayısı: ortalama oynananla puana çevrilir (adil kıyas).
  assert.equal(classifyOpponent({ ppg: 1.0, played: 14 }, { ppg: 2.0, played: 16 }).tier, 'strong', '1.0 fark × 15 ort = 15 puan');
});

test('5. venueProfile: ev profili YALNIZ ev maçları, deplasman YALNIZ deplasman', () => {
  const ms = [
    g(10, 20, 2, 0, 0), g(10, 21, 1, 0, 7), g(22, 10, 0, 0, 14), g(23, 10, 3, 1, 21),
    // tablo oluşsun diye dolgu maçları
    ...makeLeague(4).map((m) => ({ ...m, homeId: m.homeId + 30, awayId: m.awayId + 30 })),
  ];
  const home = venueProfile(10, ms, { venue: 'home', beforeUnix: T0 + 60 * DAY });
  assert.equal(home.games.length, 2, 'yalnız 2 ev maçı');
  assert.ok(home.games.every((x) => ['T20', 'T21'].includes(x.oppName)));
  const away = venueProfile(10, ms, { venue: 'away', beforeUnix: T0 + 60 * DAY });
  assert.equal(away.games.length, 2, 'yalnız 2 deplasman maçı');
  assert.equal(away.games.find((x) => x.oppName === 'T23').result, 'M', 'deplasman 1-3 mağlubiyet');
});

test('6. Point-in-time rakip sınıfı: BUGÜNKÜ tablo geçmiş maçın sınıfını DEĞİŞTİREMEZ', () => {
  // T50, 30. gün T6'yı (o gün itibarıyla SONUNCU) yener. Sonra T6 her maçı kazanıp
  // lidere yükselse de o galibiyet "zayıf rakibe karşı" olarak SINIFLI KALIR.
  const base = makeLeague(4);                            // T6 ilk 4 haftada hep kaybetti
  const match = g(50, 6, 2, 0, 30);
  // T50 tabloya girsin — puan-farkı kuralı (≥10) için yeterli fark oluşturacak
  // kadar maç: 30. günde T50 13p/5maç (2.6 ppg), T6 0p/4maç → fark ≈ 11.7 puan.
  const t50fill = [g(50, 31, 1, 0, 5), g(32, 50, 0, 2, 12), g(50, 33, 1, 1, 19), g(50, 34, 2, 0, 23), g(35, 50, 0, 1, 26)];
  const before = [...base, ...t50fill, match];
  const profBefore = venueProfile(50, before, { venue: 'home', beforeUnix: T0 + 40 * DAY });
  const clsBefore = profBefore.games.find((x) => x.oppId === 6).oppTier;
  assert.equal(clsBefore, 'weak', '30. günde T6 zayıftı');
  // T6 sonradan 20 maç kazanır (bugün lider olur):
  const future = Array.from({ length: 20 }, (_, i) => g(6, 40 + i, 5, 0, 40 + i * 3));
  const profAfter = venueProfile(50, [...before, ...future], { venue: 'home', beforeUnix: T0 + 200 * DAY });
  const clsAfter = profAfter.games.find((x) => x.oppId === 6).oppTier;
  assert.equal(clsAfter, 'weak', 'bugünkü tablo geçmiş sınıfı DEĞİŞTİREMEZ (point-in-time)');
});

test('7. Kalite etiketleri: Şişirilmiş / Kaliteli / Güçlü Rakip Sorunu / Seviye Testi Eksik', () => {
  const mk = (tiers, results) => ({
    venue: 'home',
    games: tiers.map((tier, i) => ({ oppTier: tier, result: results[i], gf: 0, ga: 0 })),
    last5TierCounts: {},
  });
  assert.equal(formQualityLabel(mk(
    ['weak', 'weak', 'weak', 'weak', 'even'], ['G', 'G', 'G', 'G', 'B'],
  )).key, 'inflated', '4 galibiyetin 4\'ü zayıfa → Şişirilmiş Form');
  assert.equal(formQualityLabel(mk(
    ['strong', 'even', 'weak', 'strong', 'even'], ['G', 'G', 'G', 'B', 'G'],
  )).key, 'quality', 'galibiyetler güçlü/denk ağırlıklı → Kaliteli Form');
  assert.equal(formQualityLabel(mk(
    ['strong', 'strong', 'weak', 'weak', 'weak'], ['M', 'M', 'G', 'G', 'G'],
  )).key, 'strong_struggle', 'güçlü rakiplere 2/2 kayıp → Güçlü Rakip Sorunu');
  assert.equal(formQualityLabel(mk(
    ['weak', 'weak', 'unknown'], ['G', 'G', 'G'],
  )).key, 'insufficient', '3 maç < asgari örnek → Seviye Testi Eksik');
  assert.equal(formQualityLabel(mk(
    ['weak', 'weak', 'weak', 'weak', 'weak'], ['B', 'M', 'B', 'M', 'B'],
  )).key, 'untested', 'hiç güçlü/denk rakip görmemiş → Seviye Testi Eksik');
});

test('8. xG olmadan çalışır (yalnız skor/puan/gol girdisi)', () => {
  const ms = makeLeague(5);
  const prof = venueProfile(1, ms, { venue: 'home', beforeUnix: T0 + 60 * DAY });
  assert.ok(prof.season.p >= 4, 'xG alanı olmayan maçlarla profil üretildi');
  assert.ok(prof.season.ppg != null);
  const s = JSON.stringify(prof);
  assert.ok(!s.includes('undefined'), 'bozuk alan yok');
});

test('9. attachVenueProfiles: ham form korunur (gizlenmez) + bu haftaki rakip sınıfı', () => {
  const ms = makeLeague(6);
  const stats = { home: { name: 'T1' }, away: { name: 'T6' } };
  attachVenueProfiles(stats, { seasonMatches: ms, homeId: 1, awayId: 6, beforeUnix: T0 + 60 * DAY });
  assert.ok(stats.home.venueProfile, 'ev profili eklendi');
  assert.ok(Array.isArray(stats.home.venueProfile.last5Raw), 'HAM son 5 sonuç korunur');
  assert.ok(stats.home.venueProfile.last5Raw[0].score, 'ham skor görünür');
  assert.equal(stats.home.venueProfile.currentOpponentTier, 'weak', 'liderin rakibi sonuncu → zayıf');
  assert.equal(stats.away.venueProfile.currentOpponentTier, 'strong', 'sonuncunun rakibi lider → güçlü');
  assert.ok(stats.home.venueProfile.qualityLabel?.label, 'kalite etiketi var');
  // Eksik girdiyle sessiz geçer (crash yok, uydurma yok):
  const empty = attachVenueProfiles({ home: {} }, { seasonMatches: [], homeId: 1, awayId: 2, beforeUnix: T0 });
  assert.equal(empty.home.venueProfile, undefined);
});

test('10. venueNarrative: anlaşılır Türkçe gerekçe cümlesi (toplam G/B/M + seviye kırılımı)', () => {
  const ms = makeLeague(6);
  const prof = venueProfile(1, ms, { venue: 'home', beforeUnix: T0 + 60 * DAY });
  const txt = venueNarrative(prof, 'Ev sahibi');
  assert.match(txt, /^Ev sahibi son \d iç saha maçında \dG \dB \dM aldı — /);
  assert.match(txt, /rakiple \d maç \dG \dB \dM/, `seviye kırılımında sonuçlar açık olmalı: ${txt}`);
});

test('10b. venueNarrative: "3 güçlü rakip" tek başına YAZILMAZ — o maçların sonucu da belli olur', () => {
  const prof = {
    venue: 'home',
    games: [
      { oppTier: 'strong', result: 'G' },
      { oppTier: 'strong', result: 'B' },
      { oppTier: 'strong', result: 'M' },
      { oppTier: 'weak', result: 'G' },
      { oppTier: 'even', result: 'M' },
    ],
  };
  const txt = venueNarrative(prof, 'Ev sahibi');
  assert.ok(txt.includes('2G 1B 2M aldı'), `toplam sonuç açık: ${txt}`);
  assert.ok(txt.includes('güçlü rakiple 3 maç 1G 1B 1M'), `güçlü rakip sonuçları açık: ${txt}`);
  assert.ok(txt.includes('denk rakiple 1 maç 0G 0B 1M'), `denk rakip sonucu açık: ${txt}`);
  assert.ok(txt.includes('zayıf rakiple 1 maç 1G 0B 0M'), `zayıf rakip sonucu açık: ${txt}`);
});
