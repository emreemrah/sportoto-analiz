// RADAR MERKEZİ API'Sİ — /api/radar/*
// Merkezi hesaplanan (cache/persist edilen) sonuçları servis eder; kullanıcı
// başına ağır analiz YAPILMAZ. Kilitli haftalar yalnız mühürlü snapshot'tan
// okunur. Veri kaynağı olmayan uçlar başarılı fakat AÇIK "hasData:false" döner
// — sahte veri dönülmez.
//
// GERİYE UYUMLULUK: /api/radar/:roundId eski istemcilerin beklediği legacy
// alanları da (radar, radarFrozenAt, current) yanıt içinde taşır. Eski
// /api/surprise-radar ve /api/radar-scorecard uçlarına DOKUNULMAZ.
import { Router } from 'express';
import { load } from '../cache.js';
import { getArchiveStore } from '../archive/store.js';
import {
  getCurrentRadarCenter, getRadarCenterForRound, listRadarWeeks,
  getMethodology, getRadarDataQuality,
} from '../radar/radarService.js';
import { buildRadarScorecard } from '../radar/scorecard.js';
import { publicSourceStatus } from '../radar/publicBettingProviders.js';
import { oddsTimelinesBySource, pickPrimaryOddsSource } from '../radar/marketRadar.js';
import { oddsSourceLabel, sortOddsSources } from '../providers/oddsSources.js';
import { buildDailyOdds, buildDailyPlayed } from '../radar/dailyOdds.js';
import {
  findPlayedDna, findMovementDna, buildMovementRecords, movementOf, movementWords,
  pctText, MATCH_FILTERS, TOLERANCE_FILTERS, DEFAULT_TOLERANCE,
} from '../radar/playedDna.js';
import { toPctDnaRecords, findSimilarDnaMatches } from '../providers/percentageDna.js';
import { benzerSorgusu } from '../radar/publicBettingRadar.js';
import {
  collectPlayedDnaRecords, buildBandHistoryDetails, weekdayOf, dayKeyOf, DNA_START_ROUND_ID,
} from '../radar/playedDnaArchive.js';
import { PUBLIC_BANDS, RADAR_IDS } from '../radar/config.js';
import { kaynakKodu, kaynakId, anahtarlariKodla } from '../providers/kaynakKodu.js';
import { sonGunOynanmaIndeksi, oynanmaEkle, eskiHaftalariAt, LISTE_BASLANGIC_ROUND_ID } from '../radar/siraOynanma.js';
import {
  OYNANMA_TOLERANSLARI, ORAN_TOLERANSLARI, oynanmaYakin, oranYakin, sonGunDegerleri,
} from '../radar/siraFiltre.js';
// Etkin oynanma sağlayıcıları — susan kaynağın satırı da görünsün diye.
import { enabledProviders } from '../providers/playedPercentages.js';
import { getHistoryStore } from '../history/historyStore.js';
import { computePositionDna, positionStatsFromHistory, mergePositionStats, positionSummaryText, historyLearningFilter, positionMatchList } from '../history/positionDna.js';
import { getPositionStats } from '../archive/resultsService.js';
import { computeFreezeAt, firstKickoffMs, bulletinIdOf } from '../archive/snapshotService.js';

const router = Router();

const fail = (res, e) => {
  console.warn('[radar-api] hata:', e.message);
  res.status(500).json({ error: 'Radar isteği işlenemedi.' });
};

// GÜNLÜK OYNANMA YANITINDA KAYNAK KİMLİĞİNİ NÖTRLE.
// sources dizisi ve her hücrenin bySource anahtarları koda çevrilir; hücre
// içindeki `source` alanı da koda döner. İç kimlik yanıta HİÇ yazılmaz.
// (Radar 4 oran akışı tek kaynaklıdır ve marka değildir — dokunulmaz.)
function kaynaklariKodla(view) {
  if (!view || typeof view !== 'object') return view;
  return {
    ...view,
    sources: Array.isArray(view.sources) ? view.sources.map(kaynakKodu) : view.sources,
    // Gün satırındaki kaynak sayaçlarının ANAHTARLARI da koda çevrilir; bunlar
    // gözden kaçmıştı (yanıt taraması yakaladı).
    days: Array.isArray(view.days) ? view.days.map((d) => (
      d?.bySourceCounts ? { ...d, bySourceCounts: anahtarlariKodla(d.bySourceCounts) } : d
    )) : view.days,
    matches: Array.isArray(view.matches) ? view.matches.map((m) => ({
      ...m,
      cells: m.cells && typeof m.cells === 'object'
        ? Object.fromEntries(Object.entries(m.cells).map(([gun, hucre]) => [gun, {
          ...hucre,
          bySource: anahtarlariKodla(
            hucre?.bySource && Object.fromEntries(Object.entries(hucre.bySource)
              .map(([id, v]) => [id, { ...v, source: kaynakKodu(v?.source ?? id) }])),
          ),
        }]))
        : m.cells,
    })) : view.matches,
  };
}

// RADAR YANITINDA KAYNAK KİMLİĞİNİ NÖTRLE (Radar 3 sağlayıcı listesi).
// İç hesap ve MÜHÜRLÜ SNAPSHOT ham kimliği kullanır — benzer-DNA eşleşmesi ona
// bağlıdır ve geçmiş mühürler değiştirilemez. Nötrleme yalnız HTTP sınırında.
export function radarKaynaklariniKodla(view) {
  if (!view?.matches) return view;
  return {
    ...view,
    matches: view.matches.map((m) => {
      const r3 = m?.radars?.publicBetting;
      const saglayicilar = r3?.details?.providers;
      if (!Array.isArray(saglayicilar)) return m;
      return {
        ...m,
        radars: {
          ...m.radars,
          publicBetting: {
            ...r3,
            details: {
              ...r3.details,
              // TEK MASKELEME SINIRI. `details.providers` iki AYRI şekilde
              // gelebiliyor: veri varken gözlem özetleri (providerId + seri
              // alanları), veri yokken yalnız kaynak listesi. İkisi de artık
              // kimliği `providerId` alanında taşır; burada koda çevrilir.
              // `id`/`name` varsa DÜŞÜRÜLÜR — marka hiçbir şekilde çıkmaz.
              providers: saglayicilar.map((p) => {
                const { id, name, ...kalan } = p;
                void name; // marka adı bilerek düşürülür
                return { ...kalan, providerId: kaynakKodu(p.providerId ?? id) };
              }),
            },
          },
        },
      };
    }),
  };
}

// Legacy alanları yanıtla birleştir (eski RadarScreen istemcileri kırılmasın).
function withLegacy(view) {
  if (!view) return view;
  const legacy = view.legacy || {};
  return radarKaynaklariniKodla({
    ...view,
    radar: legacy.radar || [],
    radarFrozenAt: legacy.radarFrozenAt ?? view.sealedAt ?? null,
    radarFreezeAt: view.radarFreezeAt ?? view.freezeAt ?? null,
  });
}

// ---- GÜNCEL HAFTA -----------------------------------------------------------
router.get('/current', async (req, res) => {
  try {
    const view = await getCurrentRadarCenter();
    res.json(withLegacy(view));
  } catch (e) { fail(res, e); }
});

// ---- HAFTA LİSTESİ ----------------------------------------------------------
router.get('/weeks', async (req, res) => {
  try { res.json(await listRadarWeeks()); } catch (e) { fail(res, e); }
});

// ---- KARNE (yalnız mühürlü tahminlerden) ------------------------------------
let _scCache = { at: 0, val: null };
router.get('/scorecard', async (req, res) => {
  try {
    if (!_scCache.val || Date.now() - _scCache.at > 5 * 60 * 1000) {
      _scCache = { at: Date.now(), val: await buildRadarScorecard() };
    }
    res.json(_scCache.val);
  } catch (e) { fail(res, e); }
});

// ---- METODOLOJİ -------------------------------------------------------------
router.get('/methodology', (req, res) => {
  try { res.json(getMethodology()); } catch (e) { fail(res, e); }
});

// ---- VERİ YETERLİLİĞİ -------------------------------------------------------
router.get('/data-quality', async (req, res) => {
  try { res.json(await getRadarDataQuality()); } catch (e) { fail(res, e); }
});

// ---- HALK YÜZDESİ GEÇMİŞİ ---------------------------------------------------
// Kaynak yoksa: başarılı yanıt + hasData:false (sahte veri YOK).
router.get('/public-percentage-history', async (req, res) => {
  try {
    const src = publicSourceStatus();
    const store = getArchiveStore();
    const roundId = req.query.roundId || load('bulletin')?.data?.roundId || null;
    let observations = [];
    if (roundId != null) {
      const rows = await store.listObservations(String(roundId), req.query.matchId ?? null).catch(() => []);
      observations = rows
        .filter((o) => o.playedPct)
        // `source` ARŞİVDE ham iç kimliktir ('nesine'); yanıtta koda çevrilir.
        .map((o) => ({ matchId: o.matchId, source: kaynakKodu(o.source), observedAt: o.observedAt, percentages: o.playedPct }));
    }
    res.json({
      hasData: observations.length > 0,
      // Aynı maskeleme kuralı: ham kimlik sunucuda kalır, dışarı kod çıkar.
      providers: src.providers.map((p) => ({ providerId: kaynakKodu(p.providerId) })),
      providerNote: src.note,
      bandsVersion: PUBLIC_BANDS.version,
      roundId: roundId != null ? Number(roundId) : null,
      count: observations.length,
      observations,
      note: observations.length ? null : 'Oynanma yüzdesi gözlemi yok — veri kaynağı bekleniyor.',
    });
  } catch (e) { fail(res, e); }
});

// ---- ORAN / PİYASA GEÇMİŞİ --------------------------------------------------
router.get('/market-history', async (req, res) => {
  try {
    const store = getArchiveStore();
    const roundId = req.query.roundId || load('bulletin')?.data?.roundId || null;
    if (roundId == null) return res.json({ hasData: false, note: 'Güncel bülten yok.' });
    const rows = await store.listObservations(String(roundId), req.query.matchId ?? null).catch(() => []);
    const byMatch = new Map();
    for (const o of rows) {
      const k = String(o.matchId);
      if (!byMatch.has(k)) byMatch.set(k, []);
      byMatch.get(k).push(o);
    }
    // ÇOK KAYNAK: kaynaklar AYNI çizelgede karıştırılmaz (karışırsa kaynak
    // farkı sahte "oran hareketi" gibi görünür). Her kaynak kendi çizelgesinde;
    // üst düzey `timeline` geriye uyumluluk için BİRİNCİL kaynağındır.
    const series = [...byMatch.entries()].map(([matchId, list]) => {
      const bySource = oddsTimelinesBySource(list);
      const primary = pickPrimaryOddsSource(bySource);
      const trim = (t) => ({ observedAt: t.observedAt, odds: t.odds, implied: t.implied });
      return {
        matchId,
        source: primary ? oddsSourceLabel(primary) : null,   // marka adı YOK
        primarySource: primary,
        timeline: primary ? bySource[primary].map(trim) : [],
        bySource: Object.fromEntries(sortOddsSources(Object.keys(bySource))
          .map((id) => [id, { label: oddsSourceLabel(id), timeline: bySource[id].map(trim) }])),
      };
    }).filter((s) => s.timeline.length > 0);
    res.json({
      hasData: series.length > 0,
      roundId: Number(roundId),
      matchCount: series.length,
      series,
      note: series.length ? null : 'Bu hafta için oran gözlemi yok.',
    });
  } catch (e) { fail(res, e); }
});

// ---- GÜNLÜK SERİ BAĞLAMI (Radar 3 & 4 ortak) --------------------------------
// Güncel + geçmiş (mühürlü) hafta için kimlik/saat/gözlemleri toplar.
async function resolveDailyContext(req, store, cur) {
  const roundId = req.query.roundId ?? cur?.roundId ?? null;
  if (roundId == null) return null;
  const rid = String(roundId);
  let matches = []; let firstMs = null; let freezeAt = null; let sealed = false; let round = null;

  if (cur && String(cur.roundId) === rid) {
    // GÜNCEL HAFTA — kimlik/saat doğrudan bültenden.
    matches = (cur.matches || []).map((m) => ({
      no: m.no,
      matchId: String(m.sportotoMatchId ?? m.no),
      home: m.home?.name ?? m.home ?? null,
      away: m.away?.name ?? m.away ?? null,
      kickoffAt: m.date ?? null,
      // KAPSAM: oranı olmayan maçın SEBEBİNİ yazabilmek için taşınır. Oran
      // kaynağa eşleşmeye bağlıdır; eşleşmeyen maça oran hiç GELMEYECEKTİR,
      // eşleşen maçta ise kaynak henüz yayınlamamış olabilir. İkisi ayrı şey.
      coverage: m.coverage
        ? { ok: !!m.coverage.ok, reason: m.coverage.reason ?? null, code: m.coverage.code ?? null }
        : (m.footyMatchId != null ? { ok: true, reason: null, code: null } : null),
    }));
    firstMs = firstKickoffMs(cur.matches);
    freezeAt = computeFreezeAt(cur.matches);
    round = cur.round ?? null;
  } else {
    // GEÇMİŞ HAFTA — kimlik arşivden; yalnız mühürlü değerler okunur.
    const bId = bulletinIdOf(rid);
    const [b, rows] = await Promise.all([
      store.getBulletin(bId).catch(() => null),
      store.getMatches(bId).catch(() => []),
    ]);
    matches = (rows || []).map((r) => ({
      no: r.orderNo,
      matchId: String(r.matchId),
      home: r.homeName || null,
      away: r.awayName || null,
      kickoffAt: r.kickoffAt || null,
      // Arşivde kapsam RAPORU tutulmaz; ama mühürlenmiş kimlikte eşleşme kimliği
      // vardır. Alan HİÇ YOKSA (eski kayıt) "bilinmiyor" (null) kalır — yokluğu
      // "eşleşmedi" saymak uydurma sebep yazdırır.
      coverage: (r.externalIds && 'footyMatchId' in r.externalIds)
        ? (r.externalIds.footyMatchId != null
          ? { ok: true, reason: null, code: null }
          : { ok: false, reason: 'Bu maç kaynak verisiyle eşleştirilememişti', code: 'archived_unmatched' })
        : null,
    }));
    const kickoffs = matches.map((m) => new Date(m.kickoffAt || 0).getTime()).filter((t) => t > 0);
    firstMs = b?.firstMatchStartAt ? new Date(b.firstMatchStartAt).getTime()
      : (kickoffs.length ? Math.min(...kickoffs) : null);
    freezeAt = b?.freezeAt ?? (firstMs ? new Date(firstMs - 5 * 60e3).toISOString() : null);
    sealed = !!b && ['locked', 'completed', 'cancelled'].includes(b.status);
    round = b?.week ?? null;
  }
  const observations = await store.listObservations(rid, req.query.matchId ?? null).catch(() => []);
  return { rid, round, matches, observations, firstMs, freezeAt, sealed };
}

// ---- RADAR 4: GÜNLÜK ORAN TAKİBİ --------------------------------------------
// Gerçek 1/X/2 oranlarının GÜN GÜN mühürlü hareketi (Pazar→Cuma). Her günün
// mührü = 23:55 Europe/Istanbul (maç günü ilk maç −5 dk) öncesi o gün alınmış
// SON oran gözlemi; gözlem yoksa hücre boş (geriye dönük oran ÜRETİLMEZ).
// Radar 3 (oynanma yüzdesi) ile karışmaz — bu uç yalnız gerçek ORANı verir.
router.get('/daily-odds', async (req, res) => {
  try {
    const store = getArchiveStore();
    const ctx = await resolveDailyContext(req, store, load('bulletin')?.data || null);
    if (!ctx) return res.json({ hasData: false, days: [], matches: [], note: 'Güncel bülten yok.' });
    const g = buildDailyOdds({
      roundId: ctx.rid, round: ctx.round, matches: ctx.matches, observations: ctx.observations,
      firstKickoffMs: ctx.firstMs, freezeAt: ctx.freezeAt, sealed: ctx.sealed, now: Date.now(),
    });
    // KAYIT YOKSA SEBEBİ YAZ: kaynak bu haftanın oranlarını henüz yayınlamadıysa
    // (29 Ağu 2026: erken yayınlanan 4. Haftada 15 maçın hiçbirinde oran yoktu)
    // ekran "0 tanesinde oran var" ile bırakılmaz, bekleme sebebi söylenir.
    if (!(g.counts?.withAny > 0)) {
      const cur = load('bulletin')?.data;
      if (cur && String(cur.roundId) === String(ctx.rid) && (cur.matches || []).every((m) => !m.preOdds)) {
        g.note = [g.note, 'Kaynak bu haftanın oranlarını henüz yayınlamadı; yayınlanınca günlük kayıt otomatik başlar.'].filter(Boolean).join(' ');
      }
    }
    res.json(g);
  } catch (e) { fail(res, e); }
});

// ---- RADAR 3: GÜNLÜK OYNANMA YÜZDESİ ----------------------------------------
// Kullanıcıların 1/X/2 OYNAMA YÜZDESİNİN gün gün mühürlü değişimi (Pazar→Cuma).
// Radar 4 ile AYNI mühür kuralı; ama YÜZDE gösterir (oran DEĞİL). Gerçek yüzde
// sağlayıcısı yoksa hücreler boş kalır — uydurma yüzde ÜRETİLMEZ.
router.get('/daily-played', async (req, res) => {
  try {
    const store = getArchiveStore();
    const ctx = await resolveDailyContext(req, store, load('bulletin')?.data || null);
    if (!ctx) return res.json({ hasData: false, days: [], matches: [], note: 'Güncel bülten yok.' });
    // KAYNAK KİMLİĞİ DIŞARI ÇIKMAZ: yanıtta yalnız nötr kod (k1/k2/…) görünür.
    // İçeride kimlik aynen kalır — veri göçü yok (bkz. providers/kaynakKodu.js).
    const gorunum = kaynaklariKodla(buildDailyPlayed({
      roundId: ctx.rid, round: ctx.round, matches: ctx.matches, observations: ctx.observations,
      firstKickoffMs: ctx.firstMs, freezeAt: ctx.freezeAt, sealed: ctx.sealed, now: Date.now(),
    }));
    // ETKİN SAĞLAYICILARIN TAMAMI listelenir — yalnız veri YAZMIŞ olanlar değil.
    // Aksi hâlde bir sağlayıcı susunca satırı tümüyle kaybolur ve kullanıcı
    // eksiği göremez; "üç kaynak vardı, ikisi görünüyor" fark edilmez olurdu.
    // Boş kalan satır ekranda kendi sebebini yazar ("bu gün kayıt yok").
    const beklenen = enabledProviders().map((p) => kaynakKodu(p.id));

    // YALNIZ ETKİN KAYNAKLAR GÖSTERİLİR.
    //
    // Kaldırılan bir sağlayıcının ARŞİVDEKİ eski gözlemleri silinmez (geçmiş
    // kayıt değiştirilmez) ama ekranda da görünmez: kullanıcı artık toplanmayan
    // bir kaynağın satırını görüp onu güncel sanmamalı.
    //
    // Süzgeç `sources` ile YETİNMEZ, hücrelerin `bySource` anahtarlarını da
    // temizler — yoksa liste boş olsa bile satırlar veriden yeniden doğardı.
    const izinli = new Set(beklenen);
    gorunum.sources = (gorunum.sources || []).filter((s) => izinli.has(s));
    for (const m of gorunum.matches || []) {
      for (const [gun, hucre] of Object.entries(m.cells || {})) {
        if (!hucre?.bySource) continue;
        const suzulmus = Object.fromEntries(
          Object.entries(hucre.bySource).filter(([k]) => izinli.has(k)),
        );
        // Tek kaynağı olan bir hücre süzülünce boşalır: hücre `null` olur ki
        // ekran "bu gün kayıt yok" desin, boş bir kutu göstermesin.
        m.cells[gun] = Object.keys(suzulmus).length ? { ...hucre, bySource: suzulmus } : null;
      }
    }
    // KAYNAĞIN KENDİ SEBEBİ: bu hafta hiç kayıt yoksa ve toplayıcı kaynaktan
    // "program henüz yüklenmedi" notu aldıysa ekran "devre dışı" değil gerçek
    // sebebi yazar (29 Ağu 2026: "Yeni program 30.08.2026 10:00'da yüklenecek").
    if (!(gorunum.counts?.withAny > 0)) {
      const kaynakNotu = load('playedObserveStatus')?.data?.note;
      if (kaynakNotu) gorunum.note = [gorunum.note, kaynakNotu].filter(Boolean).join(' ');
    }
    res.json(gorunum);
  } catch (e) { fail(res, e); }
});

// ---- OYNANMA DNA'SI (Radar 3 detay paneli) ---------------------------------
// "Bu dağılıma benzer geçmiş kayıtlar hangi sonuçlarla bitmiş?" sorusunu YALNIZ
// gerçek arşivden yanıtlar. Kaynak asla karışmaz; alınmamış gün üretilmez.
// ÖNEMLİ: Bu uç GÖSTERİM içindir — radar skorunu/yönünü BESLEMEZ. Bu yüzden
// örneklem eşiği yoktur (1 kayıt varsa 1 kayıt gösterilir, adetle birlikte).
router.get('/played-dna', async (req, res) => {
  try {
    const store = getArchiveStore();
    const cur = load('bulletin')?.data || null;
    const ctx = await resolveDailyContext(req, store, cur);
    if (!ctx) return res.json({ hasData: false, note: 'Güncel bülten yok.' });

    const no = Number(req.query.no);
    // İstemci NÖTR KOD gönderir (k1/k2/…); içeride kimliğe çevrilir. Eski
    // istemciler ham kimlik yollarsa da kabul edilir (kaynakId geriye uyumlu).
    const source = kaynakId(String(req.query.source || '').trim());
    if (!Number.isFinite(no) || !source) {
      return res.status(400).json({ error: 'no ve source zorunlu' });
    }
    // Filtre birimi MAÇTIR (hafta değil): en yeni N sonuçlanmış maç.
    const limitRaw = req.query.limit == null || req.query.limit === 'all' ? null : Number(req.query.limit);
    const matchLimit = MATCH_FILTERS.includes(limitRaw) ? limitRaw : null;

    // YAKINLIK kullanıcı seçimi: 0 (birebir) · 1 · 2 · 3. Otomatik genişleme yok.
    const tolRaw = req.query.tol == null ? DEFAULT_TOLERANCE : Number(req.query.tol);
    const tolerance = TOLERANCE_FILTERS.includes(tolRaw) ? tolRaw : DEFAULT_TOLERANCE;
    const tolerances = [tolerance];

    // Güncel hafta günlük serisi (aynı gün-mühürleme mantığı).
    const daily = buildDailyPlayed({
      roundId: ctx.rid, round: ctx.round, matches: ctx.matches, observations: ctx.observations,
      firstKickoffMs: ctx.firstMs, freezeAt: ctx.freezeAt, sealed: ctx.sealed, now: Date.now(),
    });
    const row = (daily.matches || []).find((m) => Number(m.no) === no) || null;
    if (!row) return res.json({ hasData: false, note: 'Maç bulunamadı.' });

    // GERÇEK GÜNLÜK KAYIT: günlük görünüm boş günlerde son değeri TAŞIR
    // (carry-forward). DNA'da bu taşınan değer kullanılamaz — yoksa alınmamış
    // gün varmış gibi sayılırdı. Gözlemin kendi günü, hücrenin gününe eşit
    // olmalı. Eksik gün için veri ÜRETİLMEZ.
    const realPctOf = (k) => {
      const cell = row.cells?.[k]?.bySource?.[source];
      if (!cell?.percentages || !cell.observedAt) return null;
      const at = new Date(cell.observedAt).getTime();
      if (!Number.isFinite(at) || dayKeyOf(at) !== k) return null;   // taşınmış değer
      return cell.percentages;
    };
    const daysWithData = (daily.days || []).map((d) => d.date).filter((k) => realPctOf(k));
    const day = String(req.query.day || '') || daysWithData[daysWithData.length - 1] || null;
    const current = day ? realPctOf(day) : null;

    // Bu kaynağın gerçek günlük serisi (hareket için; eksik gün ÜRETİLMEZ).
    const daySeries = daysWithData.map((k) => ({
      dayKey: k, weekday: weekdayOf(k), pct: realPctOf(k),
    }));

    if (!current) {
      return res.json({
        hasData: false, source: kaynakKodu(source), position: no, day, matchLimit,
        note: 'Bu gün için bu kaynaktan kayıt yok.',
      });
    }

    // Geçmiş turların günlük mühürlü kayıtları (güncel tur hariç — sonucu yok).
    // Arşiv = GÖRÜNTÜLENEN HAFTADAN ÖNCESİ (51. hafta tabanıyla birlikte).
    // Geçmiş bir haftaya bakıldığında sonraki haftalar sızmaz.
    const records = await collectPlayedDnaRecords(store, {
      beforeRoundId: ctx.rid, force: req.query.force === '1',
    });
    const distribution = findPlayedDna(records, {
      current, source, position: no, weekday: weekdayOf(day), matchLimit, tolerances,
    });
    const movementNow = movementOf(daySeries);
    const movement = movementNow
      ? findMovementDna(buildMovementRecords(records), {
        // Eşleşme YÜZDE üzerinden: ilk gün ve son gün dağılımı birlikte.
        current: { openPct: movementNow.openPct, closePct: movementNow.closePct },
        source, position: no, matchLimit, tolerances,
      })
      : { hasData: false, note: 'Hareket için en az iki gerçek günlük kayıt gerekir.' };

    res.json({
      hasData: true,
      source: kaynakKodu(source), position: no, day, weekday: weekdayOf(day), matchLimit,
      current,
      // Arşivde resmî sonucu açıklanmış toplam maç sayısı (12 ise "Son 15" 12 kapsar).
      settledMatches: new Set(records.filter((r) => r.result).map((r) => `${r.roundId}|${r.matchKey}`)).size,
      // DNA arşivinin başladığı tur (51. hafta = 1525). Öncesi hiç okunmaz.
      archiveStartRoundId: DNA_START_ROUND_ID,
      distribution,
      movement: {
        current: movementNow?.delta || null,
        words: movementNow ? movementWords(movementNow.delta) : null,
        openText: movementNow ? pctText(movementNow.openPct) : null,
        closeText: movementNow ? pctText(movementNow.closePct) : null,
        dayCount: movementNow?.dayCount ?? daySeries.length,
        ...movement,
      },
    });
  } catch (e) { fail(res, e); }
});

// ---- BÜLTEN SIRA DNA'SI (Radar 5 detay verisi) ------------------------------
// Kaynaklar: (a) resmî geçmiş arşiv (official_result_history, yalnız
// doğrulanmış sonuçlar), (b) mühürlü ileri-test haftaları (official_forward).
// ÖĞRENME SINIRI: güncel hafta ve sonrası ASLA dahil edilmez. Legacy/backfill
// hiçbir koşulda girmez. 10 dk merkezî cache (kullanıcı başına hesap yok).
// Arşivde TAMAMLANMIŞ haftaların resmî sonuçlarını sıra-DNA'sının beklediği
// şekle çevirir: { position, result, roundId, roundCloseAt }.
// ÖĞRENME SINIRI: yalnız güncel haftadan ÖNCEKİ turlar (roundId < güncel).
// Mühürlü geçmiş analizler ellenmez; burada yalnız RESMÎ SONUÇ okunur.
const ARCHIVE_DNA_MAX_ROUNDS = 60;
// SEÇİLEN HAFTANIN GERÇEK SEZONU — ARŞİVDEN (2026-08-21).
// Statik geçmiş depo donmuş bir içe aktarımdır ve YENİ sezonu bilmez. Yeni
// sezonun ilk haftalarında oradaki arama boş düşünce sezon, "son tamamlanmış
// statik turun sezonu"na — yani GEÇEN sezona — kayıyordu: 2. Hafta'nın (1529,
// 2026/2027) Radar 5'i 2025/2026 ile hesaplanıyor, arşivde sonuçlanmış
// 1. Hafta (1528, 2026/2027) sezon süzgecine takılıp SESSİZCE düşüyordu
// (21 Ağustos bildirimi: "Radar 5'e 1. Hafta sonuçları yansımamış").
// Arşiv bülteni haftanın kendi sezonunu bilir; statik depo bilmiyorsa ona
// sorulur. Okunamazsa null döner — çağıran kendi yedeğine düşer.
async function arsivSezonu(store, roundId) {
  if (roundId == null) return null;
  try {
    const b = ((await store.listBulletins()) || [])
      .find((x) => String(x?.roundId ?? x?.id) === String(roundId));
    return b?.season ?? b?.seasonYear ?? null;
  } catch { return null; }
}

export async function archivePositionMatches(store, { beforeRoundId = null, knownRoundIds = new Set(), seasonYear = null } = {}) {
  const bulletins = await store.listBulletins();
  const ust = beforeRoundId == null ? null : Number(beforeRoundId);
  const aday = (bulletins || []).filter((b) => {
    const n = Number(b?.roundId ?? b?.id);
    if (!Number.isFinite(n)) return false;
    if (ust != null && Number.isFinite(ust) && n >= ust) return false;   // güncel hafta ve sonrası
    if (seasonYear != null && String(b?.season ?? b?.seasonYear ?? '') !== String(seasonYear)) return false;
    return !knownRoundIds.has(String(b.roundId ?? b.id));                // statik geçmişte varsa tekrar sayma
  }).slice(0, ARCHIVE_DNA_MAX_ROUNDS);

  const out = [];
  for (const b of aday) {
    const rid = b.roundId ?? b.id;
    let rows = [];
    try { rows = await store.listOfficialResults(b.id ?? rid); } catch { continue; }
    // TAKIM ADI + SKOR: yüzde hesabı için gerekmez, ama satır açılımında
    // ("%54.5 hangi maçlardan geliyor?") gerekir. Taşınmazsa liste
    // "null – null" satırları gösteriyordu. Okunamazsa liste adsız kalır,
    // sonuçlar yine doğrudur — bu yüzden hata yutulur.
    let kimlik = new Map();
    try {
      const ms = await store.getMatches(b.id ?? rid);
      kimlik = new Map((ms || []).map((m) => [Number(m.orderNo), m]));
    } catch { /* kimlik yoksa yalnız sonuç gösterilir */ }
    for (const r of rows || []) {
      if (!r?.officialResult || r.orderNo == null) continue;             // sonucu yoksa satır yok
      const pos = Number(r.orderNo);
      if (!(pos >= 1 && pos <= 15)) continue;
      const k = kimlik.get(pos);
      // fullTimeScore bir NESNEDİR ({home, away}) — metin sanıp ayrıştırmak
      // skoru sessizce null bırakıyordu. Metin biçimi de tolere edilir.
      const fts = r.fullTimeScore;
      let sh = null; let sa = null;
      if (fts && typeof fts === 'object') { sh = fts.home ?? null; sa = fts.away ?? null; }
      else {
        const eslesme = String(fts ?? '').match(/^(\d+)\s*[-:]\s*(\d+)$/);
        if (eslesme) { sh = Number(eslesme[1]); sa = Number(eslesme[2]); }
      }
      out.push({
        position: pos,
        result: r.officialResult,
        roundId: rid,
        // SEZON ŞART: computePositionDna sezona göre süzerken bu alanı arar.
        // Taşınmadığı için arşiv (official_forward) maçları yüzde hesabından
        // SESSİZCE düşüyordu — 52. Hafta'nın sonuçlanmış maçları satır
        // açılımında görünüyor ama yüzdeye girmiyordu (liste ile yüzde
        // birbirini tutmuyordu).
        seasonYear: b.season ?? b.seasonYear ?? null,
        roundCloseAt: r.confirmedAt || b.freezeAt || null,
        homeTeam: k?.homeName ?? null,
        awayTeam: k?.awayName ?? null,
        scoreHome: sh,
        scoreAway: sa,
        // Hafta adı arşiv bülteninden gelir: bu haftalar geçmiş deposunda
        // YOKTUR (ileri-test), oradaki ad tablosunda aranırsa "?" kalır.
        weekName: b.week ?? b.weekName ?? null,
        source: 'official_forward',
      });
    }
  }
  return out;
}

// ---- RADAR 5 FİLTRESİ (oynanma + oran yakınlığı) ----------------------------
// İki uç (/position-dna ve /position-matches) AYNI yardımcıları kullanır;
// süzgeç mantığının iki kopyası OLMAZ (liste ile dağılım ayrışırsa hangisi
// doğru bilinmez).

// İstekten filtre seçimini okur. Üst katman TEK modludur: oynanmaTol ve
// oranTol birlikte gelemez. Geçersiz değer SESSİZCE varsayılana düşürülmez —
// filtre uygulanmış SANILIP uygulanmamış (ya da başka toleransla) sonuç
// dönmesi bu ekranın en tehlikeli hata sınıfıdır; 400 döner.
function filtreSecimi(req) {
  // BOŞ DEĞER "YOK" DEMEKTİR: Number('') === 0 olduğundan `?oynanmaTol=`
  // normalizasyonsuz SESSİZCE "birebir" filtreye dönüşürdü.
  const temiz = (v) => (v == null || v === '' ? null : v);
  const oyn = temiz(req.query.oynanmaTol);
  const orn = temiz(req.query.oranTol);
  if (oyn == null && orn == null) return null;
  if (oyn != null && orn != null) {
    return { hata: 'oynanmaTol ve oranTol birlikte kullanılamaz — filtre tek modludur.' };
  }
  if (oyn != null) {
    const tol = Number(oyn);
    if (!OYNANMA_TOLERANSLARI.includes(tol)) {
      return { hata: `oynanmaTol şu değerlerden biri olmalı: ${OYNANMA_TOLERANSLARI.join(', ')}` };
    }
    return { mod: 'oynanma', tol };
  }
  const tol = Number(orn);
  if (!ORAN_TOLERANSLARI.includes(tol)) {
    return { hata: `oranTol şu değerlerden biri olmalı: ${ORAN_TOLERANSLARI.join(', ')}` };
  }
  return { mod: 'oran', tol };
}

// Görüntülenen haftanın sıra → SON kayıtlı gün değeri (karşılaştırma noktası).
// Gün-mühürleme dailyOdds.js motorundan aynen gelir — ikinci tanım yazılmaz.
// Oynanma kaynağı 'nesine' sabittir: geçmiş taraf (sonGunOynanmaIndeksi) da
// aynı kaynakla çalışır; kaynaklar karşılaştırmada asla karışmaz.
// MOD BAŞINA ÖNBELLEK (16 Ağustos 2026): mühür anında 7 süzgeç kombinasyonu
// koşuyor ve bu değerler yalnız (hafta, mod) çiftine bağlı — 7 kez kurmak
// gereksizdi. TTL, uç yanıt önbelleğiyle (10 dk) aynıdır; bayatlık sınırı
// değişmez.
let _guncelSira = { at: 0, key: null, val: null };
async function guncelSiraDegerleri(store, cur, roundId, mod) {
  const key = `${roundId ?? ''}|${mod}`;
  if (_guncelSira.val && _guncelSira.key === key && Date.now() - _guncelSira.at < 10 * 60 * 1000) {
    return _guncelSira.val;
  }
  const ctx = await resolveDailyContext({ query: { roundId } }, store, cur);
  if (!ctx) return new Map();
  const girdi = {
    roundId: ctx.rid, round: ctx.round, matches: ctx.matches, observations: ctx.observations,
    firstKickoffMs: ctx.firstMs, freezeAt: ctx.freezeAt, sealed: ctx.sealed, now: Date.now(),
  };
  const val = mod === 'oynanma'
    ? sonGunDegerleri(buildDailyPlayed(girdi), { metric: 'played', source: 'nesine' })
    : sonGunDegerleri(buildDailyOdds(girdi), { metric: 'odds' });
  _guncelSira = { at: Date.now(), key, val };
  return val;
}

// Filtre için geçmiş oynanma indeksi — sızma sınırı AÇIK (beforeRoundId):
// görüntülenen haftadan sonraki kayıt indekse hiç girmez. Gösterim indeksi
// (/position-matches'ın satır süsü) bundan ayrıdır ve olduğu gibi kalır.
//
// ÖNBELLEKLİ (16 Ağustos 2026): oran eşleniği `_oranIx` ile aynı gerekçe —
// mühür anında dört oynanma toleransı için aynı indeks kuruluyordu.
let _oynanmaIx = { at: 0, key: null, val: null };
const oynanmaFiltreIndeksi = async (store, cutRoundId) => {
  const key = String(cutRoundId ?? '');
  if (_oynanmaIx.val && _oynanmaIx.key === key && Date.now() - _oynanmaIx.at < 10 * 60 * 1000) {
    return _oynanmaIx.val;
  }
  const val = sonGunOynanmaIndeksi(
    await collectPlayedDnaRecords(store, { maxRounds: 40, beforeRoundId: cutRoundId }),
    'nesine',
  );
  _oynanmaIx = { at: Date.now(), key, val };
  return val;
};

// GEÇMİŞ MAÇLARIN SON GÜN ORANI — (tur, sıra) → haftanın son kayıtlı gününün
// birincil kaynak oranı. sonGunOynanmaIndeksi'nin oran eşleniği. Gün mührü
// buildDailyOdds'tan aynen gelir; bağlam kurulumu resolveDailyContext'ten
// paylaşılır (arşiv satırı → maç/saat/gözlem çevirisinin ikinci kopyası yok).
// Oran filtresi yalnız listede görünen haftalara uygulanabildiği için tarama
// LISTE_BASLANGIC_ROUND_ID'den başlar.
let _oranIx = { at: 0, key: null, val: null };
async function oranIndeksi(store, cur, { beforeRoundId = null } = {}) {
  const key = String(beforeRoundId ?? '');
  if (_oranIx.val && _oranIx.key === key && Date.now() - _oranIx.at < 10 * 60 * 1000) {
    return _oranIx.val;
  }
  const ust = beforeRoundId == null ? null : Number(beforeRoundId);
  const bulletins = await store.listBulletins().catch(() => []);
  const aday = (bulletins || []).filter((b) => {
    const n = Number(b?.roundId ?? b?.id);
    if (!Number.isFinite(n)) return false;
    if (n < LISTE_BASLANGIC_ROUND_ID) return false;
    if (ust != null && Number.isFinite(ust) && n >= ust) return false;
    return true;
  }).slice(0, 40);

  const ix = new Map();
  for (const b of aday) {
    const rid = String(b.roundId ?? b.id);
    try {
      const ctx = await resolveDailyContext({ query: { roundId: rid } }, store, cur);
      if (!ctx) continue;
      const gorunum = buildDailyOdds({
        roundId: ctx.rid, round: ctx.round, matches: ctx.matches, observations: ctx.observations,
        firstKickoffMs: ctx.firstMs, freezeAt: ctx.freezeAt, sealed: ctx.sealed, now: Date.now(),
      });
      for (const [no, v] of sonGunDegerleri(gorunum, { metric: 'odds' })) ix.set(`${rid}|${no}`, v);
    } catch { continue; /* tek tur okunamazsa o turun maçları oransız kalır */ }
  }
  _oranIx = { at: Date.now(), key, val: ix };
  return ix;
}

// Süzgecin iki yüzü tek yerde: geçmiş değeri indeks kaydından çıkarma + yakınlık.
const filtreAraclari = (filtre) => (filtre.mod === 'oynanma'
  ? { gecmisDeger: (h) => h?.pct ?? null, yakin: oynanmaYakin }
  : { gecmisDeger: (h) => h?.deger ?? null, yakin: oranYakin });

// ---- SIRA MAÇ LİSTESİ (Radar 5 satır açılımı) -------------------------------
// "%54.5 hangi maçlardan geliyor?" — kullanıcı bir karşılaşmaya dokununca o
// SIRANIN geçmiş maçları listelenir. Yüzdenin arkasındaki maçlar gösterilmezse
// kullanıcı sayıyı doğrulayamaz.
//
// AYRI UÇ, çünkü listeyi /position-dna yanıtına gömmek yanıtı 12 KB'dan 92 KB'a
// çıkarıyordu (15 sıra × ~50 maç) — oysa kullanıcı tek seferde tek sıra açar.
//
// Kesim ve sezon kapsamı /position-dna İLE AYNI hesaplanır; başka türlü açılan
// liste ekrandaki yüzdeyle uyuşmazdı.
let _liste = { at: 0, key: null, val: null };
router.get('/position-matches', async (req, res) => {
  try {
    const position = Number(req.query.position);
    if (!(position >= 1 && position <= 15)) {
      return res.status(400).json({ error: 'Sıra 1–15 arasında olmalı.' });
    }
    const filtre = filtreSecimi(req);
    if (filtre?.hata) return res.status(400).json({ error: filtre.hata });
    const cur = load('bulletin')?.data;
    const store = getArchiveStore();
    const cutRoundId = req.query.roundId != null ? Number(req.query.roundId)
      : (cur?.roundId != null ? Number(cur.roundId) : null);

    const key = String(cutRoundId);
    if (!_liste.val || _liste.key !== key || Date.now() - _liste.at > 10 * 60 * 1000) {
      const hs = getHistoryStore();
      const allRounds = await hs.listRounds();
      const secilen = allRounds.find((r) => String(r.roundId) === String(cutRoundId));
      // Sezon çözümü /position-dna (siraDnaTabani) İLE AYNI: statik depoda
      // olmayan yeni sezon haftası için ARŞİV bülteninin sezonu esastır.
      // aktifSezon yalnız yanıttaki `season` üst verisidir — SÜZMEZ:
      // "Tüm Haftalar" tüm sezonları kapsar (kullanıcı kararı, 21 Ağustos
      // 2026; /position-dna ile aynı kural — liste ile yüzde aynı küme).
      const aktifSezon = secilen?.seasonYear
        || (await arsivSezonu(store, cutRoundId))
        || allRounds.filter((r) => r.status === 'completed')
          .sort((a, b) => String(b.roundCloseAt || '').localeCompare(String(a.roundCloseAt || '')))[0]?.seasonYear
        || null;

      const hist = (await hs.listAllMatches())
        .filter(historyLearningFilter({ currentRoundId: cutRoundId, currentFreezeAt: null }));

      let arsiv = [];
      try {
        arsiv = await archivePositionMatches(store, {
          beforeRoundId: cutRoundId,
          knownRoundIds: new Set(hist.map((m) => String(m.roundId))),
          seasonYear: null,          // tüm sezonlar (kullanıcı kararı, 21 Ağu)
        });
      } catch { /* arşiv okunamazsa yalnız statik geçmiş */ }

      const adlar = Object.fromEntries(allRounds.map((r) => [String(r.roundId), r.weekName || null]));
      // Oynanma kaydından ESKİ haftalar listeye hiç girmez (kullanıcı kararı).
      // Kesme BURADA yapılır: 15 sıranın listesi zaten buradan üretiliyor, tek
      // yerde kesilince count/playedCount da kırpılmış listeyle tutarlı kalır.
      const kaynak = eskiHaftalariAt([...hist, ...arsiv])
        .filter((m) => cutRoundId == null || String(m.roundId) !== String(cutRoundId));

      // GEÇMİŞ MAÇLARIN OYNANMA YÜZDESİ (haftanın son günü = Cuma).
      // Tek seferde 15 sıranın tamamı için çıkarılır ve listeyle AYNI önbellekte
      // durur; kullanıcı sıra değiştirdikçe arşiv yeniden taranmaz.
      // Arşiv okunamazsa liste yine dönmeli — yüzde İKİNCİL bilgidir.
      let oynanmaIx = new Map();
      try {
        const kayitlar = await collectPlayedDnaRecords(store, { maxRounds: 40 });
        oynanmaIx = sonGunOynanmaIndeksi(kayitlar, 'nesine');
      } catch { /* yüzde yoksa satırlar boş görünür, liste bozulmaz */ }

      _liste = {
        at: Date.now(), key,
        val: {
          roundId: cutRoundId, season: aktifSezon, oynanmaIx,
          // 15 sıranın tamamı bir kez hesaplanır; kullanıcı sıra değiştirdikçe
          // aynı önbellekten okunur (her dokunuşta arşiv taranmaz).
          byPosition: Object.fromEntries(Array.from({ length: 15 }, (_, i) => (
            [i + 1, positionMatchList(kaynak, { position: i + 1, roundNames: adlar })]
          ))),
        },
      };
    }
    const ham = _liste.val.byPosition[position] || [];
    // Her satıra O HAFTANIN CUMA yüzdesi iliştirilir. Veri yoksa alan null'dır.
    const { matches, yuzdeliSayi } = oynanmaEkle(ham, _liste.val.oynanmaIx || new Map(), position);

    // FİLTRELİ MOD: liste, /position-dna İLE AYNI süzgeç araçlarından geçer.
    // Süzme, tur bazlı önbelleğin ÜSTÜNDE her istekte yeniden yapılır — böylece
    // filtre değişince bayat sonuç dönmesi yapısal olarak imkânsızdır (ağır
    // kısım olan liste kurulumu önbellekte kalır, süzgeç bellek içidir).
    if (filtre) {
      const { gecmisDeger, yakin } = filtreAraclari(filtre);
      const cutRid = _liste.val.roundId;
      const guncel = (await guncelSiraDegerleri(store, cur, cutRid, filtre.mod))
        .get(Number(position)) || null;
      const gecmisIx = filtre.mod === 'oynanma'
        ? await oynanmaFiltreIndeksi(store, cutRid)
        : await oranIndeksi(store, cur, { beforeRoundId: cutRid });

      // Oran modunda satıra oran da iliştirilir: kullanıcı "neye benzedi"yi
      // satırda görmeli. Oynanma modunda satırda `played` zaten var.
      const zengin = matches.map((m) => {
        const h = gecmisIx.get(`${m.roundId}|${Number(position)}`);
        const deger = gecmisDeger(h);
        const satir = filtre.mod === 'oran' ? { ...m, oran: deger ?? null, oranGun: h?.gun ?? null } : m;
        return { satir, deger };
      });
      const verili = zengin.filter((z) => z.deger != null).length;
      const suzulmus = guncel == null ? []
        : zengin.filter((z) => z.deger != null && yakin(guncel.deger, z.deger, filtre.tol))
          .map((z) => z.satir);
      return res.json({
        hasData: suzulmus.length > 0,
        position,
        roundId: _liste.val.roundId,
        season: _liste.val.season,
        count: suzulmus.length,
        playedCount: suzulmus.filter((m) => m.played != null).length,
        // KAPSAM DÜRÜSTLÜĞÜ: aday = süzgeç öncesi liste, verili = değeri
        // gerçekten BİLİNEN maç sayısı. Ekran "12 maçın 5'inin oranı var,
        // 2'si uydu" diyebilmeli — eksik veri yüzdeye çevrilip gizlenmez.
        filtre: {
          mod: filtre.mod,
          tol: filtre.tol,
          guncel: guncel?.deger ?? null,
          guncelGun: guncel?.gun ?? null,
          aday: matches.length,
          verili,
          uyan: suzulmus.length,
        },
        matches: suzulmus,
        note: suzulmus.length ? null
          : (guncel == null
            ? 'Bu sıranın güncel maçı için karşılaştırılacak kayıt yok — filtre uygulanamadı.'
            : 'Bu yakınlıkta geçmiş maç yok.'),
      });
    }
    res.json({
      hasData: matches.length > 0,
      position,
      roundId: _liste.val.roundId,
      season: _liste.val.season,
      count: matches.length,
      // KAPSAM DÜRÜSTLÜĞÜ: oynanma arşivi 51. haftada başladı; daha eski
      // satırlarda yüzde YOKTUR. Ekran bu sayıyı yazarak kaç satırın gerçekten
      // veriye dayandığını gösterir — boşluk "veri yok" demek, "%0" demek değil.
      playedCount: yuzdeliSayi,
      matches,
      note: matches.length ? null : 'Bu sıra için doğrulanmış geçmiş sonuç yok.',
    });
  } catch (e) { fail(res, e); }
});

// RADAR 3 — BANT MAÇLARI. Kartta "Bu bantta geçmiş 19 maçta favori %63
// kazandı" yazan sayının ARKASINDAKİ maçlar (kullanıcı isteği, 30 Ağustos:
// "bu 19 maçı görmek istiyorum"). Yanıt /position-matches ile AYNI satır
// biçimindedir ({ roundId, week, home, away, score, result, played }) — istemci
// aynı tabloyu kullanır. Sayım radardaki bandStats ile aynı fonksiyondan
// (buildBandHistoryDetails) geçer; liste ile kart sayısı ayrışamaz.
// Kesim: yalnız bakılan haftadan ÖNCEKİ turlar (gelecekten sızıntı yok).
router.get('/band-matches', async (req, res) => {
  try {
    const min = Number(req.query.min);
    const max = Number(req.query.max);
    const band = PUBLIC_BANDS.bands.find((b) => b.min === min && b.max === max);
    if (!band) return res.status(400).json({ error: 'Bant tanınmadı (min/max).' });

    const cur = load('bulletin')?.data;
    const store = getArchiveStore();
    const cutRoundId = req.query.roundId != null ? Number(req.query.roundId)
      : (cur?.roundId != null ? Number(cur.roundId) : null);

    const records = await collectPlayedDnaRecords(store, { beforeRoundId: cutRoundId, now: new Date() });
    const rows = buildBandHistoryDetails(records)
      .filter((r) => r.favoritePct >= band.min && r.favoritePct <= band.max && r.officialResult);

    // Skor ve hafta adı geçmiş deposundan (roundId+sıra ile) iliştirilir;
    // bulunamazsa null — "0-0" uydurulmaz.
    const hs = getHistoryStore();
    const [allRounds, hist] = await Promise.all([hs.listRounds(), hs.listAllMatches()]);
    const adlar = Object.fromEntries(allRounds.map((r) => [String(r.roundId), r.weekName || null]));
    const histIx = new Map(hist.map((m) => [`${m.roundId}|${Number(m.position)}`, m]));

    const matches = rows
      .sort((a, b) => (Number(b.roundId) || 0) - (Number(a.roundId) || 0) || (a.position || 0) - (b.position || 0))
      .map((r) => {
        const h = histIx.get(`${r.roundId}|${Number(r.position)}`);
        return {
          roundId: r.roundId != null ? String(r.roundId) : null,
          position: r.position,
          week: r.roundLabel ?? h?.weekName ?? adlar[String(r.roundId)] ?? null,
          home: r.home ?? h?.homeTeam ?? null,
          away: r.away ?? h?.awayTeam ?? null,
          score: (h?.scoreHome != null && h?.scoreAway != null) ? `${h.scoreHome}-${h.scoreAway}` : null,
          result: r.officialResult,
          played: { gun: r.dayKey, pct: r.pct, favori: r.favoriteSymbol, favoriPct: r.favoritePct },
        };
      });

    const results = { '1': 0, X: 0, '2': 0 };
    let favoriteWon = 0;
    for (const m of matches) {
      results[m.result] = (results[m.result] || 0) + 1;
      if (m.played.favori === m.result) favoriteWon += 1;
    }
    res.json({
      hasData: matches.length > 0,
      band: band.label,
      min: band.min,
      max: band.max,
      roundId: cutRoundId,
      count: matches.length,
      playedCount: matches.length,
      favoriteWinRate: matches.length ? Math.round((favoriteWon / matches.length) * 100) : null,
      results,
      matches,
      note: matches.length ? null : 'Bu bantta doğrulanmış geçmiş maç yok.',
    });
  } catch (e) { fail(res, e); }
});

// RADAR 3 — BENZER MAÇLAR. Kartta "Benzer 14 doğrulanmış maçta sonuçlar …"
// yazan sayının ARKASINDAKİ maçlar (kullanıcı isteği, 30 Ağustos).
//
// SORGU KARTIN KENDİ KAYDINDAN TÜRETİLİR: istemci yalnız hafta + sıra yollar.
// Mühürlü haftanın radarı arşivden servis edilir ve mühre yeni alan giremez;
// bu yüzden sorgu yanıtta taşınmaz, kartın hesaplandığı aynı girdilerden
// (birincil kaynak, kapanış, açılış, uzlaşı favorisi) AYNI fonksiyonla
// (benzerSorgusu) yeniden kurulur. Seviye seçimi de findSimilarDna ile aynı
// fonksiyondan geçer — kart 14 diyorsa liste 14'tür. Kaynak kimliği ağ
// trafiğine hiç çıkmaz.
router.get('/similar-matches', async (req, res) => {
  try {
    const position = Number(req.query.position);
    if (!(position >= 1 && position <= 15)) return res.status(400).json({ error: 'Sıra 1–15 arasında olmalı.' });

    const store = getArchiveStore();
    const cur = load('bulletin')?.data;
    const istenen = req.query.roundId != null && req.query.roundId !== '' ? Number(req.query.roundId) : null;
    const cutRoundId = Number.isFinite(istenen) ? istenen : (cur?.roundId != null ? Number(cur.roundId) : null);

    // BAKILAN HAFTANIN MERKEZİ: mühürlüyse arşivden (yeniden hesap yok),
    // güncelse canlı — kart hangi kayıttan çizildiyse sorgu da ondan kurulur.
    const merkez = cutRoundId != null
      ? await getRadarCenterForRound(cutRoundId, { store })
      : await getCurrentRadarCenter({ store });
    const mac = (merkez?.matches || []).find((m) => Number(m.no) === position) || null;
    const q = benzerSorgusu(mac?.radars?.[RADAR_IDS.PUBLIC]?.details, position);
    const bos = (reason, note) => res.json({
      hasData: false, level: null, reason, roundId: cutRoundId,
      count: 0, playedCount: 0, counts: { '1': 0, X: 0, '2': 0 }, matches: [], note,
    });
    if (!q) return bos('no_played_dna', 'Bu maç için oynanma kaydı yok.');
    // Merkez ham kimlikle gelir; dış kod (k1) gelse de kaynakId geriye uyumludur.
    // Tanınmayan kimlik OLDUĞU GİBİ kalır — kayıtla aynı anahtarla eşleşsin.
    q.provider = kaynakId(String(q.provider)) ?? q.provider;

    const gunluk = await collectPlayedDnaRecords(store, { beforeRoundId: cutRoundId, now: new Date() });
    const sonuc = findSimilarDnaMatches(toPctDnaRecords(gunluk), q);

    const hs = getHistoryStore();
    const [allRounds, hist] = await Promise.all([hs.listRounds(), hs.listAllMatches()]);
    const adlar = Object.fromEntries(allRounds.map((r) => [String(r.roundId), r.weekName || null]));
    const histIx = new Map(hist.map((m) => [`${m.roundId}|${Number(m.position)}`, m]));

    const matches = sonuc.matches
      .sort((a, b) => (Number(b.roundId) || 0) - (Number(a.roundId) || 0) || (a.position || 0) - (b.position || 0))
      .map((r) => {
        const h = histIx.get(`${r.roundId}|${Number(r.position)}`);
        return {
          roundId: r.roundId != null ? String(r.roundId) : null,
          position: r.position,
          week: r.roundLabel ?? h?.weekName ?? adlar[String(r.roundId)] ?? null,
          home: r.home ?? h?.homeTeam ?? null,
          away: r.away ?? h?.awayTeam ?? null,
          score: (h?.scoreHome != null && h?.scoreAway != null) ? `${h.scoreHome}-${h.scoreAway}` : null,
          result: r.result,
          played: {
            gun: r.dayKey, pct: r.closePct, favori: r.favoriteSymbol,
            favoriPct: r.closePct?.[r.favoriteSymbol] ?? null,
          },
        };
      });

    const counts = { '1': 0, X: 0, '2': 0 };
    for (const m of matches) counts[m.result] = (counts[m.result] || 0) + 1;
    res.json({
      hasData: matches.length > 0,
      level: sonuc.level ?? null,
      reason: sonuc.reason ?? null,
      roundId: cutRoundId,
      count: matches.length,
      playedCount: matches.length,
      counts,
      matches,
      note: matches.length ? null
        : (sonuc.reason === 'insufficient_sample'
          ? 'Benzer doğrulanmış örnek henüz yetersiz (n<10) — sistem öğreniyor.'
          : 'Benzer doğrulanmış geçmiş maç yok.'),
    });
  } catch (e) { fail(res, e); }
});

let _dnaCache = { at: 0, key: null, val: null };
router.get('/position-dna', async (req, res) => {
  try {
    const filtre = filtreSecimi(req);
    if (filtre?.hata) return res.status(400).json({ error: filtre.hata });
    const cur = load('bulletin')?.data;
    const store = getArchiveStore();

    // TARİHSEL KESİM NOKTASI = GÖRÜNTÜLENEN HAFTA.
    // Her hafta yalnız KENDİSİNDEN ÖNCE bilinen resmî sonuçları görür:
    //   51. hafta → 51 öncesi · 52. hafta → 51 dâhil, 52 öncesi.
    // Eskiden hep güncel bülten kullanılıyordu; bu yüzden bütün haftalara AYNI
    // canlı hesap gidiyor ve mühürlü haftanın öğrenme sınırı bozuluyordu.
    const istenen = req.query.roundId != null ? Number(req.query.roundId) : null;
    const cutRoundId = Number.isFinite(istenen) ? istenen : (cur?.roundId ?? null);
    const guncelMi = cur?.roundId != null && Number(cur.roundId) === Number(cutRoundId);

    let cutFreezeAt = null;
    if (guncelMi) {
      cutFreezeAt = cur?.matches?.length ? computeFreezeAt(cur.matches) : null;
    } else if (cutRoundId != null) {
      // Geçmiş hafta: kendi mühür anı arşivden okunur (canlı bültenden DEĞİL).
      const b = await store.getBulletin(bulletinIdOf(cutRoundId)).catch(() => null);
      cutFreezeAt = b?.freezeAt ?? null;
    }

    // ÖNBELLEK ANAHTARI: seçilen hafta + kesimden önce bilinen sonuç imzası.
    // İmza sayesinde yeni resmî sonuç geldiğinde ya da düzeltildiğinde yalnız
    // ETKİLENEN haftaların hesabı kendiliğinden tazelenir (elle yenileme yok).
    let sig = '';
    try {
      const bs = await store.listBulletins();
      sig = (bs || [])
        .filter((b) => Number(b?.roundId ?? b?.id) < Number(cutRoundId))
        .map((b) => `${b.roundId ?? b.id}:${b.status || ''}:${b.resultsConfirmedAt || b.updatedAt || ''}`)
        .join(',');
    } catch { /* imza alınamazsa yalnız süre tabanlı tazeleme kalır */ }

    // BÜTÜNLÜK KİLİDİ: mühürlü hafta için bu uç HESAP YAPMAZ.
    // Mühürlü haftanın tek doğru kaynağı kendi snapshot'ıdır; canlı hesap
    // dönmek, mühürlü değerin sonradan değişmiş gibi görünmesine yol açar.
    if (!guncelMi && cutRoundId != null) {
      const snap = await store.getSnapshot(String(cutRoundId)).catch(() => null);
      if (snap) {
        const sealedRadar5 = snap.payload?.radar5;
        // SÜZGEÇ KIRILIMI MÜHÜRDE VARSA SUNULUR (16 Ağustos 2026).
        // Yeniden hesap DEĞİLDİR: değer hafta donduğu anda üretilip mühre
        // yazıldı, burada yalnız okunuyor. Mühürde yoksa (bu tarihten önce
        // mühürlenmiş haftalar) eski davranış aynen sürer: uygulanmadı.
        const muhurluFiltre = filtre
          ? (sealedRadar5?.filtreler?.[`${filtre.mod}:${filtre.tol}`] ?? null)
          : null;

        // TÜREV SÜZGEÇ — mühürde kırılım YOKSA (16 Ağustos 2026 öncesi
        // mühürler) ve kullanıcı süzgeç istediyse, MÜHRÜN KENDİ KESİMİYLE
        // hesaplanır ve TÜREV olarak işaretlenir.
        //
        // NEDEN GÜVENLİ: kesim mühürden gelir — geçmiş yalnız o haftanın
        // donma anından ÖNCEsiyle sınırlıdır (historyLearningFilter +
        // beforeRoundId). Yani sonraki haftalar biriktikçe tablo BÜYÜMEZ.
        //
        // NEDEN "MÜHÜRLÜ" DEMİYORUZ: mühre yazılmış bir değer değildir; o
        // hafta mühürlenirken arşiv henüz içeri alınmamışsa bugünkü hesap
        // mühürdeki (boş) kayıttan farklı çıkar. Fark gizlenmez — yanıt
        // `turev: true` der, ekran da bunu yazar. Mühürlü kaydın kendisine
        // DOKUNULMAZ.
        let turevFiltre = null;
        if (filtre && !muhurluFiltre) {
          try {
            turevFiltre = await hesaplaSiraDnasi({
              store, cur, cutRoundId, cutFreezeAt, guncelMi: false, filtre, sig,
            });
          } catch { turevFiltre = null; /* hesaplanamazsa eski davranış */ }
        }
        return res.json({
          hasData: !!(muhurluFiltre?.dna ?? turevFiltre?.dna ?? sealedRadar5?.dna),
          sealed: true,
          useSnapshot: !turevFiltre,
          // TÜREV: sayılar mühürden DEĞİL, mührün kesimiyle bugün hesaplandı.
          turev: !!turevFiltre,
          roundId: cutRoundId,
          verificationHash: snap.payloadHash ?? null,
          sealedAt: snap.lockedAt ?? null,
          cut: turevFiltre?.cut ?? sealedRadar5?.cut ?? { roundId: cutRoundId },
          dna: muhurluFiltre?.dna ?? turevFiltre?.dna ?? sealedRadar5?.dna ?? null,
          periods: sealedRadar5?.periods ?? null,
          // Türev modda hangi adımlar sunulabilir: hepsi hesaplanabilir.
          turevFiltreler: turevFiltre
            ? [...OYNANMA_TOLERANSLARI.map((t) => `oynanma:${t}`),
              ...ORAN_TOLERANSLARI.map((t) => `oran:${t}`)]
            : [],
          // Hangi süzgeç seçimleri mühürlü — istemci var olmayan seçeneği
          // çip olarak sunmasın diye açıkça bildirilir.
          muhurluFiltreler: sealedRadar5?.filtreler
            ? Object.keys(sealedRadar5.filtreler)
            : [],
          // MÜHÜRLÜ HAFTADA CANLI HESAP YAPILMAZ (kural, 2026-08-10) — ama
          // süzgeç kırılımı MÜHÜRDE VARSA o okunur ve `uygulanmadi: false`
          // döner (16 Ağustos 2026). Mühürde yoksa istek SESSİZCE yutulmaz:
          // yok sayıldığı açıkça söylenir ve ekran süzgeç satırını kapatır.
          filtre: filtre
            ? (muhurluFiltre?.filtre
                ? { ...muhurluFiltre.filtre, uygulanmadi: false, muhurlu: true }
                : (turevFiltre?.filtre
                    ? {
                      ...turevFiltre.filtre,
                      uygulanmadi: false,
                      muhurlu: false,
                      turev: true,
                      notu: 'TÜREV — bu sayılar mühürde YOK; haftanın kendi '
                        + 'kesimiyle (donma anından öncesi) bugün hesaplandı. '
                        + 'Mühürlü kayıt değişmedi.',
                    }
                    : {
                      mod: filtre.mod,
                      tol: filtre.tol,
                      uygulanmadi: true,
                      notu: 'Bu hafta mühürlenirken süzgeç kırılımı kaydedilmedi '
                        + 've türev hesap da yapılamadı.',
                    }))
            : null,
          note: muhurluFiltre
            ? 'Bu hafta mühürlü — süzgeç sonucu da hafta donduğu anda mühürlendi; yeniden hesaplanmaz.'
            : (turevFiltre
                ? 'Bu hafta mühürlü. Süzgeçli görünüm mühürde olmadığı için '
                  + 'haftanın kendi kesimiyle TÜREV olarak hesaplandı; mühürlü '
                  + 'kayıt değişmedi.'
                : 'Bu hafta mühürlü — Radar 5 yalnız mühürlü snapshot’tan gösterilir; yeniden hesaplanmaz.'),
        });
      }
    }

    // ÖNBELLEK ANAHTARINDA FİLTRE DE VAR: yoksa filtre değişince 10 dk boyunca
    // eski filtrenin sonucu dönerdi — ekran filtreli sanır, sayı filtresizdir
    // (sessiz hata; bu ekranın en tehlikeli sınıfı).
    const key = `${cutRoundId}|${sig}|${filtre ? `${filtre.mod}:${filtre.tol}` : ''}`;
    if (_dnaCache.val && _dnaCache.key === key && Date.now() - _dnaCache.at < 10 * 60 * 1000) {
      return res.json(_dnaCache.val);
    }
    // `sig` taban önbelleğine de geçer: yeni resmî sonuç geldiğinde yalnız
    // yanıt değil, altındaki geçmiş tabanı da tazelenir.
    const body = await hesaplaSiraDnasi({ store, cur, cutRoundId, cutFreezeAt, guncelMi, filtre, sig });
    _dnaCache = { at: Date.now(), key, val: body };
    res.json(body);
  } catch (e) { fail(res, e); }
});

// ---- GEÇMİŞ ARŞİV DURUMU ----------------------------------------------------
// Kullanıcı diliyle içe aktarım durumu (teknik hata metni sızdırılmaz).
router.get('/history-archive', async (req, res) => {
  try {
    const store = getHistoryStore();
    const rounds = await store.listRounds().catch(() => []);
    const completed = rounds.filter((r) => r.status === 'completed');
    const seasons = [...new Set(completed.map((r) => r.seasonYear).filter(Boolean))].sort();
    const status = load('historyImportStatus')?.data || null;
    let conflictCount = 0;
    try {
      const audit = await store.listAudit();
      conflictCount = audit.filter((a) => a.action === 'result_conflict').length;
    } catch { /* audit okunamazsa sayı 0 gösterilir */ }
    res.json({
      hasData: completed.length > 0,
      totalBulletins: completed.length,
      seasons,
      firstSeason: seasons[0] ?? null,
      lastSeason: seasons[seasons.length - 1] ?? null,
      resultConflicts: conflictCount,     // analiz DIŞI bırakılan uyuşmazlık sayısı
      lastImportAt: status?.lastRunAt ?? null,
      importHealthy: status ? status.ok !== false : null,
      note: completed.length ? null
        : 'Resmî geçmiş bülten arşivi henüz içe aktarılıyor; tamamlandıkça burada görünecek.',
    });
  } catch (e) { fail(res, e); }
});

// ---- TEK MAÇ DETAYI ---------------------------------------------------------
router.get('/:roundId/match/:matchId', async (req, res) => {
  try {
    const view = await getRadarCenterForRound(req.params.roundId);
    if (!view?.hasData) return res.status(404).json({ error: view?.note || 'Bu hafta için Radar Merkezi kaydı yok.', legacyOnly: !!view?.legacyOnly });
    const m = view.matches.find((x) => String(x.matchId) === String(req.params.matchId) || String(x.no) === String(req.params.matchId));
    if (!m) return res.status(404).json({ error: 'Maç bulunamadı.' });
    res.json({
      roundId: view.roundId, round: view.round, sealed: !!view.sealed, sealedAt: view.sealedAt ?? null,
      methodologyVersion: view.methodologyVersion, verificationHash: view.verificationHash ?? null,
      match: m,
    });
  } catch (e) { fail(res, e); }
});

// roundId doğrulaması: yalnız pozitif TAM sayı kabul edilir ("abc", "12.5",
// "null", "undefined" → 400). Statik yollar ('/current', '/weeks', ...) bu
// işleyiciden ÖNCE tanımlı olduğundan çakışma yaşanmaz.
const isValidRoundId = (s) => /^\d+$/.test(String(s));

// ---- HAFTA GÖRÜNÜMÜ (geriye uyumlu) ----------------------------------------
// Radar Merkezi kaydı yoksa next() ile ESKİ /api/radar/:roundId işleyicisine
// düşer (legacy arşiv + resmî sonuç işleme davranışı aynen korunur).
// İSTİSNA — GÜNCEL HAFTA: verisi henüz olmasa bile legacy 404'e ("arşiv yok")
// ASLA düşürülmez; dürüst "bekleniyor" yanıtı 200 ile döner.
router.get('/:roundId', async (req, res, next) => {
  try {
    if (!isValidRoundId(req.params.roundId)) return res.status(400).json({ error: 'Geçersiz hafta.' });
    const rid = Number(req.params.roundId);
    const view = await getRadarCenterForRound(rid);
    if (!view?.hasData) {
      if (view?.current) return res.json(withLegacy(view)); // güncel hafta ≠ arşiv
      return next();
    }
    res.json(withLegacy(view));
  } catch (e) { fail(res, e); }
});

// ---- ESKİ /api/radar/:roundId İŞLEYİCİSİ (server.js buradan kurar) ----------
// Eski davranış AYNEN korunur (mühürlü legacy arşiv + resmî sonuç işleme);
// eklenenler: sayısal doğrulama + güncel hafta asla "arşiv yok" 404'üne düşmez.
// fetchBulletin enjekte edilebilir (testte gerçek sportoto çağrısı yapılmaz).
export function makeLegacyRadarHandler({ fetchBulletin = null } = {}) {
  return async (req, res) => {
    if (!isValidRoundId(req.params.roundId)) return res.status(400).json({ error: 'Geçersiz hafta.' });
    const rid = String(req.params.roundId);
    const cur = load('bulletin')?.data;
    if (cur && String(cur.roundId) === rid) {
      return res.json({ roundId: cur.roundId, round: cur.round, year: cur.year, radarFrozenAt: cur.radarFrozenAt ?? null, radar: cur.radar || [], current: true });
    }
    const arch = load(`radar-${rid}`);
    if (!arch?.data) {
      // Cache boş olsa bile güncel hafta arşiv sanılmasın: kimliği arşivden çöz.
      const liveCur = await getRadarCenterForRound(Number(rid)).catch(() => null);
      if (liveCur?.current) return res.json(withLegacy(liveCur));
      return res.status(404).json({ error: 'Bu hafta için radar arşivi yok.' });
    }
    // Resmi sonuçları maçlara işle (alınamazsa arşiv olduğu gibi döner — uydurma yok).
    let radar = arch.data.radar || [];
    if (fetchBulletin) {
      try {
        const bulletin = await fetchBulletin(Number(rid));
        const byNo = new Map((bulletin.matches || []).map((m) => [m.no, m]));
        radar = radar.map((r) => {
          const m = byNo.get(r.no);
          if (!m?.result || !m?.score) return r;                  // resmi sonuç yoksa dokunma
          const favHit = r.favorite?.symbol ? r.favorite.symbol === m.result : null;
          return { ...r, result: m.result, score: m.score, favHit };
        });
      } catch { /* sonuç servisi yoksa arşiv sade döner */ }
    }
    res.json({ ...arch.data, radar, current: false });
  };
}

export default router;


// ---- SIRA DNA HESABI (tek tanım) --------------------------------------------
// CANLI UÇ ve MÜHÜR AYNI KODU KULLANIR (16 Ağustos 2026). Mühürlenen haftaya
// yakınlık süzgeci kırılımları da yazılabilsin diye hesap uçtan ayrıldı;
// snapshotService bunu mühür anında çağırır. İkinci bir tanım yazılsaydı
// mühürdeki sayı ile canlı sayı zamanla ayrışırdı — bu ekranın en tehlikeli
// hata sınıfı. Döngü olmaması için snapshotService bu modülü DİNAMİK import
// eder (routes/radar.js zaten snapshotService'ten computeFreezeAt alıyor).
// SÜZGEÇTEN BAĞIMSIZ TABAN — HAFTA BAŞINA BİR KEZ.
//
// Geçmiş arşivi okumak, tamamlanan haftaların resmî sonuçlarını çevirmek ve
// filtresiz DNA'yı hesaplamak SÜZGECE BAĞLI DEĞİLDİR; tolerans değişince
// aynen tekrar edilir. Mühür anında 7 kombinasyon koşuyor ve bu ağır iş 7 kez
// yapılıyordu: backend test paketi 10 sn'den 99 sn'ye çıktı (ölçüldü,
// 16 Ağustos 2026). Taban paylaşılınca hem mühür hızlandı hem de canlı uçta
// tolerans değiştirmek ucuzladı.
//
// ANAHTARDA `sig` VAR: yeni resmî sonuç geldiğinde taban da tazelenmeli.
// Yalnız süreye güvenmek, sonuç düştükten sonra 10 dk boyunca eski tabanla
// hesap yapmak olurdu (sessiz hata sınıfı).
let _dnaTaban = { at: 0, key: null, val: null };
async function siraDnaTabani({ store, cutRoundId, cutFreezeAt, sig = '' }) {
  const key = `${cutRoundId}|${cutFreezeAt ?? ''}|${sig}`;
  if (_dnaTaban.val && _dnaTaban.key === key && Date.now() - _dnaTaban.at < 10 * 60 * 1000) {
    return _dnaTaban.val;
  }
  let histMatches = [];
  let activeSeason = null;
  try {
    const all = await getHistoryStore().listAllMatches();
    histMatches = all.filter(historyLearningFilter({
      currentRoundId: cutRoundId, currentFreezeAt: cutFreezeAt,
    }));
    const allRounds = await getHistoryStore().listRounds();
    const selectedRound = allRounds.find((r) => String(r.roundId) === String(cutRoundId));
    const eligibleRounds = allRounds.filter((r) => r.status === 'completed'
      && (!cutFreezeAt || (r.roundCloseAt && String(r.roundCloseAt) < String(cutFreezeAt))));
    // Sezon SEÇİLEN haftanın kendi sezonudur: önce statik depo, orada yoksa
    // ARŞİV bülteni (yeni sezonun haftaları statik depoda hiç yoktur — bkz.
    // arsivSezonu). "Son tamamlanmış turun sezonu" yalnız son çare yedektir.
    activeSeason = selectedRound?.seasonYear
      || (await arsivSezonu(store, cutRoundId))
      || eligibleRounds.sort((a, b) => String(b.roundCloseAt || '').localeCompare(String(a.roundCloseAt || '')))[0]?.seasonYear
      || null;
    // SEZON SÜZGECİ YOK (kullanıcı kararı, 21 Ağustos 2026): "Tüm Haftalar"
    // TÜM sezonları kapsar — 1 Ağustos'taki sezon sınırı kararının YERİNE
    // geçer. O günkü kaygı (150 haftalık dört sezonun tek ortalamada
    // seyrelmesi) bugün yapısal olarak imkânsız: eskiHaftalariAt zaten 1525
    // başlangıcından keser, elde yalnız o pencere var. Sezon devrinde yeni
    // sezonun 1. haftasında ekranın n=1'e düşmesi kullanıcı tarafından
    // reddedildi ("tüm sezonlar olacak"). activeSeason artık yalnız cut
    // üst verisidir (bakılan haftanın kendi sezonu) — süzmez.
  } catch { /* geçmiş arşiv yoksa yalnız ileri-test verisi kalır */ }

  // ARŞİVDE TAMAMLANAN HAFTALAR da sıra geçmişine girer. Statik geçmiş dosyası
  // dondurulmuş bir içe aktarımdır; yeni sonuçlanan haftalar oraya YAZILMAZ,
  // arşive (match_official_results) yazılır. Bu yüzden yalnız statik dosyayla
  // hesaplamak, biten haftayı sonsuza dek dışarıda bırakıyordu.
  let arsivMaclari = [];
  try {
    arsivMaclari = await archivePositionMatches(store, {
      beforeRoundId: cutRoundId,     // yalnız SEÇİLEN haftadan önceki turlar
      // Statik geçmişte zaten olan tur ÇİFT SAYILMAZ.
      knownRoundIds: new Set(histMatches.map((m) => String(m.roundId))),
      seasonYear: null,              // tüm sezonlar (kullanıcı kararı, 21 Ağu)
    });
  } catch { /* arşiv okunamazsa yalnız statik geçmişle devam edilir */ }

  // OYNANMA KAYDINDAN ESKİ HAFTALAR YÜZDEYE DE GİRMEZ.
  // Liste (/position-matches) `eskiHaftalariAt` ile 1525'ten kesiliyordu ama
  // bu hesap kesilmiyordu: ekran "2 maç" derken yüzde 768 maçtan geliyor,
  // dönem filtresi değiştikçe elde olmayan haftalara göre oynuyordu. İki uç
  // AYNI kesimi kullanmazsa kullanıcı ekrandaki sayıyı doğrulayamaz.
  const kaynakArr = eskiHaftalariAt([...histMatches, ...arsivMaclari]);
  // Filtresiz DNA da süzgeçten bağımsızdır: hem filtresiz yanıtın kendisi hem
  // de filtre özetindeki "aday" sayacı bunu kullanır. seasonYear verilmez —
  // tüm sezonlar hesaba girer (kullanıcı kararı, 21 Ağustos 2026).
  const ham = computePositionDna(kaynakArr, { excludeRoundId: cutRoundId });

  let combined = null;
  try {
    const fwd = await getPositionStats({ toRound: cutRoundId != null ? Number(cutRoundId) - 1 : undefined });
    combined = mergePositionStats(fwd, positionStatsFromHistory(histMatches));
  } catch { combined = positionStatsFromHistory(histMatches); }

  const val = { histMatches, activeSeason, arsivMaclari, kaynakArr, ham, combined };
  _dnaTaban = { at: Date.now(), key, val };
  return val;
}

export async function hesaplaSiraDnasi({ store, cur, cutRoundId, cutFreezeAt, guncelMi, filtre, sig = '' }) {
    const taban = await siraDnaTabani({ store, cutRoundId, cutFreezeAt, sig });
    const { histMatches, activeSeason, arsivMaclari, kaynakArr } = taban;

    // FİLTRELİ MOD: üstteki 1/X/2 dağılımı da listeyle AYNI süzgeçten geçer.
    // sec pencere kesiminden ÖNCE uygulandığı için last5/last10/last15
    // dilimleri "süzgece uyan son N MAÇ" olur (alt katmanın birimi maçtır).
    let sec = null;
    let filtreKaynak = null;
    if (filtre) {
      const { gecmisDeger, yakin } = filtreAraclari(filtre);
      const guncelMap = await guncelSiraDegerleri(store, cur, cutRoundId, filtre.mod);
      const gecmisIx = filtre.mod === 'oynanma'
        ? await oynanmaFiltreIndeksi(store, cutRoundId)
        : await oranIndeksi(store, cur, { beforeRoundId: cutRoundId });
      sec = (m) => {
        const g = guncelMap.get(Number(m.position));
        const h = gecmisDeger(gecmisIx.get(`${m.roundId}|${Number(m.position)}`));
        return g != null && h != null && yakin(g.deger, h, filtre.tol);
      };
      filtreKaynak = { guncelMap, gecmisIx, gecmisDeger };
    }

    // Süzgeçsiz istekte taban zaten hesapladı — ikinci kez koşulmaz.
    // seasonYear verilmez: tüm sezonlar (kullanıcı kararı, 21 Ağustos 2026).
    const dna = filtre
      ? computePositionDna(kaynakArr, {
        excludeRoundId: cutRoundId,
        sec,
      })
      : taban.ham;

    // FİLTRE ÖZETİ — kapsam dürüstlüğü sıra sıra: aday (süzgeç öncesi), verili
    // (değeri gerçekten bilinen), uyan (süzgeci geçen) ve güncel maçın değeri.
    // Aday/verili sayıları da computePositionDna'dan çıkar: "kullanılabilir
    // maç" tanımının tek sahibi odur, sayaç için ikinci tanım yazılmaz. Üç
    // koşu da bellek içidir ve sonuç 10 dk önbelleğe girer.
    let filtreOzeti = null;
    if (filtre) {
      const { ham } = taban;   // süzgeçten bağımsız — tabandan gelir
      const verili = computePositionDna(kaynakArr, {
        excludeRoundId: cutRoundId,
        sec: (m) => filtreKaynak.gecmisDeger(
          filtreKaynak.gecmisIx.get(`${m.roundId}|${Number(m.position)}`),
        ) != null,
      });
      const positions = {};
      for (let p = 1; p <= 15; p += 1) {
        const g = filtreKaynak.guncelMap.get(p) || null;
        positions[p] = {
          guncel: g?.deger ?? null,     // null → bu sırada filtre uygulanamaz (güncel veri yok)
          gun: g?.gun ?? null,
          aday: ham.positions.find((x) => x.position === p)?.sample ?? 0,
          verili: verili.positions.find((x) => x.position === p)?.sample ?? 0,
          uyan: dna.positions.find((x) => x.position === p)?.sample ?? 0,
        };
      }
      filtreOzeti = {
        mod: filtre.mod,
        tol: filtre.tol,
        positions,
        notu: 'Süzgeç, görüntülenen haftanın aynı sırasındaki maçın son kayıtlı değerine '
          + 'yakınlıkla uygulanır; değeri bilinmeyen geçmiş maç eşleşmez, güncel değeri '
          + 'olmayan sırada filtre uygulanamaz.',
      };
    }

    // İleri-test (official_forward) sıra istatistikleri — geçmiş arşivle
    // birleşik özet. Süzgeçten BAĞIMSIZ olduğu için tabandan gelir.
    const { combined } = taban;

    const availability = dna.totalMatches >= 10 ? 'available'
      : dna.totalMatches > 0 ? 'accumulating' : 'accumulating';
    const body = {
      hasData: dna.totalMatches > 0,
      availability,                       // available | accumulating (yapısal destek VAR)
      sources: ['Resmî geçmiş bülten arşivi', 'Mühürlü ileri-test haftaları'],
      // TARİHSEL KESİM — hangi haftaya göre hesaplandığı açıkça döner.
      // Doğrulama YÜZDEDEN değil, ham sayaçlardan yapılır (yuvarlama gizlemesin).
      cut: {
        roundId: cutRoundId,
        season: activeSeason,
        freezeAt: cutFreezeAt,
        isCurrent: guncelMi,
        historyMatches: histMatches.length,
        archiveMatches: arsivMaclari.length,
        archiveRounds: [...new Set(arsivMaclari.map((m) => String(m.roundId)))],
      },
      // Eski haftada snapshot yoksa bu ekran yalnız geçmiş sonuçlardan yeniden
      // üretilmiş bir simülasyondur; resmî mühür olarak sunulmaz.
      retrospective: !guncelMi,
      // Filtresiz istekte null — mevcut okuyucular için yanıt şekli değişmez.
      // combined BİLEREK filtresiz kalır: o alan radar formül köprüsüdür
      // (ileri-test istatistikleriyle birleşim); ekrandaki 1/X/2 dağılımı
      // dna.positions[].windows'tan okunur ve süzgeç orada uygulanır.
      filtre: filtreOzeti,
      dna,
      combined,
      examples: [4, 14].map((p) => positionSummaryText(dna, p, 'last50')),
      note: dna.totalMatches > 0 ? null
        : (filtre
          ? 'Seçilen yakınlıkta geçmiş maç yok — süzgeci genişletmeyi deneyebilirsiniz.'
          : 'Resmî geçmiş arşiv içe aktarımı sürüyor — veri biriktikçe bu bölüm dolar.'),
      disclaimer: dna.disclaimer,
    };
  return body;
}
