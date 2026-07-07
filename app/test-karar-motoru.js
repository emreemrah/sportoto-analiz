// TEST: Spor Toto Karar Motoru Senaryoları
// Bu dosya kopya projede test amaçlı kullanılacak

import { analyzeUserMatch } from './src/userMatchEngine.js';

// TEST SENARYO 1: Dengeli maç, X canlı
const scenario1 = {
  home: { name: 'Ev Takımı', mediumName: 'Ev' },
  away: { name: 'Deplasman Takımı', mediumName: 'Dep' },
  league: 'Super Lig',
  date: new Date().toISOString(),
  analysis: {
    probabilities: { '1': 44, 'X': 23, '2': 33 },
    surpriseScore: 45,
    estimated: false
  },
  stats: {
    home: {
      standing: { points: 40, position: 3, wins: 12, draws: 4, losses: 2, goalDiff: 15, goalsFor: 35, goalsAgainst: 20, home: { wins: 6, draws: 2, losses: 1, goalsFor: 18, goalsAgainst: 10 } },
      last5: ['G', 'G', 'B', 'G', 'M'],
      last5venue: ['G', 'G', 'B', 'G', 'M']
    },
    away: {
      standing: { points: 35, position: 6, wins: 10, draws: 5, losses: 3, goalDiff: 8, goalsFor: 30, goalsAgainst: 22, away: { wins: 4, draws: 2, losses: 2, goalsFor: 12, goalsAgainst: 10 } },
      last5: ['G', 'B', 'M', 'G', 'B'],
      last5venue: ['G', 'B', 'M', 'G', 'B']
    }
  }
};

console.log('\n=== SENARYO 1: Dengeli Maç (1:%44, X:%23, 2:%33) ===');
const result1 = analyzeUserMatch(scenario1);
console.log('✓ mainTrend:', result1.sportotoDecision?.mainTrend);
console.log('✓ bankoStatus:', result1.sportotoDecision?.bankoStatus);
console.log('✓ riskLevel:', result1.sportotoDecision?.riskLevel);
console.log('✓ narrowCoupon:', result1.sportotoDecision?.narrowCoupon);
console.log('✓ safeCoupon:', result1.sportotoDecision?.safeCoupon);
console.log('✓ Beklenen: bankoStatus=Hayır, riskLevel=Yüksek veya Çok Yüksek');
console.log('✓ X Silinmez etiketi mevcut mi?', result1.sportotoDecision?.tags?.some(t => t.name === 'Beraberlik Riski' || t.name === 'X Silinmez'));

// TEST SENARYO 2: Güçlü favori, düşük risk
const scenario2 = {
  home: { name: 'Güçlü Takım', mediumName: 'Güçlü' },
  away: { name: 'Zayıf Takım', mediumName: 'Zayıf' },
  league: 'Super Lig',
  date: new Date().toISOString(),
  analysis: {
    probabilities: { '1': 62, 'X': 18, '2': 20 },
    surpriseScore: 30,
    estimated: false
  },
  stats: {
    home: {
      standing: { points: 55, position: 1, wins: 17, draws: 4, losses: 1, goalDiff: 35, goalsFor: 52, goalsAgainst: 17, home: { wins: 9, draws: 1, losses: 0, goalsFor: 28, goalsAgainst: 5 } },
      last5: ['G', 'G', 'G', 'G', 'B']
    },
    away: {
      standing: { points: 20, position: 18, wins: 4, draws: 8, losses: 8, goalDiff: -20, goalsFor: 18, goalsAgainst: 38, away: { wins: 1, draws: 3, losses: 6, goalsFor: 6, goalsAgainst: 18 } },
      last5: ['M', 'B', 'M', 'M', 'M']
    }
  }
};

console.log('\n=== SENARYO 2: Güçlü Favori (1:%62, X:%18, 2:%20, veri yüksek) ===');
const result2 = analyzeUserMatch(scenario2);
console.log('✓ mainTrend:', result2.sportotoDecision?.mainTrend);
console.log('✓ bankoStatus:', result2.sportotoDecision?.bankoStatus);
console.log('✓ riskLevel:', result2.sportotoDecision?.riskLevel);
console.log('✓ narrowCoupon:', result2.sportotoDecision?.narrowCoupon);
console.log('✓ Beklenen: bankoStatus=Şartlı veya Evet, riskLevel=Düşük veya Orta');

// TEST SENARYO 3: X canlı, kapama adayı
const scenario3 = {
  home: { name: 'Takım A', mediumName: 'A' },
  away: { name: 'Takım B', mediumName: 'B' },
  league: 'Super Lig',
  date: new Date().toISOString(),
  analysis: {
    probabilities: { '1': 35, 'X': 35, '2': 30 },
    surpriseScore: 55,
    estimated: true
  },
  stats: {
    home: {
      standing: { points: 38, position: 4, wins: 11, draws: 5, losses: 4, goalDiff: 10, goalsFor: 32, goalsAgainst: 22, home: { wins: 5, draws: 3, losses: 2 } },
      last5: ['G', 'B', 'G', 'B', 'M']
    },
    away: {
      standing: { points: 36, position: 5, wins: 10, draws: 6, losses: 4, goalDiff: 8, goalsFor: 30, goalsAgainst: 22, away: { wins: 5, draws: 2, losses: 3 } },
      last5: ['G', 'B', 'G', 'B', 'G']
    }
  }
};

console.log('\n=== SENARYO 3: Dengeli (1:%35, X:%35, 2:%30, tahmine dayalı) ===');
const result3 = analyzeUserMatch(scenario3);
console.log('✓ mainTrend:', result3.sportotoDecision?.mainTrend);
console.log('✓ bankoStatus:', result3.sportotoDecision?.bankoStatus);
console.log('✓ riskLevel:', result3.sportotoDecision?.riskLevel);
console.log('✓ narrowCoupon:', result3.sportotoDecision?.narrowCoupon);
console.log('✓ safeCoupon:', result3.sportotoDecision?.safeCoupon);
console.log('✓ Beklenen: bankoStatus=Hayır, riskLevel=Yüksek, Kapama Adayı etiketi');

// TEST SENARYO 4: Veri güvenliği düşük
const scenario4 = {
  home: { name: 'Takım C', mediumName: 'C' },
  away: { name: 'Takım D', mediumName: 'D' },
  league: 'Super Lig',
  date: new Date().toISOString(),
  analysis: {
    probabilities: { '1': 50, 'X': 20, '2': 30 },
    surpriseScore: 40
  },
  stats: {
    home: {
      standing: { points: 42, position: 2, wins: 13, draws: 3, losses: 4, goalDiff: 18 },
      last5: ['G', 'G', 'B', 'G', 'M']
    },
    away: {
      standing: { points: 32, position: 8, wins: 9, draws: 5, losses: 6, goalDiff: 5 },
      last5: ['B', 'M', 'G', 'B', 'M']
    }
  }
};

console.log('\n=== SENARYO 4: Veri Güvenliği Düşük (ekik oyuncu, hoca verisi yok) ===');
const result4 = analyzeUserMatch(scenario4);
console.log('✓ mainTrend:', result4.sportotoDecision?.mainTrend);
console.log('✓ bankoStatus:', result4.sportotoDecision?.bankoStatus);
console.log('✓ dataConfidence:', result4.sportotoDecision?.dataConfidence);
console.log('✓ unknownData:', result4.sportotoDecision?.unknownData);
console.log('✓ Beklenen: bankoStatus=Hayır, dataConfidence=Orta/Düşük, Veri Eksikliği Riski etiketi');

// TEST SENARYO 5: Veri yok
const scenario5 = {
  home: { name: 'E', mediumName: 'E' },
  away: { name: 'F', mediumName: 'F' },
  league: 'Super Lig',
  date: new Date().toISOString(),
  analysis: {},
  stats: { home: {}, away: {} }
};

console.log('\n=== SENARYO 5: Veri Yok ===');
const result5 = analyzeUserMatch(scenario5);
console.log('✓ sportotoDecision.available:', result5.sportotoDecision?.available);
console.log('✓ Beklenen: available=false');

console.log('\n✅ TÜM TEST SENARYOLARI TAMAMLANDI\n');
