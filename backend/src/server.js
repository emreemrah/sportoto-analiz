// API SUNUCUSU
// Mobil uygulama SADECE buraya bağlanır; FootyStats anahtarı asla dışarı çıkmaz.
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { load } from './cache.js';
import { refreshAll } from './refresh.js';
import { getRoundsForNav, getBulletinByRoundId, getRoundResult } from './sources/sportoto.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import commentRoutes from './routes/comments.js';
import predictionRoutes from './routes/predictions.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' })); // avatar yüklemesi (dataURL) için yeterli

// Üyelik / profil / yorum sistemi (Supabase)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/predictions', predictionRoutes);

// Sağlık kontrolü
app.get('/api/health', (req, res) => {
  const cached = load('bulletin');
  res.json({
    ok: true,
    hasData: !!cached,
    updatedAt: cached?.data?.updatedAt || null,
  });
});

// Analizli bülten (ana ekran). Lig tablosu büyük; sadece maç detayında döner.
app.get('/api/bulletin', (req, res) => {
  const cached = load('bulletin');
  if (!cached) return res.status(503).json({ error: 'Veri henüz hazır değil, birkaç saniye sonra tekrar dene.' });
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
  res.json(match);
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
app.get('/api/history/:roundId', async (req, res) => {
  try {
    const roundId = Number(req.params.roundId);
    if (!roundId) return res.status(400).json({ error: 'Geçersiz hafta.' });
    const key = `hist:${roundId}`;
    let payload = cacheGet(key);
    if (!payload) {
      const [bulletin, prize] = await Promise.all([
        getBulletinByRoundId(roundId),
        getRoundResult(roundId),
      ]);
      payload = { ...bulletin, prize };
      cacheSet(key, payload, prize ? 24 * 60 * 60 * 1000 : 3 * 60 * 1000);
    }
    res.json(payload);
  } catch (e) {
    res.status(502).json({ error: 'Geçmiş bülten bilgisi alınamadı.' });
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
