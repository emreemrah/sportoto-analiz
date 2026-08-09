// KAYNAK: app/src/api.js — BİREBİR çeviri.
//
// Backend istemcisi. Uçların adı, yolu, HTTP yöntemi ve gövdesi kaynaktakiyle
// AYNIDIR; sunucu sözleşmesi değişmediği için burada tek harf oynanmadı.
// Kaynaktaki açıklama notları da taşındı — çoğu "neden böyle" yazıyor ve
// çeviride kaybolursa bir sonraki geliştirici aynı hatayı tekrar yapar.

import 'package:dio/dio.dart';

import '../session/refresh_client.dart';
import '../session/session_state.dart';
import 'api_config.dart';

/// Kaynakta `throw new Error(msg)` + `err.status` + `err.needsVerification`.
class ApiException implements Exception {
  const ApiException(
    this.message, {
    this.status,
    this.needsVerification = false,
  });

  final String message;
  final int? status;
  final bool needsVerification;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              validateStatus: (_) => true,
              responseType: ResponseType.json,
              connectTimeout: const Duration(seconds: 20),
              receiveTimeout: const Duration(seconds: 30),
            ),
          );

  final Dio _dio;

  Map<String, String> _baseHeaders() => {
    'ngrok-skip-browser-warning': 'true',
    ...authHeaders(),
  };

  Future<Response<dynamic>> _rawFetch(
    String path, {
    required String method,
    Object? body,
    bool hasBody = false,
  }) {
    final headers = _baseHeaders();
    if (hasBody) headers['Content-Type'] = 'application/json';
    return _dio.request<dynamic>(
      '$apiBase$path',
      data: hasBody ? body : null,
      options: Options(method: method, headers: headers),
    );
  }

  /// Kaynaktaki `req(path, { method, body })`.
  Future<dynamic> req(
    String path, {
    String method = 'GET',
    Object? body,
    bool hasBody = false,
  }) async {
    var res = await _rawFetch(
      path,
      method: method,
      body: body,
      hasBody: hasBody,
    );

    // Belirteç süresi dolduysa: SESSİZCE yenile ve isteği BİR KEZ tekrarla.
    // Kullanıcıdan tekrar giriş istenmez ("beni hatırla" güvenli biçimde çalışır).
    if (res.statusCode == 401 &&
        !path.startsWith('/api/auth/') &&
        (getRefreshToken() != null || isCookieMode())) {
      final renewed = await tryRefresh();
      if (renewed) {
        res = await _rawFetch(
          path,
          method: method,
          body: body,
          hasBody: hasBody,
        );
      }
    }

    final status = res.statusCode ?? 0;
    if (status < 200 || status >= 300) {
      var msg = 'Sunucu hatası ($status)';
      var needsVerification = false;
      final data = res.data;
      if (data is Map) {
        final err = data['error'];
        if (err is String && err.isNotEmpty) msg = err;
        if (data['needsVerification'] == true) needsVerification = true;
      }
      throw ApiException(
        msg,
        status: status,
        needsVerification: needsVerification,
      );
    }
    if (status == 204) return null;
    return res.data;
  }

  Future<dynamic> _post(String path, [Object? body]) =>
      req(path, method: 'POST', body: body, hasBody: true);
  Future<dynamic> _put(String path, Object? body) =>
      req(path, method: 'PUT', body: body, hasBody: true);
  Future<dynamic> _patch(String path, Object? body) =>
      req(path, method: 'PATCH', body: body, hasBody: true);
  Future<dynamic> _delete(String path, [Object? body]) =>
      req(path, method: 'DELETE', body: body, hasBody: body != null);

  static String _enc(Object v) => Uri.encodeComponent('$v');

  // ── bülten / analiz ────────────────────────────────────────────────────
  Future<dynamic> bulletin() => req('/api/bulletin');
  Future<dynamic> radar() => req('/api/surprise-radar');
  Future<dynamic> radarWeek(Object roundId) => req('/api/radar/$roundId');
  Future<dynamic> radarScorecard() => req('/api/radar-scorecard');
  Future<dynamic> match(Object no) => req('/api/match/$no');
  Future<dynamic> live(Object no) => req('/api/live/$no');
  Future<dynamic> health() => req('/api/health');
  Future<dynamic> rounds() => req('/api/rounds');

  /// Takımın sezondaki oynanmış + oynanacak maçları (maç detayı → takım kartı).
  Future<dynamic> teamFixtures(Object teamId, Object seasonId) =>
      req('/api/team-fixtures/$teamId?seasonId=$seasonId');

  Future<dynamic> history(Object roundId, {bool fresh = false}) =>
      req('/api/history/$roundId${fresh ? '?fresh=1' : ''}');
  Future<dynamic> systemScorecard() => req('/api/system-scorecard');
  Future<dynamic> criteriaScorecard() => req('/api/criteria-scorecard');

  // ── doğrulanmış karneler (provenance + resmî ileri-test kuralı) ────────
  Future<dynamic> scorecardsSystem() => req('/api/scorecards/system');
  Future<dynamic> scorecardsSystemWeeks() =>
      req('/api/scorecards/system/weeks');
  Future<dynamic> scorecardsSystemErrors() =>
      req('/api/scorecards/system/errors');
  Future<dynamic> scorecardsCoverage() => req('/api/scorecards/coverage');
  Future<dynamic> scorecardsRadar() => req('/api/scorecards/radar');
  Future<dynamic> scorecardsCriteria() => req('/api/scorecards/criteria');

  /// Kalibrasyon: "kaç tuttu" değil, söylenen OLASILIĞIN kalitesi
  /// (log-loss/Brier) + piyasaya ve lig taban oranına karşı beceri.
  Future<dynamic> scorecardsCalibration() => req('/api/scorecards/calibration');
  Future<dynamic> scorecardsRetrospective() =>
      req('/api/scorecards/retrospective');
  Future<dynamic> scorecardsProvenance() => req('/api/scorecards/provenance');
  Future<dynamic> coverage() => req('/api/coverage');

  // ── radar merkezi (Radar 1-5 + Master Radar + Sürpriz DNA) ─────────────
  Future<dynamic> radarCurrent() => req('/api/radar/current');
  Future<dynamic> radarWeeksList() => req('/api/radar/weeks');
  Future<dynamic> radarRound(Object roundId) => req('/api/radar/$roundId');
  Future<dynamic> radarMatch(Object roundId, Object matchId) =>
      req('/api/radar/$roundId/match/$matchId');
  Future<dynamic> radarCenterScorecard() => req('/api/radar/scorecard');
  Future<dynamic> radarMethodology() => req('/api/radar/methodology');
  Future<dynamic> radarDataQuality() => req('/api/radar/data-quality');

  Future<dynamic> radarPublicHistory([Object? roundId, Object? matchId]) => req(
    '/api/radar/public-percentage-history'
    '${roundId != null ? '?roundId=$roundId${matchId != null ? '&matchId=$matchId' : ''}' : ''}',
  );
  Future<dynamic> radarMarketHistory([Object? roundId, Object? matchId]) => req(
    '/api/radar/market-history'
    '${roundId != null ? '?roundId=$roundId${matchId != null ? '&matchId=$matchId' : ''}' : ''}',
  );
  Future<dynamic> radarDailyOdds([Object? roundId, Object? matchId]) => req(
    '/api/radar/daily-odds'
    '${roundId != null ? '?roundId=$roundId${matchId != null ? '&matchId=$matchId' : ''}' : ''}',
  );
  Future<dynamic> radarDailyPlayed([Object? roundId, Object? matchId]) => req(
    '/api/radar/daily-played'
    '${roundId != null ? '?roundId=$roundId${matchId != null ? '&matchId=$matchId' : ''}' : ''}',
  );

  /// Oynanma DNA'sı: bu dağılıma benzer geçmiş kayıtlar hangi sonuçlarla bitmiş.
  /// limit: null (tüm maçlar) | 5 | 10 | 15 — birim MAÇ, hafta değil.
  /// tol: 0 (birebir aynı) | 1 | 2 | 3 — yakınlık; otomatik genişleme yok.
  Future<dynamic> radarPlayedDna({
    Object? roundId,
    required Object no,
    required Object source,
    Object? day,
    Object? limit,
    Object? tol,
  }) => req(
    '/api/radar/played-dna?no=${_enc(no)}&source=${_enc(source)}'
    '${roundId != null ? '&roundId=${_enc(roundId)}' : ''}'
    '${day != null ? '&day=${_enc(day)}' : ''}'
    '${limit != null ? '&limit=${_enc(limit)}' : ''}'
    '${tol != null ? '&tol=${_enc(tol)}' : ''}',
  );

  /// roundId = GÖRÜNTÜLENEN hafta. Her hafta yalnız kendisinden önce bilinen
  /// resmî sonuçları görür; verilmezse güncel hafta varsayılır.
  Future<dynamic> radarPositionDna([Object? roundId]) => req(
    '/api/radar/position-dna${roundId != null ? '?roundId=${_enc(roundId)}' : ''}',
  );

  /// Bir SIRANIN geçmiş maçları (Radar 5 satır açılımı) — "%54.5 hangi
  /// maçlardan geliyor?". Ayrı uç: 15 sıranın listesini birden taşımak DNA
  /// yanıtını 12 KB'dan 92 KB'a çıkarıyordu, oysa tek seferde tek sıra açılır.
  Future<dynamic> radarPositionMatches(Object position, [Object? roundId]) =>
      req(
        '/api/radar/position-matches?position=${_enc(position)}'
        '${roundId != null ? '&roundId=${_enc(roundId)}' : ''}',
      );

  Future<dynamic> radarHistoryArchive() => req('/api/radar/history-archive');

  // ── master analiz motoru (41 kriter kataloğu backend'de) ───────────────
  Future<dynamic> analysisCriteria() => req('/api/analysis/criteria');
  Future<dynamic> analysisCriterion(Object key) =>
      req('/api/analysis/criteria/${_enc(key)}');
  Future<dynamic> analysisCriteriaScorecard() =>
      req('/api/analysis/criteria-scorecard');
  Future<dynamic> analysisCriterionScorecard(Object key) =>
      req('/api/analysis/criteria/${_enc(key)}/scorecard');

  /// KRİTER KIRILIMI: "bu kriter NEREDE başarılı" — maç tipi, kalabalık
  /// profili, söylediği yön, sıra ve kalabalık/piyasa favorisiyle uyum.
  /// Ortalama tek başına yanıltıcı olduğu için var.
  Future<dynamic> analysisCriterionKirilim(Object key) =>
      req('/api/analysis/criteria/${_enc(key)}/kirilim');

  Future<dynamic> analysisMethodology() => req('/api/analysis/methodology');
  Future<dynamic> analysisCalcBulletin(Object bulletinId, Object? body) =>
      _post('/api/analysis/bulletins/$bulletinId/calculate', body);
  Future<dynamic> analysisCalcMatch(Object matchId, Object? body) =>
      _post('/api/analysis/matches/$matchId/calculate', body);
  Future<dynamic> analysisOfficial(Object bulletinId) =>
      req('/api/analysis/bulletins/$bulletinId/official');

  /// GEÇMİŞ (MÜHÜRLÜ) MAÇIN ANALİZİ — arşivdeki mühürlü kayıttan okunur.
  /// Backend `sealedOrLive` ile önce mühürlü snapshot'a bakar; o yüzden geçmiş
  /// hafta için bugünkü motor/veriyle YENİDEN HESAP YAPILMAZ, maç öncesi
  /// dondurulmuş değerlendirme döner. Mühür yoksa 404 gelir ve ekran bunu
  /// dürüstçe yazar — uydurma analiz üretilmez.
  Future<dynamic> analysisSealedMatch(Object bulletinId, Object no) =>
      req('/api/analysis/bulletins/$bulletinId/matches/$no');

  Future<dynamic> analysisBacktest(Object? b) =>
      _post('/api/analysis/backtest', b);
  Future<dynamic> analysisBacktestGet(Object runId) =>
      req('/api/analysis/backtest/$runId');

  // ── bülten arşivi + değişmez snapshot motoru (kalıcı arşiv) ───────────
  Future<dynamic> archiveBulletins() => req('/api/bulletins');
  Future<dynamic> archiveBulletin(Object id) => req('/api/bulletins/$id');
  Future<dynamic> archiveSnapshot(Object id) =>
      req('/api/bulletins/$id/snapshot');
  Future<dynamic> archiveResults(Object id) =>
      req('/api/bulletins/$id/results');
  Future<dynamic> archiveEvaluation(Object id) =>
      req('/api/bulletins/$id/evaluation');
  Future<dynamic> archiveAudit(Object id) => req('/api/bulletins/$id/audit');
  Future<dynamic> archiveObservations(Object id, [Object? matchId]) => req(
    '/api/bulletins/$id/observations'
    '${matchId != null ? '?matchId=${_enc(matchId)}' : ''}',
  );

  Future<dynamic> archivePositionStats([
    Map<String, Object?> params = const {},
  ]) {
    final q = params.entries
        .where((e) => e.value != null && e.value != '')
        .map((e) => '${e.key}=${_enc(e.value!)}')
        .join('&');
    return req('/api/archive/position-stats${q.isNotEmpty ? '?$q' : ''}');
  }

  Future<dynamic> archiveGet(String path) => req(path);
  Future<dynamic> archivePost(String path, Object? body) => _post(path, body);

  // ── üyelik + oturum güvenliği ─────────────────────────────────────────
  Future<dynamic> register(Object? b) => _post('/api/auth/register', b);
  Future<dynamic> login(Object? b) => _post('/api/auth/login', b);
  Future<dynamic> forgotPassword(Object? b) =>
      _post('/api/auth/forgot-password', b);
  Future<dynamic> resendVerification(Object? b) =>
      _post('/api/auth/resend-verification', b);
  Future<dynamic> serverLogout() => _post('/api/auth/logout', const {});
  Future<dynamic> logoutAll() => _post('/api/auth/logout-all', const {});
  Future<dynamic> sessions() => req('/api/auth/sessions');
  Future<dynamic> revokeSession(Object id) =>
      _delete('/api/auth/sessions/${_enc(id)}');
  Future<dynamic> changePassword(Object? b) =>
      _post('/api/auth/change-password', b);
  Future<dynamic> changeEmail(Object? b) => _post('/api/auth/change-email', b);
  Future<dynamic> securityEvents() => req('/api/auth/security-events');

  // ── kuponlar (hesaba bağlı kalıcı depo) ───────────────────────────────
  Future<dynamic> getCoupons() => req('/api/coupons');
  Future<dynamic> putCoupons(Object? coupons) =>
      _put('/api/coupons', {'coupons': coupons});

  // ── profil + ilerleme (TÜMÜ sunucu doğrulamalı) ───────────────────────
  Future<dynamic> me() => req('/api/users/me');
  Future<dynamic> updateProfile(Object? b) => _patch('/api/users/me', b);
  Future<dynamic> favoriteTeams() => req('/api/favorite-teams');

  /// PREMIUM — durum SUNUCUDAN okunur; istemci "ben premium'um" diyemez.
  Future<dynamic> premiumDurum() => req('/api/premium/durum');
  Future<dynamic> premiumKodKullan(Object kod) =>
      _post('/api/premium/kod', {'kod': kod});
  Future<dynamic> uploadAvatar(Object dataUrl) =>
      _post('/api/users/me/avatar', {'dataUrl': dataUrl});

  /// HESAP SİLME — gerçek ve kalıcı silme (pasife alma değildir).
  /// Onay ifadesi + MEVCUT ŞİFRE olmadan sunucu işlemi reddeder.
  Future<dynamic> deleteAccount(Object confirm, Object currentPassword) =>
      _delete('/api/auth/me', {
        'confirm': confirm,
        'currentPassword': currentPassword,
      });

  // ── yorumlar ──────────────────────────────────────────────────────────
  Future<dynamic> comments(Object matchId) =>
      req('/api/comments?matchId=${_enc(matchId)}');
  Future<dynamic> addComment(Object? b) => _post('/api/comments', b);
  Future<dynamic> editComment(Object id, Object text) =>
      _patch('/api/comments/$id', {'text': text});
  Future<dynamic> deleteComment(Object id) => _delete('/api/comments/$id');
  Future<dynamic> likeComment(Object id) => _post('/api/comments/$id/like');
  Future<dynamic> unlikeComment(Object id) => _delete('/api/comments/$id/like');
  Future<dynamic> viewComment(Object id) => _post('/api/comments/$id/view');

  // ── MODERASYON (E9) ───────────────────────────────────────────────────
  // Bildirme yoruma, engelleme KİŞİYE bağlıdır. Bildirme yanıtı sonucu
  // AÇIKLAMAZ (kaç kişi bildirdi, yorum gizlendi mi): yalnız { ok } ya da
  // ikinci kez bildirilmişse { ok, already } döner.
  Future<dynamic> reportComment(Object id, Object? reason, Object? note) =>
      _post('/api/comments/$id/report', {'reason': reason, 'note': note});
  Future<dynamic> blocks() => req('/api/users/me/blocks');
  Future<dynamic> blockUser(Object userId) =>
      _post('/api/users/me/blocks', {'userId': userId});
  Future<dynamic> unblockUser(Object userId) =>
      _delete('/api/users/me/blocks/${_enc(userId)}');

  // ── İNCELEME (yalnız operatör) ────────────────────────────────────────
  // Topluluk Kuralları'ndaki inceleme sözünün arkasındaki uçlar. Yetki
  // backend/.env içindeki listeden gelir; UYGULAMAYA HİÇBİR OPERATÖR KİMLİĞİ
  // GÖMÜLMEZ. Uygulama yalnız `moderationAccess()` cevabına bakar, kararı
  // sunucu verir.
  //
  // `moderationAccess` normal kullanıcıya da 200 döner ({operator:false}):
  // 403 olsaydı her açılışta arayüzde gereksiz bir hata görünürdü. Diğer uçlar
  // operatör olmayan hesaba 403 verir — bu yüzden ekran girişi access cevabına
  // bağlıdır, kullanıcı reddedilecek bir yola hiç sokulmaz.
  //
  // GİZLİLİK: bu uçların hiçbiri bildiren kişinin kimliğini döndürmez.
  Future<dynamic> moderationAccess() => req('/api/moderation/access');
  Future<dynamic> moderationReports([Object? limit]) => req(
    '/api/moderation/reports${limit != null ? '?limit=${_enc(limit)}' : ''}',
  );
  Future<dynamic> hideComment(Object id) =>
      _post('/api/moderation/comments/${_enc(id)}/hide');
  Future<dynamic> unhideComment(Object id) =>
      _post('/api/moderation/comments/${_enc(id)}/unhide');
  Future<dynamic> dismissReport(Object id) =>
      _post('/api/moderation/reports/${_enc(id)}/dismiss');

  // ── anketler / topluluk tahminleri ────────────────────────────────────
  Future<dynamic> getScore(Object matchId) =>
      req('/api/predictions/score?matchId=${_enc(matchId)}');
  Future<dynamic> saveScore(Object? b) => _post('/api/predictions/score', b);
  Future<dynamic> getPlayerVote(Object matchId) =>
      req('/api/predictions/player?matchId=${_enc(matchId)}');
  Future<dynamic> savePlayerVote(Object? b) =>
      _post('/api/predictions/player', b);
  Future<dynamic> getLineup(Object matchId) =>
      req('/api/predictions/lineup?matchId=${_enc(matchId)}');
  Future<dynamic> saveLineup(Object? b) => _post('/api/predictions/lineup', b);
  Future<dynamic> getPoll(Object matchId) =>
      req('/api/predictions/poll?matchId=${_enc(matchId)}');
  Future<dynamic> savePoll(Object? b) => _post('/api/predictions/poll', b);
  Future<dynamic> community(Object matchId) =>
      req('/api/predictions/community?matchId=${_enc(matchId)}');
  Future<dynamic> msSummary(List<Object> matchIds) => req(
    '/api/predictions/ms-summary?matchIds=${matchIds.map(_enc).join(',')}',
  );
}

/// Kaynakta modül düzeyinde tek bir `api` nesnesi vardı; aynı erişim korunur.
final api = ApiClient();
