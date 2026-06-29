// Anahtarınla erişebildiğin (FootyStats panelinde seçtiğin) ligleri ve
// sezon id'lerini listeler. Anahtarı ekrana yazmaz.
// Çalıştır: node tools/list-leagues.js
import { config } from '../src/config.js';

const url = `${config.footyStatsApi}/league-list?key=${config.footyStatsKey}&chosen_leagues_only=true`;

const res = await fetch(url);
const json = await res.json();

if (!json.success) {
  console.log('Liste alınamadı:', json.message);
  console.log('(FootyStats panelinde henüz lig seçmediysen önce orada lig seçmelisin.)');
  process.exit(0);
}

console.log(`Seçili lig sayısı: ${json.data.length}\n`);
for (const l of json.data) {
  const seasons = (l.season || []).map((s) => `${s.id}(${s.year})`).join('  ');
  console.log(`• ${l.country} — ${l.name}`);
  console.log(`   season id'leri: ${seasons}`);
}
