// LEGACY VERİ ARŞİVLEME — eski radar/snapshot kayıtlarını AKTİF sistemden ayırır.
// ---------------------------------------------------------------------------
// * SİLMEZ: dosyaları backend/legacy_archive/{snapshots,radar,scorecards}/ altına
//   TAŞIR ve manifest.json'a kaydeder (orijinal yol, yeni yol, tür, provenance,
//   hariç tutma nedeni, sha256, taşınma zamanı).
// * PROVENANCE DENETİMLİ: yalnız legacy_backfill / retrospective_backtest /
//   demo / unknown (isOfficialForward !== true) kayıtlar taşınır.
// * OFFICIAL_FORWARD ASLA TAŞINMAZ: böyle bir kayıt görülürse işlem DURUR.
// * GÜNCEL HAFTA KORUNUR: aktif bültenin kendi çalışma snapshot'ı taşınmaz
//   (hafta geçince bir sonraki çalıştırmada taşınır) — önce `npm run refresh`.
// * IDEMPOTENT: ikinci kez çalıştırmak dosya çoğaltmaz, hata vermez.
// Kullanım:  npm run archive:legacy -- --dry-run   (yalnız rapor)
//            npm run archive:legacy                (gerçek taşıma)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordFromLegacyCache, classifyRecord, PROVENANCE } from '../src/scorecards/provenance.js';

const here = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = process.env.CACHE_DIR || join(here, '..', 'cache');
const LEGACY_DIR = process.env.LEGACY_ARCHIVE_DIR || join(here, '..', 'legacy_archive');
const MANIFEST = join(LEGACY_DIR, 'manifest.json');
const DRY = process.argv.includes('--dry-run');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

function loadManifest() {
  if (!existsSync(MANIFEST)) return { createdAt: new Date().toISOString(), entries: [] };
  return readJson(MANIFEST) || { createdAt: new Date().toISOString(), entries: [] };
}

// Aktif bültenin round'u (çalışma kaydı korunur) — pending ise korunacak yok.
function currentRoundId() {
  const b = readJson(join(CACHE_DIR, 'bulletin.json'));
  const d = b?.data;
  return d && !d.pending && d.roundId != null ? Number(d.roundId) : null;
}

function planFile(file, kind) {
  const full = join(CACHE_DIR, file);
  const wrapped = readJson(full);
  const data = wrapped?.data ?? wrapped ?? {};
  const rid = Number(String(file).replace(/\D/g, ''));
  const rec = recordFromLegacyCache(rid, { ...data, savedAt: data.savedAt ?? wrapped?.savedAt ?? null });
  const cls = classifyRecord(rec);
  return {
    file, kind, roundId: rid, full,
    provenanceType: cls.provenanceType,
    isOfficialForward: cls.isOfficialForward,
    exclusionReason: cls.exclusionReason ?? null,
    backfilled: rec.backfilled === true,
    savedAt: rec.createdAt ?? null,
  };
}

export function runArchiveLegacy({ dryRun = DRY, log = console.log } = {}) {
  if (!existsSync(CACHE_DIR)) { log('[archive:legacy] cache klasörü yok — yapılacak iş yok.'); return { moved: [], skipped: [], dryRun }; }
  const files = readdirSync(CACHE_DIR);
  const curRid = currentRoundId();

  const candidates = [
    ...files.filter((f) => /^snapshot-\d+\.json$/.test(f)).map((f) => planFile(f, 'snapshot')),
    ...files.filter((f) => /^radar-\d+\.json$/.test(f)).map((f) => planFile(f, 'radar')),
    ...files.filter((f) => /^(scorecard|criteriaScorecard|radarScorecard)[-\w]*\.json$/.test(f)).map((f) => planFile(f, 'scorecard')),
  ];

  const moved = [], skipped = [];
  const manifest = loadManifest();
  const already = new Set(manifest.entries.map((e) => e.originalPath));

  for (const c of candidates) {
    // GÜVENLİK KİLİDİ: official_forward kaydı görülürse İŞLEM DURUR (taşınmaz).
    if (c.isOfficialForward) {
      throw new Error(`[archive:legacy] DURDURULDU: ${c.file} official_forward görünüyor — resmî ileri-test kaydı taşınamaz. Hiçbir dosya taşınmadı (bu dosyadan itibaren).`);
    }
    // Aktif haftanın çalışma snapshot'ı korunur (yeni sistemin geçici kaydı).
    if (c.kind === 'snapshot' && curRid != null && c.roundId === curRid) {
      skipped.push({ ...c, skipReason: 'current_round_working_cache' });
      continue;
    }
    const subdir = c.kind === 'snapshot' ? 'snapshots' : c.kind === 'radar' ? 'radar' : 'scorecards';
    const destDir = join(LEGACY_DIR, subdir);
    const dest = join(destDir, c.file);

    if (dryRun) { moved.push({ ...c, dest, dryRun: true }); continue; }

    mkdirSync(destDir, { recursive: true });
    const buf = readFileSync(c.full);
    const hash = sha256(buf);
    if (existsSync(dest)) {
      // Idempotency: hedefte aynı içerik varsa kaynak sadece not edilir; farklıysa
      // sürümlü ad ile taşınır (veri KAYBEDİLMEZ, üzerine yazılmaz).
      const destHash = sha256(readFileSync(dest));
      if (destHash === hash) {
        renameSync(c.full, `${dest}`); // aynı içerik — kaynağı hedefe indirger (tek kopya)
      } else {
        renameSync(c.full, join(destDir, `${c.file}.${hash.slice(0, 8)}.json`));
      }
    } else {
      renameSync(c.full, dest);
    }
    const entry = {
      originalPath: `backend/cache/${c.file}`,
      newPath: `backend/legacy_archive/${subdir}/${c.file}`,
      roundId: c.roundId, kind: c.kind,
      backfilled: c.backfilled,
      provenanceType: c.provenanceType,
      exclusionReason: c.exclusionReason,
      savedAt: c.savedAt,
      movedAt: new Date().toISOString(),
      sha256: hash,
    };
    if (!already.has(entry.originalPath)) manifest.entries.push(entry);
    else {
      const i = manifest.entries.findIndex((e) => e.originalPath === entry.originalPath);
      manifest.entries[i] = entry; // tekrar taşınan (yeniden oluşmuş) dosya: kayıt güncellenir
    }
    moved.push({ ...c, dest, hash });
  }

  if (!dryRun && moved.length) {
    manifest.updatedAt = new Date().toISOString();
    mkdirSync(LEGACY_DIR, { recursive: true });
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }

  log(`[archive:legacy] ${dryRun ? 'DRY-RUN (taşıma YOK)' : 'TAŞINDI'}: ${moved.length} dosya · atlanan: ${skipped.length}${curRid != null ? ` · korunan güncel hafta: ${curRid}` : ''}`);
  for (const m of moved) log(`  ${dryRun ? '→ taşınacak' : '✓ taşındı'}: ${m.file} (${m.provenanceType}${m.exclusionReason ? ` · ${m.exclusionReason}` : ''})`);
  for (const s of skipped) log(`  ◦ korundu: ${s.file} (${s.skipReason})`);
  if (!moved.length && !skipped.length) log('  aktif cache temiz — taşınacak legacy kayıt yok.');
  return { moved, skipped, dryRun, manifestPath: MANIFEST };
}

// Doğrudan çalıştırma (npm run archive:legacy)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('archive-legacy-data.js')) {
  try { runArchiveLegacy({}); } catch (e) { console.error(e.message); process.exit(1); }
}
