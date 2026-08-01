// Radar 5 için kullanıcı tarafından doğrulanmış sezon arşivini ekler.
// Mevcut sezon kayıtlarını değiştirmez; yalnız eksik haftaları atomik olarak ekler.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) throw new Error('Kaynak sezon JSON dosyası belirtilmedi.');

const root = join(import.meta.dirname, '..', 'data', 'history');
const matchesDir = join(root, 'matches');
const seasonYear = '2025/2026';
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const weeks = Array.isArray(source?.weeks) ? source.weeks : [];
if (weeks.length !== 51) throw new Error(`Beklenen 51 hafta yerine ${weeks.length} hafta bulundu.`);

function atomicWrite(path, value) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, path);
}

function iso(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

mkdirSync(matchesDir, { recursive: true });
const roundsPath = join(root, 'rounds.json');
const rounds = existsSync(roundsPath) ? JSON.parse(readFileSync(roundsPath, 'utf8')) : [];
const byId = new Map(rounds.map((row) => [String(row.roundId), row]));
const added = [];

for (const week of weeks) {
  const id = String(week.roundId);
  const rows = Array.isArray(week.matches) ? week.matches : [];
  if (rows.length !== 15 || new Set(rows.map((m) => Number(m.pos))).size !== 15) {
    throw new Error(`${week.week}. hafta 15 benzersiz sıra içermiyor.`);
  }
  if (rows.some((m) => !['1', 'X', '2'].includes(m.result) || Number(m.pos) < 1 || Number(m.pos) > 15)) {
    throw new Error(`${week.week}. haftada geçersiz sonuç veya sıra var.`);
  }
  if (byId.has(id)) continue;

  const raw = JSON.stringify(week);
  const sourceHash = createHash('sha256').update(raw).digest('hex');
  const observedAt = new Date().toISOString();
  const roundCloseAt = iso(week.closeDate);
  const matchRows = rows.map((m) => ({
    position: Number(m.pos), homeTeam: m.home, awayTeam: m.away,
    matchAt: iso(m.date), scoreHome: m.homeScore ?? null, scoreAway: m.awayScore ?? null,
    result: m.result, resultValid: true, conflict: null, sourceHash,
    observedAt, fetchedAt: observedAt, provenanceType: 'official_result_history', correctionVersion: 1,
  }));
  atomicWrite(join(matchesDir, `${id}.json`), matchRows);
  const round = {
    roundId: id, seasonYear, weekName: `${week.week}. Hafta`, status: 'completed',
    roundCloseAt, matchCount: 15, sourceUrl: 'local-import://garantili-sistem/spor_toto_2025_2026.json',
    sourceType: 'verified-local-season-archive', sourceHash, fetchedAt: observedAt,
    observedAt, provenanceType: 'official_result_history', correctionVersion: 1,
  };
  rounds.push(round); byId.set(id, round); added.push(week.week);
}

atomicWrite(roundsPath, rounds);
console.log(JSON.stringify({ season: seasonYear, addedWeeks: added, addedMatches: added.length * 15 }));
