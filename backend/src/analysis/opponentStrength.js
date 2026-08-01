// RAKİP SEVİYESİ & SAHA PERFORMANSI MOTORU — "kazandı ama KİMİ yendi?"
// ---------------------------------------------------------------------------
// * POINT-IN-TIME: her geçmiş rakip, O MAÇ OYNANMADAN ÖNCE bilinen verilerle
//   sınıflandırılır (bugünkü lig sırası geçmişe UYGULANMAZ).
// * Ev sahibi yalnız EV maçlarıyla, deplasman yalnız DEPLASMAN maçlarıyla ölçülür.
// * Lig büyüklüğüne duyarlı YÜZDELİK sistem (sabit "ilk 5" kuralı yok).
// * xG yoksa motor kapanmaz: sonuç/puan/gol ile temel güç sınıfı çalışır.
// * Eşikler sürümlü config'tedir ve testle korunur.
export const OPP_STRENGTH_VERSION = 'opponent-strength-1.3.0';

export const OPP_THRESHOLDS = {
  version: OPP_STRENGTH_VERSION,
  minPlayedForTable: 3,          // takım bu kadar maç oynamadan güç kaydı hesaplanmaz
  // SINIF KURALI (kullanıcı kararı, v1.3): güçlü/denk/zayıf GERÇEK PUAN
  // FARKIYLA belirlenir — en az 4 GALİBİYETLİK fark (4×3 = 12 puan) yoksa iki
  // takım DENK sayılır. Fark, puan/maç × ortalama oynanan maç ile hesaplanır
  // (farklı sayıda maç oynamış takımlar için adil). Sıra farkı KULLANILMAZ:
  // sıkışık tabloda 14 sıra 6 puan olabilir (= denk), kopuk tabloda 3 sıra
  // 13 puan olabilir (= sınıf farkı).
  // Kullanıcı bandı: 10–12 puan arası da sınıf farkı KABUL edilir → alt sınır
  // 10 esas alındı (12 ve üzeri zaten dahil). 10 puan ≈ 3-4 galibiyetlik fark.
  classPointsGap: 10,            // |puan farkı| ≥ 10 → güçlü/zayıf; altı denk
  qualityLabels: {
    minSample: 4,                // etiket için asgari saha maçı
    qualityWinShare: 0.5,        // galibiyetlerin ≥%50'si güçlü/denk → Kaliteli Form
    inflatedWeakShare: 0.7,      // galibiyetlerin ≥%70'i zayıf rakibe → Şişirilmiş Form
    strongStruggleLossShare: 0.6,// güçlü rakip maçlarının ≥%60'ı kayıp → Güçlü Rakip Sorunu
  },
};

const finished = (m) => m.status === 'finished' && m.score && m.score.home != null && m.score.away != null;

// O ANA KADARKİ lig tablosu (yalnız beforeUnix'ten ÖNCE bitmiş maçlar).
export function tableBefore(seasonMatches, beforeUnix) {
  const rows = new Map(); // teamId → {p,w,d,l,gf,ga,pts}
  const touch = (id) => {
    if (!rows.has(id)) rows.set(id, { teamId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    return rows.get(id);
  };
  for (const m of seasonMatches || []) {
    if (!finished(m) || !(m.dateUnix < beforeUnix)) continue;
    const h = touch(m.homeId), a = touch(m.awayId);
    h.p++; a.p++;
    h.gf += m.score.home; h.ga += m.score.away;
    a.gf += m.score.away; a.ga += m.score.home;
    if (m.score.home > m.score.away) { h.w++; a.l++; h.pts += 3; }
    else if (m.score.home < m.score.away) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
  }
  const list = [...rows.values()].map((r) => ({ ...r, ppg: r.p ? r.pts / r.p : 0, gdPg: r.p ? (r.gf - r.ga) / r.p : 0 }));
  list.sort((x, y) => y.ppg - x.ppg || y.gdPg - x.gdPg);
  const n = list.length;
  list.forEach((r, i) => { r.rank = i + 1; r.percentile = n > 1 ? i / (n - 1) : 0.5; }); // 0=lider, 1=sonuncu
  return { teams: list, teamCount: n, byId: new Map(list.map((r) => [r.teamId, r])) };
}

// Maç anındaki güç kaydı (yüzdelik + ppg + gol farkı). Yetersiz maçta null.
export function strengthAt(teamId, seasonMatches, beforeUnix, { minPlayed = OPP_THRESHOLDS.minPlayedForTable } = {}) {
  const t = tableBefore(seasonMatches, beforeUnix);
  const row = t.byId.get(teamId);
  if (!row || row.p < minPlayed) return null;
  return { teamId, percentile: row.percentile, ppg: row.ppg, gdPg: row.gdPg, played: row.p, rank: row.rank, teamCount: t.teamCount };
}

// Rakip sınıfı: GERÇEK PUAN FARKINA göre (v1.3 — kullanıcı kararı).
// Fark = (rakip ppg − kendi ppg) × ortalama oynanan maç → puan cinsinden.
// |fark| ≥ 12 puan (4 galibiyet) → güçlü/zayıf; altı DENK. İki tarafın da
// güç kaydı (≥3 maç) yoksa sınıf UYDURULMAZ → unknown.
export function classifyOpponent(ownStrength, oppStrength, th = OPP_THRESHOLDS) {
  if (!oppStrength || oppStrength.ppg == null || !ownStrength || ownStrength.ppg == null) {
    return { tier: 'unknown', label: 'Seviye bilinmiyor' };
  }
  const avgPlayed = ((ownStrength.played || 0) + (oppStrength.played || 0)) / 2;
  const gap = Math.round((oppStrength.ppg - ownStrength.ppg) * avgPlayed * 10) / 10; // + → rakip bizden güçlü
  if (gap >= th.classPointsGap) return { tier: 'strong', label: 'Güçlü rakip', pointsGap: gap };
  if (gap <= -th.classPointsGap) return { tier: 'weak', label: 'Zayıf rakip', pointsGap: gap };
  return { tier: 'even', label: 'Denk rakip', pointsGap: gap };
}

// ---------------------------------------------------------------------------
// SAHA PROFİLİ — ev takımı için YALNIZ ev, deplasman için YALNIZ deplasman.
// Dönen her maçta: rakip, point-in-time rakip sınıfı, sonuç, skor.
// ---------------------------------------------------------------------------
export function venueProfile(teamId, seasonMatches, {
  venue,                          // 'home' | 'away'
  beforeUnix,                     // yalnız bu andan önce bitmiş maçlar (point-in-time)
  th = OPP_THRESHOLDS,
} = {}) {
  const games = (seasonMatches || [])
    .filter((m) => finished(m) && m.dateUnix < beforeUnix)
    .filter((m) => (venue === 'home' ? m.homeId === teamId : m.awayId === teamId))
    .sort((a, b) => b.dateUnix - a.dateUnix);               // yeni → eski

  const rows = games.map((m) => {
    const oppId = venue === 'home' ? m.awayId : m.homeId;
    const gf = venue === 'home' ? m.score.home : m.score.away;
    const ga = venue === 'home' ? m.score.away : m.score.home;
    // POINT-IN-TIME: sınıflar o maçtan önceki tabloyla — bugünkü sıra DEĞİL.
    const own = strengthAt(teamId, seasonMatches, m.dateUnix, th);
    const opp = strengthAt(oppId, seasonMatches, m.dateUnix, th);
    const cls = classifyOpponent(own, opp, th);
    return {
      oppId, oppName: venue === 'home' ? m.awayName : m.homeName,
      dateUnix: m.dateUnix, gf, ga,
      result: gf > ga ? 'G' : gf < ga ? 'M' : 'B',
      oppTier: cls.tier, oppTierLabel: cls.label,
      cleanSheet: ga === 0, failedToScore: gf === 0,
    };
  });

  const agg = (list) => {
    const r = { p: list.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, fts: 0 };
    for (const g of list) {
      if (g.result === 'G') r.w++; else if (g.result === 'B') r.d++; else r.l++;
      r.gf += g.gf; r.ga += g.ga; if (g.cleanSheet) r.cs++; if (g.failedToScore) r.fts++;
    }
    return {
      ...r,
      ppg: r.p ? Math.round(((r.w * 3 + r.d) / r.p) * 100) / 100 : null,
      gfPg: r.p ? Math.round((r.gf / r.p) * 100) / 100 : null,
      gaPg: r.p ? Math.round((r.ga / r.p) * 100) / 100 : null,
      gd: r.gf - r.ga,
    };
  };

  const byTier = {
    strong: agg(rows.filter((g) => g.oppTier === 'strong')),
    even: agg(rows.filter((g) => g.oppTier === 'even')),
    weak: agg(rows.filter((g) => g.oppTier === 'weak')),
    unknown: agg(rows.filter((g) => g.oppTier === 'unknown')),
  };

  return {
    version: th.version,
    venue,
    games: rows,
    last5: agg(rows.slice(0, 5)),
    last10: agg(rows.slice(0, 10)),
    season: agg(rows),
    byTier,
    last5TierCounts: {
      strong: rows.slice(0, 5).filter((g) => g.oppTier === 'strong').length,
      even: rows.slice(0, 5).filter((g) => g.oppTier === 'even').length,
      weak: rows.slice(0, 5).filter((g) => g.oppTier === 'weak').length,
      unknown: rows.slice(0, 5).filter((g) => g.oppTier === 'unknown').length,
    },
  };
}

// ---------------------------------------------------------------------------
// KALİTE ETİKETİ — garanti/tahmin değil, gerekçeli analiz etiketi.
// ---------------------------------------------------------------------------
export function formQualityLabel(profile, th = OPP_THRESHOLDS) {
  const q = th.qualityLabels;
  const last5 = profile?.games?.slice(0, 5) || [];
  if (last5.length < q.minSample) return { key: 'insufficient', label: 'Seviye Testi Eksik', reason: 'Yeterli saha maçı örneği yok.' };

  const wins = last5.filter((g) => g.result === 'G');
  const knownWins = wins.filter((g) => g.oppTier !== 'unknown');
  const strongGames = last5.filter((g) => g.oppTier === 'strong');
  const strongLosses = strongGames.filter((g) => g.result === 'M');

  if (strongGames.length >= 2 && strongLosses.length / strongGames.length >= q.strongStruggleLossShare) {
    return { key: 'strong_struggle', label: 'Güçlü Rakip Sorunu', reason: `Güçlü rakiplere karşı ${strongLosses.length}/${strongGames.length} mağlubiyet.` };
  }
  if (knownWins.length >= 2) {
    const weakShare = knownWins.filter((g) => g.oppTier === 'weak').length / knownWins.length;
    const qualityShare = knownWins.filter((g) => g.oppTier !== 'weak').length / knownWins.length;
    if (weakShare >= q.inflatedWeakShare) {
      return { key: 'inflated', label: 'Şişirilmiş Form', reason: `Galibiyetlerin ${Math.round(weakShare * 100)}%'i zayıf rakiplere karşı.` };
    }
    if (qualityShare >= q.qualityWinShare) {
      return { key: 'quality', label: 'Kaliteli Form', reason: `Galibiyetlerin ${Math.round(qualityShare * 100)}%'i güçlü/denk rakiplere karşı.` };
    }
  }
  if (!strongGames.length && !last5.some((g) => g.oppTier === 'even')) {
    return { key: 'untested', label: 'Seviye Testi Eksik', reason: 'Son maçlarda güçlü/denk rakip örneği yok.' };
  }
  return { key: 'normal', label: 'Normal Form', reason: 'Rakip dağılımı dengeli.' };
}

// SEZON MAÇ LOGU — kriter filtreleri için kompakt, maç-bazlı geçmiş.
// Her satır: sonuç + skor + saha + MAÇ ANINDAKİ rakip sınıfı (altın kural,
// ID bazlı — ad eşleşmesi yok, bugünün tablosu geçmişe uygulanmaz).
// "Güçlüye karşı galibiyet/temiz kale/KG..." gibi filtreli kriterler bu logdan
// UYDURMASIZ türetilir; kaynak kırılım vermeyen istatistiklere (xG/korner/şut)
// dokunulmaz.
export function teamMatchLog(teamId, seasonMatches, { beforeUnix, th = OPP_THRESHOLDS, cap = 40 } = {}) {
  const games = (seasonMatches || [])
    .filter((mm) => finished(mm) && mm.dateUnix < beforeUnix && (mm.homeId === teamId || mm.awayId === teamId))
    .sort((x, y) => y.dateUnix - x.dateUnix)
    .slice(0, cap);
  return games.map((mm) => {
    const isHome = mm.homeId === teamId;
    const gf = isHome ? mm.score.home : mm.score.away;
    const ga = isHome ? mm.score.away : mm.score.home;
    const oppId = isHome ? mm.awayId : mm.homeId;
    const own = strengthAt(teamId, seasonMatches, mm.dateUnix, th);
    const opp = strengthAt(oppId, seasonMatches, mm.dateUnix, th);
    const cls = classifyOpponent(own, opp, th);
    return {
      result: gf > ga ? 'G' : gf < ga ? 'M' : 'B',
      gf, ga, isHome,
      oppName: isHome ? mm.awayName : mm.homeName,
      oppTier: cls.tier,                                  // strong|even?→mid eşlemesi AŞAĞIDA
      dateUnix: mm.dateUnix,
    };
  }).map((r) => ({ ...r, oppTier: r.oppTier === 'even' ? 'mid' : r.oppTier })); // filtre anahtarlarıyla hizala
}

// REFRESH ENTEGRASYONU — maç istatistiklerine saha profillerini iliştirir.
// Ev sahibi YALNIZ ev, deplasman YALNIZ deplasman maçlarıyla; bu haftaki
// rakip seviyesi de point-in-time güçle sınıflanır.
export function attachVenueProfiles(stats, { seasonMatches, homeId, awayId, beforeUnix, th = OPP_THRESHOLDS }) {
  if (!stats || !seasonMatches?.length || homeId == null || awayId == null || !beforeUnix) return stats;
  const homeProfile = venueProfile(homeId, seasonMatches, { venue: 'home', beforeUnix, th });
  const awayProfile = venueProfile(awayId, seasonMatches, { venue: 'away', beforeUnix, th });
  const homeStr = strengthAt(homeId, seasonMatches, beforeUnix, th);
  const awayStr = strengthAt(awayId, seasonMatches, beforeUnix, th);
  const homeOppCls = classifyOpponent(homeStr, awayStr, th);   // evin rakibi = deplasman
  const awayOppCls = classifyOpponent(awayStr, homeStr, th);   // deplasmanın rakibi = ev

  if (stats.home) {
    stats.home.venueProfile = {
      ...summarizeProfile(homeProfile),
      qualityLabel: formQualityLabel(homeProfile, th),
      narrative: venueNarrative(homeProfile, 'Ev sahibi'),
      currentOpponentTier: homeOppCls.tier,
      currentOpponentLabel: homeOppCls.label,
      vsCurrentTier: homeProfile.byTier[homeOppCls.tier] ?? null,
      ownStrength: homeStr, opponentStrength: awayStr,
      version: th.version,
    };
  }
  if (stats.away) {
    stats.away.venueProfile = {
      ...summarizeProfile(awayProfile),
      qualityLabel: formQualityLabel(awayProfile, th),
      narrative: venueNarrative(awayProfile, 'Deplasman'),
      currentOpponentTier: awayOppCls.tier,
      currentOpponentLabel: awayOppCls.label,
      vsCurrentTier: awayProfile.byTier[awayOppCls.tier] ?? null,
      ownStrength: awayStr, opponentStrength: homeStr,
      version: th.version,
    };
  }
  // Kriter filtreleri için maç-bazlı sezon logu (iki takıma da).
  if (stats.home) stats.home.matchLog = teamMatchLog(homeId, seasonMatches, { beforeUnix, th });
  if (stats.away) stats.away.matchLog = teamMatchLog(awayId, seasonMatches, { beforeUnix, th });
  return stats;
}

// Profil özeti (ham maç listesi yerine ekran/radar için kompakt yapı; ham son 5
// sonuçlar da korunur — "ham formu gizleme" kuralı).
function summarizeProfile(p) {
  return {
    venue: p.venue,
    last5: p.last5, last10: p.last10, season: p.season,
    byTier: p.byTier,
    last5TierCounts: p.last5TierCounts,
    last5Raw: p.games.slice(0, 5).map((g) => ({ opp: g.oppName, tier: g.oppTier, result: g.result, score: `${g.gf}-${g.ga}` })),
  };
}

// Kısa, anlaşılır gerekçe cümlesi. KURAL: yalnız "kaç güçlü rakip" YAZILMAZ —
// o maçların SONUÇLARI da yazılır ("3 güçlü" tek başına bilgi vermez:
// 3 galibiyet mi 3 mağlubiyet mi?). G=galibiyet, B=beraberlik, M=mağlubiyet.
export function venueNarrative(profile, sideLabel) {
  const l5 = profile?.games?.slice(0, 5) || [];
  if (!l5.length) return null;
  const cnt = (list) => {
    const r = { w: 0, d: 0, l: 0 };
    for (const g of list) { if (g.result === 'G') r.w += 1; else if (g.result === 'B') r.d += 1; else r.l += 1; }
    return r;
  };
  const gbm = (r) => `${r.w}G ${r.d}B ${r.l}M`;
  const tot = cnt(l5);
  const TIERS = [
    ['strong', 'güçlü rakiple'],
    ['even', 'denk rakiple'],
    ['weak', 'zayıf rakiple'],
    ['unknown', 'seviyesi bilinmeyenle'],
  ];
  const parts = [];
  for (const [tier, label] of TIERS) {
    const list = l5.filter((g) => g.oppTier === tier);
    if (!list.length) continue;
    parts.push(`${label} ${list.length} maç ${gbm(cnt(list))}`);
  }
  const venueTxt = profile.venue === 'home' ? 'iç saha' : 'dış saha';
  return `${sideLabel} son ${l5.length} ${venueTxt} maçında ${gbm(tot)} aldı — ${parts.join(' · ')}.`;
}
