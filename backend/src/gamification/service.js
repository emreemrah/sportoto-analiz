// PUAN / BAŞARI / GÖREV MOTORU — TÜM DOĞRULAMA SUNUCUDA.
//
// GÜVENLİK MODELİ
//   • İstemci hiçbir zaman "bana şu puanı yaz" diyemez; puan yalnız bu modülün
//     içinden, SUNUCUNUN gördüğü gerçek eylem/veri üzerinden yazılır.
//   • Mükerrer ödül veritabanı KISITI ile engellenir: points_history üzerinde
//     unique(user_id, kind, ref_id). Aynı eylem ikinci kez puan YAZAMAZ —
//     kod hata yapsa bile veritabanı reddeder.
//   • İsabet puanları YALNIZ resmî Spor Toto sonucu açıklanmış maçlardan
//     hesaplanır (settleRoundAccuracy). Canlı/geçici skor asla puanlanmaz.
//   • Kullanıcı yalnız KENDİ ilerlemesini görebilir; başkasınınkini değiştirmek
//     için hiçbir uç yoktur.
//
// GÜVENLİ DÜŞÜŞ: migration 006 uygulanmadıysa modül kendini kapatır; mevcut
// uygulama akışları (tahmin, kupon, yorum) etkilenmez.

import { ACHIEVEMENTS, TASKS, POINT_RULES, levelFromPoints } from './catalog.js';

let tablesAvailable = null;
let lastMissingAt = 0;
let catalogSynced = false;
// "Tablo yok" durumu KALICI ezberlenmez: migration sonradan uygulanırsa backend
// yeniden başlatılmadan, en geç bu süre içinde kendiliğinden toparlar.
const MISSING_RETRY_MS = 10 * 60 * 1000;
function missingTable(error) { return /does not exist|42P01/i.test(error?.message || ''); }
function markMissing() { tablesAvailable = false; lastMissingAt = Date.now(); }
function unavailable() {
  if (tablesAvailable !== false) return false;
  if (Date.now() - lastMissingAt > MISSING_RETRY_MS) { tablesAvailable = null; return false; }
  return true;
}
export function gamificationEnabled() { return tablesAvailable !== false; }
export function _resetAvailability() { tablesAvailable = null; lastMissingAt = 0; catalogSynced = false; }

// ---------------------------------------------------------------------------
// Katalog eşitleme (server açılışında; idempotent)
// ---------------------------------------------------------------------------
export async function syncCatalog(sbAdmin) {
  if (!sbAdmin) return false;
  try {
    const a = await sbAdmin.from('achievements').upsert(
      ACHIEVEMENTS.map(({ key, title, description, icon, points, sort }) => ({ key, title, description, icon, points, sort })),
      { onConflict: 'key' },
    );
    if (a.error) throw a.error;
    const t = await sbAdmin.from('tasks').upsert(
      TASKS.map(({ key, title, description, icon, target, points, sort }) => ({ key, title, description, icon, target, points, sort })),
      { onConflict: 'key' },
    );
    if (t.error) throw t.error;
    tablesAvailable = true;
    catalogSynced = true;
    return true;
  } catch (e) {
    if (missingTable(e)) {
      markMissing();
      console.warn('[ilerleme] achievements/tasks tabloları yok — migration 006 uygulanınca sistem açılacak.');
      return false;
    }
    console.warn('[ilerleme] katalog eşitlenemedi:', e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Puan yazma — mükerrer ödül İMKÂNSIZ (unique kısıt + onConflict ignore)
// ---------------------------------------------------------------------------
export async function award(sbAdmin, { userId, kind, refId = '', points, meta = null }) {
  if (!sbAdmin || unavailable() || !userId || !kind) return false;
  const p = Math.floor(Number(points) || 0);
  if (!p) return false;
  try {
    const { data, error } = await sbAdmin
      .from('points_history')
      .upsert(
        { user_id: userId, kind: String(kind), ref_id: String(refId), points: p, meta },
        { onConflict: 'user_id,kind,ref_id', ignoreDuplicates: true },
      )
      .select('id');
    if (error) throw error;
    tablesAvailable = true;
    return (data || []).length > 0; // false = zaten verilmişti (mükerrer engellendi)
  } catch (e) {
    if (missingTable(e)) { markMissing(); return false; }
    console.warn('[ilerleme] puan yazılamadı:', e.message);
    return false;
  }
}

/** Toplam puan = defterin toplamı (tek doğruluk kaynağı). */
export async function totalPoints(sbAdmin, userId) {
  if (!sbAdmin || unavailable()) return 0;
  try {
    const { data, error } = await sbAdmin
      .from('points_history').select('points').eq('user_id', userId);
    if (error) throw error;
    tablesAvailable = true;
    return (data || []).reduce((a, r) => a + (r.points || 0), 0);
  } catch (e) {
    if (missingTable(e)) markMissing();
    return 0;
  }
}

// Eylem kancaları — mevcut rotalardan "ateşle ve unut" çağrılır; yanıtı BLOKLAMAZ.
export function awardParticipation(sbAdmin, userId, action, refId) {
  const points = POINT_RULES[action];
  if (!points) return;
  award(sbAdmin, { userId, kind: action, refId, points }).catch(() => {});
}

// ---------------------------------------------------------------------------
// İSABET PUANLARI — yalnız RESMÎ sonuçla (hafta mühürlenince), idempotent.
// ---------------------------------------------------------------------------
// Lider tablosuyla AYNI değerlendirme: gradeScore/gradePoll (predictions.js ile
// tutarlı kopya — oradaki fonksiyonlar dışa açık değil; kurallar birebir aynı).
export function gradeScorePred(pred, real) {
  if (!real || !real.score) return 0;
  if (pred.ft_home === real.score.home && pred.ft_away === real.score.away) return 5;
  const outcome = pred.ft_home > pred.ft_away ? '1' : pred.ft_home < pred.ft_away ? '2' : 'X';
  return real.result && outcome === real.result ? 2 : 0;
}
export function gradePollVote(pollKey, opt, real) {
  if (!real || !real.score) return 0;
  const total = real.score.home + real.score.away;
  if (pollKey === 'ms') return real.result && ((opt === 'home' && real.result === '1') || (opt === 'draw' && real.result === 'X') || (opt === 'away' && real.result === '2')) ? 2 : 0;
  if (pollKey === 'over25') return ((total > 2.5) ? 'yes' : 'no') === opt ? 1 : 0;
  if (pollKey === 'btts') return ((real.score.home > 0 && real.score.away > 0) ? 'yes' : 'no') === opt ? 1 : 0;
  return 0;
}

// Aynı hafta 10 dakikada bir kereden fazla taranmasın (gereksiz yük olmasın).
const settleThrottle = new Map(); // roundId -> timestamp
export function _clearSettleThrottle() { settleThrottle.clear(); }

/**
 * Bir haftanın RESMÎ sonuçları üzerinden isabet + katılım puanlarını yazar.
 * Tamamen idempotent: unique kısıt sayesinde ikinci çağrı hiçbir şeyi iki kez
 * ödüllendiremez. Resmî sonucu olmayan maç PUANLANMAZ.
 */
export async function settleRoundAccuracy(sbAdmin, { roundId, matches, force = false }) {
  if (!sbAdmin || unavailable() || !roundId || !Array.isArray(matches)) return { settled: 0 };
  const last = settleThrottle.get(roundId) || 0;
  if (!force && Date.now() - last < 10 * 60 * 1000) return { settled: 0, throttled: true };
  settleThrottle.set(roundId, Date.now());

  // YALNIZ resmî sonucu VE skoru olan maçlar (kesin olmayan hiçbir şey puanlanmaz).
  const resultMap = {};
  matches.forEach((m) => {
    if (m.sportotoMatchId && m.result && m.score) resultMap[m.sportotoMatchId] = { result: m.result, score: m.score };
  });
  const ids = Object.keys(resultMap);
  if (!ids.length) return { settled: 0 };

  try {
    const [sp, pv] = await Promise.all([
      sbAdmin.from('score_predictions').select('user_id,ft_home,ft_away,match_id').in('match_id', ids),
      sbAdmin.from('community_poll_votes').select('user_id,poll_key,selected_option,match_id').in('match_id', ids),
    ]);
    if (sp.error) throw sp.error;
    let settled = 0;
    const participants = new Set();

    for (const r of sp.data || []) {
      participants.add(r.user_id);
      const grade = gradeScorePred(r, resultMap[r.match_id]);
      if (grade > 0) {
        const ok = await award(sbAdmin, {
          userId: r.user_id, kind: 'acc_score', refId: `${roundId}:${r.match_id}`,
          points: grade * POINT_RULES.ACC_MULTIPLIER, meta: { exact: grade === 5 },
        });
        if (ok) settled += 1;
      }
    }
    for (const r of pv.data || []) {
      participants.add(r.user_id);
      const grade = gradePollVote(r.poll_key, r.selected_option, resultMap[r.match_id]);
      if (grade > 0) {
        const ok = await award(sbAdmin, {
          userId: r.user_id, kind: 'acc_poll', refId: `${roundId}:${r.match_id}:${r.poll_key}`,
          points: grade * POINT_RULES.ACC_MULTIPLIER,
        });
        if (ok) settled += 1;
      }
    }
    // Haftaya katılım puanı (tahmini olan herkese, haftada bir kez).
    for (const uid of participants) {
      await award(sbAdmin, { userId: uid, kind: 'round_part', refId: String(roundId), points: POINT_RULES.round_part });
    }
    return { settled, participants: participants.size };
  } catch (e) {
    if (missingTable(e)) { markMissing(); return { settled: 0 }; }
    console.warn('[ilerleme] hafta puanlanamadı:', e.message);
    return { settled: 0, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// BAŞARI + GÖREV DEĞERLENDİRME — gerçek verideki sayımlardan, sunucuda.
// ---------------------------------------------------------------------------
async function countRows(sbAdmin, table, filters) {
  let q = sbAdmin.from(table).select('*', { count: 'exact', head: true });
  for (const [col, val] of filters) q = q.eq(col, val);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

/** Kullanıcının gerçek sayımlarını toplar (başarı/görev koşulları için). */
export async function collectStats(sbAdmin, userId, { couponCount = 0 } = {}) {
  const [comments, scoreLocks, lineups, polls] = await Promise.all([
    countRows(sbAdmin, 'comments', [['user_id', userId]]),
    countRows(sbAdmin, 'score_predictions', [['user_id', userId]]),
    countRows(sbAdmin, 'lineup_predictions', [['user_id', userId]]),
    countRows(sbAdmin, 'community_poll_votes', [['user_id', userId]]),
  ]);
  // Beğeniler: kullanıcının yorumlarının aldığı beğeni sayısı.
  let likes = 0;
  const { data: myComments } = await sbAdmin.from('comments').select('id').eq('user_id', userId);
  if (myComments?.length) {
    const { count } = await sbAdmin.from('comment_likes')
      .select('comment_id', { count: 'exact', head: true })
      .in('comment_id', myComments.map((c) => c.id));
    likes = count || 0;
  }
  // Puan defterinden türeyen sayımlar (isabetler, katılınan haftalar).
  const { data: ledger } = await sbAdmin.from('points_history')
    .select('kind,ref_id,points,meta').eq('user_id', userId);
  const rows = ledger || [];
  const exactHits = rows.filter((r) => r.kind === 'acc_score' && r.meta?.exact).length;
  const accHits = rows.filter((r) => r.kind === 'acc_score' || r.kind === 'acc_poll').length;
  const roundsParticipated = new Set(rows.filter((r) => r.kind === 'round_part').map((r) => r.ref_id)).size;
  return { comments, scoreLocks, lineups, polls, likes, exactHits, accHits, roundsParticipated, couponCount };
}

/** Başarı koşulları — anahtar → (stats, profil, seviye) ⇒ hak edildi mi? */
export const ACHIEVEMENT_CONDITIONS = {
  first_comment: (s) => s.comments >= 1,
  commenter:     (s) => s.comments >= 10,
  predictor:     (s) => s.scoreLocks + s.polls + s.lineups >= 1,
  analyst:       (s) => s.scoreLocks + s.polls + s.lineups >= 10,
  tactician:     (s) => s.lineups >= 1,
  loved:         (s) => s.likes >= 10,
  sharp_eye:     (s) => s.exactHits >= 1,
  on_target:     (s) => s.accHits >= 5,
  veteran:       (s) => s.roundsParticipated >= 10,
  level_5:       (s, profile, level) => level >= 5,
  level_10:      (s, profile, level) => level >= 10,
};

/** Görev ilerlemesi — anahtar → stats/profil ⇒ sayı. */
export const TASK_PROGRESS = {
  t_profile:      (s, profile) => (profile && (profile.avatar_type !== 'default' || profile.favorite_team) ? 1 : 0),
  t_first_lock:   (s) => Math.min(1, s.scoreLocks),
  t_five_locks:   (s) => Math.min(5, s.scoreLocks),
  t_first_coupon: (s) => Math.min(1, s.couponCount),
  t_poll:         (s) => Math.min(1, s.polls),
  t_comment:      (s) => Math.min(1, s.comments),
  t_rounds_3:     (s) => Math.min(3, s.roundsParticipated),
};

/**
 * Başarıları ve görevleri değerlendirir; yeni hak edilenleri BİR KEZ yazar ve
 * puanlarını ekler. Tamamen idempotent (PK + unique kısıtlar).
 */
export async function evaluateProgress(sbAdmin, { userId, profile, couponCount = 0 }) {
  if (!sbAdmin || unavailable() || !userId) return null;
  try {
    // Katalog henüz eşitlenmediyse (ör. backend migration'dan ÖNCE açıldıysa)
    // burada tembelce eşitlenir — yeniden başlatma GEREKMEZ.
    if (!catalogSynced) {
      const ok = await syncCatalog(sbAdmin);
      if (!ok) return null;
    }
    const stats = await collectStats(sbAdmin, userId, { couponCount });
    let total = await totalPoints(sbAdmin, userId);
    const { level } = levelFromPoints(total);

    // Başarılar
    const { data: earnedRows, error: ee } = await sbAdmin
      .from('user_achievements').select('achievement_key,earned_at').eq('user_id', userId);
    if (ee) throw ee;
    const earned = new Set((earnedRows || []).map((r) => r.achievement_key));
    for (const a of ACHIEVEMENTS) {
      if (earned.has(a.key)) continue;
      const cond = ACHIEVEMENT_CONDITIONS[a.key];
      if (!cond || !cond(stats, profile, level)) continue;
      const { data: ins, error: ie } = await sbAdmin
        .from('user_achievements')
        .upsert({ user_id: userId, achievement_key: a.key }, { onConflict: 'user_id,achievement_key', ignoreDuplicates: true })
        .select('achievement_key');
      if (ie) throw ie;
      if ((ins || []).length && a.points) {
        await award(sbAdmin, { userId, kind: 'achievement', refId: a.key, points: a.points });
        total += a.points;
      }
      earned.add(a.key);
    }

    // Görevler
    const { data: taskRows, error: te } = await sbAdmin
      .from('user_tasks').select('task_key,progress,completed_at').eq('user_id', userId);
    if (te) throw te;
    const byKey = new Map((taskRows || []).map((r) => [r.task_key, r]));
    const tasksOut = [];
    for (const t of TASKS) {
      const calc = TASK_PROGRESS[t.key];
      const progress = calc ? calc(stats, profile) : 0;
      const existing = byKey.get(t.key);
      const done = progress >= t.target;
      let completedAt = existing?.completed_at || null;
      if (!existing || existing.progress !== progress || (done && !completedAt)) {
        if (done && !completedAt) completedAt = new Date().toISOString();
        const { error: ue } = await sbAdmin.from('user_tasks').upsert(
          { user_id: userId, task_key: t.key, progress, completed_at: completedAt, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,task_key' },
        );
        if (ue) throw ue;
        // Görev ödülü BİR KEZ: points_history unique kısıtı ikinci yazımı engeller.
        if (done && t.points) {
          const ok = await award(sbAdmin, { userId, kind: 'task', refId: t.key, points: t.points });
          if (ok) total += t.points;
        }
      }
      tasksOut.push({ ...t, progress, completedAt: completedAt || null });
    }

    const levelInfo = levelFromPoints(total);
    return {
      points: total,
      level: levelInfo,
      stats,
      achievements: ACHIEVEMENTS.map((a) => ({
        ...a,
        earned: earned.has(a.key),
        earnedAt: (earnedRows || []).find((r) => r.achievement_key === a.key)?.earned_at || null,
      })),
      tasks: tasksOut,
    };
  } catch (e) {
    if (missingTable(e)) { markMissing(); return null; }
    console.warn('[ilerleme] değerlendirilemedi:', e.message);
    return null;
  }
}
