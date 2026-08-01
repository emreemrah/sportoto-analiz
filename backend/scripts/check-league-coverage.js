// LİG KAPSAM DENETİMİ — kaynak (FootyStats) planında hangi ligler gerçekten var?
// ---------------------------------------------------------------------------
// Amaç: bültendeki "Bu lig için güncel kaynak verisi bulunamadı" maçlarının
// kök nedenini KANITLA ayırmak:
//   a) Lig planda VAR ama FOOTYSTATS_SEASON_IDS listesinde güncel sezonu YOK
//      → script eklenmesi gereken seasonId'yi söyler (elle .env'e eklenir).
//   b) Lig planda YOK → dürüst durum: maç 'Yetersiz Veri' kalır; sahte veri
//      eklenmez, başka sezon 'güncelmiş gibi' kullanılamaz.
// Kullanım (backend klasöründe, internet gerektirir):  node scripts/check-league-coverage.js
// Not: yalnız SALT-OKUNUR sorgu yapar; cache'e/analize hiçbir şey yazmaz.
import 'dotenv/config';

const KEY = process.env.FOOTYSTATS_API_KEY;
if (!KEY || KEY === 'example') {
  console.error('FOOTYSTATS_API_KEY bulunamadı (backend/.env) — denetim çalıştırılamadı.');
  process.exit(1);
}
const chosen = String(process.env.FOOTYSTATS_SEASON_IDS || '')
  .split(',').map((s) => Number(s.trim())).filter(Number.isFinite);

const ARANAN = ['Poland', 'Denmark', 'Finland', 'Sweden', 'Norway']; // bülten ülkeleri

const res = await fetch(`https://api.football-data-api.com/league-list?key=${KEY}`);
if (!res.ok) { console.error('league-list isteği başarısız:', res.status); process.exit(1); }
const body = await res.json();
const leagues = body?.data || [];

console.log(`Plan kapsamındaki toplam lig: ${leagues.length} · .env seçili sezon sayısı: ${chosen.length}\n`);

const chosenSet = new Set(chosen);
for (const country of ARANAN) {
  const hits = leagues.filter((L) => (L.country || L.name || '').includes(country));
  if (!hits.length) { console.log(`✗ ${country}: planında lig YOK — bu ülkenin maçları 'Yetersiz Veri' kalır (dürüst durum).`); continue; }
  for (const L of hits) {
    const seasons = (L.season || []).sort((a, b) => (b.year || 0) - (a.year || 0));
    const latest = seasons[0];
    const inEnv = seasons.some((s) => chosenSet.has(Number(s.id)));
    console.log(`${inEnv ? '✓' : '➜'} ${L.name}`);
    for (const s of seasons.slice(0, 2)) {
      console.log(`    seasonId=${s.id} yıl=${s.year} ${chosenSet.has(Number(s.id)) ? '(.env listesinde VAR)' : ''}`);
    }
    if (!inEnv && latest) {
      console.log(`    → EKLENMELİ: backend/.env → FOOTYSTATS_SEASON_IDS sonuna ,${latest.id} ekleyin (en güncel sezon).`);
    }
  }
}
console.log('\nNot: id ekledikten sonra backend yeniden başlatılıp `npm run refresh` çalıştırılmalı.');
