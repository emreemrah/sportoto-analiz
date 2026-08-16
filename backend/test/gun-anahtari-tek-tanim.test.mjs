// GÜN ANAHTARI TEK TANIM.
//
// KOD DENETİMİNDE BULUNDU (16 Ağustos 2026): `dayKeyOf` ve
// `istanbulTimeToUtcMs` hem `radar/dailyOdds.js` hem `radar/playedDnaArchive.js`
// içinde AYRI AYRI tanımlıydı. Yazımları farklıydı (biri `istanbulParts`,
// diğeri doğrudan UTC getter'ları).
//
// ÖLÇÜM: 20.000 örnekle, iki yılı aşan aralıkta tarandı — SIFIR fark. Yani
// aktif bir hata YOKTU, eşdeğerdiler.
//
// Yine de birleştirildi çünkü ikisi de MÜHÜRLEME gün anahtarı üretiyor
// (Radar 3 oynanma DNA'sı · Radar 4 oran takibi). Biri değişirse iki radar
// gözlemleri farklı günlere yazar, mühürler sessizce ayrışır ve kıyas bozulur
// — kimse hata görmez. Eşdeğerlik kanıta değil YAPIYA bağlanmalı.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { dayKeyOf, istanbulTimeToUtcMs, TR_OFFSET_MS } from '../src/time/turkiyeSaati.js';

function tumDosyalar(dizin, sonuc = []) {
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) tumDosyalar(yol, sonuc);
    else if (yol.endsWith('.js')) sonuc.push(yol);
  }
  return sonuc;
}

test('gün anahtarı yardımcıları YALNIZ bir yerde tanımlı', () => {
  const sayac = { dayKeyOf: 0, istanbulTimeToUtcMs: 0 };
  for (const f of tumDosyalar('src')) {
    const src = readFileSync(f, 'utf8');
    for (const ad of Object.keys(sayac)) {
      sayac[ad] += (src.match(new RegExp(`function ${ad}\\(`, 'g')) || []).length;
    }
  }
  assert.equal(sayac.dayKeyOf, 1, 'dayKeyOf birden fazla yerde tanımlı');
  assert.equal(sayac.istanbulTimeToUtcMs, 1, 'istanbulTimeToUtcMs birden fazla yerde tanımlı');
});

test('gün anahtarı Türkiye gününü verir (UTC gününü DEĞİL)', () => {
  // 21:30 UTC = ertesi gün 00:30 TSİ → gün anahtarı ERTESİ gün olmalı.
  assert.equal(dayKeyOf(Date.parse('2026-08-21T21:30:00Z')), '2026-08-22');
  // 20:59 UTC = 23:59 TSİ → aynı gün.
  assert.equal(dayKeyOf(Date.parse('2026-08-21T20:59:00Z')), '2026-08-21');
});

test('gün anahtarı + saat, UTC ms\'ye doğru çevrilir', () => {
  // 23:55 TSİ = 20:55 UTC (Türkiye kalıcı UTC+3).
  assert.equal(
    istanbulTimeToUtcMs('2026-08-21', 23, 55),
    Date.parse('2026-08-21T20:55:00Z'),
  );
  // Gidiş-dönüş tutarlı olmalı.
  const ms = istanbulTimeToUtcMs('2026-03-15', 12, 0);
  assert.equal(dayKeyOf(ms), '2026-03-15');
});

test('ofset sabiti Türkiye kalıcı UTC+3', () => {
  assert.equal(TR_OFFSET_MS, 3 * 3600e3);
});
