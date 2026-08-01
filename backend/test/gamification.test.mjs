// PUAN / SEVİYE / BAŞARI / GÖREV MOTORU TESTLERİ
//
// Güvence altına alınanlar:
//   1. Mükerrer ödül İMKÂNSIZDIR (aynı eylem ikinci kez puan yazamaz).
//   2. İsabet puanları YALNIZ resmî sonucu olan maçlardan hesaplanır.
//   3. Seviye tek formülden türetilir ve monotondur.
//   4. Görev ödülü BİR KEZ verilir; ilerleme gerçek veriden sayılır.
//   5. Migration 006 yoksa sistem kendini kapatır, uygulama akışı bozulmaz.
//   6. Hesap silme listesi yeni tabloları içerir; korunan tablolar listede YOKTUR.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  levelFromPoints, thresholdForLevel, MAX_LEVEL, POINT_RULES, ACHIEVEMENTS, TASKS,
} from '../src/gamification/catalog.js';
import {
  award, totalPoints, settleRoundAccuracy, evaluateProgress,
  gradeScorePred, gradePollVote, _resetAvailability, _clearSettleThrottle,
} from '../src/gamification/service.js';
import { USER_OWNED_TABLES } from '../src/accountDeletion.js';
import { makeFakeSb } from './helpers/fakeSupabase.mjs';

function freshSb(opts) { _resetAvailability(); _clearSettleThrottle(); return makeFakeSb(opts); }

// ---------------------------------------------------------------------------
// Seviye formülü
// ---------------------------------------------------------------------------
test('seviye: eşikler tek formülden, monoton artan', () => {
  assert.equal(thresholdForLevel(1), 0);
  assert.equal(thresholdForLevel(2), 50);
  assert.equal(thresholdForLevel(3), 150);
  assert.equal(thresholdForLevel(5), 500);
  for (let n = 2; n <= MAX_LEVEL; n++) {
    assert.ok(thresholdForLevel(n) > thresholdForLevel(n - 1), `seviye ${n} eşiği artmalı`);
  }
});

test('seviye: puandan seviye ve ilerleme yüzdesi doğru', () => {
  assert.equal(levelFromPoints(0).level, 1);
  assert.equal(levelFromPoints(49).level, 1);
  assert.equal(levelFromPoints(50).level, 2);
  assert.equal(levelFromPoints(499).level, 4);
  assert.equal(levelFromPoints(500).level, 5);
  const l = levelFromPoints(100); // seviye 2: 50 → 150 arası; 100 puan = %50
  assert.equal(l.level, 2);
  assert.equal(l.progressPct, 50);
  assert.equal(levelFromPoints(-5).level, 1, 'negatif puan çökertmez');
});

// ---------------------------------------------------------------------------
// Mükerrer ödül engeli
// ---------------------------------------------------------------------------
test('puan: AYNI eylem ikinci kez puan YAZAMAZ (unique kısıt)', async () => {
  const sb = freshSb();
  const ok1 = await award(sb, { userId: 'u1', kind: 'lock_score', refId: 'm1', points: 5 });
  const ok2 = await award(sb, { userId: 'u1', kind: 'lock_score', refId: 'm1', points: 5 });
  assert.equal(ok1, true, 'ilk yazım başarılı');
  assert.equal(ok2, false, 'ikinci yazım REDDEDİLİR');
  assert.equal(await totalPoints(sb, 'u1'), 5, 'toplam 5 kalır, 10 olmaz');
});

test('puan: farklı maç/eylem ayrı ödül alır, kullanıcılar birbirine karışmaz', async () => {
  const sb = freshSb();
  await award(sb, { userId: 'u1', kind: 'lock_score', refId: 'm1', points: 5 });
  await award(sb, { userId: 'u1', kind: 'lock_score', refId: 'm2', points: 5 });
  await award(sb, { userId: 'u2', kind: 'lock_score', refId: 'm1', points: 5 });
  assert.equal(await totalPoints(sb, 'u1'), 10);
  assert.equal(await totalPoints(sb, 'u2'), 5);
});

// ---------------------------------------------------------------------------
// İsabet puanlama — yalnız resmî sonuç
// ---------------------------------------------------------------------------
const REAL = { result: '1', score: { home: 2, away: 1 } };

test('gradeScorePred: tam skor 5, doğru sonuç 2, yanlış 0, resmî sonuç yoksa 0', () => {
  assert.equal(gradeScorePred({ ft_home: 2, ft_away: 1 }, REAL), 5);
  assert.equal(gradeScorePred({ ft_home: 3, ft_away: 0 }, REAL), 2);
  assert.equal(gradeScorePred({ ft_home: 0, ft_away: 2 }, REAL), 0);
  assert.equal(gradeScorePred({ ft_home: 2, ft_away: 1 }, null), 0, 'resmî sonuç yoksa puan YOK');
  assert.equal(gradeScorePred({ ft_home: 2, ft_away: 1 }, { result: '1', score: null }), 0, 'skorsuz kayıt puanlanmaz');
});

test('gradePollVote: MS/alt-üst/KG doğru; sürpriz anketi hiç puanlanmaz', () => {
  assert.equal(gradePollVote('ms', 'home', REAL), 2);
  assert.equal(gradePollVote('ms', 'away', REAL), 0);
  assert.equal(gradePollVote('over25', 'yes', REAL), 1);   // 3 gol > 2.5
  assert.equal(gradePollVote('btts', 'yes', REAL), 1);     // 2-1 → iki taraf da attı
  assert.equal(gradePollVote('surprise', 'yes', REAL), 0, 'sürpriz anketi değerlendirilmez');
});

test('settle: yalnız resmî sonuçlu maçlar puanlanır ve İKİNCİ çağrı hiçbir şeyi tekrarlamaz', async () => {
  const sb = freshSb();
  sb._rowsOf('score_predictions').push(
    { user_id: 'u1', match_id: 'm1', ft_home: 2, ft_away: 1 },  // tam skor → 25
    { user_id: 'u1', match_id: 'm2', ft_home: 1, ft_away: 0 },  // resmî sonuç YOK → 0
    { user_id: 'u2', match_id: 'm1', ft_home: 1, ft_away: 0 },  // doğru sonuç → 10
  );
  sb._rowsOf('community_poll_votes').push(
    { user_id: 'u2', match_id: 'm1', poll_key: 'ms', selected_option: 'home' }, // → 10
  );
  const matches = [
    { sportotoMatchId: 'm1', result: '1', score: { home: 2, away: 1 } },
    { sportotoMatchId: 'm2', result: null, score: null },  // henüz resmî değil
  ];
  const r1 = await settleRoundAccuracy(sb, { roundId: 1520, matches, force: true });
  assert.equal(r1.settled, 3, 'tam skor + doğru sonuç + anket = 3 ödül');
  // u1: 25 (tam skor) + 5 (haftaya katılım) = 30 · u2: 10 + 10 + 5 = 25
  assert.equal(await totalPoints(sb, 'u1'), 30);
  assert.equal(await totalPoints(sb, 'u2'), 25);

  const r2 = await settleRoundAccuracy(sb, { roundId: 1520, matches, force: true });
  assert.equal(r2.settled, 0, 'ikinci çağrı hiçbir ödülü TEKRARLAMAZ');
  assert.equal(await totalPoints(sb, 'u1'), 30, 'toplamlar değişmez');
  assert.equal(await totalPoints(sb, 'u2'), 25);
});

// ---------------------------------------------------------------------------
// Başarılar + görevler
// ---------------------------------------------------------------------------
const PROFILE = { avatar_type: 'preset', favorite_team: 'Takım' };

test('ilerleme: görev tamamlanınca ödül BİR KEZ verilir; başarı bir kez kazanılır', async () => {
  const sb = freshSb();
  sb._rowsOf('score_predictions').push({ user_id: 'u1', match_id: 'm1', ft_home: 1, ft_away: 0 });
  const p1 = await evaluateProgress(sb, { userId: 'u1', profile: PROFILE, couponCount: 1 });
  assert.ok(p1, 'ilerleme dönmeli');
  const done1 = p1.tasks.filter((t) => t.completedAt);
  // t_profile, t_first_lock, t_first_coupon tamam olmalı
  assert.ok(done1.some((t) => t.key === 't_profile'));
  assert.ok(done1.some((t) => t.key === 't_first_lock'));
  assert.ok(done1.some((t) => t.key === 't_first_coupon'));
  assert.ok(p1.achievements.find((a) => a.key === 'predictor')?.earned, 'ilk tahmin → Tahminci');
  const total1 = p1.points;
  assert.ok(total1 > 0);

  const p2 = await evaluateProgress(sb, { userId: 'u1', profile: PROFILE, couponCount: 1 });
  assert.equal(p2.points, total1, 'ikinci değerlendirme puanı DEĞİŞTİRMEZ (mükerrer ödül yok)');
});

test('ilerleme: kullanıcı yalnız kendi verisiyle değerlendirilir', async () => {
  const sb = freshSb();
  sb._rowsOf('score_predictions').push({ user_id: 'BAŞKASI', match_id: 'm1', ft_home: 1, ft_away: 0 });
  const p = await evaluateProgress(sb, { userId: 'u1', profile: { avatar_type: 'default', favorite_team: null }, couponCount: 0 });
  assert.equal(p.tasks.find((t) => t.key === 't_first_lock').progress, 0, 'başkasının tahmini sayılmaz');
  assert.equal(p.achievements.find((a) => a.key === 'predictor').earned, false);
});

test('ilerleme: migration 006 yoksa null döner (akış bozulmaz)', async () => {
  const sb = freshSb({ missing: ['points_history', 'user_achievements', 'user_tasks'] });
  sb._rowsOf('score_predictions'); // tablo var ama ilerleme tabloları yok
  const p = await evaluateProgress(sb, { userId: 'u1', profile: PROFILE, couponCount: 0 });
  assert.equal(p, null);
});

// ---------------------------------------------------------------------------
// Katalog bütünlüğü + hesap silme kapsamı
// ---------------------------------------------------------------------------
test('katalog: iddialı dil yok; puan kuralları pozitif tamsayı', () => {
  const YASAK = /kesin|garanti|banko|yanılmaz|net favori/i;
  for (const a of ACHIEVEMENTS) {
    assert.ok(!YASAK.test(a.title) && !YASAK.test(a.description), `${a.key} iddialı dil içeremez`);
  }
  for (const t of TASKS) {
    assert.ok(!YASAK.test(t.title) && !YASAK.test(t.description), `${t.key} iddialı dil içeremez`);
    assert.ok(t.target >= 1 && Number.isInteger(t.points) && t.points >= 0);
  }
  for (const [k, v] of Object.entries(POINT_RULES)) {
    assert.ok(Number.isInteger(v) && v > 0, `${k} pozitif tamsayı olmalı`);
  }
});

test('hesap silme: yeni tablolar listede, korunan tablolar listede DEĞİL', () => {
  const names = USER_OWNED_TABLES.map((t) => t.table);
  for (const t of ['sessions', 'devices', 'user_achievements', 'user_tasks', 'points_history', 'security_logs']) {
    assert.ok(names.includes(t), `${t} silme listesinde olmalı`);
  }
  for (const t of ['bulletins', 'bulletin_snapshots', 'match_official_results', 'achievements', 'tasks', 'radar_records']) {
    assert.ok(!names.includes(t), `${t} silme listesinde OLMAMALI (ortak/korunan veri)`);
  }
  assert.equal(names[names.length - 1], 'profiles', 'profiles en sonda silinir');
});
