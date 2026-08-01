/**
 * GERÇEK VERİ DENETİMİ — Radar 4 "eksik oranın sebebi".
 *
 * NEDEN: birim testler fixture ile çalışır. Bu betik makinedeki GERÇEK bülten
 * önbelleğini ve arşivini KOPYALAYIP /api/radar/daily-odds ucunu gerçekten
 * ayağa kaldırır; böylece sebeplerin gerçek haftada ne yazdığı görülür.
 *
 * SALT OKUR: önbellek/arşiv geçici bir dizine KOPYALANIR, orijinaline yazılmaz.
 * Dış ağa çıkmaz, .env okumaz, anahtar kullanmaz.
 *
 * Çalıştırma (backend/ içinden):  node scripts/probe-odds-reason.mjs
 */
import { mkdtempSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kok = join(here, '..');

const cacheKopya = mkdtempSync(join(tmpdir(), 'sportoto-probe-cache-'));
const arsivKopya = mkdtempSync(join(tmpdir(), 'sportoto-probe-arsiv-'));
if (existsSync(join(kok, 'cache'))) cpSync(join(kok, 'cache'), cacheKopya, { recursive: true });
if (existsSync(join(kok, 'data', 'archive'))) cpSync(join(kok, 'data', 'archive'), arsivKopya, { recursive: true });

process.env.CACHE_DIR = cacheKopya;
process.env.ARCHIVE_DIR = arsivKopya;
process.env.ARCHIVE_DRIVER = 'file';

const express = (await import('express')).default;
const { default: radarRoutes } = await import('../src/routes/radar.js');

const app = express();
app.use('/api/radar', radarRoutes);
const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

const r = await fetch(`${base}/api/radar/daily-odds`);
const d = await r.json();

console.log(`hafta: ${d.round || d.roundId} · HTTP ${r.status}`);
console.log(`sayaç: ${JSON.stringify(d.counts)}`);
console.log(`gün başına oranı olan maç: ${(d.days || []).map((x) => x.date.slice(5) + '=' + x.withData).join(' ')}`);

const kod = {};
for (const m of d.matches || []) { const c = m.absence?.code || '(oran VAR)'; kod[c] = (kod[c] || 0) + 1; }
console.log(`sebep dağılımı: ${JSON.stringify(kod)}`);

console.log('\n--- maç maç ---');
for (const m of d.matches || []) {
  const ad = `${m.home || '?'} – ${m.away || '?'}`.padEnd(34);
  const s = m.absence ? `${m.absence.text}${m.absence.detail ? ' (' + m.absence.detail + ')' : ''}` : 'oran VAR';
  console.log(`${String(m.no).padStart(2)}  ${ad} ${s}`);
}

// ALTIN KURAL: boş hücre null KALMALI, sebep nesnesi oran TAŞIMAMALI.
let ihlal = 0; let notSayisi = 0;
for (const m of d.matches || []) {
  for (const [gun, n] of Object.entries(m.notes || {})) {
    notSayisi++;
    if (m.cells[gun] !== null) ihlal++;
    if (n.odds != null || n.home != null || n.draw != null || n.away != null) ihlal++;
  }
}
const marka = /footystats|bilyoner|nesine|misli|api-football/i;
const markaIhlal = (d.matches || []).some((m) =>
  (m.absence && marka.test(`${m.absence.text} ${m.absence.detail || ''}`)) ||
  Object.values(m.notes || {}).some((n) => marka.test(`${n.text} ${n.detail || ''}`)));

console.log(`\ntoplam hücre notu: ${notSayisi} · UYDURMA İHLALİ: ${ihlal} · MARKA ADI İHLALİ: ${markaIhlal ? 'VAR' : 'yok'}`);
await new Promise((res) => server.close(res));
process.exit(ihlal === 0 && !markaIhlal ? 0 : 1);
