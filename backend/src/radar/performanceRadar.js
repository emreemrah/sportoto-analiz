// RADAR 1 — PERFORMANS RADARI
// Takımların GERÇEK sportif gücü: form (rakip gücü ayarlı), iç saha/deplasman
// performansı, lig sırası/puan farkı, maç başı puan, G/B/M oranları, gol,
// şut (varsa), güçlü rakiplere karşı performans, sezon-son dönem değişimi.
// Eksik oyuncu/fikstür yoğunluğu için gerçek kaynak YOK → missingSignals'ta
// dürüstçe raporlanır, uydurulmaz. Her sinyalde kaynak + gözlem zamanı vardır.
import { RADAR_IDS, RADAR_META, SIGNAL_FAMILIES as F } from './config.js';
import { OPP_THRESHOLDS } from '../analysis/opponentStrength.js';
import { aggregateSignals, sidesToScores } from './signalFamilies.js';
import { qualityFromParts } from './dataQuality.js';
import {
  formQuality, venuePpg, venueWinRate, positionByName, num, clamp, round1,
  radarOutput, favoriteOfScores, directionOf,
} from './util.js';

const SRC = 'FootyStats (maç-öncesi istatistik)';

// last5detail + lig tablosu → rakip gücüne göre ayarlanmış form (0..1) + kırılım.
// TEK KURAL (kullanıcı kararı, v1.3): güçlü/denk/zayıf HER YERDE GERÇEK PUAN
// FARKIYLA belirlenir — fark = (rakip ppg − kendi ppg) × ortalama oynanan maç;
// |fark| ≥ 12 puan (4 galibiyet) → güçlü/zayıf, altı denk (karne/güç dengesiyle
// aynı eşik: OPP_THRESHOLDS.classPointsGap). Sıra farkı KULLANILMAZ çünkü
// büyüklük ölçmez (sıkışık tabloda 14 sıra 6 puan olabilir = aslında denk).
// Kendi ya da rakibin verisi bilinmiyorsa sınıf UYDURULMAZ → unknown.
function opponentAdjustedForm(detail, leagueTable, ownPpg = null, ownPlayed = null) {
  if (!Array.isArray(detail) || !detail.length) return null;
  let wSum = 0, pSum = 0, known = 0;
  const mk = () => ({ p: 0, w: 0, d: 0, l: 0 });
  // ALTIN KURAL kırılımı: son maçların HER seviye için ayrı G/B/M dökümü
  // (yalnız "ayarlı endeks" değil — kullanıcı kime karşı ne yapıldığını görür).
  const tiers = { strong: mk(), even: mk(), weak: mk(), unknown: mk() };
  const tally = (t, res) => { t.p += 1; if (res === 'G') t.w += 1; else if (res === 'B') t.d += 1; else t.l += 1; };
  for (const g of detail) {
    const res = g.result === 'G' ? 1 : g.result === 'B' ? 0.5 : 0;
    const opp = positionByName(leagueTable, g.oppName, g.oppLogo); // logo kimliğiyle kesin eşleşme
    let w = 1;
    if (opp && opp.ppg != null && ownPpg != null) {
      known += 1;
      const avgPlayed = ((ownPlayed || opp.played || 0) + (opp.played || ownPlayed || 0)) / 2;
      const gap = (opp.ppg - ownPpg) * avgPlayed;                    // + → rakip bizden güçlü (puan)
      const tier = gap >= OPP_THRESHOLDS.classPointsGap ? 'strong'
        : gap <= -OPP_THRESHOLDS.classPointsGap ? 'weak' : 'even';
      w = tier === 'strong' ? 1.3 : tier === 'even' ? 1.0 : 0.7;     // güçlü rakibe karşı sonuç daha değerli
      tally(tiers[tier], g.result);
    } else {
      tally(tiers.unknown, g.result);
    }
    wSum += w;
    pSum += res * w;
  }
  if (!wSum) return null;
  return {
    adjusted: pSum / wSum, knownOpponents: known, total: detail.length,
    tiers,
    vsStrong: tiers.strong.p ? tiers.strong : null,
  };
}

// Seviye kırılımını insan diline çevirir: "güçlü rakiple 2 maç 2G 0B 0M · denk
// rakiple 1 maç 0G 1B 0M · …" (0 maçlık seviyeler yazılmaz — gürültü olmaz).
function tierBreakdownText(tiers) {
  if (!tiers) return null;
  const seg = [];
  for (const [k, lbl] of [['strong', 'güçlü rakiple'], ['even', 'denk rakiple'], ['weak', 'zayıf rakiple'], ['unknown', 'seviyesi bilinmeyenle']]) {
    const t = tiers[k];
    if (t && t.p > 0) seg.push(`${lbl} ${t.p} maç ${t.w}G ${t.d}B ${t.l}M`);
  }
  return seg.length ? seg.join(' · ') : null;
}

export function computePerformanceRadar(m, { observedAt } = {}) {
  const meta = RADAR_META[RADAR_IDS.PERFORMANCE];
  const h = m?.stats?.home || null;
  const a = m?.stats?.away || null;

  const missing = [];
  // availability: 'match_missing' (kaynak destekler, bu maçta yok) |
  //               'unsupported' (kaynakta yapısal olarak YOK — veri yeterliliği
  //               paydasına girmez, maç kartında tekrar tekrar gösterilmez).
  const noSource = (key, label, reason, availability = 'match_missing') =>
    missing.push({ key, label, reason, availability });

  if (!h?.standing && !a?.standing && !h?.last5?.length && !a?.last5?.length) {
    return radarOutput({
      id: RADAR_IDS.PERFORMANCE, name: meta.name, version: meta.version,
      hasData: false, status: 'insufficient', dataQuality: 0,
      missingSignals: [{ key: 'stats', label: 'Takım istatistikleri', reason: m?.coverage?.reason || 'Bu maç için performans verisi eşleşmedi.' }],
      note: 'Veri eşleşmediği için performans radarı bu maçta devre dışı.',
    });
  }

  const signals = [];
  const positives = [];
  const negatives = [];
  const add = (key, family, label, side, weight, note) => {
    signals.push({ key, family, label, side, weight, note: note || null, source: SRC, observedAt: observedAt || null });
  };

  const hs = h?.standing, as = a?.standing;
  // YENİ LİG KORUMASI: lig tablosunun anlamlı olması için asgari oynanan maç.
  // Altındaysa puan/sıra "denk" sayılıp beraberliğe (X) çevrilmez.
  const MIN_TABLE_PLAYED = 4;
  const playedOf = (st) => (st ? (num(st.played) ?? ((st.wins || 0) + (st.draws || 0) + (st.losses || 0))) : 0);
  const hPlayed = playedOf(hs), aPlayed = playedOf(as);

  // ALTIN KURAL girdileri erkenden: rakip gücü ayarlı form + saha profilleri
  // (güçlü/denk/zayıf kırılımı) her kriter cümlesinde kullanılabilsin.
  const hAdj = opponentAdjustedForm(h?.last5detail, m?.stats?.leagueTable, hPlayed >= 3 ? num(hs?.ppg) : null, hPlayed);
  const aAdj = opponentAdjustedForm(a?.last5detail, m?.stats?.leagueTable, aPlayed >= 3 ? num(as?.ppg) : null, aPlayed);
  const hVP = h?.venueProfile, aVP = a?.venueProfile;
  // Saha karnesinin seviye kırılımlı puan/maç özeti: "(puan/maç: güçlüye 1.5 · denke 2.0 · zayıfa 3.0)"
  const tierPpgTxt = (vp) => {
    if (!vp?.byTier) return '';
    const seg = [];
    for (const [k, lbl] of [['strong', 'güçlüye'], ['even', 'denke'], ['weak', 'zayıfa']]) {
      const t = vp.byTier[k];
      if (t && t.p >= 2 && t.ppg != null) seg.push(`${lbl} ${t.ppg}`);
    }
    return seg.length ? ` — puan/maç: ${seg.join(' · ')}` : '';
  };

  // 1) Genel form (son 5) — aile: FORM. ALTIN KURAL: form HÜKMÜ her maçta
  //    yazılır (DENK dahil — "birinde var birinde yok" olmaz) ve ham dizinin
  //    yanında rakip gücü ayarlı karşılaştırma da verilir (kime karşı yapıldı).
  const hf = formQuality(h?.last5), af = formQuality(a?.last5);
  let formLine = 'Son 5 form verisi yok.';
  if (hf != null && af != null) {
    const d = hf - af;
    // İNSAN DİLİ: soyut "ayarlı endeks" yerine, iki takımın son 5'inin (iç+dış)
    // toplam G/B/M'si + HANGİ SEVİYEDEN rakiplere karşı olduğu açıkça yazılır.
    const gbmOf = (arr) => {
      const r = { w: 0, d: 0, l: 0 };
      for (const x of arr) { if (x === 'G') r.w += 1; else if (x === 'B') r.d += 1; else r.l += 1; }
      return `${r.w}G ${r.d}B ${r.l}M`;
    };
    const hBrk = tierBreakdownText(hAdj?.tiers);
    const aBrk = tierBreakdownText(aAdj?.tiers);
    const evTxt = `Ev ${gbmOf(h.last5)}${hBrk ? ` (${hBrk})` : ''}`;
    const depTxt = `Dep ${gbmOf(a.last5)}${aBrk ? ` (${aBrk})` : ''}`;
    if (Math.abs(d) >= 0.15) {
      add('formGeneral', F.FORM, 'Son 5 maç formu', d > 0 ? 'home' : 'away', Math.min(10, Math.abs(d) * 20),
        `Ev ${h.last5.join('')} · Dep ${a.last5.join('')}`);
      formLine = `Son 5 form (iç+dış) ${d > 0 ? 'ev sahibi' : 'deplasman'} lehine — ${evTxt} · ${depTxt}.`;
      (d > 0 ? positives : negatives).push(formLine);
    } else {
      // Fark küçük → hüküm DENK; sinyal üretilmez ama kartta AÇIKÇA söylenir.
      formLine = `Son 5 form (iç+dış): iki takım DENK — ${evTxt} · ${depTxt}.`;
    }
  } else noSource('formGeneral', 'Son 5 maç formu', 'Son 5 verisi yok.');

  // 2) Rakip gücüne göre ayarlanmış form — aile: FORM (aynı ailede, azalan katkı)
  if (hAdj && aAdj && (hAdj.knownOpponents + aAdj.knownOpponents) >= 4) {
    const d = hAdj.adjusted - aAdj.adjusted;
    if (Math.abs(d) >= 0.12) {
      add('formOpponentAdjusted', F.FORM, 'Rakip gücü ayarlı form', d > 0 ? 'home' : 'away', Math.min(9, Math.abs(d) * 18),
        `Ayarlı form ${round1(hAdj.adjusted * 100)} vs ${round1(aAdj.adjusted * 100)}`);
    }
    // SONUÇ AÇIK YAZILIR (yalnız "kaç maç" değil): G=galibiyet B=beraberlik M=mağlubiyet.
    if (hAdj.vsStrong && hAdj.vsStrong.p >= 2 && hAdj.vsStrong.w / hAdj.vsStrong.p >= 0.5) {
      positives.push(`Ev sahibi son dönemde güçlü rakiplerle ${hAdj.vsStrong.p} maç oynadı: ${hAdj.vsStrong.w}G ${hAdj.vsStrong.d}B ${hAdj.vsStrong.l}M.`);
    }
    if (aAdj.vsStrong && aAdj.vsStrong.p >= 2 && (aAdj.vsStrong.w + aAdj.vsStrong.d) / aAdj.vsStrong.p >= 0.5) {
      negatives.push(`Deplasman güçlü rakiplere karşı dirençli — ${aAdj.vsStrong.p} maçta ${aAdj.vsStrong.w}G ${aAdj.vsStrong.d}B ${aAdj.vsStrong.l}M.`);
    }
  } else if (!h?.last5detail?.length && !a?.last5detail?.length) {
    noSource('formOpponentAdjusted', 'Rakip gücü ayarlı form', 'Son maç detayları (rakip bilgisi) yok.');
  }

  // 3) İç saha performansı — aile: VENUE
  const hVppg = venuePpg(hs?.home);
  if (hVppg != null) {
    if (hVppg >= 2.0) { add('homeVenue', F.VENUE, 'Ev sahibi iç sahada güçlü', 'home', 8, `İç saha ${round1(hVppg)} puan/maç`); positives.push(`Ev sahibi iç sahada maç başı ${round1(hVppg)} puan alıyor${tierPpgTxt(hVP)}.`); }
    else if (hVppg <= 0.9) { add('homeVenueWeak', F.VENUE, 'Ev sahibi iç sahada zayıf', 'away', 6, `İç saha ${round1(hVppg)} puan/maç`); negatives.push(`Ev sahibi iç sahada zayıf (${round1(hVppg)} puan/maç${tierPpgTxt(hVP)}).`); }
  } else noSource('homeVenue', 'İç saha performansı', 'İç saha kırılımı yok.');

  // 4) Deplasman performansı — aile: VENUE
  const aVppg = venuePpg(as?.away);
  const aWr = venueWinRate(as?.away);
  if (aVppg != null) {
    if (aVppg >= 1.7) { add('awayVenue', F.VENUE, 'Deplasman dış sahada güçlü', 'away', 8, `Dış saha ${round1(aVppg)} puan/maç`); negatives.push(`Deplasman dış sahada güçlü (${round1(aVppg)} puan/maç${tierPpgTxt(aVP)}) — ev favorisi için risk.`); }
    else if (aVppg <= 0.7) { add('awayVenueWeak', F.VENUE, 'Deplasman dış sahada çok zayıf', 'home', 7, `Dış saha ${round1(aVppg)} puan/maç`); positives.push(`Deplasman dış sahada çok zayıf (${round1(aVppg)} puan/maç${tierPpgTxt(aVP)}).`); }
    // Dış saha "beraberliğe yatkın" ancak YETERLİ dış saha maçı varsa (≥3);
    // yeni ligde 1 maçtan %100 beraberlik gibi sahte eğilim çıkarılmaz.
    const aAwayGames = (as?.away?.wins || 0) + (as?.away?.draws || 0) + (as?.away?.losses || 0);
    const aDr = aAwayGames >= 3 ? ((as.away.draws || 0) / aAwayGames) : null;
    if (aDr != null && aDr >= 0.4) add('awayDrawish', F.VENUE, 'Deplasman dışarıda beraberliğe yatkın', 'draw', 5, `Dış saha beraberlik %${Math.round(aDr * 100)}`);
  } else noSource('awayVenue', 'Deplasman performansı', 'Dış saha kırılımı yok.');

  // 5) Lig sırası + puan farkı — aile: TABLE
  // Puan tablosu yalnız İKİ takım da yeterince maç oynadıysa kullanılır. Yeni
  // ligde herkes 0 puanla "denk" görünür → BU SİNYAL ÜRETİLMEZ (kesin X çıkmaz).
  if (hs?.position != null && as?.position != null && hs?.points != null && as?.points != null
      && hPlayed >= MIN_TABLE_PLAYED && aPlayed >= MIN_TABLE_PLAYED) {
    const posDiff = as.position - hs.position;             // + → ev üstte
    const ptsDiff = hs.points - as.points;
    if (Math.abs(ptsDiff) >= 15) {
      add('pointsGap', F.TABLE, 'Puan farkı belirgin (≥15)', ptsDiff > 0 ? 'home' : 'away', 9, `${hs.points} vs ${as.points} puan (sıra ${hs.position}. / ${as.position}.)`);
      (ptsDiff > 0 ? positives : negatives).push(`Puan tablosunda ${Math.abs(ptsDiff)} puanlık fark ${ptsDiff > 0 ? 'ev sahibi' : 'deplasman'} lehine.`);
    } else if (Math.abs(ptsDiff) >= 9) {
      add('pointsGapLight', F.TABLE, 'Puan farkı hafif (9-14)', ptsDiff > 0 ? 'home' : 'away', 5, `${hs.points} vs ${as.points} puan`);
    } else if (Math.abs(posDiff) <= 3 && Math.abs(ptsDiff) <= 5) {
      add('tableClose', F.TABLE, 'Sıralar/puanlar çok yakın', 'draw', 5, `Sıra ${hs.position}. vs ${as.position}.`);
      negatives.push('İki takım puan tablosunda denk — beraberlik ihtimali masada.');
    }
  } else if (hs?.position != null && as?.position != null && (hPlayed < MIN_TABLE_PLAYED || aPlayed < MIN_TABLE_PLAYED)) {
    noSource('table', 'Lig sırası / puan farkı', `Lig yeni başladı (oynanan maç ${Math.min(hPlayed, aPlayed)}) — puan tablosu henüz anlamlı değil.`);
  } else noSource('table', 'Lig sırası / puan farkı', 'Puan tablosu verisi yok.');

  // 6) Maç başı puan (ppg) — aile: TABLE (azalan katkı ile)
  const hPpg = num(hs?.ppg) ?? num(h?.season?.recentPpg);
  const aPpg = num(as?.ppg) ?? num(a?.season?.recentPpg);
  if (hPpg != null && aPpg != null && Math.abs(hPpg - aPpg) >= 0.35) {
    add('ppg', F.TABLE, 'Maç başı puan farkı', hPpg > aPpg ? 'home' : 'away', 4, `${round1(hPpg)} vs ${round1(aPpg)}`);
  }

  // 7) Gol atma/yeme — aile: GOALS_XG
  const hAtt = num(h?.season?.goalsPerGame), aAtt = num(a?.season?.goalsPerGame);
  const hDef = num(h?.season?.concededPerGame), aDef = num(a?.season?.concededPerGame);
  if (hAtt != null && aAtt != null && hDef != null && aDef != null) {
    const hNet = hAtt - hDef, aNet = aAtt - aDef;
    const d = hNet - aNet;
    if (Math.abs(d) >= 0.5) {
      add('goalBalance', F.GOALS_XG, 'Gol dengesi (atılan-yediği)', d > 0 ? 'home' : 'away', Math.min(8, Math.abs(d) * 6),
        `Ev ${round1(hNet)} · Dep ${round1(aNet)} net gol/maç`);
    }
    // "İki taraf da az gol atıyor → beraberlik" yalnız yeterli maç varsa (yeni
    // ligde sezon golü henüz anlamlı değil, sahte X üretmesin).
    if (hPlayed >= MIN_TABLE_PLAYED && aPlayed >= MIN_TABLE_PLAYED && hAtt <= 1.0 && aAtt <= 1.0) add('lowScoring', F.GOALS_XG, 'İki taraf da az gol atıyor', 'draw', 4, `${round1(hAtt)} ve ${round1(aAtt)} gol/maç`);
  } else noSource('goals', 'Gol istatistikleri', 'Sezon gol verisi yok.');

  // 8) Şut / isabetli şut — aile: GOALS_XG (varsa)
  const hSot = num(h?.season?.avg?.shotsOnTarget), aSot = num(a?.season?.avg?.shotsOnTarget);
  if (hSot != null && aSot != null) {
    const d = hSot - aSot;
    if (Math.abs(d) >= 1.2) add('shotsOnTarget', F.GOALS_XG, 'İsabetli şut üstünlüğü', d > 0 ? 'home' : 'away', 3, `${round1(hSot)} vs ${round1(aSot)} isabetli şut/maç`);
  } else noSource('shots', 'Şut verileri', 'Şut istatistiği bu kaynakta yok.');

  // 9) Sezon geneli ↔ son dönem değişimi — aile: FORM
  const trendOf = (t) => {
    const season = t?.standing ? (t.standing.wins + 0.5 * t.standing.draws) / Math.max(1, t.standing.played ?? (t.standing.wins + t.standing.draws + t.standing.losses)) : null;
    const recent = formQuality(t?.last5);
    return season != null && recent != null ? recent - season : null;
  };
  const hTr = trendOf(h), aTr = trendOf(a);
  if (hTr != null && hTr <= -0.25) { add('homeFormDrop', F.FORM, 'Ev sahibinde form düşüşü', 'away', 4, 'Son 5, sezon ortalamasının belirgin altında'); negatives.push('Ev sahibinin son dönemi sezon ortalamasının altında.'); }
  if (aTr != null && aTr >= 0.25) { add('awayFormRise', F.FORM, 'Deplasmanda form yükselişi', 'away', 4, 'Son 5, sezon ortalamasının belirgin üstünde'); negatives.push('Deplasman yükselen formda.'); }
  if (hTr != null && hTr >= 0.25) { add('homeFormRise', F.FORM, 'Ev sahibinde form yükselişi', 'home', 4, null); positives.push('Ev sahibi yükselen formda.'); }

  // 10) RAKİP SEVİYESİ & SAHA PROFİLİ — "kazandı ama KİMİ yendi?" (aile: VENUE/FORM)
  if (hVP || aVP) {
    const qKey = (vp) => vp?.qualityLabel?.key || null;
    // Kalite etiketi farkı: bir taraf Kaliteli, diğeri Şişirilmiş → sinyal.
    if (qKey(hVP) === 'quality' && (qKey(aVP) === 'inflated' || qKey(aVP) === 'untested')) {
      add('venueQualityGap', F.FORM, 'Form kalitesi farkı (rakip seviyesi)', 'home', 7,
        `Ev: ${hVP.qualityLabel.label} · Dep: ${aVP?.qualityLabel?.label || '—'}`);
      positives.push(`Ev sahibinin iç saha formu kaliteli rakiplere karşı; ${aVP?.qualityLabel?.reason || 'deplasman formu seviye testinden geçmedi.'}`);
    } else if (qKey(aVP) === 'quality' && (qKey(hVP) === 'inflated' || qKey(hVP) === 'untested')) {
      add('venueQualityGap', F.FORM, 'Form kalitesi farkı (rakip seviyesi)', 'away', 7,
        `Dep: ${aVP.qualityLabel.label} · Ev: ${hVP?.qualityLabel?.label || '—'}`);
      negatives.push(`Deplasman formu yüksek kalitede: ${aVP.qualityLabel.reason}`);
    }
    // Şişirilmiş form uyarısı (tek taraf): "5/5 kazandı" yanılgısını düzeltir.
    // Şişirilmiş form uyarısında rakip kırılımı + SONUÇ birlikte verilir; maç
    // maç sonuçlu tam döküm zaten narrative cümlesinde (aşağıda) yer alır.
    const tierMix = (t) => `${t.weak ?? 0} zayıf / ${t.even ?? 0} denk / ${t.strong ?? 0} güçlü`;
    if (qKey(aVP) === 'inflated') {
      const t = aVP.last5TierCounts || {};
      positives.push(`Deplasmanın son ${aVP.last5?.p ?? 5} dış saha maçındaki ${aVP.last5?.w ?? '?'} galibiyet zayıf rakip ağırlıklı (${tierMix(t)}) — form olduğundan güçlü görünebilir.`);
      add('awayInflatedForm', F.FORM, 'Deplasman formu zayıf rakiplere dayalı', 'home', 5, aVP.qualityLabel.reason);
    }
    if (qKey(hVP) === 'inflated') {
      const t = hVP.last5TierCounts || {};
      negatives.push(`Ev sahibinin son ${hVP.last5?.p ?? 5} iç saha maçındaki ${hVP.last5?.w ?? '?'} galibiyet zayıf rakip ağırlıklı (${tierMix(t)}).`);
      add('homeInflatedForm', F.FORM, 'Ev sahibi formu zayıf rakiplere dayalı', 'away', 5, hVP.qualityLabel.reason);
    }
    // Bu haftaki rakip seviyesine karşı geçmiş başarı (aile: VENUE — azalan katkı).
    const tierSig = (vp, sideKey, sideTxt) => {
      const rec = vp?.vsCurrentTier;
      if (!rec || rec.p < 3 || vp.currentOpponentTier === 'unknown') return;
      if (rec.ppg != null && rec.ppg >= 2.0) {
        add(`${sideKey}VsTier`, F.VENUE, `${sideTxt} bu seviyedeki rakiplere karşı güçlü`, sideKey === 'home' ? 'home' : 'away', 5,
          `${vp.currentOpponentLabel} sınıfına karşı ${rec.w}G ${rec.d}B ${rec.l}M (${rec.ppg} puan/maç)`);
      } else if (rec.ppg != null && rec.ppg <= 0.8) {
        add(`${sideKey}VsTierWeak`, F.VENUE, `${sideTxt} bu seviyedeki rakiplere karşı zorlanıyor`, sideKey === 'home' ? 'away' : 'home', 5,
          `${vp.currentOpponentLabel} sınıfına karşı ${rec.w}G ${rec.d}B ${rec.l}M`);
      }
    };
    tierSig(hVP, 'home', 'Ev sahibi');
    tierSig(aVP, 'away', 'Deplasman');
    if (qKey(hVP) === 'strong_struggle') negatives.push(`Ev sahibi: ${hVP.qualityLabel.reason}`);
    if (qKey(aVP) === 'strong_struggle') positives.push(`Deplasman: ${aVP.qualityLabel.reason}`);
    // Sonuç-zengin saha karnesi cümleleri EN BAŞA alınır: kartta ilk görünen
    // açıklama "kaç maç, kime karşı, SONUÇ ne" bilgisini taşımalı.
    if (hVP?.narrative && !positives.includes(hVP.narrative)) positives.unshift(hVP.narrative);
    if (aVP?.narrative && !negatives.includes(aVP.narrative)) negatives.unshift(aVP.narrative);
  } else {
    noSource('venueProfile', 'Rakip seviyesi & saha profili', 'Sezon maç detayı bu maçta eşleşmedi.');
  }

  // 11) ALTIN KURAL — BU MAÇIN GÜÇ DENGESİ: "bu iki takım birbirine denk mi,
  //     hangisi güçlü hangisi zayıf?" sorusu her kartta AÇIKÇA cevaplanır.
  //     Kaynak: point-in-time güç (lig sırası + yüzdelik) — uydurma yok; puan
  //     tablosu sinyalleriyle çifte sayım olmasın diye ayrıca ağırlık VERMEZ.
  let strengthBalance = null;
  let strengthLine = null;
  {
    const hStr = hVP?.ownStrength, aStr = hVP?.opponentStrength; // ev & dep güçleri (aynı ligden)
    const tier = hVP?.currentOpponentTier;                       // deplasmanın ev'e göre sınıfı
    if (hStr && aStr && tier && tier !== 'unknown') {
      // Sınıfın NEDENİ görünür: puan/maç + GERÇEK puan farkı yazılır
      // (kural: fark ≥ 10 puan → sınıf farkı; altı denk).
      const gapPts = Math.round((aStr.ppg - hStr.ppg) * (((hStr.played || 0) + (aStr.played || 0)) / 2));
      const rankTxt = `lig sırası: ev ${hStr.rank}./${hStr.teamCount} · dep ${aStr.rank}./${aStr.teamCount} · puan/maç: ${round1(hStr.ppg)} vs ${round1(aStr.ppg)} · fark ≈ ${Math.abs(gapPts)} puan`;
      const line = tier === 'even'
        ? `Güç dengesi: iki takım birbirine DENK (${rankTxt}).`
        : tier === 'weak'
          ? `Güç dengesi: ev sahibi kağıt üstünde GÜÇLÜ taraf, deplasman ZAYIF (${rankTxt}).`
          : `Güç dengesi: deplasman kağıt üstünde GÜÇLÜ taraf, ev sahibi ZAYIF (${rankTxt}).`;
      positives.unshift(line);                                   // her kartın İLK cümlesi
      strengthLine = line;
      strengthBalance = {
        tier,                                                    // dep'in ev'e göre sınıfı: strong|even|weak
        label: tier === 'even' ? 'Denk' : tier === 'weak' ? 'Ev güçlü' : 'Deplasman güçlü',
        homeRank: hStr.rank, awayRank: aStr.rank, teamCount: hStr.teamCount,
        homePpg: round1(hStr.ppg), awayPpg: round1(aStr.ppg),
        pointsGap: gapPts,                                        // + → deplasman güçlü (gerçek puan farkı)
      };
    } else if (hVP || aVP) {
      noSource('strengthBalance', 'Güç dengesi', 'İki takımın güç kıyası için yeterli lig verisi yok (yeni sezon olabilir).');
    }
  }

  // Gerçek kaynağı OLMAYANLAR — uydurulmaz; 'unsupported': kaynak paketinde
  // yapısal olarak yok → veri yeterliliğini DÜŞÜRMEZ, kartta tekrar gösterilmez,
  // metodolojide bir kez açıklanır.
  noSource('missingPlayers', 'Eksik/cezalı oyuncular', 'Gerçek kadro/sakatlık kaynağı bağlı değil.', 'unsupported');
  noSource('fixtureCongestion', 'Dinlenme süresi / fikstür yoğunluğu', 'Fikstür yoğunluğu verisi bu kaynakta yok.', 'unsupported');

  const { sides, applied, families } = aggregateSignals(signals);
  const scores = sidesToScores(sides);
  const fav = favoriteOfScores(scores);

  // Favori kazanamama riski: fark küçüklüğü + karşı yön sinyalleri.
  let failureRisk = null;
  if (scores && fav) {
    const opposite = fav.symbol === '1' ? scores.away : fav.symbol === '2' ? scores.home : Math.max(scores.home, scores.away);
    failureRisk = clamp(Math.round(100 - fav.percent + opposite * 0.35 + scores.draw * 0.25), 0, 100);
  }

  const dq = qualityFromParts([
    { ok: !!(hs && as), weight: 25 },
    { ok: hf != null && af != null, weight: 20 },
    { ok: !!(h?.last5detail?.length && a?.last5detail?.length), weight: 10 },
    { ok: hVppg != null && aVppg != null, weight: 20 },
    { ok: hAtt != null && aAtt != null, weight: 15 },
    { ok: hSot != null && aSot != null, weight: 10 },
  ]);

  const dir = directionOf(scores, fav?.symbol);
  return radarOutput({
    id: RADAR_IDS.PERFORMANCE, name: meta.name, version: meta.version,
    hasData: !!scores, status: scores ? 'ok' : 'insufficient', dataQuality: dq,
    scores, favoriteFailureRisk: failureRisk,
    direction: dir.direction, surpriseDirection: dir.surpriseDirection,
    activeSignals: applied, missingSignals: missing,
    positives, negatives, families,
    sources: [{ name: SRC, observedAt: observedAt || null }],
    details: {
      awayWinRate: aWr != null ? round1(aWr * 100) : null,
      // ALTIN KURAL başlığı: bu maçta kim güçlü/zayıf, denk mi (kart + detay için).
      strengthBalance,
      // KARTIN ÇEKİRDEK SATIRLARI — her maçta AYNI 4 yapı ("birinde var birinde
      // yok" tutarsızlığı olmaz): 1 güç dengesi · 2 ev karnesi · 3 dep karnesi ·
      // 4 son-5 form hükmü (DENK dahil). Veri yoksa dürüstçe "verisi yok" yazılır.
      coreLines: [
        strengthLine ?? 'Güç dengesi: iki takımın güç kıyası için yeterli lig verisi yok (yeni sezon olabilir).',
        hVP?.narrative ?? 'Ev sahibinin iç saha karnesi için yeterli sezon maçı eşleşmedi.',
        aVP?.narrative ?? 'Deplasmanın dış saha karnesi için yeterli sezon maçı eşleşmedi.',
        formLine,
      ],
      // Rakip Gücü ekranı: ev'in EV karnesi + deplasmanın DEPLASMAN karnesi,
      // son 5 rakip seviye dağılımı, kalite etiketi, bu haftaki rakip seviyesi.
      venueQuality: (hVP || aVP) ? { home: hVP ?? null, away: aVP ?? null } : null,
    },
  });
}
