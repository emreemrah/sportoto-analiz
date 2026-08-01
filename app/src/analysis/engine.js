// KULLANICI SEÇİMLİ ANALİZ MOTORU (userSelectedAnalysisEngine)
// Sabit/hazır analiz YOK. Motor BOŞ başlar: aktif profildeki AÇIK kriterleri okur
// ve SADECE onları çalıştırır. Kapalı/seçilmemiş kriter sonuca, güvene, riske,
// yoruma HİÇ etki etmez. Veri yoksa uydurmaz; kriteri "analiz dışı" bırakır.
//
// Girdi:  m (maç + m.stats), profile (aktif analiz profili)
// Çıktı:  { ok, empty?, message?, matchInfo, usedCriteria[], results[],
//           verdict:{ main, alt, confidence, risk, reason, favor } }
import { CRITERIA_MAP, IMPACT, logFilteredEvalApp } from './criteria.js';
import { X_KEEP_PCT, AWAY_KEEP_PCT, HOME_KEEP_PCT, CLOSE_GAP_PCT, TAG_BASE, TAG_BASE_STRONG, AWAY_TAG_PIVOT } from './thresholds';

const wOf = (impKey) => (IMPACT[impKey] || IMPACT.mid).w;

// ——— KUPON KARAR KATMANI ———
// Seçili kriterlerin puanlarından KUPON kararı üretir: ana eğilim, dar/güvenli
// kupon, hedef stratejisi (12 / 13-14 / 15), risk ve "banko uygunluğu".
// OLASILIK ÜRETMEZ: aşağıdaki yüzdeler yalnızca seçili kriterlerin puan
// dağılımıdır (bahis oranı / kazanma olasılığı DEĞİLDİR).
// Kadro / sakatlık / teknik direktör / hava verisi kaynakta hiç gelmediği için
// banko "Evet" ASLA verilmez — en iyi ihtimalle "Şartlı".
const RISK_ORDER = ['Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'];
const bumpRisk = (lvl, n) => RISK_ORDER[Math.min(RISK_ORDER.length - 1, Math.max(0, RISK_ORDER.indexOf(lvl) + n))];
const joinCoupon = (arr) => (arr || []).join('-');

// Veri yoksa dürüst boş karar — kör kupon kararı verilmez.
function emptySportotoDecision(message) {
  return {
    available: false,
    mainTrend: null,
    criteriaShare: null,
    narrowCoupon: ['1', 'X', '2'], safeCoupon: ['1', 'X', '2'], mustKeep: ['1', 'X', '2'],
    firstRemovable: null, removalRisk: 'Yüksek',
    targetStrategy: { target12: ['1', 'X', '2'], target13_14: ['1', 'X', '2'], target15: ['1', 'X', '2'] },
    bankoStatus: 'Hayır',
    bankoReasons: [message],
    riskLevel: 'Çok Yüksek',
    dataConfidence: 'Çok Düşük',
    tags: [{ name: 'Veri Yetersiz', weight: 100, reason: message, couponEffect: 'Kör karar verilmez; kapalı (1-X-2) düşünülmeli veya bu maç kupona alınmamalı.' }],
    unknownData: [message],
    shortComment: `${message} Bu maç için yön verilemez; geniş kupon 1-X-2, güçlü aday önerilmez.`,
  };
}

function buildSportotoDecision(ctx) {
  const { scores, totalScore, decisiveCount, clear, main, alt, topOut, secondOut, names, results, availCount, selectedCount } = ctx;

  // Kriter puan payı (%) — OLASILIK DEĞİL, sadece puanların dağılımı.
  const pct = (o) => (totalScore > 0 ? Math.round((scores[o] / totalScore) * 100) : 0);
  const s1 = pct('1'), sX = pct('X'), s2 = pct('2');
  const criteriaShare = { '1': s1, 'X': sX, '2': s2 };
  const spread = Math.max(s1, sX, s2) - Math.min(s1, sX, s2);
  const gap12 = Math.abs(s1 - s2);
  const mainTrend = topOut;
  const outName = (o) => (o === '1' ? names.home : o === '2' ? names.away : 'Beraberlik');

  // ——— VERİ GÜVENLİĞİ (veri bütünlüğü) ———
  // Kaç kriter gerçekten veri buldu? Kadro/hoca/hava hiç gelmediği için tavan "Orta".
  const naRows = results.filter((x) => !x.available);
  const fillRate = selectedCount > 0 ? availCount / selectedCount : 0;
  const dataConfidence = (fillRate >= 0.75 && decisiveCount >= 3) ? 'Orta'
    : (fillRate >= 0.4 && decisiveCount >= 2) ? 'Düşük' : 'Çok Düşük';

  // ——— KUPONLAR ———
  // Geniş kupon: silinmemesi gerekenler. Dar kupon: bütçe için daraltılmış hâli.
  // clear (net lider var) → dar = tek ana seçim, güvenli = ana + hedge.
  // clear değil       → dar = en güçlü iki sonuç, güvenli = kapalı (1-X-2).
  const mainArr = main.split('');
  const narrowCoupon = mainArr;
  // DÜZELTME: Geniş kupon clear durumunda hedge'i (alt) korumalı. Eskiden
  // mainArr üzerinden kurulduğu için tek sonuca düşüyor, geniş kupon dar
  // kuponla aynı çıkıyordu — yani alternatif hiç kupona ulaşmıyordu.
  const safeCoupon = clear ? alt.split('') : ['1', 'X', '2'];

  // Silinmemesi gerekenler: ana eğilim + payı ciddi olan sonuçlar.
  const mustKeep = new Set([mainTrend]);
  if (sX >= X_KEEP_PCT) mustKeep.add('X');
  if (s2 >= AWAY_KEEP_PCT) mustKeep.add('2');
  if (s1 >= HOME_KEEP_PCT) mustKeep.add('1');

  // Dar kuponda ilk düşen sonuç + bu silmenin riski.
  const dropped = safeCoupon.filter((o) => !narrowCoupon.includes(o));
  const firstRemovable = dropped.length ? dropped.sort((a, b) => criteriaShare[a] - criteriaShare[b])[0] : null;
  const removalRisk = !firstRemovable ? 'Düşük'
    : mustKeep.has(firstRemovable) ? 'Yüksek'
    : criteriaShare[firstRemovable] >= 22 ? 'Orta' : 'Düşük';

  // ——— HEDEF STRATEJİSİ (kaç maç tutturmayı hedefliyorsun) ———
  const keepWide = sX >= X_KEEP_PCT || !clear;
  const targetStrategy = {
    target12: narrowCoupon,                          // 12 hedefi → dar, kolon tasarrufu
    target13_14: keepWide ? safeCoupon : narrowCoupon, // X/2 canlıysa geniş tut
    target15: safeCoupon,                            // 15 hedefi → koruyucu
  };

  // ——— RİSK = ÖNERİLEN SEÇİMİN GENİŞLİĞİ (kullanıcı kuralı) ———
  // tek = Düşük · çifte = Orta · üçlü (kapalı) = Yüksek. Veri zayıfsa bir kademe artar.
  let riskLevel = mainArr.length >= 3 ? 'Yüksek' : mainArr.length === 2 ? 'Orta' : 'Düşük';
  if (dataConfidence === 'Çok Düşük' || decisiveCount < 2) riskLevel = bumpRisk(riskLevel, 1);
  if (spread <= 14) riskLevel = bumpRisk(riskLevel, 1);

  // ——— GÜÇLÜ ADAY UYGUNLUĞU ———
  // "Evet" YOK: kadro/sakatlık/hoca bilgisi hiçbir zaman doğrulanamıyor.
  const bankoReasons = [];
  let bankoStatus = 'Şartlı';
  if (!clear) { bankoStatus = 'Hayır'; bankoReasons.push('Seçili kriterlerde net bir lider yok — sonuçlar birbirine yakın.'); }
  if (gap12 < CLOSE_GAP_PCT) { bankoStatus = 'Hayır'; bankoReasons.push(`1 ve 2 kriter payı farkı sadece %${gap12} (15 puanın altında).`); }
  if (decisiveCount < 3) { bankoStatus = 'Hayır'; bankoReasons.push(`Yalnız ${decisiveCount} kriter bir tarafı işaret ediyor — dayanak zayıf.`); }
  if (dataConfidence !== 'Orta') { bankoStatus = 'Hayır'; bankoReasons.push(`Veri güvenliği "${dataConfidence}" — seçili kriterlerin ${naRows.length} tanesi veri bulamadı.`); }
  if (mainTrend === 'X') { bankoStatus = 'Hayır'; bankoReasons.push('En yüksek puan beraberlikte — beraberlik güçlü aday olarak değerlendirilmez.'); }
  if (bankoStatus !== 'Hayır') {
    if (sX >= X_KEEP_PCT) bankoReasons.push(`Beraberlik payı %${sX} — tamamen silinemez.`);
    bankoReasons.push('Kadro eksiği / teknik direktör bilgisi doğrulanamadığı için en fazla "Şartlı" verilir.');
  }

  // ——— ETİKETLER ———
  const tags = [];
  const addTag = (name, weight, reason, couponEffect) => {
    if (weight >= 40) tags.push({ name, weight: Math.max(0, Math.min(100, Math.round(weight))), reason, couponEffect });
  };
  if (!clear) addTag('Belirgin Üstünlük Yok', 65, `Sonuç payları yakın (1: %${s1} · X: %${sX} · 2: %${s2}).`, 'Tek seçim önerilmez; çift ya da kapalı düşünülmeli.');
  if (spread <= 14) addTag('Kapama Adayı', 60 + (14 - spread), 'Üç sonucun kriter payı birbirine çok yakın.', '15 hedefinde 1-X-2 kapalı değerlendirilebilir.');
  if (gap12 < CLOSE_GAP_PCT) addTag('Tek Oynanmaz', TAG_BASE_STRONG + (CLOSE_GAP_PCT - gap12), `1 ve 2 arasındaki fark %${gap12} — güçler yakın.`, 'Tek yerine dar (1-2) veya kapalı oyna.');
  if (sX >= X_KEEP_PCT) addTag('X Silinmez', TAG_BASE + (sX - X_KEEP_PCT) * 2, `Beraberlik kriter payı %${sX}.`, 'Geniş kuponda X kalmalı.');
  if (s2 >= AWAY_KEEP_PCT) addTag('2 Silinmez', TAG_BASE + (s2 - AWAY_TAG_PIVOT), `Deplasman kriter payı %${s2} — gerçek risk.`, 'Geniş kuponda 2 kalmalı.');
  if (naRows.length) addTag('Veri Eksikliği Riski', 40 + naRows.length * 6, `Seçili ${selectedCount} kriterden ${naRows.length} tanesi veri bulamadı: ${naRows.slice(0, 3).map((x) => x.label).join(', ')}.`, 'Eksik veri nedeniyle daha geniş seçim düşünülmeli (kolon sayısı artar).');
  if (decisiveCount <= 1) addTag('Dayanak Zayıf', 70, `Yalnız ${decisiveCount} kriter bir tarafı gösteriyor.`, 'Daha çok kriter seçmeden bu maça tek oynanmamalı.');
  // Alan adları (bankoStatus/bankoReasons) İÇ İSİMDİR, değiştirilmedi; ama
  // kullanıcıya GÖRÜNEN her kelime "güçlü aday" dilinde olmak zorunda.
  if (bankoStatus === 'Hayır') addTag('Güçlü Aday Freni', 60, bankoReasons[0] || 'Güçlü aday koşulları sağlanmadı.', 'Bu maç tek başına güçlü aday sayılmaz.');
  tags.sort((x, y) => y.weight - x.weight);

  // ——— BİLİNMEYENLER (uydurma yok) ———
  const unknownData = naRows.map((x) => `${x.label}: veri bulunamadı — analize katılmadı`);
  unknownData.push('Kadro eksiği / cezalı, teknik direktör değişimi ve hava/zemin bilgisi kaynaktan gelmiyor: Bilinmiyor');

  // ——— KISA YORUM: önce risk → sonra dayanak → sonra karar ———
  const parts = [];
  // "kesin/garanti/banko/yanılmaz/net favori" kökleri olumsuzlama olarak bile
  // kullanılmaz (CLAUDE.md: iddialı dil yok).
  parts.push(clear
    ? `${outName(topOut)} yönünde eğilim var; yine de diğer sonuçlar tamamen elenmez.`
    : `${outName(topOut)} ile ${outName(secondOut)} arasındaki fark kapanabilir; tek sonuç bu farkı yok sayar.`);
  const ev = [`Kriter payları — 1: %${s1} · X: %${sX} · 2: %${s2}.`];
  if (sX >= X_KEEP_PCT) ev.push(`Beraberlik %${sX} ile silinemeyecek kadar canlı.`);
  if (s2 >= AWAY_KEEP_PCT) ev.push(`Deplasman %${s2} ile 2 ihtimalini ayakta tutuyor.`);
  if (naRows.length) ev.push(`${naRows.length} kriter veri bulamadığı için güven düşürüldü.`);
  parts.push(ev.join(' '));
  parts.push(`Dar kupon: ${joinCoupon(narrowCoupon)} · Geniş kupon: ${joinCoupon(safeCoupon)} · Güçlü aday uygunluğu: ${bankoStatus} · Risk: ${riskLevel}.`);

  return {
    available: true,
    mainTrend, criteriaShare,
    narrowCoupon, safeCoupon, mustKeep: [...mustKeep],
    firstRemovable, removalRisk, targetStrategy,
    bankoStatus, bankoReasons,
    riskLevel, dataConfidence,
    tags, unknownData,
    shortComment: parts.join(' '),
  };
}

export { joinCoupon };

// side + strength → o kritere düşen yönlü katkı (0.5 taban + 0.5 güç).
const contrib = (weight, strength) => weight * (0.5 + 0.5 * (strength || 0));

export function userSelectedAnalysisEngine(m, profile) {
  const home = m?.stats?.home || null;
  const away = m?.stats?.away || null;
  const names = {
    home: m?.home?.mediumName || m?.home?.name || 'Ev sahibi',
    away: m?.away?.mediumName || m?.away?.name || 'Deplasman',
  };
  const matchInfo = { home: names.home, away: names.away, league: m?.league || null, date: m?.date || null };

  // Aktif profildeki AÇIK kriterler (sıralı, katalog sırasına göre değil profil sırasına göre değil — katalog sırası okunur)
  const selected = [];
  const cr = profile?.criteria || {};
  for (const key of Object.keys(cr)) {
    const conf = cr[key];
    if (conf && conf.on && CRITERIA_MAP[key]) {
      selected.push({ key, impact: conf.impact || CRITERIA_MAP[key].defaultImpact, filters: conf.filters || null });
    }
  }

  // Hiç kriter seçilmemiş → analiz YAPILMAZ.
  if (!selected.length) {
    const message = 'Analiz yapılabilmesi için önce analiz kriterlerinizi seçmelisiniz.';
    return { ok: false, empty: true, matchInfo, usedCriteria: [], results: [], message,
      sportotoDecision: emptySportotoDecision(message) };
  }

  // İstatistik verisi hiç yoksa dürüstçe belirt.
  if (!home && !away) {
    const message = 'Bu maç için istatistik verisi bulunamadı. Seçili kriterler çalıştırılamadı.';
    return { ok: false, empty: false, noStats: true, matchInfo, usedCriteria: selected.map((s) => CRITERIA_MAP[s.key].label), results: [], message,
      sportotoDecision: emptySportotoDecision(message) };
  }

  // Seçili kriterleri çalıştır.
  const results = [];
  let homeScore = 0, awayScore = 0, drawScore = 0;
  let homeW = 0, awayW = 0, availDirW = 0; // yönlü (home/away) ağırlık toplamları
  // FİLTRE ÇÖZÜMÜ (kullanıcı kuralı): KRİTER BAZLI override > Genel Filtreler
  // > varsayılan. Yani üstten seçilen ayar her kritere körlemesine yayılmaz —
  // kullanıcı istediği kriterde kendi filtresini seçer, istediğini "Tümü/Genel"
  // diyerek genel ayardan MUAF tutar. Uygulayan satır "[Filtre: …]" notu taşır;
  // uygulayamayan DÜRÜSTÇE "genel değer" olarak işaretlenir.
  const gDefaults = { period: 'season', venueScope: 'overall', opponentStrength: 'all' };
  const gFilters = { ...gDefaults, ...(profile?.globalFilters || {}) };
  const explicitOf = (f) => f.period !== gDefaults.period
    || f.venueScope !== gDefaults.venueScope
    || f.opponentStrength !== gDefaults.opponentStrength;

  for (const sel of selected) {
    const def = CRITERIA_MAP[sel.key];
    const weight = wOf(sel.impact);
    // Bu kriterin ETKİN filtresi: kriter override'ı genel ayarın üstüne biner.
    const eff = { ...gFilters, ...(sel.filters || {}) };
    const effExplicit = explicitOf(eff);
    let r;
    // MERKEZÎ LOG FİLTRESİ: filtre açıkken maç-logu ile hesaplanabilen kriterler
    // buradan hesaplanır (sonuç/skor/saha/rakip sınıfı gerçek satırlardan).
    if (effExplicit) {
      try { r = logFilteredEvalApp(sel.key, home, away, names, eff) || undefined; } catch { r = undefined; }
    }
    if (!r) {
      try { r = def.evaluate(home, away, m, names, { filters: eff, filtersExplicit: effExplicit }); } catch { r = { available: false, note: `${def.label}: değerlendirilemedi — analiz dışı.` }; }
    }
    if (effExplicit && r?.available && !r.filterApplied) {
      r = { ...r, note: `${r.note} [Filtre bu kriterde uygulanamadı — kaynakta kırılım yok; genel değer kullanıldı.]` };
    }
    const row = { key: sel.key, label: def.label, cat: def.cat, impact: sel.impact, impactLabel: (IMPACT[sel.impact] || IMPACT.mid).label, weight, points: 0, ...r };
    results.push(row);
    if (!r.available) { row.points = 0; continue; }
    const c = contrib(weight, r.strength);
    if (r.side === 'home') { row.points = c; homeScore += c; homeW += weight; availDirW += weight; }
    else if (r.side === 'away') { row.points = c; awayScore += c; awayW += weight; availDirW += weight; }
    else if (r.side === 'draw') { row.points = c; drawScore += c; }
    else { row.points = 0; } // side null (bilgi) → sonuca etki etmez
  }
  // Görünüm sıralaması: maça etkisi en yüksek olan en üstte.
  // Önce veri bulunanlar, sonra etki ağırlığı (Kritik→Düşük), eşitse kazanılan puan.
  // Not: puan toplamları yukarıda hesaplandı — bu sıralama sonucu DEĞİŞTİRMEZ, sadece görünümü düzenler.
  results.sort((a, b) => ((b.available ? 1 : 0) - (a.available ? 1 : 0)) || (b.weight - a.weight) || (b.points - a.points));

  const r1 = (x) => Math.round(x * 10) / 10;

  const net = homeScore - awayScore;            // + ev lehine
  const scores = { '1': homeScore, 'X': drawScore, '2': awayScore };
  const homeCount = results.filter((x) => x.available && x.side === 'home').length;
  const awayCount = results.filter((x) => x.available && x.side === 'away').length;
  const drawCount = results.filter((x) => x.available && x.side === 'draw').length;
  const counts = { '1': homeCount, 'X': drawCount, '2': awayCount };
  const decisiveCount = homeCount + awayCount + drawCount;

  // ——— KARAR: sonuçları PUANA göre sırala ———
  // Ana Seçim = en yüksek puanlı TEK sonuç. Alternatif = en yüksek İKİ sonucun
  // birleşimi (çift): 1+2 → "12", 1+X → "1X", X+2 → "X2".
  const prio = { '1': 0, 'X': 1, '2': 2 };
  const order = ['1', 'X', '2'].sort((a, b) => (scores[b] - scores[a]) || (counts[b] - counts[a]) || (prio[a] - prio[b]));
  const topOut = order[0];      // en yüksek puanlı sonuç
  const secondOut = order[1];   // ikinci sıradaki sonuç
  const totalScore = homeScore + drawScore + awayScore;
  const lead = totalScore > 0 ? (scores[topOut] - scores[secondOut]) / totalScore : 0;
  const ratio = (homeScore + awayScore) > 0 ? net / (homeScore + awayScore) : 0;

  // ——— KARAR: NET FAVORİ VAR MI? ———
  // Lider AÇIKSA (lead ≥ 0.35): Ana Seçim = TEK sonuç; Alternatif = tek + hedge çifti.
  //   Hedge normalde BERABERLİK (1X/X2); beraberlik zayıf & karşı taraf 2×X'ten
  //   güçlüyse iki-takım çifti (12). Ana seçim X ise X + daha güçlü takım.
  // Lider YOKSA (açık maç): Ana Seçim = en güçlü İKİ sonucun çifti; Alternatif = 1X2.
  const clear = decisiveCount > 0 && lead >= 0.35;
  let main, alt, favor;
  if (clear) {
    main = topOut;
    favor = topOut === '1' ? 'home' : topOut === '2' ? 'away' : 'draw';
    let hedge;
    if (main === 'X') hedge = homeScore >= awayScore ? '1' : '2';
    else {
      const opp = main === '1' ? '2' : '1';
      // HEDGE KURALI (düzeltme): karşı GALİBİYET hedge'i yalnız karşı taraf
      // GERÇEK rakipse verilir — ana seçimin en az %45'i kadar puan toplamış
      // VE X'in belirgin üstünde olmalı. X, kriterlerce YAPISAL olarak az
      // temsil edilir (çoğu kriter ev/dep yönü üretir); X puanının 0/düşük
      // olması "beraberlik imkânsız" demek DEĞİLDİR. Ezici favorinin gerçekçi
      // riski beraberliktir → varsayılan hedge X'tir. Eski kural (karşı > X×2)
      // X=0 iken 2.2 gibi kırıntı puanla bile "12" üretiyordu — saçmaydı.
      const contender = scores[opp] >= scores[main] * 0.45 && scores[opp] > drawScore * 2;
      hedge = contender ? opp : 'X';
    }
    alt = ['1', 'X', '2'].filter((o) => o === main || o === hedge).join('');
  } else {
    main = ['1', 'X', '2'].filter((o) => o === topOut || o === secondOut).join(''); // en güçlü iki → çift
    alt = '1X2';
    favor = 'none';
  }

  // ——— GÜVEN ———
  let confidence;
  if (decisiveCount === 0) confidence = 'Düşük';
  else if (!clear) confidence = 'Düşük';                       // açık maç → net değil
  else if (lead >= 0.55 && decisiveCount >= 2) confidence = 'Yüksek';
  else confidence = 'Orta';

  // ——— RİSK + GEREKÇE (yalnız seçili kriterlerden) ———
  const sideOf = (o) => (o === '1' ? 'home' : o === '2' ? 'away' : 'draw');
  const outName = (o) => (o === '1' ? names.home : o === '2' ? names.away : 'Beraberlik');
  const rowsFor = (o) => results.filter((x) => x.available && x.side === sideOf(o)).map((x) => x.label);
  const topSup = rowsFor(topOut);
  const secondSup = rowsFor(secondOut);
  const naRows = results.filter((x) => !x.available).map((x) => x.label);

  let risk;
  if (decisiveCount === 0) {
    // "güvenli" DENMEZ (bkz. backend/src/analysis/masterEngine.js'teki aynı
    // karar): geniş tercih daha güvenli değil, daha GENİŞ kapsar ve kolon
    // sayısını artırır. Güvence iddiası kurulmaz.
    risk = 'Seçili kriterler net bir taraf göstermedi — veri yetersiz; çift/üçlü ihtimal daha geniş kapsar (kolon sayısı artar).';
  } else if (!clear) {
    risk = `Bu maçta belirgin bir üstünlük yok — puanlar birbirine yakın (1: ${r1(homeScore)} · X: ${r1(drawScore)} · 2: ${r1(awayScore)}), maç her sonuca açık. Ana seçim geniş tutuldu (${main}), alternatif üç ihtimal (${alt}).`;
  } else if (lead >= 0.55) {
    risk = `${outName(topOut)} açık ara önde (${r1(scores[topOut])} — ${r1(scores[secondOut])}). Ana seçim ${main} tek sonuca dayanır; daha geniş kapsamak istersen alternatif ${alt}.`;
  } else {
    risk = `${outName(topOut)} önde ama ${outName(secondOut)} tamamen silinmez (${r1(scores[topOut])} — ${r1(scores[secondOut])}). Daha geniş kapsamak için alternatif ${alt} tercih edilebilir (kolon sayısı artar).`;
  }

  const parts = [];
  if (topSup.length) parts.push(`En güçlü taraf ${topOut} (${outName(topOut)}): ${topSup.slice(0, 3).join(', ')}.`);
  if (secondSup.length) parts.push(`İkinci sırada ${secondOut} (${outName(secondOut)}): ${secondSup.slice(0, 2).join(', ')}.`);
  if (naRows.length) parts.push(`${naRows.slice(0, 3).join(', ')} için veri bulunamadığından bu kriterler sonuca katılmadı.`);
  parts.push(`Taraf puanları — 1: ${r1(homeScore)} · X: ${r1(drawScore)} · 2: ${r1(awayScore)}. Ana seçim ${main}, alternatif ${alt}.`);
  const reason = parts.join(' ');

  // Kupon karar katmanı (Spor Toto): aynı kriter puanlarından dar/geniş kupon,
  // hedef stratejisi, risk ve banko uygunluğu türetir. Karara yeni veri KATMAZ.
  const sportotoDecision = buildSportotoDecision({
    scores, totalScore, decisiveCount, clear, main, alt, topOut, secondOut, names, results,
    availCount: results.filter((x) => x.available).length,
    selectedCount: results.length,
  });

  return {
    ok: true,
    matchInfo,
    profileName: profile?.name || 'Kullanıcı Seçimli Analiz',
    usedCriteria: results.map((r) => r.label),
    usedCount: results.length,
    results,
    tally: {
      home: r1(homeScore), away: r1(awayScore), draw: r1(drawScore),
      net: r1(net), diff: r1(Math.abs(net)),
      homeCount: results.filter((x) => x.available && x.side === 'home').length,
      awayCount: results.filter((x) => x.available && x.side === 'away').length,
      drawCount: results.filter((x) => x.available && x.side === 'draw').length,
      leader: net > 0.05 ? 'home' : net < -0.05 ? 'away' : 'draw',
    },
    verdict: { main, alt, confidence, risk, reason, favor, ratio: Math.round(ratio * 100) / 100 },
    sportotoDecision,
  };
}
