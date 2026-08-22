// KİLİT VE "BAŞLAMIŞ MAÇ" SAAT DİLİMİNDEN BAĞIMSIZ OLMALI.
//
// DOĞRULANMIŞ ARIZA (22 Ağustos 2026): resmî Spor Toto saatleri saat dilimi
// EKSİZ gelir ("2026-08-22T21:30:00") ve Türkiye duvar saatidir. refresh.js
// bunları ham `new Date(...)` ile okuyordu; ham okuma değeri SUNUCUNUN
// dilimine göre yorumlar:
//
//   TSİ (geliştirme) : 21:30 → 18:30Z   ✔ doğru
//   UTC (üretim)     : 21:30 → 21:30Z   → 3 saat İLERİ
//
// Sonuç: üretimde hem `isLocked` hem `started` 3 SAAT GEÇ tetikleniyordu. O
// aralıkta bülten kilitsiz sayılıyor ve maç fiilen başlamışken analiz yeniden
// hesaplanabiliyordu — projenin "maç başladıktan sonra tahmin üretilmez"
// kuralının yumuşaması. Belirti ölçüldü: aynı bültende yerel 5, üretim 3 maçı
// "başlamış" saydı.
//
// Doğru okuyucu (`macAniMs`) bu dosyada zaten vardı ve başka satırlarda
// kullanılıyordu; kilit ve başlama kontrolleri ona bağlandı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { macAniMs } from '../src/time/turkiyeSaati.js';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const ham = readFileSync(join(KOK, 'src', 'refresh.js'), 'utf8');
const kod = ham.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('macAniMs, dilimsiz resmî saati Türkiye duvar saati sayar', () => {
  // Bu, düzeltmenin dayandığı sözleşme. Bozulursa kilit yine kayar.
  assert.equal(
    new Date(macAniMs('2026-08-22T21:30:00')).toISOString(),
    '2026-08-22T18:30:00.000Z',
  );
});

test('macAniMs, dilimi VERİLMİŞ saati olduğu gibi bırakır', () => {
  assert.equal(
    new Date(macAniMs('2026-08-22T18:30:00Z')).toISOString(),
    '2026-08-22T18:30:00.000Z',
  );
});

test('kilit (isLocked) ham new Date ile hesaplanmıyor', () => {
  assert.ok(
    kod.includes('const kapanisMs = macAniMs(bulletin.closeDate)'),
    'kapanış saati macAniMs ile okunmuyor — üretimde kilit 3 saat geç düşer',
  );
  assert.ok(
    !kod.includes('new Date(bulletin.closeDate).getTime() <= Date.now()'),
    'eski ham okuma hâlâ yerinde',
  );
});

test('"başlamış maç" ham new Date ile hesaplanmıyor', () => {
  assert.ok(
    kod.includes('const baslamaMs = macAniMs(bm.date)'),
    'maç saati macAniMs ile okunmuyor — üretimde maç 3 saat geç başlamış sayılır',
  );
  assert.ok(
    !kod.includes('new Date(bm.date).getTime() <= Date.now()'),
    'eski ham okuma hâlâ yerinde',
  );
});

test('kilit ve başlama AYNI okumayı kullanır (ikisi ayrışamaz)', () => {
  // Biri düzeltilip diğeri unutulursa, bülten "kilitli değil ama maç başlamış"
  // gibi tuhaf bir ara duruma düşer ve donmuş analiz yolu hiç çalışmaz.
  const kapanis = kod.includes('macAniMs(bulletin.closeDate)');
  const baslama = kod.includes('macAniMs(bm.date)');
  assert.equal(kapanis, baslama, 'kilit ile başlama farklı saat okuması kullanıyor');
});
