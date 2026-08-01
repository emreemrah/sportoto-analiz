// GÜVENLİK KATMANI TESTLERİ — oran sınırlama, güvenlik logu süzgeci, oturum
// yaşam döngüsü (aç/doğrula/uzaktan kapat/topluca kapat/süre aşımı) ve çerez
// ayrıştırma. Ağ yok; sahte Supabase ile deterministik.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRateLimiter } from '../src/security/rateLimit.js';
import { sanitizeMeta, maskEmail } from '../src/security/securityLog.js';
import {
  createSession, verifySession, revokeSession, revokeAllSessions, listSessions,
  SESSION_IDLE_MAX_MS, _resetAvailability,
} from '../src/security/sessionService.js';
import { parseCookies } from '../src/mw.js';
import { makeFakeSb } from './helpers/fakeSupabase.mjs';

// ---------------------------------------------------------------------------
// Oran sınırlama
// ---------------------------------------------------------------------------
test('oran sınırlama: limit aşılınca geçici engel, süre bitince açılır', () => {
  let t = 0;
  const rl = makeRateLimiter({ windowMs: 1000, limit: 3, blockMs: 5000, now: () => t });
  assert.equal(rl.hit('ip1').blocked, false);
  assert.equal(rl.hit('ip1').blocked, false);
  assert.equal(rl.hit('ip1').blocked, false);
  const r4 = rl.hit('ip1');
  assert.equal(r4.blocked, true, '4. deneme engellenmeli');
  assert.ok(r4.retryAfterSec > 0);
  t = 4999;
  assert.equal(rl.hit('ip1').blocked, true, 'engel süresi dolmadan açılmamalı');
  t = 5001;
  assert.equal(rl.hit('ip1').blocked, false, 'engel süresi bitince açılmalı');
});

test('oran sınırlama: anahtarlar birbirinden bağımsız, clear sayacı sıfırlar', () => {
  let t = 0;
  const rl = makeRateLimiter({ windowMs: 1000, limit: 2, blockMs: 1000, now: () => t });
  rl.hit('a'); rl.hit('a');
  assert.equal(rl.hit('b').blocked, false, 'başka anahtar etkilenmez');
  rl.clear('a');
  assert.equal(rl.hit('a').blocked, false, 'clear sonrası sayaç sıfır');
});

// ---------------------------------------------------------------------------
// Güvenlik logu — hassas veri süzgeci
// ---------------------------------------------------------------------------
test('güvenlik logu: şifre/token meta alanına ASLA giremez', () => {
  const out = sanitizeMeta({
    password: 'gizli123', token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx',
    refreshToken: 'rt-secret', sessionId: 'ses-1', reason: 'test',
  });
  assert.deepEqual(Object.keys(out).sort(), ['reason', 'sessionId']);
  const s = JSON.stringify(out);
  assert.ok(!s.includes('gizli123') && !s.includes('eyJ') && !s.includes('rt-secret'));
});

test('güvenlik logu: beyaz listedeki alan bile JWT görünümlü değeri taşıyamaz', () => {
  const out = sanitizeMeta({ reason: 'eyJhbGciOiJIUzI1NiJ9.sahte-jwt-degeri' });
  assert.equal(out, null, 'JWT görünümlü değer süzülmeli');
});

test('maskEmail tam adresi göstermez', () => {
  assert.equal(maskEmail('ali@ornek.com'), 'a***@ornek.com');
  assert.equal(maskEmail(''), '***');
});

// ---------------------------------------------------------------------------
// Oturum yaşam döngüsü
// ---------------------------------------------------------------------------
function freshSb(opts) { _resetAvailability(); return makeFakeSb(opts); }

test('oturum: aç → doğrula → uzaktan kapat → doğrulama reddedilir', async () => {
  const sb = freshSb();
  const sid = await createSession(sb, {
    userId: 'u1', clientDeviceId: 'dev-1', deviceName: 'Android', platform: 'android',
    req: { ip: '1.2.3.4', headers: { 'user-agent': 'test' } },
  });
  assert.ok(sid, 'oturum kimliği dönmeli');
  assert.equal((await verifySession(sb, { userId: 'u1', sessionId: sid })).ok, true);

  // Başkasının oturumu iptal EDİLEMEZ.
  assert.equal(await revokeSession(sb, { userId: 'saldirgan', sessionId: sid }), false);
  assert.equal((await verifySession(sb, { userId: 'u1', sessionId: sid })).ok, true, 'hâlâ etkin olmalı');

  // Sahibi kapatınca doğrulama reddedilir.
  assert.equal(await revokeSession(sb, { userId: 'u1', sessionId: sid, reason: 'remote' }), true);
  const v = await verifySession(sb, { userId: 'u1', sessionId: sid });
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'oturum-kapatılmış');
});

test('oturum: başka kullanıcının oturum kimliğiyle istek reddedilir', async () => {
  const sb = freshSb();
  const sid = await createSession(sb, { userId: 'u1', clientDeviceId: 'd', deviceName: 'X', platform: 'web', req: null });
  const v = await verifySession(sb, { userId: 'u2', sessionId: sid });
  assert.equal(v.ok, false, 'oturum sahibinden başkası kullanamaz');
});

test('oturum: uzun süre kullanılmayan oturum kendiliğinden düşer', async () => {
  const sb = freshSb();
  const sid = await createSession(sb, { userId: 'u1', clientDeviceId: 'd', deviceName: 'X', platform: 'web', req: null });
  const row = sb._rowsOf('sessions').find((s) => s.id === sid);
  row.last_seen_at = new Date(Date.now() - SESSION_IDLE_MAX_MS - 1000).toISOString();
  const v = await verifySession(sb, { userId: 'u1', sessionId: sid });
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'oturum-süresi-doldu');
});

test('oturum: topluca kapatma mevcut cihazı koruyabilir (şifre değişimi)', async () => {
  const sb = freshSb();
  const req = null;
  const s1 = await createSession(sb, { userId: 'u1', clientDeviceId: 'd1', deviceName: 'A', platform: 'android', req });
  const s2 = await createSession(sb, { userId: 'u1', clientDeviceId: 'd2', deviceName: 'B', platform: 'web', req });
  const s3 = await createSession(sb, { userId: 'u1', clientDeviceId: 'd3', deviceName: 'C', platform: 'ios', req });
  const closed = await revokeAllSessions(sb, { userId: 'u1', exceptSessionId: s1, reason: 'password_change' });
  assert.equal(closed, 2, 'diğer iki oturum kapanmalı');
  assert.equal((await verifySession(sb, { userId: 'u1', sessionId: s1 })).ok, true, 'mevcut cihaz açık kalır');
  assert.equal((await verifySession(sb, { userId: 'u1', sessionId: s2 })).ok, false);
  assert.equal((await verifySession(sb, { userId: 'u1', sessionId: s3 })).ok, false);
});

test('oturum: liste yalnız etkin oturumları, cihaz bilgisiyle döner', async () => {
  const sb = freshSb();
  const s1 = await createSession(sb, { userId: 'u1', clientDeviceId: 'd1', deviceName: 'Android', platform: 'android', req: null });
  const s2 = await createSession(sb, { userId: 'u1', clientDeviceId: 'd2', deviceName: 'Web', platform: 'web', req: null });
  await createSession(sb, { userId: 'BAŞKASI', clientDeviceId: 'd9', deviceName: 'Yabancı', platform: 'web', req: null });
  await revokeSession(sb, { userId: 'u1', sessionId: s2 });
  const out = await listSessions(sb, { userId: 'u1', currentSessionId: s1 });
  assert.equal(out.degraded, false);
  assert.equal(out.sessions.length, 1, 'kapatılan ve başkasına ait oturum listelenmez');
  assert.equal(out.sessions[0].id, s1);
  assert.equal(out.sessions[0].current, true);
});

test('oturum: migration 006 yoksa güvenli düşüş (uygulama kilitlenmez)', async () => {
  const sb = freshSb({ missing: ['sessions', 'devices'] });
  const sid = await createSession(sb, { userId: 'u1', clientDeviceId: 'd', deviceName: 'X', platform: 'web', req: null });
  assert.equal(sid, null, 'tablo yokken oturum satırı açılamaz');
  const v = await verifySession(sb, { userId: 'u1', sessionId: 'her-neyse' });
  assert.equal(v.ok, true, 'tablo yokken kullanıcı DIŞARI ATILMAZ');
  assert.equal(v.degraded, true, 'ama düşüş modu açıkça işaretlenir');
});

// ---------------------------------------------------------------------------
// Çerez ayrıştırma (web üretimi: HttpOnly çerezler)
// ---------------------------------------------------------------------------
test('parseCookies: başlığı doğru ayrıştırır', () => {
  const req = { headers: { cookie: 'sportoto_at=abc%3D%3D; sportoto_rt=r1; x=y' } };
  const c = parseCookies(req);
  assert.equal(c.sportoto_at, 'abc==');
  assert.equal(c.sportoto_rt, 'r1');
  assert.deepEqual(parseCookies({ headers: {} }), {});
});
