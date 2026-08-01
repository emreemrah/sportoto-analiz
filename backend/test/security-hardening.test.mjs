// GÜVENLİK SIKILAŞTIRMA TESTLERİ (T8) — başlıklar, CORS politikası,
// hata sızıntısı önleme, maliyetli uç sınırları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { securityHeaders } from '../src/security/headers.js';
import { buildCorsOptions, parseAllowedOrigins } from '../src/security/corsPolicy.js';
import { safeError } from '../src/security/safeError.js';
import { LIMIT_DEGERLERI, yalnizMetod } from '../src/security/limits.js';
import { makeRateLimiter, rateLimitMiddleware } from '../src/security/rateLimit.js';

const here = dirname(fileURLToPath(import.meta.url));

async function tekIstek(app, yol = '/', secenek = {}) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    return await fetch(`http://127.0.0.1:${server.address().port}${yol}`, secenek);
  } finally { server.close(); }
}

// ——— Başlıklar ———
test('güvenlik başlıkları her cevapta var; HSTS yalnız üretimde', async () => {
  const app = express();
  app.use(securityHeaders({ production: false }));
  app.get('/', (req, res) => res.json({ ok: true }));
  const r = await tekIstek(app);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.match(r.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.match(r.headers.get('content-security-policy') || '', /style-src 'self' 'unsafe-inline'/, 'RN-Web stilleri için şart');
  assert.equal(r.headers.get('strict-transport-security'), null, 'geliştirmede HSTS olmamalı (localhost bozulur)');

  const uretim = express();
  uretim.use(securityHeaders({ production: true }));
  uretim.get('/', (req, res) => res.json({ ok: true }));
  const r2 = await tekIstek(uretim);
  assert.match(r2.headers.get('strict-transport-security') || '', /max-age=/, 'üretimde HSTS zorunlu');
});

// ——— CORS ———
test('CORS: origin yoksa serbest, listede varsa serbest, yabancı origin reddedilir', async () => {
  const opts = buildCorsOptions({ allowedOrigins: ['https://izinli.com'], production: true });
  const sor = (origin) => new Promise((cozul) => opts.origin(origin, (hata, izin) => cozul(izin)));
  assert.equal(await sor(undefined), true, 'Origin başlıksız istek (mobil uygulama) serbest');
  assert.equal(await sor('https://izinli.com'), true, 'listedeki origin serbest');
  assert.equal(await sor('https://izinli.com/'), true, 'sondaki / normalize edilir');
  assert.equal(await sor('https://saldirgan.com'), false, 'yabancı origin reddedilir');
  assert.equal(await sor('http://localhost:8081'), false, 'ÜRETİMDE localhost bile serbest değil');
});

test('CORS: geliştirmede localhost/LAN serbest (Expo dev web çalışsın)', async () => {
  const opts = buildCorsOptions({ allowedOrigins: [], production: false });
  const sor = (origin) => new Promise((cozul) => opts.origin(origin, (hata, izin) => cozul(izin)));
  assert.equal(await sor('http://localhost:8081'), true);
  assert.equal(await sor('http://192.168.1.35:8081'), true);
  assert.equal(await sor('https://saldirgan.com'), false, 'geliştirmede bile yabancı origin serbest değil');
});

test('parseAllowedOrigins: boşluk ve sondaki / temizlenir', () => {
  assert.deepEqual(
    parseAllowedOrigins(' https://a.com/ , https://b.com ,, '),
    ['https://a.com', 'https://b.com'],
  );
});

// ——— safeError ———
test('safeError: istemciye jenerik mesaj, iç ayrıntı yalnız sunucu loguna', async () => {
  const yakalanan = [];
  const eskiError = console.error;
  console.error = (...a) => yakalanan.push(a.join(' '));
  try {
    const app = express();
    app.get('/', (req, res) => safeError(res, new Error('duplicate key violates constraint "comments_pkey"'), 'İşlem tamamlanamadı.'));
    const r = await tekIstek(app);
    const govde = await r.json();
    assert.equal(r.status, 500);
    assert.equal(govde.error, 'İşlem tamamlanamadı.');
    assert.ok(!JSON.stringify(govde).includes('comments_pkey'), 'iç şema adı istemciye sızmamalı');
    assert.ok(yakalanan.some((s) => s.includes('comments_pkey')), 'ayrıntı sunucu logunda olmalı');
  } finally { console.error = eskiError; }
});

test('rotalarda ham Supabase mesajı istemciye dönen kalıp kalmadı', () => {
  // Tipli KENDİ hatalarımız (NotFound/Validation/Immutable) bilerek public —
  // bu tarama yalnız ham "error: error.message" sızıntı kalıbını arar.
  const routesDir = join(here, '..', 'src', 'routes');
  for (const dosya of ['predictions.js', 'comments.js', 'moderation.js', 'users.js']) {
    const kaynak = readFileSync(join(routesDir, dosya), 'utf8');
    assert.ok(!/json\(\{ error: (error|e)\.message \}\)/.test(kaynak),
      `${dosya}: ham hata mesajı istemciye dönüyor — safeError kullanılmalı`);
  }
});

// ——— Maliyetli uç sınırları ———
test('sınır değerleri tarifle aynı: yorum 5/dk, kupon 10/dk, avatar 5/saat, backtest 2/dk', () => {
  assert.equal(LIMIT_DEGERLERI.yorumEkleme.limit, 5);
  assert.equal(LIMIT_DEGERLERI.kuponYazma.limit, 10);
  assert.equal(LIMIT_DEGERLERI.avatarYukleme.limit, 5);
  assert.equal(LIMIT_DEGERLERI.avatarYukleme.windowMs, 60 * 60 * 1000);
  assert.equal(LIMIT_DEGERLERI.backtest.limit, 2);
});

test('yalnizMetod: sınır yalnız yazma metodlarında; GET serbest kalır', async () => {
  let t = 0;
  const limiter = makeRateLimiter({ windowMs: 60_000, limit: 2, blockMs: 60_000, now: () => t });
  const app = express();
  app.use('/u', yalnizMetod('POST', rateLimitMiddleware(limiter)));
  app.get('/u', (req, res) => res.json({ ok: true }));
  app.post('/u', (req, res) => res.json({ ok: true }));

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (let i = 0; i < 5; i += 1) {
      const g = await fetch(`${base}/u`);
      assert.equal(g.status, 200, 'GET asla sınırlanmaz');
    }
    assert.equal((await fetch(`${base}/u`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${base}/u`, { method: 'POST' })).status, 200);
    const uc = await fetch(`${base}/u`, { method: 'POST' });
    assert.equal(uc.status, 429, 'limit aşımı 429 dönmeli');
    assert.ok(uc.headers.get('retry-after'), 'Retry-After başlığı olmalı');
  } finally { server.close(); }
});

test('server.js kabloları: başlıklar, listeli CORS ve dört sınır gerçekten bağlı', () => {
  const kaynak = readFileSync(join(here, '..', 'src', 'server.js'), 'utf8');
  assert.match(kaynak, /app\.use\(securityHeaders\(\)\)/, 'güvenlik başlıkları bağlı değil');
  assert.match(kaynak, /cors\(buildCorsOptions\(\)\)/, 'CORS hâlâ herkese açık');
  assert.ok(!/app\.use\(cors\(\)\)/.test(kaynak), 'eski açık cors() kalmış');
  for (const yol of ['/api/comments', '/api/coupons', '/api/users/me/avatar', '/api/analysis/backtest']) {
    assert.ok(kaynak.includes(`app.use('${yol}',`), `${yol} sınırı bağlı değil`);
  }
});
