// KUPON SENKRON KİMLİK TESTLERİ — "hasToken her platformda yanlış" hatasının kanıtı.
//
// ESKİ HATA: coupon/store.js giriş kontrolünü localStorage'daki 'sportoto.token'
// anahtarından yapıyordu. Mobilde localStorage YOK; üretim web'inde belirteç
// HttpOnly çerezde (localStorage'a bilerek yazılmıyor). İkisinde de kontrol her
// zaman false dönüyor ve /api/coupons senkronu HİÇ tetiklenmiyordu — kuponlar
// yalnız cihazda kalıyordu. Doğru kaynak: session/tokenState (platformsuz).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setSession, clearSession, isAuthenticated } from '../src/session/tokenState.js';

const here = dirname(fileURLToPath(import.meta.url));

test('isAuthenticated: oturum yokken false', () => {
  clearSession();
  assert.equal(isAuthenticated(), false);
});

test('isAuthenticated: Bearer modunda (mobil/dev-web) belirteç varsa true', () => {
  clearSession();
  setSession({ token: 'jwt-ornek', cookieMode: false });
  assert.equal(isAuthenticated(), true, 'mobilde girişli kullanıcı artık görünür');
  clearSession();
  assert.equal(isAuthenticated(), false, 'çıkışta kapanır');
});

test('isAuthenticated: çerez modunda (üretim web) belirteç BELLEKTE YOK ama oturum kimliği girişin kanıtı', () => {
  clearSession();
  setSession({ token: null, sessionId: 'oturum-1', cookieMode: true });
  assert.equal(isAuthenticated(), true, 'üretim web: token null olsa da girişli');
  clearSession();
  assert.equal(isAuthenticated(), false, 'çerez modunda çıkış: sessionId temizlenince kapanır');
});

test('isAuthenticated: çerez modunda oturum kimliği yoksa girişsizdir', () => {
  clearSession();
  setSession({ token: null, sessionId: null, cookieMode: true });
  assert.equal(isAuthenticated(), false);
});

// KAYNAK SÖZLEŞMESİ: kupon deposu giriş kontrolünü tokenState'ten okumalı;
// localStorage tabanlı eski kontrol geri gelirse bu test kırılır.
test('coupon/store.js giriş kontrolü tokenState üzerinden yapılır (localStorage değil)', () => {
  const src = readFileSync(join(here, '..', 'src', 'coupon', 'store.js'), 'utf8');
  assert.match(src, /isAuthenticated.*from ['"]\.\.\/session\/tokenState['"]/,
    'store.js, session/tokenState.isAuthenticated import etmeli');
  assert.match(src, /function hasToken\(\)[\s\S]{0,200}isAuthenticated\(\)/,
    'hasToken() isAuthenticated() çağırmalı');
  assert.doesNotMatch(src, /localStorage\.getItem\(TOKEN_KEY\)/,
    'eski localStorage tabanlı giriş kontrolü geri gelmemeli');
});
