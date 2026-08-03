// DIŞ SERVİS ZAMAN AŞIMI — takılan kaynak akışı süresiz kilitlemesin.
//
// DOĞRULANMIŞ EKSİK: veri kaynaklarının (footystats, sportoto, apifootball)
// hiçbirinde zaman aşımı yoktu — düz `await fetch(url)`. Karşı taraf yanıt
// vermeyi keserse (bağlantı açık, veri yok) istek SÜRESİZ bekler: yenileme
// turu bitmez, sonraki tur başlayamaz, ekran "yükleniyor"da asılı kalır ve
// logda hata bile görünmez — yalnız sessizlik olur.
//
// Sağlayıcı adaptörlerinde (nesine/misli) koruma zaten vardı; kaynak
// dosyalarında yoktu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { zamanAsimliFetch, VARSAYILAN_SURE_MS } from '../src/sources/zamanAsimi.js';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const KAYNAKLAR = ['footystats.js', 'sportoto.js', 'apifootball.js'];

test('kaynak dosyalarında ÇIPLAK fetch kalmadı', () => {
  for (const dosya of KAYNAKLAR) {
    const kod = readFileSync(join(KOK, 'src', 'sources', dosya), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(kod, /await fetch\(/, `${dosya}: zaman aşımsız fetch var`);
    assert.match(kod, /zamanAsimliFetch\(/, `${dosya}: zaman aşımlı sarmalayıcı kullanılmıyor`);
  }
});

test('süre dolunca ANLAŞILIR hata veriyor (sessiz takılma yok)', async () => {
  // Hiç yanıt vermeyen bir uç taklit edilir. GERÇEK fetch iptal sinyalinde
  // reddeder; sahte de öyle davranmalı, yoksa test kendi kurgusundan asılır.
  const asilanFetch = (_u, init) => new Promise((_c, redd) => {
    init?.signal?.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError'; redd(e);
    }, { once: true });
  });
  const eski = globalThis.fetch;
  globalThis.fetch = asilanFetch;
  try {
    await assert.rejects(
      () => zamanAsimliFetch('https://ornek.test/x', { sureMs: 50 }),
      (e) => {
        assert.match(e.message, /yanıt vermedi/, `anlaşılmaz hata: ${e.message}`);
        assert.doesNotMatch(e.message, /AbortError/, 'ham AbortError sızıyor');
        return true;
      },
    );
  } finally { globalThis.fetch = eski; }
});

test('normal yanıtta davranış DEĞİŞMİYOR', async () => {
  const eski = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ a: 1 }) });
  try {
    const r = await zamanAsimliFetch('https://ornek.test/x');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { a: 1 });
  } finally { globalThis.fetch = eski; }
});

test('zaman aşımı sayacı yanıt gelince TEMİZLENİYOR (sızıntı yok)', async () => {
  // Temizlenmezse süreç, iş bittiği hâlde zamanlayıcı yüzünden açık kalır.
  const eski = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  try {
    const once = process.getActiveResourcesInfo?.().filter((x) => x === 'Timeout').length ?? 0;
    await zamanAsimliFetch('https://ornek.test/x', { sureMs: 60_000 });
    const sonra = process.getActiveResourcesInfo?.().filter((x) => x === 'Timeout').length ?? 0;
    assert.equal(sonra, once, 'zamanlayıcı temizlenmemiş');
  } finally { globalThis.fetch = eski; }
});

test('varsayılan süre makul — ağır uçları kesmeyecek kadar geniş', () => {
  // Sezon maçları gibi büyük yanıtlar var; çok kısa bir süre sağlıklı isteği
  // keserdi ve veri kaybı gibi görünürdü.
  assert.ok(VARSAYILAN_SURE_MS >= 10_000, 'süre çok kısa');
  assert.ok(VARSAYILAN_SURE_MS <= 60_000, 'süre çok uzun — takılma geç fark edilir');
});
