// Anketler / topluluk tahminleri (analiz odaklı — bahis değil):
//  • Skor Tahmini   • Maçın Oyuncusu   • Kadro Tahmini   • Topluluk Anketi
// Hepsi maça (matchId) ve kullanıcıya bağlı; aynı kullanıcı aynı maçta günceller (upsert).
import { Router } from 'express';
import { sbAdmin, getProfiles } from '../supabase.js';
import { requireAuth, optionalAuth } from '../mw.js';
import { getBulletinByRoundId, getRoundsForNav } from '../sources/sportoto.js';

const router = Router();
const now = () => new Date().toISOString();

// ---- Skor Tahmini ----
router.get('/score', requireAuth, async (req, res) => {
  const { data } = await sbAdmin.from('score_predictions')
    .select('*').eq('match_id', String(req.query.matchId || '')).eq('user_id', req.user.id).maybeSingle();
  res.json({ prediction: data || null });
});
router.post('/score', requireAuth, async (req, res) => {
  const { matchId, fhHome, fhAway, ftHome, ftAway } = req.body || {};
  if (!matchId) return res.status(400).json({ error: 'matchId gerekli.' });
  const clamp = (n) => Math.max(0, Math.min(20, Number(n) || 0));
  const row = {
    match_id: String(matchId), user_id: req.user.id,
    fh_home: clamp(fhHome), fh_away: clamp(fhAway), ft_home: clamp(ftHome), ft_away: clamp(ftAway), updated_at: now(),
  };
  const { error } = await sbAdmin.from('score_predictions').upsert(row, { onConflict: 'match_id,user_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---- Maçın Oyuncusu ----
router.get('/player', requireAuth, async (req, res) => {
  const { data } = await sbAdmin.from('player_votes')
    .select('*').eq('match_id', String(req.query.matchId || '')).eq('user_id', req.user.id).maybeSingle();
  res.json({ vote: data || null });
});
router.post('/player', requireAuth, async (req, res) => {
  const { matchId, teamId, teamName, playerId, playerName } = req.body || {};
  if (!matchId || !playerName) return res.status(400).json({ error: 'matchId ve oyuncu gerekli.' });
  const row = {
    match_id: String(matchId), user_id: req.user.id,
    team_id: teamId ? String(teamId) : null, team_name: teamName || null,
    player_id: playerId ? String(playerId) : null, player_name: String(playerName), updated_at: now(),
  };
  const { error } = await sbAdmin.from('player_votes').upsert(row, { onConflict: 'match_id,user_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---- Kadro Tahmini (takım bazlı: diziliş + saha üzerinde 11 oyuncu) ----
router.get('/lineup', requireAuth, async (req, res) => {
  const { data } = await sbAdmin.from('lineup_predictions')
    .select('*').eq('match_id', String(req.query.matchId || '')).eq('user_id', req.user.id);
  const out = { home: null, away: null };
  (data || []).forEach((r) => { if (r.team_id === 'home' || r.team_id === 'away') out[r.team_id] = r; });
  res.json(out);
});
router.post('/lineup', requireAuth, async (req, res) => {
  const { matchId, teamId, teamName, formation, selectedPlayers } = req.body || {};
  if (!matchId || (teamId !== 'home' && teamId !== 'away')) return res.status(400).json({ error: 'matchId ve teamId (home/away) gerekli.' });
  const players = Array.isArray(selectedPlayers) ? selectedPlayers.slice(0, 11) : [];
  const row = {
    match_id: String(matchId), user_id: req.user.id, team_id: teamId,
    team_name: teamName || null, formation: formation || null, selected_players: players, updated_at: now(),
  };
  const { error } = await sbAdmin.from('lineup_predictions').upsert(row, { onConflict: 'match_id,user_id,team_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---- Topluluk Anketi (yüzdeler + kullanıcının oyları) ----
router.get('/poll', optionalAuth, async (req, res) => {
  const matchId = String(req.query.matchId || '');
  if (!matchId) return res.status(400).json({ error: 'matchId gerekli.' });
  const { data: votes } = await sbAdmin.from('community_poll_votes').select('poll_key,selected_option,user_id').eq('match_id', matchId);
  const tally = {};        // pollKey -> { option: count }
  const mine = {};         // pollKey -> selectedOption (mevcut kullanıcı)
  (votes || []).forEach((v) => {
    tally[v.poll_key] = tally[v.poll_key] || {};
    tally[v.poll_key][v.selected_option] = (tally[v.poll_key][v.selected_option] || 0) + 1;
    if (req.user && v.user_id === req.user.id) mine[v.poll_key] = v.selected_option;
  });
  const results = {};
  for (const [k, opts] of Object.entries(tally)) {
    const total = Object.values(opts).reduce((a, b) => a + b, 0);
    results[k] = { total, options: opts };
  }
  res.json({ results, mine });
});
router.post('/poll', requireAuth, async (req, res) => {
  const { matchId, pollKey, selectedOption } = req.body || {};
  if (!matchId || !pollKey || !selectedOption) return res.status(400).json({ error: 'matchId, pollKey ve seçim gerekli.' });
  const row = {
    match_id: String(matchId), user_id: req.user.id,
    poll_key: String(pollKey), selected_option: String(selectedOption), updated_at: now(),
  };
  const { error } = await sbAdmin.from('community_poll_votes').upsert(row, { onConflict: 'match_id,user_id,poll_key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---- Topluluk Sonuçları (yüzde dağılımları) ----
router.get('/community', async (req, res) => {
  const matchId = String(req.query.matchId || '');
  if (!matchId) return res.status(400).json({ error: 'matchId gerekli.' });
  const [pv, lp, sp] = await Promise.all([
    sbAdmin.from('player_votes').select('player_name').eq('match_id', matchId),
    sbAdmin.from('lineup_predictions').select('formation').eq('match_id', matchId),
    sbAdmin.from('score_predictions').select('ft_home,ft_away').eq('match_id', matchId),
  ]);
  const tally = (rows, keyFn) => {
    const m = {}; let total = 0;
    (rows || []).forEach((r) => { const k = keyFn(r); if (k == null) return; m[k] = (m[k] || 0) + 1; total++; });
    const top = Object.entries(m).map(([k, c]) => ({ key: k, count: c, pct: total ? Math.round((c / total) * 100) : 0 })).sort((a, b) => b.count - a.count);
    return { total, top };
  };
  const players = tally(pv.data, (r) => r.player_name);
  const formations = tally(lp.data, (r) => r.formation);
  const scores = tally(sp.data, (r) => `${r.ft_home}-${r.ft_away}`);
  res.json({
    players: { total: players.total, top: players.top.slice(0, 5) },
    formations: { total: formations.total, top: formations.top.slice(0, 4) },
    scores: { total: scores.total, top: scores.top.slice(0, 5) },
  });
});

// ---- Puanlama / Lider Tablosu (hafta bazlı) ----
function gradeScore(pred, real) {
  if (!real || !real.score) return 0;
  if (pred.ft_home === real.score.home && pred.ft_away === real.score.away) return 5; // tam skor
  const outcome = pred.ft_home > pred.ft_away ? '1' : pred.ft_home < pred.ft_away ? '2' : 'X';
  return real.result && outcome === real.result ? 2 : 0; // doğru sonuç
}
function gradePoll(pollKey, opt, real) {
  if (!real || !real.score) return 0;
  const total = real.score.home + real.score.away;
  if (pollKey === 'ms') return real.result && ((opt === 'home' && real.result === '1') || (opt === 'draw' && real.result === 'X') || (opt === 'away' && real.result === '2')) ? 2 : 0;
  if (pollKey === 'over25') return ((total > 2.5) ? 'yes' : 'no') === opt ? 1 : 0;
  if (pollKey === 'btts') return ((real.score.home > 0 && real.score.away > 0) ? 'yes' : 'no') === opt ? 1 : 0;
  return 0; // surprise: değerlendirilmez
}

router.get('/leaderboard', optionalAuth, async (req, res) => {
  let roundId = Number(req.query.roundId) || null;
  if (!roundId) { try { roundId = (await getRoundsForNav()).currentRoundId; } catch {} }
  if (!roundId) return res.json({ roundId: null, leaderboard: [], me: null });

  let matches = [];
  try { matches = (await getBulletinByRoundId(roundId)).matches || []; } catch {}
  const resultMap = {};
  matches.forEach((m) => { if (m.sportotoMatchId && m.result && m.score) resultMap[m.sportotoMatchId] = { result: m.result, score: m.score }; });
  const ids = Object.keys(resultMap);
  if (!ids.length) return res.json({ roundId, leaderboard: [], me: null, note: 'Bu hafta için sonuç henüz açıklanmadı.' });

  const [sp, pv] = await Promise.all([
    sbAdmin.from('score_predictions').select('user_id,ft_home,ft_away,match_id').in('match_id', ids),
    sbAdmin.from('community_poll_votes').select('user_id,poll_key,selected_option,match_id').in('match_id', ids),
  ]);
  const pts = {}, correct = {}, made = {};
  const add = (uid, p) => { pts[uid] = (pts[uid] || 0) + p; made[uid] = (made[uid] || 0) + 1; if (p > 0) correct[uid] = (correct[uid] || 0) + 1; };
  (sp.data || []).forEach((r) => add(r.user_id, gradeScore(r, resultMap[r.match_id])));
  (pv.data || []).forEach((r) => add(r.user_id, gradePoll(r.poll_key, r.selected_option, resultMap[r.match_id])));

  const uids = Object.keys(pts);
  const profiles = await getProfiles(uids);
  const board = uids.map((uid) => ({
    userId: uid, username: profiles[uid]?.username || 'Kullanıcı', points: pts[uid],
    correct: correct[uid] || 0, made: made[uid] || 0, accuracy: made[uid] ? Math.round(((correct[uid] || 0) / made[uid]) * 100) : 0,
  })).sort((a, b) => b.points - a.points || b.accuracy - a.accuracy).slice(0, 50);
  board.forEach((b, i) => { b.rank = i + 1; });
  const me = req.user ? (board.find((b) => b.userId === req.user.id) || null) : null;
  res.json({ roundId, leaderboard: board, me });
});

export default router;
