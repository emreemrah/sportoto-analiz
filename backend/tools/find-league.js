// FootyStats'teki TÜM ligler içinde arama yapar (sadece seçili olanlar değil).
// Kullanım: node tools/find-league.js korea
import { config } from '../src/config.js';

const term = (process.argv[2] || '').toLowerCase();
const url = `${config.footyStatsApi}/league-list?key=${config.footyStatsKey}`;
const json = await (await fetch(url)).json();
if (!json.success) { console.log('Liste alınamadı:', json.message); process.exit(0); }

const hits = json.data.filter(
  (l) => `${l.country} ${l.name}`.toLowerCase().includes(term)
);
console.log(`"${term}" için ${hits.length} sonuç:\n`);
for (const l of hits) {
  const recent = (l.season || []).slice(-3).map((s) => `${s.id}(${s.year})`).join('  ');
  console.log(`• ${l.country} — ${l.name}`);
  console.log(`   son sezonlar: ${recent}`);
}
