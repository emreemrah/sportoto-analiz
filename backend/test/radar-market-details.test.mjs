// RADAR 4 `details` ALANLARI — hangisi TÜKETİLİYOR, hangisi ARŞİV İÇİN duruyor.
//
// NEDEN BU DOSYA VAR: not defterinde bu alanlar "hesaplanıyor ama hiç
// gösterilmiyor, silinebilir" diye duruyordu. Ölçüldüğünde iki şey çıktı:
//
//  1. `movement` ve `inversion` ÖLÜ DEĞİL — radar skorunu doğrudan besliyor
//     (marketRadar bump'ları) ve Sürpriz DNA `details.inversion` okuyor.
//     Silinseler radar kararı değişirdi.
//  2. Kalan alanlar (openingImplied / lockImplied / currentImplied /
//     overroundPct) gerçekten hiçbir ekranda gösterilmiyor — AMA mühürlü
//     snapshot'a giriyorlar. Bir haftanın oranlarının açılıştan mühre nasıl
//     hareket ettiği SONRADAN elde edilemez; silmek geri dönüşsüz veri kaybı
//     olurdu. Ayrıca eski mühürler bu alanlarla kaldığı için silmek arşivi
//     ikiye bölerdi (eski kayıtlarda var, yenilerde yok).
//
// Bu testler kararı KİLİTLER: alanlar silinirse ya da tüketim yolu kopar ise
// kırılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (...p) => readFileSync(join(kok, ...p), 'utf8');

const MARKET = oku('src', 'radar', 'marketRadar.js');
const SURPRISE = oku('src', 'radar', 'surpriseDna.js');
const SNAPSHOT = oku('src', 'archive', 'snapshotService.js');

test('movement ve inversion radar SKORUNU besliyor — ölü değiller', () => {
  // Skor artırımı: hareket favoriye karşı ise ve halk-piyasa tersliği varsa.
  assert.match(MARKET, /movement && movement\.delta\[favSym\.k\][^\n]*bump \+= /,
    'hareket skora katkı vermiyor — kaldırılmışsa radar kararı değişmiştir');
  assert.match(MARKET, /if \(inversion\) bump \+= /,
    'terslik skora katkı vermiyor');
});

test('Sürpriz DNA details.inversion OKUYOR (ikinci tüketici)', () => {
  assert.match(SURPRISE, /mkt\.details\?\.inversion/,
    'Sürpriz DNA artık tersliği okumuyor — marketRadar ile bağı kopmuş');
});

test('gösterilmeyen alanlar MÜHÜRLÜ kayıtta duruyor (silinmemeli)', () => {
  // Bu dördü hiçbir ekranda görünmez; arşiv değeri için tutulur.
  for (const alan of ['openingImplied', 'lockImplied', 'currentImplied', 'overroundPct']) {
    assert.match(MARKET, new RegExp(`${alan}:`), `${alan} details'ten kaldırılmış`);
  }
  // Ve radars çıktısı gerçekten snapshot'a giriyor.
  assert.match(SNAPSHOT, /radars: radarCenterByNo\.get\(m\.no\)\.radars/,
    'radar çıktısı artık mühürlenmiyor — bu alanların arşiv gerekçesi kalmaz');
});

test('marj (overroundPct) hesaplanıyor ve DOĞRU tanımlı', () => {
  // Overround = 1/o1 + 1/oX + 1/o2 − 1, yüzde olarak. Tanım util.js'te.
  const util = oku('src', 'radar', 'util.js');
  assert.match(util, /overroundPct: round1\(\(sum - 1\) \* 100\)/,
    'marj tanımı değişmiş — kalibrasyondaki marj temizleme ile tutarsız olabilir');
});
