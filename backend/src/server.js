// API SUNUCUSU
// Mobil uygulama SADECE buraya bağlanır; FootyStats anahtarı asla dışarı çıkmaz.
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { load, listSnapshotRounds } from './cache.js';
import { refreshAll, refreshLiveScores, snapshotRoundPredictions } from './refresh.js';
import { getRoundsForNav, getBulletinByRoundId, getRoundResult } from './sources/sportoto.js';
import { fetchLiveFixtures, findLiveFixture, fetchFixtureStatistics, fetchFixtureEvents, fetchFixturesByDate } from './sources/apifootball.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import commentRoutes from './routes/comments.js';
import predictionRoutes from './routes/predictions.js';
import couponRoutes from './routes/coupons.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' })); // avatar yüklemesi (dataURL) için yeterli

// Üyelik / profil / yorum sistemi (Supabase)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/coupons', couponRoutes);

// Sağlık kontrolü
app.get('/api/health', (req, res) => {
  const cached = load('bulletin');
  res.json({
    ok: true,
    hasData: !!cached,
    updatedAt: cached?.data?.updatedAt || null,
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

// Analizli bülten (ana ekran). Lig tablosu büyük; sadece maç detayında döner.
let lastLiveAt = 0;
app.get('/api/bulletin', async (req, res) => {
  if (!load('bulletin')) return res.status(503).json({ error: 'Veri henüz hazır değil, birkaç saniye sonra tekrar dene.' });
  // Canlı skorları tazele (en çok 45 sn'de bir; canlı maç yoksa erken döner, API'ye gitmez)
  if (Date.now() - lastLiveAt > 45000) {
    lastLiveAt = Date.now();
    try { await refreshLiveScores(); } catch (e) { console.warn('[live] güncelleme hatası:', e.message); }
  }
  const cached = load('bulletin');
  const data = cached.data;
  const matches = data.matches.map((m) => {
    if (!m.stats) return m;
    const { leagueTable, ...restStats } = m.stats;
    const home = restStats.home ? { ...restStats.home, squad: undefined } : restStats.home;
    const away = restStats.away ? { ...restStats.away, squad: undefined } : restStats.away;
    return { ...m, stats: { ...restStats, home, away } };
  });
  res.json({ ...data, matches });
});

// Sürpriz radarı (sıralı liste)
app.get('/api/surprise-radar', (req, res) => {
  const cached = load('bulletin');
  if (!cached) return res.status(503).json({ error: 'Veri henüz hazır değil.' });
  res.json({ updatedAt: cached.data.updatedAt, radar: cached.data.radar });
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
  res.json(base);
});

// Basit bellek-içi TTL cache — geçmiş/sonuç uçları sık gezilir ve resmi API'yi
// yormamak gerekir. Yayınlanmış geçmiş sonuçlar değişmez (uzun TTL).
const memCache = new Map(); // key -> { exp, val }
function cacheGet(key) {
  const e = memCache.get(key);
  if (e && e.exp > Date.now()) return e.val;
  if (e) memCache.delete(key);
  return null;
}
function cacheSet(key, val, ttlMs) {
  memCache.set(key, { exp: Date.now() + ttlMs, val });
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
const snapshotJobs = new Set(); // arka planda tahmin snapshot'ı üretilen round'lar
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
      const resolvedCount = bulletin.matches.filter((m) => m.result && m.score).length;
      payload = {
        ...bulletin, prize,
        source: 'Spor Toto',
        checkedAt: new Date().toISOString(),         // kontrol/kaynak zamanı
        resolvedCount,                               // kaç maçın RESMİ sonucu geldi
        fullyResolved: bulletin.matches.length > 0 && resolvedCount === bulletin.matches.length,
      };
      // Çözülmemiş hafta kısa TTL (sık kontrol); tam çözülmüş + ikramiye uzun TTL.
      cacheSet(key, payload, (payload.fullyResolved && prize) ? 24 * 60 * 60 * 1000 : 30 * 1000);
      if (fresh) histFreshAt.set(roundId, Date.now());
    }

    // Geçmiş hafta: kayıtlı SİSTEM TAHMİNİ + maç-öncesi donmuş kayıt/arma
    // (snapshot) + resmi sonuç YOKSA FootyStats'tan GEÇİCİ skor (rate-limitsiz,
    // her refresh'te tazelenir; resmi Spor Toto sonucu gelince o esas alınır).
    const snap = load(`snapshot-${roundId}`)?.data;
    if (snap?.picks?.length) {
      const byNo = new Map(snap.picks.map((p) => [p.no, p]));
      const footyScores = load('footyScores')?.data || {};
      payload = { ...payload, matches: payload.matches.map((m) => {
        const p = byNo.get(m.no);
        if (!p) return m;
        const merged = { ...m };
        if (p.symbol) merged.prediction = { symbol: p.symbol, label: p.label };
        if (p.homeLogo || p.homeRec) merged.home = { ...m.home, logo: p.homeLogo || m.home.logo, record: p.homeRec || null };
        if (p.awayLogo || p.awayRec) merged.away = { ...m.away, logo: p.awayLogo || m.away.logo, record: p.awayRec || null };
        // Resmi sonuç yoksa FootyStats geçici skoru (footyMatchId ile hizalı).
        const fs = (!(m.result && m.score) && p.footyMatchId != null) ? footyScores[p.footyMatchId] : null;
        if (fs && fs.score) {
          const score = p.footySwapped ? { home: fs.score.away, away: fs.score.home } : fs.score;
          merged.provisional = { score, live: fs.status === 'live', finished: fs.status === 'finished', source: 'gecici' };
        }
        return merged;
      }) };
    } else if (!snapshotJobs.has(roundId)) {
      // Snapshot yok → arka planda üret (bir kez). Sonraki yenilemede dolar.
      snapshotJobs.add(roundId);
      snapshotRoundPredictions(roundId).catch(() => {}).finally(() => snapshotJobs.delete(roundId));
    }

    res.json(payload);
  } catch (e) {
    res.status(502).json({ error: 'Geçmiş bülten bilgisi alınamadı.' });
  }
});

// SİSTEM KARNESİ — sistemin maç-öncesi tahminleri (snapshot) ile RESMİ Spor Toto
// sonuçlarını karşılaştırır. Sadece resmi sonucu gelen maçlar sayılır (canlı/geçici
// skor SAYILMAZ). Hatalar açık açık listelenir. 5 dk cache.
const expandPick = (sym) => String(sym || '').split('').map((c) => (c === '0' ? 'X' : c)).filter((c) => ['1', 'X', '2'].includes(c));
const pickHits = (sym, actual) => { const set = expandPick(sym); return (set.length && actual) ? set.includes(actual) : null; };
app.get('/api/system-scorecard', async (req, res) => {
  try {
    let sc = cacheGet('scorecard');
    if (!sc) {
      const rounds = listSnapshotRounds();
      // Resmi hafta adları (48. Hafta gibi) — nav listesinden (10 dk cache).
      let roundsNav = cacheGet('rounds');
      if (!roundsNav) { try { roundsNav = await getRoundsForNav(); cacheSet('rounds', roundsNav, 10 * 60 * 1000); } catch { roundsNav = { rounds: [] }; } }
      const nameMap = new Map((roundsNav.rounds || []).map((r) => [r.id, r.name]));
      let total = 0, correct = 0, wrong = 0, single = 0, singleCorrect = 0;
      const byResult = { '1': { t: 0, c: 0 }, X: { t: 0, c: 0 }, '2': { t: 0, c: 0 } };
      const weeks = [];
      const errors = [];
      let weeksCounted = 0;
      for (const roundId of rounds) {
        const snap = load(`snapshot-${roundId}`)?.data;
        if (!snap?.picks?.length) continue;
        let bulletin;
        try { bulletin = await getBulletinByRoundId(roundId); } catch { continue; }
        const roundName = nameMap.get(roundId) || snap.round || `#${roundId}`;
        const byNo = new Map(snap.picks.map((p) => [p.no, p]));
        let wT = 0, wC = 0, wS = 0, wSC = 0;
        const wRes = { '1': { t: 0, c: 0 }, X: { t: 0, c: 0 }, '2': { t: 0, c: 0 } };
        for (const m of bulletin.matches) {
          if (!(m.result && m.score)) continue;               // yalnız RESMİ sonuç
          const sym = byNo.get(m.no)?.symbol;
          const hit = pickHits(sym, m.result);
          if (hit == null) continue;                           // tahmin yok
          total += 1; wT += 1;
          if (byResult[m.result]) { byResult[m.result].t += 1; wRes[m.result].t += 1; }
          const isSingle = expandPick(sym).length === 1;
          if (isSingle) { single += 1; wS += 1; }
          if (hit) {
            correct += 1; wC += 1;
            if (byResult[m.result]) { byResult[m.result].c += 1; wRes[m.result].c += 1; }
            if (isSingle) { singleCorrect += 1; wSC += 1; }
          } else {
            wrong += 1;
            errors.push({ roundId, round: roundName, no: m.no, home: m.home.name, away: m.away.name, system: sym, result: m.result, score: `${m.score.home}-${m.score.away}` });
          }
        }
        if (wT > 0) { weeks.push({ roundId, round: roundName, total: wT, correct: wC, wrong: wT - wC, accuracy: Math.round(wC / wT * 100), byResult: wRes, single: wS, singleCorrect: wSC }); weeksCounted += 1; }
      }
      const rate = (c, t) => (t ? Math.round(c / t * 100) : 0);
      sc = {
        generatedAt: new Date().toISOString(),
        source: 'Resmi Spor Toto sonuçları',
        hasData: total > 0,
        weeksCounted, total, correct, wrong,
        accuracy: rate(correct, total),
        single, singleCorrect, singleAccuracy: rate(singleCorrect, single),
        byResult: {
          '1': { ...byResult['1'], rate: rate(byResult['1'].c, byResult['1'].t) },
          X: { ...byResult.X, rate: rate(byResult.X.c, byResult.X.t) },
          '2': { ...byResult['2'], rate: rate(byResult['2'].c, byResult['2'].t) },
        },
        weeks: weeks.sort((a, b) => b.roundId - a.roundId),
        errors: errors.slice(0, 60),
      };
      cacheSet('scorecard', sc, 5 * 60 * 1000);
    }
    res.json(sc);
  } catch (e) {
    res.status(500).json({ error: 'Karne hesaplanamadı.' });
  }
});

// Elle yenileme (geliştirme için)
app.post('/api/refresh', async (req, res) => {
  try {
    const data = await refreshAll();
    res.json({ ok: true, updatedAt: data.updatedAt, matchedCount: data.matchedCount });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Üretim (Render): derlenmiş web uygulaması varsa onu da aynı sunucudan servis et.
// Geliştirmede public/ olmadığı için bu blok atlanır, normal akış bozulmaz.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(path.join(webDir, 'index.html'))) {
  app.use(express.static(webDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(webDir, 'index.html'));
  });
}

app.listen(config.port, () => {
  console.log(`✅ Backend çalışıyor: http://localhost:${config.port}`);
  console.log(`   Uçlar: /api/health  /api/bulletin  /api/surprise-radar  /api/match/:no`);

  // Açılışta veri yoksa bir kez yenile
  if (!load('bulletin')) {
    console.log('   Cache boş, ilk veri çekiliyor…');
    refreshAll().catch((e) => console.error('İlk yenileme hatası:', e.message));
  }

  // Belirli aralıkla otomatik yenile (limiti korur)
  const everyN = Math.max(1, config.refreshHours);
  cron.schedule(`0 */${everyN} * * *`, () => {
    console.log('[cron] zamanlanmış yenileme…');
    refreshAll().catch((e) => console.error('[cron] hata:', e.message));
  });
});
