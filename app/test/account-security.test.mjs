// HESAP GÜVENLİĞİ (istemci tarafı) TESTLERİ — saf modüller üzerinden:
//   • Şifre gücü göstergesi dürüst ve tutarlı puanlar.
//   • Bellek içi oturum durumu: başlıklar doğru kurulur, çerez modunda
//     Bearer başlığı GÖNDERİLMEZ (belirteç JS'e hiç çıkmaz).
//   • Şifre hiçbir modülde saklanmaz (kaynak taraması).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { passwordStrength, MIN_PASSWORD_LENGTH } from '../src/security/passwordStrength.js';
import {
  setSession, clearSession, authHeaders, getAccessToken, getSessionId, isCookieMode,
} from '../src/session/tokenState.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src');

// ---------------------------------------------------------------------------
// Şifre gücü
// ---------------------------------------------------------------------------
test('şifre gücü: kısa şifre asla "ok" olamaz', () => {
  const r = passwordStrength('kisa');
  assert.equal(r.ok, false);
  assert.ok(r.score <= 1);
  assert.ok(r.hints.some((h) => h.includes(String(MIN_PASSWORD_LENGTH))));
});

test('şifre gücü: yaygın şifre uzun olsa bile zayıf sayılır', () => {
  const r = passwordStrength('12345678');
  assert.ok(r.score <= 1, '12345678 zayıf olmalı');
  assert.ok(r.hints.some((h) => /yaygın/i.test(h)));
});

test('şifre gücü: uzunluk ve çeşitlilik arttıkça puan artar', () => {
  const zayif = passwordStrength('aaaaaaaa');
  const orta = passwordStrength('futbolAnaliz');
  const guclu = passwordStrength('Uzun-Cumle_2026!analiz');
  assert.ok(zayif.score < orta.score, 'tek karakter tekrarı < karışık harf');
  assert.ok(orta.score <= guclu.score);
  assert.equal(guclu.label, 'Güçlü');
  assert.equal(guclu.ok, true);
});

test('şifre gücü: Türkçe karakterler çeşitlilik sayımına girer', () => {
  const r = passwordStrength('Çilekli-Pasta_41');
  assert.equal(r.ok, true);
  assert.ok(r.score >= 3);
});

// ---------------------------------------------------------------------------
// Oturum durumu ve istek başlıkları
// ---------------------------------------------------------------------------
test('oturum durumu: bearer modunda Authorization + X-Session-Id kurulur', () => {
  clearSession();
  setSession({ token: 'jwt-abc', refreshToken: 'rt-1', sessionId: 'ses-1', cookieMode: false });
  const h = authHeaders();
  assert.equal(h.Authorization, 'Bearer jwt-abc');
  assert.equal(h['X-Session-Id'], 'ses-1');
  assert.equal(getAccessToken(), 'jwt-abc');
  assert.equal(getSessionId(), 'ses-1');
});

test('oturum durumu: ÇEREZ modunda Authorization başlığı GÖNDERİLMEZ', () => {
  clearSession();
  setSession({ token: null, refreshToken: null, sessionId: 'ses-2', cookieMode: true });
  const h = authHeaders();
  assert.equal(h.Authorization, undefined, 'çerez modunda Bearer olmaz (belirteç JS elinde değil)');
  assert.equal(h['X-Session-Id'], 'ses-2', 'CSRF çift-anahtarı her zaman gider');
  assert.equal(isCookieMode(), true);
});

test('oturum durumu: temizleme her şeyi sıfırlar', () => {
  setSession({ token: 't', refreshToken: 'r', sessionId: 's' });
  clearSession();
  assert.equal(getAccessToken(), null);
  assert.equal(getSessionId(), null);
  assert.deepEqual({ ...authHeaders() }, {});
});

// ---------------------------------------------------------------------------
// Kaynak taraması: şifre asla kalıcı depoya yazılmaz
// ---------------------------------------------------------------------------
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

test('kaynak: hiçbir modül şifreyi kalıcı depoya yazmaz', () => {
  const suspects = [];
  for (const f of walk(SRC)) {
    const src = fs.readFileSync(f, 'utf8');
    // localStorage/AsyncStorage/SecureStore'a "password" içeren bir değer yazımı aranır.
    for (const m of src.matchAll(/(setItem(?:Async)?)\s*\(\s*([^)]*)\)/g)) {
      if (/password|sifre|şifre/i.test(m[2])) suspects.push(`${path.relative(SRC, f)}: ${m[0].slice(0, 80)}`);
    }
  }
  assert.deepEqual(suspects, [], `şifre kalıcı depoya yazılamaz:\n${suspects.join('\n')}`);
});

test('kaynak: belirteç deposu anahtar adları korunuyor (yetim veri olmaz)', () => {
  const src = fs.readFileSync(path.join(SRC, 'session', 'tokenStore.js'), 'utf8');
  assert.ok(src.includes("'sportoto.token'"), 'sportoto.token adı DEĞİŞTİRİLEMEZ');
  assert.ok(/AsyncStorage\.getItem\(KEY_TOKEN\)/.test(src), 'eski depodan tek seferlik göç okunmalı');
  assert.ok(/AsyncStorage\.removeItem\(KEY_TOKEN\)/.test(src), 'göçten sonra düz metin kopya silinmeli');
});
