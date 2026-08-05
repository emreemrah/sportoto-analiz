// Anketler / topluluk tahminleri (analiz odaklı — bahis değil):
//  • Skor Tahmini   • Maçın Oyuncusu   • Kadro Tahmini   • Topluluk Anketi
// Hepsi maça (matchId) ve kullanıcıya bağlı; aynı kullanıcı aynı maçta günceller (upsert).
import { Router } from 'express';
import { safeError } from '../security/safeError.js';
import { sbAdmin, supabaseEnabled, getProfiles } from '../supabase.js';
import { uyelikKapisi } from '../security/supabaseGuard.js';
import { requireAuth, optionalAuth } from '../mw.js';
import { getBulletinByRoundId, getRoundsForNav } from '../sources/sportoto.js';
// OYUNLAŞTIRMA TAMAMEN KALDIRILDI (kullanıcı kararı, 2026-08-06): puan/rozet
// yazımı, seviye ve liderlik tablosu bu dosyadan söküldü. Tahmin kayıtları
// (skor/oyuncu/kadro/anket) aynen çalışır — yalnız puan üretmezler.
// SUNUCU TARAFI TAHMİN KİLİDİ — maç başladıktan sonra tahmin/puan girilemez.
import { tahminKapisiVeYanitla } from '../security/tahminKapisi.js';

const router = Router();
// /ms-summary muaf: bülten kartları için 15 maçta birden çağrılır ve kendi
// zarif boş yanıtını verir; kapalıyken hata değil boş özet dönmesi doğrudur.
router.use(uyelikKapisi(supabaseEnabled, ['/ms-summary']));
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
  if (!tahminKapisiVeYanitla(req, res, matchId)) return;
  const clamp = (n) => Math.max(0, Math.min(20, Number(n) || 0));
  const row = {
    match_id: String(matchId), user_id: req.user.id,
    fh_home: clamp(fhHome), fh_away: clamp(fhAway), ft_home: clamp(ftHome), ft_away: clamp(ftAway), updated_at: now(),
  };
  const { error } = await sbAdmin.from('score_predictions').upsert(row, { onConflict: 'match_id,user_id' });
  if (error) return safeError(res, error, 'Tahminler şu an okunamadı.');
  // Katılım puanı — maç başına BİR KEZ (unique kısıt mükerrer ödülü engeller).
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
  if (!tahminKapisiVeYanitla(req, res, matchId)) return;
  const row = {
    match_id: String(matchId), user_id: req.user.id,
    team_id: teamId ? String(teamId) : null, team_name: teamName || null,
    player_id: playerId ? String(playerId) : null, player_name: String(playerName), updated_at: now(),
  };
  const { error } = await sbAdmin.from('player_votes').upsert(row, { onConflict: 'match_id,user_id' });
  if (error) return safeError(res, error, 'Tahminler şu an okunamadı.');
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
  if (!tahminKapisiVeYanitla(req, res, matchId)) return;
  const players = Array.isArray(selectedPlayers) ? selectedPlayers.slice(0, 11) : [];
  const row = {
    match_id: String(matchId), user_id: req.user.id, team_id: teamId,
    team_name: teamName || null, formation: formation || null, selected_players: players, updated_at: now(),
  };
  const { error } = await sbAdmin.from('lineup_predictions').upsert(row, { onConflict: 'match_id,user_id,team_id' });
  if (error) return safeError(res, error, 'Tahminler şu an okunamadı.');
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
  if (!tahminKapisiVeYanitla(req, res, matchId)) return;
  const row = {
    match_id: String(matchId), user_id: req.user.id,
    poll_key: String(pollKey), selected_option: String(selectedOption), updated_at: now(),
  };
  const { error } = await sbAdmin.from('community_poll_votes').upsert(row, { onConflict: 'match_id,user_id,poll_key' });
  if (error) return safeError(res, error, 'Tahminler şu an okunamadı.');
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

// ---- Topluluk MS dağılımı (bülten kartları için TOPLU özet) ----
// Maç başına ayrı istek atılmaz; 15 maçlık bülten tek istekte gelir.
// Kişisel veri yoktur — yalnız anonim sayımlar döner.
router.get('/ms-summary', async (req, res) => {
  if (!sbAdmin) return res.json({ summary: {} });
  const ids = String(req.query.matchIds || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30);
  if (!ids.length) return res.json({ summary: {} });
  const { data, error } = await sbAdmin
    .from('community_poll_votes')
    .select('match_id,selected_option')
    .eq('poll_key', 'ms')
    .in('match_id', ids);
  if (error) return res.json({ summary: {} });
  const summary = {};
  (data || []).forEach((v) => {
    const s2 = summary[v.match_id] || (summary[v.match_id] = { total: 0, home: 0, draw: 0, away: 0 });
    s2.total += 1;
    if (s2[v.selected_option] != null) s2[v.selected_option] += 1;
  });
  res.json({ summary });
});

// ---- Puanlama / Lider Tablosu (hafta bazlı) ----
// (gradeScore/gradePoll ve /leaderboard rotası oyunlaştırmayla birlikte kaldırıldı.)

export default router;
