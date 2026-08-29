// API SUNUCUSU
// Mobil uygulama SADECE buraya bağlanır; FootyStats anahtarı asla dışarı çıkmaz.
import express from 'express';
import cors from 'cors';
// (node-cron kaldırıldı — zamanlama artık autoRefresh scheduler'ında.)
import path from 'path';
import { macAniMs } from './time/turkiyeSaati.js';
import { arsivdenTamamla, defterdenArmaTamamla, arsivdenPickBirlestir } from './archive/gecmisTamamlama.js';
import { indexRegistry } from './crestRegistry.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { load, save, has, listSnapshotRounds, listRadarRounds, CACHE_DIR } from './cache.js';
import { crestTargetOf, crestFileNameOf, crestContentTypeOf, fetchCrest } from './crestProxy.js';
import { takimFiksturunuGetir } from './takimFikstur.js';
import { yanitOptimizasyonu, paketHazirla, paketiYolla } from './yanitOptimizasyonu.js';
import { yanitBellegi } from './yanitBellegi.js';
import { refreshLiveScores, refreshLiveFootyScores, getLiveFixtures } from './refresh.js';
import { refreshCurrentBulletin, startAutoRefreshScheduler } from './autoRefresh.js';
import { startHistoryAndObservationScheduler } from './history/scheduler.js';
import { getRoundsForNav, getBulletinByRoundId, getRoundResult } from './sources/sportoto.js';
import { fetchLiveFixtures, findLiveFixture, fetchFixtureStatistics, fetchFixtureEvents, fetchFixturesByDate } from './sources/apifootball.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import commentRoutes from './routes/comments.js';
import moderationRoutes from './routes/moderation.js';
import adminRoutes from './routes/admin.js';
import premiumRoutes from './routes/premium.js';
import predictionRoutes from './routes/predictions.js';
import couponRoutes from './routes/coupons.js';
import bulletinArchiveRoutes from './routes/bulletins.js';
import radarRoutes, { makeLegacyRadarHandler, radarKaynaklariniKodla } from './routes/radar.js';
import analysisRoutes from './routes/analysis.js';
import makeScorecardsRouter from './routes/scorecards.js';
import { legacySystemScorecardResponse, legacyCriteriaScorecardResponse } from './scorecards/scorecardService.js';
import { buildCriterionScorecard } from './analysis/analysisService.js';
import { startArchiveWorker } from './archive/worker.js';
import { getArchiveStatus } from './archive/snapshotService.js';
import { getArchiveStore } from './archive/store.js';
import { sbAdmin, supabaseEnabled } from './supabase.js';
import { sarmala, hataKatmani, surecAginiKur } from './security/asyncGuard.js';
import { securityHeaders } from './security/headers.js';
import { buildCorsOptions } from './security/corsPolicy.js';
import { yorumEklemeLimiti, kuponYazmaLimiti, avatarLimiti, backtestLimiti } from './security/limits.js';
import { acilistaMigrationCalistir, migrationDurumu } from './migrate/index.js';
import { favoriTakimKatalogu } from './favoriteTeams.js';
import { kotaDurumu } from './sources/kotaBekcisi.js';

// Bülten maç listesi belleği — gerekçe ve ölçüm: yanitBellegi.js
const maclarBellegi = yanitBellegi(5000);
// Hazır bülten paketi (dizilmiş + sıkıştırılmış) — sıcak yol, 15 sn yoklama.
const bultenPaketi = yanitBellegi(5000);
// Arşiv/mühür durumu — 116 ms'lik Supabase turu; dakikalar mertebesinde değişir.
const arsivBellegi = yanitBellegi(30000);
// Arma kayıt defteri indeksi — dosya okuma + indeksleme, istek başına yapılmaz.
const armaDefteriBellegi = yanitBellegi(60000);

const app = express();
// Render/ters vekil arkasında gerçek istemci IP'sini görmek için şart.
// Bu olmadan req.ip herkes için vekilin IP'si olur: oran sınırlama tek
// kullanıcı yerine HERKESİ kilitler, güvenlik logları yanlış IP yazar.
app.set('trust proxy', 1);
// Güvenlik başlıkları (CSP/HSTS/nosniff/frame-ancestors) — bkz. security/headers.js
app.use(securityHeaders());
// CORS artık listeli: ALLOWED_ORIGINS (.env) + geliştirmede localhost/LAN.
// Origin'siz istekler (mobil uygulama) serbesttir — bkz. security/corsPolicy.js
app.use(cors(buildCorsOptions()));
// YANIT SIKIŞTIRMA + DOĞRULAMA — ölçekte belirleyici. /api/bulletin gövdesi
// 615 KB ve istemci 15 sn'de bir yokluyor; sıkıştırma %97, 304 doğrulaması
// neredeyse %100 kazanç sağlıyor. Ayrıntı: yanitOptimizasyonu.js
app.use(yanitOptimizasyonu());
app.use(express.json({ limit: '4mb' })); // avatar yüklemesi (dataURL) için yeterli

// MALİYETLİ UÇLARIN ORAN SINIRLARI (security/limits.js) — rota kayıtlarından
// ÖNCE bağlanmalı ki sınır, işleyiciden önce çalışsın. GET'ler serbest.
app.use('/api/comments', yorumEklemeLimiti);
app.use('/api/coupons', kuponYazmaLimiti);
app.use('/api/users/me/avatar', avatarLimiti);
app.use('/api/analysis/backtest', backtestLimiti);

// Üyelik / profil / yorum sistemi (Supabase)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
// MODERASYON (yalnız operatör) — /api/moderation/{access,reports,
// comments/:id/hide, comments/:id/unhide, reports/:id/dismiss}. Yetki
// .env'deki MODERATOR_EMAILS ile belirlenir, uygulamaya gömülmez.
app.use('/api/moderation', moderationRoutes);
// YÖNETİM UÇLARI — operatöre kapalı (MODERATOR_EMAILS). Ayrıntı: routes/admin.js
app.use('/api/admin', adminRoutes);
// PREMIUM (kullanıcı tarafı): kod kullanma + durum. Ayrıntı: routes/premium.js
app.use('/api/premium', premiumRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/coupons', couponRoutes);

// BÜLTEN ARŞİVİ + DEĞİŞMEZ SNAPSHOT MOTORU (kalıcı arşiv uçları)
// /api/bulletins · /api/bulletins/:id/{snapshot,results,evaluation,audit,observations}
// /api/archive/position-stats · /api/internal/bulletins/:id/freeze (korumalı)
app.use('/api', bulletinArchiveRoutes);

// RADAR MERKEZİ — /api/radar/{current,weeks,scorecard,methodology,data-quality,
// public-percentage-history,market-history,:roundId,:roundId/match/:matchId}
// Radar Merkezi kaydı olmayan haftalarda :roundId, aşağıdaki ESKİ işleyiciye
// düşer (geriye uyumluluk). /api/surprise-radar ve /api/radar-scorecard aynen durur.
app.use('/api/radar', radarRoutes);

// MASTER ANALİZ MOTORU — /api/analysis/{criteria,criteria-scorecard,methodology,
// profiles,bulletins/:id/calculate|official|user|save-user-analysis,backtest,...}
app.use('/api/analysis', analysisRoutes);

// KARNELER (doğrulanmış) — /api/scorecards/{system,system/weeks,system/errors,
// coverage,radar,criteria,retrospective,provenance}. Üç karne de TEK merkezî
// resmî ileri-test kuralını kullanır (scorecards/provenance.js — default-deny).
app.use('/api/scorecards', makeScorecardsRouter({ fetchBulletin: getBulletinByRoundId }));

// Sağlık kontrolü
app.get('/api/health', (req, res) => {
  const cached = load('bulletin');
  const migration = migrationDurumu();

  // `ok` GERÇEK DURUMDAN TÜRETİLİR — sabit `true` DEĞİL.
  //
  // Eski hâl koşulsuz `ok: true` yazıyordu: şema göçü başarısız olsa da,
  // veritabanına hiç bağlanılamasa da uç "sağlıklıyım" diyordu. Sağlık
  // kontrolü tam da bu durumları görmek için var; yalan söyleyen bir kontrol
  // kontrol değildir.
  //
  // HTTP durumu 200 KALIYOR (bilerek): sunucu, sorunu /api/health üzerinden
  // bildirebilmek için ayakta tutuluyor. 503 dönseydi platform örneği sürekli
  // yeniden başlatır ve teşhis kaybolurdu. Doğru olan, gövdede doğruyu söylemek.
  const semaBozuk = migration.ok === false;
  res.json({
    ok: !semaBozuk,
    durum: semaBozuk ? 'sema-hatasi' : (cached ? 'saglikli' : 'veri-yok'),
    hasData: !!cached,
    updatedAt: cached?.data?.updatedAt || null,
    // Şema durumu: hangi migration'lar uygulandı ve doğrulama geçti mi.
    // Bağlantı bilgisi, sunucu adresi veya gizli değer TAŞIMAZ.
    migration: {
      durum: migration.durum,
      ok: migration.ok,
      uygulanan: migration.uygulanan,
      zaman: migration.zaman,
      semaDogrulandi: migration.dogrulama ? migration.dogrulama.ok : null,
    },
    // VERİ KAYNAĞI KOTASI (2026-08-06 denetimi): kalan kota hiçbir uçtan
    // görünmüyordu; kota bitince bülten sessizce eksiliyordu (2 Ağustos olayı).
    // Yalnız SAYI yayınlanır — sağlayıcı adı, anahtar veya uç bilgisi YOK.
    kota: (() => {
      const k = kotaDurumu();
      return { kalan: k.kalan, limit: k.limit, sonGuncelleme: k.sonGuncelleme };
    })(),
  });
});

// VERİ KAPSAM KONTROLÜ — güncel bültende hangi maçlar eşleşmedi, sebebiyle.
// Uygulamanın "her maçta veri" garantisini denetlemek için (refresh üretir).
app.get('/api/coverage', (req, res) => {
  const rep = load('coverage')?.data;
  if (rep) return res.json(rep);
  // Rapor yoksa güncel bültenden anlık üret (eski cache uyumu).
  const b = load('bulletin')?.data;
  const ms = b?.matches || [];
  const uncovered = ms.filter((m) => m.coverage ? !m.coverage.ok : !m.footyMatchId)
    .map((m) => ({ no: m.no, home: m.home?.name, away: m.away?.name, league: m.league || null, reason: m.coverage?.reason || 'Eşleşmedi' }));
  res.json({ generatedAt: b?.updatedAt || null, roundId: b?.roundId ?? null, round: b?.round ?? null, total: ms.length, matched: ms.length - uncovered.length, uncoveredCount: uncovered.length, uncovered });
});

// KULÜP ARMASI VEKİLİ — /api/crest?u=<arma adresi>
//
// NEDEN: Arma dış kaynaktan geldiğinde tarayıcı onu EKRANDA çiziyor ama
// "ekran görselini paylaş" karesine KOYAMIYOR (dış kaynak CORS izni vermiyor,
// kare alan kitaplık da izinsiz görseli sessizce düşürüyor). Kendi
// sunucumuzdan geçince sorun kalkıyor: üretim web'i aynı origin'den sunulur
// (CORS gerekmez); geliştirmede :8081 → :4000 isteğine listeli CORS politikası
// (security/corsPolicy.js, localhost/LAN serbest) izin verir ve arma kareye girer.
//
// GÜVENLİK: Adres doğrulaması crestProxy.js'te ve VARSAYILAN RET çalışır —
// yalnız bilinen arma konağının /img/ altındaki görselleri geçer, başka her
// şey 400 alır. Bu uç genel bir "adres getir" kapısı değildir (SSRF).
//
// BAŞARISIZLIK = 404, 500 DEĞİL: arma indirilememesi sunucu arızası değildir;
// uygulamadaki arma bileşeni 404'ü görünce nötr ⚽ çizer. Yanlış/benzeri bir
// arma asla konmaz.
const crestDir = path.join(CACHE_DIR, 'crests');
app.get('/api/crest', async (req, res) => {
  const hedef = crestTargetOf(req.query?.u);
  if (!hedef) return res.status(400).json({ error: 'Geçersiz arma adresi.' });
  const ad = crestFileNameOf(hedef);
  const tur = crestContentTypeOf(hedef);
  const dosya = path.join(crestDir, ad);

  // Bir kez indirilen arma diskte kalır; her yayında dış ağa gidilmez.
  const yolla = (govde) => {
    res.set('Content-Type', tur);
    res.set('Cache-Control', 'public, max-age=2592000, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(govde);
  };
  try {
    if (fs.existsSync(dosya)) return yolla(fs.readFileSync(dosya));
  } catch { /* bozuk dosya — aşağıda yeniden indirilir */ }

  const arma = await fetchCrest(hedef);
  if (!arma) return res.status(404).json({ error: 'Arma bulunamadı.' });
  try {
    fs.mkdirSync(crestDir, { recursive: true });
    fs.writeFileSync(dosya, arma.body);
  } catch { /* disk yazılamadıysa da görseli yollarız */ }
  return yolla(arma.body);
});

// Analizli bülten (ana ekran). Lig tablosu büyük; sadece maç detayında döner.
let lastLiveAt = 0;
app.get('/api/bulletin', async (req, res) => {
  // TEK OKUMA: load('bulletin') 1,2 MB JSON'u SENKRON okuyup ayrıştırır
  // (Node'un tek thread'ini bloklar). Eskiden aynı istekte İKİ KEZ
  // çağrılıyordu — biri yalnız "hazır mı?" kontrolü içindi. Kontrol artık
  // has() ile dosyaya dokunmadan yapılır; asıl okuma canlı skor
  // tazelemesinden SONRA bir kez yapılır (tazeleme dosyayı değiştirebilir).
  if (!has('bulletin')) return res.status(503).json({ error: 'Veri henüz hazır değil, birkaç saniye sonra tekrar dene.' });
  // Canlı skorları tazele (en çok 45 sn'de bir; canlı maç yoksa erken döner, API'ye gitmez)
  if (Date.now() - lastLiveAt > 45000) {
    lastLiveAt = Date.now();
    try { await refreshLiveScores(); } catch (e) { console.warn('[live] güncelleme hatası:', e.message); }
  }
  const cached = load('bulletin');
  if (!cached?.data) return res.status(503).json({ error: 'Veri henüz hazır değil, birkaç saniye sonra tekrar dene.' });
  const data = cached.data;
  // MAÇ LİSTESİ BELLEKTE: bu dönüşüm (kadro/lig tablosu ayıklama) 15 maç için
  // her istekte yeniden yapılıyordu. İstemci 15 sn'de bir yokladığı için
  // ölçekte doğrudan CPU tavanına vuruyor. Bültenin kendi damgası
  // (updatedAt) değişmedikçe sonuç aynıdır.
  const matches = maclarBellegi.al(() => data.matches.map((m) => {
    if (!m.stats) return m;
    const { leagueTable, ...restStats } = m.stats;
    const home = restStats.home ? { ...restStats.home, squad: undefined } : restStats.home;
    const away = restStats.away ? { ...restStats.away, squad: undefined } : restStats.away;
    return { ...m, stats: { ...restStats, home, away } };
  }), `${data.updatedAt ?? ''}|${data.matches.length}`);
  // Arşiv/mühür durumu (freezeAt geri sayımı + "Mühürlü Analiz" rozeti için).
  // Arşiv okunamazsa bülten yine döner (mevcut akış bozulmaz).
  // ARŞİV DURUMU BELLEKTE — ölçekte EN BÜYÜK kazanç.
  // ÖLÇÜM: getArchiveStatus tek çağrıda 116 ms (Supabase'e ağ turu) ve bu
  // HER istekte yapılıyordu. İstemci 15 sn'de bir yokladığı için 1.000
  // eşzamanlı kullanıcı saniyede ~67 veritabanı sorgusu demekti — hem
  // gecikme hem fatura. Mühür durumu dakikalar mertebesinde değişir;
  // 30 saniyelik bayatlık kullanıcı için görünmez, yük için belirleyici.
  let archive = null;
  try {
    archive = await arsivBellegi.al(
      () => getArchiveStatus(data.roundId).catch(() => null),
      String(data.roundId ?? ''),
    );
  } catch { archive = null; }

  // HAZIR PAKET — ölçekteki asıl kazanç burada.
  // Bu uç, istemci bülten ekranı açıkken 15 SANİYEDE BİR çağrılıyor. Yanıtı
  // her istekte yeniden dizip sıkıştırmak istek başına ~3,1 ms CPU demekti
  // (stringify 1,40 + gzip 1,71) ve tek çekirdekte ~90 istek/sn tavanı
  // getiriyordu. Paket bir kez hazırlanır, TTL boyunca aynı baytlar servis
  // edilir; yoklama maliyeti neredeyse sıfıra iner.
  // TTL kısa (5 sn): canlı skor 45 sn'de tazeleniyor, bayatlık sınırlı kalmalı.
  // KAYNAK KİMLİĞİ NÖTRLEME — BURASI DA BİR HTTP SINIRI (16 Ağustos 2026).
  //
  // `radarKaynaklariniKodla` radar rotalarında uygulanıyordu ama bülten
  // `radarCenter`'ı taşıdığı hâlde o rotadan geçmiyor. Üretimde ölçüldü:
  //   /api/radar/current → providerId "k1"      (maskeli)
  //   /api/bulletin      → providerId "nesine"  (HAM — 15 maçın hepsinde)
  // Bahis sitesi adı yanıta hiç çıkmamalı (yasal/mağaza kısıtı).
  //
  // AYNI fonksiyon kullanılır, ikinci bir maskeleme tanımı yazılmaz. İç hesap
  // ve MÜHÜRLÜ snapshot ham kimliği kullanmaya devam eder — benzer-DNA
  // eşleşmesi ona bağlı ve geçmiş mühürler değiştirilemez.
  const paket = bultenPaketi.al(
    () => paketHazirla({
      ...data,
      matches,
      archive,
      couponPricing: readCouponPricing(),
      ...(data.radarCenter ? { radarCenter: radarKaynaklariniKodla(data.radarCenter) } : {}),
    }),
    `${data.updatedAt ?? ''}|${archive?.status ?? ''}`,
  );
  paketiYolla(req, res, paket);
});

// BİRİM KOLON BEDELİ — KODA YAZILMAZ/UYDURULMAZ. Yalnız backend/data/
// coupon-pricing.json'dan okunur: { "unitPrice": <TL>, "source": "<kaynak>",
// "updatedAt": "<ISO tarih>" }. Dosya yoksa/eksikse null döner → uygulama
// "birim bedel verisi yok" der, yanlış maliyet GÖSTERMEZ. Resmi kaynaktan
// güncel bedeli öğrenince bu dosyayı doldurman yeterli.
function readCouponPricing() {
  try {
    const p = JSON.parse(fs.readFileSync(new URL('../data/coupon-pricing.json', import.meta.url), 'utf8'));
    if (Number(p?.unitPrice) > 0 && p?.source && p?.updatedAt) {
      return { unitPrice: Number(p.unitPrice), source: String(p.source), updatedAt: String(p.updatedAt) };
    }
  } catch {}
  return null;
}

// Sürpriz radarı (sıralı liste)
// Radar hafta listesi: arşivlenmiş (mühürlü) haftalar + güncel hafta, yeniden eskiye.
function radarWeeks() {
  const weeks = listRadarRounds()
    .map((id) => load(`radar-${id}`)?.data)
    .filter(Boolean)
    .map((w) => ({ roundId: w.roundId, round: w.round, year: w.year, radarFrozenAt: w.radarFrozenAt }));
  const cur = load('bulletin')?.data;
  if (cur?.roundId != null && !weeks.some((w) => w.roundId === cur.roundId)) {
    weeks.push({ roundId: cur.roundId, round: cur.round, year: cur.year, radarFrozenAt: cur.radarFrozenAt ?? null });
  }
  return weeks.sort((a, b) => b.roundId - a.roundId);
}

app.get('/api/surprise-radar', (req, res) => {
  const cached = load('bulletin');
  if (!cached) return res.status(503).json({ error: 'Veri henüz hazır değil.' });
  // Donma anı (geri sayım için): ilk maçın başlamasına 5 dk kala.
  const kickoffs = (cached.data.matches || []).filter((m) => m.kickoffTimeKnown !== false).map((m) => macAniMs(m.date)).filter(Number.isFinite);
  const radarFreezeAt = kickoffs.length ? new Date(Math.min(...kickoffs) - 5 * 60 * 1000).toISOString() : null;
  res.json({
    updatedAt: cached.data.updatedAt,
    round: cached.data.round ?? null,          // örn. "49. Hafta"
    year: cached.data.year ?? null,
    roundId: cached.data.roundId ?? null,
    radarFrozenAt: cached.data.radarFrozenAt ?? null, // 🔒 null = canlı
    radarFreezeAt,                             // mühür anı (geri sayım)
    weeks: radarWeeks(),                       // üst hafta çubukları için
    radar: cached.data.radar,
  });
});

// Geçmiş hafta radarı (mühürlü arşiv). Güncel hafta istenirse canlı yanıt döner.
// Arşive RESMİ sonuçlar işlenir: her maça result + skor + favori tuttu mu.
// İşleyici routes/radar.js'te (makeLegacyRadarHandler): sayısal doğrulama +
// güncel hafta asla "arşiv yok" 404'üne düşmez; eski davranış aynen korunur.
app.get('/api/radar/:roundId', makeLegacyRadarHandler({ fetchBulletin: getBulletinByRoundId }));

// ESKİ RADAR KARNESİ — eski sürpriz radarı arşivlerinden (radar-*.json).
// ⚠️ PROVENANCE: bu kayıtların maç öncesi mühürlendiği DOĞRULANAMAZ (hash yok)
// — bu yüzden yanıt AÇIKÇA retrospektif/legacy işaretlenir ve güncel Radar
// Merkezi'nde GERÇEK başarı olarak GÖSTERİLMEZ. Resmî karne: /api/radar/scorecard.
app.get('/api/radar-scorecard', async (req, res) => {
  try {
    let rs = cacheGet('radarScorecard');
    if (!rs) {
      const byLabel = {}; // label → { total, favWin }
      let matchesCounted = 0, weeksCounted = 0;
      for (const roundId of listRadarRounds()) {
        const arch = load(`radar-${roundId}`)?.data;
        if (!arch?.radar?.length) continue;
        let bulletin;
        try { bulletin = await getBulletinByRoundId(roundId); } catch { continue; }
        const byNo = new Map((bulletin.matches || []).map((m) => [m.no, m]));
        let used = false;
        for (const r of arch.radar) {
          const m = byNo.get(r.no);
          if (!m?.result || !r.favorite?.symbol) continue;    // resmi sonuç + favori şart
          const lb = r.label || '—';
          if (!byLabel[lb]) byLabel[lb] = { total: 0, favWin: 0 };
          byLabel[lb].total += 1;
          if (r.favorite.symbol === m.result) byLabel[lb].favWin += 1;
          matchesCounted += 1; used = true;
        }
        if (used) weeksCounted += 1;
      }
      const pct = (c, t) => (t ? Math.round(c / t * 100) : 0);
      const banko = byLabel['BANKO'] || { total: 0, favWin: 0 };
      const dikkat = byLabel['DİKKAT'] || { total: 0, favWin: 0 };
      const surpriz = byLabel['SÜRPRİZE AÇIK'] || { total: 0, favWin: 0 };
      const anyBackfilled = listRadarRounds().some((rid) => load(`radar-${rid}`)?.data?.backfilled === true);
      rs = {
        generatedAt: new Date().toISOString(),
        source: 'Eski sürpriz radarı arşivi × resmî Spor Toto sonuçları',
        predictionSource: 'Eski sistem radar arşivi (doğrulama hash\'i YOK — maç öncesi kanıtlanamaz)',
        resultSource: 'Resmî Spor Toto 90 dakika sonuçları',
        hasData: matchesCounted > 0,
        isOfficialForward: false,                       // ❗ resmî ileri-test DEĞİL
        isDemo: false,
        retrospective: true,
        provenanceType: anyBackfilled ? 'legacy_backfill' : 'unknown',
        officialNote: 'RESMÎ BAŞARIYA DAHİL DEĞİLDİR — eski sistem arşivi; resmî Radar Karnesi /api/radar/scorecard ucundadır.',
        weeksCounted, matchesCounted,
        note: matchesCounted === 0
          ? 'Eski radar arşivi kaydı yok.'
          : (matchesCounted < 30 ? 'Örnek sayısı henüz az — oranlar zamanla oturur.' : null),
        labels: {
          banko: { total: banko.total, hit: banko.favWin, rate: pct(banko.favWin, banko.total), desc: 'Güçlü aday dediklerinde favori kazandı' },
          dikkat: { total: dikkat.total, favWin: dikkat.favWin, favWinRate: pct(dikkat.favWin, dikkat.total), desc: 'Dikkat dediklerinde favorinin kazanma oranı' },
          surpriz: { total: surpriz.total, hit: surpriz.total - surpriz.favWin, rate: pct(surpriz.total - surpriz.favWin, surpriz.total), desc: 'Sürprize açık dediklerinde favori kazanamadı' },
        },
      };
      cacheSet('radarScorecard', rs, 5 * 60 * 1000);
    }
    res.json(rs);
  } catch (e) {
    res.status(500).json({ error: 'Radar karnesi hesaplanamadı.' });
  }
});

// Tek maç detayı
app.get('/api/match/:no', (req, res) => {
  const cached = load('bulletin');
  if (!cached) return res.status(503).json({ error: 'Veri henüz hazır değil.' });
  const match = cached.data.matches.find((m) => String(m.no) === req.params.no);
  if (!match) return res.status(404).json({ error: 'Maç bulunamadı.' });
  // Kupon taslağı için hafta bağlamı (roundId/season/hafta + teyit durumu).
  res.json({ ...match, roundId: cached.data.roundId, round: cached.data.round, year: cached.data.year, closeDate: cached.data.closeDate || null, verificationStatus: cached.data.verification?.status || null });
});

// TAKIM FİKSTÜRÜ — bir takımın sezondaki oynanmış + oynanacak tüm maçları.
// Maç detayındaki takım kartından açılır. seasonId istemciden gelir: takımın
// hangi ligde oynadığını bülten maçı bilir (footySeasonId).
app.get('/api/team-fixtures/:teamId', async (req, res) => {
  const { teamId } = req.params;
  const seasonId = req.query.seasonId;
  if (!/^\d+$/.test(String(teamId)) || !/^\d+$/.test(String(seasonId || ''))) {
    return res.status(400).json({ error: 'teamId ve seasonId sayı olmalı.' });
  }
  try {
    res.json(await takimFiksturunuGetir(teamId, seasonId));
  } catch (e) {
    // Sessizce boş liste DÖNÜLMEZ: "maçı yok" ile "veri alınamadı" farklı
    // şeylerdir ve kullanıcı hangisi olduğunu bilmeli.
    res.status(502).json({ error: `Fikstür alınamadı: ${e.message}` });
  }
});

// Canlı maç detayı: GERÇEK canlı istatistik + olaylar (API-Football). Sadece
// resmi teyitli bültendeki maç için; maç şu an canlı listede bulunabiliyorsa
// stats/events döner, yoksa boş (uydurma YOK). 8 sn TTL ile API korunur.
const liveDetailCache = new Map(); // no -> { exp, val }
app.get('/api/live/:no', async (req, res) => {
  const cached = load('bulletin');
  if (!cached?.data) return res.status(503).json({ error: 'Veri henüz hazır değil.' });
  const data = cached.data;
  if (data.pending || data.verification?.status !== 'confirmed') {
    return res.status(409).json({ error: 'Bülten resmi olarak teyit edilmedi.', pending: true });
  }
  const m = data.matches.find((x) => String(x.no) === req.params.no);
  if (!m) return res.status(404).json({ error: 'Maç bulunamadı.' });

  const now = Date.now();
  const hit = liveDetailCache.get(req.params.no);
  if (hit && hit.exp > now) return res.json(hit.val);

  const base = {
    no: m.no, home: m.home?.mediumName || m.home?.name, away: m.away?.mediumName || m.away?.name,
    // roundId: istemci bu maç için KULLANICININ GERÇEK kuponunu bulabilsin diye
    // gerekir (kupon istemcide saklanır; sunucu kupon içeriğini burada dönmez).
    roundId: data.roundId ?? null,
    score: m.score || null, minute: m.minute ?? null, live: !!m.live, finalized: !!m.finalized,
    started: !!m.started, liveStatus: m.liveStatus || null, prediction: m.prediction || null,
    stats: [], events: [], hasLiveData: false, updatedAt: new Date().toISOString(),
  };

  // Canlı fikstürü bul → gerçek istatistik + olayları çek. Hata/veri yoksa boş kalır.
  try {
    const fixtures = await fetchLiveFixtures();
    const found = findLiveFixture(m, fixtures);
    const fx = found?.fixture;
    if (fx?.fixtureId) {
      const [stats, events] = await Promise.all([
        fetchFixtureStatistics(fx.fixtureId, found.swapped).catch(() => []),
        fetchFixtureEvents(fx.fixtureId, base.home, base.away).catch(() => []),
      ]);
      base.stats = stats.filter((s) => s.home != null || s.away != null);
      base.events = events;
      base.hasLiveData = base.stats.length > 0 || base.events.length > 0;
      base.minute = fx.minute ?? base.minute;
      base.liveStatus = fx.statusShort || base.liveStatus;
    }
  } catch (e) {
    console.warn('[live/detail] alınamadı:', e.message);
  }

  liveDetailCache.set(req.params.no, { exp: now + 8000, val: base });
  capMap(liveDetailCache); // anahtar kullanıcı girdisi (maç no) — sınırsız büyüyemez
  res.json(base);
});

// Basit bellek-içi TTL cache — geçmiş/sonuç uçları sık gezilir ve resmi API'yi
// yormamak gerekir. Yayınlanmış geçmiş sonuçlar değişmez (uzun TTL).
// SINIR: anahtarlar kullanıcı girdisinden (roundId) türeyebildiği için Map
// sınırsız büyüyebilirdi (bellek tüketme yüzeyi). Basit LRU: tavana ulaşınca
// en eski girdi atılır; get, girdiyi "yeni" konuma taşır.
const MEM_CACHE_MAX = 200;
const memCache = new Map(); // key -> { exp, val } (Map ekleme sırasını korur)
function cacheGet(key) {
  const e = memCache.get(key);
  if (e && e.exp > Date.now()) {
    memCache.delete(key); memCache.set(key, e); // LRU: kullanılanı sona taşı
    return e.val;
  }
  if (e) memCache.delete(key);
  return null;
}
function cacheSet(key, val, ttlMs) {
  if (memCache.has(key)) memCache.delete(key);
  memCache.set(key, { exp: Date.now() + ttlMs, val });
  while (memCache.size > MEM_CACHE_MAX) {
    memCache.delete(memCache.keys().next().value); // en eski (LRU) girdi atılır
  }
}
// Yardımcı Map'ler için ortak sınır (histFreshAt/liveFootyAt gibi zaman
// damgası haritaları) — değerler küçük ama anahtar sayısı sınırlanmalı.
function capMap(map, max = 500) {
  while (map.size > max) map.delete(map.keys().next().value);
}

// Hafta listesi (geçmiş/güncel navigasyon). Liste seyrek değişir → 10 dk cache.
app.get('/api/rounds', async (req, res) => {
  try {
    let data = cacheGet('rounds');
    if (!data) {
      data = await getRoundsForNav();
      cacheSet('rounds', data, 10 * 60 * 1000);
    }
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Hafta listesi alınamadı.' });
  }
});

// Geçmiş hafta bülteni: maç listesi + skor + resmi 1/X/2 + ikramiye (analiz yok).
// İkramiye gelmişse (yayınlanmış) sonuç değişmez → 24 saat; değilse kısa TTL.
const histFreshAt = new Map();  // roundId -> son taze sorgu zamanı (resmi API'yi korur)
const liveFootyAt = new Map();  // roundId -> son CANLI footy skoru tazeleme zamanı (throttle)
const arsivPickAt = new Map();  // roundId -> son arşivden pick geri yükleme denemesi (throttle)

// SİSTEM TAHMİNİ GERİ YÜKLEME — MÜHÜRLÜ ARŞİVDEN (24 Ağustos 2026).
//
// GERÇEK OLAY (2. Hafta / 1529): geçmiş bültenin "Sistem tahmini" ve geçici
// skor kimlikleri YALNIZ yerel `cache/snapshot-<roundId>.json` dosyasından
// okunuyordu. Render'ın diski kalıcı değil — her deploy/yeniden başlatma bu
// dosyayı SİLİYOR. Sonuç: tahminler ekrandan kayboluyor, kullanıcı elle
// düzeltiyor, sonraki restart yine siliyor; footyMatchId de aynı dosyada
// olduğu için geçici skor akışı ölüyor ("sonuçlar gelmiyor").
//
// Aynı bilgi mühürlü arşivde (veritabanı) KALICI duruyor: systemPrediction
// (symbol/label), armalar ve externalIds.footyMatchId/footySwapped. Lig adı +
// arma için bu yol zaten kullanılıyordu (arsivdenTamamla) — tahmin için
// kullanılmıyordu; bu fonksiyon o eksiği kapatır.
//
// KURALLAR (gecmisTamamlama.js ile aynı):
//  * Arşive HİÇBİR ŞEY YAZILMAZ — yalnız okunur. Yerel cache dosyası mührün
//    KOPYASI olarak yeniden yazılır (restoredFromArchive işaretiyle) — bu
//    üretim değil, kilit anında yazılmış kaydın geri yüklenmesidir.
//  * Uydurma yok: arşivde tahmin yoksa alan null kalır, ekran boş gösterir.
//  * Yereldeki DOLU değer EZİLMEZ: yalnız eksik/null alan arşivden dolar.
//    (symbol '-' = "VERİ YOK" mührü, DOLU sayılır; null = kayıp/hasar.)
//
// Birleştirme kuralları SAF fonksiyondadır (arsivdenPickBirlestir,
// gecmisTamamlama.js) — düz Node testinde ağsız doğrulanır.
async function arsivdenPickGeriYukle(roundId, yerel) {
  const snap = await getArchiveStore().getSnapshot(String(roundId));
  const picks = arsivdenPickBirlestir(yerel?.picks, snap?.payload?.matches);
  if (!picks) return null; // arşiv de boş → dosya yazılmaz, eski davranış sürer

  const data = {
    roundId,
    round: yerel?.round ?? snap?.payload?.bulletin?.week ?? null,
    savedAt: yerel?.savedAt ?? null,
    restoredFromArchive: true,
    restoredAt: new Date().toISOString(),
    archiveSnapshotId: snap?.id ?? null,
    picks,
  };
  try { save(`snapshot-${roundId}`, data); } catch { /* disk yazılamazsa bellekte kullanılır */ }
  return data;
}
// (snapshotJobs kaldırıldı — geçmişe otomatik backfill üretimi tamamen kapalı.)
app.get('/api/history/:roundId', async (req, res) => {
  try {
    const roundId = Number(req.params.roundId);
    if (!roundId) return res.status(400).json({ error: 'Geçersiz hafta.' });
    const key = `hist:${roundId}`;
    // fresh=1 → cache'i atla (manuel/oto yenileme). Ama resmi Spor Toto API'sini
    // korumak için aynı hafta için en fazla 8 sn'de bir taze sorgu yapılır.
    const fresh = req.query.fresh === '1';
    const throttled = fresh && (Date.now() - (histFreshAt.get(roundId) || 0) < 8000);
    let payload = (!fresh || throttled) ? cacheGet(key) : null;
    if (!payload) {
      const [bulletin, prize] = await Promise.all([
        getBulletinByRoundId(roundId),
        getRoundResult(roundId),
      ]);
      // NOTER KARARI KATMANI (2026-08-10): resmî Spor Toto API'si ertelenen
      // maçın noter kararını sonuç akışında dönmez (53. Hafta 14. maç,
      // Raków–Zagłębie ile yaşandı — ekran sonsuza dek 'Resmi sonuç
      // bekliyor' gösteriyordu). Arşivdeki resmî noter kaydı görüntüye
      // eklenir: işaret VAR, skor YOK (uydurulmaz), viaNotary açık yazılır.
      // Kural bozulmaz: arşive buradan hiçbir şey YAZILMAZ, yalnız okunur.
      //
      // KOŞULSUZ KAZANIR (2026-08-20): eskiden yalnız sonuçsuz maça
      // uygulanıyordu. Kura kararlı maç SONRADAN OYNANIRSA (Celta Vigo –
      // Osasuna, 27 Ağustos) resmî uç skor döndürür ve görüntü maç skorunu
      // basardı — oysa hafta KURAYLA değerlendirildi, ikramiye ona göre
      // dağıtıldı; skoru basmak ekranı ikramiye tablosuyla çeliştirir.
      // Kupon gerçeği: notary kaydı varsa sonuç KURA, skor bu bültenin
      // verisi değil (null'a çekilir).
      try {
        const noter = (await getArchiveStore().listOfficialResults(String(roundId)))
          .filter((r) => r.resultType === 'notary_decision');
        for (const r of noter) {
          const mm = bulletin.matches.find((m) => m.no === r.orderNo);
          if (mm) {
            mm.result = r.officialResult;
            mm.viaNotary = true;
            mm.score = null;
          }
        }
      } catch { /* arşiv okunamazsa görüntü eski davranışında kalır */ }
      // LİG ADI TAMAMLAMA (16 Ağustos 2026) — arşivden, UYDURMADAN.
      //
      // Resmî Spor Toto geçmiş bülteni lig adını çoğu maç için genel bir
      // metinle döner ("2026/2027 Sezonu"). Bu metinden ülke çıkarılamadığı
      // için uygulamada o maçların yanında bayrak çizilemiyordu. Aynı haftanın
      // MÜHÜRLÜ arşiv kaydında lig adı yayın anındaki gerçek hâliyle duruyor
      // ("Turkey Süper Lig"), çünkü kayıt bülten yayındayken zenginleştirilmiş
      // veriden alınmıştı.
      //
      // Kural bozulmaz: arşive buradan hiçbir şey YAZILMAZ, yalnız okunur; ad
      // ancak SIRA NUMARASI VE EV SAHİBİ ADI TUTUYORSA taşınır (yanlış haftanın
      // kaydı ya da sıra kayması olursa hiçbir şey değişmez); eşleşme yoksa
      // resmî ad olduğu gibi kalır.
      // ARMA TAMAMLAMA (16 Ağustos 2026) — AYNI arşiv okumasından.
      //
      // Arma kayıt defteri (`crestRegistry`) DOSYA ÖNBELLEĞİNDE tutuluyor
      // (`cache.js`). Render'ın diski kalıcı değil: her deploy defteri siler.
      // Güncel hafta açılıştaki yenilemede armalarını yeniden topluyor, ama
      // GEÇMİŞ hafta toplamıyor — resmî Spor Toto geçmiş bülteni arma vermez.
      // Ölçüldü (deploy sonrası, üretim): `/api/history/1528` → 15 maçın
      // 15'i armasız (Galatasaray dahil); aynı uç yerelde 0 eksik.
      //
      // Mühürlü arşiv kaydı armaları TAŞIYOR (snapshot payload `home.logo` /
      // `away.logo`) ve arşiv veritabanında durduğu için deploy'dan
      // etkilenmiyor. Lig adıyla aynı okumadan, aynı eşleşme güvencesiyle
      // taşınır — ikinci bir arşiv okuması açılmaz.
      // Kurallar ve gerekçe `archive/gecmisTamamlama.js` içinde; mantık orada
      // SAF bir fonksiyon olarak durur (uç gövdesinde test edilemiyordu).
      try {
        const arsivMaclar = (await getArchiveStore().getSnapshot(String(roundId)))
          ?.payload?.matches || [];
        arsivdenTamamla(bulletin.matches, arsivMaclar);
      } catch { /* arşiv yoksa lig adı ve armalar resmî hâliyle kalır */ }

      // İKİNCİ AŞAMA — ARŞİVİ OLMAYAN HAFTALAR (bkz. gecmisTamamlama.js).
      // Arşivde yalnız son birkaç bülten var; daha eski haftalarda mühür
      // olmadığı için yukarıdaki adım hiçbir şey bulamaz. Ölçüldü: 49. Hafta
      // (arşivde var) armasız 0/15, 48. Hafta (arşivde yok) armasız 15/15 —
      // oysa AYNI kulüpler 49'da armalı görünüyordu.
      //
      // Yalnız BOŞ kalan yerler doldurulur; arşivden gelen değer ezilmez.
      // Defter indeksi her istekte kurulmaz (dosya okuma + indeksleme).
      try {
        const idx = armaDefteriBellegi.al(() => indexRegistry(), 'defter');
        defterdenArmaTamamla(bulletin.matches, idx);
      } catch { /* defter okunamazsa armasız kalır — uydurma yapılmaz */ }
      const resolvedCount = bulletin.matches
        .filter((m) => (m.result && m.score) || m.viaNotary).length;
      payload = {
        ...bulletin, prize,
        source: 'Spor Toto',
        checkedAt: new Date().toISOString(),         // kontrol/kaynak zamanı
        resolvedCount,                               // kaç maçın RESMİ sonucu geldi
        fullyResolved: bulletin.matches.length > 0 && resolvedCount === bulletin.matches.length,
      };
      // Çözülmemiş hafta kısa TTL (sık kontrol); tam çözülmüş + ikramiye uzun TTL.
      cacheSet(key, payload, (payload.fullyResolved && prize) ? 24 * 60 * 60 * 1000 : 30 * 1000);
      if (fresh) { histFreshAt.set(roundId, Date.now()); capMap(histFreshAt); }
    }

    // Geçmiş hafta: kayıtlı SİSTEM TAHMİNİ + maç-öncesi donmuş kayıt/arma
    // (snapshot) + resmi sonuç YOKSA FootyStats'tan GEÇİCİ skor (rate-limitsiz,
    // her refresh'te tazelenir; resmi Spor Toto sonucu gelince o esas alınır).
    //
    // YEREL DOSYA EKSİK/HASARLIYSA MÜHÜRLÜ ARŞİVDEN GERİ YÜKLENİR (24 Ağustos
    // 2026, "2. Hafta tahminleri kayboluyor" düzeltmesi — gerekçe:
    // arsivdenPickGeriYukle). Throttle: hafta başına en fazla 10 dk'da bir
    // denenir; arşivde kayıt yoksa eski davranış aynen sürer.
    let snap = load(`snapshot-${roundId}`)?.data;
    const pickKayip = !snap?.picks?.length || snap.picks.some((p) => p?.symbol == null);
    if (pickKayip && Date.now() - (arsivPickAt.get(roundId) || 0) > 10 * 60 * 1000) {
      arsivPickAt.set(roundId, Date.now()); capMap(arsivPickAt);
      try {
        const geri = await arsivdenPickGeriYukle(roundId, snap);
        if (geri) {
          snap = geri;
          console.log(`[history] snapshot-${roundId} mühürlü arşivden geri yüklendi (${geri.picks.filter((x) => x.symbol != null).length}/${geri.picks.length} tahmin)`);
        }
      } catch (e) { console.warn(`[history] arşivden geri yükleme olmadı (${roundId}): ${e.message}`); }
    }
    if (snap?.picks?.length) {
      const byNo = new Map(snap.picks.map((p) => [p.no, p]));
      // CANLI YANSIMA: başlamış ama resmi sonucu gelmemiş maçların skorunu
      // FootyStats'tan hedefli tazele (throttle 60sn/hafta) → tam refresh beklemez.
      const nowMs = Date.now();
      const liveIds = [];
      for (const mm of payload.matches) {
        const pp = byNo.get(mm.no);
        const started = mm.date && new Date(mm.date).getTime() <= nowMs;
        // Noter maçına canlı/geçici skor ARANMAZ: maç oynanmadı.
        if (pp?.footyMatchId != null && started && !(mm.result && mm.score) && !mm.viaNotary) liveIds.push(pp.footyMatchId);
      }
      if (liveIds.length && nowMs - (liveFootyAt.get(roundId) || 0) > 60000) {
        liveFootyAt.set(roundId, nowMs); capMap(liveFootyAt);
        try { await refreshLiveFootyScores(liveIds); } catch (e) { console.warn('[live-footy] hata:', e.message); }
      }
      // CANLI (birebir): API-Football gerçek-zamanlı skor + DAKİKA — tek çağrı tüm
      // canlı maçları verir (paylaşımlı cache, ekstra API yok). Başlamış-çözülmemiş
      // maç varsa çekilir; yoksa footyScores geçici skoruna düşülür.
      const hasLiveWindow = payload.matches.some((mm) => { const t = mm.date ? new Date(mm.date).getTime() : 0; return t && t <= nowMs && nowMs - t <= 3.5 * 3600 * 1000 && !(mm.result && mm.score) && !mm.viaNotary; });
      let liveFx = [];
      if (hasLiveWindow) { try { liveFx = await getLiveFixtures(); } catch { liveFx = []; } }
      const footyScores = load('footyScores')?.data || {};
      payload = { ...payload, matches: payload.matches.map((m) => {
        const p = byNo.get(m.no);
        if (!p) return m;
        const merged = { ...m };
        if (p.symbol) merged.prediction = { symbol: p.symbol, label: p.label };
        if (p.homeLogo || p.homeRec) merged.home = { ...m.home, logo: p.homeLogo || m.home.logo, record: p.homeRec || null };
        if (p.awayLogo || p.awayRec) merged.away = { ...m.away, logo: p.awayLogo || m.away.logo, record: p.awayRec || null };
        // Noter maçı ÇÖZÜLMÜŞ sayılır: canlı/geçici skor aranmaz (maç yok).
        const unresolved = !(m.result && m.score) && !m.viaNotary;
        const started = m.kickoffTimeKnown !== false && (macAniMs(m.date) ?? Infinity) <= nowMs;
        // 1) API-Football canlı (öncelik) — dakika dahil, gerçek-zamanlı.
        if (unresolved && started && liveFx.length) {
          const fnd = findLiveFixture(merged, liveFx);
          const f = fnd?.fixture;
          if (f) {
            const score = fnd.swapped ? { home: f.awayGoals, away: f.homeGoals } : { home: f.homeGoals, away: f.awayGoals };
            merged.provisional = { score, live: !!f.live, finished: !!f.finished, minute: f.live ? f.minute : null, source: 'canli' };
          }
        }
        // 2) FootyStats geçici skoru (fallback — API-Football'da bulunmadıysa).
        if (!merged.provisional && unresolved && p.footyMatchId != null) {
          const fs = footyScores[p.footyMatchId];
          if (fs && fs.score) {
            const score = p.footySwapped ? { home: fs.score.away, away: fs.score.home } : fs.score;
            merged.provisional = { score, live: fs.status === 'live', finished: fs.status === 'finished', source: 'gecici' };
          }
        }
        return merged;
      }) };
    }
    // ⛔ OTOMATİK BACKFILL KALDIRILDI: geçmiş haftaya BAKMAK tahmin snapshot'ı
    // ÜRETMEZ. Eski davranış (snapshotRoundPredictions arka plan çağrısı) geçmişe
    // sonradan üretilmiş 'backfilled' kayıtlarla karneleri kirletiyordu. Geçmiş
    // haftada snapshot yoksa sistem tahmini alanı boş kalır — uydurma üretilmez.

    res.json(payload);
  } catch (e) {
    res.status(502).json({ error: 'Geçmiş bülten bilgisi alınamadı.' });
  }
});

// SİSTEM KARNESİ — ✅ YENİ DOĞRULANMIŞ HESAP (geriye uyumlu uç).
// ⚠️ ESKİ HESAP KALDIRILDI: eski sürüm TÜM snapshot-*.json dosyalarını (11'i
// backfilled:true — geçmişe sonradan üretilmiş) tarıyor ve '1X'/'X2'/'102' gibi
// KAPALI tercihleri de "doğru" sayıyordu → %69'luk sahte resmî başarı.
// Yeni hesap: yalnız KANITLI official_forward mühürlü snapshot'ların TEKLİ
// mainPrediction (1/X/2) doğruluğu (scorecards/scorecardService.js).
// Kapalı tercihler yalnız AYRI "Kapsama Başarısı"nda ölçülür. Eski kayıtlar
// SİLİNMEZ: /api/scorecards/retrospective bölümünde açık etiketle raporlanır.
app.get('/api/system-scorecard', async (req, res) => {
  try {
    let sc = cacheGet('scorecard');
    if (!sc) {
      // Geriye uyumlu alanlar: eski istemciler total/correct/wrong/accuracy okur —
      // bu değerler artık YALNIZ tekli resmî ana tahmin başarısıdır.
      sc = await legacySystemScorecardResponse();
      cacheSet('scorecard', sc, 5 * 60 * 1000);
    }
    res.json(sc);
  } catch (e) {
    console.warn('[system-scorecard] hata:', e.message);
    res.status(500).json({ error: 'Karne hesaplanamadı.' });
  }
});

// KRİTER KARNESİ — ✅ YENİ DOĞRULANMIŞ HESAP (geriye uyumlu uç).
// ⚠️ ESKİ HESAP KALDIRILDI: eski sürüm backfilled snapshot-*.json kriter
// sinyallerini de sayıyordu. Yeni hesap yalnız official_forward mühürlü
// catalogEvaluation × resmî sonuç kullanır (analysisService.buildCriterionScorecard).
// Eski istemci şekli (criteria[].total/hit/accuracy/lowSample) korunur.
app.get('/api/criteria-scorecard', async (req, res) => {
  try {
    let cs = cacheGet('criteriaScorecard');
    if (!cs) {
      cs = await legacyCriteriaScorecardResponse({ buildCriterionScorecard });
      cacheSet('criteriaScorecard', cs, 5 * 60 * 1000);
    }
    res.json(cs);
  } catch (e) {
    console.warn('[criteria-scorecard] hata:', e.message);
    res.status(500).json({ error: 'Kriter karnesi hesaplanamadı.' });
  }
});

// Yalnız iç erişim: INTERNAL_API_KEY tanımlıysa doğru anahtar, değilse
// yalnız localhost. /api/internal/refresh-status ile aynı kural.
function yalnizIcErisim(req, res, next) {
  const key = process.env.INTERNAL_API_KEY;
  const given = req.get('x-internal-key') || req.query.key;
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
  if (key ? given !== key : !local) return res.status(403).json({ error: 'Yetkisiz.' });
  next();
}

// FAVORİ TAKIM KATALOĞU — profildeki "Takımım" seçim ekranı için lig → takım
// listesi (kullanıcı isteği, 2026-08-04). 7 gün cache'li; mantık favoriteTeams.js.
app.get('/api/favorite-teams', async (req, res) => {
  try {
    res.json(await favoriTakimKatalogu());
  } catch (e) {
    console.warn('[favorite-teams] hata:', e.message);
    res.status(500).json({ error: 'Takım listesi alınamadı.' });
  }
});

// Elle yenileme (geliştirme için). Kimliksiz bırakılamaz: dış API
// kotamız (FootyStats/API-Football) üçüncü kişilerce tüketilebilirdi.
app.post('/api/refresh', yalnizIcErisim, async (req, res) => {
  try {
    // Tek doğruluk kaynağı: single-flight kilitli kontrollü yenileme.
    const r = await refreshCurrentBulletin({ trigger: 'manual-api' });
    if (!r.ok) return res.status(500).json({ ok: false, error: r.error });
    res.json({ ok: true, updatedAt: r.data?.updatedAt, matchedCount: r.data?.matchedCount });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// İÇ TEŞHİS UCU (korumalı): otomatik yenileme + sezon keşfi durumu.
// Müşteri ekranına teknik bilgi sızdırmadan operasyonel gözlem sağlar.
app.get('/api/internal/refresh-status', (req, res) => {
  const key = process.env.INTERNAL_API_KEY;
  const given = req.get('x-internal-key') || req.query.key;
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
  if (key ? given !== key : !local) return res.status(403).json({ error: 'Yetkisiz.' });
  res.json({
    autoRefresh: load('autoRefreshStatus')?.data ?? null,
    seasonDiscovery: load('seasonDiscovery')?.data?.meta ?? null,
    coverage: load('coverage')?.data ?? null,
    historyImport: load('historyImportStatus')?.data ?? null,
    playedObserve: load('playedObserveStatus')?.data ?? null,
    // Oran sağlayıcı çerçevesinin durumu. 27 Temmuz 2026'dan beri KAYITLI
    // SAĞLAYICI YOK → burada `no-provider` görünür. Bu uç yalnız teşhis
    // içindir; kullanıcı ekranına teknik bilgi sızmaz.
    marketOddsObserve: load('marketOddsObserveStatus')?.data ?? null,
  });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ————————————————————————————————————————————————————————————————
// YASAL SAYFALAR — Google Play zorunluluğu.
// Gizlilik politikası ve hesap silme sayfası, uygulama KURULMADAN da
// erişilebilir olmalıdır. Bu yüzden statik HTML olarak, web uygulamasının
// yönlendirmesine takılmadan (catch-all'dan ÖNCE) sunulur.
//
// Sayfalardaki {{DESTEK_EPOSTA}} yer tutucusu, .env içindeki SUPPORT_EMAIL
// ile doldurulur. Tanımlı değilse uydurma adres YAZILMAZ; kullanıcıya
// mağaza sayfasındaki iletişim adresine başvurması söylenir.
// ————————————————————————————————————————————————————————————————
const legalDir = path.join(__dirname, '..', 'legal');
const SUPPORT_EMAIL_FALLBACK = 'mağaza sayfasındaki iletişim adresi';

function serveLegal(file) {
  return (req, res) => {
    try {
      const html = fs
        .readFileSync(path.join(legalDir, file), 'utf8')
        .replaceAll('{{DESTEK_EPOSTA}}', process.env.SUPPORT_EMAIL || SUPPORT_EMAIL_FALLBACK);
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(html);
    } catch {
      res.status(500).send('Sayfa şu an açılamıyor. Lütfen daha sonra tekrar dene.');
    }
  };
}

app.get(['/gizlilik', '/privacy', '/gizlilik.html'], serveLegal('gizlilik.html'));
app.get(['/hesap-silme', '/delete-account', '/hesap-silme.html'], serveLegal('hesap-silme.html'));
// Topluluk Kuralları: Google Play'in kullanıcı içeriği şartlarından üçüncüsü —
// bildirimlere karşılık veren bir moderasyon SÜRECİNİN yazılı olması. Sayfa
// uygulama kurulmadan da açılabilmeli ki mağaza incelemesi doğrudan görebilsin.
app.get(
  ['/topluluk-kurallari', '/community-guidelines', '/topluluk-kurallari.html'],
  serveLegal('topluluk-kurallari.html'),
);
// Sorumlu oyun: yardım hattı (YEDAM 444 79 75) + "kazanç garantisi değildir"
// beyanı. Mağaza incelemesi ve kullanıcılar uygulama kurulmadan da açabilmeli.
app.get(
  ['/sorumlu-oyun', '/responsible-gaming', '/sorumlu-oyun.html'],
  serveLegal('sorumlu-oyun.html'),
);

// YÖNETİM PANELİ — tek dosya HTML, backend'in kendi sunucusundan.
// ---------------------------------------------------------------------------
// Sayfanın KENDİSİ herkese açıktır ve bu bilinçlidir: içinde hiçbir veri
// yoktur, yalnız bir giriş formu ve API çağıran bir betik vardır. Bütün
// koruma sunucu tarafında (`/api/admin` → operatorKapisi). Sayfayı gizlemek
// "belirsizlikle güvenlik" olurdu; gerçek kapı uçların önündedir.
//
// Arama motorlarına kapalı: sayfanın kendi <meta robots> etiketi + bu başlık.
const adminDir = path.join(__dirname, '..', 'admin');

// Panelin BETİĞİ ayrı dosyadır ve bu ŞARTTIR: CSP `script-src 'self'`
// (security/headers.js) satır içi <script> çalıştırmaz. İlk sürümde betik
// HTML'in içindeydi ve panel bu yüzden bomboş açıldı. CSP gevşetilmedi;
// betik dosyaya alındı.
app.get('/yonetim/panel.js', (req, res) => {
  try {
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    res.set('Cache-Control', 'no-store');
    res.send(fs.readFileSync(path.join(adminDir, 'panel.js'), 'utf8'));
  } catch {
    res.status(500).send('// panel betiği okunamadı');
  }
});

app.get(['/yonetim', '/yonetim/', '/admin'], (req, res) => {
  try {
    const html = fs.readFileSync(path.join(adminDir, 'index.html'), 'utf8');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Cache-Control', 'no-store');
    res.send(html);
  } catch {
    res.status(500).send('Yönetim paneli şu an açılamıyor.');
  }
});

// WEB ARAYÜZÜ: FLUTTER WEB DERLEMESİ (2026-08-11).
//
// TARİHÇE: burada eskiden Expo (react-native-web) derlemesi sunuluyordu; RN
// uygulaması emekliye ayrılınca blok kaldırıldı ve kök adres 404 vermeye
// başladı. Kullanıcı kök adresin ÇALIŞMASINI istedi → aynı yer artık GÜNCEL
// ürünü, yani Flutter'ın web derlemesini sunuyor.
//
// DERLEME NEREDE YAPILIR: Render'ın node ortamında Flutter SDK yok, bu yüzden
// çıktı depoya İŞLENİR (`backend/public/`, `flutter build web --release`).
// Yenileme: kök dizindeki `flutter-web-yayinla.bat`.
//
// API ADRESİ: Flutter web yayın derlemesi API_BASE verilmediğinde AYNI ORIGIN
// kullanır (resolveApiBase → ''), yani bu sunucunun kendi adresi. Ek ayar
// gerekmez, CORS sorunu çıkmaz.
const webDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(path.join(webDir, 'index.html'))) {
  app.use(express.static(webDir));
  // SPA geri dönüşü: /api ve /yonetim HARİÇ, UZANTISIZ yollar uygulamayı açar.
  //
  // UZANTI KONTROLÜ ŞART (2026-08-11): eskiden her yol index.html dönüyordu.
  // Sonuç: eski RN sürümünün tarayıcıda kayıtlı service worker'ı kendini
  // güncellemek için /sw.js isteyince HTML alıyor, güncelleme başarısız oluyor
  // ve ESKİ uygulama önbellekten sunulmaya devam ediyordu — kullanıcı yeni
  // sürümü hiç göremiyordu. Dosya gibi görünen yol (nokta içeren) artık 404
  // döner; tarayıcı da 404 alan service worker kaydını KENDİLİĞİNDEN siler.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/yonetim')) {
      return next();
    }
    if (path.extname(req.path)) return next(); // .js/.png/.json → 404
    res.sendFile(path.join(webDir, 'index.html'));
  });
}

// ——— ASENKRON HATA KORUMASI ———
// TÜM rotalar tanımlandıktan SONRA çalışmalı: sarmala() var olan katmanları
// gezer, sonradan eklenen bir rota kapsanmaz. Bu yüzden app.listen'in hemen
// üstünde duruyor.
//
// Neden: Express 4, async bir rota işleyicisinin fırlattığı hatayı yakalamaz;
// hata süreci sonlandırır. Ölçüldü: Supabase kapalıyken giriş bile
// gerektirmeyen GET /api/comments sunucunun tamamını düşürüyordu. Artık
// istek 500 alır, sunucu ayakta kalır.
sarmala(app);
app.use(hataKatmani);
surecAginiKur();

app.listen(config.port, async () => {
  console.log(`✅ Backend çalışıyor: http://localhost:${config.port}`);
  console.log(`   Uçlar: /api/health  /api/bulletin  /api/surprise-radar  /api/match/:no`);

  // ——— ŞEMA KAPISI ———
  // Veritabanı güncellemeleri yayın altyapısının parçasıdır: backend açılırken
  // backend/migrations altındaki dosyalar sırasıyla ve OTOMATİK uygulanır.
  // Kimsenin SQL kopyalaması, dosya seçmesi veya komut çalıştırması gerekmez.
  //
  // Bu kapı worker ve scheduler'ların ÜSTÜNDEDİR ve bilinçlidir: aşağıdaki
  // servislerin hepsi veritabanına YAZAR (arşiv worker'ı snapshot kilitler,
  // scheduler geçmiş bülten yazar, syncCatalog katalog upsert eder). Şema
  // hazır değilken bunları başlatmak, yarım bir şemaya veri yazmak demektir.
  //
  // HTTP sunucusu bilerek ayakta bırakılır: sorunun ne olduğu /api/health
  // üzerinden görülebilsin diye. Sessizce ölen bir süreç teşhis edilemez.
  let semaHazir = false;
  try {
    const sonuc = await acilistaMigrationCalistir();
    semaHazir = sonuc.ok;
  } catch (err) {
    // Beklenmedik bir hata bile sessiz kalmaz; kapı KAPALI sayılır.
    console.error('⛔ Migration açılış kontrolü beklenmedik şekilde başarısız:', err?.message || err);
    semaHazir = false;
  }

  if (!semaHazir) {
    console.error('⛔ Veritabanı şeması hazır değil — arka plan servisleri BAŞLATILMADI.');
    console.error('   (Sunucu, durumu /api/health üzerinden bildirmek için ayakta.)');
    return;
  }

  // OTOMATİK YENİLEME SERVİSİ — kullanıcı komutu gerekmez: açılışta bir kez
  // kontrollü refresh (cache boş/eski/güncel farketmez, resmî durumla hizalar),
  // sonra kontrollü aralıklarla; hata → üstel backoff; donmadan ~10 dk önce son
  // güvenli yenileme. Single-flight kilidiyle çifte refresh imkânsız. Test
  // ortamında otomatik BAŞLAMAZ; kapanışta timer'lar temizlenir.
  const autoRefresh = startAutoRefreshScheduler();

  // GEÇMİŞ ARŞİV + OYNANMA GÖZLEMİ: resmî geçmiş bültenler checkpoint'ten
  // kaldığı yerden sayfalı içe aktarılır (kaynağa yük binmez, güncel hafta
  // asla arşive girmez); etkin oynanma yüzdesi sağlayıcısı varsa aktif bülten
  // periyodik gözlemlenir + donmadan önce son gözlem alınır. Test ortamında
  // otomatik BAŞLAMAZ; kapanışta timer'lar temizlenir.
  const historySched = startHistoryAndObservationScheduler();
  const stopAll = () => { autoRefresh.stop(); historySched.stop(); };
  process.on('SIGTERM', stopAll);
  process.on('SIGINT', stopAll);

  // ARŞİV WORKER'I: ilk maçtan 5 dk önce otomatik snapshot kilidi + resmî sonuç
  // toplama + bülten tamamlama/değerlendirme. Sunucu freeze anında kapalıysa
  // açılışta ilk tick telafi eder. Mevcut refresh cron'unu BOZMAZ.
  startArchiveWorker();

  // BAŞARI/GÖREV KATALOĞU: kod → veritabanı eşitlemesi (idempotent upsert).
  // Migration 006 uygulanmadıysa kendini kapatır ve tek uyarı basar.
  // (oyunlaştırma kataloğu senkronu kaldırıldı — sistem söküldü, 2026-08-06)

});
