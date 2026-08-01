// RESMÎ GEÇMİŞ BÜLTEN İÇE AKTARICI — sportoto.gov.tr'nin KENDİ açık webapi'si.
// ---------------------------------------------------------------------------
// KAYNAK YÖNTEMİ: "spor-toto-listeler" sayfasının kullandığı oturumsuz resmî
// webapi uçları (sources/sportoto.js — GetGameRoundYears / GetGameRoundNames /
// GetGameMatches). Captcha/giriş/koruma atlatma YOK, endpoint tahmini YOK —
// uygulama zaten güncel bülteni bu API'den alıyor.
// * Sonuç normalizasyonu: resmî fullTimeWin 1→'1', 0→'X', 2→'2' (kaynak
//   katmanında) — burada AYRICA skorla çapraz doğrulanır. Uyuşmazsa kayıt
//   'result_conflict' olur, analiz dışı kalır, audit'e yazılır.
// * İlk yarı verisi HİÇBİR alana alınmaz (kaynak zaten yalnız 90 dk regular).
// * Idempotent + checkpoint'li + sayfalı: her çalışmada en çok maxRoundsPerRun
//   hafta işlenir, kaldığı yer DB'deki checkpoint'ten okunur; kaynak geçici
//   çökerse mevcut arşiv SİLİNMEZ, sonraki döngüde devam edilir.
// * Düzeltme: kaynak farklı değer gönderirse eski değer EZİLMEZCE
//   correctionVersion artırılır, eski/yeni değer audit'e yazılır.
import { createHash } from 'node:crypto';
import { getHistoryStore, HISTORY_PROVENANCE } from './historyStore.js';
import * as sportoto from '../sources/sportoto.js';

const SOURCE_URL = 'https://www.sportoto.gov.tr/spor-toto-listeler';
const SOURCE_TYPE = 'sportoto-webapi';

const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const utc = (v) => (v ? new Date(v).toISOString() : null);

// Resmî sonucu iç standarda çevir (0/X → X). Kaynak katmanı '1'/'X'/'2' verir;
// ham '0' gelirse de güvenle X'e katlanır.
export function normalizeResultSymbol(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === '1') return '1';
  if (s === '2') return '2';
  if (s === '0' || s === 'X') return 'X';
  return null;
}

// Skordan sonuç türet + kaynak sonucuyla karşılaştır.
export function validateScoreResult(scoreHome, scoreAway, sourceResult) {
  if (scoreHome == null || scoreAway == null) return { valid: false, derived: null, conflict: 'missing_score' };
  const derived = scoreHome > scoreAway ? '1' : scoreHome < scoreAway ? '2' : 'X';
  const src = normalizeResultSymbol(sourceResult);
  if (src == null) return { valid: false, derived, conflict: 'missing_result' };
  if (src !== derived) return { valid: false, derived, conflict: 'result_conflict' };
  return { valid: true, derived, conflict: null };
}

// Bir haftanın ham bülteninden geçmiş-arşiv maç satırları üret.
export function buildHistoryMatches(bulletin, { now = new Date().toISOString() } = {}) {
  return (bulletin.matches || []).map((m) => {
    const v = validateScoreResult(m.score?.home ?? null, m.score?.away ?? null, m.result);
    return {
      position: m.no,
      homeTeam: m.home?.name ?? '',
      awayTeam: m.away?.name ?? '',
      matchAt: utc(m.date),
      scoreHome: m.score?.home ?? null,
      scoreAway: m.score?.away ?? null,
      // Doğrulanmış sonuç: yalnız skorla uyuşan resmî sonuç; uyuşmazsa null +
      // conflict işareti (analiz/DNA dışı kalır — uydurma kabul yok).
      result: v.valid ? v.derived : null,
      resultValid: v.valid,
      conflict: v.conflict,
      sourceHash: sha({ n: m.no, h: m.home?.name, a: m.away?.name, s: m.score, r: m.result, d: m.date }),
      observedAt: now,
      fetchedAt: now,
      provenanceType: HISTORY_PROVENANCE,
      correctionVersion: 1,
    };
  });
}

// Hafta tamamlanmış mı? Arşive yalnız SONUÇLANMIŞ haftalar girer: her satır ya
// doğrulanmış sonuç taşır ya da (skor+sonuç MEVCUTKEN) çelişki taşır. Skoru/
// sonucu hiç açıklanmamış (missing_score/missing_result) hafta "tamam" DEĞİLDİR.
const isRoundComplete = (matches) =>
  matches.length > 0 && matches.every((m) => m.resultValid || m.conflict === 'result_conflict');

// ---------------------------------------------------------------------------
// TEK ÇALIŞMA — checkpoint'ten devam eder; maxRoundsPerRun haftayla sınırlı.
// api parametresi test edilebilirlik içindir (gerçek kaynak: sources/sportoto).
// ---------------------------------------------------------------------------
let importInFlight = false; // single-flight (scheduler + manuel çakışmasın)

export async function importOfficialHistoryTick({
  store = getHistoryStore(), api = sportoto,
  maxRoundsPerRun = 25, pauseMs = 400,
  currentRoundId = null,                    // güncel hafta ARŞİVE ALINMAZ (çalışma kaydıdır)
  now = () => new Date().toISOString(),
  log = console.log,
} = {}) {
  if (importInFlight) return { skipped: true, reason: 'in-flight' };
  importInFlight = true;
  try {
    // 1) Keşif: resmî sezon + hafta listesi (yalnız yayınlanmış).
    const years = await api.getYears();
    const checkpoint = (await store.getCheckpoint()) || { doneRounds: [], yearIndex: 0 };
    const doneSet = new Set((checkpoint.doneRounds || []).map(String));

    // ---- DEFTER–VERİ MUTABAKATI (hayalet kayıt temizliği) -------------------
    // Defter "bu hafta alındı" diyor diye veri VAR sayılamaz. İki gerçek durum
    // bunu bozar:
    //   (a) tur satırı depoda hiç yok (sürücü değişimi / kısmi yazım),
    //   (b) tur var ama status !== 'completed' → listAllMatches onu DÖNDÜRMEZ.
    // Eskiden yalnız deftere bakılıyordu (doneSet.has → atla), bu yüzden eksik
    // haftalar bir daha ASLA denenmiyordu: "imported: 0, totalDone: 144" ama
    // sıra geçmişi 143 yerine 67 turdan besleniyordu.
    // Çözüm: deftere yalnız GERÇEKTEN kullanılabilir turlar kalır; kalanlar
    // kendiliğinden yeniden içeri alınır (elle komut gerekmez).
    let hayalet = 0;
    let mutabakatOk = false;
    try {
      const hepsi = await store.listAllMatches();
      const kullanilabilir = new Set((hepsi || []).map((m) => String(m.roundId)));
      mutabakatOk = true;
      for (const id of [...doneSet]) {
        if (!kullanilabilir.has(id)) { doneSet.delete(id); hayalet += 1; }
      }
      if (hayalet) {
        log(`[history] defter–veri uyuşmazlığı: ${hayalet} hafta "alındı" yazıyordu ama arşivde kullanılabilir değil — yeniden alınacak.`);
      }
    } catch (e) {
      // Okuma hatası defteri BOZMAZ; bu turda mutabakat atlanır.
      log(`[history] mutabakat atlandı (${e.message}) — defter olduğu gibi korundu.`);
    }

    let processed = 0, imported = 0, correctionsFound = 0, conflicts = 0;
    for (const year of years) {
      if (processed >= maxRoundsPerRun) break;
      let rounds;
      try { rounds = await api.getRounds(year); } catch (e) { log(`[history] ${year} hafta listesi alınamadı: ${e.message}`); continue; }
      for (const r of rounds || []) {
        if (processed >= maxRoundsPerRun) break;
        if (!r?.id || r.isPublished === false) continue;
        if (String(r.id) === String(currentRoundId)) continue;      // güncel hafta atlanır
        if (doneSet.has(String(r.id))) continue;                     // idempotent: işlenmiş hafta

        processed += 1;
        let bulletin;
        try { bulletin = await api.getBulletinByRoundId(r.id); } catch (e) {
          log(`[history] hafta ${r.id} alınamadı (${e.message}) — sonraki döngüde denenecek.`);
          continue;                                                  // checkpoint'e YAZILMAZ → tekrar denenir
        }
        const matches = buildHistoryMatches(bulletin, { now: now() });
        if (!isRoundComplete(matches)) {
          // Henüz sonuçlanmamış geçmiş hafta (nadir) — tamamlanınca alınır.
          continue;
        }
        conflicts += matches.filter((m) => m.conflict === 'result_conflict').length;

        // 2) Düzeltme kontrolü: aynı hafta daha önce alınmışsa hash karşılaştır.
        const existing = await store.getMatches(r.id).catch(() => []);
        if (existing.length) {
          const byPos = new Map(existing.map((m) => [m.position, m]));
          let changed = false;
          for (const m of matches) {
            const old = byPos.get(m.position);
            if (old && old.sourceHash !== m.sourceHash) {
              changed = true;
              m.correctionVersion = (old.correctionVersion || 1) + 1;
              await store.appendAudit({
                roundId: r.id, position: m.position, action: 'correction',
                field: 'match', oldValue: JSON.stringify({ s: [old.scoreHome, old.scoreAway], r: old.result }),
                newValue: JSON.stringify({ s: [m.scoreHome, m.scoreAway], r: m.result }),
                sourceUrl: SOURCE_URL,
              });
            } else if (old) {
              m.correctionVersion = old.correctionVersion || 1;
            }
          }
          if (!changed) { doneSet.add(String(r.id)); continue; }     // birebir aynı → tekrar yazma
          correctionsFound += 1;
        }

        // 3) Kaydet (idempotent upsert; unique sezon/hafta/sıra).
        // roundCloseAt = haftanın kapanış çapası (öğrenme sınırı + "son N bülten"
        // sıralaması). Resmî hafta listesi kapanış tarihi TAŞIMAZ → en güvenilir
        // gerçek çapa SON MAÇIN tarihi (bülten o an fiilen tamamlanır).
        const lastMatchAt = matches.map((m) => m.matchAt).filter(Boolean).sort().pop() ?? null;
        await store.upsertRound({
          roundId: String(r.id), seasonYear: String(year), weekName: r.name ?? null,
          status: 'completed',
          roundCloseAt: utc(r.closeDate ?? r.roundCloseDate ?? null) ?? lastMatchAt,
          matchCount: matches.length,
          sourceUrl: SOURCE_URL, sourceType: SOURCE_TYPE,
          sourceHash: sha(matches.map((m) => m.sourceHash)),
          fetchedAt: now(), observedAt: now(),
          provenanceType: HISTORY_PROVENANCE,
        });
        await store.putMatches(String(r.id), matches);
        for (const m of matches.filter((x) => x.conflict === 'result_conflict')) {
          await store.appendAudit({
            roundId: r.id, position: m.position, action: 'result_conflict',
            field: 'result', oldValue: null,
            newValue: JSON.stringify({ score: [m.scoreHome, m.scoreAway] }),
            sourceUrl: SOURCE_URL,
          });
        }
        imported += 1;
        doneSet.add(String(r.id));
        if (pauseMs) await new Promise((res) => setTimeout(res, pauseMs)); // kaynağa yük bindirme
      }
    }

    await store.setCheckpoint({ doneRounds: [...doneSet], lastRunAt: now() });
    const remaining = null; // toplam bilinmez (sezonlar değişken) — done sayısı yeterli gösterge
    log(`[history] tur bitti: işlenen=${processed}, içeri alınan=${imported}, düzeltme=${correctionsFound}, çakışma=${conflicts}, toplam arşiv=${doneSet.size}`);
    return {
      ok: true, processed, imported, correctionsFound, conflicts,
      totalDone: doneSet.size, remaining,
      // Mutabakatta düşen hayalet kayıt sayısı (0 ise defter ile veri uyumlu).
      reconciledPhantoms: hayalet, reconciled: mutabakatOk,
    };
  } catch (e) {
    log(`[history] içe aktarma hatası: ${e.message} — arşiv korunuyor, sonraki döngüde devam.`);
    return { ok: false, error: e.message };
  } finally {
    importInFlight = false;
  }
}
