// Basit test
import { analyzeUserMatch } from './src/userMatchEngine.js';

const match = {
  home: { name: 'Home', mediumName: 'H' },
  away: { name: 'Away', mediumName: 'A' },
  league: 'Super Lig',
  date: new Date().toISOString(),
  analysis: {
    probabilities: { '1': 44, 'X': 23, '2': 33 },
    surpriseScore: 45
  },
  stats: {
    home: { standing: { points: 40, position: 3, wins: 12, draws: 4, losses: 2, home: {} }, last5: ['G', 'G', 'B', 'G', 'M'] },
    away: { standing: { points: 35, position: 6, wins: 10, draws: 5, losses: 3, away: {} }, last5: ['G', 'B', 'M', 'G', 'B'] }
  }
};

try {
  const result = analyzeUserMatch(match);
  console.log('✓ Test başarılı!');
  console.log('  ok:', result.ok);
  console.log('  sportotoDecision.available:', result.sportotoDecision?.available);
  console.log('  sportotoDecision.bankoStatus:', result.sportotoDecision?.bankoStatus);
} catch (e) {
  console.error('✗ Test hatası:', e.message);
  process.exit(1);
}
