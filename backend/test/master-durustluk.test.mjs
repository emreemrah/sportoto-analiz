// MASTER 1.4.0 — SINIF YOKSA TAHMİN YOK + GÜVENE ÇEŞİTLİLİK TAVANI.
//
// GERÇEK OLAY (2026-08-10, sezon başı): 15 maçın 14'ünde tek aktif radar
// halk yüzdesiydi (publicBetting) ve motor bu maçlara "Analiz Hazır Değil"
// derken aynı yanıtta "Favori 2 · %88, Ana: 2, Güven %95" üretiyordu; karne
// de bu tahminleri genel isabete sayıyordu. Sözleşme:
//  (a) insufficient_data → mainPrediction/alternatif/exactDirection/confidence
//      NULL; favorite + scores BİLGİ olarak kalır (halk dağılımı, atfıyla).
//  (b) Güven, kaynak çeşitliliğini sayar: 2 radar → tavan 70; 3+ radar → 95.
//  (c) Karne (feedBucket) mainPrediction'sız maçı saymaz — (a) ile birlikte
//      "hazır değilim" denilen maç manşet isabeti artık kirletemez.
import test from 'node:test';
import assert from 'node:assert/strict';

const { combineMaster } = await import('../src/radar/masterRadar.js');

const dnaYok = { surpriseDnaScore: 0 };

const radar = ({
  ad, home, draw, away, risk = 30, yon = '1', dq = 85,
}) => ({
  hasData: true,
  name: ad,
  dataQuality: dq,
  homeScore: home,
  drawScore: draw,
  awayScore: away,
  favoriteFailureRisk: risk,
  direction: yon,
  positives: [],
  negatives: [],
});

test('(a) tek radarla sınıf üretilmez ve TAHMİN DE üretilmez; dağılım bilgi olarak kalır', () => {
  const m = combineMaster({
    publicBetting: radar({ ad: 'Radar 3', home: 6, draw: 30, away: 64, yon: '2', dq: 80 }),
  }, { surpriseDna: dnaYok });

  assert.equal(m.classification, 'insufficient_data');
  assert.equal(m.mainPrediction, null, 'sınıf yoksa ana tahmin yok');
  assert.equal(m.alternativePrediction, null);
  assert.equal(m.exactDirection, null);
  assert.equal(m.confidence, null, 'olmayan tahminin güveni olmaz');
  // Dağılım SAKLANMAZ: ekranlar halkın dağılımını kendi atfıyla gösterebilir.
  assert.equal(m.favorite?.symbol, '2');
  assert.equal(m.scores.away, 64);
});

test('(b) iki radarla güven %70 tavanını AŞAMAZ', () => {
  const m = combineMaster({
    publicBetting: radar({ ad: 'Radar 3', home: 80, draw: 12, away: 8, dq: 90, risk: 30 }),
    market: radar({ ad: 'Radar 4', home: 82, draw: 10, away: 8, dq: 90, risk: 30 }),
  }, { surpriseDna: dnaYok });

  // Formül puanı tavansız 95'e vururdu (percent ~80 · gap ~70); tavan 70.
  assert.equal(m.classification, 'medium_risk', '2 radar Güçlü Aday kapısını geçemez');
  assert.ok(m.confidence != null && m.confidence <= 70,
    `2 radarla güven ≤ 70 olmalı, geldi: ${m.confidence}`);
  assert.ok(m.mainPrediction === '1', 'sınıf üretildi, tahmin de üretilir');
});

test('(c) üç uyumlu radarla eski tavan (95) ve Güçlü Aday yolu değişmedi', () => {
  const uc = {
    performance: radar({ ad: 'Radar 1', home: 70, draw: 18, away: 12, risk: 20 }),
    expectation: radar({ ad: 'Radar 2', home: 68, draw: 20, away: 12, risk: 20 }),
    market: radar({ ad: 'Radar 4', home: 72, draw: 16, away: 12, risk: 20 }),
  };
  const m = combineMaster(uc, { surpriseDna: dnaYok });

  assert.equal(m.classification, 'strong_candidate');
  assert.ok(m.confidence > 70, `3+ radarla tavan 95'tir, geldi: ${m.confidence}`);
  assert.equal(m.mainPrediction, '1');
});
