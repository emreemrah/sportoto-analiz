// RADAR KARNESİ — YALNIZ mühürlü snapshot'lardaki radar tahminleri × resmî
// 90 dk sonuçlarından hesaplanır. Geçmişe dönük sinyal ÜRETİLMEZ; mühürlenmemiş
// hafta karneye GİRMEZ. Küçük örneklem her satırda n ile birlikte gösterilir.
import { getArchiveStore } from '../archive/store.js';
import { RADAR_IDS, RADAR_META, CLASSIFICATIONS, GATES, sampleConfidence } from './config.js';
import { recordFromArchive, classifyRecord } from '../scorecards/provenance.js';

const pct = (c, t) => (t ? Math.round((c / t) * 100) : null);

function newBucket() {
  return {
    evaluated: 0,
    main: { total: 0, hit: 0 },                       // ana 1/X/2 tahmin doğruluğu
    strong: { total: 0, hit: 0 },                     // Güçlü Aday: main == resmî sonuç
    surprise: { total: 0, favoriteFailed: 0, exactHit: 0 }, // yakalama ve KESİN YÖN ayrı
    medium: { total: 0, mainHit: 0 },
    byDirection: { '1': { total: 0, hit: 0 }, X: { total: 0, hit: 0 }, '2': { total: 0, hit: 0 } },
  };
}

function feedBucket(b, m, official) {
  const master = m.radarCenter.master;
  if (!master?.mainPrediction) return;
  b.evaluated += 1;
  b.main.total += 1;
  const mainHit = master.mainPrediction === official.officialResult;
  if (mainHit) b.main.hit += 1;
  const dir = b.byDirection[master.mainPrediction];
  if (dir) { dir.total += 1; if (mainHit) dir.hit += 1; }

  if (master.classification === CLASSIFICATIONS.STRONG) {
    b.strong.total += 1;
    if (mainHit) b.strong.hit += 1;                    // banko başarısı = kilitli ana tahmin tuttu
  } else if (master.classification === CLASSIFICATIONS.SURPRISE) {
    b.surprise.total += 1;
    const fav = master.favorite?.symbol || null;
    if (fav && fav !== official.officialResult) b.surprise.favoriteFailed += 1;  // sürpriz yakalama
    if (master.exactDirection && master.exactDirection === official.officialResult) b.surprise.exactHit += 1; // kesin yön
  } else if (master.classification === CLASSIFICATIONS.MEDIUM) {
    b.medium.total += 1;
    if (mainHit) b.medium.mainHit += 1;
  }
}

function finishBucket(b) {
  return {
    evaluated: b.evaluated,
    mainAccuracy: { hit: b.main.hit, total: b.main.total, rate: pct(b.main.hit, b.main.total), confidence: sampleConfidence(b.main.total) },
    strongCandidate: { hit: b.strong.hit, total: b.strong.total, rate: pct(b.strong.hit, b.strong.total), confidence: sampleConfidence(b.strong.total) },
    surpriseCandidate: {
      total: b.surprise.total,
      favoriteFailed: b.surprise.favoriteFailed,
      catchRate: pct(b.surprise.favoriteFailed, b.surprise.total),          // 1) favori kazanamadı mı
      exactHit: b.surprise.exactHit,
      exactRate: pct(b.surprise.exactHit, b.surprise.total),               // 2) kesin yön (X / karşı galibiyet)
      confidence: sampleConfidence(b.surprise.total),
    },
    mediumRisk: { total: b.medium.total, mainHit: b.medium.mainHit, rate: pct(b.medium.mainHit, b.medium.total) },
    byDirection: Object.fromEntries(Object.entries(b.byDirection).map(([k, v]) => [k, { ...v, rate: pct(v.hit, v.total) }])),
  };
}

export async function buildRadarScorecard({ store = getArchiveStore() } = {}) {
  const bulletins = (await store.listBulletins()).sort((a, b) => b.roundId - a.roundId);

  const rounds = [];             // karneye giren haftalar (yeniden eskiye)
  const perRadar = {};           // radar-id → { direction: {total,hit}, surpriseSignal: {total, caught} }
  for (const id of Object.values(RADAR_IDS)) perRadar[id] = { direction: { total: 0, hit: 0 }, surpriseSignal: { total: 0, caught: 0 } };
  const byLeague = new Map();
  const all = newBucket();
  const methodologies = new Set();
  let dqSum = 0, dqN = 0;

  // ---- KRİTER KARNESİ (kullanıcı isteği): HER ŞEYİN başarısı, LİG kırılımlı --
  // * Sinyal düzeyi: her radarın her yönlü sinyali (form, xG üstünlüğü, iç saha
  //   gücü, …) resmî sonuçla tek tek ölçülür — genel + lig bazında. Amaç:
  //   "form X liginde işliyor, Y'de işlemiyor" gerçeğini VERİYLE görmek.
  // * Kural düzeyi: güç dengesi kuralı (fark ≥ 10 puan → güçlü/zayıf, altı denk)
  //   ileri-testte doğrulanır: "Ev güçlü" dediklerimizde 1 ne sıklıkla geldi,
  //   "denk" dediklerimizde dağılım neydi?
  // * DÜRÜSTLÜK: yalnız mühürlü (official_forward) tahminler; küçük örneklem her
  //   hücrede n + güven etiketiyle; veri yokken oran uydurulmaz.
  const SIDE_SYM = { home: '1', draw: 'X', away: '2' };
  const perRadarLeague = new Map();                   // `${id}|${lig}` → {total,hit}
  const signalAgg = new Map();                        // key → {key,label,radarId,overall,leagues:Map}
  const newDist = () => ({ total: 0, results: { '1': 0, X: 0, '2': 0 }, expectedHit: 0 });
  const strengthRule = {
    evaluated: 0,
    tiers: { homeStrong: newDist(), awayStrong: newDist(), even: newDist() },
    leagues: new Map(),                               // lig → {homeStrong,awayStrong,even}
  };
  const SB_TIER = { weak: 'homeStrong', strong: 'awayStrong', even: 'even' }; // dep sınıfı → kural kovası
  const SB_EXPECT = { homeStrong: '1', awayStrong: '2' };                     // "güçlü taraf kazanır" beklentisi
  const SB_INV = { strong: 'weak', weak: 'strong', even: 'even' };            // rakip sınıfı ters çevirme (ev↔dep)
  // Maç tipine göre Master başarı: sistem DENK maçlarda mı, sınıf farkı olan
  // maçlarda mı daha iyi? (lig kırılımının yanındaki İKİNCİ boyut — altın kural.)
  const byBalance = { homeStrong: newBucket(), awayStrong: newBucket(), even: newBucket() };
  // OYNANMA KAÇIŞI karnesi: mühürlü playedMovement.signal.active maçlar.
  // Başarı tanımı sürpriz-yakalamayla simetriktir: açılış favorisi ≥dropPts
  // puan kaybettiyse maç favori DIŞI mı bitti? Eski snapshot'larda alan yok →
  // n=0'dan dürüst başlar; geçmişe dönük sinyal üretilmez.
  const playedMoveAgg = { total: 0, favoriteFailed: 0, results: { '1': 0, X: 0, '2': 0 } };

  const excludedByType = {};                                             // provenance şeffaflığı
  let excludedCount = 0;
  for (const b of bulletins) {
    const snap = await store.getSnapshot(b.id).catch(() => null);
    if (!snap?.payload?.matches?.some((m) => m.radarCenter)) continue;   // mühürlü radar yoksa karneye girmez
    // RESMÎ İLERİ-TEST KAPISI (default-deny): backfilled/demo/retrospektif/geç
    // kilitli veya kanıtı eksik snapshot RESMÎ Radar Karnesi'ne GİRMEZ.
    const cls = classifyRecord(recordFromArchive(b, snap), { requireOfficialProfile: false });
    if (!cls.isOfficialForward) {
      excludedCount += 1;
      excludedByType[cls.provenanceType] = (excludedByType[cls.provenanceType] || 0) + 1;
      continue;
    }
    const results = await store.listOfficialResults(b.id).catch(() => []);
    if (!results.length) continue;
    const resByMatch = new Map(results.map((r) => [String(r.matchId), r]));

    const roundBucket = newBucket();
    let used = false;
    for (const m of snap.payload.matches) {
      if (!m.radarCenter) continue;
      const official = resByMatch.get(String(m.matchId));
      if (!official) continue;                                           // resmî sonuç yoksa sayılmaz
      // NOTER KARARI radar karnesine GİRMEZ (2026-08-10): maç oynanmadı,
      // tahmin sınanamadı — işaret kupon kuralı gereği geçerli ama motor
      // isabetini ölçemez. Kupon tarafı evaluation'da viaNotary ile ayrı.
      if (official.resultType === 'notary_decision') continue;
      used = true;
      feedBucket(all, m, official);
      feedBucket(roundBucket, m, official);
      methodologies.add(m.radarCenter.master?.methodologyVersion || 'bilinmiyor');
      if (m.radarCenter.master?.dataQuality != null) { dqSum += m.radarCenter.master.dataQuality; dqN += 1; }

      const lg = m.league || 'Diğer';
      if (!byLeague.has(lg)) byLeague.set(lg, newBucket());
      feedBucket(byLeague.get(lg), m, official);

      // Oynanma kaçışı: mühürlü sinyal × resmî sonuç.
      const pmSig = m.playedMovement?.signal;
      if (pmSig?.active && pmSig.favoriteSymbol) {
        playedMoveAgg.total += 1;
        if (playedMoveAgg.results[official.officialResult] != null) playedMoveAgg.results[official.officialResult] += 1;
        if (official.officialResult !== pmSig.favoriteSymbol) playedMoveAgg.favoriteFailed += 1;
      }

      // Maçın güç dengesi sınıfı (altın kural) — sinyal/kural kırılımları için.
      const sb = m.radarCenter.radars?.[RADAR_IDS.PERFORMANCE]?.details?.strengthBalance;
      const bucketKey = sb?.tier ? SB_TIER[sb.tier] : null;
      if (bucketKey) feedBucket(byBalance[bucketKey], m, official);

      // Radar bazlı: her radarın kendi yönü + sürpriz sinyali (mühürlü değerlerden).
      const fav = m.radarCenter.master?.favorite?.symbol || null;
      for (const id of Object.values(RADAR_IDS)) {
        const r = m.radarCenter.radars?.[id];
        if (!r?.hasData) continue;
        if (r.direction) {
          perRadar[id].direction.total += 1;
          if (r.direction === official.officialResult) perRadar[id].direction.hit += 1;
          // Radar × LİG kırılımı ("xG şu liglerde işliyor" sorusunun cevabı).
          const rlKey = `${id}|${lg}`;
          if (!perRadarLeague.has(rlKey)) perRadarLeague.set(rlKey, { id, league: lg, total: 0, hit: 0 });
          const rl = perRadarLeague.get(rlKey);
          rl.total += 1;
          if (r.direction === official.officialResult) rl.hit += 1;
        }
        if (fav && r.favoriteFailureRisk != null && r.favoriteFailureRisk >= GATES.surprise.radarFailureRiskSignal) {
          perRadar[id].surpriseSignal.total += 1;
          if (fav !== official.officialResult) perRadar[id].surpriseSignal.caught += 1;
        }
        // SİNYAL DÜZEYİ: yönlü her sinyal tek tek ölçülür — genel + LİG + RAKİP
        // SINIFI (altın kural: sinyalin gösterdiği tarafın karşısındaki takım
        // güçlü müydü, denk mi, zayıf mı? "Form güçlü rakibe karşı işliyor mu?").
        for (const s of r.activeSignals || []) {
          const pred = SIDE_SYM[s.side];
          if (!pred || !s.key) continue;               // yönsüz (bilgi) sinyaller ölçülmez
          if (!signalAgg.has(s.key)) {
            signalAgg.set(s.key, {
              key: s.key, label: s.label || s.key, radarId: id,
              overall: { total: 0, hit: 0 }, leagues: new Map(),
              tiers: { strong: { total: 0, hit: 0 }, even: { total: 0, hit: 0 }, weak: { total: 0, hit: 0 } },
            });
          }
          const agg = signalAgg.get(s.key);
          const hit = pred === official.officialResult;
          agg.overall.total += 1; if (hit) agg.overall.hit += 1;
          if (!agg.leagues.has(lg)) agg.leagues.set(lg, { total: 0, hit: 0 });
          const lgB = agg.leagues.get(lg);
          lgB.total += 1; if (hit) lgB.hit += 1;
          // Rakip sınıfı: '1' sinyalinin rakibi deplasman (sb.tier), '2'ninki ev
          // (ters), X yönsüz → sınıf kırılımına girmez. sb yoksa uydurulmaz.
          const oppTier = sb?.tier ? (s.side === 'home' ? sb.tier : s.side === 'away' ? SB_INV[sb.tier] : null) : null;
          if (oppTier && agg.tiers[oppTier]) {
            agg.tiers[oppTier].total += 1; if (hit) agg.tiers[oppTier].hit += 1;
          }
        }
      }

      // KURAL DÜZEYİ: güç dengesi (fark ≥ 10 puan) ileri-test doğrulaması.
      if (bucketKey) {
        strengthRule.evaluated += 1;
        const feedDist = (d) => {
          d.total += 1;
          if (d.results[official.officialResult] != null) d.results[official.officialResult] += 1;
          if (SB_EXPECT[bucketKey] && SB_EXPECT[bucketKey] === official.officialResult) d.expectedHit += 1;
        };
        feedDist(strengthRule.tiers[bucketKey]);
        if (!strengthRule.leagues.has(lg)) {
          strengthRule.leagues.set(lg, { homeStrong: newDist(), awayStrong: newDist(), even: newDist() });
        }
        feedDist(strengthRule.leagues.get(lg)[bucketKey]);
      }
    }
    if (used) rounds.push({ roundId: b.roundId, round: b.week, season: b.season, bucket: roundBucket });
  }

  const window = (n) => {
    const w = newBucket();
    for (const r of rounds.slice(0, n)) {
      const rb = r.bucket;
      w.evaluated += rb.evaluated;
      w.main.total += rb.main.total; w.main.hit += rb.main.hit;
      w.strong.total += rb.strong.total; w.strong.hit += rb.strong.hit;
      w.surprise.total += rb.surprise.total; w.surprise.favoriteFailed += rb.surprise.favoriteFailed; w.surprise.exactHit += rb.surprise.exactHit;
      w.medium.total += rb.medium.total; w.medium.mainHit += rb.medium.mainHit;
      for (const k of ['1', 'X', '2']) { w.byDirection[k].total += rb.byDirection[k].total; w.byDirection[k].hit += rb.byDirection[k].hit; }
    }
    return finishBucket(w);
  };

  return {
    generatedAt: new Date().toISOString(),
    source: 'Mühürlü official_forward snapshot tahminleri × resmî Spor Toto 90 dk sonuçları',
    predictionSource: 'Mühürlü Radar Merkezi (Master Radar) tahminleri — maç öncesi kilitlenir',
    resultSource: 'Resmî Spor Toto 90 dakika sonuçları (ayrı kayıt)',
    hasData: all.evaluated > 0,
    hasOfficialForwardData: rounds.length > 0,
    isDemo: false,
    isOfficialForward: true,
    provenanceType: 'official_forward',
    includedCount: rounds.length,
    excludedCount,
    exclusionBreakdown: excludedByType,
    note: all.evaluated === 0
      ? 'Henüz resmî Radar ileri-test verisi yok. Gerçek bültenler mühürlenip sonuçlandıkça karne oluşacaktır — geçmişe dönük tahmin üretilmez; backfill/demo kayıtlar bu karneye girmez.'
      : (all.evaluated < 30 ? 'Örneklem küçük — yüzdeler henüz güçlü başarı kanıtı değildir; her oranın yanındaki n değerine bakın.' : null),
    roundsCounted: rounds.length,
    avgDataQuality: dqN ? Math.round(dqSum / dqN) : null,
    methodologyVersions: [...methodologies],
    master: {
      allTime: finishBucket(all),
      last5: window(5),
      last10: window(10),
    },
    weeks: rounds.map((r) => ({ roundId: r.roundId, round: r.round, season: r.season, ...finishBucket(r.bucket) })),
    byLeague: [...byLeague.entries()].map(([league, bkt]) => ({ league, ...finishBucket(bkt) }))
      .sort((a, b) => b.evaluated - a.evaluated),
    perRadar: Object.values(RADAR_IDS).map((id) => ({
      id,
      name: RADAR_META[id].name,
      direction: { ...perRadar[id].direction, rate: pct(perRadar[id].direction.hit, perRadar[id].direction.total), confidence: sampleConfidence(perRadar[id].direction.total) },
      surpriseSignal: { ...perRadar[id].surpriseSignal, rate: pct(perRadar[id].surpriseSignal.caught, perRadar[id].surpriseSignal.total), confidence: sampleConfidence(perRadar[id].surpriseSignal.total) },
    })),

    // ---- KRİTER KARNESİ: her şeyin başarısı, lig kırılımlı -----------------
    criteria: {
      note: signalAgg.size === 0 && strengthRule.evaluated === 0
        ? 'Kriter karnesi için henüz sonuçlanmış mühürlü hafta yok — maçlar sonuçlandıkça sinyal ve kural başarıları burada lig lig birikecek.'
        : 'Küçük örneklemli satırlar kanıt değildir — her hücrede n ve güven etiketi verilir; lig bazlı ince ayar için önce yeterli örneklem birikmelidir.',
      // Radar × lig: "xG hangi liglerde işliyor?"
      perRadarByLeague: [...perRadarLeague.values()]
        .map((r) => ({ id: r.id, name: RADAR_META[r.id]?.name || r.id, league: r.league, total: r.total, hit: r.hit, rate: pct(r.hit, r.total), confidence: sampleConfidence(r.total) }))
        .sort((a, b) => b.total - a.total),
      // Maç tipine göre Master başarı (altın kural boyutu): denk / ev güçlü /
      // dep güçlü maçlarda ana tahmin ne kadar tutuyor?
      masterByBalance: {
        homeStrong: { label: 'Ev güçlü maçlar', ...finishBucket(byBalance.homeStrong) },
        awayStrong: { label: 'Deplasman güçlü maçlar', ...finishBucket(byBalance.awayStrong) },
        even: { label: 'Denk maçlar', ...finishBucket(byBalance.even) },
      },
      // Sinyal × lig × rakip sınıfı: "form hangi ligde ve HANGİ SEVİYE rakibe
      // karşı tutuyor?" — iki boyut birlikte.
      signals: [...signalAgg.values()]
        .map((s) => ({
          key: s.key, label: s.label, radarId: s.radarId,
          overall: { total: s.overall.total, hit: s.overall.hit, rate: pct(s.overall.hit, s.overall.total), confidence: sampleConfidence(s.overall.total) },
          byLeague: [...s.leagues.entries()]
            .map(([league, b]) => ({ league, total: b.total, hit: b.hit, rate: pct(b.hit, b.total), confidence: sampleConfidence(b.total) }))
            .sort((a, b) => b.total - a.total),
          byOpponentTier: Object.fromEntries(Object.entries(s.tiers).map(([k, b]) => [k, {
            label: k === 'strong' ? 'güçlü rakibe' : k === 'even' ? 'denk rakibe' : 'zayıf rakibe',
            total: b.total, hit: b.hit, rate: pct(b.hit, b.total), confidence: sampleConfidence(b.total),
          }])),
        }))
        .sort((a, b) => b.overall.total - a.overall.total),
      // OYNANMA KAÇIŞI sinyalinin ileri-test karnesi: "açılış favorisi ≥10 puan
      // kaybetti" mühürlendiğinde maç favori DIŞI mı bitti? (catchRate)
      playedMovement: {
        label: 'Oynanma kaçışı (açılış favorisi ≥10 puan düştü)',
        total: playedMoveAgg.total,
        favoriteFailed: playedMoveAgg.favoriteFailed,
        catchRate: pct(playedMoveAgg.favoriteFailed, playedMoveAgg.total),
        results: playedMoveAgg.results,
        confidence: sampleConfidence(playedMoveAgg.total),
      },
      // Güç dengesi kuralının ileri-test doğrulaması (fark ≥ 10 puan bandı).
      strengthRule: {
        label: 'Güç dengesi kuralı (gerçek puan farkı ≥ 10 → güçlü/zayıf, altı denk)',
        evaluated: strengthRule.evaluated,
        tiers: Object.fromEntries(Object.entries(strengthRule.tiers).map(([k, d]) => [k, {
          label: k === 'homeStrong' ? '"Ev güçlü" dendi' : k === 'awayStrong' ? '"Deplasman güçlü" dendi' : '"Denk" dendi',
          total: d.total, results: d.results,
          expectedSide: SB_EXPECT[k] || null,
          expectedHit: SB_EXPECT[k] ? d.expectedHit : null,
          expectedRate: SB_EXPECT[k] ? pct(d.expectedHit, d.total) : null,
          drawRate: pct(d.results.X, d.total),
          confidence: sampleConfidence(d.total),
        }])),
        byLeague: [...strengthRule.leagues.entries()].map(([league, tiers]) => ({
          league,
          homeStrong: { total: tiers.homeStrong.total, expectedHit: tiers.homeStrong.expectedHit, rate: pct(tiers.homeStrong.expectedHit, tiers.homeStrong.total) },
          awayStrong: { total: tiers.awayStrong.total, expectedHit: tiers.awayStrong.expectedHit, rate: pct(tiers.awayStrong.expectedHit, tiers.awayStrong.total) },
          even: { total: tiers.even.total, results: tiers.even.results },
        })).sort((a, b) => (b.homeStrong.total + b.awayStrong.total + b.even.total) - (a.homeStrong.total + a.awayStrong.total + a.even.total)),
      },
    },
  };
}
