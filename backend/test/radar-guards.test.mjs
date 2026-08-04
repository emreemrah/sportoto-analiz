// RADAR KORUMALARI testleri — 1525/1526 analiz raporlarındaki gerçek vakalar
// fixture olarak kullanılır. (RAPOR-1525/1526-tutmayan-tahminler.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRadarGuards, applyRadarGuardsToBulletin, acSembol, paketle, KORUMA_ESIKLERI,
} from '../src/analysis/radarGuards.js';

const tahmin = (symbol, label = 'NET') => ({
  symbol, meaning: 'x', label, estimated: false, reason: 'favori %60',
});

const radar = ({ fav = '1', pct = 60, home = 60, draw = 20, away = 20, risk = 30, surpriz = 0, yonler = {} } = {}) => ({
  master: {
    favorite: { symbol: fav, percent: pct },
    scores: { home, draw, away },
    favoriteFailureRisk: risk,
    surpriseDnaScore: surpriz,
  },
  radars: Object.fromEntries(Object.entries(yonler).map(([k, v]) => [k, { direction: v }])),
});

// ---------------------------------------------------------------------------
test('sembol yardımcıları: aç/paketle kanonik sırayı korur', () => {
  assert.deepEqual(acSembol('102'), ['1', '0', '2']);
  assert.equal(paketle(new Set(['2', '1'])), '12');
  assert.equal(paketle(new Set(['0', '1'])), '10');
  assert.equal(paketle(new Set(['2', '0', '1'])), '102');
});

// 1) MOTOR ÇELİŞKİSİ — 1525/15 vakası: kupon tekli X, master %77 "1".
test('motor çelişkisi: master favorisi öneri dışındaysa eklenir (1525/15)', () => {
  const p = applyRadarGuards(tahmin('0'), radar({ fav: '1', pct: 77, home: 77, draw: 9, away: 14 }));
  assert.equal(p.symbol, '10');
  assert.equal(p.label, 'ÇİFTE');
  assert.ok(p.guardNotes.length === 1);
  assert.match(p.reason, /favorisi .* öneri dışındaydı/);
});

test('motor çelişkisi çiftede de çalışır: 1X önerisi + master 2 → 102 (1527/8)', () => {
  const p = applyRadarGuards(tahmin('10', 'ÇİFTE'), radar({ fav: '2', pct: 44, home: 30, draw: 22, away: 44 }));
  assert.equal(p.symbol, '102');
  assert.equal(p.label, 'AÇIK');
});

// 2a) YÜKSEK RİSK — 1526/13 Molde profili (risk 55, tekli 1).
test('yatma riski eşiğin üzerindeyse tekli genişletilir (1526/13)', () => {
  const p = applyRadarGuards(tahmin('1'), radar({ fav: '1', home: 54, draw: 22, away: 24, risk: 55 }));
  assert.equal(p.symbol, '12'); // ikinci en yüksek master ihtimali: away 24
  assert.equal(p.label, 'ÇİFTE');
  assert.match(p.reason, /yatma riski 55/);
});

test('risk tam eşitken (50) tekli KORUNUR — sınır dahil değil', () => {
  const p = applyRadarGuards(tahmin('1'), radar({ risk: KORUMA_ESIKLERI.RISK_TEKLI_UST }));
  assert.equal(p.symbol, '1');
  assert.equal(p.guardNotes, undefined);
});

// 2b) SÜRPRİZ DNA — 1525/8 Malmö profili (surpriz 44, tekli 1).
test('sürpriz DNA eşiğe ulaştıysa tekli genişletilir (1525/8)', () => {
  const p = applyRadarGuards(tahmin('1', 'BANKO'), radar({ home: 54, draw: 24, away: 22, surpriz: 44 }));
  assert.equal(p.symbol, '10'); // ikinci en yüksek: draw 24
  assert.equal(p.label, 'ÇİFTE');
  assert.match(p.reason, /sürpriz sinyali 44/);
});

// 2c) TERS RADAR YÖNÜ — 1526/5 Hacken (Oran radarı "2", tekli 1).
test('aktif radar ters yön gösteriyorsa o yön eklenir (1526/5)', () => {
  const p = applyRadarGuards(tahmin('1'), radar({ home: 64, draw: 12, away: 24, yonler: { market: '2' } }));
  assert.equal(p.symbol, '12');
  assert.match(p.reason, /Oran radarı 2 yönünde/);
});

test('radar yönü X ("X" harfiyle gelse bile) doğru çevrilir', () => {
  const p = applyRadarGuards(tahmin('1'), radar({ yonler: { performance: 'X' } }));
  assert.equal(p.symbol, '10');
});

// --- DOKUNULMAYAN DURUMLAR ---
test('tüm sinyaller öneriyle aynı yöndeyse HİÇBİR ŞEY değişmez (1526/9 Valerenga)', () => {
  const once = tahmin('1');
  const p = applyRadarGuards(once, radar({
    fav: '1', pct: 65, home: 65, draw: 21, away: 14, risk: 41, surpriz: 0,
    yonler: { performance: '1', expectation: '1', publicBetting: '1', market: '1' },
  }));
  assert.equal(p, once); // aynı referans: nesne kopyalanmaz
});

test('kilitli haftada asla dokunulmaz', () => {
  const once = tahmin('0');
  const p = applyRadarGuards(once, radar({ fav: '1', risk: 99, surpriz: 99 }), { isLocked: true });
  assert.equal(p, once);
});

test('VERİ YOK ("-") önerisine dokunulmaz', () => {
  const once = { ...tahmin('-'), label: 'VERİ YOK' };
  assert.equal(applyRadarGuards(once, radar({ fav: '1' })), once);
});

test('radar kaydı yoksa dokunulmaz', () => {
  const once = tahmin('1');
  assert.equal(applyRadarGuards(once, null), once);
  assert.equal(applyRadarGuards(once, {}), once);
});

test('koruma seçenek EKLER, asla çıkarmaz', () => {
  const p = applyRadarGuards(tahmin('102', 'AÇIK'), radar({ fav: '2', risk: 99, surpriz: 99 }));
  assert.equal(p.symbol, '102'); // üçlü zaten her şeyi kapsar → değişmez
});

// --- BÜLTEN TOPLU UYGULAMA ---
test('bülten uygulaması: maç no eşleşmesi + kilitliyse 0', () => {
  const result = {
    matches: [
      { no: 1, prediction: tahmin('0') },
      { no: 2, prediction: tahmin('1') },
      { no: 3 }, // tahminsiz
    ],
    radarCenter: {
      matches: [
        { no: 1, ...radar({ fav: '1', pct: 77 }) },
        { no: 2, ...radar({ fav: '1', yonler: { market: '1' } }) },
      ],
    },
  };
  assert.equal(applyRadarGuardsToBulletin(result, { isLocked: true }), 0);
  const n = applyRadarGuardsToBulletin(result, { isLocked: false });
  assert.equal(n, 1); // yalnız 1. maç değişti
  assert.equal(result.matches[0].prediction.symbol, '10');
  assert.equal(result.matches[1].prediction.symbol, '1');
});
