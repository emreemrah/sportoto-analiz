// BİYOMETRİK KİLİT POLİTİKASI TESTLERİ — saf modül (cihaz API'si yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canOfferBiometrics, shouldLockOnLaunch, afterFailure, outcomeFromResult,
  FAILURE_EMPHASIS_THRESHOLD,
} from '../src/security/bioLockPolicy.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src');

test('biyometri: web ve donanımsız/kayıtsız cihazlarda SUNULMAZ', () => {
  assert.equal(canOfferBiometrics({ platform: 'web', hasHardware: true, enrolled: true }), false);
  assert.equal(canOfferBiometrics({ platform: 'android', hasHardware: false, enrolled: true }), false);
  assert.equal(canOfferBiometrics({ platform: 'android', hasHardware: true, enrolled: false }), false);
  assert.equal(canOfferBiometrics({ platform: 'android', hasHardware: true, enrolled: true }), true);
  assert.equal(canOfferBiometrics({ platform: 'ios', hasHardware: true, enrolled: true }), true);
});

test('kilit: yalnız girişli + tercih açık + destekli üçlüsünde devreye girer', () => {
  assert.equal(shouldLockOnLaunch({ loggedIn: true, enabled: true, supported: true }), true);
  assert.equal(shouldLockOnLaunch({ loggedIn: false, enabled: true, supported: true }), false, 'girişsiz kullanıcıya kilit yok');
  assert.equal(shouldLockOnLaunch({ loggedIn: true, enabled: false, supported: true }), false, 'kullanıcı açmadıysa kilit yok');
  assert.equal(shouldLockOnLaunch({ loggedIn: true, enabled: true, supported: false }), false, 'desteksiz cihazda kilit yok');
});

test('kilit: başarısızlıkta deneme hakkı sürer, şifre alternatifi öne çıkar', () => {
  assert.deepEqual(afterFailure(0), { allowRetry: true, emphasizePasswordFallback: false });
  const r = afterFailure(FAILURE_EMPHASIS_THRESHOLD);
  assert.equal(r.allowRetry, true, 'deneme hakkı hiçbir zaman kapanmaz');
  assert.equal(r.emphasizePasswordFallback, true, 'eşikte şifre alternatifi vurgulanır');
});

test('kilit: yalnız success=true açar; vazgeçme/eşleşmeme kilidi SÜRDÜRÜR', () => {
  assert.equal(outcomeFromResult({ success: true }), 'unlocked');
  assert.equal(outcomeFromResult({ success: false, error: 'user_cancel' }), 'locked');
  assert.equal(outcomeFromResult(null), 'locked');
  assert.equal(outcomeFromResult(undefined), 'locked');
});

// Kaynak güvencesi: biyometrik VERİ hiçbir yerde saklanmaz/taşınmaz.
test('kaynak: biyometrik modüller veri kaydetmez, yalnız sonuç kullanır', () => {
  const wrapper = fs.readFileSync(path.join(SRC, 'security', 'biometricLock.js'), 'utf8');
  // Sarmalayıcı yalnız tercih bayrağını ('1') yazar; başka hiçbir setItem yok.
  const writes = [...wrapper.matchAll(/setItemAsync\s*\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(writes, ["KEY_BIOLOCK, '1'"], 'yalnız aç/kapat bayrağı yazılabilir');
  assert.ok(!/fetch|axios|API_BASE/.test(wrapper), 'biyometrik modül ağa hiçbir şey göndermez');
  const screen = fs.readFileSync(path.join(SRC, 'screens', 'BiometricLockScreen.js'), 'utf8');
  assert.ok(!/setItem|localStorage/.test(screen), 'kilit ekranı hiçbir şey depolamaz');
});

// Açılış entegrasyonu: App.js kilidi doğru bağlamış mı?
test('kaynak: App.js kilidi girişli kullanıcı için açılışta kontrol eder', () => {
  const app = fs.readFileSync(path.resolve(HERE, '..', 'App.js'), 'utf8');
  assert.ok(app.includes('needsLockOnLaunch(!!getToken())'), 'kilit kontrolü açılışta olmalı');
  assert.ok(app.includes('BiometricLockScreen'), 'kilit ekranı bağlanmalı');
});
