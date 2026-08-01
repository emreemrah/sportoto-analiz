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
import { buildDecision } from '../src/decisionEngine.js';
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
  for (const dosya of ['decisionEngine.js', 'analysis/engine.js']) {
    const kod = src(dosya);
    assert.match(kod, /from '\.[./]*(analysis\/)?thresholds'/, `${dosya}: thresholds import edilmemiş`);
  }
});

test('kopya eşik sayıları kaynaktan temizlendi (drift imkânsız)', () => {
  // Bu desenler refactor öncesi iki dosyada da vardı; geri gelirse test kırılır.
  const yasakli = [
    [/pX >= 20/, 'decisionEngine.js'],
    [/p2 >= 30/, 'decisionEngine.js'],
    [/gap12 < 15/, 'decisionEngine.js'],
    [/favPct < 50/, 'decisionEngine.js'],
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
test('ALTIN: eşik altı senaryo (X=19, gap=14) — çıktı refactor öncesiyle aynı', () => {
  const d = buildDecision(mac({ '1': 43, X: 19, '2': 38 }));
  assert.equal(d.mainTrend, '1');
  assert.equal(d.bankoStatus, 'Hayır');
  assert.equal(d.riskLevel, 'Yüksek');
  assert.deepEqual(d.narrowCoupon, ['1', '2']);
  assert.deepEqual(d.safeCoupon, ['1', 'X', '2']);
  assert.equal(d.dataConfidence, 'Orta');
  assert.deepEqual(etiketler(d.tags), [
    'Tek Oynanmaz:75', 'Güçlü Aday Freni:67', 'Favori Tuzağı:58',
    'Deplasman Sürprizi:55', '2 Silinmez:55',
  ]);
  // X=19 eşiğin ALTINDA → "X Silinmez" etiketi ÇIKMAMALI
  assert.ok(!etiketler(d.tags).some((t) => t.startsWith('X Silinmez')),
    'X eşiğin altındayken korunma etiketi üretilmemeli');
});

test('ALTIN: eşik üstü senaryo (X=20) — X Silinmez etiketi TAM eşikte devreye girer', () => {
  const d = buildDecision(mac({ '1': 45, X: 20, '2': 30 }));
  assert.ok(etiketler(d.tags).some((t) => t.startsWith('X Silinmez')),
    'X tam eşikteyken (20) korunmalı — sınır dahil');
  assert.ok(d.safeCoupon.includes('X'));
  assert.ok(d.safeCoupon.includes('2'), '2 tam eşikte (30) geniş kuponda kalmalı');
});

test('ALTIN: güçlü favori senaryosu — çıktı refactor öncesiyle aynı', () => {
  const d = buildDecision(mac({ '1': 62, X: 18, '2': 20 }));
  assert.equal(d.mainTrend, '1');
  assert.equal(d.bankoStatus, 'Şartlı', 'güçlü favoride bile "Evet" denmez — aday dili');
  assert.equal(d.riskLevel, 'Düşük');
  assert.deepEqual(d.narrowCoupon, ['1', '2']);
  assert.deepEqual(d.safeCoupon, ['1', 'X', '2']);
  assert.deepEqual(etiketler(d.tags), [], 'hiçbir risk etiketi tetiklenmemeli');
});

test('ALTIN: kriter motoru (userSelectedAnalysisEngine) çıktısı da aynı', () => {
  const u = userSelectedAnalysisEngine(mac({ '1': 43, X: 19, '2': 38 }), TAM_PROFIL);
  const k = u.sportotoDecision;
  assert.ok(k, 'sportotoDecision üretilmeli');
  assert.equal(k.bankoStatus, 'Hayır');
  assert.equal(k.riskLevel, 'Orta');
  assert.deepEqual(k.narrowCoupon, ['1']);
});

test('iki motor da aynı eşikte aynı yönde davranır (sınır tutarlılığı)', () => {
  // X eşiğin bir altı ve tam üstü: her iki motorda da "X korunuyor mu?" kararı
  // aynı yöne dönmeli — eşikler tek kaynaktan geldiği için garanti altında.
  const altD = buildDecision(mac({ '1': 45, X: X_KEEP_PCT - 1, '2': 36 }));
  const ustD = buildDecision(mac({ '1': 45, X: X_KEEP_PCT, '2': 35 }));
  const xEtiketi = (d) => etiketler(d.tags).some((t) => t.startsWith('X Silinmez'));
  assert.equal(xEtiketi(altD), false, 'eşik altında X korunmaz');
  assert.equal(xEtiketi(ustD), true, 'eşikte X korunur');
});
