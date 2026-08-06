// NOT (2026-08-06 denetimi): `decisionEngine.js` ÖLÜ KOD olduğu için kaldırıldı;
// ona dayanan üç 'ALTIN' senaryo testi de birlikte gitti. Eşik SABİTLERİ ve
// yaşayan kriter motoru (userSelectedAnalysisEngine) testleri aynen duruyor.
// EŞİK BİRLİĞİ TESTLERİ (T14) — iki motor AYNI sabitlerden okur.
//
// SORUN: Aynı sayılar (X≥20, 2≥30, fark<15) iki motorda ayrı ayrı yazılıydı.
// Biri değiştirilip diğeri unutulursa iki ekran aynı maç için farklı karar
// verir — ve bu SESSİZ bir hatadır. Artık ikisi de analysis/thresholds.js'ten
// okur; bu testler hem kaynak birliğini hem de refactor'ün davranışı
// DEĞİŞTİRMEDİĞİNİ (altın değerler) kanıtlar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { userSelectedAnalysisEngine } from '../src/analysis/engine.js';
import {
  X_KEEP_PCT, AWAY_KEEP_PCT, HOME_KEEP_PCT, CLOSE_GAP_PCT, FAVORITE_MIN_PCT,
} from '../src/analysis/thresholds.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(here, '..', 'src', p), 'utf8');

const mac = (probs) => ({
  home: { name: 'Ev', mediumName: 'Ev' }, away: { name: 'Dep', mediumName: 'Dep' },
  league: 'Test', date: '2026-07-25T17:00:00Z',
  analysis: { probabilities: probs, surpriseScore: 40, hasOdds: true, estimated: false },
  coverage: { ok: true },
  stats: {
    home: { standing: { points: 40, position: 3, wins: 12, draws: 4, losses: 2, goalDiff: 15, home: { wins: 6, draws: 2, losses: 1 } }, last5: ['G', 'G', 'B', 'G', 'M'], season: { xgFor: 1.6, xgAgainst: 1.1, ppg: 2.0 }, avg: { possession: 55, shots: 14, corners: 6 } },
    away: { standing: { points: 35, position: 6, wins: 10, draws: 5, losses: 3, goalDiff: 8, away: { wins: 4, draws: 2, losses: 2 } }, last5: ['G', 'B', 'M', 'G', 'B'], season: { xgFor: 1.3, xgAgainst: 1.4, ppg: 1.7 }, avg: { possession: 45, shots: 11, corners: 4 } },
    h2h: { played: 6, homeWins: 2, awayWins: 3, draws: 1 },
  },
});
const profil = (keys) => ({
  id: 'p', name: 'T', version: 1, mode: 'manual',
  criteria: Object.fromEntries(keys.map((k) => [k, { on: true, impact: 'mid' }])),
});
const TAM_PROFIL = profil(['xgFor', 'xgAgainst', 'ppg', 'possession', 'shots', 'corners']);
const etiketler = (tags) => (tags || []).map((t) => `${t.name}:${Math.round(t.weight)}`);

// ——— Kaynak birliği ———
test('iki motor da eşikleri thresholds.js\'ten okur (kopya sayı kalmadı)', () => {
  for (const dosya of ['analysis/engine.js']) {
    const kod = src(dosya);
    assert.match(kod, /from '\.[./]*(analysis\/)?thresholds'/, `${dosya}: thresholds import edilmemiş`);
  }
});

test('kopya eşik sayıları kaynaktan temizlendi (drift imkânsız)', () => {
  // Bu desenler refactor öncesi iki dosyada da vardı; geri gelirse test kırılır.
  const yasakli = [
    [/sX >= 20/, 'analysis/engine.js'],
    [/s2 >= 30/, 'analysis/engine.js'],
    [/gap12 < 15/, 'analysis/engine.js'],
  ];
  for (const [desen, dosya] of yasakli) {
    assert.ok(!desen.test(src(dosya)), `${dosya}: çıplak eşik sayısı geri gelmiş → ${desen}`);
  }
});

test('eşik değerleri beklenen sayılar (sessizce kaymasın)', () => {
  assert.equal(X_KEEP_PCT, 20);
  assert.equal(AWAY_KEEP_PCT, 30);
  assert.equal(HOME_KEEP_PCT, 30);
  assert.equal(CLOSE_GAP_PCT, 15);
  assert.equal(FAVORITE_MIN_PCT, 50);
});

// ——— Altın değerler: refactor davranışı DEĞİŞTİRMEDİ ———
// Aşağıdaki değerler refactor ÖNCESİ motorlardan ölçüldü (tahmin değil).
test('ALTIN: kriter motoru (userSelectedAnalysisEngine) çıktısı da aynı', () => {
  const u = userSelectedAnalysisEngine(mac({ '1': 43, X: 19, '2': 38 }), TAM_PROFIL);
  const k = u.sportotoDecision;
  assert.ok(k, 'sportotoDecision üretilmeli');
  assert.equal(k.bankoStatus, 'Hayır');
  assert.equal(k.riskLevel, 'Orta');
  assert.deepEqual(k.narrowCoupon, ['1']);
});

