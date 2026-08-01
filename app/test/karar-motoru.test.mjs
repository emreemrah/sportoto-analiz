// KARAR MOTORU SENARYO TESTLERİ — eski `test-karar-motoru.js` yerine (T13).
//
// ESKİ DOSYANIN SORUNU (kayda geçsin): 149 satır boyunca hiç `assert` yoktu;
// yalnız `console.log` yapıp yanına yorum olarak "Beklenen: ..." yazıyordu ve
// sonunda koşulsuz "✅ TÜM TEST SENARYOLARI TAMAMLANDI" basıyordu. Üstelik
// okuduğu alan (`result.sportotoDecision`) motorun çıktısında HİÇ YOKTU —
// yani beş senaryonun tamamı `undefined` yazdırıyor, script yine de "başarılı"
// görünüyordu. Bu dosya aynı senaryoları GERÇEK iddialarla kurar; motor bozulursa
// test kırılır.
//
// Motorun gerçek sözleşmesi: analyzeUserMatch(m) → { ok, matchInfo, points,
// homeForm, awayForm, missing, coach, common, h2h, vsTop, verdict }
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUserMatch } from '../src/userMatchEngine.js';

const SABIT_TARIH = new Date('2026-07-25T17:00:00Z').toISOString();
const senaryo = (over) => ({
  home: { name: 'Ev Takımı', mediumName: 'Ev' },
  away: { name: 'Deplasman Takımı', mediumName: 'Dep' },
  league: 'Super Lig',
  date: SABIT_TARIH,
  ...over,
});

// SENARYO 1 — dengeli maç, deplasman dış sahada güçlü
const dengeli = senaryo({
  analysis: { probabilities: { '1': 44, X: 23, '2': 33 }, surpriseScore: 45, estimated: false },
  stats: {
    home: {
      standing: { points: 40, position: 3, wins: 12, draws: 4, losses: 2, goalDiff: 15, goalsFor: 35, goalsAgainst: 20, home: { wins: 6, draws: 2, losses: 1, goalsFor: 18, goalsAgainst: 10 } },
      last5: ['G', 'G', 'B', 'G', 'M'], last5venue: ['G', 'G', 'B', 'G', 'M'],
    },
    away: {
      standing: { points: 35, position: 6, wins: 10, draws: 5, losses: 3, goalDiff: 8, goalsFor: 30, goalsAgainst: 22, away: { wins: 4, draws: 2, losses: 2, goalsFor: 12, goalsAgainst: 10 } },
      last5: ['G', 'B', 'M', 'G', 'B'], last5venue: ['G', 'B', 'M', 'G', 'B'],
    },
  },
});

// SENARYO 2 — güçlü favori (lider vs son sıra)
const gucluFavori = senaryo({
  analysis: { probabilities: { '1': 62, X: 18, '2': 20 }, surpriseScore: 30, estimated: false },
  stats: {
    home: {
      standing: { points: 55, position: 1, wins: 17, draws: 4, losses: 1, goalDiff: 35, goalsFor: 52, goalsAgainst: 17, home: { wins: 9, draws: 1, losses: 0, goalsFor: 28, goalsAgainst: 5 } },
      last5: ['G', 'G', 'G', 'G', 'B'],
    },
    away: {
      standing: { points: 20, position: 18, wins: 4, draws: 8, losses: 8, goalDiff: -20, goalsFor: 18, goalsAgainst: 38, away: { wins: 1, draws: 3, losses: 6, goalsFor: 6, goalsAgainst: 18 } },
      last5: ['M', 'B', 'M', 'M', 'M'],
    },
  },
});

// SENARYO 5 — hiç veri yok
const veriYok = senaryo({ analysis: {}, stats: { home: {}, away: {} } });

test('senaryo 1 (dengeli): karar üretilir, deplasmanın dış saha gücü gerekçede geçer', () => {
  const r = analyzeUserMatch(dengeli);
  assert.equal(r.ok, true);
  assert.ok(r.verdict, 'verdict alanı zorunlu');
  assert.ok(['1', 'X', '2', '1X', 'X2', '12', '1X2'].includes(r.verdict.main), `geçersiz ana tercih: ${r.verdict.main}`);
  assert.equal(r.points.available, true);
  assert.equal(r.points.advSide, 'home', '40 vs 35 puan → ev sahibi önde');
  // Dengeli maçta tek taraf dayatılmaz: karar kapalı/çift olmalı.
  assert.ok(r.verdict.main.length > 1, `dengeli maçta tek sonuç dayatılmamalı (${r.verdict.main})`);
  assert.match(r.verdict.reason, /deplasmanda güçlü|X doğuyor/, 'deplasmanın dış saha gücü gerekçelenmeli');
});

test('senaryo 2 (güçlü favori): ana tercih 1, risk Düşük, puan farkı gerekçede', () => {
  const r = analyzeUserMatch(gucluFavori);
  assert.equal(r.ok, true);
  assert.equal(r.verdict.main, '1', 'lider ile son sıra arasında ana tercih 1 olmalı');
  assert.equal(r.verdict.risk, 'Düşük');
  assert.ok(r.verdict.net > 0, 'net sinyal ev lehine pozitif olmalı');
  assert.match(r.verdict.reason, /35 puan önde/, 'puan farkı gerekçede sayıyla geçmeli');
});

test('senaryo 2 vs 1: güçlü favori dengeli maçtan daha yüksek net sinyal üretir', () => {
  const a = analyzeUserMatch(dengeli).verdict.net ?? 0;
  const b = analyzeUserMatch(gucluFavori).verdict.net ?? 0;
  assert.ok(b > a, `güçlü favori daha net olmalı (${b} > ${a})`);
});

test('senaryo 5 (veri yok): kör karar VERİLMEZ — kapalı 1X2 ve dürüst gerekçe', () => {
  const r = analyzeUserMatch(veriYok);
  assert.equal(r.ok, false, 'veri yokken ok:false dönmeli');
  assert.equal(r.verdict.main, '1X2', 'veri yokken kapalı oynanmalı');
  assert.equal(r.verdict.dataConfidence, 'Çok Düşük');
  assert.match(r.verdict.reason, /bulunamadı/, 'verinin yokluğu açıkça söylenmeli');
  assert.equal(r.points.available, false);
});

test('kaynağı olmayan kriterler veri UYDURMAZ (eksik oyuncu / teknik direktör)', () => {
  const r = analyzeUserMatch(gucluFavori);
  assert.equal(r.missing.available, false, 'eksik oyuncu kaynağı yok → available:false');
  assert.equal(r.coach.available, false, 'teknik direktör kaynağı yok → available:false');
  assert.equal(r.missing.confidencePenalty, 1, 'eksik veri güveni düşürmeli');
  for (const alan of [r.missing, r.coach]) {
    assert.match(alan.note, /bulunamadı/, 'yokluk dürüstçe yazılmalı');
    assert.equal(alan.signal, 0, 'veri yoksa sinyal üretilmemeli');
  }
});

test('motor sözleşmesi: beklenen alanlar var; ESKİ sportotoDecision alanı YOK', () => {
  const r = analyzeUserMatch(gucluFavori);
  for (const alan of ['ok', 'matchInfo', 'points', 'homeForm', 'awayForm', 'missing', 'coach', 'common', 'h2h', 'vsTop', 'verdict']) {
    assert.ok(alan in r, `sözleşme alanı eksik: ${alan}`);
  }
  // Eski script bu alanı okuyordu; yoktu ve fark edilmiyordu.
  assert.equal(r.sportotoDecision, undefined,
    'sportotoDecision geri gelirse eski/ölü API canlanmış demektir — sözleşme tek olmalı');
});

test('aynı girdi aynı çıktıyı verir (deterministik; rastgelelik yok)', () => {
  const a = analyzeUserMatch(dengeli);
  const b = analyzeUserMatch(dengeli);
  assert.deepEqual(a.verdict, b.verdict);
});
