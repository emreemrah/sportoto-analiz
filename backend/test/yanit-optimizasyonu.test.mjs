// YANIT OPTİMİZASYONU TESTLERİ.
//
// NEDEN VAR: bu ara katman HER GET yanıtının gövdesine dokunuyor. Buradaki
// bir hata tüm uygulamayı bozar ve belirtisi tuhaftır ("JSON ayrıştırılamadı"),
// sebebi hemen görünmez. Testler üç şeyi kilitler: gövde bozulmuyor,
// sıkıştırma gerçekten kazanç sağlıyor, ve optimizasyon hiçbir koşulda
// yanıtı ENGELLEMİYOR.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import { kodlamaSec, sikistir, SIKISTIRMA_ESIGI } from '../src/yanitOptimizasyonu.js';

describe('kodlamaSec', () => {
  test('brotli tercih ediliyor (JSON\'da daha iyi oran)', () => {
    assert.equal(kodlamaSec('gzip, deflate, br'), 'br');
    assert.equal(kodlamaSec('br'), 'br');
  });

  test('brotli yoksa gzip', () => {
    assert.equal(kodlamaSec('gzip, deflate'), 'gzip');
  });

  test('istemci sıkıştırma DESTEKLEMİYORSA null — zorla sıkıştırılmaz', () => {
    // Zorlarsak istemci gövdeyi çözemez ve uygulama tamamen bozulur.
    assert.equal(kodlamaSec(''), null);
    assert.equal(kodlamaSec(undefined), null);
    assert.equal(kodlamaSec('identity'), null);
  });
});

describe('sikistir', () => {
  const ornek = Buffer.from(JSON.stringify({
    matches: Array.from({ length: 200 }, (_, i) => ({
      no: i, home: { name: `Takim ${i}` }, away: { name: `Rakip ${i}` },
      analysis: { probabilities: { 1: 45, X: 30, 2: 25 }, surpriseScore: i % 100 },
    })),
  }));

  test('gzip çıktısı GERİ AÇILINCA gövde birebir aynı', () => {
    // Asıl risk: bozuk gövde. Oran değil, DOĞRULUK önce gelir.
    const k = sikistir(ornek, 'gzip');
    assert.deepEqual(zlib.gunzipSync(k), ornek);
  });

  test('brotli çıktısı GERİ AÇILINCA gövde birebir aynı', () => {
    const k = sikistir(ornek, 'br');
    assert.deepEqual(zlib.brotliDecompressSync(k), ornek);
  });

  test('sıkıştırma gerçekten kazanç sağlıyor (JSON en az %70 küçülmeli)', () => {
    // Ölçülen gerçek: /api/bulletin 615 KB → 13 KB (%98). Buradaki eşik
    // temkinli; kazanç bunun altına düşerse bir şey ters gitmiş demektir.
    const gz = sikistir(ornek, 'gzip').length;
    const br = sikistir(ornek, 'br').length;
    assert.ok(gz < ornek.length * 0.3, `gzip beklenenden büyük: ${gz}/${ornek.length}`);
    assert.ok(br < ornek.length * 0.3, `brotli beklenenden büyük: ${br}/${ornek.length}`);
  });

  test('Türkçe karakterler bozulmadan geçiyor', () => {
    // Gövde UTF-8; bayt sayısı ile karakter sayısı KARIŞTIRILIRSA
    // "Brøndby", "Mjällby", "Sarı" gibi adlar bozulur.
    const tr = Buffer.from(JSON.stringify({ t: 'Brøndby · Mjällby · Göztepe · şığüöç İ'.repeat(60) }));
    assert.deepEqual(zlib.gunzipSync(sikistir(tr, 'gzip')).toString('utf8'), tr.toString('utf8'));
  });
});

describe('eşik', () => {
  test('küçük gövdeler için sıkıştırma eşiği makul', () => {
    // Çok küçük yanıtta sıkıştırma CPU maliyeti kazançtan büyük; hatta
    // gzip başlığı yüzünden gövde BÜYÜYEBİLİR.
    assert.ok(SIKISTIRMA_ESIGI >= 256 && SIKISTIRMA_ESIGI <= 4096);
    const minik = Buffer.from(JSON.stringify({ ok: true }));
    assert.ok(minik.length < SIKISTIRMA_ESIGI);
    assert.ok(sikistir(minik, 'gzip').length > minik.length); // gerekçenin kanıtı
  });
});
