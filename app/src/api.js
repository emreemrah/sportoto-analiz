import { API_BASE } from './config';
import { authHeaders as sessionHeaders, getRefreshToken, isCookieMode } from './session/tokenState';
import { tryRefresh } from './session/refreshClient';

function baseHeaders() {
  return { 'ngrok-skip-browser-warning': 'true', ...sessionHeaders() };
}

async function rawFetch(path, { method, body }) {
  const opts = { method, headers: { ...baseHeaders() } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(`${API_BASE}${path}`, opts);
}

async function req(path, { method = 'GET', body } = {}) {
  let res = await rawFetch(path, { method, body });

  // Belirteç süresi dolduysa: SESSİZCE yenile ve isteği BİR KEZ tekrarla.
  // Kullanıcıdan tekrar giriş istenmez ("beni hatırla" güvenli biçimde çalışır).
  if (res.status === 401 && !path.startsWith('/api/auth/') && (getRefreshToken() || isCookieMode())) {
    const renewed = await tryRefresh();
    if (renewed) res = await rawFetch(path, { method, body });
  }

  if (!res.ok) {
    let msg = `Sunucu hatası (${res.status})`;
    let data = null;
    try { data = await res.json(); msg = data.error || msg; } catch {}
    const err = new Error(msg);
    err.status = res.status;
    if (data?.needsVerification) err.needsVerification = true;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // bülten / analiz
  bulletin: () => req('/api/bulletin'),
  radar: () => req('/api/surprise-radar'),
  radarWeek: (roundId) => req(`/api/radar/${roundId}`),
  radarScorecard: () => req('/api/radar-scorecard'),
  match: (no) => req(`/api/match/${no}`),
  live: (no) => req(`/api/live/${no}`),
  health: () => req('/api/health'),
  rounds: () => req('/api/rounds'),
  history: (roundId, fresh = false) => req(`/api/history/${roundId}${fresh ? '?fresh=1' : ''}`),
  systemScorecard: () => req('/api/system-scorecard'),
  criteriaScorecard: () => req('/api/criteria-scorecard'),

  // doğrulanmış karneler (provenance + resmî ileri-test kuralı)
  scorecardsSystem: () => req('/api/scorecards/system'),
  scorecardsSystemWeeks: () => req('/api/scorecards/system/weeks'),
  scorecardsSystemErrors: () => req('/api/scorecards/system/errors'),
  scorecardsCoverage: () => req('/api/scorecards/coverage'),
  scorecardsRadar: () => req('/api/scorecards/radar'),
  scorecardsCriteria: () => req('/api/scorecards/criteria'),
  // Kalibrasyon: "kaç tuttu" değil, söylenen OLASILIĞIN kalitesi
  // (log-loss/Brier) + piyasaya ve lig taban oranına karşı beceri.
  scorecardsCalibration: () => req('/api/scorecards/calibration'),
  scorecardsRetrospective: () => req('/api/scorecards/retrospective'),
  scorecardsProvenance: () => req('/api/scorecards/provenance'),
  coverage: () => req('/api/coverage'),

  // radar merkezi (Radar 1-5 + Master Radar + Sürpriz DNA)
  radarCurrent: () => req('/api/radar/current'),
  radarWeeksList: () => req('/api/radar/weeks'),
  radarRound: (roundId) => req(`/api/radar/${roundId}`),
  radarMatch: (roundId, matchId) => req(`/api/radar/${roundId}/match/${matchId}`),
  radarCenterScorecard: () => req('/api/radar/scorecard'),
  radarMethodology: () => req('/api/radar/methodology'),
  radarDataQuality: () => req('/api/radar/data-quality'),
  radarPublicHistory: (roundId, matchId) => req(`/api/radar/public-percentage-history${roundId ? `?roundId=${roundId}${matchId ? `&matchId=${matchId}` : ''}` : ''}`),
  radarMarketHistory: (roundId, matchId) => req(`/api/radar/market-history${roundId ? `?roundId=${roundId}${matchId ? `&matchId=${matchId}` : ''}` : ''}`),
  radarDailyOdds: (roundId, matchId) => req(`/api/radar/daily-odds${roundId ? `?roundId=${roundId}${matchId ? `&matchId=${matchId}` : ''}` : ''}`),
  radarDailyPlayed: (roundId, matchId) => req(`/api/radar/daily-played${roundId ? `?roundId=${roundId}${matchId ? `&matchId=${matchId}` : ''}` : ''}`),
  // Oynanma DNA'sı: bu dağılıma benzer geçmiş kayıtlar hangi sonuçlarla bitmiş.
  // limit: null (tüm maçlar) | 5 | 10 | 15 — birim MAÇ, hafta değil.
  // tol: 0 (birebir aynı) | 1 | 2 | 3 — yakınlık; otomatik genişleme yok.
  radarPlayedDna: (roundId, no, source, day, limit, tol) => req(
    `/api/radar/played-dna?no=${encodeURIComponent(no)}&source=${encodeURIComponent(source)}`
    + `${roundId ? `&roundId=${encodeURIComponent(roundId)}` : ''}`
    + `${day ? `&day=${encodeURIComponent(day)}` : ''}`
    + `${limit ? `&limit=${encodeURIComponent(limit)}` : ''}`
    + `${tol != null ? `&tol=${encodeURIComponent(tol)}` : ''}`,
  ),
  // roundId = GÖRÜNTÜLENEN hafta. Her hafta yalnız kendisinden önce bilinen
  // resmî sonuçları görür; verilmezse güncel hafta varsayılır.
  radarPositionDna: (roundId) => req(
    `/api/radar/position-dna${roundId != null ? `?roundId=${encodeURIComponent(roundId)}` : ''}`,
  ),
  // Bir SIRANIN geçmiş maçları (Radar 5 satır açılımı) — "%54.5 hangi
  // maçlardan geliyor?". Ayrı uç: 15 sıranın listesini birden taşımak DNA
  // yanıtını 12 KB'dan 92 KB'a çıkarıyordu, oysa tek seferde tek sıra açılır.
  radarPositionMatches: (position, roundId) => req(
    `/api/radar/position-matches?position=${encodeURIComponent(position)}`
    + `${roundId != null ? `&roundId=${encodeURIComponent(roundId)}` : ''}`,
  ),
  radarHistoryArchive: () => req('/api/radar/history-archive'),

  // master analiz motoru (41 kriter kataloğu backend'de — tek doğruluk kaynağı)
  analysisCriteria: () => req('/api/analysis/criteria'),
  analysisCriterion: (key) => req(`/api/analysis/criteria/${encodeURIComponent(key)}`),
  analysisCriteriaScorecard: () => req('/api/analysis/criteria-scorecard'),
  analysisCriterionScorecard: (key) => req(`/api/analysis/criteria/${encodeURIComponent(key)}/scorecard`),
  analysisMethodology: () => req('/api/analysis/methodology'),
  analysisProfiles: () => req('/api/analysis/profiles'),
  analysisProfileCreate: (b) => req('/api/analysis/profiles', { method: 'POST', body: b }),
  analysisProfileUpdate: (id, b) => req(`/api/analysis/profiles/${id}`, { method: 'PUT', body: b }),
  analysisProfileDuplicate: (id, name) => req(`/api/analysis/profiles/${id}/duplicate`, { method: 'POST', body: { name } }),
  analysisProfileDelete: (id) => req(`/api/analysis/profiles/${id}`, { method: 'DELETE' }),
  analysisProfileSetDefault: (id) => req(`/api/analysis/profiles/${id}/set-default`, { method: 'POST' }),
  analysisCalcBulletin: (bulletinId, body) => req(`/api/analysis/bulletins/${bulletinId}/calculate`, { method: 'POST', body }),
  analysisCalcMatch: (matchId, body) => req(`/api/analysis/matches/${matchId}/calculate`, { method: 'POST', body }),
  analysisOfficial: (bulletinId) => req(`/api/analysis/bulletins/${bulletinId}/official`),
  analysisSaveUser: (bulletinId, body) => req(`/api/analysis/bulletins/${bulletinId}/save-user-analysis`, { method: 'POST', body }),
  analysisGetUser: (bulletinId) => req(`/api/analysis/bulletins/${bulletinId}/user`),
  analysisBacktest: (b) => req('/api/analysis/backtest', { method: 'POST', body: b }),
  analysisBacktestGet: (runId) => req(`/api/analysis/backtest/${runId}`),

  // bülten arşivi + değişmez snapshot motoru (kalıcı arşiv)
  archiveBulletins: () => req('/api/bulletins'),
  archiveBulletin: (id) => req(`/api/bulletins/${id}`),
  archiveSnapshot: (id) => req(`/api/bulletins/${id}/snapshot`),
  archiveResults: (id) => req(`/api/bulletins/${id}/results`),
  archiveEvaluation: (id) => req(`/api/bulletins/${id}/evaluation`),
  archiveAudit: (id) => req(`/api/bulletins/${id}/audit`),
  archiveObservations: (id, matchId) => req(`/api/bulletins/${id}/observations${matchId ? `?matchId=${encodeURIComponent(matchId)}` : ''}`),
  archivePositionStats: (params = {}) => {
    const q = Object.entries(params).filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return req(`/api/archive/position-stats${q ? `?${q}` : ''}`);
  },
  archiveGet: (path) => req(path),
  archivePost: (path, body) => req(path, { method: 'POST', body }),

  // üyelik + oturum güvenliği
  register: (b) => req('/api/auth/register', { method: 'POST', body: b }),
  login: (b) => req('/api/auth/login', { method: 'POST', body: b }),
  forgotPassword: (b) => req('/api/auth/forgot-password', { method: 'POST', body: b }),
  resendVerification: (b) => req('/api/auth/resend-verification', { method: 'POST', body: b }),
  serverLogout: () => req('/api/auth/logout', { method: 'POST', body: {} }),
  logoutAll: () => req('/api/auth/logout-all', { method: 'POST', body: {} }),
  sessions: () => req('/api/auth/sessions'),
  revokeSession: (id) => req(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  changePassword: (b) => req('/api/auth/change-password', { method: 'POST', body: b }),
  changeEmail: (b) => req('/api/auth/change-email', { method: 'POST', body: b }),
  securityEvents: () => req('/api/auth/security-events'),

  // kuponlar (hesaba bağlı kalıcı depo)
  getCoupons: () => req('/api/coupons'),
  putCoupons: (coupons) => req('/api/coupons', { method: 'PUT', body: { coupons } }),

  // profil + ilerleme (puan/seviye/başarı/görev — TÜMÜ sunucu doğrulamalı)
  me: () => req('/api/users/me'),
  progress: () => req('/api/users/me/progress'),
  updateProfile: (b) => req('/api/users/me', { method: 'PATCH', body: b }),
  uploadAvatar: (dataUrl) => req('/api/users/me/avatar', { method: 'POST', body: { dataUrl } }),

  // HESAP SİLME — gerçek ve kalıcı silme (pasife alma değildir).
  // Onay ifadesi + MEVCUT ŞİFRE olmadan sunucu işlemi reddeder.
  deleteAccount: (confirm, currentPassword) =>
    req('/api/auth/me', { method: 'DELETE', body: { confirm, currentPassword } }),

  // yorumlar
  comments: (matchId) => req(`/api/comments?matchId=${encodeURIComponent(matchId)}`),
  addComment: (b) => req('/api/comments', { method: 'POST', body: b }),
  editComment: (id, text) => req(`/api/comments/${id}`, { method: 'PATCH', body: { text } }),
  deleteComment: (id) => req(`/api/comments/${id}`, { method: 'DELETE' }),
  likeComment: (id) => req(`/api/comments/${id}/like`, { method: 'POST' }),
  unlikeComment: (id) => req(`/api/comments/${id}/like`, { method: 'DELETE' }),
  viewComment: (id) => req(`/api/comments/${id}/view`, { method: 'POST' }),

  // MODERASYON (E9) — bildirme yoruma, engelleme KİŞİYE bağlıdır.
  // Bildirme yanıtı sonucu AÇIKLAMAZ (kaç kişi bildirdi, yorum gizlendi mi):
  // yalnız { ok } ya da ikinci kez bildirilmişse { ok, already } döner.
  reportComment: (id, reason, note) =>
    req(`/api/comments/${id}/report`, { method: 'POST', body: { reason, note } }),
  blocks: () => req('/api/users/me/blocks'),
  blockUser: (userId) => req('/api/users/me/blocks', { method: 'POST', body: { userId } }),
  unblockUser: (userId) => req(`/api/users/me/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------
  // İNCELEME (yalnız operatör) — Topluluk Kuralları'ndaki inceleme sözünün
  // arkasındaki uçlar. Yetki `backend/.env` içindeki listeden gelir;
  // UYGULAMAYA HİÇBİR OPERATÖR KİMLİĞİ GÖMÜLMEZ. Uygulama yalnız
  // `moderationAccess()` cevabına bakar, kararı sunucu verir.
  //
  // `moderationAccess` normal kullanıcıya da 200 döner ({operator:false}):
  // 403 olsaydı her açılışta arayüzde gereksiz bir hata görünürdü.
  // Diğer uçlar operatör olmayan hesaba 403 verir — bu yüzden ekran girişi
  // access cevabına bağlıdır, kullanıcı reddedilecek bir yola hiç sokulmaz.
  //
  // GİZLİLİK: bu uçların hiçbiri bildiren kişinin kimliğini döndürmez.
  moderationAccess: () => req('/api/moderation/access'),
  moderationReports: (limit) => req(`/api/moderation/reports${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`),
  hideComment: (id) => req(`/api/moderation/comments/${encodeURIComponent(id)}/hide`, { method: 'POST' }),
  unhideComment: (id) => req(`/api/moderation/comments/${encodeURIComponent(id)}/unhide`, { method: 'POST' }),
  dismissReport: (id) => req(`/api/moderation/reports/${encodeURIComponent(id)}/dismiss`, { method: 'POST' }),

  // anketler / topluluk tahminleri
  getScore: (matchId) => req(`/api/predictions/score?matchId=${encodeURIComponent(matchId)}`),
  saveScore: (b) => req('/api/predictions/score', { method: 'POST', body: b }),
  getPlayerVote: (matchId) => req(`/api/predictions/player?matchId=${encodeURIComponent(matchId)}`),
  savePlayerVote: (b) => req('/api/predictions/player', { method: 'POST', body: b }),
  getLineup: (matchId) => req(`/api/predictions/lineup?matchId=${encodeURIComponent(matchId)}`),
  saveLineup: (b) => req('/api/predictions/lineup', { method: 'POST', body: b }),
  getPoll: (matchId) => req(`/api/predictions/poll?matchId=${encodeURIComponent(matchId)}`),
  savePoll: (b) => req('/api/predictions/poll', { method: 'POST', body: b }),
  community: (matchId) => req(`/api/predictions/community?matchId=${encodeURIComponent(matchId)}`),
  leaderboard: (roundId) => req(`/api/predictions/leaderboard${roundId ? `?roundId=${roundId}` : ''}`),
  msSummary: (matchIds) => req(`/api/predictions/ms-summary?matchIds=${matchIds.map(encodeURIComponent).join(',')}`),
};
