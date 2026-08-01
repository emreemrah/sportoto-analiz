// BİLYONER OYNANMA YÜZDESİ ARŞİVİ — TEK SEFERLİK İÇERİ ALMA
// ---------------------------------------------------------------------------
// NEDEN: Bilyoner'in açık ucu (/api/sto/playratio) 27 Tem 2026'dan sonra anonim
// isteği reddediyor (HTTP 400, code 40319). Oynanma yüzdesi YALNIZ açık
// programda okunabilir; kapanan günler geriye dönük ÇEKİLEMEZ. Bu yüzden
// eldeki tek dürüst kaynak, o günlerde gerçekten yakalanmış dış arşivdir.
//
// NE YAPAR: Dış arşivdeki (oynanma_yuzdeleri.json) Bilyoner anlık görüntülerini
// bulletin_data_observations'a `source='bilyoner'` satırları olarak yazar.
// `observedAt` UYDURULMAZ — arşivdeki gerçek `capturedAt` kullanılır.
//
// NE YAPMAZ: Yüzde üretmez, tahmin etmez, eksik günü doldurmaz. Arşivde
// olmayan gün yazılmaz. Var olan satırın üstüne yazmaz (idempotent).
//
// KULLANIM:
//   node scripts/import-bilyoner-archive.mjs --file <yol>              # KURU ÇALIŞMA
//   node scripts/import-bilyoner-archive.mjs --file <yol> --apply      # yaz
//   ... --program 351 --round 1526 --sealed-only
//
// Varsayılan KURU ÇALIŞMA'dır: --apply verilmedikçe hiçbir şey yazılmaz.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getArchiveStore } from '../src/archive/store.js';
import { load } from '../src/cache.js';
import { PCT_METHODOLOGY_VERSION, validatePercentages } from '../src/providers/playedPercentages.js';

const PROVIDER_ID = 'bilyoner';
const IMPORT_TAG = 'external-archive-import-1';

// --- argümanlar -------------------------------------------------------------
function parseArgs(argv) {
  const a = { apply: false, sealedOnly: false, file: null, program: null, round: null };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--apply') a.apply = true;
    else if (k === '--sealed-only') a.sealedOnly = true;
    else if (k === '--file') a.file = argv[++i];
    else if (k === '--program') a.program = argv[++i];
    else if (k === '--round') a.round = argv[++i];
  }
  return a;
}

// --- zaman: saat dilimsiz damgayı İSTANBUL olarak oku -----------------------
// Dış arşivin `capturedAt` alanı offset TAŞIMAZ ("2026-07-28T23:55:00.663605")
// ve İstanbul yerel saatidir. `new Date(...)` bunu ÇALIŞTIRAN MAKİNENİN yerel
// saatine göre yorumlar: UTC bir sunucuda 23:55 → 23:55Z olur, bu da İstanbul'da
// ertesi günün 02:55'i demektir. Günlük mühür semantiği o gün kayar. Bu yüzden
// dilim açıkça uygulanır; sonuç makineden bağımsızdır.
const ARCHIVE_TZ = 'Europe/Istanbul';

function tzOffsetMs(tz, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  // Intl saniye hassasiyetinde biçimler; karşılaştırma da milisaniyesiz olmalı,
  // yoksa offset'e ms artığı sızar ve damga kayar.
  return asIfUtc - (date.getTime() - date.getUTCMilliseconds());
}

export function archiveStampToIso(stamp) {
  const s = String(stamp).replace(/(\.\d{3})\d+$/, '$1');   // mikrosaniyeyi kırp
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s).toISOString();  // offset varsa dokunma
  const asUtc = new Date(`${s}Z`);
  if (Number.isNaN(asUtc.getTime())) throw new Error(`Okunamayan zaman damgası: ${stamp}`);
  return new Date(asUtc.getTime() - tzOffsetMs(ARCHIVE_TZ, asUtc)).toISOString();
}

// --- ad eşleştirme guard'ı --------------------------------------------------
// Konum eşleştirmesi (matchNo → bülten sırası) tek başına yeterli DEĞİL: sıra
// kayarsa başka maçın yüzdesi yazılır. Bu yüzden takım adları da kabaca
// doğrulanır; tutmazsa o maç ATLANIR (yanlış veri yazmaktansa eksik kalsın).
const norm = (s) => String(s || '')
  .toLocaleLowerCase('tr')
  .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c]))
  .replace(/[^a-z0-9]/g, '');

function looksLikeSameTeam(a, b) {
  const x = norm(a); const y = norm(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  // İlk 4 harf ortaklığı (Djurgardens/Djurgarden, Vasteraas/Vasteras SK gibi)
  return x.slice(0, 4) === y.slice(0, 4);
}

// --- ana akış ---------------------------------------------------------------
// Hem CLI'dan hem başka bir modülden çağrılabilir. Çağrı ile gelen seçenekler
// argv'nin üstündedir; `throwOnError` verilirse process.exit yerine hata atar
// (sunucu içinden çağrıldığında süreci düşürmemek için).
export async function runImport(opts = {}) {
  const args = { ...parseArgs(process.argv.slice(2)), ...opts };
  const bail = (msg, code) => {
    if (args.throwOnError) throw new Error(msg);
    console.error(msg); process.exit(code);
  };
  if (!args.file) {
    bail('HATA: --file <oynanma_yuzdeleri.json yolu> zorunlu.', 2);
  }

  const archive = JSON.parse(readFileSync(args.file, 'utf8'));
  const programs = archive?.programs || {};
  const programKey = args.program || Object.keys(programs)[0];
  const program = programs[programKey];
  if (!program) {
    bail(`HATA: arşivde program ${programKey} yok. Mevcut: ${Object.keys(programs).join(', ')}`, 2);
  }

  const bulletin = load('bulletin')?.data;
  const roundId = String(args.round || bulletin?.roundId || '');
  if (!roundId) {
    bail('HATA: bülten cache boş — --round <roundId> ver.', 2);
  }
  const bMatches = bulletin?.matches || [];
  if (bMatches.length !== (program.matches || []).length) {
    bail(`HATA: maç sayısı uyuşmuyor (bülten ${bMatches.length}, arşiv ${(program.matches || []).length}). İçeri alma iptal.`, 2);
  }

  const snapshots = program?.sources?.[PROVIDER_ID]?.snapshots || [];
  const useSnaps = args.sealedOnly ? snapshots.filter((s) => s.sealed === true) : snapshots;
  if (!useSnaps.length) {
    bail(`HATA: ${PROVIDER_ID} için içeri alınacak anlık görüntü yok${args.sealedOnly ? ' (mühürlü)' : ''}.`, 2);
  }

  // Konum + ad eşleştirmesi (bir kez; tüm görüntüler aynı sırayı kullanır).
  const mapping = [];
  const nameMismatch = [];
  for (const am of program.matches) {
    const bm = bMatches.find((m) => Number(m.no) === Number(am.matchNo));
    if (!bm) { nameMismatch.push({ matchNo: am.matchNo, reason: 'bültende yok' }); continue; }
    const homeOk = looksLikeSameTeam(am.homeTeam, bm.home?.name ?? bm.home);
    const awayOk = looksLikeSameTeam(am.awayTeam, bm.away?.name ?? bm.away);
    if (!homeOk || !awayOk) {
      nameMismatch.push({
        matchNo: am.matchNo,
        arsiv: `${am.homeTeam} - ${am.awayTeam}`,
        bulten: `${bm.home?.name ?? bm.home} - ${bm.away?.name ?? bm.away}`,
        reason: 'ad tutmadı',
      });
      continue;                                   // ATLA — yanlış maça yazma
    }
    mapping.push({ matchNo: am.matchNo, matchKey: String(bm.sportotoMatchId ?? bm.no), label: `${am.homeTeam} - ${am.awayTeam}` });
  }

  console.log(`Program ${programKey} → bülten ${roundId}`);
  console.log(`Eşleşen maç: ${mapping.length}/${(program.matches || []).length}`);
  if (nameMismatch.length) {
    console.log('ATLANAN (ad/konum tutmadı — yanlış maça yazılmaz):');
    for (const n of nameMismatch) console.log('  ', JSON.stringify(n));
  }

  const store = getArchiveStore();
  // MÜKERRER KORUMASI SESSİZCE DÜŞMEZ. Bu okuma başarısız olursa "zaten var mı?"
  // kontrolü anlamını yitirir ve --apply aynı satırları ikinci kez yazabilir.
  // Bu yüzden hata YUTULMAZ: içeri alma durur.
  let existing;
  try {
    existing = await store.listObservations(roundId);
  } catch (e) {
    bail(`HATA: mevcut gözlemler okunamadı (${e.message}). Mükerrer koruması olmadan yazma yapılmaz.`, 3);
  }
  const seen = new Set(existing
    .filter((o) => o.source === PROVIDER_ID)
    .map((o) => `${o.matchId}|${new Date(o.observedAt).toISOString()}`));

  const planned = [];
  let skippedExisting = 0; let invalid = 0;
  for (const snap of useSnaps) {
    const observedAt = archiveStampToIso(snap.capturedAt);
    for (const map of mapping) {
      const row = (snap.rates || [])[map.matchNo - 1];
      if (!Array.isArray(row) || row.length !== 3) { invalid += 1; continue; }
      const v = validatePercentages({ '1': row[0], X: row[1], '2': row[2] });
      if (!v.valid) { invalid += 1; continue; }          // bozuk veri REDDEDİLİR
      if (seen.has(`${map.matchKey}|${observedAt}`)) { skippedExisting += 1; continue; }
      planned.push({
        matchId: map.matchKey,
        source: PROVIDER_ID,
        observedAt,
        playedPct: v.pct,
        // DÜRÜST SINIFLANDIRMA: bu görüntüler haftanın ortasında yakalandı;
        // hiçbiri 'opening' DEĞİL (firstObservedLate=true).
        // Kullanıcı kararı (31.07.2026): Bilyoner satırları Nesine/Misli ile
        // EŞİT statüde tutulur. Mührün izi `raw.sealed` alanında korunur, yani
        // hangi görüntünün mühürlü olduğu sonradan her zaman ayırt edilebilir.
        kind: 'regular',
        usableForPrediction: true,
        firstObservedLate: true,
        raw: {
          kind: 'regular',
          usableForPrediction: true,
          firstObservedLate: true,
          sealed: snap.sealed === true,        // mühür izi KORUNUR
          // PROVENANS: bu satır canlı çekimden DEĞİL, dış arşivden geldi.
          importedFrom: IMPORT_TAG,
          importedAt: new Date().toISOString(),
          sourceProgramNo: program.programNo ?? Number(programKey),
          position: map.matchNo,
          matchedBy: 'position+name',
          sourceType: 'external-archive',
          methodologyVersion: PCT_METHODOLOGY_VERSION,
          rawHash: createHash('sha256')
            .update(`${PROVIDER_ID}|${map.matchKey}|${observedAt}|${row.join(',')}`).digest('hex'),
        },
        _label: map.label,
      });
    }
  }

  console.log(`\nAnlık görüntü: ${useSnaps.map((s) => `${s.capturedAt.slice(0, 10)}${s.sealed ? '(mühürlü)' : '(mühürsüz)'}`).join(', ')}`);
  console.log(`Yazılacak satır: ${planned.length} · zaten var: ${skippedExisting} · geçersiz: ${invalid}`);
  if (planned.length) {
    console.log('Örnek:', JSON.stringify({ ...planned[0], raw: undefined }, null, 1));
  }

  if (!args.apply) {
    console.log('\nKURU ÇALIŞMA — hiçbir şey yazılmadı. Yazmak için --apply ekle.');
    return { written: 0, planned: planned.length, skippedExisting, invalid, matched: mapping.length, dryRun: true };
  }

  let written = 0;
  for (const p of planned) {
    const { _label, ...row } = p;
    await store.addObservations(roundId, [row]);
    written += 1;
  }
  console.log(`\nYAZILDI: ${written} satır (bülten ${roundId}, kaynak ${PROVIDER_ID}).`);
  return { written, planned: planned.length, skippedExisting, invalid, matched: mapping.length };
}

// Yalnız doğrudan çalıştırıldığında ana akış işler; import edildiğinde
// (test/başka betik) yalnız yardımcılar dışa açılır.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runImport().catch((e) => { console.error('İçeri alma hatası:', e.message); process.exit(1); });
}
