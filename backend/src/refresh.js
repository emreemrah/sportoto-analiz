// YENİLEME İŞİ
// 1) sportoto bültenini çeker
// 2) FootyStats sezonlarını (config'teki id'ler) çeker
// 3) Her bülten maçını FootyStats maçıyla eşleştirip analiz eder
// 4) Sonucu cache'e yazar (mobil uygulama buradan okur)
import { config, usingExampleKey } from './config.js';
import { getLatestBulletin, getBulletinByRoundId } from './sources/sportoto.js';
import { fetchSeason, fetchMatches, fetchLeagueInfo, fetchTeamVenue, fetchMatchScore } from './sources/footystats.js';
import { discoverSeasonIds } from './seasonDiscovery.js';
import { attachVenueProfiles } from './analysis/opponentStrength.js';
import { getWeather } from './weather.js';
import { fetchLiveFixtures, findLiveFixture } from './sources/apifootball.js';
import { findFootyMatch, normalizeName, hasFootyCandidate, hasFootyCandidateByTokens } from './matcher.js';
import { harvestCrests, saveRegistry, indexRegistry, attachCrests, crestCoverage } from './crestRegistry.js';
import { analyzeMatch, enrichSurprise } from './analysis/surprise.js';
import { evaluateCriteriaSignals } from './analysis/criteriaEval.js';
import { createExtrasCache, buildMatchStats } from './enrich.js';
import { predict } from './analysis/prediction.js';
import { applyRadarGuardsToBulletin } from './analysis/radarGuards.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachAiComments, aiEnabled } from './analysis/aiComment.js';
import { save, load } from './cache.js';
import { archiveOnRefresh, archivePreSave } from './archive/worker.js';
import { kaynakTakimKimlikleri, fiksturIndeksi } from './takimFikstur.js';
import { eslesenSayisi, kapsamGerilemesi } from './kapsamKorumasi.js';

// İki bülten arasındaki resmi alan farkları (kilit sonrası "sessiz değişiklik"
// tespiti için): roundId · hafta · maç sayısı · sıra no · takım adı · tarih-saat.
function diffBulletins(prev, cur) {
  const diffs = [];
  if (prev.roundId !== cur.roundId) diffs.push({ field: 'roundId', from: prev.roundId, to: cur.roundId });
  if (prev.round !== cur.round) diffs.push({ field: 'week', from: prev.round, to: cur.round });
  const pn = (prev.matches || []).length, cn = (cur.matches || []).length;
  if (pn !== cn) diffs.push({ field: 'matchCount', from: pn, to: cn });
  const prevBy = new Map((prev.matches || []).map((m) => [m.sportotoMatchId, m]));
  for (const m of (cur.matches || [])) {
    const p = prevBy.get(m.sportotoMatchId);
    if (!p) { diffs.push({ field: 'newMatch', no: m.no, home: m.home?.name, away: m.away?.name }); continue; }
    if (p.no !== m.no) diffs.push({ field: 'order', matchId: m.sportotoMatchId, from: p.no, to: m.no });
    if ((p.home?.name || '') !== (m.home?.name || '')) diffs.push({ field: 'homeTeam', no: m.no, from: p.home?.name, to: m.home?.name });
    if ((p.away?.name || '') !== (m.away?.name || '')) diffs.push({ field: 'awayTeam', no: m.no, from: p.away?.name, to: m.away?.name });
    if ((p.date || '') !== (m.date || '')) diffs.push({ field: 'dateTime', no: m.no, from: p.date, to: m.date });
  }
  return diffs;
}

// Değişiklik logunu (bulletinVerificationLog) ekle — son 100 kayıt tutulur.
function appendVerificationLog(entry) {
  const existing = load('bulletinVerificationLog')?.data || [];
  existing.push(entry);
  save('bulletinVerificationLog', existing.slice(-100));
}

// MAÇ-ÖNCESİ O-G-B-M: bir takımın, verilen tarihten ÖNCE oynanmış (bitmiş)
// sezon maçlarından galibiyet/beraberlik/mağlubiyet kaydı. Bültenin kendi
// maçları ve sonrası HARİÇ → "ilk maçtan önceki" donmuş kayıt.
function recordBefore(teamId, matches, beforeUnix) {
  if (teamId == null || !beforeUnix) return null;
  let w = 0, d = 0, l = 0;
  for (const m of matches) {
    if (!(m.dateUnix < beforeUnix)) continue;
    if (m.status !== 'finished' || !m.score) continue;
    const isHome = m.homeId === teamId, isAway = m.awayId === teamId;
    if (!isHome && !isAway) continue;
    const gf = isHome ? m.score.home : m.score.away;
    const ga = isHome ? m.score.away : m.score.home;
    if (gf > ga) w += 1; else if (gf < ga) l += 1; else d += 1;
  }
  return { p: w + d + l, w, d, l };
}
const unixOf = (iso) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : 0);

// FootyStats'tan GEÇİCİ skor index'i: bitmiş/canlı maçların skoru (footyMatchId
// ile). Resmi Spor Toto sonucu gelmeden önce "geçici" skor buradan gösterilir
// (rate-limitli API-Football yerine). Her refresh/backfill'de tazelenir.
function saveFootyScores(footyMatches) {
  const idx = {};
  for (const fm of footyMatches || []) {
    if ((fm.status === 'finished' || fm.status === 'live') && fm.score && fm.footyMatchId != null) {
      idx[fm.footyMatchId] = { score: fm.score, status: fm.status };
    }
  }
  save('footyScores', idx);
}

// HEDEFLİ CANLI SKOR TAZELEME — başlamış ama resmi sonucu gelmemiş maçların
// (footyMatchId'li) skorunu FootyStats'tan tek tek çekip footyScores'a MERGE eder.
// Tam refresh (6 saat) beklemeden, geçmiş bültendeki bugünkü maçlar da akar.
export async function refreshLiveFootyScores(footyMatchIds) {
  const ids = [...new Set((footyMatchIds || []).filter((x) => x != null))];
  if (!ids.length) return { updated: 0 };
  const idx = load('footyScores')?.data || {};
  let updated = 0;
  for (const id of ids) {
    try {
      const r = await fetchMatchScore(id);
      if (r && (r.status === 'live' || r.status === 'finished') && r.score) {
        idx[id] = { score: r.score, status: r.status };
        updated++;
      }
    } catch { /* tek maç hatası tüm akışı bozmasın */ }
  }
  if (updated) save('footyScores', idx);
  return { updated };
}

// GEÇMİŞE DÖNÜK TAHMİN ÜRETİMİ — ⛔ VARSAYILAN OLARAK KAPALI.
// Eski davranış: geçmiş hafta gezilince bu fonksiyon arka planda 'backfilled'
// snapshot üretiyor ve karneleri kirletiyordu. Yeni kural (kesin):
//  * Geçmiş haftayı GÖRÜNTÜLEMEK hiçbir tahmin/radar/kriter kaydı ÜRETMEZ.
//  * Backfill AKTİF cache'e ASLA yazılamaz ve HİÇBİR karneye katılamaz.
//  * Yalnız AÇIK kullanıcı/admin işlemiyle ({ manualRetrospective: true })
//    çalışır ve çıktı provenanceType='retrospective_backtest' işaretiyle
//    backend/legacy_archive/retrospective/ altına yazılır (aktif cache DEĞİL).
export async function snapshotRoundPredictions(roundId, { manualRetrospective = false } = {}) {
  if (!manualRetrospective) {
    throw new Error('Geçmişe dönük tahmin üretimi kapalı — yalnız açık retrospektif test (manualRetrospective) ile ve legacy_archive/retrospective altına üretilebilir.');
  }
  if (load(`snapshot-${roundId}`)?.data?.picks?.length) return -1; // zaten var
  const bulletin = await getBulletinByRoundId(roundId);
  const footyMatches = [];
  const teamImg = new Map();       // `${sid}:${teamId}` → kulüp arması
  const matchesBySid = new Map();  // sid → o sezonun maçları (kayıt HESABI için)
  const dusenSezonlar = []; // düşen sezonlar (görünürlük — sessiz yutma yok)
  for (const sid of config.seasonIds) {
    try {
      const season = await fetchSeason(sid);
      footyMatches.push(...season.matches);
      matchesBySid.set(sid, season.matches);
      for (const t of season.teams || []) if (t.id != null && t.image) teamImg.set(`${sid}:${t.id}`, t.image);
    } catch (e) {
      // SESSİZ DEĞİL (2026-08-06 denetimi): bir sezon düşerse bülten eksik
      // veriyle devam ediyordu ve HİÇ İZ KALMIYORDU — 2 Ağustos'taki
      // "14/15 → 0/15" kapsam çöküşünün kardeşi. Akış yine kesilmez
      // (tek sezon yüzünden bülten üretilmemesi daha kötüdür), ama artık
      // loga yazılır ve kapsam raporundan sayılabilir.
      dusenSezonlar.push({ sid, hata: e.message });
      console.warn(`[refresh] ⚠ sezon ${sid} çekilemedi: ${e.message}`);
    }
  }
  saveFootyScores(footyMatches);
  const picks = bulletin.matches.map((bm) => {
    const found = findFootyMatch(bm, footyMatches);
    const beforeUnix = unixOf(bm.date);
    let analysis, homeLogo = '', awayLogo = '', homeRec = null, awayRec = null;
    if (found?.match) {                       // ambiguous → veri bağlanmaz
      const fm = found.match;
      const hId = found.swapped ? fm.awayId : fm.homeId;
      const aId = found.swapped ? fm.homeId : fm.awayId;
      homeLogo = teamImg.get(`${fm.seasonId}:${hId}`) || '';
      awayLogo = teamImg.get(`${fm.seasonId}:${aId}`) || '';
      // MAÇ-ÖNCESİ kayıt: bu maçtan önce, AYNI SEZONDA oynanmış maçlardan (donmuş).
      const seasonMatches = matchesBySid.get(fm.seasonId) || [];
      homeRec = recordBefore(hId, seasonMatches, beforeUnix);
      awayRec = recordBefore(aId, seasonMatches, beforeUnix);
      const odds = found.swapped ? { home: fm.odds.away, draw: fm.odds.draw, away: fm.odds.home } : fm.odds;
      const preXg = found.swapped ? { home: fm.preXg.away, away: fm.preXg.home } : fm.preXg;
      const prePpg = found.swapped ? { home: fm.prePpg.away, away: fm.prePpg.home } : fm.prePpg;
      analysis = analyzeMatch({ odds, preXg, prePpg });
    } else {
      analysis = analyzeMatch({ odds: null });
    }
    const prediction = predict({ analysis, stats: null });
    return {
      no: bm.no, symbol: prediction?.symbol ?? null, label: prediction?.label ?? null,
      homeLogo, awayLogo, homeRec, awayRec,
      footyMatchId: found?.match ? found.match.footyMatchId : null,   // geçici skor (FootyStats) için
      footySwapped: found ? found.swapped : false,
    };
  });
  // RETROSPEKTİF DEPO: aktif cache'e DEĞİL, legacy_archive/retrospective altına
  // açık provenance işaretleriyle yazılır — hiçbir karneye/radara katılamaz.
  const retroDir = process.env.LEGACY_ARCHIVE_DIR
    ? join(process.env.LEGACY_ARCHIVE_DIR, 'retrospective')
    : join(dirname(fileURLToPath(import.meta.url)), '..', 'legacy_archive', 'retrospective');
  mkdirSync(retroDir, { recursive: true });
  const payload = {
    savedAt: new Date().toISOString(),
    data: {
      roundId, savedAt: new Date().toISOString(),
      backfilled: true, retrospective: true, provenanceType: 'retrospective_backtest',
      isOfficialForward: false, picks,
    },
  };
  writeFileSync(join(retroDir, `snapshot-${roundId}.json`), JSON.stringify(payload));
  const n = picks.filter((p) => p.symbol && p.symbol !== '-').length;
  console.log(`[retrospektif] legacy_archive/retrospective/snapshot-${roundId}: ${n}/${picks.length} tahmin (RESMÎ KARNEYE GİRMEZ)`);
  return n;
}

export async function refreshAll() {
  const startedAt = new Date().toISOString();
  console.log(`[refresh] başladı ${startedAt} (anahtar: ${usingExampleKey ? 'example/örnek' : 'gerçek'})`);

  // 1) Bülten (resmi doğrulamalı: yayınlanmış + tam 15 gerçek maç)
  const bulletin = await getLatestBulletin();

  // 1a) DOĞRULAMA KİLİDİ: resmi kaynakta doğrulanmamışsa yeni bülten ÜRETME.
  // Gerçek/eski veriyi silmeyiz: aynı haftanın geçerli cache'i varsa (geçici
  // API hatası) korunur; hiç yoksa "bülten bekleniyor" durumu yazılır.
  if (!bulletin.published) {
    // Geçici API hatasına karşı: aynı haftanın DAHA ÖNCE TEYİT EDİLMİŞ (confirmed)
    // cache'i varsa korunur — doğrulanmamış veri onu EZMEZ. (Kilit + eski hafta korunur.)
    const prev = load('bulletin')?.data;
    if (prev && !prev.pending && prev.roundId === bulletin.roundId && prev.matchCount === 15) {
      console.warn(`[refresh] yeni veri teyit edilemedi (${bulletin.verifyReason}) — aynı haftanın teyitli cache'i korunuyor.`);
      return prev;
    }
    // Teyit tamamlanmadı → maç listesi AÇILMAZ, "bekleniyor" durumu yazılır.
    const failed = bulletin.verification?.status === 'failed';
    const pending = {
      updatedAt: new Date().toISOString(),
      pending: true,
      verification: bulletin.verification || { status: 'pendingVerification', confirmed: false },
      title: failed ? 'Bülten henüz resmi olarak doğrulanmadı' : 'Henüz açıklanmadı',
      reason: 'Güncel resmi bülten bekleniyor.',
      verifyReason: bulletin.verifyReason || null,
      year: bulletin.year || null,
      round: bulletin.round || null,
      roundId: bulletin.roundId || null,
      closeDate: bulletin.closeDate || null,
      matchCount: 0,
      matchedCount: 0,
      upcomingCount: 0,
      noUpcoming: true,
      matches: [],
      radar: [],
    };
    save('bulletin', pending);
    console.warn(`[refresh] BÜLTEN TEYİT EDİLMEDİ (${bulletin.verification?.status}) → "bekleniyor" yazıldı. (${bulletin.verifyReason})`);
    return pending;
  }

  console.log(`[refresh] bülten: ${bulletin.year} ${bulletin.round} — ${bulletin.matchCount} maç`);

  // 1c) Gerçek lig adı + logosu (seasonId → { name, image }). Ad, jenerik resmi
  // etiketi ("2026 Sezonu") gerçek lig adıyla değiştirmek için; logo ise ana
  // sayfadaki kayan lig şeridi için. Alınamazsa akış BOZULMAZ: resmi etiket
  // olduğu gibi kalır, logo boş geçer (şerit nötr simge çizer).
  let leagueInfo = new Map();
  try {
    leagueInfo = await fetchLeagueInfo();
  } catch (e) {
    console.warn(`[refresh] lig adları alınamadı: ${e.message}`);
  }

  // 1b) KİLİT: kapanış (resmi roundCloseDate — ilk maçın başlamasına 5 dk
  // kala) geçtiyse bu bültenin analiz/istatistik/tahmini bir daha DEĞİŞMEZ.
  // Aynı haftanın (roundId aynı) önceki cache'i varsa, maç bazında (kendisi
  // henüz başlamamış olsa bile) o donmuş analiz kullanılır — sadece
  // durum/skor (aşağıdaki "started" dalı, zaten canlı kalmaya devam eder)
  // güncellenir. Farklı bir hafta geldiğinde (örn. Pazar yayını, yeni
  // roundId) kilit uygulanmaz; o hafta için sıfırdan analiz üretilir ve
  // eskisinin (kilitli) cache'ini ezmez — save() zaten ayrı bir sonraki
  // çağrıda bu yeni bulletin'i yazar, eski hafta ayrıca /api/history'den hep
  // erişilebilir kalır (resmi Spor Toto verisinden, cache'ten bağımsız).
  const previousCache = load('bulletin');
  const previousBulletin = previousCache?.data || null;
  const sameBulletin = !!(previousBulletin && previousBulletin.roundId === bulletin.roundId);
  const isLocked = !!(bulletin.closeDate && new Date(bulletin.closeDate).getTime() <= Date.now());
  const prevByMatchId = new Map(
    (sameBulletin ? previousBulletin.matches : []).map((m) => [m.sportotoMatchId, m])
  );
  if (isLocked && sameBulletin) {
    console.log('[refresh] bülten kilitli (kapanış geçti) — henüz başlamamış maçların analizi donmuş halde korunacak.');
  }

  // 2) FootyStats sezonları → tek havuz (+ sezon bazlı, son 5 formu için)
  // OTOMATİK SEZON KEŞFİ (dar kapsam): .env artık zorunlu doğruluk kaynağı
  // DEĞİL — bootstrap/fallback. Kaynak panelinde seçili liglerin GÜNCEL
  // sezonları TTL'li katalog metadata'sından otomatik seçilir (kadın/genç/
  // rezerv hariç, üst sınırlı, fail-closed). Yeni lig/sezon bir sonraki
  // otomatik döngüde kullanıcı müdahalesi olmadan kapsanır.
  let seasonIds = [...new Set(config.seasonIds.map(Number))];
  let discoveryMeta = null;
  if (!usingExampleKey) {
    const disc = await discoverSeasonIds({ envIds: config.seasonIds, roundId: bulletin.roundId });
    seasonIds = disc.ids;
    discoveryMeta = disc.meta;
    console.log(`[refresh] sezon keşfi: catalog=${disc.meta.catalogCount ?? '?'}${disc.meta.catalogFromCache ? '(cache)' : ''}, dynamicSeasons=${disc.meta.dynamicCount}, totalSeasons=${seasonIds.length}${disc.meta.failClosed ? ` · FAIL-CLOSED(${disc.meta.reason})` : ''}`);
  }
  const footyMatches = [];
  const matchesBySeason = new Map();
  const teamsBySeason = new Map();
  // DÜŞEN SEZONLAR SAYILIR ve KAYDEDİLİR. Eskiden yalnız console.warn'a
  // yazılıyordu: çalıştırmanın çıktısı hiçbir yerde durmadığı için, veri
  // eksildiğinde NEDEN eksildiği sonradan hiç anlaşılamıyordu. Artık sebep
  // durum dosyasına yazılır ve tek denemede pes edilmez.
  const dusenSezonlar = [];
  for (const sid of seasonIds) {
    let sonHata = null;
    for (let deneme = 1; deneme <= 2; deneme++) {
      try {
        const season = await fetchSeason(sid);
        footyMatches.push(...season.matches);
        matchesBySeason.set(sid, season.matches);
        teamsBySeason.set(sid, season.teams);
        console.log(`[refresh] FootyStats sezon ${sid}: ${season.matches.length} maç${deneme > 1 ? ` (${deneme}. deneme)` : ''}`);
        sonHata = null;
        break;
      } catch (e) {
        sonHata = e.message;
        // Geçici hatada (ağ dalgalanması) kısa bir bekleyip bir kez daha dene.
        // Hız sınırında (429) ISRAR ETME — daha çok istek durumu kötüleştirir.
        if (deneme === 1 && !/\b429\b/.test(e.message)) {
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          break;
        }
      }
    }
    if (sonHata) {
      dusenSezonlar.push({ seasonId: sid, error: sonHata });
      console.warn(`[refresh] FootyStats sezon ${sid} alınamadı: ${sonHata}`);
    }
  }
  if (dusenSezonlar.length) {
    console.warn(`[refresh] ⚠ ${dusenSezonlar.length}/${seasonIds.length} sezon alınamadı — kapsam eksik olabilir.`);
    // DİKKAT: `nowIso` bu dosyada ÇOK DAHA AŞAĞIDA tanımlı (const). Burada
    // kullanmak çalışma anında ReferenceError verirdi — zamanı yerinde üret.
    try { save('failedSeasons', { at: new Date().toISOString(), roundId: bulletin.roundId, toplam: seasonIds.length, dusen: dusenSezonlar }); } catch { /* kayıt olmasa da akış sürsün */ }
  }
  saveFootyScores(footyMatches);

  // 2a) ARMA KAYIT DEFTERİ — kulüp armasını fikstür eşleşmesinden AYIR.
  // Bu haftanın sezon takım listelerindeki armalar kalıcı deftere işlenir.
  // Defter kalıcı olduğu için bir lig sonraki haftalarda kapsam dışına düşse
  // bile o kulüplerin arması korunur. Defter yazılamazsa akış BOZULMAZ; eldeki
  // (eski) defterle devam edilir, o da yoksa armalar boş kalır (nötr ⚽).
  let crestIndex = null;
  try {
    const h = harvestCrests(teamsBySeason);
    saveRegistry(h.registry);
    crestIndex = indexRegistry(h.registry);
    console.log(`[refresh] arma defteri: ${h.total} takım (+${h.added} yeni · ${h.refreshed} tazelendi · bu hafta ${h.seen} kayıt tarandı)`);
  } catch (e) {
    console.warn(`[refresh] arma defteri güncellenemedi: ${e.message}`);
    try { crestIndex = indexRegistry(); } catch { crestIndex = null; }
  }

  // KAPSAM TEŞHİSİ için FootyStats takım adı havuzu (normalize + HAM).
  // Ham adlar da tutulur: kelime kümesi kontrolü normalize edilmemiş ada bakar.
  const footyNorm = new Set();
  const footyRaw = new Set();
  for (const fmx of footyMatches) {
    if (fmx.homeName) { footyNorm.add(normalizeName(fmx.homeName)); footyRaw.add(fmx.homeName); }
    if (fmx.awayName) { footyNorm.add(normalizeName(fmx.awayName)); footyRaw.add(fmx.awayName); }
  }
  // HAVUZA SEZON TAKIM LİSTELERİ DE GİRER. Yalnız fikstürlerden kurulan havuz,
  // sezonu henüz başlamamış bir ligin takımını "kaynakta yok" gösterir — oysa
  // takım kaynakta VARDIR, eksik olan yalnız o maçın fikstürüdür (ör. 31.07.2026'da
  // Eredivisie fikstürü boştu ve "AZ Alkmaar bulunamadı" deniyordu). Bu ayrım
  // önemli: "takım yok" ile "fikstür yok" farklı sebeplerdir ve kullanıcıya
  // doğru olanı gösterilir.
  for (const takimlar of teamsBySeason.values()) {
    for (const t of takimlar || []) {
      for (const ad of [t?.name, t?.cleanName]) {
        if (ad) { footyNorm.add(normalizeName(ad)); footyRaw.add(ad); }
      }
    }
  }
  const footyRawList = [...footyRaw];

  // TEŞHİS, EŞLEŞTİRİCİYLE AYNI KATMANLARI KULLANMALI.
  // Eşleştirici (sideMatches) üç katmanlıdır: ad → logo → kelime kümesi.
  // Teşhis yalnız ADA bakarsa, kelime kümesiyle bulunabilen bir takım için
  // "takım bulunamadı" der ve kullanıcıya YANLIŞ sebep gösterir. Gerçek sebep
  // fikstürün kaynakta olmamasıdır (ör. lig sezonlarında yer almayan kupa
  // finalleri). Örnek: bülten "Union St.Gilloise" ↔ kaynak "Royal Union
  // Saint-Gilloise", bülten "AZ Alkmaar" ↔ kaynak "Alkmaar Zaanstreek" —
  // ikisi de kelime kümesiyle EŞLEŞİR, ada bakan kontrol ıskalar.
  const takimKaynakta = (team) => hasFootyCandidate(team, footyNorm)
    || hasFootyCandidateByTokens(team, footyRawList);
  // Eşleşmeyen maçın SEBEBİNİ sınıfla: lig kapsam dışı mı, takım yok mu, yoksa
  // isim/tarih mi tutmadı (alias'la düzeltilebilir). Uydurma veri ÜRETİLMEZ;
  // maç listeden DÜŞMEZ — kart 'Yetersiz Veri' olarak korunur.
  const classifyCoverage = (bm, found) => {
    if (found?.ambiguous) {
      // Birden fazla aday fikstür — yanlış takıma bağlamaktansa reddet.
      return { ok: false, reason: 'Birden fazla aday fikstür — güvenli eşleşme yapılamadı', code: 'ambiguous_team_match', homeIn: true, awayIn: true };
    }
    if (found) return { ok: true, reason: null, trace: found.trace ?? null };
    const homeIn = takimKaynakta(bm.home);
    const awayIn = takimKaynakta(bm.away);
    let reason, code;
    if (!homeIn && !awayIn) { reason = 'Bu lig için güncel kaynak verisi bulunamadı'; code = 'league_not_in_source'; }
    else if (homeIn && awayIn) { reason = 'Maç verisi eşleştirilemedi'; code = 'fixture_not_matched'; }
    else { reason = `${homeIn ? bm.away.name : bm.home.name} için analiz verisi bulunamadı`; code = 'team_not_in_source'; }
    return { ok: false, reason, code, homeIn, awayIn };
  };

  // 3) Eşleştir + analiz et + zenginleştir (puan durumu, oyuncular, h2h)
  let matched = 0;
  let frozenReused = 0; // kilit nedeniyle yeniden hesaplanmayıp donmuş halinden alınan maç sayısı
  // Başlamış ama donmuş hâli olmayan maç sayısı — tahmin ÜRETİLMEDİ (bkz. aşağıdaki gerekçe).
  let gecmisTahminUretilmedi = 0;
  const getExtras = createExtrasCache(matchesBySeason, teamsBySeason);
  const analyzedMatches = [];
  for (const bm of bulletin.matches) {
    // Başlamış maç = resmi sonuç/skoru var VEYA maç saati geçti.
    const started = bm.status === 'finished'
      || (bm.date && new Date(bm.date).getTime() <= Date.now());

    // CANLI/final skoru (başlamış maç için) — analizle KARIŞTIRILMAZ.
    const found = findFootyMatch(bm, footyMatches);
    const fm = found?.match;
    const coverage = classifyCoverage(bm, found);

    // Jenerik resmi lig etiketini ("2026 Sezonu") eşleşen FootyStats liginin
    // GERÇEK adıyla değiştir. Eşleşme yoksa resmi etiket olduğu gibi kalır.
    // Logo da buradan gelir: lig adı ile logo AYNI kayıttan okunur, böylece
    // ekranda "Danimarka Superliga" yazıp yanına başka ligin arması düşemez.
    if (fm && fm.seasonId != null) {
      const bilgi = leagueInfo.get(String(fm.seasonId));
      if (bilgi?.name) bm.league = bilgi.name;
      if (bilgi?.image) bm.leagueImage = bilgi.image;
    }
    // KAYNAK TAKIM KİMLİKLERİ — takım fikstürü ekranı bunlarla çalışır.
    // `home.externalTeamId` BAŞKA bir sağlayıcının kimliğidir ve buradaki
    // sezon verisiyle EŞLEŞMEZ (ör. Randers: 2614 ≠ 2521); bu yüzden
    // eşleşen maçın kendi kimlikleri ayrıca yazılır.
    // `swapped`: bülten ev/deplasmanı ters listelemişse kimlikler de çevrilir,
    // yoksa takım kartı rakibin fikstürünü açardı.
    if (fm) {
      const kimlik = kaynakTakimKimlikleri(fm, found.swapped);
      bm.footyHomeId = kimlik.home;
      bm.footyAwayId = kimlik.away;
    }

    // RESMÎ SKOR ile HARİCİ SKOR AYRI ALANLARDA TUTULUR.
    //
    // NEDEN: `score` alanı EKRAN içindir ve başlamış maçlarda harici
    // sağlayıcının canlı/bitmiş skoruyla EZİLİR. Aynı alan aşağıda arşive de
    // gidiyordu (archiveOnRefresh → ingestOfficialResults) ve orada
    // `resultSource: 'Spor Toto resmi API'` etiketiyle mühürleniyordu. Yani
    // harici bir skor resmî kayıt gibi arşivlenebiliyordu — yanlış bir sonucun
    // "kesin" görünmesi demek. Resmî sonuç HARFİ (1/X/2) doğru kalsa bile
    // arşivlenen skor yanlış kaynaktan gelebiliyordu.
    //
    // Artık resmî skor `resmiSkor`ta DEĞİŞMEDEN durur; harici skor yalnız
    // `score`a yazılır. Arşiv YALNIZ `resmiSkor` okur (bkz. archive/worker.js).
    const resmiSkor = bm.score || null;
    let score = resmiSkor;
    let isLive = false;
    if (started && fm && fm.score && (fm.status === 'live' || fm.status === 'finished')) {
      score = found.swapped ? { home: fm.score.away, away: fm.score.home } : fm.score;
      isLive = fm.status === 'live';
    }

    // KİLİT: kapanış geçti + aynı hafta → analiz/istatistik/tahmin DONMUŞ
    // hâlinden AYNEN alınır (yeniden hesaplanmaz). Bu, BAŞLAMIŞ maçlar için de
    // geçerlidir: maç başlamadan önceki veriler (form, kazanma ihtimali, notlar,
    // son maçlar, hakem…) değişmez; sadece skor/durum güncellenir.
    const prevSnap = (isLocked && sameBulletin) ? prevByMatchId.get(bm.sportotoMatchId) : null;
    if (prevSnap) {
      frozenReused++;
      analyzedMatches.push({
        ...bm,
        started,
        live: isLive,
        score,
        analysis: prevSnap.analysis,
        stats: prevSnap.stats,
        prediction: prevSnap.prediction,
        preOdds: prevSnap.preOdds ?? null,
        footyMatchId: prevSnap.footyMatchId ?? fm?.footyMatchId ?? null,
        footySwapped: prevSnap.footySwapped ?? found?.swapped ?? false,
        footySeasonId: prevSnap.footySeasonId ?? fm?.seasonId ?? null,
        footyGameWeek: fm?.gameWeek ?? prevSnap.footyGameWeek ?? null,
        coverage,
        ...(prevSnap.aiComment !== undefined ? { aiComment: prevSnap.aiComment } : {}),
      });
      continue;
    }

    // BAŞLAMIŞ MAÇA DONMUŞ HÂLİ YOKSA TAHMİN ÜRETİLMEZ.
    //
    // Yukarıdaki kilit yolu `prevSnap`e bağlıdır. Snapshot yoksa (önbellek
    // temizlenmiş, sunucu boş cache ile açılmış, kilitten sonraki İLK yenileme)
    // akış buraya düşüyor ve BAŞLAMIŞ bir maç için yeni analiz + tahmin
    // hesaplanıp sistem tahmini gibi saklanıyordu.
    //
    // Bu, projenin en temel kuralını deliyor: karneye YALNIZ maç öncesi
    // mühürlenmiş tahmin girer. Sonradan üretilmiş bir tahmin, maç-öncesi
    // veriden hesaplansa bile "önceden bilinmiş" sayılamaz — üretildiği an
    // maçtan sonradır ve doğrulanabilir bir mühürü yoktur.
    //
    // Bu yüzden: başlamış + donmuş hâli yok → maç listeye GİRER (skor, durum
    // görünür) ama analiz/tahmin BOŞTUR ve sebebi yazılır. Uydurma yerine
    // boşluk; projenin "veri yoksa sebebini yaz" kuralı.
    if (started) {
      gecmisTahminUretilmedi++;
      analyzedMatches.push({
        ...bm,
        started,
        live: isLive,
        score,
        resmiSkor,
        analysis: null,
        stats: null,
        prediction: null,
        preOdds: null,
        footyMatchId: fm?.footyMatchId ?? null,
        footySwapped: found?.swapped ?? false,
        footySeasonId: fm?.seasonId ?? null,
        coverage,
        analysisAbsence: {
          code: 'started_without_snapshot',
          text: 'Maç başladıktan sonra tahmin üretilmez — bu maçın mühürlü analizi yok.',
        },
      });
      continue;
    }

    // Snapshot yok → analiz MAÇ-ÖNCESİ değerlerden hesaplanır. FootyStats
    // odds/xG/ppg'yi maç anında dondurur; başlamış maçta bile bunlar "pre-match"
    // değerlerdir, yani YENİ analiz değil, sabit maç-öncesi analizdir. Bu ilk
    // hesap, sonraki refresh'lerde (kilit + aynı hafta) donmuş snapshot olur.
    let analysis, stats = null, preOdds = null;
    if (found) {
      matched++;
      const odds = found.swapped
        ? { home: fm.odds.away, draw: fm.odds.draw, away: fm.odds.home }
        : fm.odds;
      // Kilit anındaki maç-öncesi oranlar arşiv snapshot'ına girer (kaynak: FootyStats).
      preOdds = (odds && (odds.home || odds.draw || odds.away)) ? odds : null;
      const preXg = found.swapped
        ? { home: fm.preXg.away, away: fm.preXg.home }
        : fm.preXg;
      const prePpg = found.swapped
        ? { home: fm.prePpg.away, away: fm.prePpg.home }
        : fm.prePpg;
      analysis = analyzeMatch({ odds, preXg, prePpg });
      try {
        stats = await buildMatchStats(found, getExtras);
        // Kader kriterleri (form/saha/savunma) ile sürpriz analizini derinleştir.
        analysis = enrichSurprise(analysis, stats);
        // RAKİP SEVİYESİ & SAHA PROFİLİ (point-in-time) — Radar 1 için:
        // ev YALNIZ ev, deplasman YALNIZ deplasman; rakip sınıfı o maçtan
        // ÖNCEKİ tabloyla (bugünkü sıra geçmişe uygulanmaz).
        try {
          const vpSeason = matchesBySeason.get(fm.seasonId) || [];
          attachVenueProfiles(stats, {
            seasonMatches: vpSeason,
            homeId: found.swapped ? fm.awayId : fm.homeId,
            awayId: found.swapped ? fm.homeId : fm.awayId,
            beforeUnix: unixOf(bm.date),
          });
        } catch (e) { console.warn(`[refresh] saha profili atlandı (#${bm.no}): ${e.message}`); }
      } catch (e) {
        console.warn(`[refresh] zenginleştirme atlandı (#${bm.no}): ${e.message}`);
      }
    } else {
      analysis = analyzeMatch({ odds: null }); // veri yok
    }
    const prediction = predict({ analysis, stats });
    analyzedMatches.push({
      ...bm,
      started,
      live: isLive,
      score,
      resmiSkor,          // resmî kaynağın skoru — harici veriyle EZİLMEZ
      analysis,
      stats,
      prediction,
      preOdds,
      footyMatchId: fm?.footyMatchId ?? null,
      footySwapped: found?.swapped ?? false,
      footySeasonId: fm?.seasonId ?? null,
      footyGameWeek: fm?.gameWeek ?? null,
      coverage,
    });
  }

  // 3a) TAKIM ARMALARI — her maçın İKİ takımı için ayrı ayrı karar verilir.
  // Sıra: 1) bu maçın kendi kaynak eşleşmesinden gelen arma (en kesin),
  //       2) yoksa arma kayıt defteri (fikstür eşleşmesine İHTİYAÇ DUYMAZ),
  //       3) o da yoksa boş → ekranda nötr ⚽ (asla başka kulübün arması değil).
  // NOT: m.home / m.away YENİ nesneyle değiştirilir; resmî bülten nesnesi
  // (bulletin.matches[i].home) değişmeden kalır — imza/teyit akışı etkilenmez.
  attachCrests(analyzedMatches, crestIndex);
  const crestReport = crestCoverage(analyzedMatches);
  console.log(`[refresh] arma kapsamı: ${crestReport.filled}/${crestReport.total} dolu (fikstürden ${crestReport.fromFixture} · defterden ${crestReport.fromRegistry})`);
  if (crestReport.missing) {
    console.warn(`[refresh] ⚠ ARMA: ${crestReport.missing} yer boş — ${crestReport.missingTeams.map((t) => `#${t.no} ${t.name}`).join(', ')}`);
  }

  // EŞLEŞME SAYISI SONUÇTAN OKUNUR, AKIŞ YOLUNDAN DEĞİL.
  //
  // `matched++` yalnız "yeniden hesaplanan" dalda çalışıyordu. KİLİTLİ haftada
  // her maç donmuş snapshot yolundan `continue` ettiği için sayaç 0 kalıyor,
  // aşağıdaki kapsam koruması da bunu "kapsam çöktü" sanıp yenilemeyi
  // durduruyordu — veri gayet sağlamken. Aynı tuzak, başlamış ama mührü
  // olmayan maç dalında da tekrarlanırdı.
  //
  // Sayaç artık üretilen bültenden hesaplanıyor: koruma neyi koruyorsa onu
  // ölçüyor (önceki bülten için de AYNI fonksiyon kullanılıyor). Yeni bir akış
  // dalı eklendiğinde sayacı güncellemeyi unutmak artık mümkün değil.
  matched = eslesenSayisi({ matches: analyzedMatches });

  const upcomingCount = analyzedMatches.filter((m) => !m.started).length;
  console.log(`[refresh] başlamamış maç: ${upcomingCount}/${bulletin.matchCount} · eşleşen: ${matched}${frozenReused ? ` · donmuş (kilit): ${frozenReused}` : ''}${gecmisTahminUretilmedi ? ` · tahmin üretilmedi (başlamış, mühür yok): ${gecmisTahminUretilmedi}` : ''}`);

  // KAPSAM RAPORU — eşleşmeyen maçları sebebiyle kaydet + logla (kontrol mekanizması).
  const uncovered = analyzedMatches
    .filter((m) => m.coverage && !m.coverage.ok)
    .map((m) => ({ no: m.no, home: m.home.name, away: m.away.name, league: m.league || null, reason: m.coverage.reason }));
  const coverageReport = {
    generatedAt: new Date().toISOString(), roundId: bulletin.roundId, round: bulletin.round, year: bulletin.year,
    total: bulletin.matches.length, matched, uncoveredCount: uncovered.length, uncovered,
    // ARMA KAPSAMI ayrı raporlanır: maç eşleşmesi tutmasa da arma dolabilir,
    // dolayısıyla "eşleşmeyen maç" ile "armasız takım" aynı sayı DEĞİLDİR.
    crest: crestReport,
  };
  save('coverage', coverageReport);
  if (uncovered.length) {
    console.warn(`[refresh] ⚠ VERİ KAPSAMI: ${uncovered.length}/${bulletin.matches.length} maç eşleşmedi:`);
    for (const u of uncovered) console.warn(`   #${u.no} ${u.home} - ${u.away} → ${u.reason}`);
  } else {
    console.log('[refresh] ✓ VERİ KAPSAMI: tüm maçlar eşleşti.');
  }
  // TAKIM FİKSTÜR İNDEKSİ — bültendeki takımların ELİMİZDEKİ TÜM turnuvalardaki
  // maçları (lig + kupa + Avrupa; hesapta hangileri seçiliyse). Burada kurulur
  // çünkü tüm sezonların maçları (footyMatches) yalnız bu noktada bir arada.
  // Başarısız olursa akış BOZULMAZ: uç tek sezonluk yedeğe düşer ve bunu
  // `kaynak: 'tek-sezon'` ile açıkça bildirir.
  try {
    const takimIdleri = [];
    const adlar = new Map();
    for (const am of analyzedMatches) {
      if (am.footyHomeId != null) { takimIdleri.push(am.footyHomeId); adlar.set(String(am.footyHomeId), am.home?.name ?? null); }
      if (am.footyAwayId != null) { takimIdleri.push(am.footyAwayId); adlar.set(String(am.footyAwayId), am.away?.name ?? null); }
    }
    const ham = fiksturIndeksi(takimIdleri, footyMatches, leagueInfo);
    const indeks = {};
    for (const [id, fikstur] of Object.entries(ham)) indeks[id] = { ad: adlar.get(id) ?? null, fikstur };
    save('teamFixtures', indeks);
    const turnuva = new Set(Object.values(ham).flat().map((f) => f.lig).filter(Boolean));
    console.log(`[refresh] takım fikstürü: ${Object.keys(indeks).length} takım · ${turnuva.size} turnuva`);
  } catch (e) {
    console.warn(`[refresh] takım fikstür indeksi kurulamadı: ${e.message}`);
  }

  // OPERASYONEL ÖZET (yalnız backend logu — müşteri ekranına gitmez).
  console.log(`[refresh] özet: catalog=${discoveryMeta?.catalogCount ?? '-'}, dynamicSeasons=${discoveryMeta?.dynamicCount ?? 0}, totalSeasons=${seasonIds.length}, matches=${bulletin.matches.length}, matched=${matched}`);

  // 3a) MAÇ BİLGİ KARTI — lig haftası + stadyum/şehir (ev sahibi) + hava (Open-Meteo).
  // Veri yoksa alan atlanır (uydurma yok). Stadyum takım-başına, şehir hava-başına cache'li.
  // PARALEL: 15 maçın stadyum+hava isteği eskiden tek tek beklenirdi (seri
  // döngü). Ağ gecikmesi toplandığı için yenileme gereksiz uzuyordu.
  // Önce benzersiz takımların stadyumları TEK SEFER ve paralel çekilir
  // (venueCache aynı takımı tekrar sormayı zaten engelliyordu), sonra hava
  // istekleri paralel yapılır. Sıra bağımlılığı yok; sonuçlar maça yazılır.
  const venueCache = new Map();
  let weatherOk = 0;
  const teamIds = [...new Set(
    analyzedMatches.map((m) => m.stats?.home?.standing?.teamId).filter((id) => id != null),
  )];
  await Promise.all(teamIds.map(async (id) => {
    venueCache.set(id, await fetchTeamVenue(id).catch(() => null));
  }));
  await Promise.all(analyzedMatches.map(async (m) => {
    const info = { leagueWeek: m.footyGameWeek || null };
    const teamId = m.stats?.home?.standing?.teamId;
    if (teamId != null) {
      const v = venueCache.get(teamId);
      if (v?.stadium) info.stadium = v.stadium;
      if (v?.city) info.city = v.city;
      if (v?.country) info.country = v.country;
      // Hava: sadece yaklaşan maçta (tahmin penceresi) ve şehir varsa.
      if (v?.city && !m.started) {
        const w = await getWeather(v.city, m.date).catch(() => null);
        if (w) { info.weather = w; weatherOk += 1; }
      }
    }
    m.info = info;
  }));
  console.log(`[refresh] maç bilgi kartı: stadyum ${venueCache.size ? [...venueCache.values()].filter(Boolean).length : 0} · hava ${weatherOk}`);

  // 3b) Claude maç yorumları (anahtar varsa)
  if (aiEnabled) {
    console.log(`[refresh] Claude yorumları üretiliyor…`);
    await attachAiComments(analyzedMatches);
    const done = analyzedMatches.filter((m) => m.aiComment).length;
    console.log(`[refresh] AI yorumu yazılan maç: ${done}`);
  } else {
    console.log(`[refresh] AI yorumu kapalı (ANTHROPIC_API_KEY yok) — kural-tabanlı yorum kullanılacak.`);
  }

  // 4) Sürpriz radarı: puanı olan (oranlı VEYA tahmini) maçları sırala.
  // En sürprize açık en üstte; karar destek için kader-kriter sinyalleri eklenir.
  const radarSignals = (stats) => {
    if (!stats?.home || !stats?.away) return null;
    const h = stats.home, a = stats.away, sig = {};
    if (h.last5?.length || a.last5?.length) sig.form = { home: h.last5 || [], away: a.last5 || [] };
    const hv = h.standing?.home, av = a.standing?.away;
    if (hv || av) sig.venue = {
      home: hv ? { wins: hv.wins || 0, draws: hv.draws || 0, losses: hv.losses || 0 } : null,
      away: av ? { wins: av.wins || 0, draws: av.draws || 0, losses: av.losses || 0 } : null,
    };
    if (h.season?.xgFor != null && a.season?.xgFor != null) sig.xg = {
      home: h.season.xgFor, away: a.season.xgFor,                    // genel (overall) xG hücum
      homeVenue: h.season.xgForHome ?? null, awayVenue: a.season.xgForAway ?? null,       // ev sahibi iç saha · deplasman dış saha xG
      homeAgainst: h.season.xgAgainstHome ?? null, awayAgainst: a.season.xgAgainstAway ?? null, // iç/dış xGA (savunma)
    };
    if (h.season?.goalsPerGame != null && a.season?.goalsPerGame != null) sig.goals = {
      home: { for: h.season.goalsPerGame, against: h.season.concededPerGame ?? null },
      away: { for: a.season.goalsPerGame, against: a.season.concededPerGame ?? null },
    };
    if (h.standing?.position != null && a.standing?.position != null) sig.position = { home: h.standing.position, away: a.standing.position };
    return Object.keys(sig).length ? sig : null;
  };
  // NOT: donmuş hâli olmayan BAŞLAMIŞ maçlarda `analysis` bilerek NULLdur
  // (yukarı bkz. başlamış + snapshot yok → tahmin üretilmez). Radar bu maçları
  // filtrede eler; korumasız okuma tüm yenilemeyi çökertiyordu.
  const buildRadar = (includeStarted) => analyzedMatches
    .filter((m) => (includeStarted || !m.started) && m.analysis?.surpriseScore != null)
    .sort((a, b) => b.analysis.surpriseScore - a.analysis.surpriseScore)
    .map((m) => ({
      no: m.no,
      home: m.home.mediumName,
      away: m.away.mediumName,
      surpriseScore: m.analysis.surpriseScore,
      label: m.analysis.label,
      labelColor: m.analysis.labelColor,
      estimated: m.analysis.estimated,
      prediction: m.prediction?.symbol,
      predictionLabel: m.prediction?.label ?? null,   // eski sistemin verdict etiketi (BANKO/NET/TEMKİNLİ/ÇİFTE/AÇIK)
      predictionReason: m.prediction?.reason ?? null,
      favorite: m.analysis.favorite || null,
      probabilities: m.analysis.probabilities || null,
      comment: m.analysis.comment || null,
      // Etkisi en yüksek kanıt en üstte (maçın kaderini belirleyen sırayla)
      factors: (m.analysis.factors || []).slice().sort((x, y) => (y.points || 0) - (x.points || 0)).slice(0, 4),
      signals: radarSignals(m.stats),
    }));

  // 4b) RADAR DONDURMA ("screenshot" mantığı): ilk maçın başlamasına 5 dk kala
  // radar MÜHÜRLENIR ve hafta boyunca bir daha DEĞİŞMEZ. Kullanıcının maç
  // öncesi gördüğü tahmin, maçlar oynanırken/bitince de aynen kalır.
  // Yeni hafta (roundId değişince) mühür sıfırlanır, normal akış başlar.
  const RADAR_FREEZE_BEFORE_MS = 5 * 60 * 1000;
  const kickoffs = analyzedMatches.map((m) => new Date(m.date).getTime()).filter(Number.isFinite);
  const firstKickoff = kickoffs.length ? Math.min(...kickoffs)
    : (bulletin.closeDate ? new Date(bulletin.closeDate).getTime() : null);
  const radarFreezeAt = firstKickoff != null ? firstKickoff - RADAR_FREEZE_BEFORE_MS : null;
  let radar, radarFrozenAt = null;
  if (sameBulletin && previousBulletin?.radarFrozenAt && previousBulletin?.radar?.length) {
    // Mühür zaten var → radarı AYNEN koru (yeni hesap yok).
    radar = previousBulletin.radar;
    radarFrozenAt = previousBulletin.radarFrozenAt;
  } else if (radarFreezeAt != null && Date.now() >= radarFreezeAt) {
    // Mühür anı geçti, kayıtlı mühür yok → ŞİMDİ hesapla ve mühürle.
    // (Sunucu donma anında kapalıysa bile pre-match analizler snapshot'tan
    //  donuk geldiği için başlayan maçlar dahil maç-öncesi değerler yazılır.)
    radar = buildRadar(true);
    radarFrozenAt = new Date().toISOString();
    console.log(`[refresh] 🔒 radar donduruldu (${radar.length} maç) — hafta boyu değişmeyecek.`);
  } else {
    // Donma anından önce: normal canlı akış (her refresh'te güncellenir).
    radar = buildRadar(false);
  }
  // ⛔ ESKİ radar-<roundId> DOSYA ARŞİVİ YAZILMIYOR (yeni başlangıç kararı):
  // haftalık mühürlü radar artık YALNIZ kalıcı arşiv snapshot'ındaki Radar
  // Merkezi çıktısıdır (hash'li, doğrulanabilir). Eski hash'siz dosya arşivi
  // üretimden kaldırıldı; mevcut eski dosyalar `npm run archive:legacy` ile
  // backend/legacy_archive/ altına taşınır ve hiçbir karneye katılmaz.

  // 4c) BÜLTEN ZORLUK SKORU — mevcut analizden türetilir (uydurma yok).
  // Denk maç (net favori yok) + beraberlik sinyali + sürprize açık + veri eksiği.
  const difficulty = (() => {
    const total = analyzedMatches.length || 1;
    let denk = 0, drawRisk = 0, noData = 0, surpriseOpen = 0;
    for (const m of analyzedMatches) {
      const p = m.analysis?.probabilities;
      if (!p) { noData += 1; continue; }
      if (Math.max(p['1'], p['X'], p['2']) < 45) denk += 1;
      if (p['X'] >= 30) drawRisk += 1;
      if (m.analysis.label === 'SÜRPRİZE AÇIK') surpriseOpen += 1;
    }
    const score = Math.round(Math.min(100,
      (denk / total) * 55 + (drawRisk / total) * 25 + (surpriseOpen / total) * 15 + (noData / total) * 25));
    const level = score < 30 ? 'Kolay' : score < 50 ? 'Orta' : score < 70 ? 'Orta-zor' : 'Zor';
    const parts = [];
    if (denk) parts.push(`${denk} maç denk güçte`);
    if (drawRisk) parts.push(`${drawRisk} maçta beraberlik sinyali yüksek`);
    if (surpriseOpen) parts.push(`${surpriseOpen} maç sürprize açık`);
    if (noData) parts.push(`${noData} maçta veri eksik`);
    const text = parts.length
      ? `${parts.join(' · ')}.${score >= 30 ? ' Güçlü aday sayısını sınırlı tutmak mantıklı.' : ''}`
      : 'Analiz verisi yeterli, belirgin risk kümesi yok.';
    return { level, score, denk, drawRisk, surpriseOpen, noData, text };
  })();

  // 4d) MAÇ RİSK ETİKETLERİ — her maça hızlı okunur, nedenli etiketler.
  // Yalnız eldeki analiz/istatistikten türetilir; veri yoksa etiket atılmaz.
  const vRateOf = (rec) => {
    if (!rec) return null;
    const p = (rec.wins || 0) + (rec.draws || 0) + (rec.losses || 0);
    return p ? (rec.wins || 0) / p : null;
  };
  for (const m of analyzedMatches) {
    const tags = [];
    const a = m.analysis || {};
    const p = a.probabilities || null;
    const fav = a.favorite?.symbol || null;
    const awayWr = vRateOf(m.stats?.away?.standing?.away);
    if (a.label === 'BANKO' && fav) tags.push({ t: 'Güçlü aday', why: `Favori "${fav}" %${a.favorite.percent} ile açık önde.` });
    if (p && p['X'] >= 30) tags.push({ t: 'Beraberlik kokusu', why: `Beraberlik ihtimali %${p['X']} — X / çift ihtimal düşünülmeli.` });
    if ((a.label === 'DİKKAT' || a.label === 'SÜRPRİZE AÇIK') && fav) tags.push({ t: 'Riskli favori', why: `Favori var ama kanıtlar tartışmalı (sürpriz puanı ${a.surpriseScore}).` });
    if (fav === '1' && awayWr != null && awayWr >= 0.45) tags.push({ t: 'Deplasman tuzağı', why: `Deplasman dış sahada güçlü (galibiyet %${Math.round(awayWr * 100)}) — ev favorisi yanıltabilir.` });
    if (a.surpriseScore != null && a.surpriseScore >= 60) tags.push({ t: 'Tek geçilmez', why: 'Sürpriz puanı yüksek — tek seçim yerine çift/üçlü daha güvenli.' });
    if (a.surpriseScore != null && a.surpriseScore >= 75) tags.push({ t: 'Kupon bozabilecek maç', why: 'Bültenin en riskli maçlarından — geniş geçilmezse kupon riski büyük.' });
    if (p && !fav) tags.push({ t: 'Veri sınırlı', why: 'Favori belirlemek için kanıt yetersiz.' });
    m.tags = tags.length ? tags : null;
  }

  // TEYİT: bu bülten resmi teyidi geçti. Son teyit zamanını kaydet; imza aynı
  // kaldıysa ilk teyit zamanını (verifiedAt) koru (badge sabit görünsün).
  const nowIso = new Date().toISOString();
  const prevVer = previousBulletin?.verification || null;
  const sameSig = !!(prevVer && sameBulletin && prevVer.signature === bulletin.verification.signature);
  const verification = {
    ...bulletin.verification,               // confirmed, status, signature, checks
    verifiedAt: sameSig ? (prevVer.verifiedAt || nowIso) : nowIso, // ilk teyit (stabil)
    lastVerifiedAt: nowIso,                  // son teyit
    label: 'Resmi bülten teyit edildi',
  };

  // KİLİT SONRASI SESSİZ DEĞİŞİKLİK: aynı hafta + imza değiştiyse farkları logla.
  if (sameBulletin && prevVer && prevVer.signature && prevVer.signature !== bulletin.verification.signature) {
    const diffs = diffBulletins(previousBulletin, { roundId: bulletin.roundId, round: bulletin.round, matches: analyzedMatches });
    if (diffs.length) {
      appendVerificationLog({ at: nowIso, type: isLocked ? 'silentChangeAfterLock' : 'preLockChange', roundId: bulletin.roundId, isLocked, prevSignature: prevVer.signature, newSignature: bulletin.verification.signature, diffs });
      console.warn(`[refresh] ⚠️ resmi kaynak farkı loglandı (${isLocked ? 'KİLİT SONRASI' : 'kilit öncesi'}): ${diffs.length} değişiklik`);
    }
  }

  const result = {
    updatedAt: nowIso,
    usingExampleKey,
    verification,                            // { confirmed:true, status:'confirmed', signature, verifiedAt, ... }
    year: bulletin.year,
    round: bulletin.round,
    roundId: bulletin.roundId,
    closeDate: bulletin.closeDate,
    analysisLockedAt: isLocked ? (previousBulletin?.analysisLockedAt || nowIso) : null,
    matchCount: bulletin.matchCount,
    matchedCount: matched,
    upcomingCount,
    noUpcoming: upcomingCount === 0,
    coverage: { total: bulletin.matches.length, matched, uncoveredCount: uncovered.length, uncovered },
    matches: analyzedMatches,
    radar,
    radarFrozenAt,                           // 🔒 mühür zamanı (null = henüz canlı)
    difficulty,                              // bülten zorluk skoru
  };

  // RADAR MERKEZİ + ARŞİV KAYIT AŞAMASI (cache yazılmadan önce):
  // bülten/maç kimlikleri + gözlem zaman serisi arşive işlenir, Radar 1-5 +
  // Master Radar merkezî olarak hesaplanır ve bülten verisine iliştirilir.
  // Kilitli haftada önceki (mühürlü) radar sonucu AYNEN korunur.
  const { radarCenter, analysisCenter } = await archivePreSave(result, { previous: previousBulletin, isLocked: isLocked && sameBulletin });
  if (radarCenter) result.radarCenter = radarCenter;
  if (analysisCenter) result.analysisCenter = analysisCenter;

  // RADAR KORUMALARI (1525/1526 hafta analizlerinin düzeltmesi): kupon önerisi
  // Radar Merkezi sinyalleriyle çelişiyorsa yalnız GENİŞLETİLİR (motor çelişkisi,
  // yüksek yatma riski, yüksek sürpriz DNA, ters radar yönü). Kilitli haftada
  // hiçbir tahmine dokunulmaz — mühür ve karne bütünlüğü korunur.
  const korunan = applyRadarGuardsToBulletin(result, { isLocked: isLocked && sameBulletin });
  if (korunan) console.log(`[refresh] radar koruması ${korunan} maçın önerisini genişletti`);

  // ═══ GERİLEME KORUMASI — İYİ VERİYİ BOZUK VERİYLE EZME ═══
  // GERÇEK OLAY (2 Ağustos 2026): kaynak HTTP 429 (hız sınırı) döndü, 57
  // sezonun HEPSİ düştü, eşleşme 14/15 → 0/15 oldu. Sezon hataları yalnız
  // console.warn'a yazıldığı için akış devam etti, dolu bülten TAMAMEN BOŞ
  // bültenle ezildi ve durum `ok: true` kaydedildi. Kullanıcı verisiz bir
  // ekranla kaldı; sistem kendini başarılı sanıyordu.
  //
  // KURAL: aynı hafta için elde ÇALIŞAN bir bülten varken, kapsamı ciddi
  // biçimde DÜŞMÜŞ bir sonuç yazılmaz. Eski veri korunur ve durum HATA olarak
  // bildirilir. Eski veriyi göstermek, boş ekran göstermekten iyidir; ikisi de
  // olmazsa bari sessiz kalmasın.
  const oncekiEslesen = sameBulletin ? eslesenSayisi(previousBulletin) : 0;
  if (kapsamGerilemesi(oncekiEslesen, matched)) {
    const mesaj = `kapsam çöktü: ${oncekiEslesen} → ${matched} (kaynak erişilemiyor olabilir) — ESKİ BÜLTEN KORUNDU`;
    console.error(`[refresh] ⛔ ${mesaj}`);
    save('autoRefreshStatus', {
      lastTrigger: 'guard', startedAt: nowIso, finishedAt: new Date().toISOString(),
      state: 'idle', ok: false, error: mesaj,
      roundId: bulletin.roundId, matchedCount: matched, matchCount: bulletin.matches.length,
      previousMatchedCount: oncekiEslesen,
    });
    throw new Error(mesaj);
  }

  save('bulletin', result);
  // Bu haftanın maç-başı SİSTEM TAHMİNİ snapshot'ı (roundId ile) — hafta geçmişe
  // düşünce /api/history buradan "Sistem tahmini"ni gösterir (güncelle aynı satır).
  try {
    save(`snapshot-${bulletin.roundId}`, {
      roundId: bulletin.roundId, round: bulletin.round, savedAt: nowIso,
      picks: analyzedMatches.map((m) => {
        const hs = m.stats?.home?.standing, as = m.stats?.away?.standing;
        const beforeUnix = unixOf(m.date);   // MAÇ-ÖNCESİ (bu maçtan önce) donmuş kayıt
        const seasonMatches = matchesBySeason.get(m.footySeasonId) || [];
        return {
          no: m.no, symbol: m.prediction?.symbol ?? null, label: m.prediction?.label ?? null,
          // Arma: önce maçın kendi eşleşmesi, yoksa arma kayıt defteri (m.home.logo).
          homeLogo: m.stats?.home?.logo || m.home?.logo || '', awayLogo: m.stats?.away?.logo || m.away?.logo || '',
          homeRec: recordBefore(hs?.teamId, seasonMatches, beforeUnix),
          awayRec: recordBefore(as?.teamId, seasonMatches, beforeUnix),
          footyMatchId: m.footyMatchId ?? null,
          footySwapped: m.footySwapped ?? false,
          // Kriter karnesi: her kriterin maç-öncesi sinyali (yoksa null).
          criteria: evaluateCriteriaSignals(m.stats),
        };
      }),
    });
  } catch (e) { console.warn('[refresh] snapshot yazılamadı:', e.message); }

  // KALICI ARŞİV ENTEGRASYONU — bülten + maç kimlikleri + gözlem zaman serisi
  // (kilit öncesi) ve resmî sonuçlar (kilit sonrası) kalıcı arşive işlenir.
  // Hata olursa refresh akışı BOZULMAZ (archiveOnRefresh içeride yutar/loglar).
  await archiveOnRefresh(result);

  console.log(`[refresh] bitti, cache'e yazıldı. (teyit: ${verification.status} · imza ${String(verification.signature).slice(0, 10)}…)`);
  return result;
}

// HAFİF CANLI-SKOR GÜNCELLEMESİ
// Sadece "canlı penceredeki" (saati geçmiş, ~3.5 saat içinde, henüz final olmamış)
// maçların skorunu FootyStats'ten tazeler. Analiz/AI/zenginleştirme YOK.
// Canlı maç yoksa hiç API çağrısı yapmadan mevcut veriyi döndürür (bedava).
const LIVE_WINDOW_MS = 3.5 * 3600 * 1000;
function inLiveWindow(m, now) {
  if (!m?.date) return false;
  const t = new Date(m.date).getTime();
  return Number.isFinite(t) && t <= now && now - t <= LIVE_WINDOW_MS;
}

// PAYLAŞIMLI canlı fixture cache — API-Football'dan TÜM canlı maçlar tek çağrıda.
// Hem güncel hem geçmiş bülten aynı 40sn'lik cache'i kullanır → ekstra API yok.
let _liveFx = { at: 0, fixtures: [] };
export async function getLiveFixtures() {
  const now = Date.now();
  if (now - _liveFx.at < 40000) return _liveFx.fixtures;
  try {
    const fx = await fetchLiveFixtures();
    _liveFx = { at: now, fixtures: fx || [] };
  } catch (e) {
    console.warn(`[live] API-Football: ${e.message}`);
    _liveFx = { at: now, fixtures: _liveFx.fixtures }; // eski cache'i koru, throttle'ı ilerlet
  }
  return _liveFx.fixtures;
}

export async function refreshLiveScores() {
  const cached = load('bulletin');
  if (!cached?.data) return null;
  const data = cached.data;
  const now = Date.now();

  // Tarih-temelli: saati geçmiş (canlı pencere) + henüz final olmamış her maç.
  // (Cache'teki 'started' bayrağına bakmayız; son refresh'ten sonra başlayanı da yakalar.)
  const targets = data.matches.filter((m) => !m.finalized && inLiveWindow(m, now));
  if (targets.length === 0) return data; // canlı maç yok → API'ye gitme

  // API-Football: şu an oynanan TÜM maçlar (gerçek canlı skor + dakika) — paylaşımlı cache
  const fixtures = await getLiveFixtures();

  let changed = false;
  const matches = data.matches.map((m) => {
    if (m.finalized || !inLiveWindow(m, now)) return m;
    const found = findLiveFixture(m, fixtures);
    const f = found?.fixture;
    if (!f) {
      // Canlı listede yoksa: canlıydıysa artık bitmiş say (son skoru koru)
      if (m.live) {
        changed = true;
        return { ...m, live: false, finalized: true, minute: null };
      }
      return m;
    }
    const score = found.swapped
      ? { home: f.awayGoals, away: f.homeGoals }
      : { home: f.homeGoals, away: f.awayGoals };
    const live = f.live;
    const finalized = f.finished;
    const minute = live ? f.minute : null;
    const same = m.started && m.score
      && m.score.home === score.home && m.score.away === score.away
      && m.live === live && m.minute === minute && m.liveStatus === f.statusShort;
    if (same && !finalized) return m;
    changed = true;
    // Sadece skor/durum güncellenir; analiz/stats/tahmin (maç-öncesi donmuş
    // değerler) AYNEN korunur — canlı skor bunları ezmez. fixtureId + resmi
    // durum kodu (SUSP/INT = maç durdu, vb.) canlı detay ekranı için taşınır.
    return {
      ...m,
      started: true,
      live,
      finalized,
      score,
      resmiSkor,          // resmî kaynağın skoru — harici veriyle EZİLMEZ
      minute,
      liveStatus: f.statusShort || null,
      fixtureId: f.fixtureId ?? m.fixtureId ?? null,
    };
  });

  if (!changed) return data;
  const updated = { ...data, matches, liveUpdatedAt: new Date().toISOString() };
  save('bulletin', updated);
  console.log(`[live] ${targets.length} canlı-pencere maçı güncellendi`);
  return updated;
}

// Doğrudan "node src/refresh.js" ile çalıştırılırsa bir kez yenile
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  refreshAll().catch((e) => {
    console.error('[refresh] HATA:', e.message);
    process.exit(1);
  });
}
