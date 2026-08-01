// BULLETINHEROVISUAL DERLEME/YAPI TESTLERİ
// Metro'yu durduran hata sınıfı: SVG <G>'nin Animated.createAnimatedComponent
// ile sarılıp animated prop almasıydı (web'de setNativeProps yok). Bu test:
// 1) dosyanın Expo babel preset'iyle GERÇEKTEN derlendiğini (JSX parse dahil),
// 2) kırılgan kalıbın geri gelmediğini,
// 3) boardOpacity/fillOpacity animasyonlarının korunduğunu doğrular.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const srcPath = new URL('../src/components/BulletinHeroVisual.js', import.meta.url).pathname;
const src = readFileSync(srcPath, 'utf8');

test('1. BulletinHeroVisual Expo babel preset ile hatasız derlenir (JSX dengeli)', () => {
  const out = babel.transformSync(src, {
    filename: 'BulletinHeroVisual.js',
    presets: [require('babel-preset-expo')],
    babelrc: false, configFile: false,
  });
  assert.ok(out?.code?.length > 1000, 'derleme çıktı üretti');
  assert.ok(!out.code.includes('SyntaxError'));
});

test('2. kırılgan kalıp geri gelmedi: SVG G animated sarmalanmıyor', () => {
  assert.ok(!/createAnimatedComponent\(\s*G\s*\)/.test(src), 'AnimatedG üretimi yok');
  assert.ok(!/<AnimatedG[\s>]/.test(src), 'AnimatedG JSX kullanımı yok');
  assert.ok(!/<Animated\s+opacity/.test(src), 'Animated namespace doğrudan render edilmiyor');
});

test('3. animasyonlar korunuyor: boardOpacity + fillOpacity + kalem konumu', () => {
  assert.ok(src.includes('boardOpacity'), 'tahta silme animasyonu duruyor');
  assert.ok(src.includes('fillOpacity'), 'zemin dolum animasyonu duruyor');
  assert.ok(src.includes('strokeDashoffset'), 'çizim (dash) animasyonları duruyor');
  assert.ok(/opacity:\s*boardOpacity/.test(src), 'tahta solması style tabanlı Animated.View ile');
  assert.ok(/translateX:\s*penX/.test(src) && /translateY:\s*penY/.test(src), 'kalem konumu style transform ile');
  // Görseller silinmedi: saha, X, O, pas okları, kalem yerinde.
  for (const marker of ['M 15 35 L 37 35', 'M 54 47 C 68 38', 'M 104 58 C 110 48', 'Polygon points="0,0 7,-2.5 2.5,-7"']) {
    assert.ok(src.includes(marker), `görsel korunur: ${marker.slice(0, 18)}…`);
  }
});
