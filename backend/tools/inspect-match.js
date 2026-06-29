// Bir maçın FootyStats'teki ham verisini gösterir (oran, xG, ppg, potansiyel).
// Kullanım: node tools/inspect-match.js 16627 seoul incheon
import { config } from '../src/config.js';

const [seasonId, homeTerm, awayTerm] = process.argv.slice(2);
const url = `${config.footyStatsApi}/league-matches?key=${config.footyStatsKey}&season_id=${seasonId}`;
const json = await (await fetch(url)).json();
if (!json.success) { console.log('Hata:', json.message); process.exit(0); }

const re = (t) => new RegExp(t, 'i');
const ms = json.data.filter(
  (m) => re(homeTerm).test(m.home_name) && re(awayTerm).test(m.away_name)
);
console.log(`Bulunan maç: ${ms.length}\n`);
for (const m of ms) {
  const d = new Date(m.date_unix * 1000).toISOString().slice(0, 16);
  console.log(`--- ${m.home_name} vs ${m.away_name} | ${d} | ${m.status} ---`);
  console.log(`  oran 1/X/2     : ${m.odds_ft_1} / ${m.odds_ft_x} / ${m.odds_ft_2}`);
  console.log(`  prematch xG    : ${m.team_a_xg_prematch} - ${m.team_b_xg_prematch}`);
  console.log(`  prematch PPG   : ${m.pre_match_home_ppg} - ${m.pre_match_away_ppg}`);
  console.log(`  potansiyel     : over2.5=${m.o25_potential}  btts=${m.btts_potential}`);
}
