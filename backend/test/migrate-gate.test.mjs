// ---------------------------------------------------------------------------
// AÇILIŞ KAPISI — karar tablosunun kendisi test edilir.
// ---------------------------------------------------------------------------
// Bu dosya veritabanı İSTEMEZ: yalnız "hangi durumda backend iş yapar, hangi
// durumda yapmaz" kararını ölçer. Kapının kendisi yanlışsa, motorun geri
// kalanının doğru olması bir şey ifade etmez.
//
// Bu testler bir hatadan doğdu: dokümanlar "bağlantı yoksa worker'lar BAŞLAMAZ"
// diyordu, kod ise geliştirme/üretim ayrımı yapmadan çalışmaya devam ediyordu.
// Cihazda backend açılıp log okununca görüldü. Artık kural testle sabitlendi.

import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { acilistaMigrationCalistir } from '../src/migrate/index.js';

const sessiz = () => {};

/** Migration'ın ASLA çalıştırılmaması gereken durumlarda bile klasör verilir;
 *  motor oraya hiç gitmemelidir. */
const KLASOR = fileURLToPath(new URL('./fixtures/bos-migration/', import.meta.url));

test('NODE_ENV=test → kapı açık, hiçbir şey uygulanmaz (testler kendi şemasını kurar)', async () => {
  const s = await acilistaMigrationCalistir({
    env: { NODE_ENV: 'test', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'k' },
    log: sessiz,
    klasor: KLASOR,
  });
  assert.equal(s.ok, true);
  assert.equal(s.durum, 'test-atlandi');
  assert.deepEqual(s.uygulanan, []);
});

test('Supabase YOK + bağlantı YOK → dosya modu; kapı açık, migration gerekmiyor', async () => {
  const s = await acilistaMigrationCalistir({
    env: {},
    log: sessiz,
    klasor: KLASOR,
  });
  assert.equal(s.ok, true);
  assert.equal(s.durum, 'gerekmiyor');
});

test('GELİŞTİRME: Supabase VAR + bağlantı YOK → yüksek sesle uyarır, çalışmaya devam eder', async () => {
  const satirlar = [];
  const s = await acilistaMigrationCalistir({
    env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'k' },
    log: (m) => satirlar.push(String(m)),
    klasor: KLASOR,
  });
  assert.equal(s.ok, true, 'geliştiricinin makinesi sessizce durdurulmaz');
  assert.equal(s.durum, 'yapilandirilmamis');
  const metin = satirlar.join('\n');
  assert.match(metin, /SUPABASE_DB_URL/, 'eksik olan şey ADIYLA yazılır');
  assert.match(metin, /MIGRATIONS_REQUIRED=1/, 'katı seçenek de söylenir');
});

test('ÜRETİM: Supabase VAR + bağlantı YOK → kapı KAPALI (worker/scheduler başlamaz)', async () => {
  const satirlar = [];
  const s = await acilistaMigrationCalistir({
    env: { NODE_ENV: 'production', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'k' },
    log: (m) => satirlar.push(String(m)),
    klasor: KLASOR,
  });
  assert.equal(s.ok, false, 'üretimde doğrulanmamış şemaya veri YAZILMAZ');
  assert.equal(s.durum, 'yapilandirilmamis');
  assert.match(s.hata || '', /SUPABASE_DB_URL/);
  const metin = satirlar.join('\n');
  assert.match(metin, /ÜRETİM/, 'sebebi loga yazılır');
  assert.match(metin, /session\/direct/, 'çözüm de yazılır — kullanıcı aramak zorunda kalmaz');
});

test('MIGRATIONS_REQUIRED=1 → geliştirmede de kapı KAPALI', async () => {
  for (const deger of ['1', 'true']) {
    const s = await acilistaMigrationCalistir({
      env: { MIGRATIONS_REQUIRED: deger, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'k' },
      log: sessiz,
      klasor: KLASOR,
    });
    assert.equal(s.ok, false, `MIGRATIONS_REQUIRED=${deger} kapıyı kapatmalı`);
  }
});

test('kapı kapalıyken log GİZLİ BİLGİ taşımaz', async () => {
  const satirlar = [];
  await acilistaMigrationCalistir({
    env: {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://gizliproje.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_COK_GIZLI_ANAHTAR',
    },
    log: (m) => satirlar.push(String(m)),
    klasor: KLASOR,
  });
  const metin = satirlar.join('\n');
  assert.ok(!metin.includes('sb_secret_COK_GIZLI_ANAHTAR'), 'servis anahtarı loga yazılmaz');
  assert.ok(!metin.includes('gizliproje'), 'proje adresi loga yazılmaz');
});

test('/api/health alanı: durum okunabilir ve gizli bilgi taşımaz', async () => {
  const { migrationDurumu } = await import('../src/migrate/index.js');
  await acilistaMigrationCalistir({
    env: {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://gizliproje.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_COK_GIZLI_ANAHTAR',
    },
    log: sessiz,
    klasor: KLASOR,
  });
  const d = migrationDurumu();
  assert.equal(d.ok, false);
  assert.equal(d.durum, 'yapilandirilmamis');
  assert.deepEqual(d.uygulanan, []);
  assert.ok(typeof d.zaman === 'string' && d.zaman.length > 0, 'zaman damgası bulunur');
  const json = JSON.stringify(d);
  assert.ok(!json.includes('sb_secret_COK_GIZLI_ANAHTAR'));
  assert.ok(!json.includes('gizliproje'));
  assert.ok(!json.includes('SUPABASE_DB_URL='), 'bağlantı dizesi health\'e sızmaz');
});
